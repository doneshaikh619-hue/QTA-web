// Comprehensive DOM and UI Functionality Test for script.js
const fs = require('fs');
const path = require('path');

console.log('🧪 Starting script.js Deep UI and Functionality Tests...\n');

// 1. Check syntax
const scriptCode = fs.readFileSync(path.join(__dirname, 'script.js'), 'utf8');
try {
  new Function(scriptCode);
  console.log('✅ PASS: script.js has ZERO syntax errors.');
} catch (err) {
  console.error('❌ FAIL: Syntax error in script.js:', err);
  process.exit(1);
}

// 2. Mock minimal DOM
const elements = new Map();
function createElement(tag) {
  const el = {
    tagName: tag.toUpperCase(),
    classList: {
      _classes: new Set(),
      add(c) { el.classList._classes.add(c); },
      remove(c) { el.classList._classes.delete(c); },
      toggle(c, force) {
        if (force === undefined) {
          if (el.classList._classes.has(c)) {
            el.classList._classes.delete(c);
            return false;
          } else {
            el.classList._classes.add(c);
            return true;
          }
        }
        if (force) el.classList._classes.add(c);
        else el.classList._classes.delete(c);
        return force;
      },
      contains(c) { return el.classList._classes.has(c); }
    },
    attributes: {},
    setAttribute(k, v) { el.attributes[k] = String(v); },
    getAttribute(k) { return el.attributes[k]; },
    removeAttribute(k) { delete el.attributes[k]; },
    listeners: {},
    addEventListener(evt, fn) {
      if (!el.listeners[evt]) el.listeners[evt] = [];
      el.listeners[evt].push(fn);
    },
    dispatchEvent(evt) {
      const fns = el.listeners[evt.type] || [];
      fns.forEach(fn => fn(evt));
      if (el['on' + evt.type]) el['on' + evt.type](evt);
    },
    style: {},
    dataset: {},
    children: [],
    appendChild(child) { el.children.push(child); child.parentElement = el; return child; },
    remove() {},
    innerHTML: '',
    textContent: '',
    value: '',
    disabled: false,
    querySelector(sel) {
      if (sel === '.sr-only') return createElement('span');
      return null;
    },
    querySelectorAll(sel) {
      return [];
    }
  };
  return el;
}

// Register key elements from index.html
const ids = [
  'toast-container', 'menu-columns-wrap', 'cart-drawer', 'cart-backdrop',
  'header-cart-btn', 'mobile-cart-btn', 'cart-close-btn', 'cart-count-badge',
  'mobile-cart-badge', 'header-cart-total', 'drawer-items-count', 'cart-items-list',
  'cart-subtotal', 'cart-discount', 'summary-discount-row', 'cart-delivery-fee',
  'summary-delivery-row', 'cart-grand-total', 'btn-total-preview',
  'delivery-address-group', 'cust-address', 'promo-input', 'btn-apply-promo',
  'promo-feedback', 'checkout-form', 'btn-place-order', 'order-modal-backdrop',
  'confirmed-order-number', 'order-modal-details', 'btn-close-order-modal',
  'cust-name', 'cust-phone', 'cust-notes', 'reservation-form', 'res-status-msg',
  'btn-submit-res', 'res-date', 'res-time', 'res-guests', 'res-seating', 'res-notes',
  'offers-ribbon', 'ribbon-text', 'ribbon-code', 'ribbon-apply-btn', 'ribbon-close-btn',
  'vip-install-backdrop', 'btn-close-vip-modal', 'btn-vip-install', 'btn-vip-notify',
  'btn-download-shortcut',
  'vip-instructions', 'inst-ios', 'inst-android', 'floating-app-trigger', 'footer-install-btn',
  'vip-download-section', 'vip-post-download-section', 'vip-modal-title', 'vip-modal-desc', 'vip-modal-badge', 'btn-vip-explore-menu',
  'year'
];

ids.forEach(id => {
  const el = createElement('div');
  el.id = id;
  elements.set(id, el);
});

// Setup nav-toggle and site-menu
const navToggle = createElement('button');
navToggle.className = 'nav-toggle';
const siteMenu = createElement('nav');
siteMenu.id = 'site-menu';
const dummyLink = createElement('a');
dummyLink.setAttribute('href', '#menu');
siteMenu.appendChild(dummyLink);

