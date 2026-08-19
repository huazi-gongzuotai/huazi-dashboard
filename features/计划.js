/* ==== 功能：日历·计划 START ====
   月历视图 + 每日事项（可带时间段）。
   事项存在任何一天，到期那天自动出现在"今天"；
   过了当天还没做完的，进"过期未完成"提醒区，不会无声消失。
   数据：plan_events = [{id, date:'YYYY-MM-DD', time:'HH:MM'|'', text, done, _u}] */
const Plan = {
  KEY: 'plan_events',
  view: null,        // 当前查看的日期 'YYYY-MM-DD'
  calY: 0, calM: 0,  // 月历显示的年月

  all(){
    return Store.list(this.KEY, (a, b) =>
      (a.date + (a.time || '99')) > (b.date + (b.time || '99')) ? 1 : -1);
  },
  of(date){ return this.all().filter(e => e.date === date); },
  overdue(){
    const t = Util.today();
    return this.all().filter(e => !e.done && e.date < t);
  },

  render(){
    if (!this.view) this.view = Util.today();
    if (!this.calY){
      const d = new Date(this.view + 'T00:00:00');
      this.calY = d.getFullYear(); this.calM = d.getMonth();
    }
    this.renderTitle();
    this.renderCal();
    this.renderList();
    this.renderOverdue();
    // 添加表单默认值
    document.getElementById('planDate').value = this.view;
    document.getElementById('planTime').value = '';
  },

  renderTitle(){
    const t = Util.today();
    const el = document.getElementById('planTitle');
    const sub = document.getElementById('planSub');
    if (this.view === t){
      const wd = '日一二三四五六'[new Date().getDay()];
      el.textContent = '今天';
      sub.textContent = `${Number(t.slice(5,7))} 月 ${Number(t.slice(8))} 日 · 星期${wd}`;
    } else {
      el.textContent = `${Number(this.view.slice(5,7))} 月 ${Number(this.view.slice(8))} 日`;
      sub.textContent = this.view < t ? '这一天已经过去了' : '提前安排的一天';
    }
  },

  renderCal(){
    document.getElementById('calMonth').textContent =
      `${this.calY} 年 ${this.calM + 1} 月`;
    const grid = document.getElementById('calGrid');
    const t = Util.today();
    const first = new Date(this.calY, this.calM, 1);
    const lead = first.getDay();                       // 1 号前面空几格（周日=0）
    const days = new Date(this.calY, this.calM + 1, 0).getDate();
    // 预取事件：有事的日期 → 是否有过期未完成
    const ev = this.all();
    const hasEv = {}, hasOver = {};
    ev.forEach(e => {
      if (e.date.slice(0,7) === `${this.calY}-${String(this.calM+1).padStart(2,'0')}`){
        hasEv[e.date] = 1;
        if (!e.done && e.date < t) hasOver[e.date] = 1;
      }
    });
    let h = ['日','一','二','三','四','五','六'].map(w => `<span class="wd">${w}</span>`).join('');
    for (let i = 0; i < lead; i++) h += '<span class="cal-d empty"></span>';
    for (let d = 1; d <= days; d++){
      const ds = `${this.calY}-${String(this.calM+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const cls = ['cal-d'];
      if (ds === t) cls.push('today');
      if (ds === this.view) cls.push('sel');
      const dot = hasOver[ds] ? '<span class="dot overdue"></span>'
                : hasEv[ds]  ? '<span class="dot"></span>' : '';
      h += `<span class="${cls.join(' ')}" onclick="Plan.pick('${ds}')">${d}${dot}</span>`;
    }
    grid.innerHTML = h;
  },

  renderList(){
    const list = this.of(this.view);
    document.getElementById('planListTitle').textContent =
      this.view === Util.today() ? '今天的事' : '这天的事';
    const box = document.getElementById('planList');
    if (!list.length){
      box.innerHTML = '<div class="empty">这一天还没有安排，在下面加一件</div>';
      return;
    }
    box.innerHTML = list.map(e => `
      <div class="item ${e.done ? 'done' : ''}">
        <button class="box" onclick="Plan.toggle('${e.id}')">${e.done ? '✓' : ''}</button>
        ${e.time ? `<span class="time-tag ${(!e.done && e.date < Util.today()) ? 'overdue' : ''}">${e.time}</span>` : ''}
        <span class="grow">${Util.esc(e.text)}</span>
        <button class="del" onclick="Plan.del('${e.id}')">✕</button>
      </div>`).join('');
  },

  renderOverdue(){
    const od = this.overdue();
    const card = document.getElementById('planOverdueCard');
    card.style.display = od.length ? '' : 'none';
    if (!od.length) return;
    document.getElementById('planOverdue').innerHTML = od.map(e => `
      <div class="item">
        <button class="box" onclick="Plan.toggle('${e.id}')"></button>
        <span class="time-tag overdue">${e.date.slice(5)}</span>
        <span class="grow">${Util.esc(e.text)}</span>
        <button class="del" onclick="Plan.del('${e.id}')">✕</button>
      </div>`).join('');
  },

  pick(ds){
    this.view = ds;
    const d = new Date(ds + 'T00:00:00');
    this.calY = d.getFullYear(); this.calM = d.getMonth();
    this.render();
  },
  prevMonth(){ this.calM--; if (this.calM < 0){ this.calM = 11; this.calY--; } this.renderCal(); },
  nextMonth(){ this.calM++; if (this.calM > 11){ this.calM = 0; this.calY++; } this.renderCal(); },

  add(){
    const text = document.getElementById('planText').value.trim();
    if (!text) return UI.toast('先写要做什么');
    const date = document.getElementById('planDate').value || Util.today();
    const time = document.getElementById('planTime').value || '';
    Store.upsert(this.KEY, { id: Util.uid(), date, time, text, done: false });
    document.getElementById('planText').value = '';
    this.view = date;
    const d = new Date(date + 'T00:00:00');
    this.calY = d.getFullYear(); this.calM = d.getMonth();
    this.render();
  },

  toggle(id){
    const e = this.all().find(x => x.id === id);
    if (!e) return;
    Store.upsert(this.KEY, Object.assign({}, e, { done: !e.done }));
    this.render();
  },

  del(id){
    if (!confirm('删掉这件事？')) return;
    Store.softDelete(this.KEY, id);
    this.render();
  }
};
/* ==== 功能：日历·计划 END ==== */
