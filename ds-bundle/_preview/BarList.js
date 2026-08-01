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

  // .design-sync/previews/BarList.tsx
  var BarList_exports = {};
  __export(BarList_exports, {
    EmptyState: () => EmptyState,
    Referrers: () => Referrers,
    TopPages: () => TopPages
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
  var BAR_ROWS = [
    { key: "/ban-phim-co-va-go-tieng-viet", label: "/ban-phim-co-va-go-tieng-viet", value: 4218 },
    { key: "/what-a-static-blog-gives-up", label: "/what-a-static-blog-gives-up", value: 1907 },
    { key: "/about", label: "/about", value: 612 },
    { key: "/colophon", label: "/colophon", value: 88 }
  ];
  var REFERRERS = [
    { key: "google.com", label: "google.com", value: 2841 },
    { key: "news.ycombinator.com", label: "news.ycombinator.com", value: 1663 },
    { key: "direct", label: "(direct)", value: 1319 },
    { key: "x.com", label: "x.com", value: 402 }
  ];

  // .design-sync/previews/BarList.tsx
  var import_jsx_runtime = __toESM(require_react_shim(), 1);
  function TopPages() {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.BarList, { title: "Top pages", rows: BAR_ROWS, unit: "views", empty: "No page views yet." });
  }
  function Referrers() {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.BarList, { title: "Referrers", rows: REFERRERS, unit: "visitors", empty: "No referrers yet." });
  }
  function EmptyState() {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.BarList, { title: "Countries", rows: [], unit: "visitors", empty: "No visitors in this range." });
  }
  return __toCommonJS(BarList_exports);
})();