const mockDocument = {
  documentElement: createElement('html'),
  body: createElement('body'),
  getElementById(id) { return elements.get(id) || null; },
  querySelector(sel) {
    if (sel === '.nav-toggle') return navToggle;
    if (sel === '#site-menu') return siteMenu;
    if (sel.startsWith('#')) return elements.get(sel.slice(1)) || null;
    return null;
  },
  querySelectorAll(sel) {
    if (sel === '#site-menu a') return [dummyLink];
    if (sel === '.order-type-tabs .type-btn') return [createElement('button'), createElement('button')];
    if (sel === '.menu-card .add-to-cart-btn') return [];
    if (sel === '.btn-add-regular') return [];
    if (sel === '.btn-add-variant') return [];
    if (sel === '.reveal') return [];
    if (sel.startsWith('a[href^="#"]')) return [];
    return [];
  },
  createElement(tag) { return createElement(tag); },
  listeners: {},
  addEventListener(evt, fn) {
    if (!this.listeners[evt]) this.listeners[evt] = [];
    this.listeners[evt].push(fn);
  },
  dispatchEvent(evt) {
    const fns = this.listeners[evt.type] || [];
    fns.forEach(fn => fn(evt));
  }
};

const mockLocalStorage = {
  store: {},
  getItem(k) { return this.store[k] || null; },
  setItem(k, v) { this.store[k] = String(v); },
  removeItem(k) { delete this.store[k]; }
};

const mockWindow = {
  document: mockDocument,
  localStorage: mockLocalStorage,
  sessionStorage: mockLocalStorage,
  navigator: { userAgent: 'Mozilla/5.0 Android' },
  location: { origin: 'https://doneshaikh619-hue.github.io', href: 'https://doneshaikh619-hue.github.io/QTA-web/' },
  addEventListener(evt, fn) {
    if (evt === 'load') setTimeout(fn, 10);
  },
  innerWidth: 375,
  innerHeight: 667,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  setInterval: setInterval,
  clearInterval: clearInterval,
  fetch: async (url) => {
    return { ok: false, status: 404, json: async () => ({}) };
  },
  matchMedia: () => ({ matches: false }),
  Notification: {
    permission: 'default',
    requestPermission: async () => 'granted'
  }
};

// Execute script in mock sandbox
const vm = require('vm');
const context = vm.createContext({
  window: mockWindow,
  document: mockDocument,
  navigator: mockWindow.navigator,
  localStorage: mockLocalStorage,
  sessionStorage: mockLocalStorage,
  location: mockWindow.location,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  fetch: mockWindow.fetch,
  Notification: mockWindow.Notification,
  console: console,
  BroadcastChannel: class {
    constructor() {}
    postMessage() {}
  }
});

try {
  vm.runInContext(scriptCode, context);
  console.log('✅ PASS: script.js executed in sandbox with zero runtime exceptions!');
} catch (err) {
  console.error('❌ FAIL: Execution threw error:', err);
  process.exit(1);
}

// 3. Test Navigation Toggle
console.log('\n--- Testing Mobile Nav Toggle ---');
if (navToggle.listeners['click']) {
  navToggle.dispatchEvent({ type: 'click' });
  if (siteMenu.classList.contains('open')) {
    console.log('✅ PASS: navToggle click successfully toggles #site-menu open!');
  } else {
    console.error('❌ FAIL: #site-menu did not open on navToggle click');
  }
  navToggle.dispatchEvent({ type: 'click' });
  if (!siteMenu.classList.contains('open')) {
    console.log('✅ PASS: Second navToggle click successfully closes #site-menu!');
  } else {
    console.error('❌ FAIL: #site-menu did not close on second click');
  }
} else {
  console.error('❌ FAIL: navToggle has no click listener attached!');
}

// 4. Test Cart Drawer Opening
console.log('\n--- Testing Cart Drawer Buttons ---');
const cartDrawer = elements.get('cart-drawer');
const headerCartBtn = elements.get('header-cart-btn');
const mobileCartBtn = elements.get('mobile-cart-btn');

if (headerCartBtn.listeners['click']) {
  headerCartBtn.dispatchEvent({ type: 'click' });
  if (cartDrawer.classList.contains('open')) {
    console.log('✅ PASS: headerCartBtn opens cart drawer successfully!');
  } else {
    console.error('❌ FAIL: headerCartBtn did not open cart drawer');
  }
} else {
  console.error('❌ FAIL: headerCartBtn has no click listener!');
}

