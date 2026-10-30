/**
 * Enterprise Catalog & Operations Desk Frontend Engine
 * Adheres strictly to high-density, functional B2B SaaS architecture.
 */

(function () {
  "use strict";

  // Application State
  const state = {
    userId: "usr_desk_" + Math.random().toString(36).substring(2, 8),
    threadId: "ticket_ops_101",
    interactions: [], // [{ product_id, dwell_time_seconds }]
    catalog: [],
    modalActiveProduct: null,
    modalStartTime: 0,
    dwellInterval: null,
    pendingTickets: new Map(), // thread_id -> ticket data
  };

  // DOM Elements
  const el = {
    sessionTag: document.getElementById("sessionTag"),
    btnRefreshRecs: document.getElementById("btnRefreshRecs"),
    recsStatusChip: document.getElementById("recsStatusChip"),
    loggedInteractionsCount: document.getElementById("loggedInteractionsCount"),
    lastLoggedDwellText: document.getElementById("lastLoggedDwellText"),
    recommendationsTableBody: document.getElementById("recommendationsTableBody"),

    // Vision
    dropZone: document.getElementById("dropZone"),
    imageFileInput: document.getElementById("imageFileInput"),
    btnBrowseFile: document.getElementById("btnBrowseFile"),
    visionStatusChip: document.getElementById("visionStatusChip"),
    imagePreview: document.getElementById("imagePreview"),
    boundingBoxOverlay: document.getElementById("boundingBoxOverlay"),
    bboxLabel: document.getElementById("bboxLabel"),
    visionStatusText: document.getElementById("visionStatusText"),
    visionClassText: document.getElementById("visionClassText"),
    visionConfText: document.getElementById("visionConfText"),
    visionCoordsText: document.getElementById("visionCoordsText"),
    visualMatchesSection: document.getElementById("visualMatchesSection"),
    visualMatchesCount: document.getElementById("visualMatchesCount"),
    visualMatchesGrid: document.getElementById("visualMatchesGrid"),

    // Catalog
    catalogGrid: document.getElementById("catalogGrid"),
    catalogSearchInput: document.getElementById("catalogSearchInput"),
    catalogCategorySelect: document.getElementById("catalogCategorySelect"),
    btnFilterCatalog: document.getElementById("btnFilterCatalog"),

    // Operations / Support
    activeThreadLabel: document.getElementById("activeThreadLabel"),
    btnNewThread: document.getElementById("btnNewThread"),
    chatFeed: document.getElementById("chatFeed"),
    chatForm: document.getElementById("chatForm"),
    chatInput: document.getElementById("chatInput"),
    pendingQueueBadge: document.getElementById("pendingQueueBadge"),
    pendingTicketsList: document.getElementById("pendingTicketsList"),
    auditLogTerminal: document.getElementById("auditLogTerminal"),
    btnClearAudit: document.getElementById("btnClearAudit"),

    // Modal
    productModal: document.getElementById("productModal"),
    modalProductTitle: document.getElementById("modalProductTitle"),
    modalProductImage: document.getElementById("modalProductImage"),
    modalProductCategory: document.getElementById("modalProductCategory"),
    modalProductPrice: document.getElementById("modalProductPrice"),
    modalProductBrand: document.getElementById("modalProductBrand"),
    modalProductDesc: document.getElementById("modalProductDesc"),
    modalDwellCounter: document.getElementById("modalDwellCounter"),
    modalDwellBar: document.getElementById("modalDwellBar"),
    modalDwellCalcText: document.getElementById("modalDwellCalcText"),
    btnModalClose: document.getElementById("btnModalClose"),
    btnModalCommit: document.getElementById("btnModalCommit"),
  };

  // ============================================================================
  // AUDIT LOG UTILITY
  // ============================================================================

  function logAudit(event, details) {
    const ts = new Date().toISOString().substring(11, 23);
    const line = document.createElement("div");
    line.className = "audit-line";
    line.textContent = `[${ts}] ${event} ${details || ""}`;
    el.auditLogTerminal.appendChild(line);
    el.auditLogTerminal.scrollTop = el.auditLogTerminal.scrollHeight;
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  function init() {
    el.sessionTag.textContent = `SESSION: ${state.userId}`;
    logAudit("SYS_INIT", `User: ${state.userId} | Thread: ${state.threadId}`);

    bindEvents();
    fetchCatalog();
    fetchRecommendations();
    fetchPendingEscalations();
  }

  // ============================================================================
  // EVENT BINDINGS
  // ============================================================================

  function bindEvents() {
    // Recommender
    el.btnRefreshRecs.addEventListener("click", () => fetchRecommendations());

    // Catalog Filter
    el.btnFilterCatalog.addEventListener("click", () => fetchCatalog());
    el.catalogSearchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") fetchCatalog();
    });
    el.catalogCategorySelect.addEventListener("change", () => fetchCatalog());

    // File Upload & Vision
    el.btnBrowseFile.addEventListener("click", () => el.imageFileInput.click());
    el.dropZone.addEventListener("click", (e) => {
      if (e.target !== el.btnBrowseFile) el.imageFileInput.click();
    });
    el.imageFileInput.addEventListener("change", handleFileSelected);

    el.dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      el.dropZone.classList.add("dragover");
    });
    el.dropZone.addEventListener("dragleave", () => {
      el.dropZone.classList.remove("dragover");
    });
    el.dropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      el.dropZone.classList.remove("dragover");
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        uploadVisualFile(e.dataTransfer.files[0]);
      }
    });

    // Chat Operations
    el.chatForm.addEventListener("submit", handleChatSubmit);
    el.btnNewThread.addEventListener("click", () => {
      state.threadId = "ticket_ops_" + Math.floor(100 + Math.random() * 900);
      el.activeThreadLabel.textContent = `THREAD: ${state.threadId}`;
      logAudit("THREAD_CREATED", state.threadId);
      appendChatMessage("system", `Switched to clean ticket thread #${state.threadId}.`, "SYSTEM: INFO");
    });

    // Quick Test Scenario Buttons
    document.querySelectorAll(".btn-scenario").forEach((btn) => {
      btn.addEventListener("click", () => {
        el.chatInput.value = btn.getAttribute("data-text");
        el.chatInput.focus();
      });
    });

    // Audit Log Clear
    el.btnClearAudit.addEventListener("click", () => {
      el.auditLogTerminal.innerHTML = "";
      logAudit("AUDIT_CLEARED", "Terminal flushed by operator.");
    });

    // Modal dismiss
    el.btnModalClose.addEventListener("click", closeModalAndCommitDwell);
    el.btnModalCommit.addEventListener("click", closeModalAndCommitDwell);
    el.productModal.addEventListener("click", (e) => {
      if (e.target === el.productModal) closeModalAndCommitDwell();
    });
  }

  // ============================================================================
  // CATALOG MANAGEMENT
  // ============================================================================

  async function fetchCatalog() {
    const search = el.catalogSearchInput.value.trim();
    const category = el.catalogCategorySelect.value;
    const params = new URLSearchParams({ limit: "48" });
    if (search) params.append("search", search);
    if (category) params.append("category", category);

    try {
      const res = await fetch(`/api/v1/catalog?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const items = await res.json();
      state.catalog = items;
      renderCatalog(items);
      logAudit("CATALOG_LOADED", `Returned ${items.length} inventory records.`);
    } catch (err) {
      logAudit("CATALOG_ERROR", err.message);
      el.catalogGrid.innerHTML = `<div class="catalog-loading text-muted">Failed to load inventory: ${err.message}</div>`;
    }
  }

  function renderCatalog(items) {
    if (!items || items.length === 0) {
      el.catalogGrid.innerHTML = `<div class="catalog-loading text-muted">No items found matching criteria.</div>`;
      return;
    }

    el.catalogGrid.innerHTML = items
      .map((it) => {
        const thumb = it.image_url || "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=300&q=80";
        return `
        <div class="product-card" data-id="${it.id}">
          <div>
            <img src="${thumb}" alt="${it.title}" class="product-thumb" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=300&q=80'">
            <div class="product-title" title="${it.title}">${it.title}</div>
            <div class="product-meta-row">
              <span class="product-category-tag">${it.category}</span>
              <span class="product-price">$${Number(it.price).toFixed(2)}</span>
            </div>
          </div>
          <button class="btn btn-secondary btn-sm btn-open-detail" data-id="${it.id}" style="width: 100%;">
            Inspect Item
          </button>
        </div>
      `;
      })
      .join("");

    // Bind item click listeners
    el.catalogGrid.querySelectorAll(".btn-open-detail").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = parseInt(btn.getAttribute("data-id"), 10);
        const product = state.catalog.find((p) => p.id === id);
        if (product) openProductModal(product);
      });
    });
  }

  // ============================================================================
  // DWELL TIME TRACKER & MODAL LOGIC
  // ============================================================================

  function openProductModal(product) {
    state.modalActiveProduct = product;
    state.modalStartTime = Date.now();

    el.modalProductTitle.textContent = product.title;
    el.modalProductImage.src = product.image_url || "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=300&q=80";
    el.modalProductCategory.textContent = product.category.toUpperCase();
    el.modalProductPrice.textContent = `$${Number(product.price).toFixed(2)}`;
    el.modalProductBrand.textContent = `Brand: ${product.brand || "Enterprise Generic"}`;
    el.modalProductDesc.textContent = product.description || "Enterprise specification document available upon purchase.";

    // Reset live counter
    el.modalDwellCounter.textContent = "00:00.000";
    el.modalDwellBar.style.width = "0%";
    el.modalDwellCalcText.textContent = "Dwell Factor: min(0.0s / 10.0s, 1.0) = 0.000x weight";

    el.productModal.style.display = "flex";
    logAudit("MODAL_OPEN", `Tracking telemetry for item #${product.id} [${product.title.substring(0, 20)}...]`);

    // Start live millisecond ticker
    if (state.dwellInterval) clearInterval(state.dwellInterval);
    state.dwellInterval = setInterval(() => {
      const elapsedMs = Date.now() - state.modalStartTime;
      const elapsedSec = elapsedMs / 1000.0;

      const mins = Math.floor(elapsedSec / 60);
      const secs = Math.floor(elapsedSec % 60);
      const ms = Math.floor(elapsedMs % 1000);

      const formatted = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
      el.modalDwellCounter.textContent = formatted;

      // Saturated at 10.0 seconds
      const dwellFactor = Math.min(elapsedSec / 10.0, 1.0);
      const pct = Math.min(dwellFactor * 100, 100);
      el.modalDwellBar.style.width = `${pct}%`;
      el.modalDwellCalcText.textContent = `Dwell Factor: min(${elapsedSec.toFixed(1)}s / 10.0s, 1.0) = ${dwellFactor.toFixed(3)}x weight`;
    }, 40);
  }

  function closeModalAndCommitDwell() {
    if (!state.modalActiveProduct) return;

    if (state.dwellInterval) {
      clearInterval(state.dwellInterval);
      state.dwellInterval = null;
    }

    const elapsedSeconds = Math.max(0.1, (Date.now() - state.modalStartTime) / 1000.0);
    const prod = state.modalActiveProduct;

    // Record interaction
    state.interactions.push({
      product_id: prod.id,
      dwell_time_seconds: parseFloat(elapsedSeconds.toFixed(3)),
    });

    el.productModal.style.display = "none";
    state.modalActiveProduct = null;

    // Update UI telemetry indicators
    el.loggedInteractionsCount.textContent = state.interactions.length;
    el.lastLoggedDwellText.textContent = `Last: ${elapsedSeconds.toFixed(2)}s on #${prod.id}`;
    logAudit("DWELL_COMMITTED", `Item #${prod.id} duration: ${elapsedSeconds.toFixed(3)}s. Dispatched to recommender.`);

    // Trigger instant dwell-weighted recommendation recalculation
    fetchRecommendations();
  }

  // ============================================================================
  // RECOMMENDATION SERVICE INTERACTION
  // ============================================================================

  async function fetchRecommendations() {
    el.recsStatusChip.textContent = "[STATE: COMPUTING]";
    el.recsStatusChip.className = "status-chip chip-warning";

    const payload = {
      user_id: state.userId,
      query_text: el.catalogSearchInput.value.trim() || null,
      recent_interactions: state.interactions,
      top_k: 5,
    };

    try {
      const res = await fetch("/api/v1/recommend/dwell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      renderRecommendationsTable(data.recommendations);
      el.recsStatusChip.textContent = "[STATE: ACTIVE]";
      el.recsStatusChip.className = "status-chip";
      logAudit("RECS_UPDATED", `Returned ${data.total_returned} ranked products. Mode: ${data.scoring_metadata?.mode || "dense"}`);
    } catch (err) {
      el.recsStatusChip.textContent = "[STATE: ERROR]";
      logAudit("RECS_FAILED", err.message);
    }
  }

  function renderRecommendationsTable(recommendations) {
    if (!recommendations || recommendations.length === 0) {
      el.recommendationsTableBody.innerHTML = `
        <tr><td colspan="8" class="text-muted text-center" style="padding: 20px;">
          No candidates matched current criteria.
        </td></tr>`;
      return;
    }

    el.recommendationsTableBody.innerHTML = recommendations
      .map((it) => {
        const b = it.match_breakdown || {};
        const qSim = b.query_cosine_sim !== undefined ? b.query_cosine_sim.toFixed(3) : "--";
        const dSim = b.dwell_cosine_sim !== undefined ? b.dwell_cosine_sim.toFixed(3) : "--";
        const score = it.score !== undefined ? it.score.toFixed(4) : "0.0000";

        return `
        <tr>
          <td><strong style="font-family: var(--font-mono); font-size: 11px;">#${it.rank || "-"}</strong></td>
          <td><span style="font-family: var(--font-mono); color: var(--text-muted); font-size: 11px;">${it.id}</span></td>
          <td><strong>${it.title}</strong></td>
          <td><span class="product-category-tag">${it.category}</span></td>
          <td><strong>$${Number(it.price).toFixed(2)}</strong></td>
          <td><span class="score-badge">${score}</span></td>
          <td>
            <div class="breakdown-text">
              &alpha;&middot;Q_sim: <strong>${qSim}</strong> | &beta;&middot;Dwell_sim: <strong>${dSim}</strong>
            </div>
          </td>
          <td>
            <button class="btn btn-secondary btn-xs btn-inspect-rec" data-id="${it.id}">
              Inspect
            </button>
          </td>
        </tr>
      `;
      })
      .join("");

    el.recommendationsTableBody.querySelectorAll(".btn-inspect-rec").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = parseInt(btn.getAttribute("data-id"), 10);
        const item = state.catalog.find((p) => p.id === id) || {
          id: id,
          title: "Catalog Product #" + id,
          category: "general",
          price: 99.0,
          description: "Product details loaded from recommendation vector database.",
          image_url: "",
        };
        openProductModal(item);
      });
    });
  }

  // ============================================================================
  // VISUAL SEARCH & YOLOV8 INSPECTION
  // ============================================================================

  function handleFileSelected(e) {
    if (e.target.files && e.target.files[0]) {
      uploadVisualFile(e.target.files[0]);
    }
  }

  async function uploadVisualFile(file) {
    el.visionStatusChip.textContent = "[STATUS: ANALYZING]";
    el.visionStatusChip.className = "status-chip chip-warning";
    el.visionStatusText.textContent = "Running YOLOv8n object extraction...";
    logAudit("VISION_UPLOAD", `File: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);

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

      el.visionStatusChip.textContent = "[STATUS: DETECTED]";
      el.visionStatusChip.className = "status-chip";
      el.visionStatusText.textContent = data.status_message;
      el.visionClassText.textContent = data.detected_label || "Unknown";

      // Show preview
      const previewUrl = data.cropped_image_base64 || URL.createObjectURL(file);
      el.imagePreview.src = previewUrl;
      el.imagePreview.style.display = "block";

      if (data.bounding_box) {
        const box = data.bounding_box;
        el.visionConfText.textContent = `${(box.confidence * 100).toFixed(1)}%`;
        el.visionCoordsText.textContent = `[x1:${box.x1}, y1:${box.y1}, x2:${box.x2}, y2:${box.y2}]`;

        // Render Bounding Box indicator
        el.boundingBoxOverlay.style.display = "block";
        el.bboxLabel.textContent = `${box.label} (${(box.confidence * 100).toFixed(0)}%)`;
      } else {
        el.visionConfText.textContent = "N/A";
        el.visionCoordsText.textContent = "Full View";
        el.boundingBoxOverlay.style.display = "none";
      }

      // Render matches
      if (data.recommendations && data.recommendations.length > 0) {
        el.visualMatchesSection.style.display = "block";
        el.visualMatchesCount.textContent = `${data.recommendations.length} items aligned`;
        el.visualMatchesGrid.innerHTML = data.recommendations
          .map((p) => `
            <div class="product-card">
              <img src="${p.image_url || 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=300&q=80'}" class="product-thumb">
              <div class="product-title">${p.title}</div>
              <div class="product-meta-row">
                <span class="product-category-tag">${p.category}</span>
                <span class="product-price">$${Number(p.price).toFixed(2)}</span>
              </div>
              <button class="btn btn-secondary btn-xs btn-open-detail" data-id="${p.id}" style="width: 100%;">Inspect</button>
            </div>
          `)
          .join("");

        el.visualMatchesGrid.querySelectorAll(".btn-open-detail").forEach((b) => {
          b.addEventListener("click", () => {
            const pid = parseInt(b.getAttribute("data-id"), 10);
            const prod = data.recommendations.find((x) => x.id === pid);
            if (prod) openProductModal(prod);
          });
        });
      }

      logAudit("VISION_COMPLETED", `Primary box: ${data.detected_label}. Matches retrieved.`);
    } catch (err) {
      el.visionStatusChip.textContent = "[STATUS: ERROR]";
      el.visionStatusText.textContent = `Processing error: ${err.message}`;
      logAudit("VISION_ERROR", err.message);
    }
  }

  // ============================================================================
  // OPERATIONS CHAT & ESCALATION POLICY GATE
  // ============================================================================

  async function handleChatSubmit(e) {
    e.preventDefault();
    const message = el.chatInput.value.trim();
    if (!message) return;

    appendChatMessage("customer", message, `CUSTOMER [${state.userId}]`);
    el.chatInput.value = "";
    logAudit("CHAT_DISPATCH", `Thread: ${state.threadId} | Inquiry: "${message.substring(0, 30)}..."`);

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

      // Check if policy gate tripped
      if (data.escalation_needed || data.status === "pending_manager_approval") {
        appendChatMessage("gated", data.response, `[POLICY GATE: ESCALATION ENFORCED]`);
        logAudit("POLICY_ESCALATION", `Ticket #${data.thread_id} paused at Manager Review Gate. Amount: $${data.refund_amount || 0}`);
        addPendingTicket(data);
      } else {
        appendChatMessage("system", data.response, `[SYSTEM RESOLUTION: ${data.status.toUpperCase()}]`);
        logAudit("POLICY_RESOLUTION", `Ticket #${data.thread_id} processed: ${data.status}`);
      }
    } catch (err) {
      appendChatMessage("system", `System failure: ${err.message}`, "[SYSTEM ERROR]");
      logAudit("CHAT_ERROR", err.message);
    }
  }

  function appendChatMessage(role, content, meta) {
    const msg = document.createElement("div");
    msg.className = `chat-message message-${role}`;
    msg.innerHTML = `
      <div class="message-meta">${meta || role.toUpperCase()}</div>
      <div class="message-body">${escapeHtml(content)}</div>
    `;
    el.chatFeed.appendChild(msg);
    el.chatFeed.scrollTop = el.chatFeed.scrollHeight;
  }

  function addPendingTicket(ticket) {
    state.pendingTickets.set(ticket.thread_id, ticket);
    renderPendingQueue();
  }

  async function fetchPendingEscalations() {
    try {
      const res = await fetch("/api/v1/support/pending");
      if (res.ok) {
        const data = await res.json();
        data.tickets.forEach((t) => state.pendingTickets.set(t.thread_id, t));
        renderPendingQueue();
      }
    } catch (e) {
      // Background poll silently fails if empty
    }
  }

  function renderPendingQueue() {
    const tickets = Array.from(state.pendingTickets.values());
    el.pendingQueueBadge.textContent = `[PENDING: ${tickets.length}]`;

    if (tickets.length === 0) {
      el.pendingTicketsList.innerHTML = `<div class="empty-state text-muted">No pending escalations in queue.</div>`;
      return;
    }

    el.pendingTicketsList.innerHTML = tickets
      .map((t) => {
        const amt = Number(t.refund_amount || 0).toFixed(2);
        return `
        <div class="escalation-ticket-card" data-thread="${t.thread_id}">
          <div class="escalation-header">
            <span class="escalation-thread-id">TICKET #${t.thread_id}</span>
            <span class="escalation-amount">$${amt} USD</span>
          </div>
          <div class="escalation-body">
            <strong>Customer Request:</strong> "${escapeHtml(t.current_message || 'Refund Request')}"
          </div>
          <div class="escalation-actions">
            <div class="escalation-inputs-row">
              <input type="text" class="input-text input-sm mgr-id-input" placeholder="Manager ID" value="MGR_OPS_SUPERVISOR">
              <input type="text" class="input-text input-sm mgr-notes-input" placeholder="Audit Decision Notes" value="Policy exception authorized.">
            </div>
            <div class="escalation-buttons-row">
              <button class="btn btn-success btn-sm btn-approve" data-thread="${t.thread_id}" style="flex: 1;">
                Approve Refund
              </button>
              <button class="btn btn-danger btn-sm btn-reject" data-thread="${t.thread_id}" style="flex: 1;">
                Reject Refund
              </button>
            </div>
          </div>
        </div>
      `;
      })
      .join("");

    // Bind action buttons
    el.pendingTicketsList.querySelectorAll(".btn-approve").forEach((btn) => {
      btn.addEventListener("click", () => handleManagerDecision(btn.getAttribute("data-thread"), true));
    });

    el.pendingTicketsList.querySelectorAll(".btn-reject").forEach((btn) => {
      btn.addEventListener("click", () => handleManagerDecision(btn.getAttribute("data-thread"), false));
    });
  }

  async function handleManagerDecision(threadId, approved) {
    const card = el.pendingTicketsList.querySelector(`[data-thread="${threadId}"]`);
    const mgrId = card ? card.querySelector(".mgr-id-input").value.trim() : "MGR_OPS_SUPERVISOR";
    const notes = card ? card.querySelector(".mgr-notes-input").value.trim() : "Resolution verified";

    logAudit("MANAGER_ACTION", `Resolving ticket #${threadId}: ${approved ? 'APPROVED' : 'REJECTED'} by ${mgrId}`);

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

      // Remove from pending map
      state.pendingTickets.delete(threadId);
      renderPendingQueue();

      // Render resolution in conversation feed
      appendChatMessage("system", data.response, `[POLICY RESOLVED: ${approved ? 'APPROVED' : 'REJECTED'}]`);
      logAudit("ESCALATION_RESOLVED", `Ticket #${threadId} marked ${data.status}. Resumed LangGraph.`);
    } catch (err) {
      logAudit("ESCALATION_ERROR", err.message);
      alert(`Escalation failed: ${err.message}`);
    }
  }

  function escapeHtml(str) {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Run on page load
  window.addEventListener("DOMContentLoaded", init);
})();

