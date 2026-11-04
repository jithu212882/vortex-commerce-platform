/**
 * VORTEX COMMERCE - DEDICATED CATEGORY STOREFRONT
 * High-performance filtered catalog view with real-time sorting and pagination.
 */
(() => {
  "use strict";

  const CART_STORAGE_KEY = "vortex_cart_items";
  const FALLBACK_THUMB = "https://images.unsplash.com/photo-1523293182086-7651a899d37f?auto=format&fit=crop&w=600&q=80";

  // Category metadata dictionary for rich editorial headers
  const CATEGORY_META = {
    "laptops": {
      title: "Laptops & Computing",
      desc: "Explore high-performance computing devices, certified ultrabooks, and enterprise workstations engineered for speed, endurance, and quiet thermal management.",
    },
    "electronics": {
      title: "Electronics & Computing Systems",
      desc: "Next-generation computing architecture, components, smart displays, and connected hardware built for demanding workflows.",
    },
    "audio": {
      title: "Audio & Acoustics",
      desc: "Studio-grade active noise-cancelling headphones, true-wireless earbuds, and audiophile acoustic monitors with balanced spatial reproduction.",
    },
    "gaming": {
      title: "Gaming & Peripherals",
      desc: "Ultra-low latency mechanical switches, high-DPI optical sensors, and precision esports gear engineered for competitive dominance.",
    },
    "gaming-peripherals": {
      title: "Gaming & Peripherals",
      desc: "Ultra-low latency mechanical switches, high-DPI optical sensors, and precision esports gear engineered for competitive dominance.",
    },
    "wearables": {
      title: "Smart Wearables & Health Monitors",
      desc: "Aerospace-grade titanium biometric smartwatches and GPS multisport trackers with comprehensive health analytics.",
    },
    "smartphones": {
      title: "Smartphones & Mobile Devices",
      desc: "Flagship mobile computing with high-refresh OLED displays, computational photography, and all-day fast charging.",
    },
    "furniture": {
      title: "Home & Architectural Living",
      desc: "Ergonomic workspace seating, minimalist solid-timber desks, and modular interior furnishings designed for daily comfort.",
    },
    "beauty": {
      title: "Beauty & Daily Care",
      desc: "Dermatologist-tested skincare essentials, revitalizing serums, and everyday cosmetic formulas crafted with clean ingredients.",
    },
    "fragrances": {
      title: "Fine Fragrances & Parfums",
      desc: "Artisanal olfactory compositions blended with botanical extracts, rare spices, and long-lasting base accords.",
    },
    "groceries": {
      title: "Pantry & Gourmet Provisions",
      desc: "Curated organic pantry staples, artisanal roasts, and culinary essentials sourced from certified ethical growers.",
    },
  };

  const state = {
    category: "",
    sort: "featured",
    page: 1,
    limit: 12,
    totalCount: 0,
    items: [],
    categories: [],
    cart: [],
  };

  const el = {
    breadcrumbLabel: document.getElementById("categoryBreadcrumbLabel"),
    pageTitle: document.getElementById("categoryPageTitle"),
    pageDescription: document.getElementById("categoryPageDescription"),
    pillTrack: document.getElementById("categoryPillTrack"),
    itemCountVal: document.getElementById("itemCountVal"),
    sortSelect: document.getElementById("categorySortSelect"),
    productGrid: document.getElementById("categoryProductGrid"),
    emptyState: document.getElementById("categoryEmptyState"),
    pagination: document.getElementById("categoryPagination"),
    headerSearchInput: document.getElementById("headerSearchInput"),
    headerCategorySelect: document.getElementById("headerCategorySelect"),
    btnHeaderSearch: document.getElementById("btnHeaderSearch"),
    btnCartTrigger: document.getElementById("btnCartTrigger"),
    cartDrawer: document.getElementById("cartDrawer"),
    btnCloseCartDrawer: document.getElementById("btnCloseCartDrawer"),
    cartItemsStream: document.getElementById("cartItemsStream"),
    cartSubtotalVal: document.getElementById("cartSubtotalVal"),
    cartCountBadge: document.getElementById("cartCountBadge"),
    btnCheckoutCart: document.getElementById("btnCheckoutCart"),
  };

  // Helper: Format INR currency
  function formatInr(val) {
    const num = Math.round(Number(val) || 0);
    return num.toLocaleString("en-IN");
  }

  // Parse category from URL
  function resolveCategoryFromUrl() {
    const pathname = window.location.pathname.replace(/\/+$/, "");
    const parts = pathname.split("/");

    if (parts.length >= 3 && (parts[1] === "categories" || parts[1] === "category")) {
      return decodeURIComponent(parts[2]).toLowerCase();
    }

    const params = new URLSearchParams(window.location.search);
    const catParam = params.get("category");
    if (catParam) return catParam.toLowerCase();

    return "laptops"; // default category
  }

  // Fetch all categories for pill switcher
  async function fetchCategoryList() {
    try {
      const res = await fetch("/api/v1/categories");
      if (res.ok) {
        state.categories = await res.json();
        renderCategoryPills();
      }
    } catch (e) {
      console.warn("Could not load category list:", e);
    }
  }

  // Render Category Switcher Pills
  function renderCategoryPills() {
    if (!el.pillTrack) return;

    // Featured curated slugs
    const curatedSlugs = [
      "laptops", "audio", "electronics", "gaming-peripherals", "wearables", 
      "smartphones", "furniture", "beauty", "fragrances", "groceries"
    ];

    el.pillTrack.innerHTML = curatedSlugs
      .map((slug) => {
        const isActive = (state.category === slug || (slug === "gaming-peripherals" && state.category === "gaming"));
        const meta = CATEGORY_META[slug] || { title: slug.replace("-", " ").toUpperCase() };
        const label = meta.title.split("&")[0].trim();
        return `
          <button 
            type="button" 
            class="px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
              isActive 
                ? 'bg-stone-900 text-white border-stone-900 shadow-sm' 
                : 'bg-white text-stone-700 hover:bg-stone-100 border-stone-200'
            }"
            onclick="window.location.href='/categories/${slug}'"
          >
            ${label}
          </button>
        `;
      })
      .join("");
  }

  // Fetch Category Items
  async function fetchCategoryProducts() {
    const offset = (state.page - 1) * state.limit;
    const url = `/api/v1/categories/${encodeURIComponent(state.category)}/items?sort=${encodeURIComponent(state.sort)}&limit=${state.limit}&offset=${offset}`;

    if (el.productGrid) {
      el.productGrid.innerHTML = `
        <div class="col-span-full py-16 text-center text-xs text-stone-500 font-mono flex items-center justify-center gap-2">
          <svg class="animate-spin w-5 h-5 text-stone-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle><path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"></path></svg>
          <span>Loading catalog items strictly matching ${state.category}...</span>
        </div>
      `;
    }

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      state.totalCount = data.total_count || 0;
      state.items = data.items || [];

      // Update meta header
      updateCategoryHeader(data.title || state.category);

      // Render products
      renderProductGrid();

      // Render pagination
      renderPagination();
    } catch (err) {
      console.error("Failed to load category items:", err);
      if (el.productGrid) el.productGrid.innerHTML = "";
      if (el.emptyState) el.emptyState.classList.remove("hidden");
      if (el.itemCountVal) el.itemCountVal.textContent = "0";
    }
  }

  function updateCategoryHeader(displayTitle) {
    const meta = CATEGORY_META[state.category] || {
      title: displayTitle,
      desc: `Browse genuine guaranteed products in ${displayTitle} with doorstep express delivery and full domestic warranty.`,
    };

    if (el.pageTitle) el.pageTitle.textContent = meta.title;
    if (el.breadcrumbLabel) el.breadcrumbLabel.textContent = meta.title;
    if (el.pageDescription) el.pageDescription.textContent = meta.desc;
    if (el.itemCountVal) el.itemCountVal.textContent = state.totalCount.toString();
    if (el.headerCategorySelect) el.headerCategorySelect.value = state.category;
  }

  function renderProductGrid() {
    if (!el.productGrid) return;

    if (!state.items || state.items.length === 0) {
      el.productGrid.innerHTML = "";
      if (el.emptyState) el.emptyState.classList.remove("hidden");
      return;
    }

    if (el.emptyState) el.emptyState.classList.add("hidden");

    el.productGrid.innerHTML = state.items
      .map((item) => {
        const thumb = item.image_url || FALLBACK_THUMB;
        const price = item.price_inr || Math.round((item.price || 0) * 83);
        const mrp = item.mrp_inr || Math.round(price * 1.35);
        const discountPct = item.discount_pct || 25;
        const rating = item.rating || 4.5;
        const reviewCount = item.review_count || 1200;

        const parsed = parseInt(item && item.id, 10);
        const safeId = (parsed && !isNaN(parsed) && parsed > 0) ? parsed : 1;

        return `
          <div class="bg-white rounded-2xl p-4 border border-stone-200 hover:border-stone-900 transition-all duration-300 flex flex-col justify-between relative group cursor-pointer shadow-xs hover:shadow-md" onclick="window.location.href='/product/${safeId}'">
            <!-- Image Plinth -->
            <div class="bg-[#F6F5F2] rounded-xl h-48 flex items-center justify-center p-4 relative overflow-hidden border border-black/5 mb-3.5">
              <span class="absolute top-2.5 left-2.5 bg-[#FF3B00] text-white font-mono text-[10px] font-bold px-2 py-0.5 rounded shadow-xs z-10">${discountPct}% OFF</span>
              <div class="absolute top-2.5 right-2.5 bg-white/95 backdrop-blur text-stone-900 font-mono text-[10px] font-bold px-2 py-0.5 rounded border border-black/5 flex items-center gap-1 z-10">
                <span class="text-[#059669]">★</span> ${rating.toFixed(1)}
              </div>
              <img 
                src="${thumb}" 
                alt="${item.title}" 
                loading="lazy"
                onerror="this.onerror=null; this.src='${FALLBACK_THUMB}';"
                class="max-h-36 max-w-[85%] object-contain group-hover:scale-105 transition-transform duration-300"
              />
            </div>

            <!-- Brand & Title -->
            <div class="text-[10px] font-mono uppercase tracking-wider text-stone-400 font-bold">${item.brand || item.category || 'VORTEX'}</div>
            <h2 class="font-bold text-xs text-stone-900 line-clamp-2 mt-1 group-hover:text-[#FF3B00] transition-colors min-h-[32px]" title="${item.title}">
              ${item.title}
            </h2>

            <!-- Pricing Row -->
            <div class="flex items-baseline gap-2 pt-2 mt-auto">
              <span class="font-mono text-base font-extrabold text-stone-900">&#8377;${formatInr(price)}</span>
              <span class="font-mono text-xs text-stone-400 line-through">&#8377;${formatInr(mrp)}</span>
              <span class="font-mono text-[11px] font-bold text-[#FF3B00]">${discountPct}% off</span>
            </div>

            <div class="flex items-center justify-between text-[11px] text-[#059669] font-medium mt-1.5 pt-1.5 border-t border-stone-100">
              <span>Free Express Delivery</span>
              <span class="text-stone-400 font-mono text-[10px]">${reviewCount.toLocaleString()} reviews</span>
            </div>

            <!-- Quick Add Button -->
            <button 
              type="button" 
              class="w-full mt-3 bg-stone-900 hover:bg-[#FF3B00] text-white font-mono text-xs font-semibold py-2 rounded-xl transition-colors flex items-center justify-center gap-1.5"
              onclick="event.stopPropagation(); window.categoryStore.addToCart(${item.id}, '${item.title.replace(/'/g, "\\'")}', ${item.price}, '${thumb}', ${price});"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              <span>Add to Cart</span>
            </button>
          </div>
        `;
      })
      .join("");
  }

  function renderPagination() {
    if (!el.pagination) return;
    const totalPages = Math.ceil(state.totalCount / state.limit);
    if (totalPages <= 1) {
      el.pagination.innerHTML = "";
      return;
    }

    let html = `
      <button 
        type="button" 
        class="px-3.5 py-1.5 rounded-xl border border-stone-200 text-xs font-semibold bg-white hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed" 
        ${state.page <= 1 ? 'disabled' : ''}
        onclick="window.categoryStore.changePage(${state.page - 1})"
      >
        &larr; Previous
      </button>
    `;

    for (let p = 1; p <= totalPages; p++) {
      const isCurrent = (p === state.page);
      html += `
        <button 
          type="button" 
          class="w-8 h-8 rounded-xl text-xs font-mono font-bold transition-colors ${
            isCurrent 
              ? 'bg-stone-900 text-white' 
              : 'bg-white text-stone-700 hover:bg-stone-100 border border-stone-200'
          }"
          onclick="window.categoryStore.changePage(${p})"
        >
          ${p}
        </button>
      `;
    }

    html += `
      <button 
        type="button" 
        class="px-3.5 py-1.5 rounded-xl border border-stone-200 text-xs font-semibold bg-white hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed" 
        ${state.page >= totalPages ? 'disabled' : ''}
        onclick="window.categoryStore.changePage(${state.page + 1})"
      >
        Next &rarr;
      </button>
    `;

    el.pagination.innerHTML = html;
  }

  // =========================================================================
  // CART DRAWER ENGINE
  // =========================================================================

  function loadCart() {
    try {
      const raw = localStorage.getItem(CART_STORAGE_KEY);
      state.cart = raw ? JSON.parse(raw) : [];
    } catch {
      state.cart = [];
    }
    updateCartUI();
  }

  function saveCart() {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state.cart));
    } catch (e) {
      console.warn("Could not persist cart:", e);
    }
    updateCartUI();
  }

  function addToCart(id, title, priceUsd, image, priceInr) {
    const existing = state.cart.find((it) => it.id === id);
    if (existing) {
      existing.qty += 1;
    } else {
      state.cart.push({
        id,
        title,
        priceUsd: Number(priceUsd) || 0,
        priceInr: Number(priceInr) || Math.round((Number(priceUsd) || 0) * 83),
        image: image || FALLBACK_THUMB,
        qty: 1,
      });
    }
    saveCart();
    openCartDrawer();
  }

  function updateCartUI() {
    const count = state.cart.reduce((sum, it) => sum + (it.qty || 1), 0);
    if (el.cartCountBadge) el.cartCountBadge.textContent = count.toString();

    let subtotal = 0;
    if (el.cartItemsStream) {
      if (state.cart.length === 0) {
        el.cartItemsStream.innerHTML = `<div class="text-xs text-stone-400 text-center py-10">Your cart is empty.</div>`;
      } else {
        el.cartItemsStream.innerHTML = state.cart
          .map((it) => {
            const itemTotal = it.priceInr * it.qty;
            subtotal += itemTotal;
            return `
              <div class="flex items-center gap-3 py-3 border-b border-stone-100">
                <img src="${it.image || FALLBACK_THUMB}" alt="${it.title}" class="w-12 h-12 rounded-lg object-contain bg-stone-50 border border-stone-200 p-1">
                <div class="flex-1 min-w-0">
                  <div class="text-xs font-semibold text-stone-900 truncate">${it.title}</div>
                  <div class="text-xs font-mono font-bold text-stone-700">&#8377;${formatInr(it.priceInr)}</div>
                </div>
                <div class="flex items-center gap-1.5">
                  <button type="button" class="w-6 h-6 rounded bg-stone-100 hover:bg-stone-200 text-xs font-mono font-bold" onclick="window.categoryStore.adjustCartQty(${it.id}, -1)">-</button>
                  <span class="text-xs font-mono font-semibold px-1">${it.qty}</span>
                  <button type="button" class="w-6 h-6 rounded bg-stone-100 hover:bg-stone-200 text-xs font-mono font-bold" onclick="window.categoryStore.adjustCartQty(${it.id}, 1)">+</button>
                </div>
              </div>
            `;
          })
          .join("");
      }
    }

    if (el.cartSubtotalVal) el.cartSubtotalVal.innerHTML = `&#8377;${formatInr(subtotal)}`;
  }

  function adjustCartQty(id, delta) {
    const item = state.cart.find((it) => it.id === id);
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) {
      state.cart = state.cart.filter((it) => it.id !== id);
    }
    saveCart();
  }

  function openCartDrawer() {
    if (el.cartDrawer) el.cartDrawer.classList.add("open");
  }

  function closeCartDrawer() {
    if (el.cartDrawer) el.cartDrawer.classList.remove("open");
  }

  // =========================================================================
  // INITIALIZATION & LISTENERS
  // =========================================================================

  function init() {
    state.category = resolveCategoryFromUrl();

    // Wire sort dropdown
    if (el.sortSelect) {
      el.sortSelect.addEventListener("change", (e) => {
        state.sort = e.target.value;
        state.page = 1;
        fetchCategoryProducts();
      });
    }

    // Wire header search
    const executeHeaderSearch = () => {
      const q = (el.headerSearchInput ? el.headerSearchInput.value : "").trim();
      const cat = el.headerCategorySelect ? el.headerCategorySelect.value : "";
      if (q) {
        window.location.href = `/?search=${encodeURIComponent(q)}&category=${encodeURIComponent(cat)}`;
      } else if (cat) {
        window.location.href = `/categories/${encodeURIComponent(cat)}`;
      }
    };

    if (el.btnHeaderSearch) el.btnHeaderSearch.addEventListener("click", executeHeaderSearch);
    if (el.headerSearchInput) {
      el.headerSearchInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") executeHeaderSearch();
      });
    }

    if (el.headerCategorySelect) {
      el.headerCategorySelect.addEventListener("change", (e) => {
        const cat = e.target.value;
        if (cat) window.location.href = `/categories/${encodeURIComponent(cat)}`;
      });
    }

    // Wire Cart Drawer
    if (el.btnCartTrigger) el.btnCartTrigger.addEventListener("click", openCartDrawer);
    if (el.btnCloseCartDrawer) el.btnCloseCartDrawer.addEventListener("click", closeCartDrawer);
    if (el.btnCheckoutCart) {
      el.btnCheckoutCart.addEventListener("click", () => {
        if (state.cart.length === 0) {
          alert("Your cart is empty. Add products to proceed.");
          return;
        }
        alert("Proceeding to secure checkout for " + state.cart.length + " item(s).");
      });
    }

    // Load initial data
    loadCart();
    fetchCategoryList();
    fetchCategoryProducts();
  }

  // Expose global controller
  window.categoryStore = {
    changePage: (newPage) => {
      state.page = newPage;
      fetchCategoryProducts();
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    addToCart,
    adjustCartQty,
  };

  document.addEventListener("DOMContentLoaded", init);
})();

