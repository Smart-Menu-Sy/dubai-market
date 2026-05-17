/**
 * cart.js – Reactive Cart Manager
 *
 * Wraps DB.cart with an event-emission layer so any UI component
 * can subscribe to cart changes without tight coupling.
 *
 * Usage:
 *   CartManager.on('change', state => renderCart(state));
 *   CartManager.add(product);
 */

'use strict';

const CartManager = (() => {
  const listeners = new Map(); // event → [callbacks]

  /* ── emit / on ── */
  function emit(event, data) {
    (listeners.get(event) || []).forEach(fn => fn(data));
  }

  function on(event, fn) {
    if (!listeners.has(event)) listeners.set(event, []);
    listeners.get(event).push(fn);
    return () => {                          // returns unsubscribe fn
      const arr = listeners.get(event);
      if (arr) listeners.set(event, arr.filter(f => f !== fn));
    };
  }

  /* ── state snapshot ── */
  function getState() {
    const items    = DB.cart.getItems();
    const subtotal = DB.cart.getSubtotal();
    const count    = DB.cart.getCount();
    return { items, subtotal, count, isEmpty: count === 0 };
  }

  function notifyChange() { emit('change', getState()); }

  /* ── public actions ── */
  function add(product) {
    if (!product || !product.available) return 0;
    const qty = DB.cart.add(product);
    notifyChange();
    return qty;
  }

  function increment(productId) {
    const qty = DB.cart.increment(productId);
    notifyChange();
    return qty;
  }

  function decrement(productId) {
    const qty = DB.cart.decrement(productId);
    notifyChange();
    return qty;
  }

  function remove(productId) {
    DB.cart.remove(productId);
    notifyChange();
  }

  function clear() {
    DB.cart.clear();
    notifyChange();
  }

  function getQty(productId) {
    const item = DB.cart.findItem(productId);
    return item ? item.qty : 0;
  }

  /**
   * Build and validate order, then save to DB and send via WhatsApp.
   * Returns { ok, order, errorMsg }
   */
  function checkout({ customerName, phone, address, note, promoCode }) {
    const items = DB.cart.getItems();
    if (!items.length)    return { ok: false, errorMsg: 'Your cart is empty.' };
    if (!customerName)    return { ok: false, errorMsg: 'Please enter your name.' };
    if (!phone)           return { ok: false, errorMsg: 'Please enter your phone number.' };

    const order = DB.orders.create({ customerName, phone, address, note, items, promoCode });
    if (!order) return { ok: false, errorMsg: 'Failed to create order. Please try again.' };

    clear();  // clears cart after successful order
    return { ok: true, order };
  }

  /**
   * Validate a promo code without placing an order.
   * Returns { valid, discountPct, discountAmt, newTotal }
   */
  function validatePromo(code, subtotal) {
    const cfg = DB.config.get();
    if (!cfg.promoCode || !code) return { valid: false };
    if (code.toUpperCase() !== cfg.promoCode.toUpperCase()) return { valid: false };
    const discountAmt = parseFloat((subtotal * cfg.discountPct / 100).toFixed(2));
    const newTotal    = parseFloat((subtotal - discountAmt).toFixed(2));
    return { valid: true, discountPct: cfg.discountPct, discountAmt, newTotal };
  }

  return { on, emit, getState, add, increment, decrement, remove, clear, getQty, checkout, validatePromo };
})();
