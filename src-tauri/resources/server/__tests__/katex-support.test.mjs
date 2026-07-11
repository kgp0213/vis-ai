import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { Marked } from "../visionox-pkg/node_modules/marked/lib/marked.esm.js";

const originalKatex = globalThis.katex;

describe("Dashboard KaTeX markdown extension", () => {
  before(async () => {
    globalThis.katex = {
      renderToString(formula, options) {
        const mode = options.displayMode ? "block" : "inline";
        return `<span class="katex" data-mode="${mode}">${formula}</span>`;
      },
    };
    await import("../visionox-pkg/dashboard/katex-support.js");
  });

  after(() => {
    if (originalKatex === undefined) delete globalThis.katex;
    else globalThis.katex = originalKatex;
    delete globalThis.VisionoxKatex;
  });

  function render(markdown) {
    const marked = new Marked({ gfm: true });
    marked.use({ extensions: globalThis.VisionoxKatex.markedExtensions() });
    return marked.parse(markdown);
  }

  test("renders inline and display formulas through the same extension", () => {
    const html = render("Energy $E=mc^2$.\n\n$$\n\\int_0^1 x\\,dx\n$$\n");
    assert.match(html, /class="katex" data-mode="inline">E=mc\^2/);
    assert.match(html, /class="katex" data-mode="block">\\int_0\^1 x\\,dx/);
  });

  test("does not render formulas inside code or ambiguous currency text", () => {
    const html = render("`$inline$`\n\n```text\n$block$\n```\n\nPrices: $5 and $10.\n");
    assert.doesNotMatch(html, /class="katex"/);
    assert.match(html, /\$inline\$/);
    assert.match(html, /\$block\$/);
    assert.match(html, /\$5 and \$10/);
  });

  test("the bundled KaTeX distribution produces HTML and MathML", () => {
    const source = readFileSync(new URL("../visionox-pkg/dashboard/vendor/katex/katex.min.js", import.meta.url), "utf8");
    const sandbox = { self: {} };
    vm.runInNewContext(source, sandbox);
    const html = sandbox.self.katex.renderToString("E=mc^2", {
      output: "htmlAndMathml",
      throwOnError: false,
      trust: false,
    });
    assert.match(html, /class="katex"/);
    assert.match(html, /<math/);
    assert.match(html, /E=mc\^2/);
  });

  test("uses safe KaTeX rendering options", () => {
    let received;
    globalThis.katex.renderToString = (_formula, options) => {
      received = options;
      return '<span class="katex"></span>';
    };
    render("$x$");
    assert.deepEqual(received, {
      displayMode: false,
      output: "htmlAndMathml",
      strict: "warn",
      throwOnError: false,
      trust: false,
    });
  });
});
