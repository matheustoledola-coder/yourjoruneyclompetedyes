/**
 * Verified Campaign — sticky 50/50 A/B: VSL vs control (no VSL).
 *
 * Arms: "vsl" | "control"
 * Query: vsl_ab=1 (vsl) | vsl_ab=0 (control) — additive only; never strips other params.
 * Force: ?vsl_ab=1|0|vsl|control
 */
(function (w) {
  var STORAGE_KEY = "verified_vsl_ab_v1";
  var TEST_ID = "verified_vsl_v1";
  var PARAM = "vsl_ab";

  function params() {
    try {
      return new URLSearchParams(w.location.search || "");
    } catch (e) {
      return new URLSearchParams();
    }
  }

  function readForce(p) {
    var raw = String(p.get(PARAM) || p.get("vsl") || "").toLowerCase().trim();
    if (raw === "1" || raw === "vsl" || raw === "yes" || raw === "true") return "vsl";
    if (raw === "0" || raw === "control" || raw === "no" || raw === "false") return "control";
    return "";
  }

  function assignArm() {
    var p = params();
    var force = readForce(p);
    if (force) {
      try {
        localStorage.setItem(STORAGE_KEY, force);
      } catch (e) {}
      return force;
    }
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "vsl" || stored === "control") return stored;
    } catch (e2) {}
    var arm = Math.random() < 0.5 ? "vsl" : "control";
    try {
      localStorage.setItem(STORAGE_KEY, arm);
    } catch (e3) {}
    return arm;
  }

  function paramValue(arm) {
    return arm === "vsl" ? "1" : "0";
  }

  /** Additive: set/overwrite only vsl_ab + vsl_test on current URL (keeps everything else). */
  function syncUrl(arm) {
    try {
      var url = new URL(w.location.href);
      url.searchParams.set(PARAM, paramValue(arm));
      url.searchParams.set("vsl_test", TEST_ID);
      w.history.replaceState(null, "", url.pathname + url.search + url.hash);
    } catch (e) {}
  }

  /** After copying all location.search into checkout URL, ensure vsl_ab is present. */
  function appendToCheckoutUrl(url) {
    try {
      var arm = getArm();
      url.searchParams.set(PARAM, paramValue(arm));
      url.searchParams.set("vsl_test", TEST_ID);
    } catch (e) {}
    return url;
  }

  var _arm = null;
  function getArm() {
    if (_arm !== "vsl" && _arm !== "control") _arm = assignArm();
    return _arm;
  }

  function isVsl() {
    return getArm() === "vsl";
  }

  function contentIdSuffix() {
    return isVsl() ? "vsl" : "control";
  }

  w.VSL_AB = {
    STORAGE_KEY: STORAGE_KEY,
    TEST_ID: TEST_ID,
    PARAM: PARAM,
    assignArm: assignArm,
    getArm: getArm,
    isVsl: isVsl,
    paramValue: paramValue,
    syncUrl: syncUrl,
    appendToCheckoutUrl: appendToCheckoutUrl,
    contentIdSuffix: contentIdSuffix,
  };

  // Assign ASAP so later scripts / goToCheckout see a stable arm
  _arm = assignArm();
  syncUrl(_arm);
})(window);
