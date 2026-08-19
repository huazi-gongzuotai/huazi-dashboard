/**
 * 业绩看板 — 每日数据（皮肤/外科拆分）+ 月历回看 + 链接聚合
 * 数据模型：
 *   perf_data  — 数组型 {id, date,
 *                 skin:{consult,visit,deal,amount}, surg:{...},
 *                 consult,visit,deal,amount(合计), _u}
 *                 合计 = 皮肤 + 外科，保存时自动算。
 *                 旧记录只有合计字段（无 skin/surg），重新保存后自动补上拆分。
 *   perf_links — 数组型 {id, name, url, cat, _u}     → upsert/softDelete/list 同步
 *   perf_target — 单值 {month, amount}               → get/set 同步
 *   perf_draft_YYYY-MM-DD — 草稿（纯 localStorage，不同步）
 */
const Perf = {
  DKEY:  'perf_data',
  LKEY:  'perf_links',
  TKEY:  'perf_target',
  _draftTimer: null,
  _curLink: null,
  _curDate: null,          // 当前录入/查看的日期（默认今天）
  _year: 0, _month: 1,     // 月历显示的年月（1-12）

  CATS: ['skin', 'surg'],
  CAT_NAME: { skin: '皮肤', surg: '外科' },
  CAT_ICO:  { skin: '🧴', surg: '🔪' },
  FIELDS: ['consult', 'visit', 'deal', 'amount'],
  FNAME:  { consult: '咨询', visit: '上门', deal: '成交', amount: '金额' },
  _ids: {
    skin: { consult: 'perfSkinConsult', visit: 'perfSkinVisit', deal: 'perfSkinDeal', amount: 'perfSkinAmount' },
    surg: { consult: 'perfSurgConsult', visit: 'perfSurgVisit', deal: 'perfSurgDeal', amount: 'perfSurgAmount' }
  },
  _foots: { skin: 'perfSkinFoot', surg: 'perfSurgFoot' },

  el(cat, field){ return document.getElementById(this._ids[cat][field]); },

  /** 主渲染 */
  render(){
    const today = Util.today();
    this._curDate = today;
    const dt = new Date();
    this._year = dt.getFullYear();
    this._month = dt.getMonth() + 1;
    this.renderDateLbl();
    this.loadInputs(today);
    this.renderCal();
    this.renderDayDetail();
    this.renderMonth();
    this.renderTrend();
    this.renderHistory();
    this.renderLinks();
  },

  /* ── 顶部：日期 + 录入 ── */

  renderDateLbl(){
    const el = document.getElementById('perfDate');
    if (el) el.textContent = Util.fmtDate(this._curDate) + (this._curDate === Util.today() ? '（今天）' : '');
    const back = document.getElementById('perfBackToday');
    if (back) back.style.display = (this._curDate === Util.today()) ? 'none' : 'inline-block';
  },

  /** 加载某天的数据到输入框（优先正式记录，其次草稿） */
  loadInputs(date){
    const rec = this.getRecord(date);
    const draft = this.getDraft(date);
    for (const cat of this.CATS){
      for (const f of this.FIELDS){
        const el = this.el(cat, f);
        if (!el) continue;
        let v = '';
        if (rec && rec[cat]) v = rec[cat][f] ?? '';
        else if (draft && draft[cat]) v = draft[cat][f] ?? '';
        el.value = v;
      }
    }
    // 旧格式记录：只有合计、没有拆分，提示重新填
    const isLegacy = rec && !rec.skin && !rec.surg &&
      ((rec.consult || 0) + (rec.visit || 0) + (rec.deal || 0) + (rec.amount || 0)) > 0;
    const hint = document.getElementById('perfLegacyHint');
    if (hint) hint.style.display = isLegacy ? 'block' : 'none';
    this.renderTotals();
  },

  getRecord(date){
    return Store.list(this.DKEY).find(x => x.date === date && !x._d);
  },

  getDraft(date){
    try { return JSON.parse(localStorage.getItem('perf_draft_' + date) || 'null'); }
    catch { return null; }
  },

  /** 输入时自动存草稿（防抖 800ms） */
  saveDraft(){
    clearTimeout(this._draftTimer);
    this._draftTimer = setTimeout(() => {
      const date = this._curDate || Util.today();
      const draft = {};
      for (const cat of this.CATS){
        draft[cat] = {};
        for (const f of this.FIELDS) draft[cat][f] = +this.el(cat, f).value || 0;
      }
      try { localStorage.setItem('perf_draft_' + date, JSON.stringify(draft)); } catch {}
      this.renderTotals();
    }, 800);
  },

  /** 实时合计 + 各科合计 + 转化率 */
  renderTotals(){
    const T = { consult: 0, visit: 0, deal: 0, amount: 0 };
    const S = {};
    for (const cat of this.CATS){
      const s = { consult: 0, visit: 0, deal: 0, amount: 0 };
      for (const f of this.FIELDS) s[f] = +this.el(cat, f).value || 0;
      S[cat] = s;
      for (const f of this.FIELDS) T[f] += s[f];
    }
    const totalEl = document.getElementById('perfTotal');
    if (totalEl) totalEl.innerHTML =
      '合计 咨询 <b>' + T.consult + '</b> · 上门 <b>' + T.visit + '</b> · 成交 <b>' + T.deal + '</b> 单 · 金额 <b>¥' + Util.fmtNum(T.amount) + '</b>';
    const rateEl = document.getElementById('perfRate');
    if (rateEl) rateEl.textContent = T.consult > 0 ? '转化率 ' + (T.deal / T.consult * 100).toFixed(1) + '%' : '转化率 —';
    for (const cat of this.CATS){
      const foot = document.getElementById(this._foots[cat]);
      if (!foot) continue;
      const s = S[cat];
      const rate = s.consult > 0 ? (s.deal / s.consult * 100).toFixed(1) + '%' : '—';
      foot.innerHTML = '成交 <b>' + s.deal + '</b> 单 · 金额 <b>¥' + Util.fmtNum(s.amount) + '</b> · 转化 ' + rate;
    }
  },

  /** 正式保存当前所选日期的数据 */
  saveToday(){
    const date = this._curDate || Util.today();
    const skin = {}, surg = {};
    for (const f of this.FIELDS){
      skin[f] = +this.el('skin', f).value || 0;
      surg[f] = +this.el('surg', f).value || 0;
    }
    const existing = this.getRecord(date);
    Store.upsert(this.DKEY, {
      id: existing ? existing.id : ('perf_' + date),
      date,
      skin, surg,
      consult: skin.consult + surg.consult,
      visit:   skin.visit   + surg.visit,
      deal:    skin.deal    + surg.deal,
      amount:  skin.amount  + surg.amount
    });
    try { localStorage.removeItem('perf_draft_' + date); } catch {}
    UI.toast(date === Util.today() ? '今日数据已保存' : date.slice(5) + ' 数据已保存');
    this.loadInputs(date);   // 刷新旧格式提示、回填刚存的值
    this.renderMonth();
    this.renderTrend();
    this.renderHistory();
    this.renderCal();
    this.renderDayDetail();
  },

  /** 删除某天记录 */
  delRecord(date){
    if (!confirm('删除 ' + date + ' 的记录？')) return;
    const rec = this.getRecord(date);
    if (rec) Store.softDelete(this.DKEY, rec.id);
    UI.toast('已删除');
    this.renderMonth();
    this.renderTrend();
    this.renderHistory();
    this.renderCal();
    this.renderDayDetail();
    if (date === this._curDate) this.loadInputs(date);
  },

  backToday(){
    this._curDate = Util.today();
    this.renderDateLbl();
    this.loadInputs(this._curDate);
    const dt = new Date();
    this._year = dt.getFullYear();
    this._month = dt.getMonth() + 1;
    this.renderCal();
    this.renderDayDetail();
  },

  /* ── 业绩月历 ── */

  renderCal(){
    const head = document.getElementById('perfCalMonth');
    if (head) head.textContent = this._year + ' 年 ' + this._month + ' 月';
    const grid = document.getElementById('perfCal');
    if (!grid) return;
    const first = new Date(this._year, this._month - 1, 1);
    const lead = first.getDay();                                  // 1 号前空几格（周日=0）
    const days = new Date(this._year, this._month, 0).getDate();
    const ym = this._year + '-' + String(this._month).padStart(2, '0');
    const has = new Set(Store.list(this.DKEY).filter(x => x.date && x.date.startsWith(ym)).map(x => x.date));
    const today = Util.today();
    let h = ['日','一','二','三','四','五','六'].map(w => '<div class="wd">' + w + '</div>').join('');
    for (let i = 0; i < lead; i++) h += '<div class="cal-d empty"></div>';
    for (let d = 1; d <= days; d++){
      const ds = ym + '-' + String(d).padStart(2, '0');
      const cls = ['cal-d'];
      if (has.has(ds)) cls.push('has-perf');
      if (ds === today) cls.push('today');
      if (ds === this._curDate) cls.push('sel');
      h += '<div class="' + cls.join(' ') + '" onclick="Perf.pickDay(\'' + ds + '\')">' + d + '</div>';
    }
    grid.innerHTML = h;
  },

  prevMonth(){
    this._month--;
    if (this._month < 1){ this._month = 12; this._year--; }
    this.renderCal();
  },
  nextMonth(){
    this._month++;
    if (this._month > 12){ this._month = 1; this._year++; }
    this.renderCal();
  },

  /** 点某天：把该天载入录入区，同时给出当天小结 */
  pickDay(ds){
    this._curDate = ds;
    const dt = new Date(ds + 'T00:00:00');
    this._year = dt.getFullYear();
    this._month = dt.getMonth() + 1;
    this.renderCal();
    this.renderDateLbl();
    this.loadInputs(ds);
    this.renderDayDetail();
  },

  renderDayDetail(){
    const box = document.getElementById('perfDayDetail');
    if (!box) return;
    const date = this._curDate || Util.today();
    const rec = this.getRecord(date);
    if (!rec){
      box.innerHTML = '<div class="perf-day-empty">' +
        (date === Util.today() ? '今天还没有记录，填上面的数据点「保存」' : '这一天还没有记录，点它后可以直接在上方录入') +
        '</div>';
      return;
    }
    const amt = n => this.amt(n);
    const rate = r => r.consult > 0 ? (r.deal / r.consult * 100).toFixed(1) + '%' : '—';
    let split = '';
    if (rec.skin || rec.surg){
      split = '<div class="perf-day-split">' + this.CATS.map(cat => {
        const s = rec[cat] || { consult: 0, visit: 0, deal: 0, amount: 0 };
        return '<div class="perf-day-cat">' +
          '<b>' + this.CAT_ICO[cat] + ' ' + this.CAT_NAME[cat] + '</b>' +
          '<span>咨询 ' + s.consult + ' · 上门 ' + s.visit + ' · 成交 ' + s.deal + ' 单</span>' +
          '<span>金额 ' + amt(s.amount) + ' · 转化 ' + rate(s) + '</span>' +
          '</div>';
      }).join('') + '</div>';
    } else {
      split = '<div class="perf-day-cat"><span class="hint" style="margin:0">旧格式记录，重新保存后可看皮肤/外科拆分</span></div>';
    }
    box.innerHTML =
      '<div class="perf-day">' +
        '<div class="row" style="align-items:center">' +
          '<b style="font-size:15px">' + (date === Util.today() ? '今天' : date.slice(5)) + ' · 成交 ' + (rec.deal || 0) + ' 单</b>' +
          '<span style="margin-left:auto;font-size:15px;font-weight:600">' + amt(rec.amount || 0) + '</span>' +
          '<button class="del" onclick="Perf.delRecord(\'' + date + '\')" style="font-size:14px;padding:2px 8px">删</button>' +
        '</div>' +
        '<div class="row" style="font-size:13px;color:var(--text2)">' +
          '<span>咨询 ' + (rec.consult || 0) + ' · 上门 ' + (rec.visit || 0) + '</span>' +
          '<span style="margin-left:auto">转化率 ' + rate(rec) + '</span>' +
        '</div>' +
        split +
      '</div>';
  },

  amt(n){
    return n >= 10000 ? '¥' + (n / 10000).toFixed(1) + '万' : '¥' + Util.fmtNum(n || 0);
  },

  /* ── 月度概况 ── */

  getMonthData(){
    const ym = Util.today().slice(0, 7); // 2026-08
    return Store.list(this.DKEY).filter(x => x.date && x.date.startsWith(ym));
  },

  renderMonth(){
    const data = this.getMonthData();
    const totalAmount = data.reduce((s, x) => s + (x.amount || 0), 0);
    const totalDeal   = data.reduce((s, x) => s + (x.deal || 0), 0);
    const totalConsult= data.reduce((s, x) => s + (x.consult || 0), 0);
    const totalVisit  = data.reduce((s, x) => s + (x.visit || 0), 0);

    document.getElementById('perfMonthAmount').innerHTML =
      '¥' + (totalAmount >= 10000 ? (totalAmount / 10000).toFixed(1) + '万' : totalAmount)
      + '<span class="unit">本月成交</span>';

    // 目标进度
    const target = Store.get(this.TKEY, null);
    const box = document.getElementById('perfTarget');
    if (target && target.month === Util.today().slice(0, 7) && target.amount > 0){
      const pct = Math.min(100, totalAmount / target.amount * 100);
      const over = totalAmount >= target.amount;
      box.innerHTML = `
        <div class="target-bar">
          <div class="row" style="font-size:13px;color:var(--text2)">
            <span>月度目标 ¥${Util.fmtNum(target.amount)}</span>
            <span style="margin-left:auto">${pct.toFixed(0)}%</span>
          </div>
          <div class="track ${over ? 'over' : ''}">
            <div class="fill" style="width:${pct}%"></div>
          </div>
          ${over ? '<p class="hint" style="margin:6px 0 0;color:#5a9e6f">🎉 已达标！</p>' : ''}
        </div>`;
    } else {
      box.innerHTML = '<p class="hint" style="margin:0">未设月度目标，点上方按钮设置</p>';
    }

    // 汇总数字
    box.insertAdjacentHTML('beforeend', `
      <div class="row" style="margin-top:10px;font-size:13px;color:var(--text2);flex-wrap:wrap;gap:16px">
        <span>咨询 <b style="color:var(--text)">${totalConsult}</b></span>
        <span>上门 <b style="color:var(--text)">${totalVisit}</b></span>
        <span>成交 <b style="color:var(--text)">${totalDeal}</b> 单</span>
        <span>转化率 <b style="color:var(--text)">${totalConsult > 0 ? (totalDeal / totalConsult * 100).toFixed(1) : '0'}%</b></span>
      </div>`);

    // 皮肤 / 外科本月拆分（全是旧记录时隐藏这一行）
    if (data.some(x => x.skin || x.surg)){
      const skinAmt = data.reduce((s, x) => s + ((x.skin && x.skin.amount) || 0), 0);
      const surgAmt = data.reduce((s, x) => s + ((x.surg && x.surg.amount) || 0), 0);
      box.insertAdjacentHTML('beforeend', `
        <div class="row" style="margin-top:6px;font-size:13px;color:var(--text2);flex-wrap:wrap;gap:16px">
          <span>🧴 皮肤成交 <b style="color:var(--text)">${this.amt(skinAmt)}</b></span>
          <span>🔪 外科成交 <b style="color:var(--text)">${this.amt(surgAmt)}</b></span>
        </div>`);
    }
  },

  setTarget(){
    const cur = Store.get(this.TKEY, null);
    const ym = Util.today().slice(0, 7);
    const def = (cur && cur.month === ym) ? cur.amount : '';
    const val = prompt('本月成交金额目标（元）', def);
    if (val === null) return;
    const amt = +val;
    if (!amt || amt <= 0){ UI.toast('请输入有效金额'); return; }
    Store.set(this.TKEY, { month: ym, amount: amt });
    UI.toast('目标已设置');
    this.renderMonth();
  },

  /* ── 趋势图 ── */

  renderTrend(){
    const days = this.lastN(14);
    const records = days.map(d => this.getRecord(d));

    // 金额趋势
    const amounts = records.map(r => r ? (r.amount || 0) : 0);
    const maxAmt = Math.max(...amounts, 1);
    const trendEl = document.getElementById('perfTrend');
    trendEl.innerHTML = days.map((d, i) => {
      const amt = amounts[i];
      const h = amt / maxAmt * 90;
      const dd = d.slice(5); // MM-DD
      const today = Util.today();
      const isToday = d === today;
      return `<div class="trend-bar">
        ${amt > 0 ? `<span class="val">${amt >= 10000 ? (amt/10000).toFixed(1)+'万' : amt}</span>` : ''}
        <div class="bar c" style="height:${h}px;${isToday ? 'box-shadow:0 0 0 2px var(--accent)' : ''}"></div>
        <span class="lbl">${dd}</span>
      </div>`;
    }).join('');

    // 咨询/上门/成交趋势
    const consults = records.map(r => r ? (r.consult || 0) : 0);
    const visits   = records.map(r => r ? (r.visit || 0) : 0);
    const deals    = records.map(r => r ? (r.deal || 0) : 0);
    const maxCount = Math.max(...consults, ...visits, ...deals, 1);
    const countEl = document.getElementById('perfTrendCount');
    countEl.innerHTML = days.map((d, i) => {
      const c = consults[i], v = visits[i], dl = deals[i];
      const hc = c / maxCount * 28;
      const hv = v / maxCount * 28;
      const hd = dl / maxCount * 28;
      const dd = d.slice(5);
      const isToday = d === Util.today();
      const has = c + v + dl > 0;
      return `<div class="trend-bar" style="gap:1px">
        ${has ? `<span class="val">${c}/${v}/${dl}</span>` : ''}
        <div style="display:flex;gap:1px;width:100%;max-width:22px;justify-content:center">
          <div class="bar c" style="height:${hc}px;width:5px"></div>
          <div class="bar v" style="height:${hv}px;width:5px"></div>
          <div class="bar d" style="height:${hd}px;width:5px"></div>
        </div>
        <span class="lbl">${dd}</span>
      </div>`;
    }).join('');
  },

  /** 最近 N 天日期数组（含今天，倒序） */
  lastN(n){
    const today = new Date();
    const arr = [];
    for (let i = n - 1; i >= 0; i--){
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      arr.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'));
    }
    return arr;
  },

  /* ── 历史记录列表 ── */

  renderHistory(){
    const data = Store.list(this.DKEY)
      .filter(x => x.date)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 14);
    const box = document.getElementById('perfHistory');
    if (!data.length){
      box.innerHTML = '<p class="hint">还没有记录，保存今日数据后这里会显示</p>';
      return;
    }
    box.innerHTML = data.map(r => {
      const rate = r.consult > 0 ? (r.deal / r.consult * 100).toFixed(1) + '%' : '—';
      const amt = r.amount >= 10000 ? '¥' + (r.amount / 10000).toFixed(1) + '万' : '¥' + (r.amount || 0);
      const split = (r.skin || r.surg)
        ? '<div class="perf-hist-split">🧴 皮肤 ¥' + Util.fmtNum((r.skin && r.skin.amount) || 0) +
          ' · 🔪 外科 ¥' + Util.fmtNum((r.surg && r.surg.amount) || 0) + '</div>'
        : '';
      return `<div class="perf-hist-row">
        <span class="d">${r.date.slice(5)}</span>
        <div class="nums">
          <span>咨询 <b>${r.consult || 0}</b></span>
          <span>上门 <b>${r.visit || 0}</b></span>
          <span>成交 <b>${r.deal || 0}</b></span>
          <span>金额 <b>${amt}</b></span>
          <span>转化 <b>${rate}</b></span>
        </div>
        ${split}
        <button class="del" onclick="Perf.delRecord('${r.date}')">删</button>
      </div>`;
    }).join('');
  },

  /* ── 链接聚合 ── */

  addLink(){
    const name = prompt('链接名称（如：8月咨询统计表）');
    if (!name || !name.trim()) return;
    const url = prompt('链接地址（含 https://）');
    if (!url || !url.trim()){ UI.toast('链接不能为空'); return; }
    const cat = prompt('分类（如：CRM / 统计表 / 医生数据），可留空', '') || '默认';
    Store.upsert(this.LKEY, { name: name.trim(), url: url.trim(), cat: cat.trim() || '默认' });
    UI.toast('链接已添加');
    this.renderLinks();
  },

  renderLinks(){
    const links = Store.list(this.LKEY).sort((a, b) => (a.cat || '').localeCompare(b.cat || ''));
    const box = document.getElementById('perfLinks');
    if (!links.length){
      box.innerHTML = '<p class="hint">还没有链接，点「+ 添加」把 CRM、统计表等都加进来</p>';
      return;
    }
    // 按分类分组
    const groups = {};
    links.forEach(l => {
      const c = l.cat || '默认';
      if (!groups[c]) groups[c] = [];
      groups[c].push(l);
    });
    box.innerHTML = Object.entries(groups).map(([cat, items]) => `
      <div class="link-group">
        <div class="link-group-title">${Util.esc(cat)}</div>
        ${items.map(l => `
          <div class="link-card" onclick="Perf.openLink('${l.id}')">
            <span class="ico">${this.linkIco(l.url)}</span>
            <div class="info">
              <div class="n">${Util.esc(l.name)}</div>
              <div class="u">${Util.esc(l.url)}</div>
            </div>
            <div class="act">
              <button onclick="event.stopPropagation();Perf.renameLink('${l.id}')">✏</button>
              <button onclick="event.stopPropagation();Perf.delLink('${l.id}')">✕</button>
            </div>
          </div>`).join('')}
      </div>`).join('');
  },

  linkIco(url){
    if (/crm|CRM|系统|管理/.test(url)) return '🖥️';
    if (/docs\.qq|腾讯文档|kdocs|金山/.test(url)) return '📄';
    if (/feishu|飞书|lark/.test(url)) return '📊';
    if (/sheets|excel|表格/.test(url)) return '📈';
    if (/claude|chatgpt|deepseek|ai\./.test(url)) return '🤖';
    return '🔗';
  },

  openLink(id){
    const l = Store.list(this.LKEY).find(x => x.id === id);
    if (!l) return;
    this._curLink = l;
    document.getElementById('perfLinkTitle').textContent = l.name;
    const frame = document.getElementById('perfLinkFrame');
    frame.src = l.url;
    document.getElementById('perfLinkOverlay').style.display = 'flex';
  },

  openTab(){
    if (this._curLink) window.open(this._curLink.url, '_blank');
  },

  closeLink(){
    document.getElementById('perfLinkOverlay').style.display = 'none';
    document.getElementById('perfLinkFrame').src = '';
    this._curLink = null;
  },

  renameLink(id){
    const l = Store.list(this.LKEY).find(x => x.id === id);
    if (!l) return;
    const name = prompt('新名称', l.name);
    if (!name || !name.trim()) return;
    Store.upsert(this.LKEY, { ...l, name: name.trim() });
    UI.toast('已改名');
    this.renderLinks();
  },

  delLink(id){
    const l = Store.list(this.LKEY).find(x => x.id === id);
    if (!l) return;
    if (!confirm('删除链接「' + l.name + '」？')) return;
    Store.softDelete(this.LKEY, id);
    UI.toast('已删除');
    this.renderLinks();
  }
};
