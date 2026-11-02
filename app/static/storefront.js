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
    shelfSearchResults: document.getElementById("shelfSearchResults"),
    searchResultsTitle: document.getElementById("searchResultsTitle"),
    btnClearSearch: document.getElementById("btnClearSearch"),
    storeCatalogGrid: document.getElementById("storeCatalogGrid"),
    catalogCountNote: document.getElementById("catalogCountNote"),
    shelfRecommended: document.getElementById("shelf-recommended"),
    recommendedGrid: document.getElementById("recommendedGrid"),
    recsFreshIndicator: document.getElementById("recsFreshIndicator"),
    shelfTech: document.getElementById("shelf-tech"),
    gridTech: document.getElementById("gridTech"),
    shelfJewellery: document.getElementById("shelf-jewellery"),
    gridJewellery: document.getElementById("gridJewellery"),
    shelfHome: document.getElementById("shelf-home"),
    gridHome: document.getElementById("gridHome"),
    shelfCare: document.getElementById("shelf-care"),
    gridCare: document.getElementById("gridCare"),
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
    carouselDots: document.querySelectorAll(".hero-dot, .vx-carousel-dot"),

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

    // Check for openSupport deep link from PDP
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("openSupport") === "true") {
      setTimeout(() => {
        if (el.supportDrawer) {
          el.supportDrawer.classList.add("open");
          if (el.drawerChatInput) el.drawerChatInput.focus();
        }
      }, 350);
    }
  }

  // ============================================================================
  // EVENT BINDINGS
  // ============================================================================

  function bindEvents() {
    // Search input
    if (el.btnSearchSubmit) {
      el.btnSearchSubmit.addEventListener("click", () => {
        state.searchQuery = el.storeSearchInput ? el.storeSearchInput.value.trim() : "";
        fetchCatalog();
        smoothScrollTo("#shelfSearchResults");
      });
    }

    if (el.storeSearchInput) {
      el.storeSearchInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          state.searchQuery = el.storeSearchInput.value.trim();
          fetchCatalog();
          smoothScrollTo("#shelfSearchResults");
        }
      });
    }

    // Clear Search & Filter Button
    if (el.btnClearSearch) {
      el.btnClearSearch.addEventListener("click", () => {
        state.searchQuery = "";
        state.activeCategory = "";
        if (el.storeSearchInput) el.storeSearchInput.value = "";
        if (el.categorySelectDropdown) el.categorySelectDropdown.value = "";
        updateCategoryStripActive("");
        if (el.shelfSearchResults) el.shelfSearchResults.style.display = "none";
        fetchCatalog();
        smoothScrollTo("#shelf-recommended");
      });
    }

    // Category dropdown
    if (el.categorySelectDropdown) {
      el.categorySelectDropdown.addEventListener("change", (e) => {
        state.activeCategory = e.target.value;
        updateCategoryStripActive(state.activeCategory);
        if (state.activeCategory) {
          fetchCatalog();
          smoothScrollTo("#shelfSearchResults");
        } else {
          if (el.shelfSearchResults) el.shelfSearchResults.style.display = "none";
          fetchCatalog();
          smoothScrollTo("#shelf-recommended");
        }
      });
    }

    // Category strip pills (Direct Anchor Navigation to Curated Sector Shelves)
    document.querySelectorAll(".vx-cat-pill").forEach((pill) => {
      pill.addEventListener("click", () => {
        const cat = pill.getAttribute("data-cat") || "";
        const target = pill.getAttribute("data-target");
        state.activeCategory = cat;
        if (el.categorySelectDropdown) el.categorySelectDropdown.value = cat;
        updateCategoryStripActive(cat);

        if (target) {
          if (el.shelfSearchResults) el.shelfSearchResults.style.display = "none";
          smoothScrollTo(target);
        } else {
          // "All Curated Collections": Reset any search, scroll to top recommended
          state.searchQuery = "";
          if (el.storeSearchInput) el.storeSearchInput.value = "";
          if (el.shelfSearchResults) el.shelfSearchResults.style.display = "none";
          fetchCatalog();
          smoothScrollTo("#shelf-recommended");
        }
      });
    });

    // Bento Card quick jump to sector shelves
    document.querySelectorAll(".bento-filter-trigger").forEach((card) => {
      card.addEventListener("click", () => {
        const cat = card.getAttribute("data-cat") || "";
        let target = "#shelf-recommended";
        if (cat === "audio" || cat === "electronics" || cat === "wearables") {
          target = "#shelf-tech";
        } else if (cat === "fragrances") {
          target = "#shelf-jewellery";
        } else if (cat === "furniture") {
          target = "#shelf-home";
        } else if (cat === "beauty") {
          target = "#shelf-care";
        }
        updateCategoryStripActive(cat);
        smoothScrollTo(target);
      });
    });

    // Sector Shelf Action Buttons ("Explore Tech →", "Shop Home →", etc.)
    document.querySelectorAll(".btn-shelf-explore").forEach((btn) => {
      btn.addEventListener("click", () => {
        const cat = btn.getAttribute("data-cat") || "";
        if (cat) {
          state.activeCategory = cat;
          state.searchQuery = "";
          if (el.storeSearchInput) el.storeSearchInput.value = "";
          if (el.categorySelectDropdown) el.categorySelectDropdown.value = cat;
          updateCategoryStripActive(cat);
          fetchCatalog();
          smoothScrollTo("#shelfSearchResults");
        }
      });
    });

    // Footer category links
    document.querySelectorAll(".footer-cat-link").forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const cat = link.getAttribute("data-cat") || "";
        state.activeCategory = cat;
        if (el.categorySelectDropdown) el.categorySelectDropdown.value = cat;
        updateCategoryStripActive(cat);
        let target = "#shelf-recommended";
        if (cat === "audio" || cat === "electronics" || cat === "wearables") target = "#shelf-tech";
        else if (cat === "fragrances") target = "#shelf-jewellery";
        else if (cat === "furniture") target = "#shelf-home";
        else if (cat === "beauty") target = "#shelf-care";
        smoothScrollTo(target);
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
    document.querySelectorAll(".btn-trigger-specs").forEach((btn) => {
      btn.addEventListener("click", () => {
        const cat = btn.getAttribute("data-cat") || "";
        if (cat) {
          state.activeCategory = cat;
          if (el.categorySelectDropdown) el.categorySelectDropdown.value = cat;
          updateCategoryStripActive(cat);
          fetchCatalog();
        }
        smoothScrollTo("#shelfSearchResults");
      });
    });
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
    intervalMs: 5500,
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
        let target = "#shelf-recommended";
        if (cat === "audio" || cat === "electronics") target = "#shelf-tech";
        else if (cat === "fragrances") target = "#shelf-jewellery";
        else if (cat === "furniture") target = "#shelf-home";
        updateCategoryStripActive(cat);
        smoothScrollTo(target);
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
  // STOREFRONT CATALOG & CURATED SECTOR SHELVES
  // ============================================================================

  function renderProductCard(it, idx) {
    const thumb = it.image_url || FALLBACK_THUMB;
    const inr = formatInr(it.price);
    const mrp = formatMrp(it.price);
    const brand = it.brand || (it.category || 'VORTEX').toUpperCase();
    const ratingScore = (4.4 + ((it.id * 7) % 6) / 10).toFixed(1);
    const reviewCount = (850 + it.id * 39).toLocaleString('en-IN');
    const discountPct = 20 + ((it.id * 3) % 15);
    const isPrime = it.id % 2 === 0;

    return `
    <article class="product-card vx-card-showcase group relative" data-id="${it.id}">
      <!-- Upper Zone: The Framed Product Stage (#F8FAFC to #F1F5F9) -->
      <div class="card-stage card-square-visual aspect-square bg-slate-100/80 rounded-xl p-4 flex items-center justify-center border border-slate-200/60 overflow-hidden relative">
        ${isPrime ? `<span class="card-stage-tag absolute top-2.5 left-2.5 bg-white/95 text-slate-800 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-slate-200 shadow-xs z-10">Plus</span>` : ''}
        <button type="button" class="btn-card-wishlist w-7 h-7 bg-white/90 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-white shadow-xs absolute top-2.5 right-2.5 z-10 transition-all duration-200" aria-label="Save to Wishlist" title="Save to Wishlist" data-id="${it.id}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"></path>
          </svg>
        </button>
        <img src="${thumb}" alt="${it.title}" class="card-square-img object-contain max-h-40 w-auto group-hover:scale-105 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]" loading="lazy" onerror="this.src='${FALLBACK_THUMB}'">
      </div>

      <!-- Lower Zone: High-Contrast Info Stage (#FFFFFF) -->
      <div class="card-content-wrap card-info-stage mt-3 space-y-1.5 bg-white">
        <span class="card-brand-label text-[11px] font-bold text-slate-500 uppercase tracking-wider block">${brand}</span>
        <h3 class="card-title-text text-sm font-semibold text-slate-900 line-clamp-1 leading-snug group-hover:text-blue-600 transition-colors" title="${it.title}">${it.title}</h3>
        
        <div class="card-rating-pill flex items-center gap-1.5">
          <span class="rating-badge card-rating-badge bg-emerald-700 text-white font-bold text-[11px] px-1.5 py-0.5 rounded inline-flex items-center gap-0.5 leading-none">
            ${ratingScore} ★
          </span>
          <span class="rating-count-sub text-slate-400 text-xs font-normal">(${reviewCount})</span>
        </div>

        <div class="card-price-cluster card-price-row flex items-baseline gap-2 pt-0.5">
          <span class="text-price card-price-curr text-base font-extrabold text-slate-950">&#8377;${inr}</span>
          <span class="card-price-orig card-price-mrp text-xs text-slate-400 line-through">&#8377;${mrp}</span>
          <span class="badge-discount card-save-pill text-xs font-bold text-emerald-600">${discountPct}% off</span>
        </div>
      </div>

      <!-- Action CTA -->
      <button type="button" class="btn-shelf-add-cart btn-add-bag w-full mt-2 bg-slate-900 hover:bg-black text-white font-medium text-xs py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5" data-id="${it.id}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"></path>
          <path d="M3 6h18"></path>
          <path d="M16 10a4 4 0 0 1-8 0"></path>
        </svg>
        <span>Add to Cart</span>
      </button>
    </article>
    `;
  }

  function bindCardInteractions(container) {
    if (!container) return;

    // 1. Direct card click navigates to PDP (/product/:id) with dwell capture
    container.querySelectorAll(".vx-card-showcase").forEach((card) => {
      card.addEventListener("click", (e) => {
        if (e.target.closest(".btn-card-wishlist") || e.target.closest(".btn-add-bag")) {
          return;
        }
        const id = card.getAttribute("data-id");
        if (id) {
          recordCardClickDwell(parseInt(id, 10));
          window.location.href = `/product/${id}`;
        }
      });
    });

    // 2. Add to Cart with tactile confirmation state
    container.querySelectorAll(".btn-add-bag").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = parseInt(btn.getAttribute("data-id"), 10);
        const product = state.catalog.find((p) => p.id === id) || state.recommended.find((p) => p.id === id);
        if (product) {
          addToCart(product);
          const origHtml = btn.innerHTML;
          btn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
            <span>Added!</span>
          `;
          btn.classList.add("added");
          setTimeout(() => {
            btn.innerHTML = origHtml;
            btn.classList.remove("added");
          }, 1200);
        }
      });
    });

    // 3. Wishlist Toggle
    container.querySelectorAll(".btn-card-wishlist").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        btn.classList.toggle("active");
      });
    });
  }

  function recordCardClickDwell(productId) {
    if (!productId) return;
    state.recentInteractions.push({
      product_id: productId,
      dwell_time_seconds: 2.0,
    });
    dispatchDwellTelemetry();
  }

  function populateSectorShelves(items) {
    if (!items || items.length === 0) return;

    // 1. Tech Shelf (Audio, Computing & Smart Wearables) - 4 Flagship Items
    if (el.gridTech) {
      const techItems = items.filter((p) =>
        ['laptops', 'smartphones', 'tablets', 'mobile-accessories'].includes(p.category)
      ).slice(0, 4);
      el.gridTech.innerHTML = techItems.map((p, i) => renderProductCard(p, i)).join("");
      bindCardInteractions(el.gridTech);
    }

    // 2. Fine Jewellery & Luxury Accents (Heritage Craft & Watches) - 4 Flagship Items
    if (el.gridJewellery) {
      const jewelItems = items.filter((p) =>
        ['womens-jewellery', 'mens-watches', 'womens-watches', 'fragrances'].includes(p.category)
      ).slice(0, 4);
      el.gridJewellery.innerHTML = jewelItems.map((p, i) => renderProductCard(p, i)).join("");
      bindCardInteractions(el.gridJewellery);
    }

    // 3. Home Living & Smart Appliances (Kitchen & Furniture Craft) - 4 Flagship Items
    if (el.gridHome) {
      const homeItems = items.filter((p) =>
        ['furniture', 'kitchen-accessories', 'home-decoration'].includes(p.category)
      ).slice(0, 4);
      el.gridHome.innerHTML = homeItems.map((p, i) => renderProductCard(p, i)).join("");
      bindCardInteractions(el.gridHome);
    }

    // 4. Daily Care & Essentials (Beauty, Formulations & Wellness) - 4 Flagship Items
    if (el.gridCare) {
      const careItems = items.filter((p) =>
        ['beauty', 'skin-care', 'groceries'].includes(p.category)
      ).slice(0, 4);
      el.gridCare.innerHTML = careItems.map((p, i) => renderProductCard(p, i)).join("");
      bindCardInteractions(el.gridCare);
    }
  }

  function renderSearchFilterResults(items) {
    if (!el.shelfSearchResults) return;
    el.shelfSearchResults.style.display = "block";

    const filterLabel = state.searchQuery 
      ? `Search results for "${state.searchQuery}"`
      : `Filtered by "${state.activeCategory}"`;

    if (el.searchResultsTitle) {
      el.searchResultsTitle.textContent = filterLabel;
    }
    if (el.catalogCountNote) {
      el.catalogCountNote.textContent = `Showing ${items.length} matching items`;
    }

    if (!items || items.length === 0) {
      el.storeCatalogGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 48px 20px; color: var(--vx-text-secondary);">
          <div style="font-size: 16px; font-weight: 700; color: var(--vx-text); margin-bottom: 6px;">No products found</div>
          <div style="font-size: 13px;">Try adjusting keywords or selecting an alternate category filter.</div>
        </div>`;
      return;
    }

    el.storeCatalogGrid.innerHTML = items
      .map((it, idx) => renderProductCard(it, idx))
      .join("");

    bindCardInteractions(el.storeCatalogGrid);
  }

  async function fetchCatalog() {
    const params = new URLSearchParams({ limit: "200" });
    if (state.searchQuery) params.append("search", state.searchQuery);
    if (state.activeCategory) params.append("category", state.activeCategory);

    try {
      const res = await fetch(`/api/v1/catalog?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const items = await res.json();
      state.catalog = items;

      if (state.searchQuery || (state.activeCategory && state.activeCategory !== "")) {
        renderSearchFilterResults(items);
      } else {
        if (el.shelfSearchResults) el.shelfSearchResults.style.display = "none";
        populateSectorShelves(items);
      }
    } catch (err) {
      if (el.storeCatalogGrid) {
        el.storeCatalogGrid.innerHTML = `
          <div style="grid-column: 1 / -1; padding: 48px; text-align: center; color: var(--vx-text-muted);">
            Unable to retrieve inventory catalog right now.
          </div>`;
      }
    }
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
    if (!el.recommendedGrid) return;
    if (!recommendations || recommendations.length === 0) {
      el.recommendedGrid.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 24px; text-align: center; color: var(--vx-text-muted);">
          No personalized recommendations yet. Browse items to personalize your feed.
        </div>`;
      return;
    }

    const topRecs = recommendations.slice(0, 4);
    el.recommendedGrid.innerHTML = topRecs
      .map((it, idx) => renderProductCard(it, idx))
      .join("");

    bindCardInteractions(el.recommendedGrid);
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
            <div class="vx-card-showcase" style="padding: 10px; cursor: pointer;" onclick="window.location.href='/product/${it.id}'">
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
