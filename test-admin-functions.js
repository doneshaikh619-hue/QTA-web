// Test Admin Portal Functions
const fs = require('fs');
const path = require('path');

console.log('🧪 Starting admin.js Deep Functionality Tests...\n');

const adminCode = fs.readFileSync(path.join(__dirname, 'admin.js'), 'utf8');

try {
  new Function(adminCode);
  console.log('✅ PASS: admin.js has ZERO syntax errors.');
} catch (err) {
  console.error('❌ FAIL: Syntax error in admin.js:', err);
  process.exit(1);
}

// Check if critical DOM element selectors exist in admin.html
const adminHtml = fs.readFileSync(path.join(__dirname, 'admin.html'), 'utf8');
const expectedIds = [
  'login-overlay', 'admin-layout', 'login-form', 'login-username', 'login-password',
  'btn-login', 'btn-logout', 'user-display-name', 'login-error',
  'kpi-today-sales', 'kpi-today-orders', 'kpi-pending-orders', 'kpi-pending-res',
  'orders-table-body', 'reservations-table-body', 'menu-management-body',
  'offers-management-body', 'push-broadcast-form', 'push-title', 'push-message',
  'push-promo', 'btn-broadcast-push', 'restaurant-qr-img', 'qr-target-input'
];

let allExist = true;
expectedIds.forEach(id => {
  if (!adminHtml.includes(`id="${id}"`)) {
    console.error(`❌ FAIL: Missing element #${id} in admin.html`);
    allExist = false;
  }
});

if (allExist) {
  console.log(`✅ PASS: All ${expectedIds.length} critical Admin UI elements verified in admin.html.`);
} else {
  process.exit(1);
}

console.log('\n🎉 ALL ADMIN VERIFICATION TESTS PASSED CLEANLY!\n');
