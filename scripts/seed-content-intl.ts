// EVERY non-English post, in the languages the bundled subsets actually cover. The sibling
// files split by category; this one splits by LANGUAGE and takes precedence, so a German post
// about typography is here rather than in `seed-content-type.ts`.
//
// That rule arrived by force: the split started as category-only and Typography came out at
// 429 lines against a 400-line cap. Pulling the non-English posts across fixed the overflow and
// left each rule meaning one thing.
//
// `seed-content.ts` always CLAIMED the harder scripts — its header names ogoneks, hačeks,
// dotless i and eth, and a specimen block quotes a line of each. What it did not have was a
// POST in any of them, so the front page carried titles in English, Vietnamese, German and
// French and nothing else. The claim was true of one blockquote and false of the demo.
//
// So these exist to be SEEN AS TITLES, at the size a headline is set, where a stacked diacritic
// either has room above it or visibly does not. That is the whole argument for subsetting by
// `unicode-range`, and it cannot be made by a quotation three screens down.
//
// EVERY LANGUAGE HERE IS LATIN OR LATIN-EXT (U+0100-02FF), which the real face covers. That is
// the line this file draws: CJK lives in `seed-content-cjk.ts`, so each file makes one claim —
// here, a glyph the bundled subset really carries; there, a glyph it never will.
import type { Seed } from './seed-content'

