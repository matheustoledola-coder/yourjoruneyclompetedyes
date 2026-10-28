/**
 * Shows .vp-green-cover after Vendepay injects its iframe into #vendepay-upsell-container.
 * Expects wrap #vendepay-upsell-wrap (or [data-vp-upsell-wrap]).
 */
(function () {
  function init() {
    var wrap =
      document.getElementById("vendepay-upsell-wrap") ||
      document.querySelector("[data-vp-upsell-wrap]");
    var container = document.getElementById("vendepay-upsell-container");
    if (!wrap || !container) return;

    function syncCover() {
      if (!container.querySelector("iframe")) return;
      wrap.classList.add("vp-cover-ready");
    }

    var mo = new MutationObserver(syncCover);
    mo.observe(container, { childList: true, subtree: true });
    if (typeof ResizeObserver !== "undefined") {
      new ResizeObserver(syncCover).observe(container);
    }
    syncCover();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
