const express = require('express');
const cors = require('cors');
const path = require('path');
const os = require('os');
const QRCode = require('qrcode');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { pool, query } = require('./db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'otaq_super_secret_jwt_key_2026';

function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend and PWA assets
app.use(express.static(path.join(__dirname)));

// ==========================================
// AUTH MIDDLEWARE FOR ADMIN
// ==========================================
function authenticateAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Authorization token required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ success: false, error: 'Invalid or expired session' });
  }
}

// ==========================================
// PUBLIC CUSTOMER API ENDPOINTS
// ==========================================

// 1. Get restaurant settings
app.get('/api/settings', async (req, res) => {
  try {
    const rows = await query('SELECT setting_key, setting_value FROM restaurant_settings');
    const settings = {};
    rows.forEach(r => { settings[r.setting_key] = r.setting_value; });
    res.json({ success: true, settings });
  } catch (err) {
    console.error('Error fetching settings:', err);
    res.status(500).json({ success: false, error: 'Failed to load settings' });
  }
});

// 2. Get full active menu (categories + items)
app.get('/api/menu', async (req, res) => {
  try {
    const categories = await query(
      'SELECT id, name, slug, description, display_order FROM menu_categories WHERE is_active = 1 ORDER BY display_order ASC'
    );

    const items = await query(
      'SELECT id, category_id, name, description, price, half_price, image_url, is_popular, is_available, display_order FROM menu_items WHERE is_available = 1 ORDER BY display_order ASC, name ASC'
    );

    res.json({ success: true, categories, items });
  } catch (err) {
    console.error('Error fetching menu:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch menu' });
  }
});

// 3. Get active promotional offers
app.get('/api/offers', async (req, res) => {
  try {
    const offers = await query(
      'SELECT id, title, description, promo_code, discount_percent, min_order_amount, banner_url FROM offers WHERE is_active = 1'
    );
    res.json({ success: true, offers });
  } catch (err) {
    console.error('Error fetching offers:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch offers' });
  }
});

