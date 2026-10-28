/**
 * /bk-encb-light CTA — back-redirect product for exit-encb.
 * Checkout: 5ef0a8d9… Thank-you: /up1bk-encb · /up2bk-encb · /up3bk-encb
 */
(function (w) {
  var CHECKOUT =
    "https://checkout.vendepay.com.br/c/4e2adae6-1c20-418f-a3cc-9a3a9a6c9c14";

  w.BK_ENCB_VP = {
    TEST_ID: "bk_encb_vp_off",
    arm: "default",
    checkout: CHECKOUT,
  };

  function buildCheckoutHref() {
    var url = new URL(CHECKOUT);
    // Forward every query param as received (no skip / clean)
    try {
      new URLSearchParams(w.location.search || "").forEach(function (v, k) {
        url.searchParams.set(k, v);
      });
    } catch (e) {}
    try {
      if (w.htUtms && typeof w.htUtms === "object") {
        Object.keys(w.htUtms).forEach(function (k) {
          if (url.searchParams.has(k)) return;
          var v = w.htUtms[k];
          if (v != null && v !== "") url.searchParams.set(k, String(v));
        });
      }
    } catch (e2) {}
    // DigiAttr: fill missing tracking keys only — never strip or replace
    try {
      if (w.DigiAttr) {
        if (DigiAttr.captureFromUrl) DigiAttr.captureFromUrl();
        if (DigiAttr.syncFromYt) DigiAttr.syncFromYt();
        (DigiAttr.KEYS || [
          "ttclid",
          "utm_source",
          "utm_medium",
          "utm_campaign",
          "utm_content",
          "utm_term",
          "fbclid",
          "gclid",
        ]).forEach(function (k) {
          if (url.searchParams.has(k)) return;
          var v = DigiAttr.get ? DigiAttr.get(k) : "";
          if (v) url.searchParams.set(k, String(v));
        });
      }
    } catch (e3) {}
    return url.toString();
  }

  function apply() {
    var a = document.getElementById("redirectButton");
    if (!a) return;
    a.href = buildCheckoutHref();
  }

  function bindClick() {
    var a = document.getElementById("redirectButton");
    if (!a || a.__bkEncbBound) return;
    a.__bkEncbBound = true;
    a.addEventListener(
      "click",
      function () {
        a.href = buildCheckoutHref();
      },
      true
    );
  }

  function boot() {
    apply();
    bindClick();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
  setTimeout(apply, 0);
  setTimeout(apply, 50);
})(window);
