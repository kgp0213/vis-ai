#!/usr/bin/env node
import { createRequire as __cr } from 'node:module'; if (typeof globalThis.require === 'undefined') { globalThis.require = __cr(import.meta.url); }
import {
  __commonJS,
  __toESM
} from "./chunk-TUK7OWJA.js";

// node_modules/picomatch/lib/constants.js
var require_constants = __commonJS({
  "node_modules/picomatch/lib/constants.js"(exports, module) {
    "use strict";
    var WIN_SLASH = "\\\\/";
    var WIN_NO_SLASH = `[^${WIN_SLASH}]`;
    var DEFAULT_MAX_EXTGLOB_RECURSION = 0;
    var DOT_LITERAL = "\\.";
    var PLUS_LITERAL = "\\+";
    var QMARK_LITERAL = "\\?";
    var SLASH_LITERAL = "\\/";
    var ONE_CHAR = "(?=.)";
    var QMARK = "[^/]";
    var END_ANCHOR = `(?:${SLASH_LITERAL}|$)`;
    var START_ANCHOR = `(?:^|${SLASH_LITERAL})`;
    var DOTS_SLASH = `${DOT_LITERAL}{1,2}${END_ANCHOR}`;
    var NO_DOT = `(?!${DOT_LITERAL})`;
    var NO_DOTS = `(?!${START_ANCHOR}${DOTS_SLASH})`;
    var NO_DOT_SLASH = `(?!${DOT_LITERAL}{0,1}${END_ANCHOR})`;
    var NO_DOTS_SLASH = `(?!${DOTS_SLASH})`;
    var QMARK_NO_DOT = `[^.${SLASH_LITERAL}]`;
    var STAR = `${QMARK}*?`;
    var SEP = "/";
    var POSIX_CHARS = {
      DOT_LITERAL,
      PLUS_LITERAL,
      QMARK_LITERAL,
      SLASH_LITERAL,
      ONE_CHAR,
      QMARK,
      END_ANCHOR,
      DOTS_SLASH,
      NO_DOT,
      NO_DOTS,
      NO_DOT_SLASH,
      NO_DOTS_SLASH,
      QMARK_NO_DOT,
      STAR,
      START_ANCHOR,
      SEP
    };
    var WINDOWS_CHARS = {
      ...POSIX_CHARS,
      SLASH_LITERAL: `[${WIN_SLASH}]`,
      QMARK: WIN_NO_SLASH,
      STAR: `${WIN_NO_SLASH}*?`,
      DOTS_SLASH: `${DOT_LITERAL}{1,2}(?:[${WIN_SLASH}]|$)`,
      NO_DOT: `(?!${DOT_LITERAL})`,
      NO_DOTS: `(?!(?:^|[${WIN_SLASH}])${DOT_LITERAL}{1,2}(?:[${WIN_SLASH}]|$))`,
      NO_DOT_SLASH: `(?!${DOT_LITERAL}{0,1}(?:[${WIN_SLASH}]|$))`,
      NO_DOTS_SLASH: `(?!${DOT_LITERAL}{1,2}(?:[${WIN_SLASH}]|$))`,
      QMARK_NO_DOT: `[^.${WIN_SLASH}]`,
      START_ANCHOR: `(?:^|[${WIN_SLASH}])`,
      END_ANCHOR: `(?:[${WIN_SLASH}]|$)`,
      SEP: "\\"
    };
    var POSIX_REGEX_SOURCE = {
      __proto__: null,
      alnum: "a-zA-Z0-9",
      alpha: "a-zA-Z",
      ascii: "\\x00-\\x7F",
      blank: " \\t",
      cntrl: "\\x00-\\x1F\\x7F",
      digit: "0-9",
      graph: "\\x21-\\x7E",
      lower: "a-z",
      print: "\\x20-\\x7E ",
      punct: "\\-!\"#$%&'()\\*+,./:;<=>?@[\\]^_`{|}~",
      space: " \\t\\r\\n\\v\\f",
      upper: "A-Z",
      word: "A-Za-z0-9_",
      xdigit: "A-Fa-f0-9"
    };
    module.exports = {
      DEFAULT_MAX_EXTGLOB_RECURSION,
      MAX_LENGTH: 1024 * 64,
      POSIX_REGEX_SOURCE,
      // regular expressions
      REGEX_BACKSLASH: /\\(?![*+?^${}(|)[\]])/g,
      REGEX_NON_SPECIAL_CHARS: /^[^@![\].,$*+?^{}()|\\/]+/,
      REGEX_SPECIAL_CHARS: /[-*+?.^${}(|)[\]]/,
      REGEX_SPECIAL_CHARS_BACKREF: /(\\?)((\W)(\3*))/g,
      REGEX_SPECIAL_CHARS_GLOBAL: /([-*+?.^${}(|)[\]])/g,
      REGEX_REMOVE_BACKSLASH: /(?:\[.*?[^\\]\]|\\(?=.))/g,
      // Replace globs with equivalent patterns to reduce parsing time.
      REPLACEMENTS: {
        __proto__: null,
        "***": "*",
        "**/**": "**",
        "**/**/**": "**"
      },
      // Digits
      CHAR_0: 48,
      /* 0 */
      CHAR_9: 57,
      /* 9 */
      // Alphabet chars.
      CHAR_UPPERCASE_A: 65,
      /* A */
      CHAR_LOWERCASE_A: 97,
      /* a */
      CHAR_UPPERCASE_Z: 90,
      /* Z */
      CHAR_LOWERCASE_Z: 122,
      /* z */
      CHAR_LEFT_PARENTHESES: 40,
      /* ( */
      CHAR_RIGHT_PARENTHESES: 41,
      /* ) */
      CHAR_ASTERISK: 42,
      /* * */
      // Non-alphabetic chars.
      CHAR_AMPERSAND: 38,
      /* & */
      CHAR_AT: 64,
      /* @ */
      CHAR_BACKWARD_SLASH: 92,
      /* \ */
      CHAR_CARRIAGE_RETURN: 13,
      /* \r */
      CHAR_CIRCUMFLEX_ACCENT: 94,
      /* ^ */
      CHAR_COLON: 58,
      /* : */
      CHAR_COMMA: 44,
      /* , */
      CHAR_DOT: 46,
      /* . */
      CHAR_DOUBLE_QUOTE: 34,
      /* " */
      CHAR_EQUAL: 61,
      /* = */
      CHAR_EXCLAMATION_MARK: 33,
      /* ! */
      CHAR_FORM_FEED: 12,
      /* \f */
      CHAR_FORWARD_SLASH: 47,
      /* / */
      CHAR_GRAVE_ACCENT: 96,
      /* ` */
      CHAR_HASH: 35,
      /* # */
      CHAR_HYPHEN_MINUS: 45,
      /* - */
      CHAR_LEFT_ANGLE_BRACKET: 60,
      /* < */
      CHAR_LEFT_CURLY_BRACE: 123,
      /* { */
      CHAR_LEFT_SQUARE_BRACKET: 91,
      /* [ */
      CHAR_LINE_FEED: 10,
      /* \n */
      CHAR_NO_BREAK_SPACE: 160,
      /* \u00A0 */
      CHAR_PERCENT: 37,
      /* % */
      CHAR_PLUS: 43,
      /* + */
      CHAR_QUESTION_MARK: 63,
      /* ? */
      CHAR_RIGHT_ANGLE_BRACKET: 62,
      /* > */
      CHAR_RIGHT_CURLY_BRACE: 125,
      /* } */
      CHAR_RIGHT_SQUARE_BRACKET: 93,
      /* ] */
      CHAR_SEMICOLON: 59,
      /* ; */
      CHAR_SINGLE_QUOTE: 39,
      /* ' */
      CHAR_SPACE: 32,
      /*   */
      CHAR_TAB: 9,
      /* \t */
      CHAR_UNDERSCORE: 95,
      /* _ */
      CHAR_VERTICAL_LINE: 124,
      /* | */
      CHAR_ZERO_WIDTH_NOBREAK_SPACE: 65279,
      /* \uFEFF */
      /**
       * Create EXTGLOB_CHARS
       */
      extglobChars(chars) {
        return {
          "!": { type: "negate", open: "(?:(?!(?:", close: `))${chars.STAR})` },
          "?": { type: "qmark", open: "(?:", close: ")?" },
          "+": { type: "plus", open: "(?:", close: ")+" },
          "*": { type: "star", open: "(?:", close: ")*" },
          "@": { type: "at", open: "(?:", close: ")" }
        };
      },
      /**
       * Create GLOB_CHARS
       */
      globChars(win32) {
        return win32 === true ? WINDOWS_CHARS : POSIX_CHARS;
      }
    };
  }
});

// node_modules/picomatch/lib/utils.js
var require_utils = __commonJS({
  "node_modules/picomatch/lib/utils.js"(exports) {
    "use strict";
    var {
      REGEX_BACKSLASH,
      REGEX_REMOVE_BACKSLASH,
      REGEX_SPECIAL_CHARS,
      REGEX_SPECIAL_CHARS_GLOBAL
    } = require_constants();
    exports.isObject = (val) => val !== null && typeof val === "object" && !Array.isArray(val);
    exports.hasRegexChars = (str) => REGEX_SPECIAL_CHARS.test(str);
    exports.isRegexChar = (str) => str.length === 1 && exports.hasRegexChars(str);
    exports.escapeRegex = (str) => str.replace(REGEX_SPECIAL_CHARS_GLOBAL, "\\$1");
    exports.toPosixSlashes = (str) => str.replace(REGEX_BACKSLASH, "/");
    exports.isWindows = () => {
      if (typeof navigator !== "undefined" && navigator.platform) {
        const platform = navigator.platform.toLowerCase();
        return platform === "win32" || platform === "windows";
      }
      if (typeof process !== "undefined" && process.platform) {
        return process.platform === "win32";
      }
      return false;
    };
    exports.removeBackslashes = (str) => {
      return str.replace(REGEX_REMOVE_BACKSLASH, (match) => {
        return match === "\\" ? "" : match;
      });
    };
    exports.escapeLast = (input, char, lastIdx) => {
      const idx = input.lastIndexOf(char, lastIdx);
      if (idx === -1) return input;
      if (input[idx - 1] === "\\") return exports.escapeLast(input, char, idx - 1);
      return `${input.slice(0, idx)}\\${input.slice(idx)}`;
    };
    exports.removePrefix = (input, state = {}) => {
      let output = input;
      if (output.startsWith("./")) {
        output = output.slice(2);
        state.prefix = "./";
      }
      return output;
    };
    exports.wrapOutput = (input, state = {}, options = {}) => {
      const prepend = options.contains ? "" : "^";
      const append = options.contains ? "" : "$";
      let output = `${prepend}(?:${input})${append}`;
      if (state.negated === true) {
        output = `(?:^(?!${output}).*$)`;
      }
      return output;
    };
    exports.basename = (path, { windows } = {}) => {
      const segs = path.split(windows ? /[\\/]/ : "/");
      const last = segs[segs.length - 1];
      if (last === "") {
        return segs[segs.length - 2];
      }
      return last;
    };
  }
});

