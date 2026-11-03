/**
 * VORTEX COMMERCE - Dedicated Orders Client Engine
 * Flipkart-Grade Order History & Automated Return Resolution
 */

(function () {
  "use strict";

  const state = {
    orders: [],
    activeFilter: "all",
    searchQuery: "",
    selectedOrderForReturn: null,
  };

  const el = {
    container: document.getElementById("ordersCardsContainer"),
    searchInput: document.getElementById("orderSearchInput"),
    btnSearch: document.getElementById("btnSearchOrders"),
    filterOptions: document.querySelectorAll(".vx-filter-option[data-filter]"),
    btnClearFilters: document.getElementById("btnClearFilters"),
    countAll: document.getElementById("countAll"),
    countOnTheWay: document.getElementById("countOnTheWay"),
    countDelivered: document.getElementById("countDelivered"),
    countReturned: document.getElementById("countReturned"),
    countCancelled: document.getElementById("countCancelled"),

    // Return Modal
    returnModal: document.getElementById("returnModal"),
    btnCloseReturnModal: document.getElementById("btnCloseReturnModal"),
    btnCancelReturnModal: document.getElementById("btnCancelReturnModal"),
    returnClaimForm: document.getElementById("returnClaimForm"),
    returnOrderId: document.getElementById("returnOrderId"),
    returnModalTitle: document.getElementById("returnModalTitle"),
    returnModalSubtitle: document.getElementById("returnModalSubtitle"),
    returnModalImg: document.getElementById("returnModalImg"),
    returnModalItemTitle: document.getElementById("returnModalItemTitle"),
    returnModalItemPrice: document.getElementById("returnModalItemPrice"),
    returnReasonSelect: document.getElementById("returnReasonSelect"),
    returnCommentsText: document.getElementById("returnCommentsText"),
    returnStatusBox: document.getElementById("returnStatusBox"),
    btnSubmitReturnClaim: document.getElementById("btnSubmitReturnClaim"),

    // Cart
    cartCountBadge: document.getElementById("cartCountBadge"),
    btnCartTrigger: document.getElementById("btnCartTrigger"),
    cartDrawer: document.getElementById("cartDrawer"),
    btnCloseCartDrawer: document.getElementById("btnCloseCartDrawer"),
    cartItemsStream: document.getElementById("cartItemsStream"),
    cartSubtotalVal: document.getElementById("cartSubtotalVal"),

    // Support trigger
    btnOpenSupport: document.getElementById("btnOpenSupportFromOrders"),
  };

  function formatInr(val) {
    return Math.round(Number(val)).toLocaleString("en-IN");
  }

  function init() {
    bindEvents();
    syncCartBadge();
    fetchOrders();
  }

  function bindEvents() {
    // Filter clicks
    el.filterOptions.forEach((opt) => {
      opt.addEventListener("click", () => {
        el.filterOptions.forEach((o) => o.classList.remove("active"));
        opt.classList.add("active");
        const radio = opt.querySelector("input[type='radio']");
        if (radio) radio.checked = true;
        state.activeFilter = opt.getAttribute("data-filter") || "all";
        renderOrders();
      });
    });

    // Clear filters
    if (el.btnClearFilters) {
      el.btnClearFilters.addEventListener("click", () => {
        state.activeFilter = "all";
        state.searchQuery = "";
        if (el.searchInput) el.searchInput.value = "";
        el.filterOptions.forEach((o) => {
          o.classList.remove("active");
          const radio = o.querySelector("input[type='radio']");
          if (radio) radio.checked = radio.id === "filterAll";
        });
        const allOpt = document.querySelector(".vx-filter-option[data-filter='all']");
        if (allOpt) allOpt.classList.add("active");
        renderOrders();
      });
    }

    // Search input
    if (el.btnSearch) {
      el.btnSearch.addEventListener("click", () => {
        state.searchQuery = el.searchInput.value.trim().toLowerCase();
        renderOrders();
      });
    }

    if (el.searchInput) {
      el.searchInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          state.searchQuery = el.searchInput.value.trim().toLowerCase();
          renderOrders();
        }
      });
    }

    // Modal close
    if (el.btnCloseReturnModal) el.btnCloseReturnModal.addEventListener("click", closeReturnModal);
    if (el.btnCancelReturnModal) el.btnCancelReturnModal.addEventListener("click", closeReturnModal);
    if (el.returnModal) {
      el.returnModal.addEventListener("click", (e) => {
        if (e.target === el.returnModal) closeReturnModal();
      });
    }

    // Return Form Submit (Gemini LangGraph Return Workflow)
    if (el.returnClaimForm) {
      el.returnClaimForm.addEventListener("submit", handleReturnSubmit);
    }

    // Cart Drawer Toggle
    if (el.btnCartTrigger) el.btnCartTrigger.addEventListener("click", () => el.cartDrawer.classList.add("open"));
    if (el.btnCloseCartDrawer) el.btnCloseCartDrawer.addEventListener("click", () => el.cartDrawer.classList.remove("open"));

    // Support trigger
    if (el.btnOpenSupport) {
      el.btnOpenSupport.addEventListener("click", () => {
        window.location.href = "/?openSupport=true";
      });
    }

    // Header Search
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

    // GSAP Entrance
    if (window.gsap) {
      gsap.from("#vxCommandDock", { y: -20, opacity: 0, duration: 0.5, ease: "power3.out" });
      gsap.from(".vx-sidebar-card", { y: 20, opacity: 0, duration: 0.5, stagger: 0.1, ease: "power3.out" });
      gsap.from(".vx-orders-search-bar", { y: 15, opacity: 0, duration: 0.4, delay: 0.1, ease: "power3.out" });
    }

    // ESC to close modal
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeReturnModal();
        if (el.cartDrawer) el.cartDrawer.classList.remove("open");
      }
    });
  }

  async function fetchOrders() {
    try {
      const res = await fetch("/api/v1/orders");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      state.orders = data.orders || [];
      updateCounts(state.orders);
      renderOrders();
    } catch (err) {
      el.container.innerHTML = `
        <div style="text-align: center; padding: 48px; color: #94A3B8;">
          Unable to load order history right now. Please refresh the page.
        </div>`;
    }
  }

  function updateCounts(orders) {
    if (el.countAll) el.countAll.textContent = orders.length;
    if (el.countOnTheWay) {
      el.countOnTheWay.textContent = orders.filter((o) => o.status_category === "on_the_way").length;
    }
    if (el.countDelivered) {
      el.countDelivered.textContent = orders.filter((o) => o.status_category === "delivered").length;
    }
    if (el.countReturned) {
      el.countReturned.textContent = orders.filter(
        (o) => o.status_category === "returned" || ["AUTO_APPROVED", "MANAGER_APPROVED"].includes(o.refund_status)
      ).length;
    }
    if (el.countCancelled) {
      el.countCancelled.textContent = orders.filter((o) => o.status_category === "cancelled").length;
    }
  }

  function renderOrders() {
    let filtered = state.orders;

    // Filter by category
    if (state.activeFilter !== "all") {
      if (state.activeFilter === "returned") {
        filtered = filtered.filter(
          (o) => o.status_category === "returned" || ["AUTO_APPROVED", "MANAGER_APPROVED", "PENDING_MANAGER_REVIEW"].includes(o.refund_status)
        );
      } else {
        filtered = filtered.filter((o) => o.status_category === state.activeFilter);
      }
    }

    // Filter by search query
    if (state.searchQuery) {
      filtered = filtered.filter((o) => {
        const idMatch = o.order_id.toLowerCase().includes(state.searchQuery);
        const itemMatch = o.items.some(
          (it) => it.title.toLowerCase().includes(state.searchQuery) || it.brand.toLowerCase().includes(state.searchQuery)
        );
        return idMatch || itemMatch;
      });
    }

    if (filtered.length === 0) {
      el.container.innerHTML = `
        <div style="text-align: center; padding: 64px 20px; background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 14px;">
          <div style="font-size: 16px; font-weight: 700; color: #0F172A; margin-bottom: 6px;">No orders found</div>
          <div style="font-size: 13px; color: #64748B;">Try adjusting your search terms or filter selection.</div>
        </div>`;
      return;
    }

    el.container.innerHTML = filtered.map((order) => renderOrderCard(order)).join("");
    bindOrderCardActions();
  }

  function renderOrderCard(order) {
    const item = order.items[0] || {};
    const thumb = item.image_url || "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=400&q=80";

    // Status dot color
    let dotClass = "green";
    if (order.status_category === "on_the_way") dotClass = "blue";
    else if (order.status_category === "cancelled") dotClass = "rose";
    else if (order.refund_status === "PENDING_MANAGER_REVIEW") dotClass = "amber";

    // Refund status badge
    let refundBadgeHtml = "";
    if (order.refund_status === "AUTO_APPROVED") {
      refundBadgeHtml = `
        <div class="badge-auto-approved">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          <span>Auto-Approved • Payout Queued</span>
        </div>`;
    } else if (order.refund_status === "PENDING_MANAGER_REVIEW") {
      refundBadgeHtml = `
        <div class="badge-under-review">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <span>Under Quality Review • Supervisor Sign-off Pending</span>
        </div>`;
    } else if (order.refund_status === "MANAGER_APPROVED") {
      refundBadgeHtml = `
        <div class="badge-auto-approved">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          <span>Return Approved by Operations • Refund Disbursed</span>
        </div>`;
    } else if (order.refund_status === "MANAGER_REJECTED") {
      refundBadgeHtml = `
        <div class="badge-rejected">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          <span>Return Claim Declined by Supervisor</span>
        </div>`;
    }

    // Return button state
    const canReturn = order.return_eligible && !order.refund_status;
    const returnBtnLabel = order.refund_status ? "Return Claim Submitted" : "Return / Exchange";

    return `
    <article class="vx-order-card" data-order-id="${order.order_id}">
      <!-- Header Row -->
      <div class="vx-order-header">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="order-id-badge">Order #${order.order_id}</span>
          <span style="color: #CBD5E1;">&bull;</span>
          <span class="order-placed-note">Placed on ${order.placed_date}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 14px;">
          <span style="font-size: 12.5px; color: #64748B;">Total Amount:</span>
          <span class="order-price-bold">&#8377;${formatInr(order.total_inr)}</span>
        </div>
      </div>

      <!-- Body Grid -->
      <div class="vx-order-body">
        <!-- Col 1: Thumbnail -->
        <div class="order-thumb-box">
          <img src="${thumb}" alt="${item.title}" class="order-thumb-img" onerror="this.src='https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=400&q=80'">
        </div>

        <!-- Col 2: Info -->
        <div class="order-info-col">
          <span class="order-brand-label">${item.brand || "VORTEX SELECT"}</span>
          <a href="/product/${item.product_id || 1}" class="order-product-title">${item.title}</a>
          <div class="order-meta-row">
            <span>Qty: ${item.quantity || 1}</span>
            <span>&bull;</span>
            <span>Paid via ${order.payment_method}</span>
          </div>
          ${order.return_window ? `<div class="return-window-note">${order.return_window}</div>` : ""}
        </div>

        <!-- Col 3: Status & Timeline -->
        <div class="order-status-col">
          <div class="status-indicator-row">
            <span class="status-dot ${dotClass}"></span>
            <span>${order.status}</span>
          </div>
          <div class="status-sub-desc">${order.status_message}</div>
          ${refundBadgeHtml}
        </div>
      </div>

      <!-- Action Buttons Row -->
      <div class="vx-order-actions-row">
        <button type="button" class="btn-order-action btn-track-package" data-order-id="${order.order_id}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
          <span>Track Package</span>
        </button>

        ${
          canReturn
            ? `
          <button type="button" class="btn-order-action primary-return btn-initiate-return" data-order-id="${order.order_id}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><polyline points="21 3 21 8 16 8"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><polyline points="8 16 3 16 3 21"/></svg>
            <span>Return / Exchange</span>
          </button>`
            : `
          <button type="button" class="btn-order-action" disabled style="opacity: 0.6; cursor: not-allowed;">
            <span>${returnBtnLabel}</span>
          </button>`
        }

        <button type="button" class="btn-order-action btn-download-invoice" data-order-id="${order.order_id}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          <span>Invoice</span>
        </button>

        <button type="button" class="btn-order-action btn-write-review">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          <span>Write Review</span>
        </button>
      </div>
    </article>
    `;
  }

  function bindOrderCardActions() {
    // Return button triggers modal
    el.container.querySelectorAll(".btn-initiate-return").forEach((btn) => {
      btn.addEventListener("click", () => {
        const orderId = btn.getAttribute("data-order-id");
        const order = state.orders.find((o) => o.order_id === orderId);
        if (order) openReturnModal(order);
      });
    });

    // Track package alert
    el.container.querySelectorAll(".btn-track-package").forEach((btn) => {
      btn.addEventListener("click", () => {
        const orderId = btn.getAttribute("data-order-id");
        const order = state.orders.find((o) => o.order_id === orderId);
        if (order) {
          const timelineSteps = order.timeline.map((t) => `${t.done ? "✓" : "○"} ${t.title} (${t.date})`).join("\n");
          alert(`Package Tracking for #${order.order_id}:\n\n${timelineSteps}\n\nDelivery Address:\n${order.shipping_address.address_line}, ${order.shipping_address.city} - ${order.shipping_address.pincode}`);
        }
      });
    });

    // Invoice alert
    el.container.querySelectorAll(".btn-download-invoice").forEach((btn) => {
      btn.addEventListener("click", () => {
        const orderId = btn.getAttribute("data-order-id");
        alert(`Tax Invoice for Order #${orderId} generated.\nGSTIN: 33AAECV9012K1Z9\nBilling Entity: VORTEX RETAIL PVT LTD\nStatus: Paid.`);
      });
    });
  }

  // ===========================================================================
  // RETURN CLAIM MODAL & GEMINI LANGGRAPH INVOCATION
  // ===========================================================================

  function openReturnModal(order) {
    state.selectedOrderForReturn = order;
    const item = order.items[0] || {};

    el.returnOrderId.value = order.order_id;
    el.returnModalTitle.textContent = `Return / Exchange #${order.order_id}`;
    el.returnModalSubtitle.textContent = `Placed on ${order.placed_date} • Value: ₹${formatInr(order.total_inr)}`;
    el.returnModalImg.src = item.image_url || "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=400&q=80";
    el.returnModalItemTitle.textContent = item.title;
    el.returnModalItemPrice.textContent = `₹${formatInr(order.total_inr)}`;

    el.returnReasonSelect.value = "";
    el.returnCommentsText.value = "";
    el.returnStatusBox.style.display = "none";
    el.btnSubmitReturnClaim.disabled = false;
    el.btnSubmitReturnClaim.innerHTML = "<span>Submit Return Claim</span>";

    el.returnModal.classList.add("open");
  }

  function closeReturnModal() {
    if (el.returnModal) el.returnModal.classList.remove("open");
    state.selectedOrderForReturn = null;
  }

  async function handleReturnSubmit(e) {
    e.preventDefault();
    if (!state.selectedOrderForReturn) return;

    const order = state.selectedOrderForReturn;
    const reason = el.returnReasonSelect.value;
    const comments = el.returnCommentsText.value.trim();

    if (!reason) {
      alert("Please select a return reason.");
      return;
    }

    el.btnSubmitReturnClaim.disabled = true;
    el.btnSubmitReturnClaim.innerHTML = "<span>Analyzing Claim with Gemini...</span>";

    try {
      const res = await fetch(`/api/v1/orders/${order.order_id}/return`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: reason,
          notes: comments,
          thread_id: `thread_return_${order.order_id.toLowerCase().replace('#', '').replace('-', '_')}`,
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      el.returnStatusBox.style.display = "block";

      if (data.status === "AUTO_APPROVED" || data.status === "auto_approved") {
        el.returnStatusBox.style.background = "#ECFDF5";
        el.returnStatusBox.style.border = "1px solid #A7F3D0";
        el.returnStatusBox.style.color = "#047857";
        el.returnStatusBox.innerHTML = `
          <div style="font-weight: 700; font-size: 13.5px; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            <span>Return Request Auto-Approved</span>
          </div>
          <div style="font-size: 12px; line-height: 1.4;">${data.response}</div>
        `;
      } else {
        el.returnStatusBox.style.background = "#FFFBEB";
        el.returnStatusBox.style.border = "1px solid #FDE68A";
        el.returnStatusBox.style.color = "#B45309";
        el.returnStatusBox.innerHTML = `
          <div style="font-weight: 700; font-size: 13.5px; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span>Claim Submitted for Operations Review</span>
          </div>
          <div style="font-size: 12px; line-height: 1.4;">${data.response}</div>
        `;
      }

      el.btnSubmitReturnClaim.innerHTML = "<span>Claim Processed ✓</span>";

      // Refresh orders in 1.2s to show updated card badge
      setTimeout(() => {
        closeReturnModal();
        fetchOrders();
      }, 2000);
    } catch (err) {
      el.btnSubmitReturnClaim.disabled = false;
      el.btnSubmitReturnClaim.innerHTML = "<span>Submit Return Claim</span>";
      alert("Unable to process return claim: " + err.message);
    }
  }

  function syncCartBadge() {
    try {
      const stored = localStorage.getItem("vx_cart");
      if (stored && el.cartCountBadge) {
        const items = JSON.parse(stored);
        const count = items.reduce((acc, it) => acc + (it.quantity || 1), 0);
        el.cartCountBadge.textContent = count;
      }
    } catch (e) {}
  }

  window.addEventListener("DOMContentLoaded", init);
})();

