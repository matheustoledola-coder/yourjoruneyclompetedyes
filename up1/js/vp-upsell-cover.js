/**
 * Fits an opaque mask over the VendePay upsell iframe after upsell.js mounts it
 * in #vendepay-upsell. Button pixels stay outside the mask so the original
 * controls keep their own click handlers. Cross-origin iframe contents are
 * never read or rewritten.
 */
(function () {
  var OFFER_MIN_HEIGHT = 470;
  var ORIGIN = "https://checkout.vendepay.com.br";

  function init() {
    var wrap = document.getElementById("vendepay-upsell-wrap");
    var container = document.getElementById("vendepay-upsell");
    var topCover = document.getElementById("vp-upsell-cover");
    var bottomCover = document.getElementById("vp-upsell-cover-bottom");
    if (!wrap || !container || !topCover || !bottomCover) return;

    var iframe = null;
    var resizeObserver = null;
    var attrObserver = null;

    function frameWidth() {
      var width = iframe && iframe.offsetWidth ? iframe.offsetWidth : wrap.offsetWidth;
      return width || window.innerWidth;
    }

    function buttonBand() {
      var narrow = frameWidth() <= 420;
      /* CTA + decline link + card padding under them. Short enough that title /
         description above the controls stay under the mask. */
      return narrow ? 120 : 112;
    }

    function trustBand(total) {
      if (total < OFFER_MIN_HEIGHT) return 0;
      return frameWidth() <= 480 ? 104 : 72;
    }

    function watchIframe() {
      if (typeof ResizeObserver === "function") {
        if (resizeObserver) resizeObserver.disconnect();
        resizeObserver = new ResizeObserver(sync);
        resizeObserver.observe(iframe);
      }
      if (attrObserver) attrObserver.disconnect();
      attrObserver = new MutationObserver(sync);
      attrObserver.observe(iframe, {
        attributes: true,
        attributeFilter: ["style"],
      });
    }

    function sync() {
      var next = container.querySelector("iframe");
      if (!next) return;
      if (next !== iframe) {
        iframe = next;
        watchIframe();
      }

      var total = iframe.offsetHeight;
      if (total < 24) {
        wrap.classList.remove("vp-cover-ready");
        return;
      }

      var actions = buttonBand();
      var bottom = trustBand(total);
      if (actions + bottom > total) {
        bottom = Math.max(0, total - actions);
        if (actions > total) {
          actions = total;
          bottom = 0;
        }
      }

      wrap.style.setProperty("--vp-actions-h", actions + "px");
      wrap.style.setProperty("--vp-bottom-h", bottom + "px");
      wrap.classList.add("vp-cover-ready");
    }

    var mountObserver = new MutationObserver(sync);
    mountObserver.observe(container, { childList: true });

    window.addEventListener("resize", sync);
    window.addEventListener("message", function (event) {
      if (event.origin !== ORIGIN) return;
      if (!event.data || typeof event.data !== "object") return;
      if (
        event.data.type === "vp-upsell-height" ||
        event.data.type === "vp-upsell-ready"
      ) {
        sync();
      }
    });

    sync();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