// node_modules/picomatch/lib/scan.js
var require_scan = __commonJS({
  "node_modules/picomatch/lib/scan.js"(exports, module) {
    "use strict";
    var utils = require_utils();
    var {
      CHAR_ASTERISK,
      /* * */
      CHAR_AT,
      /* @ */
      CHAR_BACKWARD_SLASH,
      /* \ */
      CHAR_COMMA,
      /* , */
      CHAR_DOT,
      /* . */
      CHAR_EXCLAMATION_MARK,
      /* ! */
      CHAR_FORWARD_SLASH,
      /* / */
      CHAR_LEFT_CURLY_BRACE,
      /* { */
      CHAR_LEFT_PARENTHESES,
      /* ( */
      CHAR_LEFT_SQUARE_BRACKET,
      /* [ */
      CHAR_PLUS,
      /* + */
      CHAR_QUESTION_MARK,
      /* ? */
      CHAR_RIGHT_CURLY_BRACE,
      /* } */
      CHAR_RIGHT_PARENTHESES,
      /* ) */
      CHAR_RIGHT_SQUARE_BRACKET
      /* ] */
    } = require_constants();
    var isPathSeparator = (code) => {
      return code === CHAR_FORWARD_SLASH || code === CHAR_BACKWARD_SLASH;
    };
    var depth = (token) => {
      if (token.isPrefix !== true) {
        token.depth = token.isGlobstar ? Infinity : 1;
      }
    };
    var scan = (input, options) => {
      const opts = options || {};
      const length = input.length - 1;
      const scanToEnd = opts.parts === true || opts.scanToEnd === true;
      const slashes = [];
      const tokens = [];
      const parts = [];
      let str = input;
      let index = -1;
      let start = 0;
      let lastIndex = 0;
      let isBrace = false;
      let isBracket = false;
      let isGlob = false;
      let isExtglob = false;
      let isGlobstar = false;
      let braceEscaped = false;
      let backslashes = false;
      let negated = false;
      let negatedExtglob = false;
      let finished = false;
      let braces = 0;
      let prev;
      let code;
      let token = { value: "", depth: 0, isGlob: false };
      const eos = () => index >= length;
      const peek = () => str.charCodeAt(index + 1);
      const advance = () => {
        prev = code;
        return str.charCodeAt(++index);
      };
      while (index < length) {
        code = advance();
        let next;
        if (code === CHAR_BACKWARD_SLASH) {
          backslashes = token.backslashes = true;
          code = advance();
          if (code === CHAR_LEFT_CURLY_BRACE) {
            braceEscaped = true;
          }
          continue;
        }
        if (braceEscaped === true || code === CHAR_LEFT_CURLY_BRACE) {
          braces++;
          while (eos() !== true && (code = advance())) {
            if (code === CHAR_BACKWARD_SLASH) {
              backslashes = token.backslashes = true;
              advance();
              continue;
            }
            if (code === CHAR_LEFT_CURLY_BRACE) {
              braces++;
              continue;
            }
            if (braceEscaped !== true && code === CHAR_DOT && (code = advance()) === CHAR_DOT) {
              isBrace = token.isBrace = true;
              isGlob = token.isGlob = true;
              finished = true;
              if (scanToEnd === true) {
                continue;
              }
              break;
            }
            if (braceEscaped !== true && code === CHAR_COMMA) {
              isBrace = token.isBrace = true;
              isGlob = token.isGlob = true;
              finished = true;
              if (scanToEnd === true) {
                continue;
              }
              break;
            }
            if (code === CHAR_RIGHT_CURLY_BRACE) {
              braces--;
              if (braces === 0) {
                braceEscaped = false;
                isBrace = token.isBrace = true;
                finished = true;
                break;
              }
            }
          }
          if (scanToEnd === true) {
            continue;
          }
          break;
        }
        if (code === CHAR_FORWARD_SLASH) {
          slashes.push(index);
          tokens.push(token);
          token = { value: "", depth: 0, isGlob: false };
          if (finished === true) continue;
          if (prev === CHAR_DOT && index === start + 1) {
            start += 2;
            continue;
          }
          lastIndex = index + 1;
          continue;
        }
        if (opts.noext !== true) {
          const isExtglobChar = code === CHAR_PLUS || code === CHAR_AT || code === CHAR_ASTERISK || code === CHAR_QUESTION_MARK || code === CHAR_EXCLAMATION_MARK;
          if (isExtglobChar === true && peek() === CHAR_LEFT_PARENTHESES) {
            isGlob = token.isGlob = true;
            isExtglob = token.isExtglob = true;
            finished = true;
            if (code === CHAR_EXCLAMATION_MARK && index === start) {
              negatedExtglob = true;
            }
            if (scanToEnd === true) {
              while (eos() !== true && (code = advance())) {
                if (code === CHAR_BACKWARD_SLASH) {
                  backslashes = token.backslashes = true;
                  code = advance();
                  continue;
                }
                if (code === CHAR_RIGHT_PARENTHESES) {
                  isGlob = token.isGlob = true;
                  finished = true;
                  break;
                }
              }
              continue;
            }
            break;
          }
        }
        if (code === CHAR_ASTERISK) {
          if (prev === CHAR_ASTERISK) isGlobstar = token.isGlobstar = true;
          isGlob = token.isGlob = true;
          finished = true;
          if (scanToEnd === true) {
            continue;
          }
          break;
        }
        if (code === CHAR_QUESTION_MARK) {
          isGlob = token.isGlob = true;
          finished = true;
          if (scanToEnd === true) {
            continue;
          }
          break;
        }
        if (code === CHAR_LEFT_SQUARE_BRACKET) {
          while (eos() !== true && (next = advance())) {
            if (next === CHAR_BACKWARD_SLASH) {
              backslashes = token.backslashes = true;
              advance();
              continue;
            }
            if (next === CHAR_RIGHT_SQUARE_BRACKET) {
              isBracket = token.isBracket = true;
              isGlob = token.isGlob = true;
              finished = true;
              break;
            }
          }
          if (scanToEnd === true) {
            continue;
          }
          break;
        }
        if (opts.nonegate !== true && code === CHAR_EXCLAMATION_MARK && index === start) {
          negated = token.negated = true;
          start++;
          continue;
        }
        if (opts.noparen !== true && code === CHAR_LEFT_PARENTHESES) {
          isGlob = token.isGlob = true;
          if (scanToEnd === true) {
            while (eos() !== true && (code = advance())) {
              if (code === CHAR_LEFT_PARENTHESES) {
                backslashes = token.backslashes = true;
                code = advance();
                continue;
              }
              if (code === CHAR_RIGHT_PARENTHESES) {
                finished = true;
                break;
              }
            }
            continue;
          }
          break;
        }
        if (isGlob === true) {
          finished = true;
          if (scanToEnd === true) {
            continue;
          }
          break;
        }
      }
      if (opts.noext === true) {
        isExtglob = false;
        isGlob = false;
      }
      let base = str;
      let prefix = "";
      let glob = "";
      if (start > 0) {
        prefix = str.slice(0, start);
        str = str.slice(start);
        lastIndex -= start;
      }
      if (base && isGlob === true && lastIndex > 0) {
        base = str.slice(0, lastIndex);
        glob = str.slice(lastIndex);
      } else if (isGlob === true) {
        base = "";
        glob = str;
      } else {
        base = str;
      }
      if (base && base !== "" && base !== "/" && base !== str) {
        if (isPathSeparator(base.charCodeAt(base.length - 1))) {
          base = base.slice(0, -1);
        }
      }
      if (opts.unescape === true) {
        if (glob) glob = utils.removeBackslashes(glob);
        if (base && backslashes === true) {
          base = utils.removeBackslashes(base);
        }
      }
      const state = {
        prefix,
        input,
        start,
        base,
        glob,
        isBrace,
        isBracket,
        isGlob,
        isExtglob,
        isGlobstar,
        negated,
        negatedExtglob
      };
      if (opts.tokens === true) {
        state.maxDepth = 0;
        if (!isPathSeparator(code)) {
          tokens.push(token);
        }
        state.tokens = tokens;
      }
      if (opts.parts === true || opts.tokens === true) {
        let prevIndex;
        for (let idx = 0; idx < slashes.length; idx++) {
          const n = prevIndex ? prevIndex + 1 : start;
          const i = slashes[idx];
          const value = input.slice(n, i);
          if (opts.tokens) {
            if (idx === 0 && start !== 0) {
              tokens[idx].isPrefix = true;
              tokens[idx].value = prefix;
            } else {
              tokens[idx].value = value;
            }
            depth(tokens[idx]);
            state.maxDepth += tokens[idx].depth;
          }
          if (idx !== 0 || value !== "") {
            parts.push(value);
          }
          prevIndex = i;
        }
        if (prevIndex && prevIndex + 1 < input.length) {
          const value = input.slice(prevIndex + 1);
          parts.push(value);
          if (opts.tokens) {
            tokens[tokens.length - 1].value = value;
            depth(tokens[tokens.length - 1]);
            state.maxDepth += tokens[tokens.length - 1].depth;
          }
        }
        state.slashes = slashes;
        state.parts = parts;
      }
      return state;
    };
    module.exports = scan;
  }
});

