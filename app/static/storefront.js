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
    recentInteractions: JSON.parse(sessionStorage.getItem("vx_recent_interactions") || "[]"), // [{ product_id, dwell_time_seconds }]
    activeCategory: "",
    searchQuery: "",
    searchResultsAll: [],
    searchFilterCategory: "",
    searchSort: "relevance",
    currentQuickViewProduct: null,
    dwellStartTimestamp: 0,
    visualObjectUrl: null,
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
    globalSearchInput: document.getElementById("globalSearchInput") || document.getElementById("storeSearchInput"),
    storeSearchInput: document.getElementById("globalSearchInput") || document.getElementById("storeSearchInput"),
    btnSearchSubmit: document.getElementById("btnSearchSubmit"),
    categorySelectDropdown: document.getElementById("categorySelectDropdown"),
    searchSuggestDropdown: document.getElementById("searchSuggestDropdown"),
    searchSuggestList: document.getElementById("searchSuggestList"),
    searchSuggestSeeAll: document.getElementById("searchSuggestSeeAll"),
    suggestSeeAllText: document.getElementById("suggestSeeAllText"),
    searchResultsSort: document.getElementById("searchResultsSort"),
    searchFilterPillsRow: document.getElementById("searchFilterPillsRow"),
    vxBrandLogo: document.getElementById("vxBrandLogo") || document.querySelector(".vx-logo-cluster"),
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
    visualFileInput: document.getElementById("visualFileInput"),
    cameraFileInput: document.getElementById("cameraFileInput"),
    galleryFileInput: document.getElementById("galleryFileInput"),
    btnUseCamera: document.getElementById("btnUseCamera"),
    btnUploadGallery: document.getElementById("btnUploadGallery"),
    visualSelectedPreviewBox: document.getElementById("visualSelectedPreviewBox"),
    visualSelectedThumb: document.getElementById("visualSelectedThumb"),
    visualSelectedFileName: document.getElementById("visualSelectedFileName"),
    visualSelectedFileSize: document.getElementById("visualSelectedFileSize"),
    btnRemoveSelectedImage: document.getElementById("btnRemoveSelectedImage"),
    executeVisualSearchBtn: document.getElementById("executeVisualSearchBtn"),
    btnTriggerBrowsePhoto: document.getElementById("btnTriggerBrowsePhoto"),
    visualUploadSection: document.getElementById("visualUploadSection"),
    visualInspectionBox: document.getElementById("visualInspectionBox"),
    visualPreviewImg: document.getElementById("visualPreviewImg"),
    visualLabelNotice: document.getElementById("visualLabelNotice"),
    visualStatusNotice: document.getElementById("visualStatusNotice"),
    visualConfidencePill: document.getElementById("visualConfidencePill"),
    visualGeminiTags: document.getElementById("visualGeminiTags"),
    visualAttributesPills: document.getElementById("visualAttributesPills"),
    btnScanAnotherPhoto: document.getElementById("btnScanAnotherPhoto"),
    visualMatchesContainer: document.getElementById("visualMatchesContainer"),
    visualMatchesGrid: document.getElementById("visualMatchesGrid"),
    visualMatchesHeading: document.getElementById("visualMatchesHeading"),
    visualEmptyNotice: document.getElementById("visualEmptyNotice"),

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

  const FALLBACK_THUMB = "https://images.unsplash.com/photo-1523293182086-7651a899d37f?auto=format&fit=crop&w=600&q=80";

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
  // REFRESH DOM ELEMENTS (DEFENSIVE EXISTENCE CHECK)
  // ============================================================================

  function refreshElements() {
    el.shelfSearchResults = document.getElementById("shelfSearchResults");
    el.searchResultsTitle = document.getElementById("searchResultsTitle");
    el.btnClearSearch = document.getElementById("btnClearSearch");
    el.storeCatalogGrid = document.getElementById("storeCatalogGrid");
    el.catalogCountNote = document.getElementById("catalogCountNote");
    el.shelfRecommended = document.getElementById("shelf-recommended");
    el.recommendedGrid = document.getElementById("recommendedGrid");
    el.recsFreshIndicator = document.getElementById("recsFreshIndicator");
    el.shelfTech = document.getElementById("shelf-tech");
    el.gridTech = document.getElementById("gridTech");
    el.shelfJewellery = document.getElementById("shelf-jewellery");
    el.gridJewellery = document.getElementById("gridJewellery");
    el.shelfHome = document.getElementById("shelf-home");
    el.gridHome = document.getElementById("gridHome");
    el.shelfCare = document.getElementById("shelf-care");
    el.gridCare = document.getElementById("gridCare");
    el.globalSearchInput = document.getElementById("globalSearchInput") || document.getElementById("storeSearchInput");
    el.storeSearchInput = document.getElementById("globalSearchInput") || document.getElementById("storeSearchInput");
    el.btnSearchSubmit = document.getElementById("btnSearchSubmit");
    el.categorySelectDropdown = document.getElementById("categorySelectDropdown");
    el.searchSuggestDropdown = document.getElementById("searchSuggestDropdown");
    el.searchSuggestList = document.getElementById("searchSuggestList");
    el.searchSuggestSeeAll = document.getElementById("searchSuggestSeeAll");
    el.suggestSeeAllText = document.getElementById("suggestSeeAllText");
    el.searchResultsSort = document.getElementById("searchResultsSort");
    el.searchFilterPillsRow = document.getElementById("searchFilterPillsRow");
    el.vxBrandLogo = document.getElementById("vxBrandLogo") || document.querySelector(".vx-logo-cluster");
    el.btnSearchPhotoTrigger = document.getElementById("btnSearchPhotoTrigger");
    el.btnTriggerHeroVisualSearch = document.getElementById("btnTriggerHeroVisualSearch");
    el.btnExploreCollection = document.getElementById("btnExploreCollection");
    el.heroCarousel = document.getElementById("heroCarousel");
    el.carouselTrack = document.getElementById("carouselTrack");
    el.btnCarouselPrev = document.getElementById("btnCarouselPrev");
    el.btnCarouselNext = document.getElementById("btnCarouselNext");
    el.carouselDots = document.querySelectorAll(".hero-dot, .vx-carousel-dot");
    el.cartDrawer = document.getElementById("cartDrawer");
    el.btnCartTrigger = document.getElementById("btnCartTrigger");
    el.btnCloseCartDrawer = document.getElementById("btnCloseCartDrawer");
    el.cartItemsStream = document.getElementById("cartItemsStream");
    el.cartSubtotalVal = document.getElementById("cartSubtotalVal");
    el.cartCountBadge = document.getElementById("cartCountBadge");
    el.btnCheckoutCart = document.getElementById("btnCheckoutCart");
    el.quickViewModal = document.getElementById("quickViewModal");
    el.btnCloseQuickView = document.getElementById("btnCloseQuickView");
    el.btnDismissModal = document.getElementById("btnDismissModal");
    el.modalImg = document.getElementById("modalImg");
    el.modalBrand = document.getElementById("modalBrand");
    el.modalTitle = document.getElementById("modalTitle");
    el.modalPrice = document.getElementById("modalPrice");
    el.modalMrp = document.getElementById("modalMrp");
    el.modalDiscount = document.getElementById("modalDiscount");
    el.modalDesc = document.getElementById("modalDesc");
    el.btnAddToCartModal = document.getElementById("btnAddToCartModal");
    el.visualSearchModal = document.getElementById("visualSearchModal");
    el.btnCloseVisualModal = document.getElementById("btnCloseVisualModal");
    el.storefrontDropzone = document.getElementById("storefrontDropzone");
    el.storefrontFileInput = document.getElementById("storefrontFileInput");
    el.visualFileInput = document.getElementById("visualFileInput");
    el.cameraFileInput = document.getElementById("cameraFileInput");
    el.galleryFileInput = document.getElementById("galleryFileInput");
    el.btnUseCamera = document.getElementById("btnUseCamera");
    el.btnUploadGallery = document.getElementById("btnUploadGallery");
    el.visualSelectedPreviewBox = document.getElementById("visualSelectedPreviewBox");
    el.visualSelectedThumb = document.getElementById("visualSelectedThumb");
    el.visualSelectedFileName = document.getElementById("visualSelectedFileName");
    el.visualSelectedFileSize = document.getElementById("visualSelectedFileSize");
    el.btnRemoveSelectedImage = document.getElementById("btnRemoveSelectedImage");
    el.executeVisualSearchBtn = document.getElementById("executeVisualSearchBtn");
    el.btnTriggerBrowsePhoto = document.getElementById("btnTriggerBrowsePhoto");
    el.visualUploadSection = document.getElementById("visualUploadSection");
    el.visualInspectionBox = document.getElementById("visualInspectionBox");
    el.visualPreviewImg = document.getElementById("visualPreviewImg");
    el.visualLabelNotice = document.getElementById("visualLabelNotice");
    el.visualStatusNotice = document.getElementById("visualStatusNotice");
    el.visualConfidencePill = document.getElementById("visualConfidencePill");
    el.visualGeminiTags = document.getElementById("visualGeminiTags");
    el.visualAttributesPills = document.getElementById("visualAttributesPills");
    el.btnScanAnotherPhoto = document.getElementById("btnScanAnotherPhoto");
    el.visualMatchesContainer = document.getElementById("visualMatchesContainer");
    el.visualMatchesGrid = document.getElementById("visualMatchesGrid");
    el.visualMatchesHeading = document.getElementById("visualMatchesHeading");
    el.visualEmptyNotice = document.getElementById("visualEmptyNotice");
    el.supportDrawer = document.getElementById("supportDrawer");
    el.btnOpenSupportDrawer = document.getElementById("btnOpenSupportDrawer");
    el.btnCloseSupportDrawer = document.getElementById("btnCloseSupportDrawer");
    el.drawerChatStream = document.getElementById("drawerChatStream");
    el.drawerChatForm = document.getElementById("drawerChatForm");
    el.drawerChatInput = document.getElementById("drawerChatInput");
    el.chipTrackOrder = document.getElementById("chipTrackOrder");
    el.chipRefundPrompt = document.getElementById("chipRefundPrompt");
    el.chipCheckStock = document.getElementById("chipCheckStock");
    el.navOrdersBtn = document.getElementById("navOrdersBtn");
    el.footerTrackOrders = document.getElementById("footerTrackOrders");
    el.footerReturnsHelp = document.getElementById("footerReturnsHelp");
    el.footerCustomerCare = document.getElementById("footerCustomerCare");
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  function init() {
    refreshElements();
    bindEvents();
    initCarousel();
    fetchCatalog();
    fetchInitialRecommendations();

    // GSAP 3 Motion Choreography
    if (window.gsap) {
      gsap.from(".vx-command-dock", {
        y: -18,
        opacity: 0,
        duration: 0.65,
        ease: "power3.out",
      });
      gsap.from(".bento-cell", {
        y: 28,
        opacity: 0,
        duration: 0.8,
        stagger: 0.12,
        ease: "power3.out",
      });
      gsap.from(".category-nav-bar-wrapper", {
        y: 14,
        opacity: 0,
        duration: 0.6,
        delay: 0.25,
        ease: "power2.out",
      });
    }

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
  // SEARCH ENGINE UX & REAL-TIME AUTO-SUGGEST
  // ============================================================================

  let suggestDebounceTimer = null;
  let currentSuggestions = [];
  let selectedSuggestIndex = -1;

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function highlightMatch(title, query) {
    if (!title) return "";
    if (!query) return escapeHtml(title);
    const tokens = query
      .trim()
      .split(/\s+/)
      .filter((t) => t.length > 0);
    if (!tokens.length) return escapeHtml(title);

    try {
      const pattern = `(${tokens.map(escapeRegExp).join("|")})`;
      const regex = new RegExp(pattern, "gi");
      const parts = title.split(regex);
      return parts
        .map((part) => {
          if (tokens.some((tok) => tok.toLowerCase() === part.toLowerCase())) {
            return `<strong style="font-weight: 700; color: #0F172A;">${escapeHtml(part)}</strong>`;
          }
          return escapeHtml(part);
        })
        .join("");
    } catch (e) {
      return escapeHtml(title);
    }
  }

  function closeSuggestDropdown() {
    if (el.searchSuggestDropdown) {
      el.searchSuggestDropdown.style.display = "none";
    }
    selectedSuggestIndex = -1;
    currentSuggestions = [];
  }

  function updateSuggestHighlight() {
    if (!el.searchSuggestDropdown) return;
    const items = el.searchSuggestDropdown.querySelectorAll(".suggest-item, .suggest-footer-row");
    items.forEach((item, idx) => {
      if (idx === selectedSuggestIndex) {
        item.classList.add("selected");
        item.style.backgroundColor = "#F1F5F9";
      } else {
        item.classList.remove("selected");
        item.style.backgroundColor = "";
      }
    });
  }

  function renderSuggestDropdown(query, items) {
    if (!el.searchSuggestDropdown || !el.searchSuggestList) return;

    if (!items || items.length === 0) {
      closeSuggestDropdown();
      return;
    }

    selectedSuggestIndex = -1;
    el.searchSuggestList.innerHTML = items
      .map((it, idx) => {
        const thumb = it.image_url || FALLBACK_THUMB;
        const brand = (it.brand || it.category || "VORTEX").toUpperCase();
        const priceInr = it.price_inr
          ? Math.round(it.price_inr)
          : Math.round(Number(it.price) * 83);
        const highlightedTitle = highlightMatch(it.title, query);

        return `
        <div class="suggest-item" data-index="${idx}" data-id="${it.id}">
          <div class="suggest-thumb-box" style="width: 36px; height: 36px; border-radius: 6px; background-color: #F8FAFC; border: 1px solid #E2E8F0; display: flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden; padding: 2px;">
            <img src="${thumb || '/static/images/placeholder.png'}" alt="${escapeHtml(it.title)}" style="max-width: 100%; max-height: 100%; object-fit: contain;" onerror="this.onerror=null; this.src='${FALLBACK_THUMB}';">
          </div>
          <div class="suggest-info-col" style="flex: 1; min-width: 0; display: flex; flex-direction: column;">
            <div class="suggest-title" style="font-size: 13px; font-weight: 500; color: #0F172A; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.3;">
              ${highlightedTitle}
            </div>
            <div class="suggest-meta-row" style="display: flex; align-items: center; gap: 8px; margin-top: 2px;">
              <span class="suggest-brand-badge" style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #475569; background: #F1F5F9; border: 1px solid #E2E8F0; border-radius: 4px; padding: 1px 5px; letter-spacing: 0.04em;">${escapeHtml(brand)}</span>
              <span class="suggest-price" style="font-size: 12.5px; font-weight: 700; color: #0F172A;">₹${priceInr.toLocaleString('en-IN')}</span>
            </div>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="2" style="margin-left: auto; flex-shrink: 0;"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </div>
      `;
      })
      .join("");

    if (el.suggestSeeAllText) {
      el.suggestSeeAllText.innerHTML = `See all results for &lsquo;<strong>${escapeHtml(query)}</strong>&rsquo; &rarr;`;
    }

    el.searchSuggestDropdown.style.display = "block";

    // Bind click events on suggestions
    el.searchSuggestList.querySelectorAll(".suggest-item").forEach((row) => {
      row.addEventListener("click", () => {
        const id = row.getAttribute("data-id");
        if (id) {
          const parsed = parseInt(id, 10);
          const safeId = (parsed && !isNaN(parsed) && parsed > 0) ? parsed : 1;
          recordCardClickDwell(safeId);
          closeSuggestDropdown();
          window.location.href = `/product/${safeId}`;
        }
      });
    });

    if (el.searchSuggestSeeAll) {
      el.searchSuggestSeeAll.onclick = () => {
        closeSuggestDropdown();
        executeSearch(query);
      };
    }
  }

  async function fetchAndRenderSuggestions(query) {
    const category = el.categorySelectDropdown ? el.categorySelectDropdown.value : "";
    const params = new URLSearchParams({
      q: query,
      limit: "5",
    });
    if (category) {
      params.append("category", category);
    }

    try {
      const res = await fetch(`/api/v1/search?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const items = await res.json();
      currentSuggestions = items.slice(0, 5);
      renderSuggestDropdown(query, currentSuggestions);
    } catch (err) {
      console.error("Auto-suggest fetch error:", err);
      closeSuggestDropdown();
    }
  }

  function setViewMode(mode) {
    const isSearch = mode === "search";
    const bentoHero = document.querySelector(".vx-bento-hero");
    const heroCarousel = document.querySelector(".vx-hero");
    const bentoSection = document.querySelector(".vx-bento-section");
    const categoryNav = document.querySelector(".category-nav-bar-wrapper");
    const homeShelves = [
      el.shelfRecommended,
      el.shelfTech,
      el.shelfJewellery,
      el.shelfHome,
      el.shelfCare,
    ].filter(Boolean);

    if (isSearch) {
      if (bentoHero) bentoHero.style.display = "none";
      if (heroCarousel) heroCarousel.style.display = "none";
      if (bentoSection) bentoSection.style.display = "none";
      if (categoryNav) categoryNav.style.display = "none";
      homeShelves.forEach((shelf) => {
        shelf.style.display = "none";
      });
      if (el.shelfSearchResults) {
        el.shelfSearchResults.style.display = "block";
      }
    } else {
      if (bentoHero) bentoHero.style.display = "";
      if (heroCarousel) heroCarousel.style.display = "";
      if (bentoSection) bentoSection.style.display = "";
      if (categoryNav) categoryNav.style.display = "";
      homeShelves.forEach((shelf) => {
        shelf.style.display = "";
      });
      if (el.shelfSearchResults) {
        el.shelfSearchResults.style.display = "none";
      }
    }
  }

  async function executeSearch(query, category = null) {
    closeSuggestDropdown();
    const cleanQuery = (query || "").trim();
    if (!cleanQuery) {
      clearSearch();
      return;
    }

    state.searchQuery = cleanQuery;
    const cat = category !== null 
      ? category 
      : (el.categorySelectDropdown ? el.categorySelectDropdown.value : "");
    state.activeCategory = cat;
    state.searchFilterCategory = "";

    // Sync input value
    const input = el.globalSearchInput || el.storeSearchInput;
    if (input) input.value = cleanQuery;

    // Reset filter pills to All
    if (el.searchFilterPillsRow) {
      el.searchFilterPillsRow.querySelectorAll(".search-cat-pill").forEach((p) => {
        if (!p.getAttribute("data-cat")) p.classList.add("active");
        else p.classList.remove("active");
      });
    }

    // Switch view mode to search results
    setViewMode("search");

    // Loading skeleton in grid
    if (el.storeCatalogGrid) {
      el.storeCatalogGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 48px 20px; color: var(--vx-text-muted);">
          <div style="display: inline-block; width: 32px; height: 32px; border: 3px solid #CBD5E1; border-top-color: #0F172A; border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 12px;"></div>
          <div style="font-size: 14px; font-weight: 600; color: #0F172A;">Searching inventory for &ldquo;${escapeHtml(cleanQuery)}&rdquo;...</div>
        </div>
      `;
    }

    try {
      const params = new URLSearchParams({
        q: cleanQuery,
        limit: "100",
      });
      if (cat) {
        params.append("category", cat);
      }
      const res = await fetch(`/api/v1/search?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const items = await res.json();
      state.searchResultsAll = items;
      renderSearchResultsView();
      smoothScrollTo("#shelfSearchResults");
    } catch (err) {
      console.error("Search execution error:", err);
      if (el.storeCatalogGrid) {
        el.storeCatalogGrid.innerHTML = `
          <div style="grid-column: 1 / -1; padding: 48px; text-align: center; color: var(--vx-text-muted);">
            Unable to retrieve search results right now. Please try again.
          </div>`;
      }
    }
  }

  function renderSearchResultsView() {
    if (!el.shelfSearchResults) return;
    el.shelfSearchResults.style.display = "block";

    let filtered = [...state.searchResultsAll];

    // Filter by active pill category if selected
    if (state.searchFilterCategory) {
      const cat = state.searchFilterCategory.toLowerCase();
      filtered = filtered.filter((it) => {
        const itCat = (it.category || "").toLowerCase();
        if (cat === "electronics") {
          return ['electronics', 'laptops', 'smartphones', 'tablets', 'mobile-accessories'].includes(itCat);
        } else if (cat === "audio") {
          return ['audio', 'mobile-accessories'].includes(itCat);
        } else if (cat === "wearables") {
          return ['wearables', 'mens-watches', 'womens-watches'].includes(itCat);
        } else if (cat === "sports" || cat === "sports-accessories") {
          return ['sports-accessories', 'sports', 'fitness'].includes(itCat);
        } else if (cat === "furniture") {
          return ['furniture', 'home-decoration', 'kitchen-accessories'].includes(itCat);
        } else if (cat === "beauty") {
          return ['beauty', 'skin-care'].includes(itCat);
        }
        return itCat.includes(cat) || cat.includes(itCat);
      });
    }

    // Sort matching results
    const sortVal = el.searchResultsSort ? el.searchResultsSort.value : "relevance";
    if (sortVal === "price_low") {
      filtered.sort((a, b) => (Number(a.price_inr) || Number(a.price) * 83) - (Number(b.price_inr) || Number(b.price) * 83));
    } else if (sortVal === "price_high") {
      filtered.sort((a, b) => (Number(b.price_inr) || Number(b.price) * 83) - (Number(a.price_inr) || Number(a.price) * 83));
    } else if (sortVal === "rating") {
      filtered.sort((a, b) => (Number(b.rating) || 4.5) - (Number(a.rating) || 4.5));
    } else {
      // Relevance
      filtered.sort((a, b) => (Number(b.relevance_score) || 0) - (Number(a.relevance_score) || 0));
    }

    // Update Result Header
    if (el.searchResultsTitle) {
      el.searchResultsTitle.innerHTML = `Results for &ldquo;<span style="color: #2563EB;">${escapeHtml(state.searchQuery)}</span>&rdquo; <span style="font-size: 14px; font-weight: normal; color: #64748B;">(${filtered.length} items found)</span>`;
    }
    if (el.catalogCountNote) {
      el.catalogCountNote.textContent = `Showing ${filtered.length} matching products across inventory`;
    }

    // If 0 items match
    if (!filtered || filtered.length === 0) {
      el.storeCatalogGrid.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 56px 20px; text-align: center; background: #FFFFFF; border-radius: 16px; border: 1px solid #E2E8F0; box-shadow: 0 1px 3px rgba(0,0,0,0.05); margin: 8px 0;">
          <div style="width: 56px; height: 56px; border-radius: 50%; background: #F8FAFC; border: 1px solid #E2E8F0; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px auto; color: #64748B;">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m21 21-4.34-4.34"/>
              <circle cx="11" cy="11" r="8"/>
              <line x1="8" y1="8" x2="14" y2="14"/>
              <line x1="14" y1="8" x2="8" y2="14"/>
            </svg>
          </div>
          <h3 style="font-size: 16px; font-weight: 700; color: #0F172A; margin-bottom: 8px;">No results found</h3>
          <p style="font-size: 13.5px; color: #64748B; max-width: 480px; margin: 0 auto 20px auto; line-height: 1.5;">
            We couldn't find any items matching &lsquo;<strong>${escapeHtml(state.searchQuery)}</strong>&rsquo;. Try checking for typos or searching for a broader term like &lsquo;headphones&rsquo;, &lsquo;laptop&rsquo;, or &lsquo;watch&rsquo;.
          </p>
          <button type="button" class="btn-clear-search-fallback" style="padding: 8px 16px; background: #0F172A; color: #FFFFFF; font-size: 12.5px; font-weight: 600; border-radius: 8px; cursor: pointer; border: none;">
            Clear Search &times;
          </button>
        </div>
      `;
      const fallbackBtn = el.storeCatalogGrid.querySelector(".btn-clear-search-fallback");
      if (fallbackBtn) fallbackBtn.addEventListener("click", clearSearch);
      return;
    }

    // Render in standard 4-column product grid with clean dual-tone card layout
    el.storeCatalogGrid.innerHTML = filtered
      .map((it, idx) => renderProductCard(it, idx))
      .join("");

    bindCardInteractions(el.storeCatalogGrid);
  }

  function clearSearch() {
    state.searchQuery = "";
    state.activeCategory = "";
    state.searchFilterCategory = "";
    state.searchResultsAll = [];

    const input = el.globalSearchInput || el.storeSearchInput;
    if (input) input.value = "";
    if (el.categorySelectDropdown) el.categorySelectDropdown.value = "";
    updateCategoryStripActive("");

    closeSuggestDropdown();
    setViewMode("home");
    fetchCatalog();
    smoothScrollTo("#shelf-recommended");
  }

  // ============================================================================
  // EVENT BINDINGS
  // ============================================================================

  function bindEvents() {
    const searchInput = el.globalSearchInput || el.storeSearchInput;

    // Search input & Debounced Auto-Suggest
    if (searchInput) {
      searchInput.addEventListener("input", () => {
        clearTimeout(suggestDebounceTimer);
        const query = searchInput.value.trim();
        if (query.length < 2) {
          closeSuggestDropdown();
          return;
        }
        suggestDebounceTimer = setTimeout(() => {
          fetchAndRenderSuggestions(query);
        }, 200);
      });

      // Keyboard navigation (ArrowDown, ArrowUp, Enter, Escape)
      searchInput.addEventListener("keydown", (e) => {
        const isDropdownOpen = el.searchSuggestDropdown && el.searchSuggestDropdown.style.display !== "none";

        if (e.key === "ArrowDown") {
          if (isDropdownOpen && currentSuggestions.length > 0) {
            e.preventDefault();
            const totalNav = currentSuggestions.length + 1; // items + footer
            selectedSuggestIndex = (selectedSuggestIndex + 1) % totalNav;
            updateSuggestHighlight();
          }
        } else if (e.key === "ArrowUp") {
          if (isDropdownOpen && currentSuggestions.length > 0) {
            e.preventDefault();
            const totalNav = currentSuggestions.length + 1;
            selectedSuggestIndex = (selectedSuggestIndex - 1 + totalNav) % totalNav;
            updateSuggestHighlight();
          }
        } else if (e.key === "Enter") {
          if (isDropdownOpen && selectedSuggestIndex >= 0) {
            e.preventDefault();
            if (selectedSuggestIndex < currentSuggestions.length) {
              const selectedItem = currentSuggestions[selectedSuggestIndex];
              const parsed = parseInt(selectedItem && selectedItem.id, 10);
              const safeId = (parsed && !isNaN(parsed) && parsed > 0) ? parsed : 1;
              closeSuggestDropdown();
              recordCardClickDwell(safeId);
              window.location.href = `/product/${safeId}`;
              return;
            } else if (selectedSuggestIndex === currentSuggestions.length) {
              closeSuggestDropdown();
              executeSearch(searchInput.value.trim());
              return;
            }
          }
          closeSuggestDropdown();
          executeSearch(searchInput.value.trim());
        } else if (e.key === "Escape") {
          closeSuggestDropdown();
        }
      });

      // Focus back re-triggers suggestions if >= 2 chars
      searchInput.addEventListener("focus", () => {
        const query = searchInput.value.trim();
        if (query.length >= 2) {
          fetchAndRenderSuggestions(query);
        }
      });
    }

    // Submit button click
    if (el.btnSearchSubmit) {
      el.btnSearchSubmit.addEventListener("click", () => {
        const query = searchInput ? searchInput.value.trim() : "";
        executeSearch(query);
      });
    }

    // Dismiss suggestion dropdown when clicking outside
    document.addEventListener("click", (e) => {
      const searchBar = document.querySelector(".vx-search-bar");
      if (searchBar && !searchBar.contains(e.target)) {
        closeSuggestDropdown();
      }
    });

    // Clear Search Button
    if (el.btnClearSearch) {
      el.btnClearSearch.addEventListener("click", clearSearch);
    }

    // Brand Logo: resets view back to standard curated shelves
    const brandLogo = document.getElementById("vxBrandLogo") || document.querySelector(".vx-logo-cluster");
    if (brandLogo) {
      brandLogo.addEventListener("click", (e) => {
        e.preventDefault();
        clearSearch();
        window.history.pushState({}, "", "/");
      });
    }

    // Category dropdown on the left of search bar
    if (el.categorySelectDropdown) {
      el.categorySelectDropdown.addEventListener("change", (e) => {
        state.activeCategory = e.target.value;
        updateCategoryStripActive(state.activeCategory);
        const query = searchInput ? searchInput.value.trim() : "";
        if (query) {
          executeSearch(query, state.activeCategory);
        } else if (state.activeCategory) {
          fetchCatalog();
          smoothScrollTo("#shelfSearchResults");
        } else {
          setViewMode("home");
          fetchCatalog();
          smoothScrollTo("#shelf-recommended");
        }
      });
    }

    // Category Filter Pills inside Search Results View
    if (el.searchFilterPillsRow) {
      el.searchFilterPillsRow.querySelectorAll(".search-cat-pill").forEach((pill) => {
        pill.addEventListener("click", () => {
          el.searchFilterPillsRow.querySelectorAll(".search-cat-pill").forEach((p) => p.classList.remove("active"));
          pill.classList.add("active");
          state.searchFilterCategory = pill.getAttribute("data-cat") || "";
          renderSearchResultsView();
        });
      });
    }

    // Sort Dropdown in Search Results View
    if (el.searchResultsSort) {
      el.searchResultsSort.addEventListener("change", () => {
        renderSearchResultsView();
      });
    }

    // Category strip pills (Synchronizes Hero Carousel & Primary Product Grid)
    document.querySelectorAll(".vx-cat-pill").forEach((pill) => {
      pill.addEventListener("click", (e) => {
        e.preventDefault();
        const cat = pill.getAttribute("data-cat") || "";
        selectCategoryTab(cat);
      });
    });

    // Bento Card quick jump to synchronized category view
    document.querySelectorAll(".bento-filter-trigger").forEach((card) => {
      card.addEventListener("click", (e) => {
        e.preventDefault();
        const cat = card.getAttribute("data-cat") || "";
        selectCategoryTab(cat);
      });
    });

    // Sector Shelf Action Buttons ("Explore Tech →", "Shop Home →", etc.) -> Synchronized Filter View
    document.querySelectorAll(".btn-shelf-explore").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const cat = btn.getAttribute("data-cat") || "";
        selectCategoryTab(cat);
      });
    });

    // Footer category links -> Synchronized Filter View
    document.querySelectorAll(".footer-cat-link").forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const cat = link.getAttribute("data-cat") || "";
        selectCategoryTab(cat);
      });
    });

    // Cart Drawer Toggle
    if (el.btnCartTrigger && el.cartDrawer) {
      el.btnCartTrigger.addEventListener("click", () => el.cartDrawer.classList.add("open"));
    }
    if (el.btnCloseCartDrawer && el.cartDrawer) {
      el.btnCloseCartDrawer.addEventListener("click", () => el.cartDrawer.classList.remove("open"));
    }

    if (el.btnCheckoutCart) {
      el.btnCheckoutCart.addEventListener("click", () => {
        if (state.cartItems.length === 0) {
          alert("Your cart is empty. Please add items before proceeding.");
          return;
        }
        alert("Proceeding to Secure Checkout. Thank you!");
      });
    }

    // Quick View Modal
    if (el.btnCloseQuickView) el.btnCloseQuickView.addEventListener("click", closeQuickViewAndTrackDwell);
    if (el.btnDismissModal) el.btnDismissModal.addEventListener("click", closeQuickViewAndTrackDwell);
    if (el.quickViewModal) {
      el.quickViewModal.addEventListener("click", (e) => {
        if (e.target === el.quickViewModal) closeQuickViewAndTrackDwell();
      });
    }

    if (el.btnAddToCartModal) {
      el.btnAddToCartModal.addEventListener("click", () => {
        if (state.currentQuickViewProduct) {
          addToCart(state.currentQuickViewProduct);
          el.btnAddToCartModal.textContent = "Added to Cart ✓";
          setTimeout(() => {
            if (el.btnAddToCartModal) el.btnAddToCartModal.textContent = "Add to Cart";
          }, 1200);
        }
      });
    }

    // Visual Search Modal (YOLOv8)
    const openVisualModal = () => {
      if (el.visualSearchModal) el.visualSearchModal.classList.add("open");
    };
    [
      document.getElementById("visualSearchTrigger"),
      el.btnSearchPhotoTrigger,
      el.btnTriggerHeroVisualSearch,
    ].forEach((btn) => {
      if (btn) btn.addEventListener("click", openVisualModal);
    });

    // Check if redirected with ?openVisualSearch=1
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("openVisualSearch") === "1") {
      setTimeout(openVisualModal, 300);
    }
    document.querySelectorAll(".btn-trigger-specs").forEach((btn) => {
      btn.addEventListener("click", () => {
        const cat = btn.getAttribute("data-cat") || "";
        selectCategoryTab(cat);
      });
    });
    if (el.btnCloseVisualModal && el.visualSearchModal) {
      el.btnCloseVisualModal.addEventListener("click", () => el.visualSearchModal.classList.remove("open"));
    }
    if (el.visualSearchModal) {
      el.visualSearchModal.addEventListener("click", (e) => {
        if (e.target === el.visualSearchModal) el.visualSearchModal.classList.remove("open");
      });
    }

    // Visual Search (Direct Camera, Gallery & Drag-and-Drop)
    const cameraInput = el.visualFileInput || el.cameraFileInput;
    if (el.btnUseCamera && cameraInput) {
      el.btnUseCamera.addEventListener("click", () => cameraInput.click());
    }
    if (el.visualFileInput) {
      el.visualFileInput.addEventListener("change", (e) => {
        if (e.target.files && e.target.files[0]) setSelectedVisualFile(e.target.files[0]);
      });
    }
    if (el.cameraFileInput && el.cameraFileInput !== el.visualFileInput) {
      el.cameraFileInput.addEventListener("change", (e) => {
        if (e.target.files && e.target.files[0]) setSelectedVisualFile(e.target.files[0]);
      });
    }

    if (el.btnUploadGallery && el.galleryFileInput) {
      el.btnUploadGallery.addEventListener("click", () => el.galleryFileInput.click());
      el.galleryFileInput.addEventListener("change", (e) => {
        if (e.target.files && e.target.files[0]) setSelectedVisualFile(e.target.files[0]);
      });
    }

    if (el.btnTriggerBrowsePhoto) {
      el.btnTriggerBrowsePhoto.addEventListener("click", () => el.storefrontFileInput.click());
    }

    if (el.storefrontFileInput) {
      el.storefrontFileInput.addEventListener("change", (e) => {
        if (e.target.files && e.target.files[0]) setSelectedVisualFile(e.target.files[0]);
      });
    }

    if (el.btnRemoveSelectedImage) {
      el.btnRemoveSelectedImage.addEventListener("click", () => setSelectedVisualFile(null));
    }

    if (el.executeVisualSearchBtn) {
      el.executeVisualSearchBtn.addEventListener("click", executeVisualSearch);
    }

    if (el.btnScanAnotherPhoto) {
      el.btnScanAnotherPhoto.addEventListener("click", () => {
        setSelectedVisualFile(null);
        if (el.visualUploadSection) el.visualUploadSection.style.display = "block";
        if (el.visualInspectionBox) el.visualInspectionBox.style.display = "none";
      });
    }

    if (el.storefrontDropzone) {
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
          setSelectedVisualFile(e.dataTransfer.files[0]);
        }
      });
    }

    // Support Drawer
    const openSupportDrawer = () => {
      if (el.supportDrawer) el.supportDrawer.classList.add("open");
      if (el.drawerChatInput) el.drawerChatInput.focus();
    };
    if (el.btnOpenSupportDrawer) el.btnOpenSupportDrawer.addEventListener("click", openSupportDrawer);
    if (el.navOrdersBtn) el.navOrdersBtn.addEventListener("click", openSupportDrawer);
    if (el.footerCustomerCare) el.footerCustomerCare.addEventListener("click", (e) => { e.preventDefault(); openSupportDrawer(); });
    if (el.footerTrackOrders) el.footerTrackOrders.addEventListener("click", (e) => { e.preventDefault(); openSupportDrawer(); });
    if (el.footerReturnsHelp) el.footerReturnsHelp.addEventListener("click", (e) => { e.preventDefault(); openSupportDrawer(); });
    if (el.btnCloseSupportDrawer && el.supportDrawer) {
      el.btnCloseSupportDrawer.addEventListener("click", () => el.supportDrawer.classList.remove("open"));
    }

    // Support Form Submission
    if (el.drawerChatForm) {
      el.drawerChatForm.addEventListener("submit", handleSupportChatSubmit);
    }

    // Support Quick Chips
    if (el.chipTrackOrder && el.drawerChatInput && el.drawerChatForm) {
      el.chipTrackOrder.addEventListener("click", () => {
        el.drawerChatInput.value = "Where is my package #ORD-98214?";
        el.drawerChatForm.dispatchEvent(new Event("submit"));
      });
    }
    if (el.chipRefundPrompt && el.drawerChatInput) {
      el.chipRefundPrompt.addEventListener("click", () => {
        el.drawerChatInput.value = "I would like to request a refund of ₹450 for my recent order.";
        el.drawerChatInput.focus();
      });
    }
    if (el.chipCheckStock && el.drawerChatInput && el.drawerChatForm) {
      el.chipCheckStock.addEventListener("click", () => {
        el.drawerChatInput.value = "Can you check stock availability for laptops and wireless headphones?";
        el.drawerChatForm.dispatchEvent(new Event("submit"));
      });
    }

    // Global Keyboard Shortcut: ⌘K or / to focus search input
    window.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const input = el.globalSearchInput || el.storeSearchInput;
        if (input) {
          input.focus();
          input.select();
        }
      } else if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) {
        e.preventDefault();
        const input = el.globalSearchInput || el.storeSearchInput;
        if (input) {
          input.focus();
          input.select();
        }
      }
    });

    // Keyboard ESC to close any open modal/drawer
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (el.quickViewModal && el.quickViewModal.classList.contains("open")) closeQuickViewAndTrackDwell();
        if (el.visualSearchModal && el.visualSearchModal.classList.contains("open")) el.visualSearchModal.classList.remove("open");
        if (el.supportDrawer && el.supportDrawer.classList.contains("open")) el.supportDrawer.classList.remove("open");
        if (el.cartDrawer && el.cartDrawer.classList.contains("open")) el.cartDrawer.classList.remove("open");
      }
    });
  }

  function updateCategoryStripActive(category) {
    let activePill = null;
    document.querySelectorAll(".vx-cat-pill").forEach((pill) => {
      const match = (pill.getAttribute("data-cat") || "") === (category || "");
      if (match) {
        pill.classList.add("active");
        activePill = pill;
      } else {
        pill.classList.remove("active");
      }
    });

    const slidingPill = document.getElementById("categorySlidingPill");
    const track = document.getElementById("categoryNavTrack");
    if (slidingPill && track && activePill) {
      const trackRect = track.getBoundingClientRect();
      const pillRect = activePill.getBoundingClientRect();
      const leftOffset = pillRect.left - trackRect.left + track.scrollLeft;
      slidingPill.style.width = `${pillRect.width}px`;
      slidingPill.style.transform = `translateX(${leftOffset - 6}px)`;
    }
  }

  function smoothScrollTo(selector) {
    const target = document.querySelector(selector);
    if (target) {
      target.scrollIntoView({ behavior: "smooth" });
    }
  }

  // ============================================================================
  // SYNCHRONIZED CATEGORY TABS & HERO CAROUSEL ENGINE
  // ============================================================================

  const CATEGORY_TAB_CONFIG = {
    "": { title: "All Curated", slideIndex: 0 },
    "audio": { title: "Audio & Studio", slideIndex: 0 },
    "electronics": { title: "Computing", slideIndex: 1 },
    "laptops": { title: "Computing", slideIndex: 1 },
    "smartphones": { title: "Smartphones & Mobile", slideIndex: 1 },
    "wearables": { title: "Wearables", slideIndex: 0 },
    "sports": { title: "Sports & Fitness", slideIndex: 0 },
    "sports-accessories": { title: "Sports & Fitness", slideIndex: 0 },
    "gaming": { title: "Gaming & Peripherals", slideIndex: 2 },
    "gaming-peripherals": { title: "Gaming & Peripherals", slideIndex: 2 },
    "furniture": { title: "Home & Living", slideIndex: 3 },
    "home-living": { title: "Home & Living", slideIndex: 3 },
    "beauty": { title: "Daily Care", slideIndex: 3 },
    "daily-care": { title: "Daily Care", slideIndex: 3 },
    "fragrances": { title: "Fragrances", slideIndex: 3 },
    "groceries": { title: "Groceries", slideIndex: 3 },
  };

  function renderCleanCategoryEmptyState(categoryTitle) {
    if (!el.storeCatalogGrid) return;
    el.storeCatalogGrid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 64px 24px; background: #FFFFFF; border: 1px solid var(--border-subtle); border-radius: 16px; margin: 12px 0;">
        <div style="width: 56px; height: 56px; border-radius: 50%; background: #F1F5F9; color: var(--ink-secondary); display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px;">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            <line x1="8" y1="11" x2="14" y2="11"></line>
          </svg>
        </div>
        <h3 style="font-size: 18px; font-weight: 700; color: var(--ink-primary); margin-bottom: 8px;">No items currently available in ${categoryTitle}</h3>
        <p style="font-size: 13.5px; color: var(--ink-secondary); max-width: 420px; margin: 0 auto 20px; line-height: 1.5;">
          We are continuously expanding our catalog. Explore our curated collections across other categories.
        </p>
        <button type="button" class="btn-reset-category" style="background: var(--ink-primary); color: #FFFFFF; border: none; padding: 10px 22px; border-radius: 10px; font-size: 13.5px; font-weight: 600; cursor: pointer; transition: opacity 0.2s ease;">
          Browse All Curated Collections
        </button>
      </div>
    `;
    const resetBtn = el.storeCatalogGrid.querySelector(".btn-reset-category");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        selectCategoryTab("");
      });
    }
  }

  async function selectCategoryTab(categoryName) {
    const normCat = (categoryName || "").trim().toLowerCase();
    state.activeCategory = normCat;

    // 1. Synchronize category pill active state & sliding indicator
    updateCategoryStripActive(normCat);

    if (el.categorySelectDropdown) {
      el.categorySelectDropdown.value = normCat;
    }

    // 2. Synchronize hero banner carousel to matching slide
    const config = CATEGORY_TAB_CONFIG[normCat] || {
      title: normCat ? normCat.replace("-", " ").replace(/\b\w/g, (l) => l.toUpperCase()) : "All Curated",
      slideIndex: 0,
    };

    if (typeof goToSlide === "function") {
      goToSlide(config.slideIndex);
      restartAutoplay();
    }

    const homeShelves = [
      document.getElementById("shelf-recommended"),
      document.getElementById("shelf-tech"),
      document.getElementById("shelf-jewellery"),
      document.getElementById("shelf-home"),
      document.getElementById("shelf-care"),
    ];

    // 3. If "All Curated" ("") is selected: restore multi-shelves
    if (!normCat) {
      if (el.shelfSearchResults) el.shelfSearchResults.style.display = "none";
      homeShelves.forEach((shelf) => {
        if (shelf) shelf.style.display = "";
      });
      fetchCatalog();
      return;
    }

    // 4. Non-empty category selected: isolate and display dedicated product grid
    homeShelves.forEach((shelf) => {
      if (shelf) shelf.style.display = "none";
    });

    if (el.shelfSearchResults) {
      el.shelfSearchResults.style.display = "block";
    }
    if (el.searchResultsTitle) {
      el.searchResultsTitle.textContent = config.title;
    }
    if (el.catalogCountNote) {
      el.catalogCountNote.textContent = `Fetching ${config.title} products...`;
    }

    // Loading indicator
    if (el.storeCatalogGrid) {
      el.storeCatalogGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 64px 20px; color: var(--ink-secondary);">
          <div class="vx-spinner" style="margin: 0 auto 12px; width: 32px; height: 32px; border: 3px solid rgba(0,0,0,0.1); border-top-color: var(--ink-primary); border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
          <div style="font-size: 14px; font-weight: 600;">Loading ${config.title}...</div>
        </div>
      `;
    }

    try {
      const res = await fetch(`/api/v1/categories/${encodeURIComponent(normCat)}/items?limit=60`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const items = (data && data.items) ? data.items : [];

      if (!items || items.length === 0) {
        if (el.catalogCountNote) el.catalogCountNote.textContent = "0 items found";
        renderCleanCategoryEmptyState(config.title);
      } else {
        // Cache items into state.catalog so PDP and Add to Cart work reliably
        items.forEach((it) => {
          if (!state.catalog.some((p) => p.id === it.id)) {
            state.catalog.push(it);
          }
        });

        if (el.catalogCountNote) {
          el.catalogCountNote.textContent = `Showing ${items.length} products in ${config.title}`;
        }
        if (el.storeCatalogGrid) {
          el.storeCatalogGrid.innerHTML = items
            .map((item, idx) => renderProductCard(item, idx))
            .join("");
          bindCardInteractions(el.storeCatalogGrid);
        }
      }
      smoothScrollTo("#shelfSearchResults");
    } catch (err) {
      console.warn("Failed to fetch category items from API, falling back to client-side catalog:", err);
      const fallbackItems = (state.catalog || []).filter((it) => {
        const c = (it.category || "").toLowerCase();
        return c === normCat || c.includes(normCat) || normCat.includes(c);
      });

      if (!fallbackItems || fallbackItems.length === 0) {
        if (el.catalogCountNote) el.catalogCountNote.textContent = "0 items found";
        renderCleanCategoryEmptyState(config.title);
      } else {
        if (el.catalogCountNote) {
          el.catalogCountNote.textContent = `Showing ${fallbackItems.length} products in ${config.title}`;
        }
        if (el.storeCatalogGrid) {
          el.storeCatalogGrid.innerHTML = fallbackItems
            .map((item, idx) => renderProductCard(item, idx))
            .join("");
          bindCardInteractions(el.storeCatalogGrid);
        }
      }
      smoothScrollTo("#shelfSearchResults");
    }
  }

  // Expose global controller
  window.vxStore = {
    selectCategoryTab,
    clearCategoryFilter: () => selectCategoryTab(""),
  };

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
        else if (cat === "gaming" || cat === "gaming-peripherals" || cat === "fragrances") target = "#shelf-jewellery";
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
    if (!product) return;
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
    if (el.cartDrawer) el.cartDrawer.classList.add("open");
  }

  function updateCartUI() {
    const totalCount = state.cartItems.reduce((acc, it) => acc + it.quantity, 0);
    if (el.cartCountBadge) el.cartCountBadge.textContent = totalCount;

    if (state.cartItems.length === 0) {
      if (el.cartItemsStream) {
        el.cartItemsStream.innerHTML = `
          <div style="text-align: center; padding: 48px 16px; color: var(--vx-text-muted);">
            Your cart is empty.
          </div>`;
      }
      if (el.cartSubtotalVal) el.cartSubtotalVal.textContent = "₹0";
      return;
    }

    let subtotalInr = 0;
    if (el.cartItemsStream) {
      el.cartItemsStream.innerHTML = state.cartItems
        .map((item) => {
          const itemInr = Math.round(Number(item.price) * 83 * item.quantity);
          subtotalInr += itemInr;

          return `
          <div class="vx-cart-item-card">
            <img src="${item.image_url || '/static/images/placeholder.png'}" alt="${item.title}" class="vx-cart-item-thumb" onerror="this.onerror=null; this.src='${FALLBACK_THUMB}';">
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

    if (el.cartSubtotalVal) {
      el.cartSubtotalVal.textContent = `₹${subtotalInr.toLocaleString('en-IN')}`;
    }
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

    return `
    <article class="product-card vx-card-showcase bg-white rounded-2xl p-3 border border-[#E4E2DD] hover:border-[#111111] transition-all duration-300 flex flex-col justify-between relative group cursor-pointer shadow-sm hover:shadow-md" data-id="${it.id}">
      <!-- Upper Zone: Soft Warm Studio Plinth Stage (#F6F5F2) -->
      <div class="card-plinth-stage card-stage card-square-visual bg-[#F6F5F2] rounded-xl h-52 flex items-center justify-center p-6 relative overflow-hidden border border-black/5">
        <span class="card-discount-badge absolute top-2.5 left-2.5 bg-[#FF3B00] text-white font-mono text-[11px] font-bold px-2 py-0.5 rounded-md shadow-xs z-10">${discountPct}% OFF</span>
        
        <div class="card-rating-pill absolute top-2.5 right-2.5 bg-white/90 backdrop-blur text-[#111111] font-mono text-[11px] font-bold px-2 py-0.5 rounded-md border border-black/5 flex items-center gap-1 z-10">
          <span class="text-[#059669]">★</span> ${ratingScore}
        </div>

        <button type="button" class="btn-card-wishlist w-7 h-7 bg-white/80 hover:bg-white rounded-full border border-black/5 flex items-center justify-center text-zinc-400 hover:text-rose-500 shadow-xs absolute bottom-2.5 right-2.5 z-10 transition-all duration-200" aria-label="Save to Wishlist" title="Save to Wishlist" data-id="${it.id}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"></path>
          </svg>
        </button>

        <img 
          src="${it.image_url || thumb || '/static/images/placeholder.png'}" 
          alt="${it.title}" 
          loading="lazy" 
          onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1523293182086-7651a899d37f?auto=format&fit=crop&w=600&q=80';" 
          style="max-height: 140px; max-width: 85%; object-fit: contain;" 
          class="card-square-img group-hover:scale-105 transition-transform duration-300"
        />
      </div>

      <!-- Lower Zone: Crisp High-Contrast Editorial Stage -->
      <div class="card-content-wrap card-info-stage mt-3 space-y-1.5 bg-white">
        <span class="card-brand-label card-brand-overline font-mono text-[10px] uppercase tracking-widest text-[#71717A] mt-2 block">${brand}</span>
        <h3 class="card-title-text card-product-title font-semibold text-[14px] text-[#111111] line-clamp-1 mt-0.5 group-hover:text-[#FF3B00] transition-colors" title="${it.title}">${it.title}</h3>
        
        <div class="card-price-cluster card-price-row flex items-baseline gap-2 pt-1">
          <span class="text-price card-current-price card-price-curr font-mono text-base font-extrabold text-[#111111]">&#8377;${inr}</span>
          <span class="card-mrp-price card-price-orig card-price-mrp font-mono text-[11px] text-[#71717A] line-through">&#8377;${mrp}</span>
          <span class="badge-discount card-save-pill font-mono text-[11px] font-bold text-[#FF3B00]">${discountPct}% off</span>
        </div>
      </div>

      <!-- Action CTA -->
      <button type="button" class="btn-shelf-add-cart btn-add-bag btn-card-add w-full mt-3 bg-[#111111] hover:bg-[#FF3B00] text-white font-mono text-xs font-semibold py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5" data-id="${it.id}">
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

    if (window.gsap) {
      const cards = container.querySelectorAll(".vx-card-showcase");
      if (cards.length > 0) {
        gsap.fromTo(cards, 
          { y: 10 }, 
          { y: 0, duration: 0.25, stagger: 0.02, ease: "power2.out", overwrite: "auto", clearProps: "all" }
        );
      }
    }

    // 1. Direct card click navigates to PDP (/product/:id) with dwell capture
    container.querySelectorAll(".vx-card-showcase").forEach((card) => {
      card.addEventListener("click", (e) => {
        if (e.target.closest(".btn-card-wishlist") || e.target.closest(".btn-add-bag")) {
          return;
        }
        const id = card.getAttribute("data-id");
        if (id) {
          const parsed = parseInt(id, 10);
          const safeId = (parsed && !isNaN(parsed) && parsed > 0) ? parsed : 1;
          recordCardClickDwell(safeId);
          window.location.href = `/product/${safeId}`;
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
    const pid = parseInt(productId, 10);
    if (!pid || isNaN(pid)) return;
    state.recentInteractions.push({
      product_id: pid,
      dwell_time_seconds: 2.0,
    });
    sessionStorage.setItem("vx_recent_interactions", JSON.stringify(state.recentInteractions));
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

    // 2. Gaming & Pro Peripherals (Custom Keyboards, Mice & Controllers) - 4 Flagship Items
    if (el.gridJewellery) {
      const gamingItems = items.filter((p) => {
        const cat = (p.category || '').toLowerCase();
        return cat.includes('gaming') || cat.includes('peripherals') || ['gaming', 'gaming-peripherals'].includes(p.category);
      }).slice(0, 4);
      el.gridJewellery.innerHTML = gamingItems.map((p, i) => renderProductCard(p, i)).join("");
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
    if (state.searchQuery) {
      return executeSearch(state.searchQuery, state.activeCategory);
    }
    const params = new URLSearchParams({ limit: "200" });
    if (state.activeCategory) params.append("category", state.activeCategory);

    try {
      const res = await fetch(`/api/v1/catalog?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const items = await res.json();
      state.catalog = items;

      if (state.activeCategory && state.activeCategory !== "") {
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
    el.modalImg.onerror = function () {
      this.onerror = null;
      this.src = FALLBACK_THUMB;
    };
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
    sessionStorage.setItem("vx_recent_interactions", JSON.stringify(state.recentInteractions));

    // Dispatch background telemetry beacon to recalibrate vector recommendations
    dispatchDwellTelemetry();
  }

  async function dispatchDwellTelemetry() {
    try {
      if (el.recsFreshIndicator) {
        el.recsFreshIndicator.style.display = "inline-block";
        el.recsFreshIndicator.textContent = "Updating...";
      }

      const validInteractions = (state.recentInteractions || [])
        .filter((it) => it && it.product_id != null && !isNaN(parseInt(it.product_id, 10)))
        .map((it) => ({
          product_id: parseInt(it.product_id, 10),
          dwell_time_seconds: Math.max(0.0, parseFloat(it.dwell_time_seconds) || 1.0),
        }));

      const payload = {
        user_id: state.userId,
        query_text: state.searchQuery || null,
        recent_interactions: validInteractions,
        exclude_item_ids: validInteractions.map((i) => i.product_id),
        exclude_interacted: true,
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
      const validInteractions = (state.recentInteractions || [])
        .filter((it) => it && it.product_id != null && !isNaN(parseInt(it.product_id, 10)))
        .map((it) => ({
          product_id: parseInt(it.product_id, 10),
          dwell_time_seconds: Math.max(0.0, parseFloat(it.dwell_time_seconds) || 1.0),
        }));
      const hasInteractions = validInteractions.length > 0;
      const res = await fetch("/api/v1/recommend/dwell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: state.userId,
          query_text: hasInteractions ? null : "audio laptops wearables living essentials",
          recent_interactions: validInteractions,
          exclude_item_ids: validInteractions.map((i) => i.product_id),
          exclude_interacted: true,
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
  // YOLOv8 VISUAL SEARCH (Camera, Gallery & Multi-Angle YOLO)
  // ============================================================================

  let selectedVisualFile = null;

  function setSelectedVisualFile(file) {
    if (state.visualObjectUrl) {
      try {
        URL.revokeObjectURL(state.visualObjectUrl);
      } catch (e) {}
      state.visualObjectUrl = null;
    }

    if (!file) {
      selectedVisualFile = null;
      if (el.visualSelectedPreviewBox) el.visualSelectedPreviewBox.style.display = "none";
      if (el.visualSelectedThumb) el.visualSelectedThumb.src = "";
      if (el.visualPreviewImg) el.visualPreviewImg.src = "";
      if (el.visualSelectedFileName) el.visualSelectedFileName.textContent = "";
      if (el.visualFileInput) el.visualFileInput.value = "";
      if (el.cameraFileInput) el.cameraFileInput.value = "";
      if (el.galleryFileInput) el.galleryFileInput.value = "";
      if (el.storefrontFileInput) el.storefrontFileInput.value = "";
      if (el.executeVisualSearchBtn) {
        el.executeVisualSearchBtn.disabled = true;
        el.executeVisualSearchBtn.style.opacity = "0.5";
        el.executeVisualSearchBtn.style.cursor = "not-allowed";
      }
      return;
    }

    selectedVisualFile = file;

    try {
      state.visualObjectUrl = URL.createObjectURL(file);
    } catch (e) {
      state.visualObjectUrl = null;
    }

    if (state.visualObjectUrl) {
      if (el.visualSelectedThumb) el.visualSelectedThumb.src = state.visualObjectUrl;
      if (el.visualPreviewImg) el.visualPreviewImg.src = state.visualObjectUrl;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (el.visualSelectedThumb) el.visualSelectedThumb.src = e.target.result;
        if (el.visualPreviewImg) el.visualPreviewImg.src = e.target.result;
      };
      reader.readAsDataURL(file);
    }

    // Defensive fallback: ensure preview never falls back to an unrelated external placeholder
    if (el.visualPreviewImg) {
      el.visualPreviewImg.onerror = function () {
        if (state.visualObjectUrl && this.src !== state.visualObjectUrl) {
          this.src = state.visualObjectUrl;
        }
      };
    }

    if (el.visualSelectedFileName) el.visualSelectedFileName.textContent = file.name || "Captured Photo.jpg";
    if (el.visualSelectedFileSize) {
      const kb = Math.round(file.size / 1024);
      el.visualSelectedFileSize.textContent = `${kb} KB • Ready for multi-angle AI detection`;
    }
    if (el.visualUploadSection) el.visualUploadSection.style.display = "block";
    if (el.visualSelectedPreviewBox) el.visualSelectedPreviewBox.style.display = "block";
    if (el.visualInspectionBox) el.visualInspectionBox.style.display = "none";
    if (el.visualMatchesContainer) el.visualMatchesContainer.style.display = "none";
    if (el.visualEmptyNotice) el.visualEmptyNotice.style.display = "none";

    if (el.executeVisualSearchBtn) {
      el.executeVisualSearchBtn.disabled = false;
      el.executeVisualSearchBtn.style.opacity = "1";
      el.executeVisualSearchBtn.style.cursor = "pointer";
    }
  }

  function handleVisualUpload(e) {
    if (e.target.files && e.target.files[0]) {
      setSelectedVisualFile(e.target.files[0]);
    }
  }

  async function executeVisualSearch() {
    if (!selectedVisualFile) return;

    if (el.executeVisualSearchBtn) {
      el.executeVisualSearchBtn.disabled = true;
      el.executeVisualSearchBtn.innerHTML = `
        <svg class="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle><path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"></path></svg>
        <span>Analyzing with YOLOv8 + Gemini AI...</span>
      `;
    }

    if (el.visualStatusNotice) el.visualStatusNotice.textContent = "Analyzing object features with YOLOv8 & Gemini 2.5 Flash...";

    // Ensure preview image retains user's uploaded thumbnail
    if (el.visualPreviewImg && state.visualObjectUrl) {
      el.visualPreviewImg.src = state.visualObjectUrl;
    }

    const formData = new FormData();
    formData.append("file", selectedVisualFile);
    formData.append("top_k", "6");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const res = await fetch("/api/v1/search/visual", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // Switch to Amazon-style Inspection & Results View
      if (el.visualUploadSection) el.visualUploadSection.style.display = "none";
      if (el.visualInspectionBox) el.visualInspectionBox.style.display = "block";

      // PRESERVE USER UPLOADED PHOTO:
      // If server returned a valid cropped bounding box base64, display it.
      // Otherwise, retain the user's actual uploaded photo (state.visualObjectUrl).
      // NEVER fall back to a generic product placeholder (e.g. perfume).
      if (el.visualPreviewImg) {
        if (data && data.cropped_image_base64) {
          el.visualPreviewImg.src = data.cropped_image_base64;
        } else if (state.visualObjectUrl) {
          el.visualPreviewImg.src = state.visualObjectUrl;
        }
      }

      if (el.visualLabelNotice) {
        el.visualLabelNotice.textContent = data.detection_found && data.detected_label
          ? `Detected: ${data.detected_label.toUpperCase()}`
          : "Detected: Unidentified Product";
      }

      if (data && data.error) {
        if (el.visualStatusNotice) {
          el.visualStatusNotice.textContent = data.status_message || (data.error === "timeout"
            ? "Visual search timed out while analyzing image. Please try another angle or a smaller photo."
            : `Unable to process photo: ${data.error}`);
        }
        if (el.visualPreviewImg && state.visualObjectUrl) {
          el.visualPreviewImg.src = state.visualObjectUrl;
        }
      } else if (el.visualStatusNotice) {
        el.visualStatusNotice.textContent = data.gemini_description || data.status_message || "Visual analysis complete.";
      }

      if (el.visualConfidencePill) {
        const conf = data.bounding_box && data.bounding_box.confidence
          ? Math.round(data.bounding_box.confidence * 100)
          : null;
        el.visualConfidencePill.textContent = conf ? `${conf}% Match` : (data.detection_found ? "AI Verified" : "Low Confidence");
      }

      // Render Gemini Multimodal Semantic Tags (#hashtags)
      if (el.visualGeminiTags) {
        const tags = data.semantic_tags || [];
        el.visualGeminiTags.innerHTML = tags
          .map(tag => `<span style="font-size: 10.5px; font-weight: 600; background: #EEF2F6; color: #334155; padding: 2px 7px; border-radius: 6px; border: 1px solid #E2E8F0;">#${escapeHtml(tag)}</span>`)
          .join("");
      }

      // Render Gemini Extracted Attributes (color, material, style, category)
      if (el.visualAttributesPills) {
        const attrs = data.detected_attributes || {};
        const attrEntries = Object.entries(attrs).filter(([k, v]) => v && v !== "unknown");
        el.visualAttributesPills.innerHTML = attrEntries
          .map(([k, v]) => `<span style="font-size: 11px; font-weight: 500; background: #F1F5F9; color: #475569; padding: 2px 6px; border-radius: 4px; border: 1px solid #CBD5E1;"><strong style="text-transform: capitalize;">${escapeHtml(k)}:</strong> ${escapeHtml(v)}</span>`)
          .join("");
      }

      const items = (data.matches && data.matches.length > 0) ? data.matches : (data.recommendations || []);

      if (el.visualMatchesContainer) el.visualMatchesContainer.style.display = "block";

      if (items && items.length > 0 && data.detection_found && !data.error) {
        if (el.visualMatchesHeading) el.visualMatchesHeading.style.display = "block";
        if (el.visualMatchesGrid) el.visualMatchesGrid.style.display = "grid";
        if (el.visualEmptyNotice) el.visualEmptyNotice.style.display = "none";

        el.visualMatchesGrid.innerHTML = items
          .map((it) => {
            const parsed = parseInt(it && it.id, 10);
            const safeId = (parsed && !isNaN(parsed) && parsed > 0) ? parsed : 1;
            const thumb = it.image_url || FALLBACK_THUMB;
            const priceVal = it.price_inr || (it.price ? Math.round(it.price * 83) : 999);
            const brandVal = (it.brand || it.category || "VORTEX").toUpperCase();
            return `
            <div class="vx-card-showcase visual-match-card" data-id="${safeId}" style="padding: 12px; border: 1px solid #E2E8F0; border-radius: 10px; background: #FFFFFF; display: flex; flex-direction: column; justify-content: space-between; transition: all 0.2s ease;">
              <div class="visual-card-clickable" data-id="${safeId}" style="cursor: pointer;">
                <div style="height: 110px; display: flex; align-items: center; justify-content: center; margin-bottom: 8px; background: #F8FAFC; border-radius: 8px; overflow: hidden; padding: 6px;">
                  <img src="${thumb || '/static/images/placeholder.png'}" alt="${escapeHtml(it.title)}" style="max-width: 100%; max-height: 100%; object-fit: contain;" onerror="this.onerror=null; this.src='${FALLBACK_THUMB}';">
                </div>
                <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748B; letter-spacing: 0.04em; margin-bottom: 2px;">
                  ${escapeHtml(brandVal)}
                </div>
                <div style="font-size: 12px; font-weight: 600; line-height: 1.3; color: #0F172A; margin-bottom: 6px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                  ${escapeHtml(it.title)}
                </div>
                <div style="display: flex; align-items: baseline; gap: 6px;">
                  <span style="font-weight: 700; font-size: 14px; color: #0F172A;">&#8377;${formatInr(priceVal)}</span>
                </div>
              </div>
              <button type="button" class="btn-card-add btn-visual-add-cart" data-id="${safeId}" style="height: 32px; font-size: 12px; margin-top: 10px; width: 100%; justify-content: center; background: #0F172A; color: #FFFFFF; border-radius: 6px;">
                Add to Cart
              </button>
            </div>`;
          })
          .join("");

        // Bind clicking product card to trigger Quick View modal (never navigate to broken URL)
        el.visualMatchesGrid.querySelectorAll(".visual-card-clickable").forEach((cardClick) => {
          cardClick.addEventListener("click", () => {
            const id = parseInt(cardClick.getAttribute("data-id"), 10);
            const found = items.find((p) => p.id === id) || (state.catalog && state.catalog.find((p) => p.id === id));
            if (found) {
              openQuickView(found);
            }
          });
        });

        // Bind instant Add to Cart for visual match cards
        el.visualMatchesGrid.querySelectorAll(".btn-visual-add-cart").forEach((btn) => {
          btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const id = parseInt(btn.getAttribute("data-id"), 10);
            const found = items.find((p) => p.id === id) || (state.catalog && state.catalog.find((p) => p.id === id));
            if (found) {
              addToCart(found);
              btn.textContent = "Added ✓";
              btn.style.background = "#059669";
              setTimeout(() => {
                if (btn) {
                  btn.textContent = "Add to Cart";
                  btn.style.background = "#0F172A";
                }
              }, 1200);
            }
          });
        });
      } else {
        // Anti-Hallucination: No fake products!
        if (el.visualMatchesHeading) el.visualMatchesHeading.style.display = "none";
        if (el.visualMatchesGrid) el.visualMatchesGrid.style.display = "none";
        if (el.visualEmptyNotice) el.visualEmptyNotice.style.display = "block";
      }
    } catch (err) {
      clearTimeout(timeoutId);
      const isTimeout = err.name === "AbortError";
      if (el.visualStatusNotice) {
        el.visualStatusNotice.textContent = isTimeout
          ? "Visual search request timed out after 30 seconds. Please try another angle or a smaller photo."
          : "Unable to process photo: " + err.message;
      }
      if (el.visualUploadSection) el.visualUploadSection.style.display = "none";
      if (el.visualInspectionBox) el.visualInspectionBox.style.display = "block";

      // PRESERVE USER UPLOADED PHOTO: Retain user's actual photo during errors and timeouts
      if (el.visualPreviewImg && state.visualObjectUrl) {
        el.visualPreviewImg.src = state.visualObjectUrl;
      }
      if (el.visualLabelNotice) {
        el.visualLabelNotice.textContent = "Detected: Unidentified Product";
      }
      if (el.visualConfidencePill) {
        el.visualConfidencePill.textContent = "Low Confidence";
      }
      if (el.visualGeminiTags) el.visualGeminiTags.innerHTML = "";
      if (el.visualAttributesPills) el.visualAttributesPills.innerHTML = "";

      if (el.visualMatchesContainer) el.visualMatchesContainer.style.display = "block";
      if (el.visualMatchesHeading) el.visualMatchesHeading.style.display = "none";
      if (el.visualMatchesGrid) el.visualMatchesGrid.style.display = "none";
      if (el.visualEmptyNotice) el.visualEmptyNotice.style.display = "block";
    } finally {
      if (el.executeVisualSearchBtn) {
        el.executeVisualSearchBtn.disabled = false;
        el.executeVisualSearchBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <span>Find Matching Products</span>
        `;
      }
    }
  }

  // Backward compatible helper
  async function uploadPhotoForVisualMatch(file) {
    setSelectedVisualFile(file);
    await executeVisualSearch();
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

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
