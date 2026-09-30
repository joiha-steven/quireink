import type { HelpText } from './types'

const help: HelpText = {
  intro: 'Tout ce que ce blog sait faire, et où se trouve chaque chose. Commencez par le haut si le site est neuf ; sautez à une section si vous cherchez quelque chose.',
  index: {
    writing: 'Écrire', media: 'Médias', readers: 'Lecteurs', analytics: 'Statistiques', settings: 'Réglages',
    server: 'Serveur', cache: 'Cache', mcp: 'MCP', api: 'Content API', fediverse: 'Fédiverse',
    markdown: 'Markdown', keys: 'Clavier', trouble: 'Dépannage',
  },
  sections: [
    {
      id: 'writing',
      title: 'Écrire et publier',
      body: `<ul>
<li>Du Markdown et une barre d’outils. Pendant que vous tapez, une copie est <b>gardée sur cet appareil et sur le serveur</b> ; le texte lui-même ne change que lorsque vous faites Enregistrer ou Publier, si bien que modifier un article en ligne ne met jamais un texte à moitié fini sur le site.</li>
<li><b>Programmez</b> en publiant avec une date future : l’article reste caché et paraît à l’heure dite. Il n’envoie <b>pas</b> d’e-mail à qui que ce soit de lui-même.</li>
<li>Les <b>3 dernières versions</b> de chaque article sont conservées ; restaurez-en une depuis l’éditeur.</li>
<li>Les <b>séries</b> regroupent des articles liés dans l’ordre, avec des liens précédent et suivant et une page <code>/series/…</code>.</li>
<li>Toute suppression va dans la <b>corbeille</b>. Rien n’est effacé définitivement de façon automatique — la corbeille se vide à la main.</li>
</ul>
<p class="links"><a href="/admin/editor">Nouvel article</a> <a href="/admin/content">Tout le contenu</a> <a href="/admin/trash">Corbeille</a></p>`,
    },
    {
      id: 'media',
      title: 'Médias et fichiers',
      body: `<ul>
<li>Déposez une image dans l’éditeur ou dans la Bibliothèque. Des versions adaptatives <b>AVIF et WebP</b> et une miniature sont créées pour vous ; l’original est toujours conservé.</li>
<li>Ouvrez une image dans la Bibliothèque pour lire ou modifier sa <b>description</b> (texte alternatif), les mots qu’entend à sa place un lecteur qui ne peut pas la voir.</li>
<li>Toute image peut porter un <b>cadre</b> — un passe-partout de papier ou d’encre, en trois épaisseurs — choisi sur l’image elle-même dans l’éditeur. {t:navSettings} → {t:tabPost} → {t:cardPictures} fixe celui que porte chaque image qui n’a rien choisi ; une image qui a choisi garde le sien.</li>
<li>La Bibliothèque signale les fichiers <b>inutilisés</b> (rien n’y renvoie), pour que le ménage soit sans risque. Elle ne fait que signaler — elle ne supprime jamais rien.</li>
<li>Les fichiers vivent sur le disque de votre propre serveur, servis depuis <code>/uploads</code>. Aucun compte de stockage objet.</li>
</ul>
<p class="links"><a href="/admin/media">Ouvrir la Bibliothèque</a> <a href="/admin/settings?tab=post">{t:tabPost}</a></p>`,
    },
    {
      id: 'readers',
      title: 'Lecteurs — commentaires et newsletter',
      body: `<p>Les deux sont <b>désactivés tant que vous ne les avez pas configurés</b>, et les deux sont à vous : aucun service tiers ne se glisse entre vous et vos lecteurs.</p>
<ul class="after">
<li><b>Commentaires</b> — activez-les dans {t:navSettings} → {t:tabPeople}. Cloudflare Turnstile contre le spam et la connexion avec Google sont facultatifs. Vous pouvez lire et supprimer les commentaires sur l’écran Commentaires.</li>
<li><b>Newsletter</b> — saisissez vos paramètres SMTP dans {t:navSettings} → {t:tabPeople}, et un formulaire d’abonnement apparaît au pied de chaque article, avec un bouton dans l’en-tête du site. L’abonnement se fait en <b>double opt-in</b> : une adresse ne compte qu’une fois qu’elle a cliqué sur le lien de confirmation.</li>
<li><b>L’envoi est toujours manuel.</b> Rien n’est envoyé automatiquement, pas même un article programmé qui paraît. Vous cochez les articles, lisez l’e-mail réel dans l’aperçu, et appuyez sur envoyer. Cochez-en plusieurs et ils partent en <b>un seul e-mail récapitulatif</b>, pas un message chacun.</li>
<li>{t:navNewsletter} → {t:nlTabPeople} montre ce que chaque adresse a réellement reçu, chaque échec SMTP avec son erreur, et le taux d’ouverture. {t:navNewsletter} → {t:nlTabTest} vous envoie un exemplaire de chaque e-mail avant qu’un lecteur n’en voie un.</li>
</ul>
<p class="links"><a href="/admin/newsletter">{t:navNewsletter}</a> <a href="/admin/comments">Commentaires</a> <a href="/admin/settings?tab=people">{t:tabPeople}</a></p>`,
    },
    {
      id: 'analytics',
      title: 'Statistiques',
      body: `<ul>
<li><b>Aucun cookie, aucune donnée personnelle.</b> Un visiteur est une empreinte salée de l’adresse et du navigateur, et la chaîne du navigateur elle-même n’est jamais stockée — seulement de grands groupes d’appareil, de navigateur et de système.</li>
<li>Les robots, les pages d’administration et vos propres visites sont exclus, si bien que les chiffres sont des lecteurs.</li>
<li>Les vues, jusqu’où les gens font défiler et combien de temps ils restent ; d’où ils viennent ; chaque article pour lui-même. Conservé pour de bon — il n’y a pas de fenêtre glissante.</li>
</ul>
<p class="links"><a href="/admin/analytics">Ouvrir les Statistiques</a></p>`,
    },
    {
      id: 'settings',
      title: 'Réglages',
      body: `<p>Un seul formulaire et un seul Enregistrer, appliqués à tout le site <b>sans redéploiement</b>. Sept onglets :</p>
{tabs}
<p>Vous cherchez un réglage précis ? Tapez son nom dans la recherche en haut de l’écran Réglages.</p>
<p class="links"><a href="/admin/settings">Ouvrir les Réglages</a></p>`,
    },
    {
      id: 'server',
      title: 'Serveur, sauvegardes et mises à jour',
      body: `<ul>
<li>Tourne entièrement sur <b>votre propre serveur</b> : deux fichiers SQLite pour le contenu et les statistiques, et le disque local pour les images. En natif ou sous Docker, sans compte cloud.</li>
<li><code>/api/health</code> rend compte séparément de la base de données et du dossier de stockage — pointez-y votre outil de surveillance. Le serveur refuse de démarrer quand un réglage obligatoire manque, plutôt que de démarrer à moitié configuré.</li>
<li><b>Sauvegardes</b> : des instantanés programmés (les deux bases de données et tous les fichiers) écrits sur votre propre disque, une copie hors du serveur si vous en ajoutez une, et une archive à télécharger tout de suite. {t:navSettings} → {t:tabServer} → {t:backupTitle}.</li>
<li>Les mises à jour appliquent des <b>migrations de base de données suivies</b>, si bien qu’un changement de schéma s’exécute une fois et une seule.</li>
</ul>
<p class="links"><a href="doc:docs/self-host.md">Guide d’auto-hébergement</a> <a href="doc:docs/backups.md">{t:backupTitle}</a></p>`,
    },
    {
      id: 'cache',
      title: 'Cloudflare et le cache',
      body: `<p>Placez Cloudflare devant pour le TLS et un cache près de chaque lecteur — le grand gain quand les lecteurs sont loin de votre serveur.</p>
<ul class="after">
<li><b>Cache Rules</b> : contournez <code>/admin</code> et <code>/api</code>, mettez tout le reste en cache pour la durée qu’indique le serveur. <b>Désactivez Rocket Loader</b> (il réordonne et retarde les scripts, ce qui casse l’administration). SSL: Full (Strict).</li>
<li>Ajoutez un jeton d’API Cloudflare et le Zone ID dans {t:navSettings} → {t:tabServer} → {t:cardCloudflare}, et chaque enregistrement vide la zone de lui-même.</li>
<li><b>{t:clearCache}</b>, dans la barre latérale, vide ce serveur et Cloudflare, puis réchauffe la page d’accueil et les pages les plus récentes.</li>
<li>Après avoir déployé du nouveau code, videz la périphérie avec <code>GET /api/cron?purge=1</code>. Cloudflare met le HTML en cache, donc une page périmée n’est pas quelque chose qu’un lecteur peut faire disparaître en rechargeant.</li>
</ul>
<p class="links"><a href="https://developers.cloudflare.com/cache/how-to/cache-rules/">Cache Rules</a> <a href="doc:docs/seo-pwa.md">SEO et cache</a></p>`,
    },
    {
      id: 'mcp',
      title: 'MCP — laisser une IA tenir le blog',
      body: `<p>Le <b>serveur MCP</b> intégré donne à un agent IA <b>les mêmes règles que l’administration</b> : écrire et mettre à jour articles et pages, s’occuper des images et des réglages, chaque changement vérifié et inscrit au journal d’activité exactement comme les vôtres. Activez-le et créez des jetons d’accès dans {t:navSettings} → {t:tabServer} → {t:cardMcp} — un jeton n’est affiché qu’une fois et n’est stocké que sous forme d’empreinte.</p>
<p>Les mêmes capacités existent dans l’administration sous la forme de l’écran <b>Assistant</b>, qui tourne sur le modèle de {t:navSettings} → {t:tabServer} → {t:cardAi} — aucun client MCP nécessaire. Par l’une ou l’autre porte, l’agent <b>lit et entretient</b> : le trafic de cette semaine face à celui de la semaine dernière, des commentaires balayés vers la corbeille, les archives fouillées (brouillons compris), la page d’accueil réorganisée autour de ce que les gens lisent vraiment, l’apparence refaite à partir des palettes toutes prêtes, un numéro de test de la newsletter envoyé à vous seul. Demandez-lui <i>comment s’est passée la semaine de mon blog ?</i> et il répond avec les chiffres du tableau de bord lui-même — les <b>recettes</b> ci-dessous sont une page de consignes qui font un vrai travail.</p>
<p>Où sont les limites : les adresses des abonnés et l’auteur de chaque commentaire ne passent jamais par MCP ; l’apparence n’accepte que les choix tout prêts, jamais une couleur libre ; les suppressions vont dans la corbeille, pas au néant ; et envoyer la vraie newsletter n’est <b>délibérément pas un outil</b> — un e-mail ne se rattrape pas, donc ce bouton reste le vôtre.</p>
<p class="links"><a href="doc:docs/agent-cookbook.md">Recettes pour agents</a> <a href="doc:docs/mcp.md">Documentation MCP</a> <a href="/admin/settings?tab=server">{t:tabServer}</a> <a href="/admin/log">Journal d’activité</a></p>`,
    },
    {
      id: 'api',
      title: 'Content API — laisser un programme lire le blog',
      body: `<p>La <b>Content API</b> sert vos écrits publiés en JSON à <code>/api/v1</code> — articles, pages, notes et vos catégories, chacun avec le Markdown dans lequel il a été écrit. Elle sert à construire quelque chose à partir du blog plutôt qu’à le lire : un second site public, un index de recherche, une copie statique, un script qui vérifie ses propres liens. Activez-la dans {t:navSettings} → {t:tabServer} ; tant que vous ne l’avez pas fait, chacune de ces adresses répond <b>404</b>.</p>
<p><b>Elle ne fait que lire, et elle n’a pas de clé.</b> Quiconque connaît l’adresse peut la lire, et ce qu’il obtient est exactement ce qu’il pourrait déjà obtenir en parcourant le site : pas de brouillons, pas d’articles datés dans le futur, rien de la corbeille, et rien qui puisse modifier le blog. L’interrupteur est là à cause de ce qu’elle rend <i>bon marché</i>, pas de ce qu’elle rend possible — le blog entier en autant de requêtes qu’il a de pages. Sur un petit blog personnel, c’est une commodité ; à vous de décider pour le vôtre.</p>
<p>Pour écrire depuis un programme, utilisez <b>MCP</b> ci-dessus, ou Micropub depuis une application de prise de notes. Les deux exigent une connexion ; celle-ci non, et c’est pourquoi elle ne peut que lire.</p>
<p class="links"><a href="doc:docs/content-api.md">Documentation de la Content API</a> <a href="/admin/settings?tab=server">{t:tabServer}</a></p>`,
    },
    {
      id: 'fediverse',
      title: 'Fédiverse — laisser les gens suivre le blog',
      body: `<p>Activez ceci et votre blog devient un <b>compte</b> que n’importe qui sur Mastodon — ou sur l’un de ses voisins — peut suivre. Un nouvel article arrive dans leur fil sous la forme de son titre, de son chapeau et d’un lien vers ici ; le texte lui-même reste sur votre blog, où vous pouvez toujours le modifier. Modifier un article envoie une correction ; le mettre à la corbeille le retire.</p>
<p><b>Choisissez votre pseudo une fois pour toutes.</b> C’est la moitié <i>@name</i> de <i>@name@yourdomain</i>, et ce n’est pas votre nom de connexion — celui-là reste privé. Votre pseudo et l’adresse de votre site <b>forment ensemble votre identité</b> là-bas : changez l’un ou l’autre plus tard et vous perdez chaque abonné, car leur serveur continue de chercher l’ancien nom et rien ne lui dit où vous êtes allé.</p>
<p>Deux choses qu’il ne fait délibérément <b>pas</b> encore. Il publie mais ne lit pas : les réponses, les favoris et les partages arrivent sur votre blog et sont ignorés, donc une réponse sur Mastodon ne devient pas un commentaire ici. Et rien de ce que vous avez écrit <i>avant</i> de l’activer n’est jamais envoyé — l’activer ne pousse pas vos archives dans le fil de qui que ce soit.</p>
<p class="links"><a href="doc:docs/fediverse.md">Documentation Fédiverse</a> <a href="/admin/settings?tab=server">{t:tabServer}</a> <a href="/admin/log">Journal d’activité</a></p>`,
    },
  ],
  markdownTitle: 'Le Markdown que comprend l’éditeur',
  markdownLede: 'Le Markdown standard, plus ceux-ci. La barre d’outils insère la plupart d’entre eux pour vous.',
  markdownHead: ['Tapez ceci', 'Et vous obtenez'],
  markdown: {
    '# … ######': 'Des titres. La table des matières est construite à partir d’eux.',
    '> [!NOTE]': 'Un encadré. Existe aussi en TIP, WARNING, IMPORTANT et CAUTION.',
    '==text==': 'Surligneur. ==text==#green choisit l’encre : jaune, vert, rose, bleu ou orange.',
    '++text++': 'Soulignement au crayon. ++text++#green trace plutôt le trait dans l’une des cinq encres.',
    '@@word@@': 'Un cercle au stylo bille autour d’un mot. @@word@@#blue choisit l’encre ; rouge sans rien.',
    'text[^1]': 'Un appel de note de bas de page ; écrivez la note sous la forme [^1]: n’importe où dans le texte.',
    '![alt](url)': 'Une image. Déposer un fichier dans l’éditeur l’écrit pour vous.',
    '![alt](url#frame)': 'Un passe-partout autour de cette image. #frame-thin et #frame-thick changent l’épaisseur, ink rend le passe-partout sombre, et #noframe laisse une image nue sur un site encadré.',
    '```lang': 'Du code délimité, coloré sur le serveur (aucun script dans le navigateur du lecteur).',
    '---': 'L’unique style de séparateur utilisé sur tout le site.',
    'YouTube / Vimeo': 'Une adresse YouTube ou Vimeo seule sur sa ligne devient un lecteur intégré qui s’adapte à la page.',
    'Spotify / Apple Music': 'Une adresse Spotify ou Apple Music seule sur sa ligne devient un lecteur intégré (sans script tiers).',
  },
  keysTitle: 'Les touches auxquelles répond l’éditeur',
  keysLede: 'En plus des habituels gras, italique, titres et annuler.',
  keysHead: ['Appuyez sur', 'Et cela fait'],
  keys: {
    save: 'Enregistrer. Un brouillon reste un brouillon et un texte publié reste publié : seul Publier, ou le statut dans le panneau, change cela. L’enregistrement automatique garde une copie sur cet appareil et sur le serveur, mais seul Enregistrer écrit le texte lui-même.',
    link: 'Ajouter un lien, ou modifier celui où se trouve le curseur. Vider le champ le supprime.',
    ink: 'Surligneur sur la sélection (==text==).',
    ring: 'Un cercle au stylo bille autour de la sélection (@@word@@).',
    clear: 'Retirer toute mise en forme de la sélection — le remède pour un texte collé depuis ailleurs.',
    attributes: 'Le panneau Attributs : adresse, date, catégories et étiquettes, les deux images, les champs SEO et la corbeille.',
    markdown: 'Basculer entre la surface d’écriture et la source Markdown.',
    focus: 'Mode concentration : tout disparaît sauf le papier.',
    find: 'Rechercher, dans l’une ou l’autre vue. Enter va à l’occurrence suivante, Shift-Enter à la précédente, Escape ferme.',
    replace: 'Rechercher et remplacer : la même barre avec le champ de remplacement ouvert. La flèche à son début l’ouvre aussi.',
    palette: 'Tout rechercher : les écrans, les réglages et vos textes. C’est aussi le bouton en haut de la barre latérale.',
    bold: 'Gras.',
    italic: 'Italique.',
    underline: 'Soulignement au crayon (++text++).',
    strike: 'Barré.',
    code: 'Du code dans une ligne de texte.',
    codeBlock: 'Un bloc de code.',
    heading: 'Niveaux de titre 1 à 6 — Mod-Alt-2 pour un titre de niveau 2, et ainsi de suite. Mod-Alt-0 revient à un paragraphe.',
    bulletList: 'Liste à puces.',
    orderedList: 'Liste numérotée.',
    taskList: 'Liste de cases à cocher.',
    blockquote: 'Citation. Commencez-la par [!NOTE] pour un encadré.',
    undo: 'Annuler. Shift-Mod-Z rétablit.',
    hardBreak: 'Un saut de ligne à l’intérieur du même paragraphe.',
  },
  troubleTitle: 'Quand quelque chose semble anormal',
  troubleLede: 'Les problèmes qui surviennent vraiment, et ce qui règle chacun.',
  troubleHead: ['Symptôme', 'Que faire'],
  trouble: [
    ['Une modification est en ligne sur le serveur mais les lecteurs voient encore l’ancienne page', 'Cloudflare met le HTML en cache. Utilisez {t:clearCache} dans la barre latérale — recharger le navigateur ne peut pas corriger un cache en périphérie.'],
    ['Le test SMTP échoue avec « wrong version number »', 'Le port et le TLS ne s’accordent pas. 465 est en TLS implicite (cochez la case) ; 587 et 25 sont en STARTTLS (laissez-la décochée).'],
    ['Un abonné s’est inscrit mais n’a reçu aucun e-mail', 'L’adresse est enregistrée avant l’envoi du courrier, donc l’inscription survit à un SMTP en panne. Cherchez l’échec dans {t:navNewsletter} → {t:nlTabPeople}, puis utilisez {t:navNewsletter} → {t:nlTabTest}.'],
    ['Un article programmé n’a pas paru à l’heure', 'Le blog le publie de lui-même dans la minute qui suit son heure, tant que le serveur tourne. Si le serveur était arrêté à ce moment-là, l’article paraît dès qu’il redémarre.'],
    ['L’application d’authentification a disparu et la connexion demande son code', 'Sur l’écran du code, choisissez « {t:authUseRecovery} » et tapez l’un de vos codes de secours ; chacun ne fonctionne qu’une fois. Créez-en ensuite de nouveaux dans {t:navSettings} → {t:tabAccount}.'],
    ['Une ancienne adresse donne 404 après un renommage', 'Renommer ajoute une 301 de soi-même. Si l’adresse n’a jamais existé ici, ajoutez-en une dans {t:navSettings} → {t:tabServer} → {t:redirectsTitle}.'],
    ['Des images ont disparu après une restauration', 'Ouvrez /api/health — il rend compte séparément de la base de données et du dossier de stockage.'],
  ],
}

export default help
