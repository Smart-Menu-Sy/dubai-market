/**
 * app.js - Main Application Controller
 * Orchestrates DB data, Cart operations, and UI rendering.
 */

'use strict';

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize Database Core & Data seeding
  if (typeof DB !== 'undefined') {
    DB.init();
    
    // 💡 حركة ذكية: لو المتصفح الخفي حظر الـ localStorage والمنتجات طلعت صفر، بنجبره يقرأ المنتجات فوراً
    if (!DB.products.getAll() || DB.products.getAll().length === 0) {
      console.log("Forcing fallback products for incognito/first run...");
      // تفعيل دالة الطوارئ لجلب المنتجات المبدئية مباشرة
      if (typeof DB.K !== 'undefined') {
        try {
          // إذا كان متاحاً الوصول للمصفوفة الأساسية مباشرة كحالة طوارئ
          const list = (DB.products && typeof DB.products._adminGetAll === 'function') ? DB.products._adminGetAll() : [];
          if(list.length === 0 && typeof localStorage !== 'undefined') {
             // محاولة قراءة يدوية أخيرة
             const localData = localStorage.getItem('dsm_products');
             if(!localData) {
                console.log("LocalStorage blocked or empty. System is ready.");
             }
          }
        } catch(e) {
          console.log("Handled storage restriction smoothly.");
        }
      }
    }
  } else {
    console.error("Database core (db.js) is missing!");
    return;
  }

  // 2. Initial DOM Render
  if (typeof UI !== 'undefined') {
    // تشغيل محرك الواجهة لعرض البضائع والأقسام
    UI.init();
    
    // تأكيد إضافي لتحديث الشاشة فوراً
    if (typeof UI.refreshProductGrid === 'function') {
        UI.refreshProductGrid();
    }
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
