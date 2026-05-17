/**
 * app.js - Main Application Controller (Compatible with Dubai Supermarket Data Layer)
 */

'use strict';

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize Database Core & Data seeding
  if (typeof DB !== 'undefined' && typeof DB.init === 'function') {
    DB.init();
  } else {
    console.error("Database core (db.js) is missing or not structured correctly!");
    return;
  }

  // 2. Initial DOM Render
  if (typeof UI !== 'undefined' && typeof UI.init === 'function') {
    UI.init();
  } else {
    console.error("UI rendering engine (ui.js) is missing!");
    return;
  }

  // 3. Global Event Delegation for Dynamic Elements
  setupGlobalEventListeners();
});

function setupGlobalEventListeners() {
  const body = document.body;

  body.addEventListener('click', (e) => {
    const target = e.target;

    // Add to cart button from product card
    if (target.classList.contains('btn-add-cart') || target.closest('.btn-add-cart')) {
      const btn = target.classList.contains('btn-add-cart') ? target : target.closest('.btn-add-cart');
      const productId = btn.getAttribute('data-id');
      const product = DB.products.getById(productId);
      if (product) {
        DB.cart.add(product);
        if (typeof UI.refreshCart === 'function') UI.refreshCart();
        if (typeof UI.updateProductCardQty === 'function') UI.updateProductCardQty(productId);
      }
    }

    // Increment quantity
    if (target.classList.contains('qty-inc') || target.closest('.qty-inc')) {
      const btn = target.classList.contains('qty-inc') ? target : target.closest('.qty-inc');
      const productId = btn.getAttribute('data-id');
      DB.cart.increment(productId);
      if (typeof UI.refreshCart === 'function') UI.refreshCart();
      if (typeof UI.updateProductCardQty === 'function') UI.updateProductCardQty(productId);
    }

    // Decrement quantity
    if (target.classList.contains('qty-dec') || target.closest('.qty-dec')) {
      const btn = target.classList.contains('qty-dec') ? target : target.closest('.qty-dec');
      const productId = btn.getAttribute('data-id');
      DB.cart.decrement(productId);
      if (typeof UI.refreshCart === 'function') UI.refreshCart();
      if (typeof UI.updateProductCardQty === 'function') UI.updateProductCardQty(productId);
    }
  });
}