// node_modules/picomatch/lib/parse.js
var require_parse = __commonJS({
  "node_modules/picomatch/lib/parse.js"(exports, module) {
    "use strict";
    var constants = require_constants();
    var utils = require_utils();
    var {
      MAX_LENGTH,
      POSIX_REGEX_SOURCE,
      REGEX_NON_SPECIAL_CHARS,
      REGEX_SPECIAL_CHARS_BACKREF,
      REPLACEMENTS
    } = constants;
    var expandRange = (args, options) => {
      if (typeof options.expandRange === "function") {
        return options.expandRange(...args, options);
      }
      args.sort();
      const value = `[${args.join("-")}]`;
      try {
        new RegExp(value);
      } catch (ex) {
        return args.map((v) => utils.escapeRegex(v)).join("..");
      }
      return value;
    };
    var syntaxError = (type, char) => {
      return `Missing ${type}: "${char}" - use "\\\\${char}" to match literal characters`;
    };
    var splitTopLevel = (input) => {
      const parts = [];
      let bracket = 0;
      let paren = 0;
      let quote = 0;
      let value = "";
      let escaped = false;
      for (const ch of input) {
        if (escaped === true) {
          value += ch;
          escaped = false;
          continue;
        }
        if (ch === "\\") {
          value += ch;
          escaped = true;
          continue;
        }
        if (ch === '"') {
          quote = quote === 1 ? 0 : 1;
          value += ch;
          continue;
        }
        if (quote === 0) {
          if (ch === "[") {
            bracket++;
          } else if (ch === "]" && bracket > 0) {
            bracket--;
          } else if (bracket === 0) {
            if (ch === "(") {
              paren++;
            } else if (ch === ")" && paren > 0) {
              paren--;
            } else if (ch === "|" && paren === 0) {
              parts.push(value);
              value = "";
              continue;
            }
          }
        }
        value += ch;
      }
      parts.push(value);
      return parts;
    };
    var isPlainBranch = (branch) => {
      let escaped = false;
      for (const ch of branch) {
        if (escaped === true) {
          escaped = false;
          continue;
        }
        if (ch === "\\") {
          escaped = true;
          continue;
        }
        if (/[?*+@!()[\]{}]/.test(ch)) {
          return false;
        }
      }
      return true;
    };
    var normalizeSimpleBranch = (branch) => {
      let value = branch.trim();
      let changed = true;
      while (changed === true) {
        changed = false;
        if (/^@\([^\\()[\]{}|]+\)$/.test(value)) {
          value = value.slice(2, -1);
          changed = true;
        }
      }
      if (!isPlainBranch(value)) {
        return;
      }
      return value.replace(/\\(.)/g, "$1");
    };
    var hasRepeatedCharPrefixOverlap = (branches) => {
      const values = branches.map(normalizeSimpleBranch).filter(Boolean);
      for (let i = 0; i < values.length; i++) {
        for (let j = i + 1; j < values.length; j++) {
          const a = values[i];
          const b = values[j];
          const char = a[0];
          if (!char || a !== char.repeat(a.length) || b !== char.repeat(b.length)) {
            continue;
          }
          if (a === b || a.startsWith(b) || b.startsWith(a)) {
            return true;
          }
        }
      }
      return false;
    };
    var parseRepeatedExtglob = (pattern, requireEnd = true) => {
      if (pattern[0] !== "+" && pattern[0] !== "*" || pattern[1] !== "(") {
        return;
      }
      let bracket = 0;
      let paren = 0;
      let quote = 0;
      let escaped = false;
      for (let i = 1; i < pattern.length; i++) {
        const ch = pattern[i];
        if (escaped === true) {
          escaped = false;
          continue;
        }
        if (ch === "\\") {
          escaped = true;
          continue;
        }
        if (ch === '"') {
          quote = quote === 1 ? 0 : 1;
          continue;
        }
        if (quote === 1) {
          continue;
        }
        if (ch === "[") {
          bracket++;
          continue;
        }
        if (ch === "]" && bracket > 0) {
          bracket--;
          continue;
        }
        if (bracket > 0) {
          continue;
        }
        if (ch === "(") {
          paren++;
          continue;
        }
        if (ch === ")") {
          paren--;
          if (paren === 0) {
            if (requireEnd === true && i !== pattern.length - 1) {
              return;
            }
            return {
              type: pattern[0],
              body: pattern.slice(2, i),
              end: i
            };
          }
        }
      }
    };
    var getStarExtglobSequenceOutput = (pattern) => {
      let index = 0;
      const chars = [];
      while (index < pattern.length) {
        const match = parseRepeatedExtglob(pattern.slice(index), false);
        if (!match || match.type !== "*") {
          return;
        }
        const branches = splitTopLevel(match.body).map((branch2) => branch2.trim());
        if (branches.length !== 1) {
          return;
        }
        const branch = normalizeSimpleBranch(branches[0]);
        if (!branch || branch.length !== 1) {
          return;
        }
        chars.push(branch);
        index += match.end + 1;
      }
      if (chars.length < 1) {
        return;
      }
      const source = chars.length === 1 ? utils.escapeRegex(chars[0]) : `[${chars.map((ch) => utils.escapeRegex(ch)).join("")}]`;
      return `${source}*`;
    };
    var repeatedExtglobRecursion = (pattern) => {
      let depth = 0;
      let value = pattern.trim();
      let match = parseRepeatedExtglob(value);
      while (match) {
        depth++;
        value = match.body.trim();
        match = parseRepeatedExtglob(value);
      }
      return depth;
    };
    var analyzeRepeatedExtglob = (body, options) => {
      if (options.maxExtglobRecursion === false) {
        return { risky: false };
      }
      const max = typeof options.maxExtglobRecursion === "number" ? options.maxExtglobRecursion : constants.DEFAULT_MAX_EXTGLOB_RECURSION;
      const branches = splitTopLevel(body).map((branch) => branch.trim());
      if (branches.length > 1) {
        if (branches.some((branch) => branch === "") || branches.some((branch) => /^[*?]+$/.test(branch)) || hasRepeatedCharPrefixOverlap(branches)) {
          return { risky: true };
        }
      }
      for (const branch of branches) {
        const safeOutput = getStarExtglobSequenceOutput(branch);
        if (safeOutput) {
          return { risky: true, safeOutput };
        }
        if (repeatedExtglobRecursion(branch) > max) {
          return { risky: true };
        }
      }
      return { risky: false };
    };
    var parse = (input, options) => {
      if (typeof input !== "string") {
        throw new TypeError("Expected a string");
      }
      input = REPLACEMENTS[input] || input;
      const opts = { ...options };
      const max = typeof opts.maxLength === "number" ? Math.min(MAX_LENGTH, opts.maxLength) : MAX_LENGTH;
      let len = input.length;
      if (len > max) {
        throw new SyntaxError(`Input length: ${len}, exceeds maximum allowed length: ${max}`);
      }
      const bos = { type: "bos", value: "", output: opts.prepend || "" };
      const tokens = [bos];
      const capture = opts.capture ? "" : "?:";
      const PLATFORM_CHARS = constants.globChars(opts.windows);
      const EXTGLOB_CHARS = constants.extglobChars(PLATFORM_CHARS);
      const {
        DOT_LITERAL,
        PLUS_LITERAL,
        SLASH_LITERAL,
        ONE_CHAR,
        DOTS_SLASH,
        NO_DOT,
        NO_DOT_SLASH,
        NO_DOTS_SLASH,
        QMARK,
        QMARK_NO_DOT,
        STAR,
        START_ANCHOR
      } = PLATFORM_CHARS;
      const globstar = (opts2) => {
        return `(${capture}(?:(?!${START_ANCHOR}${opts2.dot ? DOTS_SLASH : DOT_LITERAL}).)*?)`;
      };
      const nodot = opts.dot ? "" : NO_DOT;
      const qmarkNoDot = opts.dot ? QMARK : QMARK_NO_DOT;
      let star = opts.bash === true ? globstar(opts) : STAR;
      if (opts.capture) {
        star = `(${star})`;
      }
      if (typeof opts.noext === "boolean") {
        opts.noextglob = opts.noext;
      }
      const state = {
        input,
        index: -1,
        start: 0,
        dot: opts.dot === true,
        consumed: "",
        output: "",
        prefix: "",
        backtrack: false,
        negated: false,
        brackets: 0,
        braces: 0,
        parens: 0,
        quotes: 0,
        globstar: false,
        tokens
      };
      input = utils.removePrefix(input, state);
      len = input.length;
      const extglobs = [];
      const braces = [];
      const stack = [];
      let prev = bos;
      let value;
      const eos = () => state.index === len - 1;
      const peek = state.peek = (n = 1) => input[state.index + n];
      const advance = state.advance = () => input[++state.index] || "";
      const remaining = () => input.slice(state.index + 1);
      const consume = (value2 = "", num = 0) => {
        state.consumed += value2;
        state.index += num;
      };
      const append = (token) => {
        state.output += token.output != null ? token.output : token.value;
        consume(token.value);
      };
      const negate = () => {
        let count = 1;
        while (peek() === "!" && (peek(2) !== "(" || peek(3) === "?")) {
          advance();
          state.start++;
          count++;
        }
        if (count % 2 === 0) {
          return false;
        }
        state.negated = true;
        state.start++;
        return true;
      };
      const increment = (type) => {
        state[type]++;
        stack.push(type);
      };
      const decrement = (type) => {
        state[type]--;
        stack.pop();
      };
      const push = (tok) => {
        if (prev.type === "globstar") {
          const isBrace = state.braces > 0 && (tok.type === "comma" || tok.type === "brace");
          const isExtglob = tok.extglob === true || extglobs.length && (tok.type === "pipe" || tok.type === "paren");
          if (tok.type !== "slash" && tok.type !== "paren" && !isBrace && !isExtglob) {
            state.output = state.output.slice(0, -prev.output.length);
            prev.type = "star";
            prev.value = "*";
            prev.output = star;
            state.output += prev.output;
          }
        }
        if (extglobs.length && tok.type !== "paren") {
          extglobs[extglobs.length - 1].inner += tok.value;
        }
        if (tok.value || tok.output) append(tok);
        if (prev && prev.type === "text" && tok.type === "text") {
          prev.output = (prev.output || prev.value) + tok.value;
          prev.value += tok.value;
          return;
        }
        tok.prev = prev;
        tokens.push(tok);
        prev = tok;
      };
      const extglobOpen = (type, value2) => {
        const token = { ...EXTGLOB_CHARS[value2], conditions: 1, inner: "" };
        token.prev = prev;
        token.parens = state.parens;
        token.output = state.output;
        token.startIndex = state.index;
        token.tokensIndex = tokens.length;
        const output = (opts.capture ? "(" : "") + token.open;
        increment("parens");
        push({ type, value: value2, output: state.output ? "" : ONE_CHAR });
        push({ type: "paren", extglob: true, value: advance(), output });
        extglobs.push(token);
      };
      const extglobClose = (token) => {
        const literal = input.slice(token.startIndex, state.index + 1);
        const body = input.slice(token.startIndex + 2, state.index);
        const analysis = analyzeRepeatedExtglob(body, opts);
        if ((token.type === "plus" || token.type === "star") && analysis.risky) {
          const safeOutput = analysis.safeOutput ? (token.output ? "" : ONE_CHAR) + (opts.capture ? `(${analysis.safeOutput})` : analysis.safeOutput) : void 0;
          const open = tokens[token.tokensIndex];
          open.type = "text";
          open.value = literal;
          open.output = safeOutput || utils.escapeRegex(literal);
          for (let i = token.tokensIndex + 1; i < tokens.length; i++) {
            tokens[i].value = "";
            tokens[i].output = "";
            delete tokens[i].suffix;
          }
          state.output = token.output + open.output;
          state.backtrack = true;
          push({ type: "paren", extglob: true, value, output: "" });
          decrement("parens");
          return;
        }
        let output = token.close + (opts.capture ? ")" : "");
        let rest;
        if (token.type === "negate") {
          let extglobStar = star;
          if (token.inner && token.inner.length > 1 && token.inner.includes("/")) {
            extglobStar = globstar(opts);
          }
          if (extglobStar !== star || eos() || /^\)+$/.test(remaining())) {
            output = token.close = `)$))${extglobStar}`;
          }
          if (token.inner.includes("*") && (rest = remaining()) && /^\.[^\\/.]+$/.test(rest)) {
            const expression = parse(rest, { ...options, fastpaths: false }).output;
            output = token.close = `)${expression})${extglobStar})`;
          }
          if (token.prev.type === "bos") {
            state.negatedExtglob = true;
          }
        }
        push({ type: "paren", extglob: true, value, output });
        decrement("parens");
      };
      if (opts.fastpaths !== false && !/(^[*!]|[/()[\]{}"])/.test(input)) {
        let backslashes = false;
        let output = input.replace(REGEX_SPECIAL_CHARS_BACKREF, (m, esc, chars, first, rest, index) => {
          if (first === "\\") {
            backslashes = true;
            return m;
          }
          if (first === "?") {
            if (esc) {
              return esc + first + (rest ? QMARK.repeat(rest.length) : "");
            }
            if (index === 0) {
              return qmarkNoDot + (rest ? QMARK.repeat(rest.length) : "");
            }
            return QMARK.repeat(chars.length);
          }
          if (first === ".") {
            return DOT_LITERAL.repeat(chars.length);
          }
          if (first === "*") {
            if (esc) {
              return esc + first + (rest ? star : "");
            }
            return star;
          }
          return esc ? m : `\\${m}`;
        });
        if (backslashes === true) {
          if (opts.unescape === true) {
            output = output.replace(/\\/g, "");
          } else {
            output = output.replace(/\\+/g, (m) => {
              return m.length % 2 === 0 ? "\\\\" : m ? "\\" : "";
            });
          }
        }
        if (output === input && opts.contains === true) {
          state.output = input;
          return state;
        }
        state.output = utils.wrapOutput(output, state, options);
        return state;
      }
      while (!eos()) {
        value = advance();
        if (value === "\0") {
          continue;
        }
        if (value === "\\") {
          const next = peek();
          if (next === "/" && opts.bash !== true) {
            continue;
          }
          if (next === "." || next === ";") {
            continue;
          }
          if (!next) {
            value += "\\";
            push({ type: "text", value });
            continue;
          }
          const match = /^\\+/.exec(remaining());
          let slashes = 0;
          if (match && match[0].length > 2) {
            slashes = match[0].length;
            state.index += slashes;
            if (slashes % 2 !== 0) {
              value += "\\";
            }
          }
          if (opts.unescape === true) {
            value = advance();
          } else {
            value += advance();
          }
          if (state.brackets === 0) {
            push({ type: "text", value });
            continue;
          }
        }
        if (state.brackets > 0 && (value !== "]" || prev.value === "[" || prev.value === "[^")) {
          if (opts.posix !== false && value === ":") {
            const inner = prev.value.slice(1);
            if (inner.includes("[")) {
              prev.posix = true;
              if (inner.includes(":")) {
                const idx = prev.value.lastIndexOf("[");
                const pre = prev.value.slice(0, idx);
                const rest2 = prev.value.slice(idx + 2);
                const posix = POSIX_REGEX_SOURCE[rest2];
                if (posix) {
                  prev.value = pre + posix;
                  state.backtrack = true;
                  advance();
                  if (!bos.output && tokens.indexOf(prev) === 1) {
                    bos.output = ONE_CHAR;
                  }
                  continue;
                }
              }
            }
          }
          if (value === "[" && peek() !== ":" || value === "-" && peek() === "]") {
            value = `\\${value}`;
          }
          if (value === "]" && (prev.value === "[" || prev.value === "[^")) {
            value = `\\${value}`;
          }
          if (opts.posix === true && value === "!" && prev.value === "[") {
            value = "^";
          }
          prev.value += value;
          append({ value });
          continue;
        }
        if (state.quotes === 1 && value !== '"') {
          value = utils.escapeRegex(value);
          prev.value += value;
          append({ value });
          continue;
        }
        if (value === '"') {
          state.quotes = state.quotes === 1 ? 0 : 1;
          if (opts.keepQuotes === true) {
            push({ type: "text", value });
          }
          continue;
        }
        if (value === "(") {
          increment("parens");
          push({ type: "paren", value });
          continue;
        }
        if (value === ")") {
          if (state.parens === 0 && opts.strictBrackets === true) {
            throw new SyntaxError(syntaxError("opening", "("));
          }
          const extglob = extglobs[extglobs.length - 1];
          if (extglob && state.parens === extglob.parens + 1) {
            extglobClose(extglobs.pop());
            continue;
          }
          push({ type: "paren", value, output: state.parens ? ")" : "\\)" });
          decrement("parens");
          continue;
        }
        if (value === "[") {
          if (opts.nobracket === true || !remaining().includes("]")) {
            if (opts.nobracket !== true && opts.strictBrackets === true) {
              throw new SyntaxError(syntaxError("closing", "]"));
            }
            value = `\\${value}`;
          } else {
            increment("brackets");
          }
          push({ type: "bracket", value });
          continue;
        }
        if (value === "]") {
          if (opts.nobracket === true || prev && prev.type === "bracket" && prev.value.length === 1) {
            push({ type: "text", value, output: `\\${value}` });
            continue;
          }
          if (state.brackets === 0) {
            if (opts.strictBrackets === true) {
              throw new SyntaxError(syntaxError("opening", "["));
            }
            push({ type: "text", value, output: `\\${value}` });
            continue;
          }
          decrement("brackets");
          const prevValue = prev.value.slice(1);
          if (prev.posix !== true && prevValue[0] === "^" && !prevValue.includes("/")) {
            value = `/${value}`;
          }
          prev.value += value;
          append({ value });
          if (opts.literalBrackets === false || utils.hasRegexChars(prevValue)) {
            continue;
          }
          const escaped = utils.escapeRegex(prev.value);
          state.output = state.output.slice(0, -prev.value.length);
          if (opts.literalBrackets === true) {
            state.output += escaped;
            prev.value = escaped;
            continue;
          }
          prev.value = `(${capture}${escaped}|${prev.value})`;
          state.output += prev.value;
          continue;
        }
        if (value === "{" && opts.nobrace !== true) {
          increment("braces");
          const open = {
            type: "brace",
            value,
            output: "(",
            outputIndex: state.output.length,
            tokensIndex: state.tokens.length
          };
          braces.push(open);
          push(open);
          continue;
        }
        if (value === "}") {
          const brace = braces[braces.length - 1];
          if (opts.nobrace === true || !brace) {
            push({ type: "text", value, output: value });
            continue;
          }
          let output = ")";
          if (brace.dots === true) {
            const arr = tokens.slice();
            const range = [];
            for (let i = arr.length - 1; i >= 0; i--) {
              tokens.pop();
              if (arr[i].type === "brace") {
                break;
              }
              if (arr[i].type !== "dots") {
                range.unshift(arr[i].value);
              }
            }
            output = expandRange(range, opts);
            state.backtrack = true;
          }
          if (brace.comma !== true && brace.dots !== true) {
            const out = state.output.slice(0, brace.outputIndex);
            const toks = state.tokens.slice(brace.tokensIndex);
            brace.value = brace.output = "\\{";
            value = output = "\\}";
            state.output = out;
            for (const t of toks) {
              state.output += t.output || t.value;
            }
          }
          push({ type: "brace", value, output });
          decrement("braces");
          braces.pop();
          continue;
        }
        if (value === "|") {
          if (extglobs.length > 0) {
            extglobs[extglobs.length - 1].conditions++;
          }
          push({ type: "text", value });
          continue;
        }
        if (value === ",") {
          let output = value;
          const brace = braces[braces.length - 1];
          if (brace && stack[stack.length - 1] === "braces") {
            brace.comma = true;
            output = "|";
          }
          push({ type: "comma", value, output });
          continue;
        }
        if (value === "/") {
          if (prev.type === "dot" && state.index === state.start + 1) {
            state.start = state.index + 1;
            state.consumed = "";
            state.output = "";
            tokens.pop();
            prev = bos;
            continue;
          }
          push({ type: "slash", value, output: SLASH_LITERAL });
          continue;
        }
        if (value === ".") {
          if (state.braces > 0 && prev.type === "dot") {
            if (prev.value === ".") prev.output = DOT_LITERAL;
            const brace = braces[braces.length - 1];
            prev.type = "dots";
            prev.output += value;
            prev.value += value;
            brace.dots = true;
            continue;
          }
          if (state.braces + state.parens === 0 && prev.type !== "bos" && prev.type !== "slash") {
            push({ type: "text", value, output: DOT_LITERAL });
            continue;
          }
          push({ type: "dot", value, output: DOT_LITERAL });
          continue;
        }
        if (value === "?") {
          const isGroup = prev && prev.value === "(";
          if (!isGroup && opts.noextglob !== true && peek() === "(" && peek(2) !== "?") {
            extglobOpen("qmark", value);
            continue;
          }
          if (prev && prev.type === "paren") {
            const next = peek();
            let output = value;
            if (prev.value === "(" && !/[!=<:]/.test(next) || next === "<" && !/<([!=]|\w+>)/.test(remaining())) {
              output = `\\${value}`;
            }
            push({ type: "text", value, output });
            continue;
          }
          if (opts.dot !== true && (prev.type === "slash" || prev.type === "bos")) {
            push({ type: "qmark", value, output: QMARK_NO_DOT });
            continue;
          }
          push({ type: "qmark", value, output: QMARK });
          continue;
        }
        if (value === "!") {
          if (opts.noextglob !== true && peek() === "(") {
            if (peek(2) !== "?" || !/[!=<:]/.test(peek(3))) {
              extglobOpen("negate", value);
              continue;
            }
          }
          if (opts.nonegate !== true && state.index === 0) {
            negate();
            continue;
          }
        }
        if (value === "+") {
          if (opts.noextglob !== true && peek() === "(" && peek(2) !== "?") {
            extglobOpen("plus", value);
            continue;
          }
          if (prev && prev.value === "(" || opts.regex === false) {
            push({ type: "plus", value, output: PLUS_LITERAL });
            continue;
          }
          if (prev && (prev.type === "bracket" || prev.type === "paren" || prev.type === "brace") || state.parens > 0) {
            push({ type: "plus", value });
            continue;
          }
          push({ type: "plus", value: PLUS_LITERAL });
          continue;
        }
        if (value === "@") {
          if (opts.noextglob !== true && peek() === "(" && peek(2) !== "?") {
            push({ type: "at", extglob: true, value, output: "" });
            continue;
          }
          push({ type: "text", value });
          continue;
        }
        if (value !== "*") {
          if (value === "$" || value === "^") {
            value = `\\${value}`;
          }
          const match = REGEX_NON_SPECIAL_CHARS.exec(remaining());
          if (match) {
            value += match[0];
            state.index += match[0].length;
          }
          push({ type: "text", value });
          continue;
        }
        if (prev && (prev.type === "globstar" || prev.star === true)) {
          prev.type = "star";
          prev.star = true;
          prev.value += value;
          prev.output = star;
          state.backtrack = true;
          state.globstar = true;
          consume(value);
          continue;
        }
        let rest = remaining();
        if (opts.noextglob !== true && /^\([^?]/.test(rest)) {
          extglobOpen("star", value);
          continue;
        }
        if (prev.type === "star") {
          if (opts.noglobstar === true) {
            consume(value);
            continue;
          }
          const prior = prev.prev;
          const before = prior.prev;
          const isStart = prior.type === "slash" || prior.type === "bos";
          const afterStar = before && (before.type === "star" || before.type === "globstar");
          if (opts.bash === true && (!isStart || rest[0] && rest[0] !== "/")) {
            push({ type: "star", value, output: "" });
            continue;
          }
          const isBrace = state.braces > 0 && (prior.type === "comma" || prior.type === "brace");
          const isExtglob = extglobs.length && (prior.type === "pipe" || prior.type === "paren");
          if (!isStart && prior.type !== "paren" && !isBrace && !isExtglob) {
            push({ type: "star", value, output: "" });
            continue;
          }
          while (rest.slice(0, 3) === "/**") {
            const after = input[state.index + 4];
            if (after && after !== "/") {
              break;
            }
            rest = rest.slice(3);
            consume("/**", 3);
          }
          if (prior.type === "bos" && eos()) {
            prev.type = "globstar";
            prev.value += value;
            prev.output = globstar(opts);
            state.output = prev.output;
            state.globstar = true;
            consume(value);
            continue;
          }
          if (prior.type === "slash" && prior.prev.type !== "bos" && !afterStar && eos()) {
            state.output = state.output.slice(0, -(prior.output + prev.output).length);
            prior.output = `(?:${prior.output}`;
            prev.type = "globstar";
            prev.output = globstar(opts) + (opts.strictSlashes ? ")" : "|$)");
            prev.value += value;
            state.globstar = true;
            state.output += prior.output + prev.output;
            consume(value);
            continue;
          }
          if (prior.type === "slash" && prior.prev.type !== "bos" && rest[0] === "/") {
            const end = rest[1] !== void 0 ? "|$" : "";
            state.output = state.output.slice(0, -(prior.output + prev.output).length);
            prior.output = `(?:${prior.output}`;
            prev.type = "globstar";
            prev.output = `${globstar(opts)}${SLASH_LITERAL}|${SLASH_LITERAL}${end})`;
            prev.value += value;
            state.output += prior.output + prev.output;
            state.globstar = true;
            consume(value + advance());
            push({ type: "slash", value: "/", output: "" });
            continue;
          }
          if (prior.type === "bos" && rest[0] === "/") {
            prev.type = "globstar";
            prev.value += value;
            prev.output = `(?:^|${SLASH_LITERAL}|${globstar(opts)}${SLASH_LITERAL})`;
            state.output = prev.output;
            state.globstar = true;
            consume(value + advance());
            push({ type: "slash", value: "/", output: "" });
            continue;
          }
          state.output = state.output.slice(0, -prev.output.length);
          prev.type = "globstar";
          prev.output = globstar(opts);
          prev.value += value;
          state.output += prev.output;
          state.globstar = true;
          consume(value);
          continue;
        }
        const token = { type: "star", value, output: star };
        if (opts.bash === true) {
          token.output = ".*?";
          if (prev.type === "bos" || prev.type === "slash") {
            token.output = nodot + token.output;
          }
          push(token);
          continue;
        }
        if (prev && (prev.type === "bracket" || prev.type === "paren") && opts.regex === true) {
          token.output = value;
          push(token);
          continue;
        }
        if (state.index === state.start || prev.type === "slash" || prev.type === "dot") {
          if (prev.type === "dot") {
            state.output += NO_DOT_SLASH;
            prev.output += NO_DOT_SLASH;
          } else if (opts.dot === true) {
            state.output += NO_DOTS_SLASH;
            prev.output += NO_DOTS_SLASH;
          } else {
            state.output += nodot;
            prev.output += nodot;
          }
          if (peek() !== "*") {
            state.output += ONE_CHAR;
            prev.output += ONE_CHAR;
          }
        }
        push(token);
      }
      while (state.brackets > 0) {
        if (opts.strictBrackets === true) throw new SyntaxError(syntaxError("closing", "]"));
        state.output = utils.escapeLast(state.output, "[");
        decrement("brackets");
      }
      while (state.parens > 0) {
        if (opts.strictBrackets === true) throw new SyntaxError(syntaxError("closing", ")"));
        state.output = utils.escapeLast(state.output, "(");
        decrement("parens");
      }
      while (state.braces > 0) {
        if (opts.strictBrackets === true) throw new SyntaxError(syntaxError("closing", "}"));
        state.output = utils.escapeLast(state.output, "{");
        decrement("braces");
      }
      if (opts.strictSlashes !== true && (prev.type === "star" || prev.type === "bracket")) {
        push({ type: "maybe_slash", value: "", output: `${SLASH_LITERAL}?` });
      }
      if (state.backtrack === true) {
        state.output = "";
        for (const token of state.tokens) {
          state.output += token.output != null ? token.output : token.value;
          if (token.suffix) {
            state.output += token.suffix;
          }
        }
      }
      return state;
    };
    parse.fastpaths = (input, options) => {
      const opts = { ...options };
      const max = typeof opts.maxLength === "number" ? Math.min(MAX_LENGTH, opts.maxLength) : MAX_LENGTH;
      const len = input.length;
      if (len > max) {
        throw new SyntaxError(`Input length: ${len}, exceeds maximum allowed length: ${max}`);
      }
      input = REPLACEMENTS[input] || input;
      const {
        DOT_LITERAL,
        SLASH_LITERAL,
        ONE_CHAR,
        DOTS_SLASH,
        NO_DOT,
        NO_DOTS,
        NO_DOTS_SLASH,
        STAR,
        START_ANCHOR
      } = constants.globChars(opts.windows);
      const nodot = opts.dot ? NO_DOTS : NO_DOT;
      const slashDot = opts.dot ? NO_DOTS_SLASH : NO_DOT;
      const capture = opts.capture ? "" : "?:";
      const state = { negated: false, prefix: "" };
      let star = opts.bash === true ? ".*?" : STAR;
      if (opts.capture) {
        star = `(${star})`;
      }
      const globstar = (opts2) => {
        if (opts2.noglobstar === true) return star;
        return `(${capture}(?:(?!${START_ANCHOR}${opts2.dot ? DOTS_SLASH : DOT_LITERAL}).)*?)`;
      };
      const create = (str) => {
        switch (str) {
          case "*":
            return `${nodot}${ONE_CHAR}${star}`;
          case ".*":
            return `${DOT_LITERAL}${ONE_CHAR}${star}`;
          case "*.*":
            return `${nodot}${star}${DOT_LITERAL}${ONE_CHAR}${star}`;
          case "*/*":
            return `${nodot}${star}${SLASH_LITERAL}${ONE_CHAR}${slashDot}${star}`;
          case "**":
            return nodot + globstar(opts);
          case "**/*":
            return `(?:${nodot}${globstar(opts)}${SLASH_LITERAL})?${slashDot}${ONE_CHAR}${star}`;
          case "**/*.*":
            return `(?:${nodot}${globstar(opts)}${SLASH_LITERAL})?${slashDot}${star}${DOT_LITERAL}${ONE_CHAR}${star}`;
          case "**/.*":
            return `(?:${nodot}${globstar(opts)}${SLASH_LITERAL})?${DOT_LITERAL}${ONE_CHAR}${star}`;
          default: {
            const match = /^(.*?)\.(\w+)$/.exec(str);
            if (!match) return;
            const source2 = create(match[1]);
            if (!source2) return;
            return source2 + DOT_LITERAL + match[2];
          }
        }
      };
      const output = utils.removePrefix(input, state);
      let source = create(output);
      if (source && opts.strictSlashes !== true) {
        source += `${SLASH_LITERAL}?`;
      }
      return source;
    };
    module.exports = parse;
  }
});

// node_modules/picomatch/lib/picomatch.js
var require_picomatch = __commonJS({
  "node_modules/picomatch/lib/picomatch.js"(exports, module) {
    "use strict";
    var scan = require_scan();
    var parse = require_parse();
    var utils = require_utils();
    var constants = require_constants();
    var isObject = (val) => val && typeof val === "object" && !Array.isArray(val);
    var picomatch2 = (glob, options, returnState = false) => {
      if (Array.isArray(glob)) {
        const fns = glob.map((input) => picomatch2(input, options, returnState));
        const arrayMatcher = (str) => {
          for (const isMatch of fns) {
            const state2 = isMatch(str);
            if (state2) return state2;
          }
          return false;
        };
        return arrayMatcher;
      }
      const isState = isObject(glob) && glob.tokens && glob.input;
      if (glob === "" || typeof glob !== "string" && !isState) {
        throw new TypeError("Expected pattern to be a non-empty string");
      }
      const opts = options || {};
      const posix = opts.windows;
      const regex = isState ? picomatch2.compileRe(glob, options) : picomatch2.makeRe(glob, options, false, true);
      const state = regex.state;
      delete regex.state;
      let isIgnored = () => false;
      if (opts.ignore) {
        const ignoreOpts = { ...options, ignore: null, onMatch: null, onResult: null };
        isIgnored = picomatch2(opts.ignore, ignoreOpts, returnState);
      }
      const matcher = (input, returnObject = false) => {
        const { isMatch, match, output } = picomatch2.test(input, regex, options, { glob, posix });
        const result = { glob, state, regex, posix, input, output, match, isMatch };
        if (typeof opts.onResult === "function") {
          opts.onResult(result);
        }
        if (isMatch === false) {
          result.isMatch = false;
          return returnObject ? result : false;
        }
        if (isIgnored(input)) {
          if (typeof opts.onIgnore === "function") {
            opts.onIgnore(result);
          }
          result.isMatch = false;
          return returnObject ? result : false;
        }
        if (typeof opts.onMatch === "function") {
          opts.onMatch(result);
        }
        return returnObject ? result : true;
      };
      if (returnState) {
        matcher.state = state;
      }
      return matcher;
    };
    picomatch2.test = (input, regex, options, { glob, posix } = {}) => {
      if (typeof input !== "string") {
        throw new TypeError("Expected input to be a string");
      }
      if (input === "") {
        return { isMatch: false, output: "" };
      }
      const opts = options || {};
      const format = opts.format || (posix ? utils.toPosixSlashes : null);
      let match = input === glob;
      let output = match && format ? format(input) : input;
      if (match === false) {
        output = format ? format(input) : input;
        match = output === glob;
      }
      if (match === false || opts.capture === true) {
        if (opts.matchBase === true || opts.basename === true) {
          match = picomatch2.matchBase(input, regex, options, posix);
        } else {
          match = regex.exec(output);
        }
      }
      return { isMatch: Boolean(match), match, output };
    };
    picomatch2.matchBase = (input, glob, options) => {
      const regex = glob instanceof RegExp ? glob : picomatch2.makeRe(glob, options);
      return regex.test(utils.basename(input));
    };
    picomatch2.isMatch = (str, patterns, options) => picomatch2(patterns, options)(str);
    picomatch2.parse = (pattern, options) => {
      if (Array.isArray(pattern)) return pattern.map((p) => picomatch2.parse(p, options));
      return parse(pattern, { ...options, fastpaths: false });
    };
    picomatch2.scan = (input, options) => scan(input, options);
    picomatch2.compileRe = (state, options, returnOutput = false, returnState = false) => {
      if (returnOutput === true) {
        return state.output;
      }
      const opts = options || {};
      const prepend = opts.contains ? "" : "^";
      const append = opts.contains ? "" : "$";
      let source = `${prepend}(?:${state.output})${append}`;
      if (state && state.negated === true) {
        source = `^(?!${source}).*$`;
      }
      const regex = picomatch2.toRegex(source, options);
      if (returnState === true) {
        regex.state = state;
      }
      return regex;
    };
    picomatch2.makeRe = (input, options = {}, returnOutput = false, returnState = false) => {
      if (!input || typeof input !== "string") {
        throw new TypeError("Expected a non-empty string");
      }
      let parsed = { negated: false, fastpaths: true };
      if (options.fastpaths !== false && (input[0] === "." || input[0] === "*")) {
        parsed.output = parse.fastpaths(input, options);
      }
      if (!parsed.output) {
        parsed = parse(input, options);
      }
      return picomatch2.compileRe(parsed, options, returnOutput, returnState);
    };
    picomatch2.toRegex = (source, options) => {
      try {
        const opts = options || {};
        return new RegExp(source, opts.flags || (opts.nocase ? "i" : ""));
      } catch (err) {
        if (options && options.debug === true) throw err;
        return /$^/;
      }
    };
    picomatch2.constants = constants;
    module.exports = picomatch2;
  }
});

// node_modules/picomatch/index.js
var require_picomatch2 = __commonJS({
  "node_modules/picomatch/index.js"(exports, module) {
    "use strict";
    var pico = require_picomatch();
    var utils = require_utils();
    function picomatch2(glob, options, returnState = false) {
      if (options && (options.windows === null || options.windows === void 0)) {
        options = { ...options, windows: utils.isWindows() };
      }
      return pico(glob, options, returnState);
    }
    Object.assign(picomatch2, pico);
    module.exports = picomatch2;
  }
});

// src/config.ts
import { chmodSync, copyFileSync, mkdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from "fs";
import { homedir } from "os";
import { dirname, join } from "path";

// src/cli/ui/theme/tokens.ts
function card(fg, tone) {
  return {
    user: { color: fg.meta, glyph: "\u25C7" },
    reasoning: { color: tone.accent, glyph: "\u25C6" },
    streaming: { color: tone.brand, glyph: "\u25C8" },
    task: { color: tone.warn, glyph: "\u25B6" },
    tool: { color: tone.info, glyph: "\u25A3" },
    plan: { color: tone.accent, glyph: "\u229E" },
    diff: { color: tone.ok, glyph: "\xB1" },
    error: { color: tone.err, glyph: "\u2716" },
    warn: { color: tone.warn, glyph: "\u26A0" },
    usage: { color: fg.meta, glyph: "\u03A3" },
    subagent: { color: tone.violet, glyph: "\u232C" },
    approval: { color: tone.warn, glyph: "?" },
    search: { color: tone.info, glyph: "\u2299" },
    memory: { color: fg.meta, glyph: "\u2311" },
    ctx: { color: tone.brand, glyph: "\u25D4" },
    doctor: { color: fg.meta, glyph: "\u2695" },
    branch: { color: tone.violet, glyph: "\u2387" }
  };
}
function defineTheme(base) {
  return { ...base, card: card(base.fg, base.tone) };
}
var githubDark = defineTheme({
  fg: {
    strong: "#e6edf3",
    body: "#c9d1d9",
    sub: "#8b949e",
    meta: "#6e7681",
    faint: "#484f58"
  },
  tone: {
    brand: "#79c0ff",
    accent: "#d2a8ff",
    violet: "#b395f5",
    ok: "#7ee787",
    warn: "#f0b07d",
    err: "#ff8b81",
    info: "#79c0ff"
  },
  toneActive: {
    brand: "#a5d6ff",
    accent: "#e2c5ff",
    violet: "#c8aaff",
    ok: "#a8f5ad",
    warn: "#ffc99e",
    err: "#ffaba3",
    info: "#a5d6ff"
  },
  surface: {
    bg: "#0a0c10",
    bgInput: "#0d1015",
    bgCode: "#06080c",
    bgElev: "#11141a"
  }
});
var dark = defineTheme({
  fg: {
    strong: "#f4f7fb",
    body: "#d8dee9",
    sub: "#a7b1c2",
    meta: "#778294",
    faint: "#4d5666"
  },
  tone: {
    brand: "#7dd3fc",
    accent: "#c084fc",
    violet: "#a78bfa",
    ok: "#86efac",
    warn: "#fbbf24",
    err: "#f87171",
    info: "#60a5fa"
  },
  toneActive: {
    brand: "#bae6fd",
    accent: "#e9d5ff",
    violet: "#ddd6fe",
    ok: "#bbf7d0",
    warn: "#fde68a",
    err: "#fecaca",
    info: "#bfdbfe"
  },
  surface: {
    bg: "#0b1020",
    bgInput: "#111827",
    bgCode: "#080c16",
    bgElev: "#151d2f"
  }
});
var light = defineTheme({
  fg: {
    strong: "#111827",
    body: "#1f2937",
    sub: "#4b5563",
    meta: "#6b7280",
    faint: "#9ca3af"
  },
  tone: {
    brand: "#2563eb",
    accent: "#7c3aed",
    violet: "#6d28d9",
    ok: "#15803d",
    warn: "#b45309",
    err: "#dc2626",
    info: "#0369a1"
  },
  toneActive: {
    brand: "#1d4ed8",
    accent: "#6d28d9",
    violet: "#5b21b6",
    ok: "#166534",
    warn: "#92400e",
    err: "#b91c1c",
    info: "#075985"
  },
  surface: {
    bg: "#ffffff",
    bgInput: "#f8fafc",
    bgCode: "#f3f4f6",
    bgElev: "#eef2f7"
  }
});
var tokyoNight = defineTheme({
  fg: {
    strong: "#c0caf5",
    body: "#a9b1d6",
    sub: "#9aa5ce",
    meta: "#565f89",
    faint: "#414868"
  },
  tone: {
    brand: "#7aa2f7",
    accent: "#bb9af7",
    violet: "#9d7cd8",
    ok: "#9ece6a",
    warn: "#e0af68",
    err: "#f7768e",
    info: "#2ac3de"
  },
  toneActive: {
    brand: "#a9c7ff",
    accent: "#d7b9ff",
    violet: "#c6a0f6",
    ok: "#b9f27c",
    warn: "#ffd089",
    err: "#ff9cac",
    info: "#7dcfff"
  },
  surface: {
    bg: "#1a1b26",
    bgInput: "#1f2335",
    bgCode: "#16161e",
    bgElev: "#24283b"
  }
});
var githubLight = defineTheme({
  fg: {
    strong: "#1f2328",
    body: "#24292f",
    sub: "#57606a",
    meta: "#6e7781",
    faint: "#8c959f"
  },
  tone: {
    brand: "#0969da",
    accent: "#8250df",
    violet: "#6639ba",
    ok: "#1a7f37",
    warn: "#9a6700",
    err: "#cf222e",
    info: "#0969da"
  },
  toneActive: {
    brand: "#0550ae",
    accent: "#6639ba",
    violet: "#512a97",
    ok: "#116329",
    warn: "#7d4e00",
    err: "#a40e26",
    info: "#0550ae"
  },
  surface: {
    bg: "#ffffff",
    bgInput: "#f6f8fa",
    bgCode: "#f6f8fa",
    bgElev: "#eaeef2"
  }
});
var highContrast = defineTheme({
  fg: {
    strong: "#ffffff",
    body: "#f5f5f5",
    sub: "#d4d4d4",
    meta: "#bdbdbd",
    faint: "#8a8a8a"
  },
  tone: {
    brand: "#00e5ff",
    accent: "#ff4dff",
    violet: "#b388ff",
    ok: "#00ff66",
    warn: "#ffdd00",
    err: "#ff4d4d",
    info: "#4da3ff"
  },
  toneActive: {
    brand: "#80f2ff",
    accent: "#ff99ff",
    violet: "#d0b3ff",
    ok: "#80ffb3",
    warn: "#ffee80",
    err: "#ff9999",
    info: "#99c9ff"
  },
  surface: {
    bg: "#000000",
    bgInput: "#0a0a0a",
    bgCode: "#050505",
    bgElev: "#141414"
  }
});
var THEMES = {
  default: githubDark,
  dark,
  light,
  "tokyo-night": tokyoNight,
  "github-dark": githubDark,
  "github-light": githubLight,
  "high-contrast": highContrast
};
var DEFAULT_THEME_NAME = "default";
function isThemeName(value) {
  return Object.prototype.hasOwnProperty.call(THEMES, value);
}
function resolveThemeName(value) {
  if (!value || value === "auto") return DEFAULT_THEME_NAME;
  return isThemeName(value) ? value : DEFAULT_THEME_NAME;
}
function listThemeNames() {
  return Object.keys(THEMES);
}
var DEFAULT_THEME = THEMES[DEFAULT_THEME_NAME];
var activeTheme = DEFAULT_THEME;
var activeThemeVersion = 0;
function setActiveTheme(theme) {
  const previousTheme = activeTheme;
  activeTheme = theme;
  activeThemeVersion += 1;
  const version = activeThemeVersion;
  return () => {
    if (activeThemeVersion !== version || activeTheme !== theme) return;
    activeTheme = previousTheme;
    activeThemeVersion += 1;
  };
}
function proxyTokens(select) {
  const target = select(DEFAULT_THEME);
  return new Proxy(target, {
    get(_target, prop) {
      return select(activeTheme)[prop];
    },
    getOwnPropertyDescriptor(_target, prop) {
      return Reflect.getOwnPropertyDescriptor(select(activeTheme), prop);
    },
    has(_target, prop) {
      return prop in select(activeTheme);
    },
    ownKeys() {
      return Reflect.ownKeys(select(activeTheme));
    }
  });
}
var FG = proxyTokens((theme) => theme.fg);
var TONE = proxyTokens((theme) => theme.tone);
var TONE_ACTIVE = proxyTokens((theme) => theme.toneActive);
var SURFACE = proxyTokens((theme) => theme.surface);
var CARD = proxyTokens((theme) => theme.card);
var USD_TO_CNY = 7.2;
var SYMBOL = { USD: "$", CNY: "\xA5" };
function formatBalance(amount, currency, opts) {
  const cur = currency ?? "CNY";
  const sym = SYMBOL[cur];
  const digits = opts?.fractionDigits ?? 2;
  const body = sym ? `${sym}${amount.toFixed(digits)}` : `${cur} ${amount.toFixed(digits)}`;
  return opts?.label ? `w ${body}` : body;
}
function formatCost(costUsd, currency, fractionDigits = 4) {
  const cur = currency ?? "CNY";
  const amount = cur === "CNY" ? costUsd * USD_TO_CNY : costUsd;
  return formatBalance(amount, cur, { fractionDigits });
}
function balanceColor(amount, currency) {
  const cny = (currency ?? "CNY") === "USD" ? amount * USD_TO_CNY : amount;
  if (cny < 5) return TONE.err;
  if (cny < 20) return TONE.warn;
  return TONE.brand;
}

// src/index/config.ts
var import_picomatch = __toESM(require_picomatch2(), 1);
var DEFAULT_INDEX_EXCLUDES = {
  dirs: [
    "node_modules",
    ".git",
    ".hg",
    ".svn",
    "dist",
    "build",
    "out",
    ".next",
    ".nuxt",
    "target",
    ".venv",
    "venv",
    "__pycache__",
    ".pytest_cache",
    ".mypy_cache",
    ".cache",
    "coverage",
    ".turbo",
    ".vercel",
    ".visionox"
  ],
  files: [
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "Cargo.lock",
    "poetry.lock",
    "Pipfile.lock",
    "go.sum",
    ".DS_Store"
  ],
  exts: [
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".bmp",
    ".ico",
    ".tiff",
    ".woff",
    ".woff2",
    ".ttf",
    ".otf",
    ".eot",
    ".zip",
    ".tar",
    ".gz",
    ".bz2",
    ".xz",
    ".rar",
    ".7z",
    ".exe",
    ".dll",
    ".so",
    ".dylib",
    ".bin",
    ".class",
    ".jar",
    ".war",
    ".wasm",
    ".o",
    ".obj",
    ".lib",
    ".a",
    ".pyc",
    ".pyo",
    ".mp3",
    ".mp4",
    ".wav",
    ".ogg",
    ".webm",
    ".mov",
    ".avi",
    ".pdf",
    ".sqlite",
    ".db"
  ]
};
var DEFAULT_MAX_FILE_BYTES = 256 * 1024;
var DEFAULT_RESPECT_GITIGNORE = true;
function defaultIndexConfig() {
  return {
    excludeDirs: [...DEFAULT_INDEX_EXCLUDES.dirs],
    excludeFiles: [...DEFAULT_INDEX_EXCLUDES.files],
    excludeExts: [...DEFAULT_INDEX_EXCLUDES.exts],
    excludePatterns: [],
    respectGitignore: DEFAULT_RESPECT_GITIGNORE,
    maxFileBytes: DEFAULT_MAX_FILE_BYTES
  };
}
function resolveIndexConfig(user) {
  const d = defaultIndexConfig();
  if (!user) return d;
  return {
    excludeDirs: Array.isArray(user.excludeDirs) ? [...user.excludeDirs] : d.excludeDirs,
    excludeFiles: Array.isArray(user.excludeFiles) ? [...user.excludeFiles] : d.excludeFiles,
    excludeExts: Array.isArray(user.excludeExts) ? user.excludeExts.map((e) => e.toLowerCase()) : d.excludeExts,
    excludePatterns: Array.isArray(user.excludePatterns) ? [...user.excludePatterns] : [],
    respectGitignore: typeof user.respectGitignore === "boolean" ? user.respectGitignore : d.respectGitignore,
    maxFileBytes: typeof user.maxFileBytes === "number" && user.maxFileBytes > 0 ? user.maxFileBytes : d.maxFileBytes
  };
}
function compileFilters(cfg) {
  const matcher = cfg.excludePatterns.length === 0 ? () => false : (0, import_picomatch.default)(cfg.excludePatterns, { dot: true });
  return {
    dirSet: new Set(cfg.excludeDirs),
    fileSet: new Set(cfg.excludeFiles),
    extSet: new Set(cfg.excludeExts.map((e) => e.toLowerCase())),
    patternMatch: matcher,
    respectGitignore: cfg.respectGitignore,
    maxFileBytes: cfg.maxFileBytes
  };
}

// src/config.ts
var BUILTIN_TYPE_DOCS = {
  user: "role / skills / preferences",
  feedback: "corrections or confirmed approaches",
  project: "facts / decisions about the current work",
  reference: "pointers to external systems the user uses"
};
function loadMemoryTypeRegistry(cfg = readConfig()) {
  const out = [];
  for (const name of ["user", "feedback", "project", "reference"]) {
    out.push({ name, builtin: true, description: BUILTIN_TYPE_DOCS[name] });
  }
  const seen = new Set(out.map((e) => e.name));
  for (const raw of cfg.memory?.customTypes ?? []) {
    if (!raw || typeof raw.name !== "string") continue;
    const name = raw.name.trim();
    if (!name || !/^[a-zA-Z][a-zA-Z0-9_-]{0,31}$/.test(name)) continue;
    if (seen.has(name)) continue;
    seen.add(name);
    const entry = { name, builtin: false };
    if (typeof raw.description === "string") entry.description = raw.description;
    if (raw.priority === "low" || raw.priority === "medium" || raw.priority === "high") {
      entry.priority = raw.priority;
    }
    if (raw.expires === "project_end") entry.expires = raw.expires;
    out.push(entry);
  }
  return out;
}
function memoryTypeDefaults(typeName, cfg = readConfig()) {
  const found = loadMemoryTypeRegistry(cfg).find((e) => e.name === typeName);
  if (!found) return {};
  const out = {};
  if (found.priority) out.priority = found.priority;
  if (found.expires) out.expires = found.expires;
  return out;
}
var DEFAULT_OLLAMA_URL = "http://localhost:11434";
var DEFAULT_EMBED_MODEL = "nomic-embed-text";
var DEFAULT_TIMEOUT_MS = 3e4;
function defaultConfigPath() {
  return join(homedir(), ".visionox", "config.json");
}
// In-process config cache keyed by file mtime. readConfig is called on every
// tool invocation's permission checks (loadEditMode, loadProjectShellAllowed,
// ...); statSync is 1-2 orders of magnitude cheaper than readFileSync+JSON.parse.
// writeConfig updates mtime on disk, so the next read naturally invalidates.
var _configCache = { path: null, mtimeMs: -1, parsed: {} };
function readConfig(path = defaultConfigPath()) {
  try {
    const mtimeMs = statSync(path).mtimeMs;
    if (_configCache.path === path && _configCache.mtimeMs === mtimeMs) {
      return _configCache.parsed;
    }
    const raw = readFileSync(path, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      _configCache = { path, mtimeMs, parsed };
      return parsed;
    }
  } catch {
  }
  return {};
}
function atomicWriteSync(path, body, tmp, mode = 384) {
  try {
    writeFileSync(tmp, body, "utf8");
    try {
      chmodSync(tmp, mode);
    } catch {
    }
    try {
      renameSync(tmp, path);
    } catch (err) {
      if (err.code !== "EXDEV") throw err;
      copyFileSync(tmp, path);
      try {
        chmodSync(path, mode);
      } catch {
      }
    }
  } catch (err2) {
    try {
      unlinkSync(tmp);
    } catch {
    }
    throw err2;
  }
  try {
    unlinkSync(tmp);
  } catch {
  }
}
function writeConfig(cfg, path = defaultConfigPath()) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  atomicWriteSync(path, JSON.stringify(cfg, null, 2), tmp);
}
function loadLanguage(path = defaultConfigPath()) {
  return readConfig(path).lang;
}
function mcpEnvFor(serverName, cfg) {
  if (!serverName) return void 0;
  const entry = cfg.mcpEnv?.[serverName];
  if (!entry) return void 0;
  const filtered = {};
  for (const [k, v] of Object.entries(entry)) {
    if (typeof v === "string" && v.length > 0) filtered[k] = v;
  }
  return Object.keys(filtered).length > 0 ? filtered : void 0;
}
function saveLanguage(lang, path = defaultConfigPath()) {
  const cfg = readConfig(path);
  cfg.lang = lang;
  writeConfig(cfg, path);
}
function loadApiKey(path = defaultConfigPath()) {
  if (process.env.DEEPSEEK_API_KEY) return process.env.DEEPSEEK_API_KEY;
  const cfg = readConfig(path);
  const provider = (cfg.providers ?? []).find((p) => p.id === cfg.activeProviderId) ?? cfg.providers?.[0];
  if (provider?.apiKey) return provider.apiKey;
  return cfg.apiKey;
}
function loadBaseUrl(path = defaultConfigPath()) {
  if (process.env.DEEPSEEK_BASE_URL) return process.env.DEEPSEEK_BASE_URL;
  const cfg = readConfig(path);
  const provider = (cfg.providers ?? []).find((p) => p.id === cfg.activeProviderId) ?? cfg.providers?.[0];
  if (provider?.baseUrl) return provider.baseUrl;
  return cfg.baseUrl;
}
function saveBaseUrl(url, path = defaultConfigPath()) {
  const cfg = readConfig(path);
  const trimmed = url.trim();
  if (trimmed) {
    cfg.baseUrl = trimmed;
  } else {
    cfg.baseUrl = void 0;
  }
  writeConfig(cfg, path);
}
function searchEnabled(path = defaultConfigPath()) {
  const env = process.env.visionox_SEARCH;
  if (env === "off" || env === "false" || env === "0") return false;
  const cfg = readConfig(path).search;
  if (cfg === false) return false;
  return true;
}
function webSearchEngine(path = defaultConfigPath()) {
  const cfg = readConfig(path).webSearchEngine;
  if (cfg === "searxng") return "searxng";
  if (cfg === "bing") return "bing";
  if (cfg === "bing-scrape") return "bing-scrape";
  if (cfg === "mojeek") return "mojeek";
  return "bing-scrape";
}
function webSearchEndpoint(path = defaultConfigPath()) {
  const cfg = readConfig(path).webSearchEndpoint;
  if (cfg && typeof cfg === "string") return cfg;
  return "http://localhost:8080";
}
function loadBingApiKey(path = defaultConfigPath()) {
  const cfg = readConfig(path).bingApiKey;
  if (cfg && typeof cfg === "string") return cfg.trim();
  return null;
}
function saveApiKey(key, path = defaultConfigPath()) {
  const cfg = readConfig(path);
  cfg.apiKey = key.trim();
  writeConfig(cfg, path);
}
function findProjectKey(cfg, rootDir) {
  const projects = cfg.projects;
  if (!projects) return void 0;
  if (Object.hasOwn(projects, rootDir)) return rootDir;
  if (process.platform !== "win32") return void 0;
  const lower = rootDir.toLowerCase();
  for (const k of Object.keys(projects)) {
    if (k.toLowerCase() === lower) return k;
  }
  return void 0;
}
function loadProjectShellAllowed(rootDir, path = defaultConfigPath()) {
  const cfg = readConfig(path);
  const key = findProjectKey(cfg, rootDir);
  if (key === void 0) return [];
  return cfg.projects?.[key]?.shellAllowed ?? [];
}
function addProjectShellAllowed(rootDir, prefix, path = defaultConfigPath()) {
  const trimmed = prefix.trim();
  if (!trimmed) return;
  const cfg = readConfig(path);
  if (!cfg.projects) cfg.projects = {};
  const key = findProjectKey(cfg, rootDir) ?? rootDir;
  if (!cfg.projects[key]) cfg.projects[key] = {};
  const existing = cfg.projects[key].shellAllowed ?? [];
  if (existing.includes(trimmed)) return;
  cfg.projects[key].shellAllowed = [...existing, trimmed];
  writeConfig(cfg, path);
}
function removeProjectShellAllowed(rootDir, prefix, path = defaultConfigPath()) {
  const trimmed = prefix.trim();
  if (!trimmed) return false;
  const cfg = readConfig(path);
  const key = findProjectKey(cfg, rootDir);
  if (key === void 0) return false;
  const existing = cfg.projects?.[key]?.shellAllowed ?? [];
  if (!existing.includes(trimmed)) return false;
  const next = existing.filter((p) => p !== trimmed);
  if (!cfg.projects) cfg.projects = {};
  if (!cfg.projects[key]) cfg.projects[key] = {};
  cfg.projects[key].shellAllowed = next;
  writeConfig(cfg, path);
  return true;
}
function clearProjectShellAllowed(rootDir, path = defaultConfigPath()) {
  const cfg = readConfig(path);
  const key = findProjectKey(cfg, rootDir);
  if (key === void 0) return 0;
  const existing = cfg.projects?.[key]?.shellAllowed ?? [];
  if (existing.length === 0) return 0;
  if (!cfg.projects) cfg.projects = {};
  if (!cfg.projects[key]) cfg.projects[key] = {};
  cfg.projects[key].shellAllowed = [];
  writeConfig(cfg, path);
  return existing.length;
}
function loadProjectPathAllowed(rootDir, path = defaultConfigPath()) {
  const cfg = readConfig(path);
  const key = findProjectKey(cfg, rootDir);
  if (key === void 0) return [];
  return cfg.projects?.[key]?.pathAllowed ?? [];
}
function addProjectPathAllowed(rootDir, prefix, path = defaultConfigPath()) {
  const trimmed = prefix.trim();
  if (!trimmed) return;
  const cfg = readConfig(path);
  if (!cfg.projects) cfg.projects = {};
  const key = findProjectKey(cfg, rootDir) ?? rootDir;
  if (!cfg.projects[key]) cfg.projects[key] = {};
  const existing = cfg.projects[key].pathAllowed ?? [];
  if (existing.includes(trimmed)) return;
  cfg.projects[key].pathAllowed = [...existing, trimmed];
  writeConfig(cfg, path);
}
function loadEditMode(path = defaultConfigPath()) {
  const v = readConfig(path).editMode;
  if (v === "auto" || v === "yolo" || v === "admin") return v;
  if (v === "review") return "auto";
  return "admin";
}
function saveEditMode(mode, path = defaultConfigPath()) {
  const cfg = readConfig(path);
  cfg.editMode = mode;
  writeConfig(cfg, path);
}
function editModeHintShown(path = defaultConfigPath()) {
  return readConfig(path).editModeHintShown === true;
}
function mouseClipboardHintShown(path = defaultConfigPath()) {
  return readConfig(path).mouseClipboardHintShown === true;
}
function loadReasoningEffort(path = defaultConfigPath()) {
  const v = readConfig(path).reasoningEffort;
  return v === "high" ? "high" : "max";
}
function loadTheme(path = defaultConfigPath()) {
  const value = readConfig(path).theme;
  if (value === "auto") return "auto";
  if (typeof value === "string" && isThemeName(value)) return value;
  return void 0;
}
function resolveThemePreference(configTheme, envTheme) {
  if (configTheme && configTheme !== "auto") return configTheme;
  return resolveThemeName(envTheme);
}
function saveTheme(theme, path = defaultConfigPath()) {
  const cfg = readConfig(path);
  cfg.theme = theme;
  writeConfig(cfg, path);
}
function saveReasoningEffort(effort, path = defaultConfigPath()) {
  const cfg = readConfig(path);
  cfg.reasoningEffort = effort;
  writeConfig(cfg, path);
}
function loadWorkspaceDir(path = defaultConfigPath()) {
  const v = readConfig(path).workspaceDir;
  return typeof v === "string" && v.trim() ? v : void 0;
}
function saveWorkspaceDir(dir, path = defaultConfigPath()) {
  const cfg = readConfig(path);
  const trimmed = dir.trim();
  if (trimmed) cfg.workspaceDir = trimmed;
  else cfg.workspaceDir = void 0;
  writeConfig(cfg, path);
}
function loadEditor(path = defaultConfigPath()) {
  const v = readConfig(path).editor;
  return typeof v === "string" && v.trim() ? v : void 0;
}
function saveEditor(editor, path = defaultConfigPath()) {
  const cfg = readConfig(path);
  const trimmed = editor.trim();
  if (trimmed) cfg.editor = trimmed;
  else cfg.editor = void 0;
  writeConfig(cfg, path);
}
function loadRecentWorkspaces(path = defaultConfigPath()) {
  const v = readConfig(path).recentWorkspaces;
  return Array.isArray(v) ? v.filter((s) => typeof s === "string") : [];
}
var MAX_RECENT_WORKSPACES = 8;
function pushRecentWorkspace(dir, path = defaultConfigPath()) {
  const trimmed = dir.trim();
  if (!trimmed) return;
  const cfg = readConfig(path);
  const list = (cfg.recentWorkspaces ?? []).filter((s) => s !== trimmed);
  list.unshift(trimmed);
  cfg.recentWorkspaces = list.slice(0, MAX_RECENT_WORKSPACES);
  writeConfig(cfg, path);
}
function loadPreset(path = defaultConfigPath()) {
  return readConfig(path).preset;
}
function savePreset(preset, path = defaultConfigPath()) {
  const cfg = readConfig(path);
  cfg.preset = preset;
  writeConfig(cfg, path);
}
function loadIndexUserConfig(path = defaultConfigPath()) {
  return readConfig(path).index ?? {};
}
function loadIndexConfig(path = defaultConfigPath()) {
  return resolveIndexConfig(readConfig(path).index);
}
function loadSemanticEmbeddingUserConfig(path = defaultConfigPath()) {
  return normalizeSemanticEmbeddingUserConfig(readConfig(path).semantic);
}
function saveSemanticEmbeddingConfig(user, path = defaultConfigPath()) {
  const cfg = readConfig(path);
  cfg.semantic = normalizeSemanticEmbeddingUserConfig(user);
  writeConfig(cfg, path);
}
function resolveSemanticEmbeddingConfig(path = defaultConfigPath()) {
  const user = loadSemanticEmbeddingUserConfig(path);
  const provider = user.provider ?? "ollama";
  if (provider === "openai-compat") {
    const baseUrl = user.openaiCompat?.baseUrl?.trim() ?? "";
    const apiKey = user.openaiCompat?.apiKey?.trim() ?? "";
    const model = user.openaiCompat?.model?.trim() ?? "";
    if (!baseUrl) throw new Error("OpenAI-compatible embeddings require an API URL.");
    requireValidUrl(baseUrl, "OpenAI-compatible API URL");
    if (!apiKey) throw new Error("OpenAI-compatible embeddings require an API key.");
    if (!model) throw new Error("OpenAI-compatible embeddings require a model.");
    return {
      provider,
      baseUrl,
      apiKey,
      model,
      extraBody: normalizeExtraBody(user.openaiCompat?.extraBody),
      timeoutMs: DEFAULT_TIMEOUT_MS
    };
  }
  return {
    provider: "ollama",
    baseUrl: user.ollama?.baseUrl?.trim() || process.env.OLLAMA_URL || DEFAULT_OLLAMA_URL,
    model: user.ollama?.model?.trim() || process.env.visionox_EMBED_MODEL || DEFAULT_EMBED_MODEL,
    timeoutMs: DEFAULT_TIMEOUT_MS
  };
}
function redactSemanticEmbeddingConfig(user) {
  const normalized = normalizeSemanticEmbeddingUserConfig(user);
  return {
    provider: normalized.provider ?? "ollama",
    ollama: {
      baseUrl: normalized.ollama?.baseUrl?.trim() || process.env.OLLAMA_URL || DEFAULT_OLLAMA_URL,
      model: normalized.ollama?.model?.trim() || process.env.visionox_EMBED_MODEL || DEFAULT_EMBED_MODEL
    },
    openaiCompat: {
      baseUrl: normalized.openaiCompat?.baseUrl?.trim() ?? "",
      apiKey: normalized.openaiCompat?.apiKey ? redactKey(normalized.openaiCompat.apiKey) : "",
      apiKeySet: Boolean(normalized.openaiCompat?.apiKey?.trim()),
      model: normalized.openaiCompat?.model?.trim() ?? "",
      extraBody: normalizeExtraBody(normalized.openaiCompat?.extraBody)
    }
  };
}
function markEditModeHintShown(path = defaultConfigPath()) {
  const cfg = readConfig(path);
  if (cfg.editModeHintShown === true) return;
  cfg.editModeHintShown = true;
  writeConfig(cfg, path);
}
function markMouseClipboardHintShown(path = defaultConfigPath()) {
  const cfg = readConfig(path);
  if (cfg.mouseClipboardHintShown === true) return;
  cfg.mouseClipboardHintShown = true;
  writeConfig(cfg, path);
}
function isPlausibleKey(key) {
  const trimmed = key.trim();
  if (trimmed.length < 16) return false;
  return !/\s/.test(trimmed);
}
function redactKey(key) {
  if (!key) return "";
  if (key.length <= 12) return "****";
  return `${key.slice(0, 6)}\u2026${key.slice(-4)}`;
}
function normalizeSemanticEmbeddingUserConfig(cfg) {
  return {
    provider: cfg?.provider === "openai-compat" ? "openai-compat" : "ollama",
    ollama: {
      baseUrl: normalizeOptionalString(cfg?.ollama?.baseUrl),
      model: normalizeOptionalString(cfg?.ollama?.model)
    },
    openaiCompat: {
      baseUrl: normalizeOptionalString(cfg?.openaiCompat?.baseUrl),
      apiKey: normalizeOptionalString(cfg?.openaiCompat?.apiKey),
      model: normalizeOptionalString(cfg?.openaiCompat?.model),
      extraBody: normalizeExtraBody(cfg?.openaiCompat?.extraBody)
    }
  };
}
function normalizeOptionalString(value) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : void 0;
}
function normalizeExtraBody(value) {
  if (value === void 0) return {};
  if (!isPlainObject(value)) {
    throw new Error("Semantic embedding extraBody must be a JSON object.");
  }
  return { ...value };
}
function requireValidUrl(value, label) {
  try {
    new URL(value);
  } catch {
    throw new Error(`${label} must be a valid URL.`);
  }
}
function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export {
  THEMES,
  DEFAULT_THEME_NAME,
  isThemeName,
  resolveThemeName,
  listThemeNames,
  setActiveTheme,
  FG,
  TONE,
  TONE_ACTIVE,
  SURFACE,
  CARD,
  formatBalance,
  formatCost,
  balanceColor,
  require_picomatch2 as require_picomatch,
  DEFAULT_INDEX_EXCLUDES,
  DEFAULT_MAX_FILE_BYTES,
  DEFAULT_RESPECT_GITIGNORE,
  defaultIndexConfig,
  resolveIndexConfig,
  compileFilters,
  loadMemoryTypeRegistry,
  memoryTypeDefaults,
  defaultConfigPath,
  readConfig,
  writeConfig,
  loadLanguage,
  mcpEnvFor,
  saveLanguage,
  loadApiKey,
  loadBaseUrl,
  saveBaseUrl,
  searchEnabled,
  webSearchEngine,
  webSearchEndpoint,
  loadBingApiKey,
  saveApiKey,
  loadProjectShellAllowed,
  addProjectShellAllowed,
  removeProjectShellAllowed,
  clearProjectShellAllowed,
  loadProjectPathAllowed,
  addProjectPathAllowed,
  loadEditMode,
  saveEditMode,
  editModeHintShown,
  mouseClipboardHintShown,
  loadReasoningEffort,
  loadTheme,
  resolveThemePreference,
  saveTheme,
  saveReasoningEffort,
  loadWorkspaceDir,
  saveWorkspaceDir,
  loadEditor,
  saveEditor,
  loadRecentWorkspaces,
  pushRecentWorkspace,
  loadPreset,
  savePreset,
  loadIndexUserConfig,
  loadIndexConfig,
  loadSemanticEmbeddingUserConfig,
  saveSemanticEmbeddingConfig,
  resolveSemanticEmbeddingConfig,
  redactSemanticEmbeddingConfig,
  markEditModeHintShown,
  markMouseClipboardHintShown,
  isPlausibleKey,
  redactKey
};
//# sourceMappingURL=chunk-XPDVG52A.js.map