// 4. Place an Order (Secure backend pricing calculation)
app.post('/api/orders', async (req, res) => {
  const { customer, orderType, items, promoCode, specialInstructions } = req.body;

  if (!customer || !customer.name || !customer.phone) {
    return res.status(400).json({ success: false, error: 'Customer name and phone number are required' });
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, error: 'Order must contain at least one item' });
  }

  const validOrderTypes = ['delivery', 'pickup', 'dine_in'];
  const finalOrderType = validOrderTypes.includes(orderType) ? orderType : 'delivery';

  if (finalOrderType === 'delivery' && (!customer.address || customer.address.trim().length < 5)) {
    return res.status(400).json({ success: false, error: 'Please provide a valid delivery address' });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Fetch database items to verify real prices
    const itemIds = items.map(i => i.id);
    const [dbItems] = await connection.query(
      `SELECT id, name, price, half_price, is_available FROM menu_items WHERE id IN (?)`,
      [itemIds]
    );

    const dbItemMap = new Map();
    dbItems.forEach(d => dbItemMap.set(d.id, d));

    let subtotal = 0;
    const verifiedOrderItems = [];

    for (const reqItem of items) {
      const dbItem = dbItemMap.get(Number(reqItem.id));
      if (!dbItem) {
        throw new Error(`Item ID ${reqItem.id} is not found on the menu`);
      }
      if (!dbItem.is_available) {
        throw new Error(`Item "${dbItem.name}" is currently sold out`);
      }

      const qty = Math.max(1, parseInt(reqItem.quantity, 10) || 1);
      const isHalf = reqItem.variant && reqItem.variant.toLowerCase() === 'half' && dbItem.half_price;
      const unitPrice = isHalf ? parseFloat(dbItem.half_price) : parseFloat(dbItem.price);
      const lineTotal = unitPrice * qty;

      subtotal += lineTotal;
      verifiedOrderItems.push({
        menu_item_id: dbItem.id,
        item_name: dbItem.name,
        variant: isHalf ? 'Half' : 'Regular',
        unit_price: unitPrice,
        quantity: qty,
        line_total: lineTotal
      });
    }

    // Apply promo discount if present
    let discount = 0;
    let validPromo = null;
    if (promoCode && promoCode.trim()) {
      const [promoRows] = await connection.query(
        `SELECT promo_code, discount_percent, min_order_amount FROM offers WHERE promo_code = ? AND is_active = 1`,
        [promoCode.trim().toUpperCase()]
      );
      if (promoRows.length > 0) {
        const promo = promoRows[0];
        if (subtotal >= parseFloat(promo.min_order_amount || 0)) {
          discount = Math.round((subtotal * parseFloat(promo.discount_percent)) / 100);
          validPromo = promo.promo_code;
        }
      }
    }

    // Delivery fee
    let deliveryFee = 0;
    if (finalOrderType === 'delivery') {
      const [settings] = await connection.query(
        `SELECT setting_value FROM restaurant_settings WHERE setting_key = 'delivery_fee'`
      );
      deliveryFee = settings.length > 0 ? parseFloat(settings[0].setting_value) : 150;
    }

    const total = Math.max(0, subtotal - discount + deliveryFee);

    // Find or create customer
    let customerId;
    const [existingCust] = await connection.query(
      `SELECT id FROM customers WHERE phone = ? LIMIT 1`,
      [customer.phone.trim()]
    );

    if (existingCust.length > 0) {
      customerId = existingCust[0].id;
      await connection.query(
        `UPDATE customers SET name = ?, address = COALESCE(?, address) WHERE id = ?`,
        [customer.name.trim(), customer.address ? customer.address.trim() : null, customerId]
      );
    } else {
      const [newCust] = await connection.query(
        `INSERT INTO customers (name, phone, address) VALUES (?, ?, ?)`,
        [customer.name.trim(), customer.phone.trim(), customer.address ? customer.address.trim() : null]
      );
      customerId = newCust.insertId;
    }

    // Create unique order number
    const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const randPart = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = `OTAQ-${dateStr}-${randPart}`;

    const [orderResult] = await connection.query(
      `INSERT INTO orders (order_number, customer_id, order_type, status, subtotal, discount, delivery_fee, total, promo_code, special_instructions)
       VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)`,
      [
        orderNumber,
        customerId,
        finalOrderType,
        subtotal,
        discount,
        deliveryFee,
        total,
        validPromo,
        specialInstructions ? specialInstructions.trim() : null
      ]
    );

    const orderId = orderResult.insertId;

    // Insert order items
    for (const item of verifiedOrderItems) {
      await connection.query(
        `INSERT INTO order_items (order_id, menu_item_id, item_name, variant, unit_price, quantity, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [orderId, item.menu_item_id, item.item_name, item.variant, item.unit_price, item.quantity, item.line_total]
      );
    }

    // Insert owner notification
    await connection.query(
      `INSERT INTO notifications (title, message, type) VALUES (?, ?, ?)`,
      [
        `New Order: ${orderNumber}`,
        `${customer.name} ordered ${verifiedOrderItems.length} items (Total: Rs ${total.toLocaleString()}) via ${finalOrderType.toUpperCase()}.`,
        'order'
      ]
    );

    await connection.commit();

    res.json({
      success: true,
      orderNumber,
      orderId,
      subtotal,
      discount,
      deliveryFee,
      total,
      orderType: finalOrderType,
      status: 'pending',
      itemsCount: verifiedOrderItems.length,
      message: 'Order received successfully! We are preparing your feast.'
    });
  } catch (err) {
    await connection.rollback();
    console.error('Error placing order:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to process order' });
  } finally {
    connection.release();
  }
});

// 5. Track Order Status by Order Number
app.get('/api/orders/:orderNumber', async (req, res) => {
  try {
    const orders = await query(
      `SELECT o.id, o.order_number, o.order_type, o.status, o.subtotal, o.discount, o.delivery_fee, o.total, o.created_at,
              c.name as customer_name, c.phone as customer_phone, c.address as customer_address
       FROM orders o
       JOIN customers c ON o.customer_id = c.id
       WHERE o.order_number = ?`,
      [req.params.orderNumber]
    );

    if (!orders || orders.length === 0) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    const order = orders[0];
    const items = await query(
      `SELECT item_name, variant, unit_price, quantity, line_total FROM order_items WHERE order_id = ?`,
      [order.id]
    );

    res.json({ success: true, order, items });
  } catch (err) {
    console.error('Error tracking order:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve order status' });
  }
});

// 6. Submit Table Reservation
app.post('/api/reservations', async (req, res) => {
  const { customerName, customerPhone, date, time, guestsCount, seatingArea, specialRequests } = req.body;

  if (!customerName || !customerPhone || !date || !time) {
    return res.status(400).json({ success: false, error: 'Name, phone, reservation date, and time are required' });
  }

  try {
    const guests = Math.max(1, parseInt(guestsCount, 10) || 2);
    const seating = seatingArea || 'Open Air Cultural';

    const result = await query(
      `INSERT INTO reservations (customer_name, customer_phone, reservation_date, reservation_time, guests_count, seating_area, special_requests, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [customerName.trim(), customerPhone.trim(), date, time, guests, seating, specialRequests ? specialRequests.trim() : null]
    );

    // Notify owner
    await query(
      `INSERT INTO notifications (title, message, type) VALUES (?, ?, ?)`,
      [
        `New Reservation: ${customerName}`,
        `Table requested for ${guests} guests on ${date} at ${time} (${seating}).`,
        'reservation'
      ]
    );

    res.json({
      success: true,
      reservationId: result.insertId,
      message: 'Your table reservation request has been received! Our host will contact you shortly.'
    });
  } catch (err) {
    console.error('Error creating reservation:', err);
    res.status(500).json({ success: false, error: 'Failed to save reservation' });
  }
});

