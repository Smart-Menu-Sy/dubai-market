/**
 * db.js – Dubai Supermarket Data Layer
 *
 * SCHEMA (localStorage-backed, Supabase-ready):
 * ──────────────────────────────────────────────
 * Products  { id, name, nameAr, category, price, imageURL, unit, emoji, available, createdAt }
 * Orders    { id, customerName, phone, address, note, items[], subtotal, discountAmt, total,
 *             discountCode, status, createdAt, timestampFormatted }
 * Config    { storePhone, promoCode, discountPct, adminPassword }
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

  const fmtDate = d => new Date(d).toLocaleString('ar-SY', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  });

  const fmtPrice = (amount) => {
    const cfg = read(K.CONFIG) || DEFAULT_CONFIG;
    const sym = (cfg && cfg.currency) ? cfg.currency : 'ل.س';
    return `${amount.toLocaleString('ar-SY')} ${sym}`;
  };

  /* ─────────────────────────────────────────────────────────────
     DEFAULT CONFIG  — Syria / Damascus / Sahnaya
  ───────────────────────────────────────────────────────────── */
  const DEFAULT_CONFIG = {
    storePhone:    '963912345678',   // Syrian WhatsApp — update to real number
    promoCode:     'SYRIA10',
    discountPct:   10,
    adminPassword: 'admin123',
    currency:      'ل.س',            // Syrian Pound symbol
    storeName:     'سوبرماركت أشرفية صحنايا',
    storeAddress:  'أشرفية صحنايا، دمشق، سوريا',
  };

  /* ─────────────────────────────────────────────────────────────
     SEED PRODUCTS — Syria / Damascus / Ashrafi Sahnaya
     Prices in Syrian Pounds (ل.س)
  ───────────────────────────────────────────────────────────── */
  const SEED_PRODUCTS = [
    /* ── Dairy / ألبان ── */
    { id:'d1', name:'Full Fat Milk 1L',         nameAr:'حليب كامل الدسم ١ لتر',     category:'Dairy',     price:4500,   imageURL:'', unit:'١ لتر',      emoji:'🥛', available:true  },
    { id:'d2', name:'Fresh Yoghurt 500g',        nameAr:'لبن طازج ٥٠٠ جرام',         category:'Dairy',     price:3500,   imageURL:'', unit:'٥٠٠ جرام',   emoji:'🍶', available:true  },
    { id:'d3', name:'White Cheese 400g',         nameAr:'جبن أبيض ٤٠٠ جرام',         category:'Dairy',     price:9000,   imageURL:'', unit:'٤٠٠ جرام',   emoji:'🧀', available:true  },
    { id:'d4', name:'Labneh 500g',               nameAr:'لبنة ٥٠٠ جرام',             category:'Dairy',     price:5500,   imageURL:'', unit:'٥٠٠ جرام',   emoji:'🫙', available:true  },
    { id:'d5', name:'Butter 200g',               nameAr:'زبدة ٢٠٠ جرام',             category:'Dairy',     price:6500,   imageURL:'', unit:'٢٠٠ جرام',   emoji:'🧈', available:true  },
    { id:'d6', name:'Akkawi Cheese 250g',        nameAr:'جبن عكاوي ٢٥٠ جرام',        category:'Dairy',     price:7500,   imageURL:'', unit:'٢٥٠ جرام',   emoji:'🧀', available:true  },
    /* ── Meat / لحوم ── */
    { id:'m1', name:'Chicken Breast 1kg',        nameAr:'صدر دجاج ١ كيلو',           category:'Meat',      price:28000,  imageURL:'', unit:'١ كيلو',     emoji:'🍗', available:true  },
    { id:'m2', name:'Lamb Chops 500g',           nameAr:'ضلوع خروف ٥٠٠ جرام',        category:'Meat',      price:55000,  imageURL:'', unit:'٥٠٠ جرام',   emoji:'🥩', available:true  },
    { id:'m3', name:'Minced Beef 500g',          nameAr:'لحم بقري مفروم ٥٠٠ جرام',   category:'Meat',      price:38000,  imageURL:'', unit:'٥٠٠ جرام',   emoji:'🥩', available:true  },
    { id:'m4', name:'Whole Chicken ~1.5kg',      nameAr:'دجاجة كاملة ~١.٥ كيلو',    category:'Meat',      price:32000,  imageURL:'', unit:'~١.٥ كيلو',  emoji:'🐔', available:true  },
    { id:'m5', name:'Grilled Kofta 500g',        nameAr:'كفتة مشوية ٥٠٠ جرام',       category:'Meat',      price:35000,  imageURL:'', unit:'٥٠٠ جرام',   emoji:'🥩', available:true  },
    /* ── Frozen / مجمدات ── */
    { id:'f1', name:'Frozen Peas 1kg',           nameAr:'بازلاء مجمدة ١ كيلو',       category:'Frozen',    price:8000,   imageURL:'', unit:'١ كيلو',     emoji:'❄️', available:true  },
    { id:'f2', name:'Chicken Nuggets 400g',      nameAr:'ناجتس دجاج ٤٠٠ جرام',      category:'Frozen',    price:18000,  imageURL:'', unit:'٤٠٠ جرام',   emoji:'🍗', available:true  },
    { id:'f3', name:'Mixed Vegetables 1kg',      nameAr:'خضار مشكلة مجمدة ١ كيلو',  category:'Frozen',    price:11000,  imageURL:'', unit:'١ كيلو',     emoji:'🥦', available:true  },
    { id:'f4', name:'French Fries 1kg',          nameAr:'بطاطا مجمدة ١ كيلو',        category:'Frozen',    price:12000,  imageURL:'', unit:'١ كيلو',     emoji:'🍟', available:true  },
    /* ── Groceries / مؤن ── */
    { id:'g1', name:'Basmati Rice 5kg',          nameAr:'أرز بسمتي ٥ كيلو',          category:'Groceries', price:65000,  imageURL:'', unit:'٥ كيلو',     emoji:'🌾', available:true  },
    { id:'g2', name:'Olive Oil 1L',              nameAr:'زيت زيتون ١ لتر',           category:'Groceries', price:75000,  imageURL:'', unit:'١ لتر',      emoji:'🫒', available:true  },
    { id:'g3', name:'Tomato Paste 400g',         nameAr:'معجون بندورة ٤٠٠ جرام',     category:'Groceries', price:4000,   imageURL:'', unit:'٤٠٠ جرام',   emoji:'🍅', available:true  },
    { id:'g4', name:'Chickpeas 400g (canned)',   nameAr:'حمص معلب ٤٠٠ جرام',         category:'Groceries', price:3500,   imageURL:'', unit:'٤٠٠ جرام',   emoji:'🥫', available:true  },
    { id:'g5', name:'Spaghetti 500g',            nameAr:'معكرونة إسباغيتي ٥٠٠ جرام', category:'Groceries', price:5000,   imageURL:'', unit:'٥٠٠ جرام',   emoji:'🍝', available:true  },
    { id:'g6', name:'All-Purpose Flour 1kg',     nameAr:'دقيق متعدد الاستخدام ١ كيلو',category:'Groceries',price:4500,   imageURL:'', unit:'١ كيلو',     emoji:'🌾', available:true  },
    { id:'g7', name:'Sugar 2kg',                 nameAr:'سكر ٢ كيلو',                category:'Groceries', price:12000,  imageURL:'', unit:'٢ كيلو',     emoji:'🍬', available:true  },
    { id:'g8', name:'Freekeh 1kg',               nameAr:'فريكة ١ كيلو',              category:'Groceries', price:18000,  imageURL:'', unit:'١ كيلو',     emoji:'🌾', available:true  },
    { id:'g9', name:'Burghul 1kg',               nameAr:'برغل ١ كيلو',               category:'Groceries', price:9000,   imageURL:'', unit:'١ كيلو',     emoji:'🌾', available:true  },
    /* ── Cleaners / منظفات ── */
    { id:'c1', name:'Dish Soap 750ml',           nameAr:'سائل جلي الصحون ٧٥٠ مل',   category:'Cleaners',  price:5500,   imageURL:'', unit:'٧٥٠ مل',     emoji:'🧴', available:true  },
    { id:'c2', name:'Floor Cleaner 1L',          nameAr:'منظف أرضيات ١ لتر',         category:'Cleaners',  price:7500,   imageURL:'', unit:'١ لتر',      emoji:'🧹', available:true  },
    { id:'c3', name:'Laundry Detergent 3kg',     nameAr:'مسحوق غسيل ٣ كيلو',        category:'Cleaners',  price:28000,  imageURL:'', unit:'٣ كيلو',     emoji:'🧺', available:true  },
    { id:'c4', name:'Multi-Surface Spray 500ml', nameAr:'بخاخ متعدد الأسطح ٥٠٠ مل', category:'Cleaners',  price:8000,   imageURL:'', unit:'٥٠٠ مل',     emoji:'🧽', available:true  },
    { id:'c5', name:'Bleach 1L',                 nameAr:'كلور ١ لتر',                category:'Cleaners',  price:4000,   imageURL:'', unit:'١ لتر',      emoji:'🫧', available:true  },
    /* ── Beverages / مشروبات ── */
    { id:'b1', name:'Water 1.5L ×6',             nameAr:'مياه ١.٥ لتر × ٦',         category:'Beverages', price:9000,   imageURL:'', unit:'٦ حبات',     emoji:'💧', available:true  },
    { id:'b2', name:'Orange Juice 1L',           nameAr:'عصير برتقال ١ لتر',         category:'Beverages', price:12000,  imageURL:'', unit:'١ لتر',      emoji:'🍊', available:true  },
    { id:'b3', name:'Syrian Mate Tea',           nameAr:'ماتي سوري',                 category:'Beverages', price:15000,  imageURL:'', unit:'٥٠٠ جرام',   emoji:'🍵', available:true  },
    { id:'b4', name:'Cola 330ml ×6',             nameAr:'كولا ٣٣٠ مل × ٦',          category:'Beverages', price:14000,  imageURL:'', unit:'٦ علب',      emoji:'🥤', available:true  },
    /* ── Snacks / مشتريات ── */
    { id:'s1', name:'Salted Chips 150g',         nameAr:'رقائق مملحة ١٥٠ جرام',     category:'Snacks',    price:5000,   imageURL:'', unit:'١٥٠ جرام',   emoji:'🍿', available:true  },
    { id:'s2', name:'Mixed Nuts 200g',           nameAr:'مكسرات مشكلة ٢٠٠ جرام',    category:'Snacks',    price:22000,  imageURL:'', unit:'٢٠٠ جرام',   emoji:'🥜', available:true  },
    { id:'s3', name:'Syrian Baklava 250g',       nameAr:'بقلاوة سورية ٢٥٠ جرام',    category:'Snacks',    price:30000,  imageURL:'', unit:'٢٥٠ جرام',   emoji:'🍯', available:true  },
    { id:'s4', name:'Crackers 200g',             nameAr:'كراكر ٢٠٠ جرام',           category:'Snacks',    price:6000,   imageURL:'', unit:'٢٠٠ جرام',   emoji:'🫙', available:true  },
    /* ── Bakery / مخبوزات ── */
    { id:'bk1',name:'Arabic Bread Bundle',       nameAr:'خبز عربي (ربطة)',           category:'Bakery',    price:2500,   imageURL:'', unit:'١ ربطة',     emoji:'🫓', available:true  },
    { id:'bk2',name:'Syrian Kaak',               nameAr:'كعك سوري',                  category:'Bakery',    price:8000,   imageURL:'', unit:'٥٠٠ جرام',   emoji:'🍞', available:true  },
    { id:'bk3',name:'Toast Bread 600g',          nameAr:'خبز توست ٦٠٠ جرام',        category:'Bakery',    price:5500,   imageURL:'', unit:'٦٠٠ جرام',   emoji:'🍞', available:true  },
    /* ── Produce / خضار وفواكه ── */
    { id:'pr1',name:'Tomatoes 1kg',              nameAr:'بندورة ١ كيلو',             category:'Produce',   price:4000,   imageURL:'', unit:'١ كيلو',     emoji:'🍅', available:true  },
    { id:'pr2',name:'Bananas 1kg',               nameAr:'موز ١ كيلو',                category:'Produce',   price:6000,   imageURL:'', unit:'١ كيلو',     emoji:'🍌', available:true  },
    { id:'pr3',name:'Cucumber 1kg',              nameAr:'خيار ١ كيلو',               category:'Produce',   price:3000,   imageURL:'', unit:'١ كيلو',     emoji:'🥒', available:true  },
    { id:'pr4',name:'Potatoes 2kg',              nameAr:'بطاطا ٢ كيلو',              category:'Produce',   price:8000,   imageURL:'', unit:'٢ كيلو',     emoji:'🥔', available:true  },
    { id:'pr5',name:'Onions 1kg',                nameAr:'بصل ١ كيلو',                category:'Produce',   price:3500,   imageURL:'', unit:'١ كيلو',     emoji:'🧅', available:true  },
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
     WHATSAPP MESSAGE BUILDER — Syria / Damascus
  ───────────────────────────────────────────────────────────── */
  function buildWhatsAppMessage({ customerName, phone, address, note, items, subtotal, discountAmt, discountCode, total, orderId, timestamp }) {
    const line = '─'.repeat(28);
    const sym  = (read(K.CONFIG) || DEFAULT_CONFIG).currency || 'ل.س';
    const fmt  = n => `${n.toLocaleString('ar-SY')} ${sym}`;

    const parts = [
      `🛒 *طلب جديد — سوبرماركت أشرفية صحنايا*`,
      `أشرفية صحنايا، دمشق، سوريا`,
      line,
      `📋 *رقم الطلب:* ${orderId}`,
      `👤 *الاسم:*    ${customerName}`,
      `📞 *الهاتف:*   ${phone}`,
    ];
    if (address) parts.push(`📍 *العنوان:* ${address}`);
    parts.push(`🕐 *الوقت:*    ${timestamp}`);
    parts.push(line);
    parts.push(`\n*المنتجات:*`);

    items.forEach((item, i) => {
      const lineTotal = item.price * item.qty;
      parts.push(
        `${i + 1}. ${item.emoji} ${item.name}`,
        `   الكمية: ${item.qty} × ${fmt(item.price)} = *${fmt(lineTotal)}*`
      );
    });

    parts.push(`\n${line}`);
    parts.push(`المجموع الفرعي: ${fmt(subtotal)}`);
    if (discountAmt > 0) {
      parts.push(`الخصم (${discountCode}): −${fmt(discountAmt)}`);
    }
    parts.push(`*الإجمالي: ${fmt(total)}*`);
    if (note) parts.push(`\n📝 *ملاحظة:* ${note}`);
    parts.push(`\n_تم الإرسال عبر تطبيق سوبرماركت أشرفية صحنايا_`);

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
