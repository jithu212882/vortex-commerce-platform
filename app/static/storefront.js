/**
 * AMAZON.IN PRODUCTION STOREFRONT CLIENT ENGINE
 * - High-density Amazon desktop & mobile interface
 * - Real-time implicit dwell-time telemetry tracking
 * - Amazon Lens (YOLOv8) visual product search
 * - Customer service chat powered by LangGraph policy checkpoint graph
 */

(function () {
  "use strict";

  // Session State
  const state = {
    userId: "sreejith_cust_" + Math.random().toString(36).substring(2, 8),
    threadId: "ticket_amz_" + Math.floor(1000 + Math.random() * 9000),
    catalog: [],
    recommended: [],
    recentInteractions: [], // [{ product_id, dwell_time_seconds }]
    activeCategory: "",
    searchQuery: "",
    currentQuickViewProduct: null,
    dwellStartTimestamp: 0,
    cartCount: 0,
    heroSlideIndex: 0,
    heroAutoTimer: null,
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
    cartCountBadge: document.getElementById("cartCountBadge"),
    btnCartTrigger: document.getElementById("btnCartTrigger"),
    btnBackToTop: document.getElementById("btnBackToTop"),

    // Hero Carousel
    btnHeroPrev: document.getElementById("btnHeroPrev"),
    btnHeroNext: document.getElementById("btnHeroNext"),
    heroSlides: [
      document.getElementById("heroSlide1"),
      document.getElementById("heroSlide2"),
      document.getElementById("heroSlide3"),
    ],

    // Quick View Modal (Flyout)
    quickViewModal: document.getElementById("quickViewModal"),
    btnCloseQuickView: document.getElementById("btnCloseQuickView"),
    btnDismissModal: document.getElementById("btnDismissModal"),
    modalImg: document.getElementById("modalImg"),
    modalCategory: document.getElementById("modalCategory"),
    modalTitle: document.getElementById("modalTitle"),
    modalBrand: document.getElementById("modalBrand"),
    modalPrice: document.getElementById("modalPrice"),
    modalMrp: document.getElementById("modalMrp"),
    modalDiscount: document.getElementById("modalDiscount"),
    modalDesc: document.getElementById("modalDesc"),
    btnAddToCartModal: document.getElementById("btnAddToCartModal"),
    btnBuyNowModal: document.getElementById("btnBuyNowModal"),

    // Amazon Lens Visual Search
    visualSearchModal: document.getElementById("visualSearchModal"),
    btnSearchPhotoTrigger: document.getElementById("btnSearchPhotoTrigger"),
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

    // Customer Service Drawer
    supportDrawer: document.getElementById("supportDrawer"),
    btnOpenSupportDrawer: document.getElementById("btnOpenSupportDrawer"),
    btnCloseDrawer: document.getElementById("btnCloseDrawer"),
    navReturnsOrders: document.getElementById("navReturnsOrders"),
    drawerChatStream: document.getElementById("drawerChatStream"),
    drawerChatForm: document.getElementById("drawerChatForm"),
    drawerChatInput: document.getElementById("drawerChatInput"),
    chipTrackOrder: document.getElementById("chipTrackOrder"),
    chipRefundPrompt: document.getElementById("chipRefundPrompt"),
    chipCheckStock: document.getElementById("chipCheckStock"),
  };

  const FALLBACK_THUMB = "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=400&q=80";

  // Currency Formatter Helper (USD to INR conversion display)
  function formatInr(usdPrice) {
    const inr = Math.round(Number(usdPrice) * 83);
    return inr.toLocaleString("en-IN");
  }
  function formatMrp(usdPrice) {
    const inr = Math.round(Number(usdPrice) * 83 * 1.45);
    return inr.toLocaleString("en-IN");
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  function init() {
    bindEvents();
    startHeroAutoRotate();
    fetchCatalog();
    fetchInitialRecommendations();
  }

  // ============================================================================
  // EVENT BINDINGS
  // ============================================================================

  function bindEvents() {
    // Search input execution
    el.btnSearchSubmit.addEventListener("click", () => {
      state.searchQuery = el.storeSearchInput.value.trim();
      fetchCatalog();
      smoothScrollTo("#results");
    });

    el.storeSearchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        state.searchQuery = el.storeSearchInput.value.trim();
        fetchCatalog();
        smoothScrollTo("#results");
      }
    });

    // Category Select Dropdown
    el.categorySelectDropdown.addEventListener("change", (e) => {
      state.activeCategory = e.target.value;
      fetchCatalog();
      smoothScrollTo("#results");
    });

    // Sub-navbar category links
    document.querySelectorAll(".amz-subnav-link[data-cat]").forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const cat = link.getAttribute("data-cat");
        state.activeCategory = cat;
        el.categorySelectDropdown.value = cat;
        fetchCatalog();
        smoothScrollTo("#results");
      });
    });

    // 4-Item Feature Grid triggers
    document.querySelectorAll(".filter-trigger").forEach((elem) => {
      elem.addEventListener("click", (e) => {
        const cat = elem.getAttribute("data-cat") || "";
        state.activeCategory = cat;
        el.categorySelectDropdown.value = cat;
        fetchCatalog();
        smoothScrollTo("#results");
      });
    });

    // Hero Carousel controls
    el.btnHeroPrev.addEventListener("click", () => changeHeroSlide(-1));
    el.btnHeroNext.addEventListener("click", () => changeHeroSlide(1));

    // Back to top smooth scroll
    el.btnBackToTop.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    // Quick View Modal
    el.btnCloseQuickView.addEventListener("click", closeQuickViewAndTrackDwell);
    el.btnDismissModal.addEventListener("click", closeQuickViewAndTrackDwell);
    el.quickViewModal.addEventListener("click", (e) => {
      if (e.target === el.quickViewModal) closeQuickViewAndTrackDwell();
    });

    // Cart Button Trigger
    el.btnAddToCartModal.addEventListener("click", () => {
      incrementCart();
      el.btnAddToCartModal.textContent = "Added to Cart ✓";
      setTimeout(() => {
        el.btnAddToCartModal.textContent = "Add to Cart";
      }, 1400);
    });

    el.btnBuyNowModal.addEventListener("click", () => {
      incrementCart();
      closeQuickViewAndTrackDwell();
      alert("Proceeding to Amazon Secure Checkout (1-Click Buy Now).");
    });

    // Amazon Lens Visual Search Modal
    const openVisualModal = () => el.visualSearchModal.classList.add("open");
    el.btnSearchPhotoTrigger.addEventListener("click", openVisualModal);
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

    // Customer Service Support Drawer
    const openSupportDrawer = () => {
      el.supportDrawer.classList.add("open");
      el.drawerChatInput.focus();
    };
    el.btnOpenSupportDrawer.addEventListener("click", openSupportDrawer);
    el.navReturnsOrders.addEventListener("click", openSupportDrawer);
    el.btnCloseDrawer.addEventListener("click", () => el.supportDrawer.classList.remove("open"));

    // Support Form Submission
    el.drawerChatForm.addEventListener("submit", handleSupportChatSubmit);

    // Support Quick Chips
    el.chipTrackOrder.addEventListener("click", () => {
      el.drawerChatInput.value = "What is the status of my order #ORD-98214 to Marthandam?";
      el.drawerChatForm.dispatchEvent(new Event("submit"));
    });
    el.chipRefundPrompt.addEventListener("click", () => {
      el.drawerChatInput.value = "I would like to request a refund of ₹450 for damaged packaging.";
      el.drawerChatInput.focus();
    });
    el.chipCheckStock.addEventListener("click", () => {
      el.drawerChatInput.value = "Do you have Apple MacBook Pro workstations with M3 chip in stock?";
      el.drawerChatForm.dispatchEvent(new Event("submit"));
    });

    // Keyboard ESC to close modals/drawers
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (el.quickViewModal.classList.contains("open")) closeQuickViewAndTrackDwell();
        if (el.visualSearchModal.classList.contains("open")) el.visualSearchModal.classList.remove("open");
        if (el.supportDrawer.classList.contains("open")) el.supportDrawer.classList.remove("open");
      }
    });
  }

  function incrementCart() {
    state.cartCount++;
    el.cartCountBadge.textContent = state.cartCount;
    el.cartCountBadge.style.transform = "scale(1.3)";
    setTimeout(() => {
      el.cartCountBadge.style.transform = "scale(1)";
    }, 200);
  }

  function smoothScrollTo(selector) {
    const target = document.querySelector(selector);
    if (target) {
      target.scrollIntoView({ behavior: "smooth" });
    }
  }

  // ============================================================================
  // HERO CAROUSEL ENGINE
  // ============================================================================

  function changeHeroSlide(direction) {
    el.heroSlides[state.heroSlideIndex].classList.remove("active");
    state.heroSlideIndex = (state.heroSlideIndex + direction + el.heroSlides.length) % el.heroSlides.length;
    el.heroSlides[state.heroSlideIndex].classList.add("active");
  }

  function startHeroAutoRotate() {
    state.heroAutoTimer = setInterval(() => {
      changeHeroSlide(1);
    }, 6000);
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
      el.catalogCountNote.textContent = `1-48 of over ${items.length} results for "${state.searchQuery || state.activeCategory || 'All Products'}"`;
    } catch (err) {
      el.storeCatalogGrid.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 40px; text-align: center; color: var(--amz-text-secondary);">
          Unable to retrieve Amazon catalog products right now.
        </div>`;
    }
  }

  function renderCatalogGrid(items) {
    if (!items || items.length === 0) {
      el.storeCatalogGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: var(--amz-text-secondary);">
          <div style="font-size: 18px; font-weight: 700; color: var(--amz-text); margin-bottom: 6px;">No results found for "${state.searchQuery}"</div>
          <div>Try checking your spelling or use more general keywords.</div>
        </div>`;
      return;
    }

    el.storeCatalogGrid.innerHTML = items
      .map((it, idx) => {
        const thumb = it.image_url || FALLBACK_THUMB;
        const inr = formatInr(it.price);
        const mrp = formatMrp(it.price);
        const badgeHtml = idx % 3 === 0
          ? '<span class="badge-best-seller">#1 Best Seller</span>'
          : idx % 2 === 0
          ? '<span class="badge-limited-deal">Limited time deal</span>'
          : '';

        return `
        <article class="amz-product-card" data-id="${it.id}">
          <div>
            ${badgeHtml ? `<div class="badge-tag-row">${badgeHtml}</div>` : ''}
            <div class="amz-product-img-box btn-open-quickview" data-id="${it.id}">
              <img src="${thumb}" alt="${it.title}" class="amz-product-img" loading="lazy" onerror="this.src='${FALLBACK_THUMB}'">
            </div>

            <h3 class="amz-product-meta-title btn-open-quickview" data-id="${it.id}" title="${it.title}">
              ${it.title}
            </h3>

            <div class="amz-rating-row">
              <span class="amz-stars">&#9733;&#9733;&#9733;&#9733;&#9734;</span>
              <span class="amz-rating-count">${(1200 + it.id * 37).toLocaleString('en-IN')}</span>
            </div>

            <div class="amz-bought-count">${(100 + it.id * 15)}+ bought in past month</div>

            <div class="amz-price-cluster">
              <span class="amz-discount-tag">-31%</span>
              <span class="amz-price-main"><span class="amz-price-symbol">&#8377;</span>${inr}</span>
              <span class="amz-mrp-strikethrough">&#8377;${mrp}</span>
            </div>

            <div class="amz-prime-delivery-row">
              <span class="amz-prime-badge"><span class="amz-prime-check">&#10003;</span>prime</span>
              <span>FREE Delivery by Tomorrow</span>
            </div>
          </div>

          <div>
            <button type="button" class="amz-btn-add-cart btn-add-cart-action" data-id="${it.id}">
              Add to Cart
            </button>
            <button type="button" class="amz-btn-quick-look btn-open-quickview" data-id="${it.id}">
              Quick look
            </button>
          </div>
        </article>
      `;
      })
      .join("");

    // Attach Click Handlers
    el.storeCatalogGrid.querySelectorAll(".btn-open-quickview").forEach((trigger) => {
      trigger.addEventListener("click", () => {
        const id = parseInt(trigger.getAttribute("data-id"), 10);
        const product = state.catalog.find((p) => p.id === id);
        if (product) openQuickView(product);
      });
    });

    el.storeCatalogGrid.querySelectorAll(".btn-add-cart-action").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        incrementCart();
        btn.textContent = "Added ✓";
        setTimeout(() => {
          btn.textContent = "Add to Cart";
        }, 1200);
      });
    });
  }

  // ============================================================================
  // INVISIBLE DWELL-TIME TRACKING & FLYOUT MODAL ENGINE
  // ============================================================================

  function openQuickView(product) {
    state.currentQuickViewProduct = product;
    // Silently capture open timestamp using high-resolution performance timer
    state.dwellStartTimestamp = performance.now();

    el.modalImg.src = product.image_url || FALLBACK_THUMB;
    el.modalCategory.textContent = `#1 BEST SELLER IN ${(product.category || "ELECTRONICS").toUpperCase()}`;
    el.modalTitle.textContent = product.title;
    el.modalBrand.textContent = `Visit the ${product.brand || "Amazon"} Store`;
    el.modalPrice.textContent = formatInr(product.price);
    el.modalMrp.textContent = `₹${formatMrp(product.price)}`;
    el.modalDesc.textContent = product.description || "Amazon Certified refurbished & authentic retail packaging.";

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

    // Immediately close modal visually (0 UI delay)
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
      el.recsFreshIndicator.textContent = "Calibrating vector recommendations...";

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
      renderRecommendedCarousel(data.recommendations);
      el.recsFreshIndicator.textContent = "Updated live based on dwell signals";
    } catch (err) {
      el.recsFreshIndicator.textContent = "Live Dwell Telemetry Active";
    }
  }

  async function fetchInitialRecommendations() {
    try {
      const res = await fetch("/api/v1/recommend/dwell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: state.userId,
          query_text: "electronics accessories home lifestyle",
          recent_interactions: [],
          top_k: 6,
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      state.recommended = data.recommendations;
      renderRecommendedCarousel(data.recommendations);
    } catch (err) {
      // Keep placeholder
    }
  }

  function renderRecommendedCarousel(recommendations) {
    if (!recommendations || recommendations.length === 0) return;

    el.recommendedGrid.innerHTML = recommendations
      .map((it) => {
        const thumb = it.image_url || FALLBACK_THUMB;
        const inr = formatInr(it.price);
        const mrp = formatMrp(it.price);

        return `
        <div class="amz-carousel-item btn-rec-item" data-id="${it.id}">
          <div class="amz-carousel-thumb-wrap">
            <img src="${thumb}" alt="${it.title}" class="amz-carousel-thumb" loading="lazy" onerror="this.src='${FALLBACK_THUMB}'">
          </div>
          <div class="amz-carousel-title" title="${it.title}">${it.title}</div>
          <div class="amz-rating-row" style="margin-bottom: 2px;">
            <span class="amz-stars">&#9733;&#9733;&#9733;&#9733;&#9734;</span>
            <span class="amz-rating-count">${(900 + it.id * 23).toLocaleString('en-IN')}</span>
          </div>
          <div class="amz-price-cluster" style="margin-bottom: 4px;">
            <span class="amz-discount-tag" style="font-size: 14px;">-35%</span>
            <span class="amz-price-main" style="font-size: 16px;"><span class="amz-price-symbol" style="font-size: 10px;">&#8377;</span>${inr}</span>
            <span class="amz-mrp-strikethrough" style="font-size: 11px;">&#8377;${mrp}</span>
          </div>
          <div class="amz-prime-delivery-row" style="margin-bottom: 6px;">
            <span class="amz-prime-badge"><span class="amz-prime-check">&#10003;</span>prime</span>
            <span style="font-size: 11px;">FREE Delivery</span>
          </div>
          <button type="button" class="amz-btn-add-cart" style="height: 28px; font-size: 11.5px; margin-top: auto;">
            Add to Cart
          </button>
        </div>
      `;
      })
      .join("");

    el.recommendedGrid.querySelectorAll(".btn-rec-item").forEach((item) => {
      item.addEventListener("click", () => {
        const id = parseInt(item.getAttribute("data-id"), 10);
        const product = state.catalog.find((p) => p.id === id) || state.recommended.find((p) => p.id === id);
        if (product) openQuickView(product);
      });
    });
  }

  // ============================================================================
  // AMAZON LENS (YOLOV8 VISUAL SEARCH)
  // ============================================================================

  function handleVisualUpload(e) {
    if (e.target.files && e.target.files[0]) {
      uploadPhotoForVisualMatch(e.target.files[0]);
    }
  }

  async function uploadPhotoForVisualMatch(file) {
    el.visualStatusNotice.textContent = "Ultralytics YOLOv8 isolating object bounding boxes...";
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

      el.visualLabelNotice.textContent = `Detected Class: ${data.detected_label || 'Focal Object'}`;
      el.visualStatusNotice.textContent = `${data.status_message} (Latency: 32.5ms)`;

      if (data.cropped_image_base64) {
        el.visualPreviewImg.src = `data:image/jpeg;base64,${data.cropped_image_base64}`;
      }

      if (data.recommendations && data.recommendations.length > 0) {
        el.visualMatchesContainer.style.display = "block";
        el.visualMatchesGrid.innerHTML = data.recommendations
          .map((it) => {
            const thumb = it.image_url || FALLBACK_THUMB;
            return `
            <div class="amz-product-card" style="padding: 10px; cursor: pointer;" onclick="window.location.hash='results'">
              <div style="height: 90px; display: flex; align-items: center; justify-content: center; margin-bottom: 6px;">
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
      el.visualStatusNotice.textContent = "Visual search error: " + err.message;
    }
  }

  // ============================================================================
  // CUSTOMER SERVICE SUPPORT DRAWER (LANGGRAPH AGENT)
  // ============================================================================

  async function handleSupportChatSubmit(e) {
    e.preventDefault();
    const msg = el.drawerChatInput.value.trim();
    if (!msg) return;

    // Append user message
    appendChatBubble("user", msg);
    el.drawerChatInput.value = "";

    // Show temporary typing indicator
    const typingId = appendChatBubble("concierge", "Checking Amazon order records & policy...");

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
        responseText += `\n\n[POLICY CHECKPOINT] This claim has been automatically queued for human authorization in the Operations Cockpit (/admin).`;
      }

      appendChatBubble("concierge", responseText);
    } catch (err) {
      removeChatBubble(typingId);
      appendChatBubble("concierge", "Our customer service desk is currently operating under high volume. Please check back shortly.");
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
