/* ==== 功能：日志·复盘 START ====
   三部分：
   1. 月历视图 —— 点任意日期查看/编辑当天日志，有日志的日期高亮标记
   2. 日志编辑 —— 选中日期的日志，保存覆盖
   3. 周复盘 —— 自动汇总 + 图卡 + AI 总结（可存入资料库）
   数据：diary = [{id, date, text, _u}] */
const Diary = {
  KEY: 'diary',
  _selDate: null,       // 当前选中日期
  _year: 0,             // 日历显示的年
  _month: 0,            // 日历显示的月（0-11）
  _aiResult: '',        // AI 总结结果

  all(){
    return Store.list(this.KEY, (a, b) => a.date < b.date ? 1 : -1);
  },

  get(date){ return this.all().find(d => d.date === date); },

  render(){
    const today = Util.today();
    if (!this._selDate) this._selDate = today;
    if (!this._year){
      const now = new Date();
      this._year = now.getFullYear();
      this._month = now.getMonth();
    }
    this.renderCal();
    this.renderDay();
    Recap.render();
  },

  /* ── 月历 ── */
  renderCal(){
    const y = this._year, m = this._month;
    document.getElementById('diaryMonth').textContent = y + ' 年 ' + (m + 1) + ' 月';

    const first = new Date(y, m, 1).getDay();         // 1 号是星期几（0=日）
    const startOffset = (first + 6) % 7;               // 转为周一为首
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const today = Util.today();
    const entries = new Set(this.all().map(d => d.date));

    const wds = ['一','二','三','四','五','六','日'];
    let html = wds.map(w => `<div class="wd">${w}</div>`).join('');
    for (let i = 0; i < startOffset; i++) html += '<div class="cal-d empty"></div>';
    for (let d = 1; d <= daysInMonth; d++){
      const ds = String(y) + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      const cls = ['cal-d'];
      if (ds === today) cls.push('today');
      if (ds === this._selDate) cls.push('sel');
      if (entries.has(ds)) cls.push('has-diary');
      html += `<div class="${cls.join(' ')}" onclick="Diary.pickDay('${ds}')">${d}</div>`;
    }
    document.getElementById('diaryCal').innerHTML = html;
  },

  prevMonth(){
    this._month--;
    if (this._month < 0){ this._month = 11; this._year--; }
    this.renderCal();
  },

  nextMonth(){
    this._month++;
    if (this._month > 11){ this._month = 0; this._year++; }
    this.renderCal();
  },

  pickDay(ds){
    this._selDate = ds;
    this.renderCal();
    this.renderDay();
  },

  renderDay(){
    const ds = this._selDate;
    const entry = this.get(ds);
    document.getElementById('diaryDateLbl').textContent =
      '🧾 ' + ds + (ds === Util.today() ? '（今天）' : '');
    document.getElementById('diaryText').value = entry ? entry.text : '';
    document.getElementById('diaryDelBtn').style.display = entry ? '' : 'none';
  },

  save(){
    const text = document.getElementById('diaryText').value.trim();
    if (!text) return UI.toast('写点什么再保存');
    const ds = this._selDate;
    const existing = this.get(ds);
    if (existing) Store.upsert(this.KEY, { id: existing.id, date: ds, text });
    else Store.upsert(this.KEY, { id: Util.uid(), date: ds, text });
    this.renderCal();
    document.getElementById('diaryDelBtn').style.display = '';
    UI.toast('已保存');
  },

  delDay(){
    const ds = this._selDate;
    const entry = this.get(ds);
    if (!entry) return;
    if (!confirm('删掉 ' + ds + ' 的日志？')) return;
    Store.softDelete(this.KEY, entry.id);
    this.renderCal();
    this.renderDay();
    UI.toast('已删除');
  },

  /* ── AI 总结本周 ── */
  async aiSummary(){
    const key = Store.getSecret('deepseek');
    if (!key) return UI.toast('先在设置里配好 DeepSeek key');

    const days = Recap.weekDays();
    const entries = days.map(d => ({ date: d, text: (this.get(d) || {}).text || '' }))
                         .filter(e => e.text);
    if (!entries.length) return UI.toast('这周还没写日志');

    const card = document.getElementById('diaryAiCard');
    const result = document.getElementById('diaryAiResult');
    card.style.display = '';
    result.textContent = '正在总结……';

    const diaryText = entries.map(e => `${e.date}：\n${e.text}`).join('\n\n');
    const pref = Store.get('ai_pref', '');
    let sys = '你是华子的工作助手。请根据本周的日志写一份简洁的周总结：这周做了什么、有什么收获或不足、下周可以注意什么。用中文，分点列出，实用。';
    if (pref) sys += `\n\n华子的偏好：\n${pref}`;

    try {
      const r = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 'content-type':'application/json', 'Authorization':'Bearer ' + key },
        body: JSON.stringify({
          model: 'deepseek-chat', stream: false,
          messages: [
            { role:'system', content: sys },
            { role:'user', content: '这是我这周的日志：\n\n' + diaryText }
          ]
        })
      });
      if (r.status === 401) throw new Error('key 不对');
      if (r.status === 402) throw new Error('余额不足');
      if (!r.ok) throw new Error('接口暂时用不了（' + r.status + '）');
      const j = await r.json();
      const text = j.choices?.[0]?.message?.content || '空';
      this._aiResult = text;
      result.textContent = text;
      UI.toast('总结完成，可存到资料库');
    } catch(e){
      result.textContent = '总结失败：' + (e.message.includes('Failed to fetch') ? '网络连不上' : e.message);
    }
  },

  saveSummaryToRefs(){
    if (!this._aiResult) return UI.toast('还没有总结内容');
    const title = '周总结 ' + Util.today();
    Store.upsert('refs', { type:'note', title, content: this._aiResult, parent: '' });
    UI.toast('已存入资料库根目录');
  }
};

