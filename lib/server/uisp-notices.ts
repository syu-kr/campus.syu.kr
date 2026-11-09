import { readResponseBytes } from "./read-response-bytes";
import { isUispImageUrl, parseUispNotice, type UispNotice } from "./uisp-notice-parser";
import { getUispBoardUrl, getUispNoticeUrl } from "./uisp-origin.mjs";

const MAX_NOTICE_BYTES = 1024 * 1024;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_ATTACHMENT_BYTES = 32 * 1024 * 1024;
const ATTACHMENT_EXTENSION = /\.(?:pdf|hwp|hwpx|docx?|xlsx?|pptx?|odt|ods|odp|rtf|txt|csv|zip|7z|alz|egg|jpe?g|png|gif|webp|bmp|mp4|m4a|mp3|wav|mov|avi)$/i;

export function getUispPostId(id: string): string | undefined {
  return /^uisp-([1-9][0-9]{0,8})$/.exec(id)?.[1];
}

function fetchOrigin(url: string, signal: AbortSignal, headers: HeadersInit) {
  return fetch(url, { cache: "no-store", redirect: "error", signal, headers });
}

async function readOriginNotice(postId: string, board: URL, signal?: AbortSignal) {
  const postUrl = getUispNoticeUrl(postId, board);
  if (!postUrl) return null;
  const timeout = AbortSignal.timeout(4_000);
  const response = await fetchOrigin(
    postUrl.href,
    signal ? AbortSignal.any([signal, timeout]) : timeout,
    { Accept: "text/html" },
  );
  if (response.status === 404) {
    await response.body?.cancel().catch(() => {});
    return null;
  }
  if (response.status !== 200 || mimeType(response) !== "text/html" || declaredSize(response) > MAX_NOTICE_BYTES) {
    await response.body?.cancel().catch(() => {});
    throw new Error("Invalid UISP notice response");
  }

  const html = new TextDecoder().decode(await readResponseBytes(response, MAX_NOTICE_BYTES, "UISP notice"));
  const notice = parseUispNotice(html, postId, board);
  const cookie = response.headers.getSetCookie()
    .map((value) => /^(PHPSESSID=[a-zA-Z0-9,-]{1,128})(?:;|$)/.exec(value)?.[1])
    .find(Boolean);
  return notice ? { notice, cookie } : null;
}

export async function readUispNotice(id: string): Promise<Omit<UispNotice, "images"> | null> {
  const postId = getUispPostId(id);
  const board = getUispBoardUrl();
  if (!postId || !board) return null;
  try {
    const source = await readOriginNotice(postId, board);
    if (!source) return null;
    return {
      content: source.notice.content,
      attachments: source.notice.attachments.filter(({ name }) => ATTACHMENT_EXTENSION.test(name)),
    };
  } catch {
    return null;
  }
}

function mimeType(response: Response): string {
  return response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ?? "";
}

function declaredSize(response: Response): number {
  return Number(response.headers.get("content-length") ?? 0);
}

function rasterMatches(type: string, bytes: Uint8Array): boolean {
  switch (type) {
    case "image/jpeg":
      return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    case "image/png":
      return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => bytes[index] === byte);
    case "image/gif":
      return /^GIF8[79]a$/.test(Buffer.from(bytes.subarray(0, 6)).toString("ascii"));
    case "image/webp":
      return Buffer.from(bytes.subarray(0, 4)).toString("ascii") === "RIFF" &&
        Buffer.from(bytes.subarray(8, 12)).toString("ascii") === "WEBP";
    default:
      return false;
  }
}

function contentDisposition(name: string, extension: string): string {
  const stem = Array.from(name.slice(0, -extension.length).replace(/[<>:"/\\|?*\p{Cc}\p{Cf}]/gu, "_").trim())
    .slice(0, 175).join("").replace(/[. ]+$/, "") || "attachment";
  const safeName = stem + extension;
  const encoded = encodeURIComponent(Buffer.from(safeName).toString()).replace(/['()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="attachment${extension}"; filename*=UTF-8''${encoded}`;
}

function streamAttachment(response: Response) {
  if (!response.body) throw new Error("Missing UISP attachment body");
  let received = 0;
  const expected = response.headers.has("content-encoding") ? 0 : declaredSize(response);
  return response.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      received += chunk.byteLength;
      if (received > MAX_ATTACHMENT_BYTES || (expected > 0 && received > expected)) {
        throw new Error("UISP attachment exceeded its size limit");
      }
      controller.enqueue(chunk);
    },
    flush() {
      if (received === 0 || (expected > 0 && received !== expected)) {
        throw new Error("Incomplete UISP attachment");
      }
    },
  }));
}

const ASSET_HEADERS = {
  "Cache-Control": "no-store",
  "Content-Security-Policy": "sandbox; default-src 'none'",
  "Cross-Origin-Resource-Policy": "same-origin",
  "X-Content-Type-Options": "nosniff",
};

export async function readUispAsset(postId: string, kind: "image" | "attachment", index: string, signal: AbortSignal): Promise<Response | null> {
  const board = getUispBoardUrl();
  if (!board) return null;
  const source = await readOriginNotice(postId, board, signal);
  if (!source) return null;

  if (kind === "image") {
    const url = source.notice.images[Number(index)];
    if (!url || !isUispImageUrl(url, board)) return null;
    const response = await fetchOrigin(url, AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
      { Accept: "image/jpeg,image/png,image/gif,image/webp" });
    const type = mimeType(response);
    if (response.status !== 200 || !["image/jpeg", "image/png", "image/gif", "image/webp"].includes(type)) {
      await response.body?.cancel().catch(() => {});
      throw new Error("Invalid UISP image response");
    }
    if (declaredSize(response) > MAX_IMAGE_BYTES) {
      await response.body?.cancel().catch(() => {});
      return new Response(null, { status: 413, headers: ASSET_HEADERS });
    }
    const bytes = await readResponseBytes(response, MAX_IMAGE_BYTES, "UISP image");
    if (!rasterMatches(type, bytes)) throw new Error("Invalid UISP image bytes");
    return new Response(bytes, { headers: { ...ASSET_HEADERS, "Content-Type": type } });
  }

  const attachment = source.notice.attachments.find((item) => item.index === index);
  const extension = attachment && ATTACHMENT_EXTENSION.exec(attachment.name)?.[0];
  if (!attachment || !extension) return null;
  if (!source.cookie) throw new Error("Missing UISP download session");
  // GnuBoard checks that this public post was viewed by the same anonymous session.
  const response = await fetchOrigin(
    `${board.origin}/bbs/download.php?bo_table=notice&wr_id=${postId}&no=${index}`,
    AbortSignal.any([signal, AbortSignal.timeout(30_000)]),
    { Cookie: source.cookie, "Accept-Encoding": "identity" },
  );
  const type = mimeType(response);
  if (response.status !== 200 || !type || /^(?:text\/html|application\/xhtml\+xml|image\/svg\+xml)$/.test(type) ||
      !/^attachment(?:\s*;|$)/i.test(response.headers.get("content-disposition") ?? "")) {
    await response.body?.cancel().catch(() => {});
    throw new Error("Invalid UISP attachment response");
  }
  if (declaredSize(response) > MAX_ATTACHMENT_BYTES) {
    await response.body?.cancel().catch(() => {});
    return new Response(null, { status: 413, headers: ASSET_HEADERS });
  }
  return new Response(streamAttachment(response), { headers: {
    ...ASSET_HEADERS,
    "Content-Type": "application/octet-stream",
    "Content-Disposition": contentDisposition(attachment.name, extension),
  } });
}
