import type { HelpText } from './types'

const help: HelpText = {
  intro: '이 블로그가 할 수 있는 모든 것과, 각각이 어디에 있는지. 새 사이트라면 맨 위부터 읽고, 무언가를 찾는 중이라면 해당 항목으로 바로 가세요.',
  index: {
    writing: '글쓰기', media: '미디어', readers: '독자', analytics: '통계', settings: '설정',
    server: '서버', cache: '캐시', mcp: 'MCP', api: 'Content API', fediverse: '페디버스',
    markdown: 'Markdown', keys: '키보드', trouble: '문제 해결',
  },
  sections: [
    {
      id: 'writing',
      title: '글쓰기와 게시',
      body: `<ul>
<li>Markdown과 도구 모음. 입력하는 동안 사본이 <b>이 기기와 서버에 보관됩니다</b>. 글 자체는 저장이나 게시를 눌러야만 바뀌므로, 게시된 글을 고치는 중에 덜 쓴 문장이 사이트에 올라가는 일은 없습니다.</li>
<li>미래 날짜로 게시하면 <b>예약</b>됩니다. 글은 숨어 있다가 그 시각에 공개됩니다. 그것만으로는 누구에게도 메일을 보내지 <b>않습니다</b>.</li>
<li>모든 글의 최근 <b>3개 버전</b>이 보관됩니다. 편집기에서 복원하세요.</li>
<li><b>시리즈</b>는 관련된 글을 순서대로 묶고, 이전 글·다음 글 링크와 <code>/series/…</code> 페이지를 만듭니다.</li>
<li>삭제한 것은 모두 <b>휴지통</b>으로 갑니다. 자동으로 영구 삭제되는 것은 없습니다 — 휴지통은 직접 비웁니다.</li>
</ul>
<p class="links"><a href="/admin/editor">새 게시물</a> <a href="/admin/content">모든 콘텐츠</a> <a href="/admin/trash">휴지통</a></p>`,
    },
    {
      id: 'media',
      title: '미디어와 파일',
      body: `<ul>
<li>이미지를 편집기나 라이브러리에 끌어다 놓으세요. 반응형 <b>AVIF와 WebP</b> 버전과 썸네일이 자동으로 만들어지고, 원본은 항상 보관됩니다.</li>
<li>라이브러리에서 이미지를 열면 <b>설명</b>(대체 텍스트)을 읽거나 바꿀 수 있습니다. 이미지를 볼 수 없는 독자가 대신 듣는 문장입니다.</li>
<li>어떤 이미지든 <b>액자</b>를 두를 수 있습니다 — 종이나 잉크로 된 여백, 굵기는 세 가지 — 편집기에서 그 이미지에 직접 고릅니다. {t:navSettings} → {t:tabPost} → {t:cardPictures}에서는 따로 고르지 않은 모든 이미지가 쓸 액자를 정합니다. 직접 고른 이미지는 자기 것을 유지합니다.</li>
<li>라이브러리는 <b>미사용</b> 파일(아무것도 링크하지 않는 파일)을 표시하므로 안심하고 정리할 수 있습니다. 알려 주기만 할 뿐 — 절대 삭제하지 않습니다.</li>
<li>파일은 서버 자체 디스크에 있고 <code>/uploads</code>에서 제공됩니다. 오브젝트 스토리지 계정은 필요 없습니다.</li>
</ul>
<p class="links"><a href="/admin/media">라이브러리 열기</a> <a href="/admin/settings?tab=post">{t:tabPost}</a></p>`,
    },
    {
      id: 'readers',
      title: '독자 — 댓글과 뉴스레터',
      body: `<p>둘 다 <b>설정하기 전까지는 꺼져 있고</b>, 둘 다 당신의 것입니다. 당신과 독자 사이에 끼어드는 외부 서비스는 없습니다.</p>
<ul class="after">
<li><b>댓글</b> — {t:navSettings} → {t:tabPeople}에서 켜세요. 스팸을 막는 Cloudflare Turnstile과 Google로 로그인은 선택 사항입니다. 댓글은 댓글 화면에서 읽고 삭제할 수 있습니다.</li>
<li><b>뉴스레터</b> — {t:navSettings} → {t:tabPeople}에 SMTP 정보를 넣으면 모든 글 아래에 구독 양식이, 사이트 헤더에 버튼이 나타납니다. 구독은 <b>이중 확인</b> 방식입니다. 주소는 확인 링크를 클릭한 뒤에야 구독자로 셉니다.</li>
<li><b>발송은 언제나 수동입니다.</b> 예약한 글이 공개될 때조차 자동으로 나가는 메일은 없습니다. 글을 체크하고, 미리보기에서 실제 메일을 읽고, 보내기를 누릅니다. 여러 개를 체크하면 하나씩이 아니라 <b>한 통의 모음 메일</b>로 나갑니다.</li>
<li>{t:navNewsletter} → {t:nlTabPeople}에서는 각 주소가 실제로 무엇을 받았는지, SMTP 실패와 그 오류, 열람률을 볼 수 있습니다. {t:navNewsletter} → {t:nlTabTest}는 독자가 받기 전에 각 메일의 견본을 당신에게 보냅니다.</li>
</ul>
<p class="links"><a href="/admin/newsletter">{t:navNewsletter}</a> <a href="/admin/comments">댓글</a> <a href="/admin/settings?tab=people">{t:tabPeople}</a></p>`,
    },
    {
      id: 'analytics',
      title: '통계',
      body: `<ul>
<li><b>쿠키도 개인 데이터도 없습니다.</b> 방문자는 주소와 브라우저에 솔트를 더한 해시이고, 브라우저 문자열 자체는 저장하지 않습니다 — 기기, 브라우저, 운영체제의 대략적인 분류만 남습니다.</li>
<li>봇, 관리 화면, 당신 자신의 방문은 빠지므로 숫자는 독자의 것입니다.</li>
<li>조회수, 얼마나 스크롤하고 얼마나 머무는지, 어디서 왔는지, 글마다 따로. 영구히 보관되며 일정 기간만 남기는 방식이 아닙니다.</li>
</ul>
<p class="links"><a href="/admin/analytics">통계 열기</a></p>`,
    },
    {
      id: 'settings',
      title: '설정',
      body: `<p>양식 하나, 저장 버튼 하나로 <b>재배포 없이</b> 사이트 전체에 적용됩니다. 탭은 일곱 개입니다:</p>
{tabs}
<p>설정 하나를 찾고 있나요? 설정 화면 맨 위의 검색에 그 이름을 입력하세요.</p>
<p class="links"><a href="/admin/settings">설정 열기</a></p>`,
    },
    {
      id: 'server',
      title: '서버, 백업, 업그레이드',
      body: `<ul>
<li>전부 <b>당신의 서버</b>에서 돌아갑니다. 콘텐츠와 통계를 위한 SQLite 파일 두 개, 그리고 이미지를 위한 로컬 디스크. 네이티브든 Docker든, 클라우드 계정은 필요 없습니다.</li>
<li><code>/api/health</code>는 데이터베이스와 저장 폴더를 따로 보고합니다 — 가동 시간 모니터를 여기에 연결하세요. 필수 설정이 빠져 있으면 서버는 반쯤 설정된 채로 시작하지 않고 시작을 거부합니다.</li>
<li><b>백업</b>: 일정에 따른 스냅샷(두 데이터베이스와 모든 파일)을 당신의 디스크에 쓰고, 서버 밖 사본을 추가했다면 그곳에도 보내며, 지금 바로 내려받을 아카이브도 있습니다. {t:navSettings} → {t:tabServer} → {t:backupTitle}.</li>
<li>업그레이드는 <b>추적되는 데이터베이스 마이그레이션</b>을 적용하므로, 스키마 변경은 딱 한 번만 실행됩니다.</li>
</ul>
<p class="links"><a href="doc:docs/self-host.md">셀프 호스팅 안내</a> <a href="doc:docs/backups.md">{t:backupTitle}</a></p>`,
    },
    {
      id: 'cache',
      title: 'Cloudflare와 캐시',
      body: `<p>TLS와 모든 독자 가까이에 있는 캐시를 위해 Cloudflare를 앞에 두세요 — 독자가 서버에서 멀리 있을 때 가장 크게 이득을 봅니다.</p>
<ul class="after">
<li><b>Cache Rules</b>: <code>/admin</code>과 <code>/api</code>는 우회하고, 나머지는 서버가 정한 시간만큼 모두 캐시합니다. <b>Rocket Loader는 끄세요</b>(스크립트 순서를 바꾸고 지연시켜 관리 화면을 망가뜨립니다). SSL: Full (Strict).</li>
<li>{t:navSettings} → {t:tabServer} → {t:cardCloudflare}에 Cloudflare API 토큰과 Zone ID를 넣으면, 저장할 때마다 영역이 알아서 비워집니다.</li>
<li>사이드바의 <b>{t:clearCache}</b>는 이 서버와 Cloudflare를 비운 뒤 홈페이지와 최신 페이지를 다시 데워 둡니다.</li>
<li>새 코드를 배포한 뒤에는 <code>GET /api/cron?purge=1</code>로 엣지를 비우세요. Cloudflare는 HTML을 캐시하므로, 오래된 페이지는 독자가 새로 고침으로 없앨 수 있는 것이 아닙니다.</li>
</ul>
<p class="links"><a href="https://developers.cloudflare.com/cache/how-to/cache-rules/">Cache Rules</a> <a href="doc:docs/seo-pwa.md">SEO와 캐시</a></p>`,
    },
    {
      id: 'mcp',
      title: 'MCP — AI에게 블로그 운영 맡기기',
      body: `<p>내장된 <b>MCP 서버</b>는 AI 에이전트에게 <b>관리 화면과 같은 규칙</b>을 줍니다. 글과 페이지를 쓰고 고치고, 이미지와 설정을 돌보며, 모든 변경은 당신의 것과 똑같이 검사되고 활동 로그에 기록됩니다. {t:navSettings} → {t:tabServer} → {t:cardMcp}에서 켜고 접근 토큰을 만드세요 — 토큰은 한 번만 표시되고 해시로만 저장됩니다.</p>
<p>같은 능력이 관리 화면 안에 <b>어시스턴트</b> 화면으로도 있으며, {t:navSettings} → {t:tabServer} → {t:cardAi}의 모델로 동작합니다 — MCP 클라이언트는 필요 없습니다. 어느 쪽으로 들어오든 에이전트는 <b>읽고 돌봅니다</b>. 이번 주 방문을 지난주와 비교하고, 댓글을 휴지통으로 쓸어 담고, 아카이브를 검색하고(초안 포함), 사람들이 실제로 읽는 것에 맞춰 첫 페이지를 다시 배치하고, 준비된 팔레트로 모양을 바꾸고, 뉴스레터 테스트 호를 당신에게만 보냅니다. <i>이번 주 블로그는 어땠나요?</i>라고 물으면 대시보드와 같은 숫자로 답합니다 — 아래의 <b>쿡북</b>은 실제 일을 해내는 프롬프트를 모은 페이지입니다.</p>
<p>선이 그어진 곳: 구독자 주소와 누가 어떤 댓글을 썼는지는 MCP를 넘어가지 않습니다. 모양은 준비된 선택지만 받고 임의의 색은 받지 않습니다. 삭제는 사라지지 않고 휴지통으로 갑니다. 그리고 실제 뉴스레터 발송은 <b>일부러 도구로 두지 않았습니다</b> — 보낸 메일은 되돌릴 수 없으니, 그 버튼은 당신 손에 남습니다.</p>
<p class="links"><a href="doc:docs/agent-cookbook.md">에이전트 쿡북</a> <a href="doc:docs/mcp.md">MCP 문서</a> <a href="/admin/settings?tab=server">{t:tabServer}</a> <a href="/admin/log">활동 로그</a></p>`,
    },
    {
      id: 'api',
      title: 'Content API — 프로그램이 블로그를 읽게 하기',
      body: `<p><b>Content API</b>는 게시된 글을 <code>/api/v1</code>에서 JSON으로 제공합니다 — 게시물, 페이지, 노트, 카테고리, 각각 작성된 Markdown과 함께. 블로그를 읽기보다는 블로그로 무언가를 만들기 위한 것입니다. 두 번째 프런트엔드, 검색 색인, 정적 사본, 자기 링크를 점검하는 스크립트 같은 것들. {t:navSettings} → {t:tabServer}에서 켜세요. 켜기 전까지는 그 주소들이 모두 <b>404</b>로 응답합니다.</p>
<p><b>읽기만 하고, 키가 없습니다.</b> 주소를 아는 사람은 누구나 읽을 수 있고, 얻는 것은 사이트를 둘러보며 이미 얻을 수 있던 것과 정확히 같습니다. 초안도, 날짜가 미래인 글도, 휴지통에 있는 것도 없고, 블로그를 바꿀 수 있는 것도 없습니다. 스위치가 있는 이유는 이것이 무엇을 가능하게 하느냐가 아니라 무엇을 <i>쉽게</i> 만드느냐 때문입니다 — 블로그 전체를 페이지 수만큼의 요청으로. 조용한 개인 블로그라면 편리한 기능입니다. 당신의 블로그에 맞게 정하세요.</p>
<p>프로그램에서 글을 쓰려면 위의 <b>MCP</b>나, 노트 앱에서 Micropub을 쓰세요. 둘 다 로그인하지만 이것은 로그인하지 않으며, 그래서 읽기만 할 수 있습니다.</p>
<p class="links"><a href="doc:docs/content-api.md">Content API 문서</a> <a href="/admin/settings?tab=server">{t:tabServer}</a></p>`,
    },
    {
      id: 'fediverse',
      title: '페디버스 — 사람들이 블로그를 팔로우하게 하기',
      body: `<p>이것을 켜면 블로그가 Mastodon — 또는 그 이웃 서비스 어디서든 — 누구나 팔로우할 수 있는 <b>계정</b>이 됩니다. 새 글은 제목, 요약문, 그리고 여기로 돌아오는 링크로 그들의 타임라인에 도착합니다. 글 자체는 블로그에 남아 있어 여전히 고칠 수 있습니다. 글을 고치면 정정이 전송되고, 휴지통으로 옮기면 철회됩니다.</p>
<p><b>핸들은 한 번만 정하세요.</b> 핸들은 <i>@name@yourdomain</i> 중 <i>@name</i> 부분이며, 로그인 이름이 아닙니다 — 로그인 이름은 비공개로 남습니다. 핸들과 사이트 주소는 <b>함께 바깥에서의 당신의 정체</b>입니다. 나중에 둘 중 하나라도 바꾸면 모든 팔로워를 잃습니다. 그들의 서버는 옛 이름을 계속 찾고, 당신이 어디로 갔는지 알려 주는 것은 아무것도 없기 때문입니다.</p>
<p>아직 일부러 하지 <b>않는</b> 일이 두 가지 있습니다. 게시는 하지만 읽지는 않습니다. 답글, 좋아요, 부스트는 블로그에 도착해도 버려지므로, Mastodon의 답글은 여기의 댓글이 되지 않습니다. 그리고 켜기 <i>전에</i> 쓴 글은 절대 전송되지 않습니다 — 켠다고 해서 아카이브가 누군가의 타임라인으로 밀려 들어가지 않습니다.</p>
<p class="links"><a href="doc:docs/fediverse.md">페디버스 문서</a> <a href="/admin/settings?tab=server">{t:tabServer}</a> <a href="/admin/log">활동 로그</a></p>`,
    },
  ],
  markdownTitle: '편집기가 이해하는 Markdown',
  markdownLede: '표준 Markdown에 더해 아래 문법을 씁니다. 대부분은 도구 모음이 대신 넣어 줍니다.',
  markdownHead: ['이렇게 입력하면', '이렇게 됩니다'],
  markdown: {
    '# … ######': '제목. 목차는 이것으로 만들어집니다.',
    '> [!NOTE]': '강조 상자. TIP, WARNING, IMPORTANT, CAUTION도 있습니다.',
    '==text==': '형광펜. ==text==#green으로 잉크를 고릅니다: 노랑, 초록, 분홍, 파랑, 주황.',
    '++text++': '연필 밑줄. ++text++#green은 다섯 잉크 중 하나로 선을 긋습니다.',
    '@@word@@': '단어를 두르는 볼펜 동그라미. @@word@@#blue로 잉크를 고르고, 지정하지 않으면 빨강입니다.',
    'text[^1]': '각주 참조. 각주 내용은 본문 어디에든 [^1]: 로 씁니다.',
    '![alt](url)': '이미지. 편집기에 파일을 끌어다 놓으면 이것을 대신 써 줍니다.',
    '![alt](url#frame)': '그 이미지에 두르는 액자. #frame-thin과 #frame-thick은 굵기를 바꾸고, ink는 액자를 어둡게 하며, #noframe은 액자를 쓰는 사이트에서 이미지 하나만 액자 없이 둡니다.',
    '```lang': '코드 블록. 서버에서 색을 입힙니다(독자의 브라우저에서 스크립트가 돌지 않음).',
    '---': '사이트 전체에서 쓰는 단 하나의 구분선.',
    'YouTube / Vimeo': '한 줄에 YouTube나 Vimeo 주소만 두면 페이지에 맞는 내장 플레이어가 됩니다.',
    'Spotify / Apple Music': '한 줄에 Spotify나 Apple Music 주소만 두면 내장 플레이어가 됩니다(외부 스크립트 없음).',
  },
  keysTitle: '편집기가 반응하는 키',
  keysLede: '흔히 쓰는 굵게, 기울임, 제목, 실행 취소에 더해.',
  keysHead: ['누르면', '이렇게 됩니다'],
  keys: {
    save: '저장. 초안은 초안으로, 게시된 글은 게시된 채로 남습니다. 그것을 바꾸는 것은 게시 버튼이나 패널의 상태뿐입니다. 자동 저장은 이 기기와 서버에 사본을 보관하지만, 글 자체를 쓰는 것은 저장뿐입니다.',
    link: '링크를 추가하거나, 커서가 들어 있는 링크를 고칩니다. 입력란을 비우면 링크가 지워집니다.',
    ink: '선택한 부분에 형광펜(==text==).',
    ring: '선택한 부분을 두르는 볼펜 동그라미(@@word@@).',
    clear: '선택한 부분의 모든 서식을 걷어 냅니다 — 다른 곳에서 붙여 넣은 글을 고치는 방법입니다.',
    attributes: '속성 패널: 주소, 날짜, 카테고리와 태그, 두 이미지, SEO 항목, 휴지통.',
    markdown: '글쓰기 화면과 Markdown 원문 사이를 전환합니다.',
    focus: '집중 모드: 종이만 남고 나머지는 모두 사라집니다.',
    find: '찾기. 어느 보기에서든 됩니다. Enter는 다음 일치로, Shift-Enter는 이전 일치로 가고, Escape로 닫습니다.',
    replace: '찾아 바꾸기: 같은 줄에 바꿀 내용 입력란이 열린 상태입니다. 줄 앞쪽의 화살표로도 열립니다.',
    palette: '모든 것을 검색: 화면, 설정, 그리고 당신의 글. 사이드바 맨 위의 버튼도 같습니다.',
    bold: '굵게.',
    italic: '기울임.',
    underline: '연필 밑줄(++text++).',
    strike: '취소선.',
    code: '글줄 안의 코드.',
    codeBlock: '코드 블록.',
    heading: '제목 수준 1부터 6까지 — 수준 2 제목은 Mod-Alt-2, 나머지도 같은 식입니다. Mod-Alt-0은 문단으로 되돌립니다.',
    bulletList: '글머리 기호 목록.',
    orderedList: '번호 목록.',
    taskList: '체크리스트.',
    blockquote: '인용. [!NOTE]로 시작하면 강조 상자가 됩니다.',
    undo: '실행 취소. Shift-Mod-Z는 다시 실행합니다.',
    hardBreak: '같은 문단 안에서 줄 바꿈.',
  },
  troubleTitle: '무언가 이상해 보일 때',
  troubleLede: '실제로 생기는 문제와 각각을 고치는 방법.',
  troubleHead: ['증상', '해결 방법'],
  trouble: [
    ['서버에서는 수정이 반영됐는데 독자는 여전히 옛 페이지를 봅니다', 'Cloudflare는 HTML을 캐시합니다. 사이드바의 {t:clearCache}를 쓰세요 — 브라우저를 새로 고쳐서는 엣지의 캐시를 고칠 수 없습니다.'],
    ['SMTP 테스트가 “wrong version number”로 실패합니다', '포트와 TLS가 맞지 않습니다. 465는 암시적 TLS(체크하세요), 587과 25는 STARTTLS(체크 해제하세요)입니다.'],
    ['구독자가 가입했는데 메일을 받지 못했습니다', '주소는 메일을 보내기 전에 저장되므로, SMTP가 고장 나도 가입은 남습니다. {t:navNewsletter} → {t:nlTabPeople}에서 실패 내용을 확인한 뒤 {t:navNewsletter} → {t:nlTabTest}를 쓰세요.'],
    ['예약한 글이 제시간에 공개되지 않았습니다', '서버가 돌아가고 있는 한 블로그는 정한 시각에서 1분 안에 알아서 게시합니다. 그 순간 서버가 꺼져 있었다면, 서버가 돌아오는 즉시 글이 공개됩니다.'],
    ['인증 앱이 없어졌는데 로그인에서 그 코드를 요구합니다', '코드 화면에서 “{t:authUseRecovery}”를 고르고 복구 코드 하나를 입력하세요. 각 코드는 한 번만 쓸 수 있습니다. 그다음 {t:navSettings} → {t:tabAccount}에서 새 코드를 만드세요.'],
    ['이름을 바꾼 뒤 옛 주소가 404를 냅니다', '이름을 바꾸면 301이 자동으로 추가됩니다. 그 주소가 여기에 존재한 적이 없다면 {t:navSettings} → {t:tabServer} → {t:redirectsTitle}에서 추가하세요.'],
    ['복원한 뒤 이미지가 사라졌습니다', '/api/health를 여세요 — 데이터베이스와 저장 폴더를 따로 보고합니다.'],
  ],
}

export default help
