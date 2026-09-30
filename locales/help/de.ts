import type { HelpText } from './types'

const help: HelpText = {
  intro: 'Alles, was dieses Blog kann, und wo jedes Ding zu finden ist. Fangen Sie oben an, wenn die Website neu ist; springen Sie zu einem Abschnitt, wenn Sie etwas nachschlagen.',
  index: {
    writing: 'Schreiben', media: 'Medien', readers: 'Leser', analytics: 'Statistik', settings: 'Einstellungen',
    server: 'Server', cache: 'Cache', mcp: 'MCP', api: 'Content-API', fediverse: 'Fediverse',
    markdown: 'Markdown', keys: 'Tastatur', trouble: 'Fehlerbehebung',
  },
  sections: [
    {
      id: 'writing',
      title: 'Schreiben und veröffentlichen',
      body: `<ul>
<li>Markdown plus eine Werkzeugleiste. Während Sie tippen, wird eine Kopie <b>auf diesem Gerät und auf dem Server aufbewahrt</b>; der Text selbst ändert sich erst mit Speichern oder Veröffentlichen, deshalb landet beim Bearbeiten eines veröffentlichten Beitrags nie halbfertiger Text auf der Website.</li>
<li><b>Planen</b>: Veröffentlichen Sie mit einem Datum in der Zukunft — der Beitrag bleibt verborgen und geht pünktlich online. Er verschickt dabei <b>keine</b> E-Mail von sich aus.</li>
<li>Die letzten <b>3 Versionen</b> jedes Beitrags werden aufbewahrt; im Editor stellen Sie eine davon wieder her.</li>
<li><b>Serien</b> fassen zusammengehörige Beiträge in einer Reihenfolge zusammen, mit Links zum vorherigen und nächsten Beitrag und einer Seite unter <code>/series/…</code>.</li>
<li>Alles Gelöschte landet im <b>Papierkorb</b>. Nichts wird automatisch endgültig entfernt — den Papierkorb leeren Sie von Hand.</li>
</ul>
<p class="links"><a href="/admin/editor">Neuer Beitrag</a> <a href="/admin/content">Alle Inhalte</a> <a href="/admin/trash">Papierkorb</a></p>`,
    },
    {
      id: 'media',
      title: 'Medien und Dateien',
      body: `<ul>
<li>Ziehen Sie ein Bild in den Editor oder in die Bibliothek. Responsive Versionen in <b>AVIF und WebP</b> und ein Thumbnail werden für Sie erzeugt; das Original bleibt immer erhalten.</li>
<li>Öffnen Sie ein Bild in der Bibliothek, um seine <b>Beschreibung</b> (Alt-Text) zu lesen oder zu ändern — die Worte, die ein Leser hört, der es nicht sehen kann.</li>
<li>Jedes Bild kann einen <b>Rahmen</b> tragen — ein Passepartout aus Papier oder aus Tinte, in drei Stärken —, gewählt direkt am Bild im Editor. {t:navSettings} → {t:tabPost} → {t:cardPictures} legt den fest, den jedes Bild trägt, das keinen gewählt hat; ein Bild, das einen gewählt hat, behält seinen eigenen.</li>
<li>Die Bibliothek markiert <b>unbenutzte</b> Dateien (nichts verlinkt auf sie), damit Aufräumen sicher ist. Sie meldet nur — sie löscht nie.</li>
<li>Dateien liegen auf der eigenen Festplatte Ihres Servers und werden unter <code>/uploads</code> ausgeliefert. Kein Konto bei einem Objektspeicher.</li>
</ul>
<p class="links"><a href="/admin/media">Bibliothek öffnen</a> <a href="/admin/settings?tab=post">{t:tabPost}</a></p>`,
    },
    {
      id: 'readers',
      title: 'Leser — Kommentare und Newsletter',
      body: `<p>Beides ist <b>aus, bis Sie es einrichten</b>, und beides gehört Ihnen: Kein fremder Dienst steht zwischen Ihnen und Ihren Lesern.</p>
<ul class="after">
<li><b>Kommentare</b> — schalten Sie sie unter {t:navSettings} → {t:tabPeople} ein. Cloudflare Turnstile gegen Spam und die Anmeldung mit Google sind optional. Auf dem Bildschirm Kommentare können Sie Kommentare lesen und löschen.</li>
<li><b>Newsletter</b> — tragen Sie Ihre SMTP-Daten unter {t:navSettings} → {t:tabPeople} ein, dann erscheint am Ende jedes Beitrags ein Anmeldeformular, dazu ein Knopf im Kopf der Website. Die Anmeldung ist <b>Double-Opt-in</b>: Eine Adresse zählt erst, wenn sie den Bestätigungslink angeklickt hat.</li>
<li><b>Versendet wird immer von Hand.</b> Nichts geht automatisch per E-Mail raus, nicht einmal, wenn ein geplanter Beitrag online geht. Sie haken die Beiträge an, lesen in der Vorschau die echte E-Mail und drücken auf Senden. Haken Sie mehrere an, gehen sie als <b>eine Sammel-E-Mail</b> raus, nicht als je eine Nachricht.</li>
<li>{t:navNewsletter} → {t:nlTabPeople} zeigt, was jede Adresse tatsächlich bekommen hat, jeden SMTP-Fehler mit seiner Meldung und die Öffnungsrate. {t:navNewsletter} → {t:nlTabTest} schickt Ihnen ein Muster jeder E-Mail, bevor ein Leser je eine sieht.</li>
</ul>
<p class="links"><a href="/admin/newsletter">{t:navNewsletter}</a> <a href="/admin/comments">Kommentare</a> <a href="/admin/settings?tab=people">{t:tabPeople}</a></p>`,
    },
    {
      id: 'analytics',
      title: 'Statistik',
      body: `<ul>
<li><b>Keine Cookies, keine personenbezogenen Daten.</b> Ein Besucher ist ein gesalzener Hash aus Adresse und Browser, und die Browser-Kennung selbst wird nie gespeichert — nur grobe Gruppen für Gerät, Browser und System.</li>
<li>Bots, Verwaltungsseiten und Ihre eigenen Besuche werden nicht mitgezählt, die Zahlen sind also Leser.</li>
<li>Aufrufe, wie weit die Leute scrollen und wie lange sie bleiben; woher sie kamen; jeder Beitrag für sich. Dauerhaft aufbewahrt — es gibt kein rollendes Zeitfenster.</li>
</ul>
<p class="links"><a href="/admin/analytics">Statistik öffnen</a></p>`,
    },
    {
      id: 'settings',
      title: 'Einstellungen',
      body: `<p>Ein Formular und ein Speichern, wirksam für die ganze Website <b>ohne neues Deployment</b>. Sieben Tabs:</p>
{tabs}
<p>Suchen Sie eine bestimmte Einstellung? Tippen Sie ihren Namen in die Suche oben auf dem Bildschirm Einstellungen.</p>
<p class="links"><a href="/admin/settings">Einstellungen öffnen</a></p>`,
    },
    {
      id: 'server',
      title: 'Server, Backups und Upgrades',
      body: `<ul>
<li>Läuft komplett auf <b>Ihrem eigenen Server</b>: zwei SQLite-Dateien für die Inhalte und die Statistik, dazu die lokale Festplatte für Bilder. Nativ oder mit Docker, ohne Cloud-Konto.</li>
<li><code>/api/health</code> meldet die Datenbank und den Speicherordner getrennt — richten Sie Ihre Uptime-Überwachung darauf. Der Server verweigert den Start, wenn eine erforderliche Einstellung fehlt, statt halb konfiguriert zu starten.</li>
<li><b>Backups</b>: geplante Snapshots (beide Datenbanken und jede Datei) auf Ihre eigene Festplatte, eine Kopie außerhalb des Servers, wenn Sie eine einrichten, und ein Archiv zum sofortigen Download. {t:navSettings} → {t:tabServer} → {t:backupTitle}.</li>
<li>Upgrades wenden <b>nachverfolgte Datenbankmigrationen</b> an, sodass eine Schemaänderung genau einmal läuft.</li>
</ul>
<p class="links"><a href="doc:docs/self-host.md">Anleitung zum Selbsthosten</a> <a href="doc:docs/backups.md">{t:backupTitle}</a></p>`,
    },
    {
      id: 'cache',
      title: 'Cloudflare und der Cache',
      body: `<p>Stellen Sie Cloudflare davor, für TLS und einen Cache nahe bei jedem Leser — der große Gewinn, wenn Ihre Leser weit von Ihrem Server entfernt sind.</p>
<ul class="after">
<li><b>Cache Rules</b>: <code>/admin</code> und <code>/api</code> umgehen, alles andere so lange cachen, wie der Server angibt. Schalten Sie <b>Rocket Loader aus</b> (er ordnet Skripte um und verzögert sie, was die Verwaltung kaputt macht). SSL: Full (Strict).</li>
<li>Tragen Sie ein Cloudflare-API-Token und die Zone ID unter {t:navSettings} → {t:tabServer} → {t:cardCloudflare} ein, dann leert jedes Speichern die Zone von selbst.</li>
<li><b>{t:clearCache}</b> in der Seitenleiste leert diesen Server und Cloudflare und wärmt danach die Startseite und die neuesten Seiten wieder vor.</li>
<li>Leeren Sie nach dem Deployment von neuem Code die Edge mit <code>GET /api/cron?purge=1</code>. Cloudflare cacht HTML, eine veraltete Seite kann ein Leser also nicht einfach durch Neuladen loswerden.</li>
</ul>
<p class="links"><a href="https://developers.cloudflare.com/cache/how-to/cache-rules/">Cache Rules</a> <a href="doc:docs/seo-pwa.md">SEO und Caching</a></p>`,
    },
    {
      id: 'mcp',
      title: 'MCP — eine KI das Blog führen lassen',
      body: `<p>Der eingebaute <b>MCP-Server</b> gibt einem KI-Agenten <b>dieselben Regeln wie die Verwaltung</b>: Beiträge und Seiten schreiben und aktualisieren, sich um Bilder und Einstellungen kümmern, jede Änderung geprüft und genau wie Ihre ins Aktivitätsprotokoll geschrieben. Schalten Sie ihn ein und erstellen Sie Zugriffstokens unter {t:navSettings} → {t:tabServer} → {t:cardMcp} — ein Token wird einmal angezeigt und nur als Hash gespeichert.</p>
<p>Dieselben Fähigkeiten gibt es in der Verwaltung als Bildschirm <b>Assistent</b>, der mit dem Modell aus {t:navSettings} → {t:tabServer} → {t:cardAi} läuft — kein MCP-Client nötig. Durch beide Türen <b>liest und pflegt</b> der Agent: Er stellt den Traffic dieser Woche dem der letzten gegenüber, fegt Kommentare in den Papierkorb, durchsucht das Archiv (Entwürfe inklusive), ordnet die Titelseite um das herum, was die Leute tatsächlich lesen, gestaltet das Aussehen aus den fertigen Paletten neu und schickt eine Testausgabe des Newsletters nur an Sie. Fragen Sie ihn <i>Wie lief mein Blog diese Woche?</i>, und er antwortet mit den Zahlen der Übersicht selbst — das <b>Kochbuch</b> unten ist eine Seite voller Prompts, die echte Arbeit erledigen.</p>
<p>Wo die Grenzen liegen: Abonnentenadressen und wer welchen Kommentar geschrieben hat, gehen nie über MCP; beim Aussehen gelten nur die fertigen Auswahlen, nie eine freie Farbe; Gelöschtes landet im Papierkorb, nicht im Nichts; und den echten Newsletter zu versenden ist <b>bewusst kein Werkzeug</b> — eine E-Mail lässt sich nicht zurückholen, also bleibt dieser Knopf bei Ihnen.</p>
<p class="links"><a href="doc:docs/agent-cookbook.md">Agenten-Kochbuch</a> <a href="doc:docs/mcp.md">MCP-Doku</a> <a href="/admin/settings?tab=server">{t:tabServer}</a> <a href="/admin/log">Aktivitätsprotokoll</a></p>`,
    },
    {
      id: 'api',
      title: 'Content-API — ein Programm das Blog lesen lassen',
      body: `<p>Die <b>Content-API</b> liefert Ihre veröffentlichten Texte als JSON unter <code>/api/v1</code> — Beiträge, Seiten, Notizen und Ihre Kategorien, jeweils mit dem Markdown, in dem sie geschrieben wurden. Sie ist dafür da, etwas aus dem Blog zu bauen, statt es zu lesen: ein zweites Frontend, einen Suchindex, eine statische Kopie, ein Skript, das die eigenen Links prüft. Schalten Sie sie unter {t:navSettings} → {t:tabServer} ein; bis dahin antwortet jede dieser Adressen mit <b>404</b>.</p>
<p><b>Sie liest nur, und sie hat keinen Schlüssel.</b> Wer die Adresse kennt, kann sie lesen, und bekommt genau das, was er beim Durchblättern der Website ohnehin schon bekäme: keine Entwürfe, keine vordatierten Beiträge, nichts aus dem Papierkorb und nichts, was das Blog verändern kann. Den Schalter gibt es wegen dessen, was sie <i>billig</i> macht, nicht wegen dessen, was sie möglich macht — das ganze Blog in so vielen Anfragen, wie es Seiten hat. Auf einem ruhigen persönlichen Blog ist das eine Bequemlichkeit; entscheiden Sie für Ihres.</p>
<p>Um aus einem Programm zu schreiben, nehmen Sie <b>MCP</b> oben oder Micropub aus einer Notiz-App. Beide melden sich an; diese hier nicht, und deshalb darf sie nur lesen.</p>
<p class="links"><a href="doc:docs/content-api.md">Content-API-Doku</a> <a href="/admin/settings?tab=server">{t:tabServer}</a></p>`,
    },
    {
      id: 'fediverse',
      title: 'Fediverse — Leute dem Blog folgen lassen',
      body: `<p>Schalten Sie das ein, und Ihr Blog wird ein <b>Konto</b>, dem jeder auf Mastodon — oder bei einem seiner Nachbarn — folgen kann. Ein neuer Beitrag erscheint in deren Timeline als Titel, Vorspann und Link hierher zurück; der Text selbst bleibt auf Ihrem Blog, wo Sie ihn weiter bearbeiten können. Bearbeiten Sie einen Beitrag, geht eine Korrektur raus; verschieben Sie ihn in den Papierkorb, wird er zurückgezogen.</p>
<p><b>Wählen Sie Ihr Handle ein einziges Mal.</b> Es ist die Hälfte <i>@name</i> von <i>@name@yourdomain</i>, und es ist nicht Ihr Anmeldename — der bleibt privat. Ihr Handle und Ihre Website-Adresse <b>zusammen sind Ihre Identität</b> da draußen: Ändern Sie später eines von beiden, ist jeder Follower weg, weil sein Server weiter nach dem alten Namen sucht und nichts ihm sagt, wohin Sie gegangen sind.</p>
<p>Zwei Dinge macht es bewusst noch <b>nicht</b>. Es veröffentlicht, liest aber nicht: Antworten, Likes und Boosts erreichen Ihr Blog und werden verworfen, eine Antwort auf Mastodon wird hier also kein Kommentar. Und nichts, was Sie <i>vor</i> dem Einschalten geschrieben haben, wird je gesendet — das Einschalten schiebt Ihr Archiv nicht in irgendjemandes Timeline.</p>
<p class="links"><a href="doc:docs/fediverse.md">Fediverse-Doku</a> <a href="/admin/settings?tab=server">{t:tabServer}</a> <a href="/admin/log">Aktivitätsprotokoll</a></p>`,
    },
  ],
  markdownTitle: 'Markdown, das der Editor versteht',
  markdownLede: 'Standard-Markdown, dazu diese hier. Die meisten fügt die Werkzeugleiste für Sie ein.',
  markdownHead: ['Tippen Sie', 'Und Sie bekommen'],
  markdown: {
    '# … ######': 'Überschriften. Daraus wird das Inhaltsverzeichnis gebaut.',
    '> [!NOTE]': 'Ein Hinweiskasten. Außerdem TIP, WARNING, IMPORTANT und CAUTION.',
    '==text==': 'Textmarker. ==text==#green wählt die Tinte: yellow, green, pink, blue oder orange.',
    '++text++': 'Bleistift-Unterstrich. ++text++#green zieht die Linie stattdessen in einer der fünf Tinten.',
    '@@word@@': 'Ein Kugelschreiber-Kringel um ein Wort. @@word@@#blue wählt die Tinte; ohne Angabe rot.',
    'text[^1]': 'Ein Fußnotenverweis; schreiben Sie die Fußnote als [^1]: irgendwo in den Text.',
    '![alt](url)': 'Ein Bild. Ziehen Sie eine Datei in den Editor, wird das für Sie geschrieben.',
    '![alt](url#frame)': 'Ein Passepartout um dieses Bild. #frame-thin und #frame-thick ändern die Stärke, ink macht das Passepartout dunkel, und #noframe lässt ein einzelnes Bild auf einer Website mit Rahmen schlicht.',
    '```lang': 'Code-Block, auf dem Server eingefärbt (kein Skript im Browser des Lesers).',
    '---': 'Der eine Trennlinienstil, der auf der ganzen Website verwendet wird.',
    'YouTube / Vimeo': 'Eine YouTube- oder Vimeo-Adresse allein in einer Zeile wird zu einem eingebetteten Player, der sich der Seite anpasst.',
    'Spotify / Apple Music': 'Eine Spotify- oder Apple-Music-Adresse allein in einer Zeile wird zu einem eingebetteten Player (kein Skript von Dritten).',
  },
  keysTitle: 'Tasten, auf die der Editor hört',
  keysLede: 'Zusätzlich zu den üblichen für Fett, Kursiv, Überschriften und Rückgängig.',
  keysHead: ['Drücken Sie', 'Das passiert'],
  keys: {
    save: 'Speichern. Ein Entwurf bleibt ein Entwurf, und ein veröffentlichter Text bleibt veröffentlicht: Das ändert nur Veröffentlichen oder der Status im Panel. Autosave hält eine Kopie auf diesem Gerät und auf dem Server, aber nur Speichern schreibt den Text selbst.',
    link: 'Einen Link hinzufügen oder den bearbeiten, in dem der Cursor steht. Leeren Sie das Feld, wird er entfernt.',
    ink: 'Textmarker über der Auswahl (==text==).',
    ring: 'Ein Kugelschreiber-Kringel um die Auswahl (@@word@@).',
    clear: 'Jede Auszeichnung von der Auswahl entfernen — die Reparatur für Text, der von woanders eingefügt wurde.',
    attributes: 'Das Panel Eigenschaften: Adresse, Datum, Kategorien und Schlagwörter, beide Bilder, die SEO-Felder und der Papierkorb.',
    markdown: 'Zwischen der Schreibfläche und dem Markdown-Quelltext wechseln.',
    focus: 'Fokusmodus: Alles außer dem Papier verschwindet.',
    find: 'Suchen, in beiden Ansichten. Enter springt zum nächsten Treffer, Shift-Enter zum vorherigen, Escape schließt die Suche.',
    replace: 'Suchen und Ersetzen: dieselbe Leiste mit geöffnetem Ersetzen-Feld. Der Pfeil an ihrem Anfang öffnet es ebenfalls.',
    palette: 'Alles durchsuchen: die Bildschirme, die Einstellungen und Ihre Texte. Auch der Knopf oben in der Seitenleiste.',
    bold: 'Fett.',
    italic: 'Kursiv.',
    underline: 'Bleistift-Unterstrich (++text++).',
    strike: 'Durchgestrichen.',
    code: 'Code innerhalb einer Textzeile.',
    codeBlock: 'Ein Code-Block.',
    heading: 'Überschriftenebenen 1 bis 6 — Mod-Alt-2 für eine Überschrift der Ebene 2 und so weiter. Mod-Alt-0 macht wieder einen Absatz daraus.',
    bulletList: 'Aufzählung.',
    orderedList: 'Nummerierte Liste.',
    taskList: 'Checkliste.',
    blockquote: 'Zitat. Beginnen Sie es mit [!NOTE] für einen Hinweiskasten.',
    undo: 'Rückgängig. Shift-Mod-Z stellt wieder her.',
    hardBreak: 'Ein Zeilenumbruch innerhalb desselben Absatzes.',
  },
  troubleTitle: 'Wenn etwas nicht stimmt',
  troubleLede: 'Die Probleme, die wirklich vorkommen, und was jeweils hilft.',
  troubleHead: ['Symptom', 'Was tun'],
  trouble: [
    ['Eine Änderung ist auf dem Server live, aber Leser sehen noch die alte Seite', 'Cloudflare cacht HTML. Nutzen Sie {t:clearCache} in der Seitenleiste — Neuladen im Browser kann einen Cache an der Edge nicht beheben.'],
    ['„SMTP testen“ schlägt mit „wrong version number“ fehl', 'Port und TLS passen nicht zusammen. 465 ist implizites TLS (Haken setzen); 587 und 25 sind STARTTLS (Haken weglassen).'],
    ['Ein Abonnent hat sich angemeldet, aber keine E-Mail bekommen', 'Die Adresse wird gespeichert, bevor die Mail verschickt wird, die Anmeldung übersteht also ein kaputtes SMTP. Suchen Sie unter {t:navNewsletter} → {t:nlTabPeople} nach dem Fehler und nutzen Sie dann {t:navNewsletter} → {t:nlTabTest}.'],
    ['Ein geplanter Beitrag ist nicht pünktlich online gegangen', 'Das Blog veröffentlicht ihn von selbst innerhalb einer Minute nach seiner Zeit, solange der Server läuft. War der Server in dem Moment aus, geht der Beitrag online, sobald er wieder läuft.'],
    ['Die Authenticator-App ist weg, und die Anmeldung fragt nach ihrem Code', 'Wählen Sie auf dem Code-Bildschirm „{t:authUseRecovery}“ und geben Sie einen Ihrer Wiederherstellungscodes ein; jeder funktioniert einmal. Erstellen Sie danach neue unter {t:navSettings} → {t:tabAccount}.'],
    ['Eine alte Adresse liefert nach einer Umbenennung 404', 'Umbenennen legt von selbst eine 301 an. Hat es die Adresse hier nie gegeben, legen Sie eine unter {t:navSettings} → {t:tabServer} → {t:redirectsTitle} an.'],
    ['Bilder sind nach einer Wiederherstellung verschwunden', 'Öffnen Sie /api/health — es meldet die Datenbank und den Speicherordner getrennt.'],
  ],
}

export default help
