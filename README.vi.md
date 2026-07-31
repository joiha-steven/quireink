<div align="center">

# quire**INK** &nbsp;`2.0.0`

**Một cái blog bạn tự host, và AI agent có thể vận hành thay bạn.**
Một tiến trình. Hai tệp SQLite. Không tài khoản đám mây nào trong đường đi.

<br/>

![Bun](https://img.shields.io/badge/Bun-000000?logo=bun&logoColor=white)
![Hono](https://img.shields.io/badge/Hono-e36002?logo=hono&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003b57?logo=sqlite&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?logo=typescript&logoColor=white)
![React 19](https://img.shields.io/badge/React_19-20232a?logo=react&logoColor=61dafb)
![MCP](https://img.shields.io/badge/MCP-ready-7c3aed)
![License: PolyForm Noncommercial](https://img.shields.io/badge/License-PolyForm_Noncommercial-22c55e)

[English](./README.md) · **Tiếng Việt**

[**Xem thử**](https://demo.quireink.com) · [**Cài đặt**](#cài-đặt) · [**Tốc độ**](#tốc-độ) · [**Để agent viết**](#để-ai-agent-viết-thay-bạn-mcp) · [**Changelog**](./CHANGELOG.md) · [**Giấy phép**](#giấy-phép)

<br/>

<img src="docs/demo.jpg" alt="Hai ảnh chụp cạnh nhau: trang chủ dạng báo với bài dẫn và các hàng chuyên mục, và trang bài viết của cùng site với cột mục lục bên trái và cột thông tin bên phải" width="960">

<sub>**[demo.quireink.com](https://demo.quireink.com)** là bản thật, chạy được. Không đăng ký, không phải điền gì. Dùng thanh dưới đáy để nhảy qua lại giữa trang chủ dạng báo, danh sách bài, một bài viết, chế độ sách, sáng và tối, và trang quản trị. Thanh đó là thứ duy nhất được thêm vào, và nó nằm ngoài mã nguồn, nên trang demo luôn là bản mới nhất.</sub>

</div>

---

## Nó là gì

Bạn viết, nó đăng, và mọi thứ nằm trên máy chủ của bạn.

Không có CSDL nào phải cài, cũng không có gì phải deploy. Trỏ tên miền vào một câu lệnh là bạn có một cái blog:

```bash
bun src/index.ts
```

Có ba thứ định hình nó.

**Trang đọc mới là sản phẩm.** Font, màu, cỡ chữ, khoảng cách, bố cục: tất cả đều là tuỳ chọn bạn chỉnh trong trang quản trị. Không một cỡ chữ hay màu nào viết cứng trong stylesheet của trang đọc, và build sẽ báo đỏ nếu ai đó nhét vào.

**Người đọc tải về 4.4 KB JavaScript, và không tải gì của ai khác.** Trang tới nơi đã là HTML hoàn chỉnh. Vài đoạn script nhỏ lo tìm kiếm, đổi giao diện và chế độ sách. React nằm yên trong trang quản trị, không bao giờ chạm tới người đọc.

**Agent viết được thay bạn.** Nối Claude hay bất kỳ client MCP nào vào, nó soạn được, gắn thẻ được, hẹn giờ và đăng được, theo đúng những luật mà trang quản trị đang theo.

Bạn được đọc, sửa, chạy và fork theo [PolyForm Noncommercial](./LICENSE).

> **2.0.0 ra ngày 30/07/2026**, đang chạy bản demo ở trên và blog riêng của tác giả tại
> [manhhung.me](https://manhhung.me). Trước khi phát hành, cả dự án được audit bằng cách
> **đo site đang chạy** chứ không phải đọc mã nguồn.
> [Changelog](./CHANGELOG.md) có đủ những gì đã đổi.

---

## Bạn được gì

| | |
|:---|:---|
| 🖋️&nbsp;**Viết** | Một trình soạn thật, TipTap 3 trên nền Markdown, thanh công cụ dính lại khi bạn cuộn. Thả ảnh vào là nó tự cắt đủ cỡ cho mọi màn hình. Bảng, video, cước chú, callout, Spotify và Apple Music. Nó tự lưu trong lúc bạn gõ, giữ ba bản gần nhất, và giữ bài lại chờ tới sáng thứ Ba nếu bạn muốn |
| 🏠&nbsp;**Trang chủ của bạn** | Cho hiện danh sách bài, hoặc một trang bạn tự viết, hoặc dựng hẳn một trang chủ dạng báo: bài dẫn, vài bài chọn, mỗi chuyên mục một hàng, mục đọc nhiều. Hợp cả với site đầy ảnh lẫn site chỉ có chữ. [Xem cách hoạt động](./docs/homepage.md) |
| 🎨&nbsp;**Nhìn thế nào** | Sáu bảng màu, mỗi bảng có bản sáng và bản tối. Bốn font đọc dựng sẵn, hoặc tải font của bạn lên. Mọi cỡ chữ trên trang đều đến từ một vai trò bạn chỉnh được, nên một lần đổi là cả trang đổi theo chứ không phải sửa từng tiêu đề |
| 🔍&nbsp;**Đọc** | Tìm kiếm trả lời ngay trong lúc gõ. Một cột bên lề liệt kê chuyên mục và thẻ, hoặc mục lục của chính bài đang đọc. Bài liên quan, thời gian đọc, thanh tiến độ. Và **chế độ sách**: hai cột trên nền giấy, có chữ cái đầu lớn |
| 📈&nbsp;**Số liệu** | Thống kê không dùng cookie. Ai đọc bài nào, đọc tới đâu, từ đâu tới. Kèm nhật ký hoạt động, một thùng rác hoàn tác được, và một trang trợ giúp giải thích phần còn lại |
| 🔎&nbsp;**Máy tìm kiếm** | Sitemap, RSS, `robots.txt`, `llms.txt`, và ảnh OG vẽ riêng cho từng bài. Đổi slug thì URL cũ vẫn tự chạy tiếp |
| 📬&nbsp;**Bản tin** | Đăng ký có email xác nhận, một số gửi đi khi bạn đăng bài, và một lời nhắn cho ai có bình luận được trả lời. SMTP của chính bạn, nên không phải đăng ký dịch vụ nào |
| 📚&nbsp;**Loạt bài** | Viết thành nhiều phần, đánh số, và mỗi phần đều hiện các phần còn lại |
| 💾&nbsp;**Sao lưu** | Một nút tải về nguyên cả bản cài. Có sẵn cả script cron đẩy bản sao ra khỏi máy chủ. [Chi tiết](./docs/backups.md) |
| 📥&nbsp;**Rời WordPress** | Tải tệp XML export lên. Bài và trang ra thành Markdown |
| 🌍&nbsp;**Ngôn ngữ** | Tiếng Anh, Việt, Đức, Nhật, Trung và Hàn, cả trong trang quản trị lẫn ngoài site |
| 🔐&nbsp;**Đăng nhập** | Tên và mật khẩu của riêng bạn, băm bằng argon2id. Mã xác thực mỗi lần vào, và mười mã khôi phục cho ngày bạn mất điện thoại. Không Google, không ai khác, trong đường đăng nhập |
| 📱&nbsp;**Trên điện thoại** | Cài ra màn hình chính là nó mở như một ứng dụng |

**Làm cho** một người, một máy chủ, một cái blog định giữ lâu dài.
**Không làm cho** một đội cần phân vai, duyệt bài và hàng đợi biên tập. Nó cố ý chỉ có một chủ.

<div align="center">

<img src="docs/demo-reading.jpg" alt="Chế độ sách: trình đọc hai cột toàn màn hình trên nền giấy, có chữ cái đầu lớn và số trang, bên cạnh là một bài viết ở giao diện tối" width="960">

<sub>Chế độ sách và giao diện tối. Không cái nào là một lớp lọc phủ lên trang. Cả hai đều là chính hệ typography của trang đọc. Font đi kèm có sẵn dấu tiếng Việt và dấu của các tiếng Trung Âu, nên khối mẫu chữ bên trái hiện đúng font chứ không rơi về font hệ thống.</sub>

</div>

---

## Tốc độ

Đây là số đo từ mạng, lần vào đầu tiên, chưa cache gì. Đúng bằng cái mà một người lạ cầm điện thoại phải chờ.

| | Trang chủ | Một bài | |
|:---|---:|---:|:---|
| **Số request** | 11 | 12 | |
| **Tổng&nbsp;tải&nbsp;về** | **139 KB** | **140 KB** | 86 KB trong đó là font |
| **JavaScript** | **4.4 KB** | **9.7 KB** | viết tay, không framework |
| **CSS** | 7.6 KB | 7.6 KB | một tệp, đã nén, cache vĩnh viễn |
| **Request&nbsp;bên&nbsp;thứ&nbsp;ba** | **0** | **0** | không CDN, không font host, không tracker |
| **Lần vào sau** | ~23 KB | ~23 KB | chỉ tải lại HTML |

Nó giữ được như vậy nhờ vài quyết định khó đảo ngược.

**Mỗi gói JS có một hạn mức dung lượng do build canh.** Vượt là build đỏ. Một tính năng không thể lặng lẽ bắt mọi người đọc trả thêm một chút, mãi mãi.

**Cache trang là một `Map` duy nhất, và bất kỳ lần ghi nào cũng xoá sạch nó.** Cả luật chỉ có vậy, nên không có chỗ nào để sai một cách tinh vi. Trượt cache thì tốn một lần đọc SQLite cộng một lần render, dưới một phần nghìn giây.

**Markdown đã render được lưu theo hash của đầu vào.** Không bao giờ phải invalidate cái gì. Một bài dài từ 383 ms xuống 1 ms.

**Font là của bạn, cắt gọn theo từng ngôn ngữ, và chỉ preload đúng bộ mà trang này cần.** Ghim một trục của variable font đưa bộ preload từ 97.6 KB xuống 46.2 KB.

**Hiệu ứng hiện dần và thanh tiến độ là CSS thuần.** Không script, không chạy trên main thread, và trình duyệt cũ thì đơn giản là hiện chữ ra luôn.

<div align="center">

<img src="docs/demo-mobile.jpg" alt="Ba màn hình điện thoại: danh sách bài, một bài viết, và lớp tìm kiếm tức thì đang hiện bảy tựa bài khớp" width="960">

<sub>Không con số nào ở trên là để lấy điểm benchmark. Chúng dành cho một người cầm chiếc điện thoại bốn năm tuổi, chỉ muốn đọc bốn trăm chữ.</sub>

</div>

---

## Vì sao không dùng thứ khác

**Thay vì một nền tảng có sẵn.** Bài của bạn là hai tệp SQLite trên ổ đĩa của chính bạn. Không tài khoản, không gói cước, không có cái nút export mà bạn phải cầu cho nó vẫn chạy sau năm năm.

**Thay vì WordPress.** Không PHP, không MySQL, không đống plugin phải vá. Một tiến trình, và người đọc nhận 4 KB JavaScript.

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
> `bun run build` cũng nhả ra một tệp nhị phân ở `dist/quireink`, nhưng `bun build --compile`
> bỏ sót native module của `sharp`, nên tệp đó chết ngay lần đầu đụng vào ảnh. Tới khi nào
> sửa được thì cứ **chạy từ mã nguồn**. Site thật đang chạy như vậy, và câu lệnh giống hệt.

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
| `docs/` | Nó chạy thế nào và vì sao. [`docs/spec/`](./docs/spec/README.md) là bản kế hoạch, [`docs/decisions/`](./docs/decisions/README.md) là mọi quyết định, kể cả những cái đã bị đảo ngược |
| `state/` | Đang tới đâu: roadmap, việc, nhật ký, audit |
| `golden/` | Hợp đồng render. Lệch một byte đầu ra là build đỏ |
| `scripts/checks/` | Các guard. Đăng ký một route ghi ngoài nhóm chỉ-chủ-sở-hữu là build dừng, y như viết cứng một cỡ chữ trong stylesheet trang đọc |
| `v1/` | Quire 1.5.0, bản Next.js và PostgreSQL mà cái này thay thế. Đã nghỉ hưu, không hỗ trợ, giữ lại để đọc xem ngày xưa nó làm gì |

Dự định sắp tới nằm ở [`state/ROADMAP.md`](./state/ROADMAP.md).

---

## Giấy phép

Hai thứ khác nhau, và chúng không chung điều khoản.

**Mã nguồn ở đây** theo [PolyForm Noncommercial 1.0.0](./LICENSE). Xem được mã nguồn, nhưng không phải open source. Miễn phí cho mọi mục đích phi thương mại, hiểu theo nghĩa rộng: blog của bạn, một dự án chơi cho vui, học tập, nghiên cứu, và cả tổ chức từ thiện, trường học, viện nghiên cứu công và cơ quan nhà nước. Cứ đọc, sửa, tự host, fork, chuyển cho người khác. Chỉ cần giữ nguyên văn bản giấy phép và dòng `Required Notice:` kèm theo mỗi bản bạn đưa đi.

**Dùng cho mục đích thương mại thì cần giấy phép riêng.** Chạy Quire Ink cho một doanh nghiệp, hoặc bán nó, hoặc bán dịch vụ host nó, đều không nằm trong phạm vi trên. Mở một issue hoặc liên hệ chủ sở hữu qua [trang GitHub của họ](https://github.com/joiha-steven).

**Những gì bạn viết vẫn là của bạn.** Bài và ảnh của bạn không thuộc giấy phép mã nguồn và không nằm trong repo này.

> **Mọi thứ tính tới hết v2.0.0 là MIT, và mãi mãi là MIT.** Đổi giấy phép không có hiệu lực
> lùi: bản nào lấy về trước lần đổi này thì giữ nguyên quyền mà nó đã được trao. Xem
> [ADR 0015](./docs/decisions/0015-relicense-polyform-noncommercial.md).
