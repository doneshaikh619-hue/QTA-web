const http = require('http');

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, res => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(body); } catch (e) {}
        resolve({ status: res.statusCode, headers: res.headers, body, json });
      });
    });
    req.on('error', reject);
    if (data) {
      if (typeof data === 'object') {
        req.setHeader('Content-Type', 'application/json');
        req.write(JSON.stringify(data));
      } else {
        req.write(data);
      }
    }
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Starting OTAQ Full-Stack Verification Test Suite...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // 1. Static Assets & PWA
    console.log('--- 1. Testing Static Assets & PWA ---');
    const homeRes = await request({ host: 'localhost', port: 5000, path: '/', method: 'GET' });
    assert(homeRes.status === 200 && homeRes.body.includes('OTAQ'), 'Home page serves with OTAQ branding');
    assert(homeRes.body.includes('manifest.webmanifest'), 'Home page links to PWA manifest');
    assert(homeRes.body.includes('sw.js'), 'Home page includes Service Worker reference');

    const adminPageRes = await request({ host: 'localhost', port: 5000, path: '/admin.html', method: 'GET' });
    assert(adminPageRes.status === 200 && adminPageRes.body.includes('Executive Portal'), 'Admin portal page serves 200');

    const manifestRes = await request({ host: 'localhost', port: 5000, path: '/manifest.webmanifest', method: 'GET' });
    assert(manifestRes.status === 200 && manifestRes.json && manifestRes.json.name.includes('OTAQ'), 'Web App Manifest valid JSON');

    const swRes = await request({ host: 'localhost', port: 5000, path: '/sw.js', method: 'GET' });
    assert(swRes.status === 200 && swRes.body.includes('addEventListener'), 'Service Worker sw.js serves 200');

    // 2. Customer Menu & Settings API
    console.log('\n--- 2. Testing Customer Public APIs ---');
    const settingsRes = await request({ host: 'localhost', port: 5000, path: '/api/settings', method: 'GET' });
    assert(settingsRes.status === 200 && settingsRes.json.settings.phone_number, 'Settings API returns valid data');

    const menuRes = await request({ host: 'localhost', port: 5000, path: '/api/menu', method: 'GET' });
    assert(menuRes.status === 200 && menuRes.json.items.length >= 40, `Menu API returns ${menuRes.json.items ? menuRes.json.items.length : 0} active dishes`);
    assert(menuRes.json.categories.length >= 4, 'Menu API returns 4 primary categories');

    const offersRes = await request({ host: 'localhost', port: 5000, path: '/api/offers', method: 'GET' });
    assert(offersRes.status === 200 && offersRes.json.offers.length > 0, `Offers API returns ${offersRes.json.offers ? offersRes.json.offers.length : 0} active promotions`);

    // 3. Customer Ordering & Price Security
    console.log('\n--- 3. Testing Online Ordering & Price Tampering Security ---');
    // Place a valid order with promo code JOHAR15
    const orderPayload = {
      customer: {
        name: 'Zainab Abbasi',
        phone: '03123456789',
        address: 'B-22 Block 10 Gulistan-e-Johar, Karachi'
      },
      orderType: 'delivery',
      items: [
        { id: 1, variant: 'Regular', quantity: 2 }, // 2x Chest Tikka @ 550 = 1100
        { id: 17, variant: 'Half', quantity: 1 }    // 1x Desi Karahi Half @ 2000 = 2000
      ],
      promoCode: 'JOHAR15', // 15% discount on 3100 = 465. Total = 3100 - 465 + 150 = 2785
      specialInstructions: 'Make it extra spicy with hot fresh naan'
    };

    const orderRes = await request({ host: 'localhost', port: 5000, path: '/api/orders', method: 'POST' }, orderPayload);
    assert(orderRes.status === 200 && orderRes.json.success === true, 'Order created successfully');
    assert(orderRes.json.subtotal === 3100, `Subtotal accurately computed on backend (Expected 3100, got ${orderRes.json.subtotal})`);
    assert(orderRes.json.discount === 465, `Promo discount calculated correctly (Expected 465, got ${orderRes.json.discount})`);
    assert(orderRes.json.deliveryFee === 150, `Delivery fee added correctly (Expected 150, got ${orderRes.json.deliveryFee})`);
    assert(orderRes.json.total === 2785, `Grand total calculated correctly on backend (Expected 2785, got ${orderRes.json.total})`);

    const placedOrderNumber = orderRes.json.orderNumber;
    const placedOrderId = orderRes.json.orderId;

    // Track order
    const trackRes = await request({ host: 'localhost', port: 5000, path: `/api/orders/${placedOrderNumber}`, method: 'GET' });
    assert(trackRes.status === 200 && trackRes.json.order.order_number === placedOrderNumber, 'Customer live order tracking returns accurate order');
    assert(trackRes.json.items.length === 2, 'Order items tracked accurately in database');

    // Edge Cases: Empty cart
    const emptyOrderRes = await request({ host: 'localhost', port: 5000, path: '/api/orders', method: 'POST' }, { customer: { name: 'Test', phone: '03001234567' }, items: [] });
    assert(emptyOrderRes.status === 400, 'Empty cart rejected with 400 Bad Request');

    // Edge Cases: Missing phone
    const noPhoneRes = await request({ host: 'localhost', port: 5000, path: '/api/orders', method: 'POST' }, { customer: { name: 'Test' }, items: [{ id: 1, quantity: 1 }] });
    assert(noPhoneRes.status === 400, 'Missing phone rejected with 400 Bad Request');

    // Edge Cases: Delivery without address
    const noAddressRes = await request({ host: 'localhost', port: 5000, path: '/api/orders', method: 'POST' }, { customer: { name: 'Test', phone: '03001234567' }, orderType: 'delivery', items: [{ id: 1, quantity: 1 }] });
    assert(noAddressRes.status === 400, 'Delivery order without address rejected with 400');

    // 4. Table Reservations
    console.log('\n--- 4. Testing Table Reservation System ---');
    const resPayload = {
      customerName: 'Kashif Mehmood',
      customerPhone: '03339876543',
      date: '2026-09-25',
      time: '09:00 PM',
      guestsCount: 6,
      seatingArea: 'Open Air Cultural',
      specialRequests: 'Corner table with warm ambient lamps'
    };

    const bookRes = await request({ host: 'localhost', port: 5000, path: '/api/reservations', method: 'POST' }, resPayload);
    assert(bookRes.status === 200 && bookRes.json.success === true, 'Reservation saved successfully to MySQL');

    // 5. Admin Authentication & Dashboard
    console.log('\n--- 5. Testing Owner Admin Dashboard & Security ---');
    // Wrong login
    const wrongLogin = await request({ host: 'localhost', port: 5000, path: '/api/admin/login', method: 'POST' }, { username: 'admin', password: 'wrongpassword' });
    assert(wrongLogin.status === 401, 'Invalid password rejected with 401 Unauthorized');

    // Valid login
    const validLogin = await request({ host: 'localhost', port: 5000, path: '/api/admin/login', method: 'POST' }, { username: 'admin', password: 'otaq2026!' });
    assert(validLogin.status === 200 && validLogin.json.token, 'Admin logged in with JWT token');

    const adminToken = validLogin.json.token;

    // Overview stats
    const overviewRes = await request({
      host: 'localhost', port: 5000, path: '/api/admin/overview', method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(overviewRes.status === 200 && overviewRes.json.stats.totalOrders > 0, `Admin overview returns live stats: ${overviewRes.json.stats.totalOrders} total orders, Rs ${overviewRes.json.stats.totalSales} sales`);

    // Orders management & status update
    const adminOrdersRes = await request({
      host: 'localhost', port: 5000, path: '/api/admin/orders', method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(adminOrdersRes.status === 200 && adminOrdersRes.json.orders.length > 0, 'Admin orders list retrieved from MySQL');

    // Update newly placed order status: pending -> preparing
    const updateOrderRes = await request({
      host: 'localhost', port: 5000, path: `/api/admin/orders/${placedOrderId}/status`, method: 'PATCH',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    }, { status: 'preparing' });
    assert(updateOrderRes.status === 200, 'Order status updated to PREPARING');

    // Verify order reflects updated status
    const verifyTrack = await request({ host: 'localhost', port: 5000, path: `/api/orders/${placedOrderNumber}`, method: 'GET' });
    assert(verifyTrack.json.order.status === 'preparing', 'Customer tracking immediately reflects PREPARING status');

    // Admin Broadcast Push Notification
    const broadcastRes = await request({
      host: 'localhost', port: 5000, path: '/api/admin/broadcast-push', method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    }, {
      title: '⚡ Midnight BBQ Flash 30% OFF',
      message: 'Exclusive VIP offer on all platters tonight!',
      promo: 'VIP30'
    });
    assert(broadcastRes.status === 200 && broadcastRes.json.success === true, 'Admin VIP push notification broadcasted successfully');

    // 6. Menu Management CRUD
    console.log('\n--- 6. Testing Menu Management (CRUD) ---');
    // Create new dish
    const newDishRes = await request({
      host: 'localhost', port: 5000, path: '/api/admin/menu/items', method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    }, {
      category_id: 1,
      name: 'Automated Test Lamb Chop',
      description: 'Charcoal grilled spicy chops',
      price: 2500,
      half_price: null,
      is_popular: 1,
      is_available: 1
    });
    assert(newDishRes.status === 200 && newDishRes.json.itemId, 'New dish added via admin API');
    const createdDishId = newDishRes.json.itemId;

    // Update price
    const updatePriceRes = await request({
      host: 'localhost', port: 5000, path: `/api/admin/menu/items/${createdDishId}`, method: 'PUT',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    }, { price: 2750 });
    assert(updatePriceRes.status === 200, 'Dish price updated in MySQL');

    // Delete dish
    const delDishRes = await request({
      host: 'localhost', port: 5000, path: `/api/admin/menu/items/${createdDishId}`, method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(delDishRes.status === 200, 'Dish deleted from menu');

    // 7. Analytics API
    console.log('\n--- 7. Testing Sales & Analytics Engine ---');
    const analyticsRes = await request({
      host: 'localhost', port: 5000, path: '/api/admin/analytics', method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(analyticsRes.status === 200 && analyticsRes.json.dailySales, 'Analytics engine returns daily revenue breakdown');
    assert(analyticsRes.json.topDishes.length > 0, `Top selling dishes identified: ${analyticsRes.json.topDishes[0].item_name}`);

    console.log(`\n🏁 Test Suite Finished: ${passed} Passed, ${failed} Failed.`);
    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (e) {
    console.error('Fatal test error:', e);
    process.exit(1);
  }
}

runTests();
