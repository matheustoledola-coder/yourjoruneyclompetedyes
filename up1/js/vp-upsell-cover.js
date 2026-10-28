/**
 * Places overlay-branco-up1.png over the VendePay iframe after upsell.js
 * mounts it in #vendepay-upsell. Cover height stops above the original
 * "Carregar oferta" / "Continuar sem esta oferta" controls.
 */
(function () {
  var ORIGIN = "https://checkout.vendepay.com.br";

  function init() {
    var wrap =
      document.getElementById("vendepay-upsell-wrap") ||
      document.querySelector("[data-vp-upsell-wrap]");
    var container = document.getElementById("vendepay-upsell");
    var cover = document.getElementById("vp-upsell-cover");
    if (!wrap || !container || !cover) return;

    var iframe = null;
    var resizeObserver = null;
    var attrObserver = null;

    function frameWidth() {
      var width = iframe && iframe.offsetWidth ? iframe.offsetWidth : wrap.offsetWidth;
      return width || window.innerWidth;
    }

    /* Bottom band left clear for CTA + decline link + card padding.
       Kept taller so the white mask ends above the primary button. */
    function buttonBand() {
      return frameWidth() <= 420 ? 158 : 148;
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

      var clear = buttonBand();
      if (clear > total) clear = total;
      var coverH = Math.max(0, total - clear);

      wrap.style.setProperty("--vp-cover-h", coverH + "px");
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