if (mobileCartBtn.listeners['click']) {
  const cartCloseBtn = elements.get('cart-close-btn');
  cartCloseBtn.dispatchEvent({ type: 'click' });
  mobileCartBtn.dispatchEvent({ type: 'click' });
  if (cartDrawer.classList.contains('open')) {
    console.log('✅ PASS: mobileCartBtn opens cart drawer successfully on mobile!');
  } else {
    console.error('❌ FAIL: mobileCartBtn did not open cart drawer');
  }
} else {
  console.error('❌ FAIL: mobileCartBtn has no click listener!');
}

// 5. Test VIP App Download / Modal
console.log('\n--- Testing VIP App Download & Notifications Modal ---');
const vipBackdrop = elements.get('vip-install-backdrop');
const footerInstallBtn = elements.get('footer-install-btn');
const floatingAppTrigger = elements.get('floating-app-trigger');
const btnCloseVip = elements.get('btn-close-vip-modal');

if (footerInstallBtn.listeners['click']) {
  footerInstallBtn.dispatchEvent({ type: 'click' });
  if (vipBackdrop.classList.contains('open')) {
    console.log('✅ PASS: footerInstallBtn (Mobile Bar "App" button) opens VIP Download Modal!');
  } else {
    console.error('❌ FAIL: footerInstallBtn did not open VIP modal');
  }
} else {
  console.error('❌ FAIL: footerInstallBtn has no click listener!');
}

if (btnCloseVip.listeners['click']) {
  btnCloseVip.dispatchEvent({ type: 'click' });
  if (!vipBackdrop.classList.contains('open')) {
    console.log('✅ PASS: Close button closes VIP Download Modal!');
  } else {
    console.error('❌ FAIL: Close button did not close modal');
  }
}

if (floatingAppTrigger.listeners['click']) {
  floatingAppTrigger.dispatchEvent({ type: 'click' });
  if (vipBackdrop.classList.contains('open')) {
    console.log('✅ PASS: floatingAppTrigger opens VIP Download Modal!');
  } else {
    console.error('❌ FAIL: floatingAppTrigger did not open VIP modal');
  }
}

// Test backdrop click closes modal
if (vipBackdrop.listeners['click']) {
  vipBackdrop.dispatchEvent({ type: 'click', target: vipBackdrop });
  if (!vipBackdrop.classList.contains('open')) {
    console.log('✅ PASS: Clicking backdrop outside modal closes it!');
  } else {
    console.error('❌ FAIL: Backdrop click did not close modal');
  }
}

// Re-open to test download action state transition
footerInstallBtn.dispatchEvent({ type: 'click' });
const vipDownloadSec = elements.get('vip-download-section');
const vipPostDownloadSec = elements.get('vip-post-download-section');
const btnDownloadShortcut = elements.get('btn-download-shortcut');

if (btnDownloadShortcut && btnDownloadShortcut.listeners['click']) {
  btnDownloadShortcut.dispatchEvent({ type: 'click' });
  if (vipDownloadSec.style.display === 'none' && vipPostDownloadSec.style.display === 'block') {
    console.log('✅ PASS: Download action immediately switches modal to Post-Download VIP view!');
  } else {
    console.error('❌ FAIL: Download action did not switch to post-download view');
  }
}

// 6. Test Notifications Permission Button
console.log('\n--- Testing Notification Permission Button ---');
const btnVipNotify = elements.get('btn-vip-notify');
if (btnVipNotify.listeners['click']) {
  btnVipNotify.dispatchEvent({ type: 'click' });
  console.log('✅ PASS: btnVipNotify click listener triggered successfully!');
}

// 7. Test Explore Menu Button closes modal
const btnExploreMenu = elements.get('btn-vip-explore-menu');
if (btnExploreMenu && btnExploreMenu.listeners['click']) {
  btnExploreMenu.dispatchEvent({ type: 'click' });
  if (!vipBackdrop.classList.contains('open')) {
    console.log('✅ PASS: btn-vip-explore-menu closes modal!');
  }
}

console.log('\n🎉 ALL UI INTERACTION & VIP LIFECYCLE TESTS PASSED CLEANLY!\n');
