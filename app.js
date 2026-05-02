/* ───────────────── PRODUCT DATA ───────────────── */
const PRODUCTS = [
  {
    id: "coconut-saffron",
    name: "Charcoal Goat Milk Soap",
    tagline: "Detoxifying & Deep Ceansing Soap",
    price: 199,
    image: "frontpage.jpeg",
    description:
      "A perfect Blend of hydration deep cleansing, our Goat Milk & Charcoal Soap detoxifies while nourishing your skin.",
    benefits: ["Deep Cleanses", "Removes Toxins", "Reduces acne", "Maintains Natural Balance"]
  },
  {
    id: "herbal-glow",
    name: "Clear Skin Care Soap",
    tagline: "Balance & Renewal",
    price: 199,
    image: "frontpage(2).png" ,
    description:
      "A sage-green bar crafted with a proprietary Ayurvedic herb blend to rebalance, purify and softly renew the skin barrier.",
    benefits: ["Purifies pores", "Restores balance", "Sensitive-skin safe", "Cold processed"]
  },
  {
    id: "neem-tulsi",
    name: "Natural Glow Soap",
    tagline: "Clarity & Protection",
    price: 199,
    image: "frontpage(3).png",
    description:
      "Fresh neem and sacred tulsi unite in a clarifying formula that defends against daily impurities while soothing irritation.",
    benefits: ["Clarifies skin", "Anti-blemish", "Antibacterial herbs", "Gentle daily cleanse"]
  },
  {
    id: "rose-sandal",
    name: "Coconut Saffron Glow Soap",
    tagline: "Softness & Ritual",
    price: 199,
    image: "frontpage(4).png",
    description:
      "Damask rose petals meet warm Mysore sandalwood in a creamy bar that softens, scents, and turns routine into ritual.",
    benefits: ["Silky lather", "Naturally scented", "Deeply softening", "Rejuvenating"]
  }
];

/* ───────────────── CART STATE ───────────────── */
let cart = JSON.parse(localStorage.getItem("olifeplusCart")) || [];
let detailQty = 1;
let detailProduct = null;

/* ───────────────── HELPERS ───────────────── */
function saveCart() {
  localStorage.setItem("olifeplusCart", JSON.stringify(cart));
}

function getSubtotal() {
  return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

function getTotalQty() {
  return cart.reduce((sum, item) => sum + item.quantity, 0);
}

function getShipping(subtotal) {
  return subtotal >= 499 || subtotal === 0 ? 0 : 49;
}

function formatPrice(price) {
  return `₹${Math.round(Number(price) || 0)}`;
}

function getCodCharge(subtotal, shipping) {
  const base = Number(subtotal || 0) + Number(shipping || 0);
  return base > 0 ? Math.ceil(base * 0.05) : 0;
}

function getProductById(id) {
  return PRODUCTS.find((p) => p.id === id);
}

/* ───────────────── NAVBAR ───────────────── */
function initNavbar() {
  const navbar = document.getElementById("navbar");
  if (!navbar) return;

  function handleScroll() {
    if (window.scrollY > 20) {
      navbar.classList.add("scrolled");
    } else {
      navbar.classList.remove("scrolled");
    }
  }

  handleScroll();
  window.addEventListener("scroll", handleScroll);
}

function setActiveNav() {
  const page = document.body.getAttribute("data-page");
  const navLinks = document.querySelectorAll(".nav-links a");
  const mobileLinks = document.querySelectorAll("#mobile-menu a");

  navLinks.forEach((link) => link.classList.remove("active"));
  mobileLinks.forEach((link) => link.classList.remove("active"));

  const pageMap = {
    home: "index.html",
    products: "products.html",
    about: "about.html",
    contact: "contact.html",
    privacy: "privacy.html",
    blog: "blog.html",
    cart: "cart.html",
    "product-detail": "product-detail.html"
  };

  const targetHref = pageMap[page];

  if (targetHref) {
    navLinks.forEach((link) => {
      if (link.getAttribute("href") === targetHref) {
        link.classList.add("active");
      }
    });
  }
}

function toggleMobileMenu() {
  const menu = document.getElementById("mobile-menu");
  if (!menu) return;
  menu.classList.toggle("open");
}

/* ───────────────── CART PANEL ───────────────── */
function openCart() {
  const overlay = document.getElementById("cart-overlay");
  const ghostCart = document.getElementById("ghost-cart");
  if (overlay) overlay.classList.add("open");
  if (ghostCart) ghostCart.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeCart() {
  const overlay = document.getElementById("cart-overlay");
  const ghostCart = document.getElementById("ghost-cart");
  if (overlay) overlay.classList.remove("open");
  if (ghostCart) ghostCart.classList.remove("open");
  document.body.style.overflow = "";
}

/* ───────────────── CART LOGIC ───────────────── */
function animateCartIcon() {
  const wrap = document.getElementById("cart-icon-wrap");
  if (!wrap) return;

  wrap.classList.remove("cart-bump");
  void wrap.offsetWidth;
  wrap.classList.add("cart-bump");

  setTimeout(() => {
    wrap.classList.remove("cart-bump");
  }, 600);
}

function addToCart(id, qty = 1) {
  const product = getProductById(id);
  if (!product) return;

  const existing = cart.find((item) => item.id === id);

  if (existing) {
    existing.quantity += qty;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      quantity: qty
    });
  }

  saveCart();
  updateCartUI();
  animateCartIcon();
  openCart();
}

