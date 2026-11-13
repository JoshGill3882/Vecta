import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TaskDescription } from "@/src/features/tasks/components/dialog/task-description";

/** Renders the description component to static markup.
 *
 * The renderer is the application's primary XSS surface, so these cases pin
 * the safety contract as much as the formatting. react-markdown renders
 * synchronously, so static markup is enough and no DOM is required.
 *
 * @param markdown The description to render.
 * @returns The rendered HTML, as a string to assert against.
 */
function render(markdown: string): string {
  return renderToStaticMarkup(createElement(TaskDescription, { markdown }));
}

describe("TaskDescription", () => {
  it("renders CommonMark: headings, emphasis, lists, code, and links", () => {
    const html = render(
      ["# Title", "", "Some **bold** and `inline code`.", "", "- one", "- two"].join("\n")
    );
    expect(html).toContain("<h1>Title</h1>");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<code>inline code</code>");
    expect(html).toContain("<ul>");
    expect(html).toContain("<li>one</li>");
  });

  it("renders GFM extensions: tables and strikethrough", () => {
    const html = render(["| a | b |", "| - | - |", "| 1 | 2 |", "", "~~gone~~"].join("\n"));
    expect(html).toContain("<table>");
    expect(html).toContain("<del>gone</del>");
  });

  it("renders fenced code blocks as pre > code", () => {
    const html = render(["```", "const x = 1;", "```"].join("\n"));
    expect(html).toContain("<pre>");
    expect(html).toContain("const x = 1;");
  });

  it("opens links in a decoupled new tab", () => {
    const html = render("[docs](https://example.com)");
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer nofollow"');
  });

  describe("raw HTML in the source", () => {
    it("shows a script block as the text that was typed, in a paragraph", () => {
      const html = render("<script> </script>");
      expect(html).toBe('<div class="task-markdown"><p>&lt;script&gt; &lt;/script&gt;</p></div>');
    });

    it("shows a tag inside a sentence where it was typed", () => {
      expect(render("Fix the <div> layout")).toContain("<p>Fix the &lt;div&gt; layout</p>");
    });

    it("never makes an element from it", () => {
      const html = render("before <script>alert(1)</script> <b>after</b>");
      expect(html).not.toContain("<script");
      expect(html).not.toContain("<b>");
      expect(html).toContain(
        "before &lt;script&gt;alert(1)&lt;/script&gt; &lt;b&gt;after&lt;/b&gt;"
      );
    });

    it("neutralises an img onerror payload, showing it as text", () => {
      const html = render('![x](https://e.com/a.png "t") <img src=x onerror="alert(1)">');
      expect(html).not.toMatch(/<[^>]*\sonerror=/);
      expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    });

    it("treats a block inside a blockquote or a list item like any other text there", () => {
      expect(render("> <div>quoted</div>")).toContain(
        "<blockquote>\n<p>&lt;div&gt;quoted&lt;/div&gt;</p>\n</blockquote>"
      );
      // A tight list draws its items' paragraphs without <p>, as "- one" does.
      expect(render("- <div>listed</div>")).toContain("<li>&lt;div&gt;listed&lt;/div&gt;</li>");
      expect(render(["- <div>a</div>", "", "- b"].join("\n"))).toContain(
        "<li>\n<p>&lt;div&gt;a&lt;/div&gt;</p>\n</li>"
      );
    });

    it("leaves code spans, fenced code and autolinks as they were", () => {
      expect(render("Use `<script>` tags")).toContain("<code>&lt;script&gt;</code>");
      expect(render(["```html", "<b>x</b>", "```"].join("\n"))).toContain(
        '<pre><code class="language-html">&lt;b&gt;x&lt;/b&gt;\n</code></pre>'
      );
      expect(render("<https://example.com>")).toContain('href="https://example.com"');
    });
  });

  it("strips dangerous URL protocols from links and images", () => {
    const html = render(
      ["[click](javascript:alert(1))", "", "![x](javascript:alert(2))"].join("\n")
    );
    expect(html.toLowerCase()).not.toContain("javascript:");
  });
});
