import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TaskDescription } from "@/app/(app)/tasks/task-description";

/**
 * The renderer is the app's primary XSS surface (issue #24), so these tests
 * pin the safety contract as much as the formatting. react-markdown renders
 * synchronously, so static markup is enough — no DOM required.
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

  it("never renders raw HTML embedded in the source", () => {
    const html = render("before <script>alert(1)</script> <b>after</b>");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<b>");
    // The surrounding Markdown still renders.
    expect(html).toContain("before");
    expect(html).toContain("after");
  });

  it("neutralises an img onerror payload", () => {
    const html = render('![x](https://e.com/a.png "t") <img src=x onerror="alert(1)">');
    expect(html).not.toContain("onerror");
  });

  it("strips dangerous URL protocols from links and images", () => {
    const html = render(
      ["[click](javascript:alert(1))", "", "![x](javascript:alert(2))"].join("\n")
    );
    expect(html.toLowerCase()).not.toContain("javascript:");
  });
});
