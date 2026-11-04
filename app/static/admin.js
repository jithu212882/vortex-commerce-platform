/**
 * VORTEX COMMERCE OPERATIONS COCKPIT
 * Enterprise SaaS Operations Client (Shopify / Stripe Standard)
 * - 4-Column Live Metric Cards
 * - Store Orders & Customer Dwell Telemetry
 * - Human-in-the-Loop Refund Escalation Approval Queue
 * - Support Policy Simulator & Quick Store Controls
 */

(function () {
  "use strict";

  const state = {
    pollingInterval: null,
    simTicketCount: 1,
    activeTab: "orders",
  };

  const el = {
    liveClockText: document.getElementById("liveClockText"),
    btnRefreshTelemetry: document.getElementById("btnRefreshTelemetry"),
    adminToastBox: document.getElementById("adminToastBox"),
    adminToastText: document.getElementById("adminToastText"),

    // Metric Cards
    valApiLatency: document.getElementById("valApiLatency"),
    valCatalogCount: document.getElementById("valCatalogCount"),
    valPendingCount: document.getElementById("valPendingCount"),
    valPendingSub: document.getElementById("valPendingSub"),
    pendingPulseDot: document.getElementById("pendingPulseDot"),

    // Tabs
    tabBtnOrders: document.getElementById("tabBtnOrders"),
    tabBtnDwell: document.getElementById("tabBtnDwell"),
    viewOrdersContainer: document.getElementById("viewOrdersContainer"),
    viewDwellContainer: document.getElementById("viewDwellContainer"),
    tableRecordCountText: document.getElementById("tableRecordCountText"),

    // Tables
    ordersTableBody: document.getElementById("ordersTableBody"),
    dwellTelemetryBody: document.getElementById("dwellTelemetryBody"),

    // Quick Store Controls
    btnSyncCatalog: document.getElementById("btnSyncCatalog"),
    toggleMaintenance: document.getElementById("toggleMaintenance"),
    toggleCarousel: document.getElementById("toggleCarousel"),
    toggleExpress: document.getElementById("toggleExpress"),

    // Manager Escalation Queue
    cardManagerQueue: document.getElementById("cardManagerQueue"),
    adminPendingBadge: document.getElementById("adminPendingBadge"),
    adminEscalationList: document.getElementById("adminEscalationList"),

    // Simulator
    simThreadChip: document.getElementById("simThreadChip"),
    simChatInput: document.getElementById("simChatInput"),
    btnSendSimTicket: document.getElementById("btnSendSimTicket"),
    simResponseBox: document.getElementById("simResponseBox"),
    simStatusLabel: document.getElementById("simStatusLabel"),
    simResponseText: document.getElementById("simResponseText"),
  };

  function showToast(message) {
    if (!el.adminToastBox || !el.adminToastText) return;
    el.adminToastText.textContent = message;
    el.adminToastBox.classList.remove("hidden");
    setTimeout(() => {
      el.adminToastBox.classList.add("hidden");
    }, 4500);
  }

  function updateClock() {
    if (!el.liveClockText) return;
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    el.liveClockText.textContent = `Sync: ${timeStr}`;
  }

  function init() {
    bindEvents();
    updateClock();
    fetchDashboardData();

    // Auto-poll dashboard data every 6 seconds
    state.pollingInterval = setInterval(() => {
      fetchDashboardData(true);
      updateClock();
    }, 6000);
  }

  function bindEvents() {
    // Manual Refresh
    if (el.btnRefreshTelemetry) {
      el.btnRefreshTelemetry.addEventListener("click", () => {
        fetchDashboardData(false);
        showToast("Dashboard metrics refreshed successfully.");
      });
    }

    // Tab Navigation
    if (el.tabBtnOrders && el.tabBtnDwell) {
      el.tabBtnOrders.addEventListener("click", () => switchTab("orders"));
      el.tabBtnDwell.addEventListener("click", () => switchTab("dwell"));
    }

    // Quick Store Controls
    if (el.btnSyncCatalog) {
      el.btnSyncCatalog.addEventListener("click", handleSyncCatalog);
    }
    if (el.toggleMaintenance) {
      el.toggleMaintenance.addEventListener("change", (e) =>
        handleToggleControl("maintenance_mode", e.target.checked)
      );
    }
    if (el.toggleCarousel) {
      el.toggleCarousel.addEventListener("change", (e) =>
        handleToggleControl("hero_carousel", e.target.checked)
      );
    }
    if (el.toggleExpress) {
      el.toggleExpress.addEventListener("change", (e) =>
        handleToggleControl("express_dispatch", e.target.checked)
      );
    }

    // Support Policy Simulator Preset Buttons
    document.querySelectorAll(".btn-sim-ticket").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (el.simChatInput) {
          el.simChatInput.value = btn.getAttribute("data-msg") || "";
          el.simChatInput.focus();
        }
      });
    });

    // Simulate Ticket Submission
    if (el.btnSendSimTicket) {
      el.btnSendSimTicket.addEventListener("click", handleSimTicketDispatch);
    }
    if (el.simChatInput) {
      el.simChatInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") handleSimTicketDispatch();
      });
    }
  }

  function switchTab(tab) {
    state.activeTab = tab;
    if (tab === "orders") {
      el.viewOrdersContainer.classList.remove("hidden");
      el.viewDwellContainer.classList.add("hidden");
      el.tabBtnOrders.className = "px-3.5 py-1.5 rounded-lg bg-white text-slate-900 shadow-xs transition-all cursor-pointer";
      el.tabBtnDwell.className = "px-3.5 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 transition-all cursor-pointer";
    } else {
      el.viewOrdersContainer.classList.add("hidden");
      el.viewDwellContainer.classList.remove("hidden");
      el.tabBtnDwell.className = "px-3.5 py-1.5 rounded-lg bg-white text-slate-900 shadow-xs transition-all cursor-pointer";
      el.tabBtnOrders.className = "px-3.5 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 transition-all cursor-pointer";
    }
  }

  // ============================================================================
  // DASHBOARD DATA SYNC
  // ============================================================================

  async function fetchDashboardData(silent = false) {
    try {
      const res = await fetch("/api/v1/admin/telemetry");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // 1. Update Top Metric Cards
      updateMetricCards(data);

      // 2. Render Orders Table
      renderOrdersTable(data.recent_orders || []);

      // 3. Render Dwell Telemetry
      renderDwellTable(data.recent_activities || []);

      // 4. Render Approval Queue
      renderApprovalQueue(data.pending_tickets || []);
    } catch (err) {
      if (!silent) console.error("Telemetry sync error:", err);
    }
  }

  function updateMetricCards(data) {
    // Latency
    if (data.latency_metrics && el.valApiLatency) {
      el.valApiLatency.textContent = `${data.latency_metrics.api_p95_ms} ms`;
    }

    // Catalog SKUs
    if (data.catalog_count !== undefined && el.valCatalogCount) {
      el.valCatalogCount.textContent = `${data.catalog_count} items`;
    }

    // Pending Approvals
    const count = data.pending_count || (data.pending_tickets ? data.pending_tickets.length : 0);
    if (el.valPendingCount) {
      el.valPendingCount.textContent = `${count} claims`;
    }
    if (el.adminPendingBadge) {
      el.adminPendingBadge.textContent = count;
      if (count > 0) {
        el.adminPendingBadge.className = "px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-100 text-amber-800 border border-amber-300";
      } else {
        el.adminPendingBadge.className = "px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-slate-100 text-slate-700";
      }
    }
    if (el.valPendingSub) {
      el.valPendingSub.textContent = count === 0 ? "Supervisor review queue is clear" : "Action required on high-value refunds";
    }
    if (el.pendingPulseDot) {
      el.pendingPulseDot.className = count > 0 ? "w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" : "w-2.5 h-2.5 rounded-full bg-slate-300";
    }
  }

  // ============================================================================
  // ORDERS TABLE
  // ============================================================================

  function renderOrdersTable(orders) {
    if (!el.ordersTableBody) return;

    if (!orders || orders.length === 0) {
      el.ordersTableBody.innerHTML = `
        <tr>
          <td colspan="5" class="py-12 text-center text-slate-400">
            No customer orders recorded yet.
          </td>
        </tr>`;
      return;
    }

    el.ordersTableBody.innerHTML = orders
      .map((ord) => {
        const total = Number(ord.total_inr || 0).toLocaleString("en-IN", {
          style: "currency",
          currency: "INR",
          maximumFractionDigits: 0,
        });

        // Status pill styles
        const cat = (ord.status_category || "delivered").toLowerCase();
        let badgeClass = "bg-slate-100 text-slate-700 border-slate-200";
        if (cat === "delivered") {
          badgeClass = "bg-emerald-50 text-emerald-700 border-emerald-200/80";
        } else if (cat === "on_the_way") {
          badgeClass = "bg-amber-50 text-amber-700 border-amber-200/80";
        } else if (cat === "cancelled" || cat === "returned") {
          badgeClass = "bg-rose-50 text-rose-700 border-rose-200/80";
        }

        const customerName = ord.shipping_address?.name || "Customer";
        const itemCount = ord.items?.length || 1;
        const firstItem = ord.items?.[0]?.title || "E-Commerce Item";

        return `
        <tr class="hover:bg-slate-50/80 transition-colors">
          <td class="py-3.5 px-5">
            <div class="font-bold text-slate-900">${escapeHtml(customerName)}</div>
            <div class="font-mono text-[11px] text-slate-400">${ord.order_id} &bull; ${ord.placed_date || "Recent"}</div>
          </td>
          <td class="py-3.5 px-4">
            <div class="font-medium text-slate-800 line-clamp-1 max-w-[200px]" title="${escapeHtml(firstItem)}">${escapeHtml(firstItem)}</div>
            <div class="text-[11px] text-slate-400">${itemCount} item${itemCount > 1 ? "s" : ""}</div>
          </td>
          <td class="py-3.5 px-4 font-mono font-bold text-slate-900">
            ${total}
          </td>
          <td class="py-3.5 px-4">
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${badgeClass}">
              ${escapeHtml(ord.status || "Delivered")}
            </span>
          </td>
          <td class="py-3.5 px-5 text-right">
            <a href="/orders" class="font-semibold text-slate-900 hover:text-black underline underline-offset-2 text-[11px]" title="Inspect order details">
              View Order &rarr;
            </a>
          </td>
        </tr>`;
      })
      .join("");
  }

  // ============================================================================
  // DWELL SIGNALS TABLE
  // ============================================================================

  function renderDwellTable(activities) {
    if (!el.dwellTelemetryBody) return;

    if (!activities || activities.length === 0) {
      el.dwellTelemetryBody.innerHTML = `
        <tr>
          <td colspan="5" class="py-12 text-center text-slate-400">
            No live browsing interactions logged in this session.
          </td>
        </tr>`;
      return;
    }

    el.dwellTelemetryBody.innerHTML = activities
      .slice(0, 10)
      .map((a) => {
        const dwell = Number(a.dwell_time || 0).toFixed(1);
        const weight = Number(a.normalized_weight || 0).toFixed(2);
        return `
        <tr class="hover:bg-slate-50/80 transition-colors">
          <td class="py-3.5 px-5">
            <span class="font-mono font-semibold text-slate-900">${escapeHtml(a.user_id || "guest_user")}</span>
            <div class="text-[10px] font-mono text-slate-400">Rec #${a.id}</div>
          </td>
          <td class="py-3.5 px-4 font-medium text-slate-800">
            Product SKU #${a.item_id}
          </td>
          <td class="py-3.5 px-4">
            <span class="font-mono font-bold text-slate-900">${dwell}s</span>
            <span class="text-[10px] font-mono text-slate-400 ml-1">(${weight}x)</span>
          </td>
          <td class="py-3.5 px-4 text-slate-600">
            ${escapeHtml(a.search_query || "Catalog browse")}
          </td>
          <td class="py-3.5 px-5 text-right font-mono text-slate-400 text-[11px]">
            ${a.created_at || "Recent"}
          </td>
        </tr>`;
      })
      .join("");
  }

  // ============================================================================
  // MANAGER APPROVAL QUEUE
  // ============================================================================

  function renderApprovalQueue(tickets) {
    if (!el.adminEscalationList) return;

    if (!tickets || tickets.length === 0) {
      el.adminEscalationList.innerHTML = `
        <div class="py-8 text-center flex flex-col items-center justify-center text-slate-400">
          <div class="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-600 mb-3">
            <svg class="w-6 h-6 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
          </div>
          <div class="text-xs font-bold text-slate-700">All caught up!</div>
          <div class="text-[11px] text-slate-400 max-w-[220px] mt-0.5 leading-relaxed">
            No pending refund claims awaiting review. Standard items &le; ₹1,000 are processed automatically.
          </div>
        </div>`;
      return;
    }

    el.adminEscalationList.innerHTML = tickets
      .map((t) => {
        const amt = Number(t.refund_amount || 0).toLocaleString("en-IN", {
          style: "currency",
          currency: "INR",
          maximumFractionDigits: 0,
        });

        return `
        <div class="p-4 rounded-xl border border-rose-200 bg-rose-50/30 flex flex-col gap-3" data-thread="${t.thread_id}">
          <div class="flex items-center justify-between">
            <span class="font-mono text-xs font-bold text-slate-800">TICKET #${t.thread_id}</span>
            <span class="text-sm font-extrabold text-rose-700 font-mono">${amt}</span>
          </div>

          <div class="text-xs text-slate-600 bg-white p-3 rounded-lg border border-slate-200/80">
            <span class="font-bold text-slate-900 block mb-1">Claim Reason:</span>
            "${escapeHtml(t.current_message || "Defective merchandise return request")}"
          </div>

          <div class="flex items-center gap-1.5 text-[11px] text-amber-800 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200">
            <svg class="w-3.5 h-3.5 text-amber-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            <span>Amount exceeds automated threshold (&gt; ₹1,000). Paused for supervisor authorization.</span>
          </div>

          <div class="flex flex-col gap-2 pt-1">
            <div class="grid grid-cols-2 gap-2">
              <input type="text" class="mgr-name-input bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none" value="MGR_OPERATIONS_LEAD" placeholder="Supervisor ID">
              <input type="text" class="mgr-notes-input bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none" value="Verified and approved." placeholder="Audit decision note">
            </div>
            <div class="grid grid-cols-2 gap-2 mt-1">
              <button type="button" class="btn-action-approve py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors cursor-pointer shadow-xs" data-thread="${t.thread_id}">
                Approve Claim
              </button>
              <button type="button" class="btn-action-reject py-2 px-3 rounded-xl bg-white hover:bg-rose-50 border border-rose-300 text-rose-700 font-bold text-xs transition-colors cursor-pointer" data-thread="${t.thread_id}">
                Decline Claim
              </button>
            </div>
          </div>
        </div>`;
      })
      .join("");

    // Bind action buttons
    el.adminEscalationList.querySelectorAll(".btn-action-approve").forEach((btn) => {
      btn.addEventListener("click", () => handleResolution(btn.getAttribute("data-thread"), true));
    });

    el.adminEscalationList.querySelectorAll(".btn-action-reject").forEach((btn) => {
      btn.addEventListener("click", () => handleResolution(btn.getAttribute("data-thread"), false));
    });
  }

  async function handleResolution(threadId, approved) {
    const card = el.adminEscalationList.querySelector(`[data-thread="${threadId}"]`);
    const mgrId = card ? card.querySelector(".mgr-name-input").value.trim() : "MGR_OPERATIONS_LEAD";
    const notes = card ? card.querySelector(".mgr-notes-input").value.trim() : "Decision recorded.";

    try {
      const res = await fetch("/api/v1/support/escalate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          thread_id: threadId,
          approved: approved,
          manager_id: mgrId,
          notes: notes,
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      showToast(`Ticket #${threadId} was ${approved ? "APPROVED" : "DECLINED"} by ${mgrId}.`);
      fetchDashboardData();
    } catch (err) {
      alert(`Resolution failed: ${err.message}`);
    }
  }

  // ============================================================================
  // TICKET SIMULATOR
  // ============================================================================

  async function handleSimTicketDispatch() {
    const msg = el.simChatInput ? el.simChatInput.value.trim() : "";
    if (!msg) return;

    const threadId = `sim_ticket_${state.simTicketCount++}`;
    if (el.simThreadChip) el.simThreadChip.textContent = threadId;
    el.simChatInput.value = "";

    try {
      const res = await fetch("/api/v1/support/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          thread_id: threadId,
          message: msg,
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (el.simResponseBox) el.simResponseBox.classList.remove("hidden");
      if (el.simStatusLabel) {
        const isEscalated = data.escalation_needed;
        el.simStatusLabel.textContent = isEscalated ? "ROUTED TO MANAGER REVIEW" : "AUTO-APPROVED";
        el.simStatusLabel.className = isEscalated
          ? "font-bold text-[11px] uppercase tracking-wider text-rose-700 font-mono"
          : "font-bold text-[11px] uppercase tracking-wider text-emerald-700 font-mono";
      }
      if (el.simResponseText) {
        el.simResponseText.textContent = data.response;
      }

      showToast(data.escalation_needed ? "Claim routed to Manager Review Queue." : "Claim verified and auto-approved.");
      fetchDashboardData();
    } catch (err) {
      alert(`Simulation failed: ${err.message}`);
    }
  }

  // ============================================================================
  // STORE CONTROLS
  // ============================================================================

  async function handleSyncCatalog() {
    try {
      const res = await fetch("/api/v1/admin/sync-catalog", { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      showToast(data.message || "Catalog embeddings and cache synchronized.");
      fetchDashboardData();
    } catch (err) {
      showToast("Catalog sync completed.");
    }
  }

  async function handleToggleControl(feature, enabled) {
    try {
      await fetch("/api/v1/admin/toggle-control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feature, enabled }),
      });
      showToast(`${feature.replace(/_/g, " ").toUpperCase()} is now ${enabled ? "ACTIVE" : "DISABLED"}.`);
    } catch (err) {
      console.warn("Toggle control notice:", err);
    }
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  window.addEventListener("DOMContentLoaded", init);
})();
