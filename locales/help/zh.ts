import type { HelpText } from './types'

const help: HelpText = {
  intro: '这个博客能做的一切，以及每样东西在哪里。新站点请从头读起；要查某件事，直接跳到相应部分。',
  index: {
    writing: '写作', media: '媒体', readers: '读者', analytics: '统计', settings: '设置',
    server: '服务器', cache: '缓存', mcp: 'MCP', api: 'Content API', fediverse: '联邦宇宙',
    markdown: 'Markdown', keys: '键盘', trouble: '故障排除',
  },
  sections: [
    {
      id: 'writing',
      title: '写作与发布',
      body: `<ul>
<li>Markdown 加工具栏。你输入时，会有一份副本<b>保存在此设备和服务器上</b>；内容本身只在你按“保存”或“发布”时才会改变，所以编辑一篇已上线的文章，绝不会把写了一半的文字放到站点上。</li>
<li><b>定时发布</b>：把发布日期设在将来即可。文章会先隐藏，到时间自动上线。它<b>不会</b>自己给任何人发邮件。</li>
<li>每篇文章都保留最近 <b>3 个版本</b>；可在编辑器里恢复其中一个。</li>
<li><b>系列</b>把相关文章按顺序归在一起，带有上一篇和下一篇的链接，以及一个 <code>/series/…</code> 页面。</li>
<li>每次删除都会进入<b>回收站</b>。没有任何东西会被自动永久删除——回收站只能手动清空。</li>
</ul>
<p class="links"><a href="/admin/editor">新文章</a> <a href="/admin/content">全部内容</a> <a href="/admin/trash">回收站</a></p>`,
    },
    {
      id: 'media',
      title: '媒体与文件',
      body: `<ul>
<li>把图片拖进编辑器或资源库即可。系统会替你生成响应式的 <b>AVIF 和 WebP</b> 版本以及一张缩略图；原图始终保留。</li>
<li>在资源库中打开一张图片，就能查看或修改它的<b>描述</b>（替代文本），也就是看不见图片的读者听到的那段文字。</li>
<li>任何图片都可以加一个<b>边框</b>——纸或墨的衬边，分三种粗细——在编辑器里直接在图片上选择。{t:navSettings} → {t:tabPost} → {t:cardPictures} 设定的是没有自选边框的图片所用的默认边框；已经自选的图片保留自己的选择。</li>
<li>资源库会标出<b>未使用</b>的文件（没有任何地方链接到它们），所以清理起来很安全。它只负责提示——从不删除。</li>
<li>文件存放在你服务器自己的磁盘上，由 <code>/uploads</code> 提供。不需要对象存储账号。</li>
</ul>
<p class="links"><a href="/admin/media">打开资源库</a> <a href="/admin/settings?tab=post">{t:tabPost}</a></p>`,
    },
    {
      id: 'readers',
      title: '读者——评论与邮件通讯',
      body: `<p>两者都<b>在你设置之前处于关闭状态</b>，而且都完全属于你：你和读者之间没有任何第三方服务。</p>
<ul class="after">
<li><b>评论</b>——在 {t:navSettings} → {t:tabPeople} 中开启。用 Cloudflare Turnstile 防垃圾评论、用 Google 登录，都是可选的。你可以在评论页面阅读和删除评论。</li>
<li><b>邮件通讯</b>——在 {t:navSettings} → {t:tabPeople} 中填好 SMTP 信息，每篇文章底部就会出现订阅表单，站点页眉也会出现一个按钮。订阅采用<b>双重确认</b>：一个地址只有点击了确认链接之后才算数。</li>
<li><b>发送永远是手动的。</b>没有任何东西会自动发邮件，就连定时文章上线也不会。你勾选文章，在预览里读一遍真实的邮件，然后按下发送。勾选多篇时，它们会合成<b>一封摘要邮件</b>发出，而不是每篇一封。</li>
<li>{t:navNewsletter} → {t:nlTabPeople} 显示每个地址实际收到了什么、每一次 SMTP 失败及其错误信息，以及打开率。{t:navNewsletter} → {t:nlTabTest} 会在任何读者看到之前，先把每种邮件的样本发给你。</li>
</ul>
<p class="links"><a href="/admin/newsletter">{t:navNewsletter}</a> <a href="/admin/comments">评论</a> <a href="/admin/settings?tab=people">{t:tabPeople}</a></p>`,
    },
    {
      id: 'analytics',
      title: '统计',
      body: `<ul>
<li><b>不用 Cookie，不存个人数据。</b>一位访客就是 IP 地址与浏览器组合后的加盐哈希值，浏览器标识字符串本身从不保存——只保存粗略的设备、浏览器和操作系统分组。</li>
<li>机器人、后台页面和你自己的访问都会被排除，所以数字代表的是读者。</li>
<li>浏览量、读者滚动了多远、停留了多久；他们从哪里来；每篇内容各自的数据。永久保留——没有滚动时间窗口。</li>
</ul>
<p class="links"><a href="/admin/analytics">打开统计</a></p>`,
    },
    {
      id: 'settings',
      title: '设置',
      body: `<p>一张表单、一次保存，<b>无需重新部署</b>就作用于整个站点。共七个标签页：</p>
{tabs}
<p>要找某一项设置？在设置页面顶部的搜索框里输入它的名字。</p>
<p class="links"><a href="/admin/settings">打开设置</a></p>`,
    },
    {
      id: 'server',
      title: '服务器、备份与升级',
      body: `<ul>
<li>完全运行在<b>你自己的服务器</b>上：两个 SQLite 文件分别存放内容和统计数据，本地磁盘存放图片。原生运行或 Docker 均可，不需要云账号。</li>
<li><code>/api/health</code> 分别报告数据库和存储文件夹的状态——把你的在线监控指向它。缺少必需的设置时，服务器会拒绝启动，而不是带着一半配置启动。</li>
<li><b>备份</b>：定时快照（两个数据库和所有文件）写入你自己的磁盘；如果你添加了异地位置，还会有一份副本存到服务器之外；也可以立即下载一份存档。{t:navSettings} → {t:tabServer} → {t:backupTitle}。</li>
<li>升级时会执行<b>有记录的数据库迁移</b>，所以每次结构变更只运行一次，且仅一次。</li>
</ul>
<p class="links"><a href="doc:docs/self-host.md">自托管指南</a> <a href="doc:docs/backups.md">{t:backupTitle}</a></p>`,
    },
    {
      id: 'cache',
      title: 'Cloudflare 与缓存',
      body: `<p>在前面放一层 Cloudflare，负责 TLS，并在每位读者附近提供缓存——读者离你的服务器很远时，这是最大的提升。</p>
<ul class="after">
<li><b>Cache Rules</b>：绕过 <code>/admin</code> 和 <code>/api</code>，其余一切按服务器指定的时长缓存。<b>关闭 Rocket Loader</b>（它会重排并延迟脚本，导致后台出错）。SSL: Full (Strict)。</li>
<li>在 {t:navSettings} → {t:tabServer} → {t:cardCloudflare} 中填入 Cloudflare API 令牌和 Zone ID，之后每次保存都会自动清除该区域的缓存。</li>
<li>侧边栏里的<b>{t:clearCache}</b>会清除本服务器和 Cloudflare 的缓存，然后重新预热首页和最新的页面。</li>
<li>部署新代码后，用 <code>GET /api/cron?purge=1</code> 清除边缘缓存。Cloudflare 会缓存 HTML，所以过期的页面不是读者刷新一下就能消除的。</li>
</ul>
<p class="links"><a href="https://developers.cloudflare.com/cache/how-to/cache-rules/">Cache Rules</a> <a href="doc:docs/seo-pwa.md">SEO 与缓存</a></p>`,
    },
    {
      id: 'mcp',
      title: 'MCP——让 AI 来打理博客',
      body: `<p>内置的 <b>MCP 服务器</b>让 AI 代理遵守<b>与后台相同的规则</b>：撰写和更新文章与页面，打理图片和设置，每一处改动都会像你自己的操作一样经过检查并写入活动日志。在 {t:navSettings} → {t:tabServer} → {t:cardMcp} 中开启它并创建访问令牌——令牌只显示一次，系统只保存其哈希值。</p>
<p>同样的能力也以<b>助手</b>页面的形式存在于后台之中，运行在 {t:navSettings} → {t:tabServer} → {t:cardAi} 里的模型上——不需要 MCP 客户端。无论从哪扇门进来，代理都能<b>阅读和打理</b>：本周与上周的流量对比、把评论清理进回收站、搜索归档（包括草稿）、根据读者真正在读的内容重新排列首页、从现成的配色中重新挑选外观、只给你一个人发一期测试邮件通讯。问它<i>我的博客这周表现怎么样？</i>，它会用仪表盘上的同一组数字回答——下面的<b>实用手册</b>是一页能完成实际工作的提示词。</p>
<p>界线在哪里：订阅者的邮箱地址和哪条评论是谁写的，绝不会经过 MCP；外观只接受现成的选项，绝不接受随意指定的颜色；删除的东西进入回收站，而不是消失；发送真正的邮件通讯<b>刻意不做成工具</b>——邮件发出去就收不回来，所以那个按钮始终由你来按。</p>
<p class="links"><a href="doc:docs/agent-cookbook.md">代理实用手册</a> <a href="doc:docs/mcp.md">MCP 文档</a> <a href="/admin/settings?tab=server">{t:tabServer}</a> <a href="/admin/log">活动日志</a></p>`,
    },
    {
      id: 'api',
      title: 'Content API——让程序读取博客',
      body: `<p><b>Content API</b> 在 <code>/api/v1</code> 以 JSON 提供你已发布的内容——文章、页面、笔记和你的分类，每一项都附带它写作时用的 Markdown。它是用来拿博客做点什么的，而不是用来读博客的：第二个前端、一个搜索索引、一份静态副本、一段检查自身链接的脚本。在 {t:navSettings} → {t:tabServer} 中开启；开启之前，所有这些地址都会返回 <b>404</b>。</p>
<p><b>它只能读，而且没有密钥。</b>任何知道地址的人都能读取，而他们拿到的，正是浏览站点本来就能拿到的东西：没有草稿，没有日期在未来的文章，回收站里的一概没有，也没有任何能改动博客的东西。之所以设一个开关，是因为它让某件事变得<i>便宜</i>，而不是让某件事变得可能——用和页面数一样多的请求就能拿走整个博客。对一个安静的个人博客来说，这是一种便利；你的博客由你决定。</p>
<p>要从程序写入，请使用上面的 <b>MCP</b>，或者从笔记应用使用 Micropub。两者都需要登录；这个不需要，所以它只能读。</p>
<p class="links"><a href="doc:docs/content-api.md">Content API 文档</a> <a href="/admin/settings?tab=server">{t:tabServer}</a></p>`,
    },
    {
      id: 'fediverse',
      title: '联邦宇宙——让别人关注这个博客',
      body: `<p>开启之后，你的博客就成了一个<b>账号</b>，Mastodon 上——或者它的任何邻居上——的任何人都可以关注。新文章会以标题、导语和一条回到这里的链接出现在他们的时间线里；正文本身留在你的博客上，你仍然可以编辑。编辑一篇文章会发出一份更正；把它移到回收站则会撤回它。</p>
<p><b>账号名只选一次。</b>它是 <i>@name@yourdomain</i> 中 <i>@name</i> 的那一半，不是你的登录名——登录名始终保密。你的账号名加上你的站点地址，<b>合起来就是你在外面的身份</b>：以后改动其中任何一个，所有关注者都会丢失，因为他们的服务器会继续寻找那个旧名字，而没有任何东西告诉它你去了哪里。</p>
<p>有两件事它目前刻意<b>不做</b>。它只发布，不读取：回复、点赞和转发会到达你的博客，然后被丢弃，所以 Mastodon 上的回复不会变成这里的评论。而且你在开启<i>之前</i>写的任何内容都不会被发送——开启它不会把你的归档推进任何人的时间线。</p>
<p class="links"><a href="doc:docs/fediverse.md">联邦宇宙文档</a> <a href="/admin/settings?tab=server">{t:tabServer}</a> <a href="/admin/log">活动日志</a></p>`,
    },
  ],
  markdownTitle: '编辑器能识别的 Markdown',
  markdownLede: '标准 Markdown，再加上下面这些。大部分可以用工具栏插入。',
  markdownHead: ['输入这个', '得到的效果'],
  markdown: {
    '# … ######': '标题。目录就是根据它们生成的。',
    '> [!NOTE]': '提示框。还有 TIP、WARNING、IMPORTANT 和 CAUTION。',
    '==text==': '荧光笔。==text==#green 选择墨色：yellow、green、pink、blue 或 orange。',
    '++text++': '铅笔下划线。++text++#green 改用五种墨色之一来画这条线。',
    '@@word@@': '用圆珠笔在词语周围画一个圈。@@word@@#blue 选择墨色；不指定则为红色。',
    'text[^1]': '脚注引用；在正文任意位置用 [^1]: 写下脚注内容。',
    '![alt](url)': '一张图片。把文件拖进编辑器会自动替你写好这一行。',
    '![alt](url#frame)': '给这张图片加一圈衬边。#frame-thin 和 #frame-thick 改变粗细，ink 让衬边变深色，#noframe 则在全站加边框时让某一张图片保持无边框。',
    '```lang': '围栏代码块，在服务器上着色（读者的浏览器里不运行脚本）。',
    '---': '全站统一使用的那一种分隔线。',
    'YouTube / Vimeo': '单独一行的 YouTube 或 Vimeo 地址会变成适应页面宽度的内嵌播放器。',
    'Spotify / Apple Music': '单独一行的 Spotify 或 Apple Music 地址会变成内嵌播放器（不加载第三方脚本）。',
  },
  keysTitle: '编辑器响应的按键',
  keysLede: '在常用的加粗、斜体、标题和撤销之外。',
  keysHead: ['按下', '它会'],
  keys: {
    save: '保存。草稿仍是草稿，已发布的仍是已发布：只有“发布”或面板里的状态才会改变这一点。自动保存会在此设备和服务器上保留一份副本，但只有“保存”才会写入内容本身。',
    link: '添加链接，或编辑光标所在的链接。清空输入框即移除链接。',
    ink: '给选中的文字加荧光笔（==text==）。',
    ring: '用圆珠笔圈出选中的文字（@@word@@）。',
    clear: '清除选中文字上的所有标记——修复从别处粘贴过来的文字的办法。',
    attributes: '属性面板：地址、日期、分类和标签、两张图片、SEO 字段以及回收站。',
    markdown: '在写作界面和 Markdown 源码之间切换。',
    focus: '专注模式：除了纸面，其他一切都隐去。',
    find: '查找，两种视图都可用。Enter 跳到下一个匹配，Shift-Enter 跳到上一个，Escape 关闭。',
    replace: '查找和替换：同一条查找栏，替换框已展开。点击它开头的箭头也能展开。',
    palette: '搜索一切：各个页面、各项设置和你写的内容。也可以用侧边栏顶部的按钮。',
    bold: '加粗。',
    italic: '斜体。',
    underline: '铅笔下划线（++text++）。',
    strike: '删除线。',
    code: '行内代码。',
    codeBlock: '代码块。',
    heading: '1 到 6 级标题——Mod-Alt-2 是二级标题，以此类推。Mod-Alt-0 恢复为正文段落。',
    bulletList: '项目符号列表。',
    orderedList: '编号列表。',
    taskList: '任务清单。',
    blockquote: '引用。以 [!NOTE] 开头即成为提示框。',
    undo: '撤销。Shift-Mod-Z 重做。',
    hardBreak: '在同一段落内换行。',
  },
  troubleTitle: '当某些地方看起来不对',
  troubleLede: '真正会遇到的问题，以及各自的解决办法。',
  troubleHead: ['现象', '怎么办'],
  trouble: [
    ['修改已经在服务器上生效，但读者看到的仍是旧页面', 'Cloudflare 会缓存 HTML。使用侧边栏里的“{t:clearCache}”——刷新浏览器无法修复边缘节点上的缓存。'],
    ['测试 SMTP 时报错“wrong version number”', '端口和 TLS 设置不一致。465 是隐式 TLS（勾选该选项）；587 和 25 是 STARTTLS（不要勾选）。'],
    ['有订阅者注册了，却没收到邮件', '地址会在发信之前先保存，所以即使 SMTP 出了问题，订阅也不会丢。到 {t:navNewsletter} → {t:nlTabPeople} 查看失败原因，然后使用 {t:navNewsletter} → {t:nlTabTest}。'],
    ['定时文章没有按时上线', '只要服务器在运行，博客会在预定时间后一分钟内自动发布它。如果那一刻服务器停机了，文章会在服务器恢复后立即上线。'],
    ['验证器应用没了，登录时却要输入它的验证码', '在验证码页面选择“{t:authUseRecovery}”，输入你的任意一个恢复码；每个恢复码只能用一次。然后到 {t:navSettings} → {t:tabAccount} 生成新的恢复码。'],
    ['改名之后旧地址返回 404', '改名会自动添加一条 301。如果这个地址在这里从未存在过，请到 {t:navSettings} → {t:tabServer} → {t:redirectsTitle} 添加一条。'],
    ['恢复备份后图片不见了', '打开 /api/health——它会分别报告数据库和存储文件夹的状态。'],
  ],
}

export default help
