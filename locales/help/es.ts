import type { HelpText } from './types'

const help: HelpText = {
  intro: 'Todo lo que puede hacer este blog, y dónde vive cada cosa. Si el sitio es nuevo, empieza por arriba; si buscas algo concreto, salta a su sección.',
  index: {
    writing: 'Escribir', media: 'Imágenes', readers: 'Lectores', analytics: 'Estadísticas', settings: 'Ajustes',
    server: 'Servidor', cache: 'Caché', mcp: 'MCP', api: 'Content API', fediverse: 'Fediverso',
    markdown: 'Markdown', keys: 'Teclado', trouble: 'Problemas',
  },
  sections: [
    {
      id: 'writing',
      title: 'Escribir y publicar',
      body: `<ul>
<li>Markdown y una barra de herramientas. Mientras escribes, se <b>guarda una copia en este dispositivo y en el servidor</b>; el texto en sí solo cambia cuando pulsas Guardar o Publicar, así que editar una entrada publicada nunca pone texto a medias en el sitio.</li>
<li><b>Programa</b> una entrada publicándola con una fecha futura: se queda oculta y sale a su hora. Por sí sola <b>no</b> envía ningún correo.</li>
<li>Se guardan las últimas <b>3 versiones</b> de cada entrada; restaura una desde el editor.</li>
<li>Las <b>series</b> agrupan entradas relacionadas en orden, con enlaces a la anterior y a la siguiente y una página <code>/series/…</code>.</li>
<li>Todo lo que eliminas va a la <b>papelera</b>. Nada se borra para siempre de forma automática: la papelera se vacía a mano.</li>
</ul>
<p class="links"><a href="/admin/editor">Nueva entrada</a> <a href="/admin/content">Todo el contenido</a> <a href="/admin/trash">Papelera</a></p>`,
    },
    {
      id: 'media',
      title: 'Imágenes y archivos',
      body: `<ul>
<li>Suelta una imagen en el editor o en la Biblioteca. Se crean por ti versiones adaptables en <b>AVIF y WebP</b> y una miniatura; el original se conserva siempre.</li>
<li>Abre una imagen en la Biblioteca para leer o cambiar su <b>descripción</b> (texto alternativo), las palabras que oye en su lugar un lector que no puede verla.</li>
<li>Cualquier imagen puede llevar un <b>marco</b> — un paspartú de papel o de tinta, en tres grosores — que se elige sobre la propia imagen en el editor. {t:navSettings} → {t:tabPost} → {t:cardPictures} fija el que lleva cada imagen que no ha elegido; una imagen que sí eligió conserva el suyo.</li>
<li>La Biblioteca marca los archivos <b>sin usar</b> (nada enlaza a ellos), así que hacer limpieza es seguro. Solo avisa: nunca borra.</li>
<li>Los archivos viven en el disco de tu propio servidor, servidos desde <code>/uploads</code>. Sin cuenta de almacenamiento de objetos.</li>
</ul>
<p class="links"><a href="/admin/media">Abrir la Biblioteca</a> <a href="/admin/settings?tab=post">{t:tabPost}</a></p>`,
    },
    {
      id: 'readers',
      title: 'Lectores — comentarios y boletín',
      body: `<p>Los dos están <b>apagados hasta que los configuras</b>, y los dos son tuyos: ningún servicio de terceros se interpone entre tú y tus lectores.</p>
<ul class="after">
<li><b>Comentarios</b> — actívalos en {t:navSettings} → {t:tabPeople}. Cloudflare Turnstile contra el spam y el inicio de sesión con Google son opcionales. Puedes leer y eliminar comentarios en la pantalla Comentarios.</li>
<li><b>Boletín</b> — añade tus datos SMTP en {t:navSettings} → {t:tabPeople}, y aparece un formulario de suscripción al pie de cada entrada, con un botón en la cabecera del sitio. La suscripción es de <b>doble confirmación</b>: una dirección solo cuenta cuando ha pulsado el enlace de confirmación.</li>
<li><b>El envío es siempre manual.</b> Nada se envía por correo de forma automática, ni siquiera una entrada programada al salir. Marcas las entradas, lees el correo real en la vista previa y pulsas enviar. Marca varias y salen como <b>un solo resumen</b>, no un mensaje por cada una.</li>
<li>{t:navNewsletter} → {t:nlTabPeople} muestra lo que recibió de verdad cada dirección, cualquier fallo de SMTP con su error, y la tasa de apertura. {t:navNewsletter} → {t:nlTabTest} te envía una muestra de cada correo antes de que lo vea ningún lector.</li>
</ul>
<p class="links"><a href="/admin/newsletter">{t:navNewsletter}</a> <a href="/admin/comments">Comentarios</a> <a href="/admin/settings?tab=people">{t:tabPeople}</a></p>`,
    },
    {
      id: 'analytics',
      title: 'Estadísticas',
      body: `<ul>
<li><b>Sin cookies ni datos personales.</b> Un visitante es un hash con sal de la dirección y el navegador, y la cadena del navegador nunca se guarda: solo grupos amplios de dispositivo, navegador y sistema.</li>
<li>Los bots, las páginas de administración y tus propias visitas se dejan fuera, así que las cifras son lectores.</li>
<li>Vistas, hasta dónde bajan leyendo y cuánto se quedan; de dónde llegaron; cada entrada por separado. Se guarda para siempre: no hay ventana móvil.</li>
</ul>
<p class="links"><a href="/admin/analytics">Abrir Estadísticas</a></p>`,
    },
    {
      id: 'settings',
      title: 'Ajustes',
      body: `<p>Un formulario y un solo Guardar, aplicado a todo el sitio <b>sin volver a desplegar</b>. Siete pestañas:</p>
{tabs}
<p>¿Buscas un ajuste concreto? Escribe su nombre en el buscador de arriba de la pantalla Ajustes.</p>
<p class="links"><a href="/admin/settings">Abrir Ajustes</a></p>`,
    },
    {
      id: 'server',
      title: 'Servidor, copias de seguridad y actualizaciones',
      body: `<ul>
<li>Funciona por completo en <b>tu propio servidor</b>: dos archivos SQLite para el contenido y las estadísticas, y el disco local para las imágenes. Nativo o con Docker, sin cuenta en la nube.</li>
<li><code>/api/health</code> informa por separado de la base de datos y de la carpeta de almacenamiento: apunta ahí tu monitor de disponibilidad. El servidor se niega a arrancar si falta un ajuste obligatorio, en lugar de arrancar a medio configurar.</li>
<li><b>Copias de seguridad</b>: instantáneas programadas (las dos bases de datos y todos los archivos) escritas en tu propio disco, una copia fuera del servidor si añades una, y un archivo para descargar ahora. {t:navSettings} → {t:tabServer} → {t:backupTitle}.</li>
<li>Las actualizaciones aplican <b>migraciones de base de datos registradas</b>, así que un cambio en el esquema se ejecuta una vez y solo una.</li>
</ul>
<p class="links"><a href="doc:docs/self-host.md">Guía de autoalojamiento</a> <a href="doc:docs/backups.md">{t:backupTitle}</a></p>`,
    },
    {
      id: 'cache',
      title: 'Cloudflare y la caché',
      body: `<p>Pon Cloudflare delante para el TLS y una caché cerca de cada lector: la gran ganancia cuando los lectores están lejos de tu servidor.</p>
<ul class="after">
<li><b>Cache Rules</b>: omite <code>/admin</code> y <code>/api</code>, y cachea todo lo demás durante el tiempo que indique el servidor. <b>Apaga Rocket Loader</b> (reordena y retrasa los scripts, y eso rompe la administración). SSL: Full (Strict).</li>
<li>Añade un token de la API de Cloudflare y el Zone ID en {t:navSettings} → {t:tabServer} → {t:cardCloudflare}, y cada guardado vacía la zona por sí solo.</li>
<li><b>{t:clearCache}</b>, en la barra lateral, vacía este servidor y Cloudflare, y luego vuelve a calentar la portada y las páginas más nuevas.</li>
<li>Después de desplegar código nuevo, vacía el borde con <code>GET /api/cron?purge=1</code>. Cloudflare guarda en caché el HTML, así que una página desfasada no es algo que un lector pueda arreglar recargando.</li>
</ul>
<p class="links"><a href="https://developers.cloudflare.com/cache/how-to/cache-rules/">Cache Rules</a> <a href="doc:docs/seo-pwa.md">SEO y caché</a></p>`,
    },
    {
      id: 'mcp',
      title: 'MCP — deja que una IA lleve el blog',
      body: `<p>El <b>servidor MCP</b> integrado da a un agente de IA <b>las mismas reglas que la administración</b>: escribir y actualizar entradas y páginas, cuidar las imágenes y los ajustes, con cada cambio comprobado y anotado en el registro de actividad exactamente igual que los tuyos. Actívalo y crea tokens de acceso en {t:navSettings} → {t:tabServer} → {t:cardMcp}: un token se muestra una sola vez y solo se guarda su hash.</p>
<p>Las mismas capacidades viven dentro de la administración como la pantalla <b>Asistente</b>, que funciona con el modelo de {t:navSettings} → {t:tabServer} → {t:cardAi}, sin necesidad de un cliente MCP. Por cualquiera de las dos puertas, el agente <b>lee y cuida</b>: el tráfico de esta semana frente al de la anterior, comentarios barridos a la papelera, el archivo buscado (borradores incluidos), la portada reordenada según lo que la gente lee de verdad, el aspecto cambiado con las paletas ya preparadas, un número de prueba del boletín enviado solo a ti. Pregúntale <i>¿cómo le fue a mi blog esta semana?</i> y responde con las propias cifras del panel; el <b>recetario</b> de abajo es una página de peticiones que hacen trabajos reales.</p>
<p>Dónde están los límites: las direcciones de los suscriptores y quién escribió cada comentario nunca cruzan MCP; el aspecto solo acepta las opciones ya preparadas, nunca un color libre; lo eliminado va a la papelera, no desaparece; y enviar el boletín de verdad <b>no es una herramienta, a propósito</b>: un correo no se puede desenviar, así que ese botón sigue siendo tuyo.</p>
<p class="links"><a href="doc:docs/agent-cookbook.md">Recetario del agente</a> <a href="doc:docs/mcp.md">Documentación de MCP</a> <a href="/admin/settings?tab=server">{t:tabServer}</a> <a href="/admin/log">Registro de actividad</a></p>`,
    },
    {
      id: 'api',
      title: 'Content API — deja que un programa lea el blog',
      body: `<p>La <b>Content API</b> sirve tus textos publicados como JSON en <code>/api/v1</code>: entradas, páginas, notas y tus categorías, cada uno con el Markdown en que se escribió. Sirve para construir algo a partir del blog en lugar de leerlo: una segunda interfaz, un índice de búsqueda, una copia estática, un script que revisa sus propios enlaces. Actívala en {t:navSettings} → {t:tabServer}; hasta que lo hagas, cada una de esas direcciones responde <b>404</b>.</p>
<p><b>Solo lee, y no tiene clave.</b> Cualquiera que conozca la dirección puede leerla, y lo que obtiene es exactamente lo que ya podía obtener navegando por el sitio: nada de borradores, nada de entradas con fecha por delante, nada de la papelera, y nada que pueda cambiar el blog. El interruptor está ahí por lo que vuelve <i>barato</i>, no por lo que hace posible: el blog entero en tantas peticiones como páginas tiene. En un blog personal tranquilo eso es una comodidad; decide tú para el tuyo.</p>
<p>Para escribir desde un programa, usa <b>MCP</b>, arriba, o Micropub desde una aplicación de notas. Los dos inician sesión; esto no, y por eso solo puede leer.</p>
<p class="links"><a href="doc:docs/content-api.md">Documentación de la Content API</a> <a href="/admin/settings?tab=server">{t:tabServer}</a></p>`,
    },
    {
      id: 'fediverse',
      title: 'Fediverso — deja que la gente siga el blog',
      body: `<p>Activa esto y tu blog se convierte en una <b>cuenta</b> que cualquiera en Mastodon —o en cualquiera de sus vecinos— puede seguir. Una entrada nueva llega a su línea temporal con su título, su entradilla y un enlace de vuelta aquí; el texto en sí se queda en tu blog, donde aún puedes editarlo. Editar una entrada envía una corrección; moverla a la papelera la retira.</p>
<p><b>Elige tu alias una sola vez.</b> Es la mitad <i>@name</i> de <i>@name@yourdomain</i>, y no es tu nombre de acceso: ese sigue siendo privado. Tu alias y la dirección de tu sitio <b>juntos son tu identidad</b> ahí fuera: cambia cualquiera de los dos más adelante y pierdes a todos tus seguidores, porque su servidor sigue buscando el nombre viejo y nada le dice adónde te has ido.</p>
<p>Hay dos cosas que a propósito <b>no</b> hace todavía. Publica pero no lee: las respuestas, los me gusta y los impulsos llegan a tu blog y se descartan, así que una respuesta en Mastodon no se convierte aquí en un comentario. Y nada de lo que escribiste <i>antes</i> de activarlo se envía nunca: activarlo no empuja tu archivo a la línea temporal de nadie.</p>
<p class="links"><a href="doc:docs/fediverse.md">Documentación del Fediverso</a> <a href="/admin/settings?tab=server">{t:tabServer}</a> <a href="/admin/log">Registro de actividad</a></p>`,
    },
  ],
  markdownTitle: 'El Markdown que entiende el editor',
  markdownLede: 'Markdown estándar, más estos. La barra de herramientas inserta la mayoría por ti.',
  markdownHead: ['Escribe esto', 'Y obtienes'],
  markdown: {
    '# … ######': 'Encabezados. La tabla de contenidos se construye a partir de ellos.',
    '> [!NOTE]': 'Un recuadro destacado. También TIP, WARNING, IMPORTANT y CAUTION.',
    '==text==': 'Resaltador. ==text==#green elige la tinta: amarillo, verde, rosa, azul o naranja.',
    '++text++': 'Subrayado a lápiz. ++text++#green traza la línea en una de las cinco tintas.',
    '@@word@@': 'Un círculo de bolígrafo alrededor de una palabra. @@word@@#blue elige la tinta; rojo si no hay ninguna.',
    'text[^1]': 'Una llamada a nota al pie; escribe la nota como [^1]: en cualquier parte del texto.',
    '![alt](url)': 'Una imagen. Soltar un archivo en el editor escribe esto por ti.',
    '![alt](url#frame)': 'Un paspartú alrededor de esa imagen. #frame-thin y #frame-thick cambian el grosor, ink oscurece el paspartú, y #noframe deja una imagen sin marco en un sitio con marcos.',
    '```lang': 'Código delimitado, coloreado en el servidor (sin script en el navegador del lector).',
    '---': 'El único estilo de separador que se usa en todo el sitio.',
    'YouTube / Vimeo': 'Una dirección de YouTube o Vimeo sola en su línea se convierte en un reproductor incrustado que se ajusta a la página.',
    'Spotify / Apple Music': 'Una dirección de Spotify o Apple Music sola en su línea se convierte en un reproductor incrustado (sin script de terceros).',
  },
  keysTitle: 'Las teclas a las que responde el editor',
  keysLede: 'Además de las habituales de negrita, cursiva, encabezados y deshacer.',
  keysHead: ['Pulsa', 'Y hace'],
  keys: {
    save: 'Guardar. Un borrador sigue siendo borrador y un texto publicado sigue publicado: solo Publicar, o el estado en el panel, cambia eso. El guardado automático conserva una copia en este dispositivo y en el servidor, pero solo Guardar escribe el texto en sí.',
    link: 'Añadir un enlace, o editar aquel en el que está el cursor. Vaciar la casilla lo quita.',
    ink: 'Resaltador sobre la selección (==text==).',
    ring: 'Un círculo de bolígrafo alrededor de la selección (@@word@@).',
    clear: 'Quitar todas las marcas de la selección: el arreglo para el texto pegado desde otro sitio.',
    attributes: 'El panel Atributos: dirección, fecha, categorías y etiquetas, las dos imágenes, los campos SEO y la papelera.',
    markdown: 'Cambiar entre la superficie de escritura y el código Markdown.',
    focus: 'Modo concentración: desaparece todo menos el papel.',
    find: 'Buscar, en cualquiera de las dos vistas. Enter va a la siguiente coincidencia, Shift-Enter a la anterior, Escape lo cierra.',
    replace: 'Buscar y reemplazar: la misma barra con el campo de reemplazo abierto. La flecha a su inicio también lo abre.',
    palette: 'Buscar en todo: las pantallas, los ajustes y tus textos. También el botón de arriba de la barra lateral.',
    bold: 'Negrita.',
    italic: 'Cursiva.',
    underline: 'Subrayado a lápiz (++text++).',
    strike: 'Tachado.',
    code: 'Código dentro de una línea de texto.',
    codeBlock: 'Un bloque de código.',
    heading: 'Encabezados de nivel 1 a 6: Mod-Alt-2 para un encabezado de nivel 2, y así sucesivamente. Mod-Alt-0 vuelve a párrafo.',
    bulletList: 'Lista con viñetas.',
    orderedList: 'Lista numerada.',
    taskList: 'Lista de tareas.',
    blockquote: 'Cita. Empiézala con [!NOTE] para un recuadro destacado.',
    undo: 'Deshacer. Shift-Mod-Z rehace.',
    hardBreak: 'Un salto de línea dentro del mismo párrafo.',
  },
  troubleTitle: 'Cuando algo no se ve bien',
  troubleLede: 'Los problemas que surgen de verdad, y lo que arregla cada uno.',
  troubleHead: ['Síntoma', 'Qué hacer'],
  trouble: [
    ['Un cambio ya está en el servidor, pero los lectores siguen viendo la página antigua', 'Cloudflare guarda en caché el HTML. Usa {t:clearCache} en la barra lateral: recargar el navegador no puede arreglar una caché en el borde.'],
    ['La prueba de SMTP falla con «wrong version number»', 'El puerto y el TLS no coinciden. 465 es TLS implícito (marca la casilla); 587 y 25 son STARTTLS (déjala sin marcar).'],
    ['Un suscriptor se apuntó pero no recibió ningún correo', 'La dirección se guarda antes de enviar el correo, así que la suscripción sobrevive a un SMTP roto. Busca el fallo en {t:navNewsletter} → {t:nlTabPeople}, y luego usa {t:navNewsletter} → {t:nlTabTest}.'],
    ['Una entrada programada no salió a su hora', 'El blog la publica por sí solo en el minuto siguiente a su hora, siempre que el servidor esté en marcha. Si el servidor estaba caído en ese momento, la entrada sale en cuanto vuelve.'],
    ['Ya no tienes la aplicación de autenticación y el acceso te pide su código', 'En la pantalla del código, elige «{t:authUseRecovery}» y escribe uno de tus códigos de recuperación; cada uno sirve una vez. Luego crea otros nuevos en {t:navSettings} → {t:tabAccount}.'],
    ['Una dirección antigua da 404 después de renombrar', 'Renombrar añade un 301 por sí solo. Si la dirección nunca existió aquí, añade una en {t:navSettings} → {t:tabServer} → {t:redirectsTitle}.'],
    ['Las imágenes desaparecieron tras una restauración', 'Abre /api/health: informa por separado de la base de datos y de la carpeta de almacenamiento.'],
  ],
}

export default help
