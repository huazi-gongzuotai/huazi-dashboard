/* ==== 功能：私密备忘 START ====
   苹果备忘录风格：多条备忘，每条可文字 + 图片。
   - 数据 key 以 memo_ 开头，Store.dump(true) 排除 → 不同步不备份
   - 图片存 IndexedDB（key: memo_img_<id>），纯本地
   - 口令哈希存 secret 命名空间
   注意：防熟人的弱保护，不是加密。口令忘了打不开。 */
const Memo = {
  KEY: 'memo_notes',     // memo_ 前缀 → 不同步不备份
  unlocked: false,
  _curNote: null,        // 当前编辑的备忘 id
  _autosave: null,       // 自动保存定时器

  hasPin(){ return !!Store.getSecret('memoPin'); },

  all(){
    return Store.list(this.KEY, (a, b) => (a.updatedAt || a.createdAt || 0) < (b.updatedAt || b.createdAt || 0) ? 1 : -1);
  },

  get(id){ return this.all().find(n => n.id === id); },

  /* ── 一次性迁移：旧版单条 → 新版多条 ── */
  migrate(){
    if (Store.get('memo_v2')) return;
    Store.set('memo_v2', 1);
    const raw = Store.get(this.KEY, []);
    if (!Array.isArray(raw) || !raw.length) return;
    raw.filter(x => x && x.id && x.text !== undefined && !x.title && !x.createdAt).forEach(n =>
      Store.upsert(this.KEY, Object.assign({}, n, {
        title: n.text.slice(0, 20) || '备忘',
        createdAt: n._u || Date.now(),
        updatedAt: n._u || Date.now()
      }))
    );
  },

  render(){
    this.migrate();
    const lock = document.getElementById('memoLock');
    const main = document.getElementById('memoMain');
    if (this.unlocked && this.hasPin()){
      lock.style.display = 'none';
      main.style.display = '';
      this.showList();
    } else {
      this.unlocked = false;
      lock.style.display = '';
      main.style.display = 'none';
      document.getElementById('memoLockHint').textContent = this.hasPin()
        ? '输入口令解锁' : '第一次使用？输入 4 位以上口令即自动设置';
    }
  },

  /* ── 列表视图 ── */
  showList(){
    this._curNote = null;
    document.getElementById('memoListView').style.display = '';
    document.getElementById('memoEditView').style.display = 'none';
    const list = this.all();
    const box = document.getElementById('memoNoteList');
    if (!list.length){
      box.innerHTML = '<div class="empty">还没有备忘，点「新建」写第一条</div>';
      return;
    }
    box.innerHTML = list.map(n => {
      const t = n.title || (n.text || '').slice(0, 20) || '备忘';
      const preview = (n.text || '').slice(0, 50);
      const imgCount = (n.imgs || []).length;
      const dt = n.updatedAt ? new Date(n.updatedAt).toLocaleDateString('zh-CN', { month:'short', day:'numeric' }) : '';
      return `<div class="memo-item" onclick="Memo.openNote('${n.id}')">
        <div class="mt">${Util.esc(t)}</div>
        <div class="mp">${Util.esc(preview)}${preview.length < (n.text||'').length ? '…' : ''}</div>
        <div class="md">${dt}${imgCount ? ' · 📷 ' + imgCount + ' 张' : ''}</div>
      </div>`;
    }).join('');
  },

  /* ── 编辑视图 ── */
  openNote(id){
    const n = this.get(id);
    if (!n) return;
    this._curNote = id;
    document.getElementById('memoListView').style.display = 'none';
    document.getElementById('memoEditView').style.display = '';
    document.getElementById('memoTitle').value = n.title || '';
    document.getElementById('memoContent').value = n.text || '';
    document.getElementById('memoEditHint').textContent = '编辑备忘';
    document.getElementById('memoAt').textContent =
      n.updatedAt ? new Date(n.updatedAt).toLocaleString('zh-CN') : '还没有';
    this.renderImgs();
    this.bindAutosave();
    this.initDrop();
  },

  newNote(){
    const id = Util.uid();
    const now = Date.now();
    Store.upsert(this.KEY, { id, title:'', text:'', imgs:[], createdAt: now, updatedAt: now });
    this.openNote(id);
    setTimeout(() => document.getElementById('memoTitle').focus(), 60);
  },

  backToList(){
    this.flushSave();
    this.showList();
  },

  bindAutosave(){
    ['memoTitle','memoContent'].forEach(id => {
      const el = document.getElementById(id);
      el.oninput = () => {
        clearTimeout(this._autosave);
        this._autosave = setTimeout(() => this.flushSave(), 1200);
      };
    });
  },

  flushSave(){
    if (!this._curNote) return;
    const n = this.get(this._curNote);
    if (!n) return;
    const title = document.getElementById('memoTitle').value;
    const text = document.getElementById('memoContent').value;
    if (title === n.title && text === n.text) return;
    Store.upsert(this.KEY, Object.assign({}, n, { title, text, updatedAt: Date.now() }));
    const atEl = document.getElementById('memoAt');
    if (atEl) atEl.textContent = new Date().toLocaleString('zh-CN');
  },

  saveNote(){
    this.flushSave();
    UI.toast('已保存');
  },

  delNote(){
    if (!this._curNote) return;
    if (!confirm('删掉这条备忘？')) return;
    const n = this.get(this._curNote);
    if (n && n.imgs) n.imgs.forEach(imgId => IDB.del('memo_img_' + imgId));
    Store.softDelete(this.KEY, this._curNote);
    this.showList();
    UI.toast('已删除');
  },

  /* ── 图片 ── */
  renderImgs(){
    const n = this.get(this._curNote);
    const imgs = (n && n.imgs) || [];
    const box = document.getElementById('memoImgs');
    if (!imgs.length){
      box.innerHTML = '<div class="empty-i">还没有图片</div>';
      return;
    }
    box.innerHTML = imgs.map(id => `<div class="thumb" onclick="Memo.viewImg('${id}')">
      <img src="" id="mthumb_${id}" alt="">
      <button class="tdel" onclick="event.stopPropagation();Memo.delImg('${id}')">✕</button>
    </div>`).join('');
    imgs.forEach(id => this.loadThumb(id));
  },

  async loadThumb(id){
    const data = await IDB.get('memo_img_' + id);
    const el = document.getElementById('mthumb_' + id);
    if (el && data) el.src = data;
  },

  pickImg(){
    const input = document.getElementById('memoFile');
    input.onchange = () => this.onImgFiles(input.files);
    input.value = '';
    input.click();
  },

  async onImgFiles(fileList){
    const files = Array.from(fileList || []).filter(f => f.type && f.type.startsWith('image/'));
    if (!files.length) return UI.toast('只支持图片');
    const n = this.get(this._curNote);
    if (!n) return;
    const imgs = n.imgs || [];
    for (const f of files){
      const id = Util.uid();
      try {
        const dataUrl = await Util.compressImage(f, 1400, .78);
        await IDB.put('memo_img_' + id, dataUrl);
        imgs.push(id);
      } catch(e){
        UI.toast('「' + f.name + '」没存成功');
      }
    }
    Store.upsert(this.KEY, Object.assign({}, n, { imgs, updatedAt: Date.now() }));
    this.renderImgs();
    UI.toast('图片已添加');
  },

  initDrop(){
    const dz = document.getElementById('memoDrop');
    if (!dz || dz._init) return;
    dz._init = true;
    ['dragenter','dragover'].forEach(ev =>
      dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('over'); }));
    ['dragleave','drop'].forEach(ev =>
      dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('over'); }));
    dz.addEventListener('drop', e => {
      const files = e.dataTransfer && e.dataTransfer.files;
      if (files && files.length) this.onImgFiles(files);
    });
  },

  async viewImg(id){
    document.getElementById('memoImgTitle').textContent = '图片预览';
    document.getElementById('memoImgOverlay').style.display = 'flex';
    const body = document.getElementById('memoImgBody');
    body.innerHTML = '<div class="empty-i">加载中…</div>';
    const data = await IDB.get('memo_img_' + id);
    if (data) body.innerHTML = `<img src="${data}" alt="">`;
    else body.innerHTML = '<div class="file-miss">图片不存在</div>';
  },

  closeImg(){
    document.getElementById('memoImgOverlay').style.display = 'none';
    document.getElementById('memoImgBody').innerHTML = '';
  },

  delImg(id){
    const n = this.get(this._curNote);
    if (!n || !n.imgs) return;
    if (!confirm('删掉这张图片？')) return;
    const imgs = n.imgs.filter(x => x !== id);
    Store.upsert(this.KEY, Object.assign({}, n, { imgs, updatedAt: Date.now() }));
    IDB.del('memo_img_' + id);
    this.renderImgs();
    UI.toast('已删除');
  },

  /* ── 口令 ── */
  unlock(){
    const pin = document.getElementById('memoPin').value;
    if (!this.hasPin()){
      if (pin.length < 4) return UI.toast('口令至少 4 位');
      Store.setSecret('memoPin', this.hash(pin));
      this.unlocked = true;
      document.getElementById('memoPin').value = '';
      this.render();
      UI.toast('口令已设置，记牢它');
      return;
    }
    if (this.hash(pin) === Store.getSecret('memoPin')){
      this.unlocked = true;
      document.getElementById('memoPin').value = '';
      this.render();
    } else {
      UI.toast('口令不对');
    }
  },

  lock(){
    this.flushSave();
    this.unlocked = false;
    this.render();
    UI.toast('已锁上');
  },

  hash(s){
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return 'h' + (h >>> 0).toString(36);
  }
};
/* ==== 功能：私密备忘 END ==== */
