<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/brand/wordmark-dark.svg">
  <img src="docs/brand/wordmark-light.svg" alt="quireINK" width="360">
</picture>

`2.2.15`

**Blog tự host cho một người viết. Nhờ được AI viết và trông coi hộ.**
Không thuật toán, không quảng cáo, không nền tảng nào đứng giữa bạn và người đọc. Tên bạn trên đó, không phải tên chúng tôi.

<br/>

![License: PolyForm Noncommercial plus paid hosting](https://img.shields.io/badge/License-PolyForm_NC_%2B_paid_hosting-22c55e) ![MCP](https://img.shields.io/badge/MCP-ready-7c3aed)

[English](./README.md) · **Tiếng Việt**

[**quireink.com**](https://quireink.com) · [**Xem thử**](https://demo.quireink.com) · [**Cài đặt**](#cài-đặt) · [**Tài liệu**](#đọc-tiếp-ở-đâu) · [**Bản đầy đủ**](./docs/overview.vi.md) · [**Giấy phép**](#giấy-phép)

<br/>

<img src="docs/demo.jpg" alt="Hai ảnh chụp cạnh nhau: trang chủ dạng báo với bài dẫn và các hàng chuyên mục, và trang bài viết của cùng site với cột mục lục bên trái, cột thông tin bên phải, một câu gạch dưới bút chì, một chữ khoanh bút bi đỏ, một câu tô xanh và bức thư tay Van Gogh đóng khung làm hình đầu bài" width="960">

<sub>Bấm [**demo.quireink.com**](https://demo.quireink.com) là xem được ngay, không phải đăng ký hay điền gì. Thanh dưới đáy trang cho bạn nhảy qua lại giữa trang chủ, danh sách bài, một bài viết, chế độ sách, nền sáng nền tối, và cả trang quản trị.</sub>

</div>

## Nó là gì

Một blog để viết và đăng bài, chạy trên máy chủ bạn thuê. Có đủ thứ thường thấy — trang chủ, bài viết, chuyên mục, tìm kiếm, bình luận, bản tin gửi đi mỗi khi đăng bài — và không có thuật toán nào quyết định ai được đọc bạn, không quảng cáo chen giữa bài, không công ty nào đổi luật vào năm sau.

Màu, chữ, bố cục trang chủ và menu đều là cài đặt trong trang quản trị, và làm được từ điện thoại. Dựng lần đầu là việc kỹ thuật — nhờ người biết về máy chủ, hoặc giao cho một AI agent. Sau đó bạn chỉ việc viết, và chỉ lúc nâng cấp mới phải mở terminal.

**Làm cho** một người, một máy chủ, một blog muốn giữ lâu. **Không làm cho** một nhóm cần phân quyền, duyệt bài và hàng đợi biên tập.

## Điểm nổi bật

- **Trình soạn Markdown thật**, có bảng, chú thích, hộp ghi chú, công thức, bộ ảnh và video. Tự lưu khi gõ, giữ các bản cũ, hẹn giờ đăng.
- **Bốn kiểu giao diện, sáu bảng màu, bốn font đọc**, sáng và tối, và chế độ sách dàn bài thành hai cột như trang giấy.
- **Cây bút cho bạn và cho người đọc**: tô năm màu mực, gạch chân, khoanh chữ — vẽ tay, không nét nào giống nét nào.
- **Thống kê không dùng cookie**, theo từng bài và cả site, và bản tin gửi bằng máy chủ mail của bạn.
- **Dọn vào và dọn ra**: nhận WordPress, Ghost, Substack hay Medium; xuất ra một ZIP Markdown.
- **Một AI agent trông được nó.** Máy chủ MCP có sẵn cho trợ lý viết nháp, đăng bài, đọc số liệu và dọn dẹp, theo đúng luật mà trang quản trị theo.
- **Nhanh trên máy nhỏ.** Một tiến trình Bun, hai file SQLite, không máy chủ cơ sở dữ liệu, không tài khoản đám mây nào trên đường đi.
- **Mười một thứ tiếng**, trong trang quản trị và trên site.

Từng phần, chi tiết và so với các lựa chọn khác: [**Quire Ink, bản đầy đủ**](./docs/overview.vi.md).

## Xem qua

<img src="docs/demo-looks.jpg" alt="Cùng một bài trong bốn lối giao diện: giấy thường; mã nguồn, tiêu đề in chữ đơn cách đậm và ngày trong ngoặc vuông; bài báo, có măng-sét, chuyên mục bên dưới và chữ cái đầu in lớn; sổ tay, trên giấy chấm lưới cạnh một tấm thẻ" width="960">

<sub>**Bốn lối giao diện, một lựa chọn.** Cùng một bài ở dạng giấy thường, mã nguồn, bài báo và sổ tay. Giao diện quyết định hình khối, kiểu chữ và các dấu; màu thì luôn do bảng màu quyết định.</sub>

<img src="docs/demo-reading.jpg" alt="Chế độ đọc sách, bài dàn hai cột như trang in có chữ cái đầu in lớn, cạnh cùng trang đó ở nền tối, cuộn tới một bộ bốn bức tranh" width="960">

<sub>**Chế độ đọc sách và nền tối.** Bài nào cũng mở được thành sách có lật trang; bảng màu nào cũng được vẽ hai lần, cho nền sáng và nền tối.</sub>

<img src="docs/demo-code.jpg" alt="Ba khung: một công thức hiển thị bằng MathML, một khối code tô màu cạnh một bảng, và một đoạn văn được đánh dấu bằng bút nhiều màu" width="960">

<sub>**Công thức, code và cây bút.** Công thức là MathML thật, code được tô màu ngay trên máy chủ, và cây bút tô, gạch chân, khoanh tròn chữ như tay vẽ.</sub>

<img src="docs/demo-reader-pen.jpg" alt="Trái: vệt tô và gạch chì của người đọc trên một bài, thanh bút mở trên câu đang chọn. Phải: tấm thẻ trên vệt tô, có ô ghi chú và một mã giữ các dấu trên mọi thiết bị" width="960">

<sub>**Người đọc cũng cầm bút.** Dấu của họ nằm trong trình duyệt của chính họ, và chỉ đi theo sang thiết bị khác khi họ muốn.</sub>

<img src="docs/demo-mobile.jpg" alt="Bốn màn hình điện thoại: danh sách bài, một bài có hộp loạt bài, chế độ đọc sách trên điện thoại, và tìm kiếm tức thì" width="960">

<sub>**Trên điện thoại:** danh sách bài, một bài viết, chế độ đọc sách và tìm kiếm ngay khi gõ.</sub>

<img src="docs/demo-admin.jpg" alt="Trang quản trị: một bài mở trong trình soạn thảo có thanh công cụ và vết bút, cạnh phần cài đặt Giao diện với bốn lối giao diện vẽ thành thẻ, phông chữ và ô CSS riêng" width="960">

<sub>**Trang quản trị.** Trình soạn thảo bên trái, bên phải là phần cài đặt quyết định site trông ra sao: tất cả đều là tuỳ chọn, không phải viết code.</sub>

<img src="docs/demo-setup.jpg" alt="Ba màn hình cài đặt: nhận blog với ngôn ngữ, tên đăng nhập, email và mật khẩu; đặt tên site kèm múi giờ và địa chỉ; và chọn trang chủ" width="960">

<sub>**Cài đặt lần đầu** là bảy màn ngắn trong trình duyệt, màn cuối đưa bạn thẳng vào trình soạn thảo.</sub>

## Cài đặt

Bạn cần một tên miền và một máy trỏ được tên miền về; gói VPS rẻ nhất là đủ. Trên VPS có [Bun](https://bun.sh) 1.3 trở lên, một lệnh là tải, build và chạy:

```bash
curl -fsSL https://raw.githubusercontent.com/joiha-steven/quireink/main/install.sh | bash
```

Nó không dùng `sudo` và từ chối chạy bằng root; chạy lại là cập nhật. Sau đó [`deploy/caddy/setup.sh`](./deploy/caddy/setup.sh) lo chứng chỉ HTTPS. Log in ra một đường dẫn `/setup` dùng một lần: mở nó ra, qua vài bước ngắn — tài khoản, ứng dụng xác thực, giao diện — là vào thẳng trình soạn.

**Thích Docker hơn?** Kéo `quireink/quireink` (`amd64` và `arm64`); có HTTPS thì dùng [`docker-compose.image.yml`](./docker-compose.image.yml) cùng [`Caddyfile`](./Caddyfile).

Nó cũng chạy trên droplet DigitalOcean từ [một file dán vào](./deploy/digitalocean/README.md), trên NAS (Unraid, Synology, QNAP — [từng bước](./docs/self-host-docker.md#on-a-nas-or-a-home-server)) và trên Kubernetes ([manifest](./deploy/kubernetes/README.md)). Cài tay với systemd và nginx: [tự host](./docs/self-host.md).

## Để AI viết hộ

1. **Quản trị → Cài đặt → Máy chủ & kết nối → MCP**, rồi tạo một token.
2. Trỏ agent của bạn tới `https://<tên-miền>/api/mcp` với `Authorization: Bearer <token>`.
3. Nhờ nó viết một bài, một báo cáo lượt đọc sáng thứ Hai hay bản nháp bản tin. [Sổ tay cho agent](./docs/agent-cookbook.md) có các câu lệnh làm việc thật; [MCP ở đây chạy thế nào](./docs/mcp.md).

## Đọc tiếp ở đâu

| Bạn muốn | Đọc |
|---|---|
| Cài tay, đặt sau CDN, nâng cấp | [Tự host](./docs/self-host.md) · [Docker](./docs/self-host-docker.md) · [Biến môi trường](./docs/environment.md) |
| Đổi giao diện, thêm CSS riêng | [Giao diện](./docs/appearance.md) |
| Sao lưu và khôi phục | [Sao lưu](./docs/backups.md) |
| Để agent trông blog | [MCP](./docs/mcp.md) · [Sổ tay](./docs/agent-cookbook.md) |
| Đọc bài từ chương trình khác | [Content API](./docs/content-api.md) |
| Biết nó được dựng thế nào, vì sao | [docs/](./docs/README.md) · [các quyết định](./docs/decisions/README.md) |

Một dòng "powered by Quire Ink" nằm cuối footer của blog mới; đó là một dòng bình thường trong Cài đặt → Home & menu, sửa hay xoá đều được. Mỗi ngày một lần blog hỏi xem có bản mới chưa, gửi phiên bản đang chạy cùng vài con số ước lượng thô, không có địa chỉ hay bài viết nào; tắt bằng `UPDATE_CHECK=0` hoặc trong Cài đặt ([toàn bộ nội dung cú gọi](./docs/update-check.md)).

## Bản dịch

Giao diện nói mười một thứ tiếng: English, Tiếng Việt, Deutsch, 日本語, 简体中文, 한국어, Français, Español, Português (Brasil), Italiano và Русский.

Mời bạn góp bản dịch. Mỗi ngôn ngữ là hai file chữ thuần trong [`locales/`](./locales) (`locales/<mã>.ts` cho người đọc, `locales/admin/<mã>.ts` cho chủ blog), sửa được mà không cần biết lập trình. Trình biên dịch từ chối build khi còn thiếu một chuỗi, nên bản dịch dở dang không lọt ra ngoài được. Tai người bản xứ vẫn hơn tai chúng tôi.

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
- **Nếu dự án có ngày im lặng, nó tự mở ra.** 48 tháng không có bản phát hành nào thì mã nguồn ở trạng thái lúc đó cũng thuộc về bạn theo Apache License 2.0, bằng một giấy phép đã trao sẵn từ hôm nay. Không cần ai còn liên lạc được. Đó là mục 6 của [cho phép bổ sung](./LICENSE-EXCEPTION.vi.md).

Cấu hình, bảng màu, font và nội dung không tính là mã nguồn, vì giao diện là thứ chỉnh trong cài đặt, không cần fork.

> **Mọi thứ tính tới hết v2.0.0 là MIT, và mãi mãi là MIT.** Đổi giấy phép không có hiệu lực lùi: bản nào lấy về trước lần đổi này thì giữ nguyên quyền đã được trao. Xem [ADR 0015](./docs/decisions/0015-relicense-polyform-noncommercial.md).

## Về dự án này

**Người làm ra nó không biết code.** Từng dòng Quire Ink đều do Claude Code viết; tôi không có nền tảng phần mềm nào. Cái tôi có là thời gian, nên bản cập nhật ra thường xuyên. Mọi thay đổi đều qua bộ test và một vòng duyệt từng màn hình trên trình duyệt trước khi phát hành, và nó đang chạy bản demo cùng blog của chính tôi. Lỗi vẫn có: [mở một issue](https://github.com/joiha-steven/quireink/issues), vì được báo là cách duy nhất để tôi biết.