function incrementCart(id) {
  const item = cart.find((p) => p.id === id);
  if (!item) return;

  item.quantity += 1;
  saveCart();
  updateCartUI();
}

function decrementCart(id) {
  const item = cart.find((p) => p.id === id);
  if (!item) return;

  if (item.quantity > 1) {
    item.quantity -= 1;
  } else {
    cart = cart.filter((p) => p.id !== id);
  }

  saveCart();
  updateCartUI();
}

function removeFromCart(id) {
  cart = cart.filter((p) => p.id !== id);
  saveCart();
  updateCartUI();
}

function clearCart() {
  cart = [];
  saveCart();
  updateCartUI();
}

/* ───────────────── RENDER PRODUCTS ───────────────── */
function createProductCard(product) {
  return `
    <article class="product-card">
      <div class="product-card-img" onclick="goToProductDetail('${product.id}')">
        <img src="${product.image}" alt="${product.name}">
        <button class="product-card-add" onclick="event.stopPropagation(); addToCart('${product.id}')">+</button>
      </div>
      <div class="product-card-body">
        <div class="product-card-tag">${product.tagline}</div>
        <div class="product-card-row">
          <h3 class="product-card-name" onclick="goToProductDetail('${product.id}')">${product.name}</h3>
          <div class="product-card-price">${formatPrice(product.price)}</div>
        </div>
      </div>
    </article>
  `;
}

function renderHomeProducts() {
  const container = document.getElementById("home-products");
  if (!container) return;

  container.innerHTML = PRODUCTS.slice(0, 4).map(createProductCard).join("");
}

function renderProductsPage() {
  const container = document.getElementById("products-grid");
  if (!container) return;

  container.innerHTML = PRODUCTS.map(createProductCard).join("");
}

function goToProductDetail(id) {
  window.location.href = `product-detail.html?id=${encodeURIComponent(id)}`;
}

/* ───────────────── PRODUCT DETAIL ───────────────── */
function changeDetailQty(change) {
  detailQty += change;
  if (detailQty < 1) detailQty = 1;

  const qtyEl = document.getElementById("detail-qty");
  if (qtyEl) qtyEl.textContent = detailQty;
}

function addDetailToCart() {
  if (!detailProduct) return;
  addToCart(detailProduct.id, detailQty);
}

