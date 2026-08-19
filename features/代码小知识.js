/* ==== 功能：代码小知识 START ====
   60 张代码入门卡片，每天自动翻一页（按天数取模，用完自动循环）。
   生成于 2026-08-18，约 2026-10-16 用完一轮——用完跟 AI 说一声再生成一批。
   定位：给完全没写过代码的运营同学，60 天后能看懂网页、能改简单的东西、会跟 AI 提需求。 */
const Code = {
  START: '2026-08-18',
  CARDS: [
/* ── 概念篇 ── */
{ t:'代码是什么', tag:'概念', c:'代码就是写给计算机看的操作说明书。计算机很笨但很听话，你用它能听懂的话一步步告诉它做什么，它就照做。写代码不难，难的是把"想要什么"想清楚。' },
{ t:'网页三件套', tag:'概念', c:'你看到的每个网页都由三种语言组成：HTML 搭骨架（是什么内容），CSS 穿衣服（长什么样），JavaScript 加动作（会动会响应）。就像一个人：骨骼、衣服、行为。', code:'HTML  → 结构\nCSS   → 样式\nJS    → 行为' },
{ t:'前端和后端', tag:'概念', c:'前端 = 你眼睛看得到的界面（手机 App 的页面、网页）。后端 = 看不到的部分（数据存哪、密码怎么验证）。你现在用的这个工作台是纯前端：数据就存在你自己手机里。' },
{ t:'浏览器是个翻译官', tag:'概念', c:'你写的代码是文本文件，浏览器负责把它"翻译"成你看到的画面。所以同一份代码，Chrome、Safari 翻出来的效果可能有细微差别——前端工程师日常打架对象叫"兼容性"。' },
{ t:'F12：藏在浏览器里的实验室', tag:'工具', c:'电脑上按 F12（Mac：Cmd+Option+I）打开开发者工具，能看到任何网页的代码、颜色、结构。做运营看竞品页面怎么实现时特别好用。' },
{ t:'报错不可怕', tag:'心态', c:'程序员每天都在报错，报错是计算机在帮你：它告诉你哪里出了问题、在哪一行。看不懂英文报错就直接整段复制去搜索或问 AI——这是所有人都干的事。' },
{ t:'注释：写给人类的悄悄话', tag:'概念', c:'代码里可以写"注释"，计算机会忽略它，是写给人看的备注。JS 用 // 写单行注释。好代码都配有好注释。', code:'// 这一行是注释，计算机不看\nlet x = 1; // 这句才是代码' },
{ t:'复制粘贴是正统学法', tag:'心态', c:'看到别人网页上喜欢的效果，右键"检查"把代码抄过来改，是学习前端的最快路径。不用不好意思，所有程序员都是从抄开始的。区别只是后来他们看懂了抄的是什么。' },
{ t:'学会提问比学会语法重要', tag:'心态', c:'让 AI 写代码时，说清四件事：①想要什么效果 ②给谁用 ③数据从哪来 ④ examples。会提需求的人 + AI = 会写代码的人。' },
{ t:'你的学习路线', tag:'路线', c:'不用买课。路线是：HTML（2 周）→ CSS（3 周）→ JavaScript（慢慢学）→ 做一个小东西。每天 20 分钟比周末 3 小时有效，就像健身。' },

/* ── HTML 篇 ── */
{ t:'HTML：标签的世界', tag:'HTML', c:'HTML 全是"标签"，尖括号包起来，成对出现：开头 <p> 结尾 </p>。标签告诉浏览器"这是一段文字/一张图/一个按钮"。', code:'<p>我是一段文字</p>' },
{ t:'网页的固定骨架', tag:'HTML', c:'每个网页开头都长一样：html 包住一切，head 放"幕后信息"（标题、字符集），body 放"台前内容"（你看到的一切）。', code:'<html>\n  <head>幕后</head>\n  <body>台前</body>\n</html>' },
{ t:'标题和段落', tag:'HTML', c:'h1 到 h6 是标题，数字越大字越小（一个页面只用一个 h1，利于搜索排名）；p 是段落。文章排版基本就靠它们。', code:'<h1>主标题</h1>\n<h2>小节标题</h2>\n<p>正文段落。</p>' },
{ t:'链接：互联网的血管', tag:'HTML', c:'a 标签做成链接，href 填地址。target="_blank" 表示在新标签页打开。发朋友圈放链接跳转、详情页互跳，底层都是它。', code:'<a href="https://baidu.com" target="_blank">点我打开百度</a>' },
{ t:'图片', tag:'HTML', c:'img 放图片，src 是图片地址，alt 是"图挂了显示的字"也是给搜索引擎看的。注意 img 是少数不需要闭合的标签。', code:'<img src="photo.jpg" alt="王医生出诊照">' },
{ t:'列表', tag:'HTML', c:'ul 是无序列表（圆点），ol 是有序列表（数字），li 是每一项。商品卖点、医生资质罗列用的都是它。', code:'<ul>\n  <li>第一个卖点</li>\n  <li>第二个卖点</li>\n</ul>' },
{ t:'div：什么都不是，所以什么都是', tag:'HTML', c:'div 本身没有任何含义，就是个"盒子"，用来把一堆内容圈起来统一排版。网页里最多的标签就是 div，全是盒子套盒子。', code:'<div class="card">\n  <h2>标题</h2>\n  <p>内容</p>\n</div>' },
{ t:'表单：用户输入的地方', tag:'HTML', c:'input 是输入框，type 决定它长什么样：text 文本、password 密码、date 日期。你每天登录、填表、搜索，都是在跟 input 打交道。', code:'<input type="text" placeholder="请输入手机号">' },
{ t:'按钮', tag:'HTML', c:'button 就是按钮，中间放字。它长得朴素是因为样式归 CSS 管——HTML 只管"这是个按钮"，不管"它好不好看"。', code:'<button>立即咨询</button>' },
{ t:'看懂一个网页的结构', tag:'HTML', c:'练习：随便打开一个网页，右键→检查，看 body 里一层层的标签。不用全看懂，找出"这块是导航栏、这块是内容、这块是底部"就算入门了。' },

/* ── CSS 篇 ── */
{ t:'CSS：给网页化妆', tag:'CSS', c:'CSS 说"选中谁、改成什么样"。先写选择器（选中元素），大括号里写属性：值。三件套里的化妆师。', code:'p {\n  color: red;\n  font-size: 18px;\n}' },
{ t:'选择器：怎么点名', tag:'CSS', c:'三种最常用点名方式：标签名（所有 p）、.class（某一类，最常用）、#id（唯一的那个）。class 是主力军。', code:'.card { }   /* class="card" 的 */\n#logo { }    /* id="logo" 的 */\np { }        /* 所有段落 */' },
{ t:'class：元素的工牌', tag:'CSS', c:'给元素挂 class 就像发工牌：同一个部门（class）穿同样衣服。一个元素可以挂多个 class，用空格隔开。这是 CSS 最核心的用法。', code:'<div class="card big hot">…</div>' },
{ t:'颜色的四种写法', tag:'CSS', c:'red 这种叫得出来的名字只有 140 个；#a9714b 是十六进制（设计师稿上都是它）；rgb(169,113,75) 更直观。工作台主题色 #a9714b 就是十六进制。', code:'color: red;\ncolor: #a9714b;\ncolor: rgb(169, 113, 75);' },
{ t:'字号与字体', tag:'CSS', c:'font-size 定字号（px 最常用），font-weight 定粗细，font-family 定字体。中文字体每个手机都有的：PingFang SC（苹果）、微软雅黑（Windows）。', code:'font-size: 16px;\nfont-weight: 600;\nfont-family: "PingFang SC", sans-serif;' },
{ t:'边框和圆角', tag:'CSS', c:'border 画边框，border-radius 做圆角——数值越大越圆，50% 就是正圆。头像、胶囊按钮全靠它。', code:'border: 1px solid #ddd;\nborder-radius: 12px;\nborder-radius: 50%;  /* 正圆 */' },
{ t:'内边距和外边距', tag:'CSS', c:'padding 是内容与自家边框的距离（内边距），margin 是自家与邻居的距离（外边距）。记法：padding 撑自己，margin 推别人。' },
{ t:'盒模型：一切皆盒子', tag:'CSS', c:'每个元素都是一个盒子：内容 → padding → border → margin，从里到外四层。看不懂布局时，F12 选中元素，图里那圈彩色区域就是这四层。这是 CSS 最重要的一个概念。' },
{ t:'居中：前端界永恒的话题', tag:'CSS', c:'让文字居中一行：text-align: center。让盒子水平居中：margin: 0 auto。让盒子水平垂直都居中：flex 登场（后天讲）。', code:'text-align: center;\nmargin: 0 auto;' },
{ t:'Flex 弹性布局：现代布局之王', tag:'CSS', c:'给父元素 display: flex，子元素就横向排成一排，还能一键对齐。现在 95% 的页面布局都用它。', code:'display: flex;\njustify-content: center;  /* 水平居中 */\nalign-items: center;      /* 垂直居中 */' },
{ t:'响应式：一套代码适配手机和电脑', tag:'CSS', c:'@media 叫媒体查询："屏幕宽度达到某个值时，换一套样式"。你工作台手机是单列、电脑变两列，就是它做的。', code:'@media (min-width: 700px) {\n  .side { width: 200px; }\n}' },
{ t:'CSS 变量：一处定义处处用', tag:'CSS', c:'--accent: #a9714b 定义一次，var(--accent) 到处引用。想换主题色只改一处。你工作台换配色就是这么便宜。', code:':root {\n  --accent: #a9714b;\n}\n.btn {\n  background: var(--accent);\n}' },

/* ── JavaScript 篇 ── */
{ t:'JavaScript：让网页活过来', tag:'JS', c:'HTML 是尸体，JS 是灵魂。点了有反应、数据会保存、内容会变化，全是 JS 干的。你的工作台所有交互都是 JS。' },
{ t:'变量：给数据起名字', tag:'JS', c:'let 声明变量，= 赋值。变量就是个贴了标签的盒子，装什么随你换。名字要有意义，price 比 p 一眼能懂。', code:'let nickname = "华子";\nlet cups = 8;\nnickname = "华哥";  // 随时换' },
{ t:'字符串：文本就是一串', tag:'JS', c:'引号包起来的是字符串。反引号 ` 是高级版：里面可以用 ${} 塞变量进去，拼文案神器。', code:'let name = "华子";\nlet hi = `你好，${name}！`;\n// hi = "你好，华子！"' },
{ t:'数字与运算', tag:'JS', c:'加减乘除 + - * /，余数 %，自增 ++。注意：JS 里 "1"+1 得 "11"（字符串拼接），"1"-1 得 0。加号会拼字符串，这是新手第一坑。', code:'let total = 250 * 8;   // 2000\nlet rest = 2000 % 7;   // 余数' },
{ t:'比较与布尔值', tag:'JS', c:'比较的结果只有两个：true 或 false。=== 判断相等（三个等号更严格，推荐永远用它）。布尔值是所有判断的原料。', code:'5 > 3          // true\n"1" === 1      // false（类型不同）\nage >= 18       // true' },
{ t:'if：让程序做选择', tag:'JS', c:'if (条件) { 满足就做 } else { 否则做 }。程序的"智能"起点就在这。你工作台"过期未完成变红"就是 if 判断日期。', code:'if (cups >= 8) {\n  alert("今天达标！");\n} else {\n  alert("还差 " + (8 - cups) + " 杯");\n}' },
{ t:'for 循环：让计算机干重复的活', tag:'JS', c:'重复 100 次的事写 100 遍？不。for 循环三段式：从几开始、到几为止、每次加几。批量生成卡片列表全靠它。', code:'for (let i = 1; i <= 5; i++) {\n  console.log("第 " + i + " 天");\n}' },
{ t:'数组：一串数据排排坐', tag:'JS', c:'方括号包一串数据就是数组。push 加、下标取（从 0 开始数！）。你工作台的待办列表、医生列表，本质都是数组。', code:'let list = ["王医生", "李医生"];\nlist.push("张医生");   // 加一个\nlist[0]               // "王医生"' },
{ t:'对象：描述一个东西的所有属性', tag:'JS', c:'大括号包着"属性：值"就是对象，像一张名片。数组排排坐，对象按名取。组合起来能描述任何复杂事物。', code:'let doc = {\n  name: "王医生",\n  dept: "皮肤科",\n  fans: 12000\n};\ndoc.dept   // "皮肤科"' },
{ t:'函数：打包一段本事', tag:'JS', c:'function 是打包好的"动作"，起个名，随时调用。参数是原料，return 是成品。写一次，到处用。', code:'function greet(name) {\n  return `你好，${name}`;\n}\ngreet("华子")   // "你好，华子"' },
{ t:'箭头函数：函数的简写', tag:'JS', c:'现代 JS 常用箭头 => 写函数，更短。看别人代码时认得它就行：参数 => 干什么。', code:'const add = (a, b) => a + b;\nadd(2, 3)   // 5' },
{ t:'事件：用户一动手我就知道', tag:'JS', c:'onclick 是"被点了"，oninput 是"输入变了"。给元素挂上事件监听，用户一动就触发你的函数。交互 = 事件 + 函数。', code:'<button onclick="sayHi()">点我</button>\n<script>\nfunction sayHi() { alert("你好！"); }\n</script>' },
{ t:'获取元素并改它', tag:'JS', c:'document.querySelector 用 CSS 选择器找到元素，然后改它的文字、样式、内容。JS 操作页面就这两步：找到、改掉。', code:'let el = document.querySelector(".title");\nel.textContent = "新标题";\nel.style.color = "red";' },
{ t:'console.log：程序员的眼睛', tag:'JS', c:'想看看变量此刻是啥？console.log(x) 打到控制台（F12 里看）。调试最常用的工具，没有之一。print 大法调试，万古不变。', code:'let cups = 4;\nconsole.log("现在喝了", cups, "杯");' },
{ t:'模板字符串拼 HTML', tag:'JS', c:'前端日常：用模板字符串拼一段 HTML，再塞进页面。你工作台的每个列表都是这么"渲染"出来的。', code:'let name = "王医生";\nbox.innerHTML = `\n  <div class="card">${name}</div>\n`;' },
{ t:'JSON：数据的标准信封', tag:'JS', c:'JSON 是各系统间传数据的通用格式：属性都加双引号。你导出的工作台备份文件就是 JSON。JS 里 JSON.parse 解析、JSON.stringify 打包。', code:'{ "name": "华子", "cups": 4 }' },
{ t:'localStorage：浏览器自带的免费仓库', tag:'JS', c:'网页可以把数据存在浏览器里，关掉再开还在。你的整个工作台就建立在它上面——不花一分钱服务器。缺点：只存在这台设备这个浏览器里。', code:'localStorage.setItem("name", "华子");\nlocalStorage.getItem("name");  // "华子"' },
{ t:'你的工作台用的是什么（上）', tag:'JS', c:'你每天勾选待办时：JS 监听点击 → 改数组里那条的 done 状态 → 存进 localStorage → 重新渲染列表。就这四步，撑起了全部功能。' },
{ t:'你的工作台用的是什么（下）', tag:'JS', c:'每天翻一页的代码卡片：JS 拿今天日期减去起始日期算出"第几天"，再从 60 张卡里取对应那张。到 61 天自动回到第 1 张，叫"取模"。' },

/* ── 实战篇 ── */
{ t:'实战：写出你的第一个网页', tag:'实战', c:'新建文本文件，粘入下面代码，保存成 test.html（注意后缀），双击用浏览器打开。恭喜，这是你的第一个作品。', code:'<!DOCTYPE html>\n<html>\n<head><meta charset="utf-8"><title>华子的第一个网页</title></head>\n<body>\n  <h1 style="color:#a9714b">我写出来网页了！</h1>\n  <p>今天是 2026 年，一个运营开始学代码了。</p>\n</body>\n</html>' },
{ t:'实战：控制台里玩 JS', tag:'实战', c:'按 F12 → Console 标签，直接输入 JS 回车就执行，零成本练习场。试试输入 1+1，再试试 alert("hi")。' },
{ t:'实战：改别人的网页玩', tag:'实战', c:'随便打开一个网页，F12 → 选中一个标题 → 双击右侧样式里的 color 改成 red → 页面立刻变红。放心，只改你自己屏幕上的，刷新就恢复，不违法。' },
{ t:'AI 写代码的正确姿势（上）', tag:'实战', c:'差的提问："帮我做个页面"。好的提问："帮我做一个手机端页面，深色背景，中间一个大按钮记录喝水次数，显示最近 7 天记录，数据存本地"。细节越多，一次成功率越高。' },
{ t:'AI 写代码的正确姿势（下）', tag:'实战', c:'AI 给的代码跑不通时，把报错原文贴给它："报错 xxx，在第 y 行"。别自己瞎猜。AI 迭代 2-3 轮修好很正常，你和它是结对编程。' },
{ t:'什么是 API', tag:'实战', c:'API 是程序之间约定好的取货口。你的 AI 问答功能就是：工作台（前端）把问题发给 DeepSeek 的 API，它算完发回来。像去窗口点单，不用进厨房。' },
{ t:'API key：你的取件码', tag:'实战', c:'key 是证明"这个请求是我发的"的凭证。泄露了别人就能花你的额度。所以：别截图发人、别写死在要公开的代码里。你工作台的 key 只存在你手机里，这是对的。' },
{ t:'fetch：网页发请求', tag:'JS', c:'fetch 是 JS 里发网络请求的标准写法。await 等结果回来。你的 AI 问答每次发送，底层就是一次 fetch。', code:'let r = await fetch(url);\nlet data = await r.json();' },
{ t:'跨域 CORS：为什么有时请求会被拦', tag:'概念', c:'网页去请求别家网站的 API，对方明确"允许"才能成。这不是 bug，是浏览器的安全机制（不然任何网站都能拿你的登录状态干坏事）。选 API 前先测它允不允许。' },
{ t:'Git：代码的时间机器', tag:'工具', c:'Git 给代码拍快照，随时回退。GitHub 是放这些快照的网盘+社区。你工作台要用云同步，就得把代码传到 GitHub——部署时我会带你走一遍，那将是你的第一个仓库。' },
{ t:'免费把网页发布上线', tag:'工具', c:'静态网页（不需要后端）可以免费托管：EdgeOne Pages、GitHub Pages、Vercel 等。你的工作台部署后就是全世界能访问的网站（数据还是只在你手机里）。' },
{ t:'PWA：网页伪装成 App', tag:'概念', c:'加一段配置（manifest），网页就能"添加到主屏幕"，全屏运行、有自己的图标，像原生 App。你的工作台就是 PWA——苹果安卓都支持。' },
{ t:'口令为什么不能存明文', tag:'安全', c:'正经系统只存密码的"哈希值"（单向搅碎后的指纹），校验时比对指纹。数据库被拖走也拿不到原密码。你工作台的同步口令，云端就只存哈希。' },
{ t:'为什么备份这么重要', tag:'安全', c:'localStorage 数据和浏览器绑定：清缓存=清数据，换手机=没数据。所以工作台天天念叨你备份。以后做的任何系统，先想"数据丢了怎么办"。' },
{ t:'网页能做什么不能做什么', tag:'边界', c:'能：存数据（本地）、算数、画图、调 API。不能：后台运行（关了就停）、发系统通知（受限制）、读你硬盘文件（需授权）。所以工作台不能"到点弹通知"，只能"打开时提醒你"。' },
{ t:'看懂技术同学在说什么（上）', tag:'概念', c:'"改需求"=推翻已做的工作；"上线"=发布给用户；"回滚"=退回上一版；"bug"=程序错误；"复现"=把问题再演一遍。听懂这些，开会不懵。' },
{ t:'看懂技术同学在说什么（下）', tag:'概念', c:'"前端"管界面，"后端"管数据和逻辑，"接口/API"是两者之间的约定，"联调"是两边接起来测，"提测"=可以测了，"灰度"=先放一小批用户试。' },
{ t:'数据埋点是什么', tag:'运营相关', c:'埋点=在页面里加"传感器"：用户点了什么、停留多久，上报给统计系统。你说"要分析医生各平台数据"，前提就是各平台埋了点。做运营懂这个，和数据部门说话有底气。' },
{ t:'转义：防止用户输入搞坏页面', tag:'JS', c:'用户输入 <b> 之类的内容，直接塞进页面会被当成代码执行（XSS 漏洞）。所以要"转义"：把 < 换成 &lt;。你的工作台所有输入都做了转义——这是安全基本功。' },
{ t:'正则表达式：文本的筛子', tag:'JS', c:'正则是用符号描述文本规律：/^1[3-9]\d{9}$/ 匹配手机号。看着像乱码，其实是精确的筛子。验证表单格式全靠它。先混个脸熟，要用时问 AI。' },
{ t:'第 60 天：接下来怎么走', tag:'路线', c:'你已具备：读得懂网页、改得动样式、跟 AI 结对写代码。下一步：①想一个小需求自己做出来（哪怕丑）②遇到不懂的当天查掉 ③想深入就学"异步"和 DOM 事件。代码这条路，入门最陡，你已经爬完最陡那段了。' }
  ],

  idx: null,   // null = 跟着日期自动走

  dayIndex(){
    const n = Math.floor((new Date(Util.today()) - new Date(this.START)) / 864e5);
    return ((n % this.CARDS.length) + this.CARDS.length) % this.CARDS.length;
  },

  render(){
    const i = this.idx === null ? this.dayIndex() : this.idx;
    const card = this.CARDS[i];
    document.getElementById('codeCard').innerHTML = `
      <h2>${card.t}<span class="tag">${card.tag}</span></h2>
      <div style="font-size:15px;line-height:1.8">${Util.esc(card.c).replace(/\n/g, '<br>')}</div>
      ${card.code ? `<pre>${Util.esc(card.code)}</pre>` : ''}
      <p class="hint">第 ${i + 1} / ${this.CARDS.length} 张 · 每天自动翻一页</p>`;
    document.getElementById('codeIdx').textContent = `${i + 1} / ${this.CARDS.length}`;
    this.idx = i;
  },

  prev(){ this.idx = (this.idx - 1 + this.CARDS.length) % this.CARDS.length; this.render(); },
  next(){ this.idx = (this.idx + 1) % this.CARDS.length; this.render(); }
};
/* ==== 功能：代码小知识 END ==== */
