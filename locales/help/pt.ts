import type { HelpText } from './types'

const help: HelpText = {
  intro: 'Tudo o que este blog sabe fazer, e onde fica cada coisa. Comece pelo topo se o site for novo; pule para uma seção se você está procurando algo específico.',
  index: {
    writing: 'Escrita', media: 'Mídia', readers: 'Leitores', analytics: 'Estatísticas', settings: 'Configurações',
    server: 'Servidor', cache: 'Cache', mcp: 'MCP', api: 'Content API', fediverse: 'Fediverso',
    markdown: 'Markdown', keys: 'Teclado', trouble: 'Problemas',
  },
  sections: [
    {
      id: 'writing',
      title: 'Escrever e publicar',
      body: `<ul>
<li>Markdown e uma barra de ferramentas. Enquanto você digita, uma cópia fica <b>guardada neste dispositivo e no servidor</b>; o texto em si só muda quando você clica em Salvar ou Publicar, então editar um post publicado nunca coloca texto pela metade no site.</li>
<li><b>Agende</b> publicando com uma data futura: o post fica escondido e entra no ar na hora certa. Ele <b>não</b> manda e-mail para ninguém sozinho.</li>
<li>As últimas <b>3 versões</b> de cada post ficam guardadas; restaure uma pelo editor.</li>
<li>As <b>séries</b> agrupam posts relacionados em ordem, com links para o anterior e o próximo e uma página <code>/series/…</code>.</li>
<li>Tudo o que você exclui vai para a <b>Lixeira</b>. Nada é apagado de vez automaticamente — a Lixeira é esvaziada à mão.</li>
</ul>
<p class="links"><a href="/admin/editor">Novo post</a> <a href="/admin/content">Todo o conteúdo</a> <a href="/admin/trash">Lixeira</a></p>`,
    },
    {
      id: 'media',
      title: 'Mídia e arquivos',
      body: `<ul>
<li>Solte uma imagem no editor ou na Biblioteca. Versões responsivas em <b>AVIF e WebP</b> e uma miniatura são geradas para você; o original é sempre mantido.</li>
<li>Abra uma imagem na Biblioteca para ler ou mudar a <b>descrição</b> dela (texto alternativo), as palavras que um leitor que não consegue vê-la ouve no lugar.</li>
<li>Qualquer imagem pode ter uma <b>moldura</b> — um passe-partout de papel ou de tinta, em três espessuras — escolhida na própria imagem, no editor. {t:navSettings} → {t:tabPost} → {t:cardPictures} define a que todas as imagens usam quando não escolheram nenhuma; uma imagem que escolheu mantém a sua.</li>
<li>A Biblioteca marca os arquivos <b>sem uso</b> (nada aponta para eles), então uma faxina é segura. Ela só avisa — nunca apaga.</li>
<li>Os arquivos ficam no disco do seu próprio servidor, servidos a partir de <code>/uploads</code>. Sem conta de armazenamento de objetos.</li>
</ul>
<p class="links"><a href="/admin/media">Abrir a Biblioteca</a> <a href="/admin/settings?tab=post">{t:tabPost}</a></p>`,
    },
    {
      id: 'readers',
      title: 'Leitores — comentários e newsletter',
      body: `<p>Os dois ficam <b>desligados até você configurá-los</b>, e os dois são seus: nenhum serviço de terceiros fica entre você e os seus leitores.</p>
<ul class="after">
<li><b>Comentários</b> — ative em {t:navSettings} → {t:tabPeople}. O Cloudflare Turnstile contra spam e o login com o Google são opcionais. Você pode ler e excluir comentários na tela Comentários.</li>
<li><b>Newsletter</b> — informe os dados de SMTP em {t:navSettings} → {t:tabPeople}, e um formulário de inscrição aparece no fim de cada post, com um botão no cabeçalho do site. A inscrição é de <b>confirmação dupla</b>: um endereço só conta depois de clicar no link de confirmação.</li>
<li><b>O envio é sempre manual.</b> Nada é enviado por e-mail automaticamente, nem mesmo quando um post agendado entra no ar. Você marca os posts, lê o e-mail de verdade na prévia e aperta enviar. Marque vários e eles saem como <b>um único resumo</b>, não uma mensagem para cada.</li>
<li>{t:navNewsletter} → {t:nlTabPeople} mostra o que cada endereço de fato recebeu, qualquer falha de SMTP com o erro, e a taxa de abertura. {t:navNewsletter} → {t:nlTabTest} manda para você uma amostra de cada e-mail antes que algum leitor o veja.</li>
</ul>
<p class="links"><a href="/admin/newsletter">{t:navNewsletter}</a> <a href="/admin/comments">Comentários</a> <a href="/admin/settings?tab=people">{t:tabPeople}</a></p>`,
    },
    {
      id: 'analytics',
      title: 'Estatísticas',
      body: `<ul>
<li><b>Sem cookies, sem dados pessoais.</b> Um visitante é um hash com sal do endereço e do navegador, e o texto do navegador em si nunca é guardado — só grupos amplos de dispositivo, navegador e sistema.</li>
<li>Robôs, páginas do admin e as suas próprias visitas ficam de fora, então os números são leitores.</li>
<li>Visualizações, até onde as pessoas rolam e quanto tempo ficam; de onde vieram; cada post separado. Guardado para sempre — não há janela móvel.</li>
</ul>
<p class="links"><a href="/admin/analytics">Abrir as Estatísticas</a></p>`,
    },
    {
      id: 'settings',
      title: 'Configurações',
      body: `<p>Um formulário e um só Salvar, aplicado ao site inteiro <b>sem novo deploy</b>. Sete abas:</p>
{tabs}
<p>Procurando uma configuração? Digite o nome dela na busca no topo da tela de Configurações.</p>
<p class="links"><a href="/admin/settings">Abrir as Configurações</a></p>`,
    },
    {
      id: 'server',
      title: 'Servidor, backups e atualizações',
      body: `<ul>
<li>Roda inteiramente no <b>seu próprio servidor</b>: dois arquivos SQLite para o conteúdo e para as estatísticas, e o disco local para as imagens. Nativo ou Docker, sem conta na nuvem.</li>
<li><code>/api/health</code> informa o banco de dados e a pasta de armazenamento separadamente — aponte o seu monitor de disponibilidade para ele. O servidor se recusa a iniciar quando falta uma configuração obrigatória, em vez de iniciar configurado pela metade.</li>
<li><b>Backups</b>: cópias agendadas (os dois bancos de dados e todos os arquivos) gravadas no seu próprio disco, uma cópia fora do servidor se você adicionar uma, e um pacote para baixar agora. {t:navSettings} → {t:tabServer} → {t:backupTitle}.</li>
<li>As atualizações aplicam <b>migrações de banco de dados registradas</b>, então uma mudança no esquema roda uma vez e só uma vez.</li>
</ul>
<p class="links"><a href="doc:docs/self-host.md">Guia de hospedagem própria</a> <a href="doc:docs/backups.md">{t:backupTitle}</a></p>`,
    },
    {
      id: 'cache',
      title: 'Cloudflare e o cache',
      body: `<p>Coloque o Cloudflare na frente para ter TLS e um cache perto de cada leitor — o grande ganho quando os leitores estão longe do seu servidor.</p>
<ul class="after">
<li><b>Cache Rules</b>: ignore o cache em <code>/admin</code> e <code>/api</code>, guarde em cache todo o resto pelo tempo que o servidor indicar. <b>Desligue o Rocket Loader</b> (ele reordena e atrasa scripts, o que quebra o admin). SSL: Full (Strict).</li>
<li>Adicione um token da API do Cloudflare e o Zone ID em {t:navSettings} → {t:tabServer} → {t:cardCloudflare}, e cada vez que você salvar a zona é limpa sozinha.</li>
<li><b>{t:clearCache}</b>, na barra lateral, limpa este servidor e o Cloudflare, depois aquece de novo a página inicial e as páginas mais recentes.</li>
<li>Depois de fazer deploy de código novo, limpe o cache da borda com <code>GET /api/cron?purge=1</code>. O Cloudflare guarda o HTML em cache, então uma página desatualizada não é algo que um leitor resolva recarregando.</li>
</ul>
<p class="links"><a href="https://developers.cloudflare.com/cache/how-to/cache-rules/">Cache Rules</a> <a href="doc:docs/seo-pwa.md">SEO e cache</a></p>`,
    },
    {
      id: 'mcp',
      title: 'MCP — deixe uma IA cuidar do blog',
      body: `<p>O <b>servidor MCP</b> embutido dá a um agente de IA <b>as mesmas regras do admin</b>: escrever e atualizar posts e páginas, cuidar das imagens e das configurações, cada mudança verificada e anotada no diário de atividade exatamente como as suas. Ative e crie tokens de acesso em {t:navSettings} → {t:tabServer} → {t:cardMcp} — um token é mostrado uma vez e guardado só como hash.</p>
<p>As mesmas capacidades existem dentro do admin na tela <b>Assistente</b>, rodando no modelo de {t:navSettings} → {t:tabServer} → {t:cardAi} — sem precisar de cliente MCP. Por qualquer uma das portas o agente <b>lê e cuida</b>: o tráfego desta semana comparado com o da semana passada, comentários varridos para a Lixeira, o arquivo pesquisado (rascunhos incluídos), a página inicial reorganizada em torno do que as pessoas de fato leem, o visual refeito a partir das paletas prontas, uma edição de teste da newsletter enviada só para você. Pergunte a ele <i>como foi meu blog esta semana?</i> e ele responde com os números do próprio painel — o <b>livro de receitas</b> abaixo é uma página de pedidos que fazem trabalho de verdade.</p>
<p>Onde ficam os limites: os endereços dos assinantes e quem escreveu cada comentário nunca passam pelo MCP; o visual só aceita as escolhas prontas, nunca uma cor livre; o que é excluído vai para a Lixeira, não some; e enviar a newsletter de verdade <b>de propósito não é uma ferramenta</b> — um e-mail não pode ser desenviado, então esse botão continua sendo seu.</p>
<p class="links"><a href="doc:docs/agent-cookbook.md">Livro de receitas do agente</a> <a href="doc:docs/mcp.md">Documentação do MCP</a> <a href="/admin/settings?tab=server">{t:tabServer}</a> <a href="/admin/log">Diário de atividade</a></p>`,
    },
    {
      id: 'api',
      title: 'Content API — deixe um programa ler o blog',
      body: `<p>A <b>Content API</b> serve os seus textos publicados em JSON em <code>/api/v1</code> — posts, páginas, notas e as suas categorias, cada um com o Markdown em que foi escrito. Ela serve para construir algo a partir do blog em vez de lê-lo: um segundo front-end, um índice de busca, uma cópia estática, um script que confere os próprios links. Ative em {t:navSettings} → {t:tabServer}; até você fazer isso, cada um desses endereços responde <b>404</b>.</p>
<p><b>Ela só lê, e não tem chave.</b> Qualquer pessoa que saiba o endereço pode lê-la, e o que recebe é exatamente o que já conseguiria navegando pelo site: nenhum rascunho, nenhum post com data futura, nada da Lixeira, e nada que possa mudar o blog. O interruptor existe por causa do que ela torna <i>barato</i>, não do que ela torna possível — o blog inteiro em tantas requisições quantas páginas ele tiver. Num blog pessoal tranquilo, isso é uma conveniência; decida para o seu.</p>
<p>Para escrever a partir de um programa, use o <b>MCP</b> acima, ou o Micropub a partir de um app de notas. Os dois fazem login; esta não, e é por isso que ela só pode ler.</p>
<p class="links"><a href="doc:docs/content-api.md">Documentação da Content API</a> <a href="/admin/settings?tab=server">{t:tabServer}</a></p>`,
    },
    {
      id: 'fediverse',
      title: 'Fediverso — deixe as pessoas seguirem o blog',
      body: `<p>Ative isto e o seu blog vira uma <b>conta</b> que qualquer pessoa no Mastodon — ou em qualquer um dos vizinhos dele — pode seguir. Um post novo chega na timeline delas como o título, o resumo e um link de volta para cá; o texto em si fica no seu blog, onde você ainda pode editá-lo. Editar um post envia uma correção; movê-lo para a Lixeira o retira.</p>
<p><b>Escolha o seu identificador uma vez só.</b> Ele é a metade <i>@name</i> de <i>@name@yourdomain</i>, e não é o seu nome de login — esse continua privado. O seu identificador e o endereço do site <b>juntos são a sua identidade</b> lá fora: mude qualquer um deles depois e você perde todos os seguidores, porque o servidor deles continua procurando o nome antigo e nada diz a ele para onde você foi.</p>
<p>Há duas coisas que ele de propósito ainda <b>não</b> faz. Ele publica mas não lê: respostas, curtidas e impulsionamentos chegam ao seu blog e são descartados, então uma resposta no Mastodon não vira um comentário aqui. E nada do que você escreveu <i>antes</i> de ativá-lo é enviado — ativar não empurra o seu arquivo para a timeline de ninguém.</p>
<p class="links"><a href="doc:docs/fediverse.md">Documentação do Fediverso</a> <a href="/admin/settings?tab=server">{t:tabServer}</a> <a href="/admin/log">Diário de atividade</a></p>`,
    },
  ],
  markdownTitle: 'O Markdown que o editor entende',
  markdownLede: 'Markdown padrão, e mais estes. A barra de ferramentas insere a maioria deles para você.',
  markdownHead: ['Digite isto', 'E você obtém'],
  markdown: {
    '# … ######': 'Títulos. O sumário é montado a partir deles.',
    '> [!NOTE]': 'Uma caixa de destaque. Também TIP, WARNING, IMPORTANT e CAUTION.',
    '==text==': 'Marca-texto. ==text==#green escolhe a tinta: yellow, green, pink, blue ou orange.',
    '++text++': 'Sublinhado a lápis. ++text++#green traça a linha numa das cinco tintas.',
    '@@word@@': 'Um círculo de caneta esferográfica em volta de uma palavra. @@word@@#blue escolhe a tinta; vermelho se não houver nenhuma.',
    'text[^1]': 'Uma referência de nota de rodapé; escreva a nota como [^1]: em qualquer lugar do texto.',
    '![alt](url)': 'Uma imagem. Soltar um arquivo no editor escreve isto para você.',
    '![alt](url#frame)': 'Um passe-partout em volta dessa imagem. #frame-thin e #frame-thick mudam a espessura, ink deixa o passe-partout escuro, e #noframe mantém uma imagem simples num site com molduras.',
    '```lang': 'Bloco de código, colorido no servidor (sem script no navegador do leitor).',
    '---': 'O único estilo de divisor usado em todo o site.',
    'YouTube / Vimeo': 'Um endereço do YouTube ou do Vimeo sozinho numa linha vira um player incorporado que se ajusta à página.',
    'Spotify / Apple Music': 'Um endereço do Spotify ou do Apple Music sozinho numa linha vira um player incorporado (sem script de terceiros).',
  },
  keysTitle: 'As teclas que o editor atende',
  keysLede: 'Além dos habituais negrito, itálico, títulos e desfazer.',
  keysHead: ['Aperte', 'E ele'],
  keys: {
    save: 'Salvar. Um rascunho continua rascunho e um texto publicado continua publicado: só Publicar, ou o status no painel, muda isso. O salvamento automático guarda uma cópia neste dispositivo e no servidor, mas só Salvar grava o texto em si.',
    link: 'Adicionar um link, ou editar aquele em que o cursor está. Esvaziar a caixa remove o link.',
    ink: 'Marca-texto sobre a seleção (==text==).',
    ring: 'Um círculo de caneta esferográfica em volta da seleção (@@word@@).',
    clear: 'Tirar todas as marcas da seleção — o conserto para texto colado de outro lugar.',
    attributes: 'O painel Atributos: endereço, data, categorias e tags, as duas imagens, os campos de SEO e a Lixeira.',
    markdown: 'Alternar entre a superfície de escrita e o código Markdown.',
    focus: 'Modo foco: tudo some, menos o papel.',
    find: 'Procurar, em qualquer uma das visualizações. Enter vai para a próxima ocorrência, Shift-Enter para a anterior, Escape fecha.',
    replace: 'Procurar e substituir: a mesma faixa com o campo de substituição aberto. A seta no início dela também o abre.',
    palette: 'Pesquisar tudo: as telas, as configurações e os seus textos. Também é o botão no topo da barra lateral.',
    bold: 'Negrito.',
    italic: 'Itálico.',
    underline: 'Sublinhado a lápis (++text++).',
    strike: 'Tachado.',
    code: 'Código dentro de uma linha de texto.',
    codeBlock: 'Um bloco de código.',
    heading: 'Níveis de título de 1 a 6 — Mod-Alt-2 para um título de nível 2, e assim por diante. Mod-Alt-0 volta para parágrafo.',
    bulletList: 'Lista com marcadores.',
    orderedList: 'Lista numerada.',
    taskList: 'Lista de tarefas.',
    blockquote: 'Citação. Comece com [!NOTE] para uma caixa de destaque.',
    undo: 'Desfazer. Shift-Mod-Z refaz.',
    hardBreak: 'Uma quebra de linha dentro do mesmo parágrafo.',
  },
  troubleTitle: 'Quando algo parece errado',
  troubleLede: 'Os problemas que de fato aparecem, e o que resolve cada um.',
  troubleHead: ['Sintoma', 'O que fazer'],
  trouble: [
    ['Uma edição já está no servidor, mas os leitores continuam vendo a página antiga', 'O Cloudflare guarda o HTML em cache. Use {t:clearCache} na barra lateral — recarregar o navegador não resolve um cache na borda.'],
    ['O teste de SMTP falha com «wrong version number»', 'A porta e o TLS não combinam. 465 é TLS implícito (marque a caixa); 587 e 25 são STARTTLS (deixe desmarcada).'],
    ['Um assinante se inscreveu, mas não recebeu nenhum e-mail', 'O endereço é salvo antes de o e-mail ser enviado, então a inscrição sobrevive a um SMTP quebrado. Procure a falha em {t:navNewsletter} → {t:nlTabPeople}, e depois use {t:navNewsletter} → {t:nlTabTest}.'],
    ['Um post agendado não entrou no ar na hora', 'O blog publica sozinho em até um minuto depois da hora marcada, desde que o servidor esteja rodando. Se o servidor estava fora do ar naquele momento, o post entra no ar assim que ele voltar.'],
    ['O app autenticador sumiu e o login pede o código dele', 'Na tela do código, escolha «{t:authUseRecovery}» e digite um dos seus códigos de recuperação; cada um funciona uma vez. Depois crie novos em {t:navSettings} → {t:tabAccount}.'],
    ['Um endereço antigo dá 404 depois de renomear', 'Renomear adiciona um 301 sozinho. Se o endereço nunca existiu aqui, adicione um em {t:navSettings} → {t:tabServer} → {t:redirectsTitle}.'],
    ['As imagens sumiram depois de uma restauração', 'Abra /api/health — ele informa o banco de dados e a pasta de armazenamento separadamente.'],
  ],
}

export default help