function renderProductDetail() {
  const page = document.body.getAttribute("data-page");
  if (page !== "product-detail") return;

  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  detailProduct = getProductById(id);

  if (!detailProduct) return;

  const detailImg = document.getElementById("detail-img");
  const detailTag = document.getElementById("detail-tag");
  const detailName = document.getElementById("detail-name");
  const detailPrice = document.getElementById("detail-price");
  const detailDesc = document.getElementById("detail-desc");
  const detailBenefits = document.getElementById("detail-benefits");
  const detailQtyEl = document.getElementById("detail-qty");

  if (detailImg) {
    detailImg.src = detailProduct.image;
    detailImg.alt = detailProduct.name;
  }
  if (detailTag) detailTag.textContent = detailProduct.tagline;
  if (detailName) detailName.textContent = detailProduct.name;
  if (detailPrice) detailPrice.textContent = formatPrice(detailProduct.price);
  if (detailDesc) detailDesc.textContent = detailProduct.description;
  if (detailQtyEl) detailQtyEl.textContent = detailQty;

  if (detailBenefits) {
    detailBenefits.innerHTML = detailProduct.benefits
      .map((benefit) => `<div class="detail-benefit">${benefit}</div>`)
      .join("");
  }
}
document.addEventListener("DOMContentLoaded", () => {
  const video = document.querySelector(".hover-video");
  const container = document.querySelector(".hero-img");

  if (!video || !container) return; // 🔥 MOST IMPORTANT

  container.addEventListener("mouseenter", () => {
    video.play();
  });

  container.addEventListener("mouseleave", () => {
    video.pause();
    video.currentTime = 0;
  });
});



 
/* ───────────────── CONTACT FORM ───────────────── */
function handleContactSubmit(event) {
  event.preventDefault();

  const form = event.target;
  const sentMsg = document.getElementById("sent-msg");

  if (sentMsg) {
    sentMsg.classList.add("show");
  }

  form.reset();

  setTimeout(() => {
    if (sentMsg) {
      sentMsg.classList.remove("show");
    }
  }, 3000);
}

/* ───────────────── GHOST CART UI ───────────────── */
function renderGhostCart() {
  const badge = document.getElementById("cart-badge");
  const gcTitle = document.getElementById("gc-title");
  const gcItemsList = document.getElementById("gc-items-list");
  const gcFooter = document.getElementById("gc-footer");
  const gcSubtotalVal = document.getElementById("gc-subtotal-val");
  const gcBar = document.getElementById("gc-bar");
  const gcShipMsg = document.getElementById("gc-ship-msg");

  const totalQty = getTotalQty();
  const subtotal = getSubtotal();
  const freeShippingTarget = 499;
  const remaining = Math.max(0, freeShippingTarget - subtotal);
  const barWidth = Math.min((subtotal / freeShippingTarget) * 100, 100);

  if (badge) {
    badge.textContent = totalQty;
    badge.classList.toggle("show", totalQty > 0);
  }

  if (gcTitle) {
    gcTitle.textContent = `${totalQty} ${totalQty === 1 ? "Item" : "Items"}`;
  }

  if (gcBar) {
    gcBar.style.width = `${barWidth}%`;
  }

  if (gcShipMsg) {
    if (subtotal >= freeShippingTarget) {
      gcShipMsg.innerHTML = `You have <span>free shipping</span>`;
    } else {
      gcShipMsg.innerHTML = `Add <span>${formatPrice(remaining)}</span> for free shipping`;
    }
  }

  if (!gcItemsList) return;

  if (cart.length === 0) {
    gcItemsList.innerHTML = `
      <div class="gc-empty" id="gc-empty">
        <div class="e-icon">&#128717;</div>
        <h3>Your kit is empty</h3>
        <p>Begin your ritual. Add a product to start your OlifePlus journey.</p>
        <button class="btn-discover" onclick="closeCart(); window.location.href='products.html'">Discover</button>
      </div>
    `;

    if (gcFooter) gcFooter.style.display = "none";
  } else {
    gcItemsList.innerHTML = cart
      .map(
        (item) => `
      <div class="gc-item">
        <div class="gc-item-img">
          <img src="${item.image}" alt="${item.name}">
        </div>

        <div class="gc-item-body">
          <div class="gc-item-top">
            <div>
              <div class="gc-item-name">${item.name}</div>
              <div class="gc-item-each">${formatPrice(item.price)} each</div>
            </div>
            <button class="gc-del" onclick="removeFromCart('${item.id}')">&#128465;</button>
          </div>

          <div class="gc-item-bot">
            <div class="gc-qty">
              <button onclick="decrementCart('${item.id}')">−</button>
              <span class="gq-v">${item.quantity}</span>
              <button onclick="incrementCart('${item.id}')">+</button>
            </div>
            <div class="gc-item-total">${formatPrice(item.price * item.quantity)}</div>
          </div>
        </div>
      </div>
    `
      )
      .join("");

    if (gcFooter) gcFooter.style.display = "block";
  }

  if (gcSubtotalVal) {
    gcSubtotalVal.textContent = formatPrice(subtotal);
  }
}


