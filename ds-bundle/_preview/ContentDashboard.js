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

  // .design-sync/previews/ContentDashboard.tsx
  var ContentDashboard_exports = {};
  __export(ContentDashboard_exports, {
    Basic: () => Basic,
    CommentsDisabled: () => CommentsDisabled
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
  var POSTS = [
    {
      title: "Bàn phím cơ và chuyện gõ tiếng Việt",
      slug: "ban-phim-co-va-go-tieng-viet",
      date: "2026-07-28T09:00:00.000Z",
      status: "published",
      categories: ["Bàn phím"],
      tags: ["telex", "firmware"],
      excerpt: "Bộ gõ nào cũng phải chọn giữa tốc độ và độ chính xác. Đây là chỗ tôi dừng lại.",
      readingMinutes: 8
    },
    {
      title: "What a static blog gives up, and what it buys",
      slug: "what-a-static-blog-gives-up",
      date: "2026-07-14T11:30:00.000Z",
      status: "published",
      categories: ["Engineering"],
      tags: ["bun", "sqlite"],
      excerpt: "Dropping the database was the easy part. Keeping the writing experience was not.",
      readingMinutes: 12
    },
    {
      title: "Notes on measuring a page instead of guessing",
      slug: "measuring-a-page",
      date: "2026-08-04T08:00:00.000Z",
      status: "draft",
      categories: ["Engineering"],
      tags: ["performance"],
      excerpt: "Every performance argument I have lost was lost to someone with numbers.",
      readingMinutes: 5
    }
  ];
  var PAGES = [
    { title: "About", slug: "about", status: "published" },
    { title: "Colophon", slug: "colophon", status: "published" },
    { title: "Now", slug: "now", status: "draft" }
  ];
  var VIEWS = {
    "/ban-phim-co-va-go-tieng-viet": 4218,
    "/what-a-static-blog-gives-up": 1907,
    "/measuring-a-page": 0,
    "/about": 612,
    "/colophon": 88
  };
  var COMMENT_COUNTS = {
    "ban-phim-co-va-go-tieng-viet": 12,
    "what-a-static-blog-gives-up": 3,
    "measuring-a-page": 0
  };

  // .design-sync/previews/ContentDashboard.tsx
  var import_jsx_runtime = __toESM(require_react_shim(), 1);
  function Basic() {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      ds_exports.ContentDashboard,
      {
        posts: POSTS,
        pages: PAGES,
        views: VIEWS,
        commentCounts: COMMENT_COUNTS,
        commentsEnabled: true
      }
    );
  }
  function CommentsDisabled() {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      ds_exports.ContentDashboard,
      {
        posts: POSTS,
        pages: PAGES,
        views: VIEWS,
        commentCounts: COMMENT_COUNTS,
        commentsEnabled: false
      }
    );
  }
  return __toCommonJS(ContentDashboard_exports);
})();
