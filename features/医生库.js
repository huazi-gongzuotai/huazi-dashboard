/* ==== 功能：医生IP库 START ====
   二级菜单 + 图片存储 + AI 助手：
   docs = [
     { id, type:'folder',  name, parent, _u },
     { id, type:'doctor',  name, dept, special, content, notes, parent, _u },
     { id, type:'image',   name, size, mime, parent:<doctor_id>, cat:'schedule'|'price'|'poster', local:1, _u }
   ]
   图片本体存 IndexedDB（key: doc_img_<id>），只在本机。
   医生详情页内置 AI，带上该医生的资料当上下文。 */
const Docs = {
  KEY: 'docs',
  dir: '',              // 当前文件夹 id，'' = 根
  _curDoc: null,        // 当前查看的医生 id
  _editing: null,       // 正在编辑的医生 id（null = 新增）
  _chat: [],            // 当前医生 AI 对话历史
  _aiBusy: false,

  all(){
    return Store.list(this.KEY, (a, b) => (a._u || 0) < (b._u || 0) ? 1 : -1);
  },
  folder(id){ return this.all().find(x => x.type === 'folder' && x.id === id) || null; },
  doctor(id){ return this.all().find(x => x.type === 'doctor' && x.id === id) || null; },

  children(pid){
    return this.all()
      .filter(x => (x.parent || '') === pid)
      .sort((a, b) => {
        if (a.type === 'folder' && b.type !== 'folder') return -1;
        if (b.type === 'folder' && a.type !== 'folder') return 1;
        return String(a.name || '').localeCompare(String(b.name || ''), 'zh');
      });
  },

  /* ── 一次性迁移：旧版无 type 的医生卡 → type:'doctor' ── */
  migrate(){
    if (Store.get('docs_v2')) return;
    Store.set('docs_v2', 1);
    const raw = Store.get(this.KEY, []);
    if (!Array.isArray(raw) || !raw.length) return;
    raw.filter(x => x && x.id && !x.type).forEach(d =>
      Store.upsert(this.KEY, Object.assign({}, d, { type:'doctor', parent: d.parent || '' }))
    );
  },

  /* ── 渲染入口 ── */
  render(){
    this.migrate();
    this._curDoc = null;
    this._chat = [];
    document.getElementById('docsRoot').style.display = '';
    document.getElementById('docsDetail').style.display = 'none';

    // 面包屑
    const trail = []; let p = this.dir;
    while (p){ const f = this.folder(p); if (!f) break; trail.unshift(f); p = f.parent || ''; }
    const crumbs = [{ id:'', name:'医生库' }].concat(trail);
    document.getElementById('docCrumb').innerHTML =
      crumbs.map((c, i) =>
        (i > 0 ? '<span class="sep">/</span>' : '') +
        `<button class="${c.id === this.dir ? 'cur' : ''}" onclick="Docs.open('${c.id}')">${Util.esc(c.name)}</button>`
      ).join('');

    const kids = this.children(this.dir);
    const box = document.getElementById('docList');
    if (!kids.length){
      box.innerHTML = '<div class="empty">还没有医生，点「新增医生」加第一个</div>';
      return;
    }
    box.innerHTML = kids.map(it => this.row(it)).join('');
  },

  row(it){
    if (it.type === 'folder'){
      const cnt = this.children(it.id).length;
      return `<div class="fitem">
        <span class="ico">📁</span>
        <div class="grow"><div class="name" onclick="Docs.open('${it.id}')">${Util.esc(it.name)}</div>
          <div class="meta">${cnt} 位医生</div></div>
        <button class="del" title="重命名" onclick="Docs.rename('${it.id}')">✏</button>
        <button class="del" onclick="Docs.del('${it.id}')">✕</button>
      </div>`;
    }
    // doctor
    return `<div class="fitem">
      <span class="ico">👨‍⚕️</span>
      <div class="grow"><div class="name" onclick="Docs.openDoctor('${it.id}')">${Util.esc(it.name)}</div>
        <div class="meta">${Util.esc(it.dept || '')}</div></div>
      <button class="del" onclick="Docs.del('${it.id}')">✕</button>
    </div>`;
  },

  open(id){ this.dir = id || ''; this.render(); },

  /* ── 医生详情页 ── */
  openDoctor(id){
    const d = this.doctor(id);
    if (!d) return;
    this._curDoc = id;
    this._chat = [];
    document.getElementById('docsRoot').style.display = 'none';
    document.getElementById('docsDetail').style.display = '';
    document.getElementById('docDetailName').textContent = d.name + (d.dept ? ' · ' + d.dept : '');
    this.renderInfo(d);
    this.renderImgCat('schedule');
    this.renderImgCat('price');
    this.renderImgCat('poster');
    this.renderImgCat('other');
    this.initDrop();
    this.renderChat();
  },

  back(){
    this._curDoc = null;
    this._chat = [];
    this.render();
  },

  renderInfo(d){
    document.getElementById('docInfoArea').innerHTML = [
      ['技术特色', d.special], ['内容方向', d.content], ['备注', d.notes]
    ].map(([k, v]) => `<div class="doc-info-row"><b>${k}</b><span>${Util.esc(v || '—')}</span></div>`).join('');
  },

  editCurrent(){
    if (!this._curDoc) return;
    this.editDoctor(this._curDoc);
  },

  /* ── 文件夹 ── */
  newFolder(){
    const name = prompt('分组名字', '');
    if (!name || !name.trim()) return;
    Store.upsert(this.KEY, { type:'folder', name: name.trim(), parent: this.dir });
    this.render(); UI.toast('分组建好了');
  },

  rename(id){
    const it = this.all().find(x => x.id === id);
    if (!it) return;
    const name = prompt('改个名字', it.name || '');
    if (name === null) return;
    if (!name.trim()) return UI.toast('名字不能为空');
    Store.upsert(this.KEY, { id, name: name.trim() });
    this.render();
    UI.toast('已改名');
  },

  /* 图片重命名（在预览弹层里点 ✏ 触发） */
  renameImg(id){
    const im = this.all().find(x => x.id === id && x.type === 'image');
    if (!im) return;
    const name = prompt('改个名字', im.name || '');
    if (name === null) return;
    if (!name.trim()) return UI.toast('名字不能为空');
    Store.upsert(this.KEY, { id, name: name.trim() });
    document.getElementById('docImgTitle').textContent = name.trim();
    this.renderImgCat(im.cat);
    UI.toast('已改名');
  },

  /* ── 医生编辑 ── */
  newDoctor(){
    this._editing = null;
    document.getElementById('docEditTitle').textContent = '➕ 新增医生';
    ['docName','docDept','docSpecial','docContent','docNotes'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('docEditOverlay').style.display = 'flex';
    setTimeout(() => document.getElementById('docName').focus(), 60);
  },

  editDoctor(id){
    const d = this.doctor(id);
    if (!d) return;
    this._editing = id;
    document.getElementById('docEditTitle').textContent = '编辑医生';
    document.getElementById('docName').value    = d.name || '';
    document.getElementById('docDept').value    = d.dept || '';
    document.getElementById('docSpecial').value = d.special || '';
    document.getElementById('docContent').value = d.content || '';
    document.getElementById('docNotes').value   = d.notes || '';
    document.getElementById('docEditOverlay').style.display = 'flex';
  },

  closeEdit(){
    document.getElementById('docEditOverlay').style.display = 'none';
    this._editing = null;
  },

  saveDoctor(){
    const name = document.getElementById('docName').value.trim();
    if (!name) return UI.toast('至少写个名字');
    const base = {
      type:'doctor',
      name,
      dept:    document.getElementById('docDept').value.trim(),
      special: document.getElementById('docSpecial').value.trim(),
      content: document.getElementById('docContent').value.trim(),
      notes:   document.getElementById('docNotes').value.trim(),
      parent: this.dir
    };
    if (this._editing) Store.upsert(this.KEY, Object.assign({ id: this._editing }, base));
    else Store.upsert(this.KEY, base);
    this.closeEdit();
    if (this._curDoc) this.openDoctor(this._curDoc); else this.render();
    UI.toast('已保存');
  },

  _catMap: { schedule:'Sched', price:'Price', poster:'Poster', other:'Other' },

  /* ── 图片存储 ── */
  renderImgCat(cat){
    const docId = this._curDoc;
    const imgs = this.all().filter(x => x.type === 'image' && x.parent === docId && x.cat === cat);
    const box = document.getElementById('docImg' + this._catMap[cat]);
    if (!imgs.length){
      box.innerHTML = '<div class="empty-i">还没有图片</div>';
      return;
    }
    box.innerHTML = imgs.map(im => `<div class="thumb" onclick="Docs.viewImg('${im.id}')">
      <img src="" id="dthumb_${im.id}" alt="${Util.esc(im.name)}">
      <button class="tdel" onclick="event.stopPropagation();Docs.delImg('${im.id}')">✕</button>
    </div>`).join('');
    // 异步加载缩略图
    imgs.forEach(im => this.loadThumb(im.id));
  },

  async loadThumb(id){
    const data = await IDB.get('doc_img_' + id);
    const el = document.getElementById('dthumb_' + id);
    if (el && data) el.src = data;
  },

  pickImg(cat){
    const input = document.getElementById('docFile');
    input.onchange = () => this.onImgFiles(input.files, cat);
    input.value = '';
    input.click();
  },

  async onImgFiles(fileList, cat){
    const files = Array.from(fileList || []).filter(f => f.type && f.type.startsWith('image/'));
    if (!files.length) return UI.toast('只支持图片');
    for (const f of files) await this.addImgFile(f, cat);
    this.renderImgCat(cat);
    UI.toast('图片已保存');
  },

  async addImgFile(file, cat){
    if (!this._curDoc) return;
    const id = Util.uid();
    try {
      const dataUrl = await Util.compressImage(file, 1400, .78);
      await IDB.put('doc_img_' + id, dataUrl);
    } catch(e){
      UI.toast('「' + file.name + '」没存成功');
      return;
    }
    Store.upsert(this.KEY, {
      id, type:'image', name: file.name, size: file.size,
      mime: file.type, parent: this._curDoc, cat, local: 1
    });
  },

  initDrop(){
    const cats = [
      ['docDropSched', 'schedule'],
      ['docDropPrice', 'price'],
      ['docDropPoster', 'poster'],
      ['docDropOther', 'other']
    ];
    cats.forEach(([elId, cat]) => {
      const dz = document.getElementById(elId);
      if (!dz || dz._init) return;
      dz._init = true;
      ['dragenter','dragover'].forEach(ev =>
        dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('over'); }));
      ['dragleave','drop'].forEach(ev =>
        dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('over'); }));
      dz.addEventListener('drop', e => {
        const files = e.dataTransfer && e.dataTransfer.files;
        if (files && files.length) this.onImgFiles(files, cat);
      });
      dz.addEventListener('click', () => this.pickImg(cat));
    });
  },

  async viewImg(id){
    const im = this.all().find(x => x.id === id && x.type === 'image');
    if (!im) return;
    this._viewImgId = id;
    document.getElementById('docImgTitle').textContent = im.name;
    document.getElementById('docImgOverlay').style.display = 'flex';
    const body = document.getElementById('docImgBody');
    body.innerHTML = '<div class="empty-i">加载中…</div>';
    const data = await IDB.get('doc_img_' + id);
    if (data) body.innerHTML = `<img src="${data}" alt="${Util.esc(im.name)}">`;
    else body.innerHTML = '<div class="file-miss">图片本体存在另一台设备上</div>';
  },

  closeImg(){
    document.getElementById('docImgOverlay').style.display = 'none';
    document.getElementById('docImgBody').innerHTML = '';
  },

  delImg(id){
    if (!confirm('删掉这张图片？')) return;
    Store.softDelete(this.KEY, id);
    IDB.del('doc_img_' + id);
    const im = this.all().find(x => x.id === id);
    // 重新渲染对应分类（注意 softDelete 后已不在 list 里，取 cat 需在删之前）
    const cats = ['schedule','price','poster','other'];
    cats.forEach(c => this.renderImgCat(c));
    UI.toast('已删除');
  },

  /* ── 删除文件夹/医生 ── */
  del(id){
    const it = this.all().find(x => x.id === id);
    if (!it) return;
    if (it.type === 'folder'){
      if (this.children(id).length) return UI.toast('分组里有医生，先移走再删');
      if (!confirm('删掉分组「' + it.name + '」？')) return;
      Store.softDelete(this.KEY, id);
    } else if (it.type === 'doctor'){
      if (!confirm('删掉医生「' + it.name + '」？其下图片也会一起删')) return;
      // 删该医生的所有图片
      this.all().filter(x => x.type === 'image' && x.parent === id).forEach(im => {
        Store.softDelete(this.KEY, im.id);
        IDB.del('doc_img_' + im.id);
      });
      Store.softDelete(this.KEY, id);
    } else return;
    this.render();
    UI.toast('已删除');
  },

  /* ── 医生专属 AI ── */
  docSysPrompt(){
    const d = this.doctor(this._curDoc);
    if (!d) return '你是华子的工作助手。';
    let sys = `你是华子的医美内容助手。华子正在孵化一位医生的 IP，这是该医生的资料：\n` +
      `姓名：${d.name}\n科室定位：${d.dept || '未填写'}\n` +
      `技术特色：${d.special || '未填写'}\n内容方向：${d.content || '未填写'}\n备注：${d.notes || '无'}\n\n` +
      `回答用中文，实用、具体、可直接落地。`;
    const pref = Store.get('ai_pref', '');
    if (pref) sys += `\n\n关于华子的偏好：\n${pref}`;
    return sys;
  },

  async askAi(){
    if (this._aiBusy) return;
    const input = document.getElementById('docAiInput');
    const q = input.value.trim();
    if (!q) return;
    const key = Store.getSecret('deepseek');
    if (!key){
      document.getElementById('docChat').innerHTML =
        '<div class="empty">还没配置 key<br><button class="btn" style="margin-top:10px" onclick="App.go(\'settings\')">去设置</button></div>';
      return;
    }
    input.value = '';
    this._chat.push({ role:'user', content: q });
    this.drawChat();
    this._aiBusy = true;

    const chat = document.getElementById('docChat');
    const typing = document.createElement('div');
    typing.className = 'typing'; typing.textContent = '在想……';
    chat.appendChild(typing);

    try {
      const r = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 'content-type':'application/json', 'Authorization':'Bearer ' + key },
        body: JSON.stringify({
          model: 'deepseek-chat', stream: true,
          messages: [{ role:'system', content: this.docSysPrompt() }, ...this._chat.slice(-20)]
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
    const el = document.getElementById('docChat');
    el.innerHTML = this._chat.length
      ? this._chat.map(m => `<div class="msg ${m.role === 'user' ? 'user' : 'ai'}">${Util.esc(m.content)}</div>`).join('')
      : '<div class="msg ai">问吧。我已经知道这位医生的情况了。</div>';
  },

  renderChat(){
    this._chat = [];
    this.drawChat();
  }
};
/* ==== 功能：医生IP库 END ==== */
