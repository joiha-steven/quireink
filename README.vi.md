<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/brand/wordmark-dark.svg">
  <img src="docs/brand/wordmark-light.svg" alt="quireINK" width="360">
</picture>

`2.2.3`

**Một cái blog bạn tự host, và AI agent có thể vận hành thay bạn.**
Không thuật toán, không quảng cáo, không nền tảng nào đứng giữa bạn và người đọc.
Một tiến trình. Hai tệp SQLite. Không tài khoản đám mây nào trong đường đi.

<br/>

![Bun](https://img.shields.io/badge/Bun-000000?logo=bun&logoColor=white)
![Hono](https://img.shields.io/badge/Hono-e36002?logo=hono&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003b57?logo=sqlite&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?logo=typescript&logoColor=white)
![React 19](https://img.shields.io/badge/React_19-20232a?logo=react&logoColor=61dafb)
![MCP](https://img.shields.io/badge/MCP-ready-7c3aed)
![License: PolyForm Noncommercial plus paid hosting](https://img.shields.io/badge/License-PolyForm_NC_%2B_paid_hosting-22c55e)

[English](./README.md) · **Tiếng Việt**

[**quireink.com**](https://quireink.com) · [**Xem thử**](https://demo.quireink.com) · [**Cài đặt**](#cài-đặt) · [**Tốc độ**](#tốc-độ) · [**Để agent viết**](#để-ai-agent-viết-thay-bạn-mcp) · [**Changelog**](./CHANGELOG.md) · [**Giấy phép**](#giấy-phép)

<br/>

<img src="docs/demo.jpg" alt="Hai ảnh chụp cạnh nhau: trang chủ dạng báo với bài dẫn và các hàng chuyên mục, và trang bài viết của cùng site với cột mục lục bên trái, cột thông tin bên phải, một câu gạch dưới bút chì, một chữ khoanh bút bi đỏ, một câu tô xanh và bức thư tay Van Gogh đóng khung làm hình đầu bài" width="960">

<sub>**[demo.quireink.com](https://demo.quireink.com)** là bản thật, chạy được. Không đăng ký, không phải điền gì. Dùng thanh dưới đáy để nhảy qua lại giữa trang chủ dạng báo, danh sách bài, một bài viết, chế độ sách, sáng và tối, và trang quản trị. Thanh đó là thứ duy nhất được thêm vào, và nó nằm ngoài mã nguồn, nên trang demo luôn là bản mới nhất.</sub>

</div>

## Nó là gì

Một cái blog bạn viết và đăng, nằm trên máy chủ bạn thuê.

Mục này viết cho người không rành kỹ thuật. Phần còn lại là cho người sẽ đi dựng nó.

Nó có đủ đồ đạc của một cái blog: trang chủ, bài viết, chuyên mục, ô tìm kiếm, phần bình luận, và bản tin tự gửi email cho người theo dõi mỗi khi bạn đăng bài. Cái nó không có là thuật toán quyết định ai được đọc bài bạn, quảng cáo chen ngang, và một công ty có thể đổi luật chơi vào năm sau.

Màu, font, cỡ chữ, bố cục trang chủ, menu: tất cả đều là một tuỳ chỉnh trong trang quản trị, sau lần đăng nhập của riêng bạn, và tất cả đều dùng được trên điện thoại.

Mở một bài viết tốn khoảng 100 KB. Một tấm ảnh chụp bằng điện thoại nặng gấp vài chục lần, nên người lạ ở chỗ sóng yếu cầm máy đời cũ vẫn thấy chữ hiện ra gần như tức thì. Đó là số đo, và [bảng bên dưới](#tốc-độ) nói rõ đo bằng cách nào.

Đọc cho dễ chịu là chủ đích của cả dự án. Sáu bảng màu sáng và tối, bốn font đọc, chế độ sách dàn hai cột như trang giấy, và bút dạ quang năm màu mực để tô những câu tâm đắc.

Một trợ lý AI có thể viết thay bạn. Nối Claude hoặc một MCP client khác vào rồi bảo *"viết một bài 600 chữ về chuyến đi hôm nay, gắn thẻ du lịch, đăng lên"*, nó sẽ soạn và đăng qua đúng những luật bạn đang dùng. Quyền của nó là một token, bạn thu hồi bằng một cú bấm.

Để bắt đầu, bạn cần một tên miền và một máy chủ thuê; loại rẻ nhất là đủ. Lần dựng đầu tiên là việc kỹ thuật, nên hãy nhờ người biết về máy chủ hoặc giao hẳn cho một agent ([mục Cài đặt](#cài-đặt)). Sau đó thì viết, đăng, đổi giao diện và xem thống kê đều nằm trong trang quản trị; chỉ khi nâng cấp mới phải quay lại dòng lệnh.

Đổi lại, bạn tự giữ nhà mình. Không ai sao lưu hộ bạn. Có sẵn một nút tải nguyên cả blog về máy, nhưng bấm nó là việc của bạn, và blog sống theo cái máy chủ bạn thuê.

Blog cá nhân thì không tốn gì, và bạn được thu tiền: dùng trong doanh nghiệp, hoặc bán dịch vụ host cho mỗi khách một cái blog. Chỉ bản *đã sửa code* đem đi kinh doanh mới phải hỏi trước ([mục Giấy phép](#giấy-phép)).

## Bên dưới nắp máy

Không có gì phải deploy, cũng không có CSDL nào phải cài. Trỏ tên miền vào một câu lệnh là bạn có một cái blog:

```bash
bun src/index.ts
```

Ba quyết định định hình mọi thứ còn lại.

Trang đọc mới là sản phẩm, nên font, màu, cỡ chữ, giãn cách và bố cục đều là tuỳ chỉnh bạn đổi trong trang quản trị. Không một cỡ chữ hay màu nào được viết cứng vào stylesheet của người đọc, và bản dựng sẽ hỏng nếu ai đó nhét một cái vào.

Người đọc tải về từ 3,9 KB đến 10,4 KB JavaScript, và không tải gì từ bất kỳ ai khác. Trang tới nơi dưới dạng HTML đã hoàn chỉnh. Vài đoạn script nhỏ lo phần tìm kiếm, nút đổi nền và chế độ sách; React ở lại trong trang quản trị và không bao giờ chạm tới người đọc.

Một agent có thể trông coi chứ không chỉ viết. Bất kỳ MCP client nào cũng soạn được bài, gắn thẻ, hẹn giờ và đăng, đọc lưu lượng, quét bình luận và rà lại kho bài, qua đúng những luật mà trang quản trị tuân theo.

Bạn được đọc, sửa, chạy và fork nó theo [PolyForm Noncommercial](./LICENSE), và được chạy bản đã phát hành để kinh doanh, kể cả bán dịch vụ host, theo [một quyền bổ sung](./LICENSE-EXCEPTION.md).

**2.2.2** là bản hiện hành. Nó đang chạy bản demo ở trên và blog riêng của tác giả tại [manhhung.me](https://manhhung.me); [nhật ký thay đổi](./CHANGELOG.md) ghi đủ những gì đã đổi.

## Bạn được gì

| Phần | Làm được gì |
|:---|:---|
| 🖋️&nbsp;**Viết** | Trình soạn thật trên nền Markdown — bảng, video, chú thích chân trang, khung nhấn, **công thức toán**, Spotify. Thả ảnh vào là nó tự cắt cho mọi cỡ màn hình — và tự được mô tả, nếu bạn đưa Settings một API key (Anthropic, OpenAI hoặc Gemini; key của bạn, hoá đơn của bạn). Một tấm ảnh có thể chiếm trọn cột chữ, thu còn một phần ba để chữ chạy vòng quanh, ghép với ảnh bên cạnh thành một dải, hoặc đóng khung: lề giấy hoặc lề mực, ba độ dày, đặt cho từng ảnh hoặc đặt một lần cho cả site. Lưu trong lúc gõ, giữ ba bản, và giữ bài lại tới sáng thứ Ba |
| 🏠&nbsp;**Trang&nbsp;chủ** | Danh sách bài, một trang bạn tự viết, hoặc trang dựng sẵn: bài dẫn, vài bài chọn, một hàng cho mỗi chuyên mục, bài đọc nhiều. Hợp cả site nhiều ảnh lẫn site chỉ có chữ. [Cách hoạt động](./docs/homepage.md) |
| 🎨&nbsp;**Giao&nbsp;diện** | Sáu bảng màu, sáng và tối. Bốn font đọc, hoặc tải font của bạn lên. Mọi cỡ chữ đều sinh ra từ một vai trò, nên sửa một chỗ là cả trang đổi chứ không phải một tiêu đề |
| 🖍️&nbsp;**Cây&nbsp;bút** | `==chữ==` tô năm màu mực, `++chữ++` gạch dưới bằng bút chì, `@@chữ@@` khoanh tròn bằng bút bi đỏ. Không phải ô màu — nét sinh từ một bàn tay có hạt giống, không hai vệt nào trên trang giống nhau và mỗi cụm chữ giữ nét riêng. Màu mực đo từ ảnh chụp một hộp bút thật |
| 💻&nbsp;**Code** | Tô màu ở máy chủ, người đọc không tải bộ tô màu nào. Hai mươi mốt ngôn ngữ, và những tên hay gõ (`typescript`, `sh`) đều nhận ra. Hàng rào không ghi ngôn ngữ thì được đoán — đoán dè dặt, để output của chương trình vẫn để trơn |
| 🔍&nbsp;**Đọc** | Tìm kiếm trả lời ngay trong lúc gõ. Cột bên có chuyên mục và thẻ, hoặc mục lục của bài đang đọc. Bài liên quan, thời gian đọc, thanh tiến độ. Và **chế độ sách**: hai cột trên nền giấy, có chữ cái đầu lớn. Cuối bài có đọc tiếp, và chỗ đọc dở được giữ cho lần quay lại |
| 📈&nbsp;**Số&nbsp;liệu** | Thống kê không dùng cookie. Ai đọc bài nào, đọc tới đâu, đến từ đâu. Kèm nhật ký hoạt động, thùng rác hoàn tác được, và một trang trợ giúp |
| 💬&nbsp;**Bình&nbsp;luận** | Người đọc bình luận không cần tài khoản. Trang tự ký thử thách chống spam — không bên thứ ba nào; có khoá Turnstile thì Turnstile tiếp quản. Dọn rác là đưa vào thùng, không phải xoá hẳn |
| 🔎&nbsp;**Máy&nbsp;tìm&nbsp;kiếm** | Sitemap, RSS, `robots.txt`, `llms.txt`, và ảnh chia sẻ vẽ riêng cho từng bài. Đổi đường dẫn thì link cũ vẫn tự chạy |
| 📬&nbsp;**Bản&nbsp;tin** | Đăng ký có email xác nhận, một số gửi đi khi bạn đăng bài, và một lời nhắn khi bình luận được trả lời. SMTP của riêng bạn |
| 📚&nbsp;**Loạt&nbsp;bài** | Viết thành nhiều phần, đánh số, và phần nào cũng chỉ ra các phần kia |
| 💾&nbsp;**Sao&nbsp;lưu** | Một nút tải cả blog về máy bạn, snapshot theo lịch giữ trên máy chủ, và mỗi snapshot cũng được gửi lên bucket R2/S3 của chính bạn. [Chi tiết](./docs/backups.md) |
| 📥&nbsp;**Dọn&nbsp;nhà&nbsp;sang** | Tải lên XML của WordPress, JSON của Ghost, hay tệp ZIP mà Substack/Medium gửi qua email — máy chủ tự nhận ra của ai. Tất cả thành Markdown, shortcode chết được quét sạch trên đường vào, URL cũ được chuyển hướng sẵn, và ảnh được tải về thư viện của bạn |
| 🌍&nbsp;**Ngôn&nbsp;ngữ** | Mười một thứ tiếng, cả trong quản trị lẫn ngoài site — và cộng đồng có thể thêm nữa, mỗi ngôn ngữ một file. Không kèm webfont CJK nào — chúng nặng hàng megabyte — nhưng mỗi thứ tiếng gọi tên mặt chữ riêng, nên 直 được vẽ theo lối Nhật trên site tiếng Nhật |
| 🔐&nbsp;**Đăng&nbsp;nhập** | Tên và mật khẩu của riêng bạn, băm bằng argon2id. Mã xác thực mỗi lần vào, và mười mã khôi phục cho ngày mất điện thoại. Không có Google trong đường đăng nhập |
| 📱&nbsp;**Điện&nbsp;thoại** | Cài ra màn hình chính là nó mở như một ứng dụng |

**Làm cho** một người, một máy chủ, một cái blog định giữ lâu dài.
**Không làm cho** một đội cần phân vai, duyệt bài và hàng đợi biên tập. Nó cố ý chỉ có một chủ.

<div align="center">

<img src="docs/demo-reading.jpg" alt="Chế độ sách: trình đọc hai cột toàn màn hình trên nền giấy, có chữ cái đầu lớn, bức thư đóng khung có chú thích và số trang; bên cạnh là giao diện tối đang hiện gallery 2 nhân 2 tranh Van Gogh phía trên một bảng" width="960">

<sub>Chế độ sách và giao diện tối. Không cái nào là một lớp lọc phủ lên trang. Cả hai đều là chính hệ typography của trang đọc. Font đi kèm có sẵn dấu tiếng Việt và dấu của các tiếng Trung Âu, nên khối mẫu chữ bên trái hiện đúng font chứ không rơi về font hệ thống.</sub>

<img src="docs/demo-code.jpg" alt="Ba ảnh chụp: một công thức chặn trên độ trôi của thang chữ sau khi làm tròn, dựng bằng MathML trong font đọc; phần code của cùng site, một khối được tô màu nhờ tên ngôn ngữ và một khối bên dưới không ghi ngôn ngữ, chỉ đánh dấu phần trong ngoặc kép và tên biến có dấu đô la; và ba vệt bút dạ vàng, xanh, hồng" width="960">

<sub>Công thức toán là MathML, do chính trình duyệt dựng: không script, không stylesheet, không file font, nên một bài có công thức không tốn thêm gì so với bài không có. Code cũng tô màu ở máy chủ, cùng một lý do; khối phía dưới không ghi ngôn ngữ nên không ai bịa màu cho nó, chỉ đánh dấu những gì đúng trong mọi ký pháp. Bút dạ là nét SVG ngắt theo từng dòng, có năm màu mực.</sub>

</div>

## Tốc độ

Đây là số đo từ mạng, lần vào đầu tiên, chưa cache gì. Đúng bằng cái mà một người lạ cầm điện thoại phải chờ.

Hai dòng CSS và JavaScript là sản phẩm của bản build, giống nhau ở mọi bản cài, lấy từ bản dựng 2.2.3. Các số tổng đo trên một site đang chạy thật: tiếng Việt, Literata để đọc và JetBrains Mono cho phần khung. Chúng không phải thuộc tính của phần mềm, vì font được cắt theo bảng chữ và trình duyệt chỉ tải đúng những dải mà trang bạn dùng tới. Hình nét của cây bút nằm trong hai tệp bất biến riêng (~20 KB cả cặp) chỉ lên xe ở trang thật sự có vệt tô hay gạch chân ([ADR 0027](docs/decisions/0027-the-pen-ships-only-where-it-wrote.md)). Trang không mực không phải trả đồng nào cho chúng. Bật đọc offline thì thêm một service worker 0,7 KB, tải một lần và chỉ ở blog đã bật.

| | Trang chủ | Một bài | |
|:---|---:|---:|:---|
| **Số&nbsp;request** | 8 | 9 | |
| **Tổng&nbsp;tải&nbsp;về** | **102&nbsp;KB** | **100&nbsp;KB** | 68&nbsp;KB trong đó là font |
| **JavaScript** | **4,0&nbsp;KB** | **10,3&nbsp;KB** | viết tay, không framework |
| **CSS** | 9,6&nbsp;KB | 9,6&nbsp;KB | +20&nbsp;KB chỉ ở trang có vệt bút |
| **Request&nbsp;bên&nbsp;thứ&nbsp;ba** | **0** | **0** | không CDN, không font host, không tracker |
| **Lần&nbsp;vào&nbsp;sau** | ~20&nbsp;KB | ~11&nbsp;KB | chỉ tải lại HTML; bài dài thì nặng hơn |

Nó giữ được như vậy nhờ năm quyết định khó đảo ngược.

Mỗi gói JS có một hạn mức dung lượng do build canh, vượt là build đỏ. Một tính năng không thể lặng lẽ bắt mọi người đọc trả thêm một chút, mãi mãi.

Cache trang là một `Map` duy nhất, và bất kỳ lần ghi nào cũng xoá sạch nó. Cả luật chỉ có vậy, nên không còn chỗ nào để sai một cách tinh vi. Trượt cache thì tốn một lần đọc SQLite cộng một lần render, dưới một phần nghìn giây.

Markdown đã render được lưu theo hash của đầu vào, nên không bao giờ phải invalidate cái gì. Một bài dài từ 383 ms xuống 1 ms.

Font là của bạn, cắt gọn theo từng ngôn ngữ, và chỉ preload đúng bộ mà trang cần. Ghim một trục của variable font đưa bộ preload từ 97,6 KB xuống 46,2 KB.

Hiệu ứng hiện dần và thanh tiến độ là CSS thuần: không script, không chạy trên main thread, và trình duyệt cũ thì đơn giản là hiện chữ ra luôn.

<div align="center">

<img src="docs/demo-mobile.jpg" alt="Ba màn hình điện thoại: danh sách bài, một bài viết đang hiện mục lục của loạt bài, và lớp tìm kiếm tức thì mới gõ dở đã lọc kho bài xuống còn những tựa khớp" width="960">

<sub>Không con số nào ở trên là để lấy điểm benchmark. Chúng dành cho một người cầm chiếc điện thoại bốn năm tuổi, chỉ muốn đọc bốn trăm chữ.</sub>

</div>

## Vì sao không dùng thứ khác

**Thay vì một nền tảng có sẵn.** Bài của bạn là hai tệp SQLite trên ổ đĩa của chính bạn. Không tài khoản, không gói cước, không có cái nút export mà bạn phải cầu cho nó vẫn chạy sau năm năm.

**Thay vì WordPress.** Không PHP, không MySQL, không đống plugin phải vá. Một tiến trình, và người đọc nhận JavaScript chỉ vài KB.

**Thay vì một static site generator.** Bạn có trang quản trị thật. Viết, tải ảnh, hẹn giờ và đăng từ laptop hay điện thoại, với tìm kiếm, bình luận, bản tin và thống kê đã có sẵn. Không build lại, không deploy, không phải git push chỉ để sửa một lỗi chính tả.

**Thay vì tự viết lấy.** Nửa phần chán đã làm xong và có test: đăng nhập TOTP, phiên, cắt ảnh, feed, ảnh OG, redirect, hoàn tác khi xoá, lịch sử phiên bản, sao lưu, bộ nhập từ WordPress, Ghost, Substack và Medium, mười một ngôn ngữ.

<div align="center">

<img src="docs/demo-admin.jpg" alt="Trang quản trị Quire Ink: trình soạn bài với nút gạch dưới và khoanh tròn trên thanh công cụ, câu gạch chì, chữ khoanh đỏ, câu tô sáng và bức thư tay đóng khung trong bài; bên cạnh là trang cấu hình giao diện với sáu bảng màu và bốn font đọc" width="960">

<sub>Trang quản trị xoay quanh việc viết: danh sách bài nằm cạnh trang giấy, mọi thứ còn lại mỗi việc một tấm. Bảng màu, font, cỡ chữ, bố cục và menu đều là tuỳ chọn. Không có cái nào là code.</sub>

</div>

## Cài đặt

**Cài lên đâu được?** Chỗ nào dưới đây cũng được, và blog y hệt nhau ở mọi chỗ.

- **Một VPS thuê ngoài** — gói rẻ nhất là đủ. Một lệnh bên dưới, hoặc Docker.
- **Droplet DigitalOcean** — dán [một file](./deploy/digitalocean/user-data.sh) vào trang tạo droplet, ba phút sau khi máy nổ là blog đã chạy ([cách làm và lý do](./deploy/digitalocean/README.md)).
- **NAS trong nhà** — trên **Unraid** tìm `QuireInk` trong Community Applications; trên **Synology** (DSM 7.2 trở lên) dán file compose vào Container Manager, Container Station của QNAP cũng nhận đúng file đó. Không cần dòng lệnh ở máy nào: blog in đường dẫn nhận quyền ra log của container. [Từng bước, theo từng loại máy](./docs/self-host-docker.md#on-a-nas-or-a-home-server).
- **Máy nào có Docker** — kéo `quireink/quireink` về, có đủ `amd64` và `arm64`.

Đường thứ nhất cần [Bun](https://bun.sh) 1.3 trở lên và một máy trỏ tên miền vào được. Hết danh sách.

**Một lệnh**, nó tự tải mã nguồn, cài, dựng và chạy blog lên:

```bash
curl -fsSL https://raw.githubusercontent.com/joiha-steven/quireink/main/install.sh | bash
```

Nó không dùng `sudo`, không tự cài Bun sau lưng bạn, không đụng tới systemd; nó từ chối chạy dưới quyền root, và chạy lại lần nữa trên cùng thư mục thì nó cập nhật rồi dựng lại chứ không báo lỗi. Tuỳ chọn đặt trước `bash`, tức là ở đầu bên kia của ống. Đặt trước `curl` thì biến thuộc về lệnh tải chứ không tới được script:

```bash
curl -fsSL https://raw.githubusercontent.com/joiha-steven/quireink/main/install.sh \
  | SITE_URL=https://example.com QUIREINK_DIR=/srv/blog bash
```

`NO_RUN=1` để dừng lại trước bước chạy, và [bản thân cái script](./install.sh) dài 120 dòng đọc được, nếu bạn muốn xem trước khi đưa nó vào shell.

**Hoặc làm tay từng bước**, đúng những gì nó làm:

```bash
git clone https://github.com/joiha-steven/quireink.git && cd quireink
bun install
bun run build:assets && bun run build:admin     # island, rồi tới trang quản trị
DATA_DIR=./data SITE_URL=https://example.com bun src/index.ts
```

Đặt một reverse proxy có TLS trước cổng, mặc định là `3000`. Rồi đọc log. Blog chưa có chủ sẽ in ra đường dẫn để nhận blog, mỗi lần khởi động:

```
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  This blog has no owner yet. Open the link below to claim it.           │
  └─────────────────────────────────────────────────────────────────────────┘

  https://example.com/setup?token=…
```

Mở nó ra là xong phần còn lại ngay trong trình duyệt: tên đăng nhập, email, mật khẩu, rồi mã QR cho ứng dụng xác thực và mười mã khôi phục, hiện đúng một lần. Token nằm trong bộ nhớ nên khởi động lại là có token mới và dòng cũ trong log hết là bí mật; `/setup` trả 404 ngay khi đã có tài khoản. Thích dùng terminal hơn? `bun run user create --username <tên> --email <địa-chỉ>` vẫn làm đúng việc đó.


<div align="center">

<img src="docs/demo-setup.jpg" alt="Ba màn hình đầu tiên đặt cạnh nhau: Claim this blog với ô tên đăng nhập, email và mật khẩu; Your site với ngôn ngữ đứng đầu, rồi tên site, múi giờ đã điền sẵn Asia/Saigon và địa chỉ site đã điền sẵn https://example.com; và The front page với hai hình vẽ nhỏ để chọn, danh sách bài hoặc trang nhất kiểu báo" width="960">

<sub>Toàn bộ phần cài đặt sau dòng log. Múi giờ và địa chỉ đến nơi đã điền sẵn — trình duyệt biết cả hai, mà cả hai đều sai mặc định và không nói gì khi sai. Thứ <b>không</b> được hỏi mới là thiết kế: bảng màu, phông chữ, chế độ sách và các công tắc tính năng đều ở lại một thẻ trên bảng điều khiển mở lại được, vì chưa có bài nào thì chưa ai đánh giá nổi.</sub>

</div>

Xong. CSDL tự dựng ở lần khởi động đầu, nên không có bước migration nào phải nhớ. Muốn bản đầy đủ với systemd, nginx, cache header, sao lưu và nâng cấp thì xem **[`docs/self-host.md`](./docs/self-host.md)**.

> [!NOTE]
> **Chạy trực tiếp từ mã nguồn. Đó là toàn bộ việc triển khai**, và site thật cũng chạy như vậy.
> Không có tệp nhị phân đóng gói sẵn: `bun build --compile`
> bỏ sót native module của `sharp`, và một tệp nhị phân không resize được ảnh thì không phải
> thứ để đem đi triển khai
> ([ADR 0022](./docs/decisions/0022-ship-from-source-not-a-compiled-binary.md)).

<details>
<summary><b>🐳 &nbsp;Thích dùng Docker hơn?</b> &nbsp;Kéo image về, hoặc tự dựng</summary>

<br/>

**Kéo về dùng luôn.** Không cần clone, không cần Bun, không phải dựng gì, và có sẵn cho `linux/amd64` lẫn `linux/arm64`:

```bash
docker run -d --name quire -p 127.0.0.1:3000:3000 \
  -e SITE_URL=https://example.com \
  -v quire-data:/var/lib/quire/data -v quire-uploads:/var/lib/quire/uploads \
  quireink/quireink:latest
docker logs quire            # in ra đường dẫn nhận blog — mở nó trong trình duyệt
```

Cố ý dùng `:latest`: đó là bản mới nhất, và bản mới nhất là bản đã có các lỗi được sửa.
Các thẻ theo số phiên bản ở dưới dành cho ai muốn tự tay quyết định lúc nào thì đổi.

Cũng có trên GHCR là `ghcr.io/joiha-steven/quireink`: cùng một image, do cùng một lần chạy
đẩy lên và mang cùng digest, nên hai nơi không thể lệch nhau.

**Trên droplet DigitalOcean mới tinh** (hay VM Ubuntu nào có cloud-init): dán
[`deploy/digitalocean/user-data.sh`](./deploy/digitalocean/user-data.sh) vào ô
initialization script ở trang tạo droplet — ba phút sau khi máy nổ là blog đã chạy, kèm
sẵn link nhận chủ — [cách làm và lý do](./deploy/digitalocean/README.md).

**Hoặc tự dựng từ repo này**, đúng như `docker-compose.yml` làm:

```bash
cp .env.docker.example .env          # điền SITE_URL
docker compose up -d --build
docker compose logs quire            # đường dẫn nhận blog, y như trên
```

**Không có `docker exec`, không cần terminal tương tác ở đâu cả**, và đó chính là chủ ý: giao diện container của NAS có bảng xem log chứ không có TTY. Một service, hai volume, không sidecar. Cổng chỉ mở trên `127.0.0.1`, nên reverse proxy vẫn là chỗ xử lý TLS.

**Trên NAS** (Synology, QNAP, Unraid), hãy gắn thư mục thật và đặt `PUID`/`PGID` theo người sở hữu thư mục đó — container tự nhận quyền ở lần khởi động đầu và không bao giờ chạy bằng root. Ghi chú về volume, quyền sở hữu và nâng cấp nằm ở [`docs/self-host-docker.md`](./docs/self-host-docker.md).

</details>

<details>
<summary><b>🤖 &nbsp;Hoặc để agent cài giúp</b></summary>

<br/>

Đưa SSH của một máy chủ trắng cho agent và bảo nó dựng hết: clone, build, viết unit systemd và vhost nginx, tạo tài khoản, trả lại cho bạn cái URL. Không có OAuth client nào phải đăng ký, không dịch vụ nào phải mở tài khoản, nên nó làm trọn được thật.

</details>

> [!TIP]
> Tự host thì upload không bị giới hạn dung lượng, vì trình duyệt đẩy thẳng lên máy chủ của
> bạn. Đặt CDN ở trước để lo TLS và cache ở biên, và để nó tôn trọng `cache-control` mà app
> đã gửi sẵn thay vì tự áp TTL riêng.

## Để AI agent viết thay bạn (MCP)

Quire Ink có sẵn một máy chủ **MCP**, nên trợ lý soạn, sửa, gắn thẻ và đăng thẳng lên site đang chạy của bạn được. Không git, không deploy. Nó đi qua đúng đoạn code mà trang quản trị đi qua, theo cùng luật về slug, phiên bản và thùng rác.

1. **Bật lên.** *Quản trị → Cấu hình → Kết nối → MCP*, rồi tạo một token. Bạn thấy nó đúng một lần, sau đó nó được băm, và nó hết hạn sau 180 ngày.
2. **Trỏ agent** vào `https://<tên-miền-của-bạn>/api/mcp` với `Authorization: Bearer <token>`. Connector kiểu OAuth cũng chạy.
3. **Bảo nó viết bài.**

```text
Dùng máy chủ MCP của Quire Ink, viết một bài 600 chữ tựa đề
"Những gì tôi học được khi dựng blog cùng AI agent", gắn thẻ
"ai" và "writing", đặt một đoạn tóm tắt dễ chịu, rồi đăng.
```

Viết mới là một nửa. Agent còn đọc được lượng truy cập và so với tuần trước, đếm người đăng ký (không bao giờ thấy địa chỉ email của họ), quét bình luận rác (vào thùng rác, không mất hẳn), tìm khắp kho bài, và cho bạn biết có bản mới chưa. Nó cũng trông nom được: sắp lại trang nhất theo bài người ta thật sự đọc, đổi diện mạo trong bộ màu và font đã tuyển sẵn, trả lời bình luận nhân danh bạn, gửi bản tin thử về đúng hộp thư của bạn, và sao lưu trước khi làm gì lớn. Màu tự do là thứ duy nhất nó không được đụng, vì agent không có mắt. [Sổ tay agent](./docs/agent-cookbook.md) gom sẵn những câu lệnh làm việc thật: báo cáo sáng thứ Hai, nháp bản tin, rà kho bài.

Các cấu hình nhạy cảm bị chặn qua MCP, và quyền vẫn nằm ở bạn. Thu hồi token trong trang quản trị là nó chết ngay.

Kho mã này còn dạy luôn cho agent. Ba bộ kỹ năng nằm sẵn trong `.claude/skills/`, nên một trợ lý vừa clone kho về là đã biết cách dựng một blog, vận hành nó qua MCP, và dọn nhà từ WordPress, Ghost, Substack hay Medium sang. Bộ nhập tự viết chuyển hướng cho URL cũ và tự tải ảnh về; kỹ năng này lo phần còn lại, bắt đầu từ danh sách ảnh không tải được. Không phải cài gì thêm: clone về rồi hỏi. [Chúng gồm những gì](./docs/agent-ready.md#skills-that-ship-in-the-repository).

## Biến môi trường

Đây là những thứ duy nhất nằm ngoài trang quản trị.

| Biến | Bắt buộc | Nó làm gì |
|---|:---:|---|
| `DATA_DIR` | ✅ | Chỗ để `quire.db` và `analytics.db`. Mặc định `./data` |
| `SITE_URL` | ✅ | Địa chỉ công khai của bạn, dùng trong feed, ảnh OG và email. Để trống thì tất cả những chỗ đó ghi `http://localhost:3000` — site vẫn đọc bình thường, chỉ crawler và trình đọc mail là nhận ra. Nó cố ý không được đoán từ request |
| `STORAGE_LOCAL_DIR` | ◻️ | Chỗ để tệp tải lên, phục vụ ở `/uploads`. Mặc định `./uploads` |
| `PORT` | ◻️ | Mặc định `3000` |
| `HOST` | ◻️ | Nghe trên interface nào. Mặc định `127.0.0.1`, đúng khi reverse proxy đứng cùng máy. Đặt `0.0.0.0` khi không phải vậy — máy khác, hoặc container cần với tới từ bên ngoài |
| `MAX_UPLOAD_MB` | ◻️ | Tệp tải lên lớn nhất được nhận. Mặc định `64`, khớp `client_max_body_size` trong vhost mẫu để hai bên từ chối cùng một tệp. `0` = không giới hạn |
| `STORAGE_QUOTA_GB` | ◻️ | Thư mục upload được phình tối đa bao nhiêu, tính cả các bản thu nhỏ cắt từ mỗi ảnh. Mặc định `5`; tệp nào đưa nó vượt mức là bị từ chối. `0` = không giới hạn |
| `CRON_SECRET` | ◻️ | Canh `/api/cron`, chỗ đăng bài hẹn giờ và dọn biến thể ảnh |
| `PURGE_WEBHOOK_URL` | ◻️ | Địa chỉ mà blog sẽ POST tới mỗi lần nó dọn cache của chính nó, dành cho CDN không phải Cloudflare ([ADR 0033](./docs/decisions/0033-purging-an-edge-that-is-not-cloudflare.md)). Bình thường thì nhập trong Cấu hình → Tích hợp |
| `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` (+`S3_ENDPOINT`, `S3_REGION`, `S3_PREFIX`) | ◻️ | Bucket chuẩn S3 nhận thêm một bản của mỗi snapshot ([ADR 0035](./docs/decisions/0035-the-snapshot-leaves-the-machine.md)). Bình thường nhập ở Cấu hình → Hệ thống |
| `CRON_INTERNAL` | ◻️ | Đặt `0` để tiến trình KHÔNG tự chạy đồng hồ bảo trì, khi bạn muốn tự hẹn giờ gọi `/api/cron`. Mặc định là bật, theo [ADR 0031](./docs/decisions/0031-the-blog-winds-its-own-clock.md); nó không bao giờ chạy dưới `bun test` hay `bun --watch` |
| `MCP_OAUTH_SECRET` | ◻️ | Ký mã OAuth của MCP. Bỏ trống thì máy chủ tự sinh lấy, và đó là cách nên dùng |
| `ANALYTICS_TZ` | ◻️ | Múi giờ MẶC ĐỊNH của site, dùng cho tới khi có người chọn ở **Settings → Site → Múi giờ**. Setting đó là đồng hồ của cả site — ngày dưới mỗi bài, mốc tháng, và ngày bắt đầu của biểu đồ thống kê — và nó tồn tại vì trang được dựng một lần rồi cache, nên không có nó thì múi giờ của MÁY CHỦ quyết định người đọc thấy ngày nào. Mặc định UTC |
| `TRUST_PROXY` | ◻️ | Chỉ đặt `1` khi proxy đứng trước đi tới bạn qua một địa chỉ CÔNG KHAI. Giới hạn tần suất tính theo địa chỉ socket; `CF-Connecting-IP`/`X-Forwarded-For` được tin tự động khi kết nối đến từ loopback hoặc mạng nội bộ |
| `UPDATE_CHECK` | ◻️ | Đặt `0` để tắt cú gọi duy nhất mà phần mềm này tự thực hiện: mỗi ngày một lần, vào lượt khách đầu tiên — hoặc theo nhịp đồng hồ hằng giờ của chính blog nếu hôm đó không ai ghé — blog hỏi bản mới nhất là bản nào, và chính lúc hỏi thì được đếm là một blog đang được dùng. Thứ gửi đi là phiên bản đang chạy, một mã sinh lại theo ngày mới mỗi nửa đêm, blog đã có tên miền thật hay chưa, và bốn nấc thô: blog dựng bao lâu rồi, đăng nhiều hay ít bài, chạy bằng `docker` hay `source`, và màn hình quản trị đang dùng tiếng gì. Không có địa chỉ, bài viết, người đọc hay con số chính xác nào của bạn. Mặc định bật, và tự im khi chạy `bun --watch` hoặc `bun test` — một buổi chiều của thợ không phải một lượt cài. [Toàn bộ nội dung cú gọi viết ở đây](./docs/update-check.md). Chủ blog có đúng công tắc đó ở Cài đặt → Hệ thống |

SMTP, Turnstile và thông tin CDN nhập ở **Cấu hình → Kết nối** và nằm lại trên máy chủ. Bài của bạn sống trong `DATA_DIR` và thư mục upload, không bao giờ nằm trong git.

## Bản dịch

Giao diện nói **mười một thứ tiếng**, cả phía người đọc lẫn trang quản trị: English, Tiếng Việt, Deutsch, 日本語, 简体中文, 한국어, Français, Español, Português (Brasil), Italiano và Русский. Câu hỏi đầu tiên khi cài đặt là blog này nói tiếng gì.

**Mời bạn góp bản dịch.** Mỗi ngôn ngữ là một thư mục ngay gốc repo: [`locales/`](./locales). Muốn sửa một bản dịch, mở `locales/<mã>.ts` (chữ người đọc thấy) và `locales/admin/<mã>.ts` (chữ chủ blog thấy). Đều là file chữ thuần, không cần biết lập trình. Muốn thêm ngôn ngữ mới: chép đôi file `en`, dịch, rồi đăng ký mã trong `locales/langs.ts` + `src/types.ts`; trình biên dịch từ chối build khi còn thiếu một chuỗi, nên bản dịch dở dang không thể lọt ra ngoài. Rất hoan nghênh pull request: tai người bản xứ vẫn hơn tai chúng tôi.

## Chạy để phát triển

```bash
bun install
bun run build:admin                 # một lần, và mỗi khi src/admin đổi
bun run dev                         # http://localhost:3000
# log in ra đường dẫn /setup để nhận blog; hoặc: bun run user create --username me --email me@example.com
```

Chưa qua `bun run check:all` thì chưa xong. Nó typecheck, chạy các guard tĩnh và chạy test, tất cả offline, không cần thông tin đăng nhập, không cần dịch vụ nào. Bắt đầu ở [`CONTRIBUTING.md`](./CONTRIBUTING.md), từ đó dẫn tới luật nhà trong [`CLAUDE.md`](./CLAUDE.md).

| Ở đâu | Có gì trong đó |
|---|---|
| `src/` | Toàn bộ: Bun, Hono, SQLite. [Các mảnh ghép vào nhau ra sao](./docs/spec/02-structure.md) |
| `docs/` | Nó chạy thế nào và vì sao. [`docs/README.md`](./docs/README.md) là mục lục; [`docs/decisions/`](./docs/decisions/README.md) là mọi quyết định, kể cả những cái đã bị đảo ngược |
| `golden/` | Hợp đồng render. Lệch một byte đầu ra là build đỏ |
| `scripts/checks/` | Các guard. Đăng ký một route ghi ngoài nhóm chỉ-chủ-sở-hữu là build dừng, y như viết cứng một cỡ chữ trong stylesheet trang đọc |

Dự định sắp tới nằm cùng chỗ với ghi chú riêng của tác giả chứ không ở đây, vì đó là ý định
của một người cho một cái blog, không phải lời hứa với ai đang chạy phần mềm này
([ADR 0017](./docs/decisions/0017-move-state-and-instance-config-private.md)). Cái gì đã ra
rồi thì xem [changelog](./CHANGELOG.md).

## Giấy phép

Hai thứ khác nhau, và chúng không chung điều khoản.

**Mã nguồn ở đây** theo [PolyForm Noncommercial 1.0.0](./LICENSE), cộng thêm [một cho phép bổ sung](./LICENSE-EXCEPTION.vi.md). Xem được mã nguồn, nhưng không phải open source. Gộp lại thì gọn trong một câu: **cứ chạy, và cứ thu tiền, miễn là bản bạn chạy đúng là bản phát hành ở đây.**

**Phi thương mại: được tất.** Blog của bạn, một dự án chơi cho vui, học tập, nghiên cứu, và cả tổ chức từ thiện, trường học, viện nghiên cứu công và cơ quan nhà nước. Cứ đọc, sửa, tự host, fork, chuyển cho người khác. Chỉ cần giữ nguyên văn bản giấy phép và dòng `Required Notice:` kèm theo mỗi bản bạn đưa đi.

**Thương mại: được, nếu không sửa code.** Chạy cho doanh nghiệp, chạy cho khách hàng, bán hosting mà mỗi khách có một cái blog Quire Ink riêng. Đổi lại bốn điều: chạy đúng một bản phát hành với mã nguồn nguyên vẹn, giữ nguyên các dòng ghi chú bản quyền, nói rõ dịch vụ của bạn chạy trên Quire Ink kèm link về đây, và bán dịch vụ chứ không bán phần mềm. Cấu hình, bảng màu, font và nội dung không tính là mã nguồn, vì ở đây giao diện là tuỳ chọn chứ không phải chỗ phải fork. Đủ chi tiết nằm trong [`LICENSE-EXCEPTION.vi.md`](./LICENSE-EXCEPTION.vi.md), ngắn thôi.

**Bản đã sửa code đem đi kinh doanh thì cần giấy phép riêng.** Đây là ranh giới duy nhất dự án giữ lại: sửa code rồi đem bán, hoặc chạy một bản đã sửa thành dịch vụ, thì phải hỏi trước. Vá lỗi hay bịt lỗ hổng bảo mật trên bản cài của chính bạn thì được miễn. Cứ vá, và báo cho chủ sở hữu trong vòng 30 ngày. Hỏi bằng cách mở một issue, hoặc qua [trang GitHub của chủ sở hữu](https://github.com/joiha-steven).

**Những gì bạn viết vẫn là của bạn.** Bài và ảnh của bạn không thuộc giấy phép mã nguồn và không nằm trong repo này.

> **Mọi thứ tính tới hết v2.0.0 là MIT, và mãi mãi là MIT.** Đổi giấy phép không có hiệu lực
> lùi: bản nào lấy về trước lần đổi này thì giữ nguyên quyền mà nó đã được trao. Xem
> [ADR 0015](./docs/decisions/0015-relicense-polyform-noncommercial.md).
