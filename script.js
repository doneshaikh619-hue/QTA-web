(() => {
  document.documentElement.classList.add('js');

  // ==========================================
  // STATE MANAGEMENT (CART & OFFERS)
  // ==========================================
  const state = {
    cart: {
      items: [],
      orderType: 'delivery',
      promoCode: '',
      discount: 0,
      deliveryFee: 150
    },
    menuItems: [],
    categories: [],
    activeOffers: [],
    deferredPrompt: null
  };

  // Load persisted cart from localStorage
  try {
    const savedCart = localStorage.getItem('otaq_cart_v1');
    if (savedCart) {
      const parsed = JSON.parse(savedCart);
      if (Array.isArray(parsed.items)) {
        state.cart.items = parsed.items;
        state.cart.orderType = parsed.orderType || 'delivery';
        state.cart.promoCode = parsed.promoCode || '';
      }
    }
  } catch (e) {
    console.warn('Could not read saved cart:', e);
  }

  function saveCart() {
    try {
      localStorage.setItem('otaq_cart_v1', JSON.stringify({
        items: state.cart.items,
        orderType: state.cart.orderType,
        promoCode: state.cart.promoCode
      }));
    } catch (e) {}
  }

  // ==========================================
  // TOAST NOTIFICATIONS
  // ==========================================
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '⚠️';

    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      toast.style.transition = 'all .3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // ==========================================
  // MOBILE NAVIGATION
  // ==========================================
  const navToggle = document.querySelector('.nav-toggle');
  const nav = document.querySelector('#site-menu');
  const navLinks = [...document.querySelectorAll('#site-menu a')];

  if (navToggle && nav) {
    navToggle.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', String(open));
      const srOnly = navToggle.querySelector('.sr-only');
      if (srOnly) {
        srOnly.textContent = open ? 'Close navigation' : 'Open navigation';
      }
    });

    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        nav.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
        const srOnly = navToggle.querySelector('.sr-only');
        if (srOnly) {
          srOnly.textContent = 'Open navigation';
        }
      });
    });
  }

  // ==========================================
  // SCROLL REVEAL ANIMATIONS
  // ==========================================
  const revealNodes = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    revealNodes.forEach(node => observer.observe(node));
  } else {
    revealNodes.forEach(node => node.classList.add('is-visible'));
  }

  // ==========================================
  // CINEMATIC CLOUD PARTING TRANSITION
  // ==========================================
  const cloudWrap = document.querySelector('.cloud-canvas-wrap');
  if (cloudWrap && 'IntersectionObserver' in window) {
    const cloudObserver = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            cloudWrap.classList.add('parted');
          } else if (entry.boundingClientRect.top > window.innerHeight * 0.7) {
            cloudWrap.classList.remove('parted');
          }
        });
      },
      { threshold: 0.25 }
    );
    cloudObserver.observe(cloudWrap);
  }

  // ==========================================
  // DYNAMIC MENU LOADING & RENDERING
  // ==========================================
  const menuColumnsWrap = document.getElementById('menu-columns-wrap');

  async function loadMenuFromAPI() {
    try {
      const res = await fetch('/api/menu');
      if (!res.ok) throw new Error('API offline');
      const data = await res.json();
      if (data.success && data.items && data.items.length > 0) {
        state.menuItems = data.items;
        state.categories = data.categories || [];
        renderDynamicMenuColumns(data.categories, data.items);
      } else {
        renderDefaultMenuColumns();
      }
    } catch (err) {
      console.log('Serving offline cached/default menu items.');
      renderDefaultMenuColumns();
    }
  }

  function renderDynamicMenuColumns(categories, items) {
    if (!menuColumnsWrap) return;
    menuColumnsWrap.innerHTML = '';

    categories.forEach(cat => {
      const catItems = items.filter(it => it.category_id === cat.id);
      if (catItems.length === 0) return;

      const col = document.createElement('div');
      col.className = 'menu-column';
      col.dataset.category = cat.slug;

      let itemsHtml = `
        <div class="column-title">
          <span>${cat.name}</span>
          <small>${cat.description || 'Authentic kitchen specialty'}</small>
        </div>
      `;

      catItems.forEach(it => {
        const hasHalf = it.half_price && parseFloat(it.half_price) > 0;
        const priceLabel = hasHalf
          ? `Rs ${parseInt(it.half_price).toLocaleString()} / ${parseInt(it.price).toLocaleString()}`
          : `Rs ${parseInt(it.price).toLocaleString()}`;

        itemsHtml += `
          <div class="item-row" data-id="${it.id}">
            <div class="item-info">
              <span class="item-name">${it.name}</span>
              ${it.description ? `<span class="item-desc">${it.description}</span>` : ''}
            </div>
            <div class="item-actions">
              <b>${priceLabel}</b>
              ${hasHalf ? `
                <button type="button" class="item-add-btn btn-add-variant" data-id="${it.id}" data-name="${it.name}" data-price="${it.half_price}" data-variant="Half">+ Half</button>
                <button type="button" class="item-add-btn btn-add-variant" data-id="${it.id}" data-name="${it.name}" data-price="${it.price}" data-variant="Full">+ Full</button>
              ` : `
                <button type="button" class="item-add-btn btn-add-regular" data-id="${it.id}" data-name="${it.name}" data-price="${it.price}">+ Add</button>
              `}
            </div>
          </div>
        `;
      });

      col.innerHTML = itemsHtml;
      menuColumnsWrap.appendChild(col);
    });

    bindMenuAddButtons();
  }

  function renderDefaultMenuColumns() {
    // Fallback if API is unavailable during initial render
    const defaultCategories = [
      {
        slug: 'bbq', title: 'BBQ Specialties', desc: 'Charcoal grilled kebabs & tikkas',
        items: [
          { id: 1, name: 'Otaq Special Chest Tikka', price: 550 },
          { id: 2, name: 'Chicken Tikka (Leg)', price: 500 },
          { id: 3, name: 'Chicken Green Tikka', price: 600 },
          { id: 4, name: 'Chicken Malai Tikka', price: 600 },
          { id: 5, name: 'Chicken Bihari Tikka', price: 800 },
          { id: 6, name: 'Kalmi Tikka', price: 1200 },
          { id: 7, name: 'Chicken Balochit Tikka', price: 1600 },
          { id: 8, name: 'Chicken Bihari Botti', price: 1120 },
          { id: 9, name: 'Chicken Malai Botti', price: 900 },
          { id: 10, name: 'Reshmi Kabab', price: 800 },
          { id: 11, name: 'Chicken Cheese Kabab', price: 1000 },
          { id: 12, name: 'Chicken Gola Kabab', price: 800 },
          { id: 13, name: 'Beef Bihari Botti', price: 800 },
          { id: 14, name: 'Beef Seekh Kabab', price: 900 },
          { id: 15, name: 'Mutton Namkeen Botti', price: 2200 },
          { id: 16, name: 'Grilled Batair', price: 1800 }
        ]
      },
      {
        slug: 'karahi', title: 'Desi Karahi & Handi', desc: 'Desi Ghee & Fresh Claypot Handis',
        items: [
          { id: 17, name: 'Desi Chicken Special Karahi', price: 4000, half: 2000 },
          { id: 18, name: 'Desi Chicken Shahi Karahi', price: 3600, half: 1850 },
          { id: 19, name: 'Desi Chicken White Karahi', price: 3600, half: 1850 },
          { id: 20, name: 'Desi Chicken Green Karahi', price: 3600, half: 1850 },
          { id: 21, name: 'Desi Chicken Brown Karahi', price: 3500, half: 1800 },
          { id: 22, name: 'Desi Chicken Peshawari Karahi', price: 3400, half: 1750 },
          { id: 23, name: 'Desi Chicken Sizzler Karahi', price: 3400, half: 1750 },
          { id: 24, name: 'Desi Chicken Zaitoon Karahi', price: 3800, half: 2000 },
          { id: 25, name: 'Mutton Special Karahi (Desi Ghee)', price: 4500, half: 2300 },
          { id: 26, name: 'Mutton Shahi Karahi', price: 3800, half: 2000 },
          { id: 27, name: 'Mutton White Karahi', price: 3500, half: 1850 },
          { id: 28, name: 'Special Chicken Makhni Handi', price: 2600, half: 1300 },
          { id: 29, name: 'Special Chicken Reshmi Handi', price: 2400, half: 1300 },
          { id: 30, name: 'Chicken Handi', price: 2000, half: 1100 },
          { id: 31, name: 'Chicken Jalfrezi Handi', price: 2600, half: 1300 },
          { id: 32, name: 'Malai Kofta Handi', price: 2800, half: 1500 },
          { id: 33, name: 'Chicken Achari Handi', price: 2200, half: 1100 }
        ]
      },
      {
        slug: 'chinese', title: 'Chinese & Pulao', desc: 'Wok tossed gravies & fragrant rice',
        items: [
          { id: 34, name: 'Sindhi Desi Pulao', price: 1400 },
          { id: 35, name: 'Kabuli Pulao', price: 1200 },
          { id: 36, name: 'Chicken Shashlik with Rice', price: 1200 },
          { id: 37, name: 'Chicken Manchurian with Rice', price: 1000 },
          { id: 38, name: 'Chicken Chilly Dry with Rice', price: 1250 },
          { id: 39, name: 'Chicken Dragon with Rice', price: 1250 },
          { id: 40, name: 'Beef Chili Dry with Rice', price: 1500 },
          { id: 41, name: 'Plain Rice', price: 300 },
          { id: 42, name: 'Chicken Fried Rice', price: 480 },
          { id: 43, name: 'Egg Fried Rice', price: 500 },
          { id: 44, name: 'Singaporean Rice', price: 800 },
          { id: 45, name: 'Chicken Chowmein', price: 1200 },
          { id: 46, name: 'Alfredo Pasta', price: 1200 }
        ]
      },
      {
        slug: 'veg', title: 'Vegetables · Roti · Tea', desc: 'Fresh tandoori breads & chai',
        items: [
          { id: 47, name: 'Mix Vegetable', price: 400 },
          { id: 48, name: 'Dal Makhani', price: 550 },
          { id: 49, name: 'Beh Saag (Seasonal)', price: 500 },
          { id: 50, name: 'Bhindi Fry', price: 450 },
          { id: 51, name: 'Roghani / Garlic / Ginger Naan', price: 85 },
          { id: 52, name: 'Cheese Naan', price: 350 },
          { id: 53, name: 'Doodh Pati Chai', price: 170 },
          { id: 54, name: 'Koila Chai / Gurr Chai', price: 190 },
          { id: 55, name: 'Kashmiri Chai', price: 600 },
          { id: 56, name: 'Cold Coffee', price: 440 }
        ]
      }
    ];

    if (!menuColumnsWrap) return;
    menuColumnsWrap.innerHTML = '';

    defaultCategories.forEach(cat => {
      const col = document.createElement('div');
      col.className = 'menu-column';
      col.dataset.category = cat.slug;

      let html = `
        <div class="column-title">
          <span>${cat.title}</span>
          <small>${cat.desc}</small>
        </div>
      `;

      cat.items.forEach(it => {
        const hasHalf = it.half;
        const priceLabel = hasHalf
          ? `Rs ${it.half.toLocaleString()} / ${it.price.toLocaleString()}`
          : `Rs ${it.price.toLocaleString()}`;

        html += `
          <div class="item-row" data-id="${it.id}">
            <div class="item-info">
              <span class="item-name">${it.name}</span>
            </div>
            <div class="item-actions">
              <b>${priceLabel}</b>
              ${hasHalf ? `
                <button type="button" class="item-add-btn btn-add-variant" data-id="${it.id}" data-name="${it.name}" data-price="${it.half}" data-variant="Half">+ Half</button>
                <button type="button" class="item-add-btn btn-add-variant" data-id="${it.id}" data-name="${it.name}" data-price="${it.price}" data-variant="Full">+ Full</button>
              ` : `
                <button type="button" class="item-add-btn btn-add-regular" data-id="${it.id}" data-name="${it.name}" data-price="${it.price}">+ Add</button>
              `}
            </div>
          </div>
        `;
      });

      col.innerHTML = html;
      menuColumnsWrap.appendChild(col);
    });

    bindMenuAddButtons();
  }

  // ==========================================
  // MENU FILTER TABS
  // ==========================================
  const tabs = [...document.querySelectorAll('.menu-tab')];
  const applyFilter = filter => {
    const menuBlocks = [...document.querySelectorAll('.menu-column')];
    const featureCards = [...document.querySelectorAll('.menu-card')];

    menuBlocks.forEach(block => {
      block.hidden = filter !== 'all' && block.dataset.category !== filter;
    });

    featureCards.forEach(card => {
      card.hidden = filter !== 'all' && card.dataset.category !== filter;
    });
  };

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(item => {
        const active = item === tab;
        item.classList.toggle('is-active', active);
        item.setAttribute('aria-selected', String(active));
      });
      applyFilter(tab.dataset.filter);
    });
  });

  // ==========================================
  // CART DRAWER LOGIC & UI UPDATES
  // ==========================================
  const cartDrawer = document.getElementById('cart-drawer');
  const cartBackdrop = document.getElementById('cart-backdrop');
  const headerCartBtn = document.getElementById('header-cart-btn');
  const mobileCartBtn = document.getElementById('mobile-cart-btn');
  const cartCloseBtn = document.getElementById('cart-close-btn');
  const cartCountBadge = document.getElementById('cart-count-badge');
  const mobileCartBadge = document.getElementById('mobile-cart-badge');
  const headerCartTotal = document.getElementById('header-cart-total');
  const drawerItemsCount = document.getElementById('drawer-items-count');
  const cartItemsList = document.getElementById('cart-items-list');

  const cartSubtotalEl = document.getElementById('cart-subtotal');
  const cartDiscountEl = document.getElementById('cart-discount');
  const discountRow = document.getElementById('summary-discount-row');
  const cartDeliveryFeeEl = document.getElementById('cart-delivery-fee');
  const deliveryRow = document.getElementById('summary-delivery-row');
  const cartGrandTotalEl = document.getElementById('cart-grand-total');
  const btnTotalPreview = document.getElementById('btn-total-preview');
  const deliveryAddressGroup = document.getElementById('delivery-address-group');
  const custAddressInput = document.getElementById('cust-address');

  function openCartDrawer() {
    if (cartDrawer && cartBackdrop) {
      cartDrawer.classList.add('open');
      cartBackdrop.classList.add('open');
      cartDrawer.setAttribute('aria-hidden', 'false');
      cartBackdrop.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }
  }

  function closeCartDrawer() {
    if (cartDrawer && cartBackdrop) {
      cartDrawer.classList.remove('open');
      cartBackdrop.classList.remove('open');
      cartDrawer.setAttribute('aria-hidden', 'true');
      cartBackdrop.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }
  }

  if (headerCartBtn) headerCartBtn.addEventListener('click', openCartDrawer);
  if (mobileCartBtn) mobileCartBtn.addEventListener('click', openCartDrawer);
  if (cartCloseBtn) cartCloseBtn.addEventListener('click', closeCartDrawer);
  if (cartBackdrop) cartBackdrop.addEventListener('click', closeCartDrawer);

  // Order Type Tabs
  const typeBtns = [...document.querySelectorAll('.order-type-tabs .type-btn')];
  typeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      typeBtns.forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      state.cart.orderType = btn.dataset.type;

      if (state.cart.orderType === 'delivery') {
        state.cart.deliveryFee = 150;
        if (deliveryAddressGroup) deliveryAddressGroup.style.display = 'block';
        if (custAddressInput) custAddressInput.required = true;
      } else {
        state.cart.deliveryFee = 0;
        if (deliveryAddressGroup) deliveryAddressGroup.style.display = 'none';
        if (custAddressInput) custAddressInput.required = false;
      }

      saveCart();
      updateCartUI();
    });
  });

  // Add Item to Cart
  function addItemToCart(id, name, price, variant = 'Regular') {
    const numId = parseInt(id, 10);
    const numPrice = parseFloat(price);

    const existingIndex = state.cart.items.findIndex(
      it => it.id === numId && it.variant === variant
    );

    if (existingIndex > -1) {
      state.cart.items[existingIndex].quantity += 1;
    } else {
      state.cart.items.push({
        id: numId,
        name: name,
        price: numPrice,
        variant: variant,
        quantity: 1
      });
    }

    saveCart();
    updateCartUI();
    showToast(`Added "${name} ${variant !== 'Regular' ? `(${variant})` : ''}" to cart!`, 'success');
  }

  // Bind Buttons
  function bindMenuAddButtons() {
    // Featured cards
    document.querySelectorAll('.menu-card .add-to-cart-btn').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.id;
        const name = btn.dataset.name;
        const hasVariants = btn.dataset.hasVariants === 'true';
        if (hasVariants) {
          // Default to Half or Full
          addItemToCart(id, name, btn.dataset.halfPrice || btn.dataset.price, 'Half');
        } else {
          addItemToCart(id, name, btn.dataset.price, 'Regular');
        }
      };
    });

    // Column item rows
    document.querySelectorAll('.btn-add-regular').forEach(btn => {
      btn.onclick = () => {
        addItemToCart(btn.dataset.id, btn.dataset.name, btn.dataset.price, 'Regular');
      };
    });

    document.querySelectorAll('.btn-add-variant').forEach(btn => {
      btn.onclick = () => {
        addItemToCart(btn.dataset.id, btn.dataset.name, btn.dataset.price, btn.dataset.variant);
      };
    });
  }

  // Update Cart UI
  function updateCartUI() {
    const items = state.cart.items;
    const totalCount = items.reduce((sum, it) => sum + it.quantity, 0);

    if (cartCountBadge) cartCountBadge.textContent = totalCount;
    if (mobileCartBadge) mobileCartBadge.textContent = totalCount;
    if (drawerItemsCount) drawerItemsCount.textContent = `${totalCount} item${totalCount === 1 ? '' : 's'}`;

    // Compute Subtotal
    const subtotal = items.reduce((sum, it) => sum + (it.price * it.quantity), 0);
    const discount = state.cart.discount || 0;
    const deliveryFee = items.length > 0 ? state.cart.deliveryFee : 0;
    const grandTotal = Math.max(0, subtotal - discount + deliveryFee);

    if (headerCartTotal) headerCartTotal.textContent = `Rs ${subtotal.toLocaleString()}`;
    if (cartSubtotalEl) cartSubtotalEl.textContent = `Rs ${subtotal.toLocaleString()}`;
    if (cartDeliveryFeeEl) cartDeliveryFeeEl.textContent = deliveryFee > 0 ? `Rs ${deliveryFee.toLocaleString()}` : 'Free';
    if (cartGrandTotalEl) cartGrandTotalEl.textContent = `Rs ${grandTotal.toLocaleString()}`;
    if (btnTotalPreview) btnTotalPreview.textContent = `Rs ${grandTotal.toLocaleString()}`;

    if (discount > 0) {
      if (discountRow) discountRow.style.display = 'flex';
      if (cartDiscountEl) cartDiscountEl.textContent = `-Rs ${discount.toLocaleString()}`;
    } else {
      if (discountRow) discountRow.style.display = 'none';
    }

    // Render Items
    if (!cartItemsList) return;
    if (items.length === 0) {
      cartItemsList.innerHTML = `
        <div class="cart-empty-state">
          <div class="empty-icon">🍽️</div>
          <strong>Your order is empty</strong>
          <p style="font-size:12px;margin-top:6px;">Select delicious karahi, charcoal BBQ or tea from our menu to start your feast.</p>
        </div>
      `;
      return;
    }

    cartItemsList.innerHTML = items.map((it, idx) => `
      <div class="cart-item-row" data-index="${idx}">
        <div class="cart-item-details">
          <div class="cart-item-title">${it.name}</div>
          <div class="cart-item-variant">${it.variant !== 'Regular' ? `Portion: ${it.variant} · ` : ''}Rs ${it.price.toLocaleString()} each</div>
          <div class="cart-item-price">Rs ${(it.price * it.quantity).toLocaleString()}</div>
        </div>
        <div class="cart-qty-controls">
          <button type="button" class="qty-btn btn-qty-minus" data-index="${idx}" aria-label="Decrease quantity">−</button>
          <span class="qty-value">${it.quantity}</span>
          <button type="button" class="qty-btn btn-qty-plus" data-index="${idx}" aria-label="Increase quantity">+</button>
        </div>
        <button type="button" class="cart-item-del" data-index="${idx}" aria-label="Remove item">&times;</button>
      </div>
    `).join('');

    // Attach listeners
    cartItemsList.querySelectorAll('.btn-qty-minus').forEach(btn => {
      btn.onclick = () => {
        const idx = parseInt(btn.dataset.index, 10);
        if (state.cart.items[idx].quantity > 1) {
          state.cart.items[idx].quantity -= 1;
        } else {
          state.cart.items.splice(idx, 1);
        }
        saveCart();
        updateCartUI();
      };
    });

    cartItemsList.querySelectorAll('.btn-qty-plus').forEach(btn => {
      btn.onclick = () => {
        const idx = parseInt(btn.dataset.index, 10);
        state.cart.items[idx].quantity += 1;
        saveCart();
        updateCartUI();
      };
    });

    cartItemsList.querySelectorAll('.cart-item-del').forEach(btn => {
      btn.onclick = () => {
        const idx = parseInt(btn.dataset.index, 10);
        const removed = state.cart.items.splice(idx, 1);
        saveCart();
        updateCartUI();
        if (removed.length > 0) showToast(`Removed "${removed[0].name}"`, 'info');
      };
    });
  }

  // Promo Code Application
  const promoInput = document.getElementById('promo-input');
  const btnApplyPromo = document.getElementById('btn-apply-promo');
  const promoFeedback = document.getElementById('promo-feedback');

  function applyPromoCode(code) {
    if (!code) return;
    const cleanCode = code.trim().toUpperCase();
    const subtotal = state.cart.items.reduce((sum, it) => sum + (it.price * it.quantity), 0);

    if (subtotal === 0) {
      if (promoFeedback) {
        promoFeedback.className = 'promo-feedback error';
        promoFeedback.textContent = 'Please add items to cart before applying promo.';
      }
      return;
    }

    // Check against offers
    const offer = state.activeOffers.find(o => o.promo_code.toUpperCase() === cleanCode) ||
      (cleanCode === 'JOHAR15' ? { promo_code: 'JOHAR15', discount_percent: 15, min_order_amount: 2500 } : null);

    if (!offer) {
      if (promoFeedback) {
        promoFeedback.className = 'promo-feedback error';
        promoFeedback.textContent = 'Invalid promo code. Please check spelling.';
      }
      state.cart.discount = 0;
      state.cart.promoCode = '';
      updateCartUI();
      return;
    }

    if (subtotal < (parseFloat(offer.min_order_amount) || 0)) {
      if (promoFeedback) {
        promoFeedback.className = 'promo-feedback error';
        promoFeedback.textContent = `Promo requires minimum order of Rs ${parseFloat(offer.min_order_amount).toLocaleString()}.`;
      }
      state.cart.discount = 0;
      updateCartUI();
      return;
    }

    const discountAmount = Math.round((subtotal * parseFloat(offer.discount_percent)) / 100);
    state.cart.discount = discountAmount;
    state.cart.promoCode = cleanCode;

    if (promoFeedback) {
      promoFeedback.className = 'promo-feedback success';
      promoFeedback.textContent = `✓ Code ${cleanCode} applied! Saved Rs ${discountAmount.toLocaleString()} (${offer.discount_percent}% off).`;
    }
    showToast(`Promo applied: ${offer.discount_percent}% discount!`, 'success');
    updateCartUI();
  }

  if (btnApplyPromo && promoInput) {
    btnApplyPromo.addEventListener('click', () => applyPromoCode(promoInput.value));
  }

  // ==========================================
  // CHECKOUT FORM & ORDER PLACEMENT
  // ==========================================
  const checkoutForm = document.getElementById('checkout-form');
  const btnPlaceOrder = document.getElementById('btn-place-order');
  const orderModalBackdrop = document.getElementById('order-modal-backdrop');
  const confirmedOrderNumber = document.getElementById('confirmed-order-number');
  const orderModalDetails = document.getElementById('order-modal-details');
  const btnCloseOrderModal = document.getElementById('btn-close-order-modal');

  if (checkoutForm) {
    checkoutForm.addEventListener('submit', async e => {
      e.preventDefault();

      if (state.cart.items.length === 0) {
        showToast('Your order cart is empty! Please add items.', 'error');
        return;
      }

      const name = document.getElementById('cust-name').value.trim();
      const phone = document.getElementById('cust-phone').value.trim();
      const address = custAddressInput ? custAddressInput.value.trim() : '';
      const notes = document.getElementById('cust-notes') ? document.getElementById('cust-notes').value.trim() : '';

      if (!name) {
        showToast('Please enter your full name.', 'error');
        return;
      }
      if (!phone || phone.length < 9) {
        showToast('Please enter a valid phone number.', 'error');
        return;
      }
      if (state.cart.orderType === 'delivery' && (!address || address.length < 5)) {
        showToast('Please enter your full delivery address in Karachi.', 'error');
        return;
      }

      // Lock button
      btnPlaceOrder.disabled = true;
      const originalText = btnPlaceOrder.querySelector('.btn-text').textContent;
      btnPlaceOrder.querySelector('.btn-text').textContent = 'Confirming Feast...';

      try {
        const orderPayload = {
          customer: { name, phone, address },
          orderType: state.cart.orderType,
          items: state.cart.items.map(it => ({
            id: it.id,
            variant: it.variant,
            quantity: it.quantity
          })),
          promoCode: state.cart.promoCode,
          specialInstructions: notes
        };

        let data = null;
        try {
          const res = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderPayload)
          });
          if (res.ok) {
            data = await res.json();
          }
        } catch (netErr) {
          console.warn('Backend offline, using static local fallback:', netErr);
        }

        if (!data || !data.success) {
          // Fallback for static hosting / GitHub Pages
          const today = new Date();
          const datePart = today.toISOString().slice(2, 10).replace(/-/g, '');
          const randPart = Math.floor(1000 + Math.random() * 9000);
          const demoOrderNum = `OTAQ-${datePart}-${randPart}`;
          const subtotal = state.cart.items.reduce((s, it) => s + (it.price * it.quantity), 0);
          const deliveryFee = state.cart.orderType === 'delivery' ? state.cart.deliveryFee : 0;
          const total = Math.max(0, subtotal - state.cart.discount + deliveryFee);

          data = {
            success: true,
            orderNumber: demoOrderNum,
            orderType: state.cart.orderType,
            itemsCount: state.cart.items.reduce((s, it) => s + it.quantity, 0),
            discount: state.cart.discount,
            deliveryFee: deliveryFee,
            total: total
          };

          try {
            const stored = JSON.parse(localStorage.getItem('otaq_demo_orders') || '[]');
            stored.unshift({
              id: Date.now(),
              order_number: demoOrderNum,
              customer_name: name,
              customer_phone: phone,
              delivery_address: address,
              order_type: state.cart.orderType,
              subtotal,
              discount_amount: state.cart.discount,
              delivery_fee: deliveryFee,
              total_amount: total,
              status: 'pending',
              created_at: new Date().toISOString(),
              items: state.cart.items.map(it => ({
                item_name: it.name,
                variant_name: it.variant,
                quantity: it.quantity,
                unit_price: it.price,
                subtotal: it.price * it.quantity
              }))
            });
            localStorage.setItem('otaq_demo_orders', JSON.stringify(stored.slice(0, 50)));
          } catch (e) {}
        }

        // Show confirmation modal
        if (confirmedOrderNumber) confirmedOrderNumber.textContent = data.orderNumber;
        if (orderModalDetails) {
          orderModalDetails.innerHTML = `
            <div><strong>Recipient:</strong> ${name} (${phone})</div>
            <div><strong>Order Type:</strong> ${data.orderType.toUpperCase()}</div>
            <div><strong>Items Ordered:</strong> ${data.itemsCount} dishes</div>
            ${data.discount > 0 ? `<div><strong>Discount Saved:</strong> Rs ${data.discount.toLocaleString()}</div>` : ''}
            ${data.deliveryFee > 0 ? `<div><strong>Delivery Fee:</strong> Rs ${data.deliveryFee.toLocaleString()}</div>` : ''}
            <div style="font-size:14px;color:#d6a961;font-weight:700;margin-top:8px;">Total to Pay (Cash on Delivery): Rs ${data.total.toLocaleString()}</div>
          `;
        }

        // Clear cart
        state.cart.items = [];
        state.cart.discount = 0;
        state.cart.promoCode = '';
        saveCart();
        updateCartUI();
        closeCartDrawer();

        if (orderModalBackdrop) {
          orderModalBackdrop.classList.add('open');
          orderModalBackdrop.setAttribute('aria-hidden', 'false');
        }

        showToast(`Order ${data.orderNumber} placed successfully!`, 'success');
      } catch (err) {
        showToast(err.message || 'Error processing order. Please retry.', 'error');
      } finally {
        btnPlaceOrder.disabled = false;
        btnPlaceOrder.querySelector('.btn-text').textContent = originalText;
      }
    });
  }

  if (btnCloseOrderModal && orderModalBackdrop) {
    btnCloseOrderModal.addEventListener('click', () => {
      orderModalBackdrop.classList.remove('open');
      orderModalBackdrop.setAttribute('aria-hidden', 'true');
    });
  }

  // ==========================================
  // TABLE RESERVATION FORM
  // ==========================================
  const resForm = document.getElementById('reservation-form');
  const resStatusMsg = document.getElementById('res-status-msg');
  const btnSubmitRes = document.getElementById('btn-submit-res');

  // Set default date to today
  const resDateInput = document.getElementById('res-date');
  if (resDateInput) {
    const todayStr = new Date().toISOString().split('T')[0];
    resDateInput.value = todayStr;
    resDateInput.min = todayStr;
  }

  if (resForm) {
    resForm.addEventListener('submit', async e => {
      e.preventDefault();

      const name = document.getElementById('res-name').value.trim();
      const phone = document.getElementById('res-phone').value.trim();
      const date = document.getElementById('res-date').value;
      const time = document.getElementById('res-time').value;
      const guests = document.getElementById('res-guests').value;
      const seating = document.getElementById('res-seating').value;
      const notes = document.getElementById('res-notes').value.trim();

      if (!name || !phone || !date || !time) {
        if (resStatusMsg) {
          resStatusMsg.className = 'form-status-msg error';
          resStatusMsg.textContent = 'Please fill out your name, phone number, and reservation date.';
        }
        return;
      }

      btnSubmitRes.disabled = true;
      btnSubmitRes.querySelector('span').textContent = 'Confirming Table...';

      let data = null;
      try {
        const res = await fetch('/api/reservations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerName: name,
            customerPhone: phone,
            date,
            time,
            guestsCount: guests,
            seatingArea: seating,
            specialRequests: notes
          })
        });
        if (res.ok) {
          data = await res.json();
        }
      } catch (netErr) {
        console.warn('Backend offline, using static local reservation fallback:', netErr);
      }

      if (!data || !data.success) {
        data = { success: true };
        try {
          const stored = JSON.parse(localStorage.getItem('otaq_demo_reservations') || '[]');
          stored.unshift({
            id: Date.now(),
            customer_name: name,
            customer_phone: phone,
            reservation_date: date,
            reservation_time: time,
            guests_count: guests,
            seating_area: seating,
            special_requests: notes,
            status: 'confirmed',
            created_at: new Date().toISOString()
          });
          localStorage.setItem('otaq_demo_reservations', JSON.stringify(stored.slice(0, 50)));
        } catch (e) {}
      }

      if (resStatusMsg) {
        resStatusMsg.className = 'form-status-msg success';
        resStatusMsg.textContent = `✓ Table reserved for ${name} on ${date} at ${time}! We will WhatsApp confirmation shortly.`;
      }
      showToast('Table booked successfully! See you at OTAQ.', 'success');
      resForm.reset();
      if (resDateInput) resDateInput.value = new Date().toISOString().split('T')[0];

      btnSubmitRes.disabled = false;
      btnSubmitRes.querySelector('span').textContent = 'Confirm Table Reservation';
    });
  }

  // ==========================================
  // ACTIVE OFFERS RIBBON & INITIALIZATION
  // ==========================================
  async function loadActiveOffers() {
    try {
      const res = await fetch('/api/offers');
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && data.offers && data.offers.length > 0) {
        state.activeOffers = data.offers;
        const offer = data.offers[0];
        const ribbon = document.getElementById('offers-ribbon');
        const ribbonText = document.getElementById('ribbon-text');
        const ribbonCode = document.getElementById('ribbon-code');
        const ribbonApplyBtn = document.getElementById('ribbon-apply-btn');

        if (ribbon && ribbonText) {
          ribbonText.innerHTML = `${offer.title}: Use code <strong class="copyable-code" id="ribbon-code">${offer.promo_code}</strong> for ${offer.discount_percent}% off orders above Rs ${parseFloat(offer.min_order_amount || 0).toLocaleString()}!`;
          ribbon.style.display = 'block';

          if (ribbonApplyBtn) {
            ribbonApplyBtn.onclick = () => {
              if (promoInput) promoInput.value = offer.promo_code;
              openCartDrawer();
              applyPromoCode(offer.promo_code);
            };
          }
        }
      }
    } catch (e) {}
  }

  const ribbonCloseBtn = document.getElementById('ribbon-close-btn');
  if (ribbonCloseBtn) {
    ribbonCloseBtn.addEventListener('click', () => {
      const ribbon = document.getElementById('offers-ribbon');
      if (ribbon) ribbon.style.display = 'none';
    });
  }

  // ==========================================
  // PWA SERVICE WORKER & VIP APP INSTALL / NOTIFICATIONS
  // ==========================================
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then(reg => console.log('PWA Service Worker registered:', reg.scope))
        .catch(err => console.log('Service Worker registration skipped:', err));
    });
  }

  const vipBackdrop = document.getElementById('vip-install-backdrop');
  const btnCloseVip = document.getElementById('btn-close-vip-modal');
  const btnVipInstall = document.getElementById('btn-vip-install');
  const btnVipNotify = document.getElementById('btn-vip-notify');
  const vipInstructions = document.getElementById('vip-instructions');
  const floatingAppTrigger = document.getElementById('floating-app-trigger');
  const footerInstallBtn = document.getElementById('footer-install-btn');

  function openVipModal() {
    if (vipBackdrop) {
      vipBackdrop.classList.add('open');
      vipBackdrop.setAttribute('aria-hidden', 'false');
    }
  }

  function closeVipModal() {
    if (vipBackdrop) {
      vipBackdrop.classList.remove('open');
      vipBackdrop.setAttribute('aria-hidden', 'true');
    }
  }

  if (btnCloseVip) btnCloseVip.addEventListener('click', () => {
    closeVipModal();
    sessionStorage.setItem('otaq_vip_dismissed', 'true');
  });

  if (floatingAppTrigger) floatingAppTrigger.addEventListener('click', openVipModal);
  if (footerInstallBtn) footerInstallBtn.addEventListener('click', openVipModal);

  // Auto show VIP install prompt after 1.5s if mobile / QR visitor
  window.addEventListener('load', () => {
    const isMobile = window.innerWidth <= 768 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const dismissed = sessionStorage.getItem('otaq_vip_dismissed');
    if (isMobile && !dismissed) {
      setTimeout(openVipModal, 1600);
    }
  });

  // Capture beforeinstallprompt for Chrome Android
  let installRequested = false;

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    state.deferredPrompt = e;
    console.log('beforeinstallprompt captured!');
    if (installRequested) {
      triggerNativeInstall();
    }
  });

  async function triggerNativeInstall() {
    if (state.deferredPrompt) {
      try {
        state.deferredPrompt.prompt();
        const { outcome } = await state.deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          showToast('🎉 OTAQ App successfully installed to your phone screen!', 'success');
          closeVipModal();
        }
        state.deferredPrompt = null;
        installRequested = false;
        return true;
      } catch (err) {
        console.warn('Install prompt error:', err);
      }
    }
    return false;
  }

  // Handle App Download / Install
  if (btnVipInstall) {
    btnVipInstall.addEventListener('click', async () => {
      if (state.deferredPrompt) {
        await triggerNativeInstall();
        return;
      }

      installRequested = true;
      showToast('Opening app installer for your mobile...', 'info');

      setTimeout(async () => {
        if (state.deferredPrompt) {
          await triggerNativeInstall();
        } else {
          const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
          const iosEl = document.getElementById('inst-ios');
          const androidEl = document.getElementById('inst-android');
          if (isIOS) {
            if (iosEl) iosEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            showToast('Tap Share (⎋) at bottom of Safari ➔ "Add to Home Screen" ➕', 'info');
          } else {
            if (androidEl) androidEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            showToast('Tap 3 dots (⋮) at top right ➔ "Install app" 📲', 'info');
          }
        }
      }, 350);
    });
  }

  // Direct Download Launcher Button
  const btnDownloadShortcut = document.getElementById('btn-download-shortcut');
  if (btnDownloadShortcut) {
    btnDownloadShortcut.addEventListener('click', () => {
      try {
        const fullUrl = window.location.href;
        const shortcutContent = `[InternetShortcut]\r\nURL=${fullUrl}\r\nIconIndex=0\r\nIconFile=${window.location.origin}/assets/icon-192.png\r\n`;
        const blob = new Blob([shortcutContent], { type: 'application/octet-stream' });
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = 'OTAQ-Restaurant.url';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(downloadUrl);
        showToast('📥 OTAQ App Shortcut downloaded! Tap to launch.', 'success');
      } catch (e) {
        showToast('Could not generate download file.', 'error');
      }
    });
  }

  // Soft Web Audio chime
  function playNotificationSound() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    } catch (e) {}
  }

  // Real-time notification trigger
  function showLiveNotification(title, body) {
    playNotificationSound();
    if ('Notification' in window && Notification.permission === 'granted') {
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'SHOW_NOTIFICATION',
          title: title,
          body: body
        });
      } else {
        try {
          new Notification(title, {
            body: body,
            icon: 'assets/icon-192.png'
          });
        } catch (e) {}
      }
    }
    showToast(`🔔 ${title}: ${body}`, 'success');
  }

  // Request Notification Permission
  if (btnVipNotify) {
    // Check if already granted
    if ('Notification' in window && Notification.permission === 'granted') {
      btnVipNotify.innerHTML = '<span>✅ VIP Notifications Active</span>';
      btnVipNotify.style.borderColor = '#48bb78';
    }

    btnVipNotify.addEventListener('click', async () => {
      if (!('Notification' in window)) {
        showToast('Push notifications not supported on this browser.', 'error');
        return;
      }

      try {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') {
          btnVipNotify.innerHTML = '<span>✅ VIP Notifications Active</span>';
          btnVipNotify.style.borderColor = '#48bb78';
          localStorage.setItem('otaq_push_active', 'true');
          showLiveNotification('🎉 Welcome to OTAQ VIP Club!', 'Notifications enabled! You will now receive secret deals and kitchen order alerts.');
        } else {
          showToast('Notification permission was dismissed.', 'info');
        }
      } catch (err) {
        showToast('Could not enable notifications.', 'error');
      }
    });
  }

  // Cross-tab & Admin Live Push Broadcast Listener
  const pushChannel = 'BroadcastChannel' in window ? new BroadcastChannel('otaq_push_channel') : null;
  if (pushChannel) {
    pushChannel.onmessage = e => {
      if (e.data && e.data.title) {
        showLiveNotification(e.data.title, e.data.body || 'Special dining alert from OTAQ!');
      }
    };
  }

  window.addEventListener('storage', e => {
    if (e.key === 'otaq_broadcast_push' && e.newValue) {
      try {
        const data = JSON.parse(e.newValue);
        showLiveNotification(data.title, data.body || 'Special dining alert from OTAQ!');
      } catch (err) {}
    }
  });

  // ==========================================
  // YEAR & SMOOTH SCROLL
  // ==========================================
  const yearEl = document.querySelector('#year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', event => {
      const id = anchor.getAttribute('href');
      if (!id || id === '#') return;
      const target = document.querySelector(id);
      if (!target) return;

      event.preventDefault();
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  });

  // Highlight Active Nav
  const sections = [...document.querySelectorAll('main section[id]')];
  const sectionLinks = navLinks.filter(link => link.getAttribute('href')?.startsWith('#'));

  if ('IntersectionObserver' in window && sections.length && sectionLinks.length) {
    const sectionObserver = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          sectionLinks.forEach(link => link.removeAttribute('aria-current'));
          const active = sectionLinks.find(link => link.getAttribute('href') === `#${entry.target.id}`);
          if (active) active.setAttribute('aria-current', 'true');
        });
      },
      { rootMargin: '-35% 0px -55% 0px' }
    );
    sections.forEach(section => sectionObserver.observe(section));
  }

  // Initialize
  loadMenuFromAPI();
  loadActiveOffers();
  updateCartUI();
})();