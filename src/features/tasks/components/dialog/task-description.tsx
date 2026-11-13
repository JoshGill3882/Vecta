import type { Paragraph, Parent, Root, Text } from "mdast";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

/** Parents whose children are blocks, so a paragraph can stand among them. */
const BLOCK_PARENTS = new Set(["root", "blockquote", "listItem", "footnoteDefinition"]);

/** Replaces every raw-HTML node under `parent` with text of the same characters.
 *
 * HTML standing alone as a block is wrapped in a paragraph, so it gets the same
 * spacing as any other paragraph; inline HTML becomes text where it sits.
 *
 * @param parent The node whose descendants are rewritten, in place.
 */
function htmlToText(parent: Parent): void {
  parent.children = parent.children.map((child) => {
    if (child.type !== "html") {
      if ("children" in child) htmlToText(child);
      return child;
    }
    const text: Text = { type: "text", value: child.value, position: child.position };
    if (!BLOCK_PARENTS.has(parent.type)) return text;
    const paragraph: Paragraph = { type: "paragraph", children: [text], position: child.position };
    return paragraph;
  });
}

/** Remark plugin that shows raw HTML in the source as the text it was typed as.
 *
 * @returns The transformer, which rewrites the parsed tree in place.
 */
function remarkHtmlAsText() {
  return (tree: Root) => htmlToText(tree);
}

/** Renders a task's Markdown description.
 *
 * Safety is the whole point of this component, so the layers are deliberate and
 * must not be loosened:
 *
 * - Raw HTML in the source is never parsed into elements. `remarkHtmlAsText`
 *   turns it into plain text, which React escapes, so an embedded `<script>`
 *   or `<img onerror=...>` is shown exactly as typed and does nothing. Dropping
 *   it instead would make what the user wrote silently disappear.
 * - `rehype-sanitize` whitelists the resulting tree (GitHub's schema) as
 *   defence in depth, stripping any unsafe element/attribute that slips through.
 * - react-markdown's built-in `urlTransform` drops `javascript:`/`data:` URLs,
 *   and the `a` override forces every link to open in a new, decoupled tab.
 *
 * Never add `rehype-raw` or `dangerouslySetInnerHTML` here - either would turn
 * this back into an XSS surface. Visual styling lives in `.task-markdown`
 * (see app/globals.css); this file owns only structure and safety.
 */
export function TaskDescription({ markdown }: { markdown: string }) {
  return (
    <div className="task-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkHtmlAsText]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          a: ({ node: _node, ...props }) => (
            <a {...props} target="_blank" rel="noopener noreferrer nofollow" />
          ),
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