/* ---- 周复盘（汇总计划完成数 + 日志天数） ---- */
const Recap = {
  weekDays(){
    const days = [], today = new Date();
    const dow = (today.getDay() + 6) % 7;
    for (let i = 0; i < 7; i++){
      const d = new Date(today); d.setDate(today.getDate() - dow + i);
      days.push(Util.dateOf(d));
    }
    return days;
  },

  collect(){
    const days = this.weekDays();
    const events = (typeof Plan !== 'undefined' ? Plan.all() : []);
    const diaries = (typeof Diary !== 'undefined' ? Diary.all() : []);
    const perDay = days.map(d => ({
      done: events.filter(e => e.date === d && e.done).length,
      wrote: diaries.some(x => x.date === d)
    }));
    const done = perDay.reduce((s, p) => s + p.done, 0);
    const wrote = perDay.filter(p => p.wrote).length;
    let streak = 0;
    const has = d => events.some(e => e.date === d) || diaries.some(x => x.date === d);
    for (let i = 0; ; i++){
      const d = new Date(); d.setDate(d.getDate() - i);
      if (has(Util.dateOf(d))) streak++;
      else if (i === 0) continue;
      else break;
    }
    return { days, perDay, done, wrote, streak, from: days[0], to: days[6] };
  },

  render(){
    const r = this.collect();
    const el = document.getElementById('recapBody');
    if (!el) return;
    el.innerHTML = `
      <div class="hero num">${r.done}<span class="unit">件事做完了</span></div>
      <p class="hint">${r.from} 到 ${r.to} · 写了 ${r.wrote} 天日志 · 连续记录 ${r.streak} 天</p>`;
  },

  async makeCard(){
    const r = this.collect();
    const cs = getComputedStyle(document.documentElement);
    const v = n => cs.getPropertyValue(n).trim();
    const W = 1080, H = 1350, cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    const font = (sz, w) => `${w||400} ${sz}px -apple-system,"PingFang SC",system-ui,sans-serif`;

    g.fillStyle = v('--bg') || '#f1ebe3'; g.fillRect(0,0,W,H);
    g.fillStyle = v('--card') || '#fffdf9';
    const pad = 72, cw = W - pad*2;
    if (g.roundRect){ g.beginPath(); g.roundRect(pad, 180, cw, 900, 40); g.fill(); }
    else g.fillRect(pad, 180, cw, 900);

    g.fillStyle = v('--accent') || '#a9714b';
    g.font = font(30, 500);
    g.fillText('这一周', pad + 56, 300);

    g.fillStyle = v('--text') || '#3d352c';
    g.font = font(190, 500);
    g.fillText(String(r.done), pad + 56, 480);
    g.font = font(38);
    g.fillStyle = v('--text-dim') || '#9c8f80';
    g.fillText('件事做完了', pad + 56 + g.measureText(String(r.done)).width + 210, 480);

    g.font = font(34);
    g.fillText(`${r.from}  —  ${r.to}`, pad + 56, 560);

    const bw = 96, gap = 24, y = 660;
    for (let i = 0; i < 7; i++){
      const n = r.perDay[i].done;
      g.fillStyle = n ? (v('--accent') || '#a9714b') : (v('--line') || '#e4dacc');
      g.globalAlpha = n ? Math.min(1, 0.35 + n * 0.18) : 1;
      const x = pad + 56 + i * (bw + gap);
      if (g.roundRect){ g.beginPath(); g.roundRect(x, y, bw, bw, 26); g.fill(); }
      else g.fillRect(x, y, bw, bw);
      g.globalAlpha = 1;
      g.fillStyle = v('--text-dim') || '#9c8f80';
      g.font = font(28);
      g.fillText('一二三四五六日'[i], x + bw/2 - 14, y + bw + 48);
    }

    g.fillStyle = v('--text') || '#3d352c';
    g.font = font(46, 500);
    g.fillText(`写了 ${r.wrote} 天日志 · 连续记录 ${r.streak} 天`, pad + 56, 900);

    g.fillStyle = v('--text-dim') || '#9c8f80';
    g.font = font(26);
    g.fillText('华子的工作台', pad + 56, 1010);
    g.font = font(22);
    g.fillText('由 不一书个人工作台生成器 生成', pad + 56, 1046);

    cv.toBlob(b => {
      const url = URL.createObjectURL(b);
      const a = document.createElement('a');
      a.href = url; a.download = `这一周-${r.to}.png`;
      a.click();
      setTimeout(() => { URL.revokeObjectURL(url); UI.toast('图卡已保存'); }, 800);
    }, 'image/png');
  }
};
/* ==== 功能：日志·复盘 END ==== */
