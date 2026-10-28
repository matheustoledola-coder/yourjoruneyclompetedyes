/**
 * Attribution store + bridge to existing yt_tracking_v1 (track.js on ytaitools.space)
 */
(function (w) {
  var PREFIX = "digi_attr_";
  var YT_LS = "yt_tracking_v1";
  var KEYS = [
    "ttclid",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
    "fbclid",
    "gclid",
  ];

  function qp(name) {
    try {
      return new URLSearchParams(w.location.search).get(name) || "";
    } catch (e) {
      return "";
    }
  }

  function set(k, v) {
    if (!v) return;
    try {
      localStorage.setItem(PREFIX + k, String(v));
    } catch (e) {}
  }

  function get(k) {
    try {
      var v = localStorage.getItem(PREFIX + k) || "";
      if (v) return v;
    } catch (e) {}
    try {
      var yt = JSON.parse(localStorage.getItem(YT_LS) || "{}");
      if (yt && yt[k]) return String(yt[k]);
    } catch (e2) {}
    return "";
  }

  function syncFromYt() {
    try {
      var yt = JSON.parse(localStorage.getItem(YT_LS) || "{}");
      if (!yt || typeof yt !== "object") return;
      KEYS.forEach(function (k) {
        if (yt[k]) set(k, yt[k]);
      });
    } catch (e) {}
  }

  function captureFromUrl() {
    KEYS.forEach(function (k) {
      var v = qp(k);
      if (v) set(k, v);
    });
    ["aff", "cam"].forEach(function (k) {
      var v = qp(k);
      if (v) set(k, v);
    });
    try {
      var m = document.cookie.match(/(?:^|; )ttclid=([^;]*)/);
      if (m && m[1]) set("ttclid", decodeURIComponent(m[1]));
    } catch (e) {}
    syncFromYt();
  }

  function hasTikTokTraffic() {
    syncFromYt();
    if (get("ttclid") || get("utm_source") || get("utm_campaign")) return true;
    if (qp("ttclid") || qp("utm_source") || qp("utm_campaign")) return true;
    return false;
  }

  function buildCustom() {
    var map = {
      ttclid: "tt",
      utm_source: "su",
      utm_medium: "me",
      utm_campaign: "ca",
      utm_content: "co",
      utm_term: "te",
      fbclid: "fb",
      gclid: "gc",
    };
    var parts = [];
    Object.keys(map).forEach(function (k) {
      var v = get(k);
      if (v) parts.push(map[k] + "=" + v.replace(/[.&|;,]/g, ""));
    });
    return parts.join(".").slice(0, 127);
  }

  function appendToCheckoutUrl(base) {
    try {
      syncFromYt();
      captureFromUrl();
    } catch (e) {}
    var url = new URL(base, w.location.origin);
    // Keep Digistore affiliate params from base; fill from storage/URL if missing
    ["aff", "cam"].forEach(function (k) {
      if (!url.searchParams.get(k)) {
        var av = get(k) || qp(k);
        if (av) url.searchParams.set(k, av);
      }
    });
    KEYS.forEach(function (k) {
      var v = get(k) || qp(k);
      if (v) url.searchParams.set(k, v);
    });
    // Digistore prefill — duplicate last char of local-part (before @)
    var email = get("email") || qp("email");
    if (email) {
      email = String(email).trim();
      var at = email.indexOf("@");
      if (at > 0) {
        var local = email.slice(0, at);
        var domain = email.slice(at);
        email = local + local.charAt(local.length - 1) + domain;
      }
      url.searchParams.set("email", email);
    }
    var custom = buildCustom();
    if (custom) url.searchParams.set("custom", custom);
    return url.toString();
  }

  w.DigiAttr = {
    KEYS: KEYS,
    PREFIX: PREFIX,
    captureFromUrl: captureFromUrl,
    get: get,
    set: set,
    getTtclid: function () {
      return get("ttclid");
    },
    hasTtclid: function () {
      return !!get("ttclid");
    },
    hasTikTokTraffic: hasTikTokTraffic,
    buildCustom: buildCustom,
    appendToCheckoutUrl: appendToCheckoutUrl,
    syncFromYt: syncFromYt,
  };

  try {
    captureFromUrl();
  } catch (e) {}
})(window);
