(function () {
  var ENDPOINT =
    "https://xxegeqbktxrdslqlipms.supabase.co/functions/v1/tiktok-capi";
  var ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4ZWdlcWJrdHhyZHNscWxpcG1zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4MzM0NzYsImV4cCI6MjEwMjQwOTQ3Nn0.pZY6MG9oi-EatHJCArS3aE0VPqsvxt-kRjUOsJt7JmA";

  // Will be overwritten at deploy with real anon key via inline boot — keep placeholder fallback only for local.
  try {
    if (window.__SS_TRACK_ANON) ANON = window.__SS_TRACK_ANON;
    if (window.__SS_TRACK_ENDPOINT) ENDPOINT = window.__SS_TRACK_ENDPOINT;
  } catch (e) {}

  function qp(name) {
    try {
      return new URLSearchParams(window.location.search).get(name) || "";
    } catch (e) {
      return "";
    }
  }

  function cookie(name) {
    try {
      var m = document.cookie.match(
        new RegExp("(?:^|; )" + name.replace(/([.$?*|{}()[\]\\/+^])/g, "\\$1") + "=([^;]*)")
      );
      return m ? decodeURIComponent(m[1]) : "";
    } catch (e) {
      return "";
    }
  }

  function eventId(prefix) {
    return (
      prefix +
      "-" +
      Date.now().toString(36) +
      "-" +
      Math.random().toString(36).slice(2, 10)
    );
  }

  /** Sticky arm — same key/logic as exit page goToCheckout (must not diverge). */
  function getOrAssignCheckoutArm() {
    var cfg = window.DIGI_GATE || {};
    var mode = cfg.exitMode || "digi";
    var path = "";
    try {
      path = (window.location.pathname || "").toLowerCase();
    } catch (e) {}

    // ADD: dedicated Commas / Vendepay paths win before mode short-circuit
    if (path.indexOf("exit-cms") >= 0) return "cms";
    if (path.indexOf("exit-en-vendepay") >= 0) return "vendepay";
    // /exit-encb e /onetest vao direto ao checkout da VendePay, sem captura de
    // e-mail. Sem esta linha o modo caia em "digi", que so dispara o
    // InitiateCheckout depois de um e-mail guardado -- que aqui nunca existe.
    if (path.indexOf("exit-encb") >= 0 || path.indexOf("/onetest") >= 0) return "vendepay";

    if (mode === "vendepay") {
      return "vendepay";
    }
    if (mode === "cms" || mode === "commas") return "cms";
    if (mode === "digi") {
      var digiPath = String(cfg.digiExitPath || "");
      if (digiPath.indexOf("exit-cms") >= 0) return "cms";
      return "digi";
    }

    if (mode === "split") {
      var key = cfg.checkoutSplitStorageKey || "exit_checkout_split_arm";
      var digiPathSplit = String(cfg.digiExitPath || cfg.cmsExitPath || "");
      var commasRemap = digiPathSplit.indexOf("exit-cms") >= 0;
      try {
        var stored = localStorage.getItem(key);
        if (stored === "vendepay") return "vendepay";
        if (stored === "cms") return "cms";
        // Legacy Digi-arm sticky → Commas when digiExitPath remapped
        if (stored === "digi") return commasRemap ? "cms" : "digi";
      } catch (e) {}
      var pct =
        typeof cfg.checkoutSplitDigiPercent === "number"
          ? cfg.checkoutSplitDigiPercent
          : 50;
      var commasArm = commasRemap ? "cms" : "digi";
      var arm = Math.random() * 100 < pct ? commasArm : "vendepay";
      try {
        localStorage.setItem(key, arm);
      } catch (e2) {}
      return arm;
    }

    return path.indexOf("exit-en-digi") >= 0 || path.indexOf("exit-eng") >= 0
      ? "digi"
      : "vendepay";
  }

  function checkoutLabels(arm) {
    if (arm === "cms") {
      return {
        content_id: "exit-cms-commas",
        content_name: "Commas Checkout Fee",
      };
    }
    if (arm === "digi") {
      var digiPath = String(
        (window.DIGI_GATE && DIGI_GATE.digiExitPath) || ""
      );
      if (digiPath.indexOf("exit-cms") >= 0) {
        return {
          content_id: "exit-cms-commas",
          content_name: "Commas Checkout Fee",
        };
      }
      return {
        content_id: "exit-en-digi",
        content_name: "Digistore Checkout Fee",
      };
    }
    return {
      content_id: "exit-en-vendepay",
      content_name: "Vendepay Checkout Fee",
    };
  }

  /** Verified VSL A/B suffix for exit-encb content_id (additive labeling). */
  function withVslAbLabel(labels) {
    try {
      if (!window.VSL_AB || !VSL_AB.contentIdSuffix) return labels;
      var path = "";
      try {
        path = (window.location.pathname || "").toLowerCase();
      } catch (e0) {}
      if (path.indexOf("exit-encb") < 0 && path.indexOf("/onetest") < 0) return labels;
      var suf = VSL_AB.contentIdSuffix();
      return {
        content_id: String(labels.content_id || "exit-encb-fee") + "-" + suf,
        content_name:
          String(labels.content_name || "Exit ENCB Fee") +
          (suf === "vsl" ? " (VSL)" : " (Control)"),
      };
    } catch (e) {
      return labels;
    }
  }

  /** ADD: local tally of Pay-fee clicks by content_id (Vendepay vs Commas). */
  function bumpArmClickTally(contentId) {
    try {
      var key = "exit_checkout_arm_clicks";
      var tally = {};
      try {
        tally = JSON.parse(localStorage.getItem(key) || "{}") || {};
      } catch (e0) {
        tally = {};
      }
      var id = String(contentId || "unknown");
      tally[id] = (Number(tally[id]) || 0) + 1;
      localStorage.setItem(key, JSON.stringify(tally));
      window.__ssArmClickTally = tally;
    } catch (e) {}
  }

  /** Same source Digi email capture uses (DigiAttr.set("email") / digi_attr_email). */
  function resolveCapturedEmail() {
    try {
      if (window.DigiAttr && typeof DigiAttr.get === "function") {
        var fromAttr = DigiAttr.get("email");
        if (fromAttr && String(fromAttr).trim()) return String(fromAttr).trim();
      }
    } catch (e) {}
    try {
      var ls = localStorage.getItem("digi_attr_email");
      if (ls && String(ls).trim()) return String(ls).trim();
    } catch (e2) {}
    try {
      var input = document.getElementById("checkout-email");
      if (input && input.value && String(input.value).trim()) {
        return String(input.value).trim();
      }
    } catch (e3) {}
    return "";
  }

  function sha256Hex(str) {
    if (!window.crypto || !crypto.subtle || typeof TextEncoder === "undefined") {
      return Promise.resolve("");
    }
    var data = new TextEncoder().encode(String(str).trim().toLowerCase());
    return crypto.subtle.digest("SHA-256", data).then(function (buf) {
      return Array.from(new Uint8Array(buf))
        .map(function (b) {
          return b.toString(16).padStart(2, "0");
        })
        .join("");
    });
  }

  function postCapi(payload) {
    try {
      fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + ANON,
          apikey: ANON,
        },
        body: JSON.stringify(payload),
        keepalive: true,
        mode: "cors",
      }).catch(function () {});
    } catch (e) {}
  }

  function track(event, extras) {
    extras = extras || {};
    var payload = {
      event: event,
      event_id: extras.event_id || eventId(event.toLowerCase()),
      url: extras.url || window.location.href,
      referrer: document.referrer || "",
      ttclid: (function () {
        try {
          if (window.DigiAttr) {
            if (DigiAttr.captureFromUrl) DigiAttr.captureFromUrl();
            if (DigiAttr.getTtclid) {
              var a = DigiAttr.getTtclid();
              if (a) return String(a);
            }
            if (DigiAttr.get) {
              var g = DigiAttr.get("ttclid");
              if (g) return String(g);
            }
          }
        } catch (e) {}
        try {
          var ls = localStorage.getItem("digi_attr_ttclid");
          if (ls) return String(ls);
        } catch (e2) {}
        return qp("ttclid") || cookie("ttclid") || null;
      })(),
      ttp: cookie("_ttp") || null,
      value: extras.value,
      currency: extras.currency || "USD",
      content_id: extras.content_id || "exit-encb-fee",
      content_name: extras.content_name || "TikTok Withdrawal Release Fee",
      content_type: extras.content_type || "product",
      user_agent: navigator.userAgent || "",
    };

    // Client pixel (dedupe via same event_id if present)
    try {
      if (window.ttq && typeof window.ttq.track === "function") {
        window.ttq.track(
          event,
          {
            contents: [
              {
                content_id: payload.content_id,
                content_type: payload.content_type,
                content_name: payload.content_name,
              },
            ],
            value: payload.value,
            currency: payload.currency,
          },
          { event_id: payload.event_id }
        );
      }
    } catch (e) {}

    // IC/API only: attach hashed email + external_id when already captured (never plaintext)
    var attachEmail =
      event === "InitiateCheckout" || event === "AddPaymentInfo";
    if (attachEmail) {
      var email = resolveCapturedEmail();
      if (email) {
        sha256Hex(email)
          .then(function (hash) {
            if (hash && hash.length === 64) {
              payload.user = { email: hash, external_id: hash };
            }
            postCapi(payload);
          })
          .catch(function () {
            postCapi(payload);
          });
        return payload.event_id;
      }
    }

    postCapi(payload);
    return payload.event_id;
  }

  // Dedupe: capture click + goToCheckout wrap can both fire on the same tap
  var lastCheckoutTrackAt = 0;
  function trackCheckoutClick() {
    var now = Date.now();
    if (now - lastCheckoutTrackAt < 900) return;
    var arm = getOrAssignCheckoutArm();
    // Digi: wait for email capture so IC/API can include hashed email (Purchase match)
    if (arm === "digi" && !resolveCapturedEmail()) return;
    lastCheckoutTrackAt = now;
    var labels = withVslAbLabel(checkoutLabels(arm));
    bumpArmClickTally(labels.content_id);
    track("InitiateCheckout", {
      value: 19.9,
      content_id: labels.content_id,
      content_name: labels.content_name,
    });
    track("AddPaymentInfo", {
      value: 19.9,
      content_id: labels.content_id,
      content_name: labels.content_name,
    });
  }

  window.__ssTrack = track;
  window.__ssCheckoutArm = getOrAssignCheckoutArm;
  window.__ssCheckoutLabels = checkoutLabels;
  window.__ssArmClickTally =
    (function () {
      try {
        return JSON.parse(localStorage.getItem("exit_checkout_arm_clicks") || "{}");
      } catch (e) {
        return {};
      }
    })();

  var pageContentId = "exit-encb";
  try {
    var p = (window.location.pathname || "").toLowerCase();
    if (p.indexOf("exit-en-digi") >= 0 || p.indexOf("exit-eng") >= 0) {
      pageContentId = "exit-en-digi";
    } else if (p.indexOf("exit-en-vendepay") >= 0) {
      pageContentId = "exit-en-vendepay";
    } else if (p.indexOf("exit-cms") >= 0) {
      pageContentId = "exit-cms-commas";
    }
  } catch (e) {}

  // Main events (kept): path PageView + product ViewContent
  // (Removido em 10/10/2026: aqui havia um page view mandado para o Supabase
  // do autor do template, com a URL completa de cada visitante, ttclid incluso.)

  track("PageView", { content_id: pageContentId, content_name: "Exit ENCB Page" });
  track("ViewContent", {
    value: 19.9,
    content_id: "exit-encb-fee",
    content_name: "TikTok Withdrawal Release Fee",
  });

  // ADD: also fire ViewContent with checkout-arm + VSL A/B labels
  (function () {
    var armLabels = withVslAbLabel(checkoutLabels(getOrAssignCheckoutArm()));
    if (armLabels.content_id && armLabels.content_id !== "exit-encb-fee") {
      track("ViewContent", {
        value: 19.9,
        content_id: armLabels.content_id,
        content_name: armLabels.content_name,
      });
    }
  })();

  // Watch Pay fee CTA only (#confirmation-button). Do NOT match
  // .confirmation-cta-button — email-capture-submit shares that class
  // and would double-count Digi InitiateCheckout vs Vendepay.
  document.addEventListener(
    "click",
    function (ev) {
      var el = ev.target && ev.target.closest
        ? ev.target.closest("#confirmation-button")
        : null;
      if (!el) return;
      if (el.id === "email-capture-back" || el.id === "email-capture-submit") return;
      trackCheckoutClick();
    },
    true
  );

  // Digi email submit: fire IC/API once a valid email is in the input (deferred from Pay fee)
  document.addEventListener(
    "click",
    function (ev) {
      var el = ev.target && ev.target.closest
        ? ev.target.closest("#email-capture-submit")
        : null;
      if (!el) return;
      var email = resolveCapturedEmail();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
      trackCheckoutClick();
    },
    true
  );

  // Also wrap goToCheckout if defined later
  function wrapGoToCheckout() {
    if (typeof window.goToCheckout !== "function") return false;
    if (window.goToCheckout.__ssWrapped) return true;
    var orig = window.goToCheckout;
    window.goToCheckout = function () {
      try {
        trackCheckoutClick();
      } catch (e) {}
      return orig.apply(this, arguments);
    };
    window.goToCheckout.__ssWrapped = true;
    return true;
  }

  wrapGoToCheckout();
  var tries = 0;
  var t = setInterval(function () {
    tries++;
    if (wrapGoToCheckout() || tries > 40) clearInterval(t);
  }, 250);

  // Expose for verified back-redirect (same InitiateCheckout / content_id as Pay fee)
  window.ssTrackCheckoutClick = trackCheckoutClick;
})();
