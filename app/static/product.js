/**
 * VORTEX COMMERCE - Comprehensive Product Detail Page Controller
 * Standards: Emil Kowalski UI Engineering • Smooth Micro-Interactions • Dense Specs
 */

(function () {
  "use strict";

  // State
  let productData = null;
  let similarProducts = [];
  let dwellStart = performance.now();
  let cartItems = JSON.parse(localStorage.getItem("vx_cart") || "[]");

  // DOM Elements
  const el = {
    // Breadcrumbs
    catBreadcrumb: document.getElementById("pdpCatBreadcrumb"),
    titleBreadcrumb: document.getElementById("pdpTitleBreadcrumb"),

    // Showcase
    brand: document.getElementById("pdpBrand"),
    title: document.getElementById("pdpTitle"),
    img: document.getElementById("pdpImg"),
    ratingVal: document.getElementById("pdpRatingVal"),
    reviewsCount: document.getElementById("pdpReviewsCount"),
    priceCurrent: document.getElementById("pdpPriceCurrent"),
    priceMrp: document.getElementById("pdpPriceMrp"),
    priceDiscount: document.getElementById("pdpPriceDiscount"),

    // Offers & Delivery
    offersList: document.getElementById("pdpOffersList"),
    pincodeInput: document.getElementById("pdpPincodeInput"),
    btnCheckPincode: document.getElementById("btnCheckPincode"),
    deliveryDateText: document.getElementById("pdpDeliveryDateText"),

    // Actions
    btnAddToCart: document.getElementById("btnAddToCart"),
    btnBuyNow: document.getElementById("btnBuyNow"),

    // Below-the-fold
    editorialBlocks: document.getElementById("pdpEditorialBlocks"),
    specsContainer: document.getElementById("pdpSpecsContainer"),

    // Bottom Shelves (Similar Products, Same Category, and Compatible Accessories)
    similarGrid: document.getElementById("pdpSimilarGrid"),
    categoryGrid: document.getElementById("pdpCategoryGrid"),
    categoryShelf: document.getElementById("pdpCategoryShelf"),
    categoryShelfTitle: document.getElementById("pdpCategoryShelfTitle"),
    categoryShelfSubtitle: document.getElementById("pdpCategoryShelfSubtitle"),
    accessoriesGrid: document.getElementById("pdpAccessoriesGrid"),
    accessoriesShelf: document.getElementById("pdpAccessoriesShelf"),
    boughtTogetherGrid: document.getElementById("pdpBoughtTogetherGrid"),

    // Cart Drawer
    btnCartTrigger: document.getElementById("btnCartTrigger"),
    cartDrawer: document.getElementById("cartDrawer"),
    btnCloseCartDrawer: document.getElementById("btnCloseCartDrawer"),
    cartItemsStream: document.getElementById("cartItemsStream"),
    cartSubtotalVal: document.getElementById("cartSubtotalVal"),
    cartCountBadge: document.getElementById("cartCountBadge"),
  };

  // Utilities
  function formatInr(val) {
    return Math.round(Number(val)).toLocaleString("en-IN");
  }

  function getProductIdFromUrl() {
    const parts = window.location.pathname.split("/").filter(Boolean);
    const lastPart = parts[parts.length - 1];
    const parsed = parseInt(lastPart, 10);
    return isNaN(parsed) ? 1 : parsed;
  }

  // Synchronize Cart Badge
  function syncCartBadge() {
    const count = cartItems.reduce((acc, it) => acc + (it.quantity || 1), 0);
    if (el.cartCountBadge) {
      el.cartCountBadge.textContent = count;
    }
    localStorage.setItem("vx_cart", JSON.stringify(cartItems));
  }

  // ===========================================================================
  // DATA INITIALIZATION & CONCURRENT API FETCHING
  // ===========================================================================

  async function initProductPage() {
    const productId = getProductIdFromUrl();

    try {
      // Concurrently fetch single product details, similar products, same-category items, and compatible accessories
      const [prodRes, similarRes, catRes, accRes] = await Promise.all([
        fetch(`/api/v1/product/${productId}`),
        fetch(`/api/v1/recommend/similar/${productId}?limit=6`),
        fetch(`/api/v1/recommend/category/${productId}?limit=6`),
        fetch(`/api/v1/recommend/accessories/${productId}?limit=6`),
      ]);

      if (!prodRes.ok) throw new Error(`HTTP ${prodRes.status}`);

      productData = await prodRes.json();
      similarProducts = similarRes.ok ? await similarRes.json() : [];
      const sameCategoryItems = catRes.ok ? await catRes.json() : [];
      const accessoriesItems = accRes.ok ? await accRes.json() : [];

      renderProductShowcase(productData);
      renderBankOffers(productData.bank_offers || []);
      renderEditorialDescription(productData.detailed_description || []);
      renderSpecificationsTable(productData.specs_sections || {});
      renderSimilarShelf(similarProducts);
      renderCategoryShelf(sameCategoryItems, productData.category);
      renderAccessoriesShelf(accessoriesItems);

    } catch (err) {
      console.error("Failed to load product details:", err);
      if (el.title) {
        el.title.textContent = "Product Not Found";
      }
      if (el.editorialBlocks) {
        el.editorialBlocks.innerHTML = `
          <div style="padding: 24px; color: #64748B;">
            We were unable to locate this product in the catalog. <a href="/" style="color: #0F172A; font-weight: 600; text-decoration: underline;">Return to Marketplace</a>.
          </div>`;
      }
    }
  }

  // ===========================================================================
  // RENDER PRIMARY SHOWCASE
  // ===========================================================================

  function renderProductShowcase(prod) {
    document.title = `${prod.title} • VORTEX COMMERCE`;

    // Breadcrumb
    if (el.catBreadcrumb) {
      el.catBreadcrumb.textContent = (prod.category || "Catalog").toUpperCase();
      el.catBreadcrumb.href = `/?category=${encodeURIComponent(prod.category)}`;
    }
    if (el.titleBreadcrumb) {
      el.titleBreadcrumb.textContent = prod.title;
    }

    // Media & Metadata
    if (el.brand) el.brand.textContent = (prod.brand || prod.category || "VORTEX").toUpperCase();
    if (el.title) el.title.textContent = prod.title;
    if (el.img) {
      el.img.src = prod.image_url || "/static/images/placeholder.png";
      el.img.alt = prod.title;
      el.img.onerror = function () {
        this.onerror = null;
        this.src = "https://images.unsplash.com/photo-1523293182086-7651a899d37f?auto=format&fit=crop&w=600&q=80";
      };
    }

    // Rating & Reviews
    if (el.ratingVal) el.ratingVal.textContent = prod.rating ? prod.rating.toFixed(1) : "4.7";
    if (el.reviewsCount) {
      const reviewCount = prod.review_count || 12410;
      el.reviewsCount.textContent = `${reviewCount.toLocaleString("en-IN")} Ratings & ${Math.round(reviewCount * 0.08).toLocaleString("en-IN")} Reviews`;
    }

    // Pricing
    const priceInr = prod.price_inr || Math.round(prod.price * 83);
    const mrpInr = prod.mrp_inr || Math.round(priceInr * 1.35);
    const discountPct = prod.discount_pct || 25;

    if (el.priceCurrent) el.priceCurrent.innerHTML = `&#8377;${formatInr(priceInr)}`;
    if (el.priceMrp) el.priceMrp.innerHTML = `&#8377;${formatInr(mrpInr)}`;
    if (el.priceDiscount) el.priceDiscount.textContent = `${discountPct}% off`;
  }

  // ===========================================================================
  // RENDER BANK OFFERS
  // ===========================================================================

  function renderBankOffers(offers) {
    if (!el.offersList) return;
    if (!offers || offers.length === 0) {
      offers = [
        "Bank Offer: 5% Unlimited Cashback on Flipkart Axis Bank Card",
        "Bank Offer: ₹1,500 Off on HDFC Bank Credit Card EMI Transactions",
        "Bank Offer: Special Price get extra ₹3,000 off (price inclusive of discount)",
        "Partner Offer: Free 3-Month Extended Manufacturer Warranty on registration",
      ];
    }

    el.offersList.innerHTML = offers
      .map(
        (offer) => `
        <li class="pdp-offer-item">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          <span>${highlightOfferKeywords(offer)}</span>
        </li>`
      )
      .join("");
  }

  function highlightOfferKeywords(text) {
    return text
      .replace(/(Bank Offer:)/g, "<strong>$1</strong>")
      .replace(/(Partner Offer:)/g, "<strong>$1</strong>")
      .replace(/(Special Price:)/g, "<strong>$1</strong>");
  }

  // ===========================================================================
  // PINCODE DELIVERY ESTIMATOR
  // ===========================================================================

  function updateDeliveryEstimate(pincode) {
    const pin = (pincode || "629165").trim();
    if (pin.length < 6) {
      if (el.deliveryDateText) {
        el.deliveryDateText.textContent = "Please enter a valid 6-digit postal pincode";
        el.deliveryDateText.style.color = "#DC2626";
      }
      return;
    }

    // Calculate delivery date 2 days ahead
    const date = new Date();
    date.setDate(date.getDate() + 2);
    const options = { weekday: "long", day: "numeric", month: "short" };
    const dateFormatted = date.toLocaleDateString("en-IN", options);

    if (el.deliveryDateText) {
      el.deliveryDateText.textContent = `Delivery by ${dateFormatted} to ${pin} | Free Delivery`;
      el.deliveryDateText.style.color = "#047857";
    }
  }

  if (el.btnCheckPincode) {
    el.btnCheckPincode.addEventListener("click", () => {
      updateDeliveryEstimate(el.pincodeInput ? el.pincodeInput.value : "629165");
    });
  }

  if (el.pincodeInput) {
    el.pincodeInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        updateDeliveryEstimate(el.pincodeInput.value);
      }
    });
  }

  // ===========================================================================
  // RENDER EDITORIAL PRODUCT DESCRIPTION
  // ===========================================================================

  function renderEditorialDescription(paragraphs) {
    if (!el.editorialBlocks) return;

    const titles = [
      "Precision Engineering & Build Architecture",
      "Real-World High-Efficiency Performance",
      "Verified Quality Assurance & Packaging Standards",
    ];

    if (!paragraphs || paragraphs.length === 0) {
      paragraphs = [
        "Crafted with precision engineering and high-grade materials, delivering uncompromising structural integrity and refined ergonomic handling.",
        "Engineered for modern high-efficiency operations, ensuring reliable daily performance and calibrated thermal stability.",
        "Every unit undergoes rigorous factory burn-in testing and arrives fully certified with genuine manufacturer serial tracking.",
      ];
    }

    el.editorialBlocks.innerHTML = paragraphs
      .map(
        (para, i) => `
        <div class="pdp-editorial-block">
          <div class="pdp-editorial-block-title">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#047857" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            <span>${titles[i] || `Section ${i + 1}`}</span>
          </div>
          <p class="pdp-editorial-block-text">${para}</p>
        </div>`
      )
      .join("");
  }

  // ===========================================================================
  // RENDER GROUPED SPECIFICATIONS TABLE
  // ===========================================================================

  function renderSpecificationsTable(sections) {
    if (!el.specsContainer) return;

    const sectionKeys = Object.keys(sections);
    if (sectionKeys.length === 0) {
      el.specsContainer.innerHTML = '<div style="color: #64748B;">No specifications recorded.</div>';
      return;
    }

    el.specsContainer.innerHTML = sectionKeys
      .map((secName) => {
        const rows = sections[secName] || {};
        const rowKeys = Object.keys(rows);

        const tableRowsHtml = rowKeys
          .map(
            (k) => `
            <tr>
              <td class="pdp-specs-label">${k}</td>
              <td class="pdp-specs-val">${rows[k]}</td>
            </tr>`
          )
          .join("");

        return `
          <div class="pdp-specs-group">
            <div class="pdp-specs-group-title">${secName}</div>
            <table class="pdp-specs-table">
              <tbody>${tableRowsHtml}</tbody>
            </table>
          </div>`;
      })
      .join("");
  }

  // ===========================================================================
  // RENDER BOTTOM RECOMMENDATION SHELVES
  // ===========================================================================

  function renderSimilarShelf(items) {
    if (!el.similarGrid) return;

    if (!items || items.length === 0) {
      el.similarGrid.innerHTML = '<div style="grid-column: 1/-1; padding: 24px; color: #71717A;">No similar items found.</div>';
      return;
    }

    el.similarGrid.innerHTML = items
      .map((item) => {
        const priceInr = item.price_inr || Math.round(Number(item.price) * 83);
        const mrpInr = item.mrp_inr || Math.round(priceInr * 1.35);
        const rating = item.rating || 4.5;
        const reviews = item.review_count || 1240;

        return `
          <div class="pdp-rec-card bg-white rounded-2xl p-3 border border-[#E4E2DD] hover:border-[#111111] transition-all duration-300 flex flex-col justify-between relative group cursor-pointer shadow-sm hover:shadow-md" onclick="window.location.href='/product/${item.id}';">
            <div class="card-plinth-stage pdp-rec-img-box bg-[#F6F5F2] rounded-xl h-44 flex items-center justify-center p-4 relative overflow-hidden border border-black/5 mb-3">
              <span class="card-discount-badge absolute top-2 left-2 bg-[#FF3B00] text-white font-mono text-[10px] font-bold px-2 py-0.5 rounded shadow-xs z-10">${item.discount_pct || 25}% OFF</span>
              <div class="card-rating-pill absolute top-2 right-2 bg-white/90 backdrop-blur text-[#111111] font-mono text-[10px] font-bold px-2 py-0.5 rounded border border-black/5 flex items-center gap-1 z-10">
                <span class="text-[#059669]">★</span> ${rating.toFixed(1)}
              </div>
              <img 
                src="${item.image_url || '/static/images/placeholder.png'}" 
                alt="${item.title}" 
                loading="lazy"
                onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1523293182086-7651a899d37f?auto=format&fit=crop&w=600&q=80';"
                style="max-height: 125px; max-width: 85%; object-fit: contain;" 
                class="group-hover:scale-105 transition-transform duration-300"
              />
            </div>
            <div class="pdp-rec-brand font-mono text-[10px] uppercase tracking-wider text-[#71717A]">${item.brand || item.category || 'VORTEX'}</div>
            <div class="pdp-rec-title font-semibold text-xs text-[#111111] line-clamp-1 mt-0.5 group-hover:text-[#FF3B00] transition-colors" title="${item.title}">${item.title}</div>
            <div class="pdp-rec-price-row flex items-baseline gap-2 pt-1 mt-auto">
              <span class="pdp-rec-price font-mono text-sm font-extrabold text-[#111111]">&#8377;${formatInr(priceInr)}</span>
              <span class="pdp-rec-mrp font-mono text-[10px] text-[#71717A] line-through">&#8377;${formatInr(mrpInr)}</span>
              <span class="pdp-rec-discount font-mono text-[10px] font-bold text-[#FF3B00]">${item.discount_pct || 25}% off</span>
            </div>
            <div class="pdp-rec-delivery-badge font-mono text-[10px] text-[#059669] mt-1 font-medium">Free Express Delivery</div>
          </div>`;
      })
      .join("");

    if (window.gsap) {
      gsap.fromTo(el.similarGrid.querySelectorAll(".pdp-rec-card"), 
        { y: 10 }, 
        { y: 0, duration: 0.25, stagger: 0.02, ease: "power2.out", clearProps: "all" }
      );
    }
  }

  // ===========================================================================
  // RENDER PRIMARY CATEGORY SHELF ("MORE IN THIS CATEGORY")
  // ===========================================================================

  function renderCategoryShelf(items, category) {
    if (!el.categoryGrid) return;

    if (!items || items.length === 0) {
      if (el.categoryShelf) el.categoryShelf.style.display = "none";
      return;
    }

    if (el.categoryShelf) el.categoryShelf.style.display = "block";
    if (el.categoryShelfTitle && category) {
      const catTitle = category.replace("-", " ").replace(/\b\w/g, (c) => c.toUpperCase());
      el.categoryShelfTitle.textContent = `More in ${catTitle}`;
    }

    el.categoryGrid.innerHTML = items
      .map((item) => {
        const priceInr = item.price_inr || Math.round(Number(item.price) * 83);
        const mrpInr = item.mrp_inr || Math.round(priceInr * 1.35);
        const rating = item.rating || 4.5;
        const discountPct = item.discount_pct || 25;

        return `
          <div class="pdp-rec-card bg-white rounded-2xl p-3 border border-[#E4E2DD] hover:border-[#111111] transition-all duration-300 flex flex-col justify-between relative group cursor-pointer shadow-sm hover:shadow-md" onclick="window.location.href='/product/${item.id}';">
            <div class="card-plinth-stage pdp-rec-img-box bg-[#F6F5F2] rounded-xl h-44 flex items-center justify-center p-4 relative overflow-hidden border border-black/5 mb-3">
              <span class="card-discount-badge absolute top-2 left-2 bg-[#FF3B00] text-white font-mono text-[10px] font-bold px-2 py-0.5 rounded shadow-xs z-10">${discountPct}% OFF</span>
              <div class="card-rating-pill absolute top-2 right-2 bg-white/90 backdrop-blur text-[#111111] font-mono text-[10px] font-bold px-2 py-0.5 rounded border border-black/5 flex items-center gap-1 z-10">
                <span class="text-[#059669]">★</span> ${rating.toFixed(1)}
              </div>
              <img 
                src="${item.image_url || '/static/images/placeholder.png'}" 
                alt="${item.title}" 
                loading="lazy"
                onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1523293182086-7651a899d37f?auto=format&fit=crop&w=600&q=80';"
                style="max-height: 125px; max-width: 85%; object-fit: contain;" 
                class="group-hover:scale-105 transition-transform duration-300"
              />
            </div>
            <div class="pdp-rec-brand font-mono text-[10px] uppercase tracking-wider text-[#71717A]">${item.brand || item.category || 'VORTEX'}</div>
            <div class="pdp-rec-title font-semibold text-xs text-[#111111] line-clamp-1 mt-0.5 group-hover:text-[#FF3B00] transition-colors" title="${item.title}">${item.title}</div>
            <div class="pdp-rec-price-row flex items-baseline gap-2 pt-1 mt-auto">
              <span class="pdp-rec-price font-mono text-sm font-extrabold text-[#111111]">&#8377;${formatInr(priceInr)}</span>
              <span class="pdp-rec-mrp font-mono text-[10px] text-[#71717A] line-through">&#8377;${formatInr(mrpInr)}</span>
              <span class="pdp-rec-discount font-mono text-[10px] font-bold text-[#FF3B00]">${discountPct}% off</span>
            </div>
            <div class="pdp-rec-delivery-badge font-mono text-[10px] text-[#059669] mt-1 font-medium">Free Express Delivery</div>
          </div>`;
      })
      .join("");

    if (window.gsap) {
      gsap.fromTo(el.categoryGrid.querySelectorAll(".pdp-rec-card"), 
        { y: 10 }, 
        { y: 0, duration: 0.25, stagger: 0.02, ease: "power2.out", clearProps: "all" }
      );
    }
  }

  // ===========================================================================
  // RENDER COMPLEMENTARY COMPATIBLE ACCESSORIES SHELF
  // ===========================================================================

  function renderAccessoriesShelf(items) {
    if (!el.accessoriesGrid) return;

    if (!items || items.length === 0) {
      if (el.accessoriesShelf) el.accessoriesShelf.style.display = "none";
      return;
    }

    if (el.accessoriesShelf) el.accessoriesShelf.style.display = "block";

    el.accessoriesGrid.innerHTML = items
      .map((item) => {
        const priceInr = item.price_inr || Math.round(Number(item.price) * 83);
        const mrpInr = item.mrp_inr || Math.round(priceInr * 1.35);
        const discountPct = item.discount_pct || 25;

        return `
          <div class="pdp-rec-card bg-white rounded-2xl p-3 border border-[#E4E2DD] hover:border-[#111111] transition-all duration-300 flex flex-col justify-between relative group cursor-pointer shadow-sm hover:shadow-md">
            <div class="card-plinth-stage pdp-rec-img-box bg-[#F6F5F2] rounded-xl h-44 flex items-center justify-center p-4 relative overflow-hidden border border-black/5 mb-3" onclick="window.location.href='/product/${item.id}';">
              <span class="card-discount-badge absolute top-2 left-2 bg-[#FF3B00] text-white font-mono text-[10px] font-bold px-2 py-0.5 rounded shadow-xs z-10">${discountPct}% OFF</span>
              <img 
                src="${item.image_url || '/static/images/placeholder.png'}" 
                alt="${item.title}" 
                loading="lazy"
                onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1523293182086-7651a899d37f?auto=format&fit=crop&w=600&q=80';"
                style="max-height: 125px; max-width: 85%; object-fit: contain;" 
                class="group-hover:scale-105 transition-transform duration-300"
              />
            </div>
            <div class="pdp-rec-brand font-mono text-[10px] uppercase tracking-wider text-[#71717A]">${item.brand || item.category || 'ACCESSORY'}</div>
            <div class="pdp-rec-title font-semibold text-xs text-[#111111] line-clamp-1 mt-0.5 group-hover:text-[#FF3B00] transition-colors" title="${item.title}" onclick="window.location.href='/product/${item.id}';">${item.title}</div>
            <div class="pdp-rec-price-row flex items-baseline gap-2 pt-1 mt-auto">
              <span class="pdp-rec-price font-mono text-sm font-extrabold text-[#111111]">&#8377;${formatInr(priceInr)}</span>
              <span class="pdp-rec-mrp font-mono text-[10px] text-[#71717A] line-through">&#8377;${formatInr(mrpInr)}</span>
              <span class="pdp-rec-discount font-mono text-[10px] font-bold text-[#FF3B00]">${discountPct}% off</span>
            </div>
            <button type="button" class="btn-pdp-quick-add w-full mt-2.5 bg-[#111111] hover:bg-[#FF3B00] text-white font-mono text-xs font-semibold py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1.5" data-item-id="${item.id}" data-item-title="${item.title}" data-item-price="${item.price}" data-item-img="${item.image_url}">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              <span>Add to Cart</span>
            </button>
          </div>`;
      })
      .join("");

    if (window.gsap) {
      gsap.fromTo(el.accessoriesGrid.querySelectorAll(".pdp-rec-card"), 
        { y: 10 }, 
        { y: 0, duration: 0.25, stagger: 0.02, ease: "power2.out", clearProps: "all" }
      );
    }

    // Bind quick add buttons
    el.accessoriesGrid.querySelectorAll(".btn-pdp-quick-add").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = parseInt(btn.getAttribute("data-item-id"), 10);
        const title = btn.getAttribute("data-item-title");
        const price = parseFloat(btn.getAttribute("data-item-price"));
        const img = btn.getAttribute("data-item-img");

        addItemToCart({ id, title, price, image_url: img });

        btn.innerHTML = "<span>Added ✓</span>";
        btn.style.background = "#059669";
        setTimeout(() => {
          btn.innerHTML = `
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span>Add to Cart</span>`;
          btn.style.background = "#111111";
        }, 1200);
      });
    });
  }

  // Backwards compatibility helper
  async function fetchAndRenderBoughtTogether(currentId, category) {
    if (el.boughtTogetherGrid) {
      el.boughtTogetherGrid.style.display = "none";
    }
  }

  // ===========================================================================
  // CART ACTIONS & SYNCHRONIZATION
  // ===========================================================================

  function addItemToCart(item) {
    const existing = cartItems.find((i) => i.id === item.id);
    if (existing) {
      existing.quantity = (existing.quantity || 1) + 1;
    } else {
      cartItems.push({
        id: item.id,
        title: item.title,
        price: item.price,
        image_url: item.image_url,
        quantity: 1,
      });
    }
    syncCartBadge();
  }

  if (el.btnAddToCart) {
    el.btnAddToCart.addEventListener("click", () => {
      if (!productData) return;
      addItemToCart(productData);

      el.btnAddToCart.innerHTML = "<span>Added to Cart &#10003;</span>";
      el.btnAddToCart.style.background = "#047857";

      setTimeout(() => {
        el.btnAddToCart.innerHTML = `
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
          <span>Add to Cart</span>`;
        el.btnAddToCart.style.background = "#0F172A";
      }, 1400);
    });
  }

  if (el.btnBuyNow) {
    el.btnBuyNow.addEventListener("click", () => {
      if (!productData) return;
      addItemToCart(productData);
      window.location.href = "/orders";
    });
  }

  // Cart Drawer Trigger
  if (el.btnCartTrigger) {
    el.btnCartTrigger.addEventListener("click", () => {
      if (el.cartDrawer) el.cartDrawer.classList.add("open");
      renderCartDrawer();
    });
  }

  if (el.btnCloseCartDrawer) {
    el.btnCloseCartDrawer.addEventListener("click", () => {
      if (el.cartDrawer) el.cartDrawer.classList.remove("open");
    });
  }

  function renderCartDrawer() {
    if (!el.cartItemsStream || !el.cartSubtotalVal) return;

    if (cartItems.length === 0) {
      el.cartItemsStream.innerHTML = '<div style="text-align: center; padding: 48px 16px; color: #94A3B8;">Your cart is empty.</div>';
      el.cartSubtotalVal.textContent = "₹0";
      return;
    }

    let subtotal = 0;
    el.cartItemsStream.innerHTML = cartItems
      .map((it) => {
        const itemTotal = Math.round(Number(it.price) * 83 * (it.quantity || 1));
        subtotal += itemTotal;
        return `
          <div style="display: flex; gap: 12px; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #E2E8F0;">
            <img src="${it.image_url || '/static/images/placeholder.png'}" alt="${it.title}" style="width: 52px; height: 52px; object-fit: contain; border-radius: 8px; background: #F8FAFC; border: 1px solid #E2E8F0;" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1523293182086-7651a899d37f?auto=format&fit=crop&w=600&q=80';">
            <div style="flex: 1;">
              <div style="font-size: 13px; font-weight: 600; line-height: 1.3; color: #0F172A;">${it.title}</div>
              <div style="font-size: 12.5px; color: #0F172A; font-weight: 700; margin-top: 3px;">₹${itemTotal.toLocaleString("en-IN")} <span style="font-size: 11px; color: #64748B; font-weight: 500;">(x${it.quantity || 1})</span></div>
            </div>
          </div>`;
      })
      .join("");

    el.cartSubtotalVal.textContent = `₹${subtotal.toLocaleString("en-IN")}`;
  }

  // ===========================================================================
  // PASSIVE DWELL TELEMETRY BEACON
  // ===========================================================================

  function sendDwellBeacon() {
    if (!productData) return;
    const dwellSeconds = Math.max(0.5, (performance.now() - dwellStart) / 1000);

    const payload = JSON.stringify({
      user_id: "shopper_anon",
      query_text: productData.category || "essentials",
      recent_interactions: [
        {
          product_id: productData.id,
          dwell_time_seconds: parseFloat(dwellSeconds.toFixed(2)),
        },
      ],
      top_k: 4,
    });

    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/v1/recommend/dwell", payload);
    } else {
      fetch("/api/v1/recommend/dwell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      });
    }
  }

  window.addEventListener("beforeunload", sendDwellBeacon);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      sendDwellBeacon();
    }
  });

  // Header Search Trigger
  const headerSearchInput = document.getElementById("headerSearchInput") || document.getElementById("globalSearchInput");
  const btnHeaderSearch = document.getElementById("btnHeaderSearch") || document.getElementById("btnSearchSubmit");
  const headerSearchCategory = document.getElementById("categorySelectDropdown");
  function executeHeaderSearch() {
    if (!headerSearchInput) return;
    const q = headerSearchInput.value.trim();
    const cat = headerSearchCategory ? headerSearchCategory.value : "";
    if (q || cat) {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (cat) params.set("cat", cat);
      window.location.href = `/?${params.toString()}`;
    }
  }
  if (headerSearchInput) {
    headerSearchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        executeHeaderSearch();
      }
    });
  }
  if (btnHeaderSearch) {
    btnHeaderSearch.addEventListener("click", executeHeaderSearch);
  }
  const visualSearchBtn = document.getElementById("visualSearchTrigger");
  if (visualSearchBtn) {
    visualSearchBtn.addEventListener("click", () => {
      window.location.href = "/?openVisualSearch=1";
    });
  }

  // Entrance Motion
  if (window.gsap) {
    gsap.from("#vxCommandDock", { y: -24, opacity: 0, duration: 0.6, ease: "power3.out" });
    gsap.from(".pdp-showcase-card", { y: 20, opacity: 0, duration: 0.5, delay: 0.1, ease: "power3.out" });
  }

  // Run on page load
  syncCartBadge();
  initProductPage();
})();
