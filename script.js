/* Naturally Craveable shop — PayPal + Apple Pay checkout (client-side only) */
(function () {
  "use strict";

  var SETUP_NOTE = "Checkout is being set up — please check back shortly.";
  var ERROR_NOTE = "Payment didn't go through — please try again.";

  /* Prices + descriptions per checkout slot. PayPal collects the buyer's
     name, email and card details in its own form — we ask for nothing. */
  var PRODUCTS = {
    hero: { price: "29.99", description: "Naturally Craveable: Healthy Cravings — 120-recipe PDF ebook" },
    pricing: { price: "29.99", description: "Naturally Craveable: Healthy Cravings — 120-recipe PDF ebook" },
    book2: { price: "24.99", description: "Naturally Craveable: The Everyday Weight Loss Kitchen — 60-recipe PDF ebook" },
    book3: { price: "29.99", description: "Naturally Craveable: Gut & Debloat Reset — 60-recipe PDF ebook" },
    bundle: { price: "49.99", description: "Naturally Craveable: Complete Kitchen — all 3 books (240-recipe PDF ebooks)" }
  };

  /* Digital goods: never ask for a shipping address. */
  function buildOrder(prefix) {
    var product = PRODUCTS[prefix] || PRODUCTS.pricing;
    return {
      application_context: { shipping_preference: "NO_SHIPPING" },
      purchase_units: [{
        description: product.description,
        amount: { currency_code: "USD", value: product.price }
      }]
    };
  }

  /* ---- Shared success handling ---- */
  function showSuccess(prefix, slotIds, details, orderId) {
    slotIds.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) { el.innerHTML = ""; }
    });
    var box = document.getElementById("success-" + prefix);
    if (!box) { return; }
    var idSpan = box.querySelector(".order-id");
    if (idSpan) { idSpan.textContent = (details && details.id) || orderId || ""; }
    box.hidden = false;
    box.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function showSetupNote(slot) {
    if (!slot) { return; }
    slot.innerHTML = "";
    var p = document.createElement("p");
    p.className = "setup-note";
    p.textContent = SETUP_NOTE;
    slot.appendChild(p);
  }

  function showError(slot, successBox) {
    if (successBox) { successBox.hidden = true; }
    var old = slot.querySelector(".paypal-error");
    if (old) { old.remove(); }
    var p = document.createElement("p");
    p.className = "paypal-error";
    p.textContent = ERROR_NOTE;
    slot.appendChild(p);
  }

  /* ---- PayPal buttons (standard: PayPal + Pay Later + Debit/Credit Card) ----
     The card button opens PayPal's own card form — no card details on our page. */
  function renderPayPal(prefix) {
    var slot = document.getElementById("paypal-" + prefix);
    var successBox = document.getElementById("success-" + prefix);
    if (!slot) { return; }
    var oldNote = slot.querySelector(".setup-note");
    if (oldNote) { oldNote.remove(); }
    if (typeof window.paypal === "undefined" || !window.paypal.Buttons) {
      showSetupNote(slot);
      return;
    }
    try {
      window.paypal.Buttons({
        style: { layout: "vertical", color: "gold", shape: "pill", label: "buynow" },
        createOrder: function (data, actions) {
          return actions.order.create(buildOrder(prefix));
        },
        onApprove: function (data, actions) {
          return actions.order.capture().then(function (details) {
            showSuccess(prefix, ["paypal-" + prefix, "applepay-" + prefix], details, data.orderID);
          });
        },
        onCancel: function () { showError(slot, successBox); },
        onError: function () { showError(slot, successBox); }
      }).render("#paypal-" + prefix);
    } catch (e) {
      showSetupNote(slot);
    }
  }

  /* ---- Apple Pay via PayPal (Safari / Apple devices only) ----
     Shows only when PayPal reports this merchant + device as eligible.
     Needs two things on the PayPal account side, done once in the PayPal
     dashboard: Apple Pay enabled for the account, and the domain
     craveable.click registered (Apple domain-verification file hosted at
     /.well-known/apple-developer-merchantid-domain-association).
     Until then config().isEligible is false and nothing renders here. */
  function renderApplePay(prefix) {
    var slot = document.getElementById("applepay-" + prefix);
    var divider = document.getElementById("divider-" + prefix);
    if (!slot) { return; }
    if (typeof window.paypal === "undefined" || !window.paypal.Applepay ||
        typeof window.ApplePaySession === "undefined") {
      return;
    }
    try {
      window.paypal.Applepay().config().then(function (config) {
        if (!config || !config.isEligible) { return; }
        if (divider) { divider.hidden = false; }
        window.paypal.Buttons({
          fundingSource: window.paypal.FUNDING.APPLEPAY,
          style: { color: "black", shape: "rect", label: "buynow" },
          paymentRequest: { applepay: { requiredShippingContactFields: [] } },
          createOrder: function (data, actions) {
            return actions.order.create(buildOrder(prefix));
          },
          onApprove: function (data, actions) {
            return actions.order.capture().then(function (details) {
              showSuccess(prefix, ["paypal-" + prefix, "applepay-" + prefix], details, data.orderID);
            });
          },
          onCancel: function () {
            showError(document.getElementById("paypal-" + prefix),
              document.getElementById("success-" + prefix));
          },
          onError: function () {
            showError(document.getElementById("paypal-" + prefix),
              document.getElementById("success-" + prefix));
          }
        }).render("#applepay-" + prefix);
      }).catch(function () { /* not eligible — leave the slot empty */ });
    } catch (e) { /* not eligible — leave the slot empty */ }
  }

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

  /* ---- Load the PayPal SDK ----
     The SDK (~100 KB) now starts downloading the moment the page starts
     loading (async <script> in <head>) instead of waiting for the DOM, so
     checkout can appear much sooner. This loader only waits for it: if the
     head script is still loading we attach to it; if it never arrives we
     inject it once from the #paypal-sdk-url holder as a fallback. */
  function loadPayPalSDK(done) {
    var called = false;
    function finish(ok) { if (!called) { called = true; done(ok); } }
    if (typeof window.paypal !== "undefined" && window.paypal.Buttons) { finish(true); return; }
    var holder = document.getElementById("paypal-sdk-url");
    var url = holder ? holder.getAttribute("data-url") : null;
    if (!url) { finish(false); return; }
    var existing = document.querySelector('script[src*="paypal.com/sdk/js"]');
    if (existing) {
      existing.addEventListener("load", function () { finish(true); });
      existing.addEventListener("error", function () { finish(false); });
      setTimeout(function () { finish(false); }, 15000);
      return;
    }
    var s = document.createElement("script");
    s.src = url;
    s.async = true;
    s.onload = function () { finish(true); };
    s.onerror = function () { finish(false); };
    document.head.appendChild(s);
    setTimeout(function () { finish(false); }, 15000);
  }

  /* ---- Render the below-fold checkouts only when scrolled near ----
     The hero checkout renders the moment the SDK is ready; the other four
     render when their card comes within 600px of the viewport, so the page
     does not spend its first seconds building five PayPal button sets at
     once. Falls back to rendering everything if IntersectionObserver is
     unavailable. */
  function renderLazyCheckouts(prefixes) {
    if (!("IntersectionObserver" in window)) {
      prefixes.forEach(function (p) { renderApplePay(p); renderPayPal(p); });
      return;
    }
    prefixes.forEach(function (prefix) {
      var slot = document.getElementById("paypal-" + prefix);
      if (!slot) { return; }
      var observer = new IntersectionObserver(function (entries, obs) {
        if (entries[0].isIntersecting) {
          obs.disconnect();
          renderApplePay(prefix);
          renderPayPal(prefix);
        }
      }, { rootMargin: "600px 0px" });
      observer.observe(slot);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initStickyBar();
    loadPayPalSDK(function (ok) {
      if (!ok) {
        showSetupNote(document.getElementById("paypal-hero"));
        showSetupNote(document.getElementById("paypal-pricing"));
        showSetupNote(document.getElementById("paypal-book2"));
        showSetupNote(document.getElementById("paypal-book3"));
        showSetupNote(document.getElementById("paypal-bundle"));
        return;
      }
      renderApplePay("hero");
      renderPayPal("hero");
      renderLazyCheckouts(["pricing", "book2", "book3", "bundle"]);
    });
  });
})();
