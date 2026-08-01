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
      function jsxs2(t, p, k) {
        return R.createElement.apply(R, [t, np(p, k)].concat(p.children));
      }
      module.exports = R;
      module.exports.jsx = jsx2;
      module.exports.jsxs = jsxs2;
      module.exports.jsxDEV = function(t, p, k, s) {
        return (s ? jsxs2 : jsx2)(t, p, k);
      };
      module.exports.Fragment = R.Fragment;
    }
  });

  // .design-sync/previews/RowActions.tsx
  var RowActions_exports = {};
  __export(RowActions_exports, {
    DraftNoViewLink: () => DraftNoViewLink,
    InATableRow: () => InATableRow,
    Published: () => Published
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

  // .design-sync/previews/RowActions.tsx
  var import_jsx_runtime = __toESM(require_react_shim(), 1);
  function Published() {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "flex justify-end p-4", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.RowActions, { editHref: "/admin/content/what-a-static-blog-gives-up", viewHref: "/what-a-static-blog-gives-up", onDelete: () => {
    } }) });
  }
  function DraftNoViewLink() {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "flex justify-end p-4", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.RowActions, { editHref: "/admin/content/measuring-a-page", onDelete: () => {
    } }) });
  }
  function InATableRow() {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.TableFrame, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tbody", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { className: "border-b border-neutral-100 last:border-0 hover:bg-neutral-50", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { className: "px-4 py-3 text-sm", children: "What a static blog gives up" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { className: "px-4 py-3", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.StatusPill, { published: true, label: "Published" }) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { className: "px-4 py-3", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.RowActions, { editHref: "/admin/content/what-a-static-blog-gives-up", viewHref: "/what-a-static-blog-gives-up", onDelete: () => {
        } }) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { className: "border-b border-neutral-100 last:border-0 hover:bg-neutral-50", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { className: "px-4 py-3 text-sm", children: "Notes on measuring a page" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { className: "px-4 py-3", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.StatusPill, { published: false, label: "Draft" }) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { className: "px-4 py-3", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.RowActions, { editHref: "/admin/content/measuring-a-page", onDelete: () => {
        } }) })
      ] })
    ] }) });
  }
  return __toCommonJS(RowActions_exports);
})();
