import ReactMarkdown from "react-markdown";
import { splitPublicContentText, type PublicContentFields } from "./content-translation";

type MarkdownNode = { type: string; value?: string; children?: MarkdownNode[] };

/** Translate text leaves only: Markdown structure, URLs, HTML and code never enter the provider. */
export function markdownTranslationPlugin(text: (field: string, original: string) => string) {
  return function plugin() {
    return function transform(tree: unknown) {
      let index = 0;
      function visit(node: MarkdownNode) {
        if (["code", "inlineCode", "html"].includes(node.type)) return;
        if (node.type === "text" && typeof node.value === "string") {
          const current = index++;
          node.value = splitPublicContentText(node.value).map((part, chunk) => text(`markdownText.${current}.${chunk}`, part)).join("");
        }
        node.children?.forEach(visit);
      }
      visit(tree as MarkdownNode);
    };
  };
}

export function markdownTranslationFields(markdown: string): PublicContentFields {
  const fields: PublicContentFields = {};
  // react-markdown's synchronous renderer runs the same public remark plugins used by the view.
  ReactMarkdown({ children: markdown, remarkPlugins: [markdownTranslationPlugin((field, value) => {
    if (value.trim()) fields[field] = value;
    return value;
  })] });
  return fields;
}