// ==========================================
// OWNER ADMIN DASHBOARD API (PROTECTED)
// ==========================================

// Admin Login
app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Username and password required' });
  }

  try {
    const users = await query(`SELECT * FROM admin_users WHERE username = ?`, [username.trim()]);
    if (!users || users.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid username or password' });
    }

    const user = users[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ success: false, error: 'Invalid username or password' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, name: user.full_name },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ success: false, error: 'Authentication failed' });
  }
});

// Overview Metrics
app.get('/api/admin/overview', authenticateAdmin, async (req, res) => {
  try {
    // Total sales & completed orders
    const salesRows = await query(`SELECT COALESCE(SUM(total), 0) as totalSales FROM orders WHERE status != 'cancelled'`);
    const todaySalesRows = await query(`SELECT COALESCE(SUM(total), 0) as todaySales FROM orders WHERE status != 'cancelled' AND DATE(created_at) = CURDATE()`);

    // Counts by status
    const orderCounts = await query(`
      SELECT
        COUNT(*) as totalOrders,
        SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) as todayOrders,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pendingOrders,
        SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmedOrders,
        SUM(CASE WHEN status = 'preparing' THEN 1 ELSE 0 END) as preparingOrders,
        SUM(CASE WHEN status = 'ready' THEN 1 ELSE 0 END) as readyOrders,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completedOrders,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelledOrders
      FROM orders
    `);

    // Reservations count
    const resCounts = await query(`
      SELECT
        COUNT(*) as totalReservations,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pendingReservations,
        SUM(CASE WHEN reservation_date >= CURDATE() THEN 1 ELSE 0 END) as upcomingReservations
      FROM reservations
    `);

    // Active offers count
    const offersCount = await query(`SELECT COUNT(*) as activeOffers FROM offers WHERE is_active = 1`);

    // Recent 6 orders
    const recentOrders = await query(`
      SELECT o.id, o.order_number, o.order_type, o.status, o.total, o.created_at, c.name as customer_name, c.phone as customer_phone
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      ORDER BY o.created_at DESC
      LIMIT 6
    `);

    res.json({
      success: true,
      stats: {
        totalSales: parseFloat(salesRows[0]?.totalSales || 0),
        todaySales: parseFloat(todaySalesRows[0]?.todaySales || 0),
        totalOrders: parseInt(orderCounts[0]?.totalOrders, 10) || 0,
        todayOrders: parseInt(orderCounts[0]?.todayOrders, 10) || 0,
        pendingOrders: parseInt(orderCounts[0]?.pendingOrders, 10) || 0,
        confirmedOrders: parseInt(orderCounts[0]?.confirmedOrders, 10) || 0,
        preparingOrders: parseInt(orderCounts[0]?.preparingOrders, 10) || 0,
        readyOrders: parseInt(orderCounts[0]?.readyOrders, 10) || 0,
        completedOrders: parseInt(orderCounts[0]?.completedOrders, 10) || 0,
        cancelledOrders: parseInt(orderCounts[0]?.cancelledOrders, 10) || 0,
        pendingReservations: parseInt(resCounts[0]?.pendingReservations, 10) || 0,
        upcomingReservations: parseInt(resCounts[0]?.upcomingReservations, 10) || 0,
        activeOffers: parseInt(offersCount[0]?.activeOffers, 10) || 0
      },
      recentOrders
    });
  } catch (err) {
    console.error('Error in admin overview:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch overview metrics' });
  }
});

