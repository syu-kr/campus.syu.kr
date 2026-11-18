import { defaultTreeAdapter, parse, type DefaultTreeAdapterTypes } from "parse5";
import { containsUispOrigin, redactUispOriginText } from "./uisp-origin.mjs";

const UNIVERSITY_ORIGIN = "https://www.syu.ac.kr";
const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
const MAX_HTML_LENGTH = 512 * 1024;
const MAX_NODES = 12_000;
const MAX_DEPTH = 32;
const MAX_TEXT_LENGTH = 64 * 1024;
const MAX_IMAGES = 16;
const MAX_ATTACHMENTS = 24;
const OMIT_TAGS = new Set([
  "head", "script", "style", "noscript", "template", "iframe", "object", "embed",
  "form", "input", "button", "select", "textarea", "video", "audio", "source",
]);
const CONTENT_TAGS = [
  "p", "div", "br", "ul", "ol", "li", "strong", "em", "blockquote",
  "h2", "h3", "h4", "table", "tbody", "thead", "tr", "td", "th",
] as const;
const contentTags = new Set<string>(CONTENT_TAGS);

type ContentTag = typeof CONTENT_TAGS[number];
type Element = DefaultTreeAdapterTypes.Element;
type ChildNode = DefaultTreeAdapterTypes.ChildNode;
type ParentNode = DefaultTreeAdapterTypes.Document | Element;

export type UispContentNode =
  | { type: "text"; text: string }
  | { type: "element"; tag: ContentTag; children: UispContentNode[] }
  | { type: "link"; href: string; children: UispContentNode[] }
  | { type: "image"; src: string; alt: string };

export interface UispNotice {
  content: UispContentNode[];
  attachments: { index: string; name: string }[];
  images: string[];
}

function attribute(element: Element, name: string) {
  return element.attrs.find((item) => item.name === name && !item.namespace)?.value;
}

function isVisibleElement(element: Element) {
  return element.namespaceURI === HTML_NAMESPACE && !OMIT_TAGS.has(element.tagName) &&
    attribute(element, "hidden") === undefined;
}

function* walk(root: ParentNode) {
  const pending = [...root.childNodes].reverse();
  for (let visited = 0; pending.length && visited < MAX_NODES; visited++) {
    const node = pending.pop()!;
    if (defaultTreeAdapter.isElementNode(node)) {
      if (!isVisibleElement(node)) continue;
      for (let i = node.childNodes.length - 1; i >= 0; i--) pending.push(node.childNodes[i]);
    }
    yield node;
  }
}

function safeUrl(value: string | undefined, base?: string) {
  if (!value || value.length > 2048) return null;
  try {
    const url = new URL(value, base);
    return url.username || url.password || url.port ? null : url;
  } catch {
    return null;
  }
}

