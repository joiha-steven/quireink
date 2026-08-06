// The demo's non-English posts, in the languages the bundled subsets actually cover.
//
// `seed-content.ts` has always CLAIMED these: its header names "Polish ogoneks, Czech
// hačeks, Turkish dotless i and Icelandic eth", and a specimen block inside one post quotes
// a line of each. What it did not have was a post in any of them, so the front page — the
// thing anyone actually looks at — carried titles in English, Vietnamese, German and French
// and nothing else. The claim was true of one blockquote and false of the demo.
//
// So these four exist to be SEEN AS TITLES, at the size a headline is set, where a stacked
// diacritic either has room above it or visibly does not. That is the whole argument for
// subsetting by `unicode-range` (`src/render/font-faces.ts`), and it cannot be made by a
// quotation buried three screens down.
//
// CJK stays out, deliberately and for the same reason it always has: no bundled subset
// carries it, so a Japanese title would fall back to a system font and demonstrate the
// opposite of the point. Every language here is latin or latin-ext (U+0100-02FF), which the
// real face covers — ogonek, háček, dotless i, eth and thorn included.
import type { Seed } from './seed-content'

export const INTL_POSTS: Seed[] = [
  {
    title: 'Ogonek nie jest przecinkiem',
    slug: 'ogonek-nie-jest-przecinkiem',
    excerpt: 'Ogonek rośnie z litery. Przecinek doklejony pod spodem widać z drugiego końca pokoju.',
    category: 'Typography', tags: ['diacritics', 'craft', 'polish'],
    ago: 5,
    body: `Polski ogonek jest jedynym znakiem diakrytycznym, który nie stoi obok litery ani nad nią. On z niej **wyrasta**. W dobrze narysowanym kroju ą i ę mają ogonek wyprowadzony ze skoku pióra, po tej samej krzywej, którą kończy się brzuszek litery.

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
    excerpt: 'Háček nad malým písmenem se vejde. Nad velkým se nevejde nikdy, a s tím se musí počítat předem.',
    category: 'Calligraphy', tags: ['diacritics', 'rhythm', 'czech'],
    ago: 16,
    body: `Čeština klade na sazbu požadavek, který latinka původně neřešila: nad polovinou souhlásek stojí háček, a nad dlouhými samohláskami čárka. Písmo, které s tím nepočítá, se nerozbije — jen začne být o něco těsnější, řádek po řádku, až je stránka nečitelná a nikdo neví proč.

## Malé a velké není totéž

Nad **č**, **ř**, **ž** má háček dost místa: sedí v prostoru nad střední výškou, kam stejně sahají horní dotažnice. Nad **Č**, **Ř**, **Ž** už místo není. Verzálka je vysoká jako celý řádek, a háček musí někam.

Kaligraf to řeší tak, že háček nad verzálkou zplošťuje a posouvá doprava, po směru pera. Typograf to musí vyřešit proklademe — jinak háček z jednoho řádku narazí do dotažnice z předchozího.

>[!WARNING]
> Nikdy neřešte kolizi háčků tím, že háček zmenšíte. Ztratí váhu okolního písma a slovo pak vypadá vybledle — přesně to, co se stane u falešných kapitálek. Řešením je proklad, ne velikost znaménka.

## Zkouška, která funguje

Vysázejte nadpis samými verzálkami s háčky. Ne slovo, celý řádek. Pokud musíte prokládat víc než u stejného nadpisu bez diakritiky, není to vaše chyba — je to vlastnost písma, které háčky dostalo až dodatečně.

Příliš žluťoučký kůň úpěl ďábelské ódy. Deset diakritických znamének v jedné větě, a přesně proto se používá jako zkušební text.`,
  },
  {
    title: 'Noktasız ı ve baş harfin tuzağı',
    slug: 'noktasiz-i-ve-bas-harfin-tuzagi',
    excerpt: 'Türkçede i ve ı iki ayrı harftir. Yazılımın çoğu bunu bilmez ve İstanbul’u ISTANBUL yapar.',
    category: 'Typography', tags: ['craft', 'letterforms', 'turkish'],
    ago: 27,
    body: `Latin alfabesini kullanan çoğu dilde **i** harfinin büyüğü **I**'dır. Türkçede değil. Türkçede dört harf vardır: noktalı **i** ve onun büyüğü **İ**, noktasız **ı** ve onun büyüğü **I**.

Bu bir incelik değil. Anlamı değiştirir: *açık* ile *acık*, *sıkı* ile *siki*.

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
    title: 'Eð og þorn: tveir stafir sem lifðu af',
    slug: 'ed-og-thorn-tveir-stafir',
    excerpt: 'Þorn og eð stóðu einu sinni í ensku líka. Íslenska hélt þeim, og prentsmiðjurnar borguðu fyrir það.',
    category: 'Printing', tags: ['history', 'letterforms', 'icelandic'],
    ago: 41,
    body: `Stafirnir **þ** (þorn) og **ð** (eð) eru ekki skraut. Þeir eru tvö ólík hljóð sem latneska stafrófið átti ekkert tákn fyrir, og norrænir skrifarar bjuggu þau til vegna þess að þeir þurftu þau.

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
]
