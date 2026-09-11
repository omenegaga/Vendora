/* Vendora embed helper. Load this once on any sales page. */
(function (window, document) {
  "use strict";
  var STORE_KEY = "checkout_charm_attribution_v1";
  var ADD_TO_CART_KEY = "vendora_add_to_cart_v1";
  var UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];

  function cookie(name) {
    var match = document.cookie.split("; ").find(function (item) { return item.indexOf(name + "=") === 0; });
    return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined;
  }
  function saved() {
    try { return JSON.parse(window.localStorage.getItem(STORE_KEY) || "{}"); } catch (_) { return {}; }
  }
  function capture() {
    var params = new URLSearchParams(window.location.search);
    var next = saved();
    var touched = false;
    ["fbclid"].concat(UTM_KEYS).forEach(function (key) {
      var value = params.get(key);
      if (value && !next[key]) { next[key] = value; touched = true; }
    });
    next.fbp = next.fbp || cookie("_fbp");
    next.fbc = next.fbc || cookie("_fbc") || (next.fbclid ? "fb.1." + Date.now() + "." + next.fbclid : undefined);
    if (touched || !next.landing_page) {
      next.landing_page = window.location.href;
      next.referrer = document.referrer || next.referrer;
      next.captured_at = new Date().toISOString();
    }
    try { window.localStorage.setItem(STORE_KEY, JSON.stringify(next)); } catch (_) {}
    return next;
  }
  function trackAddToCart(data) {
    try {
      if (window.sessionStorage.getItem(ADD_TO_CART_KEY)) return;
      window.sessionStorage.setItem(ADD_TO_CART_KEY, "1");
    } catch (_) {}
    if (window.fbq) window.fbq("track", "AddToCart", data || {});
  }
  function checkoutUrl(url) {
    var destination = new URL(url, window.location.href);
    var data = capture();
    ["fbclid"].concat(UTM_KEYS).forEach(function (key) {
      if (data[key] && !destination.searchParams.has(key)) destination.searchParams.set(key, data[key]);
    });
    if (data.fbp) destination.searchParams.set("cc_fbp", data.fbp);
    if (data.fbc) destination.searchParams.set("cc_fbc", data.fbc);
    if (data.landing_page) destination.searchParams.set("cc_landing_page", data.landing_page);
    if (data.referrer) destination.searchParams.set("cc_referrer", data.referrer);
    if (data.captured_at) destination.searchParams.set("cc_captured_at", data.captured_at);
    return destination.toString();
  }
  function redirect(url) { trackAddToCart(); window.location.assign(checkoutUrl(url)); }
  function openDrawer(url) {
    var overlay = document.createElement("div");
    overlay.setAttribute("role", "dialog"); overlay.setAttribute("aria-modal", "true");
    overlay.style.cssText = "position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.5);display:flex;justify-content:flex-end";
    var panel = document.createElement("div");
    panel.style.cssText = "width:min(100%,600px);height:100%;background:#fff;box-shadow:-12px 0 40px rgba(0,0,0,.25)";
    var close = document.createElement("button"); close.textContent = "×"; close.setAttribute("aria-label", "Close checkout");
    close.style.cssText = "position:absolute;top:12px;right:16px;z-index:1;border:0;border-radius:50%;width:36px;height:36px;font-size:28px;line-height:30px;cursor:pointer";
    trackAddToCart();
    var frame = document.createElement("iframe"); frame.src = checkoutUrl(url); frame.title = "Secure checkout";
    frame.style.cssText = "border:0;width:100%;height:100%";
    function dismiss() { overlay.remove(); document.removeEventListener("keydown", keydown); }
    function keydown(event) { if (event.key === "Escape") dismiss(); }
    close.onclick = dismiss; overlay.onclick = function (event) { if (event.target === overlay) dismiss(); };
    panel.appendChild(close); panel.appendChild(frame); overlay.appendChild(panel); document.body.appendChild(overlay); document.addEventListener("keydown", keydown);
    return { close: dismiss };
  }
  window.VendoraCheckout = { capture: capture, checkoutUrl: checkoutUrl, redirect: redirect, openDrawer: openDrawer, trackAddToCart: trackAddToCart };
  // Backwards compatibility for sales pages using the original helper name.
  window.CheckoutCharm = window.VendoraCheckout;
  capture();
})(window, document);