/* ───────────────── CART PAGE UI ───────────────── */
function renderCartPage() {
  const cartItemsList = document.getElementById("cart-items-list");
  const cartEmptyState = document.getElementById("cart-empty-state");
  const cartFullState = document.getElementById("cart-full-state");
  const csSubtotal = document.getElementById("cs-subtotal");
  const csShipping = document.getElementById("cs-shipping");
  const csQty = document.getElementById("cs-qty");
  const csCodRow = document.getElementById("cs-cod-row");
  const csCodCharge = document.getElementById("cs-cod-charge");
  const csTotal = document.getElementById("cs-total");
  const cartBar = document.getElementById("cart-bar");
  const cartShipMsg = document.getElementById("cart-ship-msg");
  const cartShipRem = document.getElementById("cart-ship-rem");

  if (!cartItemsList && !cartEmptyState && !cartFullState) return;

  const subtotal = getSubtotal();
  const totalQty = getTotalQty();
  const shipping = getShipping(subtotal);
  // Cart shows COD estimate because COD is the default checkout option.
  const codCharge = getCodCharge(subtotal, shipping);
  const total = subtotal + shipping + codCharge;
  const freeShippingTarget = 499;
  const remaining = Math.max(0, freeShippingTarget - subtotal);
  const barWidth = Math.min((subtotal / freeShippingTarget) * 100, 100);

  if (cart.length === 0) {
    if (cartEmptyState) cartEmptyState.style.display = "block";
    if (cartFullState) cartFullState.style.display = "none";
  } else {
    if (cartEmptyState) cartEmptyState.style.display = "none";
    if (cartFullState) cartFullState.style.display = "grid";

    if (cartItemsList) {
      cartItemsList.innerHTML = cart
        .map(
          (item) => `
        <div class="cart-item">
          <div style="display:flex;align-items:center;gap:16px;">
            <div class="cart-item-img">
              <img src="${item.image}" alt="${item.name}">
            </div>
            <div>
              <div class="cart-item-name">${item.name}</div>
              <div class="cart-item-sub">${formatPrice(item.price)} each</div>
            </div>
          </div>

          <div class="price-col">${formatPrice(item.price)}</div>

          <div class="qty-mini">
            <button onclick="decrementCart('${item.id}')">−</button>
            <span class="qty-v">${item.quantity}</span>
            <button onclick="incrementCart('${item.id}')">+</button>
          </div>

          <div class="total-col">${formatPrice(item.price * item.quantity)}</div>

          <button class="del-btn" onclick="removeFromCart('${item.id}')">&#10005;</button>
        </div>
      `
        )
        .join("");
    }
  }

  if (csSubtotal) csSubtotal.textContent = formatPrice(subtotal);
  if (csShipping) csShipping.textContent = formatPrice(shipping);
  if (csCodCharge) csCodCharge.textContent = formatPrice(codCharge);
  if (csCodRow) csCodRow.style.display = subtotal > 0 ? "flex" : "none";
  if (csQty) csQty.textContent = totalQty;
  if (csTotal) csTotal.textContent = formatPrice(total);

  if (cartBar) cartBar.style.width = `${barWidth}%`;

  if (cartShipMsg) {
    if (subtotal >= freeShippingTarget) {
      cartShipMsg.innerHTML = `You have <span>free shipping</span>`;
    } else {
      cartShipMsg.innerHTML = `Add <span id="cart-ship-rem">${formatPrice(remaining)}</span> for free shipping`;
    }
  } else if (cartShipRem) {
    cartShipRem.textContent = formatPrice(remaining);
  }
}

