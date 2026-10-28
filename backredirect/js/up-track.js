/**
 * Marca que a pessoa chegou na pagina de upsell (up1, up2, up3, e as do back).
 *
 * Por que existe: as paginas de upsell nao tinham rastreamento nenhum. O cliente
 * sumia do painel na hora que terminava o checkout do front e so reaparecia se
 * comprasse um upsell. Sem isso, nao da para saber se a pessoa nem chegou no up1
 * ou se chegou e disse nao.
 *
 * Importante: isto NAO manda evento para o TikTok. So grava a visita no banco da
 * Escalya. A conta do TikTok continua recebendo um Purchase por front, nada mais.
 */
(function (w, d) {
  var ENDPOINT =
    "https://xxegeqbktxrdslqlipms.supabase.co/functions/v1/funnel-hit";

  // Mesma chave que o vsl-ab.js grava na pagina de entrada. As paginas de upsell
  // estao no mesmo dominio, entao o sorteio ainda esta aqui.
  var AB_KEY = "verified_vsl_ab_v1";
  var SID_KEY = "funnel_sid_v1";
  // Recarregar a pagina nao conta de novo; passar pelo funil amanha conta.
  var JANELA_MS = 12 * 60 * 60 * 1000;

  function ls(chave) {
    try {
      return localStorage.getItem(chave) || "";
    } catch (e) {
      return "";
    }
  }

  function guarda(chave, valor) {
    try {
      localStorage.setItem(chave, valor);
    } catch (e) {}
  }

  /** Qual passo do funil e esta pagina. Vazio = pagina que nao interessa. */
  function pagina() {
    var caminho = "";
    try {
      caminho = (w.location.pathname || "").toLowerCase();
    } catch (e) {
      return "";
    }
    // As do back terminam em "bk" para separar das principais no relatorio.
    if (caminho.indexOf("up1bk") >= 0) return "up1bk";
    if (caminho.indexOf("up2bk") >= 0) return "up2bk";
    if (caminho.indexOf("up3bk") >= 0) return "up3bk";
    if (caminho.indexOf("up1") >= 0) return "up1";
    if (caminho.indexOf("up2") >= 0) return "up2";
    if (caminho.indexOf("up3") >= 0) return "up3";
    // Oferta do back. Esta pagina nunca teve medicao nenhuma, entao a coluna
    // "Back" do teste A/B vivia marcando zero visita mesmo com gente entrando.
    if (caminho.indexOf("bk-encb") >= 0) return "bk";
    return "";
  }

  /** Versao sorteada na entrada. "sem_marca" para quem veio de antes do teste. */
  function versao() {
    var arm = ls(AB_KEY);
    return arm === "vsl" || arm === "control" ? arm : "sem_marca";
  }

  /** Id curto do navegador, so para nao contar o mesmo recarregamento duas vezes. */
  function sessao() {
    var sid = ls(SID_KEY);
    if (!sid) {
      sid = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      guarda(SID_KEY, sid);
    }
    return sid;
  }

  function jaContado(page) {
    var quando = Number(ls("funnel_hit_" + page)) || 0;
    return quando > 0 && Date.now() - quando < JANELA_MS;
  }

  /**
   * Avisa a Escalya, uma vez por pessoa por passo.
   *
   * sendBeacon primeiro: o up2 e o up3 as vezes saltam para fora quase na hora
   * em que carregam (widget da VendePay sem pedido valido), e o botao do back
   * leva embora para o checkout. Nos dois casos o fetch comum morre junto com a
   * pagina; o beacon vai embora assim mesmo. "text/plain" evita o pedido de
   * permissao extra entre dominios; do outro lado a funcao le o corpo como JSON.
   */
  function avisa(page) {
    if (!page || jaContado(page)) return;
    guarda("funnel_hit_" + page, String(Date.now()));

    var corpo = JSON.stringify({
      page: page,
      arm: versao(),
      sid: sessao(),
      url: w.location.href,
    });

    try {
      if (navigator.sendBeacon) {
        var pacote = new Blob([corpo], { type: "text/plain;charset=UTF-8" });
        if (navigator.sendBeacon(ENDPOINT, pacote)) return;
      }
    } catch (e) {}

    try {
      fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: corpo,
        keepalive: true,
        mode: "cors",
      }).catch(function () {});
    } catch (e2) {}
  }

  var page = pagina();
  if (!page) return;
  avisa(page);

  // Na pagina do back, tambem conta quem clica no botao e vai para o checkout.
  // Sem isto so daria para saber quem entrou, nunca quem chegou a tentar pagar.
  if (page === "bk") {
    d.addEventListener(
      "click",
      function (ev) {
        var alvo = ev.target && ev.target.closest ? ev.target.closest("a") : null;
        if (!alvo || !alvo.href) return;
        if (alvo.href.indexOf("checkout.vendepay.com") < 0) return;
        avisa("bkchk");
      },
      true,
    );
  }
})(window, document);
