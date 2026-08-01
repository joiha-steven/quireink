"use strict";
var __dsPreview = (() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __esm = (fn, res, err) => function __init() {
    if (err) throw err[0];
    try {
      return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
    } catch (e) {
      throw err = [e], e;
    }
  };
  var __commonJS = (cb, mod) => function __require() {
    try {
      return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    } catch (e) {
      throw mod = 0, e;
    }
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __reExport = (target, mod, secondTarget) => (__copyProps(target, mod, "default"), secondTarget && __copyProps(secondTarget, mod, "default"));
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // <define:import.meta.env>
  var init_define_import_meta_env = __esm({
    "<define:import.meta.env>"() {
    }
  });

  // ds-raw:__ds_raw__
  var require_ds_raw = __commonJS({
    "ds-raw:__ds_raw__"(exports, module) {
      init_define_import_meta_env();
      module.exports = window.QuireInk;
    }
  });

  // shim:react-shim
  var require_react_shim = __commonJS({
    "shim:react-shim"(exports, module) {
      init_define_import_meta_env();
      var R = window.React;
      function np(p, k) {
        var o = {};
        for (var x in p) if (x !== "children") o[x] = p[x];
        if (k !== void 0) o.key = k;
        return o;
      }
      function jsx2(t, p, k) {
        var c = p && p.children;
        return c === void 0 ? R.createElement(t, np(p, k)) : R.createElement(t, np(p, k), c);
      }
      function jsxs(t, p, k) {
        return R.createElement.apply(R, [t, np(p, k)].concat(p.children));
      }
      module.exports = R;
      module.exports.jsx = jsx2;
      module.exports.jsxs = jsxs;
      module.exports.jsxDEV = function(t, p, k, s) {
        return (s ? jsxs : jsx2)(t, p, k);
      };
      module.exports.Fragment = R.Fragment;
    }
  });

  // .design-sync/previews/AdvancedFields.tsx
  var AdvancedFields_exports = {};
  __export(AdvancedFields_exports, {
    Basic: () => Basic,
    IdeChromeOn: () => IdeChromeOn
  });
  init_define_import_meta_env();

  // ds-shim:ds
  var ds_exports = {};
  __export(ds_exports, {
    default: () => ds_default
  });
  init_define_import_meta_env();
  __reExport(ds_exports, __toESM(require_ds_raw()));
  var g = window.QuireInk;
  var ds_default = "default" in g ? g.default : g;

  // .design-sync/previews/_fixtures.ts
  init_define_import_meta_env();

  // .design-sync/generated/settings.json
  var settings_default = {
    language: "en",
    title: "Quire Ink",
    description: "",
    siteUrl: "",
    logoUrl: "",
    logoWidth: 120,
    logoRenderUrl: "",
    logoEmailUrl: "",
    logoRenderHeight: 0,
    logoDarkUrl: "",
    logoDarkRenderUrl: "",
    logoDarkRenderHeight: 0,
    showLogo: false,
    showDescription: true,
    fontPreset: "inter",
    chromeFont: "inter",
    faviconUrl: "",
    appIconUrl: "",
    contentWidth: 672,
    postsPerPage: 10,
    relatedCount: 3,
    excerptLength: 50,
    ideChrome: false,
    customCss: "",
    footer: "© {year} {title} · [powered by Quire Ink](https://github.com/joiha-steven/quireink)",
    menu: [],
    featured: [],
    mostViewedCount: 3,
    sidebarLayout: "single",
    themePreset: "mono",
    enabledPalettes: [
      "mono",
      "sepia",
      "forest",
      "ocean",
      "scifi",
      "amber"
    ],
    themes: {
      mono: {
        light: {
          bg: "#fcfcfc",
          text: "#262626",
          heading: "#121212",
          meta: "#747474",
          link: "#121212",
          accent: "#121212",
          rule: "#ebebeb"
        },
        dark: {
          bg: "#0e0e0e",
          text: "#d6d6d6",
          heading: "#f2f2f2",
          meta: "#888888",
          link: "#f2f2f2",
          accent: "#f2f2f2",
          rule: "#262626"
        }
      },
      sepia: {
        light: {
          bg: "#f6f1e7",
          text: "#44372a",
          heading: "#2c2218",
          meta: "#776c5d",
          link: "#9a5b34",
          accent: "#9a5b34",
          rule: "#e3d8c4"
        },
        dark: {
          bg: "#211b14",
          text: "#ddd0bd",
          heading: "#f2e9d8",
          meta: "#9c8e79",
          link: "#d79b6c",
          accent: "#d79b6c",
          rule: "#3a3025"
        }
      },
      forest: {
        light: {
          bg: "#f5f7f2",
          text: "#2c352c",
          heading: "#1c241c",
          meta: "#6a7366",
          link: "#3f7d4f",
          accent: "#3f7d4f",
          rule: "#dde5d8"
        },
        dark: {
          bg: "#0f140f",
          text: "#cdd6c8",
          heading: "#e9efe5",
          meta: "#7e8a78",
          link: "#79b389",
          accent: "#79b389",
          rule: "#252e23"
        }
      },
      ocean: {
        light: {
          bg: "#f4f7fa",
          text: "#28323d",
          heading: "#16202b",
          meta: "#68737d",
          link: "#2c6fb3",
          accent: "#2c6fb3",
          rule: "#dbe4ec"
        },
        dark: {
          bg: "#0c121a",
          text: "#c7d2dd",
          heading: "#e8eef5",
          meta: "#7c8a98",
          link: "#6aa9e0",
          accent: "#6aa9e0",
          rule: "#202a36"
        }
      },
      scifi: {
        light: {
          bg: "#f2f5f7",
          text: "#1e2a33",
          heading: "#0d161e",
          meta: "#65717c",
          link: "#0c7b8e",
          accent: "#0c7b8e",
          rule: "#dce4ea"
        },
        dark: {
          bg: "#0a0f15",
          text: "#c3d2dc",
          heading: "#e7f1f7",
          meta: "#71808c",
          link: "#36cfe0",
          accent: "#36cfe0",
          rule: "#1b2630"
        }
      },
      amber: {
        light: {
          bg: "#fcfbf8",
          text: "#2e2a26",
          heading: "#1a1714",
          meta: "#78736c",
          link: "#a9620a",
          accent: "#a9620a",
          rule: "#ece7df"
        },
        dark: {
          bg: "#100f0d",
          text: "#d6d2ca",
          heading: "#f3f0ea",
          meta: "#8a857c",
          link: "#e8a13c",
          accent: "#e8a13c",
          rule: "#272420"
        }
      }
    },
    typography: {
      roles: {
        h1: {
          size: 2,
          line: 1.2,
          spacing: -0.02
        },
        h2: {
          size: 1.5,
          line: 1.27,
          spacing: -0.015
        },
        h3: {
          size: 1.25,
          line: 1.35,
          spacing: -0.01
        },
        h4: {
          size: 1.15,
          line: 1.45,
          spacing: -6e-3
        },
        h5: {
          size: 1,
          line: 1.5,
          spacing: 0
        },
        body: {
          size: 1.125,
          line: 1.7,
          spacing: 0
        },
        small: {
          size: 0.9375,
          line: 1.6,
          spacing: 0
        },
        caption: {
          size: 0.875,
          line: 1.5,
          spacing: 3e-3
        },
        code: {
          size: 0.875,
          line: 1.6,
          spacing: 0
        }
      },
      smoothing: false
    },
    customFont: {
      family: "",
      faces: []
    },
    home: {
      mode: "list",
      page: "",
      listPath: "/post",
      front: {
        kind: "image",
        lead: {
          on: true,
          source: "latest",
          slug: "",
          secondary: 3
        },
        featured: {
          on: true,
          count: 3,
          columns: 3
        },
        strips: [],
        popular: {
          on: false,
          count: 4,
          days: 30
        },
        latest: {
          on: true,
          count: 6,
          columns: 3
        },
        showDate: true,
        showReadingTime: true,
        tagLinks: true
      }
    },
    gallery: {
      ratio: "",
      captions: true
    },
    seo: {
      autoSchema: true,
      sitemap: true,
      llms: true,
      robots: true,
      rss: true,
      ogImage: true,
      ogFallbackImage: ""
    },
    features: {
      search: true,
      toc: true,
      related: true,
      readingTime: true,
      progressBar: true,
      activityLog: true,
      sidebar: true,
      sidebarSeries: true,
      leadPost: true,
      categoryLabel: true,
      deck: true,
      bookText: false,
      bookMode: true,
      infiniteScroll: false,
      gridView: true
    },
    comments: {
      enabled: false,
      turnstile: false,
      googleAuth: false
    },
    mcp: {
      enabled: false
    },
    motion: {
      enabled: true,
      typewriter: true
    },
    cache: {
      enabled: true
    },
    backups: {
      enabled: false,
      intervalDays: 4,
      keep: 4
    }
  };

  // .design-sync/previews/_fixtures.ts
  var SETTINGS = settings_default;
  var DAILY = Array.from({ length: 30 }, (_, i) => ({
    day: `2026-07-${String(i + 1).padStart(2, "0")}`,
    views: [
      82,
      96,
      130,
      118,
      240,
      410,
      386,
      210,
      175,
      168,
      190,
      205,
      260,
      330,
      298,
      245,
      220,
      208,
      196,
      188,
      240,
      285,
      340,
      402,
      368,
      300,
      265,
      248,
      232,
      220
    ][i],
    visitors: [
      51,
      60,
      78,
      71,
      142,
      238,
      221,
      130,
      110,
      104,
      118,
      127,
      158,
      196,
      179,
      148,
      136,
      128,
      121,
      116,
      148,
      172,
      203,
      238,
      219,
      181,
      160,
      151,
      142,
      136
    ][i]
  }));

  // .design-sync/previews/AdvancedFields.tsx
  var import_jsx_runtime = __toESM(require_react_shim(), 1);
  function Basic() {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      ds_exports.AdvancedFields,
      {
        typography: SETTINGS.typography,
        onTypography: () => {
        },
        ideChrome: false,
        onIdeChrome: () => {
        },
        motion: SETTINGS.motion,
        onMotion: () => {
        }
      }
    );
  }
  function IdeChromeOn() {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      ds_exports.AdvancedFields,
      {
        typography: SETTINGS.typography,
        onTypography: () => {
        },
        ideChrome: true,
        onIdeChrome: () => {
        },
        motion: { ...SETTINGS.motion, enabled: false },
        onMotion: () => {
        }
      }
    );
  }
  return __toCommonJS(AdvancedFields_exports);
})();