// Orders List with filtering
app.get('/api/admin/orders', authenticateAdmin, async (req, res) => {
  try {
    const { status, search } = req.query;
    let sql = `
      SELECT o.id, o.order_number, o.order_type, o.status, o.subtotal, o.discount, o.delivery_fee, o.total,
             o.promo_code, o.special_instructions, o.created_at,
             c.name as customer_name, c.phone as customer_phone, c.address as customer_address
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== 'all') {
      sql += ` AND o.status = ?`;
      params.push(status);
    }

    if (search && search.trim()) {
      sql += ` AND (o.order_number LIKE ? OR c.name LIKE ? OR c.phone LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    sql += ` ORDER BY o.created_at DESC LIMIT 100`;

    const orders = await query(sql, params);

    // Fetch items for all returned orders
    if (orders.length > 0) {
      const orderIds = orders.map(o => o.id);
      const items = await query(
        `SELECT order_id, item_name, variant, unit_price, quantity, line_total FROM order_items WHERE order_id IN (?)`,
        [orderIds]
      );
      const itemsByOrderId = {};
      items.forEach(it => {
        if (!itemsByOrderId[it.order_id]) itemsByOrderId[it.order_id] = [];
        itemsByOrderId[it.order_id].push(it);
      });
      orders.forEach(o => {
        o.items = itemsByOrderId[o.id] || [];
      });
    }

    res.json({ success: true, orders });
  } catch (err) {
    console.error('Error fetching admin orders:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch orders' });
  }
});

// Update Order Status
app.patch('/api/admin/orders/:id/status', authenticateAdmin, async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, error: 'Invalid order status' });
  }

  try {
    await query(`UPDATE orders SET status = ? WHERE id = ?`, [status, req.params.id]);
    res.json({ success: true, message: `Order status updated to ${status}` });
  } catch (err) {
    console.error('Error updating order status:', err);
    res.status(500).json({ success: false, error: 'Failed to update order status' });
  }
});

// Reservations List
app.get('/api/admin/reservations', authenticateAdmin, async (req, res) => {
  try {
    const { status, date } = req.query;
    let sql = `SELECT * FROM reservations WHERE 1=1`;
    const params = [];

    if (status && status !== 'all') {
      sql += ` AND status = ?`;
      params.push(status);
    }

    if (date) {
      sql += ` AND reservation_date = ?`;
      params.push(date);
    }

    sql += ` ORDER BY reservation_date DESC, reservation_time ASC`;
    const reservations = await query(sql, params);
    res.json({ success: true, reservations });
  } catch (err) {
    console.error('Error fetching reservations:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch reservations' });
  }
});

