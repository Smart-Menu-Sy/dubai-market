/**
 * ui.js – Rendering Layer (pure DOM, no business logic)
 *
 * All functions take data and return HTML strings or mutate
 * specific DOM nodes. Zero coupling to CartManager / DB.
 */

'use strict';

const UI = (() => {

  /* ─────────────────────────────────────────────────────────────
     LAZY IMAGE LOADING via IntersectionObserver
  ───────────────────────────────────────────────────────────── */
  let _observer = null;

  function initLazyLoad() {
    if (!('IntersectionObserver' in window)) return;
    _observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const img = entry.target;
        const src = img.dataset.src;
        if (!src) return;
        img.src = src;
        img.onload  = () => img.classList.replace('lazy-hidden', 'lazy-loaded');
        img.onerror = () => { img.style.display = 'none'; };
        _observer.unobserve(img);
      });
    }, { rootMargin: '100px 0px' });
  }

  function observeImages(container) {
    if (!_observer) return;
    container.querySelectorAll('img[data-src]').forEach(img => _observer.observe(img));
  }

  /* ─────────────────────────────────────────────────────────────
     PRODUCT CARD
  ───────────────────────────────────────────────────────────── */
  function productCard(product, qty = 0) {
    const { id, name, nameAr, price, unit, imageURL, emoji, available } = product;
    const oos    = !available;
    const priceF = `AED ${price.toFixed(2)}`;

    const imgHTML = imageURL
      ? `<img class="product-img lazy-hidden" data-src="${_esc(imageURL)}" alt="${_esc(name)}" width="100%" height="100%">
         <div class="product-emoji-fallback" aria-hidden="true">${emoji}</div>`
      : `<div class="product-emoji-fallback">${emoji}</div>`;

    const footHTML = oos
      ? `<button class="btn-add" disabled aria-label="Out of stock">Out of Stock</button>`
      : qty > 0
        ? `<div class="qty-control" role="group" aria-label="Quantity for ${_esc(name)}">
             <button class="qty-btn" data-action="dec" data-id="${id}" aria-label="Decrease quantity">−</button>
             <span class="qty-num" aria-live="polite">${qty}</span>
             <button class="qty-btn" data-action="inc" data-id="${id}" aria-label="Increase quantity">+</button>
           </div>`
        : `<button class="btn-add" data-action="add" data-id="${id}" aria-label="Add ${_esc(name)} to cart">
             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
             Add
           </button>`;

    return `
    <article class="product-card" data-id="${id}" role="listitem">
      <div class="product-img-wrap">
        ${imgHTML}
        ${oos ? '<span class="out-of-stock-badge" aria-label="Out of stock">Sold Out</span>' : ''}
      </div>
      <div class="product-info">
        <p class="product-name">${_esc(name)}</p>
        ${nameAr ? `<p class="product-name-ar">${_esc(nameAr)}</p>` : ''}
        ${unit   ? `<p class="product-unit">${_esc(unit)}</p>`      : ''}
        <p class="product-price">${priceF}</p>
      </div>
      <div class="product-foot">${footHTML}</div>
    </article>`;
  }

  /* ─────────────────────────────────────────────────────────────
     CATEGORY SECTION (collapsible)
  ───────────────────────────────────────────────────────────── */
  const CAT_EMOJI = {
    Dairy:'🥛', Meat:'🥩', Frozen:'❄️', Groceries:'🌾', Cleaners:'🧹',
    Beverages:'🥤', Snacks:'🍿', Bakery:'🍞', Produce:'🥦', 'Search Results':'🔍',
  };

  function categorySection(catName, products, getQty) {
    const emoji = CAT_EMOJI[catName] || '📦';
    const cards = products.map(p => productCard(p, getQty(p.id))).join('');
    const i     = _sectionIdx++;

    return `
    <section class="cat-section" data-cat="${_esc(catName)}">
      <div class="cat-header" role="button" tabindex="0" aria-expanded="true" aria-controls="cat-grid-${i}" id="cat-hdr-${i}">
        <div class="cat-header-left">
          <span class="cat-emoji" aria-hidden="true">${emoji}</span>
          <span class="cat-name">${_esc(catName)}</span>
          <span class="cat-count">${products.length}</span>
        </div>
        <span class="cat-chevron" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </span>
      </div>
      <div class="cat-grid" id="cat-grid-${i}" role="list">${cards}</div>
    </section>`;
  }

  let _sectionIdx = 0;

  /* ─────────────────────────────────────────────────────────────
     PRODUCT FEED (full render)
  ───────────────────────────────────────────────────────────── */
  function renderFeed(grouped, getQtyFn) {
    _sectionIdx = 0;
    const feed  = document.getElementById('product-feed');
    const empty = document.getElementById('empty-state');

    if (!grouped || !Object.keys(grouped).length) {
      feed.innerHTML  = '';
      empty.classList.remove('hidden');
      return;
    }

    empty.classList.add('hidden');
    feed.innerHTML = Object.entries(grouped)
      .map(([cat, prods]) => categorySection(cat, prods, getQtyFn))
      .join('');

    observeImages(feed);
  }

  /* Update a single product card's footer control in-place */
  function updateCardControl(productId, qty) {
    const card = document.querySelector(`.product-card[data-id="${productId}"]`);
    if (!card) return;
    const product = DB.products.getById(productId);
    if (!product) return;
    const foot = card.querySelector('.product-foot');
    if (!foot) return;

    if (qty > 0) {
      foot.innerHTML = `<div class="qty-control" role="group" aria-label="Quantity">
        <button class="qty-btn" data-action="dec" data-id="${productId}" aria-label="Decrease">−</button>
        <span class="qty-num" aria-live="polite">${qty}</span>
        <button class="qty-btn" data-action="inc" data-id="${productId}" aria-label="Increase">+</button>
      </div>`;
    } else {
      foot.innerHTML = `<button class="btn-add" data-action="add" data-id="${productId}" aria-label="Add to cart">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Add
      </button>`;
    }
  }

  /* ─────────────────────────────────────────────────────────────
     CART DRAWER
  ───────────────────────────────────────────────────────────── */
  function renderCart(state) {
    const el     = document.getElementById('cart-items');
    const footer = document.getElementById('cart-footer');
    const badge  = document.getElementById('cart-badge');

    /* Badge */
    if (state.count > 0) {
      badge.textContent = state.count > 99 ? '99+' : state.count;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }

    if (state.isEmpty) {
      el.innerHTML = `
        <div class="cart-empty" role="status">
          <span class="cart-empty-ico">🛒</span>
          <p>Your cart is empty</p>
          <p style="font-size:12px;margin-top:4px;color:var(--gray-400)">Add items from the store to get started</p>
        </div>`;
      footer.innerHTML = '';
      return;
    }

    /* Items */
    el.innerHTML = state.items.map(item => {
      const lineTotal = (item.price * item.qty).toFixed(2);
      const imgEl     = item.imageURL
        ? `<img class="cart-item-img" src="${_esc(item.imageURL)}" alt="${_esc(item.name)}" loading="lazy" onerror="this.style.display='none'">`
        : `<div class="cart-item-img">${item.emoji}</div>`;

      return `
      <div class="cart-item" data-id="${item.id}">
        ${imgEl}
        <div class="cart-item-info">
          <p class="cart-item-name">${_esc(item.name)}</p>
          ${item.unit ? `<p class="cart-item-unit">${_esc(item.unit)}</p>` : ''}
          <p class="cart-item-price">AED ${lineTotal}</p>
        </div>
        <div class="cart-item-ctrl" role="group" aria-label="Quantity for ${_esc(item.name)}">
          <button class="ctrl-btn" data-cart-action="dec" data-id="${item.id}" aria-label="Decrease">−</button>
          <span class="ctrl-num" aria-live="polite">${item.qty}</span>
          <button class="ctrl-btn" data-cart-action="inc" data-id="${item.id}" aria-label="Increase">+</button>
        </div>
        <button class="cart-remove" data-cart-action="remove" data-id="${item.id}" aria-label="Remove ${_esc(item.name)}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        </button>
      </div>`;
    }).join('');

    /* Summary footer */
    footer.innerHTML = `
      <div class="order-summary">
        <div class="summary-row"><span>Subtotal (${state.count} item${state.count !== 1 ? 's' : ''})</span><span>AED ${state.subtotal.toFixed(2)}</span></div>
        <div class="summary-row"><span>Delivery</span><span style="color:var(--green-600)">${state.subtotal >= 150 ? 'Free' : 'TBD'}</span></div>
        <div class="summary-row total"><span>Total</span><span>AED ${state.subtotal.toFixed(2)}</span></div>
      </div>
      <button id="btn-checkout" class="btn-checkout">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m5 12 5 5L20 7"/></svg>
        Place Order
      </button>
      <button id="btn-clear-cart" class="btn-clear-cart">Clear cart</button>`;
  }

  /* ─────────────────────────────────────────────────────────────
     CHECKOUT SUMMARY (inside modal)
  ───────────────────────────────────────────────────────────── */
  function renderCheckoutSummary(state, promoResult) {
    const el = document.getElementById('checkout-summary');
    if (!el) return;

    let rows = `
      <div class="summary-row"><span>Subtotal</span><span>AED ${state.subtotal.toFixed(2)}</span></div>`;

    if (promoResult && promoResult.valid) {
      rows += `<div class="summary-row"><span style="color:var(--red-500)">Discount (${promoResult.discountPct}%)</span><span class="summary-discount">−AED ${promoResult.discountAmt.toFixed(2)}</span></div>`;
    }

    const total = promoResult?.valid ? promoResult.newTotal : state.subtotal;
    rows += `<div class="summary-row total"><span>Total</span><span>AED ${total.toFixed(2)}</span></div>`;
    el.innerHTML = rows;
  }

  /* ─────────────────────────────────────────────────────────────
     ORDERS VIEW
  ───────────────────────────────────────────────────────────── */
  function renderOrders(orders) {
    const el = document.getElementById('orders-list');
    if (!el) return;

    if (!orders.length) {
      el.innerHTML = `<div class="orders-empty"><p class="orders-empty-ico">📦</p><p>No orders placed yet.</p></div>`;
      return;
    }

    el.innerHTML = orders.map(o => {
      const itemSummary = o.items.map(i => `${i.emoji} ${i.name} ×${i.qty}`).join(', ');
      const statusClass = `status-${o.status}`;
      return `
      <div class="order-card">
        <div class="order-card-head">
          <span class="order-id">${o.id}</span>
          <span class="order-status ${statusClass}">${o.status}</span>
        </div>
        <p class="order-customer">${_esc(o.customerName)}</p>
        <p class="order-items">${_esc(itemSummary)}</p>
        <div class="order-footer">
          <span class="order-total">AED ${o.total.toFixed(2)}</span>
          <span class="order-date">${o.timestampFormatted}</span>
        </div>
      </div>`;
    }).join('');
  }

  /* ─────────────────────────────────────────────────────────────
     ADMIN: PRODUCT LIST
  ───────────────────────────────────────────────────────────── */
  function renderAdminProducts(products) {
    const el = document.getElementById('admin-product-list');
    if (!el) return;
    if (!products.length) {
      el.innerHTML = '<p style="color:var(--gray-400);font-size:14px;text-align:center;padding:24px">No products found.</p>';
      return;
    }
    el.innerHTML = products.map(p => `
      <div class="admin-product-item" data-id="${p.id}">
        <span class="admin-prod-emoji">${p.emoji || '🛒'}</span>
        <div class="admin-prod-info">
          <p class="admin-prod-name" title="${_esc(p.name)}">${_esc(p.name)}</p>
          <p class="admin-prod-meta">${_esc(p.category)} · ${p.unit || '—'}</p>
        </div>
        <span class="admin-prod-price" style="cursor:pointer;text-decoration:underline dotted" data-admin-action="edit-price" data-id="${p.id}" title="Click to edit price">AED ${p.price.toFixed(2)}</span>
        <div class="admin-prod-actions">
          <label class="toggle" title="${p.available ? 'Available – click to disable' : 'Disabled – click to enable'}">
            <input type="checkbox" data-admin-action="toggle" data-id="${p.id}" ${p.available ? 'checked' : ''} />
            <span class="toggle-slider"></span>
          </label>
          <button class="admin-del-btn" data-admin-action="delete" data-id="${p.id}" title="Delete" aria-label="Delete ${_esc(p.name)}">🗑</button>
        </div>
      </div>`).join('');
  }

  /* ─────────────────────────────────────────────────────────────
     ADMIN: ORDER LIST
  ───────────────────────────────────────────────────────────── */
  function renderAdminOrders(orders) {
    const el = document.getElementById('admin-orders-list');
    if (!el) return;
    if (!orders.length) {
      el.innerHTML = '<p style="color:var(--gray-400);font-size:14px;text-align:center;padding:24px">No orders yet.</p>';
      return;
    }
    const statuses = ['pending','confirmed','preparing','out-for-delivery','delivered','cancelled'];
    el.innerHTML = orders.map(o => `
      <div class="admin-order-item">
        <div class="admin-order-head">
          <span class="admin-order-id">${o.id}</span>
          <span class="admin-order-total">AED ${o.total.toFixed(2)}</span>
        </div>
        <p class="admin-order-cust">👤 ${_esc(o.customerName)} — 📞 ${_esc(o.phone)}</p>
        <p class="admin-order-meta">${o.timestampFormatted}${o.address ? ' · 📍 ' + _esc(o.address) : ''}</p>
        <p style="font-size:12px;color:var(--gray-500);margin-bottom:8px">${o.items.map(i => `${i.emoji} ${i.name} ×${i.qty}`).join(', ')}</p>
        <select class="admin-status-select" data-admin-action="status" data-id="${o.id}">
          ${statuses.map(s => `<option value="${s}" ${o.status === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </div>`).join('');
  }

  /* ─────────────────────────────────────────────────────────────
     TOAST
  ───────────────────────────────────────────────────────────── */
  let _toastTimer = null;

  function toast(msg, type = '', duration = 2800) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className   = `toast toast-${type}`;
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => el.classList.add('hidden'), duration);
  }

  /* ─────────────────────────────────────────────────────────────
     DRAWER / MODAL HELPERS
  ───────────────────────────────────────────────────────────── */
  function openDrawer(drawerId, overlayId) {
    const d = document.getElementById(drawerId);
    const o = document.getElementById(overlayId || 'overlay');
    if (d) d.classList.add('open');
    if (o) o.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeDrawer(drawerId, overlayId) {
    const d = document.getElementById(drawerId);
    const o = document.getElementById(overlayId || 'overlay');
    if (d) d.classList.remove('open');
    if (o) o.classList.add('hidden');
    document.body.style.overflow = '';
  }

  function openModal(modalId, overlayId) {
    const m = document.getElementById(modalId);
    const o = document.getElementById(overlayId);
    if (m) m.classList.remove('hidden');
    if (o) o.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeModal(modalId, overlayId) {
    const m = document.getElementById(modalId);
    const o = document.getElementById(overlayId);
    if (m) m.classList.add('hidden');
    if (o) o.classList.add('hidden');
    document.body.style.overflow = '';
  }

  /* ── internal HTML escape ── */
  function _esc(str) {
    return String(str ?? '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  /* Config form load/save helpers */
  function loadConfigForm() {
    const cfg = DB.config.get();
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
    set('cfg-phone',    cfg.storePhone);
    set('cfg-promo',    cfg.promoCode);
    set('cfg-discount', cfg.discountPct);
  }

  /* ─── UI.init — required by app.js ─── */
  function init() {
    initLazyLoad();
  }

  return {
    init,
    initLazyLoad, observeImages,
    renderFeed, updateCardControl,
    renderCart, renderCheckoutSummary,
    renderOrders,
    renderAdminProducts, renderAdminOrders,
    toast,
    openDrawer, closeDrawer, openModal, closeModal,
    loadConfigForm,
  };
})();
