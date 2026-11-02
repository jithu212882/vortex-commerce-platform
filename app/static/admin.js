/**
 * MERIDIAN OPERATIONS COCKPIT CLIENT ENGINE
 * Admin & Operations Dashboard for Engineers & Store Supervisors
 * - High-density telemetry & real-time dwell logs
 * - LangGraph human-in-the-loop escalation approval queue
 * - YOLOv8 visual crop detection inspector
 */

(function () {
  "use strict";

  const state = {
    pollingInterval: null,
    simTicketCount: 1,
  };

  const el = {
    btnRefreshTelemetry: document.getElementById("btnRefreshTelemetry"),
    valApiLatency: document.getElementById("valApiLatency"),
    valVectorSearch: document.getElementById("valVectorSearch"),
    valYoloInference: document.getElementById("valYoloInference"),
    valCatalogCount: document.getElementById("valCatalogCount"),
    activityCountChip: document.getElementById("activityCountChip"),
    dwellTelemetryBody: document.getElementById("dwellTelemetryBody"),

    // Escalations
    adminPendingBadge: document.getElementById("adminPendingBadge"),
    adminEscalationList: document.getElementById("adminEscalationList"),

    // Visual Inspector
    yoloInspectorStatus: document.getElementById("yoloInspectorStatus"),
    inspectorEmptyNotice: document.getElementById("inspectorEmptyNotice"),
    inspectorGrid: document.getElementById("inspectorGrid"),

    // Simulate Ticket
    simThreadChip: document.getElementById("simThreadChip"),
    simChatInput: document.getElementById("simChatInput"),
    btnSendSimTicket: document.getElementById("btnSendSimTicket"),
    simResponseBox: document.getElementById("simResponseBox"),
    simStatusLabel: document.getElementById("simStatusLabel"),
    simResponseText: document.getElementById("simResponseText"),

    // Audit Stream
    adminAuditStream: document.getElementById("adminAuditStream"),
    btnClearAdminLog: document.getElementById("btnClearAdminLog"),
  };

  function logAudit(event, text) {
    const ts = new Date().toISOString().substring(11, 23);
    const div = document.createElement("div");
    div.className = "audit-line";
    div.textContent = `[${ts}] ${event} ${text || ""}`;
    el.adminAuditStream.appendChild(div);
    el.adminAuditStream.scrollTop = el.adminAuditStream.scrollHeight;
  }

  function init() {
    bindEvents();
    fetchTelemetry();
    fetchEscalations();

    // Auto-poll telemetry every 6 seconds
    state.pollingInterval = setInterval(() => {
      fetchTelemetry(true);
      fetchEscalations(true);
    }, 6000);
  }

  function bindEvents() {
    el.btnRefreshTelemetry.addEventListener("click", () => {
      fetchTelemetry();
      fetchEscalations();
      logAudit("MANUAL_REFRESH", "Operator refreshed operational telemetry.");
    });

    el.btnClearAdminLog.addEventListener("click", () => {
      el.adminAuditStream.innerHTML = "";
      logAudit("LOG_CLEARED", "Terminal history flushed.");
    });

    // Sim ticket buttons
    document.querySelectorAll(".btn-sim-ticket").forEach((btn) => {
      btn.addEventListener("click", () => {
        el.simChatInput.value = btn.getAttribute("data-msg");
        el.simChatInput.focus();
      });
    });

    el.btnSendSimTicket.addEventListener("click", handleSimTicketDispatch);
    el.simChatInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleSimTicketDispatch();
    });
  }

  // ============================================================================
  // TELEMETRY FETCH & RENDER
  // ============================================================================

  async function fetchTelemetry(silent = false) {
    try {
      const res = await fetch("/api/v1/admin/telemetry");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (!silent) logAudit("TELEMETRY_SYNC", `Fetched ${data.recent_activities?.length || 0} user activity records.`);

      // Update KPI metrics
      if (data.latency_metrics) {
        el.valApiLatency.textContent = `${data.latency_metrics.api_p95_ms}ms`;
        el.valVectorSearch.textContent = `${data.latency_metrics.vector_search_ms}ms`;
        el.valYoloInference.textContent = `${data.latency_metrics.yolo_inference_ms}ms`;
      }
      if (data.catalog_count) {
        el.valCatalogCount.textContent = data.catalog_count;
      }

      // Render Telemetry Table
      renderTelemetryTable(data.recent_activities || []);

      // Render Visual Detections
      renderVisualInspector(data.recent_detections || []);
    } catch (err) {
      if (!silent) logAudit("TELEMETRY_ERROR", err.message);
    }
  }

  function renderTelemetryTable(activities) {
    el.activityCountChip.textContent = `${activities.length} entries`;

    if (!activities || activities.length === 0) {
      el.dwellTelemetryBody.innerHTML = `
        <tr><td colspan="7" class="text-muted text-center" style="padding: 24px;">
          No customer dwell interactions recorded yet. View items on the Storefront to stream telemetry here.
        </td></tr>`;
      return;
    }

    el.dwellTelemetryBody.innerHTML = activities
      .map((a) => {
        const factor = Number(a.normalized_weight || 0).toFixed(3);
        const dwell = Number(a.dwell_time || 0).toFixed(2);
        return `
        <tr>
          <td><span style="font-family: var(--font-mono); color: var(--text-muted);">#${a.id}</span></td>
          <td><span style="font-family: var(--font-mono); font-weight: 600;">${escapeHtml(a.user_id)}</span></td>
          <td><strong>Item #${a.item_id}</strong></td>
          <td><span style="font-family: var(--font-mono); font-weight: 600;">${dwell}s</span></td>
          <td>
            <span style="font-family: var(--font-mono); background-color: var(--accent-blue-subtle); color: var(--accent-blue); padding: 2px 6px; border-radius: 3px; font-weight: 600;">
              ${factor}x
            </span>
          </td>
          <td><span style="color: var(--text-secondary);">${escapeHtml(a.search_query || "--")}</span></td>
          <td><span style="font-family: var(--font-mono); color: var(--text-muted);">${a.created_at || "--"}</span></td>
        </tr>
      `;
      })
      .join("");
  }

  function renderVisualInspector(detections) {
    if (!detections || detections.length === 0) {
      el.inspectorEmptyNotice.style.display = "block";
      el.inspectorGrid.style.display = "none";
      el.yoloInspectorStatus.textContent = "0 inspections";
      return;
    }

    el.inspectorEmptyNotice.style.display = "none";
    el.inspectorGrid.style.display = "flex";
    el.yoloInspectorStatus.textContent = `${detections.length} inspections logged`;

    el.inspectorGrid.innerHTML = detections
      .map((d) => {
        const b = d.bounding_box || {};
        const coords = b.x1 !== undefined ? `[x1:${b.x1}, y1:${b.y1}, x2:${b.x2}, y2:${b.y2}]` : "Focal Fallback";
        const conf = b.confidence !== undefined ? `${(b.confidence * 100).toFixed(1)}%` : "N/A";
        return `
        <div style="display: flex; gap: 14px; background-color: var(--bg-surface-subtle); border: 1px solid var(--border-subtle); border-radius: 6px; padding: 10px;">
          <img src="${d.cropped_preview || ''}" alt="YOLO Crop" style="width: 80px; height: 80px; object-fit: cover; border-radius: 4px; border: 1px solid var(--border-subtle);">
          <div style="flex: 1; font-size: 11.5px; line-height: 1.4;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
              <strong style="font-family: var(--font-mono); font-size: 12px; color: var(--text-primary);">${d.detected_label?.toUpperCase() || 'OBJECT'}</strong>
              <span style="font-family: var(--font-mono); color: var(--text-muted); font-size: 10px;">${d.timestamp}</span>
            </div>
            <div>Confidence: <strong>${conf}</strong> | Status: <strong>${d.status_message}</strong></div>
            <div style="font-family: var(--font-mono); color: var(--text-muted); font-size: 10.5px;">Coordinates: ${coords}</div>
            <div style="color: var(--accent-blue); font-weight: 500; margin-top: 4px;">Retrieved ${d.matches_count} vector catalog matches</div>
          </div>
        </div>
      `;
      })
      .join("");
  }

  // ============================================================================
  // MANAGER ESCALATION QUEUE (LANGGRAPH GATE)
  // ============================================================================

  async function fetchEscalations(silent = false) {
    try {
      const res = await fetch("/api/v1/support/pending");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      renderEscalationQueue(data.tickets || []);
    } catch (err) {
      if (!silent) logAudit("QUEUE_ERROR", err.message);
    }
  }

  function renderEscalationQueue(tickets) {
    el.adminPendingBadge.textContent = `[PENDING: ${tickets.length}]`;

    if (!tickets || tickets.length === 0) {
      el.adminEscalationList.innerHTML = `
        <div class="text-muted text-center" style="padding: 24px; font-size: 12px;">
          No support claims awaiting human authorization.
        </div>`;
      return;
    }

    el.adminEscalationList.innerHTML = tickets
      .map((t) => {
        const amt = Number(t.refund_amount || 0).toFixed(2);
        return `
        <div class="escalation-queue-card" data-thread="${t.thread_id}">
          <div class="escalation-queue-head">
            <span style="font-family: var(--font-mono); font-weight: 700; font-size: 11px;">TICKET #${t.thread_id}</span>
            <span style="font-weight: 700; color: var(--status-rose); font-size: 14px;">$${amt} USD</span>
          </div>
          <div style="font-size: 11.5px; color: var(--text-secondary); margin-bottom: 8px;">
            <strong>Customer Message:</strong> "${escapeHtml(t.current_message || 'Refund Request')}"
          </div>
          <div style="font-size: 10.5px; color: #B45309; background-color: #FEF3C7; padding: 4px 6px; border-radius: 3px; margin-bottom: 10px; font-family: var(--font-mono);">
            [TRIGGER] Amount exceeds automated return limit ($1,000.00). Paused at LangGraph supervisor gate.
          </div>
          
          <div style="display: flex; flex-direction: column; gap: 6px;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
              <input type="text" class="input-text input-sm mgr-name-input" value="MGR_OPERATIONS_LEAD" placeholder="Supervisor ID">
              <input type="text" class="input-text input-sm mgr-notes-input" value="Exception authorized under retail satisfaction warranty." placeholder="Audit decision rationale">
            </div>
            <div style="display: flex; gap: 8px; margin-top: 4px;">
              <button class="btn btn-approve btn-action-approve" data-thread="${t.thread_id}" style="flex: 1;">
                Approve Claim
              </button>
              <button class="btn btn-reject btn-action-reject" data-thread="${t.thread_id}" style="flex: 1;">
                Decline Claim
              </button>
            </div>
          </div>
        </div>
      `;
      })
      .join("");

    // Bind actions
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

    logAudit("SUPERVISOR_ACTION", `Resolving ticket #${threadId}: ${approved ? 'APPROVED' : 'DECLINED'} by ${mgrId}`);

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

      logAudit("LANGGRAPH_RESUMED", `Ticket #${threadId} marked ${data.status}. State machine finished.`);
      fetchEscalations();
    } catch (err) {
      logAudit("ESCALATE_FAILED", err.message);
      alert(`Resolution failed: ${err.message}`);
    }
  }

  // ============================================================================
  // TICKET SIMULATOR
  // ============================================================================

  async function handleSimTicketDispatch() {
    const msg = el.simChatInput.value.trim();
    if (!msg) return;

    const threadId = `sim_ticket_${state.simTicketCount++}`;
    el.simThreadChip.textContent = threadId;

    logAudit("SIM_TICKET_SENT", `[${threadId}] "${msg.substring(0, 30)}..."`);
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

      el.simResponseBox.style.display = "block";
      el.simStatusLabel.textContent = `RESULT: ${data.status?.toUpperCase()}`;
      el.simStatusLabel.style.color = data.escalation_needed ? "#B45309" : "#15803D";
      el.simResponseText.textContent = data.response;

      if (data.escalation_needed) {
        logAudit("GATE_TRIPPED", `Ticket [${threadId}] exceeds threshold. Added to approval queue.`);
        fetchEscalations();
      } else {
        logAudit("AUTO_PROCESSED", `Ticket [${threadId}] processed immediately without gate.`);
      }
    } catch (err) {
      logAudit("SIM_ERROR", err.message);
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

  window.addEventListener("DOMContentLoaded", init);
})();
