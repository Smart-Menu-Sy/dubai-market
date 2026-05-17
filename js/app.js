/**
 * app.js - Main Application Controller
 * Fully compatible with Sahnaya Dubai Market Secured Data Layer
 */

'use strict';

document.addEventListener('DOMContentLoaded', () => {
  // 1. تشغيل قاعدة البيانات وحقن الأصناف المبدئية
  if (typeof DB !== 'undefined') {
    DB.init();
    console.log("Database initialized successfully.");
  } else {
    console.error("Database core (db.js) is missing!");
    return;
  }

  // 2. تشغيل محرك الواجهة وعرض الأقسام
  if (typeof UI !== 'undefined') {
    UI.init();
    
    // 🔥 الخطوة السحرية: إجبار الواجهة على قراءة البضائع وعرضها فوراً عند أول إقلاع للموقع
    setTimeout(() => {
      console.log("Forcing product grid refresh...");
      if (typeof UI.refreshProductGrid === 'function') {
        UI.refreshProductGrid();
      } else if (typeof UI.renderProducts === 'function') {
        // إذا كان اسم الدالة في ملف ui.js هو renderProducts
        const allProducts = DB.products.getAll();
        UI.renderProducts(allProducts);
      } else {
        // حل بديل: محاكاة الضغط على زر "كل المنتجات" (All) لتنشيط العرض تلقائياً
        const allBtn = document.querySelector('.category-btn[data-cat="all"]') || document.querySelector('.btn-category') || document.querySelector('.All') || document.body;
        if (allBtn && typeof allBtn.click === 'function') {
          allBtn.click();
        }
      }
    }, 300); // تأخير بسيط بمقدار 300 جزء من الثانية لضمان استقرار الملفات

  } else {
    console.error("UI rendering engine (ui.js) is missing!");
    return;
  }

  // 3. تفعيل الأزرار والعمليات
  setupGlobalEventListeners();
});

function setupGlobalEventListeners() {
  const body = document.body;

  body.addEventListener('click', (e) => {
    const target = e.target;

    // إضافة منتج إلى السلة
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

    // زيادة الكمية داخل السلة أو الكرت
    if (target.classList.contains('qty-inc') || target.closest('.qty-inc')) {
      const btn = target.classList.contains('qty-inc') ? target : target.closest('.qty-inc');
      const productId = btn.getAttribute('data-id');
      DB.cart.increment(productId);
      if (typeof UI.refreshCart === 'function') UI.refreshCart();
      if (typeof UI.updateProductCardQty === 'function') UI.updateProductCardQty(productId);
    }

    // إنقاص الكمية داخل السلة أو الكرت
    if (target.classList.contains('qty-dec') || target.closest('.qty-dec')) {
      const btn = target.classList.contains('qty-dec') ? target : target.closest('.qty-dec');
      const productId = btn.getAttribute('data-id');
      DB.cart.decrement(productId);
      if (typeof UI.refreshCart === 'function') UI.refreshCart();
      if (typeof UI.updateProductCardQty === 'function') UI.updateProductCardQty(productId);
    }
  });
}
