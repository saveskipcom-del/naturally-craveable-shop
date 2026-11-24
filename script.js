/* Naturally Craveable shop — PayPal + Apple Pay checkout (client-side only) */
(function () {
  "use strict";

  var SETUP_NOTE = "Checkout is being set up — please check back shortly.";
  var ERROR_NOTE = "Payment didn't go through — please try again.";
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  /* ---- Buyer details: name + email only (digital product, no addresses) ---- */
  function getBuyer(prefix) {
    var nameEl = document.getElementById("buyer-name-" + prefix);
    var emailEl = document.getElementById("buyer-email-" + prefix);
    var errEl = document.getElementById("buyer-error-" + prefix);
    var name = nameEl ? nameEl.value.trim() : "";
    var email = emailEl ? emailEl.value.trim() : "";
    if (!name || !EMAIL_RE.test(email)) {
      if (errEl) { errEl.hidden = false; }
      if (!name && nameEl) { nameEl.focus(); }
      else if (emailEl) { emailEl.focus(); }
      return null;
    }
    if (errEl) { errEl.hidden = true; }
    return { name: name, email: email };
  }

  /* Soft read: return buyer only if name + valid email are present.
     Never shows an error or steals focus — used by PayPal/Apple Pay so a
     buyer can pay immediately and PayPal collects their details instead. */
  function getBuyerSoft(prefix) {
    var nameEl = document.getElementById("buyer-name-" + prefix);
    var emailEl = document.getElementById("buyer-email-" + prefix);
    var name = nameEl ? nameEl.value.trim() : "";
    var email = emailEl ? emailEl.value.trim() : "";
    if (!name || !EMAIL_RE.test(email)) { return null; }
    return { name: name, email: email };
  }

  function splitName(full) {
    var parts = full.trim().split(/\s+/);
    return { given_name: parts[0], surname: parts.slice(1).join(" ") || parts[0] };
  }

  /* Digital goods: never ask for a shipping address. Prefill name + email
     from our form so PayPal does not ask for them again. */
  var PRODUCTS = {
    hero: { price: "29.99", description: "Naturally Craveable: Healthy Cravings — 120-recipe PDF ebook" },
    pricing: { price: "29.99", description: "Naturally Craveable: Healthy Cravings — 120-recipe PDF ebook" },
    book2: { price: "24.99", description: "Naturally Craveable: The Everyday Weight Loss Kitchen — 60-recipe PDF ebook" }
  };

  function buildOrder(buyer, prefix) {
    var product = PRODUCTS[prefix] || PRODUCTS.pricing;
    var order = {
      application_context: { shipping_preference: "NO_SHIPPING" },
      purchase_units: [{
        description: product.description,
        amount: { currency_code: "USD", value: product.price }
      }]
    };
    if (buyer) {
      var n = splitName(buyer.name);
      order.payer = { email_address: buyer.email, name: n };
    }
    return order;
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

  /* ---- PayPal / debit-card buttons ----
     When our own card form is live (CardFields eligible), show only the
     PayPal wallet button here. Otherwise show the standard buttons,
     which include PayPal's own card form as a fallback. */
  function renderPayPal(prefix, cardFormLive) {
    var slot = document.getElementById("paypal-" + prefix);
    var successBox = document.getElementById("success-" + prefix);
    if (!slot) { return; }
    if (typeof window.paypal === "undefined" || !window.paypal.Buttons) {
      showSetupNote(slot);
      return;
    }
    try {
      var config = {
        style: { layout: "vertical", color: "gold", shape: "pill", label: "buynow" },
        /* No gate here: a buyer with an empty name/email form pays
           straight through — PayPal collects their details. */
        createOrder: function (data, actions) {
          return actions.order.create(buildOrder(getBuyerSoft(prefix), prefix));
        },
        onApprove: function (data, actions) {
          return actions.order.capture().then(function (details) {
            showSuccess(prefix, ["paypal-" + prefix, "applepay-" + prefix], details, data.orderID);
          });
        },
        onCancel: function () { showError(slot, successBox); },
        onError: function () { showError(slot, successBox); }
      };
      if (cardFormLive && window.paypal.FUNDING && window.paypal.FUNDING.PAYPAL) {
        config.fundingSource = window.paypal.FUNDING.PAYPAL;
      }
      window.paypal.Buttons(config).render("#paypal-" + prefix);
    } catch (e) {
      showSetupNote(slot);
    }
  }

  /* ---- Our own short card form, powered by PayPal CardFields ----
     PayPal's own card form cannot be shortened — it always asks for billing
     address, mobile and ship-to. CardFields lets us render just number /
     expiry / CVV on our page (PayPal hosts the fields, so no card data ever
     touches our code). Billing address is optional and we do not collect it.
     Only renders when the PayPal account is approved for Advanced Credit
     and Debit Card Payments; otherwise the standard PayPal buttons above
     stay as the card fallback. */
  function renderCardFields(prefix) {
    var block = document.getElementById("card-fields-" + prefix);
    var payBtn = document.getElementById("card-pay-" + prefix);
    var errEl = document.getElementById("card-error-" + prefix);
    if (!block || !payBtn) { return false; }
    if (typeof window.paypal === "undefined" || !window.paypal.CardFields) {
      return false;
    }
    try {
      var cardFields = window.paypal.CardFields({
        createOrder: function (data, actions) {
          return actions.order.create(buildOrder(getBuyer(prefix), prefix));
        },
        onApprove: function (data, actions) {
          return actions.order.capture().then(function (details) {
            if (details && details.status === "COMPLETED") {
              showSuccess(prefix, ["paypal-" + prefix, "applepay-" + prefix], details, data.orderID);
            } else {
              if (errEl) { errEl.hidden = false; }
            }
          });
        }
      });
      if (!cardFields.isEligible()) { return false; }
      var style = { input: { "font-size": "16px", "font-family": "inherit", color: "#1e3d2b" } };
      cardFields.NumberField({ style: style, placeholder: "Card number" }).render("#card-number-" + prefix);
      cardFields.ExpiryField({ style: style, placeholder: "MM / YY" }).render("#card-expiry-" + prefix);
      cardFields.CVVField({ style: style, placeholder: "CVV" }).render("#card-cvv-" + prefix);
      block.hidden = false;
      payBtn.addEventListener("click", function () {
        var buyer = getBuyer(prefix);
        if (!buyer) { return; }
        if (errEl) { errEl.hidden = true; }
        payBtn.disabled = true;
        cardFields.submit({ cardholderName: buyer.name }).then(function () {
          payBtn.disabled = false;
        }).catch(function () {
          payBtn.disabled = false;
          if (errEl) { errEl.hidden = false; }
        });
      });
      return true;
    } catch (e) {
      return false;
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
            return actions.order.create(buildOrder(getBuyerSoft(prefix), prefix));
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

  /* ---- Notify-me forms (no backend — shows confirmation only) ---- */
  function initNotifyForms() {
    var forms = document.querySelectorAll(".notify-form");
    forms.forEach(function (form) {
      form.addEventListener("submit", function (ev) {
        ev.preventDefault();
        var done = form.parentElement.querySelector(".notify-done");
        form.style.display = "none";
        if (done) { done.hidden = false; }
      });
    });
  }

  /* ---- Load the PayPal SDK after the page renders ----
     The SDK (~100 KB) used to be a static script tag that blocked the page
     from becoming interactive. Now we load it async once the DOM is ready,
     so the page paints first and checkout appears a moment later. */
  function loadPayPalSDK(done) {
    if (typeof window.paypal !== "undefined" && window.paypal.Buttons) { done(true); return; }
    var holder = document.getElementById("paypal-sdk-url");
    var url = holder ? holder.getAttribute("data-url") : null;
    if (!url) { done(false); return; }
    var s = document.createElement("script");
    s.src = url;
    s.async = true;
    s.onload = function () { done(true); };
    s.onerror = function () { done(false); };
    document.head.appendChild(s);
  }

  document.addEventListener("DOMContentLoaded", function () {
    initNotifyForms();
    loadPayPalSDK(function (ok) {
      if (!ok) {
        showSetupNote(document.getElementById("paypal-hero"));
        showSetupNote(document.getElementById("paypal-pricing"));
        showSetupNote(document.getElementById("paypal-book2"));
        return;
      }
      var cardHero = renderCardFields("hero");
      var cardPricing = renderCardFields("pricing");
      var cardBook2 = renderCardFields("book2");
      renderApplePay("hero");
      renderPayPal("hero", cardHero);
      renderApplePay("pricing");
      renderPayPal("pricing", cardPricing);
      renderApplePay("book2");
      renderPayPal("book2", cardBook2);
    });
  });
})();
