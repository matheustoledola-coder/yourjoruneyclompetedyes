/**
 * Applies VSL confirmation UX on #nine when VSL_AB arm is "vsl".
 * Control arm: leave confirmation as-is (no player, everything visible).
 */
(function (w, d) {
  var UNLOCK_BEFORE_END = 4;
  // Rede de seguranca: o visitante NUNCA pode ficar numa pagina sem botao de
  // compra. Se o video falhar, ou demorar demais para carregar, a oferta abre
  // assim mesmo. Antes disso, video quebrado = venda perdida, e com 131 MB de
  // arquivo isso acontece em qualquer 4G ruim.
  var ABRE_SEM_VIDEO_MS = 15000;   // video nem carregou: abre
  var ABRE_NO_PIOR_CASO_MS = 120000; // travou no meio: abre de qualquer jeito
  // Tolerancia da trava anti-pular, em segundos. Com 1s o video rebobinava
  // sozinho em celular lento, aba em segundo plano ou travada de buffer.
  var TOLERANCIA_PULO = 3;
  var playerInited = false;

  function ready(fn) {
    if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  function applyLayout() {
    if (!w.VSL_AB || !w.VSL_AB.isVsl()) {
      try {
        d.documentElement.classList.add("vsl-ab-arm-control");
        d.documentElement.classList.remove("vsl-ab-arm-vsl");
      } catch (e0) {}
      var wrap = d.getElementById("vsl-ab-player-wrap");
      if (wrap) {
        wrap.hidden = true;
        wrap.setAttribute("aria-hidden", "true");
      }
      var gated = d.getElementById("vsl-ab-gated");
      if (gated) {
        gated.hidden = false;
        gated.classList.remove("is-locked");
        gated.removeAttribute("hidden");
        gated.setAttribute("aria-hidden", "false");
        try {
          gated.inert = false;
        } catch (eInertC) {}
      }
      var stickyCtrl = d.getElementById("popup-um");
      if (stickyCtrl) stickyCtrl.classList.remove("vsl-ab-sticky-hidden");
      return;
    }

    try {
      d.documentElement.classList.add("vsl-ab-arm-vsl");
      d.documentElement.classList.remove("vsl-ab-arm-control");
    } catch (e1) {}

    var playerWrap = d.getElementById("vsl-ab-player-wrap");
    var gated = d.getElementById("vsl-ab-gated");
    if (playerWrap) {
      playerWrap.hidden = false;
      playerWrap.removeAttribute("hidden");
      playerWrap.setAttribute("aria-hidden", "false");
    }
    if (gated) {
      if (!w.__vslAbUnlocked) {
        gated.hidden = true;
        gated.classList.add("is-locked");
        gated.setAttribute("hidden", "");
        gated.setAttribute("aria-hidden", "true");
        try {
          gated.inert = true;
        } catch (eInert) {}
        try {
          d.documentElement.classList.remove("vsl-ab-unlocked");
        } catch (eLock) {}
      } else {
        // Re-assert visible after unlock (showScreen(#nine) re-entry must not leave CTA hidden)
        gated.classList.remove("is-locked");
        gated.removeAttribute("hidden");
        gated.hidden = false;
        gated.setAttribute("aria-hidden", "false");
        try {
          gated.inert = false;
        } catch (eInert2) {}
        try {
          d.documentElement.classList.add("vsl-ab-unlocked");
        } catch (eAlready) {}
      }
    }

    var sticky = d.getElementById("popup-um");
    if (sticky) {
      if (!w.__vslAbUnlocked) sticky.classList.add("vsl-ab-sticky-hidden");
      else {
        sticky.classList.remove("vsl-ab-sticky-hidden");
        sticky.style.display = "";
      }
    }

    initPlayer();
  }

  function unlockGated() {
    if (w.__vslAbUnlocked) return;
    w.__vslAbUnlocked = true;
    try {
      d.documentElement.classList.add("vsl-ab-unlocked");
    } catch (eUnlock) {}
    var gated = d.getElementById("vsl-ab-gated");
    var sticky = d.getElementById("popup-um");
    var btn = d.getElementById("confirmation-button");
    if (gated) {
      gated.classList.remove("is-locked");
      gated.removeAttribute("hidden");
      gated.hidden = false;
      gated.setAttribute("aria-hidden", "false");
      try {
        gated.inert = false;
      } catch (eInert3) {}
    }
    if (sticky) {
      sticky.classList.remove("vsl-ab-sticky-hidden");
      sticky.style.display = "";
    }
    if (btn) {
      try {
        btn.scrollIntoView({ behavior: "smooth", block: "center" });
      } catch (e) {}
    }
    try {
      if (typeof w.__ssTrack === "function") {
        w.__ssTrack("ViewContent", {
          content_id: "exit-encb-vsl-unlocked",
          content_name: "VSL Unlocked Confirmation",
          value: 19.9,
        });
      }
    } catch (e2) {}
  }

  function initPlayer() {
    var root = d.getElementById("vsl-player");
    var video = d.getElementById("vsl-video");
    var loader = d.getElementById("vsl-loader");
    var playBtn = d.getElementById("vsl-play");
    var unmute = d.getElementById("vsl-unmute");
    var fill = d.getElementById("vsl-bar-fill");
    if (!root || !video) return;

    var src = root.getAttribute("data-src") || "/vsl/videos/vsl.mp4";
    // Browsers may report video.src as the page URL when attribute is missing
    if (!video.getAttribute("src")) video.setAttribute("src", src);

    if (playerInited) {
      // Section may have just become visible — re-paint first frame
      if (!w.__vslAbUserStarted) {
        try {
          video.pause();
          if (video.currentTime > 0.05) video.currentTime = 0;
        } catch (e) {}
        root.classList.add("is-ready", "is-paused");
      }
      return;
    }
    playerInited = true;

    video.muted = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    video.controls = false;
    video.preload = "auto";
    root.classList.add("is-paused");
    root.classList.remove("needs-sound");
    if (unmute) unmute.hidden = true;

    var lastAllowed = 0;
    var userStarted = false;
    w.__vslAbUserStarted = false;

    function showFirstFrame() {
      function freeze() {
        if (userStarted) return;
        try {
          video.pause();
        } catch (e) {}
        try {
          if (video.currentTime > 0.05) video.currentTime = 0;
        } catch (e2) {}
        root.classList.add("is-ready", "is-paused");
        if (loader) loader.style.opacity = "0";
      }
      if (userStarted) return;
      var p = video.play();
      if (p && typeof p.then === "function") {
        p.then(function () {
          if (!userStarted) freeze();
        }).catch(function () {
          freeze();
        });
      } else {
        freeze();
      }
    }

    function startPlayback() {
      if (userStarted && !video.paused) return;
      userStarted = true;
      w.__vslAbUserStarted = true;
      root.classList.remove("is-paused");
      root.classList.remove("needs-sound");
      if (unmute) unmute.hidden = true;
      video.muted = false;
      var p = video.play();
      function okLoud() {
        root.classList.remove("needs-sound");
        if (unmute) unmute.hidden = true;
      }
      function fallbackMuted() {
        video.muted = true;
        video
          .play()
          .then(function () {
            root.classList.add("needs-sound");
            if (unmute) unmute.hidden = false;
          })
          .catch(function () {});
      }
      if (p && typeof p.then === "function") {
        p.then(okLoud).catch(fallbackMuted);
      } else if (video.paused) {
        fallbackMuted();
      } else {
        okLoud();
      }
    }

    video.addEventListener("loadeddata", showFirstFrame);
    video.addEventListener("loadedmetadata", showFirstFrame);
    video.addEventListener("canplay", function () {
      if (!userStarted) showFirstFrame();
    });
    video.addEventListener("playing", function () {
      root.classList.add("is-ready");
      // Don't hide Play during first-frame paint probe
      if (userStarted) root.classList.remove("is-paused");
      if (loader) loader.style.opacity = "0";
    });
    video.addEventListener("timeupdate", function () {
      if (!userStarted) return;
      if (video.currentTime > lastAllowed + TOLERANCIA_PULO) {
        // So volta quando o salto e grande de verdade (arrastou a barra).
        video.currentTime = lastAllowed;
      } else {
        lastAllowed = Math.max(lastAllowed, video.currentTime);
      }
      if (fill && isFinite(video.duration) && video.duration > 0) {
        fill.style.width =
          Math.min(100, (video.currentTime / video.duration) * 100) + "%";
      }
      if (isFinite(video.duration) && video.duration > 0) {
        if (video.currentTime >= Math.max(0, video.duration - UNLOCK_BEFORE_END)) {
          unlockGated();
        }
      }
    });
    video.addEventListener("ended", unlockGated);

    if (playBtn) {
      playBtn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        startPlayback();
      });
    }
    if (unmute) {
      unmute.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        video.muted = false;
        root.classList.remove("needs-sound");
        unmute.hidden = true;
        if (video.paused) video.play().catch(function () {});
      });
    }
    video.addEventListener("click", function () {
      if (!userStarted || video.paused) startPlayback();
    });

    if (video.readyState >= 2) showFirstFrame();

    // Video deu erro (arquivo fora do ar, formato recusado, rede caiu): abre.
    video.addEventListener("error", function () {
      console.warn("[vsl-ab] video falhou, liberando a oferta");
      unlockGated();
    });
    // Nao carregou nada em 15s: abre, em vez de deixar a pessoa olhando para
    // um player parado.
    setTimeout(function () {
      if (video.readyState < 2) {
        console.warn("[vsl-ab] video nao carregou a tempo, liberando a oferta");
        unlockGated();
      }
    }, ABRE_SEM_VIDEO_MS);
    // Rede final: passou tempo demais na pagina, abre de qualquer jeito.
    setTimeout(unlockGated, ABRE_NO_PIOR_CASO_MS);
  }

  function hookShowScreen() {
    if (w.__vslAbShowHooked) return;
    if (typeof w.showScreen !== "function") return;
    w.__vslAbShowHooked = true;
    var orig = w.showScreen;
    w.showScreen = function (id, push) {
      var ret = orig.apply(this, arguments);
      if (id === "nine") {
        setTimeout(function () {
          applyLayout();
        }, 30);
        setTimeout(function () {
          applyLayout();
        }, 200);
      }
      return ret;
    };
  }

  ready(function () {
    applyLayout();
    hookShowScreen();
    // main.js may assign showScreen slightly later
    setTimeout(hookShowScreen, 0);
    setTimeout(hookShowScreen, 100);
  });

  w.VSL_AB_UI = { applyLayout: applyLayout, unlockGated: unlockGated };
})(window, document);
