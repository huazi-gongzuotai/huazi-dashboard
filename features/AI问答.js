/* ==== 功能：AI问答 START ====
   DeepSeek OpenAI 兼容接口，浏览器直连（已实测 CORS 通过）。
   每次提问自动带上：设置页的偏好设定 + 资料库内容（截断到约 6000 字）。
   私密备忘的任何内容都不会发给 AI。
   key 走 Store.getSecret('deepseek')，不进备份不同步。 */
const Ai = {
  API: 'https://api.deepseek.com/chat/completions',
  MODEL: 'deepseek-chat',
  history: [],        // [{role, content}]，仅本次会话内存里
  _busy: false,

  render(){
    if (!this.history.length){
      const key = Store.getSecret('deepseek');
      document.getElementById('aiChat').innerHTML = key
        ? '<div class="msg ai">问吧。我会参考你资料库里的内容和你在设置里写的偏好来回答。</div>'
        : `<div class="empty">还没配置 key<br>
             <button class="btn" style="margin-top:10px" onclick="App.go('settings')">去设置</button>
           </div>`;
    }
  },

  /** 组装系统提示：偏好 + 资料库笔记摘要（文件不参与，装不下也读不了） */
  sysPrompt(){
    const pref = Store.get('ai_pref', '');
    const refs = (typeof Refs !== 'undefined' ? Refs.all() : [])
      .filter(r => r.type === 'note')
      .map(r => `【${r.title}】\n${r.content || ''}`)
      .join('\n\n')
      .slice(0, 6000);
    let sys = '你是华子的私人工作助手。回答用中文，实用、具体、可直接落地。';
    if (pref) sys += `\n\n关于华子的偏好：\n${pref}`;
    if (refs) sys += `\n\n以下是华子资料库里存的资料，回答时可以参考：\n${refs}`;
    return sys;
  },

  async send(){
    if (this._busy) return;
    const input = document.getElementById('aiInput');
    const q = input.value.trim();
    if (!q) return;
    const key = Store.getSecret('deepseek');
    if (!key){
      document.getElementById('aiChat').innerHTML =
        '<div class="empty">还没配置 key<br><button class="btn" style="margin-top:10px" onclick="App.go(\'settings\')">去设置</button></div>';
      return;
    }

    input.value = '';
    this.history.push({ role: 'user', content: q });
    this.draw();
    this._busy = true;

    const chat = document.getElementById('aiChat');
    const typing = document.createElement('div');
    typing.className = 'typing';
    typing.textContent = '在想……';
    chat.appendChild(typing);

    try {
      const r = await fetch(this.API, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'Authorization': 'Bearer ' + key },
        body: JSON.stringify({
          model: this.MODEL,
          stream: true,
          messages: [{ role: 'system', content: this.sysPrompt() }, ...this.history.slice(-20)]
        })
      });
      if (r.status === 401) throw new Error('key 好像不对，去设置里检查一下');
      if (r.status === 402) throw new Error('账户余额不足，去 DeepSeek 平台看看');
      if (!r.ok) throw new Error('接口暂时用不了（' + r.status + '）');

      // 流式读取
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
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop();
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
      if (!full) throw new Error('回了句空话，再问一次试试');
      this.history.push({ role: 'assistant', content: full });
    } catch(e){
      typing.remove();
      const err = document.createElement('div');
      err.className = 'msg ai err';
      err.textContent = e.message.includes('Failed to fetch')
        ? '网络连不上，检查一下网络再试' : e.message;
      chat.appendChild(err);
      this.history.pop();   // 失败的这条不留在历史里
    } finally {
      this._busy = false;
    }
  },

  draw(){
    document.getElementById('aiChat').innerHTML = this.history.map(m =>
      `<div class="msg ${m.role === 'user' ? 'user' : 'ai'}">${Util.esc(m.content)}</div>`).join('');
  },

  clear(){
    this.history = [];
    this.render();
  }
};
/* ==== 功能：AI问答 END ==== */