export const INTL_POSTS: Seed[] = [
  {
    title: 'Ogonek nie jest przecinkiem',
    slug: 'ogonek-nie-jest-przecinkiem',
    excerpt: 'Ogonek rośnie z litery, po tej samej krzywej, którą kończy się jej brzuszek. Przecinek doklejony pod spodem widać z drugiego końca pokoju — a przy ciasnej interlinii dotyka wersalika z następnego wiersza.',
    category: 'Typography', tags: ['diacritics', 'craft', 'polish'],
    ago: 5,
    body: `Polski ogonek jest jedynym znakiem diakrytycznym, który nie stoi obok litery ani nad nią. ==On z niej **wyrasta**.==#green W dobrze narysowanym kroju ą i ę mają ogonek wyprowadzony ze skoku pióra, po tej samej krzywej, którą kończy się brzuszek litery.

W źle narysowanym kroju ktoś wziął przecinek i przykleił go pod spodem.

## Jak to sprawdzić w dziesięć sekund

Powiększ ą do stu punktów i popatrz na miejsce styku. Jeśli widać kreskę łączenia — dwa osobne kształty, które się spotkały — to nie jest ogonek, to jest przecinek na dyżurze.

| | Prawdziwy ogonek | Doklejony przecinek |
|---|---|---|
| Połączenie | wyrasta z krzywej litery | widoczna kreska styku |
| Grubość | ta sama w ą i ę | różna, zależnie od litery |
| Kąt | zgodny z ruchem pióra | zawsze ten sam |

Druga próba: zestaw ą obok ę. W prawdziwym kroju oba ogonki są tej samej grubości i tego samego nachylenia, mimo że wychodzą z zupełnie innych liter. W podróbce jeden z nich zawsze wygląda na doklejony pod złym kątem.

## Dlaczego to widać w tekście

Bo ogonek schodzi poniżej linii pisma, dokładnie tam, gdzie kończy się interlinia. Przy ciasnym łamaniu ogonek z jednego wiersza dotyka wersalika z następnego, i strona zaczyna wyglądać na brudną, choć nikt nie potrafi wskazać dlaczego.

Zażółć gęślą jaźń — to zdanie zawiera wszystkie polskie znaki diakrytyczne. Ustaw je w swoim kroju, w swojej interlinii, i patrz na przestrzeń, nie na litery.`,
  },
  {
    title: 'Háček a rytmus české sazby',
    slug: 'hacek-a-rytmus-ceske-sazby',
    excerpt: 'Háček nad malým písmenem se vejde. Nad velkým se nevejde nikdy, a počítat se s tím musí dřív, než se nastaví proklad — jinak se Ř z jednoho řádku dotkne účaří řádku nad ním.',
    category: 'Calligraphy', tags: ['diacritics', 'rhythm', 'czech'],
    ago: 16,
    body: `Čeština klade na sazbu požadavek, který latinka původně neřešila: nad polovinou souhlásek stojí háček, a nad dlouhými samohláskami čárka. Písmo, které s tím nepočítá, se nerozbije — jen začne být o něco těsnější, řádek po řádku, až je stránka nečitelná a nikdo neví proč.

## Malé a velké není totéž

Nad **č**, **ř**, **ž** má háček dost místa: sedí v prostoru nad střední výškou, kam stejně sahají horní dotažnice. Nad **Č**, **Ř**, **Ž** už místo není. Verzálka je vysoká jako celý řádek, a háček musí někam.

==Kaligraf to řeší tak, že háček nad verzálkou zplošťuje a posouvá doprava==#green, po směru pera. Typograf to musí vyřešit proklademe — jinak háček z jednoho řádku narazí do dotažnice z předchozího.

>[!WARNING]
> Nikdy neřešte kolizi háčků tím, že háček zmenšíte. Ztratí váhu okolního písma a slovo pak vypadá vybledle — přesně to, co se stane u falešných kapitálek. Řešením je proklad, ne velikost znaménka.

## Zkouška, která funguje

Vysázejte nadpis samými verzálkami s háčky. Ne slovo, celý řádek. Pokud musíte prokládat víc než u stejného nadpisu bez diakritiky, není to vaše chyba — je to vlastnost písma, které háčky dostalo až dodatečně.

Příliš žluťoučký kůň úpěl ďábelské ódy. Deset diakritických znamének v jedné větě, a přesně proto se používá jako zkušební text.`,
  },
  {
    title: 'Noktasız ı ve baş harfin tuzağı',
    slug: 'noktasiz-i-ve-bas-harfin-tuzagi',
    excerpt: 'Türkçede i ve ı iki ayrı harftir, tıpkı o ile ö gibi. Yazılımın çoğu bunu bilmez, İstanbul’u ISTANBUL yapar, ve hatayı kimse bir veri tabanına yazılana kadar fark etmez.',
    category: 'Typography', tags: ['craft', 'letterforms', 'turkish'],
    ago: 27,
    body: `Latin alfabesini kullanan çoğu dilde **i** harfinin büyüğü **I**'dır. Türkçede değil. Türkçede dört harf vardır: noktalı **i** ve onun büyüğü **İ**, noktasız **ı** ve onun büyüğü **I**.

==Bu bir incelik değil. Anlamı değiştirir==#pink: @@*açık*@@ ile *acık*, *sıkı* ile *siki*.

## Tipografide nerede görünür

Noktasız ı, üzerinde hiçbir şey taşımayan tek küçük harftir; yanındaki noktalı harflerle aynı ritimde durması gerekir. Kötü çizilmiş bir yazı tipinde ı, i'nin noktası silinmiş hâli gibi durur — gövde aynıdır, ama üstteki boşluk artık hiçbir işe yaramaz ve satır orada delinir.

İyi çizilmiş bir yazı tipinde ı'nın gövdesi bir tık daha geniştir, çünkü üstünü dengeleyecek nokta yoktur.

## Büyük harfe çevirirken

Bir başlığı büyük harfe çeviren her kod parçası bu tuzağa düşer. **istanbul** kelimesi Türkçe kurallarla **İSTANBUL** olur, İngilizce kurallarla **ISTANBUL**. İkincisi Türkçede başka bir kelimedir.

\`\`\`js
'istanbul'.toUpperCase()          // ISTANBUL  — yanlış
'istanbul'.toLocaleUpperCase('tr') // İSTANBUL  — doğru
\`\`\`

Bu yüzden başlıkları büyük harfe *çevirmemek* en güvenli yoldur. Zaten okunabilirlik açısından da doğru olan budur: büyük harf bloğu, gözün kelime biçimini tanımak için kullandığı çıkıntıları siler.

Işık, yığın, İstanbul. Üç kelime, dört farklı i.`,
  },
  {
    title: 'Die Kunst der Kapitälchen',
    slug: 'die-kunst-der-kapitaelchen',
    excerpt: 'Echte Kapitälchen sind gezeichnet: eigene Strichstärke, eigene Laufweite, eigene Höhe. Alles andere ist verkleinerte Versalschrift, wirkt dünn und zu eng — und genau das tut der Browser, wenn die Schrift den Schnitt nicht mitbringt.',
    category: 'Typography', tags: ['small caps', 'craft'],
    ago: 34,
    body: `Kapitälchen sind der stillste Akzent, den die Typografie kennt. Sie heben ein Wort hervor, ohne die Zeile zu stören, weil sie die Höhe der Kleinbuchstaben behalten und trotzdem die Form der Großbuchstaben tragen.

==Der Unterschied zwischen echten und gefälschten Kapitälchen ist keine Feinheit.==#yellow ++Echte sind eigens gezeichnet++, mit kräftigeren Strichen und weiterem Abstand. Gefälschte entstehen, indem der Browser Versalien verkleinert — und dabei werden die Striche dünner als die der umgebenden Schrift, sodass das hervorgehobene Wort blasser wirkt als der Text, aus dem es herausstechen soll.

## Wo sie hingehören

An den Anfang eines Kapitels, für die erste Zeile nach einer Initiale. Für Abkürzungen, die sonst als Versalienblock die Zeile zerschneiden. Für Namen in einem Register.

Nicht für ganze Absätze. Kapitälchen sind schwerer zu lesen als Kleinbuchstaben, weil ihnen die Ober- und Unterlängen fehlen, an denen das Auge die Wortform erkennt.

## Ein Wort zur Sperrung

Kapitälchen brauchen mehr Laufweite als Kleinbuchstaben, aus demselben Grund wie Versalien: Ihre Formen sind breiter und gleichmäßiger, und ohne zusätzlichen Raum kleben sie aneinander.`,
  },
  {
    title: 'Eð og þorn: tveir stafir sem lifðu af',
    slug: 'ed-og-thorn-tveir-stafir',
    excerpt: 'Þorn og eð stóðu einu sinni í ensku líka. Íslenskan hélt þeim, og prentsmiðjurnar borguðu fyrir það í heila öld — með stöfum sem þurfti að steypa sérstaklega og týndust jafnóðum úr kassanum.',
    category: 'Printing', tags: ['history', 'letterforms', 'icelandic'],
    ago: 41,
    body: `==Stafirnir **þ** (þorn) og **ð** (eð) eru ekki skraut.==#green Þeir eru tvö ólík hljóð sem latneska stafrófið átti ekkert tákn fyrir, og norrænir skrifarar bjuggu þau til vegna þess að þeir þurftu þau.

Enska notaði þorn líka, öldum saman. Hún missti hann ekki af málfræðilegum ástæðum heldur af prenttæknilegum: fyrstu prentletrin voru flutt inn frá Hollandi og Þýskalandi, og í þeim kössum var enginn þorn. Prentarar settu **y** í staðinn, því formið líktist.[^1] Þaðan kemur *ye olde* — sem var aldrei borið fram með ípsíloni.[^2]

[^1]: Fyrstu ensku prentletrin komu frá Flæmingjalandi og Þýskalandi, þar sem þorn hafði aldrei verið notaður.
[^2]: Skammstöfunin var rituð með upphækkuðu e yfir þorn, og prentarar settu einfaldlega **ye**.

## Hvað þetta kennir um leturval

Íslenska er prófsteinn á það hvort letur var teiknað eða sett saman. Þorn er hástafur að ofan og lágstafur að neðan í einum staf; eð er ð með þverstriki sem verður að hafa nákvæmlega sömu þykkt og strikin í kring.

Í letri þar sem þessir tveir stafir voru teiknaðir eftir á sést það strax: þverstrikið á ð er of grannt, og leggurinn á þ nær ekki alveg upp í hástafahæð.

## Og um bil

Þorn og eð eru báðir háir stafir í máli þar sem broddstafir — á, é, í, ó, ú, ý — sitja ofan á miðhæðinni. Línubil sem dugir fyrir ensku dugir sjaldnast fyrir íslensku.

Það þótti æði. Fjögur orð, og letrið er annaðhvort tilbúið eða ekki.`,
  },
  {
    title: 'La chasse, l’approche et le gris typographique',
    slug: 'la-chasse-et-l-approche',
    excerpt: 'Trois mots français pour trois choses que l’anglais confond sous le seul mot spacing. La chasse appartient à la lettre, l’approche au couple, le gris à la page entière — et l’un ne corrige jamais l’autre.',
    category: 'Typography', tags: ['kerning', 'tracking', 'craft'],
    ago: 48,
    body: `Le français distingue ce que l'anglais mélange. La **chasse** est la largeur propre d'un caractère, gravée dans la fonte. L'**approche** est l'espace entre deux caractères. Le **gris typographique** est la teinte moyenne que produit un bloc de texte quand on le regarde de loin, les yeux mi-clos.

==Ces trois notions ne se règlent pas au même endroit==#orange, et les confondre est la source de la plupart des pages mal composées.

## Le crénage n'est pas l'interlettrage

Le crénage corrige une paire précise : **AV**, **To**, **Ye**. Il est inscrit dans la fonte par le dessinateur, qui a vu le problème avant vous.

L'interlettrage agit sur tout un bloc. On l'ouvre légèrement pour les capitales et les petites capitales, on le resserre un peu pour les grands corps. Sur un texte courant, y toucher revient presque toujours à abîmer le gris.

## Regarder le gris plutôt que les lettres

Pour juger une composition, éloignez-vous jusqu'à ne plus lire. Les mots deviennent une texture. Si cette texture montre des trous, des rivières blanches qui descendent le long du bloc, le problème est dans la justification, pas dans la police.

Same test, other languages: Íslenska, Čeština, Türkçe. Cùng một phép thử với tiếng Việt.`,
  },
  {
    title: 'Thư pháp và nhịp thở',
    slug: 'thu-phap-va-nhip-tho',
    excerpt: 'Nét chữ đẹp không đến từ cổ tay. Nó đến từ chỗ người viết quyết định dừng lại, và từ nhịp thở giữa hai nét — thứ không cây bút nào dạy được cho người đang cầm nó.',
    category: 'Calligraphy', tags: ['vietnamese', 'practice', 'rhythm'],
    ago: 96,
    body: `Người mới học thư pháp thường tập trung vào hình dáng từng chữ. ==Người viết lâu năm tập trung vào khoảng nghỉ giữa các chữ==#green, vì đó mới là chỗ quyết định cả trang giấy nhìn có sống hay không.

Một dòng chữ đẹp có nhịp. Nét xuống nặng, nét lên nhẹ, rồi một quãng ngắt trước khi bắt đầu chữ tiếp theo. Nhịp ấy đến từ hơi thở của người viết chứ không từ thước kẻ, và đó là lý do một dòng chép lại từ bản mẫu bao giờ cũng cứng hơn bản gốc.

## Ba lỗi thường gặp

Thứ nhất là viết quá chậm. Nét chậm bị run, và mực đọng lại ở chỗ ngòi dừng, làm dày lên những chỗ lẽ ra phải mảnh.

Thứ hai là cố sửa một nét đã viết hỏng. Trong thư pháp không có nút hoàn tác; một nét sửa bao giờ cũng lộ hơn một nét sai.

Thứ ba là canh chữ theo từng chữ thay vì theo cả dòng. Mắt đọc theo dòng, nên một dòng có nhịp đều sẽ đẹp hơn một dòng gồm toàn những chữ đẹp rời rạc.

## Tập gì trước

Tập một nét duy nhất, lặp lại kín một trang, cho tới khi nét thứ năm mươi giống nét đầu tiên. Đó là bài tập chán nhất và cũng là bài tập duy nhất thật sự có tác dụng.`,
  },
  {
    title: 'Dấu phụ tiếng Việt và chiều cao chữ hoa',
    slug: 'dau-phu-tieng-viet',
    excerpt: 'Chữ Quốc ngữ chồng hai dấu lên cùng một nguyên âm: một dấu chất lượng, một dấu thanh. Đó là bài kiểm tra khắc nghiệt nhất cho khoảng cách dòng, và là lý do một trang tiếng Việt cần thoáng hơn tiếng Anh chừng hai phần mười.',
    category: 'Typography', tags: ['vietnamese', 'diacritics', 'leading'],
    ago: 104,
    body: `Tiếng Việt là một trong số ít chữ viết Latinh chồng **hai** dấu lên cùng một nguyên âm: một dấu phụ chỉ âm, một dấu thanh. Chữ **ế** mang mũ rồi mang sắc; chữ **ườ** mang móc rồi mang huyền.

Hệ quả là phần trên của dòng chữ tiếng Việt cao hơn hầu hết các ngôn ngữ khác dùng cùng bộ chữ cái. Một khoảng cách dòng vừa đủ cho tiếng Anh sẽ khiến dấu sắc của dòng dưới chạm vào chân chữ **g** hoặc **y** của dòng trên.

## Ba chỗ hay hỏng

==Chữ hoa có dấu là chỗ hỏng đầu tiên==#orange: **Ế**, **Ộ**, **Ữ** đẩy dấu lên trên cả chiều cao chữ hoa, nên tiêu đề viết hoa toàn phần gần như luôn phải nới thêm.

Chỗ thứ hai là tiêu đề cỡ lớn, nơi khoảng cách dòng thường bị siết xuống dưới 1.1. Với tiếng Anh thì đẹp, với tiếng Việt thì dấu chồng lên nhau.

Chỗ thứ ba là font không thật sự hỗ trợ tiếng Việt mà chỉ có sẵn vài chữ dựng tạm. Dấu sẽ đúng hình nhưng sai vị trí, và người đọc nhận ra ngay dù không gọi tên được vấn đề.

## Cách kiểm nhanh

Đặt cạnh nhau hai dòng chữ hoa có dấu, để khoảng cách dòng bạn định dùng, rồi nhìn khoảng trống giữa chúng. Nếu phải nhìn kỹ mới thấy nó đủ, tức là chưa đủ.

Deutsch, Polski und Türkçe stellen dieselbe Frage in kleinerem Maßstab: Größe, zażółć, ışık.`,
  },
  {
    title: 'Der Blocksatz und die Lücke',
    slug: 'der-blocksatz-und-die-luecke',
    excerpt: 'Blocksatz ohne Silbentrennung ist der häufigste Satzfehler im Web: Löcher, die sich über drei Zeilen zu einem Bach zusammenschließen. Zu beheben ist er in einer einzigen CSS-Zeile, die fast niemand hinschreibt.',
    category: 'Typography', tags: ['justification', 'hyphenation', 'craft'],
    ago: 112,
    body: `Blocksatz sieht ordentlich aus, solange die Spalte breit genug ist. Wird sie schmal, verteilt der Browser den fehlenden Platz auf die Wortzwischenräume einer Zeile — und weil er nur ganze Wörter umbrechen kann, entstehen Löcher.

Übereinander stehende Löcher ergeben eine **Gießbachbildung**: ein weißer Fluss, der senkrecht durch den Absatz läuft. Das Auge folgt ihm, statt der Zeile zu folgen.

## Die Ursache ist fast nie der Blocksatz

==Sie ist die fehlende Silbentrennung.==#green Ohne sie muss jede Zeile mit ganzen Wörtern gefüllt werden, und im Deutschen sind die Wörter lang.

| Spaltenbreite | Ohne Trennung | Mit Trennung |
|---|---|---|
| 30 Zeichen | unbrauchbar | grenzwertig |
| 45 Zeichen | Gießbäche | brauchbar |
| 66 Zeichen | brauchbar | gut |
| 90 Zeichen | gut | zu breit zum Lesen |

## Was zu tun ist

Entweder \`hyphens: auto\` mit korrekt gesetztem \`lang\`-Attribut — ohne das Attribut weiß der Browser nicht, nach welchen Regeln er trennen soll, und trennt gar nicht. Oder Flattersatz.

Flattersatz ist keine Niederlage. Er ist auf schmalen Spalten fast immer die bessere Wahl, weil der Wortabstand konstant bleibt und nur der rechte Rand unruhig wird. Ein unruhiger Rand stört das Lesen deutlich weniger als ein unruhiger Grauwert.

## Der Sonderfall

Bei sehr schmalen Spalten — Bildunterschriften, Marginalien, alles unter etwa 30 Zeichen — ist Blocksatz auch mit Trennung unbrauchbar. Dort gibt es keine Diskussion: Flattersatz, linksbündig, und der Rand darf so ausfransen, wie er will.`,
  },
]
