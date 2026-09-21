import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

/**
 * Renders a task's Markdown description. Safety is the whole point of this
 * component, so the layers are deliberate and must not be loosened:
 *
 * - No `rehype-raw`, so raw HTML in the source is never parsed into elements —
 *   an embedded `<script>` or `<img onerror=…>` stays inert text.
 * - `rehype-sanitize` whitelists the resulting tree (GitHub's schema) as
 *   defence in depth, stripping any unsafe element/attribute that slips through.
 * - react-markdown's built-in `urlTransform` drops `javascript:`/`data:` URLs,
 *   and the `a` override forces every link to open in a new, decoupled tab.
 *
 * Never add `rehype-raw` or `dangerouslySetInnerHTML` here — either would turn
 * this back into an XSS surface. Visual styling lives in `.task-markdown`
 * (see app/globals.css); this file owns only structure and safety.
 */
export function TaskDescription({ markdown }: { markdown: string }) {
  return (
    <div className="task-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
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
