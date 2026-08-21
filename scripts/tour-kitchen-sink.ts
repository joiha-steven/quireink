// One post that contains everything that has ever broken the editor.
//
// It exists because of the gap between the two harnesses this repo has. `editor-corpus.test.ts`
// runs the parser under happy-dom, which is enough to catch a rule that throws or a serializer
// that rewrites — both of today's blank pages fail there now. What it cannot see is the half of
// the editor that only exists once React draws: a node view that throws while rendering, a
// table tool that mounts on nothing, an atom that parses cleanly and paints nothing. The white
// page the owner met was a REACT unmount, and a DOM shim never mounts React the way a browser
// does.
//
// So the same shapes are also written into one real post, opened in a real browser by the tour,
// and SAVED TWICE through the real Save button. Two saves is the whole assertion: whatever the
// editor does to a document, doing it again must not do anything more. That is the law that
// catches silent rewriting, and it is the one a screenshot cannot check.
//
// WHAT GOES IN HERE: a shape that has cost something. Every line below is a bug that shipped or
// a container one hid in — a gesture after emphasis (the token-array bug), a gesture inside a
// link label (the state.pos bug), a formula and an image in a table cell and an escaped pipe
// (the three the corpus suite found on its first run). It is not a tour of Markdown; `marked`
// has 45 fixtures for that. It is a list of scars.
export const KITCHEN_SINK = [
  '# Bài kiểm tất cả',
  '',
  'Chi phí **thấp** và ==tiết kiệm== nhiều, còn ==mực== rồi mới **đậm** sau.',
  '',
  'Ghi **rõ**, ++gạch++ và @@vòng@@ trong một câu.',
  '',
  'Dựng [**@@Quire Ink@@**](https://a.test/repo) lên máy, xem [==tài liệu==](https://a.test/docs) và [$x^2$](https://a.test/math).',
  '',
  'Gõ `ls -la` rồi ==tô== ngay sau đó, và *nghiêng* trước ++gạch++.',
  '',
  '## Bảng, chỗ ba lỗi cùng trốn',
  '',
  '| Thứ | Ghi chú |',
  '| --- | --- |',
  '| `a \\| b` | dấu gạch đứng phải sống sót |',
  '| $x^2$ | công thức từng bị xoá |',
  '| ![ảnh](https://a.test/x.jpg) | ảnh cũng từng bị xoá |',
  '| ==mực== | nét bút trong ô |',
  '',
  '## Danh sách',
  '',
  '- một, có ==mực==',
  '- hai, có @@vòng@@',
  '',
  '- [x] xong ++gạch++',
  '- [ ] chưa $a_1$',
  '',
  '> Ghi chú có ==mực== và **đậm** trong đó.',
  '',
  '```bash',
  'docker run -d -v $PWD/data:/data quireink:latest',
  '```',
  '',
  'Câu này có chú thích[^1].',
  '',
  '$$M \\times V = P \\times Q$$',
  '',
  '---',
  '',
  '[^1]: chú thích có ==mực== ở trong.',
  '',
].join('\n')