/* ───────────────── MAIN CART UPDATE ───────────────── */
function updateCartUI() {
  renderGhostCart();
  renderCartPage();
}

/* ───────────────── INIT ───────────────── */
document.addEventListener("DOMContentLoaded", () => {
  initNavbar();
  setActiveNav();
  renderHomeProducts();
  renderProductsPage();
  renderProductDetail();
  updateCartUI();
});

/* ───────────────── CLOSE CART ON ESC ───────────────── */
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeCart();
  }
});

function openBlogModal(id) {

    const data = {
      1: {
        img: "lifestyle(4).png",
        title: "Natural Herbal Soap",
        use: "This soap is used for daily cleansing of face and body. It helps remove dirt, excess oil, and impurities while keeping the skin naturally balanced.",
        advantages: "✔ 100% chemical-free\n✔ Maintains natural skin moisture\n✔ Suitable for all skin types\n✔ Prevents dryness and irritation\n✔ Eco-friendly and biodegradable"
      },

      2: {
        img: "https://media.base44.com/images/public/69e1f4b87a927963a99283d5/ae10734b2_generated_8dba9834.png",
        title: "Ayurvedic Skincare Routine",
        use: "A complete daily skincare ritual inspired by Ayurveda. It includes cleansing, toning, and nourishing the skin using natural ingredients to maintain long-term skin health.",
        advantages: "✔ Enhances natural glow\n✔ Reduces acne and blemishes\n✔ Improves skin texture\n✔ Promotes healthy and radiant skin\n✔ No harmful side effects"
      },

      3: {
        img: "blog3.jpeg",
        title: "Right Soap Selection Guide",
        use: "This guide helps you choose the perfect soap based on your skin type (oily, dry, sensitive). It ensures better skincare results and avoids skin damage caused by wrong product selection.",
        advantages: "✔ Helps avoid skin damage\n✔ Improves skincare results\n✔ Personalized skin care\n✔ Saves money by choosing correct product\n✔ Supports long-term skin health"
      }
    };

    document.getElementById("modal-img").src = data[id].img;
    document.getElementById("modal-title").innerText = data[id].title;
    document.getElementById("modal-use").innerText = data[id].use;
    document.getElementById("modal-advantages").innerText = data[id].advantages;

    document.getElementById("blog-modal").style.display = "block";
  }

  function closeBlogModal() {
    document.getElementById("blog-modal").style.display = "none";
  }

/* ───────────────── ACCOUNT NAV + MOBILE MENU HELPERS ───────────────── */
function getOlifeCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem("olifeplusCurrentUser") || localStorage.getItem("olifeplusAccountData") || "null");
  } catch (error) {
    return null;
  }
}

function isOlifeLoggedIn() {
  return localStorage.getItem("olifeplusLoggedIn") === "true" && !!getOlifeCurrentUser();
}

function ensureMobileAccountLink() {
  const menu = document.getElementById("mobile-menu");
  if (!menu) return;

  let accountMobile = document.getElementById("mobile-account-link");
  if (!accountMobile) {
    accountMobile = document.createElement("a");
    accountMobile.id = "mobile-account-link";
    accountMobile.onclick = toggleMobileMenu;
    menu.appendChild(accountMobile);
  }
}

function updateAccountButtons() {
  const loggedIn = isOlifeLoggedIn();
  const targetHref = loggedIn ? "my-account.html" : "login.html";
  const targetText = loggedIn ? "👤 My Account" : "👤 Login";

  document.querySelectorAll(".btn-login").forEach((btn) => {
    btn.innerHTML = targetText;
    const parentLink = btn.closest("a");
    if (parentLink) parentLink.href = targetHref;
  });

  ensureMobileAccountLink();
  const accountMobile = document.getElementById("mobile-account-link");
  if (accountMobile) {
    accountMobile.href = targetHref;
    accountMobile.innerHTML = targetText;
  }
}

document.addEventListener("DOMContentLoaded", updateAccountButtons);
window.addEventListener("storage", updateAccountButtons);
