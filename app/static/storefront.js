/**
 * VORTEX COMMERCE & GLOBAL STORE CLIENT ENGINE
 * Modern 2026 E-Commerce Architecture
 * - Implicit real-time dwell-time telemetry tracking
 * - YOLOv8 visual crop & spatial object matching
 * - Interactive slide-out cart drawer with live subtotal
 * - Customer support ticket management with LangGraph policy gates
 */

(function () {
  "use strict";

  // Session State
  const state = {
    userId: "sreejith_cust_" + Math.random().toString(36).substring(2, 8),
    threadId: "ticket_vx_" + Math.floor(1000 + Math.random() * 9000),
    catalog: [],
    recommended: [],
    cartItems: [], // [{ id, title, price, image_url, quantity }]
    recentInteractions: [], // [{ product_id, dwell_time_seconds }]
    activeCategory: "",
    searchQuery: "",
    currentQuickViewProduct: null,
    dwellStartTimestamp: 0,
  };

  // DOM Elements
  const el = {
    storeCatalogGrid: document.getElementById("storeCatalogGrid"),
    recommendedGrid: document.getElementById("recommendedGrid"),
    catalogCountNote: document.getElementById("catalogCountNote"),
    recsFreshIndicator: document.getElementById("recsFreshIndicator"),
    storeSearchInput: document.getElementById("storeSearchInput"),
    btnSearchSubmit: document.getElementById("btnSearchSubmit"),
    categorySelectDropdown: document.getElementById("categorySelectDropdown"),
    btnSearchPhotoTrigger: document.getElementById("btnSearchPhotoTrigger"),
    btnTriggerHeroVisualSearch: document.getElementById("btnTriggerHeroVisualSearch"),
    btnExploreCollection: document.getElementById("btnExploreCollection"),

    // Hero Carousel
    heroCarousel: document.getElementById("heroCarousel"),
    carouselTrack: document.getElementById("carouselTrack"),
    btnCarouselPrev: document.getElementById("btnCarouselPrev"),
    btnCarouselNext: document.getElementById("btnCarouselNext"),
    carouselDots: document.querySelectorAll(".vx-carousel-dot"),

    // Cart Drawer
    cartDrawer: document.getElementById("cartDrawer"),
    btnCartTrigger: document.getElementById("btnCartTrigger"),
    btnCloseCartDrawer: document.getElementById("btnCloseCartDrawer"),
    cartItemsStream: document.getElementById("cartItemsStream"),
    cartSubtotalVal: document.getElementById("cartSubtotalVal"),
    cartCountBadge: document.getElementById("cartCountBadge"),
    btnCheckoutCart: document.getElementById("btnCheckoutCart"),

    // Quick View Modal
    quickViewModal: document.getElementById("quickViewModal"),
    btnCloseQuickView: document.getElementById("btnCloseQuickView"),
    btnDismissModal: document.getElementById("btnDismissModal"),
    modalImg: document.getElementById("modalImg"),
    modalBrand: document.getElementById("modalBrand"),
    modalTitle: document.getElementById("modalTitle"),
    modalPrice: document.getElementById("modalPrice"),
    modalMrp: document.getElementById("modalMrp"),
    modalDiscount: document.getElementById("modalDiscount"),
    modalDesc: document.getElementById("modalDesc"),
    btnAddToCartModal: document.getElementById("btnAddToCartModal"),

    // Visual Search Modal (YOLOv8)
    visualSearchModal: document.getElementById("visualSearchModal"),
    btnCloseVisualModal: document.getElementById("btnCloseVisualModal"),
    storefrontDropzone: document.getElementById("storefrontDropzone"),
    storefrontFileInput: document.getElementById("storefrontFileInput"),
    btnTriggerBrowsePhoto: document.getElementById("btnTriggerBrowsePhoto"),
    visualInspectionBox: document.getElementById("visualInspectionBox"),
    visualPreviewImg: document.getElementById("visualPreviewImg"),
    visualLabelNotice: document.getElementById("visualLabelNotice"),
    visualStatusNotice: document.getElementById("visualStatusNotice"),
    visualMatchesContainer: document.getElementById("visualMatchesContainer"),
    visualMatchesGrid: document.getElementById("visualMatchesGrid"),

    // Support Drawer
    supportDrawer: document.getElementById("supportDrawer"),
    btnOpenSupportDrawer: document.getElementById("btnOpenSupportDrawer"),
    btnCloseSupportDrawer: document.getElementById("btnCloseSupportDrawer"),
    drawerChatStream: document.getElementById("drawerChatStream"),
    drawerChatForm: document.getElementById("drawerChatForm"),
    drawerChatInput: document.getElementById("drawerChatInput"),
    chipTrackOrder: document.getElementById("chipTrackOrder"),
    chipRefundPrompt: document.getElementById("chipRefundPrompt"),
    chipCheckStock: document.getElementById("chipCheckStock"),
    navOrdersBtn: document.getElementById("navOrdersBtn"),
    footerTrackOrders: document.getElementById("footerTrackOrders"),
    footerReturnsHelp: document.getElementById("footerReturnsHelp"),
    footerCustomerCare: document.getElementById("footerCustomerCare"),
  };

  const FALLBACK_THUMB = "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=400&q=80";

  // Helpers for INR currency display
  function formatInr(usdPrice) {
    const inr = Math.round(Number(usdPrice) * 83);
    return inr.toLocaleString("en-IN");
  }
  function formatMrp(usdPrice) {
    const inr = Math.round(Number(usdPrice) * 83 * 1.35);
    return inr.toLocaleString("en-IN");
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  function init() {
    bindEvents();
    initCarousel();
    fetchCatalog();
    fetchInitialRecommendations();
  }

  // ============================================================================
  // EVENT BINDINGS
  // ============================================================================

  function bindEvents() {
    // Search input
    el.btnSearchSubmit.addEventListener("click", () => {
      state.searchQuery = el.storeSearchInput.value.trim();
      fetchCatalog();
      smoothScrollTo("#catalog");
    });

    el.storeSearchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        state.searchQuery = el.storeSearchInput.value.trim();
        fetchCatalog();
        smoothScrollTo("#catalog");
      }
    });

    // Category dropdown
    el.categorySelectDropdown.addEventListener("change", (e) => {
      state.activeCategory = e.target.value;
      updateCategoryStripActive(state.activeCategory);
      fetchCatalog();
      smoothScrollTo("#catalog");
    });

    // Category strip pills
    document.querySelectorAll(".vx-cat-pill[data-cat]").forEach((pill) => {
      pill.addEventListener("click", () => {
        const cat = pill.getAttribute("data-cat");
        state.activeCategory = cat;
        el.categorySelectDropdown.value = cat;
        updateCategoryStripActive(cat);
        fetchCatalog();
        smoothScrollTo("#catalog");
      });
    });

    // Bento Card filters
    document.querySelectorAll(".bento-filter-trigger").forEach((card) => {
      card.addEventListener("click", () => {
        const cat = card.getAttribute("data-cat") || "";
        state.activeCategory = cat;
        el.categorySelectDropdown.value = cat;
        updateCategoryStripActive(cat);
        fetchCatalog();
        smoothScrollTo("#catalog");
      });
    });

    // Footer category links
    document.querySelectorAll(".footer-cat-link").forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const cat = link.getAttribute("data-cat") || "";
        state.activeCategory = cat;
        el.categorySelectDropdown.value = cat;
        updateCategoryStripActive(cat);
        fetchCatalog();
        smoothScrollTo("#catalog");
      });
    });

    // Cart Drawer Toggle
    el.btnCartTrigger.addEventListener("click", () => el.cartDrawer.classList.add("open"));
    el.btnCloseCartDrawer.addEventListener("click", () => el.cartDrawer.classList.remove("open"));

    el.btnCheckoutCart.addEventListener("click", () => {
      if (state.cartItems.length === 0) {
        alert("Your cart is empty. Please add items before proceeding.");
        return;
      }
      alert("Proceeding to Secure Checkout. Thank you!");
    });

    // Quick View Modal
    el.btnCloseQuickView.addEventListener("click", closeQuickViewAndTrackDwell);
    el.btnDismissModal.addEventListener("click", closeQuickViewAndTrackDwell);
    el.quickViewModal.addEventListener("click", (e) => {
      if (e.target === el.quickViewModal) closeQuickViewAndTrackDwell();
    });

    el.btnAddToCartModal.addEventListener("click", () => {
      if (state.currentQuickViewProduct) {
        addToCart(state.currentQuickViewProduct);
        el.btnAddToCartModal.textContent = "Added to Cart ✓";
        setTimeout(() => {
          el.btnAddToCartModal.textContent = "Add to Cart";
        }, 1200);
      }
    });

    // Visual Search Modal (YOLOv8)
    const openVisualModal = () => el.visualSearchModal.classList.add("open");
    el.btnSearchPhotoTrigger.addEventListener("click", openVisualModal);
    if (el.btnTriggerHeroVisualSearch) {
      el.btnTriggerHeroVisualSearch.addEventListener("click", openVisualModal);
    }
    el.btnCloseVisualModal.addEventListener("click", () => el.visualSearchModal.classList.remove("open"));
    el.visualSearchModal.addEventListener("click", (e) => {
      if (e.target === el.visualSearchModal) el.visualSearchModal.classList.remove("open");
    });

    // File Drag & Drop for Visual Search
    el.btnTriggerBrowsePhoto.addEventListener("click", () => el.storefrontFileInput.click());
    el.storefrontDropzone.addEventListener("click", (e) => {
      if (e.target !== el.btnTriggerBrowsePhoto) el.storefrontFileInput.click();
    });
    el.storefrontFileInput.addEventListener("change", handleVisualUpload);

    el.storefrontDropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      el.storefrontDropzone.classList.add("dragover");
    });
    el.storefrontDropzone.addEventListener("dragleave", () => {
      el.storefrontDropzone.classList.remove("dragover");
    });
    el.storefrontDropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      el.storefrontDropzone.classList.remove("dragover");
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        uploadPhotoForVisualMatch(e.dataTransfer.files[0]);
      }
    });

    // Support Drawer
    const openSupportDrawer = () => {
      el.supportDrawer.classList.add("open");
      el.drawerChatInput.focus();
    };
    el.btnOpenSupportDrawer.addEventListener("click", openSupportDrawer);
    if (el.navOrdersBtn) el.navOrdersBtn.addEventListener("click", openSupportDrawer);
    if (el.footerCustomerCare) el.footerCustomerCare.addEventListener("click", (e) => { e.preventDefault(); openSupportDrawer(); });
    if (el.footerTrackOrders) el.footerTrackOrders.addEventListener("click", (e) => { e.preventDefault(); openSupportDrawer(); });
    if (el.footerReturnsHelp) el.footerReturnsHelp.addEventListener("click", (e) => { e.preventDefault(); openSupportDrawer(); });
    el.btnCloseSupportDrawer.addEventListener("click", () => el.supportDrawer.classList.remove("open"));

    // Support Form Submission
    el.drawerChatForm.addEventListener("submit", handleSupportChatSubmit);

    // Support Quick Chips
    el.chipTrackOrder.addEventListener("click", () => {
      el.drawerChatInput.value = "Where is my package #ORD-98214?";
      el.drawerChatForm.dispatchEvent(new Event("submit"));
    });
    el.chipRefundPrompt.addEventListener("click", () => {
      el.drawerChatInput.value = "I would like to request a refund of ₹450 for my recent order.";
      el.drawerChatInput.focus();
    });
    el.chipCheckStock.addEventListener("click", () => {
      el.drawerChatInput.value = "Can you check stock availability for laptops and wireless headphones?";
      el.drawerChatForm.dispatchEvent(new Event("submit"));
    });

    // Keyboard ESC to close any open modal/drawer
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (el.quickViewModal.classList.contains("open")) closeQuickViewAndTrackDwell();
        if (el.visualSearchModal.classList.contains("open")) el.visualSearchModal.classList.remove("open");
        if (el.supportDrawer.classList.contains("open")) el.supportDrawer.classList.remove("open");
        if (el.cartDrawer.classList.contains("open")) el.cartDrawer.classList.remove("open");
      }
    });
  }

  function updateCategoryStripActive(category) {
    document.querySelectorAll(".vx-cat-pill").forEach((pill) => {
      if (pill.getAttribute("data-cat") === category) {
        pill.classList.add("active");
      } else {
        pill.classList.remove("active");
      }
    });
  }

  function smoothScrollTo(selector) {
    const target = document.querySelector(selector);
    if (target) {
      target.scrollIntoView({ behavior: "smooth" });
    }
  }

  // ============================================================================
  // HERO CAROUSEL ENGINE (EMIL KOWALSKI FLUID TRANSITIONS & AUTOPLAY)
  // ============================================================================

  const carouselState = {
    currentSlide: 0,
    totalSlides: 4,
    autoplayTimer: null,
    isHovered: false,
    intervalMs: 5000,
  };

  function initCarousel() {
    if (!el.carouselTrack || !el.heroCarousel) return;

    // Next button
    if (el.btnCarouselNext) {
      el.btnCarouselNext.addEventListener("click", () => {
        goToSlide((carouselState.currentSlide + 1) % carouselState.totalSlides);
        restartAutoplay();
      });
    }

    // Prev button
    if (el.btnCarouselPrev) {
      el.btnCarouselPrev.addEventListener("click", () => {
        const prev = (carouselState.currentSlide - 1 + carouselState.totalSlides) % carouselState.totalSlides;
        goToSlide(prev);
        restartAutoplay();
      });
    }

    // Dot indicators
    if (el.carouselDots) {
      el.carouselDots.forEach((dot) => {
        dot.addEventListener("click", () => {
          const slideIdx = parseInt(dot.getAttribute("data-slide"), 10);
          if (!isNaN(slideIdx)) {
            goToSlide(slideIdx);
            restartAutoplay();
          }
        });
      });
    }

    // Slide CTA buttons
    document.querySelectorAll(".hero-slide-cta").forEach((btn) => {
      btn.addEventListener("click", () => {
        const cat = btn.getAttribute("data-cat") || "";
        state.activeCategory = cat;
        if (el.categorySelectDropdown) el.categorySelectDropdown.value = cat;
        updateCategoryStripActive(cat);
        fetchCatalog();
        smoothScrollTo("#catalog");
      });
    });

    // Pause on hover, resume on mouse leave
    el.heroCarousel.addEventListener("mouseenter", () => {
      carouselState.isHovered = true;
      pauseAutoplay();
    });

    el.heroCarousel.addEventListener("mouseleave", () => {
      carouselState.isHovered = false;
      startAutoplay();
    });

    // Arrow keys when inside carousel
    el.heroCarousel.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") {
        goToSlide((carouselState.currentSlide + 1) % carouselState.totalSlides);
        restartAutoplay();
      } else if (e.key === "ArrowLeft") {
        const prev = (carouselState.currentSlide - 1 + carouselState.totalSlides) % carouselState.totalSlides;
        goToSlide(prev);
        restartAutoplay();
      }
    });

    startAutoplay();
  }

  function goToSlide(index) {
    if (!el.carouselTrack) return;
    carouselState.currentSlide = index;
    el.carouselTrack.style.transform = `translateX(-${index * 25}%)`;

    if (el.carouselDots) {
      el.carouselDots.forEach((dot, idx) => {
        if (idx === index) {
          dot.classList.add("active");
        } else {
          dot.classList.remove("active");
        }
      });
    }
  }

  function startAutoplay() {
    if (carouselState.autoplayTimer) clearInterval(carouselState.autoplayTimer);
    carouselState.autoplayTimer = setInterval(() => {
      if (!carouselState.isHovered) {
        const next = (carouselState.currentSlide + 1) % carouselState.totalSlides;
        goToSlide(next);
      }
    }, carouselState.intervalMs);
  }

  function pauseAutoplay() {
    if (carouselState.autoplayTimer) {
      clearInterval(carouselState.autoplayTimer);
      carouselState.autoplayTimer = null;
    }
  }

  function restartAutoplay() {
    pauseAutoplay();
    startAutoplay();
  }

  // ============================================================================
  // SHOPPING CART MANAGEMENT
  // ============================================================================

  function addToCart(product) {
    const existing = state.cartItems.find((item) => item.id === product.id);
    if (existing) {
      existing.quantity += 1;
    } else {
      state.cartItems.push({
        id: product.id,
        title: product.title,
        price: product.price,
        image_url: product.image_url || FALLBACK_THUMB,
        quantity: 1,
      });
    }

    updateCartUI();
    el.cartDrawer.classList.add("open");
  }

  function updateCartUI() {
    const totalCount = state.cartItems.reduce((acc, it) => acc + it.quantity, 0);
    el.cartCountBadge.textContent = totalCount;

    if (state.cartItems.length === 0) {
      el.cartItemsStream.innerHTML = `
        <div style="text-align: center; padding: 48px 16px; color: var(--vx-text-muted);">
          Your cart is empty.
        </div>`;
      el.cartSubtotalVal.textContent = "₹0";
      return;
    }

    let subtotalInr = 0;
    el.cartItemsStream.innerHTML = state.cartItems
      .map((item) => {
        const itemInr = Math.round(Number(item.price) * 83 * item.quantity);
        subtotalInr += itemInr;

        return `
        <div class="vx-cart-item-card">
          <img src="${item.image_url}" alt="${item.title}" class="vx-cart-item-thumb" onerror="this.src='${FALLBACK_THUMB}'">
          <div style="flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
            <div style="font-size: 13px; font-weight: 600; color: var(--vx-text); line-height: 1.35; margin-bottom: 4px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
              ${item.title}
            </div>
            <div style="font-size: 13.5px; font-weight: 700; color: var(--vx-text);">
              &#8377;${itemInr.toLocaleString('en-IN')}
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 6px;">
              <div style="display: flex; align-items: center; gap: 8px; background: #FFFFFF; border: 1px solid var(--vx-border); border-radius: 4px; padding: 2px 6px;">
                <button type="button" class="btn-qty-minus" data-id="${item.id}" style="font-weight: 700; font-size: 14px; color: var(--vx-text);">&minus;</button>
                <span style="font-size: 12px; font-weight: 600;">${item.quantity}</span>
                <button type="button" class="btn-qty-plus" data-id="${item.id}" style="font-weight: 700; font-size: 14px; color: var(--vx-text);">&plus;</button>
              </div>
              <button type="button" class="btn-remove-item" data-id="${item.id}" style="font-size: 11px; color: var(--vx-coral); font-weight: 600;">Remove</button>
            </div>
          </div>
        </div>
      `;
      })
      .join("");

    el.cartSubtotalVal.textContent = `₹${subtotalInr.toLocaleString('en-IN')}`;

    // Bind Cart Item Buttons
    el.cartItemsStream.querySelectorAll(".btn-qty-minus").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = parseInt(btn.getAttribute("data-id"), 10);
        const item = state.cartItems.find((i) => i.id === id);
        if (item) {
          item.quantity -= 1;
          if (item.quantity <= 0) {
            state.cartItems = state.cartItems.filter((i) => i.id !== id);
          }
          updateCartUI();
        }
      });
    });

    el.cartItemsStream.querySelectorAll(".btn-qty-plus").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = parseInt(btn.getAttribute("data-id"), 10);
        const item = state.cartItems.find((i) => i.id === id);
        if (item) {
          item.quantity += 1;
          updateCartUI();
        }
      });
    });

    el.cartItemsStream.querySelectorAll(".btn-remove-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = parseInt(btn.getAttribute("data-id"), 10);
        state.cartItems = state.cartItems.filter((i) => i.id !== id);
        updateCartUI();
      });
    });
  }

  // ============================================================================
  // STOREFRONT CATALOG (GET /api/v1/catalog)
  // ============================================================================

  async function fetchCatalog() {
    const params = new URLSearchParams({ limit: "48" });
    if (state.searchQuery) params.append("search", state.searchQuery);
    if (state.activeCategory) params.append("category", state.activeCategory);

    try {
      const res = await fetch(`/api/v1/catalog?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const items = await res.json();
      state.catalog = items;
      renderCatalogGrid(items);
      el.catalogCountNote.textContent = `Displaying ${items.length} curated essentials in "${state.searchQuery || state.activeCategory || 'All Collections'}"`;
    } catch (err) {
      el.storeCatalogGrid.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 48px; text-align: center; color: var(--vx-text-muted);">
          Unable to retrieve inventory catalog right now.
        </div>`;
    }
  }

  function renderCatalogGrid(items) {
    if (!items || items.length === 0) {
      el.storeCatalogGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: var(--vx-text-muted);">
          <div style="font-size: 16px; font-weight: 700; color: var(--vx-text); margin-bottom: 6px;">No products found for "${state.searchQuery}"</div>
          <div>Try adjusting keywords or selecting an alternate collection filter.</div>
        </div>`;
      return;
    }

    el.storeCatalogGrid.innerHTML = items
      .map((it, idx) => {
        const thumb = it.image_url || FALLBACK_THUMB;
        const inr = formatInr(it.price);
        const mrp = formatMrp(it.price);
        const badge = idx % 3 === 0
          ? '<span class="badge-pill-fast">Fast Delivery</span>'
          : idx % 2 === 0
          ? '<span class="badge-pill-deal">20% Off</span>'
          : '';

        return `
        <article class="vx-product-card card-hover" data-id="${it.id}">
          <div>
            ${badge ? `<div class="vx-badge-row">${badge}</div>` : ''}
            <div class="vx-product-img-box btn-open-quickview" data-id="${it.id}">
              <img src="${thumb}" alt="${it.title}" class="vx-product-img" loading="lazy" onerror="this.src='${FALLBACK_THUMB}'">
            </div>

            <div class="vx-card-brand">${it.brand || (it.category || 'VORTEX').toUpperCase()}</div>
            <h3 class="vx-card-title btn-open-quickview" data-id="${it.id}" title="${it.title}">
              ${it.title}
            </h3>

            <div class="vx-rating-row">
              <span class="vx-stars">&#9733;&#9733;&#9733;&#9733;&#9733;</span>
              <span style="font-weight: 600; color: var(--vx-text);">4.8</span>
              <span class="vx-review-count">(${(1200 + it.id * 31).toLocaleString('en-IN')})</span>
            </div>

            <div class="vx-price-row">
              <span class="vx-price-main">&#8377;${inr}</span>
              <span class="vx-mrp-strikethrough">&#8377;${mrp}</span>
              <span class="vx-savings-tag">Save 26%</span>
            </div>
          </div>

          <div class="vx-card-actions">
            <button type="button" class="btn-vx-card-cart btn-add-bag" data-id="${it.id}">
              Add to Cart
            </button>
            <button type="button" class="btn-vx-card-quicklook btn-open-quickview" data-id="${it.id}" title="Quick Look">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            </button>
          </div>
        </article>
      `;
      })
      .join("");

    // Attach click triggers
    el.storeCatalogGrid.querySelectorAll(".btn-open-quickview").forEach((trigger) => {
      trigger.addEventListener("click", () => {
        const id = parseInt(trigger.getAttribute("data-id"), 10);
        const product = state.catalog.find((p) => p.id === id);
        if (product) openQuickView(product);
      });
    });

    el.storeCatalogGrid.querySelectorAll(".btn-add-bag").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = parseInt(btn.getAttribute("data-id"), 10);
        const product = state.catalog.find((p) => p.id === id);
        if (product) addToCart(product);
      });
    });
  }

  // ============================================================================
  // INVISIBLE DWELL-TIME TRACKING & QUICK-VIEW FLYOUT
  // ============================================================================

  function openQuickView(product) {
    state.currentQuickViewProduct = product;
    // Silently capture open timestamp using high-resolution performance timer
    state.dwellStartTimestamp = performance.now();

    el.modalImg.src = product.image_url || FALLBACK_THUMB;
    el.modalBrand.textContent = (product.brand || (product.category || 'VORTEX SELECT')).toUpperCase();
    el.modalTitle.textContent = product.title;
    el.modalPrice.textContent = `₹${formatInr(product.price)}`;
    el.modalMrp.textContent = `₹${formatMrp(product.price)}`;
    el.modalDesc.textContent = product.description || "Premium quality product backed by manufacturer warranty and 7-day easy returns.";

    el.quickViewModal.classList.add("open");
  }

  function closeQuickViewAndTrackDwell() {
    if (!state.currentQuickViewProduct) {
      el.quickViewModal.classList.remove("open");
      return;
    }

    // Calculate elapsed dwell duration silently
    const elapsedSeconds = parseFloat(((performance.now() - state.dwellStartTimestamp) / 1000.0).toFixed(3));
    const viewedProduct = state.currentQuickViewProduct;

    // Immediately close modal visually (0 delay)
    el.quickViewModal.classList.remove("open");
    state.currentQuickViewProduct = null;

    // Reject bounce clicks (< 0.5s) per enterprise specification
    if (elapsedSeconds < 0.5) return;

    // Record interaction telemetry
    state.recentInteractions.push({
      product_id: viewedProduct.id,
      dwell_time_seconds: elapsedSeconds,
    });

    // Dispatch background telemetry beacon to recalibrate vector recommendations
    dispatchDwellTelemetry();
  }

  async function dispatchDwellTelemetry() {
    try {
      if (el.recsFreshIndicator) {
        el.recsFreshIndicator.style.display = "inline-block";
        el.recsFreshIndicator.textContent = "Updating...";
      }

      const payload = {
        user_id: state.userId,
        query_text: state.searchQuery || null,
        recent_interactions: state.recentInteractions,
        top_k: 6,
      };

      const res = await fetch("/api/v1/recommend/dwell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      state.recommended = data.recommendations;
      renderRecommendedTrack(data.recommendations);
      if (el.recsFreshIndicator) {
        el.recsFreshIndicator.textContent = "Updated for you";
        setTimeout(() => {
          if (el.recsFreshIndicator) el.recsFreshIndicator.style.display = "none";
        }, 2000);
      }
    } catch (err) {
      if (el.recsFreshIndicator) {
        el.recsFreshIndicator.style.display = "none";
      }
    }
  }

  async function fetchInitialRecommendations() {
    try {
      const res = await fetch("/api/v1/recommend/dwell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: state.userId,
          query_text: "audio laptops wearables living essentials",
          recent_interactions: [],
          top_k: 6,
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      state.recommended = data.recommendations;
      renderRecommendedTrack(data.recommendations);
    } catch (err) {
      // Keep initial placeholder
    }
  }

  function renderRecommendedTrack(recommendations) {
    if (!recommendations || recommendations.length === 0) return;

    el.recommendedGrid.innerHTML = recommendations
      .map((it) => {
        const thumb = it.image_url || FALLBACK_THUMB;
        const inr = formatInr(it.price);

        return `
        <div class="vx-rec-item btn-rec-card card-hover" data-id="${it.id}">
          <div class="vx-rec-thumb-box">
            <img src="${thumb}" alt="${it.title}" class="vx-rec-thumb" loading="lazy" onerror="this.src='${FALLBACK_THUMB}'">
          </div>
          <div class="vx-rec-title" title="${it.title}">${it.title}</div>
          <div style="font-size: 10px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">
            ${(it.category || 'ESSENTIAL').toUpperCase()}
          </div>
          <div style="font-size: 15px; font-weight: 700; color: var(--vx-text); margin-bottom: 8px;">
            &#8377;${inr}
          </div>
          <button type="button" class="btn-vx-card-cart" style="height: 32px; font-size: 11.5px; margin-top: auto;">
            Add to Cart
          </button>
        </div>
      `;
      })
      .join("");

    el.recommendedGrid.querySelectorAll(".btn-rec-card").forEach((card) => {
      card.addEventListener("click", () => {
        const id = parseInt(card.getAttribute("data-id"), 10);
        const product = state.catalog.find((p) => p.id === id) || state.recommended.find((p) => p.id === id);
        if (product) openQuickView(product);
      });
    });
  }

  // ============================================================================
  // YOLOv8 VISUAL SEARCH
  // ============================================================================

  function handleVisualUpload(e) {
    if (e.target.files && e.target.files[0]) {
      uploadPhotoForVisualMatch(e.target.files[0]);
    }
  }

  async function uploadPhotoForVisualMatch(file) {
    el.visualStatusNotice.textContent = "Analyzing image and finding visually matching products...";
    el.visualInspectionBox.style.display = "block";
    el.visualMatchesContainer.style.display = "none";

    const reader = new FileReader();
    reader.onload = (e) => {
      el.visualPreviewImg.src = e.target.result;
    };
    reader.readAsDataURL(file);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("top_k", "4");

    try {
      const res = await fetch("/api/v1/search/visual", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      el.visualLabelNotice.textContent = `Detected: ${data.detected_label || 'Product'}`;
      el.visualStatusNotice.textContent = "Matching products found in catalog.";

      if (data.cropped_image_base64) {
        el.visualPreviewImg.src = `data:image/jpeg;base64,${data.cropped_image_base64}`;
      }

      if (data.recommendations && data.recommendations.length > 0) {
        el.visualMatchesContainer.style.display = "block";
        el.visualMatchesGrid.innerHTML = data.recommendations
          .map((it) => {
            const thumb = it.image_url || FALLBACK_THUMB;
            return `
            <div class="vx-product-card" style="padding: 10px; cursor: pointer;" onclick="window.location.hash='catalog'">
              <div style="height: 80px; display: flex; align-items: center; justify-content: center; margin-bottom: 6px;">
                <img src="${thumb}" alt="${it.title}" style="max-width: 100%; max-height: 100%; object-fit: contain;">
              </div>
              <div style="font-size: 11.5px; font-weight: 600; line-height: 1.25; margin-bottom: 4px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                ${it.title}
              </div>
              <div style="font-weight: 700; font-size: 13px;">&#8377;${formatInr(it.price)}</div>
            </div>
          `;
          })
          .join("");
      }
    } catch (err) {
      el.visualStatusNotice.textContent = "Unable to process photo: " + err.message;
    }
  }

  // ============================================================================
  // CUSTOMER SUPPORT & ESCALATION DRAWER (LANGGRAPH AGENT)
  // ============================================================================

  async function handleSupportChatSubmit(e) {
    e.preventDefault();
    const msg = el.drawerChatInput.value.trim();
    if (!msg) return;

    appendChatBubble("user", msg);
    el.drawerChatInput.value = "";

    const typingId = appendChatBubble("concierge", "Looking into that for you...");

    try {
      const res = await fetch("/api/v1/support/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          thread_id: state.threadId,
          message: msg,
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      removeChatBubble(typingId);

      let responseText = data.response;
      if (data.escalation_needed) {
        responseText += `\n\nNote: For refund requests exceeding ₹1,000, your claim has been forwarded to our Senior Support Team for manual verification and approval. You will receive confirmation shortly.`;
      }

      appendChatBubble("concierge", responseText);
    } catch (err) {
      removeChatBubble(typingId);
      appendChatBubble("concierge", "Our customer support team is currently assisting other shoppers. Please retry in a moment.");
    }
  }

  function appendChatBubble(role, text) {
    const id = "bubble_" + Math.random().toString(36).substring(2, 8);
    const div = document.createElement("div");
    div.id = id;
    div.className = `chat-bubble ${role}`;
    div.innerText = text;
    el.drawerChatStream.appendChild(div);
    el.drawerChatStream.scrollTop = el.drawerChatStream.scrollHeight;
    return id;
  }

  function removeChatBubble(id) {
    const b = document.getElementById(id);
    if (b) b.remove();
  }

  window.addEventListener("DOMContentLoaded", init);
})();
