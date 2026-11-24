/* Naturally Craveable shop — checkout is PayPal payment links now.
   Buy buttons are plain links in index.html; this file only runs the
   sticky bottom buy bar (mobile). No PayPal SDK, no keys here. */
(function () {
  "use strict";

  /* ---- Sticky bottom buy bar (mobile only) ----
     Appears only after the hero checkout scrolls out of view.
     The bar has no PayPal button of its own — tapping it scrolls to #pricing. */
  function initStickyBar() {
    var bar = document.getElementById("sticky-bar");
    var heroCheckout = document.getElementById("hero-checkout");
    if (!bar || !heroCheckout) { return; }
    if (!("IntersectionObserver" in window)) { return; }
    var observer = new IntersectionObserver(function (entries) {
      var visible = !entries[0].isIntersecting;
      bar.classList.toggle("visible", visible);
      bar.setAttribute("aria-hidden", visible ? "false" : "true");
      document.body.classList.toggle("has-sticky-bar", visible);
    }, { threshold: 0 });
    observer.observe(heroCheckout);
  }

  document.addEventListener("DOMContentLoaded", function () {
    initStickyBar();
  });
})();
