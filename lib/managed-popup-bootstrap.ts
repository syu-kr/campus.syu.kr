// Runs beside the closed SSR dialog, before the client bundle is ready.
export const MANAGED_POPUP_BOOTSTRAP = `(function () {
  var script = document.currentScript;
  var dialog = script && script.previousElementSibling;
  if (!dialog || !dialog.matches('dialog[data-managed-popup]') || typeof dialog.showModal !== 'function' || dialog.dataset.hydrated === 'true') return;
  if (/^\\/(?:en\\/)?(?:admin(?:\\/|$)|campus\\/roommates(?:\\/|$)|more\\/meet\\/[^/]+(?:\\/|$))/.test(location.pathname)) return;
  var key = dialog.dataset.managedPopup;
  var starts = dialog.dataset.startsAt ? Number(dialog.dataset.startsAt) : -Infinity;
  var ends = dialog.dataset.endsAt ? Number(dialog.dataset.endsAt) : Infinity;
  if (!key || Number.isNaN(starts) || Number.isNaN(ends)) return;
  var stopped = false;
  var timer;
  var observer;
  function cleanup() {
    if (stopped) return;
    stopped = true;
    clearTimeout(timer);
    if (observer) observer.disconnect();
    document.removeEventListener('DOMContentLoaded', check);
    document.removeEventListener('visibilitychange', check);
    document.removeEventListener('click', click, true);
    document.removeEventListener('keydown', keydown, true);
    dialog.removeEventListener('cancel', cancel);
  }
  dialog.__campusPopupCleanup = cleanup;
  function owned() {
    if (stopped) return false;
    if (!dialog.isConnected || dialog.dataset.hydrated === 'true') { cleanup(); return false; }
    return true;
  }
  function hiddenUntil(now) {
    if (dialog.dataset.dismissedUntil === 'closed') return Infinity;
    var until = Number(dialog.dataset.dismissedUntil) || 0;
    try { until = Math.max(until, Number(localStorage.getItem(key)) || 0); } catch {}
    try { if (sessionStorage.getItem(key) === 'closed') return Infinity; } catch {}
    if (until <= now) delete dialog.dataset.dismissedUntil;
    return until;
  }
  function close() { if (dialog.open) dialog.close(); }
  function dismiss(today) {
    var until = 'closed';
    if (today) {
      var korea = new Date(Date.now() + 9 * 60 * 60 * 1000);
      until = String(Date.UTC(korea.getUTCFullYear(), korea.getUTCMonth(), korea.getUTCDate() + 1) - 9 * 60 * 60 * 1000);
    }
    dialog.dataset.dismissedUntil = until;
    try { if (today) localStorage.setItem(key, until); else sessionStorage.setItem(key, 'closed'); } catch {}
    close();
    check();
  }
  function click(event) {
    if (!owned() || !dialog.open) return;
    var target = event.target;
    if (!target || typeof target.closest !== 'function') return;
    var action = target.closest('[data-popup-action]');
    if (action && dialog.contains(action) && /^(today|close)$/.test(action.dataset.popupAction)) {
      // Keep the native link default while preventing a second React replay.
      event.stopImmediatePropagation();
      dismiss(action.dataset.popupAction === 'today');
    } else if (target === dialog) {
      event.stopImmediatePropagation();
      dismiss(false);
    }
  }
  function keydown(event) {
    if (!owned() || !dialog.open || event.key !== 'Tab' || event.defaultPrevented) return;
    var controls = Array.from(dialog.querySelectorAll('a[href], button:not([disabled])')).filter(function (control) {
      return control.getAttribute('aria-hidden') !== 'true' && control.getClientRects().length > 0;
    });
    var first = controls[0], last = controls[controls.length - 1];
    var target = !dialog.contains(document.activeElement) ? (event.shiftKey ? last : first)
      : event.shiftKey && document.activeElement === first ? last
      : !event.shiftKey && document.activeElement === last ? first : null;
    if (!controls.length || target) {
      event.preventDefault();
      event.stopImmediatePropagation();
      (target || dialog).focus({ preventScroll: true });
    }
  }
  function cancel(event) {
    if (!owned()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    dismiss(false);
  }
  function otherDialogOpen() {
    return Array.from(document.querySelectorAll('[role="dialog"][aria-modal="true"], dialog[open]')).some(function (node) {
      return node !== dialog && !node.closest('[hidden], [aria-hidden="true"]') && !(node.tagName === 'DIALOG' && !node.open);
    });
  }
  function check() {
    if (!owned()) return;
    if (document.readyState === 'loading' && !document.querySelector('[data-managed-popup-shell-ready]')) return;
    clearTimeout(timer);
    var now = Date.now();
    var until = hiddenUntil(now);
    var next = Math.min.apply(Math, [starts, ends, until].filter(function (time) { return time > now; }));
    if (Number.isFinite(next)) timer = setTimeout(check, Math.min(2147000000, next - now + 10));
    if (now < starts || now >= ends || until > now) { close(); return; }
    if (otherDialogOpen()) { close(); return; }
    if (dialog.open) return;
    // No image request is made for a dismissed or deferred popup.
    dialog.querySelectorAll('source[data-srcset]').forEach(function (source) {
      source.setAttribute('srcset', source.dataset.srcset);
    });
    dialog.querySelectorAll('img[data-src]').forEach(function (image) {
      image.setAttribute('src', image.dataset.src);
    });
    try {
      dialog.showModal();
      var closeButton = dialog.querySelector('button[data-popup-action="close"]');
      if (closeButton) closeButton.focus({ preventScroll: true });
    } catch { /* The hydrated component can retry if the document is not active. */ }
  }
  document.addEventListener('click', click, true);
  document.addEventListener('keydown', keydown, true);
  dialog.addEventListener('cancel', cancel);
  document.addEventListener('visibilitychange', check);
  observer = new MutationObserver(function () {
    if (owned()) check();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['role', 'aria-modal', 'aria-hidden', 'hidden', 'open', 'data-hydrated'] });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', check, { once: true });
  check();
})();`;

