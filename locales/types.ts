// Shape contracts for UI string dictionaries.
// Add a key here → TS will require it in every locale file.

export type Dict = {
  emptyPosts: string
  // The composed front page's row labels. ADR 0014.
  frontFeatured: string
  frontPopular: string
  frontLatest: string
  frontAllPosts: string
  emptyCategory: string
  emptyTag: string
  categoryLabel: string
  tagLabel: string
  menu: string
  skipToContent: string
  shortSearch: string
  shortTheme: string
  shortGrid: string
  shortMail: string
  shortMenu: string
  shortPalette: string
  gridView: string
  listView: string
  palette: string
  paletteNames: Record<string, string>
  theme: string
  themeLight: string
  themeDark: string
  themeSystem: string
  themeTime: string
  readingSuffix: string
  wordsSuffix: string
  bylinePrefix: string
  authorAbout: string
  bookMode: string
  bookModeClose: string
  bookModePrev: string
  bookModeNext: string
  bookModeSmaller: string
  bookModeLarger: string
  search: string
  searchHint: string
  searchEmpty: string
  searchResults: string
  pagerNewer: string
  pagerOlder: string
  // The pager's own landmark name. A page can carry two or three <nav> regions and a
  // screen reader lists them by label alone; unlabelled they all read as "navigation".
  pagerLabel: string
  // Meta descriptions for the listing surfaces that have no words of their own. Without
  // them home, search, every tag, every category and every series shipped ONE shared
  // sentence — the site description — so four indexable page kinds carried an identical,
  // uninformative snippet. `{name}` is the term, `{site}` the site title.
  metaTerm: string
  metaSeries: string
  tocIndex: string
  categoriesTitle: string
  mostViewedTitle: string
  featuredTitle: string
  tagsTitle: string
  relatedTitle: string
  readNext: string
  readNextSeries: string
  resumePrompt: string
  seriesLabel: string
  seriesPartPrefix: string
  seriesTitle: string
  emptySeries: string
  // /archive: the year index, its jump row and its empty state. `archiveTitle` is also
  // the sidebar block's heading, so the page and the way in carry one name.
  archiveTitle: string
  archiveMeta: string
  archiveYears: string
  archiveEmpty: string
  previewNotice: string
  nlInvalid: string
  nlNoMail: string
  copyCode: string
  copiedCode: string
  nlHeading: string
  nlPlaceholder: string
  nlButton: string
  nlSuccess: string
  nlError: string
  nlConfirmSubject: string
  nlConfirmIntro: string
  nlConfirmButton: string
  nlConfirmIgnore: string
  nlThanksTitle: string
  nlThanksBody: string
  nlLinkInvalid: string
  nlUnsubTitle: string
  nlUnsubBody: string
  nlUnsubFooter: string
  nlFooterWhy: string
  nlUnsubConfirm: string
  nlUnsubConfirmBtn: string
  mailTestSubject: string
  mailTestBody: string
  mailTestSamplePost: string
  bcastRead: string
  bcastDigestSubject: string
  replySubject: string
  replyIntro: string
  replyRead: string
  notFoundTitle: string
  notFoundText: string
  errorTitle: string
  errorText: string
  backHome: string
  backToTop: string
  quoteCopy: string
  quoteCopied: string
  // image lightbox
  lightboxPrev: string
  lightboxNext: string
  lightboxClose: string
  // comments
  commentsHeading: string
  commentsEmpty: string
  commentName: string
  commentEmail: string
  commentEmailNote: string
  commentWebsite: string
  commentBody: string
  commentSubmit: string
  commentReply: string
  commentDeleted: string
  commentError: string
  /** Shown for the moment a stale comment stamp is being re-solved (ADR 0032). */
  commentChecking: string
  commentSignInGoogle: string
  commentAs: string
  commentSignOut: string
  commentSignInError: string
}

