/* Naturally Craveable shop — PayPal checkout (client-side only) + notify forms */
(function () {
  "use strict";

  var SETUP_NOTE = "Checkout is being set up — please check back shortly.";
  var ERROR_NOTE = "Payment didn't go through — please try again.";

  /* ---- PayPal buttons ---- */
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

  function renderButtons(slotId, successId) {
    var slot = document.getElementById(slotId);
    var successBox = document.getElementById(successId);
    if (!slot) { return; }

    if (typeof window.paypal === "undefined" || !window.paypal.Buttons) {
      showSetupNote(slot);
      return;
    }

    try {
      window.paypal.Buttons({
        style: { layout: "vertical", color: "gold", shape: "pill", label: "buynow" },
        createOrder: function (data, actions) {
          return actions.order.create({
            purchase_units: [{
              description: "Naturally Craveable: Healthy Cravings — 120-recipe PDF ebook",
              amount: { currency_code: "USD", value: "29.99" }
            }]
          });
        },
        onApprove: function (data, actions) {
          return actions.order.capture().then(function (details) {
            var idSpan = successBox.querySelector(".order-id");
            if (idSpan) { idSpan.textContent = details.id || data.orderID || ""; }
            slot.innerHTML = "";
            successBox.hidden = false;
            successBox.scrollIntoView({ behavior: "smooth", block: "center" });
          });
        },
        onCancel: function () {
          showError(slot, successBox);
        },
        onError: function () {
          showError(slot, successBox);
        }
      }).render("#" + slotId);
    } catch (e) {
      showSetupNote(slot);
    }
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

  document.addEventListener("DOMContentLoaded", function () {
    renderButtons("paypal-hero", "success-hero");
    renderButtons("paypal-pricing", "success-pricing");
    initNotifyForms();
  });
})();
