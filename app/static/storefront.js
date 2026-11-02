/**
 * MERIDIAN PUBLIC STOREFRONT CLIENT ENGINE
 * Designed with Emil Kowalski's Design Engineering & Mobile-Native Craft.
 * - Micro-interactions under 200ms
 * - Invisible dwell-time telemetry tracking
 * - Smooth layout transitions & composite-only animations
 */

(function () {
  "use strict";

  // Client Session State
  const state = {
    userId: "cust_" + Math.random().toString(36).substring(2, 9),
    threadId: "ticket_cust_" + Math.floor(1000 + Math.random() * 9000),
    catalog: [],
    recommended: [],
    recentInteractions: [], // [{ product_id, dwell_time_seconds }]
    activeCategory: "",
    searchQuery: "",
    currentQuickViewProduct: null,
    dwellStartTimestamp: 0,
    cartCount: 0,
  };

  // DOM Elements
  const el = {
    storeCatalogGrid: document.getElementById("storeCatalogGrid"),
    recommendedGrid: document.getElementById("recommendedGrid"),
    catalogCountNote: document.getElementById("catalogCountNote"),
    recsFreshIndicator: document.getElementById("recsFreshIndicator"),
    storeSearchInput: document.getElementById("storeSearchInput"),
    categoryPillsRow: document.getElementById("categoryPillsRow"),
    cartCountBadge: document.getElementById("cartCountBadge"),
    btnCartTrigger: document.getElementById("btnCartTrigger"),

    // Quick View Modal
    quickViewModal: document.getElementById("quickViewModal"),
    modalHeading: document.getElementById("modalHeading"),
    modalImg: document.getElementById("modalImg"),
    modalCategory: document.getElementById("modalCategory"),
    modalTitle: document.getElementById("modalTitle"),
    modalBrand: document.getElementById("modalBrand"),
    modalPrice: document.getElementById("modalPrice"),
    modalDesc: document.getElementById("modalDesc"),
    btnCloseQuickView: document.getElementById("btnCloseQuickView"),
    btnDismissModal: document.getElementById("btnDismissModal"),
    btnAddToCartModal: document.getElementById("btnAddToCartModal"),

    // Visual Search Modal
    visualSearchModal: document.getElementById("visualSearchModal"),
    btnHeaderVisualSearch: document.getElementById("btnHeaderVisualSearch"),
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

    // Support Drawer
    supportDrawer: document.getElementById("supportDrawer"),
    btnOpenSupportDrawer: document.getElementById("btnOpenSupportDrawer"),
    btnCloseDrawer: document.getElementById("btnCloseDrawer"),
    drawerChatStream: document.getElementById("drawerChatStream"),
    drawerChatForm: document.getElementById("drawerChatForm"),
    drawerChatInput: document.getElementById("drawerChatInput"),
    chipTrackOrder: document.getElementById("chipTrackOrder"),
    chipRefundPrompt: document.getElementById("chipRefundPrompt"),
    chipCheckStock: document.getElementById("chipCheckStock"),
  };

  // Default fallback image if thumbnail fails
  const FALLBACK_THUMB = "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=400&q=80";

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  function init() {
    bindEvents();
    fetchCatalog();
    fetchInitialRecommendations();
  }

  // ============================================================================
  // EVENT BINDINGS
  // ============================================================================

  function bindEvents() {
    // Search input with debounce
    let searchDebounceTimer = null;
    el.storeSearchInput.addEventListener("input", (e) => {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => {
        state.searchQuery = e.target.value.trim();
        fetchCatalog();
      }, 180);
    });

    // Category pills
    el.categoryPillsRow.addEventListener("click", (e) => {
      const pill = e.target.closest(".filter-pill");
      if (!pill) return;

      el.categoryPillsRow.querySelectorAll(".filter-pill").forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");

      state.activeCategory = pill.getAttribute("data-category") || "";
      fetchCatalog();
    });

    // Quick View Modal
    el.btnCloseQuickView.addEventListener("click", closeQuickViewAndTrackDwell);
    el.btnDismissModal.addEventListener("click", closeQuickViewAndTrackDwell);
    el.quickViewModal.addEventListener("click", (e) => {
      if (e.target === el.quickViewModal) closeQuickViewAndTrackDwell();
    });

    // Cart button
    el.btnAddToCartModal.addEventListener("click", () => {
      state.cartCount++;
      el.cartCountBadge.textContent = state.cartCount;
      el.btnAddToCartModal.textContent = "Added to Bag ✓";
      setTimeout(() => {
        el.btnAddToCartModal.textContent = "Add to Bag";
      }, 1200);
    });

    // Visual Search Modal Triggers
    const openVisualModal = () => {
      el.visualSearchModal.classList.add("open");
    };
    el.btnHeaderVisualSearch.addEventListener("click", openVisualModal);
    el.btnSearchPhotoTrigger.addEventListener("click", openVisualModal);
    el.btnCloseVisualModal.addEventListener("click", () => {
      el.visualSearchModal.classList.remove("open");
    });
    el.visualSearchModal.addEventListener("click", (e) => {
      if (e.target === el.visualSearchModal) el.visualSearchModal.classList.remove("open");
    });

    // File Drag & Drop
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
    el.btnOpenSupportDrawer.addEventListener("click", () => {
      el.supportDrawer.classList.add("open");
      el.drawerChatInput.focus();
    });
    el.btnCloseDrawer.addEventListener("click", () => {
      el.supportDrawer.classList.remove("open");
    });

    // Support Form
    el.drawerChatForm.addEventListener("submit", handleSupportChatSubmit);

    // Support quick chips
    el.chipTrackOrder.addEventListener("click", () => {
      el.drawerChatInput.value = "What is the status of my order #ORD-8492?";
      el.drawerChatForm.dispatchEvent(new Event("submit"));
    });
    el.chipRefundPrompt.addEventListener("click", () => {
      el.drawerChatInput.value = "I would like to request a refund of $45.00 for the damaged bottle.";
      el.drawerChatInput.focus();
    });
    el.chipCheckStock.addEventListener("click", () => {
      el.drawerChatInput.value = "Do you have mechanical keyboards and curved displays in stock?";
      el.drawerChatForm.dispatchEvent(new Event("submit"));
    });

    // Keyboard navigation (ESC closes open modals & drawer)
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (el.quickViewModal.classList.contains("open")) closeQuickViewAndTrackDwell();
        if (el.visualSearchModal.classList.contains("open")) el.visualSearchModal.classList.remove("open");
        if (el.supportDrawer.classList.contains("open")) el.supportDrawer.classList.remove("open");
      }
    });
  }

  // ============================================================================
  // STOREFRONT CATALOG
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
      el.catalogCountNote.textContent = `Showing ${items.length} curated essentials`;
    } catch (err) {
      el.storeCatalogGrid.innerHTML = `<div class="text-muted" style="padding: 24px; text-align: center;">Unable to load catalog right now.</div>`;
    }
  }

  function renderCatalogGrid(items) {
    if (!items || items.length === 0) {
      el.storeCatalogGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 48px 16px; color: var(--text-muted);">
          No products match your current search or filter.
        </div>`;
      return;
    }

    el.storeCatalogGrid.innerHTML = items
      .map((it, idx) => {
        const thumb = it.image_url || FALLBACK_THUMB;
        const delay = Math.min(idx * 30, 300);
        return `
        <article class="product-item-card" data-id="${it.id}" style="animation: fadeIn var(--duration-normal) var(--ease-out) ${delay}ms both;">
          <div>
            <div class="product-img-wrapper">
              <img src="${thumb}" alt="${it.title}" class="product-img-main" loading="lazy" onerror="this.src='${FALLBACK_THUMB}'">
            </div>
            <div class="product-category-meta">${it.category}</div>
            <h3 class="product-card-title" title="${it.title}">${it.title}</h3>
          </div>
          <div class="product-price-row">
            <span class="product-price-val">$${Number(it.price).toFixed(2)}</span>
            <button class="btn-quick-view btn-open-quickview" data-id="${it.id}">
              Quick View
            </button>
          </div>
        </article>
      `;
      })
      .join("");

    // Attach click triggers
    el.storeCatalogGrid.querySelectorAll(".btn-open-quickview").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = parseInt(btn.getAttribute("data-id"), 10);
        const product = state.catalog.find((p) => p.id === id);
        if (product) openQuickView(product);
      });
    });
  }

  // ============================================================================
  // INVISIBLE DWELL-TIME TRACKING & MODAL ENGINE
  // ============================================================================

  function openQuickView(product) {
    state.currentQuickViewProduct = product;
    // Silently capture start timestamp
    state.dwellStartTimestamp = Date.now();

    el.modalImg.src = product.image_url || FALLBACK_THUMB;
    el.modalCategory.textContent = (product.category || "COLLECTION").toUpperCase();
    el.modalTitle.textContent = product.title;
    el.modalBrand.textContent = `Brand: ${product.brand || "Meridian Select"}`;
    el.modalPrice.textContent = `$${Number(product.price).toFixed(2)}`;
    el.modalDesc.textContent = product.description || "Precision-crafted essential designed for longevity and effortless everyday performance.";

    el.quickViewModal.classList.add("open");
  }

  function closeQuickViewAndTrackDwell() {
    if (!state.currentQuickViewProduct) {
      el.quickViewModal.classList.remove("open");
      return;
    }

    // Calculate elapsed dwell duration silently
    const elapsedMs = Date.now() - state.dwellStartTimestamp;
    const elapsedSeconds = parseFloat((elapsedMs / 1000.0).toFixed(3));
    const viewedProduct = state.currentQuickViewProduct;

    // Close modal visually immediately (0 lag)
    el.quickViewModal.classList.remove("open");
    state.currentQuickViewProduct = null;

    // Discard bounce taps under 200ms
    if (elapsedSeconds < 0.2) return;

    // Record telemetry interaction
    state.recentInteractions.push({
      product_id: viewedProduct.id,
      dwell_time_seconds: elapsedSeconds,
    });

    // Dispatch background telemetry beacon to recalibrate recommendations
    dispatchDwellTelemetry();
  }

  async function dispatchDwellTelemetry() {
    try {
      el.recsFreshIndicator.textContent = "Calibrating...";

      const payload = {
        user_id: state.userId,
        query_text: state.searchQuery || null,
        recent_interactions: state.recentInteractions,
        top_k: 4,
      };

      const res = await fetch("/api/v1/recommend/dwell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      state.recommended = data.recommendations;
      renderRecommendedGrid(data.recommendations);
      el.recsFreshIndicator.textContent = "Refined for you";
    } catch (err) {
      el.recsFreshIndicator.textContent = "";
    }
  }

  async function fetchInitialRecommendations() {
    try {
      const res = await fetch("/api/v1/recommend/dwell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: state.userId,
          top_k: 4,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        state.recommended = data.recommendations;
        renderRecommendedGrid(data.recommendations);
      }
    } catch (e) {
      // Graceful fallback
    }
  }

  function renderRecommendedGrid(items) {
    if (!items || items.length === 0) return;

    el.recommendedGrid.innerHTML = items
      .map((it) => {
        const thumb = it.image_url || FALLBACK_THUMB;
        return `
        <article class="product-item-card" data-id="${it.id}">
          <div>
            <div class="product-img-wrapper">
              <img src="${thumb}" alt="${it.title}" class="product-img-main" loading="lazy" onerror="this.src='${FALLBACK_THUMB}'">
            </div>
            <div class="product-category-meta">${it.category}</div>
            <h4 class="product-card-title" title="${it.title}">${it.title}</h4>
          </div>
          <div class="product-price-row">
            <span class="product-price-val">$${Number(it.price).toFixed(2)}</span>
            <button class="btn-quick-view btn-rec-quickview" data-id="${it.id}">
              Inspect
            </button>
          </div>
        </article>
      `;
      })
      .join("");

    el.recommendedGrid.querySelectorAll(".btn-rec-quickview").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = parseInt(btn.getAttribute("data-id"), 10);
        const product = items.find((p) => p.id === id) || state.catalog.find((p) => p.id === id);
        if (product) openQuickView(product);
      });
    });
  }

  // ============================================================================
  // VISUAL SEARCH
  // ============================================================================

  function handleVisualUpload(e) {
    if (e.target.files && e.target.files[0]) {
      uploadPhotoForVisualMatch(e.target.files[0]);
    }
  }

  async function uploadPhotoForVisualMatch(file) {
    el.visualInspectionBox.style.display = "block";
    el.visualLabelNotice.textContent = "Analyzing image with YOLOv8...";
    el.visualStatusNotice.textContent = "Isolating primary subject and matching catalog...";

    // Show temporary local preview
    el.visualPreviewImg.src = URL.createObjectURL(file);

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

      // Update preview if crop returned
      if (data.cropped_image_base64) {
        el.visualPreviewImg.src = data.cropped_image_base64;
      }

      el.visualLabelNotice.textContent = `Identified: ${data.detected_label || "Detected Object"}`;
      el.visualStatusNotice.textContent = "Closest matches from our catalog found below.";

      if (data.recommendations && data.recommendations.length > 0) {
        el.visualMatchesContainer.style.display = "block";
        el.visualMatchesGrid.innerHTML = data.recommendations
          .map((p) => `
            <div class="product-item-card">
              <div class="product-img-wrapper">
                <img src="${p.image_url || FALLBACK_THUMB}" class="product-img-main">
              </div>
              <div class="product-card-title">${p.title}</div>
              <div class="product-price-row">
                <span class="product-price-val">$${Number(p.price).toFixed(2)}</span>
                <button class="btn-quick-view btn-rec-quickview" data-id="${p.id}">Inspect</button>
              </div>
            </div>
          `)
          .join("");

        el.visualMatchesGrid.querySelectorAll(".btn-rec-quickview").forEach((b) => {
          b.addEventListener("click", () => {
            const id = parseInt(b.getAttribute("data-id"), 10);
            const matchItem = data.recommendations.find((m) => m.id === id);
            if (matchItem) {
              el.visualSearchModal.classList.remove("open");
              openQuickView(matchItem);
            }
          });
        });
      }
    } catch (err) {
      el.visualLabelNotice.textContent = "Visual search unavailable";
      el.visualStatusNotice.textContent = err.message;
    }
  }

  // ============================================================================
  // CUSTOMER CONCIERGE CHAT
  // ============================================================================

  async function handleSupportChatSubmit(e) {
    e.preventDefault();
    const message = el.drawerChatInput.value.trim();
    if (!message) return;

    appendChatBubble("customer", message);
    el.drawerChatInput.value = "";

    try {
      const res = await fetch("/api/v1/support/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          thread_id: state.threadId,
          message: message,
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // Clean, consumer-friendly response formatting
      let friendlyText = data.response;
      if (data.status === "auto_approved") {
        friendlyText = `✓ Your refund of $${Number(data.refund_amount || 0).toFixed(2)} has been authorized under our 30-day guarantee. Your disbursement is queued for processing.`;
      } else if (data.status === "pending_manager_approval") {
        friendlyText = `⏳ Your refund claim for $${Number(data.refund_amount || 0).toFixed(2)} has been submitted. Because it exceeds standard automated limits, our fulfillment specialist team is conducting a brief review. Ticket #${data.thread_id} will be updated shortly.`;
      }

      appendChatBubble("concierge", friendlyText);
    } catch (err) {
      appendChatBubble("concierge", "Our support desk is momentarily unavailable. Please retry in a few moments.");
    }
  }

  function appendChatBubble(sender, text) {
    const bubble = document.createElement("div");
    bubble.className = `chat-bubble ${sender}`;
    bubble.textContent = text;
    el.drawerChatStream.appendChild(bubble);
    el.drawerChatStream.scrollTop = el.drawerChatStream.scrollHeight;
  }

  // Run on DOM Ready
  window.addEventListener("DOMContentLoaded", init);
})();

