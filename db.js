/**
 * Products     { id, name, nameAr, category, price, imageURL, unit, emoji, available, createdAt }
 * Orders       { id, customerName, phone, address, note, items[], subtotal, discountAmt, total,
 * discountCode, status, createdAt, timestampFormatted }
 * Config       { storePhone, promoCode, discountPct, adminPassword }
 *
 * PERMISSIONS:
 * ──────────────────────────────────────────────
 * Customers  → READ available products only (no direct DB access)
 * Admin      → FULL CRUD on products, READ/UPDATE orders, READ/WRITE config
 *
 * All admin writes go through _adminXxx() methods that require
 * DB.admin.isAuthenticated() === true. Customer code only calls
 * public read methods which enforce available:true filtering.
 */

'use strict';

const DB = (() => {
  /* ─── Storage keys ─── */
  const K = {
    PRODUCTS: 'dsm_products',
    ORDERS:   'dsm_orders',
    CONFIG:   'dsm_config',
    CART:     'dsm_cart',
    SESSION:  'dsm_admin_session',
  };

  /* ─── Helpers ─── */
  const read  = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };
  const uid   = () => 'p_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const ordId = () => 'ORD-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2,5).toUpperCase();

  const fmtDate = d => new Date(d).toLocaleString('en-AE', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  });

  /* ─────────────────────────────────────────────────────────────
     DEFAULT CONFIG (تم تعديل الرقم لعميلك في سوريا هنا)
  ───────────────────────────────────────────────────────────── */
  const DEFAULT_CONFIG = {
    storePhone:    '963965436980',  // تم التعديل للصيغة الدولية الصحيحة بدون أصفار زائدة
    promoCode:     'DUBAI10',
    discountPct:   10,
    adminPassword: 'admin123',
  };

  /* ─────────────────────────────────────────────────────────────
     SEED PRODUCTS  (39 items across 9 categories)
     Schema: id | name | nameAr | category | price | imageURL | unit | emoji | available
  ───────────────────────────────────────────────────────────── */
  const SEED_PRODUCTS = [
    /* ── Dairy ── */
    { id:'d1', name:'Full Fat Milk 1L',        nameAr:'حليب كامل الدسم ١ لتر',    category:'Dairy',    price:4.50,  imageURL:'', unit:'1L',     emoji:'🥛', available:true  },
    { id:'d2', name:'Fresh Yoghurt 500g',       nameAr:'زبادي طازج ٥٠٠ جرام',     category:'Dairy',    price:6.25,  imageURL:'', unit:'500g',   emoji:'🍶', available:true  },
    { id:'d3', name:'Cheddar Cheese 400g',      nameAr:'جبن شيدر ٤٠٠ جرام',        category:'Dairy',    price:18.75, imageURL:'', unit:'400g',   emoji:'🧀', available:true  },
    { id:'d4', name:'Labneh 500g',              nameAr:'لبنة ٥٠٠ جرام',            category:'Dairy',    price:9.00,  imageURL:'', unit:'500g',   emoji:'🫙', available:true  },
    { id:'d5', name:'Butter 200g',              nameAr:'زبدة ٢٠٠ جرام',            category:'Dairy',    price:11.50, imageURL:'', unit:'200g',   emoji:'🧈', available:false },
    /* ── Meat ── */
    { id:'m1', name:'Chicken Breast 1kg',       nameAr:'صدر دجاج ١ كيلو',          category:'Meat',      price:24.00, imageURL:'', unit:'1kg',     emoji:'🍗', available:true  },
    { id:'m2', name:'Lamb Chops 500g',          nameAr:'ضلوع خروف ٥٠٠ جرام',      category:'Meat',      price:38.00, imageURL:'', unit:'500g',   emoji:'🥩', available:true  },
    { id:'m3', name:'Minced Beef 500g',         nameAr:'لحم بقري مفروم ٥٠٠ جرام', category:'Meat',      price:27.50, imageURL:'', unit:'500g',   emoji:'🥩', available:true  },
    { id:'m4', name:'Whole Chicken ~1.5kg',     nameAr:'دجاجة كاملة ~١.٥ كيلو',   category:'Meat',      price:22.00, imageURL:'', unit:'~1.5kg', emoji:'🐔', available:true  },
    { id:'m5', name:'Salmon Fillet 300g',       nameAr:'فيليه سلمون ٣٠٠ جرام',    category:'Meat',      price:42.00, imageURL:'', unit:'300g',   emoji:'🐟', available:true  },
    /* ── Frozen ── */
    { id:'f1', name:'Frozen Peas 1kg',          nameAr:'بازلاء مجمدة ١ كيلو',      category:'Frozen',    price:8.50,  imageURL:'', unit:'1kg',     emoji:'❄️', available:true  },
    { id:'f2', name:'Chicken Nuggets 400g',     nameAr:'ناجتس دجاج ٤٠٠ جرام',     category:'Frozen',    price:16.00, imageURL:'', unit:'400g',   emoji:'🍗', available:true  },
    { id:'f3', name:'Mixed Vegetables 1kg',     nameAr:'خضار مشكلة مجمدة ١ كيلو', category:'Frozen',    price:11.25, imageURL:'', unit:'1kg',     emoji:'🥦', available:true  },
    { id:'f4', name:'Fish Fingers 400g',        nameAr:'أصابع سمك ٤٠٠ جرام',      category:'Frozen',    price:19.00, imageURL:'', unit:'400g',   emoji:'🐟', available:true  },
    /* ── Groceries ── */
    { id:'g1', name:'Basmati Rice 5kg',         nameAr:'أرز بسمتي ٥ كيلو',         category:'Groceries', price:32.00, imageURL:'', unit:'5kg',     emoji:'🌾', available:true  },
    { id:'g2', name:'Extra Virgin Olive Oil 1L',nameAr:'زيت زيتون بكر ممتاز ١ لتر',category:'Groceries', price:39.50, imageURL:'', unit:'1L',     emoji:'🫒', available:true  },
    { id:'g3', name:'Tomato Paste 400g',        nameAr:'معجون طماطم ٤٠٠ جرام',    category:'Groceries', price:5.75,  imageURL:'', unit:'400g',   emoji:'🍅', available:true  },
    { id:'g4', name:'Chickpeas 400g (canned)',  nameAr:'حمص معلب ٤٠٠ جرام',       category:'Groceries', price:4.50,  imageURL:'', unit:'400g',   emoji:'🥫', available:true  },
    { id:'g5', name:'Spaghetti 500g',           nameAr:'سباغيتي ٥٠٠ جرام',        category:'Groceries', price:6.00,  imageURL:'', unit:'500g',   emoji:'🍝', available:true  },
    { id:'g6', name:'All-Purpose Flour 1kg',    nameAr:'دقيق متعدد الأغراض ١ كيلو',category:'Groceries', price:5.25,  imageURL:'', unit:'1kg',     emoji:'🌾', available:true  },
    { id:'g7', name:'Sugar 2kg',                nameAr:'سكر ٢ كيلو',              category:'Groceries', price:7.50,  imageURL:'', unit:'2kg',     emoji:'🍬', available:true  },
    /* ── Cleaners ── */
    { id:'c1', name:'Dish Soap 750ml',          nameAr:'سائل غسيل الصحون ٧٥٠ مل',category:'Cleaners',  price:8.25,  imageURL:'', unit:'750ml',  emoji:'🧴', available:true  },
    { id:'c2', name:'Floor Cleaner 1L',         nameAr:'منظف أرضيات ١ لتر',       category:'Cleaners',  price:12.00, imageURL:'', unit:'1L',     emoji:'🧹', available:true  },
    { id:'c3', name:'Laundry Detergent 3kg',    nameAr:'مسحوق غسيل ٣ كيلو',      category:'Cleaners',  price:28.50, imageURL:'', unit:'3kg',     emoji:'🧺', available:true  },
    { id:'c4', name:'Multi-Surface Spray 500ml',nameAr:'بخاخ متعدد الأسطح ٥٠٠ مل',category:'Cleaners', price:9.75,  imageURL:'', unit:'500ml',  emoji:'🧽', available:true  },
    { id:'c5', name:'Bleach 1L',                nameAr:'كلور ١ لتر',              category:'Cleaners',  price:6.50,  imageURL:'', unit:'1L',     emoji:'🫧', available:true  },
    /* ── Beverages ── */
    { id:'b1', name:'Mineral Water 1.5L ×6',   nameAr:'مياه معدنية ١.٥ لتر × ٦', category:'Beverages', price:10.50, imageURL:'', unit:'6-pack', emoji:'💧', available:true  },
    { id:'b2', name:'Orange Juice 1L',          nameAr:'عصير برتقال ١ لتر',       category:'Beverages', price:9.25,  imageURL:'', unit:'1L',     emoji:'🍊', available:true  },
    { id:'b3', name:'Green Tea 25 bags',        nameAr:'شاي أخضر ٢٥ كيس',        category:'Beverages', price:14.00, imageURL:'', unit:'25 bags',emoji:'🍵', available:true  },
    { id:'b4', name:'Cola 330ml ×6',            nameAr:'كولا ٣٣٠ مل × ٦',        category:'Beverages', price:18.00, imageURL:'', unit:'6-pack', emoji:'🥤', available:true  },
    /* ── Snacks ── */
    { id:'s1', name:'Salted Chips 150g',        nameAr:'رقائق مملحة ١٥٠ جرام',   category:'Snacks',     price:5.50,  imageURL:'', unit:'150g',   emoji:'🍿', available:true  },
    { id:'s2', name:'Mixed Nuts 200g',          nameAr:'مكسرات مشكلة ٢٠٠ جرام', category:'Snacks',     price:19.50, imageURL:'', unit:'200g',   emoji:'🥜', available:true  },
    { id:'s3', name:'Dark Chocolate 100g',      nameAr:'شوكولاتة داكنة ١٠٠ جرام',category:'Snacks',     price:11.00, imageURL:'', unit:'100g',   emoji:'🍫', available:true  },
    { id:'s4', name:'Crackers 200g',            nameAr:'كراكر ٢٠٠ جرام',         category:'Snacks',     price:7.25,  imageURL:'', unit:'200g',   emoji:'🫙', available:true  },
    /* ── Bakery ── */
    { id:'bk1',name:'White Sandwich Bread',     nameAr:'خبز التوست الأبيض',       category:'Bakery',     price:4.75,  imageURL:'', unit:'700g',   emoji:'🍞', available:true  },
    { id:'bk2',name:'Croissants ×4',            nameAr:'كرواسون × ٤',             category:'Bakery',     price:12.00, imageURL:'', unit:'4 pcs',  emoji:'🥐', available:true  },
    { id:'bk3',name:'Arabic Flatbread 5 pcs',   nameAr:'خبز عربي ٥ قطع',         category:'Bakery',     price:3.50,  imageURL:'', unit:'5 pcs',  emoji:'🫓', available:true  },
    /* ── Produce ── */
    { id:'pr1',name:'Tomatoes 1kg',             nameAr:'طماطم ١ كيلو',           category:'Produce',   price:5.50,  imageURL:'', unit:'1kg',     emoji:'🍅', available:true  },
    { id:'pr2',name:'Bananas 1kg',              nameAr:'موز ١ كيلو',              category:'Produce',   price:4.25,  imageURL:'', unit:'1kg',     emoji:'🍌', available:true  },
    { id:'pr3',name:'Mixed Salad Leaves 200g',  nameAr:'خليط خضار للسلطة ٢٠٠ جرام',category:'Produce', price:8.00,  imageURL:'', unit:'200g',   emoji:'🥗', available:true  },
    { id:'pr4',name:'Cucumber ×3',              nameAr:'خيار × ٣',                category:'Produce',   price:3.75,  imageURL:'', unit:'3 pcs',  emoji:'🥒', available:true  },
  ];

  /* ─────────────────────────────────────────────────────────────
     INITIALISATION – seed on first run
  ───────────────────────────────────────────────────────────── */
  function init() {
    if (!read(K.PRODUCTS)) write(K.PRODUCTS, SEED_PRODUCTS);
    if (!read(K.ORDERS))   write(K.ORDERS, []);
    if (!read(K.CONFIG))   write(K.CONFIG, DEFAULT_CONFIG);
  }

  /* ─────────────────────────────────────────────────────────────
     ADMIN AUTH  (session-scoped, clears on tab/window close)
  ───────────────────────────────────────────────────────────── */
  const admin = {
    isAuthenticated() { return sessionStorage.getItem(K.SESSION) === '1'; },

    login(password) {
      const cfg = config.get();
      if (password === cfg.adminPassword) {
        sessionStorage.setItem(K.SESSION, '1');
        return true;
      }
      return false;
    },

    logout() { sessionStorage.removeItem(K.SESSION); },

    require() {
      if (!this.isAuthenticated()) throw new Error('Unauthorised: admin login required.');
    },
  };

  /* ─────────────────────────────────────────────────────────────
     CONFIG  (admin only for writes)
  ───────────────────────────────────────────────────────────── */
  const config = {
    get() { return { ...DEFAULT_CONFIG, ...(read(K.CONFIG) || {}) }; },

    /** Admin: update config fields */
    save(updates) {
      admin.require();
      const current = this.get();
      return write(K.CONFIG, { ...current, ...updates });
    },
  };

  /* ─────────────────────────────────────────────────────────────
     PRODUCTS
     Public methods: read-only, available=true enforced
     Admin methods: prefixed with _, require auth
  ───────────────────────────────────────────────────────────── */
  const products = {
    /* ── PUBLIC (customer-safe) ── */

    /** All available products for display */
    getAll() {
      return (read(K.PRODUCTS) || []).filter(p => p.available);
    },

    /** Grouped by category, sorted alphabetically within each */
    getGrouped() {
      const order = ['Dairy','Meat','Frozen','Groceries','Cleaners','Beverages','Snacks','Bakery','Produce'];
      const all   = this.getAll();
      const map   = {};
      all.forEach(p => { if (!map[p.category]) map[p.category] = []; map[p.category].push(p); });
      // Return in defined category order
      const result = {};
      order.forEach(c => { if (map[c]) result[c] = map[c]; });
      Object.keys(map).forEach(c => { if (!result[c]) result[c] = map[c]; }); // any extra cats
      return result;
    },

    /** Filter by category (available only) */
    byCategory(cat) {
      if (cat === 'all') return this.getGrouped();
      const prods = (read(K.PRODUCTS) || []).filter(p => p.available && p.category === cat);
      return prods.length ? { [cat]: prods } : {};
    },

    /** Search by name / arabic name / category (available only) */
    search(query) {
      const q = query.toLowerCase().trim();
      const matches = (read(K.PRODUCTS) || []).filter(p =>
        p.available && (
          p.name.toLowerCase().includes(q) ||
          (p.nameAr || '').includes(q) ||
          p.category.toLowerCase().includes(q)
        )
      );
      return matches.length ? { 'Search Results': matches } : {};
    },

    getById(id) {
      return (read(K.PRODUCTS) || []).find(p => p.id === id) || null;
    },

    /* ── ADMIN ONLY ── */

    /** All products including unavailable (admin view) */
    _adminGetAll() {
      admin.require();
      return read(K.PRODUCTS) || [];
    },

    /** Toggle availability */
    _adminToggle(id) {
      admin.require();
      const list = read(K.PRODUCTS) || [];
      const idx  = list.findIndex(p => p.id === id);
      if (idx < 0) return false;
      list[idx].available = !list[idx].available;
      return write(K.PRODUCTS, list);
    },

    /** Update price inline */
    _adminSetPrice(id, price) {
      admin.require();
      const list = read(K.PRODUCTS) || [];
      const idx  = list.findIndex(p => p.id === id);
      if (idx < 0) return false;
      list[idx].price = parseFloat(parseFloat(price).toFixed(2));
      return write(K.PRODUCTS, list);
    },

    /** Add a new product */
    _adminAdd(data) {
      admin.require();
      const { name, nameAr, category, price, imageURL, unit, emoji } = data;
      if (!name || !category || isNaN(parseFloat(price))) return null;
      const list = read(K.PRODUCTS) || [];
      const product = {
        id: uid(), name, nameAr: nameAr || '', category,
        price: parseFloat(parseFloat(price).toFixed(2)),
        imageURL: imageURL || '', unit: unit || '',
        emoji: emoji || '🛒', available: true,
        createdAt: new Date().toISOString(),
      };
      list.push(product);
      write(K.PRODUCTS, list);
      return product;
    },

    /** Delete a product */
    _adminDelete(id) {
      admin.require();
      const list = (read(K.PRODUCTS) || []).filter(p => p.id !== id);
      return write(K.PRODUCTS, list);
    },

    /** Update any fields */
    _adminUpdate(id, fields) {
      admin.require();
      const list = read(K.PRODUCTS) || [];
      const idx  = list.findIndex(p => p.id === id);
      if (idx < 0) return false;
      list[idx] = { ...list[idx], ...fields };
      return write(K.PRODUCTS, list);
    },
  };

  /* ─────────────────────────────────────────────────────────────
     ORDERS
  ───────────────────────────────────────────────────────────── */
  const orders = {
    getAll()    { return read(K.ORDERS) || []; },
    getById(id) { return (read(K.ORDERS) || []).find(o => o.id === id) || null; },

    /**
     * Create an order from a cart snapshot.
     * Validates input, applies promo discount, saves.
     */
    create({ customerName, phone, address, note, items, promoCode }) {
      if (!customerName || !phone || !items.length) return null;

      const cfg         = config.get();
      const subtotal    = items.reduce((s, i) => s + i.price * i.qty, 0);
      let   discountAmt = 0;
      let   usedCode    = '';

      if (promoCode && cfg.promoCode && promoCode.toUpperCase() === cfg.promoCode.toUpperCase()) {
        discountAmt = parseFloat((subtotal * cfg.discountPct / 100).toFixed(2));
        usedCode    = cfg.promoCode;
      }

      const total = parseFloat((subtotal - discountAmt).toFixed(2));
      const now   = new Date().toISOString();

      const order = {
        id: ordId(),
        customerName: customerName.trim(),
        phone:        phone.trim(),
        address:      (address || '').trim(),
        note:         (note    || '').trim(),
        items,                     // [{id, name, price, qty, unit, emoji}]
        subtotal:     parseFloat(subtotal.toFixed(2)),
        discountAmt,
        discountCode: usedCode,
        total,
        status:       'pending',
        createdAt:    now,
        timestampFormatted: fmtDate(now),
      };

      const list = read(K.ORDERS) || [];
      list.unshift(order);
      write(K.ORDERS, list);
      return order;
    },

    /** Admin: update status */
    _adminSetStatus(id, status) {
      admin.require();
      const list = read(K.ORDERS) || [];
      const idx  = list.findIndex(o => o.id === id);
      if (idx < 0) return false;
      list[idx].status = status;
      return write(K.ORDERS, list);
    },
  };

  /* ─────────────────────────────────────────────────────────────
     CART  (localStorage persistent)
  ───────────────────────────────────────────────────────────── */
  const cart = {
    _get()          { return read(K.CART) || []; },
    _set(items)     { write(K.CART, items); },

    getItems()      { return this._get(); },
    getCount()      { return this._get().reduce((s, i) => s + i.qty, 0); },
    getSubtotal()   { return this._get().reduce((s, i) => s + i.price * i.qty, 0); },

    findItem(productId) {
      return this._get().find(i => i.id === productId) || null;
    },

    /**
     * Add product to cart (or increment qty).
     * Returns new qty for this product.
     */
    add(product) {
      const items = this._get();
      const idx   = items.findIndex(i => i.id === product.id);
      if (idx >= 0) {
        items[idx].qty += 1;
      } else {
        items.push({
          id:    product.id,
          name:  product.name,
          price: product.price,
          unit:  product.unit  || '',
          emoji: product.emoji || '🛒',
          imageURL: product.imageURL || '',
          qty:   1,
        });
      }
      this._set(items);
      return idx >= 0 ? items[idx].qty : 1;
    },

    setQty(productId, qty) {
      if (qty <= 0) { this.remove(productId); return 0; }
      const items = this._get();
      const idx   = items.findIndex(i => i.id === productId);
      if (idx >= 0) { items[idx].qty = qty; this._set(items); return qty; }
      return 0;
    },

    increment(productId) {
      const items = this._get();
      const idx   = items.findIndex(i => i.id === productId);
      if (idx >= 0) { items[idx].qty += 1; this._set(items); return items[idx].qty; }
      return 0;
    },

    decrement(productId) {
      const items = this._get();
      const idx   = items.findIndex(i => i.id === productId);
      if (idx < 0) return 0;
      if (items[idx].qty <= 1) { this.remove(productId); return 0; }
      items[idx].qty -= 1;
      this._set(items);
      return items[idx].qty;
    },

    remove(productId) {
      this._set(this._get().filter(i => i.id !== productId));
    },

    clear() { this._set([]); },
  };

  /* ─────────────────────────────────────────────────────────────
     WHATSAPP MESSAGE BUILDER
  ───────────────────────────────────────────────────────────── */
  function buildWhatsAppMessage({ customerName, phone, address, note, items, subtotal, discountAmt, discountCode, total, orderId, timestamp }) {
    const line  = '─'.repeat(28);
    const parts = [
      `🛒 *New Order — Dubai Supermarket*`,
      `دبي سوبرماركت`,
      line,
      `📋 *Order ID:* ${orderId}`,
      `👤 *Name:* ${customerName}`,
      `📞 *Phone:* ${phone}`,
    ];
    if (address) parts.push(`📍 *Address:* ${address}`);
    parts.push(`🕐 *Time:* ${timestamp}`);
    parts.push(line);
    parts.push(`\n*ITEMS:*`);

    items.forEach((item, i) => {
      const lineTotal = (item.price * item.qty).toFixed(2);
      parts.push(
        `${i + 1}. ${item.emoji} ${item.name}`,
        `    Qty: ${item.qty} × AED ${item.price.toFixed(2)} = *AED ${lineTotal}*`
      );
    });

    parts.push(`\n${line}`);
    parts.push(`Subtotal:  AED ${subtotal.toFixed(2)}`);
    if (discountAmt > 0) {
      parts.push(`Discount (${discountCode}): −AED ${discountAmt.toFixed(2)}`);
    }
    parts.push(`*TOTAL:    AED ${total.toFixed(2)}*`);
    if (note) parts.push(`\n📝 *Note:* ${note}`);
    parts.push(`\n_Sent via Dubai Supermarket App_`);

    return parts.join('\n');
  }

  function sendViaWhatsApp(orderData) {
    const cfg  = config.get();
    const msg  = buildWhatsAppMessage(orderData);
    const url  = `https://wa.me/${cfg.storePhone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    return msg;
  }

  /* ─────────────────────────────────────────────────────────────
     FULL RESET (admin only)
  ───────────────────────────────────────────────────────────── */
  function resetAll() {
    admin.require();
    [K.PRODUCTS, K.ORDERS, K.CONFIG, K.CART].forEach(k => localStorage.removeItem(k));
    init();
  }

  /* Public API */
  return { init, admin, config, products, orders, cart, buildWhatsAppMessage, sendViaWhatsApp, resetAll, K };
})();
