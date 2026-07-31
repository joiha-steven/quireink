// Seed a throwaway database with enough posts, categories and images to photograph the
// composed front page. ADR 0014. `.tmp-drive-data/` is gitignored and this recreates it.
import { rmSync } from 'node:fs'
import { openDatabases } from '@/store/db'
import { savePost } from '@/content/posts'
import { saveSettings, getSettings } from '@/content/settings'
import { DEFAULT_HOME } from '@/content/settings-sanitize'

const DIR = process.argv[2] ?? './.tmp-drive-data'
const KIND = (process.argv[3] ?? 'image') as 'image' | 'text'

rmSync(DIR, { recursive: true, force: true })
openDatabases(DIR)

const CATS = ['Kinh tế', 'Công nghệ', 'Lịch sử', 'Suy nghĩ']
const TAGS = [['Đầu tư', 'Việt Nam'], ['AI', 'Phần mềm'], ['Chiến tranh', 'Việt Nam'], ['Tâm lý', 'Cuộc sống']]
const TITLES = [
  'Giảm phát và bong bóng, sự phát triển của AI sau ba năm',
  'Cánh cửa hẹp nhất và cái bẫy thu nhập trung bình',
  'Nội cuộn, khi guồng máy chạy cả ngày mà không đi tới đâu',
  'Venezuela, một quốc gia chết khát trên biển dầu',
  'Bên kia bờ của một triều đại',
  'Đại Thanh, nền kinh tế nắm một phần ba của cải thế giới',
  'Không ai nói với tôi rằng cuộc đời là một cuộc thi',
  'Khi nào thì đứa trẻ trong ta lại quay về',
  'Máy ảnh và những thứ nó kịp nhìn thấy',
  'Ánh sáng không chạy, chuyện của những người không bỏ cuộc',
  'Thị trường thiết bị gấp sẽ ra sao trong kỷ nguyên mới',
  'Bài học lịch sử từ một giải Nobel kinh tế',
]

for (let i = 0; i < TITLES.length; i += 1) {
  const c = i % CATS.length
  await savePost({
    title: TITLES[i]!,
    slug: `bai-${i + 1}`,
    status: 'published',
    date: new Date(Date.UTC(2026, 6, 30 - i)).toISOString(),
    content: 'Một đoạn thân bài ngắn, đủ để có thời gian đọc.\n\n'.repeat(6),
    excerpt: 'Một đoạn standfirst đủ dài để thấy nó xuống mấy dòng trên trang nhất, và để so sánh hai kiểu site với nhau.',
    categories: [CATS[c]!],
    tags: TAGS[c]!,
    // A real file the server already serves, so the image kind can be photographed without
    // uploading anything. It has no responsive variants, which is exactly the path a fresh
    // install takes: a plain <img>, never a <picture> whose sources would 404.
    ...(KIND === 'image' && i % 3 !== 2 ? { featuredImage: '/app-icon.png' } : {}),
  })
}

const s = await getSettings()
await saveSettings({
  ...s,
  ideChrome: true,
  featured: ['bai-3', 'bai-5', 'bai-7'],
  home: {
    ...DEFAULT_HOME,
    mode: 'front',
    front: {
      ...DEFAULT_HOME.front,
      kind: KIND,
      strips: [
        { category: 'Kinh tế', count: 3, columns: 3 },
        { category: 'Công nghệ', count: 2, columns: 2 },
      ],
    },
  },
})
console.log(`seeded ${DIR}: front page, kind=${KIND}`)
