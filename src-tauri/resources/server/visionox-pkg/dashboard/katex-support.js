(function installVisionoxKatex(root) {
  const MAX_FORMULA_LENGTH = 10_000;

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[char]);
  }

  function renderFormula(formula, displayMode) {
    const source = String(formula ?? "").trim();
    if (!source || source.length > MAX_FORMULA_LENGTH || typeof root.katex?.renderToString !== "function") {
      return `<code class="visionox-math-fallback">${escapeHtml(source)}</code>`;
    }
    try {
      return root.katex.renderToString(source, {
        displayMode,
        output: "htmlAndMathml",
        strict: "warn",
        throwOnError: false,
        trust: false,
      });
    } catch {
      return `<code class="visionox-math-fallback">${escapeHtml(source)}</code>`;
    }
  }

  function markedExtensions() {
    return [
      {
        name: "visionoxBlockMath",
        level: "block",
        start: (source) => source.indexOf("$$"),
        tokenizer(source) {
          const match = /^\$\$[ \t]*\n?([\s\S]+?)\n?[ \t]*\$\$(?:[ \t]*(?:\n|$))/.exec(source);
          if (!match || !match[1].trim()) return undefined;
          return { type: "visionoxBlockMath", raw: match[0], text: match[1] };
        },
        renderer(token) {
          return `<div class="visionox-math-block">${renderFormula(token.text, true)}</div>\n`;
        },
      },
      {
        name: "visionoxInlineMath",
        level: "inline",
        start: (source) => source.indexOf("$"),
        tokenizer(source) {
          const match = /^\$(?!\$|\s)((?:\\.|[^$\\\n])+?)(?<!\s)\$(?!\$|\d)/.exec(source);
          if (!match || !match[1].trim()) return undefined;
          return { type: "visionoxInlineMath", raw: match[0], text: match[1] };
        },
        renderer(token) {
          return `<span class="visionox-math-inline">${renderFormula(token.text, false)}</span>`;
        },
      },
    ];
  }

  root.VisionoxKatex = { markedExtensions };
})(globalThis);
