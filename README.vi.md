<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/brand/wordmark-dark.svg">
  <img src="docs/brand/wordmark-light.svg" alt="quireINK" width="360">
</picture>

`2.2.7`

**Blog tự host cho một người viết. Nhờ được AI viết và trông coi hộ.**
Không thuật toán, không quảng cáo, không nền tảng nào đứng giữa bạn và người đọc.

<br/>

![Bun](https://img.shields.io/badge/Bun-000000?logo=bun&logoColor=white)
![Hono](https://img.shields.io/badge/Hono-e36002?logo=hono&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003b57?logo=sqlite&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?logo=typescript&logoColor=white)
![React 19](https://img.shields.io/badge/React_19-20232a?logo=react&logoColor=61dafb)
![MCP](https://img.shields.io/badge/MCP-ready-7c3aed)

[English](./README.md) · **Tiếng Việt**

[**quireink.com**](https://quireink.com) · [**Xem thử**](https://demo.quireink.com) · [**Cài đặt**](#cài-đặt) · [**Để AI viết hộ**](#để-ai-viết-hộ-mcp) · [**Giấy phép**](#giấy-phép)

<br/>

<img src="docs/demo.jpg" alt="Hai ảnh chụp cạnh nhau: trang chủ dạng báo với bài dẫn và các hàng chuyên mục, và trang bài viết của cùng site với cột mục lục bên trái, cột thông tin bên phải, một câu gạch dưới bút chì, một chữ khoanh bút bi đỏ, một câu tô xanh và bức thư tay Van Gogh đóng khung làm hình đầu bài" width="960">

<sub>Bấm [**demo.quireink.com**](https://demo.quireink.com) là xem được ngay, không phải đăng ký hay điền gì. Thanh dưới đáy trang cho bạn nhảy qua lại giữa trang chủ, danh sách bài, một bài viết, chế độ sách, nền sáng nền tối, và cả trang quản trị.</sub>

</div>

## Nó là gì

Một cái blog bạn viết và đăng, chạy trên máy chủ bạn thuê.

Nó có đủ đồ đạc của một cái blog: trang chủ, bài viết, chuyên mục, ô tìm kiếm, phần bình luận, và bản tin tự gửi email cho người theo dõi mỗi khi bạn đăng bài. Thứ nó không có là thuật toán quyết định ai được đọc bài bạn, quảng cáo chen ngang, và một công ty có thể đổi luật chơi vào năm sau.

Màu, font, cỡ chữ, bố cục trang chủ, menu: đổi hết trong trang quản trị, sau lần đăng nhập của riêng bạn. Không phải sửa code dòng nào, và làm trên điện thoại cũng được.

Trang nhẹ, khoảng 100 KB một bài. Một tấm ảnh chụp bằng điện thoại nặng gấp vài chục lần. Người lạ ở chỗ sóng yếu cầm máy đời cũ vẫn thấy chữ hiện ra gần như tức thì.

Để bắt đầu bạn cần một tên miền và một máy chủ thuê, loại rẻ nhất là đủ. Riêng lần dựng đầu tiên là việc kỹ thuật, nên nhờ người biết về máy chủ, hoặc [giao hẳn cho một AI agent](#cài-đặt). Xong bước đó thì viết bài, đổi giao diện, xem thống kê đều nằm trong trang quản trị.

Đổi lại, bạn tự giữ nhà mình. Không ai sao lưu hộ bạn. Có sẵn nút tải nguyên cả blog về máy, nhưng bấm nó là việc của bạn.

Blog cá nhân thì không tốn gì, và bạn được phép thu tiền. Chi tiết ở [mục Giấy phép](#giấy-phép).

## Cài đặt

Cài lên đâu cũng được, và blog y hệt nhau ở mọi chỗ:

- **VPS thuê ngoài**, gói rẻ nhất là đủ. Một lệnh bên dưới, hoặc Docker.
- **Droplet DigitalOcean**: dán [một file](./deploy/digitalocean/user-data.sh) vào ô initialization script lúc tạo máy, ba phút sau là blog chạy ([cách làm](./deploy/digitalocean/README.md)).
- **NAS trong nhà**: Unraid tìm `QuireInk` trong Community Applications; Synology và QNAP dán file compose vào Container Manager. Không cần dòng lệnh nào ([từng bước](./docs/self-host-docker.md#on-a-nas-or-a-home-server)).
- **Máy nào có Docker**: kéo `quireink/quireink` về, có sẵn cho `amd64` và `arm64`.
- **Cụm Kubernetes**: `kubectl apply -k deploy/kubernetes` ([bộ manifest](./deploy/kubernetes/README.md)).

Cách thứ nhất cần [Bun](https://bun.sh) 1.3 trở lên và một máy trỏ tên miền vào được. Chỉ vậy thôi.

**Một lệnh** là nó tự tải mã nguồn, cài, dựng và chạy blog lên:

```bash
curl -fsSL https://raw.githubusercontent.com/joiha-steven/quireink/main/install.sh | bash
```

Lệnh này không dùng `sudo`, không tự cài Bun sau lưng bạn, không đụng tới systemd, và từ chối chạy dưới quyền root. Chạy lại lần nữa trên cùng thư mục thì nó cập nhật chứ không báo lỗi. [Bản thân cái script](./install.sh) dài 120 dòng, đọc trước được nếu bạn muốn xem nó làm gì.

Xong, bạn đọc log. Blog chưa có chủ sẽ tự in ra đường dẫn để nhận:

```
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  This blog has no owner yet. Open the link below to claim it.           │
  └─────────────────────────────────────────────────────────────────────────┘

  https://example.com/setup?token=…
```

Mở link đó ra là xong phần còn lại ngay trong trình duyệt: tên đăng nhập, email, mật khẩu, rồi mã QR cho ứng dụng xác thực và mười mã khôi phục. Token nằm trong bộ nhớ, nên khởi động lại là có token mới và dòng log cũ hết là bí mật.

<div align="center">

<img src="docs/demo-setup.jpg" alt="Ba màn hình đầu tiên đặt cạnh nhau: Claim this blog với ô tên đăng nhập, email và mật khẩu; Your site với ngôn ngữ đứng đầu, rồi tên site, múi giờ đã điền sẵn Asia/Saigon và địa chỉ site đã điền sẵn https://example.com; và The front page với hai hình vẽ nhỏ để chọn, danh sách bài hoặc trang nhất kiểu báo" width="960">

<sub>Toàn bộ phần cài đặt sau dòng log. Múi giờ và địa chỉ site đến nơi đã điền sẵn. Bảng màu, phông chữ và các công tắc tính năng cố ý không hỏi ở đây, vì chưa có bài nào thì chưa ai chọn nổi.</sub>

</div>

<details>
<summary><b>🐳 &nbsp;Thích Docker hơn</b></summary>

<br/>

Không cần clone, không cần Bun, không phải dựng gì:

```bash
docker run -d --name quire -p 127.0.0.1:3000:3000 \
  -e SITE_URL=https://example.com \
  -v quire-data:/var/lib/quire/data -v quire-uploads:/var/lib/quire/uploads \
  quireink/quireink:latest
docker logs quire            # in ra đường dẫn nhận blog
```

Dùng `:latest` là cố ý: bản mới nhất là bản đã có các lỗi được sửa. Thẻ theo số phiên bản dành cho ai muốn tự quyết lúc nào thì đổi. Trên GHCR cũng có, `ghcr.io/joiha-steven/quireink`, cùng một image cùng một digest.

Cổng chỉ mở trên `127.0.0.1`, nên reverse proxy vẫn là chỗ lo TLS. Trên NAS thì gắn thư mục thật và đặt `PUID`/`PGID` theo người sở hữu thư mục đó; container tự nhận quyền ở lần khởi động đầu và không bao giờ chạy bằng root. Ghi chú đầy đủ ở [`docs/self-host-docker.md`](./docs/self-host-docker.md).

</details>

<details>
<summary><b>🤖 &nbsp;Hoặc để AI agent cài giúp</b></summary>

<br/>

Đưa SSH của một máy chủ trắng cho agent rồi bảo nó dựng hết: tải mã nguồn, build, viết unit systemd và vhost nginx, tạo tài khoản, trả lại cho bạn cái URL. Không có OAuth client nào phải đăng ký, không dịch vụ nào phải mở tài khoản, nên nó làm trọn được thật.

</details>

Muốn bản đầy đủ với systemd, nginx, cache header, sao lưu và nâng cấp thì xem [`docs/self-host.md`](./docs/self-host.md).

## Bạn được gì

| Phần | Làm được gì |
|:---|:---|
| 🖋️&nbsp;**Viết** | Trình soạn Markdown thật: bảng, video, chú thích chân trang, công thức toán, nhúng Spotify. Thả ảnh vào là tự cắt cho mọi cỡ màn hình. Lưu trong lúc gõ, giữ ba bản gần nhất |
| 🏠&nbsp;**Trang&nbsp;chủ** | Danh sách bài, một trang bạn tự viết, hoặc trang nhất kiểu báo dựng sẵn. [Cách hoạt động](./docs/homepage.md) |
| 🎨&nbsp;**Giao&nbsp;diện** | Sáu bảng màu sáng và tối, bốn font đọc, hoặc tải font của bạn lên. Sửa một chỗ là cả trang đổi theo |
| 🖍️&nbsp;**Cây&nbsp;bút** | `==tô sáng==`, `++gạch chì++`, `@@khoanh bút đỏ@@`. Nét vẽ như tay người, không vệt nào trên trang giống vệt nào |
| 💻&nbsp;**Code** | Tô màu sẵn ở máy chủ, hai mươi mốt ngôn ngữ. Người đọc không phải tải bộ tô màu nào |
| 🔍&nbsp;**Đọc** | Tìm kiếm hiện kết quả ngay trong lúc gõ. Mục lục bài, bài liên quan, thời gian đọc. Và chế độ sách: hai cột trên nền giấy |
| 📈&nbsp;**Số&nbsp;liệu** | Thống kê không dùng cookie: ai đọc bài nào, đọc tới đâu, đến từ đâu. Kèm nhật ký hoạt động và thùng rác hoàn tác được. Không có gì bị xoá, nên bảng theo năm lùi được tới người đọc đầu tiên |
| 💬&nbsp;**Bình&nbsp;luận** | Người đọc bình luận không cần tài khoản. Chống spam bằng cách tự ký thử thách, không qua bên thứ ba nào |
| 🔎&nbsp;**Máy&nbsp;tìm&nbsp;kiếm** | Sitemap, RSS, `robots.txt`, `llms.txt`, ảnh chia sẻ vẽ riêng cho từng bài. Đổi đường dẫn thì link cũ vẫn chạy |
| 📬&nbsp;**Bản&nbsp;tin** | Đăng ký có email xác nhận, một số tự gửi khi bạn đăng bài. SMTP của riêng bạn |
| 📚&nbsp;**Loạt&nbsp;bài** | Viết thành nhiều phần, đánh số, phần nào cũng chỉ ra các phần kia |
| 💾&nbsp;**Sao&nbsp;lưu** | Nút tải cả blog về máy, snapshot theo lịch, và mỗi snapshot gửi thêm một bản lên bucket R2 hay S3 của bạn. [Chi tiết](./docs/backups.md) |
| 📥&nbsp;**Dọn&nbsp;nhà&nbsp;sang** | Nhập từ WordPress, Ghost, Substack, Medium. Ảnh được tải về, URL cũ được chuyển hướng sẵn |
| 🌍&nbsp;**Ngôn&nbsp;ngữ** | Mười một thứ tiếng, cả trong quản trị lẫn ngoài site |
| 🔐&nbsp;**Đăng&nbsp;nhập** | Mật khẩu băm argon2id, mã xác thực mỗi lần vào, mười mã khôi phục, và danh sách thiết bị đang đăng nhập kèm nút cắt. Không có Google trong đường đăng nhập |
| 🤖&nbsp;**Trợ&nbsp;lý** | Khoá model của chính bạn, ngay trong trang quản trị: Claude, GPT, Gemini hay DeepSeek. Mỗi cuộc trò chuyện kèm một hoá đơn |
| ⌨️&nbsp;**Quản&nbsp;trị** | ⌘K gõ tên là nhảy thẳng tới thiết lập cần tìm, không phải nhớ nó nằm ở tab nào |
| 📱&nbsp;**Điện&nbsp;thoại** | Cài ra màn hình chính là nó mở như một ứng dụng |

**Làm cho** một người, một máy chủ, một cái blog định giữ lâu dài.
**Không làm cho** một đội cần phân vai, duyệt bài và hàng đợi biên tập. Nó cố ý chỉ có một chủ.

<div align="center">

<img src="docs/demo-admin.jpg" alt="Trang quản trị Quire Ink: trình soạn bài với nút gạch dưới và khoanh tròn trên thanh công cụ, câu gạch chì, chữ khoanh đỏ, câu tô sáng và bức thư tay đóng khung trong bài; bên cạnh là trang cấu hình giao diện với sáu bảng màu và bốn font đọc" width="960">

<sub>Trang quản trị xoay quanh việc viết. Bảng màu, font, cỡ chữ, bố cục và menu đều là tuỳ chọn bấm chọn, không cái nào là code.</sub>

</div>

## Vì sao không dùng thứ khác

**Thay vì một nền tảng có sẵn.** Bài của bạn là hai tệp SQLite nằm trên ổ đĩa của chính bạn. Không tài khoản, không gói cước, không có cái nút export mà bạn phải cầu cho nó còn chạy sau năm năm.

**Thay vì WordPress.** Không PHP, không MySQL, không đống plugin phải vá hàng tháng. Một tiến trình, và người đọc chỉ tải về vài KB JavaScript.

**Thay vì một static site generator.** Bạn có trang quản trị thật. Viết, tải ảnh, hẹn giờ, đăng, từ laptop hay điện thoại. Không build lại, không deploy, không phải git push chỉ để sửa một lỗi chính tả.

**Thay vì tự viết lấy.** Nửa phần chán đã làm xong và có test: đăng nhập hai lớp, phiên, cắt ảnh, feed, ảnh chia sẻ, chuyển hướng, hoàn tác khi xoá, lịch sử phiên bản, sao lưu, bộ nhập bài, mười một ngôn ngữ.

## Để AI viết hộ (MCP)

Quire Ink có sẵn một máy chủ **MCP**, nên trợ lý AI soạn, sửa, gắn thẻ và đăng thẳng lên site đang chạy của bạn được. Không git, không deploy. Nó đi qua đúng đoạn mã mà trang quản trị đi qua.

1. **Bật lên.** *Quản trị → Cấu hình → Kết nối → MCP*, tạo một token. Bạn thấy nó đúng một lần, sau đó nó được băm, và nó hết hạn sau 180 ngày.
2. **Trỏ agent** vào `https://<tên-miền-của-bạn>/api/mcp` với `Authorization: Bearer <token>`.
3. **Bảo nó viết bài.**

```text
Dùng máy chủ MCP của Quire Ink, viết một bài 600 chữ tựa đề
"Những gì tôi học được khi dựng blog cùng AI agent", gắn thẻ
"ai" và "writing", đặt một đoạn tóm tắt dễ chịu, rồi đăng.
```

Viết mới là một nửa. Agent còn đọc được lượng truy cập, đếm người đăng ký mà không bao giờ thấy email của họ, quét bình luận rác vào thùng rác, tìm khắp kho bài, sắp lại trang nhất theo bài người ta thật sự đọc, và sao lưu trước khi làm gì lớn. Thu hồi token trong trang quản trị là nó mất quyền ngay. [Sổ tay agent](./docs/agent-cookbook.md) gom sẵn những câu lệnh làm việc thật.

Kho mã này còn dạy luôn cho agent: ba bộ kỹ năng nằm trong `.claude/skills/`, nên một trợ lý vừa tải kho về là đã biết cách dựng blog, vận hành nó qua MCP, và dọn nhà từ WordPress hay Ghost sang. [Chúng gồm những gì](./docs/agent-ready.md#skills-that-ship-in-the-repository).

## Tốc độ

Số đo từ mạng, lần vào đầu tiên, chưa cache gì. Đúng bằng cái mà một người lạ cầm điện thoại phải chờ.

| | Trang chủ | Một bài | |
|:---|---:|---:|:---|
| **Số&nbsp;request** | 8 | 9 | |
| **Tổng&nbsp;tải&nbsp;về** | **100&nbsp;KB** | **98&nbsp;KB** | 68&nbsp;KB trong đó là font |
| **JavaScript** | **3,5&nbsp;KB** | **9,0&nbsp;KB** | viết tay, không framework |
| **CSS** | 9,5&nbsp;KB | 9,5&nbsp;KB | +11&nbsp;KB chỉ ở trang có vệt bút |
| **Request&nbsp;bên&nbsp;thứ&nbsp;ba** | **0** | **0** | không CDN, không font host, không tracker |
| **Lần&nbsp;vào&nbsp;sau** | **0&nbsp;byte** | **0&nbsp;byte** | đúng trang đó trả `304` |

Giữ được như vậy là nhờ mấy luật cứng: mỗi gói JavaScript có hạn mức dung lượng do bản build canh, vượt là build đỏ; React ở lại trong trang quản trị và không bao giờ chạm tới người đọc; font cắt gọn theo từng ngôn ngữ. Không con số nào ở đây để lấy điểm benchmark, chúng dành cho một người cầm chiếc điện thoại bốn năm tuổi, chỉ muốn đọc bốn trăm chữ. [Cách đo và các quyết định phía sau](./docs/performance.md).

## Cấu hình

Gần như mọi thứ nằm trong trang quản trị. Chỉ vài biến môi trường là ở ngoài:

| Biến | Bắt buộc | Nó làm gì |
|---|:---:|---|
| `DATA_DIR` | ✅ | Chỗ để `quire.db` và `analytics.db`. Mặc định `./data` |
| `SITE_URL` | ✅ | Địa chỉ công khai của bạn, dùng trong feed, ảnh chia sẻ và email |
| `PORT` | ◻️ | Mặc định `3000` |
| `HOST` | ◻️ | Mặc định `127.0.0.1`, đúng khi reverse proxy đứng cùng máy |

Danh sách đầy đủ, kèm giới hạn dung lượng tải lên, sao lưu lên S3 và các công tắc khác, nằm ở [`docs/self-host.md`](./docs/self-host.md).

Mỗi ngày một lần, blog hỏi máy chủ xem đã có bản mới chưa, và chính lúc hỏi thì được đếm là một blog đang được dùng. Nó gửi đi phiên bản đang chạy và bốn nấc thô về blog, không có địa chỉ, bài viết hay người đọc nào. Tắt bằng `UPDATE_CHECK=0` hoặc một công tắc trong Cài đặt. [Toàn bộ nội dung cú gọi](./docs/update-check.md).

## Bản dịch

Giao diện nói mười một thứ tiếng: English, Tiếng Việt, Deutsch, 日本語, 简体中文, 한국어, Français, Español, Português (Brasil), Italiano và Русский.

Mời bạn góp bản dịch. Mỗi ngôn ngữ là mấy file chữ thuần trong [`locales/`](./locales), sửa được mà không cần biết lập trình. Trình biên dịch từ chối build khi còn thiếu một chuỗi, nên bản dịch dở dang không lọt ra ngoài được. Tai người bản xứ vẫn hơn tai chúng tôi.

## Góp code

```bash
bun install
bun run build:admin                 # một lần, và mỗi khi src/admin đổi
bun run dev                         # http://localhost:3000
```

Chưa qua `bun run check:all` thì chưa xong. Nó typecheck, chạy các guard tĩnh và chạy test, tất cả offline, không cần thông tin đăng nhập của ai. Bắt đầu ở [`CONTRIBUTING.md`](./CONTRIBUTING.md), từ đó dẫn tới luật nhà trong [`CLAUDE.md`](./CLAUDE.md). Mã nguồn nằm trong `src/`, tài liệu trong [`docs/`](./docs/README.md), và [mọi quyết định](./docs/decisions/README.md) đều được ghi lại kể cả những cái đã bị đảo ngược.

## Giấy phép

Mã nguồn theo [PolyForm Noncommercial 1.0.0](./LICENSE) cộng [một cho phép bổ sung](./LICENSE-EXCEPTION.vi.md). Xem được mã nguồn, nhưng không phải open source. Gọn trong một câu: **cứ chạy, và cứ thu tiền, miễn là bản bạn chạy đúng là bản phát hành ở đây.**

- **Phi thương mại thì được tất.** Blog của bạn, dự án chơi cho vui, học tập, nghiên cứu, trường học, tổ chức từ thiện, cơ quan nhà nước. Đọc, sửa, tự host, fork, chuyển cho người khác đều được.
- **Thương mại được, nếu không sửa code.** Chạy cho doanh nghiệp, chạy cho khách hàng, bán hosting mà mỗi khách một blog riêng. Đổi lại: chạy đúng một bản phát hành với mã nguồn nguyên vẹn, giữ các dòng ghi chú bản quyền, nói rõ dịch vụ của bạn chạy trên Quire Ink kèm link về đây, và bán dịch vụ chứ không bán phần mềm.
- **Sửa code rồi đem đi kinh doanh thì phải hỏi trước.** Đây là ranh giới duy nhất dự án giữ lại. Vá lỗi hay bịt lỗ hổng bảo mật trên bản cài của chính bạn thì được miễn, chỉ cần báo lại trong vòng 30 ngày.
- **Những gì bạn viết vẫn là của bạn.** Bài và ảnh của bạn không thuộc giấy phép mã nguồn.

Cấu hình, bảng màu, font và nội dung không tính là mã nguồn, vì ở đây giao diện là tuỳ chọn chứ không phải chỗ phải fork.

> **Mọi thứ tính tới hết v2.0.0 là MIT, và mãi mãi là MIT.** Đổi giấy phép không có hiệu lực lùi: bản nào lấy về trước lần đổi này thì giữ nguyên quyền đã được trao. Xem [ADR 0015](./docs/decisions/0015-relicense-polyform-noncommercial.md).
