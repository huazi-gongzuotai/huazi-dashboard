/* ==== 功能：资料库 START ====
   文件夹 + 笔记 + 文件，扁平数组组树：
   refs = [
     { id, type:'folder', name, parent, _u },
     { id, type:'note',   title, content, parent, _u },
     { id, type:'file',   name, size, mime, parent, local:1, _u }
   ]
   parent = 上级文件夹 id，'' = 根目录。
   文件本体存 IndexedDB（key: refs_file_<id>），只在本机打开；
   元数据正常同步，另一台设备能看到清单 + 「在本机」占位说明。
   笔记内容会被 AI 问答带上当上下文，文件本体不会（同步通道装不下）。 */
const Refs = {
  KEY: 'refs',
  dir: '',          // 当前所在文件夹 id，'' = 根
  _editing: null,   // 正在编辑的笔记 id
  _chat: [],        // 资料库 AI 对话历史
  _aiBusy: false,

  all(){
    return Store.list(this.KEY, (a, b) => (a._u || 0) < (b._u || 0) ? 1 : -1);
  },

  folder(id){ return this.all().find(x => x.type === 'folder' && x.id === id) || null; },

  children(pid){
    return this.all()
      .filter(x => (x.parent || '') === pid)
      .sort((a, b) => {
        if (a.type === 'folder' && b.type !== 'folder') return -1;
        if (b.type === 'folder' && a.type !== 'folder') return 1;
        return String(a.name || a.title || '').localeCompare(String(b.name || b.title || ''), 'zh');
      });
  },

  /* ── 一次性迁移：旧版 cat 结构的条目 → 「原资料」文件夹下的笔记 ── */
  migrate(){
    if (Store.get('refs_v2')) return;
    Store.set('refs_v2', 1);
    const raw = Store.get(this.KEY, []);
    if (!Array.isArray(raw) || !raw.length) return;
    const old = raw.filter(x => x && x.id && !x.type && (x.title || x.content));
    if (!old.length) return;
    const pid = Util.uid();
    Store.upsert(this.KEY, { id: pid, type: 'folder', name: '原资料', parent: '' });
    old.forEach(r => Store.upsert(this.KEY, {
      id: r.id, type: 'note', title: r.title || '未命名',
      content: ((r.cat && r.cat !== '未分类') ? '【' + r.cat + '】\n' : '') + (r.content || ''),
      parent: pid
    }));
  },

  open(id){ this.dir = id || ''; this.render(); },

  /* ── 渲染 ── */
  render(){
    this.migrate();

    // 面包屑：根 / 各级 / 当前
    const trail = []; let p = this.dir;
    while (p){ const f = this.folder(p); if (!f) break; trail.unshift(f); p = f.parent || ''; }
    const crumbs = [{ id:'', name:'资料库' }].concat(trail);
    document.getElementById('refCrumb').innerHTML =
      crumbs.map((c, i) =>
        (i > 0 ? '<span class="sep">/</span>' : '') +
        `<button class="${c.id === this.dir ? 'cur' : ''}" onclick="Refs.open('${c.id}')">${Util.esc(c.name)}</button>`).join('');

    const kids = this.children(this.dir);
    const box = document.getElementById('refList');
    this.drawChat();
    if (!kids.length){
      box.innerHTML = '<div class="empty">这个文件夹还是空的。<br>📁 新建文件夹 · ⬆ 拖文件进来 · 📝 写条笔记</div>';
      return;
    }
    box.innerHTML = kids.map(it => this.row(it)).join('');
  },

  row(it){
    if (it.type === 'folder'){
      return `<div class="fitem">
        <span class="ico">📁</span>
        <div class="grow"><div class="name" onclick="Refs.open('${it.id}')">${Util.esc(it.name)}</div></div>
        <button class="del" title="重命名" onclick="Refs.rename('${it.id}')">✏</button>
        <button class="del" onclick="Refs.del('${it.id}')">✕</button>
      </div>`;
    }
    if (it.type === 'note'){
      const c = it.content || '';
      return `<div class="fitem">
        <span class="ico">📝</span>
        <div class="grow">
          <div class="name" onclick="Refs.pickNote('${it.id}')">${Util.esc(it.title)}</div>
          <div class="meta">${Util.esc(c.slice(0, 40))}${c.length > 40 ? '…' : ''}</div>
        </div>
        <button class="del" onclick="Refs.del('${it.id}')">✕</button>
      </div>`;
    }
    const local = !!it.local;
    return `<div class="fitem">
      <span class="ico">${this.icoOf(it.mime)}</span>
      <div class="grow">
        <div class="name">${Util.esc(it.name)}</div>
        <div class="meta">${Util.fmtSize(it.size)}${local ? '' : ' · 存于你的另一台设备'}</div>
      </div>
      <button class="del" title="重命名" onclick="Refs.rename('${it.id}')">✏</button>
      ${local ? `<button class="open" onclick="Refs.viewFile('${it.id}')">查看</button>` : ''}
      <button class="del" onclick="Refs.del('${it.id}')">✕</button>
    </div>`;
  },

  /* ── 重命名：文件夹 / 文件（改名只动元数据，正常同步） ── */
  rename(id){
    const it = this.all().find(x => x.id === id);
    if (!it) return;
    const cur = it.name || '';
    const name = prompt('改个名字', cur);
    if (name === null) return;
    if (!name.trim()) return UI.toast('名字不能为空');
    Store.upsert(this.KEY, { id, name: name.trim() });
    this.render();
    UI.toast('已改名');
  },

  icoOf(m){
    m = m || '';
    if (m.includes('pdf')) return '📕';
    if (m.includes('word') || m.includes('document')) return '📘';
    if (m.includes('excel') || m.includes('sheet')) return '📗';
    if (m.includes('ppt') || m.includes('presentation')) return '📙';
    if (m.includes('image')) return '🖼';
    if (m.includes('text') || m.includes('json')) return '📄';
    return '📄';
  },

  /* ── 文件夹 ── */
  newFolder(){
    const name = prompt('文件夹名字', '');
    if (!name || !name.trim()) return;
    Store.upsert(this.KEY, { type: 'folder', name: name.trim(), parent: this.dir });
    this.render(); UI.toast('文件夹建好了');
  },

  /* ── 笔记 ── */
  pickNote(id = null){
    this._editing = id;
    const it = id ? this.all().find(x => x.id === id) : null;
    document.getElementById('refNoteTitleLbl').textContent = it ? '📝 编辑笔记' : '📝 写笔记';
    document.getElementById('refNoteTitle').value = it ? (it.title || '') : '';
    document.getElementById('refNoteContent').value = it ? (it.content || '') : '';
    document.getElementById('refNoteOverlay').style.display = 'flex';
    setTimeout(() => document.getElementById('refNoteTitle').focus(), 60);
  },

  closeNote(){
    document.getElementById('refNoteOverlay').style.display = 'none';
    this._editing = null;
  },

  saveNote(){
    const title = document.getElementById('refNoteTitle').value.trim();
    const content = document.getElementById('refNoteContent').value.trim();
    if (!title) return UI.toast('标题要写');
    const base = { type: 'note', title, content, parent: this.dir };
    if (this._editing) Store.upsert(this.KEY, Object.assign({ id: this._editing }, base));
    else Store.upsert(this.KEY, base);
    this.closeNote();
    this.render();
    UI.toast('已存好，AI 问答也能用上它了');
  },

  /* ── 文件 ── */
  pickFiles(){
    const input = document.getElementById('refFile');
    input.value = '';
    input.click();
  },

  async onFiles(fileList){
    const files = Array.from(fileList || []);
    if (!files.length) return;
    for (const f of files) await this.addFile(f);
    this.render();
  },

  async addFile(file){
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) return UI.toast('文件超过 100MB，放不进来');
    const id = Util.uid();
    const isImg = !!file.type && file.type.startsWith('image/');
    try {
      if (isImg){
        // 图片压缩后存，手机原图一张就几 MB，这里压到 1200px 足够看
        const dataUrl = await Util.compressImage(file, 1200, .75);
        await IDB.put('refs_file_' + id, dataUrl);
      } else {
        const buf = await file.arrayBuffer();
        await IDB.put('refs_file_' + id, buf);
      }
    } catch(e){
      UI.toast('「' + file.name + '」没存成功');
      return;
    }
    Store.upsert(this.KEY, {
      id, type: 'file',
      name: file.name, size: file.size,
      mime: file.type || 'application/octet-stream',
      parent: this.dir, local: 1
    });
  },

  async viewFile(id){
    const it = this.all().find(x => x.id === id);
    if (!it) return;
    const overlay = document.getElementById('refViewOverlay');
    const body = document.getElementById('refViewBody');
    const down = document.getElementById('refViewDown');
    document.getElementById('refViewTitle').textContent = it.name;
    overlay.style.display = 'flex';
    down.style.display = '';

    const data = await IDB.get('refs_file_' + id);
    if (!it.local || data === null){
      body.innerHTML = '<div class="file-miss">这个文件本体存在你的另一台设备上<br>本机只同步到了清单，看不到内容<br>去存文件的那台设备上看吧</div>';
      down.style.display = 'none';
      return;
    }

    // 图片：压缩过的 dataURL 字符串
    if (typeof data === 'string'){
      body.innerHTML = `<img src="${data}" alt="">`;
      down.onclick = () => {
        const a = document.createElement('a');
        a.href = data; a.download = it.name; a.click();
      };
      return;
    }

    const url = URL.createObjectURL(new Blob([data], { type: it.mime || 'application/octet-stream' }));
    down.onclick = () => {
      const a = document.createElement('a');
      a.href = url; a.download = it.name; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    };
    if (it.mime === 'application/pdf'){
      body.innerHTML = `<iframe src="${url}"></iframe>`;
    } else if (it.mime && it.mime.startsWith('image/')){
      body.innerHTML = `<img src="${url}" alt="">`;
    } else {
      body.innerHTML = `<div class="doc-hint">浏览器里看不了这种文件<br>点右上角「下载」，用 WPS / Office 打开</div>`;
    }
  },

  closeView(){
    document.getElementById('refViewOverlay').style.display = 'none';
    document.getElementById('refViewBody').innerHTML = '';
  },

  /* ── 删除 ── */
  del(id){
    const it = this.all().find(x => x.id === id);
    if (!it) return;
    if (it.type === 'folder'){
      if (this.children(id).length) return UI.toast('文件夹里有东西，先清空再删');
      if (!confirm('删掉文件夹「' + it.name + '」？')) return;
    } else if (!confirm('删掉「' + (it.name || it.title) + '」？')) return;
    Store.softDelete(this.KEY, id);
    if (it.type === 'file') IDB.del('refs_file_' + id);
    this.render();
    UI.toast('已删除');
  },

  /* ── 资料库 AI ── */
  refSysPrompt(){
    const items = this.all();
    const notes = items.filter(x => x.type === 'note')
      .map(n => `【${n.title || '未命名'}】\n${n.content || ''}`)
      .join('\n\n')
      .slice(0, 6000);
    const files = items.filter(x => x.type === 'file')
      .map(f => `- ${f.name}（${Util.fmtSize(f.size)}）`)
      .join('\n')
      .slice(0, 1500);
    let sys = '你是华子的资料整理助手。华子把学习资料和工作素材存在资料库里。\n' +
      '你能读到的资料如下（笔记是全文，文件只有名字和大小，正文读不到）：\n\n';
    sys += notes ? '【笔记】\n' + notes + '\n\n' : '【笔记】暂时没有笔记。\n\n';
    sys += files ? '【文件清单】\n' + files : '【文件清单】暂时没有文件。';
    sys += '\n\n回答用中文。找资料时先查上面的笔记；被问到某个文件的内容时，' +
      '老实说读不到文件正文，建议华子把要点整理成笔记再问。总结要分点、实用。';
    const pref = Store.get('ai_pref', '');
    if (pref) sys += '\n\n关于华子的偏好：\n' + pref;
    return sys;
  },

  async askAi(){
    if (this._aiBusy) return;
    const input = document.getElementById('refAiInput');
    const q = input.value.trim();
    if (!q) return;
    const key = Store.getSecret('deepseek');
    if (!key){
      document.getElementById('refChat').innerHTML =
        '<div class="empty">还没配置 key<br><button class="btn" style="margin-top:10px" onclick="App.go(\'settings\')">去设置</button></div>';
      return;
    }
    input.value = '';
    this._chat.push({ role:'user', content: q });
    this.drawChat();
    this._aiBusy = true;

    const chat = document.getElementById('refChat');
    const typing = document.createElement('div');
    typing.className = 'typing'; typing.textContent = '在想……';
    chat.appendChild(typing);

    try {
      const r = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 'content-type':'application/json', 'Authorization':'Bearer ' + key },
        body: JSON.stringify({
          model: 'deepseek-chat', stream: true,
          messages: [{ role:'system', content: this.refSysPrompt() }, ...this._chat.slice(-20)]
        })
      });
      if (r.status === 401) throw new Error('key 不对，去设置检查');
      if (r.status === 402) throw new Error('账户余额不足');
      if (!r.ok) throw new Error('接口暂时用不了（' + r.status + '）');

      typing.remove();
      const msg = document.createElement('div');
      msg.className = 'msg ai';
      chat.appendChild(msg);
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let buf = '', full = '';
      while (true){
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream:true });
        const lines = buf.split('\n'); buf = lines.pop();
        for (const line of lines){
          const s = line.trim();
          if (!s.startsWith('data:')) continue;
          const payload = s.slice(5).trim();
          if (payload === '[DONE]') continue;
          try {
            const j = JSON.parse(payload);
            const d = j.choices?.[0]?.delta?.content || '';
            if (d){ full += d; msg.textContent = full; }
          } catch(_){}
        }
      }
      if (!full) throw new Error('回了句空话，再试');
      this._chat.push({ role:'assistant', content: full });
    } catch(e){
      typing.remove();
      const err = document.createElement('div');
      err.className = 'msg ai err';
      err.textContent = e.message.includes('Failed to fetch') ? '网络连不上' : e.message;
      chat.appendChild(err);
      this._chat.pop();
    } finally {
      this._aiBusy = false;
    }
  },

  drawChat(){
    const el = document.getElementById('refChat');
    el.innerHTML = this._chat.length
      ? this._chat.map(m => `<div class="msg ${m.role === 'user' ? 'user' : 'ai'}">${Util.esc(m.content)}</div>`).join('')
      : '<div class="msg ai">把资料存进来，然后问我「库里有哪些关于××的资料」或者「帮我总结××的要点」。</div>';
  }
};

/* 拖拽收藏：电脑上把文件拖进虚线框 */
(function(){
  const dz = document.getElementById('refDrop');
  if (!dz) return;
  ['dragenter','dragover'].forEach(ev =>
    dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('over'); }));
  ['dragleave','drop'].forEach(ev =>
    dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('over'); }));
  dz.addEventListener('drop', e => {
    const files = e.dataTransfer && e.dataTransfer.files;
    if (files && files.length) Refs.onFiles(files);
  });
})();
/* ==== 功能：资料库 END ==== */
