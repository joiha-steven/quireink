import type { HelpText } from './types'

const help: HelpText = {
  intro: 'Mọi thứ blog này làm được, và mỗi thứ nằm ở đâu. Nếu là site mới thì đọc từ trên xuống; nếu đang tra một điều thì nhảy thẳng tới mục đó.',
  index: {
    writing: 'Viết bài', media: 'Ảnh và tệp', readers: 'Người đọc', analytics: 'Thống kê', settings: 'Cài đặt',
    server: 'Máy chủ', cache: 'Cache', mcp: 'MCP', api: 'Content API', fediverse: 'Fediverse',
    markdown: 'Markdown', keys: 'Phím tắt', trouble: 'Khắc phục sự cố',
  },
  sections: [
    {
      id: 'writing',
      title: 'Viết và đăng bài',
      body: `<ul>
<li>Markdown kèm thanh công cụ. Trong lúc bạn gõ, một bản sao được <b>giữ trên máy này và trên máy chủ</b>; bản thân bài chỉ đổi khi bạn bấm Lưu hoặc Đăng bài, nên sửa một bài đang đăng không bao giờ đưa chữ viết dở lên site.</li>
<li><b>Hẹn giờ</b> bằng cách đăng với một ngày trong tương lai: bài được ẩn đi và tự lên site đúng giờ. Nó <b>không</b> tự gửi email cho ai cả.</li>
<li><b>3 phiên bản</b> gần nhất của mỗi bài được giữ lại; khôi phục một bản ngay trong trình soạn thảo.</li>
<li><b>Loạt bài</b> gom các bài liên quan theo thứ tự, có liên kết bài trước, bài sau và một trang <code>/series/…</code>.</li>
<li>Mọi thứ bị xoá đều vào <b>Thùng rác</b>. Không có gì tự bị xoá hẳn — Thùng rác chỉ được dọn bằng tay.</li>
</ul>
<p class="links"><a href="/admin/editor">Viết bài mới</a> <a href="/admin/content">Tất cả nội dung</a> <a href="/admin/trash">Thùng rác</a></p>`,
    },
    {
      id: 'media',
      title: 'Ảnh và tệp',
      body: `<ul>
<li>Thả ảnh vào trình soạn thảo hoặc vào Thư viện. Các bản <b>AVIF và WebP</b> responsive cùng một ảnh thu nhỏ được làm sẵn cho bạn; ảnh gốc luôn được giữ.</li>
<li>Mở một ảnh trong Thư viện để đọc hoặc sửa <b>mô tả</b> (alt text) của nó — những chữ mà người đọc không nhìn thấy ảnh sẽ nghe thay cho ảnh.</li>
<li>Ảnh nào cũng có thể đeo <b>khung</b> — một lớp viền bằng giấy hoặc bằng mực, ba độ dày — chọn ngay trên ảnh trong trình soạn thảo. {t:navSettings} → {t:tabPost} → {t:cardPictures} đặt khung cho mọi ảnh chưa tự chọn; ảnh nào đã chọn thì giữ khung của riêng nó.</li>
<li>Thư viện đánh dấu các tệp <b>chưa dùng</b> (không có gì liên kết tới), nên dọn chúng đi là an toàn. Nó chỉ báo — không bao giờ xoá.</li>
<li>Tệp nằm trên chính ổ đĩa máy chủ của bạn, phục vụ từ <code>/uploads</code>. Không cần tài khoản lưu trữ đối tượng nào.</li>
</ul>
<p class="links"><a href="/admin/media">Mở Thư viện</a> <a href="/admin/settings?tab=post">{t:tabPost}</a></p>`,
    },
    {
      id: 'readers',
      title: 'Người đọc — bình luận và bản tin',
      body: `<p>Cả hai đều <b>tắt cho tới khi bạn cài đặt</b>, và cả hai đều là của bạn: không có dịch vụ bên thứ ba nào đứng giữa bạn và người đọc.</p>
<ul class="after">
<li><b>Bình luận</b> — bật ở {t:navSettings} → {t:tabPeople}. Cloudflare Turnstile chặn spam và đăng nhập bằng Google là tuỳ chọn. Bạn đọc và xoá bình luận ở màn hình Bình luận.</li>
<li><b>Bản tin</b> — điền thông tin SMTP ở {t:navSettings} → {t:tabPeople}, và một form đăng ký sẽ hiện ở chân mọi bài, kèm một nút ở đầu trang site. Đăng ký theo kiểu <b>xác nhận hai lần</b> (double opt-in): một địa chỉ chỉ được tính khi đã bấm vào liên kết xác nhận.</li>
<li><b>Gửi luôn là việc làm bằng tay.</b> Không có email nào tự động được gửi, kể cả khi một bài hẹn giờ lên site. Bạn tick các bài, đọc đúng email thật trong bản xem trước, rồi bấm gửi. Tick nhiều bài thì chúng đi chung <b>một email gộp</b>, không phải mỗi bài một thư.</li>
<li>{t:navNewsletter} → {t:nlTabPeople} cho thấy mỗi địa chỉ thực sự đã nhận được gì, mọi lỗi SMTP kèm thông báo lỗi, và tỉ lệ mở. {t:navNewsletter} → {t:nlTabTest} gửi cho bạn một bản mẫu của từng email trước khi bất kỳ người đọc nào nhận được.</li>
</ul>
<p class="links"><a href="/admin/newsletter">{t:navNewsletter}</a> <a href="/admin/comments">Bình luận</a> <a href="/admin/settings?tab=people">{t:tabPeople}</a></p>`,
    },
    {
      id: 'analytics',
      title: 'Thống kê',
      body: `<ul>
<li><b>Không cookie, không dữ liệu cá nhân.</b> Một khách truy cập là một mã băm có muối của địa chỉ và trình duyệt, và bản thân chuỗi trình duyệt không bao giờ được lưu — chỉ lưu các nhóm thô về thiết bị, trình duyệt và hệ điều hành.</li>
<li>Bot, các trang admin và lượt ghé của chính bạn đều bị loại ra, nên các con số là người đọc thật.</li>
<li>Lượt xem, người đọc cuộn xuống bao xa và ở lại bao lâu; họ đến từ đâu; từng bài một. Giữ mãi — không có mốc nào tự xoá dữ liệu cũ.</li>
</ul>
<p class="links"><a href="/admin/analytics">Mở Thống kê</a></p>`,
    },
    {
      id: 'settings',
      title: 'Cài đặt',
      body: `<p>Một form và một nút Lưu, áp dụng cho cả site mà <b>không cần deploy lại</b>. Bảy tab:</p>
{tabs}
<p>Đang tìm một thiết lập? Gõ tên của nó vào ô tìm kiếm ở đầu màn hình Cài đặt.</p>
<p class="links"><a href="/admin/settings">Mở Cài đặt</a></p>`,
    },
    {
      id: 'server',
      title: 'Máy chủ, sao lưu và nâng cấp',
      body: `<ul>
<li>Chạy hoàn toàn trên <b>máy chủ của chính bạn</b>: hai tệp SQLite cho nội dung và cho thống kê, và ổ đĩa tại chỗ cho ảnh. Chạy trực tiếp hoặc bằng Docker, không cần tài khoản đám mây.</li>
<li><code>/api/health</code> báo riêng tình trạng cơ sở dữ liệu và thư mục lưu trữ — hãy trỏ công cụ theo dõi uptime vào đó. Máy chủ từ chối khởi động khi thiếu một thiết lập bắt buộc, thay vì khởi động với cấu hình mới được một nửa.</li>
<li><b>Sao lưu</b>: các bản chụp theo lịch (cả hai cơ sở dữ liệu và mọi tệp) ghi vào ổ đĩa của bạn, một bản sao ra ngoài máy chủ nếu bạn thêm chỗ chứa, và một bản nén để tải về ngay. {t:navSettings} → {t:tabServer} → {t:backupTitle}.</li>
<li>Khi nâng cấp, các <b>migration cơ sở dữ liệu có theo dõi</b> được áp dụng, nên mỗi thay đổi schema chạy một lần và chỉ một lần.</li>
</ul>
<p class="links"><a href="doc:docs/self-host.md">Hướng dẫn tự host</a> <a href="doc:docs/backups.md">{t:backupTitle}</a></p>`,
    },
    {
      id: 'cache',
      title: 'Cloudflare và cache',
      body: `<p>Đặt Cloudflare phía trước để có TLS và một bộ cache gần mỗi người đọc — lợi lớn nhất khi người đọc ở xa máy chủ của bạn.</p>
<ul class="after">
<li><b>Cache Rules</b>: bỏ qua <code>/admin</code> và <code>/api</code>, cache mọi thứ còn lại trong khoảng thời gian máy chủ báo. <b>Tắt Rocket Loader</b> (nó xếp lại và trì hoãn các script, làm hỏng admin). SSL: Full (Strict).</li>
<li>Thêm API token Cloudflare và Zone ID ở {t:navSettings} → {t:tabServer} → {t:cardCloudflare}, và mỗi lần lưu sẽ tự xoá cache của zone.</li>
<li><b>{t:clearCache}</b>, ở thanh bên, xoá cache trên máy chủ này và trên Cloudflare, rồi làm nóng lại trang chủ và các trang mới nhất.</li>
<li>Sau khi deploy mã mới, xoá cache ở edge bằng <code>GET /api/cron?purge=1</code>. Cloudflare cache cả HTML, nên một trang cũ không phải thứ người đọc tải lại trang là hết.</li>
</ul>
<p class="links"><a href="https://developers.cloudflare.com/cache/how-to/cache-rules/">Cache Rules</a> <a href="doc:docs/seo-pwa.md">SEO và cache</a></p>`,
    },
    {
      id: 'mcp',
      title: 'MCP — để AI vận hành blog',
      body: `<p><b>Máy chủ MCP</b> có sẵn cho một AI agent <b>đúng những luật của admin</b>: viết và cập nhật bài và trang, chăm ảnh và cài đặt, mọi thay đổi đều được kiểm tra và ghi vào nhật ký hoạt động y như thay đổi của bạn. Bật nó và tạo token truy cập ở {t:navSettings} → {t:tabServer} → {t:cardMcp} — token chỉ hiện một lần và chỉ được lưu dưới dạng mã băm.</p>
<p>Cùng những khả năng đó có ngay trong admin, là màn hình <b>Trợ lý</b>, chạy bằng model ở {t:navSettings} → {t:tabServer} → {t:cardAi} — không cần client MCP nào. Qua cửa nào thì agent cũng <b>đọc và chăm blog</b>: lượt truy cập tuần này so với tuần trước, bình luận được quét vào Thùng rác, kho bài được tìm (kể cả bản nháp), trang nhất được sắp lại quanh những gì người ta thật sự đọc, giao diện được đổi theo các bảng màu làm sẵn, một số bản tin thử chỉ gửi riêng cho bạn. Hỏi nó <i>tuần này blog của tôi thế nào?</i> và nó trả lời bằng chính các con số của bảng điều khiển — <b>sổ tay</b> dưới đây là một trang các câu lệnh làm được việc thật.</p>
<p>Ranh giới nằm ở đâu: địa chỉ người đăng ký và ai viết bình luận nào không bao giờ đi qua MCP; giao diện chỉ nhận các lựa chọn làm sẵn, không bao giờ một màu tuỳ ý; xoá thì vào Thùng rác, không mất hẳn; và gửi bản tin thật <b>cố ý không phải là một công cụ</b> — email đã gửi thì không rút lại được, nên nút đó vẫn là của bạn.</p>
<p class="links"><a href="doc:docs/agent-cookbook.md">Sổ tay agent</a> <a href="doc:docs/mcp.md">Tài liệu MCP</a> <a href="/admin/settings?tab=server">{t:tabServer}</a> <a href="/admin/log">Nhật ký hoạt động</a></p>`,
    },
    {
      id: 'api',
      title: 'Content API — để một chương trình đọc blog',
      body: `<p><b>Content API</b> phục vụ những gì bạn đã đăng dưới dạng JSON ở <code>/api/v1</code> — bài viết, trang, ghi chú và danh mục của bạn, mỗi thứ kèm đúng đoạn Markdown mà nó được viết ra. Nó dành cho việc dựng một thứ gì đó từ blog chứ không phải để đọc blog: một front end thứ hai, một chỉ mục tìm kiếm, một bản sao tĩnh, một script tự kiểm tra liên kết của blog. Bật ở {t:navSettings} → {t:tabServer}; chưa bật thì mọi địa chỉ đó đều trả <b>404</b>.</p>
<p><b>Nó chỉ đọc, và không có key.</b> Ai biết địa chỉ đều đọc được, và thứ họ nhận được đúng bằng thứ họ vốn đã lấy được khi duyệt site: không bản nháp, không bài hẹn ngày tới, không gì trong Thùng rác, và không gì có thể thay đổi blog. Công tắc có ở đó vì những gì nó làm cho <i>dễ</i>, không phải vì những gì nó làm cho khả thi — cả blog chỉ trong số request bằng số trang của nó. Với một blog cá nhân ít người ghé thì đó là tiện lợi; blog của bạn thì bạn quyết.</p>
<p>Để ghi từ một chương trình, dùng <b>MCP</b> ở trên, hoặc Micropub từ một app ghi chép. Cả hai đều phải đăng nhập; cái này thì không, vì vậy nó chỉ được đọc.</p>
<p class="links"><a href="doc:docs/content-api.md">Tài liệu Content API</a> <a href="/admin/settings?tab=server">{t:tabServer}</a></p>`,
    },
    {
      id: 'fediverse',
      title: 'Fediverse — để mọi người theo dõi blog',
      body: `<p>Bật cái này lên và blog của bạn trở thành một <b>tài khoản</b> mà bất kỳ ai trên Mastodon — hay trên các mạng láng giềng của nó — đều theo dõi được. Một bài mới hiện trong dòng thời gian của họ dưới dạng tiêu đề, phần tóm tắt và một liên kết về đây; bản thân bài viết vẫn nằm trên blog của bạn, nơi bạn vẫn sửa được. Sửa một bài sẽ gửi đi một bản đính chính; chuyển nó vào Thùng rác sẽ rút nó lại.</p>
<p><b>Chỉ chọn tên gọi một lần.</b> Nó là nửa <i>@name</i> của <i>@name@yourdomain</i>, và không phải tên đăng nhập của bạn — tên đó vẫn giữ kín. Tên gọi và địa chỉ site <b>gộp lại là danh tính của bạn</b> ngoài kia: về sau đổi một trong hai là mất mọi người theo dõi, vì máy chủ của họ cứ tìm cái tên cũ và chẳng có gì báo cho nó biết bạn đã đi đâu.</p>
<p>Có hai việc nó cố ý <b>chưa</b> làm. Nó đăng đi nhưng không đọc về: trả lời, lượt thích và lượt boost tới được blog của bạn rồi bị bỏ đi, nên một trả lời trên Mastodon không thành bình luận ở đây. Và không gì bạn viết <i>trước</i> khi bật nó lại được gửi đi — bật lên không đẩy kho bài của bạn vào dòng thời gian của bất kỳ ai.</p>
<p class="links"><a href="doc:docs/fediverse.md">Tài liệu Fediverse</a> <a href="/admin/settings?tab=server">{t:tabServer}</a> <a href="/admin/log">Nhật ký hoạt động</a></p>`,
    },
  ],
  markdownTitle: 'Markdown mà trình soạn thảo hiểu',
  markdownLede: 'Markdown chuẩn, cộng thêm những thứ này. Thanh công cụ chèn sẵn phần lớn cho bạn.',
  markdownHead: ['Gõ thế này', 'Và bạn được'],
  markdown: {
    '# … ######': 'Tiêu đề. Mục lục được dựng từ các tiêu đề này.',
    '> [!NOTE]': 'Một hộp chú ý. Còn có TIP, WARNING, IMPORTANT và CAUTION.',
    '==text==': 'Bút dạ quang. ==text==#green chọn màu mực: yellow (vàng), green (xanh lá), pink (hồng), blue (xanh dương) hoặc orange (cam).',
    '++text++': 'Gạch chân bút chì. ++text++#green kẻ đường gạch bằng một trong năm màu mực đó.',
    '@@word@@': 'Vòng khoanh bút bi quanh một chữ. @@word@@#blue chọn màu mực; không chọn thì màu đỏ.',
    'text[^1]': 'Một chỗ dẫn tới chú thích cuối trang; viết lời chú thích dạng [^1]: ở bất kỳ đâu trong thân bài.',
    '![alt](url)': 'Một ảnh. Thả tệp vào trình soạn thảo là dòng này được viết sẵn cho bạn.',
    '![alt](url#frame)': 'Một lớp khung quanh ảnh đó. #frame-thin và #frame-thick đổi độ dày, ink làm khung tối màu, và #noframe giữ một ảnh để trơn trên một site đang dùng khung.',
    '```lang': 'Khối code, tô màu ngay trên máy chủ (không có script nào chạy trong trình duyệt của người đọc).',
    '---': 'Kiểu đường phân cách duy nhất dùng trên toàn site.',
    'YouTube / Vimeo': 'Một địa chỉ YouTube hoặc Vimeo nằm riêng một dòng sẽ thành trình phát nhúng vừa khít trang.',
    'Spotify / Apple Music': 'Một địa chỉ Spotify hoặc Apple Music nằm riêng một dòng sẽ thành trình phát nhúng (không có script bên thứ ba).',
  },
  keysTitle: 'Phím tắt trong trình soạn thảo',
  keysLede: 'Ngoài những phím quen thuộc cho đậm, nghiêng, tiêu đề và hoàn tác.',
  keysHead: ['Bấm', 'Để làm gì'],
  keys: {
    save: 'Lưu. Bản nháp vẫn là bản nháp và bài đã đăng vẫn là bài đã đăng: chỉ Đăng bài, hoặc trạng thái trong bảng bên, mới đổi được điều đó. Tự lưu giữ một bản sao trên máy này và trên máy chủ, nhưng chỉ Lưu mới ghi vào chính bài.',
    link: 'Thêm liên kết, hoặc sửa liên kết mà con trỏ đang nằm bên trong. Xoá trống ô là gỡ liên kết.',
    ink: 'Tô bút dạ quang lên phần đang chọn (==text==).',
    ring: 'Vòng khoanh bút bi quanh phần đang chọn (@@word@@).',
    clear: 'Gỡ mọi định dạng khỏi phần đang chọn — cách chữa cho chữ dán từ chỗ khác vào.',
    attributes: 'Bảng Thuộc tính: địa chỉ, ngày, danh mục và thẻ, cả hai ảnh, các ô SEO và Thùng rác.',
    markdown: 'Chuyển qua lại giữa mặt giấy để viết và mã nguồn Markdown.',
    focus: 'Chế độ tập trung: mọi thứ biến mất, chỉ còn trang giấy.',
    find: 'Tìm, ở cả hai chế độ xem. Enter tới kết quả tiếp theo, Shift-Enter về kết quả trước, Escape đóng lại.',
    replace: 'Tìm và thay: cũng dải đó nhưng mở sẵn ô thay thế. Mũi tên ở đầu dải cũng mở ô này.',
    palette: 'Tìm mọi thứ: các màn hình, các thiết lập và bài viết của bạn. Cũng là nút ở đầu thanh bên.',
    bold: 'Đậm.',
    italic: 'Nghiêng.',
    underline: 'Gạch chân bút chì (++text++).',
    strike: 'Gạch ngang.',
    code: 'Code trong dòng chữ.',
    codeBlock: 'Một khối code.',
    heading: 'Tiêu đề cấp 1 đến 6 — Mod-Alt-2 cho tiêu đề cấp 2, và cứ thế. Mod-Alt-0 trở về đoạn văn thường.',
    bulletList: 'Danh sách gạch đầu dòng.',
    orderedList: 'Danh sách đánh số.',
    taskList: 'Danh sách việc cần làm.',
    blockquote: 'Trích dẫn. Mở đầu bằng [!NOTE] để thành hộp chú ý.',
    undo: 'Hoàn tác. Shift-Mod-Z để làm lại.',
    hardBreak: 'Xuống dòng trong cùng một đoạn.',
  },
  troubleTitle: 'Khi có gì đó trông không ổn',
  troubleLede: 'Những sự cố thật sự hay gặp, và cách sửa từng cái.',
  troubleHead: ['Triệu chứng', 'Cách xử lý'],
  trouble: [
    ['Bản sửa đã có trên máy chủ nhưng người đọc vẫn thấy trang cũ', 'Cloudflare cache cả HTML. Dùng {t:clearCache} ở thanh bên — tải lại trình duyệt không sửa được cache ở edge.'],
    ['Thử SMTP thất bại với lỗi “wrong version number”', 'Cổng và TLS không khớp nhau. 465 là TLS ngầm định (tick ô này); 587 và 25 là STARTTLS (để trống ô).'],
    ['Một người đã đăng ký nhưng không nhận được email nào', 'Địa chỉ được lưu trước khi thư được gửi, nên lượt đăng ký vẫn còn dù SMTP hỏng. Xem lỗi ở {t:navNewsletter} → {t:nlTabPeople}, rồi dùng {t:navNewsletter} → {t:nlTabTest}.'],
    ['Bài hẹn giờ không lên site đúng giờ', 'Blog tự đăng bài trong vòng một phút sau giờ hẹn, miễn là máy chủ đang chạy. Nếu đúng lúc đó máy chủ tắt, bài sẽ lên ngay khi máy chủ chạy lại.'],
    ['Mất ứng dụng xác thực và màn hình đăng nhập đòi mã của nó', 'Ở màn hình nhập mã, chọn “{t:authUseRecovery}” và gõ một trong các mã khôi phục của bạn; mỗi mã chỉ dùng được một lần. Sau đó tạo mã mới ở {t:navSettings} → {t:tabAccount}.'],
    ['Một địa chỉ cũ trả về 404 sau khi đổi tên', 'Đổi tên tự thêm một chuyển hướng 301. Nếu địa chỉ đó chưa từng có ở đây, hãy thêm một cái ở {t:navSettings} → {t:tabServer} → {t:redirectsTitle}.'],
    ['Ảnh biến mất sau khi khôi phục bản sao lưu', 'Mở /api/health — nó báo riêng tình trạng cơ sở dữ liệu và thư mục lưu trữ.'],
  ],
}

export default help
