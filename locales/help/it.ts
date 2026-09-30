import type { HelpText } from './types'

const help: HelpText = {
  intro: 'Tutto ciò che questo blog sa fare, e dove si trova ogni cosa. Se il sito è nuovo, parti dall’inizio; se stai cercando qualcosa, salta a una sezione.',
  index: {
    writing: 'Scrittura', media: 'Media', readers: 'Lettori', analytics: 'Statistiche', settings: 'Impostazioni',
    server: 'Server', cache: 'Cache', mcp: 'MCP', api: 'Content API', fediverse: 'Fediverso',
    markdown: 'Markdown', keys: 'Tastiera', trouble: 'Problemi',
  },
  sections: [
    {
      id: 'writing',
      title: 'Scrivere e pubblicare',
      body: `<ul>
<li>Markdown e una barra degli strumenti. Mentre scrivi, una copia viene <b>tenuta su questo dispositivo e sul server</b>; il testo vero e proprio cambia solo quando premi Salva o Pubblica, così modificare un articolo già online non mette mai sul sito un testo a metà.</li>
<li><b>Programma</b> pubblicando con una data futura: l’articolo resta nascosto e va online all’ora stabilita. Da solo <b>non</b> manda email a nessuno.</li>
<li>Di ogni articolo si conservano le ultime <b>3 versioni</b>; ripristinane una dall’editor.</li>
<li>Le <b>serie</b> raggruppano articoli correlati in ordine, con i link al precedente e al successivo e una pagina <code>/series/…</code>.</li>
<li>Ogni eliminazione finisce nel <b>cestino</b>. Niente viene rimosso per sempre in automatico — il cestino si svuota a mano.</li>
</ul>
<p class="links"><a href="/admin/editor">Nuovo articolo</a> <a href="/admin/content">Tutti i contenuti</a> <a href="/admin/trash">Cestino</a></p>`,
    },
    {
      id: 'media',
      title: 'Immagini e file',
      body: `<ul>
<li>Trascina un’immagine nell’editor o nella Libreria. Le versioni responsive <b>AVIF e WebP</b> e una miniatura vengono create per te; l’originale è sempre conservato.</li>
<li>Apri un’immagine nella Libreria per leggere o cambiare la sua <b>descrizione</b> (testo alternativo), le parole che sente al suo posto un lettore che non può vederla.</li>
<li>Ogni immagine può indossare una <b>cornice</b> — un passepartout di carta o d’inchiostro, in tre spessori — scelta sull’immagine stessa nell’editor. {t:navSettings} → {t:tabPost} → {t:cardPictures} imposta quella che indossa ogni immagine che non ha scelto; un’immagine che ha scelto tiene la sua.</li>
<li>La Libreria segnala i file <b>inutilizzati</b> (niente punta a loro), così fare pulizia è sicuro. Si limita a segnalare — non elimina mai.</li>
<li>I file stanno sul disco del tuo server, serviti da <code>/uploads</code>. Nessun account di object storage.</li>
</ul>
<p class="links"><a href="/admin/media">Apri la Libreria</a> <a href="/admin/settings?tab=post">{t:tabPost}</a></p>`,
    },
    {
      id: 'readers',
      title: 'Lettori — commenti e newsletter',
      body: `<p>Entrambi sono <b>spenti finché non li configuri</b>, ed entrambi sono tuoi: nessun servizio di terzi si mette tra te e i tuoi lettori.</p>
<ul class="after">
<li><b>Commenti</b> — attivali in {t:navSettings} → {t:tabPeople}. Cloudflare Turnstile contro lo spam e l’accesso con Google sono facoltativi. Puoi leggere ed eliminare i commenti nella schermata Commenti.</li>
<li><b>Newsletter</b> — inserisci i dati SMTP in {t:navSettings} → {t:tabPeople}, e un modulo d’iscrizione compare in fondo a ogni articolo, con un pulsante nell’intestazione del sito. L’iscrizione è a <b>doppio opt-in</b>: un indirizzo conta solo dopo aver cliccato il link di conferma.</li>
<li><b>L’invio è sempre manuale.</b> Niente parte per email in automatico, nemmeno un articolo programmato che va online. Spunti gli articoli, leggi l’email vera nell’anteprima e premi invia. Se ne spunti più d’uno partono come <b>un solo riepilogo</b>, non un messaggio ciascuno.</li>
<li>{t:navNewsletter} → {t:nlTabPeople} mostra che cosa ha ricevuto davvero ogni indirizzo, ogni errore SMTP con il suo messaggio e il tasso di apertura. {t:navNewsletter} → {t:nlTabTest} ti manda un esempio di ogni email prima che un lettore ne veda una.</li>
</ul>
<p class="links"><a href="/admin/newsletter">{t:navNewsletter}</a> <a href="/admin/comments">Commenti</a> <a href="/admin/settings?tab=people">{t:tabPeople}</a></p>`,
    },
    {
      id: 'analytics',
      title: 'Statistiche',
      body: `<ul>
<li><b>Niente cookie, nessun dato personale.</b> Un visitatore è un hash con sale dell’indirizzo e del browser, e la stringa del browser non viene mai salvata — solo gruppi generici di dispositivo, browser e sistema.</li>
<li>Bot, pagine dell’amministrazione e le tue visite sono esclusi, quindi i numeri sono lettori.</li>
<li>Visite, fin dove si scorre e quanto si resta; da dove arrivano; ogni articolo a sé. Conservate per sempre — non c’è una finestra mobile.</li>
</ul>
<p class="links"><a href="/admin/analytics">Apri le Statistiche</a></p>`,
    },
    {
      id: 'settings',
      title: 'Impostazioni',
      body: `<p>Un solo modulo e un solo Salva, applicati a tutto il sito <b>senza ridistribuire</b>. Sette schede:</p>
{tabs}
<p>Cerchi un’impostazione? Scrivine il nome nella ricerca in cima alla schermata Impostazioni.</p>
<p class="links"><a href="/admin/settings">Apri le Impostazioni</a></p>`,
    },
    {
      id: 'server',
      title: 'Server, backup e aggiornamenti',
      body: `<ul>
<li>Gira interamente sul <b>tuo server</b>: due file SQLite per i contenuti e le statistiche, e il disco locale per le immagini. Nativo o Docker, nessun account cloud.</li>
<li><code>/api/health</code> riporta separatamente il database e la cartella di archiviazione — puntaci il tuo monitor di uptime. Il server si rifiuta di partire quando manca un’impostazione obbligatoria, invece di partire configurato a metà.</li>
<li><b>Backup</b>: istantanee programmate (entrambi i database e ogni file) scritte sul tuo disco, una copia fuori dal server se ne aggiungi una, e un archivio da scaricare subito. {t:navSettings} → {t:tabServer} → {t:backupTitle}.</li>
<li>Gli aggiornamenti applicano <b>migrazioni del database tracciate</b>, così una modifica allo schema viene eseguita una volta e una sola.</li>
</ul>
<p class="links"><a href="doc:docs/self-host.md">Guida al self-hosting</a> <a href="doc:docs/backups.md">{t:backupTitle}</a></p>`,
    },
    {
      id: 'cache',
      title: 'Cloudflare e la cache',
      body: `<p>Metti Cloudflare davanti per il TLS e per una cache vicina a ogni lettore — il grande guadagno quando i lettori sono lontani dal tuo server.</p>
<ul class="after">
<li><b>Cache Rules</b>: salta la cache per <code>/admin</code> e <code>/api</code>, tieni in cache tutto il resto per il tempo che dice il server. <b>Disattiva Rocket Loader</b> (riordina e ritarda gli script, e questo rompe l’amministrazione). SSL: Full (Strict).</li>
<li>Aggiungi un token API di Cloudflare e lo Zone ID in {t:navSettings} → {t:tabServer} → {t:cardCloudflare}, e ogni salvataggio svuota la zona da solo.</li>
<li><b>{t:clearCache}</b>, nella barra laterale, svuota questo server e Cloudflare, poi riscalda la home e le pagine più recenti.</li>
<li>Dopo aver distribuito codice nuovo, svuota l’edge con <code>GET /api/cron?purge=1</code>. Cloudflare mette in cache l’HTML, quindi una pagina vecchia non è qualcosa che un lettore possa far sparire ricaricando.</li>
</ul>
<p class="links"><a href="https://developers.cloudflare.com/cache/how-to/cache-rules/">Cache Rules</a> <a href="doc:docs/seo-pwa.md">SEO e cache</a></p>`,
    },
    {
      id: 'mcp',
      title: 'MCP — lascia che un’IA gestisca il blog',
      body: `<p>Il <b>server MCP</b> integrato dà a un agente IA le <b>stesse regole dell’amministrazione</b>: scrivere e aggiornare articoli e pagine, curare immagini e impostazioni, ogni modifica controllata e scritta nel registro attività esattamente come le tue. Attivalo e crea i token di accesso in {t:navSettings} → {t:tabServer} → {t:cardMcp} — un token viene mostrato una volta sola e conservato solo come hash.</p>
<p>Le stesse capacità vivono dentro l’amministrazione nella schermata <b>Assistente</b>, che gira sul modello di {t:navSettings} → {t:tabServer} → {t:cardAi} — senza bisogno di un client MCP. Da qualunque delle due porte l’agente <b>legge e cura</b>: il traffico di questa settimana contro quello della scorsa, i commenti spazzati nel cestino, l’archivio cercato (bozze comprese), la prima pagina riordinata attorno a ciò che la gente legge davvero, l’aspetto rifatto con le palette pronte, un numero di prova della newsletter mandato solo a te. Chiedigli <i>com’è andato il mio blog questa settimana?</i> e risponde con i numeri del pannello stesso — il <b>ricettario</b> qui sotto è una pagina di prompt che fanno lavori veri.</p>
<p>Dove stanno i limiti: gli indirizzi degli iscritti e chi ha scritto quale commento non passano mai per MCP; l’aspetto accetta solo le scelte pronte, mai un colore libero; le eliminazioni vanno nel cestino, non spariscono; e inviare la newsletter vera <b>volutamente non è uno strumento</b> — un’email non si può ritirare, quindi quel pulsante resta tuo.</p>
<p class="links"><a href="doc:docs/agent-cookbook.md">Ricettario dell’agente</a> <a href="doc:docs/mcp.md">Documentazione MCP</a> <a href="/admin/settings?tab=server">{t:tabServer}</a> <a href="/admin/log">Registro attività</a></p>`,
    },
    {
      id: 'api',
      title: 'Content API — lascia che un programma legga il blog',
      body: `<p>La <b>Content API</b> serve i tuoi testi pubblicati come JSON su <code>/api/v1</code> — articoli, pagine, note e le tue categorie, ciascuno con il Markdown in cui è stato scritto. Serve a costruire qualcosa a partire dal blog invece che a leggerlo: un secondo front end, un indice di ricerca, una copia statica, uno script che ne controlla i link. Attivala in {t:navSettings} → {t:tabServer}; finché non lo fai, ognuno di quegli indirizzi risponde <b>404</b>.</p>
<p><b>Legge soltanto, e non ha chiave.</b> Chiunque conosca l’indirizzo può leggerla, e ciò che ottiene è esattamente quello che potrebbe già ottenere navigando il sito: niente bozze, niente articoli con data futura, niente di ciò che è nel cestino, e niente che possa cambiare il blog. L’interruttore c’è per ciò che rende <i>economico</i>, non per ciò che rende possibile — tutto il blog in tante richieste quante sono le sue pagine. Su un tranquillo blog personale è una comodità; per il tuo decidi tu.</p>
<p>Per scrivere da un programma, usa <b>MCP</b> qui sopra, o Micropub da un’app di appunti. Entrambi richiedono l’accesso; questa no, ed è per questo che può solo leggere.</p>
<p class="links"><a href="doc:docs/content-api.md">Documentazione della Content API</a> <a href="/admin/settings?tab=server">{t:tabServer}</a></p>`,
    },
    {
      id: 'fediverse',
      title: 'Fediverso — lascia che la gente segua il blog',
      body: `<p>Attivalo e il tuo blog diventa un <b>account</b> che chiunque su Mastodon — o su uno dei suoi vicini — può seguire. Un articolo nuovo arriva nella loro timeline come titolo, estratto e un link che riporta qui; il testo vero e proprio resta sul tuo blog, dove puoi ancora modificarlo. Modificare un articolo invia una correzione; spostarlo nel cestino lo ritira.</p>
<p><b>Scegli il tuo handle una volta sola.</b> È la metà <i>@name</i> di <i>@name@yourdomain</i>, e non è il tuo nome di accesso — quello resta privato. Il tuo handle e l’indirizzo del sito <b>insieme sono la tua identità</b> là fuori: cambiane uno dei due più avanti e perdi tutti i follower, perché il loro server continua a cercare il vecchio nome e niente gli dice dove sei andato.</p>
<p>Due cose che volutamente <b>non</b> fa ancora. Pubblica ma non legge: risposte, like e boost arrivano al tuo blog e vengono scartati, quindi una risposta su Mastodon non diventa un commento qui. E niente di ciò che hai scritto <i>prima</i> di attivarlo viene mai inviato — attivarlo non spinge il tuo archivio nella timeline di nessuno.</p>
<p class="links"><a href="doc:docs/fediverse.md">Documentazione del Fediverso</a> <a href="/admin/settings?tab=server">{t:tabServer}</a> <a href="/admin/log">Registro attività</a></p>`,
    },
  ],
  markdownTitle: 'Il Markdown che l’editor capisce',
  markdownLede: 'Markdown standard, più questi. La barra degli strumenti ne inserisce quasi tutti per te.',
  markdownHead: ['Scrivi questo', 'E ottieni'],
  markdown: {
    '# … ######': 'Titoli di sezione. L’indice si costruisce a partire da questi.',
    '> [!NOTE]': 'Un riquadro di avviso. Anche TIP, WARNING, IMPORTANT e CAUTION.',
    '==text==': 'Evidenziatore. ==text==#green sceglie l’inchiostro: yellow, green, pink, blue o orange.',
    '++text++': 'Sottolineatura a matita. ++text++#green traccia invece la linea in uno dei cinque inchiostri.',
    '@@word@@': 'Un cerchio a penna attorno a una parola. @@word@@#blue sceglie l’inchiostro; rosso se non ne indichi uno.',
    'text[^1]': 'Un rimando a una nota; scrivi la nota come [^1]: in qualsiasi punto del testo.',
    '![alt](url)': 'Un’immagine. Trascinare un file nell’editor la scrive per te.',
    '![alt](url#frame)': 'Un passepartout attorno a quell’immagine. #frame-thin e #frame-thick cambiano lo spessore, ink rende scuro il passepartout, e #noframe lascia semplice una sola immagine su un sito con le cornici.',
    '```lang': 'Codice delimitato, colorato sul server (nessuno script nel browser del lettore).',
    '---': 'L’unico stile di separatore usato in tutto il sito.',
    'YouTube / Vimeo': 'Un indirizzo YouTube o Vimeo su una riga a sé diventa un player incorporato che si adatta alla pagina.',
    'Spotify / Apple Music': 'Un indirizzo Spotify o Apple Music su una riga a sé diventa un player incorporato (nessuno script di terzi).',
  },
  keysTitle: 'I tasti a cui risponde l’editor',
  keysLede: 'Oltre ai soliti grassetto, corsivo, titoli e annulla.',
  keysHead: ['Premi', 'E fa'],
  keys: {
    save: 'Salva. Una bozza resta una bozza e un testo pubblicato resta pubblicato: lo cambia solo Pubblica, o lo stato nel pannello. Il salvataggio automatico tiene una copia su questo dispositivo e sul server, ma solo Salva scrive il testo vero e proprio.',
    link: 'Aggiunge un link, o modifica quello in cui si trova il cursore. Svuotare la casella lo toglie.',
    ink: 'Evidenziatore sulla selezione (==text==).',
    ring: 'Un cerchio a penna attorno alla selezione (@@word@@).',
    clear: 'Toglie ogni segno dalla selezione — il rimedio per il testo incollato da altrove.',
    attributes: 'Il pannello Attributi: indirizzo, data, categorie e tag, entrambe le immagini, i campi SEO e il cestino.',
    markdown: 'Passa dalla superficie di scrittura al sorgente Markdown e viceversa.',
    focus: 'Modalità concentrazione: sparisce tutto tranne il foglio.',
    find: 'Cerca, in entrambe le viste. Enter va al risultato successivo, Shift-Enter a quello precedente, Escape chiude.',
    replace: 'Cerca e sostituisci: la stessa striscia con il campo di sostituzione aperto. Si apre anche con la freccia al suo inizio.',
    palette: 'Cerca in tutto: le schermate, le impostazioni e i tuoi testi. È anche il pulsante in cima alla barra laterale.',
    bold: 'Grassetto.',
    italic: 'Corsivo.',
    underline: 'Sottolineatura a matita (++text++).',
    strike: 'Barrato.',
    code: 'Codice dentro una riga di testo.',
    codeBlock: 'Un blocco di codice.',
    heading: 'Titoli di livello da 1 a 6 — Mod-Alt-2 per un titolo di livello 2, e così via. Mod-Alt-0 torna a un paragrafo.',
    bulletList: 'Elenco puntato.',
    orderedList: 'Elenco numerato.',
    taskList: 'Lista di controllo.',
    blockquote: 'Citazione. Cominciala con [!NOTE] per un riquadro di avviso.',
    undo: 'Annulla. Shift-Mod-Z ripete.',
    hardBreak: 'Un a capo dentro lo stesso paragrafo.',
  },
  troubleTitle: 'Quando qualcosa non va',
  troubleLede: 'I problemi che capitano davvero, e che cosa risolve ciascuno.',
  troubleHead: ['Sintomo', 'Che cosa fare'],
  trouble: [
    ['Una modifica è online sul server ma i lettori vedono ancora la pagina vecchia', 'Cloudflare mette in cache l’HTML. Usa {t:clearCache} nella barra laterale — ricaricare il browser non può sistemare una cache sull’edge.'],
    ['La prova SMTP fallisce con «wrong version number»', 'La porta e il TLS non vanno d’accordo. 465 è TLS implicito (spunta la casella); 587 e 25 sono STARTTLS (lasciala senza spunta).'],
    ['Un iscritto si è registrato ma non ha ricevuto nessuna email', 'L’indirizzo viene salvato prima che parta la posta, così l’iscrizione sopravvive a un SMTP guasto. Cerca l’errore in {t:navNewsletter} → {t:nlTabPeople}, poi usa {t:navNewsletter} → {t:nlTabTest}.'],
    ['Un articolo programmato non è andato online in orario', 'Il blog lo pubblica da solo entro un minuto dall’ora stabilita, purché il server sia acceso. Se in quel momento il server era spento, l’articolo va online appena torna su.'],
    ['L’app di autenticazione non c’è più e l’accesso chiede il suo codice', 'Nella schermata del codice, scegli «{t:authUseRecovery}» e digita uno dei tuoi codici di recupero; ciascuno funziona una volta sola. Poi creane di nuovi in {t:navSettings} → {t:tabAccount}.'],
    ['Un vecchio indirizzo dà 404 dopo una rinomina', 'Rinominare aggiunge da solo un 301. Se l’indirizzo qui non è mai esistito, aggiungine uno in {t:navSettings} → {t:tabServer} → {t:redirectsTitle}.'],
    ['Le immagini sono sparite dopo un ripristino', 'Apri /api/health — riporta separatamente il database e la cartella di archiviazione.'],
  ],
}

export default help
