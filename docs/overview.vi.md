# Quire Ink, bản đầy đủ

[README](../README.vi.md) là bản ngắn: nó là gì, cài thế nào, đọc tiếp ở đâu. Đây là bản dài — từng
phần làm được gì, so với các lựa chọn khác ra sao, vì sao nó nhanh, và bản phát hành này cố ý
chưa làm gì. [English](overview.md)

## Nó là gì

Một cái blog bạn viết và đăng, chạy trên máy chủ bạn thuê. Nó có đủ đồ đạc của một cái blog: trang chủ, bài viết, chuyên mục, ô tìm kiếm, phần bình luận, và bản tin tự gửi email mỗi khi bạn đăng bài. Thứ nó không có là thuật toán quyết định ai được đọc bài bạn, quảng cáo chen ngang, và một công ty có thể đổi luật chơi vào năm sau.

Màu, font, cỡ chữ, bố cục trang chủ, menu: đổi hết trong trang quản trị, sau lần đăng nhập của riêng bạn. Không phải sửa code dòng nào, và làm trên điện thoại cũng được. Trang nhẹ, khoảng 120 KB một bài, nên người lạ ở chỗ sóng yếu cầm máy đời cũ vẫn thấy chữ hiện ra gần như tức thì.

Để bắt đầu bạn cần một tên miền và một máy chủ thuê, loại rẻ nhất là đủ. Riêng lần dựng đầu tiên là việc kỹ thuật, nên nhờ người biết về máy chủ, hoặc [giao hẳn cho một AI agent](../README.vi.md#cài-đặt). Đổi lại, bạn tự giữ nhà mình: không ai sao lưu hộ bạn, có sẵn nút tải nguyên cả blog về máy nhưng bấm nó là việc của bạn.

### Bốn thứ không nơi nào có đủ cùng lúc

**Agent chạy được cả cái blog, không chỉ viết bài.** Máy chủ MCP nằm sẵn bên trong và đi qua đúng đoạn mã mà trang quản trị đi qua. Trợ lý soạn, gắn thẻ, hẹn giờ và đăng; nó còn đọc lượng truy cập, đếm người đăng ký mà không thấy email của ai, quét bình luận rác vào thùng rác chứ không xoá hẳn, sắp lại trang nhất theo bài người ta thật sự đọc, và sao lưu trước khi làm gì lớn. Nhiều blog cho robot đăng bài. Cái này giao cho nó cả cái bàn làm việc.

**Người đọc cũng được cầm bút.** Bôi một câu trên bài là hiện thanh chọn năm màu mực, gạch chì, khoanh bút bi, ghi chú và trích, vẽ bằng đúng nét tay của trang. Dấu bám vào chữ chứ không bám vị trí, sống trong trình duyệt của người đọc, và mang sang máy khác bằng một mã hai mươi ký tự chứ không cần tài khoản. Tốn của người đọc 4,5 KB, chỉ ở trang bài, và một công tắc là tắt.

**Trang đọc mới là sản phẩm.** Font, màu, cỡ chữ, khoảng cách và bố cục đều là tuỳ chọn chứ không phải code. Không một cỡ chữ hay màu nào được viết cứng vào stylesheet của người đọc, và bản build đỏ nếu có ai nhét vào.

**Không thương hiệu nào của chúng tôi bị ép lên trang bạn.** Footer của một blog mới kết thúc bằng một liên kết "powered by Quire Ink". Đó là một dòng bình thường trong Settings → Home & menu, sửa hoặc xoá đi đều được; logo trong admin và dòng phiên bản đều có công tắc tắt.

<details>
<summary><b>Đặt cạnh những lựa chọn quen thuộc</b></summary>

<br/>

- **Thay vì một nền tảng có sẵn.** Bài của bạn là hai tệp SQLite nằm trên ổ đĩa của chính bạn. Không tài khoản, không gói cước, không có cái nút export mà bạn phải cầu cho nó còn chạy sau năm năm.
- **Thay vì WordPress.** Không PHP, không MySQL, không đống plugin phải vá hàng tháng. Một tiến trình, và người đọc chỉ tải về vài KB JavaScript.
- **Thay vì một static site generator.** Bạn có trang quản trị thật. Viết, tải ảnh, hẹn giờ, đăng, từ laptop hay điện thoại. Không build lại, không deploy, không phải git push chỉ để sửa một lỗi chính tả.
- **Thay vì tự viết lấy.** Nửa phần chán đã làm xong và có test: đăng nhập hai lớp, phiên, cắt ảnh, feed, ảnh chia sẻ, chuyển hướng, hoàn tác khi xoá, lịch sử phiên bản, sao lưu, bộ nhập bài, mười một ngôn ngữ.

</details>

Không có gì phải deploy, không phải cài cơ sở dữ liệu nào:

```bash
bun --smol src/index.ts
```

## Bạn được gì

| Phần | Làm được gì |
|:---|:---|
| 🖋️&nbsp;**Viết** | Trình soạn Markdown thật, và bộ máy Markdown là của chính nó: một lần phân tích dựng trang, mở bài trong trình soạn, lưu lại và cắt đoạn tóm tắt. Bảng, video, chú thích chân trang, công thức toán. Thả ảnh vào là tự cắt cho mọi cỡ màn hình. Lưu trong lúc gõ, giữ ba bản gần nhất, hẹn giờ đăng |
| 🏠&nbsp;**Trang&nbsp;chủ** | Danh sách bài, một trang bạn tự viết, hoặc trang nhất kiểu báo dựng sẵn. [Cách hoạt động](./homepage.md) |
| 🎨&nbsp;**Giao&nbsp;diện** | Bốn lối: giấy trơn, mã nguồn, báo in tự đánh số mục, sổ tay trên giấy chấm lưới. Phủ lên đó là sáu bảng màu sáng và tối, bốn font đọc hoặc font của bạn. Sửa một chỗ là cả trang đổi theo |
| 🖍️&nbsp;**Cây&nbsp;bút** | `==tô sáng==`, `++gạch chì++`, `@@khoanh bút đỏ@@`. Nét vẽ như tay người, mực không đều, không vệt nào giống vệt nào. Cho người đọc cầm bút nếu bạn muốn. Trang nào cũng link được `/pen.css` để viết bằng mực của bạn |
| 📓&nbsp;**Sổ&nbsp;tay** | Loại viết thứ ba bên cạnh bài và trang: ghi chú và trích đoạn, nguồn của đoạn trích là một trường riêng. Nói IndieAuth, Micropub và Webmention |
| 💻&nbsp;**Code** | Tô màu sẵn ở máy chủ, 346 ngôn ngữ nạp theo nhu cầu. Người đọc không phải tải bộ tô màu nào |
| 🔍&nbsp;**Đọc** | Tìm kiếm hiện kết quả trong lúc gõ, và gõ dấu nào thì ra đúng chữ đó. Mục lục bài, bài liên quan, thời gian đọc. Chế độ sách: hai cột trên nền giấy ở máy bàn, một cột cuộn trên điện thoại, nhớ chỗ đang đọc |
| 📈&nbsp;**Số&nbsp;liệu** | Thống kê không dùng cookie: ai đọc bài nào, đọc tới đâu, đến từ đâu. Không có gì bị xoá, nên bảng theo năm lùi được tới người đọc đầu tiên. Kèm nhật ký hoạt động và thùng rác hoàn tác được |
| 💬&nbsp;**Bình&nbsp;luận** | Người đọc bình luận không cần tài khoản. Chống spam bằng cách tự ký thử thách, không qua bên thứ ba nào |
| 🔎&nbsp;**Máy&nbsp;tìm&nbsp;kiếm** | Sitemap, `robots.txt`, `llms.txt`, ảnh chia sẻ vẽ riêng cho từng bài. RSS và JSON Feed, cho blog và cho sổ tay. Đổi đường dẫn thì link cũ vẫn chạy |
| 📬&nbsp;**Bản&nbsp;tin** | Đăng ký có email xác nhận, một số tự gửi khi bạn đăng bài. SMTP của riêng bạn |
| 💾&nbsp;**Sao&nbsp;lưu** | Nút tải cả blog về máy, snapshot theo lịch, mỗi snapshot gửi thêm một bản lên bucket R2 hay S3 của bạn. [Chi tiết](./backups.md) |
| 📥&nbsp;**Dọn&nbsp;nhà** | Nhập từ WordPress, Ghost, Substack, Medium. Ảnh được tải về, URL cũ được chuyển hướng sẵn. Muốn đi thì lấy một file ZIP toàn Markdown kèm front matter YAML, và blog này cũng đọc ngược lại được |
| 🌍&nbsp;**Ngôn&nbsp;ngữ** | Mười một thứ tiếng, cả trong quản trị lẫn ngoài site, thêm một thứ nữa là thêm một file |
| 🔐&nbsp;**Đăng&nbsp;nhập** | Mật khẩu băm argon2id, mã xác thực mỗi lần vào, mười mã khôi phục, danh sách thiết bị đang đăng nhập kèm nút cắt. Không có Google trong đường đăng nhập |
| 🤖&nbsp;**Trợ&nbsp;lý** | Khoá model của chính bạn: Claude, GPT, Gemini hay DeepSeek. Mỗi cuộc trò chuyện kèm một hoá đơn. Nó còn viết mô tả ảnh và lọc bình luận rác |
| ⌨️&nbsp;**Quản&nbsp;trị** | HTML do máy chủ dựng, hành vi là những mẩu JavaScript viết tay, không framework. ⌘⇧K gõ tên là nhảy thẳng tới thiết lập cần tìm. ⌘F tìm và thay trong bài. Loạt bài, bản nháp, hẹn giờ, và làm trên điện thoại cũng được |

**Làm cho** một người, một máy chủ, một cái blog định giữ lâu dài.
**Không làm cho** một đội cần phân vai, duyệt bài và hàng đợi biên tập. Nó cố ý chỉ có một chủ.

<div align="center">

<img src="demo-looks.jpg" alt="Cùng một bài viết trong bốn lối giao diện: giấy trơn; mã nguồn, tiêu đề in chữ đơn cách đậm và khung ngoặc vuông; báo in, có măng sét, chuyên mục bên dưới và chữ cái đầu in lớn; và sổ tay, trên giấy chấm lưới cạnh một tấm thẻ" width="960">

<sub>Một bài, bốn lối, một bảng màu. Lối quyết định hình dáng, kiểu chữ và các dấu; còn màu trên cả bốn đều lấy từ bảng màu, nên đổi bảng màu là cả bốn đổi theo.</sub>

<img src="demo-admin.jpg" alt="Trang quản trị Quire Ink: một bài mở trong trình soạn với câu gạch chì, chữ khoanh đỏ, câu tô sáng và bức thư tay đóng khung; bên cạnh là trang cấu hình Giao diện với bốn lối vẽ thành thẻ, bốn font đọc, font khung trang và ô CSS riêng" width="960">

<sub>Trang quản trị như 2.2.14 vẽ nó: trang do máy chủ dựng, không framework. Mọi thứ bên phải, kể cả bốn lối giao diện, đều là tuỳ chọn bấm chọn chứ không phải code, và khung trên cả hai màn đang mặc một trong số đó.</sub>

</div>

## Người đọc cũng có bút

<img src="demo-reader-pen.jpg" alt="Trái: một bài với vệt tô vàng và gạch chì của người đọc, thanh bút mở trên câu đang chọn với năm màu mực, gạch, khoanh, ghi chú và chép trích. Phải: thẻ trên một vệt tô, có ô ghi chú, nút Gửi về sổ tay, và mã sổ tay hai mươi ký tự dưới dòng Giữ trên mọi thiết bị" width="960">

Bôi một câu trên bất kỳ bài nào là hiện một thanh nhỏ: năm màu mực, gạch chì, khoanh bút bi, ghi chú và chép trích. Dấu vẽ bằng đúng nét tay của trang, bám vào chữ chứ không bám vị trí, nên tác giả sửa lỗi chính tả ba đoạn phía trên thì dấu vẫn nằm yên. Dấu sống trong trình duyệt của người đọc, không gửi đi đâu.

Bấm *Giữ trên mọi thiết bị* là dấu đi theo người: bằng đăng nhập Google sẵn có của người bình luận, hoặc một mã hai mươi ký tự cho ai không muốn đăng nhập gì. Máy chủ chỉ giữ mã băm và một dòng mỗi trang, không bao giờ có email, và chủ blog không thấy gì. *Gửi về sổ tay* mở một trang trên Quire Ink của chính người đọc, hoặc bất kỳ trang nào nói Micropub, với đoạn trích và lời của họ điền sẵn.

Tính năng bật sẵn từ lúc cài, một công tắc để tắt (Cài đặt → Bài viết → *Bút cho người đọc*); chỉ tốn người đọc 4,5 KB script, và chỉ trên trang bài. Thử ngay trên [trang demo](https://demo.quireink.com).

## Tốc độ

Số đo từ mạng, lần vào đầu tiên, chưa cache gì. Đúng bằng cái mà một người lạ cầm điện thoại phải chờ.

**Bản cài MẶC ĐỊNH, không tắt thứ gì.** Đo trên bộ dữ liệu demo, đúng thứ `bun run tour` tự dựng, nên ai có kho mã cũng đo lại được. Số byte đã nén, đo ở origin; ảnh của chính blog đếm riêng vì đó là nội dung của bạn chứ không phải phần mềm. Chế độ đọc sách và cây bút cho người đọc vốn đã BẬT sẵn, ở đây chúng được tính đúng như vậy; cột cuối là phần lấy lại được nếu tắt hai thứ đó đi.

| | Trang chủ | Một bài | Nếu tắt hai thứ đó |
|:---|---:|---:|:---|
| **Số&nbsp;request** | 10 | 16 | 14 |
| **Tổng&nbsp;tải&nbsp;về** | **118,9&nbsp;KB** | **122,8&nbsp;KB** | 114,9&nbsp;KB |
| **JavaScript** | **3,7&nbsp;KB** | **15,9&nbsp;KB** | **8,7&nbsp;KB**; viết tay, không framework |
| **CSS** | 12,4&nbsp;KB | 31,9&nbsp;KB | không đổi: hai tệp vệt bút đi theo vệt của chính tác giả trong bài |
| **Font** | 91,5&nbsp;KB | 65,3&nbsp;KB | cắt theo từng hệ chữ, nên đây là dòng duy nhất do nội dung của bạn quyết: tiêu đề trong demo chạy qua ba bảng chữ cái |
| **Request&nbsp;bên&nbsp;thứ&nbsp;ba** | **0** | **0** | không CDN, không font host, không tracker |
| **Lần&nbsp;vào&nbsp;sau** | **0&nbsp;byte** | **0&nbsp;byte** | đúng trang đó trả `304` |

Giữ được như vậy là nhờ mấy luật cứng: mỗi gói JavaScript có hạn mức dung lượng do bản build canh, vượt là build đỏ; trang quản trị không còn framework nào, và phần đó chưa bao giờ chạm tới người đọc; font cắt gọn theo từng ngôn ngữ và chỉ nạp sẵn mặt chữ mà trang thật sự vẽ bằng nó. Không con số nào ở đây để lấy điểm benchmark, chúng dành cho một người cầm chiếc điện thoại bốn năm tuổi, chỉ muốn đọc bốn trăm chữ. [Cách đo và các quyết định phía sau](./performance.md).

## Bản này

**2.2.15** cho phép đăng bài không có tiêu đề. [Nhật ký thay đổi](../CHANGELOG.md) ghi đủ.

- **Bài viết có thể không có tiêu đề.** Một ý ngắn, một đường link kèm một dòng, một cập nhật nhỏ: để trống tiêu đề rồi đăng. Bài vẫn có mọi thứ của một bài viết, địa chỉ riêng (sáu chữ đầu), chỗ trong danh sách blog, cả hai feed, thẻ, chuyên mục và newsletter, và được vẽ bằng chính chữ của nó: trang bài không có dòng tiêu đề, trong danh sách thì ngày đăng là đường vào bài. Ở chỗ chỉ đặt được một cái tên, như thẻ trình duyệt hay thẻ chia sẻ, bài được gọi bằng mấy chữ đầu ([ADR 0064](./decisions/0064-a-post-may-have-no-title.md)).
- **Sửa dọc đường:** bài nháp không tiêu đề bị đổi địa chỉ sau mỗi lần lưu, và các tab loại bài trong danh sách Viết cứ gạch chân "Tất cả" dù chọn tab nào.

**2.2.14, hai ngày trước đó,** lo cho cái máy bên dưới. Nó chạy được trong 192 MB thay vì 256 MB (mỗi ảnh được nén trong một tiến trình con, máy chủ chạy `bun --smol`), bản sao lưu có thể rời máy ở dạng niêm phong bằng hai chìa mà chính máy chủ không mở được, **tắt sẵn lúc cài và khi nâng cấp**, mỗi lần nâng cấp đều chép cơ sở dữ liệu ra trước khi đụng vào, và bốn lối giao diện mỗi cái ra một kiểu ấn phẩm riêng.

**2.2.13, ba ngày trước nữa,** mở đường cho chữ đi ra: theo dõi được blog từ Mastodon, đọc được bằng chương trình qua `/api/v1`, tải về được dưới dạng Markdown mà công cụ khác mở được, và mỗi bài tự khai nó viết bằng tiếng gì.

**2.2.10 tới 2.2.12, bốn ngày trước đó,** là chỗ phép trừ diễn ra. Hai mươi hai gói khai báo rời đi, mười hai gói đi vào, trong đó có React và bảy gói `@tiptap/*`, và bản cài sạch từ 194 MB xuống 138 MB. Trang quản trị trở lại là HTML do máy chủ dựng, thời gian tới lúc thấy tiêu đề đi từ 1.038ms xuống 285ms ở màn Nhật ký; trình soạn thảo đứng thẳng trên ProseMirror và gõ được sau khoảng 107ms; bộ máy Markdown là của chính nó, đạt 648 trên 652 ví dụ CommonMark và 24 trên 24 của GFM; người đọc được cầm bút; sổ ghi chú nói được IndieAuth, Micropub và Webmention; và một bài còn 122,8 KB thay vì 131 KB của bản 2.2.9.


**Và bản này KHÔNG làm được gì.** Bài ngắn chỉ hiện phần tóm tắt trong danh sách và feed chứ không hiện cả bài, và bài viết toàn bằng chữ Trung, Nhật, Hàn hay emoji thì mang địa chỉ theo giờ. Bản sao lưu đã niêm phong mà mất cả hai chìa thì không ai mở được, và script vận hành chỉ niêm phong cơ sở dữ liệu, còn thư mục ảnh thì chép nguyên không niêm phong. Bản chép trước khi nâng cấp nằm cùng ổ đĩa với cơ sở dữ liệu. Ở 192 MB, các cỡ ảnh nhỏ của một ảnh mới có thể tới trễ vài phút. ActivityPub chỉ phát đi chứ chưa đọc về, nên blog không theo dõi ai và một câu trả lời bên kia không thành bình luận bên này. Content API được ăn cả ngã về không, không có khoá riêng cho từng bên gọi. Một bài khai được tiếng của nó nhưng cả site không đi theo bài: chưa có đường dẫn, danh sách, nguồn tin hay trang chủ riêng cho từng thứ tiếng, và một bài chỉ khai được một trong mười một thứ tiếng mà giao diện nói. Gói Markdown là bản xuất ra chứ không phải đồng bộ hai chiều, còn thẻ liên kết chỉ đọc trang bên kia đúng một lần, không đọc lại. Không có chế độ nhiều người dùng: một blog, một chủ, một tiến trình; phần bình luận có tài khoản còn phần viết thì không. NAS và Kubernetes cố ý không có Caddy, vì cả hai đã có sẵn chỗ cắt TLS riêng. Hai máy đánh dấu cùng một trang cùng lúc thì ghi đè nhau, lần lưu sau thắng. Trang quản trị chưa có màn nào cho biết đoạn nào được người đọc giữ nhiều nhất, mới có tool MCP `list_mentions` trả lời. Webmention có kiểm nguồn và giới hạn tốc độ nhưng chưa nối bộ lọc rác. Gõ tiếp ngay sau một liên kết thì chữ rơi vào trong liên kết đó, đã tìm ra và cố ý để nguyên, có test ghim lại để nó không tự đổi khi chưa ai quyết. Có bốn lối giao diện và không có lối thứ năm, lối áp cho cả site và chỉ thay trang đã xuất bản, muốn đi xa hơn vẫn phải viết CSS riêng. Bước nâng cấp STARTTLS chỉ được chứng minh trên một relay thật lúc deploy chứ không ở đâu khác, do Bun không biến được một socket đang mở thành TLS ở phía máy chủ. Ô tìm kiếm tên trong thư viện chỉ lọc trong trang đang mở chứ không lọc cả thư viện, đó là cái giá của việc chia trang. Màn Trợ giúp vẫn chỉ tiếng Anh, vài chỗ đếm vẫn ra "1 attempts", công tắc Chuyển động là của chủ chứ không theo từng người đọc, bản cài chèn HTML bằng `sub_filter` của nginx mất nén và ETag của origin, và origin không CDN thì người đọc ở nửa kia địa cầu trả thêm một vòng mạng mà số byte tiết kiệm không mua lại được.
