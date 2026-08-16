<div align="center">

# quire**INK** &nbsp;`2.0.3`

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

[**Xem thử**](https://demo.quireink.com) · [**Cài đặt**](#cài-đặt) · [**Tốc độ**](#tốc-độ) · [**Để agent viết**](#để-ai-agent-viết-thay-bạn-mcp) · [**Changelog**](./CHANGELOG.md) · [**Giấy phép**](#giấy-phép)

<br/>

<img src="docs/demo.jpg" alt="Hai ảnh chụp cạnh nhau: trang chủ dạng báo với bài dẫn và các hàng chuyên mục, và trang bài viết của cùng site với cột mục lục bên trái và cột thông tin bên phải" width="960">

<sub>**[demo.quireink.com](https://demo.quireink.com)** là bản thật, chạy được. Không đăng ký, không phải điền gì. Dùng thanh dưới đáy để nhảy qua lại giữa trang chủ dạng báo, danh sách bài, một bài viết, chế độ sách, sáng và tối, và trang quản trị. Thanh đó là thứ duy nhất được thêm vào, và nó nằm ngoài mã nguồn, nên trang demo luôn là bản mới nhất.</sub>

</div>

---

## Nó là gì

Bạn viết, nó đăng, và mọi thứ nằm trên máy chủ của bạn.

Mục này viết cho người không rành kỹ thuật. Phần còn lại của trang là cho người sẽ đi dựng nó.

**Nó là một cái blog, đúng nghĩa đen.** Có trang chủ, bài viết, chuyên mục, ô tìm kiếm, phần bình luận, và bản tin tự gửi email cho người theo dõi mỗi khi bạn đăng bài. Cái nó không có: thuật toán quyết định ai được đọc bài bạn, quảng cáo chen ngang, và một công ty có thể đổi luật chơi hoặc đóng cửa vào một ngày nào đó.

**Bạn chỉnh nó bằng cách bấm, không phải bằng cách viết code.** Màu, font, cỡ chữ, bố cục trang chủ, menu — tất cả nằm trong trang quản trị, đăng nhập bằng tài khoản riêng của bạn, và dùng được cả trên điện thoại.

**Trang đọc nhẹ khác thường.** Mở một bài viết tốn khoảng 114 KB — một tấm ảnh chụp bằng điện thoại còn nặng gấp vài chục lần. Người đọc ở chỗ sóng yếu, cầm máy đời cũ, vẫn thấy chữ hiện ra gần như tức thì. Đây là số đo thật chứ không phải lời quảng cáo: [xem bảng](#tốc-độ).

**Đọc cho dễ chịu là chủ đích của cả dự án.** Sáu bảng màu sáng và tối, bốn font đọc, chế độ sách dàn hai cột như trang giấy, và bút dạ quang năm màu mực để tô những câu tâm đắc.

**AI có thể viết và đăng thay bạn.** Nối Claude (hoặc một trợ lý AI khác) vào blog rồi bảo: *"viết một bài 600 chữ về chuyến đi hôm nay, gắn thẻ du lịch, đăng lên"*. Nó soạn và đăng qua đúng những luật mà bạn đang dùng, và bạn thu hồi quyền của nó lúc nào cũng được.

**Cần gì để bắt đầu.** Một tên miền, và một máy chủ thuê ngoài — loại rẻ nhất là đủ. Lần dựng đầu tiên là việc kỹ thuật: nhờ một người biết về máy chủ, hoặc giao hẳn cho một AI agent làm hộ ([mục Cài đặt](#cài-đặt)). Sau đó thì việc hằng ngày — viết, đăng, đổi giao diện, xem thống kê — đều nằm trong trang quản trị; chỉ khi nâng cấp lên bản mới mới cần chạm lại vào dòng lệnh.

**Đổi lại, bạn tự giữ nhà mình.** Không ai sao lưu hộ bạn — có sẵn một nút tải nguyên cả blog về máy, nhưng bấm nó là việc của bạn — và blog sống theo cái máy chủ bạn thuê.

**Miễn phí, và bạn được thu tiền.** Blog cá nhân thì không tốn gì. Dùng trong doanh nghiệp, hay bán dịch vụ host cho mỗi khách một cái blog, cũng được — miễn là bản bạn chạy đúng là bản phát hành ở đây. Chỉ bản *đã sửa code* đem đi kinh doanh mới phải hỏi trước: [xem mục Giấy phép](#giấy-phép).

**Không hợp với ai.** Một toà soạn cần phân vai, duyệt bài và hàng đợi biên tập. Quire Ink cố ý chỉ có một chủ.

---

## Bên dưới nắp máy

Không có CSDL nào phải cài, cũng không có gì phải deploy. Trỏ tên miền vào một câu lệnh là bạn có một cái blog:

```bash
bun src/index.ts
```

Có ba thứ định hình nó.

**Trang đọc mới là sản phẩm.** Font, màu, cỡ chữ, khoảng cách, bố cục: tất cả đều là tuỳ chọn bạn chỉnh trong trang quản trị. Không một cỡ chữ hay màu nào viết cứng trong stylesheet của trang đọc, và build sẽ báo đỏ nếu ai đó nhét vào.

**Người đọc tải về 3.6–7.8 KB JavaScript, và không tải gì từ bên thứ ba.** Trang tới nơi đã là HTML hoàn chỉnh. Vài đoạn script nhỏ lo tìm kiếm, đổi giao diện và chế độ sách. React nằm yên trong trang quản trị, không bao giờ chạm tới người đọc.

**Agent viết được thay bạn.** Nối Claude hay bất kỳ client MCP nào vào, nó soạn được, gắn thẻ được, hẹn giờ và đăng được, theo đúng những luật mà trang quản trị đang theo.

Bạn được đọc, sửa, chạy và fork theo [PolyForm Noncommercial](./LICENSE), và được chạy bản phát hành để kinh doanh — kể cả bán hosting — theo [một cho phép bổ sung](./LICENSE-EXCEPTION.vi.md).

> **2.0.3 ra ngày 15/08/2026**, đang chạy bản demo ở trên và blog riêng của tác giả tại
> [manhhung.me](https://manhhung.me). Bản này gộp luôn 2.0.2, nên chỉ còn một bản để đọc.
> Ba mươi tám commit: một đợt rà soát phát hiện không có giới hạn dung lượng tải lên, không
> có hạn mức lưu trữ, và một máy chủ lắng nghe trên mọi giao diện mạng dưới một dòng log nói
> ngược lại; một giới hạn tần suất mà header giả mạo đi qua được; và phần quản trị lâu nay
> mặc bộ đồ của một framework dashboard chứ không phải của chính sản phẩm này. Gần như tất
> cả đều tìm ra bằng cách **đo site đang chạy** chứ không phải đọc mã nguồn.
> [Changelog](./CHANGELOG.md) có đủ những gì đã đổi.

---

## Bạn được gì

| | |
|:---|:---|
| 🖋️&nbsp;**Viết** | Trình soạn thật trên nền Markdown — bảng, video, chú thích chân trang, khung nhấn, **công thức toán**, Spotify. Thả ảnh vào là nó tự cắt cho mọi cỡ màn hình. Lưu trong lúc gõ, giữ ba bản, và giữ bài lại tới sáng thứ Ba. Xem mã Markdown thì dấu cú pháp tự mờ đi |
| 🏠&nbsp;**Trang&nbsp;chủ** | Danh sách bài, một trang bạn tự viết, hoặc trang dựng sẵn: bài dẫn, vài bài chọn, một hàng cho mỗi chuyên mục, bài đọc nhiều. Hợp cả site nhiều ảnh lẫn site chỉ có chữ. [Cách hoạt động](./docs/homepage.md) |
| 🎨&nbsp;**Giao&nbsp;diện** | Sáu bảng màu, sáng và tối. Bốn font đọc, hoặc tải font của bạn lên. Mọi cỡ chữ đều sinh ra từ một vai trò, nên sửa một chỗ là cả trang đổi chứ không phải một tiêu đề |
| 🖍️&nbsp;**Bút&nbsp;dạ** | `==chữ==` với năm màu mực. Không phải ô màu — là nét SVG đầu vát, ngắt theo từng dòng, màu đo từ ảnh chụp một hộp bút thật. Tốn 1,4&nbsp;KB, và không tốn gì nếu bạn không dùng |
| 💻&nbsp;**Code** | Tô màu ở máy chủ, người đọc không tải bộ tô màu nào. Hai mươi mốt ngôn ngữ, và những tên hay gõ (`typescript`, `sh`) đều nhận ra. Hàng rào không ghi ngôn ngữ thì được đoán — đoán dè dặt, để output của chương trình vẫn để trơn |
| 🔍&nbsp;**Đọc** | Tìm kiếm trả lời ngay trong lúc gõ. Cột bên có chuyên mục và thẻ, hoặc mục lục của bài đang đọc. Bài liên quan, thời gian đọc, thanh tiến độ. Và **chế độ sách**: hai cột trên nền giấy, có chữ cái đầu lớn |
| 📈&nbsp;**Số&nbsp;liệu** | Thống kê không dùng cookie. Ai đọc bài nào, đọc tới đâu, đến từ đâu. Kèm nhật ký hoạt động, thùng rác hoàn tác được, và một trang trợ giúp |
| 🔎&nbsp;**Máy&nbsp;tìm&nbsp;kiếm** | Sitemap, RSS, `robots.txt`, `llms.txt`, và ảnh chia sẻ vẽ riêng cho từng bài. Đổi đường dẫn thì link cũ vẫn tự chạy |
| 📬&nbsp;**Bản&nbsp;tin** | Đăng ký có email xác nhận, một số gửi đi khi bạn đăng bài, và một lời nhắn khi bình luận được trả lời. SMTP của riêng bạn |
| 📚&nbsp;**Loạt&nbsp;bài** | Viết thành nhiều phần, đánh số, và phần nào cũng chỉ ra các phần kia |
| 💾&nbsp;**Sao&nbsp;lưu** | Một nút tải về nguyên cả bản cài, và một script cron đẩy nó ra khỏi máy chủ. [Chi tiết](./docs/backups.md) |
| 📥&nbsp;**WordPress** | Tải tệp XML export lên. Bài và trang ra thành Markdown |
| 🌍&nbsp;**Ngôn&nbsp;ngữ** | Sáu thứ tiếng, cả trong quản trị lẫn ngoài site. Không kèm webfont CJK nào — chúng nặng hàng megabyte — nhưng mỗi thứ tiếng gọi tên mặt chữ riêng, nên 直 được vẽ theo lối Nhật trên site tiếng Nhật |
| 🔐&nbsp;**Đăng&nbsp;nhập** | Tên và mật khẩu của riêng bạn, băm bằng argon2id. Mã xác thực mỗi lần vào, và mười mã khôi phục cho ngày mất điện thoại. Không có Google trong đường đăng nhập |
| 📱&nbsp;**Điện&nbsp;thoại** | Cài ra màn hình chính là nó mở như một ứng dụng |

**Làm cho** một người, một máy chủ, một cái blog định giữ lâu dài.
**Không làm cho** một đội cần phân vai, duyệt bài và hàng đợi biên tập. Nó cố ý chỉ có một chủ.

<div align="center">

<img src="docs/demo-reading.jpg" alt="Chế độ sách: trình đọc hai cột toàn màn hình trên nền giấy, có chữ cái đầu lớn và số trang, bên cạnh là một bài viết ở giao diện tối" width="960">

<sub>Chế độ sách và giao diện tối. Không cái nào là một lớp lọc phủ lên trang. Cả hai đều là chính hệ typography của trang đọc. Font đi kèm có sẵn dấu tiếng Việt và dấu của các tiếng Trung Âu, nên khối mẫu chữ bên trái hiện đúng font chứ không rơi về font hệ thống.</sub>

<img src="docs/demo-code.jpg" alt="Ba ảnh chụp: một công thức chặn trên độ trôi của thang chữ sau khi làm tròn, dựng bằng MathML trong font đọc; phần code của cùng site, một khối được tô màu nhờ tên ngôn ngữ và một khối bên dưới không ghi ngôn ngữ, chỉ đánh dấu phần trong ngoặc kép và tên biến có dấu đô la; và ba vệt bút dạ vàng, xanh, hồng" width="960">

<sub>Công thức toán là MathML, do chính trình duyệt dựng — không script, không stylesheet, không file font, nên một bài có công thức không tốn thêm gì so với bài không có. Code cũng tô màu ở máy chủ, cùng một lý do; khối phía dưới không ghi ngôn ngữ nên không ai bịa màu cho nó, chỉ đánh dấu những gì đúng trong mọi ký pháp. Bút dạ là nét SVG ngắt theo từng dòng, có năm màu mực.</sub>

</div>

---

## Tốc độ

Đây là số đo từ mạng, lần vào đầu tiên, chưa cache gì. Đúng bằng cái mà một người lạ cầm điện thoại phải chờ.

Hai dòng CSS và JavaScript là sản phẩm của bản build — giống nhau ở mọi bản cài — và lấy từ bản dựng 2.0.3 — 2.0.2 lẫn 2.0.3 đều không làm chúng nhúc nhích. Các số tổng đo cho 2.0.1, tại origin chứ không qua CDN, và là của chính site này: tiếng Việt, Literata để đọc và JetBrains Mono cho phần khung. Chúng không phải thuộc tính của phần mềm, vì font được cắt theo bảng chữ và trình duyệt chỉ tải đúng những dải mà trang bạn dùng tới. Riêng font đã giảm từ 86 KB xuống 67 KB ở 2.0.1 mà không bỏ đi họ chữ nào.

| | Trang chủ | Một bài | |
|:---|---:|---:|:---|
| **Số&nbsp;request** | 10 | 10 | |
| **Tổng&nbsp;tải&nbsp;về** | **106&nbsp;KB** | **114&nbsp;KB** | 67&nbsp;KB trong đó là font |
| **JavaScript** | **3.6&nbsp;KB** | **7.8&nbsp;KB** | viết tay, không framework |
| **CSS** | 8.0&nbsp;KB | 8.0&nbsp;KB | một tệp, đã nén, cache vĩnh viễn |
| **Request&nbsp;bên&nbsp;thứ&nbsp;ba** | **0** | **0** | không CDN, không font host, không tracker |
| **Lần&nbsp;vào&nbsp;sau** | ~19&nbsp;KB | ~24&nbsp;KB | chỉ tải lại HTML |

Nó giữ được như vậy nhờ vài quyết định khó đảo ngược.

**Mỗi gói JS có một hạn mức dung lượng do build canh.** Vượt là build đỏ. Một tính năng không thể lặng lẽ bắt mọi người đọc trả thêm một chút, mãi mãi.

**Cache trang là một `Map` duy nhất, và bất kỳ lần ghi nào cũng xoá sạch nó.** Cả luật chỉ có vậy, nên không có chỗ nào để sai một cách tinh vi. Trượt cache thì tốn một lần đọc SQLite cộng một lần render, dưới một phần nghìn giây.

**Markdown đã render được lưu theo hash của đầu vào.** Không bao giờ phải invalidate cái gì. Một bài dài từ 383 ms xuống 1 ms.

**Font là của bạn, cắt gọn theo từng ngôn ngữ, và chỉ preload đúng bộ mà trang này cần.** Ghim một trục của variable font đưa bộ preload từ 97.6 KB xuống 46.2 KB.

**Hiệu ứng hiện dần và thanh tiến độ là CSS thuần.** Không script, không chạy trên main thread, và trình duyệt cũ thì đơn giản là hiện chữ ra luôn.

<div align="center">

<img src="docs/demo-mobile.jpg" alt="Ba màn hình điện thoại: danh sách bài, một bài viết đang hiện mục lục của loạt bài, và lớp tìm kiếm tức thì mới gõ dở đã lọc kho bài xuống còn những tựa khớp" width="960">

<sub>Không con số nào ở trên là để lấy điểm benchmark. Chúng dành cho một người cầm chiếc điện thoại bốn năm tuổi, chỉ muốn đọc bốn trăm chữ.</sub>

</div>

---

## Vì sao không dùng thứ khác

**Thay vì một nền tảng có sẵn.** Bài của bạn là hai tệp SQLite trên ổ đĩa của chính bạn. Không tài khoản, không gói cước, không có cái nút export mà bạn phải cầu cho nó vẫn chạy sau năm năm.

**Thay vì WordPress.** Không PHP, không MySQL, không đống plugin phải vá. Một tiến trình, và người đọc nhận JavaScript chỉ vài KB.

**Thay vì một static site generator.** Bạn có trang quản trị thật. Viết, tải ảnh, hẹn giờ và đăng từ laptop hay điện thoại, với tìm kiếm, bình luận, bản tin và thống kê đã có sẵn. Không build lại, không deploy, không phải git push chỉ để sửa một lỗi chính tả.

**Thay vì tự viết lấy.** Nửa phần chán đã làm xong và có test: đăng nhập TOTP, phiên, cắt ảnh, feed, ảnh OG, redirect, hoàn tác khi xoá, lịch sử phiên bản, sao lưu, bộ nhập từ WordPress, sáu ngôn ngữ.

<div align="center">

<img src="docs/demo-admin.jpg" alt="Trang quản trị Quire Ink: trình soạn bài với bảng thuộc tính, và trang cấu hình giao diện với sáu bảng màu và bốn font đọc" width="960">

<sub>Bảng màu, font, cỡ chữ, bố cục, menu. Tất cả đều là tuỳ chọn, không có cái nào là code.</sub>

</div>

---

## Cài đặt

Bạn cần [Bun](https://bun.sh) 1.3 trở lên và một máy trỏ tên miền vào được. Hết danh sách.

```bash
git clone https://github.com/joiha-steven/quireink.git && cd quireink
bun install
bun run build:assets && bun run build:admin     # island, rồi tới trang quản trị
DATA_DIR=./data SITE_URL=https://example.com bun src/index.ts
```

Đặt một reverse proxy có TLS trước cổng, mặc định là `3000`. Rồi tạo tài khoản:

```bash
bun run user create --username <tên> --email <địa-chỉ>   # in ra mã TOTP và mã khôi phục, đúng một lần
```

Xong. CSDL tự dựng ở lần khởi động đầu, nên không có bước migration nào phải nhớ. Muốn bản đầy đủ với systemd, nginx, cache header, sao lưu và nâng cấp thì xem **[`docs/self-host.md`](./docs/self-host.md)**.

> [!NOTE]
> **Chạy trực tiếp từ mã nguồn — đó là toàn bộ việc triển khai**, và site thật cũng chạy như vậy.
> Không có tệp nhị phân đóng gói sẵn: `bun build --compile`
> bỏ sót native module của `sharp`, và một tệp nhị phân không resize được ảnh thì không phải
> thứ để đem đi triển khai
> ([ADR 0022](./docs/decisions/0022-ship-from-source-not-a-compiled-binary.md)).

<details>
<summary><b>🐳 &nbsp;Thích dùng Docker hơn?</b> &nbsp;Hai câu lệnh</summary>

<br/>

```bash
cp .env.docker.example .env          # điền SITE_URL
docker compose up -d --build
docker compose exec quire bun run user create --username you --email you@example.com
```

Một service, hai volume, không sidecar. Cổng chỉ mở trên `127.0.0.1`, nên reverse proxy vẫn là chỗ xử lý TLS. Ghi chú về volume, quyền sở hữu và nâng cấp nằm ở [`docs/self-host.md`](./docs/self-host.md#9-docker-instead-of-systemd).

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

---

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

Các cấu hình nhạy cảm bị chặn qua MCP, và quyền vẫn nằm ở bạn. Thu hồi token trong trang quản trị là nó chết ngay.

---

## Biến môi trường

Đây là những thứ duy nhất nằm ngoài trang quản trị.

| Biến | Bắt buộc | Nó làm gì |
|---|:---:|---|
| `DATA_DIR` | ✅ | Chỗ để `quire.db` và `analytics.db`. Mặc định `./data` |
| `SITE_URL` | ✅ | Địa chỉ công khai của bạn, dùng trong feed, ảnh OG và email. Để trống thì app tự đoán theo từng request, và sau proxy là đoán sai |
| `STORAGE_LOCAL_DIR` | ◻️ | Chỗ để tệp tải lên, phục vụ ở `/uploads`. Mặc định `./uploads` |
| `PORT` | ◻️ | Mặc định `3000` |
| `CRON_SECRET` | ◻️ | Canh `/api/cron`, chỗ đăng bài hẹn giờ và dọn biến thể ảnh |
| `MCP_OAUTH_SECRET` | ◻️ | Ký mã OAuth của MCP. Bỏ trống thì máy chủ tự sinh lấy, và đó là cách nên dùng |
| `ANALYTICS_TZ` | ◻️ | Múi giờ để tính mốc sang ngày của thống kê. Mặc định UTC |
| `TRUST_PROXY` | ◻️ | Chỉ đặt `1` khi proxy đứng trước đi tới bạn qua một địa chỉ CÔNG KHAI. Giới hạn tần suất tính theo địa chỉ socket; `CF-Connecting-IP`/`X-Forwarded-For` được tin tự động khi kết nối đến từ loopback hoặc mạng nội bộ |

SMTP, Turnstile và thông tin CDN nhập ở **Cấu hình → Kết nối** và nằm lại trên máy chủ. Bài của bạn sống trong `DATA_DIR` và thư mục upload, không bao giờ nằm trong git.

---

## Chạy để phát triển

```bash
bun install
bun run build:admin                 # một lần, và mỗi khi src/admin đổi
bun run dev                         # http://localhost:3000
bun run user create --username me --email me@example.com   # rồi đăng nhập ở /login
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

---

## Giấy phép

Hai thứ khác nhau, và chúng không chung điều khoản.

**Mã nguồn ở đây** theo [PolyForm Noncommercial 1.0.0](./LICENSE), cộng thêm [một cho phép bổ sung](./LICENSE-EXCEPTION.vi.md). Xem được mã nguồn, nhưng không phải open source. Gộp lại thì gọn trong một câu: **cứ chạy, và cứ thu tiền, miễn là bản bạn chạy đúng là bản phát hành ở đây.**

**Phi thương mại: được tất.** Blog của bạn, một dự án chơi cho vui, học tập, nghiên cứu, và cả tổ chức từ thiện, trường học, viện nghiên cứu công và cơ quan nhà nước. Cứ đọc, sửa, tự host, fork, chuyển cho người khác. Chỉ cần giữ nguyên văn bản giấy phép và dòng `Required Notice:` kèm theo mỗi bản bạn đưa đi.

**Thương mại: được, nếu không sửa code.** Chạy cho doanh nghiệp, chạy cho khách hàng, bán hosting mà mỗi khách có một cái blog Quire Ink riêng. Đổi lại bốn điều: chạy đúng một bản phát hành với mã nguồn nguyên vẹn — cấu hình, bảng màu, font và nội dung không tính là mã nguồn, vì ở đây giao diện là tuỳ chọn chứ không phải chỗ phải fork — giữ nguyên các dòng ghi chú bản quyền, nói rõ dịch vụ của bạn chạy trên Quire Ink kèm link về đây, và bán dịch vụ chứ không bán phần mềm. Đủ chi tiết nằm trong [`LICENSE-EXCEPTION.vi.md`](./LICENSE-EXCEPTION.vi.md), ngắn thôi.

**Bản đã sửa code đem đi kinh doanh thì cần giấy phép riêng.** Đây là ranh giới duy nhất dự án giữ lại: sửa code rồi đem bán, hoặc chạy một bản đã sửa thành dịch vụ, thì phải hỏi trước. Vá lỗi hay bịt lỗ hổng bảo mật trên bản cài của chính bạn thì được miễn — cứ vá, và báo cho chủ sở hữu trong vòng 30 ngày. Hỏi bằng cách mở một issue, hoặc qua [trang GitHub của chủ sở hữu](https://github.com/joiha-steven).

**Những gì bạn viết vẫn là của bạn.** Bài và ảnh của bạn không thuộc giấy phép mã nguồn và không nằm trong repo này.

> **Mọi thứ tính tới hết v2.0.0 là MIT, và mãi mãi là MIT.** Đổi giấy phép không có hiệu lực
> lùi: bản nào lấy về trước lần đổi này thì giữ nguyên quyền mà nó đã được trao. Xem
> [ADR 0015](./docs/decisions/0015-relicense-polyform-noncommercial.md).