// Update Reservation Status
app.patch('/api/admin/reservations/:id/status', authenticateAdmin, async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['pending', 'confirmed', 'cancelled', 'completed'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, error: 'Invalid reservation status' });
  }

  try {
    await query(`UPDATE reservations SET status = ? WHERE id = ?`, [status, req.params.id]);
    res.json({ success: true, message: `Reservation marked as ${status}` });
  } catch (err) {
    console.error('Error updating reservation:', err);
    res.status(500).json({ success: false, error: 'Failed to update reservation' });
  }
});

// Admin Menu List (Includes unavailable items)
app.get('/api/admin/menu', authenticateAdmin, async (req, res) => {
  try {
    const categories = await query(`SELECT * FROM menu_categories ORDER BY display_order ASC`);
    const items = await query(`
      SELECT m.*, c.name as category_name
      FROM menu_items m
      JOIN menu_categories c ON m.category_id = c.id
      ORDER BY m.category_id ASC, m.display_order ASC, m.name ASC
    `);
    res.json({ success: true, categories, items });
  } catch (err) {
    console.error('Error fetching admin menu:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch menu' });
  }
});

// Create Dish
app.post('/api/admin/menu/items', authenticateAdmin, async (req, res) => {
  const { category_id, name, description, price, half_price, image_url, is_popular, is_available } = req.body;

  if (!category_id || !name || price === undefined) {
    return res.status(400).json({ success: false, error: 'Category, dish name, and price are required' });
  }

  try {
    const result = await query(
      `INSERT INTO menu_items (category_id, name, description, price, half_price, image_url, is_popular, is_available)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        category_id,
        name.trim(),
        description || '',
        parseFloat(price),
        half_price ? parseFloat(half_price) : null,
        image_url || null,
        is_popular ? 1 : 0,
        is_available !== undefined ? (is_available ? 1 : 0) : 1
      ]
    );

    res.json({ success: true, itemId: result.insertId, message: 'Dish added successfully' });
  } catch (err) {
    console.error('Error adding dish:', err);
    res.status(500).json({ success: false, error: 'Failed to add dish' });
  }
});

// Update Dish
app.put('/api/admin/menu/items/:id', authenticateAdmin, async (req, res) => {
  const { category_id, name, description, price, half_price, image_url, is_popular, is_available } = req.body;

  try {
    await query(
      `UPDATE menu_items
       SET category_id = COALESCE(?, category_id),
           name = COALESCE(?, name),
           description = COALESCE(?, description),
           price = COALESCE(?, price),
           half_price = COALESCE(?, half_price),
           image_url = COALESCE(?, image_url),
           is_popular = COALESCE(?, is_popular),
           is_available = COALESCE(?, is_available)
       WHERE id = ?`,
      [
        category_id !== undefined ? category_id : null,
        name !== undefined ? name : null,
        description !== undefined ? description : null,
        price !== undefined ? parseFloat(price) : null,
        half_price !== undefined ? (half_price ? parseFloat(half_price) : null) : null,
        image_url !== undefined ? image_url : null,
        is_popular !== undefined ? (is_popular ? 1 : 0) : null,
        is_available !== undefined ? (is_available ? 1 : 0) : null,
        req.params.id
      ]
    );

    res.json({ success: true, message: 'Dish updated successfully' });
  } catch (err) {
    console.error('Error updating dish:', err);
    res.status(500).json({ success: false, error: 'Failed to update dish' });
  }
});

// Delete Dish
app.delete('/api/admin/menu/items/:id', authenticateAdmin, async (req, res) => {
  try {
    await query(`DELETE FROM menu_items WHERE id = ?`, [req.params.id]);
    res.json({ success: true, message: 'Dish removed from menu' });
  } catch (err) {
    console.error('Error deleting dish:', err);
    res.status(500).json({ success: false, error: 'Failed to remove dish' });
  }
});

// Admin Offers
app.get('/api/admin/offers', authenticateAdmin, async (req, res) => {
  try {
    const offers = await query(`SELECT * FROM offers ORDER BY created_at DESC`);
    res.json({ success: true, offers });
  } catch (err) {
    console.error('Error fetching admin offers:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch offers' });
  }
});

// Create Offer
app.post('/api/admin/offers', authenticateAdmin, async (req, res) => {
  const { title, description, promo_code, discount_percent, min_order_amount, is_active } = req.body;

  if (!title || !promo_code || discount_percent === undefined) {
    return res.status(400).json({ success: false, error: 'Title, promo code, and discount percent are required' });
  }

  try {
    const result = await query(
      `INSERT INTO offers (title, description, promo_code, discount_percent, min_order_amount, is_active)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        title.trim(),
        description || '',
        promo_code.trim().toUpperCase(),
        parseInt(discount_percent, 10),
        min_order_amount ? parseFloat(min_order_amount) : 0,
        is_active !== undefined ? (is_active ? 1 : 0) : 1
      ]
    );

    // Notify customer app via in-app notification
    await query(
      `INSERT INTO notifications (title, message, type) VALUES (?, ?, ?)`,
      [`New Offer: ${title}`, `Use promo code ${promo_code.toUpperCase()} for ${discount_percent}% off!`, 'offer']
    );

    res.json({ success: true, offerId: result.insertId, message: 'Promotional offer created' });
  } catch (err) {
    console.error('Error creating offer:', err);
    res.status(500).json({ success: false, error: 'Failed to create offer' });
  }
});

