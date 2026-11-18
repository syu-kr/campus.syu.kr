export function getUispBoardUrl() {
  const value = process.env.UISP_NOTICE_BOARD_URL?.trim();
  // Check the raw authority so an explicit default port is rejected too.
  if (!value || !/^https?:\/\/[a-zA-Z0-9.-]+\/bbs\/board\.php\?bo_table=notice$/.test(value)) return null;
  try {
    const url = new URL(value);
    return /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z][a-z0-9-]*[a-z0-9]$/.test(url.hostname) ? url : null;
  } catch {
    return null;
  }
}

/**
 * @param {string} postId
 * @param {URL | null} [boardUrl]
 */
export function getUispNoticeUrl(postId, boardUrl = getUispBoardUrl()) {
  if (!boardUrl || !/^[1-9][0-9]{0,8}$/.test(postId)) return null;
  const url = new URL(boardUrl);
  url.searchParams.set("wr_id", postId);
  return url;
}

/**
 * @param {string} value
 * @param {string} hostname
 */
export function containsUispOrigin(value, hostname) {
  /** @param {string} text */
  const decode = (text) => text.replace(/%([0-9a-f]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  return Boolean(hostname) && decode(decode(value)).toLowerCase().includes(hostname.toLowerCase());
}

/**
 * @param {string} value
 * @param {string} hostname
 */
export function redactUispOriginText(value, hostname) {
  if (!containsUispOrigin(value, hostname)) return value;
  const escapedHost = hostname.replaceAll(".", "\\.");
  const reference = new RegExp(`(?:https?:\\/\\/|\\/\\/)?${escapedHost}\\.?(?::[0-9]+)?(?:[/?#][^\\s<>"']*)?`, "gi");
  const result = value.replace(reference, "");
  return containsUispOrigin(result, hostname) ? "" : result;
}
