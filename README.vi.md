<div align="center">

# quire**INK** &nbsp;`2.0.0`

**Nền tảng blog tự host, và một AI agent có thể vận hành thay bạn.**
Một tiến trình, hai tệp SQLite, không có tài khoản đám mây nào trong đường đi.

<br/>

![Bun](https://img.shields.io/badge/Bun-000000?logo=bun&logoColor=white)
![Hono](https://img.shields.io/badge/Hono-e36002?logo=hono&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003b57?logo=sqlite&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?logo=typescript&logoColor=white)
![React 19](https://img.shields.io/badge/React_19-20232a?logo=react&logoColor=61dafb)
![MCP](https://img.shields.io/badge/MCP-ready-7c3aed)
![License: PolyForm Noncommercial](https://img.shields.io/badge/License-PolyForm_Noncommercial-22c55e)

[English](./README.md) · **Tiếng Việt**

[**Bản demo**](https://demo.quireink.com) · [**Cài đặt**](#cài-đặt) · [**Số đo**](#nhanh-và-đây-là-số-đo) · [**Giao cho agent**](#để-ai-agent-viết-và-đăng-bài-mcp) · [**Kiến trúc**](./docs/spec/02-structure.md) · [**Changelog**](./CHANGELOG.md) · [**Giấy phép**](#giấy-phép)

<br/>

<img src="docs/demo.jpg" alt="Hai ảnh chụp cạnh nhau: trang chủ dạng báo với bài dẫn và các hàng chuyên mục, và trang bài viết của cùng site với cột mục lục bên trái" width="960">

<sub>**[demo.quireink.com](https://demo.quireink.com)** chạy đúng bản này, đặt lại mỗi tháng, không cần đăng nhập và không phải điền gì. Thanh dưới đáy chuyển qua lại giữa trang chủ dạng báo, danh sách, một bài viết, chế độ sách, hai bảng màu và trang quản trị. Thanh đó không thuộc sản phẩm: trang demo chạy nguyên mã nguồn bên dưới, nên nó luôn là bản mới nhất và không có nhánh preview nào phải giữ cho khớp.</sub>

</div>

---

## Đây là cái gì

Một blog cho **một người muốn viết và muốn sở hữu trọn bộ**. Không SaaS, không khoá chân vào
nhà cung cấp, và từ bản 2.0 thì cũng không cần hạ tầng: chạy `bun src/index.ts` sau một
reverse proxy là xong. Không máy chủ CSDL, không bước migration, không container runtime.

Ba điểm khiến nó khác những lựa chọn quen thuộc:

- **Trang đọc chính là sản phẩm.** Kiểu chữ, bảng màu, thang cỡ chữ, bố cục và font đều là
  tuỳ chọn. Trong stylesheet của trang đọc không có cỡ chữ hay màu nào viết cứng, và có một
  guard trong build sẽ báo đỏ nếu xuất hiện.
- **Người đọc tải về 4.4 KB JavaScript và không một request bên thứ ba nào.** Trang công khai
  là HTML dựng sẵn ở máy chủ cộng vài island viết tay. React không bao giờ chạm tới người đọc.
- **AI agent vận hành được.** Một endpoint MCP từ xa cho phép trợ lý soạn, gắn thẻ, hẹn giờ và
  đăng thẳng lên site đang chạy, theo đúng luật mà trang quản trị dùng.

**Mã nguồn mở xem được** theo [PolyForm Noncommercial](./LICENSE): miễn phí cho mục đích cá
nhân, sở thích, học tập và phi lợi nhuận. Bạn được đọc, sửa, chạy, fork. Dùng cho mục đích
thương mại cần giấy phép riêng, thường là rẻ hoặc miễn phí, cứ hỏi.

> **2.0.0 là bản ổn định**, phát hành 30/07/2026, đang chạy bản demo ở trên và blog riêng của
> tác giả tại [manhhung.me](https://manhhung.me). Trước đó là một
> đợt audit đầy đủ về thiết kế, hiệu năng và tính đúng đắn, làm bằng cách **đo site đang chạy**
> chứ không phải đọc mã nguồn. Mọi thay đổi nằm trong [changelog](./CHANGELOG.md).

| Mảng | Bạn có gì |
|:---|:---|
| 🖋️&nbsp;**Trình soạn** | TipTap 3 + Markdown · thanh công cụ một hàng luôn dính · kéo thả / dán ảnh (JPG · PNG · WebP · AVIF · GIF · SVG) tự sinh biến thể responsive bằng `sharp` · ảnh có chú thích (theo cột / lớn / tràn viền / lưới) · bảng · video · nhúng Spotify và Apple Music · cước chú · callout · cỗ máy thời gian 3 phiên bản · tự lưu offline · xem thử bản nháp · hẹn giờ đăng |
| 🏠&nbsp;**Trang chủ** | danh sách bài, một trang do bạn chọn, hoặc **trang chủ dạng báo**: bài dẫn, bài nổi bật, từng hàng theo chuyên mục và mục xem nhiều, tối ưu riêng cho site có ảnh và site chỉ có chữ ([`docs/homepage.md`](./docs/homepage.md)) |
| 🎨&nbsp;**Giao diện** | 6 bảng màu sáng + tối · một hệ typography chỉnh được (cỡ, giãn dòng, giãn chữ theo từng vai trò) · bốn font đọc dựng sẵn, hoặc tải font riêng theo từng độ đậm |
| 🔍&nbsp;**Đọc** | tìm kiếm tức thì trên SQLite FTS · cột lề trái liệt kê chuyên mục và thẻ, hoặc mục lục bài · bài liên quan · thời gian đọc · thanh tiến độ · **chế độ sách**: trình đọc hai cột trên nền giấy, có chữ cái đầu lớn |
| 📈&nbsp;**Có sẵn** | thống kê không cookie, xem sâu theo mức độ tương tác, đối tượng và nguồn truy cập · nhật ký hoạt động · thùng rác xoá mềm · trang trợ giúp trong app |
| 🔎&nbsp;**SEO** | sitemap · RSS · `robots.txt` · `llms.txt` · ảnh OG sinh động · chuyển hướng, tự tạo 301 khi đổi slug · trường SEO riêng cho từng bài, tất cả đều bật tắt được |
| 📬&nbsp;**Bản tin** | đăng ký qua SMTP của bạn với xác nhận hai bước · gửi bài mới khi đăng · báo có trả lời bình luận. Dùng Nodemailer, không khoá chân |
| 📚&nbsp;**Loạt bài** | gom bài thành loạt có thứ tự, hộp loạt bài trên mỗi phần, và trang quản lý loạt bài |
| 💾&nbsp;**Sao lưu** | tải toàn bộ cài đặt về bằng một cú bấm, kèm script cron sao lưu ra ngoài máy ([`docs/backups.md`](./docs/backups.md)) |
| 📥&nbsp;**Nhập** | tải lên tệp WXR xuất từ WordPress, bài và trang đổ vào dưới dạng Markdown |
| 🌍&nbsp;**Đa ngữ** | quản trị và site ở `en · vi · de · ja · zh · ko` |
| 🔐&nbsp;**Đăng nhập** | tài khoản và mật khẩu của riêng bạn (argon2id) · **bắt buộc TOTP** · 10 mã khôi phục dùng một lần · cookie phiên khoá theo host · không nhà cung cấp danh tính bên thứ ba nào nằm trong đường đăng nhập |
| 📱&nbsp;**PWA** | cài được, mở ra như ứng dụng riêng |

**Hợp với:** một người, một máy chủ, một blog định giữ lâu dài.
**Không hợp với:** đội nhiều tác giả cần phân vai và quy trình biên tập. Quire Ink cố ý chỉ có một chủ.

<div align="center">

<img src="docs/demo-reading.jpg" alt="Chế độ sách: trình đọc hai cột toàn màn hình trên nền giấy, có chữ cái đầu lớn và số trang, bên cạnh là một bài viết ở giao diện tối" width="960">

<sub>Chế độ sách và giao diện tối. Cả hai đều là chính hệ typography của trang đọc, không phải một lớp lọc phủ lên. Font đi kèm được subset cho latin, latin-ext và vietnamese, nên khối mẫu chữ bên trái vẫn hiển thị bằng font đọc chứ không rơi về font hệ thống.</sub>

</div>

---

## Nhanh, và đây là số đo

Đo từ network khi tải nguội site đang chạy, tức đúng cái mà một người đọc lần đầu trên điện
thoại phải trả:

| | Trang chủ | Một bài | |
|:---|---:|---:|:---|
| **Số&nbsp;request** | 11 | 12 | |
| **Tổng&nbsp;tải&nbsp;về** | **139 KB** | **140 KB** | trong đó 86 KB là font đọc |
| **JavaScript** | **4.4 KB** | **9.7 KB** | island viết tay, không framework |
| **CSS** | 7.6 KB | 7.6 KB | một tệp duy nhất, đã hash, đã minify, bất biến |
| **Request&nbsp;bên&nbsp;thứ&nbsp;ba** | **0** | **0** | không script CDN, không host font, không tracker |
| **Lần&nbsp;ghé&nbsp;sau** | ~23 KB | ~23 KB | mọi thứ ngoài HTML được cache một năm |

- **Mỗi bundle có hạn mức byte do build canh.** Tính năng nào vượt hạn mức thì build đỏ, thay
  vì âm thầm bắt mọi người đọc trả giá mãi mãi.
- **Cache trang là một `Map`, hễ có ghi là xoá sạch**, nên luật vô hiệu hoá gói gọn một dòng và
  không thể mục ruỗng. Trượt cache thì tốn một lần đọc SQLite dưới một mili giây cộng một lần
  render.
- **Markdown và tô màu cú pháp được lưu theo nội dung trong SQLite:** đầu vào chính là khoá,
  nên không có gì để vô hiệu hoá. Render một bài dài từ 383 ms xuống 1 ms.
- **Font tự host và được cắt tập ký tự theo từng ngôn ngữ**, chỉ preload đúng ngôn ngữ đang
  phục vụ. Ghim trục `opsz` kéo tập preload từ 97.6 KB xuống 46.2 KB.
- **CSS scroll-driven** lo phần hiện dần và thanh tiến độ đọc: không script, không chạy trên
  main thread, và nếu trình duyệt không hỗ trợ thì nội dung hiện ra chứ không trắng trang.

<div align="center">

<img src="docs/demo-mobile.jpg" alt="Ba màn hình điện thoại: danh sách bài, một bài viết, và lớp tìm kiếm tức thì đang hiện bảy tựa bài khớp" width="960">

<sub>Không có con số nào ở trên là để lấy điểm benchmark. Chúng dành cho người đọc trên chiếc điện thoại bốn năm tuổi chỉ muốn đọc bốn trăm chữ.</sub>

</div>

---

## Vì sao chọn cái này

| | |
|:---|:---|
| **so&nbsp;với&nbsp;nền&nbsp;tảng&nbsp;dịch&nbsp;vụ** | Bài viết của bạn nằm trong hai tệp SQLite trên ổ đĩa của bạn. Không tài khoản, không gói cước, không phải cầu mong nút xuất dữ liệu vẫn còn chạy |
| **so&nbsp;với&nbsp;WordPress** | Không PHP, không MySQL, không một rừng plugin phải vá. Một tiến trình, một binary, và đường đi của người đọc chỉ tốn 4 KB JavaScript |
| **so&nbsp;với&nbsp;static&nbsp;site&nbsp;generator** | Bạn có trang quản trị thật: viết, tải ảnh, hẹn giờ và đăng từ trình duyệt hay điện thoại, kèm tìm kiếm, bình luận, bản tin và thống kê. Không build lại, không deploy, không phải git push để sửa một lỗi chính tả |
| **so&nbsp;với&nbsp;tự&nbsp;viết** | Những phần không hào nhoáng đã xong và đã có test: TOTP, phiên đăng nhập, biến thể ảnh, feed, ảnh OG, chuyển hướng, xoá mềm, lịch sử phiên bản, sao lưu, nhập từ WordPress, sáu ngôn ngữ |

<div align="center">

<img src="docs/demo-admin.jpg" alt="Trang quản trị Quire Ink: trình soạn bài với bảng thuộc tính, và trang cấu hình giao diện với sáu bảng màu và bốn font đọc" width="960">

<sub>Bảng màu, font đọc, thang cỡ chữ, bố cục, menu. Là tuỳ chọn, không phải code.</sub>

</div>

---

## Cài đặt

Bạn cần [Bun](https://bun.sh) 1.3 trở lên và một máy có thể trỏ tên miền vào. Hết, chỉ vậy.

```bash
git clone https://github.com/joiha-steven/quireink.git && cd quireink
bun install
bun run build:assets && bun run build:admin     # island, rồi tới SPA quản trị
DATA_DIR=./data SITE_URL=https://example.com bun src/index.ts
```

Trỏ một reverse proxy có TLS vào cổng đó (mặc định `3000`), rồi tạo tài khoản:

```bash
bun run user create --username <tên> --email <địa-chỉ>   # in ra khoá TOTP + mã khôi phục, đúng một lần
```

Cài đặt chỉ có vậy. Schema được áp lúc khởi động trong một transaction nên không có bước
migration. Hướng dẫn đầy đủ (systemd, nginx, cache header, sao lưu, nâng cấp) ở
**[`docs/self-host.md`](./docs/self-host.md)**.

> [!NOTE]
> `bun run build` cũng tạo ra một tệp thực thi duy nhất ở `dist/quireink`, nhưng
> `bun build --compile` không gói được native module của `sharp`, nên binary đó sẽ lỗi ngay
> lần đầu resize ảnh. Cho tới khi giải quyết được, hãy **chạy từ mã nguồn**, đúng như site
> thật đang làm. Lệnh chạy vẫn y hệt.

<details>
<summary><b>🐳 &nbsp;Thích Docker hơn?</b> &nbsp;Cùng một bản cài, hai lệnh</summary>

<br/>

```bash
cp .env.docker.example .env          # đặt SITE_URL
docker compose up -d --build
docker compose exec quire bun run user create --username you --email you@example.com
```

Một service, hai named volume, không sidecar. Cổng chỉ mở trên `127.0.0.1` để reverse proxy
vẫn là nơi kết thúc TLS. Ghi chú về volume, quyền sở hữu và nâng cấp:
[`docs/self-host.md`](./docs/self-host.md#9-docker-instead-of-systemd).

</details>

<details>
<summary><b>🤖 &nbsp;Giao luôn việc cài cho AI agent</b></summary>

<br/>

Cấp cho agent quyền SSH vào máy chủ rồi bảo nó deploy: clone repo, build, viết unit systemd và
vhost nginx, tạo tài khoản, trả về URL đang chạy. Không có OAuth client nào phải đăng ký,
không có dịch vụ nào phải mở tài khoản, nên nó làm trọn được từ đầu tới cuối.

</details>

> [!TIP]
> Tải tệp lên không bị giới hạn dung lượng khi tự host: trình duyệt post thẳng vào máy chủ. Đặt
> một CDN phía trước để cache ở biên và lo TLS, và hãy để CDN tôn trọng `cache-control` mà app
> đã gửi thay vì ép một TTL cứng.

---

## Để AI agent viết và đăng bài (MCP)

Quire Ink có sẵn một máy chủ **MCP** từ xa, nên agent có thể soạn, sửa, gắn thẻ và đăng thẳng lên
site đang chạy. Không git, không deploy: nội dung đi qua đúng lớp dữ liệu, và đúng các luật về
slug, phiên bản và xoá mềm, mà trang quản trị đang dùng.

1. **Bật lên:** *Quản trị → Cấu hình → Kết nối → MCP*, tạo một token có tên. Token chỉ hiện ra
   một lần, được lưu dưới dạng hash, và hết hạn sau 180 ngày.
2. **Nối agent** vào `https://<tên-miền-của-bạn>/api/mcp` với `Authorization: Bearer <token>`.
   Connector kiểu OAuth cũng dùng được.
3. **Ra lệnh cho nó:**

```text
Dùng máy chủ MCP của Quire Ink, viết một bài 600 chữ tựa đề
"Những gì tôi học được khi để AI agent vận hành blog", gắn thẻ
"ai" và "writing", đặt phần tóm tắt thân thiện, rồi đăng.
```

Các cấu hình nhạy cảm bị chặn qua MCP, và bạn vẫn là người duy nhất có quyền: thu hồi token
trong trang quản trị là xong.

---

## Biến môi trường

Mọi thứ còn lại được cấu hình trong trang quản trị, không phải ở môi trường.

| Biến | Bắt buộc | Là gì |
|---|:---:|---|
| `DATA_DIR` | ✅ | Thư mục chứa `quire.db` + `analytics.db`. Mặc định `./data` |
| `SITE_URL` | ✅ | URL công khai chuẩn, dùng cho feed, ảnh OG và email. Để trống nghĩa là "tự suy ra theo từng request", và sau proxy thì suy ra sai |
| `STORAGE_LOCAL_DIR` | ◻️ | Nơi để tệp tải lên, phục vụ tại `/uploads`. Mặc định `./uploads` |
| `PORT` | ◻️ | Mặc định `3000` |
| `CRON_SECRET` | ◻️ | Bảo vệ `/api/cron` (quét bài hẹn giờ, quét biến thể ảnh) |
| `MCP_OAUTH_SECRET` | ◻️ | Ký mã OAuth của MCP. Nếu không đặt thì máy chủ tự sinh một khoá cho chính nó, và đó là cách nên dùng |
| `ANALYTICS_TZ` | ◻️ | Múi giờ IANA để chốt mốc ngày của thống kê. Mặc định UTC |

Thông tin SMTP, Turnstile và CDN được nhập trong **Cấu hình → Kết nối** và lưu ở phía máy chủ.
Nội dung của bạn nằm trong `DATA_DIR` và thư mục uploads, không bao giờ nằm trong git.

---

## Chạy để phát triển

```bash
bun install
bun run build:admin                 # một lần, và mỗi khi src/admin đổi
bun run dev                         # http://localhost:3000
bun run user create --username me --email me@example.com   # rồi đăng nhập ở /login
```

`bun run check:all` phải xanh trước khi coi bất kỳ thay đổi nào là xong: typecheck, các guard
tĩnh, và bộ test. Chạy offline, không cần thông tin đăng nhập, không cần dịch vụ nào. Bắt đầu
từ [`CONTRIBUTING.md`](./CONTRIBUTING.md), file này dẫn tới luật nhà trong
[`CLAUDE.md`](./CLAUDE.md).

| Đường dẫn | |
|---|---|
| `src/` | Phần cài đặt thật: Bun + Hono + SQLite |
| `docs/` | Chạy thế nào và vì sao. [`docs/spec/`](./docs/spec/README.md) là bản dựng, [`docs/decisions/`](./docs/decisions/README.md) là sổ quyết định, gồm cả những quyết định đã bị đảo ngược |
| `state/` | Hiện trạng: lộ trình, việc cần làm, nhật ký, audit |
| `golden/` | Hợp đồng render: fixture kèm kết quả của bản 1.x cho từng cái. Lệch một byte là build đỏ |
| `scripts/checks/` | Các guard mà `check:all` chạy. Một route ghi đăng ký ngoài nhóm router có gác quyền chủ sẽ làm build đỏ, cỡ chữ viết cứng trong stylesheet trang đọc cũng vậy |
| `v1/` | Quire 1.5.0, bản Next.js + PostgreSQL đã bị thay thế. Đã ngừng, không hỗ trợ, giữ lại làm tư liệu đọc |

Lộ trình: [`state/ROADMAP.md`](./state/ROADMAP.md).

---

## Giấy phép

Hai lớp tách bạch, đừng gộp lại:

- **Mã nguồn trong repo này:** [PolyForm Noncommercial 1.0.0](./LICENSE). Xem được mã nguồn,
  nhưng không phải open source. Miễn phí cho mọi mục đích phi thương mại, hiểu theo nghĩa
  rộng: blog cá nhân, dự án sở thích, học tập và nghiên cứu, cùng với tổ chức từ thiện,
  trường học, viện nghiên cứu công và cơ quan nhà nước. Bạn được đọc, sửa, tự host, fork và
  phát hành lại. Khi chuyển cho người khác thì giữ nguyên văn bản giấy phép và dòng
  `Required Notice:`.
- **Dùng cho mục đích thương mại cần giấy phép riêng.** Chạy Quire Ink cho một doanh nghiệp, hoặc
  bán nó hay bán dịch vụ host nó, đều không nằm trong giấy phép này. Hãy mở issue hoặc liên hệ
  chủ dự án qua [trang GitHub của họ](https://github.com/joiha-steven).
- **Nội dung: © bảo lưu mọi quyền.** Những bài viết đăng *bằng* Quire Ink thuộc về tác giả, không
  nằm trong giấy phép mã nguồn, và không nằm trong repo này.

> **Mọi thứ phát hành tính đến hết v2.0.0 là MIT, và sẽ mãi là MIT.** Đổi giấy phép không có
> hiệu lực hồi tố: bản sao nào lấy trước lần đổi này vẫn giữ nguyên quyền đã được trao. Xem
> [ADR 0015](./docs/decisions/0015-relicense-polyform-noncommercial.md).
