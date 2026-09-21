(() => {
  let authToken = localStorage.getItem('otaq_admin_token') || null;
  let currentView = 'overview';
  let menuCache = [];
  let pollInterval = null;

  // Helper for admin toasts
  function showAdminToast(message, type = 'info') {
    const container = document.getElementById('admin-toast-container');
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
    }, 3200);
  }

  // API helper with Authorization header
  // Static / GitHub Pages offline handler
  function handleStaticApi(endpoint, options = {}) {
    const method = (options.method || 'GET').toUpperCase();
    const url = endpoint.split('?')[0];

    // Seed mock orders if empty
    let orders = JSON.parse(localStorage.getItem('otaq_demo_orders') || '[]');
    if (orders.length === 0) {
      orders = [
        {
          id: 101,
          order_number: 'OTAQ-260921-8492',
          customer_name: 'Farhan Qureshi',
          customer_phone: '03001234567',
          delivery_address: 'Block 10, Gulistan-e-Johar',
          order_type: 'delivery',
          subtotal: 4400,
          discount_amount: 660,
          delivery_fee: 150,
          total_amount: 3890,
          status: 'preparing',
          created_at: new Date(Date.now() - 25 * 60000).toISOString(),
          items: [
            { item_name: 'Koyla Karahi Special', variant: 'Full', quantity: 1, unit_price: 3200, line_total: 3200 },
            { item_name: 'Roghni Naan', variant: 'Regular', quantity: 4, unit_price: 150, line_total: 600 },
            { item_name: 'Peshawari Qahwa', variant: 'Regular', quantity: 2, unit_price: 300, line_total: 600 }
          ]
        },
        {
          id: 102,
          order_number: 'OTAQ-260921-9104',
          customer_name: 'Dr. Bilal Siddiqui',
          customer_phone: '03219876543',
          delivery_address: '',
          order_type: 'dine_in',
          subtotal: 5100,
          discount_amount: 0,
          delivery_fee: 0,
          total_amount: 5100,
          status: 'confirmed',
          created_at: new Date(Date.now() - 10 * 60000).toISOString(),
          items: [
            { item_name: 'Reshmi Malai Boti', variant: 'Full', quantity: 1, unit_price: 1800, line_total: 1800 },
            { item_name: 'Mutton Shinwari Karahi', variant: 'Half', quantity: 1, unit_price: 2500, line_total: 2500 },
            { item_name: 'Karak Doodh Patti', variant: 'Regular', quantity: 4, unit_price: 200, line_total: 800 }
          ]
        }
      ];
      localStorage.setItem('otaq_demo_orders', JSON.stringify(orders));
    }

    // Seed mock reservations if empty
    let reservations = JSON.parse(localStorage.getItem('otaq_demo_reservations') || '[]');
    if (reservations.length === 0) {
      const todayStr = new Date().toISOString().split('T')[0];
      reservations = [
        {
          id: 201,
          customer_name: 'Hamza Tariq',
          customer_phone: '03332456789',
          reservation_date: todayStr,
          reservation_time: '20:30',
          guests_count: 6,
          seating_area: 'open_air',
          special_requests: 'Outdoor family corner table with shamiana canopy',
          status: 'confirmed',
          created_at: new Date().toISOString()
        }
      ];
      localStorage.setItem('otaq_demo_reservations', JSON.stringify(reservations));
    }

    if (url === '/api/admin/overview') {
      const todaySales = orders.reduce((sum, o) => sum + (parseFloat(o.total_amount) || 0), 0);
      return {
        success: true,
        stats: {
          todaySales,
          totalSales: todaySales + 245000,
          todayOrders: orders.length,
          totalOrders: orders.length + 84,
          pendingOrders: orders.filter(o => o.status === 'pending').length,
          preparingOrders: orders.filter(o => o.status === 'preparing').length,
          pendingReservations: reservations.filter(r => r.status === 'pending').length,
          upcomingReservations: reservations.length
        },
        recentOrders: orders.slice(0, 10).map(o => ({
          id: o.id,
          order_number: o.order_number,
          customer_name: o.customer_name,
          customer_phone: o.customer_phone,
          order_type: o.order_type,
          total: o.total_amount,
          status: o.status
        }))
      };
    }

    if (url === '/api/admin/orders') {
      return {
        success: true,
        orders: orders.map(o => ({
          ...o,
          total: o.total_amount,
          items: o.items || []
        }))
      };
    }

    if (url.startsWith('/api/admin/orders/') && url.endsWith('/status')) {
      const parts = url.split('/');
      const id = parseInt(parts[4], 10);
      const body = JSON.parse(options.body || '{}');
      const idx = orders.findIndex(o => o.id === id);
      if (idx > -1) {
        orders[idx].status = body.status;
        localStorage.setItem('otaq_demo_orders', JSON.stringify(orders));
      }
      return { success: true };
    }

    if (url === '/api/admin/reservations') {
      return {
        success: true,
        reservations
      };
    }

    if (url.startsWith('/api/admin/reservations/') && url.endsWith('/status')) {
      const parts = url.split('/');
      const id = parseInt(parts[4], 10);
      const body = JSON.parse(options.body || '{}');
      const idx = reservations.findIndex(r => r.id === id);
      if (idx > -1) {
        reservations[idx].status = body.status;
        localStorage.setItem('otaq_demo_reservations', JSON.stringify(reservations));
      }
      return { success: true };
    }

    if (url === '/api/admin/menu') {
      let menuItems = JSON.parse(localStorage.getItem('otaq_demo_menu') || 'null');
      if (!menuItems) {
        menuItems = [
          { id: 1, category_name: 'Karahi & Handi', name: 'Chicken Koyla Karahi Special', description: 'Charcoal smoked tender chicken, rich tomato gravy & fresh ginger', price: 1800, half_price: 1100, is_popular: 1, is_available: 1 },
          { id: 2, category_name: 'Karahi & Handi', name: 'Mutton Shinwari Karahi', description: 'Tender mutton cooked in pure animal fat with green chilies and black pepper', price: 3200, half_price: 1800, is_popular: 1, is_available: 1 },
          { id: 3, category_name: 'Charcoal BBQ', name: 'Reshmi Malai Boti', description: 'Melt-in-mouth chicken cubes marinated in clotted cream and mild spices', price: 1200, half_price: 700, is_popular: 1, is_available: 1 },
          { id: 4, category_name: 'Charcoal BBQ', name: 'Beef Bihari Tikka Kabab', description: 'Wafer-thin beef strips marinated in raw papaya and mustard oil', price: 1100, half_price: null, is_popular: 1, is_available: 1 },
          { id: 5, category_name: 'Chinese & Rice', name: 'Chicken Manchurian & Fried Rice', description: 'Tangy red sauce with tender chicken cubes over egg fried basmati rice', price: 950, half_price: null, is_popular: 0, is_available: 1 },
          { id: 6, category_name: 'Chai & Beverages', name: 'Karak Doodh Patti Chai', description: 'Slow brewed strong black tea in whole milk with crushed green cardamom', price: 180, half_price: null, is_popular: 1, is_available: 1 },
          { id: 7, category_name: 'Chai & Beverages', name: 'Special Matka Chai', description: 'Clay pot smoked traditional milk tea infused with saffron and almonds', price: 280, half_price: null, is_popular: 1, is_available: 1 }
        ];
        localStorage.setItem('otaq_demo_menu', JSON.stringify(menuItems));
      }
      return {
        success: true,
        items: menuItems,
        categories: [
          { id: 1, name: 'Karahi & Handi', slug: 'karahi' },
          { id: 2, name: 'Charcoal BBQ', slug: 'bbq' },
          { id: 3, name: 'Chinese & Rice', slug: 'chinese' },
          { id: 4, name: 'Chai & Beverages', slug: 'chai' }
        ]
      };
    }

    if (url.startsWith('/api/admin/menu/items') && (method === 'POST' || method === 'PUT')) {
      return { success: true };
    }

    if (url === '/api/admin/offers') {
      return {
        success: true,
        offers: [
          {
            id: 1,
            title: 'Johar Town Welcoming Offer',
            description: '15% Off for all Johar residents',
            promo_code: 'JOHAR15',
            discount_percent: 15,
            min_order_amount: 2500,
            is_active: 1
          }
        ]
      };
    }

    if (url === '/api/admin/analytics') {
      return {
        success: true,
        avgOrderValue: 3450,
        totalOrdersCount: orders.length + 84,
        dailySales: [
          { date_label: 'Mon', revenue: 42000 },
          { date_label: 'Tue', revenue: 38500 },
          { date_label: 'Wed', revenue: 49000 },
          { date_label: 'Thu', revenue: 52000 },
          { date_label: 'Fri', revenue: 78000 },
          { date_label: 'Sat', revenue: 96000 },
          { date_label: 'Sun', revenue: 84000 }
        ],
        orderTypes: [
          { order_type: 'Delivery', count: 48, total_sales: 165000 },
          { order_type: 'Dine-In', count: 32, total_sales: 110000 },
          { order_type: 'Takeout', count: 18, total_sales: 62000 }
        ],
        topDishes: [
          { item_name: 'Koyla Karahi Special', total_qty: 62, total_revenue: 198400 },
          { item_name: 'Peshawari Shinwari Mutton', total_qty: 45, total_revenue: 189000 },
          { item_name: 'Reshmi Malai Boti', total_qty: 54, total_revenue: 97200 },
          { item_name: 'Karak Doodh Patti Chai', total_qty: 128, total_revenue: 25600 }
        ]
      };
    }

    return { success: true };
  }

  // API helper with Authorization header & static fallback
  async function apiCall(endpoint, options = {}) {
    try {
      const headers = options.headers || {};
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      headers['Content-Type'] = 'application/json';

      const res = await fetch(endpoint, {
        ...options,
        headers
      });

      if (res.status === 401 || res.status === 403) {
        logout();
        throw new Error('Session expired. Please log in again.');
      }

      if (res.ok) {
        const data = await res.json();
        if (data && data.success) return data;
      }
      throw new Error(`Endpoint returned status ${res.status}`);
    } catch (err) {
      if (err.message && err.message.includes('Session expired')) {
        throw err;
      }
      return handleStaticApi(endpoint, options);
    }
  }

  // ==========================================
  // AUTHENTICATION
  // ==========================================
  const loginOverlay = document.getElementById('login-overlay');
  const adminLayout = document.getElementById('admin-layout');
  const loginForm = document.getElementById('login-form');
  const loginError = document.getElementById('login-error');
  const btnLogin = document.getElementById('btn-login');
  const btnLogout = document.getElementById('btn-logout');
  const userDisplayName = document.getElementById('user-display-name');

  async function checkAuth() {
    if (!authToken) {
      showLogin();
      return;
    }

    try {
      const data = await apiCall('/api/admin/overview');
      showDashboard();
      renderOverviewData(data);
      startPolling();
    } catch (err) {
      showLogin();
    }
  }

  function showLogin() {
    if (loginOverlay) loginOverlay.style.display = 'flex';
    if (adminLayout) adminLayout.style.display = 'none';
    if (pollInterval) clearInterval(pollInterval);
  }

  function showDashboard() {
    if (loginOverlay) loginOverlay.style.display = 'none';
    if (adminLayout) adminLayout.style.display = 'flex';
  }

  function logout() {
    authToken = null;
    localStorage.removeItem('otaq_admin_token');
    showLogin();
    showAdminToast('Signed out of executive portal', 'info');
  }

  if (btnLogout) btnLogout.addEventListener('click', logout);

  if (loginForm) {
    loginForm.addEventListener('submit', async e => {
      e.preventDefault();
      const username = document.getElementById('login-username').value.trim();
      const password = document.getElementById('login-password').value;

      if (!username || !password) {
        loginError.textContent = 'Please provide username and password.';
        return;
      }

      btnLogin.disabled = true;
      btnLogin.querySelector('span').textContent = 'Authenticating...';
      loginError.textContent = '';

      try {
        let data = null;
        try {
          const res = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
          });
          if (res.ok) {
            data = await res.json();
          }
        } catch (netErr) {
          // offline / static hosting
        }

        if (!data || !data.success) {
          // Check demo credentials for static GitHub Pages host
          if (username === 'admin' && password === 'otaq2026!') {
            data = {
              success: true,
              token: 'demo_static_token_' + Date.now(),
              user: { username: 'admin', fullName: 'Managing Partner (Demo)' }
            };
          } else {
            throw new Error('Invalid credentials. Check username/password.');
          }
        }

        authToken = data.token;
        localStorage.setItem('otaq_admin_token', authToken);
        if (userDisplayName && data.user) {
          userDisplayName.textContent = data.user.fullName || data.user.username;
        }

        showDashboard();
        switchView('overview');
        loadOverview();
        startPolling();
        showAdminToast('Welcome to OTAQ Management Portal', 'success');
      } catch (err) {
        loginError.textContent = err.message || 'Authentication error';
      } finally {
        btnLogin.disabled = false;
        btnLogin.querySelector('span').textContent = 'Enter Dashboard';
      }
    });
  }

  // ==========================================
  // VIEW NAVIGATION
  // ==========================================
  const pageHeading = document.getElementById('page-heading');
  const navItems = [...document.querySelectorAll('.sidebar-nav .nav-item')];
  const adminViews = [...document.querySelectorAll('.admin-view')];
  const mobileToggle = document.getElementById('admin-mobile-toggle');
  const adminSidebar = document.getElementById('admin-sidebar');

  if (mobileToggle && adminSidebar) {
    mobileToggle.addEventListener('click', () => {
      adminSidebar.classList.toggle('open');
    });
  }

  function switchView(viewName) {
    currentView = viewName;

    // Close mobile sidebar if open
    if (adminSidebar) adminSidebar.classList.remove('open');

    navItems.forEach(item => {
      const active = item.dataset.view === viewName;
      item.classList.toggle('is-active', active);
    });

    adminViews.forEach(v => {
      const active = v.id === `view-${viewName}`;
      v.classList.toggle('is-active', active);
    });

    const titles = {
      overview: 'Dashboard Overview',
      orders: 'Live Orders Management',
      reservations: 'Table Reservations Bookings',
      menu: 'Menu Catalog & Pricing Management',
      offers: 'Promotional Offers & Codes',
      analytics: 'Sales Analytics & Kitchen Performance',
      qr: 'Tabletop & Takeout QR Code Hub'
    };

    if (pageHeading) pageHeading.textContent = titles[viewName] || 'Dashboard';

    // Trigger load for specific view
    if (viewName === 'overview') loadOverview();
    if (viewName === 'orders') loadOrders();
    if (viewName === 'reservations') loadReservations();
    if (viewName === 'menu') loadMenu();
    if (viewName === 'offers') loadOffers();
    if (viewName === 'analytics') loadAnalytics();
    if (viewName === 'qr') loadQR();
  }

  navItems.forEach(item => {
    item.addEventListener('click', () => switchView(item.dataset.view));
  });

  document.getElementById('btn-goto-orders')?.addEventListener('click', () => switchView('orders'));
  document.getElementById('btn-goto-offers')?.addEventListener('click', () => switchView('offers'));
  document.getElementById('btn-refresh-data')?.addEventListener('click', () => {
    switchView(currentView);
    showAdminToast('Refreshed data from database', 'info');
  });

  // ==========================================
  // 1. OVERVIEW VIEW
  // ==========================================
  async function loadOverview() {
    try {
      const data = await apiCall('/api/admin/overview');
      renderOverviewData(data);
    } catch (err) {
      console.error('Error loading overview:', err);
    }
  }

  function renderOverviewData(data) {
    const stats = data.stats || {};

    // KPIs
    document.getElementById('kpi-today-sales').textContent = `Rs ${(stats.todaySales || 0).toLocaleString()}`;
    document.getElementById('kpi-total-sales').textContent = `Total All-Time: Rs ${(stats.totalSales || 0).toLocaleString()}`;
    
    document.getElementById('kpi-today-orders').textContent = stats.todayOrders || 0;
    document.getElementById('kpi-total-orders').textContent = `Total Placed: ${stats.totalOrders || 0}`;

    document.getElementById('kpi-pending-orders').textContent = stats.pendingOrders || 0;
    document.getElementById('kpi-preparing-orders').textContent = `${stats.preparingOrders || 0} in preparation`;

    document.getElementById('kpi-pending-res').textContent = stats.pendingReservations || 0;
    document.getElementById('kpi-upcoming-res').textContent = `${stats.upcomingReservations || 0} upcoming bookings`;

    // Sidebar badges
    const ordersBadge = document.getElementById('sidebar-orders-badge');
    if (ordersBadge) {
      ordersBadge.textContent = stats.pendingOrders || 0;
      ordersBadge.classList.toggle('has-items', (stats.pendingOrders || 0) > 0);
    }

    const resBadge = document.getElementById('sidebar-res-badge');
    if (resBadge) {
      resBadge.textContent = stats.pendingReservations || 0;
      resBadge.classList.toggle('has-items', (stats.pendingReservations || 0) > 0);
    }

    // Recent orders table
    const recentTable = document.getElementById('overview-recent-orders');
    if (recentTable && data.recentOrders) {
      if (data.recentOrders.length === 0) {
        recentTable.innerHTML = `<tr><td colspan="6" class="loading-td">No orders recorded yet.</td></tr>`;
      } else {
        recentTable.innerHTML = data.recentOrders.map(o => `
          <tr>
            <td><strong>${o.order_number}</strong></td>
            <td>${o.customer_name}<br><small style="color:var(--text-muted)">${o.customer_phone}</small></td>
            <td><span style="text-transform:uppercase;font-size:11px;">${o.order_type}</span></td>
            <td><strong style="color:var(--gold)">Rs ${parseFloat(o.total).toLocaleString()}</strong></td>
            <td><span class="badge-status status-${o.status}">${o.status}</span></td>
            <td>
              <button type="button" class="table-btn btn-quick-view-order" data-id="${o.id}">Details</button>
            </td>
          </tr>
        `).join('');

        recentTable.querySelectorAll('.btn-quick-view-order').forEach(btn => {
          btn.onclick = () => openOrderDetail(btn.dataset.id);
        });
      }
    }

    // Active offers summary
    loadActiveOffersOverview();
  }

  async function loadActiveOffersOverview() {
    const list = document.getElementById('overview-offers-list');
    if (!list) return;

    try {
      const data = await apiCall('/api/admin/offers');
      const activeOffers = (data.offers || []).filter(o => o.is_active);

      if (activeOffers.length === 0) {
        list.innerHTML = `<div style="font-size:12px;color:var(--text-muted);">No active offers running. Create one from the Promotions tab!</div>`;
      } else {
        list.innerHTML = activeOffers.map(o => `
          <div class="offer-summary-card">
            <div>
              <strong>${o.title}</strong>
              <small>Promo: ${o.promo_code} · Min Order: Rs ${parseFloat(o.min_order_amount || 0).toLocaleString()}</small>
            </div>
            <span class="offer-badge">${o.discount_percent}% OFF</span>
          </div>
        `).join('');
      }
    } catch (e) {}
  }

  // ==========================================
  // 2. ORDERS VIEW
  // ==========================================
  const orderSearchInput = document.getElementById('order-search-input');
  const orderStatusFilter = document.getElementById('order-status-filter');
  const ordersTableBody = document.getElementById('orders-table-body');
  const ordersFilterCount = document.getElementById('orders-filter-count');

  async function loadOrders() {
    if (!ordersTableBody) return;
    ordersTableBody.innerHTML = `<tr><td colspan="7" class="loading-td">Loading orders...</td></tr>`;

    try {
      const status = orderStatusFilter ? orderStatusFilter.value : 'all';
      const search = orderSearchInput ? orderSearchInput.value.trim() : '';

      let url = `/api/admin/orders?status=${status}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;

      const data = await apiCall(url);
      const orders = data.orders || [];

      if (ordersFilterCount) {
        ordersFilterCount.textContent = `Showing ${orders.length} orders`;
      }

      if (orders.length === 0) {
        ordersTableBody.innerHTML = `<tr><td colspan="7" class="loading-td">No matching orders found.</td></tr>`;
        return;
      }

      ordersTableBody.innerHTML = orders.map(o => {
        const itemsSummary = (o.items || []).map(it => `${it.quantity}x ${it.item_name} (${it.variant})`).join(', ');

        return `
          <tr>
            <td>
              <strong>${o.order_number}</strong><br>
              <small style="color:var(--text-muted)">${new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
            </td>
            <td>
              <strong>${o.customer_name}</strong><br>
              <small>${o.customer_phone}</small>
              ${o.customer_address ? `<br><small style="color:var(--text-muted);">${o.customer_address}</small>` : ''}
            </td>
            <td><span style="text-transform:uppercase;font-size:11px;font-weight:700;">${o.order_type}</span></td>
            <td>
              <div style="max-width:240px;font-size:12px;">${itemsSummary || 'Standard Order'}</div>
              ${o.special_instructions ? `<div style="font-size:11px;color:#f2994a;margin-top:2px;">Note: ${o.special_instructions}</div>` : ''}
            </td>
            <td><strong style="color:var(--gold)">Rs ${parseFloat(o.total).toLocaleString()}</strong></td>
            <td>
              <select class="status-select-btn" data-order-id="${o.id}">
                ${['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'].map(st => `
                  <option value="${st}" ${o.status === st ? 'selected' : ''}>${st.toUpperCase()}</option>
                `).join('')}
              </select>
            </td>
            <td>
              <button type="button" class="table-btn btn-view-order-details" data-id="${o.id}">View</button>
            </td>
          </tr>
        `;
      }).join('');

      // Attach Status Change Handlers
      ordersTableBody.querySelectorAll('.status-select-btn').forEach(sel => {
        sel.onchange = async () => {
          const orderId = sel.dataset.orderId;
          const newStatus = sel.value;
          try {
            await apiCall(`/api/admin/orders/${orderId}/status`, {
              method: 'PATCH',
              body: JSON.stringify({ status: newStatus })
            });
            showAdminToast(`Order marked as ${newStatus.toUpperCase()}`, 'success');
            loadOverview();
          } catch (err) {
            showAdminToast(err.message || 'Failed to update order status', 'error');
          }
        };
      });

      // Attach View Handlers
      ordersTableBody.querySelectorAll('.btn-view-order-details').forEach(btn => {
        btn.onclick = () => openOrderDetail(btn.dataset.id, orders);
      });

    } catch (err) {
      ordersTableBody.innerHTML = `<tr><td colspan="7" class="loading-td" style="color:#f56565;">${err.message || 'Failed to fetch orders'}</td></tr>`;
    }
  }

  if (orderStatusFilter) orderStatusFilter.addEventListener('change', loadOrders);
  if (orderSearchInput) {
    let timeout = null;
    orderSearchInput.addEventListener('input', () => {
      clearTimeout(timeout);
      timeout = setTimeout(loadOrders, 300);
    });
  }

  // Order Details Modal
  const orderDetailBackdrop = document.getElementById('order-detail-backdrop');
  const odNumber = document.getElementById('od-number');
  const odContent = document.getElementById('od-content');

  function openOrderDetail(orderId, ordersList = []) {
    let order = ordersList.find(o => String(o.id) === String(orderId));

    if (!order) {
      // Fetch directly
      fetch(`/api/admin/orders?search=${orderId}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      }).then(r => r.json()).then(d => {
        if (d.orders && d.orders.length > 0) renderOdModal(d.orders[0]);
      });
      return;
    }

    renderOdModal(order);
  }

  function renderOdModal(order) {
    if (!orderDetailBackdrop || !odNumber || !odContent) return;
    odNumber.textContent = `Order Details · ${order.order_number}`;

    const itemsHtml = (order.items || []).map(it => `
      <tr>
        <td>${it.item_name} <small style="color:var(--text-muted)">(${it.variant})</small></td>
        <td>Rs ${parseFloat(it.unit_price).toLocaleString()}</td>
        <td>${it.quantity}</td>
        <td style="text-align:right;">Rs ${parseFloat(it.line_total).toLocaleString()}</td>
      </tr>
    `).join('');

    odContent.innerHTML = `
      <div class="od-section">
        <div><strong>Customer:</strong> ${order.customer_name} (${order.customer_phone})</div>
        <div><strong>Order Type:</strong> ${order.order_type.toUpperCase()} · Status: <span class="badge-status status-${order.status}">${order.status}</span></div>
        ${order.customer_address ? `<div><strong>Address:</strong> ${order.customer_address}</div>` : ''}
        ${order.special_instructions ? `<div style="color:#f2994a;margin-top:4px;"><strong>Kitchen Note:</strong> ${order.special_instructions}</div>` : ''}
      </div>

      <div class="od-section">
        <strong>Dishes Ordered:</strong>
        <table class="od-items-table">
          <thead>
            <tr>
              <th>Dish</th>
              <th>Price</th>
              <th>Qty</th>
              <th style="text-align:right;">Subtotal</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
        </table>
      </div>

      <div class="od-section" style="display:flex;justify-content:space-between;">
        <div>
          ${order.discount > 0 ? `<div>Discount: -Rs ${parseFloat(order.discount).toLocaleString()}</div>` : ''}
          ${order.delivery_fee > 0 ? `<div>Delivery: Rs ${parseFloat(order.delivery_fee).toLocaleString()}</div>` : ''}
        </div>
        <div style="font-size:16px;font-weight:700;color:var(--gold)">
          Total: Rs ${parseFloat(order.total).toLocaleString()}
        </div>
      </div>
    `;

    orderDetailBackdrop.classList.add('open');
  }

  document.getElementById('btn-close-od-modal')?.addEventListener('click', () => orderDetailBackdrop.classList.remove('open'));
  document.getElementById('btn-close-od')?.addEventListener('click', () => orderDetailBackdrop.classList.remove('open'));

  // ==========================================
  // 3. RESERVATIONS VIEW
  // ==========================================
  const resTableBody = document.getElementById('reservations-table-body');
  const resStatusFilter = document.getElementById('res-status-filter');
  const resDateFilter = document.getElementById('res-date-filter');

  async function loadReservations() {
    if (!resTableBody) return;
    resTableBody.innerHTML = `<tr><td colspan="8" class="loading-td">Loading reservations...</td></tr>`;

    try {
      const status = resStatusFilter ? resStatusFilter.value : 'all';
      const date = resDateFilter ? resDateFilter.value : '';

      let url = `/api/admin/reservations?status=${status}`;
      if (date) url += `&date=${encodeURIComponent(date)}`;

      const data = await apiCall(url);
      const list = data.reservations || [];

      if (list.length === 0) {
        resTableBody.innerHTML = `<tr><td colspan="8" class="loading-td">No reservations found.</td></tr>`;
        return;
      }

      resTableBody.innerHTML = list.map(r => `
        <tr>
          <td><strong>${r.customer_name}</strong></td>
          <td><a href="tel:${r.customer_phone}" style="color:var(--gold);text-decoration:underline;">${r.customer_phone}</a></td>
          <td>${r.reservation_date} · <strong>${r.reservation_time}</strong></td>
          <td>${r.guests_count} Guests</td>
          <td>${r.seating_area || 'Open Air'}</td>
          <td>${r.special_requests || '<span style="color:var(--text-muted)">None</span>'}</td>
          <td><span class="badge-status status-${r.status}">${r.status}</span></td>
          <td>
            ${r.status === 'pending' ? `
              <button type="button" class="table-btn btn-action-res" data-id="${r.id}" data-status="confirmed" style="color:#5ad389;border-color:#5ad389;">Confirm</button>
            ` : ''}
            ${r.status !== 'completed' && r.status !== 'cancelled' ? `
              <button type="button" class="table-btn btn-action-res" data-id="${r.id}" data-status="completed">Done</button>
              <button type="button" class="table-btn danger btn-action-res" data-id="${r.id}" data-status="cancelled">Cancel</button>
            ` : '<span style="font-size:11px;color:var(--text-muted)">Archived</span>'}
          </td>
        </tr>
      `).join('');

      resTableBody.querySelectorAll('.btn-action-res').forEach(btn => {
        btn.onclick = async () => {
          const id = btn.dataset.id;
          const status = btn.dataset.status;
          try {
            await apiCall(`/api/admin/reservations/${id}/status`, {
              method: 'PATCH',
              body: JSON.stringify({ status })
            });
            showAdminToast(`Reservation marked as ${status.toUpperCase()}`, 'success');
            loadReservations();
            loadOverview();
          } catch (err) {
            showAdminToast(err.message, 'error');
          }
        };
      });

    } catch (err) {
      resTableBody.innerHTML = `<tr><td colspan="8" class="loading-td" style="color:#f56565;">${err.message}</td></tr>`;
    }
  }

  if (resStatusFilter) resStatusFilter.addEventListener('change', loadReservations);
  if (resDateFilter) resDateFilter.addEventListener('change', loadReservations);

  // ==========================================
  // 4. MENU MANAGEMENT VIEW
  // ==========================================
  const menuManagementBody = document.getElementById('menu-management-body');
  const dishModalBackdrop = document.getElementById('dish-modal-backdrop');
  const dishForm = document.getElementById('dish-form');

  async function loadMenu() {
    if (!menuManagementBody) return;
    menuManagementBody.innerHTML = `<tr><td colspan="7" class="loading-td">Loading menu items...</td></tr>`;

    try {
      const data = await apiCall('/api/admin/menu');
      menuCache = data.items || [];

      if (menuCache.length === 0) {
        menuManagementBody.innerHTML = `<tr><td colspan="7" class="loading-td">No menu items found.</td></tr>`;
        return;
      }

      menuManagementBody.innerHTML = menuCache.map(it => `
        <tr>
          <td><span class="offer-badge" style="font-size:9px;">${it.category_name}</span></td>
          <td>
            <strong>${it.name}</strong>
            ${it.description ? `<br><small style="color:var(--text-muted)">${it.description}</small>` : ''}
          </td>
          <td><strong style="color:var(--gold)">Rs ${parseFloat(it.price).toLocaleString()}</strong></td>
          <td>${it.half_price ? `Rs ${parseFloat(it.half_price).toLocaleString()}` : '—'}</td>
          <td>${it.is_popular ? '⭐ Yes' : 'No'}</td>
          <td>
            <button type="button" class="table-btn btn-toggle-avail" data-id="${it.id}" data-available="${it.is_available}">
              ${it.is_available ? '✅ Available' : '❌ Sold Out'}
            </button>
          </td>
          <td>
            <button type="button" class="table-btn btn-edit-dish" data-id="${it.id}">Edit</button>
            <button type="button" class="table-btn danger btn-delete-dish" data-id="${it.id}">Delete</button>
          </td>
        </tr>
      `).join('');

      // Handlers
      menuManagementBody.querySelectorAll('.btn-toggle-avail').forEach(btn => {
        btn.onclick = async () => {
          const id = btn.dataset.id;
          const current = btn.dataset.available === '1' || btn.dataset.available === 'true';
          try {
            await apiCall(`/api/admin/menu/items/${id}`, {
              method: 'PUT',
              body: JSON.stringify({ is_available: !current })
            });
            showAdminToast(`Item availability updated`, 'success');
            loadMenu();
          } catch (err) {
            showAdminToast(err.message, 'error');
          }
        };
      });

      menuManagementBody.querySelectorAll('.btn-edit-dish').forEach(btn => {
        btn.onclick = () => openDishModal(btn.dataset.id);
      });

      menuManagementBody.querySelectorAll('.btn-delete-dish').forEach(btn => {
        btn.onclick = async () => {
          if (!confirm('Are you sure you want to remove this dish from the menu?')) return;
          try {
            await apiCall(`/api/admin/menu/items/${btn.dataset.id}`, { method: 'DELETE' });
            showAdminToast('Dish removed', 'info');
            loadMenu();
          } catch (err) {
            showAdminToast(err.message, 'error');
          }
        };
      });

    } catch (err) {
      menuManagementBody.innerHTML = `<tr><td colspan="7" class="loading-td" style="color:#f56565;">${err.message}</td></tr>`;
    }
  }

  function openDishModal(dishId = null) {
    dishForm.reset();
    document.getElementById('dish-id').value = '';

    if (dishId) {
      const item = menuCache.find(it => String(it.id) === String(dishId));
      if (item) {
        document.getElementById('dish-modal-title').textContent = 'Edit Menu Dish';
        document.getElementById('dish-id').value = item.id;
        document.getElementById('dish-cat').value = item.category_id;
        document.getElementById('dish-name').value = item.name;
        document.getElementById('dish-desc').value = item.description || '';
        document.getElementById('dish-price').value = item.price;
        document.getElementById('dish-half-price').value = item.half_price || '';
        document.getElementById('dish-popular').checked = Boolean(item.is_popular);
        document.getElementById('dish-available').checked = Boolean(item.is_available);
      }
    } else {
      document.getElementById('dish-modal-title').textContent = 'Add New Dish to Menu';
      document.getElementById('dish-available').checked = true;
    }

    dishModalBackdrop.classList.add('open');
  }

  document.getElementById('btn-add-dish-modal')?.addEventListener('click', () => openDishModal());
  document.getElementById('btn-close-dish-modal')?.addEventListener('click', () => dishModalBackdrop.classList.remove('open'));
  document.getElementById('btn-cancel-dish')?.addEventListener('click', () => dishModalBackdrop.classList.remove('open'));

  if (dishForm) {
    dishForm.addEventListener('submit', async e => {
      e.preventDefault();
      const id = document.getElementById('dish-id').value;
      const cat = document.getElementById('dish-cat').value;
      const name = document.getElementById('dish-name').value.trim();
      const desc = document.getElementById('dish-desc').value.trim();
      const price = document.getElementById('dish-price').value;
      const halfPrice = document.getElementById('dish-half-price').value;
      const isPop = document.getElementById('dish-popular').checked;
      const isAvail = document.getElementById('dish-available').checked;

      const payload = {
        category_id: parseInt(cat, 10),
        name,
        description: desc,
        price: parseFloat(price),
        half_price: halfPrice ? parseFloat(halfPrice) : null,
        is_popular: isPop,
        is_available: isAvail
      };

      try {
        if (id) {
          await apiCall(`/api/admin/menu/items/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
          showAdminToast('Dish updated successfully', 'success');
        } else {
          await apiCall('/api/admin/menu/items', { method: 'POST', body: JSON.stringify(payload) });
          showAdminToast('New dish added to menu', 'success');
        }
        dishModalBackdrop.classList.remove('open');
        loadMenu();
      } catch (err) {
        showAdminToast(err.message, 'error');
      }
    });
  }

  // ==========================================
  // 5. OFFERS VIEW
  // ==========================================
  const offersTableBody = document.getElementById('offers-management-body');
  const offerModalBackdrop = document.getElementById('offer-modal-backdrop');
  const offerForm = document.getElementById('offer-form');

  async function loadOffers() {
    if (!offersTableBody) return;
    offersTableBody.innerHTML = `<tr><td colspan="6" class="loading-td">Loading offers...</td></tr>`;

    try {
      const data = await apiCall('/api/admin/offers');
      const offers = data.offers || [];

      if (offers.length === 0) {
        offersTableBody.innerHTML = `<tr><td colspan="6" class="loading-td">No promotional offers created.</td></tr>`;
        return;
      }

      offersTableBody.innerHTML = offers.map(o => `
        <tr>
          <td>
            <strong>${o.title}</strong>
            ${o.description ? `<br><small style="color:var(--text-muted)">${o.description}</small>` : ''}
          </td>
          <td><strong style="color:var(--gold);letter-spacing:.08em;">${o.promo_code}</strong></td>
          <td><strong>${o.discount_percent}% OFF</strong></td>
          <td>Rs ${parseFloat(o.min_order_amount || 0).toLocaleString()}</td>
          <td>
            <button type="button" class="table-btn btn-toggle-offer" data-id="${o.id}" data-active="${o.is_active}">
              ${o.is_active ? '🟢 Active' : '⚪ Inactive'}
            </button>
          </td>
          <td>
            <button type="button" class="table-btn danger btn-delete-offer" data-id="${o.id}">Delete</button>
          </td>
        </tr>
      `).join('');

      offersTableBody.querySelectorAll('.btn-toggle-offer').forEach(btn => {
        btn.onclick = async () => {
          const id = btn.dataset.id;
          const current = btn.dataset.active === '1' || btn.dataset.active === 'true';
          try {
            await apiCall(`/api/admin/offers/${id}`, {
              method: 'PUT',
              body: JSON.stringify({ is_active: !current })
            });
            showAdminToast('Offer status updated', 'success');
            loadOffers();
          } catch (err) {
            showAdminToast(err.message, 'error');
          }
        };
      });

      offersTableBody.querySelectorAll('.btn-delete-offer').forEach(btn => {
        btn.onclick = async () => {
          if (!confirm('Are you sure you want to delete this offer?')) return;
          try {
            await apiCall(`/api/admin/offers/${btn.dataset.id}`, { method: 'DELETE' });
            showAdminToast('Offer deleted', 'info');
            loadOffers();
          } catch (err) {
            showAdminToast(err.message, 'error');
          }
        };
      });

    } catch (err) {
      offersTableBody.innerHTML = `<tr><td colspan="6" class="loading-td" style="color:#f56565;">${err.message}</td></tr>`;
    }
  }

  document.getElementById('btn-add-offer-modal')?.addEventListener('click', () => {
    offerForm.reset();
    document.getElementById('offer-active').checked = true;
    offerModalBackdrop.classList.add('open');
  });
  document.getElementById('btn-close-offer-modal')?.addEventListener('click', () => offerModalBackdrop.classList.remove('open'));
  document.getElementById('btn-cancel-offer')?.addEventListener('click', () => offerModalBackdrop.classList.remove('open'));

  if (offerForm) {
    offerForm.addEventListener('submit', async e => {
      e.preventDefault();
      const title = document.getElementById('offer-title').value.trim();
      const desc = document.getElementById('offer-desc').value.trim();
      const code = document.getElementById('offer-code').value.trim();
      const discount = document.getElementById('offer-discount').value;
      const minOrder = document.getElementById('offer-min-order').value;
      const active = document.getElementById('offer-active').checked;

      try {
        await apiCall('/api/admin/offers', {
          method: 'POST',
          body: JSON.stringify({
            title,
            description: desc,
            promo_code: code,
            discount_percent: parseInt(discount, 10),
            min_order_amount: minOrder ? parseFloat(minOrder) : 0,
            is_active: active
          })
        });
        showAdminToast('Offer published to website!', 'success');
        offerModalBackdrop.classList.remove('open');
        loadOffers();
      } catch (err) {
        showAdminToast(err.message, 'error');
      }
    });
  }

  // ==========================================
  // 6. SALES & ANALYTICS VIEW
  // ==========================================
  async function loadAnalytics() {
    try {
      const data = await apiCall('/api/admin/analytics');
      document.getElementById('analytics-aov').textContent = `Rs ${(data.avgOrderValue || 0).toLocaleString()}`;
      document.getElementById('analytics-total-count').textContent = data.totalOrdersCount || 0;

      // 7-day Daily Chart
      const chartWrap = document.getElementById('analytics-daily-chart');
      if (chartWrap && data.dailySales) {
        const maxVal = Math.max(...data.dailySales.map(d => parseFloat(d.revenue)), 5000);

        chartWrap.innerHTML = data.dailySales.map(d => {
          const rev = parseFloat(d.revenue);
          const heightPct = Math.max(10, Math.round((rev / maxVal) * 100));
          return `
            <div class="chart-bar-col">
              <span class="bar-amount">Rs ${rev > 0 ? (rev >= 1000 ? `${(rev/1000).toFixed(1)}k` : rev) : '0'}</span>
              <div class="bar-fill" style="height:${heightPct}%;"></div>
              <span class="bar-label">${d.date_label}</span>
            </div>
          `;
        }).join('');
      }

      // Order Types
      const otWrap = document.getElementById('analytics-order-types');
      if (otWrap && data.orderTypes) {
        otWrap.innerHTML = data.orderTypes.map(ot => `
          <div class="ot-row">
            <strong>${ot.order_type} Fulfillment</strong>
            <span>${ot.count} orders (Rs ${parseFloat(ot.total_sales).toLocaleString()})</span>
          </div>
        `).join('');
      }

      // Top Dishes
      const topBody = document.getElementById('analytics-top-dishes');
      if (topBody && data.topDishes) {
        if (data.topDishes.length === 0) {
          topBody.innerHTML = `<tr><td colspan="3" class="loading-td">No dish sale history yet.</td></tr>`;
        } else {
          topBody.innerHTML = data.topDishes.map(td => `
            <tr>
              <td><strong>${td.item_name}</strong></td>
              <td>${td.total_qty} Servings</td>
              <td><strong style="color:var(--gold)">Rs ${parseFloat(td.total_revenue).toLocaleString()}</strong></td>
            </tr>
          `).join('');
        }
      }

    } catch (err) {
      console.error('Error loading analytics:', err);
    }
  }

  // ==========================================
  // 7. QR CODE HUB VIEW
  // ==========================================
  async function loadQR() {
    const qrImg = document.getElementById('restaurant-qr-img');
    const qrInput = document.getElementById('qr-target-input');
    const qrDetectedIp = document.getElementById('qr-detected-ip');
    const btnUpdateQr = document.getElementById('btn-update-qr');
    const btnCopy = document.getElementById('btn-copy-qr-url');
    const btnPrint = document.getElementById('btn-print-qr');

    let currentUrl = window.location.href.replace(/admin\.html.*$/, '').replace(/\/+$/, '') + '/';

    try {
      const netInfo = await fetch('/api/network-info').then(r => r.json());
      if (netInfo.success && netInfo.localIP && netInfo.localIP !== 'localhost') {
        currentUrl = netInfo.mobileUrl;
        if (qrDetectedIp) qrDetectedIp.textContent = `${netInfo.localIP}:${netInfo.port}`;
      }
    } catch (e) {
      if (qrDetectedIp) qrDetectedIp.textContent = window.location.hostname;
    }

    if (qrInput) qrInput.value = currentUrl;
    updateQrImage(currentUrl);

    function updateQrImage(url) {
      if (qrImg) {
        qrImg.src = `/api/qr-image?url=${encodeURIComponent(url)}&t=${Date.now()}`;
        qrImg.onerror = () => {
          qrImg.onerror = null;
          qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}`;
        };
      }
    }

    if (btnUpdateQr && qrInput) {
      btnUpdateQr.onclick = () => {
        const val = qrInput.value.trim();
        if (val) {
          updateQrImage(val);
          showAdminToast('QR Code updated for: ' + val, 'success');
        }
      };
    }

    if (btnCopy && qrInput) {
      btnCopy.onclick = () => {
        const urlToCopy = qrInput.value.trim() || currentUrl;
        navigator.clipboard.writeText(urlToCopy);
        showAdminToast('Mobile URL copied to clipboard: ' + urlToCopy, 'success');
      };
    }

    if (btnPrint) {
      btnPrint.onclick = () => window.print();
    }
  }

  // Auto polling
  function startPolling() {
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(() => {
      if (authToken) {
        apiCall('/api/admin/overview').then(renderOverviewData).catch(() => {});
        if (currentView === 'orders') loadOrders();
      }
    }, 20000);
  }

  // Initialize
  checkAuth();
})();
