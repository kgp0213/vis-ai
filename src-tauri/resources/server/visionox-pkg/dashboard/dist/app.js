var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// node_modules/htm/dist/htm.module.js
var n = function(t5, s3, r3, e3) {
  var u3;
  s3[0] = 0;
  for (var h3 = 1; h3 < s3.length; h3++) {
    var p3 = s3[h3++], a3 = s3[h3] ? (s3[0] |= p3 ? 1 : 2, r3[s3[h3++]]) : s3[++h3];
    3 === p3 ? e3[0] = a3 : 4 === p3 ? e3[1] = Object.assign(e3[1] || {}, a3) : 5 === p3 ? (e3[1] = e3[1] || {})[s3[++h3]] = a3 : 6 === p3 ? e3[1][s3[++h3]] += a3 + "" : p3 ? (u3 = t5.apply(a3, n(t5, a3, r3, ["", null])), e3.push(u3), a3[0] ? s3[0] |= 2 : (s3[h3 - 2] = 0, s3[h3] = u3)) : e3.push(a3);
  }
  return e3;
}, t = /* @__PURE__ */ new Map();
function htm_module_default(s3) {
  var r3 = t.get(this);
  return r3 || (r3 = /* @__PURE__ */ new Map(), t.set(this, r3)), (r3 = n(this, r3.get(s3) || (r3.set(s3, r3 = function(n3) {
    for (var t5, s4, r4 = 1, e3 = "", u3 = "", h3 = [0], p3 = function(n4) {
      1 === r4 && (n4 || (e3 = e3.replace(/^\s*\n\s*|\s*\n\s*$/g, ""))) ? h3.push(0, n4, e3) : 3 === r4 && (n4 || e3) ? (h3.push(3, n4, e3), r4 = 2) : 2 === r4 && "..." === e3 && n4 ? h3.push(4, n4, 0) : 2 === r4 && e3 && !n4 ? h3.push(5, 0, true, e3) : r4 >= 5 && ((e3 || !n4 && 5 === r4) && (h3.push(r4, 0, e3, s4), r4 = 6), n4 && (h3.push(r4, n4, 0, s4), r4 = 6)), e3 = "";
    }, a3 = 0; a3 < n3.length; a3++) {
      a3 && (1 === r4 && p3(), p3(a3));
      for (var l3 = 0; l3 < n3[a3].length; l3++) t5 = n3[a3][l3], 1 === r4 ? "<" === t5 ? (p3(), h3 = [h3], r4 = 3) : e3 += t5 : 4 === r4 ? "--" === e3 && ">" === t5 ? (r4 = 1, e3 = "") : e3 = t5 + e3[0] : u3 ? t5 === u3 ? u3 = "" : e3 += t5 : '"' === t5 || "'" === t5 ? u3 = t5 : ">" === t5 ? (p3(), r4 = 1) : r4 && ("=" === t5 ? (r4 = 5, s4 = e3, e3 = "") : "/" === t5 && (r4 < 5 || ">" === n3[a3][l3 + 1]) ? (p3(), 3 === r4 && (h3 = h3[0]), r4 = h3, (h3 = h3[0]).push(2, 0, r4), r4 = 0) : " " === t5 || "	" === t5 || "\n" === t5 || "\r" === t5 ? (p3(), r4 = 2) : e3 += t5), 3 === r4 && "!--" === e3 && (r4 = 4, h3 = h3[0]);
    }
    return p3(), h3;
  }(s3)), r3), arguments, [])).length > 1 ? r3 : r3[0];
}

// node_modules/preact/dist/preact.module.js
var n2, l, u, t2, i, r, o, e, f, c, a, s, h, p, v, y, d = {}, w = [], _ = /acit|ex(?:s|g|n|p|$)|rph|grid|ows|mnc|ntw|ine[ch]|zoo|^ord|itera/i, g = Array.isArray;
function m(n3, l3) {
  for (var u3 in l3) n3[u3] = l3[u3];
  return n3;
}
function b(n3) {
  n3 && n3.parentNode && n3.parentNode.removeChild(n3);
}
function k(l3, u3, t5) {
  var i3, r3, o3, e3 = {};
  for (o3 in u3) "key" == o3 ? i3 = u3[o3] : "ref" == o3 ? r3 = u3[o3] : e3[o3] = u3[o3];
  if (arguments.length > 2 && (e3.children = arguments.length > 3 ? n2.call(arguments, 2) : t5), "function" == typeof l3 && null != l3.defaultProps) for (o3 in l3.defaultProps) void 0 === e3[o3] && (e3[o3] = l3.defaultProps[o3]);
  return x(l3, e3, i3, r3, null);
}
function x(n3, t5, i3, r3, o3) {
  var e3 = { type: n3, props: t5, key: i3, ref: r3, __k: null, __: null, __b: 0, __e: null, __c: null, constructor: void 0, __v: null == o3 ? ++u : o3, __i: -1, __u: 0 };
  return null == o3 && null != l.vnode && l.vnode(e3), e3;
}
function M() {
  return { current: null };
}
function S(n3) {
  return n3.children;
}
function C(n3, l3) {
  this.props = n3, this.context = l3;
}
function $(n3, l3) {
  if (null == l3) return n3.__ ? $(n3.__, n3.__i + 1) : null;
  for (var u3; l3 < n3.__k.length; l3++) if (null != (u3 = n3.__k[l3]) && null != u3.__e) return u3.__e;
  return "function" == typeof n3.type ? $(n3) : null;
}
function I(n3) {
  if (n3.__P && n3.__d) {
    var u3 = n3.__v, t5 = u3.__e, i3 = [], r3 = [], o3 = m({}, u3);
    o3.__v = u3.__v + 1, l.vnode && l.vnode(o3), q(n3.__P, o3, u3, n3.__n, n3.__P.namespaceURI, 32 & u3.__u ? [t5] : null, i3, null == t5 ? $(u3) : t5, !!(32 & u3.__u), r3), o3.__v = u3.__v, o3.__.__k[o3.__i] = o3, D(i3, o3, r3), u3.__e = u3.__ = null, o3.__e != t5 && P(o3);
  }
}
function P(n3) {
  if (null != (n3 = n3.__) && null != n3.__c) return n3.__e = n3.__c.base = null, n3.__k.some(function(l3) {
    if (null != l3 && null != l3.__e) return n3.__e = n3.__c.base = l3.__e;
  }), P(n3);
}
function A(n3) {
  (!n3.__d && (n3.__d = true) && i.push(n3) && !H.__r++ || r != l.debounceRendering) && ((r = l.debounceRendering) || o)(H);
}
function H() {
  try {
    for (var n3, l3 = 1; i.length; ) i.length > l3 && i.sort(e), n3 = i.shift(), l3 = i.length, I(n3);
  } finally {
    i.length = H.__r = 0;
  }
}
function L(n3, l3, u3, t5, i3, r3, o3, e3, f3, c3, a3) {
  var s3, h3, p3, v3, y3, _3, g4, m3 = t5 && t5.__k || w, b3 = l3.length;
  for (f3 = T(u3, l3, m3, f3, b3), s3 = 0; s3 < b3; s3++) null != (p3 = u3.__k[s3]) && (h3 = -1 != p3.__i && m3[p3.__i] || d, p3.__i = s3, _3 = q(n3, p3, h3, i3, r3, o3, e3, f3, c3, a3), v3 = p3.__e, p3.ref && h3.ref != p3.ref && (h3.ref && J(h3.ref, null, p3), a3.push(p3.ref, p3.__c || v3, p3)), null == y3 && null != v3 && (y3 = v3), (g4 = !!(4 & p3.__u)) || h3.__k === p3.__k ? (f3 = j(p3, f3, n3, g4), g4 && h3.__e && (h3.__e = null)) : "function" == typeof p3.type && void 0 !== _3 ? f3 = _3 : v3 && (f3 = v3.nextSibling), p3.__u &= -7);
  return u3.__e = y3, f3;
}
function T(n3, l3, u3, t5, i3) {
  var r3, o3, e3, f3, c3, a3 = u3.length, s3 = a3, h3 = 0;
  for (n3.__k = new Array(i3), r3 = 0; r3 < i3; r3++) null != (o3 = l3[r3]) && "boolean" != typeof o3 && "function" != typeof o3 ? ("string" == typeof o3 || "number" == typeof o3 || "bigint" == typeof o3 || o3.constructor == String ? o3 = n3.__k[r3] = x(null, o3, null, null, null) : g(o3) ? o3 = n3.__k[r3] = x(S, { children: o3 }, null, null, null) : void 0 === o3.constructor && o3.__b > 0 ? o3 = n3.__k[r3] = x(o3.type, o3.props, o3.key, o3.ref ? o3.ref : null, o3.__v) : n3.__k[r3] = o3, f3 = r3 + h3, o3.__ = n3, o3.__b = n3.__b + 1, e3 = null, -1 != (c3 = o3.__i = O(o3, u3, f3, s3)) && (s3--, (e3 = u3[c3]) && (e3.__u |= 2)), null == e3 || null == e3.__v ? (-1 == c3 && (i3 > a3 ? h3-- : i3 < a3 && h3++), "function" != typeof o3.type && (o3.__u |= 4)) : c3 != f3 && (c3 == f3 - 1 ? h3-- : c3 == f3 + 1 ? h3++ : (c3 > f3 ? h3-- : h3++, o3.__u |= 4))) : n3.__k[r3] = null;
  if (s3) for (r3 = 0; r3 < a3; r3++) null != (e3 = u3[r3]) && 0 == (2 & e3.__u) && (e3.__e == t5 && (t5 = $(e3)), K(e3, e3));
  return t5;
}
function j(n3, l3, u3, t5) {
  var i3, r3;
  if ("function" == typeof n3.type) {
    for (i3 = n3.__k, r3 = 0; i3 && r3 < i3.length; r3++) i3[r3] && (i3[r3].__ = n3, l3 = j(i3[r3], l3, u3, t5));
    return l3;
  }
  n3.__e != l3 && (t5 && (l3 && n3.type && !l3.parentNode && (l3 = $(n3)), u3.insertBefore(n3.__e, l3 || null)), l3 = n3.__e);
  do {
    l3 = l3 && l3.nextSibling;
  } while (null != l3 && 8 == l3.nodeType);
  return l3;
}
function F(n3, l3) {
  return l3 = l3 || [], null == n3 || "boolean" == typeof n3 || (g(n3) ? n3.some(function(n4) {
    F(n4, l3);
  }) : l3.push(n3)), l3;
}
function O(n3, l3, u3, t5) {
  var i3, r3, o3, e3 = n3.key, f3 = n3.type, c3 = l3[u3], a3 = null != c3 && 0 == (2 & c3.__u);
  if (null === c3 && null == e3 || a3 && e3 == c3.key && f3 == c3.type) return u3;
  if (t5 > (a3 ? 1 : 0)) {
    for (i3 = u3 - 1, r3 = u3 + 1; i3 >= 0 || r3 < l3.length; ) if (null != (c3 = l3[o3 = i3 >= 0 ? i3-- : r3++]) && 0 == (2 & c3.__u) && e3 == c3.key && f3 == c3.type) return o3;
  }
  return -1;
}
function z(n3, l3, u3) {
  "-" == l3[0] ? n3.setProperty(l3, null == u3 ? "" : u3) : n3[l3] = null == u3 ? "" : "number" != typeof u3 || _.test(l3) ? u3 : u3 + "px";
}
function N(n3, l3, u3, t5, i3) {
  var r3, o3;
  n: if ("style" == l3) if ("string" == typeof u3) n3.style.cssText = u3;
  else {
    if ("string" == typeof t5 && (n3.style.cssText = t5 = ""), t5) for (l3 in t5) u3 && l3 in u3 || z(n3.style, l3, "");
    if (u3) for (l3 in u3) t5 && u3[l3] == t5[l3] || z(n3.style, l3, u3[l3]);
  }
  else if ("o" == l3[0] && "n" == l3[1]) r3 = l3 != (l3 = l3.replace(s, "$1")), o3 = l3.toLowerCase(), l3 = o3 in n3 || "onFocusOut" == l3 || "onFocusIn" == l3 ? o3.slice(2) : l3.slice(2), n3.l || (n3.l = {}), n3.l[l3 + r3] = u3, u3 ? t5 ? u3[a] = t5[a] : (u3[a] = h, n3.addEventListener(l3, r3 ? v : p, r3)) : n3.removeEventListener(l3, r3 ? v : p, r3);
  else {
    if ("http://www.w3.org/2000/svg" == i3) l3 = l3.replace(/xlink(H|:h)/, "h").replace(/sName$/, "s");
    else if ("width" != l3 && "height" != l3 && "href" != l3 && "list" != l3 && "form" != l3 && "tabIndex" != l3 && "download" != l3 && "rowSpan" != l3 && "colSpan" != l3 && "role" != l3 && "popover" != l3 && l3 in n3) try {
      n3[l3] = null == u3 ? "" : u3;
      break n;
    } catch (n4) {
    }
    "function" == typeof u3 || (null == u3 || false === u3 && "-" != l3[4] ? n3.removeAttribute(l3) : n3.setAttribute(l3, "popover" == l3 && 1 == u3 ? "" : u3));
  }
}
function V(n3) {
  return function(u3) {
    if (this.l) {
      var t5 = this.l[u3.type + n3];
      if (null == u3[c]) u3[c] = h++;
      else if (u3[c] < t5[a]) return;
      return t5(l.event ? l.event(u3) : u3);
    }
  };
}
function q(n3, u3, t5, i3, r3, o3, e3, f3, c3, a3) {
  var s3, h3, p3, v3, y3, d3, _3, k4, x4, M3, $3, I3, P4, A4, H3, T4 = u3.type;
  if (void 0 !== u3.constructor) return null;
  128 & t5.__u && (c3 = !!(32 & t5.__u), o3 = [f3 = u3.__e = t5.__e]), (s3 = l.__b) && s3(u3);
  n: if ("function" == typeof T4) try {
    if (k4 = u3.props, x4 = T4.prototype && T4.prototype.render, M3 = (s3 = T4.contextType) && i3[s3.__c], $3 = s3 ? M3 ? M3.props.value : s3.__ : i3, t5.__c ? _3 = (h3 = u3.__c = t5.__c).__ = h3.__E : (x4 ? u3.__c = h3 = new T4(k4, $3) : (u3.__c = h3 = new C(k4, $3), h3.constructor = T4, h3.render = Q), M3 && M3.sub(h3), h3.state || (h3.state = {}), h3.__n = i3, p3 = h3.__d = true, h3.__h = [], h3._sb = []), x4 && null == h3.__s && (h3.__s = h3.state), x4 && null != T4.getDerivedStateFromProps && (h3.__s == h3.state && (h3.__s = m({}, h3.__s)), m(h3.__s, T4.getDerivedStateFromProps(k4, h3.__s))), v3 = h3.props, y3 = h3.state, h3.__v = u3, p3) x4 && null == T4.getDerivedStateFromProps && null != h3.componentWillMount && h3.componentWillMount(), x4 && null != h3.componentDidMount && h3.__h.push(h3.componentDidMount);
    else {
      if (x4 && null == T4.getDerivedStateFromProps && k4 !== v3 && null != h3.componentWillReceiveProps && h3.componentWillReceiveProps(k4, $3), u3.__v == t5.__v || !h3.__e && null != h3.shouldComponentUpdate && false === h3.shouldComponentUpdate(k4, h3.__s, $3)) {
        u3.__v != t5.__v && (h3.props = k4, h3.state = h3.__s, h3.__d = false), u3.__e = t5.__e, u3.__k = t5.__k, u3.__k.some(function(n4) {
          n4 && (n4.__ = u3);
        }), w.push.apply(h3.__h, h3._sb), h3._sb = [], h3.__h.length && e3.push(h3);
        break n;
      }
      null != h3.componentWillUpdate && h3.componentWillUpdate(k4, h3.__s, $3), x4 && null != h3.componentDidUpdate && h3.__h.push(function() {
        h3.componentDidUpdate(v3, y3, d3);
      });
    }
    if (h3.context = $3, h3.props = k4, h3.__P = n3, h3.__e = false, I3 = l.__r, P4 = 0, x4) h3.state = h3.__s, h3.__d = false, I3 && I3(u3), s3 = h3.render(h3.props, h3.state, h3.context), w.push.apply(h3.__h, h3._sb), h3._sb = [];
    else do {
      h3.__d = false, I3 && I3(u3), s3 = h3.render(h3.props, h3.state, h3.context), h3.state = h3.__s;
    } while (h3.__d && ++P4 < 25);
    h3.state = h3.__s, null != h3.getChildContext && (i3 = m(m({}, i3), h3.getChildContext())), x4 && !p3 && null != h3.getSnapshotBeforeUpdate && (d3 = h3.getSnapshotBeforeUpdate(v3, y3)), A4 = null != s3 && s3.type === S && null == s3.key ? E(s3.props.children) : s3, f3 = L(n3, g(A4) ? A4 : [A4], u3, t5, i3, r3, o3, e3, f3, c3, a3), h3.base = u3.__e, u3.__u &= -161, h3.__h.length && e3.push(h3), _3 && (h3.__E = h3.__ = null);
  } catch (n4) {
    if (u3.__v = null, c3 || null != o3) if (n4.then) {
      for (u3.__u |= c3 ? 160 : 128; f3 && 8 == f3.nodeType && f3.nextSibling; ) f3 = f3.nextSibling;
      o3[o3.indexOf(f3)] = null, u3.__e = f3;
    } else {
      for (H3 = o3.length; H3--; ) b(o3[H3]);
      B(u3);
    }
    else u3.__e = t5.__e, u3.__k = t5.__k, n4.then || B(u3);
    l.__e(n4, u3, t5);
  }
  else null == o3 && u3.__v == t5.__v ? (u3.__k = t5.__k, u3.__e = t5.__e) : f3 = u3.__e = G(t5.__e, u3, t5, i3, r3, o3, e3, c3, a3);
  return (s3 = l.diffed) && s3(u3), 128 & u3.__u ? void 0 : f3;
}
function B(n3) {
  n3 && (n3.__c && (n3.__c.__e = true), n3.__k && n3.__k.some(B));
}
function D(n3, u3, t5) {
  for (var i3 = 0; i3 < t5.length; i3++) J(t5[i3], t5[++i3], t5[++i3]);
  l.__c && l.__c(u3, n3), n3.some(function(u4) {
    try {
      n3 = u4.__h, u4.__h = [], n3.some(function(n4) {
        n4.call(u4);
      });
    } catch (n4) {
      l.__e(n4, u4.__v);
    }
  });
}
function E(n3) {
  return "object" != typeof n3 || null == n3 || n3.__b > 0 ? n3 : g(n3) ? n3.map(E) : void 0 !== n3.constructor ? null : m({}, n3);
}
function G(u3, t5, i3, r3, o3, e3, f3, c3, a3) {
  var s3, h3, p3, v3, y3, w4, _3, m3 = i3.props || d, k4 = t5.props, x4 = t5.type;
  if ("svg" == x4 ? o3 = "http://www.w3.org/2000/svg" : "math" == x4 ? o3 = "http://www.w3.org/1998/Math/MathML" : o3 || (o3 = "http://www.w3.org/1999/xhtml"), null != e3) {
    for (s3 = 0; s3 < e3.length; s3++) if ((y3 = e3[s3]) && "setAttribute" in y3 == !!x4 && (x4 ? y3.localName == x4 : 3 == y3.nodeType)) {
      u3 = y3, e3[s3] = null;
      break;
    }
  }
  if (null == u3) {
    if (null == x4) return document.createTextNode(k4);
    u3 = document.createElementNS(o3, x4, k4.is && k4), c3 && (l.__m && l.__m(t5, e3), c3 = false), e3 = null;
  }
  if (null == x4) m3 === k4 || c3 && u3.data == k4 || (u3.data = k4);
  else {
    if (e3 = "textarea" == x4 && null != k4.defaultValue ? null : e3 && n2.call(u3.childNodes), !c3 && null != e3) for (m3 = {}, s3 = 0; s3 < u3.attributes.length; s3++) m3[(y3 = u3.attributes[s3]).name] = y3.value;
    for (s3 in m3) y3 = m3[s3], "dangerouslySetInnerHTML" == s3 ? p3 = y3 : "children" == s3 || s3 in k4 || "value" == s3 && "defaultValue" in k4 || "checked" == s3 && "defaultChecked" in k4 || N(u3, s3, null, y3, o3);
    for (s3 in k4) y3 = k4[s3], "children" == s3 ? v3 = y3 : "dangerouslySetInnerHTML" == s3 ? h3 = y3 : "value" == s3 ? w4 = y3 : "checked" == s3 ? _3 = y3 : c3 && "function" != typeof y3 || m3[s3] === y3 || N(u3, s3, y3, m3[s3], o3);
    if (h3) c3 || p3 && (h3.__html == p3.__html || h3.__html == u3.innerHTML) || (u3.innerHTML = h3.__html), t5.__k = [];
    else if (p3 && (u3.innerHTML = ""), L("template" == t5.type ? u3.content : u3, g(v3) ? v3 : [v3], t5, i3, r3, "foreignObject" == x4 ? "http://www.w3.org/1999/xhtml" : o3, e3, f3, e3 ? e3[0] : i3.__k && $(i3, 0), c3, a3), null != e3) for (s3 = e3.length; s3--; ) b(e3[s3]);
    c3 && "textarea" != x4 || (s3 = "value", "progress" == x4 && null == w4 ? u3.removeAttribute("value") : null != w4 && (w4 !== u3[s3] || "progress" == x4 && !w4 || "option" == x4 && w4 != m3[s3]) && N(u3, s3, w4, m3[s3], o3), s3 = "checked", null != _3 && _3 != u3[s3] && N(u3, s3, _3, m3[s3], o3));
  }
  return u3;
}
function J(n3, u3, t5) {
  try {
    if ("function" == typeof n3) {
      var i3 = "function" == typeof n3.__u;
      i3 && n3.__u(), i3 && null == u3 || (n3.__u = n3(u3));
    } else n3.current = u3;
  } catch (n4) {
    l.__e(n4, t5);
  }
}
function K(n3, u3, t5) {
  var i3, r3;
  if (l.unmount && l.unmount(n3), (i3 = n3.ref) && (i3.current && i3.current != n3.__e || J(i3, null, u3)), null != (i3 = n3.__c)) {
    if (i3.componentWillUnmount) try {
      i3.componentWillUnmount();
    } catch (n4) {
      l.__e(n4, u3);
    }
    i3.base = i3.__P = null;
  }
  if (i3 = n3.__k) for (r3 = 0; r3 < i3.length; r3++) i3[r3] && K(i3[r3], u3, t5 || "function" != typeof n3.type);
  t5 || b(n3.__e), n3.__c = n3.__ = n3.__e = void 0;
}
function Q(n3, l3, u3) {
  return this.constructor(n3, u3);
}
function R(u3, t5, i3) {
  var r3, o3, e3, f3;
  t5 == document && (t5 = document.documentElement), l.__ && l.__(u3, t5), o3 = (r3 = "function" == typeof i3) ? null : i3 && i3.__k || t5.__k, e3 = [], f3 = [], q(t5, u3 = (!r3 && i3 || t5).__k = k(S, null, [u3]), o3 || d, d, t5.namespaceURI, !r3 && i3 ? [i3] : o3 ? null : t5.firstChild ? n2.call(t5.childNodes) : null, e3, !r3 && i3 ? i3 : o3 ? o3.__e : t5.firstChild, r3, f3), D(e3, u3, f3);
}
function U(n3, l3) {
  R(n3, l3, U);
}
function W(l3, u3, t5) {
  var i3, r3, o3, e3, f3 = m({}, l3.props);
  for (o3 in l3.type && l3.type.defaultProps && (e3 = l3.type.defaultProps), u3) "key" == o3 ? i3 = u3[o3] : "ref" == o3 ? r3 = u3[o3] : f3[o3] = void 0 === u3[o3] && null != e3 ? e3[o3] : u3[o3];
  return arguments.length > 2 && (f3.children = arguments.length > 3 ? n2.call(arguments, 2) : t5), x(l3.type, f3, i3 || l3.key, r3 || l3.ref, null);
}
function X(n3) {
  function l3(n4) {
    var u3, t5;
    return this.getChildContext || (u3 = /* @__PURE__ */ new Set(), (t5 = {})[l3.__c] = this, this.getChildContext = function() {
      return t5;
    }, this.componentWillUnmount = function() {
      u3 = null;
    }, this.shouldComponentUpdate = function(n5) {
      this.props.value != n5.value && u3.forEach(function(n6) {
        n6.__e = true, A(n6);
      });
    }, this.sub = function(n5) {
      u3.add(n5);
      var l4 = n5.componentWillUnmount;
      n5.componentWillUnmount = function() {
        u3 && u3.delete(n5), l4 && l4.call(n5);
      };
    }), n4.children;
  }
  return l3.__c = "__cC" + y++, l3.__ = n3, l3.Provider = l3.__l = (l3.Consumer = function(n4, l4) {
    return n4.children(l4);
  }).contextType = l3, l3;
}
n2 = w.slice, l = { __e: function(n3, l3, u3, t5) {
  for (var i3, r3, o3; l3 = l3.__; ) if ((i3 = l3.__c) && !i3.__) try {
    if ((r3 = i3.constructor) && null != r3.getDerivedStateFromError && (i3.setState(r3.getDerivedStateFromError(n3)), o3 = i3.__d), null != i3.componentDidCatch && (i3.componentDidCatch(n3, t5 || {}), o3 = i3.__d), o3) return i3.__E = i3;
  } catch (l4) {
    n3 = l4;
  }
  throw n3;
} }, u = 0, t2 = function(n3) {
  return null != n3 && void 0 === n3.constructor;
}, C.prototype.setState = function(n3, l3) {
  var u3;
  u3 = null != this.__s && this.__s != this.state ? this.__s : this.__s = m({}, this.state), "function" == typeof n3 && (n3 = n3(m({}, u3), this.props)), n3 && m(u3, n3), null != n3 && this.__v && (l3 && this._sb.push(l3), A(this));
}, C.prototype.forceUpdate = function(n3) {
  this.__v && (this.__e = true, n3 && this.__h.push(n3), A(this));
}, C.prototype.render = S, i = [], o = "function" == typeof Promise ? Promise.prototype.then.bind(Promise.resolve()) : setTimeout, e = function(n3, l3) {
  return n3.__v.__b - l3.__v.__b;
}, H.__r = 0, f = Math.random().toString(8), c = "__d" + f, a = "__a" + f, s = /(PointerCapture)$|Capture$/i, h = 0, p = V(false), v = V(true), y = 0;

// node_modules/preact/hooks/dist/hooks.module.js
var t3, r2, u2, i2, o2 = 0, f2 = [], c2 = l, e2 = c2.__b, a2 = c2.__r, v2 = c2.diffed, l2 = c2.__c, m2 = c2.unmount, s2 = c2.__;
function p2(n3, t5) {
  c2.__h && c2.__h(r2, n3, o2 || t5), o2 = 0;
  var u3 = r2.__H || (r2.__H = { __: [], __h: [] });
  return n3 >= u3.__.length && u3.__.push({}), u3.__[n3];
}
function d2(n3) {
  return o2 = 1, h2(D2, n3);
}
function h2(n3, u3, i3) {
  var o3 = p2(t3++, 2);
  if (o3.t = n3, !o3.__c && (o3.__ = [i3 ? i3(u3) : D2(void 0, u3), function(n4) {
    var t5 = o3.__N ? o3.__N[0] : o3.__[0], r3 = o3.t(t5, n4);
    t5 !== r3 && (o3.__N = [r3, o3.__[1]], o3.__c.setState({}));
  }], o3.__c = r2, !r2.__f)) {
    var f3 = function(n4, t5, r3) {
      if (!o3.__c.__H) return true;
      var u4 = o3.__c.__H.__.filter(function(n5) {
        return n5.__c;
      });
      if (u4.every(function(n5) {
        return !n5.__N;
      })) return !c3 || c3.call(this, n4, t5, r3);
      var i4 = o3.__c.props !== n4;
      return u4.some(function(n5) {
        if (n5.__N) {
          var t6 = n5.__[0];
          n5.__ = n5.__N, n5.__N = void 0, t6 !== n5.__[0] && (i4 = true);
        }
      }), c3 && c3.call(this, n4, t5, r3) || i4;
    };
    r2.__f = true;
    var c3 = r2.shouldComponentUpdate, e3 = r2.componentWillUpdate;
    r2.componentWillUpdate = function(n4, t5, r3) {
      if (this.__e) {
        var u4 = c3;
        c3 = void 0, f3(n4, t5, r3), c3 = u4;
      }
      e3 && e3.call(this, n4, t5, r3);
    }, r2.shouldComponentUpdate = f3;
  }
  return o3.__N || o3.__;
}
function y2(n3, u3) {
  var i3 = p2(t3++, 3);
  !c2.__s && C2(i3.__H, u3) && (i3.__ = n3, i3.u = u3, r2.__H.__h.push(i3));
}
function _2(n3, u3) {
  var i3 = p2(t3++, 4);
  !c2.__s && C2(i3.__H, u3) && (i3.__ = n3, i3.u = u3, r2.__h.push(i3));
}
function A2(n3) {
  return o2 = 5, T2(function() {
    return { current: n3 };
  }, []);
}
function F2(n3, t5, r3) {
  o2 = 6, _2(function() {
    if ("function" == typeof n3) {
      var r4 = n3(t5());
      return function() {
        n3(null), r4 && "function" == typeof r4 && r4();
      };
    }
    if (n3) return n3.current = t5(), function() {
      return n3.current = null;
    };
  }, null == r3 ? r3 : r3.concat(n3));
}
function T2(n3, r3) {
  var u3 = p2(t3++, 7);
  return C2(u3.__H, r3) && (u3.__ = n3(), u3.__H = r3, u3.__h = n3), u3.__;
}
function q2(n3, t5) {
  return o2 = 8, T2(function() {
    return n3;
  }, t5);
}
function x2(n3) {
  var u3 = r2.context[n3.__c], i3 = p2(t3++, 9);
  return i3.c = n3, u3 ? (null == i3.__ && (i3.__ = true, u3.sub(r2)), u3.props.value) : n3.__;
}
function P2(n3, t5) {
  c2.useDebugValue && c2.useDebugValue(t5 ? t5(n3) : n3);
}
function b2(n3) {
  var u3 = p2(t3++, 10), i3 = d2();
  return u3.__ = n3, r2.componentDidCatch || (r2.componentDidCatch = function(n4, t5) {
    u3.__ && u3.__(n4, t5), i3[1](n4);
  }), [i3[0], function() {
    i3[1](void 0);
  }];
}
function g2() {
  var n3 = p2(t3++, 11);
  if (!n3.__) {
    for (var u3 = r2.__v; null !== u3 && !u3.__m && null !== u3.__; ) u3 = u3.__;
    var i3 = u3.__m || (u3.__m = [0, 0]);
    n3.__ = "P" + i3[0] + "-" + i3[1]++;
  }
  return n3.__;
}
function j2() {
  for (var n3; n3 = f2.shift(); ) {
    var t5 = n3.__H;
    if (n3.__P && t5) try {
      t5.__h.some(z2), t5.__h.some(B2), t5.__h = [];
    } catch (r3) {
      t5.__h = [], c2.__e(r3, n3.__v);
    }
  }
}
c2.__b = function(n3) {
  r2 = null, e2 && e2(n3);
}, c2.__ = function(n3, t5) {
  n3 && t5.__k && t5.__k.__m && (n3.__m = t5.__k.__m), s2 && s2(n3, t5);
}, c2.__r = function(n3) {
  a2 && a2(n3), t3 = 0;
  var i3 = (r2 = n3.__c).__H;
  i3 && (u2 === r2 ? (i3.__h = [], r2.__h = [], i3.__.some(function(n4) {
    n4.__N && (n4.__ = n4.__N), n4.u = n4.__N = void 0;
  })) : (i3.__h.some(z2), i3.__h.some(B2), i3.__h = [], t3 = 0)), u2 = r2;
}, c2.diffed = function(n3) {
  v2 && v2(n3);
  var t5 = n3.__c;
  t5 && t5.__H && (t5.__H.__h.length && (1 !== f2.push(t5) && i2 === c2.requestAnimationFrame || ((i2 = c2.requestAnimationFrame) || w2)(j2)), t5.__H.__.some(function(n4) {
    n4.u && (n4.__H = n4.u), n4.u = void 0;
  })), u2 = r2 = null;
}, c2.__c = function(n3, t5) {
  t5.some(function(n4) {
    try {
      n4.__h.some(z2), n4.__h = n4.__h.filter(function(n5) {
        return !n5.__ || B2(n5);
      });
    } catch (r3) {
      t5.some(function(n5) {
        n5.__h && (n5.__h = []);
      }), t5 = [], c2.__e(r3, n4.__v);
    }
  }), l2 && l2(n3, t5);
}, c2.unmount = function(n3) {
  m2 && m2(n3);
  var t5, r3 = n3.__c;
  r3 && r3.__H && (r3.__H.__.some(function(n4) {
    try {
      z2(n4);
    } catch (n5) {
      t5 = n5;
    }
  }), r3.__H = void 0, t5 && c2.__e(t5, r3.__v));
};
var k2 = "function" == typeof requestAnimationFrame;
function w2(n3) {
  var t5, r3 = function() {
    clearTimeout(u3), k2 && cancelAnimationFrame(t5), setTimeout(n3);
  }, u3 = setTimeout(r3, 35);
  k2 && (t5 = requestAnimationFrame(r3));
}
function z2(n3) {
  var t5 = r2, u3 = n3.__c;
  "function" == typeof u3 && (n3.__c = void 0, u3()), r2 = t5;
}
function B2(n3) {
  var t5 = r2;
  n3.__c = n3.__(), r2 = t5;
}
function C2(n3, t5) {
  return !n3 || n3.length !== t5.length || t5.some(function(t6, r3) {
    return t6 !== n3[r3];
  });
}
function D2(n3, t5) {
  return "function" == typeof t5 ? t5(n3) : t5;
}

// dashboard/src/lib/api.ts
var TOKEN = document.querySelector('meta[name="reasonix-token"]')?.getAttribute("content") ?? "";
var MODE = document.querySelector('meta[name="reasonix-mode"]')?.getAttribute("content") ?? "standalone";
async function api(path, opts = {}) {
  const method = opts.method ?? "GET";
  const url = `/api${path}${path.includes("?") ? "&" : "?"}token=${TOKEN}`;
  const headers = { ...opts.headers ?? {} };
  headers["X-Reasonix-Token"] = TOKEN;
  if (opts.body !== void 0) headers["Content-Type"] = "application/json";
  const timeoutMs = opts.timeoutMs === 0 ? 0 : Math.max(1e3, Number(opts.timeoutMs ?? (method === "GET" ? 15e3 : 12e4)));
  const controller = new AbortController();
  let timedOut = false;
  const abortFromCaller = () => controller.abort();
  opts.signal?.addEventListener?.("abort", abortFromCaller, { once: true });
  const timeout = timeoutMs > 0 ? setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs) : null;
  let res;
  let text;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: opts.body !== void 0 ? JSON.stringify(opts.body) : void 0,
      signal: controller.signal
    });
    text = await res.text();
  } catch (error) {
    if (timedOut) throw new Error(`请求超时（${Math.round(timeoutMs / 1e3)} 秒）：${path}`);
    throw error;
  } finally {
    if (timeout) clearTimeout(timeout);
    opts.signal?.removeEventListener?.("abort", abortFromCaller);
  }
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { error: text };
  }
  if (!res.ok) {
    const errorBody = parsed;
    const errMsg = errorBody?.message ?? errorBody?.error ?? `${res.status} ${res.statusText}`;
    const err = new Error(errMsg);
    err.status = res.status;
    err.body = parsed;
    err.code = errorBody?.code;
    err.title = errorBody?.title;
    err.retryable = errorBody?.retryable;
    err.action = errorBody?.action;
    err.details = errorBody?.details;
    throw err;
  }
  return parsed;
}
async function writeClipboardText(text) {
  const value = String(text ?? "");
  let primaryError = null;
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch (error) {
      primaryError = error;
    }
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  Object.assign(textarea.style, {
    position: "fixed",
    left: "-9999px",
    top: "0",
    width: "1px",
    height: "1px",
    opacity: "0"
  });
  document.body.appendChild(textarea);
  try {
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, value.length);
    if (document.execCommand("copy")) return;
    throw primaryError || new Error("copy command failed");
  } finally {
    textarea.remove();
  }
}

// dashboard/src/lib/bus-filter.ts
var THIRD_PARTY_ORIGIN_PREFIXES = [
  "chrome-extension://",
  "moz-extension://",
  "safari-web-extension://",
  "safari-extension://",
  "ms-browser-extension://"
];
function isThirdPartyError(error, filename) {
  const stack = error && typeof error === "object" && "stack" in error ? String(error.stack ?? "") : "";
  const haystack = `${filename ?? ""}
${stack}`;
  return THIRD_PARTY_ORIGIN_PREFIXES.some((prefix) => haystack.includes(prefix));
}

// dashboard/src/lib/bus.ts
var html = htm_module_default.bind(k);
var appBus = new EventTarget();
var toastBus = new EventTarget();
function showToast(text, kind = "info", ttl = 3e3) {
  toastBus.dispatchEvent(new CustomEvent("toast", { detail: { text, kind, ttl } }));
}
function requestChatMessageJump(messageId) {
  if (!messageId) return;
  try {
    window.__visionoxPendingChatJump = { messageId, ts: Date.now() };
  } catch {
  }
  appBus.dispatchEvent(new CustomEvent("navigate-tab", { detail: { tabId: "chat", messageId } }));
  setTimeout(() => {
    appBus.dispatchEvent(new CustomEvent("chat-jump-message", { detail: { messageId } }));
  }, 80);
}
function reportAppError(error, source, info) {
  console.error(`[visionox dashboard] ${source}:`, error, info);
  try {
    const value = error;
    const message = `${source}: ${value?.message ?? String(error)}
${value?.stack ?? ""}
${info ?? ""}`.slice(0, 12e3);
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: "vis_client_log", message }, "*");
    }
  } catch {
  }
  appBus.dispatchEvent(
    new CustomEvent("error", { detail: { error, source, info, ts: Date.now() } })
  );
}
window.addEventListener("error", (ev) => {
  if (!ev.error) return;
  if (isThirdPartyError(ev.error, ev.filename)) return;
  reportAppError(ev.error, "window", ev.message);
});
window.addEventListener("unhandledrejection", (ev) => {
  if (isThirdPartyError(ev.reason)) return;
  reportAppError(ev.reason, "promise");
});
function ToastStack() {
  const [toasts, setToasts] = d2([]);
  y2(() => {
    const onToast = (ev) => {
      const detail = ev.detail;
      const id = `${Date.now()}-${Math.random()}`;
      const t5 = { id, ...detail };
      setToasts((prev) => [...prev, t5]);
      setTimeout(() => setToasts((prev) => prev.filter((x4) => x4.id !== id)), t5.ttl);
    };
    toastBus.addEventListener("toast", onToast);
    return () => toastBus.removeEventListener("toast", onToast);
  }, []);
  if (toasts.length === 0) return null;
  return html`
    <div class="toast-stack">
      ${toasts.map((t5) => html`<div key=${t5.id} class="toast ${t5.kind}">${t5.text}</div>`)}
    </div>
  `;
}

// dashboard/src/lib/error-boundary.ts
var html2 = htm_module_default.bind(k);
function buildIssueBody({ error, source, info }) {
  const ua = typeof navigator === "object" ? navigator.userAgent : "(unknown)";
  const errMsg = error?.message ?? String(error);
  const stack = error?.stack ?? "(no stack)";
  return [
    "**What happened**",
    "(describe what you were doing — typing, switching tabs, clicking a tool path, etc.)",
    "",
    "**Error**",
    "```",
    `${source}: ${errMsg}`,
    info ? `info: ${info}` : null,
    "",
    stack,
    "```",
    "",
    "**Environment**",
    `- Visionox-Whale: ${MODE}`,
    `- Browser: ${ua}`,
    `- URL: ${location.pathname} (token redacted)`,
    "",
    "_Reported from the local dashboard's error overlay._"
  ].filter((l3) => l3 !== null).join("\n");
}
function ErrorOverlay() {
  const [err, setErr] = d2(null);
  const [copied, setCopied] = d2(false);
  y2(() => {
    const onError = (ev) => {
      setErr(ev.detail);
      setCopied(false);
    };
    appBus.addEventListener("error", onError);
    return () => appBus.removeEventListener("error", onError);
  }, []);
  y2(() => {
    if (!err) return;
    const onKey = (e3) => {
      if (e3.key === "Escape") setErr(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [err]);
  if (!err) return null;
  const error = err.error;
  const errMsg = error?.message ?? String(error);
  const stack = error?.stack ?? "(no stack)";
  const copyDetails = async () => {
    try {
      await writeClipboardText(buildIssueBody(err));
      setCopied(true);
      setTimeout(() => setCopied(false), 2e3);
    } catch {
    }
  };
  const openLogs = () => {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: "vis_open_log_dir" }, "*");
      }
    } catch {
    }
  };
  return html2`
    <div class="error-overlay">
      <div class="error-overlay-card">
        <div class="error-overlay-head">
          <span class="error-overlay-icon">✦</span>
          <div>
            <div class="error-overlay-title">当前页面遇到错误</div>
            <div class="error-overlay-subtitle">${err.source} · ${errMsg}</div>
          </div>
        </div>

        <pre class="error-overlay-trace">${stack}</pre>

        ${err.info ? html2`<div class="error-overlay-info"><strong>info:</strong> ${err.info}</div>` : null}

        <div class="error-overlay-help">
          错误详情已写入本地运行日志。你可以关闭提示后继续操作；如果页面无法恢复，请打开日志目录并重新启动应用。
        </div>

        <div class="error-overlay-actions">
          <button class="primary" onClick=${copyDetails}>
            ${copied ? "已复制" : "复制详情"}
          </button>
          <button onClick=${openLogs}>打开日志目录</button>
          <button onClick=${() => setErr(null)} style="margin-left: auto;">关闭 (Esc)</button>
        </div>
      </div>
    </div>
  `;
}
var ErrorBoundary = class extends C {
  constructor(props) {
    super(props);
    this.state = { caught: false, lastErr: null, attempts: 0 };
  }
  static getDerivedStateFromError(error) {
    return { caught: true, lastErr: error };
  }
  componentDidCatch(error, info) {
    reportAppError(error, "render", info?.componentStack ?? "");
    const attempts = (this.state.attempts ?? 0) + 1;
    if (attempts >= 3) {
      this.setState({ attempts });
      return;
    }
    setTimeout(() => this.setState({ caught: false, attempts }), 100);
  }
  render() {
    if (this.state.caught) {
      if ((this.state.attempts ?? 0) >= 3) {
        return html2`
          <div class="boot" style="flex-direction: column; gap: 12px;">
            <div>当前页面连续恢复失败，请查看运行日志。</div>
            <button onClick=${() => this.setState({ caught: false, attempts: 0 })}>
              重新尝试
            </button>
          </div>
        `;
      }
      return html2`<div class="boot">正在恢复...</div>`;
    }
    return this.props.children;
  }
};

// dashboard/src/lib/i18n.ts
var LANG_REGISTRY = [
  ["en", "EN"],
  ["zh-CN", "zh-CN"]
];
var SUPPORTED = new Set(LANG_REGISTRY.map(([d3]) => d3));
var TO_BACKEND = new Map(LANG_REGISTRY);
var FROM_BACKEND = new Map(LANG_REGISTRY.map(([d3, b3]) => [b3, d3]));
var STORAGE_KEY = "rx.lang";
var listeners = [];
var currentLang = loadFromStorage() ?? "en";
function loadFromStorage() {
  try {
    const v3 = localStorage.getItem(STORAGE_KEY);
    if (v3 !== null && SUPPORTED.has(v3)) return v3;
  } catch {
  }
  return null;
}
function toBackendLang(lang) {
  return TO_BACKEND.get(lang) ?? lang;
}
function fromBackendLang(raw) {
  return FROM_BACKEND.get(raw) ?? "en";
}
async function initLangFromServer() {
  try {
    const res = await api("/settings");
    const serverLang = res.lang ? fromBackendLang(res.lang) : null;
    if (!serverLang || serverLang === currentLang) return;
    currentLang = serverLang;
    try {
      localStorage.setItem(STORAGE_KEY, serverLang);
    } catch {
    }
    for (const cb of listeners) cb();
  } catch {
  }
}
function getLang() {
  return currentLang;
}
function setLang(lang) {
  if (!SUPPORTED.has(lang)) return;
  currentLang = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
  }
  for (const cb of listeners) cb();
  fetch(`/api/settings?token=${TOKEN}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Reasonix-Token": TOKEN },
    body: JSON.stringify({ lang: toBackendLang(lang) }),
    keepalive: true
  }).catch((err) => console.error("[reasonix dashboard] lang persist:", err));
}
function onLangChange(cb) {
  listeners.push(cb);
  return () => {
    const i3 = listeners.indexOf(cb);
    if (i3 >= 0) listeners.splice(i3, 1);
  };
}
function useLang() {
  const [lang, setLangState] = d2(currentLang);
  y2(() => onLangChange(() => setLangState(currentLang)), []);
  return lang;
}
function get(translations, path) {
  let val = translations;
  for (const part of path.split(".")) {
    if (val === void 0 || typeof val === "string" || Array.isArray(val)) return void 0;
    val = val[part];
  }
  return typeof val === "string" ? val : void 0;
}
function createT(translations) {
  return function t5(path, params) {
    let val = get(translations[currentLang] ?? translations.en, path);
    if (val === void 0) val = get(translations.en, path);
    if (val === void 0) return path;
    if (!params) return val;
    let result = val;
    for (const [k4, v3] of Object.entries(params)) {
      result = result.replaceAll(`{${k4}}`, String(v3));
    }
    return result;
  };
}

// dashboard/src/i18n/en.ts
var en = {
  app: {
    sectionWorkspace: "workspace",
    sectionObserve: "observe & changes",
    sectionConfigure: "advanced",
    tabChat: "Chat",
    tabPlans: "Plans",
    tabTasks: "Tasks",
    tabSessions: "Sessions",
    tabFiles: "Files",
    tabOverview: "Overview",
    tabUsage: "Usage",
    tabSystem: "System",
    tabSemantic: "Semantic",
    tabTools: "Tools",
    tabPermissions: "Permissions",
    tabMcp: "MCP",
    tabSkills: "Skills",
    tabMemory: "Memory",
    tabHooks: "Hooks",
    tabReports: "Reports",
    tabSettings: "Settings",
    sectionChanges: "Changes",
    tabChanges: "Changes",
    footer: "127.0.0.1 only · token-gated"
  },
  changes: {
    chatPlaceholder: "Ask about your code...",
    chatWelcome: "Changes — ask questions about your project files.",
    chatSend: "Send",
    viewerPlaceholder: "Select a file to view",
    treeEmpty: "(empty)",
    tabClose: "Close tab",
    newConversation: "New",
    clearConversation: "Clear",
    newTitle: "/new — wipe conversation context",
    clearTitle: "/clear — wipe visible scrollback",
    newConfirmBusy: "A turn is in flight. Abort and start a new conversation?",
    newConfirm: "Clear current conversation and start fresh?",
    newToast: "new conversation",
    clearToast: "scrollback cleared",
    newFailed: "/new failed: {error}",
    clearFailed: "/clear failed: {error}",
    chatSendBtn: "Send",
    fileTreeTitle: "Files",
    codeViewerTitle: "Code Viewer",
    chatPanelTitle: "Chat",
    loadingFiles: "Loading project files…",
    review: "Review",
    allFiles: "All Files",
    changes: "changes",
    commentLabel: "Commenting on line",
    commentPlaceholder: "Add a comment…",
    commentCancel: "Cancel",
    commentSubmit: "Comment",
    commentLine: "Line",
    commentEdit: "Edit",
    commentDelete: "Delete",
    diffSourceGit: "Git changes",
    diffSourceSession: "Previous session",
    diffSourceCheckpoint: "Checkpoint",
    checkpointEmpty: "No checkpoints in this workspace yet.",
    restoreBtn: "Restore",
    restoreConfirm: 'Restore "{name}"? This will overwrite current files.',
    deleteBtn: "Delete",
    deleteConfirm: 'Delete checkpoint "{name}"? Snapshot will be removed, files stay unchanged.',
    createBtn: "Snapshot",
    createPlaceholder: "name for snapshot…",
    backToList: "back to list",
    diffStyleUnified: "Unified",
    diffStyleSplit: "Split",
    expandAll: "Expand all",
    collapseAll: "Collapse all"
  },
  common: {
    loading: "loading…",
    loadingFailed: "{name} failed: {error}",
    back: "← back",
    save: "Save",
    remove: "remove",
    cancel: "Cancel",
    delete: "Delete",
    add: "Add",
    confirm: "Confirm",
    noData: "No {name} yet.",
    all: "all",
    yes: "yes",
    no: "no",
    on: "ON",
    off: "off",
    enabled: "enabled",
    disabled: "disabled"
  },
  reports: {
    title: "Conversation Report",
    period: "Period",
    daily: "Daily",
    weekly: "Weekly",
    yearly: "Yearly",
    custom: "Custom",
    startDate: "Start",
    endDate: "End",
    date: "Date",
    generate: "Generate Report",
    generating: "Generating report…",
    generatingPreview: "Generating report from {sessions} sessions / {messages} messages…",
    empty: "No report generated yet.",
    stats: "Sessions: {sessions} · Messages: {messages}",
    sendToChat: "Send to chat",
    export: "Export Markdown",
    prompt: "Report prompt",
    savePrompt: "Save",
    resetPrompt: "Reset default",
    cancelPrompt: "Cancel",
    promptSaved: "Prompt template saved",
    error: "Failed to generate report: {error}"
  },
  settings: {
    title: "Settings",
    loading: "loading settings…",
    saved: "saved: {fields}",
    sectionApi: "Current model service credentials",
    credentialCurrent: "Current provider: {name}",
    credentialsScope: "Maintains credentials for the selected provider. Import and full model verification are available in Model Management below.",
    credentialsRetest: "Credentials updated. Re-run all model checks from Model Management below.",
    credentialProvider: "Provider",
    detectApi: "Test API",
    detectingApi: "Testing...",
    detectionRequired: "Test the API before saving",
    detectionPassed: "API test passed with {model}",
    saveCredentials: "Save credentials",
    apiKey: "API key",
    notSet: "(not set)",
    replace: "replace",
    pasteKey: "paste a fresh sk-… token",
    saveKey: "Save key",
    baseUrl: "base url",
    baseUrlPlaceholder: "https://api.deepseek.com (default)",
    sectionDefaults: "Defaults",
    preset: "preset",
    presetAuto: "auto — flash → pro on hard turns",
    presetFlash: "flash — always flash, no auto-escalate",
    presetPro: "pro — always pro",
    appliesNextTurn: "applies next turn",
    effort: "effort",
    effortMax: "max (default — best)",
    effortHigh: "high (cheaper / faster)",
    webSearch: "web search",
    webSearchNote: "web_fetch + web_search tools",
    sectionCompute: "Compute",
    proNext: "/pro one-shot",
    proArm: "Arm for next turn",
    proArmed: "Armed — disarms after next turn",
    proNextNote: "next turn runs on deepseek-v4-pro, then auto-disarms",
    sectionBudget: "Budget",
    budgetOf: "of",
    budgetSetCap: "set a cap",
    budgetCustom: "custom",
    budgetBumpHint: "bump the cap to keep going",
    budgetClear: "Clear cap",
    budgetIdleLine: "warns at 80% · refuses past 100%",
    budgetWarnLine: "approaching cap — loop will refuse past 100%",
    budgetRefusing: "cap exhausted — next turn refused until bumped or cleared",
    sectionLoop: "Loop",
    loopIdleHint: "Auto-resubmit a prompt on a fixed interval.",
    loopCostHint: "Each iteration costs ~{cost} (last turn).",
    loopInterval: "interval",
    loopCustom: "custom",
    loopRangeError: "interval must fall in 5s..6h",
    loopPrompt: "prompt",
    loopPromptPlaceholder: "e.g. check the deploy status and report any errors",
    loopStart: "Start loop",
    loopStop: "Stop",
    loopRunning: "running",
    loopIter: "iter {iter}",
    loopFiresIn: "fires in {remaining}",
    sectionRuntime: "Runtime",
    activeModel: "active model",
    modelPricingLine: "${hit} hit · ${miss} miss · ${out} out  per 1M tok",
    editMode: "edit mode",
    editModeNote: "switch from the Chat tab header",
    sectionLanguage: "Language",
    language: "language",
    langEn: "English",
    langZhCn: "简体中文",
    sectionDev: "Developer",
    devMode: "Developer Mode",
    devModeNote: "Show background server startup and runtime logs",
    devFollowing: "Following latest logs",
    devNewLogs: "{count} new logs",
    devBackToBottom: "Back to bottom"
  },
  chat: {
    modeMirror: "mirror",
    modeView: "chat",
    placeholder: "Type a prompt — Enter sends, Shift+Enter for a newline · / @ for pickers",
    placeholderBusy: "Keep typing; sending will queue the next prompt",
    send: "Send",
    queueSend: "Queue",
    queueTitle: "Queued {count}/{max}",
    queueImageMeta: "{count} image(s)",
    queueImagesOnly: "{count} image(s)",
    queueSending: "sending next...",
    queueFailedStatus: "failed",
    queueRetry: "Retry",
    queueCancel: "Cancel",
    queueClear: "Clear queue",
    queuePaused: "Queue paused after stopping the previous answer",
    queueResume: "Resume queue",
    queueClearConfirm: "Clear {count} queued prompt(s)?",
    queueResetConfirm: "There are {count} queued prompt(s). Clear them and continue?",
    queueAdded: "queued ({count})",
    queueLimit: "Up to {count} prompts can be queued. Please wait for one to send.",
    queueFailed: "Queued prompt failed: {error}",
    queueCommandBlocked: "This command changes the conversation. Please run it after the current turn finishes.",
    loadEarlierMessages: "Load {count} earlier messages",
    reconnecting: "Reconnecting to the local service. Queued prompts are preserved.",
    new: "New",
    clear: "Clear",
    newTitle: "/new — wipe conversation context (loop log + scrollback)",
    clearTitle: "/clear — wipe just visible scrollback (context kept)",
    noConversation: "No conversation yet. Send a prompt below to begin.",
    newConfirmBusy: "A turn is in flight. Abort and start a new conversation?",
    newConfirm: "Clear current conversation and start fresh?",
    newToast: "new conversation",
    clearToast: "scrollback cleared",
    newFailed: "/new failed: {error}",
    clearFailed: "/clear failed: {error}",
    searchPlaceholder: "Search current conversation",
    searchIdle: "current conversation",
    searchCount: "{current} / {total}",
    searchPrev: "Previous match",
    searchNext: "Next match",
    searchClear: "Clear search",
    copyMessage: "Copy",
    copiedMessage: "copied",
    copyFailed: "copy failed: {error}",
    fillInput: "Fill input",
    filledInput: "filled into input",
    toolOutputCollapsed: "Long output collapsed · {lines} lines · {chars} chars",
    eventStreamError: "event stream interrupted — reconnecting…",
    semanticBanner: "Semantic search isn't enabled for this project.",
    semanticBannerDesc: 'Build the index once and the model can find code by meaning ("where do we handle auth failures?") instead of grep on exact strings.',
    semanticBannerBtn: "Build it →",
    semanticBannerDismiss: "dismiss (don't show again)",
    slashCommands: "slash commands",
    slashHints: {
      help: "show available slash commands"
    },
    projectFiles: "project files",
    mentionTargets: "skills / project files",
    skillMentionMeta: "skill",
    skillInvokeTaskFallback: "Follow this skill's workflow for the user's request.",
    skillCredentialTitle: "Set up {label}",
    skillCredentialHint: "Required only for {skill}. The key is saved locally and is never added to the conversation or sent to the model.",
    skillCredentialPlaceholder: "Paste API key",
    skillCredentialSave: "Save and continue",
    skillCredentialSaving: "Saving...",
    skillCredentialHelp: "Get an API key",
    skillCredentialCheckFailed: "Could not check skill credentials: {error}",
    workspacePicker: "Workspaces",
    workspaceCurrent: "Current workspace",
    workspacePending: "Selected · applies to the next new conversation",
    workspaceDefault: "Default workspace",
    workspaceBrowse: "Browse folders...",
    workspaceManual: "Enter workspace path",
    workspaceRemove: "Remove from recent workspaces",
    workspaceChanged: "Workspace selected: {path}. It will apply to the next new conversation.",
    effortTitle: "reasoning_effort — applies next turn",
    effortMaxTitle: "max (default — best quality)",
    effortHighTitle: "high (cheaper / faster)",
    presetTitle: "preset — model commitment",
    presetAutoTitle: "auto — flash baseline; auto-escalates to pro on hard turns (NEEDS_PRO / failure threshold)",
    presetFlashTitle: "flash — always flash; no auto-escalate. /pro still works for one-shot manual",
    presetProTitle: "pro — always pro; ~3× flash cost (5/31 discount). Locks in on hard architecture work.",
    editGateTitle: "edit gate — Shift+Tab cycles in TUI",
    editAutoTitle: "auto — edits auto-apply; shell limited to allowlist, filesystem sandboxed",
    editYoloTitle: "yolo — edits and shell auto-run; filesystem stays sandboxed to project dir",
    editAdminTitle: "admin — all restrictions removed: unrestricted shell and filesystem",
    railSession: "Session",
    railTurns: "turns",
    railPromptTok: "prompt tok",
    railCost: "cost",
    railCacheHit: "cache hit",
    railToolBudget: "Tool budget",
    railSpend: "spend",
    railActivePlan: "Active plan",
    railProgress: "progress",
    statusModel: "model",
    statusCtx: "ctx",
    statusCache: "cache",
    statusTurn: "turn",
    statusSession: "session",
    statusBalance: "balance",
    statusTurns: "{count} turn{s}",
    waitingStats: "· · ·  waiting for live stats",
    inflightPhase: "{phase}",
    inflightRunning: "running",
    inflightThinking: "thinking",
    inflightStreaming: "streaming",
    inflightWaiting: "waiting",
    inflightReasoning: "reasoning {count} ch",
    inflightOut: "out {count} ch",
    abortBtn: "Abort (Esc)",
    stoppingBtn: "Stopping...",
    stopComplete: "Current answer stopped",
    stopTimeout: "The current task is still stopping. Try creating a new conversation again shortly.",
    backgroundJobs: "Background {count}",
    backgroundEmpty: "No background jobs",
    backgroundStop: "Stop",
    backgroundTask: "task",
    backgroundService: "service",
    confirmBtn: "Apply (y)",
    rejectBtn: "Reject (n)",
    applyRestBtn: "Apply rest (a)",
    flipAutoBtn: "Flip to AUTO (A)"
  },
  overview: {
    loading: "loading overview…",
    failed: "overview failed: {error}",
    standaloneTitle: "Standalone mode",
    standaloneDesc: "Read-only disk view. Start /dashboard from inside visionox code for live session state, MCP, and tools.",
    cockpit: "Cockpit",
    balance: "balance",
    tokens7d: "tokens · 7d",
    cacheHit: "cache hit",
    toolCalls24h: "tool calls · 24h",
    budget: "budget",
    currentSession: "current session",
    noSession: "No live session — /dashboard from inside visionox code to attach.",
    promptTok: "prompt tok",
    completionTok: "completion tok",
    cost: "cost",
    costTrend: "cost · 14 day",
    noUsageYet: "no usage yet",
    dayAvg: "/day avg",
    recentPlans: "recent plans",
    noPlans: "No plans yet — submit one with submit_plan.",
    toolActivity: "tool activity",
    noToolCalls: "No tool calls yet.",
    toolsLoaded: "tools loaded",
    mcpServers: "mcp servers",
    editMode: "edit mode",
    version: "Visionox-Whale",
    workingDir: "Working directory",
    projectRoot: "project root",
    noPriorData: "no prior data",
    stable: "— stable",
    vsPrior: "{arrow} {pct}% vs prior",
    active: "active",
    allUp: "all up",
    yoloWarning: "all prompts bypassed",
    checking: "checking",
    latest: "latest",
    workStatus: "Current work status",
    workspace: "workspace",
    provider: "provider",
    runtimeModel: "runtime model",
    presetMode: "preset / mode",
    workScene: "work scene",
    semanticReady: "available",
    semanticMissing: "not built",
    attention: "Needs attention",
    retestModels: "Model configuration changed; run model checks again.",
    modelDrift: "The runtime model differs from the configured model.",
    pendingEdits: "{count} edits are waiting for confirmation.",
    missingIndex: "No semantic index is available for this workspace.",
    checkModels: "Check now",
    checkingModels: "Checking...",
    modelCheckDone: "Model check complete: {passed}/{total} available.",
    modelCheckFailed: "Model check failed: {error}",
    openIndex: "Open index",
    budgetWarning: "Session budget is {pct}% used.",
    sessionAndPlans: "Session and plan",
    localSystem: "Local and system",
    userDataPaths: "User data paths",
    userDataSize: "User data",
    storageHealthy: "Storage format is current",
    backupCount: "{count} backups / sessions {size}",
    dataProtection: "Backup and restore",
    latestBackup: "Latest backup",
    noBackup: "No backup yet",
    createBackup: "Create backup",
    backupCreating: "Creating...",
    backupCreated: "Backup created: {count} files, {size}",
    backupFailed: "Backup failed: {error}",
    backupCorrupt: "{count} backup directories failed integrity checks.",
    storageIssues: "{count} user data issues need attention. Your files remain protected.",
    previewBackup: "Preview",
    previewCounts: "missing {missing} / conflicts {conflict} / unchanged {same}",
    restoreMissing: "Restore missing",
    restoreAll: "Overwrite conflicts",
    restoreConfirm: "Overwrite current files that differ from this backup?",
    restoreDone: "Restore complete: {restored} restored, {skipped} skipped.",
    restoreFailed: "Restore failed: {error}",
    backupEstimate: "Estimated {size} / {count} files / free {free}",
    backupRetention: "Keep snapshots",
    saveRetention: "Save",
    deleteBackup: "Delete",
    deleteBackupConfirm: "Permanently delete this backup snapshot?"
  },
  usage: {
    loading: "loading usage…",
    failed: "usage failed: {error}",
    records: "{count} records",
    dailyUsage: "Daily usage",
    dailyMeta: "cost · cache saved · turns",
    noData: "No usage data yet — run a turn in visionox chat / code / run and refresh.",
    windows: "Rolling windows",
    colWindow: "window",
    colTurns: "turns",
    colCacheHit: "cache hit",
    colCost: "cost (USD)",
    colCacheSaved: "cache saved",
    colVsClaude: "vs Claude",
    colSaved: "saved",
    axisTime: "time",
    axisUsd: "USD",
    axisTurns: "turns",
    seriesCost: "cost",
    seriesCacheSaved: "cache saved",
    seriesTurns: "turns",
    mostUsed: "Most used models",
    colModel: "model"
  },
  sessions: {
    loading: "loading sessions…",
    failed: "sessions failed: {error}",
    noSessions: "No saved sessions yet.",
    filterPlaceholder: "filter sessions",
    msgs: "msgs",
    pickHint: "Pick a session on the left to read its transcript.",
    resumeTitle: "Resume in TUI",
    resumeDesc: "Mid-session swap requires a restart so the message log can rewind cleanly. Quit your current session, then run:",
    loadingTranscript: "loading transcript…",
    emptyTranscript: "empty transcript.",
    messages: "{count} message{s}",
    rename: "Rename",
    renamePlaceholder: "new session name",
    renameFailed: "Rename failed: {error}",
    exportMarkdown: "Export Markdown",
    exported: "exported: {path}",
    exportFailed: "Export failed: {error}",
    noSummary: "No preview available.",
    resumeConfirm: "Loading this session will replace the current chat context. Current chat: {messages} message(s), busy: {busy}, drafts: {drafts}. Continue?",
    transcriptSearchPlaceholder: "Search this session",
    transcriptSearchIdle: "session transcript",
    transcriptSearchCount: "{current} / {total}"
  },
  tools: {
    loading: "loading tools…",
    failed: "tools failed: {error}",
    noTools: "No tools registered.",
    planMode: "plan mode — writes gated",
    colTool: "tool",
    colFlags: "flags",
    colDesc: "description",
    readOnly: "read-only",
    write: "write",
    flat: "flat",
    desc: {
      web_search: "Search the public web. Returns ranked results with title, url, and snippet. Call this when the answer depends on current state — events, prices, releases, real-world status.",
      web_fetch: "Download a URL and return its visible text content (scripts/styles/nav stripped). Use after web_search when a snippet isn't enough.",
      run_command: "Run a shell command in the project root; returns combined stdout+stderr. Allowlisted read-only commands run immediately; mutations are gated by user confirmation.",
      run_background: "Spawn a long-running process and detach. Returns a job id for tailing logs, waiting for completion, or killing. Use for dev servers, watchers, and one-shot long jobs.",
      job_output: "Read the latest output of a background job. Returns the tail of the buffer and tells you whether the job is still running.",
      wait_for_job: "Block server-side until a background job finishes, bounded by timeout. Use instead of polling job_output in a loop.",
      stop_job: "Stop a background job. SIGTERM first, SIGKILL after a grace period. Safe to call on an already-exited job.",
      list_jobs: "List every background job started this session — running and exited — with id, command, pid, and status.",
      remember: "Save a memory for future sessions. Use when the user states a preference, corrects your approach, shares a non-obvious fact, or asks you to remember something.",
      forget: "Delete a memory file and remove it from MEMORY.md. Use when the user asks to forget something or a remembered fact is now wrong.",
      recall_memory: "Read the full body of a memory file when its one-line summary isn't enough detail.",
      read_file: "Read a file under the sandbox root. Supports head/tail/range scoping to save context. Auto-returns a preview for files over 200 lines.",
      list_directory: "List entries in a directory. Returns one line per entry, marking directories with a trailing slash.",
      directory_tree: "Recursively list entries in a directory as an indented tree. Budget-aware with auto-collapse for large subtrees.",
      search_files: "Find files whose NAME matches a substring or regex. Case-insensitive. Skips dependency/build directories by default.",
      search_content: "Recursively grep file CONTENTS for a substring or regex. Returns matches in path:line:text format. The right tool for finding references.",
      glob: "List files matching a glob pattern, sorted by mtime. Default limit 200, max 1000. Skips node_modules/.git/dist by default.",
      get_file_info: "Stat a path under the sandbox root. Returns type, size in bytes, and mtime.",
      write_file: "Create or overwrite a file with the given content. Parent directories are created as needed.",
      edit_file: "Apply a SEARCH/REPLACE edit to an existing file. The search must match exactly and be unique in the file.",
      multi_edit: "Apply N SEARCH/REPLACE edits across one or more files atomically. If any edit fails, no files are written.",
      create_directory: "Create a directory (and any missing parents) under the sandbox root.",
      move_file: "Rename or move a file or directory under the sandbox root.",
      delete_file: "Delete one file under the sandbox root. Refuses directories — use delete_directory for those.",
      delete_directory: "Recursively delete a directory under the sandbox root. Pass recursive:false to refuse non-empty directories.",
      copy_file: "Copy a file or directory under the sandbox root. Refuses to overwrite an existing destination.",
      submit_plan: "Submit one concrete plan for a review gate. Use for multi-file refactors, architecture changes, or anything expensive to undo.",
      mark_step_complete: "Mark one step of the approved plan as done. Call exactly once after finishing each step.",
      revise_plan: "Surgically replace the remaining steps of an in-flight plan. Done steps are never touched.",
      run_skill: "Invoke a playbook from the Skills index. Pass the bare skill name. Subagent-tagged skills spawn an isolated subagent.",
      spawn_subagent: "Spawn an isolated subagent for a self-contained subtask. Use for parallel fan-out or when the work needs many file reads.",
      todo_write: "In-session task tracker for multi-step work. Replaces the entire list every call. No approval gate or file writes.",
      ask_choice: "Present 2-6 alternatives to the user. Use when the user asks for options or you need a preference decision.",
      create_skill: "Scaffold a new skill the user can invoke later via /skill. Supports inline and subagent run modes.",
      add_mcp_server: "Register a new MCP server in the user's config. Takes effect on the next session. Supports stdio, SSE, and streamable-http."
    }
  },
  permissions: {
    loading: "loading permissions…",
    failed: "permissions failed: {error}",
    yoloTitle: "YOLO mode",
    yoloDesc: "Every shell command auto-runs, allowlist bypassed. Switch back with /mode review in the TUI.",
    project: "project",
    builtin: "builtin",
    addPrefix: "add a prefix",
    addPlaceholder: 'e.g. "npm run build" or "deploy.sh"',
    clearAll: "Clear all",
    alreadyIn: "{prefix} already in list",
    added: "added: {prefix}",
    removed: "removed: {prefix}",
    cleared: "cleared {count} entr{y}",
    removeConfirm: `Remove "{prefix}" from this project's allowlist?`,
    clearConfirm: "Wipe every project allowlist entry? Builtin entries are unaffected.",
    projectAllowlist: "Project allowlist · {count}",
    nothingStored: "Nothing stored yet for this project.",
    colNum: "#",
    colPrefix: "prefix",
    builtinTitle: "Builtin · {count} · read-only",
    standaloneWarning: "Mutations require /dashboard from inside an active visionox code session — standalone visionox dashboard can't tell which project's allowlist to edit."
  },
  mcp: {
    loading: "loading MCP…",
    servers: "MCP servers · {count} bridged",
    all: "all",
    live: "live",
    unbridged: "unbridged",
    specPlaceholder: "spec — e.g. fs=npx -y @modelcontextprotocol/...",
    saved: "saved",
    savedRestart: "saved — restart visionox code to bridge this server",
    removed: "removed — restart to drop the live bridge",
    removeConfirm: "Remove MCP spec from config?\n\n{spec}",
    noServers: "No MCP servers in this session.",
    tools: "tools",
    inConfig: "in config · not loaded",
    unbridgedTitle: "unbridged · in config",
    removeBtn: "Remove",
    spec: "spec",
    whyUnbridged: "Why unbridged?",
    whyUnbridgedDesc: "This spec lives in your config.json but isn't bridged into the live session. MCP servers attach when visionox code starts; the dashboard alone can't spawn the child process.",
    whyUnbridgedHint: "To activate: restart visionox code, then refresh this dashboard.",
    pickHint: "Pick an MCP server on the left to inspect tools / resources / prompts.",
    toolsTitle: "Tools · {count}",
    resourcesTitle: "Resources · {count}",
    promptsTitle: "Prompts · {count}",
    colName: "name",
    colDesc: "description",
    colUri: "uri",
    marketplace: "marketplace",
    marketplaceSearch: "search the registry…",
    marketplaceLoading: "loading registry…",
    marketplaceMore: "load 5 more pages",
    marketplaceMoreLabel: "load 50 more  ·  showing {shown} / {total}",
    marketplaceMoreHint: "fetches more pages from the registry",
    marketplaceMoreCachedHint: "more entries already cached locally",
    marketplaceExhausted: "all pages loaded",
    marketplaceExhaustedFull: "showing all {total} entries — registry exhausted",
    marketplaceCount: "{loaded} loaded · {matched} match · source: {source}{cached}",
    marketplaceCachedSuffix: " · cached",
    marketplaceNoMatches: "No matches. Try different terms or load more pages.",
    marketplaceInstall: "Install",
    marketplacePickHint: "Pick a server on the left, then Install.",
    marketplaceInstalled: "installed → {spec}",
    marketplaceInstalledBridged: "installed + bridged → {spec}",
    marketplaceAlready: "already installed",
    marketplaceNeedsEnv: "needs env: {names}",
    marketplaceSourceTag: "[{source}]",
    marketplaceNoInstall: "smithery listing — install metadata not exposed; use `npx -y @smithery/cli install {name}` directly",
    marketplaceFetchOnInstall: "Smithery listing — install detail fetched on Install. http servers map to streamable-http remotes; stdio servers run via @smithery/cli.",
    marketplaceInstalledBadge: "installed",
    marketplaceUninstall: "Uninstall",
    marketplaceEnvTitle: "Required environment variables",
    marketplaceEnvHint: "Set these in your shell before next `visionox code` so the bridged server can authenticate.",
    marketplaceRestartHint: "Spec written to ~/.visionox/config.json. Restart `visionox code` to bridge the server (live hot-reload is on the roadmap)."
  },
  memory: {
    loading: "loading memory…",
    files: "memory · {count} files",
    exists: "exists",
    create: "create",
    noFiles: "No memory files yet.",
    pickHint: "Pick a memory file on the left.",
    pickDesc: "Project memory file; global notes live in ~/.visionox/memory/.",
    chars: "{count} chars",
    saved: "saved {scope}",
    reloadHint: "re-applied on next /new or session restart"
  },
  hooks: {
    loading: "loading hooks…",
    resolved: "resolved",
    eventMatrix: "Event matrix",
    matrixSub: "{scripts} script{s} × {events} event{s}",
    noHooks: "No hooks configured. Edit the JSON below to add some.",
    colScript: "script",
    noProject: "No active project — open /dashboard from visionox code to edit project hooks.",
    saveReload: "Save + Reload",
    discard: "Discard changes",
    savedReloaded: "saved + reloaded {scope}",
    recentRuns: "Recent runs",
    noRuns: "No hook runs in the recent session log.",
    colWhen: "when",
    colPhase: "phase",
    colHook: "hook",
    colOutcome: "outcome"
  },
  skills: {
    loading: "loading skills…",
    filterPlaceholder: "filter skills",
    project: "project",
    global: "global",
    builtin: "builtin",
    newSkill: "new skill",
    noDescription: "(no description)",
    runs7d: "runs · 7d",
    pickHint: "Pick a skill on the left, or create a new one above.",
    readOnlyBuiltin: "read-only · builtin",
    builtinDesc: "Built-in skills ship with Visionox-Whale; the model picks them up automatically. To customize, create a project- or global-scoped skill with the same name.",
    saved: "saved {scope}/{name}",
    deleteConfirm: "Delete skill {scope}/{name}?",
    reloadHint: "re-loaded on next /new or session restart",
    repairEnv: "repair skill env",
    repairOk: "skill environment repaired",
    managedBuiltin: "bundled",
    disabledBuiltin: "Bundled skill disabled. Use repair skill env to restore it."
  },
  system: {
    loading: "loading health…",
    failed: "health failed: {error}",
    healthChecks: "Health checks",
    version: "version",
    checking: "checking",
    latest: "● latest",
    outOfDate: "● out of date",
    versionPending: "version check pending",
    upToDate: "up to date",
    latestVer: "latest: {version}",
    sessions: "sessions",
    ok: "● ok",
    memory: "memory",
    semanticIndex: "semantic index",
    built: "● built",
    none: "— none",
    runIndex: "run visionox index to build",
    usageLog: "usage log",
    backgroundJobs: "background jobs",
    noSession: "— no session",
    running: "{count} running",
    attachHint: "attach a session to see jobs",
    shellSpawn: "shell + spawn",
    paths: "paths",
    home: "home",
    sessionsPath: "sessions",
    memoryPath: "memory",
    semanticPath: "semantic",
    usagePath: "usage"
  },
  plans: {
    loading: "loading plans…",
    failed: "plans failed: {error}",
    noPlans: "No active or archived plans yet — plans appear here after submit_plan.",
    filterPlaceholder: "filter plans",
    active: "active",
    pending: "pending",
    done: "done",
    idle: "idle",
    steps: "steps",
    pickHint: "Pick a plan on the left.",
    noTitle: "(no title)",
    stepTimeline: "Step timeline · {done} / {total}",
    step: "step {n}",
    planBody: "Plan body",
    markDone: "Mark done",
    cancelActive: "Cancel plan",
    confirmCancel: "Cancel the active plan?",
    confirmDelete: "Delete this plan archive?"
  },
  tasks: {
    loading: "loading tasks…",
    noTasks: "No scheduled tasks yet.",
    title: "Scheduled tasks",
    create: "New task",
    save: "Save task",
    update: "Update task",
    taskKind: "Task type",
    kindPrompt: "Prompt task",
    kindReport: "Session report task",
    kindSessionCleanup: "Session cleanup task",
    name: "Name",
    prompt: "Prompt",
    promptPlaceholder: "What should Visionox-Whale do when this task runs?",
    executionSource: "Execution source",
    executionPrompt: "Free prompt",
    executionSkill: "Skill template",
    skillTemplate: "Skill template",
    skillTemplateUnavailable: "No compatible scheduled Skill templates are installed.",
    skillReadOnlyHint: "This template is read-only, global, and follows the latest compatible Skill version. Login is required when it runs.",
    skillAddendum: "Additional requirements",
    skillAddendumPlaceholder: "Optional: focus, exclusions, output format...",
    skillWaitingAuth: "Waiting for login",
    type: "Schedule",
    interval: "Interval",
    customInterval: "Custom interval",
    daily: "Daily",
    weekly: "Weekly",
    dayOfWeek: "Day",
    weekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    every: "Every",
    at: "At",
    enabled: "Enabled",
    disabled: "Disabled",
    runNow: "Run now",
    testRun: "Test run",
    deleteConfirm: "Delete this scheduled task?",
    nextRun: "next",
    lastRun: "last",
    never: "never",
    accepted: "accepted",
    skipped: "skipped",
    rejected: "rejected",
    deferred: "waiting",
    running: "running",
    completed: "completed",
    cancelled: "cancelled",
    failed: "failed",
    saved: "task saved",
    deleted: "task deleted",
    runAccepted: "task started",
    runQueued: "task added to the waiting queue",
    runCompleted: "task completed",
    runCancelled: "task cancelled",
    runFailed: "task failed",
    runSkipped: "task skipped",
    runRejected: "task was not accepted",
    runPending: "task is waiting for confirmation",
    selectHint: "Select a task to edit it, or create a new one.",
    minInterval: "Interval must be 1 minute to 30 days.",
    busyHint: "The app must stay open for scheduled runs. Busy tasks wait in trigger order and start automatically when the previous work finishes.",
    workspace: "Workspace",
    currentWorkspace: "current",
    workspaceMismatch: "workspace changed",
    workspaceMismatchHint: "This task is bound to a different workspace. Runs are skipped until that workspace is active.",
    workspaceScope: "Task workspace",
    workspaceScopeBound: "Fixed workspace",
    workspaceScopeCurrent: "Follow current workspace",
    workspaceScopeHint: "Fixed tasks are skipped in another workspace; follow-current tasks run in whichever workspace is active.",
    workspaceRebind: "Bind to current workspace",
    cleanupWorkspace: "Cleanup workspace",
    cleanupWorkspaceHint: "This task continues after switching workspaces. Session filtering and knowledge files stay with this workspace until you rebind it.",
    history: "Recent runs",
    latestResult: "Latest result",
    manual: "manual",
    scheduled: "scheduled",
    noHistory: "No runs recorded yet.",
    summary: "Summary",
    noSummary: "No summary captured.",
    duration: "Duration",
    tokens: "Tokens",
    cost: "Cost",
    source: "Source",
    runMode: "Run mode",
    runModeAuto: "Auto execute",
    runModeReadonly: "Read-only",
    runModeConfirm: "Confirm first",
    pendingConfirmation: "needs confirmation",
    templateVars: "Variables: {date}, {time}, {workspace}, {lastRunAt}, {taskName}.",
    runWindow: "Run window",
    weekdaysOnly: "Weekdays only",
    enableWindow: "Limit time range",
    from: "From",
    to: "to",
    pendingTitle: "Pending confirmation",
    pendingHint: "These tasks reached their trigger time and are waiting for manual run.",
    reportPeriod: "Report period",
    reportScope: "Report scope",
    reportDaily: "Daily report",
    reportWeekly: "Weekly report",
    reportYearly: "Yearly report",
    reportCustom: "Custom range",
    reportToday: "Today",
    reportYesterday: "Yesterday",
    reportThisWeek: "This week",
    reportLastWeek: "Last week",
    reportLast7Days: "Last 7 days",
    reportLast30Days: "Last 30 days",
    reportThisYear: "This year",
    reportLastYear: "Last year",
    reportFixedRange: "Fixed range",
    reportDate: "Date",
    reportStart: "Start",
    reportEnd: "End",
    reportExport: "Also export to Downloads",
    reportExportPath: "Export path",
    reportStored: "The full report is retained in task history.",
    reportExportFailed: "Downloads export failed: {error}",
    reportRange: "Range",
    reportSessions: "Sessions",
    reportMessages: "Messages",
    reportTaskHint: "The run schedule decides when this task starts. The full report is always retained for preview; Downloads export is optional. The report range is calculated relative to the run time.",
    sessionCleanupAction: "Cleanup action",
    sessionCleanupPreview: "Preview only",
    sessionCleanupDelete: "Move high-confidence delete items to trash",
    sessionCleanupStrength: "Cleanup strength",
    sessionCleanupConservative: "Conservative",
    sessionCleanupStandard: "Standard",
    sessionCleanupAggressive: "Aggressive",
    sessionCleanupSemanticMode: "Smart review",
    sessionCleanupSemanticOff: "Off",
    sessionCleanupSemanticUncertain: "Review uncertain items",
    sessionCleanupSemanticDeep: "Deep review",
    sessionCleanupHint: "Runs as a background maintenance task and does not create a chat session. Destructive actions move sessions to the local trash first.",
    sessionCleanupPromptAddendum: "Additional organization requirements",
    knowledgeEnabled: "Extract detailed project knowledge",
    knowledgeLookbackDays: "Topic merge lookback (days)",
    knowledgeAutoIndex: "Incrementally update embeddings after knowledge changes",
    knowledgeAutoIndexUnavailable: "Save an embedding API key first",
    knowledgeDocuments: "Knowledge documents",
    knowledgeSessions: "Knowledge sessions",
    cleanupCandidates: "Suggestions",
    cleanupDeleted: "Moved to trash",
    cleanupArchive: "Archive",
    cleanupKeep: "Keep",
    cleanupExtract: "Extract",
    cleanupSemanticReviewed: "AI reviewed",
    cleanupTrashRoot: "Trash folder",
    cleanupFailed: "Failed",
    viewConversation: "View conversation"
  },
  semantic: {
    codeRequired: "Semantic — code-mode required",
    indexBuilt: "index built",
    noIndex: "no index yet",
    ready: "ready",
    setupNeeded: "setup needed",
    installOllama: "Install Ollama",
    installOllamaDesc: "Visionox-Whale doesn't run package managers for you. Install Ollama first, then come back:",
    macWindows: "macOS / Windows:",
    download: "download from ollama.com/download",
    linux: "Linux:",
    refreshHint: "Refresh after install — this panel will offer to start the daemon and pull {model}.",
    daemon: "Daemon",
    daemonDesc: "ollama is on your PATH but the HTTP daemon isn't reachable.",
    startDaemon: "Start daemon",
    runsOllama: "runs ollama serve detached",
    model: "Model",
    modelMissing: "{model} isn't installed yet.",
    modelSize: "~270 MB on first pull.",
    pulling: "pulling…",
    pullModel: "Pull {model}",
    indexStatus: "index status",
    builtStatus: "● built",
    incompatibleStatus: "● incompatible",
    chunks: "chunks",
    files: "files",
    dim: "dim",
    size: "size",
    lastBuild: "last build",
    builtWith: "built with",
    currentTarget: "current target",
    incompatibleHint: "This on-disk index was built for a different provider or model. Run Rebuild to replace it.",
    runIndexHint: "Run an index to enable semantic_search.",
    reIndex: "Re-index",
    build: "Build",
    rebuild: "Rebuild",
    stop: "Stop",
    provider: "provider",
    providerType: "service type",
    openaiCompat: "openai-compatible",
    apiUrl: "API URL",
    apiKey: "API key",
    apiKeyStoredNote: "API key is stored in ~/.visionox/config.json — do not share that file.",
    customRequestBody: "custom request body",
    invalidCustomRequestBody: "Custom request body must be valid JSON: {error}",
    customRequestBodyMustBeObject: "Custom request body must be a JSON object.",
    saveBeforeIndex: "Save semantic settings before starting an index.",
    extraBody: "extra body",
    keepExistingKey: "leave blank to keep existing key",
    remoteProvider: "Remote embedding provider",
    remoteProviderDesc: "Configure the full OpenAI-compatible embeddings URL here. Visionox-Whale will send requests exactly to the URL you provide.",
    ollama: "ollama",
    binary: "binary",
    found: "found",
    missing: "missing",
    daemonStatus: "daemon",
    up: "up",
    down: "down",
    pulled: "pulled",
    indexConfig: "index config",
    reset: "reset",
    excludeDirs: "exclude dirs",
    excludeFiles: "exclude files",
    excludeExts: "exclude exts",
    excludePatterns: "exclude patterns",
    glob: "glob",
    respectGitignore: "respect .gitignore",
    includeKnowledgeDocs: "include knowledge directory Markdown",
    maxFileBytes: "max file bytes",
    skipLarger: "skip files larger than ~{size} MiB",
    preview: "Preview",
    searchPlaceholder: "describe what to find — 'where do we handle abort signals'",
    searching: "searching…",
    results: "{count} result{s} · {ms}ms · {model}",
    noMatches: "No matches above the score threshold.",
    previewSummary: "Preview — would index {included} file(s), skip {skipped}",
    nothingSkipped: "nothing skipped — all walked files would be indexed.",
    firstIncluded: "first {count} included file(s)",
    job: "Job",
    phaseSetup: "preparing",
    phaseScan: "scanning files",
    phaseEmbed: "embedding chunks",
    phaseWrite: "writing index",
    phaseDone: "done",
    phasePartial: "partial",
    phaseError: "error",
    phaseCancelled: "cancelled",
    setupFailed: "setup failed",
    stopping: "stopping",
    scanned: "scanned {count}",
    changed: "changed {count}",
    skipped: "skipped {count}",
    chunksProgress: "{done} / {total} ({pct}%)",
    result: "result",
    added: "added {count}",
    removed: "removed {count}",
    failed: "failed {count}",
    skippedFiles: "{total} files ({details})",
    rebuildStarted: "rebuild started",
    incrementalStarted: "incremental index started",
    stopRequested: "stopping requested — current chunk batch will finish first",
    startingDaemon: "starting ollama daemon (15s timeout)…",
    daemonUp: "daemon is up",
    daemonTimeout: "daemon didn't come up in time — check ollama serve manually",
    pullingModel: "pulling {model} — this may take a few minutes on first install",
    savedConfig: "saved · {count} fields updated · re-run index to apply",
    runningPreview: "running dry walk against project root…",
    exclude: "exclude"
  },
  modal: {
    shellTitle: "shell command",
    shellBgTitle: "background process",
    shellSubtitle: "model wants to run a shell command",
    shellBgSubtitle: "long-running — keeps running after approval",
    runOnce: "Run once",
    alwaysAllow: 'Always allow "{prefix}"',
    deny: "Deny",
    choiceTitle: "model wants you to pick",
    typeOwn: "Type my own answer",
    typeOwnSummary: "None of the above fits — write a free-form reply.",
    typePlaceholder: "Type a free-form answer…",
    send: "Send",
    cancel: "Cancel",
    cancelSummary: "Drop the question. Model will ask what you actually want.",
    planTitle: "plan submitted",
    planSubtitle: "model proposed a plan; review then pick",
    approveInstructions: "Optional last instructions / answers to open questions (Enter to send blank)",
    refinePlaceholder: "What needs to change? Be specific.",
    approve: "Approve",
    refine: "Refine",
    sendRefinement: "Send refinement",
    editTitle: "edit pending review",
    editSubtitle: "{path} · {remaining} of {total} blocks remaining",
    before: "before",
    after: "after",
    workspaceTitle: "model wants to switch workspace",
    workspaceSubtitle: "every subsequent file / shell / memory tool resolves against the new root",
    switchBtn: "Switch (Enter)",
    denyBtn: "Deny (Esc)",
    stepComplete: "step complete{counter}",
    continueBtn: "Continue",
    reviseBtn: "Revise…",
    stopBtn: "Stop",
    revisionTitle: "model proposed a plan revision",
    sendRevision: "Send revision",
    accept: "Accept",
    reject: "Reject",
    arguments: "arguments",
    revisePlaceholder: "What needs to change before the next step? Leave blank to just continue.",
    pickerFilter: "Filter…",
    pickerEmpty: "Nothing to show.",
    pickerLoadMore: "Load more",
    pickerPick: "Open",
    pickerInstall: "Install",
    pickerUninstall: "Uninstall",
    pickerRename: "Rename…",
    pickerNew: "New…",
    pickerNewPlaceholder: "Name (leave blank for default)",
    viewerClose: "Close"
  }
};

// dashboard/src/i18n/zh-CN.ts
var zhCN = {
  app: {
    sectionWorkspace: "工作区",
    sectionObserve: "监控与变更",
    sectionConfigure: "高级",
    tabChat: "对话",
    tabPlans: "计划",
    tabTasks: "任务",
    tabSessions: "会话",
    tabFiles: "文件",
    tabOverview: "概览",
    tabUsage: "用量",
    tabSystem: "系统",
    tabSemantic: "语义",
    tabTools: "工具",
    tabPermissions: "权限",
    tabMcp: "MCP",
    tabSkills: "技能",
    tabMemory: "记忆",
    tabHooks: "钩子",
    tabReports: "报告",
    tabSettings: "设置",
    sectionChanges: "变更",
    tabChanges: "变更",
    footer: "仅 127.0.0.1 · Token 保护"
  },
  changes: {
    chatPlaceholder: "询问代码问题…",
    chatWelcome: "变更 — 询问项目文件相关问题。",
    chatSend: "发送",
    viewerPlaceholder: "选择一个文件查看",
    treeEmpty: "（空）",
    tabClose: "关闭标签",
    newConversation: "新建",
    clearConversation: "清除",
    newTitle: "/new — 清除对话上下文",
    clearTitle: "/clear — 仅清除可见的滚动回放",
    newConfirmBusy: "有轮次正在执行。中止并开始新对话？",
    newConfirm: "清除当前对话并重新开始？",
    newToast: "新对话",
    clearToast: "滚动回放已清除",
    newFailed: "/new 失败：{error}",
    clearFailed: "/clear 失败：{error}",
    chatSendBtn: "发送",
    fileTreeTitle: "文件",
    codeViewerTitle: "代码查看器",
    chatPanelTitle: "对话",
    loadingFiles: "正在加载项目文件…",
    review: "审查",
    allFiles: "所有文件",
    changes: "更改",
    commentLabel: "正在评论 第",
    commentPlaceholder: "添加评论…",
    commentCancel: "取消",
    commentSubmit: "评论",
    commentLine: "第",
    commentEdit: "编辑",
    commentDelete: "删除",
    reviewEmpty: "暂无可审查的更改",
    diffSourceGit: "Git 变更",
    diffSourceSession: "上一轮变更",
    diffStyleUnified: "统一视图",
    diffStyleSplit: "分栏视图",
    expandAll: "全部展开",
    collapseAll: "全部折叠"
  },
  common: {
    loading: "加载中…",
    loadingFailed: "{name}失败：{error}",
    back: "← 返回",
    save: "保存",
    remove: "移除",
    cancel: "取消",
    delete: "删除",
    add: "添加",
    confirm: "确认",
    noData: "暂无{name}。",
    all: "全部",
    yes: "是",
    no: "否",
    on: "开启",
    off: "关闭",
    enabled: "已启用",
    disabled: "已禁用"
  },
  reports: {
    title: "对话报告",
    period: "周期",
    daily: "日报",
    weekly: "周报",
    yearly: "年度报告",
    custom: "自定义",
    startDate: "开始",
    endDate: "结束",
    date: "日期",
    generate: "生成报告",
    generating: "正在生成报告…",
    generatingPreview: "正在基于 {sessions} 个会话、{messages} 条消息生成报告…",
    empty: "暂未生成报告。",
    stats: "会话数：{sessions} · 消息数：{messages}",
    sendToChat: "发送到对话",
    export: "导出 Markdown",
    prompt: "报告提示词",
    savePrompt: "保存",
    resetPrompt: "重置默认",
    cancelPrompt: "取消",
    promptSaved: "提示词模板已保存",
    error: "报告生成失败：{error}"
  },
  settings: {
    title: "设置",
    loading: "加载设置…",
    saved: "已保存：{fields}",
    sectionApi: "当前模型服务凭据",
    credentialCurrent: "当前服务：{name}",
    credentialsScope: "此处维护所选服务的密钥和 API 地址；配置导入与全量检测位于下方模型管理。",
    credentialsRetest: "凭据已更新，请在下方模型管理中重新检测全部模型。",
    credentialProvider: "服务商",
    detectApi: "检测 API",
    detectingApi: "检测中...",
    detectionRequired: "需要先检测 API 才能保存",
    detectionPassed: "API 检测通过：{model}",
    saveCredentials: "保存凭据",
    apiKey: "API 密钥",
    notSet: "（未设置）",
    replace: "替换",
    pasteKey: "粘贴新的 sk-… 令牌",
    saveKey: "保存密钥",
    baseUrl: "基础 URL",
    baseUrlPlaceholder: "https://api.deepseek.com（默认）",
    sectionDefaults: "默认设置",
    preset: "预设",
    presetAuto: "auto — flash 基线，困难时自动升级为 pro",
    presetFlash: "flash — 始终使用 flash，不自动升级",
    presetPro: "pro — 始终使用 pro",
    appliesNextTurn: "下一轮生效",
    effort: "推理强度",
    effortMax: "max（默认 — 最佳质量）",
    effortHigh: "high（更便宜 / 更快）",
    webSearch: "网页搜索",
    webSearchNote: "web_fetch + web_search 工具",
    sectionCompute: "计算",
    proNext: "/pro 单轮",
    proArm: "为下一轮装备",
    proArmed: "已装备 — 下一轮后自动解除",
    proNextNote: "下一轮使用 deepseek-v4-pro，之后自动解除",
    sectionBudget: "预算",
    budgetOf: "/",
    budgetSetCap: "设置上限",
    budgetCustom: "自定义",
    budgetBumpHint: "提高上限以继续",
    budgetClear: "清除上限",
    budgetIdleLine: "80% 时提醒 · 100% 后拒绝执行",
    budgetWarnLine: "接近上限 — 超过 100% 将拒绝执行",
    budgetRefusing: "已超出上限 — 提高或清除后才会继续",
    sectionLoop: "循环",
    loopIdleHint: "按固定间隔自动重新提交一段提示词。",
    loopCostHint: "每次迭代约 {cost}（上一轮成本）。",
    loopInterval: "间隔",
    loopCustom: "自定义",
    loopRangeError: "间隔需在 5s..6h 之间",
    loopPrompt: "提示词",
    loopPromptPlaceholder: "例如：检查部署状态并汇报任何错误",
    loopStart: "启动循环",
    loopStop: "停止",
    loopRunning: "运行中",
    loopIter: "第 {iter} 次",
    loopFiresIn: "{remaining} 后触发",
    sectionRuntime: "运行时",
    activeModel: "当前模型",
    modelPricingLine: "${hit} 命中 · ${miss} 未命中 · ${out} 输出  / 100 万 tok",
    editMode: "编辑模式",
    editModeNote: "在对话标签页头部切换",
    sectionLanguage: "语言",
    language: "语言",
    langEn: "English",
    langZhCn: "简体中文",
    sectionDev: "开发者",
    devMode: "开发者模式",
    devModeNote: "显示后台服务器启动和运行时日志",
    devFollowing: "正在跟随最新日志",
    devNewLogs: "{count} 条新日志",
    devBackToBottom: "回到底部"
  },
  chat: {
    modeMirror: "镜像",
    modeView: "对话",
    placeholder: "输入提示词 — Enter 发送，Shift+Enter 换行 · / @ 打开选择器",
    placeholderBusy: "可继续输入，发送后将排队处理",
    send: "发送",
    queueSend: "排队",
    queueTitle: "排队中 {count}/{max} 条",
    queueImageMeta: "含 {count} 张图片",
    queueImagesOnly: "{count} 张图片",
    queueSending: "即将发送...",
    queueFailedStatus: "发送失败",
    queueRetry: "重试",
    queueCancel: "取消",
    queueClear: "清空",
    queuePaused: "上一条回答已停止，队列已暂停",
    queueResume: "继续队列",
    queueClearConfirm: "清空 {count} 条排队内容？",
    queueResetConfirm: "当前有 {count} 条内容正在排队，是否清空并继续？",
    queueAdded: "已加入排队（{count} 条）",
    queueLimit: "最多排队 {count} 条，请等待前面的内容发送后再试",
    queueFailed: "排队内容发送失败：{error}",
    queueCommandBlocked: "这个命令会改变对话上下文，请在当前轮次结束后再执行",
    loadEarlierMessages: "加载更早的 {count} 条消息",
    reconnecting: "正在重新连接本地服务，排队内容已保留。",
    new: "新建",
    clear: "清除",
    newTitle: "/new — 清除对话上下文（循环日志 + 滚动回放）",
    clearTitle: "/clear — 仅清除可见的滚动回放（上下文保留）",
    noConversation: "暂无对话。在下方发送提示词开始。",
    newConfirmBusy: "有轮次正在执行。中止并开始新对话？",
    newConfirm: "清除当前对话并重新开始？",
    newToast: "新对话",
    clearToast: "滚动回放已清除",
    newFailed: "/new 失败：{error}",
    clearFailed: "/clear 失败：{error}",
    searchPlaceholder: "搜索当前对话",
    searchIdle: "当前对话",
    searchCount: "{current} / {total}",
    searchPrev: "上一个匹配",
    searchNext: "下一个匹配",
    searchClear: "清除搜索",
    copyMessage: "复制",
    copiedMessage: "已复制",
    copyFailed: "复制失败：{error}",
    fillInput: "填入输入框",
    filledInput: "已填入输入框",
    toolOutputCollapsed: "长输出已折叠 · {lines} 行 · {chars} 字符",
    eventStreamError: "事件流中断 — 正在重连…",
    semanticBanner: "此项目未启用语义搜索。",
    semanticBannerDesc: "构建一次索引，模型即可按含义查找代码（“哪里处理认证失败？”），而不仅依赖精确字符串的 grep。",
    semanticBannerBtn: "构建 →",
    semanticBannerDismiss: "关闭（不再显示）",
    slashCommands: "斜杠命令",
    slashHints: {
      help: "显示可用的斜杠命令",
      new: "开始新对话（清除上下文+历史）",
      retry: "截断并重新发送上一条消息",
      compact: "将较早的对话折叠为摘要（缓存安全）。50% 时自动触发，此为手动触发。",
      stop: "中止当前模型回复（等同于 Esc）",
      btw: "快速旁路提问 — 从空白状态回答，不加入对话上下文",
      preset: "模型预设 — auto 自动升级 flash→pro，flash/pro 锁定。无参数打开选择器。",
      model: "切换 DeepSeek 模型 ID。无参数打开选择器。",
      theme: "显示或保存终端主题。无参数打开选择器。",
      status: "当前模型、标志、上下文、会话信息",
      cost: "无参数→上轮花费；带文本→估算发送成本",
      context: "显示上下文窗口分解（系统/工具/日志/输入）",
      stats: "跨会话费用看板（今日/本周/本月/全部·缓存命中·对比 Claude）",
      doctor: "健康检查（API/配置/可达性/索引/钩子/项目）",
      resource: "浏览+读取 MCP 资源",
      prompt: "浏览+获取 MCP 提示",
      memory: "显示/管理固定记忆",
      skill: "列出/运行/创建用户技能",
      init: "扫描项目并生成基础 REASONIX.md",
      apply: "将待处理编辑块写入磁盘",
      discard: "丢弃待处理编辑块（不写入）",
      walk: "逐块浏览待处理编辑",
      undo: "回滚上一批已应用编辑",
      history: "列出本会话所有编辑批次",
      show: "查看已存储的编辑差异",
      commit: "git add -A && git commit",
      mode: "编辑门控：review·auto·yolo",
      plan: "切换只读计划模式",
      checkpoint: "快照本会话触及的所有文件",
      restore: "回滚文件到指定检查点",
      cwd: "切换工作区根目录",
      jobs: "列出后台任务",
      kill: "按 ID 停止后台任务",
      logs: "查看后台任务输出",
      pro: "为下一轮启用 v4-pro（一次性·轮次后自动解除）",
      permissions: "显示/编辑 shell 白名单",
      replay: "加载归档计划为只读时间旅行快照",
      report: "从对话历史生成日报/周报/年报",
      learn: "学习系统（技能提取/项目记忆/语义索引/问答/导师模式）"
    },
    projectFiles: "项目文件",
    mentionTargets: "技能 / 项目文件",
    skillMentionMeta: "技能",
    skillInvokeTaskFallback: "按这个技能的流程处理用户请求。",
    skillCredentialTitle: "配置 {label}",
    skillCredentialHint: "仅 {skill} 技能需要。密钥只保存在本机，不会写入对话或发送给模型。",
    skillCredentialPlaceholder: "粘贴 API Key",
    skillCredentialSave: "保存并继续",
    skillCredentialSaving: "正在保存...",
    skillCredentialHelp: "获取 API Key",
    skillCredentialCheckFailed: "无法检查技能密钥：{error}",
    workspacePicker: "选择工作空间",
    workspaceCurrent: "当前工作空间",
    workspacePending: "已选择，下次新建对话时生效",
    workspaceDefault: "默认工作空间",
    workspaceBrowse: "浏览其他目录...",
    workspaceManual: "输入工作空间路径",
    workspaceRemove: "从最近工作空间中移除",
    workspaceChanged: "已选择工作空间：{path}。将在下次新建对话时生效。",
    effortTitle: "reasoning_effort — 下一轮生效",
    effortMaxTitle: "max（默认 — 最佳质量）",
    effortHighTitle: "high（更便宜 / 更快）",
    presetTitle: "预设 — 模型承诺",
    presetAutoTitle: "auto — flash 基线；困难轮次自动升级为 pro（NEEDS_PRO / 失败阈值）",
    presetFlashTitle: "flash — 始终 flash；不自动升级。/pro 仍可用于一次性手动提升",
    presetProTitle: "pro — 始终 pro；约 3 倍 flash 成本（5/31 折扣）。锁定困难的架构工作。",
    editGateTitle: "编辑门控 — Shift+Tab 在 TUI 中循环",
    editAutoTitle: "auto — 编辑自动应用；Shell 受白名单限制，文件系统沙箱隔离",
    editYoloTitle: "yolo — 编辑和 Shell 自动运行；文件系统限制在项目目录内",
    editAdminTitle: "admin — 所有限制移除：Shell 和文件系统均无限制",
    railSession: "会话",
    railTurns: "轮次",
    railPromptTok: "提示 tokens",
    railCost: "费用",
    railCacheHit: "缓存命中",
    railToolBudget: "工具预算",
    railSpend: "已用",
    railActivePlan: "活跃计划",
    railProgress: "进度",
    statusModel: "模型",
    statusCtx: "上下文",
    statusCache: "缓存",
    statusTurn: "轮次",
    statusSession: "会话",
    statusBalance: "余额",
    statusTurns: "{count} 轮",
    waitingStats: "· · ·  等待实时统计",
    inflightPhase: "{phase}",
    inflightRunning: "运行中",
    inflightThinking: "思考中",
    inflightStreaming: "输出中",
    inflightWaiting: "等待中",
    inflightReasoning: "推理 {count} 字符",
    inflightOut: "输出 {count} 字符",
    abortBtn: "中止 (Esc)",
    stoppingBtn: "正在停止...",
    stopComplete: "当前回答已停止",
    stopTimeout: "当前任务仍在停止，请稍后重试新建对话",
    backgroundJobs: "后台 {count}",
    backgroundEmpty: "暂无后台任务",
    backgroundStop: "停止",
    backgroundTask: "临时任务",
    backgroundService: "长期服务",
    confirmBtn: "应用 (y)",
    rejectBtn: "拒绝 (n)",
    applyRestBtn: "应用剩余 (a)",
    flipAutoBtn: "切换为 AUTO (A)"
  },
  overview: {
    loading: "加载概览…",
    failed: "概览失败：{error}",
    standaloneTitle: "独立模式",
    standaloneDesc: "只读磁盘视图。在 visionox code 内启动 /dashboard 以获取实时会话状态、MCP 和工具。",
    cockpit: "驾驶舱",
    balance: "余额",
    tokens7d: "tokens · 7 天",
    cacheHit: "缓存命中",
    toolCalls24h: "工具调用 · 24 小时",
    budget: "预算",
    currentSession: "当前会话",
    noSession: "无活跃会话 — 在 visionox code 内执行 /dashboard 进行连接。",
    promptTok: "提示 tokens",
    completionTok: "补全 tokens",
    cost: "费用",
    costTrend: "费用 · 14 天",
    noUsageYet: "暂无用量",
    dayAvg: "/天 均值",
    recentPlans: "近期计划",
    noPlans: "暂无计划 — 使用 submit_plan 提交一个。",
    toolActivity: "工具活动",
    noToolCalls: "暂无工具调用。",
    toolsLoaded: "已加载工具",
    mcpServers: "MCP 服务器",
    editMode: "编辑模式",
    version: "Visionox-Whale",
    workingDir: "工作目录",
    projectRoot: "项目根目录",
    noPriorData: "无历史数据",
    stable: "— 稳定",
    vsPrior: "{arrow} {pct}% 较上期",
    active: "活跃",
    allUp: "全部在线",
    yoloWarning: "所有提示被绕过",
    checking: "检查中",
    latest: "最新",
    workStatus: "当前工作状态",
    workspace: "工作区",
    provider: "模型服务",
    runtimeModel: "实际模型",
    presetMode: "预设 / 模式",
    workScene: "工作场景",
    semanticReady: "可用",
    semanticMissing: "未构建",
    attention: "需要处理",
    retestModels: "模型配置已变更，请重新执行模型检测。",
    modelDrift: "当前运行模型与配置模型不一致。",
    pendingEdits: "有 {count} 项编辑等待确认。",
    missingIndex: "当前工作区尚无可用的语义索引。",
    checkModels: "立即检测",
    checkingModels: "检测中...",
    modelCheckDone: "模型检测完成：{passed}/{total} 可用。",
    modelCheckFailed: "模型检测失败：{error}",
    openIndex: "前往索引",
    budgetWarning: "当前会话预算已使用 {pct}%。",
    sessionAndPlans: "会话与计划",
    localSystem: "本地与系统",
    userDataPaths: "用户数据路径",
    userDataSize: "用户数据",
    storageHealthy: "存储格式已是最新",
    backupCount: "{count} 个备份 / 会话 {size}",
    dataProtection: "备份与恢复",
    latestBackup: "最新备份",
    noBackup: "尚无备份",
    createBackup: "创建备份",
    backupCreating: "正在创建...",
    backupCreated: "备份已创建：{count} 个文件，{size}",
    backupFailed: "备份失败：{error}",
    backupCorrupt: "{count} 个备份目录未通过完整性检查。",
    storageIssues: "{count} 个用户数据问题需要处理，原文件已受保护。",
    previewBackup: "预览",
    previewCounts: "缺失 {missing} / 冲突 {conflict} / 未变 {same}",
    restoreMissing: "恢复缺失项",
    restoreAll: "覆盖冲突项",
    restoreConfirm: "确定覆盖与此备份不同的当前文件吗？",
    restoreDone: "恢复完成：已恢复 {restored} 项，跳过 {skipped} 项。",
    restoreFailed: "恢复失败：{error}",
    backupEstimate: "预计 {size} / {count} 个文件 / 可用 {free}",
    backupRetention: "保留快照",
    saveRetention: "保存",
    deleteBackup: "删除",
    deleteBackupConfirm: "确定永久删除这个备份快照吗？"
  },
  usage: {
    loading: "加载用量…",
    failed: "用量失败：{error}",
    records: "{count} 条记录",
    dailyUsage: "每日用量",
    dailyMeta: "费用 · 缓存节省 · 轮次",
    noData: "暂无用量数据 — 在 visionox chat / code / run 中执行一轮，然后刷新。",
    windows: "滚动窗口",
    colWindow: "时间范围",
    colTurns: "轮次",
    colCacheHit: "缓存命中",
    colCost: "费用 (USD)",
    colCacheSaved: "缓存节省",
    colVsClaude: "对比 Claude",
    colSaved: "节省",
    axisTime: "时间",
    axisUsd: "美元",
    axisTurns: "轮次",
    seriesCost: "费用",
    seriesCacheSaved: "缓存节省",
    seriesTurns: "轮次",
    mostUsed: "最常用模型",
    colModel: "模型"
  },
  sessions: {
    loading: "加载会话…",
    failed: "会话失败：{error}",
    noSessions: "暂无已保存的会话。",
    filterPlaceholder: "筛选会话",
    msgs: "条消息",
    pickHint: "选择左侧的会话以查看其转录稿。",
    resumeTitle: "在 TUI 中恢复",
    resumeDesc: "会话中途切换需要重启，以便消息日志可以干净地回退。请退出当前会话，然后运行：",
    loadingTranscript: "加载转录稿…",
    emptyTranscript: "空的转录稿。",
    messages: "{count} 条消息",
    rename: "重命名",
    renamePlaceholder: "新会话名称",
    renameFailed: "重命名失败：{error}",
    exportMarkdown: "导出 Markdown",
    exported: "已导出：{path}",
    exportFailed: "导出失败：{error}",
    noSummary: "暂无预览。",
    resumeConfirm: "加载该会话会替换当前对话上下文。当前对话：{messages} 条消息，忙碌：{busy}，草稿：{drafts}。继续？",
    transcriptSearchPlaceholder: "搜索此会话",
    transcriptSearchIdle: "会话记录",
    transcriptSearchCount: "{current} / {total}"
  },
  tools: {
    loading: "加载工具…",
    failed: "工具失败：{error}",
    noTools: "未注册任何工具。",
    planMode: "计划模式 — 写入受限",
    colTool: "工具",
    colFlags: "标志",
    colDesc: "描述",
    readOnly: "只读",
    write: "写入",
    flat: "扁平",
    desc: {
      web_search: "搜索公共网络。返回带标题、URL 和摘要的排序结果。当答案的正确性依赖于当前状态时调用——事件、价格、发布、现实世界的状态。",
      web_fetch: "下载 URL 并返回其可见文本内容（已剥离脚本/样式/导航）。在 web_search 摘要不够时使用。",
      run_command: "在项目根目录执行 shell 命令，返回合并的标准输出和标准错误。白名单中的只读命令立即执行；可能修改状态的操作需用户确认。",
      run_background: "启动一个长时间运行的进程并分离。返回任务 ID 用于查看日志、等待完成或终止。用于开发服务器、文件监听器和一次性长时间任务。",
      job_output: "读取后台任务的最新输出。返回缓冲区末尾内容并告知任务是否仍在运行。",
      wait_for_job: "在服务端阻塞直到后台任务完成（有超时限制）。用于替代轮询 job_output。",
      stop_job: "停止后台任务。先发送 SIGTERM，宽限期后发送 SIGKILL。可安全调用已退出的任务。",
      list_jobs: "列出本次会话启动的所有后台任务——运行中和已退出的——包含 ID、命令、PID 和状态。",
      remember: "保存一条记忆供未来会话使用。当用户陈述偏好、纠正你的方法、分享非显而易见的事实或要求你记住某事时使用。",
      forget: "删除记忆文件并从 MEMORY.md 中移除。当用户要求忘记某事或之前记住的事实已不再正确时使用。",
      recall_memory: "当记忆文件的一行摘要不够详细时，读取其完整内容。",
      read_file: "读取沙箱根目录下的文件。支持 head/tail/range 范围读取以节省上下文。超过 200 行的文件自动返回预览。",
      list_directory: "列出目录中的条目。每行一个条目，目录以斜杠标记。",
      directory_tree: "递归列出目录中的条目，以缩进树形结构显示。对大子目录自动折叠以节省预算。",
      search_files: "根据名称匹配子串或正则表达式查找文件。不区分大小写。默认跳过依赖/构建目录。",
      search_content: "递归搜索文件内容中的子串或正则表达式。以 path:line:text 格式返回匹配结果。查找引用的正确工具。",
      glob: "按 glob 模式列出文件，按修改时间排序。默认限制 200，最大 1000。默认跳过 node_modules/.git/dist。",
      get_file_info: "获取沙箱根目录下路径的状态信息。返回类型、字节大小和修改时间。",
      write_file: "创建或覆盖文件，内容由参数指定。按需创建父目录。",
      edit_file: "对现有文件应用 SEARCH/REPLACE 编辑。搜索必须完全匹配且在文件中唯一。",
      multi_edit: "跨一个或多个文件原子性地应用 N 个 SEARCH/REPLACE 编辑。如果任何编辑失败，不写入任何文件。",
      create_directory: "在沙箱根目录下创建目录（以及任何缺失的父目录）。",
      move_file: "重命名或移动沙箱根目录下的文件或目录。",
      delete_file: "删除沙箱根目录下的一个文件。拒绝目录——请使用 delete_directory 删除目录。",
      delete_directory: "递归删除沙箱根目录下的目录。传入 recursive:false 可拒绝非空目录。",
      copy_file: "复制沙箱根目录下的文件或目录。拒绝覆盖已存在的目标。",
      submit_plan: "提交一个具体的计划以供审查审批。用于多文件重构、架构变更或任何撤销代价高昂的操作。",
      mark_step_complete: "将已批准计划的一个步骤标记为完成。完成每个步骤后恰好调用一次。",
      revise_plan: "外科手术式替换进行中计划的剩余步骤。已完成的步骤永远不会被触及。",
      run_skill: "从技能索引中调用一个 playbook。传入裸技能名称。标记为子代理的技能将启动独立的子代理。",
      spawn_subagent: "为一个独立子任务启动隔离的子代理。用于并行分发或需要大量文件读取的工作。",
      todo_write: "多步工作的会话内任务跟踪器。每次调用替换整个列表。无审批关卡，不写入文件。",
      ask_choice: "向用户展示 2-6 个选项。当用户要求选择或需要偏好决策时使用。",
      create_skill: "创建一个新技能，用户可通过 /skill 命令调用。支持内联和子代理两种运行模式。",
      add_mcp_server: "在用户配置中注册新的 MCP 服务器。下次会话生效。支持 stdio、SSE 和 streamable-http。"
    }
  },
  permissions: {
    loading: "加载权限…",
    failed: "权限失败：{error}",
    yoloTitle: "YOLO 模式",
    yoloDesc: "所有 shell 命令自动运行，允许列表被绕过。在 TUI 中使用 /mode review 切换回来。",
    project: "项目",
    builtin: "内置",
    addPrefix: "添加前缀",
    addPlaceholder: '例如 "npm run build" 或 "deploy.sh"',
    clearAll: "清除全部",
    alreadyIn: "{prefix} 已在列表中",
    added: "已添加：{prefix}",
    removed: "已移除：{prefix}",
    cleared: "已清除 {count} 条",
    removeConfirm: '从此项目的允许列表中移除 "{prefix}"？',
    clearConfirm: "清除所有项目允许列表条目？内置条目不受影响。",
    projectAllowlist: "项目允许列表 · {count}",
    nothingStored: "此项目暂无存储的条目。",
    colNum: "#",
    colPrefix: "前缀",
    builtinTitle: "内置 · {count} · 只读",
    standaloneWarning: "修改操作需要在活跃的 visionox code 会话内执行 /dashboard — 独立模式的 visionox dashboard 无法确定要编辑哪个项目的允许列表。"
  },
  mcp: {
    loading: "加载 MCP…",
    servers: "MCP 服务器 · {count} 个已桥接",
    all: "全部",
    live: "在线",
    unbridged: "未桥接",
    specPlaceholder: "规格 — 例如 fs=npx -y @modelcontextprotocol/...",
    saved: "已保存",
    savedRestart: "已保存 — 重启 visionox code 以桥接此服务器",
    removed: "已移除 — 重启以断开实时桥接",
    removeConfirm: "从配置中移除 MCP 规格？\n\n{spec}",
    noServers: "此会话中无 MCP 服务器。",
    tools: "个工具",
    inConfig: "在配置中 · 未加载",
    unbridgedTitle: "未桥接 · 在配置中",
    removeBtn: "移除",
    spec: "规格",
    whyUnbridged: "为什么未桥接？",
    whyUnbridgedDesc: "此规格存在于您的 config.json 中，但未桥接到实时会话。MCP 服务器在 visionox code 启动时连接；仪表盘本身无法生成子进程。",
    whyUnbridgedHint: "激活方法：重启 visionox code，然后刷新此仪表盘。",
    pickHint: "选择左侧的 MCP 服务器以检查工具 / 资源 / 提示。",
    toolsTitle: "工具 · {count}",
    resourcesTitle: "资源 · {count}",
    promptsTitle: "提示 · {count}",
    colName: "名称",
    colDesc: "描述",
    colUri: "URI",
    marketplace: "市场",
    marketplaceSearch: "搜索注册表…",
    marketplaceLoading: "加载注册表…",
    marketplaceMore: "再加载 5 页",
    marketplaceMoreLabel: "再加载 50 条  ·  当前 {shown} / {total}",
    marketplaceMoreHint: "需要从远端注册表再拉几页",
    marketplaceMoreCachedHint: "本地缓存已有更多条目",
    marketplaceExhausted: "已加载全部页",
    marketplaceExhaustedFull: "已展示全部 {total} 条 — 注册表耗尽",
    marketplaceCount: "已载入 {loaded} · 匹配 {matched} · 来源：{source}{cached}",
    marketplaceCachedSuffix: " · 缓存中",
    marketplaceNoMatches: "无匹配结果。换关键词或加载更多页。",
    marketplaceInstall: "安装",
    marketplacePickHint: "在左侧选择服务器，然后点安装。",
    marketplaceInstalled: "已安装 → {spec}",
    marketplaceInstalledBridged: "已安装并桥接 → {spec}",
    marketplaceAlready: "已安装过",
    marketplaceNeedsEnv: "需设置环境变量：{names}",
    marketplaceSourceTag: "[{source}]",
    marketplaceNoInstall: "Smithery 列表项 — 不暴露安装元数据；请直接 `npx -y @smithery/cli install {name}`",
    marketplaceFetchOnInstall: "Smithery 列表 — 安装时再拉详情。HTTP 服务映射为 streamable-http 远端；stdio 服务通过 @smithery/cli 运行。",
    marketplaceInstalledBadge: "已安装",
    marketplaceUninstall: "卸载",
    marketplaceEnvTitle: "必需的环境变量",
    marketplaceEnvHint: "下次启动 `visionox code` 之前在 shell 里设好，桥接的服务器才能正常鉴权。",
    marketplaceRestartHint: "已写入 ~/.visionox/config.json。重启 `visionox code` 后服务器才会真正桥接（热重载在路线图上）。"
  },
  memory: {
    loading: "加载记忆…",
    files: "记忆 · {count} 个文件",
    exists: "已存在",
    create: "创建",
    noFiles: "暂无记忆文件。",
    pickHint: "选择左侧的记忆文件。",
    pickDesc: "项目 项目记忆文件；全局笔记存储在 ~/.visionox/memory/。",
    chars: "{count} 个字符",
    saved: "已保存 {scope}",
    reloadHint: "在下次 /new 或会话重启时重新加载"
  },
  hooks: {
    loading: "加载钩子…",
    resolved: "已解析",
    eventMatrix: "事件矩阵",
    matrixSub: "{scripts} 个脚本 × {events} 个事件",
    noHooks: "未配置钩子。编辑下方的 JSON 以添加。",
    colScript: "脚本",
    noProject: "无活跃项目 — 在 visionox code 中打开 /dashboard 以编辑项目钩子。",
    saveReload: "保存并重载",
    discard: "放弃更改",
    savedReloaded: "已保存并重载 {scope}",
    recentRuns: "近期运行",
    noRuns: "近期会话日志中无钩子运行记录。",
    colWhen: "时间",
    colPhase: "阶段",
    colHook: "钩子",
    colOutcome: "结果"
  },
  skills: {
    loading: "加载技能…",
    filterPlaceholder: "筛选技能",
    project: "项目",
    global: "全局",
    builtin: "内置",
    newSkill: "新技能",
    noDescription: "（无描述）",
    runs7d: "次运行 · 7 天",
    pickHint: "选择左侧的技能，或在上方创建新技能。",
    readOnlyBuiltin: "只读 · 内置",
    builtinDesc: "内置技能随 Visionox-Whale 一起发布；模型会自动识别。如需自定义，请创建同名的项目或全局技能。",
    saved: "已保存 {scope}/{name}",
    deleteConfirm: "删除技能 {scope}/{name}？",
    reloadHint: "在下次 /new 或会话重启时重新加载",
    repairEnv: "修复 Skill 环境",
    repairOk: "Skill 环境已修复",
    managedBuiltin: "随程序提供",
    disabledBuiltin: "已停用随程序提供的技能；可通过“修复 Skill 环境”恢复。"
  },
  system: {
    loading: "加载健康状态…",
    failed: "健康检查失败：{error}",
    healthChecks: "健康检查",
    version: "版本",
    checking: "检查中",
    latest: "● 最新",
    outOfDate: "● 需要更新",
    versionPending: "版本检查中",
    upToDate: "已是最新",
    latestVer: "最新：{version}",
    sessions: "会话",
    ok: "● 正常",
    memory: "记忆",
    semanticIndex: "语义索引",
    built: "● 已构建",
    none: "— 无",
    runIndex: "运行 visionox index 以构建",
    usageLog: "用量日志",
    backgroundJobs: "后台任务",
    noSession: "— 无会话",
    running: "{count} 个运行中",
    attachHint: "连接会话以查看任务",
    shellSpawn: "Shell + 生成",
    paths: "路径",
    home: "主目录",
    sessionsPath: "会话",
    memoryPath: "记忆",
    semanticPath: "语义",
    usagePath: "用量"
  },
  plans: {
    loading: "加载计划…",
    failed: "计划失败：{error}",
    noPlans: "暂无当前或归档计划 — 调用 submit_plan 后会在此显示。",
    filterPlaceholder: "筛选计划",
    active: "进行中",
    pending: "待审批",
    done: "已完成",
    idle: "未开始",
    steps: "步骤",
    pickHint: "选择左侧的计划。",
    noTitle: "（无标题）",
    stepTimeline: "步骤时间线 · {done} / {total}",
    step: "步骤 {n}",
    planBody: "计划正文",
    markDone: "标记完成",
    cancelActive: "取消计划",
    confirmCancel: "确定取消当前计划？",
    confirmDelete: "确定删除该计划归档？"
  },
  tasks: {
    loading: "加载任务…",
    noTasks: "暂无定时任务。",
    title: "定时任务",
    create: "新建任务",
    save: "保存任务",
    update: "更新任务",
    taskKind: "任务类型",
    kindPrompt: "普通提示词任务",
    kindReport: "会话报告任务",
    kindSessionCleanup: "会话整理任务",
    name: "名称",
    prompt: "提示词",
    promptPlaceholder: "任务触发时，希望 Visionox-Whale 做什么？",
    executionSource: "执行方式",
    executionPrompt: "自由提示词",
    executionSkill: "Skill 模板",
    skillTemplate: "Skill 模板",
    skillTemplateUnavailable: "没有可用的兼容 Skill 定时模板。",
    skillReadOnlyHint: "此模板为只读、全局任务，每次执行都使用当前兼容 Skill 的最新流程；运行时需要已登录。",
    skillAddendum: "补充要求",
    skillAddendumPlaceholder: "可选：关注重点、排除项、输出格式……",
    skillWaitingAuth: "等待登录",
    type: "时间规则",
    interval: "间隔",
    customInterval: "自定义时间段",
    daily: "每日",
    weekly: "每周",
    dayOfWeek: "星期",
    weekdays: ["周日", "周一", "周二", "周三", "周四", "周五", "周六"],
    every: "每",
    at: "在",
    enabled: "启用",
    disabled: "停用",
    runNow: "立即运行",
    testRun: "测试运行",
    deleteConfirm: "确定删除该定时任务？",
    nextRun: "下次",
    lastRun: "上次",
    never: "从未",
    accepted: "已接收",
    skipped: "已跳过",
    rejected: "未接收",
    deferred: "等待中",
    running: "运行中",
    completed: "已完成",
    cancelled: "已取消",
    failed: "失败",
    saved: "任务已保存",
    deleted: "任务已删除",
    runAccepted: "任务已开始运行",
    runQueued: "任务已加入等待队列",
    runCompleted: "任务已完成",
    runCancelled: "任务已取消",
    runFailed: "任务运行失败",
    runSkipped: "任务已跳过",
    runRejected: "任务未被接收",
    runPending: "任务正在等待确认",
    selectHint: "选择一个任务进行编辑，或新建任务。",
    minInterval: "间隔必须在 1 分钟到 30 天之间。",
    busyHint: "定时任务需要保持软件运行；忙碌时会按触发顺序排队，前一项完成后自动开始。",
    workspace: "工作区",
    currentWorkspace: "当前",
    workspaceMismatch: "工作区已变更",
    workspaceMismatchHint: "该任务绑定到其他工作区。在切回对应工作区前，运行会被跳过。",
    workspaceScope: "任务工作区",
    workspaceScopeBound: "固定工作区",
    workspaceScopeCurrent: "跟随当前工作区",
    workspaceScopeHint: "固定任务在其他工作区会跳过；跟随任务会在运行时的当前工作区执行。",
    workspaceRebind: "重新绑定当前工作区",
    cleanupWorkspace: "整理工作区",
    cleanupWorkspaceHint: "切换工作区后任务仍会继续。会话筛选和知识文档仍归属此工作区，直到你主动重新绑定。",
    history: "最近运行",
    latestResult: "最近结果",
    manual: "手动",
    scheduled: "定时",
    noHistory: "暂无运行记录。",
    summary: "结果摘要",
    noSummary: "暂无摘要",
    duration: "耗时",
    tokens: "提示 tokens",
    cost: "费用",
    source: "触发",
    runMode: "运行模式",
    runModeAuto: "自动执行",
    runModeReadonly: "只读执行",
    runModeConfirm: "先确认",
    pendingConfirmation: "待确认",
    templateVars: "可用变量：{date}、{time}、{workspace}、{lastRunAt}、{taskName}。",
    runWindow: "运行窗口",
    weekdaysOnly: "仅工作日",
    enableWindow: "限制时间段",
    from: "从",
    to: "到",
    pendingTitle: "待确认任务",
    pendingHint: "这些任务已到触发时间，正等待手动运行。",
    reportPeriod: "报告周期",
    reportScope: "报告范围类型",
    reportDaily: "日报",
    reportWeekly: "周报",
    reportYearly: "年报",
    reportCustom: "自定义范围",
    reportToday: "今日",
    reportYesterday: "昨日",
    reportThisWeek: "本周",
    reportLastWeek: "上周",
    reportLast7Days: "最近 7 天",
    reportLast30Days: "最近 30 天",
    reportThisYear: "本年",
    reportLastYear: "上一年",
    reportFixedRange: "固定日期范围",
    reportDate: "日期",
    reportStart: "开始",
    reportEnd: "结束",
    reportExport: "同时导出到下载目录",
    reportExportPath: "导出路径",
    reportStored: "完整报告会保留在任务记录中。",
    reportExportFailed: "导出到下载目录失败：{error}",
    reportRange: "范围",
    reportSessions: "会话数",
    reportMessages: "消息数",
    reportTaskHint: "时间规则决定任务何时开始；完整报告始终保留供预览，下载目录导出为可选副本。报告范围按实际运行时间计算。",
    sessionCleanupAction: "整理动作",
    sessionCleanupPreview: "仅生成预览",
    sessionCleanupDelete: "将高置信删除项移入回收站",
    sessionCleanupStrength: "整理强度",
    sessionCleanupConservative: "保守",
    sessionCleanupStandard: "标准",
    sessionCleanupAggressive: "积极",
    sessionCleanupSemanticMode: "智能复核",
    sessionCleanupSemanticOff: "关闭",
    sessionCleanupSemanticUncertain: "仅复核不确定项",
    sessionCleanupSemanticDeep: "深度复核",
    sessionCleanupHint: "以后台维护任务运行，不会新增普通对话记录；破坏性操作会先移入本地回收站。",
    sessionCleanupPromptAddendum: "补充整理要求",
    knowledgeEnabled: "提炼详实的项目知识",
    knowledgeLookbackDays: "主题合并回溯天数",
    knowledgeAutoIndex: "知识更新后增量更新 embedding",
    knowledgeAutoIndexUnavailable: "请先保存 embedding API Key",
    knowledgeDocuments: "知识文档",
    knowledgeSessions: "知识会话",
    cleanupCandidates: "整理建议",
    cleanupDeleted: "移入回收站",
    cleanupArchive: "建议归档",
    cleanupKeep: "建议保留",
    cleanupExtract: "建议提炼",
    cleanupSemanticReviewed: "AI 复核",
    cleanupTrashRoot: "回收站",
    cleanupFailed: "失败",
    viewConversation: "查看本次对话"
  },
  semantic: {
    codeRequired: "语义 — 需要代码模式",
    indexBuilt: "索引已构建",
    noIndex: "尚无索引",
    ready: "就绪",
    setupNeeded: "需要设置",
    installOllama: "安装 Ollama",
    installOllamaDesc: "Visionox-Whale 不会为您运行包管理器。请先安装 Ollama，然后返回：",
    macWindows: "macOS / Windows：",
    download: "从 ollama.com/download 下载",
    linux: "Linux：",
    refreshHint: "安装后刷新 — 此面板将提供启动守护进程和拉取 {model} 的选项。",
    daemon: "守护进程",
    daemonDesc: "ollama 在您的 PATH 中，但 HTTP 守护进程不可达。",
    startDaemon: "启动守护进程",
    runsOllama: "以分离模式运行 ollama serve",
    model: "模型",
    modelMissing: "{model} 尚未安装。",
    modelSize: "首次拉取约 270 MB。",
    pulling: "拉取中…",
    pullModel: "拉取 {model}",
    indexStatus: "索引状态",
    builtStatus: "● 已构建",
    incompatibleStatus: "● 不兼容",
    chunks: "分块",
    files: "文件",
    dim: "维度",
    size: "大小",
    lastBuild: "上次构建",
    builtWith: "构建来源",
    currentTarget: "当前目标",
    incompatibleHint: "磁盘上的这个索引是为不同的 provider 或 model 构建的。运行“完全重建”即可替换。",
    runIndexHint: "运行索引以启用 semantic_search。",
    reIndex: "重建索引",
    build: "构建",
    rebuild: "完全重建",
    stop: "停止",
    provider: "提供方",
    providerType: "服务类型",
    openaiCompat: "OpenAI-Compatible",
    apiUrl: "API URL",
    apiKey: "API Key",
    apiKeyStoredNote: "API key 保存在 ~/.visionox/config.json —— 请勿分享该文件。",
    customRequestBody: "自定义请求体",
    invalidCustomRequestBody: "自定义请求体必须是合法 JSON：{error}",
    customRequestBodyMustBeObject: "自定义请求体必须是 JSON 对象。",
    saveBeforeIndex: "请先保存语义设置，再启动索引。",
    extraBody: "扩展请求体",
    keepExistingKey: "留空则保留现有 Key",
    remoteProvider: "远程向量服务",
    remoteProviderDesc: "在这里配置 OpenAI-Compatible embeddings 的完整 URL。Visionox-Whale 会严格使用你提供的 URL 发起请求。",
    ollama: "Ollama",
    binary: "二进制",
    found: "已找到",
    missing: "缺失",
    daemonStatus: "守护进程",
    up: "运行中",
    down: "已停止",
    pulled: "已拉取",
    indexConfig: "索引配置",
    reset: "重置",
    excludeDirs: "排除目录",
    excludeFiles: "排除文件",
    excludeExts: "排除扩展名",
    excludePatterns: "排除模式",
    glob: "glob",
    respectGitignore: "遵循 .gitignore",
    includeKnowledgeDocs: "包含 knowledge 目录中的 Markdown",
    maxFileBytes: "最大文件字节数",
    skipLarger: "跳过大于 ~{size} MiB 的文件",
    preview: "预览",
    searchPlaceholder: "描述要查找的内容 — '哪里处理中止信号'",
    searching: "搜索中…",
    results: "{count} 个结果 · {ms}ms · {model}",
    noMatches: "没有超过分数阈值的匹配。",
    previewSummary: "预览 — 将索引 {included} 个文件，跳过 {skipped} 个",
    nothingSkipped: "无跳过 — 所有遍历的文件都将被索引。",
    firstIncluded: "前 {count} 个包含的文件",
    job: "任务",
    phaseSetup: "初始化中",
    phaseScan: "扫描文件",
    phaseEmbed: "嵌入分块",
    phaseWrite: "写入索引",
    phaseDone: "完成",
    phasePartial: "部分完成",
    phaseError: "错误",
    phaseCancelled: "已停止",
    setupFailed: "初始化失败",
    stopping: "停止中",
    scanned: "已扫描 {count}",
    changed: "已变更 {count}",
    skipped: "已跳过 {count}",
    chunksProgress: "{done} / {total}（{pct}%）",
    result: "结果",
    added: "已添加 {count}",
    removed: "已移除 {count}",
    failed: "失败 {count}",
    skippedFiles: "{total} 个文件（{details}）",
    rebuildStarted: "已启动完全重建",
    incrementalStarted: "已启动增量索引",
    stopRequested: "已请求停止 — 当前分块批次将首先完成",
    startingDaemon: "正在启动 ollama 守护进程（15 秒超时）…",
    daemonUp: "守护进程已启动",
    daemonTimeout: "守护进程未在规定时间内启动 — 请手动检查 ollama serve",
    pullingModel: "正在拉取 {model} — 首次安装可能需要几分钟",
    savedConfig: "已保存 · {count} 个字段已更新 · 重新运行索引以应用",
    runningPreview: "正在对项目根目录执行干运行…",
    exclude: "排除"
  },
  modal: {
    shellTitle: "Shell 命令",
    shellBgTitle: "后台进程",
    shellSubtitle: "模型想要运行一条 Shell 命令",
    shellBgSubtitle: "长时间运行 — 批准后继续运行",
    runOnce: "运行一次",
    alwaysAllow: '始终允许 "{prefix}"',
    deny: "拒绝",
    choiceTitle: "模型需要您选择",
    typeOwn: "输入自定义回答",
    typeOwnSummary: "以上选项都不合适 — 写一个自由格式的回复。",
    typePlaceholder: "输入自由格式的回答…",
    send: "发送",
    cancel: "取消",
    cancelSummary: "放弃此问题。模型将询问您实际想要什么。",
    planTitle: "计划已提交",
    planSubtitle: "模型提出了一项计划；请审阅后选择",
    approveInstructions: "可选的最后指示 / 对开放问题的回答（Enter 发送空白）",
    refinePlaceholder: "需要更改什么？请具体说明。",
    approve: "批准",
    refine: "优化",
    sendRefinement: "发送优化",
    editTitle: "编辑待审阅",
    editSubtitle: "{path} · {remaining} / {total} 个块剩余",
    before: "修改前",
    after: "修改后",
    workspaceTitle: "模型想要切换工作区",
    workspaceSubtitle: "后续所有文件 / Shell / 记忆工具将针对新根目录解析",
    switchBtn: "切换 (Enter)",
    denyBtn: "拒绝 (Esc)",
    stepComplete: "步骤完成{counter}",
    continueBtn: "继续",
    reviseBtn: "修订…",
    stopBtn: "停止",
    revisionTitle: "模型提出了计划修订",
    sendRevision: "发送修订",
    accept: "接受",
    reject: "拒绝",
    arguments: "参数",
    revisePlaceholder: "下一步之前需要更改什么？留空则直接继续。",
    pickerFilter: "过滤…",
    pickerEmpty: "暂无内容。",
    pickerLoadMore: "加载更多",
    pickerPick: "打开",
    pickerInstall: "安装",
    pickerUninstall: "卸载",
    pickerRename: "重命名…",
    pickerNew: "新建…",
    pickerNewPlaceholder: "名称（留空使用默认）",
    viewerClose: "关闭"
  }
};

// dashboard/src/i18n/index.ts
var t4 = createT({ en, "zh-CN": zhCN });

// node_modules/preact/compat/dist/compat.module.js
function g3(n3, t5) {
  for (var e3 in t5) n3[e3] = t5[e3];
  return n3;
}
function E2(n3, t5) {
  for (var e3 in n3) if ("__source" !== e3 && !(e3 in t5)) return true;
  for (var r3 in t5) if ("__source" !== r3 && n3[r3] !== t5[r3]) return true;
  return false;
}
function C3(n3, t5) {
  var e3 = t5(), r3 = d2({ t: { __: e3, u: t5 } }), u3 = r3[0].t, o3 = r3[1];
  return _2(function() {
    u3.__ = e3, u3.u = t5, R2(u3) && o3({ t: u3 });
  }, [n3, e3, t5]), y2(function() {
    return R2(u3) && o3({ t: u3 }), n3(function() {
      R2(u3) && o3({ t: u3 });
    });
  }, [n3]), e3;
}
function R2(n3) {
  try {
    return !((t5 = n3.__) === (e3 = n3.u()) && (0 !== t5 || 1 / t5 == 1 / e3) || t5 != t5 && e3 != e3);
  } catch (n4) {
    return true;
  }
  var t5, e3;
}
function x3(n3) {
  n3();
}
function w3(n3) {
  return n3;
}
function k3() {
  return [false, x3];
}
var I2 = _2;
function M2(n3, t5) {
  this.props = n3, this.context = t5;
}
function N2(n3, e3) {
  function r3(n4) {
    var t5 = this.props.ref;
    return t5 != n4.ref && t5 && ("function" == typeof t5 ? t5(null) : t5.current = null), e3 ? !e3(this.props, n4) || t5 != n4.ref : E2(this.props, n4);
  }
  function u3(e4) {
    return this.shouldComponentUpdate = r3, k(n3, e4);
  }
  return u3.displayName = "Memo(" + (n3.displayName || n3.name) + ")", u3.__f = u3.prototype.isReactComponent = true, u3.type = n3, u3;
}
(M2.prototype = new C()).isPureReactComponent = true, M2.prototype.shouldComponentUpdate = function(n3, t5) {
  return E2(this.props, n3) || E2(this.state, t5);
};
var T3 = l.__b;
l.__b = function(n3) {
  n3.type && n3.type.__f && n3.ref && (n3.props.ref = n3.ref, n3.ref = null), T3 && T3(n3);
};
var A3 = "undefined" != typeof Symbol && Symbol.for && Symbol.for("react.forward_ref") || 3911;
function D3(n3) {
  function t5(t6) {
    var e3 = g3({}, t6);
    return delete e3.ref, n3(e3, t6.ref || null);
  }
  return t5.$$typeof = A3, t5.render = n3, t5.prototype.isReactComponent = t5.__f = true, t5.displayName = "ForwardRef(" + (n3.displayName || n3.name) + ")", t5;
}
var F3 = function(n3, t5) {
  return null == n3 ? null : F(F(n3).map(t5));
}, L2 = { map: F3, forEach: F3, count: function(n3) {
  return n3 ? F(n3).length : 0;
}, only: function(n3) {
  var t5 = F(n3);
  if (1 !== t5.length) throw "Children.only";
  return t5[0];
}, toArray: F }, O2 = l.__e;
l.__e = function(n3, t5, e3, r3) {
  if (n3.then) {
    for (var u3, o3 = t5; o3 = o3.__; ) if ((u3 = o3.__c) && u3.__c) return null == t5.__e && (t5.__e = e3.__e, t5.__k = e3.__k), u3.__c(n3, t5);
  }
  O2(n3, t5, e3, r3);
};
var U2 = l.unmount;
function V2(n3, t5, e3) {
  return n3 && (n3.__c && n3.__c.__H && (n3.__c.__H.__.forEach(function(n4) {
    "function" == typeof n4.__c && n4.__c();
  }), n3.__c.__H = null), null != (n3 = g3({}, n3)).__c && (n3.__c.__P === e3 && (n3.__c.__P = t5), n3.__c.__e = true, n3.__c = null), n3.__k = n3.__k && n3.__k.map(function(n4) {
    return V2(n4, t5, e3);
  })), n3;
}
function W2(n3, t5, e3) {
  return n3 && e3 && (n3.__v = null, n3.__k = n3.__k && n3.__k.map(function(n4) {
    return W2(n4, t5, e3);
  }), n3.__c && n3.__c.__P === t5 && (n3.__e && e3.appendChild(n3.__e), n3.__c.__e = true, n3.__c.__P = e3)), n3;
}
function P3() {
  this.__u = 0, this.o = null, this.__b = null;
}
function j3(n3) {
  var t5 = n3.__ && n3.__.__c;
  return t5 && t5.__a && t5.__a(n3);
}
function z3(n3) {
  var e3, r3, u3, o3 = null;
  function i3(i4) {
    if (e3 || (e3 = n3()).then(function(n4) {
      n4 && (o3 = n4.default || n4), u3 = true;
    }, function(n4) {
      r3 = n4, u3 = true;
    }), r3) throw r3;
    if (!u3) throw e3;
    return o3 ? k(o3, i4) : null;
  }
  return i3.displayName = "Lazy", i3.__f = true, i3;
}
function B3() {
  this.i = null, this.l = null;
}
l.unmount = function(n3) {
  var t5 = n3.__c;
  t5 && (t5.__z = true), t5 && t5.__R && t5.__R(), t5 && 32 & n3.__u && (n3.type = null), U2 && U2(n3);
}, (P3.prototype = new C()).__c = function(n3, t5) {
  var e3 = t5.__c, r3 = this;
  null == r3.o && (r3.o = []), r3.o.push(e3);
  var u3 = j3(r3.__v), o3 = false, i3 = function() {
    o3 || r3.__z || (o3 = true, e3.__R = null, u3 ? u3(c3) : c3());
  };
  e3.__R = i3;
  var l3 = e3.__P;
  e3.__P = null;
  var c3 = function() {
    if (!--r3.__u) {
      if (r3.state.__a) {
        var n4 = r3.state.__a;
        r3.__v.__k[0] = W2(n4, n4.__c.__P, n4.__c.__O);
      }
      var t6;
      for (r3.setState({ __a: r3.__b = null }); t6 = r3.o.pop(); ) t6.__P = l3, t6.forceUpdate();
    }
  };
  r3.__u++ || 32 & t5.__u || r3.setState({ __a: r3.__b = r3.__v.__k[0] }), n3.then(i3, i3);
}, P3.prototype.componentWillUnmount = function() {
  this.o = [];
}, P3.prototype.render = function(n3, e3) {
  if (this.__b) {
    if (this.__v.__k) {
      var r3 = document.createElement("div"), o3 = this.__v.__k[0].__c;
      this.__v.__k[0] = V2(this.__b, r3, o3.__O = o3.__P);
    }
    this.__b = null;
  }
  var i3 = e3.__a && k(S, null, n3.fallback);
  return i3 && (i3.__u &= -33), [k(S, null, e3.__a ? null : n3.children), i3];
};
var H2 = function(n3, t5, e3) {
  if (++e3[1] === e3[0] && n3.l.delete(t5), n3.props.revealOrder && ("t" !== n3.props.revealOrder[0] || !n3.l.size)) for (e3 = n3.i; e3; ) {
    for (; e3.length > 3; ) e3.pop()();
    if (e3[1] < e3[0]) break;
    n3.i = e3 = e3[2];
  }
};
function Z(n3) {
  return this.getChildContext = function() {
    return n3.context;
  }, n3.children;
}
function Y(n3) {
  var e3 = this, r3 = n3.h;
  if (e3.componentWillUnmount = function() {
    R(null, e3.v), e3.v = null, e3.h = null;
  }, e3.h && e3.h !== r3 && e3.componentWillUnmount(), !e3.v) {
    for (var u3 = e3.__v; null !== u3 && !u3.__m && null !== u3.__; ) u3 = u3.__;
    e3.h = r3, e3.v = { nodeType: 1, parentNode: r3, childNodes: [], __k: { __m: u3.__m }, contains: function() {
      return true;
    }, namespaceURI: r3.namespaceURI, insertBefore: function(n4, t5) {
      this.childNodes.push(n4), e3.h.insertBefore(n4, t5);
    }, removeChild: function(n4) {
      this.childNodes.splice(this.childNodes.indexOf(n4) >>> 1, 1), e3.h.removeChild(n4);
    } };
  }
  R(k(Z, { context: e3.context }, n3.__v), e3.v);
}
function $2(n3, e3) {
  var r3 = k(Y, { __v: n3, h: e3 });
  return r3.containerInfo = e3, r3;
}
(B3.prototype = new C()).__a = function(n3) {
  var t5 = this, e3 = j3(t5.__v), r3 = t5.l.get(n3);
  return r3[0]++, function(u3) {
    var o3 = function() {
      t5.props.revealOrder ? (r3.push(u3), H2(t5, n3, r3)) : u3();
    };
    e3 ? e3(o3) : o3();
  };
}, B3.prototype.render = function(n3) {
  this.i = null, this.l = /* @__PURE__ */ new Map();
  var t5 = F(n3.children);
  n3.revealOrder && "b" === n3.revealOrder[0] && t5.reverse();
  for (var e3 = t5.length; e3--; ) this.l.set(t5[e3], this.i = [1, 0, this.i]);
  return n3.children;
}, B3.prototype.componentDidUpdate = B3.prototype.componentDidMount = function() {
  var n3 = this;
  this.l.forEach(function(t5, e3) {
    H2(n3, e3, t5);
  });
};
var q3 = "undefined" != typeof Symbol && Symbol.for && Symbol.for("react.element") || 60103, G2 = /^(?:accent|alignment|arabic|baseline|cap|clip(?!PathU)|color|dominant|fill|flood|font|glyph(?!R)|horiz|image(!S)|letter|lighting|marker(?!H|W|U)|overline|paint|pointer|shape|stop|strikethrough|stroke|text(?!L)|transform|underline|unicode|units|v|vector|vert|word|writing|x(?!C))[A-Z]/, J2 = /^on(Ani|Tra|Tou|BeforeInp|Compo)/, K2 = /[A-Z0-9]/g, Q2 = "undefined" != typeof document, X2 = function(n3) {
  return ("undefined" != typeof Symbol && "symbol" == typeof Symbol() ? /fil|che|rad/ : /fil|che|ra/).test(n3);
};
function nn(n3, t5, e3) {
  return null == t5.__k && (t5.textContent = ""), R(n3, t5), "function" == typeof e3 && e3(), n3 ? n3.__c : null;
}
function tn(n3, t5, e3) {
  return U(n3, t5), "function" == typeof e3 && e3(), n3 ? n3.__c : null;
}
C.prototype.isReactComponent = true, ["componentWillMount", "componentWillReceiveProps", "componentWillUpdate"].forEach(function(t5) {
  Object.defineProperty(C.prototype, t5, { configurable: true, get: function() {
    return this["UNSAFE_" + t5];
  }, set: function(n3) {
    Object.defineProperty(this, t5, { configurable: true, writable: true, value: n3 });
  } });
});
var en2 = l.event;
l.event = function(n3) {
  return en2 && (n3 = en2(n3)), n3.persist = function() {
  }, n3.isPropagationStopped = function() {
    return this.cancelBubble;
  }, n3.isDefaultPrevented = function() {
    return this.defaultPrevented;
  }, n3.nativeEvent = n3;
};
var rn, un = { configurable: true, get: function() {
  return this.class;
} }, on = l.vnode;
l.vnode = function(n3) {
  "string" == typeof n3.type && function(n4) {
    var t5 = n4.props, e3 = n4.type, u3 = {}, o3 = -1 == e3.indexOf("-");
    for (var i3 in t5) {
      var l3 = t5[i3];
      if (!("value" === i3 && "defaultValue" in t5 && null == l3 || Q2 && "children" === i3 && "noscript" === e3 || "class" === i3 || "className" === i3)) {
        var c3 = i3.toLowerCase();
        "defaultValue" === i3 && "value" in t5 && null == t5.value ? i3 = "value" : "download" === i3 && true === l3 ? l3 = "" : "translate" === c3 && "no" === l3 ? l3 = false : "o" === c3[0] && "n" === c3[1] ? "ondoubleclick" === c3 ? i3 = "ondblclick" : "onchange" !== c3 || "input" !== e3 && "textarea" !== e3 || X2(t5.type) ? "onfocus" === c3 ? i3 = "onfocusin" : "onblur" === c3 ? i3 = "onfocusout" : J2.test(i3) && (i3 = c3) : c3 = i3 = "oninput" : o3 && G2.test(i3) ? i3 = i3.replace(K2, "-$&").toLowerCase() : null === l3 && (l3 = void 0), "oninput" === c3 && u3[i3 = c3] && (i3 = "oninputCapture"), u3[i3] = l3;
      }
    }
    "select" == e3 && (u3.multiple && Array.isArray(u3.value) && (u3.value = F(t5.children).forEach(function(n5) {
      n5.props.selected = -1 != u3.value.indexOf(n5.props.value);
    })), null != u3.defaultValue && (u3.value = F(t5.children).forEach(function(n5) {
      n5.props.selected = u3.multiple ? -1 != u3.defaultValue.indexOf(n5.props.value) : u3.defaultValue == n5.props.value;
    }))), t5.class && !t5.className ? (u3.class = t5.class, Object.defineProperty(u3, "className", un)) : t5.className && (u3.class = u3.className = t5.className), n4.props = u3;
  }(n3), n3.$$typeof = q3, on && on(n3);
};
var ln = l.__r;
l.__r = function(n3) {
  ln && ln(n3), rn = n3.__c;
};
var cn = l.diffed;
l.diffed = function(n3) {
  cn && cn(n3);
  var t5 = n3.props, e3 = n3.__e;
  null != e3 && "textarea" === n3.type && "value" in t5 && t5.value !== e3.value && (e3.value = null == t5.value ? "" : t5.value), rn = null;
};
var fn = { ReactCurrentDispatcher: { current: { readContext: function(n3) {
  return rn.__n[n3.__c].props.value;
}, useCallback: q2, useContext: x2, useDebugValue: P2, useDeferredValue: w3, useEffect: y2, useId: g2, useImperativeHandle: F2, useInsertionEffect: I2, useLayoutEffect: _2, useMemo: T2, useReducer: h2, useRef: A2, useState: d2, useSyncExternalStore: C3, useTransition: k3 } } }, an = "18.3.1";
function sn(n3) {
  return k.bind(null, n3);
}
function hn(n3) {
  return !!n3 && n3.$$typeof === q3;
}
function vn(n3) {
  return hn(n3) && n3.type === S;
}
function dn(n3) {
  return !!n3 && "string" == typeof n3.displayName && 0 == n3.displayName.indexOf("Memo(");
}
function mn(n3) {
  return hn(n3) ? W.apply(null, arguments) : n3;
}
function pn(n3) {
  return !!n3.__k && (R(null, n3), true);
}
function yn(n3) {
  return n3 && (n3.base || 1 === n3.nodeType && n3) || null;
}
var _n = function(n3, t5) {
  return n3(t5);
}, bn = function(n3, t5) {
  var r3 = l.debounceRendering;
  l.debounceRendering = function(n4) {
    return n4();
  };
  var u3 = n3(t5);
  return l.debounceRendering = r3, u3;
}, Sn = hn, gn = { useState: d2, useId: g2, useReducer: h2, useEffect: y2, useLayoutEffect: _2, useInsertionEffect: I2, useTransition: k3, useDeferredValue: w3, useSyncExternalStore: C3, startTransition: x3, useRef: A2, useImperativeHandle: F2, useMemo: T2, useCallback: q2, useContext: x2, useDebugValue: P2, version: "18.3.1", Children: L2, render: nn, hydrate: tn, unmountComponentAtNode: pn, createPortal: $2, createElement: k, createContext: X, createFactory: sn, cloneElement: mn, createRef: M, Fragment: S, isValidElement: hn, isElement: Sn, isFragment: vn, isMemo: dn, findDOMNode: yn, Component: C, PureComponent: M2, memo: N2, forwardRef: D3, flushSync: bn, unstable_batchedUpdates: _n, StrictMode: S, Suspense: P3, SuspenseList: B3, lazy: z3, __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED: fn };

// node_modules/marked/lib/marked.esm.js
var _a;
function _getDefaults() {
  return {
    async: false,
    breaks: false,
    extensions: null,
    gfm: true,
    hooks: null,
    pedantic: false,
    renderer: null,
    silent: false,
    tokenizer: null,
    walkTokens: null
  };
}
var _defaults = _getDefaults();
function changeDefaults(newDefaults) {
  _defaults = newDefaults;
}
var noopTest = { exec: () => null };
function edit(regex, opt = "") {
  let source = typeof regex === "string" ? regex : regex.source;
  const obj = {
    replace: (name, val) => {
      let valSource = typeof val === "string" ? val : val.source;
      valSource = valSource.replace(other.caret, "$1");
      source = source.replace(name, valSource);
      return obj;
    },
    getRegex: () => {
      return new RegExp(source, opt);
    }
  };
  return obj;
}
var other = {
  codeRemoveIndent: /^(?: {1,4}| {0,3}\t)/gm,
  outputLinkReplace: /\\([\[\]])/g,
  indentCodeCompensation: /^(\s+)(?:```)/,
  beginningSpace: /^\s+/,
  endingHash: /#$/,
  startingSpaceChar: /^ /,
  endingSpaceChar: / $/,
  nonSpaceChar: /[^ ]/,
  newLineCharGlobal: /\n/g,
  tabCharGlobal: /\t/g,
  multipleSpaceGlobal: /\s+/g,
  blankLine: /^[ \t]*$/,
  doubleBlankLine: /\n[ \t]*\n[ \t]*$/,
  blockquoteStart: /^ {0,3}>/,
  blockquoteSetextReplace: /\n {0,3}((?:=+|-+) *)(?=\n|$)/g,
  blockquoteSetextReplace2: /^ {0,3}>[ \t]?/gm,
  listReplaceTabs: /^\t+/,
  listReplaceNesting: /^ {1,4}(?=( {4})*[^ ])/g,
  listIsTask: /^\[[ xX]\] /,
  listReplaceTask: /^\[[ xX]\] +/,
  anyLine: /\n.*\n/,
  hrefBrackets: /^<(.*)>$/,
  tableDelimiter: /[:|]/,
  tableAlignChars: /^\||\| *$/g,
  tableRowBlankLine: /\n[ \t]*$/,
  tableAlignRight: /^ *-+: *$/,
  tableAlignCenter: /^ *:-+: *$/,
  tableAlignLeft: /^ *:-+ *$/,
  startATag: /^<a /i,
  endATag: /^<\/a>/i,
  startPreScriptTag: /^<(pre|code|kbd|script)(\s|>)/i,
  endPreScriptTag: /^<\/(pre|code|kbd|script)(\s|>)/i,
  startAngleBracket: /^</,
  endAngleBracket: />$/,
  pedanticHrefTitle: /^([^'"]*[^\s])\s+(['"])(.*)\2/,
  unicodeAlphaNumeric: /[\p{L}\p{N}]/u,
  escapeTest: /[&<>"']/,
  escapeReplace: /[&<>"']/g,
  escapeTestNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/,
  escapeReplaceNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g,
  unescapeTest: /&(#(?:\d+)|(?:#x[0-9A-Fa-f]+)|(?:\w+));?/ig,
  caret: /(^|[^\[])\^/g,
  percentDecode: /%25/g,
  findPipe: /\|/g,
  splitPipe: / \|/,
  slashPipe: /\\\|/g,
  carriageReturn: /\r\n|\r/g,
  spaceLine: /^ +$/gm,
  notSpaceStart: /^\S*/,
  endingNewline: /\n$/,
  listItemRegex: (bull) => new RegExp(`^( {0,3}${bull})((?:[	 ][^\\n]*)?(?:\\n|$))`),
  nextBulletRegex: (indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}(?:[*+-]|\\d{1,9}[.)])((?:[ 	][^\\n]*)?(?:\\n|$))`),
  hrRegex: (indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}((?:- *){3,}|(?:_ *){3,}|(?:\\* *){3,})(?:\\n+|$)`),
  fencesBeginRegex: (indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}(?:\`\`\`|~~~)`),
  headingBeginRegex: (indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}#`),
  htmlBeginRegex: (indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}<(?:[a-z].*>|!--)`, "i")
};
var newline = /^(?:[ \t]*(?:\n|$))+/;
var blockCode = /^((?: {4}| {0,3}\t)[^\n]+(?:\n(?:[ \t]*(?:\n|$))*)?)+/;
var fences = /^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}\1[~`]* *(?=\n|$)|$)/;
var hr = /^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/;
var heading = /^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/;
var bullet = /(?:[*+-]|\d{1,9}[.)])/;
var lheadingCore = /^(?!bull |blockCode|fences|blockquote|heading|html|table)((?:.|\n(?!\s*?\n|bull |blockCode|fences|blockquote|heading|html|table))+?)\n {0,3}(=+|-+) *(?:\n+|$)/;
var lheading = edit(lheadingCore).replace(/bull/g, bullet).replace(/blockCode/g, /(?: {4}| {0,3}\t)/).replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/).replace(/heading/g, / {0,3}#{1,6}/).replace(/html/g, / {0,3}<[^\n>]+>\n/).replace(/\|table/g, "").getRegex();
var lheadingGfm = edit(lheadingCore).replace(/bull/g, bullet).replace(/blockCode/g, /(?: {4}| {0,3}\t)/).replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/).replace(/heading/g, / {0,3}#{1,6}/).replace(/html/g, / {0,3}<[^\n>]+>\n/).replace(/table/g, / {0,3}\|?(?:[:\- ]*\|)+[\:\- ]*\n/).getRegex();
var _paragraph = /^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html|table| +\n)[^\n]+)*)/;
var blockText = /^[^\n]+/;
var _blockLabel = /(?!\s*\])(?:\\.|[^\[\]\\])+/;
var def = edit(/^ {0,3}\[(label)\]: *(?:\n[ \t]*)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n[ \t]*)?| *\n[ \t]*)(title))? *(?:\n+|$)/).replace("label", _blockLabel).replace("title", /(?:"(?:\\"?|[^"\\])*"|'[^'\n]*(?:\n[^'\n]+)*\n?'|\([^()]*\))/).getRegex();
var list = edit(/^( {0,3}bull)([ \t][^\n]+?)?(?:\n|$)/).replace(/bull/g, bullet).getRegex();
var _tag = "address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul";
var _comment = /<!--(?:-?>|[\s\S]*?(?:-->|$))/;
var html3 = edit(
  "^ {0,3}(?:<(script|pre|style|textarea)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n+|$)|comment[^\\n]*(\\n+|$)|<\\?[\\s\\S]*?(?:\\?>\\n*|$)|<![A-Z][\\s\\S]*?(?:>\\n*|$)|<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>\\n*|$)|</?(tag)(?: +|\\n|/?>)[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|<(?!script|pre|style|textarea)([a-z][\\w-]*)(?:attribute)*? */?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|</(?!script|pre|style|textarea)[a-z][\\w-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$))",
  "i"
).replace("comment", _comment).replace("tag", _tag).replace("attribute", / +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?/).getRegex();
var paragraph = edit(_paragraph).replace("hr", hr).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("|table", "").replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)]) ").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", _tag).getRegex();
var blockquote = edit(/^( {0,3}> ?(paragraph|[^\n]*)(?:\n|$))+/).replace("paragraph", paragraph).getRegex();
var blockNormal = {
  blockquote,
  code: blockCode,
  def,
  fences,
  heading,
  hr,
  html: html3,
  lheading,
  list,
  newline,
  paragraph,
  table: noopTest,
  text: blockText
};
var gfmTable = edit(
  "^ *([^\\n ].*)\\n {0,3}((?:\\| *)?:?-+:? *(?:\\| *:?-+:? *)*(?:\\| *)?)(?:\\n((?:(?! *\\n|hr|heading|blockquote|code|fences|list|html).*(?:\\n|$))*)\\n*|$)"
).replace("hr", hr).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("blockquote", " {0,3}>").replace("code", "(?: {4}| {0,3}	)[^\\n]").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)]) ").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", _tag).getRegex();
var blockGfm = {
  ...blockNormal,
  lheading: lheadingGfm,
  table: gfmTable,
  paragraph: edit(_paragraph).replace("hr", hr).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("table", gfmTable).replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)]) ").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", _tag).getRegex()
};
var blockPedantic = {
  ...blockNormal,
  html: edit(
    `^ *(?:comment *(?:\\n|\\s*$)|<(tag)[\\s\\S]+?</\\1> *(?:\\n{2,}|\\s*$)|<tag(?:"[^"]*"|'[^']*'|\\s[^'"/>\\s]*)*?/?> *(?:\\n{2,}|\\s*$))`
  ).replace("comment", _comment).replace(/tag/g, "(?!(?:a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)\\b)\\w+(?!:|[^\\w\\s@]*@)\\b").getRegex(),
  def: /^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +(["(][^\n]+[")]))? *(?:\n+|$)/,
  heading: /^(#{1,6})(.*)(?:\n+|$)/,
  fences: noopTest,
  // fences not supported
  lheading: /^(.+?)\n {0,3}(=+|-+) *(?:\n+|$)/,
  paragraph: edit(_paragraph).replace("hr", hr).replace("heading", " *#{1,6} *[^\n]").replace("lheading", lheading).replace("|table", "").replace("blockquote", " {0,3}>").replace("|fences", "").replace("|list", "").replace("|html", "").replace("|tag", "").getRegex()
};
var escape = /^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/;
var inlineCode = /^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/;
var br = /^( {2,}|\\)\n(?!\s*$)/;
var inlineText = /^(`+|[^`])(?:(?= {2,}\n)|[\s\S]*?(?:(?=[\\<!\[`*_]|\b_|$)|[^ ](?= {2,}\n)))/;
var _punctuation = /[\p{P}\p{S}]/u;
var _punctuationOrSpace = /[\s\p{P}\p{S}]/u;
var _notPunctuationOrSpace = /[^\s\p{P}\p{S}]/u;
var punctuation = edit(/^((?![*_])punctSpace)/, "u").replace(/punctSpace/g, _punctuationOrSpace).getRegex();
var _punctuationGfmStrongEm = /(?!~)[\p{P}\p{S}]/u;
var _punctuationOrSpaceGfmStrongEm = /(?!~)[\s\p{P}\p{S}]/u;
var _notPunctuationOrSpaceGfmStrongEm = /(?:[^\s\p{P}\p{S}]|~)/u;
var blockSkip = /\[[^[\]]*?\]\((?:\\.|[^\\\(\)]|\((?:\\.|[^\\\(\)])*\))*\)|`[^`]*?`|<[^<>]*?>/g;
var emStrongLDelimCore = /^(?:\*+(?:((?!\*)punct)|[^\s*]))|^_+(?:((?!_)punct)|([^\s_]))/;
var emStrongLDelim = edit(emStrongLDelimCore, "u").replace(/punct/g, _punctuation).getRegex();
var emStrongLDelimGfm = edit(emStrongLDelimCore, "u").replace(/punct/g, _punctuationGfmStrongEm).getRegex();
var emStrongRDelimAstCore = "^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)punct(\\*+)(?=[\\s]|$)|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)|(?!\\*)punctSpace(\\*+)(?=notPunctSpace)|[\\s](\\*+)(?!\\*)(?=punct)|(?!\\*)punct(\\*+)(?!\\*)(?=punct)|notPunctSpace(\\*+)(?=notPunctSpace)";
var emStrongRDelimAst = edit(emStrongRDelimAstCore, "gu").replace(/notPunctSpace/g, _notPunctuationOrSpace).replace(/punctSpace/g, _punctuationOrSpace).replace(/punct/g, _punctuation).getRegex();
var emStrongRDelimAstGfm = edit(emStrongRDelimAstCore, "gu").replace(/notPunctSpace/g, _notPunctuationOrSpaceGfmStrongEm).replace(/punctSpace/g, _punctuationOrSpaceGfmStrongEm).replace(/punct/g, _punctuationGfmStrongEm).getRegex();
var emStrongRDelimUnd = edit(
  "^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)punct(_+)(?=[\\s]|$)|notPunctSpace(_+)(?!_)(?=punctSpace|$)|(?!_)punctSpace(_+)(?=notPunctSpace)|[\\s](_+)(?!_)(?=punct)|(?!_)punct(_+)(?!_)(?=punct)",
  "gu"
).replace(/notPunctSpace/g, _notPunctuationOrSpace).replace(/punctSpace/g, _punctuationOrSpace).replace(/punct/g, _punctuation).getRegex();
var anyPunctuation = edit(/\\(punct)/, "gu").replace(/punct/g, _punctuation).getRegex();
var autolink = edit(/^<(scheme:[^\s\x00-\x1f<>]*|email)>/).replace("scheme", /[a-zA-Z][a-zA-Z0-9+.-]{1,31}/).replace("email", /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/).getRegex();
var _inlineComment = edit(_comment).replace("(?:-->|$)", "-->").getRegex();
var tag = edit(
  "^comment|^</[a-zA-Z][\\w:-]*\\s*>|^<[a-zA-Z][\\w-]*(?:attribute)*?\\s*/?>|^<\\?[\\s\\S]*?\\?>|^<![a-zA-Z]+\\s[\\s\\S]*?>|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>"
).replace("comment", _inlineComment).replace("attribute", /\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/).getRegex();
var _inlineLabel = /(?:\[(?:\\.|[^\[\]\\])*\]|\\.|`[^`]*`|[^\[\]\\`])*?/;
var link = edit(/^!?\[(label)\]\(\s*(href)(?:(?:[ \t]*(?:\n[ \t]*)?)(title))?\s*\)/).replace("label", _inlineLabel).replace("href", /<(?:\\.|[^\n<>\\])+>|[^ \t\n\x00-\x1f]*/).replace("title", /"(?:\\"?|[^"\\])*"|'(?:\\'?|[^'\\])*'|\((?:\\\)?|[^)\\])*\)/).getRegex();
var reflink = edit(/^!?\[(label)\]\[(ref)\]/).replace("label", _inlineLabel).replace("ref", _blockLabel).getRegex();
var nolink = edit(/^!?\[(ref)\](?:\[\])?/).replace("ref", _blockLabel).getRegex();
var reflinkSearch = edit("reflink|nolink(?!\\()", "g").replace("reflink", reflink).replace("nolink", nolink).getRegex();
var inlineNormal = {
  _backpedal: noopTest,
  // only used for GFM url
  anyPunctuation,
  autolink,
  blockSkip,
  br,
  code: inlineCode,
  del: noopTest,
  emStrongLDelim,
  emStrongRDelimAst,
  emStrongRDelimUnd,
  escape,
  link,
  nolink,
  punctuation,
  reflink,
  reflinkSearch,
  tag,
  text: inlineText,
  url: noopTest
};
var inlinePedantic = {
  ...inlineNormal,
  link: edit(/^!?\[(label)\]\((.*?)\)/).replace("label", _inlineLabel).getRegex(),
  reflink: edit(/^!?\[(label)\]\s*\[([^\]]*)\]/).replace("label", _inlineLabel).getRegex()
};
var inlineGfm = {
  ...inlineNormal,
  emStrongRDelimAst: emStrongRDelimAstGfm,
  emStrongLDelim: emStrongLDelimGfm,
  url: edit(/^((?:ftp|https?):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/, "i").replace("email", /[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![-_])/).getRegex(),
  _backpedal: /(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/,
  del: /^(~~?)(?=[^\s~])((?:\\.|[^\\])*?(?:\\.|[^\s~\\]))\1(?=[^~]|$)/,
  text: /^([`~]+|[^`~])(?:(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|https?:\/\/|ftp:\/\/|www\.|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)))/
};
var inlineBreaks = {
  ...inlineGfm,
  br: edit(br).replace("{2,}", "*").getRegex(),
  text: edit(inlineGfm.text).replace("\\b_", "\\b_| {2,}\\n").replace(/\{2,\}/g, "*").getRegex()
};
var block = {
  normal: blockNormal,
  gfm: blockGfm,
  pedantic: blockPedantic
};
var inline = {
  normal: inlineNormal,
  gfm: inlineGfm,
  breaks: inlineBreaks,
  pedantic: inlinePedantic
};
var escapeReplacements = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
};
var getEscapeReplacement = (ch) => escapeReplacements[ch];
function escape2(html22, encode) {
  if (encode) {
    if (other.escapeTest.test(html22)) {
      return html22.replace(other.escapeReplace, getEscapeReplacement);
    }
  } else {
    if (other.escapeTestNoEncode.test(html22)) {
      return html22.replace(other.escapeReplaceNoEncode, getEscapeReplacement);
    }
  }
  return html22;
}
function cleanUrl(href) {
  try {
    href = encodeURI(href).replace(other.percentDecode, "%");
  } catch {
    return null;
  }
  return href;
}
function splitCells(tableRow, count) {
  const row = tableRow.replace(other.findPipe, (match, offset, str) => {
    let escaped = false;
    let curr = offset;
    while (--curr >= 0 && str[curr] === "\\") escaped = !escaped;
    if (escaped) {
      return "|";
    } else {
      return " |";
    }
  }), cells = row.split(other.splitPipe);
  let i3 = 0;
  if (!cells[0].trim()) {
    cells.shift();
  }
  if (cells.length > 0 && !cells.at(-1)?.trim()) {
    cells.pop();
  }
  if (count) {
    if (cells.length > count) {
      cells.splice(count);
    } else {
      while (cells.length < count) cells.push("");
    }
  }
  for (; i3 < cells.length; i3++) {
    cells[i3] = cells[i3].trim().replace(other.slashPipe, "|");
  }
  return cells;
}
function rtrim(str, c3, invert) {
  const l3 = str.length;
  if (l3 === 0) {
    return "";
  }
  let suffLen = 0;
  while (suffLen < l3) {
    const currChar = str.charAt(l3 - suffLen - 1);
    if (currChar === c3 && !invert) {
      suffLen++;
    } else if (currChar !== c3 && invert) {
      suffLen++;
    } else {
      break;
    }
  }
  return str.slice(0, l3 - suffLen);
}
function findClosingBracket(str, b3) {
  if (str.indexOf(b3[1]) === -1) {
    return -1;
  }
  let level = 0;
  for (let i3 = 0; i3 < str.length; i3++) {
    if (str[i3] === "\\") {
      i3++;
    } else if (str[i3] === b3[0]) {
      level++;
    } else if (str[i3] === b3[1]) {
      level--;
      if (level < 0) {
        return i3;
      }
    }
  }
  if (level > 0) {
    return -2;
  }
  return -1;
}
function outputLink(cap, link2, raw, lexer2, rules) {
  const href = link2.href;
  const title = link2.title || null;
  const text = cap[1].replace(rules.other.outputLinkReplace, "$1");
  lexer2.state.inLink = true;
  const token = {
    type: cap[0].charAt(0) === "!" ? "image" : "link",
    raw,
    href,
    title,
    text,
    tokens: lexer2.inlineTokens(text)
  };
  lexer2.state.inLink = false;
  return token;
}
function indentCodeCompensation(raw, text, rules) {
  const matchIndentToCode = raw.match(rules.other.indentCodeCompensation);
  if (matchIndentToCode === null) {
    return text;
  }
  const indentToCode = matchIndentToCode[1];
  return text.split("\n").map((node) => {
    const matchIndentInNode = node.match(rules.other.beginningSpace);
    if (matchIndentInNode === null) {
      return node;
    }
    const [indentInNode] = matchIndentInNode;
    if (indentInNode.length >= indentToCode.length) {
      return node.slice(indentToCode.length);
    }
    return node;
  }).join("\n");
}
var _Tokenizer = class {
  // set by the lexer
  constructor(options2) {
    __publicField(this, "options");
    __publicField(this, "rules");
    // set by the lexer
    __publicField(this, "lexer");
    this.options = options2 || _defaults;
  }
  space(src) {
    const cap = this.rules.block.newline.exec(src);
    if (cap && cap[0].length > 0) {
      return {
        type: "space",
        raw: cap[0]
      };
    }
  }
  code(src) {
    const cap = this.rules.block.code.exec(src);
    if (cap) {
      const text = cap[0].replace(this.rules.other.codeRemoveIndent, "");
      return {
        type: "code",
        raw: cap[0],
        codeBlockStyle: "indented",
        text: !this.options.pedantic ? rtrim(text, "\n") : text
      };
    }
  }
  fences(src) {
    const cap = this.rules.block.fences.exec(src);
    if (cap) {
      const raw = cap[0];
      const text = indentCodeCompensation(raw, cap[3] || "", this.rules);
      return {
        type: "code",
        raw,
        lang: cap[2] ? cap[2].trim().replace(this.rules.inline.anyPunctuation, "$1") : cap[2],
        text
      };
    }
  }
  heading(src) {
    const cap = this.rules.block.heading.exec(src);
    if (cap) {
      let text = cap[2].trim();
      if (this.rules.other.endingHash.test(text)) {
        const trimmed = rtrim(text, "#");
        if (this.options.pedantic) {
          text = trimmed.trim();
        } else if (!trimmed || this.rules.other.endingSpaceChar.test(trimmed)) {
          text = trimmed.trim();
        }
      }
      return {
        type: "heading",
        raw: cap[0],
        depth: cap[1].length,
        text,
        tokens: this.lexer.inline(text)
      };
    }
  }
  hr(src) {
    const cap = this.rules.block.hr.exec(src);
    if (cap) {
      return {
        type: "hr",
        raw: rtrim(cap[0], "\n")
      };
    }
  }
  blockquote(src) {
    const cap = this.rules.block.blockquote.exec(src);
    if (cap) {
      let lines = rtrim(cap[0], "\n").split("\n");
      let raw = "";
      let text = "";
      const tokens = [];
      while (lines.length > 0) {
        let inBlockquote = false;
        const currentLines = [];
        let i3;
        for (i3 = 0; i3 < lines.length; i3++) {
          if (this.rules.other.blockquoteStart.test(lines[i3])) {
            currentLines.push(lines[i3]);
            inBlockquote = true;
          } else if (!inBlockquote) {
            currentLines.push(lines[i3]);
          } else {
            break;
          }
        }
        lines = lines.slice(i3);
        const currentRaw = currentLines.join("\n");
        const currentText = currentRaw.replace(this.rules.other.blockquoteSetextReplace, "\n    $1").replace(this.rules.other.blockquoteSetextReplace2, "");
        raw = raw ? `${raw}
${currentRaw}` : currentRaw;
        text = text ? `${text}
${currentText}` : currentText;
        const top = this.lexer.state.top;
        this.lexer.state.top = true;
        this.lexer.blockTokens(currentText, tokens, true);
        this.lexer.state.top = top;
        if (lines.length === 0) {
          break;
        }
        const lastToken = tokens.at(-1);
        if (lastToken?.type === "code") {
          break;
        } else if (lastToken?.type === "blockquote") {
          const oldToken = lastToken;
          const newText = oldToken.raw + "\n" + lines.join("\n");
          const newToken = this.blockquote(newText);
          tokens[tokens.length - 1] = newToken;
          raw = raw.substring(0, raw.length - oldToken.raw.length) + newToken.raw;
          text = text.substring(0, text.length - oldToken.text.length) + newToken.text;
          break;
        } else if (lastToken?.type === "list") {
          const oldToken = lastToken;
          const newText = oldToken.raw + "\n" + lines.join("\n");
          const newToken = this.list(newText);
          tokens[tokens.length - 1] = newToken;
          raw = raw.substring(0, raw.length - lastToken.raw.length) + newToken.raw;
          text = text.substring(0, text.length - oldToken.raw.length) + newToken.raw;
          lines = newText.substring(tokens.at(-1).raw.length).split("\n");
          continue;
        }
      }
      return {
        type: "blockquote",
        raw,
        tokens,
        text
      };
    }
  }
  list(src) {
    let cap = this.rules.block.list.exec(src);
    if (cap) {
      let bull = cap[1].trim();
      const isordered = bull.length > 1;
      const list2 = {
        type: "list",
        raw: "",
        ordered: isordered,
        start: isordered ? +bull.slice(0, -1) : "",
        loose: false,
        items: []
      };
      bull = isordered ? `\\d{1,9}\\${bull.slice(-1)}` : `\\${bull}`;
      if (this.options.pedantic) {
        bull = isordered ? bull : "[*+-]";
      }
      const itemRegex = this.rules.other.listItemRegex(bull);
      let endsWithBlankLine = false;
      while (src) {
        let endEarly = false;
        let raw = "";
        let itemContents = "";
        if (!(cap = itemRegex.exec(src))) {
          break;
        }
        if (this.rules.block.hr.test(src)) {
          break;
        }
        raw = cap[0];
        src = src.substring(raw.length);
        let line = cap[2].split("\n", 1)[0].replace(this.rules.other.listReplaceTabs, (t5) => " ".repeat(3 * t5.length));
        let nextLine = src.split("\n", 1)[0];
        let blankLine = !line.trim();
        let indent = 0;
        if (this.options.pedantic) {
          indent = 2;
          itemContents = line.trimStart();
        } else if (blankLine) {
          indent = cap[1].length + 1;
        } else {
          indent = cap[2].search(this.rules.other.nonSpaceChar);
          indent = indent > 4 ? 1 : indent;
          itemContents = line.slice(indent);
          indent += cap[1].length;
        }
        if (blankLine && this.rules.other.blankLine.test(nextLine)) {
          raw += nextLine + "\n";
          src = src.substring(nextLine.length + 1);
          endEarly = true;
        }
        if (!endEarly) {
          const nextBulletRegex = this.rules.other.nextBulletRegex(indent);
          const hrRegex = this.rules.other.hrRegex(indent);
          const fencesBeginRegex = this.rules.other.fencesBeginRegex(indent);
          const headingBeginRegex = this.rules.other.headingBeginRegex(indent);
          const htmlBeginRegex = this.rules.other.htmlBeginRegex(indent);
          while (src) {
            const rawLine = src.split("\n", 1)[0];
            let nextLineWithoutTabs;
            nextLine = rawLine;
            if (this.options.pedantic) {
              nextLine = nextLine.replace(this.rules.other.listReplaceNesting, "  ");
              nextLineWithoutTabs = nextLine;
            } else {
              nextLineWithoutTabs = nextLine.replace(this.rules.other.tabCharGlobal, "    ");
            }
            if (fencesBeginRegex.test(nextLine)) {
              break;
            }
            if (headingBeginRegex.test(nextLine)) {
              break;
            }
            if (htmlBeginRegex.test(nextLine)) {
              break;
            }
            if (nextBulletRegex.test(nextLine)) {
              break;
            }
            if (hrRegex.test(nextLine)) {
              break;
            }
            if (nextLineWithoutTabs.search(this.rules.other.nonSpaceChar) >= indent || !nextLine.trim()) {
              itemContents += "\n" + nextLineWithoutTabs.slice(indent);
            } else {
              if (blankLine) {
                break;
              }
              if (line.replace(this.rules.other.tabCharGlobal, "    ").search(this.rules.other.nonSpaceChar) >= 4) {
                break;
              }
              if (fencesBeginRegex.test(line)) {
                break;
              }
              if (headingBeginRegex.test(line)) {
                break;
              }
              if (hrRegex.test(line)) {
                break;
              }
              itemContents += "\n" + nextLine;
            }
            if (!blankLine && !nextLine.trim()) {
              blankLine = true;
            }
            raw += rawLine + "\n";
            src = src.substring(rawLine.length + 1);
            line = nextLineWithoutTabs.slice(indent);
          }
        }
        if (!list2.loose) {
          if (endsWithBlankLine) {
            list2.loose = true;
          } else if (this.rules.other.doubleBlankLine.test(raw)) {
            endsWithBlankLine = true;
          }
        }
        let istask = null;
        let ischecked;
        if (this.options.gfm) {
          istask = this.rules.other.listIsTask.exec(itemContents);
          if (istask) {
            ischecked = istask[0] !== "[ ] ";
            itemContents = itemContents.replace(this.rules.other.listReplaceTask, "");
          }
        }
        list2.items.push({
          type: "list_item",
          raw,
          task: !!istask,
          checked: ischecked,
          loose: false,
          text: itemContents,
          tokens: []
        });
        list2.raw += raw;
      }
      const lastItem = list2.items.at(-1);
      if (lastItem) {
        lastItem.raw = lastItem.raw.trimEnd();
        lastItem.text = lastItem.text.trimEnd();
      } else {
        return;
      }
      list2.raw = list2.raw.trimEnd();
      for (let i3 = 0; i3 < list2.items.length; i3++) {
        this.lexer.state.top = false;
        list2.items[i3].tokens = this.lexer.blockTokens(list2.items[i3].text, []);
        if (!list2.loose) {
          const spacers = list2.items[i3].tokens.filter((t5) => t5.type === "space");
          const hasMultipleLineBreaks = spacers.length > 0 && spacers.some((t5) => this.rules.other.anyLine.test(t5.raw));
          list2.loose = hasMultipleLineBreaks;
        }
      }
      if (list2.loose) {
        for (let i3 = 0; i3 < list2.items.length; i3++) {
          list2.items[i3].loose = true;
        }
      }
      return list2;
    }
  }
  html(src) {
    const cap = this.rules.block.html.exec(src);
    if (cap) {
      const token = {
        type: "html",
        block: true,
        raw: cap[0],
        pre: cap[1] === "pre" || cap[1] === "script" || cap[1] === "style",
        text: cap[0]
      };
      return token;
    }
  }
  def(src) {
    const cap = this.rules.block.def.exec(src);
    if (cap) {
      const tag2 = cap[1].toLowerCase().replace(this.rules.other.multipleSpaceGlobal, " ");
      const href = cap[2] ? cap[2].replace(this.rules.other.hrefBrackets, "$1").replace(this.rules.inline.anyPunctuation, "$1") : "";
      const title = cap[3] ? cap[3].substring(1, cap[3].length - 1).replace(this.rules.inline.anyPunctuation, "$1") : cap[3];
      return {
        type: "def",
        tag: tag2,
        raw: cap[0],
        href,
        title
      };
    }
  }
  table(src) {
    const cap = this.rules.block.table.exec(src);
    if (!cap) {
      return;
    }
    if (!this.rules.other.tableDelimiter.test(cap[2])) {
      return;
    }
    const headers = splitCells(cap[1]);
    const aligns = cap[2].replace(this.rules.other.tableAlignChars, "").split("|");
    const rows = cap[3]?.trim() ? cap[3].replace(this.rules.other.tableRowBlankLine, "").split("\n") : [];
    const item = {
      type: "table",
      raw: cap[0],
      header: [],
      align: [],
      rows: []
    };
    if (headers.length !== aligns.length) {
      return;
    }
    for (const align of aligns) {
      if (this.rules.other.tableAlignRight.test(align)) {
        item.align.push("right");
      } else if (this.rules.other.tableAlignCenter.test(align)) {
        item.align.push("center");
      } else if (this.rules.other.tableAlignLeft.test(align)) {
        item.align.push("left");
      } else {
        item.align.push(null);
      }
    }
    for (let i3 = 0; i3 < headers.length; i3++) {
      item.header.push({
        text: headers[i3],
        tokens: this.lexer.inline(headers[i3]),
        header: true,
        align: item.align[i3]
      });
    }
    for (const row of rows) {
      item.rows.push(splitCells(row, item.header.length).map((cell, i3) => {
        return {
          text: cell,
          tokens: this.lexer.inline(cell),
          header: false,
          align: item.align[i3]
        };
      }));
    }
    return item;
  }
  lheading(src) {
    const cap = this.rules.block.lheading.exec(src);
    if (cap) {
      return {
        type: "heading",
        raw: cap[0],
        depth: cap[2].charAt(0) === "=" ? 1 : 2,
        text: cap[1],
        tokens: this.lexer.inline(cap[1])
      };
    }
  }
  paragraph(src) {
    const cap = this.rules.block.paragraph.exec(src);
    if (cap) {
      const text = cap[1].charAt(cap[1].length - 1) === "\n" ? cap[1].slice(0, -1) : cap[1];
      return {
        type: "paragraph",
        raw: cap[0],
        text,
        tokens: this.lexer.inline(text)
      };
    }
  }
  text(src) {
    const cap = this.rules.block.text.exec(src);
    if (cap) {
      return {
        type: "text",
        raw: cap[0],
        text: cap[0],
        tokens: this.lexer.inline(cap[0])
      };
    }
  }
  escape(src) {
    const cap = this.rules.inline.escape.exec(src);
    if (cap) {
      return {
        type: "escape",
        raw: cap[0],
        text: cap[1]
      };
    }
  }
  tag(src) {
    const cap = this.rules.inline.tag.exec(src);
    if (cap) {
      if (!this.lexer.state.inLink && this.rules.other.startATag.test(cap[0])) {
        this.lexer.state.inLink = true;
      } else if (this.lexer.state.inLink && this.rules.other.endATag.test(cap[0])) {
        this.lexer.state.inLink = false;
      }
      if (!this.lexer.state.inRawBlock && this.rules.other.startPreScriptTag.test(cap[0])) {
        this.lexer.state.inRawBlock = true;
      } else if (this.lexer.state.inRawBlock && this.rules.other.endPreScriptTag.test(cap[0])) {
        this.lexer.state.inRawBlock = false;
      }
      return {
        type: "html",
        raw: cap[0],
        inLink: this.lexer.state.inLink,
        inRawBlock: this.lexer.state.inRawBlock,
        block: false,
        text: cap[0]
      };
    }
  }
  link(src) {
    const cap = this.rules.inline.link.exec(src);
    if (cap) {
      const trimmedUrl = cap[2].trim();
      if (!this.options.pedantic && this.rules.other.startAngleBracket.test(trimmedUrl)) {
        if (!this.rules.other.endAngleBracket.test(trimmedUrl)) {
          return;
        }
        const rtrimSlash = rtrim(trimmedUrl.slice(0, -1), "\\");
        if ((trimmedUrl.length - rtrimSlash.length) % 2 === 0) {
          return;
        }
      } else {
        const lastParenIndex = findClosingBracket(cap[2], "()");
        if (lastParenIndex === -2) {
          return;
        }
        if (lastParenIndex > -1) {
          const start = cap[0].indexOf("!") === 0 ? 5 : 4;
          const linkLen = start + cap[1].length + lastParenIndex;
          cap[2] = cap[2].substring(0, lastParenIndex);
          cap[0] = cap[0].substring(0, linkLen).trim();
          cap[3] = "";
        }
      }
      let href = cap[2];
      let title = "";
      if (this.options.pedantic) {
        const link2 = this.rules.other.pedanticHrefTitle.exec(href);
        if (link2) {
          href = link2[1];
          title = link2[3];
        }
      } else {
        title = cap[3] ? cap[3].slice(1, -1) : "";
      }
      href = href.trim();
      if (this.rules.other.startAngleBracket.test(href)) {
        if (this.options.pedantic && !this.rules.other.endAngleBracket.test(trimmedUrl)) {
          href = href.slice(1);
        } else {
          href = href.slice(1, -1);
        }
      }
      return outputLink(cap, {
        href: href ? href.replace(this.rules.inline.anyPunctuation, "$1") : href,
        title: title ? title.replace(this.rules.inline.anyPunctuation, "$1") : title
      }, cap[0], this.lexer, this.rules);
    }
  }
  reflink(src, links) {
    let cap;
    if ((cap = this.rules.inline.reflink.exec(src)) || (cap = this.rules.inline.nolink.exec(src))) {
      const linkString = (cap[2] || cap[1]).replace(this.rules.other.multipleSpaceGlobal, " ");
      const link2 = links[linkString.toLowerCase()];
      if (!link2) {
        const text = cap[0].charAt(0);
        return {
          type: "text",
          raw: text,
          text
        };
      }
      return outputLink(cap, link2, cap[0], this.lexer, this.rules);
    }
  }
  emStrong(src, maskedSrc, prevChar = "") {
    let match = this.rules.inline.emStrongLDelim.exec(src);
    if (!match) return;
    if (match[3] && prevChar.match(this.rules.other.unicodeAlphaNumeric)) return;
    const nextChar = match[1] || match[2] || "";
    if (!nextChar || !prevChar || this.rules.inline.punctuation.exec(prevChar)) {
      const lLength = [...match[0]].length - 1;
      let rDelim, rLength, delimTotal = lLength, midDelimTotal = 0;
      const endReg = match[0][0] === "*" ? this.rules.inline.emStrongRDelimAst : this.rules.inline.emStrongRDelimUnd;
      endReg.lastIndex = 0;
      maskedSrc = maskedSrc.slice(-1 * src.length + lLength);
      while ((match = endReg.exec(maskedSrc)) != null) {
        rDelim = match[1] || match[2] || match[3] || match[4] || match[5] || match[6];
        if (!rDelim) continue;
        rLength = [...rDelim].length;
        if (match[3] || match[4]) {
          delimTotal += rLength;
          continue;
        } else if (match[5] || match[6]) {
          if (lLength % 3 && !((lLength + rLength) % 3)) {
            midDelimTotal += rLength;
            continue;
          }
        }
        delimTotal -= rLength;
        if (delimTotal > 0) continue;
        rLength = Math.min(rLength, rLength + delimTotal + midDelimTotal);
        const lastCharLength = [...match[0]][0].length;
        const raw = src.slice(0, lLength + match.index + lastCharLength + rLength);
        if (Math.min(lLength, rLength) % 2) {
          const text2 = raw.slice(1, -1);
          return {
            type: "em",
            raw,
            text: text2,
            tokens: this.lexer.inlineTokens(text2)
          };
        }
        const text = raw.slice(2, -2);
        return {
          type: "strong",
          raw,
          text,
          tokens: this.lexer.inlineTokens(text)
        };
      }
    }
  }
  codespan(src) {
    const cap = this.rules.inline.code.exec(src);
    if (cap) {
      let text = cap[2].replace(this.rules.other.newLineCharGlobal, " ");
      const hasNonSpaceChars = this.rules.other.nonSpaceChar.test(text);
      const hasSpaceCharsOnBothEnds = this.rules.other.startingSpaceChar.test(text) && this.rules.other.endingSpaceChar.test(text);
      if (hasNonSpaceChars && hasSpaceCharsOnBothEnds) {
        text = text.substring(1, text.length - 1);
      }
      return {
        type: "codespan",
        raw: cap[0],
        text
      };
    }
  }
  br(src) {
    const cap = this.rules.inline.br.exec(src);
    if (cap) {
      return {
        type: "br",
        raw: cap[0]
      };
    }
  }
  del(src) {
    const cap = this.rules.inline.del.exec(src);
    if (cap) {
      return {
        type: "del",
        raw: cap[0],
        text: cap[2],
        tokens: this.lexer.inlineTokens(cap[2])
      };
    }
  }
  autolink(src) {
    const cap = this.rules.inline.autolink.exec(src);
    if (cap) {
      let text, href;
      if (cap[2] === "@") {
        text = cap[1];
        href = "mailto:" + text;
      } else {
        text = cap[1];
        href = text;
      }
      return {
        type: "link",
        raw: cap[0],
        text,
        href,
        tokens: [
          {
            type: "text",
            raw: text,
            text
          }
        ]
      };
    }
  }
  url(src) {
    let cap;
    if (cap = this.rules.inline.url.exec(src)) {
      let text, href;
      if (cap[2] === "@") {
        text = cap[0];
        href = "mailto:" + text;
      } else {
        let prevCapZero;
        do {
          prevCapZero = cap[0];
          cap[0] = this.rules.inline._backpedal.exec(cap[0])?.[0] ?? "";
        } while (prevCapZero !== cap[0]);
        text = cap[0];
        if (cap[1] === "www.") {
          href = "http://" + cap[0];
        } else {
          href = cap[0];
        }
      }
      return {
        type: "link",
        raw: cap[0],
        text,
        href,
        tokens: [
          {
            type: "text",
            raw: text,
            text
          }
        ]
      };
    }
  }
  inlineText(src) {
    const cap = this.rules.inline.text.exec(src);
    if (cap) {
      const escaped = this.lexer.state.inRawBlock;
      return {
        type: "text",
        raw: cap[0],
        text: cap[0],
        escaped
      };
    }
  }
};
var _Lexer = class __Lexer {
  constructor(options2) {
    __publicField(this, "tokens");
    __publicField(this, "options");
    __publicField(this, "state");
    __publicField(this, "tokenizer");
    __publicField(this, "inlineQueue");
    this.tokens = [];
    this.tokens.links = /* @__PURE__ */ Object.create(null);
    this.options = options2 || _defaults;
    this.options.tokenizer = this.options.tokenizer || new _Tokenizer();
    this.tokenizer = this.options.tokenizer;
    this.tokenizer.options = this.options;
    this.tokenizer.lexer = this;
    this.inlineQueue = [];
    this.state = {
      inLink: false,
      inRawBlock: false,
      top: true
    };
    const rules = {
      other,
      block: block.normal,
      inline: inline.normal
    };
    if (this.options.pedantic) {
      rules.block = block.pedantic;
      rules.inline = inline.pedantic;
    } else if (this.options.gfm) {
      rules.block = block.gfm;
      if (this.options.breaks) {
        rules.inline = inline.breaks;
      } else {
        rules.inline = inline.gfm;
      }
    }
    this.tokenizer.rules = rules;
  }
  /**
   * Expose Rules
   */
  static get rules() {
    return {
      block,
      inline
    };
  }
  /**
   * Static Lex Method
   */
  static lex(src, options2) {
    const lexer2 = new __Lexer(options2);
    return lexer2.lex(src);
  }
  /**
   * Static Lex Inline Method
   */
  static lexInline(src, options2) {
    const lexer2 = new __Lexer(options2);
    return lexer2.inlineTokens(src);
  }
  /**
   * Preprocessing
   */
  lex(src) {
    src = src.replace(other.carriageReturn, "\n");
    this.blockTokens(src, this.tokens);
    for (let i3 = 0; i3 < this.inlineQueue.length; i3++) {
      const next = this.inlineQueue[i3];
      this.inlineTokens(next.src, next.tokens);
    }
    this.inlineQueue = [];
    return this.tokens;
  }
  blockTokens(src, tokens = [], lastParagraphClipped = false) {
    if (this.options.pedantic) {
      src = src.replace(other.tabCharGlobal, "    ").replace(other.spaceLine, "");
    }
    while (src) {
      let token;
      if (this.options.extensions?.block?.some((extTokenizer) => {
        if (token = extTokenizer.call({ lexer: this }, src, tokens)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          return true;
        }
        return false;
      })) {
        continue;
      }
      if (token = this.tokenizer.space(src)) {
        src = src.substring(token.raw.length);
        const lastToken = tokens.at(-1);
        if (token.raw.length === 1 && lastToken !== void 0) {
          lastToken.raw += "\n";
        } else {
          tokens.push(token);
        }
        continue;
      }
      if (token = this.tokenizer.code(src)) {
        src = src.substring(token.raw.length);
        const lastToken = tokens.at(-1);
        if (lastToken?.type === "paragraph" || lastToken?.type === "text") {
          lastToken.raw += "\n" + token.raw;
          lastToken.text += "\n" + token.text;
          this.inlineQueue.at(-1).src = lastToken.text;
        } else {
          tokens.push(token);
        }
        continue;
      }
      if (token = this.tokenizer.fences(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.heading(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.hr(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.blockquote(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.list(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.html(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.def(src)) {
        src = src.substring(token.raw.length);
        const lastToken = tokens.at(-1);
        if (lastToken?.type === "paragraph" || lastToken?.type === "text") {
          lastToken.raw += "\n" + token.raw;
          lastToken.text += "\n" + token.raw;
          this.inlineQueue.at(-1).src = lastToken.text;
        } else if (!this.tokens.links[token.tag]) {
          this.tokens.links[token.tag] = {
            href: token.href,
            title: token.title
          };
        }
        continue;
      }
      if (token = this.tokenizer.table(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.lheading(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      let cutSrc = src;
      if (this.options.extensions?.startBlock) {
        let startIndex = Infinity;
        const tempSrc = src.slice(1);
        let tempStart;
        this.options.extensions.startBlock.forEach((getStartIndex) => {
          tempStart = getStartIndex.call({ lexer: this }, tempSrc);
          if (typeof tempStart === "number" && tempStart >= 0) {
            startIndex = Math.min(startIndex, tempStart);
          }
        });
        if (startIndex < Infinity && startIndex >= 0) {
          cutSrc = src.substring(0, startIndex + 1);
        }
      }
      if (this.state.top && (token = this.tokenizer.paragraph(cutSrc))) {
        const lastToken = tokens.at(-1);
        if (lastParagraphClipped && lastToken?.type === "paragraph") {
          lastToken.raw += "\n" + token.raw;
          lastToken.text += "\n" + token.text;
          this.inlineQueue.pop();
          this.inlineQueue.at(-1).src = lastToken.text;
        } else {
          tokens.push(token);
        }
        lastParagraphClipped = cutSrc.length !== src.length;
        src = src.substring(token.raw.length);
        continue;
      }
      if (token = this.tokenizer.text(src)) {
        src = src.substring(token.raw.length);
        const lastToken = tokens.at(-1);
        if (lastToken?.type === "text") {
          lastToken.raw += "\n" + token.raw;
          lastToken.text += "\n" + token.text;
          this.inlineQueue.pop();
          this.inlineQueue.at(-1).src = lastToken.text;
        } else {
          tokens.push(token);
        }
        continue;
      }
      if (src) {
        const errMsg = "Infinite loop on byte: " + src.charCodeAt(0);
        if (this.options.silent) {
          console.error(errMsg);
          break;
        } else {
          throw new Error(errMsg);
        }
      }
    }
    this.state.top = true;
    return tokens;
  }
  inline(src, tokens = []) {
    this.inlineQueue.push({ src, tokens });
    return tokens;
  }
  /**
   * Lexing/Compiling
   */
  inlineTokens(src, tokens = []) {
    let maskedSrc = src;
    let match = null;
    if (this.tokens.links) {
      const links = Object.keys(this.tokens.links);
      if (links.length > 0) {
        while ((match = this.tokenizer.rules.inline.reflinkSearch.exec(maskedSrc)) != null) {
          if (links.includes(match[0].slice(match[0].lastIndexOf("[") + 1, -1))) {
            maskedSrc = maskedSrc.slice(0, match.index) + "[" + "a".repeat(match[0].length - 2) + "]" + maskedSrc.slice(this.tokenizer.rules.inline.reflinkSearch.lastIndex);
          }
        }
      }
    }
    while ((match = this.tokenizer.rules.inline.anyPunctuation.exec(maskedSrc)) != null) {
      maskedSrc = maskedSrc.slice(0, match.index) + "++" + maskedSrc.slice(this.tokenizer.rules.inline.anyPunctuation.lastIndex);
    }
    while ((match = this.tokenizer.rules.inline.blockSkip.exec(maskedSrc)) != null) {
      maskedSrc = maskedSrc.slice(0, match.index) + "[" + "a".repeat(match[0].length - 2) + "]" + maskedSrc.slice(this.tokenizer.rules.inline.blockSkip.lastIndex);
    }
    let keepPrevChar = false;
    let prevChar = "";
    while (src) {
      if (!keepPrevChar) {
        prevChar = "";
      }
      keepPrevChar = false;
      let token;
      if (this.options.extensions?.inline?.some((extTokenizer) => {
        if (token = extTokenizer.call({ lexer: this }, src, tokens)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          return true;
        }
        return false;
      })) {
        continue;
      }
      if (token = this.tokenizer.escape(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.tag(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.link(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.reflink(src, this.tokens.links)) {
        src = src.substring(token.raw.length);
        const lastToken = tokens.at(-1);
        if (token.type === "text" && lastToken?.type === "text") {
          lastToken.raw += token.raw;
          lastToken.text += token.text;
        } else {
          tokens.push(token);
        }
        continue;
      }
      if (token = this.tokenizer.emStrong(src, maskedSrc, prevChar)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.codespan(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.br(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.del(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.autolink(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (!this.state.inLink && (token = this.tokenizer.url(src))) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      let cutSrc = src;
      if (this.options.extensions?.startInline) {
        let startIndex = Infinity;
        const tempSrc = src.slice(1);
        let tempStart;
        this.options.extensions.startInline.forEach((getStartIndex) => {
          tempStart = getStartIndex.call({ lexer: this }, tempSrc);
          if (typeof tempStart === "number" && tempStart >= 0) {
            startIndex = Math.min(startIndex, tempStart);
          }
        });
        if (startIndex < Infinity && startIndex >= 0) {
          cutSrc = src.substring(0, startIndex + 1);
        }
      }
      if (token = this.tokenizer.inlineText(cutSrc)) {
        src = src.substring(token.raw.length);
        if (token.raw.slice(-1) !== "_") {
          prevChar = token.raw.slice(-1);
        }
        keepPrevChar = true;
        const lastToken = tokens.at(-1);
        if (lastToken?.type === "text") {
          lastToken.raw += token.raw;
          lastToken.text += token.text;
        } else {
          tokens.push(token);
        }
        continue;
      }
      if (src) {
        const errMsg = "Infinite loop on byte: " + src.charCodeAt(0);
        if (this.options.silent) {
          console.error(errMsg);
          break;
        } else {
          throw new Error(errMsg);
        }
      }
    }
    return tokens;
  }
};
var _Renderer = class {
  // set by the parser
  constructor(options2) {
    __publicField(this, "options");
    __publicField(this, "parser");
    this.options = options2 || _defaults;
  }
  space(token) {
    return "";
  }
  code({ text, lang, escaped }) {
    const langString = (lang || "").match(other.notSpaceStart)?.[0];
    const code = text.replace(other.endingNewline, "") + "\n";
    if (!langString) {
      return "<pre><code>" + (escaped ? code : escape2(code, true)) + "</code></pre>\n";
    }
    return '<pre><code class="language-' + escape2(langString) + '">' + (escaped ? code : escape2(code, true)) + "</code></pre>\n";
  }
  blockquote({ tokens }) {
    const body = this.parser.parse(tokens);
    return `<blockquote>
${body}</blockquote>
`;
  }
  html({ text }) {
    return text;
  }
  heading({ tokens, depth }) {
    return `<h${depth}>${this.parser.parseInline(tokens)}</h${depth}>
`;
  }
  hr(token) {
    return "<hr>\n";
  }
  list(token) {
    const ordered = token.ordered;
    const start = token.start;
    let body = "";
    for (let j4 = 0; j4 < token.items.length; j4++) {
      const item = token.items[j4];
      body += this.listitem(item);
    }
    const type = ordered ? "ol" : "ul";
    const startAttr = ordered && start !== 1 ? ' start="' + start + '"' : "";
    return "<" + type + startAttr + ">\n" + body + "</" + type + ">\n";
  }
  listitem(item) {
    let itemBody = "";
    if (item.task) {
      const checkbox = this.checkbox({ checked: !!item.checked });
      if (item.loose) {
        if (item.tokens[0]?.type === "paragraph") {
          item.tokens[0].text = checkbox + " " + item.tokens[0].text;
          if (item.tokens[0].tokens && item.tokens[0].tokens.length > 0 && item.tokens[0].tokens[0].type === "text") {
            item.tokens[0].tokens[0].text = checkbox + " " + escape2(item.tokens[0].tokens[0].text);
            item.tokens[0].tokens[0].escaped = true;
          }
        } else {
          item.tokens.unshift({
            type: "text",
            raw: checkbox + " ",
            text: checkbox + " ",
            escaped: true
          });
        }
      } else {
        itemBody += checkbox + " ";
      }
    }
    itemBody += this.parser.parse(item.tokens, !!item.loose);
    return `<li>${itemBody}</li>
`;
  }
  checkbox({ checked }) {
    return "<input " + (checked ? 'checked="" ' : "") + 'disabled="" type="checkbox">';
  }
  paragraph({ tokens }) {
    return `<p>${this.parser.parseInline(tokens)}</p>
`;
  }
  table(token) {
    let header = "";
    let cell = "";
    for (let j4 = 0; j4 < token.header.length; j4++) {
      cell += this.tablecell(token.header[j4]);
    }
    header += this.tablerow({ text: cell });
    let body = "";
    for (let j4 = 0; j4 < token.rows.length; j4++) {
      const row = token.rows[j4];
      cell = "";
      for (let k4 = 0; k4 < row.length; k4++) {
        cell += this.tablecell(row[k4]);
      }
      body += this.tablerow({ text: cell });
    }
    if (body) body = `<tbody>${body}</tbody>`;
    return "<table>\n<thead>\n" + header + "</thead>\n" + body + "</table>\n";
  }
  tablerow({ text }) {
    return `<tr>
${text}</tr>
`;
  }
  tablecell(token) {
    const content = this.parser.parseInline(token.tokens);
    const type = token.header ? "th" : "td";
    const tag2 = token.align ? `<${type} align="${token.align}">` : `<${type}>`;
    return tag2 + content + `</${type}>
`;
  }
  /**
   * span level renderer
   */
  strong({ tokens }) {
    return `<strong>${this.parser.parseInline(tokens)}</strong>`;
  }
  em({ tokens }) {
    return `<em>${this.parser.parseInline(tokens)}</em>`;
  }
  codespan({ text }) {
    return `<code>${escape2(text, true)}</code>`;
  }
  br(token) {
    return "<br>";
  }
  del({ tokens }) {
    return `<del>${this.parser.parseInline(tokens)}</del>`;
  }
  link({ href, title, tokens }) {
    const text = this.parser.parseInline(tokens);
    const cleanHref = cleanUrl(href);
    if (cleanHref === null) {
      return text;
    }
    href = cleanHref;
    let out = '<a href="' + href + '"';
    if (title) {
      out += ' title="' + escape2(title) + '"';
    }
    out += ">" + text + "</a>";
    return out;
  }
  image({ href, title, text, tokens }) {
    if (tokens) {
      text = this.parser.parseInline(tokens, this.parser.textRenderer);
    }
    const cleanHref = cleanUrl(href);
    if (cleanHref === null) {
      return escape2(text);
    }
    href = cleanHref;
    let out = `<img src="${href}" alt="${text}"`;
    if (title) {
      out += ` title="${escape2(title)}"`;
    }
    out += ">";
    return out;
  }
  text(token) {
    return "tokens" in token && token.tokens ? this.parser.parseInline(token.tokens) : "escaped" in token && token.escaped ? token.text : escape2(token.text);
  }
};
var _TextRenderer = class {
  // no need for block level renderers
  strong({ text }) {
    return text;
  }
  em({ text }) {
    return text;
  }
  codespan({ text }) {
    return text;
  }
  del({ text }) {
    return text;
  }
  html({ text }) {
    return text;
  }
  text({ text }) {
    return text;
  }
  link({ text }) {
    return "" + text;
  }
  image({ text }) {
    return "" + text;
  }
  br() {
    return "";
  }
};
var _Parser = class __Parser {
  constructor(options2) {
    __publicField(this, "options");
    __publicField(this, "renderer");
    __publicField(this, "textRenderer");
    this.options = options2 || _defaults;
    this.options.renderer = this.options.renderer || new _Renderer();
    this.renderer = this.options.renderer;
    this.renderer.options = this.options;
    this.renderer.parser = this;
    this.textRenderer = new _TextRenderer();
  }
  /**
   * Static Parse Method
   */
  static parse(tokens, options2) {
    const parser2 = new __Parser(options2);
    return parser2.parse(tokens);
  }
  /**
   * Static Parse Inline Method
   */
  static parseInline(tokens, options2) {
    const parser2 = new __Parser(options2);
    return parser2.parseInline(tokens);
  }
  /**
   * Parse Loop
   */
  parse(tokens, top = true) {
    let out = "";
    for (let i3 = 0; i3 < tokens.length; i3++) {
      const anyToken = tokens[i3];
      if (this.options.extensions?.renderers?.[anyToken.type]) {
        const genericToken = anyToken;
        const ret = this.options.extensions.renderers[genericToken.type].call({ parser: this }, genericToken);
        if (ret !== false || !["space", "hr", "heading", "code", "table", "blockquote", "list", "html", "paragraph", "text"].includes(genericToken.type)) {
          out += ret || "";
          continue;
        }
      }
      const token = anyToken;
      switch (token.type) {
        case "space": {
          out += this.renderer.space(token);
          continue;
        }
        case "hr": {
          out += this.renderer.hr(token);
          continue;
        }
        case "heading": {
          out += this.renderer.heading(token);
          continue;
        }
        case "code": {
          out += this.renderer.code(token);
          continue;
        }
        case "table": {
          out += this.renderer.table(token);
          continue;
        }
        case "blockquote": {
          out += this.renderer.blockquote(token);
          continue;
        }
        case "list": {
          out += this.renderer.list(token);
          continue;
        }
        case "html": {
          out += this.renderer.html(token);
          continue;
        }
        case "paragraph": {
          out += this.renderer.paragraph(token);
          continue;
        }
        case "text": {
          let textToken = token;
          let body = this.renderer.text(textToken);
          while (i3 + 1 < tokens.length && tokens[i3 + 1].type === "text") {
            textToken = tokens[++i3];
            body += "\n" + this.renderer.text(textToken);
          }
          if (top) {
            out += this.renderer.paragraph({
              type: "paragraph",
              raw: body,
              text: body,
              tokens: [{ type: "text", raw: body, text: body, escaped: true }]
            });
          } else {
            out += body;
          }
          continue;
        }
        default: {
          const errMsg = 'Token with "' + token.type + '" type was not found.';
          if (this.options.silent) {
            console.error(errMsg);
            return "";
          } else {
            throw new Error(errMsg);
          }
        }
      }
    }
    return out;
  }
  /**
   * Parse Inline Tokens
   */
  parseInline(tokens, renderer2 = this.renderer) {
    let out = "";
    for (let i3 = 0; i3 < tokens.length; i3++) {
      const anyToken = tokens[i3];
      if (this.options.extensions?.renderers?.[anyToken.type]) {
        const ret = this.options.extensions.renderers[anyToken.type].call({ parser: this }, anyToken);
        if (ret !== false || !["escape", "html", "link", "image", "strong", "em", "codespan", "br", "del", "text"].includes(anyToken.type)) {
          out += ret || "";
          continue;
        }
      }
      const token = anyToken;
      switch (token.type) {
        case "escape": {
          out += renderer2.text(token);
          break;
        }
        case "html": {
          out += renderer2.html(token);
          break;
        }
        case "link": {
          out += renderer2.link(token);
          break;
        }
        case "image": {
          out += renderer2.image(token);
          break;
        }
        case "strong": {
          out += renderer2.strong(token);
          break;
        }
        case "em": {
          out += renderer2.em(token);
          break;
        }
        case "codespan": {
          out += renderer2.codespan(token);
          break;
        }
        case "br": {
          out += renderer2.br(token);
          break;
        }
        case "del": {
          out += renderer2.del(token);
          break;
        }
        case "text": {
          out += renderer2.text(token);
          break;
        }
        default: {
          const errMsg = 'Token with "' + token.type + '" type was not found.';
          if (this.options.silent) {
            console.error(errMsg);
            return "";
          } else {
            throw new Error(errMsg);
          }
        }
      }
    }
    return out;
  }
};
var _Hooks = (_a = class {
  constructor(options2) {
    __publicField(this, "options");
    __publicField(this, "block");
    this.options = options2 || _defaults;
  }
  /**
   * Process markdown before marked
   */
  preprocess(markdown) {
    return markdown;
  }
  /**
   * Process HTML after marked is finished
   */
  postprocess(html22) {
    return html22;
  }
  /**
   * Process all tokens before walk tokens
   */
  processAllTokens(tokens) {
    return tokens;
  }
  /**
   * Provide function to tokenize markdown
   */
  provideLexer() {
    return this.block ? _Lexer.lex : _Lexer.lexInline;
  }
  /**
   * Provide function to parse tokens
   */
  provideParser() {
    return this.block ? _Parser.parse : _Parser.parseInline;
  }
}, __publicField(_a, "passThroughHooks", /* @__PURE__ */ new Set([
  "preprocess",
  "postprocess",
  "processAllTokens"
])), _a);
var Marked = class {
  constructor(...args) {
    __publicField(this, "defaults", _getDefaults());
    __publicField(this, "options", this.setOptions);
    __publicField(this, "parse", this.parseMarkdown(true));
    __publicField(this, "parseInline", this.parseMarkdown(false));
    __publicField(this, "Parser", _Parser);
    __publicField(this, "Renderer", _Renderer);
    __publicField(this, "TextRenderer", _TextRenderer);
    __publicField(this, "Lexer", _Lexer);
    __publicField(this, "Tokenizer", _Tokenizer);
    __publicField(this, "Hooks", _Hooks);
    this.use(...args);
  }
  /**
   * Run callback for every token
   */
  walkTokens(tokens, callback) {
    let values = [];
    for (const token of tokens) {
      values = values.concat(callback.call(this, token));
      switch (token.type) {
        case "table": {
          const tableToken = token;
          for (const cell of tableToken.header) {
            values = values.concat(this.walkTokens(cell.tokens, callback));
          }
          for (const row of tableToken.rows) {
            for (const cell of row) {
              values = values.concat(this.walkTokens(cell.tokens, callback));
            }
          }
          break;
        }
        case "list": {
          const listToken = token;
          values = values.concat(this.walkTokens(listToken.items, callback));
          break;
        }
        default: {
          const genericToken = token;
          if (this.defaults.extensions?.childTokens?.[genericToken.type]) {
            this.defaults.extensions.childTokens[genericToken.type].forEach((childTokens) => {
              const tokens2 = genericToken[childTokens].flat(Infinity);
              values = values.concat(this.walkTokens(tokens2, callback));
            });
          } else if (genericToken.tokens) {
            values = values.concat(this.walkTokens(genericToken.tokens, callback));
          }
        }
      }
    }
    return values;
  }
  use(...args) {
    const extensions = this.defaults.extensions || { renderers: {}, childTokens: {} };
    args.forEach((pack) => {
      const opts = { ...pack };
      opts.async = this.defaults.async || opts.async || false;
      if (pack.extensions) {
        pack.extensions.forEach((ext) => {
          if (!ext.name) {
            throw new Error("extension name required");
          }
          if ("renderer" in ext) {
            const prevRenderer = extensions.renderers[ext.name];
            if (prevRenderer) {
              extensions.renderers[ext.name] = function(...args2) {
                let ret = ext.renderer.apply(this, args2);
                if (ret === false) {
                  ret = prevRenderer.apply(this, args2);
                }
                return ret;
              };
            } else {
              extensions.renderers[ext.name] = ext.renderer;
            }
          }
          if ("tokenizer" in ext) {
            if (!ext.level || ext.level !== "block" && ext.level !== "inline") {
              throw new Error("extension level must be 'block' or 'inline'");
            }
            const extLevel = extensions[ext.level];
            if (extLevel) {
              extLevel.unshift(ext.tokenizer);
            } else {
              extensions[ext.level] = [ext.tokenizer];
            }
            if (ext.start) {
              if (ext.level === "block") {
                if (extensions.startBlock) {
                  extensions.startBlock.push(ext.start);
                } else {
                  extensions.startBlock = [ext.start];
                }
              } else if (ext.level === "inline") {
                if (extensions.startInline) {
                  extensions.startInline.push(ext.start);
                } else {
                  extensions.startInline = [ext.start];
                }
              }
            }
          }
          if ("childTokens" in ext && ext.childTokens) {
            extensions.childTokens[ext.name] = ext.childTokens;
          }
        });
        opts.extensions = extensions;
      }
      if (pack.renderer) {
        const renderer2 = this.defaults.renderer || new _Renderer(this.defaults);
        for (const prop in pack.renderer) {
          if (!(prop in renderer2)) {
            throw new Error(`renderer '${prop}' does not exist`);
          }
          if (["options", "parser"].includes(prop)) {
            continue;
          }
          const rendererProp = prop;
          const rendererFunc = pack.renderer[rendererProp];
          const prevRenderer = renderer2[rendererProp];
          renderer2[rendererProp] = (...args2) => {
            let ret = rendererFunc.apply(renderer2, args2);
            if (ret === false) {
              ret = prevRenderer.apply(renderer2, args2);
            }
            return ret || "";
          };
        }
        opts.renderer = renderer2;
      }
      if (pack.tokenizer) {
        const tokenizer = this.defaults.tokenizer || new _Tokenizer(this.defaults);
        for (const prop in pack.tokenizer) {
          if (!(prop in tokenizer)) {
            throw new Error(`tokenizer '${prop}' does not exist`);
          }
          if (["options", "rules", "lexer"].includes(prop)) {
            continue;
          }
          const tokenizerProp = prop;
          const tokenizerFunc = pack.tokenizer[tokenizerProp];
          const prevTokenizer = tokenizer[tokenizerProp];
          tokenizer[tokenizerProp] = (...args2) => {
            let ret = tokenizerFunc.apply(tokenizer, args2);
            if (ret === false) {
              ret = prevTokenizer.apply(tokenizer, args2);
            }
            return ret;
          };
        }
        opts.tokenizer = tokenizer;
      }
      if (pack.hooks) {
        const hooks = this.defaults.hooks || new _Hooks();
        for (const prop in pack.hooks) {
          if (!(prop in hooks)) {
            throw new Error(`hook '${prop}' does not exist`);
          }
          if (["options", "block"].includes(prop)) {
            continue;
          }
          const hooksProp = prop;
          const hooksFunc = pack.hooks[hooksProp];
          const prevHook = hooks[hooksProp];
          if (_Hooks.passThroughHooks.has(prop)) {
            hooks[hooksProp] = (arg) => {
              if (this.defaults.async) {
                return Promise.resolve(hooksFunc.call(hooks, arg)).then((ret2) => {
                  return prevHook.call(hooks, ret2);
                });
              }
              const ret = hooksFunc.call(hooks, arg);
              return prevHook.call(hooks, ret);
            };
          } else {
            hooks[hooksProp] = (...args2) => {
              let ret = hooksFunc.apply(hooks, args2);
              if (ret === false) {
                ret = prevHook.apply(hooks, args2);
              }
              return ret;
            };
          }
        }
        opts.hooks = hooks;
      }
      if (pack.walkTokens) {
        const walkTokens2 = this.defaults.walkTokens;
        const packWalktokens = pack.walkTokens;
        opts.walkTokens = function(token) {
          let values = [];
          values.push(packWalktokens.call(this, token));
          if (walkTokens2) {
            values = values.concat(walkTokens2.call(this, token));
          }
          return values;
        };
      }
      this.defaults = { ...this.defaults, ...opts };
    });
    return this;
  }
  setOptions(opt) {
    this.defaults = { ...this.defaults, ...opt };
    return this;
  }
  lexer(src, options2) {
    return _Lexer.lex(src, options2 ?? this.defaults);
  }
  parser(tokens, options2) {
    return _Parser.parse(tokens, options2 ?? this.defaults);
  }
  parseMarkdown(blockType) {
    const parse2 = (src, options2) => {
      const origOpt = { ...options2 };
      const opt = { ...this.defaults, ...origOpt };
      const throwError = this.onError(!!opt.silent, !!opt.async);
      if (this.defaults.async === true && origOpt.async === false) {
        return throwError(new Error("marked(): The async option was set to true by an extension. Remove async: false from the parse options object to return a Promise."));
      }
      if (typeof src === "undefined" || src === null) {
        return throwError(new Error("marked(): input parameter is undefined or null"));
      }
      if (typeof src !== "string") {
        return throwError(new Error("marked(): input parameter is of type " + Object.prototype.toString.call(src) + ", string expected"));
      }
      if (opt.hooks) {
        opt.hooks.options = opt;
        opt.hooks.block = blockType;
      }
      const lexer2 = opt.hooks ? opt.hooks.provideLexer() : blockType ? _Lexer.lex : _Lexer.lexInline;
      const parser2 = opt.hooks ? opt.hooks.provideParser() : blockType ? _Parser.parse : _Parser.parseInline;
      if (opt.async) {
        return Promise.resolve(opt.hooks ? opt.hooks.preprocess(src) : src).then((src2) => lexer2(src2, opt)).then((tokens) => opt.hooks ? opt.hooks.processAllTokens(tokens) : tokens).then((tokens) => opt.walkTokens ? Promise.all(this.walkTokens(tokens, opt.walkTokens)).then(() => tokens) : tokens).then((tokens) => parser2(tokens, opt)).then((html22) => opt.hooks ? opt.hooks.postprocess(html22) : html22).catch(throwError);
      }
      try {
        if (opt.hooks) {
          src = opt.hooks.preprocess(src);
        }
        let tokens = lexer2(src, opt);
        if (opt.hooks) {
          tokens = opt.hooks.processAllTokens(tokens);
        }
        if (opt.walkTokens) {
          this.walkTokens(tokens, opt.walkTokens);
        }
        let html22 = parser2(tokens, opt);
        if (opt.hooks) {
          html22 = opt.hooks.postprocess(html22);
        }
        return html22;
      } catch (e3) {
        return throwError(e3);
      }
    };
    return parse2;
  }
  onError(silent, async) {
    return (e3) => {
      e3.message += "\nPlease report this to https://github.com/markedjs/marked.";
      if (silent) {
        const msg = "<p>An error occurred:</p><pre>" + escape2(e3.message + "", true) + "</pre>";
        if (async) {
          return Promise.resolve(msg);
        }
        return msg;
      }
      if (async) {
        return Promise.reject(e3);
      }
      throw e3;
    };
  }
};
var markedInstance = new Marked();
function marked(src, opt) {
  return markedInstance.parse(src, opt);
}
marked.options = marked.setOptions = function(options2) {
  markedInstance.setOptions(options2);
  marked.defaults = markedInstance.defaults;
  changeDefaults(marked.defaults);
  return marked;
};
marked.getDefaults = _getDefaults;
marked.defaults = _defaults;
marked.use = function(...args) {
  markedInstance.use(...args);
  marked.defaults = markedInstance.defaults;
  changeDefaults(marked.defaults);
  return marked;
};
marked.walkTokens = function(tokens, callback) {
  return markedInstance.walkTokens(tokens, callback);
};
marked.parseInline = markedInstance.parseInline;
marked.Parser = _Parser;
marked.parser = _Parser.parse;
marked.Renderer = _Renderer;
marked.TextRenderer = _TextRenderer;
marked.Lexer = _Lexer;
marked.lexer = _Lexer.lex;
marked.Tokenizer = _Tokenizer;
marked.Hooks = _Hooks;
marked.parse = marked;
var options = marked.options;
var setOptions = marked.setOptions;
var use = marked.use;
var walkTokens = marked.walkTokens;
var parseInline = marked.parseInline;
var parse = marked;
var parser = _Parser.parse;
var lexer = _Lexer.lex;

// dashboard/src/lib/html.ts
var html4 = htm_module_default.bind(k);

// dashboard/src/lib/markdown.ts
function escapeHtml(s3) {
  if (s3 == null) return "";
  return String(s3).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
var SEARCH_REPLACE_RE = /<{7}\s*SEARCH\s*\n([\s\S]*?)\n={7}\s*\n([\s\S]*?)\n>{7}\s*REPLACE/;
function renderSearchReplace(search, replace, file) {
  const safeSearch = typeof search === "string" ? search : String(search ?? "");
  const safeReplace = typeof replace === "string" ? replace : String(replace ?? "");
  const oldLines = safeSearch.split("\n").map((l3) => `<span class="diff-line del">- ${escapeHtml(l3)}</span>`).join("\n");
  const newLines = safeReplace.split("\n").map((l3) => `<span class="diff-line ins">+ ${escapeHtml(l3)}</span>`).join("\n");
  const header = file ? `<span class="diff-line hunk">▸ edit ${escapeHtml(file)}</span>
` : "";
  return `<pre class="diff-block">${header}${oldLines}
${newLines}</pre>`;
}
function renderUnifiedDiff(text) {
  const safe = typeof text === "string" ? text : String(text ?? "");
  const lines = safe.split("\n").map((l3) => {
    if (l3.startsWith("+++") || l3.startsWith("---")) {
      return `<span class="diff-line meta">${escapeHtml(l3)}</span>`;
    }
    if (l3.startsWith("+")) return `<span class="diff-line ins">${escapeHtml(l3)}</span>`;
    if (l3.startsWith("-")) return `<span class="diff-line del">${escapeHtml(l3)}</span>`;
    if (l3.startsWith("@@")) return `<span class="diff-line hunk">${escapeHtml(l3)}</span>`;
    return escapeHtml(l3);
  }).join("\n");
  return `<pre class="diff-block">${lines}</pre>`;
}
var renderer = new marked.Renderer();
renderer.html = ({ text }) => escapeHtml(text);
var ARTIFACT_EXT_BY_LANG = {
  markdown: "md",
  md: "md",
  html: "html",
  htm: "html",
  python: "py",
  py: "py",
  javascript: "js",
  js: "js",
  typescript: "ts",
  ts: "ts",
  tsx: "tsx",
  jsx: "jsx",
  css: "css",
  json: "json",
  xml: "xml",
  yaml: "yaml",
  yml: "yml",
  sql: "sql",
  powershell: "ps1",
  ps1: "ps1",
  bat: "bat",
  batch: "bat",
  cmd: "cmd",
  bash: "sh",
  sh: "sh",
  shell: "sh",
  ini: "ini",
  toml: "toml",
  csv: "csv",
  text: "txt",
  txt: "txt"
};
var ARTIFACT_PREVIEW_LANGS = /* @__PURE__ */ new Set(["markdown", "md", "html", "htm"]);
var ARTIFACT_OPEN_EXTS = /* @__PURE__ */ new Set(["html", "htm", "txt", "json", "xml", "yaml", "yml", "csv", "css", "sql", "ini", "toml"]);
function normalizeArtifactLang(raw) {
  return String(raw || "").trim().split(/\s+/)[0].replace(/^language-/, "").toLowerCase();
}
function artifactDisplayName(content, lang, ext, seq) {
  const text = String(content || "");
  if (lang === "html" || lang === "htm") {
    const title = /<title[^>]*>([^<]{1,80})<\/title>/i.exec(text)?.[1]?.trim();
    if (title) return `${artifactSlug(title)}.${ext}`;
    return `page-${seq}.${ext}`;
  }
  if (lang === "markdown" || lang === "md") {
    const heading2 = /^#\s+(.{1,80})\s*$/m.exec(text)?.[1]?.trim();
    if (heading2) return `${artifactSlug(heading2)}.${ext}`;
    return `document-${seq}.${ext}`;
  }
  if (lang === "python" || lang === "py") return `script-${seq}.${ext}`;
  if (lang === "javascript" || lang === "js" || lang === "typescript" || lang === "ts") return `code-${seq}.${ext}`;
  if (lang === "json") return `data-${seq}.${ext}`;
  if (lang === "csv") return `table-${seq}.${ext}`;
  return `artifact-${seq}.${ext}`;
}
function artifactSlug(value) {
  const cleaned = String(value || "").replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, "-").replace(/[\x00-\x1f]/g, "").slice(0, 48).replace(/^-+|-+$/g, "");
  return cleaned || "artifact";
}
function registerChatArtifact(content, rawLang) {
  const lang = normalizeArtifactLang(rawLang);
  const ext = ARTIFACT_EXT_BY_LANG[lang];
  if (!ext || !content) return null;
  try {
    window.__visionoxArtifactSeq = (window.__visionoxArtifactSeq || 0) + 1;
    window.__visionoxArtifacts = window.__visionoxArtifacts || {};
    const seq = window.__visionoxArtifactSeq;
    const id = `artifact-${Date.now().toString(36)}-${seq}`;
    const label = ext.toUpperCase();
    const filename = artifactDisplayName(content, lang, ext, seq);
    window.__visionoxArtifacts[id] = {
      id,
      lang,
      ext,
      label,
      filename,
      content,
      previewable: ARTIFACT_PREVIEW_LANGS.has(lang),
      openable: ARTIFACT_OPEN_EXTS.has(ext)
    };
    return window.__visionoxArtifacts[id];
  } catch {
    return null;
  }
}
function renderArtifactFrame(artifact, codeHtml) {
  if (!artifact) return codeHtml;
  const previewBtn = artifact.previewable ? `<button type="button" class="chat-artifact-btn" data-artifact-action="preview">预览</button>` : "";
  const openBtn = artifact.openable ? `<button type="button" class="chat-artifact-btn" data-artifact-action="open-file">打开</button>` : "";
  return `<div class="chat-artifact" data-artifact-id="${escapeHtml(artifact.id)}">
    <div class="chat-artifact-head">
      <div class="chat-artifact-title">
        <span class="chat-artifact-type">${escapeHtml(artifact.label)}</span>
        <span class="chat-artifact-name" title="${escapeHtml(artifact.filename)}">${escapeHtml(artifact.filename)}</span>
        <span class="chat-artifact-status" data-artifact-status>可保存的对话产物</span>
      </div>
      <div class="chat-artifact-actions">
        ${previewBtn}
        ${openBtn}
        <button type="button" class="chat-artifact-btn" data-artifact-action="copy">复制</button>
        <button type="button" class="chat-artifact-btn" data-artifact-action="save">另存</button>
        <button type="button" class="chat-artifact-btn" data-artifact-action="open-folder" disabled>打开目录</button>
      </div>
    </div>
    ${codeHtml}
  </div>`;
}
function renderPreviewCodeBlock(content, rawLang) {
  const lang = normalizeArtifactLang(rawLang);
  const hlLang = lang === "html" || lang === "htm" ? "xml" : lang;
  let codeHtml = escapeHtml(content);
  if (hlLang && common_default.getLanguage(hlLang)) {
    try {
      codeHtml = common_default.highlight(content, { language: hlLang, ignoreIllegals: true }).value;
    } catch {
    }
  } else {
    try {
      codeHtml = common_default.highlightAuto(content).value;
    } catch {
    }
  }
  const langLabel = lang ? escapeHtml(lang) : "代码";
  const codeClass = hlLang ? ` class="hljs language-${escapeHtml(hlLang)}"` : ' class="hljs"';
  return `<div class="artifact-preview-code">
    <div class="artifact-preview-code-head">
      <span>${langLabel}</span>
      <button type="button" data-preview-code-copy>复制</button>
    </div>
    <pre><code${codeClass}>${codeHtml}</code></pre>
  </div>`;
}
renderer.code = function reasonixCode(arg1, arg2) {
  let text;
  let lang;
  if (arg1 && typeof arg1 === "object" && !Array.isArray(arg1)) {
    text = arg1.text;
    lang = arg1.lang;
  } else {
    text = arg1;
    lang = arg2;
  }
  if (text == null) text = "";
  const codeText = typeof text === "string" ? text : String(text);
  if (globalThis.__visionoxMarkdownPreviewMode) return renderPreviewCodeBlock(codeText, lang);
  const sr = SEARCH_REPLACE_RE.exec(codeText);
  if (sr) {
    const [, search = "", replace = ""] = sr;
    const file = typeof lang === "string" && lang.startsWith("edit:") ? lang.slice(5) : "";
    return renderSearchReplace(search, replace, file);
  }
  if (lang === "diff") return renderUnifiedDiff(codeText);
  const artifact = registerChatArtifact(codeText, lang);
  if (lang && typeof lang === "string" && common_default.getLanguage(lang)) {
    try {
      const h3 = common_default.highlight(codeText, { language: lang, ignoreIllegals: true }).value;
      return renderArtifactFrame(artifact, `<pre><code class="hljs language-${lang}">${h3}</code></pre>`);
    } catch {
    }
  }
  if (artifact) {
    const hlLang = artifact.lang === "html" || artifact.lang === "htm" ? "xml" : artifact.lang;
    if (common_default.getLanguage(hlLang)) {
      try {
        const h3 = common_default.highlight(codeText, { language: hlLang, ignoreIllegals: true }).value;
        return renderArtifactFrame(artifact, `<pre><code class="hljs language-${hlLang}">${h3}</code></pre>`);
      } catch {
      }
    }
    return renderArtifactFrame(artifact, `<pre><code>${escapeHtml(codeText)}</code></pre>`);
  }
  try {
    const auto = common_default.highlightAuto(codeText);
    return `<pre><code class="hljs">${auto.value}</code></pre>`;
  } catch {
    return `<pre><code>${escapeHtml(codeText)}</code></pre>`;
  }
};
var mathExtensions = globalThis.VisionoxKatex ? globalThis.VisionoxKatex.markedExtensions() : [];
marked.use({ renderer, extensions: mathExtensions, gfm: true, breaks: false, pedantic: false });
function renderMarkdownToString(text) {
  return marked.parse(text);
}
function protectWindowsPathBackslashesForMarkdown(text) {
  const src = String(text ?? "");
  const pathStart = /[A-Za-z]:\\/g;
  let out = "";
  let cursor = 0;
  let match;
  while ((match = pathStart.exec(src)) !== null) {
    const start = match.index;
    if (start < cursor) continue;
    let end = src.indexOf("\n", start);
    if (end < 0) end = src.length;
    out += src.slice(cursor, start);
    out += src.slice(start, end).replace(/\\(?=[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g, "\\\\");
    cursor = end;
    pathStart.lastIndex = end;
  }
  out += src.slice(cursor);
  return out;
}
function renderMarkdownPreviewToString(text) {
  const previous = globalThis.__visionoxMarkdownPreviewMode;
  globalThis.__visionoxMarkdownPreviewMode = true;
  try {
    return marked.parse(text);
  } finally {
    if (previous === void 0) delete globalThis.__visionoxMarkdownPreviewMode;
    else globalThis.__visionoxMarkdownPreviewMode = previous;
  }
}
function artifactPreviewDoc(artifact) {
  if (artifact.lang === "html" || artifact.lang === "htm") {
    return String(artifact.content || "");
  }
  const rendered = renderMarkdownPreviewToString(artifact.content);
  return `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><link rel="stylesheet" href="/assets/vendor/katex/katex.min.css?token=${encodeURIComponent(TOKEN)}"><style>
body{margin:0;padding:22px 26px 34px;background:#fff;color:#1f2937;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.65;font-size:14px}
h1,h2,h3{line-height:1.25;margin:1.2em 0 .55em;color:#111827}
h1{font-size:26px}h2{font-size:21px}h3{font-size:17px}
p,ul,ol,blockquote,pre,table{margin:.8em 0}
code,pre{font-family:ui-monospace,SFMono-Regular,Consolas,"Liberation Mono",monospace}
code{background:#f3f4f6;border-radius:4px;padding:.12em .32em}
pre{background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:12px;overflow:auto}
pre code{background:transparent;padding:0}
.artifact-preview-code{margin:.9em 0;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;background:#f8fafc}
.artifact-preview-code-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:7px 10px;border-bottom:1px solid #e5e7eb;background:#f9fafb;color:#64748b;font-size:12px}
.artifact-preview-code-head button{height:24px;display:inline-flex;align-items:center;justify-content:center;padding:0 9px;border:1px solid #d1d5db;border-radius:6px;background:#fff;color:#334155;font-size:12px;line-height:1;cursor:pointer}
.artifact-preview-code pre{margin:0;border:0;border-radius:0;background:#f8fafc}
blockquote{border-left:4px solid #d1d5db;padding-left:12px;color:#4b5563}
table{border-collapse:collapse;width:100%}th,td{border:1px solid #e5e7eb;padding:6px 8px}th{background:#f9fafb}
a{color:#2563eb}
.visionox-math-block{margin:.9em 0;overflow-x:auto;overflow-y:hidden;text-align:center}
.visionox-math-inline{white-space:nowrap}
</style></head><body>${rendered}</body></html>`;
}
function closeArtifactPreview() {
  document.querySelector(".artifact-preview-backdrop")?.remove();
  document.body.classList.remove("artifact-preview-open");
}
function showArtifactPreview(artifact) {
  closeArtifactPreview();
  const backdrop = document.createElement("div");
  backdrop.className = "artifact-preview-backdrop";
  const dialog = document.createElement("div");
  dialog.className = "artifact-preview-dialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-label", `${artifact.filename} 预览`);
  const title = document.createElement("div");
  title.className = "artifact-preview-head";
  const canShowSource = artifact.lang !== "html" && artifact.lang !== "htm";
  title.innerHTML = `<span class="artifact-preview-name" title="${escapeHtml(artifact.path || artifact.filename)}">${escapeHtml(artifact.filename)}</span>
    <span class="artifact-preview-actions">
      ${canShowSource ? `<button type="button" class="artifact-preview-btn" data-artifact-preview-action="source">源码</button>` : ""}
      ${artifact.path ? `<button type="button" class="artifact-preview-btn" data-artifact-preview-action="copy-path">复制路径</button>` : ""}
      ${artifact.path ? `<button type="button" class="artifact-preview-btn" data-artifact-preview-action="folder">所在文件夹</button>` : ""}
      <button type="button" class="artifact-preview-close" data-artifact-preview-action="close" aria-label="返回对话">返回对话</button>
    </span>`;
  const body = document.createElement("div");
  body.className = "artifact-preview-body";
  let showingSource = false;
  const renderPreview = () => {
    body.replaceChildren();
    const iframe = document.createElement("iframe");
    iframe.className = "artifact-preview-frame";
    const isRawHtml = artifact.lang === "html" || artifact.lang === "htm";
    iframe.setAttribute("sandbox", isRawHtml ? "" : "allow-same-origin");
    if (!isRawHtml) {
      iframe.addEventListener("load", () => wireArtifactPreviewCodeCopy(iframe));
    }
    iframe.srcdoc = artifactPreviewDoc(artifact);
    body.appendChild(iframe);
  };
  const openLogs = () => {
    try {
      if (window.parent && window.parent !== window) window.parent.postMessage({ type: "vis_open_log_dir" }, "*");
    } catch {
    }
  };
  const renderSource = () => {
    body.replaceChildren();
    const pre = document.createElement("pre");
    pre.className = "artifact-preview-source";
    pre.textContent = artifact.content || "";
    body.appendChild(pre);
  };
  renderPreview();
  dialog.appendChild(title);
  dialog.appendChild(body);
  backdrop.appendChild(dialog);
  document.body.appendChild(backdrop);
  document.body.classList.add("artifact-preview-open");
  backdrop.addEventListener("click", (ev) => {
    if (ev.target === backdrop) closeArtifactPreview();
  });
  title.addEventListener("click", async (ev) => {
    const btn = ev.target?.closest?.("[data-artifact-preview-action]");
    if (!btn) return;
    const action = btn.dataset.artifactPreviewAction;
    if (action === "close") {
      closeArtifactPreview();
      return;
    }
    if (action === "source") {
      showingSource = !showingSource;
      btn.textContent = showingSource ? "预览" : "源码";
      if (showingSource) renderSource();
      else renderPreview();
      return;
    }
    try {
      if (action === "copy-path") {
        await writeClipboardText(artifact.path || "");
        showToast("路径已复制", "info");
      } else if (action === "folder") {
        if (!await confirmExternalArtifactOpen(artifact)) return;
        await api("/artifacts/open-folder", { method: "POST", body: { path: artifact.path } });
        showToast("已打开所在文件夹", "info");
      }
    } catch (err) {
      showToast(err.message || "文件操作失败", "error", 5e3);
    }
  });
}
function confirmExternalArtifactOpen(artifact) {
  return new Promise((resolve) => {
    const backdrop = document.createElement("div");
    backdrop.className = "artifact-open-confirmation";
    const dialog = document.createElement("div");
    dialog.className = "artifact-open-confirmation-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", "确认打开外部文件");
    dialog.innerHTML = `<div class="artifact-open-confirmation-title">要离开对话打开文件吗？</div>
      <div class="artifact-open-confirmation-text">${escapeHtml(artifact.filename || artifact.path || "此文件")} 将交给本机程序打开。当前对话会保留，返回本软件后仍可继续。</div>
      <div class="artifact-open-confirmation-actions">
        <button type="button" class="artifact-preview-btn" data-artifact-open-action="cancel">留在对话</button>
        <button type="button" class="artifact-preview-btn primary" data-artifact-open-action="open">使用系统程序打开</button>
      </div>`;
    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);
    const finish = (approved) => {
      document.removeEventListener("keydown", onKeyDown);
      backdrop.remove();
      resolve(approved);
    };
    const onKeyDown = (ev) => {
      if (ev.key === "Escape") finish(false);
    };
    document.addEventListener("keydown", onKeyDown);
    backdrop.addEventListener("click", (ev) => {
      if (ev.target === backdrop) finish(false);
      const action = ev.target?.closest?.("[data-artifact-open-action]")?.dataset?.artifactOpenAction;
      if (action === "open") finish(true);
      else if (action === "cancel") finish(false);
    });
    dialog.querySelector('[data-artifact-open-action="cancel"]')?.focus();
  });
}
function wireArtifactPreviewCodeCopy(iframe) {
  let doc;
  try {
    doc = iframe.contentDocument;
  } catch {
    return;
  }
  if (!doc || doc.__visionoxPreviewCodeCopyBound) return;
  doc.__visionoxPreviewCodeCopyBound = true;
  doc.addEventListener("click", async (ev) => {
    const btn = ev.target?.closest?.("[data-preview-code-copy]");
    if (!btn) return;
    ev.preventDefault();
    const wrap = btn.closest(".artifact-preview-code");
    const text = wrap?.querySelector?.("pre code")?.textContent || "";
    const original = btn.textContent || "复制";
    try {
      await writeClipboardText(text);
      btn.textContent = "已复制";
      setTimeout(() => {
        btn.textContent = original;
      }, 1200);
    } catch (err) {
      btn.textContent = "复制失败";
      showToast(err.message || "复制失败", "error", 4e3);
      setTimeout(() => {
        btn.textContent = original;
      }, 1500);
    }
  });
}
async function saveArtifact(artifact, wrap) {
  if (artifact.path && artifact.dir) return artifact;
  const res = await api("/artifacts/save", {
    method: "POST",
    body: { filename: artifact.filename, content: artifact.content, lang: artifact.lang }
  });
  artifact.path = res.path;
  artifact.dir = res.dir;
  artifact.filename = res.filename || artifact.filename;
  const openFolderBtn = wrap?.querySelector?.('[data-artifact-action="open-folder"]');
  if (openFolderBtn) openFolderBtn.disabled = false;
  const nameEl = wrap?.querySelector?.(".chat-artifact-name");
  if (nameEl) {
    nameEl.textContent = artifact.filename;
    nameEl.setAttribute("title", artifact.path || artifact.filename);
  }
  const statusEl = wrap?.querySelector?.("[data-artifact-status]");
  if (statusEl) statusEl.textContent = "已保存";
  return artifact;
}
async function handleArtifactAction(ev) {
  const btn = ev.target?.closest?.("[data-artifact-action]");
  if (!btn) return;
  const wrap = btn.closest(".chat-artifact");
  const id = wrap?.dataset?.artifactId;
  const artifact = id ? window.__visionoxArtifacts?.[id] : null;
  if (!artifact) return;
  ev.preventDefault();
  ev.stopPropagation();
  const action = btn.dataset.artifactAction;
  try {
    if (action === "copy") {
      await writeClipboardText(artifact.content);
      showToast("产物内容已复制", "info");
    } else if (action === "preview") {
      showArtifactPreview(artifact);
    } else if (action === "save") {
      btn.disabled = true;
      await saveArtifact(artifact, wrap);
      showToast(`已保存到 ${artifact.filename}`, "info");
    } else if (action === "open-file") {
      if (!await confirmExternalArtifactOpen(artifact)) return;
      btn.disabled = true;
      await saveArtifact(artifact, wrap);
      await api("/artifacts/open-file", { method: "POST", body: { path: artifact.path } });
    } else if (action === "open-folder") {
      if (!await confirmExternalArtifactOpen(artifact)) return;
      if (!artifact.dir) await saveArtifact(artifact, wrap);
      await api("/artifacts/open-folder", { method: "POST", body: { dir: artifact.dir } });
    }
  } catch (err) {
    showToast(err.message || "产物操作失败", "error", 5e3);
  } finally {
    if (action === "save" || action === "open-file") btn.disabled = false;
  }
}
document.addEventListener("click", handleArtifactAction);
document.addEventListener("click", (ev) => {
  if (ev.target?.classList?.contains("artifact-preview-close")) {
    closeArtifactPreview();
  }
});
document.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape") closeArtifactPreview();
});
var LANG_BY_EXT = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  py: "python",
  rs: "rust",
  go: "go",
  java: "java",
  kt: "kotlin",
  c: "c",
  h: "c",
  cpp: "cpp",
  cc: "cpp",
  hpp: "cpp",
  cs: "csharp",
  swift: "swift",
  rb: "ruby",
  php: "php",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  fish: "bash",
  ps1: "powershell",
  json: "json",
  yaml: "yaml",
  yml: "yaml",
  toml: "ini",
  xml: "xml",
  html: "xml",
  svg: "xml",
  css: "css",
  scss: "scss",
  less: "less",
  md: "markdown",
  sql: "sql",
  vue: "xml",
  svelte: "xml",
  tex: "latex",
  proto: "protobuf",
  dockerfile: "dockerfile"
};
function langFromPath(path) {
  if (!path) return null;
  const lower = path.toLowerCase();
  if (lower.endsWith("dockerfile")) return "dockerfile";
  const dot = lower.lastIndexOf(".");
  if (dot < 0) return null;
  const ext = lower.slice(dot + 1);
  return LANG_BY_EXT[ext] ?? null;
}
function renderHighlightedBlock(text, lang) {
  if (!text) return "";
  const safeLang = lang && common_default.getLanguage(lang) ? lang : null;
  try {
    const out = safeLang ? common_default.highlight(text, { language: safeLang, ignoreIllegals: true }) : common_default.highlightAuto(text);
    return `<pre class="md"><code class="hljs ${safeLang ? `language-${safeLang}` : ""}">${out.value}</code></pre>`;
  } catch {
    return `<pre><code>${escapeHtml(text)}</code></pre>`;
  }
}
function hlLine(text, lang) {
  if (text == null) return "";
  if (text === "") return "";
  try {
    if (lang && common_default.getLanguage(lang)) {
      return common_default.highlight(text, { language: lang, ignoreIllegals: true }).value;
    }
    return common_default.highlightAuto(text).value;
  } catch {
    return escapeHtml(text);
  }
}

// dashboard/src/components/chat-internals.ts
var N22 = N2;
var ROLE_AVATAR = {
  user: "/assets/128x128.png",
  assistant: "/assets/ai-avatar.png"
};
function renderMessageBody(text, role) {
  if (!text) return null;
  const source = role === "user" ? protectWindowsPathBackslashesForMarkdown(text) : text;
  return html4`<div class="md" dangerouslySetInnerHTML=${{ __html: renderMarkdownToString(source) }}></div>`;
}
function parseToolArgs(raw) {
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
function toolTextStats(text) {
  const value = text ?? "";
  return {
    chars: value.length,
    lines: value ? value.split(/\r?\n/).length : 0
  };
}
function isLongToolText(text) {
  const stats = toolTextStats(text);
  return stats.chars > 1600 || stats.lines > 30;
}
function renderToolOutput(text, kind = "pre", lang = "") {
  const value = text ?? "";
  const body = kind === "highlight" ? html4`<div dangerouslySetInnerHTML=${{ __html: renderHighlightedBlock(value, lang) }}></div>` : html4`<pre class="tool-card-output">${value}</pre>`;
  return body;
}
function chatSearchText(msg) {
  if (!msg) return "";
  const parts = [msg.role, msg.toolName, msg.text, msg.reasoning, msg.toolArgs];
  return parts.filter(Boolean).join("\n");
}
function computeChatSearchMatches(messages, query) {
  const needle = (query ?? "").trim().toLowerCase();
  if (!needle) return [];
  const matches = [];
  messages.forEach((msg, index) => {
    if (chatSearchText(msg).toLowerCase().includes(needle)) {
      matches.push({ id: msg.id, index });
    }
  });
  return matches;
}
function ToolCard({ msg }) {
  useLang();
  const args = parseToolArgs(msg.toolArgs);
  const name = msg.toolName ?? "tool";
  const path = args?.path ?? args?.file_path ?? args?.filename;
  if ((name === "edit_file" || name.endsWith("_edit_file")) && args && typeof args.search === "string" && typeof args.replace === "string") {
    const diffHtml = renderSearchReplace(
      args.search,
      args.replace,
      path ?? ""
    );
    return html4`
      <div class="tool-card">
        <div class="tool-card-head">
          <span class="tool-card-icon">✎</span>
          <span class="tool-card-name">edit_file</span>
          ${path ? html4`<code class="tool-card-path">${path}</code>` : null}
        </div>
        <div dangerouslySetInnerHTML=${{ __html: diffHtml }}></div>
        ${msg.text ? html4`<div class="tool-card-result">${msg.text}</div>` : null}
      </div>
    `;
  }
  if ((name === "write_file" || name.endsWith("_write_file")) && args && typeof args.content === "string") {
    const lang = langFromPath(path);
    return html4`
      <div class="tool-card">
        <div class="tool-card-head">
          <span class="tool-card-icon">+</span>
          <span class="tool-card-name">write_file</span>
          ${path ? html4`<code class="tool-card-path">${path}</code>` : null}
          ${lang ? html4`<span class="pill">${lang}</span>` : null}
        </div>
        ${renderToolOutput(args.content, "highlight", lang)}
        ${msg.text ? html4`<div class="tool-card-result">${msg.text}</div>` : null}
      </div>
    `;
  }
  if (name === "read_file" || name.endsWith("_read_file") || name === "filesystem_read_file") {
    const lang = langFromPath(path);
    return html4`
      <div class="tool-card">
        <div class="tool-card-head">
          <span class="tool-card-icon">▤</span>
          <span class="tool-card-name">read_file</span>
          ${path ? html4`<code class="tool-card-path">${path}</code>` : null}
          ${lang ? html4`<span class="pill">${lang}</span>` : null}
        </div>
        ${renderToolOutput(msg.text ?? "", "highlight", lang)}
      </div>
    `;
  }
  if (name === "run_command" || name === "run_background") {
    const cmd = args?.command;
    return html4`
      <div class="tool-card">
        <div class="tool-card-head">
          <span class="tool-card-icon">⚡</span>
          <span class="tool-card-name">${name === "run_background" ? "run_background" : "run_command"}</span>
        </div>
        ${cmd ? html4`<pre class="tool-card-cmd"><span class="tool-card-prompt">$</span> <code>${cmd}</code></pre>` : null}
        ${msg.text ? renderToolOutput(msg.text) : null}
      </div>
    `;
  }
  if (name === "list_files" || name === "file_exists" || name === "delete_file" || name === "create_directory" || name === "delete_directory" || name.endsWith("_list_files")) {
    return html4`
      <div class="tool-card">
        <div class="tool-card-head">
          <span class="tool-card-icon">▣</span>
          <span class="tool-card-name">${name}</span>
          ${path ? html4`<code class="tool-card-path">${path}</code>` : null}
        </div>
        ${renderToolOutput(msg.text)}
      </div>
    `;
  }
  return html4`
    <div class="tool-card">
      <div class="tool-card-head">
        <span class="tool-card-icon">▣</span>
        <span class="tool-card-name">${name}</span>
      </div>
      ${args ? html4`<details class="tool-card-args"><summary>${t4("modal.arguments")}</summary><pre>${escapeHtml(JSON.stringify(args, null, 2))}</pre></details>` : null}
      ${renderToolOutput(msg.text)}
    </div>
  `;
}
function renderExecutionReceipt(receipt, taskState, artifactIncomplete, interventionChoice, warnings) {
  if (!receipt || typeof receipt !== "object") return null;
  const completion = receipt.completion || {};
  const tools = receipt.tools || {};
  const artifactEvents = Array.isArray(receipt.artifactEvidence) ? receipt.artifactEvidence : [];
  const lastArtifact = artifactEvents.at(-1);
  const intervention = receipt.intervention || {};
  const state = taskState || completion.taskState || (completion.ok ? "completed" : "unknown");
  const stateLabel = state === "completed" ? "已完成" : state === "needs_intervention" ? "需要干预" : state === "incomplete" ? "未完成" : state === "completed_with_warnings" ? "已完成但有提醒" : "结果待确认";
  const stateClass = state === "completed" ? "ok" : state === "completed_with_warnings" ? "warn" : "err";
  return html4`
    <details class=${`execution-receipt execution-receipt-${stateClass}`}>
      <summary><strong>执行回执</strong><span class="execution-receipt-state">${stateLabel}</span></summary>
      <div class="execution-receipt-grid">
        <span>工具</span><span>${tools.results ?? 0} 次，成功 ${tools.successes ?? 0}，失败 ${tools.failures ?? 0}${tools.lastName ? ` · 最近 ${tools.lastName}` : ""}</span>
        <span>产物</span><span>${artifactIncomplete ? "未完成或待验证" : lastArtifact?.verified ? "已发现并验证" : "未发现可验证产物"}</span>
        ${receipt.mediaReduced || receipt.mediaOmitted > 0 ? html4`<span>媒体</span><span>已降级，省略 ${receipt.mediaOmitted ?? 0} 项${receipt.mediaRecovery ? ` · ${receipt.mediaRecovery}` : ""}${receipt.mediaWarnings?.length ? ` · ${receipt.mediaWarnings[0]}` : ""}</span>` : null}
        ${intervention.shown > 0 ? html4`<span>干预</span><span>已显示 ${intervention.shown} 次${interventionChoice ? ` · 选择 ${interventionChoice}` : ""}</span>` : null}
        ${warnings?.length ? html4`<span>提醒</span><span>${warnings.slice(0, 2).join("；")}</span>` : null}
      </div>
    </details>
  `;
}
var ChatMessage = N22(function ChatMessage2({ msg, streaming, index, searchMatch, onCopy, onFillInput, reasoningExpanded = false, selectedForArtifacts = false, onSelectForArtifacts, userAvatar = null }) {
  useLang();
  const role = msg.role;
  const avatar = role === "user" ? userAvatar || ROLE_AVATAR.user : ROLE_AVATAR[role];
  const onAvatarError = (event) => {
    if (role !== "user" || avatar === ROLE_AVATAR.user || event.currentTarget.dataset.avatarFallback === "1") return;
    event.currentTarget.dataset.avatarFallback = "1";
    event.currentTarget.src = ROLE_AVATAR.user;
  };
  const canCopy = Boolean((msg.text || "").trim());
  const showCopy = role !== "user" && onCopy && canCopy;
  const showFillInput = role === "user" && onFillInput && canCopy;
  const showActions = !streaming && (showCopy || showFillInput);
  const reasoningRef = A2(null);
  const reasoningLive = Boolean(streaming && msg.reasoning);
  const [reasoningOpen, setReasoningOpen] = d2(Boolean(reasoningExpanded));
  const reasoningLength = String(msg.reasoning || "").length;
  y2(() => {
    const node = reasoningRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [msg.reasoning, reasoningLive]);
  y2(() => {
    if (!reasoningLive) setReasoningOpen(Boolean(reasoningExpanded));
  }, [reasoningExpanded, reasoningLive]);
  const onReasoningToggle = (event) => {
    const next = Boolean(event.currentTarget.open);
    setReasoningOpen((current) => current === next ? current : next);
  };
  const actions = showActions ? html4`
    <div class="chat-msg-actions">
      ${showCopy ? html4`<button type="button" onClick=${() => onCopy(msg)}>${t4("chat.copyMessage")}</button>` : null}
      ${showFillInput ? html4`<button type="button" onClick=${() => onFillInput(msg)}>${t4("chat.fillInput")}</button>` : null}
    </div>
  ` : null;
  const selectableForArtifacts = role === "assistant" && typeof onSelectForArtifacts === "function";
  const selectArtifacts = (ev) => {
    if (!selectableForArtifacts) return;
    if (ev?.target?.closest?.("button,a,[data-artifact-action],.chat-artifact-actions")) return;
    onSelectForArtifacts(msg);
  };
  const selectArtifactsKey = (ev) => {
    if (!selectableForArtifacts) return;
    if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      onSelectForArtifacts(msg);
    }
  };
  if (role === "tool") {
    return html4`
      <div class=${`chat-msg tool ${searchMatch ? "search-hit" : ""} ${showActions ? "has-actions" : ""}`} data-msg-index=${index} data-msg-id=${msg.id ?? ""}>
        <div class="glyph">▣</div>
        <div class="chat-tool-wrap">
          <${ToolCard} msg=${msg} />
          ${actions}
        </div>
      </div>
    `;
  }
  return html4`
    <div
      class=${`chat-msg ${role} ${searchMatch ? "search-hit" : ""} ${selectedForArtifacts ? "artifact-selected" : ""} ${selectableForArtifacts ? "artifact-selectable" : ""} ${showActions ? "has-actions" : ""}`}
      data-msg-index=${index}
      data-msg-id=${msg.id ?? ""}
      onClick=${selectArtifacts}
      onKeyDown=${selectArtifactsKey}
      tabIndex=${selectableForArtifacts ? 0 : void 0}
      title=${selectableForArtifacts ? "点击查看这条回复相关文件" : void 0}
    >
      ${avatar ? html4`<img key=${avatar} class="avatar" src=${avatar} width="28" height="28" alt="" loading="lazy" decoding="async" onError=${onAvatarError} />` : html4`<div class="glyph">·</div>`}
      <div class="body">
        ${msg.reasoning ? reasoningLive ? html4`
          <div class="reasoning reasoning-live-tail" ref=${reasoningRef}>${msg.reasoning}</div>
        ` : html4`
          <details class="reasoning-details" open=${reasoningOpen} onToggle=${onReasoningToggle}>
            <summary class="reasoning-summary">
              <span class="reasoning-summary-label">思考过程</span>
              <span class="reasoning-summary-meta">约 ${reasoningLength.toLocaleString()} 字</span>
            </summary>
            <div class="reasoning">${msg.reasoning}</div>
          </details>
        ` : null}
        ${renderMessageBody(msg.text, role)}
        ${role === "assistant" && !streaming ? renderExecutionReceipt(msg.receipt, msg.taskState, msg.artifactIncomplete, msg.interventionChoice, msg.warnings) : null}
        ${msg.images && msg.images.length > 0 ? html4`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">${msg.images.map(function(imgUrl) {
    return html4`<a href=${imgUrl} target="_blank" rel="noopener noreferrer" style="display:block;max-width:220px;border-radius:6px;overflow:hidden;border:1px solid var(--border-subtle,#2a2e38)"><img src=${imgUrl} style="width:100%;height:auto;display:block" /></a>`;
  })}</div>` : null}
        ${streaming ? html4`<span class="chat-streaming-cursor"></span>` : null}
        ${actions}
      </div>
    </div>
  `;
});
function ModalCard({ accent, icon, title, subtitle, children }) {
  return html4`
    <div class="modal-card" style=${`border-left-color: ${accent};`}>
      <div class="modal-card-head">
        <span class="modal-card-icon" style=${`color: ${accent};`}>${icon}</span>
        <div>
          <div class="modal-card-title">${title}</div>
          ${subtitle ? html4`<div class="modal-card-subtitle">${subtitle}</div>` : null}
        </div>
      </div>
      ${children}
    </div>
  `;
}
function ShellModal({ modal, onResolve }) {
  useLang();
  const isBg = modal.shellKind === "run_background";
  return html4`
    <${ModalCard}
      accent="#f87171"
      icon=${isBg ? "⏱" : "⚡"}
      title=${isBg ? t4("modal.shellBgTitle") : t4("modal.shellTitle")}
      subtitle=${isBg ? t4("modal.shellBgSubtitle") : t4("modal.shellSubtitle")}
    >
      <div class="modal-cmd"><span class="modal-cmd-prompt">$</span> <code>${modal.command}</code></div>
      <div class="modal-actions">
        <button class="primary" onClick=${() => onResolve("shell", "run_once")}>${t4("modal.runOnce")}</button>
        <button onClick=${() => onResolve("shell", "always_allow")}>${t4("modal.alwaysAllow", { prefix: modal.allowPrefix ?? "" })}</button>
        <button class="danger" onClick=${() => onResolve("shell", "deny")}>${t4("modal.deny")}</button>
      </div>
    <//>
  `;
}
function ChoiceModal({ modal, onResolve }) {
  useLang();
  const [custom, setCustom] = d2("");
  const [showCustom, setShowCustom] = d2(false);
  const contextInput = modal.contextInput;
  return html4`
    <${ModalCard} accent=${contextInput ? "#f59e0b" : "#f0abfc"} icon=${contextInput ? "!" : "🔀"} title=${contextInput?.title || t4("modal.choiceTitle")} subtitle=${contextInput ? null : modal.question}>
      ${contextInput ? html4`
        <div class="modal-context-alert">
          <div class="modal-context-alert-title">当前任务已暂停</div>
          <div class="modal-context-alert-reason">${contextInput.reason}</div>
        </div>
        <div class="modal-context-status">
          <div class="modal-context-status-label">当前状态</div>
          <div>${contextInput.statusSummary}</div>
        </div>
        <div class="modal-context-recommendation"><strong>建议：</strong>${contextInput.recommendation}</div>
        <div class="modal-context-question">${modal.question}</div>
      ` : null}
      ${modal.options.map(
    (opt) => html4`
        <button
          key=${opt.id}
          class="modal-choice-row"
          onClick=${() => onResolve("choice", { kind: "pick", optionId: opt.id })}
        >
          <span class="modal-choice-id">${opt.id}</span>
          <span class="modal-choice-title">${opt.title}</span>
          ${opt.summary ? html4`<span class="modal-choice-summary">${opt.summary}</span>` : null}
        </button>
      `
  )}
      ${modal.allowCustom ? showCustom ? html4`
            <div class="modal-custom">
              <textarea
                placeholder=${t4("modal.typePlaceholder")}
                rows="2"
                value=${custom}
                onInput=${(e3) => setCustom(e3.target.value)}
              ></textarea>
              <div class="modal-actions">
                <button class="primary" onClick=${() => onResolve("choice", { kind: "custom", text: custom })} disabled=${!custom.trim()}>${t4("modal.send")}</button>
                <button onClick=${() => {
    setShowCustom(false);
    setCustom("");
  }}>${t4("common.back")}</button>
              </div>
            </div>
          ` : html4`
            <button class="modal-choice-row" onClick=${() => setShowCustom(true)}>
              <span class="modal-choice-id">·</span>
              <span class="modal-choice-title">${t4("modal.typeOwn")}</span>
              <span class="modal-choice-summary">${t4("modal.typeOwnSummary")}</span>
            </button>
          ` : null}
      <button class="modal-choice-row modal-choice-cancel" onClick=${() => onResolve("choice", { kind: "cancel" })}>
        <span class="modal-choice-id">×</span>
        <span class="modal-choice-title">${t4("modal.cancel")}</span>
        <span class="modal-choice-summary">${t4("modal.cancelSummary")}</span>
      </button>
    <//>
  `;
}
function PlanModal({ modal, onResolve }) {
  useLang();
  const [feedback, setFeedback] = d2("");
  const [refining, setRefining] = d2(false);
  return html4`
    <${ModalCard} accent="#67e8f9" icon="◆" title=${t4("modal.planTitle")} subtitle=${modal.summary || t4("modal.planSubtitle")}>
      <div class="md modal-plan-body" dangerouslySetInnerHTML=${{ __html: marked.parse(modal.plan || "") }}></div>
      ${modal.steps?.length ? html4`
        <div class="modal-plan-steps">
          ${modal.steps.map((s3) => html4`
            <div class="modal-plan-step">
              <span class=${`modal-step-risk modal-step-risk-${s3.risk || "low"}`}></span>
              <span class="modal-step-id">${s3.id}</span>
              <span class="modal-step-title">${s3.title}</span>
            </div>
          `)}
        </div>
      ` : null}
      ${refining ? html4`
          <textarea
            placeholder=${t4("modal.refinePlaceholder")}
            rows="3"
            value=${feedback}
            onInput=${(e3) => setFeedback(e3.target.value)}
          ></textarea>
          <div class="modal-actions">
            <button class="primary" disabled=${!feedback.trim()} onClick=${() => onResolve("plan", "refine", feedback)}>${t4("modal.sendRefinement")}</button>
            <button onClick=${() => {
    setRefining(false);
    setFeedback("");
  }}>${t4("common.back")}</button>
          </div>
        ` : html4`
          <div class="modal-actions">
            <button class="primary" onClick=${() => onResolve("plan", "approve")}>${t4("modal.approve")}</button>
            <button onClick=${() => setRefining(true)}>${t4("modal.refine")}</button>
            <button class="danger" onClick=${() => onResolve("plan", "cancel")}>${t4("modal.cancel")}</button>
          </div>
        `}
    <//>
  `;
}
function lineDiff(aLines, bLines) {
  const m3 = aLines.length;
  const n3 = bLines.length;
  const dp = Array.from({ length: m3 + 1 }, () => new Array(n3 + 1).fill(0));
  for (let i4 = 1; i4 <= m3; i4++) {
    for (let j5 = 1; j5 <= n3; j5++) {
      if (aLines[i4 - 1] === bLines[j5 - 1]) dp[i4][j5] = dp[i4 - 1][j5 - 1] + 1;
      else dp[i4][j5] = Math.max(dp[i4 - 1][j5], dp[i4][j5 - 1]);
    }
  }
  const out = [];
  let i3 = m3;
  let j4 = n3;
  while (i3 > 0 || j4 > 0) {
    if (i3 > 0 && j4 > 0 && aLines[i3 - 1] === bLines[j4 - 1]) {
      out.push({ kind: "context", text: aLines[i3 - 1] });
      i3--;
      j4--;
    } else if (j4 > 0 && (i3 === 0 || dp[i3][j4 - 1] >= dp[i3 - 1][j4])) {
      out.push({ kind: "ins", text: bLines[j4 - 1] });
      j4--;
    } else {
      out.push({ kind: "del", text: aLines[i3 - 1] });
      i3--;
    }
  }
  return out.reverse();
}
function pairDiffRows(diff) {
  const rows = [];
  let k32 = 0;
  while (k32 < diff.length) {
    const entry = diff[k32];
    if (entry.kind === "context") {
      rows.push({ left: entry.text, right: entry.text, kind: "context" });
      k32++;
      continue;
    }
    const dels = [];
    const inss = [];
    while (k32 < diff.length && diff[k32].kind === "del") {
      dels.push(diff[k32].text);
      k32++;
    }
    while (k32 < diff.length && diff[k32].kind === "ins") {
      inss.push(diff[k32].text);
      k32++;
    }
    const pairs = Math.max(dels.length, inss.length);
    for (let p3 = 0; p3 < pairs; p3++) {
      const dp = dels[p3];
      const ip = inss[p3];
      rows.push({
        left: dp ?? null,
        right: ip ?? null,
        kind: dp != null && ip != null ? "change" : dp != null ? "del" : "ins"
      });
    }
  }
  return rows;
}
function EditReviewModal({ modal, onResolve }) {
  useLang();
  const search = modal.search ?? "";
  const replace = modal.replace ?? "";
  const lang = langFromPath(modal.path);
  const aLines = search.split("\n");
  const bLines = replace.split("\n");
  const rows = pairDiffRows(lineDiff(aLines, bLines));
  return html4`
    <${ModalCard}
      accent="#86efac"
      icon="◆"
      title=${t4("modal.editTitle")}
      subtitle=${t4("modal.editSubtitle", { path: modal.path ?? "", remaining: modal.remaining, total: modal.total })}
    >
      <div class="edit-diff-wrap">
        <div class="edit-diff-head">
          <div class="edit-diff-side edit-diff-side-old">
            <span class="edit-diff-marker">−</span> ${t4("modal.before")}
          </div>
          <div class="edit-diff-side edit-diff-side-new">
            <span class="edit-diff-marker">+</span> ${t4("modal.after")}
          </div>
        </div>
        <div class="edit-diff-body">
          ${rows.map(
    (row, i3) => html4`
            <div key=${i3} class=${`edit-diff-row edit-diff-row-${row.kind}`}>
              <div class="edit-diff-cell edit-diff-cell-old">
                ${row.left != null ? html4`<span
                        class="edit-diff-line"
                        dangerouslySetInnerHTML=${{ __html: hlLine(row.left, lang) || "&nbsp;" }}
                      ></span>` : html4`<span class="edit-diff-empty">&nbsp;</span>`}
              </div>
              <div class="edit-diff-cell edit-diff-cell-new">
                ${row.right != null ? html4`<span
                        class="edit-diff-line"
                        dangerouslySetInnerHTML=${{ __html: hlLine(row.right, lang) || "&nbsp;" }}
                      ></span>` : html4`<span class="edit-diff-empty">&nbsp;</span>`}
              </div>
            </div>
          `
  )}
        </div>
      </div>
      <div class="modal-actions">
        <button class="primary" onClick=${() => onResolve("edit-review", "apply")}>${t4("chat.confirmBtn")}</button>
        <button onClick=${() => onResolve("edit-review", "reject")}>${t4("chat.rejectBtn")}</button>
        <button onClick=${() => onResolve("edit-review", "apply-rest-of-turn")}>${t4("chat.applyRestBtn")}</button>
      </div>
    <//>
  `;
}
function WorkspaceModal({ modal, onResolve }) {
  useLang();
  return html4`
    <${ModalCard}
      accent="#fbbf24"
      icon="◇"
      title=${t4("modal.workspaceTitle")}
      subtitle=${t4("modal.workspaceSubtitle")}
    >
      <div class="modal-cmd"><span class="modal-cmd-prompt">→</span> <code>${modal.path}</code></div>
      <div class="modal-actions">
        <button class="primary" onClick=${() => onResolve("workspace", "switch")}>${t4("modal.switchBtn")}</button>
        <button class="danger" onClick=${() => onResolve("workspace", "deny")}>${t4("modal.denyBtn")}</button>
      </div>
    <//>
  `;
}
function CheckpointModal({ modal, onResolve }) {
  useLang();
  const [reviseText, setReviseText] = d2("");
  const [staged, setStaged] = d2(false);
  const label = modal.title ? `${modal.stepId} · ${modal.title}` : modal.stepId;
  const counter = (modal.total ?? 0) > 0 ? ` (${modal.completed}/${modal.total})` : "";
  return html4`
    <${ModalCard}
      accent="#a5f3fc"
      icon="✓"
      title=${t4("modal.stepComplete", { counter })}
      subtitle=${label}
    >
      ${modal.result ? html4`<div class="modal-checkpoint-result">${modal.result}</div>` : null}
      ${modal.notes ? html4`<div class="modal-checkpoint-notes">${modal.notes}</div>` : null}
      ${staged ? html4`
          <textarea
            placeholder=${t4("modal.revisePlaceholder")}
            rows="3"
            value=${reviseText}
            onInput=${(e3) => setReviseText(e3.target.value)}
          ></textarea>
          <div class="modal-actions">
            <button class="primary" disabled=${!reviseText.trim()} onClick=${() => onResolve("checkpoint", "revise", reviseText)}>${t4("modal.sendRevision")}</button>
            <button onClick=${() => {
    setStaged(false);
    setReviseText("");
  }}>${t4("common.back")}</button>
          </div>
        ` : html4`
          <div class="modal-actions">
            <button class="primary" onClick=${() => onResolve("checkpoint", "continue")}>${t4("modal.continueBtn")}</button>
            <button onClick=${() => setStaged(true)}>${t4("modal.reviseBtn")}</button>
            <button class="danger" onClick=${() => onResolve("checkpoint", "stop")}>${t4("modal.stopBtn")}</button>
          </div>
        `}
    <//>
  `;
}
function PickerModal({
  modal,
  onResolve
}) {
  useLang();
  const [selectedId, setSelectedId] = d2(modal.items[0]?.id ?? null);
  const [query2, setQuery] = d2(modal.query ?? "");
  const [renameTarget, setRenameTarget] = d2(null);
  const [renameText, setRenameText] = d2("");
  const [showNew, setShowNew] = d2(false);
  const [newText, setNewText] = d2("");
  const has = (a3) => modal.actions.includes(a3);
  const selected = modal.items.find((i3) => i3.id === selectedId) ?? null;
  const submitRefine = (next) => {
    setQuery(next);
    if (has("refine")) onResolve("picker", { action: "refine", query: next });
  };
  const startRename = (id) => {
    const item = modal.items.find((i3) => i3.id === id);
    if (!item) return;
    setRenameTarget(id);
    setRenameText(item.title);
  };
  const sendRename = () => {
    if (!renameTarget || !renameText.trim()) return;
    onResolve("picker", { action: "rename", id: renameTarget, text: renameText });
    setRenameTarget(null);
    setRenameText("");
  };
  const sendNew = () => {
    onResolve("picker", newText.trim() ? { action: "new", text: newText } : { action: "new" });
    setShowNew(false);
    setNewText("");
  };
  return html4`
    <${ModalCard}
      accent="#fcd34d"
      icon="≡"
      title=${modal.title}
      subtitle=${modal.hint}
    >
      ${has("refine") ? html4`<input
              class="modal-picker-search"
              type="search"
              placeholder=${t4("modal.pickerFilter")}
              value=${query2}
              onInput=${(e3) => submitRefine(e3.target.value)}
            />` : null}
      <div class="modal-picker-list">
        ${modal.items.length === 0 ? html4`<div class="modal-picker-empty">${t4("modal.pickerEmpty")}</div>` : modal.items.map(
    (it) => html4`
                  <button
                    key=${it.id}
                    class=${`modal-picker-row${it.id === selectedId ? " selected" : ""}`}
                    onClick=${() => setSelectedId(it.id)}
                    onDblClick=${() => has("pick") && onResolve("picker", { action: "pick", id: it.id })}
                  >
                    <span class="modal-picker-title">${it.title}</span>
                    ${it.badge ? html4`<span class="modal-picker-badge">${it.badge}</span>` : null}
                    ${it.subtitle ? html4`<span class="modal-picker-subtitle">${it.subtitle}</span>` : null}
                    ${it.meta ? html4`<span class="modal-picker-meta">${it.meta}</span>` : null}
                  </button>
                `
  )}
      </div>
      ${modal.hasMore && has("load-more") ? html4`<button
              class="modal-picker-more"
              onClick=${() => onResolve("picker", { action: "load-more" })}
            >${t4("modal.pickerLoadMore")}</button>` : null}
      ${renameTarget ? html4`
            <div class="modal-picker-form">
              <input
                type="text"
                value=${renameText}
                onInput=${(e3) => setRenameText(e3.target.value)}
              />
              <div class="modal-actions">
                <button class="primary" onClick=${sendRename} disabled=${!renameText.trim()}>${t4("common.save")}</button>
                <button onClick=${() => setRenameTarget(null)}>${t4("common.back")}</button>
              </div>
            </div>
          ` : showNew ? html4`
              <div class="modal-picker-form">
                <input
                  type="text"
                  placeholder=${t4("modal.pickerNewPlaceholder")}
                  value=${newText}
                  onInput=${(e3) => setNewText(e3.target.value)}
                />
                <div class="modal-actions">
                  <button class="primary" onClick=${sendNew}>${t4("common.add")}</button>
                  <button onClick=${() => setShowNew(false)}>${t4("common.back")}</button>
                </div>
              </div>
            ` : html4`
              <div class="modal-actions">
                ${has("pick") && selected ? html4`<button
                        class="primary"
                        onClick=${() => onResolve("picker", { action: "pick", id: selected.id })}
                      >${t4("modal.pickerPick")}</button>` : null}
                ${has("install") && selected ? html4`<button
                        class="primary"
                        onClick=${() => onResolve("picker", { action: "install", id: selected.id })}
                      >${t4("modal.pickerInstall")}</button>` : null}
                ${has("uninstall") && selected ? html4`<button
                        onClick=${() => onResolve("picker", { action: "uninstall", id: selected.id })}
                      >${t4("modal.pickerUninstall")}</button>` : null}
                ${has("rename") && selected ? html4`<button onClick=${() => startRename(selected.id)}>${t4("modal.pickerRename")}</button>` : null}
                ${has("delete") && selected ? html4`<button
                        class="danger"
                        onClick=${() => onResolve("picker", { action: "delete", id: selected.id })}
                      >${t4("common.delete")}</button>` : null}
                ${has("new") ? html4`<button onClick=${() => setShowNew(true)}>${t4("modal.pickerNew")}</button>` : null}
                <button onClick=${() => onResolve("picker", { action: "cancel" })}>${t4("modal.cancel")}</button>
              </div>
            `}
    <//>
  `;
}
function ViewerModal({
  modal,
  onResolve
}) {
  useLang();
  return html4`
    <${ModalCard}
      accent="#67e8f9"
      icon="◇"
      title=${modal.title}
      subtitle=${modal.meta}
    >
      ${modal.steps && modal.steps.length > 0 ? html4`
            <ol class="modal-viewer-steps">
              ${modal.steps.map(
    (s3) => html4`
                  <li key=${s3.id} class=${`modal-viewer-step modal-viewer-step-${s3.status}`}>
                    <span class="modal-viewer-step-mark">${s3.status === "done" ? "✓" : "·"}</span>
                    <span class="modal-viewer-step-title">${s3.title}</span>
                  </li>
                `
  )}
            </ol>
          ` : null}
      ${modal.body ? html4`<div class="md modal-viewer-body" dangerouslySetInnerHTML=${{ __html: marked.parse(modal.body) }}></div>` : null}
      <div class="modal-actions">
        <button onClick=${() => onResolve("viewer", { action: "close" })}>${t4("modal.viewerClose")}</button>
      </div>
    <//>
  `;
}
function RevisionModal({ modal, onResolve }) {
  useLang();
  const riskColor = (r3) => r3 === "high" ? "#f87171" : r3 === "med" ? "#fbbf24" : r3 === "low" ? "#86efac" : "#9ca3af";
  return html4`
    <${ModalCard}
      accent="#c4b5fd"
      icon="✎"
      title=${t4("modal.revisionTitle")}
      subtitle=${modal.summary || modal.reason}
    >
      <div class="modal-revise-reason">${modal.reason}</div>
      <ol class="modal-revise-steps">
        ${modal.remainingSteps.map(
    (s3) => html4`
            <li key=${s3.id}>
              <span class="modal-revise-dot" style=${`background:${riskColor(s3.risk)}`}></span>
              <span class="modal-revise-id">${s3.id}</span>
              <span class="modal-revise-title">${s3.title}</span>
              <span class="modal-revise-action">${s3.action}</span>
            </li>
          `
  )}
      </ol>
      <div class="modal-actions">
        <button class="primary" onClick=${() => onResolve("revision", "accept")}>${t4("modal.accept")}</button>
        <button class="danger" onClick=${() => onResolve("revision", "reject")}>${t4("modal.reject")}</button>
      </div>
    <//>
  `;
}

// dashboard/src/lib/format.ts
function fmtUsd(n3) {
  if (n3 === null || n3 === void 0) return "—";
  if (n3 === 0) return "$0";
  return `$${n3.toFixed(n3 < 0.01 ? 6 : 4)}`;
}
var USD_TO_CNY = 7.2;
function fmtCost(usd, currency, fractionDigits) {
  if (usd === null || usd === void 0) return "—";
  const cur = currency ?? "CNY";
  const amount = cur === "CNY" ? usd * USD_TO_CNY : usd;
  if (amount === 0) return cur === "CNY" ? "¥0" : "$0";
  const sym = cur === "CNY" ? "¥" : cur === "USD" ? "$" : `${cur} `;
  const digits = fractionDigits ?? (Math.abs(amount) < 0.01 ? 6 : 4);
  return `${sym}${amount.toFixed(digits)}`;
}
function pickDashboardBalance(infos) {
  if (!Array.isArray(infos) || infos.length === 0) return null;
  let best = infos[0];
  for (let index = 1; index < infos.length; index++) {
    if (Number(infos[index]?.total_balance ?? infos[index]?.total ?? 0) > Number(best?.total_balance ?? best?.total ?? 0)) {
      best = infos[index];
    }
  }
  return best;
}
function primaryBalance(stats) {
  return stats?.primaryBalance ?? pickDashboardBalance(stats?.balance);
}
function fmtPct(n3) {
  if (n3 === null || n3 === void 0) return "—";
  return `${(n3 * 100).toFixed(1)}%`;
}
function fmtNum(n3) {
  if (n3 === null || n3 === void 0) return "—";
  return n3.toLocaleString();
}
function fmtBytes(n3) {
  if (n3 === null || n3 === void 0) return "—";
  if (n3 < 1024) return `${n3} B`;
  if (n3 < 1024 * 1024) return `${(n3 / 1024).toFixed(1)} KB`;
  if (n3 < 1024 * 1024 * 1024) return `${(n3 / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n3 / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
function fmtCompactNum(n3) {
  if (n3 === null || n3 === void 0) return "—";
  if (Math.abs(n3) < 1e3) return String(n3);
  if (Math.abs(n3) < 1e6) {
    const v3 = n3 / 1e3;
    return `${v3 % 1 === 0 ? v3.toFixed(0) : v3.toFixed(1)}K`;
  }
  if (Math.abs(n3) < 1e9) {
    const v3 = n3 / 1e6;
    return `${v3 % 1 === 0 ? v3.toFixed(0) : v3.toFixed(1)}M`;
  }
  return `${(n3 / 1e9).toFixed(1)}B`;
}
function fmtRelativeTime(iso) {
  if (!iso) return "—";
  const ms = typeof iso === "number" ? iso : Date.parse(iso);
  if (!Number.isFinite(ms)) return "—";
  const dSec = (Date.now() - ms) / 1e3;
  if (dSec < 60) return "just now";
  if (dSec < 3600) return `${Math.floor(dSec / 60)}m ago`;
  if (dSec < 86400) return `${Math.floor(dSec / 3600)}h ago`;
  if (dSec < 30 * 86400) return `${Math.floor(dSec / 86400)}d ago`;
  return new Date(ms).toISOString().slice(0, 10);
}

// dashboard/src/lib/use-poll.ts
function usePoll(path, intervalMs = 2e3, sseKind = null) {
  const [data, setData] = d2(null);
  const [error, setError] = d2(null);
  const [loading, setLoading] = d2(true);
  const requestRevision = A2(0);
  const refresh = q2(async () => {
    const revision = ++requestRevision.current;
    try {
      const next = await api(path);
      if (revision === requestRevision.current) {
        setData(next);
        setError(null);
      }
      return next;
    } catch (err) {
      if (revision === requestRevision.current) setError(err);
    } finally {
      if (revision === requestRevision.current) setLoading(false);
    }
  }, [path]);
  const replaceData = q2((next) => {
    requestRevision.current += 1;
    setData(next);
    setError(null);
    setLoading(false);
    return next;
  }, []);
  y2(() => {
    if (sseKind) {
      setLoading(false);
      const unsubscribe = subscribeSse(sseKind, (event) => {
        const { kind: _kind, ...rest } = event;
        requestRevision.current += 1;
        setData(rest);
        setError(null);
      });
      return () => {
        requestRevision.current += 1;
        unsubscribe();
      };
    }
    let cancelled = false;
    let timer = null;
    const tick = async () => {
      if (cancelled) return;
      await refresh();
      if (cancelled) return;
      timer = setTimeout(tick, intervalMs);
    };
    tick();
    return () => {
      cancelled = true;
      requestRevision.current += 1;
      if (timer) clearTimeout(timer);
    };
  }, [refresh, intervalMs, sseKind]);
  return { data, error, loading, refresh, replaceData };
}
var sseSource = null;
var sseListeners = /* @__PURE__ */ new Map();
var sseStatusListeners = [];
var sseChannelsKey = "";
var sseOpened = false;
var sseLastCursor = "";
var sseLastDeliveredCursor = "";
function cursorIsNewer(next, previous) {
  if (!next || !previous) return true;
  const nextMatch = /^([^:]+):(\d+)$/u.exec(next);
  const previousMatch = /^([^:]+):(\d+)$/u.exec(previous);
  if (!nextMatch || !previousMatch || nextMatch[1] !== previousMatch[1]) return true;
  return Number(nextMatch[2]) > Number(previousMatch[2]);
}
function activeSseChannels() {
  const channels = /* @__PURE__ */ new Set();
  for (const [kind, listeners2] of sseListeners) {
    if (!listeners2.length) continue;
    if (["overview", "health", "logs"].includes(kind)) channels.add(kind);
    else channels.add("events");
  }
  return [...channels].sort();
}
function rebuildSharedSse() {
  const channels = activeSseChannels();
  const key = channels.join(",");
  if (key === sseChannelsKey && sseSource) return;
  sseSource?.close();
  sseSource = null;
  sseChannelsKey = key;
  if (!key) return;
  const url = new URL("/api/events", window.location.origin);
  url.searchParams.set("token", TOKEN);
  url.searchParams.set("channels", key);
  if (sseLastCursor) url.searchParams.set("cursor", sseLastCursor);
  const source = new EventSource(url.toString());
  sseSource = source;
  source.onopen = () => {
    const reconnected = sseOpened;
    sseOpened = true;
    for (const handler of [...sseStatusListeners]) handler({ connected: true, reconnected });
  };
  source.onerror = () => {
    for (const handler of [...sseStatusListeners]) handler({ connected: false, reconnected: false });
  };
  source.onmessage = (event) => {
    try {
      const value = JSON.parse(event.data);
      const nextCursor = event.lastEventId || (typeof value.eventId === "string" ? value.eventId : "");
      if (nextCursor && !cursorIsNewer(nextCursor, sseLastDeliveredCursor)) return;
      if (nextCursor) {
        sseLastCursor = nextCursor;
        sseLastDeliveredCursor = nextCursor;
      }
      const handlers = [...sseListeners.get(value.kind ?? "") ?? [], ...sseListeners.get("*") ?? []];
      for (const handler of handlers) handler(value);
    } catch {
    }
  };
}
function subscribeSse(kind, handler) {
  if (!sseListeners.has(kind)) sseListeners.set(kind, []);
  sseListeners.get(kind).push(handler);
  rebuildSharedSse();
  return () => {
    const listeners2 = sseListeners.get(kind) ?? [];
    const index = listeners2.indexOf(handler);
    if (index >= 0) listeners2.splice(index, 1);
    if (listeners2.length === 0) sseListeners.delete(kind);
    rebuildSharedSse();
  };
}
function subscribeSseStatus(handler) {
  sseStatusListeners.push(handler);
  return () => {
    const index = sseStatusListeners.indexOf(handler);
    if (index >= 0) sseStatusListeners.splice(index, 1);
  };
}

// dashboard/src/panels/chat.ts
var N23 = N2;
function planStatus(plan) {
  if (plan?.status) return plan.status;
  if (plan?.completionRatio >= 1) return "done";
  if (plan?.completionRatio > 0) return "active";
  return "idle";
}
function statusPill(plan) {
  const status = planStatus(plan);
  if (status === "done") return html4`<span class="pill ok">${t4("plans.done")}</span>`;
  if (status === "active") return html4`<span class="pill info">${t4("plans.active")}</span>`;
  if (status === "pending") return html4`<span class="pill warn">${t4("plans.pending")}</span>`;
  return html4`<span class="pill">${t4("plans.idle")}</span>`;
}
var CHAT_DRAFT_KEY = "visionox.chatDraft.v1";
var CHAT_INITIAL_RENDER_COUNT = 30;
function parseProviderImportJson(text) {
  const parsed = JSON.parse(String(text || ""));
  if (parsed.schemaVersion === 3) {
    if (!Array.isArray(parsed.operations) || parsed.operations.length === 0) throw new Error("维护 JSON 必须包含非空 operations 数组");
    return parsed;
  }
  if (!Array.isArray(parsed.providers) || parsed.providers.length === 0) throw new Error("JSON 必须包含非空 providers 数组");
  for (const provider of parsed.providers) {
    if (!provider?.id || typeof provider.id !== "string") throw new Error("每个 provider 都必须包含 id");
    if (!Array.isArray(provider.models) || provider.models.length === 0) throw new Error(`provider ${provider.id} 必须包含模型`);
    for (const model of provider.models) {
      if (!model?.id || typeof model.id !== "string") throw new Error(`provider ${provider.id} 中存在无 id 的模型`);
      if (!Number.isSafeInteger(model.maxContextLength) || model.maxContextLength <= 0) throw new Error(`模型 ${model.id} 必须声明有效的 maxContextLength`);
    }
  }
  return parsed;
}
function providerOptionLabel(provider) {
  const name = provider?.name ?? provider?.id ?? "Provider";
  const models = Array.isArray(provider?.models) ? provider.models.filter((model) => model.disabled !== true) : [];
  if (models.length === 0) return name;
  const results = models.map((model) => {
    const modelName = model.name ?? model.id ?? "model";
    return model.testStatus === "passed" ? `${modelName} ✓` : modelName;
  });
  return `${name} · ${results.join(" · ")}`;
}
function providerDisplayGroups(providers) {
  const groups = /* @__PURE__ */ new Map();
  for (const provider of Array.isArray(providers) ? providers : []) {
    const groupId = provider?.ui?.groupId || provider?.id || "default";
    const label = provider?.ui?.groupName || provider?.name || provider?.id || "服务商";
    const group = groups.get(groupId) || { id: groupId, label, providers: [] };
    group.providers.push(provider);
    groups.set(groupId, group);
  }
  return [...groups.values()].map((group) => ({
    ...group,
    providers: group.providers.slice().sort((a3, b3) => (a3?.ui?.order ?? 0) - (b3?.ui?.order ?? 0))
  })).sort((a3, b3) => Math.min(...a3.providers.map((provider) => provider?.ui?.order ?? 0)) - Math.min(...b3.providers.map((provider) => provider?.ui?.order ?? 0)));
}
function providerDisplayLabel(provider) {
  return provider?.ui?.modelLabel || providerOptionLabel(provider);
}
function reasoningEffortLabel(effort) {
  return {
    low: "快速",
    medium: "均衡",
    high: "深入",
    xhigh: "极致",
    max: "极致"
  }[effort] ?? effort;
}
function providerModelContextLabel(model) {
  const tokens = model?.capabilities?.maxContextTokens ?? model?.maxContextLength;
  if (!Number.isFinite(tokens) || tokens <= 0) return "";
  if (tokens >= 1e6) return `${Math.round(tokens / 1e5) / 10}M`;
  return `${Math.round(tokens / 1024)}K`;
}
function providerModelCapabilityLabels(model) {
  const labels = [];
  const modalities = model?.capabilities?.inputModalities ?? (model?.multimodal ? ["text", "image"] : ["text"]);
  labels.push(modalities.includes("image") ? "图文" : "仅文本");
  if (model?.capabilities?.roles?.some((role) => /code/i.test(role)) || /code/i.test(`${model?.id || ""} ${model?.name || ""}`)) labels.push("代码");
  const context = providerModelContextLabel(model);
  if (context) labels.push(context);
  return labels;
}
function providerModelTestSummary(providers) {
  const models = (providers ?? []).flatMap((provider) => (provider.models ?? []).filter((model) => model.disabled !== true));
  return {
    total: models.length,
    passed: models.filter((model) => model.testStatus === "passed").length,
    failed: models.filter((model) => model.testStatus === "failed").length,
    untested: models.filter((model) => model.testStatus === "untested").length
  };
}
var CHAT_RENDER_STEP = 30;
var CHAT_MESSAGE_PAGE_SIZE = 60;
var CHAT_TOP_LOAD_THRESHOLD = 96;
var FILE_ARTIFACT_EXTS = /* @__PURE__ */ new Set(["md", "markdown", "html", "htm", "txt", "pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "csv", "json", "xml", "yaml", "yml", "py", "js", "ts", "tsx", "jsx", "css", "sql", "ps1", "bat", "cmd", "sh", "ini", "toml"]);
var FILE_ARTIFACT_PREVIEW_EXTS = /* @__PURE__ */ new Set(["md", "markdown", "html", "htm", "txt", "csv", "json", "xml", "yaml", "yml", "py", "js", "ts", "tsx", "jsx", "css", "sql", "ps1", "bat", "cmd", "sh", "ini", "toml"]);
var FILE_ARTIFACT_SCRIPT_EXTS = /* @__PURE__ */ new Set(["py", "js", "ts", "tsx", "jsx", "ps1", "bat", "cmd", "sh"]);
function captureChatScrollAnchor(feed) {
  if (!feed) return null;
  const feedTop = feed.getBoundingClientRect().top;
  const nodes = feed.querySelectorAll(".chat-msg[data-msg-id]");
  for (const node of nodes) {
    const rect = node.getBoundingClientRect();
    if (rect.bottom >= feedTop) {
      return { id: node.dataset.msgId, offset: rect.top - feedTop };
    }
  }
  return { id: null, scrollHeight: feed.scrollHeight, scrollTop: feed.scrollTop };
}
function restoreChatScrollAnchor(feed, anchor, done) {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    try {
      if (!feed || !anchor) return;
      if (anchor.id) {
        const node = Array.from(feed.querySelectorAll(".chat-msg[data-msg-id]")).find((item) => item.dataset.msgId === anchor.id);
        if (node) {
          const feedTop = feed.getBoundingClientRect().top;
          feed.scrollTop += node.getBoundingClientRect().top - feedTop - anchor.offset;
          return;
        }
      }
      if (Number.isFinite(anchor.scrollHeight)) {
        feed.scrollTop = anchor.scrollTop + Math.max(0, feed.scrollHeight - anchor.scrollHeight);
      }
    } finally {
      done?.();
    }
  }));
}
function chatDraftKey(workspaceDir, mode) {
  const ws = encodeURIComponent(workspaceDir || "default");
  const m3 = encodeURIComponent(mode || "general");
  return `visionox.chatDraft.v2:${ws}:${m3}`;
}
function removeChatDraft(key) {
  try {
    localStorage.removeItem(key);
    localStorage.removeItem(CHAT_DRAFT_KEY);
  } catch {
  }
}
function fileArtifactKind(ext) {
  const e3 = String(ext || "").replace(/^\./, "").toLowerCase();
  if (e3 === "md" || e3 === "markdown") return "Markdown 文档";
  if (e3 === "html" || e3 === "htm") return "HTML 页面";
  if (e3 === "pdf") return "PDF 文档";
  if (["doc", "docx"].includes(e3)) return "Word 文档";
  if (["ppt", "pptx"].includes(e3)) return "演示文稿";
  if (["xls", "xlsx"].includes(e3)) return "表格文档";
  if (e3 === "csv") return "CSV 表格";
  if (["json", "xml", "yaml", "yml"].includes(e3)) return "数据文件";
  if (FILE_ARTIFACT_SCRIPT_EXTS.has(e3)) return "脚本文件";
  if (["css", "sql", "ini", "toml", "txt"].includes(e3)) return "文本文件";
  return e3 ? `${e3.toUpperCase()} 文件` : "文件";
}
function fileArtifactExtOf(value) {
  const m3 = /\.([A-Za-z0-9]{1,12})(?:$|[?#\s，。；;、)）（\]`*_~])/.exec(String(value || ""));
  return m3 ? m3[1].toLowerCase() : "";
}
function pushFileArtifactCandidate(out, value) {
  const raw = String(value || "").trim().replace(/^["'“”‘’`*_~]+|["'“”‘’`*_~]+$/g, "");
  if (!raw || raw.length > 260) return;
  const ext = fileArtifactExtOf(raw);
  if (!FILE_ARTIFACT_EXTS.has(ext)) return;
  out.add(raw.replace(/[`*_~]+$/g, ""));
}
function extractFileArtifactCandidatesFromText(text, out) {
  const s3 = String(text || "");
  if (!s3) return;
  const extGroup = Array.from(FILE_ARTIFACT_EXTS).join("|");
  const quoted = new RegExp("[\"'“”‘’`]([^\"'“”‘’`\\r\\n]{1,220}\\.(" + extGroup + "))(?:[\"'“”‘’`]|$)", "gi");
  let m3;
  while (m3 = quoted.exec(s3)) pushFileArtifactCandidate(out, m3[1]);
  const pathLike = new RegExp("((?:[A-Za-z]:\\\\|\\\\\\\\|/)[^\\r\\n\"'“”‘’`<>|]{1,220}\\.(" + extGroup + "))", "gi");
  while (m3 = pathLike.exec(s3)) pushFileArtifactCandidate(out, m3[1].trim());
  const markdownWrapped = new RegExp("(?:^|[\\s：:,，。；;、])(?:\\*\\*|__|`|\\*)?([\\w\\u4e00-\\u9fff][\\w\\u4e00-\\u9fff ._()（）\\-]{0,120}\\.(" + extGroup + "))(?:\\*\\*|__|`|\\*)?(?=$|[\\s，。；;、)）（\\]])", "gi");
  while (m3 = markdownWrapped.exec(s3)) pushFileArtifactCandidate(out, m3[1].trim());
  const bare = new RegExp("(?:^|[\\s：:,，。；;、])([\\w\\u4e00-\\u9fff][\\w\\u4e00-\\u9fff ._()（）\\-]{0,120}\\.(" + extGroup + "))(?=$|[\\s，。；;、)）（\\]`*_~])", "gi");
  while (m3 = bare.exec(s3)) pushFileArtifactCandidate(out, m3[1].trim());
}
function latestTurnFileArtifactCandidates(messages) {
  return fileArtifactCandidatesForAssistant(messages, latestAssistantMessageId(messages));
}
function fileArtifactCandidatesForAssistant(messages, assistantId) {
  let assistantIndex = -1;
  if (assistantId) {
    assistantIndex = messages.findIndex((m3) => m3.role === "assistant" && String(m3.id || "") === String(assistantId));
  }
  if (assistantIndex < 0) {
    assistantIndex = messages.map((m3, i3) => [m3, i3]).reverse().find(([m3]) => m3.role === "assistant")?.[1] ?? -1;
  }
  if (assistantIndex < 0) return [];
  let start = 0;
  for (let i3 = assistantIndex - 1; i3 >= 0; i3--) {
    if (messages[i3]?.role === "user") {
      start = i3 + 1;
      break;
    }
  }
  const out = /* @__PURE__ */ new Set();
  const turn = messages.slice(start, assistantIndex + 1);
  for (const msg of turn) {
    extractFileArtifactCandidatesFromText(msg.text, out);
    if (msg.role === "tool") {
      const args = parseToolArgs(msg.toolArgs);
      for (const key of ["path", "filePath", "file_path", "filepath", "filename", "output", "outputPath", "reportPath"]) {
        if (typeof args?.[key] === "string") pushFileArtifactCandidate(out, args[key]);
      }
    }
  }
  return Array.from(out).slice(0, 20);
}
function latestAssistantMessageId(messages) {
  for (let i3 = messages.length - 1; i3 >= 0; i3--) {
    if (messages[i3]?.role === "assistant") return String(messages[i3].id || i3);
  }
  return "";
}
function fileArtifactGroupKey(files) {
  return files.map((f3) => f3.path).sort().join("|");
}
function mergeFileArtifacts(existing, incoming) {
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const file of [...existing || [], ...incoming || []]) {
    if (!file?.path) continue;
    const key = String(file.path).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(file);
  }
  return out;
}
async function showFileArtifactPreview(file) {
  const res = await api("/artifacts/preview", { method: "POST", body: { path: file.path } });
  const ext = String(res.ext || file.ext || "").replace(/^\./, "").toLowerCase();
  showArtifactPreview({
    id: `file-${Date.now()}`,
    filename: res.filename || file.filename,
    path: res.path || file.path,
    dir: res.dir || file.dir,
    lang: ext === "md" ? "markdown" : ext,
    content: res.content || ""
  });
}
async function registerAndPreviewMarkdownDocument(path, cwd = "") {
  const file = await api("/artifacts/register-opened-document", {
    method: "POST",
    body: { path, cwd }
  });
  await showFileArtifactPreview(file);
  showToast(`已打开 ${file.filename || "Markdown 文档"}`, "info");
}
function cleanOpenedDocumentArg(value) {
  let raw = String(value || "").trim();
  raw = raw.replace(/^["'“”‘’]+|["'“”‘’]+$/g, "").trim();
  if (/^file:\/\//i.test(raw)) {
    try {
      raw = decodeURIComponent(raw.replace(/^file:\/\/\/?/i, navigator.platform?.toLowerCase?.().includes("win") ? "" : "/"));
    } catch {
    }
  }
  return raw;
}
function markdownDocumentArgs(args) {
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const value of Array.isArray(args) ? args : []) {
    const path = cleanOpenedDocumentArg(value);
    if (!path || path.startsWith("--")) continue;
    if (!/\.(md|markdown)(?:$|[?#])/i.test(path)) continue;
    const key = path.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(path);
  }
  return out;
}
async function openMarkdownDocumentFromArgs(args, cwd) {
  const docs = markdownDocumentArgs(args);
  if (docs.length === 0) return;
  const key = `${cwd || ""}
${docs.join("\n")}`;
  const now = Date.now();
  const last = window.__visionoxLastOpenedDocumentArgs;
  if (last?.key === key && now - last.ts < 3e3) return;
  window.__visionoxLastOpenedDocumentArgs = { key, ts: now };
  try {
    await registerAndPreviewMarkdownDocument(docs[0], cwd || "");
  } catch (err) {
    showToast(err.message || "Markdown 文档打开失败", "error", 5e3);
  }
}
var MARKDOWN_DOCUMENT_MAX_BYTES = 5 * 1024 * 1024;
function selectMarkdownDocumentFile() {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".md,.markdown,text/markdown,text/plain";
    input.style.position = "fixed";
    input.style.left = "-10000px";
    input.style.top = "0";
    input.style.width = "1px";
    input.style.height = "1px";
    input.style.opacity = "0";
    const cleanup = () => {
      input.remove();
    };
    input.addEventListener("change", () => {
      const file = input.files?.[0] || null;
      cleanup();
      resolve(file);
    }, { once: true });
    input.addEventListener("cancel", () => {
      cleanup();
      resolve(null);
    }, { once: true });
    try {
      document.body.appendChild(input);
      input.click();
    } catch (err) {
      cleanup();
      reject(err);
    }
  });
}
async function previewSelectedMarkdownDocument(file) {
  if (!file) return;
  const filename = file.name || "Markdown 文档.md";
  if (!/\.(md|markdown)$/i.test(filename)) {
    throw new Error("请选择 Markdown 文档");
  }
  if (file.size > MARKDOWN_DOCUMENT_MAX_BYTES) {
    throw new Error(`文件过大，最大支持 ${Math.round(MARKDOWN_DOCUMENT_MAX_BYTES / 1024 / 1024)}MB`);
  }
  const content = await file.text();
  showArtifactPreview({
    id: `opened-markdown-${Date.now().toString(36)}`,
    lang: "markdown",
    ext: filename.toLowerCase().endsWith(".markdown") ? "markdown" : "md",
    label: "MD",
    filename,
    content,
    previewable: true,
    openable: false
  });
  showToast(`已打开 ${filename}`, "info");
}
function pickMarkdownFileFromBridge() {
  return api("/artifacts/pick-markdown-file", { method: "POST", body: {}, timeoutMs: 0 }).then((result) => result?.path || "").catch((apiErr) => {
    if (window.__TAURI__?.invoke) {
      return window.__TAURI__.invoke("pick_markdown_file").then((result) => {
        if (result?.error) throw new Error(result.error);
        return result?.path || "";
      });
    }
    return new Promise((resolve, reject) => {
      if (!window.parent || window.parent === window) {
        reject(new Error("本地文件选择器仅在桌面端可用"));
        return;
      }
      const requestId = `md-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
      const timer = setTimeout(() => {
        window.removeEventListener("message", onMessage);
        reject(new Error("文件选择器响应超时"));
      }, 5 * 60 * 1e3);
      function onMessage(event) {
        const data = event.data;
        if (!data || data.type !== "vis_pick_markdown_file_result") return;
        if (data.requestId && data.requestId !== requestId) return;
        clearTimeout(timer);
        window.removeEventListener("message", onMessage);
        if (data.error) {
          reject(new Error(data.error));
          return;
        }
        resolve(data.path || "");
      }
      window.addEventListener("message", onMessage);
      try {
        window.parent.postMessage({ type: "vis_pick_markdown_file", requestId }, "*");
      } catch (err) {
        clearTimeout(timer);
        window.removeEventListener("message", onMessage);
        reject(err);
      }
    });
  });
}
function documentJobStatusLabel(status) {
  return {
    queued: "排队中",
    running: "处理中",
    waiting_foreground: "等待前台对话",
    waiting_provider: "等待其他模型任务",
    pausing: "正在暂停",
    paused: "已暂停",
    interrupted: "可继续",
    stopped: "已停止，可继续",
    abandoned: "已放弃",
    source_changed: "来源已变化",
    awaiting_output: "内容已完成，等待交付",
    completed: "已完成",
    completed_with_warnings: "已完成，需复核",
    failed: "失败",
    cancelled: "已取消"
  }[status] || status || "未知";
}
function backgroundJobNeedsAttention(job) {
  return job?.needsAttention === true || ["waiting_user", "blocked", "paused"].includes(job?.lifecycle) || ["delivered_with_warnings", "partial", "failed"].includes(job?.outcome) || ["queued", "running", "waiting_conversation", "needs_user", "user_paused"].includes(job?.handoff?.state);
}
function backgroundJobIsActive(job) {
  return job?.active === true || job?.running === true;
}
function backgroundJobGroup(job) {
  if (backgroundJobIsActive(job)) return "active";
  if (backgroundJobNeedsAttention(job)) return "attention";
  return "completed";
}
function backgroundJobGroups(jobs) {
  const values = Array.isArray(jobs) ? jobs : [];
  return [
    { key: "active", label: "运行中" },
    { key: "attention", label: "需要处理" },
    { key: "completed", label: "已完成" }
  ].map((group) => ({ ...group, jobs: values.filter((job) => backgroundJobGroup(job) === group.key) })).filter((group) => group.jobs.length > 0);
}
function isGenericBackgroundTask(job) {
  return String(job?.id ?? "").startsWith("task:");
}
function backgroundJobTitle(job) {
  return job?.goal || job?.command || job?.sourceName || `#${job?.id || "未知任务"}`;
}
function genericTaskLifecycleLabel(lifecycle) {
  return {
    created: "已创建",
    queued: "排队中",
    leased: "已领取",
    running: "处理中",
    assembling: "正在装配",
    paused: "已暂停",
    waiting_user: "等待用户处理",
    blocked: "受阻",
    terminal: "已结束"
  }[lifecycle] || lifecycle || "未知状态";
}
function genericTaskOutcomeLabel(outcome) {
  return {
    delivered: "已交付",
    delivered_with_warnings: "已交付，需复核",
    partial: "部分交付",
    failed: "失败",
    cancelled: "已取消"
  }[outcome] || outcome || "尚无结果";
}
function genericTaskQualityLabel(quality) {
  return {
    verified: "已验证",
    needs_review: "需复核",
    unknown: "未评估"
  }[quality] || quality || "未评估";
}
function genericTaskProgressLabel(job) {
  const progress = job?.progress || {};
  const completed = progress.completedUnits ?? progress.completed;
  const total = progress.totalUnits ?? progress.total;
  const unit = progress.unitLabel || "单元";
  if (Number.isFinite(completed) && Number.isFinite(total) && total > 0) return `${completed}/${total} ${unit}`;
  if (Number.isFinite(completed)) return `已完成 ${completed} ${unit}`;
  return progress.label || progress.currentLabel || genericTaskLifecycleLabel(job?.lifecycle);
}
function genericTaskProgressPercent(job) {
  const progress = job?.progress || {};
  if (Number.isFinite(progress.percent)) return Math.max(0, Math.min(100, progress.percent));
  const completed = Number(progress.completedUnits ?? progress.completed);
  const total = Number(progress.totalUnits ?? progress.total);
  return Number.isFinite(completed) && Number.isFinite(total) && total > 0 ? Math.max(0, Math.min(100, completed / total * 100)) : 0;
}
var GENERIC_TASK_ACTION_LABELS = /* @__PURE__ */ new Map([
  ["pause", "暂停"],
  ["resume", "继续"],
  ["retry", "重试"],
  ["retry_delivery", "确认后重新交付"],
  ["cancel", "取消任务"],
  ["resolve_user_input", "提交处理结果"],
  ["retarget_output", "更改输出位置"],
  ["ack_outcome", "确认结果"],
  ["delete_record", "删除记录"]
]);
function genericTaskActionLabel(action) {
  return GENERIC_TASK_ACTION_LABELS.get(action) || action;
}
function genericTaskArtifactLabel(artifact, index) {
  return artifact?.filename || artifact?.name || artifact?.label || artifact?.path || artifact?.artifactId || `产物 ${index + 1}`;
}
function backgroundActionRequestId() {
  return globalThis.crypto?.randomUUID?.() || `background-action-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
function documentHandoffNotice(job) {
  const state = job?.handoff?.state;
  return {
    queued: { tone: "warn", text: "后台处理已经结束，正在等待 AI 接管并继续交付。" },
    running: { tone: "warn", text: "AI 已接管后台结果，正在核实产物并继续处理。" },
    waiting_conversation: { tone: "warn", text: "任务属于另一个会话。返回发起任务的原会话后，AI 会自动继续处理。" },
    needs_user: { tone: "err", text: `AI 自动接管未完成：${job?.handoff?.lastError || "请检查模型配置后继续处理。"}。确认后可仅重新交付已有结果，不会重新处理文档。` },
    user_paused: { tone: "warn", text: "任务由用户暂停，点击“继续”后才会恢复。" },
    legacy_unassigned: { tone: "warn", text: "这是旧版本创建的任务，无法安全关联到原会话；请在后台面板中手动点击“继续”或“重试”。" }
  }[state] || null;
}
function retryDocumentDelivery(job) {
  return job?.kind === "document" && ["completed", "completed_with_warnings", "failed", "interrupted", "paused", "awaiting_output"].includes(job?.status) && job?.handoff?.state === "needs_user";
}
function documentJobStageLabel(stage) {
  return {
    extracting: "正在读取来源内容",
    "selecting-model": "正在选择可用模型",
    draft: "正在整理当前区块",
    "quality-repair": "正在补全当前区块",
    "quality-review": "正在审校当前区块",
    "batch-complete": "当前区块已保存",
    assembling: "正在组装完整文档",
    summary: "正在生成摘要",
    completed: "文档已经完成",
    failed: "任务执行失败",
    cancelled: "任务已取消",
    stopped: "已停止，检查点已保留",
    abandoned: "任务已放弃",
    "source-changed": "来源已变化",
    "awaiting-output": "最终草稿已保存，等待处理输出路径",
    "waiting-provider": "等待其他模型任务",
    "job-timeout": "本次执行总时限已到",
    "job-call-budget": "本次执行调用预算已用尽"
  }[stage] || "";
}
function documentJobProgressLabel(job) {
  const progress = job?.progress || {};
  const unit = progress.unitLabel || "区块";
  if (progress.total) return `${progress.completed}/${progress.total} ${unit}`;
  if (progress.completed) return `已完成 ${progress.completed} ${unit}`;
  return documentJobStageLabel(progress.stage) || "正在准备文档";
}
function documentRetryLabel(modelIssues) {
  const issues = Array.isArray(modelIssues) ? modelIssues : [];
  if (issues.some((issue) => issue.category === "insufficient_balance" || issue.category === "quota_exhausted")) return "余额/额度处理后重试";
  if (issues.some((issue) => issue.requiresUserAction === true)) return "处理模型问题后重试";
  return "重试失败部分";
}
function documentIssueBatchLabel(issue) {
  const batches = Array.isArray(issue?.affectedBatches) ? issue.affectedBatches : [];
  if (batches.length === 0) return "任务级模型调用";
  const labels = batches.slice(0, 6).map((batch) => batch.label || batch.id).filter(Boolean);
  return `${labels.join("、")}${batches.length > labels.length ? "等" : ""}`;
}
var BackgroundJobsWorkbench = N23(function BackgroundJobsWorkbench2({ jobs, pendingDeliveries, selectedId, detail, onSelect, onClose, onControl, onStop, onAbandon, onDelete, onPreview }) {
  const deliveries = Array.isArray(pendingDeliveries) ? pendingDeliveries : [];
  const deliveryTaskIds = new Set(deliveries.map((delivery) => String(delivery?.taskId ?? "")).filter(Boolean));
  const displayJobs = jobs.map((job) => deliveryTaskIds.has(String(job.id)) ? { ...job, needsAttention: true } : job);
  const detailMatchesSelection = detail && String(detail.id ?? "") === String(selectedId ?? "");
  const selected = detailMatchesSelection ? detail : displayJobs.find((job) => job.id === selectedId) || null;
  const groups = backgroundJobGroups(displayJobs);
  const isDocument = selected?.kind === "document";
  const isGenericTask = isGenericBackgroundTask(selected);
  const progress = selected?.progress || {};
  const sourcePaths = Array.isArray(selected?.sourcePaths) ? selected.sourcePaths : [];
  const criteria = Array.isArray(selected?.contract?.completionCriteria) ? selected.contract.completionCriteria : [];
  const modelHistory = Array.isArray(selected?.modelHistory) ? selected.modelHistory : [];
  const events = Array.isArray(selected?.events) ? selected.events.slice(-30).reverse() : [];
  const preview = selected?.preview?.content ? String(selected.preview.content).slice(0, 12e4) : "";
  const modelIssues = Array.isArray(selected?.modelIssues) ? selected.modelIssues : [];
  const reviewWarnings = (Array.isArray(selected?.warnings) ? selected.warnings : []).filter((warning) => warning?.type !== "model-service-issue");
  const handoffNotice = documentHandoffNotice(selected);
  const deliveryRetryable = retryDocumentDelivery(selected);
  const showReviewReasons = selected?.status === "completed_with_warnings" || selected?.status === "failed" || selected?.qualityPassed === false;
  const resumable = ["paused", "interrupted", "stopped", "source_changed", "awaiting_output"].includes(selected?.status) || ["missing", "modified"].includes(selected?.artifactStatus) && Boolean(selected?.finalDraft);
  const active = selected?.running || ["queued", "waiting_foreground", "pausing"].includes(selected?.status);
  const handoffActive = ["queued", "running"].includes(selected?.handoff?.state);
  const abandonable = active || ["paused", "interrupted", "stopped", "failed", "source_changed"].includes(selected?.status);
  const deletable = isDocument && !active && !handoffActive && !selected?.running;
  const genericAllowedActions = Array.isArray(selected?.allowedActions) ? selected.allowedActions.filter((action) => GENERIC_TASK_ACTION_LABELS.has(action)) : [];
  const genericArtifacts = Array.isArray(selected?.artifactRefs) ? selected.artifactRefs : [];
  const genericWarnings = [
    ...Array.isArray(selected?.warnings) ? selected.warnings : [],
    ...Array.isArray(selected?.issues) ? selected.issues : []
  ];
  const genericUserAction = selected?.userAction;
  const genericUserActionText = typeof genericUserAction === "string" ? genericUserAction : genericUserAction?.question || genericUserAction?.message || genericUserAction?.prompt || genericUserAction?.label || "任务需要你的补充信息后才能继续。";
  const genericOutcomeSummary = typeof selected?.outcomeSummary === "string" ? selected.outcomeSummary.trim() : "";
  const genericBlockingReason = selected?.blockingReason;
  const genericBlockingReasonText = typeof genericBlockingReason === "string" ? genericBlockingReason : genericBlockingReason?.message || genericBlockingReason?.reason || genericBlockingReason?.code || "";
  const genericBlockingReasonCode = typeof genericBlockingReason === "object" && genericBlockingReason?.code ? String(genericBlockingReason.code) : "";
  const genericUserInputRequestId = genericUserAction?.requestId || selected?.userInputRequest?.requestId || null;
  const selectedDeliveries = deliveries.filter((delivery) => String(delivery?.taskId ?? "") === String(selected?.id ?? ""));
  const selectedDelivery = selectedDeliveries.find((delivery) => delivery?.target === "task-center") || selectedDeliveries.find((delivery) => delivery?.target === "conversation") || selectedDeliveries[0] || null;
  const conversationDelivery = selectedDeliveries.find((delivery) => delivery?.target === "conversation") || null;
  const genericDeliveryStates = selectedDeliveries.filter((delivery) => delivery?.deliveryState);
  const runGenericAction = (action) => {
    if (!selected) return;
    if (["cancel", "delete_record"].includes(action) && !confirm(action === "cancel" ? "确定取消这个任务？已保存的检查点和产物不会被删除。" : "确定删除这条任务记录？已经交付的产物不会被删除。")) return;
    let payload = null;
    if (action === "resolve_user_input") {
      const options2 = Array.isArray(genericUserAction?.choices) ? genericUserAction.choices : Array.isArray(genericUserAction?.options) ? genericUserAction.options : [];
      const optionText = options2.map((option, index) => `${index + 1}. ${option?.label || option?.value || option?.id || option}`).join("\n");
      const value = prompt(`${genericUserActionText}${optionText ? `

${optionText}` : ""}`, "");
      if (value === null) return;
      const normalizedValue = value.trim();
      const indexedOption = /^[1-9]\d*$/.test(normalizedValue) ? options2[Number(normalizedValue) - 1] : null;
      const matchedOption = indexedOption ?? options2.find((option) => {
        const candidates = typeof option === "string" ? [option] : [option?.id, option?.choiceId, option?.value, option?.label];
        return candidates.some((candidate) => String(candidate ?? "").trim() === normalizedValue);
      });
      const choiceId = typeof matchedOption === "string" ? matchedOption.trim() : String(matchedOption?.id ?? matchedOption?.choiceId ?? matchedOption?.value ?? "").trim();
      payload = {
        ...choiceId ? { choiceId } : { value: normalizedValue },
        ...genericUserInputRequestId ? { requestId: genericUserInputRequestId } : {}
      };
    }
    if (action === "retarget_output") {
      const path = prompt("请输入新的输出文件完整路径", selected.outputPath || "");
      if (path === null || !path.trim()) return;
      payload = { path: path.trim(), ...genericUserInputRequestId ? { requestId: genericUserInputRequestId } : {} };
    }
    if (action === "ack_outcome") {
      if (!selectedDelivery?.deliveryId || !selectedDelivery?.target) return;
      payload = { deliveryId: selectedDelivery.deliveryId, consumer: selectedDelivery?.target };
    }
    if (action === "retry_delivery") {
      if (!conversationDelivery?.deliveryId) return;
      if (!confirm("上一次对话交付结果不确定，重新交付可能产生重复回复。是否确认继续？")) return;
      payload = { deliveryId: conversationDelivery.deliveryId, consumer: "conversation" };
    }
    onControl(selected.id, action, payload);
  };
  const modelCaption = selected?.model ? `${selected.running ? "当前模型" : "最近使用模型"} · ${selected.model}${selected.modelRole === "fallback" ? "（备用候选）" : ""}` : "尚未开始模型调用";
  const retryLabel = documentRetryLabel(modelIssues);
  return html4`
    <section class="background-jobs-workbench" style="flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden;background:var(--surface-default);border-top:1px solid var(--border-default)">
      <header class="background-jobs-header">
        <div class="background-jobs-heading"><strong>后台任务</strong><span class="meta">运行中 ${displayJobs.filter((job) => backgroundJobGroup(job) === "active").length} · 待处理 ${displayJobs.filter((job) => backgroundJobGroup(job) === "attention").length} · 共 ${displayJobs.length}${deliveries.length > 0 ? ` · 待确认通知 ${deliveries.length}` : ""}</span></div>
        <button type="button" class="background-jobs-close" onClick=${onClose} title="返回对话（Esc）" aria-label="返回对话"><span aria-hidden="true">←</span><span>返回对话</span></button>
      </header>
      <div class="background-jobs-layout">
        <nav class="background-jobs-list">
          ${displayJobs.length === 0 ? html4`<div class="meta" style="padding:18px">当前没有后台任务</div>` : groups.map((group) => html4`
            <section class="background-job-group" aria-label=${group.label}>
              <div class="background-job-group-title"><span>${group.label}</span><span>${group.jobs.length}</span></div>
              ${group.jobs.map((job) => html4`
                <button type="button" class=${`background-job-list-item ${job.id === selected?.id ? "selected" : ""}`} onClick=${() => onSelect(job.id)}>
                  <div class="background-job-list-heading"><span class=${`pill ${backgroundJobIsActive(job) ? "info" : backgroundJobNeedsAttention(job) ? "warn" : job.status === "completed" || job.outcome === "delivered" ? "ok" : ""}`}>${job.kind === "document" || job.taskType === "document" ? "文档" : job.lifecycle === "service" ? "服务" : "任务"}</span><span class="name">${backgroundJobTitle(job)}</span></div>
                  <div class="meta background-job-list-meta"><span>${isGenericBackgroundTask(job) ? genericTaskLifecycleLabel(job.lifecycle) : job.kind === "document" ? documentJobStatusLabel(job.status) : job.running ? "运行中" : `exit ${job.exitCode ?? "?"}`}</span><span>${isGenericBackgroundTask(job) ? genericTaskProgressLabel(job) : job.kind === "document" ? documentJobProgressLabel(job) : ""}</span></div>
                </button>
              `)}
            </section>
          `)}
        </nav>
        <main class="background-jobs-detail">
          ${!selected ? html4`<div class="meta">选择左侧任务查看详情</div>` : isGenericTask ? html4`
            <div class="background-task-detail-head">
              <div style="min-width:0;flex:1"><h3>${backgroundJobTitle(selected)}</h3><div class="meta">${selected.id} · ${genericTaskLifecycleLabel(selected.lifecycle)} · ${genericTaskOutcomeLabel(selected.outcome)} · ${genericTaskQualityLabel(selected.quality)}</div></div>
              <div class="background-task-actions">
                ${genericAllowedActions.map((action) => html4`<button type="button" class=${action === "resume" ? "primary" : action === "cancel" || action === "delete_record" ? "danger" : ""} onClick=${() => runGenericAction(action)}>${genericTaskActionLabel(action)}</button>`)}
              </div>
            </div>
            <div class="background-task-progress"><div style=${`width:${genericTaskProgressPercent(selected)}%`}></div></div>
            <div class="meta background-task-facts"><span>${genericTaskProgressLabel(selected)}</span><span>修订 ${selected.revision ?? 0}</span>${selected.executionEpoch ? html4`<span>执行轮次 ${selected.executionEpoch}</span>` : null}</div>
            ${genericOutcomeSummary ? html4`<div class="notice background-task-outcome-summary"><strong>结果摘要</strong><div>${genericOutcomeSummary}</div></div>` : null}
            ${genericBlockingReasonText ? html4`<div class="notice warn background-task-blocking-reason"><strong>阻塞原因</strong><div>${genericBlockingReasonText}${genericBlockingReasonCode && genericBlockingReasonCode !== genericBlockingReasonText ? html4` <span class="meta">(${genericBlockingReasonCode})</span>` : null}</div></div>` : null}
            ${selected.userAction ? html4`<div class="notice warn background-task-user-action"><strong>需要你的处理</strong><div>${genericUserActionText}</div></div>` : null}
            ${genericDeliveryStates.length > 0 ? html4`<section class="background-task-section"><h4>交付状态</h4>${genericDeliveryStates.map((delivery) => {
    const deliveryState = delivery.deliveryState || {};
    const deliveryMessage = deliveryState.lastError || deliveryState.reason || deliveryState.code || "等待交付确认";
    const deliveryCode = deliveryState.code && deliveryState.code !== deliveryMessage ? deliveryState.code : "";
    return html4`<div class=${`notice ${["blocked_user_retry", "exhausted"].includes(deliveryState.status) ? "err" : "warn"}`}><strong>${delivery.target === "conversation" ? "对话" : "任务中心"}交付 · ${deliveryState.status || "等待中"}</strong><div>${deliveryMessage}${deliveryCode ? html4` <span class="meta">(${deliveryCode})</span>` : null}</div></div>`;
  })}</section>` : null}
            ${genericWarnings.length > 0 ? html4`<section class="background-task-section"><h4>需要留意</h4>${genericWarnings.map((warning) => html4`<div class="notice ${warning?.severity === "error" ? "err" : "warn"}">${warning?.message || warning?.detail || warning}</div>`)}</section>` : null}
            <section class="background-task-section"><h4>产物</h4>${genericArtifacts.length === 0 ? html4`<div class="meta">暂未生成产物</div>` : html4`<ul class="background-task-artifacts">${genericArtifacts.map((artifact, index) => html4`<li><span title=${artifact?.path || ""}>${genericTaskArtifactLabel(artifact, index)}</span>${artifact?.path ? html4`<button type="button" onClick=${() => onPreview(selected, artifact)}>预览</button>` : null}</li>`)}</ul>`}</section>
            ${selected.coverage ? html4`<section class="background-task-section"><h4>覆盖情况</h4><div class="meta">${typeof selected.coverage === "string" ? selected.coverage : JSON.stringify(selected.coverage)}</div></section>` : null}
          ` : !isDocument ? html4`
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px"><div><h3 style="margin:0 0 6px;font-size:15px">${selected.command}</h3><div class="meta">${selected.running ? "正在运行" : `已结束 · exit ${selected.exitCode ?? "?"}`}</div></div>${selected.running ? html4`<button type="button" onClick=${() => onStop(selected.id)}>停止</button>` : null}</div>
          ` : html4`
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap">
              <div style="min-width:0;flex:1"><h3 style="margin:0 0 5px;font-size:16px;overflow-wrap:anywhere">${selected.command}</h3><div class="meta">${documentJobStatusLabel(selected.status)} · ${documentJobStageLabel(progress.stage) || "等待下一步"}</div></div>
              <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">
                ${selected.running && !selected.paused ? html4`<button type="button" onClick=${() => onControl(selected.id, "pause")}>暂停</button>` : null}
                ${resumable ? html4`<button type="button" class="primary" onClick=${() => onControl(selected.id, "resume")}>${selected.artifactStatus === "modified" ? "另存后台草稿" : selected.artifactStatus === "missing" ? "恢复最终文件" : selected.status === "awaiting_output" ? "提交已保存草稿" : "继续"}</button>` : null}
                ${["completed_with_warnings", "failed"].includes(selected.status) ? html4`<button type="button" title=${modelIssues.find((issue) => issue.requiresUserAction)?.action || "重试失败部分"} onClick=${() => onControl(selected.id, "retry")}>${retryLabel}</button>` : null}
                ${deliveryRetryable ? html4`<button type="button" title="只重新交付已有结果，不会重新处理文档" onClick=${() => {
    if (confirm("只重新交付已有结果，不会重新处理文档。可能产生重复回复，是否继续？")) onControl(selected.id, "retry_delivery");
  }}>仅重新交付</button>` : null}
                ${active ? html4`<button type="button" onClick=${() => onStop(selected.id)}>立即停止</button>` : null}
                ${abandonable ? html4`<button type="button" onClick=${() => {
    if (confirm("放弃任务会终止后续处理，但保留任务记录和已保存草稿。确定继续？")) onAbandon(selected.id);
  }}>放弃</button>` : null}
                ${selected.previewAvailable || ["completed", "completed_with_warnings"].includes(selected.status) ? html4`<button type="button" onClick=${() => onPreview(selected)}>预览产物</button>` : null}
                ${deletable ? html4`<button type="button" onClick=${() => {
    if (confirm("仅删除任务记录和中间草稿；源文件及已经生成的最终产物不会删除。确定继续？")) onDelete(selected.id);
  }}>删除记录</button>` : null}
              </div>
            </div>
            <div style="height:6px;background:var(--border-subtle);overflow:hidden;margin:16px 0 8px"><div style=${`height:100%;width:${progress.percent ?? 0}%;background:${selected.qualityPassed === false ? "var(--color-warning)" : "var(--accent-primary)"}`}></div></div>
            <div class="meta" style="display:flex;gap:18px;flex-wrap:wrap"><span>${documentJobProgressLabel(selected)}</span><span>累计模型调用 ${progress.taskModelCalls || 0} 次 · 本次执行 ${progress.executionModelCalls || 0} / ${progress.taskModelCallLimit || "—"} 次</span><span>${modelCaption}</span>${progress.currentLabel ? html4`<span title=${progress.currentLabel}>当前区块 · ${progress.currentLabel}</span>` : null}</div>
            ${handoffNotice ? html4`<div class=${`notice ${handoffNotice.tone}`} style="margin-top:12px">${handoffNotice.text}</div>` : null}
            ${selected.status === "awaiting_output" ? html4`<div class="notice warn" style="margin-top:12px"><strong>内容整理和最终草稿已经完成。</strong><div style="margin-top:4px">点击“提交已保存草稿”即可继续；若同名文件仍被占用，程序会自动使用新文件名，且不会再次调用模型。</div></div>` : null}
            ${selected.artifactStatus === "missing" ? html4`<div class="notice err" style="margin-top:12px"><strong>最终输出文件已不存在。</strong><div style="margin-top:4px">任务记录和后台保存的最终草稿仍在，可以点击“继续”尝试恢复交付。</div></div>` : null}
            ${selected.artifactStatus === "modified" ? html4`<div class="notice warn" style="margin-top:12px"><strong>最终输出文件已被修改。</strong><div style="margin-top:4px">当前文件与任务完成时保存的草稿不一致。点击“另存后台草稿”会保留当前文件，并把已验证草稿保存为新文件。</div></div>` : null}
            ${selected.status === "completed_with_warnings" ? html4`<div class="notice warn" style="margin-top:12px"><strong>任务已经结束，输出文件已生成。</strong><div style="margin-top:4px">部分区块未通过完整质量审查，请根据下方原因处理后复核或重试。</div></div>` : null}
            ${selected.error ? html4`<div class="notice err" style="margin-top:12px">${selected.error}</div>` : null}
            ${showReviewReasons && (reviewWarnings.length > 0 || modelIssues.length > 0) ? html4`
              <section style="margin-top:18px">
                <h4 style="font-size:13px;margin:0 0 8px">需要复核的原因</h4>
                ${reviewWarnings.map((warning) => html4`<div class="notice warn" style="margin:0 0 8px">${warning.message || "部分内容需要复核。"}</div>`)}
                ${modelIssues.map((issue) => html4`
                  <div class="notice warn" style="margin:0 0 8px">
                    <div><strong>${issue.providerId || "未知服务商"}/${issue.modelId || "未知模型"}</strong> · ${issue.message || "模型调用失败"}</div>
                    <div class="meta" style="margin-top:5px">影响区块 · ${documentIssueBatchLabel(issue)}</div>
                    ${issue.action ? html4`<div style="margin-top:5px">建议：${issue.action}</div>` : null}
                    ${Array.isArray(issue.technicalMessages) && issue.technicalMessages.length > 0 ? html4`<details style="margin-top:6px"><summary class="meta" style="cursor:pointer">技术信息</summary><div class="meta" style="margin-top:5px;overflow-wrap:anywhere">${issue.technicalMessages.join("；")}</div></details>` : null}
                  </div>
                `)}
              </section>
            ` : null}
            <section style="margin-top:18px"><h4 style="font-size:13px;margin:0 0 8px">来源与产物</h4><div class="meta" style="overflow-wrap:anywhere">输出 · ${selected.outputPath || "尚未确定"}</div>${sourcePaths.length > 0 ? html4`<ol style="margin:8px 0 0;padding-left:22px">${sourcePaths.map((path) => html4`<li style="font-size:12px;line-height:1.6;overflow-wrap:anywhere">${path}</li>`)}</ol>` : null}</section>
            ${criteria.length > 0 ? html4`<section style="margin-top:18px"><h4 style="font-size:13px;margin:0 0 8px">完成条件</h4><ul style="margin:0;padding-left:20px">${criteria.map((item) => html4`<li style="font-size:12px;line-height:1.6">${item}</li>`)}</ul></section>` : null}
            ${modelHistory.length > 0 ? html4`<section style="margin-top:18px"><h4 style="font-size:13px;margin:0 0 8px">模型调用链</h4><div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr><th style="text-align:left;padding:6px;border-bottom:1px solid var(--border-default)">模型</th><th style="text-align:left;padding:6px;border-bottom:1px solid var(--border-default)">角色</th><th style="text-align:left;padding:6px;border-bottom:1px solid var(--border-default)">结果</th><th style="text-align:left;padding:6px;border-bottom:1px solid var(--border-default)">调用</th></tr></thead><tbody>${modelHistory.slice(-50).map((entry) => html4`<tr><td style="padding:6px;border-bottom:1px solid var(--border-subtle)">${entry.providerId}/${entry.modelId}</td><td style="padding:6px;border-bottom:1px solid var(--border-subtle)">${entry.role === "fallback" ? "备用" : "主模型"}</td><td style="padding:6px;border-bottom:1px solid var(--border-subtle)">${entry.passed ? "通过" : "未通过"}</td><td style="padding:6px;border-bottom:1px solid var(--border-subtle)">${entry.attempts || 0}</td></tr>`)}</tbody></table></div></section>` : null}
            ${preview ? html4`<section style="margin-top:18px"><h4 style="font-size:13px;margin:0 0 8px">已保存草稿预览${selected.preview?.partial ? "（处理中）" : ""}</h4><pre style="margin:0;max-height:360px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;padding:12px;background:var(--surface-subtle);border:1px solid var(--border-default);font-size:12px;line-height:1.55">${preview}${String(selected.preview.content).length > preview.length ? "\n\n[预览过长，已在工作台截断显示]" : ""}</pre></section>` : null}
            ${events.length > 0 ? html4`<section style="margin-top:18px"><h4 style="font-size:13px;margin:0 0 8px">最近事件</h4>${events.map((event) => html4`<div class="meta" style="display:grid;grid-template-columns:150px minmax(0,1fr);gap:8px;padding:5px 0;border-bottom:1px solid var(--border-subtle)"><span>${event.at ? new Date(event.at).toLocaleString() : ""}</span><span style="overflow-wrap:anywhere">${event.type || "event"}${event.batchId ? ` · ${event.batchId}` : ""}${event.error ? ` · ${event.error}` : ""}</span></div>`)}</section>` : null}
          `}
        </main>
      </div>
    </section>
  `;
});
function pickWorkspaceDirectoryFromBridge() {
  if (window.__TAURI__?.invoke) {
    return window.__TAURI__.invoke("pick_directory").then((result) => {
      if (result?.error) throw new Error(result.error);
      return result?.path || "";
    });
  }
  return new Promise((resolve, reject) => {
    if (!window.parent || window.parent === window) {
      reject(new Error("本地目录选择器仅在桌面端可用"));
      return;
    }
    const requestId = `workspace-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    const timer = setTimeout(() => {
      window.removeEventListener("message", onMessage);
      reject(new Error("目录选择器响应超时"));
    }, 5 * 60 * 1e3);
    function onMessage(event) {
      const data = event.data;
      if (!data || data.type !== "vis_pick_directory_result" || data.requestId !== requestId) return;
      clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      if (data.error) reject(new Error(data.error));
      else resolve(data.path || "");
    }
    window.addEventListener("message", onMessage);
    window.parent.postMessage({ type: "vis_pick_directory", requestId }, "*");
  });
}
async function openMarkdownDocumentByPicker() {
  try {
    showToast("请选择 Markdown 文档...", "info", 1500);
    try {
      const path = await pickMarkdownFileFromBridge();
      if (!path) return;
      await registerAndPreviewMarkdownDocument(path);
      return;
    } catch (pickerErr) {
      if (typeof document === "undefined") throw pickerErr;
      const file = await selectMarkdownDocumentFile();
      if (!file) return;
      await previewSelectedMarkdownDocument(file);
      return;
    }
  } catch (err) {
    showToast(err.message || "Markdown 文档打开失败", "error", 5e3);
  }
}
window.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.type !== "vis_open_args") return;
  openMarkdownDocumentFromArgs(data.args, data.cwd);
});
function FileArtifactsCard({ files, selected, onFollowLatest, onDismiss }) {
  useLang();
  if (!files || files.length === 0) return null;
  const visible = files.slice(0, 12);
  const more = files.length - visible.length;
  const groups = [];
  for (const file of visible) {
    const dir = file.dir || "";
    let group = groups.find((item) => item.dir === dir);
    if (!group) {
      group = { dir, files: [] };
      groups.push(group);
    }
    group.files.push(file);
  }
  const action = async (kind, file) => {
    try {
      if (kind === "preview") {
        await showFileArtifactPreview(file);
      } else if (kind === "open") {
        if (!await confirmExternalArtifactOpen(file)) return;
        await api("/artifacts/open-file", { method: "POST", body: { path: file.path } });
      } else if (kind === "folder") {
        if (!await confirmExternalArtifactOpen(file)) return;
        await api("/artifacts/open-folder", { method: "POST", body: { path: file.path } });
      } else if (kind === "copy") {
        await writeClipboardText(file.path);
        showToast("路径已复制", "info");
      }
    } catch (err) {
      showToast(err.message || "文件操作失败", "error", 5e3);
    }
  };
  return html4`
    <div class="rail-card file-artifact-card">
      <div class="rh">
        <span>${selected ? "当前回复文件" : "最新生成文件"}</span>
        ${selected ? html4`<button type="button" class="rail-card-link" onClick=${onFollowLatest}>回到最新</button>` : null}
        <button type="button" class="rail-card-close" onClick=${onDismiss} title="隐藏">×</button>
      </div>
      <div class="file-artifact-summary">检测到 ${files.length} 个可操作文件${groups.length > 1 ? ` · ${groups.length} 个文件夹` : ""}</div>
      <div class="file-artifact-list">
        ${groups.map((group) => html4`
          <div class="file-artifact-group" key=${group.dir || "root"}>
            ${groups.length > 1 ? html4`<div class="file-artifact-dir" title=${group.dir}>${group.dir || "当前目录"}</div>` : null}
            ${group.files.map((file) => {
    const ext = String(file.ext || "").replace(/^\./, "").toLowerCase();
    const canPreview = file.previewable || FILE_ARTIFACT_PREVIEW_EXTS.has(ext);
    const canOpen = !canPreview && file.openable !== false && !FILE_ARTIFACT_SCRIPT_EXTS.has(ext);
    return html4`
            <div class="file-artifact-item" key=${file.path}>
              <div class="file-artifact-name" title=${file.path}>${file.filename}</div>
              <div class="file-artifact-meta">${fileArtifactKind(ext)}${file.size ? ` · ${fmtBytes(file.size)}` : ""}</div>
              <div class="file-artifact-actions">
                ${canPreview ? html4`<button type="button" onClick=${() => action("preview", file)}>查看</button>` : null}
                ${canOpen ? html4`<button type="button" onClick=${() => action("open", file)}>打开</button>` : null}
                <button type="button" onClick=${() => action("folder", file)}>所在文件夹</button>
                <button type="button" onClick=${() => action("copy", file)}>复制路径</button>
              </div>
            </div>
          `;
  })}
          </div>
        `)}
      </div>
      ${more > 0 ? html4`<div class="file-artifact-more">还有 ${more} 个文件，已自动去重</div>` : null}
    </div>
  `;
}
function recentFileSourceLabel(source) {
  if (source === "report") return "任务报告";
  if (source === "opened") return "打开过";
  if (source === "saved") return "另存产物";
  if (source === "generated") return "生成文件";
  return "文件";
}
function fmtRecentFileTime(ms) {
  if (!Number.isFinite(Number(ms))) return "时间未知";
  try {
    return new Date(Number(ms)).toLocaleString();
  } catch {
    return "时间未知";
  }
}
function FilesPanel() {
  useLang();
  const [files, setFiles] = d2([]);
  const [loading, setLoading] = d2(true);
  const [error, setError] = d2(null);
  const [query, setQuery] = d2("");
  const load = q2(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api("/artifacts/recent", { method: "POST", body: { limit: 120 } });
      setFiles(Array.isArray(res.files) ? res.files : []);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);
  y2(() => {
    load();
  }, [load]);
  const needle = query.trim().toLowerCase();
  const visible = needle ? files.filter((file) => {
    const text = [file.filename, file.path, file.dir, recentFileSourceLabel(file.source)].filter(Boolean).join(" ").toLowerCase();
    return text.includes(needle);
  }) : files;
  const action = async (kind, file) => {
    try {
      if (kind === "preview") {
        await showFileArtifactPreview(file);
      } else if (kind === "open") {
        await api("/artifacts/open-file", { method: "POST", body: { path: file.path } });
      } else if (kind === "folder") {
        await api("/artifacts/open-folder", { method: "POST", body: { path: file.path } });
      } else if (kind === "copy") {
        await writeClipboardText(file.path);
        showToast("路径已复制", "info");
      }
    } catch (err) {
      showToast(err.message || "文件操作失败", "error", 5e3);
    }
  };
  return html4`
    <div class="files-panel">
      <div class="files-toolbar">
        <div class="files-heading">
          <div class="files-title">文件中心</div>
          <div class="files-subtitle">集中查看最近生成、打开和任务输出的文件</div>
        </div>
        <input
          class="input files-search"
          value=${query}
          onInput=${(e3) => setQuery(e3.target.value)}
          placeholder="搜索文件名或路径"
        />
        <button class="btn" onClick=${load} disabled=${loading}>${loading ? "刷新中..." : "刷新"}</button>
      </div>
      ${error ? html4`<div class="files-notice err">文件列表加载失败：${error.message}</div>` : null}
      ${loading && files.length === 0 ? html4`<div class="files-empty">正在加载最近文件...</div>` : null}
      ${!loading && visible.length === 0 ? html4`<div class="files-empty">${query.trim() ? "没有匹配的文件。" : "暂无最近文件。对话生成文件、任务报告或打开 Markdown 后会出现在这里。"}</div>` : null}
      ${visible.length > 0 ? html4`
        <div class="files-summary">共 ${files.length} 个最近文件${query.trim() ? ` · 当前显示 ${visible.length} 个` : ""}</div>
        <div class="files-list">
          ${visible.map((file) => {
    const ext = String(file.ext || "").replace(/^\./, "").toLowerCase();
    const canPreview = file.previewable || FILE_ARTIFACT_PREVIEW_EXTS.has(ext);
    const canOpen = !canPreview && file.openable !== false && !FILE_ARTIFACT_SCRIPT_EXTS.has(ext);
    return html4`
            <div class="files-row" key=${file.path}>
              <div class="files-main">
                <div class="files-name" title=${file.path}>${file.filename || file.path}</div>
                <div class="files-path" title=${file.path}>${file.path}</div>
                <div class="files-meta">
                  <span>${fileArtifactKind(ext)}</span>
                  <span>${fmtBytes(file.size)}</span>
                  <span>${fmtRecentFileTime(file.mtimeMs)}</span>
                </div>
              </div>
              <div class="files-side">
                <span class="files-source">${recentFileSourceLabel(file.source)}</span>
                <div class="files-actions">
                  ${canPreview ? html4`<button type="button" onClick=${() => action("preview", file)}>查看</button>` : null}
                  ${canOpen ? html4`<button type="button" onClick=${() => action("open", file)}>打开</button>` : null}
                  <button type="button" onClick=${() => action("folder", file)}>所在文件夹</button>
                  <button type="button" onClick=${() => action("copy", file)}>复制路径</button>
                </div>
              </div>
            </div>
          `;
  })}
        </div>
      ` : null}
    </div>
  `;
}
function ChatPanel({ userAvatar = null } = {}) {
  useLang();
  const [messages, setMessages] = d2([]);
  const [streaming, setStreaming] = d2(null);
  const [reasoningExpanded] = d2(() => {
    try {
      return localStorage.getItem("visionox-reasoning-display") === "expanded";
    } catch (e3) {
      return false;
    }
  });
  const [activeTool, setActiveTool] = d2(null);
  const [busy, setBusy] = d2(false);
  const initialInputRef = A2(null);
  if (initialInputRef.current === null) {
    try {
      initialInputRef.current = localStorage.getItem(CHAT_DRAFT_KEY) || "";
    } catch {
      initialInputRef.current = "";
    }
  }
  const inputValueRef = A2(initialInputRef.current);
  const inputRef = A2(null);
  const draftSaveTimerRef = A2(null);
  const [inputHasContent, setInputHasContent] = d2(Boolean(initialInputRef.current.trim()));
  const inputHasContentRef = A2(inputHasContent);
  const [promptOptimizing, setPromptOptimizing] = d2(false);
  const [jumpMessageId, setJumpMessageId] = d2(null);
  const [highlightMessageId, setHighlightMessageId] = d2(null);
  const [draftReady, setDraftReady] = d2(false);
  const [error, setError] = d2(null);
  const [bootError, setBootError] = d2(null);
  const [eventStreamConnected, setEventStreamConnected] = d2(true);
  const [statusLine, setStatusLine] = d2(null);
  const [modal, setModal] = d2(null);
  const [modalResolving, setModalResolving] = d2(false);
  const [editMode, setEditModeLocal] = d2(null);
  const [preset, setPresetLocal] = d2(null);
  const [effort, setEffortLocal] = d2(null);
  const [mode, setModeLocal] = d2("general");
  const [modes, setModesLocal] = d2(null);
  const [activeMode, setActiveModeLocal] = d2(null);
  const [eccRules, setEccRulesLocal] = d2(null);
  const [providers, setProviders] = d2(null);
  const [modelVerification, setModelVerification] = d2(null);
  const [activeProviderId, setActiveProviderId] = d2(null);
  const [providerCaps, setProviderCaps] = d2(null);
  const [stats, setStats] = d2(null);
  const [overviewModel, setOverviewModel] = d2(null);
  const activeProvider = (providers ?? []).find((provider) => provider.id === activeProviderId);
  const activeModel = activeProvider?.models?.find((model) => model.disabled !== true && model.id === overviewModel);
  const pendingImageLimit = Math.min(5, Math.max(1, Number(activeModel?.capabilities?.maxImagesPerRequest) || 5));
  const [budgetUsd, setBudgetUsd] = d2(null);
  const [activePlan, setActivePlan] = d2(null);
  const [fileArtifacts, setFileArtifacts] = d2([]);
  const [fileArtifactsKey, setFileArtifactsKey] = d2("");
  const [fileArtifactsDismissed, setFileArtifactsDismissed] = d2(false);
  const [fileArtifactsSelectedMessageId, setFileArtifactsSelectedMessageId] = d2(null);
  const [fileArtifactsByMessageId, setFileArtifactsByMessageId] = d2({});
  const [fileArtifactsRetryTick, setFileArtifactsRetryTick] = d2(0);
  const fileArtifactsRetryRef = A2({ key: "", count: 0 });
  const [todos, setTodos] = d2([]);
  const [todoExpanded, setTodoExpanded] = d2(false);
  const [planContinuation, setPlanContinuation] = d2(null);
  const [semanticIndex, setSemanticIndex] = d2(null);
  const [indexRetrievalMode, setIndexRetrievalMode] = d2("tool");
  const [semanticRetrievalSources, setSemanticRetrievalSources] = d2([]);
  const [semanticRetrievalStatus, setSemanticRetrievalStatus] = d2("idle");
  const [showRetrievalSources, setShowRetrievalSources] = d2(false);
  const [slashCommands, setSlashCommands] = d2([]);
  const [popoverKind, setPopoverKind] = d2(null);
  const [popoverItems, setPopoverItems] = d2([]);
  const [popoverSel, setPopoverSel] = d2(0);
  const [semanticBannerDismissed, setSemanticBannerDismissed] = d2(() => {
    try {
      return localStorage.getItem("rx.semanticBannerDismissed") === "1";
    } catch {
      return false;
    }
  });
  y2(() => {
    try {
      localStorage.setItem("rx.semanticBannerDismissed", semanticBannerDismissed ? "1" : "0");
    } catch {
    }
  }, [semanticBannerDismissed]);
  const [turnStartedAt, setTurnStartedAt] = d2(null);
  const [nowTick, setNowTick] = d2(0);
  const [workspaceDir, setWorkspaceDirLocal] = d2(null);
  const [activeConversationId, setActiveConversationId] = d2(null);
  const [recentWss, setRecentWss] = d2([]);
  const [workspaceSelection, setWorkspaceSelection] = d2(null);
  y2(() => {
    if (todos.length === 0 || !todos.every((todo) => todo.status === "completed")) return;
    setTodoExpanded(false);
    const timer = setTimeout(() => {
      setTodos((current) => current.length > 0 && current.every((todo) => todo.status === "completed") ? [] : current);
    }, 5e3);
    return () => clearTimeout(timer);
  }, [todos]);
  const [showWsPicker, setShowWsPicker] = d2(false);
  const [showSkillPicker, setShowSkillPicker] = d2(false);
  const [showModelPicker, setShowModelPicker] = d2(false);
  const [openModelGroupId, setOpenModelGroupId] = d2(null);
  const modelGroupCloseTimerRef = A2(null);
  const [modelNotice, setModelNotice] = d2(null);
  const modelNoticeTimerRef = A2(null);
  const pushModelNotice = q2((text, kind = "info", ttl = 3e3) => {
    if (modelNoticeTimerRef.current !== null) clearTimeout(modelNoticeTimerRef.current);
    setModelNotice({ text, kind });
    modelNoticeTimerRef.current = ttl > 0 ? setTimeout(() => {
      modelNoticeTimerRef.current = null;
      setModelNotice(null);
    }, ttl) : null;
  }, []);
  const cancelModelGroupClose = q2(() => {
    if (modelGroupCloseTimerRef.current !== null) clearTimeout(modelGroupCloseTimerRef.current);
    modelGroupCloseTimerRef.current = null;
  }, []);
  const openModelGroup = q2((groupId) => {
    cancelModelGroupClose();
    setOpenModelGroupId(groupId);
  }, [cancelModelGroupClose]);
  const scheduleModelGroupClose = q2(() => {
    cancelModelGroupClose();
    modelGroupCloseTimerRef.current = setTimeout(() => setOpenModelGroupId(null), 180);
  }, [cancelModelGroupClose]);
  y2(() => () => {
    if (modelNoticeTimerRef.current !== null) clearTimeout(modelNoticeTimerRef.current);
    if (modelGroupCloseTimerRef.current !== null) clearTimeout(modelGroupCloseTimerRef.current);
  }, []);
  const [providerImporting, setProviderImporting] = d2(false);
  const [providerTesting, setProviderTesting] = d2(false);
  const [providerCleaning, setProviderCleaning] = d2(false);
  const [skillList, setSkillList] = d2([]);
  const [skillCredentialSetup, setSkillCredentialSetup] = d2(null);
  const [skillCredentialValue, setSkillCredentialValue] = d2("");
  const [skillCredentialSaving, setSkillCredentialSaving] = d2(false);
  const [pendingImages, setPendingImages] = d2([]);
  const pendingImagesRef = A2([]);
  const queuedAttachmentIdsRef = A2(/* @__PURE__ */ new Set());
  const uploadScopeRef = A2(null);
  const [visibleMessageCount, setVisibleMessageCount] = d2(CHAT_INITIAL_RENDER_COUNT);
  const [totalMessages, setTotalMessages] = d2(0);
  const [loadingEarlierMessages, setLoadingEarlierMessages] = d2(false);
  const [queuedPrompts, setQueuedPrompts] = d2([]);
  const [queuePumpTick, setQueuePumpTick] = d2(0);
  const [queueReady, setQueueReady] = d2(false);
  const [queueSendingId, setQueueSendingId] = d2(null);
  const [queuePaused, setQueuePaused] = d2(false);
  const [operation, setOperation] = d2(null);
  const [backgroundJobs, setBackgroundJobs] = d2([]);
  const [pendingDeliveries, setPendingDeliveries] = d2([]);
  const [showBackgroundJobs, setShowBackgroundJobs] = d2(false);
  const [selectedBackgroundJobId, setSelectedBackgroundJobId] = d2(null);
  const [backgroundJobDetail, setBackgroundJobDetail] = d2(null);
  const backgroundJobDetailRequestRef = A2(0);
  var fileInputRef = A2(null);
  const queuedPromptsRef = A2([]);
  const queueSubmittingRef = A2(false);
  const CHAT_QUEUE_LIMIT = 5;
  const draftKey = $2(() => chatDraftKey(workspaceDir, mode), [workspaceDir, mode]);
  const queueStorageKey = $2(() => workspaceDir && activeConversationId ? `${draftKey}:conversation:${activeConversationId}:queue` : null, [draftKey, workspaceDir, activeConversationId]);
  const queueStorageKeyRef = A2(queueStorageKey);
  queueStorageKeyRef.current = queueStorageKey;
  const uploadScopeKey = `${activeConversationId || "unresolved"}
${workspaceDir || ""}`;
  const persistDraftSoon = q2((value) => {
    if (draftSaveTimerRef.current !== null) clearTimeout(draftSaveTimerRef.current);
    draftSaveTimerRef.current = setTimeout(() => {
      draftSaveTimerRef.current = null;
      try {
        const text = String(value || "");
        if (text.trim()) localStorage.setItem(draftKey, text);
        else localStorage.removeItem(draftKey);
      } catch {
      }
    }, 250);
  }, [draftKey]);
  const setChatInput = q2((value, options2 = {}) => {
    const text = String(value ?? "");
    inputValueRef.current = text;
    if (inputRef.current && inputRef.current.value !== text) inputRef.current.value = text;
    const hasContent = Boolean(text.trim());
    if (inputHasContentRef.current !== hasContent) {
      inputHasContentRef.current = hasContent;
      setInputHasContent(hasContent);
    }
    if (options2.persist !== false) persistDraftSoon(text);
  }, [persistDraftSoon]);
  const optimizeCurrentPrompt = q2(async () => {
    const source = inputValueRef.current.trim();
    if (!source || promptOptimizing) return;
    setPromptOptimizing(true);
    setError(null);
    try {
      const result = await api("/optimize-prompt", { method: "POST", body: { prompt: source } });
      if (inputValueRef.current.trim() !== source) {
        showToast("输入内容已变化，未覆盖你刚才的修改", "info");
        return;
      }
      const optimized = String(result?.prompt ?? "").trim();
      if (!optimized) throw new Error("模型没有返回可用的优化结果");
      setChatInput(optimized);
      setTimeout(() => {
        inputRef.current?.focus();
        try {
          inputRef.current.selectionStart = inputRef.current.selectionEnd = optimized.length;
        } catch {
        }
      }, 0);
      showToast("提示词已优化，请确认后发送", "success");
    } catch (err) {
      setError(`提示词优化失败：${err.message}`);
    } finally {
      setPromptOptimizing(false);
    }
  }, [promptOptimizing, setChatInput]);
  y2(() => {
    queuedPromptsRef.current = queuedPrompts;
  }, [queuedPrompts]);
  const refreshBackgroundJobs = q2(async () => {
    try {
      const result = await api("/background-jobs");
      const next = Array.isArray(result.jobs) ? result.jobs : [];
      setBackgroundJobs(next);
      setPendingDeliveries(Array.isArray(result.pendingDeliveries) ? result.pendingDeliveries : []);
      return next;
    } catch {
      return [];
    }
  }, []);
  const stopBackgroundJob = q2(async (id) => {
    try {
      if (String(id).startsWith("document:")) {
        await api(`/background-jobs/${encodeURIComponent(id)}`, { method: "POST", body: { action: "stop" } });
      } else {
        await api(`/background-jobs/${encodeURIComponent(id)}`, { method: "DELETE" });
      }
      await refreshBackgroundJobs();
    } catch (err) {
      setError(err.message);
    }
  }, [refreshBackgroundJobs]);
  const abandonBackgroundJob = q2(async (id) => {
    try {
      await api(`/background-jobs/${encodeURIComponent(id)}`, { method: "POST", body: { action: "abandon" } });
      await refreshBackgroundJobs();
    } catch (err) {
      setError(err.message);
    }
  }, [refreshBackgroundJobs]);
  const deleteBackgroundJobRecord = q2(async (id) => {
    try {
      await api(`/background-jobs/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (selectedBackgroundJobId === id) {
        setSelectedBackgroundJobId(null);
        setBackgroundJobDetail(null);
      }
      await refreshBackgroundJobs();
    } catch (err) {
      setError(err.message);
    }
  }, [refreshBackgroundJobs, selectedBackgroundJobId]);
  const controlDocumentJob = q2(async (id, action, payload = null) => {
    const requestId = backgroundJobDetailRequestRef.current;
    try {
      const current = String(backgroundJobDetail?.id ?? "") === String(id) ? backgroundJobDetail : backgroundJobs.find((job) => String(job.id) === String(id));
      const requestBody = String(id).startsWith("task:") ? {
        action,
        expectedRevision: current?.revision,
        requestId: backgroundActionRequestId(),
        payload
      } : { action };
      await api(`/background-jobs/${encodeURIComponent(id)}`, { method: "POST", body: requestBody });
      await refreshBackgroundJobs();
      if (requestId !== backgroundJobDetailRequestRef.current) return;
      const detail = await api(`/background-jobs/${encodeURIComponent(id)}`);
      if (requestId !== backgroundJobDetailRequestRef.current) return;
      const nextDetail = detail?.job ?? null;
      if (nextDetail && String(nextDetail.id ?? "") !== String(id)) return;
      setBackgroundJobDetail(nextDetail);
    } catch (err) {
      await refreshBackgroundJobs();
      if (requestId !== backgroundJobDetailRequestRef.current) return;
      try {
        const detail = await api(`/background-jobs/${encodeURIComponent(id)}`);
        if (requestId !== backgroundJobDetailRequestRef.current) return;
        const nextDetail = detail?.job ?? null;
        if (!nextDetail || String(nextDetail.id ?? "") === String(id)) setBackgroundJobDetail(nextDetail);
      } catch {
      }
      if (requestId === backgroundJobDetailRequestRef.current) setError(err.message);
    }
  }, [refreshBackgroundJobs, backgroundJobDetail, backgroundJobs]);
  const closeBackgroundWorkbench = q2(() => {
    backgroundJobDetailRequestRef.current += 1;
    setShowBackgroundJobs(false);
    setBackgroundJobDetail(null);
  }, []);
  const openBackgroundWorkbench = q2(async (id = null) => {
    const requestId = ++backgroundJobDetailRequestRef.current;
    setShowBackgroundJobs(true);
    setShowSkillPicker(false);
    setShowWsPicker(false);
    setShowModelPicker(false);
    setBackgroundJobDetail(null);
    if (id !== null && id !== void 0) setSelectedBackgroundJobId(id);
    const refreshed = await refreshBackgroundJobs();
    if (requestId !== backgroundJobDetailRequestRef.current) return;
    const nextId = id || selectedBackgroundJobId || refreshed.find((job) => job.kind === "document")?.id || refreshed[0]?.id;
    if (!nextId) {
      setSelectedBackgroundJobId(null);
      return;
    }
    setSelectedBackgroundJobId(nextId);
    try {
      const detail = await api(`/background-jobs/${encodeURIComponent(nextId)}`);
      if (requestId !== backgroundJobDetailRequestRef.current) return;
      const nextDetail = detail?.job ?? null;
      if (nextDetail && String(nextDetail.id ?? "") !== String(nextId)) return;
      setBackgroundJobDetail(nextDetail);
    } catch (err) {
      if (requestId === backgroundJobDetailRequestRef.current) setError(err.message);
    }
  }, [refreshBackgroundJobs, selectedBackgroundJobId, backgroundJobs]);
  y2(() => {
    if (!showBackgroundJobs) return;
    const onEscape = (event) => {
      if (event.key !== "Escape" || event.defaultPrevented || modal) return;
      event.preventDefault();
      if (showSkillPicker || showWsPicker || showModelPicker || showRetrievalSources) {
        setShowSkillPicker(false);
        setShowWsPicker(false);
        setShowModelPicker(false);
        setShowRetrievalSources(false);
        return;
      }
      closeBackgroundWorkbench();
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [showBackgroundJobs, modal, showSkillPicker, showWsPicker, showModelPicker, showRetrievalSources, closeBackgroundWorkbench]);
  const previewDocumentJob = q2(async (job, artifact = null) => {
    try {
      if (artifact?.path) {
        const filename = artifact.filename || artifact.name || artifact.path.split(/[\\/]/).pop() || "任务产物";
        const ext = filename.includes(".") ? filename.split(".").pop() : "";
        await showFileArtifactPreview({ path: artifact.path, filename, ext });
        return;
      }
      if (["completed", "completed_with_warnings"].includes(job?.status) && job?.outputPath && !["missing", "modified"].includes(job?.artifactStatus)) {
        await showFileArtifactPreview({ path: job.outputPath, filename: job.outputPath.split(/[\\/]/).pop() || "document.md", ext: "md" });
        return;
      }
      const detail = await api(`/background-jobs/${encodeURIComponent(job.id)}`);
      const preview = detail?.job?.preview;
      if (!preview?.content) throw new Error("当前还没有可预览的已完成区块");
      showArtifactPreview({
        id: `document-job-${Date.now()}`,
        filename: preview.filename || "文档中间预览.md",
        path: "",
        lang: "markdown",
        content: preview.content
      });
    } catch (err) {
      setError(err.message);
    }
  }, []);
  y2(() => {
    void refreshBackgroundJobs();
    if (!showBackgroundJobs && !backgroundJobs.some((job) => job.running)) return;
    const id = setInterval(refreshBackgroundJobs, 5e3);
    return () => clearInterval(id);
  }, [refreshBackgroundJobs, showBackgroundJobs, backgroundJobs.some((job) => job.running)]);
  y2(() => {
    const refreshOnFocus = () => {
      void refreshBackgroundJobs();
    };
    const refreshOnVisibility = () => {
      if (document.visibilityState === "visible") void refreshBackgroundJobs();
    };
    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnVisibility);
    return () => {
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnVisibility);
    };
  }, [refreshBackgroundJobs]);
  y2(() => {
    if (!showBackgroundJobs || !selectedBackgroundJobId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const detail = await api(`/background-jobs/${encodeURIComponent(selectedBackgroundJobId)}`);
        const nextDetail = detail?.job ?? null;
        if (!cancelled && (!nextDetail || String(nextDetail.id ?? "") === String(selectedBackgroundJobId))) setBackgroundJobDetail(nextDetail);
      } catch {
      }
    };
    void load();
    const timer = setInterval(load, 4e3);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [showBackgroundJobs, selectedBackgroundJobId]);
  y2(() => {
    if (!draftReady || !queueStorageKey) return;
    let cancelled = false;
    queuedAttachmentIdsRef.current = /* @__PURE__ */ new Set();
    setQueueReady(false);
    api(`/prompt-queue?scope=${encodeURIComponent(queueStorageKey)}`).then((res) => {
      if (cancelled) return;
      const restored = (Array.isArray(res?.items) ? res.items : []).slice(0, CHAT_QUEUE_LIMIT).map((item) => {
        const id = item.id || `queued-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        return {
          id,
          requestId: item.requestId || id,
          text: String(item.text ?? "").trim(),
          images: Array.isArray(item.images) ? item.images.filter((img) => typeof img === "string" && img.startsWith("data:image/")) : [],
          attachments: Array.isArray(item.attachments) ? item.attachments.filter((attachmentId) => typeof attachmentId === "string" && attachmentId.startsWith("att_")) : [],
          status: item.status === "failed" ? "failed" : "queued",
          error: item.status === "failed" ? String(item.error ?? "") : null,
          createdAt: Number(item.createdAt ?? Date.now())
        };
      }).filter((item) => item.text || item.images.length > 0 || item.attachments.length > 0);
      for (const item of restored) {
        for (const attachmentId of item.attachments) queuedAttachmentIdsRef.current.add(attachmentId);
      }
      setQueuedPrompts(restored);
    }).catch((err) => {
      if (!cancelled) setError(t4("chat.queueFailed", { error: err.message }));
    }).finally(() => {
      if (!cancelled) setQueueReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [draftReady, queueStorageKey]);
  y2(() => {
    try {
      const scopedDraft = localStorage.getItem(draftKey) || "";
      const legacyDraft = localStorage.getItem(CHAT_DRAFT_KEY) || "";
      const nextDraft = scopedDraft || legacyDraft;
      if (!inputValueRef.current.trim() && nextDraft) setChatInput(nextDraft, { persist: false });
      if (legacyDraft && !scopedDraft) {
        localStorage.setItem(draftKey, legacyDraft);
      }
      localStorage.removeItem(CHAT_DRAFT_KEY);
    } catch {
    }
    setDraftReady(true);
  }, [draftKey, setChatInput]);
  y2(() => {
    return () => {
      if (draftSaveTimerRef.current !== null) clearTimeout(draftSaveTimerRef.current);
    };
  }, []);
  y2(() => {
    if (!busy) return;
    const id = setInterval(() => setNowTick((n3) => n3 + 1), 500);
    return () => clearInterval(id);
  }, [busy]);
  y2(() => {
    if (busy) {
      if (!turnStartedAt) setTurnStartedAt(Date.now());
    } else {
      setTurnStartedAt(null);
    }
  }, [busy, turnStartedAt]);
  const shouldAutoScroll = A2(true);
  const feedRef = A2(null);
  const autoScrollInFlight = A2(false);
  const loadingEarlierRef = A2(false);
  const scrollbarDraggingRef = A2(false);
  const topLoadArmedRef = A2(true);
  const loadEarlierMessagesRef = A2(null);
  const preserveVisibleHistoryOnAppend = q2(() => {
    if (!shouldAutoScroll.current) setVisibleMessageCount((count) => count + 1);
  }, []);
  const allVisibleMessages = streaming ? [
    ...messages,
    {
      id: streaming.id,
      role: "assistant",
      text: streaming.text,
      reasoning: streaming.reasoning
    }
  ] : messages;
  y2(() => {
    const pending = window.__visionoxPendingChatJump;
    if (pending?.messageId) setJumpMessageId(pending.messageId);
    const onJump = (ev) => {
      const id = ev.detail?.messageId;
      if (id) setJumpMessageId(id);
    };
    appBus.addEventListener("chat-jump-message", onJump);
    return () => appBus.removeEventListener("chat-jump-message", onJump);
  }, []);
  y2(() => {
    if (!jumpMessageId) return;
    const selector = `[data-msg-id="${String(jumpMessageId).replace(/"/g, '\\"')}"]`;
    const el = feedRef.current?.querySelector(selector);
    if (!el) {
      const index = messages.findIndex((message) => String(message?.id || "") === String(jumpMessageId));
      if (index >= 0) setVisibleMessageCount((count) => Math.max(count, messages.length - index));
      return;
    }
    shouldAutoScroll.current = false;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    setHighlightMessageId(jumpMessageId);
    setJumpMessageId(null);
    try {
      if (window.__visionoxPendingChatJump?.messageId === jumpMessageId) {
        window.__visionoxPendingChatJump = null;
      }
    } catch {
    }
    const id = setTimeout(() => {
      setHighlightMessageId((cur) => cur === jumpMessageId ? null : cur);
    }, 5e3);
    return () => clearTimeout(id);
  }, [jumpMessageId, messages, streaming, visibleMessageCount]);
  y2(() => {
    let cancelled = false;
    if (streaming) return () => {
      cancelled = true;
    };
    const sourceMessages = allVisibleMessages;
    const selectedExists = fileArtifactsSelectedMessageId && sourceMessages.some((m3) => m3.role === "assistant" && String(m3.id || "") === String(fileArtifactsSelectedMessageId));
    const turnKey = selectedExists ? String(fileArtifactsSelectedMessageId) : latestAssistantMessageId(sourceMessages);
    const candidates = fileArtifactCandidatesForAssistant(sourceMessages, turnKey);
    const eventFiles = fileArtifactsByMessageId[turnKey] || [];
    if (fileArtifactsSelectedMessageId && !selectedExists) {
      setFileArtifactsSelectedMessageId(null);
    }
    if (candidates.length === 0) {
      if (eventFiles.length > 0) {
        const nextKey = `${turnKey}|${fileArtifactGroupKey(eventFiles)}`;
        if (nextKey !== fileArtifactsKey) {
          setFileArtifacts(eventFiles);
          setFileArtifactsKey(nextKey);
          setFileArtifactsDismissed(false);
        }
        return () => {
          cancelled = true;
        };
      }
      if (!busy) {
        setFileArtifacts([]);
        setFileArtifactsKey("");
        setFileArtifactsDismissed(false);
        fileArtifactsRetryRef.current = { key: "", count: 0 };
      }
      return () => {
        cancelled = true;
      };
    }
    const candidateKey = `${turnKey}|${candidates.join("|")}`;
    if (fileArtifactsRetryRef.current.key !== candidateKey) {
      fileArtifactsRetryRef.current = { key: candidateKey, count: 0 };
    }
    (async () => {
      try {
        const res = await api("/artifacts/resolve", { method: "POST", body: { candidates } });
        if (cancelled) return;
        const files = res.files ?? [];
        if (files.length === 0) {
          if (eventFiles.length > 0) {
            const nextKey2 = `${turnKey}|${fileArtifactGroupKey(eventFiles)}`;
            if (nextKey2 !== fileArtifactsKey) {
              setFileArtifacts(eventFiles);
              setFileArtifactsKey(nextKey2);
              setFileArtifactsDismissed(false);
            }
            return;
          }
          const retry = fileArtifactsRetryRef.current;
          if (retry.key === candidateKey && retry.count < 4) {
            const delays = [250, 750, 1500, 3e3];
            const delay = delays[retry.count] ?? 3e3;
            retry.count += 1;
            setTimeout(() => {
              if (!cancelled) setFileArtifactsRetryTick((v3) => v3 + 1);
            }, delay);
          }
          return;
        }
        fileArtifactsRetryRef.current = { key: candidateKey, count: 0 };
        const mergedFiles = mergeFileArtifacts(eventFiles, files);
        const nextKey = `${turnKey}|${fileArtifactGroupKey(mergedFiles)}`;
        if (nextKey !== fileArtifactsKey) {
          setFileArtifacts(mergedFiles);
          setFileArtifactsKey(nextKey);
          setFileArtifactsDismissed(false);
        }
      } catch {
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [messages, streaming, busy, fileArtifactsKey, fileArtifactsRetryTick, fileArtifactsSelectedMessageId, fileArtifactsByMessageId]);
  y2(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api(`/messages?limit=${CHAT_MESSAGE_PAGE_SIZE}`);
        if (cancelled) return;
        setMessages(data.messages ?? []);
        setTotalMessages(data.totalMessages ?? data.messages?.length ?? 0);
        setBusy(Boolean(data.busy));
        setOperation(data.operation ?? null);
      } catch (err) {
        if (!cancelled) setBootError(err.message);
      }
      try {
        const m3 = await api("/modal");
        if (!cancelled && m3.modal) setModal(m3.modal);
      } catch {
      }
      try {
        const r3 = await api("/slash");
        if (!cancelled) setSlashCommands(r3.commands);
      } catch {
      }
      try {
        const retrieval = await api("/index-retrieval-mode");
        if (!cancelled) setIndexRetrievalMode(globalThis.VisionoxIndexModePolicy.normalize(retrieval.mode));
      } catch {
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const streamBufRef = A2(null);
  const streamRafRef = A2(null);
  const resyncingEventsRef = A2(false);
  const bufferedDashboardEventsRef = A2([]);
  const flushStreaming = q2(() => {
    streamRafRef.current = null;
    if (streamBufRef.current) setStreaming(streamBufRef.current);
  }, []);
  const cancelStreamingRaf = q2(() => {
    if (streamRafRef.current !== null) {
      clearTimeout(streamRafRef.current);
      streamRafRef.current = null;
    }
    streamBufRef.current = null;
  }, []);
  const refetchCanonicalState = q2(async () => {
    try {
      const data = await api(`/messages?limit=${CHAT_MESSAGE_PAGE_SIZE}`);
      setMessages(data.messages ?? []);
      setTotalMessages(data.totalMessages ?? data.messages?.length ?? 0);
      setBusy(Boolean(data.busy));
      setOperation(data.operation ?? null);
      cancelStreamingRaf();
      setStreaming(null);
      setActiveTool(null);
    } catch {
    }
    try {
      const m3 = await api("/modal");
      setModal(m3.modal ?? null);
    } catch {
    }
    try {
      const retrieval = await api("/index-retrieval-mode");
      setIndexRetrievalMode(globalThis.VisionoxIndexModePolicy.normalize(retrieval.mode));
    } catch {
    }
  }, [cancelStreamingRaf]);
  y2(() => {
    let disposed = false;
    const applyDashboardEvent = (dash) => {
      if (dash.kind === "ping") return;
      if (dash.kind === "busy-change") {
        setBusy(dash.busy);
        if (!dash.busy) setSemanticRetrievalStatus((current) => current === "running" ? "idle" : current);
        return;
      }
      if (dash.kind === "semantic-retrieval") {
        setSemanticRetrievalSources(Array.isArray(dash.sources) ? dash.sources : []);
        setSemanticRetrievalStatus(dash.status ?? (dash.sources?.length ? "completed" : "empty"));
        return;
      }
      if (dash.kind === "operation-change") {
        setOperation(dash.operation ?? null);
        if (dash.operation?.state === "cancelled") {
          setSemanticRetrievalSources([]);
          setSemanticRetrievalStatus("idle");
          setShowRetrievalSources(false);
          showToast(t4("chat.stopComplete"), "info");
        }
        void refreshBackgroundJobs();
        return;
      }
      if (dash.kind === "background-job-change") {
        void refreshBackgroundJobs();
        return;
      }
      if (dash.kind === "user") {
        setSemanticRetrievalSources([]);
        setSemanticRetrievalStatus("running");
        setShowRetrievalSources(false);
        setTodos((current) => current.length > 0 && current.every((todo) => todo.status === "completed") ? [] : current);
        setPlanContinuation(null);
        preserveVisibleHistoryOnAppend();
        setMessages((prev) => [...prev, { id: dash.id, role: "user", text: dash.text, images: dash.images }]);
        setTotalMessages((count) => count + 1);
        return;
      }
      if (dash.kind === "assistant_delta") {
        const cur = streamBufRef.current;
        if (!cur) preserveVisibleHistoryOnAppend();
        const baseId = cur?.id === dash.id ? cur : null;
        streamBufRef.current = {
          id: dash.id,
          text: (baseId?.text ?? "") + (dash.contentDelta ?? ""),
          reasoning: (baseId?.reasoning ?? "") + (dash.reasoningDelta ?? "")
        };
        if (streamRafRef.current === null) {
          streamRafRef.current = setTimeout(flushStreaming, 75);
        }
        return;
      }
      if (dash.kind === "assistant_final") {
        const completedStream = streamBufRef.current;
        const replacedStreaming = Boolean(completedStream);
        cancelStreamingRaf();
        setStreaming(null);
        if (!replacedStreaming) preserveVisibleHistoryOnAppend();
        setMessages((prev) => [
          ...prev,
          {
            id: dash.id,
            role: "assistant",
            text: dash.text,
            reasoning: dash.reasoning ?? completedStream?.reasoning,
            receipt: dash.receipt,
            taskState: dash.taskState,
            artifactIncomplete: dash.artifactIncomplete === true,
            interventionChoice: dash.interventionChoice,
            warnings: Array.isArray(dash.warnings) ? dash.warnings : []
          }
        ]);
        setTotalMessages((count) => count + 1);
        return;
      }
      if (dash.kind === "tool_start") {
        setActiveTool({ id: dash.id, toolName: dash.toolName, args: dash.args });
        return;
      }
      if (dash.kind === "tool") {
        setActiveTool((cur) => cur && cur.id === dash.id ? null : cur);
        preserveVisibleHistoryOnAppend();
        setMessages((prev) => [
          ...prev,
          {
            id: dash.id,
            role: "tool",
            text: dash.content,
            toolName: dash.toolName,
            toolArgs: dash.args
          }
        ]);
        setTotalMessages((count) => count + 1);
        return;
      }
      if (dash.kind === "artifact-created") {
        const assistantId = String(dash.assistantId || "");
        const files = Array.isArray(dash.files) ? dash.files.filter((file) => file?.path) : [];
        if (!assistantId || files.length === 0) return;
        setFileArtifactsByMessageId((prev) => {
          const merged = mergeFileArtifacts(prev[assistantId] || [], files);
          return { ...prev, [assistantId]: merged };
        });
        setFileArtifacts((prev) => mergeFileArtifacts(prev, files));
        setFileArtifactsKey(`${assistantId}|event:${Date.now()}`);
        setFileArtifactsDismissed(false);
        return;
      }
      if (dash.kind === "warning" || dash.kind === "error" || dash.kind === "info") {
        if (dash.kind === "error") {
          setActiveTool(null);
        }
        preserveVisibleHistoryOnAppend();
        setMessages((prev) => [...prev, { id: dash.id, role: dash.kind, text: dash.text }]);
        setTotalMessages((count) => count + 1);
        return;
      }
      if (dash.kind === "status") {
        setStatusLine(dash.text);
        setTimeout(() => setStatusLine((cur) => cur === dash.text ? null : cur), 5e3);
        return;
      }
      if (dash.kind === "messages-reset") {
        setSemanticRetrievalSources([]);
        setSemanticRetrievalStatus("idle");
        setShowRetrievalSources(false);
        api("/index-retrieval-mode").then((retrieval) => setIndexRetrievalMode(globalThis.VisionoxIndexModePolicy.normalize(retrieval.mode))).catch(() => {
        });
        setMessages(dash.messages.map((m3) => ({
          id: m3.id || `hist-${Math.random()}`,
          role: m3.role,
          text: m3.text || ""
        })));
        setTotalMessages(dash.totalMessages ?? dash.messages.length);
        setFileArtifacts([]);
        setFileArtifactsKey("");
        setFileArtifactsDismissed(false);
        setFileArtifactsSelectedMessageId(null);
        setFileArtifactsByMessageId({});
        setQueuedPrompts([]);
        setQueueSendingId(null);
        setTodos([]);
        setPlanContinuation(null);
        setVisibleMessageCount(CHAT_INITIAL_RENDER_COUNT);
        topLoadArmedRef.current = true;
        return;
      }
      if (dash.kind === "config-changed") {
        Promise.allSettled([api("/overview"), api("/providers")]).then(([overviewResult, providersResult]) => {
          if (overviewResult.status === "fulfilled") {
            const o3 = overviewResult.value;
            setStats(o3.stats ?? null);
            setOverviewModel(o3.model ?? null);
            setPresetLocal(o3.preset ?? null);
            setEffortLocal(o3.reasoningEffort ?? null);
            setEditModeLocal(o3.editMode ?? null);
            setActiveProviderId(o3.activeProviderId ?? null);
            setProviderCaps(o3.providerCapabilities ?? null);
          }
          if (providersResult.status === "fulfilled") {
            setProviders(providersResult.value.providers ?? []);
            setModelVerification(providersResult.value.modelVerification ?? null);
          }
        });
        return;
      }
      if (dash.kind === "todo-update") {
        setTodos(dash.todos ?? []);
        return;
      }
      if (dash.kind === "plan-continuation-needed") {
        setPlanContinuation({
          attempts: dash.attempts ?? 0,
          maxAttempts: dash.maxAttempts ?? 0,
          completedSteps: dash.plan?.completedSteps ?? 0,
          totalSteps: dash.plan?.totalSteps ?? 0
        });
        return;
      }
      if (dash.kind === "plan-activated" || dash.kind === "plan-step-complete" || dash.kind === "plan-archived" || dash.kind === "plan-cancelled") {
        api("/plans").then((r3) => {
          setActivePlan((r3.plans ?? []).find((p3) => ["active", "pending"].includes(planStatus(p3))) ?? null);
        }).catch(() => {
        });
        return;
      }
      if (dash.kind === "modal-up") {
        setModalResolving(false);
        setModal(dash.modal);
        return;
      }
      if (dash.kind === "modal-down") {
        setModal((cur) => cur && (dash.gateId === void 0 ? cur.kind === dash.modalKind : cur._gateId === dash.gateId) ? null : cur);
        setModalResolving(false);
        return;
      }
    };
    const resyncDashboardEvents = async () => {
      if (resyncingEventsRef.current) return;
      resyncingEventsRef.current = true;
      try {
        await Promise.all([refetchCanonicalState(), refreshBackgroundJobs()]);
      } finally {
        if (!disposed) {
          const buffered = bufferedDashboardEventsRef.current.splice(0).sort((left, right) => Number(left?.eventSeq ?? 0) - Number(right?.eventSeq ?? 0));
          resyncingEventsRef.current = false;
          for (const event of buffered) applyDashboardEvent(event);
        }
      }
    };
    const onDash = (dash) => {
      if (dash.kind === "resync-required") {
        void resyncDashboardEvents();
        return;
      }
      if (resyncingEventsRef.current) {
        bufferedDashboardEventsRef.current.push(dash);
        return;
      }
      applyDashboardEvent(dash);
    };
    const unsubscribe = subscribeSse("*", onDash);
    const unsubscribeStatus = subscribeSseStatus(({ connected, reconnected }) => {
      setEventStreamConnected(connected);
      if (connected && reconnected) {
        void resyncDashboardEvents();
      }
      if (!connected) {
        setError(t4("chat.eventStreamError"));
        setTimeout(() => setError(null), 3e3);
      }
    });
    return () => {
      disposed = true;
      unsubscribe();
      unsubscribeStatus();
      cancelStreamingRaf();
    };
  }, [refetchCanonicalState, refreshBackgroundJobs, cancelStreamingRaf, preserveVisibleHistoryOnAppend]);
  var handleFileChange = q2(async function(e3) {
    var files = e3.target.files;
    if (!files || files.length === 0) return;
    var newImages = pendingImages.slice();
    const scope = currentUploadScope();
    for (var i3 = 0; i3 < files.length && newImages.length < pendingImageLimit; i3++) {
      try {
        var pendingImage = await uploadMediaAttachment(files[i3], scope);
        newImages.push(pendingImage);
      } catch (err) {
        if (err?.name === "AbortError") continue;
        console.error("Media upload failed:", err);
        setError(`附件上传失败：${err.message}`);
      }
    }
    if (uploadScopeRef.current !== scope || scope.controller.signal.aborted) {
      await releaseUploadedImages(newImages.filter((item) => item?.uploadScopeKey === scope.key));
      e3.target.value = "";
      return;
    }
    setPendingImages(newImages);
    e3.target.value = "";
  }, [pendingImages, pendingImageLimit, uploadScopeKey]);
  var compressImage = function(file) {
    return new Promise(function(resolve, reject) {
      if (file.size < 100 * 1024) {
        var reader = new FileReader();
        reader.onload = function() {
          resolve(reader.result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
        return;
      }
      var img = new Image();
      var url = URL.createObjectURL(file);
      img.onload = function() {
        URL.revokeObjectURL(url);
        var maxEdge = 1024;
        var w4 = img.width, h3 = img.height;
        if (w4 > maxEdge || h3 > maxEdge) {
          var ratio = Math.min(maxEdge / w4, maxEdge / h3);
          w4 = Math.round(w4 * ratio);
          h3 = Math.round(h3 * ratio);
        }
        var canvas = document.createElement("canvas");
        canvas.width = w4;
        canvas.height = h3;
        var ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w4, h3);
        var dataUrl = canvas.toDataURL("image/jpeg", 0.7);
        if (dataUrl.length > 200 * 1024) {
          dataUrl = canvas.toDataURL("image/jpeg", 0.4);
        }
        if (dataUrl.length > 200 * 1024 && w4 > 512) {
          var r22 = Math.min(512 / img.width, 512 / img.height);
          canvas.width = Math.round(img.width * r22);
          canvas.height = Math.round(img.height * r22);
          var ctx2 = canvas.getContext("2d");
          ctx2.drawImage(img, 0, 0, canvas.width, canvas.height);
          dataUrl = canvas.toDataURL("image/jpeg", 0.5);
        }
        resolve(dataUrl);
      };
      img.onerror = function() {
        URL.revokeObjectURL(url);
        reject(new Error("Failed to load image"));
      };
      img.src = url;
    });
  };
  var uploadChunkData = function(blob) {
    return new Promise(function(resolve, reject) {
      var reader = new FileReader();
      reader.onload = function() {
        var value = String(reader.result || "");
        resolve(value.slice(value.indexOf(",") + 1));
      };
      reader.onerror = function() {
        reject(reader.error || new Error("Failed to read image chunk"));
      };
      reader.readAsDataURL(blob);
    });
  };
  var currentUploadScope = function() {
    const current = uploadScopeRef.current;
    if (current && current.key === uploadScopeKey && !current.controller.signal.aborted) return current;
    const scope = {
      key: uploadScopeKey,
      sessionId: activeConversationId,
      workspace: workspaceDir,
      controller: new AbortController()
    };
    uploadScopeRef.current = scope;
    return scope;
  };
  var uploadMediaAttachment = async function(file, scope = currentUploadScope()) {
    if (!file || !Number.isFinite(file.size) || file.size < 1) throw new Error("附件文件为空");
    if (file.size > 50 * 1024 * 1024) throw new Error("附件超过 50 MB 限制");
    const isImage = String(file.type || "").startsWith("image/");
    const extension = /\.([^.]+)$/.exec(String(file.name || ""))?.[1]?.toLowerCase() || "";
    const videoMimeByExtension = { mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm" };
    const declaredMime = String(file.type || videoMimeByExtension[extension] || "application/octet-stream").toLowerCase();
    const isVideo = ["video/mp4", "video/quicktime", "video/webm"].includes(declaredMime) || Object.hasOwn(videoMimeByExtension, extension);
    if (!isImage && !isVideo) throw new Error("仅支持图片、MP4、MOV 或 WebM 视频");
    if (isImage && !canUploadImages) throw new Error("当前模型不支持图片输入");
    if (isVideo && !canUploadVideos) throw new Error("仅显式配置的官方 Kimi 视频模型支持视频输入");
    const preview = isImage ? await compressImage(file) : null;
    const initialized = await api("/attachments", {
      method: "POST",
      body: { action: "init", name: file.name || "image", size: file.size, mimeType: declaredMime },
      signal: scope?.controller.signal
    });
    const uploadId = initialized.uploadId;
    const uploadSessionId = initialized.sessionId || scope?.sessionId || null;
    const uploadWorkspace = initialized.workspace || scope?.workspace || null;
    const chunkBytes = Math.min(Number(initialized.chunkBytes) || 512 * 1024, 512 * 1024);
    try {
      for (let offset = 0; offset < file.size; offset += chunkBytes) {
        const data = await uploadChunkData(file.slice(offset, Math.min(file.size, offset + chunkBytes)));
        await api("/attachments", { method: "POST", body: { action: "chunk", uploadId, offset, data }, signal: scope?.controller.signal });
      }
      const completed = await api("/attachments", { method: "POST", body: { action: "finish", uploadId }, signal: scope?.controller.signal });
      if (!completed.attachment?.id) throw new Error("宿主未返回附件 ID");
      const result = {
        attachmentId: completed.attachment.id,
        preview,
        kind: completed.attachment.kind || (isVideo ? "video" : "image"),
        name: completed.attachment.name || file.name || "image",
        size: completed.attachment.size || file.size,
        mimeType: completed.attachment.mimeType || declaredMime,
        sessionId: completed.attachment.sessionId || uploadSessionId,
        workspace: completed.attachment.workspace || uploadWorkspace,
        uploadScopeKey: scope?.key || null
      };
      if (uploadScopeRef.current !== scope || scope?.controller.signal.aborted) {
        await releaseUploadedImages([result]);
        const staleError = new Error("附件上传所属会话或工作区已经切换");
        staleError.name = "AbortError";
        throw staleError;
      }
      return result;
    } catch (error2) {
      await api("/attachments", {
        method: "POST",
        body: { action: "cancel", uploadId, sessionId: uploadSessionId, workspace: uploadWorkspace }
      }).catch(() => {
      });
      throw error2;
    }
  };
  var releaseUploadedImages = function(items) {
    const attachments = (Array.isArray(items) ? items : []).filter((item) => item && typeof item === "object" && item.attachmentId && item.sessionId && item.workspace).map((item) => ({ id: item.attachmentId, sessionId: item.sessionId, workspace: item.workspace }));
    if (attachments.length === 0) return Promise.resolve();
    return api("/attachments", { method: "POST", body: { action: "release-upload", attachments } }).catch(() => {
    });
  };
  var rotateUploadScope = function() {
    const scope = uploadScopeRef.current;
    if (!scope) return;
    scope.controller.abort();
    if (uploadScopeRef.current === scope) uploadScopeRef.current = null;
    void releaseUploadedImages(pendingImagesRef.current.filter((item) => item?.uploadScopeKey === scope.key && !queuedAttachmentIdsRef.current.has(item?.attachmentId)));
  };
  y2(() => {
    pendingImagesRef.current = pendingImages;
  }, [pendingImages]);
  y2(() => {
    const scope = currentUploadScope();
    setPendingImages((current) => current.filter((item) => !item?.uploadScopeKey || item.uploadScopeKey === scope.key));
    return () => {
      scope.controller.abort();
      void releaseUploadedImages(pendingImagesRef.current.filter((item) => (!item?.uploadScopeKey || item.uploadScopeKey === scope.key) && !queuedAttachmentIdsRef.current.has(item?.attachmentId)));
      if (uploadScopeRef.current === scope) uploadScopeRef.current = null;
    };
  }, [uploadScopeKey]);
  const loadChatSkills = q2(async () => {
    if (skillList.length > 0) return skillList;
    const r3 = await api("/skills");
    const rows = [...r3.project ?? [], ...r3.global ?? [], ...r3.builtin ?? []];
    setSkillList(rows);
    return rows;
  }, [skillList]);
  const appendSkillMention = q2((name) => {
    const skillName = String(name ?? "").trim();
    if (!skillName) return;
    const base = inputValueRef.current;
    const spacer = base && !/\s$/.test(base) ? " " : "";
    setChatInput(`${base}${spacer}@${skillName} `);
    setShowSkillPicker(false);
    setPopoverKind(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [setChatInput]);
  const resolveSkillMention = q2(async (rawText) => {
    const text = String(rawText ?? "").trim();
    if (!text) return { text, skillInvocation: null };
    try {
      const skills = await loadChatSkills();
      const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      let selected = null;
      for (const s22 of skills) {
        const name = String(s22.name ?? "").trim();
        if (!name) continue;
        const re = new RegExp(`(^|[^A-Za-z0-9._-])@${escapeRegExp(name)}(?=$|[^A-Za-z0-9._-])`, "gi");
        let match;
        while (match = re.exec(text)) {
          const start = match.index + (match[1] ? match[1].length : 0);
          const end = start + 1 + name.length;
          if (!selected || start >= selected.start) selected = { skill: s22, start, end };
          if (re.lastIndex === match.index) re.lastIndex++;
        }
      }
      if (!selected) return { text, skillInvocation: null };
      const task = `${text.slice(0, selected.start)}${text.slice(selected.end)}`.replace(/\s+/g, " ").trim() || t4("chat.skillInvokeTaskFallback");
      const skillInvocation = { name: selected.skill.name, task };
      if (selected.skill.name === "tavily-search") {
        try {
          const credential = await api(`/skills/credentials/${encodeURIComponent(selected.skill.name)}`);
          if (credential.required && !credential.configured) return { text, skillInvocation, credentialRequired: credential };
        } catch (err) {
          return { text, skillInvocation, credentialCheckError: err.message };
        }
      }
      return { text, skillInvocation };
    } catch {
      return { text, skillInvocation: null };
    }
  }, [loadChatSkills]);
  const submitPromptPayload = q2(async (payload) => {
    const resolved = await resolveSkillMention(payload?.text ?? "");
    const text = resolved.text;
    const imageItems = Array.isArray(payload?.images) ? payload.images.filter(Boolean) : [];
    const images = imageItems.filter((item) => typeof item === "string" && item.startsWith("data:image/"));
    const attachments = [...new Set([
      ...Array.isArray(payload?.attachments) ? payload.attachments : [],
      ...imageItems.map((item) => typeof item === "object" ? item.attachmentId : null)
    ].filter(Boolean))];
    if (!text && images.length === 0 && attachments.length === 0) return { ok: false, reason: "empty" };
    if (resolved.credentialCheckError) {
      return { ok: false, reason: t4("chat.skillCredentialCheckFailed", { error: resolved.credentialCheckError }) };
    }
    if (resolved.credentialRequired) {
      return { ok: false, credentialRequired: resolved.credentialRequired };
    }
    try {
      const requestId = String(payload?.requestId || payload?.id || `prompt-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      var body = { prompt: text, requestId };
      if (resolved.skillInvocation) body.skillInvocation = resolved.skillInvocation;
      if (images.length > 0) body.images = images;
      if (attachments.length > 0) body.attachments = attachments;
      const res = await api("/submit", { method: "POST", body });
      if (!res.accepted) {
        return { ok: false, requiresUserRetry: res.requiresUserRetry === true, code: res.code ?? null, reason: res.reason ?? "rejected" };
      }
      if (res.duplicate && res.completed && res.completion?.ok === false) {
        return {
          ok: false,
          requiresUserRetry: true,
          code: "PROMPT_COMPLETION_FAILED",
          reason: res.completion.error ?? "上一次执行未成功，请明确重试。"
        };
      }
      shouldAutoScroll.current = true;
      return { ok: true };
    } catch (err) {
      if (err?.status === 409) {
        const busy2 = err.body?.busy === true || err.body?.code === "LOOP_BUSY";
        return {
          ok: false,
          busy: busy2,
          requiresUserRetry: err.body?.requiresUserRetry === true,
          code: err.body?.code ?? null,
          reason: err.body?.reason ?? err.message
        };
      }
      return { ok: false, reason: err.message };
    }
  }, [resolveSkillMention]);
  const persistQueuedPrompt = q2((item) => {
    if (!queueStorageKey || !item) return Promise.resolve();
    const storedItem = {
      ...item,
      images: Array.isArray(item.images) ? item.images.filter((image) => typeof image === "string" && image.startsWith("data:image/")) : [],
      attachments: [...new Set([
        ...Array.isArray(item.attachments) ? item.attachments : [],
        ...Array.isArray(item.images) ? item.images.map((image) => typeof image === "object" ? image.attachmentId : null) : []
      ].filter(Boolean))]
    };
    return api("/prompt-queue", { method: "POST", body: { scope: queueStorageKey, item: storedItem } });
  }, [queueStorageKey]);
  const deletePersistedQueuedPrompt = q2((id = null) => {
    if (!queueStorageKey) return Promise.resolve();
    return api("/prompt-queue", { method: "DELETE", body: { scope: queueStorageKey, id } });
  }, [queueStorageKey]);
  const enqueuePrompt = q2(async (text, images = []) => {
    const trimmed = String(text ?? "").trim();
    const imageList = Array.isArray(images) ? images.slice() : [];
    if (!trimmed && imageList.length === 0) return false;
    const command = trimmed.split(/\s+/, 1)[0]?.toLowerCase();
    if (command === "/new" || command === "/clear" || command === "/retry") {
      setError(t4("chat.queueCommandBlocked"));
      return false;
    }
    const current = queuedPromptsRef.current ?? [];
    if (current.length >= CHAT_QUEUE_LIMIT) {
      setError(t4("chat.queueLimit", { count: CHAT_QUEUE_LIMIT }));
      return false;
    }
    const id = `queued-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const attachments = imageList.map((image) => typeof image === "object" ? image.attachmentId : null).filter(Boolean);
    const item = {
      id,
      requestId: id,
      text: trimmed,
      images: imageList,
      attachments,
      status: "queued",
      error: null,
      createdAt: Date.now()
    };
    const claimedQueueScope = queueStorageKey;
    for (const attachmentId of attachments) queuedAttachmentIdsRef.current.add(attachmentId);
    try {
      const persisted = await persistQueuedPrompt(item);
      if (persisted?.ok === false) throw new Error(persisted.error || "队列持久化失败");
    } catch (err) {
      for (const attachmentId of attachments) queuedAttachmentIdsRef.current.delete(attachmentId);
      const currentScopeKey = uploadScopeRef.current?.key ?? null;
      const ownershipStillActive = imageList.every((item2) => !item2?.uploadScopeKey || item2.uploadScopeKey === currentScopeKey);
      if (!ownershipStillActive) void releaseUploadedImages(imageList);
      setError(t4("chat.queueFailed", { error: err.message }));
      return false;
    }
    if (queueStorageKeyRef.current !== claimedQueueScope) {
      const attachmentSet = new Set(attachments);
      for (const attachmentId of attachments) queuedAttachmentIdsRef.current.delete(attachmentId);
      pendingImagesRef.current = pendingImagesRef.current.filter((item2) => !attachmentSet.has(item2?.attachmentId));
      setPendingImages((current2) => current2.filter((item2) => !attachmentSet.has(item2?.attachmentId)));
      return false;
    }
    setQueuedPrompts((prev) => [...prev, item]);
    showToast(t4("chat.queueAdded", { count: current.length + 1 }), "info");
    setQueuePumpTick((v3) => v3 + 1);
    return true;
  }, [persistQueuedPrompt, queueStorageKey]);
  const removeQueuedPrompt = q2(async (id) => {
    const removed = queuedPromptsRef.current.find((item) => item.id === id);
    const claimedQueueScope = queueStorageKey;
    try {
      const deleted = await deletePersistedQueuedPrompt(id);
      if (deleted?.ok === false) throw new Error(deleted.error || "队列删除失败");
    } catch (err) {
      setError(t4("chat.queueFailed", { error: err.message }));
      return false;
    }
    for (const attachmentId of removed?.attachments ?? []) queuedAttachmentIdsRef.current.delete(attachmentId);
    void releaseUploadedImages((removed?.attachments ?? []).map((attachmentId) => ({
      attachmentId,
      sessionId: activeConversationId,
      workspace: workspaceDir
    })));
    if (queueStorageKeyRef.current !== claimedQueueScope) return true;
    setQueuedPrompts((prev) => prev.filter((item) => item.id !== id));
    return true;
  }, [deletePersistedQueuedPrompt, activeConversationId, workspaceDir, queueStorageKey]);
  const clearQueuedPrompts = q2(async () => {
    const count = queuedPromptsRef.current.length;
    if (count > 0 && !confirm(t4("chat.queueClearConfirm", { count }))) return;
    const claimedQueueScope = queueStorageKey;
    try {
      const deleted = await deletePersistedQueuedPrompt();
      if (deleted?.ok === false) throw new Error(deleted.error || "队列清空失败");
    } catch (err) {
      setError(t4("chat.queueFailed", { error: err.message }));
      return false;
    }
    const attachmentIds = queuedPromptsRef.current.flatMap((item) => item.attachments ?? []);
    for (const attachmentId of attachmentIds) queuedAttachmentIdsRef.current.delete(attachmentId);
    void releaseUploadedImages(attachmentIds.map((attachmentId) => ({ attachmentId, sessionId: activeConversationId, workspace: workspaceDir })));
    if (queueStorageKeyRef.current !== claimedQueueScope) return true;
    setQueuedPrompts([]);
    setQueueSendingId(null);
    return true;
  }, [deletePersistedQueuedPrompt, activeConversationId, workspaceDir, queueStorageKey]);
  const retryQueuedPrompt = q2((id) => {
    const retryRequestId = `prompt-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setQueuedPrompts((prev) => prev.map((item) => {
      if (item.id !== id) return item;
      const next = { ...item, requestId: retryRequestId, status: "queued", error: null };
      persistQueuedPrompt(next).catch((err) => setError(t4("chat.queueFailed", { error: err.message })));
      return next;
    }));
    setQueuePumpTick((v3) => v3 + 1);
  }, [persistQueuedPrompt]);
  const confirmQueuedReset = q2(async () => {
    const count = queuedPromptsRef.current.length;
    if (count === 0) return true;
    if (!confirm(t4("chat.queueResetConfirm", { count }))) return false;
    const claimedQueueScope = queueStorageKey;
    try {
      const deleted = await deletePersistedQueuedPrompt();
      if (deleted?.ok === false) throw new Error(deleted.error || "队列清空失败");
    } catch (err) {
      setError(t4("chat.queueFailed", { error: err.message }));
      return false;
    }
    const attachmentIds = queuedPromptsRef.current.flatMap((item) => item.attachments ?? []);
    for (const attachmentId of attachmentIds) queuedAttachmentIdsRef.current.delete(attachmentId);
    void releaseUploadedImages(attachmentIds.map((attachmentId) => ({ attachmentId, sessionId: activeConversationId, workspace: workspaceDir })));
    if (queueStorageKeyRef.current !== claimedQueueScope) return true;
    setQueuedPrompts([]);
    setQueueSendingId(null);
    return true;
  }, [deletePersistedQueuedPrompt, activeConversationId, workspaceDir, queueStorageKey]);
  y2(() => {
    if (!queueReady || queuePaused || busy || queueSubmittingRef.current || queuedPrompts.length === 0) return;
    const item = queuedPrompts.find((q4) => q4.status !== "failed");
    if (!item) return;
    queueSubmittingRef.current = true;
    (async () => {
      try {
        setQueueSendingId(item.id);
        setQueuedPrompts((prev) => prev.map((q4) => q4.id === item.id ? { ...q4, status: "sending", error: null } : q4));
        await new Promise((resolve) => setTimeout(resolve, 300));
        const result = await submitPromptPayload(item);
        if (result.ok) {
          for (const attachmentId of item.attachments ?? []) queuedAttachmentIdsRef.current.delete(attachmentId);
          setQueuedPrompts((prev) => prev.filter((q4) => q4.id !== item.id));
          await deletePersistedQueuedPrompt(item.id);
          setTimeout(() => setQueuePumpTick((v3) => v3 + 1), 700);
        } else if (result.busy) {
          setQueuedPrompts((prev) => prev.map((q4) => q4.id === item.id ? { ...q4, status: "queued", error: null } : q4));
          setTimeout(() => setQueuePumpTick((v3) => v3 + 1), 900);
        } else if (result.credentialRequired) {
          setQueuePaused(true);
          setQueuedPrompts((prev) => prev.map((q4) => q4.id === item.id ? { ...q4, status: "queued", error: null } : q4));
          setSkillCredentialValue("");
          setSkillCredentialSetup({ ...result.credentialRequired, payload: item, queuedId: item.id });
        } else {
          const failedItem = { ...item, status: "failed", error: result.reason ?? "failed" };
          setQueuedPrompts((prev) => prev.map((q4) => q4.id === item.id ? failedItem : q4));
          await persistQueuedPrompt(failedItem);
          setError(t4("chat.queueFailed", { error: result.reason ?? "failed" }));
          setTimeout(() => setQueuePumpTick((v3) => v3 + 1), 700);
        }
      } finally {
        setQueueSendingId(null);
        queueSubmittingRef.current = false;
      }
    })();
  }, [busy, queuePaused, queuedPrompts, queuePumpTick, submitPromptPayload, persistQueuedPrompt, deletePersistedQueuedPrompt]);
  const send = q2(async () => {
    const text = inputValueRef.current.trim();
    const images = pendingImages.slice();
    if (!text && images.length === 0) return;
    setError(null);
    if (busy) {
      if (await enqueuePrompt(text, images)) {
        setChatInput("");
        pendingImagesRef.current = [];
        setPendingImages([]);
        setPopoverKind(null);
        removeChatDraft(draftKey);
      }
      return;
    }
    const result = await submitPromptPayload({
      text,
      images,
      attachments: images.map((image) => typeof image === "object" ? image.attachmentId : null).filter(Boolean)
    });
    if (result.ok) {
      setChatInput("");
      pendingImagesRef.current = [];
      setPendingImages([]);
      shouldAutoScroll.current = true;
      removeChatDraft(draftKey);
    } else if (result.busy) {
      if (await enqueuePrompt(text, images)) {
        setChatInput("");
        pendingImagesRef.current = [];
        setPendingImages([]);
        setPopoverKind(null);
        removeChatDraft(draftKey);
      }
    } else if (result.credentialRequired) {
      setSkillCredentialValue("");
      setSkillCredentialSetup({ ...result.credentialRequired, payload: { text, images } });
    } else {
      setError(result.reason ?? "rejected");
    }
  }, [busy, pendingImages, draftKey, enqueuePrompt, submitPromptPayload, setChatInput]);
  const saveSkillCredential = q2(async () => {
    if (!skillCredentialSetup || !skillCredentialValue.trim()) return;
    setSkillCredentialSaving(true);
    setError(null);
    try {
      await api(`/skills/credentials/${encodeURIComponent(skillCredentialSetup.skill)}`, {
        method: "POST",
        body: { apiKey: skillCredentialValue }
      });
      const payload = skillCredentialSetup.payload;
      setSkillCredentialSetup(null);
      setSkillCredentialValue("");
      const result = await submitPromptPayload(payload);
      if (result.ok) {
        if (skillCredentialSetup.queuedId) {
          for (const attachmentId of payload?.attachments ?? []) queuedAttachmentIdsRef.current.delete(attachmentId);
          setQueuedPrompts((prev) => prev.filter((item) => item.id !== skillCredentialSetup.queuedId));
          await deletePersistedQueuedPrompt(skillCredentialSetup.queuedId);
          setQueuePaused(false);
          setTimeout(() => setQueuePumpTick((value) => value + 1), 700);
        } else {
          setChatInput("");
          pendingImagesRef.current = [];
          setPendingImages([]);
          removeChatDraft(draftKey);
        }
        shouldAutoScroll.current = true;
      } else {
        setError(result.reason ?? "rejected");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSkillCredentialSaving(false);
    }
  }, [skillCredentialSetup, skillCredentialValue, submitPromptPayload, setChatInput, draftKey, deletePersistedQueuedPrompt]);
  const resumeIncompletePlan = q2(async () => {
    if (busy || !planContinuation) return;
    const paused = planContinuation;
    setPlanContinuation(null);
    const result = await submitPromptPayload({
      text: "继续执行当前未完成计划。不要重新制定计划，从中断处继续，完成实际产物并验证后再结束。"
    });
    if (!result.ok) {
      setPlanContinuation(paused);
      setError(result.reason ?? "继续执行失败");
    }
  }, [busy, planContinuation, submitPromptPayload]);
  const abort = q2(async () => {
    try {
      if (queuedPromptsRef.current.length > 0) setQueuePaused(true);
      setOperation((current) => current ? { ...current, state: "stopping", stopRequestedAt: (/* @__PURE__ */ new Date()).toISOString() } : current);
      const result = await api("/abort", { method: "POST" });
      if (result.operation) setOperation(result.operation);
    } catch (err) {
      setError(err.message);
    }
  }, []);
  const waitForIdle = q2(async (timeoutMs = 5e3) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const state = await api("/messages?limit=1");
      if (!state.busy) return true;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return false;
  }, []);
  const newConversation = q2(async () => {
    const wasBusy = busy;
    if (busy) {
      if (!confirm(t4("chat.newConfirmBusy"))) return;
    } else if (messages.length > 0 && !confirm(t4("chat.newConfirm"))) {
      return;
    }
    if (!await confirmQueuedReset()) return;
    try {
      if (wasBusy) {
        await api("/abort", { method: "POST" });
        const idle = await waitForIdle();
        if (!idle) throw new Error(t4("chat.stopTimeout"));
      }
      rotateUploadScope();
      await api("/submit", { method: "POST", body: { prompt: "/new" } });
      await releaseUploadedImages(pendingImages);
      const nextOverview = await api("/overview").catch(() => null);
      setActiveConversationId(nextOverview?.conversationId ?? null);
      const retrieval = await api("/index-retrieval-mode").catch(() => ({ mode: "tool" }));
      setIndexRetrievalMode(globalThis.VisionoxIndexModePolicy.normalize(retrieval.mode));
      setSemanticRetrievalSources([]);
      setSemanticRetrievalStatus("idle");
      setMessages([]);
      setTotalMessages(0);
      setVisibleMessageCount(CHAT_INITIAL_RENDER_COUNT);
      topLoadArmedRef.current = true;
      setStreaming(null);
      setActiveTool(null);
      setFileArtifacts([]);
      setFileArtifactsKey("");
      setFileArtifactsDismissed(false);
      setFileArtifactsSelectedMessageId(null);
      setFileArtifactsByMessageId({});
      setChatInput("");
      setPendingImages([]);
      setQueuedPrompts([]);
      setQueueSendingId(null);
      setQueuePaused(false);
      shouldAutoScroll.current = true;
      removeChatDraft(draftKey);
      showToast(t4("chat.newToast"), "info");
      setTimeout(async () => {
        try {
          const r3 = await api(`/messages?limit=${CHAT_MESSAGE_PAGE_SIZE}`);
          setMessages(r3.messages ?? []);
          setTotalMessages(r3.totalMessages ?? r3.messages?.length ?? 0);
        } catch {
        }
      }, 200);
    } catch (err) {
      setError(t4("chat.newFailed", { error: err.message }));
    }
  }, [busy, messages.length, draftKey, pendingImages, confirmQueuedReset, waitForIdle, setChatInput]);
  const changeIndexRetrievalMode = q2(async (event) => {
    const next = globalThis.VisionoxIndexModePolicy.normalize(event.target.value);
    try {
      const result = await api("/index-retrieval-mode", { method: "POST", body: { mode: next } });
      setIndexRetrievalMode(globalThis.VisionoxIndexModePolicy.normalize(result.mode, next));
      setSemanticRetrievalSources([]);
      setSemanticRetrievalStatus("idle");
      setShowRetrievalSources(false);
    } catch (err) {
      setError(err.message);
      setTimeout(() => setError(null), 3e3);
    }
  }, []);
  const previewRetrievedSource = q2(async (source) => {
    if (!workspaceDir || !source?.path) return;
    try {
      await showFileArtifactPreview({ path: `${workspaceDir}/${source.path}` });
    } catch (err) {
      showToast(err.message || "索引来源预览失败", "error", 5e3);
    }
  }, [workspaceDir]);
  const clearScrollback = q2(async () => {
    if (!await confirmQueuedReset()) return;
    try {
      rotateUploadScope();
      await api("/submit", { method: "POST", body: { prompt: "/clear" } });
      await releaseUploadedImages(pendingImages);
      const nextOverview = await api("/overview").catch(() => null);
      setActiveConversationId(nextOverview?.conversationId ?? activeConversationId);
      setMessages([]);
      setTotalMessages(0);
      setVisibleMessageCount(CHAT_INITIAL_RENDER_COUNT);
      topLoadArmedRef.current = true;
      setStreaming(null);
      setActiveTool(null);
      setFileArtifacts([]);
      setFileArtifactsKey("");
      setFileArtifactsDismissed(false);
      setFileArtifactsSelectedMessageId(null);
      setFileArtifactsByMessageId({});
      setChatInput("");
      setPendingImages([]);
      setQueuedPrompts([]);
      setQueueSendingId(null);
      setQueuePaused(false);
      shouldAutoScroll.current = true;
      removeChatDraft(draftKey);
      showToast(t4("chat.clearToast"), "info");
      setTimeout(async () => {
        try {
          const r3 = await api(`/messages?limit=${CHAT_MESSAGE_PAGE_SIZE}`);
          setMessages(r3.messages ?? []);
          setTotalMessages(r3.totalMessages ?? r3.messages?.length ?? 0);
        } catch {
        }
      }, 200);
    } catch (err) {
      setError(t4("chat.clearFailed", { error: err.message }));
    }
  }, [draftKey, pendingImages, confirmQueuedReset, setChatInput]);
  const updatePopover = q2(
    async (text) => {
      const slashMatch = /^\/([A-Za-z0-9_-]*)$/.exec(text);
      if (slashMatch) {
        const prefix = slashMatch[1].toLowerCase();
        const items = slashCommands.filter((c3) => c3.cmd.startsWith(prefix)).slice(0, 12).map((c3) => ({
          label: `/${c3.cmd}`,
          meta: (() => {
            const k4 = "chat.slashHints." + c3.cmd;
            const v3 = t4(k4);
            return v3 === k4 ? c3.summary : v3;
          })(),
          insert: `/${c3.cmd}${c3.argsHint ? " " : ""}`
        })).sort((a3, b3) => a3.label === "/help" ? -1 : b3.label === "/help" ? 1 : a3.label.localeCompare(b3.label));
        setPopoverKind("slash");
        setPopoverItems(items);
        setPopoverSel(0);
        return;
      }
      const mentionMatch = /@([^\s@]*)$/.exec(text);
      if (mentionMatch) {
        const prefix = mentionMatch[1] ?? "";
        const prefixLower = prefix.toLowerCase();
        try {
          const [skills, filesRes] = await Promise.all([
            loadChatSkills().catch(() => []),
            MODE === "attached" ? api("/files", { method: "POST", body: { prefix } }).catch(() => ({ files: [] })) : Promise.resolve({ files: [] })
          ]);
          const seenSkills = /* @__PURE__ */ new Set();
          const skillItems = skills.filter((s22) => {
            const name = String(s22.name ?? "");
            if (!name || seenSkills.has(name.toLowerCase())) return false;
            if (prefixLower && !name.toLowerCase().startsWith(prefixLower)) return false;
            seenSkills.add(name.toLowerCase());
            return true;
          }).map((s22) => ({
            label: s22.name,
            meta: `${t4("chat.skillMentionMeta")}${s22.description ? ` · ${s22.description}` : ""}`,
            insert: `@${s22.name} `,
            kind: "skill"
          }));
          const fileItems = (filesRes.files ?? []).slice(0, Math.max(0, 12 - skillItems.length)).map((f3) => ({
            label: f3,
            meta: t4("chat.projectFiles"),
            insert: `@${f3} `,
            kind: "file"
          }));
          const items = [...skillItems, ...fileItems];
          if (items.length === 0) {
            setPopoverKind(null);
            return;
          }
          setPopoverKind("mention");
          setPopoverItems(items);
          setPopoverSel(0);
        } catch {
          setPopoverKind(null);
        }
        return;
      }
      setPopoverKind(null);
    },
    [slashCommands, loadChatSkills]
  );
  const applyPopover = q2((idx) => {
    const item = popoverItems[idx ?? popoverSel];
    if (!item) return false;
    if (popoverKind === "slash") {
      setChatInput(item.insert);
    } else if (popoverKind === "mention") {
      const input = inputValueRef.current;
      const m3 = /@([^\s@]*)$/.exec(input);
      if (!m3) return false;
      const start = input.length - m3[0].length;
      setChatInput(`${input.slice(0, start)}${item.insert}`);
    }
    setPopoverKind(null);
    return true;
  }, [popoverItems, popoverSel, popoverKind, setChatInput]);
  const onInput = q2(
    (e3) => {
      const v3 = e3.target.value;
      inputValueRef.current = v3;
      const hasContent = Boolean(v3.trim());
      if (inputHasContentRef.current !== hasContent) {
        inputHasContentRef.current = hasContent;
        setInputHasContent(hasContent);
      }
      persistDraftSoon(v3);
      updatePopover(v3);
    },
    [updatePopover, persistDraftSoon]
  );
  const onKeyDown = q2(
    (e3) => {
      if (popoverKind && popoverItems.length > 0) {
        if (e3.key === "ArrowDown") {
          e3.preventDefault();
          setPopoverSel((i3) => (i3 + 1) % popoverItems.length);
          return;
        }
        if (e3.key === "ArrowUp") {
          e3.preventDefault();
          setPopoverSel((i3) => (i3 - 1 + popoverItems.length) % popoverItems.length);
          return;
        }
        if (e3.key === "Tab" || e3.key === "Enter" && !e3.shiftKey) {
          e3.preventDefault();
          if (applyPopover() && e3.key === "Enter" && popoverKind === "slash") {
            send();
          }
          return;
        }
        if (e3.key === "Escape") {
          e3.preventDefault();
          setPopoverKind(null);
          return;
        }
      }
      if (e3.key === "Enter" && !e3.shiftKey) {
        e3.preventDefault();
        send();
      }
    },
    [send, popoverKind, popoverItems, applyPopover]
  );
  var onPaste = q2(function(e3) {
    e3.preventDefault();
    var items = e3.clipboardData?.items;
    var imageFiles = [];
    var fileNames = [];
    var fullPaths = [];
    var gotFullPaths = false;
    var plainText = "";
    function normalizeClipboardPathText(value) {
      return String(value || "").trim().replace(/^([A-Za-z]):(?![\\/])(?=\S)/, "$1:\\");
    }
    function pathLikeClipboardText(value) {
      var s3 = normalizeClipboardPathText(value);
      return /^[A-Za-z]:\\/.test(s3) || s3.startsWith("\\\\") || s3.startsWith("/") || /^file:\/\//i.test(s3);
    }
    function isImagePathName(value) {
      var s3 = String(value || "").trim().replace(/^file:\/\//i, "");
      s3 = s3.split(/[?#]/, 1)[0];
      return /\.(?:png|jpe?g|gif|webp|bmp|tiff?|heic|heif|avif)$/i.test(s3);
    }
    function decodeClipboardUri(value) {
      var raw = String(value || "").trim();
      if (!raw) return "";
      try {
        raw = decodeURIComponent(raw);
      } catch (_3) {
        try {
          raw = decodeURI(raw);
        } catch (_4) {
        }
      }
      if (/^file:\/\//i.test(raw)) {
        if (/^file:\/\/\/[A-Za-z]:/i.test(raw)) {
          return normalizeClipboardPathText(raw.replace(/^file:\/\/\//i, "").replace(/\//g, "\\"));
        }
        return normalizeClipboardPathText(raw.replace(/^file:\/\//i, ""));
      }
      return normalizeClipboardPathText(raw);
    }
    if (items) {
      for (var i3 = 0; i3 < items.length; i3++) {
        var item = items[i3];
        if (item.kind === "file") {
          var f3 = item.getAsFile();
          if (f3?.name) fileNames.push(f3.name);
          if (item.type.startsWith("image/") && f3) imageFiles.push(f3);
        }
      }
    }
    try {
      var uriList = e3.clipboardData.getData("text/uri-list");
      if (uriList) {
        var uris = uriList.split(/\r?\n/).filter(function(s3) {
          return s3.trim() && !s3.startsWith("#");
        });
        fullPaths = uris.map(decodeClipboardUri).filter(Boolean);
        gotFullPaths = fullPaths.length > 0;
      }
    } catch (_3) {
    }
    if (!gotFullPaths) {
      try {
        plainText = e3.clipboardData.getData("text/plain") || "";
        if (plainText) {
          var lines = plainText.split(/\r?\n/).filter(function(s3) {
            return s3.trim();
          });
          if (lines.length > 0 && pathLikeClipboardText(lines[0])) {
            fullPaths = lines.map(function(line) {
              return /^file:\/\//i.test(String(line || "").trim()) ? decodeClipboardUri(line) : normalizeClipboardPathText(line);
            }).filter(Boolean);
            gotFullPaths = true;
          }
        }
      } catch (_3) {
      }
    }
    if (!gotFullPaths && fileNames.length > 0) {
      fullPaths = fileNames;
    }
    var inIframe = false;
    try {
      inIframe = window.parent !== window;
    } catch (_3) {
    }
    var ta = e3.target;
    var start = ta.selectionStart;
    var end = ta.selectionEnd;
    var input = inputValueRef.current;
    var before = input.slice(0, start);
    var after = input.slice(end);
    var inserted = false;
    function insertAtCursor(txt) {
      if (inserted) return;
      inserted = true;
      setChatInput(before + txt + after);
      setTimeout(function() {
        ta.selectionStart = ta.selectionEnd = start + txt.length;
      }, 0);
    }
    function addPendingImages(files) {
      var remaining = pendingImageLimit - pendingImages.length;
      if (remaining <= 0) return;
      var toProcess = files.slice(0, remaining);
      const scope = currentUploadScope();
      Promise.all(toProcess.map(function(f22) {
        return uploadMediaAttachment(f22, scope).catch(function(error2) {
          if (error2?.name === "AbortError") return null;
          console.error("Clipboard image upload failed:", error2);
          return null;
        });
      })).then(function(results) {
        var valid = results.filter(function(r3) {
          return r3 !== null;
        });
        if (uploadScopeRef.current !== scope || scope.controller.signal.aborted) {
          void releaseUploadedImages(valid);
          return;
        }
        if (valid.length > 0) {
          setPendingImages(pendingImages.slice().concat(valid).slice(0, pendingImageLimit));
        }
      });
    }
    function showClipboardNotice(msg) {
      setError(msg);
      setTimeout(function() {
        setError(null);
      }, 3e3);
    }
    function looksLikeClipboardScreenshot() {
      if (imageFiles.length === 0 || gotFullPaths) return false;
      if (plainText.trim()) return false;
      if (fileNames.length === 0) return true;
      if (fileNames.length !== imageFiles.length) return false;
      return fileNames.every(function(name) {
        return /^(?:image|clipboard|screenshot|截图)(?:[-_\s]?\d+)?\.(?:png|jpe?g|gif|webp|bmp)$/i.test(String(name || "").trim());
      });
    }
    function shouldPasteImagesAsAttachments() {
      if (imageFiles.length === 0) return false;
      if (looksLikeClipboardScreenshot()) return true;
      if (fileNames.length > 0 && fileNames.length === imageFiles.length && fileNames.every(isImagePathName)) return true;
      if (gotFullPaths && fullPaths.length > 0 && fullPaths.every(isImagePathName)) return true;
      if (fileNames.length === 0 && !pathLikeClipboardText(plainText.split(/\r?\n/).find(function(s3) {
        return s3.trim();
      }) || "")) return true;
      return false;
    }
    function insertPlainTextIfUsefulWithImages() {
      var text2 = plainText || "";
      if (!text2.trim()) return;
      var first = text2.split(/\r?\n/).find(function(s3) {
        return s3.trim();
      }) || "";
      if (pathLikeClipboardText(first) || /^https?:\/\//i.test(first.trim())) return;
      insertAtCursor(text2);
    }
    function shouldQueryClipboardPaths() {
      if (fileNames.length > 0) return true;
      if (imageFiles.length > 0) return false;
      if (gotFullPaths && fullPaths.length > 0) return false;
      if (plainText.trim()) return false;
      return true;
    }
    if (shouldPasteImagesAsAttachments()) {
      addPendingImages(imageFiles);
      insertPlainTextIfUsefulWithImages();
    } else if (shouldQueryClipboardPaths()) {
      let insertPaths = function(paths) {
        if (inserted) return;
        inserted = true;
        var text2 = paths.map(normalizeClipboardPathText).join("\n");
        setChatInput(capBefore + text2 + capAfter);
        setTimeout(function() {
          ta.selectionStart = ta.selectionEnd = capStart + text2.length;
        }, 0);
      }, fallbackPaste = function() {
        if (inserted) return;
        if (imageFiles.length > 0) {
          addPendingImages(imageFiles);
        } else if (gotFullPaths && fullPaths.length > 0) {
          insertPaths(fullPaths);
        } else if (plainText) {
          insertAtCursor(plainText);
        } else if (fileNames.length > 0) {
          showClipboardNotice("无法读取剪贴板中的文件路径，请重新复制文件或文件夹。");
        }
      }, tryServerClipboardPaths = function() {
        var clipboardUrl = "/api/clipboard-files" + (TOKEN ? "?token=" + encodeURIComponent(TOKEN) : "");
        fetch(clipboardUrl).then(function(r3) {
          return r3.json();
        }).then(function(data) {
          var paths = data.paths || [];
          if (paths.length > 0) insertPaths(paths);
          else fallbackPaste();
        }).catch(fallbackPaste);
      }, tryRustBridge = function() {
        if (!inIframe) {
          tryServerClipboardPaths();
          return;
        }
        try {
          var handled = false;
          var listener = function(e22) {
            if (e22.data && e22.data.type === "vis_clipboard_result") {
              handled = true;
              window.removeEventListener("message", listener);
              clearTimeout(timer);
              if (e22.data.paths && e22.data.paths.length > 0) {
                insertPaths(e22.data.paths.slice());
              } else {
                tryServerClipboardPaths();
              }
            }
          };
          window.addEventListener("message", listener);
          window.parent.postMessage({ type: "vis_get_clipboard" }, "*");
          var timer = setTimeout(function() {
            if (!handled) {
              window.removeEventListener("message", listener);
              tryServerClipboardPaths();
            }
          }, 1e3);
        } catch (_3) {
          tryServerClipboardPaths();
        }
      };
      var capBefore = before, capAfter = after, capStart = start;
      tryRustBridge();
    } else if (gotFullPaths && fullPaths.length > 0) {
      insertAtCursor(fullPaths.map(normalizeClipboardPathText).join("\n"));
    } else {
      try {
        var text = e3.clipboardData.getData("text/plain");
        if (text) insertAtCursor(text);
      } catch (_3) {
      }
    }
  }, [pendingImages, pendingImageLimit, setChatInput, uploadScopeKey]);
  y2(() => {
    if (bootError) return;
    const el = feedRef.current;
    if (!el) return;
    const maybeLoadEarlier = () => {
      if (el.scrollTop > CHAT_TOP_LOAD_THRESHOLD || scrollbarDraggingRef.current || loadingEarlierRef.current || !topLoadArmedRef.current) return;
      topLoadArmedRef.current = false;
      void loadEarlierMessagesRef.current?.();
    };
    const onScroll = () => {
      if (autoScrollInFlight.current) return;
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      shouldAutoScroll.current = distFromBottom < 80;
      if (el.scrollTop > CHAT_TOP_LOAD_THRESHOLD * 2) topLoadArmedRef.current = true;
      maybeLoadEarlier();
    };
    const onPointerDown = (event) => {
      const rect = el.getBoundingClientRect();
      const scrollbarWidth = Math.max(14, rect.width - el.clientWidth);
      if (el.scrollHeight > el.clientHeight && event.clientX >= rect.right - scrollbarWidth) {
        scrollbarDraggingRef.current = true;
      }
    };
    const onPointerUp = () => {
      if (!scrollbarDraggingRef.current) return;
      scrollbarDraggingRef.current = false;
      maybeLoadEarlier();
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pointerup", onPointerUp, { passive: true });
    window.addEventListener("pointercancel", onPointerUp, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [bootError]);
  y2(() => {
    if (!shouldAutoScroll.current) return;
    const el = feedRef.current;
    if (!el) return;
    autoScrollInFlight.current = true;
    el.scrollTop = el.scrollHeight;
    setTimeout(() => {
      autoScrollInFlight.current = false;
    }, 0);
  }, [messages, streaming]);
  const resolveModal = q2(async (kind, choice, text) => {
    if (modalResolving || !modal) return;
    const gateModal = kind === "shell" || kind === "choice" || kind === "plan" || kind === "checkpoint" || kind === "revision";
    if (gateModal && !Number.isInteger(modal._gateId)) return;
    const submittedModal = modal;
    const gateId = modal._gateId;
    setModalResolving(true);
    try {
      await api("/modal/resolve", {
        method: "POST",
        body: text !== void 0 ? { kind, choice, text, ...gateModal ? { gateId } : {} } : { kind, choice, ...gateModal ? { gateId } : {} }
      });
      setModal((cur) => gateModal ? cur?._gateId === gateId ? null : cur : cur === submittedModal ? null : cur);
    } catch (err) {
      setError(`modal resolve failed: ${err.message}`);
    } finally {
      setModalResolving(false);
    }
  }, [modal, modalResolving]);
  y2(() => {
    if (!modal) return;
    const frame = requestAnimationFrame(() => {
      document.querySelector(".modal-card .modal-actions .primary, .modal-card .modal-choice-row")?.focus?.();
    });
    return () => cancelAnimationFrame(frame);
  }, [modal?._gateId]);
  y2(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const o3 = await api("/overview");
        if (cancelled) return;
        setEditModeLocal(o3.editMode ?? null);
        setPresetLocal(o3.preset ?? null);
        setEffortLocal(o3.reasoningEffort ?? null);
        setModeLocal(o3.workMode ?? "general");
        setModesLocal(o3.modes ?? null);
        setActiveModeLocal(o3.activeMode ?? null);
        setEccRulesLocal(o3.eccRules ?? null);
        setWorkspaceDirLocal(o3.cwd ?? null);
        setActiveConversationId(o3.conversationId ?? null);
        setStats(o3.stats ?? null);
        setOverviewModel(o3.model ?? null);
        setBudgetUsd(o3.budgetUsd ?? null);
        setActiveProviderId(o3.activeProviderId ?? null);
        setProviderCaps(o3.providerCapabilities ?? null);
        if (!providers) {
          try {
            const pr = await api("/providers");
            if (!cancelled) {
              setProviders(pr.providers ?? []);
              setModelVerification(pr.modelVerification ?? null);
            }
          } catch {
          }
        }
        try {
          const plans = await api("/plans");
          if (!cancelled) setActivePlan((plans.plans ?? []).find((p3) => ["active", "pending"].includes(planStatus(p3))) ?? null);
        } catch {
          if (!cancelled) setActivePlan(null);
        }
        setSemanticIndex(o3.semanticIndexExists ?? null);
      } catch {
      }
    };
    tick();
    const unsubscribe = subscribeSse("overview", (o3) => {
      if (cancelled) return;
      setEditModeLocal(o3.editMode ?? null);
      setPresetLocal(o3.preset ?? null);
      setEffortLocal(o3.reasoningEffort ?? null);
      setModeLocal(o3.workMode ?? "general");
      setModesLocal(o3.modes ?? null);
      setActiveModeLocal(o3.activeMode ?? null);
      setEccRulesLocal(o3.eccRules ?? null);
      setWorkspaceDirLocal(o3.cwd ?? null);
      setActiveConversationId(o3.conversationId ?? null);
      setStats(o3.stats ?? null);
      setOverviewModel(o3.model ?? null);
      setBudgetUsd(o3.budgetUsd ?? null);
      setActiveProviderId(o3.activeProviderId ?? null);
      setProviderCaps(o3.providerCapabilities ?? null);
      setSemanticIndex(o3.semanticIndexExists ?? null);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);
  const setEditMode = q2(async (next) => {
    if (next === "yolo" || next === "admin") {
      const msg = next === "admin" ? "切换到 admin 模式将移除所有安全限制（Shell 和文件系统均无限制）。确定？" : "切换到 yolo 模式将自动执行所有 Shell 命令（不再逐条确认）。确定？";
      if (!confirm(msg)) return;
    }
    setEditModeLocal(next);
    try {
      await api("/edit-mode", { method: "POST", body: { mode: next } });
    } catch (err) {
      setError(`mode switch failed: ${err.message}`);
      try {
        const o3 = await api("/overview");
        setEditModeLocal(o3.editMode ?? null);
      } catch {
      }
    }
  }, []);
  const setSetting = q2(async (key, value) => {
    const modelMenuSetting = key === "preset" || key === "reasoningEffort" || key === "model";
    if (modelMenuSetting) pushModelNotice("正在应用模型设置...", "info", 0);
    if (key === "preset") setPresetLocal(value);
    if (key === "reasoningEffort") setEffortLocal(value);
    if (key === "mode") setModeLocal(value);
    try {
      const updated = await api("/settings", { method: "POST", body: { [key]: value } });
      if (key === "mode") showToast("工作场景已切换，下次新对话生效", "info");
      if ((key === "preset" || key === "model") && updated?.modelSwitch) {
        const switched = updated.modelSwitch;
        const count = Number.isFinite(switched.messageCount) ? switched.messageCount : 0;
        const adaptation = switched.contextStatus?.needsCompaction ? "，发送下一条消息前将自动整理历史" : "";
        pushModelNotice(switched.deferred ? `已选择 ${switched.model}，将在当前回答结束后切换，保留 ${count} 条上下文${adaptation}` : `✓ 已切换到 ${switched.model}，保留 ${count} 条上下文${adaptation}`, "success");
      } else if (key === "preset") {
        pushModelNotice(`✓ 已选择 ${value} 模式`, "success");
      } else if (key === "reasoningEffort") {
        pushModelNotice(`✓ 推理强度已设为 ${reasoningEffortLabel(value)}`, "success");
      }
      try {
        const o3 = await api("/overview");
        setStats(o3.stats ?? null);
        setOverviewModel(o3.model ?? null);
        setPresetLocal(o3.preset ?? null);
        setEffortLocal(o3.reasoningEffort ?? null);
      } catch {
      }
    } catch (err) {
      if (modelMenuSetting) pushModelNotice(`切换失败：${err.message}`, "error", 5e3);
      else setError(`${key} switch failed: ${err.message}`);
      try {
        const o3 = await api("/overview");
        setPresetLocal(o3.preset ?? null);
        setEffortLocal(o3.reasoningEffort ?? null);
        setModeLocal(o3.workMode ?? "general");
        setModesLocal(o3.modes ?? null);
        setActiveModeLocal(o3.activeMode ?? null);
        setEccRulesLocal(o3.eccRules ?? null);
      } catch {
      }
    }
  }, [pushModelNotice]);
  const selectProviderModel = q2(async (providerId, modelId) => {
    pushModelNotice("正在切换模型...", "info", 0);
    try {
      const switched = await api("/providers/active", { method: "POST", body: { id: providerId, modelId } });
      const [pr, overview] = await Promise.all([api("/providers"), api("/overview")]);
      setProviders(pr.providers ?? []);
      setModelVerification(pr.modelVerification ?? null);
      setActiveProviderId(overview.activeProviderId ?? providerId);
      setProviderCaps(overview.providerCapabilities ?? pr.providerCapabilities ?? null);
      setPresetLocal(overview.preset ?? switched.preset ?? null);
      setEffortLocal(overview.reasoningEffort ?? null);
      setOverviewModel(overview.model ?? modelId);
      const count = switched?.modelSwitch?.messageCount;
      pushModelNotice(Number.isFinite(count) ? `✓ 已切换模型，保留 ${count} 条上下文` : "✓ 模型已切换", "success");
    } catch (err) {
      pushModelNotice(`切换失败：${err.message}`, "error", 5e3);
    }
  }, [pushModelNotice]);
  const confirmProviderImport = q2(async (draft, plan) => {
    pushModelNotice("正在导入模型配置...", "info", 0);
    try {
      await api("/providers/import", {
        method: "POST",
        body: { ...draft, confirmDestructive: plan.requiresConfirmation === true }
      });
      const [pr, overview] = await Promise.all([api("/providers"), api("/overview")]);
      setProviders(pr.providers ?? []);
      setModelVerification(pr.modelVerification ?? null);
      setActiveProviderId(overview.activeProviderId ?? null);
      setProviderCaps(overview.providerCapabilities ?? null);
      setPresetLocal(overview.preset ?? null);
      setEffortLocal(overview.reasoningEffort ?? null);
      setOverviewModel(overview.model ?? null);
      pushModelNotice("✓ 配置导入成功，请检测模型", "success", 5e3);
    } catch (err) {
      pushModelNotice(`导入失败：${err.message}`, "error", 5e3);
    }
  }, [pushModelNotice]);
  const loadProviderImportFile = q2(async (event) => {
    const file = event.target.files?.[0];
    if (!file || providerImporting) return;
    setProviderImporting(true);
    pushModelNotice("正在检查模型配置...", "info", 0);
    try {
      const draft = parseProviderImportJson(await file.text());
      const plan = await api("/providers/import/preview", { method: "POST", body: draft });
      if (plan.requiresConfirmation === true && !confirm("该配置会永久删除现有模型，确认继续导入吗？")) {
        pushModelNotice("已取消导入", "info");
        return;
      }
      await confirmProviderImport(draft, plan);
    } catch (err) {
      pushModelNotice(`导入失败：${err.message}`, "error", 5e3);
    } finally {
      setProviderImporting(false);
    }
  }, [providerImporting, confirmProviderImport, pushModelNotice]);
  const testAllProviders = q2(async () => {
    if (providerTesting) return;
    setProviderTesting(true);
    pushModelNotice("正在检测全部模型...", "info", 0);
    try {
      const tested = await api("/providers/test", { method: "POST", body: {} });
      const [pr, overview] = await Promise.all([api("/providers"), api("/overview")]);
      setProviders(pr.providers ?? []);
      setModelVerification(pr.modelVerification ?? null);
      setActiveProviderId(overview.activeProviderId ?? null);
      setProviderCaps(overview.providerCapabilities ?? null);
      setPresetLocal(overview.preset ?? null);
      setEffortLocal(overview.reasoningEffort ?? null);
      setOverviewModel(overview.model ?? null);
      const failed = tested.total - tested.passed;
      pushModelNotice(failed > 0 ? `检测完成：${tested.passed} 个可用，${failed} 个不可用` : `✓ ${tested.passed} 个模型全部可用`, failed > 0 ? "error" : "success", 5e3);
    } catch (err) {
      pushModelNotice(`模型检测失败：${err.message}`, "error", 5e3);
    } finally {
      setProviderTesting(false);
    }
  }, [providerTesting, pushModelNotice]);
  const cleanupFailedModels = q2(async () => {
    const failed = providerModelTestSummary(providers ?? []).failed;
    if (!failed || !modelVerification?.testedAt || providerCleaning) return;
    if (!confirm(`将删除 ${failed} 个检测失败模型，不影响可用模型。确认继续吗？`)) return;
    setProviderCleaning(true);
    pushModelNotice("正在删除检测失败模型...", "info", 0);
    try {
      const cleaned = await api("/providers/cleanup-failed", { method: "POST", body: { testedAt: modelVerification.testedAt } });
      const [pr, overview] = await Promise.all([api("/providers"), api("/overview")]);
      setProviders(pr.providers ?? []);
      setModelVerification(pr.modelVerification ?? null);
      setActiveProviderId(overview.activeProviderId ?? cleaned.activeProviderId ?? null);
      setProviderCaps(overview.providerCapabilities ?? pr.providerCapabilities ?? null);
      setPresetLocal(overview.preset ?? null);
      setEffortLocal(overview.reasoningEffort ?? null);
      setOverviewModel(overview.model ?? cleaned.activeModelId ?? null);
      pushModelNotice(`✓ 已删除 ${cleaned.removedModels} 个不可用模型`, "success", 5e3);
    } catch (err) {
      pushModelNotice(`删除失败：${err.message}`, "error", 5e3);
    } finally {
      setProviderCleaning(false);
    }
  }, [providers, modelVerification, providerCleaning, pushModelNotice]);
  const pickWorkspace = q2(async (dir) => {
    setShowWsPicker(false);
    try {
      const result = await api("/workspaces", { method: "POST", body: { path: dir } });
      setWorkspaceSelection(result);
      setRecentWss(result.recentWorkspaces ?? []);
      showToast(t4("chat.workspaceChanged", { path: result.configured }), "info", 5e3);
    } catch (err) {
      setError(err.message);
    }
  }, []);
  const loadWorkspaceOptions = q2(async () => {
    try {
      const result = await api("/workspaces");
      setWorkspaceSelection(result);
      setRecentWss(result.recentWorkspaces ?? []);
    } catch (err) {
      setError(err.message);
    }
  }, []);
  const removeWorkspaceOption = q2(async (path) => {
    try {
      const result = await api("/workspaces", { method: "DELETE", body: { path } });
      setWorkspaceSelection(result);
      setRecentWss(result.recentWorkspaces ?? []);
    } catch (err) {
      setError(err.message);
    }
  }, []);
  const browseWorkspace = q2(async () => {
    setShowWsPicker(false);
    let path = "";
    try {
      path = await pickWorkspaceDirectoryFromBridge();
    } catch {
      path = prompt(t4("chat.workspaceManual")) || "";
    }
    if (path.trim()) await pickWorkspace(path.trim());
  }, [pickWorkspace]);
  const copyMessage = q2(async (msg) => {
    const text = (msg.text ?? "").trim();
    if (!text) return;
    try {
      await writeClipboardText(text);
      showToast(t4("chat.copiedMessage"), "info");
    } catch (err) {
      setError(t4("chat.copyFailed", { error: err.message }));
    }
  }, [draftKey]);
  const fillInputFromMessage = q2((msg) => {
    const text = msg.text ?? "";
    if (!text.trim()) return;
    setChatInput(text);
    setPopoverKind(null);
    setTimeout(() => {
      inputRef.current?.focus();
      try {
        inputRef.current.selectionStart = inputRef.current.selectionEnd = text.length;
      } catch {
      }
    }, 0);
    showToast(t4("chat.filledInput"), "info");
  }, [setChatInput]);
  const selectArtifactMessage = q2((msg) => {
    setFileArtifactsSelectedMessageId(String(msg.id || ""));
    setFileArtifactsDismissed(false);
  }, []);
  const followLatestArtifacts = q2(() => {
    setFileArtifactsSelectedMessageId(null);
    setFileArtifactsDismissed(false);
  }, []);
  const dismissArtifacts = q2(() => setFileArtifactsDismissed(true), []);
  const loadEarlierMessages = q2(async () => {
    if (loadingEarlierRef.current) return;
    const feed = feedRef.current;
    const anchor = captureChatScrollAnchor(feed);
    const finishLoading = () => {
      loadingEarlierRef.current = false;
      setLoadingEarlierMessages(false);
    };
    if (visibleMessageCount < messages.length) {
      loadingEarlierRef.current = true;
      setLoadingEarlierMessages(true);
      setVisibleMessageCount((count) => Math.min(messages.length, count + CHAT_RENDER_STEP));
      restoreChatScrollAnchor(feed, anchor, finishLoading);
      return;
    }
    if (messages.length >= totalMessages) return;
    loadingEarlierRef.current = true;
    setLoadingEarlierMessages(true);
    try {
      const data = await api(`/messages?limit=${CHAT_MESSAGE_PAGE_SIZE}&offset=${messages.length}`);
      const earlier = Array.isArray(data.messages) ? data.messages : [];
      if (earlier.length > 0) {
        setMessages((current) => [...earlier, ...current]);
        setVisibleMessageCount((count) => count + Math.min(CHAT_RENDER_STEP, earlier.length));
      }
      setTotalMessages(data.totalMessages ?? totalMessages);
      restoreChatScrollAnchor(feed, anchor, finishLoading);
    } catch (err) {
      setError(err.message);
      finishLoading();
    }
  }, [visibleMessageCount, messages, totalMessages]);
  y2(() => {
    loadEarlierMessagesRef.current = loadEarlierMessages;
  }, [loadEarlierMessages]);
  const activeInputModalities = activeModel?.capabilities?.inputModalities ?? (activeModel?.multimodal ? ["text", "image"] : ["text"]);
  const canUploadImages = activeInputModalities.includes("image");
  const canUploadVideos = activeProvider?.providerType === "kimi" && activeInputModalities.includes("video");
  const canUploadMedia = canUploadImages || canUploadVideos;
  const acceptedAttachmentTypes = canUploadVideos ? `${canUploadImages ? "image/*," : ""}video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm` : "image/*";
  const activeModelEfforts = Array.isArray(activeModel?.efforts) ? activeModel.efforts : [];
  y2(() => {
    if (pendingImages.length === 0) return;
    const retained = pendingImages.filter((item) => {
      if (typeof item === "string") return canUploadImages;
      return item?.kind === "video" ? canUploadVideos : canUploadImages;
    });
    if (retained.length === pendingImages.length) return;
    const removed = pendingImages.filter((item) => !retained.includes(item));
    void releaseUploadedImages(removed);
    setPendingImages(retained);
  }, [canUploadImages, canUploadVideos]);
  if (bootError) {
    return html4`<div class="notice err">${t4("common.loadingFailed", { name: "chat", error: bootError })}</div>`;
  }
  return html4`
    <div class="chat-shell">
      <div class="chat-toolbar">
        <div class="header-pickers">${modes ? html4`
              <div class="work-mode-summary" title=${activeMode?.hint || "切换后下次新对话生效"}>
                <span class="work-mode-label">${activeMode?.label ?? mode}</span>
                <span class="work-mode-desc">${activeMode?.description ?? "切换工作场景"}</span>
                <span class="work-mode-meta">ECC ${(activeMode?.effectiveRules ?? activeMode?.rules ?? []).join("+") || "未启用"}${eccRules?.available ? ` · ${(eccRules.enabled ?? []).length}/${eccRules.available.length}` : ""}</span>
              </div>
              <div class="mode-picker work-mode-picker" title="工作场景 \u2014 下次新对话生效">
                ${modes.map((m3) => html4`
                  <button
                    key=${m3.id}
                    class="mode-btn ${mode === m3.id ? "active accent" : ""}"
                    onClick=${() => setSetting("mode", m3.id)}
                    title="${m3.label}: ${m3.description || "切换工作场景"} · ECC ${(m3.effectiveRules || m3.rules || []).join("+")} · 下次新对话生效"
                  >${m3.label}</button>
                `)}
              </div>
            ` : null}
          ${editMode ? html4`
              <div class="mode-picker" title=${t4("chat.editGateTitle")}>
                ${["auto", "yolo", "admin"].map(
    (m3) => html4`
                  <button
                    key=${m3}
                    class="mode-btn ${editMode === m3 ? "active" : ""} ${m3 === "auto" ? "auto" : ""} ${m3 === "yolo" ? "yolo" : ""} ${m3 === "admin" ? "admin" : ""}"
                    onClick=${() => setEditMode(m3)}
                    title=${m3 === "auto" ? t4("chat.editAutoTitle") : m3 === "yolo" ? t4("chat.editYoloTitle") : t4("chat.editAdminTitle")}
                  >${m3}</button>
                `
  )}
              </div>
            ` : null}
        </div>
      </div>

      ${!busy && statusLine ? html4`<div class="chat-status"><span class="muted">${statusLine}</span></div>` : null}
      ${!eventStreamConnected ? html4`<div class="chat-banner"><span class="chat-banner-icon">!</span><span class="chat-banner-text">${t4("chat.reconnecting")}</span></div>` : null}
      ${semanticIndex === false && !semanticBannerDismissed ? html4`<div class="chat-banner">
              <span class="chat-banner-icon">≈</span>
              <span class="chat-banner-text">
                <strong>${t4("chat.semanticBanner")}</strong>
                <span class="muted">
                  ${t4("chat.semanticBannerDesc")}
                </span>
              </span>
              <button
                class="primary"
                onClick=${() => appBus.dispatchEvent(new CustomEvent("navigate-tab", { detail: { tabId: "semantic" } }))}
              >${t4("chat.semanticBannerBtn")}</button>
              <button
                class="chat-banner-close"
                onClick=${() => setSemanticBannerDismissed(true)}
                title=${t4("chat.semanticBannerDismiss")}
              >×</button>
            </div>` : null}
      ${error ? html4`<div class="notice err">${error}</div>` : null}

      <div class=${`chat-body ${!showBackgroundJobs && (activePlan || fileArtifacts.length && !fileArtifactsDismissed) ? "with-rail" : ""}`}>
        <div class="chat-main">
          ${showBackgroundJobs ? html4`<${BackgroundJobsWorkbench}
            jobs=${backgroundJobs}
            pendingDeliveries=${pendingDeliveries}
            selectedId=${selectedBackgroundJobId}
            detail=${backgroundJobDetail}
            onSelect=${openBackgroundWorkbench}
            onClose=${closeBackgroundWorkbench}
            onControl=${controlDocumentJob}
            onStop=${stopBackgroundJob}
            onAbandon=${abandonBackgroundJob}
            onDelete=${deleteBackgroundJobRecord}
            onPreview=${previewDocumentJob}
          />` : html4`<${ChatFeed}
            messages=${messages}
            totalMessages=${totalMessages}
            streaming=${streaming}
            reasoningExpanded=${reasoningExpanded}
            innerRef=${feedRef}
            visibleCount=${visibleMessageCount}
            onLoadEarlier=${loadEarlierMessages}
            loadingEarlier=${loadingEarlierMessages}
            highlightMessageId=${highlightMessageId}
            onCopyMessage=${copyMessage}
            onFillInput=${fillInputFromMessage}
            userAvatar=${userAvatar}
            selectedArtifactMessageId=${fileArtifactsSelectedMessageId}
            onSelectArtifactMessage=${selectArtifactMessage}
          />`}

          ${modal ? html4`<div class=${modalResolving ? "modal-resolving" : ""}>${modal.kind === "shell" ? html4`<${ShellModal} modal=${modal} onResolve=${resolveModal} />` : modal.kind === "choice" ? html4`<${ChoiceModal} modal=${modal} onResolve=${resolveModal} />` : modal.kind === "plan" ? html4`<${PlanModal} modal=${modal} onResolve=${resolveModal} />` : modal.kind === "edit-review" ? html4`<${EditReviewModal} modal=${modal} onResolve=${resolveModal} />` : modal.kind === "workspace" ? html4`<${WorkspaceModal} modal=${modal} onResolve=${resolveModal} />` : modal.kind === "checkpoint" ? html4`<${CheckpointModal} modal=${modal} onResolve=${resolveModal} />` : modal.kind === "revision" ? html4`<${RevisionModal} modal=${modal} onResolve=${resolveModal} />` : modal.kind === "picker" ? html4`<${PickerModal} modal=${modal} onResolve=${resolveModal} />` : modal.kind === "viewer" ? html4`<${ViewerModal} modal=${modal} onResolve=${resolveModal} />` : null}</div>` : null}

          ${!showBackgroundJobs && planContinuation ? html4`
            <div class="plan-continuation-bar" role="status">
              <span class="plan-continuation-icon">!</span>
              <span class="plan-continuation-text">
                计划尚未完成 · ${planContinuation.completedSteps}/${planContinuation.totalSteps} 步
                <small>已自动续跑 ${planContinuation.attempts} 次</small>
              </span>
              <button type="button" class="primary" onClick=${resumeIncompletePlan} disabled=${busy}>继续执行</button>
              <button type="button" class="plan-continuation-dismiss" onClick=${() => setPlanContinuation(null)} title="暂时关闭">×</button>
            </div>
          ` : null}

          ${!showBackgroundJobs && todos.length > 0 ? html4`<${TodoBar} todos=${todos} expanded=${todoExpanded} onToggle=${() => setTodoExpanded(!todoExpanded)} />` : null}

          <div class="chat-input-area" style="position:relative;flex-direction:column;gap:2px;padding-top:6px">
            ${popoverKind && popoverItems.length > 0 ? html4`
                  <div class="popover" style="position:absolute;bottom:calc(100% + 6px);left:0;width:380px;max-height:280px;overflow-y:auto;z-index:10">
                    <div class="popover-h">${popoverKind === "slash" ? t4("chat.slashCommands") : t4("chat.mentionTargets")}</div>
                    ${popoverItems.map(
    (it, i3) => html4`
                        <div
                          class=${`popover-row ${i3 === popoverSel ? "sel" : ""}`}
                          onMouseDown=${(e3) => {
      e3.preventDefault();
      setPopoverSel(i3);
      applyPopover(i3);
    }}
                        >
                          <span class="g">${popoverKind === "slash" ? "/" : it.kind === "skill" ? "S" : "@"}</span>
                          <span class="name">${it.label}</span>
                          ${it.meta ? html4`<span class="meta">${it.meta}</span>` : null}
                        </div>
                      `
  )}
                  </div>
                ` : null}
            <div style="flex:1;display:flex;flex-direction:column;gap:2px;min-width:0">
              <div style="display:flex;gap:6px;align-items:flex-end">
            <div style="flex:1;display:flex;flex-direction:column;gap:2px;min-width:0">
            ${canUploadMedia ? html4`<input type="file" accept=${acceptedAttachmentTypes} multiple onChange=${handleFileChange} ref=${fileInputRef} style="display:none" />` : null}
            ${pendingImages.length > 0 ? html4`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:4px">${pendingImages.map(function(image, idx) {
    const preview = typeof image === "string" ? image : image?.preview;
    const isVideo = typeof image === "object" && image?.kind === "video";
    return html4`<div style="position:relative;width:56px;height:56px;border-radius:4px;overflow:hidden;border:1px solid var(--border-default,#2a2e38);flex-shrink:0" title=${typeof image === "object" ? image.name : "图片"}>${preview ? html4`<img src=${preview} style="width:100%;height:100%;object-fit:cover" />` : html4`<span style="display:flex;width:100%;height:100%;align-items:center;justify-content:center;font-size:11px;color:var(--text-muted)">${isVideo ? "视频" : "图片"}</span>`}<button onClick=${function() {
      void releaseUploadedImages([image]);
      var next = pendingImages.slice();
      next.splice(idx, 1);
      setPendingImages(next);
    }} style="position:absolute;top:2px;right:2px;width:18px;height:18px;background:rgba(248,113,113,0.95);color:#fff;border:none;border-radius:50%;font-size:10px;line-height:18px;cursor:pointer;padding:0;box-shadow:0 1px 3px rgba(0,0,0,0.3);opacity:1;display:flex;align-items:center;justify-content:center;" title="删除附件">✕</button></div>`;
  })}</div>` : null}
            ${queuedPrompts.length > 0 ? html4`
              <div class="chat-queue">
                ${queuePaused ? html4`<div class="chat-queue-paused"><span>${t4("chat.queuePaused")}</span><button type="button" onClick=${() => {
    setQueuePaused(false);
    setQueuePumpTick((v3) => v3 + 1);
  }}>${t4("chat.queueResume")}</button></div>` : null}
                <div class="chat-queue-head">
                  <span>${t4("chat.queueTitle", { count: queuedPrompts.length, max: CHAT_QUEUE_LIMIT })}</span>
                  ${queuedPrompts.length > 1 ? html4`<button type="button" onClick=${clearQueuedPrompts}>${t4("chat.queueClear")}</button>` : null}
                </div>
                <div class="chat-queue-list">
                  ${queuedPrompts.map((item, idx) => {
    const imageCount = Math.max(item.images?.length ?? 0, item.attachments?.length ?? 0);
    const text = item.text || t4("chat.queueImagesOnly", { count: imageCount });
    const isSending = item.status === "sending" || queueSendingId === item.id;
    const isFailed = item.status === "failed";
    return html4`
                      <div class=${`chat-queue-item ${isSending ? "sending" : ""} ${isFailed ? "failed" : ""}`} key=${item.id}>
                        <span class="chat-queue-index">${idx + 1}</span>
                        <span class="chat-queue-text" title=${text}>${text}</span>
                        ${imageCount > 0 ? html4`<span class="chat-queue-meta">${t4("chat.queueImageMeta", { count: imageCount })}</span>` : null}
                        ${isSending ? html4`<span class="chat-queue-state">${t4("chat.queueSending")}</span>` : null}
                        ${isFailed ? html4`<span class="chat-queue-state error" title=${item.error || ""}>${t4("chat.queueFailedStatus")}</span>` : null}
                        ${isFailed ? html4`<button type="button" onClick=${() => retryQueuedPrompt(item.id)}>${t4("chat.queueRetry")}</button>` : null}
                        ${!isSending ? html4`<button type="button" onClick=${() => removeQueuedPrompt(item.id)}>${t4("chat.queueCancel")}</button>` : null}
                      </div>
                    `;
  })}
                </div>
              </div>
            ` : null}
            ${skillCredentialSetup ? html4`
              <div class="card accent-brand" style="padding:10px 12px;margin-bottom:6px">
                <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
                  <div style="min-width:0">
                    <div style="font-size:12px;font-weight:600;color:var(--fg-0)">${t4("chat.skillCredentialTitle", { label: skillCredentialSetup.label })}</div>
                    <div style="font-size:11px;color:var(--fg-3);line-height:1.45;margin-top:2px">${t4("chat.skillCredentialHint", { skill: skillCredentialSetup.skill })}</div>
                  </div>
                  <a href=${skillCredentialSetup.helpUrl} target="_blank" rel="noreferrer" style="font-size:11px;white-space:nowrap">${t4("chat.skillCredentialHelp")}</a>
                </div>
                <div style="display:flex;gap:6px;margin-top:8px;align-items:center">
                  <input
                    type="password"
                    autocomplete="off"
                    placeholder=${t4("chat.skillCredentialPlaceholder")}
                    value=${skillCredentialValue}
                    onInput=${(e3) => setSkillCredentialValue(e3.target.value)}
                    onKeyDown=${(e3) => {
    if (e3.key === "Enter") {
      e3.preventDefault();
      void saveSkillCredential();
    }
  }}
                    disabled=${skillCredentialSaving}
                    style="flex:1;min-width:0"
                  />
                  <button type="button" class="primary" disabled=${skillCredentialSaving || !skillCredentialValue.trim()} onClick=${saveSkillCredential}>${skillCredentialSaving ? t4("chat.skillCredentialSaving") : t4("chat.skillCredentialSave")}</button>
                  <button type="button" disabled=${skillCredentialSaving} onClick=${() => {
    setSkillCredentialSetup(null);
    setSkillCredentialValue("");
  }}>${t4("common.cancel")}</button>
                </div>
              </div>
            ` : null}
            <textarea
              ref=${inputRef}
              placeholder=${busy ? t4("chat.placeholderBusy") : t4("chat.placeholder")}
              defaultValue=${inputValueRef.current}
              onInput=${onInput}
              onKeyDown=${onKeyDown}
              onPaste=${onPaste}
              onBlur=${() => setTimeout(() => setPopoverKind(null), 150)}
              style="flex:1"
              rows="4"
            ></textarea>
            <div class="composer-controls">
              <button type="button" class="composer-chip" aria-expanded=${showSkillPicker} onClick=${() => {
    setShowSkillPicker(!showSkillPicker);
    setShowWsPicker(false);
    if (!showSkillPicker) {
      loadChatSkills().catch(() => {
      });
    }
  }}>🔧 技能</button>
              ${showSkillPicker && skillList.length > 0 ? html4`
                <div class="popover" style="position:absolute;bottom:100%;left:0;width:320px;max-height:260px;overflow-y:auto;z-index:10">
                  <div class="popover-h">选择技能</div>
                  ${skillList.map((s22) => html4`
                    <div class="popover-row" onMouseDown=${(e22) => {
    e22.preventDefault();
    appendSkillMention(s22.name);
  }}>
                      <span class="name">${s22.name}</span>
                      <span class="meta">${(s22.description || "").slice(0, 40)}</span>
                    </div>
                  `)}
                </div>
              ` : null}
              <button type="button" class="composer-chip" aria-expanded=${showWsPicker} onClick=${() => {
    const next = !showWsPicker;
    setShowWsPicker(next);
    setShowSkillPicker(false);
    if (next) void loadWorkspaceOptions();
  }}>💻 工作空间 ▼</button>
              ${showWsPicker ? html4`
                <div class="popover" style="position:absolute;bottom:100%;left:0;width:360px;max-height:320px;overflow-y:auto;z-index:10">
                  <div class="popover-h">${t4("chat.workspacePicker")}</div>
                  ${workspaceSelection?.current ? html4`
                    <div class="popover-row" style="cursor:default">
                      <span class="name">✓ ${t4("chat.workspaceCurrent")}</span>
                      <span class="meta" title=${workspaceSelection.current}>${workspaceSelection.current}</span>
                    </div>
                  ` : null}
                  ${workspaceSelection?.pending ? html4`
                    <div class="popover-row" style="cursor:default">
                      <span class="name">○ ${t4("chat.workspacePending")}</span>
                      <span class="meta" title=${workspaceSelection.configured}>${workspaceSelection.configured}</span>
                    </div>
                  ` : null}
                  <div class="popover-row" onMouseDown=${(e3) => {
    e3.preventDefault();
    void pickWorkspace("visionox-workspace");
  }}><span class="name">⌂ ${t4("chat.workspaceDefault")}</span></div>
                  ${recentWss.filter((path) => path !== workspaceSelection?.current && path !== workspaceSelection?.configured).map((path) => html4`
                    <div class="popover-row" style="display:grid;grid-template-columns:minmax(0,1fr) 24px;align-items:center" onMouseDown=${(e4) => {
    e4.preventDefault();
    void pickWorkspace(path);
  }}>
                      <span style="min-width:0"><span class="name">▣ ${path.split(/[\\/]/).filter(Boolean).pop() || path}</span><span class="meta" title=${path}>${path}</span></span>
                      <button type="button" class="ghost" title=${t4("chat.workspaceRemove")} aria-label=${t4("chat.workspaceRemove")} onMouseDown=${(event) => {
    event.preventDefault();
    event.stopPropagation();
    void removeWorkspaceOption(path);
  }} style="width:24px;height:24px;padding:0">×</button>
                    </div>
                  `)}
                  <div class="popover-row" onMouseDown=${(e5) => {
    e5.preventDefault();
    void browseWorkspace();
  }}><span class="name">▤ ${t4("chat.workspaceBrowse")}</span></div>
                </div>
              ` : null}
              <button type="button" class="composer-chip" aria-expanded=${showModelPicker} onClick=${() => {
    cancelModelGroupClose();
    setShowModelPicker(!showModelPicker);
    setOpenModelGroupId(null);
    setShowSkillPicker(false);
    setShowWsPicker(false);
  }}>🤖 模型 ▼</button>
              ${showModelPicker ? html4`
                <div class="popover model-popover" style="position:absolute;bottom:100%;left:0;z-index:10" onMouseLeave=${scheduleModelGroupClose}>
                  <div class="popover-h">选择模型</div>
                  <div class="model-picker-browser">
                    <div class="model-cascade-menu" role="menu" aria-label="模型服务商">
                      ${providerDisplayGroups(providers ?? []).map((group) => {
    const open = openModelGroupId === group.id;
    const active = group.providers.some((provider) => provider.id === activeProviderId);
    const models = group.providers.flatMap((provider) => (provider.models ?? []).filter((model) => model.disabled !== true).map((model) => ({ provider, model })));
    return html4`
                          <div class=${`model-cascade-provider ${open ? "open" : ""}`} onMouseEnter=${() => openModelGroup(group.id)} onMouseLeave=${scheduleModelGroupClose}>
                            <button type="button" class=${`model-provider-trigger ${active ? "active" : ""}`} aria-haspopup="menu" aria-expanded=${open} onFocus=${() => openModelGroup(group.id)} onClick=${() => {
      cancelModelGroupClose();
      setOpenModelGroupId(open ? null : group.id);
    }}>
                              <span>${group.label}</span>
                              <span class="model-provider-indicators"><span aria-hidden="true">${active ? "✓" : ""}</span><span class="model-menu-chevron" aria-hidden="true">›</span></span>
                            </button>
                            ${open ? html4`
                              <div class="model-cascade-submenu" role="menu" aria-label=${`${group.label} 模型`} onMouseEnter=${cancelModelGroupClose} onMouseLeave=${scheduleModelGroupClose}>
                                ${models.length > 0 ? models.map(({ provider, model }) => {
      const selected = provider.id === activeProviderId && model.id === overviewModel;
      const status = model.testStatus || "untested";
      const details = providerModelCapabilityLabels(model).join(" · ");
      const statusText = status === "passed" ? "已验证" : status === "failed" ? model.testError || "不可用" : "未检测";
      return html4`
                                    <button type="button" class=${`model-cascade-model ${selected ? "active" : ""} ${status}`} role="menuitemradio" aria-checked=${selected} disabled=${busy || status === "failed"} title=${`${details}${details ? " · " : ""}${statusText}`} onClick=${() => selectProviderModel(provider.id, model.id)}>
                                      <span>${model.name ?? providerDisplayLabel(provider)}</span><span class="model-row-indicators"><span class=${`model-row-status ${status}`}>${status === "passed" ? "可用" : status === "failed" ? "不可用" : "未检测"}</span><span class="model-current-check" aria-hidden="true">${selected ? "✓" : ""}</span></span>
                                    </button>
                                  `;
    }) : html4`<div class="model-picker-empty">该服务商暂无可用模型</div>`}
                              </div>
                            ` : null}
                          </div>
                        `;
  })}
                      ${providerDisplayGroups(providers ?? []).length === 0 ? html4`<div class="model-picker-empty">尚未导入模型</div>` : null}
                    </div>
                    <div class="model-menu-actions">
                      <input type="file" id="provider-import-file" accept=".json,application/json" style="display:none" onChange=${loadProviderImportFile} />
                      <button type="button" class="model-import-link" disabled=${busy || providerImporting || providerTesting || providerCleaning} onClick=${() => {
    const input = document.getElementById("provider-import-file");
    input.value = "";
    input.click();
  }}>${providerImporting ? "导入中..." : "导入模型配置"}</button>
                      <button type="button" class="model-test-link" disabled=${busy || providerImporting || providerTesting || providerCleaning || providerModelTestSummary(providers ?? []).total === 0} onClick=${testAllProviders}>${providerTesting ? "检测中..." : "检测全部模型"}</button>
                      ${providerModelTestSummary(providers ?? []).failed > 0 && modelVerification?.dirty !== true ? html4`<button type="button" class="model-cleanup-link" disabled=${busy || providerImporting || providerTesting || providerCleaning} onClick=${cleanupFailedModels}>${providerCleaning ? "删除中..." : `删除检测失败模型（${providerModelTestSummary(providers ?? []).failed}）`}</button>` : null}
                    </div>
                    <div role="status" aria-live="polite" style="min-height:18px;margin-top:5px;font-size:11px;line-height:18px;overflow-wrap:anywhere;color:${modelNotice?.kind === "error" ? "var(--c-err)" : modelNotice?.kind === "success" ? "var(--c-ok)" : "var(--fg-3)"};">${modelNotice?.text ?? ""}</div>
                    ${(() => {
    if (modelVerification?.dirty) {
      return html4`<div style="font-size:11px;margin-top:6px;color:var(--c-warn);">配置已更新，请重新检测全部模型</div>`;
    }
    const allModels = (providers ?? []).flatMap((provider) => (provider.models ?? []).filter((model) => model.disabled !== true).map((model) => ({ provider, model })));
    const testedModels = allModels.filter(({ model }) => model.testStatus !== "untested");
    if (testedModels.length === 0) return null;
    const passed = allModels.filter(({ model }) => model.testStatus === "passed").length;
    const failedModels = allModels.filter(({ model }) => model.testStatus === "failed");
    return html4`
                        <div title=${failedModels.map(({ provider, model }) => `${provider.name ?? provider.id} / ${model.name ?? model.id}: ${model.testError ?? "检测失败"}`).join("\n")} style="display:flex;align-items:center;gap:5px;font-size:11px;margin-top:5px;color:var(--fg-3)">
                          <span>已通过 ${passed}/${allModels.length}</span>
                        </div>
                      `;
  })()}
                  </div>
                  <div style="padding:8px;border-bottom:1px solid var(--border-default);">
                    <label style="display:block;font-size:11px;color:var(--text-secondary);margin-bottom:4px;">模式</label>
                    ${(providerCaps?.presets?.length ?? 0) > 1 ? html4`
                      <div class="model-choice-row">
                        ${providerCaps.presets.map((p3) => html4`<button type="button" key=${p3} class=${`model-choice ${preset === p3 ? "active" : ""}`} onClick=${() => {
    setSetting("preset", p3);
  }}>${p3}</button>`)}
                      </div>
                    ` : html4`<div style="font-size:12px;color:var(--text-primary);">${preset}（固定）</div>`}
                  </div>
                  ${activeModelEfforts.length > 0 ? html4`
                    <div style="padding:8px;border-bottom:1px solid var(--border-default);">
                      <label style="display:block;font-size:11px;color:var(--text-secondary);margin-bottom:4px;">思考强度</label>
                      ${activeModelEfforts.length > 1 ? html4`
                        <div class="model-choice-row">
                          ${activeModelEfforts.map((e3) => html4`<button type="button" key=${e3} title=${e3} disabled=${busy} class=${`model-choice ${effort === e3 ? "active" : ""}`} onClick=${() => {
    setSetting("reasoningEffort", e3);
  }}>${reasoningEffortLabel(e3)}</button>`)}
                        </div>
                      ` : html4`<div style="font-size:12px;color:var(--text-primary);">${reasoningEffortLabel(activeModelEfforts[0])}（固定）</div>`}
                    </div>
                  ` : null}
                </div>
              ` : null}
              <button type="button" title=${`运行中 ${backgroundJobs.filter((job) => job.running).length}，待处理 ${backgroundJobs.filter(backgroundJobNeedsAttention).length}`} class=${`composer-chip ${backgroundJobs.some((job) => job.running || backgroundJobNeedsAttention(job)) ? "has-activity" : ""}`} aria-expanded=${showBackgroundJobs} onClick=${() => showBackgroundJobs ? closeBackgroundWorkbench() : void openBackgroundWorkbench()}>${t4("chat.backgroundJobs", { count: backgroundJobs.filter((job) => job.running || backgroundJobNeedsAttention(job)).length })}</button>
              <label class="composer-chip composer-index">
                <span class="composer-index-label" title="索引用于从当前工作区和知识库中查找相关内容，帮助模型参考本地资料。">索引</span>
                <select title=${globalThis.VisionoxIndexModePolicy.hint(indexRetrievalMode)} value=${indexRetrievalMode} disabled=${busy} onChange=${changeIndexRetrievalMode}>
                  <option value="auto" title="每次发送消息前自动搜索索引，并把相关内容加入上下文。" disabled=${semanticIndex === false}>自动召回</option>
                  <option value="tool" title="不主动搜索，仅在模型判断有必要时调用索引工具。" disabled=${semanticIndex === false}>按需搜索</option>
                  <option value="off" title="完全关闭本地索引，不自动召回，也不提供索引工具。">不使用</option>
                </select>
              </label>
              ${indexRetrievalMode === "auto" && semanticRetrievalStatus === "running" ? html4`<span class="composer-retrieval-status muted">召回中...</span>` : null}
              ${indexRetrievalMode === "auto" && semanticRetrievalStatus === "empty" ? html4`<span class="composer-retrieval-status muted">未找到相关内容</span>` : null}
              ${indexRetrievalMode === "auto" && semanticRetrievalStatus === "timeout" ? html4`<span class="composer-retrieval-status" style="color:var(--c-warn)">召回超时</span>` : null}
              ${indexRetrievalMode === "auto" && semanticRetrievalStatus === "unavailable" ? html4`<span class="composer-retrieval-status" style="color:var(--c-warn)">索引不可用</span>` : null}
              ${indexRetrievalMode === "auto" && semanticRetrievalStatus === "error" ? html4`<span class="composer-retrieval-status" style="color:var(--c-err)">召回失败</span>` : null}
              ${semanticRetrievalSources.length > 0 ? html4`
                <button class="btn btn-sm" style="font-size:11px;padding:2px 7px" onClick=${() => setShowRetrievalSources(!showRetrievalSources)}>参考 ${semanticRetrievalSources.length}</button>
                ${showRetrievalSources ? html4`
                  <div class="popover" style="position:absolute;bottom:100%;right:0;width:420px;max-height:260px;overflow-y:auto;z-index:10">
                    <div class="popover-h">本轮索引来源</div>
                    ${semanticRetrievalSources.map((source) => html4`
                      <button class="popover-row" style="width:100%;text-align:left" onMouseDown=${(event) => {
    event.preventDefault();
    void previewRetrievedSource(source);
  }}>
                        <span class="name" style="overflow-wrap:anywhere">${source.path}</span>
                        <span class="meta">L${source.startLine}-${source.endLine} · ${Number(source.score || 0).toFixed(3)}</span>
                      </button>
                    `)}
                  </div>
                ` : null}
              ` : null}
              ${showSkillPicker || showWsPicker || showModelPicker || showRetrievalSources ? html4`<div style="position:fixed;inset:0;z-index:5" onClick=${() => {
    setShowSkillPicker(false);
    setShowWsPicker(false);
    setShowModelPicker(false);
    setShowRetrievalSources(false);
  }}></div>` : null}
              <div style="flex:1"></div>
              ${canUploadMedia ? html4`<button
                type="button"
                class="image-upload-btn"
                onClick=${function() {
    if (fileInputRef.current) fileInputRef.current.click();
  }}
                title=${canUploadVideos ? "添加图片或视频" : "添加图片"}
                aria-label=${canUploadVideos ? "添加图片或视频" : "添加图片"}
              >📎</button>` : null}
              <button
                type="button"
                class="composer-chip prompt-optimize-chip"
                disabled=${!inputHasContent || promptOptimizing}
                onClick=${optimizeCurrentPrompt}
                title="优化当前输入，不会自动发送"
                aria-label="优化当前提示词"
              >${promptOptimizing ? "优化中…" : "优化提示词"}</button>
            </div>
            </div>
            <div class="chat-input-actions">
              <button
                class="primary"
                onClick=${send}
                disabled=${!inputHasContent && pendingImages.length === 0}
              >${busy ? t4("chat.queueSend") : t4("chat.send")}</button>
              <button class="chat-secondary-action" onClick=${clearScrollback} title=${t4("chat.clearTitle")}>${t4("chat.clear")}</button>
              <button class="chat-secondary-action" onClick=${newConversation} title=${t4("chat.newTitle")}>${t4("chat.new")}</button>
            </div>
              </div>
            </div>
          </div>

          ${busy ? html4`<${InFlightRow}
                  streaming=${streaming}
                  activeTool=${activeTool}
                  startedAt=${turnStartedAt}
                  statusLine=${statusLine}
                  onAbort=${abort}
                  stopping=${operation?.state === "stopping"}
                  tick=${nowTick}
                />` : null}
          <${ChatStatusBar} stats=${stats} model=${overviewModel} />
        </div>
        ${!showBackgroundJobs && (activePlan || fileArtifacts.length && !fileArtifactsDismissed) ? html4`<${SideRail} activePlan=${activePlan} fileArtifacts=${fileArtifactsDismissed ? [] : fileArtifacts} artifactsSelected=${Boolean(fileArtifactsSelectedMessageId)} onFollowLatestArtifacts=${followLatestArtifacts} onDismissArtifacts=${dismissArtifacts} />` : null}
      </div>
    </div>
  `;
}
var ChatFeed = N23(function ChatFeed2({ messages, totalMessages = messages.length, streaming, reasoningExpanded = false, innerRef, visibleCount = CHAT_INITIAL_RENDER_COUNT, onLoadEarlier, loadingEarlier = false, searchMatchIndex = -1, highlightMessageId = null, onCopyMessage, onFillInput, selectedArtifactMessageId = null, onSelectArtifactMessage, userAvatar = null }) {
  useLang();
  const allMessages = streaming ? [
    ...messages,
    {
      id: streaming.id,
      role: "assistant",
      text: streaming.text,
      reasoning: streaming.reasoning
    }
  ] : messages;
  const hiddenCount = Math.max(0, allMessages.length - visibleCount);
  const remoteHiddenCount = Math.max(0, totalMessages - messages.length);
  const renderedMessages = hiddenCount > 0 ? allMessages.slice(hiddenCount) : allMessages;
  const displayTotal = Math.max(totalMessages, allMessages.length);
  return html4`
    <div class="chat-feed" ref=${innerRef}>
      ${allMessages.length === 0 ? html4`<div class="chat-empty">${t4("chat.noConversation")}</div>` : null}
      ${hiddenCount > 0 || remoteHiddenCount > 0 ? html4`
        <div class="chat-history-loader">
          <span>已显示 ${renderedMessages.length} / 共 ${displayTotal} 条</span>
          <button type="button" onClick=${onLoadEarlier} disabled=${loadingEarlier}>${loadingEarlier ? "加载中..." : t4("chat.loadEarlierMessages", { count: Math.min(hiddenCount || remoteHiddenCount, hiddenCount ? CHAT_RENDER_STEP : CHAT_MESSAGE_PAGE_SIZE) })}</button>
        </div>
      ` : null}
      ${renderedMessages.map(
    (m3, i3) => html4`
                <${ChatMessage}
                  key=${m3.id}
                  msg=${m3}
                  index=${i3 + hiddenCount}
                  searchMatch=${i3 + hiddenCount === searchMatchIndex || Boolean(highlightMessageId && m3.id === highlightMessageId)}
                  streaming=${Boolean(streaming && streaming.id === m3.id)}
                  onCopy=${onCopyMessage}
                  onFillInput=${onFillInput}
                  reasoningExpanded=${reasoningExpanded}
                  userAvatar=${userAvatar}
                  selectedForArtifacts=${Boolean(selectedArtifactMessageId && String(m3.id || "") === String(selectedArtifactMessageId))}
                  onSelectForArtifacts=${onSelectArtifactMessage}
                />
              `
  )}
    </div>
  `;
});
var SideRail = N23(function SideRail2({ activePlan, fileArtifacts, artifactsSelected, onFollowLatestArtifacts, onDismissArtifacts }) {
  useLang();
  if (!activePlan && (!fileArtifacts || fileArtifacts.length === 0)) return null;
  return html4`
    <aside class="chat-rail">
      ${fileArtifacts && fileArtifacts.length > 0 ? html4`<${FileArtifactsCard} files=${fileArtifacts} selected=${artifactsSelected} onFollowLatest=${onFollowLatestArtifacts} onDismiss=${onDismissArtifacts} />` : null}
      ${activePlan ? html4`<${ActivePlanCard} plan=${activePlan} />` : null}
    </aside>
  `;
});
function ActivePlanCard({ plan }) {
  useLang();
  const steps = plan.steps ?? [];
  const completedIds = new Set(plan.completedStepIds ?? []);
  const title = plan.summary ?? plan.title ?? steps[0]?.title ?? t4("plans.noTitle");
  const dots = [];
  for (let i3 = 0; i3 < plan.totalSteps; i3++) {
    const done = steps[i3]?.id ? completedIds.has(steps[i3].id) : i3 < plan.completedSteps;
    const active = i3 === plan.completedSteps;
    dots.push(
      html4`<div class=${`step-dot ${done ? "done" : active ? "active" : ""}`}>${i3 + 1}</div>`
    );
    if (i3 < plan.totalSteps - 1) {
      dots.push(html4`<div class=${`step-line ${done ? "done" : active ? "active" : ""}`}></div>`);
    }
  }
  return html4`
    <div class="rail-card">
      <div class="rh">${t4("chat.railActivePlan")} ${statusPill(plan)}</div>
      <div class="steps" style="margin-bottom:8px">${dots}</div>
      <div class="rail-kv"><span class="k" style="font-family:var(--font-sans);color:var(--fg-1);font-size:12.5px">${title}</span></div>
      <div class="rail-kv"><span class="k">${t4("chat.railProgress")}</span><span class="v">${plan.completedSteps} / ${plan.totalSteps}</span></div>
      ${steps.length > 0 ? html4`
        <div class="active-plan-steps">
          ${steps.slice(0, 6).map((step, i3) => {
    const done = completedIds.has(step.id);
    const active = !done && i3 === plan.completedSteps;
    return html4`<div class=${`active-plan-step ${done ? "done" : active ? "active" : ""}`}>
              <span class="idx">${i3 + 1}</span>
              <span class="txt">${step.title}</span>
            </div>`;
  })}
        </div>
      ` : null}
    </div>
  `;
}
function summarizeActiveTool(activeTool) {
  if (!activeTool) return null;
  const name = activeTool.toolName ?? "tool";
  const args = parseToolArgs(activeTool.args);
  const path = args?.path ?? args?.file_path ?? args?.filename;
  if (name === "write_file" && path) {
    const len = typeof args?.content === "string" ? args.content.length : null;
    return `${name} → ${path}${len != null ? ` (${len.toLocaleString()} ch)` : ""}`;
  }
  if ((name === "edit_file" || name.endsWith("_edit_file")) && path) {
    return `${name} → ${path}`;
  }
  if ((name === "run_command" || name === "run_background") && typeof args?.command === "string") {
    const c3 = args.command;
    return `${name} → $ ${c3.length > 80 ? `${c3.slice(0, 80)}…` : c3}`;
  }
  if ((name === "read_file" || name === "list_files" || name === "search_files") && path) {
    return `${name} → ${path}`;
  }
  if (path) return `${name} → ${path}`;
  return name;
}
function InFlightRow({
  streaming,
  activeTool,
  startedAt,
  statusLine,
  onAbort,
  stopping,
  tick: _tick
}) {
  useLang();
  const elapsedMs = startedAt ? Date.now() - startedAt : 0;
  const elapsed = (elapsedMs / 1e3).toFixed(1);
  const reasoningLen = streaming?.reasoning?.length ?? 0;
  const textLen = streaming?.text?.length ?? 0;
  const toolSummary = summarizeActiveTool(activeTool);
  const phase = toolSummary ? t4("chat.inflightRunning") : reasoningLen > 0 && textLen === 0 ? t4("chat.inflightThinking") : textLen > 0 ? t4("chat.inflightStreaming") : t4("chat.inflightWaiting");
  return html4`
    <div class="chat-inflight">
      <span class="spinner"></span>
      <span class="chat-inflight-phase">${phase}</span>
      <span class="chat-inflight-sep">·</span>
      <span class="muted">${elapsed}s</span>
      ${toolSummary ? html4`
            <span class="chat-inflight-sep">·</span>
            <span class="chat-inflight-tool" title=${toolSummary}>${toolSummary}</span>
          ` : null}
      ${!toolSummary && (textLen > 0 || reasoningLen > 0) ? html4`
            <span class="chat-inflight-sep">·</span>
            <span class="muted">
              ${reasoningLen > 0 ? html4`${t4("chat.inflightReasoning", { count: reasoningLen.toLocaleString() })}` : null}
              ${reasoningLen > 0 && textLen > 0 ? html4`<span> · </span>` : null}
              ${textLen > 0 ? html4`${t4("chat.inflightOut", { count: textLen.toLocaleString() })}` : null}
            </span>
          ` : null}
      ${statusLine ? html4`
            <span class="chat-inflight-sep">·</span>
            <span class="muted">${statusLine}</span>
          ` : null}
      <button class="chat-inflight-abort" onClick=${onAbort} disabled=${stopping}>${stopping ? t4("chat.stoppingBtn") : t4("chat.abortBtn")}</button>
    </div>
  `;
}
function TodoBar({ todos, expanded, onToggle }) {
  const total = todos.length;
  if (total === 0) return null;
  const done = todos.filter((t5) => t5.status === "completed").length;
  const inProgress = todos.filter((t5) => t5.status === "in_progress").length;
  const pct = total > 0 ? Math.round(done / total * 100) : 0;
  const current = todos.find((t5) => t5.status === "in_progress");
  const allDone = done === total;
  return html4`
    <div class="todo-bar">
      <div class="todo-bar-header" onClick=${onToggle}>
        <span class="todo-bar-icon">${allDone ? "✅" : "📋"}</span>
        <span class="todo-bar-count">${allDone ? "全部完成" : `${done}/${total} 完成`}</span>
        <div class="todo-bar-progress">
          <div class="todo-bar-progress-fill" style=${`width: ${pct}%;`}></div>
        </div>
        ${current && !allDone ? html4`<span class="todo-bar-current">${current.activeForm || current.content}</span>` : null}
        <span class="todo-bar-toggle">${expanded ? "▴" : "▾"}</span>
      </div>
      ${expanded ? html4`
        <div class="todo-bar-list">
          ${todos.map((t5) => html4`
            <div class=${`todo-item todo-item-${t5.status}`}>
              <span class="todo-item-mark">${t5.status === "completed" ? "[x]" : t5.status === "in_progress" ? "[>]" : "[ ]"}</span>
              <span class="todo-item-text">${t5.status === "in_progress" ? t5.activeForm || t5.content : t5.content}</span>
            </div>
          `)}
        </div>
      ` : null}
    </div>
  `;
}
var ChatStatusBar = N23(function ChatStatusBar2({ stats, model }) {
  useLang();
  if (!stats) {
    return html4`
      <div class="chat-statusbar">
        <span class="muted">${t4("chat.waitingStats")}</span>
      </div>
    `;
  }
  const currentContextTokens = stats.estimatedContextTokens ?? stats.lastPromptTokens;
  const ctxPct = stats.contextCapTokens > 0 ? currentContextTokens / stats.contextCapTokens * 100 : 0;
  const contextMarks = [
    { tokens: stats.contextFoldTokens, label: "普通压缩" },
    { tokens: stats.contextAggressiveTokens, label: "激进压缩" },
    { tokens: stats.contextForceSummaryTokens, label: "强制总结" }
  ].filter((mark) => Number.isFinite(mark.tokens) && mark.tokens > 0 && stats.contextCapTokens > 0).map((mark) => ({ ...mark, pct: Math.min(100, mark.tokens / stats.contextCapTokens * 100) }));
  const balance = primaryBalance(stats);
  return html4`
    <div class="chat-statusbar">
      <span class="status-item">
        <span class="status-label">${t4("chat.statusModel")}</span>
        <code>${model ?? "—"}</code>
      </span>
      <span class="status-item">
        <span class="status-label">${t4("chat.statusCtx")}</span>
        <span class="status-bar-mini">
          <span class="status-bar-mini-fill" style=${`width: ${Math.min(100, ctxPct).toFixed(1)}%;`}></span>
          ${contextMarks.map((mark) => html4`<span class="fold-mark" style=${`left:${mark.pct.toFixed(2)}%`} title=${`${mark.label} ${(mark.tokens / 1e3).toFixed(0)}K`}></span>`)}
        </span>
        <span class="muted">${currentContextTokens.toLocaleString()} / ${(stats.contextCapTokens / 1e3).toFixed(0)}K</span>
      </span>
      <span class="status-item">
        <span class="status-label">${t4("chat.statusCache")}</span>
        <span class=${stats.cacheHitRatio >= 0.9 ? "status-ok" : stats.cacheHitRatio >= 0.6 ? "status-warn" : "status-err"}>
          ${(stats.cacheHitRatio * 100).toFixed(1)}%
        </span>
      </span>
      <span class="status-item">
        <span class="status-label">${t4("chat.statusTurn")}</span>
        <code>${fmtCost(stats.lastTurnCostUsd, balance?.currency)}</code>
      </span>
      <span class="status-item">
        <span class="status-label">${t4("chat.statusSession")}</span>
        <code>${fmtCost(stats.totalCostUsd, balance?.currency)}</code>
        <span class="muted" style="font-size: 10px;">
          ${t4("chat.statusTurns", { count: stats.turns, s: stats.turns === 1 ? "" : "s" })}
        </span>
      </span>
      ${balance ? html4`
          <span class="status-item">
            <span class="status-label">${t4("chat.statusBalance")}</span>
            <code>${balance.total_balance ?? balance.total} ${balance.currency}</code>
          </span>
        ` : null}
    </div>
  `;
});

// dashboard/src/panels/hooks.ts
function buildMatrix(data) {
  const rows = /* @__PURE__ */ new Map();
  for (const scope of ["project", "global"]) {
    const hooks = data[scope].hooks ?? {};
    for (const [event, handlers] of Object.entries(hooks)) {
      for (const h3 of handlers ?? []) {
        const cmd = h3.command ?? "(no command)";
        const key = `${scope}::${cmd}`;
        let row = rows.get(key);
        if (!row) {
          row = { scope, command: cmd, cells: {} };
          rows.set(key, row);
        }
        row.cells[event] = { on: true, matcher: h3.matcher };
      }
    }
  }
  return [...rows.values()];
}
function HooksPanel() {
  useLang();
  const [data, setData] = d2(null);
  const [error, setError] = d2(null);
  const [drafts, setDrafts] = d2({});
  const [busy, setBusy] = d2(false);
  const [info, setInfo] = d2(null);
  const [eventFilter, setEventFilter] = d2("all");
  const load = q2(async () => {
    try {
      const r3 = await api("/hooks");
      setData(r3);
      setDrafts({
        project: JSON.stringify(r3.project.hooks ?? {}, null, 2),
        global: JSON.stringify(r3.global.hooks ?? {}, null, 2)
      });
    } catch (err) {
      setError(err.message);
    }
  }, []);
  y2(() => {
    load();
  }, [load]);
  const saveScope = q2(
    async (scope) => {
      setBusy(true);
      setError(null);
      let parsed;
      try {
        parsed = JSON.parse(drafts[scope] ?? "{}");
      } catch (err) {
        setError(`${scope} JSON: ${err.message}`);
        setBusy(false);
        return;
      }
      try {
        await api("/hooks/save", { method: "POST", body: { scope, hooks: parsed } });
        await api("/hooks/reload", { method: "POST", body: {} });
        setInfo(t4("hooks.savedReloaded", { scope }));
        setTimeout(() => setInfo(null), 3e3);
        await load();
      } catch (err) {
        setError(err.message);
      } finally {
        setBusy(false);
      }
    },
    [drafts, load]
  );
  if (!data && !error)
    return html4`<div class="card" style="color:var(--fg-3)">${t4("hooks.loading")}</div>`;
  if (error && !data) return html4`<div class="card accent-err">${error}</div>`;
  if (!data) return null;
  const sectionH3 = (text, sub) => html4`
    <h3 style="margin:18px 0 8px;font-family:var(--font-mono);font-size:11px;color:var(--fg-3);text-transform:uppercase;letter-spacing:.1em">
      ${text}${sub ? html4`<span style="margin-left:10px;color:var(--fg-4);font-weight:400;text-transform:none;letter-spacing:0">${sub}</span>` : null}
    </h3>
  `;
  const matrixRows = buildMatrix(data);
  const events = data.events.length > 0 ? data.events : Array.from(new Set(matrixRows.flatMap((r3) => Object.keys(r3.cells))));
  const visibleRows = eventFilter === "all" ? matrixRows : matrixRows.filter((r3) => r3.cells[eventFilter]?.on);
  const gridCols = `220px repeat(${Math.max(events.length, 1)}, minmax(0, 1fr))`;
  return html4`
    <div style="display:flex;flex-direction:column;gap:6px">
      <div class="chips">
        <span
          class=${`chip-f ${eventFilter === "all" ? "active" : ""}`}
          onClick=${() => setEventFilter("all")}
        >${t4("hooks.resolved")} <span class="ct">${data.resolved.length}</span></span>
        ${data.events.map(
    (ev) => html4`<span
            class=${`chip-f ${eventFilter === ev ? "active" : ""}`}
            onClick=${() => setEventFilter(ev)}
          >${ev}</span>`
  )}
      </div>
      ${info ? html4`<div><span class="pill ok">${info}</span></div>` : null}
      ${error ? html4`<div class="card accent-err">${error}</div>` : null}

      ${sectionH3(t4("hooks.eventMatrix"), t4("hooks.matrixSub", { scripts: matrixRows.length, s: matrixRows.length === 1 ? "" : "s", events: events.length }))}${visibleRows.length === 0 ? html4`<div class="card" style="color:var(--fg-3)">
              ${t4("hooks.noHooks")}
            </div>` : html4`
            <div class="card" style="padding:10px 14px;overflow-x:auto">
              <div class="matrix" style=${`min-width:fit-content`}>
                <div class="row h" style=${`grid-template-columns:${gridCols}`}>
                  <div>${t4("hooks.colScript")}</div>
                  ${events.map((ev) => html4`<div>${ev}</div>`)}
                </div>
                ${visibleRows.map(
    (r3) => html4`
                    <div class="row" style=${`grid-template-columns:${gridCols}`}>
                      <div class="cell" title=${r3.command}>
                        <span style="color:var(--fg-4);font-size:10px;margin-right:6px">${r3.scope}</span>
                        <code class="mono" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r3.command}</code>
                      </div>
                      ${events.map((ev) => {
      const c3 = r3.cells[ev];
      if (!c3?.on) return html4`<div class="cell off">—</div>`;
      return html4`
                          <div class="cell on" title=${c3.matcher ?? ""}>
                            ${c3.matcher ? html4`<span style="font-size:10px;color:var(--c-warn)">${c3.matcher}</span>` : "✓"}
                          </div>
                        `;
    })}
                    </div>
                  `
  )}
              </div>
            </div>
          `}

      ${["project", "global"].map((scope) => {
    const meta = data[scope];
    return html4`
          ${sectionH3(scope, meta.path ?? "(no path)")}
          ${scope === "project" && !meta.path ? html4`<div class="card" style="color:var(--fg-3)">
                  ${t4("hooks.noProject")}
                </div>` : html4`
                <div class="card">
                  <textarea
                    style="width:100%;height:240px;background:var(--bg-input);color:var(--fg-0);border:1px solid var(--bd);border-radius:var(--r);padding:10px;font-family:var(--font-mono);font-size:12.5px;line-height:1.55;resize:vertical"
                    value=${drafts[scope] ?? ""}
                    onInput=${(e3) => setDrafts({ ...drafts, [scope]: e3.target.value })}
                    disabled=${busy}
                  ></textarea>
                  <div style="display:flex;gap:6px;margin-top:8px">
                    <button class="btn primary" disabled=${busy} onClick=${() => saveScope(scope)}>
                      ${t4("hooks.saveReload")}
                    </button>
                    <button class="btn ghost" disabled=${busy} onClick=${load}>${t4("hooks.discard")}</button>
                  </div>
                </div>
              `}
        `;
  })}

      ${sectionH3(t4("hooks.recentRuns"), `${data.recentRuns?.length ?? 0}`)}
      ${!data.recentRuns || data.recentRuns.length === 0 ? html4`<div class="card" style="color:var(--fg-3)">
              ${t4("hooks.noRuns")}
            </div>` : html4`
            <div class="card" style="padding:0;overflow-x:auto">
              <table class="tbl" style="width:100%;font-family:var(--font-mono);font-size:11.5px">
                <thead>
                  <tr>
                    <th style="text-align:left;padding:8px 12px">${t4("hooks.colWhen")}</th>
                    <th style="text-align:left;padding:8px 12px">${t4("hooks.colPhase")}</th>
                    <th style="text-align:left;padding:8px 12px">${t4("hooks.colHook")}</th>
                    <th style="text-align:left;padding:8px 12px">${t4("hooks.colOutcome")}</th>
                  </tr>
                </thead>
                <tbody>
                  ${data.recentRuns.map(
    (r3) => html4`
                      <tr>
                        <td style="padding:6px 12px;color:var(--fg-3)">${fmtRelativeTime(r3.whenMs)}</td>
                        <td style="padding:6px 12px;color:var(--fg-1)">${r3.phase}</td>
                        <td style="padding:6px 12px;color:var(--fg-1)">${r3.hookName}</td>
                        <td style="padding:6px 12px">
                          <span class=${`pill ${r3.outcome === "ok" ? "ok" : r3.outcome === "error" ? "err" : "warn"}`}>${r3.outcome}</span>
                        </td>
                      </tr>
                    `
  )}
                </tbody>
              </table>
            </div>
          `}
    </div>
  `;
}

// dashboard/src/panels/mcp.ts
function specForEntry(e3) {
  if (!e3.install) return null;
  const localName = e3.name.split("/").pop() ?? e3.name;
  const safe = localName.replace(/[^a-zA-Z0-9_-]/g, "-").replace(/^-+|-+$/g, "") || "mcp";
  const trail = e3.install.extraArgs?.length ? ` ${e3.install.extraArgs.join(" ")}` : "";
  if (e3.install.runtime === "remote" && e3.install.url) {
    if (e3.install.transport === "streamable-http") return `${safe}=streamable+${e3.install.url}`;
    return `${safe}=${e3.install.url}`;
  }
  if (e3.install.runtime === "npm" && e3.install.packageId) {
    const pinned = e3.install.version ? `${e3.install.packageId}@${e3.install.version}` : e3.install.packageId;
    return `${safe}=npx -y ${pinned}${trail}`;
  }
  if (e3.install.runtime === "pypi" && e3.install.packageId) {
    return `${safe}=uvx ${e3.install.packageId}${trail}`;
  }
  return null;
}
function specLabel(spec) {
  const eq = spec.indexOf("=");
  return eq > 0 ? spec.slice(0, eq) : spec;
}
function specCommand(spec) {
  const eq = spec.indexOf("=");
  return eq > 0 ? spec.slice(eq + 1) : spec;
}
function McpPanel() {
  useLang();
  const [data, setData] = d2(null);
  const [specs, setSpecs] = d2(null);
  const [error, setError] = d2(null);
  const [info, setInfo] = d2(null);
  const [newSpec, setNewSpec] = d2("");
  const [busy, setBusy] = d2(false);
  const [open, setOpen] = d2(null);
  const [openUnbridged, setOpenUnbridged] = d2(null);
  const [filter, setFilter] = d2("all");
  const [registry, setRegistry] = d2(null);
  const [registryQuery, setRegistryQuery] = d2("");
  const [registryLoading, setRegistryLoading] = d2(false);
  const [openRegistry, setOpenRegistry] = d2(null);
  const [displayLimit, setDisplayLimit] = d2(50);
  const loadRegistry = q2(async (q4, pages, limit) => {
    setRegistryLoading(true);
    try {
      const params = new URLSearchParams();
      if (q4.trim()) params.set("q", q4.trim());
      params.set("pages", String(pages));
      params.set("maxPages", String(Math.max(20, pages)));
      params.set("limit", String(limit));
      const r3 = await api(`/mcp/registry?${params.toString()}`);
      setRegistry(r3);
    } catch (err) {
      setError(err.message);
    } finally {
      setRegistryLoading(false);
    }
  }, []);
  y2(() => {
    if (filter !== "marketplace") return;
    if (registry) return;
    void loadRegistry("", 1, displayLimit);
  }, [filter, registry, loadRegistry, displayLimit]);
  y2(() => {
    if (filter !== "marketplace") return;
    setDisplayLimit(50);
    const handle = setTimeout(() => void loadRegistry(registryQuery, 1, 50), 300);
    return () => clearTimeout(handle);
  }, [registryQuery, filter, loadRegistry]);
  const installFromRegistry = q2(async (entry) => {
    setBusy(true);
    try {
      const r3 = await api("/mcp/registry/install", { method: "POST", body: { name: entry.name } });
      if (r3.alreadyPresent) {
        setInfo(t4("mcp.marketplaceAlready"));
      } else if (r3.bridged) {
        setInfo(t4("mcp.marketplaceInstalledBridged", { spec: r3.spec }));
      } else {
        setInfo(t4("mcp.marketplaceInstalled", { spec: r3.spec }));
      }
      setTimeout(() => setInfo(null), 5e3);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, []);
  const load = q2(async () => {
    try {
      setData(await api("/mcp"));
      setSpecs((await api("/mcp/specs")).specs);
    } catch (err) {
      setError(err.message);
    }
  }, []);
  y2(() => {
    load();
  }, [load]);
  const addSpec = q2(async () => {
    if (!newSpec.trim()) return;
    setBusy(true);
    try {
      const r3 = await api("/mcp/specs", {
        method: "POST",
        body: { spec: newSpec.trim() }
      });
      setInfo(r3.requiresRestart ? t4("mcp.savedRestart") : t4("mcp.saved"));
      setTimeout(() => setInfo(null), 4e3);
      setNewSpec("");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [newSpec, load]);
  const removeSpec = q2(
    async (spec) => {
      if (!confirm(t4("mcp.removeConfirm", { spec }))) return;
      setBusy(true);
      try {
        await api("/mcp/specs", { method: "DELETE", body: { spec } });
        setInfo(t4("mcp.removed"));
        setTimeout(() => setInfo(null), 4e3);
        await load();
      } catch (err) {
        setError(err.message);
      } finally {
        setBusy(false);
      }
    },
    [load]
  );
  if (!data && !error)
    return html4`<div class="card" style="color:var(--fg-3)">${t4("mcp.loading")}</div>`;
  if (error && !data) return html4`<div class="card accent-err">${error}</div>`;
  if (!data) return null;
  const liveCount = data.servers.length;
  const unbridgedSpecs = (specs ?? []).filter((spec) => !data.servers.some((s3) => s3.spec === spec));
  const unbridgedCount = unbridgedSpecs.length;
  const showLive = filter === "all" || filter === "live";
  const showUnbridged = filter === "all" || filter === "unbridged";
  const showMarketplace = filter === "marketplace";
  return html4`
    <div class="sessions-grid">
      <div class="sessions-list">
        <div class="ssl-h" style="font-family:var(--font-mono);font-size:11px;color:var(--fg-3);text-transform:uppercase;letter-spacing:.1em">
          ${t4("mcp.servers", { count: liveCount })}
        </div>
        <div style="padding:8px 12px 4px">
          <div class="chips">
            <span class=${`chip-f ${filter === "all" ? "active" : ""}`} onClick=${() => setFilter("all")}>${t4("mcp.all")} <span class="ct">${liveCount + unbridgedCount}</span></span>
            <span class=${`chip-f ${filter === "live" ? "active" : ""}`} onClick=${() => setFilter("live")}>${t4("mcp.live")} <span class="ct">${liveCount}</span></span>
            <span class=${`chip-f ${filter === "unbridged" ? "active" : ""}`} onClick=${() => setFilter("unbridged")}>${t4("mcp.unbridged")} <span class="ct">${unbridgedCount}</span></span>
            <span class=${`chip-f ${filter === "marketplace" ? "active" : ""}`} onClick=${() => setFilter("marketplace")}>${t4("mcp.marketplace")}</span>
          </div>
        </div>
        ${showMarketplace ? html4`
              <div style="padding:8px 12px;display:flex;gap:6px">
                <input
                  type="text"
                  placeholder=${t4("mcp.marketplaceSearch")}
                  value=${registryQuery}
                  onInput=${(e3) => setRegistryQuery(e3.target.value)}
                  style="flex:1;font-size:11px"
                />
              </div>
              ${registry ? html4`<div style="padding:0 12px 6px;font-size:11px;color:var(--fg-3)">
                      ${t4("mcp.marketplaceCount", {
    loaded: registry.loaded,
    matched: registry.matched,
    source: registry.source,
    cached: registry.fromCache ? t4("mcp.marketplaceCachedSuffix") : ""
  })}
                    </div>` : null}
            ` : html4`
              <div style="padding:8px 12px;display:flex;gap:6px">
                <input
                  type="text"
                  placeholder=${t4("mcp.specPlaceholder")}
                  value=${newSpec}
                  onInput=${(e3) => setNewSpec(e3.target.value)}
                  style="flex:1;font-size:11px"
                />
                <button class="btn primary" disabled=${busy || !newSpec.trim()} onClick=${addSpec}>+</button>
              </div>
            `}
        ${info ? html4`<div style="padding:0 12px 8px"><span class="pill ok">${info}</span></div>` : null}
        ${error ? html4`<div class="card accent-err" style="margin:0 12px 8px">${error}</div>` : null}

        <div class="ssl-rows">
          ${!showMarketplace && liveCount === 0 && unbridgedCount === 0 ? html4`<div style="color:var(--fg-3);padding:14px;font-size:12px">
                ${t4("mcp.noServers")}
              </div>` : null}
          ${showMarketplace ? renderMarketplaceRows({
    registry,
    registryLoading,
    openRegistry,
    setOpenRegistry: (e3) => {
      setOpenRegistry(e3);
      setOpen(null);
      setOpenUnbridged(null);
    },
    loadMore: () => {
      const nextLimit = displayLimit + 50;
      setDisplayLimit(nextLimit);
      const pagesNeeded = Math.ceil(nextLimit / 30) + 3;
      void loadRegistry(registryQuery, pagesNeeded, nextLimit);
    },
    installedSpecs: new Set(specs ?? [])
  }) : null}
          ${showLive ? data.servers.map(
    (s3) => html4`
                  <div
                    class=${`ssl-row ${open?.label === s3.label ? "sel" : ""}`}
                    onClick=${() => {
      setOpen(s3);
      setOpenUnbridged(null);
    }}
                  >
                    <span class="name">${s3.label} <span class="pill ok">${t4("mcp.live")}</span></span>
                    <span class="preview">${specCommand(s3.spec)}</span>
                    <span class="meta"><span><span class="v">${fmtNum(s3.toolCount)}</span> ${t4("mcp.tools")}</span></span>
                  </div>
                `
  ) : null}
          ${showUnbridged ? unbridgedSpecs.map(
    (spec) => html4`
                  <div
                    class=${`ssl-row ${openUnbridged === spec ? "sel" : ""}`}
                    onClick=${() => {
      setOpenUnbridged(spec);
      setOpen(null);
    }}
                  >
                    <span class="name">${specLabel(spec)} <span class="pill">${t4("mcp.unbridged")}</span></span>
                    <span class="preview">${specCommand(spec)}</span>
                    <span class="meta"><span class="dim">${t4("mcp.inConfig")}</span></span>
                  </div>
                `
  ) : null}
        </div>
      </div>

      <div class="sessions-detail">
        ${openRegistry != null ? renderRegistryDetail({
    entry: openRegistry,
    busy,
    installedSpec: (() => {
      const spec = specForEntry(openRegistry);
      return spec && (specs ?? []).includes(spec) ? spec : null;
    })(),
    onInstall: () => installFromRegistry(openRegistry),
    onUninstall: (spec) => removeSpec(spec),
    onClose: () => setOpenRegistry(null)
  }) : openUnbridged != null ? html4`
              <div class="sessions-detail-h">
                <span class="name">${specLabel(openUnbridged)}</span>
                <span class="ws"><span class="pill">${t4("mcp.unbridgedTitle")}</span></span>
                <span class="actions">
                  <button class="btn" disabled=${busy} onClick=${() => removeSpec(openUnbridged)}
                    style="border-color:var(--c-err);color:var(--c-err)">${t4("mcp.removeBtn")}</button>
                  <button class="btn ghost" onClick=${() => setOpenUnbridged(null)}>${t4("common.back")}</button>
                </span>
              </div>
              <div class="card" style="margin-bottom:12px">
                <div class="card-h"><span class="title">${t4("mcp.spec")}</span></div>
                <code class="mono" style="font-size:11.5px;color:var(--fg-2);word-break:break-all">${openUnbridged}</code>
              </div>
              <div class="card accent-warn">
                <div class="card-h"><span class="title" style="color:var(--c-warn)">${t4("mcp.whyUnbridged")}</span></div>
                <div class="card-b" style="font-size:13px;line-height:1.6">
                  ${t4("mcp.whyUnbridgedDesc")}
                  <div style="margin-top:10px;color:var(--fg-3);font-size:12px">
                    ${t4("mcp.whyUnbridgedHint")}
                  </div>
                </div>
              </div>
            ` : open == null ? html4`<div style="color:var(--fg-3);font-size:13px;text-align:center;padding:60px 20px">
                ${showMarketplace ? t4("mcp.marketplacePickHint") : t4("mcp.pickHint")}
              </div>` : html4`
                <div class="sessions-detail-h">
                  <span class="name">${open.label}</span>
                  <span class="ws">${open.serverInfo?.name ?? "—"} ${open.serverInfo?.version ? `v${open.serverInfo.version}` : ""} · ${open.protocolVersion ?? "—"}</span>
                  <span class="actions">
                    <button class="btn ghost" onClick=${() => setOpen(null)}>${t4("common.back")}</button>
                  </span>
                </div>

                <div class="card" style="margin-bottom:12px">
                  <div class="card-h"><span class="title">${t4("mcp.spec")}</span></div>
                  <code class="mono" style="font-size:11.5px;color:var(--fg-2)">${open.spec}</code>
                </div>

                ${open.instructions ? html4`<div class="card accent-brand" style="margin-bottom:12px">
                        <div class="card-b">${open.instructions}</div>
                      </div>` : null}

                <h3 style="margin:18px 0 6px;font-family:var(--font-mono);font-size:11px;color:var(--fg-3);text-transform:uppercase;letter-spacing:.1em">
                  ${t4("mcp.toolsTitle", { count: open.tools.length })}
                </h3>
                <div class="card" style="padding:0;overflow:hidden">
                  <table class="tbl">
                    <thead><tr><th>${t4("mcp.colName")}</th><th>${t4("mcp.colDesc")}</th></tr></thead>
                    <tbody>
                      ${open.tools.map(
    (tool) => html4`<tr><td><code class="mono">${tool.name}</code></td><td class="dim">${tool.description ?? ""}</td></tr>`
  )}
                    </tbody>
                  </table>
                </div>

                ${open.resources.length > 0 ? html4`
                      <h3 style="margin:18px 0 6px;font-family:var(--font-mono);font-size:11px;color:var(--fg-3);text-transform:uppercase;letter-spacing:.1em">
                        ${t4("mcp.resourcesTitle", { count: open.resources.length })}
                      </h3>
                      <div class="card" style="padding:0;overflow:hidden">
                        <table class="tbl">
                          <thead><tr><th>${t4("mcp.colName")}</th><th>${t4("mcp.colUri")}</th></tr></thead>
                          <tbody>
                            ${open.resources.map(
    (r3) => html4`<tr><td>${r3.name}</td><td class="path">${r3.uri}</td></tr>`
  )}
                          </tbody>
                        </table>
                      </div>
                    ` : null}

                ${open.prompts.length > 0 ? html4`
                      <h3 style="margin:18px 0 6px;font-family:var(--font-mono);font-size:11px;color:var(--fg-3);text-transform:uppercase;letter-spacing:.1em">
                        ${t4("mcp.promptsTitle", { count: open.prompts.length })}
                      </h3>
                      <div class="card" style="padding:0;overflow:hidden">
                        <table class="tbl">
                          <thead><tr><th>${t4("mcp.colName")}</th><th>${t4("mcp.colDesc")}</th></tr></thead>
                          <tbody>
                            ${open.prompts.map(
    (p3) => html4`<tr><td><code class="mono">${p3.name}</code></td><td class="dim">${p3.description ?? ""}</td></tr>`
  )}
                          </tbody>
                        </table>
                      </div>
                    ` : null}
              `}
      </div>
    </div>
  `;
}
function renderLoadMoreFooter({
  registry,
  registryLoading,
  loadMore
}) {
  if (!registry) return null;
  const shown = registry.entries.length;
  const total = registry.matched;
  const moreCached = total > shown;
  const moreOnNetwork = registry.hasMore;
  const canDoSomething = moreCached || moreOnNetwork;
  if (canDoSomething) {
    const label = registryLoading ? t4("mcp.marketplaceLoading") : t4("mcp.marketplaceMoreLabel", {
      shown,
      total: moreOnNetwork ? `${total}+` : `${total}`
    });
    return html4`<div style="padding:10px 12px;display:flex;align-items:center;gap:10px">
      <button class="btn primary" disabled=${registryLoading} onClick=${loadMore}>${label}</button>
      <span style="font-size:11px;color:var(--fg-3)">
        ${moreOnNetwork ? t4("mcp.marketplaceMoreHint") : t4("mcp.marketplaceMoreCachedHint")}
      </span>
    </div>`;
  }
  return html4`<div style="padding:12px;background:var(--bg-elev-2,rgba(36,143,242,0.07));border-top:1px solid var(--bd);display:flex;align-items:center;gap:8px;font-size:12px;color:var(--fg-2)">
    <span style="color:var(--c-ok)">✓</span>
    <span>${t4("mcp.marketplaceExhaustedFull", { total })}</span>
  </div>`;
}
function renderMarketplaceRows({
  registry,
  registryLoading,
  openRegistry,
  setOpenRegistry,
  loadMore,
  installedSpecs
}) {
  if (!registry && registryLoading) {
    return html4`<div style="color:var(--fg-3);padding:14px;font-size:12px">${t4("mcp.marketplaceLoading")}</div>`;
  }
  if (!registry || registry.entries.length === 0) {
    return html4`<div style="color:var(--fg-3);padding:14px;font-size:12px">${t4("mcp.marketplaceNoMatches")}</div>`;
  }
  return html4`
    ${registry.entries.map((e3) => {
    const sel = openRegistry?.name === e3.name;
    const tag2 = t4("mcp.marketplaceSourceTag", { source: e3.source });
    const spec = specForEntry(e3);
    const installed = spec !== null && installedSpecs.has(spec);
    const pop = e3.popularity !== void 0 ? html4` <span class="dim">· ${fmtNum(e3.popularity)}</span>` : null;
    const icon = e3.iconUrl ? html4`<img src=${e3.iconUrl} alt="" style="width:16px;height:16px;border-radius:3px;margin-right:6px;vertical-align:middle;object-fit:cover" loading="lazy" referrerpolicy="no-referrer" onError=${(ev) => ev.target.style.display = "none"} />` : null;
    return html4`
        <div class=${`ssl-row ${sel ? "sel" : ""}`} onClick=${() => setOpenRegistry(e3)}>
          <span class="name">${icon}${e3.name} <span class="pill">${tag2}</span>${installed ? html4` <span class="pill ok">${t4("mcp.marketplaceInstalledBadge")}</span>` : null}</span>
          <span class="preview">${e3.description}</span>
          <span class="meta">${pop}</span>
        </div>
      `;
  })}
    ${renderLoadMoreFooter({ registry, registryLoading, loadMore })}
  `;
}
function renderRegistryDetail({
  entry,
  busy,
  installedSpec,
  onInstall,
  onUninstall,
  onClose
}) {
  const installable = !!entry.install || entry.source === "smithery";
  const installed = installedSpec !== null;
  const specPreview = entry.install ? `${entry.install.runtime} · ${entry.install.transport}${entry.install.packageId ? ` · ${entry.install.packageId}` : entry.install.url ? ` · ${entry.install.url}` : ""}${entry.install.version ? `@${entry.install.version}` : ""}` : "";
  const icon = entry.iconUrl ? html4`<img src=${entry.iconUrl} alt="" style="width:24px;height:24px;border-radius:4px;margin-right:8px;vertical-align:middle;object-fit:cover" loading="lazy" referrerpolicy="no-referrer" onError=${(ev) => ev.target.style.display = "none"} />` : null;
  return html4`
    <div class="sessions-detail-h">
      <span class="name">${icon}${entry.name}${installed ? html4` <span class="pill ok">${t4("mcp.marketplaceInstalledBadge")}</span>` : null}</span>
      <span class="ws">${t4("mcp.marketplaceSourceTag", { source: entry.source })}${entry.popularity !== void 0 ? ` · ${fmtNum(entry.popularity)} uses` : ""}${entry.homepage ? html4` · <a href=${entry.homepage} target="_blank" rel="noopener noreferrer">homepage</a>` : ""}</span>
      <span class="actions">
        ${installed ? html4`<button
                class="btn"
                disabled=${busy}
                onClick=${() => onUninstall(installedSpec)}
                style="border-color:var(--c-err);color:var(--c-err)"
              >${t4("mcp.marketplaceUninstall")}</button>` : html4`<button class="btn primary" disabled=${busy || !installable} onClick=${onInstall}>${t4("mcp.marketplaceInstall")}</button>`}
        <button class="btn ghost" onClick=${onClose}>${t4("common.back")}</button>
      </span>
    </div>

    <div class="card" style="margin-bottom:12px">
      <div class="card-b" style="font-size:13px;line-height:1.6">${entry.description || "—"}</div>
    </div>

    ${entry.install ? html4`<div class="card" style="margin-bottom:12px">
            <div class="card-h"><span class="title">${t4("mcp.spec")}</span></div>
            <div class="card-b">
              <code class="mono" style="font-size:11.5px;color:var(--fg-2);word-break:break-all;display:block">${specPreview}</code>
              ${installedSpec ? html4`<div style="margin-top:8px;font-size:11px;color:var(--fg-3)">
                      <span class="dim">on disk:</span> <code class="mono">${installedSpec}</code>
                    </div>` : null}
            </div>
          </div>` : entry.source === "smithery" ? html4`<div class="card" style="margin-bottom:12px">
              <div class="card-b" style="font-size:13px;line-height:1.6;color:var(--fg-3)">
                ${t4("mcp.marketplaceFetchOnInstall")}
              </div>
            </div>` : null}

    ${entry.install?.requiredEnv?.length ? html4`<div class="card accent-brand" style="margin-bottom:12px">
            <div class="card-h"><span class="title">${t4("mcp.marketplaceEnvTitle")}</span></div>
            <div class="card-b" style="font-size:13px">
              ${entry.install.requiredEnv.map(
    (name) => html4`<div><code class="mono" style="color:var(--c-warn)">${name}</code></div>`
  )}
              <div style="margin-top:6px;color:var(--fg-3);font-size:12px">
                ${t4("mcp.marketplaceEnvHint")}
              </div>
            </div>
          </div>` : null}

    ${installed ? html4`<div class="card accent-warn">
            <div class="card-b" style="font-size:12.5px;line-height:1.6">
              ${t4("mcp.marketplaceRestartHint")}
            </div>
          </div>` : null}
  `;
}

// dashboard/src/panels/memory.ts
var N24 = N2;
function soulSectionValue(markdown, heading2) {
  const escaped = heading2.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return String(markdown ?? "").match(new RegExp(`^## ${escaped}\\s*\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, "m"))?.[1]?.trim() ?? "";
}
function updateSoulSection(markdown, heading2, value) {
  const source = String(markdown ?? "").trim();
  const escaped = heading2.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const block2 = `## ${heading2}
${String(value ?? "").trim()}`;
  const re = new RegExp(`^## ${escaped}\\s*\\n[\\s\\S]*?(?=^## |(?![\\s\\S]))`, "m");
  return re.test(source) ? source.replace(re, `${block2}

`).trim() : `${source}

${block2}`.trim();
}
function MemoryPanel() {
  useLang();
  const [tree, setTree] = d2(null);
  const [error, setError] = d2(null);
  const [open, setOpen] = d2(null);
  const [draft, setDraft] = d2(null);
  const [baseline, setBaseline] = d2("");
  const [busy, setBusy] = d2(false);
  const [info, setInfo] = d2(null);
  const [scopeFilter, setScopeFilter] = d2("all");
  const [query, setQuery] = d2("");
  const [createOpen, setCreateOpen] = d2(false);
  const [newScope, setNewScope] = d2("global");
  const [newMode, setNewMode] = d2("general");
  const [modeFilter, setModeFilter] = d2("all");
  const [selectedModeKeys, setSelectedModeKeys] = d2([]);
  const [soulEditorMode, setSoulEditorMode] = d2("basic");
  const [soulPreview, setSoulPreview] = d2(null);
  const [newDesc, setNewDesc] = d2("");
  const [newBody, setNewBody] = d2("");
  const [newPriority, setNewPriority] = d2("medium");
  const load = q2(async () => {
    try {
      setTree(await api("/memory"));
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, []);
  y2(() => {
    load();
  }, [load]);
  const dirty = draft != null && JSON.stringify(draft) !== baseline;
  const acceptNavigation = () => !dirty || globalThis.confirm("当前修改尚未保存，确定放弃吗？");
  const showInfo = (message) => {
    setInfo(message);
    setTimeout(() => setInfo(null), 3e3);
  };
  const selectItem = q2(async (item) => {
    if (!acceptNavigation()) return;
    setBusy(true);
    setError(null);
    try {
      let next;
      if (item.kind === "persistent") {
        const result = await api(`/memory/${item.apiScope}/${encodeURIComponent(item.name)}`);
        next = { ...item, ...result.entry, content: result.entry?.body ?? "", revision: result.revision };
      } else if (item.kind === "mode") {
        next = { ...item, content: item.text, keywordsText: (item.keywords ?? []).join(", "), targetMode: item.modeId };
      } else if (item.kind === "soul") {
        const result = await api("/memory/soul");
        next = { ...item, content: result.body ?? "", aiName: result.name ?? "", path: result.path, revision: result.revision, history: result.history ?? [], maxChars: result.maxChars ?? 16e3 };
        setSoulPreview(null);
      } else if (item.kind === "trash") {
        next = { ...item, content: item.kindType === "mode" ? item.item?.text ?? "" : item.raw ?? "" };
      } else {
        next = { ...item, content: item.body ?? "" };
      }
      const serialized = JSON.stringify(next);
      setOpen(item);
      setDraft(next);
      setBaseline(serialized);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [dirty, baseline]);
  const save = q2(async () => {
    if (!open || !draft || open.kind === "session" || open.kind === "trash") return;
    setBusy(true);
    setError(null);
    try {
      let savedDraft = draft;
      let moved = false;
      if (open.kind === "soul") {
        await api("/memory/soul", { method: "POST", body: { body: draft.content, aiName: draft.aiName, expectedRevision: draft.revision } });
        const result = await api("/memory/soul");
        savedDraft = { ...draft, content: result.body ?? "", aiName: result.name ?? "", path: result.path, revision: result.revision, history: result.history ?? [], maxChars: result.maxChars ?? 16e3 };
        setDraft(savedDraft);
        setSoulPreview(null);
      } else if (open.kind === "persistent") {
        const body = [
          "---",
          `name: ${open.name}`,
          `description: ${String(draft.description ?? "").replace(/\r?\n/g, " ")}`,
          `type: ${draft.type ?? "user"}`,
          `scope: ${open.apiScope === "global" ? "global" : "project"}`,
          `created: ${draft.createdAt || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}`,
          `priority: ${draft.priority ?? "medium"}`,
          "---",
          "",
          String(draft.content ?? "").trim(),
          ""
        ].join("\n");
        const result = await api(`/memory/${open.apiScope}/${encodeURIComponent(open.name)}`, { method: "POST", body: { body, overwrite: true, expectedRevision: draft.revision } });
        savedDraft = { ...draft, revision: result.revision };
        setDraft(savedDraft);
      } else {
        const keywords = String(draft.keywordsText ?? "").split(/[,\s，]+/).map((value) => value.trim()).filter(Boolean).slice(0, 8);
        const payload = { text: draft.content, keywords, priority: Number(draft.priority), enabled: draft.enabled !== false };
        if (draft.targetMode && draft.targetMode !== open.modeId) {
          await api(`/mode-memory/${encodeURIComponent(open.name)}/move`, { method: "POST", body: { mode: open.modeId, targetMode: draft.targetMode, copy: false } });
          moved = true;
          setOpen(null);
          setDraft(null);
          setBaseline("");
        } else {
          await api(`/mode-memory/${encodeURIComponent(open.name)}`, { method: "PATCH", body: { ...payload, mode: open.modeId } });
        }
      }
      if (!moved) setBaseline(JSON.stringify(savedDraft));
      showInfo(moved ? "场景记忆已移动" : "记忆已保存");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [open, draft, load]);
  const createMemory = q2(async () => {
    const desc = newDesc.trim();
    const content = newBody.trim();
    if (newScope === "mode") {
      if (!content) return;
      setBusy(true);
      setError(null);
      try {
        const priority = newPriority === "high" ? 90 : newPriority === "low" ? 10 : 50;
        await api("/mode-memory", { method: "POST", body: { mode: newMode, text: content, priority, keywords: [] } });
        setNewBody("");
        setNewPriority("medium");
        setCreateOpen(false);
        showInfo("工作场景记忆已新增");
        await load();
      } catch (err) {
        setError(err.message);
      } finally {
        setBusy(false);
      }
      return;
    }
    if (!desc || !content) return;
    const name = `memory-${Date.now().toString(36)}`;
    const scope = newScope === "project-mem" ? "project-mem" : "global";
    const memoryBody = [
      "---",
      `name: ${name}`,
      `description: ${desc.replace(/\r?\n/g, " ")}`,
      "type: user",
      `scope: ${scope === "project-mem" ? "project" : "global"}`,
      `created: ${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}`,
      `priority: ${newPriority}`,
      "---",
      "",
      content,
      ""
    ].join("\n");
    setBusy(true);
    setError(null);
    try {
      await api(`/memory/${scope}/${encodeURIComponent(name)}`, { method: "POST", body: { body: memoryBody } });
      setNewDesc("");
      setNewBody("");
      setNewPriority("medium");
      setCreateOpen(false);
      showInfo("长期记忆已新增");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [newScope, newMode, newDesc, newBody, newPriority, load]);
  const remove = q2(async () => {
    if (!open || !draft) return;
    const label = draft.description || draft.text || draft.name;
    const prompt2 = open.kind === "persistent" || open.kind === "mode" ? `将“${label}”移入回收站？${tree?.trash?.retentionDays ?? 30} 天内可以恢复。` : `确定删除“${label}”吗？此操作不可撤销。`;
    if (!globalThis.confirm(prompt2)) return;
    setBusy(true);
    setError(null);
    try {
      const path = open.kind === "persistent" ? `/memory/${open.apiScope}/${encodeURIComponent(open.name)}` : open.kind === "mode" ? `/mode-memory/${encodeURIComponent(open.name)}` : `/memory/session/${encodeURIComponent(open.name)}`;
      await api(path, { method: "DELETE", body: open.kind === "mode" ? { mode: open.modeId } : void 0 });
      setOpen(null);
      setDraft(null);
      setBaseline("");
      showInfo("记忆已删除");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [open, draft, load]);
  const copyModeMemory = q2(async () => {
    if (!open || open.kind !== "mode" || !draft?.targetMode) return;
    if (draft.targetMode === open.modeId) {
      setError("请选择其他工作场景后再复制");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api(`/mode-memory/${encodeURIComponent(open.name)}/move`, { method: "POST", body: { mode: open.modeId, targetMode: draft.targetMode, copy: true } });
      showInfo("场景记忆已复制");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [open, draft, load]);
  const batchModeMemories = q2(async (action) => {
    if (!tree || selectedModeKeys.length === 0) return;
    if (action === "delete" && !globalThis.confirm(`确定删除选中的 ${selectedModeKeys.length} 条场景记忆吗？`)) return;
    const selected = new Set(selectedModeKeys);
    const items = (tree.modeMemory?.modes ?? []).flatMap((mode) => (mode.items ?? []).map((item) => ({ ...item, modeId: mode.id }))).filter((item) => selected.has(`${item.modeId}:${item.id}`));
    setBusy(true);
    setError(null);
    try {
      await api("/mode-memory/batch", { method: "POST", body: { action, items: items.map((item) => ({ mode: item.modeId, id: item.id })) } });
      setSelectedModeKeys([]);
      showInfo(action === "delete" ? "已批量删除" : action === "enable" ? "已批量启用" : "已批量停用");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [tree, selectedModeKeys, load]);
  const applyMemoryNow = q2(async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await api("/memory/apply", { method: "POST", body: {} });
      if (result.applied === false) throw new Error(result.error || "无法应用记忆");
      showInfo("记忆已应用到当前对话");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [load]);
  const previewSoul = q2(async () => {
    if (!draft || open?.kind !== "soul") return;
    setBusy(true);
    setError(null);
    try {
      setSoulPreview(await api("/memory/soul/preview", { method: "POST", body: { body: draft.content, aiName: draft.aiName } }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [open, draft]);
  const restoreSoulVersion = q2(async (id) => {
    if (!globalThis.confirm("恢复此 Soul 版本？当前版本会先自动保存到历史。")) return;
    setBusy(true);
    try {
      await api(`/memory/soul/history/${encodeURIComponent(id)}/restore`, { method: "POST", body: {} });
      const result = await api("/memory/soul");
      const next = { ...draft, content: result.body ?? "", aiName: result.name ?? "", revision: result.revision, history: result.history ?? [] };
      setDraft(next);
      setBaseline(JSON.stringify(next));
      setSoulPreview(null);
      showInfo("Soul 版本已恢复");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [draft, load]);
  const resetSoul = q2(async () => {
    if (!globalThis.confirm("恢复默认 Soul？当前版本会先自动保存到历史。")) return;
    setBusy(true);
    try {
      await api("/memory/soul/reset", { method: "POST", body: {} });
      const result = await api("/memory/soul");
      const next = { ...draft, content: result.body ?? "", aiName: result.name ?? "", revision: result.revision, history: result.history ?? [] };
      setDraft(next);
      setBaseline(JSON.stringify(next));
      setSoulPreview(null);
      showInfo("已恢复默认 Soul");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [draft, load]);
  const restoreTrash = q2(async () => {
    if (!open || open.kind !== "trash") return;
    setBusy(true);
    setError(null);
    try {
      await api(`/memory/trash/${encodeURIComponent(open.name)}/restore`, { method: "POST", body: {} });
      setOpen(null);
      setDraft(null);
      setBaseline("");
      showInfo("记忆已从回收站恢复");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [open, load]);
  const permanentlyDeleteMemoryTrash = q2(async () => {
    if (!open || open.kind !== "trash") return;
    const label = draft?.description || draft?.name || open.name;
    if (!globalThis.confirm(`永久删除“${label}”？删除后无法恢复。`)) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/memory/trash/${encodeURIComponent(open.name)}`, { method: "DELETE", body: {} });
      setOpen(null);
      setDraft(null);
      setBaseline("");
      showInfo("记忆已永久删除");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [open, draft, load]);
  const emptyMemoryTrash = q2(async () => {
    const count = tree?.trash?.total ?? tree?.trash?.items?.length ?? 0;
    const invalidCount = tree?.trash?.invalidCount ?? 0;
    const invalidHint = invalidCount > 0 ? `，其中 ${invalidCount} 条文件已损坏、无法预览` : "";
    if (count === 0 || !globalThis.confirm(`清空回收站中的 ${count} 条记忆${invalidHint}？全部内容将永久删除且无法恢复。`)) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api("/memory/trash", { method: "DELETE", body: { confirm: true } });
      setOpen(null);
      setDraft(null);
      setBaseline("");
      showInfo(`已永久删除 ${result.deleted ?? count} 条记忆`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [tree, load]);
  if (!tree && !error)
    return html4`<div class="card" style="color:var(--fg-3)">${t4("memory.loading")}</div>`;
  if (error && !tree) return html4`<div class="card accent-err">${error}</div>`;
  if (!tree) return null;
  const persistentItems = [
    ...tree.global.files.map((item) => ({ ...item, kind: "persistent", apiScope: "global", scopeKey: "global" })),
    ...tree.projectMem.files.map((item) => ({ ...item, kind: "persistent", apiScope: "project-mem", scopeKey: "project" }))
  ];
  const modeItems = (tree.modeMemory?.modes ?? []).flatMap((mode) => (mode.items ?? []).map((item) => ({
    ...item,
    kind: "mode",
    name: item.id,
    modeId: mode.id,
    modeLabel: mode.label ?? mode.id,
    description: item.text,
    scopeKey: "mode"
  })));
  const sessionItems = (tree.session?.items ?? []).map((item) => ({ ...item, kind: "session", scopeKey: "session", description: item.description || item.body }));
  const trashItems = (tree.trash?.items ?? []).map((item) => ({ ...item, kindType: item.kind, kind: "trash", name: item.id, scopeKey: "trash", description: item.kind === "mode" ? item.item?.text ?? item.name : item.name }));
  const soulItems = scopeFilter === "soul" ? [{ kind: "soul", name: "soul", scopeKey: "soul", description: tree.soul?.name ? `AI 身份：${tree.soul.name}` : "AI 身份与行为准则" }] : [];
  const allItems = [...persistentItems, ...modeItems, ...sessionItems, ...soulItems, ...trashItems];
  const needle = query.trim().toLowerCase();
  const visibleItems = allItems.filter((item) => {
    if (scopeFilter !== "all" && item.scopeKey !== scopeFilter) return false;
    if (item.kind === "mode" && modeFilter !== "all" && item.modeId !== modeFilter) return false;
    if (!needle) return true;
    return [item.description, item.body, item.raw, item.item?.text, item.searchText, item.text, item.type, item.modeLabel, ...item.keywords ?? []].some((value) => String(value ?? "").toLowerCase().includes(needle));
  });
  const activeInjection = tree.runtime?.active ?? tree.injection;
  const scopeLabel = (item) => item.scopeKey === "global" ? "全局" : item.scopeKey === "project" ? "当前项目" : item.scopeKey === "mode" ? item.modeLabel : item.scopeKey === "soul" ? "AI 身份" : item.scopeKey === "trash" ? "回收站" : "当前会话";
  const injectionState = (item) => {
    if (item.kind === "trash") return "trash";
    if (item.kind === "persistent") return activeInjection?.persistent?.entries?.[`${item.scopeKey}:${item.name}`] ?? "omitted";
    if (item.kind === "mode") return activeInjection?.mode?.selectedIds?.includes(item.name) ? "index" : "omitted";
    if (item.kind === "session") return activeInjection?.session?.selectedNames?.includes(item.name) ? "index" : "omitted";
    return "manual";
  };
  const injectionLabel = (item) => {
    if (item.enabled === false) return "已停用";
    const state = injectionState(item);
    if (state === "high-full") return "全文注入";
    if (state === "index") return item.kind === "persistent" ? "摘要注入" : "将注入";
    if (state === "manual") return "身份配置";
    if (state === "trash") return "可恢复";
    return "未注入";
  };
  const diagnosticLabel = (item) => {
    if (item.kind !== "persistent") return "";
    const key = `${item.scopeKey}:${item.name}`;
    if (tree.diagnostics?.sensitiveKeys?.includes(key)) return "可能包含敏感信息";
    if (tree.diagnostics?.conflicts?.some((group) => group.includes(key))) return "可能冲突";
    if (tree.diagnostics?.duplicates?.some((group) => group.includes(key))) return "内容重复";
    return "";
  };
  return html4`
    <div class="memory-manager">
      <div class="memory-toolbar">
        <div>
          <div class="memory-page-title">记忆管理</div>
          <div class="memory-workspace">${tree.workspace ? `${tree.workspace.name} · ${tree.workspace.path}` : "未选择工作区"}</div>
        </div>
        <input class="memory-search" type="search" placeholder="搜索摘要、内容或关键词" value=${query} onInput=${(event) => setQuery(event.target.value)} />
      </div>
      <div class="memory-scope-tabs">
        ${[["all", "全部"], ["global", "全局"], ["project", "当前项目"], ["mode", "工作场景"], ["session", "当前会话"], ["soul", "AI 身份"], ["trash", "回收站"]].map(([value, label]) => html4`
          <button class=${scopeFilter === value ? "active" : ""} onClick=${() => setScopeFilter(value)}>${label}</button>
        `)}
      </div>
      ${scopeFilter === "mode" ? html4`<div class="memory-mode-tabs">
        <button class=${modeFilter === "all" ? "active" : ""} onClick=${() => setModeFilter("all")}>全部场景</button>
        ${(tree.modeMemory?.modes ?? []).map((mode) => html4`<button class=${modeFilter === mode.id ? "active" : ""} onClick=${() => setModeFilter(mode.id)}>${mode.label ?? mode.id} ${mode.enabledCount ?? 0}/${mode.count ?? 0}</button>`)}
      </div>` : null}
      ${tree.runtime?.pending ? html4`<div class="memory-runtime-pending"><div><strong>当前上下文仍在使用旧记忆</strong><span>磁盘修改已保存，执行应用后当前对话才会使用新版本。</span></div><button class="btn primary" disabled=${busy} onClick=${applyMemoryNow}>立即应用到当前对话</button></div>` : null}
      ${activeInjection ? html4`<div class="memory-budget-summary"><span>当前记忆上下文</span><strong>${Number(activeInjection.totalTokens ?? 0).toLocaleString()} tokens</strong><span>固定 ${Number(activeInjection.budget?.pinnedTokens ?? 0).toLocaleString()} · 可召回 ${Number(activeInjection.budget?.recallableTokens ?? 0).toLocaleString()} / ${Number(activeInjection.budget?.maxRecallableTokens ?? 0).toLocaleString()} · 高优先级全文与普通摘要已去重</span></div>` : null}
      ${info ? html4`<div class="memory-notice ok">${info}</div>` : null}
      ${error ? html4`<div class="memory-notice error">${error}</div>` : null}
      <div class="memory-layout">
        <div class="memory-list-pane">
          <div class="memory-list-head"><span>${visibleItems.length} 条${scopeFilter === "trash" ? ` · ${tree.trash?.retentionDays ?? 30} 天后自动清理${tree.trash?.invalidCount ? ` · ${tree.trash.invalidCount} 条损坏` : ""}` : ""}</span><div class="memory-list-actions">${scopeFilter !== "session" && scopeFilter !== "soul" && scopeFilter !== "trash" ? html4`<button type="button" class=${`btn btn-sm ${createOpen ? "primary" : ""}`} aria-expanded=${createOpen} onClick=${() => setCreateOpen((value) => !value)}>${createOpen ? "收起新增" : "新增记忆"}</button>` : null}${scopeFilter === "trash" && (tree.trash?.total ?? trashItems.length) > 0 ? html4`<button class="btn btn-sm danger" disabled=${busy} onClick=${emptyMemoryTrash}>清空回收站</button>` : null}<button class="btn btn-sm ghost" disabled=${busy} onClick=${load}>刷新</button></div></div>
          ${scopeFilter !== "session" && scopeFilter !== "soul" && scopeFilter !== "trash" && createOpen ? html4`<div class="memory-create-panel">
            <div class="memory-section-title">${newScope === "mode" ? "新增场景记忆" : "新增长期记忆"}</div>
            <div class="memory-create-row">
              <select value=${newScope} onChange=${(event) => setNewScope(event.target.value)} disabled=${busy}>
                <option value="global">全局</option>
                <option value="project-mem">当前项目</option>
                <option value="mode">工作场景</option>
              </select>
              <select value=${newPriority} onChange=${(event) => setNewPriority(event.target.value)} disabled=${busy}>
                <option value="low">低优先级</option><option value="medium">普通</option><option value="high">高优先级</option>
              </select>
            </div>
            ${newScope === "mode" ? html4`<select value=${newMode} onChange=${(event) => setNewMode(event.target.value)} disabled=${busy}>${(tree.modeMemory?.modes ?? []).map((mode) => html4`<option value=${mode.id}>${mode.label ?? mode.id} · ${mode.enabledCount ?? 0}/${mode.count ?? 0} 启用</option>`)}</select>` : html4`<input type="text" placeholder="一句话摘要" value=${newDesc} onInput=${(event) => setNewDesc(event.target.value)} disabled=${busy} />`}
            <textarea rows="3" maxlength=${newScope === "mode" ? 180 : null} placeholder=${newScope === "mode" ? "场景记忆内容，最多 180 字符" : "记忆内容"} value=${newBody} onInput=${(event) => setNewBody(event.target.value)} disabled=${busy}></textarea>
            <div class="memory-create-actions"><button class="btn primary" disabled=${busy || !newBody.trim() || newScope !== "mode" && !newDesc.trim()} onClick=${createMemory}>新增记忆</button><button type="button" class="btn ghost" disabled=${busy} onClick=${() => setCreateOpen(false)}>取消</button></div>
          </div>` : null}
          ${scopeFilter === "mode" && selectedModeKeys.length > 0 ? html4`<div class="memory-batch-bar"><span>已选 ${selectedModeKeys.length} 条</span><button class="btn" disabled=${busy} onClick=${() => batchModeMemories("enable")}>启用</button><button class="btn" disabled=${busy} onClick=${() => batchModeMemories("disable")}>停用</button><button class="btn danger" disabled=${busy} onClick=${() => batchModeMemories("delete")}>删除</button></div>` : null}
          <div class="memory-rows">
            ${visibleItems.map((item) => html4`
              <div class=${`memory-row ${open?.kind === item.kind && open?.name === item.name && open?.modeId === item.modeId ? "selected" : ""}`}>
                ${scopeFilter === "mode" && item.kind === "mode" ? html4`<input class="memory-row-check" type="checkbox" checked=${selectedModeKeys.includes(`${item.modeId}:${item.name}`)} onChange=${(event) => {
    const key = `${item.modeId}:${item.name}`;
    setSelectedModeKeys(event.target.checked ? [...selectedModeKeys, key] : selectedModeKeys.filter((value) => value !== key));
  }} />` : null}
                <button class="memory-row-open" onClick=${() => selectItem(item)}>
                  <span class="memory-row-main">${item.description || item.text || item.name}</span>
                  <span class="memory-row-meta">
                    <span>${scopeLabel(item)}</span>
                    <span>${item.kind === "trash" ? `清理于 ${item.expiresAt ? new Date(item.expiresAt).toLocaleDateString() : "未知"}` : item.kind === "mode" ? `优先级 ${item.priority ?? 50}` : item.kind === "session" ? "临时" : item.kind === "soul" ? "手动维护" : item.priority === "high" ? "高优先级" : item.priority === "low" ? "低优先级" : "普通"}</span>
                    <span class=${injectionState(item) === "omitted" || item.enabled === false ? "memory-disabled" : "memory-injected"}>${injectionLabel(item)}</span>
                    ${diagnosticLabel(item) ? html4`<span class="memory-diagnostic">${diagnosticLabel(item)}</span>` : null}
                  </span>
                </button>
              </div>
            `)}
            ${visibleItems.length === 0 ? html4`<div class="memory-empty">没有符合条件的记忆</div>` : null}
          </div>
          <div class="memory-rule-status">
            <span>当前项目规则</span>
            ${(tree.project?.files ?? []).length > 0 ? tree.project.files.map((file) => html4`<strong>${file.name} · ${fmtBytes(file.size)} · ${file.state === "full" ? "全文" : file.state === "truncated" ? `截断 ${Number(file.injectedChars ?? 0).toLocaleString()} 字符` : "因总预算省略"}</strong>`) : html4`<strong>未配置</strong>`}
            <span>${tree.project?.exists ? `实际注入 ${Number(tree.project.totalChars ?? 0).toLocaleString()} / ${Number(tree.project.maxChars ?? 0).toLocaleString()} 字符` : ""}</span>
          </div>
        </div>
        <div class="memory-detail-pane">
          ${!draft ? html4`<div class="memory-empty-detail">选择一条记忆查看详情</div>` : html4`
            <div class="memory-detail-head">
              <div><div class="memory-section-title">${scopeLabel(draft)}</div><div class="memory-detail-state">${dirty ? "有未保存修改" : "已同步"}</div></div>
              <div class="memory-detail-actions">
                ${open.kind === "trash" ? html4`<button class="btn primary" title=${draft.restoreHint ?? "恢复到原范围"} disabled=${busy || draft.canRestore === false} onClick=${restoreTrash}>恢复此记忆</button><button class="btn danger" disabled=${busy} onClick=${permanentlyDeleteMemoryTrash}>永久删除</button>` : open.kind !== "session" ? html4`<button class="btn primary" disabled=${busy || !dirty || !String(draft.content ?? "").trim()} onClick=${save}>保存</button>` : null}
                ${open.kind !== "soul" && open.kind !== "trash" ? html4`<button class="btn danger" disabled=${busy} onClick=${remove}>删除</button>` : null}
              </div>
            </div>
            ${diagnosticLabel(draft) ? html4`<div class="memory-detail-warning">${diagnosticLabel(draft)}。请核对后自行决定保留、修改或删除，系统不会自动合并。</div>` : null}
            ${open.kind === "persistent" ? html4`
              <label class="memory-field"><span>摘要</span><input value=${draft.description ?? ""} onInput=${(event) => setDraft({ ...draft, description: event.target.value })} /></label>
              <div class="memory-field-row">
                <label class="memory-field"><span>类型</span><select value=${draft.type ?? "user"} onChange=${(event) => setDraft({ ...draft, type: event.target.value })}><option value="user">用户偏好</option><option value="feedback">纠正反馈</option><option value="project">项目事实</option><option value="reference">参考信息</option></select></label>
                <label class="memory-field"><span>优先级</span><select value=${draft.priority ?? "medium"} onChange=${(event) => setDraft({ ...draft, priority: event.target.value })}><option value="low">低</option><option value="medium">普通</option><option value="high">高</option></select></label>
              </div>
            ` : open.kind === "mode" ? html4`
              <div class="memory-field-row">
                <label class="memory-field"><span>目标场景</span><select value=${draft.targetMode ?? open.modeId} onChange=${(event) => setDraft({ ...draft, targetMode: event.target.value })}>${(tree.modeMemory?.modes ?? []).map((mode) => html4`<option value=${mode.id}>${mode.label ?? mode.id}</option>`)}</select></label>
                <label class="memory-field"><span>优先级</span><input type="number" min="0" max="100" value=${draft.priority ?? 50} onInput=${(event) => setDraft({ ...draft, priority: Number(event.target.value) })} /></label>
              </div>
              <div class="memory-mode-actions"><span>${draft.targetMode !== open.modeId ? "保存后将移动到目标场景" : "选择其他场景可移动或复制"}</span><button class="btn" disabled=${busy || !draft.targetMode || draft.targetMode === open.modeId} onClick=${copyModeMemory}>复制到场景</button></div>
              <label class="memory-field"><span>关键词</span><input value=${draft.keywordsText ?? ""} onInput=${(event) => setDraft({ ...draft, keywordsText: event.target.value })} /></label>
              <label class="memory-toggle"><input type="checkbox" checked=${draft.enabled !== false} onChange=${(event) => setDraft({ ...draft, enabled: event.target.checked })} /><span>启用此场景记忆</span></label>
            ` : open.kind === "soul" ? html4`
              <div class="memory-editor-tabs"><button class=${soulEditorMode === "basic" ? "active" : ""} onClick=${() => setSoulEditorMode("basic")}>基础编辑</button><button class=${soulEditorMode === "advanced" ? "active" : ""} onClick=${() => setSoulEditorMode("advanced")}>高级原文</button></div>
              <label class="memory-field"><span>AI 名称</span><input maxlength="80" value=${draft.aiName ?? ""} onInput=${(event) => setDraft({ ...draft, aiName: event.target.value })} /></label>
              ${soulEditorMode === "basic" ? html4`
                <label class="memory-field"><span>身份与定位</span><textarea rows="5" value=${soulSectionValue(draft.content, "我是谁")} onInput=${(event) => setDraft({ ...draft, content: updateSoulSection(draft.content, "我是谁", event.target.value) })}></textarea></label>
                <label class="memory-field"><span>协作方式</span><textarea rows="7" value=${soulSectionValue(draft.content, "协作方式")} onInput=${(event) => setDraft({ ...draft, content: updateSoulSection(draft.content, "协作方式", event.target.value) })}></textarea></label>
                <label class="memory-field"><span>安全与隐私</span><textarea rows="6" value=${soulSectionValue(draft.content, "安全与隐私")} onInput=${(event) => setDraft({ ...draft, content: updateSoulSection(draft.content, "安全与隐私", event.target.value) })}></textarea></label>
              ` : html4`<label class="memory-field memory-content-field"><span>完整 Soul Markdown · ${String(draft.content ?? "").length} 字符</span><textarea rows="18" value=${draft.content ?? ""} onInput=${(event) => setDraft({ ...draft, content: event.target.value })}></textarea></label>`}
              <div class="memory-soul-actions"><button class="btn" disabled=${busy} onClick=${previewSoul}>预览最终注入</button><button class="btn" disabled=${busy} onClick=${resetSoul}>恢复默认 Soul</button></div>
              ${soulPreview ? html4`<div class=${`memory-soul-preview ${soulPreview.valid ? "" : "invalid"}`}><div><strong>最终注入预览</strong><span>${soulPreview.chars}/${soulPreview.maxChars} 字符</span></div><pre>${soulPreview.finalBody}</pre></div>` : null}
              <div class="memory-soul-note"><strong>Soul 不提供删除</strong><span>保存后在下一次 /new 或上下文重建时生效。</span></div>
              ${(draft.history ?? []).length > 0 ? html4`<div class="memory-soul-history"><strong>版本历史</strong>${draft.history.map((item) => html4`<div><span>${new Date(item.savedAt).toLocaleString()} · ${item.name || "未命名"} · ${fmtBytes(item.size)}</span><button class="btn ghost" disabled=${busy} onClick=${() => restoreSoulVersion(item.id)}>恢复此版本</button></div>`)}</div>` : null}
            ` : open.kind === "trash" ? html4`<div class=${`memory-session-note ${draft.canRestore === false ? "memory-trash-blocked" : ""}`}>删除于 ${new Date(draft.deletedAt).toLocaleString()}，${draft.expiresAt ? `${new Date(draft.expiresAt).toLocaleString()} 后自动永久清理。` : `保留 ${tree.trash?.retentionDays ?? 30} 天。`}${draft.canRestore === false ? draft.projectId ? " 这是其他项目的记忆，请打开原项目后恢复；仍可在此预览或永久删除。" : " 旧记录未保存原项目信息，无法安全自动恢复；可预览内容后重新创建。" : " 恢复后将回到原范围。"}</div>` : html4`<div class="memory-session-note">仅在当前对话中生效，恢复该对话时会一并恢复。</div>`}
            ${open.kind !== "soul" ? html4`<label class="memory-field memory-content-field"><span>${open.kind === "mode" ? `内容 · ${String(draft.content ?? "").length}/180` : "内容"}</span><textarea rows="16" maxlength=${open.kind === "mode" ? 180 : null} value=${draft.content ?? ""} disabled=${open.kind === "session" || open.kind === "trash"} onInput=${(event) => setDraft({ ...draft, content: event.target.value })}></textarea></label>` : null}
            <div class="memory-detail-foot">${open.kind === "session" ? "当前会话" : open.kind === "soul" ? draft.path ?? "~/.visionox/soul.md" : `创建 ${draft.createdAt || "未知"} · 更新 ${draft.updatedAt || "未知"} · 来源 ${draft.source === "model" ? "AI" : draft.source === "ui" ? "界面" : "历史数据"}`}</div>
          `}
        </div>
      </div>
    </div>
  `;
}

// dashboard/src/lib/budget.ts
function deriveBudgetState2(cap, spent) {
  const safeSpent = typeof spent === "number" && spent >= 0 ? spent : 0;
  if (typeof cap !== "number" || cap <= 0) {
    return { kind: "off", spent: safeSpent };
  }
  const pct = safeSpent / cap * 100;
  if (pct >= 100) return { kind: "exhausted", cap, spent: safeSpent, pct };
  if (pct >= 80) return { kind: "warn", cap, spent: safeSpent, pct };
  return { kind: "running", cap, spent: safeSpent, pct };
}
var QUICK_CAPS_USD2 = [1, 5, 10, 25, 50];
function bumpSuggestions2(currentCap) {
  if (currentCap <= 0) return [];
  return [niceUp(currentCap * 1.5), niceUp(currentCap * 2), niceUp(currentCap * 4)];
}
function niceUp(n3) {
  const eps = 1e-9;
  if (n3 < 1) return Math.ceil((n3 - eps) * 10) / 10;
  if (n3 < 10) return Math.ceil((n3 - eps) * 2) / 2;
  if (n3 < 100) return Math.ceil(n3 - eps);
  return Math.ceil((n3 - eps) / 5) * 5;
}
function budgetTone2(state) {
  if (state.kind === "exhausted") return "err";
  if (state.kind === "warn") return "warn";
  return "";
}

// dashboard/src/lib/version.ts
function compareVersions2(a3, b3) {
  const [aCore = "0", aPre = ""] = a3.split("-", 2);
  const [bCore = "0", bPre = ""] = b3.split("-", 2);
  const aParts = aCore.split(".").map((p3) => Number.parseInt(p3, 10) || 0);
  const bParts = bCore.split(".").map((p3) => Number.parseInt(p3, 10) || 0);
  for (let i3 = 0; i3 < 3; i3++) {
    const diff = (aParts[i3] ?? 0) - (bParts[i3] ?? 0);
    if (diff !== 0) return diff;
  }
  if (!aPre && !bPre) return 0;
  if (!aPre) return 1;
  if (!bPre) return -1;
  return aPre < bPre ? -1 : aPre > bPre ? 1 : 0;
}

// dashboard/src/panels/overview.ts
var N25 = N2;
function kpi(label, value, delta, deltaTone) {
  const muted = value === "—" || value === "-" || value === null || value === void 0;
  return html4`
    <div class="kpi cock-w-1">
      <div class="label">${label}</div>
      <div class="value" style=${muted ? "color:var(--fg-4)" : ""}>${value ?? "—"}</div>
      ${delta != null ? html4`<div class=${`delta ${deltaTone ?? ""}`}>${delta}</div>` : null}
    </div>
  `;
}
function deltaPctText(deltaPct) {
  if (deltaPct === null) return { text: t4("overview.noPriorData"), tone: "flat" };
  if (Math.abs(deltaPct) < 1) return { text: t4("overview.stable"), tone: "flat" };
  const arrow = deltaPct > 0 ? "▲" : "▼";
  return {
    text: t4("overview.vsPrior", { arrow, pct: Math.abs(deltaPct).toFixed(0) }),
    tone: deltaPct > 0 ? "up" : "down"
  };
}
function deltaPpText(deltaPp) {
  if (deltaPp === null) return { text: t4("overview.noPriorData"), tone: "flat" };
  if (Math.abs(deltaPp) < 0.5) return { text: t4("overview.stable"), tone: "flat" };
  const arrow = deltaPp > 0 ? "▲" : "▼";
  return { text: `${arrow} ${Math.abs(deltaPp).toFixed(1)}pp`, tone: deltaPp > 0 ? "up" : "down" };
}
function deltaCountText(delta) {
  if (delta === null || delta === 0) return { text: t4("overview.stable"), tone: "flat" };
  const arrow = delta > 0 ? "▲" : "▼";
  return { text: `${arrow} ${Math.abs(delta)}`, tone: delta > 0 ? "up" : "down" };
}
function balanceKpi(c3) {
  if (c3.balanceSupported === false) return kpi(t4("overview.balance"), "-", null, "flat");
  if (!c3.balance) return kpi(t4("overview.balance"), "—", null, "flat");
  const symbol = c3.balance.currency === "CNY" ? "¥" : c3.balance.currency === "USD" ? "$" : "";
  return kpi(t4("overview.balance"), `${symbol}${c3.balance.total}`, c3.balance.currency, "flat");
}
function budgetKpi(o3) {
  const state = deriveBudgetState2(o3.budgetUsd, o3.cockpit?.currentSession?.totalCostUsd ?? null);
  if (state.kind === "off") return null;
  const tone = budgetTone2(state);
  const valueColor = tone === "err" ? "color:var(--c-err)" : tone === "warn" ? "color:var(--c-warn)" : "";
  return html4`
    <div class="kpi cock-w-1">
      <div class="label">${t4("overview.budget")}</div>
      <div class="value" style=${valueColor}>${fmtUsd(state.spent)} / ${fmtUsd(state.cap)}</div>
      <div class=${`progress ${tone}`} style="margin-top:4px"><div class="progress-fill" style=${`width:${Math.min(100, state.pct)}%`}></div></div>
    </div>
  `;
}
function tokens7dKpi(c3) {
  if (!c3.tokens7d) return kpi(t4("overview.tokens7d"), "—", t4("overview.noUsageYet"), "flat");
  const d3 = deltaPctText(c3.tokens7d.deltaPct);
  return kpi(t4("overview.tokens7d"), fmtCompactNum(c3.tokens7d.total), d3.text, d3.tone);
}
function cacheHitKpi(c3) {
  if (!c3.cacheHit7d) return kpi(t4("overview.cacheHit"), "—", t4("overview.noUsageYet"), "flat");
  const pct = (c3.cacheHit7d.ratio * 100).toFixed(0);
  const d3 = deltaPpText(c3.cacheHit7d.deltaPp);
  return html4`
    <div class="kpi cock-w-1">
      <div class="label">${t4("overview.cacheHit")}</div>
      <div class="value">${pct}<span class="unit">%</span></div>
      <div class=${`delta ${d3.tone}`}>${d3.text}</div>
    </div>
  `;
}
function toolCallsKpi(c3) {
  if (!c3.toolCalls24h) return kpi(t4("overview.toolCalls24h"), "—", t4("overview.noToolCalls"), "flat");
  const d3 = deltaCountText(c3.toolCalls24h.delta);
  return kpi(t4("overview.toolCalls24h"), fmtNum(c3.toolCalls24h.total), d3.text, d3.tone);
}
function currentSessionBlock(c3) {
  if (!c3.currentSession) {
    return html4`
      <div class="cock-list cock-w-2">
        <div class="ch"><span class="ttl">${t4("overview.currentSession")}</span></div>
        <div style="color:var(--fg-3);font-size:12.5px;padding:8px 0">
          ${t4("overview.noSession")}
        </div>
      </div>
    `;
  }
  const s3 = c3.currentSession;
  const currency = c3.balance?.currency;
  return html4`
    <div class="cock-list cock-w-2">
      <div class="ch"><span class="ttl">${t4("overview.currentSession")}</span></div>
      <div class="card accent-brand" style="margin:0 0 8px;background:transparent;border:none;padding:0">
        <div class="card-h"><span class="glyph">◆</span><span class="title">${s3.id}</span><span class="meta">${s3.turns} turn${s3.turns === 1 ? "" : "s"}</span></div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:8px;font-family:var(--font-mono);font-size:11px">
        <div><span style="color:var(--fg-3)">${t4("overview.promptTok")}</span><div style="color:var(--fg-0);font-size:13px;font-weight:600">${fmtNum(s3.lastPromptTokens)}</div></div>
        <div><span style="color:var(--fg-3)">${t4("overview.completionTok")}</span><div style="color:var(--fg-0);font-size:13px;font-weight:600">${fmtNum(s3.completionTokens)}</div></div>
        <div><span style="color:var(--fg-3)">${t4("overview.cost")}</span><div style="color:var(--fg-0);font-size:13px;font-weight:600">${fmtCost(s3.totalCostUsd, currency)}</div></div>
      </div>
    </div>
  `;
}
function costTrendSpark(c3) {
  if (!c3.costTrend14d || c3.costTrend14d.length === 0) {
    return html4`
      <div class="chart cock-w-2">
        <div class="chart-h"><span class="title">${t4("overview.costTrend")}</span></div>
        <div class="chart-v" style="color:var(--fg-4)">—<span class="unit">${t4("overview.noUsageYet")}</span></div>
      </div>
    `;
  }
  const days2 = c3.costTrend14d;
  const total = days2.reduce((s3, d3) => s3 + d3.usd, 0);
  const max2 = Math.max(...days2.map((d3) => d3.usd), 1e-4);
  const w32 = 400;
  const h3 = 60;
  const points2 = days2.map((d3, i3) => {
    const x32 = days2.length === 1 ? 0 : i3 * w32 / (days2.length - 1);
    const y3 = h3 - d3.usd / max2 * (h3 - 6) - 3;
    return `${x32.toFixed(0)},${y3.toFixed(0)}`;
  }).join(" ");
  const area = `${points2} ${w32},${h3} 0,${h3}`;
  const avg = total / days2.length;
  return html4`
    <div class="chart cock-w-2">
      <div class="chart-h"><span class="title">${t4("overview.costTrend")}</span></div>
      <div class="chart-v">${fmtCost(avg, c3.balance?.currency)}<span class="unit">${t4("overview.dayAvg")}</span></div>
      <div class="chart-spark">
        <svg viewBox=${`0 0 ${w32} ${h3}`} preserveAspectRatio="none">
          <polyline fill="none" stroke="var(--c-brand)" stroke-width="1.5" points=${points2} />
          <polyline fill="rgba(121,192,255,.10)" stroke="none" points=${area} />
        </svg>
      </div>
    </div>
  `;
}
function recentPlansRail(c3) {
  return html4`
    <div class="cock-list cock-w-2">
      <div class="ch"><span class="ttl">${t4("overview.recentPlans")}</span></div>
      ${!c3.recentPlans || c3.recentPlans.length === 0 ? html4`<div style="color:var(--fg-3);font-size:12.5px;padding:8px 0">${t4("overview.noPlans")}</div>` : c3.recentPlans.map(
    (p3) => html4`
                <div class=${`rail-step ${p3.status === "done" ? "done" : "active"}`}>
                  <span class="g">${p3.status === "done" ? "✓" : "⏵"}</span>
                  <span>${p3.title} · ${p3.completedSteps}/${p3.totalSteps} step${p3.totalSteps === 1 ? "" : "s"}</span>
                  <span style="margin-left:auto;color:var(--fg-4);font-family:var(--font-mono);font-size:10.5px">${fmtRelativeTime(p3.whenMs)}</span>
                </div>
              `
  )}
    </div>
  `;
}
function toolActivityFeed(c3) {
  return html4`
    <div class="cock-list cock-w-2">
      <div class="ch"><span class="ttl">${t4("overview.toolActivity")}</span></div>
      ${!c3.toolActivity || c3.toolActivity.length === 0 ? html4`<div style="color:var(--fg-3);font-size:12.5px;padding:8px 0">${t4("overview.noToolCalls")}</div>` : c3.toolActivity.map(
    (r3) => html4`
                <div class=${`feed-row ${r3.level}`}>
                  <span class="g">${r3.level === "ok" ? "●" : r3.level === "warn" ? "▲" : "✕"}</span>
                  <span class="name">${r3.name}${r3.args ? html4` <span class="args">${r3.args}</span>` : null}</span>
                  <span class="when" style="margin-left:auto">${fmtRelativeTime(r3.whenMs)}</span>
                </div>
              `
  )}
    </div>
  `;
}
function OverviewPanel() {
  useLang();
  const [modelChecking, setModelChecking] = d2(false);
  const [actionFeedback, setActionFeedback] = d2(null);
  const [backupBusy, setBackupBusy] = d2(false);
  const [backupPreview, setBackupPreview] = d2(null);
  const [backupRetentionDraft, setBackupRetentionDraft] = d2(10);
  const { data, error, loading, refresh } = usePoll("/overview", 5e3, "overview");
  const { data: healthData, error: healthError, refresh: refreshHealth } = usePoll("/health", 5e3, "health");
  const { data: backupsData, refresh: refreshBackups } = usePoll("/backups", 15e3);
  const { data: backupEstimate } = usePoll("/backups/estimate", 3e4);
  const { data: retrievalData } = usePoll("/index-retrieval-mode", 5e3);
  y2(() => {
    if (Number.isFinite(backupsData?.retentionCount)) setBackupRetentionDraft(backupsData.retentionCount);
  }, [backupsData?.retentionCount]);
  const runModelChecks = q2(async () => {
    if (modelChecking) return;
    setModelChecking(true);
    setActionFeedback(null);
    try {
      const tested = await api("/providers/test", { method: "POST", body: {} });
      setActionFeedback({ tone: tested.passed > 0 ? "ok" : "warn", text: t4("overview.modelCheckDone", { passed: tested.passed, total: tested.total }) });
      await refresh();
    } catch (err) {
      setActionFeedback({ tone: "err", text: t4("overview.modelCheckFailed", { error: err.message }) });
    } finally {
      setModelChecking(false);
    }
  }, [modelChecking, refresh]);
  const createBackup = q2(async () => {
    if (backupBusy) return;
    setBackupBusy(true);
    setActionFeedback(null);
    try {
      const created = await api("/backups", { method: "POST", body: {} });
      setBackupPreview(null);
      setActionFeedback({ tone: "ok", text: t4("overview.backupCreated", { count: created.fileCount, size: fmtBytes(created.totalBytes) }) });
      await Promise.all([refreshBackups(), refreshHealth()]);
    } catch (err) {
      setActionFeedback({ tone: "err", text: t4("overview.backupFailed", { error: err.message }) });
    } finally {
      setBackupBusy(false);
    }
  }, [backupBusy, refreshBackups, refreshHealth]);
  const previewBackup = q2(async (id) => {
    if (backupBusy) return;
    setBackupBusy(true);
    try {
      setBackupPreview(await api(`/backups/${encodeURIComponent(id)}/preview`));
    } catch (err) {
      setActionFeedback({ tone: "err", text: t4("overview.restoreFailed", { error: err.message }) });
    } finally {
      setBackupBusy(false);
    }
  }, [backupBusy]);
  const restoreBackup = q2(async (id, overwrite) => {
    if (backupBusy || overwrite && !globalThis.confirm(t4("overview.restoreConfirm"))) return;
    setBackupBusy(true);
    try {
      const restored = await api(`/backups/${encodeURIComponent(id)}/restore`, { method: "POST", body: { overwrite } });
      setActionFeedback({ tone: "ok", text: t4("overview.restoreDone", restored) });
      setBackupPreview(await api(`/backups/${encodeURIComponent(id)}/preview`));
      await refreshHealth();
    } catch (err) {
      setActionFeedback({ tone: "err", text: t4("overview.restoreFailed", { error: err.message }) });
    } finally {
      setBackupBusy(false);
    }
  }, [backupBusy, refreshHealth]);
  const saveBackupRetention = q2(async () => {
    if (backupBusy) return;
    setBackupBusy(true);
    try {
      const result = await api("/backups/retention", { method: "POST", body: { retentionCount: globalThis.VisionoxBackupPolicy.normalizeRetentionCount(backupRetentionDraft) } });
      setBackupRetentionDraft(result.retentionCount);
      setBackupPreview(null);
      await Promise.all([refreshBackups(), refreshHealth()]);
    } catch (err) {
      setActionFeedback({ tone: "err", text: t4("overview.backupFailed", { error: err.message }) });
    } finally {
      setBackupBusy(false);
    }
  }, [backupBusy, backupRetentionDraft, refreshBackups, refreshHealth]);
  const deleteBackup = q2(async (id) => {
    if (backupBusy || !globalThis.confirm(t4("overview.deleteBackupConfirm"))) return;
    setBackupBusy(true);
    try {
      await api(`/backups/${encodeURIComponent(id)}`, { method: "DELETE", body: {} });
      if (backupPreview?.id === id) setBackupPreview(null);
      await Promise.all([refreshBackups(), refreshHealth()]);
    } catch (err) {
      setActionFeedback({ tone: "err", text: t4("overview.backupFailed", { error: err.message }) });
    } finally {
      setBackupBusy(false);
    }
  }, [backupBusy, backupPreview?.id, refreshBackups, refreshHealth]);
  if (loading && !data)
    return html4`<div class="card" style="color:var(--fg-3)">${t4("overview.loading")}</div>`;
  if (error) return html4`<div class="card accent-err">${t4("overview.failed", { error: error.message })}</div>`;
  if (!data) return null;
  const o3 = data;
  const h3 = healthData;
  const storageHealth = h3?.storage?.backups ? h3.storage : null;
  const c3 = o3.cockpit ?? {
    balance: null,
    tokens7d: null,
    cacheHit7d: null,
    costTrend14d: null,
    currentSession: null,
    toolCalls24h: null,
    recentPlans: null,
    toolActivity: null
  };
  const workspaceName = o3.cwd?.split(/[\\/]/).filter(Boolean).at(-1) ?? "—";
  const sceneName = o3.activeMode?.label ?? o3.workMode ?? "—";
  const budgetState = deriveBudgetState2(o3.budgetUsd, c3.currentSession?.totalCostUsd ?? null);
  const alertStates = globalThis.VisionoxOverviewAlertPolicy.evaluate({
    modelVerificationDirty: o3.modelVerification?.dirty,
    modelDrift: o3.modelDrift,
    pendingEdits: o3.pendingEdits,
    corruptBackups: storageHealth?.backups?.corrupt,
    storageIssues: h3?.storageIssues?.length,
    retrievalMode: retrievalData?.mode,
    semanticAvailable: retrievalData?.semanticAvailable,
    budgetKind: budgetState.kind,
    budgetPct: budgetState.pct
  });
  const alerts = alertStates.map((alert) => {
    if (alert.kind === "model_retest") return { tone: alert.tone, text: t4("overview.retestModels"), label: modelChecking ? t4("overview.checkingModels") : t4("overview.checkModels"), action: runModelChecks, disabled: modelChecking };
    if (alert.kind === "model_drift") return { tone: alert.tone, text: t4("overview.modelDrift") };
    if (alert.kind === "pending_edits") return { tone: alert.tone, text: t4("overview.pendingEdits", { count: alert.count }) };
    if (alert.kind === "corrupt_backups") return { tone: alert.tone, text: t4("overview.backupCorrupt", { count: alert.count }) };
    if (alert.kind === "storage_issues") return { tone: alert.tone, text: t4("overview.storageIssues", { count: alert.count }) };
    if (alert.kind === "missing_index") return { tone: alert.tone, text: t4("overview.missingIndex"), label: t4("overview.openIndex"), action: () => appBus.dispatchEvent(new CustomEvent("navigate-tab", { detail: { tabId: "semantic" } })) };
    if (alert.kind === "budget") return { tone: alert.tone, text: t4("overview.budgetWarning", { pct: Math.round(alert.pct) }) };
    return null;
  }).filter(Boolean);
  const missingRequiredIndex = alertStates.some((alert) => alert.kind === "missing_index");
  return html4`
    <div style="display:flex;flex-direction:column;gap:14px">
      ${o3.mode === "standalone" ? html4`<div class="card accent-warn">
              <div class="card-h">
                <span class="title" style="color:var(--c-warn)">${t4("overview.standaloneTitle")}</span>
              </div>
              <div class="card-b">
                ${t4("overview.standaloneDesc")}
              </div>
            </div>` : null}

      <h3 style="margin:0;font-family:var(--font-mono);font-size:11px;color:var(--fg-3);text-transform:uppercase;letter-spacing:.1em">
        ${t4("overview.workStatus")}
      </h3>
      <div class="health-grid">
        <div class="health-item"><div class="lbl">${t4("overview.workspace")}</div><div class="v">${workspaceName}</div><div class="meta">${o3.session ?? t4("overview.noSession")}</div></div>
        <div class="health-item"><div class="lbl">${t4("overview.provider")}</div><div class="v">${o3.activeProviderName ?? o3.activeProviderId ?? "—"}</div><div class="meta">${t4("overview.runtimeModel")}: ${o3.runtimeModel ?? o3.displayModel ?? "—"}</div></div>
        <div class="health-item"><div class="lbl">${t4("overview.presetMode")}</div><div class="v">${o3.preset ?? "auto"}</div><div class="meta">${o3.requestPolicy === "json" ? "JSON 参数" : o3.reasoningEffort ?? "—"}</div></div>
        <div class="health-item"><div class="lbl">${t4("overview.workScene")}</div><div class="v">${sceneName}</div><div class="meta">${o3.editMode ?? "—"}</div></div>
        <div class=${`health-item ${missingRequiredIndex ? "warn" : ""}`}><div class="lbl">${t4("system.semanticIndex")}</div><div class="v">${o3.semanticIndexExists ? t4("overview.semanticReady") : t4("overview.semanticMissing")}</div><div class="meta">${o3.semanticIndexExists ? t4("system.built") : t4("system.runIndex")}</div></div>
      </div>

      ${alerts.length > 0 ? html4`
        <h3 style="margin:4px 0 0;font-family:var(--font-mono);font-size:11px;color:var(--fg-3);text-transform:uppercase;letter-spacing:.1em">${t4("overview.attention")}</h3>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${alerts.map((alert) => html4`<div class=${`card accent-${alert.tone}`} style="padding:10px 12px;display:flex;align-items:center;gap:12px;color:${alert.tone === "err" ? "var(--c-err)" : "var(--c-warn)"}"><span style="flex:1">${alert.text}</span>${alert.action ? html4`<button type="button" disabled=${alert.disabled} onClick=${alert.action}>${alert.label}</button>` : null}</div>`)}
        </div>
      ` : null}
      ${actionFeedback ? html4`<div class=${`card accent-${actionFeedback.tone === "ok" ? "brand" : actionFeedback.tone}`} style="padding:10px 12px">${actionFeedback.text}</div>` : null}

      <h3 style="margin:4px 0 0;font-family:var(--font-mono);font-size:11px;color:var(--fg-3);text-transform:uppercase;letter-spacing:.1em">${t4("overview.sessionAndPlans")}</h3>
      <div class="cockpit">
        ${currentSessionBlock(c3)}
        ${budgetKpi(o3)}
        ${recentPlansRail(c3)}
      </div>

      <h3 style="margin:4px 0 0;font-family:var(--font-mono);font-size:11px;color:var(--fg-3);text-transform:uppercase;letter-spacing:.1em">${t4("overview.localSystem")}</h3>
      ${healthError ? html4`<div class="card accent-warn">${t4("common.loadingFailed", { name: "health", error: healthError.message })}</div>` : null}
      ${h3 ? html4`
        <div class="health-grid">
          <div class=${`health-item ${h3.latestVersion && compareVersions2(h3.version, h3.latestVersion) < 0 ? "warn" : ""}`}><div class="lbl">${t4("system.version")}</div><div class="v">${h3.version ?? "—"}</div><div class="meta">${h3.latestVersion && compareVersions2(h3.version, h3.latestVersion) < 0 ? t4("system.latestVer", { version: h3.latestVersion }) : t4("system.upToDate")}</div></div>
          <div class="health-item"><div class="lbl">${t4("system.sessions")}</div><div class="v">${fmtBytes(h3.sessions.totalBytes)}</div><div class="meta">${fmtNum(h3.sessions.count)} ${t4("system.files")}</div></div>
          <div class="health-item"><div class="lbl">${t4("system.memory")}</div><div class="v">${fmtBytes(h3.memory.totalBytes)}</div><div class="meta">${fmtNum(h3.memory.fileCount)} ${t4("system.files")}</div></div>
          <div class="health-item"><div class="lbl">${t4("system.semanticIndex")}</div><div class="v">${h3.semantic.exists ? fmtBytes(h3.semantic.totalBytes) : "—"}</div><div class="meta">${h3.semantic.exists ? `${fmtNum(h3.semantic.fileCount)} ${t4("system.files")}` : t4("system.runIndex")}</div></div>
          ${storageHealth ? html4`<div class="health-item"><div class="lbl">${t4("overview.userDataSize")}</div><div class="v">${fmtBytes(storageHealth.totalBytes)}</div><div class="meta">${["current", "migrated"].includes(storageHealth.configStatus) ? t4("overview.storageHealthy") : storageHealth.configStatus ?? "—"}</div></div>` : null}
          ${storageHealth ? html4`<div class=${`health-item ${storageHealth.backups.corrupt > 0 ? "warn" : ""}`}><div class="lbl">${t4("overview.latestBackup")}</div><div class="v">${storageHealth.backups.latestAt ? new Date(storageHealth.backups.latestAt).toLocaleString() : t4("overview.noBackup")}</div><div class="meta">${t4("overview.backupCount", { count: fmtNum(storageHealth.backups.count), size: fmtBytes(storageHealth.sources?.sessions?.totalBytes ?? 0) })}</div></div>` : null}
          ${h3.jobs > 0 ? html4`<div class="health-item"><div class="lbl">${t4("system.backgroundJobs")}</div><div class="v">${t4("system.running", { count: fmtNum(h3.jobs) })}</div><div class="meta">${t4("system.shellSpawn")}</div></div>` : null}
        </div>
        <details class="card" style="padding:10px 14px">
          <summary style="cursor:pointer;color:var(--fg-2);font-size:12px">${t4("overview.dataProtection")}</summary>
          <div style="display:flex;flex-direction:column;gap:8px;margin-top:10px">
            <div style="display:flex;align-items:center;gap:8px"><button type="button" disabled=${backupBusy} onClick=${createBackup}>${backupBusy ? t4("overview.backupCreating") : t4("overview.createBackup")}</button><span class="dim" style="min-width:0;overflow-wrap:anywhere">${storageHealth?.backups?.path ?? ""}</span></div>
            ${backupEstimate ? html4`<span class="dim">${t4("overview.backupEstimate", { size: fmtBytes(backupEstimate.estimatedBytes), count: fmtNum(backupEstimate.fileCount), free: backupEstimate.freeBytes == null ? "—" : fmtBytes(backupEstimate.freeBytes) })}</span>` : null}
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><label>${t4("overview.backupRetention")} <input type="number" min="1" max="100" value=${backupRetentionDraft} onInput=${(event) => setBackupRetentionDraft(Number(event.target.value))} style="width:72px" /></label><button type="button" class="btn ghost" disabled=${backupBusy || backupRetentionDraft === backupsData?.retentionCount} onClick=${saveBackupRetention}>${t4("overview.saveRetention")}</button></div>
            ${(backupsData?.items ?? []).slice(0, 5).map((item) => html4`<div style="display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:8px;align-items:center;border-top:1px solid var(--line);padding-top:8px"><span style="min-width:0"><strong>${item.status === "ok" ? new Date(item.createdAt).toLocaleString() : item.id}</strong><br><span class="dim">${item.status === "ok" ? `${fmtNum(item.fileCount)} ${t4("system.files")} / ${fmtBytes(item.totalBytes)}` : item.error}</span></span>${item.status === "ok" ? html4`<button type="button" class="btn ghost" disabled=${backupBusy} onClick=${() => previewBackup(item.id)}>${t4("overview.previewBackup")}</button>` : null}<button type="button" class="btn ghost danger" disabled=${backupBusy} onClick=${() => deleteBackup(item.id)}>${t4("overview.deleteBackup")}</button></div>`)}
            ${backupPreview ? (() => {
    const actions = globalThis.VisionoxBackupPolicy.restoreActions(backupPreview.counts);
    return html4`<div style="border-top:1px solid var(--line);padding-top:8px;display:flex;flex-wrap:wrap;gap:8px;align-items:center"><span style="flex:1;min-width:220px">${t4("overview.previewCounts", backupPreview.counts)}</span><button type="button" class="btn ghost" disabled=${backupBusy || !actions.canRestoreMissing} onClick=${() => restoreBackup(backupPreview.id, false)}>${t4("overview.restoreMissing")}</button><button type="button" class="btn ghost" disabled=${backupBusy || !actions.canOverwriteConflicts} onClick=${() => restoreBackup(backupPreview.id, true)}>${t4("overview.restoreAll")}</button></div>`;
  })() : null}
          </div>
        </details>
        <details class="card" style="padding:10px 14px">
          <summary style="cursor:pointer;color:var(--fg-2);font-size:12px">${t4("overview.userDataPaths")}</summary>
          <table class="tbl" style="margin-top:8px"><tbody style="font-size:11.5px">
            <tr><td class="dim">${t4("system.home")}</td><td class="path">${h3.visionoxHome}</td></tr>
            <tr><td class="dim">${t4("system.sessionsPath")}</td><td class="path">${h3.sessions.path}</td></tr>
            <tr><td class="dim">${t4("system.memoryPath")}</td><td class="path">${h3.memory.path}</td></tr>
            <tr><td class="dim">${t4("system.semanticPath")}</td><td class="path">${h3.semantic.path}</td></tr>
          </tbody></table>
        </details>
      ` : null}
    </div>
  `;
}

// dashboard/src/panels/permissions.ts
var N26 = N2;
function groupByVerb(list2) {
  const groups = /* @__PURE__ */ new Map();
  for (const entry of list2) {
    const sp = entry.indexOf(" ");
    const verb = sp > 0 ? entry.slice(0, sp) : entry;
    const tail = sp > 0 ? entry.slice(sp + 1) : "";
    const arr = groups.get(verb) ?? [];
    arr.push(tail);
    groups.set(verb, arr);
  }
  return [...groups.entries()];
}
function PermissionsPanel() {
  useLang();
  const { data, error, loading, refresh } = usePoll("/permissions", 5e3);
  const [draft, setDraft] = d2("");
  const [busy, setBusy] = d2(false);
  const [feedback, setFeedback] = d2(null);
  const add = q2(async () => {
    const prefix = draft.trim();
    if (!prefix) return;
    setBusy(true);
    setFeedback(null);
    try {
      const res = await api("/permissions", {
        method: "POST",
        body: { prefix }
      });
      if (res.alreadyPresent) setFeedback({ kind: "info", text: t4("permissions.alreadyIn", { prefix }) });
      else setFeedback({ kind: "ok", text: t4("permissions.added", { prefix }) });
      setDraft("");
      await refresh();
    } catch (err) {
      setFeedback({ kind: "err", text: err.message });
    } finally {
      setBusy(false);
    }
  }, [draft, refresh]);
  const remove = q2(
    async (prefix) => {
      if (!confirm(t4("permissions.removeConfirm", { prefix }))) return;
      setBusy(true);
      setFeedback(null);
      try {
        await api("/permissions", { method: "DELETE", body: { prefix } });
        setFeedback({ kind: "ok", text: t4("permissions.removed", { prefix }) });
        await refresh();
      } catch (err) {
        setFeedback({ kind: "err", text: err.message });
      } finally {
        setBusy(false);
      }
    },
    [refresh]
  );
  const clearAll = q2(async () => {
    if (!confirm(t4("permissions.clearConfirm"))) return;
    setBusy(true);
    setFeedback(null);
    try {
      const res = await api("/permissions/clear", {
        method: "POST",
        body: { confirm: true }
      });
      setFeedback({
        kind: "ok",
        text: t4("permissions.cleared", { count: res.dropped, y: res.dropped === 1 ? "y" : "ies" })
      });
      await refresh();
    } catch (err) {
      setFeedback({ kind: "err", text: err.message });
    } finally {
      setBusy(false);
    }
  }, [refresh]);
  if (loading && !data)
    return html4`<div class="card" style="color:var(--fg-3)">${t4("permissions.loading")}</div>`;
  if (error) return html4`<div class="card accent-err">${t4("common.loadingFailed", { name: "permissions", error: error.message })}</div>`;
  if (!data) return null;
  const p3 = data;
  const feedbackPill = feedback ? html4`<span
        class=${`pill ${feedback.kind === "err" ? "err" : feedback.kind === "ok" ? "ok" : "warn"}`}
      >${feedback.text}</span>` : null;
  return html4`
    <div style="display:flex;flex-direction:column;gap:14px">
      ${p3.editMode === "admin" ? html4`<div class="card accent-err">
              <div class="card-h"><span class="title" style="color:var(--c-err)">Admin \u6A21\u5F0F</span></div>
              <div class="card-b">
                \u6240\u6709\u5B89\u5168\u9650\u5236\u5DF2\u79FB\u9664\u3002\u6A21\u578B\u53EF\u6267\u884C\u4EFB\u610F Shell \u547D\u4EE4\u5E76\u8BBF\u95EE\u78C1\u76D8\u4EFB\u610F\u4F4D\u7F6E\u7684\u6587\u4EF6\u3002
              </div>
            </div>` : null}
      ${p3.editMode === "yolo" ? html4`<div class="card accent-warn">
              <div class="card-h"><span class="title" style="color:var(--c-warn)">${t4("permissions.yoloTitle")}</span></div>
              <div class="card-b">
                ${t4("permissions.yoloDesc")}
              </div>
            </div>` : null}

      <div class="chips">
        <span class="chip-f static active">${t4("permissions.project")} <span class="ct">${p3.project.length}</span></span>
        <span class="chip-f static">${t4("permissions.builtin")} <span class="ct">${p3.builtin.length}</span></span>
      </div>

      ${p3.currentCwd ? html4`
            <div class="card">
              <div class="card-h">
                <span class="title">${t4("permissions.addPrefix")}</span>
                <span class="meta">${p3.currentCwd}</span>
              </div>
              <div style="display:flex;gap:8px;align-items:center">
                <input
                  type="text"
                  placeholder=${t4("permissions.addPlaceholder")}
                  value=${draft}
                  onInput=${(e3) => setDraft(e3.target.value)}
                  onKeyDown=${(e3) => {
    if (e3.key === "Enter") add();
  }}
                  disabled=${busy}
                  style="flex:1"
                />
                <button class="primary" onClick=${add} disabled=${busy || !draft.trim()}>${t4("common.add")}</button>
                <button
                  class="danger"
                  onClick=${clearAll}
                  disabled=${busy || p3.project.length === 0}
                >${t4("permissions.clearAll")}</button>
              </div>
              ${feedbackPill ? html4`<div style="margin-top:8px">${feedbackPill}</div>` : null}
            </div>
          ` : html4`
            <div class="card accent-warn">
              <div class="card-b">
                ${t4("permissions.standaloneWarning")}
              </div>
            </div>
          `}

      <h3 style="margin:6px 0 0;font-family:var(--font-mono);font-size:11px;color:var(--fg-3);text-transform:uppercase;letter-spacing:.1em">
        ${t4("permissions.projectAllowlist", { count: p3.project.length })}
      </h3>
      ${p3.project.length === 0 ? html4`<div class="card" style="color:var(--fg-3)">${t4("permissions.nothingStored")}</div>` : html4`
            <div class="card" style="padding:0;overflow:hidden">
              <table class="tbl">
                <thead>
                  <tr>
                    <th style="width:48px">${t4("permissions.colNum")}</th>
                    <th>${t4("permissions.colPrefix")}</th>
                    <th style="width:120px"></th>
                  </tr>
                </thead>
                <tbody>
                  ${p3.project.map(
    (prefix, i3) => html4`
                      <tr>
                        <td class="dim">${i3 + 1}</td>
                        <td><code class="mono">${prefix}</code></td>
                        <td>
                          ${p3.currentCwd ? html4`<button
                                  class="danger"
                                  onClick=${() => remove(prefix)}
                                  disabled=${busy}
                                >${t4("common.remove")}</button>` : null}
                        </td>
                      </tr>
                    `
  )}
                </tbody>
              </table>
            </div>
          `}

      <h3 style="margin:6px 0 0;font-family:var(--font-mono);font-size:11px;color:var(--fg-3);text-transform:uppercase;letter-spacing:.1em">
        ${t4("permissions.builtinTitle", { count: p3.builtin.length })}
      </h3>
      <div class="card" style="font-family:var(--font-mono);font-size:11.5px;line-height:1.8">
        ${groupByVerb(p3.builtin).map(
    ([verb, list2]) => html4`
            <div style="margin-bottom:4px">
              <span class="pill" style="margin-right:6px">${verb}</span>
              <span style="color:var(--fg-2)">${list2.join(" · ")}</span>
            </div>
          `
  )}
      </div>
    </div>
  `;
}

// dashboard/src/panels/semantic.ts
var N27 = N2;
function SemanticPanel() {
  useLang();
  const [data, setData] = d2(null);
  const [draft, setDraft] = d2(null);
  const [draftDirty, setDraftDirty] = d2(false);
  const draftDirtyRef = A2(false);
  const [error, setError] = d2(null);
  const [busy, setBusy] = d2(false);
  const [info, setInfo] = d2(null);
  const load = q2(async () => {
    try {
      const [semantic, config] = await Promise.all([
        api("/semantic"),
        api("/semantic/config")
      ]);
      setData(semantic);
      setDraft((current) => current && draftDirtyRef.current ? current : toConfigDraft(config));
    } catch (err) {
      setError(err.message);
    }
  }, []);
  y2(() => {
    load();
    const phase2 = data?.job?.phase;
    const running2 = isActiveSemanticPhase(phase2);
    const pulling2 = data?.pull?.status === "pulling";
    const ms = running2 || pulling2 ? 1200 : 5e3;
    const id = setInterval(load, ms);
    return () => clearInterval(id);
  }, [load, data?.job?.phase, data?.pull?.status]);
  const start = q2(
    async (rebuild) => {
      if (!draft) return;
      setBusy(true);
      setError(null);
      setInfo(null);
      try {
        const validation = validateSemanticDraft(draft);
        if (draftDirty) {
          throw new Error(t4("semantic.saveBeforeIndex"));
        }
        if (validation.error) {
          throw new Error(validation.error);
        }
        await api("/semantic/start", { method: "POST", body: { rebuild: !!rebuild } });
        setInfo(rebuild ? t4("semantic.rebuildStarted") : t4("semantic.incrementalStarted"));
        await load();
      } catch (err) {
        setError(err.message);
      } finally {
        setBusy(false);
      }
    },
    [draft, draftDirty, load]
  );
  const stop = q2(async () => {
    setBusy(true);
    setError(null);
    try {
      await api("/semantic/stop", { method: "POST", body: {} });
      setInfo(t4("semantic.stopRequested"));
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [load]);
  const startDaemon = q2(async () => {
    setBusy(true);
    setError(null);
    setInfo(t4("semantic.startingDaemon"));
    try {
      const r3 = await api("/semantic/ollama/start", {
        method: "POST",
        body: {}
      });
      setInfo(r3.ready ? t4("semantic.daemonUp") : t4("semantic.daemonTimeout"));
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [load]);
  const pullModel = q2(
    async (model) => {
      setBusy(true);
      setError(null);
      setInfo(t4("semantic.pullingModel", { model }));
      try {
        await api("/semantic/ollama/pull", { method: "POST", body: { model } });
        await load();
      } catch (err) {
        setError(err.message);
      } finally {
        setBusy(false);
      }
    },
    [load]
  );
  const saveProviderConfig = q2(async () => {
    if (!draft) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const extraBody = semanticValidation.extraBody;
      await api("/semantic/config", {
        method: "POST",
        body: {
          provider: draft.provider,
          ollama: {
            baseUrl: draft.ollama.baseUrl,
            model: draft.ollama.model
          },
          openaiCompat: {
            baseUrl: draft.openaiCompat.baseUrl,
            apiKey: draft.openaiCompat.apiKey,
            model: draft.openaiCompat.model,
            extraBody
          }
        }
      });
      setDraftDirty(false);
      draftDirtyRef.current = false;
      setInfo(t4("semantic.savedConfig", { count: 1 }));
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [draft, load]);
  if (!data && !error) {
    return html4`<div class="card" style="color:var(--fg-3)">${t4("common.loading")}</div>`;
  }
  if (error && !data) return html4`<div class="card accent-err">${error}</div>`;
  if (!data || !draft) return null;
  if (!data.attached) {
    return html4`
      <div class="card" style="color:var(--fg-3)">
        <div class="card-h"><span class="title">${t4("semantic.codeRequired")}</span></div>
        <div class="card-b">${data.reason}</div>
      </div>
    `;
  }
  const job = data.job;
  const phase = job?.phase;
  const running = isActiveSemanticPhase(phase);
  const pull = data.pull;
  const pulling = pull?.status === "pulling";
  const provider = data.providerStatus?.kind ?? draft.provider;
  const ready = data.providerStatus?.ready === true;
  const isOllama = provider === "ollama";
  const ollama = data.providerStatus?.kind === "ollama" ? data.providerStatus : null;
  const remote = data.providerStatus?.kind === "openai-compat" ? data.providerStatus : null;
  const binaryFound = ollama?.binaryFound === true;
  const daemonRunning = ollama?.daemonRunning === true;
  const modelPulled = ollama?.modelPulled === true;
  const modelName = isOllama ? ollama?.modelName ?? draft.ollama.model ?? "nomic-embed-text" : draft.openaiCompat.model;
  const sectionH3 = (text) => html4`
    <h3 style="margin:18px 0 8px;font-family:var(--font-mono);font-size:11px;color:var(--fg-3);text-transform:uppercase;letter-spacing:.1em">${text}</h3>
  `;
  const idx = data.index;
  const indexReady = idx?.exists === true && idx.compatible !== false;
  const indexMismatch = idx?.exists === true && idx.compatible === false;
  const semanticValidation = validateSemanticDraft(draft);
  const semanticDraftBlocked = draftDirty || semanticValidation.error !== null;
  return html4`
    <div style="display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:14px;align-items:start">
      <div style="display:flex;flex-direction:column;gap:10px;min-width:0">
        <div class="chips">
          <span class=${`chip-f static ${indexReady ? "active" : ""}`}>
            ${indexReady ? t4("semantic.indexBuilt") : t4("semantic.noIndex")}
          </span>
          ${ready ? html4`<span class="chip-f static" style="border-color:var(--c-ok);color:var(--c-ok)">${t4("semantic.ready")}</span>` : html4`<span class="chip-f static" style="border-color:var(--c-warn);color:var(--c-warn)">${t4("semantic.setupNeeded")}</span>`}
        </div>
        ${error ? html4`<div class="card accent-err">${error}</div>` : null}

        <div class="card">
          <div class="card-h"><span class="title">${t4("semantic.provider")}</span></div>
          <div class="form-row">
            <span class="lbl">${t4("semantic.providerType")}</span>
            <select
              class="input mono"
              value=${draft.provider}
              onInput=${(e3) => {
    draftDirtyRef.current = true;
    setDraftDirty(true);
    setDraft({
      ...draft,
      provider: e3.target.value
    });
  }}
            >
              <option value="ollama">Ollama</option>
              <option value="openai-compat">OpenAI-Compatible</option>
            </select>
          </div>
          ${draft.provider === "ollama" ? html4`
                <div class="form-row">
                  <span class="lbl">${t4("semantic.model")}</span>
                  <input
                    class="input mono"
                    type="text"
                    value=${draft.ollama.model}
                    onInput=${(e3) => {
    draftDirtyRef.current = true;
    setDraftDirty(true);
    setDraft({
      ...draft,
      ollama: { ...draft.ollama, model: e3.target.value }
    });
  }}
                  />
                </div>
              ` : html4`
                <div class="form-row">
                  <span class="lbl">${t4("semantic.apiUrl")}</span>
                  <input
                    class="input mono"
                    type="text"
                    placeholder="https://your-embedding-host.example/v1/embeddings"
                    value=${draft.openaiCompat.baseUrl}
                    onInput=${(e3) => {
    draftDirtyRef.current = true;
    setDraftDirty(true);
    setDraft({
      ...draft,
      openaiCompat: {
        ...draft.openaiCompat,
        baseUrl: e3.target.value
      }
    });
  }}
                  />
                </div>
                <div class="form-row">
                  <span class="lbl">${t4("semantic.apiKey")}</span>
                  <input
                    class="input mono"
                    type="password"
                    placeholder=${draft.openaiCompat.apiKeySet ? t4("semantic.keepExistingKey") : "请输入实际 API Key（例如 api-xxxxx）"}
                    value=${draft.openaiCompat.apiKey}
                    onInput=${(e3) => {
    draftDirtyRef.current = true;
    setDraftDirty(true);
    setDraft({
      ...draft,
      openaiCompat: {
        ...draft.openaiCompat,
        apiKey: e3.target.value
      }
    });
  }}
                  />
                  <div style="color:var(--fg-3);font-size:12px">${t4("semantic.apiKeyStoredNote")}</div>
                </div>
                <div class="form-row">
                  <span class="lbl">${t4("semantic.model")}</span>
                  <input
                    class="input mono"
                    type="text"
                    placeholder="Qwen3-Embedding"
                    value=${draft.openaiCompat.model}
                    onInput=${(e3) => {
    draftDirtyRef.current = true;
    setDraftDirty(true);
    setDraft({
      ...draft,
      openaiCompat: {
        ...draft.openaiCompat,
        model: e3.target.value
      }
    });
  }}
                  />
                </div>
                <details style="margin-top:10px">
                  <summary style="cursor:pointer;color:var(--fg-2);font-size:12px">${t4("semantic.customRequestBody")}</summary>
                  <div class="form-row" style="margin-top:10px">
                    <span class="lbl">${t4("semantic.customRequestBody")}</span>
                    <textarea
                      class="input mono"
                      rows="6"
                      value=${draft.openaiCompat.extraBodyText}
                      onInput=${(e3) => {
    draftDirtyRef.current = true;
    setDraftDirty(true);
    setDraft({
      ...draft,
      openaiCompat: {
        ...draft.openaiCompat,
        extraBodyText: e3.target.value
      }
    });
  }}
                    ></textarea>
                  </div>
                </details>
                ${semanticValidation.error ? html4`<div style="color:var(--c-err);font-size:12px;margin-top:-2px">${semanticValidation.error}</div>` : null}
              `}
          <div style="display:flex;gap:6px;margin-top:10px">
            <button class="btn primary" disabled=${busy || semanticValidation.error !== null} onClick=${saveProviderConfig}>${t4("common.save")}</button>
          </div>
        </div>
        ${info ? html4`<div><span class="pill info">${info}</span></div>` : null}

        ${indexReady ? html4`<${SemanticSearchSection} />` : null}

        ${isOllama && !binaryFound ? html4`
              <div class="card">
                <div class="card-h"><span class="title">${t4("semantic.installOllama")}</span></div>
                <div class="card-b" style="font-size:13px">
                  ${t4("semantic.installOllamaDesc")}
                  <ul style="margin:10px 0 4px 18px;padding:0">
                    <li><strong>${t4("semantic.macWindows")}</strong> ${t4("semantic.download")} <a href="https://ollama.com/download" target="_blank" rel="noreferrer">ollama.com/download</a></li>
                    <li><strong>${t4("semantic.linux")}</strong> <code class="mono">curl -fsSL https://ollama.com/install.sh | sh</code></li>
                  </ul>
                  <div style="color:var(--fg-3);margin-top:8px">${t4("semantic.refreshHint", { model: modelName })}</div>
                </div>
              </div>
            ` : null}
        ${isOllama && binaryFound && !daemonRunning ? html4`
              <div class="card">
                <div class="card-h"><span class="title">${t4("semantic.daemon")}</span></div>
                <div class="card-b" style="font-size:13px">
                  ${t4("semantic.daemonDesc")}
                  <div style="display:flex;gap:8px;margin-top:10px;align-items:center">
                    <button class="primary" disabled=${busy} onClick=${startDaemon}>${t4("semantic.startDaemon")}</button>
                    <span style="color:var(--fg-3);font-size:12px">${t4("semantic.runsOllama")}</span>
                  </div>
                </div>
              </div>
            ` : null}
        ${isOllama && daemonRunning && !modelPulled ? html4`
              <div class="card">
                <div class="card-h"><span class="title">${t4("semantic.model")}</span></div>
                <div class="card-b" style="font-size:13px">
                  ${t4("semantic.modelMissing", { model: modelName })}${pulling ? "" : ` ${t4("semantic.modelSize")}`}
                  <div style="display:flex;gap:8px;margin-top:10px">
                    <button class="primary" disabled=${busy || pulling} onClick=${() => pullModel(modelName)}>
                      ${pulling ? t4("semantic.pulling") : t4("semantic.pullModel", { model: modelName })}
                    </button>
                  </div>
                  ${pull ? html4`
                        <div style="margin-top:10px;display:flex;gap:10px;align-items:center;font-size:11.5px">
                          <span class=${`pill ${pull.status === "done" ? "ok" : pull.status === "error" ? "err" : ""}`}>${pull.status}</span>
                          <span style="color:var(--fg-3)">${((Date.now() - pull.startedAt) / 1e3).toFixed(1)}s</span>
                          ${pull.lastLine ? html4`<code class="mono" style="color:var(--fg-3)">${pull.lastLine}</code>` : null}
                        </div>
                      ` : null}
                </div>
              </div>
            ` : null}
        ${!isOllama ? html4`
              <div class="card">
                <div class="card-h"><span class="title">${t4("semantic.remoteProvider")}</span></div>
                <div class="card-b" style="font-size:13px;color:var(--fg-2)">
                  ${t4("semantic.remoteProviderDesc")}
                </div>
              </div>
            ` : null}

        ${job ? html4`
              ${sectionH3(t4("semantic.job"))}
              <${SemanticJobView} job=${job} running=${running} />
            ` : null}
      </div>

      <aside style="display:flex;flex-direction:column;gap:10px">
        <div class="card">
          <div class="card-h">
            <span class="title">${t4("semantic.indexStatus")}</span>
            <span class="meta">
              ${idx?.exists ? idx.compatible === false ? html4`<span class="pill warn">${t4("semantic.incompatibleStatus")}</span>` : html4`<span class="pill ok">${t4("semantic.builtStatus")}</span>` : html4`<span class="pill">${t4("system.none")}</span>`}
            </span>
          </div>
          ${idx?.exists ? html4`
                <div class="rail-kv"><span class="k">${t4("semantic.provider")}</span><span class="v">${idx.builtWith?.provider ?? idx.provider ?? provider}</span></div>
                <div class="rail-kv"><span class="k">${t4("semantic.chunks")}</span><span class="v">${fmtNum(idx.chunks)}</span></div>
                <div class="rail-kv"><span class="k">${t4("semantic.files")}</span><span class="v">${fmtNum(idx.files)}</span></div>
                <div class="rail-kv"><span class="k">知识文档</span><span class="v">${fmtNum(idx.knowledgeFiles || 0)} 个 · ${fmtNum(idx.knowledgeChunks || 0)} 片段</span></div>
                <div class="rail-kv"><span class="k">${t4("semantic.model")}</span><span class="v" style="font-size:11px">${idx.builtWith?.model ?? idx.model ?? modelName}</span></div>
                <div class="rail-kv"><span class="k">${t4("semantic.dim")}</span><span class="v">${fmtNum(idx.dim)}</span></div>
                <div class="rail-kv"><span class="k">${t4("semantic.size")}</span><span class="v">${fmtBytes(idx.sizeBytes)}</span></div>
                <div class="rail-kv"><span class="k">${t4("semantic.lastBuild")}</span><span class="v">${fmtRelativeTime(idx.lastBuiltMs ?? null)}</span></div>
                ${idx.compatible === false ? html4`
                      <div class="rail-kv"><span class="k">${t4("semantic.builtWith")}</span><span class="v" style="font-size:11px">${idx.builtWith?.provider} · ${idx.builtWith?.model}</span></div>
                      <div class="rail-kv"><span class="k">${t4("semantic.currentTarget")}</span><span class="v" style="font-size:11px">${idx.current?.provider} · ${idx.current?.model}</span></div>
                      <div style="color:var(--c-warn);font-size:12px;padding-top:8px">${t4("semantic.incompatibleHint")}</div>
                    ` : null}
              ` : html4`<div style="color:var(--fg-3);font-size:12.5px;padding:6px 0">${t4("semantic.runIndexHint")}</div>`}
          <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">
            <button class="primary" disabled=${busy || running || !ready || semanticDraftBlocked} onClick=${() => start(false)}>${indexReady ? t4("semantic.reIndex") : t4("semantic.build")}</button>
            ${idx?.exists ? html4`<button disabled=${busy || running || !ready || semanticDraftBlocked} onClick=${() => start(true)}>${t4("semantic.rebuild")}</button>` : null}
            ${running ? html4`<button onClick=${stop} style="border-color:var(--c-err);color:var(--c-err)">${t4("semantic.stop")}</button>` : null}
          </div>
        </div>

        <div class="card">
          <div class="card-h"><span class="title">${isOllama ? t4("semantic.ollama") : t4("semantic.openaiCompat")}</span></div>
          ${isOllama ? html4`
                <div class="rail-kv"><span class="k">${t4("semantic.binary")}</span><span class="v">${binaryFound ? html4`<span class="pill ok">${t4("semantic.found")}</span>` : html4`<span class="pill err">${t4("semantic.missing")}</span>`}</span></div>
                <div class="rail-kv"><span class="k">${t4("semantic.daemonStatus")}</span><span class="v">${daemonRunning ? html4`<span class="pill ok">${t4("semantic.up")}</span>` : html4`<span class="pill warn">${t4("semantic.down")}</span>`}</span></div>
                <div class="rail-kv"><span class="k">${t4("semantic.model")}</span><span class="v">${modelPulled ? html4`<span class="pill ok">${t4("semantic.pulled")}</span>` : html4`<span class="pill warn">${t4("semantic.missing")}</span>`}</span></div>
              ` : html4`
                <div class="rail-kv"><span class="k">${t4("semantic.apiUrl")}</span><span class="v" style="font-size:11px;max-width:160px;overflow-wrap:anywhere;word-break:break-word;text-align:right">${remote?.baseUrl ?? draft.openaiCompat.baseUrl}</span></div>
                <div class="rail-kv"><span class="k">${t4("semantic.apiKey")}</span><span class="v">${remote?.apiKeySet ? html4`<span class="pill ok">${t4("semantic.found")}</span>` : html4`<span class="pill warn">${t4("semantic.missing")}</span>`}</span></div>
                <div class="rail-kv"><span class="k">${t4("semantic.model")}</span><span class="v" style="font-size:11px">${remote?.model ?? draft.openaiCompat.model}</span></div>
                <div class="rail-kv"><span class="k">${t4("semantic.extraBody")}</span><span class="v">${fmtNum(remote?.extraBodyKeys.length ?? 0)}</span></div>
              `}
        </div>

        <${SemanticExcludesCard} />
      </aside>
    </div>
  `;
}
function toConfigDraft(config) {
  return {
    provider: config.provider,
    ollama: {
      baseUrl: config.ollama.baseUrl,
      model: config.ollama.model
    },
    openaiCompat: {
      baseUrl: config.openaiCompat.baseUrl,
      apiKey: "",
      model: config.openaiCompat.model,
      extraBodyText: JSON.stringify(config.openaiCompat.extraBody ?? {}, null, 2),
      apiKeySet: config.openaiCompat.apiKeySet
    }
  };
}
function validateSemanticDraft(draft) {
  if (draft.provider !== "openai-compat") {
    return { extraBody: {}, error: null };
  }
  const raw = draft.openaiCompat.extraBodyText.trim();
  if (!raw) {
    return { extraBody: {}, error: null };
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return {
      extraBody: {},
      error: t4("semantic.invalidCustomRequestBody", { error: err.message })
    };
  }
  if (!isPlainObject(parsed)) {
    return { extraBody: {}, error: t4("semantic.customRequestBodyMustBeObject") };
  }
  return { extraBody: parsed, error: null };
}
function SemanticSearchSection() {
  useLang();
  const [query2, setQuery] = d2("");
  const [hits, setHits] = d2(null);
  const [meta, setMeta] = d2(null);
  const [busy, setBusy] = d2(false);
  const [error, setError] = d2(null);
  const runSearch = q2(async () => {
    const q4 = query2.trim();
    if (!q4 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r3 = await api("/semantic/search", {
        method: "POST",
        body: { query: q4, topK: 8, minScore: 0.3 }
      });
      setHits(r3.hits);
      setMeta({ elapsedMs: r3.elapsedMs, model: r3.model });
    } catch (err) {
      setError(err.message);
      setHits(null);
    } finally {
      setBusy(false);
    }
  }, [query2, busy]);
  return html4`
    <div style="margin-bottom:14px">
      <div style="position:relative">
        <div style="position:absolute;left:14px;top:50%;transform:translateY(-50%);color:var(--c-brand);font-family:var(--font-mono);font-size:14px;pointer-events:none">≈</div>
        <input
          type="text"
          class="mono"
          style="width:100%;padding:10px 14px 10px 38px;font-size:13.5px;background:var(--bg-input);border:1px solid var(--bd);border-radius:var(--r);color:var(--fg-0);outline:none"
          placeholder=${t4("semantic.searchPlaceholder")}
          value=${query2}
          disabled=${busy}
          onInput=${(e3) => setQuery(e3.target.value)}
          onKeyDown=${(e3) => {
    if (e3.key === "Enter") {
      e3.preventDefault();
      runSearch();
    }
  }}
        />
      </div>
      ${hits || busy || error ? html4`
            <div style="font-family:var(--font-mono);font-size:11px;color:var(--fg-3);margin:8px 0 6px;display:flex;align-items:center;gap:8px">
              ${busy ? html4`<span>${t4("semantic.searching")}</span>` : error ? html4`<span style="color:var(--c-err)">${error}</span>` : hits ? html4`<span>${t4("semantic.results", { count: hits.length, s: hits.length === 1 ? "" : "s", ms: meta?.elapsedMs ?? 0, model: meta?.model ?? "" })}</span>` : null}
            </div>
            ${hits && hits.length > 0 ? html4`
                  <div class="card" style="padding:0;max-height:420px;overflow-y:auto">
                    ${hits.map(
    (h3) => html4`
                        <div class="sr-card">
                          <div class="sr-h">
                            <span class="sr-path">${h3.path}</span>
                            <span class="sr-loc">L${h3.startLine} – L${h3.endLine}</span>
                            <span class="sr-score">${h3.score.toFixed(3)}</span>
                          </div>
                          <div class="sr-snip">${truncateSnippet(h3.snippet)}</div>
                        </div>
                      `
  )}
                  </div>
                ` : hits && hits.length === 0 && !busy ? html4`<div class="card" style="color:var(--fg-3);font-size:12px">${t4("semantic.noMatches")}</div>` : null}
          ` : null}
    </div>
  `;
}
function truncateSnippet(text, maxLines = 8) {
  const lines = text.split("\n");
  if (lines.length <= maxLines) return text;
  return `${lines.slice(0, maxLines).join("\n")}
  …(${lines.length - maxLines} more lines)`;
}
function toDraft(c3) {
  return {
    excludeDirs: c3.excludeDirs ?? [],
    excludeFiles: c3.excludeFiles ?? [],
    excludeExts: c3.excludeExts ?? [],
    excludePatterns: c3.excludePatterns ?? [],
    respectGitignore: c3.respectGitignore !== false,
    includeKnowledgeDocs: c3.includeKnowledgeDocs === true,
    maxFileBytes: c3.maxFileBytes ?? 262144
  };
}
function fromDraft(d3) {
  return {
    excludeDirs: d3.excludeDirs,
    excludeFiles: d3.excludeFiles,
    excludeExts: d3.excludeExts,
    excludePatterns: d3.excludePatterns,
    respectGitignore: !!d3.respectGitignore,
    includeKnowledgeDocs: !!d3.includeKnowledgeDocs,
    maxFileBytes: d3.maxFileBytes
  };
}
function SemanticExcludesCard() {
  useLang();
  const [data, setData] = d2(null);
  const [draft, setDraft] = d2(null);
  const [preview, setPreview] = d2(null);
  const [busy, setBusy] = d2(false);
  const [error, setError] = d2(null);
  const [info, setInfo] = d2(null);
  const load = q2(async () => {
    try {
      const r3 = await api("/index-config");
      setData(r3);
      setDraft(toDraft(r3.resolved));
    } catch (err) {
      setError(err.message);
    }
  }, []);
  y2(() => {
    load();
  }, [load]);
  const reset = q2(() => {
    if (data) setDraft(toDraft(data.defaults));
    setPreview(null);
  }, [data]);
  const save = q2(async () => {
    if (!draft) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const payload = fromDraft(draft);
      const r3 = await api("/index-config", {
        method: "POST",
        body: payload
      });
      setInfo(t4("semantic.savedConfig", { count: r3.changed.length || 0 }));
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [draft, load]);
  const runPreview = q2(async () => {
    if (!draft) return;
    setBusy(true);
    setError(null);
    setInfo(t4("semantic.runningPreview"));
    try {
      const payload = fromDraft(draft);
      const r3 = await api("/index-config/preview", {
        method: "POST",
        body: payload
      });
      setPreview(r3);
      setInfo(null);
    } catch (err) {
      setError(err.message);
      setInfo(null);
    } finally {
      setBusy(false);
    }
  }, [draft]);
  if (!draft) {
    return html4`
      <div class="card">
        <div class="card-h"><span class="title">${t4("semantic.indexConfig")}</span></div>
        <div style="color:var(--fg-3);font-size:12.5px">${t4("common.loading")}</div>
      </div>
    `;
  }
  return html4`
    <div class="card">
      <div class="card-h">
        <span class="title">${t4("semantic.indexConfig")}</span>
        <span class="meta">
          <a class="mono" style="color:var(--c-brand);text-decoration:none;font-size:11px;cursor:pointer" onClick=${reset}>${t4("semantic.reset")}</a>
        </span>
      </div>
      ${info ? html4`<div style="margin-bottom:8px"><span class="pill ok">${info}</span></div>` : null}
      ${error ? html4`<div class="card accent-err" style="margin-bottom:8px">${error}</div>` : null}

      <${ChipFormRow}
        label=${t4("semantic.excludeDirs")}
        value=${draft.excludeDirs}
        onChange=${(v3) => setDraft({ ...draft, excludeDirs: v3 })}
        placeholder="dist"
      />
      <${ChipFormRow}
        label=${t4("semantic.excludeFiles")}
        value=${draft.excludeFiles}
        onChange=${(v3) => setDraft({ ...draft, excludeFiles: v3 })}
        placeholder="package-lock.json"
      />
      <${ChipFormRow}
        label=${t4("semantic.excludeExts")}
        value=${draft.excludeExts}
        onChange=${(v3) => setDraft({ ...draft, excludeExts: v3 })}
        placeholder=".lock"
      />
      <${ChipFormRow}
        label=${t4("semantic.excludePatterns")}
        sub=${t4("semantic.glob")}
        value=${draft.excludePatterns}
        onChange=${(v3) => setDraft({ ...draft, excludePatterns: v3 })}
        placeholder="**/*.test.ts"
      />

      <div class="checkbox-row" style="margin-top:8px;cursor:pointer" onClick=${() => setDraft({ ...draft, respectGitignore: !draft.respectGitignore })}>
        <span class=${`box ${draft.respectGitignore ? "on" : ""}`}>${draft.respectGitignore ? "✓" : ""}</span>
        <span>${t4("semantic.respectGitignore")}</span>
      </div>

      <div class="checkbox-row" style="margin-top:8px;cursor:pointer" onClick=${() => setDraft({ ...draft, includeKnowledgeDocs: !draft.includeKnowledgeDocs })}>
        <span class=${`box ${draft.includeKnowledgeDocs ? "on" : ""}`}>${draft.includeKnowledgeDocs ? "✓" : ""}</span>
        <span>${t4("semantic.includeKnowledgeDocs")}</span>
      </div>

      <div class="form-row" style="margin-top:10px">
        <span class="lbl">${t4("semantic.maxFileBytes")}</span>
        <input
          class="input mono"
          type="number"
          min="1024"
          step="1024"
          value=${draft.maxFileBytes}
          onInput=${(e3) => setDraft({ ...draft, maxFileBytes: Number(e3.target.value) || 0 })}
          style="font-size:12px"
        />
        <span class="help">${t4("semantic.skipLarger", { size: (draft.maxFileBytes / 1024 / 1024).toFixed(1) })}</span>
      </div>

      <div style="display:flex;gap:6px;margin-top:10px">
        <button class="btn ghost" style="flex:1" disabled=${busy} onClick=${runPreview}><span class="g">⊕</span><span>${t4("semantic.preview")}</span></button>
        <button class="btn primary" style="flex:1" disabled=${busy} onClick=${save}>${t4("common.save")}</button>
      </div>

      ${preview ? html4`<div style="margin-top:10px"><${ExcludesPreview} preview=${preview} /></div>` : null}
    </div>
  `;
}
function ExcludesPreview({ preview }) {
  useLang();
  const buckets = preview.skipBuckets || {};
  const samples = preview.skipSamples || {};
  const totalSkipped = Object.values(buckets).reduce((a3, b22) => a3 + (b22 || 0), 0);
  const reasons = [
    "gitignore",
    "pattern",
    "defaultDir",
    "defaultFile",
    "binaryExt",
    "binaryContent",
    "tooLarge",
    "readError"
  ].filter((k32) => (buckets[k32] || 0) > 0);
  return html4`
    <div class="excludes-preview">
      <div class="summary">${t4("semantic.previewSummary", { included: preview.filesIncluded, skipped: totalSkipped })}</div>
      ${reasons.length === 0 ? html4`<div style="color:var(--fg-3)">${t4("semantic.nothingSkipped")}</div>` : reasons.map(
    (r3) => html4`
              <details>
                <summary><strong>${r3}: ${buckets[r3]}</strong></summary>
                <ul>
                  ${(samples[r3] || []).map((p3) => html4`<li><code>${p3}</code></li>`)}
                  ${(buckets[r3] || 0) > (samples[r3] || []).length ? html4`<li style="color:var(--fg-3)">…${(buckets[r3] || 0) - (samples[r3] || []).length} more</li>` : null}
                </ul>
              </details>
            `
  )}
      ${preview.sampleIncluded?.length ? html4`
            <details>
              <summary>${t4("semantic.firstIncluded", { count: preview.sampleIncluded.length })}</summary>
              <ul>
                ${preview.sampleIncluded.map((p3) => html4`<li><code>${p3}</code></li>`)}
              </ul>
            </details>
          ` : null}
    </div>
  `;
}
function ChipFormRow({
  label,
  sub,
  value,
  onChange,
  placeholder = "+ add"
}) {
  const [adding, setAdding] = d2("");
  const remove = (entry) => onChange(value.filter((v3) => v3 !== entry));
  const commit = () => {
    const trimmed = adding.trim();
    if (!trimmed || value.includes(trimmed)) {
      setAdding("");
      return;
    }
    onChange([...value, trimmed]);
    setAdding("");
  };
  return html4`
    <div class="form-row">
      <span class="lbl">${label}${sub ? html4`<span style="color:var(--fg-3);font-weight:400;text-transform:none;letter-spacing:0"> · ${sub}</span>` : null}</span>
      <div style="display:flex;flex-wrap:wrap;gap:4px">
        ${value.map(
    (e3) => html4`
            <span class="chip-f static">
              <span>${e3}</span>
              <span class="x" style="cursor:pointer" onClick=${() => remove(e3)} title="remove">×</span>
            </span>
          `
  )}
        <input
          type="text"
          class="chip-add-input"
          value=${adding}
          placeholder=${placeholder}
          onInput=${(ev) => setAdding(ev.target.value)}
          onKeyDown=${(ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      commit();
    }
  }}
          onBlur=${commit}
        />
      </div>
    </div>
  `;
}
function SemanticJobView({ job, running }) {
  useLang();
  const phaseLabel = {
    setup: t4("semantic.phaseSetup"),
    scan: t4("semantic.phaseScan"),
    embed: t4("semantic.phaseEmbed"),
    write: t4("semantic.phaseWrite"),
    done: t4("semantic.phaseDone"),
    partial: t4("semantic.phasePartial"),
    error: t4("semantic.phaseError"),
    cancelled: t4("semantic.phaseCancelled")
  }[job.phase] ?? job.phase;
  const total = job.chunksTotal ?? 0;
  const doneN = job.chunksDone ?? 0;
  const ratio = total > 0 ? Math.min(1, doneN / total) : 0;
  const elapsedBase = job.finishedAt ?? Date.now();
  const elapsedSeconds = (elapsedBase - job.startedAt) / 1e3;
  const elapsed = elapsedSeconds < 0.1 ? "<0.1s" : `${elapsedSeconds.toFixed(1)}s`;
  const phaseSummary = job.phase === "error" && job.lastPhase === "setup" ? t4("semantic.setupFailed") : phaseLabel;
  return html4`
    <div class="kv">
      <div><span class="kv-key">phase</span>
        <span class=${`pill ${job.phase === "error" ? "pill-err" : job.phase === "cancelled" || job.phase === "partial" ? "warn" : running ? "pill-active" : "pill-dim"}`}>${phaseSummary}</span>
        ${job.aborted && running ? html4`<span class="pill warn" style="margin-left: 6px;">${t4("semantic.stopping")}</span>` : null}
        <span style="color:var(--fg-3);margin-left:8px">${elapsed}</span>
      </div>
      ${job.filesScanned !== null && job.filesScanned !== void 0 ? html4`<div><span class="kv-key">${t4("semantic.files")}</span>${t4("semantic.scanned", { count: job.filesScanned })}${job.filesChanged != null ? ` · ${t4("semantic.changed", { count: job.filesChanged })}` : ""}${job.filesSkipped ? ` · ${t4("semantic.skipped", { count: job.filesSkipped })}` : ""}</div>` : null}
      ${total > 0 ? html4`
            <div>
              <span class="kv-key">${t4("semantic.chunks")}</span>${t4("semantic.chunksProgress", { done: doneN, total, pct: (ratio * 100).toFixed(0) })}
            </div>
            <div class="bar" style="margin-top: 4px;">
              <div class="fill" style=${`width: ${(ratio * 100).toFixed(1)}%; background: var(--primary);`}></div>
            </div>
          ` : null}
      ${job.error ? html4`<div><span class="kv-key">${t4("semantic.phaseError")}</span><span class="err">${job.error}</span></div>` : null}
      ${job.result ? html4`<div><span class="kv-key">${t4("semantic.result")}</span>${t4("semantic.added", { count: job.result.chunksAdded })} · ${t4("semantic.removed", { count: job.result.chunksRemoved })}${job.result.chunksSkipped ? ` · ${t4("semantic.failed", { count: job.result.chunksSkipped })}` : ""} · ${(job.result.durationMs / 1e3).toFixed(1)}s</div>` : null}
      ${job.result?.skipBuckets ? html4`<${SkipBucketsView} buckets=${job.result.skipBuckets} />` : null}
    </div>
  `;
}
function SkipBucketsView({ buckets }) {
  useLang();
  const order = [
    ["gitignore", "gitignore"],
    ["pattern", "pattern"],
    ["defaultDir", "defaultDir"],
    ["defaultFile", "defaultFile"],
    ["binaryExt", "binaryExt"],
    ["binaryContent", "binaryContent"],
    ["tooLarge", "tooLarge"],
    ["readError", "readError"]
  ];
  const total = order.reduce((a3, [k32]) => a3 + (buckets[k32] || 0), 0);
  if (total === 0) return null;
  const parts = order.filter(([k32]) => (buckets[k32] || 0) > 0).map(([k32, label]) => `${label}: ${buckets[k32]}`);
  return html4`<div><span class="kv-key">${t4("semantic.skipped")}</span>${t4("semantic.skippedFiles", { total, details: parts.join(", ") })}</div>`;
}
function isActiveSemanticPhase(phase) {
  return phase === "setup" || phase === "scan" || phase === "embed" || phase === "write";
}
function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

// dashboard/src/panels/sessions.ts
var N28 = N2;
function SessionsPanel({ userAvatar = null } = {}) {
  useLang();
  const { data, error, loading, refresh } = usePoll("/sessions", 3e4);
  const [open, setOpen] = d2(null);
  const [openLoading, setOpenLoading] = d2(false);
  const [filter, setFilter] = d2("");
  const [selectedNames, setSelectedNames] = d2(() => /* @__PURE__ */ new Set());
  const [selectedTrashIds, setSelectedTrashIds] = d2(() => /* @__PURE__ */ new Set());
  const [listMode, setListMode] = d2("sessions");
  const [selectionMode, setSelectionMode] = d2(false);
  const [restoreName, setRestoreName] = d2("");
  const [skipTrashConfirm, setSkipTrashConfirm] = d2(() => {
    try {
      return localStorage.getItem("visionox.sessions.skipTrashConfirm") === "1";
    } catch {
      return false;
    }
  });
  const [trashConfirm, setTrashConfirm] = d2(null);
  const [dontAskAgain, setDontAskAgain] = d2(false);
  const [retentionDraft, setRetentionDraft] = d2(30);
  const [deleting, setDeleting] = d2(false);
  const [resuming, setResuming] = d2(false);
  const [info, setInfo] = d2(null);
  const [transcriptSearch, setTranscriptSearch] = d2("");
  const [transcriptSearchIndex, setTranscriptSearchIndex] = d2(0);
  const transcriptFeedRef = A2(null);
  const detailRequestRef = A2(0);
  const closeDetail = q2(() => {
    detailRequestRef.current++;
    setOpen(null);
    setOpenLoading(false);
  }, []);
  y2(() => {
    if (!trashConfirm) return;
    const onKeyDown = (event) => {
      if (event.key === "Escape" && !deleting) setTrashConfirm(null);
    };
    document.addEventListener("keydown", onKeyDown);
    const frame = requestAnimationFrame(() => document.querySelector(".session-confirm-card .modal-actions .primary")?.focus());
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      cancelAnimationFrame(frame);
    };
  }, [trashConfirm, deleting]);
  y2(() => subscribeSse("sessions-changed", refresh), [refresh]);
  y2(() => {
    if (Number.isFinite(data?.trash?.retentionDays)) setRetentionDraft(data.trash.retentionDays);
  }, [data?.trash?.retentionDays]);
  y2(() => {
    const sessionNames = new Set((data?.sessions ?? []).map((item) => item.name));
    const trashIds = new Set((data?.trash?.items ?? []).map((item) => item.id));
    setSelectedNames((current) => new Set([...current].filter((name) => sessionNames.has(name))));
    setSelectedTrashIds((current) => new Set([...current].filter((id) => trashIds.has(id))));
  }, [data]);
  const view = q2(async (name) => {
    const requestId = ++detailRequestRef.current;
    setInfo(null);
    setTranscriptSearch("");
    setTranscriptSearchIndex(0);
    setOpen({ kind: "session", name, messages: null });
    setOpenLoading(true);
    try {
      const detail = await api(`/sessions/${encodeURIComponent(name)}?limit=200`);
      if (requestId !== detailRequestRef.current) return;
      setOpen({
        kind: "session",
        name,
        messages: detail.messages,
        totalMessages: detail.totalMessages ?? detail.messageCount ?? detail.messages?.length ?? 0,
        hasMore: Boolean(detail.hasMore),
        mode: detail.mode ?? null,
        modeLabel: detail.modeLabel ?? null,
        modeDescription: detail.modeDescription ?? "",
        meta: detail.meta ?? {},
        invalidRecords: detail.invalidRecords ?? 0,
        invalidLines: detail.invalidLines ?? [],
        integrityWarning: detail.integrityWarning ?? null
      });
    } catch (err) {
      if (requestId !== detailRequestRef.current) return;
      setOpen({ kind: "session", name, messages: null, error: err.message });
    } finally {
      if (requestId === detailRequestRef.current) setOpenLoading(false);
    }
  }, []);
  const executeTrash = q2(async (names) => {
    if (names.length === 0) return;
    setDeleting(true);
    setInfo(null);
    try {
      const result = { movedCount: 0, failedCount: 0 };
      for (let offset = 0; offset < names.length; offset += 200) {
        const part = await api("/sessions/batch-trash", { method: "POST", body: { names: names.slice(offset, offset + 200) } });
        result.movedCount += part.movedCount || 0;
        result.failedCount += part.failedCount || 0;
      }
      setSelectedNames(/* @__PURE__ */ new Set());
      if (open && names.includes(open.name)) closeDetail();
      setInfo(`已移入回收站 ${result.movedCount || 0} 个，失败 ${result.failedCount || 0} 个。`);
      await refresh();
    } catch (err) {
      setInfo(err.message);
    } finally {
      setDeleting(false);
    }
  }, [open, refresh, closeDetail]);
  const requestTrash = q2((names) => {
    if (names.length === 0) return;
    if (skipTrashConfirm) {
      void executeTrash(names);
      return;
    }
    setDontAskAgain(false);
    setTrashConfirm({ names });
  }, [skipTrashConfirm, executeTrash]);
  const confirmTrash = q2(() => {
    const names = trashConfirm?.names ?? [];
    if (dontAskAgain) {
      try {
        localStorage.setItem("visionox.sessions.skipTrashConfirm", "1");
      } catch {
      }
      setSkipTrashConfirm(true);
    }
    setTrashConfirm(null);
    void executeTrash(names);
  }, [trashConfirm, dontAskAgain, executeTrash]);
  const restoreTrashConfirmation = q2(() => {
    try {
      localStorage.removeItem("visionox.sessions.skipTrashConfirm");
    } catch {
    }
    setSkipTrashConfirm(false);
    setInfo("删除确认已恢复。");
  }, []);
  const remove = q2((name) => requestTrash([name]), [requestTrash]);
  const toggleSelectedSession = q2((name) => {
    setSelectedNames((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);
  const toggleSelectedTrash = q2((id) => {
    setSelectedTrashIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const viewTrash = q2(async (item) => {
    const requestId = ++detailRequestRef.current;
    setInfo(null);
    setRestoreName(item.name);
    setOpen({ kind: "trash", id: item.id, name: item.name, messages: null });
    setOpenLoading(true);
    try {
      const detail = await api(`/sessions/trash/${encodeURIComponent(item.id)}?limit=200`);
      if (requestId !== detailRequestRef.current) return;
      setOpen({ kind: "trash", ...detail, id: item.id, name: detail.name ?? item.name });
      setRestoreName(detail.name ?? item.name);
    } catch (err) {
      if (requestId !== detailRequestRef.current) return;
      setOpen({ kind: "trash", id: item.id, name: item.name, messages: null, error: err.message });
    } finally {
      if (requestId === detailRequestRef.current) setOpenLoading(false);
    }
  }, []);
  const batchTrash = q2(async () => {
    const names = [...selectedNames];
    requestTrash(names);
  }, [selectedNames, requestTrash]);
  const restoreTrashSession = q2(async (id, newName = null) => {
    setDeleting(true);
    setInfo(null);
    try {
      await api(`/sessions/trash/${encodeURIComponent(id)}/restore`, { method: "POST", body: { newName } });
      setInfo("会话已从回收站恢复。");
      setSelectedTrashIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      if (open?.kind === "trash" && open.id === id) closeDetail();
      await refresh();
    } catch (err) {
      setInfo(err.message);
    } finally {
      setDeleting(false);
    }
  }, [open, refresh, closeDetail]);
  const batchRestoreTrash = q2(async () => {
    const ids = [...selectedTrashIds];
    if (ids.length === 0) return;
    setDeleting(true);
    setInfo(null);
    try {
      const result = { restoredCount: 0, failedCount: 0 };
      for (let offset = 0; offset < ids.length; offset += 200) {
        const part = await api("/sessions/trash/batch-restore", { method: "POST", body: { items: ids.slice(offset, offset + 200).map((id) => ({ id })) } });
        result.restoredCount += part.restoredCount || 0;
        result.failedCount += part.failedCount || 0;
      }
      setSelectedTrashIds(/* @__PURE__ */ new Set());
      if (open?.kind === "trash" && ids.includes(open.id)) closeDetail();
      setInfo(`已恢复 ${result.restoredCount || 0} 个，失败 ${result.failedCount || 0} 个。名称冲突的会话可打开预览后改名恢复。`);
      await refresh();
    } catch (err) {
      setInfo(err.message);
    } finally {
      setDeleting(false);
    }
  }, [selectedTrashIds, open, refresh, closeDetail]);
  const permanentlyDeleteTrash = q2(async (ids) => {
    if (ids.length === 0 || !confirm(`永久删除 ${ids.length} 个回收站会话？此操作无法撤销。`)) return;
    setDeleting(true);
    setInfo(null);
    try {
      const result = await api("/sessions/trash/batch", { method: "DELETE", body: { ids } });
      setSelectedTrashIds(/* @__PURE__ */ new Set());
      if (open?.kind === "trash" && ids.includes(open.id)) closeDetail();
      setInfo(`已永久删除 ${result.deletedCount || 0} 个，失败 ${result.failedCount || 0} 个。`);
      await refresh();
    } catch (err) {
      setInfo(err.message);
    } finally {
      setDeleting(false);
    }
  }, [open, refresh, closeDetail]);
  const saveTrashRetention = q2(async () => {
    const retentionDays = Math.max(1, Math.min(365, Number(retentionDraft) || 30));
    setDeleting(true);
    try {
      const result = await api("/sessions/trash-retention", { method: "POST", body: { retentionDays } });
      setRetentionDraft(result.retentionDays);
      setInfo(`回收站文件将在 ${result.retentionDays} 天后自动删除。`);
      await refresh();
    } catch (err) {
      setInfo(err.message);
    } finally {
      setDeleting(false);
    }
  }, [retentionDraft, refresh]);
  const exportSession = q2(async (name) => {
    setInfo(null);
    try {
      const res = await api(`/sessions/${encodeURIComponent(name)}/export`, { method: "POST", body: {} });
      setInfo(res.invalidRecords > 0 ? `${t4("sessions.exported", { path: res.path || res.filename || name })} ${res.integrityWarning || `已跳过 ${res.invalidRecords} 条无法解析的记录。`}` : t4("sessions.exported", { path: res.path || res.filename || name }));
    } catch (err) {
      setInfo(t4("sessions.exportFailed", { error: err.message }));
    }
  }, []);
  const loadEarlierTranscript = q2(async () => {
    if (!open?.name || !open?.hasMore || openLoading) return;
    setOpenLoading(true);
    try {
      const offset = open.messages?.length ?? 0;
      const path = open.kind === "trash" ? `/sessions/trash/${encodeURIComponent(open.id)}?limit=200&offset=${offset}` : `/sessions/${encodeURIComponent(open.name)}?limit=200&offset=${offset}`;
      const detail = await api(path);
      setOpen((current) => current?.name === open.name && current?.kind === open.kind ? {
        ...current,
        messages: [...detail.messages ?? [], ...current.messages ?? []],
        totalMessages: detail.totalMessages ?? current.totalMessages,
        hasMore: Boolean(detail.hasMore),
        invalidRecords: detail.invalidRecords ?? current.invalidRecords ?? 0,
        invalidLines: detail.invalidLines ?? current.invalidLines ?? [],
        integrityWarning: detail.integrityWarning ?? current.integrityWarning ?? null,
        error: null
      } : current);
    } catch (err) {
      setOpen((current) => current ? { ...current, error: err.message } : current);
    } finally {
      setOpenLoading(false);
    }
  }, [open, openLoading]);
  const doResume = q2(async (name) => {
    setResuming(true);
    try {
      let currentMessages = 0;
      let currentBusy = false;
      try {
        const cur = await api("/messages");
        currentMessages = cur.totalMessages ?? cur.messages?.length ?? 0;
        currentBusy = Boolean(cur.busy);
      } catch {
      }
      let draftCount = 0;
      try {
        for (let i3 = 0; i3 < localStorage.length; i3++) {
          const key = localStorage.key(i3) || "";
          if ((key === CHAT_DRAFT_KEY || key.startsWith("visionox.chatDraft.v2:")) && (localStorage.getItem(key) || "").trim()) {
            draftCount++;
          }
        }
      } catch {
      }
      if ((currentMessages > 0 || currentBusy || draftCount > 0) && !confirm(t4("sessions.resumeConfirm", {
        messages: currentMessages,
        busy: String(currentBusy),
        drafts: draftCount
      }))) {
        return;
      }
      await api("/submit", { method: "POST", body: { prompt: "", session: name } });
      appBus.dispatchEvent(new CustomEvent("navigate-tab", { detail: { tabId: "chat" } }));
      closeDetail();
    } catch (err) {
      if (open) setOpen({ ...open, error: err.message });
    } finally {
      setResuming(false);
    }
  }, [open, closeDetail]);
  const [renaming, setRenaming] = d2(false);
  const [renameText, setRenameText] = d2("");
  const [renameBusy, setRenameBusy] = d2(false);
  const startRename = q2(() => {
    if (!open) return;
    setRenameText(open.name);
    setRenaming(true);
  }, [open]);
  const cancelRename = q2(() => {
    setRenaming(false);
    setRenameText("");
  }, []);
  const doRename = q2(async () => {
    if (!open || !renameText.trim()) return;
    const oldName = open.name;
    const newName = renameText.trim();
    if (newName === oldName) {
      setRenaming(false);
      return;
    }
    setRenameBusy(true);
    try {
      const res = await api(`/sessions/${encodeURIComponent(oldName)}/rename`, {
        method: "POST",
        body: { newName }
      });
      setRenaming(false);
      setRenameText("");
      if (res.newName) await view(res.newName);
    } catch (err) {
      if (open) setOpen({ ...open, error: t4("sessions.renameFailed", { error: err.message }) });
    } finally {
      setRenameBusy(false);
    }
  }, [open, renameText]);
  const detailChatMessages = $2(() => (open?.messages ?? []).map((m3, i3) => ({
    id: `r-${i3}`,
    role: m3.role === "tool" ? "tool" : m3.role === "assistant" ? "assistant" : m3.role === "user" ? "user" : "info",
    text: m3.content ?? "",
    toolName: m3.toolName
  })), [open?.messages]);
  const transcriptMatches = $2(() => computeChatSearchMatches(detailChatMessages, transcriptSearch), [detailChatMessages, transcriptSearch]);
  y2(() => {
    setTranscriptSearchIndex((cur) => transcriptMatches.length ? Math.min(Math.max(cur, 0), transcriptMatches.length - 1) : 0);
  }, [transcriptSearch, transcriptMatches.length]);
  y2(() => {
    if (!transcriptSearch.trim() || transcriptMatches.length === 0) return;
    const match = transcriptMatches[Math.min(transcriptSearchIndex, transcriptMatches.length - 1)];
    const el = transcriptFeedRef.current?.querySelector(`[data-msg-index="${match.index}"]`);
    if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [transcriptSearch, transcriptSearchIndex, transcriptMatches.length]);
  if (loading && !data)
    return html4`<div class="card" style="color:var(--fg-3)">${t4("sessions.loading")}</div>`;
  if (error) return html4`<div class="card accent-err">${t4("common.loadingFailed", { name: "sessions", error: error.message })}</div>`;
  const sessions = data?.sessions ?? [];
  const query = filter.trim().toLowerCase();
  const filtered = query ? sessions.filter((s3) => [
    s3.name,
    s3.summary,
    s3.searchText,
    s3.modeLabel,
    s3.mode,
    s3.meta?.workspace
  ].filter(Boolean).join(" ").toLowerCase().includes(query)) : sessions;
  const trashItems = data?.trash?.items ?? [];
  const filteredTrash = query ? trashItems.filter((item) => item.name.toLowerCase().includes(query)) : trashItems;
  const allFilteredSelected = filtered.length > 0 && filtered.every((session) => selectedNames.has(session.name));
  const allFilteredTrashSelected = filteredTrash.length > 0 && filteredTrash.every((item) => selectedTrashIds.has(item.id));
  return html4`
    <div class="sessions-grid">
      ${trashConfirm ? html4`<div class="session-confirm-overlay" role="presentation" onClick=${() => setTrashConfirm(null)}><div class="modal-card session-confirm-card" role="dialog" aria-modal="true" aria-labelledby="session-trash-confirm-title" onClick=${(event) => event.stopPropagation()}><div class="modal-card-head"><span class="modal-card-icon" style="color:var(--c-warn)">!</span><div><div class="modal-card-title" id="session-trash-confirm-title">移入回收站</div><div class="modal-card-subtitle">${trashConfirm.names.length === 1 ? `确认将“${trashConfirm.names[0]}”移入回收站？` : `确认将选中的 ${trashConfirm.names.length} 个会话移入回收站？`} 保留期内可以恢复。</div></div></div><label class="checkbox-row"><input type="checkbox" checked=${dontAskAgain} onChange=${(event) => setDontAskAgain(event.target.checked)} /><span>下次不再提示</span></label><div class="modal-actions"><button class="primary" disabled=${deleting} onClick=${confirmTrash}>移入回收站</button><button disabled=${deleting} onClick=${() => setTrashConfirm(null)}>取消</button></div></div></div>` : null}
      ${info ? html4`<div class="card accent-brand session-page-feedback" role="status">${info}</div>` : null}
      <div class="sessions-list">
        <div class="session-list-tabs">
          <button class=${listMode === "sessions" ? "active" : ""} onClick=${() => {
    setListMode("sessions");
    setSelectionMode(false);
    closeDetail();
  }}>会话 <span>${sessions.length}</span></button>
          <button class=${listMode === "trash" ? "active" : ""} onClick=${() => {
    setListMode("trash");
    setSelectionMode(false);
    closeDetail();
  }}>回收站 <span>${trashItems.length}</span></button>
        </div>
        <div class="ssl-h">
          <input
            type="text"
            placeholder=${t4("sessions.filterPlaceholder")}
            value=${filter}
            onInput=${(e3) => setFilter(e3.target.value)}
            style="flex:1"
          />
          <button class=${`btn btn-sm ${selectionMode ? "primary" : ""}`} onClick=${() => {
    setSelectionMode((value) => !value);
    setSelectedNames(/* @__PURE__ */ new Set());
    setSelectedTrashIds(/* @__PURE__ */ new Set());
  }}>${selectionMode ? "退出批量" : "批量管理"}</button>
        </div>
        ${listMode === "trash" ? html4`<div class="session-trash-settings"><span>自动清理</span><select value=${retentionDraft} onChange=${(event) => setRetentionDraft(Number(event.target.value))}><option value="7">7 天</option><option value="15">15 天</option><option value="30">30 天</option><option value="60">60 天</option><option value="90">90 天</option><option value="365">365 天</option></select><button class="btn btn-sm" disabled=${deleting || retentionDraft === data?.trash?.retentionDays} onClick=${saveTrashRetention}>保存</button>${skipTrashConfirm ? html4`<button class="btn btn-sm" onClick=${restoreTrashConfirmation}>恢复删除确认</button>` : null}${trashItems.length > 0 ? html4`<button class="btn btn-sm danger" disabled=${deleting} onClick=${() => permanentlyDeleteTrash(trashItems.map((item) => item.id))}>清空</button>` : null}</div>` : null}
        <div class="ssl-rows">
          ${listMode === "sessions" ? html4`
          ${filtered.length === 0 ? html4`<div style="padding:18px;color:var(--fg-3);font-size:13px">${t4("sessions.noSessions")}</div>` : null}
          ${filtered.map(
    (s3) => html4`
              <div
                class=${`ssl-row ${open?.name === s3.name ? "sel" : ""}`}
                onClick=${() => selectionMode ? toggleSelectedSession(s3.name) : view(s3.name)}
              >
                <div class="session-row-title">${selectionMode ? html4`<input class="session-select-box" type="checkbox" aria-label=${`选择会话 ${s3.name}`} checked=${selectedNames.has(s3.name)} onClick=${(event) => event.stopPropagation()} onChange=${() => toggleSelectedSession(s3.name)} />` : null}<span class="name">${s3.name}</span></div>
                <span class="preview">${s3.summary || t4("sessions.noSummary")}</span>
                <span class="meta">
                  <span><span class="v">${fmtNum(s3.messageCount)}</span> ${t4("sessions.msgs")}</span>
                  ${s3.modeLabel ? html4`<span>${s3.modeLabel}</span>` : null}
                  <span><span class="v">${fmtBytes(s3.size)}</span></span>
                  <span>${fmtRelativeTime(s3.mtime)}</span>
                </span>
              </div>
            `
  )}` : html4`
          ${filteredTrash.length === 0 ? html4`<div style="padding:18px;color:var(--fg-3);font-size:13px">回收站为空</div>` : null}
          ${filteredTrash.map((item) => html4`<div class=${`ssl-row ${open?.kind === "trash" && open.id === item.id ? "sel" : ""}`} onClick=${() => selectionMode ? toggleSelectedTrash(item.id) : viewTrash(item)}>
            <div class="session-row-title">${selectionMode ? html4`<input class="session-select-box" type="checkbox" aria-label=${`选择回收站会话 ${item.name}`} checked=${selectedTrashIds.has(item.id)} onClick=${(event) => event.stopPropagation()} onChange=${() => toggleSelectedTrash(item.id)} />` : null}<span class="name">${item.name}</span></div>
            <span class="preview">${item.fileCount} 个文件 · ${fmtBytes(item.totalBytes)}</span>
            <span class="meta"><span>删除于 ${fmtRelativeTime(Date.parse(item.movedAt))}</span><span>清理于 ${item.expiresAt ? new Date(item.expiresAt).toLocaleDateString() : "—"}</span></span>
          </div>`)}
          `}
        </div>
        ${selectionMode ? html4`<div class="session-batch-bar"><span>已选 ${listMode === "sessions" ? selectedNames.size : selectedTrashIds.size} 项</span><button class="btn btn-sm" onClick=${() => listMode === "sessions" ? setSelectedNames(allFilteredSelected ? /* @__PURE__ */ new Set() : new Set(filtered.map((session) => session.name))) : setSelectedTrashIds(allFilteredTrashSelected ? /* @__PURE__ */ new Set() : new Set(filteredTrash.map((item) => item.id)))}>${(listMode === "sessions" ? allFilteredSelected : allFilteredTrashSelected) ? "取消全选" : "全选当前"}</button>${listMode === "sessions" ? html4`<button class="btn btn-sm danger" disabled=${deleting || selectedNames.size === 0} onClick=${batchTrash}>移入回收站</button>` : html4`<button class="btn btn-sm" disabled=${deleting || selectedTrashIds.size === 0} onClick=${batchRestoreTrash}>恢复</button><button class="btn btn-sm danger" disabled=${deleting || selectedTrashIds.size === 0} onClick=${() => permanentlyDeleteTrash([...selectedTrashIds])}>永久删除</button>`}</div>` : null}
      </div>

      <div class="sessions-detail">
        ${open == null ? html4`<div style="color:var(--fg-3);font-size:13px;text-align:center;padding:60px 20px">
                ${t4("sessions.pickHint")}
              </div>` : open.kind === "trash" ? html4`
                <div class="sessions-detail-h"><span class="name">${open.name}</span><span class="ws">回收站预览 · ${fmtNum(open.totalMessages ?? open.messages?.length ?? 0)} 条消息</span><span class="actions"><button class="btn ghost" onClick=${closeDetail}>返回</button><button class="btn ghost danger" disabled=${deleting} onClick=${() => permanentlyDeleteTrash([open.id])}>永久删除</button></span></div>
                <div class="card accent-brand session-trash-restore"><div class="card-h"><span class="title">确认内容后恢复</span></div><div class="card-b"><label>恢复后的会话名称</label><div class="session-restore-row"><input class="input" value=${restoreName} onInput=${(event) => setRestoreName(event.target.value)} /><button class="btn primary" disabled=${deleting || !restoreName.trim()} onClick=${() => restoreTrashSession(open.id, restoreName.trim())}>恢复会话</button></div><span>如果原名称已被使用，可以修改名称后恢复，不会覆盖现有会话。</span></div></div>
                ${open.integrityWarning ? html4`<div class="card accent-warn session-integrity-warning" role="alert">${open.integrityWarning}${open.invalidLines?.length ? html4`<span>受影响行：${open.invalidLines.join(", ")}${open.invalidRecords > open.invalidLines.length ? " 等" : ""}</span>` : null}</div>` : null}
                ${openLoading && !open.messages ? html4`<div style="color:var(--fg-3)">${t4("sessions.loadingTranscript")}</div>` : open.error ? html4`<div class="card accent-err">${open.error}</div>` : detailChatMessages.length > 0 ? html4`<div class="chat-feed" ref=${transcriptFeedRef} style="max-height:calc(100vh - 280px);overflow-y:auto">${open.hasMore ? html4`<div class="chat-history-loader"><button type="button" onClick=${loadEarlierTranscript} disabled=${openLoading}>${openLoading ? "加载中..." : "加载更早的 200 条消息"}</button></div>` : null}${detailChatMessages.map((m3, i3) => html4`<${ChatMessage} key=${i3} msg=${m3} index=${i3} streaming=${false} userAvatar=${userAvatar} />`)}</div>` : html4`<div style="color:var(--fg-3)">${t4("sessions.emptyTranscript")}</div>`}
              ` : html4`
                <div class="sessions-detail-h">
                  ${renaming ? html4`
                    <div class="sessions-rename-row">
                      <input
                        type="text"
                        value=${renameText}
                        onInput=${(e3) => setRenameText(e3.target.value)}
                        onKeyDown=${(e3) => {
    if (e3.key === "Enter") doRename();
    if (e3.key === "Escape") cancelRename();
  }}
                        placeholder=${t4("sessions.renamePlaceholder")}
                        disabled=${renameBusy}
                      />
                      <button class="btn primary" onClick=${doRename} disabled=${!renameText.trim() || renameBusy}>${t4("common.save")}</button>
                      <button class="btn" onClick=${cancelRename} disabled=${renameBusy}>${t4("common.cancel")}</button>
                    </div>
                  ` : html4`
                    <span class="name">${open.name}</span>
                    <span class="ws">
                      ${open.messages ? t4("sessions.messages", { count: open.totalMessages ?? open.messages.length, s: (open.totalMessages ?? open.messages.length) === 1 ? "" : "s" }) : t4("common.loading")}
                      ${open.modeLabel ? html4` · ${open.modeLabel}` : null}
                    </span>
                    <span class="actions">
                      <button class="btn ghost" onClick=${startRename} disabled=${renameBusy}>${t4("sessions.rename")}</button>
                      <button class="btn ghost" onClick=${() => exportSession(open.name)}>${t4("sessions.exportMarkdown")}</button>
                      <button class="btn ghost" onClick=${closeDetail}>${t4("common.back")}</button>
                      <button class="btn ghost danger" disabled=${deleting} onClick=${() => remove(open.name)}>${deleting ? "..." : t4("common.delete")}</button>
                    </span>
                  `}
                </div>
                <div class="card accent-brand" style="margin-bottom:10px">
                  <div class="card-h"><span class="title">继续会话</span></div>
                  <div class="card-b" style="font-size:12.5px;color:var(--fg-2)">
                    加载历史消息到当前聊天，并恢复保存时的工作场景${open.modeLabel ? html4`（${open.modeLabel}）` : null}，AI 将获得完整上下文，你可以直接继续对话。
                    <button class="btn primary" style="margin-top:8px;width:100%"
                            disabled=${resuming}
                            onClick=${() => doResume(open.name)}>
                      ${resuming ? "加载中..." : "加载并继续会话"}
                    </button>
                  </div>
                </div>
                ${open.integrityWarning ? html4`<div class="card accent-warn session-integrity-warning" role="alert">${open.integrityWarning}${open.invalidLines?.length ? html4`<span>受影响行：${open.invalidLines.join(", ")}${open.invalidRecords > open.invalidLines.length ? " 等" : ""}</span>` : null}</div>` : null}
                ${openLoading && !open.messages ? html4`<div style="color:var(--fg-3)">${t4("sessions.loadingTranscript")}</div>` : open.error ? html4`<div class="card accent-err">${open.error}</div>` : detailChatMessages.length > 0 ? html4`
                          <div class="chat-searchbar session-transcript-search">
                            <span class="chat-search-icon">⌕</span>
                            <input
                              type="search"
                              value=${transcriptSearch}
                              placeholder=${t4("sessions.transcriptSearchPlaceholder")}
                              onInput=${(e3) => {
    setTranscriptSearch(e3.target.value);
    setTranscriptSearchIndex(0);
  }}
                              onKeyDown=${(e3) => {
    if (e3.key === "Enter" && transcriptMatches.length > 0) {
      e3.preventDefault();
      setTranscriptSearchIndex((i3) => e3.shiftKey ? (i3 - 1 + transcriptMatches.length) % transcriptMatches.length : (i3 + 1) % transcriptMatches.length);
    }
  }}
                            />
                            <span class="chat-search-count">
                              ${transcriptSearch.trim() ? t4("sessions.transcriptSearchCount", { current: transcriptMatches.length ? transcriptSearchIndex + 1 : 0, total: transcriptMatches.length }) : t4("sessions.transcriptSearchIdle")}
                            </span>
                            <button type="button" disabled=${transcriptMatches.length === 0} onClick=${() => setTranscriptSearchIndex((i3) => (i3 - 1 + transcriptMatches.length) % transcriptMatches.length)} title=${t4("chat.searchPrev")}>↑</button>
                            <button type="button" disabled=${transcriptMatches.length === 0} onClick=${() => setTranscriptSearchIndex((i3) => (i3 + 1) % transcriptMatches.length)} title=${t4("chat.searchNext")}>↓</button>
                            ${transcriptSearch ? html4`<button type="button" onClick=${() => setTranscriptSearch("")} title=${t4("chat.searchClear")}>×</button>` : null}
                          </div>
                          <div class="chat-feed" ref=${transcriptFeedRef} style="max-height:calc(100vh - 260px);overflow-y:auto">
                            ${open.hasMore ? html4`<div class="chat-history-loader"><button type="button" onClick=${loadEarlierTranscript} disabled=${openLoading}>${openLoading ? "加载中..." : "加载更早的 200 条消息"}</button></div>` : null}
                            ${detailChatMessages.map(
    (m3, i3) => html4`
                                <${ChatMessage}
                                  key=${i3}
                                  msg=${m3}
                                  index=${i3}
                                  searchMatch=${transcriptMatches.length ? i3 === transcriptMatches[Math.min(transcriptSearchIndex, transcriptMatches.length - 1)]?.index : false}
                                  streaming=${false}
                                  userAvatar=${userAvatar}
                                />
                              `
  )}
                          </div>` : html4`<div style="color:var(--fg-3)">${t4("sessions.emptyTranscript")}</div>`}
              `}
      </div>
    </div>
  `;
}

// dashboard/src/lib/loop-control.ts
var INTERVAL_PRESETS_MS6 = [
  { ms: 3e4, label: "30s" },
  { ms: 6e4, label: "1m" },
  { ms: 5 * 6e4, label: "5m" },
  { ms: 15 * 6e4, label: "15m" },
  { ms: 60 * 6e4, label: "1h" },
  { ms: 6 * 60 * 6e4, label: "6h" }
];
var UNIT_TO_MS = {
  s: 1e3,
  m: 6e4,
  h: 60 * 6e4
};
var MIN_INTERVAL_MS = 5e3;
var MAX_INTERVAL_MS = 6 * 60 * 6e4;
function parseCustomInterval6(value, unit) {
  const n3 = Number.parseFloat(value);
  if (!Number.isFinite(n3) || n3 <= 0) return null;
  const ms = Math.round(n3 * UNIT_TO_MS[unit]);
  if (ms < MIN_INTERVAL_MS || ms > MAX_INTERVAL_MS) return null;
  return ms;
}
function formatRemaining6(ms) {
  const safe = Math.max(0, Math.floor(ms / 1e3));
  const h3 = Math.floor(safe / 3600);
  const m3 = Math.floor(safe % 3600 / 60);
  const s3 = safe % 60;
  if (h3 > 0) return m3 > 0 ? `${h3}h ${m3}m` : `${h3}h`;
  if (m3 > 0) return s3 > 0 ? `${m3}m ${s3}s` : `${m3}m`;
  return `${s3}s`;
}

// dashboard/src/panels/settings.ts
var N29 = N2;
function fmtUsd22(n3) {
  return `$${n3.toFixed(n3 < 1 ? 4 : 2)}`;
}
function formatPricing(p3) {
  if (!p3) return null;
  return t4("settings.modelPricingLine", {
    hit: p3.inputCacheHit.toFixed(3),
    miss: p3.inputCacheMiss.toFixed(3),
    out: p3.output.toFixed(3)
  });
}
function ModelRow({
  current,
  catalog,
  saving,
  locked,
  onPick
}) {
  const list2 = catalog?.models ?? null;
  const ready = list2 && list2.length > 0;
  if (!ready) {
    return html4`<code class="mono">${current ?? "—"}</code>`;
  }
  const options2 = list2.includes(current) ? list2 : [current, ...list2];
  const price = catalog?.pricing[current];
  return html4`
    <span style="display:inline-flex;flex-direction:column;gap:4px">
      <select
        value=${current}
        onChange=${(e3) => {
    const next = e3.target.value;
    if (next && next !== current) onPick(next);
  }}
        disabled=${saving || locked}
        style="font-family:var(--font-mono);min-width:200px"
      >
        ${options2.map((m3) => html4`<option key=${m3} value=${m3}>${m3}</option>`)}
      </select>
      ${price ? html4`<span style="color:var(--fg-3);font-size:11px;font-family:var(--font-mono)">${formatPricing(price)}</span>` : null}
    </span>
  `;
}
function BudgetGauge({ state }) {
  if (state.kind === "off") return null;
  const tone = budgetTone2(state);
  const fill = Math.min(100, state.pct);
  const valueColor = tone === "err" ? "color:var(--c-err)" : tone === "warn" ? "color:var(--c-warn)" : "color:var(--fg-1)";
  return html4`
    <div style="display:flex;flex-direction:column;gap:6px">
      <div style="display:flex;justify-content:space-between;align-items:baseline;font-size:13px">
        <span style=${valueColor}>
          <strong style="font-family:var(--font-mono)">${fmtUsd22(state.spent)}</strong>
          <span style="color:var(--fg-3)"> ${t4("settings.budgetOf")} </span>
          <strong style="font-family:var(--font-mono)">${fmtUsd22(state.cap)}</strong>
        </span>
        <span style=${`font-family:var(--font-mono);font-size:11px;${valueColor}`}>${state.pct.toFixed(1)}%</span>
      </div>
      <div class=${`progress ${tone}`}><div class="progress-fill" style=${`width:${fill}%`}></div></div>
      <span style="color:var(--fg-3);font-size:11px">
        ${state.kind === "exhausted" ? t4("settings.budgetRefusing") : state.kind === "warn" ? t4("settings.budgetWarnLine") : t4("settings.budgetIdleLine")}
      </span>
    </div>
  `;
}
function BudgetSection({ state, saving, onSetCap, onClear }) {
  const [custom, setCustom] = d2("");
  const submitCustom = () => {
    const n3 = Number.parseFloat(custom);
    if (Number.isFinite(n3) && n3 > 0) {
      onSetCap(n3);
      setCustom("");
    }
  };
  const quickButtons = (caps) => caps.map(
    (c3) => html4`
        <button
          key=${c3}
          class="btn"
          style="font-family:var(--font-mono)"
          disabled=${saving}
          onClick=${() => onSetCap(c3)}
        >$${c3}</button>
      `
  );
  const customField = html4`
    <span style="display:inline-flex;align-items:center;gap:4px;margin-left:auto">
      <span style="color:var(--fg-3);font-size:11px">${t4("settings.budgetCustom")}</span>
      <input
        type="number"
        min="0.01"
        step="0.01"
        value=${custom}
        placeholder="0.00"
        onInput=${(e3) => setCustom(e3.target.value)}
        onKeyDown=${(e3) => {
    if (e3.key === "Enter") submitCustom();
  }}
        style="width:72px;font-family:var(--font-mono)"
        disabled=${saving}
      />
      <button
        class="btn primary"
        disabled=${saving || !(Number.parseFloat(custom) > 0)}
        onClick=${submitCustom}
      >→</button>
    </span>
  `;
  return html4`
    <div class="card" style="display:flex;flex-direction:column;gap:12px">
      <${BudgetGauge} state=${state} />

      ${state.kind === "off" ? html4`
              <div>
                <div style="color:var(--fg-3);font-size:11px;margin-bottom:6px">${t4("settings.budgetSetCap")}</div>
                <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
                  ${quickButtons(QUICK_CAPS_USD2)}
                  ${customField}
                </div>
              </div>
            ` : state.kind === "warn" || state.kind === "exhausted" ? html4`
                <div>
                  <div style="color:var(--fg-3);font-size:11px;margin-bottom:6px">${t4("settings.budgetBumpHint")}</div>
                  <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
                    ${bumpSuggestions2(state.cap).map(
    (next) => html4`
                        <button
                          key=${next}
                          class="btn primary"
                          style="font-family:var(--font-mono)"
                          disabled=${saving}
                          onClick=${() => onSetCap(next)}
                        >→ $${next % 1 === 0 ? next : next.toFixed(2)}</button>
                      `
  )}
                    ${customField}
                  </div>
                  <div style="margin-top:8px">
                    <button class="btn" disabled=${saving} onClick=${onClear}>${t4("settings.budgetClear")}</button>
                  </div>
                </div>
              ` : html4`
                <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
                  ${bumpSuggestions2(state.cap).map(
    (next) => html4`
                      <button
                        key=${next}
                        class="btn"
                        style="font-family:var(--font-mono)"
                        disabled=${saving}
                        onClick=${() => onSetCap(next)}
                      >→ $${next % 1 === 0 ? next : next.toFixed(2)}</button>
                    `
  )}
                  ${customField}
                  <button
                    class="btn"
                    style="margin-left:8px"
                    disabled=${saving}
                    onClick=${onClear}
                  >${t4("settings.budgetClear")}</button>
                </div>
              `}
    </div>
  `;
}
function LoopSection({
  status,
  remainingMs,
  avgIterCostUsd,
  busy,
  onStart,
  onStop
}) {
  const [intervalMs, setIntervalMs] = d2(INTERVAL_PRESETS_MS6[1].ms);
  const [prompt2, setPrompt] = d2("");
  const [customValue, setCustomValue] = d2("");
  const [customUnit, setCustomUnit] = d2("m");
  if (status) {
    return html4`
      <div class="card" style="display:flex;flex-direction:column;gap:10px">
        <div style="display:flex;justify-content:space-between;align-items:baseline">
          <span style="color:var(--c-warn);font-family:var(--font-mono);font-size:11px">⟳ ${t4("settings.loopRunning")}</span>
          <span style="color:var(--fg-3);font-size:11px">
            ${t4("settings.loopIter", { iter: status.iter })} · ${t4("settings.loopFiresIn", { remaining: formatRemaining6(remainingMs) })}
          </span>
        </div>
        <div style="background:var(--bg-elev-2);border:1px solid var(--bd);border-radius:var(--r);padding:8px 10px;font-family:var(--font-mono);font-size:12px;color:var(--fg-1);white-space:pre-wrap;max-height:120px;overflow-y:auto">${status.prompt}</div>
        <div>
          <button class="btn danger" disabled=${busy} onClick=${onStop}>${t4("settings.loopStop")}</button>
        </div>
      </div>
    `;
  }
  const customMs = parseCustomInterval6(customValue, customUnit);
  const canStart = !busy && intervalMs > 0 && prompt2.trim().length > 0;
  return html4`
    <div class="card" style="display:flex;flex-direction:column;gap:10px">
      <div style="color:var(--fg-3);font-size:11px">
        ${t4("settings.loopIdleHint")}
        ${typeof avgIterCostUsd === "number" && avgIterCostUsd > 0 ? html4` ${t4("settings.loopCostHint", { cost: `$${avgIterCostUsd.toFixed(4)}` })}` : null}
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">
        <span style="color:var(--fg-3);font-size:11px">${t4("settings.loopInterval")}</span>
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
          ${INTERVAL_PRESETS_MS6.map(
    (p3) => html4`
              <button
                key=${p3.ms}
                class=${`btn ${intervalMs === p3.ms && customValue === "" ? "primary" : ""}`}
                style="font-family:var(--font-mono)"
                disabled=${busy}
                onClick=${() => {
      setIntervalMs(p3.ms);
      setCustomValue("");
    }}
              >${p3.label}</button>
            `
  )}
          <span style="display:inline-flex;align-items:center;gap:4px;margin-left:auto">
            <span style="color:var(--fg-3);font-size:11px">${t4("settings.loopCustom")}</span>
            <input
              type="number"
              min="1"
              step="1"
              value=${customValue}
              onInput=${(e3) => {
    const raw = e3.target.value;
    setCustomValue(raw);
    const ms = parseCustomInterval6(raw, customUnit);
    if (ms !== null) setIntervalMs(ms);
  }}
              style="width:64px;font-family:var(--font-mono)"
              disabled=${busy}
            />
            <select
              value=${customUnit}
              onChange=${(e3) => {
    const next = e3.target.value;
    setCustomUnit(next);
    if (customValue) {
      const ms = parseCustomInterval6(customValue, next);
      if (ms !== null) setIntervalMs(ms);
    }
  }}
              disabled=${busy}
            >
              <option value="s">s</option>
              <option value="m">m</option>
              <option value="h">h</option>
            </select>
          </span>
        </div>
        ${customValue && customMs === null ? html4`<span style="color:var(--c-err);font-size:11px">${t4("settings.loopRangeError")}</span>` : null}
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">
        <span style="color:var(--fg-3);font-size:11px">${t4("settings.loopPrompt")}</span>
        <textarea
          rows="3"
          placeholder=${t4("settings.loopPromptPlaceholder")}
          value=${prompt2}
          onInput=${(e3) => setPrompt(e3.target.value)}
          style="width:100%;font-family:var(--font-mono);resize:vertical"
          disabled=${busy}
        ></textarea>
      </div>
      <div>
        <button
          class="btn primary"
          disabled=${!canStart}
          onClick=${() => onStart(intervalMs, prompt2.trim())}
        >${t4("settings.loopStart")}</button>
      </div>
    </div>
  `;
}
function sameDevLogSnapshot(current, next) {
  return current.length === next.length && current.every((entry, index) => entry.ts === next[index]?.ts && entry.msg === next[index]?.msg);
}
function countNewDevLogs(current, next) {
  if (next.length === 0) return 0;
  if (current.length === 0) return next.length;
  const last = current[current.length - 1];
  for (let index = next.length - 1; index >= 0; index -= 1) {
    if (next[index]?.ts === last.ts && next[index]?.msg === last.msg) return next.length - index - 1;
  }
  return Math.max(1, next.length - current.length);
}
function SettingsPanel() {
  useLang();
  const [data, setData] = d2(null);
  const [error, setError] = d2(null);
  const [saving, setSaving] = d2(false);
  const [saved, setSaved] = d2(null);
  const [draft, setDraft] = d2({});
  const [credentialProviderId, setCredentialProviderId] = d2(null);
  const [credentialVerification, setCredentialVerification] = d2(null);
  const [credentialTesting, setCredentialTesting] = d2(false);
  const [managedProviders, setManagedProviders] = d2([]);
  const [modelVerification, setModelVerification] = d2(null);
  const [providerDiagnostics, setProviderDiagnostics] = d2(null);
  const [providerTesting, setProviderTesting] = d2(false);
  const [catalog, setCatalog] = d2(null);
  const [loopStatus, setLoopStatus] = d2(null);
  const [loopAvgCost, setLoopAvgCost] = d2(null);
  const [loopBusy, setLoopBusy] = d2(false);
  const lastStatusSyncRef = A2(0);
  const [now, setNow] = d2(() => Date.now());
  const [showDevLog, setShowDevLog] = d2(false);
  const [devLogs, setDevLogs] = d2([]);
  const devLogsRef = A2([]);
  const devLogPanelRef = A2(null);
  const devLogFollowRef = A2(true);
  const [devLogFollowing, setDevLogFollowing] = d2(true);
  const [devLogNewCount, setDevLogNewCount] = d2(0);
  const applyDevLogs = q2((logs) => {
    const next = Array.isArray(logs) ? logs : [];
    const current = devLogsRef.current;
    if (sameDevLogSnapshot(current, next)) return;
    if (!devLogFollowRef.current) {
      const added = countNewDevLogs(current, next);
      if (added > 0) setDevLogNewCount((count) => count + added);
    }
    devLogsRef.current = next;
    setDevLogs(next);
  }, []);
  const setDevLogFollow = q2((following) => {
    devLogFollowRef.current = following;
    setDevLogFollowing(following);
    if (following) setDevLogNewCount(0);
  }, []);
  const scrollDevLogToBottom = q2(() => {
    setDevLogFollow(true);
    requestAnimationFrame(() => {
      const el = devLogPanelRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, [setDevLogFollow]);
  const handleDevLogScroll = q2((event) => {
    const el = event.currentTarget;
    setDevLogFollow(el.scrollHeight - el.scrollTop - el.clientHeight <= 24);
  }, [setDevLogFollow]);
  const toggleDevLog = q2(() => {
    const next = !showDevLog;
    if (next) setDevLogFollow(true);
    setShowDevLog(next);
  }, [showDevLog, setDevLogFollow]);
  const load = q2(async () => {
    try {
      const [r3, providerResult, diagnosticsResult] = await Promise.all([
        api("/settings"),
        api("/providers"),
        api("/providers/diagnostics").catch(() => null)
      ]);
      setData(r3);
      setManagedProviders(providerResult.providers ?? []);
      setModelVerification(providerResult.modelVerification ?? null);
      setProviderDiagnostics(diagnosticsResult);
      setDraft({});
      setCredentialProviderId((current) => r3.credentialProviders?.some((provider) => provider.id === current) ? current : r3.credentialTarget?.id ?? r3.credentialProviders?.[0]?.id ?? null);
      setCredentialVerification(null);
    } catch (err) {
      setError(err.message);
    }
  }, []);
  y2(() => {
    load();
  }, [load]);
  y2(() => {
    api("/models").then(setCatalog).catch(() => void 0);
  }, []);
  const refreshLoop = q2(async () => {
    try {
      const r3 = await api("/loop/status");
      setLoopStatus(r3.status);
      lastStatusSyncRef.current = Date.now();
    } catch {
    }
    try {
      const r3 = await api("/overview");
      setLoopAvgCost(r3.stats?.lastTurnCostUsd ?? null);
    } catch {
    }
  }, []);
  y2(() => {
    let cancelled = false;
    refreshLoop();
    const id = setInterval(() => {
      if (!cancelled) refreshLoop();
    }, 5e3);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [refreshLoop]);
  y2(() => {
    if (!loopStatus) return;
    const id = setInterval(() => setNow(Date.now()), 1e3);
    return () => clearInterval(id);
  }, [loopStatus]);
  const remainingMs = loopStatus ? Math.max(0, loopStatus.nextFireMs - (now - lastStatusSyncRef.current)) : 0;
  const startLoop = q2(
    async (intervalMs, prompt2) => {
      setLoopBusy(true);
      try {
        await api("/loop/start", { method: "POST", body: { intervalMs, prompt: prompt2 } });
        await refreshLoop();
      } catch (err) {
        setError(err.message);
      } finally {
        setLoopBusy(false);
      }
    },
    [refreshLoop]
  );
  const stopLoop = q2(async () => {
    setLoopBusy(true);
    try {
      await api("/loop/stop", { method: "POST" });
      await refreshLoop();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoopBusy(false);
    }
  }, [refreshLoop]);
  const refreshLogs = q2(async () => {
    try {
      const r3 = await api("/logs");
      applyDevLogs(r3.logs ?? []);
    } catch {
    }
  }, [applyDevLogs]);
  y2(() => {
    if (!showDevLog) return;
    refreshLogs();
    const unsub = subscribeSse("logs", (ev) => {
      applyDevLogs(ev.logs ?? []);
    });
    return unsub;
  }, [showDevLog, refreshLogs, applyDevLogs]);
  y2(() => {
    if (!devLogFollowing) return;
    const el = devLogPanelRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [devLogs, devLogFollowing, showDevLog]);
  const save = q2(
    async (fields) => {
      setSaving(true);
      setError(null);
      try {
        const result = await api("/settings", { method: "POST", body: fields });
        await load();
        setSaved(result.requiresModelTest ? t4("settings.credentialsRetest") : t4("settings.saved", { fields: Object.keys(fields).join(", ") }));
        setTimeout(() => setSaved(null), 3e3);
      } catch (err) {
        setError(err.message);
      } finally {
        setSaving(false);
      }
    },
    [load]
  );
  const testCredentials = q2(async () => {
    const provider = data?.credentialProviders?.find((item) => item.id === credentialProviderId);
    if (!provider) return;
    setCredentialTesting(true);
    setCredentialVerification(null);
    setError(null);
    try {
      const payload = { providerId: provider.id, baseUrl: draft.baseUrl ?? provider.baseUrl };
      if ((draft.apiKey ?? "").trim()) payload.apiKey = draft.apiKey.trim();
      const result = await api("/providers/credentials/test", { method: "POST", body: payload });
      setCredentialVerification({ ...result, apiKey: payload.apiKey, baseUrl: payload.baseUrl });
    } catch (err) {
      setError(`API 检测失败：${err.message}`);
    } finally {
      setCredentialTesting(false);
    }
  }, [data, credentialProviderId, draft]);
  const saveCredentials = q2(async () => {
    const provider = data?.credentialProviders?.find((item) => item.id === credentialProviderId);
    if (!provider || !credentialVerification) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        providerId: provider.id,
        baseUrl: credentialVerification.baseUrl,
        verificationToken: credentialVerification.verificationToken
      };
      if (credentialVerification.apiKey) payload.apiKey = credentialVerification.apiKey;
      await api("/providers/credentials/save", { method: "POST", body: payload });
      await load();
      setSaved(t4("settings.credentialsRetest"));
      setTimeout(() => setSaved(null), 4e3);
    } catch (err) {
      setCredentialVerification(null);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }, [data, credentialProviderId, credentialVerification, load]);
  const testManagedProviders = q2(async () => {
    if (providerTesting) return;
    setProviderTesting(true);
    setError(null);
    try {
      const result = await api("/providers/test", { method: "POST", body: {} });
      await load();
      setSaved(`模型检测完成：${result.passed}/${result.total} 可用`);
    } catch (err) {
      setError(`模型检测失败：${err.message}`);
    } finally {
      setProviderTesting(false);
    }
  }, [providerTesting, load]);
  if (!data && !error)
    return html4`<div class="card" style="color:var(--fg-3)">${t4("settings.loading")}</div>`;
  if (error && !data) return html4`<div class="card accent-err">${error}</div>`;
  if (!data) return null;
  const v3 = data;
  const credentialProvider = v3.credentialProviders?.find((provider) => provider.id === credentialProviderId) ?? v3.credentialProviders?.[0] ?? null;
  const credentialBaseUrl = draft.baseUrl ?? credentialProvider?.baseUrl ?? "";
  const credentialChanged = Boolean((draft.apiKey ?? "").trim()) || credentialBaseUrl !== (credentialProvider?.baseUrl ?? "");
  const activeProviderDiagnostic = providerDiagnostics?.providers?.find((diagnostic) => diagnostic.active) ?? null;
  const provenanceLabel = {
    "builtin-default": "内置默认",
    "json-import": "JSON 导入",
    dashboard: "Dashboard 修改",
    "legacy-migration": "旧配置迁移",
    "config-migration": "配置迁移",
    environment: "环境变量",
    "manual-unknown": "外部或手工修改"
  };
  const lockedPreset = ["flash", "pro"].includes(v3.preset ?? "");
  const modelControlValue = lockedPreset ? v3.effectiveModel ?? v3.displayModel ?? v3.model ?? "—" : v3.configuredModel ?? v3.effectiveModel ?? v3.model ?? "—";
  const runtimeModel = v3.runtimeModel ?? v3.displayModel ?? v3.model ?? "—";
  const modelNote = v3.modelDrift ? `运行模型 ${runtimeModel} 与预设期望 ${v3.effectiveModel ?? "—"} 不一致，请新建对话或重启应用。` : lockedPreset ? `实际模型由 ${v3.preset} 预设锁定为 ${v3.effectiveModel ?? v3.model ?? "—"}；基础配置 ${v3.configuredModel ?? "—"} 仅在 auto 下使用。` : runtimeModel !== modelControlValue ? `当前运行 ${runtimeModel}；基础模型 ${modelControlValue} 将用于后续新对话。` : t4("settings.appliesNextTurn");
  const availableEccRules = (v3.eccRules?.available ?? []).filter((name) => name !== "custom");
  const enabledEccRules = new Set(v3.eccRules?.enabled ?? []);
  const toggleEccRule = (name) => {
    const next = enabledEccRules.has(name) ? [...enabledEccRules].filter((item) => item !== name) : [...enabledEccRules, name];
    save({ eccRules: next });
  };
  const sectionH3 = (text) => html4`
    <h3 style="margin:18px 0 8px;font-family:var(--font-mono);font-size:11px;color:var(--fg-3);text-transform:uppercase;letter-spacing:.1em">${text}</h3>
  `;
  const fieldRow = (label, control, note) => html4`
    <div style="display:flex;align-items:center;gap:10px;padding:6px 0">
      <span style="flex:0 0 110px;font-family:var(--font-mono);font-size:11.5px;color:var(--fg-3)">${label}</span>
      <div style="flex:1;display:flex;align-items:center;gap:8px">${control}</div>
      ${note ? html4`<span style="color:var(--fg-3);font-size:11px">${note}</span>` : null}
    </div>
  `;
  const currentLang2 = getLang();
  return html4`
    <div style="max-width:760px;display:flex;flex-direction:column;gap:6px">
      ${saved ? html4`<div><span class="pill ok">${saved}</span></div>` : null}
      ${error ? html4`<div class="card accent-err">${error}</div>` : null}

      ${sectionH3(t4("settings.sectionLanguage"))}
      <div class="card">
        ${fieldRow(
    t4("settings.language"),
    html4`
            <select
              value=${currentLang2}
              onChange=${(e3) => {
      const lang = e3.target.value;
      setLang(lang);
    }}
            >
              <option value="en">${t4("settings.langEn")}</option>
              <option value="zh-CN">${t4("settings.langZhCn")}</option>
            </select>
          `
  )}
      </div>

      ${sectionH3(t4("settings.sectionApi"))}
      <div class="card">
        <div style="padding:2px 0 8px;border-bottom:1px solid var(--bd);margin-bottom:4px">
          <div style="font-size:12px;color:var(--fg-1);font-weight:600">${t4("settings.credentialCurrent", { name: credentialProvider?.name ?? "Legacy" })}</div>
          <div style="font-size:11px;color:var(--fg-3);margin-top:3px;line-height:1.45">修改内容不会立即生效；API 检测通过后才能保存。</div>
        </div>
        ${fieldRow(
    t4("settings.credentialProvider"),
    html4`<select value=${credentialProvider?.id ?? ""} disabled=${saving || credentialTesting} onChange=${(e3) => {
      const nextId = e3.target.value;
      const next = v3.credentialProviders?.find((provider) => provider.id === nextId);
      setCredentialProviderId(nextId);
      setDraft({ ...draft, apiKey: "", baseUrl: next?.baseUrl ?? "" });
      setCredentialVerification(null);
    }}>${(v3.credentialProviders ?? []).map((provider) => html4`<option value=${provider.id}>${provider.name}</option>`)}</select>`
  )}
        ${fieldRow(
    t4("settings.apiKey"),
    html4`<code class="mono" style="color:var(--fg-2);font-size:11.5px">${credentialProvider?.apiKey ?? t4("settings.notSet")}</code>`,
    credentialProvider?.credentialTest?.checkedAt ? `上次凭据检测：${fmtRelativeTime(credentialProvider.credentialTest.checkedAt)}` : "尚无已保存的检测记录"
  )}
        ${fieldRow(
    t4("settings.replace"),
    html4`
            <input
              type="password"
              placeholder=${t4("settings.pasteKey")}
              value=${draft.apiKey ?? ""}
              onInput=${(e3) => {
      setDraft({ ...draft, apiKey: e3.target.value });
      setCredentialVerification(null);
    }}
              style="flex:1"
            />
          `
  )}
        ${fieldRow(
    t4("settings.baseUrl"),
    html4`
            <input
              type="text"
              value=${credentialBaseUrl}
              placeholder=${t4("settings.baseUrlPlaceholder")}
              onInput=${(e3) => {
      setDraft({ ...draft, baseUrl: e3.target.value });
      setCredentialVerification(null);
    }}
              style="flex:1"
            />
          `
  )}
        <div style="display:flex;align-items:center;gap:8px;margin-top:8px;padding-top:8px;border-top:1px solid var(--bd)">
          <button class="btn" disabled=${saving || credentialTesting || !credentialProvider || !credentialBaseUrl.trim() || !credentialChanged && !credentialProvider.apiKeySet} onClick=${testCredentials}>${credentialTesting ? t4("settings.detectingApi") : t4("settings.detectApi")}</button>
          <button class="btn primary" disabled=${saving || credentialTesting || !credentialVerification} onClick=${saveCredentials}>${t4("settings.saveCredentials")}</button>
          <span style="font-size:11px;color:${credentialVerification ? "var(--c-ok)" : "var(--fg-3)"}">${credentialVerification ? t4("settings.detectionPassed", { model: credentialVerification.modelId }) : t4("settings.detectionRequired")}</span>
        </div>
      </div>

      ${sectionH3("模型管理")}
      <div class="card model-management-card">
        <div class="model-management-head">
          <div>
            <strong>模型配置与检测</strong>
            <div class="meta">共 ${managedProviders.reduce((count, provider) => count + (provider.models ?? []).filter((model) => model.disabled !== true).length, 0)} 个模型${modelVerification?.dirty ? " · 配置已更新，等待重新检测" : ""}</div>
          </div>
          <button class="btn" disabled=${providerTesting || saving || managedProviders.length === 0} onClick=${testManagedProviders}>${providerTesting ? "检测中..." : "检测全部模型"}</button>
        </div>
        <div class="model-management-groups">
          ${providerDisplayGroups(managedProviders).map((group) => html4`
            <div class="model-management-group"><strong>${group.label}</strong><span>${group.providers.reduce((count, provider) => count + (provider.models ?? []).filter((model) => model.disabled !== true).length, 0)} 个模型</span></div>
          `)}
        </div>
        ${activeProviderDiagnostic ? html4`
          <div class="provider-diagnostics">
            <div class="provider-diagnostics-head">
              <strong>当前运行配置</strong>
              <span class=${activeProviderDiagnostic.issues?.length ? "pill warn" : "pill ok"}>${activeProviderDiagnostic.issues?.length ? `${activeProviderDiagnostic.issues.length} 项需处理` : "配置完整"}</span>
            </div>
            <div class="provider-diagnostics-grid">
              <span>适配器</span><code>${activeProviderDiagnostic.providerType}</code>
              <span>模型 / 协议</span><code>${activeProviderDiagnostic.modelId ?? "未选择"} · ${activeProviderDiagnostic.protocol}</code>
              <span>有效 URL</span><code>${activeProviderDiagnostic.effectiveBaseUrl ?? "未配置"}</code>
              <span>API Key</span><code>${activeProviderDiagnostic.apiKeyPresent ? "已提供" : "未配置"}${activeProviderDiagnostic.configuredApiKeyPresent ? "（配置文件）" : activeProviderDiagnostic.overrides?.apiKey ? "（环境变量）" : ""}</code>
              <span>配置来源</span><code>${provenanceLabel[activeProviderDiagnostic.source] ?? activeProviderDiagnostic.source}${activeProviderDiagnostic.changedOutsideManagedFlow ? " · 未经受管流程修改" : ""}</code>
            </div>
            ${activeProviderDiagnostic.issues?.length ? html4`<div class="provider-diagnostics-issues">${activeProviderDiagnostic.issues.map((issue) => html4`<div>${issue.message}</div>`)}</div>` : null}
          </div>
        ` : null}
      </div>

      ${sectionH3(t4("settings.sectionDefaults"))}
      <div class="card">
        ${v3.modes ? fieldRow(
    "工作场景",
    html4`
            <select
              value=${v3.mode ?? "general"}
              onChange=${(e3) => save({ mode: e3.target.value })}
              disabled=${saving}
            >
              ${v3.modes.map((m3) => html4`<option value=${m3.id}>${m3.label} — ${m3.description || (m3.effectiveRules || m3.rules || []).join("+")}</option>`)}
            </select>
          `,
    `${v3.activeMode?.hint || "切换后下次新对话生效"} · ECC ${(v3.activeMode?.effectiveRules || v3.activeMode?.rules || []).join("+") || "common"}`
  ) : null}
        ${availableEccRules.length > 0 ? fieldRow(
    "ECC 编码规范",
    html4`<div class="ecc-rule-grid">
      ${availableEccRules.map((name) => html4`<label class=${`ecc-rule-option ${enabledEccRules.has(name) ? "active" : ""}`} title=${`${name} 规则将注入当前工作场景的系统提示词`}>
        <input type="checkbox" checked=${enabledEccRules.has(name)} disabled=${saving} onChange=${() => toggleEccRule(name)} />
        <span>${name}</span>
      </label>`)}
    </div>`,
    `当前场景已启用 ${enabledEccRules.size}/${availableEccRules.length}，修改后立即生效`
  ) : null}
        ${fieldRow(
    "上下文长度",
    html4`
            <select
              value=${v3.contextCapTokens ?? "auto"}
              onChange=${(e3) => save({ contextCapTokens: e3.target.value === "auto" ? null : parseInt(e3.target.value, 10) })}
              disabled=${saving}
            >
              <option value="auto">${v3.providerContextCap ? `模型默认 (${Math.round(v3.providerContextCap / 1024)}K)` : "模型默认"}</option>
              <option value="32768" disabled=${Boolean(v3.providerContextCap && 32768 > v3.providerContextCap)}>32K</option>
              <option value="65536" disabled=${Boolean(v3.providerContextCap && 65536 > v3.providerContextCap)}>64K</option>
              <option value="131072" disabled=${Boolean(v3.providerContextCap && 131072 > v3.providerContextCap)}>128K</option>
              <option value="262144" disabled=${Boolean(v3.providerContextCap && 262144 > v3.providerContextCap)}>256K</option>
              <option value="1048576" disabled=${Boolean(v3.providerContextCap && 1048576 > v3.providerContextCap)}>1M</option>
              ${v3.contextCapTokens && ![32768, 65536, 131072, 262144, 1048576].includes(v3.contextCapTokens) ? html4`<option value="${v3.contextCapTokens}" disabled=${Boolean(v3.providerContextCap && v3.contextCapTokens > v3.providerContextCap)}>${Math.round(v3.contextCapTokens / 1024)}K</option>` : null}
            </select>
          `,
    "即时生效"
  )}
        ${fieldRow(
    t4("settings.webSearch"),
    html4`
            <button
              class=${`btn ${v3.search ? "primary" : ""}`}
              onClick=${() => save({ search: !v3.search })}
              disabled=${saving}
            >${v3.search ? t4("common.on") : t4("common.off")}</button>
          `,
    t4("settings.webSearchNote")
  )}
        ${v3.search ? html4`
          ${fieldRow(
    "搜索引擎",
    html4`
              <select
                value=${v3.webSearchEngine ?? "bing-scrape"}
                onChange=${(e3) => save({ webSearchEngine: e3.target.value })}
                disabled=${saving}
              >
                <option value="mojeek">Mojeek (\u514D\u8D39)</option>
                <option value="bing-scrape">Bing \u56FD\u5185\u7248 (\u514D\u8D39\uFF0C\u65E0\u9700API)</option>
                <option value="searxng">SearXNG (\u81EA\u90E8\u7F72/\u516C\u5171\u5B9E\u4F8B)</option>
                <option value="bing">Bing API (\u9700 API Key)</option>
              </select>
            `,
    "切换引擎后需重启应用生效"
  )}
          ${v3.webSearchEngine === "searxng" || (v3.webSearchEngine ?? "bing-scrape") === "searxng" ? fieldRow(
    "SearXNG 地址",
    html4`
              <input
                type="text"
                id="searxng-endpoint"
                value=${v3.webSearchEndpoint ?? "http://localhost:8080"}
                placeholder="https://searx.be"
                style="flex:1"
              />
              <button class="btn" disabled=${saving} onClick=${() => {
      const el = document.getElementById("searxng-endpoint");
      if (el && el.value.trim()) save({ webSearchEndpoint: el.value.trim() });
    }}>${t4("common.save")}</button>
            `,
    "填公共 SearXNG 实例地址即可，如 https://searx.be"
  ) : null}
          ${v3.webSearchEngine === "bing" ? fieldRow(
    "Bing API Key",
    html4`
              <input
                type="password"
                value=${draft.bingApiKey ?? ""}
                placeholder=${v3.bingApiKeySet ? "已设置，留空保持现有" : "32位 API Key"}
                onInput=${(e3) => setDraft({ ...draft, bingApiKey: e3.target.value })}
                style="flex:1"
              />
              <button class="btn" disabled=${saving || !(draft.bingApiKey ?? "").trim()} onClick=${() => save({ bingApiKey: draft.bingApiKey })}>${t4("common.save")}</button>
            `,
    "从 https://portal.azure.com 免费获取 (Bing Search v7, 1000次/月)"
  ) : null}
        ` : null}
      </div>

      ${sectionH3(t4("settings.sectionCompute"))}
      <div class="card">
        ${fieldRow(
    t4("settings.proNext"),
    html4`
            <button
              class=${`btn ${v3.proNext ? "primary" : ""}`}
              onClick=${() => save({ proNext: !v3.proNext })}
              disabled=${saving}
            >${v3.proNext ? t4("settings.proArmed") : t4("settings.proArm")}</button>
          `,
    t4("settings.proNextNote")
  )}
      </div>

      ${sectionH3(t4("settings.sectionBudget"))}
      <${BudgetSection}
        state=${deriveBudgetState2(v3.budgetUsd, v3.sessionSpendUsd)}
        saving=${saving}
        onSetCap=${(usd) => save({ budgetUsd: usd })}
        onClear=${() => save({ budgetUsd: null })}
      />

      ${sectionH3(t4("settings.sectionRuntime"))}
      <div class="card">
        ${fieldRow(
    t4("settings.activeModel"),
    html4`<${ModelRow}
            current=${modelControlValue}
            catalog=${catalog}
            saving=${saving}
            locked=${lockedPreset}
            onPick=${(m3) => save({ model: m3 })}
          />`,
    // When preset locks the model, avoid showing cfg.model as if it were active.
    modelNote
  )}
        ${fieldRow(
    t4("settings.editMode"),
    html4`<code class="mono">${v3.editMode}</code>`,
    t4("settings.editModeNote")
  )}
      </div>

      ${sectionH3(t4("settings.sectionDev"))}
      <div class="card">
        ${fieldRow(
    t4("settings.devMode"),
    html4`<button
            class=${`btn ${showDevLog ? "primary" : ""}`}
            onClick=${toggleDevLog}
          >${showDevLog ? t4("common.on") : t4("common.off")}</button>`,
    t4("settings.devModeNote")
  )}
        ${showDevLog ? html4`
          <div style="height:26px;margin-top:6px;display:flex;align-items:center;justify-content:flex-end;font-size:11px;color:var(--fg-3)">
            ${devLogFollowing ? html4`<span>${t4("settings.devFollowing")}</span>` : html4`<button class="btn btn-sm" onClick=${scrollDevLogToBottom}>${devLogNewCount > 0 ? `${t4("settings.devNewLogs", { count: devLogNewCount })} · ` : ""}${t4("settings.devBackToBottom")}</button>`}
          </div>
          <div ref=${devLogPanelRef} onScroll=${handleDevLogScroll} style="max-height:320px;overflow-y:auto;background:var(--bg-0);border:1px solid var(--border-1);border-radius:6px;padding:8px;font-family:var(--font-mono);font-size:11px;line-height:1.6" id="dev-log-panel">
            ${devLogs.length === 0 ? html4`<span style="color:var(--fg-3)">...</span>` : devLogs.map((e3) => html4`
              <div style="display:flex;gap:8px">
                <span style="color:var(--fg-3);flex-shrink:0">${new Date(e3.ts).toLocaleTimeString()}</span>
                <span style="color:var(--fg-2);word-break:break-all">${e3.msg}</span>
              </div>
            `)}
          </div>
        ` : null}
      </div>
    </div>
  `;
}

// dashboard/src/panels/skills.ts
var N210 = N2;
function SkillsPanel() {
  useLang();
  const [data, setData] = d2(null);
  const [error, setError] = d2(null);
  const [open, setOpen] = d2(null);
  const [body, setBody] = d2("");
  const [busy, setBusy] = d2(false);
  const [info, setInfo] = d2(null);
  const [newName, setNewName] = d2("");
  const [newScope, setNewScope] = d2("global");
  const [repairInfo, setRepairInfo] = d2(null);
  const [filter, setFilter] = d2("");
  const [scopeFilter, setScopeFilter] = d2("all");
  const load = q2(async () => {
    try {
      setData(await api("/skills"));
    } catch (err) {
      setError(err.message);
    }
  }, []);
  y2(() => {
    load();
  }, [load]);
  const openSkill = q2(async (scope, name) => {
    setOpen({ scope, name });
    if (scope === "builtin") {
      setBody("");
      return;
    }
    setBusy(true);
    try {
      const r3 = await api(`/skills/${scope}/${encodeURIComponent(name)}`);
      setBody(r3.body);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, []);
  const save = q2(async () => {
    if (!open) return;
    setBusy(true);
    try {
      await api(`/skills/${open.scope}/${encodeURIComponent(open.name)}`, {
        method: "POST",
        body: { body }
      });
      setInfo(t4("skills.saved", { scope: open.scope, name: open.name }));
      setTimeout(() => setInfo(null), 3e3);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [open, body, load]);
  const remove = q2(async () => {
    if (!open) return;
    if (!confirm(t4("skills.deleteConfirm", { scope: open.scope, name: open.name }))) return;
    setBusy(true);
    try {
      const result = await api(`/skills/${open.scope}/${encodeURIComponent(open.name)}`, { method: "DELETE" });
      if (result.disabledBuiltin) {
        setInfo(t4("skills.disabledBuiltin"));
        setTimeout(() => setInfo(null), 4e3);
      }
      setOpen(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [open, load]);
  const create = q2(async () => {
    if (!newName.trim()) return;
    setBusy(true);
    const stub = `---
name: ${newName.trim()}
description: TODO — one-line description that helps the model match this skill
---

# ${newName.trim()}

`;
    try {
      await api(`/skills/${newScope}/${encodeURIComponent(newName.trim())}`, {
        method: "POST",
        body: { body: stub }
      });
      setNewName("");
      await load();
      openSkill(newScope, newName.trim());
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [newName, newScope, load, openSkill]);
  const repairEnvironment = q2(async () => {
    setBusy(true);
    setError(null);
    try {
      await api("/skills/repair", { method: "POST" });
      await load();
      setRepairInfo(t4("skills.repairOk"));
      setTimeout(() => setRepairInfo(null), 4e3);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [load]);
  if (!data && !error)
    return html4`<div class="card" style="color:var(--fg-3)">${t4("skills.loading")}</div>`;
  if (error && !data) return html4`<div class="card accent-err">${error}</div>`;
  if (!data) return null;
  const allWith = [
    ...data.project.map((s3) => ({ scope: "project", ...s3 })),
    ...data.global.map((s3) => ({ scope: "global", ...s3 })),
    ...data.builtin.map((s3) => ({ scope: "builtin", ...s3 }))
  ];
  const scopeFiltered = scopeFilter === "all" ? allWith : allWith.filter((s3) => s3.scope === scopeFilter);
  const filtered = filter.trim() ? scopeFiltered.filter(
    (s3) => s3.name.toLowerCase().includes(filter.toLowerCase()) || (s3.description ?? "").toLowerCase().includes(filter.toLowerCase())
  ) : scopeFiltered;
  return html4`
    <div class="sessions-grid">
      <div class="sessions-list">
        <div class="ssl-h">
          <input
            type="text"
            placeholder=${t4("skills.filterPlaceholder")}
            value=${filter}
            onInput=${(e3) => setFilter(e3.target.value)}
            style="flex:1"
          />
        </div>
        <div class="chips" style="padding:0 12px 8px">
          <span
            class=${`chip-f ${scopeFilter === "all" ? "active" : ""}`}
            onClick=${() => setScopeFilter("all")}
          >${t4("common.all")} <span class="ct">${allWith.length}</span></span>
          <span
            class=${`chip-f ${scopeFilter === "project" ? "active" : ""}`}
            onClick=${() => setScopeFilter("project")}
          >${t4("skills.project")} <span class="ct">${data.project.length}</span></span>
          <span
            class=${`chip-f ${scopeFilter === "global" ? "active" : ""}`}
            onClick=${() => setScopeFilter("global")}
          >${t4("skills.global")} <span class="ct">${data.global.length}</span></span>
          <span
            class=${`chip-f ${scopeFilter === "builtin" ? "active" : ""}`}
            onClick=${() => setScopeFilter("builtin")}
          >${t4("skills.builtin")} <span class="ct">${data.builtin.length}</span></span>
        </div>

        <div style="padding:0 12px 8px;display:flex;gap:6px;flex-wrap:wrap">
          <select
            value=${newScope}
            onChange=${(e3) => setNewScope(e3.target.value)}
            style="flex:0 0 auto;font-size:11.5px;padding:5px 6px"
          >
            <option value="global">${t4("skills.global")}</option>
            ${data.paths.project ? html4`<option value="project">${t4("skills.project")}</option>` : null}
          </select>
          <input
            type="text"
            placeholder=${t4("skills.newSkill")}
            value=${newName}
            onInput=${(e3) => setNewName(e3.target.value)}
            style="flex:1;min-width:0"
          />
          <button class="btn primary" disabled=${busy || !newName.trim()} onClick=${create} style="flex:0 0 auto">+</button>
          <button class="btn" disabled=${busy} onClick=${repairEnvironment} style="flex:0 0 auto">${t4("skills.repairEnv")}</button>
        </div>
        ${repairInfo ? html4`<div style="padding:0 12px 8px"><span class="pill ok">${repairInfo}</span></div>` : null}
        ${info ? html4`<div style="padding:0 12px 8px"><span class="pill ok">${info}</span></div>` : null}
        ${error ? html4`<div class="notice err" style="margin:0 12px 8px">${error}</div>` : null}

        <div class="ssl-rows">
          ${filtered.map((s3) => {
    const sel = open?.scope === s3.scope && open?.name === s3.name;
    return html4`
              <div
                class=${`ssl-row ${sel ? "sel" : ""}`}
                onClick=${() => openSkill(s3.scope, s3.name)}
              >
                <span class="name">
                  ${s3.name}
                  ${s3.managedBuiltin ? html4`<span class="pill">${t4("skills.managedBuiltin")}</span>` : null}
                  ${s3.scope === "builtin" ? html4`<span class="pill">${t4("skills.builtin")}</span>` : null}
                </span>
                <span class="preview">${s3.description ?? t4("skills.noDescription")}</span>
                <span class="meta">
                  ${typeof s3.runs7d === "number" && s3.runs7d > 0 ? html4`<span><span class="v">${s3.runs7d}</span> ${t4("skills.runs7d")}</span>` : null}
                  <span class="dim">${s3.scope}</span>
                </span>
              </div>
            `;
  })}
        </div>
      </div>

      <div class="sessions-detail">
        ${open == null ? html4`<div style="color:var(--fg-3);font-size:13px;text-align:center;padding:60px 20px">
                ${t4("skills.pickHint")}
              </div>` : open.scope === "builtin" ? (() => {
    const builtin = data.builtin.find((b22) => b22.name === open.name);
    return html4`
                    <div class="sessions-detail-h">
                      <span class="name">${open.scope}/${open.name}</span>
                      <span class="ws"><span class="pill">${t4("skills.readOnlyBuiltin")}</span></span>
                      <span class="actions">
                        <button class="btn ghost" onClick=${() => setOpen(null)}>${t4("common.back")}</button>
                      </span>
                    </div>
                    <div style="color:var(--fg-2);font-size:13px;line-height:1.6">
                      ${builtin?.description ?? t4("skills.noDescription")}
                    </div>
                    <div style="margin-top:14px;color:var(--fg-3);font-size:11.5px">
                      ${t4("skills.builtinDesc")}
                    </div>
                  `;
  })() : html4`
                <div class="sessions-detail-h">
                  <span class="name">${open.scope}/${open.name}</span>
                  <span class="ws">${body.length.toLocaleString()} chars</span>
                  <span class="actions">
                    <button class="btn primary" disabled=${busy} onClick=${save}>${t4("common.save")}</button>
                    <button class="btn" disabled=${busy} onClick=${remove}
                      style="border-color:var(--c-err);color:var(--c-err)">${t4("common.delete")}</button>
                    <button class="btn ghost" onClick=${() => setOpen(null)}>${t4("common.back")}</button>
                  </span>
                </div>
                ${info ? html4`<div style="margin-bottom:8px"><span class="pill ok">${info}</span></div>` : null}
                ${error ? html4`<div class="card accent-err" style="margin-bottom:8px">${error}</div>` : null}
                <textarea
                  style="width:100%;min-height:520px;background:var(--bg-input);color:var(--fg-0);border:1px solid var(--bd);border-radius:var(--r);padding:12px;font-family:var(--font-mono);font-size:13px;line-height:1.55;resize:vertical"
                  value=${body}
                  onInput=${(e3) => setBody(e3.target.value)}
                  disabled=${busy}
                ></textarea>
                <div style="margin-top:8px;color:var(--fg-3);font-size:11.5px">
                  ${t4("skills.reloadHint")}
                </div>
              `}
      </div>
    </div>
  `;
}

// dashboard/src/panels/tasks.ts
var N211 = N2;
function emptyTaskDraft() {
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10);
  return {
    id: null,
    kind: "prompt",
    name: "",
    prompt: "",
    executionSource: "prompt",
    skillName: "",
    skillAction: "",
    skillPromptAddendum: "",
    skillArchiveWorkspaceDir: "",
    skillAutoArchive: false,
    skillAutoIndex: false,
    sessionCleanupAction: "preview",
    sessionCleanupStrength: "standard",
    sessionCleanupSemanticMode: "uncertain",
    sessionCleanupPromptAddendum: "",
    knowledgeEnabled: false,
    knowledgeLookbackDays: 30,
    knowledgeAutoIndex: false,
    reportRangeMode: "yesterday",
    reportPeriod: "daily",
    reportStartDate: weekAgo,
    reportEndDate: today,
    reportExport: true,
    workspaceScope: "bound",
    rebindWorkspace: false,
    type: "interval",
    intervalMinutes: 60,
    timeOfDay: "09:00",
    dayOfWeek: 1,
    runMode: "auto",
    weekdaysOnly: false,
    windowEnabled: false,
    windowStart: "09:00",
    windowEnd: "18:00",
    enabled: true
  };
}
function taskDraftFromSchedule(task) {
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10);
  return {
    id: task.id,
    kind: task.kind === "report" ? "report" : task.kind === "session_cleanup" ? "session_cleanup" : "prompt",
    name: task.name ?? "",
    prompt: task.prompt ?? "",
    executionSource: task.skillName ? "skill" : "prompt",
    skillName: task.skillName ?? "",
    skillAction: task.skillAction ?? "",
    skillPromptAddendum: task.skillPromptAddendum ?? "",
    skillArchiveWorkspaceDir: task.skillArchiveWorkspaceDir ?? "",
    skillAutoArchive: task.skillAutoArchive === true,
    skillAutoIndex: task.skillAutoIndex === true,
    sessionCleanupAction: task.sessionCleanupAction === "delete" ? "delete" : "preview",
    sessionCleanupStrength: ["conservative", "standard", "aggressive"].includes(task.sessionCleanupStrength) ? task.sessionCleanupStrength : "standard",
    sessionCleanupSemanticMode: ["off", "uncertain", "deep"].includes(task.sessionCleanupSemanticMode) ? task.sessionCleanupSemanticMode : "uncertain",
    sessionCleanupPromptAddendum: task.sessionCleanupPromptAddendum ?? "",
    knowledgeEnabled: task.knowledgeEnabled === true,
    knowledgeLookbackDays: Math.max(1, Math.min(365, Number(task.knowledgeLookbackDays) || 30)),
    knowledgeAutoIndex: task.knowledgeAutoIndex === true,
    reportRangeMode: task.reportRangeMode ?? (task.reportPeriod === "daily" ? "yesterday" : task.reportPeriod === "yearly" ? "this_year" : task.reportPeriod === "custom" ? "custom" : "last_week"),
    reportPeriod: task.reportPeriod ?? "daily",
    reportStartDate: task.reportStartDate ?? weekAgo,
    reportEndDate: task.reportEndDate ?? today,
    reportExport: task.reportExport !== false,
    workspaceScope: task.workspaceScope === "current" ? "current" : "bound",
    rebindWorkspace: false,
    type: task.type === "daily" || task.type === "weekly" ? task.type : "interval",
    intervalMinutes: Math.max(1, Math.round((task.intervalMs ?? 60 * 60 * 1e3) / 6e4)),
    timeOfDay: task.timeOfDay ?? "09:00",
    dayOfWeek: Number.isFinite(task.dayOfWeek) ? task.dayOfWeek : 1,
    runMode: task.runMode ?? "auto",
    weekdaysOnly: task.weekdaysOnly === true,
    windowEnabled: task.windowEnabled === true,
    windowStart: task.windowStart ?? "09:00",
    windowEnd: task.windowEnd ?? "18:00",
    enabled: task.enabled !== false
  };
}
function fmtScheduleDate(iso) {
  if (!iso) return t4("tasks.never");
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "—";
  return new Date(ms).toLocaleString();
}
function fmtScheduleRule(task) {
  if (task.type === "daily") return `${t4("tasks.daily")} ${task.timeOfDay ?? "09:00"}`;
  if (task.type === "weekly") {
    const labels = scheduleWeekdayLabels();
    const day = labels[Number.isFinite(task.dayOfWeek) ? task.dayOfWeek : 1] ?? labels[1];
    return `${t4("tasks.weekly")} ${day} ${task.timeOfDay ?? "09:00"}`;
  }
  const mins = Math.max(1, Math.round((task.intervalMs ?? 0) / 6e4));
  if (mins < 60) return `${t4("tasks.every")} ${mins}m`;
  if (mins % 1440 === 0) return `${t4("tasks.every")} ${mins / 1440}d`;
  if (mins % 60 === 0) return `${t4("tasks.every")} ${mins / 60}h`;
  return `${t4("tasks.every")} ${mins}m`;
}
function scheduleWeekdayLabels() {
  return getLang() === "zh-CN" ? ["周日", "周一", "周二", "周三", "周四", "周五", "周六"] : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
}
function fmtScheduleDuration(ms) {
  if (!Number.isFinite(ms)) return "—";
  const seconds = Math.max(0, Math.round(ms / 1e3));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes < 60) return rest ? `${minutes}m ${rest}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const minRest = minutes % 60;
  return minRest ? `${hours}h ${minRest}m` : `${hours}h`;
}
function fmtScheduleTokens(value) {
  return Number.isFinite(value) ? Math.round(value).toLocaleString() : "—";
}
function fmtScheduleCost(value) {
  return Number.isFinite(value) ? `$${value.toFixed(6)}` : "—";
}
function fmtTaskKind(task) {
  if (task?.kind === "session_cleanup") return t4("tasks.kindSessionCleanup");
  if (task?.kind === "report") return t4("tasks.kindReport");
  return task?.skillName ? `${t4("tasks.executionSkill")} · ${task.skillName}` : t4("tasks.kindPrompt");
}
function fmtReportPeriod(period) {
  if (period === "daily") return t4("tasks.reportDaily");
  if (period === "weekly") return t4("tasks.reportWeekly");
  if (period === "yearly") return t4("tasks.reportYearly");
  if (period === "custom") return t4("tasks.reportCustom");
  return period || "—";
}
function fmtReportRangeMode(mode, period) {
  if (mode === "today") return t4("tasks.reportToday");
  if (mode === "yesterday") return t4("tasks.reportYesterday");
  if (mode === "this_week") return t4("tasks.reportThisWeek");
  if (mode === "last_week") return t4("tasks.reportLastWeek");
  if (mode === "last_7_days") return t4("tasks.reportLast7Days");
  if (mode === "last_30_days") return t4("tasks.reportLast30Days");
  if (mode === "this_year") return t4("tasks.reportThisYear");
  if (mode === "last_year") return t4("tasks.reportLastYear");
  if (mode === "custom") return t4("tasks.reportFixedRange");
  return fmtReportPeriod(period);
}
function fmtReportRange(item) {
  if (!item?.reportStart && !item?.reportEnd) return "—";
  const start = item.reportStart ? fmtScheduleDate(item.reportStart) : "—";
  const end = item.reportEnd ? fmtScheduleDate(item.reportEnd) : "—";
  return `${start} - ${end}`;
}
function taskStatusPill(task) {
  if (task.workspaceMismatch) return html4`<span class="pill warn">${t4("tasks.workspaceMismatch")}</span>`;
  if (!task.enabled) return html4`<span class="pill">${t4("tasks.disabled")}</span>`;
  if (task.lastStatus === "running") return html4`<span class="pill info">${t4("tasks.running")}</span>`;
  if (task.lastStatus === "stopping") return html4`<span class="pill warn">停止中</span>`;
  if (task.lastStatus === "completed") return html4`<span class="pill ok">${t4("tasks.completed")}</span>`;
  if (task.lastStatus === "cancelled") return html4`<span class="pill warn">${t4("tasks.cancelled")}</span>`;
  if (task.lastStatus === "failed") return html4`<span class="pill err">${t4("tasks.failed")}</span>`;
  if (task.lastStatus === "accepted") return html4`<span class="pill ok">${t4("tasks.accepted")}</span>`;
  if (task.lastStatus === "skipped") return html4`<span class="pill warn">${t4("tasks.skipped")}</span>`;
  if (task.lastStatus === "deferred") return html4`<span class="pill warn">${t4("tasks.deferred")}${task.queued && task.queuePosition ? ` · ${task.queuePosition}` : ""}</span>`;
  if (task.lastStatus === "waiting_auth") return html4`<span class="pill warn">${t4("tasks.skillWaitingAuth")}</span>`;
  if (task.lastStatus === "pending_confirmation") return html4`<span class="pill warn">${t4("tasks.pendingConfirmation")}</span>`;
  if (task.lastStatus === "rejected") return html4`<span class="pill err">${t4("tasks.rejected")}</span>`;
  return html4`<span class="pill info">${t4("tasks.enabled")}</span>`;
}
function scheduleRunPill(status) {
  if (status === "running") return html4`<span class="pill info">${t4("tasks.running")}</span>`;
  if (status === "stopping") return html4`<span class="pill warn">停止中</span>`;
  if (status === "completed") return html4`<span class="pill ok">${t4("tasks.completed")}</span>`;
  if (status === "cancelled") return html4`<span class="pill warn">${t4("tasks.cancelled")}</span>`;
  if (status === "failed") return html4`<span class="pill err">${t4("tasks.failed")}</span>`;
  if (status === "accepted") return html4`<span class="pill ok">${t4("tasks.accepted")}</span>`;
  if (status === "skipped") return html4`<span class="pill warn">${t4("tasks.skipped")}</span>`;
  if (status === "deferred") return html4`<span class="pill warn">${t4("tasks.deferred")}</span>`;
  if (status === "waiting_auth") return html4`<span class="pill warn">${t4("tasks.skillWaitingAuth")}</span>`;
  if (status === "pending_confirmation") return html4`<span class="pill warn">${t4("tasks.pendingConfirmation")}</span>`;
  if (status === "rejected") return html4`<span class="pill err">${t4("tasks.rejected")}</span>`;
  return html4`<span class="pill">${status || "—"}</span>`;
}
function ScheduledTasksPanel() {
  useLang();
  const { data, error, loading, refresh } = usePoll("/schedules", 3e4);
  const { data: semanticConfig } = usePoll("/semantic/config", 3e4);
  const { data: skillTemplateData } = usePoll("/schedules/templates", 6e4);
  const [selectedId, setSelectedId] = d2(null);
  const [draft, setDraft] = d2(() => emptyTaskDraft());
  const [busy, setBusy] = d2(false);
  const [notice, setNotice] = d2(null);
  const [pendingRunNotice, setPendingRunNotice] = d2(null);
  y2(() => {
    const unsubChanged = subscribeSse("schedule-changed", () => refresh());
    const unsubRun = subscribeSse("schedule-run", () => refresh());
    return () => {
      unsubChanged();
      unsubRun();
    };
  }, [refresh]);
  const schedules = data?.schedules ?? [];
  const skillTemplates = (skillTemplateData?.integrations ?? []).flatMap((integration) => integration.compatible ? (integration.templates ?? []).map((template) => ({ ...template, skillName: integration.id, integrationName: integration.displayName, integrationVersion: integration.version })) : []);
  const selectedSkillTemplate = skillTemplates.find((template) => template.skillName === draft.skillName && template.id === draft.skillAction) ?? null;
  const pendingSchedules = schedules.filter((task) => task.lastStatus === "pending_confirmation");
  const selected = schedules.find((task) => task.id === selectedId) ?? null;
  const latestRun = selected?.history?.[0] ?? null;
  y2(() => {
    if (!pendingRunNotice) return;
    const task = schedules.find((item) => item.id === pendingRunNotice.taskId);
    const run = task?.history?.find((item) => !pendingRunNotice.runId || item.runId === pendingRunNotice.runId);
    if (!run || run.status === "running") return;
    if (run.status === "completed") setNotice(t4("tasks.runCompleted"));
    else if (run.status === "cancelled") setNotice(t4("tasks.runCancelled"));
    else if (run.status === "failed") setNotice(t4("tasks.runFailed"));
    else if (run.status === "skipped") setNotice(t4("tasks.runSkipped"));
    else if (run.status === "rejected") setNotice(t4("tasks.runRejected"));
    else if (run.status === "pending_confirmation") setNotice(t4("tasks.runPending"));
    else setNotice(run.reason || run.summary || t4("tasks.noSummary"));
    setPendingRunNotice(null);
  }, [pendingRunNotice, schedules]);
  const selectTask = q2((task) => {
    setSelectedId(task.id);
    setDraft(taskDraftFromSchedule(task));
    setNotice(null);
    setPendingRunNotice(null);
  }, []);
  const createNew = q2(() => {
    setSelectedId(null);
    setDraft(emptyTaskDraft());
    setNotice(null);
    setPendingRunNotice(null);
  }, []);
  const saveTask = q2(async () => {
    const body = {
      kind: draft.kind,
      name: draft.name,
      prompt: draft.prompt,
      skillName: draft.kind === "prompt" && draft.executionSource === "skill" ? draft.skillName : null,
      skillAction: draft.kind === "prompt" && draft.executionSource === "skill" ? draft.skillAction : null,
      skillPromptAddendum: draft.kind === "prompt" && draft.executionSource === "skill" ? draft.skillPromptAddendum : "",
      skillArchiveWorkspaceDir: draft.kind === "prompt" && draft.executionSource === "skill" ? draft.skillArchiveWorkspaceDir : null,
      skillAutoArchive: draft.kind === "prompt" && draft.executionSource === "skill" ? draft.skillAutoArchive : false,
      skillAutoIndex: draft.kind === "prompt" && draft.executionSource === "skill" ? draft.skillAutoIndex : false,
      sessionCleanupAction: draft.sessionCleanupAction,
      sessionCleanupStrength: draft.sessionCleanupStrength,
      sessionCleanupSemanticMode: draft.sessionCleanupSemanticMode,
      sessionCleanupPromptAddendum: draft.sessionCleanupPromptAddendum,
      knowledgeEnabled: draft.knowledgeEnabled,
      knowledgeLookbackDays: draft.knowledgeLookbackDays,
      knowledgeAutoIndex: draft.knowledgeAutoIndex,
      reportRangeMode: draft.reportRangeMode,
      reportPeriod: draft.reportPeriod,
      reportStartDate: draft.reportStartDate,
      reportEndDate: draft.reportEndDate,
      reportExport: draft.reportExport,
      workspaceScope: draft.workspaceScope,
      rebindWorkspace: draft.rebindWorkspace === true,
      type: draft.type,
      runMode: draft.runMode,
      weekdaysOnly: draft.weekdaysOnly,
      windowEnabled: draft.windowEnabled,
      windowStart: draft.windowStart,
      windowEnd: draft.windowEnd,
      enabled: draft.enabled
    };
    if (draft.type === "daily" || draft.type === "weekly") {
      body.timeOfDay = draft.timeOfDay;
      if (draft.type === "weekly") body.dayOfWeek = Number(draft.dayOfWeek);
    } else body.intervalMs = Math.max(1, Number(draft.intervalMinutes) || 1) * 6e4;
    setBusy(true);
    setNotice(null);
    setPendingRunNotice(null);
    try {
      const res = draft.id ? await api(`/schedules/${encodeURIComponent(draft.id)}`, { method: "POST", body }) : await api("/schedules", { method: "POST", body });
      setSelectedId(res.schedule.id);
      setDraft(taskDraftFromSchedule(res.schedule));
      setNotice(t4("tasks.saved"));
      await refresh();
    } catch (err) {
      setNotice(err.message);
    } finally {
      setBusy(false);
    }
  }, [draft, refresh]);
  const toggleTask = q2(async (task) => {
    setBusy(true);
    setNotice(null);
    setPendingRunNotice(null);
    try {
      const res = await api(`/schedules/${encodeURIComponent(task.id)}/toggle`, { method: "POST", body: { enabled: !task.enabled } });
      if (selectedId === task.id) setDraft(taskDraftFromSchedule(res.schedule));
      await refresh();
    } catch (err) {
      setNotice(err.message);
    } finally {
      setBusy(false);
    }
  }, [refresh, selectedId]);
  const runTask = q2(async (task) => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await api(`/schedules/${encodeURIComponent(task.id)}/run`, { method: "POST", body: {} });
      if (res.queued) {
        setPendingRunNotice(null);
        setNotice(t4("tasks.runQueued"));
      } else {
        setPendingRunNotice({ taskId: task.id, runId: res.runId || null });
        setNotice(t4("tasks.runAccepted"));
      }
      await refresh();
    } catch (err) {
      setPendingRunNotice(null);
      setNotice(err.message);
      await refresh();
    } finally {
      setBusy(false);
    }
  }, [refresh]);
  const cancelTask = q2(async (task) => {
    setBusy(true);
    setNotice(null);
    try {
      await api(`/schedules/${encodeURIComponent(task.id)}/cancel`, { method: "POST", body: {} });
      setNotice("已请求停止任务");
      await refresh();
    } catch (err) {
      setNotice(err.message);
    } finally {
      setBusy(false);
    }
  }, [refresh]);
  const viewRunConversation = q2((run) => {
    const id = run?.assistantMessageId || run?.userMessageId;
    if (id) requestChatMessageJump(id);
  }, []);
  const taskResultFileAction = q2(async (kind, path) => {
    if (!path) return;
    try {
      if (kind === "preview") {
        await showFileArtifactPreview({ path });
      } else if (kind === "folder") {
        await api("/artifacts/open-folder", { method: "POST", body: { path } });
        showToast("已打开所在文件夹", "info");
      } else if (kind === "copy") {
        await writeClipboardText(path);
        showToast("路径已复制", "info");
      }
    } catch (err) {
      showToast(err.message || "文件操作失败", "error", 5e3);
    }
  }, []);
  const pickSkillArchiveWorkspace = q2(async () => {
    try {
      const path = await pickWorkspaceDirectoryFromBridge();
      if (path) setDraft((current) => ({ ...current, skillArchiveWorkspaceDir: path }));
    } catch (err) {
      showToast(err.message || "选择归档工作区失败", "error", 5e3);
    }
  }, []);
  const archiveTaskResult = q2(async (task, run) => {
    if (!task?.id || !run?.runId) return;
    setBusy(true);
    setNotice(null);
    try {
      const result = await api(`/schedules/${encodeURIComponent(task.id)}/archive`, {
        method: "POST",
        body: { runId: run.runId, autoIndex: task.skillAutoIndex === true }
      });
      showToast(result.duplicate ? "该结果已经归档" : "已归档到知识库", "info", 4e3);
      await refresh();
    } catch (err) {
      setNotice(err.message || "知识归档失败");
      await refresh();
    } finally {
      setBusy(false);
    }
  }, [refresh]);
  const deleteTask = q2(async (task) => {
    if (!confirm(t4("tasks.deleteConfirm"))) return;
    setBusy(true);
    setNotice(null);
    setPendingRunNotice(null);
    try {
      await api(`/schedules/${encodeURIComponent(task.id)}`, { method: "DELETE", body: {} });
      if (selectedId === task.id) createNew();
      setNotice(t4("tasks.deleted"));
      await refresh();
    } catch (err) {
      setNotice(err.message);
    } finally {
      setBusy(false);
    }
  }, [createNew, refresh, selectedId]);
  if (loading && !data) return html4`<div class="card" style="color:var(--fg-3)">${t4("tasks.loading")}</div>`;
  if (error) return html4`<div class="card accent-err">${t4("common.loadingFailed", { name: "tasks", error: error.message })}</div>`;
  const validWindow = !draft.windowEnabled || /^([01]\d|2[0-3]):[0-5]\d$/.test(draft.windowStart) && /^([01]\d|2[0-3]):[0-5]\d$/.test(draft.windowEnd) && draft.windowStart < draft.windowEnd;
  const intervalMinutes = Number(draft.intervalMinutes);
  const validInterval = Number.isFinite(intervalMinutes) && intervalMinutes >= 1 && intervalMinutes <= 30 * 24 * 60;
  const validSchedule = draft.type === "daily" || draft.type === "weekly" ? /^([01]\d|2[0-3]):[0-5]\d$/.test(draft.timeOfDay) : validInterval;
  const validReport = draft.reportRangeMode === "custom" ? !!draft.reportStartDate && !!draft.reportEndDate && draft.reportEndDate >= draft.reportStartDate : true;
  const validSkillAddendum = draft.executionSource !== "skill" || draft.skillAction !== "topic-investigation" || draft.skillPromptAddendum.trim().length > 0;
  const validPromptTask = draft.executionSource === "skill" ? Boolean(selectedSkillTemplate) && validSkillAddendum : draft.prompt.trim().length > 0;
  const canSave = validWindow && validSchedule && (draft.kind === "report" ? validReport : draft.kind === "session_cleanup" ? true : validPromptTask);
  const embeddingApiReady = semanticConfig?.provider === "openai-compat" && semanticConfig?.openaiCompat?.apiKeySet === true;
  const weekdayLabels = scheduleWeekdayLabels();
  return html4`
    <div class="sessions-grid">
      <div class="sessions-list">
        <div class="ssl-h">
          <strong>${t4("tasks.title")}</strong>
          <button class="btn ghost" style="margin-left:auto" onClick=${createNew}>${t4("tasks.create")}</button>
        </div>
        ${pendingSchedules.length > 0 ? html4`
          <div class="card accent-warn" style="margin:0 12px 10px">
            <div class="card-h"><span class="title">${t4("tasks.pendingTitle")}</span></div>
            <div class="card-b" style="padding-bottom:8px">${t4("tasks.pendingHint")}</div>
            <div style="display:flex;flex-direction:column;gap:6px">
              ${pendingSchedules.map((task) => html4`
                <div style="display:flex;gap:8px;align-items:center;min-width:0">
                  <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${task.name || t4("tasks.title")}</span>
                  <button class="btn" disabled=${busy} onClick=${(ev) => {
    ev.stopPropagation();
    selectTask(task);
    runTask(task);
  }}>${t4("tasks.runNow")}</button>
                </div>
              `)}
            </div>
          </div>
        ` : null}
        <div class="ssl-rows">
          ${schedules.length === 0 ? html4`<div style="padding:18px;color:var(--fg-3);font-size:13px">${t4("tasks.noTasks")}</div>` : schedules.map((task) => html4`
            <div class=${`ssl-row ${task.id === selectedId ? "sel" : ""}`} onClick=${() => selectTask(task)}>
              <span class="name">${task.name || t4("tasks.title")} ${taskStatusPill(task)}</span>
              <span class="preview">${fmtTaskKind(task)} · ${fmtScheduleRule(task)}</span>
              <span class="meta">
                <span>${t4("tasks.nextRun")}: <span class="v">${fmtScheduleDate(task.nextRunAt)}</span></span>
                <span>${t4("tasks.lastRun")}: ${task.lastRunAt ? fmtScheduleDate(task.lastRunAt) : t4("tasks.never")}</span>
                <button class="btn btn-sm" disabled=${busy} style="margin-left:auto" onClick=${(ev) => {
    ev.stopPropagation();
    selectTask(task);
    runTask(task);
  }}>${t4("tasks.testRun")}</button>
              </span>
            </div>
          `)}
        </div>
      </div>

      <div class="sessions-detail">
        <div class="sessions-detail-h">
          <span class="name">${draft.id ? draft.name || t4("tasks.title") : t4("tasks.create")}</span>
          <span class="ws">${selected ? `${fmtScheduleRule(selected)} · ${t4("tasks.nextRun")}: ${fmtScheduleDate(selected.nextRunAt)}` : t4("tasks.selectHint")}</span>
          ${selected ? html4`<span class="actions">${selected.lastStatus === "running" || selected.lastStatus === "stopping" ? html4`<button class="btn danger" disabled=${busy || selected.lastStatus === "stopping"} onClick=${() => cancelTask(selected)}>${selected.lastStatus === "stopping" ? "停止中..." : "停止任务"}</button>` : html4`<button class="btn primary" disabled=${busy} onClick=${() => runTask(selected)}>${t4("tasks.testRun")}</button>`}</span>` : null}
        </div>
        ${selected?.workspaceMismatch ? html4`<div class="card accent-warn" style="margin-bottom:10px">${t4("tasks.workspaceMismatchHint")}</div>` : null}
        ${notice ? html4`<div class=${`card ${notice === t4("tasks.saved") || notice === t4("tasks.deleted") || notice === t4("tasks.runAccepted") || notice === t4("tasks.runCompleted") || notice === t4("tasks.runPending") ? "accent-brand" : "accent-err"}`} style="margin-bottom:10px">${notice}</div>` : null}
        ${selected ? html4`
          <div class="card" style="margin-bottom:10px">
            <div class="card-h">
              <span class="title">${t4("tasks.latestResult")}</span>
              ${latestRun ? html4`<span>${scheduleRunPill(latestRun.status)}</span>` : null}
            </div>
            ${latestRun ? html4`
              <div class="card-b" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;border-bottom:1px solid var(--bd)">
                <div><div style="color:var(--fg-3);font-size:11px">${t4("tasks.lastRun")}</div><div class="mono" style="font-size:12px">${fmtScheduleDate(latestRun.startedAt)}</div></div>
                <div><div style="color:var(--fg-3);font-size:11px">${t4("tasks.duration")}</div><div class="mono" style="font-size:12px">${fmtScheduleDuration(latestRun.durationMs)}</div></div>
                <div><div style="color:var(--fg-3);font-size:11px">${t4("tasks.tokens")}</div><div class="mono" style="font-size:12px">${fmtScheduleTokens(latestRun.lastPromptTokens)}</div></div>
                <div><div style="color:var(--fg-3);font-size:11px">${t4("tasks.cost")}</div><div class="mono" style="font-size:12px">${fmtScheduleCost(latestRun.lastTurnCostUsd)}</div></div>
              </div>
              ${latestRun.reportPeriod ? html4`
                <div class="card-b" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;border-bottom:1px solid var(--bd)">
                  <div><div style="color:var(--fg-3);font-size:11px">${t4("tasks.reportScope")}</div><div style="font-size:12px">${fmtReportRangeMode(latestRun.reportRangeMode, latestRun.reportPeriod)}</div></div>
                  <div><div style="color:var(--fg-3);font-size:11px">${t4("tasks.reportRange")}</div><div class="mono" style="font-size:12px">${fmtReportRange(latestRun)}</div></div>
                  <div><div style="color:var(--fg-3);font-size:11px">${t4("tasks.reportSessions")}</div><div class="mono" style="font-size:12px">${fmtScheduleTokens(latestRun.reportSessions)}</div></div>
                  <div><div style="color:var(--fg-3);font-size:11px">${t4("tasks.reportMessages")}</div><div class="mono" style="font-size:12px">${fmtScheduleTokens(latestRun.reportMessages)}</div></div>
                </div>
              ` : null}
              ${latestRun.cleanupCandidates !== null && latestRun.cleanupCandidates !== void 0 ? html4`
                <div class="card-b" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;border-bottom:1px solid var(--bd)">
                  <div><div style="color:var(--fg-3);font-size:11px">${t4("tasks.sessionCleanupAction")}</div><div style="font-size:12px">${latestRun.cleanupAction === "delete" ? t4("tasks.sessionCleanupDelete") : t4("tasks.sessionCleanupPreview")}</div></div>
                  <div><div style="color:var(--fg-3);font-size:11px">${t4("tasks.cleanupCandidates")}</div><div class="mono" style="font-size:12px">${fmtScheduleTokens(latestRun.cleanupCandidates)}</div></div>
                  <div><div style="color:var(--fg-3);font-size:11px">${t4("tasks.cleanupDeleted")}</div><div class="mono" style="font-size:12px">${fmtScheduleTokens(latestRun.cleanupDeleted)}</div></div>
                  <div><div style="color:var(--fg-3);font-size:11px">${t4("tasks.cleanupArchive")}</div><div class="mono" style="font-size:12px">${fmtScheduleTokens(latestRun.cleanupArchive)}</div></div>
                  <div><div style="color:var(--fg-3);font-size:11px">${t4("tasks.cleanupKeep")}</div><div class="mono" style="font-size:12px">${fmtScheduleTokens(latestRun.cleanupKeep)}</div></div>
                  <div><div style="color:var(--fg-3);font-size:11px">${t4("tasks.cleanupExtract")}</div><div class="mono" style="font-size:12px">${fmtScheduleTokens(latestRun.cleanupExtract)}</div></div>
                  <div><div style="color:var(--fg-3);font-size:11px">${t4("tasks.cleanupSemanticReviewed")}</div><div class="mono" style="font-size:12px">${fmtScheduleTokens(latestRun.cleanupSemanticReviewed)}</div></div>
                  <div><div style="color:var(--fg-3);font-size:11px">${t4("tasks.cleanupFailed")}</div><div class="mono" style="font-size:12px">${fmtScheduleTokens(latestRun.cleanupFailed)}</div></div>
                </div>
              ` : null}
              ${latestRun.knowledgeSessionsProcessed !== null && latestRun.knowledgeSessionsProcessed !== void 0 ? html4`
                <div class="card-b" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;border-bottom:1px solid var(--bd)">
                  <div><div style="color:var(--fg-3);font-size:11px">${t4("tasks.knowledgeSessions")}</div><div class="mono" style="font-size:12px">${fmtScheduleTokens(latestRun.knowledgeSessionsProcessed)}</div></div>
                  <div><div style="color:var(--fg-3);font-size:11px">${t4("tasks.knowledgeDocuments")}</div><div class="mono" style="font-size:12px">${fmtScheduleTokens((latestRun.knowledgeDocumentsCreated || 0) + (latestRun.knowledgeDocumentsUpdated || 0))}</div></div>
                  <div><div style="color:var(--fg-3);font-size:11px">AI 评估</div><div class="mono" style="font-size:12px">${fmtScheduleTokens(latestRun.knowledgeAIReviewed || 0)}</div></div>
                  <div><div style="color:var(--fg-3);font-size:11px">AI 评估失败</div><div class="mono" style="font-size:12px">${fmtScheduleTokens(latestRun.knowledgeAIFailed || 0)}</div></div>
                  <div><div style="color:var(--fg-3);font-size:11px">低价值回收候选</div><div class="mono" style="font-size:12px">${fmtScheduleTokens(latestRun.knowledgeRejectedLowValue || 0)}</div></div>
                  <div><div style="color:var(--fg-3);font-size:11px">文档质量拒绝</div><div class="mono" style="font-size:12px">${fmtScheduleTokens(latestRun.knowledgeDocumentsRejected || 0)}</div></div>
                  <div><div style="color:var(--fg-3);font-size:11px">移除旧主题</div><div class="mono" style="font-size:12px">${fmtScheduleTokens(latestRun.knowledgeTopicsRemoved || 0)}</div></div>
                  <div><div style="color:var(--fg-3);font-size:11px">embedding</div><div style="font-size:12px">${latestRun.semanticIndexStatus || "-"}</div></div>
                </div>
              ` : null}
              <div class="card-b" style="display:flex;flex-direction:column;gap:6px">
                <div style="display:flex;gap:8px;align-items:center;color:var(--fg-3);font-size:12px">
                  <span>${t4("tasks.source")}: ${latestRun.manual ? t4("tasks.manual") : t4("tasks.scheduled")}</span>
                  ${latestRun.runId ? html4`<code class="mono" style="font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${latestRun.runId}</code>` : null}
                  ${latestRun.assistantMessageId || latestRun.userMessageId ? html4`<button class="btn btn-sm" style="margin-left:auto" onClick=${() => viewRunConversation(latestRun)}>${t4("tasks.viewConversation")}</button>` : null}
                </div>
                <div style="color:var(--fg-2);overflow-wrap:anywhere">${latestRun.summary || latestRun.reason || t4("tasks.noSummary")}</div>
                ${latestRun.reportPath ? html4`
                  <div style="display:flex;flex-direction:column;gap:6px;color:var(--fg-3);font-size:12px;overflow-wrap:anywhere">
                    <div style="display:flex;gap:6px;flex-wrap:wrap">
                      <button class="btn btn-sm" onClick=${() => taskResultFileAction("preview", latestRun.reportPath)}>预览报告</button>
                      ${selected?.skillName ? html4`<button class="btn btn-sm" disabled=${busy || !selected.skillArchiveWorkspaceDir || latestRun.knowledgeArchiveStatus === "accepted" || latestRun.knowledgeArchiveStatus === "duplicate"} title=${selected.skillArchiveWorkspaceDir ? "通过质量审核后归档到固定工作区" : "请先在下方选择归档工作区并保存任务"} onClick=${() => archiveTaskResult(selected, latestRun)}>${latestRun.knowledgeArchiveStatus === "accepted" || latestRun.knowledgeArchiveStatus === "duplicate" ? "已归档" : "归档到知识库"}</button>` : null}
                    </div>
                    <div>${t4("tasks.reportStored")}</div>
                    ${latestRun.knowledgeArchiveError ? html4`<div style="color:var(--c-warn)">知识归档：${latestRun.knowledgeArchiveError}</div>` : null}
                    ${latestRun.reportExportPath ? html4`
                      <div>${t4("tasks.reportExportPath")}: <code class="mono">${latestRun.reportExportPath}</code></div>
                      <div style="display:flex;gap:6px;flex-wrap:wrap">
                        <button class="btn btn-sm" onClick=${() => taskResultFileAction("folder", latestRun.reportExportPath)}>所在文件夹</button>
                        <button class="btn btn-sm" onClick=${() => taskResultFileAction("copy", latestRun.reportExportPath)}>复制路径</button>
                      </div>
                    ` : null}
                    ${latestRun.reportExportError ? html4`<div style="color:var(--c-warn)">${t4("tasks.reportExportFailed", { error: latestRun.reportExportError })}</div>` : null}
                  </div>
                ` : null}
                ${latestRun.cleanupTrashRoot ? html4`<div style="color:var(--fg-3);font-size:12px;overflow-wrap:anywhere">${t4("tasks.cleanupTrashRoot")}: <code class="mono">${latestRun.cleanupTrashRoot}</code></div>` : null}
                ${latestRun.knowledgeOutputPaths?.length ? html4`
                  <div style="display:flex;flex-direction:column;gap:5px;color:var(--fg-3);font-size:12px">
                    ${latestRun.knowledgeOutputPaths.map((path) => html4`
                      <div style="display:flex;gap:6px;align-items:center;min-width:0">
                        <code class="mono" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${path}</code>
                        <button class="btn btn-sm" onClick=${() => taskResultFileAction("preview", path)}>预览</button>
                      </div>
                    `)}
                  </div>
                ` : null}
              </div>
            ` : html4`<div class="card-b">${t4("tasks.noHistory")}</div>`}
          </div>
        ` : null}
        <div class="card">
          <div class="form-row">
            <span class="lbl">${t4("tasks.taskKind")}</span>
            <select class="input mono" value=${draft.kind} onChange=${(e3) => {
    const kind = e3.target.value;
    setDraft({
      ...draft,
      kind,
      runMode: kind === "prompt" ? draft.runMode : "auto",
      executionSource: kind === "prompt" ? draft.executionSource : "prompt",
      skillName: kind === "prompt" ? draft.skillName : "",
      skillAction: kind === "prompt" ? draft.skillAction : ""
    });
  }}>
              <option value="prompt">${t4("tasks.kindPrompt")}</option>
              <option value="report">${t4("tasks.kindReport")}</option>
              <option value="session_cleanup">${t4("tasks.kindSessionCleanup")}</option>
            </select>
          </div>
          <div class="form-row">
            <span class="lbl">${t4("tasks.name")}</span>
            <input class="input" type="text" value=${draft.name} onInput=${(e3) => setDraft({ ...draft, name: e3.target.value })} />
          </div>
          ${draft.kind === "session_cleanup" ? html4`
            <div class="form-row">
              <span class="lbl">${t4("tasks.sessionCleanupAction")}</span>
              <select class="input mono" value=${draft.sessionCleanupAction} onChange=${(e3) => setDraft({ ...draft, sessionCleanupAction: e3.target.value })}>
                <option value="preview">${t4("tasks.sessionCleanupPreview")}</option>
                <option value="delete">${t4("tasks.sessionCleanupDelete")}</option>
              </select>
            </div>
            <div class="form-row">
              <span class="lbl">${t4("tasks.sessionCleanupStrength")}</span>
              <select class="input mono" value=${draft.sessionCleanupStrength} onChange=${(e3) => setDraft({ ...draft, sessionCleanupStrength: e3.target.value })}>
                <option value="conservative">${t4("tasks.sessionCleanupConservative")}</option>
                <option value="standard">${t4("tasks.sessionCleanupStandard")}</option>
                <option value="aggressive">${t4("tasks.sessionCleanupAggressive")}</option>
              </select>
            </div>
            <div class="form-row">
              <span class="lbl">${t4("tasks.sessionCleanupSemanticMode")}</span>
              <select class="input mono" value=${draft.sessionCleanupSemanticMode} onChange=${(e3) => setDraft({ ...draft, sessionCleanupSemanticMode: e3.target.value })}>
                <option value="off">${t4("tasks.sessionCleanupSemanticOff")}</option>
                <option value="uncertain">${t4("tasks.sessionCleanupSemanticUncertain")}</option>
                <option value="deep">${t4("tasks.sessionCleanupSemanticDeep")}</option>
              </select>
            </div>
            <div class="form-row" style="align-items:flex-start">
              <span class="lbl">${t4("tasks.sessionCleanupPromptAddendum")}</span>
              <textarea
                class="input"
                maxlength="4000"
                rows="5"
                value=${draft.sessionCleanupPromptAddendum}
                onInput=${(e3) => setDraft({ ...draft, sessionCleanupPromptAddendum: e3.target.value.slice(0, 4e3) })}
                style="resize:vertical;line-height:1.5"
              ></textarea>
            </div>
            <label class="checkbox-row" style="margin-top:8px;cursor:pointer">
              <input type="checkbox" checked=${draft.knowledgeEnabled} onChange=${(e3) => setDraft({ ...draft, knowledgeEnabled: e3.target.checked, knowledgeAutoIndex: e3.target.checked ? draft.knowledgeAutoIndex : false })} />
              <span>${t4("tasks.knowledgeEnabled")}</span>
            </label>
            ${draft.knowledgeEnabled ? html4`
              <div class="form-row">
                <span class="lbl">${t4("tasks.knowledgeLookbackDays")}</span>
                <input class="input mono" type="number" min="1" max="365" value=${draft.knowledgeLookbackDays} onInput=${(e3) => setDraft({ ...draft, knowledgeLookbackDays: Math.max(1, Math.min(365, Number(e3.target.value) || 30)) })} />
              </div>
              <label class="checkbox-row" style="margin-top:8px;cursor:${embeddingApiReady ? "pointer" : "not-allowed"};opacity:${embeddingApiReady ? 1 : 0.6}">
                <input type="checkbox" disabled=${!embeddingApiReady} checked=${draft.knowledgeAutoIndex && embeddingApiReady} onChange=${(e3) => setDraft({ ...draft, knowledgeAutoIndex: e3.target.checked })} />
                <span>${t4("tasks.knowledgeAutoIndex")}${embeddingApiReady ? "" : ` · ${t4("tasks.knowledgeAutoIndexUnavailable")}`}</span>
              </label>
            ` : null}
            <div class="form-row" style="align-items:flex-start">
              <span class="lbl">${t4("tasks.summary")}</span>
              <div style="flex:1;min-width:0;color:var(--fg-3);font-size:12px;line-height:1.5">${t4("tasks.sessionCleanupHint")}</div>
            </div>
          ` : draft.kind === "report" ? html4`
            <div class="form-row">
              <span class="lbl">${t4("tasks.reportRange")}</span>
              <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                <select class="input mono" value=${draft.reportRangeMode} onChange=${(e3) => setDraft({ ...draft, reportRangeMode: e3.target.value })}>
                  <option value="yesterday">${t4("tasks.reportYesterday")}</option>
                  <option value="today">${t4("tasks.reportToday")}</option>
                  <option value="last_week">${t4("tasks.reportLastWeek")}</option>
                  <option value="this_week">${t4("tasks.reportThisWeek")}</option>
                  <option value="last_7_days">${t4("tasks.reportLast7Days")}</option>
                  <option value="last_30_days">${t4("tasks.reportLast30Days")}</option>
                  <option value="this_year">${t4("tasks.reportThisYear")}</option>
                  <option value="last_year">${t4("tasks.reportLastYear")}</option>
                  <option value="custom">${t4("tasks.reportFixedRange")}</option>
                </select>
                ${draft.reportRangeMode === "custom" ? html4`
                  <span style="color:var(--fg-3);font-size:12px">${t4("tasks.reportStart")}</span>
                  <input class="input mono" type="date" value=${draft.reportStartDate} onInput=${(e3) => setDraft({ ...draft, reportStartDate: e3.target.value })} />
                  <span style="color:var(--fg-3);font-size:12px">${t4("tasks.reportEnd")}</span>
                  <input class="input mono" type="date" value=${draft.reportEndDate} onInput=${(e3) => setDraft({ ...draft, reportEndDate: e3.target.value })} />
                ` : null}
                <label style="display:flex;align-items:center;gap:6px;color:var(--fg-2);font-size:12px">
                  <input type="checkbox" checked=${draft.reportExport} onChange=${(e3) => setDraft({ ...draft, reportExport: e3.target.checked })} />
                  ${t4("tasks.reportExport")}
                </label>
              </div>
            </div>
            <div class="form-row" style="align-items:flex-start">
              <span class="lbl">${t4("tasks.summary")}</span>
              <div style="flex:1;min-width:0;color:var(--fg-3);font-size:12px;line-height:1.5">${t4("tasks.reportTaskHint")}</div>
            </div>
          ` : html4`
            <div class="form-row" style="align-items:flex-start">
              <span class="lbl">${t4("tasks.executionSource")}</span>
              <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:6px">
                <select class="input" value=${draft.executionSource} onChange=${(e3) => {
    const executionSource = e3.target.value;
    const first = skillTemplates[0] ?? null;
    setDraft({
      ...draft,
      executionSource,
      skillName: executionSource === "skill" ? draft.skillName || first?.skillName || "" : "",
      skillAction: executionSource === "skill" ? draft.skillAction || first?.id || "" : "",
      runMode: executionSource === "skill" ? "readonly" : draft.runMode
    });
  }}>
                  <option value="prompt">${t4("tasks.executionPrompt")}</option>
                  <option value="skill">${t4("tasks.executionSkill")}</option>
                </select>
              </div>
            </div>
            ${draft.executionSource === "skill" ? html4`
              <div class="form-row" style="align-items:flex-start">
                <span class="lbl">${t4("tasks.skillTemplate")}</span>
                <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:6px">
                  ${skillTemplates.length > 0 ? html4`
                    <select class="input" value=${draft.skillName && draft.skillAction ? `${draft.skillName}/${draft.skillAction}` : ""} onChange=${(e3) => {
    const template = skillTemplates.find((item) => `${item.skillName}/${item.id}` === e3.target.value);
    if (!template) return;
    setDraft({ ...draft, skillName: template.skillName, skillAction: template.id, name: draft.name || template.title, runMode: "readonly" });
  }}>
                      ${skillTemplates.map((template) => html4`<option value=${`${template.skillName}/${template.id}`}>${template.integrationName} · ${template.title}</option>`)}
                    </select>
                    <span style="color:var(--fg-3);font-size:11px;line-height:1.45">${selectedSkillTemplate?.description ?? ""}</span>
                    <span style="color:var(--c-warn);font-size:11px;line-height:1.45">${t4("tasks.skillReadOnlyHint")}</span>
                  ` : html4`<span style="color:var(--c-warn);font-size:12px">${t4("tasks.skillTemplateUnavailable")}</span>`}
                </div>
              </div>
              <div class="form-row" style="align-items:flex-start">
                <span class="lbl">${t4("tasks.skillAddendum")}</span>
                <textarea class="input" maxlength="2000" rows="4" placeholder=${t4("tasks.skillAddendumPlaceholder")} value=${draft.skillPromptAddendum} onInput=${(e3) => setDraft({ ...draft, skillPromptAddendum: e3.target.value.slice(0, 2e3) })}></textarea>
              </div>
              <div class="form-row" style="align-items:flex-start">
                <span class="lbl">知识归档</span>
                <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:7px">
                  <div style="display:flex;gap:7px;align-items:center;min-width:0">
                    <input class="input mono" style="flex:1;min-width:0" readonly value=${draft.skillArchiveWorkspaceDir} placeholder="未选择归档工作区" />
                    <button class="btn" type="button" onClick=${pickSkillArchiveWorkspace}>选择</button>
                    ${draft.skillArchiveWorkspaceDir ? html4`<button class="btn ghost" type="button" onClick=${() => setDraft({ ...draft, skillArchiveWorkspaceDir: "", skillAutoArchive: false, skillAutoIndex: false })}>清除</button>` : null}
                  </div>
                  <span style="color:var(--fg-3);font-size:11px;line-height:1.45">报告先保存在任务记录中；归档目标固定为此工作区，不随当前工作区切换。</span>
                  <label style="display:flex;align-items:center;gap:6px;color:var(--fg-2);font-size:12px">
                    <input type="checkbox" disabled=${!draft.skillArchiveWorkspaceDir} checked=${draft.skillAutoArchive} onChange=${(e3) => setDraft({ ...draft, skillAutoArchive: e3.target.checked })} />
                    高质量结果自动归档
                  </label>
                  <label style="display:flex;align-items:center;gap:6px;color:var(--fg-2);font-size:12px">
                    <input type="checkbox" disabled=${!draft.skillArchiveWorkspaceDir || !embeddingApiReady} checked=${draft.skillAutoIndex && embeddingApiReady} onChange=${(e3) => setDraft({ ...draft, skillAutoIndex: e3.target.checked })} />
                    归档后自动更新本地索引${embeddingApiReady ? "" : " · 需先配置 embedding API"}
                  </label>
                </div>
              </div>
            ` : html4`
              <div class="form-row" style="align-items:flex-start">
                <span class="lbl">${t4("tasks.prompt")}</span>
                <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:6px">
                  <textarea class="input mono" rows="8" placeholder=${t4("tasks.promptPlaceholder")} value=${draft.prompt} onInput=${(e3) => setDraft({ ...draft, prompt: e3.target.value })}></textarea>
                  <span style="color:var(--fg-3);font-size:11px">${t4("tasks.templateVars")}</span>
                </div>
              </div>
              <div class="form-row">
                <span class="lbl">${t4("tasks.runMode")}</span>
                <select class="input mono" value=${draft.runMode} onChange=${(e3) => setDraft({ ...draft, runMode: e3.target.value })}>
                  <option value="auto">${t4("tasks.runModeAuto")}</option>
                  <option value="readonly">${t4("tasks.runModeReadonly")}</option>
                  <option value="confirm">${t4("tasks.runModeConfirm")}</option>
                </select>
              </div>
              <div class="form-row" style="align-items:flex-start">
                <span class="lbl">${t4("tasks.workspaceScope")}</span>
                <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:6px">
                  <select class="input mono" value=${draft.workspaceScope} onChange=${(e3) => setDraft({ ...draft, workspaceScope: e3.target.value, rebindWorkspace: false })}>
                    <option value="bound">${t4("tasks.workspaceScopeBound")}</option>
                    <option value="current">${t4("tasks.workspaceScopeCurrent")}</option>
                  </select>
                  <span style="color:var(--fg-3);font-size:11px;line-height:1.45">${t4("tasks.workspaceScopeHint")}</span>
                </div>
              </div>
            `}
          `}
          <div class="form-row">
            <span class="lbl">${t4("tasks.type")}</span>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
              <select class="input mono" value=${draft.type} onChange=${(e3) => setDraft({ ...draft, type: e3.target.value })}>
                <option value="daily">${t4("tasks.daily")}</option>
                <option value="weekly">${t4("tasks.weekly")}</option>
                <option value="interval">${t4("tasks.customInterval")}</option>
              </select>
              ${draft.type === "daily" || draft.type === "weekly" ? html4`
                ${draft.type === "weekly" ? html4`
                  <span style="color:var(--fg-3);font-size:12px">${t4("tasks.dayOfWeek")}</span>
                  <select class="input mono" value=${String(draft.dayOfWeek)} onChange=${(e3) => setDraft({ ...draft, dayOfWeek: Number(e3.target.value) })}>
                    ${weekdayLabels.map((label, idx) => html4`<option value=${String(idx)}>${label}</option>`)}
                  </select>
                ` : null}
                <span style="color:var(--fg-3);font-size:12px">${t4("tasks.at")}</span>
                <input class="input mono" type="time" value=${draft.timeOfDay} onInput=${(e3) => setDraft({ ...draft, timeOfDay: e3.target.value })} />
              ` : html4`
                <span style="color:var(--fg-3);font-size:12px">${t4("tasks.every")}</span>
                <input class="input mono" type="number" min="1" max=${String(30 * 24 * 60)} step="1" style="width:90px" value=${draft.intervalMinutes} onInput=${(e3) => setDraft({ ...draft, intervalMinutes: e3.target.value })} />
                <span style="color:var(--fg-3);font-size:12px">min</span>
              `}
              <label style="display:flex;align-items:center;gap:6px;margin-left:auto;color:var(--fg-2);font-size:12px">
                <input type="checkbox" checked=${draft.enabled} onChange=${(e3) => setDraft({ ...draft, enabled: e3.target.checked })} />
                ${t4("tasks.enabled")}
              </label>
            </div>
          </div>
          <div class="form-row">
            <span class="lbl">${t4("tasks.runWindow")}</span>
            <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
              <label style="display:flex;align-items:center;gap:6px;color:var(--fg-2);font-size:12px">
                <input type="checkbox" checked=${draft.weekdaysOnly} onChange=${(e3) => setDraft({ ...draft, weekdaysOnly: e3.target.checked })} />
                ${t4("tasks.weekdaysOnly")}
              </label>
              <label style="display:flex;align-items:center;gap:6px;color:var(--fg-2);font-size:12px">
                <input type="checkbox" checked=${draft.windowEnabled} onChange=${(e3) => setDraft({ ...draft, windowEnabled: e3.target.checked })} />
                ${t4("tasks.enableWindow")}
              </label>
              ${draft.windowEnabled ? html4`
                <span style="color:var(--fg-3);font-size:12px">${t4("tasks.from")}</span>
                <input class="input mono" type="time" value=${draft.windowStart} onInput=${(e3) => setDraft({ ...draft, windowStart: e3.target.value })} />
                <span style="color:var(--fg-3);font-size:12px">${t4("tasks.to")}</span>
                <input class="input mono" type="time" value=${draft.windowEnd} onInput=${(e3) => setDraft({ ...draft, windowEnd: e3.target.value })} />
              ` : null}
            </div>
          </div>
          ${selected && draft.kind === "prompt" && draft.executionSource !== "skill" ? html4`
            <div class="form-row">
              <span class="lbl">${t4("tasks.workspace")}</span>
              <div style="min-width:0;display:flex;flex-direction:column;gap:4px">
                <code class="mono" style="font-size:11px;color:var(--fg-2);overflow-wrap:anywhere">${draft.workspaceScope === "current" || draft.rebindWorkspace ? selected.currentWorkspaceDir : selected.workspaceDir || "—"}</code>
                <span style="color:var(--fg-3);font-size:11px">${t4("tasks.currentWorkspace")}: ${selected.currentWorkspaceDir || "—"}</span>
                ${draft.workspaceScope === "bound" && selected.workspaceMismatch ? html4`<button class="btn btn-sm" style="align-self:flex-start" disabled=${draft.rebindWorkspace} onClick=${() => setDraft({ ...draft, rebindWorkspace: true })}>${t4("tasks.workspaceRebind")}</button>` : null}
              </div>
            </div>
          ` : null}
          ${selected && draft.kind === "session_cleanup" ? html4`
            <div class="form-row" style="align-items:flex-start">
              <span class="lbl">${t4("tasks.cleanupWorkspace")}</span>
              <div style="min-width:0;display:flex;flex-direction:column;gap:5px">
                <code class="mono" style="font-size:11px;color:var(--fg-2);overflow-wrap:anywhere">${draft.rebindWorkspace ? selected.currentWorkspaceDir : selected.workspaceDir || "—"}</code>
                <span style="color:var(--fg-3);font-size:11px;line-height:1.45">${t4("tasks.cleanupWorkspaceHint")}</span>
                ${selected.workspaceDifferent ? html4`<button class="btn btn-sm" style="align-self:flex-start" disabled=${draft.rebindWorkspace} onClick=${() => setDraft({ ...draft, rebindWorkspace: true })}>${t4("tasks.workspaceRebind")}</button>` : null}
              </div>
            </div>
          ` : null}
          <div style="display:flex;gap:8px;align-items:center;margin-top:12px;flex-wrap:wrap">
            <button class="primary" disabled=${busy || !canSave} onClick=${() => saveTask()}>${draft.id ? t4("tasks.update") : t4("tasks.save")}</button>
            ${selected ? html4`
              <button disabled=${busy} onClick=${() => toggleTask(selected)}>${selected.enabled ? t4("tasks.disabled") : t4("tasks.enabled")}</button>
              <button class="danger" disabled=${busy} onClick=${() => deleteTask(selected)}>${t4("common.delete")}</button>
            ` : null}
          </div>
          <div style="margin-top:10px;color:var(--fg-3);font-size:12px">${t4("tasks.busyHint")} ${t4("tasks.minInterval")}</div>
        </div>
        ${selected ? html4`
          <div class="card" style="margin-top:10px">
            <div class="card-h"><span class="title">${t4("tasks.history")}</span></div>
            ${(selected.history ?? []).length === 0 ? html4`<div class="card-b">${t4("tasks.noHistory")}</div>` : html4`
              <div style="display:flex;flex-direction:column;gap:8px">
                ${(selected.history ?? []).map((item) => html4`
                  <div style="display:grid;grid-template-columns:130px 100px minmax(0,1fr);gap:8px;align-items:start;font-size:12px;border-bottom:1px solid var(--bd);padding-bottom:8px">
                    <span class="mono" style="color:var(--fg-3)">${fmtScheduleDate(item.startedAt)}</span>
                    <span>${scheduleRunPill(item.status)}</span>
                    <span style="min-width:0;color:var(--fg-2);overflow-wrap:anywhere;display:flex;flex-direction:column;gap:4px">
                      <span style="display:flex;gap:8px;align-items:center;min-width:0;flex-wrap:wrap">
                        <span>
                          ${item.manual ? t4("tasks.manual") : t4("tasks.scheduled")}
                          <span style="color:var(--fg-3)"> · ${t4("tasks.duration")}: ${fmtScheduleDuration(item.durationMs)} · ${t4("tasks.tokens")}: ${fmtScheduleTokens(item.lastPromptTokens)} · ${t4("tasks.cost")}: ${fmtScheduleCost(item.lastTurnCostUsd)}</span>
                        </span>
                        ${item.assistantMessageId || item.userMessageId ? html4`<button class="btn btn-sm" onClick=${() => viewRunConversation(item)}>${t4("tasks.viewConversation")}</button>` : null}
                      </span>
                      <span>${item.summary || item.reason || t4("tasks.noSummary")}</span>
                      ${item.reportPeriod ? html4`<span style="color:var(--fg-3)">
                        ${fmtReportRangeMode(item.reportRangeMode, item.reportPeriod)} · ${t4("tasks.reportRange")}: ${fmtReportRange(item)} · ${t4("tasks.reportSessions")}: ${fmtScheduleTokens(item.reportSessions)} · ${t4("tasks.reportMessages")}: ${fmtScheduleTokens(item.reportMessages)}
                      </span>` : null}
                      ${item.cleanupCandidates !== null && item.cleanupCandidates !== void 0 ? html4`<span style="color:var(--fg-3)">
                        ${item.cleanupAction === "delete" ? t4("tasks.sessionCleanupDelete") : t4("tasks.sessionCleanupPreview")} · ${t4("tasks.cleanupCandidates")}: ${fmtScheduleTokens(item.cleanupCandidates)} · ${t4("tasks.cleanupDeleted")}: ${fmtScheduleTokens(item.cleanupDeleted)} · ${t4("tasks.cleanupArchive")}: ${fmtScheduleTokens(item.cleanupArchive)} · ${t4("tasks.cleanupKeep")}: ${fmtScheduleTokens(item.cleanupKeep)} · ${t4("tasks.cleanupExtract")}: ${fmtScheduleTokens(item.cleanupExtract)} · ${t4("tasks.cleanupSemanticReviewed")}: ${fmtScheduleTokens(item.cleanupSemanticReviewed)} · ${t4("tasks.cleanupFailed")}: ${fmtScheduleTokens(item.cleanupFailed)}
                      </span>` : null}
                      ${item.reportPath ? html4`<span style="color:var(--fg-3);overflow-wrap:anywhere">${t4("tasks.reportExportPath")}: <code class="mono">${item.reportPath}</code></span>` : null}
                      ${item.reason && item.summary && item.reason !== item.summary ? html4`<span style="color:var(--fg-3)">${item.reason}</span>` : null}
                    </span>
                  </div>
                `)}
              </div>
            `}
          </div>
        ` : null}
      </div>
    </div>
  `;
}

// dashboard/src/panels/tools.ts
function toolDesc(name, fallback) {
  const key = `tools.desc.${name}`;
  const translated = t4(key);
  return translated === key ? fallback : translated;
}
function ToolsPanel() {
  useLang();
  const { data, error, loading } = usePoll("/tools", 4e3);
  if (loading && !data)
    return html4`<div class="card" style="color:var(--fg-3)">${t4("tools.loading")}</div>`;
  const e3 = error;
  if (e3?.status === 503) {
    return html4`<div class="card accent-warn">${e3.body?.error ?? t4("common.loadingFailed", { name: "tools", error: "" })}</div>`;
  }
  if (e3) return html4`<div class="card accent-err">${t4("common.loadingFailed", { name: "tools", error: e3.message })}</div>`;
  if (!data) return null;
  const d3 = data;
  return html4`
    <div style="display:flex;flex-direction:column;gap:14px">
      <div class="chips">
        <span class="chip-f static active">${t4("common.all")} <span class="ct">${d3.total}</span></span>
        ${d3.planMode ? html4`<span class="chip-f static" style="border-color:var(--c-warn);color:var(--c-warn)">${t4("tools.planMode")}</span>` : null}
      </div>

      ${d3.tools.length === 0 ? html4`<div class="card" style="color:var(--fg-3)">${t4("tools.noTools")}</div>` : html4`
            <div class="card" style="padding:0;overflow:hidden">
              <table class="tbl">
                <thead>
                  <tr>
                    <th>${t4("tools.colTool")}</th>
                    <th>${t4("tools.colFlags")}</th>
                    <th>${t4("tools.colDesc")}</th>
                  </tr>
                </thead>
                <tbody>
                  ${d3.tools.map(
    (tool) => html4`
                      <tr>
                        <td><code class="mono">${tool.name}</code></td>
                        <td>
                          ${tool.readOnly ? html4`<span class="pill ok">${t4("tools.readOnly")}</span>` : html4`<span class="pill acc">${t4("tools.write")}</span>`}
                          ${tool.flattened ? html4` <span class="pill">${t4("tools.flat")}</span>` : null}
                        </td>
                        <td class="dim">${toolDesc(tool.name, tool.description ?? "")}</td>
                      </tr>
                    `
  )}
                </tbody>
              </table>
            </div>
          `}
    </div>
  `;
}

// dashboard/src/app.ts
var html7 = htm_module_default.bind(k);
function tabSections(userAvatar = null) {
  return [
    {
      label: t4("app.sectionWorkspace"),
      tabs: [
        { id: "chat", name: t4("app.tabChat"), glyph: "◆", panel: () => html7`<${ChatPanel} userAvatar=${userAvatar} />` },
        { id: "sessions", name: t4("app.tabSessions"), glyph: "›", panel: () => html7`<${SessionsPanel} userAvatar=${userAvatar} />` },
        { id: "files", name: t4("app.tabFiles"), glyph: "F", panel: () => html7`<${FilesPanel} />` },
        { id: "tasks", name: t4("app.tabTasks"), glyph: "T", panel: () => html7`<${ScheduledTasksPanel} />` },
        { id: "overview", name: t4("app.tabOverview"), glyph: "◈", panel: () => html7`<${OverviewPanel} />` }
      ]
    },
    {
      label: t4("app.sectionConfigure"),
      tabs: [
        // ChangesPanel is hidden because it duplicates the main chat, exposes developer-only Git/checkpoint restore actions, and its session diff source is not implemented.
        // Keep the panel and APIs for now; a future replacement should be a read-only "session changes" summary with file-level explanations and previews.
        { id: "memory", name: t4("app.tabMemory"), glyph: "·", panel: () => html7`<${MemoryPanel} />`, breakBefore: true },
        { id: "skills", name: t4("app.tabSkills"), glyph: "S", panel: () => html7`<${SkillsPanel} />` },
        { id: "tools", name: t4("app.tabTools"), glyph: "▣", panel: () => html7`<${ToolsPanel} />` },
        { id: "mcp", name: t4("app.tabMcp"), glyph: "M", panel: () => html7`<${McpPanel} />`, breakBefore: true },
        { id: "semantic", name: t4("app.tabSemantic"), glyph: "≈", panel: () => html7`<${SemanticPanel} />` },
        { id: "hooks", name: t4("app.tabHooks"), glyph: "H", panel: () => html7`<${HooksPanel} />` },
        { id: "permissions", name: t4("app.tabPermissions"), glyph: "▎", panel: () => html7`<${PermissionsPanel} />`, breakBefore: true },
        // SystemPanel is retained for diagnostics, but its standalone navigation is hidden because Overview now presents the high-value health summary.
        { id: "settings", name: t4("app.tabSettings"), glyph: "⌘", panel: () => html7`<${SettingsPanel} />` }
      ]
    }
  ];
}
function formatVHomeCountdown(totalSeconds) {
  const seconds = Math.max(0, Number(totalSeconds) || 0);
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}
function vhomeLoginFailureMessage(login) {
  if (login?.message) return login.message;
  const messages = {
    "dws-not-found": "未找到 V来家登录组件，请重新安装或修复 Visionox-Whale。",
    "login-start-failed": "无法启动 V来家登录组件，请重启软件后再试。",
    "login-network-failed": "无法连接 V来家授权服务，请检查网络、代理或防火墙后重试。",
    "login-tls-failed": "V来家授权服务的安全连接失败，请检查系统时间、证书或网络代理。",
    "login-permission-denied": "V来家授权服务拒绝了当前请求，请确认账号权限或联系管理员。",
    "login-command-unsupported": "当前 DWS 登录命令不受支持，请更新或重新安装 Visionox-Whale。",
    "login-timeout": "登录等待已超时，请确认网络正常后重新获取授权链接。",
    "login-link-unavailable": "DWS 已启动，但没有返回授权链接。请检查网络或代理后重试。",
    "authentication-required": "尚未检测到授权完成，请确认浏览器中的授权已成功后重试。",
    "identity-unavailable": "授权可能已完成，但暂时无法获取当前用户信息，请稍后刷新。",
    "communication-failed": "授权进程已结束，但无法确认 V来家连接状态，请检查网络后重试。"
  };
  return messages[login?.reason] ?? "V来家登录未完成，请根据诊断信息重试。";
}
function App() {
  useLang();
  y2(() => {
    initLangFromServer();
  }, []);
  const { data: vhomeStatus, refresh: refreshVHome, replaceData: replaceVHomeStatus } = usePoll("/vhome/status", 3e5);
  const [vhomeMenuOpen, setVhomeMenuOpen] = d2(false);
  const [vhomeBusy, setVhomeBusy] = d2(false);
  const [vhomeError, setVhomeError] = d2(null);
  const [vhomeOpenFallback, setVhomeOpenFallback] = d2(false);
  const [vhomeCopyStatus, setVhomeCopyStatus] = d2(null);
  const [vhomeRemainingSeconds, setVhomeRemainingSeconds] = d2(null);
  const vhomeControlRef = A2(null);
  const [activeId, setActiveId] = d2(() => {
    try {
      return localStorage.getItem("rx.activeTab") ?? "chat";
    } catch {
      return "chat";
    }
  });
  const [sidebarCollapsed, setSidebarCollapsed] = d2(() => {
    try {
      return localStorage.getItem("rx.sidebarCollapsed") === "1";
    } catch {
      return false;
    }
  });
  y2(() => {
    try {
      localStorage.setItem("rx.sidebarCollapsed", sidebarCollapsed ? "1" : "0");
    } catch {
    }
  }, [sidebarCollapsed]);
  y2(() => {
    try {
      localStorage.setItem("rx.activeTab", activeId);
    } catch {
    }
  }, [activeId]);
  const vhomeAvatarUrl = vhomeStatus?.connected === true ? `/api/vhome/avatar?token=${encodeURIComponent(TOKEN)}&v=${encodeURIComponent(vhomeStatus.checkedAt ?? "")}` : null;
  const TAB_SECTIONS = tabSections(vhomeAvatarUrl);
  const [openSections, setOpenSections] = d2(() => {
    let stored = [0];
    try {
      const parsed = JSON.parse(localStorage.getItem("rx.openSections") ?? "[0]");
      if (Array.isArray(parsed)) stored = parsed.filter((index) => Number.isInteger(index) && index >= 0 && index < TAB_SECTIONS.length);
    } catch {
    }
    const activeSection = TAB_SECTIONS.findIndex((section) => section.tabs.some((tab) => tab.id === activeId));
    if (activeSection >= 0 && !stored.includes(activeSection)) stored.push(activeSection);
    return new Set(stored);
  });
  y2(() => {
    try {
      localStorage.setItem("rx.openSections", JSON.stringify([...openSections]));
    } catch {
    }
  }, [openSections]);
  y2(() => {
    const activeSection = tabSections().findIndex((section) => section.tabs.some((tab) => tab.id === activeId));
    if (activeSection < 0) return;
    setOpenSections((current) => current.has(activeSection) ? current : /* @__PURE__ */ new Set([...current, activeSection]));
  }, [activeId]);
  const toggleSection = q2((idx) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);
  const [wsRoot, setWsRoot] = d2(null);
  const [buildDate2, setBuildDate] = d2(null);
  y2(() => {
    const unsub = subscribeSse("health", (ev) => {
      setWsRoot(ev.cwd ?? null);
      setBuildDate(ev.buildDate ?? null);
    });
    return unsub;
  }, []);
  const ALL_TABS = TAB_SECTIONS.flatMap((s3) => s3.tabs);
  const active = ALL_TABS.find((t5) => t5.id === activeId) ?? ALL_TABS[0];
  const vhomeConnected = vhomeStatus?.connected === true && Boolean(vhomeStatus.userName);
  const vhomeLoginState = vhomeStatus?.login?.state ?? "idle";
  const vhomeLoginActive = ["starting", "awaiting-user", "completing"].includes(vhomeLoginState);
  const vhomeLoginUrl = vhomeStatus?.login?.loginUrl ?? null;
  const vhomeLoginFailure = vhomeLoginState === "failed" ? vhomeLoginFailureMessage(vhomeStatus?.login) : null;
  const vhomeLoginDetail = vhomeLoginState === "failed" ? vhomeStatus?.login?.detail ?? null : null;
  const vhomeAuthorizationReady = Boolean(vhomeLoginUrl || vhomeStatus?.login?.userCode);
  const vhomeLoginPreparing = vhomeLoginState === "starting" && !vhomeAuthorizationReady;
  const sidebarIdentity = vhomeConnected ? vhomeStatus.userName : "127.0.0.1";
  const sidebarIdentityTitle = vhomeConnected ? `${vhomeStatus.userName}${vhomeStatus.corpName ? ` · ${vhomeStatus.corpName}` : ""}` : "127.0.0.1 · 本地服务";
  const vhomeControlText = vhomeConnected ? "V来家已连接" : vhomeLoginPreparing ? "正在获取授权链接" : vhomeLoginActive ? "等待 V来家授权" : "登录 V来家";
  const vhomeLoginExpiresAt = vhomeStatus?.login?.expiresAt ?? null;
  const vhomeLoginExpired = vhomeRemainingSeconds === 0;
  y2(() => {
    if (!vhomeLoginExpiresAt) {
      setVhomeRemainingSeconds(null);
      return;
    }
    const update = () => setVhomeRemainingSeconds(Math.max(0, Math.ceil((Date.parse(vhomeLoginExpiresAt) - Date.now()) / 1e3)));
    update();
    const timer = setInterval(update, 1e3);
    return () => clearInterval(timer);
  }, [vhomeLoginExpiresAt]);
  const finishVHomeLogin = q2((nextStatus) => {
    const nextLoginState = nextStatus?.login?.state ?? "idle";
    if (nextStatus?.connected === true || nextStatus?.connected === false && nextLoginState === "idle") {
      setVhomeMenuOpen(false);
    }
  }, []);
  y2(() => {
    finishVHomeLogin(vhomeStatus);
  }, [vhomeStatus, finishVHomeLogin]);
  y2(() => {
    if (!vhomeLoginActive) return;
    const timer = setInterval(() => {
      void refreshVHome().then(finishVHomeLogin);
    }, 1e3);
    return () => clearInterval(timer);
  }, [vhomeLoginActive, refreshVHome, finishVHomeLogin]);
  const startVHomeLogin = q2(async () => {
    setVhomeBusy(true);
    setVhomeError(null);
    setVhomeOpenFallback(false);
    setVhomeCopyStatus(null);
    setVhomeMenuOpen(true);
    try {
      const nextStatus = await api("/vhome/login", { method: "POST", body: {} });
      replaceVHomeStatus(nextStatus);
      setVhomeMenuOpen(true);
      finishVHomeLogin(nextStatus);
    } catch (error) {
      setVhomeError(error.message || "登录启动失败");
    } finally {
      setVhomeBusy(false);
    }
  }, [replaceVHomeStatus, finishVHomeLogin]);
  const restartVHomeLogin = q2(async () => {
    setVhomeBusy(true);
    setVhomeError(null);
    setVhomeOpenFallback(false);
    setVhomeCopyStatus(null);
    try {
      await api("/vhome/login", { method: "DELETE", body: {} });
      const nextStatus = await api("/vhome/login", { method: "POST", body: {} });
      replaceVHomeStatus(nextStatus);
      setVhomeMenuOpen(true);
    } catch (error) {
      setVhomeError(error.message || "重新生成授权链接失败");
    } finally {
      setVhomeBusy(false);
    }
  }, [replaceVHomeStatus]);
  const cancelVHomeLogin = q2(async () => {
    setVhomeBusy(true);
    setVhomeError(null);
    try {
      const nextStatus = await api("/vhome/login", { method: "DELETE", body: {} });
      replaceVHomeStatus(nextStatus);
      setVhomeMenuOpen(false);
    } catch (error) {
      setVhomeError(error.message || "取消登录失败");
    } finally {
      setVhomeBusy(false);
    }
  }, [replaceVHomeStatus]);
  const logoutVHome = q2(async () => {
    if (!window.confirm("确认退出当前 V来家组织？退出后不会影响 AI、文件、索引和其他本地功能。")) return;
    setVhomeBusy(true);
    setVhomeError(null);
    try {
      const nextStatus = await api("/vhome/logout", { method: "POST", body: {} });
      replaceVHomeStatus(nextStatus);
      setVhomeMenuOpen(false);
    } catch (error) {
      await refreshVHome();
      setVhomeError(error.message || "退出登录失败");
    } finally {
      setVhomeBusy(false);
    }
  }, [refreshVHome, replaceVHomeStatus]);
  const refreshVHomeNow = q2(async () => {
    setVhomeBusy(true);
    setVhomeError(null);
    try {
      const nextStatus = await api("/vhome/refresh", { method: "POST", body: {} });
      finishVHomeLogin(replaceVHomeStatus(nextStatus));
    } catch (error) {
      setVhomeError(error.message || "刷新状态失败");
    } finally {
      setVhomeBusy(false);
    }
  }, [replaceVHomeStatus, finishVHomeLogin]);
  const openVHomeAuthorization = q2(async (browser = "default") => {
    if (!vhomeLoginUrl) return;
    setVhomeError(null);
    try {
      await api("/open-url", { method: "POST", body: { url: vhomeLoginUrl, browser } });
    } catch (error) {
      setVhomeError(browser === "edge" ? "无法使用 Microsoft Edge 打开，请复制授权链接。" : "默认浏览器未能打开，请复制授权链接或尝试 Microsoft Edge。");
    } finally {
      if (browser === "default") setVhomeOpenFallback(true);
    }
  }, [vhomeLoginUrl]);
  const copyVHomeValue = q2(async (value, label) => {
    try {
      await writeClipboardText(value);
      setVhomeCopyStatus(`${label}已复制`);
      setTimeout(() => setVhomeCopyStatus(null), 2e3);
    } catch (error) {
      setVhomeError(error.message || `${label}复制失败`);
    }
  }, []);
  const toggleVHomeControl = q2(() => {
    if (!vhomeConnected && !vhomeLoginActive) {
      void startVHomeLogin();
      return;
    }
    setVhomeMenuOpen((open) => !open);
  }, [vhomeConnected, vhomeLoginActive, startVHomeLogin]);
  const dismissVHomePopover = q2(() => {
    setVhomeMenuOpen(false);
    setVhomeCopyStatus(null);
  }, []);
  y2(() => {
    if (!vhomeMenuOpen) return;
    const closeOnOutside = (event) => {
      if (vhomeControlRef.current?.contains(event.target)) return;
      dismissVHomePopover();
    };
    const closeOnEscape = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      dismissVHomePopover();
    };
    document.addEventListener("pointerdown", closeOnOutside, true);
    document.addEventListener("keydown", closeOnEscape, true);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside, true);
      document.removeEventListener("keydown", closeOnEscape, true);
    };
  }, [vhomeMenuOpen, dismissVHomePopover]);
  y2(() => {
    if (active.id !== activeId) setActiveId(active.id);
  }, [active.id, activeId]);
  y2(() => {
    const onNav = (ev) => {
      const id = ev.detail?.tabId;
      if (id) setActiveId(id);
    };
    appBus.addEventListener("navigate-tab", onNav);
    return () => appBus.removeEventListener("navigate-tab", onNav);
  }, []);
  const pickTab = q2((id) => setActiveId(id), []);
  const openMarkdown = q2(() => {
    openMarkdownDocumentByPicker();
  }, []);
  return html7`
    <div class=${`app ${sidebarCollapsed ? "collapsed" : ""}`}>
      <aside class="app-side">
        <div class="brand">
          <span class="glyph">◈</span>
          <img src="/assets/v3.png" alt="" height="13" style="flex-shrink:0" />
        </div>
        <div class="side-tabs">
          ${TAB_SECTIONS.map(
    (section, i3) => {
      const isOpen = openSections.has(i3);
      return html7`
              <button type="button" class="side-section side-section-toggle" aria-expanded=${isOpen} onClick=${() => toggleSection(i3)}>
                <span>${section.label}</span>
                <span class="side-section-chev">${isOpen ? "▼" : "▶"}</span>
              </button>
              ${isOpen ? html7`
                  ${section.tabs.map(
        (tab) => html7`
                      ${tab.breakBefore ? html7`<div class="side-divider"></div>` : null}
                      <button type="button"
                        class=${`side-tab ${tab.id === active.id ? "active" : ""}`}
                        onClick=${() => pickTab(tab.id)}
                        title=${tab.name}
                        aria-current=${tab.id === active.id ? "page" : null}
                      >
                        <span class="g">${tab.glyph}</span>
                        <span class="label">${tab.name}</span>
                      </button>
                    `
      )}
                  ${i3 === 0 ? html7`
                      <button type="button" class="side-tab" onClick=${() => api("/open-url", { method: "POST", body: { url: "https://oa.visionox.com:8086/gvo/mainPortal/index.html" } }).catch(() => {
      })} title="\u529E\u516C OA"><span class="g">O</span><span class="label">OA</span></button>
                      <div class="side-divider"></div>
                    ` : null}
                  ${section.label === t4("app.sectionConfigure") ? html7`
                      <button type="button" class="side-tab" onClick=${() => api("/open-url", { method: "POST", body: { url: "https://cloud.siliconflow.cn/i/1vfZWEo7" } }).catch(() => {
      })} title="SiliconFlow API"><span class="g">A</span><span class="label">API</span></button>
                    ` : null}
                ` : null}
            `;
    }
  )}
        </div>
        <div style="padding:6px 16px;display:flex;justify-content:flex-start">
          <select class="theme-select" style="width:100%;font-size:11px;padding:2px 4px;background:var(--surface-input);color:var(--text-primary);border:1px solid var(--border-default);border-radius:3px;cursor:pointer" onChange=${(e3) => {
    const v3 = e3.target.value;
    document.documentElement.setAttribute("data-theme", v3);
    try {
      localStorage.setItem("visionox-theme", v3);
    } catch {
    }
    ;
    try {
      document.cookie = "visionox-theme=" + encodeURIComponent(v3) + ";path=/;max-age=31536000";
    } catch {
    }
    ;
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: "vis_theme_changed", theme: v3 }, "*");
      }
    } catch {
    }
    ;
  }} value=${typeof document !== "undefined" && document.documentElement.getAttribute("data-theme") || "light"}>
            <option value="indigo-night">靛夜</option>
            <option value="light">\u6D45\u8272</option>
            <option value="dark">\u6DF1\u8272</option>
            <option value="warm-sand">\u6696\u6C99</option>
            <option value="cool-ash">\u51B7\u7070</option>
            <option value="soft-sage">\u67D4\u7EFF</option>
            <option value="espresso">\u6D53\u7F29\u5496\u5561</option>
            <option value="midnight-ink">\u5348\u591C\u58A8\u84DD</option>
            <option value="deep-charcoal">\u6DF1\u70AD\u7070</option>
          </select>
        </div>
        <div class="vhome-control" ref=${vhomeControlRef}>
          <button type="button"
            class=${`vhome-control-button ${vhomeConnected ? "connected" : vhomeLoginActive ? "authorizing" : ""}`}
            title=${vhomeConnected ? `${vhomeControlText} · ${vhomeStatus.corpName ?? ""}` : vhomeControlText}
            aria-expanded=${vhomeMenuOpen}
            aria-controls="vhome-connection-popover"
            disabled=${vhomeBusy}
            onClick=${toggleVHomeControl}
          >
            <span class="vhome-status-dot"></span>
            <span class="vhome-control-label">${vhomeControlText}</span>
          </button>
          ${vhomeMenuOpen ? html7`
            <div id="vhome-connection-popover" class="vhome-popover" role="dialog" aria-label="V来家连接">
              <div class="vhome-popover-head">
                <div class="vhome-popover-title">${vhomeConnected ? "V来家已连接" : "登录 V来家"}</div>
                <button type="button" class="vhome-popover-close" onClick=${dismissVHomePopover} title="关闭" aria-label="关闭 V来家连接卡片">×</button>
              </div>
              ${vhomeConnected ? html7`
                <div class="vhome-popover-meta">${vhomeStatus.userName}${vhomeStatus.corpName ? ` · ${vhomeStatus.corpName}` : ""}</div>
                <div class="vhome-popover-actions vhome-popover-actions-connected">
                  <button type="button" disabled=${vhomeBusy} onClick=${refreshVHomeNow}>刷新状态</button>
                  <button type="button" class="danger" disabled=${vhomeBusy} onClick=${logoutVHome}>退出当前组织</button>
                </div>
              ` : html7`
                <div class="vhome-popover-meta">${vhomeLoginPreparing ? "正在获取授权链接，请稍候。此时可以继续使用 AI 和其他本地功能。" : vhomeLoginState === "completing" ? "正在确认授权结果，请稍候。" : vhomeLoginActive ? "授权等待期间可以继续使用 AI 和其他本地功能。" : vhomeLoginFailure ?? "使用浏览器和 V来家完成一次授权。"}</div>
                ${vhomeStatus?.login?.userCode ? html7`
                  <div class="vhome-code-row"><span>授权码</span><code>${vhomeStatus.login.userCode}</code><button type="button" onClick=${() => copyVHomeValue(vhomeStatus.login.userCode, "授权码")}>复制</button></div>
                ` : null}
                ${vhomeLoginUrl ? html7`
                  <div class="vhome-login-link" title=${vhomeLoginUrl}>
                    <span>login.dingtalk.com</span>
                    <button type="button" onClick=${() => copyVHomeValue(vhomeLoginUrl, "授权链接")}>复制链接</button>
                  </div>
                  <div class=${`vhome-popover-meta ${vhomeLoginExpired ? "vhome-popover-error" : ""}`}>
                    ${vhomeLoginExpired ? "授权链接已过期，请重新生成。" : vhomeRemainingSeconds === null ? "浏览器未打开？复制链接到任意可用浏览器。" : `剩余 ${formatVHomeCountdown(vhomeRemainingSeconds)} · 浏览器未打开可复制链接。`}
                  </div>
                ` : null}
                ${vhomeCopyStatus ? html7`<div class="vhome-copy-status" role="status">${vhomeCopyStatus}</div>` : null}
                ${vhomeLoginDetail ? html7`<div class="vhome-popover-error" role="alert">DWS 诊断：${vhomeLoginDetail}</div>` : null}
                <div class="vhome-popover-actions">
                  ${vhomeLoginUrl && !vhomeLoginExpired ? html7`<button type="button" class="primary" disabled=${vhomeBusy} onClick=${() => openVHomeAuthorization("default")}>打开浏览器</button>` : null}
                  ${vhomeLoginUrl && vhomeOpenFallback && !vhomeLoginExpired ? html7`<button type="button" disabled=${vhomeBusy} onClick=${() => openVHomeAuthorization("edge")}>使用 Edge 打开</button>` : null}
                  ${vhomeAuthorizationReady && vhomeLoginActive && !vhomeLoginExpired ? html7`<button type="button" disabled=${vhomeBusy} onClick=${refreshVHomeNow}>我已完成授权</button>` : null}
                  ${vhomeLoginExpired || vhomeLoginState === "failed" ? html7`<button type="button" class="primary" disabled=${vhomeBusy} onClick=${restartVHomeLogin}>重新生成链接</button>` : null}
                  ${vhomeLoginActive ? html7`<button type="button" disabled=${vhomeBusy} onClick=${cancelVHomeLogin}>取消</button>` : vhomeLoginState === "failed" ? null : html7`<button type="button" class="primary" disabled=${vhomeBusy} onClick=${startVHomeLogin}>${vhomeBusy ? "正在启动..." : "重新登录"}</button>`}
                </div>
              `}
              ${vhomeError ? html7`<div class="vhome-popover-error">${vhomeError}</div>` : null}
            </div>
          ` : null}
        </div>
        <div class="side-foot">
          <span class="label" title=${sidebarIdentityTitle}>${sidebarIdentity}</span>
          <button type="button"
            class="toggle"
            title=${sidebarCollapsed ? "展开导航栏" : "收起导航栏"}
            aria-label=${sidebarCollapsed ? "展开导航栏" : "收起导航栏"}
            onClick=${() => setSidebarCollapsed((c3) => !c3)}
          >${sidebarCollapsed ? "»" : "«"}</button>
        </div>
      </aside>
      <header class="app-top">
        <span class="ws">
          <span class="path">Visionox-Whale</span>
          <span class="sep">·</span>
          <span class="session">维信诺协同办公平台</span>
        </span>
        <span class="grow"></span>
        <button type="button" class="top-action top-action-md" onClick=${openMarkdown} title="用 Visionox-Whale 打开 Markdown 文档">
          <span class="top-action-g">MD</span>
          <span class="top-action-label">打开 MD</span>
        </button>
        <span class="meter">
          ${wsRoot ? html7`<span class="v">${wsRoot}</span>` : null}
          <span class="sep">·</span>
          <span class="lbl">@${buildDate2 && !buildDate2.startsWith("__") ? buildDate2 : (() => {
    const now = /* @__PURE__ */ new Date();
    return `${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}`;
  })()}</span>
        </span>
      </header>
      <div class="app-body">
        <${ErrorBoundary}>${active.panel()}<//>
      </div>
      <footer class="app-status">
        <span class="grow"></span>
        <span class="item">${t4("app.footer")}</span>
      </footer>
    </div>
    <${ToastStack} />
    <${ErrorOverlay} />
  `;
}
R(html7`<${App} />`, document.getElementById("root"));
if (window.parent && window.parent !== window) {
  setTimeout(() => window.parent.postMessage({ type: "vis_dashboard_ready" }, "*"), 0);
}
