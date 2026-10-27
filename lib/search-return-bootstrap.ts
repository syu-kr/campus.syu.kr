// Ready server-rendered links can be clicked before React registers effects.
export const SEARCH_RETURN_BOOTSTRAP = `(function () {
  document.addEventListener('click', function (event) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    var current = new URL(window.location.href);
    if (!/^\\/(?:en\\/?)?$/.test(current.pathname) || !current.searchParams.get('search')?.trim()) return;
    var target = event.target;
    var anchor = target && typeof target.closest === 'function' ? target.closest('main a[href]') : null;
    if (!anchor || anchor.target || anchor.hasAttribute('download')) return;
    var destination = new URL(anchor.href, current);
    if (destination.origin !== current.origin || destination.pathname === current.pathname) return;
    try {
      window.sessionStorage.setItem('syu-campus-search-return', JSON.stringify({
        url: current.pathname + current.search,
        scrollY: window.scrollY,
        result: destination.pathname + destination.search + destination.hash
      }));
    } catch {}
  }, true);
})();`;