export type AdminStrings = {
  // nav
  navHome: string
  navWrite: string
  navMore: string
  navMedia: string
  navSettings: string
  navViewBlog: string
  // content row actions + taxonomy manager
  openInNewTab: string
  tabTaxonomy: string
  rename: string
  renamePrompt: string
  confirmDeleteTerm: string
  noTerms: string
  renamed: string
  // series manager (Content → Series tab)
  tabSeries: string
  noSeries: string
  confirmDeleteSeries: string
  seriesReordered: string
  signOut: string
  clearCache: string
  cacheCleared: string
  cacheTitle: string
  cacheEnable: string
  cacheEnableDesc: string
  cacheClearDesc: string
  clearCacheFailed: string
  // Settings -> System -> Updates. `updateAvailable` carries {v}, the newer version.
  updateTitle: string
  updateCheckLabel: string
  updateCheckWhat: string
  updateCheckDesc: string
  updateAvailable: string
  updateAvailableNote: string
  updateAvailableLink: string
  /** Tooltip on the green dot beside the version. */
  updateCurrent: string
  // Settings -> Site. One zone for the whole site: post dates, month markers, analytics days.
  siteTimezone: string
  siteTimezoneHint: string
  siteTimezoneServer: string
  // dashboard
  tabPosts: string
  tabPages: string
  /** Singular, and it marks ONE ROW in the writing list, where `tabPages` named a tab. */
  kindPage: string
  newPost: string
  newPage: string
  noPosts: string
  noPages: string
  colTitle: string
  colStatus: string
  colDate: string
  /** The writing list sorts on the last SAVE, so its column cannot be headed 'Date'. */
  colTouched: string
  colCategories: string
  colViews: string
  untitled: string
  statusPublished: string
  statusDraft: string
  filterPlaceholder: string
  filterAll: string
  filterEmpty: string
  // The command palette (⌘K). Its placeholder is the whole instruction: one box, and it
  // reaches the screens, the settings and the writing. ADR 0011 is why it exists — no
  // arrangement makes a person remember which of eight tabs holds a setting.
  paletteTitle: string
  palettePlaceholder: string
  // The write pane's scope row: five words that must share ONE line in a 320px column,
  // so each language gets its own deliberately short set instead of reusing the longer
  // status/kind labels. Measured, not assumed — the row may not wrap.
  scopePages: string
  scopePosts: string
  scopePublished: string
  scopeDrafts: string
  // The pane's sort toggle: one quiet button cycling between the two orders.
  sortUpdated: string
  sortCreated: string
  commentsSearch: string
  commentsSortRecent: string
  commentsSortBusiest: string
  commentsInPosts: string
  commentsStatPosts: string
  commentsStatWeek: string
  commentsStatPeople: string
  commentsFootHint: string
  edit: string
  delete: string
  // The editor's Attributes panel. The confirmation says the piece can be brought back,
  // because `DELETE /api/posts/:slug` is a SOFT delete — the row keeps its body, its
  // revisions and its slug. The strings this replaces said the action could not be
  // undone, which was never true of that endpoint.
  moveToTrash: string
  confirmTrashPost: string
  confirmTrashPage: string
  // The write pane's selection mode. `selectPieces` is a VERB and it shares one 320px line
  // with Taxonomy, Series and the sort cycle, so each language picks its shortest true word —
  // the same rule the scope tabs above are held to. The confirmation carries no number: a
  // count inside a sentence needs a plural form in half these languages, and the button
  // beside it already prints `(N)`.
  selectPieces: string
  selectDone: string
  confirmTrashMany: string
  trashPartial: string
  // The line above the red button at the foot of the Attributes panel. It has to say BOTH
  // halves: the piece goes now, and it is recoverable.
  trashNote: string
  deleted: string
  deleteFailed: string
  // editor
  titlePlaceholder: string
  saveDraft: string
  publish: string
  /** Sits above the attributes when they open AS the publish sheet (ADR 0024). */
  publishReview: string
  viewPost: string
  saving: string
  savedAtPrefix: string
  keptLocallyPrefix: string
  // The autosave line, and the two prefixes are the whole point of having two: one copy is
  // on this machine and one is not, and which of those is true decides whether a dead laptop
  // costs you the morning. `serverDraftFound` is the recovery line's wording when the snapshot
  // being offered came from the server — usually because it was typed on another machine.
  keptOnServerPrefix: string
  serverDraftFound: string
  saveFailed: string
  slugTaken: string
  needTitle: string
  savedDraft: string
  published: string
  imageUploadFailed: string
  // local (offline) autosave recovery bar
  localDraftFound: string
  localDraftRestore: string
  localDraftDiscard: string
  // toolbar
  promptLink: string
  /** The one control that replaced six heading buttons and four block buttons. */
  tbBlock: string
  /** The one control that replaced six insert buttons. */
  tbInsert: string
  tbParagraph: string
  tbList: string
  tbListNumbered: string
  tbTask: string
  tbQuote: string
  tbCodeBlock: string
  tbDivider: string
  tbLink: string
  tbLinkRemove: string
  tbImage: string
  tbGallery: string
  tbTable: string
  // table editing controls (shown only when the cursor is inside a table)
  tbColAdd: string
  tbColDel: string
  tbRowAdd: string
  tbRowDel: string
  tbTableDelete: string
  tbMarkdown: string
  tbReview: string
  tbBold: string
  tbItalic: string
  tbUnderline: string
  tbRing: string
  tbStrike: string
  tbHighlight: string
  tbCodeInline: string
  footerContent: string
  footerHint: string
  editorPlaceholder: string
  writeEmpty: string
  dateNow: string
  tbHeading: string
  slashHint: string
  edWords: string
  edFocus: string
  edReadMinutes: string
  pubTitle: string
  pubLater: string
  // in-body image
  imgAlignLeft: string
  imgAlignCenter: string
  imgAlignRight: string
  imgSizeColumn: string
  imgSizeWide: string
  /** Placeholder in the editor's formula box, and the label of an empty formula. */
  mathPlaceholder: string
  /** Toolbar: insert a display formula on its own line. */
  tbMath: string
  /** Toolbar: insert a formula inside the sentence. */
  tbMathInline: string
  imgGrid: string
  // gallery options: the ratio labels (1:1, 3:2, 4:3) are the same in every language and
  // live in the component; only these two are words.
  imgRatioNatural: string
  imgCaptions: string
  imgNoCaptions: string
  imgDefault: string
  // The frame a picture wears. Weight is four-valued because "framed" and "how thick"
  // are one decision; paper/ink is the mat's colour and only applies once framed.
  imgFrameNone: string
  imgFrameThin: string
  imgFrameMedium: string
  imgFrameThick: string
  imgFramePaper: string
  imgFrameInk: string
  // The SITE-WIDE default frame, in Settings. Applied as styling rather than markup, so a
  // change reframes every picture at once without re-rendering a single post.
  cardFigure: string
  figureFrame: string
  figureFrameHint: string
  figureFrameColour: string
  figureFrameColourHint: string
  // Settings -> Layout -> Galleries
  cardGallery: string
  galleryRatio: string
  galleryRatioHint: string
  galleryCaptions: string
  galleryCaptionsHint: string
  // Settings -> Layout -> Post pictures. A post's cover is already stored, resized and
  // served; these two decide whether a reader ever sees it. BOTH DEFAULT TO OFF, and
  // `postImageHint` is the sentence that says so above the controls.
  cardPostImage: string
  postImageHint: string
  postImageHero: string
  postImageHeroHint: string
  postImageThumb: string
  postImageThumbHint: string
  /** Shared by both choosers: "no picture here". */
  piOff: string
  /** The hero's only "on" value: there is no wider one (see `PostImageSettings.hero`). */
  piHeroInline: string
  piThumbSide: string
  piThumbTop: string
  // Settings -> Appearance -> Shape. The three knobs that change shape rather than colour.
  // Every default reproduces today exactly, which is what `shapeHint` promises.
  cardShape: string
  shapeHint: string
  shapeDensity: string
  shapeDensityHint: string
  shapeRadius: string
  shapeRadiusHint: string
  shapeHeading: string
  shapeHeadingHint: string
  shapeCompact: string
  shapeNormal: string
  shapeRelaxed: string
  shapeSquare: string
  shapeSoft: string
  shapeRound: string
  shapeLight: string
  /** The middle weight. A separate key from `shapeNormal`: several languages use a
   *  different word for "normal spacing" and "regular weight". */
  shapeRegular: string
  shapeBold: string
  // Settings -> Appearance -> Tables. One set for the whole blog; GFM cannot express any
  // of it, so the Markdown stays portable.
  cardTable: string
  tableHint: string
  tableHead: string
  tableHeadHint: string
  tableHeadPlain: string
  tableHeadTint: string
  tableHeadRule: string
  tableHeadInk: string
  tableGrid: string
  tableGridHint: string
  tableGridAll: string
  tableGridRows: string
  tableGridNone: string
  tableRuleWeight: string
  tableRuleWeightHint: string
  tableHairline: string
  tableThick: string
  tableFirstCol: string
  tableFirstColHint: string
  tableColNormal: string
  tableColStrong: string
  tablePadding: string
  tablePaddingHint: string
  tableNarrow: string
  tableNarrowHint: string
  tableNarrowFit: string
  tableNarrowScroll: string
  tableStripe: string
  tableStripeHint: string
  // Settings -> Site -> Author. One blog, one owner (ADR 0002). An EMPTY NAME is the
  // default and means silence — no byline, no author box, no `author` in the structured
  // data — so `authorHint` has to say that before the first field.
  cardAuthor: string
  authorHint: string
  authorName: string
  authorNameHint: string
  authorBio: string
  authorBioHint: string
  authorAvatar: string
  authorAvatarHint: string
  authorNoAvatar: string
  authorLink: string
  authorLinkHint: string
  // Settings -> Layout -> Highlighter
  captionPlaceholder: string
  // post settings panel
  slug: string
  publishDate: string
  schedule: string
  scheduled: string
  scheduledForPrefix: string
  status: string
  seriesField: string
  seriesOrder: string
  seriesPlaceholder: string
  coverImageLabel: string
  coverImageHint: string
  metaTitleLabel: string
  metaDescriptionLabel: string
  seoSectionHint: string
  categories: string
  tags: string
  featuredImage: string
  featuredImageHint: string
  noImageSelected: string
  chooseImage: string
  removeSelection: string
  excerpt: string
  excerptPlaceholder: string
  // multi-select
  multiPlaceholder: string
  removeAria: string
  paletteNames: Record<string, string>
  defaultScheme: string
  defaultSchemeHint: string
  schemeNames: Record<string, string>
  // media
  libraryTitle: string
  tabImages: string
  tabVideos: string
  tabFiles: string
  videosDropzone: string
  noVideos: string
  mediaTitle: string
  mediaTotalImages: string
  mediaSearch: string
  sortLabel: string
  sortNewest: string
  sortName: string
  sortSize: string
  mediaNoMatch: string
  galleryPickTitle: string
  galleryPickHint: string
  galleryAdd: string
  copyUrl: string
  download: string
  filesDropzone: string
  noFiles: string
  loadFilesFailed: string
  unsupportedType: string
  checkUnused: string
  checkUnusedFailed: string
  unusedFound: string
  unusedNone: string
  unusedBadge: string
  showUnusedOnly: string
  showAll: string
  deleteAllUnused: string
  confirmDeleteUnused: string
  close: string
  loading: string
  noMedia: string
  confirmDeleteMedia: string
  deleteNoMatch: string
  libraryIntro: string
  deleteSelected: string
  clearSelection: string
  confirmDeleteSelected: string
  iconsGroupTitle: string
  iconsManaged: string
  copiedUrl: string
  loadMediaFailed: string
  // uploader
  dropzone: string
  uploaded: string
  uploadFailed: string
  // site settings
  settingsTitle: string
  settingsSearch: string
  settingsSearchEmpty: string
  firstRunTitle: string
  firstRunIntro: string
  firstRunDismiss: string
  firstRunReopen: string
  firstRun1Label: string
  firstRun1Body: string
  firstRun2Label: string
  firstRun2Body: string
  firstRun3Label: string
  firstRun3Body: string
  firstRun4Label: string
  firstRun4Body: string
  firstRun5Label: string
  firstRun5Body: string
  siteLanguage: string
  siteLanguageHint: string
  siteTitle: string
  siteDescription: string
  siteDescriptionPlaceholder: string
  showDescription: string
  showLogo: string
  noLogo: string
  noLogoDark: string
  chooseLogoDark: string
  logoDarkHint: string
  chooseLogo: string
  removeLogo: string
  logoWidth: string
  logoWidthHint: string
  siteWidth: string
  siteWidthHint: string
  postsPerPage: string
  postsPerPageHint: string
  favicon: string
  faviconHint: string
  appIcon: string
  appIconHint: string
  excerptLength: string
  excerptLengthHint: string
  relatedCount: string
  relatedCountHint: string
  securityTitle: string
  securityConfirm: string
  securityConfirmHint: string
  securityNewPassword: string
  securityChangePassword: string
  securityPasswordSignsOut: string
  securityPasswordChanged: string
  securityRecovery: string
  securityRecoveryHint: string
  securityNewCodes: string
  securityCodesOnce: string
  securityTotp: string
  securityTotpOn: string
  securityTotpOff: string
  securityReenrol: string
  securityScanHint: string
  securityConfirmCode: string
  securityTotpDone: string
  securitySessions: string
  securitySessionsHint: string
  securityThisDevice: string
  securityLastSeen: string
  securitySignOut: string
  securitySignOutThis: string
  securitySignOutOthers: string
  securitySignedOut: string
  securityUnknownDevice: string
  securityWrongPassword: string
  securityTooMany: string
  securityBadCode: string
  pwTooShort: string
  pwTooCommon: string
  pwContainsName: string
  customCss: string
  customCssHint: string
  cssLines: string
  cssBytes: string
  cssUnclosed: string
  cssStrayBrace: string
  cssShowNames: string
  cssHideNames: string
  cssNamesNote: string
  cssStructure: string
  saveSettings: string
  savedSettings: string
  menuTitle: string
  menuLabelField: string
  menuHrefField: string
  menuAdd: string
  menuHint: string
  // appearance
  navAppearance: string
  appearanceHint: string
  themePreset: string
  themePresetHint: string
  themeDefault: string
  themeSetDefault: string
  paletteShown: string
  paletteVisibilityHint: string
  modeLight: string
  modeDark: string
  colorBg: string
  colorText: string
  colorHeading: string
  colorMeta: string
  colorLink: string
  colorAccent: string
  colorRule: string
  resetDefault: string
  // settings tabs (task-based)
  tabSite: string
  tabSiteHint: string
  tabLayout: string
  tabLayoutHint: string
  tabReading: string
  tabReadingHint: string
  tabAppearance: string
  tabAppearanceHint: string
  tabSeo: string
  tabSeoHint: string
  tabConnections: string
  tabConnectionsHint: string
  tabSystem: string
  tabSystemHint: string
  themeAdminNote: string
  // typography (per-role type system)
  cardTypography: string
  typographyHint: string
  typographyUnits: string
  colSize: string
  colLine: string
  colSpacing: string
  typoH1: string
  typoH2: string
  typoH3: string
  typoH4: string
  typoH5: string
  typoBody: string
  typoSmall: string
  typoCaption: string
  typoCode: string
  typographyPreview: string
  typographyPreviewBody: string
  // custom font (per weight)
  cardFont: string
  fontPresetHint: string
  chromeFontLabel: string
  chromeFontReading: string
  chromeFontHint: string
  fontHint: string
  fontFamilyLabel: string
  fontDefault: string
  fontUploaded: string
  fontChoose: string
  fontReplace: string
  fontWeight400: string
  fontWeight500: string
  fontWeight600: string
  fontWeight700: string
  // advanced (text rendering)
  cardRendering: string
  fontSmoothing: string
  fontSmoothingDesc: string
  ideChromeLabel: string
  ideChromeDesc: string
  motionLabel: string
  motionDesc: string
  keyFeedbackLabel: string
  keyFeedbackDesc: string
  keyFeedbackOff: string
  keyFeedbackWoody: string
  keyFeedbackCrisp: string
  keyFeedbackDeep: string
  keyVolumeLabel: string
  keyVolumeDesc: string
  keyHear: string
  autosaveLabel: string
  autosaveHint: string
  // overview
  overviewTitle: string
  // The home screen greeting (`Greeting.tsx`). Four parts of the day, and a PATTERN that
  // joins one to the name — so a language that puts no comma between them does not get one,
  // and eleven dictionaries hold five rows instead of eight.
  greetMorning: string
  greetAfternoon: string
  greetEvening: string
  greetNight: string
  greetWithName: string
  greetLastPublished: string
  greetNothingYet: string
  greetSetName: string
  greetToday: string
  statPosts: string
  statPages: string
  statComments: string
  statMedia: string
  statStorage: string
  dashTraffic: string
  dashViewAnalytics: string
  dashViews: string
  dashVisitors: string
  dashViews7: string
  dashAvgTime: string
  dashReadDepth: string
  dashPickUp: string
  dashTopPosts: string
  dashTopEmpty: string
  dashNeedsAttention: string
  dashAllClear: string
  dashNoExcerpt: string
  dashNoImage: string
  dashSources: string
  dashSourcesEmpty: string
  // overview: quick actions + recent activity
  viewSite: string
  // The home screen’s closing line of system facts. It read "SQLite · online · Local
  // filesystem" — three things that are true of EVERY install of this program and therefore
  // say nothing about this one. A version answers the question the line raises.
  sysStartedPrefix: string
  recentActivity: string
  recentViewAll: string
  // overview: SEO health + traffic sources widgets
  cardGeneral: string
  cardLayout: string
  cardFeatures: string
  cardBranding: string
  cardOnPage: string
  cardListing: string
  cardActivity: string
  // comments
  cardComments: string
  cardFeatured: string
  featuredHint: string
  featuredEmpty: string
  featuredAdd: string
  moveUp: string
  moveDown: string
  mostViewedCount: string
  mostViewedCountHint: string
  sidebarLayoutLabel: string
  sidebarLayoutSingle: string
  sidebarLayoutTwo: string
  sidebarLayoutHint: string
  // What `/` serves, and where the post list goes when it is not there. ADR 0014.
  homeModeLabel: string
  homeModeList: string
  homeModePage: string
  homeModeFront: string
  homeModeHint: string
  homePageLabel: string
  homePageNone: string
  homePageHint: string
  listPathLabel: string
  listPathHint: string
  // The composed front page's options. ADR 0014.
  cardFront: string
  frontKindLabel: string
  frontKindImage: string
  frontKindText: string
  frontKindHint: string
  frontLead: string
  frontLeadHint: string
  frontLeadSource: string
  frontLeadLatest: string
  frontLeadPinned: string
  frontLeadPickPost: string
  frontSecondary: string
  frontCount: string
  frontColumns: string
  frontFeaturedRow: string
  frontFeaturedHint: string
  frontStrips: string
  frontStripsHint: string
  frontStripAdd: string
  frontPopularRow: string
  frontPopularHint: string
  frontWindow: string
  frontWindow7: string
  frontWindow30: string
  frontWindowAll: string
  frontLatestRow: string
  frontLatestHint: string
  frontShowDate: string
  frontShowReading: string
  frontTagLinks: string
  frontTagLinksHint: string
  commentsEnable: string
  commentsEnableDesc: string
  commentsTurnstile: string
  commentsTurnstileDesc: string
  /** Which comment gate is standing right now (ADR 0032): Turnstile when its keys are
   *  set, and the blog's own signed puzzle otherwise. */
  commentsGateTurnstile: string
  commentsGateStamp: string
  commentsNeedsKey: string
  commentsGoogleAuth: string
  commentsAuthDesc: string
  commentsKeySite: string
  commentsKeySecret: string
  commentsKeySave: string
  commentsKeySaved: string
  commentsKeySet: string
  commentsTurnstileHelp: string
  commentsGoogleHelp: string
  commentsKeyGoogleId: string
  commentsKeyGoogleSecret: string
  commentsGoogleRedirect: string
  commentsHelpOpen: string
  commentsNavTitle: string
  commentsCount: string
  commentsColContent: string
  commentsColPost: string
  commentsColTime: string
  commentsColName: string
  commentsColIp: string
  commentsColDelete: string
  commentsConfirmDelete: string
  commentsEmpty: string
  // reader-feature toggles
  featSearch: string
  featSearchDesc: string
  featToc: string
  featTocDesc: string
  featRelated: string
  featRelatedDesc: string
  featReadingTime: string
  featReadingTimeDesc: string
  featProgress: string
  featProgressDesc: string
  featSidebar: string
  featSidebarDesc: string
  featSidebarSeries: string
  featSidebarCategories: string
  featSidebarCategoriesDesc: string
  featSidebarTags: string
  featSidebarTagsDesc: string
  featSidebarArchive: string
  featSidebarArchiveDesc: string
  featSidebarSeriesDesc: string
  featInfiniteScroll: string
  featInfiniteScrollDesc: string
  featGridView: string
  featGridViewDesc: string
  // Settings -> Features -> Listing: the /archive page and the sidebar year list.
  featArchive: string
  featArchiveDesc: string
  // Settings -> Reading: the service worker (ADR 0039). The description carries the two
  // things a reader would want to know and an owner would not think to ask: nothing is
  // fetched ahead of time, and turning it off UNINSTALLS it rather than merely stopping.
  featOffline: string
  featOfflineDesc: string
  featLeadPost: string
  featLeadPostDesc: string
  featCategoryLabel: string
  featCategoryLabelDesc: string
  featDeck: string
  featDeckDesc: string
  featPenUnderline: string
  featPenUnderlineDesc: string
  featPenRing: string
  featPenRingDesc: string
  featBookText: string
  featBookTextDesc: string
  featBookMode: string
  featBookModeDesc: string
  featReadNext: string
  featReadNextDesc: string
  featResume: string
  featResumeDesc: string
  // SEO fields
  seoCanonical: string
  seoCanonicalHint: string
  seoAutoSchema: string
  seoAutoSchemaDesc: string
  seoSitemapDesc: string
  seoRssDesc: string
  seoLlmsDesc: string
  seoRobotsDesc: string
  seoOgImage: string
  seoOgImageDesc: string
  seoFallbackLabel: string
  // time machine
  timeMachine: string
  unsaved: string
  attributes: string
  hideAttributes: string
  history: string
  tmIntro: string
  restore: string
  tmLatest: string
  tmEmpty: string
  revisionLoaded: string
  previewDraft: string
  // analytics (Admin → Analytics)
  navAnalytics: string
  analyticsTitle: string
  analyticsViews: string
  analyticsVisitors: string
  analyticsAvgDepth: string
  analyticsPeak: string
  analyticsNew: string
  analyticsReturning: string
  analyticsTopReferrers: string
  analyticsTopCountries: string
  analyticsColPage: string
  analyticsColDepth: string
  analyticsAvgTime: string
  analyticsOnePageOnly: string
  analyticsLeftQuickly: string
  analyticsPieces: string
  analyticsFindPiece: string
  // Analytics -> Delivery. Reader-reported bytes and the in-process cache. Both labels
  // have to keep saying what they are NOT: bytes are what browsers reported, never
  // server egress, and the cache is this process's, never the CDN's.
  analyticsDelivery: string
  analyticsBytesTotal: string
  analyticsBytesAvg: string
  analyticsBytesMeasured: string
  analyticsBytesNote: string
  analyticsCache: string
  analyticsCacheHits: string
  analyticsCacheSince: string
  analyticsCacheNote: string
  analyticsNowReading: string
  analyticsNowQuiet: string
  analyticsColTime: string
  analyticsChannels: string
  analyticsChannelDirect: string
  analyticsChannelSearch: string
  analyticsChannelSocial: string
  analyticsChannelReferral: string
  analyticsDevices: string
  analyticsBrowsers: string
  analyticsSystems: string
  analyticsDepthDist: string
  analyticsAllPages: string
  analyticsUnitSamples: string
  analyticsUnknown: string
  analyticsRange24h: string
  analyticsRange7: string
  analyticsRange30: string
  analyticsRange90: string
  analyticsRange365: string
  analyticsNoData: string
  analyticsPrivacyNote: string
  // activity log (Admin → Log) + feature toggle
  navLog: string
  navHelp: string
  featActivityLog: string
  featActivityLogDesc: string
  featTransferStats: string
  featTransferStatsDesc: string
  logTitle: string
  logEmpty: string
  logDisabled: string
  logColTime: string
  logColAction: string
  logColDetail: string
  logClear: string
  logClearConfirm: string
  logCleared: string
  // system info panel (Overview)
  navTrash: string
  trashTitle: string
  trashHint: string
  trashEmpty: string
  colDeletedAt: string
  restored: string
  restoreFailed: string
  deletePermanently: string
  confirmPurge: string
  confirmPurgeInUse: string
  emptyTrash: string
  confirmEmptyTrash: string
  trashEmptied: string
  purged: string
  purgeFailed: string
  movedToTrash: string
  // MCP server (Admin → Settings → Advanced)
  cardMcp: string
  cardCloudflare: string
  cardAi: string
  cardInk: string
  inkHelp: string
  inkHighlighter: string
  inkYellow: string
  inkGreen: string
  inkPink: string
  inkBlue: string
  inkOrange: string
  inkTooDark: string
  inkLines: string
  inkLinesHint: string
  inkRing: string
  inkUnderline: string
  inkSelection: string
  inkSelectionHint: string
  inkSelectionLight: string
  inkSelectionDark: string
  aiHelp: string
  aiKeyPh: string
  aiProviderOff: string
  tabAi: string
  tabAiHint: string
  aiTasksLabel: string
  aiAutoJobs: string
  aiTaskAltText: string
  aiModelsLoading: string
  aiModelsFailed: string
  /** The model list is also the only free test of a key, so its outcome is spoken in
   *  the three failures an owner can act on: wrong key, throttled, unreachable. */
  aiModelsLoad: string
  aiModelsOk: string
  aiKeyRejected: string
  aiKeyLimited: string
  aiProviderRefused: string
  aiNoReach: string
  aiTaskExcerpt: string
  aiTaskComments: string
  aiTaskCommentsDesc: string
  aiDescribeAll: string
  aiDescribeAllStarted: string
  aiNotConfigured: string
  aiCannotSeeImages: string
  navAssistant: string
  assistantIntro: string
  assistantPlaceholder: string
  assistantSend: string
  assistantBusy: string
  assistantFailed: string
  aiProviderLabel: string
  aiKeyLabel: string
  aiKeyStored: string
  aiModelLabel: string
  aiTasksNeedModel: string
  assistantEmpty: string
  assistantNeedsModel: string
  assistantModelOn: string
  assistantChats: string
  assistantWants: string
  assistantAllow: string
  assistantDeny: string
  assistantDidThis: string
  assistantDidNothing: string
  assistantShowAll: string
  assistantTokens: string
  assistantNoChats: string
  assistantUntitled: string
  assistantDelete: string
  assistantDeleteYes: string
  assistantContext: string
  assistantSpent: string
  assistantNew: string
  assistantEg1: string
  assistantEg2: string
  assistantEg3: string
  assistantNoModel: string
  assistantOpenAi: string
  cardCommentIntegrations: string
  cfHelp: string
  cfZoneId: string
  cfToken: string
  /** The purge webhook for any CDN that is not Cloudflare (ADR 0033). */
  cfWebhook: string
  cfWebhookHelp: string
  // WordPress import (Admin → Settings → Integrations)
  cardImport: string
  importHelp: string
  importChoose: string
  importRun: string
  importDone: string
  importImages: string
  importImagesDone: string
  importImagesFailed: string
  mcpEnable: string
  mcpEnableDesc: string
  mcpUrlLabel: string
  mcpUrlHint: string
  mcpUrlCopied: string
  mcpTokensTitle: string
  mcpTokensHint: string
  mcpGenerate: string
  mcpNamePrompt: string
  mcpOnceWarning: string
  mcpCopy: string
  mcpCopied: string
  mcpNoTokens: string
  mcpColName: string
  mcpColCreated: string
  mcpColLastUsed: string
  mcpColExpires: string
  mcpExpired: string
  mcpRefresh: string
  mcpNeverUsed: string
  mcpConfirmDelete: string
  mcpTokenDeleted: string
  mcpLimitReached: string
  mcpCreateFailed: string
  mcpReadOnly: string
  mcpReadOnlyHint: string
  // storage limits (Settings → System)
  storageTitle: string
  maxUploadLabel: string
  maxUploadHint: string
  storageQuotaLabel: string
  storageQuotaHint: string
  // backups (Google Drive)
  backupTitle: string
  offsiteTitle: string
  offsiteHelp: string
  s3Endpoint: string
  s3Region: string
  s3Bucket: string
  s3Prefix: string
  s3KeyId: string
  s3Secret: string
  offsiteTest: string
  offsiteTestOk: string
  exportHint: string
  exportNow: string
  exportBusy: string
  exportReplicationNote: string
  backupAuto: string
  backupAutoDesc: string
  backupIntervalLabel: string
  backupKeepLabel: string
  backupNow: string
  backupNone: string
  backupLastRun: string
  backupNever: string
  backupDeleteConfirm: string
  backupToastOk: string
  backupToastFail: string
  // redirects (Settings → SEO)
  redirectsTitle: string
  redirectsHint: string
  redirectSource: string
  redirectDestination: string
  redirectPermanent: string
  redirectAdd: string
  redirectEmpty: string
  redirectDelete: string
  redirectSaved: string
  redirectSaveFailed: string
  // newsletter (Settings → Integrations)
  cardNewsletter: string
  nlSmtpHint: string
  nlSmtpHost: string
  nlSmtpPort: string
  nlSmtpUser: string
  nlSmtpPass: string
  nlSmtpFrom: string
  nlSmtpSecure: string
  nlSaveSmtp: string
  nlSmtpSaved: string
  nlConfirmed: string
  nlPending: string
  nlUnsub: string
  nlDeleteSub: string
  nlNoSubs: string
  nlTestHeading: string
  nlTestHint: string
  nlTestTo: string
  nlTestSmtp: string
  nlTestPost: string
  nlTestSubscribe: string
  nlTestSent: string
  nlTestFailed: string
  navNewsletter: string
  nlPageHint: string
  nlSmtpSettingsLink: string
  nlManageLink: string
  nlNoSmtpWarning: string
  nlSmtpTlsMismatch: string
  nlTabPeople: string
  nlTabSend: string
  nlTabTest: string
  nlNoSubsHint: string
  nlColEmail: string
  nlColStatus: string
  nlColJoined: string
  nlColSent: string
  nlColOpenRate: string
  nlColLastSend: string
  nlFailedSuffix: string
  nlPickPost: string
  nlPreview: string
  nlPreviewHint: string
  nlPreviewFailed: string
  nlPreviewEmpty: string
  nlSubjectLabel: string
  nlNoPosts: string
  nlAlreadySent: string
  nlAlreadySentShort: string
  nlResendConfirm: string
  nlSendButton: string
  nlArmed: string
  nlSendDone: string
  nlSendFailed: string
  nlSendHint: string
  nlDigestHint: string
  // sidebar collapse
  navCollapse: string
  navExpand: string
  // sidebar icons, OFF by default since 2026-08-15
  navIconsShow: string
  navIconsHide: string
  // sign-in (new in 2.0; see v2/docs/06-auth.md)
  authSignIn: string
  // Both take {site}. The sign-in page wears the Quire Ink mark, so the blog it opens is named
  // in words instead — once under the heading, once in the way back out.
  authSignInLede: string
  authBackTo: string
  authUsername: string
  authPassword: string
  authShowPassword: string
  authHidePassword: string
  authCapsLock: string
  authContinue: string
  // Deliberately says nothing about WHICH was wrong. Same string for an unknown account
  // and a wrong password, or the message itself becomes the account-existence oracle that
  // the constant-time verification exists to close.
  authBadCredentials: string
  authLockedOut: string
  authTwoFactor: string
  authTwoFactorHint: string
  authCode: string
  authBadCode: string
  authUseRecovery: string
  authRecoveryCode: string
  authRecoveryHint: string
  authUseAuthenticator: string
  authRestart: string
  authSetUp: string
  authStepOf: string
  authScanTitle: string
  authScanHint: string
  authManualEntry: string
  authConfirmCode: string
  authCodesTitle: string
  authCodesHint: string
  authCodesDownload: string
  authCodesSaved: string
  authDone: string
  // ----- first run: claiming an install that has no owner yet -------------------
  // The only step that used to need a terminal. `setupWhereToLook` names both ways of
  // reading the log because the two audiences never overlap: a Docker user has never run
  // journalctl, and a systemd user has no container to look in.
  setupTitle: string
  setupLede: string
  setupEmail: string
  setupEmailHint: string
  setupCreate: string
  setupClaimed: string
  setupUnclaimedTitle: string
  setupUnclaimedLede: string
  setupWhereToLook: string
  setupBadLink: string
  // One message per rule the password check can fail, because "that password will not do"
  // without saying which rule leaves a person guessing. `{n}` is the minimum length.
  setupPwShort: string
  setupPwCommon: string
  setupPwName: string
  // ----- first run, after the account: the two questions worth asking ------------
  // Deliberately only two screens. Palettes, fonts, book mode and the feature switches are
  // NOT here: nobody can judge them before the site has a single post, and a choice made
  // blind is worse than a default, because a default still reads as "not chosen yet". Those
  // live on the dashboard's re-openable "first five minutes" card instead.
  siteStepTitle: string
  siteStepLede: string
  siteStepName: string
  siteStepLanguage: string
  siteStepTz: string
  siteStepTzHint: string
  siteStepAddress: string
  siteStepAddressHint: string
  faceStepTitle: string
  faceStepLede: string
  faceList: string
  faceListHint: string
  faceFront: string
  faceFrontHint: string
  setupFinish: string
  // Shown on the enrolment screen ONLY while the blog has no public address. Before anyone
  // has enrolled, two-factor protects nothing — whoever has the password first enrols their
  // own authenticator — so skipping on a laptop trial widens nothing. Setting a real address
  // takes the button away and the next sign-in asks again.
  authSkipNow: string
  authSkipWhy: string
  // The error boundary's sheet (`admin/ui/ErrorBoundary.tsx`). Written for someone who was
  // in the middle of a draft, not for whoever will read the stack: say what happened, say
  // that the work is not gone, then offer the two things that actually help.
  crashTitle: string
  crashText: string
  crashMissingTitle: string
  crashMissingText: string
  crashDetail: string
  crashReload: string
  crashHome: string
}
