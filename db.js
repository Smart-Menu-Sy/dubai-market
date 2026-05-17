/**
 * Products      { id, name, nameAr, category, price, imageURL, unit, emoji, available, createdAt }
 * Orders        { id, customerName, phone, address, note, items[], subtotal, discountAmt, total,
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
    PRODUCTS: 'dsm_products_sy',
    ORDERS:   'dsm_orders_sy',
    CONFIG:   'dsm_config_sy',
    CART:     'dsm_cart_sy',
    SESSION:  'dsm_admin_session_sy',
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

  /* ─────────────────────────────────────────────────────────────
     DEFAULT CONFIG (الإعدادات الافتراضية المخصصة لسوريا والعملة المحلية)
  ───────────────────────────────────────────────────────────── */
  const DEFAULT_CONFIG = {
    storePhone:    '963965436980',  // الرقم الدولي الصحيح بدون أصفار زائدة للواتساب
    promoCode:     'DUBAI10',
    discountPct:   10,
    adminPassword: 'admin123',
    currencyAr:    'ل.س',
    currencyEn:    'SP'
  };

  /* ─────────────────────────────────────────────────────────────
     SEED PRODUCTS  (المنتجات الافتراضية بأسعار تقريبية بالليرة السورية ل.س)
     Schema: id | name | nameAr | category | price | imageURL | unit | emoji | available
  ───────────────────────────────────────────────────────────── */
  const SEED_PRODUCTS = [
    /* ── Dairy (الأجبان والألبان) ── */
    { id:'d1', name:'Full Fat Milk 1L',        nameAr:'حليب كامل الدسم ١ لتر',    category:'Dairy',    price:11000,  imageURL:'', unit:'1L',     emoji:'🥛', available:true  },
    { id:'d2', name:'Fresh Yoghurt 1kg',       nameAr:'لبن رائب طازج ١ كيلو',     category:'Dairy',    price:9500,   imageURL:'', unit:'1kg',    emoji:'🍶', available:true  },
    { id:'d3', name:'Local White Cheese 1kg',  nameAr:'جبنة بيضاء بلدية ١ كيلو',  category:'Dairy',    price:36000,  imageURL:'', unit:'1kg',    emoji:'🧀', available:true  },
    { id:'d4', name:'Labneh البلدية 500g',       nameAr:'لبنة بلدية مصفاة ٥٠٠ غ',   category:'Dairy',    price:16000,  imageURL:'', unit:'500g',   emoji:'🫙', available:true  },
    { id:'d5', name:'Butter 200g',              nameAr:'زبدة لورباك ٢٠٠ جرام',     category:'Dairy',    price:32000,  imageURL:'', unit:'200g',   emoji:'🧈', available:true },
    
    /* ── Meat (اللحوم والدواجن) ── */
    { id:'m1', name:'Chicken Breast 1kg',       nameAr:'شرحات صدر دجاج ١ كيلو',     category:'Meat',     price:62000,  imageURL:'', unit:'1kg',     emoji:'🍗', available:true  },
    { id:'m2', name:'Lamb Meat 1kg',           nameAr:'لحم خروف بلدي ١ كيلو',     category:'Meat',     price:185000, imageURL:'', unit:'1kg',    emoji:'🥩', available:true  },
    { id:'m3', name:'Minced Beef 1kg',          nameAr:'لحم عجورة مفروم ١ كيلو',   category:'Meat',     price:140000, imageURL:'', unit:'1kg',    emoji:'🥩', available:true  },
    { id:'m4', name:'Whole Chicken ~1.5kg',     nameAr:'فروج كامل منظف ~١.٥ كيلو', category:'Meat',     price:48000,  imageURL:'', unit:'~1.5kg',  emoji:'🐔', available:true  },
    
    /* ── Frozen (المجمدات) ── */
    { id:'f1', name:'Frozen Peas 1kg',          nameAr:'بازلاء مجمدة ١ كيلو',      category:'Frozen',    price:18000,  imageURL:'', unit:'1kg',     emoji:'❄️', available:true  },
    { id:'f2', name:'Chicken Nuggets 400g',     nameAr:'ناجتس دجاج ٤٠٠ جرام',     category:'Frozen',    price:34000,  imageURL:'', unit:'400g',    emoji:'🍗', available:true  },
    { id:'f3', name:'Mixed Vegetables 1kg',     nameAr:'خضار مشكلة مجمدة ١ كيلو',  category:'Frozen',    price:16500,  imageURL:'', unit:'1kg',     emoji:'🥦', available:true  },
    
    /* ── Groceries (المواد الغذائية) ── */
    { id:'g1', name:'Basmati Rice 1kg',          nameAr:'أرز بسمتي كبسة ١ كيلو',    category:'Groceries', price:24000,  imageURL:'', unit:'1kg',     emoji:'🌾', available:true  },
    { id:'g2', name:'Sunflower Oil 1L',         nameAr:'زيت عباد الشمس ١ لتر',     category:'Groceries', price:26000,  imageURL:'', unit:'1L',      emoji:'🫗', available:true  },
    { id:'g3', name:'Olive Oil 1L',             nameAr:'زيت زيتون بكر ممتاز ١ لتر', category:'Groceries', price:75000,  imageURL:'', unit:'1L',      emoji:'🫒', available:true  },
    { id:'g4', name:'Tomato Paste 400g',        nameAr:'دبس طماطم علب ٤٠٠ غ',     category:'Groceries', price:11000,  imageURL:'', unit:'400g',    emoji:'🍅', available:true  },
    { id:'g5', name:'Spaghetti 500g',           nameAr:'معكرونة سباغيتي ٥٠٠ غ',    category:'Groceries', price:8500,   imageURL:'', unit:'500g',    emoji:'🍝', available:true  },
    { id:'g6', name:'Sugar 1kg',                nameAr:'سكر أبيض ناعم ١ كيلو',     category:'Groceries', price:14000,  imageURL:'', unit:'1kg',     emoji:'🍬', available:true  },
    { id:'g7', name:'Turkish Coffee 250g',      nameAr:'بن قهوة تركي ٢٥٠ غ',       category:'Groceries', price:38000,  imageURL:'', unit:'250g',    emoji:'☕', available:true  },
    
    /* ── Cleaners (المنظفات) ── */
    { id:'c1', name:'Dish Soap 1L',             nameAr:'سائل جلي وفير ١ لتر',      category:'Cleaners',  price:14000,  imageURL:'', unit:'1L',      emoji:'🧴', available:true  },
    { id:'c2', name:'Floor Cleaner 1L',         nameAr:'منظف أرضيات وعطور ١ لتر',  category:'Cleaners',  price:12500,  imageURL:'', unit:'1L',      emoji:'🧹', available:true  },
    { id:'c3', name:'Laundry Detergent 3kg',    nameAr:'مسحوق غسيل نورا ٣ كيلو',   category:'Cleaners',  price:58000,  imageURL:'', unit:'3kg',     emoji:'🧺', available:true  },
    { id:'c4', name:'Bleach 1L',                nameAr:'كلور تبييض سائل ١ لتر',     category:'Cleaners',  price:7000,   imageURL:'', unit:'1L',      emoji:'🫧', available:true  },
    
    /* ── Beverages (المشروبات) ── */
    { id:'b1', name:'Mineral Water 1.5L',       nameAr:'باقة مياه معدنية بقين ٦ قطع',category:'Beverages', price:19500,  imageURL:'', unit:'6-pack',  emoji:'💧', available:true  },
    { id:'b2', name:'Mate Kharta 250g',         nameAr:'متة الخارطة الخضراء ٢٥٠ غ', category:'Beverages', price:24000,  imageURL:'', unit:'250g',    emoji:'🧉', available:true  },
    { id:'b3', name:'Black Tea 100 bags',       nameAr:'شاي توليب ظرف ١٠٠ لبتون',  category:'Beverages', price:32000,  imageURL:'', unit:'100 bags',emoji:'🍵', available:true  },
    
    /* ── Snacks (التسالي) ── */
    { id:'s1', name:'Potato Chips Family',      nameAr:'شيبس بطاطا ظرف عائلي',     category:'Snacks',    price:6500,   imageURL:'', unit:'1 pcs',   emoji:'🍿', available:true  },
    { id:'s2', name:'Mixed Nuts 500g',          nameAr:'مكسرات مشكلة فواشات نصف كيلو',category:'Snacks',  price:45000,  imageURL:'', unit:'500g',    emoji:'🥜', available:true  },
    { id:'s3', name:'Biscuit Chocolate',        nameAr:'بسكويت مغطس بالشوكولاتة',  category:'Snacks',    price:3500,   imageURL:'', unit:'1 pcs',   emoji:'🍫', available:true  },
    
    /* ── Bakery (المخبوزات) ── */
    { id:'bk1',name:'Toast Bread',              nameAr:'خبز توست طازج قالب',       category:'Bakery',    price:9000,   imageURL:'', unit:'700g',    emoji:'🍞', available:true  },
    { id:'bk2',name:'Croissants ×4',            nameAr:'كرواسون شوكولاتة ٤ قطع',   category:'Bakery',    price:14000,  imageURL:'', unit:'4 pcs',   emoji:'🥐', available:true  },
    
    /* ── Produce (الخضار والفواكه) ── */
    { id:'pr1',name:'Tomatoes 1kg',             nameAr:'طماطم (بندورة) بلدي ١ كيلو', category:'Produce',   price:6500,   imageURL:'', unit:'1kg',     emoji:'🍅', available:true  },
    { id:'pr2',name:'Bananas 1kg',              nameAr:'موز صومالي طازج ١ كيلو',    category:'Produce',   price:22000,  imageURL:'', unit:'1kg',     emoji:'🍌', available:true  },
    { id:'pr3',name:'Cucumber 1kg',             nameAr:'خيار بلدي طازج ١ كيلو',     category:'Produce',   price:5000,   imageURL:'', unit:'1kg',     emoji:'🥒', available:true  },
    { id:'pr4',name:'Potatoes 1kg',             nameAr:'بطاطا مخصصة للقلي ١ كيلو',  category:'Produce',   price:7500,   imageURL:'', unit:'1kg',     emoji:'🥔', available:true  }
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
      return matches.length ? { 'نتائج البحث': matches } : {};
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
      list[idx].price = Math.round(parseFloat(price));
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
        price: Math.round(parseFloat(price)),
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
     */
    create({ customerName, phone, address, note, items, promoCode }) {
      if (!customerName || !phone || !items.length) return null;

      const cfg         = config.get();
      const subtotal    = items.reduce((s, i) => s + i.price * i.qty, 0);
      let   discountAmt = 0;
      let   usedCode    = '';

      if (promoCode && cfg.promoCode && promoCode.toUpperCase() === cfg.promoCode.toUpperCase()) {
        discountAmt = Math.round(subtotal * cfg.discountPct / 100);
        usedCode    = cfg.promoCode;
      }

      const total = Math.round(subtotal - discountAmt);
      const now   = new Date().toISOString();

      const order = {
        id: ordId(),
        customerName: customerName.trim(),
        phone:        phone.trim(),
        address:      (address || '').trim(),
        note:         (note    || '').trim(),
        items,                     // [{id, name, nameAr, price, qty, unit, emoji}]
        subtotal:     Math.round(subtotal),
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
     CART
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

    add(product) {
      const items = this._get();
      const idx   = items.findIndex(i => i.id === product.id);
      if (idx >= 0) {
        items[idx].qty += 1;
      } else {
        items.push({
          id:       product.id,
          name:     product.name,
          nameAr:   product.nameAr || product.name,
          price:    product.price,
          unit:     product.unit  || '',
          emoji:    product.emoji || '🛒',
          imageURL: product.imageURL || '',
          qty:      1,
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
     WHATSAPP MESSAGE BUILDER (مكتوبة بالعربية المتكاملة لخدمة زبائن الماركت في الشام)
  ───────────────────────────────────────────────────────────── */
  function buildWhatsAppMessage({ customerName, phone, address, note, items, subtotal, discountAmt, discountCode, total, orderId, timestamp }) {
    const line  = '═'.repeat(25);
    const parts = [
      `🛒 *طلب جديد — دبي سوبرماركت*`,
      `📍 دمشق - أشرفية صحنايا (مقابل حديقة سندباد)`,
      line,
      `📋 *رقم الطلب:* ${orderId}`,
      `👤 *الاسم:* ${customerName}`,
      `📞 *رقم التواصل:* ${phone}`,
    ];
    if (address) parts.push(`📍 *العنوان:* ${address}`);
    parts.push(`🕐 *التاريخ:* ${timestamp}`);
    parts.push(line);
    parts.push(`📦 *المنتجات المطلوبة:*`);

    items.forEach((item, i) => {
      const lineTotal = (item.price * item.qty).toLocaleString('ar-SY');
      const itemTitle = item.nameAr || item.name;
      parts.push(
        `${i + 1}. ${item.emoji} *${itemTitle}*`,
        `   الكمية: ${item.qty} × ${item.price.toLocaleString('ar-SY')} = *${lineTotal} ل.س*`
      );
    });

    parts.push(`\n${line}`);
    parts.push(`الفاتورة الجزئية: ${subtotal.toLocaleString('ar-SY')} ل.س`);
    if (discountAmt > 0) {
      parts.push(`قيمة الخصم (${discountCode}): −${discountAmt.toLocaleString('ar-SY')} ل.س`);
    }
    parts.push(`💰 *الإجمالي النهائي: ${total.toLocaleString('ar-SY')} ل.س*`);
    if (note) parts.push(`\n📝 *ملاحظات الزبون:* ${note}`);
    parts.push(`\n_أُرسل عبر تطبيق دبي سوبرماركت الذكي_`);

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