// Toggle / Update Offer
app.put('/api/admin/offers/:id', authenticateAdmin, async (req, res) => {
  const { title, description, promo_code, discount_percent, min_order_amount, is_active } = req.body;

  try {
    await query(
      `UPDATE offers
       SET title = COALESCE(?, title),
           description = COALESCE(?, description),
           promo_code = COALESCE(?, promo_code),
           discount_percent = COALESCE(?, discount_percent),
           min_order_amount = COALESCE(?, min_order_amount),
           is_active = COALESCE(?, is_active)
       WHERE id = ?`,
      [
        title !== undefined ? title : null,
        description !== undefined ? description : null,
        promo_code !== undefined ? promo_code.toUpperCase() : null,
        discount_percent !== undefined ? parseInt(discount_percent, 10) : null,
        min_order_amount !== undefined ? parseFloat(min_order_amount) : null,
        is_active !== undefined ? (is_active ? 1 : 0) : null,
        req.params.id
      ]
    );

    res.json({ success: true, message: 'Offer updated successfully' });
  } catch (err) {
    console.error('Error updating offer:', err);
    res.status(500).json({ success: false, error: 'Failed to update offer' });
  }
});

// Delete Offer
app.delete('/api/admin/offers/:id', authenticateAdmin, async (req, res) => {
  try {
    await query(`DELETE FROM offers WHERE id = ?`, [req.params.id]);
    res.json({ success: true, message: 'Offer deleted' });
  } catch (err) {
    console.error('Error deleting offer:', err);
    res.status(500).json({ success: false, error: 'Failed to delete offer' });
  }
});

