const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function initDatabase() {
  console.log('🔄 Initializing OTAQ Restaurant MySQL Database...');

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    multipleStatements: true
  });

  try {
    // 1. Create database if not exists
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`otaq_restaurant\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await connection.query(`USE \`otaq_restaurant\`;`);
    console.log('✅ Database `otaq_restaurant` is ready.');

    // 2. Read and run schema.sql
    const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
    await connection.query(schemaSql);
    console.log('✅ Schema tables verified/created successfully.');

    // 3. Seed Admin User
    const [existingAdmin] = await connection.query(`SELECT id FROM admin_users WHERE username = 'admin'`);
    if (existingAdmin.length === 0) {
      const passwordHash = await bcrypt.hash('otaq2026!', 10);
      await connection.query(
        `INSERT INTO admin_users (username, password_hash, full_name, email, role) VALUES (?, ?, ?, ?, ?)`,
        ['admin', passwordHash, 'OTAQ General Manager', 'owner@otaq.pk', 'owner']
      );
      console.log('✅ Default Admin created (Username: admin | Password: otaq2026!)');
    }

    // 4. Seed Categories
    const categories = [
      { id: 1, name: 'BBQ Specialties', slug: 'bbq', description: 'Freshly charcoal-grilled tikkas, boti and kababs', order: 1 },
      { id: 2, name: 'Desi Karahi & Handi', slug: 'karahi', description: 'Desi ghee karahis, makhni handis and slow-simmered gravies', order: 2 },
      { id: 3, name: 'Chinese & Pulao', slug: 'chinese', description: 'Wok-tossed gravies, classic fried rice and traditional aromatic pulao', order: 3 },
      { id: 4, name: 'Veg, Roti & Chai', slug: 'veg', description: 'Vegetarian delights, tandoori breads, Kashmiri and Koila chai', order: 4 }
    ];

    for (const cat of categories) {
      await connection.query(
        `INSERT INTO menu_categories (id, name, slug, description, display_order, is_active)
         VALUES (?, ?, ?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description), display_order = VALUES(display_order)`,
        [cat.id, cat.name, cat.slug, cat.description, cat.order]
      );
    }
    console.log('✅ Menu categories seeded.');

    // 5. Seed Dishes
    const dishes = [
      // BBQ (cat 1)
      { cat: 1, name: 'Otaq Special Chest Tikka', desc: 'Chicken chest tikka marinated in secret spices, listed among the restaurant’s popular menu highlights.', price: 550, half: null, pop: 1, img: 'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?w=500&auto=format&fit=crop&q=80' },
      { cat: 1, name: 'Chicken Tikka (Leg)', desc: 'Juicy chicken leg cut charcoal grilled to golden tenderness.', price: 500, half: null, pop: 0, img: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=500&auto=format&fit=crop&q=80' },
      { cat: 1, name: 'Chicken Green Tikka', desc: 'Infused with fresh mint, coriander, and green chillies.', price: 600, half: null, pop: 0, img: null },
      { cat: 1, name: 'Chicken Malai Tikka', desc: 'Melt-in-mouth chicken pieces simmered in fresh cream and mild aromatics.', price: 600, half: null, pop: 1, img: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=500&auto=format&fit=crop&q=80' },
      { cat: 1, name: 'Chicken Bihari Tikka', desc: 'Tenderized thinly sliced cuts seasoned with roasted cumin and crushed spices.', price: 800, half: null, pop: 0, img: null },
      { cat: 1, name: 'Kalmi Tikka', desc: 'Succulent drumsticks prepared over gentle embers with tangy marinade.', price: 1200, half: null, pop: 0, img: null },
      { cat: 1, name: 'Chicken Balochit Tikka', desc: 'Rich Balochi-style dry-fried BBQ finished with toasted coriander.', price: 1600, half: null, pop: 1, img: null },
      { cat: 1, name: 'Chicken Bihari Botti', desc: 'Boneless tender cuts of spicy bihari goodness.', price: 1120, half: null, pop: 0, img: null },
      { cat: 1, name: 'Chicken Malai Botti', desc: 'Silky cream and cardamom seasoned boneless skewers.', price: 900, half: null, pop: 1, img: null },
      { cat: 1, name: 'Reshmi Kabab', desc: 'Delicate minced chicken kabab seasoned with saffron and cream.', price: 800, half: null, pop: 1, img: null },
      { cat: 1, name: 'Chicken Cheese Kabab', desc: 'Stuffed with gooey cheddar and mozzarella cheese inside savory chicken mince.', price: 1000, half: null, pop: 1, img: null },
      { cat: 1, name: 'Chicken Gola Kabab', desc: 'Traditional rounded succulent kababs with intense smoke.', price: 800, half: null, pop: 0, img: null },
      { cat: 1, name: 'Beef Bihari Botti', desc: 'Thin melt-in-mouth beef slices marinated with raw papaya and Bihari spices.', price: 800, half: null, pop: 1, img: null },
      { cat: 1, name: 'Beef Seekh Kabab', desc: 'Classic spiced beef mince skewers roasted to perfection.', price: 900, half: null, pop: 1, img: null },
      { cat: 1, name: 'Mutton Namkeen Botti', desc: 'Salt-crusted tender mutton cubes cooked in traditional Shinwari style.', price: 2200, half: null, pop: 1, img: null },
      { cat: 1, name: 'Grilled Batair', desc: 'Delicately spiced grilled quail served smoking hot.', price: 1800, half: null, pop: 0, img: null },

      // Karahi & Handi (cat 2)
      { cat: 2, name: 'Desi Chicken Special Karahi', desc: 'Signature karahi prepared fresh with pure desi ghee, fresh tomatoes, and green chillies.', price: 4000, half: 2000, pop: 1, img: 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=500&auto=format&fit=crop&q=80' },
      { cat: 2, name: 'Desi Chicken Shahi Karahi', desc: 'Royal sauce enriched with crushed almonds and creamy gravy.', price: 3600, half: 1850, pop: 0, img: null },
      { cat: 2, name: 'Desi Chicken White Karahi', desc: 'Velvety yogurt and black pepper gravy with ginger juliennes.', price: 3600, half: 1850, pop: 1, img: null },
      { cat: 2, name: 'Desi Chicken Green Karahi', desc: 'Herbaceous green chilli and coriander base with fragrant spices.', price: 3600, half: 1850, pop: 0, img: null },
      { cat: 2, name: 'Desi Chicken Brown Karahi', desc: 'Deep roasted onion masala karahi with rich smoky note.', price: 3500, half: 1800, pop: 0, img: null },
      { cat: 2, name: 'Desi Chicken Peshawari Karahi', desc: 'Cooked with whole tomatoes, salt, animal fat and green chillies only.', price: 3400, half: 1750, pop: 1, img: null },
      { cat: 2, name: 'Desi Chicken Sizzler Karahi', desc: 'Served crackling on a piping cast-iron hot plate with butter.', price: 3400, half: 1750, pop: 0, img: null },
      { cat: 2, name: 'Desi Chicken Zaitoon Karahi', desc: 'Slow simmered with extra virgin olive oil and green olives.', price: 3800, half: 2000, pop: 0, img: null },
      { cat: 2, name: 'Mutton Special Karahi (Desi Ghee)', desc: 'Tender baby mutton pieces braised in desi ghee with coarse pepper.', price: 4500, half: 2300, pop: 1, img: 'https://images.unsplash.com/photo-1545247181-516773cae754?w=500&auto=format&fit=crop&q=80' },
      { cat: 2, name: 'Mutton Shahi Karahi', desc: 'Mutton cooked in rich tomato and nut emulsion.', price: 3800, half: 2000, pop: 0, img: null },
      { cat: 2, name: 'Mutton White Karahi', desc: 'Mild and luxurious white pepper mutton gravy.', price: 3500, half: 1850, pop: 0, img: null },
      { cat: 2, name: 'Special Chicken Makhni Handi', desc: 'Boneless tender chicken in silky butter and tomato cream.', price: 2600, half: 1300, pop: 1, img: null },
      { cat: 2, name: 'Special Chicken Reshmi Handi', desc: 'Mild and creamy boneless handi with gentle saffron undertones.', price: 2400, half: 1300, pop: 0, img: null },
      { cat: 2, name: 'Chicken Handi', desc: 'Traditional clay pot simmered chicken curry.', price: 2000, half: 1100, pop: 0, img: null },
      { cat: 2, name: 'Chicken Jalfrezi Handi', desc: 'Bell peppers, onions and juicy chicken in tangy sweet-sour sauce.', price: 2600, half: 1300, pop: 0, img: null },
      { cat: 2, name: 'Malai Kofta Handi', desc: 'Soft cottage cheese and potato dumplings in rich nut gravy.', price: 2800, half: 1500, pop: 0, img: null },
      { cat: 2, name: 'Chicken Achari Handi', desc: 'Zesty pickling spice masala bursting with mustard seeds and kalonji.', price: 2200, half: 1100, pop: 0, img: null },

      // Chinese & Pulao (cat 3)
      { cat: 3, name: 'Sindhi Desi Pulao', desc: 'Authentic Sindhi-style fragrant beef/mutton stock rice with mild spices.', price: 1400, half: null, pop: 1, img: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=500&auto=format&fit=crop&q=80' },
      { cat: 3, name: 'Kabuli Pulao', desc: 'Fragrant basmati rice topped with caramelized carrots, raisins and tender shank.', price: 1200, half: null, pop: 1, img: null },
      { cat: 3, name: 'Chicken Shashlik with Rice', desc: 'Tender chicken skewers with peppers and tomato gravy over egg fried rice.', price: 1200, half: null, pop: 1, img: null },
      { cat: 3, name: 'Chicken Manchurian with Rice', desc: 'Tangy red garlic sauce chicken accompanied by seasoned fried rice.', price: 1000, half: null, pop: 0, img: null },
      { cat: 3, name: 'Chicken Chilly Dry with Rice', desc: 'Crispy chicken tossed with sliced green chillies, ginger and soy sauce.', price: 1250, half: null, pop: 1, img: null },
      { cat: 3, name: 'Chicken Dragon with Rice', desc: 'Fiery sweet-and-spicy glazed strips with garlic rice.', price: 1250, half: null, pop: 0, img: null },
      { cat: 3, name: 'Beef Chili Dry with Rice', desc: 'Sliced undercut beef flash-fried with fresh serrano chillies.', price: 1500, half: null, pop: 1, img: null },
      { cat: 3, name: 'Singaporean Rice', desc: 'Layered noodles, seasoned rice, shredded chicken and spicy mayo glaze.', price: 800, half: null, pop: 1, img: null },
      { cat: 3, name: 'Chicken Chowmein', desc: 'Stir-fried egg noodles with shredded chicken and crunchy vegetables.', price: 1200, half: null, pop: 1, img: null },
      { cat: 3, name: 'Alfredo Pasta', desc: 'Penne in rich parmesan cream sauce with grilled herb chicken.', price: 1200, half: null, pop: 0, img: null },
      { cat: 3, name: 'Chicken Fried Rice', desc: 'Wok-tossed fluffy basmati rice with eggs, shredded chicken and scallions.', price: 480, half: null, pop: 0, img: null },
      { cat: 3, name: 'Egg Fried Rice', desc: 'Fragrant wok-fried rice with scrambled egg ribbon.', price: 500, half: null, pop: 0, img: null },
      { cat: 3, name: 'Plain Rice', desc: 'Steamed basmati rice grains.', price: 300, half: null, pop: 0, img: null },

      // Veg, Roti & Tea (cat 4)
      { cat: 4, name: 'Mix Vegetable', desc: 'Seasonal vegetables sauteed with mild ground cumin and turmeric.', price: 400, half: null, pop: 0, img: null },
      { cat: 4, name: 'Dal Makhani', desc: 'Slow simmered black lentils and kidney beans enriched with dairy cream and butter.', price: 550, half: null, pop: 1, img: null },
      { cat: 4, name: 'Beh Saag (Seasonal)', desc: 'Traditional lotus root cooked with tender spinach leaves — a true Sindhi delicacy.', price: 500, half: null, pop: 1, img: null },
      { cat: 4, name: 'Bhindi Fry', desc: 'Crispy pan-fried okra tossed with onions, tomatoes and amchur.', price: 450, half: null, pop: 0, img: null },
      { cat: 4, name: 'Roghani / Garlic / Ginger Naan', desc: 'Tandoori flatbread brushed with butter and sesame or roasted garlic.', price: 85, half: null, pop: 1, img: null },
      { cat: 4, name: 'Cheese Naan', desc: 'Oven baked stuffed flatbread with molten mozzarella and herbs.', price: 350, half: null, pop: 1, img: null },
      { cat: 4, name: 'Doodh Pati Chai', desc: 'Rich slow-boiled full-cream milk tea made with premium tea leaves.', price: 170, half: null, pop: 1, img: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=500&auto=format&fit=crop&q=80' },
      { cat: 4, name: 'Koila Chai / Gurr Chai', desc: 'Brewed over burning coal embers with raw organic jaggery.', price: 190, half: null, pop: 1, img: null },
      { cat: 4, name: 'Kashmiri Chai', desc: 'Pink floral tea infused with star anise, cardamom, and slivered pistachios.', price: 600, half: null, pop: 1, img: null },
      { cat: 4, name: 'Cold Coffee', desc: 'Frothy chilled coffee blended with dairy cream and chocolate shavings.', price: 440, half: null, pop: 0, img: null }
    ];

    const [existingDishes] = await connection.query(`SELECT COUNT(*) as count FROM menu_items`);
    if (existingDishes[0].count === 0) {
      for (let i = 0; i < dishes.length; i++) {
        const d = dishes[i];
        await connection.query(
          `INSERT INTO menu_items (category_id, name, description, price, half_price, image_url, is_popular, is_available, display_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
          [d.cat, d.name, d.desc, d.price, d.half, d.img, d.pop, i + 1]
        );
      }
      console.log(`✅ Seeded ${dishes.length} menu items.`);
    }

    // 6. Seed Offers
    const [existingOffers] = await connection.query(`SELECT COUNT(*) as count FROM offers`);
    if (existingOffers[0].count === 0) {
      await connection.query(
        `INSERT INTO offers (title, description, promo_code, discount_percent, min_order_amount, is_active) VALUES
         (?, ?, ?, ?, ?, 1),
         (?, ?, ?, ?, ?, 1)`,
        [
          'Johar Grand Dining Offer',
          'Enjoy 15% flat discount on all dinner deliveries and family pickup orders above Rs 2,500.',
          'JOHAR15',
          15,
          2500,
          'Late Night Chai Feast',
          'Get 10% instant off on late night BBQ & Chai orders from 11 PM to 4 AM.',
          'NIGHT10',
          10,
          1500
        ]
      );
      console.log('✅ Active promotional offers seeded.');
    }

    // 7. Seed Sample Orders and Reservations for instant demonstration
    const [existingOrders] = await connection.query(`SELECT COUNT(*) as count FROM orders`);
    if (existingOrders[0].count === 0) {
      // Sample Customer 1
      const [c1] = await connection.query(
        `INSERT INTO customers (name, phone, address, notes) VALUES (?, ?, ?, ?)`,
        ['Hamza Farooq', '03001234567', 'Flat 402, Rufi Lake View, Gulistan-e-Johar Block 10', 'Ring doorbell twice']
      );
      const custId1 = c1.insertId;

      // Sample Customer 2
      const [c2] = await connection.query(
        `INSERT INTO customers (name, phone, address, notes) VALUES (?, ?, ?, ?)`,
        ['Sana Tariq', '03219876543', 'B-14, Block 9 Gulistan-e-Johar, Karachi', 'Near Continental Bakery']
      );
      const custId2 = c2.insertId;

      // Order 1 (Preparing)
      const [o1] = await connection.query(
        `INSERT INTO orders (order_number, customer_id, order_type, status, subtotal, discount, delivery_fee, total, promo_code, special_instructions)
         VALUES (?, ?, 'delivery', 'preparing', 2550.00, 382.50, 150.00, 2317.50, 'JOHAR15', 'Make karahi medium spicy please')`,
        ['ORD-2026-1001', custId1]
      );
      await connection.query(
        `INSERT INTO order_items (order_id, menu_item_id, item_name, variant, unit_price, quantity, line_total) VALUES
         (?, 1, 'Otaq Special Chest Tikka', 'Regular', 550.00, 1, 550.00),
         (?, 17, 'Desi Chicken Special Karahi', 'Half', 2000.00, 1, 2000.00)`,
        [o1.insertId, o1.insertId]
      );

      // Order 2 (Completed)
      const [o2] = await connection.query(
        `INSERT INTO orders (order_number, customer_id, order_type, status, subtotal, discount, delivery_fee, total, promo_code, special_instructions)
         VALUES (?, ?, 'pickup', 'completed', 1900.00, 0.00, 0.00, 1900.00, NULL, 'Pack with extra green mint chutney')`,
        ['ORD-2026-1002', custId2]
      );
      await connection.query(
        `INSERT INTO order_items (order_id, menu_item_id, item_name, variant, unit_price, quantity, line_total) VALUES
         (?, 34, 'Sindhi Desi Pulao', 'Regular', 1400.00, 1, 1400.00),
         (?, 49, 'Doodh Pati Chai', 'Regular', 170.00, 2, 340.00),
         (?, 47, 'Cheese Naan', 'Regular', 350.00, 1, 350.00)`,
        [o2.insertId, o2.insertId, o2.insertId]
      );

      console.log('✅ Sample orders and order items seeded for analytics.');
    }

    // 8. Seed Sample Reservations
    const [existingRes] = await connection.query(`SELECT COUNT(*) as count FROM reservations`);
    if (existingRes[0].count === 0) {
      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

      await connection.query(
        `INSERT INTO reservations (customer_name, customer_phone, reservation_date, reservation_time, guests_count, seating_area, special_requests, status) VALUES
         (?, ?, ?, '08:30 PM', 5, 'Open Air Cultural', 'Family dinner, prefer outdoor corner table', 'confirmed'),
         (?, ?, ?, '09:00 PM', 2, 'Indoor Family Lounge', 'Anniversary celebration', 'pending')`,
        ['Dr. Aftab Memon', '03332456789', today, 'Zubair Qureshi', '03458901234', tomorrow]
      );
      console.log('✅ Sample reservations seeded.');
    }

    // 9. Seed Restaurant Settings
    const settings = [
      ['restaurant_name', 'OTAQ Family Restaurant', 'Official trade name'],
      ['restaurant_tagline', 'A place to eat, sit & stay awhile', 'Brand motto'],
      ['phone_number', '+923092067977', 'Primary contact phone'],
      ['address', 'PHA Apartments, Scheme Road, Block 10 Gulistan-e-Johar, Karachi', 'Physical address'],
      ['delivery_fee', '150.00', 'Standard local delivery fee in PKR'],
      ['min_order_delivery', '800.00', 'Minimum order required for home delivery'],
      ['currency_symbol', 'Rs', 'Currency display symbol'],
      ['operating_hours', 'Daily 5:00 PM - 5:00 AM', 'Restaurant operational schedule']
    ];

    for (const [key, val, desc] of settings) {
      await connection.query(
        `INSERT INTO restaurant_settings (setting_key, setting_value, description)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), description = VALUES(description)`,
        [key, val, desc]
      );
    }
    console.log('✅ Restaurant settings seeded.');

    console.log('🎉 OTAQ Database initialization completed successfully!');
  } catch (err) {
    console.error('❌ Database Initialization Error:', err);
    throw err;
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  initDatabase().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = initDatabase;