function safeImageUrl(value: string | undefined, board: URL) {
  const url = safeUrl(value, board.origin);
  if (!url || url.search || url.hash || url.pathname.length > 512) return null;
  const prefix = url.origin === board.origin ? "/data/editor/"
    : url.origin === UNIVERSITY_ORIGIN ? "/wp-content/uploads/" : null;
  if (!prefix || !url.pathname.startsWith(prefix)) return null;
  try {
    const parts = url.pathname.slice(prefix.length).split("/").map(decodeURIComponent);
    if (parts.some((part) => !/^[\p{L}\p{M}\p{N}_. ()+-]+$/u.test(part) || part === "." || part === "..")) return null;
    if (!/\.(jpe?g|png|gif|webp)$/i.test(parts.at(-1) ?? "")) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function isUispImageUrl(value: string, board: URL) {
  return safeImageUrl(value, board) === value;
}

function fileName(anchor: Element, index: string, redact: (value: string) => string) {
  let value = "";
  for (const node of walk(anchor)) {
    if (defaultTreeAdapter.isTextNode(node)) value += node.value;
    if (value.length >= 512) break;
  }
  const suffix = value.trim().match(/\.[a-z0-9]{1,12}$/i)?.[0] ?? "";
  let normalized = redact(value).replace(/[\p{Cc}\p{Cf}/\\]/gu, " ").replace(/\s+/g, " ").trim();
  if (!normalized) normalized = `attachment-${index}`;
  if (suffix && !normalized.endsWith(suffix)) normalized += suffix;
  const characters = Array.from(normalized);
  if (characters.length <= 160) return normalized;
  return characters.slice(0, 160 - suffix.length).join("") + suffix;
}

function readAttachments(root: Element | undefined, postId: string, board: URL, redact: (value: string) => string) {
  const attachments: UispNotice["attachments"] = [];
  if (!root) return attachments;
  const seen = new Set<string>();
  for (const node of walk(root)) {
    if (!defaultTreeAdapter.isElementNode(node) || node.tagName !== "a") continue;
    const url = safeUrl(attribute(node, "href"), `${board.origin}/bbs/`);
    if (!url || url.origin !== board.origin || url.pathname !== "/bbs/download.php" || url.hash ||
        [...url.searchParams.keys()].length !== 3 ||
        url.searchParams.get("bo_table") !== "notice" || url.searchParams.get("wr_id") !== postId) continue;
    const index = url.searchParams.get("no");
    if (!index || !/^(0|[1-9]\d{0,2})$/.test(index) || seen.has(index)) continue;
    seen.add(index);
    attachments.push({ index, name: fileName(node, index, redact) });
    if (attachments.length === MAX_ATTACHMENTS) break;
  }
  return attachments;
}

function readContent(root: Element, postId: string, board: URL, redact: (value: string) => string) {
  const images: string[] = [];
  let visibleText = "";
  let remainingNodes = MAX_NODES;
  let remainingText = MAX_TEXT_LENGTH;

  function read(nodes: ChildNode[], depth: number): UispContentNode[] {
    const content: UispContentNode[] = [];
    if (depth >= MAX_DEPTH) return content;
    for (const node of nodes) {
      if (--remainingNodes < 0) break;
      if (defaultTreeAdapter.isTextNode(node)) {
        const text = redact(node.value).replace(/\s+/g, " ").slice(0, remainingText);
        remainingText -= text.length;
        if (text) {
          visibleText += text;
          content.push({ type: "text", text });
        }
        continue;
      }
      if (!defaultTreeAdapter.isElementNode(node) || !isVisibleElement(node)) continue;
      if (node.tagName === "img") {
        const url = safeImageUrl(attribute(node, "src"), board);
        if (!url) continue;
        let index = images.indexOf(url);
        if (index < 0 && images.length < MAX_IMAGES) {
          index = images.push(url) - 1;
        }
        if (index >= 0) content.push({
          type: "image",
          src: `/api/uisp-assets/uisp-${postId}/image/${index}`,
          alt: redact(attribute(node, "alt") ?? "").slice(0, 240),
        });
        continue;
      }

      const children = read(node.childNodes, depth + 1);
      if (node.tagName === "a") {
        const url = safeUrl(attribute(node, "href"));
        if (url?.protocol === "https:" && !containsUispOrigin(url.href, board.hostname) && children.length) {
          content.push({ type: "link", href: url.href, children });
        } else {
          content.push(...children);
        }
        continue;
      }
      const tag = node.tagName === "b" ? "strong" : node.tagName === "i" ? "em"
        : node.tagName === "h1" ? "h2" : node.tagName;
      if (contentTags.has(tag)) content.push({ type: "element", tag: tag as ContentTag, children });
      else content.push(...children);
    }
    return content;
  }

  const content = read(root.childNodes, 0);
  // A source hostname split across adjacent HTML nodes must not survive in rendered text.
  return { content: containsUispOrigin(visibleText, board.hostname) ? [] : content, images };
}

export function parseUispNotice(html: string, postId: string, board: URL): UispNotice | null {
  if (!/^[1-9]\d{0,8}$/.test(postId) || html.length > MAX_HTML_LENGTH) return null;
  const document = parse(html);
  let body: Element | undefined;
  let files: Element | undefined;
  for (const node of walk(document)) {
    if (!defaultTreeAdapter.isElementNode(node)) continue;
    const id = attribute(node, "id");
    if (id === "bo_v_con") body ??= node;
    if (id === "bo_v_file") files ??= node;
    if (body && files) break;
  }
  if (!body) return null;
  const redact = (value: string) => redactUispOriginText(value, board.hostname);
  return { ...readContent(body, postId, board, redact), attachments: readAttachments(files, postId, board, redact) };
}