// Real Database Sales Analytics
app.get('/api/admin/analytics', authenticateAdmin, async (req, res) => {
  try {
    // 7 days daily sales
    const dailySales = await query(`
      SELECT DATE_FORMAT(created_at, '%b %d') as date_label, DATE(created_at) as raw_date,
             COALESCE(SUM(total), 0) as revenue, COUNT(*) as order_count
      FROM orders
      WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) AND status != 'cancelled'
      GROUP BY raw_date, date_label
      ORDER BY raw_date ASC
    `);

    // Orders by order type
    const orderTypes = await query(`
      SELECT order_type, COUNT(*) as count, COALESCE(SUM(total), 0) as total_sales
      FROM orders
      WHERE status != 'cancelled'
      GROUP BY order_type
    `);

    // Top 5 popular dishes
    const topDishes = await query(`
      SELECT item_name, SUM(quantity) as total_qty, SUM(line_total) as total_revenue
      FROM order_items
      GROUP BY item_name
      ORDER BY total_qty DESC
      LIMIT 5
    `);

    // Average order value
    const aovRows = await query(`
      SELECT COALESCE(AVG(total), 0) as avgOrderValue, COUNT(*) as totalOrders
      FROM orders
      WHERE status != 'cancelled'
    `);

    res.json({
      success: true,
      dailySales,
      orderTypes,
      topDishes,
      avgOrderValue: Math.round(parseFloat(aovRows[0]?.avgOrderValue || 0)),
      totalOrdersCount: parseInt(aovRows[0]?.totalOrders, 10) || 0
    });
  } catch (err) {
    console.error('Error fetching analytics:', err);
    res.status(500).json({ success: false, error: 'Failed to load analytics' });
  }
});

// Notifications
app.get('/api/admin/notifications', authenticateAdmin, async (req, res) => {
  try {
    const notifications = await query(`SELECT * FROM notifications ORDER BY created_at DESC LIMIT 20`);
    res.json({ success: true, notifications });
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({ success: false, error: 'Failed to load notifications' });
  }
});

// Broadcast Push Notification endpoint
app.post('/api/admin/broadcast-push', authenticateAdmin, async (req, res) => {
  try {
    const { title, message, promo } = req.body;
    if (!title || !message) {
      return res.status(400).json({ success: false, error: 'Title and message are required' });
    }
    const fullMessage = message + (promo ? ` (Use Code: ${promo})` : '');
    await query(
      `INSERT INTO notifications (title, message, type, target) VALUES (?, ?, 'broadcast', 'all')`,
      [title, fullMessage]
    );
    res.json({ success: true, message: 'Notification broadcasted and logged successfully' });
  } catch (err) {
    console.error('Error broadcasting push notification:', err);
    res.status(500).json({ success: false, error: 'Failed to record broadcast' });
  }
});

// Network information endpoint for mobile Wi-Fi QR resolution
app.get('/api/network-info', (req, res) => {
  const localIP = getLocalIP();
  res.json({
    success: true,
    localIP,
    port: PORT,
    mobileUrl: `http://${localIP}:${PORT}/`,
    localhostUrl: `http://localhost:${PORT}/`
  });
});

// Real dynamic, scannable QR code generator
app.get('/api/qr-image', async (req, res) => {
  try {
    const defaultUrl = `http://${getLocalIP()}:${PORT}/`;
    const targetUrl = req.query.url || defaultUrl;

    const svgString = await QRCode.toString(targetUrl, {
      type: 'svg',
      color: {
        dark: '#17130f',
        light: '#ffffff'
      },
      margin: 1,
      width: 260,
      errorCorrectionLevel: 'M'
    });

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(svgString);
  } catch (err) {
    console.error('QR Generation error:', err);
    res.status(500).send('Error generating QR code');
  }
});

// Catch-all route to serve index.html for single page navigation if requested
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Express Server bound to 0.0.0.0 so mobile devices on the same Wi-Fi can connect
const server = app.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIP();
  console.log(`🚀 OTAQ Full-Stack Restaurant Server running at:`);
  console.log(`   🖥️  Local (PC):       http://localhost:${PORT}`);
  console.log(`   📱 Mobile (Wi-Fi):   http://${ip}:${PORT}`);
  console.log(`   👑 Admin Dashboard:  http://localhost:${PORT}/admin.html`);
});

module.exports = { app, server };
