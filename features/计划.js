/* ==== 功能：日历·计划 START ====
   月历视图 + 每日事项（可带时间段）+ 每日例行（长期计划）+ 思考的事（备忘池）。
   事项存在任何一天，到期那天自动出现在"今天"；
   过了当天还没做完的，进"过期未完成"提醒区，不会无声消失。
   每日例行：设一次，从当天起自动出现在每天的清单里，勾选状态每天独立；
   可以只在周几重复、可以暂停、可以跳过某一天。
   思考的事：临时想到但不急着做的事，无日期无时间；想好了点「→待办」转成今天的待办。
   优先级：📌 置顶。事项、例行、思考都可置顶，置顶的排最前；
   例行置顶后每天生成的清单事项也置顶；完成的事项沉到最下面。
   数据：plan_events = [{id, date:'YYYY-MM-DD', time:'HH:MM'|'', text, done, top?, routineId?, _u}]
        plan_routines = [{id, text, time:'', days:[0-6], active:true, skip:['YYYY-MM-DD'], top?, _u}]
        plan_thoughts = [{id, text, ts, done?, top?, _u}] */
const Plan = {
  KEY: 'plan_events',
  RKEY: 'plan_routines',
  TKEY: 'plan_thoughts',
  view: null,        // 当前查看的日期 'YYYY-MM-DD'
  calY: 0, calM: 0,  // 月历显示的年月
  _days: [0,1,2,3,4,5,6],  // 新建例行时勾选的星期（0=周日）

  all(){
    return Store.list(this.KEY, (a, b) =>
      (a.date + (a.time || '99')) > (b.date + (b.time || '99')) ? 1 : -1);
  },
  /* 某天的清单：未完成在前 → 置顶最前 → 按时间（完成了就沉底，置顶也随之让位） */
  of(date){
    return this.all().filter(e => e.date === date).sort((a, b) => {
      const da = a.done ? 1 : 0, db = b.done ? 1 : 0;
      if (da !== db) return da - db;
      const pa = a.top ? 0 : 1, pb = b.top ? 0 : 1;
      if (pa !== pb) return pa - pb;
      return (a.time || '99') > (b.time || '99') ? 1 : -1;
    });
  },
  overdue(){
    const t = Util.today();
    return this.all().filter(e => !e.done && e.date < t);
  },
  /* 例行列表：置顶最前 → 按时间 */
  routines(){
    return Store.list(this.RKEY, (a, b) => {
      const pa = a.top ? 0 : 1, pb = b.top ? 0 : 1;
      if (pa !== pb) return pa - pb;
      return (a.time || '99') > (b.time || '99') ? 1 : -1;
    });
  },

  /* 思考的事列表：未完成在前 → 置顶最前 → 新写的在上 */
  thoughts(){
    return Store.list(this.TKEY, (a, b) => {
      const da = a.done ? 1 : 0, db = b.done ? 1 : 0;
      if (da !== db) return da - db;
      const pa = a.top ? 0 : 1, pb = b.top ? 0 : 1;
      if (pa !== pb) return pa - pb;
      return (b.ts || 0) - (a.ts || 0);
    });
  },

  render(){
    if (!this.view) this.view = Util.today();
    if (!this.calY){
      const d = new Date(this.view + 'T00:00:00');
      this.calY = d.getFullYear(); this.calM = d.getMonth();
    }
    this.materialize(this.view);
    this.renderTitle();
    this.renderCal();
    this.renderList();
    this.renderOverdue();
    this.renderThoughts();
    this.renderRoutines();
    this.renderDayChips();
    // 添加表单默认值
    document.getElementById('planDate').value = this.view;
    document.getElementById('planTime').value = '';
  },

  /* 把每日例行"落实"成某一天的具体事项（懒生成）：
     只对今天及以后生效，过去的日子不生成（避免堆积过期提醒）；
     跳过的日期、暂停的例行不生成；同一天同一条只生成一次。 */
  materialize(ds){
    if (ds < Util.today()) return;
    const exist = {};
    this.all().forEach(e => { if (e.routineId) exist[e.routineId + '|' + e.date] = 1; });
    this.routines().forEach(r => {
      if (!r.active) return;
      if ((r.days || [0,1,2,3,4,5,6]).indexOf(new Date(ds + 'T00:00:00').getDay()) < 0) return;
      if ((r.skip || []).indexOf(ds) >= 0) return;
      if (exist[r.id + '|' + ds]) return;
      Store.upsert(this.KEY, { id: Util.uid(), date: ds, time: r.time || '', text: r.text, done: false, routineId: r.id, top: !!r.top });
    });
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
      <div class="item ${e.done ? 'done' : ''} ${e.top ? 'pinned' : ''}">
        <button class="box" onclick="Plan.toggle('${e.id}')">${e.done ? '✓' : ''}</button>
        ${e.routineId ? '<span class="time-tag" style="color:var(--text2);background:rgba(140,130,120,.14)">🔁</span>' : ''}
        ${e.time ? `<span class="time-tag ${(!e.done && e.date < Util.today()) ? 'overdue' : ''}">${e.time}</span>` : ''}
        <span class="grow">${Util.esc(e.text)}</span>
        <button class="pin ${e.top ? 'on' : ''}" title="${e.top ? '取消置顶' : '置顶'}" onclick="Plan.pin('${e.id}')">📌</button>
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

  renderRoutines(){
    const box = document.getElementById('planRoutineList');
    const rs = this.routines();
    if (!rs.length){
      box.innerHTML = '<div class="empty">还没有每日例行，在下面加一条</div>';
      return;
    }
    const wd = '日一二三四五六';
    box.innerHTML = rs.map(r => {
      const days = (r.days || []).length === 7 ? '每天'
        : (r.days || []).slice().sort((a,b) => a-b).map(d => '周' + wd[d]).join('、');
      return `
      <div class="routine-item" ${r.active ? '' : 'style="opacity:.55"'}>
        <div class="head">
          <span class="grow">
            <div class="rt">${r.active ? '' : '⏸ '}${Util.esc(r.text)}</div>
            <div class="routine-days">${r.top ? '📌 · ' : ''}${r.time ? r.time + ' · ' : ''}${days}${r.active ? '' : ' · 已暂停'}</div>
          </span>
          <button class="pin ${r.top ? 'on' : ''}" title="${r.top ? '取消置顶' : '置顶（每天清单里都排最前）'}" onclick="Plan.pinRoutine('${r.id}')">📌</button>
          <button class="btn ghost" style="font-size:13px;padding:6px 12px" onclick="Plan.toggleRoutine('${r.id}')">${r.active ? '暂停' : '启用'}</button>
          <button class="del" onclick="Plan.delRoutine('${r.id}')">✕</button>
        </div>
      </div>`;
    }).join('');
  },

  renderDayChips(){
    const wd = ['日','一','二','三','四','五','六'];
    document.getElementById('routineDays').innerHTML = wd.map((w, i) =>
      `<span class="day-chip ${this._days.indexOf(i) >= 0 ? 'on' : ''}" onclick="Plan.toggleDay(${i})">${w}</span>`).join('');
  },

  renderThoughts(){
    const list = this.thoughts();
    const box = document.getElementById('planThoughtList');
    if (!list.length){
      box.innerHTML = '<div class="empty">想到什么先记下来，想好了转成待办</div>';
      return;
    }
    box.innerHTML = list.map(t => `
      <div class="item ${t.done ? 'done' : ''} ${t.top ? 'pinned' : ''}">
        <button class="box" onclick="Plan.toggleThought('${t.id}')">${t.done ? '✓' : ''}</button>
        <span class="time-tag" style="color:var(--text2);background:rgba(140,130,120,.14)">💡</span>
        <span class="grow">${Util.esc(t.text)}</span>
        <button class="btn ghost" style="font-size:12px;padding:4px 10px" onclick="Plan.promoteThought('${t.id}')" title="转为今天的待办">→待办</button>
        <button class="pin ${t.top ? 'on' : ''}" title="${t.top ? '取消置顶' : '置顶'}" onclick="Plan.pinThought('${t.id}')">📌</button>
        <button class="del" onclick="Plan.delThought('${t.id}')">✕</button>
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

  addRoutine(){
    const text = document.getElementById('routineText').value.trim();
    if (!text) return UI.toast('先写每天要做什么');
    const time = document.getElementById('routineTime').value || '';
    Store.upsert(this.RKEY, { id: Util.uid(), text, time, days: this._days.slice(), active: true });
    document.getElementById('routineText').value = '';
    document.getElementById('routineTime').value = '';
    this._days = [0,1,2,3,4,5,6];
    this.materialize(this.view);
    this.render();
    UI.toast('已加入每日例行');
  },

  toggleDay(i){
    const p = this._days.indexOf(i);
    if (p >= 0){
      if (this._days.length === 1) return UI.toast('至少要保留一天');
      this._days.splice(p, 1);
    } else {
      this._days.push(i);
    }
    this.renderDayChips();
  },

  toggleRoutine(id){
    const r = this.routines().find(x => x.id === id);
    if (!r) return;
    const active = !r.active;
    Store.upsert(this.RKEY, Object.assign({}, r, { active }));
    if (!active){
      // 暂停：清掉今天起还没做的例行事件，避免残影；已完成的保留作记录
      this.all().forEach(e => {
        if (e.routineId === id && !e.done && e.date >= Util.today()) Store.softDelete(this.KEY, e.id);
      });
    } else {
      this.materialize(this.view);
    }
    this.render();
  },

  delRoutine(id){
    if (!confirm('删除这条每日例行？以后每天都不再出现（已完成的记录会保留）')) return;
    Store.softDelete(this.RKEY, id);
    this.all().forEach(e => {
      if (e.routineId === id && !e.done && e.date >= Util.today()) Store.softDelete(this.KEY, e.id);
    });
    this.render();
  },

  /* 置顶一条事项。来自例行的事项会问：只置顶今天，还是这条例行每天都置顶 */
  pin(id){
    const e = this.all().find(x => x.id === id);
    if (!e) return;
    const top = !e.top;
    if (e.routineId){
      const everyDay = confirm('这条来自每日例行。\n\n「确定」= 这条例行以后每天都置顶\n「取消」= 只置顶今天');
      if (everyDay){
        const r = this.routines().find(x => x.id === e.routineId);
        if (r){
          Store.upsert(this.RKEY, Object.assign({}, r, { top }));
          // 今天起还没完成的例行事件同步置顶状态；已完成的保留作记录
          this.all().forEach(ev => {
            if (ev.routineId === e.routineId && !ev.done && ev.date >= Util.today())
              Store.upsert(this.KEY, Object.assign({}, ev, { top }));
          });
        }
        this.render();
        UI.toast(top ? '这条例行每天都会置顶' : '已取消置顶');
        return;
      }
    }
    Store.upsert(this.KEY, Object.assign({}, e, { top }));
    this.render();
    UI.toast(top ? '已置顶' : '已取消置顶');
  },

  /* 置顶一条例行：卡片排最前，每天生成的清单事项也置顶 */
  pinRoutine(id){
    const r = this.routines().find(x => x.id === id);
    if (!r) return;
    const top = !r.top;
    Store.upsert(this.RKEY, Object.assign({}, r, { top }));
    this.all().forEach(ev => {
      if (ev.routineId === id && !ev.done && ev.date >= Util.today())
        Store.upsert(this.KEY, Object.assign({}, ev, { top }));
    });
    this.render();
    UI.toast(top ? '这条例行已置顶' : '已取消置顶');
  },

  /* ==== 思考的事 ==== */
  addThought(){
    const text = document.getElementById('thoughtText').value.trim();
    if (!text) return UI.toast('先写想到的事');
    Store.upsert(this.TKEY, { id: Util.uid(), text, ts: Date.now(), done: false });
    document.getElementById('thoughtText').value = '';
    this.renderThoughts();
    UI.toast('记下了');
  },

  pinThought(id){
    const t = this.thoughts().find(x => x.id === id);
    if (!t) return;
    const top = !t.top;
    Store.upsert(this.TKEY, Object.assign({}, t, { top }));
    this.renderThoughts();
    UI.toast(top ? '已置顶' : '已取消置顶');
  },

  toggleThought(id){
    const t = this.thoughts().find(x => x.id === id);
    if (!t) return;
    Store.upsert(this.TKEY, Object.assign({}, t, { done: !t.done }));
    this.renderThoughts();
  },

  delThought(id){
    if (!confirm('删掉这条思考？')) return;
    Store.softDelete(this.TKEY, id);
    this.renderThoughts();
  },

  /* 把思考转为今天的待办，原思考自动删除 */
  promoteThought(id){
    const t = this.thoughts().find(x => x.id === id);
    if (!t) return;
    Store.upsert(this.KEY, { id: Util.uid(), date: Util.today(), time: '', text: t.text, done: false, top: !!t.top });
    Store.softDelete(this.TKEY, id);
    this.render();
    UI.toast('已转为今天的待办');
  },

  toggle(id){
    const e = this.all().find(x => x.id === id);
    if (!e) return;
    Store.upsert(this.KEY, Object.assign({}, e, { done: !e.done }));
    this.render();
  },

  del(id){
    const e = this.all().find(x => x.id === id);
    if (!e) return;
    if (e.routineId){
      // 例行生成的事项：只删这一天，明天照常出现；想彻底删去「每日例行」卡片删
      if (!confirm('这条来自每日例行，只删这一天，明天还会照常出现。继续？')) return;
      const r = this.routines().find(x => x.id === e.routineId);
      if (r) Store.upsert(this.RKEY, Object.assign({}, r, { skip: (r.skip || []).concat([e.date]) }));
      Store.softDelete(this.KEY, id);
    } else {
      if (!confirm('删掉这件事？')) return;
      Store.softDelete(this.KEY, id);
    }
    this.render();
  }
};
/* ==== 功能：日历·计划 END ==== */
