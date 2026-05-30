var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/highlight.js/lib/core.js
var require_core = __commonJS({
  "node_modules/highlight.js/lib/core.js"(exports, module) {
    "use strict";
    function deepFreeze(obj) {
      if (obj instanceof Map) {
        obj.clear = obj.delete = obj.set = function() {
          throw new Error("map is read-only");
        };
      } else if (obj instanceof Set) {
        obj.add = obj.clear = obj.delete = function() {
          throw new Error("set is read-only");
        };
      }
      Object.freeze(obj);
      Object.getOwnPropertyNames(obj).forEach((name) => {
        const prop = obj[name];
        const type = typeof prop;
        if ((type === "object" || type === "function") && !Object.isFrozen(prop)) {
          deepFreeze(prop);
        }
      });
      return obj;
    }
    var Response = class {
      /**
       * @param {CompiledMode} mode
       */
      constructor(mode) {
        if (mode.data === void 0) mode.data = {};
        this.data = mode.data;
        this.isMatchIgnored = false;
      }
      ignoreMatch() {
        this.isMatchIgnored = true;
      }
    };
    function escapeHTML(value) {
      return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
    }
    function inherit$1(original, ...objects) {
      const result = /* @__PURE__ */ Object.create(null);
      for (const key in original) {
        result[key] = original[key];
      }
      objects.forEach(function(obj) {
        for (const key in obj) {
          result[key] = obj[key];
        }
      });
      return (
        /** @type {T} */
        result
      );
    }
    var SPAN_CLOSE = "</span>";
    var emitsWrappingTags = (node) => {
      return !!node.scope;
    };
    var scopeToCSSClass = (name, { prefix }) => {
      if (name.startsWith("language:")) {
        return name.replace("language:", "language-");
      }
      if (name.includes(".")) {
        const pieces = name.split(".");
        return [
          `${prefix}${pieces.shift()}`,
          ...pieces.map((x3, i3) => `${x3}${"_".repeat(i3 + 1)}`)
        ].join(" ");
      }
      return `${prefix}${name}`;
    };
    var HTMLRenderer = class {
      /**
       * Creates a new HTMLRenderer
       *
       * @param {Tree} parseTree - the parse tree (must support `walk` API)
       * @param {{classPrefix: string}} options
       */
      constructor(parseTree, options2) {
        this.buffer = "";
        this.classPrefix = options2.classPrefix;
        parseTree.walk(this);
      }
      /**
       * Adds texts to the output stream
       *
       * @param {string} text */
      addText(text) {
        this.buffer += escapeHTML(text);
      }
      /**
       * Adds a node open to the output stream (if needed)
       *
       * @param {Node} node */
      openNode(node) {
        if (!emitsWrappingTags(node)) return;
        const className = scopeToCSSClass(
          node.scope,
          { prefix: this.classPrefix }
        );
        this.span(className);
      }
      /**
       * Adds a node close to the output stream (if needed)
       *
       * @param {Node} node */
      closeNode(node) {
        if (!emitsWrappingTags(node)) return;
        this.buffer += SPAN_CLOSE;
      }
      /**
       * returns the accumulated buffer
      */
      value() {
        return this.buffer;
      }
      // helpers
      /**
       * Builds a span element
       *
       * @param {string} className */
      span(className) {
        this.buffer += `<span class="${className}">`;
      }
    };
    var newNode = (opts = {}) => {
      const result = { children: [] };
      Object.assign(result, opts);
      return result;
    };
    var TokenTree = class _TokenTree {
      constructor() {
        this.rootNode = newNode();
        this.stack = [this.rootNode];
      }
      get top() {
        return this.stack[this.stack.length - 1];
      }
      get root() {
        return this.rootNode;
      }
      /** @param {Node} node */
      add(node) {
        this.top.children.push(node);
      }
      /** @param {string} scope */
      openNode(scope) {
        const node = newNode({ scope });
        this.add(node);
        this.stack.push(node);
      }
      closeNode() {
        if (this.stack.length > 1) {
          return this.stack.pop();
        }
        return void 0;
      }
      closeAllNodes() {
        while (this.closeNode()) ;
      }
      toJSON() {
        return JSON.stringify(this.rootNode, null, 4);
      }
      /**
       * @typedef { import("./html_renderer").Renderer } Renderer
       * @param {Renderer} builder
       */
      walk(builder) {
        return this.constructor._walk(builder, this.rootNode);
      }
      /**
       * @param {Renderer} builder
       * @param {Node} node
       */
      static _walk(builder, node) {
        if (typeof node === "string") {
          builder.addText(node);
        } else if (node.children) {
          builder.openNode(node);
          node.children.forEach((child) => this._walk(builder, child));
          builder.closeNode(node);
        }
        return builder;
      }
      /**
       * @param {Node} node
       */
      static _collapse(node) {
        if (typeof node === "string") return;
        if (!node.children) return;
        if (node.children.every((el) => typeof el === "string")) {
          node.children = [node.children.join("")];
        } else {
          node.children.forEach((child) => {
            _TokenTree._collapse(child);
          });
        }
      }
    };
    var TokenTreeEmitter = class extends TokenTree {
      /**
       * @param {*} options
       */
      constructor(options2) {
        super();
        this.options = options2;
      }
      /**
       * @param {string} text
       */
      addText(text) {
        if (text === "") {
          return;
        }
        this.add(text);
      }
      /** @param {string} scope */
      startScope(scope) {
        this.openNode(scope);
      }
      endScope() {
        this.closeNode();
      }
      /**
       * @param {Emitter & {root: DataNode}} emitter
       * @param {string} name
       */
      __addSublanguage(emitter, name) {
        const node = emitter.root;
        if (name) node.scope = `language:${name}`;
        this.add(node);
      }
      toHTML() {
        const renderer2 = new HTMLRenderer(this, this.options);
        return renderer2.value();
      }
      finalize() {
        this.closeAllNodes();
        return true;
      }
    };
    function source(re) {
      if (!re) return null;
      if (typeof re === "string") return re;
      return re.source;
    }
    function lookahead(re) {
      return concat("(?=", re, ")");
    }
    function anyNumberOfTimes(re) {
      return concat("(?:", re, ")*");
    }
    function optional(re) {
      return concat("(?:", re, ")?");
    }
    function concat(...args) {
      const joined = args.map((x3) => source(x3)).join("");
      return joined;
    }
    function stripOptionsFromArgs(args) {
      const opts = args[args.length - 1];
      if (typeof opts === "object" && opts.constructor === Object) {
        args.splice(args.length - 1, 1);
        return opts;
      } else {
        return {};
      }
    }
    function either(...args) {
      const opts = stripOptionsFromArgs(args);
      const joined = "(" + (opts.capture ? "" : "?:") + args.map((x3) => source(x3)).join("|") + ")";
      return joined;
    }
    function countMatchGroups(re) {
      return new RegExp(re.toString() + "|").exec("").length - 1;
    }
    function startsWith(re, lexeme) {
      const match = re && re.exec(lexeme);
      return match && match.index === 0;
    }
    var BACKREF_RE = /\[(?:[^\\\]]|\\.)*\]|\(\??|\\([1-9][0-9]*)|\\./;
    function _rewriteBackreferences(regexps, { joinWith }) {
      let numCaptures = 0;
      return regexps.map((regex) => {
        numCaptures += 1;
        const offset = numCaptures;
        let re = source(regex);
        let out = "";
        while (re.length > 0) {
          const match = BACKREF_RE.exec(re);
          if (!match) {
            out += re;
            break;
          }
          out += re.substring(0, match.index);
          re = re.substring(match.index + match[0].length);
          if (match[0][0] === "\\" && match[1]) {
            out += "\\" + String(Number(match[1]) + offset);
          } else {
            out += match[0];
            if (match[0] === "(") {
              numCaptures++;
            }
          }
        }
        return out;
      }).map((re) => `(${re})`).join(joinWith);
    }
    var MATCH_NOTHING_RE = /\b\B/;
    var IDENT_RE = "[a-zA-Z]\\w*";
    var UNDERSCORE_IDENT_RE = "[a-zA-Z_]\\w*";
    var NUMBER_RE = "\\b\\d+(\\.\\d+)?";
    var C_NUMBER_RE = "(-?)(\\b0[xX][a-fA-F0-9]+|(\\b\\d+(\\.\\d*)?|\\.\\d+)([eE][-+]?\\d+)?)";
    var BINARY_NUMBER_RE = "\\b(0b[01]+)";
    var RE_STARTERS_RE = "!|!=|!==|%|%=|&|&&|&=|\\*|\\*=|\\+|\\+=|,|-|-=|/=|/|:|;|<<|<<=|<=|<|===|==|=|>>>=|>>=|>=|>>>|>>|>|\\?|\\[|\\{|\\(|\\^|\\^=|\\||\\|=|\\|\\||~";
    var SHEBANG = (opts = {}) => {
      const beginShebang = /^#![ ]*\//;
      if (opts.binary) {
        opts.begin = concat(
          beginShebang,
          /.*\b/,
          opts.binary,
          /\b.*/
        );
      }
      return inherit$1({
        scope: "meta",
        begin: beginShebang,
        end: /$/,
        relevance: 0,
        /** @type {ModeCallback} */
        "on:begin": (m3, resp) => {
          if (m3.index !== 0) resp.ignoreMatch();
        }
      }, opts);
    };
    var BACKSLASH_ESCAPE = {
      begin: "\\\\[\\s\\S]",
      relevance: 0
    };
    var APOS_STRING_MODE = {
      scope: "string",
      begin: "'",
      end: "'",
      illegal: "\\n",
      contains: [BACKSLASH_ESCAPE]
    };
    var QUOTE_STRING_MODE = {
      scope: "string",
      begin: '"',
      end: '"',
      illegal: "\\n",
      contains: [BACKSLASH_ESCAPE]
    };
    var PHRASAL_WORDS_MODE = {
      begin: /\b(a|an|the|are|I'm|isn't|don't|doesn't|won't|but|just|should|pretty|simply|enough|gonna|going|wtf|so|such|will|you|your|they|like|more)\b/
    };
    var COMMENT = function(begin, end, modeOptions = {}) {
      const mode = inherit$1(
        {
          scope: "comment",
          begin,
          end,
          contains: []
        },
        modeOptions
      );
      mode.contains.push({
        scope: "doctag",
        // hack to avoid the space from being included. the space is necessary to
        // match here to prevent the plain text rule below from gobbling up doctags
        begin: "[ ]*(?=(TODO|FIXME|NOTE|BUG|OPTIMIZE|HACK|XXX):)",
        end: /(TODO|FIXME|NOTE|BUG|OPTIMIZE|HACK|XXX):/,
        excludeBegin: true,
        relevance: 0
      });
      const ENGLISH_WORD = either(
        // list of common 1 and 2 letter words in English
        "I",
        "a",
        "is",
        "so",
        "us",
        "to",
        "at",
        "if",
        "in",
        "it",
        "on",
        // note: this is not an exhaustive list of contractions, just popular ones
        /[A-Za-z]+['](d|ve|re|ll|t|s|n)/,
        // contractions - can't we'd they're let's, etc
        /[A-Za-z]+[-][a-z]+/,
        // `no-way`, etc.
        /[A-Za-z][a-z]{2,}/
        // allow capitalized words at beginning of sentences
      );
      mode.contains.push(
        {
          // TODO: how to include ", (, ) without breaking grammars that use these for
          // comment delimiters?
          // begin: /[ ]+([()"]?([A-Za-z'-]{3,}|is|a|I|so|us|[tT][oO]|at|if|in|it|on)[.]?[()":]?([.][ ]|[ ]|\))){3}/
          // ---
          // this tries to find sequences of 3 english words in a row (without any
          // "programming" type syntax) this gives us a strong signal that we've
          // TRULY found a comment - vs perhaps scanning with the wrong language.
          // It's possible to find something that LOOKS like the start of the
          // comment - but then if there is no readable text - good chance it is a
          // false match and not a comment.
          //
          // for a visual example please see:
          // https://github.com/highlightjs/highlight.js/issues/2827
          begin: concat(
            /[ ]+/,
            // necessary to prevent us gobbling up doctags like /* @author Bob Mcgill */
            "(",
            ENGLISH_WORD,
            /[.]?[:]?([.][ ]|[ ])/,
            "){3}"
          )
          // look for 3 words in a row
        }
      );
      return mode;
    };
    var C_LINE_COMMENT_MODE = COMMENT("//", "$");
    var C_BLOCK_COMMENT_MODE = COMMENT("/\\*", "\\*/");
    var HASH_COMMENT_MODE = COMMENT("#", "$");
    var NUMBER_MODE = {
      scope: "number",
      begin: NUMBER_RE,
      relevance: 0
    };
    var C_NUMBER_MODE = {
      scope: "number",
      begin: C_NUMBER_RE,
      relevance: 0
    };
    var BINARY_NUMBER_MODE = {
      scope: "number",
      begin: BINARY_NUMBER_RE,
      relevance: 0
    };
    var REGEXP_MODE = {
      scope: "regexp",
      begin: /\/(?=[^/\n]*\/)/,
      end: /\/[gimuy]*/,
      contains: [
        BACKSLASH_ESCAPE,
        {
          begin: /\[/,
          end: /\]/,
          relevance: 0,
          contains: [BACKSLASH_ESCAPE]
        }
      ]
    };
    var TITLE_MODE = {
      scope: "title",
      begin: IDENT_RE,
      relevance: 0
    };
    var UNDERSCORE_TITLE_MODE = {
      scope: "title",
      begin: UNDERSCORE_IDENT_RE,
      relevance: 0
    };
    var METHOD_GUARD = {
      // excludes method names from keyword processing
      begin: "\\.\\s*" + UNDERSCORE_IDENT_RE,
      relevance: 0
    };
    var END_SAME_AS_BEGIN = function(mode) {
      return Object.assign(
        mode,
        {
          /** @type {ModeCallback} */
          "on:begin": (m3, resp) => {
            resp.data._beginMatch = m3[1];
          },
          /** @type {ModeCallback} */
          "on:end": (m3, resp) => {
            if (resp.data._beginMatch !== m3[1]) resp.ignoreMatch();
          }
        }
      );
    };
    var MODES = /* @__PURE__ */ Object.freeze({
      __proto__: null,
      APOS_STRING_MODE,
      BACKSLASH_ESCAPE,
      BINARY_NUMBER_MODE,
      BINARY_NUMBER_RE,
      COMMENT,
      C_BLOCK_COMMENT_MODE,
      C_LINE_COMMENT_MODE,
      C_NUMBER_MODE,
      C_NUMBER_RE,
      END_SAME_AS_BEGIN,
      HASH_COMMENT_MODE,
      IDENT_RE,
      MATCH_NOTHING_RE,
      METHOD_GUARD,
      NUMBER_MODE,
      NUMBER_RE,
      PHRASAL_WORDS_MODE,
      QUOTE_STRING_MODE,
      REGEXP_MODE,
      RE_STARTERS_RE,
      SHEBANG,
      TITLE_MODE,
      UNDERSCORE_IDENT_RE,
      UNDERSCORE_TITLE_MODE
    });
    function skipIfHasPrecedingDot(match, response) {
      const before = match.input[match.index - 1];
      if (before === ".") {
        response.ignoreMatch();
      }
    }
    function scopeClassName(mode, _parent) {
      if (mode.className !== void 0) {
        mode.scope = mode.className;
        delete mode.className;
      }
    }
    function beginKeywords(mode, parent) {
      if (!parent) return;
      if (!mode.beginKeywords) return;
      mode.begin = "\\b(" + mode.beginKeywords.split(" ").join("|") + ")(?!\\.)(?=\\b|\\s)";
      mode.__beforeBegin = skipIfHasPrecedingDot;
      mode.keywords = mode.keywords || mode.beginKeywords;
      delete mode.beginKeywords;
      if (mode.relevance === void 0) mode.relevance = 0;
    }
    function compileIllegal(mode, _parent) {
      if (!Array.isArray(mode.illegal)) return;
      mode.illegal = either(...mode.illegal);
    }
    function compileMatch(mode, _parent) {
      if (!mode.match) return;
      if (mode.begin || mode.end) throw new Error("begin & end are not supported with match");
      mode.begin = mode.match;
      delete mode.match;
    }
    function compileRelevance(mode, _parent) {
      if (mode.relevance === void 0) mode.relevance = 1;
    }
    var beforeMatchExt = (mode, parent) => {
      if (!mode.beforeMatch) return;
      if (mode.starts) throw new Error("beforeMatch cannot be used with starts");
      const originalMode = Object.assign({}, mode);
      Object.keys(mode).forEach((key) => {
        delete mode[key];
      });
      mode.keywords = originalMode.keywords;
      mode.begin = concat(originalMode.beforeMatch, lookahead(originalMode.begin));
      mode.starts = {
        relevance: 0,
        contains: [
          Object.assign(originalMode, { endsParent: true })
        ]
      };
      mode.relevance = 0;
      delete originalMode.beforeMatch;
    };
    var COMMON_KEYWORDS = [
      "of",
      "and",
      "for",
      "in",
      "not",
      "or",
      "if",
      "then",
      "parent",
      // common variable name
      "list",
      // common variable name
      "value"
      // common variable name
    ];
    var DEFAULT_KEYWORD_SCOPE = "keyword";
    function compileKeywords(rawKeywords, caseInsensitive, scopeName = DEFAULT_KEYWORD_SCOPE) {
      const compiledKeywords = /* @__PURE__ */ Object.create(null);
      if (typeof rawKeywords === "string") {
        compileList(scopeName, rawKeywords.split(" "));
      } else if (Array.isArray(rawKeywords)) {
        compileList(scopeName, rawKeywords);
      } else {
        Object.keys(rawKeywords).forEach(function(scopeName2) {
          Object.assign(
            compiledKeywords,
            compileKeywords(rawKeywords[scopeName2], caseInsensitive, scopeName2)
          );
        });
      }
      return compiledKeywords;
      function compileList(scopeName2, keywordList) {
        if (caseInsensitive) {
          keywordList = keywordList.map((x3) => x3.toLowerCase());
        }
        keywordList.forEach(function(keyword) {
          const pair = keyword.split("|");
          compiledKeywords[pair[0]] = [scopeName2, scoreForKeyword(pair[0], pair[1])];
        });
      }
    }
    function scoreForKeyword(keyword, providedScore) {
      if (providedScore) {
        return Number(providedScore);
      }
      return commonKeyword(keyword) ? 0 : 1;
    }
    function commonKeyword(keyword) {
      return COMMON_KEYWORDS.includes(keyword.toLowerCase());
    }
    var seenDeprecations = {};
    var error = (message) => {
      console.error(message);
    };
    var warn = (message, ...args) => {
      console.log(`WARN: ${message}`, ...args);
    };
    var deprecated = (version2, message) => {
      if (seenDeprecations[`${version2}/${message}`]) return;
      console.log(`Deprecated as of ${version2}. ${message}`);
      seenDeprecations[`${version2}/${message}`] = true;
    };
    var MultiClassError = new Error();
    function remapScopeNames(mode, regexes, { key }) {
      let offset = 0;
      const scopeNames = mode[key];
      const emit = {};
      const positions = {};
      for (let i3 = 1; i3 <= regexes.length; i3++) {
        positions[i3 + offset] = scopeNames[i3];
        emit[i3 + offset] = true;
        offset += countMatchGroups(regexes[i3 - 1]);
      }
      mode[key] = positions;
      mode[key]._emit = emit;
      mode[key]._multi = true;
    }
    function beginMultiClass(mode) {
      if (!Array.isArray(mode.begin)) return;
      if (mode.skip || mode.excludeBegin || mode.returnBegin) {
        error("skip, excludeBegin, returnBegin not compatible with beginScope: {}");
        throw MultiClassError;
      }
      if (typeof mode.beginScope !== "object" || mode.beginScope === null) {
        error("beginScope must be object");
        throw MultiClassError;
      }
      remapScopeNames(mode, mode.begin, { key: "beginScope" });
      mode.begin = _rewriteBackreferences(mode.begin, { joinWith: "" });
    }
    function endMultiClass(mode) {
      if (!Array.isArray(mode.end)) return;
      if (mode.skip || mode.excludeEnd || mode.returnEnd) {
        error("skip, excludeEnd, returnEnd not compatible with endScope: {}");
        throw MultiClassError;
      }
      if (typeof mode.endScope !== "object" || mode.endScope === null) {
        error("endScope must be object");
        throw MultiClassError;
      }
      remapScopeNames(mode, mode.end, { key: "endScope" });
      mode.end = _rewriteBackreferences(mode.end, { joinWith: "" });
    }
    function scopeSugar(mode) {
      if (mode.scope && typeof mode.scope === "object" && mode.scope !== null) {
        mode.beginScope = mode.scope;
        delete mode.scope;
      }
    }
    function MultiClass(mode) {
      scopeSugar(mode);
      if (typeof mode.beginScope === "string") {
        mode.beginScope = { _wrap: mode.beginScope };
      }
      if (typeof mode.endScope === "string") {
        mode.endScope = { _wrap: mode.endScope };
      }
      beginMultiClass(mode);
      endMultiClass(mode);
    }
    function compileLanguage(language) {
      function langRe(value, global) {
        return new RegExp(
          source(value),
          "m" + (language.case_insensitive ? "i" : "") + (language.unicodeRegex ? "u" : "") + (global ? "g" : "")
        );
      }
      class MultiRegex {
        constructor() {
          this.matchIndexes = {};
          this.regexes = [];
          this.matchAt = 1;
          this.position = 0;
        }
        // @ts-ignore
        addRule(re, opts) {
          opts.position = this.position++;
          this.matchIndexes[this.matchAt] = opts;
          this.regexes.push([opts, re]);
          this.matchAt += countMatchGroups(re) + 1;
        }
        compile() {
          if (this.regexes.length === 0) {
            this.exec = () => null;
          }
          const terminators = this.regexes.map((el) => el[1]);
          this.matcherRe = langRe(_rewriteBackreferences(terminators, { joinWith: "|" }), true);
          this.lastIndex = 0;
        }
        /** @param {string} s */
        exec(s3) {
          this.matcherRe.lastIndex = this.lastIndex;
          const match = this.matcherRe.exec(s3);
          if (!match) {
            return null;
          }
          const i3 = match.findIndex((el, i4) => i4 > 0 && el !== void 0);
          const matchData = this.matchIndexes[i3];
          match.splice(0, i3);
          return Object.assign(match, matchData);
        }
      }
      class ResumableMultiRegex {
        constructor() {
          this.rules = [];
          this.multiRegexes = [];
          this.count = 0;
          this.lastIndex = 0;
          this.regexIndex = 0;
        }
        // @ts-ignore
        getMatcher(index) {
          if (this.multiRegexes[index]) return this.multiRegexes[index];
          const matcher = new MultiRegex();
          this.rules.slice(index).forEach(([re, opts]) => matcher.addRule(re, opts));
          matcher.compile();
          this.multiRegexes[index] = matcher;
          return matcher;
        }
        resumingScanAtSamePosition() {
          return this.regexIndex !== 0;
        }
        considerAll() {
          this.regexIndex = 0;
        }
        // @ts-ignore
        addRule(re, opts) {
          this.rules.push([re, opts]);
          if (opts.type === "begin") this.count++;
        }
        /** @param {string} s */
        exec(s3) {
          const m3 = this.getMatcher(this.regexIndex);
          m3.lastIndex = this.lastIndex;
          let result = m3.exec(s3);
          if (this.resumingScanAtSamePosition()) {
            if (result && result.index === this.lastIndex) ;
            else {
              const m22 = this.getMatcher(0);
              m22.lastIndex = this.lastIndex + 1;
              result = m22.exec(s3);
            }
          }
          if (result) {
            this.regexIndex += result.position + 1;
            if (this.regexIndex === this.count) {
              this.considerAll();
            }
          }
          return result;
        }
      }
      function buildModeRegex(mode) {
        const mm = new ResumableMultiRegex();
        mode.contains.forEach((term) => mm.addRule(term.begin, { rule: term, type: "begin" }));
        if (mode.terminatorEnd) {
          mm.addRule(mode.terminatorEnd, { type: "end" });
        }
        if (mode.illegal) {
          mm.addRule(mode.illegal, { type: "illegal" });
        }
        return mm;
      }
      function compileMode(mode, parent) {
        const cmode = (
          /** @type CompiledMode */
          mode
        );
        if (mode.isCompiled) return cmode;
        [
          scopeClassName,
          // do this early so compiler extensions generally don't have to worry about
          // the distinction between match/begin
          compileMatch,
          MultiClass,
          beforeMatchExt
        ].forEach((ext) => ext(mode, parent));
        language.compilerExtensions.forEach((ext) => ext(mode, parent));
        mode.__beforeBegin = null;
        [
          beginKeywords,
          // do this later so compiler extensions that come earlier have access to the
          // raw array if they wanted to perhaps manipulate it, etc.
          compileIllegal,
          // default to 1 relevance if not specified
          compileRelevance
        ].forEach((ext) => ext(mode, parent));
        mode.isCompiled = true;
        let keywordPattern = null;
        if (typeof mode.keywords === "object" && mode.keywords.$pattern) {
          mode.keywords = Object.assign({}, mode.keywords);
          keywordPattern = mode.keywords.$pattern;
          delete mode.keywords.$pattern;
        }
        keywordPattern = keywordPattern || /\w+/;
        if (mode.keywords) {
          mode.keywords = compileKeywords(mode.keywords, language.case_insensitive);
        }
        cmode.keywordPatternRe = langRe(keywordPattern, true);
        if (parent) {
          if (!mode.begin) mode.begin = /\B|\b/;
          cmode.beginRe = langRe(cmode.begin);
          if (!mode.end && !mode.endsWithParent) mode.end = /\B|\b/;
          if (mode.end) cmode.endRe = langRe(cmode.end);
          cmode.terminatorEnd = source(cmode.end) || "";
          if (mode.endsWithParent && parent.terminatorEnd) {
            cmode.terminatorEnd += (mode.end ? "|" : "") + parent.terminatorEnd;
          }
        }
        if (mode.illegal) cmode.illegalRe = langRe(
          /** @type {RegExp | string} */
          mode.illegal
        );
        if (!mode.contains) mode.contains = [];
        mode.contains = [].concat(...mode.contains.map(function(c3) {
          return expandOrCloneMode(c3 === "self" ? mode : c3);
        }));
        mode.contains.forEach(function(c3) {
          compileMode(
            /** @type Mode */
            c3,
            cmode
          );
        });
        if (mode.starts) {
          compileMode(mode.starts, parent);
        }
        cmode.matcher = buildModeRegex(cmode);
        return cmode;
      }
      if (!language.compilerExtensions) language.compilerExtensions = [];
      if (language.contains && language.contains.includes("self")) {
        throw new Error("ERR: contains `self` is not supported at the top-level of a language.  See documentation.");
      }
      language.classNameAliases = inherit$1(language.classNameAliases || {});
      return compileMode(
        /** @type Mode */
        language
      );
    }
    function dependencyOnParent(mode) {
      if (!mode) return false;
      return mode.endsWithParent || dependencyOnParent(mode.starts);
    }
    function expandOrCloneMode(mode) {
      if (mode.variants && !mode.cachedVariants) {
        mode.cachedVariants = mode.variants.map(function(variant) {
          return inherit$1(mode, { variants: null }, variant);
        });
      }
      if (mode.cachedVariants) {
        return mode.cachedVariants;
      }
      if (dependencyOnParent(mode)) {
        return inherit$1(mode, { starts: mode.starts ? inherit$1(mode.starts) : null });
      }
      if (Object.isFrozen(mode)) {
        return inherit$1(mode);
      }
      return mode;
    }
    var version = "11.11.1";
    var HTMLInjectionError = class extends Error {
      constructor(reason, html8) {
        super(reason);
        this.name = "HTMLInjectionError";
        this.html = html8;
      }
    };
    var escape3 = escapeHTML;
    var inherit = inherit$1;
    var NO_MATCH = /* @__PURE__ */ Symbol("nomatch");
    var MAX_KEYWORD_HITS = 7;
    var HLJS = function(hljs) {
      const languages = /* @__PURE__ */ Object.create(null);
      const aliases = /* @__PURE__ */ Object.create(null);
      const plugins = [];
      let SAFE_MODE = true;
      const LANGUAGE_NOT_FOUND = "Could not find the language '{}', did you forget to load/include a language module?";
      const PLAINTEXT_LANGUAGE = { disableAutodetect: true, name: "Plain text", contains: [] };
      let options2 = {
        ignoreUnescapedHTML: false,
        throwUnescapedHTML: false,
        noHighlightRe: /^(no-?highlight)$/i,
        languageDetectRe: /\blang(?:uage)?-([\w-]+)\b/i,
        classPrefix: "hljs-",
        cssSelector: "pre code",
        languages: null,
        // beta configuration options, subject to change, welcome to discuss
        // https://github.com/highlightjs/highlight.js/issues/1086
        __emitter: TokenTreeEmitter
      };
      function shouldNotHighlight(languageName) {
        return options2.noHighlightRe.test(languageName);
      }
      function blockLanguage(block2) {
        let classes = block2.className + " ";
        classes += block2.parentNode ? block2.parentNode.className : "";
        const match = options2.languageDetectRe.exec(classes);
        if (match) {
          const language = getLanguage2(match[1]);
          if (!language) {
            warn(LANGUAGE_NOT_FOUND.replace("{}", match[1]));
            warn("Falling back to no-highlight mode for this block.", block2);
          }
          return language ? match[1] : "no-highlight";
        }
        return classes.split(/\s+/).find((_class) => shouldNotHighlight(_class) || getLanguage2(_class));
      }
      function highlight2(codeOrLanguageName, optionsOrCode, ignoreIllegals) {
        let code = "";
        let languageName = "";
        if (typeof optionsOrCode === "object") {
          code = codeOrLanguageName;
          ignoreIllegals = optionsOrCode.ignoreIllegals;
          languageName = optionsOrCode.language;
        } else {
          deprecated("10.7.0", "highlight(lang, code, ...args) has been deprecated.");
          deprecated("10.7.0", "Please use highlight(code, options) instead.\nhttps://github.com/highlightjs/highlight.js/issues/2277");
          languageName = codeOrLanguageName;
          code = optionsOrCode;
        }
        if (ignoreIllegals === void 0) {
          ignoreIllegals = true;
        }
        const context = {
          code,
          language: languageName
        };
        fire("before:highlight", context);
        const result = context.result ? context.result : _highlight(context.language, context.code, ignoreIllegals);
        result.code = context.code;
        fire("after:highlight", result);
        return result;
      }
      function _highlight(languageName, codeToHighlight, ignoreIllegals, continuation) {
        const keywordHits = /* @__PURE__ */ Object.create(null);
        function keywordData(mode, matchText) {
          return mode.keywords[matchText];
        }
        function processKeywords() {
          if (!top.keywords) {
            emitter.addText(modeBuffer);
            return;
          }
          let lastIndex = 0;
          top.keywordPatternRe.lastIndex = 0;
          let match = top.keywordPatternRe.exec(modeBuffer);
          let buf = "";
          while (match) {
            buf += modeBuffer.substring(lastIndex, match.index);
            const word = language.case_insensitive ? match[0].toLowerCase() : match[0];
            const data = keywordData(top, word);
            if (data) {
              const [kind, keywordRelevance] = data;
              emitter.addText(buf);
              buf = "";
              keywordHits[word] = (keywordHits[word] || 0) + 1;
              if (keywordHits[word] <= MAX_KEYWORD_HITS) relevance += keywordRelevance;
              if (kind.startsWith("_")) {
                buf += match[0];
              } else {
                const cssClass = language.classNameAliases[kind] || kind;
                emitKeyword(match[0], cssClass);
              }
            } else {
              buf += match[0];
            }
            lastIndex = top.keywordPatternRe.lastIndex;
            match = top.keywordPatternRe.exec(modeBuffer);
          }
          buf += modeBuffer.substring(lastIndex);
          emitter.addText(buf);
        }
        function processSubLanguage() {
          if (modeBuffer === "") return;
          let result2 = null;
          if (typeof top.subLanguage === "string") {
            if (!languages[top.subLanguage]) {
              emitter.addText(modeBuffer);
              return;
            }
            result2 = _highlight(top.subLanguage, modeBuffer, true, continuations[top.subLanguage]);
            continuations[top.subLanguage] = /** @type {CompiledMode} */
            result2._top;
          } else {
            result2 = highlightAuto(modeBuffer, top.subLanguage.length ? top.subLanguage : null);
          }
          if (top.relevance > 0) {
            relevance += result2.relevance;
          }
          emitter.__addSublanguage(result2._emitter, result2.language);
        }
        function processBuffer() {
          if (top.subLanguage != null) {
            processSubLanguage();
          } else {
            processKeywords();
          }
          modeBuffer = "";
        }
        function emitKeyword(keyword, scope) {
          if (keyword === "") return;
          emitter.startScope(scope);
          emitter.addText(keyword);
          emitter.endScope();
        }
        function emitMultiClass(scope, match) {
          let i3 = 1;
          const max2 = match.length - 1;
          while (i3 <= max2) {
            if (!scope._emit[i3]) {
              i3++;
              continue;
            }
            const klass = language.classNameAliases[scope[i3]] || scope[i3];
            const text = match[i3];
            if (klass) {
              emitKeyword(text, klass);
            } else {
              modeBuffer = text;
              processKeywords();
              modeBuffer = "";
            }
            i3++;
          }
        }
        function startNewMode(mode, match) {
          if (mode.scope && typeof mode.scope === "string") {
            emitter.openNode(language.classNameAliases[mode.scope] || mode.scope);
          }
          if (mode.beginScope) {
            if (mode.beginScope._wrap) {
              emitKeyword(modeBuffer, language.classNameAliases[mode.beginScope._wrap] || mode.beginScope._wrap);
              modeBuffer = "";
            } else if (mode.beginScope._multi) {
              emitMultiClass(mode.beginScope, match);
              modeBuffer = "";
            }
          }
          top = Object.create(mode, { parent: { value: top } });
          return top;
        }
        function endOfMode(mode, match, matchPlusRemainder) {
          let matched = startsWith(mode.endRe, matchPlusRemainder);
          if (matched) {
            if (mode["on:end"]) {
              const resp = new Response(mode);
              mode["on:end"](match, resp);
              if (resp.isMatchIgnored) matched = false;
            }
            if (matched) {
              while (mode.endsParent && mode.parent) {
                mode = mode.parent;
              }
              return mode;
            }
          }
          if (mode.endsWithParent) {
            return endOfMode(mode.parent, match, matchPlusRemainder);
          }
        }
        function doIgnore(lexeme) {
          if (top.matcher.regexIndex === 0) {
            modeBuffer += lexeme[0];
            return 1;
          } else {
            resumeScanAtSamePosition = true;
            return 0;
          }
        }
        function doBeginMatch(match) {
          const lexeme = match[0];
          const newMode = match.rule;
          const resp = new Response(newMode);
          const beforeCallbacks = [newMode.__beforeBegin, newMode["on:begin"]];
          for (const cb of beforeCallbacks) {
            if (!cb) continue;
            cb(match, resp);
            if (resp.isMatchIgnored) return doIgnore(lexeme);
          }
          if (newMode.skip) {
            modeBuffer += lexeme;
          } else {
            if (newMode.excludeBegin) {
              modeBuffer += lexeme;
            }
            processBuffer();
            if (!newMode.returnBegin && !newMode.excludeBegin) {
              modeBuffer = lexeme;
            }
          }
          startNewMode(newMode, match);
          return newMode.returnBegin ? 0 : lexeme.length;
        }
        function doEndMatch(match) {
          const lexeme = match[0];
          const matchPlusRemainder = codeToHighlight.substring(match.index);
          const endMode = endOfMode(top, match, matchPlusRemainder);
          if (!endMode) {
            return NO_MATCH;
          }
          const origin = top;
          if (top.endScope && top.endScope._wrap) {
            processBuffer();
            emitKeyword(lexeme, top.endScope._wrap);
          } else if (top.endScope && top.endScope._multi) {
            processBuffer();
            emitMultiClass(top.endScope, match);
          } else if (origin.skip) {
            modeBuffer += lexeme;
          } else {
            if (!(origin.returnEnd || origin.excludeEnd)) {
              modeBuffer += lexeme;
            }
            processBuffer();
            if (origin.excludeEnd) {
              modeBuffer = lexeme;
            }
          }
          do {
            if (top.scope) {
              emitter.closeNode();
            }
            if (!top.skip && !top.subLanguage) {
              relevance += top.relevance;
            }
            top = top.parent;
          } while (top !== endMode.parent);
          if (endMode.starts) {
            startNewMode(endMode.starts, match);
          }
          return origin.returnEnd ? 0 : lexeme.length;
        }
        function processContinuations() {
          const list2 = [];
          for (let current = top; current !== language; current = current.parent) {
            if (current.scope) {
              list2.unshift(current.scope);
            }
          }
          list2.forEach((item) => emitter.openNode(item));
        }
        let lastMatch = {};
        function processLexeme(textBeforeMatch, match) {
          const lexeme = match && match[0];
          modeBuffer += textBeforeMatch;
          if (lexeme == null) {
            processBuffer();
            return 0;
          }
          if (lastMatch.type === "begin" && match.type === "end" && lastMatch.index === match.index && lexeme === "") {
            modeBuffer += codeToHighlight.slice(match.index, match.index + 1);
            if (!SAFE_MODE) {
              const err = new Error(`0 width match regex (${languageName})`);
              err.languageName = languageName;
              err.badRule = lastMatch.rule;
              throw err;
            }
            return 1;
          }
          lastMatch = match;
          if (match.type === "begin") {
            return doBeginMatch(match);
          } else if (match.type === "illegal" && !ignoreIllegals) {
            const err = new Error('Illegal lexeme "' + lexeme + '" for mode "' + (top.scope || "<unnamed>") + '"');
            err.mode = top;
            throw err;
          } else if (match.type === "end") {
            const processed = doEndMatch(match);
            if (processed !== NO_MATCH) {
              return processed;
            }
          }
          if (match.type === "illegal" && lexeme === "") {
            modeBuffer += "\n";
            return 1;
          }
          if (iterations > 1e5 && iterations > match.index * 3) {
            const err = new Error("potential infinite loop, way more iterations than matches");
            throw err;
          }
          modeBuffer += lexeme;
          return lexeme.length;
        }
        const language = getLanguage2(languageName);
        if (!language) {
          error(LANGUAGE_NOT_FOUND.replace("{}", languageName));
          throw new Error('Unknown language: "' + languageName + '"');
        }
        const md2 = compileLanguage(language);
        let result = "";
        let top = continuation || md2;
        const continuations = {};
        const emitter = new options2.__emitter(options2);
        processContinuations();
        let modeBuffer = "";
        let relevance = 0;
        let index = 0;
        let iterations = 0;
        let resumeScanAtSamePosition = false;
        try {
          if (!language.__emitTokens) {
            top.matcher.considerAll();
            for (; ; ) {
              iterations++;
              if (resumeScanAtSamePosition) {
                resumeScanAtSamePosition = false;
              } else {
                top.matcher.considerAll();
              }
              top.matcher.lastIndex = index;
              const match = top.matcher.exec(codeToHighlight);
              if (!match) break;
              const beforeMatch = codeToHighlight.substring(index, match.index);
              const processedCount = processLexeme(beforeMatch, match);
              index = match.index + processedCount;
            }
            processLexeme(codeToHighlight.substring(index));
          } else {
            language.__emitTokens(codeToHighlight, emitter);
          }
          emitter.finalize();
          result = emitter.toHTML();
          return {
            language: languageName,
            value: result,
            relevance,
            illegal: false,
            _emitter: emitter,
            _top: top
          };
        } catch (err) {
          if (err.message && err.message.includes("Illegal")) {
            return {
              language: languageName,
              value: escape3(codeToHighlight),
              illegal: true,
              relevance: 0,
              _illegalBy: {
                message: err.message,
                index,
                context: codeToHighlight.slice(index - 100, index + 100),
                mode: err.mode,
                resultSoFar: result
              },
              _emitter: emitter
            };
          } else if (SAFE_MODE) {
            return {
              language: languageName,
              value: escape3(codeToHighlight),
              illegal: false,
              relevance: 0,
              errorRaised: err,
              _emitter: emitter,
              _top: top
            };
          } else {
            throw err;
          }
        }
      }
      function justTextHighlightResult(code) {
        const result = {
          value: escape3(code),
          illegal: false,
          relevance: 0,
          _top: PLAINTEXT_LANGUAGE,
          _emitter: new options2.__emitter(options2)
        };
        result._emitter.addText(code);
        return result;
      }
      function highlightAuto(code, languageSubset) {
        languageSubset = languageSubset || options2.languages || Object.keys(languages);
        const plaintext = justTextHighlightResult(code);
        const results = languageSubset.filter(getLanguage2).filter(autoDetection).map(
          (name) => _highlight(name, code, false)
        );
        results.unshift(plaintext);
        const sorted = results.sort((a3, b2) => {
          if (a3.relevance !== b2.relevance) return b2.relevance - a3.relevance;
          if (a3.language && b2.language) {
            if (getLanguage2(a3.language).supersetOf === b2.language) {
              return 1;
            } else if (getLanguage2(b2.language).supersetOf === a3.language) {
              return -1;
            }
          }
          return 0;
        });
        const [best, secondBest] = sorted;
        const result = best;
        result.secondBest = secondBest;
        return result;
      }
      function updateClassName(element, currentLang2, resultLang) {
        const language = currentLang2 && aliases[currentLang2] || resultLang;
        element.classList.add("hljs");
        element.classList.add(`language-${language}`);
      }
      function highlightElement(element) {
        let node = null;
        const language = blockLanguage(element);
        if (shouldNotHighlight(language)) return;
        fire(
          "before:highlightElement",
          { el: element, language }
        );
        if (element.dataset.highlighted) {
          console.log("Element previously highlighted. To highlight again, first unset `dataset.highlighted`.", element);
          return;
        }
        if (element.children.length > 0) {
          if (!options2.ignoreUnescapedHTML) {
            console.warn("One of your code blocks includes unescaped HTML. This is a potentially serious security risk.");
            console.warn("https://github.com/highlightjs/highlight.js/wiki/security");
            console.warn("The element with unescaped HTML:");
            console.warn(element);
          }
          if (options2.throwUnescapedHTML) {
            const err = new HTMLInjectionError(
              "One of your code blocks includes unescaped HTML.",
              element.innerHTML
            );
            throw err;
          }
        }
        node = element;
        const text = node.textContent;
        const result = language ? highlight2(text, { language, ignoreIllegals: true }) : highlightAuto(text);
        element.innerHTML = result.value;
        element.dataset.highlighted = "yes";
        updateClassName(element, language, result.language);
        element.result = {
          language: result.language,
          // TODO: remove with version 11.0
          re: result.relevance,
          relevance: result.relevance
        };
        if (result.secondBest) {
          element.secondBest = {
            language: result.secondBest.language,
            relevance: result.secondBest.relevance
          };
        }
        fire("after:highlightElement", { el: element, result, text });
      }
      function configure(userOptions) {
        options2 = inherit(options2, userOptions);
      }
      const initHighlighting = () => {
        highlightAll();
        deprecated("10.6.0", "initHighlighting() deprecated.  Use highlightAll() now.");
      };
      function initHighlightingOnLoad() {
        highlightAll();
        deprecated("10.6.0", "initHighlightingOnLoad() deprecated.  Use highlightAll() now.");
      }
      let wantsHighlight = false;
      function highlightAll() {
        function boot() {
          highlightAll();
        }
        if (document.readyState === "loading") {
          if (!wantsHighlight) {
            window.addEventListener("DOMContentLoaded", boot, false);
          }
          wantsHighlight = true;
          return;
        }
        const blocks = document.querySelectorAll(options2.cssSelector);
        blocks.forEach(highlightElement);
      }
      function registerLanguage(languageName, languageDefinition) {
        let lang = null;
        try {
          lang = languageDefinition(hljs);
        } catch (error$1) {
          error("Language definition for '{}' could not be registered.".replace("{}", languageName));
          if (!SAFE_MODE) {
            throw error$1;
          } else {
            error(error$1);
          }
          lang = PLAINTEXT_LANGUAGE;
        }
        if (!lang.name) lang.name = languageName;
        languages[languageName] = lang;
        lang.rawDefinition = languageDefinition.bind(null, hljs);
        if (lang.aliases) {
          registerAliases(lang.aliases, { languageName });
        }
      }
      function unregisterLanguage(languageName) {
        delete languages[languageName];
        for (const alias of Object.keys(aliases)) {
          if (aliases[alias] === languageName) {
            delete aliases[alias];
          }
        }
      }
      function listLanguages() {
        return Object.keys(languages);
      }
      function getLanguage2(name) {
        name = (name || "").toLowerCase();
        return languages[name] || languages[aliases[name]];
      }
      function registerAliases(aliasList, { languageName }) {
        if (typeof aliasList === "string") {
          aliasList = [aliasList];
        }
        aliasList.forEach((alias) => {
          aliases[alias.toLowerCase()] = languageName;
        });
      }
      function autoDetection(name) {
        const lang = getLanguage2(name);
        return lang && !lang.disableAutodetect;
      }
      function upgradePluginAPI(plugin) {
        if (plugin["before:highlightBlock"] && !plugin["before:highlightElement"]) {
          plugin["before:highlightElement"] = (data) => {
            plugin["before:highlightBlock"](
              Object.assign({ block: data.el }, data)
            );
          };
        }
        if (plugin["after:highlightBlock"] && !plugin["after:highlightElement"]) {
          plugin["after:highlightElement"] = (data) => {
            plugin["after:highlightBlock"](
              Object.assign({ block: data.el }, data)
            );
          };
        }
      }
      function addPlugin(plugin) {
        upgradePluginAPI(plugin);
        plugins.push(plugin);
      }
      function removePlugin(plugin) {
        const index = plugins.indexOf(plugin);
        if (index !== -1) {
          plugins.splice(index, 1);
        }
      }
      function fire(event, args) {
        const cb = event;
        plugins.forEach(function(plugin) {
          if (plugin[cb]) {
            plugin[cb](args);
          }
        });
      }
      function deprecateHighlightBlock(el) {
        deprecated("10.7.0", "highlightBlock will be removed entirely in v12.0");
        deprecated("10.7.0", "Please use highlightElement now.");
        return highlightElement(el);
      }
      Object.assign(hljs, {
        highlight: highlight2,
        highlightAuto,
        highlightAll,
        highlightElement,
        // TODO: Remove with v12 API
        highlightBlock: deprecateHighlightBlock,
        configure,
        initHighlighting,
        initHighlightingOnLoad,
        registerLanguage,
        unregisterLanguage,
        listLanguages,
        getLanguage: getLanguage2,
        registerAliases,
        autoDetection,
        inherit,
        addPlugin,
        removePlugin
      });
      hljs.debugMode = function() {
        SAFE_MODE = false;
      };
      hljs.safeMode = function() {
        SAFE_MODE = true;
      };
      hljs.versionString = version;
      hljs.regex = {
        concat,
        lookahead,
        either,
        optional,
        anyNumberOfTimes
      };
      for (const key in MODES) {
        if (typeof MODES[key] === "object") {
          deepFreeze(MODES[key]);
        }
      }
      Object.assign(hljs, MODES);
      return hljs;
    };
    var highlight = HLJS({});
    highlight.newInstance = () => HLJS({});
    module.exports = highlight;
    highlight.HighlightJS = highlight;
    highlight.default = highlight;
  }
});

// node_modules/highlight.js/lib/languages/xml.js
var require_xml = __commonJS({
  "node_modules/highlight.js/lib/languages/xml.js"(exports, module) {
    "use strict";
    function xml(hljs) {
      const regex = hljs.regex;
      const TAG_NAME_RE = regex.concat(/[\p{L}_]/u, regex.optional(/[\p{L}0-9_.-]*:/u), /[\p{L}0-9_.-]*/u);
      const XML_IDENT_RE = /[\p{L}0-9._:-]+/u;
      const XML_ENTITIES = {
        className: "symbol",
        begin: /&[a-z]+;|&#[0-9]+;|&#x[a-f0-9]+;/
      };
      const XML_META_KEYWORDS = {
        begin: /\s/,
        contains: [
          {
            className: "keyword",
            begin: /#?[a-z_][a-z1-9_-]+/,
            illegal: /\n/
          }
        ]
      };
      const XML_META_PAR_KEYWORDS = hljs.inherit(XML_META_KEYWORDS, {
        begin: /\(/,
        end: /\)/
      });
      const APOS_META_STRING_MODE = hljs.inherit(hljs.APOS_STRING_MODE, { className: "string" });
      const QUOTE_META_STRING_MODE = hljs.inherit(hljs.QUOTE_STRING_MODE, { className: "string" });
      const TAG_INTERNALS = {
        endsWithParent: true,
        illegal: /</,
        relevance: 0,
        contains: [
          {
            className: "attr",
            begin: XML_IDENT_RE,
            relevance: 0
          },
          {
            begin: /=\s*/,
            relevance: 0,
            contains: [
              {
                className: "string",
                endsParent: true,
                variants: [
                  {
                    begin: /"/,
                    end: /"/,
                    contains: [XML_ENTITIES]
                  },
                  {
                    begin: /'/,
                    end: /'/,
                    contains: [XML_ENTITIES]
                  },
                  { begin: /[^\s"'=<>`]+/ }
                ]
              }
            ]
          }
        ]
      };
      return {
        name: "HTML, XML",
        aliases: [
          "html",
          "xhtml",
          "rss",
          "atom",
          "xjb",
          "xsd",
          "xsl",
          "plist",
          "wsf",
          "svg"
        ],
        case_insensitive: true,
        unicodeRegex: true,
        contains: [
          {
            className: "meta",
            begin: /<![a-z]/,
            end: />/,
            relevance: 10,
            contains: [
              XML_META_KEYWORDS,
              QUOTE_META_STRING_MODE,
              APOS_META_STRING_MODE,
              XML_META_PAR_KEYWORDS,
              {
                begin: /\[/,
                end: /\]/,
                contains: [
                  {
                    className: "meta",
                    begin: /<![a-z]/,
                    end: />/,
                    contains: [
                      XML_META_KEYWORDS,
                      XML_META_PAR_KEYWORDS,
                      QUOTE_META_STRING_MODE,
                      APOS_META_STRING_MODE
                    ]
                  }
                ]
              }
            ]
          },
          hljs.COMMENT(
            /<!--/,
            /-->/,
            { relevance: 10 }
          ),
          {
            begin: /<!\[CDATA\[/,
            end: /\]\]>/,
            relevance: 10
          },
          XML_ENTITIES,
          // xml processing instructions
          {
            className: "meta",
            end: /\?>/,
            variants: [
              {
                begin: /<\?xml/,
                relevance: 10,
                contains: [
                  QUOTE_META_STRING_MODE
                ]
              },
              {
                begin: /<\?[a-z][a-z0-9]+/
              }
            ]
          },
          {
            className: "tag",
            /*
            The lookahead pattern (?=...) ensures that 'begin' only matches
            '<style' as a single word, followed by a whitespace or an
            ending bracket.
            */
            begin: /<style(?=\s|>)/,
            end: />/,
            keywords: { name: "style" },
            contains: [TAG_INTERNALS],
            starts: {
              end: /<\/style>/,
              returnEnd: true,
              subLanguage: [
                "css",
                "xml"
              ]
            }
          },
          {
            className: "tag",
            // See the comment in the <style tag about the lookahead pattern
            begin: /<script(?=\s|>)/,
            end: />/,
            keywords: { name: "script" },
            contains: [TAG_INTERNALS],
            starts: {
              end: /<\/script>/,
              returnEnd: true,
              subLanguage: [
                "javascript",
                "handlebars",
                "xml"
              ]
            }
          },
          // we need this for now for jSX
          {
            className: "tag",
            begin: /<>|<\/>/
          },
          // open tag
          {
            className: "tag",
            begin: regex.concat(
              /</,
              regex.lookahead(regex.concat(
                TAG_NAME_RE,
                // <tag/>
                // <tag>
                // <tag ...
                regex.either(/\/>/, />/, /\s/)
              ))
            ),
            end: /\/?>/,
            contains: [
              {
                className: "name",
                begin: TAG_NAME_RE,
                relevance: 0,
                starts: TAG_INTERNALS
              }
            ]
          },
          // close tag
          {
            className: "tag",
            begin: regex.concat(
              /<\//,
              regex.lookahead(regex.concat(
                TAG_NAME_RE,
                />/
              ))
            ),
            contains: [
              {
                className: "name",
                begin: TAG_NAME_RE,
                relevance: 0
              },
              {
                begin: />/,
                relevance: 0,
                endsParent: true
              }
            ]
          }
        ]
      };
    }
    module.exports = xml;
  }
});

// node_modules/highlight.js/lib/languages/bash.js
var require_bash = __commonJS({
  "node_modules/highlight.js/lib/languages/bash.js"(exports, module) {
    "use strict";
    function bash(hljs) {
      const regex = hljs.regex;
      const VAR = {};
      const BRACED_VAR = {
        begin: /\$\{/,
        end: /\}/,
        contains: [
          "self",
          {
            begin: /:-/,
            contains: [VAR]
          }
          // default values
        ]
      };
      Object.assign(VAR, {
        className: "variable",
        variants: [
          { begin: regex.concat(
            /\$[\w\d#@][\w\d_]*/,
            // negative look-ahead tries to avoid matching patterns that are not
            // Perl at all like $ident$, @ident@, etc.
            `(?![\\w\\d])(?![$])`
          ) },
          BRACED_VAR
        ]
      });
      const SUBST = {
        className: "subst",
        begin: /\$\(/,
        end: /\)/,
        contains: [hljs.BACKSLASH_ESCAPE]
      };
      const COMMENT = hljs.inherit(
        hljs.COMMENT(),
        {
          match: [
            /(^|\s)/,
            /#.*$/
          ],
          scope: {
            2: "comment"
          }
        }
      );
      const HERE_DOC = {
        begin: /<<-?\s*(?=\w+)/,
        starts: { contains: [
          hljs.END_SAME_AS_BEGIN({
            begin: /(\w+)/,
            end: /(\w+)/,
            className: "string"
          })
        ] }
      };
      const QUOTE_STRING = {
        className: "string",
        begin: /"/,
        end: /"/,
        contains: [
          hljs.BACKSLASH_ESCAPE,
          VAR,
          SUBST
        ]
      };
      SUBST.contains.push(QUOTE_STRING);
      const ESCAPED_QUOTE = {
        match: /\\"/
      };
      const APOS_STRING = {
        className: "string",
        begin: /'/,
        end: /'/
      };
      const ESCAPED_APOS = {
        match: /\\'/
      };
      const ARITHMETIC = {
        begin: /\$?\(\(/,
        end: /\)\)/,
        contains: [
          {
            begin: /\d+#[0-9a-f]+/,
            className: "number"
          },
          hljs.NUMBER_MODE,
          VAR
        ]
      };
      const SH_LIKE_SHELLS = [
        "fish",
        "bash",
        "zsh",
        "sh",
        "csh",
        "ksh",
        "tcsh",
        "dash",
        "scsh"
      ];
      const KNOWN_SHEBANG = hljs.SHEBANG({
        binary: `(${SH_LIKE_SHELLS.join("|")})`,
        relevance: 10
      });
      const FUNCTION = {
        className: "function",
        begin: /\w[\w\d_]*\s*\(\s*\)\s*\{/,
        returnBegin: true,
        contains: [hljs.inherit(hljs.TITLE_MODE, { begin: /\w[\w\d_]*/ })],
        relevance: 0
      };
      const KEYWORDS = [
        "if",
        "then",
        "else",
        "elif",
        "fi",
        "time",
        "for",
        "while",
        "until",
        "in",
        "do",
        "done",
        "case",
        "esac",
        "coproc",
        "function",
        "select"
      ];
      const LITERALS = [
        "true",
        "false"
      ];
      const PATH_MODE = { match: /(\/[a-z._-]+)+/ };
      const SHELL_BUILT_INS = [
        "break",
        "cd",
        "continue",
        "eval",
        "exec",
        "exit",
        "export",
        "getopts",
        "hash",
        "pwd",
        "readonly",
        "return",
        "shift",
        "test",
        "times",
        "trap",
        "umask",
        "unset"
      ];
      const BASH_BUILT_INS = [
        "alias",
        "bind",
        "builtin",
        "caller",
        "command",
        "declare",
        "echo",
        "enable",
        "help",
        "let",
        "local",
        "logout",
        "mapfile",
        "printf",
        "read",
        "readarray",
        "source",
        "sudo",
        "type",
        "typeset",
        "ulimit",
        "unalias"
      ];
      const ZSH_BUILT_INS = [
        "autoload",
        "bg",
        "bindkey",
        "bye",
        "cap",
        "chdir",
        "clone",
        "comparguments",
        "compcall",
        "compctl",
        "compdescribe",
        "compfiles",
        "compgroups",
        "compquote",
        "comptags",
        "comptry",
        "compvalues",
        "dirs",
        "disable",
        "disown",
        "echotc",
        "echoti",
        "emulate",
        "fc",
        "fg",
        "float",
        "functions",
        "getcap",
        "getln",
        "history",
        "integer",
        "jobs",
        "kill",
        "limit",
        "log",
        "noglob",
        "popd",
        "print",
        "pushd",
        "pushln",
        "rehash",
        "sched",
        "setcap",
        "setopt",
        "stat",
        "suspend",
        "ttyctl",
        "unfunction",
        "unhash",
        "unlimit",
        "unsetopt",
        "vared",
        "wait",
        "whence",
        "where",
        "which",
        "zcompile",
        "zformat",
        "zftp",
        "zle",
        "zmodload",
        "zparseopts",
        "zprof",
        "zpty",
        "zregexparse",
        "zsocket",
        "zstyle",
        "ztcp"
      ];
      const GNU_CORE_UTILS = [
        "chcon",
        "chgrp",
        "chown",
        "chmod",
        "cp",
        "dd",
        "df",
        "dir",
        "dircolors",
        "ln",
        "ls",
        "mkdir",
        "mkfifo",
        "mknod",
        "mktemp",
        "mv",
        "realpath",
        "rm",
        "rmdir",
        "shred",
        "sync",
        "touch",
        "truncate",
        "vdir",
        "b2sum",
        "base32",
        "base64",
        "cat",
        "cksum",
        "comm",
        "csplit",
        "cut",
        "expand",
        "fmt",
        "fold",
        "head",
        "join",
        "md5sum",
        "nl",
        "numfmt",
        "od",
        "paste",
        "ptx",
        "pr",
        "sha1sum",
        "sha224sum",
        "sha256sum",
        "sha384sum",
        "sha512sum",
        "shuf",
        "sort",
        "split",
        "sum",
        "tac",
        "tail",
        "tr",
        "tsort",
        "unexpand",
        "uniq",
        "wc",
        "arch",
        "basename",
        "chroot",
        "date",
        "dirname",
        "du",
        "echo",
        "env",
        "expr",
        "factor",
        // "false", // keyword literal already
        "groups",
        "hostid",
        "id",
        "link",
        "logname",
        "nice",
        "nohup",
        "nproc",
        "pathchk",
        "pinky",
        "printenv",
        "printf",
        "pwd",
        "readlink",
        "runcon",
        "seq",
        "sleep",
        "stat",
        "stdbuf",
        "stty",
        "tee",
        "test",
        "timeout",
        // "true", // keyword literal already
        "tty",
        "uname",
        "unlink",
        "uptime",
        "users",
        "who",
        "whoami",
        "yes"
      ];
      return {
        name: "Bash",
        aliases: [
          "sh",
          "zsh"
        ],
        keywords: {
          $pattern: /\b[a-z][a-z0-9._-]+\b/,
          keyword: KEYWORDS,
          literal: LITERALS,
          built_in: [
            ...SHELL_BUILT_INS,
            ...BASH_BUILT_INS,
            // Shell modifiers
            "set",
            "shopt",
            ...ZSH_BUILT_INS,
            ...GNU_CORE_UTILS
          ]
        },
        contains: [
          KNOWN_SHEBANG,
          // to catch known shells and boost relevancy
          hljs.SHEBANG(),
          // to catch unknown shells but still highlight the shebang
          FUNCTION,
          ARITHMETIC,
          COMMENT,
          HERE_DOC,
          PATH_MODE,
          QUOTE_STRING,
          ESCAPED_QUOTE,
          APOS_STRING,
          ESCAPED_APOS,
          VAR
        ]
      };
    }
    module.exports = bash;
  }
});

// node_modules/highlight.js/lib/languages/c.js
var require_c = __commonJS({
  "node_modules/highlight.js/lib/languages/c.js"(exports, module) {
    "use strict";
    function c3(hljs) {
      const regex = hljs.regex;
      const C_LINE_COMMENT_MODE = hljs.COMMENT("//", "$", { contains: [{ begin: /\\\n/ }] });
      const DECLTYPE_AUTO_RE = "decltype\\(auto\\)";
      const NAMESPACE_RE = "[a-zA-Z_]\\w*::";
      const TEMPLATE_ARGUMENT_RE = "<[^<>]+>";
      const FUNCTION_TYPE_RE = "(" + DECLTYPE_AUTO_RE + "|" + regex.optional(NAMESPACE_RE) + "[a-zA-Z_]\\w*" + regex.optional(TEMPLATE_ARGUMENT_RE) + ")";
      const TYPES = {
        className: "type",
        variants: [
          { begin: "\\b[a-z\\d_]*_t\\b" },
          { match: /\batomic_[a-z]{3,6}\b/ }
        ]
      };
      const CHARACTER_ESCAPES = "\\\\(x[0-9A-Fa-f]{2}|u[0-9A-Fa-f]{4,8}|[0-7]{3}|\\S)";
      const STRINGS = {
        className: "string",
        variants: [
          {
            begin: '(u8?|U|L)?"',
            end: '"',
            illegal: "\\n",
            contains: [hljs.BACKSLASH_ESCAPE]
          },
          {
            begin: "(u8?|U|L)?'(" + CHARACTER_ESCAPES + "|.)",
            end: "'",
            illegal: "."
          },
          hljs.END_SAME_AS_BEGIN({
            begin: /(?:u8?|U|L)?R"([^()\\ ]{0,16})\(/,
            end: /\)([^()\\ ]{0,16})"/
          })
        ]
      };
      const NUMBERS = {
        className: "number",
        variants: [
          { match: /\b(0b[01']+)/ },
          { match: /(-?)\b([\d']+(\.[\d']*)?|\.[\d']+)((ll|LL|l|L)(u|U)?|(u|U)(ll|LL|l|L)?|f|F|b|B)/ },
          { match: /(-?)\b(0[xX][a-fA-F0-9]+(?:'[a-fA-F0-9]+)*(?:\.[a-fA-F0-9]*(?:'[a-fA-F0-9]*)*)?(?:[pP][-+]?[0-9]+)?(l|L)?(u|U)?)/ },
          { match: /(-?)\b\d+(?:'\d+)*(?:\.\d*(?:'\d*)*)?(?:[eE][-+]?\d+)?/ }
        ],
        relevance: 0
      };
      const PREPROCESSOR = {
        className: "meta",
        begin: /#\s*[a-z]+\b/,
        end: /$/,
        keywords: { keyword: "if else elif endif define undef warning error line pragma _Pragma ifdef ifndef elifdef elifndef include" },
        contains: [
          {
            begin: /\\\n/,
            relevance: 0
          },
          hljs.inherit(STRINGS, { className: "string" }),
          {
            className: "string",
            begin: /<.*?>/
          },
          C_LINE_COMMENT_MODE,
          hljs.C_BLOCK_COMMENT_MODE
        ]
      };
      const TITLE_MODE = {
        className: "title",
        begin: regex.optional(NAMESPACE_RE) + hljs.IDENT_RE,
        relevance: 0
      };
      const FUNCTION_TITLE = regex.optional(NAMESPACE_RE) + hljs.IDENT_RE + "\\s*\\(";
      const C_KEYWORDS = [
        "asm",
        "auto",
        "break",
        "case",
        "continue",
        "default",
        "do",
        "else",
        "enum",
        "extern",
        "for",
        "fortran",
        "goto",
        "if",
        "inline",
        "register",
        "restrict",
        "return",
        "sizeof",
        "typeof",
        "typeof_unqual",
        "struct",
        "switch",
        "typedef",
        "union",
        "volatile",
        "while",
        "_Alignas",
        "_Alignof",
        "_Atomic",
        "_Generic",
        "_Noreturn",
        "_Static_assert",
        "_Thread_local",
        // aliases
        "alignas",
        "alignof",
        "noreturn",
        "static_assert",
        "thread_local",
        // not a C keyword but is, for all intents and purposes, treated exactly like one.
        "_Pragma"
      ];
      const C_TYPES = [
        "float",
        "double",
        "signed",
        "unsigned",
        "int",
        "short",
        "long",
        "char",
        "void",
        "_Bool",
        "_BitInt",
        "_Complex",
        "_Imaginary",
        "_Decimal32",
        "_Decimal64",
        "_Decimal96",
        "_Decimal128",
        "_Decimal64x",
        "_Decimal128x",
        "_Float16",
        "_Float32",
        "_Float64",
        "_Float128",
        "_Float32x",
        "_Float64x",
        "_Float128x",
        // modifiers
        "const",
        "static",
        "constexpr",
        // aliases
        "complex",
        "bool",
        "imaginary"
      ];
      const KEYWORDS = {
        keyword: C_KEYWORDS,
        type: C_TYPES,
        literal: "true false NULL",
        // TODO: apply hinting work similar to what was done in cpp.js
        built_in: "std string wstring cin cout cerr clog stdin stdout stderr stringstream istringstream ostringstream auto_ptr deque list queue stack vector map set pair bitset multiset multimap unordered_set unordered_map unordered_multiset unordered_multimap priority_queue make_pair array shared_ptr abort terminate abs acos asin atan2 atan calloc ceil cosh cos exit exp fabs floor fmod fprintf fputs free frexp fscanf future isalnum isalpha iscntrl isdigit isgraph islower isprint ispunct isspace isupper isxdigit tolower toupper labs ldexp log10 log malloc realloc memchr memcmp memcpy memset modf pow printf putchar puts scanf sinh sin snprintf sprintf sqrt sscanf strcat strchr strcmp strcpy strcspn strlen strncat strncmp strncpy strpbrk strrchr strspn strstr tanh tan vfprintf vprintf vsprintf endl initializer_list unique_ptr"
      };
      const EXPRESSION_CONTAINS = [
        PREPROCESSOR,
        TYPES,
        C_LINE_COMMENT_MODE,
        hljs.C_BLOCK_COMMENT_MODE,
        NUMBERS,
        STRINGS
      ];
      const EXPRESSION_CONTEXT = {
        // This mode covers expression context where we can't expect a function
        // definition and shouldn't highlight anything that looks like one:
        // `return some()`, `else if()`, `(x*sum(1, 2))`
        variants: [
          {
            begin: /=/,
            end: /;/
          },
          {
            begin: /\(/,
            end: /\)/
          },
          {
            beginKeywords: "new throw return else",
            end: /;/
          }
        ],
        keywords: KEYWORDS,
        contains: EXPRESSION_CONTAINS.concat([
          {
            begin: /\(/,
            end: /\)/,
            keywords: KEYWORDS,
            contains: EXPRESSION_CONTAINS.concat(["self"]),
            relevance: 0
          }
        ]),
        relevance: 0
      };
      const FUNCTION_DECLARATION = {
        begin: "(" + FUNCTION_TYPE_RE + "[\\*&\\s]+)+" + FUNCTION_TITLE,
        returnBegin: true,
        end: /[{;=]/,
        excludeEnd: true,
        keywords: KEYWORDS,
        illegal: /[^\w\s\*&:<>.]/,
        contains: [
          {
            // to prevent it from being confused as the function title
            begin: DECLTYPE_AUTO_RE,
            keywords: KEYWORDS,
            relevance: 0
          },
          {
            begin: FUNCTION_TITLE,
            returnBegin: true,
            contains: [hljs.inherit(TITLE_MODE, { className: "title.function" })],
            relevance: 0
          },
          // allow for multiple declarations, e.g.:
          // extern void f(int), g(char);
          {
            relevance: 0,
            match: /,/
          },
          {
            className: "params",
            begin: /\(/,
            end: /\)/,
            keywords: KEYWORDS,
            relevance: 0,
            contains: [
              C_LINE_COMMENT_MODE,
              hljs.C_BLOCK_COMMENT_MODE,
              STRINGS,
              NUMBERS,
              TYPES,
              // Count matching parentheses.
              {
                begin: /\(/,
                end: /\)/,
                keywords: KEYWORDS,
                relevance: 0,
                contains: [
                  "self",
                  C_LINE_COMMENT_MODE,
                  hljs.C_BLOCK_COMMENT_MODE,
                  STRINGS,
                  NUMBERS,
                  TYPES
                ]
              }
            ]
          },
          TYPES,
          C_LINE_COMMENT_MODE,
          hljs.C_BLOCK_COMMENT_MODE,
          PREPROCESSOR
        ]
      };
      return {
        name: "C",
        aliases: ["h"],
        keywords: KEYWORDS,
        // Until differentiations are added between `c` and `cpp`, `c` will
        // not be auto-detected to avoid auto-detect conflicts between C and C++
        disableAutodetect: true,
        illegal: "</",
        contains: [].concat(
          EXPRESSION_CONTEXT,
          FUNCTION_DECLARATION,
          EXPRESSION_CONTAINS,
          [
            PREPROCESSOR,
            {
              begin: hljs.IDENT_RE + "::",
              keywords: KEYWORDS
            },
            {
              className: "class",
              beginKeywords: "enum class struct union",
              end: /[{;:<>=]/,
              contains: [
                { beginKeywords: "final class struct" },
                hljs.TITLE_MODE
              ]
            }
          ]
        ),
        exports: {
          preprocessor: PREPROCESSOR,
          strings: STRINGS,
          keywords: KEYWORDS
        }
      };
    }
    module.exports = c3;
  }
});

// node_modules/highlight.js/lib/languages/cpp.js
var require_cpp = __commonJS({
  "node_modules/highlight.js/lib/languages/cpp.js"(exports, module) {
    "use strict";
    function cpp(hljs) {
      const regex = hljs.regex;
      const C_LINE_COMMENT_MODE = hljs.COMMENT("//", "$", { contains: [{ begin: /\\\n/ }] });
      const DECLTYPE_AUTO_RE = "decltype\\(auto\\)";
      const NAMESPACE_RE = "[a-zA-Z_]\\w*::";
      const TEMPLATE_ARGUMENT_RE = "<[^<>]+>";
      const FUNCTION_TYPE_RE = "(?!struct)(" + DECLTYPE_AUTO_RE + "|" + regex.optional(NAMESPACE_RE) + "[a-zA-Z_]\\w*" + regex.optional(TEMPLATE_ARGUMENT_RE) + ")";
      const CPP_PRIMITIVE_TYPES = {
        className: "type",
        begin: "\\b[a-z\\d_]*_t\\b"
      };
      const CHARACTER_ESCAPES = "\\\\(x[0-9A-Fa-f]{2}|u[0-9A-Fa-f]{4,8}|[0-7]{3}|\\S)";
      const STRINGS = {
        className: "string",
        variants: [
          {
            begin: '(u8?|U|L)?"',
            end: '"',
            illegal: "\\n",
            contains: [hljs.BACKSLASH_ESCAPE]
          },
          {
            begin: "(u8?|U|L)?'(" + CHARACTER_ESCAPES + "|.)",
            end: "'",
            illegal: "."
          },
          hljs.END_SAME_AS_BEGIN({
            begin: /(?:u8?|U|L)?R"([^()\\ ]{0,16})\(/,
            end: /\)([^()\\ ]{0,16})"/
          })
        ]
      };
      const NUMBERS = {
        className: "number",
        variants: [
          // Floating-point literal.
          {
            begin: "[+-]?(?:(?:[0-9](?:'?[0-9])*\\.(?:[0-9](?:'?[0-9])*)?|\\.[0-9](?:'?[0-9])*)(?:[Ee][+-]?[0-9](?:'?[0-9])*)?|[0-9](?:'?[0-9])*[Ee][+-]?[0-9](?:'?[0-9])*|0[Xx](?:[0-9A-Fa-f](?:'?[0-9A-Fa-f])*(?:\\.(?:[0-9A-Fa-f](?:'?[0-9A-Fa-f])*)?)?|\\.[0-9A-Fa-f](?:'?[0-9A-Fa-f])*)[Pp][+-]?[0-9](?:'?[0-9])*)(?:[Ff](?:16|32|64|128)?|(BF|bf)16|[Ll]|)"
          },
          // Integer literal.
          {
            begin: "[+-]?\\b(?:0[Bb][01](?:'?[01])*|0[Xx][0-9A-Fa-f](?:'?[0-9A-Fa-f])*|0(?:'?[0-7])*|[1-9](?:'?[0-9])*)(?:[Uu](?:LL?|ll?)|[Uu][Zz]?|(?:LL?|ll?)[Uu]?|[Zz][Uu]|)"
            // Note: there are user-defined literal suffixes too, but perhaps having the custom suffix not part of the
            // literal highlight actually makes it stand out more.
          }
        ],
        relevance: 0
      };
      const PREPROCESSOR = {
        className: "meta",
        begin: /#\s*[a-z]+\b/,
        end: /$/,
        keywords: { keyword: "if else elif endif define undef warning error line pragma _Pragma ifdef ifndef include" },
        contains: [
          {
            begin: /\\\n/,
            relevance: 0
          },
          hljs.inherit(STRINGS, { className: "string" }),
          {
            className: "string",
            begin: /<.*?>/
          },
          C_LINE_COMMENT_MODE,
          hljs.C_BLOCK_COMMENT_MODE
        ]
      };
      const TITLE_MODE = {
        className: "title",
        begin: regex.optional(NAMESPACE_RE) + hljs.IDENT_RE,
        relevance: 0
      };
      const FUNCTION_TITLE = regex.optional(NAMESPACE_RE) + hljs.IDENT_RE + "\\s*\\(";
      const RESERVED_KEYWORDS = [
        "alignas",
        "alignof",
        "and",
        "and_eq",
        "asm",
        "atomic_cancel",
        "atomic_commit",
        "atomic_noexcept",
        "auto",
        "bitand",
        "bitor",
        "break",
        "case",
        "catch",
        "class",
        "co_await",
        "co_return",
        "co_yield",
        "compl",
        "concept",
        "const_cast|10",
        "consteval",
        "constexpr",
        "constinit",
        "continue",
        "decltype",
        "default",
        "delete",
        "do",
        "dynamic_cast|10",
        "else",
        "enum",
        "explicit",
        "export",
        "extern",
        "false",
        "final",
        "for",
        "friend",
        "goto",
        "if",
        "import",
        "inline",
        "module",
        "mutable",
        "namespace",
        "new",
        "noexcept",
        "not",
        "not_eq",
        "nullptr",
        "operator",
        "or",
        "or_eq",
        "override",
        "private",
        "protected",
        "public",
        "reflexpr",
        "register",
        "reinterpret_cast|10",
        "requires",
        "return",
        "sizeof",
        "static_assert",
        "static_cast|10",
        "struct",
        "switch",
        "synchronized",
        "template",
        "this",
        "thread_local",
        "throw",
        "transaction_safe",
        "transaction_safe_dynamic",
        "true",
        "try",
        "typedef",
        "typeid",
        "typename",
        "union",
        "using",
        "virtual",
        "volatile",
        "while",
        "xor",
        "xor_eq"
      ];
      const RESERVED_TYPES = [
        "bool",
        "char",
        "char16_t",
        "char32_t",
        "char8_t",
        "double",
        "float",
        "int",
        "long",
        "short",
        "void",
        "wchar_t",
        "unsigned",
        "signed",
        "const",
        "static"
      ];
      const TYPE_HINTS = [
        "any",
        "auto_ptr",
        "barrier",
        "binary_semaphore",
        "bitset",
        "complex",
        "condition_variable",
        "condition_variable_any",
        "counting_semaphore",
        "deque",
        "false_type",
        "flat_map",
        "flat_set",
        "future",
        "imaginary",
        "initializer_list",
        "istringstream",
        "jthread",
        "latch",
        "lock_guard",
        "multimap",
        "multiset",
        "mutex",
        "optional",
        "ostringstream",
        "packaged_task",
        "pair",
        "promise",
        "priority_queue",
        "queue",
        "recursive_mutex",
        "recursive_timed_mutex",
        "scoped_lock",
        "set",
        "shared_future",
        "shared_lock",
        "shared_mutex",
        "shared_timed_mutex",
        "shared_ptr",
        "stack",
        "string_view",
        "stringstream",
        "timed_mutex",
        "thread",
        "true_type",
        "tuple",
        "unique_lock",
        "unique_ptr",
        "unordered_map",
        "unordered_multimap",
        "unordered_multiset",
        "unordered_set",
        "variant",
        "vector",
        "weak_ptr",
        "wstring",
        "wstring_view"
      ];
      const FUNCTION_HINTS = [
        "abort",
        "abs",
        "acos",
        "apply",
        "as_const",
        "asin",
        "atan",
        "atan2",
        "calloc",
        "ceil",
        "cerr",
        "cin",
        "clog",
        "cos",
        "cosh",
        "cout",
        "declval",
        "endl",
        "exchange",
        "exit",
        "exp",
        "fabs",
        "floor",
        "fmod",
        "forward",
        "fprintf",
        "fputs",
        "free",
        "frexp",
        "fscanf",
        "future",
        "invoke",
        "isalnum",
        "isalpha",
        "iscntrl",
        "isdigit",
        "isgraph",
        "islower",
        "isprint",
        "ispunct",
        "isspace",
        "isupper",
        "isxdigit",
        "labs",
        "launder",
        "ldexp",
        "log",
        "log10",
        "make_pair",
        "make_shared",
        "make_shared_for_overwrite",
        "make_tuple",
        "make_unique",
        "malloc",
        "memchr",
        "memcmp",
        "memcpy",
        "memset",
        "modf",
        "move",
        "pow",
        "printf",
        "putchar",
        "puts",
        "realloc",
        "scanf",
        "sin",
        "sinh",
        "snprintf",
        "sprintf",
        "sqrt",
        "sscanf",
        "std",
        "stderr",
        "stdin",
        "stdout",
        "strcat",
        "strchr",
        "strcmp",
        "strcpy",
        "strcspn",
        "strlen",
        "strncat",
        "strncmp",
        "strncpy",
        "strpbrk",
        "strrchr",
        "strspn",
        "strstr",
        "swap",
        "tan",
        "tanh",
        "terminate",
        "to_underlying",
        "tolower",
        "toupper",
        "vfprintf",
        "visit",
        "vprintf",
        "vsprintf"
      ];
      const LITERALS = [
        "NULL",
        "false",
        "nullopt",
        "nullptr",
        "true"
      ];
      const BUILT_IN = ["_Pragma"];
      const CPP_KEYWORDS = {
        type: RESERVED_TYPES,
        keyword: RESERVED_KEYWORDS,
        literal: LITERALS,
        built_in: BUILT_IN,
        _type_hints: TYPE_HINTS
      };
      const FUNCTION_DISPATCH = {
        className: "function.dispatch",
        relevance: 0,
        keywords: {
          // Only for relevance, not highlighting.
          _hint: FUNCTION_HINTS
        },
        begin: regex.concat(
          /\b/,
          /(?!decltype)/,
          /(?!if)/,
          /(?!for)/,
          /(?!switch)/,
          /(?!while)/,
          hljs.IDENT_RE,
          regex.lookahead(/(<[^<>]+>|)\s*\(/)
        )
      };
      const EXPRESSION_CONTAINS = [
        FUNCTION_DISPATCH,
        PREPROCESSOR,
        CPP_PRIMITIVE_TYPES,
        C_LINE_COMMENT_MODE,
        hljs.C_BLOCK_COMMENT_MODE,
        NUMBERS,
        STRINGS
      ];
      const EXPRESSION_CONTEXT = {
        // This mode covers expression context where we can't expect a function
        // definition and shouldn't highlight anything that looks like one:
        // `return some()`, `else if()`, `(x*sum(1, 2))`
        variants: [
          {
            begin: /=/,
            end: /;/
          },
          {
            begin: /\(/,
            end: /\)/
          },
          {
            beginKeywords: "new throw return else",
            end: /;/
          }
        ],
        keywords: CPP_KEYWORDS,
        contains: EXPRESSION_CONTAINS.concat([
          {
            begin: /\(/,
            end: /\)/,
            keywords: CPP_KEYWORDS,
            contains: EXPRESSION_CONTAINS.concat(["self"]),
            relevance: 0
          }
        ]),
        relevance: 0
      };
      const FUNCTION_DECLARATION = {
        className: "function",
        begin: "(" + FUNCTION_TYPE_RE + "[\\*&\\s]+)+" + FUNCTION_TITLE,
        returnBegin: true,
        end: /[{;=]/,
        excludeEnd: true,
        keywords: CPP_KEYWORDS,
        illegal: /[^\w\s\*&:<>.]/,
        contains: [
          {
            // to prevent it from being confused as the function title
            begin: DECLTYPE_AUTO_RE,
            keywords: CPP_KEYWORDS,
            relevance: 0
          },
          {
            begin: FUNCTION_TITLE,
            returnBegin: true,
            contains: [TITLE_MODE],
            relevance: 0
          },
          // needed because we do not have look-behind on the below rule
          // to prevent it from grabbing the final : in a :: pair
          {
            begin: /::/,
            relevance: 0
          },
          // initializers
          {
            begin: /:/,
            endsWithParent: true,
            contains: [
              STRINGS,
              NUMBERS
            ]
          },
          // allow for multiple declarations, e.g.:
          // extern void f(int), g(char);
          {
            relevance: 0,
            match: /,/
          },
          {
            className: "params",
            begin: /\(/,
            end: /\)/,
            keywords: CPP_KEYWORDS,
            relevance: 0,
            contains: [
              C_LINE_COMMENT_MODE,
              hljs.C_BLOCK_COMMENT_MODE,
              STRINGS,
              NUMBERS,
              CPP_PRIMITIVE_TYPES,
              // Count matching parentheses.
              {
                begin: /\(/,
                end: /\)/,
                keywords: CPP_KEYWORDS,
                relevance: 0,
                contains: [
                  "self",
                  C_LINE_COMMENT_MODE,
                  hljs.C_BLOCK_COMMENT_MODE,
                  STRINGS,
                  NUMBERS,
                  CPP_PRIMITIVE_TYPES
                ]
              }
            ]
          },
          CPP_PRIMITIVE_TYPES,
          C_LINE_COMMENT_MODE,
          hljs.C_BLOCK_COMMENT_MODE,
          PREPROCESSOR
        ]
      };
      return {
        name: "C++",
        aliases: [
          "cc",
          "c++",
          "h++",
          "hpp",
          "hh",
          "hxx",
          "cxx"
        ],
        keywords: CPP_KEYWORDS,
        illegal: "</",
        classNameAliases: { "function.dispatch": "built_in" },
        contains: [].concat(
          EXPRESSION_CONTEXT,
          FUNCTION_DECLARATION,
          FUNCTION_DISPATCH,
          EXPRESSION_CONTAINS,
          [
            PREPROCESSOR,
            {
              // containers: ie, `vector <int> rooms (9);`
              begin: "\\b(deque|list|queue|priority_queue|pair|stack|vector|map|set|bitset|multiset|multimap|unordered_map|unordered_set|unordered_multiset|unordered_multimap|array|tuple|optional|variant|function|flat_map|flat_set)\\s*<(?!<)",
              end: ">",
              keywords: CPP_KEYWORDS,
              contains: [
                "self",
                CPP_PRIMITIVE_TYPES
              ]
            },
            {
              begin: hljs.IDENT_RE + "::",
              keywords: CPP_KEYWORDS
            },
            {
              match: [
                // extra complexity to deal with `enum class` and `enum struct`
                /\b(?:enum(?:\s+(?:class|struct))?|class|struct|union)/,
                /\s+/,
                /\w+/
              ],
              className: {
                1: "keyword",
                3: "title.class"
              }
            }
          ]
        )
      };
    }
    module.exports = cpp;
  }
});

// node_modules/highlight.js/lib/languages/csharp.js
var require_csharp = __commonJS({
  "node_modules/highlight.js/lib/languages/csharp.js"(exports, module) {
    "use strict";
    function csharp(hljs) {
      const BUILT_IN_KEYWORDS = [
        "bool",
        "byte",
        "char",
        "decimal",
        "delegate",
        "double",
        "dynamic",
        "enum",
        "float",
        "int",
        "long",
        "nint",
        "nuint",
        "object",
        "sbyte",
        "short",
        "string",
        "ulong",
        "uint",
        "ushort"
      ];
      const FUNCTION_MODIFIERS = [
        "public",
        "private",
        "protected",
        "static",
        "internal",
        "protected",
        "abstract",
        "async",
        "extern",
        "override",
        "unsafe",
        "virtual",
        "new",
        "sealed",
        "partial"
      ];
      const LITERAL_KEYWORDS = [
        "default",
        "false",
        "null",
        "true"
      ];
      const NORMAL_KEYWORDS = [
        "abstract",
        "as",
        "base",
        "break",
        "case",
        "catch",
        "class",
        "const",
        "continue",
        "do",
        "else",
        "event",
        "explicit",
        "extern",
        "finally",
        "fixed",
        "for",
        "foreach",
        "goto",
        "if",
        "implicit",
        "in",
        "interface",
        "internal",
        "is",
        "lock",
        "namespace",
        "new",
        "operator",
        "out",
        "override",
        "params",
        "private",
        "protected",
        "public",
        "readonly",
        "record",
        "ref",
        "return",
        "scoped",
        "sealed",
        "sizeof",
        "stackalloc",
        "static",
        "struct",
        "switch",
        "this",
        "throw",
        "try",
        "typeof",
        "unchecked",
        "unsafe",
        "using",
        "virtual",
        "void",
        "volatile",
        "while"
      ];
      const CONTEXTUAL_KEYWORDS = [
        "add",
        "alias",
        "and",
        "ascending",
        "args",
        "async",
        "await",
        "by",
        "descending",
        "dynamic",
        "equals",
        "file",
        "from",
        "get",
        "global",
        "group",
        "init",
        "into",
        "join",
        "let",
        "nameof",
        "not",
        "notnull",
        "on",
        "or",
        "orderby",
        "partial",
        "record",
        "remove",
        "required",
        "scoped",
        "select",
        "set",
        "unmanaged",
        "value|0",
        "var",
        "when",
        "where",
        "with",
        "yield"
      ];
      const KEYWORDS = {
        keyword: NORMAL_KEYWORDS.concat(CONTEXTUAL_KEYWORDS),
        built_in: BUILT_IN_KEYWORDS,
        literal: LITERAL_KEYWORDS
      };
      const TITLE_MODE = hljs.inherit(hljs.TITLE_MODE, { begin: "[a-zA-Z](\\.?\\w)*" });
      const NUMBERS = {
        className: "number",
        variants: [
          { begin: "\\b(0b[01']+)" },
          { begin: "(-?)\\b([\\d']+(\\.[\\d']*)?|\\.[\\d']+)(u|U|l|L|ul|UL|f|F|b|B)" },
          { begin: "(-?)(\\b0[xX][a-fA-F0-9']+|(\\b[\\d']+(\\.[\\d']*)?|\\.[\\d']+)([eE][-+]?[\\d']+)?)" }
        ],
        relevance: 0
      };
      const RAW_STRING = {
        className: "string",
        begin: /"""("*)(?!")(.|\n)*?"""\1/,
        relevance: 1
      };
      const VERBATIM_STRING = {
        className: "string",
        begin: '@"',
        end: '"',
        contains: [{ begin: '""' }]
      };
      const VERBATIM_STRING_NO_LF = hljs.inherit(VERBATIM_STRING, { illegal: /\n/ });
      const SUBST = {
        className: "subst",
        begin: /\{/,
        end: /\}/,
        keywords: KEYWORDS
      };
      const SUBST_NO_LF = hljs.inherit(SUBST, { illegal: /\n/ });
      const INTERPOLATED_STRING = {
        className: "string",
        begin: /\$"/,
        end: '"',
        illegal: /\n/,
        contains: [
          { begin: /\{\{/ },
          { begin: /\}\}/ },
          hljs.BACKSLASH_ESCAPE,
          SUBST_NO_LF
        ]
      };
      const INTERPOLATED_VERBATIM_STRING = {
        className: "string",
        begin: /\$@"/,
        end: '"',
        contains: [
          { begin: /\{\{/ },
          { begin: /\}\}/ },
          { begin: '""' },
          SUBST
        ]
      };
      const INTERPOLATED_VERBATIM_STRING_NO_LF = hljs.inherit(INTERPOLATED_VERBATIM_STRING, {
        illegal: /\n/,
        contains: [
          { begin: /\{\{/ },
          { begin: /\}\}/ },
          { begin: '""' },
          SUBST_NO_LF
        ]
      });
      SUBST.contains = [
        INTERPOLATED_VERBATIM_STRING,
        INTERPOLATED_STRING,
        VERBATIM_STRING,
        hljs.APOS_STRING_MODE,
        hljs.QUOTE_STRING_MODE,
        NUMBERS,
        hljs.C_BLOCK_COMMENT_MODE
      ];
      SUBST_NO_LF.contains = [
        INTERPOLATED_VERBATIM_STRING_NO_LF,
        INTERPOLATED_STRING,
        VERBATIM_STRING_NO_LF,
        hljs.APOS_STRING_MODE,
        hljs.QUOTE_STRING_MODE,
        NUMBERS,
        hljs.inherit(hljs.C_BLOCK_COMMENT_MODE, { illegal: /\n/ })
      ];
      const STRING = { variants: [
        RAW_STRING,
        INTERPOLATED_VERBATIM_STRING,
        INTERPOLATED_STRING,
        VERBATIM_STRING,
        hljs.APOS_STRING_MODE,
        hljs.QUOTE_STRING_MODE
      ] };
      const GENERIC_MODIFIER = {
        begin: "<",
        end: ">",
        contains: [
          { beginKeywords: "in out" },
          TITLE_MODE
        ]
      };
      const TYPE_IDENT_RE = hljs.IDENT_RE + "(<" + hljs.IDENT_RE + "(\\s*,\\s*" + hljs.IDENT_RE + ")*>)?(\\[\\])?";
      const AT_IDENTIFIER = {
        // prevents expressions like `@class` from incorrect flagging
        // `class` as a keyword
        begin: "@" + hljs.IDENT_RE,
        relevance: 0
      };
      return {
        name: "C#",
        aliases: [
          "cs",
          "c#"
        ],
        keywords: KEYWORDS,
        illegal: /::/,
        contains: [
          hljs.COMMENT(
            "///",
            "$",
            {
              returnBegin: true,
              contains: [
                {
                  className: "doctag",
                  variants: [
                    {
                      begin: "///",
                      relevance: 0
                    },
                    { begin: "<!--|-->" },
                    {
                      begin: "</?",
                      end: ">"
                    }
                  ]
                }
              ]
            }
          ),
          hljs.C_LINE_COMMENT_MODE,
          hljs.C_BLOCK_COMMENT_MODE,
          {
            className: "meta",
            begin: "#",
            end: "$",
            keywords: { keyword: "if else elif endif define undef warning error line region endregion pragma checksum" }
          },
          STRING,
          NUMBERS,
          {
            beginKeywords: "class interface",
            relevance: 0,
            end: /[{;=]/,
            illegal: /[^\s:,]/,
            contains: [
              { beginKeywords: "where class" },
              TITLE_MODE,
              GENERIC_MODIFIER,
              hljs.C_LINE_COMMENT_MODE,
              hljs.C_BLOCK_COMMENT_MODE
            ]
          },
          {
            beginKeywords: "namespace",
            relevance: 0,
            end: /[{;=]/,
            illegal: /[^\s:]/,
            contains: [
              TITLE_MODE,
              hljs.C_LINE_COMMENT_MODE,
              hljs.C_BLOCK_COMMENT_MODE
            ]
          },
          {
            beginKeywords: "record",
            relevance: 0,
            end: /[{;=]/,
            illegal: /[^\s:]/,
            contains: [
              TITLE_MODE,
              GENERIC_MODIFIER,
              hljs.C_LINE_COMMENT_MODE,
              hljs.C_BLOCK_COMMENT_MODE
            ]
          },
          {
            // [Attributes("")]
            className: "meta",
            begin: "^\\s*\\[(?=[\\w])",
            excludeBegin: true,
            end: "\\]",
            excludeEnd: true,
            contains: [
              {
                className: "string",
                begin: /"/,
                end: /"/
              }
            ]
          },
          {
            // Expression keywords prevent 'keyword Name(...)' from being
            // recognized as a function definition
            beginKeywords: "new return throw await else",
            relevance: 0
          },
          {
            className: "function",
            begin: "(" + TYPE_IDENT_RE + "\\s+)+" + hljs.IDENT_RE + "\\s*(<[^=]+>\\s*)?\\(",
            returnBegin: true,
            end: /\s*[{;=]/,
            excludeEnd: true,
            keywords: KEYWORDS,
            contains: [
              // prevents these from being highlighted `title`
              {
                beginKeywords: FUNCTION_MODIFIERS.join(" "),
                relevance: 0
              },
              {
                begin: hljs.IDENT_RE + "\\s*(<[^=]+>\\s*)?\\(",
                returnBegin: true,
                contains: [
                  hljs.TITLE_MODE,
                  GENERIC_MODIFIER
                ],
                relevance: 0
              },
              { match: /\(\)/ },
              {
                className: "params",
                begin: /\(/,
                end: /\)/,
                excludeBegin: true,
                excludeEnd: true,
                keywords: KEYWORDS,
                relevance: 0,
                contains: [
                  STRING,
                  NUMBERS,
                  hljs.C_BLOCK_COMMENT_MODE
                ]
              },
              hljs.C_LINE_COMMENT_MODE,
              hljs.C_BLOCK_COMMENT_MODE
            ]
          },
          AT_IDENTIFIER
        ]
      };
    }
    module.exports = csharp;
  }
});

// node_modules/highlight.js/lib/languages/css.js
var require_css = __commonJS({
  "node_modules/highlight.js/lib/languages/css.js"(exports, module) {
    "use strict";
    var MODES = (hljs) => {
      return {
        IMPORTANT: {
          scope: "meta",
          begin: "!important"
        },
        BLOCK_COMMENT: hljs.C_BLOCK_COMMENT_MODE,
        HEXCOLOR: {
          scope: "number",
          begin: /#(([0-9a-fA-F]{3,4})|(([0-9a-fA-F]{2}){3,4}))\b/
        },
        FUNCTION_DISPATCH: {
          className: "built_in",
          begin: /[\w-]+(?=\()/
        },
        ATTRIBUTE_SELECTOR_MODE: {
          scope: "selector-attr",
          begin: /\[/,
          end: /\]/,
          illegal: "$",
          contains: [
            hljs.APOS_STRING_MODE,
            hljs.QUOTE_STRING_MODE
          ]
        },
        CSS_NUMBER_MODE: {
          scope: "number",
          begin: hljs.NUMBER_RE + "(%|em|ex|ch|rem|vw|vh|vmin|vmax|cm|mm|in|pt|pc|px|deg|grad|rad|turn|s|ms|Hz|kHz|dpi|dpcm|dppx)?",
          relevance: 0
        },
        CSS_VARIABLE: {
          className: "attr",
          begin: /--[A-Za-z_][A-Za-z0-9_-]*/
        }
      };
    };
    var HTML_TAGS = [
      "a",
      "abbr",
      "address",
      "article",
      "aside",
      "audio",
      "b",
      "blockquote",
      "body",
      "button",
      "canvas",
      "caption",
      "cite",
      "code",
      "dd",
      "del",
      "details",
      "dfn",
      "div",
      "dl",
      "dt",
      "em",
      "fieldset",
      "figcaption",
      "figure",
      "footer",
      "form",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "header",
      "hgroup",
      "html",
      "i",
      "iframe",
      "img",
      "input",
      "ins",
      "kbd",
      "label",
      "legend",
      "li",
      "main",
      "mark",
      "menu",
      "nav",
      "object",
      "ol",
      "optgroup",
      "option",
      "p",
      "picture",
      "q",
      "quote",
      "samp",
      "section",
      "select",
      "source",
      "span",
      "strong",
      "summary",
      "sup",
      "table",
      "tbody",
      "td",
      "textarea",
      "tfoot",
      "th",
      "thead",
      "time",
      "tr",
      "ul",
      "var",
      "video"
    ];
    var SVG_TAGS = [
      "defs",
      "g",
      "marker",
      "mask",
      "pattern",
      "svg",
      "switch",
      "symbol",
      "feBlend",
      "feColorMatrix",
      "feComponentTransfer",
      "feComposite",
      "feConvolveMatrix",
      "feDiffuseLighting",
      "feDisplacementMap",
      "feFlood",
      "feGaussianBlur",
      "feImage",
      "feMerge",
      "feMorphology",
      "feOffset",
      "feSpecularLighting",
      "feTile",
      "feTurbulence",
      "linearGradient",
      "radialGradient",
      "stop",
      "circle",
      "ellipse",
      "image",
      "line",
      "path",
      "polygon",
      "polyline",
      "rect",
      "text",
      "use",
      "textPath",
      "tspan",
      "foreignObject",
      "clipPath"
    ];
    var TAGS = [
      ...HTML_TAGS,
      ...SVG_TAGS
    ];
    var MEDIA_FEATURES = [
      "any-hover",
      "any-pointer",
      "aspect-ratio",
      "color",
      "color-gamut",
      "color-index",
      "device-aspect-ratio",
      "device-height",
      "device-width",
      "display-mode",
      "forced-colors",
      "grid",
      "height",
      "hover",
      "inverted-colors",
      "monochrome",
      "orientation",
      "overflow-block",
      "overflow-inline",
      "pointer",
      "prefers-color-scheme",
      "prefers-contrast",
      "prefers-reduced-motion",
      "prefers-reduced-transparency",
      "resolution",
      "scan",
      "scripting",
      "update",
      "width",
      // TODO: find a better solution?
      "min-width",
      "max-width",
      "min-height",
      "max-height"
    ].sort().reverse();
    var PSEUDO_CLASSES = [
      "active",
      "any-link",
      "blank",
      "checked",
      "current",
      "default",
      "defined",
      "dir",
      // dir()
      "disabled",
      "drop",
      "empty",
      "enabled",
      "first",
      "first-child",
      "first-of-type",
      "fullscreen",
      "future",
      "focus",
      "focus-visible",
      "focus-within",
      "has",
      // has()
      "host",
      // host or host()
      "host-context",
      // host-context()
      "hover",
      "indeterminate",
      "in-range",
      "invalid",
      "is",
      // is()
      "lang",
      // lang()
      "last-child",
      "last-of-type",
      "left",
      "link",
      "local-link",
      "not",
      // not()
      "nth-child",
      // nth-child()
      "nth-col",
      // nth-col()
      "nth-last-child",
      // nth-last-child()
      "nth-last-col",
      // nth-last-col()
      "nth-last-of-type",
      //nth-last-of-type()
      "nth-of-type",
      //nth-of-type()
      "only-child",
      "only-of-type",
      "optional",
      "out-of-range",
      "past",
      "placeholder-shown",
      "read-only",
      "read-write",
      "required",
      "right",
      "root",
      "scope",
      "target",
      "target-within",
      "user-invalid",
      "valid",
      "visited",
      "where"
      // where()
    ].sort().reverse();
    var PSEUDO_ELEMENTS = [
      "after",
      "backdrop",
      "before",
      "cue",
      "cue-region",
      "first-letter",
      "first-line",
      "grammar-error",
      "marker",
      "part",
      "placeholder",
      "selection",
      "slotted",
      "spelling-error"
    ].sort().reverse();
    var ATTRIBUTES = [
      "accent-color",
      "align-content",
      "align-items",
      "align-self",
      "alignment-baseline",
      "all",
      "anchor-name",
      "animation",
      "animation-composition",
      "animation-delay",
      "animation-direction",
      "animation-duration",
      "animation-fill-mode",
      "animation-iteration-count",
      "animation-name",
      "animation-play-state",
      "animation-range",
      "animation-range-end",
      "animation-range-start",
      "animation-timeline",
      "animation-timing-function",
      "appearance",
      "aspect-ratio",
      "backdrop-filter",
      "backface-visibility",
      "background",
      "background-attachment",
      "background-blend-mode",
      "background-clip",
      "background-color",
      "background-image",
      "background-origin",
      "background-position",
      "background-position-x",
      "background-position-y",
      "background-repeat",
      "background-size",
      "baseline-shift",
      "block-size",
      "border",
      "border-block",
      "border-block-color",
      "border-block-end",
      "border-block-end-color",
      "border-block-end-style",
      "border-block-end-width",
      "border-block-start",
      "border-block-start-color",
      "border-block-start-style",
      "border-block-start-width",
      "border-block-style",
      "border-block-width",
      "border-bottom",
      "border-bottom-color",
      "border-bottom-left-radius",
      "border-bottom-right-radius",
      "border-bottom-style",
      "border-bottom-width",
      "border-collapse",
      "border-color",
      "border-end-end-radius",
      "border-end-start-radius",
      "border-image",
      "border-image-outset",
      "border-image-repeat",
      "border-image-slice",
      "border-image-source",
      "border-image-width",
      "border-inline",
      "border-inline-color",
      "border-inline-end",
      "border-inline-end-color",
      "border-inline-end-style",
      "border-inline-end-width",
      "border-inline-start",
      "border-inline-start-color",
      "border-inline-start-style",
      "border-inline-start-width",
      "border-inline-style",
      "border-inline-width",
      "border-left",
      "border-left-color",
      "border-left-style",
      "border-left-width",
      "border-radius",
      "border-right",
      "border-right-color",
      "border-right-style",
      "border-right-width",
      "border-spacing",
      "border-start-end-radius",
      "border-start-start-radius",
      "border-style",
      "border-top",
      "border-top-color",
      "border-top-left-radius",
      "border-top-right-radius",
      "border-top-style",
      "border-top-width",
      "border-width",
      "bottom",
      "box-align",
      "box-decoration-break",
      "box-direction",
      "box-flex",
      "box-flex-group",
      "box-lines",
      "box-ordinal-group",
      "box-orient",
      "box-pack",
      "box-shadow",
      "box-sizing",
      "break-after",
      "break-before",
      "break-inside",
      "caption-side",
      "caret-color",
      "clear",
      "clip",
      "clip-path",
      "clip-rule",
      "color",
      "color-interpolation",
      "color-interpolation-filters",
      "color-profile",
      "color-rendering",
      "color-scheme",
      "column-count",
      "column-fill",
      "column-gap",
      "column-rule",
      "column-rule-color",
      "column-rule-style",
      "column-rule-width",
      "column-span",
      "column-width",
      "columns",
      "contain",
      "contain-intrinsic-block-size",
      "contain-intrinsic-height",
      "contain-intrinsic-inline-size",
      "contain-intrinsic-size",
      "contain-intrinsic-width",
      "container",
      "container-name",
      "container-type",
      "content",
      "content-visibility",
      "counter-increment",
      "counter-reset",
      "counter-set",
      "cue",
      "cue-after",
      "cue-before",
      "cursor",
      "cx",
      "cy",
      "direction",
      "display",
      "dominant-baseline",
      "empty-cells",
      "enable-background",
      "field-sizing",
      "fill",
      "fill-opacity",
      "fill-rule",
      "filter",
      "flex",
      "flex-basis",
      "flex-direction",
      "flex-flow",
      "flex-grow",
      "flex-shrink",
      "flex-wrap",
      "float",
      "flood-color",
      "flood-opacity",
      "flow",
      "font",
      "font-display",
      "font-family",
      "font-feature-settings",
      "font-kerning",
      "font-language-override",
      "font-optical-sizing",
      "font-palette",
      "font-size",
      "font-size-adjust",
      "font-smooth",
      "font-smoothing",
      "font-stretch",
      "font-style",
      "font-synthesis",
      "font-synthesis-position",
      "font-synthesis-small-caps",
      "font-synthesis-style",
      "font-synthesis-weight",
      "font-variant",
      "font-variant-alternates",
      "font-variant-caps",
      "font-variant-east-asian",
      "font-variant-emoji",
      "font-variant-ligatures",
      "font-variant-numeric",
      "font-variant-position",
      "font-variation-settings",
      "font-weight",
      "forced-color-adjust",
      "gap",
      "glyph-orientation-horizontal",
      "glyph-orientation-vertical",
      "grid",
      "grid-area",
      "grid-auto-columns",
      "grid-auto-flow",
      "grid-auto-rows",
      "grid-column",
      "grid-column-end",
      "grid-column-start",
      "grid-gap",
      "grid-row",
      "grid-row-end",
      "grid-row-start",
      "grid-template",
      "grid-template-areas",
      "grid-template-columns",
      "grid-template-rows",
      "hanging-punctuation",
      "height",
      "hyphenate-character",
      "hyphenate-limit-chars",
      "hyphens",
      "icon",
      "image-orientation",
      "image-rendering",
      "image-resolution",
      "ime-mode",
      "initial-letter",
      "initial-letter-align",
      "inline-size",
      "inset",
      "inset-area",
      "inset-block",
      "inset-block-end",
      "inset-block-start",
      "inset-inline",
      "inset-inline-end",
      "inset-inline-start",
      "isolation",
      "justify-content",
      "justify-items",
      "justify-self",
      "kerning",
      "left",
      "letter-spacing",
      "lighting-color",
      "line-break",
      "line-height",
      "line-height-step",
      "list-style",
      "list-style-image",
      "list-style-position",
      "list-style-type",
      "margin",
      "margin-block",
      "margin-block-end",
      "margin-block-start",
      "margin-bottom",
      "margin-inline",
      "margin-inline-end",
      "margin-inline-start",
      "margin-left",
      "margin-right",
      "margin-top",
      "margin-trim",
      "marker",
      "marker-end",
      "marker-mid",
      "marker-start",
      "marks",
      "mask",
      "mask-border",
      "mask-border-mode",
      "mask-border-outset",
      "mask-border-repeat",
      "mask-border-slice",
      "mask-border-source",
      "mask-border-width",
      "mask-clip",
      "mask-composite",
      "mask-image",
      "mask-mode",
      "mask-origin",
      "mask-position",
      "mask-repeat",
      "mask-size",
      "mask-type",
      "masonry-auto-flow",
      "math-depth",
      "math-shift",
      "math-style",
      "max-block-size",
      "max-height",
      "max-inline-size",
      "max-width",
      "min-block-size",
      "min-height",
      "min-inline-size",
      "min-width",
      "mix-blend-mode",
      "nav-down",
      "nav-index",
      "nav-left",
      "nav-right",
      "nav-up",
      "none",
      "normal",
      "object-fit",
      "object-position",
      "offset",
      "offset-anchor",
      "offset-distance",
      "offset-path",
      "offset-position",
      "offset-rotate",
      "opacity",
      "order",
      "orphans",
      "outline",
      "outline-color",
      "outline-offset",
      "outline-style",
      "outline-width",
      "overflow",
      "overflow-anchor",
      "overflow-block",
      "overflow-clip-margin",
      "overflow-inline",
      "overflow-wrap",
      "overflow-x",
      "overflow-y",
      "overlay",
      "overscroll-behavior",
      "overscroll-behavior-block",
      "overscroll-behavior-inline",
      "overscroll-behavior-x",
      "overscroll-behavior-y",
      "padding",
      "padding-block",
      "padding-block-end",
      "padding-block-start",
      "padding-bottom",
      "padding-inline",
      "padding-inline-end",
      "padding-inline-start",
      "padding-left",
      "padding-right",
      "padding-top",
      "page",
      "page-break-after",
      "page-break-before",
      "page-break-inside",
      "paint-order",
      "pause",
      "pause-after",
      "pause-before",
      "perspective",
      "perspective-origin",
      "place-content",
      "place-items",
      "place-self",
      "pointer-events",
      "position",
      "position-anchor",
      "position-visibility",
      "print-color-adjust",
      "quotes",
      "r",
      "resize",
      "rest",
      "rest-after",
      "rest-before",
      "right",
      "rotate",
      "row-gap",
      "ruby-align",
      "ruby-position",
      "scale",
      "scroll-behavior",
      "scroll-margin",
      "scroll-margin-block",
      "scroll-margin-block-end",
      "scroll-margin-block-start",
      "scroll-margin-bottom",
      "scroll-margin-inline",
      "scroll-margin-inline-end",
      "scroll-margin-inline-start",
      "scroll-margin-left",
      "scroll-margin-right",
      "scroll-margin-top",
      "scroll-padding",
      "scroll-padding-block",
      "scroll-padding-block-end",
      "scroll-padding-block-start",
      "scroll-padding-bottom",
      "scroll-padding-inline",
      "scroll-padding-inline-end",
      "scroll-padding-inline-start",
      "scroll-padding-left",
      "scroll-padding-right",
      "scroll-padding-top",
      "scroll-snap-align",
      "scroll-snap-stop",
      "scroll-snap-type",
      "scroll-timeline",
      "scroll-timeline-axis",
      "scroll-timeline-name",
      "scrollbar-color",
      "scrollbar-gutter",
      "scrollbar-width",
      "shape-image-threshold",
      "shape-margin",
      "shape-outside",
      "shape-rendering",
      "speak",
      "speak-as",
      "src",
      // @font-face
      "stop-color",
      "stop-opacity",
      "stroke",
      "stroke-dasharray",
      "stroke-dashoffset",
      "stroke-linecap",
      "stroke-linejoin",
      "stroke-miterlimit",
      "stroke-opacity",
      "stroke-width",
      "tab-size",
      "table-layout",
      "text-align",
      "text-align-all",
      "text-align-last",
      "text-anchor",
      "text-combine-upright",
      "text-decoration",
      "text-decoration-color",
      "text-decoration-line",
      "text-decoration-skip",
      "text-decoration-skip-ink",
      "text-decoration-style",
      "text-decoration-thickness",
      "text-emphasis",
      "text-emphasis-color",
      "text-emphasis-position",
      "text-emphasis-style",
      "text-indent",
      "text-justify",
      "text-orientation",
      "text-overflow",
      "text-rendering",
      "text-shadow",
      "text-size-adjust",
      "text-transform",
      "text-underline-offset",
      "text-underline-position",
      "text-wrap",
      "text-wrap-mode",
      "text-wrap-style",
      "timeline-scope",
      "top",
      "touch-action",
      "transform",
      "transform-box",
      "transform-origin",
      "transform-style",
      "transition",
      "transition-behavior",
      "transition-delay",
      "transition-duration",
      "transition-property",
      "transition-timing-function",
      "translate",
      "unicode-bidi",
      "user-modify",
      "user-select",
      "vector-effect",
      "vertical-align",
      "view-timeline",
      "view-timeline-axis",
      "view-timeline-inset",
      "view-timeline-name",
      "view-transition-name",
      "visibility",
      "voice-balance",
      "voice-duration",
      "voice-family",
      "voice-pitch",
      "voice-range",
      "voice-rate",
      "voice-stress",
      "voice-volume",
      "white-space",
      "white-space-collapse",
      "widows",
      "width",
      "will-change",
      "word-break",
      "word-spacing",
      "word-wrap",
      "writing-mode",
      "x",
      "y",
      "z-index",
      "zoom"
    ].sort().reverse();
    function css(hljs) {
      const regex = hljs.regex;
      const modes = MODES(hljs);
      const VENDOR_PREFIX = { begin: /-(webkit|moz|ms|o)-(?=[a-z])/ };
      const AT_MODIFIERS = "and or not only";
      const AT_PROPERTY_RE = /@-?\w[\w]*(-\w+)*/;
      const IDENT_RE = "[a-zA-Z-][a-zA-Z0-9_-]*";
      const STRINGS = [
        hljs.APOS_STRING_MODE,
        hljs.QUOTE_STRING_MODE
      ];
      return {
        name: "CSS",
        case_insensitive: true,
        illegal: /[=|'\$]/,
        keywords: { keyframePosition: "from to" },
        classNameAliases: {
          // for visual continuity with `tag {}` and because we
          // don't have a great class for this?
          keyframePosition: "selector-tag"
        },
        contains: [
          modes.BLOCK_COMMENT,
          VENDOR_PREFIX,
          // to recognize keyframe 40% etc which are outside the scope of our
          // attribute value mode
          modes.CSS_NUMBER_MODE,
          {
            className: "selector-id",
            begin: /#[A-Za-z0-9_-]+/,
            relevance: 0
          },
          {
            className: "selector-class",
            begin: "\\." + IDENT_RE,
            relevance: 0
          },
          modes.ATTRIBUTE_SELECTOR_MODE,
          {
            className: "selector-pseudo",
            variants: [
              { begin: ":(" + PSEUDO_CLASSES.join("|") + ")" },
              { begin: ":(:)?(" + PSEUDO_ELEMENTS.join("|") + ")" }
            ]
          },
          // we may actually need this (12/2020)
          // { // pseudo-selector params
          //   begin: /\(/,
          //   end: /\)/,
          //   contains: [ hljs.CSS_NUMBER_MODE ]
          // },
          modes.CSS_VARIABLE,
          {
            className: "attribute",
            begin: "\\b(" + ATTRIBUTES.join("|") + ")\\b"
          },
          // attribute values
          {
            begin: /:/,
            end: /[;}{]/,
            contains: [
              modes.BLOCK_COMMENT,
              modes.HEXCOLOR,
              modes.IMPORTANT,
              modes.CSS_NUMBER_MODE,
              ...STRINGS,
              // needed to highlight these as strings and to avoid issues with
              // illegal characters that might be inside urls that would tigger the
              // languages illegal stack
              {
                begin: /(url|data-uri)\(/,
                end: /\)/,
                relevance: 0,
                // from keywords
                keywords: { built_in: "url data-uri" },
                contains: [
                  ...STRINGS,
                  {
                    className: "string",
                    // any character other than `)` as in `url()` will be the start
                    // of a string, which ends with `)` (from the parent mode)
                    begin: /[^)]/,
                    endsWithParent: true,
                    excludeEnd: true
                  }
                ]
              },
              modes.FUNCTION_DISPATCH
            ]
          },
          {
            begin: regex.lookahead(/@/),
            end: "[{;]",
            relevance: 0,
            illegal: /:/,
            // break on Less variables @var: ...
            contains: [
              {
                className: "keyword",
                begin: AT_PROPERTY_RE
              },
              {
                begin: /\s/,
                endsWithParent: true,
                excludeEnd: true,
                relevance: 0,
                keywords: {
                  $pattern: /[a-z-]+/,
                  keyword: AT_MODIFIERS,
                  attribute: MEDIA_FEATURES.join(" ")
                },
                contains: [
                  {
                    begin: /[a-z-]+(?=:)/,
                    className: "attribute"
                  },
                  ...STRINGS,
                  modes.CSS_NUMBER_MODE
                ]
              }
            ]
          },
          {
            className: "selector-tag",
            begin: "\\b(" + TAGS.join("|") + ")\\b"
          }
        ]
      };
    }
    module.exports = css;
  }
});

// node_modules/highlight.js/lib/languages/markdown.js
var require_markdown = __commonJS({
  "node_modules/highlight.js/lib/languages/markdown.js"(exports, module) {
    "use strict";
    function markdown(hljs) {
      const regex = hljs.regex;
      const INLINE_HTML = {
        begin: /<\/?[A-Za-z_]/,
        end: ">",
        subLanguage: "xml",
        relevance: 0
      };
      const HORIZONTAL_RULE = {
        begin: "^[-\\*]{3,}",
        end: "$"
      };
      const CODE = {
        className: "code",
        variants: [
          // TODO: fix to allow these to work with sublanguage also
          { begin: "(`{3,})[^`](.|\\n)*?\\1`*[ ]*" },
          { begin: "(~{3,})[^~](.|\\n)*?\\1~*[ ]*" },
          // needed to allow markdown as a sublanguage to work
          {
            begin: "```",
            end: "```+[ ]*$"
          },
          {
            begin: "~~~",
            end: "~~~+[ ]*$"
          },
          { begin: "`.+?`" },
          {
            begin: "(?=^( {4}|\\t))",
            // use contains to gobble up multiple lines to allow the block to be whatever size
            // but only have a single open/close tag vs one per line
            contains: [
              {
                begin: "^( {4}|\\t)",
                end: "(\\n)$"
              }
            ],
            relevance: 0
          }
        ]
      };
      const LIST = {
        className: "bullet",
        begin: "^[ 	]*([*+-]|(\\d+\\.))(?=\\s+)",
        end: "\\s+",
        excludeEnd: true
      };
      const LINK_REFERENCE = {
        begin: /^\[[^\n]+\]:/,
        returnBegin: true,
        contains: [
          {
            className: "symbol",
            begin: /\[/,
            end: /\]/,
            excludeBegin: true,
            excludeEnd: true
          },
          {
            className: "link",
            begin: /:\s*/,
            end: /$/,
            excludeBegin: true
          }
        ]
      };
      const URL_SCHEME = /[A-Za-z][A-Za-z0-9+.-]*/;
      const LINK = {
        variants: [
          // too much like nested array access in so many languages
          // to have any real relevance
          {
            begin: /\[.+?\]\[.*?\]/,
            relevance: 0
          },
          // popular internet URLs
          {
            begin: /\[.+?\]\(((data|javascript|mailto):|(?:http|ftp)s?:\/\/).*?\)/,
            relevance: 2
          },
          {
            begin: regex.concat(/\[.+?\]\(/, URL_SCHEME, /:\/\/.*?\)/),
            relevance: 2
          },
          // relative urls
          {
            begin: /\[.+?\]\([./?&#].*?\)/,
            relevance: 1
          },
          // whatever else, lower relevance (might not be a link at all)
          {
            begin: /\[.*?\]\(.*?\)/,
            relevance: 0
          }
        ],
        returnBegin: true,
        contains: [
          {
            // empty strings for alt or link text
            match: /\[(?=\])/
          },
          {
            className: "string",
            relevance: 0,
            begin: "\\[",
            end: "\\]",
            excludeBegin: true,
            returnEnd: true
          },
          {
            className: "link",
            relevance: 0,
            begin: "\\]\\(",
            end: "\\)",
            excludeBegin: true,
            excludeEnd: true
          },
          {
            className: "symbol",
            relevance: 0,
            begin: "\\]\\[",
            end: "\\]",
            excludeBegin: true,
            excludeEnd: true
          }
        ]
      };
      const BOLD = {
        className: "strong",
        contains: [],
        // defined later
        variants: [
          {
            begin: /_{2}(?!\s)/,
            end: /_{2}/
          },
          {
            begin: /\*{2}(?!\s)/,
            end: /\*{2}/
          }
        ]
      };
      const ITALIC = {
        className: "emphasis",
        contains: [],
        // defined later
        variants: [
          {
            begin: /\*(?![*\s])/,
            end: /\*/
          },
          {
            begin: /_(?![_\s])/,
            end: /_/,
            relevance: 0
          }
        ]
      };
      const BOLD_WITHOUT_ITALIC = hljs.inherit(BOLD, { contains: [] });
      const ITALIC_WITHOUT_BOLD = hljs.inherit(ITALIC, { contains: [] });
      BOLD.contains.push(ITALIC_WITHOUT_BOLD);
      ITALIC.contains.push(BOLD_WITHOUT_ITALIC);
      let CONTAINABLE = [
        INLINE_HTML,
        LINK
      ];
      [
        BOLD,
        ITALIC,
        BOLD_WITHOUT_ITALIC,
        ITALIC_WITHOUT_BOLD
      ].forEach((m3) => {
        m3.contains = m3.contains.concat(CONTAINABLE);
      });
      CONTAINABLE = CONTAINABLE.concat(BOLD, ITALIC);
      const HEADER = {
        className: "section",
        variants: [
          {
            begin: "^#{1,6}",
            end: "$",
            contains: CONTAINABLE
          },
          {
            begin: "(?=^.+?\\n[=-]{2,}$)",
            contains: [
              { begin: "^[=-]*$" },
              {
                begin: "^",
                end: "\\n",
                contains: CONTAINABLE
              }
            ]
          }
        ]
      };
      const BLOCKQUOTE = {
        className: "quote",
        begin: "^>\\s+",
        contains: CONTAINABLE,
        end: "$"
      };
      const ENTITY = {
        //https://spec.commonmark.org/0.31.2/#entity-references
        scope: "literal",
        match: /&([a-zA-Z0-9]+|#[0-9]{1,7}|#[Xx][0-9a-fA-F]{1,6});/
      };
      return {
        name: "Markdown",
        aliases: [
          "md",
          "mkdown",
          "mkd"
        ],
        contains: [
          HEADER,
          INLINE_HTML,
          LIST,
          BOLD,
          ITALIC,
          BLOCKQUOTE,
          CODE,
          HORIZONTAL_RULE,
          LINK,
          LINK_REFERENCE,
          ENTITY
        ]
      };
    }
    module.exports = markdown;
  }
});

// node_modules/highlight.js/lib/languages/diff.js
var require_diff = __commonJS({
  "node_modules/highlight.js/lib/languages/diff.js"(exports, module) {
    "use strict";
    function diff(hljs) {
      const regex = hljs.regex;
      return {
        name: "Diff",
        aliases: ["patch"],
        contains: [
          {
            className: "meta",
            relevance: 10,
            match: regex.either(
              /^@@ +-\d+,\d+ +\+\d+,\d+ +@@/,
              /^\*\*\* +\d+,\d+ +\*\*\*\*$/,
              /^--- +\d+,\d+ +----$/
            )
          },
          {
            className: "comment",
            variants: [
              {
                begin: regex.either(
                  /Index: /,
                  /^index/,
                  /={3,}/,
                  /^-{3}/,
                  /^\*{3} /,
                  /^\+{3}/,
                  /^diff --git/
                ),
                end: /$/
              },
              { match: /^\*{15}$/ }
            ]
          },
          {
            className: "addition",
            begin: /^\+/,
            end: /$/
          },
          {
            className: "deletion",
            begin: /^-/,
            end: /$/
          },
          {
            className: "addition",
            begin: /^!/,
            end: /$/
          }
        ]
      };
    }
    module.exports = diff;
  }
});

// node_modules/highlight.js/lib/languages/ruby.js
var require_ruby = __commonJS({
  "node_modules/highlight.js/lib/languages/ruby.js"(exports, module) {
    "use strict";
    function ruby(hljs) {
      const regex = hljs.regex;
      const RUBY_METHOD_RE = "([a-zA-Z_]\\w*[!?=]?|[-+~]@|<<|>>|=~|===?|<=>|[<>]=?|\\*\\*|[-/+%^&*~`|]|\\[\\]=?)";
      const CLASS_NAME_RE = regex.either(
        /\b([A-Z]+[a-z0-9]+)+/,
        // ends in caps
        /\b([A-Z]+[a-z0-9]+)+[A-Z]+/
      );
      const CLASS_NAME_WITH_NAMESPACE_RE = regex.concat(CLASS_NAME_RE, /(::\w+)*/);
      const PSEUDO_KWS = [
        "include",
        "extend",
        "prepend",
        "public",
        "private",
        "protected",
        "raise",
        "throw"
      ];
      const RUBY_KEYWORDS = {
        "variable.constant": [
          "__FILE__",
          "__LINE__",
          "__ENCODING__"
        ],
        "variable.language": [
          "self",
          "super"
        ],
        keyword: [
          "alias",
          "and",
          "begin",
          "BEGIN",
          "break",
          "case",
          "class",
          "defined",
          "do",
          "else",
          "elsif",
          "end",
          "END",
          "ensure",
          "for",
          "if",
          "in",
          "module",
          "next",
          "not",
          "or",
          "redo",
          "require",
          "rescue",
          "retry",
          "return",
          "then",
          "undef",
          "unless",
          "until",
          "when",
          "while",
          "yield",
          ...PSEUDO_KWS
        ],
        built_in: [
          "proc",
          "lambda",
          "attr_accessor",
          "attr_reader",
          "attr_writer",
          "define_method",
          "private_constant",
          "module_function"
        ],
        literal: [
          "true",
          "false",
          "nil"
        ]
      };
      const YARDOCTAG = {
        className: "doctag",
        begin: "@[A-Za-z]+"
      };
      const IRB_OBJECT = {
        begin: "#<",
        end: ">"
      };
      const COMMENT_MODES = [
        hljs.COMMENT(
          "#",
          "$",
          { contains: [YARDOCTAG] }
        ),
        hljs.COMMENT(
          "^=begin",
          "^=end",
          {
            contains: [YARDOCTAG],
            relevance: 10
          }
        ),
        hljs.COMMENT("^__END__", hljs.MATCH_NOTHING_RE)
      ];
      const SUBST = {
        className: "subst",
        begin: /#\{/,
        end: /\}/,
        keywords: RUBY_KEYWORDS
      };
      const STRING = {
        className: "string",
        contains: [
          hljs.BACKSLASH_ESCAPE,
          SUBST
        ],
        variants: [
          {
            begin: /'/,
            end: /'/
          },
          {
            begin: /"/,
            end: /"/
          },
          {
            begin: /`/,
            end: /`/
          },
          {
            begin: /%[qQwWx]?\(/,
            end: /\)/
          },
          {
            begin: /%[qQwWx]?\[/,
            end: /\]/
          },
          {
            begin: /%[qQwWx]?\{/,
            end: /\}/
          },
          {
            begin: /%[qQwWx]?</,
            end: />/
          },
          {
            begin: /%[qQwWx]?\//,
            end: /\//
          },
          {
            begin: /%[qQwWx]?%/,
            end: /%/
          },
          {
            begin: /%[qQwWx]?-/,
            end: /-/
          },
          {
            begin: /%[qQwWx]?\|/,
            end: /\|/
          },
          // in the following expressions, \B in the beginning suppresses recognition of ?-sequences
          // where ? is the last character of a preceding identifier, as in: `func?4`
          { begin: /\B\?(\\\d{1,3})/ },
          { begin: /\B\?(\\x[A-Fa-f0-9]{1,2})/ },
          { begin: /\B\?(\\u\{?[A-Fa-f0-9]{1,6}\}?)/ },
          { begin: /\B\?(\\M-\\C-|\\M-\\c|\\c\\M-|\\M-|\\C-\\M-)[\x20-\x7e]/ },
          { begin: /\B\?\\(c|C-)[\x20-\x7e]/ },
          { begin: /\B\?\\?\S/ },
          // heredocs
          {
            // this guard makes sure that we have an entire heredoc and not a false
            // positive (auto-detect, etc.)
            begin: regex.concat(
              /<<[-~]?'?/,
              regex.lookahead(/(\w+)(?=\W)[^\n]*\n(?:[^\n]*\n)*?\s*\1\b/)
            ),
            contains: [
              hljs.END_SAME_AS_BEGIN({
                begin: /(\w+)/,
                end: /(\w+)/,
                contains: [
                  hljs.BACKSLASH_ESCAPE,
                  SUBST
                ]
              })
            ]
          }
        ]
      };
      const decimal = "[1-9](_?[0-9])*|0";
      const digits = "[0-9](_?[0-9])*";
      const NUMBER = {
        className: "number",
        relevance: 0,
        variants: [
          // decimal integer/float, optionally exponential or rational, optionally imaginary
          { begin: `\\b(${decimal})(\\.(${digits}))?([eE][+-]?(${digits})|r)?i?\\b` },
          // explicit decimal/binary/octal/hexadecimal integer,
          // optionally rational and/or imaginary
          { begin: "\\b0[dD][0-9](_?[0-9])*r?i?\\b" },
          { begin: "\\b0[bB][0-1](_?[0-1])*r?i?\\b" },
          { begin: "\\b0[oO][0-7](_?[0-7])*r?i?\\b" },
          { begin: "\\b0[xX][0-9a-fA-F](_?[0-9a-fA-F])*r?i?\\b" },
          // 0-prefixed implicit octal integer, optionally rational and/or imaginary
          { begin: "\\b0(_?[0-7])+r?i?\\b" }
        ]
      };
      const PARAMS = {
        variants: [
          {
            match: /\(\)/
          },
          {
            className: "params",
            begin: /\(/,
            end: /(?=\))/,
            excludeBegin: true,
            endsParent: true,
            keywords: RUBY_KEYWORDS
          }
        ]
      };
      const INCLUDE_EXTEND = {
        match: [
          /(include|extend)\s+/,
          CLASS_NAME_WITH_NAMESPACE_RE
        ],
        scope: {
          2: "title.class"
        },
        keywords: RUBY_KEYWORDS
      };
      const CLASS_DEFINITION = {
        variants: [
          {
            match: [
              /class\s+/,
              CLASS_NAME_WITH_NAMESPACE_RE,
              /\s+<\s+/,
              CLASS_NAME_WITH_NAMESPACE_RE
            ]
          },
          {
            match: [
              /\b(class|module)\s+/,
              CLASS_NAME_WITH_NAMESPACE_RE
            ]
          }
        ],
        scope: {
          2: "title.class",
          4: "title.class.inherited"
        },
        keywords: RUBY_KEYWORDS
      };
      const UPPER_CASE_CONSTANT = {
        relevance: 0,
        match: /\b[A-Z][A-Z_0-9]+\b/,
        className: "variable.constant"
      };
      const METHOD_DEFINITION = {
        match: [
          /def/,
          /\s+/,
          RUBY_METHOD_RE
        ],
        scope: {
          1: "keyword",
          3: "title.function"
        },
        contains: [
          PARAMS
        ]
      };
      const OBJECT_CREATION = {
        relevance: 0,
        match: [
          CLASS_NAME_WITH_NAMESPACE_RE,
          /\.new[. (]/
        ],
        scope: {
          1: "title.class"
        }
      };
      const CLASS_REFERENCE = {
        relevance: 0,
        match: CLASS_NAME_RE,
        scope: "title.class"
      };
      const RUBY_DEFAULT_CONTAINS = [
        STRING,
        CLASS_DEFINITION,
        INCLUDE_EXTEND,
        OBJECT_CREATION,
        UPPER_CASE_CONSTANT,
        CLASS_REFERENCE,
        METHOD_DEFINITION,
        {
          // swallow namespace qualifiers before symbols
          begin: hljs.IDENT_RE + "::"
        },
        {
          className: "symbol",
          begin: hljs.UNDERSCORE_IDENT_RE + "(!|\\?)?:",
          relevance: 0
        },
        {
          className: "symbol",
          begin: ":(?!\\s)",
          contains: [
            STRING,
            { begin: RUBY_METHOD_RE }
          ],
          relevance: 0
        },
        NUMBER,
        {
          // negative-look forward attempts to prevent false matches like:
          // @ident@ or $ident$ that might indicate this is not ruby at all
          className: "variable",
          begin: `(\\$\\W)|((\\$|@@?)(\\w+))(?=[^@$?])(?![A-Za-z])(?![@$?'])`
        },
        {
          className: "params",
          begin: /\|(?!=)/,
          end: /\|/,
          excludeBegin: true,
          excludeEnd: true,
          relevance: 0,
          // this could be a lot of things (in other languages) other than params
          keywords: RUBY_KEYWORDS
        },
        {
          // regexp container
          begin: "(" + hljs.RE_STARTERS_RE + "|unless)\\s*",
          keywords: "unless",
          contains: [
            {
              className: "regexp",
              contains: [
                hljs.BACKSLASH_ESCAPE,
                SUBST
              ],
              illegal: /\n/,
              variants: [
                {
                  begin: "/",
                  end: "/[a-z]*"
                },
                {
                  begin: /%r\{/,
                  end: /\}[a-z]*/
                },
                {
                  begin: "%r\\(",
                  end: "\\)[a-z]*"
                },
                {
                  begin: "%r!",
                  end: "![a-z]*"
                },
                {
                  begin: "%r\\[",
                  end: "\\][a-z]*"
                }
              ]
            }
          ].concat(IRB_OBJECT, COMMENT_MODES),
          relevance: 0
        }
      ].concat(IRB_OBJECT, COMMENT_MODES);
      SUBST.contains = RUBY_DEFAULT_CONTAINS;
      PARAMS.contains = RUBY_DEFAULT_CONTAINS;
      const SIMPLE_PROMPT = "[>?]>";
      const DEFAULT_PROMPT = "[\\w#]+\\(\\w+\\):\\d+:\\d+[>*]";
      const RVM_PROMPT = "(\\w+-)?\\d+\\.\\d+\\.\\d+(p\\d+)?[^\\d][^>]+>";
      const IRB_DEFAULT = [
        {
          begin: /^\s*=>/,
          starts: {
            end: "$",
            contains: RUBY_DEFAULT_CONTAINS
          }
        },
        {
          className: "meta.prompt",
          begin: "^(" + SIMPLE_PROMPT + "|" + DEFAULT_PROMPT + "|" + RVM_PROMPT + ")(?=[ ])",
          starts: {
            end: "$",
            keywords: RUBY_KEYWORDS,
            contains: RUBY_DEFAULT_CONTAINS
          }
        }
      ];
      COMMENT_MODES.unshift(IRB_OBJECT);
      return {
        name: "Ruby",
        aliases: [
          "rb",
          "gemspec",
          "podspec",
          "thor",
          "irb"
        ],
        keywords: RUBY_KEYWORDS,
        illegal: /\/\*/,
        contains: [hljs.SHEBANG({ binary: "ruby" })].concat(IRB_DEFAULT).concat(COMMENT_MODES).concat(RUBY_DEFAULT_CONTAINS)
      };
    }
    module.exports = ruby;
  }
});

// node_modules/highlight.js/lib/languages/go.js
var require_go = __commonJS({
  "node_modules/highlight.js/lib/languages/go.js"(exports, module) {
    "use strict";
    function go(hljs) {
      const LITERALS = [
        "true",
        "false",
        "iota",
        "nil"
      ];
      const BUILT_INS = [
        "append",
        "cap",
        "close",
        "complex",
        "copy",
        "imag",
        "len",
        "make",
        "new",
        "panic",
        "print",
        "println",
        "real",
        "recover",
        "delete"
      ];
      const TYPES = [
        "bool",
        "byte",
        "complex64",
        "complex128",
        "error",
        "float32",
        "float64",
        "int8",
        "int16",
        "int32",
        "int64",
        "string",
        "uint8",
        "uint16",
        "uint32",
        "uint64",
        "int",
        "uint",
        "uintptr",
        "rune"
      ];
      const KWS = [
        "break",
        "case",
        "chan",
        "const",
        "continue",
        "default",
        "defer",
        "else",
        "fallthrough",
        "for",
        "func",
        "go",
        "goto",
        "if",
        "import",
        "interface",
        "map",
        "package",
        "range",
        "return",
        "select",
        "struct",
        "switch",
        "type",
        "var"
      ];
      const KEYWORDS = {
        keyword: KWS,
        type: TYPES,
        literal: LITERALS,
        built_in: BUILT_INS
      };
      return {
        name: "Go",
        aliases: ["golang"],
        keywords: KEYWORDS,
        illegal: "</",
        contains: [
          hljs.C_LINE_COMMENT_MODE,
          hljs.C_BLOCK_COMMENT_MODE,
          {
            className: "string",
            variants: [
              hljs.QUOTE_STRING_MODE,
              hljs.APOS_STRING_MODE,
              {
                begin: "`",
                end: "`"
              }
            ]
          },
          {
            className: "number",
            variants: [
              {
                match: /-?\b0[xX]\.[a-fA-F0-9](_?[a-fA-F0-9])*[pP][+-]?\d(_?\d)*i?/,
                // hex without a present digit before . (making a digit afterwards required)
                relevance: 0
              },
              {
                match: /-?\b0[xX](_?[a-fA-F0-9])+((\.([a-fA-F0-9](_?[a-fA-F0-9])*)?)?[pP][+-]?\d(_?\d)*)?i?/,
                // hex with a present digit before . (making a digit afterwards optional)
                relevance: 0
              },
              {
                match: /-?\b0[oO](_?[0-7])*i?/,
                // leading 0o octal
                relevance: 0
              },
              {
                match: /-?\.\d(_?\d)*([eE][+-]?\d(_?\d)*)?i?/,
                // decimal without a present digit before . (making a digit afterwards required)
                relevance: 0
              },
              {
                match: /-?\b\d(_?\d)*(\.(\d(_?\d)*)?)?([eE][+-]?\d(_?\d)*)?i?/,
                // decimal with a present digit before . (making a digit afterwards optional)
                relevance: 0
              }
            ]
          },
          {
            begin: /:=/
            // relevance booster
          },
          {
            className: "function",
            beginKeywords: "func",
            end: "\\s*(\\{|$)",
            excludeEnd: true,
            contains: [
              hljs.TITLE_MODE,
              {
                className: "params",
                begin: /\(/,
                end: /\)/,
                endsParent: true,
                keywords: KEYWORDS,
                illegal: /["']/
              }
            ]
          }
        ]
      };
    }
    module.exports = go;
  }
});

// node_modules/highlight.js/lib/languages/graphql.js
var require_graphql = __commonJS({
  "node_modules/highlight.js/lib/languages/graphql.js"(exports, module) {
    "use strict";
    function graphql(hljs) {
      const regex = hljs.regex;
      const GQL_NAME = /[_A-Za-z][_0-9A-Za-z]*/;
      return {
        name: "GraphQL",
        aliases: ["gql"],
        case_insensitive: true,
        disableAutodetect: false,
        keywords: {
          keyword: [
            "query",
            "mutation",
            "subscription",
            "type",
            "input",
            "schema",
            "directive",
            "interface",
            "union",
            "scalar",
            "fragment",
            "enum",
            "on"
          ],
          literal: [
            "true",
            "false",
            "null"
          ]
        },
        contains: [
          hljs.HASH_COMMENT_MODE,
          hljs.QUOTE_STRING_MODE,
          hljs.NUMBER_MODE,
          {
            scope: "punctuation",
            match: /[.]{3}/,
            relevance: 0
          },
          {
            scope: "punctuation",
            begin: /[\!\(\)\:\=\[\]\{\|\}]{1}/,
            relevance: 0
          },
          {
            scope: "variable",
            begin: /\$/,
            end: /\W/,
            excludeEnd: true,
            relevance: 0
          },
          {
            scope: "meta",
            match: /@\w+/,
            excludeEnd: true
          },
          {
            scope: "symbol",
            begin: regex.concat(GQL_NAME, regex.lookahead(/\s*:/)),
            relevance: 0
          }
        ],
        illegal: [
          /[;<']/,
          /BEGIN/
        ]
      };
    }
    module.exports = graphql;
  }
});

// node_modules/highlight.js/lib/languages/ini.js
var require_ini = __commonJS({
  "node_modules/highlight.js/lib/languages/ini.js"(exports, module) {
    "use strict";
    function ini(hljs) {
      const regex = hljs.regex;
      const NUMBERS = {
        className: "number",
        relevance: 0,
        variants: [
          { begin: /([+-]+)?[\d]+_[\d_]+/ },
          { begin: hljs.NUMBER_RE }
        ]
      };
      const COMMENTS = hljs.COMMENT();
      COMMENTS.variants = [
        {
          begin: /;/,
          end: /$/
        },
        {
          begin: /#/,
          end: /$/
        }
      ];
      const VARIABLES = {
        className: "variable",
        variants: [
          { begin: /\$[\w\d"][\w\d_]*/ },
          { begin: /\$\{(.*?)\}/ }
        ]
      };
      const LITERALS = {
        className: "literal",
        begin: /\bon|off|true|false|yes|no\b/
      };
      const STRINGS = {
        className: "string",
        contains: [hljs.BACKSLASH_ESCAPE],
        variants: [
          {
            begin: "'''",
            end: "'''",
            relevance: 10
          },
          {
            begin: '"""',
            end: '"""',
            relevance: 10
          },
          {
            begin: '"',
            end: '"'
          },
          {
            begin: "'",
            end: "'"
          }
        ]
      };
      const ARRAY = {
        begin: /\[/,
        end: /\]/,
        contains: [
          COMMENTS,
          LITERALS,
          VARIABLES,
          STRINGS,
          NUMBERS,
          "self"
        ],
        relevance: 0
      };
      const BARE_KEY = /[A-Za-z0-9_-]+/;
      const QUOTED_KEY_DOUBLE_QUOTE = /"(\\"|[^"])*"/;
      const QUOTED_KEY_SINGLE_QUOTE = /'[^']*'/;
      const ANY_KEY = regex.either(
        BARE_KEY,
        QUOTED_KEY_DOUBLE_QUOTE,
        QUOTED_KEY_SINGLE_QUOTE
      );
      const DOTTED_KEY = regex.concat(
        ANY_KEY,
        "(\\s*\\.\\s*",
        ANY_KEY,
        ")*",
        regex.lookahead(/\s*=\s*[^#\s]/)
      );
      return {
        name: "TOML, also INI",
        aliases: ["toml"],
        case_insensitive: true,
        illegal: /\S/,
        contains: [
          COMMENTS,
          {
            className: "section",
            begin: /\[+/,
            end: /\]+/
          },
          {
            begin: DOTTED_KEY,
            className: "attr",
            starts: {
              end: /$/,
              contains: [
                COMMENTS,
                ARRAY,
                LITERALS,
                VARIABLES,
                STRINGS,
                NUMBERS
              ]
            }
          }
        ]
      };
    }
    module.exports = ini;
  }
});

// node_modules/highlight.js/lib/languages/java.js
var require_java = __commonJS({
  "node_modules/highlight.js/lib/languages/java.js"(exports, module) {
    "use strict";
    var decimalDigits = "[0-9](_*[0-9])*";
    var frac = `\\.(${decimalDigits})`;
    var hexDigits = "[0-9a-fA-F](_*[0-9a-fA-F])*";
    var NUMERIC = {
      className: "number",
      variants: [
        // DecimalFloatingPointLiteral
        // including ExponentPart
        { begin: `(\\b(${decimalDigits})((${frac})|\\.)?|(${frac}))[eE][+-]?(${decimalDigits})[fFdD]?\\b` },
        // excluding ExponentPart
        { begin: `\\b(${decimalDigits})((${frac})[fFdD]?\\b|\\.([fFdD]\\b)?)` },
        { begin: `(${frac})[fFdD]?\\b` },
        { begin: `\\b(${decimalDigits})[fFdD]\\b` },
        // HexadecimalFloatingPointLiteral
        { begin: `\\b0[xX]((${hexDigits})\\.?|(${hexDigits})?\\.(${hexDigits}))[pP][+-]?(${decimalDigits})[fFdD]?\\b` },
        // DecimalIntegerLiteral
        { begin: "\\b(0|[1-9](_*[0-9])*)[lL]?\\b" },
        // HexIntegerLiteral
        { begin: `\\b0[xX](${hexDigits})[lL]?\\b` },
        // OctalIntegerLiteral
        { begin: "\\b0(_*[0-7])*[lL]?\\b" },
        // BinaryIntegerLiteral
        { begin: "\\b0[bB][01](_*[01])*[lL]?\\b" }
      ],
      relevance: 0
    };
    function recurRegex(re, substitution, depth) {
      if (depth === -1) return "";
      return re.replace(substitution, (_4) => {
        return recurRegex(re, substitution, depth - 1);
      });
    }
    function java(hljs) {
      const regex = hljs.regex;
      const JAVA_IDENT_RE = "[\xC0-\u02B8a-zA-Z_$][\xC0-\u02B8a-zA-Z_$0-9]*";
      const GENERIC_IDENT_RE = JAVA_IDENT_RE + recurRegex("(?:<" + JAVA_IDENT_RE + "~~~(?:\\s*,\\s*" + JAVA_IDENT_RE + "~~~)*>)?", /~~~/g, 2);
      const MAIN_KEYWORDS = [
        "synchronized",
        "abstract",
        "private",
        "var",
        "static",
        "if",
        "const ",
        "for",
        "while",
        "strictfp",
        "finally",
        "protected",
        "import",
        "native",
        "final",
        "void",
        "enum",
        "else",
        "break",
        "transient",
        "catch",
        "instanceof",
        "volatile",
        "case",
        "assert",
        "package",
        "default",
        "public",
        "try",
        "switch",
        "continue",
        "throws",
        "protected",
        "public",
        "private",
        "module",
        "requires",
        "exports",
        "do",
        "sealed",
        "yield",
        "permits",
        "goto",
        "when"
      ];
      const BUILT_INS = [
        "super",
        "this"
      ];
      const LITERALS = [
        "false",
        "true",
        "null"
      ];
      const TYPES = [
        "char",
        "boolean",
        "long",
        "float",
        "int",
        "byte",
        "short",
        "double"
      ];
      const KEYWORDS = {
        keyword: MAIN_KEYWORDS,
        literal: LITERALS,
        type: TYPES,
        built_in: BUILT_INS
      };
      const ANNOTATION = {
        className: "meta",
        begin: "@" + JAVA_IDENT_RE,
        contains: [
          {
            begin: /\(/,
            end: /\)/,
            contains: ["self"]
            // allow nested () inside our annotation
          }
        ]
      };
      const PARAMS = {
        className: "params",
        begin: /\(/,
        end: /\)/,
        keywords: KEYWORDS,
        relevance: 0,
        contains: [hljs.C_BLOCK_COMMENT_MODE],
        endsParent: true
      };
      return {
        name: "Java",
        aliases: ["jsp"],
        keywords: KEYWORDS,
        illegal: /<\/|#/,
        contains: [
          hljs.COMMENT(
            "/\\*\\*",
            "\\*/",
            {
              relevance: 0,
              contains: [
                {
                  // eat up @'s in emails to prevent them to be recognized as doctags
                  begin: /\w+@/,
                  relevance: 0
                },
                {
                  className: "doctag",
                  begin: "@[A-Za-z]+"
                }
              ]
            }
          ),
          // relevance boost
          {
            begin: /import java\.[a-z]+\./,
            keywords: "import",
            relevance: 2
          },
          hljs.C_LINE_COMMENT_MODE,
          hljs.C_BLOCK_COMMENT_MODE,
          {
            begin: /"""/,
            end: /"""/,
            className: "string",
            contains: [hljs.BACKSLASH_ESCAPE]
          },
          hljs.APOS_STRING_MODE,
          hljs.QUOTE_STRING_MODE,
          {
            match: [
              /\b(?:class|interface|enum|extends|implements|new)/,
              /\s+/,
              JAVA_IDENT_RE
            ],
            className: {
              1: "keyword",
              3: "title.class"
            }
          },
          {
            // Exceptions for hyphenated keywords
            match: /non-sealed/,
            scope: "keyword"
          },
          {
            begin: [
              regex.concat(/(?!else)/, JAVA_IDENT_RE),
              /\s+/,
              JAVA_IDENT_RE,
              /\s+/,
              /=(?!=)/
            ],
            className: {
              1: "type",
              3: "variable",
              5: "operator"
            }
          },
          {
            begin: [
              /record/,
              /\s+/,
              JAVA_IDENT_RE
            ],
            className: {
              1: "keyword",
              3: "title.class"
            },
            contains: [
              PARAMS,
              hljs.C_LINE_COMMENT_MODE,
              hljs.C_BLOCK_COMMENT_MODE
            ]
          },
          {
            // Expression keywords prevent 'keyword Name(...)' from being
            // recognized as a function definition
            beginKeywords: "new throw return else",
            relevance: 0
          },
          {
            begin: [
              "(?:" + GENERIC_IDENT_RE + "\\s+)",
              hljs.UNDERSCORE_IDENT_RE,
              /\s*(?=\()/
            ],
            className: { 2: "title.function" },
            keywords: KEYWORDS,
            contains: [
              {
                className: "params",
                begin: /\(/,
                end: /\)/,
                keywords: KEYWORDS,
                relevance: 0,
                contains: [
                  ANNOTATION,
                  hljs.APOS_STRING_MODE,
                  hljs.QUOTE_STRING_MODE,
                  NUMERIC,
                  hljs.C_BLOCK_COMMENT_MODE
                ]
              },
              hljs.C_LINE_COMMENT_MODE,
              hljs.C_BLOCK_COMMENT_MODE
            ]
          },
          NUMERIC,
          ANNOTATION
        ]
      };
    }
    module.exports = java;
  }
});

// node_modules/highlight.js/lib/languages/javascript.js
var require_javascript = __commonJS({
  "node_modules/highlight.js/lib/languages/javascript.js"(exports, module) {
    "use strict";
    var IDENT_RE = "[A-Za-z$_][0-9A-Za-z$_]*";
    var KEYWORDS = [
      "as",
      // for exports
      "in",
      "of",
      "if",
      "for",
      "while",
      "finally",
      "var",
      "new",
      "function",
      "do",
      "return",
      "void",
      "else",
      "break",
      "catch",
      "instanceof",
      "with",
      "throw",
      "case",
      "default",
      "try",
      "switch",
      "continue",
      "typeof",
      "delete",
      "let",
      "yield",
      "const",
      "class",
      // JS handles these with a special rule
      // "get",
      // "set",
      "debugger",
      "async",
      "await",
      "static",
      "import",
      "from",
      "export",
      "extends",
      // It's reached stage 3, which is "recommended for implementation":
      "using"
    ];
    var LITERALS = [
      "true",
      "false",
      "null",
      "undefined",
      "NaN",
      "Infinity"
    ];
    var TYPES = [
      // Fundamental objects
      "Object",
      "Function",
      "Boolean",
      "Symbol",
      // numbers and dates
      "Math",
      "Date",
      "Number",
      "BigInt",
      // text
      "String",
      "RegExp",
      // Indexed collections
      "Array",
      "Float32Array",
      "Float64Array",
      "Int8Array",
      "Uint8Array",
      "Uint8ClampedArray",
      "Int16Array",
      "Int32Array",
      "Uint16Array",
      "Uint32Array",
      "BigInt64Array",
      "BigUint64Array",
      // Keyed collections
      "Set",
      "Map",
      "WeakSet",
      "WeakMap",
      // Structured data
      "ArrayBuffer",
      "SharedArrayBuffer",
      "Atomics",
      "DataView",
      "JSON",
      // Control abstraction objects
      "Promise",
      "Generator",
      "GeneratorFunction",
      "AsyncFunction",
      // Reflection
      "Reflect",
      "Proxy",
      // Internationalization
      "Intl",
      // WebAssembly
      "WebAssembly"
    ];
    var ERROR_TYPES = [
      "Error",
      "EvalError",
      "InternalError",
      "RangeError",
      "ReferenceError",
      "SyntaxError",
      "TypeError",
      "URIError"
    ];
    var BUILT_IN_GLOBALS = [
      "setInterval",
      "setTimeout",
      "clearInterval",
      "clearTimeout",
      "require",
      "exports",
      "eval",
      "isFinite",
      "isNaN",
      "parseFloat",
      "parseInt",
      "decodeURI",
      "decodeURIComponent",
      "encodeURI",
      "encodeURIComponent",
      "escape",
      "unescape"
    ];
    var BUILT_IN_VARIABLES = [
      "arguments",
      "this",
      "super",
      "console",
      "window",
      "document",
      "localStorage",
      "sessionStorage",
      "module",
      "global"
      // Node.js
    ];
    var BUILT_INS = [].concat(
      BUILT_IN_GLOBALS,
      TYPES,
      ERROR_TYPES
    );
    function javascript(hljs) {
      const regex = hljs.regex;
      const hasClosingTag = (match, { after }) => {
        const tag2 = "</" + match[0].slice(1);
        const pos = match.input.indexOf(tag2, after);
        return pos !== -1;
      };
      const IDENT_RE$1 = IDENT_RE;
      const FRAGMENT = {
        begin: "<>",
        end: "</>"
      };
      const XML_SELF_CLOSING = /<[A-Za-z0-9\\._:-]+\s*\/>/;
      const XML_TAG = {
        begin: /<[A-Za-z0-9\\._:-]+/,
        end: /\/[A-Za-z0-9\\._:-]+>|\/>/,
        /**
         * @param {RegExpMatchArray} match
         * @param {CallbackResponse} response
         */
        isTrulyOpeningTag: (match, response) => {
          const afterMatchIndex = match[0].length + match.index;
          const nextChar = match.input[afterMatchIndex];
          if (
            // HTML should not include another raw `<` inside a tag
            // nested type?
            // `<Array<Array<number>>`, etc.
            nextChar === "<" || // the , gives away that this is not HTML
            // `<T, A extends keyof T, V>`
            nextChar === ","
          ) {
            response.ignoreMatch();
            return;
          }
          if (nextChar === ">") {
            if (!hasClosingTag(match, { after: afterMatchIndex })) {
              response.ignoreMatch();
            }
          }
          let m3;
          const afterMatch = match.input.substring(afterMatchIndex);
          if (m3 = afterMatch.match(/^\s*=/)) {
            response.ignoreMatch();
            return;
          }
          if (m3 = afterMatch.match(/^\s+extends\s+/)) {
            if (m3.index === 0) {
              response.ignoreMatch();
              return;
            }
          }
        }
      };
      const KEYWORDS$1 = {
        $pattern: IDENT_RE,
        keyword: KEYWORDS,
        literal: LITERALS,
        built_in: BUILT_INS,
        "variable.language": BUILT_IN_VARIABLES
      };
      const decimalDigits = "[0-9](_?[0-9])*";
      const frac = `\\.(${decimalDigits})`;
      const decimalInteger = `0|[1-9](_?[0-9])*|0[0-7]*[89][0-9]*`;
      const NUMBER = {
        className: "number",
        variants: [
          // DecimalLiteral
          { begin: `(\\b(${decimalInteger})((${frac})|\\.)?|(${frac}))[eE][+-]?(${decimalDigits})\\b` },
          { begin: `\\b(${decimalInteger})\\b((${frac})\\b|\\.)?|(${frac})\\b` },
          // DecimalBigIntegerLiteral
          { begin: `\\b(0|[1-9](_?[0-9])*)n\\b` },
          // NonDecimalIntegerLiteral
          { begin: "\\b0[xX][0-9a-fA-F](_?[0-9a-fA-F])*n?\\b" },
          { begin: "\\b0[bB][0-1](_?[0-1])*n?\\b" },
          { begin: "\\b0[oO][0-7](_?[0-7])*n?\\b" },
          // LegacyOctalIntegerLiteral (does not include underscore separators)
          // https://tc39.es/ecma262/#sec-additional-syntax-numeric-literals
          { begin: "\\b0[0-7]+n?\\b" }
        ],
        relevance: 0
      };
      const SUBST = {
        className: "subst",
        begin: "\\$\\{",
        end: "\\}",
        keywords: KEYWORDS$1,
        contains: []
        // defined later
      };
      const HTML_TEMPLATE = {
        begin: ".?html`",
        end: "",
        starts: {
          end: "`",
          returnEnd: false,
          contains: [
            hljs.BACKSLASH_ESCAPE,
            SUBST
          ],
          subLanguage: "xml"
        }
      };
      const CSS_TEMPLATE = {
        begin: ".?css`",
        end: "",
        starts: {
          end: "`",
          returnEnd: false,
          contains: [
            hljs.BACKSLASH_ESCAPE,
            SUBST
          ],
          subLanguage: "css"
        }
      };
      const GRAPHQL_TEMPLATE = {
        begin: ".?gql`",
        end: "",
        starts: {
          end: "`",
          returnEnd: false,
          contains: [
            hljs.BACKSLASH_ESCAPE,
            SUBST
          ],
          subLanguage: "graphql"
        }
      };
      const TEMPLATE_STRING = {
        className: "string",
        begin: "`",
        end: "`",
        contains: [
          hljs.BACKSLASH_ESCAPE,
          SUBST
        ]
      };
      const JSDOC_COMMENT = hljs.COMMENT(
        /\/\*\*(?!\/)/,
        "\\*/",
        {
          relevance: 0,
          contains: [
            {
              begin: "(?=@[A-Za-z]+)",
              relevance: 0,
              contains: [
                {
                  className: "doctag",
                  begin: "@[A-Za-z]+"
                },
                {
                  className: "type",
                  begin: "\\{",
                  end: "\\}",
                  excludeEnd: true,
                  excludeBegin: true,
                  relevance: 0
                },
                {
                  className: "variable",
                  begin: IDENT_RE$1 + "(?=\\s*(-)|$)",
                  endsParent: true,
                  relevance: 0
                },
                // eat spaces (not newlines) so we can find
                // types or variables
                {
                  begin: /(?=[^\n])\s/,
                  relevance: 0
                }
              ]
            }
          ]
        }
      );
      const COMMENT = {
        className: "comment",
        variants: [
          JSDOC_COMMENT,
          hljs.C_BLOCK_COMMENT_MODE,
          hljs.C_LINE_COMMENT_MODE
        ]
      };
      const SUBST_INTERNALS = [
        hljs.APOS_STRING_MODE,
        hljs.QUOTE_STRING_MODE,
        HTML_TEMPLATE,
        CSS_TEMPLATE,
        GRAPHQL_TEMPLATE,
        TEMPLATE_STRING,
        // Skip numbers when they are part of a variable name
        { match: /\$\d+/ },
        NUMBER
        // This is intentional:
        // See https://github.com/highlightjs/highlight.js/issues/3288
        // hljs.REGEXP_MODE
      ];
      SUBST.contains = SUBST_INTERNALS.concat({
        // we need to pair up {} inside our subst to prevent
        // it from ending too early by matching another }
        begin: /\{/,
        end: /\}/,
        keywords: KEYWORDS$1,
        contains: [
          "self"
        ].concat(SUBST_INTERNALS)
      });
      const SUBST_AND_COMMENTS = [].concat(COMMENT, SUBST.contains);
      const PARAMS_CONTAINS = SUBST_AND_COMMENTS.concat([
        // eat recursive parens in sub expressions
        {
          begin: /(\s*)\(/,
          end: /\)/,
          keywords: KEYWORDS$1,
          contains: ["self"].concat(SUBST_AND_COMMENTS)
        }
      ]);
      const PARAMS = {
        className: "params",
        // convert this to negative lookbehind in v12
        begin: /(\s*)\(/,
        // to match the parms with
        end: /\)/,
        excludeBegin: true,
        excludeEnd: true,
        keywords: KEYWORDS$1,
        contains: PARAMS_CONTAINS
      };
      const CLASS_OR_EXTENDS = {
        variants: [
          // class Car extends vehicle
          {
            match: [
              /class/,
              /\s+/,
              IDENT_RE$1,
              /\s+/,
              /extends/,
              /\s+/,
              regex.concat(IDENT_RE$1, "(", regex.concat(/\./, IDENT_RE$1), ")*")
            ],
            scope: {
              1: "keyword",
              3: "title.class",
              5: "keyword",
              7: "title.class.inherited"
            }
          },
          // class Car
          {
            match: [
              /class/,
              /\s+/,
              IDENT_RE$1
            ],
            scope: {
              1: "keyword",
              3: "title.class"
            }
          }
        ]
      };
      const CLASS_REFERENCE = {
        relevance: 0,
        match: regex.either(
          // Hard coded exceptions
          /\bJSON/,
          // Float32Array, OutT
          /\b[A-Z][a-z]+([A-Z][a-z]*|\d)*/,
          // CSSFactory, CSSFactoryT
          /\b[A-Z]{2,}([A-Z][a-z]+|\d)+([A-Z][a-z]*)*/,
          // FPs, FPsT
          /\b[A-Z]{2,}[a-z]+([A-Z][a-z]+|\d)*([A-Z][a-z]*)*/
          // P
          // single letters are not highlighted
          // BLAH
          // this will be flagged as a UPPER_CASE_CONSTANT instead
        ),
        className: "title.class",
        keywords: {
          _: [
            // se we still get relevance credit for JS library classes
            ...TYPES,
            ...ERROR_TYPES
          ]
        }
      };
      const USE_STRICT = {
        label: "use_strict",
        className: "meta",
        relevance: 10,
        begin: /^\s*['"]use (strict|asm)['"]/
      };
      const FUNCTION_DEFINITION = {
        variants: [
          {
            match: [
              /function/,
              /\s+/,
              IDENT_RE$1,
              /(?=\s*\()/
            ]
          },
          // anonymous function
          {
            match: [
              /function/,
              /\s*(?=\()/
            ]
          }
        ],
        className: {
          1: "keyword",
          3: "title.function"
        },
        label: "func.def",
        contains: [PARAMS],
        illegal: /%/
      };
      const UPPER_CASE_CONSTANT = {
        relevance: 0,
        match: /\b[A-Z][A-Z_0-9]+\b/,
        className: "variable.constant"
      };
      function noneOf(list2) {
        return regex.concat("(?!", list2.join("|"), ")");
      }
      const FUNCTION_CALL = {
        match: regex.concat(
          /\b/,
          noneOf([
            ...BUILT_IN_GLOBALS,
            "super",
            "import"
          ].map((x3) => `${x3}\\s*\\(`)),
          IDENT_RE$1,
          regex.lookahead(/\s*\(/)
        ),
        className: "title.function",
        relevance: 0
      };
      const PROPERTY_ACCESS = {
        begin: regex.concat(/\./, regex.lookahead(
          regex.concat(IDENT_RE$1, /(?![0-9A-Za-z$_(])/)
        )),
        end: IDENT_RE$1,
        excludeBegin: true,
        keywords: "prototype",
        className: "property",
        relevance: 0
      };
      const GETTER_OR_SETTER = {
        match: [
          /get|set/,
          /\s+/,
          IDENT_RE$1,
          /(?=\()/
        ],
        className: {
          1: "keyword",
          3: "title.function"
        },
        contains: [
          {
            // eat to avoid empty params
            begin: /\(\)/
          },
          PARAMS
        ]
      };
      const FUNC_LEAD_IN_RE = "(\\([^()]*(\\([^()]*(\\([^()]*\\)[^()]*)*\\)[^()]*)*\\)|" + hljs.UNDERSCORE_IDENT_RE + ")\\s*=>";
      const FUNCTION_VARIABLE = {
        match: [
          /const|var|let/,
          /\s+/,
          IDENT_RE$1,
          /\s*/,
          /=\s*/,
          /(async\s*)?/,
          // async is optional
          regex.lookahead(FUNC_LEAD_IN_RE)
        ],
        keywords: "async",
        className: {
          1: "keyword",
          3: "title.function"
        },
        contains: [
          PARAMS
        ]
      };
      return {
        name: "JavaScript",
        aliases: ["js", "jsx", "mjs", "cjs"],
        keywords: KEYWORDS$1,
        // this will be extended by TypeScript
        exports: { PARAMS_CONTAINS, CLASS_REFERENCE },
        illegal: /#(?![$_A-z])/,
        contains: [
          hljs.SHEBANG({
            label: "shebang",
            binary: "node",
            relevance: 5
          }),
          USE_STRICT,
          hljs.APOS_STRING_MODE,
          hljs.QUOTE_STRING_MODE,
          HTML_TEMPLATE,
          CSS_TEMPLATE,
          GRAPHQL_TEMPLATE,
          TEMPLATE_STRING,
          COMMENT,
          // Skip numbers when they are part of a variable name
          { match: /\$\d+/ },
          NUMBER,
          CLASS_REFERENCE,
          {
            scope: "attr",
            match: IDENT_RE$1 + regex.lookahead(":"),
            relevance: 0
          },
          FUNCTION_VARIABLE,
          {
            // "value" container
            begin: "(" + hljs.RE_STARTERS_RE + "|\\b(case|return|throw)\\b)\\s*",
            keywords: "return throw case",
            relevance: 0,
            contains: [
              COMMENT,
              hljs.REGEXP_MODE,
              {
                className: "function",
                // we have to count the parens to make sure we actually have the
                // correct bounding ( ) before the =>.  There could be any number of
                // sub-expressions inside also surrounded by parens.
                begin: FUNC_LEAD_IN_RE,
                returnBegin: true,
                end: "\\s*=>",
                contains: [
                  {
                    className: "params",
                    variants: [
                      {
                        begin: hljs.UNDERSCORE_IDENT_RE,
                        relevance: 0
                      },
                      {
                        className: null,
                        begin: /\(\s*\)/,
                        skip: true
                      },
                      {
                        begin: /(\s*)\(/,
                        end: /\)/,
                        excludeBegin: true,
                        excludeEnd: true,
                        keywords: KEYWORDS$1,
                        contains: PARAMS_CONTAINS
                      }
                    ]
                  }
                ]
              },
              {
                // could be a comma delimited list of params to a function call
                begin: /,/,
                relevance: 0
              },
              {
                match: /\s+/,
                relevance: 0
              },
              {
                // JSX
                variants: [
                  { begin: FRAGMENT.begin, end: FRAGMENT.end },
                  { match: XML_SELF_CLOSING },
                  {
                    begin: XML_TAG.begin,
                    // we carefully check the opening tag to see if it truly
                    // is a tag and not a false positive
                    "on:begin": XML_TAG.isTrulyOpeningTag,
                    end: XML_TAG.end
                  }
                ],
                subLanguage: "xml",
                contains: [
                  {
                    begin: XML_TAG.begin,
                    end: XML_TAG.end,
                    skip: true,
                    contains: ["self"]
                  }
                ]
              }
            ]
          },
          FUNCTION_DEFINITION,
          {
            // prevent this from getting swallowed up by function
            // since they appear "function like"
            beginKeywords: "while if switch catch for"
          },
          {
            // we have to count the parens to make sure we actually have the correct
            // bounding ( ).  There could be any number of sub-expressions inside
            // also surrounded by parens.
            begin: "\\b(?!function)" + hljs.UNDERSCORE_IDENT_RE + "\\([^()]*(\\([^()]*(\\([^()]*\\)[^()]*)*\\)[^()]*)*\\)\\s*\\{",
            // end parens
            returnBegin: true,
            label: "func.def",
            contains: [
              PARAMS,
              hljs.inherit(hljs.TITLE_MODE, { begin: IDENT_RE$1, className: "title.function" })
            ]
          },
          // catch ... so it won't trigger the property rule below
          {
            match: /\.\.\./,
            relevance: 0
          },
          PROPERTY_ACCESS,
          // hack: prevents detection of keywords in some circumstances
          // .keyword()
          // $keyword = x
          {
            match: "\\$" + IDENT_RE$1,
            relevance: 0
          },
          {
            match: [/\bconstructor(?=\s*\()/],
            className: { 1: "title.function" },
            contains: [PARAMS]
          },
          FUNCTION_CALL,
          UPPER_CASE_CONSTANT,
          CLASS_OR_EXTENDS,
          GETTER_OR_SETTER,
          {
            match: /\$[(.]/
            // relevance booster for a pattern common to JS libs: `$(something)` and `$.something`
          }
        ]
      };
    }
    module.exports = javascript;
  }
});

// node_modules/highlight.js/lib/languages/json.js
var require_json = __commonJS({
  "node_modules/highlight.js/lib/languages/json.js"(exports, module) {
    "use strict";
    function json(hljs) {
      const ATTRIBUTE = {
        className: "attr",
        begin: /"(\\.|[^\\"\r\n])*"(?=\s*:)/,
        relevance: 1.01
      };
      const PUNCTUATION = {
        match: /[{}[\],:]/,
        className: "punctuation",
        relevance: 0
      };
      const LITERALS = [
        "true",
        "false",
        "null"
      ];
      const LITERALS_MODE = {
        scope: "literal",
        beginKeywords: LITERALS.join(" ")
      };
      return {
        name: "JSON",
        aliases: ["jsonc"],
        keywords: {
          literal: LITERALS
        },
        contains: [
          ATTRIBUTE,
          PUNCTUATION,
          hljs.QUOTE_STRING_MODE,
          LITERALS_MODE,
          hljs.C_NUMBER_MODE,
          hljs.C_LINE_COMMENT_MODE,
          hljs.C_BLOCK_COMMENT_MODE
        ],
        illegal: "\\S"
      };
    }
    module.exports = json;
  }
});

// node_modules/highlight.js/lib/languages/kotlin.js
var require_kotlin = __commonJS({
  "node_modules/highlight.js/lib/languages/kotlin.js"(exports, module) {
    "use strict";
    var decimalDigits = "[0-9](_*[0-9])*";
    var frac = `\\.(${decimalDigits})`;
    var hexDigits = "[0-9a-fA-F](_*[0-9a-fA-F])*";
    var NUMERIC = {
      className: "number",
      variants: [
        // DecimalFloatingPointLiteral
        // including ExponentPart
        { begin: `(\\b(${decimalDigits})((${frac})|\\.)?|(${frac}))[eE][+-]?(${decimalDigits})[fFdD]?\\b` },
        // excluding ExponentPart
        { begin: `\\b(${decimalDigits})((${frac})[fFdD]?\\b|\\.([fFdD]\\b)?)` },
        { begin: `(${frac})[fFdD]?\\b` },
        { begin: `\\b(${decimalDigits})[fFdD]\\b` },
        // HexadecimalFloatingPointLiteral
        { begin: `\\b0[xX]((${hexDigits})\\.?|(${hexDigits})?\\.(${hexDigits}))[pP][+-]?(${decimalDigits})[fFdD]?\\b` },
        // DecimalIntegerLiteral
        { begin: "\\b(0|[1-9](_*[0-9])*)[lL]?\\b" },
        // HexIntegerLiteral
        { begin: `\\b0[xX](${hexDigits})[lL]?\\b` },
        // OctalIntegerLiteral
        { begin: "\\b0(_*[0-7])*[lL]?\\b" },
        // BinaryIntegerLiteral
        { begin: "\\b0[bB][01](_*[01])*[lL]?\\b" }
      ],
      relevance: 0
    };
    function kotlin(hljs) {
      const KEYWORDS = {
        keyword: "abstract as val var vararg get set class object open private protected public noinline crossinline dynamic final enum if else do while for when throw try catch finally import package is in fun override companion reified inline lateinit init interface annotation data sealed internal infix operator out by constructor super tailrec where const inner suspend typealias external expect actual",
        built_in: "Byte Short Char Int Long Boolean Float Double Void Unit Nothing",
        literal: "true false null"
      };
      const KEYWORDS_WITH_LABEL = {
        className: "keyword",
        begin: /\b(break|continue|return|this)\b/,
        starts: { contains: [
          {
            className: "symbol",
            begin: /@\w+/
          }
        ] }
      };
      const LABEL = {
        className: "symbol",
        begin: hljs.UNDERSCORE_IDENT_RE + "@"
      };
      const SUBST = {
        className: "subst",
        begin: /\$\{/,
        end: /\}/,
        contains: [hljs.C_NUMBER_MODE]
      };
      const VARIABLE = {
        className: "variable",
        begin: "\\$" + hljs.UNDERSCORE_IDENT_RE
      };
      const STRING = {
        className: "string",
        variants: [
          {
            begin: '"""',
            end: '"""(?=[^"])',
            contains: [
              VARIABLE,
              SUBST
            ]
          },
          // Can't use built-in modes easily, as we want to use STRING in the meta
          // context as 'meta-string' and there's no syntax to remove explicitly set
          // classNames in built-in modes.
          {
            begin: "'",
            end: "'",
            illegal: /\n/,
            contains: [hljs.BACKSLASH_ESCAPE]
          },
          {
            begin: '"',
            end: '"',
            illegal: /\n/,
            contains: [
              hljs.BACKSLASH_ESCAPE,
              VARIABLE,
              SUBST
            ]
          }
        ]
      };
      SUBST.contains.push(STRING);
      const ANNOTATION_USE_SITE = {
        className: "meta",
        begin: "@(?:file|property|field|get|set|receiver|param|setparam|delegate)\\s*:(?:\\s*" + hljs.UNDERSCORE_IDENT_RE + ")?"
      };
      const ANNOTATION = {
        className: "meta",
        begin: "@" + hljs.UNDERSCORE_IDENT_RE,
        contains: [
          {
            begin: /\(/,
            end: /\)/,
            contains: [
              hljs.inherit(STRING, { className: "string" }),
              "self"
            ]
          }
        ]
      };
      const KOTLIN_NUMBER_MODE = NUMERIC;
      const KOTLIN_NESTED_COMMENT = hljs.COMMENT(
        "/\\*",
        "\\*/",
        { contains: [hljs.C_BLOCK_COMMENT_MODE] }
      );
      const KOTLIN_PAREN_TYPE = { variants: [
        {
          className: "type",
          begin: hljs.UNDERSCORE_IDENT_RE
        },
        {
          begin: /\(/,
          end: /\)/,
          contains: []
          // defined later
        }
      ] };
      const KOTLIN_PAREN_TYPE2 = KOTLIN_PAREN_TYPE;
      KOTLIN_PAREN_TYPE2.variants[1].contains = [KOTLIN_PAREN_TYPE];
      KOTLIN_PAREN_TYPE.variants[1].contains = [KOTLIN_PAREN_TYPE2];
      return {
        name: "Kotlin",
        aliases: [
          "kt",
          "kts"
        ],
        keywords: KEYWORDS,
        contains: [
          hljs.COMMENT(
            "/\\*\\*",
            "\\*/",
            {
              relevance: 0,
              contains: [
                {
                  className: "doctag",
                  begin: "@[A-Za-z]+"
                }
              ]
            }
          ),
          hljs.C_LINE_COMMENT_MODE,
          KOTLIN_NESTED_COMMENT,
          KEYWORDS_WITH_LABEL,
          LABEL,
          ANNOTATION_USE_SITE,
          ANNOTATION,
          {
            className: "function",
            beginKeywords: "fun",
            end: "[(]|$",
            returnBegin: true,
            excludeEnd: true,
            keywords: KEYWORDS,
            relevance: 5,
            contains: [
              {
                begin: hljs.UNDERSCORE_IDENT_RE + "\\s*\\(",
                returnBegin: true,
                relevance: 0,
                contains: [hljs.UNDERSCORE_TITLE_MODE]
              },
              {
                className: "type",
                begin: /</,
                end: />/,
                keywords: "reified",
                relevance: 0
              },
              {
                className: "params",
                begin: /\(/,
                end: /\)/,
                endsParent: true,
                keywords: KEYWORDS,
                relevance: 0,
                contains: [
                  {
                    begin: /:/,
                    end: /[=,\/]/,
                    endsWithParent: true,
                    contains: [
                      KOTLIN_PAREN_TYPE,
                      hljs.C_LINE_COMMENT_MODE,
                      KOTLIN_NESTED_COMMENT
                    ],
                    relevance: 0
                  },
                  hljs.C_LINE_COMMENT_MODE,
                  KOTLIN_NESTED_COMMENT,
                  ANNOTATION_USE_SITE,
                  ANNOTATION,
                  STRING,
                  hljs.C_NUMBER_MODE
                ]
              },
              KOTLIN_NESTED_COMMENT
            ]
          },
          {
            begin: [
              /class|interface|trait/,
              /\s+/,
              hljs.UNDERSCORE_IDENT_RE
            ],
            beginScope: {
              3: "title.class"
            },
            keywords: "class interface trait",
            end: /[:\{(]|$/,
            excludeEnd: true,
            illegal: "extends implements",
            contains: [
              { beginKeywords: "public protected internal private constructor" },
              hljs.UNDERSCORE_TITLE_MODE,
              {
                className: "type",
                begin: /</,
                end: />/,
                excludeBegin: true,
                excludeEnd: true,
                relevance: 0
              },
              {
                className: "type",
                begin: /[,:]\s*/,
                end: /[<\(,){\s]|$/,
                excludeBegin: true,
                returnEnd: true
              },
              ANNOTATION_USE_SITE,
              ANNOTATION
            ]
          },
          STRING,
          {
            className: "meta",
            begin: "^#!/usr/bin/env",
            end: "$",
            illegal: "\n"
          },
          KOTLIN_NUMBER_MODE
        ]
      };
    }
    module.exports = kotlin;
  }
});

// node_modules/highlight.js/lib/languages/less.js
var require_less = __commonJS({
  "node_modules/highlight.js/lib/languages/less.js"(exports, module) {
    "use strict";
    var MODES = (hljs) => {
      return {
        IMPORTANT: {
          scope: "meta",
          begin: "!important"
        },
        BLOCK_COMMENT: hljs.C_BLOCK_COMMENT_MODE,
        HEXCOLOR: {
          scope: "number",
          begin: /#(([0-9a-fA-F]{3,4})|(([0-9a-fA-F]{2}){3,4}))\b/
        },
        FUNCTION_DISPATCH: {
          className: "built_in",
          begin: /[\w-]+(?=\()/
        },
        ATTRIBUTE_SELECTOR_MODE: {
          scope: "selector-attr",
          begin: /\[/,
          end: /\]/,
          illegal: "$",
          contains: [
            hljs.APOS_STRING_MODE,
            hljs.QUOTE_STRING_MODE
          ]
        },
        CSS_NUMBER_MODE: {
          scope: "number",
          begin: hljs.NUMBER_RE + "(%|em|ex|ch|rem|vw|vh|vmin|vmax|cm|mm|in|pt|pc|px|deg|grad|rad|turn|s|ms|Hz|kHz|dpi|dpcm|dppx)?",
          relevance: 0
        },
        CSS_VARIABLE: {
          className: "attr",
          begin: /--[A-Za-z_][A-Za-z0-9_-]*/
        }
      };
    };
    var HTML_TAGS = [
      "a",
      "abbr",
      "address",
      "article",
      "aside",
      "audio",
      "b",
      "blockquote",
      "body",
      "button",
      "canvas",
      "caption",
      "cite",
      "code",
      "dd",
      "del",
      "details",
      "dfn",
      "div",
      "dl",
      "dt",
      "em",
      "fieldset",
      "figcaption",
      "figure",
      "footer",
      "form",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "header",
      "hgroup",
      "html",
      "i",
      "iframe",
      "img",
      "input",
      "ins",
      "kbd",
      "label",
      "legend",
      "li",
      "main",
      "mark",
      "menu",
      "nav",
      "object",
      "ol",
      "optgroup",
      "option",
      "p",
      "picture",
      "q",
      "quote",
      "samp",
      "section",
      "select",
      "source",
      "span",
      "strong",
      "summary",
      "sup",
      "table",
      "tbody",
      "td",
      "textarea",
      "tfoot",
      "th",
      "thead",
      "time",
      "tr",
      "ul",
      "var",
      "video"
    ];
    var SVG_TAGS = [
      "defs",
      "g",
      "marker",
      "mask",
      "pattern",
      "svg",
      "switch",
      "symbol",
      "feBlend",
      "feColorMatrix",
      "feComponentTransfer",
      "feComposite",
      "feConvolveMatrix",
      "feDiffuseLighting",
      "feDisplacementMap",
      "feFlood",
      "feGaussianBlur",
      "feImage",
      "feMerge",
      "feMorphology",
      "feOffset",
      "feSpecularLighting",
      "feTile",
      "feTurbulence",
      "linearGradient",
      "radialGradient",
      "stop",
      "circle",
      "ellipse",
      "image",
      "line",
      "path",
      "polygon",
      "polyline",
      "rect",
      "text",
      "use",
      "textPath",
      "tspan",
      "foreignObject",
      "clipPath"
    ];
    var TAGS = [
      ...HTML_TAGS,
      ...SVG_TAGS
    ];
    var MEDIA_FEATURES = [
      "any-hover",
      "any-pointer",
      "aspect-ratio",
      "color",
      "color-gamut",
      "color-index",
      "device-aspect-ratio",
      "device-height",
      "device-width",
      "display-mode",
      "forced-colors",
      "grid",
      "height",
      "hover",
      "inverted-colors",
      "monochrome",
      "orientation",
      "overflow-block",
      "overflow-inline",
      "pointer",
      "prefers-color-scheme",
      "prefers-contrast",
      "prefers-reduced-motion",
      "prefers-reduced-transparency",
      "resolution",
      "scan",
      "scripting",
      "update",
      "width",
      // TODO: find a better solution?
      "min-width",
      "max-width",
      "min-height",
      "max-height"
    ].sort().reverse();
    var PSEUDO_CLASSES = [
      "active",
      "any-link",
      "blank",
      "checked",
      "current",
      "default",
      "defined",
      "dir",
      // dir()
      "disabled",
      "drop",
      "empty",
      "enabled",
      "first",
      "first-child",
      "first-of-type",
      "fullscreen",
      "future",
      "focus",
      "focus-visible",
      "focus-within",
      "has",
      // has()
      "host",
      // host or host()
      "host-context",
      // host-context()
      "hover",
      "indeterminate",
      "in-range",
      "invalid",
      "is",
      // is()
      "lang",
      // lang()
      "last-child",
      "last-of-type",
      "left",
      "link",
      "local-link",
      "not",
      // not()
      "nth-child",
      // nth-child()
      "nth-col",
      // nth-col()
      "nth-last-child",
      // nth-last-child()
      "nth-last-col",
      // nth-last-col()
      "nth-last-of-type",
      //nth-last-of-type()
      "nth-of-type",
      //nth-of-type()
      "only-child",
      "only-of-type",
      "optional",
      "out-of-range",
      "past",
      "placeholder-shown",
      "read-only",
      "read-write",
      "required",
      "right",
      "root",
      "scope",
      "target",
      "target-within",
      "user-invalid",
      "valid",
      "visited",
      "where"
      // where()
    ].sort().reverse();
    var PSEUDO_ELEMENTS = [
      "after",
      "backdrop",
      "before",
      "cue",
      "cue-region",
      "first-letter",
      "first-line",
      "grammar-error",
      "marker",
      "part",
      "placeholder",
      "selection",
      "slotted",
      "spelling-error"
    ].sort().reverse();
    var ATTRIBUTES = [
      "accent-color",
      "align-content",
      "align-items",
      "align-self",
      "alignment-baseline",
      "all",
      "anchor-name",
      "animation",
      "animation-composition",
      "animation-delay",
      "animation-direction",
      "animation-duration",
      "animation-fill-mode",
      "animation-iteration-count",
      "animation-name",
      "animation-play-state",
      "animation-range",
      "animation-range-end",
      "animation-range-start",
      "animation-timeline",
      "animation-timing-function",
      "appearance",
      "aspect-ratio",
      "backdrop-filter",
      "backface-visibility",
      "background",
      "background-attachment",
      "background-blend-mode",
      "background-clip",
      "background-color",
      "background-image",
      "background-origin",
      "background-position",
      "background-position-x",
      "background-position-y",
      "background-repeat",
      "background-size",
      "baseline-shift",
      "block-size",
      "border",
      "border-block",
      "border-block-color",
      "border-block-end",
      "border-block-end-color",
      "border-block-end-style",
      "border-block-end-width",
      "border-block-start",
      "border-block-start-color",
      "border-block-start-style",
      "border-block-start-width",
      "border-block-style",
      "border-block-width",
      "border-bottom",
      "border-bottom-color",
      "border-bottom-left-radius",
      "border-bottom-right-radius",
      "border-bottom-style",
      "border-bottom-width",
      "border-collapse",
      "border-color",
      "border-end-end-radius",
      "border-end-start-radius",
      "border-image",
      "border-image-outset",
      "border-image-repeat",
      "border-image-slice",
      "border-image-source",
      "border-image-width",
      "border-inline",
      "border-inline-color",
      "border-inline-end",
      "border-inline-end-color",
      "border-inline-end-style",
      "border-inline-end-width",
      "border-inline-start",
      "border-inline-start-color",
      "border-inline-start-style",
      "border-inline-start-width",
      "border-inline-style",
      "border-inline-width",
      "border-left",
      "border-left-color",
      "border-left-style",
      "border-left-width",
      "border-radius",
      "border-right",
      "border-right-color",
      "border-right-style",
      "border-right-width",
      "border-spacing",
      "border-start-end-radius",
      "border-start-start-radius",
      "border-style",
      "border-top",
      "border-top-color",
      "border-top-left-radius",
      "border-top-right-radius",
      "border-top-style",
      "border-top-width",
      "border-width",
      "bottom",
      "box-align",
      "box-decoration-break",
      "box-direction",
      "box-flex",
      "box-flex-group",
      "box-lines",
      "box-ordinal-group",
      "box-orient",
      "box-pack",
      "box-shadow",
      "box-sizing",
      "break-after",
      "break-before",
      "break-inside",
      "caption-side",
      "caret-color",
      "clear",
      "clip",
      "clip-path",
      "clip-rule",
      "color",
      "color-interpolation",
      "color-interpolation-filters",
      "color-profile",
      "color-rendering",
      "color-scheme",
      "column-count",
      "column-fill",
      "column-gap",
      "column-rule",
      "column-rule-color",
      "column-rule-style",
      "column-rule-width",
      "column-span",
      "column-width",
      "columns",
      "contain",
      "contain-intrinsic-block-size",
      "contain-intrinsic-height",
      "contain-intrinsic-inline-size",
      "contain-intrinsic-size",
      "contain-intrinsic-width",
      "container",
      "container-name",
      "container-type",
      "content",
      "content-visibility",
      "counter-increment",
      "counter-reset",
      "counter-set",
      "cue",
      "cue-after",
      "cue-before",
      "cursor",
      "cx",
      "cy",
      "direction",
      "display",
      "dominant-baseline",
      "empty-cells",
      "enable-background",
      "field-sizing",
      "fill",
      "fill-opacity",
      "fill-rule",
      "filter",
      "flex",
      "flex-basis",
      "flex-direction",
      "flex-flow",
      "flex-grow",
      "flex-shrink",
      "flex-wrap",
      "float",
      "flood-color",
      "flood-opacity",
      "flow",
      "font",
      "font-display",
      "font-family",
      "font-feature-settings",
      "font-kerning",
      "font-language-override",
      "font-optical-sizing",
      "font-palette",
      "font-size",
      "font-size-adjust",
      "font-smooth",
      "font-smoothing",
      "font-stretch",
      "font-style",
      "font-synthesis",
      "font-synthesis-position",
      "font-synthesis-small-caps",
      "font-synthesis-style",
      "font-synthesis-weight",
      "font-variant",
      "font-variant-alternates",
      "font-variant-caps",
      "font-variant-east-asian",
      "font-variant-emoji",
      "font-variant-ligatures",
      "font-variant-numeric",
      "font-variant-position",
      "font-variation-settings",
      "font-weight",
      "forced-color-adjust",
      "gap",
      "glyph-orientation-horizontal",
      "glyph-orientation-vertical",
      "grid",
      "grid-area",
      "grid-auto-columns",
      "grid-auto-flow",
      "grid-auto-rows",
      "grid-column",
      "grid-column-end",
      "grid-column-start",
      "grid-gap",
      "grid-row",
      "grid-row-end",
      "grid-row-start",
      "grid-template",
      "grid-template-areas",
      "grid-template-columns",
      "grid-template-rows",
      "hanging-punctuation",
      "height",
      "hyphenate-character",
      "hyphenate-limit-chars",
      "hyphens",
      "icon",
      "image-orientation",
      "image-rendering",
      "image-resolution",
      "ime-mode",
      "initial-letter",
      "initial-letter-align",
      "inline-size",
      "inset",
      "inset-area",
      "inset-block",
      "inset-block-end",
      "inset-block-start",
      "inset-inline",
      "inset-inline-end",
      "inset-inline-start",
      "isolation",
      "justify-content",
      "justify-items",
      "justify-self",
      "kerning",
      "left",
      "letter-spacing",
      "lighting-color",
      "line-break",
      "line-height",
      "line-height-step",
      "list-style",
      "list-style-image",
      "list-style-position",
      "list-style-type",
      "margin",
      "margin-block",
      "margin-block-end",
      "margin-block-start",
      "margin-bottom",
      "margin-inline",
      "margin-inline-end",
      "margin-inline-start",
      "margin-left",
      "margin-right",
      "margin-top",
      "margin-trim",
      "marker",
      "marker-end",
      "marker-mid",
      "marker-start",
      "marks",
      "mask",
      "mask-border",
      "mask-border-mode",
      "mask-border-outset",
      "mask-border-repeat",
      "mask-border-slice",
      "mask-border-source",
      "mask-border-width",
      "mask-clip",
      "mask-composite",
      "mask-image",
      "mask-mode",
      "mask-origin",
      "mask-position",
      "mask-repeat",
      "mask-size",
      "mask-type",
      "masonry-auto-flow",
      "math-depth",
      "math-shift",
      "math-style",
      "max-block-size",
      "max-height",
      "max-inline-size",
      "max-width",
      "min-block-size",
      "min-height",
      "min-inline-size",
      "min-width",
      "mix-blend-mode",
      "nav-down",
      "nav-index",
      "nav-left",
      "nav-right",
      "nav-up",
      "none",
      "normal",
      "object-fit",
      "object-position",
      "offset",
      "offset-anchor",
      "offset-distance",
      "offset-path",
      "offset-position",
      "offset-rotate",
      "opacity",
      "order",
      "orphans",
      "outline",
      "outline-color",
      "outline-offset",
      "outline-style",
      "outline-width",
      "overflow",
      "overflow-anchor",
      "overflow-block",
      "overflow-clip-margin",
      "overflow-inline",
      "overflow-wrap",
      "overflow-x",
      "overflow-y",
      "overlay",
      "overscroll-behavior",
      "overscroll-behavior-block",
      "overscroll-behavior-inline",
      "overscroll-behavior-x",
      "overscroll-behavior-y",
      "padding",
      "padding-block",
      "padding-block-end",
      "padding-block-start",
      "padding-bottom",
      "padding-inline",
      "padding-inline-end",
      "padding-inline-start",
      "padding-left",
      "padding-right",
      "padding-top",
      "page",
      "page-break-after",
      "page-break-before",
      "page-break-inside",
      "paint-order",
      "pause",
      "pause-after",
      "pause-before",
      "perspective",
      "perspective-origin",
      "place-content",
      "place-items",
      "place-self",
      "pointer-events",
      "position",
      "position-anchor",
      "position-visibility",
      "print-color-adjust",
      "quotes",
      "r",
      "resize",
      "rest",
      "rest-after",
      "rest-before",
      "right",
      "rotate",
      "row-gap",
      "ruby-align",
      "ruby-position",
      "scale",
      "scroll-behavior",
      "scroll-margin",
      "scroll-margin-block",
      "scroll-margin-block-end",
      "scroll-margin-block-start",
      "scroll-margin-bottom",
      "scroll-margin-inline",
      "scroll-margin-inline-end",
      "scroll-margin-inline-start",
      "scroll-margin-left",
      "scroll-margin-right",
      "scroll-margin-top",
      "scroll-padding",
      "scroll-padding-block",
      "scroll-padding-block-end",
      "scroll-padding-block-start",
      "scroll-padding-bottom",
      "scroll-padding-inline",
      "scroll-padding-inline-end",
      "scroll-padding-inline-start",
      "scroll-padding-left",
      "scroll-padding-right",
      "scroll-padding-top",
      "scroll-snap-align",
      "scroll-snap-stop",
      "scroll-snap-type",
      "scroll-timeline",
      "scroll-timeline-axis",
      "scroll-timeline-name",
      "scrollbar-color",
      "scrollbar-gutter",
      "scrollbar-width",
      "shape-image-threshold",
      "shape-margin",
      "shape-outside",
      "shape-rendering",
      "speak",
      "speak-as",
      "src",
      // @font-face
      "stop-color",
      "stop-opacity",
      "stroke",
      "stroke-dasharray",
      "stroke-dashoffset",
      "stroke-linecap",
      "stroke-linejoin",
      "stroke-miterlimit",
      "stroke-opacity",
      "stroke-width",
      "tab-size",
      "table-layout",
      "text-align",
      "text-align-all",
      "text-align-last",
      "text-anchor",
      "text-combine-upright",
      "text-decoration",
      "text-decoration-color",
      "text-decoration-line",
      "text-decoration-skip",
      "text-decoration-skip-ink",
      "text-decoration-style",
      "text-decoration-thickness",
      "text-emphasis",
      "text-emphasis-color",
      "text-emphasis-position",
      "text-emphasis-style",
      "text-indent",
      "text-justify",
      "text-orientation",
      "text-overflow",
      "text-rendering",
      "text-shadow",
      "text-size-adjust",
      "text-transform",
      "text-underline-offset",
      "text-underline-position",
      "text-wrap",
      "text-wrap-mode",
      "text-wrap-style",
      "timeline-scope",
      "top",
      "touch-action",
      "transform",
      "transform-box",
      "transform-origin",
      "transform-style",
      "transition",
      "transition-behavior",
      "transition-delay",
      "transition-duration",
      "transition-property",
      "transition-timing-function",
      "translate",
      "unicode-bidi",
      "user-modify",
      "user-select",
      "vector-effect",
      "vertical-align",
      "view-timeline",
      "view-timeline-axis",
      "view-timeline-inset",
      "view-timeline-name",
      "view-transition-name",
      "visibility",
      "voice-balance",
      "voice-duration",
      "voice-family",
      "voice-pitch",
      "voice-range",
      "voice-rate",
      "voice-stress",
      "voice-volume",
      "white-space",
      "white-space-collapse",
      "widows",
      "width",
      "will-change",
      "word-break",
      "word-spacing",
      "word-wrap",
      "writing-mode",
      "x",
      "y",
      "z-index",
      "zoom"
    ].sort().reverse();
    var PSEUDO_SELECTORS = PSEUDO_CLASSES.concat(PSEUDO_ELEMENTS).sort().reverse();
    function less(hljs) {
      const modes = MODES(hljs);
      const PSEUDO_SELECTORS$1 = PSEUDO_SELECTORS;
      const AT_MODIFIERS = "and or not only";
      const IDENT_RE = "[\\w-]+";
      const INTERP_IDENT_RE = "(" + IDENT_RE + "|@\\{" + IDENT_RE + "\\})";
      const RULES = [];
      const VALUE_MODES = [];
      const STRING_MODE = function(c3) {
        return {
          // Less strings are not multiline (also include '~' for more consistent coloring of "escaped" strings)
          className: "string",
          begin: "~?" + c3 + ".*?" + c3
        };
      };
      const IDENT_MODE = function(name, begin, relevance) {
        return {
          className: name,
          begin,
          relevance
        };
      };
      const AT_KEYWORDS = {
        $pattern: /[a-z-]+/,
        keyword: AT_MODIFIERS,
        attribute: MEDIA_FEATURES.join(" ")
      };
      const PARENS_MODE = {
        // used only to properly balance nested parens inside mixin call, def. arg list
        begin: "\\(",
        end: "\\)",
        contains: VALUE_MODES,
        keywords: AT_KEYWORDS,
        relevance: 0
      };
      VALUE_MODES.push(
        hljs.C_LINE_COMMENT_MODE,
        hljs.C_BLOCK_COMMENT_MODE,
        STRING_MODE("'"),
        STRING_MODE('"'),
        modes.CSS_NUMBER_MODE,
        // fixme: it does not include dot for numbers like .5em :(
        {
          begin: "(url|data-uri)\\(",
          starts: {
            className: "string",
            end: "[\\)\\n]",
            excludeEnd: true
          }
        },
        modes.HEXCOLOR,
        PARENS_MODE,
        IDENT_MODE("variable", "@@?" + IDENT_RE, 10),
        IDENT_MODE("variable", "@\\{" + IDENT_RE + "\\}"),
        IDENT_MODE("built_in", "~?`[^`]*?`"),
        // inline javascript (or whatever host language) *multiline* string
        {
          // @media features (it’s here to not duplicate things in AT_RULE_MODE with extra PARENS_MODE overriding):
          className: "attribute",
          begin: IDENT_RE + "\\s*:",
          end: ":",
          returnBegin: true,
          excludeEnd: true
        },
        modes.IMPORTANT,
        { beginKeywords: "and not" },
        modes.FUNCTION_DISPATCH
      );
      const VALUE_WITH_RULESETS = VALUE_MODES.concat({
        begin: /\{/,
        end: /\}/,
        contains: RULES
      });
      const MIXIN_GUARD_MODE = {
        beginKeywords: "when",
        endsWithParent: true,
        contains: [{ beginKeywords: "and not" }].concat(VALUE_MODES)
        // using this form to override VALUE’s 'function' match
      };
      const RULE_MODE = {
        begin: INTERP_IDENT_RE + "\\s*:",
        returnBegin: true,
        end: /[;}]/,
        relevance: 0,
        contains: [
          { begin: /-(webkit|moz|ms|o)-/ },
          modes.CSS_VARIABLE,
          {
            className: "attribute",
            begin: "\\b(" + ATTRIBUTES.join("|") + ")\\b",
            end: /(?=:)/,
            starts: {
              endsWithParent: true,
              illegal: "[<=$]",
              relevance: 0,
              contains: VALUE_MODES
            }
          }
        ]
      };
      const AT_RULE_MODE = {
        className: "keyword",
        begin: "@(import|media|charset|font-face|(-[a-z]+-)?keyframes|supports|document|namespace|page|viewport|host)\\b",
        starts: {
          end: "[;{}]",
          keywords: AT_KEYWORDS,
          returnEnd: true,
          contains: VALUE_MODES,
          relevance: 0
        }
      };
      const VAR_RULE_MODE = {
        className: "variable",
        variants: [
          // using more strict pattern for higher relevance to increase chances of Less detection.
          // this is *the only* Less specific statement used in most of the sources, so...
          // (we’ll still often loose to the css-parser unless there's '//' comment,
          // simply because 1 variable just can't beat 99 properties :)
          {
            begin: "@" + IDENT_RE + "\\s*:",
            relevance: 15
          },
          { begin: "@" + IDENT_RE }
        ],
        starts: {
          end: "[;}]",
          returnEnd: true,
          contains: VALUE_WITH_RULESETS
        }
      };
      const SELECTOR_MODE = {
        // first parse unambiguous selectors (i.e. those not starting with tag)
        // then fall into the scary lookahead-discriminator variant.
        // this mode also handles mixin definitions and calls
        variants: [
          {
            begin: "[\\.#:&\\[>]",
            end: "[;{}]"
            // mixin calls end with ';'
          },
          {
            begin: INTERP_IDENT_RE,
            end: /\{/
          }
        ],
        returnBegin: true,
        returnEnd: true,
        illegal: `[<='$"]`,
        relevance: 0,
        contains: [
          hljs.C_LINE_COMMENT_MODE,
          hljs.C_BLOCK_COMMENT_MODE,
          MIXIN_GUARD_MODE,
          IDENT_MODE("keyword", "all\\b"),
          IDENT_MODE("variable", "@\\{" + IDENT_RE + "\\}"),
          // otherwise it’s identified as tag
          {
            begin: "\\b(" + TAGS.join("|") + ")\\b",
            className: "selector-tag"
          },
          modes.CSS_NUMBER_MODE,
          IDENT_MODE("selector-tag", INTERP_IDENT_RE, 0),
          IDENT_MODE("selector-id", "#" + INTERP_IDENT_RE),
          IDENT_MODE("selector-class", "\\." + INTERP_IDENT_RE, 0),
          IDENT_MODE("selector-tag", "&", 0),
          modes.ATTRIBUTE_SELECTOR_MODE,
          {
            className: "selector-pseudo",
            begin: ":(" + PSEUDO_CLASSES.join("|") + ")"
          },
          {
            className: "selector-pseudo",
            begin: ":(:)?(" + PSEUDO_ELEMENTS.join("|") + ")"
          },
          {
            begin: /\(/,
            end: /\)/,
            relevance: 0,
            contains: VALUE_WITH_RULESETS
          },
          // argument list of parametric mixins
          { begin: "!important" },
          // eat !important after mixin call or it will be colored as tag
          modes.FUNCTION_DISPATCH
        ]
      };
      const PSEUDO_SELECTOR_MODE = {
        begin: IDENT_RE + `:(:)?(${PSEUDO_SELECTORS$1.join("|")})`,
        returnBegin: true,
        contains: [SELECTOR_MODE]
      };
      RULES.push(
        hljs.C_LINE_COMMENT_MODE,
        hljs.C_BLOCK_COMMENT_MODE,
        AT_RULE_MODE,
        VAR_RULE_MODE,
        PSEUDO_SELECTOR_MODE,
        RULE_MODE,
        SELECTOR_MODE,
        MIXIN_GUARD_MODE,
        modes.FUNCTION_DISPATCH
      );
      return {
        name: "Less",
        case_insensitive: true,
        illegal: `[=>'/<($"]`,
        contains: RULES
      };
    }
    module.exports = less;
  }
});

// node_modules/highlight.js/lib/languages/lua.js
var require_lua = __commonJS({
  "node_modules/highlight.js/lib/languages/lua.js"(exports, module) {
    "use strict";
    function lua(hljs) {
      const OPENING_LONG_BRACKET = "\\[=*\\[";
      const CLOSING_LONG_BRACKET = "\\]=*\\]";
      const LONG_BRACKETS = {
        begin: OPENING_LONG_BRACKET,
        end: CLOSING_LONG_BRACKET,
        contains: ["self"]
      };
      const COMMENTS = [
        hljs.COMMENT("--(?!" + OPENING_LONG_BRACKET + ")", "$"),
        hljs.COMMENT(
          "--" + OPENING_LONG_BRACKET,
          CLOSING_LONG_BRACKET,
          {
            contains: [LONG_BRACKETS],
            relevance: 10
          }
        )
      ];
      return {
        name: "Lua",
        aliases: ["pluto"],
        keywords: {
          $pattern: hljs.UNDERSCORE_IDENT_RE,
          literal: "true false nil",
          keyword: "and break do else elseif end for goto if in local not or repeat return then until while",
          built_in: (
            // Metatags and globals:
            "_G _ENV _VERSION __index __newindex __mode __call __metatable __tostring __len __gc __add __sub __mul __div __mod __pow __concat __unm __eq __lt __le assert collectgarbage dofile error getfenv getmetatable ipairs load loadfile loadstring module next pairs pcall print rawequal rawget rawset require select setfenv setmetatable tonumber tostring type unpack xpcall arg self coroutine resume yield status wrap create running debug getupvalue debug sethook getmetatable gethook setmetatable setlocal traceback setfenv getinfo setupvalue getlocal getregistry getfenv io lines write close flush open output type read stderr stdin input stdout popen tmpfile math log max acos huge ldexp pi cos tanh pow deg tan cosh sinh random randomseed frexp ceil floor rad abs sqrt modf asin min mod fmod log10 atan2 exp sin atan os exit setlocale date getenv difftime remove time clock tmpname rename execute package preload loadlib loaded loaders cpath config path seeall string sub upper len gfind rep find match char dump gmatch reverse byte format gsub lower table setn insert getn foreachi maxn foreach concat sort remove"
          )
        },
        contains: COMMENTS.concat([
          {
            className: "function",
            beginKeywords: "function",
            end: "\\)",
            contains: [
              hljs.inherit(hljs.TITLE_MODE, { begin: "([_a-zA-Z]\\w*\\.)*([_a-zA-Z]\\w*:)?[_a-zA-Z]\\w*" }),
              {
                className: "params",
                begin: "\\(",
                endsWithParent: true,
                contains: COMMENTS
              }
            ].concat(COMMENTS)
          },
          hljs.C_NUMBER_MODE,
          hljs.APOS_STRING_MODE,
          hljs.QUOTE_STRING_MODE,
          {
            className: "string",
            begin: OPENING_LONG_BRACKET,
            end: CLOSING_LONG_BRACKET,
            contains: [LONG_BRACKETS],
            relevance: 5
          }
        ])
      };
    }
    module.exports = lua;
  }
});

// node_modules/highlight.js/lib/languages/makefile.js
var require_makefile = __commonJS({
  "node_modules/highlight.js/lib/languages/makefile.js"(exports, module) {
    "use strict";
    function makefile(hljs) {
      const VARIABLE = {
        className: "variable",
        variants: [
          {
            begin: "\\$\\(" + hljs.UNDERSCORE_IDENT_RE + "\\)",
            contains: [hljs.BACKSLASH_ESCAPE]
          },
          { begin: /\$[@%<?\^\+\*]/ }
        ]
      };
      const QUOTE_STRING = {
        className: "string",
        begin: /"/,
        end: /"/,
        contains: [
          hljs.BACKSLASH_ESCAPE,
          VARIABLE
        ]
      };
      const FUNC = {
        className: "variable",
        begin: /\$\([\w-]+\s/,
        end: /\)/,
        keywords: { built_in: "subst patsubst strip findstring filter filter-out sort word wordlist firstword lastword dir notdir suffix basename addsuffix addprefix join wildcard realpath abspath error warning shell origin flavor foreach if or and call eval file value" },
        contains: [
          VARIABLE,
          QUOTE_STRING
          // Added QUOTE_STRING as they can be a part of functions
        ]
      };
      const ASSIGNMENT = { begin: "^" + hljs.UNDERSCORE_IDENT_RE + "\\s*(?=[:+?]?=)" };
      const META = {
        className: "meta",
        begin: /^\.PHONY:/,
        end: /$/,
        keywords: {
          $pattern: /[\.\w]+/,
          keyword: ".PHONY"
        }
      };
      const TARGET = {
        className: "section",
        begin: /^[^\s]+:/,
        end: /$/,
        contains: [VARIABLE]
      };
      return {
        name: "Makefile",
        aliases: [
          "mk",
          "mak",
          "make"
        ],
        keywords: {
          $pattern: /[\w-]+/,
          keyword: "define endef undefine ifdef ifndef ifeq ifneq else endif include -include sinclude override export unexport private vpath"
        },
        contains: [
          hljs.HASH_COMMENT_MODE,
          VARIABLE,
          QUOTE_STRING,
          FUNC,
          ASSIGNMENT,
          META,
          TARGET
        ]
      };
    }
    module.exports = makefile;
  }
});

// node_modules/highlight.js/lib/languages/perl.js
var require_perl = __commonJS({
  "node_modules/highlight.js/lib/languages/perl.js"(exports, module) {
    "use strict";
    function perl(hljs) {
      const regex = hljs.regex;
      const KEYWORDS = [
        "abs",
        "accept",
        "alarm",
        "and",
        "atan2",
        "bind",
        "binmode",
        "bless",
        "break",
        "caller",
        "chdir",
        "chmod",
        "chomp",
        "chop",
        "chown",
        "chr",
        "chroot",
        "class",
        "close",
        "closedir",
        "connect",
        "continue",
        "cos",
        "crypt",
        "dbmclose",
        "dbmopen",
        "defined",
        "delete",
        "die",
        "do",
        "dump",
        "each",
        "else",
        "elsif",
        "endgrent",
        "endhostent",
        "endnetent",
        "endprotoent",
        "endpwent",
        "endservent",
        "eof",
        "eval",
        "exec",
        "exists",
        "exit",
        "exp",
        "fcntl",
        "field",
        "fileno",
        "flock",
        "for",
        "foreach",
        "fork",
        "format",
        "formline",
        "getc",
        "getgrent",
        "getgrgid",
        "getgrnam",
        "gethostbyaddr",
        "gethostbyname",
        "gethostent",
        "getlogin",
        "getnetbyaddr",
        "getnetbyname",
        "getnetent",
        "getpeername",
        "getpgrp",
        "getpriority",
        "getprotobyname",
        "getprotobynumber",
        "getprotoent",
        "getpwent",
        "getpwnam",
        "getpwuid",
        "getservbyname",
        "getservbyport",
        "getservent",
        "getsockname",
        "getsockopt",
        "given",
        "glob",
        "gmtime",
        "goto",
        "grep",
        "gt",
        "hex",
        "if",
        "index",
        "int",
        "ioctl",
        "join",
        "keys",
        "kill",
        "last",
        "lc",
        "lcfirst",
        "length",
        "link",
        "listen",
        "local",
        "localtime",
        "log",
        "lstat",
        "lt",
        "ma",
        "map",
        "method",
        "mkdir",
        "msgctl",
        "msgget",
        "msgrcv",
        "msgsnd",
        "my",
        "ne",
        "next",
        "no",
        "not",
        "oct",
        "open",
        "opendir",
        "or",
        "ord",
        "our",
        "pack",
        "package",
        "pipe",
        "pop",
        "pos",
        "print",
        "printf",
        "prototype",
        "push",
        "q|0",
        "qq",
        "quotemeta",
        "qw",
        "qx",
        "rand",
        "read",
        "readdir",
        "readline",
        "readlink",
        "readpipe",
        "recv",
        "redo",
        "ref",
        "rename",
        "require",
        "reset",
        "return",
        "reverse",
        "rewinddir",
        "rindex",
        "rmdir",
        "say",
        "scalar",
        "seek",
        "seekdir",
        "select",
        "semctl",
        "semget",
        "semop",
        "send",
        "setgrent",
        "sethostent",
        "setnetent",
        "setpgrp",
        "setpriority",
        "setprotoent",
        "setpwent",
        "setservent",
        "setsockopt",
        "shift",
        "shmctl",
        "shmget",
        "shmread",
        "shmwrite",
        "shutdown",
        "sin",
        "sleep",
        "socket",
        "socketpair",
        "sort",
        "splice",
        "split",
        "sprintf",
        "sqrt",
        "srand",
        "stat",
        "state",
        "study",
        "sub",
        "substr",
        "symlink",
        "syscall",
        "sysopen",
        "sysread",
        "sysseek",
        "system",
        "syswrite",
        "tell",
        "telldir",
        "tie",
        "tied",
        "time",
        "times",
        "tr",
        "truncate",
        "uc",
        "ucfirst",
        "umask",
        "undef",
        "unless",
        "unlink",
        "unpack",
        "unshift",
        "untie",
        "until",
        "use",
        "utime",
        "values",
        "vec",
        "wait",
        "waitpid",
        "wantarray",
        "warn",
        "when",
        "while",
        "write",
        "x|0",
        "xor",
        "y|0"
      ];
      const REGEX_MODIFIERS = /[dualxmsipngr]{0,12}/;
      const PERL_KEYWORDS = {
        $pattern: /[\w.]+/,
        keyword: KEYWORDS.join(" ")
      };
      const SUBST = {
        className: "subst",
        begin: "[$@]\\{",
        end: "\\}",
        keywords: PERL_KEYWORDS
      };
      const METHOD = {
        begin: /->\{/,
        end: /\}/
        // contains defined later
      };
      const ATTR = {
        scope: "attr",
        match: /\s+:\s*\w+(\s*\(.*?\))?/
      };
      const VAR = {
        scope: "variable",
        variants: [
          { begin: /\$\d/ },
          {
            begin: regex.concat(
              /[$%@](?!")(\^\w\b|#\w+(::\w+)*|\{\w+\}|\w+(::\w*)*)/,
              // negative look-ahead tries to avoid matching patterns that are not
              // Perl at all like $ident$, @ident@, etc.
              `(?![A-Za-z])(?![@$%])`
            )
          },
          {
            // Only $= is a special Perl variable and one can't declare @= or %=.
            begin: /[$%@](?!")[^\s\w{=]|\$=/,
            relevance: 0
          }
        ],
        contains: [ATTR]
      };
      const NUMBER = {
        className: "number",
        variants: [
          // decimal numbers:
          // include the case where a number starts with a dot (eg. .9), and
          // the leading 0? avoids mixing the first and second match on 0.x cases
          { match: /0?\.[0-9][0-9_]+\b/ },
          // include the special versioned number (eg. v5.38)
          { match: /\bv?(0|[1-9][0-9_]*(\.[0-9_]+)?|[1-9][0-9_]*)\b/ },
          // non-decimal numbers:
          { match: /\b0[0-7][0-7_]*\b/ },
          { match: /\b0x[0-9a-fA-F][0-9a-fA-F_]*\b/ },
          { match: /\b0b[0-1][0-1_]*\b/ }
        ],
        relevance: 0
      };
      const STRING_CONTAINS = [
        hljs.BACKSLASH_ESCAPE,
        SUBST,
        VAR
      ];
      const REGEX_DELIMS = [
        /!/,
        /\//,
        /\|/,
        /\?/,
        /'/,
        /"/,
        // valid but infrequent and weird
        /#/
        // valid but infrequent and weird
      ];
      const PAIRED_DOUBLE_RE = (prefix, open, close = "\\1") => {
        const middle = close === "\\1" ? close : regex.concat(close, open);
        return regex.concat(
          regex.concat("(?:", prefix, ")"),
          open,
          /(?:\\.|[^\\\/])*?/,
          middle,
          /(?:\\.|[^\\\/])*?/,
          close,
          REGEX_MODIFIERS
        );
      };
      const PAIRED_RE = (prefix, open, close) => {
        return regex.concat(
          regex.concat("(?:", prefix, ")"),
          open,
          /(?:\\.|[^\\\/])*?/,
          close,
          REGEX_MODIFIERS
        );
      };
      const PERL_DEFAULT_CONTAINS = [
        VAR,
        hljs.HASH_COMMENT_MODE,
        hljs.COMMENT(
          /^=\w/,
          /=cut/,
          { endsWithParent: true }
        ),
        METHOD,
        {
          className: "string",
          contains: STRING_CONTAINS,
          variants: [
            {
              begin: "q[qwxr]?\\s*\\(",
              end: "\\)",
              relevance: 5
            },
            {
              begin: "q[qwxr]?\\s*\\[",
              end: "\\]",
              relevance: 5
            },
            {
              begin: "q[qwxr]?\\s*\\{",
              end: "\\}",
              relevance: 5
            },
            {
              begin: "q[qwxr]?\\s*\\|",
              end: "\\|",
              relevance: 5
            },
            {
              begin: "q[qwxr]?\\s*<",
              end: ">",
              relevance: 5
            },
            {
              begin: "qw\\s+q",
              end: "q",
              relevance: 5
            },
            {
              begin: "'",
              end: "'",
              contains: [hljs.BACKSLASH_ESCAPE]
            },
            {
              begin: '"',
              end: '"'
            },
            {
              begin: "`",
              end: "`",
              contains: [hljs.BACKSLASH_ESCAPE]
            },
            {
              begin: /\{\w+\}/,
              relevance: 0
            },
            {
              begin: "-?\\w+\\s*=>",
              relevance: 0
            }
          ]
        },
        NUMBER,
        {
          // regexp container
          begin: "(\\/\\/|" + hljs.RE_STARTERS_RE + "|\\b(split|return|print|reverse|grep)\\b)\\s*",
          keywords: "split return print reverse grep",
          relevance: 0,
          contains: [
            hljs.HASH_COMMENT_MODE,
            {
              className: "regexp",
              variants: [
                // allow matching common delimiters
                { begin: PAIRED_DOUBLE_RE("s|tr|y", regex.either(...REGEX_DELIMS, { capture: true })) },
                // and then paired delmis
                { begin: PAIRED_DOUBLE_RE("s|tr|y", "\\(", "\\)") },
                { begin: PAIRED_DOUBLE_RE("s|tr|y", "\\[", "\\]") },
                { begin: PAIRED_DOUBLE_RE("s|tr|y", "\\{", "\\}") }
              ],
              relevance: 2
            },
            {
              className: "regexp",
              variants: [
                {
                  // could be a comment in many languages so do not count
                  // as relevant
                  begin: /(m|qr)\/\//,
                  relevance: 0
                },
                // prefix is optional with /regex/
                { begin: PAIRED_RE("(?:m|qr)?", /\//, /\//) },
                // allow matching common delimiters
                { begin: PAIRED_RE("m|qr", regex.either(...REGEX_DELIMS, { capture: true }), /\1/) },
                // allow common paired delmins
                { begin: PAIRED_RE("m|qr", /\(/, /\)/) },
                { begin: PAIRED_RE("m|qr", /\[/, /\]/) },
                { begin: PAIRED_RE("m|qr", /\{/, /\}/) }
              ]
            }
          ]
        },
        {
          className: "function",
          beginKeywords: "sub method",
          end: "(\\s*\\(.*?\\))?[;{]",
          excludeEnd: true,
          relevance: 5,
          contains: [hljs.TITLE_MODE, ATTR]
        },
        {
          className: "class",
          beginKeywords: "class",
          end: "[;{]",
          excludeEnd: true,
          relevance: 5,
          contains: [hljs.TITLE_MODE, ATTR, NUMBER]
        },
        {
          begin: "-\\w\\b",
          relevance: 0
        },
        {
          begin: "^__DATA__$",
          end: "^__END__$",
          subLanguage: "mojolicious",
          contains: [
            {
              begin: "^@@.*",
              end: "$",
              className: "comment"
            }
          ]
        }
      ];
      SUBST.contains = PERL_DEFAULT_CONTAINS;
      METHOD.contains = PERL_DEFAULT_CONTAINS;
      return {
        name: "Perl",
        aliases: [
          "pl",
          "pm"
        ],
        keywords: PERL_KEYWORDS,
        contains: PERL_DEFAULT_CONTAINS
      };
    }
    module.exports = perl;
  }
});

// node_modules/highlight.js/lib/languages/objectivec.js
var require_objectivec = __commonJS({
  "node_modules/highlight.js/lib/languages/objectivec.js"(exports, module) {
    "use strict";
    function objectivec(hljs) {
      const API_CLASS = {
        className: "built_in",
        begin: "\\b(AV|CA|CF|CG|CI|CL|CM|CN|CT|MK|MP|MTK|MTL|NS|SCN|SK|UI|WK|XC)\\w+"
      };
      const IDENTIFIER_RE = /[a-zA-Z@][a-zA-Z0-9_]*/;
      const TYPES = [
        "int",
        "float",
        "char",
        "unsigned",
        "signed",
        "short",
        "long",
        "double",
        "wchar_t",
        "unichar",
        "void",
        "bool",
        "BOOL",
        "id|0",
        "_Bool"
      ];
      const KWS = [
        "while",
        "export",
        "sizeof",
        "typedef",
        "const",
        "struct",
        "for",
        "union",
        "volatile",
        "static",
        "mutable",
        "if",
        "do",
        "return",
        "goto",
        "enum",
        "else",
        "break",
        "extern",
        "asm",
        "case",
        "default",
        "register",
        "explicit",
        "typename",
        "switch",
        "continue",
        "inline",
        "readonly",
        "assign",
        "readwrite",
        "self",
        "@synchronized",
        "id",
        "typeof",
        "nonatomic",
        "IBOutlet",
        "IBAction",
        "strong",
        "weak",
        "copy",
        "in",
        "out",
        "inout",
        "bycopy",
        "byref",
        "oneway",
        "__strong",
        "__weak",
        "__block",
        "__autoreleasing",
        "@private",
        "@protected",
        "@public",
        "@try",
        "@property",
        "@end",
        "@throw",
        "@catch",
        "@finally",
        "@autoreleasepool",
        "@synthesize",
        "@dynamic",
        "@selector",
        "@optional",
        "@required",
        "@encode",
        "@package",
        "@import",
        "@defs",
        "@compatibility_alias",
        "__bridge",
        "__bridge_transfer",
        "__bridge_retained",
        "__bridge_retain",
        "__covariant",
        "__contravariant",
        "__kindof",
        "_Nonnull",
        "_Nullable",
        "_Null_unspecified",
        "__FUNCTION__",
        "__PRETTY_FUNCTION__",
        "__attribute__",
        "getter",
        "setter",
        "retain",
        "unsafe_unretained",
        "nonnull",
        "nullable",
        "null_unspecified",
        "null_resettable",
        "class",
        "instancetype",
        "NS_DESIGNATED_INITIALIZER",
        "NS_UNAVAILABLE",
        "NS_REQUIRES_SUPER",
        "NS_RETURNS_INNER_POINTER",
        "NS_INLINE",
        "NS_AVAILABLE",
        "NS_DEPRECATED",
        "NS_ENUM",
        "NS_OPTIONS",
        "NS_SWIFT_UNAVAILABLE",
        "NS_ASSUME_NONNULL_BEGIN",
        "NS_ASSUME_NONNULL_END",
        "NS_REFINED_FOR_SWIFT",
        "NS_SWIFT_NAME",
        "NS_SWIFT_NOTHROW",
        "NS_DURING",
        "NS_HANDLER",
        "NS_ENDHANDLER",
        "NS_VALUERETURN",
        "NS_VOIDRETURN"
      ];
      const LITERALS = [
        "false",
        "true",
        "FALSE",
        "TRUE",
        "nil",
        "YES",
        "NO",
        "NULL"
      ];
      const BUILT_INS = [
        "dispatch_once_t",
        "dispatch_queue_t",
        "dispatch_sync",
        "dispatch_async",
        "dispatch_once"
      ];
      const KEYWORDS = {
        "variable.language": [
          "this",
          "super"
        ],
        $pattern: IDENTIFIER_RE,
        keyword: KWS,
        literal: LITERALS,
        built_in: BUILT_INS,
        type: TYPES
      };
      const CLASS_KEYWORDS = {
        $pattern: IDENTIFIER_RE,
        keyword: [
          "@interface",
          "@class",
          "@protocol",
          "@implementation"
        ]
      };
      return {
        name: "Objective-C",
        aliases: [
          "mm",
          "objc",
          "obj-c",
          "obj-c++",
          "objective-c++"
        ],
        keywords: KEYWORDS,
        illegal: "</",
        contains: [
          API_CLASS,
          hljs.C_LINE_COMMENT_MODE,
          hljs.C_BLOCK_COMMENT_MODE,
          hljs.C_NUMBER_MODE,
          hljs.QUOTE_STRING_MODE,
          hljs.APOS_STRING_MODE,
          {
            className: "string",
            variants: [
              {
                begin: '@"',
                end: '"',
                illegal: "\\n",
                contains: [hljs.BACKSLASH_ESCAPE]
              }
            ]
          },
          {
            className: "meta",
            begin: /#\s*[a-z]+\b/,
            end: /$/,
            keywords: { keyword: "if else elif endif define undef warning error line pragma ifdef ifndef include" },
            contains: [
              {
                begin: /\\\n/,
                relevance: 0
              },
              hljs.inherit(hljs.QUOTE_STRING_MODE, { className: "string" }),
              {
                className: "string",
                begin: /<.*?>/,
                end: /$/,
                illegal: "\\n"
              },
              hljs.C_LINE_COMMENT_MODE,
              hljs.C_BLOCK_COMMENT_MODE
            ]
          },
          {
            className: "class",
            begin: "(" + CLASS_KEYWORDS.keyword.join("|") + ")\\b",
            end: /(\{|$)/,
            excludeEnd: true,
            keywords: CLASS_KEYWORDS,
            contains: [hljs.UNDERSCORE_TITLE_MODE]
          },
          {
            begin: "\\." + hljs.UNDERSCORE_IDENT_RE,
            relevance: 0
          }
        ]
      };
    }
    module.exports = objectivec;
  }
});

// node_modules/highlight.js/lib/languages/php.js
var require_php = __commonJS({
  "node_modules/highlight.js/lib/languages/php.js"(exports, module) {
    "use strict";
    function php(hljs) {
      const regex = hljs.regex;
      const NOT_PERL_ETC = /(?![A-Za-z0-9])(?![$])/;
      const IDENT_RE = regex.concat(
        /[a-zA-Z_\x7f-\xff][a-zA-Z0-9_\x7f-\xff]*/,
        NOT_PERL_ETC
      );
      const PASCAL_CASE_CLASS_NAME_RE = regex.concat(
        /(\\?[A-Z][a-z0-9_\x7f-\xff]+|\\?[A-Z]+(?=[A-Z][a-z0-9_\x7f-\xff])){1,}/,
        NOT_PERL_ETC
      );
      const UPCASE_NAME_RE = regex.concat(
        /[A-Z]+/,
        NOT_PERL_ETC
      );
      const VARIABLE = {
        scope: "variable",
        match: "\\$+" + IDENT_RE
      };
      const PREPROCESSOR = {
        scope: "meta",
        variants: [
          { begin: /<\?php/, relevance: 10 },
          // boost for obvious PHP
          { begin: /<\?=/ },
          // less relevant per PSR-1 which says not to use short-tags
          { begin: /<\?/, relevance: 0.1 },
          { begin: /\?>/ }
          // end php tag
        ]
      };
      const SUBST = {
        scope: "subst",
        variants: [
          { begin: /\$\w+/ },
          {
            begin: /\{\$/,
            end: /\}/
          }
        ]
      };
      const SINGLE_QUOTED = hljs.inherit(hljs.APOS_STRING_MODE, { illegal: null });
      const DOUBLE_QUOTED = hljs.inherit(hljs.QUOTE_STRING_MODE, {
        illegal: null,
        contains: hljs.QUOTE_STRING_MODE.contains.concat(SUBST)
      });
      const HEREDOC = {
        begin: /<<<[ \t]*(?:(\w+)|"(\w+)")\n/,
        end: /[ \t]*(\w+)\b/,
        contains: hljs.QUOTE_STRING_MODE.contains.concat(SUBST),
        "on:begin": (m3, resp) => {
          resp.data._beginMatch = m3[1] || m3[2];
        },
        "on:end": (m3, resp) => {
          if (resp.data._beginMatch !== m3[1]) resp.ignoreMatch();
        }
      };
      const NOWDOC = hljs.END_SAME_AS_BEGIN({
        begin: /<<<[ \t]*'(\w+)'\n/,
        end: /[ \t]*(\w+)\b/
      });
      const WHITESPACE = "[ 	\n]";
      const STRING = {
        scope: "string",
        variants: [
          DOUBLE_QUOTED,
          SINGLE_QUOTED,
          HEREDOC,
          NOWDOC
        ]
      };
      const NUMBER = {
        scope: "number",
        variants: [
          { begin: `\\b0[bB][01]+(?:_[01]+)*\\b` },
          // Binary w/ underscore support
          { begin: `\\b0[oO][0-7]+(?:_[0-7]+)*\\b` },
          // Octals w/ underscore support
          { begin: `\\b0[xX][\\da-fA-F]+(?:_[\\da-fA-F]+)*\\b` },
          // Hex w/ underscore support
          // Decimals w/ underscore support, with optional fragments and scientific exponent (e) suffix.
          { begin: `(?:\\b\\d+(?:_\\d+)*(\\.(?:\\d+(?:_\\d+)*))?|\\B\\.\\d+)(?:[eE][+-]?\\d+)?` }
        ],
        relevance: 0
      };
      const LITERALS = [
        "false",
        "null",
        "true"
      ];
      const KWS = [
        // Magic constants:
        // <https://www.php.net/manual/en/language.constants.predefined.php>
        "__CLASS__",
        "__DIR__",
        "__FILE__",
        "__FUNCTION__",
        "__COMPILER_HALT_OFFSET__",
        "__LINE__",
        "__METHOD__",
        "__NAMESPACE__",
        "__TRAIT__",
        // Function that look like language construct or language construct that look like function:
        // List of keywords that may not require parenthesis
        "die",
        "echo",
        "exit",
        "include",
        "include_once",
        "print",
        "require",
        "require_once",
        // These are not language construct (function) but operate on the currently-executing function and can access the current symbol table
        // 'compact extract func_get_arg func_get_args func_num_args get_called_class get_parent_class ' +
        // Other keywords:
        // <https://www.php.net/manual/en/reserved.php>
        // <https://www.php.net/manual/en/language.types.type-juggling.php>
        "array",
        "abstract",
        "and",
        "as",
        "binary",
        "bool",
        "boolean",
        "break",
        "callable",
        "case",
        "catch",
        "class",
        "clone",
        "const",
        "continue",
        "declare",
        "default",
        "do",
        "double",
        "else",
        "elseif",
        "empty",
        "enddeclare",
        "endfor",
        "endforeach",
        "endif",
        "endswitch",
        "endwhile",
        "enum",
        "eval",
        "extends",
        "final",
        "finally",
        "float",
        "for",
        "foreach",
        "from",
        "global",
        "goto",
        "if",
        "implements",
        "instanceof",
        "insteadof",
        "int",
        "integer",
        "interface",
        "isset",
        "iterable",
        "list",
        "match|0",
        "mixed",
        "new",
        "never",
        "object",
        "or",
        "private",
        "protected",
        "public",
        "readonly",
        "real",
        "return",
        "string",
        "switch",
        "throw",
        "trait",
        "try",
        "unset",
        "use",
        "var",
        "void",
        "while",
        "xor",
        "yield"
      ];
      const BUILT_INS = [
        // Standard PHP library:
        // <https://www.php.net/manual/en/book.spl.php>
        "Error|0",
        "AppendIterator",
        "ArgumentCountError",
        "ArithmeticError",
        "ArrayIterator",
        "ArrayObject",
        "AssertionError",
        "BadFunctionCallException",
        "BadMethodCallException",
        "CachingIterator",
        "CallbackFilterIterator",
        "CompileError",
        "Countable",
        "DirectoryIterator",
        "DivisionByZeroError",
        "DomainException",
        "EmptyIterator",
        "ErrorException",
        "Exception",
        "FilesystemIterator",
        "FilterIterator",
        "GlobIterator",
        "InfiniteIterator",
        "InvalidArgumentException",
        "IteratorIterator",
        "LengthException",
        "LimitIterator",
        "LogicException",
        "MultipleIterator",
        "NoRewindIterator",
        "OutOfBoundsException",
        "OutOfRangeException",
        "OuterIterator",
        "OverflowException",
        "ParentIterator",
        "ParseError",
        "RangeException",
        "RecursiveArrayIterator",
        "RecursiveCachingIterator",
        "RecursiveCallbackFilterIterator",
        "RecursiveDirectoryIterator",
        "RecursiveFilterIterator",
        "RecursiveIterator",
        "RecursiveIteratorIterator",
        "RecursiveRegexIterator",
        "RecursiveTreeIterator",
        "RegexIterator",
        "RuntimeException",
        "SeekableIterator",
        "SplDoublyLinkedList",
        "SplFileInfo",
        "SplFileObject",
        "SplFixedArray",
        "SplHeap",
        "SplMaxHeap",
        "SplMinHeap",
        "SplObjectStorage",
        "SplObserver",
        "SplPriorityQueue",
        "SplQueue",
        "SplStack",
        "SplSubject",
        "SplTempFileObject",
        "TypeError",
        "UnderflowException",
        "UnexpectedValueException",
        "UnhandledMatchError",
        // Reserved interfaces:
        // <https://www.php.net/manual/en/reserved.interfaces.php>
        "ArrayAccess",
        "BackedEnum",
        "Closure",
        "Fiber",
        "Generator",
        "Iterator",
        "IteratorAggregate",
        "Serializable",
        "Stringable",
        "Throwable",
        "Traversable",
        "UnitEnum",
        "WeakReference",
        "WeakMap",
        // Reserved classes:
        // <https://www.php.net/manual/en/reserved.classes.php>
        "Directory",
        "__PHP_Incomplete_Class",
        "parent",
        "php_user_filter",
        "self",
        "static",
        "stdClass"
      ];
      const dualCase = (items) => {
        const result = [];
        items.forEach((item) => {
          result.push(item);
          if (item.toLowerCase() === item) {
            result.push(item.toUpperCase());
          } else {
            result.push(item.toLowerCase());
          }
        });
        return result;
      };
      const KEYWORDS = {
        keyword: KWS,
        literal: dualCase(LITERALS),
        built_in: BUILT_INS
      };
      const normalizeKeywords = (items) => {
        return items.map((item) => {
          return item.replace(/\|\d+$/, "");
        });
      };
      const CONSTRUCTOR_CALL = { variants: [
        {
          match: [
            /new/,
            regex.concat(WHITESPACE, "+"),
            // to prevent built ins from being confused as the class constructor call
            regex.concat("(?!", normalizeKeywords(BUILT_INS).join("\\b|"), "\\b)"),
            PASCAL_CASE_CLASS_NAME_RE
          ],
          scope: {
            1: "keyword",
            4: "title.class"
          }
        }
      ] };
      const CONSTANT_REFERENCE = regex.concat(IDENT_RE, "\\b(?!\\()");
      const LEFT_AND_RIGHT_SIDE_OF_DOUBLE_COLON = { variants: [
        {
          match: [
            regex.concat(
              /::/,
              regex.lookahead(/(?!class\b)/)
            ),
            CONSTANT_REFERENCE
          ],
          scope: { 2: "variable.constant" }
        },
        {
          match: [
            /::/,
            /class/
          ],
          scope: { 2: "variable.language" }
        },
        {
          match: [
            PASCAL_CASE_CLASS_NAME_RE,
            regex.concat(
              /::/,
              regex.lookahead(/(?!class\b)/)
            ),
            CONSTANT_REFERENCE
          ],
          scope: {
            1: "title.class",
            3: "variable.constant"
          }
        },
        {
          match: [
            PASCAL_CASE_CLASS_NAME_RE,
            regex.concat(
              "::",
              regex.lookahead(/(?!class\b)/)
            )
          ],
          scope: { 1: "title.class" }
        },
        {
          match: [
            PASCAL_CASE_CLASS_NAME_RE,
            /::/,
            /class/
          ],
          scope: {
            1: "title.class",
            3: "variable.language"
          }
        }
      ] };
      const NAMED_ARGUMENT = {
        scope: "attr",
        match: regex.concat(IDENT_RE, regex.lookahead(":"), regex.lookahead(/(?!::)/))
      };
      const PARAMS_MODE = {
        relevance: 0,
        begin: /\(/,
        end: /\)/,
        keywords: KEYWORDS,
        contains: [
          NAMED_ARGUMENT,
          VARIABLE,
          LEFT_AND_RIGHT_SIDE_OF_DOUBLE_COLON,
          hljs.C_BLOCK_COMMENT_MODE,
          STRING,
          NUMBER,
          CONSTRUCTOR_CALL
        ]
      };
      const FUNCTION_INVOKE = {
        relevance: 0,
        match: [
          /\b/,
          // to prevent keywords from being confused as the function title
          regex.concat("(?!fn\\b|function\\b|", normalizeKeywords(KWS).join("\\b|"), "|", normalizeKeywords(BUILT_INS).join("\\b|"), "\\b)"),
          IDENT_RE,
          regex.concat(WHITESPACE, "*"),
          regex.lookahead(/(?=\()/)
        ],
        scope: { 3: "title.function.invoke" },
        contains: [PARAMS_MODE]
      };
      PARAMS_MODE.contains.push(FUNCTION_INVOKE);
      const ATTRIBUTE_CONTAINS = [
        NAMED_ARGUMENT,
        LEFT_AND_RIGHT_SIDE_OF_DOUBLE_COLON,
        hljs.C_BLOCK_COMMENT_MODE,
        STRING,
        NUMBER,
        CONSTRUCTOR_CALL
      ];
      const ATTRIBUTES = {
        begin: regex.concat(
          /#\[\s*\\?/,
          regex.either(
            PASCAL_CASE_CLASS_NAME_RE,
            UPCASE_NAME_RE
          )
        ),
        beginScope: "meta",
        end: /]/,
        endScope: "meta",
        keywords: {
          literal: LITERALS,
          keyword: [
            "new",
            "array"
          ]
        },
        contains: [
          {
            begin: /\[/,
            end: /]/,
            keywords: {
              literal: LITERALS,
              keyword: [
                "new",
                "array"
              ]
            },
            contains: [
              "self",
              ...ATTRIBUTE_CONTAINS
            ]
          },
          ...ATTRIBUTE_CONTAINS,
          {
            scope: "meta",
            variants: [
              { match: PASCAL_CASE_CLASS_NAME_RE },
              { match: UPCASE_NAME_RE }
            ]
          }
        ]
      };
      return {
        case_insensitive: false,
        keywords: KEYWORDS,
        contains: [
          ATTRIBUTES,
          hljs.HASH_COMMENT_MODE,
          hljs.COMMENT("//", "$"),
          hljs.COMMENT(
            "/\\*",
            "\\*/",
            { contains: [
              {
                scope: "doctag",
                match: "@[A-Za-z]+"
              }
            ] }
          ),
          {
            match: /__halt_compiler\(\);/,
            keywords: "__halt_compiler",
            starts: {
              scope: "comment",
              end: hljs.MATCH_NOTHING_RE,
              contains: [
                {
                  match: /\?>/,
                  scope: "meta",
                  endsParent: true
                }
              ]
            }
          },
          PREPROCESSOR,
          {
            scope: "variable.language",
            match: /\$this\b/
          },
          VARIABLE,
          FUNCTION_INVOKE,
          LEFT_AND_RIGHT_SIDE_OF_DOUBLE_COLON,
          {
            match: [
              /const/,
              /\s/,
              IDENT_RE
            ],
            scope: {
              1: "keyword",
              3: "variable.constant"
            }
          },
          CONSTRUCTOR_CALL,
          {
            scope: "function",
            relevance: 0,
            beginKeywords: "fn function",
            end: /[;{]/,
            excludeEnd: true,
            illegal: "[$%\\[]",
            contains: [
              { beginKeywords: "use" },
              hljs.UNDERSCORE_TITLE_MODE,
              {
                begin: "=>",
                // No markup, just a relevance booster
                endsParent: true
              },
              {
                scope: "params",
                begin: "\\(",
                end: "\\)",
                excludeBegin: true,
                excludeEnd: true,
                keywords: KEYWORDS,
                contains: [
                  "self",
                  ATTRIBUTES,
                  VARIABLE,
                  LEFT_AND_RIGHT_SIDE_OF_DOUBLE_COLON,
                  hljs.C_BLOCK_COMMENT_MODE,
                  STRING,
                  NUMBER
                ]
              }
            ]
          },
          {
            scope: "class",
            variants: [
              {
                beginKeywords: "enum",
                illegal: /[($"]/
              },
              {
                beginKeywords: "class interface trait",
                illegal: /[:($"]/
              }
            ],
            relevance: 0,
            end: /\{/,
            excludeEnd: true,
            contains: [
              { beginKeywords: "extends implements" },
              hljs.UNDERSCORE_TITLE_MODE
            ]
          },
          // both use and namespace still use "old style" rules (vs multi-match)
          // because the namespace name can include `\` and we still want each
          // element to be treated as its own *individual* title
          {
            beginKeywords: "namespace",
            relevance: 0,
            end: ";",
            illegal: /[.']/,
            contains: [hljs.inherit(hljs.UNDERSCORE_TITLE_MODE, { scope: "title.class" })]
          },
          {
            beginKeywords: "use",
            relevance: 0,
            end: ";",
            contains: [
              // TODO: title.function vs title.class
              {
                match: /\b(as|const|function)\b/,
                scope: "keyword"
              },
              // TODO: could be title.class or title.function
              hljs.UNDERSCORE_TITLE_MODE
            ]
          },
          STRING,
          NUMBER
        ]
      };
    }
    module.exports = php;
  }
});

// node_modules/highlight.js/lib/languages/php-template.js
var require_php_template = __commonJS({
  "node_modules/highlight.js/lib/languages/php-template.js"(exports, module) {
    "use strict";
    function phpTemplate(hljs) {
      return {
        name: "PHP template",
        subLanguage: "xml",
        contains: [
          {
            begin: /<\?(php|=)?/,
            end: /\?>/,
            subLanguage: "php",
            contains: [
              // We don't want the php closing tag ?> to close the PHP block when
              // inside any of the following blocks:
              {
                begin: "/\\*",
                end: "\\*/",
                skip: true
              },
              {
                begin: 'b"',
                end: '"',
                skip: true
              },
              {
                begin: "b'",
                end: "'",
                skip: true
              },
              hljs.inherit(hljs.APOS_STRING_MODE, {
                illegal: null,
                className: null,
                contains: null,
                skip: true
              }),
              hljs.inherit(hljs.QUOTE_STRING_MODE, {
                illegal: null,
                className: null,
                contains: null,
                skip: true
              })
            ]
          }
        ]
      };
    }
    module.exports = phpTemplate;
  }
});

// node_modules/highlight.js/lib/languages/plaintext.js
var require_plaintext = __commonJS({
  "node_modules/highlight.js/lib/languages/plaintext.js"(exports, module) {
    "use strict";
    function plaintext(hljs) {
      return {
        name: "Plain text",
        aliases: [
          "text",
          "txt"
        ],
        disableAutodetect: true
      };
    }
    module.exports = plaintext;
  }
});

// node_modules/highlight.js/lib/languages/python.js
var require_python = __commonJS({
  "node_modules/highlight.js/lib/languages/python.js"(exports, module) {
    "use strict";
    function python(hljs) {
      const regex = hljs.regex;
      const IDENT_RE = /[\p{XID_Start}_]\p{XID_Continue}*/u;
      const RESERVED_WORDS = [
        "and",
        "as",
        "assert",
        "async",
        "await",
        "break",
        "case",
        "class",
        "continue",
        "def",
        "del",
        "elif",
        "else",
        "except",
        "finally",
        "for",
        "from",
        "global",
        "if",
        "import",
        "in",
        "is",
        "lambda",
        "match",
        "nonlocal|10",
        "not",
        "or",
        "pass",
        "raise",
        "return",
        "try",
        "while",
        "with",
        "yield"
      ];
      const BUILT_INS = [
        "__import__",
        "abs",
        "all",
        "any",
        "ascii",
        "bin",
        "bool",
        "breakpoint",
        "bytearray",
        "bytes",
        "callable",
        "chr",
        "classmethod",
        "compile",
        "complex",
        "delattr",
        "dict",
        "dir",
        "divmod",
        "enumerate",
        "eval",
        "exec",
        "filter",
        "float",
        "format",
        "frozenset",
        "getattr",
        "globals",
        "hasattr",
        "hash",
        "help",
        "hex",
        "id",
        "input",
        "int",
        "isinstance",
        "issubclass",
        "iter",
        "len",
        "list",
        "locals",
        "map",
        "max",
        "memoryview",
        "min",
        "next",
        "object",
        "oct",
        "open",
        "ord",
        "pow",
        "print",
        "property",
        "range",
        "repr",
        "reversed",
        "round",
        "set",
        "setattr",
        "slice",
        "sorted",
        "staticmethod",
        "str",
        "sum",
        "super",
        "tuple",
        "type",
        "vars",
        "zip"
      ];
      const LITERALS = [
        "__debug__",
        "Ellipsis",
        "False",
        "None",
        "NotImplemented",
        "True"
      ];
      const TYPES = [
        "Any",
        "Callable",
        "Coroutine",
        "Dict",
        "List",
        "Literal",
        "Generic",
        "Optional",
        "Sequence",
        "Set",
        "Tuple",
        "Type",
        "Union"
      ];
      const KEYWORDS = {
        $pattern: /[A-Za-z]\w+|__\w+__/,
        keyword: RESERVED_WORDS,
        built_in: BUILT_INS,
        literal: LITERALS,
        type: TYPES
      };
      const PROMPT = {
        className: "meta",
        begin: /^(>>>|\.\.\.) /
      };
      const SUBST = {
        className: "subst",
        begin: /\{/,
        end: /\}/,
        keywords: KEYWORDS,
        illegal: /#/
      };
      const LITERAL_BRACKET = {
        begin: /\{\{/,
        relevance: 0
      };
      const STRING = {
        className: "string",
        contains: [hljs.BACKSLASH_ESCAPE],
        variants: [
          {
            begin: /([uU]|[bB]|[rR]|[bB][rR]|[rR][bB])?'''/,
            end: /'''/,
            contains: [
              hljs.BACKSLASH_ESCAPE,
              PROMPT
            ],
            relevance: 10
          },
          {
            begin: /([uU]|[bB]|[rR]|[bB][rR]|[rR][bB])?"""/,
            end: /"""/,
            contains: [
              hljs.BACKSLASH_ESCAPE,
              PROMPT
            ],
            relevance: 10
          },
          {
            begin: /([fF][rR]|[rR][fF]|[fF])'''/,
            end: /'''/,
            contains: [
              hljs.BACKSLASH_ESCAPE,
              PROMPT,
              LITERAL_BRACKET,
              SUBST
            ]
          },
          {
            begin: /([fF][rR]|[rR][fF]|[fF])"""/,
            end: /"""/,
            contains: [
              hljs.BACKSLASH_ESCAPE,
              PROMPT,
              LITERAL_BRACKET,
              SUBST
            ]
          },
          {
            begin: /([uU]|[rR])'/,
            end: /'/,
            relevance: 10
          },
          {
            begin: /([uU]|[rR])"/,
            end: /"/,
            relevance: 10
          },
          {
            begin: /([bB]|[bB][rR]|[rR][bB])'/,
            end: /'/
          },
          {
            begin: /([bB]|[bB][rR]|[rR][bB])"/,
            end: /"/
          },
          {
            begin: /([fF][rR]|[rR][fF]|[fF])'/,
            end: /'/,
            contains: [
              hljs.BACKSLASH_ESCAPE,
              LITERAL_BRACKET,
              SUBST
            ]
          },
          {
            begin: /([fF][rR]|[rR][fF]|[fF])"/,
            end: /"/,
            contains: [
              hljs.BACKSLASH_ESCAPE,
              LITERAL_BRACKET,
              SUBST
            ]
          },
          hljs.APOS_STRING_MODE,
          hljs.QUOTE_STRING_MODE
        ]
      };
      const digitpart = "[0-9](_?[0-9])*";
      const pointfloat = `(\\b(${digitpart}))?\\.(${digitpart})|\\b(${digitpart})\\.`;
      const lookahead = `\\b|${RESERVED_WORDS.join("|")}`;
      const NUMBER = {
        className: "number",
        relevance: 0,
        variants: [
          // exponentfloat, pointfloat
          // https://docs.python.org/3.9/reference/lexical_analysis.html#floating-point-literals
          // optionally imaginary
          // https://docs.python.org/3.9/reference/lexical_analysis.html#imaginary-literals
          // Note: no leading \b because floats can start with a decimal point
          // and we don't want to mishandle e.g. `fn(.5)`,
          // no trailing \b for pointfloat because it can end with a decimal point
          // and we don't want to mishandle e.g. `0..hex()`; this should be safe
          // because both MUST contain a decimal point and so cannot be confused with
          // the interior part of an identifier
          {
            begin: `(\\b(${digitpart})|(${pointfloat}))[eE][+-]?(${digitpart})[jJ]?(?=${lookahead})`
          },
          {
            begin: `(${pointfloat})[jJ]?`
          },
          // decinteger, bininteger, octinteger, hexinteger
          // https://docs.python.org/3.9/reference/lexical_analysis.html#integer-literals
          // optionally "long" in Python 2
          // https://docs.python.org/2.7/reference/lexical_analysis.html#integer-and-long-integer-literals
          // decinteger is optionally imaginary
          // https://docs.python.org/3.9/reference/lexical_analysis.html#imaginary-literals
          {
            begin: `\\b([1-9](_?[0-9])*|0+(_?0)*)[lLjJ]?(?=${lookahead})`
          },
          {
            begin: `\\b0[bB](_?[01])+[lL]?(?=${lookahead})`
          },
          {
            begin: `\\b0[oO](_?[0-7])+[lL]?(?=${lookahead})`
          },
          {
            begin: `\\b0[xX](_?[0-9a-fA-F])+[lL]?(?=${lookahead})`
          },
          // imagnumber (digitpart-based)
          // https://docs.python.org/3.9/reference/lexical_analysis.html#imaginary-literals
          {
            begin: `\\b(${digitpart})[jJ](?=${lookahead})`
          }
        ]
      };
      const COMMENT_TYPE = {
        className: "comment",
        begin: regex.lookahead(/# type:/),
        end: /$/,
        keywords: KEYWORDS,
        contains: [
          {
            // prevent keywords from coloring `type`
            begin: /# type:/
          },
          // comment within a datatype comment includes no keywords
          {
            begin: /#/,
            end: /\b\B/,
            endsWithParent: true
          }
        ]
      };
      const PARAMS = {
        className: "params",
        variants: [
          // Exclude params in functions without params
          {
            className: "",
            begin: /\(\s*\)/,
            skip: true
          },
          {
            begin: /\(/,
            end: /\)/,
            excludeBegin: true,
            excludeEnd: true,
            keywords: KEYWORDS,
            contains: [
              "self",
              PROMPT,
              NUMBER,
              STRING,
              hljs.HASH_COMMENT_MODE
            ]
          }
        ]
      };
      SUBST.contains = [
        STRING,
        NUMBER,
        PROMPT
      ];
      return {
        name: "Python",
        aliases: [
          "py",
          "gyp",
          "ipython"
        ],
        unicodeRegex: true,
        keywords: KEYWORDS,
        illegal: /(<\/|\?)|=>/,
        contains: [
          PROMPT,
          NUMBER,
          {
            // very common convention
            scope: "variable.language",
            match: /\bself\b/
          },
          {
            // eat "if" prior to string so that it won't accidentally be
            // labeled as an f-string
            beginKeywords: "if",
            relevance: 0
          },
          { match: /\bor\b/, scope: "keyword" },
          STRING,
          COMMENT_TYPE,
          hljs.HASH_COMMENT_MODE,
          {
            match: [
              /\bdef/,
              /\s+/,
              IDENT_RE
            ],
            scope: {
              1: "keyword",
              3: "title.function"
            },
            contains: [PARAMS]
          },
          {
            variants: [
              {
                match: [
                  /\bclass/,
                  /\s+/,
                  IDENT_RE,
                  /\s*/,
                  /\(\s*/,
                  IDENT_RE,
                  /\s*\)/
                ]
              },
              {
                match: [
                  /\bclass/,
                  /\s+/,
                  IDENT_RE
                ]
              }
            ],
            scope: {
              1: "keyword",
              3: "title.class",
              6: "title.class.inherited"
            }
          },
          {
            className: "meta",
            begin: /^[\t ]*@/,
            end: /(?=#)|$/,
            contains: [
              NUMBER,
              PARAMS,
              STRING
            ]
          }
        ]
      };
    }
    module.exports = python;
  }
});

// node_modules/highlight.js/lib/languages/python-repl.js
var require_python_repl = __commonJS({
  "node_modules/highlight.js/lib/languages/python-repl.js"(exports, module) {
    "use strict";
    function pythonRepl(hljs) {
      return {
        aliases: ["pycon"],
        contains: [
          {
            className: "meta.prompt",
            starts: {
              // a space separates the REPL prefix from the actual code
              // this is purely for cleaner HTML output
              end: / |$/,
              starts: {
                end: "$",
                subLanguage: "python"
              }
            },
            variants: [
              { begin: /^>>>(?=[ ]|$)/ },
              { begin: /^\.\.\.(?=[ ]|$)/ }
            ]
          }
        ]
      };
    }
    module.exports = pythonRepl;
  }
});

// node_modules/highlight.js/lib/languages/r.js
var require_r = __commonJS({
  "node_modules/highlight.js/lib/languages/r.js"(exports, module) {
    "use strict";
    function r3(hljs) {
      const regex = hljs.regex;
      const IDENT_RE = /(?:(?:[a-zA-Z]|\.[._a-zA-Z])[._a-zA-Z0-9]*)|\.(?!\d)/;
      const NUMBER_TYPES_RE = regex.either(
        // Special case: only hexadecimal binary powers can contain fractions
        /0[xX][0-9a-fA-F]+\.[0-9a-fA-F]*[pP][+-]?\d+i?/,
        // Hexadecimal numbers without fraction and optional binary power
        /0[xX][0-9a-fA-F]+(?:[pP][+-]?\d+)?[Li]?/,
        // Decimal numbers
        /(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?[Li]?/
      );
      const OPERATORS_RE = /[=!<>:]=|\|\||&&|:::?|<-|<<-|->>|->|\|>|[-+*\/?!$&|:<=>@^~]|\*\*/;
      const PUNCTUATION_RE = regex.either(
        /[()]/,
        /[{}]/,
        /\[\[/,
        /[[\]]/,
        /\\/,
        /,/
      );
      return {
        name: "R",
        keywords: {
          $pattern: IDENT_RE,
          keyword: "function if in break next repeat else for while",
          literal: "NULL NA TRUE FALSE Inf NaN NA_integer_|10 NA_real_|10 NA_character_|10 NA_complex_|10",
          built_in: (
            // Builtin constants
            "LETTERS letters month.abb month.name pi T F abs acos acosh all any anyNA Arg as.call as.character as.complex as.double as.environment as.integer as.logical as.null.default as.numeric as.raw asin asinh atan atanh attr attributes baseenv browser c call ceiling class Conj cos cosh cospi cummax cummin cumprod cumsum digamma dim dimnames emptyenv exp expression floor forceAndCall gamma gc.time globalenv Im interactive invisible is.array is.atomic is.call is.character is.complex is.double is.environment is.expression is.finite is.function is.infinite is.integer is.language is.list is.logical is.matrix is.na is.name is.nan is.null is.numeric is.object is.pairlist is.raw is.recursive is.single is.symbol lazyLoadDBfetch length lgamma list log max min missing Mod names nargs nzchar oldClass on.exit pos.to.env proc.time prod quote range Re rep retracemem return round seq_along seq_len seq.int sign signif sin sinh sinpi sqrt standardGeneric substitute sum switch tan tanh tanpi tracemem trigamma trunc unclass untracemem UseMethod xtfrm"
          )
        },
        contains: [
          // Roxygen comments
          hljs.COMMENT(
            /#'/,
            /$/,
            { contains: [
              {
                // Handle `@examples` separately to cause all subsequent code
                // until the next `@`-tag on its own line to be kept as-is,
                // preventing highlighting. This code is example R code, so nested
                // doctags shouldn’t be treated as such. See
                // `test/markup/r/roxygen.txt` for an example.
                scope: "doctag",
                match: /@examples/,
                starts: {
                  end: regex.lookahead(regex.either(
                    // end if another doc comment
                    /\n^#'\s*(?=@[a-zA-Z]+)/,
                    // or a line with no comment
                    /\n^(?!#')/
                  )),
                  endsParent: true
                }
              },
              {
                // Handle `@param` to highlight the parameter name following
                // after.
                scope: "doctag",
                begin: "@param",
                end: /$/,
                contains: [
                  {
                    scope: "variable",
                    variants: [
                      { match: IDENT_RE },
                      { match: /`(?:\\.|[^`\\])+`/ }
                    ],
                    endsParent: true
                  }
                ]
              },
              {
                scope: "doctag",
                match: /@[a-zA-Z]+/
              },
              {
                scope: "keyword",
                match: /\\[a-zA-Z]+/
              }
            ] }
          ),
          hljs.HASH_COMMENT_MODE,
          {
            scope: "string",
            contains: [hljs.BACKSLASH_ESCAPE],
            variants: [
              hljs.END_SAME_AS_BEGIN({
                begin: /[rR]"(-*)\(/,
                end: /\)(-*)"/
              }),
              hljs.END_SAME_AS_BEGIN({
                begin: /[rR]"(-*)\{/,
                end: /\}(-*)"/
              }),
              hljs.END_SAME_AS_BEGIN({
                begin: /[rR]"(-*)\[/,
                end: /\](-*)"/
              }),
              hljs.END_SAME_AS_BEGIN({
                begin: /[rR]'(-*)\(/,
                end: /\)(-*)'/
              }),
              hljs.END_SAME_AS_BEGIN({
                begin: /[rR]'(-*)\{/,
                end: /\}(-*)'/
              }),
              hljs.END_SAME_AS_BEGIN({
                begin: /[rR]'(-*)\[/,
                end: /\](-*)'/
              }),
              {
                begin: '"',
                end: '"',
                relevance: 0
              },
              {
                begin: "'",
                end: "'",
                relevance: 0
              }
            ]
          },
          // Matching numbers immediately following punctuation and operators is
          // tricky since we need to look at the character ahead of a number to
          // ensure the number is not part of an identifier, and we cannot use
          // negative look-behind assertions. So instead we explicitly handle all
          // possible combinations of (operator|punctuation), number.
          // TODO: replace with negative look-behind when available
          // { begin: /(?<![a-zA-Z0-9._])0[xX][0-9a-fA-F]+\.[0-9a-fA-F]*[pP][+-]?\d+i?/ },
          // { begin: /(?<![a-zA-Z0-9._])0[xX][0-9a-fA-F]+([pP][+-]?\d+)?[Li]?/ },
          // { begin: /(?<![a-zA-Z0-9._])(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?[Li]?/ }
          {
            relevance: 0,
            variants: [
              {
                scope: {
                  1: "operator",
                  2: "number"
                },
                match: [
                  OPERATORS_RE,
                  NUMBER_TYPES_RE
                ]
              },
              {
                scope: {
                  1: "operator",
                  2: "number"
                },
                match: [
                  /%[^%]*%/,
                  NUMBER_TYPES_RE
                ]
              },
              {
                scope: {
                  1: "punctuation",
                  2: "number"
                },
                match: [
                  PUNCTUATION_RE,
                  NUMBER_TYPES_RE
                ]
              },
              {
                scope: { 2: "number" },
                match: [
                  /[^a-zA-Z0-9._]|^/,
                  // not part of an identifier, or start of document
                  NUMBER_TYPES_RE
                ]
              }
            ]
          },
          // Operators/punctuation when they're not directly followed by numbers
          {
            // Relevance boost for the most common assignment form.
            scope: { 3: "operator" },
            match: [
              IDENT_RE,
              /\s+/,
              /<-/,
              /\s+/
            ]
          },
          {
            scope: "operator",
            relevance: 0,
            variants: [
              { match: OPERATORS_RE },
              { match: /%[^%]*%/ }
            ]
          },
          {
            scope: "punctuation",
            relevance: 0,
            match: PUNCTUATION_RE
          },
          {
            // Escaped identifier
            begin: "`",
            end: "`",
            contains: [{ begin: /\\./ }]
          }
        ]
      };
    }
    module.exports = r3;
  }
});

// node_modules/highlight.js/lib/languages/rust.js
var require_rust = __commonJS({
  "node_modules/highlight.js/lib/languages/rust.js"(exports, module) {
    "use strict";
    function rust(hljs) {
      const regex = hljs.regex;
      const RAW_IDENTIFIER = /(r#)?/;
      const UNDERSCORE_IDENT_RE = regex.concat(RAW_IDENTIFIER, hljs.UNDERSCORE_IDENT_RE);
      const IDENT_RE = regex.concat(RAW_IDENTIFIER, hljs.IDENT_RE);
      const FUNCTION_INVOKE = {
        className: "title.function.invoke",
        relevance: 0,
        begin: regex.concat(
          /\b/,
          /(?!let|for|while|if|else|match\b)/,
          IDENT_RE,
          regex.lookahead(/\s*\(/)
        )
      };
      const NUMBER_SUFFIX = "([ui](8|16|32|64|128|size)|f(32|64))?";
      const KEYWORDS = [
        "abstract",
        "as",
        "async",
        "await",
        "become",
        "box",
        "break",
        "const",
        "continue",
        "crate",
        "do",
        "dyn",
        "else",
        "enum",
        "extern",
        "false",
        "final",
        "fn",
        "for",
        "if",
        "impl",
        "in",
        "let",
        "loop",
        "macro",
        "match",
        "mod",
        "move",
        "mut",
        "override",
        "priv",
        "pub",
        "ref",
        "return",
        "self",
        "Self",
        "static",
        "struct",
        "super",
        "trait",
        "true",
        "try",
        "type",
        "typeof",
        "union",
        "unsafe",
        "unsized",
        "use",
        "virtual",
        "where",
        "while",
        "yield"
      ];
      const LITERALS = [
        "true",
        "false",
        "Some",
        "None",
        "Ok",
        "Err"
      ];
      const BUILTINS = [
        // functions
        "drop ",
        // traits
        "Copy",
        "Send",
        "Sized",
        "Sync",
        "Drop",
        "Fn",
        "FnMut",
        "FnOnce",
        "ToOwned",
        "Clone",
        "Debug",
        "PartialEq",
        "PartialOrd",
        "Eq",
        "Ord",
        "AsRef",
        "AsMut",
        "Into",
        "From",
        "Default",
        "Iterator",
        "Extend",
        "IntoIterator",
        "DoubleEndedIterator",
        "ExactSizeIterator",
        "SliceConcatExt",
        "ToString",
        // macros
        "assert!",
        "assert_eq!",
        "bitflags!",
        "bytes!",
        "cfg!",
        "col!",
        "concat!",
        "concat_idents!",
        "debug_assert!",
        "debug_assert_eq!",
        "env!",
        "eprintln!",
        "panic!",
        "file!",
        "format!",
        "format_args!",
        "include_bytes!",
        "include_str!",
        "line!",
        "local_data_key!",
        "module_path!",
        "option_env!",
        "print!",
        "println!",
        "select!",
        "stringify!",
        "try!",
        "unimplemented!",
        "unreachable!",
        "vec!",
        "write!",
        "writeln!",
        "macro_rules!",
        "assert_ne!",
        "debug_assert_ne!"
      ];
      const TYPES = [
        "i8",
        "i16",
        "i32",
        "i64",
        "i128",
        "isize",
        "u8",
        "u16",
        "u32",
        "u64",
        "u128",
        "usize",
        "f32",
        "f64",
        "str",
        "char",
        "bool",
        "Box",
        "Option",
        "Result",
        "String",
        "Vec"
      ];
      return {
        name: "Rust",
        aliases: ["rs"],
        keywords: {
          $pattern: hljs.IDENT_RE + "!?",
          type: TYPES,
          keyword: KEYWORDS,
          literal: LITERALS,
          built_in: BUILTINS
        },
        illegal: "</",
        contains: [
          hljs.C_LINE_COMMENT_MODE,
          hljs.COMMENT("/\\*", "\\*/", { contains: ["self"] }),
          hljs.inherit(hljs.QUOTE_STRING_MODE, {
            begin: /b?"/,
            illegal: null
          }),
          {
            className: "symbol",
            // negative lookahead to avoid matching `'`
            begin: /'[a-zA-Z_][a-zA-Z0-9_]*(?!')/
          },
          {
            scope: "string",
            variants: [
              { begin: /b?r(#*)"(.|\n)*?"\1(?!#)/ },
              {
                begin: /b?'/,
                end: /'/,
                contains: [
                  {
                    scope: "char.escape",
                    match: /\\('|\w|x\w{2}|u\w{4}|U\w{8})/
                  }
                ]
              }
            ]
          },
          {
            className: "number",
            variants: [
              { begin: "\\b0b([01_]+)" + NUMBER_SUFFIX },
              { begin: "\\b0o([0-7_]+)" + NUMBER_SUFFIX },
              { begin: "\\b0x([A-Fa-f0-9_]+)" + NUMBER_SUFFIX },
              { begin: "\\b(\\d[\\d_]*(\\.[0-9_]+)?([eE][+-]?[0-9_]+)?)" + NUMBER_SUFFIX }
            ],
            relevance: 0
          },
          {
            begin: [
              /fn/,
              /\s+/,
              UNDERSCORE_IDENT_RE
            ],
            className: {
              1: "keyword",
              3: "title.function"
            }
          },
          {
            className: "meta",
            begin: "#!?\\[",
            end: "\\]",
            contains: [
              {
                className: "string",
                begin: /"/,
                end: /"/,
                contains: [
                  hljs.BACKSLASH_ESCAPE
                ]
              }
            ]
          },
          {
            begin: [
              /let/,
              /\s+/,
              /(?:mut\s+)?/,
              UNDERSCORE_IDENT_RE
            ],
            className: {
              1: "keyword",
              3: "keyword",
              4: "variable"
            }
          },
          // must come before impl/for rule later
          {
            begin: [
              /for/,
              /\s+/,
              UNDERSCORE_IDENT_RE,
              /\s+/,
              /in/
            ],
            className: {
              1: "keyword",
              3: "variable",
              5: "keyword"
            }
          },
          {
            begin: [
              /type/,
              /\s+/,
              UNDERSCORE_IDENT_RE
            ],
            className: {
              1: "keyword",
              3: "title.class"
            }
          },
          {
            begin: [
              /(?:trait|enum|struct|union|impl|for)/,
              /\s+/,
              UNDERSCORE_IDENT_RE
            ],
            className: {
              1: "keyword",
              3: "title.class"
            }
          },
          {
            begin: hljs.IDENT_RE + "::",
            keywords: {
              keyword: "Self",
              built_in: BUILTINS,
              type: TYPES
            }
          },
          {
            className: "punctuation",
            begin: "->"
          },
          FUNCTION_INVOKE
        ]
      };
    }
    module.exports = rust;
  }
});

// node_modules/highlight.js/lib/languages/scss.js
var require_scss = __commonJS({
  "node_modules/highlight.js/lib/languages/scss.js"(exports, module) {
    "use strict";
    var MODES = (hljs) => {
      return {
        IMPORTANT: {
          scope: "meta",
          begin: "!important"
        },
        BLOCK_COMMENT: hljs.C_BLOCK_COMMENT_MODE,
        HEXCOLOR: {
          scope: "number",
          begin: /#(([0-9a-fA-F]{3,4})|(([0-9a-fA-F]{2}){3,4}))\b/
        },
        FUNCTION_DISPATCH: {
          className: "built_in",
          begin: /[\w-]+(?=\()/
        },
        ATTRIBUTE_SELECTOR_MODE: {
          scope: "selector-attr",
          begin: /\[/,
          end: /\]/,
          illegal: "$",
          contains: [
            hljs.APOS_STRING_MODE,
            hljs.QUOTE_STRING_MODE
          ]
        },
        CSS_NUMBER_MODE: {
          scope: "number",
          begin: hljs.NUMBER_RE + "(%|em|ex|ch|rem|vw|vh|vmin|vmax|cm|mm|in|pt|pc|px|deg|grad|rad|turn|s|ms|Hz|kHz|dpi|dpcm|dppx)?",
          relevance: 0
        },
        CSS_VARIABLE: {
          className: "attr",
          begin: /--[A-Za-z_][A-Za-z0-9_-]*/
        }
      };
    };
    var HTML_TAGS = [
      "a",
      "abbr",
      "address",
      "article",
      "aside",
      "audio",
      "b",
      "blockquote",
      "body",
      "button",
      "canvas",
      "caption",
      "cite",
      "code",
      "dd",
      "del",
      "details",
      "dfn",
      "div",
      "dl",
      "dt",
      "em",
      "fieldset",
      "figcaption",
      "figure",
      "footer",
      "form",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "header",
      "hgroup",
      "html",
      "i",
      "iframe",
      "img",
      "input",
      "ins",
      "kbd",
      "label",
      "legend",
      "li",
      "main",
      "mark",
      "menu",
      "nav",
      "object",
      "ol",
      "optgroup",
      "option",
      "p",
      "picture",
      "q",
      "quote",
      "samp",
      "section",
      "select",
      "source",
      "span",
      "strong",
      "summary",
      "sup",
      "table",
      "tbody",
      "td",
      "textarea",
      "tfoot",
      "th",
      "thead",
      "time",
      "tr",
      "ul",
      "var",
      "video"
    ];
    var SVG_TAGS = [
      "defs",
      "g",
      "marker",
      "mask",
      "pattern",
      "svg",
      "switch",
      "symbol",
      "feBlend",
      "feColorMatrix",
      "feComponentTransfer",
      "feComposite",
      "feConvolveMatrix",
      "feDiffuseLighting",
      "feDisplacementMap",
      "feFlood",
      "feGaussianBlur",
      "feImage",
      "feMerge",
      "feMorphology",
      "feOffset",
      "feSpecularLighting",
      "feTile",
      "feTurbulence",
      "linearGradient",
      "radialGradient",
      "stop",
      "circle",
      "ellipse",
      "image",
      "line",
      "path",
      "polygon",
      "polyline",
      "rect",
      "text",
      "use",
      "textPath",
      "tspan",
      "foreignObject",
      "clipPath"
    ];
    var TAGS = [
      ...HTML_TAGS,
      ...SVG_TAGS
    ];
    var MEDIA_FEATURES = [
      "any-hover",
      "any-pointer",
      "aspect-ratio",
      "color",
      "color-gamut",
      "color-index",
      "device-aspect-ratio",
      "device-height",
      "device-width",
      "display-mode",
      "forced-colors",
      "grid",
      "height",
      "hover",
      "inverted-colors",
      "monochrome",
      "orientation",
      "overflow-block",
      "overflow-inline",
      "pointer",
      "prefers-color-scheme",
      "prefers-contrast",
      "prefers-reduced-motion",
      "prefers-reduced-transparency",
      "resolution",
      "scan",
      "scripting",
      "update",
      "width",
      // TODO: find a better solution?
      "min-width",
      "max-width",
      "min-height",
      "max-height"
    ].sort().reverse();
    var PSEUDO_CLASSES = [
      "active",
      "any-link",
      "blank",
      "checked",
      "current",
      "default",
      "defined",
      "dir",
      // dir()
      "disabled",
      "drop",
      "empty",
      "enabled",
      "first",
      "first-child",
      "first-of-type",
      "fullscreen",
      "future",
      "focus",
      "focus-visible",
      "focus-within",
      "has",
      // has()
      "host",
      // host or host()
      "host-context",
      // host-context()
      "hover",
      "indeterminate",
      "in-range",
      "invalid",
      "is",
      // is()
      "lang",
      // lang()
      "last-child",
      "last-of-type",
      "left",
      "link",
      "local-link",
      "not",
      // not()
      "nth-child",
      // nth-child()
      "nth-col",
      // nth-col()
      "nth-last-child",
      // nth-last-child()
      "nth-last-col",
      // nth-last-col()
      "nth-last-of-type",
      //nth-last-of-type()
      "nth-of-type",
      //nth-of-type()
      "only-child",
      "only-of-type",
      "optional",
      "out-of-range",
      "past",
      "placeholder-shown",
      "read-only",
      "read-write",
      "required",
      "right",
      "root",
      "scope",
      "target",
      "target-within",
      "user-invalid",
      "valid",
      "visited",
      "where"
      // where()
    ].sort().reverse();
    var PSEUDO_ELEMENTS = [
      "after",
      "backdrop",
      "before",
      "cue",
      "cue-region",
      "first-letter",
      "first-line",
      "grammar-error",
      "marker",
      "part",
      "placeholder",
      "selection",
      "slotted",
      "spelling-error"
    ].sort().reverse();
    var ATTRIBUTES = [
      "accent-color",
      "align-content",
      "align-items",
      "align-self",
      "alignment-baseline",
      "all",
      "anchor-name",
      "animation",
      "animation-composition",
      "animation-delay",
      "animation-direction",
      "animation-duration",
      "animation-fill-mode",
      "animation-iteration-count",
      "animation-name",
      "animation-play-state",
      "animation-range",
      "animation-range-end",
      "animation-range-start",
      "animation-timeline",
      "animation-timing-function",
      "appearance",
      "aspect-ratio",
      "backdrop-filter",
      "backface-visibility",
      "background",
      "background-attachment",
      "background-blend-mode",
      "background-clip",
      "background-color",
      "background-image",
      "background-origin",
      "background-position",
      "background-position-x",
      "background-position-y",
      "background-repeat",
      "background-size",
      "baseline-shift",
      "block-size",
      "border",
      "border-block",
      "border-block-color",
      "border-block-end",
      "border-block-end-color",
      "border-block-end-style",
      "border-block-end-width",
      "border-block-start",
      "border-block-start-color",
      "border-block-start-style",
      "border-block-start-width",
      "border-block-style",
      "border-block-width",
      "border-bottom",
      "border-bottom-color",
      "border-bottom-left-radius",
      "border-bottom-right-radius",
      "border-bottom-style",
      "border-bottom-width",
      "border-collapse",
      "border-color",
      "border-end-end-radius",
      "border-end-start-radius",
      "border-image",
      "border-image-outset",
      "border-image-repeat",
      "border-image-slice",
      "border-image-source",
      "border-image-width",
      "border-inline",
      "border-inline-color",
      "border-inline-end",
      "border-inline-end-color",
      "border-inline-end-style",
      "border-inline-end-width",
      "border-inline-start",
      "border-inline-start-color",
      "border-inline-start-style",
      "border-inline-start-width",
      "border-inline-style",
      "border-inline-width",
      "border-left",
      "border-left-color",
      "border-left-style",
      "border-left-width",
      "border-radius",
      "border-right",
      "border-right-color",
      "border-right-style",
      "border-right-width",
      "border-spacing",
      "border-start-end-radius",
      "border-start-start-radius",
      "border-style",
      "border-top",
      "border-top-color",
      "border-top-left-radius",
      "border-top-right-radius",
      "border-top-style",
      "border-top-width",
      "border-width",
      "bottom",
      "box-align",
      "box-decoration-break",
      "box-direction",
      "box-flex",
      "box-flex-group",
      "box-lines",
      "box-ordinal-group",
      "box-orient",
      "box-pack",
      "box-shadow",
      "box-sizing",
      "break-after",
      "break-before",
      "break-inside",
      "caption-side",
      "caret-color",
      "clear",
      "clip",
      "clip-path",
      "clip-rule",
      "color",
      "color-interpolation",
      "color-interpolation-filters",
      "color-profile",
      "color-rendering",
      "color-scheme",
      "column-count",
      "column-fill",
      "column-gap",
      "column-rule",
      "column-rule-color",
      "column-rule-style",
      "column-rule-width",
      "column-span",
      "column-width",
      "columns",
      "contain",
      "contain-intrinsic-block-size",
      "contain-intrinsic-height",
      "contain-intrinsic-inline-size",
      "contain-intrinsic-size",
      "contain-intrinsic-width",
      "container",
      "container-name",
      "container-type",
      "content",
      "content-visibility",
      "counter-increment",
      "counter-reset",
      "counter-set",
      "cue",
      "cue-after",
      "cue-before",
      "cursor",
      "cx",
      "cy",
      "direction",
      "display",
      "dominant-baseline",
      "empty-cells",
      "enable-background",
      "field-sizing",
      "fill",
      "fill-opacity",
      "fill-rule",
      "filter",
      "flex",
      "flex-basis",
      "flex-direction",
      "flex-flow",
      "flex-grow",
      "flex-shrink",
      "flex-wrap",
      "float",
      "flood-color",
      "flood-opacity",
      "flow",
      "font",
      "font-display",
      "font-family",
      "font-feature-settings",
      "font-kerning",
      "font-language-override",
      "font-optical-sizing",
      "font-palette",
      "font-size",
      "font-size-adjust",
      "font-smooth",
      "font-smoothing",
      "font-stretch",
      "font-style",
      "font-synthesis",
      "font-synthesis-position",
      "font-synthesis-small-caps",
      "font-synthesis-style",
      "font-synthesis-weight",
      "font-variant",
      "font-variant-alternates",
      "font-variant-caps",
      "font-variant-east-asian",
      "font-variant-emoji",
      "font-variant-ligatures",
      "font-variant-numeric",
      "font-variant-position",
      "font-variation-settings",
      "font-weight",
      "forced-color-adjust",
      "gap",
      "glyph-orientation-horizontal",
      "glyph-orientation-vertical",
      "grid",
      "grid-area",
      "grid-auto-columns",
      "grid-auto-flow",
      "grid-auto-rows",
      "grid-column",
      "grid-column-end",
      "grid-column-start",
      "grid-gap",
      "grid-row",
      "grid-row-end",
      "grid-row-start",
      "grid-template",
      "grid-template-areas",
      "grid-template-columns",
      "grid-template-rows",
      "hanging-punctuation",
      "height",
      "hyphenate-character",
      "hyphenate-limit-chars",
      "hyphens",
      "icon",
      "image-orientation",
      "image-rendering",
      "image-resolution",
      "ime-mode",
      "initial-letter",
      "initial-letter-align",
      "inline-size",
      "inset",
      "inset-area",
      "inset-block",
      "inset-block-end",
      "inset-block-start",
      "inset-inline",
      "inset-inline-end",
      "inset-inline-start",
      "isolation",
      "justify-content",
      "justify-items",
      "justify-self",
      "kerning",
      "left",
      "letter-spacing",
      "lighting-color",
      "line-break",
      "line-height",
      "line-height-step",
      "list-style",
      "list-style-image",
      "list-style-position",
      "list-style-type",
      "margin",
      "margin-block",
      "margin-block-end",
      "margin-block-start",
      "margin-bottom",
      "margin-inline",
      "margin-inline-end",
      "margin-inline-start",
      "margin-left",
      "margin-right",
      "margin-top",
      "margin-trim",
      "marker",
      "marker-end",
      "marker-mid",
      "marker-start",
      "marks",
      "mask",
      "mask-border",
      "mask-border-mode",
      "mask-border-outset",
      "mask-border-repeat",
      "mask-border-slice",
      "mask-border-source",
      "mask-border-width",
      "mask-clip",
      "mask-composite",
      "mask-image",
      "mask-mode",
      "mask-origin",
      "mask-position",
      "mask-repeat",
      "mask-size",
      "mask-type",
      "masonry-auto-flow",
      "math-depth",
      "math-shift",
      "math-style",
      "max-block-size",
      "max-height",
      "max-inline-size",
      "max-width",
      "min-block-size",
      "min-height",
      "min-inline-size",
      "min-width",
      "mix-blend-mode",
      "nav-down",
      "nav-index",
      "nav-left",
      "nav-right",
      "nav-up",
      "none",
      "normal",
      "object-fit",
      "object-position",
      "offset",
      "offset-anchor",
      "offset-distance",
      "offset-path",
      "offset-position",
      "offset-rotate",
      "opacity",
      "order",
      "orphans",
      "outline",
      "outline-color",
      "outline-offset",
      "outline-style",
      "outline-width",
      "overflow",
      "overflow-anchor",
      "overflow-block",
      "overflow-clip-margin",
      "overflow-inline",
      "overflow-wrap",
      "overflow-x",
      "overflow-y",
      "overlay",
      "overscroll-behavior",
      "overscroll-behavior-block",
      "overscroll-behavior-inline",
      "overscroll-behavior-x",
      "overscroll-behavior-y",
      "padding",
      "padding-block",
      "padding-block-end",
      "padding-block-start",
      "padding-bottom",
      "padding-inline",
      "padding-inline-end",
      "padding-inline-start",
      "padding-left",
      "padding-right",
      "padding-top",
      "page",
      "page-break-after",
      "page-break-before",
      "page-break-inside",
      "paint-order",
      "pause",
      "pause-after",
      "pause-before",
      "perspective",
      "perspective-origin",
      "place-content",
      "place-items",
      "place-self",
      "pointer-events",
      "position",
      "position-anchor",
      "position-visibility",
      "print-color-adjust",
      "quotes",
      "r",
      "resize",
      "rest",
      "rest-after",
      "rest-before",
      "right",
      "rotate",
      "row-gap",
      "ruby-align",
      "ruby-position",
      "scale",
      "scroll-behavior",
      "scroll-margin",
      "scroll-margin-block",
      "scroll-margin-block-end",
      "scroll-margin-block-start",
      "scroll-margin-bottom",
      "scroll-margin-inline",
      "scroll-margin-inline-end",
      "scroll-margin-inline-start",
      "scroll-margin-left",
      "scroll-margin-right",
      "scroll-margin-top",
      "scroll-padding",
      "scroll-padding-block",
      "scroll-padding-block-end",
      "scroll-padding-block-start",
      "scroll-padding-bottom",
      "scroll-padding-inline",
      "scroll-padding-inline-end",
      "scroll-padding-inline-start",
      "scroll-padding-left",
      "scroll-padding-right",
      "scroll-padding-top",
      "scroll-snap-align",
      "scroll-snap-stop",
      "scroll-snap-type",
      "scroll-timeline",
      "scroll-timeline-axis",
      "scroll-timeline-name",
      "scrollbar-color",
      "scrollbar-gutter",
      "scrollbar-width",
      "shape-image-threshold",
      "shape-margin",
      "shape-outside",
      "shape-rendering",
      "speak",
      "speak-as",
      "src",
      // @font-face
      "stop-color",
      "stop-opacity",
      "stroke",
      "stroke-dasharray",
      "stroke-dashoffset",
      "stroke-linecap",
      "stroke-linejoin",
      "stroke-miterlimit",
      "stroke-opacity",
      "stroke-width",
      "tab-size",
      "table-layout",
      "text-align",
      "text-align-all",
      "text-align-last",
      "text-anchor",
      "text-combine-upright",
      "text-decoration",
      "text-decoration-color",
      "text-decoration-line",
      "text-decoration-skip",
      "text-decoration-skip-ink",
      "text-decoration-style",
      "text-decoration-thickness",
      "text-emphasis",
      "text-emphasis-color",
      "text-emphasis-position",
      "text-emphasis-style",
      "text-indent",
      "text-justify",
      "text-orientation",
      "text-overflow",
      "text-rendering",
      "text-shadow",
      "text-size-adjust",
      "text-transform",
      "text-underline-offset",
      "text-underline-position",
      "text-wrap",
      "text-wrap-mode",
      "text-wrap-style",
      "timeline-scope",
      "top",
      "touch-action",
      "transform",
      "transform-box",
      "transform-origin",
      "transform-style",
      "transition",
      "transition-behavior",
      "transition-delay",
      "transition-duration",
      "transition-property",
      "transition-timing-function",
      "translate",
      "unicode-bidi",
      "user-modify",
      "user-select",
      "vector-effect",
      "vertical-align",
      "view-timeline",
      "view-timeline-axis",
      "view-timeline-inset",
      "view-timeline-name",
      "view-transition-name",
      "visibility",
      "voice-balance",
      "voice-duration",
      "voice-family",
      "voice-pitch",
      "voice-range",
      "voice-rate",
      "voice-stress",
      "voice-volume",
      "white-space",
      "white-space-collapse",
      "widows",
      "width",
      "will-change",
      "word-break",
      "word-spacing",
      "word-wrap",
      "writing-mode",
      "x",
      "y",
      "z-index",
      "zoom"
    ].sort().reverse();
    function scss(hljs) {
      const modes = MODES(hljs);
      const PSEUDO_ELEMENTS$1 = PSEUDO_ELEMENTS;
      const PSEUDO_CLASSES$1 = PSEUDO_CLASSES;
      const AT_IDENTIFIER = "@[a-z-]+";
      const AT_MODIFIERS = "and or not only";
      const IDENT_RE = "[a-zA-Z-][a-zA-Z0-9_-]*";
      const VARIABLE = {
        className: "variable",
        begin: "(\\$" + IDENT_RE + ")\\b",
        relevance: 0
      };
      return {
        name: "SCSS",
        case_insensitive: true,
        illegal: "[=/|']",
        contains: [
          hljs.C_LINE_COMMENT_MODE,
          hljs.C_BLOCK_COMMENT_MODE,
          // to recognize keyframe 40% etc which are outside the scope of our
          // attribute value mode
          modes.CSS_NUMBER_MODE,
          {
            className: "selector-id",
            begin: "#[A-Za-z0-9_-]+",
            relevance: 0
          },
          {
            className: "selector-class",
            begin: "\\.[A-Za-z0-9_-]+",
            relevance: 0
          },
          modes.ATTRIBUTE_SELECTOR_MODE,
          {
            className: "selector-tag",
            begin: "\\b(" + TAGS.join("|") + ")\\b",
            // was there, before, but why?
            relevance: 0
          },
          {
            className: "selector-pseudo",
            begin: ":(" + PSEUDO_CLASSES$1.join("|") + ")"
          },
          {
            className: "selector-pseudo",
            begin: ":(:)?(" + PSEUDO_ELEMENTS$1.join("|") + ")"
          },
          VARIABLE,
          {
            // pseudo-selector params
            begin: /\(/,
            end: /\)/,
            contains: [modes.CSS_NUMBER_MODE]
          },
          modes.CSS_VARIABLE,
          {
            className: "attribute",
            begin: "\\b(" + ATTRIBUTES.join("|") + ")\\b"
          },
          { begin: "\\b(whitespace|wait|w-resize|visible|vertical-text|vertical-ideographic|uppercase|upper-roman|upper-alpha|underline|transparent|top|thin|thick|text|text-top|text-bottom|tb-rl|table-header-group|table-footer-group|sw-resize|super|strict|static|square|solid|small-caps|separate|se-resize|scroll|s-resize|rtl|row-resize|ridge|right|repeat|repeat-y|repeat-x|relative|progress|pointer|overline|outside|outset|oblique|nowrap|not-allowed|normal|none|nw-resize|no-repeat|no-drop|newspaper|ne-resize|n-resize|move|middle|medium|ltr|lr-tb|lowercase|lower-roman|lower-alpha|loose|list-item|line|line-through|line-edge|lighter|left|keep-all|justify|italic|inter-word|inter-ideograph|inside|inset|inline|inline-block|inherit|inactive|ideograph-space|ideograph-parenthesis|ideograph-numeric|ideograph-alpha|horizontal|hidden|help|hand|groove|fixed|ellipsis|e-resize|double|dotted|distribute|distribute-space|distribute-letter|distribute-all-lines|disc|disabled|default|decimal|dashed|crosshair|collapse|col-resize|circle|char|center|capitalize|break-word|break-all|bottom|both|bolder|bold|block|bidi-override|below|baseline|auto|always|all-scroll|absolute|table|table-cell)\\b" },
          {
            begin: /:/,
            end: /[;}{]/,
            relevance: 0,
            contains: [
              modes.BLOCK_COMMENT,
              VARIABLE,
              modes.HEXCOLOR,
              modes.CSS_NUMBER_MODE,
              hljs.QUOTE_STRING_MODE,
              hljs.APOS_STRING_MODE,
              modes.IMPORTANT,
              modes.FUNCTION_DISPATCH
            ]
          },
          // matching these here allows us to treat them more like regular CSS
          // rules so everything between the {} gets regular rule highlighting,
          // which is what we want for page and font-face
          {
            begin: "@(page|font-face)",
            keywords: {
              $pattern: AT_IDENTIFIER,
              keyword: "@page @font-face"
            }
          },
          {
            begin: "@",
            end: "[{;]",
            returnBegin: true,
            keywords: {
              $pattern: /[a-z-]+/,
              keyword: AT_MODIFIERS,
              attribute: MEDIA_FEATURES.join(" ")
            },
            contains: [
              {
                begin: AT_IDENTIFIER,
                className: "keyword"
              },
              {
                begin: /[a-z-]+(?=:)/,
                className: "attribute"
              },
              VARIABLE,
              hljs.QUOTE_STRING_MODE,
              hljs.APOS_STRING_MODE,
              modes.HEXCOLOR,
              modes.CSS_NUMBER_MODE
            ]
          },
          modes.FUNCTION_DISPATCH
        ]
      };
    }
    module.exports = scss;
  }
});

// node_modules/highlight.js/lib/languages/shell.js
var require_shell = __commonJS({
  "node_modules/highlight.js/lib/languages/shell.js"(exports, module) {
    "use strict";
    function shell(hljs) {
      return {
        name: "Shell Session",
        aliases: [
          "console",
          "shellsession"
        ],
        contains: [
          {
            className: "meta.prompt",
            // We cannot add \s (spaces) in the regular expression otherwise it will be too broad and produce unexpected result.
            // For instance, in the following example, it would match "echo /path/to/home >" as a prompt:
            // echo /path/to/home > t.exe
            begin: /^\s{0,3}[/~\w\d[\]()@-]*[>%$#][ ]?/,
            starts: {
              end: /[^\\](?=\s*$)/,
              subLanguage: "bash"
            }
          }
        ]
      };
    }
    module.exports = shell;
  }
});

// node_modules/highlight.js/lib/languages/sql.js
var require_sql = __commonJS({
  "node_modules/highlight.js/lib/languages/sql.js"(exports, module) {
    "use strict";
    function sql(hljs) {
      const regex = hljs.regex;
      const COMMENT_MODE = hljs.COMMENT("--", "$");
      const STRING = {
        scope: "string",
        variants: [
          {
            begin: /'/,
            end: /'/,
            contains: [{ match: /''/ }]
          }
        ]
      };
      const QUOTED_IDENTIFIER = {
        begin: /"/,
        end: /"/,
        contains: [{ match: /""/ }]
      };
      const LITERALS = [
        "true",
        "false",
        // Not sure it's correct to call NULL literal, and clauses like IS [NOT] NULL look strange that way.
        // "null",
        "unknown"
      ];
      const MULTI_WORD_TYPES = [
        "double precision",
        "large object",
        "with timezone",
        "without timezone"
      ];
      const TYPES = [
        "bigint",
        "binary",
        "blob",
        "boolean",
        "char",
        "character",
        "clob",
        "date",
        "dec",
        "decfloat",
        "decimal",
        "float",
        "int",
        "integer",
        "interval",
        "nchar",
        "nclob",
        "national",
        "numeric",
        "real",
        "row",
        "smallint",
        "time",
        "timestamp",
        "varchar",
        "varying",
        // modifier (character varying)
        "varbinary"
      ];
      const NON_RESERVED_WORDS = [
        "add",
        "asc",
        "collation",
        "desc",
        "final",
        "first",
        "last",
        "view"
      ];
      const RESERVED_WORDS = [
        "abs",
        "acos",
        "all",
        "allocate",
        "alter",
        "and",
        "any",
        "are",
        "array",
        "array_agg",
        "array_max_cardinality",
        "as",
        "asensitive",
        "asin",
        "asymmetric",
        "at",
        "atan",
        "atomic",
        "authorization",
        "avg",
        "begin",
        "begin_frame",
        "begin_partition",
        "between",
        "bigint",
        "binary",
        "blob",
        "boolean",
        "both",
        "by",
        "call",
        "called",
        "cardinality",
        "cascaded",
        "case",
        "cast",
        "ceil",
        "ceiling",
        "char",
        "char_length",
        "character",
        "character_length",
        "check",
        "classifier",
        "clob",
        "close",
        "coalesce",
        "collate",
        "collect",
        "column",
        "commit",
        "condition",
        "connect",
        "constraint",
        "contains",
        "convert",
        "copy",
        "corr",
        "corresponding",
        "cos",
        "cosh",
        "count",
        "covar_pop",
        "covar_samp",
        "create",
        "cross",
        "cube",
        "cume_dist",
        "current",
        "current_catalog",
        "current_date",
        "current_default_transform_group",
        "current_path",
        "current_role",
        "current_row",
        "current_schema",
        "current_time",
        "current_timestamp",
        "current_path",
        "current_role",
        "current_transform_group_for_type",
        "current_user",
        "cursor",
        "cycle",
        "date",
        "day",
        "deallocate",
        "dec",
        "decimal",
        "decfloat",
        "declare",
        "default",
        "define",
        "delete",
        "dense_rank",
        "deref",
        "describe",
        "deterministic",
        "disconnect",
        "distinct",
        "double",
        "drop",
        "dynamic",
        "each",
        "element",
        "else",
        "empty",
        "end",
        "end_frame",
        "end_partition",
        "end-exec",
        "equals",
        "escape",
        "every",
        "except",
        "exec",
        "execute",
        "exists",
        "exp",
        "external",
        "extract",
        "false",
        "fetch",
        "filter",
        "first_value",
        "float",
        "floor",
        "for",
        "foreign",
        "frame_row",
        "free",
        "from",
        "full",
        "function",
        "fusion",
        "get",
        "global",
        "grant",
        "group",
        "grouping",
        "groups",
        "having",
        "hold",
        "hour",
        "identity",
        "in",
        "indicator",
        "initial",
        "inner",
        "inout",
        "insensitive",
        "insert",
        "int",
        "integer",
        "intersect",
        "intersection",
        "interval",
        "into",
        "is",
        "join",
        "json_array",
        "json_arrayagg",
        "json_exists",
        "json_object",
        "json_objectagg",
        "json_query",
        "json_table",
        "json_table_primitive",
        "json_value",
        "lag",
        "language",
        "large",
        "last_value",
        "lateral",
        "lead",
        "leading",
        "left",
        "like",
        "like_regex",
        "listagg",
        "ln",
        "local",
        "localtime",
        "localtimestamp",
        "log",
        "log10",
        "lower",
        "match",
        "match_number",
        "match_recognize",
        "matches",
        "max",
        "member",
        "merge",
        "method",
        "min",
        "minute",
        "mod",
        "modifies",
        "module",
        "month",
        "multiset",
        "national",
        "natural",
        "nchar",
        "nclob",
        "new",
        "no",
        "none",
        "normalize",
        "not",
        "nth_value",
        "ntile",
        "null",
        "nullif",
        "numeric",
        "octet_length",
        "occurrences_regex",
        "of",
        "offset",
        "old",
        "omit",
        "on",
        "one",
        "only",
        "open",
        "or",
        "order",
        "out",
        "outer",
        "over",
        "overlaps",
        "overlay",
        "parameter",
        "partition",
        "pattern",
        "per",
        "percent",
        "percent_rank",
        "percentile_cont",
        "percentile_disc",
        "period",
        "portion",
        "position",
        "position_regex",
        "power",
        "precedes",
        "precision",
        "prepare",
        "primary",
        "procedure",
        "ptf",
        "range",
        "rank",
        "reads",
        "real",
        "recursive",
        "ref",
        "references",
        "referencing",
        "regr_avgx",
        "regr_avgy",
        "regr_count",
        "regr_intercept",
        "regr_r2",
        "regr_slope",
        "regr_sxx",
        "regr_sxy",
        "regr_syy",
        "release",
        "result",
        "return",
        "returns",
        "revoke",
        "right",
        "rollback",
        "rollup",
        "row",
        "row_number",
        "rows",
        "running",
        "savepoint",
        "scope",
        "scroll",
        "search",
        "second",
        "seek",
        "select",
        "sensitive",
        "session_user",
        "set",
        "show",
        "similar",
        "sin",
        "sinh",
        "skip",
        "smallint",
        "some",
        "specific",
        "specifictype",
        "sql",
        "sqlexception",
        "sqlstate",
        "sqlwarning",
        "sqrt",
        "start",
        "static",
        "stddev_pop",
        "stddev_samp",
        "submultiset",
        "subset",
        "substring",
        "substring_regex",
        "succeeds",
        "sum",
        "symmetric",
        "system",
        "system_time",
        "system_user",
        "table",
        "tablesample",
        "tan",
        "tanh",
        "then",
        "time",
        "timestamp",
        "timezone_hour",
        "timezone_minute",
        "to",
        "trailing",
        "translate",
        "translate_regex",
        "translation",
        "treat",
        "trigger",
        "trim",
        "trim_array",
        "true",
        "truncate",
        "uescape",
        "union",
        "unique",
        "unknown",
        "unnest",
        "update",
        "upper",
        "user",
        "using",
        "value",
        "values",
        "value_of",
        "var_pop",
        "var_samp",
        "varbinary",
        "varchar",
        "varying",
        "versioning",
        "when",
        "whenever",
        "where",
        "width_bucket",
        "window",
        "with",
        "within",
        "without",
        "year"
      ];
      const RESERVED_FUNCTIONS = [
        "abs",
        "acos",
        "array_agg",
        "asin",
        "atan",
        "avg",
        "cast",
        "ceil",
        "ceiling",
        "coalesce",
        "corr",
        "cos",
        "cosh",
        "count",
        "covar_pop",
        "covar_samp",
        "cume_dist",
        "dense_rank",
        "deref",
        "element",
        "exp",
        "extract",
        "first_value",
        "floor",
        "json_array",
        "json_arrayagg",
        "json_exists",
        "json_object",
        "json_objectagg",
        "json_query",
        "json_table",
        "json_table_primitive",
        "json_value",
        "lag",
        "last_value",
        "lead",
        "listagg",
        "ln",
        "log",
        "log10",
        "lower",
        "max",
        "min",
        "mod",
        "nth_value",
        "ntile",
        "nullif",
        "percent_rank",
        "percentile_cont",
        "percentile_disc",
        "position",
        "position_regex",
        "power",
        "rank",
        "regr_avgx",
        "regr_avgy",
        "regr_count",
        "regr_intercept",
        "regr_r2",
        "regr_slope",
        "regr_sxx",
        "regr_sxy",
        "regr_syy",
        "row_number",
        "sin",
        "sinh",
        "sqrt",
        "stddev_pop",
        "stddev_samp",
        "substring",
        "substring_regex",
        "sum",
        "tan",
        "tanh",
        "translate",
        "translate_regex",
        "treat",
        "trim",
        "trim_array",
        "unnest",
        "upper",
        "value_of",
        "var_pop",
        "var_samp",
        "width_bucket"
      ];
      const POSSIBLE_WITHOUT_PARENS = [
        "current_catalog",
        "current_date",
        "current_default_transform_group",
        "current_path",
        "current_role",
        "current_schema",
        "current_transform_group_for_type",
        "current_user",
        "session_user",
        "system_time",
        "system_user",
        "current_time",
        "localtime",
        "current_timestamp",
        "localtimestamp"
      ];
      const COMBOS = [
        "create table",
        "insert into",
        "primary key",
        "foreign key",
        "not null",
        "alter table",
        "add constraint",
        "grouping sets",
        "on overflow",
        "character set",
        "respect nulls",
        "ignore nulls",
        "nulls first",
        "nulls last",
        "depth first",
        "breadth first"
      ];
      const FUNCTIONS = RESERVED_FUNCTIONS;
      const KEYWORDS = [
        ...RESERVED_WORDS,
        ...NON_RESERVED_WORDS
      ].filter((keyword) => {
        return !RESERVED_FUNCTIONS.includes(keyword);
      });
      const VARIABLE = {
        scope: "variable",
        match: /@[a-z0-9][a-z0-9_]*/
      };
      const OPERATOR = {
        scope: "operator",
        match: /[-+*/=%^~]|&&?|\|\|?|!=?|<(?:=>?|<|>)?|>[>=]?/,
        relevance: 0
      };
      const FUNCTION_CALL = {
        match: regex.concat(/\b/, regex.either(...FUNCTIONS), /\s*\(/),
        relevance: 0,
        keywords: { built_in: FUNCTIONS }
      };
      function kws_to_regex(list2) {
        return regex.concat(
          /\b/,
          regex.either(...list2.map((kw) => {
            return kw.replace(/\s+/, "\\s+");
          })),
          /\b/
        );
      }
      const MULTI_WORD_KEYWORDS = {
        scope: "keyword",
        match: kws_to_regex(COMBOS),
        relevance: 0
      };
      function reduceRelevancy(list2, {
        exceptions,
        when
      } = {}) {
        const qualifyFn = when;
        exceptions = exceptions || [];
        return list2.map((item) => {
          if (item.match(/\|\d+$/) || exceptions.includes(item)) {
            return item;
          } else if (qualifyFn(item)) {
            return `${item}|0`;
          } else {
            return item;
          }
        });
      }
      return {
        name: "SQL",
        case_insensitive: true,
        // does not include {} or HTML tags `</`
        illegal: /[{}]|<\//,
        keywords: {
          $pattern: /\b[\w\.]+/,
          keyword: reduceRelevancy(KEYWORDS, { when: (x3) => x3.length < 3 }),
          literal: LITERALS,
          type: TYPES,
          built_in: POSSIBLE_WITHOUT_PARENS
        },
        contains: [
          {
            scope: "type",
            match: kws_to_regex(MULTI_WORD_TYPES)
          },
          MULTI_WORD_KEYWORDS,
          FUNCTION_CALL,
          VARIABLE,
          STRING,
          QUOTED_IDENTIFIER,
          hljs.C_NUMBER_MODE,
          hljs.C_BLOCK_COMMENT_MODE,
          COMMENT_MODE,
          OPERATOR
        ]
      };
    }
    module.exports = sql;
  }
});

// node_modules/highlight.js/lib/languages/swift.js
var require_swift = __commonJS({
  "node_modules/highlight.js/lib/languages/swift.js"(exports, module) {
    "use strict";
    function source(re) {
      if (!re) return null;
      if (typeof re === "string") return re;
      return re.source;
    }
    function lookahead(re) {
      return concat("(?=", re, ")");
    }
    function concat(...args) {
      const joined = args.map((x3) => source(x3)).join("");
      return joined;
    }
    function stripOptionsFromArgs(args) {
      const opts = args[args.length - 1];
      if (typeof opts === "object" && opts.constructor === Object) {
        args.splice(args.length - 1, 1);
        return opts;
      } else {
        return {};
      }
    }
    function either(...args) {
      const opts = stripOptionsFromArgs(args);
      const joined = "(" + (opts.capture ? "" : "?:") + args.map((x3) => source(x3)).join("|") + ")";
      return joined;
    }
    var keywordWrapper = (keyword) => concat(
      /\b/,
      keyword,
      /\w$/.test(keyword) ? /\b/ : /\B/
    );
    var dotKeywords = [
      "Protocol",
      // contextual
      "Type"
      // contextual
    ].map(keywordWrapper);
    var optionalDotKeywords = [
      "init",
      "self"
    ].map(keywordWrapper);
    var keywordTypes = [
      "Any",
      "Self"
    ];
    var keywords = [
      // strings below will be fed into the regular `keywords` engine while regex
      // will result in additional modes being created to scan for those keywords to
      // avoid conflicts with other rules
      "actor",
      "any",
      // contextual
      "associatedtype",
      "async",
      "await",
      /as\?/,
      // operator
      /as!/,
      // operator
      "as",
      // operator
      "borrowing",
      // contextual
      "break",
      "case",
      "catch",
      "class",
      "consume",
      // contextual
      "consuming",
      // contextual
      "continue",
      "convenience",
      // contextual
      "copy",
      // contextual
      "default",
      "defer",
      "deinit",
      "didSet",
      // contextual
      "distributed",
      "do",
      "dynamic",
      // contextual
      "each",
      "else",
      "enum",
      "extension",
      "fallthrough",
      /fileprivate\(set\)/,
      "fileprivate",
      "final",
      // contextual
      "for",
      "func",
      "get",
      // contextual
      "guard",
      "if",
      "import",
      "indirect",
      // contextual
      "infix",
      // contextual
      /init\?/,
      /init!/,
      "inout",
      /internal\(set\)/,
      "internal",
      "in",
      "is",
      // operator
      "isolated",
      // contextual
      "nonisolated",
      // contextual
      "lazy",
      // contextual
      "let",
      "macro",
      "mutating",
      // contextual
      "nonmutating",
      // contextual
      /open\(set\)/,
      // contextual
      "open",
      // contextual
      "operator",
      "optional",
      // contextual
      "override",
      // contextual
      "package",
      "postfix",
      // contextual
      "precedencegroup",
      "prefix",
      // contextual
      /private\(set\)/,
      "private",
      "protocol",
      /public\(set\)/,
      "public",
      "repeat",
      "required",
      // contextual
      "rethrows",
      "return",
      "set",
      // contextual
      "some",
      // contextual
      "static",
      "struct",
      "subscript",
      "super",
      "switch",
      "throws",
      "throw",
      /try\?/,
      // operator
      /try!/,
      // operator
      "try",
      // operator
      "typealias",
      /unowned\(safe\)/,
      // contextual
      /unowned\(unsafe\)/,
      // contextual
      "unowned",
      // contextual
      "var",
      "weak",
      // contextual
      "where",
      "while",
      "willSet"
      // contextual
    ];
    var literals = [
      "false",
      "nil",
      "true"
    ];
    var precedencegroupKeywords = [
      "assignment",
      "associativity",
      "higherThan",
      "left",
      "lowerThan",
      "none",
      "right"
    ];
    var numberSignKeywords = [
      "#colorLiteral",
      "#column",
      "#dsohandle",
      "#else",
      "#elseif",
      "#endif",
      "#error",
      "#file",
      "#fileID",
      "#fileLiteral",
      "#filePath",
      "#function",
      "#if",
      "#imageLiteral",
      "#keyPath",
      "#line",
      "#selector",
      "#sourceLocation",
      "#warning"
    ];
    var builtIns = [
      "abs",
      "all",
      "any",
      "assert",
      "assertionFailure",
      "debugPrint",
      "dump",
      "fatalError",
      "getVaList",
      "isKnownUniquelyReferenced",
      "max",
      "min",
      "numericCast",
      "pointwiseMax",
      "pointwiseMin",
      "precondition",
      "preconditionFailure",
      "print",
      "readLine",
      "repeatElement",
      "sequence",
      "stride",
      "swap",
      "swift_unboxFromSwiftValueWithType",
      "transcode",
      "type",
      "unsafeBitCast",
      "unsafeDowncast",
      "withExtendedLifetime",
      "withUnsafeMutablePointer",
      "withUnsafePointer",
      "withVaList",
      "withoutActuallyEscaping",
      "zip"
    ];
    var operatorHead = either(
      /[/=\-+!*%<>&|^~?]/,
      /[\u00A1-\u00A7]/,
      /[\u00A9\u00AB]/,
      /[\u00AC\u00AE]/,
      /[\u00B0\u00B1]/,
      /[\u00B6\u00BB\u00BF\u00D7\u00F7]/,
      /[\u2016-\u2017]/,
      /[\u2020-\u2027]/,
      /[\u2030-\u203E]/,
      /[\u2041-\u2053]/,
      /[\u2055-\u205E]/,
      /[\u2190-\u23FF]/,
      /[\u2500-\u2775]/,
      /[\u2794-\u2BFF]/,
      /[\u2E00-\u2E7F]/,
      /[\u3001-\u3003]/,
      /[\u3008-\u3020]/,
      /[\u3030]/
    );
    var operatorCharacter = either(
      operatorHead,
      /[\u0300-\u036F]/,
      /[\u1DC0-\u1DFF]/,
      /[\u20D0-\u20FF]/,
      /[\uFE00-\uFE0F]/,
      /[\uFE20-\uFE2F]/
      // TODO: The following characters are also allowed, but the regex isn't supported yet.
      // /[\u{E0100}-\u{E01EF}]/u
    );
    var operator = concat(operatorHead, operatorCharacter, "*");
    var identifierHead = either(
      /[a-zA-Z_]/,
      /[\u00A8\u00AA\u00AD\u00AF\u00B2-\u00B5\u00B7-\u00BA]/,
      /[\u00BC-\u00BE\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u00FF]/,
      /[\u0100-\u02FF\u0370-\u167F\u1681-\u180D\u180F-\u1DBF]/,
      /[\u1E00-\u1FFF]/,
      /[\u200B-\u200D\u202A-\u202E\u203F-\u2040\u2054\u2060-\u206F]/,
      /[\u2070-\u20CF\u2100-\u218F\u2460-\u24FF\u2776-\u2793]/,
      /[\u2C00-\u2DFF\u2E80-\u2FFF]/,
      /[\u3004-\u3007\u3021-\u302F\u3031-\u303F\u3040-\uD7FF]/,
      /[\uF900-\uFD3D\uFD40-\uFDCF\uFDF0-\uFE1F\uFE30-\uFE44]/,
      /[\uFE47-\uFEFE\uFF00-\uFFFD]/
      // Should be /[\uFE47-\uFFFD]/, but we have to exclude FEFF.
      // The following characters are also allowed, but the regexes aren't supported yet.
      // /[\u{10000}-\u{1FFFD}\u{20000-\u{2FFFD}\u{30000}-\u{3FFFD}\u{40000}-\u{4FFFD}]/u,
      // /[\u{50000}-\u{5FFFD}\u{60000-\u{6FFFD}\u{70000}-\u{7FFFD}\u{80000}-\u{8FFFD}]/u,
      // /[\u{90000}-\u{9FFFD}\u{A0000-\u{AFFFD}\u{B0000}-\u{BFFFD}\u{C0000}-\u{CFFFD}]/u,
      // /[\u{D0000}-\u{DFFFD}\u{E0000-\u{EFFFD}]/u
    );
    var identifierCharacter = either(
      identifierHead,
      /\d/,
      /[\u0300-\u036F\u1DC0-\u1DFF\u20D0-\u20FF\uFE20-\uFE2F]/
    );
    var identifier = concat(identifierHead, identifierCharacter, "*");
    var typeIdentifier = concat(/[A-Z]/, identifierCharacter, "*");
    var keywordAttributes = [
      "attached",
      "autoclosure",
      concat(/convention\(/, either("swift", "block", "c"), /\)/),
      "discardableResult",
      "dynamicCallable",
      "dynamicMemberLookup",
      "escaping",
      "freestanding",
      "frozen",
      "GKInspectable",
      "IBAction",
      "IBDesignable",
      "IBInspectable",
      "IBOutlet",
      "IBSegueAction",
      "inlinable",
      "main",
      "nonobjc",
      "NSApplicationMain",
      "NSCopying",
      "NSManaged",
      concat(/objc\(/, identifier, /\)/),
      "objc",
      "objcMembers",
      "propertyWrapper",
      "requires_stored_property_inits",
      "resultBuilder",
      "Sendable",
      "testable",
      "UIApplicationMain",
      "unchecked",
      "unknown",
      "usableFromInline",
      "warn_unqualified_access"
    ];
    var availabilityKeywords = [
      "iOS",
      "iOSApplicationExtension",
      "macOS",
      "macOSApplicationExtension",
      "macCatalyst",
      "macCatalystApplicationExtension",
      "watchOS",
      "watchOSApplicationExtension",
      "tvOS",
      "tvOSApplicationExtension",
      "swift"
    ];
    function swift(hljs) {
      const WHITESPACE = {
        match: /\s+/,
        relevance: 0
      };
      const BLOCK_COMMENT = hljs.COMMENT(
        "/\\*",
        "\\*/",
        { contains: ["self"] }
      );
      const COMMENTS = [
        hljs.C_LINE_COMMENT_MODE,
        BLOCK_COMMENT
      ];
      const DOT_KEYWORD = {
        match: [
          /\./,
          either(...dotKeywords, ...optionalDotKeywords)
        ],
        className: { 2: "keyword" }
      };
      const KEYWORD_GUARD = {
        // Consume .keyword to prevent highlighting properties and methods as keywords.
        match: concat(/\./, either(...keywords)),
        relevance: 0
      };
      const PLAIN_KEYWORDS = keywords.filter((kw) => typeof kw === "string").concat(["_|0"]);
      const REGEX_KEYWORDS = keywords.filter((kw) => typeof kw !== "string").concat(keywordTypes).map(keywordWrapper);
      const KEYWORD = { variants: [
        {
          className: "keyword",
          match: either(...REGEX_KEYWORDS, ...optionalDotKeywords)
        }
      ] };
      const KEYWORDS = {
        $pattern: either(
          /\b\w+/,
          // regular keywords
          /#\w+/
          // number keywords
        ),
        keyword: PLAIN_KEYWORDS.concat(numberSignKeywords),
        literal: literals
      };
      const KEYWORD_MODES = [
        DOT_KEYWORD,
        KEYWORD_GUARD,
        KEYWORD
      ];
      const BUILT_IN_GUARD = {
        // Consume .built_in to prevent highlighting properties and methods.
        match: concat(/\./, either(...builtIns)),
        relevance: 0
      };
      const BUILT_IN = {
        className: "built_in",
        match: concat(/\b/, either(...builtIns), /(?=\()/)
      };
      const BUILT_INS = [
        BUILT_IN_GUARD,
        BUILT_IN
      ];
      const OPERATOR_GUARD = {
        // Prevent -> from being highlighting as an operator.
        match: /->/,
        relevance: 0
      };
      const OPERATOR = {
        className: "operator",
        relevance: 0,
        variants: [
          { match: operator },
          {
            // dot-operator: only operators that start with a dot are allowed to use dots as
            // characters (..., ...<, .*, etc). So there rule here is: a dot followed by one or more
            // characters that may also include dots.
            match: `\\.(\\.|${operatorCharacter})+`
          }
        ]
      };
      const OPERATORS = [
        OPERATOR_GUARD,
        OPERATOR
      ];
      const decimalDigits = "([0-9]_*)+";
      const hexDigits = "([0-9a-fA-F]_*)+";
      const NUMBER = {
        className: "number",
        relevance: 0,
        variants: [
          // decimal floating-point-literal (subsumes decimal-literal)
          { match: `\\b(${decimalDigits})(\\.(${decimalDigits}))?([eE][+-]?(${decimalDigits}))?\\b` },
          // hexadecimal floating-point-literal (subsumes hexadecimal-literal)
          { match: `\\b0x(${hexDigits})(\\.(${hexDigits}))?([pP][+-]?(${decimalDigits}))?\\b` },
          // octal-literal
          { match: /\b0o([0-7]_*)+\b/ },
          // binary-literal
          { match: /\b0b([01]_*)+\b/ }
        ]
      };
      const ESCAPED_CHARACTER = (rawDelimiter = "") => ({
        className: "subst",
        variants: [
          { match: concat(/\\/, rawDelimiter, /[0\\tnr"']/) },
          { match: concat(/\\/, rawDelimiter, /u\{[0-9a-fA-F]{1,8}\}/) }
        ]
      });
      const ESCAPED_NEWLINE = (rawDelimiter = "") => ({
        className: "subst",
        match: concat(/\\/, rawDelimiter, /[\t ]*(?:[\r\n]|\r\n)/)
      });
      const INTERPOLATION = (rawDelimiter = "") => ({
        className: "subst",
        label: "interpol",
        begin: concat(/\\/, rawDelimiter, /\(/),
        end: /\)/
      });
      const MULTILINE_STRING = (rawDelimiter = "") => ({
        begin: concat(rawDelimiter, /"""/),
        end: concat(/"""/, rawDelimiter),
        contains: [
          ESCAPED_CHARACTER(rawDelimiter),
          ESCAPED_NEWLINE(rawDelimiter),
          INTERPOLATION(rawDelimiter)
        ]
      });
      const SINGLE_LINE_STRING = (rawDelimiter = "") => ({
        begin: concat(rawDelimiter, /"/),
        end: concat(/"/, rawDelimiter),
        contains: [
          ESCAPED_CHARACTER(rawDelimiter),
          INTERPOLATION(rawDelimiter)
        ]
      });
      const STRING = {
        className: "string",
        variants: [
          MULTILINE_STRING(),
          MULTILINE_STRING("#"),
          MULTILINE_STRING("##"),
          MULTILINE_STRING("###"),
          SINGLE_LINE_STRING(),
          SINGLE_LINE_STRING("#"),
          SINGLE_LINE_STRING("##"),
          SINGLE_LINE_STRING("###")
        ]
      };
      const REGEXP_CONTENTS = [
        hljs.BACKSLASH_ESCAPE,
        {
          begin: /\[/,
          end: /\]/,
          relevance: 0,
          contains: [hljs.BACKSLASH_ESCAPE]
        }
      ];
      const BARE_REGEXP_LITERAL = {
        begin: /\/[^\s](?=[^/\n]*\/)/,
        end: /\//,
        contains: REGEXP_CONTENTS
      };
      const EXTENDED_REGEXP_LITERAL = (rawDelimiter) => {
        const begin = concat(rawDelimiter, /\//);
        const end = concat(/\//, rawDelimiter);
        return {
          begin,
          end,
          contains: [
            ...REGEXP_CONTENTS,
            {
              scope: "comment",
              begin: `#(?!.*${end})`,
              end: /$/
            }
          ]
        };
      };
      const REGEXP = {
        scope: "regexp",
        variants: [
          EXTENDED_REGEXP_LITERAL("###"),
          EXTENDED_REGEXP_LITERAL("##"),
          EXTENDED_REGEXP_LITERAL("#"),
          BARE_REGEXP_LITERAL
        ]
      };
      const QUOTED_IDENTIFIER = { match: concat(/`/, identifier, /`/) };
      const IMPLICIT_PARAMETER = {
        className: "variable",
        match: /\$\d+/
      };
      const PROPERTY_WRAPPER_PROJECTION = {
        className: "variable",
        match: `\\$${identifierCharacter}+`
      };
      const IDENTIFIERS = [
        QUOTED_IDENTIFIER,
        IMPLICIT_PARAMETER,
        PROPERTY_WRAPPER_PROJECTION
      ];
      const AVAILABLE_ATTRIBUTE = {
        match: /(@|#(un)?)available/,
        scope: "keyword",
        starts: { contains: [
          {
            begin: /\(/,
            end: /\)/,
            keywords: availabilityKeywords,
            contains: [
              ...OPERATORS,
              NUMBER,
              STRING
            ]
          }
        ] }
      };
      const KEYWORD_ATTRIBUTE = {
        scope: "keyword",
        match: concat(/@/, either(...keywordAttributes), lookahead(either(/\(/, /\s+/)))
      };
      const USER_DEFINED_ATTRIBUTE = {
        scope: "meta",
        match: concat(/@/, identifier)
      };
      const ATTRIBUTES = [
        AVAILABLE_ATTRIBUTE,
        KEYWORD_ATTRIBUTE,
        USER_DEFINED_ATTRIBUTE
      ];
      const TYPE = {
        match: lookahead(/\b[A-Z]/),
        relevance: 0,
        contains: [
          {
            // Common Apple frameworks, for relevance boost
            className: "type",
            match: concat(/(AV|CA|CF|CG|CI|CL|CM|CN|CT|MK|MP|MTK|MTL|NS|SCN|SK|UI|WK|XC)/, identifierCharacter, "+")
          },
          {
            // Type identifier
            className: "type",
            match: typeIdentifier,
            relevance: 0
          },
          {
            // Optional type
            match: /[?!]+/,
            relevance: 0
          },
          {
            // Variadic parameter
            match: /\.\.\./,
            relevance: 0
          },
          {
            // Protocol composition
            match: concat(/\s+&\s+/, lookahead(typeIdentifier)),
            relevance: 0
          }
        ]
      };
      const GENERIC_ARGUMENTS = {
        begin: /</,
        end: />/,
        keywords: KEYWORDS,
        contains: [
          ...COMMENTS,
          ...KEYWORD_MODES,
          ...ATTRIBUTES,
          OPERATOR_GUARD,
          TYPE
        ]
      };
      TYPE.contains.push(GENERIC_ARGUMENTS);
      const TUPLE_ELEMENT_NAME = {
        match: concat(identifier, /\s*:/),
        keywords: "_|0",
        relevance: 0
      };
      const TUPLE = {
        begin: /\(/,
        end: /\)/,
        relevance: 0,
        keywords: KEYWORDS,
        contains: [
          "self",
          TUPLE_ELEMENT_NAME,
          ...COMMENTS,
          REGEXP,
          ...KEYWORD_MODES,
          ...BUILT_INS,
          ...OPERATORS,
          NUMBER,
          STRING,
          ...IDENTIFIERS,
          ...ATTRIBUTES,
          TYPE
        ]
      };
      const GENERIC_PARAMETERS = {
        begin: /</,
        end: />/,
        keywords: "repeat each",
        contains: [
          ...COMMENTS,
          TYPE
        ]
      };
      const FUNCTION_PARAMETER_NAME = {
        begin: either(
          lookahead(concat(identifier, /\s*:/)),
          lookahead(concat(identifier, /\s+/, identifier, /\s*:/))
        ),
        end: /:/,
        relevance: 0,
        contains: [
          {
            className: "keyword",
            match: /\b_\b/
          },
          {
            className: "params",
            match: identifier
          }
        ]
      };
      const FUNCTION_PARAMETERS = {
        begin: /\(/,
        end: /\)/,
        keywords: KEYWORDS,
        contains: [
          FUNCTION_PARAMETER_NAME,
          ...COMMENTS,
          ...KEYWORD_MODES,
          ...OPERATORS,
          NUMBER,
          STRING,
          ...ATTRIBUTES,
          TYPE,
          TUPLE
        ],
        endsParent: true,
        illegal: /["']/
      };
      const FUNCTION_OR_MACRO = {
        match: [
          /(func|macro)/,
          /\s+/,
          either(QUOTED_IDENTIFIER.match, identifier, operator)
        ],
        className: {
          1: "keyword",
          3: "title.function"
        },
        contains: [
          GENERIC_PARAMETERS,
          FUNCTION_PARAMETERS,
          WHITESPACE
        ],
        illegal: [
          /\[/,
          /%/
        ]
      };
      const INIT_SUBSCRIPT = {
        match: [
          /\b(?:subscript|init[?!]?)/,
          /\s*(?=[<(])/
        ],
        className: { 1: "keyword" },
        contains: [
          GENERIC_PARAMETERS,
          FUNCTION_PARAMETERS,
          WHITESPACE
        ],
        illegal: /\[|%/
      };
      const OPERATOR_DECLARATION = {
        match: [
          /operator/,
          /\s+/,
          operator
        ],
        className: {
          1: "keyword",
          3: "title"
        }
      };
      const PRECEDENCEGROUP = {
        begin: [
          /precedencegroup/,
          /\s+/,
          typeIdentifier
        ],
        className: {
          1: "keyword",
          3: "title"
        },
        contains: [TYPE],
        keywords: [
          ...precedencegroupKeywords,
          ...literals
        ],
        end: /}/
      };
      const CLASS_FUNC_DECLARATION = {
        match: [
          /class\b/,
          /\s+/,
          /func\b/,
          /\s+/,
          /\b[A-Za-z_][A-Za-z0-9_]*\b/
        ],
        scope: {
          1: "keyword",
          3: "keyword",
          5: "title.function"
        }
      };
      const CLASS_VAR_DECLARATION = {
        match: [
          /class\b/,
          /\s+/,
          /var\b/
        ],
        scope: {
          1: "keyword",
          3: "keyword"
        }
      };
      const TYPE_DECLARATION = {
        begin: [
          /(struct|protocol|class|extension|enum|actor)/,
          /\s+/,
          identifier,
          /\s*/
        ],
        beginScope: {
          1: "keyword",
          3: "title.class"
        },
        keywords: KEYWORDS,
        contains: [
          GENERIC_PARAMETERS,
          ...KEYWORD_MODES,
          {
            begin: /:/,
            end: /\{/,
            keywords: KEYWORDS,
            contains: [
              {
                scope: "title.class.inherited",
                match: typeIdentifier
              },
              ...KEYWORD_MODES
            ],
            relevance: 0
          }
        ]
      };
      for (const variant of STRING.variants) {
        const interpolation = variant.contains.find((mode) => mode.label === "interpol");
        interpolation.keywords = KEYWORDS;
        const submodes = [
          ...KEYWORD_MODES,
          ...BUILT_INS,
          ...OPERATORS,
          NUMBER,
          STRING,
          ...IDENTIFIERS
        ];
        interpolation.contains = [
          ...submodes,
          {
            begin: /\(/,
            end: /\)/,
            contains: [
              "self",
              ...submodes
            ]
          }
        ];
      }
      return {
        name: "Swift",
        keywords: KEYWORDS,
        contains: [
          ...COMMENTS,
          FUNCTION_OR_MACRO,
          INIT_SUBSCRIPT,
          CLASS_FUNC_DECLARATION,
          CLASS_VAR_DECLARATION,
          TYPE_DECLARATION,
          OPERATOR_DECLARATION,
          PRECEDENCEGROUP,
          {
            beginKeywords: "import",
            end: /$/,
            contains: [...COMMENTS],
            relevance: 0
          },
          REGEXP,
          ...KEYWORD_MODES,
          ...BUILT_INS,
          ...OPERATORS,
          NUMBER,
          STRING,
          ...IDENTIFIERS,
          ...ATTRIBUTES,
          TYPE,
          TUPLE
        ]
      };
    }
    module.exports = swift;
  }
});

// node_modules/highlight.js/lib/languages/yaml.js
var require_yaml = __commonJS({
  "node_modules/highlight.js/lib/languages/yaml.js"(exports, module) {
    "use strict";
    function yaml(hljs) {
      const LITERALS = "true false yes no null";
      const URI_CHARACTERS = "[\\w#;/?:@&=+$,.~*'()[\\]]+";
      const KEY = {
        className: "attr",
        variants: [
          // added brackets support and special char support
          { begin: /[\w*@][\w*@ :()\./-]*:(?=[ \t]|$)/ },
          {
            // double quoted keys - with brackets and special char support
            begin: /"[\w*@][\w*@ :()\./-]*":(?=[ \t]|$)/
          },
          {
            // single quoted keys - with brackets and special char support
            begin: /'[\w*@][\w*@ :()\./-]*':(?=[ \t]|$)/
          }
        ]
      };
      const TEMPLATE_VARIABLES = {
        className: "template-variable",
        variants: [
          {
            // jinja templates Ansible
            begin: /\{\{/,
            end: /\}\}/
          },
          {
            // Ruby i18n
            begin: /%\{/,
            end: /\}/
          }
        ]
      };
      const SINGLE_QUOTE_STRING = {
        className: "string",
        relevance: 0,
        begin: /'/,
        end: /'/,
        contains: [
          {
            match: /''/,
            scope: "char.escape",
            relevance: 0
          }
        ]
      };
      const STRING = {
        className: "string",
        relevance: 0,
        variants: [
          {
            begin: /"/,
            end: /"/
          },
          { begin: /\S+/ }
        ],
        contains: [
          hljs.BACKSLASH_ESCAPE,
          TEMPLATE_VARIABLES
        ]
      };
      const CONTAINER_STRING = hljs.inherit(STRING, { variants: [
        {
          begin: /'/,
          end: /'/,
          contains: [
            {
              begin: /''/,
              relevance: 0
            }
          ]
        },
        {
          begin: /"/,
          end: /"/
        },
        { begin: /[^\s,{}[\]]+/ }
      ] });
      const DATE_RE = "[0-9]{4}(-[0-9][0-9]){0,2}";
      const TIME_RE = "([Tt \\t][0-9][0-9]?(:[0-9][0-9]){2})?";
      const FRACTION_RE = "(\\.[0-9]*)?";
      const ZONE_RE = "([ \\t])*(Z|[-+][0-9][0-9]?(:[0-9][0-9])?)?";
      const TIMESTAMP = {
        className: "number",
        begin: "\\b" + DATE_RE + TIME_RE + FRACTION_RE + ZONE_RE + "\\b"
      };
      const VALUE_CONTAINER = {
        end: ",",
        endsWithParent: true,
        excludeEnd: true,
        keywords: LITERALS,
        relevance: 0
      };
      const OBJECT = {
        begin: /\{/,
        end: /\}/,
        contains: [VALUE_CONTAINER],
        illegal: "\\n",
        relevance: 0
      };
      const ARRAY = {
        begin: "\\[",
        end: "\\]",
        contains: [VALUE_CONTAINER],
        illegal: "\\n",
        relevance: 0
      };
      const MODES = [
        KEY,
        {
          className: "meta",
          begin: "^---\\s*$",
          relevance: 10
        },
        {
          // multi line string
          // Blocks start with a | or > followed by a newline
          //
          // Indentation of subsequent lines must be the same to
          // be considered part of the block
          className: "string",
          begin: "[\\|>]([1-9]?[+-])?[ ]*\\n( +)[^ ][^\\n]*\\n(\\2[^\\n]+\\n?)*"
        },
        {
          // Ruby/Rails erb
          begin: "<%[%=-]?",
          end: "[%-]?%>",
          subLanguage: "ruby",
          excludeBegin: true,
          excludeEnd: true,
          relevance: 0
        },
        {
          // named tags
          className: "type",
          begin: "!\\w+!" + URI_CHARACTERS
        },
        // https://yaml.org/spec/1.2/spec.html#id2784064
        {
          // verbatim tags
          className: "type",
          begin: "!<" + URI_CHARACTERS + ">"
        },
        {
          // primary tags
          className: "type",
          begin: "!" + URI_CHARACTERS
        },
        {
          // secondary tags
          className: "type",
          begin: "!!" + URI_CHARACTERS
        },
        {
          // fragment id &ref
          className: "meta",
          begin: "&" + hljs.UNDERSCORE_IDENT_RE + "$"
        },
        {
          // fragment reference *ref
          className: "meta",
          begin: "\\*" + hljs.UNDERSCORE_IDENT_RE + "$"
        },
        {
          // array listing
          className: "bullet",
          // TODO: remove |$ hack when we have proper look-ahead support
          begin: "-(?=[ ]|$)",
          relevance: 0
        },
        hljs.HASH_COMMENT_MODE,
        {
          beginKeywords: LITERALS,
          keywords: { literal: LITERALS }
        },
        TIMESTAMP,
        // numbers are any valid C-style number that
        // sit isolated from other words
        {
          className: "number",
          begin: hljs.C_NUMBER_RE + "\\b",
          relevance: 0
        },
        OBJECT,
        ARRAY,
        SINGLE_QUOTE_STRING,
        STRING
      ];
      const VALUE_MODES = [...MODES];
      VALUE_MODES.pop();
      VALUE_MODES.push(CONTAINER_STRING);
      VALUE_CONTAINER.contains = VALUE_MODES;
      return {
        name: "YAML",
        case_insensitive: true,
        aliases: ["yml"],
        contains: MODES
      };
    }
    module.exports = yaml;
  }
});

// node_modules/highlight.js/lib/languages/typescript.js
var require_typescript = __commonJS({
  "node_modules/highlight.js/lib/languages/typescript.js"(exports, module) {
    "use strict";
    var IDENT_RE = "[A-Za-z$_][0-9A-Za-z$_]*";
    var KEYWORDS = [
      "as",
      // for exports
      "in",
      "of",
      "if",
      "for",
      "while",
      "finally",
      "var",
      "new",
      "function",
      "do",
      "return",
      "void",
      "else",
      "break",
      "catch",
      "instanceof",
      "with",
      "throw",
      "case",
      "default",
      "try",
      "switch",
      "continue",
      "typeof",
      "delete",
      "let",
      "yield",
      "const",
      "class",
      // JS handles these with a special rule
      // "get",
      // "set",
      "debugger",
      "async",
      "await",
      "static",
      "import",
      "from",
      "export",
      "extends",
      // It's reached stage 3, which is "recommended for implementation":
      "using"
    ];
    var LITERALS = [
      "true",
      "false",
      "null",
      "undefined",
      "NaN",
      "Infinity"
    ];
    var TYPES = [
      // Fundamental objects
      "Object",
      "Function",
      "Boolean",
      "Symbol",
      // numbers and dates
      "Math",
      "Date",
      "Number",
      "BigInt",
      // text
      "String",
      "RegExp",
      // Indexed collections
      "Array",
      "Float32Array",
      "Float64Array",
      "Int8Array",
      "Uint8Array",
      "Uint8ClampedArray",
      "Int16Array",
      "Int32Array",
      "Uint16Array",
      "Uint32Array",
      "BigInt64Array",
      "BigUint64Array",
      // Keyed collections
      "Set",
      "Map",
      "WeakSet",
      "WeakMap",
      // Structured data
      "ArrayBuffer",
      "SharedArrayBuffer",
      "Atomics",
      "DataView",
      "JSON",
      // Control abstraction objects
      "Promise",
      "Generator",
      "GeneratorFunction",
      "AsyncFunction",
      // Reflection
      "Reflect",
      "Proxy",
      // Internationalization
      "Intl",
      // WebAssembly
      "WebAssembly"
    ];
    var ERROR_TYPES = [
      "Error",
      "EvalError",
      "InternalError",
      "RangeError",
      "ReferenceError",
      "SyntaxError",
      "TypeError",
      "URIError"
    ];
    var BUILT_IN_GLOBALS = [
      "setInterval",
      "setTimeout",
      "clearInterval",
      "clearTimeout",
      "require",
      "exports",
      "eval",
      "isFinite",
      "isNaN",
      "parseFloat",
      "parseInt",
      "decodeURI",
      "decodeURIComponent",
      "encodeURI",
      "encodeURIComponent",
      "escape",
      "unescape"
    ];
    var BUILT_IN_VARIABLES = [
      "arguments",
      "this",
      "super",
      "console",
      "window",
      "document",
      "localStorage",
      "sessionStorage",
      "module",
      "global"
      // Node.js
    ];
    var BUILT_INS = [].concat(
      BUILT_IN_GLOBALS,
      TYPES,
      ERROR_TYPES
    );
    function javascript(hljs) {
      const regex = hljs.regex;
      const hasClosingTag = (match, { after }) => {
        const tag2 = "</" + match[0].slice(1);
        const pos = match.input.indexOf(tag2, after);
        return pos !== -1;
      };
      const IDENT_RE$1 = IDENT_RE;
      const FRAGMENT = {
        begin: "<>",
        end: "</>"
      };
      const XML_SELF_CLOSING = /<[A-Za-z0-9\\._:-]+\s*\/>/;
      const XML_TAG = {
        begin: /<[A-Za-z0-9\\._:-]+/,
        end: /\/[A-Za-z0-9\\._:-]+>|\/>/,
        /**
         * @param {RegExpMatchArray} match
         * @param {CallbackResponse} response
         */
        isTrulyOpeningTag: (match, response) => {
          const afterMatchIndex = match[0].length + match.index;
          const nextChar = match.input[afterMatchIndex];
          if (
            // HTML should not include another raw `<` inside a tag
            // nested type?
            // `<Array<Array<number>>`, etc.
            nextChar === "<" || // the , gives away that this is not HTML
            // `<T, A extends keyof T, V>`
            nextChar === ","
          ) {
            response.ignoreMatch();
            return;
          }
          if (nextChar === ">") {
            if (!hasClosingTag(match, { after: afterMatchIndex })) {
              response.ignoreMatch();
            }
          }
          let m3;
          const afterMatch = match.input.substring(afterMatchIndex);
          if (m3 = afterMatch.match(/^\s*=/)) {
            response.ignoreMatch();
            return;
          }
          if (m3 = afterMatch.match(/^\s+extends\s+/)) {
            if (m3.index === 0) {
              response.ignoreMatch();
              return;
            }
          }
        }
      };
      const KEYWORDS$1 = {
        $pattern: IDENT_RE,
        keyword: KEYWORDS,
        literal: LITERALS,
        built_in: BUILT_INS,
        "variable.language": BUILT_IN_VARIABLES
      };
      const decimalDigits = "[0-9](_?[0-9])*";
      const frac = `\\.(${decimalDigits})`;
      const decimalInteger = `0|[1-9](_?[0-9])*|0[0-7]*[89][0-9]*`;
      const NUMBER = {
        className: "number",
        variants: [
          // DecimalLiteral
          { begin: `(\\b(${decimalInteger})((${frac})|\\.)?|(${frac}))[eE][+-]?(${decimalDigits})\\b` },
          { begin: `\\b(${decimalInteger})\\b((${frac})\\b|\\.)?|(${frac})\\b` },
          // DecimalBigIntegerLiteral
          { begin: `\\b(0|[1-9](_?[0-9])*)n\\b` },
          // NonDecimalIntegerLiteral
          { begin: "\\b0[xX][0-9a-fA-F](_?[0-9a-fA-F])*n?\\b" },
          { begin: "\\b0[bB][0-1](_?[0-1])*n?\\b" },
          { begin: "\\b0[oO][0-7](_?[0-7])*n?\\b" },
          // LegacyOctalIntegerLiteral (does not include underscore separators)
          // https://tc39.es/ecma262/#sec-additional-syntax-numeric-literals
          { begin: "\\b0[0-7]+n?\\b" }
        ],
        relevance: 0
      };
      const SUBST = {
        className: "subst",
        begin: "\\$\\{",
        end: "\\}",
        keywords: KEYWORDS$1,
        contains: []
        // defined later
      };
      const HTML_TEMPLATE = {
        begin: ".?html`",
        end: "",
        starts: {
          end: "`",
          returnEnd: false,
          contains: [
            hljs.BACKSLASH_ESCAPE,
            SUBST
          ],
          subLanguage: "xml"
        }
      };
      const CSS_TEMPLATE = {
        begin: ".?css`",
        end: "",
        starts: {
          end: "`",
          returnEnd: false,
          contains: [
            hljs.BACKSLASH_ESCAPE,
            SUBST
          ],
          subLanguage: "css"
        }
      };
      const GRAPHQL_TEMPLATE = {
        begin: ".?gql`",
        end: "",
        starts: {
          end: "`",
          returnEnd: false,
          contains: [
            hljs.BACKSLASH_ESCAPE,
            SUBST
          ],
          subLanguage: "graphql"
        }
      };
      const TEMPLATE_STRING = {
        className: "string",
        begin: "`",
        end: "`",
        contains: [
          hljs.BACKSLASH_ESCAPE,
          SUBST
        ]
      };
      const JSDOC_COMMENT = hljs.COMMENT(
        /\/\*\*(?!\/)/,
        "\\*/",
        {
          relevance: 0,
          contains: [
            {
              begin: "(?=@[A-Za-z]+)",
              relevance: 0,
              contains: [
                {
                  className: "doctag",
                  begin: "@[A-Za-z]+"
                },
                {
                  className: "type",
                  begin: "\\{",
                  end: "\\}",
                  excludeEnd: true,
                  excludeBegin: true,
                  relevance: 0
                },
                {
                  className: "variable",
                  begin: IDENT_RE$1 + "(?=\\s*(-)|$)",
                  endsParent: true,
                  relevance: 0
                },
                // eat spaces (not newlines) so we can find
                // types or variables
                {
                  begin: /(?=[^\n])\s/,
                  relevance: 0
                }
              ]
            }
          ]
        }
      );
      const COMMENT = {
        className: "comment",
        variants: [
          JSDOC_COMMENT,
          hljs.C_BLOCK_COMMENT_MODE,
          hljs.C_LINE_COMMENT_MODE
        ]
      };
      const SUBST_INTERNALS = [
        hljs.APOS_STRING_MODE,
        hljs.QUOTE_STRING_MODE,
        HTML_TEMPLATE,
        CSS_TEMPLATE,
        GRAPHQL_TEMPLATE,
        TEMPLATE_STRING,
        // Skip numbers when they are part of a variable name
        { match: /\$\d+/ },
        NUMBER
        // This is intentional:
        // See https://github.com/highlightjs/highlight.js/issues/3288
        // hljs.REGEXP_MODE
      ];
      SUBST.contains = SUBST_INTERNALS.concat({
        // we need to pair up {} inside our subst to prevent
        // it from ending too early by matching another }
        begin: /\{/,
        end: /\}/,
        keywords: KEYWORDS$1,
        contains: [
          "self"
        ].concat(SUBST_INTERNALS)
      });
      const SUBST_AND_COMMENTS = [].concat(COMMENT, SUBST.contains);
      const PARAMS_CONTAINS = SUBST_AND_COMMENTS.concat([
        // eat recursive parens in sub expressions
        {
          begin: /(\s*)\(/,
          end: /\)/,
          keywords: KEYWORDS$1,
          contains: ["self"].concat(SUBST_AND_COMMENTS)
        }
      ]);
      const PARAMS = {
        className: "params",
        // convert this to negative lookbehind in v12
        begin: /(\s*)\(/,
        // to match the parms with
        end: /\)/,
        excludeBegin: true,
        excludeEnd: true,
        keywords: KEYWORDS$1,
        contains: PARAMS_CONTAINS
      };
      const CLASS_OR_EXTENDS = {
        variants: [
          // class Car extends vehicle
          {
            match: [
              /class/,
              /\s+/,
              IDENT_RE$1,
              /\s+/,
              /extends/,
              /\s+/,
              regex.concat(IDENT_RE$1, "(", regex.concat(/\./, IDENT_RE$1), ")*")
            ],
            scope: {
              1: "keyword",
              3: "title.class",
              5: "keyword",
              7: "title.class.inherited"
            }
          },
          // class Car
          {
            match: [
              /class/,
              /\s+/,
              IDENT_RE$1
            ],
            scope: {
              1: "keyword",
              3: "title.class"
            }
          }
        ]
      };
      const CLASS_REFERENCE = {
        relevance: 0,
        match: regex.either(
          // Hard coded exceptions
          /\bJSON/,
          // Float32Array, OutT
          /\b[A-Z][a-z]+([A-Z][a-z]*|\d)*/,
          // CSSFactory, CSSFactoryT
          /\b[A-Z]{2,}([A-Z][a-z]+|\d)+([A-Z][a-z]*)*/,
          // FPs, FPsT
          /\b[A-Z]{2,}[a-z]+([A-Z][a-z]+|\d)*([A-Z][a-z]*)*/
          // P
          // single letters are not highlighted
          // BLAH
          // this will be flagged as a UPPER_CASE_CONSTANT instead
        ),
        className: "title.class",
        keywords: {
          _: [
            // se we still get relevance credit for JS library classes
            ...TYPES,
            ...ERROR_TYPES
          ]
        }
      };
      const USE_STRICT = {
        label: "use_strict",
        className: "meta",
        relevance: 10,
        begin: /^\s*['"]use (strict|asm)['"]/
      };
      const FUNCTION_DEFINITION = {
        variants: [
          {
            match: [
              /function/,
              /\s+/,
              IDENT_RE$1,
              /(?=\s*\()/
            ]
          },
          // anonymous function
          {
            match: [
              /function/,
              /\s*(?=\()/
            ]
          }
        ],
        className: {
          1: "keyword",
          3: "title.function"
        },
        label: "func.def",
        contains: [PARAMS],
        illegal: /%/
      };
      const UPPER_CASE_CONSTANT = {
        relevance: 0,
        match: /\b[A-Z][A-Z_0-9]+\b/,
        className: "variable.constant"
      };
      function noneOf(list2) {
        return regex.concat("(?!", list2.join("|"), ")");
      }
      const FUNCTION_CALL = {
        match: regex.concat(
          /\b/,
          noneOf([
            ...BUILT_IN_GLOBALS,
            "super",
            "import"
          ].map((x3) => `${x3}\\s*\\(`)),
          IDENT_RE$1,
          regex.lookahead(/\s*\(/)
        ),
        className: "title.function",
        relevance: 0
      };
      const PROPERTY_ACCESS = {
        begin: regex.concat(/\./, regex.lookahead(
          regex.concat(IDENT_RE$1, /(?![0-9A-Za-z$_(])/)
        )),
        end: IDENT_RE$1,
        excludeBegin: true,
        keywords: "prototype",
        className: "property",
        relevance: 0
      };
      const GETTER_OR_SETTER = {
        match: [
          /get|set/,
          /\s+/,
          IDENT_RE$1,
          /(?=\()/
        ],
        className: {
          1: "keyword",
          3: "title.function"
        },
        contains: [
          {
            // eat to avoid empty params
            begin: /\(\)/
          },
          PARAMS
        ]
      };
      const FUNC_LEAD_IN_RE = "(\\([^()]*(\\([^()]*(\\([^()]*\\)[^()]*)*\\)[^()]*)*\\)|" + hljs.UNDERSCORE_IDENT_RE + ")\\s*=>";
      const FUNCTION_VARIABLE = {
        match: [
          /const|var|let/,
          /\s+/,
          IDENT_RE$1,
          /\s*/,
          /=\s*/,
          /(async\s*)?/,
          // async is optional
          regex.lookahead(FUNC_LEAD_IN_RE)
        ],
        keywords: "async",
        className: {
          1: "keyword",
          3: "title.function"
        },
        contains: [
          PARAMS
        ]
      };
      return {
        name: "JavaScript",
        aliases: ["js", "jsx", "mjs", "cjs"],
        keywords: KEYWORDS$1,
        // this will be extended by TypeScript
        exports: { PARAMS_CONTAINS, CLASS_REFERENCE },
        illegal: /#(?![$_A-z])/,
        contains: [
          hljs.SHEBANG({
            label: "shebang",
            binary: "node",
            relevance: 5
          }),
          USE_STRICT,
          hljs.APOS_STRING_MODE,
          hljs.QUOTE_STRING_MODE,
          HTML_TEMPLATE,
          CSS_TEMPLATE,
          GRAPHQL_TEMPLATE,
          TEMPLATE_STRING,
          COMMENT,
          // Skip numbers when they are part of a variable name
          { match: /\$\d+/ },
          NUMBER,
          CLASS_REFERENCE,
          {
            scope: "attr",
            match: IDENT_RE$1 + regex.lookahead(":"),
            relevance: 0
          },
          FUNCTION_VARIABLE,
          {
            // "value" container
            begin: "(" + hljs.RE_STARTERS_RE + "|\\b(case|return|throw)\\b)\\s*",
            keywords: "return throw case",
            relevance: 0,
            contains: [
              COMMENT,
              hljs.REGEXP_MODE,
              {
                className: "function",
                // we have to count the parens to make sure we actually have the
                // correct bounding ( ) before the =>.  There could be any number of
                // sub-expressions inside also surrounded by parens.
                begin: FUNC_LEAD_IN_RE,
                returnBegin: true,
                end: "\\s*=>",
                contains: [
                  {
                    className: "params",
                    variants: [
                      {
                        begin: hljs.UNDERSCORE_IDENT_RE,
                        relevance: 0
                      },
                      {
                        className: null,
                        begin: /\(\s*\)/,
                        skip: true
                      },
                      {
                        begin: /(\s*)\(/,
                        end: /\)/,
                        excludeBegin: true,
                        excludeEnd: true,
                        keywords: KEYWORDS$1,
                        contains: PARAMS_CONTAINS
                      }
                    ]
                  }
                ]
              },
              {
                // could be a comma delimited list of params to a function call
                begin: /,/,
                relevance: 0
              },
              {
                match: /\s+/,
                relevance: 0
              },
              {
                // JSX
                variants: [
                  { begin: FRAGMENT.begin, end: FRAGMENT.end },
                  { match: XML_SELF_CLOSING },
                  {
                    begin: XML_TAG.begin,
                    // we carefully check the opening tag to see if it truly
                    // is a tag and not a false positive
                    "on:begin": XML_TAG.isTrulyOpeningTag,
                    end: XML_TAG.end
                  }
                ],
                subLanguage: "xml",
                contains: [
                  {
                    begin: XML_TAG.begin,
                    end: XML_TAG.end,
                    skip: true,
                    contains: ["self"]
                  }
                ]
              }
            ]
          },
          FUNCTION_DEFINITION,
          {
            // prevent this from getting swallowed up by function
            // since they appear "function like"
            beginKeywords: "while if switch catch for"
          },
          {
            // we have to count the parens to make sure we actually have the correct
            // bounding ( ).  There could be any number of sub-expressions inside
            // also surrounded by parens.
            begin: "\\b(?!function)" + hljs.UNDERSCORE_IDENT_RE + "\\([^()]*(\\([^()]*(\\([^()]*\\)[^()]*)*\\)[^()]*)*\\)\\s*\\{",
            // end parens
            returnBegin: true,
            label: "func.def",
            contains: [
              PARAMS,
              hljs.inherit(hljs.TITLE_MODE, { begin: IDENT_RE$1, className: "title.function" })
            ]
          },
          // catch ... so it won't trigger the property rule below
          {
            match: /\.\.\./,
            relevance: 0
          },
          PROPERTY_ACCESS,
          // hack: prevents detection of keywords in some circumstances
          // .keyword()
          // $keyword = x
          {
            match: "\\$" + IDENT_RE$1,
            relevance: 0
          },
          {
            match: [/\bconstructor(?=\s*\()/],
            className: { 1: "title.function" },
            contains: [PARAMS]
          },
          FUNCTION_CALL,
          UPPER_CASE_CONSTANT,
          CLASS_OR_EXTENDS,
          GETTER_OR_SETTER,
          {
            match: /\$[(.]/
            // relevance booster for a pattern common to JS libs: `$(something)` and `$.something`
          }
        ]
      };
    }
    function typescript(hljs) {
      const regex = hljs.regex;
      const tsLanguage = javascript(hljs);
      const IDENT_RE$1 = IDENT_RE;
      const TYPES2 = [
        "any",
        "void",
        "number",
        "boolean",
        "string",
        "object",
        "never",
        "symbol",
        "bigint",
        "unknown"
      ];
      const NAMESPACE = {
        begin: [
          /namespace/,
          /\s+/,
          hljs.IDENT_RE
        ],
        beginScope: {
          1: "keyword",
          3: "title.class"
        }
      };
      const INTERFACE = {
        beginKeywords: "interface",
        end: /\{/,
        excludeEnd: true,
        keywords: {
          keyword: "interface extends",
          built_in: TYPES2
        },
        contains: [tsLanguage.exports.CLASS_REFERENCE]
      };
      const USE_STRICT = {
        className: "meta",
        relevance: 10,
        begin: /^\s*['"]use strict['"]/
      };
      const TS_SPECIFIC_KEYWORDS = [
        "type",
        // "namespace",
        "interface",
        "public",
        "private",
        "protected",
        "implements",
        "declare",
        "abstract",
        "readonly",
        "enum",
        "override",
        "satisfies"
      ];
      const KEYWORDS$1 = {
        $pattern: IDENT_RE,
        keyword: KEYWORDS.concat(TS_SPECIFIC_KEYWORDS),
        literal: LITERALS,
        built_in: BUILT_INS.concat(TYPES2),
        "variable.language": BUILT_IN_VARIABLES
      };
      const DECORATOR = {
        className: "meta",
        begin: "@" + IDENT_RE$1
      };
      const swapMode = (mode, label, replacement) => {
        const indx = mode.contains.findIndex((m3) => m3.label === label);
        if (indx === -1) {
          throw new Error("can not find mode to replace");
        }
        mode.contains.splice(indx, 1, replacement);
      };
      Object.assign(tsLanguage.keywords, KEYWORDS$1);
      tsLanguage.exports.PARAMS_CONTAINS.push(DECORATOR);
      const ATTRIBUTE_HIGHLIGHT = tsLanguage.contains.find((c3) => c3.scope === "attr");
      const OPTIONAL_KEY_OR_ARGUMENT = Object.assign(
        {},
        ATTRIBUTE_HIGHLIGHT,
        { match: regex.concat(IDENT_RE$1, regex.lookahead(/\s*\?:/)) }
      );
      tsLanguage.exports.PARAMS_CONTAINS.push([
        tsLanguage.exports.CLASS_REFERENCE,
        // class reference for highlighting the params types
        ATTRIBUTE_HIGHLIGHT,
        // highlight the params key
        OPTIONAL_KEY_OR_ARGUMENT
        // Added for optional property assignment highlighting
      ]);
      tsLanguage.contains = tsLanguage.contains.concat([
        DECORATOR,
        NAMESPACE,
        INTERFACE,
        OPTIONAL_KEY_OR_ARGUMENT
        // Added for optional property assignment highlighting
      ]);
      swapMode(tsLanguage, "shebang", hljs.SHEBANG());
      swapMode(tsLanguage, "use_strict", USE_STRICT);
      const functionDeclaration = tsLanguage.contains.find((m3) => m3.label === "func.def");
      functionDeclaration.relevance = 0;
      Object.assign(tsLanguage, {
        name: "TypeScript",
        aliases: [
          "ts",
          "tsx",
          "mts",
          "cts"
        ]
      });
      return tsLanguage;
    }
    module.exports = typescript;
  }
});

// node_modules/highlight.js/lib/languages/vbnet.js
var require_vbnet = __commonJS({
  "node_modules/highlight.js/lib/languages/vbnet.js"(exports, module) {
    "use strict";
    function vbnet(hljs) {
      const regex = hljs.regex;
      const CHARACTER = {
        className: "string",
        begin: /"(""|[^/n])"C\b/
      };
      const STRING = {
        className: "string",
        begin: /"/,
        end: /"/,
        illegal: /\n/,
        contains: [
          {
            // double quote escape
            begin: /""/
          }
        ]
      };
      const MM_DD_YYYY = /\d{1,2}\/\d{1,2}\/\d{4}/;
      const YYYY_MM_DD = /\d{4}-\d{1,2}-\d{1,2}/;
      const TIME_12H = /(\d|1[012])(:\d+){0,2} *(AM|PM)/;
      const TIME_24H = /\d{1,2}(:\d{1,2}){1,2}/;
      const DATE = {
        className: "literal",
        variants: [
          {
            // #YYYY-MM-DD# (ISO-Date) or #M/D/YYYY# (US-Date)
            begin: regex.concat(/# */, regex.either(YYYY_MM_DD, MM_DD_YYYY), / *#/)
          },
          {
            // #H:mm[:ss]# (24h Time)
            begin: regex.concat(/# */, TIME_24H, / *#/)
          },
          {
            // #h[:mm[:ss]] A# (12h Time)
            begin: regex.concat(/# */, TIME_12H, / *#/)
          },
          {
            // date plus time
            begin: regex.concat(
              /# */,
              regex.either(YYYY_MM_DD, MM_DD_YYYY),
              / +/,
              regex.either(TIME_12H, TIME_24H),
              / *#/
            )
          }
        ]
      };
      const NUMBER = {
        className: "number",
        relevance: 0,
        variants: [
          {
            // Float
            begin: /\b\d[\d_]*((\.[\d_]+(E[+-]?[\d_]+)?)|(E[+-]?[\d_]+))[RFD@!#]?/
          },
          {
            // Integer (base 10)
            begin: /\b\d[\d_]*((U?[SIL])|[%&])?/
          },
          {
            // Integer (base 16)
            begin: /&H[\dA-F_]+((U?[SIL])|[%&])?/
          },
          {
            // Integer (base 8)
            begin: /&O[0-7_]+((U?[SIL])|[%&])?/
          },
          {
            // Integer (base 2)
            begin: /&B[01_]+((U?[SIL])|[%&])?/
          }
        ]
      };
      const LABEL = {
        className: "label",
        begin: /^\w+:/
      };
      const DOC_COMMENT = hljs.COMMENT(/'''/, /$/, { contains: [
        {
          className: "doctag",
          begin: /<\/?/,
          end: />/
        }
      ] });
      const COMMENT = hljs.COMMENT(null, /$/, { variants: [
        { begin: /'/ },
        {
          // TODO: Use multi-class for leading spaces
          begin: /([\t ]|^)REM(?=\s)/
        }
      ] });
      const DIRECTIVES = {
        className: "meta",
        // TODO: Use multi-class for indentation once available
        begin: /[\t ]*#(const|disable|else|elseif|enable|end|externalsource|if|region)\b/,
        end: /$/,
        keywords: { keyword: "const disable else elseif enable end externalsource if region then" },
        contains: [COMMENT]
      };
      return {
        name: "Visual Basic .NET",
        aliases: ["vb"],
        case_insensitive: true,
        classNameAliases: { label: "symbol" },
        keywords: {
          keyword: "addhandler alias aggregate ansi as async assembly auto binary by byref byval call case catch class compare const continue custom declare default delegate dim distinct do each equals else elseif end enum erase error event exit explicit finally for friend from function get global goto group handles if implements imports in inherits interface into iterator join key let lib loop me mid module mustinherit mustoverride mybase myclass namespace narrowing new next notinheritable notoverridable of off on operator option optional order overloads overridable overrides paramarray partial preserve private property protected public raiseevent readonly redim removehandler resume return select set shadows shared skip static step stop structure strict sub synclock take text then throw to try unicode until using when where while widening with withevents writeonly yield",
          built_in: (
            // Operators https://docs.microsoft.com/dotnet/visual-basic/language-reference/operators
            "addressof and andalso await directcast gettype getxmlnamespace is isfalse isnot istrue like mod nameof new not or orelse trycast typeof xor cbool cbyte cchar cdate cdbl cdec cint clng cobj csbyte cshort csng cstr cuint culng cushort"
          ),
          type: (
            // Data types https://docs.microsoft.com/dotnet/visual-basic/language-reference/data-types
            "boolean byte char date decimal double integer long object sbyte short single string uinteger ulong ushort"
          ),
          literal: "true false nothing"
        },
        illegal: "//|\\{|\\}|endif|gosub|variant|wend|^\\$ ",
        contains: [
          CHARACTER,
          STRING,
          DATE,
          NUMBER,
          LABEL,
          DOC_COMMENT,
          COMMENT,
          DIRECTIVES
        ]
      };
    }
    module.exports = vbnet;
  }
});

// node_modules/highlight.js/lib/languages/wasm.js
var require_wasm = __commonJS({
  "node_modules/highlight.js/lib/languages/wasm.js"(exports, module) {
    "use strict";
    function wasm(hljs) {
      hljs.regex;
      const BLOCK_COMMENT = hljs.COMMENT(/\(;/, /;\)/);
      BLOCK_COMMENT.contains.push("self");
      const LINE_COMMENT = hljs.COMMENT(/;;/, /$/);
      const KWS = [
        "anyfunc",
        "block",
        "br",
        "br_if",
        "br_table",
        "call",
        "call_indirect",
        "data",
        "drop",
        "elem",
        "else",
        "end",
        "export",
        "func",
        "global.get",
        "global.set",
        "local.get",
        "local.set",
        "local.tee",
        "get_global",
        "get_local",
        "global",
        "if",
        "import",
        "local",
        "loop",
        "memory",
        "memory.grow",
        "memory.size",
        "module",
        "mut",
        "nop",
        "offset",
        "param",
        "result",
        "return",
        "select",
        "set_global",
        "set_local",
        "start",
        "table",
        "tee_local",
        "then",
        "type",
        "unreachable"
      ];
      const FUNCTION_REFERENCE = {
        begin: [
          /(?:func|call|call_indirect)/,
          /\s+/,
          /\$[^\s)]+/
        ],
        className: {
          1: "keyword",
          3: "title.function"
        }
      };
      const ARGUMENT = {
        className: "variable",
        begin: /\$[\w_]+/
      };
      const PARENS = {
        match: /(\((?!;)|\))+/,
        className: "punctuation",
        relevance: 0
      };
      const NUMBER = {
        className: "number",
        relevance: 0,
        // borrowed from Prism, TODO: split out into variants
        match: /[+-]?\b(?:\d(?:_?\d)*(?:\.\d(?:_?\d)*)?(?:[eE][+-]?\d(?:_?\d)*)?|0x[\da-fA-F](?:_?[\da-fA-F])*(?:\.[\da-fA-F](?:_?[\da-fA-D])*)?(?:[pP][+-]?\d(?:_?\d)*)?)\b|\binf\b|\bnan(?::0x[\da-fA-F](?:_?[\da-fA-D])*)?\b/
      };
      const TYPE = {
        // look-ahead prevents us from gobbling up opcodes
        match: /(i32|i64|f32|f64)(?!\.)/,
        className: "type"
      };
      const MATH_OPERATIONS = {
        className: "keyword",
        // borrowed from Prism, TODO: split out into variants
        match: /\b(f32|f64|i32|i64)(?:\.(?:abs|add|and|ceil|clz|const|convert_[su]\/i(?:32|64)|copysign|ctz|demote\/f64|div(?:_[su])?|eqz?|extend_[su]\/i32|floor|ge(?:_[su])?|gt(?:_[su])?|le(?:_[su])?|load(?:(?:8|16|32)_[su])?|lt(?:_[su])?|max|min|mul|nearest|neg?|or|popcnt|promote\/f32|reinterpret\/[fi](?:32|64)|rem_[su]|rot[lr]|shl|shr_[su]|store(?:8|16|32)?|sqrt|sub|trunc(?:_[su]\/f(?:32|64))?|wrap\/i64|xor))\b/
      };
      const OFFSET_ALIGN = {
        match: [
          /(?:offset|align)/,
          /\s*/,
          /=/
        ],
        className: {
          1: "keyword",
          3: "operator"
        }
      };
      return {
        name: "WebAssembly",
        keywords: {
          $pattern: /[\w.]+/,
          keyword: KWS
        },
        contains: [
          LINE_COMMENT,
          BLOCK_COMMENT,
          OFFSET_ALIGN,
          ARGUMENT,
          PARENS,
          FUNCTION_REFERENCE,
          hljs.QUOTE_STRING_MODE,
          TYPE,
          MATH_OPERATIONS,
          NUMBER
        ]
      };
    }
    module.exports = wasm;
  }
});

// node_modules/highlight.js/lib/common.js
var require_common = __commonJS({
  "node_modules/highlight.js/lib/common.js"(exports, module) {
    "use strict";
    var hljs = require_core();
    hljs.registerLanguage("xml", require_xml());
    hljs.registerLanguage("bash", require_bash());
    hljs.registerLanguage("c", require_c());
    hljs.registerLanguage("cpp", require_cpp());
    hljs.registerLanguage("csharp", require_csharp());
    hljs.registerLanguage("css", require_css());
    hljs.registerLanguage("markdown", require_markdown());
    hljs.registerLanguage("diff", require_diff());
    hljs.registerLanguage("ruby", require_ruby());
    hljs.registerLanguage("go", require_go());
    hljs.registerLanguage("graphql", require_graphql());
    hljs.registerLanguage("ini", require_ini());
    hljs.registerLanguage("java", require_java());
    hljs.registerLanguage("javascript", require_javascript());
    hljs.registerLanguage("json", require_json());
    hljs.registerLanguage("kotlin", require_kotlin());
    hljs.registerLanguage("less", require_less());
    hljs.registerLanguage("lua", require_lua());
    hljs.registerLanguage("makefile", require_makefile());
    hljs.registerLanguage("perl", require_perl());
    hljs.registerLanguage("objectivec", require_objectivec());
    hljs.registerLanguage("php", require_php());
    hljs.registerLanguage("php-template", require_php_template());
    hljs.registerLanguage("plaintext", require_plaintext());
    hljs.registerLanguage("python", require_python());
    hljs.registerLanguage("python-repl", require_python_repl());
    hljs.registerLanguage("r", require_r());
    hljs.registerLanguage("rust", require_rust());
    hljs.registerLanguage("scss", require_scss());
    hljs.registerLanguage("shell", require_shell());
    hljs.registerLanguage("sql", require_sql());
    hljs.registerLanguage("swift", require_swift());
    hljs.registerLanguage("yaml", require_yaml());
    hljs.registerLanguage("typescript", require_typescript());
    hljs.registerLanguage("vbnet", require_vbnet());
    hljs.registerLanguage("wasm", require_wasm());
    hljs.HighlightJS = hljs;
    hljs.default = hljs;
    module.exports = hljs;
  }
});

// node_modules/uplot/dist/uPlot.esm.js
var uPlot_esm_exports = {};
__export(uPlot_esm_exports, {
  default: () => uPlot
});
function setPxRatio() {
  let _pxRatio = devicePixelRatio;
  if (pxRatio != _pxRatio) {
    pxRatio = _pxRatio;
    query && off(change, query, setPxRatio);
    query = matchMedia(`(min-resolution: ${pxRatio - 1e-3}dppx) and (max-resolution: ${pxRatio + 1e-3}dppx)`);
    on2(change, query, setPxRatio);
    win.dispatchEvent(new CustomEvent(dppxchange));
  }
}
function addClass(el, c3) {
  if (c3 != null) {
    let cl = el.classList;
    !cl.contains(c3) && cl.add(c3);
  }
}
function remClass(el, c3) {
  let cl = el.classList;
  cl.contains(c3) && cl.remove(c3);
}
function setStylePx(el, name, value) {
  el.style[name] = value + "px";
}
function placeTag(tag2, cls, targ, refEl) {
  let el = doc.createElement(tag2);
  if (cls != null)
    addClass(el, cls);
  if (targ != null)
    targ.insertBefore(el, refEl);
  return el;
}
function placeDiv(cls, targ) {
  return placeTag("div", cls, targ);
}
function elTrans(el, xPos, yPos, xMax, yMax) {
  let xform = "translate(" + xPos + "px," + yPos + "px)";
  let xformOld = xformCache.get(el);
  if (xform != xformOld) {
    el.style.transform = xform;
    xformCache.set(el, xform);
    if (xPos < 0 || yPos < 0 || xPos > xMax || yPos > yMax)
      addClass(el, OFF);
    else
      remClass(el, OFF);
  }
}
function elColor(el, background, borderColor) {
  let newColor = background + borderColor;
  let oldColor = colorCache.get(el);
  if (newColor != oldColor) {
    colorCache.set(el, newColor);
    el.style.background = background;
    el.style.borderColor = borderColor;
  }
}
function elSize(el, newWid, newHgt, centered) {
  let newSize = newWid + "" + newHgt;
  let oldSize = sizeCache.get(el);
  if (newSize != oldSize) {
    sizeCache.set(el, newSize);
    el.style.height = newHgt + "px";
    el.style.width = newWid + "px";
    el.style.marginLeft = centered ? -newWid / 2 + "px" : 0;
    el.style.marginTop = centered ? -newHgt / 2 + "px" : 0;
  }
}
function on2(ev, el, cb, capt) {
  el.addEventListener(ev, cb, capt ? evOpts2 : evOpts);
}
function off(ev, el, cb, capt) {
  el.removeEventListener(ev, cb, evOpts);
}
function closestIdx(num, arr, lo, hi) {
  let mid;
  lo = lo || 0;
  hi = hi || arr.length - 1;
  let bitwise = hi <= 2147483647;
  while (hi - lo > 1) {
    mid = bitwise ? lo + hi >> 1 : floor((lo + hi) / 2);
    if (arr[mid] < num)
      lo = mid;
    else
      hi = mid;
  }
  if (num - arr[lo] <= arr[hi] - num)
    return lo;
  return hi;
}
function makeIndexOfs(predicate) {
  let indexOfs = (data, _i0, _i1) => {
    let i0 = -1;
    let i1 = -1;
    for (let i3 = _i0; i3 <= _i1; i3++) {
      if (predicate(data[i3])) {
        i0 = i3;
        break;
      }
    }
    for (let i3 = _i1; i3 >= _i0; i3--) {
      if (predicate(data[i3])) {
        i1 = i3;
        break;
      }
    }
    return [i0, i1];
  };
  return indexOfs;
}
function getMinMax(data, _i0, _i1, sorted = 0, log = false) {
  let getEdgeIdxs = log ? positiveIdxs : nonNullIdxs;
  let predicate = log ? isPositive : notNullish;
  [_i0, _i1] = getEdgeIdxs(data, _i0, _i1);
  let _min = data[_i0];
  let _max = data[_i0];
  if (_i0 > -1) {
    if (sorted == 1) {
      _min = data[_i0];
      _max = data[_i1];
    } else if (sorted == -1) {
      _min = data[_i1];
      _max = data[_i0];
    } else {
      for (let i3 = _i0; i3 <= _i1; i3++) {
        let v3 = data[i3];
        if (predicate(v3)) {
          if (v3 < _min)
            _min = v3;
          else if (v3 > _max)
            _max = v3;
        }
      }
    }
  }
  return [_min ?? inf, _max ?? -inf];
}
function rangeLog(min2, max2, base, fullMags) {
  let minSign = sign(min2);
  let maxSign = sign(max2);
  if (min2 == max2) {
    if (minSign == -1) {
      min2 *= base;
      max2 /= base;
    } else {
      min2 /= base;
      max2 *= base;
    }
  }
  let logFn = base == 10 ? log10 : log2;
  let growMinAbs = minSign == 1 ? floor : ceil;
  let growMaxAbs = maxSign == 1 ? ceil : floor;
  let minExp = growMinAbs(logFn(abs(min2)));
  let maxExp = growMaxAbs(logFn(abs(max2)));
  let minIncr = pow(base, minExp);
  let maxIncr = pow(base, maxExp);
  if (base == 10) {
    if (minExp < 0)
      minIncr = roundDec(minIncr, -minExp);
    if (maxExp < 0)
      maxIncr = roundDec(maxIncr, -maxExp);
  }
  if (fullMags || base == 2) {
    min2 = minIncr * minSign;
    max2 = maxIncr * maxSign;
  } else {
    min2 = incrRoundDn(min2, minIncr);
    max2 = incrRoundUp(max2, maxIncr);
  }
  return [min2, max2];
}
function rangeAsinh(min2, max2, base, fullMags) {
  let minMax = rangeLog(min2, max2, base, fullMags);
  if (min2 == 0)
    minMax[0] = 0;
  if (max2 == 0)
    minMax[1] = 0;
  return minMax;
}
function rangeNum(_min, _max, mult, extra) {
  if (isObj(mult))
    return _rangeNum(_min, _max, mult);
  _eqRangePart.pad = mult;
  _eqRangePart.soft = extra ? 0 : null;
  _eqRangePart.mode = extra ? 3 : 0;
  return _rangeNum(_min, _max, _eqRange);
}
function ifNull(lh, rh) {
  return lh == null ? rh : lh;
}
function hasData(data, idx0, idx1) {
  idx0 = ifNull(idx0, 0);
  idx1 = ifNull(idx1, data.length - 1);
  while (idx0 <= idx1) {
    if (data[idx0] != null)
      return true;
    idx0++;
  }
  return false;
}
function _rangeNum(_min, _max, cfg) {
  let cmin = cfg.min;
  let cmax = cfg.max;
  let padMin = ifNull(cmin.pad, 0);
  let padMax = ifNull(cmax.pad, 0);
  let hardMin = ifNull(cmin.hard, -inf);
  let hardMax = ifNull(cmax.hard, inf);
  let softMin = ifNull(cmin.soft, inf);
  let softMax = ifNull(cmax.soft, -inf);
  let softMinMode = ifNull(cmin.mode, 0);
  let softMaxMode = ifNull(cmax.mode, 0);
  let delta = _max - _min;
  let deltaMag = log10(delta);
  let scalarMax = max(abs(_min), abs(_max));
  let scalarMag = log10(scalarMax);
  let scalarMagDelta = abs(scalarMag - deltaMag);
  if (delta < 1e-24 || scalarMagDelta > 10) {
    delta = 0;
    if (_min == 0 || _max == 0) {
      delta = 1e-24;
      if (softMinMode == 2 && softMin != inf)
        padMin = 0;
      if (softMaxMode == 2 && softMax != -inf)
        padMax = 0;
    }
  }
  let nonZeroDelta = delta || scalarMax || 1e3;
  let mag = log10(nonZeroDelta);
  let base = pow(10, floor(mag));
  let _padMin = nonZeroDelta * (delta == 0 ? _min == 0 ? 0.1 : 1 : padMin);
  let _newMin = roundDec(incrRoundDn(_min - _padMin, base / 10), 24);
  let _softMin = _min >= softMin && (softMinMode == 1 || softMinMode == 3 && _newMin <= softMin || softMinMode == 2 && _newMin >= softMin) ? softMin : inf;
  let minLim = max(hardMin, _newMin < _softMin && _min >= _softMin ? _softMin : min(_softMin, _newMin));
  let _padMax = nonZeroDelta * (delta == 0 ? _max == 0 ? 0.1 : 1 : padMax);
  let _newMax = roundDec(incrRoundUp(_max + _padMax, base / 10), 24);
  let _softMax = _max <= softMax && (softMaxMode == 1 || softMaxMode == 3 && _newMax >= softMax || softMaxMode == 2 && _newMax <= softMax) ? softMax : -inf;
  let maxLim = min(hardMax, _newMax > _softMax && _max <= _softMax ? _softMax : max(_softMax, _newMax));
  if (minLim == maxLim && minLim == 0)
    maxLim = 100;
  return [minLim, maxLim];
}
function numIntDigits(x3) {
  return (log10((x3 ^ x3 >> 31) - (x3 >> 31)) | 0) + 1;
}
function clamp(num, _min, _max) {
  return min(max(num, _min), _max);
}
function isFn(v3) {
  return typeof v3 == "function";
}
function fnOrSelf(v3) {
  return isFn(v3) ? v3 : () => v3;
}
function incrRound(num, incr) {
  return fixFloat(roundDec(fixFloat(num / incr)) * incr);
}
function incrRoundUp(num, incr) {
  return fixFloat(ceil(fixFloat(num / incr)) * incr);
}
function incrRoundDn(num, incr) {
  return fixFloat(floor(fixFloat(num / incr)) * incr);
}
function roundDec(val, dec = 0) {
  if (isInt(val))
    return val;
  let p3 = 10 ** dec;
  let n3 = val * p3 * (1 + Number.EPSILON);
  return round(n3) / p3;
}
function guessDec(num) {
  return (("" + num).split(".")[1] || "").length;
}
function genIncrs(base, minExp, maxExp, mults) {
  let incrs = [];
  let multDec = mults.map(guessDec);
  for (let exp = minExp; exp < maxExp; exp++) {
    let expa = abs(exp);
    let mag = roundDec(pow(base, exp), expa);
    for (let i3 = 0; i3 < mults.length; i3++) {
      let _incr = base == 10 ? +`${mults[i3]}e${exp}` : mults[i3] * mag;
      let dec = (exp >= 0 ? 0 : expa) + (exp >= multDec[i3] ? 0 : multDec[i3]);
      let incr = base == 10 ? _incr : roundDec(_incr, dec);
      incrs.push(incr);
      fixedDec.set(incr, dec);
    }
  }
  return incrs;
}
function isStr(v3) {
  return typeof v3 == "string";
}
function isObj(v3) {
  let is = false;
  if (v3 != null) {
    let c3 = v3.constructor;
    is = c3 == null || c3 == Object;
  }
  return is;
}
function fastIsObj(v3) {
  return v3 != null && typeof v3 == "object";
}
function copy(o3, _isObj = isObj) {
  let out;
  if (isArr(o3)) {
    let val = o3.find((v3) => v3 != null);
    if (isArr(val) || _isObj(val)) {
      out = Array(o3.length);
      for (let i3 = 0; i3 < o3.length; i3++)
        out[i3] = copy(o3[i3], _isObj);
    } else
      out = o3.slice();
  } else if (o3 instanceof TypedArray)
    out = o3.slice();
  else if (_isObj(o3)) {
    out = {};
    for (let k3 in o3) {
      if (k3 != __proto__)
        out[k3] = copy(o3[k3], _isObj);
    }
  } else
    out = o3;
  return out;
}
function assign(targ) {
  let args = arguments;
  for (let i3 = 1; i3 < args.length; i3++) {
    let src = args[i3];
    for (let key in src) {
      if (key != __proto__) {
        if (isObj(targ[key]))
          assign(targ[key], copy(src[key]));
        else
          targ[key] = copy(src[key]);
      }
    }
  }
  return targ;
}
function nullExpand(yVals, nullIdxs, alignedLen) {
  for (let i3 = 0, xi, lastNullIdx = -1; i3 < nullIdxs.length; i3++) {
    let nullIdx = nullIdxs[i3];
    if (nullIdx > lastNullIdx) {
      xi = nullIdx - 1;
      while (xi >= 0 && yVals[xi] == null)
        yVals[xi--] = null;
      xi = nullIdx + 1;
      while (xi < alignedLen && yVals[xi] == null)
        yVals[lastNullIdx = xi++] = null;
    }
  }
}
function join(tables, nullModes) {
  if (allHeadersSame(tables)) {
    let table = tables[0].slice();
    for (let i3 = 1; i3 < tables.length; i3++)
      table.push(...tables[i3].slice(1));
    if (!isAsc(table[0]))
      table = sortCols(table);
    return table;
  }
  let xVals = /* @__PURE__ */ new Set();
  for (let ti = 0; ti < tables.length; ti++) {
    let t5 = tables[ti];
    let xs = t5[0];
    let len = xs.length;
    for (let i3 = 0; i3 < len; i3++)
      xVals.add(xs[i3]);
  }
  let data = [Array.from(xVals).sort((a3, b2) => a3 - b2)];
  let alignedLen = data[0].length;
  let xIdxs = /* @__PURE__ */ new Map();
  for (let i3 = 0; i3 < alignedLen; i3++)
    xIdxs.set(data[0][i3], i3);
  for (let ti = 0; ti < tables.length; ti++) {
    let t5 = tables[ti];
    let xs = t5[0];
    for (let si = 1; si < t5.length; si++) {
      let ys = t5[si];
      let yVals = Array(alignedLen).fill(void 0);
      let nullMode = nullModes ? nullModes[ti][si] : NULL_RETAIN;
      let nullIdxs = [];
      for (let i3 = 0; i3 < ys.length; i3++) {
        let yVal = ys[i3];
        let alignedIdx = xIdxs.get(xs[i3]);
        if (yVal === null) {
          if (nullMode != NULL_REMOVE) {
            yVals[alignedIdx] = yVal;
            if (nullMode == NULL_EXPAND)
              nullIdxs.push(alignedIdx);
          }
        } else
          yVals[alignedIdx] = yVal;
      }
      nullExpand(yVals, nullIdxs, alignedLen);
      data.push(yVals);
    }
  }
  return data;
}
function sortCols(table) {
  let head = table[0];
  let rlen = head.length;
  let idxs = Array(rlen);
  for (let i3 = 0; i3 < idxs.length; i3++)
    idxs[i3] = i3;
  idxs.sort((i0, i1) => head[i0] - head[i1]);
  let table2 = [];
  for (let i3 = 0; i3 < table.length; i3++) {
    let row = table[i3];
    let row2 = Array(rlen);
    for (let j4 = 0; j4 < rlen; j4++)
      row2[j4] = row[idxs[j4]];
    table2.push(row2);
  }
  return table2;
}
function allHeadersSame(tables) {
  let vals0 = tables[0][0];
  let len0 = vals0.length;
  for (let i3 = 1; i3 < tables.length; i3++) {
    let vals1 = tables[i3][0];
    if (vals1.length != len0)
      return false;
    if (vals1 != vals0) {
      for (let j4 = 0; j4 < len0; j4++) {
        if (vals1[j4] != vals0[j4])
          return false;
      }
    }
  }
  return true;
}
function isAsc(vals, samples = 100) {
  const len = vals.length;
  if (len <= 1)
    return true;
  let firstIdx = 0;
  let lastIdx = len - 1;
  while (firstIdx <= lastIdx && vals[firstIdx] == null)
    firstIdx++;
  while (lastIdx >= firstIdx && vals[lastIdx] == null)
    lastIdx--;
  if (lastIdx <= firstIdx)
    return true;
  const stride = max(1, floor((lastIdx - firstIdx + 1) / samples));
  for (let prevVal = vals[firstIdx], i3 = firstIdx + stride; i3 <= lastIdx; i3 += stride) {
    const v3 = vals[i3];
    if (v3 != null) {
      if (v3 <= prevVal)
        return false;
      prevVal = v3;
    }
  }
  return true;
}
function slice3(str) {
  return str.slice(0, 3);
}
function zeroPad2(int) {
  return (int < 10 ? "0" : "") + int;
}
function zeroPad3(int) {
  return (int < 10 ? "00" : int < 100 ? "0" : "") + int;
}
function fmtDate(tpl, names) {
  names = names || engNames;
  let parts = [];
  let R2 = /\{([a-z]+)\}|[^{]+/gi, m3;
  while (m3 = R2.exec(tpl))
    parts.push(m3[0][0] == "{" ? subs[m3[1]] : m3[0]);
  return (d3) => {
    let out = "";
    for (let i3 = 0; i3 < parts.length; i3++)
      out += typeof parts[i3] == "string" ? parts[i3] : parts[i3](d3, names);
    return out;
  };
}
function tzDate(date, tz) {
  let date2;
  if (tz == "UTC" || tz == "Etc/UTC")
    date2 = new Date(+date + date.getTimezoneOffset() * 6e4);
  else if (tz == localTz)
    date2 = date;
  else {
    date2 = new Date(date.toLocaleString("en-US", { timeZone: tz }));
    date2.setMilliseconds(date.getMilliseconds());
  }
  return date2;
}
function genTimeStuffs(ms) {
  let s3 = ms * 1e3, m3 = s3 * 60, h3 = m3 * 60, d3 = h3 * 24, mo = d3 * 30, y3 = d3 * 365;
  let subSecIncrs = ms == 1 ? genIncrs(10, 0, 3, allMults).filter(onlyWhole) : genIncrs(10, -3, 0, allMults);
  let timeIncrs = subSecIncrs.concat([
    // minute divisors (# of secs)
    s3,
    s3 * 5,
    s3 * 10,
    s3 * 15,
    s3 * 30,
    // hour divisors (# of mins)
    m3,
    m3 * 5,
    m3 * 10,
    m3 * 15,
    m3 * 30,
    // day divisors (# of hrs)
    h3,
    h3 * 2,
    h3 * 3,
    h3 * 4,
    h3 * 6,
    h3 * 8,
    h3 * 12,
    // month divisors TODO: need more?
    d3,
    d3 * 2,
    d3 * 3,
    d3 * 4,
    d3 * 5,
    d3 * 6,
    d3 * 7,
    d3 * 8,
    d3 * 9,
    d3 * 10,
    d3 * 15,
    // year divisors (# months, approx)
    mo,
    mo * 2,
    mo * 3,
    mo * 4,
    mo * 6,
    // century divisors
    y3,
    y3 * 2,
    y3 * 5,
    y3 * 10,
    y3 * 25,
    y3 * 50,
    y3 * 100
  ]);
  const _timeAxisStamps = [
    //   tick incr    default          year                    month   day                   hour    min       sec   mode
    [y3, yyyy, _3, _3, _3, _3, _3, _3, 1],
    [d3 * 28, "{MMM}", NLyyyy, _3, _3, _3, _3, _3, 1],
    [d3, md, NLyyyy, _3, _3, _3, _3, _3, 1],
    [h3, "{h}" + aa, NLmdyy, _3, NLmd, _3, _3, _3, 1],
    [m3, hmmaa, NLmdyy, _3, NLmd, _3, _3, _3, 1],
    [s3, ss, NLmdyy + " " + hmmaa, _3, NLmd + " " + hmmaa, _3, NLhmmaa, _3, 1],
    [ms, ss + ".{fff}", NLmdyy + " " + hmmaa, _3, NLmd + " " + hmmaa, _3, NLhmmaa, _3, 1]
  ];
  function timeAxisSplits(tzDate2) {
    return (self, axisIdx, scaleMin, scaleMax, foundIncr, foundSpace) => {
      let splits = [];
      let isYr = foundIncr >= y3;
      let isMo = foundIncr >= mo && foundIncr < y3;
      let minDate = tzDate2(scaleMin);
      let minDateTs = roundDec(minDate * ms, 3);
      let minMin = mkDate(minDate.getFullYear(), isYr ? 0 : minDate.getMonth(), isMo || isYr ? 1 : minDate.getDate());
      let minMinTs = roundDec(minMin * ms, 3);
      if (isMo || isYr) {
        let moIncr = isMo ? foundIncr / mo : 0;
        let yrIncr = isYr ? foundIncr / y3 : 0;
        let split = minDateTs == minMinTs ? minDateTs : roundDec(mkDate(minMin.getFullYear() + yrIncr, minMin.getMonth() + moIncr, 1) * ms, 3);
        let splitDate = new Date(round(split / ms));
        let baseYear = splitDate.getFullYear();
        let baseMonth = splitDate.getMonth();
        for (let i3 = 0; split <= scaleMax; i3++) {
          let next = mkDate(baseYear + yrIncr * i3, baseMonth + moIncr * i3, 1);
          let offs = next - tzDate2(roundDec(next * ms, 3));
          split = roundDec((+next + offs) * ms, 3);
          if (split <= scaleMax)
            splits.push(split);
        }
      } else {
        let incr0 = foundIncr >= d3 ? d3 : foundIncr;
        let tzOffset = floor(scaleMin) - floor(minDateTs);
        let split = minMinTs + tzOffset + incrRoundUp(minDateTs - minMinTs, incr0);
        splits.push(split);
        let date0 = tzDate2(split);
        let prevHour = date0.getHours() + date0.getMinutes() / m3 + date0.getSeconds() / h3;
        let incrHours = foundIncr / h3;
        let minSpace = self.axes[axisIdx]._space;
        let pctSpace = foundSpace / minSpace;
        while (1) {
          split = roundDec(split + foundIncr, ms == 1 ? 0 : 3);
          if (split > scaleMax)
            break;
          if (incrHours > 1) {
            let expectedHour = floor(roundDec(prevHour + incrHours, 6)) % 24;
            let splitDate = tzDate2(split);
            let actualHour = splitDate.getHours();
            let dstShift = actualHour - expectedHour;
            if (dstShift > 1)
              dstShift = -1;
            split -= dstShift * h3;
            prevHour = (prevHour + incrHours) % 24;
            let prevSplit = splits[splits.length - 1];
            let pctIncr = roundDec((split - prevSplit) / foundIncr, 3);
            if (pctIncr * pctSpace >= 0.7)
              splits.push(split);
          } else
            splits.push(split);
        }
      }
      return splits;
    };
  }
  return [
    timeIncrs,
    _timeAxisStamps,
    timeAxisSplits
  ];
}
function timeAxisStamps(stampCfg, fmtDate2) {
  return stampCfg.map((s3) => s3.map(
    (v3, i3) => i3 == 0 || i3 == 8 || v3 == null ? v3 : fmtDate2(i3 == 1 || s3[8] == 0 ? v3 : s3[1] + v3)
  ));
}
function timeAxisVals(tzDate2, stamps) {
  return (self, splits, axisIdx, foundSpace, foundIncr) => {
    let s3 = stamps.find((s4) => foundIncr >= s4[0]) || stamps[stamps.length - 1];
    let prevYear;
    let prevMnth;
    let prevDate;
    let prevHour;
    let prevMins;
    let prevSecs;
    return splits.map((split) => {
      let date = tzDate2(split);
      let newYear = date.getFullYear();
      let newMnth = date.getMonth();
      let newDate = date.getDate();
      let newHour = date.getHours();
      let newMins = date.getMinutes();
      let newSecs = date.getSeconds();
      let stamp = newYear != prevYear && s3[2] || newMnth != prevMnth && s3[3] || newDate != prevDate && s3[4] || newHour != prevHour && s3[5] || newMins != prevMins && s3[6] || newSecs != prevSecs && s3[7] || s3[1];
      prevYear = newYear;
      prevMnth = newMnth;
      prevDate = newDate;
      prevHour = newHour;
      prevMins = newMins;
      prevSecs = newSecs;
      return stamp(date);
    });
  };
}
function timeAxisVal(tzDate2, dateTpl) {
  let stamp = fmtDate(dateTpl);
  return (self, splits, axisIdx, foundSpace, foundIncr) => splits.map((split) => stamp(tzDate2(split)));
}
function mkDate(y3, m3, d3) {
  return new Date(y3, m3, d3);
}
function timeSeriesStamp(stampCfg, fmtDate2) {
  return fmtDate2(stampCfg);
}
function timeSeriesVal(tzDate2, stamp) {
  return (self, val, seriesIdx, dataIdx) => dataIdx == null ? LEGEND_DISP : stamp(tzDate2(val));
}
function legendStroke(self, seriesIdx) {
  let s3 = self.series[seriesIdx];
  return s3.width ? s3.stroke(self, seriesIdx) : s3.points.width ? s3.points.stroke(self, seriesIdx) : null;
}
function legendFill(self, seriesIdx) {
  return self.series[seriesIdx].fill(self, seriesIdx);
}
function cursorPointShow(self, si) {
  let o3 = self.cursor.points;
  let pt = placeDiv();
  let size = o3.size(self, si);
  setStylePx(pt, WIDTH, size);
  setStylePx(pt, HEIGHT, size);
  let mar = size / -2;
  setStylePx(pt, "marginLeft", mar);
  setStylePx(pt, "marginTop", mar);
  let width = o3.width(self, si, size);
  width && setStylePx(pt, "borderWidth", width);
  return pt;
}
function cursorPointFill(self, si) {
  let sp = self.series[si].points;
  return sp._fill || sp._stroke;
}
function cursorPointStroke(self, si) {
  let sp = self.series[si].points;
  return sp._stroke || sp._fill;
}
function cursorPointSize(self, si) {
  let sp = self.series[si].points;
  return sp.size;
}
function cursorMove(self, mouseLeft1, mouseTop1) {
  moveTuple[0] = mouseLeft1;
  moveTuple[1] = mouseTop1;
  return moveTuple;
}
function filtBtn0(self, targ, handle, onlyTarg = true) {
  return (e3) => {
    e3.button == 0 && (!onlyTarg || e3.target == targ) && handle(e3);
  };
}
function filtTarg(self, targ, handle, onlyTarg = true) {
  return (e3) => {
    (!onlyTarg || e3.target == targ) && handle(e3);
  };
}
function numAxisVals(self, splits, axisIdx, foundSpace, foundIncr) {
  return splits.map((v3) => v3 == null ? "" : fmtNum2(v3));
}
function numAxisSplits(self, axisIdx, scaleMin, scaleMax, foundIncr, foundSpace, forceMin) {
  let splits = [];
  let numDec = fixedDec.get(foundIncr) || 0;
  scaleMin = forceMin ? scaleMin : roundDec(incrRoundUp(scaleMin, foundIncr), numDec);
  for (let val = scaleMin; val <= scaleMax; val = roundDec(val + foundIncr, numDec))
    splits.push(Object.is(val, -0) ? 0 : val);
  return splits;
}
function logAxisSplits(self, axisIdx, scaleMin, scaleMax, foundIncr, foundSpace, forceMin) {
  const splits = [];
  const logBase = self.scales[self.axes[axisIdx].scale].log;
  const logFn = logBase == 10 ? log10 : log2;
  const exp = floor(logFn(scaleMin));
  foundIncr = pow(logBase, exp);
  if (logBase == 10)
    foundIncr = numIncrs[closestIdx(foundIncr, numIncrs)];
  let split = scaleMin;
  let nextMagIncr = foundIncr * logBase;
  if (logBase == 10)
    nextMagIncr = numIncrs[closestIdx(nextMagIncr, numIncrs)];
  do {
    splits.push(split);
    split = split + foundIncr;
    if (logBase == 10 && !fixedDec.has(split))
      split = roundDec(split, fixedDec.get(foundIncr));
    if (split >= nextMagIncr) {
      foundIncr = split;
      nextMagIncr = foundIncr * logBase;
      if (logBase == 10)
        nextMagIncr = numIncrs[closestIdx(nextMagIncr, numIncrs)];
    }
  } while (split <= scaleMax);
  return splits;
}
function asinhAxisSplits(self, axisIdx, scaleMin, scaleMax, foundIncr, foundSpace, forceMin) {
  let sc = self.scales[self.axes[axisIdx].scale];
  let linthresh = sc.asinh;
  let posSplits = scaleMax > linthresh ? logAxisSplits(self, axisIdx, max(linthresh, scaleMin), scaleMax, foundIncr) : [linthresh];
  let zero = scaleMax >= 0 && scaleMin <= 0 ? [0] : [];
  let negSplits = scaleMin < -linthresh ? logAxisSplits(self, axisIdx, max(linthresh, -scaleMax), -scaleMin, foundIncr) : [linthresh];
  return negSplits.reverse().map((v3) => -v3).concat(zero, posSplits);
}
function log10AxisValsFilt(self, splits, axisIdx, foundSpace, foundIncr) {
  let axis = self.axes[axisIdx];
  let scaleKey = axis.scale;
  let sc = self.scales[scaleKey];
  let valToPos = self.valToPos;
  let minSpace = axis._space;
  let _10 = valToPos(10, scaleKey);
  let re = valToPos(9, scaleKey) - _10 >= minSpace ? RE_ALL : valToPos(7, scaleKey) - _10 >= minSpace ? RE_12357 : valToPos(5, scaleKey) - _10 >= minSpace ? RE_125 : RE_1;
  if (re == RE_1) {
    let magSpace = abs(valToPos(1, scaleKey) - _10);
    if (magSpace < minSpace)
      return _filt(splits.slice().reverse(), sc.distr, re, ceil(minSpace / magSpace)).reverse();
  }
  return _filt(splits, sc.distr, re, 1);
}
function log2AxisValsFilt(self, splits, axisIdx, foundSpace, foundIncr) {
  let axis = self.axes[axisIdx];
  let scaleKey = axis.scale;
  let minSpace = axis._space;
  let valToPos = self.valToPos;
  let magSpace = abs(valToPos(1, scaleKey) - valToPos(2, scaleKey));
  if (magSpace < minSpace)
    return _filt(splits.slice().reverse(), 3, RE_ALL, ceil(minSpace / magSpace)).reverse();
  return splits;
}
function numSeriesVal(self, val, seriesIdx, dataIdx) {
  return dataIdx == null ? LEGEND_DISP : val == null ? "" : fmtNum2(val);
}
function ptDia(width, mult) {
  let dia = 3 + (width || 1) * 2;
  return roundDec(dia * mult, 3);
}
function seriesPointsShow(self, si) {
  let { scale, idxs } = self.series[0];
  let xData = self._data[0];
  let p0 = self.valToPos(xData[idxs[0]], scale, true);
  let p1 = self.valToPos(xData[idxs[1]], scale, true);
  let dim = abs(p1 - p0);
  let s3 = self.series[si];
  let maxPts = dim / (s3.points.space * pxRatio);
  return idxs[1] - idxs[0] <= maxPts;
}
function clampScale(self, val, scaleMin, scaleMax, scaleKey) {
  return scaleMin / 10;
}
function _sync(key, opts) {
  let s3 = syncs[key];
  if (!s3) {
    s3 = {
      key,
      plots: [],
      sub(plot) {
        s3.plots.push(plot);
      },
      unsub(plot) {
        s3.plots = s3.plots.filter((c3) => c3 != plot);
      },
      pub(type, self, x3, y3, w3, h3, i3) {
        for (let j4 = 0; j4 < s3.plots.length; j4++)
          s3.plots[j4] != self && s3.plots[j4].pub(type, self, x3, y3, w3, h3, i3);
      }
    };
    if (key != null)
      syncs[key] = s3;
  }
  return s3;
}
function orient(u3, seriesIdx, cb) {
  const mode = u3.mode;
  const series = u3.series[seriesIdx];
  const data = mode == 2 ? u3._data[seriesIdx] : u3._data;
  const scales = u3.scales;
  const bbox = u3.bbox;
  let dx = data[0], dy = mode == 2 ? data[1] : data[seriesIdx], sx = mode == 2 ? scales[series.facets[0].scale] : scales[u3.series[0].scale], sy = mode == 2 ? scales[series.facets[1].scale] : scales[series.scale], l3 = bbox.left, t5 = bbox.top, w3 = bbox.width, h3 = bbox.height, H3 = u3.valToPosH, V3 = u3.valToPosV;
  return sx.ori == 0 ? cb(
    series,
    dx,
    dy,
    sx,
    sy,
    H3,
    V3,
    l3,
    t5,
    w3,
    h3,
    moveToH,
    lineToH,
    rectH,
    arcH,
    bezierCurveToH
  ) : cb(
    series,
    dx,
    dy,
    sx,
    sy,
    V3,
    H3,
    t5,
    l3,
    h3,
    w3,
    moveToV,
    lineToV,
    rectV,
    arcV,
    bezierCurveToV
  );
}
function bandFillClipDirs(self, seriesIdx) {
  let fillDir = 0;
  let clipDirs = 0;
  let bands = ifNull(self.bands, EMPTY_ARR);
  for (let i3 = 0; i3 < bands.length; i3++) {
    let b2 = bands[i3];
    if (b2.series[0] == seriesIdx)
      fillDir = b2.dir;
    else if (b2.series[1] == seriesIdx) {
      if (b2.dir == 1)
        clipDirs |= 1;
      else
        clipDirs |= 2;
    }
  }
  return [
    fillDir,
    clipDirs == 1 ? -1 : (
      // neg only
      clipDirs == 2 ? 1 : (
        // pos only
        clipDirs == 3 ? 2 : (
          // both
          0
        )
      )
    )
  ];
}
function seriesFillTo(self, seriesIdx, dataMin, dataMax, bandFillDir) {
  let mode = self.mode;
  let series = self.series[seriesIdx];
  let scaleKey = mode == 2 ? series.facets[1].scale : series.scale;
  let scale = self.scales[scaleKey];
  return bandFillDir == -1 ? scale.min : bandFillDir == 1 ? scale.max : scale.distr == 3 ? scale.dir == 1 ? scale.min : scale.max : 0;
}
function clipBandLine(self, seriesIdx, idx0, idx1, strokePath, clipDir) {
  return orient(self, seriesIdx, (series, dataX, dataY, scaleX, scaleY, valToPosX, valToPosY, xOff, yOff, xDim, yDim) => {
    let pxRound = series.pxRound;
    const dir = scaleX.dir * (scaleX.ori == 0 ? 1 : -1);
    const lineTo = scaleX.ori == 0 ? lineToH : lineToV;
    let frIdx, toIdx;
    if (dir == 1) {
      frIdx = idx0;
      toIdx = idx1;
    } else {
      frIdx = idx1;
      toIdx = idx0;
    }
    let x0 = pxRound(valToPosX(dataX[frIdx], scaleX, xDim, xOff));
    let y0 = pxRound(valToPosY(dataY[frIdx], scaleY, yDim, yOff));
    let x1 = pxRound(valToPosX(dataX[toIdx], scaleX, xDim, xOff));
    let yLimit = pxRound(valToPosY(clipDir == 1 ? scaleY.max : scaleY.min, scaleY, yDim, yOff));
    let clip = new Path2D(strokePath);
    lineTo(clip, x1, yLimit);
    lineTo(clip, x0, yLimit);
    lineTo(clip, x0, y0);
    return clip;
  });
}
function clipGaps(gaps2, ori, plotLft, plotTop, plotWid, plotHgt) {
  let clip = null;
  if (gaps2.length > 0) {
    clip = new Path2D();
    const rect2 = ori == 0 ? rectH : rectV;
    let prevGapEnd = plotLft;
    for (let i3 = 0; i3 < gaps2.length; i3++) {
      let g4 = gaps2[i3];
      if (g4[1] > g4[0]) {
        let w4 = g4[0] - prevGapEnd;
        w4 > 0 && rect2(clip, prevGapEnd, plotTop, w4, plotTop + plotHgt);
        prevGapEnd = g4[1];
      }
    }
    let w3 = plotLft + plotWid - prevGapEnd;
    let maxStrokeWidth = 10;
    w3 > 0 && rect2(clip, prevGapEnd, plotTop - maxStrokeWidth / 2, w3, plotTop + plotHgt + maxStrokeWidth);
  }
  return clip;
}
function addGap(gaps2, fromX, toX) {
  let prevGap = gaps2[gaps2.length - 1];
  if (prevGap && prevGap[0] == fromX)
    prevGap[1] = toX;
  else
    gaps2.push([fromX, toX]);
}
function findGaps(xs, ys, idx0, idx1, dir, pixelForX, align) {
  let gaps2 = [];
  let len = xs.length;
  for (let i3 = dir == 1 ? idx0 : idx1; i3 >= idx0 && i3 <= idx1; i3 += dir) {
    let yVal = ys[i3];
    if (yVal === null) {
      let fr = i3, to = i3;
      if (dir == 1) {
        while (++i3 <= idx1 && ys[i3] === null)
          to = i3;
      } else {
        while (--i3 >= idx0 && ys[i3] === null)
          to = i3;
      }
      let frPx = pixelForX(xs[fr]);
      let toPx = to == fr ? frPx : pixelForX(xs[to]);
      let fri2 = fr - dir;
      let frPx2 = align <= 0 && fri2 >= 0 && fri2 < len ? pixelForX(xs[fri2]) : frPx;
      frPx = frPx2;
      let toi2 = to + dir;
      let toPx2 = align >= 0 && toi2 >= 0 && toi2 < len ? pixelForX(xs[toi2]) : toPx;
      toPx = toPx2;
      if (toPx >= frPx)
        gaps2.push([frPx, toPx]);
    }
  }
  return gaps2;
}
function pxRoundGen(pxAlign) {
  return pxAlign == 0 ? retArg0 : pxAlign == 1 ? round : (v3) => incrRound(v3, pxAlign);
}
function rect(ori) {
  let moveTo = ori == 0 ? moveToH : moveToV;
  let arcTo = ori == 0 ? (p3, x1, y1, x22, y22, r3) => {
    p3.arcTo(x1, y1, x22, y22, r3);
  } : (p3, y1, x1, y22, x22, r3) => {
    p3.arcTo(x1, y1, x22, y22, r3);
  };
  let rect2 = ori == 0 ? (p3, x3, y3, w3, h3) => {
    p3.rect(x3, y3, w3, h3);
  } : (p3, y3, x3, h3, w3) => {
    p3.rect(x3, y3, w3, h3);
  };
  return (p3, x3, y3, w3, h3, endRad = 0, baseRad = 0) => {
    if (endRad == 0 && baseRad == 0)
      rect2(p3, x3, y3, w3, h3);
    else {
      endRad = min(endRad, w3 / 2, h3 / 2);
      baseRad = min(baseRad, w3 / 2, h3 / 2);
      moveTo(p3, x3 + endRad, y3);
      arcTo(p3, x3 + w3, y3, x3 + w3, y3 + h3, endRad);
      arcTo(p3, x3 + w3, y3 + h3, x3, y3 + h3, baseRad);
      arcTo(p3, x3, y3 + h3, x3, y3, baseRad);
      arcTo(p3, x3, y3, x3 + w3, y3, endRad);
      p3.closePath();
    }
  };
}
function points(opts) {
  return (u3, seriesIdx, idx0, idx1, filtIdxs) => {
    return orient(u3, seriesIdx, (series, dataX, dataY, scaleX, scaleY, valToPosX, valToPosY, xOff, yOff, xDim, yDim) => {
      let { pxRound, points: points2 } = series;
      let moveTo, arc;
      if (scaleX.ori == 0) {
        moveTo = moveToH;
        arc = arcH;
      } else {
        moveTo = moveToV;
        arc = arcV;
      }
      const width = roundDec(points2.width * pxRatio, 3);
      let rad = (points2.size - points2.width) / 2 * pxRatio;
      let dia = roundDec(rad * 2, 3);
      let fill = new Path2D();
      let clip = new Path2D();
      let { left: lft, top, width: wid, height: hgt } = u3.bbox;
      rectH(
        clip,
        lft - dia,
        top - dia,
        wid + dia * 2,
        hgt + dia * 2
      );
      const drawPoint = (pi) => {
        if (dataY[pi] != null) {
          let x3 = pxRound(valToPosX(dataX[pi], scaleX, xDim, xOff));
          let y3 = pxRound(valToPosY(dataY[pi], scaleY, yDim, yOff));
          moveTo(fill, x3 + rad, y3);
          arc(fill, x3, y3, rad, 0, PI * 2);
        }
      };
      if (filtIdxs)
        filtIdxs.forEach(drawPoint);
      else {
        for (let pi = idx0; pi <= idx1; pi++)
          drawPoint(pi);
      }
      return {
        stroke: width > 0 ? fill : null,
        fill,
        clip,
        flags: BAND_CLIP_FILL | BAND_CLIP_STROKE
      };
    });
  };
}
function _drawAcc(lineTo) {
  return (stroke, accX, minY, maxY, inY, outY) => {
    if (minY != maxY) {
      if (inY != minY && outY != minY)
        lineTo(stroke, accX, minY);
      if (inY != maxY && outY != maxY)
        lineTo(stroke, accX, maxY);
      lineTo(stroke, accX, outY);
    }
  };
}
function linear(opts) {
  const alignGaps = ifNull(opts?.alignGaps, 0);
  return (u3, seriesIdx, idx0, idx1) => {
    return orient(u3, seriesIdx, (series, dataX, dataY, scaleX, scaleY, valToPosX, valToPosY, xOff, yOff, xDim, yDim) => {
      [idx0, idx1] = nonNullIdxs(dataY, idx0, idx1);
      let pxRound = series.pxRound;
      let pixelForX = (val) => pxRound(valToPosX(val, scaleX, xDim, xOff));
      let pixelForY = (val) => pxRound(valToPosY(val, scaleY, yDim, yOff));
      let lineTo, drawAcc;
      if (scaleX.ori == 0) {
        lineTo = lineToH;
        drawAcc = drawAccH;
      } else {
        lineTo = lineToV;
        drawAcc = drawAccV;
      }
      const dir = scaleX.dir * (scaleX.ori == 0 ? 1 : -1);
      const _paths = { stroke: new Path2D(), fill: null, clip: null, band: null, gaps: null, flags: BAND_CLIP_FILL };
      const stroke = _paths.stroke;
      let hasGap = false;
      const decimate = idx1 - idx0 >= xDim * 4;
      if (decimate) {
        let xForPixel = (pos) => u3.posToVal(pos, scaleX.key, true);
        let minY = null, maxY = null, inY, outY, drawnAtX;
        let accX = pixelForX(dataX[dir == 1 ? idx0 : idx1]);
        let idx0px = pixelForX(dataX[idx0]);
        let idx1px = pixelForX(dataX[idx1]);
        let nextAccXVal = xForPixel(dir == 1 ? idx0px + 1 : idx1px - 1);
        for (let i3 = dir == 1 ? idx0 : idx1; i3 >= idx0 && i3 <= idx1; i3 += dir) {
          let xVal = dataX[i3];
          let reuseAccX = dir == 1 ? xVal < nextAccXVal : xVal > nextAccXVal;
          let x3 = reuseAccX ? accX : pixelForX(xVal);
          let yVal = dataY[i3];
          if (x3 == accX) {
            if (yVal != null) {
              outY = yVal;
              if (minY == null) {
                lineTo(stroke, x3, pixelForY(outY));
                inY = minY = maxY = outY;
              } else {
                if (outY < minY)
                  minY = outY;
                else if (outY > maxY)
                  maxY = outY;
              }
            } else {
              if (yVal === null)
                hasGap = true;
            }
          } else {
            if (minY != null)
              drawAcc(stroke, accX, pixelForY(minY), pixelForY(maxY), pixelForY(inY), pixelForY(outY));
            if (yVal != null) {
              outY = yVal;
              lineTo(stroke, x3, pixelForY(outY));
              minY = maxY = inY = outY;
            } else {
              minY = maxY = null;
              if (yVal === null)
                hasGap = true;
            }
            accX = x3;
            nextAccXVal = xForPixel(accX + dir);
          }
        }
        if (minY != null && minY != maxY && drawnAtX != accX)
          drawAcc(stroke, accX, pixelForY(minY), pixelForY(maxY), pixelForY(inY), pixelForY(outY));
      } else {
        for (let i3 = dir == 1 ? idx0 : idx1; i3 >= idx0 && i3 <= idx1; i3 += dir) {
          let yVal = dataY[i3];
          if (yVal === null)
            hasGap = true;
          else if (yVal != null)
            lineTo(stroke, pixelForX(dataX[i3]), pixelForY(yVal));
        }
      }
      let [bandFillDir, bandClipDir] = bandFillClipDirs(u3, seriesIdx);
      if (series.fill != null || bandFillDir != 0) {
        let fill = _paths.fill = new Path2D(stroke);
        let fillToVal = series.fillTo(u3, seriesIdx, series.min, series.max, bandFillDir);
        let fillToY = pixelForY(fillToVal);
        let frX = pixelForX(dataX[idx0]);
        let toX = pixelForX(dataX[idx1]);
        if (dir == -1)
          [toX, frX] = [frX, toX];
        lineTo(fill, toX, fillToY);
        lineTo(fill, frX, fillToY);
      }
      if (!series.spanGaps) {
        let gaps2 = [];
        hasGap && gaps2.push(...findGaps(dataX, dataY, idx0, idx1, dir, pixelForX, alignGaps));
        _paths.gaps = gaps2 = series.gaps(u3, seriesIdx, idx0, idx1, gaps2);
        _paths.clip = clipGaps(gaps2, scaleX.ori, xOff, yOff, xDim, yDim);
      }
      if (bandClipDir != 0) {
        _paths.band = bandClipDir == 2 ? [
          clipBandLine(u3, seriesIdx, idx0, idx1, stroke, -1),
          clipBandLine(u3, seriesIdx, idx0, idx1, stroke, 1)
        ] : clipBandLine(u3, seriesIdx, idx0, idx1, stroke, bandClipDir);
      }
      return _paths;
    });
  };
}
function stepped(opts) {
  const align = ifNull(opts.align, 1);
  const ascDesc = ifNull(opts.ascDesc, false);
  const alignGaps = ifNull(opts.alignGaps, 0);
  const extend = ifNull(opts.extend, false);
  return (u3, seriesIdx, idx0, idx1) => {
    return orient(u3, seriesIdx, (series, dataX, dataY, scaleX, scaleY, valToPosX, valToPosY, xOff, yOff, xDim, yDim) => {
      [idx0, idx1] = nonNullIdxs(dataY, idx0, idx1);
      let pxRound = series.pxRound;
      let { left, width } = u3.bbox;
      let pixelForX = (val) => pxRound(valToPosX(val, scaleX, xDim, xOff));
      let pixelForY = (val) => pxRound(valToPosY(val, scaleY, yDim, yOff));
      let lineTo = scaleX.ori == 0 ? lineToH : lineToV;
      const _paths = { stroke: new Path2D(), fill: null, clip: null, band: null, gaps: null, flags: BAND_CLIP_FILL };
      const stroke = _paths.stroke;
      const dir = scaleX.dir * (scaleX.ori == 0 ? 1 : -1);
      let prevYPos = pixelForY(dataY[dir == 1 ? idx0 : idx1]);
      let firstXPos = pixelForX(dataX[dir == 1 ? idx0 : idx1]);
      let prevXPos = firstXPos;
      let firstXPosExt = firstXPos;
      if (extend && align == -1) {
        firstXPosExt = left;
        lineTo(stroke, firstXPosExt, prevYPos);
      }
      lineTo(stroke, firstXPos, prevYPos);
      for (let i3 = dir == 1 ? idx0 : idx1; i3 >= idx0 && i3 <= idx1; i3 += dir) {
        let yVal1 = dataY[i3];
        if (yVal1 == null)
          continue;
        let x1 = pixelForX(dataX[i3]);
        let y1 = pixelForY(yVal1);
        if (align == 1)
          lineTo(stroke, x1, prevYPos);
        else
          lineTo(stroke, prevXPos, y1);
        lineTo(stroke, x1, y1);
        prevYPos = y1;
        prevXPos = x1;
      }
      let prevXPosExt = prevXPos;
      if (extend && align == 1) {
        prevXPosExt = left + width;
        lineTo(stroke, prevXPosExt, prevYPos);
      }
      let [bandFillDir, bandClipDir] = bandFillClipDirs(u3, seriesIdx);
      if (series.fill != null || bandFillDir != 0) {
        let fill = _paths.fill = new Path2D(stroke);
        let fillTo = series.fillTo(u3, seriesIdx, series.min, series.max, bandFillDir);
        let fillToY = pixelForY(fillTo);
        lineTo(fill, prevXPosExt, fillToY);
        lineTo(fill, firstXPosExt, fillToY);
      }
      if (!series.spanGaps) {
        let gaps2 = [];
        gaps2.push(...findGaps(dataX, dataY, idx0, idx1, dir, pixelForX, alignGaps));
        let halfStroke = series.width * pxRatio / 2;
        let startsOffset = ascDesc || align == 1 ? halfStroke : -halfStroke;
        let endsOffset = ascDesc || align == -1 ? -halfStroke : halfStroke;
        gaps2.forEach((g4) => {
          g4[0] += startsOffset;
          g4[1] += endsOffset;
        });
        _paths.gaps = gaps2 = series.gaps(u3, seriesIdx, idx0, idx1, gaps2);
        _paths.clip = clipGaps(gaps2, scaleX.ori, xOff, yOff, xDim, yDim);
      }
      if (bandClipDir != 0) {
        _paths.band = bandClipDir == 2 ? [
          clipBandLine(u3, seriesIdx, idx0, idx1, stroke, -1),
          clipBandLine(u3, seriesIdx, idx0, idx1, stroke, 1)
        ] : clipBandLine(u3, seriesIdx, idx0, idx1, stroke, bandClipDir);
      }
      return _paths;
    });
  };
}
function findColWidth(dataX, dataY, valToPosX, scaleX, xDim, xOff, colWid = inf) {
  if (dataX.length > 1) {
    let prevIdx = null;
    for (let i3 = 0, minDelta = Infinity; i3 < dataX.length; i3++) {
      if (dataY[i3] !== void 0) {
        if (prevIdx != null) {
          let delta = abs(dataX[i3] - dataX[prevIdx]);
          if (delta < minDelta) {
            minDelta = delta;
            colWid = abs(valToPosX(dataX[i3], scaleX, xDim, xOff) - valToPosX(dataX[prevIdx], scaleX, xDim, xOff));
          }
        }
        prevIdx = i3;
      }
    }
  }
  return colWid;
}
function bars(opts) {
  opts = opts || EMPTY_OBJ;
  const size = ifNull(opts.size, [0.6, inf, 1]);
  const align = opts.align || 0;
  const _extraGap = opts.gap || 0;
  let ro = opts.radius;
  ro = // [valueRadius, baselineRadius]
  ro == null ? [0, 0] : typeof ro == "number" ? [ro, 0] : ro;
  const radiusFn = fnOrSelf(ro);
  const gapFactor = 1 - size[0];
  const _maxWidth = ifNull(size[1], inf);
  const _minWidth = ifNull(size[2], 1);
  const disp = ifNull(opts.disp, EMPTY_OBJ);
  const _each = ifNull(opts.each, (_4) => {
  });
  const { fill: dispFills, stroke: dispStrokes } = disp;
  return (u3, seriesIdx, idx0, idx1) => {
    return orient(u3, seriesIdx, (series, dataX, dataY, scaleX, scaleY, valToPosX, valToPosY, xOff, yOff, xDim, yDim) => {
      let pxRound = series.pxRound;
      let _align = align;
      let extraGap = _extraGap * pxRatio;
      let maxWidth = _maxWidth * pxRatio;
      let minWidth = _minWidth * pxRatio;
      let valRadius, baseRadius;
      if (scaleX.ori == 0)
        [valRadius, baseRadius] = radiusFn(u3, seriesIdx);
      else
        [baseRadius, valRadius] = radiusFn(u3, seriesIdx);
      const _dirX = scaleX.dir * (scaleX.ori == 0 ? 1 : -1);
      let rect2 = scaleX.ori == 0 ? rectH : rectV;
      let each = scaleX.ori == 0 ? _each : (u4, seriesIdx2, i3, top, lft, hgt, wid) => {
        _each(u4, seriesIdx2, i3, lft, top, wid, hgt);
      };
      let band = ifNull(u3.bands, EMPTY_ARR).find((b2) => b2.series[0] == seriesIdx);
      let fillDir = band != null ? band.dir : 0;
      let fillTo = series.fillTo(u3, seriesIdx, series.min, series.max, fillDir);
      let fillToY = pxRound(valToPosY(fillTo, scaleY, yDim, yOff));
      let xShift, barWid, fullGap, colWid = xDim;
      let strokeWidth = pxRound(series.width * pxRatio);
      let multiPath = false;
      let fillColors = null;
      let fillPaths = null;
      let strokeColors = null;
      let strokePaths = null;
      if (dispFills != null && (strokeWidth == 0 || dispStrokes != null)) {
        multiPath = true;
        fillColors = dispFills.values(u3, seriesIdx, idx0, idx1);
        fillPaths = /* @__PURE__ */ new Map();
        new Set(fillColors).forEach((color) => {
          if (color != null)
            fillPaths.set(color, new Path2D());
        });
        if (strokeWidth > 0) {
          strokeColors = dispStrokes.values(u3, seriesIdx, idx0, idx1);
          strokePaths = /* @__PURE__ */ new Map();
          new Set(strokeColors).forEach((color) => {
            if (color != null)
              strokePaths.set(color, new Path2D());
          });
        }
      }
      let { x0, size: size2 } = disp;
      if (x0 != null && size2 != null) {
        _align = 1;
        dataX = x0.values(u3, seriesIdx, idx0, idx1);
        if (x0.unit == 2)
          dataX = dataX.map((pct) => u3.posToVal(xOff + pct * xDim, scaleX.key, true));
        let sizes = size2.values(u3, seriesIdx, idx0, idx1);
        if (size2.unit == 2)
          barWid = sizes[0] * xDim;
        else
          barWid = valToPosX(sizes[0], scaleX, xDim, xOff) - valToPosX(0, scaleX, xDim, xOff);
        colWid = findColWidth(dataX, dataY, valToPosX, scaleX, xDim, xOff, colWid);
        let gapWid = colWid - barWid;
        fullGap = gapWid + extraGap;
      } else {
        colWid = findColWidth(dataX, dataY, valToPosX, scaleX, xDim, xOff, colWid);
        let gapWid = colWid * gapFactor;
        fullGap = gapWid + extraGap;
        barWid = colWid - fullGap;
      }
      if (fullGap < 1)
        fullGap = 0;
      if (strokeWidth >= barWid / 2)
        strokeWidth = 0;
      if (fullGap < 5)
        pxRound = retArg0;
      let insetStroke = fullGap > 0;
      let rawBarWid = colWid - fullGap - (insetStroke ? strokeWidth : 0);
      barWid = pxRound(clamp(rawBarWid, minWidth, maxWidth));
      xShift = (_align == 0 ? barWid / 2 : _align == _dirX ? 0 : barWid) - _align * _dirX * ((_align == 0 ? extraGap / 2 : 0) + (insetStroke ? strokeWidth / 2 : 0));
      const _paths = { stroke: null, fill: null, clip: null, band: null, gaps: null, flags: 0 };
      const stroke = multiPath ? null : new Path2D();
      let dataY0 = null;
      if (band != null)
        dataY0 = u3.data[band.series[1]];
      else {
        let { y0, y1 } = disp;
        if (y0 != null && y1 != null) {
          dataY = y1.values(u3, seriesIdx, idx0, idx1);
          dataY0 = y0.values(u3, seriesIdx, idx0, idx1);
        }
      }
      let radVal = valRadius * barWid;
      let radBase = baseRadius * barWid;
      for (let i3 = _dirX == 1 ? idx0 : idx1; i3 >= idx0 && i3 <= idx1; i3 += _dirX) {
        let yVal = dataY[i3];
        if (yVal == null)
          continue;
        if (dataY0 != null) {
          let yVal0 = dataY0[i3] ?? 0;
          if (yVal - yVal0 == 0)
            continue;
          fillToY = valToPosY(yVal0, scaleY, yDim, yOff);
        }
        let xVal = scaleX.distr != 2 || disp != null ? dataX[i3] : i3;
        let xPos = valToPosX(xVal, scaleX, xDim, xOff);
        let yPos = valToPosY(ifNull(yVal, fillTo), scaleY, yDim, yOff);
        let lft = pxRound(xPos - xShift);
        let btm = pxRound(max(yPos, fillToY));
        let top = pxRound(min(yPos, fillToY));
        let barHgt = btm - top;
        if (yVal != null) {
          let rv = yVal < 0 ? radBase : radVal;
          let rb = yVal < 0 ? radVal : radBase;
          if (multiPath) {
            if (strokeWidth > 0 && strokeColors[i3] != null)
              rect2(strokePaths.get(strokeColors[i3]), lft, top + floor(strokeWidth / 2), barWid, max(0, barHgt - strokeWidth), rv, rb);
            if (fillColors[i3] != null)
              rect2(fillPaths.get(fillColors[i3]), lft, top + floor(strokeWidth / 2), barWid, max(0, barHgt - strokeWidth), rv, rb);
          } else
            rect2(stroke, lft, top + floor(strokeWidth / 2), barWid, max(0, barHgt - strokeWidth), rv, rb);
          each(
            u3,
            seriesIdx,
            i3,
            lft - strokeWidth / 2,
            top,
            barWid + strokeWidth,
            barHgt
          );
        }
      }
      if (strokeWidth > 0)
        _paths.stroke = multiPath ? strokePaths : stroke;
      else if (!multiPath) {
        _paths._fill = series.width == 0 ? series._fill : series._stroke ?? series._fill;
        _paths.width = 0;
      }
      _paths.fill = multiPath ? fillPaths : stroke;
      return _paths;
    });
  };
}
function splineInterp(interp, opts) {
  const alignGaps = ifNull(opts?.alignGaps, 0);
  return (u3, seriesIdx, idx0, idx1) => {
    return orient(u3, seriesIdx, (series, dataX, dataY, scaleX, scaleY, valToPosX, valToPosY, xOff, yOff, xDim, yDim) => {
      [idx0, idx1] = nonNullIdxs(dataY, idx0, idx1);
      let pxRound = series.pxRound;
      let pixelForX = (val) => pxRound(valToPosX(val, scaleX, xDim, xOff));
      let pixelForY = (val) => pxRound(valToPosY(val, scaleY, yDim, yOff));
      let moveTo, bezierCurveTo, lineTo;
      if (scaleX.ori == 0) {
        moveTo = moveToH;
        lineTo = lineToH;
        bezierCurveTo = bezierCurveToH;
      } else {
        moveTo = moveToV;
        lineTo = lineToV;
        bezierCurveTo = bezierCurveToV;
      }
      const dir = scaleX.dir * (scaleX.ori == 0 ? 1 : -1);
      let firstXPos = pixelForX(dataX[dir == 1 ? idx0 : idx1]);
      let prevXPos = firstXPos;
      let xCoords = [];
      let yCoords = [];
      for (let i3 = dir == 1 ? idx0 : idx1; i3 >= idx0 && i3 <= idx1; i3 += dir) {
        let yVal = dataY[i3];
        if (yVal != null) {
          let xVal = dataX[i3];
          let xPos = pixelForX(xVal);
          xCoords.push(prevXPos = xPos);
          yCoords.push(pixelForY(dataY[i3]));
        }
      }
      const _paths = { stroke: interp(xCoords, yCoords, moveTo, lineTo, bezierCurveTo, pxRound), fill: null, clip: null, band: null, gaps: null, flags: BAND_CLIP_FILL };
      const stroke = _paths.stroke;
      let [bandFillDir, bandClipDir] = bandFillClipDirs(u3, seriesIdx);
      if (series.fill != null || bandFillDir != 0) {
        let fill = _paths.fill = new Path2D(stroke);
        let fillTo = series.fillTo(u3, seriesIdx, series.min, series.max, bandFillDir);
        let fillToY = pixelForY(fillTo);
        lineTo(fill, prevXPos, fillToY);
        lineTo(fill, firstXPos, fillToY);
      }
      if (!series.spanGaps) {
        let gaps2 = [];
        gaps2.push(...findGaps(dataX, dataY, idx0, idx1, dir, pixelForX, alignGaps));
        _paths.gaps = gaps2 = series.gaps(u3, seriesIdx, idx0, idx1, gaps2);
        _paths.clip = clipGaps(gaps2, scaleX.ori, xOff, yOff, xDim, yDim);
      }
      if (bandClipDir != 0) {
        _paths.band = bandClipDir == 2 ? [
          clipBandLine(u3, seriesIdx, idx0, idx1, stroke, -1),
          clipBandLine(u3, seriesIdx, idx0, idx1, stroke, 1)
        ] : clipBandLine(u3, seriesIdx, idx0, idx1, stroke, bandClipDir);
      }
      return _paths;
    });
  };
}
function monotoneCubic(opts) {
  return splineInterp(_monotoneCubic, opts);
}
function _monotoneCubic(xs, ys, moveTo, lineTo, bezierCurveTo, pxRound) {
  const n3 = xs.length;
  if (n3 < 2)
    return null;
  const path = new Path2D();
  moveTo(path, xs[0], ys[0]);
  if (n3 == 2)
    lineTo(path, xs[1], ys[1]);
  else {
    let ms = Array(n3), ds = Array(n3 - 1), dys = Array(n3 - 1), dxs = Array(n3 - 1);
    for (let i3 = 0; i3 < n3 - 1; i3++) {
      dys[i3] = ys[i3 + 1] - ys[i3];
      dxs[i3] = xs[i3 + 1] - xs[i3];
      ds[i3] = dys[i3] / dxs[i3];
    }
    ms[0] = ds[0];
    for (let i3 = 1; i3 < n3 - 1; i3++) {
      if (ds[i3] === 0 || ds[i3 - 1] === 0 || ds[i3 - 1] > 0 !== ds[i3] > 0)
        ms[i3] = 0;
      else {
        ms[i3] = 3 * (dxs[i3 - 1] + dxs[i3]) / ((2 * dxs[i3] + dxs[i3 - 1]) / ds[i3 - 1] + (dxs[i3] + 2 * dxs[i3 - 1]) / ds[i3]);
        if (!isFinite(ms[i3]))
          ms[i3] = 0;
      }
    }
    ms[n3 - 1] = ds[n3 - 2];
    for (let i3 = 0; i3 < n3 - 1; i3++) {
      bezierCurveTo(
        path,
        xs[i3] + dxs[i3] / 3,
        ys[i3] + ms[i3] * dxs[i3] / 3,
        xs[i3 + 1] - dxs[i3] / 3,
        ys[i3 + 1] - ms[i3 + 1] * dxs[i3] / 3,
        xs[i3 + 1],
        ys[i3 + 1]
      );
    }
  }
  return path;
}
function invalidateRects() {
  for (let u3 of cursorPlots)
    u3.syncRect(true);
}
function setDefaults(d3, xo, yo, initY) {
  let d22 = initY ? [d3[0], d3[1]].concat(d3.slice(2)) : [d3[0]].concat(d3.slice(1));
  return d22.map((o3, i3) => setDefault(o3, i3, xo, yo));
}
function setDefaults2(d3, xyo) {
  return d3.map((o3, i3) => i3 == 0 ? {} : assign({}, xyo, o3));
}
function setDefault(o3, i3, xo, yo) {
  return assign({}, i3 == 0 ? xo : yo, o3);
}
function snapNumX(self, dataMin, dataMax) {
  return dataMin == null ? nullNullTuple : [dataMin, dataMax];
}
function snapNumY(self, dataMin, dataMax) {
  return dataMin == null ? nullNullTuple : rangeNum(dataMin, dataMax, rangePad, true);
}
function snapLogY(self, dataMin, dataMax, scale) {
  return dataMin == null ? nullNullTuple : rangeLog(dataMin, dataMax, self.scales[scale].log, false);
}
function snapAsinhY(self, dataMin, dataMax, scale) {
  return dataMin == null ? nullNullTuple : rangeAsinh(dataMin, dataMax, self.scales[scale].log, false);
}
function findIncr(minVal, maxVal, incrs, dim, minSpace) {
  let intDigits = max(numIntDigits(minVal), numIntDigits(maxVal));
  let delta = maxVal - minVal;
  let incrIdx = closestIdx(minSpace / dim * delta, incrs);
  do {
    let foundIncr = incrs[incrIdx];
    let foundSpace = dim * foundIncr / delta;
    if (foundSpace >= minSpace && intDigits + (foundIncr < 5 ? fixedDec.get(foundIncr) : 0) <= 17)
      return [foundIncr, foundSpace];
  } while (++incrIdx < incrs.length);
  return [0, 0];
}
function pxRatioFont(font2) {
  let fontSize, fontSizeCss;
  font2 = font2.replace(/(\d+)px/, (m3, p1) => (fontSize = round((fontSizeCss = +p1) * pxRatio)) + "px");
  return [font2, fontSize, fontSizeCss];
}
function syncFontSize(axis) {
  if (axis.show) {
    [axis.font, axis.labelFont].forEach((f3) => {
      let size = roundDec(f3[2] * pxRatio, 1);
      f3[0] = f3[0].replace(/[0-9.]+px/, size + "px");
      f3[1] = size;
    });
  }
}
function uPlot(opts, data, then) {
  const self = {
    mode: ifNull(opts.mode, 1)
  };
  const mode = self.mode;
  function getHPos(val, scale, dim, off2) {
    let pct = scale.valToPct(val);
    return off2 + dim * (scale.dir == -1 ? 1 - pct : pct);
  }
  function getVPos(val, scale, dim, off2) {
    let pct = scale.valToPct(val);
    return off2 + dim * (scale.dir == -1 ? pct : 1 - pct);
  }
  function getPos(val, scale, dim, off2) {
    return scale.ori == 0 ? getHPos(val, scale, dim, off2) : getVPos(val, scale, dim, off2);
  }
  self.valToPosH = getHPos;
  self.valToPosV = getVPos;
  let ready = false;
  self.status = 0;
  const root = self.root = placeDiv(UPLOT);
  if (opts.id != null)
    root.id = opts.id;
  addClass(root, opts.class);
  if (opts.title) {
    let title = placeDiv(TITLE, root);
    title.textContent = opts.title;
  }
  const can = placeTag("canvas");
  const ctx = self.ctx = can.getContext("2d");
  const wrap = placeDiv(WRAP, root);
  on2("click", wrap, (e3) => {
    if (e3.target === over) {
      let didDrag = mouseLeft1 != mouseLeft0 || mouseTop1 != mouseTop0;
      didDrag && drag.click(self, e3);
    }
  }, true);
  const under = self.under = placeDiv(UNDER, wrap);
  wrap.appendChild(can);
  const over = self.over = placeDiv(OVER, wrap);
  opts = copy(opts);
  const pxAlign = +ifNull(opts.pxAlign, 1);
  const pxRound = pxRoundGen(pxAlign);
  (opts.plugins || []).forEach((p3) => {
    if (p3.opts)
      opts = p3.opts(self, opts) || opts;
  });
  const ms = opts.ms || 1e-3;
  const series = self.series = mode == 1 ? setDefaults(opts.series || [], xSeriesOpts, ySeriesOpts, false) : setDefaults2(opts.series || [null], xySeriesOpts);
  const axes = self.axes = setDefaults(opts.axes || [], xAxisOpts, yAxisOpts, true);
  const scales = self.scales = {};
  const bands = self.bands = opts.bands || [];
  bands.forEach((b2) => {
    b2.fill = fnOrSelf(b2.fill || null);
    b2.dir = ifNull(b2.dir, -1);
  });
  const xScaleKey = mode == 2 ? series[1].facets[0].scale : series[0].scale;
  const drawOrderMap = {
    axes: drawAxesGrid,
    series: drawSeries
  };
  const drawOrder = (opts.drawOrder || ["axes", "series"]).map((key2) => drawOrderMap[key2]);
  function initValToPct(sc) {
    const getVal = sc.distr == 3 ? (val) => log10(val > 0 ? val : sc.clamp(self, val, sc.min, sc.max, sc.key)) : sc.distr == 4 ? (val) => asinh(val, sc.asinh) : sc.distr == 100 ? (val) => sc.fwd(val) : (val) => val;
    return (val) => {
      let _val = getVal(val);
      let { _min, _max } = sc;
      let delta = _max - _min;
      return (_val - _min) / delta;
    };
  }
  function initScale(scaleKey) {
    let sc = scales[scaleKey];
    if (sc == null) {
      let scaleOpts = (opts.scales || EMPTY_OBJ)[scaleKey] || EMPTY_OBJ;
      if (scaleOpts.from != null) {
        initScale(scaleOpts.from);
        let sc2 = assign({}, scales[scaleOpts.from], scaleOpts, { key: scaleKey });
        sc2.valToPct = initValToPct(sc2);
        scales[scaleKey] = sc2;
      } else {
        sc = scales[scaleKey] = assign({}, scaleKey == xScaleKey ? xScaleOpts : yScaleOpts, scaleOpts);
        sc.key = scaleKey;
        let isTime = sc.time;
        let rn2 = sc.range;
        let rangeIsArr = isArr(rn2);
        if (scaleKey != xScaleKey || mode == 2 && !isTime) {
          if (rangeIsArr && (rn2[0] == null || rn2[1] == null)) {
            rn2 = {
              min: rn2[0] == null ? autoRangePart : {
                mode: 1,
                hard: rn2[0],
                soft: rn2[0]
              },
              max: rn2[1] == null ? autoRangePart : {
                mode: 1,
                hard: rn2[1],
                soft: rn2[1]
              }
            };
            rangeIsArr = false;
          }
          if (!rangeIsArr && isObj(rn2)) {
            let cfg = rn2;
            rn2 = (self2, dataMin, dataMax) => dataMin == null ? nullNullTuple : rangeNum(dataMin, dataMax, cfg);
          }
        }
        sc.range = fnOrSelf(rn2 || (isTime ? snapTimeX : scaleKey == xScaleKey ? sc.distr == 3 ? snapLogX : sc.distr == 4 ? snapAsinhX : snapNumX : sc.distr == 3 ? snapLogY : sc.distr == 4 ? snapAsinhY : snapNumY));
        sc.auto = fnOrSelf(rangeIsArr ? false : sc.auto);
        sc.clamp = fnOrSelf(sc.clamp || clampScale);
        sc._min = sc._max = null;
        sc.valToPct = initValToPct(sc);
      }
    }
  }
  initScale("x");
  initScale("y");
  if (mode == 1) {
    series.forEach((s3) => {
      initScale(s3.scale);
    });
  }
  axes.forEach((a3) => {
    initScale(a3.scale);
  });
  for (let k3 in opts.scales)
    initScale(k3);
  const scaleX = scales[xScaleKey];
  const xScaleDistr = scaleX.distr;
  let valToPosX, valToPosY;
  if (scaleX.ori == 0) {
    addClass(root, ORI_HZ);
    valToPosX = getHPos;
    valToPosY = getVPos;
  } else {
    addClass(root, ORI_VT);
    valToPosX = getVPos;
    valToPosY = getHPos;
  }
  const pendScales = {};
  for (let k3 in scales) {
    let sc = scales[k3];
    if (sc.min != null || sc.max != null) {
      pendScales[k3] = { min: sc.min, max: sc.max };
      sc.min = sc.max = null;
    }
  }
  const _tzDate = opts.tzDate || ((ts) => new Date(round(ts / ms)));
  const _fmtDate = opts.fmtDate || fmtDate;
  const _timeAxisSplits = ms == 1 ? timeAxisSplitsMs(_tzDate) : timeAxisSplitsS(_tzDate);
  const _timeAxisVals = timeAxisVals(_tzDate, timeAxisStamps(ms == 1 ? _timeAxisStampsMs : _timeAxisStampsS, _fmtDate));
  const _timeSeriesVal = timeSeriesVal(_tzDate, timeSeriesStamp(_timeSeriesStamp, _fmtDate));
  const activeIdxs = [];
  const legend = self.legend = assign({}, legendOpts, opts.legend);
  const cursor = self.cursor = assign({}, cursorOpts, { drag: { y: mode == 2 } }, opts.cursor);
  const showLegend = legend.show;
  const showCursor = cursor.show;
  const markers = legend.markers;
  {
    legend.idxs = activeIdxs;
    markers.width = fnOrSelf(markers.width);
    markers.dash = fnOrSelf(markers.dash);
    markers.stroke = fnOrSelf(markers.stroke);
    markers.fill = fnOrSelf(markers.fill);
  }
  let legendTable;
  let legendHead;
  let legendBody;
  let legendRows = [];
  let legendCells = [];
  let legendCols;
  let multiValLegend = false;
  let NULL_LEGEND_VALUES = {};
  if (legend.live) {
    const getMultiVals = series[1] ? series[1].values : null;
    multiValLegend = getMultiVals != null;
    legendCols = multiValLegend ? getMultiVals(self, 1, 0) : { _: 0 };
    for (let k3 in legendCols)
      NULL_LEGEND_VALUES[k3] = LEGEND_DISP;
  }
  if (showLegend) {
    legendTable = placeTag("table", LEGEND, root);
    legendBody = placeTag("tbody", null, legendTable);
    legend.mount(self, legendTable);
    if (multiValLegend) {
      legendHead = placeTag("thead", null, legendTable, legendBody);
      let head = placeTag("tr", null, legendHead);
      placeTag("th", null, head);
      for (var key in legendCols)
        placeTag("th", LEGEND_LABEL, head).textContent = key;
    } else {
      addClass(legendTable, LEGEND_INLINE);
      legend.live && addClass(legendTable, LEGEND_LIVE);
    }
  }
  const son = { show: true };
  const soff = { show: false };
  function initLegendRow(s3, i3) {
    if (i3 == 0 && (multiValLegend || !legend.live || mode == 2))
      return nullNullTuple;
    let cells = [];
    let row = placeTag("tr", LEGEND_SERIES, legendBody, legendBody.childNodes[i3]);
    addClass(row, s3.class);
    if (!s3.show)
      addClass(row, OFF);
    let label = placeTag("th", null, row);
    if (markers.show) {
      let indic = placeDiv(LEGEND_MARKER, label);
      if (i3 > 0) {
        let width = markers.width(self, i3);
        if (width)
          indic.style.border = width + "px " + markers.dash(self, i3) + " " + markers.stroke(self, i3);
        indic.style.background = markers.fill(self, i3);
      }
    }
    let text = placeDiv(LEGEND_LABEL, label);
    if (s3.label instanceof HTMLElement)
      text.appendChild(s3.label);
    else
      text.textContent = s3.label;
    if (i3 > 0) {
      if (!markers.show)
        text.style.color = s3.width > 0 ? markers.stroke(self, i3) : markers.fill(self, i3);
      onMouse("click", label, (e3) => {
        if (cursor._lock)
          return;
        setCursorEvent(e3);
        let seriesIdx = series.indexOf(s3);
        if ((e3.ctrlKey || e3.metaKey) != legend.isolate) {
          let isolate = series.some((s4, i4) => i4 > 0 && i4 != seriesIdx && s4.show);
          series.forEach((s4, i4) => {
            i4 > 0 && setSeries(i4, isolate ? i4 == seriesIdx ? son : soff : son, true, syncOpts.setSeries);
          });
        } else
          setSeries(seriesIdx, { show: !s3.show }, true, syncOpts.setSeries);
      }, false);
      if (cursorFocus) {
        onMouse(mouseenter, label, (e3) => {
          if (cursor._lock)
            return;
          setCursorEvent(e3);
          setSeries(series.indexOf(s3), FOCUS_TRUE, true, syncOpts.setSeries);
        }, false);
      }
    }
    for (var key2 in legendCols) {
      let v3 = placeTag("td", LEGEND_VALUE, row);
      v3.textContent = "--";
      cells.push(v3);
    }
    return [row, cells];
  }
  const mouseListeners = /* @__PURE__ */ new Map();
  function onMouse(ev, targ, fn, onlyTarg = true) {
    const targListeners = mouseListeners.get(targ) || {};
    const listener = cursor.bind[ev](self, targ, fn, onlyTarg);
    if (listener) {
      on2(ev, targ, targListeners[ev] = listener);
      mouseListeners.set(targ, targListeners);
    }
  }
  function offMouse(ev, targ, fn) {
    const targListeners = mouseListeners.get(targ) || {};
    for (let k3 in targListeners) {
      if (ev == null || k3 == ev) {
        off(k3, targ, targListeners[k3]);
        delete targListeners[k3];
      }
    }
    if (ev == null)
      mouseListeners.delete(targ);
  }
  let fullWidCss = 0;
  let fullHgtCss = 0;
  let plotWidCss = 0;
  let plotHgtCss = 0;
  let plotLftCss = 0;
  let plotTopCss = 0;
  let _plotLftCss = plotLftCss;
  let _plotTopCss = plotTopCss;
  let _plotWidCss = plotWidCss;
  let _plotHgtCss = plotHgtCss;
  let plotLft = 0;
  let plotTop = 0;
  let plotWid = 0;
  let plotHgt = 0;
  self.bbox = {};
  let shouldSetScales = false;
  let shouldSetSize = false;
  let shouldConvergeSize = false;
  let shouldSetCursor = false;
  let shouldSetSelect = false;
  let shouldSetLegend = false;
  function _setSize(width, height, force) {
    if (force || (width != self.width || height != self.height))
      calcSize(width, height);
    resetYSeries(false);
    shouldConvergeSize = true;
    shouldSetSize = true;
    commit();
  }
  function calcSize(width, height) {
    self.width = fullWidCss = plotWidCss = width;
    self.height = fullHgtCss = plotHgtCss = height;
    plotLftCss = plotTopCss = 0;
    calcPlotRect();
    calcAxesRects();
    let bb = self.bbox;
    plotLft = bb.left = incrRound(plotLftCss * pxRatio, 0.5);
    plotTop = bb.top = incrRound(plotTopCss * pxRatio, 0.5);
    plotWid = bb.width = incrRound(plotWidCss * pxRatio, 0.5);
    plotHgt = bb.height = incrRound(plotHgtCss * pxRatio, 0.5);
  }
  const CYCLE_LIMIT = 3;
  function convergeSize() {
    let converged = false;
    let cycleNum = 0;
    while (!converged) {
      cycleNum++;
      let axesConverged = axesCalc(cycleNum);
      let paddingConverged = paddingCalc(cycleNum);
      converged = cycleNum == CYCLE_LIMIT || axesConverged && paddingConverged;
      if (!converged) {
        calcSize(self.width, self.height);
        shouldSetSize = true;
      }
    }
  }
  function setSize({ width, height }) {
    _setSize(width, height);
  }
  self.setSize = setSize;
  function calcPlotRect() {
    let hasTopAxis = false;
    let hasBtmAxis = false;
    let hasRgtAxis = false;
    let hasLftAxis = false;
    axes.forEach((axis, i3) => {
      if (axis.show && axis._show) {
        let { side, _size } = axis;
        let isVt = side % 2;
        let labelSize = axis.label != null ? axis.labelSize : 0;
        let fullSize = _size + labelSize;
        if (fullSize > 0) {
          if (isVt) {
            plotWidCss -= fullSize;
            if (side == 3) {
              plotLftCss += fullSize;
              hasLftAxis = true;
            } else
              hasRgtAxis = true;
          } else {
            plotHgtCss -= fullSize;
            if (side == 0) {
              plotTopCss += fullSize;
              hasTopAxis = true;
            } else
              hasBtmAxis = true;
          }
        }
      }
    });
    sidesWithAxes[0] = hasTopAxis;
    sidesWithAxes[1] = hasRgtAxis;
    sidesWithAxes[2] = hasBtmAxis;
    sidesWithAxes[3] = hasLftAxis;
    plotWidCss -= _padding[1] + _padding[3];
    plotLftCss += _padding[3];
    plotHgtCss -= _padding[2] + _padding[0];
    plotTopCss += _padding[0];
  }
  function calcAxesRects() {
    let off1 = plotLftCss + plotWidCss;
    let off2 = plotTopCss + plotHgtCss;
    let off3 = plotLftCss;
    let off0 = plotTopCss;
    function incrOffset(side, size) {
      switch (side) {
        case 1:
          off1 += size;
          return off1 - size;
        case 2:
          off2 += size;
          return off2 - size;
        case 3:
          off3 -= size;
          return off3 + size;
        case 0:
          off0 -= size;
          return off0 + size;
      }
    }
    axes.forEach((axis, i3) => {
      if (axis.show && axis._show) {
        let side = axis.side;
        axis._pos = incrOffset(side, axis._size);
        if (axis.label != null)
          axis._lpos = incrOffset(side, axis.labelSize);
      }
    });
  }
  if (cursor.dataIdx == null) {
    let hov = cursor.hover;
    let skip = hov.skip = new Set(hov.skip ?? []);
    skip.add(void 0);
    let prox = hov.prox = fnOrSelf(hov.prox);
    let bias = hov.bias ??= 0;
    cursor.dataIdx = (self2, seriesIdx, cursorIdx, valAtPosX) => {
      if (seriesIdx == 0)
        return cursorIdx;
      let idx2 = cursorIdx;
      let _prox = prox(self2, seriesIdx, cursorIdx, valAtPosX) ?? inf;
      let withProx = _prox >= 0 && _prox < inf;
      let xDim = scaleX.ori == 0 ? plotWidCss : plotHgtCss;
      let cursorLft = cursor.left;
      let xValues = data[0];
      let yValues = data[seriesIdx];
      if (skip.has(yValues[cursorIdx])) {
        idx2 = null;
        let nonNullLft = null, nonNullRgt = null, j4;
        if (bias == 0 || bias == -1) {
          j4 = cursorIdx;
          while (nonNullLft == null && j4-- > 0) {
            if (!skip.has(yValues[j4]))
              nonNullLft = j4;
          }
        }
        if (bias == 0 || bias == 1) {
          j4 = cursorIdx;
          while (nonNullRgt == null && j4++ < yValues.length) {
            if (!skip.has(yValues[j4]))
              nonNullRgt = j4;
          }
        }
        if (nonNullLft != null || nonNullRgt != null) {
          if (withProx) {
            let lftPos = nonNullLft == null ? -Infinity : valToPosX(xValues[nonNullLft], scaleX, xDim, 0);
            let rgtPos = nonNullRgt == null ? Infinity : valToPosX(xValues[nonNullRgt], scaleX, xDim, 0);
            let lftDelta = cursorLft - lftPos;
            let rgtDelta = rgtPos - cursorLft;
            if (lftDelta <= rgtDelta) {
              if (lftDelta <= _prox)
                idx2 = nonNullLft;
            } else {
              if (rgtDelta <= _prox)
                idx2 = nonNullRgt;
            }
          } else {
            idx2 = nonNullRgt == null ? nonNullLft : nonNullLft == null ? nonNullRgt : cursorIdx - nonNullLft <= nonNullRgt - cursorIdx ? nonNullLft : nonNullRgt;
          }
        }
      } else if (withProx) {
        let dist = abs(cursorLft - valToPosX(xValues[cursorIdx], scaleX, xDim, 0));
        if (dist > _prox)
          idx2 = null;
      }
      return idx2;
    };
  }
  const setCursorEvent = (e3) => {
    cursor.event = e3;
  };
  cursor.idxs = activeIdxs;
  cursor._lock = false;
  let points2 = cursor.points;
  points2.show = fnOrSelf(points2.show);
  points2.size = fnOrSelf(points2.size);
  points2.stroke = fnOrSelf(points2.stroke);
  points2.width = fnOrSelf(points2.width);
  points2.fill = fnOrSelf(points2.fill);
  const focus = self.focus = assign({}, opts.focus || { alpha: 0.3 }, cursor.focus);
  const cursorFocus = focus.prox >= 0;
  const cursorOnePt = cursorFocus && points2.one;
  let cursorPts = [];
  let cursorPtsLft = [];
  let cursorPtsTop = [];
  function initCursorPt(s3, si) {
    let pt = points2.show(self, si);
    if (pt instanceof HTMLElement) {
      addClass(pt, CURSOR_PT);
      addClass(pt, s3.class);
      elTrans(pt, -10, -10, plotWidCss, plotHgtCss);
      over.insertBefore(pt, cursorPts[si]);
      return pt;
    }
  }
  function initSeries(s3, i3) {
    if (mode == 1 || i3 > 0) {
      let isTime = mode == 1 && scales[s3.scale].time;
      let sv = s3.value;
      s3.value = isTime ? isStr(sv) ? timeSeriesVal(_tzDate, timeSeriesStamp(sv, _fmtDate)) : sv || _timeSeriesVal : sv || numSeriesVal;
      s3.label = s3.label || (isTime ? timeSeriesLabel : numSeriesLabel);
    }
    if (cursorOnePt || i3 > 0) {
      s3.width = s3.width == null ? 1 : s3.width;
      s3.paths = s3.paths || linearPath || retNull;
      s3.fillTo = fnOrSelf(s3.fillTo || seriesFillTo);
      s3.pxAlign = +ifNull(s3.pxAlign, pxAlign);
      s3.pxRound = pxRoundGen(s3.pxAlign);
      s3.stroke = fnOrSelf(s3.stroke || null);
      s3.fill = fnOrSelf(s3.fill || null);
      s3._stroke = s3._fill = s3._paths = s3._focus = null;
      let _ptDia = ptDia(max(1, s3.width), 1);
      let points3 = s3.points = assign({}, {
        size: _ptDia,
        width: max(1, _ptDia * 0.2),
        stroke: s3.stroke,
        space: _ptDia * 2,
        paths: pointsPath,
        _stroke: null,
        _fill: null
      }, s3.points);
      points3.show = fnOrSelf(points3.show);
      points3.filter = fnOrSelf(points3.filter);
      points3.fill = fnOrSelf(points3.fill);
      points3.stroke = fnOrSelf(points3.stroke);
      points3.paths = fnOrSelf(points3.paths);
      points3.pxAlign = s3.pxAlign;
    }
    if (showLegend) {
      let rowCells = initLegendRow(s3, i3);
      legendRows.splice(i3, 0, rowCells[0]);
      legendCells.splice(i3, 0, rowCells[1]);
      legend.values.push(null);
    }
    if (showCursor) {
      activeIdxs.splice(i3, 0, null);
      let pt = null;
      if (cursorOnePt) {
        if (i3 == 0)
          pt = initCursorPt(s3, i3);
      } else if (i3 > 0)
        pt = initCursorPt(s3, i3);
      cursorPts.splice(i3, 0, pt);
      cursorPtsLft.splice(i3, 0, 0);
      cursorPtsTop.splice(i3, 0, 0);
    }
    fire("addSeries", i3);
  }
  function addSeries(opts2, si) {
    si = si == null ? series.length : si;
    opts2 = mode == 1 ? setDefault(opts2, si, xSeriesOpts, ySeriesOpts) : setDefault(opts2, si, {}, xySeriesOpts);
    series.splice(si, 0, opts2);
    initSeries(series[si], si);
  }
  self.addSeries = addSeries;
  function delSeries(i3) {
    series.splice(i3, 1);
    if (showLegend) {
      legend.values.splice(i3, 1);
      legendCells.splice(i3, 1);
      let tr = legendRows.splice(i3, 1)[0];
      offMouse(null, tr.firstChild);
      tr.remove();
    }
    if (showCursor) {
      activeIdxs.splice(i3, 1);
      cursorPts.splice(i3, 1)[0].remove();
      cursorPtsLft.splice(i3, 1);
      cursorPtsTop.splice(i3, 1);
    }
    fire("delSeries", i3);
  }
  self.delSeries = delSeries;
  const sidesWithAxes = [false, false, false, false];
  function initAxis(axis, i3) {
    axis._show = axis.show;
    if (axis.show) {
      let isVt = axis.side % 2;
      let sc = scales[axis.scale];
      if (sc == null) {
        axis.scale = isVt ? series[1].scale : xScaleKey;
        sc = scales[axis.scale];
      }
      let isTime = sc.time;
      axis.size = fnOrSelf(axis.size);
      axis.space = fnOrSelf(axis.space);
      axis.rotate = fnOrSelf(axis.rotate);
      if (isArr(axis.incrs)) {
        axis.incrs.forEach((incr) => {
          !fixedDec.has(incr) && fixedDec.set(incr, guessDec(incr));
        });
      }
      axis.incrs = fnOrSelf(axis.incrs || (sc.distr == 2 ? wholeIncrs : isTime ? ms == 1 ? timeIncrsMs : timeIncrsS : numIncrs));
      axis.splits = fnOrSelf(axis.splits || (isTime && sc.distr == 1 ? _timeAxisSplits : sc.distr == 3 ? logAxisSplits : sc.distr == 4 ? asinhAxisSplits : numAxisSplits));
      axis.stroke = fnOrSelf(axis.stroke);
      axis.grid.stroke = fnOrSelf(axis.grid.stroke);
      axis.ticks.stroke = fnOrSelf(axis.ticks.stroke);
      axis.border.stroke = fnOrSelf(axis.border.stroke);
      let av = axis.values;
      axis.values = // static array of tick values
      isArr(av) && !isArr(av[0]) ? fnOrSelf(av) : (
        // temporal
        isTime ? (
          // config array of fmtDate string tpls
          isArr(av) ? timeAxisVals(_tzDate, timeAxisStamps(av, _fmtDate)) : (
            // fmtDate string tpl
            isStr(av) ? timeAxisVal(_tzDate, av) : av || _timeAxisVals
          )
        ) : av || numAxisVals
      );
      axis.filter = fnOrSelf(axis.filter || (sc.distr >= 3 && sc.log == 10 ? log10AxisValsFilt : sc.distr == 3 && sc.log == 2 ? log2AxisValsFilt : retArg1));
      axis.font = pxRatioFont(axis.font);
      axis.labelFont = pxRatioFont(axis.labelFont);
      axis._size = axis.size(self, null, i3, 0);
      axis._space = axis._rotate = axis._incrs = axis._found = // foundIncrSpace
      axis._splits = axis._values = null;
      if (axis._size > 0) {
        sidesWithAxes[i3] = true;
        axis._el = placeDiv(AXIS, wrap);
      }
    }
  }
  function autoPadSide(self2, side, sidesWithAxes2, cycleNum) {
    let [hasTopAxis, hasRgtAxis, hasBtmAxis, hasLftAxis] = sidesWithAxes2;
    let ori = side % 2;
    let size = 0;
    if (ori == 0 && (hasLftAxis || hasRgtAxis))
      size = side == 0 && !hasTopAxis || side == 2 && !hasBtmAxis ? round(xAxisOpts.size / 3) : 0;
    if (ori == 1 && (hasTopAxis || hasBtmAxis))
      size = side == 1 && !hasRgtAxis || side == 3 && !hasLftAxis ? round(yAxisOpts.size / 2) : 0;
    return size;
  }
  const padding = self.padding = (opts.padding || [autoPadSide, autoPadSide, autoPadSide, autoPadSide]).map((p3) => fnOrSelf(ifNull(p3, autoPadSide)));
  const _padding = self._padding = padding.map((p3, i3) => p3(self, i3, sidesWithAxes, 0));
  let dataLen;
  let i0 = null;
  let i1 = null;
  const idxs = mode == 1 ? series[0].idxs : null;
  let data0 = null;
  let viaAutoScaleX = false;
  function setData(_data, _resetScales) {
    data = _data == null ? [] : _data;
    self.data = self._data = data;
    if (mode == 2) {
      dataLen = 0;
      for (let i3 = 1; i3 < series.length; i3++)
        dataLen += data[i3][0].length;
    } else {
      if (data.length == 0)
        self.data = self._data = data = [[]];
      data0 = data[0];
      dataLen = data0.length;
      let scaleData = data;
      if (xScaleDistr == 2) {
        scaleData = data.slice();
        let _data0 = scaleData[0] = Array(dataLen);
        for (let i3 = 0; i3 < dataLen; i3++)
          _data0[i3] = i3;
      }
      self._data = data = scaleData;
    }
    resetYSeries(true);
    fire("setData");
    if (xScaleDistr == 2) {
      shouldConvergeSize = true;
    }
    if (_resetScales !== false) {
      let xsc = scaleX;
      if (xsc.auto(self, viaAutoScaleX))
        autoScaleX();
      else
        _setScale(xScaleKey, xsc.min, xsc.max);
      shouldSetCursor = shouldSetCursor || cursor.left >= 0;
      shouldSetLegend = true;
      commit();
    }
  }
  self.setData = setData;
  function autoScaleX() {
    viaAutoScaleX = true;
    let _min, _max;
    if (mode == 1) {
      if (dataLen > 0) {
        i0 = idxs[0] = 0;
        i1 = idxs[1] = dataLen - 1;
        _min = data[0][i0];
        _max = data[0][i1];
        if (xScaleDistr == 2) {
          _min = i0;
          _max = i1;
        } else if (_min == _max) {
          if (xScaleDistr == 3)
            [_min, _max] = rangeLog(_min, _min, scaleX.log, false);
          else if (xScaleDistr == 4)
            [_min, _max] = rangeAsinh(_min, _min, scaleX.log, false);
          else if (scaleX.time)
            _max = _min + round(86400 / ms);
          else
            [_min, _max] = rangeNum(_min, _max, rangePad, true);
        }
      } else {
        i0 = idxs[0] = _min = null;
        i1 = idxs[1] = _max = null;
      }
    }
    _setScale(xScaleKey, _min, _max);
  }
  let ctxStroke, ctxFill, ctxWidth, ctxDash, ctxJoin, ctxCap, ctxFont, ctxAlign, ctxBaseline;
  let ctxAlpha;
  function setCtxStyle(stroke, width, dash, cap, fill, join2) {
    stroke ??= transparent;
    dash ??= EMPTY_ARR;
    cap ??= "butt";
    fill ??= transparent;
    join2 ??= "round";
    if (stroke != ctxStroke)
      ctx.strokeStyle = ctxStroke = stroke;
    if (fill != ctxFill)
      ctx.fillStyle = ctxFill = fill;
    if (width != ctxWidth)
      ctx.lineWidth = ctxWidth = width;
    if (join2 != ctxJoin)
      ctx.lineJoin = ctxJoin = join2;
    if (cap != ctxCap)
      ctx.lineCap = ctxCap = cap;
    if (dash != ctxDash)
      ctx.setLineDash(ctxDash = dash);
  }
  function setFontStyle(font2, fill, align, baseline) {
    if (fill != ctxFill)
      ctx.fillStyle = ctxFill = fill;
    if (font2 != ctxFont)
      ctx.font = ctxFont = font2;
    if (align != ctxAlign)
      ctx.textAlign = ctxAlign = align;
    if (baseline != ctxBaseline)
      ctx.textBaseline = ctxBaseline = baseline;
  }
  function accScale(wsc, psc, facet2, data2, sorted = 0) {
    if (data2.length > 0 && wsc.auto(self, viaAutoScaleX) && (psc == null || psc.min == null)) {
      let _i0 = ifNull(i0, 0);
      let _i1 = ifNull(i1, data2.length - 1);
      let minMax = facet2.min == null ? getMinMax(data2, _i0, _i1, sorted, wsc.distr == 3) : [facet2.min, facet2.max];
      wsc.min = min(wsc.min, facet2.min = minMax[0]);
      wsc.max = max(wsc.max, facet2.max = minMax[1]);
    }
  }
  const AUTOSCALE = { min: null, max: null };
  function setScales() {
    for (let k3 in scales) {
      let sc = scales[k3];
      if (pendScales[k3] == null && // scales that have never been set (on init)
      (sc.min == null || // or auto scales when the x scale was explicitly set
      pendScales[xScaleKey] != null && sc.auto(self, viaAutoScaleX))) {
        pendScales[k3] = AUTOSCALE;
      }
    }
    for (let k3 in scales) {
      let sc = scales[k3];
      if (pendScales[k3] == null && sc.from != null && pendScales[sc.from] != null)
        pendScales[k3] = AUTOSCALE;
    }
    if (pendScales[xScaleKey] != null)
      resetYSeries(true);
    let wipScales = {};
    for (let k3 in pendScales) {
      let psc = pendScales[k3];
      if (psc != null) {
        let wsc = wipScales[k3] = copy(scales[k3], fastIsObj);
        if (psc.min != null)
          assign(wsc, psc);
        else if (k3 != xScaleKey || mode == 2) {
          if (dataLen == 0 && wsc.from == null) {
            let minMax = wsc.range(self, null, null, k3);
            wsc.min = minMax[0];
            wsc.max = minMax[1];
          } else {
            wsc.min = inf;
            wsc.max = -inf;
          }
        }
      }
    }
    if (dataLen > 0) {
      series.forEach((s3, i3) => {
        if (mode == 1) {
          let k3 = s3.scale;
          let psc = pendScales[k3];
          if (psc == null)
            return;
          let wsc = wipScales[k3];
          if (i3 == 0) {
            let minMax = wsc.range(self, wsc.min, wsc.max, k3);
            wsc.min = minMax[0];
            wsc.max = minMax[1];
            i0 = closestIdx(wsc.min, data[0]);
            i1 = closestIdx(wsc.max, data[0]);
            if (i1 - i0 > 1) {
              if (data[0][i0] < wsc.min)
                i0++;
              if (data[0][i1] > wsc.max)
                i1--;
            }
            s3.min = data0[i0];
            s3.max = data0[i1];
          } else if (s3.show && s3.auto)
            accScale(wsc, psc, s3, data[i3], s3.sorted);
          s3.idxs[0] = i0;
          s3.idxs[1] = i1;
        } else {
          if (i3 > 0) {
            if (s3.show && s3.auto) {
              let [xFacet, yFacet] = s3.facets;
              let xScaleKey2 = xFacet.scale;
              let yScaleKey = yFacet.scale;
              let [xData, yData] = data[i3];
              let wscx = wipScales[xScaleKey2];
              let wscy = wipScales[yScaleKey];
              wscx != null && accScale(wscx, pendScales[xScaleKey2], xFacet, xData, xFacet.sorted);
              wscy != null && accScale(wscy, pendScales[yScaleKey], yFacet, yData, yFacet.sorted);
              s3.min = yFacet.min;
              s3.max = yFacet.max;
            }
          }
        }
      });
      for (let k3 in wipScales) {
        let wsc = wipScales[k3];
        let psc = pendScales[k3];
        if (wsc.from == null && (psc == null || psc.min == null)) {
          let minMax = wsc.range(
            self,
            wsc.min == inf ? null : wsc.min,
            wsc.max == -inf ? null : wsc.max,
            k3
          );
          wsc.min = minMax[0];
          wsc.max = minMax[1];
        }
      }
    }
    for (let k3 in wipScales) {
      let wsc = wipScales[k3];
      if (wsc.from != null) {
        let base = wipScales[wsc.from];
        if (base.min == null)
          wsc.min = wsc.max = null;
        else {
          let minMax = wsc.range(self, base.min, base.max, k3);
          wsc.min = minMax[0];
          wsc.max = minMax[1];
        }
      }
    }
    let changed = {};
    let anyChanged = false;
    for (let k3 in wipScales) {
      let wsc = wipScales[k3];
      let sc = scales[k3];
      if (sc.min != wsc.min || sc.max != wsc.max) {
        sc.min = wsc.min;
        sc.max = wsc.max;
        let distr = sc.distr;
        sc._min = distr == 3 ? log10(sc.min) : distr == 4 ? asinh(sc.min, sc.asinh) : distr == 100 ? sc.fwd(sc.min) : sc.min;
        sc._max = distr == 3 ? log10(sc.max) : distr == 4 ? asinh(sc.max, sc.asinh) : distr == 100 ? sc.fwd(sc.max) : sc.max;
        changed[k3] = anyChanged = true;
      }
    }
    if (anyChanged) {
      series.forEach((s3, i3) => {
        if (mode == 2) {
          if (i3 > 0 && changed.y)
            s3._paths = null;
        } else {
          if (changed[s3.scale])
            s3._paths = null;
        }
      });
      for (let k3 in changed) {
        shouldConvergeSize = true;
        fire("setScale", k3);
      }
      if (showCursor && cursor.left >= 0)
        shouldSetCursor = shouldSetLegend = true;
    }
    for (let k3 in pendScales)
      pendScales[k3] = null;
  }
  function getOuterIdxs(ydata) {
    let _i0 = clamp(i0 - 1, 0, dataLen - 1);
    let _i1 = clamp(i1 + 1, 0, dataLen - 1);
    while (ydata[_i0] == null && _i0 > 0)
      _i0--;
    while (ydata[_i1] == null && _i1 < dataLen - 1)
      _i1++;
    return [_i0, _i1];
  }
  function drawSeries() {
    if (dataLen > 0) {
      let shouldAlpha = series.some((s3) => s3._focus) && ctxAlpha != focus.alpha;
      if (shouldAlpha)
        ctx.globalAlpha = ctxAlpha = focus.alpha;
      series.forEach((s3, i3) => {
        if (i3 > 0 && s3.show) {
          cacheStrokeFill(i3, false);
          cacheStrokeFill(i3, true);
          if (s3._paths == null) {
            let _ctxAlpha = ctxAlpha;
            if (ctxAlpha != s3.alpha)
              ctx.globalAlpha = ctxAlpha = s3.alpha;
            let _idxs = mode == 2 ? [0, data[i3][0].length - 1] : getOuterIdxs(data[i3]);
            s3._paths = s3.paths(self, i3, _idxs[0], _idxs[1]);
            if (ctxAlpha != _ctxAlpha)
              ctx.globalAlpha = ctxAlpha = _ctxAlpha;
          }
        }
      });
      series.forEach((s3, i3) => {
        if (i3 > 0 && s3.show) {
          let _ctxAlpha = ctxAlpha;
          if (ctxAlpha != s3.alpha)
            ctx.globalAlpha = ctxAlpha = s3.alpha;
          s3._paths != null && drawPath(i3, false);
          {
            let _gaps = s3._paths != null ? s3._paths.gaps : null;
            let show = s3.points.show(self, i3, i0, i1, _gaps);
            let idxs2 = s3.points.filter(self, i3, show, _gaps);
            if (show || idxs2) {
              s3.points._paths = s3.points.paths(self, i3, i0, i1, idxs2);
              drawPath(i3, true);
            }
          }
          if (ctxAlpha != _ctxAlpha)
            ctx.globalAlpha = ctxAlpha = _ctxAlpha;
          fire("drawSeries", i3);
        }
      });
      if (shouldAlpha)
        ctx.globalAlpha = ctxAlpha = 1;
    }
  }
  function cacheStrokeFill(si, _points) {
    let s3 = _points ? series[si].points : series[si];
    s3._stroke = s3.stroke(self, si);
    s3._fill = s3.fill(self, si);
  }
  function drawPath(si, _points) {
    let s3 = _points ? series[si].points : series[si];
    let {
      stroke,
      fill,
      clip: gapsClip,
      flags,
      _stroke: strokeStyle = s3._stroke,
      _fill: fillStyle = s3._fill,
      _width: width = s3.width
    } = s3._paths;
    width = roundDec(width * pxRatio, 3);
    let boundsClip = null;
    let offset = width % 2 / 2;
    if (_points && fillStyle == null)
      fillStyle = width > 0 ? "#fff" : strokeStyle;
    let _pxAlign = s3.pxAlign == 1 && offset > 0;
    _pxAlign && ctx.translate(offset, offset);
    if (!_points) {
      let lft = plotLft - width / 2, top = plotTop - width / 2, wid = plotWid + width, hgt = plotHgt + width;
      boundsClip = new Path2D();
      boundsClip.rect(lft, top, wid, hgt);
    }
    if (_points)
      strokeFill(strokeStyle, width, s3.dash, s3.cap, fillStyle, stroke, fill, flags, gapsClip);
    else
      fillStroke(si, strokeStyle, width, s3.dash, s3.cap, fillStyle, stroke, fill, flags, boundsClip, gapsClip);
    _pxAlign && ctx.translate(-offset, -offset);
  }
  function fillStroke(si, strokeStyle, lineWidth, lineDash, lineCap, fillStyle, strokePath, fillPath, flags, boundsClip, gapsClip) {
    let didStrokeFill = false;
    flags != 0 && bands.forEach((b2, bi) => {
      if (b2.series[0] == si) {
        let lowerEdge = series[b2.series[1]];
        let lowerData = data[b2.series[1]];
        let bandClip = (lowerEdge._paths || EMPTY_OBJ).band;
        if (isArr(bandClip))
          bandClip = b2.dir == 1 ? bandClip[0] : bandClip[1];
        let gapsClip2;
        let _fillStyle = null;
        if (lowerEdge.show && bandClip && hasData(lowerData, i0, i1)) {
          _fillStyle = b2.fill(self, bi) || fillStyle;
          gapsClip2 = lowerEdge._paths.clip;
        } else
          bandClip = null;
        strokeFill(strokeStyle, lineWidth, lineDash, lineCap, _fillStyle, strokePath, fillPath, flags, boundsClip, gapsClip, gapsClip2, bandClip);
        didStrokeFill = true;
      }
    });
    if (!didStrokeFill)
      strokeFill(strokeStyle, lineWidth, lineDash, lineCap, fillStyle, strokePath, fillPath, flags, boundsClip, gapsClip);
  }
  const CLIP_FILL_STROKE = BAND_CLIP_FILL | BAND_CLIP_STROKE;
  function strokeFill(strokeStyle, lineWidth, lineDash, lineCap, fillStyle, strokePath, fillPath, flags, boundsClip, gapsClip, gapsClip2, bandClip) {
    setCtxStyle(strokeStyle, lineWidth, lineDash, lineCap, fillStyle);
    if (boundsClip || gapsClip || bandClip) {
      ctx.save();
      boundsClip && ctx.clip(boundsClip);
      gapsClip && ctx.clip(gapsClip);
    }
    if (bandClip) {
      if ((flags & CLIP_FILL_STROKE) == CLIP_FILL_STROKE) {
        ctx.clip(bandClip);
        gapsClip2 && ctx.clip(gapsClip2);
        doFill(fillStyle, fillPath);
        doStroke(strokeStyle, strokePath, lineWidth);
      } else if (flags & BAND_CLIP_STROKE) {
        doFill(fillStyle, fillPath);
        ctx.clip(bandClip);
        doStroke(strokeStyle, strokePath, lineWidth);
      } else if (flags & BAND_CLIP_FILL) {
        ctx.save();
        ctx.clip(bandClip);
        gapsClip2 && ctx.clip(gapsClip2);
        doFill(fillStyle, fillPath);
        ctx.restore();
        doStroke(strokeStyle, strokePath, lineWidth);
      }
    } else {
      doFill(fillStyle, fillPath);
      doStroke(strokeStyle, strokePath, lineWidth);
    }
    if (boundsClip || gapsClip || bandClip)
      ctx.restore();
  }
  function doStroke(strokeStyle, strokePath, lineWidth) {
    if (lineWidth > 0) {
      if (strokePath instanceof Map) {
        strokePath.forEach((strokePath2, strokeStyle2) => {
          ctx.strokeStyle = ctxStroke = strokeStyle2;
          ctx.stroke(strokePath2);
        });
      } else
        strokePath != null && strokeStyle && ctx.stroke(strokePath);
    }
  }
  function doFill(fillStyle, fillPath) {
    if (fillPath instanceof Map) {
      fillPath.forEach((fillPath2, fillStyle2) => {
        ctx.fillStyle = ctxFill = fillStyle2;
        ctx.fill(fillPath2);
      });
    } else
      fillPath != null && fillStyle && ctx.fill(fillPath);
  }
  function getIncrSpace(axisIdx, min2, max2, fullDim) {
    let axis = axes[axisIdx];
    let incrSpace;
    if (fullDim <= 0)
      incrSpace = [0, 0];
    else {
      let minSpace = axis._space = axis.space(self, axisIdx, min2, max2, fullDim);
      let incrs = axis._incrs = axis.incrs(self, axisIdx, min2, max2, fullDim, minSpace);
      incrSpace = findIncr(min2, max2, incrs, fullDim, minSpace);
    }
    return axis._found = incrSpace;
  }
  function drawOrthoLines(offs, filts, ori, side, pos0, len, width, stroke, dash, cap) {
    let offset = width % 2 / 2;
    pxAlign == 1 && ctx.translate(offset, offset);
    setCtxStyle(stroke, width, dash, cap, stroke);
    ctx.beginPath();
    let x0, y0, x1, y1, pos1 = pos0 + (side == 0 || side == 3 ? -len : len);
    if (ori == 0) {
      y0 = pos0;
      y1 = pos1;
    } else {
      x0 = pos0;
      x1 = pos1;
    }
    for (let i3 = 0; i3 < offs.length; i3++) {
      if (filts[i3] != null) {
        if (ori == 0)
          x0 = x1 = offs[i3];
        else
          y0 = y1 = offs[i3];
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
      }
    }
    ctx.stroke();
    pxAlign == 1 && ctx.translate(-offset, -offset);
  }
  function axesCalc(cycleNum) {
    let converged = true;
    axes.forEach((axis, i3) => {
      if (!axis.show)
        return;
      let scale = scales[axis.scale];
      if (scale.min == null) {
        if (axis._show) {
          converged = false;
          axis._show = false;
          resetYSeries(false);
        }
        return;
      } else {
        if (!axis._show) {
          converged = false;
          axis._show = true;
          resetYSeries(false);
        }
      }
      let side = axis.side;
      let ori = side % 2;
      let { min: min2, max: max2 } = scale;
      let [_incr, _space] = getIncrSpace(i3, min2, max2, ori == 0 ? plotWidCss : plotHgtCss);
      if (_space == 0)
        return;
      let forceMin = scale.distr == 2;
      let _splits = axis._splits = axis.splits(self, i3, min2, max2, _incr, _space, forceMin);
      let splits = scale.distr == 2 ? _splits.map((i4) => data0[i4]) : _splits;
      let incr = scale.distr == 2 ? data0[_splits[1]] - data0[_splits[0]] : _incr;
      let values = axis._values = axis.values(self, axis.filter(self, splits, i3, _space, incr), i3, _space, incr);
      axis._rotate = side == 2 ? axis.rotate(self, values, i3, _space) : 0;
      let oldSize = axis._size;
      axis._size = ceil(axis.size(self, values, i3, cycleNum));
      if (oldSize != null && axis._size != oldSize)
        converged = false;
    });
    return converged;
  }
  function paddingCalc(cycleNum) {
    let converged = true;
    padding.forEach((p3, i3) => {
      let _p = p3(self, i3, sidesWithAxes, cycleNum);
      if (_p != _padding[i3])
        converged = false;
      _padding[i3] = _p;
    });
    return converged;
  }
  function drawAxesGrid() {
    for (let i3 = 0; i3 < axes.length; i3++) {
      let axis = axes[i3];
      if (!axis.show || !axis._show)
        continue;
      let side = axis.side;
      let ori = side % 2;
      let x3, y3;
      let fillStyle = axis.stroke(self, i3);
      let shiftDir = side == 0 || side == 3 ? -1 : 1;
      let [_incr, _space] = axis._found;
      if (axis.label != null) {
        let shiftAmt2 = axis.labelGap * shiftDir;
        let baseLpos = round((axis._lpos + shiftAmt2) * pxRatio);
        setFontStyle(axis.labelFont[0], fillStyle, "center", side == 2 ? TOP : BOTTOM);
        ctx.save();
        if (ori == 1) {
          x3 = y3 = 0;
          ctx.translate(
            baseLpos,
            round(plotTop + plotHgt / 2)
          );
          ctx.rotate((side == 3 ? -PI : PI) / 2);
        } else {
          x3 = round(plotLft + plotWid / 2);
          y3 = baseLpos;
        }
        let _label = isFn(axis.label) ? axis.label(self, i3, _incr, _space) : axis.label;
        ctx.fillText(_label, x3, y3);
        ctx.restore();
      }
      if (_space == 0)
        continue;
      let scale = scales[axis.scale];
      let plotDim = ori == 0 ? plotWid : plotHgt;
      let plotOff = ori == 0 ? plotLft : plotTop;
      let _splits = axis._splits;
      let splits = scale.distr == 2 ? _splits.map((i4) => data0[i4]) : _splits;
      let incr = scale.distr == 2 ? data0[_splits[1]] - data0[_splits[0]] : _incr;
      let ticks2 = axis.ticks;
      let border2 = axis.border;
      let _tickSize = ticks2.show ? ticks2.size : 0;
      let tickSize = round(_tickSize * pxRatio);
      let axisGap = round((axis.alignTo == 2 ? axis._size - _tickSize - axis.gap : axis.gap) * pxRatio);
      let angle = axis._rotate * -PI / 180;
      let basePos = pxRound(axis._pos * pxRatio);
      let shiftAmt = (tickSize + axisGap) * shiftDir;
      let finalPos = basePos + shiftAmt;
      y3 = ori == 0 ? finalPos : 0;
      x3 = ori == 1 ? finalPos : 0;
      let font2 = axis.font[0];
      let textAlign = axis.align == 1 ? LEFT : axis.align == 2 ? RIGHT : angle > 0 ? LEFT : angle < 0 ? RIGHT : ori == 0 ? "center" : side == 3 ? RIGHT : LEFT;
      let textBaseline = angle || ori == 1 ? "middle" : side == 2 ? TOP : BOTTOM;
      setFontStyle(font2, fillStyle, textAlign, textBaseline);
      let lineHeight = axis.font[1] * axis.lineGap;
      let canOffs = _splits.map((val) => pxRound(getPos(val, scale, plotDim, plotOff)));
      let _values = axis._values;
      for (let i4 = 0; i4 < _values.length; i4++) {
        let val = _values[i4];
        if (val != null) {
          if (ori == 0)
            x3 = canOffs[i4];
          else
            y3 = canOffs[i4];
          val = "" + val;
          let _parts = val.indexOf("\n") == -1 ? [val] : val.split(/\n/gm);
          for (let j4 = 0; j4 < _parts.length; j4++) {
            let text = _parts[j4];
            if (angle) {
              ctx.save();
              ctx.translate(x3, y3 + j4 * lineHeight);
              ctx.rotate(angle);
              ctx.fillText(text, 0, 0);
              ctx.restore();
            } else
              ctx.fillText(text, x3, y3 + j4 * lineHeight);
          }
        }
      }
      if (ticks2.show) {
        drawOrthoLines(
          canOffs,
          ticks2.filter(self, splits, i3, _space, incr),
          ori,
          side,
          basePos,
          tickSize,
          roundDec(ticks2.width * pxRatio, 3),
          ticks2.stroke(self, i3),
          ticks2.dash,
          ticks2.cap
        );
      }
      let grid2 = axis.grid;
      if (grid2.show) {
        drawOrthoLines(
          canOffs,
          grid2.filter(self, splits, i3, _space, incr),
          ori,
          ori == 0 ? 2 : 1,
          ori == 0 ? plotTop : plotLft,
          ori == 0 ? plotHgt : plotWid,
          roundDec(grid2.width * pxRatio, 3),
          grid2.stroke(self, i3),
          grid2.dash,
          grid2.cap
        );
      }
      if (border2.show) {
        drawOrthoLines(
          [basePos],
          [1],
          ori == 0 ? 1 : 0,
          ori == 0 ? 1 : 2,
          ori == 1 ? plotTop : plotLft,
          ori == 1 ? plotHgt : plotWid,
          roundDec(border2.width * pxRatio, 3),
          border2.stroke(self, i3),
          border2.dash,
          border2.cap
        );
      }
    }
    fire("drawAxes");
  }
  function resetYSeries(minMax) {
    series.forEach((s3, i3) => {
      if (i3 > 0) {
        s3._paths = null;
        if (minMax) {
          if (mode == 1) {
            s3.min = null;
            s3.max = null;
          } else {
            s3.facets.forEach((f3) => {
              f3.min = null;
              f3.max = null;
            });
          }
        }
      }
    });
  }
  let queuedCommit = false;
  let deferHooks = false;
  let hooksQueue = [];
  function flushHooks() {
    deferHooks = false;
    for (let i3 = 0; i3 < hooksQueue.length; i3++)
      fire(...hooksQueue[i3]);
    hooksQueue.length = 0;
  }
  function commit() {
    if (!queuedCommit) {
      microTask(_commit);
      queuedCommit = true;
    }
  }
  function batch(fn, _deferHooks = false) {
    queuedCommit = true;
    deferHooks = _deferHooks;
    fn(self);
    _commit();
    if (_deferHooks && hooksQueue.length > 0)
      queueMicrotask(flushHooks);
  }
  self.batch = batch;
  function _commit() {
    if (shouldSetScales) {
      setScales();
      shouldSetScales = false;
    }
    if (shouldConvergeSize) {
      convergeSize();
      shouldConvergeSize = false;
    }
    if (shouldSetSize) {
      setStylePx(under, LEFT, plotLftCss);
      setStylePx(under, TOP, plotTopCss);
      setStylePx(under, WIDTH, plotWidCss);
      setStylePx(under, HEIGHT, plotHgtCss);
      setStylePx(over, LEFT, plotLftCss);
      setStylePx(over, TOP, plotTopCss);
      setStylePx(over, WIDTH, plotWidCss);
      setStylePx(over, HEIGHT, plotHgtCss);
      setStylePx(wrap, WIDTH, fullWidCss);
      setStylePx(wrap, HEIGHT, fullHgtCss);
      can.width = round(fullWidCss * pxRatio);
      can.height = round(fullHgtCss * pxRatio);
      axes.forEach(({ _el, _show, _size, _pos, side }) => {
        if (_el != null) {
          if (_show) {
            let posOffset = side === 3 || side === 0 ? _size : 0;
            let isVt = side % 2 == 1;
            setStylePx(_el, isVt ? "left" : "top", _pos - posOffset);
            setStylePx(_el, isVt ? "width" : "height", _size);
            setStylePx(_el, isVt ? "top" : "left", isVt ? plotTopCss : plotLftCss);
            setStylePx(_el, isVt ? "height" : "width", isVt ? plotHgtCss : plotWidCss);
            remClass(_el, OFF);
          } else
            addClass(_el, OFF);
        }
      });
      ctxStroke = ctxFill = ctxWidth = ctxJoin = ctxCap = ctxFont = ctxAlign = ctxBaseline = ctxDash = null;
      ctxAlpha = 1;
      syncRect(true);
      if (plotLftCss != _plotLftCss || plotTopCss != _plotTopCss || plotWidCss != _plotWidCss || plotHgtCss != _plotHgtCss) {
        resetYSeries(false);
        let pctWid = plotWidCss / _plotWidCss;
        let pctHgt = plotHgtCss / _plotHgtCss;
        if (showCursor && !shouldSetCursor && cursor.left >= 0) {
          cursor.left *= pctWid;
          cursor.top *= pctHgt;
          vCursor && elTrans(vCursor, round(cursor.left), 0, plotWidCss, plotHgtCss);
          hCursor && elTrans(hCursor, 0, round(cursor.top), plotWidCss, plotHgtCss);
          for (let i3 = 0; i3 < cursorPts.length; i3++) {
            let pt = cursorPts[i3];
            if (pt != null) {
              cursorPtsLft[i3] *= pctWid;
              cursorPtsTop[i3] *= pctHgt;
              elTrans(pt, ceil(cursorPtsLft[i3]), ceil(cursorPtsTop[i3]), plotWidCss, plotHgtCss);
            }
          }
        }
        if (select.show && !shouldSetSelect && select.left >= 0 && select.width > 0) {
          select.left *= pctWid;
          select.width *= pctWid;
          select.top *= pctHgt;
          select.height *= pctHgt;
          for (let prop in _hideProps)
            setStylePx(selectDiv, prop, select[prop]);
        }
        _plotLftCss = plotLftCss;
        _plotTopCss = plotTopCss;
        _plotWidCss = plotWidCss;
        _plotHgtCss = plotHgtCss;
      }
      fire("setSize");
      shouldSetSize = false;
    }
    if (fullWidCss > 0 && fullHgtCss > 0) {
      ctx.clearRect(0, 0, can.width, can.height);
      fire("drawClear");
      drawOrder.forEach((fn) => fn());
      fire("draw");
    }
    if (select.show && shouldSetSelect) {
      setSelect(select);
      shouldSetSelect = false;
    }
    if (showCursor && shouldSetCursor) {
      updateCursor(null, true, false);
      shouldSetCursor = false;
    }
    if (legend.show && legend.live && shouldSetLegend) {
      setLegend();
      shouldSetLegend = false;
    }
    if (!ready) {
      ready = true;
      self.status = 1;
      fire("ready");
    }
    viaAutoScaleX = false;
    queuedCommit = false;
  }
  self.redraw = (rebuildPaths, recalcAxes) => {
    shouldConvergeSize = recalcAxes || false;
    if (rebuildPaths !== false)
      _setScale(xScaleKey, scaleX.min, scaleX.max);
    else
      commit();
  };
  function setScale(key2, opts2) {
    let sc = scales[key2];
    if (sc.from == null) {
      if (dataLen == 0) {
        let minMax = sc.range(self, opts2.min, opts2.max, key2);
        opts2.min = minMax[0];
        opts2.max = minMax[1];
      }
      if (opts2.min > opts2.max) {
        let _min = opts2.min;
        opts2.min = opts2.max;
        opts2.max = _min;
      }
      if (dataLen > 1 && opts2.min != null && opts2.max != null && opts2.max - opts2.min < 1e-16)
        return;
      if (key2 == xScaleKey) {
        if (sc.distr == 2 && dataLen > 0) {
          opts2.min = closestIdx(opts2.min, data[0]);
          opts2.max = closestIdx(opts2.max, data[0]);
          if (opts2.min == opts2.max)
            opts2.max++;
        }
      }
      pendScales[key2] = opts2;
      shouldSetScales = true;
      commit();
    }
  }
  self.setScale = setScale;
  let xCursor;
  let yCursor;
  let vCursor;
  let hCursor;
  let rawMouseLeft0;
  let rawMouseTop0;
  let mouseLeft0;
  let mouseTop0;
  let rawMouseLeft1;
  let rawMouseTop1;
  let mouseLeft1;
  let mouseTop1;
  let dragging = false;
  const drag = cursor.drag;
  let dragX = drag.x;
  let dragY = drag.y;
  if (showCursor) {
    if (cursor.x)
      xCursor = placeDiv(CURSOR_X, over);
    if (cursor.y)
      yCursor = placeDiv(CURSOR_Y, over);
    if (scaleX.ori == 0) {
      vCursor = xCursor;
      hCursor = yCursor;
    } else {
      vCursor = yCursor;
      hCursor = xCursor;
    }
    mouseLeft1 = cursor.left;
    mouseTop1 = cursor.top;
  }
  const select = self.select = assign({
    show: true,
    over: true,
    left: 0,
    width: 0,
    top: 0,
    height: 0
  }, opts.select);
  const selectDiv = select.show ? placeDiv(SELECT, select.over ? over : under) : null;
  function setSelect(opts2, _fire) {
    if (select.show) {
      for (let prop in opts2) {
        select[prop] = opts2[prop];
        if (prop in _hideProps)
          setStylePx(selectDiv, prop, opts2[prop]);
      }
      _fire !== false && fire("setSelect");
    }
  }
  self.setSelect = setSelect;
  function toggleDOM(i3) {
    let s3 = series[i3];
    if (s3.show)
      showLegend && remClass(legendRows[i3], OFF);
    else {
      showLegend && addClass(legendRows[i3], OFF);
      if (showCursor) {
        let pt = cursorOnePt ? cursorPts[0] : cursorPts[i3];
        pt != null && elTrans(pt, -10, -10, plotWidCss, plotHgtCss);
      }
    }
  }
  function _setScale(key2, min2, max2) {
    setScale(key2, { min: min2, max: max2 });
  }
  function setSeries(i3, opts2, _fire, _pub) {
    if (opts2.focus != null)
      setFocus(i3);
    if (opts2.show != null) {
      series.forEach((s3, si) => {
        if (si > 0 && (i3 == si || i3 == null)) {
          s3.show = opts2.show;
          toggleDOM(si);
          if (mode == 2) {
            _setScale(s3.facets[0].scale, null, null);
            _setScale(s3.facets[1].scale, null, null);
          } else
            _setScale(s3.scale, null, null);
          commit();
        }
      });
    }
    _fire !== false && fire("setSeries", i3, opts2);
    _pub && pubSync("setSeries", self, i3, opts2);
  }
  self.setSeries = setSeries;
  function setBand(bi, opts2) {
    assign(bands[bi], opts2);
  }
  function addBand(opts2, bi) {
    opts2.fill = fnOrSelf(opts2.fill || null);
    opts2.dir = ifNull(opts2.dir, -1);
    bi = bi == null ? bands.length : bi;
    bands.splice(bi, 0, opts2);
  }
  function delBand(bi) {
    if (bi == null)
      bands.length = 0;
    else
      bands.splice(bi, 1);
  }
  self.addBand = addBand;
  self.setBand = setBand;
  self.delBand = delBand;
  function setAlpha(i3, value) {
    series[i3].alpha = value;
    if (showCursor && cursorPts[i3] != null)
      cursorPts[i3].style.opacity = value;
    if (showLegend && legendRows[i3])
      legendRows[i3].style.opacity = value;
  }
  let closestDist;
  let closestSeries;
  let focusedSeries;
  const FOCUS_TRUE = { focus: true };
  function setFocus(i3) {
    if (i3 != focusedSeries) {
      let allFocused = i3 == null;
      let _setAlpha = focus.alpha != 1;
      series.forEach((s3, i22) => {
        if (mode == 1 || i22 > 0) {
          let isFocused = allFocused || i22 == 0 || i22 == i3;
          s3._focus = allFocused ? null : isFocused;
          _setAlpha && setAlpha(i22, isFocused ? 1 : focus.alpha);
        }
      });
      focusedSeries = i3;
      _setAlpha && commit();
    }
  }
  if (showLegend && cursorFocus) {
    onMouse(mouseleave, legendTable, (e3) => {
      if (cursor._lock)
        return;
      setCursorEvent(e3);
      if (focusedSeries != null)
        setSeries(null, FOCUS_TRUE, true, syncOpts.setSeries);
    });
  }
  function posToVal(pos, scale, can2) {
    let sc = scales[scale];
    if (can2)
      pos = pos / pxRatio - (sc.ori == 1 ? plotTopCss : plotLftCss);
    let dim = plotWidCss;
    if (sc.ori == 1) {
      dim = plotHgtCss;
      pos = dim - pos;
    }
    if (sc.dir == -1)
      pos = dim - pos;
    let _min = sc._min, _max = sc._max, pct = pos / dim;
    let sv = _min + (_max - _min) * pct;
    let distr = sc.distr;
    return distr == 3 ? pow(10, sv) : distr == 4 ? sinh(sv, sc.asinh) : distr == 100 ? sc.bwd(sv) : sv;
  }
  function closestIdxFromXpos(pos, can2) {
    let v3 = posToVal(pos, xScaleKey, can2);
    return closestIdx(v3, data[0], i0, i1);
  }
  self.valToIdx = (val) => closestIdx(val, data[0]);
  self.posToIdx = closestIdxFromXpos;
  self.posToVal = posToVal;
  self.valToPos = (val, scale, can2) => scales[scale].ori == 0 ? getHPos(
    val,
    scales[scale],
    can2 ? plotWid : plotWidCss,
    can2 ? plotLft : 0
  ) : getVPos(
    val,
    scales[scale],
    can2 ? plotHgt : plotHgtCss,
    can2 ? plotTop : 0
  );
  self.setCursor = (opts2, _fire, _pub) => {
    mouseLeft1 = opts2.left;
    mouseTop1 = opts2.top;
    updateCursor(null, _fire, _pub);
  };
  function setSelH(off2, dim) {
    setStylePx(selectDiv, LEFT, select.left = off2);
    setStylePx(selectDiv, WIDTH, select.width = dim);
  }
  function setSelV(off2, dim) {
    setStylePx(selectDiv, TOP, select.top = off2);
    setStylePx(selectDiv, HEIGHT, select.height = dim);
  }
  let setSelX = scaleX.ori == 0 ? setSelH : setSelV;
  let setSelY = scaleX.ori == 1 ? setSelH : setSelV;
  function syncLegend() {
    if (showLegend && legend.live) {
      for (let i3 = mode == 2 ? 1 : 0; i3 < series.length; i3++) {
        if (i3 == 0 && multiValLegend)
          continue;
        let vals = legend.values[i3];
        let j4 = 0;
        for (let k3 in vals)
          legendCells[i3][j4++].firstChild.nodeValue = vals[k3];
      }
    }
  }
  function setLegend(opts2, _fire) {
    if (opts2 != null) {
      if (opts2.idxs) {
        opts2.idxs.forEach((didx, sidx) => {
          activeIdxs[sidx] = didx;
        });
      } else if (!isUndef(opts2.idx))
        activeIdxs.fill(opts2.idx);
      legend.idx = activeIdxs[0];
    }
    if (showLegend && legend.live) {
      for (let sidx = 0; sidx < series.length; sidx++) {
        if (sidx > 0 || mode == 1 && !multiValLegend)
          setLegendValues(sidx, activeIdxs[sidx]);
      }
      syncLegend();
    }
    shouldSetLegend = false;
    _fire !== false && fire("setLegend");
  }
  self.setLegend = setLegend;
  function setLegendValues(sidx, idx) {
    let s3 = series[sidx];
    let src = sidx == 0 && xScaleDistr == 2 ? data0 : data[sidx];
    let val;
    if (multiValLegend)
      val = s3.values(self, sidx, idx) ?? NULL_LEGEND_VALUES;
    else {
      val = s3.value(self, idx == null ? null : src[idx], sidx, idx);
      val = val == null ? NULL_LEGEND_VALUES : { _: val };
    }
    legend.values[sidx] = val;
  }
  function updateCursor(src, _fire, _pub) {
    rawMouseLeft1 = mouseLeft1;
    rawMouseTop1 = mouseTop1;
    [mouseLeft1, mouseTop1] = cursor.move(self, mouseLeft1, mouseTop1);
    cursor.left = mouseLeft1;
    cursor.top = mouseTop1;
    if (showCursor) {
      vCursor && elTrans(vCursor, round(mouseLeft1), 0, plotWidCss, plotHgtCss);
      hCursor && elTrans(hCursor, 0, round(mouseTop1), plotWidCss, plotHgtCss);
    }
    let idx;
    let noDataInRange = i0 > i1;
    closestDist = inf;
    closestSeries = null;
    let xDim = scaleX.ori == 0 ? plotWidCss : plotHgtCss;
    let yDim = scaleX.ori == 1 ? plotWidCss : plotHgtCss;
    if (mouseLeft1 < 0 || dataLen == 0 || noDataInRange) {
      idx = cursor.idx = null;
      for (let i3 = 0; i3 < series.length; i3++) {
        let pt = cursorPts[i3];
        pt != null && elTrans(pt, -10, -10, plotWidCss, plotHgtCss);
      }
      if (cursorFocus)
        setSeries(null, FOCUS_TRUE, true, src == null && syncOpts.setSeries);
      if (legend.live) {
        activeIdxs.fill(idx);
        shouldSetLegend = true;
      }
    } else {
      let mouseXPos, valAtPosX, xPos;
      if (mode == 1) {
        mouseXPos = scaleX.ori == 0 ? mouseLeft1 : mouseTop1;
        valAtPosX = posToVal(mouseXPos, xScaleKey);
        idx = cursor.idx = closestIdx(valAtPosX, data[0], i0, i1);
        xPos = valToPosX(data[0][idx], scaleX, xDim, 0);
      }
      let _ptLft = -10;
      let _ptTop = -10;
      let _ptWid = 0;
      let _ptHgt = 0;
      let _centered = true;
      let _ptFill = "";
      let _ptStroke = "";
      for (let i3 = mode == 2 ? 1 : 0; i3 < series.length; i3++) {
        let s3 = series[i3];
        let idx1 = activeIdxs[i3];
        let yVal1 = idx1 == null ? null : mode == 1 ? data[i3][idx1] : data[i3][1][idx1];
        let idx2 = cursor.dataIdx(self, i3, idx, valAtPosX);
        let yVal2 = idx2 == null ? null : mode == 1 ? data[i3][idx2] : data[i3][1][idx2];
        shouldSetLegend = shouldSetLegend || yVal2 != yVal1 || idx2 != idx1;
        activeIdxs[i3] = idx2;
        if (i3 > 0 && s3.show) {
          let xPos2 = idx2 == null ? -10 : idx2 == idx ? xPos : valToPosX(mode == 1 ? data[0][idx2] : data[i3][0][idx2], scaleX, xDim, 0);
          let yPos = yVal2 == null ? -10 : valToPosY(yVal2, mode == 1 ? scales[s3.scale] : scales[s3.facets[1].scale], yDim, 0);
          if (cursorFocus && yVal2 != null) {
            let mouseYPos = scaleX.ori == 1 ? mouseLeft1 : mouseTop1;
            let dist = abs(focus.dist(self, i3, idx2, yPos, mouseYPos));
            if (dist < closestDist) {
              let bias = focus.bias;
              if (bias != 0) {
                let mouseYVal = posToVal(mouseYPos, s3.scale);
                let seriesYValSign = yVal2 >= 0 ? 1 : -1;
                let mouseYValSign = mouseYVal >= 0 ? 1 : -1;
                if (mouseYValSign == seriesYValSign && (mouseYValSign == 1 ? bias == 1 ? yVal2 >= mouseYVal : yVal2 <= mouseYVal : (
                  // >= 0
                  bias == 1 ? yVal2 <= mouseYVal : yVal2 >= mouseYVal
                ))) {
                  closestDist = dist;
                  closestSeries = i3;
                }
              } else {
                closestDist = dist;
                closestSeries = i3;
              }
            }
          }
          if (shouldSetLegend || cursorOnePt) {
            let hPos, vPos;
            if (scaleX.ori == 0) {
              hPos = xPos2;
              vPos = yPos;
            } else {
              hPos = yPos;
              vPos = xPos2;
            }
            let ptWid, ptHgt, ptLft, ptTop, ptStroke, ptFill, centered = true, getBBox = points2.bbox;
            if (getBBox != null) {
              centered = false;
              let bbox = getBBox(self, i3);
              ptLft = bbox.left;
              ptTop = bbox.top;
              ptWid = bbox.width;
              ptHgt = bbox.height;
            } else {
              ptLft = hPos;
              ptTop = vPos;
              ptWid = ptHgt = points2.size(self, i3);
            }
            ptFill = points2.fill(self, i3);
            ptStroke = points2.stroke(self, i3);
            if (cursorOnePt) {
              if (i3 == closestSeries && closestDist <= focus.prox) {
                _ptLft = ptLft;
                _ptTop = ptTop;
                _ptWid = ptWid;
                _ptHgt = ptHgt;
                _centered = centered;
                _ptFill = ptFill;
                _ptStroke = ptStroke;
              }
            } else {
              let pt = cursorPts[i3];
              if (pt != null) {
                cursorPtsLft[i3] = ptLft;
                cursorPtsTop[i3] = ptTop;
                elSize(pt, ptWid, ptHgt, centered);
                elColor(pt, ptFill, ptStroke);
                elTrans(pt, ceil(ptLft), ceil(ptTop), plotWidCss, plotHgtCss);
              }
            }
          }
        }
      }
      if (cursorOnePt) {
        let p3 = focus.prox;
        let focusChanged = focusedSeries == null ? closestDist <= p3 : closestDist > p3 || closestSeries != focusedSeries;
        if (shouldSetLegend || focusChanged) {
          let pt = cursorPts[0];
          if (pt != null) {
            cursorPtsLft[0] = _ptLft;
            cursorPtsTop[0] = _ptTop;
            elSize(pt, _ptWid, _ptHgt, _centered);
            elColor(pt, _ptFill, _ptStroke);
            elTrans(pt, ceil(_ptLft), ceil(_ptTop), plotWidCss, plotHgtCss);
          }
        }
      }
    }
    if (select.show && dragging) {
      if (src != null) {
        let [xKey, yKey] = syncOpts.scales;
        let [matchXKeys, matchYKeys] = syncOpts.match;
        let [xKeySrc, yKeySrc] = src.cursor.sync.scales;
        let sdrag = src.cursor.drag;
        dragX = sdrag._x;
        dragY = sdrag._y;
        if (dragX || dragY) {
          let { left, top, width, height } = src.select;
          let sori = src.scales[xKeySrc].ori;
          let sPosToVal = src.posToVal;
          let sOff, sDim, sc, a3, b2;
          let matchingX = xKey != null && matchXKeys(xKey, xKeySrc);
          let matchingY = yKey != null && matchYKeys(yKey, yKeySrc);
          if (matchingX && dragX) {
            if (sori == 0) {
              sOff = left;
              sDim = width;
            } else {
              sOff = top;
              sDim = height;
            }
            sc = scales[xKey];
            a3 = valToPosX(sPosToVal(sOff, xKeySrc), sc, xDim, 0);
            b2 = valToPosX(sPosToVal(sOff + sDim, xKeySrc), sc, xDim, 0);
            setSelX(min(a3, b2), abs(b2 - a3));
          } else
            setSelX(0, xDim);
          if (matchingY && dragY) {
            if (sori == 1) {
              sOff = left;
              sDim = width;
            } else {
              sOff = top;
              sDim = height;
            }
            sc = scales[yKey];
            a3 = valToPosY(sPosToVal(sOff, yKeySrc), sc, yDim, 0);
            b2 = valToPosY(sPosToVal(sOff + sDim, yKeySrc), sc, yDim, 0);
            setSelY(min(a3, b2), abs(b2 - a3));
          } else
            setSelY(0, yDim);
        } else
          hideSelect();
      } else {
        let rawDX = abs(rawMouseLeft1 - rawMouseLeft0);
        let rawDY = abs(rawMouseTop1 - rawMouseTop0);
        if (scaleX.ori == 1) {
          let _rawDX = rawDX;
          rawDX = rawDY;
          rawDY = _rawDX;
        }
        dragX = drag.x && rawDX >= drag.dist;
        dragY = drag.y && rawDY >= drag.dist;
        let uni = drag.uni;
        if (uni != null) {
          if (dragX && dragY) {
            dragX = rawDX >= uni;
            dragY = rawDY >= uni;
            if (!dragX && !dragY) {
              if (rawDY > rawDX)
                dragY = true;
              else
                dragX = true;
            }
          }
        } else if (drag.x && drag.y && (dragX || dragY))
          dragX = dragY = true;
        let p0, p1;
        if (dragX) {
          if (scaleX.ori == 0) {
            p0 = mouseLeft0;
            p1 = mouseLeft1;
          } else {
            p0 = mouseTop0;
            p1 = mouseTop1;
          }
          setSelX(min(p0, p1), abs(p1 - p0));
          if (!dragY)
            setSelY(0, yDim);
        }
        if (dragY) {
          if (scaleX.ori == 1) {
            p0 = mouseLeft0;
            p1 = mouseLeft1;
          } else {
            p0 = mouseTop0;
            p1 = mouseTop1;
          }
          setSelY(min(p0, p1), abs(p1 - p0));
          if (!dragX)
            setSelX(0, xDim);
        }
        if (!dragX && !dragY) {
          setSelX(0, 0);
          setSelY(0, 0);
        }
      }
    }
    drag._x = dragX;
    drag._y = dragY;
    if (src == null) {
      if (_pub) {
        if (syncKey != null) {
          let [xSyncKey, ySyncKey] = syncOpts.scales;
          syncOpts.values[0] = xSyncKey != null ? posToVal(scaleX.ori == 0 ? mouseLeft1 : mouseTop1, xSyncKey) : null;
          syncOpts.values[1] = ySyncKey != null ? posToVal(scaleX.ori == 1 ? mouseLeft1 : mouseTop1, ySyncKey) : null;
        }
        pubSync(mousemove, self, mouseLeft1, mouseTop1, plotWidCss, plotHgtCss, idx);
      }
      if (cursorFocus) {
        let shouldPub = _pub && syncOpts.setSeries;
        let p3 = focus.prox;
        if (focusedSeries == null) {
          if (closestDist <= p3)
            setSeries(closestSeries, FOCUS_TRUE, true, shouldPub);
        } else {
          if (closestDist > p3)
            setSeries(null, FOCUS_TRUE, true, shouldPub);
          else if (closestSeries != focusedSeries)
            setSeries(closestSeries, FOCUS_TRUE, true, shouldPub);
        }
      }
    }
    if (shouldSetLegend) {
      legend.idx = idx;
      setLegend();
    }
    _fire !== false && fire("setCursor");
  }
  let rect2 = null;
  Object.defineProperty(self, "rect", {
    get() {
      if (rect2 == null)
        syncRect(false);
      return rect2;
    }
  });
  function syncRect(defer = false) {
    if (defer)
      rect2 = null;
    else {
      rect2 = over.getBoundingClientRect();
      fire("syncRect", rect2);
    }
  }
  function mouseMove(e3, src, _l, _t, _w, _h, _i) {
    if (cursor._lock)
      return;
    if (dragging && e3 != null && e3.movementX == 0 && e3.movementY == 0)
      return;
    cacheMouse(e3, src, _l, _t, _w, _h, _i, false, e3 != null);
    if (e3 != null)
      updateCursor(null, true, true);
    else
      updateCursor(src, true, false);
  }
  function cacheMouse(e3, src, _l, _t, _w, _h, _i, initial, snap) {
    if (rect2 == null)
      syncRect(false);
    setCursorEvent(e3);
    if (e3 != null) {
      _l = e3.clientX - rect2.left;
      _t = e3.clientY - rect2.top;
    } else {
      if (_l < 0 || _t < 0) {
        mouseLeft1 = -10;
        mouseTop1 = -10;
        return;
      }
      let [xKey, yKey] = syncOpts.scales;
      let syncOptsSrc = src.cursor.sync;
      let [xValSrc, yValSrc] = syncOptsSrc.values;
      let [xKeySrc, yKeySrc] = syncOptsSrc.scales;
      let [matchXKeys, matchYKeys] = syncOpts.match;
      let rotSrc = src.axes[0].side % 2 == 1;
      let xDim = scaleX.ori == 0 ? plotWidCss : plotHgtCss, yDim = scaleX.ori == 1 ? plotWidCss : plotHgtCss, _xDim = rotSrc ? _h : _w, _yDim = rotSrc ? _w : _h, _xPos = rotSrc ? _t : _l, _yPos = rotSrc ? _l : _t;
      if (xKeySrc != null)
        _l = matchXKeys(xKey, xKeySrc) ? getPos(xValSrc, scales[xKey], xDim, 0) : -10;
      else
        _l = xDim * (_xPos / _xDim);
      if (yKeySrc != null)
        _t = matchYKeys(yKey, yKeySrc) ? getPos(yValSrc, scales[yKey], yDim, 0) : -10;
      else
        _t = yDim * (_yPos / _yDim);
      if (scaleX.ori == 1) {
        let __l = _l;
        _l = _t;
        _t = __l;
      }
    }
    if (snap && (src == null || src.cursor.event.type == mousemove)) {
      if (_l <= 1 || _l >= plotWidCss - 1)
        _l = incrRound(_l, plotWidCss);
      if (_t <= 1 || _t >= plotHgtCss - 1)
        _t = incrRound(_t, plotHgtCss);
    }
    if (initial) {
      rawMouseLeft0 = _l;
      rawMouseTop0 = _t;
      [mouseLeft0, mouseTop0] = cursor.move(self, _l, _t);
    } else {
      mouseLeft1 = _l;
      mouseTop1 = _t;
    }
  }
  const _hideProps = {
    width: 0,
    height: 0,
    left: 0,
    top: 0
  };
  function hideSelect() {
    setSelect(_hideProps, false);
  }
  let downSelectLeft;
  let downSelectTop;
  let downSelectWidth;
  let downSelectHeight;
  function mouseDown(e3, src, _l, _t, _w, _h, _i) {
    dragging = true;
    dragX = dragY = drag._x = drag._y = false;
    cacheMouse(e3, src, _l, _t, _w, _h, _i, true, false);
    if (e3 != null) {
      onMouse(mouseup, doc, mouseUp, false);
      pubSync(mousedown, self, mouseLeft0, mouseTop0, plotWidCss, plotHgtCss, null);
    }
    let { left, top, width, height } = select;
    downSelectLeft = left;
    downSelectTop = top;
    downSelectWidth = width;
    downSelectHeight = height;
  }
  function mouseUp(e3, src, _l, _t, _w, _h, _i) {
    dragging = drag._x = drag._y = false;
    cacheMouse(e3, src, _l, _t, _w, _h, _i, false, true);
    let { left, top, width, height } = select;
    let hasSelect = width > 0 || height > 0;
    let chgSelect = downSelectLeft != left || downSelectTop != top || downSelectWidth != width || downSelectHeight != height;
    hasSelect && chgSelect && setSelect(select);
    if (drag.setScale && hasSelect && chgSelect) {
      let xOff = left, xDim = width, yOff = top, yDim = height;
      if (scaleX.ori == 1) {
        xOff = top, xDim = height, yOff = left, yDim = width;
      }
      if (dragX) {
        _setScale(
          xScaleKey,
          posToVal(xOff, xScaleKey),
          posToVal(xOff + xDim, xScaleKey)
        );
      }
      if (dragY) {
        for (let k3 in scales) {
          let sc = scales[k3];
          if (k3 != xScaleKey && sc.from == null && sc.min != inf) {
            _setScale(
              k3,
              posToVal(yOff + yDim, k3),
              posToVal(yOff, k3)
            );
          }
        }
      }
      hideSelect();
    } else if (cursor.lock) {
      cursor._lock = !cursor._lock;
      updateCursor(src, true, e3 != null);
    }
    if (e3 != null) {
      offMouse(mouseup, doc);
      pubSync(mouseup, self, mouseLeft1, mouseTop1, plotWidCss, plotHgtCss, null);
    }
  }
  function mouseLeave(e3, src, _l, _t, _w, _h, _i) {
    if (cursor._lock)
      return;
    setCursorEvent(e3);
    let _dragging = dragging;
    if (dragging) {
      let snapH = true;
      let snapV = true;
      let snapProx = 10;
      let dragH, dragV;
      if (scaleX.ori == 0) {
        dragH = dragX;
        dragV = dragY;
      } else {
        dragH = dragY;
        dragV = dragX;
      }
      if (dragH && dragV) {
        snapH = mouseLeft1 <= snapProx || mouseLeft1 >= plotWidCss - snapProx;
        snapV = mouseTop1 <= snapProx || mouseTop1 >= plotHgtCss - snapProx;
      }
      if (dragH && snapH)
        mouseLeft1 = mouseLeft1 < mouseLeft0 ? 0 : plotWidCss;
      if (dragV && snapV)
        mouseTop1 = mouseTop1 < mouseTop0 ? 0 : plotHgtCss;
      updateCursor(null, true, true);
      dragging = false;
    }
    mouseLeft1 = -10;
    mouseTop1 = -10;
    activeIdxs.fill(null);
    updateCursor(null, true, true);
    if (_dragging)
      dragging = _dragging;
  }
  function dblClick(e3, src, _l, _t, _w, _h, _i) {
    if (cursor._lock)
      return;
    setCursorEvent(e3);
    autoScaleX();
    hideSelect();
    if (e3 != null)
      pubSync(dblclick, self, mouseLeft1, mouseTop1, plotWidCss, plotHgtCss, null);
  }
  function syncPxRatio() {
    axes.forEach(syncFontSize);
    _setSize(self.width, self.height, true);
  }
  on2(dppxchange, win, syncPxRatio);
  const events = {};
  events.mousedown = mouseDown;
  events.mousemove = mouseMove;
  events.mouseup = mouseUp;
  events.dblclick = dblClick;
  events["setSeries"] = (e3, src, idx, opts2) => {
    let seriesIdxMatcher2 = syncOpts.match[2];
    idx = seriesIdxMatcher2(self, src, idx);
    idx != -1 && setSeries(idx, opts2, true, false);
  };
  if (showCursor) {
    onMouse(mousedown, over, mouseDown);
    onMouse(mousemove, over, mouseMove);
    onMouse(mouseenter, over, (e3) => {
      setCursorEvent(e3);
      syncRect(false);
    });
    onMouse(mouseleave, over, mouseLeave);
    onMouse(dblclick, over, dblClick);
    cursorPlots.add(self);
    self.syncRect = syncRect;
  }
  const hooks = self.hooks = opts.hooks || {};
  function fire(evName, a1, a22) {
    if (deferHooks)
      hooksQueue.push([evName, a1, a22]);
    else {
      if (evName in hooks) {
        hooks[evName].forEach((fn) => {
          fn.call(null, self, a1, a22);
        });
      }
    }
  }
  (opts.plugins || []).forEach((p3) => {
    for (let evName in p3.hooks)
      hooks[evName] = (hooks[evName] || []).concat(p3.hooks[evName]);
  });
  const seriesIdxMatcher = (self2, src, srcSeriesIdx) => srcSeriesIdx;
  const syncOpts = assign({
    key: null,
    setSeries: false,
    filters: {
      pub: retTrue,
      sub: retTrue
    },
    scales: [xScaleKey, series[1] ? series[1].scale : null],
    match: [retEq, retEq, seriesIdxMatcher],
    values: [null, null]
  }, cursor.sync);
  if (syncOpts.match.length == 2)
    syncOpts.match.push(seriesIdxMatcher);
  cursor.sync = syncOpts;
  const syncKey = syncOpts.key;
  const sync = _sync(syncKey);
  function pubSync(type, src, x3, y3, w3, h3, i3) {
    if (syncOpts.filters.pub(type, src, x3, y3, w3, h3, i3))
      sync.pub(type, src, x3, y3, w3, h3, i3);
  }
  sync.sub(self);
  function pub(type, src, x3, y3, w3, h3, i3) {
    if (syncOpts.filters.sub(type, src, x3, y3, w3, h3, i3))
      events[type](null, src, x3, y3, w3, h3, i3);
  }
  self.pub = pub;
  function destroy() {
    sync.unsub(self);
    cursorPlots.delete(self);
    mouseListeners.clear();
    off(dppxchange, win, syncPxRatio);
    root.remove();
    legendTable?.remove();
    fire("destroy");
  }
  self.destroy = destroy;
  function _init() {
    fire("init", opts, data);
    setData(data || opts.data, false);
    if (pendScales[xScaleKey])
      setScale(xScaleKey, pendScales[xScaleKey]);
    else
      autoScaleX();
    shouldSetSelect = select.show && (select.width > 0 || select.height > 0);
    shouldSetCursor = shouldSetLegend = true;
    _setSize(opts.width, opts.height);
  }
  series.forEach(initSeries);
  axes.forEach(initAxis);
  if (then) {
    if (then instanceof HTMLElement) {
      then.appendChild(root);
      _init();
    } else
      then(self, _init);
  } else
    _init();
  return self;
}
var FEAT_TIME, pre, UPLOT, ORI_HZ, ORI_VT, TITLE, WRAP, UNDER, OVER, AXIS, OFF, SELECT, CURSOR_X, CURSOR_Y, CURSOR_PT, LEGEND, LEGEND_LIVE, LEGEND_INLINE, LEGEND_SERIES, LEGEND_MARKER, LEGEND_LABEL, LEGEND_VALUE, WIDTH, HEIGHT, TOP, BOTTOM, LEFT, RIGHT, hexBlack, transparent, mousemove, mousedown, mouseup, mouseenter, mouseleave, dblclick, resize, scroll, change, dppxchange, LEGEND_DISP, domEnv, doc, win, nav, pxRatio, query, xformCache, colorCache, sizeCache, evOpts, evOpts2, notNullish, isPositive, nonNullIdxs, positiveIdxs, rangePad, autoRangePart, _eqRangePart, _eqRange, numFormatter, fmtNum2, M3, PI, abs, floor, round, ceil, min, max, pow, sign, log10, log2, sinh, asinh, inf, noop, retArg0, retArg1, retNull, retTrue, retEq, regex6, fixFloat, fixedDec, EMPTY_OBJ, EMPTY_ARR, nullNullTuple, isArr, isInt, isUndef, TypedArray, __proto__, NULL_REMOVE, NULL_RETAIN, NULL_EXPAND, microTask, months, days, days3, months3, engNames, subs, localTz, onlyWhole, allMults, decIncrs, oneIncrs, wholeIncrs, numIncrs, NL, yyyy, NLyyyy, md, NLmd, NLmdyy, aa, hmm, hmmaa, NLhmmaa, ss, _3, timeIncrsMs, _timeAxisStampsMs, timeAxisSplitsMs, timeIncrsS, _timeAxisStampsS, timeAxisSplitsS, _timeSeriesStamp, legendOpts, moveTuple, cursorOpts, axisLines, grid, ticks, border, font, labelFont, lineGap, xAxisOpts, numSeriesLabel, timeSeriesLabel, xSeriesOpts, RE_ALL, RE_12357, RE_125, RE_1, _filt, yAxisOpts, facet, gaps, xySeriesOpts, ySeriesOpts, xScaleOpts, yScaleOpts, syncs, BAND_CLIP_FILL, BAND_CLIP_STROKE, moveToH, moveToV, lineToH, lineToV, rectH, rectV, arcH, arcV, bezierCurveToH, bezierCurveToV, drawAccH, drawAccV, cursorPlots, linearPath, pointsPath, snapTimeX, snapLogX, snapAsinhX;
var init_uPlot_esm = __esm({
  "node_modules/uplot/dist/uPlot.esm.js"() {
    "use strict";
    FEAT_TIME = true;
    pre = "u-";
    UPLOT = "uplot";
    ORI_HZ = pre + "hz";
    ORI_VT = pre + "vt";
    TITLE = pre + "title";
    WRAP = pre + "wrap";
    UNDER = pre + "under";
    OVER = pre + "over";
    AXIS = pre + "axis";
    OFF = pre + "off";
    SELECT = pre + "select";
    CURSOR_X = pre + "cursor-x";
    CURSOR_Y = pre + "cursor-y";
    CURSOR_PT = pre + "cursor-pt";
    LEGEND = pre + "legend";
    LEGEND_LIVE = pre + "live";
    LEGEND_INLINE = pre + "inline";
    LEGEND_SERIES = pre + "series";
    LEGEND_MARKER = pre + "marker";
    LEGEND_LABEL = pre + "label";
    LEGEND_VALUE = pre + "value";
    WIDTH = "width";
    HEIGHT = "height";
    TOP = "top";
    BOTTOM = "bottom";
    LEFT = "left";
    RIGHT = "right";
    hexBlack = "#000";
    transparent = hexBlack + "0";
    mousemove = "mousemove";
    mousedown = "mousedown";
    mouseup = "mouseup";
    mouseenter = "mouseenter";
    mouseleave = "mouseleave";
    dblclick = "dblclick";
    resize = "resize";
    scroll = "scroll";
    change = "change";
    dppxchange = "dppxchange";
    LEGEND_DISP = "--";
    domEnv = typeof window != "undefined";
    doc = domEnv ? document : null;
    win = domEnv ? window : null;
    nav = domEnv ? navigator : null;
    xformCache = /* @__PURE__ */ new WeakMap();
    colorCache = /* @__PURE__ */ new WeakMap();
    sizeCache = /* @__PURE__ */ new WeakMap();
    evOpts = { passive: true };
    evOpts2 = { ...evOpts, capture: true };
    domEnv && setPxRatio();
    notNullish = (v3) => v3 != null;
    isPositive = (v3) => v3 != null && v3 > 0;
    nonNullIdxs = makeIndexOfs(notNullish);
    positiveIdxs = makeIndexOfs(isPositive);
    rangePad = 0.1;
    autoRangePart = {
      mode: 3,
      pad: rangePad
    };
    _eqRangePart = {
      pad: 0,
      soft: null,
      mode: 0
    };
    _eqRange = {
      min: _eqRangePart,
      max: _eqRangePart
    };
    numFormatter = new Intl.NumberFormat(domEnv ? nav.language : "en-US");
    fmtNum2 = (val) => numFormatter.format(val);
    M3 = Math;
    PI = M3.PI;
    abs = M3.abs;
    floor = M3.floor;
    round = M3.round;
    ceil = M3.ceil;
    min = M3.min;
    max = M3.max;
    pow = M3.pow;
    sign = M3.sign;
    log10 = M3.log10;
    log2 = M3.log2;
    sinh = (v3, linthresh = 1) => M3.sinh(v3) * linthresh;
    asinh = (v3, linthresh = 1) => M3.asinh(v3 / linthresh);
    inf = Infinity;
    noop = () => {
    };
    retArg0 = (_0) => _0;
    retArg1 = (_0, _1) => _1;
    retNull = (_4) => null;
    retTrue = (_4) => true;
    retEq = (a3, b2) => a3 == b2;
    regex6 = /\.\d*?(?=9{6,}|0{6,})/gm;
    fixFloat = (val) => {
      if (isInt(val) || fixedDec.has(val))
        return val;
      const str = `${val}`;
      const match = str.match(regex6);
      if (match == null)
        return val;
      let len = match[0].length - 1;
      if (str.indexOf("e-") != -1) {
        let [num, exp] = str.split("e");
        return +`${fixFloat(num)}e${exp}`;
      }
      return roundDec(val, len);
    };
    fixedDec = /* @__PURE__ */ new Map();
    EMPTY_OBJ = {};
    EMPTY_ARR = [];
    nullNullTuple = [null, null];
    isArr = Array.isArray;
    isInt = Number.isInteger;
    isUndef = (v3) => v3 === void 0;
    TypedArray = Object.getPrototypeOf(Uint8Array);
    __proto__ = "__proto__";
    NULL_REMOVE = 0;
    NULL_RETAIN = 1;
    NULL_EXPAND = 2;
    microTask = typeof queueMicrotask == "undefined" ? (fn) => Promise.resolve().then(fn) : queueMicrotask;
    months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December"
    ];
    days = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday"
    ];
    days3 = days.map(slice3);
    months3 = months.map(slice3);
    engNames = {
      MMMM: months,
      MMM: months3,
      WWWW: days,
      WWW: days3
    };
    subs = {
      // 2019
      YYYY: (d3) => d3.getFullYear(),
      // 19
      YY: (d3) => (d3.getFullYear() + "").slice(2),
      // July
      MMMM: (d3, names) => names.MMMM[d3.getMonth()],
      // Jul
      MMM: (d3, names) => names.MMM[d3.getMonth()],
      // 07
      MM: (d3) => zeroPad2(d3.getMonth() + 1),
      // 7
      M: (d3) => d3.getMonth() + 1,
      // 09
      DD: (d3) => zeroPad2(d3.getDate()),
      // 9
      D: (d3) => d3.getDate(),
      // Monday
      WWWW: (d3, names) => names.WWWW[d3.getDay()],
      // Mon
      WWW: (d3, names) => names.WWW[d3.getDay()],
      // 03
      HH: (d3) => zeroPad2(d3.getHours()),
      // 3
      H: (d3) => d3.getHours(),
      // 9 (12hr, unpadded)
      h: (d3) => {
        let h3 = d3.getHours();
        return h3 == 0 ? 12 : h3 > 12 ? h3 - 12 : h3;
      },
      // AM
      AA: (d3) => d3.getHours() >= 12 ? "PM" : "AM",
      // am
      aa: (d3) => d3.getHours() >= 12 ? "pm" : "am",
      // a
      a: (d3) => d3.getHours() >= 12 ? "p" : "a",
      // 09
      mm: (d3) => zeroPad2(d3.getMinutes()),
      // 9
      m: (d3) => d3.getMinutes(),
      // 09
      ss: (d3) => zeroPad2(d3.getSeconds()),
      // 9
      s: (d3) => d3.getSeconds(),
      // 374
      fff: (d3) => zeroPad3(d3.getMilliseconds())
    };
    localTz = new Intl.DateTimeFormat().resolvedOptions().timeZone;
    onlyWhole = (v3) => v3 % 1 == 0;
    allMults = [1, 2, 2.5, 5];
    decIncrs = genIncrs(10, -32, 0, allMults);
    oneIncrs = genIncrs(10, 0, 32, allMults);
    wholeIncrs = oneIncrs.filter(onlyWhole);
    numIncrs = decIncrs.concat(oneIncrs);
    NL = "\n";
    yyyy = "{YYYY}";
    NLyyyy = NL + yyyy;
    md = "{M}/{D}";
    NLmd = NL + md;
    NLmdyy = NLmd + "/{YY}";
    aa = "{aa}";
    hmm = "{h}:{mm}";
    hmmaa = hmm + aa;
    NLhmmaa = NL + hmmaa;
    ss = ":{ss}";
    _3 = null;
    [timeIncrsMs, _timeAxisStampsMs, timeAxisSplitsMs] = genTimeStuffs(1);
    [timeIncrsS, _timeAxisStampsS, timeAxisSplitsS] = genTimeStuffs(1e-3);
    genIncrs(2, -53, 53, [1]);
    _timeSeriesStamp = "{YYYY}-{MM}-{DD} {h}:{mm}{aa}";
    legendOpts = {
      show: true,
      live: true,
      isolate: false,
      mount: noop,
      markers: {
        show: true,
        width: 2,
        stroke: legendStroke,
        fill: legendFill,
        dash: "solid"
      },
      idx: null,
      idxs: null,
      values: []
    };
    moveTuple = [0, 0];
    cursorOpts = {
      show: true,
      x: true,
      y: true,
      lock: false,
      move: cursorMove,
      points: {
        one: false,
        show: cursorPointShow,
        size: cursorPointSize,
        width: 0,
        stroke: cursorPointStroke,
        fill: cursorPointFill
      },
      bind: {
        mousedown: filtBtn0,
        mouseup: filtBtn0,
        click: filtBtn0,
        // legend clicks, not .u-over clicks
        dblclick: filtBtn0,
        mousemove: filtTarg,
        mouseleave: filtTarg,
        mouseenter: filtTarg
      },
      drag: {
        setScale: true,
        x: true,
        y: false,
        dist: 0,
        uni: null,
        click: (self, e3) => {
          e3.stopPropagation();
          e3.stopImmediatePropagation();
        },
        _x: false,
        _y: false
      },
      focus: {
        dist: (self, seriesIdx, dataIdx, valPos, curPos) => valPos - curPos,
        prox: -1,
        bias: 0
      },
      hover: {
        skip: [void 0],
        prox: null,
        bias: 0
      },
      left: -10,
      top: -10,
      idx: null,
      dataIdx: null,
      idxs: null,
      event: null
    };
    axisLines = {
      show: true,
      stroke: "rgba(0,0,0,0.07)",
      width: 2
      //	dash: [],
    };
    grid = assign({}, axisLines, {
      filter: retArg1
    });
    ticks = assign({}, grid, {
      size: 10
    });
    border = assign({}, axisLines, {
      show: false
    });
    font = '12px system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"';
    labelFont = "bold " + font;
    lineGap = 1.5;
    xAxisOpts = {
      show: true,
      scale: "x",
      stroke: hexBlack,
      space: 50,
      gap: 5,
      alignTo: 1,
      size: 50,
      labelGap: 0,
      labelSize: 30,
      labelFont,
      side: 2,
      //	class: "x-vals",
      //	incrs: timeIncrs,
      //	values: timeVals,
      //	filter: retArg1,
      grid,
      ticks,
      border,
      font,
      lineGap,
      rotate: 0
    };
    numSeriesLabel = "Value";
    timeSeriesLabel = "Time";
    xSeriesOpts = {
      show: true,
      scale: "x",
      auto: false,
      sorted: 1,
      //	label: "Time",
      //	value: v => stamp(new Date(v * 1e3)),
      // internal caches
      min: inf,
      max: -inf,
      idxs: []
    };
    RE_ALL = /./;
    RE_12357 = /[12357]/;
    RE_125 = /[125]/;
    RE_1 = /1/;
    _filt = (splits, distr, re, keepMod) => splits.map((v3, i3) => distr == 4 && v3 == 0 || i3 % keepMod == 0 && re.test(v3.toExponential()[v3 < 0 ? 1 : 0]) ? v3 : null);
    yAxisOpts = {
      show: true,
      scale: "y",
      stroke: hexBlack,
      space: 30,
      gap: 5,
      alignTo: 1,
      size: 50,
      labelGap: 0,
      labelSize: 30,
      labelFont,
      side: 3,
      //	class: "y-vals",
      //	incrs: numIncrs,
      //	values: (vals, space) => vals,
      //	filter: retArg1,
      grid,
      ticks,
      border,
      font,
      lineGap,
      rotate: 0
    };
    facet = {
      scale: null,
      auto: true,
      sorted: 0,
      // internal caches
      min: inf,
      max: -inf
    };
    gaps = (self, seriesIdx, idx0, idx1, nullGaps) => nullGaps;
    xySeriesOpts = {
      show: true,
      auto: true,
      sorted: 0,
      gaps,
      alpha: 1,
      facets: [
        assign({}, facet, { scale: "x" }),
        assign({}, facet, { scale: "y" })
      ]
    };
    ySeriesOpts = {
      scale: "y",
      auto: true,
      sorted: 0,
      show: true,
      spanGaps: false,
      gaps,
      alpha: 1,
      points: {
        show: seriesPointsShow,
        filter: null
        //  paths:
        //	stroke: "#000",
        //	fill: "#fff",
        //	width: 1,
        //	size: 10,
      },
      //	label: "Value",
      //	value: v => v,
      values: null,
      // internal caches
      min: inf,
      max: -inf,
      idxs: [],
      path: null,
      clip: null
    };
    xScaleOpts = {
      time: FEAT_TIME,
      auto: true,
      distr: 1,
      log: 10,
      asinh: 1,
      min: null,
      max: null,
      dir: 1,
      ori: 0
    };
    yScaleOpts = assign({}, xScaleOpts, {
      time: false,
      ori: 1
    });
    syncs = {};
    BAND_CLIP_FILL = 1 << 0;
    BAND_CLIP_STROKE = 1 << 1;
    moveToH = (p3, x3, y3) => {
      p3.moveTo(x3, y3);
    };
    moveToV = (p3, y3, x3) => {
      p3.moveTo(x3, y3);
    };
    lineToH = (p3, x3, y3) => {
      p3.lineTo(x3, y3);
    };
    lineToV = (p3, y3, x3) => {
      p3.lineTo(x3, y3);
    };
    rectH = rect(0);
    rectV = rect(1);
    arcH = (p3, x3, y3, r3, startAngle, endAngle) => {
      p3.arc(x3, y3, r3, startAngle, endAngle);
    };
    arcV = (p3, y3, x3, r3, startAngle, endAngle) => {
      p3.arc(x3, y3, r3, startAngle, endAngle);
    };
    bezierCurveToH = (p3, bp1x, bp1y, bp2x, bp2y, p2x, p2y) => {
      p3.bezierCurveTo(bp1x, bp1y, bp2x, bp2y, p2x, p2y);
    };
    bezierCurveToV = (p3, bp1y, bp1x, bp2y, bp2x, p2y, p2x) => {
      p3.bezierCurveTo(bp1x, bp1y, bp2x, bp2y, p2x, p2y);
    };
    drawAccH = _drawAcc(lineToH);
    drawAccV = _drawAcc(lineToV);
    cursorPlots = /* @__PURE__ */ new Set();
    if (domEnv) {
      on2(resize, win, invalidateRects);
      on2(scroll, win, invalidateRects, true);
      on2(dppxchange, win, () => {
        uPlot.pxRatio = pxRatio;
      });
    }
    linearPath = linear();
    pointsPath = points();
    snapTimeX = snapNumX;
    snapLogX = snapLogY;
    snapAsinhX = snapAsinhY;
    uPlot.assign = assign;
    uPlot.fmtNum = fmtNum2;
    uPlot.rangeNum = rangeNum;
    uPlot.rangeLog = rangeLog;
    uPlot.rangeAsinh = rangeAsinh;
    uPlot.orient = orient;
    uPlot.pxRatio = pxRatio;
    {
      uPlot.join = join;
    }
    {
      uPlot.fmtDate = fmtDate;
      uPlot.tzDate = tzDate;
    }
    uPlot.sync = _sync;
    {
      uPlot.addGap = addGap;
      uPlot.clipGaps = clipGaps;
      let paths = uPlot.paths = {
        points
      };
      paths.linear = linear;
      paths.stepped = stepped;
      paths.bars = bars;
      paths.spline = monotoneCubic;
    }
  }
});

// node_modules/htm/dist/htm.module.js
var n = function(t5, s3, r3, e3) {
  var u3;
  s3[0] = 0;
  for (var h3 = 1; h3 < s3.length; h3++) {
    var p3 = s3[h3++], a3 = s3[h3] ? (s3[0] |= p3 ? 1 : 2, r3[s3[h3++]]) : s3[++h3];
    3 === p3 ? e3[0] = a3 : 4 === p3 ? e3[1] = Object.assign(e3[1] || {}, a3) : 5 === p3 ? (e3[1] = e3[1] || {})[s3[++h3]] = a3 : 6 === p3 ? e3[1][s3[++h3]] += a3 + "" : p3 ? (u3 = t5.apply(a3, n(t5, a3, r3, ["", null])), e3.push(u3), a3[0] ? s3[0] |= 2 : (s3[h3 - 2] = 0, s3[h3] = u3)) : e3.push(a3);
  }
  return e3;
};
var t = /* @__PURE__ */ new Map();
function htm_module_default(s3) {
  var r3 = t.get(this);
  return r3 || (r3 = /* @__PURE__ */ new Map(), t.set(this, r3)), (r3 = n(this, r3.get(s3) || (r3.set(s3, r3 = (function(n3) {
    for (var t5, s4, r4 = 1, e3 = "", u3 = "", h3 = [0], p3 = function(n4) {
      1 === r4 && (n4 || (e3 = e3.replace(/^\s*\n\s*|\s*\n\s*$/g, ""))) ? h3.push(0, n4, e3) : 3 === r4 && (n4 || e3) ? (h3.push(3, n4, e3), r4 = 2) : 2 === r4 && "..." === e3 && n4 ? h3.push(4, n4, 0) : 2 === r4 && e3 && !n4 ? h3.push(5, 0, true, e3) : r4 >= 5 && ((e3 || !n4 && 5 === r4) && (h3.push(r4, 0, e3, s4), r4 = 6), n4 && (h3.push(r4, n4, 0, s4), r4 = 6)), e3 = "";
    }, a3 = 0; a3 < n3.length; a3++) {
      a3 && (1 === r4 && p3(), p3(a3));
      for (var l3 = 0; l3 < n3[a3].length; l3++) t5 = n3[a3][l3], 1 === r4 ? "<" === t5 ? (p3(), h3 = [h3], r4 = 3) : e3 += t5 : 4 === r4 ? "--" === e3 && ">" === t5 ? (r4 = 1, e3 = "") : e3 = t5 + e3[0] : u3 ? t5 === u3 ? u3 = "" : e3 += t5 : '"' === t5 || "'" === t5 ? u3 = t5 : ">" === t5 ? (p3(), r4 = 1) : r4 && ("=" === t5 ? (r4 = 5, s4 = e3, e3 = "") : "/" === t5 && (r4 < 5 || ">" === n3[a3][l3 + 1]) ? (p3(), 3 === r4 && (h3 = h3[0]), r4 = h3, (h3 = h3[0]).push(2, 0, r4), r4 = 0) : " " === t5 || "	" === t5 || "\n" === t5 || "\r" === t5 ? (p3(), r4 = 2) : e3 += t5), 3 === r4 && "!--" === e3 && (r4 = 4, h3 = h3[0]);
    }
    return p3(), h3;
  })(s3)), r3), arguments, [])).length > 1 ? r3 : r3[0];
}

// node_modules/preact/dist/preact.module.js
var n2;
var l;
var u;
var t2;
var i;
var r;
var o;
var e;
var f;
var c;
var s;
var a;
var h;
var p;
var v;
var y;
var d = {};
var w = [];
var _ = /acit|ex(?:s|g|n|p|$)|rph|grid|ows|mnc|ntw|ine[ch]|zoo|^ord|itera/i;
var g = Array.isArray;
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
function L(n3, l3, u3, t5, i3, r3, o3, e3, f3, c3, s3) {
  var a3, h3, p3, v3, y3, _4, g4, m3 = t5 && t5.__k || w, b2 = l3.length;
  for (f3 = T(u3, l3, m3, f3, b2), a3 = 0; a3 < b2; a3++) null != (p3 = u3.__k[a3]) && (h3 = -1 != p3.__i && m3[p3.__i] || d, p3.__i = a3, _4 = q(n3, p3, h3, i3, r3, o3, e3, f3, c3, s3), v3 = p3.__e, p3.ref && h3.ref != p3.ref && (h3.ref && J(h3.ref, null, p3), s3.push(p3.ref, p3.__c || v3, p3)), null == y3 && null != v3 && (y3 = v3), (g4 = !!(4 & p3.__u)) || h3.__k === p3.__k ? (f3 = j(p3, f3, n3, g4), g4 && h3.__e && (h3.__e = null)) : "function" == typeof p3.type && void 0 !== _4 ? f3 = _4 : v3 && (f3 = v3.nextSibling), p3.__u &= -7);
  return u3.__e = y3, f3;
}
function T(n3, l3, u3, t5, i3) {
  var r3, o3, e3, f3, c3, s3 = u3.length, a3 = s3, h3 = 0;
  for (n3.__k = new Array(i3), r3 = 0; r3 < i3; r3++) null != (o3 = l3[r3]) && "boolean" != typeof o3 && "function" != typeof o3 ? ("string" == typeof o3 || "number" == typeof o3 || "bigint" == typeof o3 || o3.constructor == String ? o3 = n3.__k[r3] = x(null, o3, null, null, null) : g(o3) ? o3 = n3.__k[r3] = x(S, { children: o3 }, null, null, null) : void 0 === o3.constructor && o3.__b > 0 ? o3 = n3.__k[r3] = x(o3.type, o3.props, o3.key, o3.ref ? o3.ref : null, o3.__v) : n3.__k[r3] = o3, f3 = r3 + h3, o3.__ = n3, o3.__b = n3.__b + 1, e3 = null, -1 != (c3 = o3.__i = O(o3, u3, f3, a3)) && (a3--, (e3 = u3[c3]) && (e3.__u |= 2)), null == e3 || null == e3.__v ? (-1 == c3 && (i3 > s3 ? h3-- : i3 < s3 && h3++), "function" != typeof o3.type && (o3.__u |= 4)) : c3 != f3 && (c3 == f3 - 1 ? h3-- : c3 == f3 + 1 ? h3++ : (c3 > f3 ? h3-- : h3++, o3.__u |= 4))) : n3.__k[r3] = null;
  if (a3) for (r3 = 0; r3 < s3; r3++) null != (e3 = u3[r3]) && 0 == (2 & e3.__u) && (e3.__e == t5 && (t5 = $(e3)), K(e3, e3));
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
  var i3, r3, o3, e3 = n3.key, f3 = n3.type, c3 = l3[u3], s3 = null != c3 && 0 == (2 & c3.__u);
  if (null === c3 && null == e3 || s3 && e3 == c3.key && f3 == c3.type) return u3;
  if (t5 > (s3 ? 1 : 0)) {
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
  else if ("o" == l3[0] && "n" == l3[1]) r3 = l3 != (l3 = l3.replace(a, "$1")), o3 = l3.toLowerCase(), l3 = o3 in n3 || "onFocusOut" == l3 || "onFocusIn" == l3 ? o3.slice(2) : l3.slice(2), n3.l || (n3.l = {}), n3.l[l3 + r3] = u3, u3 ? t5 ? u3[s] = t5[s] : (u3[s] = h, n3.addEventListener(l3, r3 ? v : p, r3)) : n3.removeEventListener(l3, r3 ? v : p, r3);
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
      else if (u3[c] < t5[s]) return;
      return t5(l.event ? l.event(u3) : u3);
    }
  };
}
function q(n3, u3, t5, i3, r3, o3, e3, f3, c3, s3) {
  var a3, h3, p3, v3, y3, d3, _4, k3, x3, M4, $2, I2, P4, A4, H3, T4 = u3.type;
  if (void 0 !== u3.constructor) return null;
  128 & t5.__u && (c3 = !!(32 & t5.__u), o3 = [f3 = u3.__e = t5.__e]), (a3 = l.__b) && a3(u3);
  n: if ("function" == typeof T4) try {
    if (k3 = u3.props, x3 = T4.prototype && T4.prototype.render, M4 = (a3 = T4.contextType) && i3[a3.__c], $2 = a3 ? M4 ? M4.props.value : a3.__ : i3, t5.__c ? _4 = (h3 = u3.__c = t5.__c).__ = h3.__E : (x3 ? u3.__c = h3 = new T4(k3, $2) : (u3.__c = h3 = new C(k3, $2), h3.constructor = T4, h3.render = Q), M4 && M4.sub(h3), h3.state || (h3.state = {}), h3.__n = i3, p3 = h3.__d = true, h3.__h = [], h3._sb = []), x3 && null == h3.__s && (h3.__s = h3.state), x3 && null != T4.getDerivedStateFromProps && (h3.__s == h3.state && (h3.__s = m({}, h3.__s)), m(h3.__s, T4.getDerivedStateFromProps(k3, h3.__s))), v3 = h3.props, y3 = h3.state, h3.__v = u3, p3) x3 && null == T4.getDerivedStateFromProps && null != h3.componentWillMount && h3.componentWillMount(), x3 && null != h3.componentDidMount && h3.__h.push(h3.componentDidMount);
    else {
      if (x3 && null == T4.getDerivedStateFromProps && k3 !== v3 && null != h3.componentWillReceiveProps && h3.componentWillReceiveProps(k3, $2), u3.__v == t5.__v || !h3.__e && null != h3.shouldComponentUpdate && false === h3.shouldComponentUpdate(k3, h3.__s, $2)) {
        u3.__v != t5.__v && (h3.props = k3, h3.state = h3.__s, h3.__d = false), u3.__e = t5.__e, u3.__k = t5.__k, u3.__k.some(function(n4) {
          n4 && (n4.__ = u3);
        }), w.push.apply(h3.__h, h3._sb), h3._sb = [], h3.__h.length && e3.push(h3);
        break n;
      }
      null != h3.componentWillUpdate && h3.componentWillUpdate(k3, h3.__s, $2), x3 && null != h3.componentDidUpdate && h3.__h.push(function() {
        h3.componentDidUpdate(v3, y3, d3);
      });
    }
    if (h3.context = $2, h3.props = k3, h3.__P = n3, h3.__e = false, I2 = l.__r, P4 = 0, x3) h3.state = h3.__s, h3.__d = false, I2 && I2(u3), a3 = h3.render(h3.props, h3.state, h3.context), w.push.apply(h3.__h, h3._sb), h3._sb = [];
    else do {
      h3.__d = false, I2 && I2(u3), a3 = h3.render(h3.props, h3.state, h3.context), h3.state = h3.__s;
    } while (h3.__d && ++P4 < 25);
    h3.state = h3.__s, null != h3.getChildContext && (i3 = m(m({}, i3), h3.getChildContext())), x3 && !p3 && null != h3.getSnapshotBeforeUpdate && (d3 = h3.getSnapshotBeforeUpdate(v3, y3)), A4 = null != a3 && a3.type === S && null == a3.key ? E(a3.props.children) : a3, f3 = L(n3, g(A4) ? A4 : [A4], u3, t5, i3, r3, o3, e3, f3, c3, s3), h3.base = u3.__e, u3.__u &= -161, h3.__h.length && e3.push(h3), _4 && (h3.__E = h3.__ = null);
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
  else null == o3 && u3.__v == t5.__v ? (u3.__k = t5.__k, u3.__e = t5.__e) : f3 = u3.__e = G(t5.__e, u3, t5, i3, r3, o3, e3, c3, s3);
  return (a3 = l.diffed) && a3(u3), 128 & u3.__u ? void 0 : f3;
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
  return "object" != typeof n3 || null == n3 || n3.__b > 0 ? n3 : g(n3) ? n3.map(E) : m({}, n3);
}
function G(u3, t5, i3, r3, o3, e3, f3, c3, s3) {
  var a3, h3, p3, v3, y3, w3, _4, m3 = i3.props || d, k3 = t5.props, x3 = t5.type;
  if ("svg" == x3 ? o3 = "http://www.w3.org/2000/svg" : "math" == x3 ? o3 = "http://www.w3.org/1998/Math/MathML" : o3 || (o3 = "http://www.w3.org/1999/xhtml"), null != e3) {
    for (a3 = 0; a3 < e3.length; a3++) if ((y3 = e3[a3]) && "setAttribute" in y3 == !!x3 && (x3 ? y3.localName == x3 : 3 == y3.nodeType)) {
      u3 = y3, e3[a3] = null;
      break;
    }
  }
  if (null == u3) {
    if (null == x3) return document.createTextNode(k3);
    u3 = document.createElementNS(o3, x3, k3.is && k3), c3 && (l.__m && l.__m(t5, e3), c3 = false), e3 = null;
  }
  if (null == x3) m3 === k3 || c3 && u3.data == k3 || (u3.data = k3);
  else {
    if (e3 = e3 && n2.call(u3.childNodes), !c3 && null != e3) for (m3 = {}, a3 = 0; a3 < u3.attributes.length; a3++) m3[(y3 = u3.attributes[a3]).name] = y3.value;
    for (a3 in m3) y3 = m3[a3], "dangerouslySetInnerHTML" == a3 ? p3 = y3 : "children" == a3 || a3 in k3 || "value" == a3 && "defaultValue" in k3 || "checked" == a3 && "defaultChecked" in k3 || N(u3, a3, null, y3, o3);
    for (a3 in k3) y3 = k3[a3], "children" == a3 ? v3 = y3 : "dangerouslySetInnerHTML" == a3 ? h3 = y3 : "value" == a3 ? w3 = y3 : "checked" == a3 ? _4 = y3 : c3 && "function" != typeof y3 || m3[a3] === y3 || N(u3, a3, y3, m3[a3], o3);
    if (h3) c3 || p3 && (h3.__html == p3.__html || h3.__html == u3.innerHTML) || (u3.innerHTML = h3.__html), t5.__k = [];
    else if (p3 && (u3.innerHTML = ""), L("template" == t5.type ? u3.content : u3, g(v3) ? v3 : [v3], t5, i3, r3, "foreignObject" == x3 ? "http://www.w3.org/1999/xhtml" : o3, e3, f3, e3 ? e3[0] : i3.__k && $(i3, 0), c3, s3), null != e3) for (a3 = e3.length; a3--; ) b(e3[a3]);
    c3 || (a3 = "value", "progress" == x3 && null == w3 ? u3.removeAttribute("value") : null != w3 && (w3 !== u3[a3] || "progress" == x3 && !w3 || "option" == x3 && w3 != m3[a3]) && N(u3, a3, w3, m3[a3], o3), a3 = "checked", null != _4 && _4 != u3[a3] && N(u3, a3, _4, m3[a3], o3));
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
}, H.__r = 0, f = Math.random().toString(8), c = "__d" + f, s = "__a" + f, a = /(PointerCapture)$|Capture$/i, h = 0, p = V(false), v = V(true), y = 0;

// node_modules/preact/hooks/dist/hooks.module.js
var t3;
var r2;
var u2;
var i2;
var o2 = 0;
var f2 = [];
var c2 = l;
var e2 = c2.__b;
var a2 = c2.__r;
var v2 = c2.diffed;
var l2 = c2.__c;
var m2 = c2.unmount;
var s2 = c2.__;
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
function A2(n3) {
  return o2 = 5, T2(function() {
    return { current: n3 };
  }, []);
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
  const res = await fetch(url, {
    method,
    headers,
    body: opts.body !== void 0 ? JSON.stringify(opts.body) : void 0
  });
  const text = await res.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { error: text };
  }
  if (!res.ok) {
    const errMsg = parsed?.error ?? `${res.status} ${res.statusText}`;
    const err = new Error(errMsg);
    err.status = res.status;
    err.body = parsed;
    throw err;
  }
  return parsed;
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
  const hay = `${filename ?? ""}
${error?.stack ?? ""}`;
  return THIRD_PARTY_ORIGIN_PREFIXES.some((prefix) => hay.includes(prefix));
}

// dashboard/src/lib/bus.ts
var html = htm_module_default.bind(k);
var appBus = new EventTarget();
var toastBus = new EventTarget();
function showToast(text, kind = "info", ttl = 3e3) {
  toastBus.dispatchEvent(new CustomEvent("toast", { detail: { text, kind, ttl } }));
}
function reportAppError(error, source, info) {
  console.error(`[visionox dashboard] ${source}:`, error, info);
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
      setTimeout(() => setToasts((prev) => prev.filter((x3) => x3.id !== id)), t5.ttl);
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
var REPO_URL = "https://github.com/esengine/reasonix";
function buildIssueBody({ error, source, info }) {
  const ua = typeof navigator === "object" ? navigator.userAgent : "(unknown)";
  const errMsg = error?.message ?? String(error);
  const stack = error?.stack ?? "(no stack)";
  return [
    "**What happened**",
    "(describe what you were doing \u2014 typing, switching tabs, clicking a tool path, etc.)",
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
    `- Visionox: ${MODE}`,
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
  const issueUrl = `${REPO_URL}/issues/new?title=${encodeURIComponent(`[dashboard] ${errMsg.slice(0, 80)}`)}&body=${encodeURIComponent(buildIssueBody(err))}`;
  const copyDetails = async () => {
    try {
      await navigator.clipboard.writeText(buildIssueBody(err));
      setCopied(true);
      setTimeout(() => setCopied(false), 2e3);
    } catch {
    }
  };
  return html2`
    <div class="error-overlay">
      <div class="error-overlay-card">
        <div class="error-overlay-head">
          <span class="error-overlay-icon">✦</span>
          <div>
            <div class="error-overlay-title">Something broke in the dashboard</div>
            <div class="error-overlay-subtitle">${err.source} error · ${errMsg}</div>
          </div>
        </div>

        <pre class="error-overlay-trace">${stack}</pre>

        ${err.info ? html2`<div class="error-overlay-info"><strong>info:</strong> ${err.info}</div>` : null}

        <div class="error-overlay-help">
          The TUI is unaffected — only this browser tab tripped. You can
          dismiss and keep working, or report it so we can fix the
          underlying cause.
        </div>

        <div class="error-overlay-actions">
          <button class="primary" onClick=${copyDetails}>
            ${copied ? "Copied \u2713" : "Copy details"}
          </button>
          <a class="button" href=${issueUrl} target="_blank" rel="noopener noreferrer">
            Report on GitHub
          </a>
          <button onClick=${() => setErr(null)} style="margin-left: auto;">Dismiss (Esc)</button>
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
            <div>this panel keeps crashing — the error overlay has the trace.</div>
            <button onClick=${() => this.setState({ caught: false, attempts: 0 })}>
              Try again
            </button>
          </div>
        `;
      }
      return html2`<div class="boot">recovering…</div>`;
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
var FROM_BACKEND = new Map(LANG_REGISTRY.map(([d3, b2]) => [b2, d3]));
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
  }).catch((err) => console.error("[visionox dashboard] lang persist:", err));
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
    if (val === void 0 || typeof val === "string") return void 0;
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
    for (const [k3, v3] of Object.entries(params)) {
      result = result.replaceAll(`{${k3}}`, String(v3));
    }
    return result;
  };
}

// dashboard/src/i18n/en.ts
var en = {
  app: {
    sectionWorkspace: "workspace",
    sectionObserve: "observe",
    sectionConfigure: "configure",
    tabChat: "Chat",
    tabPlans: "Plans",
    tabSessions: "Sessions",
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
    tabSettings: "Settings",
    sectionChanges: "Changes",
    tabChanges: "Changes",
    footer: "127.0.0.1 only \xB7 token-gated"
  },
  changes: {
    chatPlaceholder: "Ask about your code...",
    chatWelcome: "Changes \u2014 ask questions about your project files.",
    chatSend: "Send",
    viewerPlaceholder: "Select a file to view",
    treeEmpty: "(empty)",
    tabClose: "Close tab",
    newConversation: "New",
    clearConversation: "Clear",
    newTitle: "/new \u2014 wipe conversation context",
    clearTitle: "/clear \u2014 wipe visible scrollback",
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
    loadingFiles: "Loading project files\u2026",
    review: "Review",
    allFiles: "All Files",
    changes: "changes",
    commentLabel: "Commenting on line",
    commentPlaceholder: "Add a comment\u2026",
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
    createPlaceholder: "name for snapshot\u2026",
    backToList: "back to list",
    diffStyleUnified: "Unified",
    diffStyleSplit: "Split",
    expandAll: "Expand all",
    collapseAll: "Collapse all"
  },
  common: {
    loading: "loading\u2026",
    loadingFailed: "{name} failed: {error}",
    back: "\u2190 back",
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
  settings: {
    title: "Settings",
    loading: "loading settings\u2026",
    saved: "saved: {fields}",
    sectionApi: "DeepSeek API",
    apiKey: "API key",
    notSet: "(not set)",
    replace: "replace",
    pasteKey: "paste a fresh sk-\u2026 token",
    saveKey: "Save key",
    baseUrl: "base url",
    baseUrlPlaceholder: "https://api.deepseek.com (default)",
    sectionDefaults: "Defaults",
    preset: "preset",
    presetAuto: "auto \u2014 flash \u2192 pro on hard turns",
    presetFlash: "flash \u2014 always flash, no auto-escalate",
    presetPro: "pro \u2014 always pro",
    appliesNextTurn: "applies next turn",
    effort: "effort",
    effortMax: "max (default \u2014 best)",
    effortHigh: "high (cheaper / faster)",
    webSearch: "web search",
    webSearchNote: "web_fetch + web_search tools",
    sectionCompute: "Compute",
    proNext: "/pro one-shot",
    proArm: "Arm for next turn",
    proArmed: "Armed \u2014 disarms after next turn",
    proNextNote: "next turn runs on deepseek-v4-pro, then auto-disarms",
    sectionBudget: "Budget",
    budgetOf: "of",
    budgetSetCap: "set a cap",
    budgetCustom: "custom",
    budgetBumpHint: "bump the cap to keep going",
    budgetClear: "Clear cap",
    budgetIdleLine: "warns at 80% \xB7 refuses past 100%",
    budgetWarnLine: "approaching cap \u2014 loop will refuse past 100%",
    budgetRefusing: "cap exhausted \u2014 next turn refused until bumped or cleared",
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
    modelPricingLine: "${hit} hit \xB7 ${miss} miss \xB7 ${out} out  per 1M tok",
    editMode: "edit mode",
    editModeNote: "switch from the Chat tab header",
    sectionLanguage: "Language",
    language: "language",
    langEn: "English",
    langZhCn: "\u7B80\u4F53\u4E2D\u6587",
    sectionDev: "Developer",
    devMode: "Developer Mode",
    devModeNote: "Show background server startup and runtime logs"
  },
  chat: {
    modeMirror: "TUI mirror",
    modeView: "session view",
    placeholder: "Type a prompt \u2014 Enter sends, Shift+Enter for a newline \xB7 / @ for pickers",
    placeholderBusy: "wait for the current turn to finish\u2026",
    send: "Send",
    new: "New",
    clear: "Clear",
    newTitle: "/new \u2014 wipe conversation context (loop log + scrollback)",
    clearTitle: "/clear \u2014 wipe just visible scrollback (context kept)",
    noConversation: "No conversation yet. Send a prompt below to begin.",
    newConfirmBusy: "A turn is in flight. Abort and start a new conversation?",
    newConfirm: "Clear current conversation and start fresh?",
    newToast: "new conversation",
    clearToast: "scrollback cleared",
    newFailed: "/new failed: {error}",
    clearFailed: "/clear failed: {error}",
    eventStreamError: "event stream interrupted \u2014 reconnecting\u2026",
    semanticBanner: "Semantic search isn't enabled for this project.",
    semanticBannerDesc: 'Build the index once and the model can find code by meaning ("where do we handle auth failures?") instead of grep on exact strings.',
    semanticBannerBtn: "Build it \u2192",
    semanticBannerDismiss: "dismiss (don't show again)",
    slashCommands: "slash commands",
    projectFiles: "project files",
    effortTitle: "reasoning_effort \u2014 applies next turn",
    effortMaxTitle: "max (default \u2014 best quality)",
    effortHighTitle: "high (cheaper / faster)",
    presetTitle: "preset \u2014 model commitment",
    presetAutoTitle: "auto \u2014 flash baseline; auto-escalates to pro on hard turns (NEEDS_PRO / failure threshold)",
    presetFlashTitle: "flash \u2014 always flash; no auto-escalate. /pro still works for one-shot manual",
    presetProTitle: "pro \u2014 always pro; ~3\xD7 flash cost (5/31 discount). Locks in on hard architecture work.",
    editGateTitle: "edit gate \u2014 Shift+Tab cycles in TUI",
    editReviewTitle: "review \u2014 both edits and non-allowlisted shell ask first",
    editAutoTitle: "auto \u2014 edits auto-apply, shell still asks",
    editYoloTitle: "yolo \u2014 edits AND shell auto-run, allowlist bypassed",
    editAdminTitle: "admin \u2014 yolo + unrestricted filesystem access (no sandbox)",
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
    waitingStats: "\xB7 \xB7 \xB7  waiting for live stats",
    inflightPhase: "{phase}",
    inflightRunning: "running",
    inflightThinking: "thinking",
    inflightStreaming: "streaming",
    inflightWaiting: "waiting",
    inflightReasoning: "reasoning {count} ch",
    inflightOut: "out {count} ch",
    abortBtn: "Abort (Esc)",
    confirmBtn: "Apply (y)",
    rejectBtn: "Reject (n)",
    applyRestBtn: "Apply rest (a)",
    flipAutoBtn: "Flip to AUTO (A)"
  },
  overview: {
    loading: "loading overview\u2026",
    failed: "overview failed: {error}",
    standaloneTitle: "Standalone mode",
    standaloneDesc: "Read-only disk view. Start /dashboard from inside visionox code for live session state, MCP, and tools.",
    cockpit: "Cockpit",
    balance: "balance",
    tokens7d: "tokens \xB7 7d",
    cacheHit: "cache hit",
    toolCalls24h: "tool calls \xB7 24h",
    budget: "budget",
    currentSession: "current session",
    noSession: "No live session \u2014 /dashboard from inside visionox code to attach.",
    promptTok: "prompt tok",
    completionTok: "completion tok",
    cost: "cost",
    costTrend: "cost \xB7 14 day",
    noUsageYet: "no usage yet",
    dayAvg: "/day avg",
    recentPlans: "recent plans",
    noPlans: "No plans yet \u2014 submit one with submit_plan.",
    toolActivity: "tool activity",
    noToolCalls: "No tool calls yet.",
    toolsLoaded: "tools loaded",
    mcpServers: "mcp servers",
    editMode: "edit mode",
    version: "Visionox",
    workingDir: "Working directory",
    projectRoot: "project root",
    noPriorData: "no prior data",
    stable: "\u2014 stable",
    vsPrior: "{arrow} {pct}% vs prior",
    active: "active",
    allUp: "all up",
    yoloWarning: "all prompts bypassed",
    checking: "checking",
    latest: "latest"
  },
  usage: {
    loading: "loading usage\u2026",
    failed: "usage failed: {error}",
    records: "{count} records",
    dailyUsage: "Daily usage",
    dailyMeta: "cost \xB7 cache saved \xB7 turns",
    noData: "No usage data yet \u2014 run a turn in visionox chat / code / run and refresh.",
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
    loading: "loading sessions\u2026",
    failed: "sessions failed: {error}",
    noSessions: "No saved sessions yet.",
    filterPlaceholder: "filter sessions",
    msgs: "msgs",
    pickHint: "Pick a session on the left to read its transcript.",
    resumeTitle: "Resume in TUI",
    resumeDesc: "Mid-session swap requires a restart so the message log can rewind cleanly. Quit your current session, then run:",
    loadingTranscript: "loading transcript\u2026",
    emptyTranscript: "empty transcript.",
    messages: "{count} message{s}"
  },
  tools: {
    loading: "loading tools\u2026",
    failed: "tools failed: {error}",
    noTools: "No tools registered.",
    planMode: "plan mode \u2014 writes gated",
    colTool: "tool",
    colFlags: "flags",
    colDesc: "description",
    readOnly: "read-only",
    write: "write",
    flat: "flat",
    desc: {
      web_search: "Search the public web. Returns ranked results with title, url, and snippet. Call this when the answer depends on current state \u2014 events, prices, releases, real-world status.",
      web_fetch: "Download a URL and return its visible text content (scripts/styles/nav stripped). Use after web_search when a snippet isn't enough.",
      run_command: "Run a shell command in the project root; returns combined stdout+stderr. Allowlisted read-only commands run immediately; mutations are gated by user confirmation.",
      run_background: "Spawn a long-running process and detach. Returns a job id for tailing logs, waiting for completion, or killing. Use for dev servers, watchers, and one-shot long jobs.",
      job_output: "Read the latest output of a background job. Returns the tail of the buffer and tells you whether the job is still running.",
      wait_for_job: "Block server-side until a background job finishes, bounded by timeout. Use instead of polling job_output in a loop.",
      stop_job: "Stop a background job. SIGTERM first, SIGKILL after a grace period. Safe to call on an already-exited job.",
      list_jobs: "List every background job started this session \u2014 running and exited \u2014 with id, command, pid, and status.",
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
      delete_file: "Delete one file under the sandbox root. Refuses directories \u2014 use delete_directory for those.",
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
    loading: "loading permissions\u2026",
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
    projectAllowlist: "Project allowlist \xB7 {count}",
    nothingStored: "Nothing stored yet for this project.",
    colNum: "#",
    colPrefix: "prefix",
    builtinTitle: "Builtin \xB7 {count} \xB7 read-only",
    standaloneWarning: "Mutations require /dashboard from inside an active visionox code session \u2014 standalone visionox dashboard can't tell which project's allowlist to edit."
  },
  mcp: {
    loading: "loading MCP\u2026",
    servers: "MCP servers \xB7 {count} bridged",
    all: "all",
    live: "live",
    unbridged: "unbridged",
    specPlaceholder: "spec \u2014 e.g. fs=npx -y @modelcontextprotocol/...",
    saved: "saved",
    savedRestart: "saved \u2014 restart visionox code to bridge this server",
    removed: "removed \u2014 restart to drop the live bridge",
    removeConfirm: "Remove MCP spec from config?\n\n{spec}",
    noServers: "No MCP servers in this session.",
    tools: "tools",
    inConfig: "in config \xB7 not loaded",
    unbridgedTitle: "unbridged \xB7 in config",
    removeBtn: "Remove",
    spec: "spec",
    whyUnbridged: "Why unbridged?",
    whyUnbridgedDesc: "This spec lives in your config.json but isn't bridged into the live session. MCP servers attach when visionox code starts; the dashboard alone can't spawn the child process.",
    whyUnbridgedHint: "To activate: restart visionox code, then refresh this dashboard.",
    pickHint: "Pick an MCP server on the left to inspect tools / resources / prompts.",
    toolsTitle: "Tools \xB7 {count}",
    resourcesTitle: "Resources \xB7 {count}",
    promptsTitle: "Prompts \xB7 {count}",
    colName: "name",
    colDesc: "description",
    colUri: "uri",
    marketplace: "marketplace",
    marketplaceSearch: "search the registry\u2026",
    marketplaceLoading: "loading registry\u2026",
    marketplaceMore: "load 5 more pages",
    marketplaceMoreLabel: "load 50 more  \xB7  showing {shown} / {total}",
    marketplaceMoreHint: "fetches more pages from the registry",
    marketplaceMoreCachedHint: "more entries already cached locally",
    marketplaceExhausted: "all pages loaded",
    marketplaceExhaustedFull: "showing all {total} entries \u2014 registry exhausted",
    marketplaceCount: "{loaded} loaded \xB7 {matched} match \xB7 source: {source}{cached}",
    marketplaceCachedSuffix: " \xB7 cached",
    marketplaceNoMatches: "No matches. Try different terms or load more pages.",
    marketplaceInstall: "Install",
    marketplacePickHint: "Pick a server on the left, then Install.",
    marketplaceInstalled: "installed \u2192 {spec}",
    marketplaceInstalledBridged: "installed + bridged \u2192 {spec}",
    marketplaceAlready: "already installed",
    marketplaceNeedsEnv: "needs env: {names}",
    marketplaceSourceTag: "[{source}]",
    marketplaceNoInstall: "smithery listing \u2014 install metadata not exposed; use `npx -y @smithery/cli install {name}` directly",
    marketplaceFetchOnInstall: "Smithery listing \u2014 install detail fetched on Install. http servers map to streamable-http remotes; stdio servers run via @smithery/cli.",
    marketplaceInstalledBadge: "installed",
    marketplaceUninstall: "Uninstall",
    marketplaceEnvTitle: "Required environment variables",
    marketplaceEnvHint: "Set these in your shell before next `visionox code` so the bridged server can authenticate.",
    marketplaceRestartHint: "Spec written to ~/.visionox/config.json. Restart `visionox code` to bridge the server (live hot-reload is on the roadmap)."
  },
  memory: {
    loading: "loading memory\u2026",
    files: "memory \xB7 {count} files",
    exists: "exists",
    create: "create",
    noFiles: "No memory files yet.",
    pickHint: "Pick a memory file on the left.",
    pickDesc: "Project visionox.md is committable; global notes live in ~/.visionox/memory/.",
    chars: "{count} chars",
    saved: "saved {scope}",
    reloadHint: "re-applied on next /new or session restart"
  },
  hooks: {
    loading: "loading hooks\u2026",
    resolved: "resolved",
    eventMatrix: "Event matrix",
    matrixSub: "{scripts} script{s} \xD7 {events} event{s}",
    noHooks: "No hooks configured. Edit the JSON below to add some.",
    colScript: "script",
    noProject: "No active project \u2014 open /dashboard from visionox code to edit project hooks.",
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
    loading: "loading skills\u2026",
    filterPlaceholder: "filter skills",
    project: "project",
    global: "global",
    builtin: "builtin",
    newSkill: "new skill",
    noDescription: "(no description)",
    runs7d: "runs \xB7 7d",
    pickHint: "Pick a skill on the left, or create a new one above.",
    readOnlyBuiltin: "read-only \xB7 builtin",
    builtinDesc: "Built-in skills ship with Visionox; the model picks them up automatically. To customize, create a project- or global-scoped skill with the same name.",
    saved: "saved {scope}/{name}",
    deleteConfirm: "Delete skill {scope}/{name}?",
    reloadHint: "re-loaded on next /new or session restart"
  },
  system: {
    loading: "loading health\u2026",
    failed: "health failed: {error}",
    healthChecks: "Health checks",
    version: "version",
    checking: "checking",
    latest: "\u25CF latest",
    outOfDate: "\u25CF out of date",
    versionPending: "version check pending",
    upToDate: "up to date",
    latestVer: "latest: {version}",
    sessions: "sessions",
    ok: "\u25CF ok",
    memory: "memory",
    semanticIndex: "semantic index",
    built: "\u25CF built",
    none: "\u2014 none",
    runIndex: "run visionox index to build",
    usageLog: "usage log",
    backgroundJobs: "background jobs",
    noSession: "\u2014 no session",
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
    loading: "loading plans\u2026",
    failed: "plans failed: {error}",
    noPlans: "No archived plans yet \u2014 run a turn that calls submit_plan and mark_step_complete.",
    filterPlaceholder: "filter plans",
    active: "active",
    done: "done",
    idle: "idle",
    steps: "steps",
    pickHint: "Pick a plan on the left.",
    noTitle: "(no title)",
    stepTimeline: "Step timeline \xB7 {done} / {total}",
    step: "step {n}"
  },
  semantic: {
    codeRequired: "Semantic \u2014 code-mode required",
    indexBuilt: "index built",
    noIndex: "no index yet",
    ready: "ready",
    setupNeeded: "setup needed",
    installOllama: "Install Ollama",
    installOllamaDesc: "Visionox doesn't run package managers for you. Install Ollama first, then come back:",
    macWindows: "macOS / Windows:",
    download: "download from ollama.com/download",
    linux: "Linux:",
    refreshHint: "Refresh after install \u2014 this panel will offer to start the daemon and pull {model}.",
    daemon: "Daemon",
    daemonDesc: "ollama is on your PATH but the HTTP daemon isn't reachable.",
    startDaemon: "Start daemon",
    runsOllama: "runs ollama serve detached",
    model: "Model",
    modelMissing: "{model} isn't installed yet.",
    modelSize: "~270 MB on first pull.",
    pulling: "pulling\u2026",
    pullModel: "Pull {model}",
    indexStatus: "index status",
    builtStatus: "\u25CF built",
    incompatibleStatus: "\u25CF incompatible",
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
    apiKeyStoredNote: "API key is stored in ~/.visionox/config.json \u2014 do not share that file.",
    customRequestBody: "custom request body",
    invalidCustomRequestBody: "Custom request body must be valid JSON: {error}",
    customRequestBodyMustBeObject: "Custom request body must be a JSON object.",
    saveBeforeIndex: "Save semantic settings before starting an index.",
    extraBody: "extra body",
    keepExistingKey: "leave blank to keep existing key",
    remoteProvider: "Remote embedding provider",
    remoteProviderDesc: "Configure the full OpenAI-compatible embeddings URL here. Visionox will send requests exactly to the URL you provide.",
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
    maxFileBytes: "max file bytes",
    skipLarger: "skip files larger than ~{size} MiB",
    preview: "Preview",
    searchPlaceholder: "describe what to find \u2014 'where do we handle abort signals'",
    searching: "searching\u2026",
    results: "{count} result{s} \xB7 {ms}ms \xB7 {model}",
    noMatches: "No matches above the score threshold.",
    previewSummary: "Preview \u2014 would index {included} file(s), skip {skipped}",
    nothingSkipped: "nothing skipped \u2014 all walked files would be indexed.",
    firstIncluded: "first {count} included file(s)",
    job: "Job",
    phaseSetup: "preparing",
    phaseScan: "scanning files",
    phaseEmbed: "embedding chunks",
    phaseWrite: "writing index",
    phaseDone: "done",
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
    stopRequested: "stopping requested \u2014 current chunk batch will finish first",
    startingDaemon: "starting ollama daemon (15s timeout)\u2026",
    daemonUp: "daemon is up",
    daemonTimeout: "daemon didn't come up in time \u2014 check ollama serve manually",
    pullingModel: "pulling {model} \u2014 this may take a few minutes on first install",
    savedConfig: "saved \xB7 {count} fields updated \xB7 re-run index to apply",
    runningPreview: "running dry walk against project root\u2026",
    exclude: "exclude"
  },
  modal: {
    shellTitle: "shell command",
    shellBgTitle: "background process",
    shellSubtitle: "model wants to run a shell command",
    shellBgSubtitle: "long-running \u2014 keeps running after approval",
    runOnce: "Run once",
    alwaysAllow: 'Always allow "{prefix}"',
    deny: "Deny",
    choiceTitle: "model wants you to pick",
    typeOwn: "Type my own answer",
    typeOwnSummary: "None of the above fits \u2014 write a free-form reply.",
    typePlaceholder: "Type a free-form answer\u2026",
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
    editSubtitle: "{path} \xB7 {remaining} of {total} blocks remaining",
    before: "before",
    after: "after",
    workspaceTitle: "model wants to switch workspace",
    workspaceSubtitle: "every subsequent file / shell / memory tool resolves against the new root",
    switchBtn: "Switch (Enter)",
    denyBtn: "Deny (Esc)",
    stepComplete: "step complete{counter}",
    continueBtn: "Continue",
    reviseBtn: "Revise\u2026",
    stopBtn: "Stop",
    revisionTitle: "model proposed a plan revision",
    sendRevision: "Send revision",
    accept: "Accept",
    reject: "Reject",
    arguments: "arguments",
    revisePlaceholder: "What needs to change before the next step? Leave blank to just continue.",
    pickerFilter: "Filter\u2026",
    pickerEmpty: "Nothing to show.",
    pickerLoadMore: "Load more",
    pickerPick: "Open",
    pickerInstall: "Install",
    pickerUninstall: "Uninstall",
    pickerRename: "Rename\u2026",
    pickerNew: "New\u2026",
    pickerNewPlaceholder: "Name (leave blank for default)",
    viewerClose: "Close"
  }
};

// dashboard/src/i18n/zh-CN.ts
var zhCN = {
  app: {
    sectionWorkspace: "\u5DE5\u4F5C\u533A",
    sectionObserve: "\u76D1\u63A7",
    sectionConfigure: "\u914D\u7F6E",
    tabChat: "\u5BF9\u8BDD",
    tabPlans: "\u8BA1\u5212",
    tabSessions: "\u4F1A\u8BDD",
    tabOverview: "\u6982\u89C8",
    tabUsage: "\u7528\u91CF",
    tabSystem: "\u7CFB\u7EDF",
    tabSemantic: "\u8BED\u4E49",
    tabTools: "\u5DE5\u5177",
    tabPermissions: "\u6743\u9650",
    tabMcp: "MCP",
    tabSkills: "\u6280\u80FD",
    tabMemory: "\u8BB0\u5FC6",
    tabHooks: "\u94A9\u5B50",
    tabSettings: "\u8BBE\u7F6E",
    sectionChanges: "\u53D8\u66F4",
    tabChanges: "\u53D8\u66F4",
    footer: "\u4EC5 127.0.0.1 \xB7 Token \u4FDD\u62A4"
  },
  changes: {
    chatPlaceholder: "\u8BE2\u95EE\u4EE3\u7801\u95EE\u9898\u2026",
    chatWelcome: "\u53D8\u66F4 \u2014 \u8BE2\u95EE\u9879\u76EE\u6587\u4EF6\u76F8\u5173\u95EE\u9898\u3002",
    chatSend: "\u53D1\u9001",
    viewerPlaceholder: "\u9009\u62E9\u4E00\u4E2A\u6587\u4EF6\u67E5\u770B",
    treeEmpty: "\uFF08\u7A7A\uFF09",
    tabClose: "\u5173\u95ED\u6807\u7B7E",
    newConversation: "\u65B0\u5EFA",
    clearConversation: "\u6E05\u9664",
    newTitle: "/new \u2014 \u6E05\u9664\u5BF9\u8BDD\u4E0A\u4E0B\u6587",
    clearTitle: "/clear \u2014 \u4EC5\u6E05\u9664\u53EF\u89C1\u7684\u6EDA\u52A8\u56DE\u653E",
    newConfirmBusy: "\u6709\u8F6E\u6B21\u6B63\u5728\u6267\u884C\u3002\u4E2D\u6B62\u5E76\u5F00\u59CB\u65B0\u5BF9\u8BDD\uFF1F",
    newConfirm: "\u6E05\u9664\u5F53\u524D\u5BF9\u8BDD\u5E76\u91CD\u65B0\u5F00\u59CB\uFF1F",
    newToast: "\u65B0\u5BF9\u8BDD",
    clearToast: "\u6EDA\u52A8\u56DE\u653E\u5DF2\u6E05\u9664",
    newFailed: "/new \u5931\u8D25\uFF1A{error}",
    clearFailed: "/clear \u5931\u8D25\uFF1A{error}",
    chatSendBtn: "\u53D1\u9001",
    fileTreeTitle: "\u6587\u4EF6",
    codeViewerTitle: "\u4EE3\u7801\u67E5\u770B\u5668",
    chatPanelTitle: "\u5BF9\u8BDD",
    loadingFiles: "\u6B63\u5728\u52A0\u8F7D\u9879\u76EE\u6587\u4EF6\u2026",
    review: "\u5BA1\u67E5",
    allFiles: "\u6240\u6709\u6587\u4EF6",
    changes: "\u66F4\u6539",
    commentLabel: "\u6B63\u5728\u8BC4\u8BBA \u7B2C",
    commentPlaceholder: "\u6DFB\u52A0\u8BC4\u8BBA\u2026",
    commentCancel: "\u53D6\u6D88",
    commentSubmit: "\u8BC4\u8BBA",
    commentLine: "\u7B2C",
    commentEdit: "\u7F16\u8F91",
    commentDelete: "\u5220\u9664",
    reviewEmpty: "\u6682\u65E0\u53EF\u5BA1\u67E5\u7684\u66F4\u6539",
    diffSourceGit: "Git \u53D8\u66F4",
    diffSourceSession: "\u4E0A\u4E00\u8F6E\u53D8\u66F4",
    diffStyleUnified: "\u7EDF\u4E00\u89C6\u56FE",
    diffStyleSplit: "\u5206\u680F\u89C6\u56FE",
    expandAll: "\u5168\u90E8\u5C55\u5F00",
    collapseAll: "\u5168\u90E8\u6298\u53E0"
  },
  common: {
    loading: "\u52A0\u8F7D\u4E2D\u2026",
    loadingFailed: "{name}\u5931\u8D25\uFF1A{error}",
    back: "\u2190 \u8FD4\u56DE",
    save: "\u4FDD\u5B58",
    remove: "\u79FB\u9664",
    cancel: "\u53D6\u6D88",
    delete: "\u5220\u9664",
    add: "\u6DFB\u52A0",
    confirm: "\u786E\u8BA4",
    noData: "\u6682\u65E0{name}\u3002",
    all: "\u5168\u90E8",
    yes: "\u662F",
    no: "\u5426",
    on: "\u5F00\u542F",
    off: "\u5173\u95ED",
    enabled: "\u5DF2\u542F\u7528",
    disabled: "\u5DF2\u7981\u7528"
  },
  settings: {
    title: "\u8BBE\u7F6E",
    loading: "\u52A0\u8F7D\u8BBE\u7F6E\u2026",
    saved: "\u5DF2\u4FDD\u5B58\uFF1A{fields}",
    sectionApi: "DeepSeek API",
    apiKey: "API \u5BC6\u94A5",
    notSet: "\uFF08\u672A\u8BBE\u7F6E\uFF09",
    replace: "\u66FF\u6362",
    pasteKey: "\u7C98\u8D34\u65B0\u7684 sk-\u2026 \u4EE4\u724C",
    saveKey: "\u4FDD\u5B58\u5BC6\u94A5",
    baseUrl: "\u57FA\u7840 URL",
    baseUrlPlaceholder: "https://api.deepseek.com\uFF08\u9ED8\u8BA4\uFF09",
    sectionDefaults: "\u9ED8\u8BA4\u8BBE\u7F6E",
    preset: "\u9884\u8BBE",
    presetAuto: "auto \u2014 flash \u57FA\u7EBF\uFF0C\u56F0\u96BE\u65F6\u81EA\u52A8\u5347\u7EA7\u4E3A pro",
    presetFlash: "flash \u2014 \u59CB\u7EC8\u4F7F\u7528 flash\uFF0C\u4E0D\u81EA\u52A8\u5347\u7EA7",
    presetPro: "pro \u2014 \u59CB\u7EC8\u4F7F\u7528 pro",
    appliesNextTurn: "\u4E0B\u4E00\u8F6E\u751F\u6548",
    effort: "\u63A8\u7406\u5F3A\u5EA6",
    effortMax: "max\uFF08\u9ED8\u8BA4 \u2014 \u6700\u4F73\u8D28\u91CF\uFF09",
    effortHigh: "high\uFF08\u66F4\u4FBF\u5B9C / \u66F4\u5FEB\uFF09",
    webSearch: "\u7F51\u9875\u641C\u7D22",
    webSearchNote: "web_fetch + web_search \u5DE5\u5177",
    sectionCompute: "\u8BA1\u7B97",
    proNext: "/pro \u5355\u8F6E",
    proArm: "\u4E3A\u4E0B\u4E00\u8F6E\u88C5\u5907",
    proArmed: "\u5DF2\u88C5\u5907 \u2014 \u4E0B\u4E00\u8F6E\u540E\u81EA\u52A8\u89E3\u9664",
    proNextNote: "\u4E0B\u4E00\u8F6E\u4F7F\u7528 deepseek-v4-pro\uFF0C\u4E4B\u540E\u81EA\u52A8\u89E3\u9664",
    sectionBudget: "\u9884\u7B97",
    budgetOf: "/",
    budgetSetCap: "\u8BBE\u7F6E\u4E0A\u9650",
    budgetCustom: "\u81EA\u5B9A\u4E49",
    budgetBumpHint: "\u63D0\u9AD8\u4E0A\u9650\u4EE5\u7EE7\u7EED",
    budgetClear: "\u6E05\u9664\u4E0A\u9650",
    budgetIdleLine: "80% \u65F6\u63D0\u9192 \xB7 100% \u540E\u62D2\u7EDD\u6267\u884C",
    budgetWarnLine: "\u63A5\u8FD1\u4E0A\u9650 \u2014 \u8D85\u8FC7 100% \u5C06\u62D2\u7EDD\u6267\u884C",
    budgetRefusing: "\u5DF2\u8D85\u51FA\u4E0A\u9650 \u2014 \u63D0\u9AD8\u6216\u6E05\u9664\u540E\u624D\u4F1A\u7EE7\u7EED",
    sectionLoop: "\u5FAA\u73AF",
    loopIdleHint: "\u6309\u56FA\u5B9A\u95F4\u9694\u81EA\u52A8\u91CD\u65B0\u63D0\u4EA4\u4E00\u6BB5\u63D0\u793A\u8BCD\u3002",
    loopCostHint: "\u6BCF\u6B21\u8FED\u4EE3\u7EA6 {cost}\uFF08\u4E0A\u4E00\u8F6E\u6210\u672C\uFF09\u3002",
    loopInterval: "\u95F4\u9694",
    loopCustom: "\u81EA\u5B9A\u4E49",
    loopRangeError: "\u95F4\u9694\u9700\u5728 5s..6h \u4E4B\u95F4",
    loopPrompt: "\u63D0\u793A\u8BCD",
    loopPromptPlaceholder: "\u4F8B\u5982\uFF1A\u68C0\u67E5\u90E8\u7F72\u72B6\u6001\u5E76\u6C47\u62A5\u4EFB\u4F55\u9519\u8BEF",
    loopStart: "\u542F\u52A8\u5FAA\u73AF",
    loopStop: "\u505C\u6B62",
    loopRunning: "\u8FD0\u884C\u4E2D",
    loopIter: "\u7B2C {iter} \u6B21",
    loopFiresIn: "{remaining} \u540E\u89E6\u53D1",
    sectionRuntime: "\u8FD0\u884C\u65F6",
    activeModel: "\u5F53\u524D\u6A21\u578B",
    modelPricingLine: "${hit} \u547D\u4E2D \xB7 ${miss} \u672A\u547D\u4E2D \xB7 ${out} \u8F93\u51FA  / 100 \u4E07 tok",
    editMode: "\u7F16\u8F91\u6A21\u5F0F",
    editModeNote: "\u5728\u5BF9\u8BDD\u6807\u7B7E\u9875\u5934\u90E8\u5207\u6362",
    sectionLanguage: "\u8BED\u8A00",
    language: "\u8BED\u8A00",
    langEn: "English",
    langZhCn: "\u7B80\u4F53\u4E2D\u6587",
    sectionDev: "\u5F00\u53D1\u8005",
    devMode: "\u5F00\u53D1\u8005\u6A21\u5F0F",
    devModeNote: "\u663E\u793A\u540E\u53F0\u670D\u52A1\u5668\u542F\u52A8\u548C\u8FD0\u884C\u65F6\u65E5\u5FD7"
  },
  chat: {
    modeMirror: "TUI \u955C\u50CF",
    modeView: "\u4F1A\u8BDD\u89C6\u56FE",
    placeholder: "\u8F93\u5165\u63D0\u793A\u8BCD \u2014 Enter \u53D1\u9001\uFF0CShift+Enter \u6362\u884C \xB7 / @ \u6253\u5F00\u9009\u62E9\u5668",
    placeholderBusy: "\u8BF7\u7B49\u5F85\u5F53\u524D\u8F6E\u6B21\u5B8C\u6210\u2026",
    send: "\u53D1\u9001",
    new: "\u65B0\u5EFA",
    clear: "\u6E05\u9664",
    newTitle: "/new \u2014 \u6E05\u9664\u5BF9\u8BDD\u4E0A\u4E0B\u6587\uFF08\u5FAA\u73AF\u65E5\u5FD7 + \u6EDA\u52A8\u56DE\u653E\uFF09",
    clearTitle: "/clear \u2014 \u4EC5\u6E05\u9664\u53EF\u89C1\u7684\u6EDA\u52A8\u56DE\u653E\uFF08\u4E0A\u4E0B\u6587\u4FDD\u7559\uFF09",
    noConversation: "\u6682\u65E0\u5BF9\u8BDD\u3002\u5728\u4E0B\u65B9\u53D1\u9001\u63D0\u793A\u8BCD\u5F00\u59CB\u3002",
    newConfirmBusy: "\u6709\u8F6E\u6B21\u6B63\u5728\u6267\u884C\u3002\u4E2D\u6B62\u5E76\u5F00\u59CB\u65B0\u5BF9\u8BDD\uFF1F",
    newConfirm: "\u6E05\u9664\u5F53\u524D\u5BF9\u8BDD\u5E76\u91CD\u65B0\u5F00\u59CB\uFF1F",
    newToast: "\u65B0\u5BF9\u8BDD",
    clearToast: "\u6EDA\u52A8\u56DE\u653E\u5DF2\u6E05\u9664",
    newFailed: "/new \u5931\u8D25\uFF1A{error}",
    clearFailed: "/clear \u5931\u8D25\uFF1A{error}",
    eventStreamError: "\u4E8B\u4EF6\u6D41\u4E2D\u65AD \u2014 \u6B63\u5728\u91CD\u8FDE\u2026",
    semanticBanner: "\u6B64\u9879\u76EE\u672A\u542F\u7528\u8BED\u4E49\u641C\u7D22\u3002",
    semanticBannerDesc: "\u6784\u5EFA\u4E00\u6B21\u7D22\u5F15\uFF0C\u6A21\u578B\u5373\u53EF\u6309\u542B\u4E49\u67E5\u627E\u4EE3\u7801\uFF08\u201C\u54EA\u91CC\u5904\u7406\u8BA4\u8BC1\u5931\u8D25\uFF1F\u201D\uFF09\uFF0C\u800C\u4E0D\u4EC5\u4F9D\u8D56\u7CBE\u786E\u5B57\u7B26\u4E32\u7684 grep\u3002",
    semanticBannerBtn: "\u6784\u5EFA \u2192",
    semanticBannerDismiss: "\u5173\u95ED\uFF08\u4E0D\u518D\u663E\u793A\uFF09",
    slashCommands: "\u659C\u6760\u547D\u4EE4",
    projectFiles: "\u9879\u76EE\u6587\u4EF6",
    effortTitle: "reasoning_effort \u2014 \u4E0B\u4E00\u8F6E\u751F\u6548",
    effortMaxTitle: "max\uFF08\u9ED8\u8BA4 \u2014 \u6700\u4F73\u8D28\u91CF\uFF09",
    effortHighTitle: "high\uFF08\u66F4\u4FBF\u5B9C / \u66F4\u5FEB\uFF09",
    presetTitle: "\u9884\u8BBE \u2014 \u6A21\u578B\u627F\u8BFA",
    presetAutoTitle: "auto \u2014 flash \u57FA\u7EBF\uFF1B\u56F0\u96BE\u8F6E\u6B21\u81EA\u52A8\u5347\u7EA7\u4E3A pro\uFF08NEEDS_PRO / \u5931\u8D25\u9608\u503C\uFF09",
    presetFlashTitle: "flash \u2014 \u59CB\u7EC8 flash\uFF1B\u4E0D\u81EA\u52A8\u5347\u7EA7\u3002/pro \u4ECD\u53EF\u7528\u4E8E\u4E00\u6B21\u6027\u624B\u52A8\u63D0\u5347",
    presetProTitle: "pro \u2014 \u59CB\u7EC8 pro\uFF1B\u7EA6 3 \u500D flash \u6210\u672C\uFF085/31 \u6298\u6263\uFF09\u3002\u9501\u5B9A\u56F0\u96BE\u7684\u67B6\u6784\u5DE5\u4F5C\u3002",
    editGateTitle: "\u7F16\u8F91\u95E8\u63A7 \u2014 Shift+Tab \u5728 TUI \u4E2D\u5FAA\u73AF",
    editReviewTitle: "review \u2014 \u7F16\u8F91\u548C\u975E\u5141\u8BB8\u5217\u8868\u7684 shell \u547D\u4EE4\u90FD\u4F1A\u5148\u8BE2\u95EE",
    editAutoTitle: "auto \u2014 \u7F16\u8F91\u81EA\u52A8\u5E94\u7528\uFF0Cshell \u4ECD\u4F1A\u8BE2\u95EE",
    editYoloTitle: "yolo \u2014 \u7F16\u8F91\u548C shell \u90FD\u81EA\u52A8\u8FD0\u884C\uFF0C\u7ED5\u8FC7\u5141\u8BB8\u5217\u8868",
    editAdminTitle: "admin \u2014 yolo + \u65E0\u9650\u5236\u6587\u4EF6\u7CFB\u7EDF\u8BBF\u95EE\uFF08\u65E0\u6C99\u7BB1\uFF09",
    railSession: "\u4F1A\u8BDD",
    railTurns: "\u8F6E\u6B21",
    railPromptTok: "\u63D0\u793A tokens",
    railCost: "\u8D39\u7528",
    railCacheHit: "\u7F13\u5B58\u547D\u4E2D",
    railToolBudget: "\u5DE5\u5177\u9884\u7B97",
    railSpend: "\u5DF2\u7528",
    railActivePlan: "\u6D3B\u8DC3\u8BA1\u5212",
    railProgress: "\u8FDB\u5EA6",
    statusModel: "\u6A21\u578B",
    statusCtx: "\u4E0A\u4E0B\u6587",
    statusCache: "\u7F13\u5B58",
    statusTurn: "\u8F6E\u6B21",
    statusSession: "\u4F1A\u8BDD",
    statusBalance: "\u4F59\u989D",
    statusTurns: "{count} \u8F6E",
    waitingStats: "\xB7 \xB7 \xB7  \u7B49\u5F85\u5B9E\u65F6\u7EDF\u8BA1",
    inflightPhase: "{phase}",
    inflightRunning: "\u8FD0\u884C\u4E2D",
    inflightThinking: "\u601D\u8003\u4E2D",
    inflightStreaming: "\u8F93\u51FA\u4E2D",
    inflightWaiting: "\u7B49\u5F85\u4E2D",
    inflightReasoning: "\u63A8\u7406 {count} \u5B57\u7B26",
    inflightOut: "\u8F93\u51FA {count} \u5B57\u7B26",
    abortBtn: "\u4E2D\u6B62 (Esc)",
    confirmBtn: "\u5E94\u7528 (y)",
    rejectBtn: "\u62D2\u7EDD (n)",
    applyRestBtn: "\u5E94\u7528\u5269\u4F59 (a)",
    flipAutoBtn: "\u5207\u6362\u4E3A AUTO (A)"
  },
  overview: {
    loading: "\u52A0\u8F7D\u6982\u89C8\u2026",
    failed: "\u6982\u89C8\u5931\u8D25\uFF1A{error}",
    standaloneTitle: "\u72EC\u7ACB\u6A21\u5F0F",
    standaloneDesc: "\u53EA\u8BFB\u78C1\u76D8\u89C6\u56FE\u3002\u5728 visionox code \u5185\u542F\u52A8 /dashboard \u4EE5\u83B7\u53D6\u5B9E\u65F6\u4F1A\u8BDD\u72B6\u6001\u3001MCP \u548C\u5DE5\u5177\u3002",
    cockpit: "\u9A7E\u9A76\u8231",
    balance: "\u4F59\u989D",
    tokens7d: "tokens \xB7 7 \u5929",
    cacheHit: "\u7F13\u5B58\u547D\u4E2D",
    toolCalls24h: "\u5DE5\u5177\u8C03\u7528 \xB7 24 \u5C0F\u65F6",
    budget: "\u9884\u7B97",
    currentSession: "\u5F53\u524D\u4F1A\u8BDD",
    noSession: "\u65E0\u6D3B\u8DC3\u4F1A\u8BDD \u2014 \u5728 visionox code \u5185\u6267\u884C /dashboard \u8FDB\u884C\u8FDE\u63A5\u3002",
    promptTok: "\u63D0\u793A tokens",
    completionTok: "\u8865\u5168 tokens",
    cost: "\u8D39\u7528",
    costTrend: "\u8D39\u7528 \xB7 14 \u5929",
    noUsageYet: "\u6682\u65E0\u7528\u91CF",
    dayAvg: "/\u5929 \u5747\u503C",
    recentPlans: "\u8FD1\u671F\u8BA1\u5212",
    noPlans: "\u6682\u65E0\u8BA1\u5212 \u2014 \u4F7F\u7528 submit_plan \u63D0\u4EA4\u4E00\u4E2A\u3002",
    toolActivity: "\u5DE5\u5177\u6D3B\u52A8",
    noToolCalls: "\u6682\u65E0\u5DE5\u5177\u8C03\u7528\u3002",
    toolsLoaded: "\u5DF2\u52A0\u8F7D\u5DE5\u5177",
    mcpServers: "MCP \u670D\u52A1\u5668",
    editMode: "\u7F16\u8F91\u6A21\u5F0F",
    version: "Visionox",
    workingDir: "\u5DE5\u4F5C\u76EE\u5F55",
    projectRoot: "\u9879\u76EE\u6839\u76EE\u5F55",
    noPriorData: "\u65E0\u5386\u53F2\u6570\u636E",
    stable: "\u2014 \u7A33\u5B9A",
    vsPrior: "{arrow} {pct}% \u8F83\u4E0A\u671F",
    active: "\u6D3B\u8DC3",
    allUp: "\u5168\u90E8\u5728\u7EBF",
    yoloWarning: "\u6240\u6709\u63D0\u793A\u88AB\u7ED5\u8FC7",
    checking: "\u68C0\u67E5\u4E2D",
    latest: "\u6700\u65B0"
  },
  usage: {
    loading: "\u52A0\u8F7D\u7528\u91CF\u2026",
    failed: "\u7528\u91CF\u5931\u8D25\uFF1A{error}",
    records: "{count} \u6761\u8BB0\u5F55",
    dailyUsage: "\u6BCF\u65E5\u7528\u91CF",
    dailyMeta: "\u8D39\u7528 \xB7 \u7F13\u5B58\u8282\u7701 \xB7 \u8F6E\u6B21",
    noData: "\u6682\u65E0\u7528\u91CF\u6570\u636E \u2014 \u5728 visionox chat / code / run \u4E2D\u6267\u884C\u4E00\u8F6E\uFF0C\u7136\u540E\u5237\u65B0\u3002",
    windows: "\u6EDA\u52A8\u7A97\u53E3",
    colWindow: "\u65F6\u95F4\u8303\u56F4",
    colTurns: "\u8F6E\u6B21",
    colCacheHit: "\u7F13\u5B58\u547D\u4E2D",
    colCost: "\u8D39\u7528 (USD)",
    colCacheSaved: "\u7F13\u5B58\u8282\u7701",
    colVsClaude: "\u5BF9\u6BD4 Claude",
    colSaved: "\u8282\u7701",
    axisTime: "\u65F6\u95F4",
    axisUsd: "\u7F8E\u5143",
    axisTurns: "\u8F6E\u6B21",
    seriesCost: "\u8D39\u7528",
    seriesCacheSaved: "\u7F13\u5B58\u8282\u7701",
    seriesTurns: "\u8F6E\u6B21",
    mostUsed: "\u6700\u5E38\u7528\u6A21\u578B",
    colModel: "\u6A21\u578B"
  },
  sessions: {
    loading: "\u52A0\u8F7D\u4F1A\u8BDD\u2026",
    failed: "\u4F1A\u8BDD\u5931\u8D25\uFF1A{error}",
    noSessions: "\u6682\u65E0\u5DF2\u4FDD\u5B58\u7684\u4F1A\u8BDD\u3002",
    filterPlaceholder: "\u7B5B\u9009\u4F1A\u8BDD",
    msgs: "\u6761\u6D88\u606F",
    pickHint: "\u9009\u62E9\u5DE6\u4FA7\u7684\u4F1A\u8BDD\u4EE5\u67E5\u770B\u5176\u8F6C\u5F55\u7A3F\u3002",
    resumeTitle: "\u5728 TUI \u4E2D\u6062\u590D",
    resumeDesc: "\u4F1A\u8BDD\u4E2D\u9014\u5207\u6362\u9700\u8981\u91CD\u542F\uFF0C\u4EE5\u4FBF\u6D88\u606F\u65E5\u5FD7\u53EF\u4EE5\u5E72\u51C0\u5730\u56DE\u9000\u3002\u8BF7\u9000\u51FA\u5F53\u524D\u4F1A\u8BDD\uFF0C\u7136\u540E\u8FD0\u884C\uFF1A",
    loadingTranscript: "\u52A0\u8F7D\u8F6C\u5F55\u7A3F\u2026",
    emptyTranscript: "\u7A7A\u7684\u8F6C\u5F55\u7A3F\u3002",
    messages: "{count} \u6761\u6D88\u606F"
  },
  tools: {
    loading: "\u52A0\u8F7D\u5DE5\u5177\u2026",
    failed: "\u5DE5\u5177\u5931\u8D25\uFF1A{error}",
    noTools: "\u672A\u6CE8\u518C\u4EFB\u4F55\u5DE5\u5177\u3002",
    planMode: "\u8BA1\u5212\u6A21\u5F0F \u2014 \u5199\u5165\u53D7\u9650",
    colTool: "\u5DE5\u5177",
    colFlags: "\u6807\u5FD7",
    colDesc: "\u63CF\u8FF0",
    readOnly: "\u53EA\u8BFB",
    write: "\u5199\u5165",
    flat: "\u6241\u5E73",
    desc: {
      web_search: "\u641C\u7D22\u516C\u5171\u7F51\u7EDC\u3002\u8FD4\u56DE\u5E26\u6807\u9898\u3001URL \u548C\u6458\u8981\u7684\u6392\u5E8F\u7ED3\u679C\u3002\u5F53\u7B54\u6848\u7684\u6B63\u786E\u6027\u4F9D\u8D56\u4E8E\u5F53\u524D\u72B6\u6001\u65F6\u8C03\u7528\u2014\u2014\u4E8B\u4EF6\u3001\u4EF7\u683C\u3001\u53D1\u5E03\u3001\u73B0\u5B9E\u4E16\u754C\u7684\u72B6\u6001\u3002",
      web_fetch: "\u4E0B\u8F7D URL \u5E76\u8FD4\u56DE\u5176\u53EF\u89C1\u6587\u672C\u5185\u5BB9\uFF08\u5DF2\u5265\u79BB\u811A\u672C/\u6837\u5F0F/\u5BFC\u822A\uFF09\u3002\u5728 web_search \u6458\u8981\u4E0D\u591F\u65F6\u4F7F\u7528\u3002",
      run_command: "\u5728\u9879\u76EE\u6839\u76EE\u5F55\u6267\u884C shell \u547D\u4EE4\uFF0C\u8FD4\u56DE\u5408\u5E76\u7684\u6807\u51C6\u8F93\u51FA\u548C\u6807\u51C6\u9519\u8BEF\u3002\u767D\u540D\u5355\u4E2D\u7684\u53EA\u8BFB\u547D\u4EE4\u7ACB\u5373\u6267\u884C\uFF1B\u53EF\u80FD\u4FEE\u6539\u72B6\u6001\u7684\u64CD\u4F5C\u9700\u7528\u6237\u786E\u8BA4\u3002",
      run_background: "\u542F\u52A8\u4E00\u4E2A\u957F\u65F6\u95F4\u8FD0\u884C\u7684\u8FDB\u7A0B\u5E76\u5206\u79BB\u3002\u8FD4\u56DE\u4EFB\u52A1 ID \u7528\u4E8E\u67E5\u770B\u65E5\u5FD7\u3001\u7B49\u5F85\u5B8C\u6210\u6216\u7EC8\u6B62\u3002\u7528\u4E8E\u5F00\u53D1\u670D\u52A1\u5668\u3001\u6587\u4EF6\u76D1\u542C\u5668\u548C\u4E00\u6B21\u6027\u957F\u65F6\u95F4\u4EFB\u52A1\u3002",
      job_output: "\u8BFB\u53D6\u540E\u53F0\u4EFB\u52A1\u7684\u6700\u65B0\u8F93\u51FA\u3002\u8FD4\u56DE\u7F13\u51B2\u533A\u672B\u5C3E\u5185\u5BB9\u5E76\u544A\u77E5\u4EFB\u52A1\u662F\u5426\u4ECD\u5728\u8FD0\u884C\u3002",
      wait_for_job: "\u5728\u670D\u52A1\u7AEF\u963B\u585E\u76F4\u5230\u540E\u53F0\u4EFB\u52A1\u5B8C\u6210\uFF08\u6709\u8D85\u65F6\u9650\u5236\uFF09\u3002\u7528\u4E8E\u66FF\u4EE3\u8F6E\u8BE2 job_output\u3002",
      stop_job: "\u505C\u6B62\u540E\u53F0\u4EFB\u52A1\u3002\u5148\u53D1\u9001 SIGTERM\uFF0C\u5BBD\u9650\u671F\u540E\u53D1\u9001 SIGKILL\u3002\u53EF\u5B89\u5168\u8C03\u7528\u5DF2\u9000\u51FA\u7684\u4EFB\u52A1\u3002",
      list_jobs: "\u5217\u51FA\u672C\u6B21\u4F1A\u8BDD\u542F\u52A8\u7684\u6240\u6709\u540E\u53F0\u4EFB\u52A1\u2014\u2014\u8FD0\u884C\u4E2D\u548C\u5DF2\u9000\u51FA\u7684\u2014\u2014\u5305\u542B ID\u3001\u547D\u4EE4\u3001PID \u548C\u72B6\u6001\u3002",
      remember: "\u4FDD\u5B58\u4E00\u6761\u8BB0\u5FC6\u4F9B\u672A\u6765\u4F1A\u8BDD\u4F7F\u7528\u3002\u5F53\u7528\u6237\u9648\u8FF0\u504F\u597D\u3001\u7EA0\u6B63\u4F60\u7684\u65B9\u6CD5\u3001\u5206\u4EAB\u975E\u663E\u800C\u6613\u89C1\u7684\u4E8B\u5B9E\u6216\u8981\u6C42\u4F60\u8BB0\u4F4F\u67D0\u4E8B\u65F6\u4F7F\u7528\u3002",
      forget: "\u5220\u9664\u8BB0\u5FC6\u6587\u4EF6\u5E76\u4ECE MEMORY.md \u4E2D\u79FB\u9664\u3002\u5F53\u7528\u6237\u8981\u6C42\u5FD8\u8BB0\u67D0\u4E8B\u6216\u4E4B\u524D\u8BB0\u4F4F\u7684\u4E8B\u5B9E\u5DF2\u4E0D\u518D\u6B63\u786E\u65F6\u4F7F\u7528\u3002",
      recall_memory: "\u5F53\u8BB0\u5FC6\u6587\u4EF6\u7684\u4E00\u884C\u6458\u8981\u4E0D\u591F\u8BE6\u7EC6\u65F6\uFF0C\u8BFB\u53D6\u5176\u5B8C\u6574\u5185\u5BB9\u3002",
      read_file: "\u8BFB\u53D6\u6C99\u7BB1\u6839\u76EE\u5F55\u4E0B\u7684\u6587\u4EF6\u3002\u652F\u6301 head/tail/range \u8303\u56F4\u8BFB\u53D6\u4EE5\u8282\u7701\u4E0A\u4E0B\u6587\u3002\u8D85\u8FC7 200 \u884C\u7684\u6587\u4EF6\u81EA\u52A8\u8FD4\u56DE\u9884\u89C8\u3002",
      list_directory: "\u5217\u51FA\u76EE\u5F55\u4E2D\u7684\u6761\u76EE\u3002\u6BCF\u884C\u4E00\u4E2A\u6761\u76EE\uFF0C\u76EE\u5F55\u4EE5\u659C\u6760\u6807\u8BB0\u3002",
      directory_tree: "\u9012\u5F52\u5217\u51FA\u76EE\u5F55\u4E2D\u7684\u6761\u76EE\uFF0C\u4EE5\u7F29\u8FDB\u6811\u5F62\u7ED3\u6784\u663E\u793A\u3002\u5BF9\u5927\u5B50\u76EE\u5F55\u81EA\u52A8\u6298\u53E0\u4EE5\u8282\u7701\u9884\u7B97\u3002",
      search_files: "\u6839\u636E\u540D\u79F0\u5339\u914D\u5B50\u4E32\u6216\u6B63\u5219\u8868\u8FBE\u5F0F\u67E5\u627E\u6587\u4EF6\u3002\u4E0D\u533A\u5206\u5927\u5C0F\u5199\u3002\u9ED8\u8BA4\u8DF3\u8FC7\u4F9D\u8D56/\u6784\u5EFA\u76EE\u5F55\u3002",
      search_content: "\u9012\u5F52\u641C\u7D22\u6587\u4EF6\u5185\u5BB9\u4E2D\u7684\u5B50\u4E32\u6216\u6B63\u5219\u8868\u8FBE\u5F0F\u3002\u4EE5 path:line:text \u683C\u5F0F\u8FD4\u56DE\u5339\u914D\u7ED3\u679C\u3002\u67E5\u627E\u5F15\u7528\u7684\u6B63\u786E\u5DE5\u5177\u3002",
      glob: "\u6309 glob \u6A21\u5F0F\u5217\u51FA\u6587\u4EF6\uFF0C\u6309\u4FEE\u6539\u65F6\u95F4\u6392\u5E8F\u3002\u9ED8\u8BA4\u9650\u5236 200\uFF0C\u6700\u5927 1000\u3002\u9ED8\u8BA4\u8DF3\u8FC7 node_modules/.git/dist\u3002",
      get_file_info: "\u83B7\u53D6\u6C99\u7BB1\u6839\u76EE\u5F55\u4E0B\u8DEF\u5F84\u7684\u72B6\u6001\u4FE1\u606F\u3002\u8FD4\u56DE\u7C7B\u578B\u3001\u5B57\u8282\u5927\u5C0F\u548C\u4FEE\u6539\u65F6\u95F4\u3002",
      write_file: "\u521B\u5EFA\u6216\u8986\u76D6\u6587\u4EF6\uFF0C\u5185\u5BB9\u7531\u53C2\u6570\u6307\u5B9A\u3002\u6309\u9700\u521B\u5EFA\u7236\u76EE\u5F55\u3002",
      edit_file: "\u5BF9\u73B0\u6709\u6587\u4EF6\u5E94\u7528 SEARCH/REPLACE \u7F16\u8F91\u3002\u641C\u7D22\u5FC5\u987B\u5B8C\u5168\u5339\u914D\u4E14\u5728\u6587\u4EF6\u4E2D\u552F\u4E00\u3002",
      multi_edit: "\u8DE8\u4E00\u4E2A\u6216\u591A\u4E2A\u6587\u4EF6\u539F\u5B50\u6027\u5730\u5E94\u7528 N \u4E2A SEARCH/REPLACE \u7F16\u8F91\u3002\u5982\u679C\u4EFB\u4F55\u7F16\u8F91\u5931\u8D25\uFF0C\u4E0D\u5199\u5165\u4EFB\u4F55\u6587\u4EF6\u3002",
      create_directory: "\u5728\u6C99\u7BB1\u6839\u76EE\u5F55\u4E0B\u521B\u5EFA\u76EE\u5F55\uFF08\u4EE5\u53CA\u4EFB\u4F55\u7F3A\u5931\u7684\u7236\u76EE\u5F55\uFF09\u3002",
      move_file: "\u91CD\u547D\u540D\u6216\u79FB\u52A8\u6C99\u7BB1\u6839\u76EE\u5F55\u4E0B\u7684\u6587\u4EF6\u6216\u76EE\u5F55\u3002",
      delete_file: "\u5220\u9664\u6C99\u7BB1\u6839\u76EE\u5F55\u4E0B\u7684\u4E00\u4E2A\u6587\u4EF6\u3002\u62D2\u7EDD\u76EE\u5F55\u2014\u2014\u8BF7\u4F7F\u7528 delete_directory \u5220\u9664\u76EE\u5F55\u3002",
      delete_directory: "\u9012\u5F52\u5220\u9664\u6C99\u7BB1\u6839\u76EE\u5F55\u4E0B\u7684\u76EE\u5F55\u3002\u4F20\u5165 recursive:false \u53EF\u62D2\u7EDD\u975E\u7A7A\u76EE\u5F55\u3002",
      copy_file: "\u590D\u5236\u6C99\u7BB1\u6839\u76EE\u5F55\u4E0B\u7684\u6587\u4EF6\u6216\u76EE\u5F55\u3002\u62D2\u7EDD\u8986\u76D6\u5DF2\u5B58\u5728\u7684\u76EE\u6807\u3002",
      submit_plan: "\u63D0\u4EA4\u4E00\u4E2A\u5177\u4F53\u7684\u8BA1\u5212\u4EE5\u4F9B\u5BA1\u67E5\u5BA1\u6279\u3002\u7528\u4E8E\u591A\u6587\u4EF6\u91CD\u6784\u3001\u67B6\u6784\u53D8\u66F4\u6216\u4EFB\u4F55\u64A4\u9500\u4EE3\u4EF7\u9AD8\u6602\u7684\u64CD\u4F5C\u3002",
      mark_step_complete: "\u5C06\u5DF2\u6279\u51C6\u8BA1\u5212\u7684\u4E00\u4E2A\u6B65\u9AA4\u6807\u8BB0\u4E3A\u5B8C\u6210\u3002\u5B8C\u6210\u6BCF\u4E2A\u6B65\u9AA4\u540E\u6070\u597D\u8C03\u7528\u4E00\u6B21\u3002",
      revise_plan: "\u5916\u79D1\u624B\u672F\u5F0F\u66FF\u6362\u8FDB\u884C\u4E2D\u8BA1\u5212\u7684\u5269\u4F59\u6B65\u9AA4\u3002\u5DF2\u5B8C\u6210\u7684\u6B65\u9AA4\u6C38\u8FDC\u4E0D\u4F1A\u88AB\u89E6\u53CA\u3002",
      run_skill: "\u4ECE\u6280\u80FD\u7D22\u5F15\u4E2D\u8C03\u7528\u4E00\u4E2A playbook\u3002\u4F20\u5165\u88F8\u6280\u80FD\u540D\u79F0\u3002\u6807\u8BB0\u4E3A\u5B50\u4EE3\u7406\u7684\u6280\u80FD\u5C06\u542F\u52A8\u72EC\u7ACB\u7684\u5B50\u4EE3\u7406\u3002",
      spawn_subagent: "\u4E3A\u4E00\u4E2A\u72EC\u7ACB\u5B50\u4EFB\u52A1\u542F\u52A8\u9694\u79BB\u7684\u5B50\u4EE3\u7406\u3002\u7528\u4E8E\u5E76\u884C\u5206\u53D1\u6216\u9700\u8981\u5927\u91CF\u6587\u4EF6\u8BFB\u53D6\u7684\u5DE5\u4F5C\u3002",
      todo_write: "\u591A\u6B65\u5DE5\u4F5C\u7684\u4F1A\u8BDD\u5185\u4EFB\u52A1\u8DDF\u8E2A\u5668\u3002\u6BCF\u6B21\u8C03\u7528\u66FF\u6362\u6574\u4E2A\u5217\u8868\u3002\u65E0\u5BA1\u6279\u5173\u5361\uFF0C\u4E0D\u5199\u5165\u6587\u4EF6\u3002",
      ask_choice: "\u5411\u7528\u6237\u5C55\u793A 2-6 \u4E2A\u9009\u9879\u3002\u5F53\u7528\u6237\u8981\u6C42\u9009\u62E9\u6216\u9700\u8981\u504F\u597D\u51B3\u7B56\u65F6\u4F7F\u7528\u3002",
      create_skill: "\u521B\u5EFA\u4E00\u4E2A\u65B0\u6280\u80FD\uFF0C\u7528\u6237\u53EF\u901A\u8FC7 /skill \u547D\u4EE4\u8C03\u7528\u3002\u652F\u6301\u5185\u8054\u548C\u5B50\u4EE3\u7406\u4E24\u79CD\u8FD0\u884C\u6A21\u5F0F\u3002",
      add_mcp_server: "\u5728\u7528\u6237\u914D\u7F6E\u4E2D\u6CE8\u518C\u65B0\u7684 MCP \u670D\u52A1\u5668\u3002\u4E0B\u6B21\u4F1A\u8BDD\u751F\u6548\u3002\u652F\u6301 stdio\u3001SSE \u548C streamable-http\u3002"
    }
  },
  permissions: {
    loading: "\u52A0\u8F7D\u6743\u9650\u2026",
    failed: "\u6743\u9650\u5931\u8D25\uFF1A{error}",
    yoloTitle: "YOLO \u6A21\u5F0F",
    yoloDesc: "\u6240\u6709 shell \u547D\u4EE4\u81EA\u52A8\u8FD0\u884C\uFF0C\u5141\u8BB8\u5217\u8868\u88AB\u7ED5\u8FC7\u3002\u5728 TUI \u4E2D\u4F7F\u7528 /mode review \u5207\u6362\u56DE\u6765\u3002",
    project: "\u9879\u76EE",
    builtin: "\u5185\u7F6E",
    addPrefix: "\u6DFB\u52A0\u524D\u7F00",
    addPlaceholder: '\u4F8B\u5982 "npm run build" \u6216 "deploy.sh"',
    clearAll: "\u6E05\u9664\u5168\u90E8",
    alreadyIn: "{prefix} \u5DF2\u5728\u5217\u8868\u4E2D",
    added: "\u5DF2\u6DFB\u52A0\uFF1A{prefix}",
    removed: "\u5DF2\u79FB\u9664\uFF1A{prefix}",
    cleared: "\u5DF2\u6E05\u9664 {count} \u6761",
    removeConfirm: '\u4ECE\u6B64\u9879\u76EE\u7684\u5141\u8BB8\u5217\u8868\u4E2D\u79FB\u9664 "{prefix}"\uFF1F',
    clearConfirm: "\u6E05\u9664\u6240\u6709\u9879\u76EE\u5141\u8BB8\u5217\u8868\u6761\u76EE\uFF1F\u5185\u7F6E\u6761\u76EE\u4E0D\u53D7\u5F71\u54CD\u3002",
    projectAllowlist: "\u9879\u76EE\u5141\u8BB8\u5217\u8868 \xB7 {count}",
    nothingStored: "\u6B64\u9879\u76EE\u6682\u65E0\u5B58\u50A8\u7684\u6761\u76EE\u3002",
    colNum: "#",
    colPrefix: "\u524D\u7F00",
    builtinTitle: "\u5185\u7F6E \xB7 {count} \xB7 \u53EA\u8BFB",
    standaloneWarning: "\u4FEE\u6539\u64CD\u4F5C\u9700\u8981\u5728\u6D3B\u8DC3\u7684 visionox code \u4F1A\u8BDD\u5185\u6267\u884C /dashboard \u2014 \u72EC\u7ACB\u6A21\u5F0F\u7684 visionox dashboard \u65E0\u6CD5\u786E\u5B9A\u8981\u7F16\u8F91\u54EA\u4E2A\u9879\u76EE\u7684\u5141\u8BB8\u5217\u8868\u3002"
  },
  mcp: {
    loading: "\u52A0\u8F7D MCP\u2026",
    servers: "MCP \u670D\u52A1\u5668 \xB7 {count} \u4E2A\u5DF2\u6865\u63A5",
    all: "\u5168\u90E8",
    live: "\u5728\u7EBF",
    unbridged: "\u672A\u6865\u63A5",
    specPlaceholder: "\u89C4\u683C \u2014 \u4F8B\u5982 fs=npx -y @modelcontextprotocol/...",
    saved: "\u5DF2\u4FDD\u5B58",
    savedRestart: "\u5DF2\u4FDD\u5B58 \u2014 \u91CD\u542F visionox code \u4EE5\u6865\u63A5\u6B64\u670D\u52A1\u5668",
    removed: "\u5DF2\u79FB\u9664 \u2014 \u91CD\u542F\u4EE5\u65AD\u5F00\u5B9E\u65F6\u6865\u63A5",
    removeConfirm: "\u4ECE\u914D\u7F6E\u4E2D\u79FB\u9664 MCP \u89C4\u683C\uFF1F\n\n{spec}",
    noServers: "\u6B64\u4F1A\u8BDD\u4E2D\u65E0 MCP \u670D\u52A1\u5668\u3002",
    tools: "\u4E2A\u5DE5\u5177",
    inConfig: "\u5728\u914D\u7F6E\u4E2D \xB7 \u672A\u52A0\u8F7D",
    unbridgedTitle: "\u672A\u6865\u63A5 \xB7 \u5728\u914D\u7F6E\u4E2D",
    removeBtn: "\u79FB\u9664",
    spec: "\u89C4\u683C",
    whyUnbridged: "\u4E3A\u4EC0\u4E48\u672A\u6865\u63A5\uFF1F",
    whyUnbridgedDesc: "\u6B64\u89C4\u683C\u5B58\u5728\u4E8E\u60A8\u7684 config.json \u4E2D\uFF0C\u4F46\u672A\u6865\u63A5\u5230\u5B9E\u65F6\u4F1A\u8BDD\u3002MCP \u670D\u52A1\u5668\u5728 visionox code \u542F\u52A8\u65F6\u8FDE\u63A5\uFF1B\u4EEA\u8868\u76D8\u672C\u8EAB\u65E0\u6CD5\u751F\u6210\u5B50\u8FDB\u7A0B\u3002",
    whyUnbridgedHint: "\u6FC0\u6D3B\u65B9\u6CD5\uFF1A\u91CD\u542F visionox code\uFF0C\u7136\u540E\u5237\u65B0\u6B64\u4EEA\u8868\u76D8\u3002",
    pickHint: "\u9009\u62E9\u5DE6\u4FA7\u7684 MCP \u670D\u52A1\u5668\u4EE5\u68C0\u67E5\u5DE5\u5177 / \u8D44\u6E90 / \u63D0\u793A\u3002",
    toolsTitle: "\u5DE5\u5177 \xB7 {count}",
    resourcesTitle: "\u8D44\u6E90 \xB7 {count}",
    promptsTitle: "\u63D0\u793A \xB7 {count}",
    colName: "\u540D\u79F0",
    colDesc: "\u63CF\u8FF0",
    colUri: "URI",
    marketplace: "\u5E02\u573A",
    marketplaceSearch: "\u641C\u7D22\u6CE8\u518C\u8868\u2026",
    marketplaceLoading: "\u52A0\u8F7D\u6CE8\u518C\u8868\u2026",
    marketplaceMore: "\u518D\u52A0\u8F7D 5 \u9875",
    marketplaceMoreLabel: "\u518D\u52A0\u8F7D 50 \u6761  \xB7  \u5F53\u524D {shown} / {total}",
    marketplaceMoreHint: "\u9700\u8981\u4ECE\u8FDC\u7AEF\u6CE8\u518C\u8868\u518D\u62C9\u51E0\u9875",
    marketplaceMoreCachedHint: "\u672C\u5730\u7F13\u5B58\u5DF2\u6709\u66F4\u591A\u6761\u76EE",
    marketplaceExhausted: "\u5DF2\u52A0\u8F7D\u5168\u90E8\u9875",
    marketplaceExhaustedFull: "\u5DF2\u5C55\u793A\u5168\u90E8 {total} \u6761 \u2014 \u6CE8\u518C\u8868\u8017\u5C3D",
    marketplaceCount: "\u5DF2\u8F7D\u5165 {loaded} \xB7 \u5339\u914D {matched} \xB7 \u6765\u6E90\uFF1A{source}{cached}",
    marketplaceCachedSuffix: " \xB7 \u7F13\u5B58\u4E2D",
    marketplaceNoMatches: "\u65E0\u5339\u914D\u7ED3\u679C\u3002\u6362\u5173\u952E\u8BCD\u6216\u52A0\u8F7D\u66F4\u591A\u9875\u3002",
    marketplaceInstall: "\u5B89\u88C5",
    marketplacePickHint: "\u5728\u5DE6\u4FA7\u9009\u62E9\u670D\u52A1\u5668\uFF0C\u7136\u540E\u70B9\u5B89\u88C5\u3002",
    marketplaceInstalled: "\u5DF2\u5B89\u88C5 \u2192 {spec}",
    marketplaceInstalledBridged: "\u5DF2\u5B89\u88C5\u5E76\u6865\u63A5 \u2192 {spec}",
    marketplaceAlready: "\u5DF2\u5B89\u88C5\u8FC7",
    marketplaceNeedsEnv: "\u9700\u8BBE\u7F6E\u73AF\u5883\u53D8\u91CF\uFF1A{names}",
    marketplaceSourceTag: "[{source}]",
    marketplaceNoInstall: "Smithery \u5217\u8868\u9879 \u2014 \u4E0D\u66B4\u9732\u5B89\u88C5\u5143\u6570\u636E\uFF1B\u8BF7\u76F4\u63A5 `npx -y @smithery/cli install {name}`",
    marketplaceFetchOnInstall: "Smithery \u5217\u8868 \u2014 \u5B89\u88C5\u65F6\u518D\u62C9\u8BE6\u60C5\u3002HTTP \u670D\u52A1\u6620\u5C04\u4E3A streamable-http \u8FDC\u7AEF\uFF1Bstdio \u670D\u52A1\u901A\u8FC7 @smithery/cli \u8FD0\u884C\u3002",
    marketplaceInstalledBadge: "\u5DF2\u5B89\u88C5",
    marketplaceUninstall: "\u5378\u8F7D",
    marketplaceEnvTitle: "\u5FC5\u9700\u7684\u73AF\u5883\u53D8\u91CF",
    marketplaceEnvHint: "\u4E0B\u6B21\u542F\u52A8 `visionox code` \u4E4B\u524D\u5728 shell \u91CC\u8BBE\u597D\uFF0C\u6865\u63A5\u7684\u670D\u52A1\u5668\u624D\u80FD\u6B63\u5E38\u9274\u6743\u3002",
    marketplaceRestartHint: "\u5DF2\u5199\u5165 ~/.visionox/config.json\u3002\u91CD\u542F `visionox code` \u540E\u670D\u52A1\u5668\u624D\u4F1A\u771F\u6B63\u6865\u63A5\uFF08\u70ED\u91CD\u8F7D\u5728\u8DEF\u7EBF\u56FE\u4E0A\uFF09\u3002"
  },
  memory: {
    loading: "\u52A0\u8F7D\u8BB0\u5FC6\u2026",
    files: "\u8BB0\u5FC6 \xB7 {count} \u4E2A\u6587\u4EF6",
    exists: "\u5DF2\u5B58\u5728",
    create: "\u521B\u5EFA",
    noFiles: "\u6682\u65E0\u8BB0\u5FC6\u6587\u4EF6\u3002",
    pickHint: "\u9009\u62E9\u5DE6\u4FA7\u7684\u8BB0\u5FC6\u6587\u4EF6\u3002",
    pickDesc: "\u9879\u76EE visionox.md \u53EF\u63D0\u4EA4\uFF1B\u5168\u5C40\u7B14\u8BB0\u5B58\u50A8\u5728 ~/.visionox/memory/\u3002",
    chars: "{count} \u4E2A\u5B57\u7B26",
    saved: "\u5DF2\u4FDD\u5B58 {scope}",
    reloadHint: "\u5728\u4E0B\u6B21 /new \u6216\u4F1A\u8BDD\u91CD\u542F\u65F6\u91CD\u65B0\u52A0\u8F7D"
  },
  hooks: {
    loading: "\u52A0\u8F7D\u94A9\u5B50\u2026",
    resolved: "\u5DF2\u89E3\u6790",
    eventMatrix: "\u4E8B\u4EF6\u77E9\u9635",
    matrixSub: "{scripts} \u4E2A\u811A\u672C \xD7 {events} \u4E2A\u4E8B\u4EF6",
    noHooks: "\u672A\u914D\u7F6E\u94A9\u5B50\u3002\u7F16\u8F91\u4E0B\u65B9\u7684 JSON \u4EE5\u6DFB\u52A0\u3002",
    colScript: "\u811A\u672C",
    noProject: "\u65E0\u6D3B\u8DC3\u9879\u76EE \u2014 \u5728 visionox code \u4E2D\u6253\u5F00 /dashboard \u4EE5\u7F16\u8F91\u9879\u76EE\u94A9\u5B50\u3002",
    saveReload: "\u4FDD\u5B58\u5E76\u91CD\u8F7D",
    discard: "\u653E\u5F03\u66F4\u6539",
    savedReloaded: "\u5DF2\u4FDD\u5B58\u5E76\u91CD\u8F7D {scope}",
    recentRuns: "\u8FD1\u671F\u8FD0\u884C",
    noRuns: "\u8FD1\u671F\u4F1A\u8BDD\u65E5\u5FD7\u4E2D\u65E0\u94A9\u5B50\u8FD0\u884C\u8BB0\u5F55\u3002",
    colWhen: "\u65F6\u95F4",
    colPhase: "\u9636\u6BB5",
    colHook: "\u94A9\u5B50",
    colOutcome: "\u7ED3\u679C"
  },
  skills: {
    loading: "\u52A0\u8F7D\u6280\u80FD\u2026",
    filterPlaceholder: "\u7B5B\u9009\u6280\u80FD",
    project: "\u9879\u76EE",
    global: "\u5168\u5C40",
    builtin: "\u5185\u7F6E",
    newSkill: "\u65B0\u6280\u80FD",
    noDescription: "\uFF08\u65E0\u63CF\u8FF0\uFF09",
    runs7d: "\u6B21\u8FD0\u884C \xB7 7 \u5929",
    pickHint: "\u9009\u62E9\u5DE6\u4FA7\u7684\u6280\u80FD\uFF0C\u6216\u5728\u4E0A\u65B9\u521B\u5EFA\u65B0\u6280\u80FD\u3002",
    readOnlyBuiltin: "\u53EA\u8BFB \xB7 \u5185\u7F6E",
    builtinDesc: "\u5185\u7F6E\u6280\u80FD\u968F Visionox \u4E00\u8D77\u53D1\u5E03\uFF1B\u6A21\u578B\u4F1A\u81EA\u52A8\u8BC6\u522B\u3002\u5982\u9700\u81EA\u5B9A\u4E49\uFF0C\u8BF7\u521B\u5EFA\u540C\u540D\u7684\u9879\u76EE\u6216\u5168\u5C40\u6280\u80FD\u3002",
    saved: "\u5DF2\u4FDD\u5B58 {scope}/{name}",
    deleteConfirm: "\u5220\u9664\u6280\u80FD {scope}/{name}\uFF1F",
    reloadHint: "\u5728\u4E0B\u6B21 /new \u6216\u4F1A\u8BDD\u91CD\u542F\u65F6\u91CD\u65B0\u52A0\u8F7D"
  },
  system: {
    loading: "\u52A0\u8F7D\u5065\u5EB7\u72B6\u6001\u2026",
    failed: "\u5065\u5EB7\u68C0\u67E5\u5931\u8D25\uFF1A{error}",
    healthChecks: "\u5065\u5EB7\u68C0\u67E5",
    version: "\u7248\u672C",
    checking: "\u68C0\u67E5\u4E2D",
    latest: "\u25CF \u6700\u65B0",
    outOfDate: "\u25CF \u9700\u8981\u66F4\u65B0",
    versionPending: "\u7248\u672C\u68C0\u67E5\u4E2D",
    upToDate: "\u5DF2\u662F\u6700\u65B0",
    latestVer: "\u6700\u65B0\uFF1A{version}",
    sessions: "\u4F1A\u8BDD",
    ok: "\u25CF \u6B63\u5E38",
    memory: "\u8BB0\u5FC6",
    semanticIndex: "\u8BED\u4E49\u7D22\u5F15",
    built: "\u25CF \u5DF2\u6784\u5EFA",
    none: "\u2014 \u65E0",
    runIndex: "\u8FD0\u884C visionox index \u4EE5\u6784\u5EFA",
    usageLog: "\u7528\u91CF\u65E5\u5FD7",
    backgroundJobs: "\u540E\u53F0\u4EFB\u52A1",
    noSession: "\u2014 \u65E0\u4F1A\u8BDD",
    running: "{count} \u4E2A\u8FD0\u884C\u4E2D",
    attachHint: "\u8FDE\u63A5\u4F1A\u8BDD\u4EE5\u67E5\u770B\u4EFB\u52A1",
    shellSpawn: "Shell + \u751F\u6210",
    paths: "\u8DEF\u5F84",
    home: "\u4E3B\u76EE\u5F55",
    sessionsPath: "\u4F1A\u8BDD",
    memoryPath: "\u8BB0\u5FC6",
    semanticPath: "\u8BED\u4E49",
    usagePath: "\u7528\u91CF"
  },
  plans: {
    loading: "\u52A0\u8F7D\u8BA1\u5212\u2026",
    failed: "\u8BA1\u5212\u5931\u8D25\uFF1A{error}",
    noPlans: "\u6682\u65E0\u5F52\u6863\u8BA1\u5212 \u2014 \u8FD0\u884C\u8C03\u7528 submit_plan \u548C mark_step_complete \u7684\u8F6E\u6B21\u3002",
    filterPlaceholder: "\u7B5B\u9009\u8BA1\u5212",
    active: "\u8FDB\u884C\u4E2D",
    done: "\u5DF2\u5B8C\u6210",
    idle: "\u672A\u5F00\u59CB",
    steps: "\u6B65\u9AA4",
    pickHint: "\u9009\u62E9\u5DE6\u4FA7\u7684\u8BA1\u5212\u3002",
    noTitle: "\uFF08\u65E0\u6807\u9898\uFF09",
    stepTimeline: "\u6B65\u9AA4\u65F6\u95F4\u7EBF \xB7 {done} / {total}",
    step: "\u6B65\u9AA4 {n}"
  },
  semantic: {
    codeRequired: "\u8BED\u4E49 \u2014 \u9700\u8981\u4EE3\u7801\u6A21\u5F0F",
    indexBuilt: "\u7D22\u5F15\u5DF2\u6784\u5EFA",
    noIndex: "\u5C1A\u65E0\u7D22\u5F15",
    ready: "\u5C31\u7EEA",
    setupNeeded: "\u9700\u8981\u8BBE\u7F6E",
    installOllama: "\u5B89\u88C5 Ollama",
    installOllamaDesc: "Visionox \u4E0D\u4F1A\u4E3A\u60A8\u8FD0\u884C\u5305\u7BA1\u7406\u5668\u3002\u8BF7\u5148\u5B89\u88C5 Ollama\uFF0C\u7136\u540E\u8FD4\u56DE\uFF1A",
    macWindows: "macOS / Windows\uFF1A",
    download: "\u4ECE ollama.com/download \u4E0B\u8F7D",
    linux: "Linux\uFF1A",
    refreshHint: "\u5B89\u88C5\u540E\u5237\u65B0 \u2014 \u6B64\u9762\u677F\u5C06\u63D0\u4F9B\u542F\u52A8\u5B88\u62A4\u8FDB\u7A0B\u548C\u62C9\u53D6 {model} \u7684\u9009\u9879\u3002",
    daemon: "\u5B88\u62A4\u8FDB\u7A0B",
    daemonDesc: "ollama \u5728\u60A8\u7684 PATH \u4E2D\uFF0C\u4F46 HTTP \u5B88\u62A4\u8FDB\u7A0B\u4E0D\u53EF\u8FBE\u3002",
    startDaemon: "\u542F\u52A8\u5B88\u62A4\u8FDB\u7A0B",
    runsOllama: "\u4EE5\u5206\u79BB\u6A21\u5F0F\u8FD0\u884C ollama serve",
    model: "\u6A21\u578B",
    modelMissing: "{model} \u5C1A\u672A\u5B89\u88C5\u3002",
    modelSize: "\u9996\u6B21\u62C9\u53D6\u7EA6 270 MB\u3002",
    pulling: "\u62C9\u53D6\u4E2D\u2026",
    pullModel: "\u62C9\u53D6 {model}",
    indexStatus: "\u7D22\u5F15\u72B6\u6001",
    builtStatus: "\u25CF \u5DF2\u6784\u5EFA",
    incompatibleStatus: "\u25CF \u4E0D\u517C\u5BB9",
    chunks: "\u5206\u5757",
    files: "\u6587\u4EF6",
    dim: "\u7EF4\u5EA6",
    size: "\u5927\u5C0F",
    lastBuild: "\u4E0A\u6B21\u6784\u5EFA",
    builtWith: "\u6784\u5EFA\u6765\u6E90",
    currentTarget: "\u5F53\u524D\u76EE\u6807",
    incompatibleHint: "\u78C1\u76D8\u4E0A\u7684\u8FD9\u4E2A\u7D22\u5F15\u662F\u4E3A\u4E0D\u540C\u7684 provider \u6216 model \u6784\u5EFA\u7684\u3002\u8FD0\u884C\u201C\u5B8C\u5168\u91CD\u5EFA\u201D\u5373\u53EF\u66FF\u6362\u3002",
    runIndexHint: "\u8FD0\u884C\u7D22\u5F15\u4EE5\u542F\u7528 semantic_search\u3002",
    reIndex: "\u91CD\u5EFA\u7D22\u5F15",
    build: "\u6784\u5EFA",
    rebuild: "\u5B8C\u5168\u91CD\u5EFA",
    stop: "\u505C\u6B62",
    provider: "\u63D0\u4F9B\u65B9",
    providerType: "\u670D\u52A1\u7C7B\u578B",
    openaiCompat: "OpenAI-Compatible",
    apiUrl: "API URL",
    apiKey: "API Key",
    customRequestBody: "\u81EA\u5B9A\u4E49\u8BF7\u6C42\u4F53",
    invalidCustomRequestBody: "\u81EA\u5B9A\u4E49\u8BF7\u6C42\u4F53\u5FC5\u987B\u662F\u5408\u6CD5 JSON\uFF1A{error}",
    customRequestBodyMustBeObject: "\u81EA\u5B9A\u4E49\u8BF7\u6C42\u4F53\u5FC5\u987B\u662F JSON \u5BF9\u8C61\u3002",
    saveBeforeIndex: "\u8BF7\u5148\u4FDD\u5B58\u8BED\u4E49\u8BBE\u7F6E\uFF0C\u518D\u542F\u52A8\u7D22\u5F15\u3002",
    extraBody: "\u6269\u5C55\u8BF7\u6C42\u4F53",
    keepExistingKey: "\u7559\u7A7A\u5219\u4FDD\u7559\u73B0\u6709 Key",
    remoteProvider: "\u8FDC\u7A0B\u5411\u91CF\u670D\u52A1",
    remoteProviderDesc: "\u5728\u8FD9\u91CC\u914D\u7F6E OpenAI-Compatible embeddings \u7684\u5B8C\u6574 URL\u3002Visionox \u4F1A\u4E25\u683C\u4F7F\u7528\u4F60\u63D0\u4F9B\u7684 URL \u53D1\u8D77\u8BF7\u6C42\u3002",
    ollama: "Ollama",
    binary: "\u4E8C\u8FDB\u5236",
    found: "\u5DF2\u627E\u5230",
    missing: "\u7F3A\u5931",
    daemonStatus: "\u5B88\u62A4\u8FDB\u7A0B",
    up: "\u8FD0\u884C\u4E2D",
    down: "\u5DF2\u505C\u6B62",
    pulled: "\u5DF2\u62C9\u53D6",
    indexConfig: "\u7D22\u5F15\u914D\u7F6E",
    reset: "\u91CD\u7F6E",
    excludeDirs: "\u6392\u9664\u76EE\u5F55",
    excludeFiles: "\u6392\u9664\u6587\u4EF6",
    excludeExts: "\u6392\u9664\u6269\u5C55\u540D",
    excludePatterns: "\u6392\u9664\u6A21\u5F0F",
    glob: "glob",
    respectGitignore: "\u9075\u5FAA .gitignore",
    maxFileBytes: "\u6700\u5927\u6587\u4EF6\u5B57\u8282\u6570",
    skipLarger: "\u8DF3\u8FC7\u5927\u4E8E ~{size} MiB \u7684\u6587\u4EF6",
    preview: "\u9884\u89C8",
    searchPlaceholder: "\u63CF\u8FF0\u8981\u67E5\u627E\u7684\u5185\u5BB9 \u2014 '\u54EA\u91CC\u5904\u7406\u4E2D\u6B62\u4FE1\u53F7'",
    searching: "\u641C\u7D22\u4E2D\u2026",
    results: "{count} \u4E2A\u7ED3\u679C \xB7 {ms}ms \xB7 {model}",
    noMatches: "\u6CA1\u6709\u8D85\u8FC7\u5206\u6570\u9608\u503C\u7684\u5339\u914D\u3002",
    previewSummary: "\u9884\u89C8 \u2014 \u5C06\u7D22\u5F15 {included} \u4E2A\u6587\u4EF6\uFF0C\u8DF3\u8FC7 {skipped} \u4E2A",
    nothingSkipped: "\u65E0\u8DF3\u8FC7 \u2014 \u6240\u6709\u904D\u5386\u7684\u6587\u4EF6\u90FD\u5C06\u88AB\u7D22\u5F15\u3002",
    firstIncluded: "\u524D {count} \u4E2A\u5305\u542B\u7684\u6587\u4EF6",
    job: "\u4EFB\u52A1",
    phaseSetup: "\u521D\u59CB\u5316\u4E2D",
    phaseScan: "\u626B\u63CF\u6587\u4EF6",
    phaseEmbed: "\u5D4C\u5165\u5206\u5757",
    phaseWrite: "\u5199\u5165\u7D22\u5F15",
    phaseDone: "\u5B8C\u6210",
    phaseError: "\u9519\u8BEF",
    phaseCancelled: "\u5DF2\u505C\u6B62",
    setupFailed: "\u521D\u59CB\u5316\u5931\u8D25",
    stopping: "\u505C\u6B62\u4E2D",
    scanned: "\u5DF2\u626B\u63CF {count}",
    changed: "\u5DF2\u53D8\u66F4 {count}",
    skipped: "\u5DF2\u8DF3\u8FC7 {count}",
    chunksProgress: "{done} / {total}\uFF08{pct}%\uFF09",
    result: "\u7ED3\u679C",
    added: "\u5DF2\u6DFB\u52A0 {count}",
    removed: "\u5DF2\u79FB\u9664 {count}",
    failed: "\u5931\u8D25 {count}",
    skippedFiles: "{total} \u4E2A\u6587\u4EF6\uFF08{details}\uFF09",
    rebuildStarted: "\u5DF2\u542F\u52A8\u5B8C\u5168\u91CD\u5EFA",
    incrementalStarted: "\u5DF2\u542F\u52A8\u589E\u91CF\u7D22\u5F15",
    stopRequested: "\u5DF2\u8BF7\u6C42\u505C\u6B62 \u2014 \u5F53\u524D\u5206\u5757\u6279\u6B21\u5C06\u9996\u5148\u5B8C\u6210",
    startingDaemon: "\u6B63\u5728\u542F\u52A8 ollama \u5B88\u62A4\u8FDB\u7A0B\uFF0815 \u79D2\u8D85\u65F6\uFF09\u2026",
    daemonUp: "\u5B88\u62A4\u8FDB\u7A0B\u5DF2\u542F\u52A8",
    daemonTimeout: "\u5B88\u62A4\u8FDB\u7A0B\u672A\u5728\u89C4\u5B9A\u65F6\u95F4\u5185\u542F\u52A8 \u2014 \u8BF7\u624B\u52A8\u68C0\u67E5 ollama serve",
    pullingModel: "\u6B63\u5728\u62C9\u53D6 {model} \u2014 \u9996\u6B21\u5B89\u88C5\u53EF\u80FD\u9700\u8981\u51E0\u5206\u949F",
    savedConfig: "\u5DF2\u4FDD\u5B58 \xB7 {count} \u4E2A\u5B57\u6BB5\u5DF2\u66F4\u65B0 \xB7 \u91CD\u65B0\u8FD0\u884C\u7D22\u5F15\u4EE5\u5E94\u7528",
    runningPreview: "\u6B63\u5728\u5BF9\u9879\u76EE\u6839\u76EE\u5F55\u6267\u884C\u5E72\u8FD0\u884C\u2026",
    exclude: "\u6392\u9664"
  },
  modal: {
    shellTitle: "Shell \u547D\u4EE4",
    shellBgTitle: "\u540E\u53F0\u8FDB\u7A0B",
    shellSubtitle: "\u6A21\u578B\u60F3\u8981\u8FD0\u884C\u4E00\u6761 Shell \u547D\u4EE4",
    shellBgSubtitle: "\u957F\u65F6\u95F4\u8FD0\u884C \u2014 \u6279\u51C6\u540E\u7EE7\u7EED\u8FD0\u884C",
    runOnce: "\u8FD0\u884C\u4E00\u6B21",
    alwaysAllow: '\u59CB\u7EC8\u5141\u8BB8 "{prefix}"',
    deny: "\u62D2\u7EDD",
    choiceTitle: "\u6A21\u578B\u9700\u8981\u60A8\u9009\u62E9",
    typeOwn: "\u8F93\u5165\u81EA\u5B9A\u4E49\u56DE\u7B54",
    typeOwnSummary: "\u4EE5\u4E0A\u9009\u9879\u90FD\u4E0D\u5408\u9002 \u2014 \u5199\u4E00\u4E2A\u81EA\u7531\u683C\u5F0F\u7684\u56DE\u590D\u3002",
    typePlaceholder: "\u8F93\u5165\u81EA\u7531\u683C\u5F0F\u7684\u56DE\u7B54\u2026",
    send: "\u53D1\u9001",
    cancel: "\u53D6\u6D88",
    cancelSummary: "\u653E\u5F03\u6B64\u95EE\u9898\u3002\u6A21\u578B\u5C06\u8BE2\u95EE\u60A8\u5B9E\u9645\u60F3\u8981\u4EC0\u4E48\u3002",
    planTitle: "\u8BA1\u5212\u5DF2\u63D0\u4EA4",
    planSubtitle: "\u6A21\u578B\u63D0\u51FA\u4E86\u4E00\u9879\u8BA1\u5212\uFF1B\u8BF7\u5BA1\u9605\u540E\u9009\u62E9",
    approveInstructions: "\u53EF\u9009\u7684\u6700\u540E\u6307\u793A / \u5BF9\u5F00\u653E\u95EE\u9898\u7684\u56DE\u7B54\uFF08Enter \u53D1\u9001\u7A7A\u767D\uFF09",
    refinePlaceholder: "\u9700\u8981\u66F4\u6539\u4EC0\u4E48\uFF1F\u8BF7\u5177\u4F53\u8BF4\u660E\u3002",
    approve: "\u6279\u51C6",
    refine: "\u4F18\u5316",
    sendRefinement: "\u53D1\u9001\u4F18\u5316",
    editTitle: "\u7F16\u8F91\u5F85\u5BA1\u9605",
    editSubtitle: "{path} \xB7 {remaining} / {total} \u4E2A\u5757\u5269\u4F59",
    before: "\u4FEE\u6539\u524D",
    after: "\u4FEE\u6539\u540E",
    workspaceTitle: "\u6A21\u578B\u60F3\u8981\u5207\u6362\u5DE5\u4F5C\u533A",
    workspaceSubtitle: "\u540E\u7EED\u6240\u6709\u6587\u4EF6 / Shell / \u8BB0\u5FC6\u5DE5\u5177\u5C06\u9488\u5BF9\u65B0\u6839\u76EE\u5F55\u89E3\u6790",
    switchBtn: "\u5207\u6362 (Enter)",
    denyBtn: "\u62D2\u7EDD (Esc)",
    stepComplete: "\u6B65\u9AA4\u5B8C\u6210{counter}",
    continueBtn: "\u7EE7\u7EED",
    reviseBtn: "\u4FEE\u8BA2\u2026",
    stopBtn: "\u505C\u6B62",
    revisionTitle: "\u6A21\u578B\u63D0\u51FA\u4E86\u8BA1\u5212\u4FEE\u8BA2",
    sendRevision: "\u53D1\u9001\u4FEE\u8BA2",
    accept: "\u63A5\u53D7",
    reject: "\u62D2\u7EDD",
    arguments: "\u53C2\u6570",
    revisePlaceholder: "\u4E0B\u4E00\u6B65\u4E4B\u524D\u9700\u8981\u66F4\u6539\u4EC0\u4E48\uFF1F\u7559\u7A7A\u5219\u76F4\u63A5\u7EE7\u7EED\u3002",
    pickerFilter: "\u8FC7\u6EE4\u2026",
    pickerEmpty: "\u6682\u65E0\u5185\u5BB9\u3002",
    pickerLoadMore: "\u52A0\u8F7D\u66F4\u591A",
    pickerPick: "\u6253\u5F00",
    pickerInstall: "\u5B89\u88C5",
    pickerUninstall: "\u5378\u8F7D",
    pickerRename: "\u91CD\u547D\u540D\u2026",
    pickerNew: "\u65B0\u5EFA\u2026",
    pickerNewPlaceholder: "\u540D\u79F0\uFF08\u7559\u7A7A\u4F7F\u7528\u9ED8\u8BA4\uFF09",
    viewerClose: "\u5173\u95ED"
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
var A3 = "undefined" != typeof Symbol && Symbol.for && /* @__PURE__ */ Symbol.for("react.forward_ref") || 3911;
var O2 = l.__e;
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
var q3 = "undefined" != typeof Symbol && Symbol.for && /* @__PURE__ */ Symbol.for("react.element") || 60103;
var G2 = /^(?:accent|alignment|arabic|baseline|cap|clip(?!PathU)|color|dominant|fill|flood|font|glyph(?!R)|horiz|image(!S)|letter|lighting|marker(?!H|W|U)|overline|paint|pointer|shape|stop|strikethrough|stroke|text(?!L)|transform|underline|unicode|units|v|vector|vert|word|writing|x(?!C))[A-Z]/;
var J2 = /^on(Ani|Tra|Tou|BeforeInp|Compo)/;
var K2 = /[A-Z0-9]/g;
var Q2 = "undefined" != typeof document;
var X2 = function(n3) {
  return ("undefined" != typeof Symbol && "symbol" == typeof /* @__PURE__ */ Symbol() ? /fil|che|rad/ : /fil|che|ra/).test(n3);
};
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
var rn;
var un = { configurable: true, get: function() {
  return this.class;
} };
var on = l.vnode;
l.vnode = function(n3) {
  "string" == typeof n3.type && (function(n4) {
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
  })(n3), n3.$$typeof = q3, on && on(n3);
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

// node_modules/marked/lib/marked.esm.js
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
function findClosingBracket(str, b2) {
  if (str.indexOf(b2[1]) === -1) {
    return -1;
  }
  let level = 0;
  for (let i3 = 0; i3 < str.length; i3++) {
    if (str[i3] === "\\") {
      i3++;
    } else if (str[i3] === b2[0]) {
      level++;
    } else if (str[i3] === b2[1]) {
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
  options;
  rules;
  // set by the lexer
  lexer;
  // set by the lexer
  constructor(options2) {
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
  tokens;
  options;
  state;
  tokenizer;
  inlineQueue;
  constructor(options2) {
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
  options;
  parser;
  // set by the parser
  constructor(options2) {
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
      for (let k3 = 0; k3 < row.length; k3++) {
        cell += this.tablecell(row[k3]);
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
  options;
  renderer;
  textRenderer;
  constructor(options2) {
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
var _Hooks = class {
  options;
  block;
  constructor(options2) {
    this.options = options2 || _defaults;
  }
  static passThroughHooks = /* @__PURE__ */ new Set([
    "preprocess",
    "postprocess",
    "processAllTokens"
  ]);
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
};
var Marked = class {
  defaults = _getDefaults();
  options = this.setOptions;
  parse = this.parseMarkdown(true);
  parseInline = this.parseMarkdown(false);
  Parser = _Parser;
  Renderer = _Renderer;
  TextRenderer = _TextRenderer;
  Lexer = _Lexer;
  Tokenizer = _Tokenizer;
  Hooks = _Hooks;
  constructor(...args) {
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
var parser = _Parser.parse;
var lexer = _Lexer.lex;

// dashboard/src/lib/html.ts
var html4 = htm_module_default.bind(k);

// node_modules/highlight.js/es/common.js
var import_common = __toESM(require_common(), 1);
var common_default = import_common.default;

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
  const header = file ? `<span class="diff-line hunk">\u25B8 edit ${escapeHtml(file)}</span>
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
  const sr = SEARCH_REPLACE_RE.exec(codeText);
  if (sr) {
    const [, search = "", replace = ""] = sr;
    const file = typeof lang === "string" && lang.startsWith("edit:") ? lang.slice(5) : "";
    return renderSearchReplace(search, replace, file);
  }
  if (lang === "diff") return renderUnifiedDiff(codeText);
  if (lang && typeof lang === "string" && common_default.getLanguage(lang)) {
    try {
      const h3 = common_default.highlight(codeText, { language: lang, ignoreIllegals: true }).value;
      return `<pre><code class="hljs language-${lang}">${h3}</code></pre>`;
    } catch {
    }
  }
  try {
    const auto = common_default.highlightAuto(codeText);
    return `<pre><code class="hljs">${auto.value}</code></pre>`;
  } catch {
    return `<pre><code>${escapeHtml(codeText)}</code></pre>`;
  }
};
marked.use({ renderer, gfm: true, breaks: false, pedantic: false });
function renderMarkdownToString(text) {
  return marked.parse(text);
}
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
var ROLE_AVATAR = {
  user: "/assets/128x128.png",
  assistant: "/assets/ai-avatar.png"
};
function renderMessageBody(text) {
  if (!text) return null;
  return html4`<div class="md" dangerouslySetInnerHTML=${{ __html: renderMarkdownToString(text) }}></div>`;
}
function parseToolArgs(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
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
        <div dangerouslySetInnerHTML=${{ __html: renderHighlightedBlock(args.content, lang) }}></div>
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
        <div dangerouslySetInnerHTML=${{ __html: renderHighlightedBlock(msg.text ?? "", lang) }}></div>
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
        ${msg.text ? html4`<pre class="tool-card-output">${msg.text}</pre>` : null}
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
        <pre class="tool-card-output">${msg.text}</pre>
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
      <pre class="tool-card-output">${msg.text}</pre>
    </div>
  `;
}
var ChatMessage = N2(function ChatMessage2({ msg, streaming }) {
  const role = msg.role;
  const avatar = ROLE_AVATAR[role];
  if (role === "tool") {
    return html4`
      <div class="chat-msg tool">
        <div class="glyph">▣</div>
        <${ToolCard} msg=${msg} />
      </div>
    `;
  }
  return html4`
    <div class="chat-msg ${role}">
      ${avatar ? html4`<img class="avatar" src=${avatar} width="28" height="28" alt="" />`
                : html4`<div class="glyph">·</div>`}
      <div class="body">
        ${msg.reasoning ? html4`<div class="reasoning">${msg.reasoning}</div>` : null}
        ${renderMessageBody(msg.text)}
        ${streaming ? html4`<span class="chat-streaming-cursor"></span>` : null}
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
      icon=${isBg ? "\u23F1" : "\u26A1"}
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
  return html4`
    <${ModalCard} accent="#f0abfc" icon="🔀" title=${t4("modal.choiceTitle")} subtitle=${modal.question}>
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
  const [stage, setStage] = d2(null);
  const send = () => onResolve("plan", stage, feedback);
  return html4`
    <${ModalCard} accent="#67e8f9" icon="◆" title=${t4("modal.planTitle")} subtitle=${t4("modal.planSubtitle")}>
      <div class="md modal-plan-body" dangerouslySetInnerHTML=${{ __html: marked.parse(modal.body || "") }}></div>
      ${stage ? html4`
          <textarea
            placeholder=${stage === "approve" ? t4("modal.approveInstructions") : t4("modal.refinePlaceholder")}
            rows="3"
            value=${feedback}
            onInput=${(e3) => setFeedback(e3.target.value)}
          ></textarea>
          <div class="modal-actions">
            <button class="primary" onClick=${send}>${stage === "approve" ? t4("modal.approve") : t4("modal.sendRefinement")}</button>
            <button onClick=${() => {
    setStage(null);
    setFeedback("");
  }}>${t4("common.back")}</button>
          </div>
        ` : html4`
          <div class="modal-actions">
            <button class="primary" onClick=${() => setStage("approve")}>${t4("modal.approve")}</button>
            <button onClick=${() => setStage("refine")}>${t4("modal.refine")}</button>
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
  let k3 = 0;
  while (k3 < diff.length) {
    const entry = diff[k3];
    if (entry.kind === "context") {
      rows.push({ left: entry.text, right: entry.text, kind: "context" });
      k3++;
      continue;
    }
    const dels = [];
    const inss = [];
    while (k3 < diff.length && diff[k3].kind === "del") {
      dels.push(diff[k3].text);
      k3++;
    }
    while (k3 < diff.length && diff[k3].kind === "ins") {
      inss.push(diff[k3].text);
      k3++;
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
        <button onClick=${() => onResolve("edit-review", "flip-to-auto")}>${t4("chat.flipAutoBtn")}</button>
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
  const label = modal.title ? `${modal.stepId} \xB7 ${modal.title}` : modal.stepId;
  const counter = (modal.total ?? 0) > 0 ? ` (${modal.completed}/${modal.total})` : "";
  return html4`
    <${ModalCard}
      accent="#a5f3fc"
      icon="✓"
      title=${t4("modal.stepComplete", { counter })}
      subtitle=${label}
    >
      ${staged ? html4`
          <textarea
            placeholder=${t4("modal.revisePlaceholder")}
            rows="3"
            value=${reviseText}
            onInput=${(e3) => setReviseText(e3.target.value)}
          ></textarea>
          <div class="modal-actions">
            <button class="primary" onClick=${() => onResolve("checkpoint", "revise", reviseText)}>${t4("modal.sendRevision")}</button>
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
                    <span class="modal-viewer-step-mark">${s3.status === "done" ? "\u2713" : "\xB7"}</span>
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
  if (n3 === null || n3 === void 0) return "\u2014";
  if (n3 === 0) return "$0";
  return `$${n3.toFixed(n3 < 0.01 ? 6 : 4)}`;
}
var USD_TO_CNY = 7.2;
function fmtCost(usd, currency, fractionDigits) {
  if (usd === null || usd === void 0) return "\u2014";
  const cur = currency ?? "CNY";
  const amount = cur === "CNY" ? usd * USD_TO_CNY : usd;
  if (amount === 0) return cur === "CNY" ? "\xA50" : "$0";
  const sym = cur === "CNY" ? "\xA5" : cur === "USD" ? "$" : `${cur} `;
  const digits = fractionDigits ?? (Math.abs(amount) < 0.01 ? 6 : 4);
  return `${sym}${amount.toFixed(digits)}`;
}
function fmtPct(n3) {
  if (n3 === null || n3 === void 0) return "\u2014";
  return `${(n3 * 100).toFixed(1)}%`;
}
function fmtNum(n3) {
  if (n3 === null || n3 === void 0) return "\u2014";
  return n3.toLocaleString();
}
function fmtBytes(n3) {
  if (n3 === null || n3 === void 0) return "\u2014";
  if (n3 < 1024) return `${n3} B`;
  if (n3 < 1024 * 1024) return `${(n3 / 1024).toFixed(1)} KB`;
  if (n3 < 1024 * 1024 * 1024) return `${(n3 / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n3 / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
function fmtCompactNum(n3) {
  if (n3 === null || n3 === void 0) return "\u2014";
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
  if (!iso) return "\u2014";
  const ms = typeof iso === "number" ? iso : Date.parse(iso);
  if (!Number.isFinite(ms)) return "\u2014";
  const dSec = (Date.now() - ms) / 1e3;
  if (dSec < 60) return "just now";
  if (dSec < 3600) return `${Math.floor(dSec / 60)}m ago`;
  if (dSec < 86400) return `${Math.floor(dSec / 3600)}h ago`;
  if (dSec < 30 * 86400) return `${Math.floor(dSec / 86400)}d ago`;
  return new Date(ms).toISOString().slice(0, 10);
}

// dashboard/src/panels/chat.ts
function ChatPanel() {
  useLang();
  const [messages, setMessages] = d2([]);
  const [streaming, setStreaming] = d2(null);
  const [activeTool, setActiveTool] = d2(null);
  const [busy, setBusy] = d2(false);
  const [input, setInput] = d2("");
  const [error, setError] = d2(null);
  const [bootError, setBootError] = d2(null);
  const [statusLine, setStatusLine] = d2(null);
  const [modal, setModal] = d2(null);
  const [editMode, setEditModeLocal] = d2(null);
  const [preset, setPresetLocal] = d2(null);
  const [effort, setEffortLocal] = d2(null);
  const [stats, setStats] = d2(null);
  const [overviewModel, setOverviewModel] = d2(null);
  const [budgetUsd, setBudgetUsd] = d2(null);
  const [activePlan, setActivePlan] = d2(null);
  const [semanticIndex, setSemanticIndex] = d2(null);
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
  const [recentWss, setRecentWss] = d2(() => { try { return JSON.parse(localStorage.getItem("visionox-workspaces") || "[]"); } catch { return []; } });
  const [showWsPicker, setShowWsPicker] = d2(false);
  const [showSkillPicker, setShowSkillPicker] = d2(false);
  const [skillList, setSkillList] = d2([]);
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
  y2(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api("/messages");
        if (cancelled) return;
        setMessages(data.messages ?? []);
        setBusy(Boolean(data.busy));
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
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const streamBufRef = A2(null);
  const streamRafRef = A2(null);
  const flushStreaming = q2(() => {
    streamRafRef.current = null;
    if (streamBufRef.current) setStreaming(streamBufRef.current);
  }, []);
  const cancelStreamingRaf = q2(() => {
    if (streamRafRef.current !== null) {
      cancelAnimationFrame(streamRafRef.current);
      streamRafRef.current = null;
    }
    streamBufRef.current = null;
  }, []);
  const refetchCanonicalState = q2(async () => {
    try {
      const data = await api("/messages");
      setMessages(data.messages ?? []);
      setBusy(Boolean(data.busy));
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
  }, [cancelStreamingRaf]);
  y2(() => {
    const es = new EventSource(`/api/events?token=${TOKEN}`);
    let firstOpen = true;
    es.onopen = () => {
      if (firstOpen) {
        firstOpen = false;
        return;
      }
      void refetchCanonicalState();
    };
    es.onmessage = (ev) => {
      let dash;
      try {
        dash = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (dash.kind === "ping") return;
      if (dash.kind === "busy-change") {
        setBusy(dash.busy);
        return;
      }
      if (dash.kind === "user") {
        setMessages((prev) => [...prev, { id: dash.id, role: "user", text: dash.text }]);
        return;
      }
      if (dash.kind === "assistant_delta") {
        const cur = streamBufRef.current;
        const baseId = cur?.id === dash.id ? cur : null;
        streamBufRef.current = {
          id: dash.id,
          text: (baseId?.text ?? "") + (dash.contentDelta ?? ""),
          reasoning: (baseId?.reasoning ?? "") + (dash.reasoningDelta ?? "")
        };
        if (streamRafRef.current === null) {
          streamRafRef.current = requestAnimationFrame(flushStreaming);
        }
        return;
      }
      if (dash.kind === "assistant_final") {
        cancelStreamingRaf();
        setStreaming(null);
        setMessages((prev) => [
          ...prev,
          {
            id: dash.id,
            role: "assistant",
            text: dash.text,
            reasoning: dash.reasoning
          }
        ]);
        return;
      }
      if (dash.kind === "tool_start") {
        setActiveTool({ id: dash.id, toolName: dash.toolName, args: dash.args });
        return;
      }
      if (dash.kind === "tool") {
        setActiveTool((cur) => cur && cur.id === dash.id ? null : cur);
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
        return;
      }
      if (dash.kind === "warning" || dash.kind === "error" || dash.kind === "info") {
        if (dash.kind === "error") {
          setActiveTool(null);
        }
        setMessages((prev) => [...prev, { id: dash.id, role: dash.kind, text: dash.text }]);
        return;
      }
      if (dash.kind === "status") {
        setStatusLine(dash.text);
        setTimeout(() => setStatusLine((cur) => cur === dash.text ? null : cur), 5e3);
        return;
      }
      if (dash.kind === "messages-reset") {
        setMessages(dash.messages.map((m) => ({
          id: m.id || `hist-${Math.random()}`,
          role: m.role,
          text: m.text || ""
        })));
        return;
      }
      if (dash.kind === "modal-up") {
        setModal(dash.modal);
        return;
      }
      if (dash.kind === "modal-down") {
        setModal((cur) => cur && cur.kind === dash.modalKind ? null : cur);
        return;
      }
    };
    es.onerror = () => {
      setError(t4("chat.eventStreamError"));
      setTimeout(() => setError(null), 3e3);
    };
    return () => {
      es.close();
      cancelStreamingRaf();
    };
  }, [refetchCanonicalState, cancelStreamingRaf]);
  const send = q2(async () => {
    const text = input.trim();
    if (!text || busy) return;
    setError(null);
    try {
      const res = await api("/submit", {
        method: "POST",
        body: { prompt: text }
      });
      if (!res.accepted) {
        setError(res.reason ?? "rejected");
        return;
      }
      setInput("");
    } catch (err) {
      setError(err.message);
    }
  }, [input, busy]);
  const abort = q2(async () => {
    try {
      await api("/abort", { method: "POST" });
    } catch (err) {
      setError(err.message);
    }
  }, []);
  const newConversation = q2(async () => {
    if (busy) {
      if (!confirm(t4("chat.newConfirmBusy"))) return;
    } else if (messages.length > 0 && !confirm(t4("chat.newConfirm"))) {
      return;
    }
    try {
      await api("/submit", { method: "POST", body: { prompt: "/new" } });
      setMessages([]);
      setStreaming(null);
      setActiveTool(null);
      showToast(t4("chat.newToast"), "info");
      setTimeout(async () => {
        try {
          const r3 = await api("/messages");
          setMessages(r3.messages ?? []);
        } catch {
        }
      }, 200);
    } catch (err) {
      setError(t4("chat.newFailed", { error: err.message }));
    }
  }, [busy, messages.length]);
  const clearScrollback = q2(async () => {
    try {
      await api("/submit", { method: "POST", body: { prompt: "/clear" } });
      setMessages([]);
      setStreaming(null);
      setActiveTool(null);
      showToast(t4("chat.clearToast"), "info");
      setTimeout(async () => {
        try {
          const r3 = await api("/messages");
          setMessages(r3.messages ?? []);
        } catch {
        }
      }, 200);
    } catch (err) {
      setError(t4("chat.clearFailed", { error: err.message }));
    }
  }, []);
  const updatePopover = q2(
    async (text) => {
      const slashMatch = /^\/([A-Za-z0-9_-]*)$/.exec(text);
      if (slashMatch) {
        const prefix = slashMatch[1].toLowerCase();
        const items = slashCommands.filter((c3) => c3.cmd.startsWith(prefix)).slice(0, 12).map((c3) => ({
          label: `/${c3.cmd}`,
          meta: c3.summary,
          insert: `/${c3.cmd}${c3.argsHint ? " " : ""}`
        }));
        setPopoverKind("slash");
        setPopoverItems(items);
        setPopoverSel(0);
        return;
      }
      const mentionMatch = /(?:^|\s)@([^\s@]*)$/.exec(text);
      if (mentionMatch && MODE === "attached") {
        const prefix = mentionMatch[1] ?? "";
        try {
          const r3 = await api("/files", {
            method: "POST",
            body: { prefix }
          });
          const items = r3.files.slice(0, 12).map((f3) => ({
            label: f3,
            insert: `@${f3} `
          }));
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
    [slashCommands]
  );
  const applyPopover = q2(() => {
    const item = popoverItems[popoverSel];
    if (!item) return false;
    if (popoverKind === "slash") {
      setInput(item.insert);
    } else if (popoverKind === "mention") {
      const m3 = /(?:^|\s)@([^\s@]*)$/.exec(input);
      if (!m3) return false;
      const start = input.length - m3[0].length + (m3[0].startsWith(" ") ? 1 : 0);
      setInput(`${input.slice(0, start)}${item.insert}`);
    }
    setPopoverKind(null);
    return true;
  }, [popoverItems, popoverSel, popoverKind, input]);
  const onInput = q2(
    (e3) => {
      const v3 = e3.target.value;
      setInput(v3);
      updatePopover(v3);
    },
    [updatePopover]
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
  if (bootError) {
    return html4`<div class="notice err">${t4("common.loadingFailed", { name: "chat", error: bootError })}</div>`;
  }
  const autoScrollInFlight = A2(false);
  y2(() => {
    const el = feedRef.current;
    if (!el) return;
    const onScroll = () => {
      if (autoScrollInFlight.current) return;
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      shouldAutoScroll.current = distFromBottom < 80;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);
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
    try {
      await api("/modal/resolve", {
        method: "POST",
        body: text !== void 0 ? { kind, choice, text } : { kind, choice }
      });
    } catch (err) {
      setError(`modal resolve failed: ${err.message}`);
    }
  }, []);
  y2(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const o3 = await api("/overview");
        if (cancelled) return;
        setEditModeLocal(o3.editMode ?? null);
        setPresetLocal(o3.preset ?? null);
        setEffortLocal(o3.reasoningEffort ?? null);
        setWorkspaceDirLocal(o3.cwd ?? null);
        setStats(o3.stats ?? null);
        setOverviewModel(o3.model ?? null);
        setBudgetUsd(o3.budgetUsd ?? null);
        const recent = o3.cockpit?.recentPlans ?? [];
        setActivePlan(recent.find((p3) => p3.status === "active") ?? null);
        setSemanticIndex(o3.semanticIndexExists ?? null);
      } catch {
      }
    };
    tick();
    const t5 = setInterval(tick, 5e3);
    return () => {
      cancelled = true;
      clearInterval(t5);
    };
  }, []);
  const setEditMode = q2(async (next) => {
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
    if (key === "preset") setPresetLocal(value);
    if (key === "reasoningEffort") setEffortLocal(value);
    try {
      await api("/settings", { method: "POST", body: { [key]: value } });
    } catch (err) {
      setError(`${key} switch failed: ${err.message}`);
      try {
        const o3 = await api("/overview");
        setPresetLocal(o3.preset ?? null);
        setEffortLocal(o3.reasoningEffort ?? null);
      } catch {
      }
    }
  }, []);
  const pickWorkspace = q2(async (dir) => {
    setShowWsPicker(false);
    try {
      await api("/settings", { method: "POST", body: { workspaceDir: dir } });
      setWorkspaceDirLocal(dir);
      const updated = [dir, ...recentWss.filter((w2) => w2 !== dir)].slice(0, 5);
      setRecentWss(updated);
      try { localStorage.setItem("visionox-workspaces", JSON.stringify(updated)); } catch {}
      showToast("工作空间已设为 " + dir + "（新对话后生效）", "info");
    } catch (err) {
      setError(err.message);
    }
  }, [recentWss]);
  return html4`
    <div class="chat-shell">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
        <div class="chips" style="padding:0">
          <span class="chip-f static active">${MODE === "attached" ? t4("chat.modeMirror") : t4("chat.modeView")}</span>
        </div>
        <div class="header-pickers" style="margin-left:auto">
          ${effort ? html4`
              <div class="mode-picker" title=${t4("chat.effortTitle")}>
                ${["high", "max"].map(
    (e3) => html4`
                  <button
                    key=${e3}
                    class="mode-btn ${effort === e3 ? "active accent" : ""}"
                    onClick=${() => setSetting("reasoningEffort", e3)}
                    title=${e3 === "max" ? t4("chat.effortMaxTitle") : t4("chat.effortHighTitle")}
                  >${e3}</button>
                `
  )}
              </div>
            ` : null}
          ${preset ? html4`
              <div class="mode-picker" title=${t4("chat.presetTitle")}>
                ${(() => {
    const KNOWN = ["auto", "flash", "pro"];
    const canonical = KNOWN.includes(preset) ? preset : "auto";
    return ["auto", "flash", "pro"].map(
      (p3) => html4`
                      <button
                        key=${p3}
                        class="mode-btn ${canonical === p3 ? "active accent" : ""}"
                        onClick=${() => setSetting("preset", p3)}
                        title=${p3 === "auto" ? t4("chat.presetAutoTitle") : p3 === "flash" ? t4("chat.presetFlashTitle") : t4("chat.presetProTitle")}
                      >${p3}</button>
                    `
    );
  })()}
              </div>
            ` : null}
          ${editMode ? html4`
              <div class="mode-picker" title=${t4("chat.editGateTitle")}>
                ${["review", "auto", "yolo", "admin"].map(
    (m3) => html4`
                  <button
                    key=${m3}
                    class="mode-btn ${editMode === m3 ? "active" : ""} ${m3 === "review" ? "review" : ""} ${m3 === "auto" ? "auto" : ""} ${m3 === "yolo" ? "yolo" : ""} ${m3 === "admin" ? "admin" : ""}"
                    onClick=${() => setEditMode(m3)}
                    title=${m3 === "review" ? t4("chat.editReviewTitle") : m3 === "auto" ? t4("chat.editAutoTitle") : m3 === "yolo" ? t4("chat.editYoloTitle") : t4("chat.editAdminTitle")}
                  >${m3}</button>
                `
  )}
              </div>
            ` : null}
        </div>
      </div>

      ${!busy && statusLine ? html4`<div class="chat-status"><span class="muted">${statusLine}</span></div>` : null}
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

      ${modal ? modal.kind === "shell" ? html4`<${ShellModal} modal=${modal} onResolve=${resolveModal} />` : modal.kind === "choice" ? html4`<${ChoiceModal} modal=${modal} onResolve=${resolveModal} />` : modal.kind === "plan" ? html4`<${PlanModal} modal=${modal} onResolve=${resolveModal} />` : modal.kind === "edit-review" ? html4`<${EditReviewModal} modal=${modal} onResolve=${resolveModal} />` : modal.kind === "workspace" ? html4`<${WorkspaceModal} modal=${modal} onResolve=${resolveModal} />` : modal.kind === "checkpoint" ? html4`<${CheckpointModal} modal=${modal} onResolve=${resolveModal} />` : modal.kind === "revision" ? html4`<${RevisionModal} modal=${modal} onResolve=${resolveModal} />` : modal.kind === "picker" ? html4`<${PickerModal} modal=${modal} onResolve=${resolveModal} />` : modal.kind === "viewer" ? html4`<${ViewerModal} modal=${modal} onResolve=${resolveModal} />` : null : null}

      <div class="chat-body">
        <div class="chat-main">
          <${ChatFeed} messages=${messages} streaming=${streaming} innerRef=${feedRef} />

          <div class="chat-input-area" style="position:relative;flex-direction:column;gap:2px;padding-top:6px">
            ${popoverKind && popoverItems.length > 0 ? html4`
                  <div class="popover" style="position:absolute;bottom:calc(100% + 6px);left:0;width:380px;max-height:280px;overflow-y:auto;z-index:10">
                    <div class="popover-h">${popoverKind === "slash" ? t4("chat.slashCommands") : t4("chat.projectFiles")}</div>
                    ${popoverItems.map(
    (it, i3) => html4`
                        <div
                          class=${`popover-row ${i3 === popoverSel ? "sel" : ""}`}
                          onMouseDown=${(e3) => {
      e3.preventDefault();
      setPopoverSel(i3);
      applyPopover();
    }}
                        >
                          <span class="g">${popoverKind === "slash" ? "/" : "@"}</span>
                          <span class="name">${it.label}</span>
                          ${it.meta ? html4`<span class="meta">${it.meta}</span>` : null}
                        </div>
                      `
  )}
                  </div>
                ` : null}
            <div style="flex:1;display:flex;flex-direction:column;gap:2px;min-width:0">
              <div style="display:flex;gap:6px;align-items:flex-end">
            <textarea
              placeholder=${busy ? t4("chat.placeholderBusy") : t4("chat.placeholder")}
              value=${input}
              onInput=${onInput}
              onKeyDown=${onKeyDown}
              onBlur=${() => setTimeout(() => setPopoverKind(null), 150)}
              disabled=${busy}
              style="flex:1"
              rows="4"
            ></textarea>
            <div style="display: flex; flex-direction: column; gap: 6px; align-self: stretch; justify-content: flex-end;">
              <button
                class="primary"
                onClick=${send}
                disabled=${busy || !input.trim()}
              >${t4("chat.send")}</button>
              <div style="display: flex; gap: 6px;">
                <button onClick=${newConversation} title=${t4("chat.newTitle")}>${t4("chat.new")}</button>
                <button onClick=${clearScrollback} title=${t4("chat.clearTitle")}>${t4("chat.clear")}</button>
              </div>
            </div>
              </div>
            <div style="display:flex;align-items:center;position:relative;flex-shrink:0;margin:0;gap:12px">
              <span class="composer-chip" style="font-size:11px;padding:2px 10px" onClick=${() => { setShowSkillPicker(!showSkillPicker); setShowWsPicker(false); if (!showSkillPicker) { api("/skills").then((r2) => setSkillList([...r2.global, ...r2.builtin])).catch(() => {}); } }}>🔧 技能</span>
              ${showSkillPicker && skillList.length > 0 ? html4`
                <div class="popover" style="position:absolute;bottom:100%;left:0;width:320px;max-height:260px;overflow-y:auto;z-index:10">
                  <div class="popover-h">选择技能</div>
                  ${skillList.map((s2) => html4`
                    <div class="popover-row" onMouseDown=${(e2) => { e2.preventDefault(); setInput((prev) => prev + '/' + s2.name + ' '); setShowSkillPicker(false); }}>
                      <span class="name">${s2.name}</span>
                      <span class="meta">${(s2.description || '').slice(0,40)}</span>
                    </div>
                  `)}
                </div>
              ` : null}
              <span class="composer-chip" style="font-size:11px;padding:2px 10px" onClick=${() => { setShowWsPicker(!showWsPicker); setShowSkillPicker(false); }}>💻 工作空间 ▼</span>
              ${showWsPicker ? html4`
                <div class="popover" style="position:absolute;bottom:100%;left:0;width:280px;max-height:220px;overflow-y:auto;z-index:10">
                  <div class="popover-h">选择工作空间</div>
                  <div class="popover-row" onMouseDown=${(e3) => { e3.preventDefault(); pickWorkspace("visionox-workspace"); }}><span class="name">🏠 默认沙箱</span></div>
                  ${recentWss.map((w3) => html4`
                    <div class="popover-row" onMouseDown=${(e4) => { e4.preventDefault(); pickWorkspace(w3); }}><span class="name">📁 ${w3}</span></div>
                  `)}
                  <div class="popover-row" onMouseDown=${(e5) => { e5.preventDefault(); const p2 = prompt('输入工作空间路径:'); if (p2 && p2.trim()) pickWorkspace(p2.trim()); }}><span class="name">📂 浏览其他目录...</span></div>
                </div>
              ` : null}
              ${(showSkillPicker || showWsPicker) ? html4`<div style="position:fixed;inset:0;z-index:5" onClick=${() => { setShowSkillPicker(false); setShowWsPicker(false); }}></div>` : null}
            </div>
              </div>
          </div>

          ${busy ? html4`<${InFlightRow}
                  streaming=${streaming}
                  activeTool=${activeTool}
                  startedAt=${turnStartedAt}
                  statusLine=${statusLine}
                  onAbort=${abort}
                  tick=${nowTick}
                />` : null}
          <${ChatStatusBar} stats=${stats} model=${overviewModel} />
        </div>
      </div>
    </div>
  `;
}
var ChatFeed = N2(function ChatFeed2({ messages, streaming, innerRef }) {
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
  return html4`
    <div class="chat-feed" ref=${innerRef}>
      ${allMessages.length === 0 ? html4`<div class="chat-empty">${t4("chat.noConversation")}</div>` : allMessages.map(
    (m3) => html4`
                <${ChatMessage}
                  key=${m3.id}
                  msg=${m3}
                  streaming=${Boolean(streaming && streaming.id === m3.id)}
                />
              `
  )}
    </div>
  `;
});
var SideRail = N2(function SideRail2({ stats, budgetUsd, activePlan }) {
  useLang();
  if (!stats && !activePlan) return html4`<aside class="chat-rail"></aside>`;
  const cachePct = stats ? stats.cacheHitRatio * 100 : 0;
  const cacheTone = cachePct >= 80 ? "ok" : cachePct >= 50 ? "" : "warn";
  const showBudget = stats != null && typeof budgetUsd === "number" && budgetUsd > 0;
  const budgetPct = showBudget ? Math.min(120, stats.totalCostUsd / budgetUsd * 100) : 0;
  const budgetTone2 = budgetPct >= 100 ? "err" : budgetPct >= 80 ? "warn" : "";
  const walletCurrency = stats?.balance?.[0]?.currency;
  return html4`
    <aside class="chat-rail">
      ${activePlan ? html4`<${ActivePlanCard} plan=${activePlan} />` : null}
      ${stats ? html4`
            <div class="rail-card">
              <div class="rh">${t4("chat.railSession")}</div>
              <div class="rail-kv"><span class="k">${t4("chat.railTurns")}</span><span class="v">${stats.turns.toLocaleString()}</span></div>
              <div class="rail-kv"><span class="k">${t4("chat.railPromptTok")}</span><span class="v">${stats.lastPromptTokens.toLocaleString()}</span></div>
              <div class="rail-kv"><span class="k">${t4("chat.railCost")}</span><span class="v">${fmtCost(stats.totalCostUsd, walletCurrency)}</span></div>
              <div class="progress-row" style="margin-top:8px">
                <span class="lbl">${t4("chat.railCacheHit")}</span>
                <div class=${`progress ${cacheTone}`}><div class="progress-fill" style=${`width:${cachePct}%`}></div></div>
                <span class="v">${cachePct.toFixed(1)}%</span>
              </div>
            </div>
          ` : null}
      ${showBudget ? html4`
            <div class="rail-card">
              <div class="rh">${t4("chat.railToolBudget")}</div>
              <div class="progress-row">
                <span class="lbl">${t4("chat.railSpend")}</span>
                <div class=${`progress ${budgetTone2}`}><div class="progress-fill" style=${`width:${Math.min(100, budgetPct)}%`}></div></div>
                <span class="v" style=${budgetTone2 === "err" ? "color:var(--c-err)" : budgetTone2 === "warn" ? "color:var(--c-warn)" : ""}>${fmtCost(stats.totalCostUsd, walletCurrency)} / ${fmtCost(budgetUsd, walletCurrency)}</span>
              </div>
            </div>
          ` : null}
    </aside>
  `;
});
function ActivePlanCard({ plan }) {
  useLang();
  const dots = [];
  for (let i3 = 0; i3 < plan.totalSteps; i3++) {
    const done = i3 < plan.completedSteps;
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
      <div class="rh">${t4("chat.railActivePlan")}</div>
      <div class="steps" style="margin-bottom:8px">${dots}</div>
      <div class="rail-kv"><span class="k" style="font-family:var(--font-sans);color:var(--fg-1);font-size:12.5px">${plan.title}</span></div>
      <div class="rail-kv"><span class="k">${t4("chat.railProgress")}</span><span class="v">${plan.completedSteps} / ${plan.totalSteps}</span></div>
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
    return `${name} \u2192 ${path}${len != null ? ` (${len.toLocaleString()} ch)` : ""}`;
  }
  if ((name === "edit_file" || name.endsWith("_edit_file")) && path) {
    return `${name} \u2192 ${path}`;
  }
  if ((name === "run_command" || name === "run_background") && typeof args?.command === "string") {
    const c3 = args.command;
    return `${name} \u2192 $ ${c3.length > 80 ? `${c3.slice(0, 80)}\u2026` : c3}`;
  }
  if ((name === "read_file" || name === "list_files" || name === "search_files") && path) {
    return `${name} \u2192 ${path}`;
  }
  if (path) return `${name} \u2192 ${path}`;
  return name;
}
function InFlightRow({
  streaming,
  activeTool,
  startedAt,
  statusLine,
  onAbort,
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
      <button class="chat-inflight-abort" onClick=${onAbort}>${t4("chat.abortBtn")}</button>
    </div>
  `;
}
var ChatStatusBar = N2(function ChatStatusBar2({ stats, model }) {
  useLang();
  if (!stats) {
    return html4`
      <div class="chat-statusbar">
        <span class="muted">${t4("chat.waitingStats")}</span>
      </div>
    `;
  }
  const ctxPct = stats.contextCapTokens > 0 ? stats.lastPromptTokens / stats.contextCapTokens * 100 : 0;
  const balance = stats.balance && stats.balance.length > 0 ? stats.balance[0] : null;
  return html4`
    <div class="chat-statusbar">
      <span class="status-item">
        <span class="status-label">${t4("chat.statusModel")}</span>
        <code>${model ?? "\u2014"}</code>
      </span>
      <span class="status-item">
        <span class="status-label">${t4("chat.statusCtx")}</span>
        <span class="status-bar-mini">
          <span class="status-bar-mini-fill" style=${`width: ${Math.min(100, ctxPct).toFixed(1)}%;`}></span>
        </span>
        <span class="muted">${stats.lastPromptTokens.toLocaleString()} / ${(stats.contextCapTokens / 1e3).toFixed(0)}K</span>
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
            <code>${balance.total_balance} ${balance.currency}</code>
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
                            ${c3.matcher ? html4`<span style="font-size:10px;color:var(--c-warn)">${c3.matcher}</span>` : "\u2713"}
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
                  <span class="ws">${open.serverInfo?.name ?? "\u2014"} ${open.serverInfo?.version ? `v${open.serverInfo.version}` : ""} · ${open.protocolVersion ?? "\u2014"}</span>
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
  const specPreview = entry.install ? `${entry.install.runtime} \xB7 ${entry.install.transport}${entry.install.packageId ? ` \xB7 ${entry.install.packageId}` : entry.install.url ? ` \xB7 ${entry.install.url}` : ""}${entry.install.version ? `@${entry.install.version}` : ""}` : "";
  const icon = entry.iconUrl ? html4`<img src=${entry.iconUrl} alt="" style="width:24px;height:24px;border-radius:4px;margin-right:8px;vertical-align:middle;object-fit:cover" loading="lazy" referrerpolicy="no-referrer" onError=${(ev) => ev.target.style.display = "none"} />` : null;
  return html4`
    <div class="sessions-detail-h">
      <span class="name">${icon}${entry.name}${installed ? html4` <span class="pill ok">${t4("mcp.marketplaceInstalledBadge")}</span>` : null}</span>
      <span class="ws">${t4("mcp.marketplaceSourceTag", { source: entry.source })}${entry.popularity !== void 0 ? ` \xB7 ${fmtNum(entry.popularity)} uses` : ""}${entry.homepage ? html4` · <a href=${entry.homepage} target="_blank" rel="noopener noreferrer">homepage</a>` : ""}</span>
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
      <div class="card-b" style="font-size:13px;line-height:1.6">${entry.description || "\u2014"}</div>
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
function MemoryPanel() {
  useLang();
  const [tree, setTree] = d2(null);
  const [error, setError] = d2(null);
  const [open, setOpen] = d2(null);
  const [body, setBody] = d2("");
  const [busy, setBusy] = d2(false);
  const [info, setInfo] = d2(null);
  const load = q2(async () => {
    try {
      setTree(await api("/memory"));
    } catch (err) {
      setError(err.message);
    }
  }, []);
  y2(() => {
    load();
  }, [load]);
  const openFile = q2(async (scope, name) => {
    setOpen({ scope, name });
    setBusy(true);
    try {
      const path = scope === "project" ? "/memory/project" : `/memory/${scope}/${encodeURIComponent(name ?? "")}`;
      const r3 = await api(path);
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
    setError(null);
    try {
      const path = open.scope === "project" ? "/memory/project" : `/memory/${open.scope}/${encodeURIComponent(open.name ?? "")}`;
      await api(path, { method: "POST", body: { body } });
      setInfo(t4("memory.saved", { scope: open.scope + (open.name ? `/${open.name}` : "") }));
      setTimeout(() => setInfo(null), 3e3);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [open, body, load]);
  if (!tree && !error)
    return html4`<div class="card" style="color:var(--fg-3)">${t4("memory.loading")}</div>`;
  if (error && !tree) return html4`<div class="card accent-err">${error}</div>`;
  if (!tree) return null;
  const fileRow = (scope, f3) => {
    const sel = open && open.scope === scope && open.name === f3.name;
    return html4`
      <div
        class=${`ssl-row ${sel ? "sel" : ""}`}
        onClick=${() => openFile(scope, f3.name)}
      >
        <span class="name">${f3.name}</span>
        <span class="meta">
          <span class="dim">${scope}</span>
          <span><span class="v">${fmtBytes(f3.size)}</span></span>
          <span>${fmtRelativeTime(f3.mtime)}</span>
        </span>
      </div>
    `;
  };
  const totalFiles = (tree.project.path ? 1 : 0) + tree.global.files.length + tree.projectMem.files.length;
  return html4`
    <div class="sessions-grid">
      <div class="sessions-list">
        <div class="ssl-h" style="font-family:var(--font-mono);font-size:11px;color:var(--fg-3);text-transform:uppercase;letter-spacing:.1em">
          ${t4("memory.files", { count: totalFiles })}
        </div>
        <div class="ssl-rows">
          ${tree.project.path ? html4`
                <div
                  class=${`ssl-row ${open?.scope === "project" ? "sel" : ""}`}
                  onClick=${() => openFile("project")}
                >
                  <span class="name">
                    visionox.md
                    ${tree.project.exists ? html4`<span class="pill ok">${t4("memory.exists")}</span>` : html4`<span class="pill">${t4("memory.create")}</span>`}
                  </span>
                  <span class="preview">${tree.project.path}</span>
                  <span class="meta"><span class="dim">project</span></span>
                </div>
              ` : null}
          ${tree.global.files.map((f3) => fileRow("global", f3))}
          ${tree.projectMem.files.map((f3) => fileRow("project-mem", f3))}
          ${tree.global.files.length === 0 && tree.projectMem.files.length === 0 && !tree.project.path ? html4`<div style="color:var(--fg-3);padding:14px;font-size:12px">
                  ${t4("memory.noFiles")}
                </div>` : null}
        </div>
      </div>

      <div class="sessions-detail">
        ${open == null ? html4`<div style="color:var(--fg-3);font-size:13px;text-align:center;padding:60px 20px">
                ${t4("memory.pickHint")}
                <div style="margin-top:12px;font-size:11.5px">
                  ${t4("memory.pickDesc")}
                </div>
              </div>` : html4`
                <div class="sessions-detail-h">
                  <span class="name">
                    ${open.scope}${open.name ? `/${open.name}` : ""}
                  </span>
                  <span class="ws">${t4("memory.chars", { count: body.length.toLocaleString() })}</span>
                  <span class="actions">
                    <button class="btn primary" disabled=${busy} onClick=${save}>${t4("common.save")}</button>
                    <button class="btn ghost" onClick=${() => setOpen(null)}>${t4("common.back")}</button>
                  </span>
                </div>
                ${info ? html4`<div style="margin-bottom:8px"><span class="pill ok">${info}</span></div>` : null}
                ${error ? html4`<div class="card accent-err" style="margin-bottom:8px">${error}</div>` : null}
                <textarea
                  style="width:100%;min-height:480px;background:var(--bg-input);color:var(--fg-0);border:1px solid var(--bd);border-radius:var(--r);padding:12px;font-family:var(--font-mono);font-size:13px;line-height:1.55;resize:vertical"
                  value=${body}
                  onInput=${(e3) => setBody(e3.target.value)}
                  disabled=${busy}
                ></textarea>
                <div style="margin-top:8px;color:var(--fg-3);font-size:11.5px">
                  ${t4("memory.reloadHint")}
                </div>
              `}
      </div>
    </div>
  `;
}

// dashboard/src/lib/budget.ts
function deriveBudgetState(cap, spent) {
  const safeSpent = typeof spent === "number" && spent >= 0 ? spent : 0;
  if (typeof cap !== "number" || cap <= 0) {
    return { kind: "off", spent: safeSpent };
  }
  const pct = safeSpent / cap * 100;
  if (pct >= 100) return { kind: "exhausted", cap, spent: safeSpent, pct };
  if (pct >= 80) return { kind: "warn", cap, spent: safeSpent, pct };
  return { kind: "running", cap, spent: safeSpent, pct };
}
var QUICK_CAPS_USD = [1, 5, 10, 25, 50];
function bumpSuggestions(currentCap) {
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
function budgetTone(state) {
  if (state.kind === "exhausted") return "err";
  if (state.kind === "warn") return "warn";
  return "";
}

// dashboard/src/lib/use-poll.ts
function usePoll(path, intervalMs = 2e3) {
  const [data, setData] = d2(null);
  const [error, setError] = d2(null);
  const [loading, setLoading] = d2(true);
  const refresh = q2(async () => {
    try {
      const next = await api(path);
      setData(next);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [path]);
  y2(() => {
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
      if (timer) clearTimeout(timer);
    };
  }, [refresh, intervalMs]);
  return { data, error, loading, refresh };
}

// dashboard/src/lib/version.ts
function compareVersions(a3, b2) {
  const [aCore = "0", aPre = ""] = a3.split("-", 2);
  const [bCore = "0", bPre = ""] = b2.split("-", 2);
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
function kpi(label, value, delta, deltaTone) {
  const muted = value === "\u2014" || value === null || value === void 0;
  return html4`
    <div class="kpi cock-w-1">
      <div class="label">${label}</div>
      <div class="value" style=${muted ? "color:var(--fg-4)" : ""}>${value ?? "\u2014"}</div>
      ${delta != null ? html4`<div class=${`delta ${deltaTone ?? ""}`}>${delta}</div>` : null}
    </div>
  `;
}
function deltaPctText(deltaPct) {
  if (deltaPct === null) return { text: t4("overview.noPriorData"), tone: "flat" };
  if (Math.abs(deltaPct) < 1) return { text: t4("overview.stable"), tone: "flat" };
  const arrow = deltaPct > 0 ? "\u25B2" : "\u25BC";
  return {
    text: t4("overview.vsPrior", { arrow, pct: Math.abs(deltaPct).toFixed(0) }),
    tone: deltaPct > 0 ? "up" : "down"
  };
}
function deltaPpText(deltaPp) {
  if (deltaPp === null) return { text: t4("overview.noPriorData"), tone: "flat" };
  if (Math.abs(deltaPp) < 0.5) return { text: t4("overview.stable"), tone: "flat" };
  const arrow = deltaPp > 0 ? "\u25B2" : "\u25BC";
  return { text: `${arrow} ${Math.abs(deltaPp).toFixed(1)}pp`, tone: deltaPp > 0 ? "up" : "down" };
}
function deltaCountText(delta) {
  if (delta === null || delta === 0) return { text: t4("overview.stable"), tone: "flat" };
  const arrow = delta > 0 ? "\u25B2" : "\u25BC";
  return { text: `${arrow} ${Math.abs(delta)}`, tone: delta > 0 ? "up" : "down" };
}
function balanceKpi(c3) {
  if (!c3.balance) return kpi(t4("overview.balance"), "\u2014", "open in TUI", "flat");
  const symbol = c3.balance.currency === "CNY" ? "\xA5" : c3.balance.currency === "USD" ? "$" : "";
  return kpi(t4("overview.balance"), `${symbol}${c3.balance.total}`, c3.balance.currency, "flat");
}
function budgetKpi(o3) {
  const state = deriveBudgetState(o3.budgetUsd, o3.cockpit?.currentSession?.totalCostUsd ?? null);
  if (state.kind === "off") return null;
  const tone = budgetTone(state);
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
  if (!c3.tokens7d) return kpi(t4("overview.tokens7d"), "\u2014", t4("overview.noUsageYet"), "flat");
  const d3 = deltaPctText(c3.tokens7d.deltaPct);
  return kpi(t4("overview.tokens7d"), fmtCompactNum(c3.tokens7d.total), d3.text, d3.tone);
}
function cacheHitKpi(c3) {
  if (!c3.cacheHit7d) return kpi(t4("overview.cacheHit"), "\u2014", t4("overview.noUsageYet"), "flat");
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
  if (!c3.toolCalls24h) return kpi(t4("overview.toolCalls24h"), "\u2014", t4("overview.noToolCalls"), "flat");
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
  const w3 = 400;
  const h3 = 60;
  const points2 = days2.map((d3, i3) => {
    const x3 = days2.length === 1 ? 0 : i3 * w3 / (days2.length - 1);
    const y3 = h3 - d3.usd / max2 * (h3 - 6) - 3;
    return `${x3.toFixed(0)},${y3.toFixed(0)}`;
  }).join(" ");
  const area = `${points2} ${w3},${h3} 0,${h3}`;
  const avg = total / days2.length;
  return html4`
    <div class="chart cock-w-2">
      <div class="chart-h"><span class="title">${t4("overview.costTrend")}</span></div>
      <div class="chart-v">${fmtCost(avg, c3.balance?.currency)}<span class="unit">${t4("overview.dayAvg")}</span></div>
      <div class="chart-spark">
        <svg viewBox=${`0 0 ${w3} ${h3}`} preserveAspectRatio="none">
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
                  <span class="g">${p3.status === "done" ? "\u2713" : "\u23F5"}</span>
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
                  <span class="g">${r3.level === "ok" ? "\u25CF" : r3.level === "warn" ? "\u25B2" : "\u2715"}</span>
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
  const { data, error, loading } = usePoll("/overview", 5e3);
  if (loading && !data)
    return html4`<div class="card" style="color:var(--fg-3)">${t4("overview.loading")}</div>`;
  if (error) return html4`<div class="card accent-err">${t4("overview.failed", { error: error.message })}</div>`;
  if (!data) return null;
  const o3 = data;
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
  const upToDate = o3.latestVersion && o3.version ? compareVersions(o3.version, o3.latestVersion) >= 0 : null;
  const versionDelta = upToDate === null ? t4("overview.checking") : upToDate ? t4("overview.latest") : `latest: ${o3.latestVersion}`;
  const versionTone = upToDate === false ? "down" : "flat";
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
        ${t4("overview.cockpit")}
      </h3>
      <div class="cockpit">
        <div class="cock-w-2" style="display:flex;flex-direction:column;gap:var(--space-4)">
          ${recentPlansRail(c3)}
          <div class="card">
            <div class="card-h"><span class="title">${t4("overview.projectRoot")}</span></div>
            <code class="mono" style="color:var(--fg-2);font-size:12px">${o3.cwd ?? "\u2014"}</code>
          </div>
        </div>
        ${toolActivityFeed(c3)}
      </div>
    </div>
  `;
}

// dashboard/src/panels/permissions.ts
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
              <span style="color:var(--fg-2)">${list2.join(" \xB7 ")}</span>
            </div>
          `
  )}
      </div>
    </div>
  `;
}

// dashboard/src/panels/plans.ts
function statusPill(p3) {
  if (p3.completionRatio >= 1) return html4`<span class="pill ok">${t4("plans.done")}</span>`;
  if (p3.completionRatio > 0) return html4`<span class="pill info">${t4("plans.active")}</span>`;
  return html4`<span class="pill">${t4("plans.idle")}</span>`;
}
function PlansPanel() {
  useLang();
  const { data, error, loading } = usePoll("/plans", 8e3);
  const [openIdx, setOpenIdx] = d2(null);
  const [filter, setFilter] = d2("");
  const [statusFilter, setStatusFilter] = d2("all");
  if (loading && !data)
    return html4`<div class="card" style="color:var(--fg-3)">${t4("plans.loading")}</div>`;
  if (error) return html4`<div class="card accent-err">${t4("common.loadingFailed", { name: "plans", error: error.message })}</div>`;
  const plans = data?.plans ?? [];
  if (plans.length === 0)
    return html4`<div class="card" style="color:var(--fg-3)">
      ${t4("plans.noPlans")}
    </div>`;
  const statusFiltered = statusFilter === "all" ? plans : statusFilter === "active" ? plans.filter((p3) => p3.completionRatio > 0 && p3.completionRatio < 1) : plans.filter((p3) => p3.completionRatio >= 1);
  const filtered = filter.trim() ? statusFiltered.filter(
    (p3) => p3.session.toLowerCase().includes(filter.toLowerCase()) || (p3.summary ?? "").toLowerCase().includes(filter.toLowerCase())
  ) : statusFiltered;
  const open = openIdx !== null ? plans[openIdx] : null;
  return html4`
    <div class="sessions-grid">
      <div class="sessions-list">
        <div class="ssl-h">
          <input
            type="text"
            placeholder=${t4("plans.filterPlaceholder")}
            value=${filter}
            onInput=${(e3) => setFilter(e3.target.value)}
            style="flex:1"
          />
        </div>
        <div class="chips" style="padding:0 12px 8px">
          <span
            class=${`chip-f ${statusFilter === "all" ? "active" : ""}`}
            onClick=${() => setStatusFilter("all")}
          >${t4("common.all")} <span class="ct">${plans.length}</span></span>
          <span
            class=${`chip-f ${statusFilter === "active" ? "active" : ""}`}
            onClick=${() => setStatusFilter("active")}
          >
            ${t4("plans.active")}
            <span class="ct">${plans.filter((p3) => p3.completionRatio > 0 && p3.completionRatio < 1).length}</span>
          </span>
          <span
            class=${`chip-f ${statusFilter === "done" ? "active" : ""}`}
            onClick=${() => setStatusFilter("done")}
          >
            ${t4("plans.done")} <span class="ct">${plans.filter((p3) => p3.completionRatio >= 1).length}</span>
          </span>
        </div>
        <div class="ssl-rows">
          ${filtered.map((p3) => {
    const idx = plans.indexOf(p3);
    const sel = idx === openIdx;
    return html4`
              <div class=${`ssl-row ${sel ? "sel" : ""}`} onClick=${() => setOpenIdx(idx)}>
                <span class="name">${p3.summary ?? p3.session} ${statusPill(p3)}</span>
                ${p3.summary && p3.session !== p3.summary ? html4`<span class="preview">${p3.session}</span>` : null}
                <span class="meta">
                  <span><span class="v">${p3.totalSteps}</span> ${t4("plans.steps")}</span>
                  <span><span class="v">${p3.completedSteps} / ${p3.totalSteps}</span> · ${fmtPct(p3.completionRatio)}</span>
                  <span>${fmtRelativeTime(p3.completedAt)}</span>
                </span>
              </div>
            `;
  })}
        </div>
      </div>

      <div class="sessions-detail">
        ${open == null ? html4`<div style="color:var(--fg-3);font-size:13px;text-align:center;padding:60px 20px">
                ${t4("plans.pickHint")}
              </div>` : html4`
                <div class="sessions-detail-h">
                  <span class="name">${open.summary ?? t4("plans.noTitle")}</span>
                  <span class="ws">${open.session} · ${fmtRelativeTime(open.completedAt)}</span>
                  <span class="actions">
                    <button class="btn ghost" onClick=${() => setOpenIdx(null)}>${t4("common.back")}</button>
                  </span>
                </div>

                <h3 style="margin:0 0 6px;font-family:var(--font-mono);font-size:11px;color:var(--fg-3);text-transform:uppercase;letter-spacing:.1em">
                  ${t4("plans.stepTimeline", { done: open.completedSteps, total: open.totalSteps })}
                </h3>
                <div class="plan-timeline" style="margin-bottom:14px">
                  ${open.steps.map((step, i3) => {
    const done = open.completedStepIds.includes(step.id);
    const cls = done ? "done" : i3 === open.completedSteps ? "active" : "";
    return html4`
                      <div class=${`plan-step ${cls}`}>
                        <span class="lbl">${t4("plans.step", { n: i3 + 1 })}</span>
                        <span class="name">${step.title}</span>
                        ${step.action ? html4`<span class="meta">${step.action}</span>` : null}
                        ${step.risk ? html4`<span
                                class=${`pill ${step.risk === "high" ? "err" : step.risk === "medium" ? "warn" : ""}`}
                                style="align-self:flex-start;margin-top:4px"
                              >${step.risk}</span>` : null}
                      </div>
                    `;
  })}
                </div>
              `}
      </div>
    </div>
  `;
}

// dashboard/src/panels/semantic.ts
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
                    placeholder="https://api.openai.com/v1/embeddings"
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
                    placeholder=${draft.openaiCompat.apiKeySet ? t4("semantic.keepExistingKey") : "sk-..."}
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
  \u2026(${lines.length - maxLines} more lines)`;
}
function toDraft(c3) {
  return {
    excludeDirs: c3.excludeDirs ?? [],
    excludeFiles: c3.excludeFiles ?? [],
    excludeExts: c3.excludeExts ?? [],
    excludePatterns: c3.excludePatterns ?? [],
    respectGitignore: c3.respectGitignore !== false,
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
        <span class=${`box ${draft.respectGitignore ? "on" : ""}`}>${draft.respectGitignore ? "\u2713" : ""}</span>
        <span>${t4("semantic.respectGitignore")}</span>
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
  const totalSkipped = Object.values(buckets).reduce((a3, b2) => a3 + (b2 || 0), 0);
  const reasons = [
    "gitignore",
    "pattern",
    "defaultDir",
    "defaultFile",
    "binaryExt",
    "binaryContent",
    "tooLarge",
    "readError"
  ].filter((k3) => (buckets[k3] || 0) > 0);
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
        <span class=${`pill ${job.phase === "error" ? "pill-err" : job.phase === "cancelled" ? "warn" : running ? "pill-active" : "pill-dim"}`}>${phaseSummary}</span>
        ${job.aborted && running ? html4`<span class="pill warn" style="margin-left: 6px;">${t4("semantic.stopping")}</span>` : null}
        <span style="color:var(--fg-3);margin-left:8px">${elapsed}</span>
      </div>
      ${job.filesScanned !== null && job.filesScanned !== void 0 ? html4`<div><span class="kv-key">${t4("semantic.files")}</span>${t4("semantic.scanned", { count: job.filesScanned })}${job.filesChanged != null ? ` \xB7 ${t4("semantic.changed", { count: job.filesChanged })}` : ""}${job.filesSkipped ? ` \xB7 ${t4("semantic.skipped", { count: job.filesSkipped })}` : ""}</div>` : null}
      ${total > 0 ? html4`
            <div>
              <span class="kv-key">${t4("semantic.chunks")}</span>${t4("semantic.chunksProgress", { done: doneN, total, pct: (ratio * 100).toFixed(0) })}
            </div>
            <div class="bar" style="margin-top: 4px;">
              <div class="fill" style=${`width: ${(ratio * 100).toFixed(1)}%; background: var(--primary);`}></div>
            </div>
          ` : null}
      ${job.error ? html4`<div><span class="kv-key">${t4("semantic.phaseError")}</span><span class="err">${job.error}</span></div>` : null}
      ${job.result ? html4`<div><span class="kv-key">${t4("semantic.result")}</span>${t4("semantic.added", { count: job.result.chunksAdded })} · ${t4("semantic.removed", { count: job.result.chunksRemoved })}${job.result.chunksSkipped ? ` \xB7 ${t4("semantic.failed", { count: job.result.chunksSkipped })}` : ""} · ${(job.result.durationMs / 1e3).toFixed(1)}s</div>` : null}
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
  const total = order.reduce((a3, [k3]) => a3 + (buckets[k3] || 0), 0);
  if (total === 0) return null;
  const parts = order.filter(([k3]) => (buckets[k3] || 0) > 0).map(([k3, label]) => `${label}: ${buckets[k3]}`);
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
function SessionsPanel() {
  useLang();
  const { data, error, loading } = usePoll("/sessions", 5e3);
  const [open, setOpen] = d2(null);
  const [openLoading, setOpenLoading] = d2(false);
  const [filter, setFilter] = d2("");
  const [deleting, setDeleting] = d2(false);
  const [resuming, setResuming] = d2(false);
  const view = q2(async (name) => {
    setOpen({ name, messages: null });
    setOpenLoading(true);
    try {
      const detail = await api(`/sessions/${encodeURIComponent(name)}`);
      setOpen({ name, messages: detail.messages });
    } catch (err) {
      setOpen({ name, messages: null, error: err.message });
    } finally {
      setOpenLoading(false);
    }
  }, []);
  const remove = q2(async (name) => {
    if (!confirm("删除此会话记录？此操作不可撤销。")) return;
    setDeleting(true);
    try {
      await api(`/sessions/${encodeURIComponent(name)}`, { method: "DELETE" });
      setOpen(null);
    } catch (err) {
      if (open) setOpen({ ...open, error: err.message });
    } finally {
      setDeleting(false);
    }
  }, [open]);
  const doResume = q2(async (name) => {
    setResuming(true);
    try {
      await api("/submit", { method: "POST", body: { prompt: "", session: name } });
      appBus.dispatchEvent(new CustomEvent("navigate-tab", { detail: { tabId: "chat" } }));
      setOpen(null);
    } catch (err) {
      if (open) setOpen({ ...open, error: err.message });
    } finally {
      setResuming(false);
    }
  }, [open]);
  if (loading && !data)
    return html4`<div class="card" style="color:var(--fg-3)">${t4("sessions.loading")}</div>`;
  if (error) return html4`<div class="card accent-err">${t4("common.loadingFailed", { name: "sessions", error: error.message })}</div>`;
  const sessions = data?.sessions ?? [];
  if (sessions.length === 0)
    return html4`<div class="card" style="color:var(--fg-3)">${t4("sessions.noSessions")}</div>`;
  const filtered = filter.trim() ? sessions.filter((s3) => s3.name.toLowerCase().includes(filter.toLowerCase())) : sessions;
  return html4`
    <div class="sessions-grid">
      <div class="sessions-list">
        <div class="ssl-h">
          <input
            type="text"
            placeholder=${t4("sessions.filterPlaceholder")}
            value=${filter}
            onInput=${(e3) => setFilter(e3.target.value)}
            style="flex:1"
          />
        </div>
        <div class="chips" style="padding:0 12px 8px">
          <span class="chip-f static active">${t4("common.all")} <span class="ct">${sessions.length}</span></span>
        </div>
        <div class="ssl-rows">
          ${filtered.map(
    (s3) => html4`
              <div
                class=${`ssl-row ${open?.name === s3.name ? "sel" : ""}`}
                onClick=${() => view(s3.name)}
              >
                <span class="name">${s3.name}</span>
                <span class="meta">
                  <span><span class="v">${fmtNum(s3.messageCount)}</span> ${t4("sessions.msgs")}</span>
                  <span><span class="v">${fmtBytes(s3.size)}</span></span>
                  <span>${fmtRelativeTime(s3.mtime)}</span>
                </span>
              </div>
            `
  )}
        </div>
      </div>

      <div class="sessions-detail">
        ${open == null ? html4`<div style="color:var(--fg-3);font-size:13px;text-align:center;padding:60px 20px">
                ${t4("sessions.pickHint")}
              </div>` : html4`
                <div class="sessions-detail-h">
                  <span class="name">${open.name}</span>
                  <span class="ws">
                    ${open.messages ? t4("sessions.messages", { count: open.messages.length, s: open.messages.length === 1 ? "" : "s" }) : t4("common.loading")}
                  </span>
                  <span class="actions">
                    <button class="btn ghost" onClick=${() => setOpen(null)}>${t4("common.back")}</button>
                    <button class="btn ghost danger" disabled=${deleting} onClick=${() => remove(open.name)}>${deleting ? "..." : t4("common.delete")}</button>
                  </span>
                </div>
                <div class="card accent-brand" style="margin-bottom:10px">
                  <div class="card-h"><span class="title">继续会话</span></div>
                  <div class="card-b" style="font-size:12.5px;color:var(--fg-2)">
                    加载历史消息到当前聊天，AI 将获得完整上下文，你可以直接继续对话。
                    <button class="btn primary" style="margin-top:8px;width:100%"
                            disabled=${resuming}
                            onClick=${() => doResume(open.name)}>
                      ${resuming ? "加载中..." : "加载并继续会话"}
                    </button>
                  </div>
                </div>
                ${openLoading ? html4`<div style="color:var(--fg-3)">${t4("sessions.loadingTranscript")}</div>` : open.error ? html4`<div class="card accent-err">${open.error}</div>` : open.messages && open.messages.length > 0 ? html4`<div class="chat-feed" style="max-height:calc(100vh - 220px);overflow-y:auto">
                            ${open.messages.map(
    (m3, i3) => html4`
                                <${ChatMessage}
                                  key=${i3}
                                  msg=${{
      id: `r-${i3}`,
      role: m3.role === "tool" ? "tool" : m3.role === "assistant" ? "assistant" : m3.role === "user" ? "user" : "info",
      text: m3.content ?? "",
      toolName: m3.toolName
    }}
                                  streaming=${false}
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
var INTERVAL_PRESETS_MS = [
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
function parseCustomInterval(value, unit) {
  const n3 = Number.parseFloat(value);
  if (!Number.isFinite(n3) || n3 <= 0) return null;
  const ms = Math.round(n3 * UNIT_TO_MS[unit]);
  if (ms < MIN_INTERVAL_MS || ms > MAX_INTERVAL_MS) return null;
  return ms;
}
function formatRemaining(ms) {
  const safe = Math.max(0, Math.floor(ms / 1e3));
  const h3 = Math.floor(safe / 3600);
  const m3 = Math.floor(safe % 3600 / 60);
  const s3 = safe % 60;
  if (h3 > 0) return m3 > 0 ? `${h3}h ${m3}m` : `${h3}h`;
  if (m3 > 0) return s3 > 0 ? `${m3}m ${s3}s` : `${m3}m`;
  return `${s3}s`;
}

// dashboard/src/panels/settings.ts
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
  onPick
}) {
  const list2 = catalog?.models ?? null;
  const ready = list2 && list2.length > 0;
  if (!ready) {
    return html4`<code class="mono">${current ?? "\u2014"}</code>`;
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
        disabled=${saving}
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
  const tone = budgetTone(state);
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
                  ${quickButtons(QUICK_CAPS_USD)}
                  ${customField}
                </div>
              </div>
            ` : state.kind === "warn" || state.kind === "exhausted" ? html4`
                <div>
                  <div style="color:var(--fg-3);font-size:11px;margin-bottom:6px">${t4("settings.budgetBumpHint")}</div>
                  <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
                    ${bumpSuggestions(state.cap).map(
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
                  ${bumpSuggestions(state.cap).map(
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
  const [intervalMs, setIntervalMs] = d2(INTERVAL_PRESETS_MS[1].ms);
  const [prompt, setPrompt] = d2("");
  const [customValue, setCustomValue] = d2("");
  const [customUnit, setCustomUnit] = d2("m");
  if (status) {
    return html4`
      <div class="card" style="display:flex;flex-direction:column;gap:10px">
        <div style="display:flex;justify-content:space-between;align-items:baseline">
          <span style="color:var(--c-warn);font-family:var(--font-mono);font-size:11px">⟳ ${t4("settings.loopRunning")}</span>
          <span style="color:var(--fg-3);font-size:11px">
            ${t4("settings.loopIter", { iter: status.iter })} · ${t4("settings.loopFiresIn", { remaining: formatRemaining(remainingMs) })}
          </span>
        </div>
        <div style="background:var(--bg-elev-2);border:1px solid var(--bd);border-radius:var(--r);padding:8px 10px;font-family:var(--font-mono);font-size:12px;color:var(--fg-1);white-space:pre-wrap;max-height:120px;overflow-y:auto">${status.prompt}</div>
        <div>
          <button class="btn danger" disabled=${busy} onClick=${onStop}>${t4("settings.loopStop")}</button>
        </div>
      </div>
    `;
  }
  const customMs = parseCustomInterval(customValue, customUnit);
  const canStart = !busy && intervalMs > 0 && prompt.trim().length > 0;
  return html4`
    <div class="card" style="display:flex;flex-direction:column;gap:10px">
      <div style="color:var(--fg-3);font-size:11px">
        ${t4("settings.loopIdleHint")}
        ${typeof avgIterCostUsd === "number" && avgIterCostUsd > 0 ? html4` ${t4("settings.loopCostHint", { cost: `$${avgIterCostUsd.toFixed(4)}` })}` : null}
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">
        <span style="color:var(--fg-3);font-size:11px">${t4("settings.loopInterval")}</span>
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
          ${INTERVAL_PRESETS_MS.map(
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
    const ms = parseCustomInterval(raw, customUnit);
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
      const ms = parseCustomInterval(customValue, next);
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
          value=${prompt}
          onInput=${(e3) => setPrompt(e3.target.value)}
          style="width:100%;font-family:var(--font-mono);resize:vertical"
          disabled=${busy}
        ></textarea>
      </div>
      <div>
        <button
          class="btn primary"
          disabled=${!canStart}
          onClick=${() => onStart(intervalMs, prompt.trim())}
        >${t4("settings.loopStart")}</button>
      </div>
    </div>
  `;
}
function SettingsPanel() {
  useLang();
  const [data, setData] = d2(null);
  const [error, setError] = d2(null);
  const [saving, setSaving] = d2(false);
  const [saved, setSaved] = d2(null);
  const [draft, setDraft] = d2({});
  const [catalog, setCatalog] = d2(null);
  const [loopStatus, setLoopStatus] = d2(null);
  const [loopAvgCost, setLoopAvgCost] = d2(null);
  const [loopBusy, setLoopBusy] = d2(false);
  const lastStatusSyncRef = A2(0);
  const [now, setNow] = d2(() => Date.now());
  const [showDevLog, setShowDevLog] = d2(false);
  const [devLogs, setDevLogs] = d2([]);
  const load = q2(async () => {
    try {
      const r3 = await api("/settings");
      setData(r3);
      setDraft({});
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
    async (intervalMs, prompt) => {
      setLoopBusy(true);
      try {
        await api("/loop/start", { method: "POST", body: { intervalMs, prompt } });
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
      setDevLogs(r3.logs ?? []);
    } catch {
    }
  }, []);
  y2(() => {
    if (!showDevLog) return;
    refreshLogs();
    const id = setInterval(refreshLogs, 2e3);
    return () => clearInterval(id);
  }, [showDevLog, refreshLogs]);
  y2(() => {
    const el = document.getElementById("dev-log-panel");
    if (el) el.scrollTop = el.scrollHeight;
  }, [devLogs]);
  const save = q2(
    async (fields) => {
      setSaving(true);
      setError(null);
      try {
        await api("/settings", { method: "POST", body: fields });
        await load();
        setSaved(t4("settings.saved", { fields: Object.keys(fields).join(", ") }));
        setTimeout(() => setSaved(null), 3e3);
      } catch (err) {
        setError(err.message);
      } finally {
        setSaving(false);
      }
    },
    [load]
  );
  if (!data && !error)
    return html4`<div class="card" style="color:var(--fg-3)">${t4("settings.loading")}</div>`;
  if (error && !data) return html4`<div class="card accent-err">${error}</div>`;
  if (!data) return null;
  const v3 = data;
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
        ${fieldRow(
    t4("settings.apiKey"),
    html4`<code class="mono" style="color:var(--fg-2);font-size:11.5px">${v3.apiKey ?? t4("settings.notSet")}</code>`
  )}
        ${fieldRow(
    t4("settings.replace"),
    html4`
            <input
              type="password"
              placeholder=${t4("settings.pasteKey")}
              value=${draft.apiKey ?? ""}
              onInput=${(e3) => setDraft({ ...draft, apiKey: e3.target.value })}
              style="flex:1"
            />
            <button
              class="btn primary"
              disabled=${saving || !(draft.apiKey ?? "").trim()}
              onClick=${() => save({ apiKey: draft.apiKey })}
            >${t4("settings.saveKey")}</button>
          `
  )}
        ${fieldRow(
    t4("settings.baseUrl"),
    html4`
            <input
              type="text"
              value=${draft.baseUrl ?? v3.baseUrl ?? ""}
              placeholder=${t4("settings.baseUrlPlaceholder")}
              onInput=${(e3) => setDraft({ ...draft, baseUrl: e3.target.value })}
              style="flex:1"
            />
            <button
              class="btn"
              disabled=${saving || (draft.baseUrl ?? v3.baseUrl ?? "") === (v3.baseUrl ?? "")}
              onClick=${() => save({ baseUrl: draft.baseUrl })}
            >${t4("common.save")}</button>
          `
  )}
      </div>

      ${sectionH3(t4("settings.sectionDefaults"))}
      <div class="card">
        ${fieldRow(
    t4("settings.preset"),
    html4`
            <select
              value=${["auto", "flash", "pro"].includes(v3.preset ?? "") ? v3.preset : "auto"}
              onChange=${(e3) => save({ preset: e3.target.value })}
              disabled=${saving}
            >
              <option value="auto">${t4("settings.presetAuto")}</option>
              <option value="flash">${t4("settings.presetFlash")}</option>
              <option value="pro">${t4("settings.presetPro")}</option>
            </select>
          `,
    t4("settings.appliesNextTurn")
  )}
        ${fieldRow(
    t4("settings.effort"),
    html4`
            <select
              value=${v3.reasoningEffort}
              onChange=${(e3) => save({ reasoningEffort: e3.target.value })}
              disabled=${saving}
            >
              <option value="max">${t4("settings.effortMax")}</option>
              <option value="high">${t4("settings.effortHigh")}</option>
            </select>
          `,
    t4("settings.appliesNextTurn")
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
            "\u641C\u7D22\u5F15\u64CE",
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
            "\u5207\u6362\u5F15\u64CE\u540E\u9700\u91CD\u542F\u5E94\u7528\u751F\u6548"
          )}
          ${v3.webSearchEngine === "searxng" || (v3.webSearchEngine ?? "bing-scrape") === "searxng" ? fieldRow(
            "SearXNG \u5730\u5740",
            html4`
              <input
                type="text"
                id="searxng-endpoint"
                value=${v3.webSearchEndpoint ?? "http://localhost:8080"}
                placeholder="https://searx.be"
                style="flex:1"
              />
              <button class="btn" disabled=${saving} onClick=${() => { const el=document.getElementById("searxng-endpoint"); if(el&&el.value.trim()) save({ webSearchEndpoint: el.value.trim() }); }}>${t4("common.save")}</button>
            `,
            "\u586B\u516C\u5171 SearXNG \u5B9E\u4F8B\u5730\u5740\u5373\u53EF\uFF0C\u5982 https://searx.be"
          ) : null}
          ${v3.webSearchEngine === "bing" ? fieldRow(
            "Bing API Key",
            html4`
              <input
                type="password"
                value=""
                placeholder=${v3.bingApiKeySet ? "\u5DF2\u8BBE\u7F6E\uFF0C\u7559\u7A7A\u4FDD\u6301\u73B0\u6709" : "32\u4F4D API Key"}
                onInput=${(e3) => { if(e3.target.value.trim().length >= 16) save({ bingApiKey: e3.target.value.trim() }); }}
                style="flex:1"
              />
            `,
            "\u4ECE https://portal.azure.com \u514D\u8D39\u83B7\u53D6 (Bing Search v7, 1000\u6B21/\u6708)"
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
        state=${deriveBudgetState(v3.budgetUsd, v3.sessionSpendUsd)}
        saving=${saving}
        onSetCap=${(usd) => save({ budgetUsd: usd })}
        onClear=${() => save({ budgetUsd: null })}
      />

      ${sectionH3(t4("settings.sectionLoop"))}
      <${LoopSection}
        status=${loopStatus}
        remainingMs=${remainingMs}
        avgIterCostUsd=${loopAvgCost}
        busy=${loopBusy}
        onStart=${startLoop}
        onStop=${stopLoop}
      />

      ${sectionH3(t4("settings.sectionRuntime"))}
      <div class="card">
        ${fieldRow(
    t4("settings.activeModel"),
    html4`<${ModelRow}
            current=${v3.model ?? "\u2014"}
            catalog=${catalog}
            saving=${saving}
            onPick=${(m3) => save({ model: m3 })}
          />`,
    t4("settings.appliesNextTurn")
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
            onClick=${() => setShowDevLog(!showDevLog)}
          >${showDevLog ? t4("common.on") : t4("common.off")}</button>`,
          t4("settings.devModeNote")
        )}
        ${showDevLog ? html4`
          <div style="margin-top:10px;max-height:320px;overflow-y:auto;background:var(--bg-0);border:1px solid var(--border-1);border-radius:6px;padding:8px;font-family:var(--font-mono);font-size:11px;line-height:1.6" id="dev-log-panel">
            ${devLogs.length === 0 ? html4`<span style="color:var(--fg-3)">...</span>` : devLogs.map((e) => html4`
              <div style="display:flex;gap:8px">
                <span style="color:var(--fg-3);flex-shrink:0">${new Date(e.ts).toLocaleTimeString()}</span>
                <span style="color:var(--fg-2);word-break:break-all">${e.msg}</span>
              </div>
            `)}
          </div>
        ` : null}
      </div>
    </div>
  `;
}

// dashboard/src/panels/skills.ts
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
      await api(`/skills/${open.scope}/${encodeURIComponent(open.name)}`, { method: "DELETE" });
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
description: TODO \u2014 one-line description that helps the model match this skill
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
        </div>

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
    const builtin = data.builtin.find((b2) => b2.name === open.name);
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

// dashboard/src/panels/system.ts
function SystemPanel() {
  useLang();
  const { data, error, loading } = usePoll("/health", 5e3);
  if (loading && !data)
    return html4`<div class="card" style="color:var(--fg-3)">${t4("system.loading")}</div>`;
  if (error) return html4`<div class="card accent-err">${t4("common.loadingFailed", { name: "health", error: error.message })}</div>`;
  if (!data) return null;
  const h3 = data;
  const upToDate = h3.latestVersion ? compareVersions(h3.version, h3.latestVersion) >= 0 : null;
  return html4`
    <div style="display:flex;flex-direction:column;gap:14px">
      <h3 style="margin:0;font-family:var(--font-mono);font-size:11px;color:var(--fg-3);text-transform:uppercase;letter-spacing:.1em">${t4("system.healthChecks")}</h3>
      <div class="health-grid">
        <div class=${`health-item ${upToDate === false ? "warn" : ""}`}>
          <div class="lbl">
            ${t4("system.version")}
            ${upToDate === null ? html4`<span class="pill">${t4("system.checking")}</span>` : upToDate ? html4`<span class="pill ok">${t4("system.latest")}</span>` : html4`<span class="pill warn">${t4("system.outOfDate")}</span>`}
          </div>
          <div class="v">${h3.version}</div>
          <div class="meta">${upToDate === null ? t4("system.versionPending") : upToDate ? t4("system.upToDate") : t4("system.latestVer", { version: h3.latestVersion ?? "" })}</div>
        </div>

        <div class="health-item">
          <div class="lbl">${t4("system.sessions")} ${h3.sessions.count > 0 ? html4`<span class="pill ok">${t4("system.ok")}</span>` : html4`<span class="pill">${t4("system.none")}</span>`}</div>
          <div class="v">${fmtBytes(h3.sessions.totalBytes)}</div>
          <div class="meta">${fmtNum(h3.sessions.count)} ${t4("system.files")}</div>
        </div>

        <div class="health-item">
          <div class="lbl">${t4("system.memory")} ${h3.memory.fileCount > 0 ? html4`<span class="pill ok">${t4("system.ok")}</span>` : html4`<span class="pill">${t4("system.none")}</span>`}</div>
          <div class="v">${fmtBytes(h3.memory.totalBytes)}</div>
          <div class="meta">${fmtNum(h3.memory.fileCount)} ${t4("system.files")}</div>
        </div>

        <div class="health-item">
          <div class="lbl">
            ${t4("system.semanticIndex")}
            ${h3.semantic.exists ? html4`<span class="pill ok">${t4("system.built")}</span>` : html4`<span class="pill">${t4("system.none")}</span>`}
          </div>
          <div class="v">${h3.semantic.exists ? fmtBytes(h3.semantic.totalBytes) : "\u2014"}</div>
          <div class="meta">
            ${h3.semantic.exists ? `${fmtNum(h3.semantic.fileCount)} ${t4("system.files")}` : t4("system.runIndex")}
          </div>
        </div>

        <div class="health-item">
          <div class="lbl">${t4("system.usageLog")} ${h3.usageLog.bytes > 0 ? html4`<span class="pill ok">${t4("system.ok")}</span>` : html4`<span class="pill">${t4("system.none")}</span>`}</div>
          <div class="v">${fmtBytes(h3.usageLog.bytes)}</div>
          <div class="meta">${h3.usageLog.path}</div>
        </div>

        <div class="health-item">
          <div class="lbl">
            ${t4("system.backgroundJobs")}
            ${h3.jobs === null ? html4`<span class="pill">${t4("system.noSession")}</span>` : html4`<span class="pill ok">● ${fmtNum(h3.jobs)}</span>`}
          </div>
          <div class="v">${h3.jobs === null ? "\u2014" : t4("system.running", { count: fmtNum(h3.jobs) })}</div>
          <div class="meta">${h3.jobs === null ? t4("system.attachHint") : t4("system.shellSpawn")}</div>
        </div>
      </div>

      <div class="card" style="padding:0">
        <div class="card-h" style="padding:12px 14px 6px">
          <span class="title">${t4("system.paths")}</span>
        </div>
        <table class="tbl">
          <tbody style="font-size:11.5px">
            <tr><td class="dim" style="padding:5px 14px">${t4("system.home")}</td><td class="path">${h3.visionoxHome}</td></tr>
            <tr><td class="dim" style="padding:5px 14px">${t4("system.sessionsPath")}</td><td class="path">${h3.sessions.path}</td></tr>
            <tr><td class="dim" style="padding:5px 14px">${t4("system.memoryPath")}</td><td class="path">${h3.memory.path}</td></tr>
            <tr><td class="dim" style="padding:5px 14px">${t4("system.semanticPath")}</td><td class="path">${h3.semantic.path}</td></tr>
            <tr><td class="dim" style="padding:5px 14px">${t4("system.usagePath")}</td><td class="path">${h3.usageLog.path}</td></tr>
          </tbody>
        </table>
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

// dashboard/src/panels/usage.ts
var uPlotPromise = null;
function loadUPlot() {
  if (!uPlotPromise) {
    uPlotPromise = Promise.resolve().then(() => (init_uPlot_esm(), uPlot_esm_exports)).then(
      (m3) => m3.default ?? m3
    );
  }
  return uPlotPromise;
}
function UsageChart({ days: days2 }) {
  const containerRef = A2(null);
  const plotRef = A2(null);
  useLang();
  y2(() => {
    let cancelled = false;
    loadUPlot().then((uPlot2) => {
      if (cancelled || !containerRef.current) return;
      if (plotRef.current) {
        plotRef.current.destroy();
        plotRef.current = null;
      }
      if (!days2 || days2.length === 0) return;
      const xs = days2.map((d3) => Math.floor(Date.parse(d3.day) / 1e3));
      const cost = days2.map((d3) => d3.costUsd);
      const saved = days2.map((d3) => d3.cacheSavingsUsd);
      const turns = days2.map((d3) => d3.turns);
      const data = [xs, cost, saved, turns];
      const opts = {
        width: containerRef.current.clientWidth,
        height: 280,
        cursor: { drag: { x: true, y: false } },
        scales: {
          x: { time: true },
          y: { auto: true },
          turns: { auto: true }
        },
        axes: [
          { stroke: "#94a3b8", grid: { stroke: "rgba(148, 163, 184, 0.08)" } },
          {
            scale: "y",
            label: t4("usage.axisUsd"),
            stroke: "#94a3b8",
            grid: { stroke: "rgba(148, 163, 184, 0.08)" },
            values: (_u, v3) => v3.map((n3) => `$${n3.toFixed(4)}`)
          },
          {
            scale: "turns",
            side: 1,
            label: t4("usage.axisTurns"),
            stroke: "#94a3b8",
            grid: { show: false }
          }
        ],
        series: [
          { label: t4("usage.axisTime") },
          {
            label: t4("usage.seriesCost"),
            stroke: "#67e8f9",
            width: 2,
            fill: "rgba(103, 232, 249, 0.10)"
          },
          { label: t4("usage.seriesCacheSaved"), stroke: "#5eead4", width: 2, dash: [4, 4] },
          {
            label: t4("usage.seriesTurns"),
            stroke: "#c4b5fd",
            scale: "turns",
            width: 1.5,
            points: { show: true, size: 4 }
          }
        ],
        legend: { live: true }
      };
      plotRef.current = new uPlot2(opts, data, containerRef.current);
    });
    const ro = new ResizeObserver(() => {
      if (plotRef.current && containerRef.current) {
        plotRef.current.setSize({ width: containerRef.current.clientWidth, height: 280 });
      }
    });
    if (containerRef.current) ro.observe(containerRef.current);
    return () => {
      cancelled = true;
      ro.disconnect();
      if (plotRef.current) {
        plotRef.current.destroy();
        plotRef.current = null;
      }
    };
  }, [days2]);
  return html4`<div ref=${containerRef} style="width: 100%; min-height: 280px;"></div>`;
}
function UsagePanel() {
  useLang();
  const { data: summary, error, loading } = usePoll("/usage", 5e3);
  const [series, setSeries] = d2(null);
  y2(() => {
    let cancelled = false;
    (async () => {
      try {
        const s3 = await api("/usage/series");
        if (!cancelled) setSeries(s3.days ?? []);
      } catch {
      }
    })();
    const interval = setInterval(async () => {
      try {
        const s3 = await api("/usage/series");
        if (!cancelled) setSeries(s3.days ?? []);
      } catch {
      }
    }, 3e4);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);
  if (loading && !summary)
    return html4`<div class="card" style="color:var(--fg-3)">${t4("usage.loading")}</div>`;
  if (error) return html4`<div class="card accent-err">${t4("common.loadingFailed", { name: "usage", error: error.message })}</div>`;
  if (!summary) return null;
  const u3 = summary;
  const sectionH3 = (text) => html4`
    <h3 style="margin:18px 0 8px;font-family:var(--font-mono);font-size:11px;color:var(--fg-3);text-transform:uppercase;letter-spacing:.1em">${text}</h3>
  `;
  return html4`
    <div style="display:flex;flex-direction:column;gap:6px">
      <div class="chips">
        <span class="chip-f static active">${t4("usage.records", { count: u3.recordCount.toLocaleString() })}</span>
        <span class="chip-f static">${u3.logSize}</span>
      </div>

      ${series && series.length > 0 ? html4`
            <div class="card" style="padding:18px">
              <div class="card-h">
                <span class="title">${t4("usage.dailyUsage")}</span>
                <span class="meta">${t4("usage.dailyMeta")}</span>
              </div>
              <${UsageChart} days=${series} />
            </div>
          ` : null}

      ${u3.recordCount === 0 ? html4`<div class="card" style="color:var(--fg-3);margin-top:8px">
              ${t4("usage.noData")}
            </div>` : html4`
              ${sectionH3(t4("usage.windows"))}
              <div class="card" style="padding:0;overflow:hidden">
                <table class="tbl">
                  <thead>
                    <tr>
                      <th>${t4("usage.colWindow")}</th>
                      <th class="num">${t4("usage.colTurns")}</th>
                      <th class="num">${t4("usage.colCacheHit")}</th>
                      <th class="num">${t4("usage.colCost")}</th>
                      <th class="num">${t4("usage.colCacheSaved")}</th>
                      <th class="num">${t4("usage.colVsClaude")}</th>
                      <th class="num">${t4("usage.colSaved")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${u3.buckets.map((b2) => {
    const hitRatio = b2.cacheHitTokens + b2.cacheMissTokens > 0 ? b2.cacheHitTokens / (b2.cacheHitTokens + b2.cacheMissTokens) : 0;
    const claudeSavings = b2.claudeEquivUsd > 0 ? 1 - b2.costUsd / b2.claudeEquivUsd : 0;
    return html4`
                        <tr>
                          <td class="dim">${b2.label}</td>
                          <td class="num">${fmtNum(b2.turns)}</td>
                          <td class="num">${b2.turns > 0 ? fmtPct(hitRatio) : "\u2014"}</td>
                          <td class="num">${b2.turns > 0 ? fmtUsd(b2.costUsd) : "\u2014"}</td>
                          <td class="num">${b2.turns > 0 && b2.cacheSavingsUsd > 0 ? fmtUsd(b2.cacheSavingsUsd) : "\u2014"}</td>
                          <td class="num">${b2.turns > 0 ? fmtUsd(b2.claudeEquivUsd) : "\u2014"}</td>
                          <td class="num">${b2.turns > 0 && claudeSavings > 0 ? fmtPct(claudeSavings) : "\u2014"}</td>
                        </tr>
                      `;
  })}
                  </tbody>
                </table>
              </div>
            `}

      ${u3.byModel.length > 0 ? html4`
              ${sectionH3(t4("usage.mostUsed"))}
              <div class="card" style="padding:0;overflow:hidden">
                <table class="tbl">
                  <thead>
                    <tr>
                      <th>${t4("usage.colModel")}</th>
                      <th>${t4("usage.colTurns")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${u3.byModel.slice(0, 5).map(
    (m3) => html4`
                        <tr>
                          <td><code class="mono">${m3.model}</code></td>
                          <td class="num">${fmtNum(m3.turns)}</td>
                        </tr>
                      `
  )}
                  </tbody>
                </table>
              </div>
            ` : null}
    </div>
  `;
}

// dashboard/src/lib/file-tree.ts
var html5 = htm_module_default.bind(k);
var EXT_ICONS = {
  ts: "TS",
  tsx: "TS",
  js: "JS",
  jsx: "JS",
  json: "{}",
  css: "#",
  scss: "#",
  html: "<>",
  md: "MD",
  py: "PY",
  rs: "RS",
  go: "GO",
  yaml: "Y",
  yml: "Y",
  toml: "T",
  xml: "<>",
  svg: "<>",
  png: "[]",
  jpg: "[]",
  ico: "[]",
  sh: "$",
  bash: "$",
  ps1: "$",
  bat: "$",
  sql: "DB",
  graphql: "GQ",
  proto: "PB",
  dockerfile: "D",
  makefile: "MK"
};
var EXT_LANG = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  json: "json",
  css: "css",
  scss: "scss",
  html: "html",
  md: "markdown",
  py: "python",
  rs: "rust",
  go: "go",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",
  xml: "xml",
  sh: "bash",
  bash: "bash",
  ps1: "powershell",
  bat: "batch",
  sql: "sql",
  graphql: "graphql",
  proto: "protobuf",
  dockerfile: "dockerfile",
  makefile: "makefile"
};
function getFileIcon(name) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const icon = EXT_ICONS[ext] ?? "\xB7";
  const cls = ext || "file";
  return { icon, cls };
}
function getLanguage(name) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return EXT_LANG[ext] ?? ext;
}
function isBinaryExt(name) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const binary = /* @__PURE__ */ new Set(["png", "jpg", "jpeg", "gif", "ico", "svg", "woff", "woff2", "ttf", "eot", "mp4", "webm", "mp3", "wav", "zip", "tar", "gz", "7z", "pdf"]);
  return binary.has(ext);
}
function useProjectTree() {
  const [tree, setTree] = d2([]);
  const [loading, setLoading] = d2(true);
  const [error, setError] = d2(null);
  y2(() => {
    if (MODE === "standalone") {
      setLoading(false);
      setTree(createDemoTree());
      return;
    }
    let cancelled = false;
    api("/project-tree").then((r3) => {
      if (!cancelled) {
        setTree(r3.tree);
        setLoading(false);
      }
    }).catch((err) => {
      if (!cancelled) {
        setError(err.message);
        setLoading(false);
        setTree(createDemoTree());
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return { tree, loading, error };
}
function useFileTreeState(initialTree) {
  const [expanded, setExpanded] = d2(/* @__PURE__ */ new Set());
  const [openFiles, setOpenFiles] = d2([]);
  const [activeFilePath, setActiveFilePath] = d2(null);
  const [loadingFiles, setLoadingFiles] = d2({});
  const toggleExpand = q2((path) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);
  const openFile = q2(async (node) => {
    if (node.isDir) {
      toggleExpand(node.path);
      return;
    }
    if (isBinaryExt(node.name)) return;
    const existing = openFiles.find((f3) => f3.path === node.path);
    if (existing) {
      setActiveFilePath(node.path);
      return;
    }
    if (loadingFiles[node.path]) return;
    setLoadingFiles((prev) => ({ ...prev, [node.path]: true }));
    const lang = getLanguage(node.name);
    if (MODE === "standalone") {
      const mockContent = generateMockContent(node.name, lang);
      setOpenFiles((prev) => [...prev, { path: node.path, name: node.name, content: mockContent, language: lang }]);
      setActiveFilePath(node.path);
      setLoadingFiles((prev) => {
        const next = { ...prev };
        delete next[node.path];
        return next;
      });
      return;
    }
    try {
      const encodedPath = node.path.split("/").map(encodeURIComponent).join("/");
      const data = await api(`/file/${encodedPath}`);
      setOpenFiles((prev) => [...prev, { path: node.path, name: node.name, content: data.content, language: lang }]);
      setActiveFilePath(node.path);
    } catch (err) {
      console.error(`[file-tree] failed to load ${node.path}:`, err);
      setOpenFiles((prev) => [...prev, { path: node.path, name: node.name, content: `// Failed to load file: ${err.message}
`, language: lang }]);
      setActiveFilePath(node.path);
    } finally {
      setLoadingFiles((prev) => {
        const next = { ...prev };
        delete next[node.path];
        return next;
      });
    }
  }, [openFiles, toggleExpand, loadingFiles]);
  const closeFile = q2((path) => {
    setOpenFiles((prev) => {
      const next = prev.filter((f3) => f3.path !== path);
      if (activeFilePath === path) {
        const lastFile = next[next.length - 1];
        setActiveFilePath(lastFile ? lastFile.path : null);
      }
      return next;
    });
  }, [activeFilePath]);
  const activeFile = openFiles.find((f3) => f3.path === activeFilePath) ?? null;
  return { expanded, openFiles, activeFilePath, activeFile, toggleExpand, openFile, closeFile, setActiveFilePath, loadingFiles };
}
function generateMockContent(name, lang) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "json") return JSON.stringify({ name: "example", version: "1.0.0", dependencies: { react: "^18.0.0" } }, null, 2);
  if (ext === "md") return '# Example Document\n\nThis is a sample markdown file.\n\n## Section\n\n- Item 1\n- Item 2\n\n```js\nconsole.log("hello");\n```';
  if (ext === "css") return "/* styles */\n.container {\n  display: flex;\n  padding: 16px;\n  color: var(--fg-1);\n}";
  if (ext === "html") return "<!doctype html>\n<html>\n<head><title>Example</title></head>\n<body>\n  <h1>Hello</h1>\n</body>\n</html>";
  if (ext === "py") return "def hello():\n    print('Hello, World!')\n\nif __name__ == '__main__':\n    hello()";
  if (ext === "yaml" || ext === "yml") return "name: example\nversion: '1.0'\nservices:\n  app:\n    image: node:18\n    ports:\n      - '3000:3000'";
  return `// ${name}
// Language: ${lang}

export function example() {
  return "Hello from ${name}";
}
`;
}
function createDemoTree() {
  return [
    {
      name: "src",
      path: "src",
      isDir: true,
      children: [
        { name: "index.ts", path: "src/index.ts", isDir: false },
        { name: "app.tsx", path: "src/app.tsx", isDir: false },
        { name: "config.ts", path: "src/config.ts", isDir: false },
        {
          name: "components",
          path: "src/components",
          isDir: true,
          children: [
            { name: "Header.tsx", path: "src/components/Header.tsx", isDir: false },
            { name: "Sidebar.tsx", path: "src/components/Sidebar.tsx", isDir: false },
            { name: "Button.tsx", path: "src/components/Button.tsx", isDir: false }
          ]
        },
        {
          name: "lib",
          path: "src/lib",
          isDir: true,
          children: [
            { name: "api.ts", path: "src/lib/api.ts", isDir: false },
            { name: "format.ts", path: "src/lib/format.ts", isDir: false }
          ]
        }
      ]
    },
    {
      name: "tests",
      path: "tests",
      isDir: true,
      children: [
        { name: "app.test.ts", path: "tests/app.test.ts", isDir: false },
        { name: "utils.test.ts", path: "tests/utils.test.ts", isDir: false }
      ]
    },
    { name: "package.json", path: "package.json", isDir: false },
    { name: "tsconfig.json", path: "tsconfig.json", isDir: false },
    { name: "README.md", path: "README.md", isDir: false },
    { name: "styles.css", path: "styles.css", isDir: false },
    { name: "index.html", path: "index.html", isDir: false }
  ];
}

// dashboard/src/lib/line-comments.ts
function useLineComments() {
  const [comments, setComments] = d2([]);
  const [draft, setDraft] = d2(null);
  const addComment = q2((file, lineNumber, content) => {
    const id = `comment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setComments((prev) => [...prev, { id, file, lineNumber, content, timestamp: Date.now() }]);
    setDraft(null);
  }, []);
  const updateComment = q2((id, content) => {
    setComments((prev) => prev.map((c3) => c3.id === id ? { ...c3, content } : c3));
  }, []);
  const deleteComment = q2((id) => {
    setComments((prev) => prev.filter((c3) => c3.id !== id));
  }, []);
  const startDraft = q2((file, lineNumber) => {
    setDraft({ file, lineNumber, content: "" });
  }, []);
  const editComment = q2((id, content) => {
    const comment = comments.find((c3) => c3.id === id);
    if (comment) {
      setDraft({ file: comment.file, lineNumber: comment.lineNumber, content, editingId: id });
    }
  }, [comments]);
  const cancelDraft = q2(() => {
    setDraft(null);
  }, []);
  const setDraftContent = q2((content) => {
    setDraft((prev) => prev ? { ...prev, content } : null);
  }, []);
  const submitDraft = q2(() => {
    if (draft && draft.content.trim()) {
      if (draft.editingId) {
        updateComment(draft.editingId, draft.content.trim());
      } else {
        addComment(draft.file, draft.lineNumber, draft.content.trim());
      }
      setDraft(null);
    }
  }, [draft, addComment, updateComment]);
  const commentsForFile = q2(
    (file) => comments.filter((c3) => c3.file === file),
    [comments]
  );
  const commentsForLine = q2(
    (file, lineNumber) => comments.filter((c3) => c3.file === file && c3.lineNumber === lineNumber),
    [comments]
  );
  return {
    comments,
    draft,
    addComment,
    updateComment,
    deleteComment,
    startDraft,
    editComment,
    cancelDraft,
    setDraftContent,
    submitDraft,
    commentsForFile,
    commentsForLine
  };
}

// dashboard/src/lib/review-diffs.ts
function useReviewDiffs() {
  const [diffs, setDiffs] = d2([]);
  const [loading, setLoading] = d2(false);
  const loadDiffs = q2(async (ep = "/review-diffs") => {
    setLoading(true);
    try {
      const data = await api(ep);
      setDiffs(Array.isArray(data) ? data : []);
    } catch {
      setDiffs([]);
    } finally {
      setLoading(false);
    }
  }, []);
  const modifiedFiles = q2(() => new Set(diffs.map((d3) => d3.file)), [diffs]);
  const modifiedCount = q2(() => diffs.length, [diffs]);
  return { diffs, loading, modifiedFiles, modifiedCount, reload: loadDiffs };
}

// dashboard/src/lib/diff-parser.ts
function parseHunks(patch) {
  if (!patch) return [];
  const hunks = [];
  const rawLines = patch.split("\n");
  let cursor = 0;
  while (cursor < rawLines.length) {
    const line = rawLines[cursor];
    const m3 = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (m3) {
      const oldStart = parseInt(m3[1], 10);
      const oldLen = m3[2] !== void 0 ? parseInt(m3[2], 10) : 1;
      const newStart = parseInt(m3[3], 10);
      const newLen = m3[4] !== void 0 ? parseInt(m3[4], 10) : 1;
      const lines = [];
      let oldNum = oldStart;
      let newNum = newStart;
      cursor++;
      while (cursor < rawLines.length && !rawLines[cursor].startsWith("@@ ") && !rawLines[cursor].startsWith("diff ") && !rawLines[cursor].startsWith("--- ") && !rawLines[cursor].startsWith("index ")) {
        const l3 = rawLines[cursor];
        if (l3.startsWith("\\")) {
          cursor++;
          continue;
        }
        const ch = l3[0];
        const content = l3.slice(1);
        if (ch === "-") {
          lines.push({ type: "del", content, oldLineNum: oldNum });
          oldNum++;
        } else if (ch === "+") {
          lines.push({ type: "add", content, newLineNum: newNum });
          newNum++;
        } else {
          lines.push({ type: "ctx", content, oldLineNum: oldNum, newLineNum: newNum });
          oldNum++;
          newNum++;
        }
        cursor++;
      }
      hunks.push({ oldStart, oldLines: oldLen, newStart, newLines: newLen, lines });
    } else {
      cursor++;
    }
  }
  return hunks;
}

// dashboard/src/panels/changes.ts
var html6 = htm_module_default.bind(k);
function escapeAttr(s3) {
  return s3.replace(/["&<>]/g, (c3) => ({ '"': "&quot;", "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c3]);
}
function lineDiff2(a3, b2) {
  const m3 = a3.length, n3 = b2.length;
  const dp = Array.from({ length: m3 + 1 }, () => new Array(n3 + 1).fill(0));
  for (let i4 = 1; i4 <= m3; i4++) for (let j5 = 1; j5 <= n3; j5++)
    dp[i4][j5] = a3[i4 - 1] === b2[j5 - 1] ? dp[i4 - 1][j5 - 1] + 1 : Math.max(dp[i4 - 1][j5], dp[i4][j5 - 1]);
  const out = [];
  let i3 = m3, j4 = n3;
  while (i3 > 0 || j4 > 0) {
    if (i3 > 0 && j4 > 0 && a3[i3 - 1] === b2[j4 - 1]) {
      out.push({ kind: "context", text: a3[i3 - 1] });
      i3--;
      j4--;
    } else if (j4 > 0 && (i3 === 0 || dp[i3][j4 - 1] >= dp[i3 - 1][j4])) {
      out.push({ kind: "ins", text: b2[j4 - 1] });
      j4--;
    } else {
      out.push({ kind: "del", text: a3[i3 - 1] });
      i3--;
    }
  }
  return out.reverse();
}
function pairDiffRows2(diff) {
  const rows = [];
  let k3 = 0;
  while (k3 < diff.length) {
    const e3 = diff[k3];
    if (e3.kind === "context") {
      rows.push({ left: e3.text, right: e3.text, kind: "context" });
      k3++;
      continue;
    }
    const d3 = [], ins = [];
    while (k3 < diff.length && diff[k3].kind === "del") d3.push(diff[k3].text), k3++;
    while (k3 < diff.length && diff[k3].kind === "ins") ins.push(diff[k3].text), k3++;
    const p3 = Math.max(d3.length, ins.length);
    for (let i3 = 0; i3 < p3; i3++) rows.push({ left: d3[i3] ?? null, right: ins[i3] ?? null, kind: d3[i3] != null && ins[i3] != null ? "change" : d3[i3] != null ? "del" : "ins" });
  }
  return rows;
}
function hE(s3) {
  return s3.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function renderDiffHtml(patch, style) {
  const hunks = parseHunks(patch);
  if (hunks.length === 0) return "";
  if (style === "unified") {
    let html9 = "";
    for (const hunk of hunks) {
      html9 += `<div class="diff-hunk-header">@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@</div>`;
      for (const line of hunk.lines) {
        const cls = line.type === "add" ? "diff-add" : line.type === "del" ? "diff-del" : "";
        const prefix = line.type === "add" ? "+" : line.type === "del" ? "-" : " ";
        html9 += `<div class="diff-line ${cls}"><span class="diff-ln-old">${line.oldLineNum ?? ""}</span><span class="diff-ln-new">${line.newLineNum ?? ""}</span><span class="diff-prefix">${prefix}</span><span class="diff-content">${hE(line.content)}</span></div>`;
      }
    }
    return html9;
  }
  const oldLines = [], newLines = [];
  for (const hunk of hunks) {
    for (const line of hunk.lines) {
      if (line.type === "ctx") {
        oldLines.push(line.content);
        newLines.push(line.content);
      } else if (line.type === "del") oldLines.push(line.content);
      else newLines.push(line.content);
    }
  }
  const diff = lineDiff2(oldLines, newLines);
  const rows = pairDiffRows2(diff);
  let oldNum = 1, newNum = 1;
  let html8 = `<div class="edit-diff-head"><div class="edit-diff-side edit-diff-side-old"><span class="edit-diff-marker">\u2212</span> Before</div><div class="edit-diff-side edit-diff-side-new"><span class="edit-diff-marker">+</span> After</div></div><div class="edit-diff-body">`;
  for (const row of rows) {
    html8 += `<div class="edit-diff-row edit-diff-row-${row.kind}">`;
    html8 += `<div class="edit-diff-cell edit-diff-cell-old">`;
    if (row.left != null) {
      html8 += `<span class="edit-diff-ln">${oldNum}</span><span class="edit-diff-marker">${row.kind === "del" || row.kind === "change" ? "\u2212" : " "}</span>${hE(row.left)}`;
      oldNum++;
    }
    html8 += `</div>`;
    html8 += `<div class="edit-diff-cell edit-diff-cell-new">`;
    if (row.right != null) {
      html8 += `<span class="edit-diff-ln">${newNum}</span><span class="edit-diff-marker">${row.kind === "ins" || row.kind === "change" ? "+" : " "}</span>${hE(row.right)}`;
      newNum++;
    }
    html8 += `</div></div>`;
  }
  html8 += `</div>`;
  return html8;
}
function ChangesPanel() {
  useLang();
  const { tree, loading } = useProjectTree();
  const { expanded, openFiles, activeFilePath, activeFile, toggleExpand, openFile, closeFile, setActiveFilePath } = useFileTreeState(tree);
  const { comments, draft, startDraft, cancelDraft, setDraftContent, submitDraft, commentsForFile, deleteComment, editComment } = useLineComments();
  const { diffs, modifiedFiles, modifiedCount, reload } = useReviewDiffs();
  const [diffSource, setDiffSource] = d2("git");
  const [checkpointList, setCheckpointList] = d2([]);
  const [selectedCheckpointId, setSelectedCheckpointId] = d2(null);
  const [createName, setCreateName] = d2("");
  const [leftPct, setLeftPct] = d2(30);
  const [rightPct, setRightPct] = d2(30);
  const [showOnlyModified, setShowOnlyModified] = d2(false);
  const [reviewMode, setReviewMode] = d2(true);
  const [diffStyle, setDiffStyle] = d2("unified");
  const [reviewHtml, setReviewHtml] = d2("");
  const openingFile = A2(false);
  y2(() => {
    if (openFiles.length === 0 && !openingFile.current) setReviewMode(true);
  }, [openFiles]);
  const diffEndpoint = diffSource === "checkpoint" ? selectedCheckpointId ? `/checkpoint-diffs?id=${selectedCheckpointId}` : null : diffSource === "git" ? "/git-diffs" : "/review-diffs";
  y2(() => {
    if (diffSource === "checkpoint") {
      api("/checkpoints").then((list2) => setCheckpointList(list2)).catch(() => setCheckpointList([]));
    }
  }, [diffSource]);
  y2(() => {
    if (diffEndpoint) {
      reload(diffEndpoint);
    } else {
      setReviewHtml(`<div class="review-empty">${t4("changes.reviewEmpty") || "Select a checkpoint to compare"}</div>`);
    }
    void diffEndpoint;
  }, [diffEndpoint, reload]);
  y2(() => {
    if (diffs.length === 0) {
      const emptyMsg = t4("changes.reviewEmpty") || "No changes to review";
      setReviewHtml(`<div class="review-empty">${emptyMsg}</div>`);
      return;
    }
    setReviewHtml(
      diffs.map((diff) => {
        const file = hE(diff.file);
        const chev = '<span class="chev">\u25B8</span>';
        const stat = `<span class="stat"><span class="add">+${diff.additions}</span><span class="rem"> -${diff.deletions}</span></span>`;
        const body = diff.patch ? `<div class="review-file-body" style="display:none">${renderDiffHtml(diff.patch, diffStyle)}</div>` : "";
        return `<div class="review-file-item" data-file="${escapeAttr(file)}"><div class="review-file-header">${chev}<span class="filename">${escapeAttr(file)}</span>${stat}</div>${body}</div>`;
      }).join("")
    );
  }, [diffs, diffStyle, t4]);
  const expandAll = q2(() => {
    document.querySelectorAll(".review-file-body").forEach((el) => {
      el.style.display = "";
    });
    document.querySelectorAll(".review-file-header .chev").forEach((el) => {
      el.textContent = "\u25BE";
    });
  }, []);
  const collapseAll = q2(() => {
    document.querySelectorAll(".review-file-body").forEach((el) => {
      el.style.display = "none";
    });
    document.querySelectorAll(".review-file-header .chev").forEach((el) => {
      el.textContent = "\u25B8";
    });
  }, []);
  const handleLeftResize = q2((delta) => {
    setLeftPct((prev) => {
      const containerWidth = window.innerWidth;
      const deltaPct = delta / containerWidth * 100;
      return Math.max(15, Math.min(50, prev + deltaPct));
    });
  }, []);
  const handleRightResize = q2((delta) => {
    setRightPct((prev) => {
      const containerWidth = window.innerWidth;
      const deltaPct = delta / containerWidth * 100;
      return Math.max(15, Math.min(50, prev - deltaPct));
    });
  }, []);
  const toggleModifiedFilter = q2(() => {
    setShowOnlyModified((prev) => !prev);
  }, []);
  const toggleReviewMode = q2(() => {
    setReviewMode((prev) => !prev);
  }, []);
  const openReviewWithFilePicker = q2(() => {
    setReviewMode(true);
  }, []);
  const handleOpenFile = q2(
    async (filePath) => {
      const findInTree = (nodes, path) => {
        for (const n3 of nodes) {
          if (n3.path === path) return n3;
          if (n3.children) {
            const found = findInTree(n3.children, path);
            if (found) return found;
          }
        }
        return null;
      };
      let node = findInTree(tree, filePath);
      if (!node) {
        const parts = filePath.split("/");
        const name = parts[parts.length - 1] || filePath;
        node = { path: filePath, name, isDir: false };
      }
      await openFile(node);
    },
    [tree, openFile]
  );
  y2(() => {
    const handler = (e3) => {
      const header = e3.target.closest(".review-file-header");
      if (!header) return;
      const item = header.closest(".review-file-item");
      if (!item) return;
      const filePath = item.getAttribute("data-file");
      if (!filePath) return;
      const body = item.querySelector(".review-file-body");
      if (body) {
        const isOpen = body.style.display !== "none";
        body.style.display = isOpen ? "none" : "";
        const chev = header.querySelector(".chev");
        if (chev) chev.textContent = isOpen ? "\u25B8" : "\u25BE";
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);
  const activeFileComments = activeFile ? commentsForFile(activeFile.path) : [];
  return html6`
    <div class="changes-layout">
      <div class="changes-panel changes-panel-left" style=${{ width: `${leftPct}%` }}>
        <div class="changes-panel-header">
          <span class="glyph">◆</span>
          <span>${t4("changes.chatPanelTitle")}</span>
        </div>
        <div class="changes-panel-body">
          <${ChatPane}
            comments=${comments}
            deleteComment=${deleteComment}
          />
        </div>
      </div>

      <${ResizeHandle} onResize=${handleLeftResize} direction="horizontal" />

      <div class="changes-panel changes-panel-center">
        ${reviewMode ? html6`
              <${TabBar}
                reviewTab=${html6`<${ReviewTab} count=${modifiedCount()} active=${true} onClick=${toggleReviewMode} />`}
                fileList=${diffs.map((d3) => d3.file)}
                onOpenFile=${(f3) => {
    handleOpenFile(f3);
    setReviewMode(false);
  }}
                onToggleReview=${toggleReviewMode}
                files=${openFiles}
                activePath=${activeFilePath}
                onSelect=${(path) => {
    setActiveFilePath(path);
    setReviewMode(false);
  }}
                onClose=${closeFile}
              />
              <div class="review-controls" style=${{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 12px", borderBottom: "1px solid var(--bd)", fontSize: "12px" }}>
                <select value=${diffSource} onChange=${(e3) => {
    const v3 = e3.target.value;
    setDiffSource(v3);
    if (v3 !== "checkpoint") setSelectedCheckpointId(null);
  }} style=${{ fontSize: "12px", fontWeight: 500, padding: "1px 4px", borderRadius: "3px", background: "var(--bg-elev)", color: "var(--fg-0)", border: "1px solid var(--bd)", cursor: "pointer", outline: "none" }}>
                  <option value="git">${t4("changes.diffSourceGit")}</option>
                  <option value="session">${t4("changes.diffSourceSession")}</option>
                  <option value="checkpoint">${t4("changes.diffSourceCheckpoint")}</option>
                </select>
                ${diffSource !== "checkpoint" || selectedCheckpointId ? html6`
                <span style=${{ color: "var(--fg-3)" }}>${modifiedCount()}</span>
                <div style=${{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "4px" }}>
                  <button class=${`toggle-btn ${diffStyle === "unified" ? "active" : ""}`} onClick=${() => setDiffStyle("unified")} style=${{ fontSize: "11px", padding: "2px 6px" }}>${t4("changes.diffStyleUnified")}</button>
                  <button class=${`toggle-btn ${diffStyle === "split" ? "active" : ""}`} onClick=${() => setDiffStyle("split")} style=${{ fontSize: "11px", padding: "2px 6px" }}>${t4("changes.diffStyleSplit")}</button>
                  <button class="toggle-btn" onClick=${expandAll} style=${{ fontSize: "11px", padding: "2px 6px" }}>${t4("changes.expandAll")}</button>
                  <button class="toggle-btn" onClick=${collapseAll} style=${{ fontSize: "11px", padding: "2px 6px" }}>${t4("changes.collapseAll")}</button>
                </div>
                ` : null}
              </div>
              ${diffSource === "checkpoint" && selectedCheckpointId ? html6`
                <div style=${{ padding: "4px 12px", fontSize: "11px", color: "var(--fg-3)", borderBottom: "1px solid var(--bd)", cursor: "pointer" }}>
                  <span onClick=${() => setSelectedCheckpointId(null)} style=${{ color: "var(--c-brand)", cursor: "pointer" }}>← ${t4("changes.backToList")}</span>
                </div>
              ` : null}
              ${diffSource === "checkpoint" && !selectedCheckpointId ? html6`
                <div class="checkpoint-picker" style=${{ flex: "1", overflowY: "auto", padding: "8px 12px" }}>
                  <div style=${{ display: "flex", gap: "6px", marginBottom: "8px" }}>
                    <input
                      value=${createName}
                      onInput=${(e3) => setCreateName(e3.target.value)}
                      placeholder=${t4("changes.createPlaceholder")}
                      style=${{ flex: 1, fontSize: "12px", padding: "4px 8px", background: "var(--bg-input)", border: "1px solid var(--bd)", borderRadius: "3px", color: "var(--fg-0)" }}
                    />
                    <button
                      class="primary"
                      onClick=${async () => {
    const name = createName.trim();
    if (!name) return;
    try {
      await api("/checkpoint-create", { method: "POST", body: { name } });
      setCreateName("");
      const list2 = await api("/checkpoints");
      setCheckpointList(list2);
    } catch {
      alert("create failed");
    }
  }}
                      disabled=${!createName.trim()}
                      style=${{ padding: "5px 12px" }}
                    >${t4("changes.createBtn")}</button>
                  </div>
                  ${checkpointList.length === 0 ? html6`
                    <div class="empty" style=${{ textAlign: "center", margin: "12px" }}>${t4("changes.checkpointEmpty")}</div>
                  ` : checkpointList.map((c3) => html6`
                    <div
                      key=${c3.id}
                      class="checkpoint-item"
                      style=${{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px", cursor: "pointer", borderRadius: "4px", borderBottom: "1px solid var(--bd)" }}
                      onMouseEnter=${(e3) => {
    e3.currentTarget.style.background = "var(--bg-hover)";
  }}
                      onMouseLeave=${(e3) => {
    e3.currentTarget.style.background = "transparent";
  }}
                    >
                      <div
                        onClick=${() => {
    setSelectedCheckpointId(c3.id);
  }}
                        style=${{ display: "flex", flexDirection: "column", gap: "2px", flex: 1 }}
                      >
                        <span style=${{ fontSize: "13px", fontWeight: 500 }}>${c3.name}</span>
                        <span style=${{ fontSize: "11px", color: "var(--fg-3)" }}>${c3.id.slice(0, 7)} · ${c3.fileCount} file${c3.fileCount === 1 ? "" : "s"}</span>
                      </div>
                      <div style=${{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style=${{ fontSize: "11px", color: "var(--fg-4)" }}>${c3.ago}</span>
                        <button
                          onClick=${async (e3) => {
    e3.stopPropagation();
    if (confirm(t4("changes.restoreConfirm").replace("{name}", c3.name))) {
      try {
        await api("/checkpoint-restore", { method: "POST", body: { id: c3.id } });
        setSelectedCheckpointId(null);
        setDiffSource("git");
      } catch {
        alert("restore failed");
      }
    }
  }}
                          style=${{ fontSize: "11px", padding: "2px 6px", background: "var(--c-brand)", color: "#fff", border: "none", borderRadius: "3px", cursor: "pointer" }}
                        >${t4("changes.restoreBtn")}</button>
                        <button
                          onClick=${async (e3) => {
    e3.stopPropagation();
    if (confirm(t4("changes.deleteConfirm").replace("{name}", c3.name))) {
      try {
        await api("/checkpoint-delete", { method: "POST", body: { id: c3.id } });
        setCheckpointList((prev) => prev.filter((x3) => x3.id !== c3.id));
      } catch {
        alert("delete failed");
      }
    }
  }}
                          style=${{ fontSize: "11px", padding: "2px 6px", color: "var(--fg-3)", border: "1px solid var(--bd)", borderRadius: "3px", cursor: "pointer", background: "transparent" }}
                        >${t4("changes.deleteBtn")}</button>
                      </div>
                    </div>
                  `)}
                </div>
              ` : null}
              <div class="review-diff-view" style=${{ flex: "1", overflowY: "auto" }}>
                <div class="review-diff-list" style=${{ padding: "0 12px" }} key=${diffStyle} dangerouslySetInnerHTML=${{ __html: reviewHtml }}></div>
              </div>
            ` : html6`
              <${TabBar}
                reviewTab=${html6`<${ReviewTab} count=${modifiedCount()} active=${false} onClick=${toggleReviewMode} />`}
                fileList=${diffs.map((d3) => d3.file)}
                onOpenFile=${handleOpenFile}
                files=${openFiles}
                activePath=${activeFilePath}
                onSelect=${setActiveFilePath}
                onClose=${closeFile}
              />
              <${CodeViewer}
                key=${activeFile?.path ?? "empty"}
                file=${activeFile}
                comments=${activeFileComments}
                draft=${draft && draft.file === activeFilePath ? draft : null}
                onStartComment=${startDraft}
                onEditComment=${editComment}
                onCancelComment=${cancelDraft}
                onCommentChange=${setDraftContent}
                onSubmitComment=${submitDraft}
                onDeleteComment=${deleteComment}
              />
            `}
      </div>

      <${ResizeHandle} onResize=${handleRightResize} direction="horizontal" />

      <div class="changes-panel changes-panel-right" style=${{ width: `${rightPct}%` }}>
        <div class="changes-panel-header">
          <span class="glyph">▼</span>
          <span>${t4("changes.fileTreeTitle")}</span>
        </div>
        <${FileTreeToggle}
          showOnlyModified=${showOnlyModified}
          modifiedCount=${modifiedCount()}
          onToggle=${toggleModifiedFilter}
        />
        <div class="changes-panel-body">
          ${loading ? html6`<div class="empty" style=${{ margin: "12px", textAlign: "center" }}>${t4("changes.loadingFiles")}</div>` : html6`<${FileTree}
                nodes=${tree}
                expanded=${expanded}
                onToggle=${toggleExpand}
                onSelect=${(node) => {
    setReviewMode(false);
    openFile(node);
  }}
                modifiedFiles=${modifiedFiles()}
                showOnlyModified=${showOnlyModified}
              />`}
        </div>
      </div>
    </div>
  `;
}
function fmtCost2(usd, currency) {
  if (currency === "CNY" || currency === "\xA5") {
    return `\xA5${(usd * 7.2).toFixed(4)}`;
  }
  return `$${usd.toFixed(4)}`;
}
function ChatStatusBar3({ stats, model }) {
  useLang();
  if (!stats) {
    return html6`
      <div class="chat-statusbar">
        <span class="muted">—</span>
      </div>
    `;
  }
  const ctxPct = stats.contextCapTokens > 0 ? stats.lastPromptTokens / stats.contextCapTokens * 100 : 0;
  const balance = stats.balance && stats.balance.length > 0 ? stats.balance[0] : null;
  return html6`
    <div class="chat-statusbar">
      <span class="status-item">
        <span class="status-label">${t4("chat.statusModel")}</span>
        <code>${model ?? "\u2014"}</code>
      </span>
      <span class="status-item">
        <span class="status-label">${t4("chat.statusCtx")}</span>
        <span class="status-bar-mini">
          <span class="status-bar-mini-fill" style=${`width: ${Math.min(100, ctxPct).toFixed(1)}%;`}></span>
        </span>
        <span class="muted">${stats.lastPromptTokens.toLocaleString()} / ${(stats.contextCapTokens / 1e3).toFixed(0)}K</span>
      </span>
      <span class="status-item">
        <span class="status-label">${t4("chat.statusCache")}</span>
        <span class=${stats.cacheHitRatio >= 0.9 ? "status-ok" : stats.cacheHitRatio >= 0.6 ? "status-warn" : "status-err"}>
          ${(stats.cacheHitRatio * 100).toFixed(1)}%
        </span>
      </span>
      <span class="status-item">
        <span class="status-label">${t4("chat.statusTurn")}</span>
        <code>${fmtCost2(stats.lastTurnCostUsd, balance?.currency)}</code>
      </span>
      <span class="status-item">
        <span class="status-label">${t4("chat.statusSession")}</span>
        <code>${fmtCost2(stats.totalCostUsd, balance?.currency)}</code>
        <span class="muted" style="font-size: 10px;">
          ${t4("chat.statusTurns", { count: stats.turns, s: stats.turns === 1 ? "" : "s" })}
        </span>
      </span>
      ${balance ? html6`
          <span class="status-item">
            <span class="status-label">${t4("chat.statusBalance")}</span>
            <code>${balance.total_balance} ${balance.currency}</code>
          </span>
        ` : null}
    </div>
  `;
}
function CommentCard(props) {
  return html6`
    <div class="comment-card">
      <span class="comment-card-icon">⬥</span>
      <span class="comment-card-file">${props.fileName}:${props.lineNumber}</span>
      <span class="comment-card-content">${props.content}</span>
      <span class="comment-card-remove" onClick=${props.onRemove}>×</span>
    </div>
  `;
}
function filterModifiedNodes(nodes, modifiedFiles) {
  return nodes.map((node) => {
    if (node.isDir && node.children) {
      const filteredChildren = filterModifiedNodes(node.children, modifiedFiles);
      if (filteredChildren.length === 0) return null;
      return { ...node, children: filteredChildren };
    }
    if (modifiedFiles.has(node.path)) return node;
    return null;
  }).filter((n3) => n3 !== null);
}
function renderTree(props) {
  const { nodes, expanded, onToggle, onSelect, indent = 0, modifiedFiles = /* @__PURE__ */ new Set(), showOnlyModified = false } = props;
  const displayNodes = showOnlyModified ? filterModifiedNodes(nodes, modifiedFiles) : nodes;
  return displayNodes.map((node) => {
    const isExpanded = expanded.has(node.path);
    const indentEls = [];
    for (let i3 = 0; i3 < indent; i3++) {
      indentEls.push(html6`<span class="indent" key=${`indent-${i3}`} />`);
    }
    if (node.isDir) {
      const cls2 = isExpanded ? "tree-node open" : "tree-node";
      return html6`
        <div key=${node.path}>
          <div class=${cls2} onClick=${() => onToggle(node.path)}>
            ${indentEls}
            <span class="arrow">${isExpanded ? "\u25BE" : "\u25B8"}</span>
            <span class="icon dir">▼</span>
            <span class="name">${node.name}</span>
          </div>
          ${isExpanded && node.children && node.children.length > 0 ? renderTree({ nodes: node.children, expanded, onToggle, onSelect, indent: indent + 1, modifiedFiles, showOnlyModified }) : null}
          ${isExpanded && (!node.children || node.children.length === 0) ? html6`<div class="tree-node" style=${{ paddingLeft: `${(indent + 1) * 14 + 8}px` }}>
                <span class="name muted">${t4("changes.treeEmpty")}</span>
              </div>` : null}
        </div>
      `;
    }
    const { icon, cls } = getFileIcon(node.name);
    const isModified = modifiedFiles.has(node.path);
    return html6`
      <div
        key=${node.path}
        class="tree-node"
        onClick=${() => onSelect(node)}
        style=${{ paddingLeft: `${indent * 14 + 8}px` }}
      >
        <span class=${`icon ${cls}`}>${icon}</span>
        <span class="name">${node.name}</span>
        ${isModified ? html6`<span class="mod-indicator" />` : null}
      </div>
    `;
  });
}
function FileTree(props) {
  return html6`
    <div class="tree">
      ${renderTree(props)}
    </div>
  `;
}
function FileTreeToggle(props) {
  return html6`
    <div class="file-tree-toggle">
      <button
        class=${`toggle-btn ${props.showOnlyModified ? "active" : ""}`}
        onClick=${props.onToggle}
      >
        ${props.modifiedCount} ${t4("changes.changes")}
      </button>
      <button
        class=${`toggle-btn ${!props.showOnlyModified ? "active" : ""}`}
        onClick=${props.onToggle}
      >
        ${t4("changes.allFiles")}
      </button>
    </div>
  `;
}
function ReviewTab(props) {
  return html6`
    <div
      class=${`editor-tab review-tab${props.active ? " active" : ""}`}
      onClick=${props.onClick}
      style=${{ display: "flex", alignItems: "center", gap: "3px", padding: "4px 6px", cursor: props.onClick ? "pointer" : "default" }}
    >
      <span class="review-icon">◑</span>
      <span>${t4("changes.review")}</span>
      <span style=${{ color: "var(--fg-3)", fontSize: "10.5px" }}>${props.count}</span>
    </div>
  `;
}
function ResizeHandle(props) {
  const { onResize, direction } = props;
  const dragging = A2(false);
  const startX = A2(0);
  const onMouseDown = q2((e3) => {
    e3.preventDefault();
    dragging.current = true;
    startX.current = direction === "horizontal" ? e3.clientX : e3.clientY;
    document.body.style.cursor = direction === "horizontal" ? "col-resize" : "row-resize";
    document.body.style.userSelect = "none";
  }, [direction]);
  y2(() => {
    const onMouseMove = (e3) => {
      if (!dragging.current) return;
      const current = direction === "horizontal" ? e3.clientX : e3.clientY;
      const delta = current - startX.current;
      startX.current = current;
      onResize(delta);
    };
    const onMouseUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [onResize, direction]);
  const isH = direction === "horizontal";
  return html6`
    <div
      onMouseDown=${onMouseDown}
      style=${{
    width: isH ? "4px" : "100%",
    height: isH ? "100%" : "4px",
    cursor: isH ? "col-resize" : "row-resize",
    background: "var(--bd)",
    flexShrink: 0,
    transition: "background 0.15s"
  }}
      onMouseEnter=${(e3) => {
    e3.target.style.background = "var(--c-brand)";
  }}
      onMouseLeave=${(e3) => {
    e3.target.style.background = "var(--bd)";
  }}
    />
  `;
}
function TabBar(props) {
  const { files, activePath, onSelect, onClose, reviewTab, fileList, onOpenFile } = props;
  const popupRef = A2(null);
  const btnRef = A2(null);
  y2(() => {
    const btn = btnRef.current;
    if (!btn || !fileList || fileList.length === 0) return;
    const toggle = (e3) => {
      e3.stopPropagation();
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
        return;
      }
      const allFiles = fileList;
      const popup = document.createElement("div");
      popupRef.current = popup;
      popup.style.cssText = "position:fixed;top:20%;left:50%;transform:translateX(-50%);background:var(--bg-elev-2);border:1px solid var(--bd);border-radius:6px;max-height:400px;display:flex;flex-direction:column;z-index:1000;min-width:380px;max-width:600px;box-shadow:0 8px 24px rgba(0,0,0,.4)";
      const input = document.createElement("input");
      input.placeholder = "\u641C\u7D22\u6587\u4EF6...";
      input.style.cssText = "margin:6px 8px;padding:5px 8px;font-size:12px;background:var(--bg);color:var(--fg-0);border:1px solid var(--bd);border-radius:4px;outline:none;flex-shrink:0";
      input.onclick = (ev) => ev.stopPropagation();
      popup.appendChild(input);
      const listWrap = document.createElement("div");
      listWrap.style.cssText = "overflow-y:auto;flex:1;padding:0 4px 4px";
      popup.appendChild(listWrap);
      function renderList(filter) {
        listWrap.innerHTML = "";
        const q4 = filter.toLowerCase();
        for (const f3 of allFiles) {
          if (q4 && !f3.toLowerCase().includes(q4)) continue;
          const row = document.createElement("div");
          row.textContent = f3;
          row.style.cssText = "padding:3px 8px;font-size:11px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:var(--font-mono);border-radius:3px";
          row.onmouseenter = () => row.style.background = "var(--bg-hover)";
          row.onmouseleave = () => row.style.background = "transparent";
          row.onclick = (ev) => {
            ev.stopPropagation();
            onOpenFile?.(f3);
            popup.remove();
            popupRef.current = null;
          };
          listWrap.appendChild(row);
        }
      }
      renderList("");
      input.oninput = () => renderList(input.value);
      setTimeout(() => input.focus(), 50);
      document.body.appendChild(popup);
      const close = (ev) => {
        if (popupRef.current && !popup.contains(ev.target) && ev.target !== btn) {
          popup.remove();
          popupRef.current = null;
          document.removeEventListener("mousedown", close, true);
        }
      };
      document.addEventListener("mousedown", close, true);
    };
    btn.addEventListener("click", toggle);
    return () => {
      btn.removeEventListener("click", toggle);
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
    };
  }, [fileList, onOpenFile]);
  return html6`
    <div class="editor-tabs">
      ${reviewTab || null}
      ${fileList ? html6`
        <span
          ref=${btnRef}
          style=${{
    fontSize: "14px",
    padding: "4px 3px",
    cursor: "pointer",
    color: "var(--fg-3)",
    userSelect: "none",
    lineHeight: "1",
    fontFamily: "var(--font-mono)"
  }}
          title="Open file"
        >+</span>
      ` : null}
      ${files.map((f3) => html6`
        <div
          key=${f3.path}
          class=${`editor-tab ${f3.path === activePath ? "active" : ""}`}
          onClick=${() => onSelect(f3.path)}
          title=${f3.path}
        >
          <span>${f3.name}</span>
          <span
            class="x"
            onClick=${(e3) => {
    e3.stopPropagation();
    onClose(f3.path);
  }}
            title=${t4("changes.tabClose")}
          >×</span>
        </div>
      `)}
    </div>
  `;
}
function CodeViewer(props) {
  const { file, comments = [], draft, onStartComment, onEditComment, onCancelComment, onCommentChange, onSubmitComment, onDeleteComment } = props;
  const codeRef = A2(null);
  const [hoveredLine, setHoveredLine] = d2(null);
  y2(() => {
    if (!file) return;
    const el = codeRef.current;
    if (!el) return;
    el.innerHTML = "";
    const lines = file.content.split("\n");
    const commentsByLine = /* @__PURE__ */ new Map();
    comments.forEach((c3) => {
      const existing = commentsByLine.get(c3.lineNumber) || [];
      existing.push(c3);
      commentsByLine.set(c3.lineNumber, existing);
    });
    lines.forEach((line, i3) => {
      const lineNumber = i3 + 1;
      const lineComments = commentsByLine.get(lineNumber) || [];
      const hasComments = lineComments.length > 0;
      const lineDiv = document.createElement("div");
      lineDiv.className = "editor-line";
      lineDiv.dataset.lineNumber = String(lineNumber);
      lineDiv.style.position = "relative";
      lineDiv.addEventListener("mouseenter", () => setHoveredLine(lineNumber));
      lineDiv.addEventListener("mouseleave", () => setHoveredLine(null));
      const gutter = document.createElement("div");
      gutter.className = "lineno";
      gutter.textContent = String(lineNumber);
      gutter.style.position = "relative";
      gutter.style.display = "flex";
      gutter.style.alignItems = "center";
      gutter.style.justifyContent = "center";
      gutter.style.gap = "4px";
      if (onStartComment) {
        const isVisible = hoveredLine === lineNumber && (!draft || draft.file !== file.path || draft.lineNumber !== lineNumber);
        const anchorBtn = document.createElement("span");
        anchorBtn.className = `line-comment-anchor ${isVisible ? "visible" : ""}`;
        anchorBtn.style.cssText = "width:16px;height:16px;display:flex;align-items:center;justify-content:center;opacity:0;pointer-events:none;cursor:pointer;transition:opacity 0.15s ease;flex-shrink:0;";
        if (isVisible) {
          anchorBtn.style.opacity = "1";
          anchorBtn.style.pointerEvents = "auto";
        }
        if (hasComments) {
          anchorBtn.innerHTML = `<span class="comment-count" style="background:rgba(121,192,255,0.12);border-radius:2px;padding:0 3px;font-size:10px;color:#79c0ff;font-family:monospace;">${lineComments.length}</span>`;
        } else {
          anchorBtn.innerHTML = `<span class="plus-icon" style="font-family:monospace;font-size:14px;color:#6e7681;line-height:1;">+</span>`;
        }
        anchorBtn.addEventListener("mouseenter", () => {
          anchorBtn.style.opacity = "1";
        });
        anchorBtn.addEventListener("click", (e3) => {
          e3.stopPropagation();
          onStartComment(file.path, lineNumber);
        });
        gutter.appendChild(anchorBtn);
      }
      const content = document.createElement("span");
      content.className = "ln-content";
      content.textContent = line || " ";
      lineDiv.appendChild(gutter);
      lineDiv.appendChild(content);
      el.appendChild(lineDiv);
      if (draft && draft.file === file.path && draft.lineNumber === lineNumber) {
        const editorContainer = document.createElement("div");
        editorContainer.className = "line-comment-editor";
        const labelDiv = document.createElement("div");
        labelDiv.className = "line-comment-label";
        labelDiv.textContent = `${t4("changes.commentLabel")} ${lineNumber}`;
        const textarea = document.createElement("textarea");
        textarea.className = "line-comment-textarea";
        textarea.placeholder = t4("changes.commentPlaceholder");
        textarea.rows = 2;
        textarea.value = draft.content;
        let isComposing = false;
        textarea.addEventListener("compositionstart", () => {
          isComposing = true;
        });
        textarea.addEventListener("compositionend", (e3) => {
          isComposing = false;
          if (onCommentChange) onCommentChange(e3.target.value);
        });
        textarea.addEventListener("input", (e3) => {
          if (!isComposing && onCommentChange) onCommentChange(e3.target.value);
        });
        textarea.addEventListener("keydown", (e3) => {
          if (e3.key === "Escape" && onCancelComment) {
            e3.preventDefault();
            onCancelComment();
          } else if (e3.key === "Enter" && e3.ctrlKey && onSubmitComment) {
            e3.preventDefault();
            onSubmitComment();
          }
        });
        const actionsDiv = document.createElement("div");
        actionsDiv.className = "line-comment-actions";
        actionsDiv.style.cssText = "display:flex;gap:4px;justify-content:flex-end;";
        const cancelBtn = document.createElement("button");
        cancelBtn.className = "btn ghost";
        cancelBtn.textContent = t4("changes.commentCancel");
        cancelBtn.style.cssText = "background:transparent;border:none;color:#6e7681;padding:3px 8px;font-size:11px;cursor:pointer;";
        cancelBtn.addEventListener("click", () => {
          if (onCancelComment) onCancelComment();
        });
        const submitBtn = document.createElement("button");
        submitBtn.className = "btn primary";
        submitBtn.textContent = t4("changes.commentSubmit");
        submitBtn.style.cssText = "background:#79c0ff;color:#0a0c10;border:none;padding:3px 8px;font-size:11px;cursor:pointer;border-radius:2px;font-weight:600;";
        submitBtn.disabled = !draft.content.trim();
        submitBtn.addEventListener("click", () => {
          if (onSubmitComment) onSubmitComment();
        });
        actionsDiv.appendChild(cancelBtn);
        actionsDiv.appendChild(submitBtn);
        editorContainer.appendChild(labelDiv);
        editorContainer.appendChild(textarea);
        editorContainer.appendChild(actionsDiv);
        el.appendChild(editorContainer);
        setTimeout(() => textarea.focus(), 0);
      }
      if (hasComments) {
        lineComments.forEach((comment) => {
          if (el.querySelector(`.line-comment-bubble[data-id="${comment.id}"]`)) return;
          const isEditing = draft && draft.editingId === comment.id;
          if (isEditing) return;
          const bubbleDiv = document.createElement("div");
          bubbleDiv.className = "line-comment-bubble";
          bubbleDiv.dataset.id = comment.id;
          const contentDiv = document.createElement("div");
          contentDiv.className = "bubble-content";
          contentDiv.textContent = comment.content;
          const footerDiv = document.createElement("div");
          footerDiv.className = "bubble-footer";
          const lineSpan = document.createElement("span");
          lineSpan.className = "bubble-line";
          lineSpan.textContent = `\u8BC4\u8BBA\u7B2C ${comment.lineNumber} \u884C`;
          const actionsDiv = document.createElement("div");
          actionsDiv.className = "bubble-actions";
          actionsDiv.style.display = "flex";
          actionsDiv.style.gap = "4px";
          if (onEditComment) {
            const editBtn = document.createElement("button");
            editBtn.className = "bubble-btn";
            editBtn.textContent = "\u7F16\u8F91";
            editBtn.style.cssText = "background:transparent;border:none;color:#6e7681;padding:3px 8px;font-size:11px;cursor:pointer;border-radius:2px;";
            editBtn.addEventListener("click", (e3) => {
              e3.stopPropagation();
              onEditComment(comment.id, comment.content);
            });
            actionsDiv.appendChild(editBtn);
          }
          if (onDeleteComment) {
            const deleteBtn = document.createElement("button");
            deleteBtn.className = "bubble-btn danger";
            deleteBtn.textContent = "\u5220\u9664";
            deleteBtn.style.cssText = "background:transparent;border:none;color:#6e7681;padding:3px 8px;font-size:11px;cursor:pointer;border-radius:2px;";
            deleteBtn.addEventListener("click", (e3) => {
              e3.stopPropagation();
              onDeleteComment(comment.id);
            });
            actionsDiv.appendChild(deleteBtn);
          }
          footerDiv.appendChild(lineSpan);
          footerDiv.appendChild(actionsDiv);
          bubbleDiv.appendChild(contentDiv);
          bubbleDiv.appendChild(footerDiv);
          el.appendChild(bubbleDiv);
        });
      }
    });
    if (common_default) {
      const codeEl = codeRef.current;
      if (codeEl) {
        codeEl.querySelectorAll(".ln-content").forEach((span) => {
          const text = span.textContent ?? "";
          try {
            const result = common_default.highlight(text, { language: file.language, ignoreIllegals: true });
            span.innerHTML = result.value;
          } catch {
            span.textContent = text;
          }
        });
      }
    }
  }, [file, comments, draft]);
  y2(() => {
    if (!codeRef.current || !file) return;
    const anchors = codeRef.current.querySelectorAll(".line-comment-anchor");
    anchors.forEach((anchor) => {
      const lineDiv = anchor.closest(".editor-line");
      if (!lineDiv) return;
      const lineNumber = parseInt(lineDiv.dataset.lineNumber || "0", 10);
      const isVisible = hoveredLine === lineNumber && (!draft || draft.file !== file.path || draft.lineNumber !== lineNumber);
      anchor.style.opacity = isVisible ? "1" : "0";
      anchor.style.pointerEvents = isVisible ? "auto" : "none";
    });
  }, [hoveredLine, draft, file]);
  if (!file) {
    return html6`
      <div class="editor-area" style=${{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div class="empty">${t4("changes.viewerPlaceholder")}</div>
      </div>
    `;
  }
  return html6`
    <div class="editor-area" ref=${codeRef} />
    <div class="editor-status">
      <span class="glyph">◆</span>
      <span class="v">${file.name}</span>
      <span class="grow"></span>
      <span>${file.language}</span>
      <span class="v">${String(file.content.split("\n").length)} lines</span>
    </div>
  `;
}
function ChatPane(props) {
  useLang();
  const [messages, setMessages] = d2([]);
  const [streaming, setStreaming] = d2(null);
  const [activeTool, setActiveTool] = d2(null);
  const [busy, setBusy] = d2(false);
  const [input, setInput] = d2("");
  const [error, setError] = d2(null);
  const [statusLine, setStatusLine] = d2(null);
  const [stats, setStats] = d2(null);
  const [model, setModel] = d2(null);
  const shouldAutoScroll = A2(true);
  const feedRef = A2(null);
  const streamBufRef = A2(null);
  const streamRafRef = A2(null);
  const autoScrollInFlight = A2(false);
  const [slashCommands, setSlashCommands] = d2([]);
  const [popoverKind, setPopoverKind] = d2(null);
  const [popoverItems, setPopoverItems] = d2([]);
  const [popoverSel, setPopoverSel] = d2(0);
  y2(() => {
    let cancelled = false;
    (async () => {
      try {
        const r3 = await api("/slash");
        if (!cancelled) setSlashCommands(r3.commands);
      } catch {
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  y2(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api("/messages");
        if (!cancelled) {
          setMessages(data.messages ?? []);
          setBusy(Boolean(data.busy));
        }
      } catch {
        if (!cancelled) setMessages([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  y2(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const data = await api("/overview");
        if (cancelled) return;
        setStats(data.stats ?? null);
        setModel(data.model ?? null);
      } catch {
      }
    };
    tick();
    const t5 = setInterval(tick, 5e3);
    return () => {
      cancelled = true;
      clearInterval(t5);
    };
  }, []);
  const flushStreaming = q2(() => {
    streamRafRef.current = null;
    if (streamBufRef.current) setStreaming(streamBufRef.current);
  }, []);
  const cancelStreamingRaf = q2(() => {
    if (streamRafRef.current !== null) {
      cancelAnimationFrame(streamRafRef.current);
      streamRafRef.current = null;
    }
    streamBufRef.current = null;
  }, []);
  const refetchCanonicalState = q2(async () => {
    try {
      const data = await api("/messages");
      setMessages(data.messages ?? []);
      setBusy(Boolean(data.busy));
      cancelStreamingRaf();
      setStreaming(null);
      setActiveTool(null);
    } catch {
    }
  }, [cancelStreamingRaf]);
  y2(() => {
    const es = new EventSource(`/api/events?token=${TOKEN}`);
    let firstOpen = true;
    es.onopen = () => {
      if (firstOpen) {
        firstOpen = false;
        return;
      }
      void refetchCanonicalState();
    };
    es.onmessage = (ev) => {
      let dash;
      try {
        dash = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (dash.kind === "ping") return;
      if (dash.kind === "busy-change") {
        setBusy(dash.busy);
        return;
      }
      if (dash.kind === "user") {
        setMessages((prev) => [...prev, { id: dash.id, role: "user", text: dash.text }]);
        return;
      }
      if (dash.kind === "assistant_delta") {
        const cur = streamBufRef.current;
        const baseId = cur?.id === dash.id ? cur : null;
        streamBufRef.current = {
          id: dash.id,
          text: (baseId?.text ?? "") + (dash.contentDelta ?? ""),
          reasoning: (baseId?.reasoning ?? "") + (dash.reasoningDelta ?? "")
        };
        if (streamRafRef.current === null) {
          streamRafRef.current = requestAnimationFrame(flushStreaming);
        }
        return;
      }
      if (dash.kind === "assistant_final") {
        cancelStreamingRaf();
        setStreaming(null);
        setMessages((prev) => [
          ...prev,
          { id: dash.id, role: "assistant", text: dash.text, reasoning: dash.reasoning }
        ]);
        return;
      }
      if (dash.kind === "tool_start") {
        setActiveTool({ id: dash.id, toolName: dash.toolName, args: dash.args });
        return;
      }
      if (dash.kind === "tool") {
        setActiveTool((cur) => cur && cur.id === dash.id ? null : cur);
        setMessages((prev) => [
          ...prev,
          { id: dash.id, role: "tool", text: dash.content, toolName: dash.toolName, toolArgs: dash.args }
        ]);
        return;
      }
      if (dash.kind === "warning" || dash.kind === "error" || dash.kind === "info") {
        if (dash.kind === "error") setActiveTool(null);
        setMessages((prev) => [...prev, { id: dash.id, role: dash.kind, text: dash.text }]);
        return;
      }
      if (dash.kind === "status") {
        setStatusLine(dash.text);
        setTimeout(() => setStatusLine((cur) => cur === dash.text ? null : cur), 5e3);
        return;
      }
    };
    es.onerror = () => {
      setError(t4("chat.eventStreamError"));
      setTimeout(() => setError(null), 3e3);
    };
    return () => {
      es.close();
      cancelStreamingRaf();
    };
  }, [refetchCanonicalState, cancelStreamingRaf]);
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
  y2(() => {
    const el = feedRef.current;
    if (!el) return;
    const onScroll = () => {
      if (autoScrollInFlight.current) return;
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      shouldAutoScroll.current = distFromBottom < 80;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);
  const updatePopover = q2(
    async (text) => {
      const slashMatch = /^\/([A-Za-z0-9_-]*)$/.exec(text);
      if (slashMatch) {
        const prefix = slashMatch[1].toLowerCase();
        const items = slashCommands.filter((c3) => c3.cmd.startsWith(prefix)).slice(0, 12).map((c3) => ({
          label: `/${c3.cmd}`,
          meta: c3.summary,
          insert: `/${c3.cmd}${c3.argsHint ? " " : ""}`
        }));
        setPopoverKind("slash");
        setPopoverItems(items);
        setPopoverSel(0);
        return;
      }
      setPopoverKind(null);
    },
    [slashCommands]
  );
  const applyPopover = q2(() => {
    const item = popoverItems[popoverSel];
    if (!item) return false;
    setInput(item.insert);
    setPopoverKind(null);
    return true;
  }, [popoverItems, popoverSel, popoverKind, input]);
  const onInput = q2(
    (e3) => {
      const v3 = e3.target.value;
      setInput(v3);
      updatePopover(v3);
    },
    [updatePopover]
  );
  const send = q2(async () => {
    const text = input.trim();
    if (busy) return;
    if (!text && props.comments.length === 0) return;
    setError(null);
    let prompt = text;
    if (props.comments.length > 0) {
      const commentRefs = props.comments.map((c3) => `\u{1F4DD} ${c3.file}:${c3.lineNumber} ${c3.content}`).join("\n");
      prompt = text ? `${text}

${commentRefs}` : commentRefs;
    }
    try {
      const res = await api("/submit", {
        method: "POST",
        body: { prompt }
      });
      if (!res.accepted) {
        setError(res.reason ?? "rejected");
        return;
      }
      setInput("");
      props.comments.forEach((c3) => props.deleteComment(c3.id));
    } catch (err) {
      setError(err.message);
    }
  }, [input, busy, props.comments]);
  const abort = q2(async () => {
    try {
      await api("/abort", { method: "POST" });
    } catch {
    }
  }, []);
  const newConversation = q2(async () => {
    if (busy) {
      if (!confirm(t4("changes.newConfirmBusy"))) return;
    } else if (messages.length > 0 && !confirm(t4("changes.newConfirm"))) {
      return;
    }
    try {
      await api("/submit", { method: "POST", body: { prompt: "/new" } });
      setMessages([]);
      setStreaming(null);
      setActiveTool(null);
      showToast(t4("changes.newToast"), "info");
      setTimeout(async () => {
        try {
          const r3 = await api("/messages");
          setMessages(r3.messages ?? []);
        } catch {
        }
      }, 200);
    } catch (err) {
      setError(t4("changes.newFailed", { error: err.message }));
    }
  }, [busy, messages.length]);
  const clearScrollback = q2(async () => {
    try {
      await api("/submit", { method: "POST", body: { prompt: "/clear" } });
      setMessages([]);
      setStreaming(null);
      setActiveTool(null);
      showToast(t4("changes.clearToast"), "info");
      setTimeout(async () => {
        try {
          const r3 = await api("/messages");
          setMessages(r3.messages ?? []);
        } catch {
        }
      }, 200);
    } catch (err) {
      setError(t4("changes.clearFailed", { error: err.message }));
    }
  }, []);
  const onKeyDown = q2((e3) => {
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
        if (applyPopover() && e3.key === "Enter" && popoverKind === "slash") send();
        return;
      }
      if (e3.key === "Escape") {
        e3.preventDefault();
        setPopoverKind(null);
        return;
      }
    }
    if (e3.key === "Escape" && busy) {
      e3.preventDefault();
      abort();
      return;
    }
    if (e3.key === "Enter" && !e3.shiftKey) {
      e3.preventDefault();
      send();
    }
  }, [send, abort, busy, popoverKind, popoverItems, applyPopover]);
  const allMessages = streaming ? [...messages, { id: streaming.id, role: "assistant", text: streaming.text, reasoning: streaming.reasoning }] : messages;
  return html6`
    <div style=${{ display: "flex", flexDirection: "column", height: "100%" }}>
      ${statusLine ? html6`<div class="changes-panel-header"><span>${statusLine}</span></div>` : null}
      <div class="chat-feed" style=${{ flex: 1, overflowY: "auto", padding: "8px" }} ref=${feedRef}>
        ${allMessages.length === 0 && !streaming ? html6`<div class="empty" style=${{ margin: "12px", textAlign: "center" }}>${t4("changes.chatWelcome")}</div>` : null}
        ${allMessages.map((msg) => {
    const isStreaming = streaming && msg.id === streaming.id;
    if (msg.role === "tool") {
      return html6`
              <div class="chat-msg tool" key=${msg.id}>
                <div class="glyph">▣</div>
                <${ToolCard} msg=${msg} />
              </div>
            `;
    }
    return html6`
            <${ChatMessage}
              key=${msg.id}
              msg=${{ id: msg.id, role: msg.role, text: msg.text, reasoning: msg.reasoning, toolName: msg.toolName, toolArgs: msg.toolArgs }}
              streaming=${Boolean(isStreaming)}
            />
          `;
  })}
      </div>
      ${error ? html6`<div class="notice err" style=${{ margin: "0 8px 4px" }}>${error}</div>` : null}
      <div style=${{ padding: "8px", borderTop: "1px solid var(--bd)", flexShrink: 0 }}>
        ${props.comments.length > 0 ? html6`
          <div class="comment-cards-container" style=${{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "8px" }}>
            ${props.comments.map((comment) => html6`
              <${CommentCard}
                key=${comment.id}
                fileName=${comment.file}
                lineNumber=${comment.lineNumber}
                content=${comment.content}
                onRemove=${() => props.deleteComment(comment.id)}
              />
            `)}
          </div>
        ` : null}
        <div style=${{ display: "flex", gap: "8px", alignItems: "flex-end", position: "relative" }}>
          <div style=${{ flex: 1, position: "relative" }}>
            ${popoverKind && popoverItems.length > 0 ? html6`
                  <div class="popover" style="position:absolute;bottom:calc(100% + 6px);left:0;width:380px;max-height:280px;overflow-y:auto;z-index:10">
                    <div class="popover-h">${t4("chat.slashCommands")}</div>
                    ${popoverItems.map(
    (it, i3) => html6`
                        <div
                          class=${`popover-row ${i3 === popoverSel ? "sel" : ""}`}
                          onMouseDown=${(e3) => {
      e3.preventDefault();
      setPopoverSel(i3);
      applyPopover();
    }}
                        >
                          <span class="g">/</span>
                          <span class="name">${it.label}</span>
                          ${it.meta ? html6`<span class="meta">${it.meta}</span>` : null}
                        </div>
                      `
  )}
                  </div>
                ` : null}
            <textarea
              class="input"
              style=${{ width: "100%", resize: "none", minHeight: "36px", fontFamily: "inherit", fontSize: "13px", padding: "8px 10px", lineHeight: "1.4", background: "var(--bg-input)", border: "1px solid var(--bd)", borderRadius: "4px", color: "var(--fg-0)" }}
              placeholder=${props.comments.length > 0 ? "\u603B\u7ED3\u8BC4\u8BBA..." : t4("changes.chatPlaceholder")}
              value=${input}
              onInput=${onInput}
              onKeyDown=${onKeyDown}
              onBlur=${() => setTimeout(() => setPopoverKind(null), 150)}
              rows="2"
            />
          </div>
          <div style=${{ display: "flex", flexDirection: "column", gap: "6px", flexShrink: 0 }}>
            <button class="primary" onClick=${send} disabled=${busy || !input.trim() && props.comments.length === 0} style=${{ padding: "8px 12px", borderRadius: "4px" }}>${t4("changes.chatSend")}</button>
            <div style=${{ display: "flex", gap: "6px" }}>
              <button onClick=${newConversation} title=${t4("changes.newTitle")}>${t4("changes.newConversation")}</button>
              <button onClick=${clearScrollback} title=${t4("changes.clearTitle")}>${t4("changes.clearConversation")}</button>
            </div>
          </div>
        </div>
      </div>
      <${ChatStatusBar3} stats=${stats} model=${model} />
    </div>
  `;
}

// dashboard/app.js
var html7 = htm_module_default.bind(k);
function tabSections() {
  return [
    {
      label: t4("app.sectionWorkspace"),
      tabs: [
        { id: "chat", name: t4("app.tabChat"), glyph: "\u25C6", panel: () => html7`<${ChatPanel} />` },
        { id: "sessions", name: t4("app.tabSessions"), glyph: "\u203A", panel: () => html7`<${SessionsPanel} />` },
        { id: "plans", name: t4("app.tabPlans"), glyph: "\u229E", panel: () => html7`<${PlansPanel} />` }
      ]
    },
    {
      label: t4("app.sectionChanges"),
      tabs: [
        { id: "changes", name: t4("app.tabChanges"), glyph: "\u25A8", panel: () => html7`<${ChangesPanel} />` }
      ]
    },
    {
      label: t4("app.sectionObserve"),
      tabs: [
        { id: "overview", name: t4("app.tabOverview"), glyph: "\u25C8", panel: () => html7`<${OverviewPanel} />` },
        { id: "health", name: t4("app.tabSystem"), glyph: "+", panel: () => html7`<${SystemPanel} />` },
        { id: "semantic", name: t4("app.tabSemantic"), glyph: "\u2248", panel: () => html7`<${SemanticPanel} />` }
      ]
    },
    {
      label: t4("app.sectionConfigure"),
      tabs: [
        { id: "tools", name: t4("app.tabTools"), glyph: "\u25A3", panel: () => html7`<${ToolsPanel} />` },
        { id: "permissions", name: t4("app.tabPermissions"), glyph: "\u258E", panel: () => html7`<${PermissionsPanel} />` },
        { id: "mcp", name: t4("app.tabMcp"), glyph: "M", panel: () => html7`<${McpPanel} />` },
        { id: "skills", name: t4("app.tabSkills"), glyph: "S", panel: () => html7`<${SkillsPanel} />` },
        { id: "memory", name: t4("app.tabMemory"), glyph: "\xB7", panel: () => html7`<${MemoryPanel} />` },
        { id: "hooks", name: t4("app.tabHooks"), glyph: "H", panel: () => html7`<${HooksPanel} />` },
        { id: "settings", name: t4("app.tabSettings"), glyph: "\u2318", panel: () => html7`<${SettingsPanel} />` }
      ]
    }
  ];
}
function App() {
  useLang();
  y2(() => {
    initLangFromServer();
  }, []);
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
  const [wsRoot, setWsRoot] = d2(null);
  const [version2, setVersion] = d2(null);
  const [buildDate2, setBuildDate] = d2(null);
  y2(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const data = await api("/health");
        if (!cancelled) { setWsRoot(data.cwd ?? null); setVersion(data.version ?? null); setBuildDate(data.buildDate ?? null); }
      } catch {}
    };
    tick();
    const id = setInterval(tick, 8e3);
    return () => { cancelled = true; clearInterval(id); };
  }, []);
  const TAB_SECTIONS = tabSections();
  const ALL_TABS = TAB_SECTIONS.flatMap((s3) => s3.tabs);
  const active = ALL_TABS.find((t5) => t5.id === activeId) ?? ALL_TABS[0];
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
  return html7`
    <div class=${`app ${sidebarCollapsed ? "collapsed" : ""}`}>
      <aside class="app-side">
        <div class="brand">
          <span class="glyph">◈</span>
          <img src="/assets/v3.png" alt="" height="13" style="flex-shrink:0" />
        </div>
        <div class="side-tabs">
          ${TAB_SECTIONS.map(
    (section, i) => html7`
              <div class="side-section">${section.label}</div>
              ${section.tabs.map(
      (tab) => html7`
                  <div
                    class=${`side-tab ${tab.id === active.id ? "active" : ""}`}
                    onClick=${() => pickTab(tab.id)}
                    title=${tab.name}
                  >
                    <span class="g">${tab.glyph}</span>
                    <span class="label">${tab.name}</span>
                  </div>
                `
    )}
              ${i === 0 ? html7`
                  <div class="side-tab" onClick=${() => api("/open-url", { method: "POST", body: { url: "https://oa.visionox.com:8086/gvo/mainPortal/index.html" } }).catch(() => {})} title="\u529E\u516C OA"><span class="g">O</span><span class="label">OA</span></div>
                  <div class="side-tab" onClick=${() => api("/open-url", { method: "POST", body: { url: "https://cloud.siliconflow.cn/i/1vfZWEo7" } }).catch(() => {})} title="SiliconFlow API"><span class="g">A</span><span class="label">API</span></div>
                ` : null}
            `
  )}
        </div>
        <div style="padding:6px 16px;display:flex;justify-content:flex-start">
          <select class="theme-select" style="width:100%;font-size:11px;padding:2px 4px;background:var(--surface-input);color:var(--text-primary);border:1px solid var(--border-default);border-radius:3px;cursor:pointer" onChange=${(e3) => { const v = e3.target.value; document.documentElement.setAttribute("data-theme", v); try { document.cookie = "visionox-theme=" + v + ";path=/;max-age=31536000"; } catch {}; }} value=${(typeof document !== 'undefined' && document.documentElement.getAttribute("data-theme")) || "light"}>
            <option value="light">\u6D45\u8272</option>
            <option value="dark">\u6DF1\u8272</option>
            <option value="warm-sand">\u6696\u6C99</option>
            <option value="cool-ash">\u51B7\u7070</option>
            <option value="soft-sage">\u67D4\u7EFF</option>
          </select>
        </div>
        <div class="side-foot">
          <span class="label">127.0.0.1</span>
          <span
            class="toggle"
            title=${sidebarCollapsed ? "expand" : "collapse"}
            onClick=${() => setSidebarCollapsed((c3) => !c3)}
          >${sidebarCollapsed ? "\xBB" : "\xAB"}</span>
        </div>
      </aside>
      <header class="app-top">
        <span class="ws">
          <span class="path">Visionox</span>
          <span class="sep">·</span>
          <span class="session" style="color:#1a3a5c;font-family:'Microsoft YaHei','微软雅黑',var(--font-sans);font-size:15px">维信诺协同办公平台</span>
        </span>
        <span class="grow"></span>
        <span class="meter">
          ${wsRoot ? html7`<span class="v">${wsRoot}</span>` : null}
          <span class="sep">·</span>
          <span class="lbl">@${(new Date).getFullYear()}</span>
          ${version2 && buildDate2 ? html7`<span class="sep">·</span><span class="v">Ver${version2}-${buildDate2}</span>` : version2 ? html7`<span class="sep">·</span><span class="v">Ver${version2}</span>` : null}
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
//# sourceMappingURL=app.js.map