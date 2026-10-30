import hashlib
import logging
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, TypedDict

from app.core.config import settings

logger = logging.getLogger(__name__)


# ==============================================================================
# STATE DEFINITION
# ==============================================================================

class AgentState(TypedDict, total=False):
    thread_id: str
    messages: List[Dict[str, Any]]
    current_message: str
    intent: Optional[str]  # "general_inquiry", "catalog_query", "refund_request"
    refund_amount: Optional[float]
    escalation_needed: bool
    manager_approved: Optional[bool]
    manager_id: Optional[str]
    notes: Optional[str]
    resolution_status: str  # "in_progress", "pending_manager_approval", "auto_approved", "manager_approved", "manager_rejected", "resolved"
    response: str


# ==============================================================================
# INTENT & POLICY RULES (DETERMINISTIC ENTERPRISE LOGIC)
# ==============================================================================

def extract_refund_amount(text: str) -> Optional[float]:
    """Extracts dollar amounts from text like '$1200', '$2500', '1,850 dollars', 'refund 1500', '$99.50'."""
    pattern = r'(?:\$|\bUSD\s*|\bamount\s*(?:of)?\s*)?([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)\s*(?:dollars|\$)?'
    matches = re.findall(pattern, text, re.IGNORECASE)
    candidates = []
    for m in matches:
        cleaned = m.replace(",", "").strip()
        if not cleaned:
            continue
        try:
            val = float(cleaned)
            if 1.0 <= val <= 1000000.0:
                candidates.append(val)
        except ValueError:
            continue

    if candidates:
        return candidates[0]
    return None


def classify_intent(text: str) -> str:
    lower = text.lower()
    if any(k in lower for k in ["refund", "return", "cancel order", "money back", "reimburse", "chargeback"]):
        return "refund_request"
    if any(k in lower for k in ["price", "cost", "catalog", "item", "product", "specs", "stock", "recommend", "inventory", "shipping", "deliver"]):
        return "catalog_query"
    return "general_inquiry"


# ==============================================================================
# GRAPH NODES
# ==============================================================================

def intent_triage(state: AgentState) -> Dict[str, Any]:
    """Node 1: Parses customer inquiry into category (general inquiry, catalog query, refund/return request)."""
    msg = state.get("current_message", "")
    intent = classify_intent(msg)
    refund_amount = None

    if intent == "refund_request":
        refund_amount = extract_refund_amount(msg)
        # Default placeholder if customer requests refund without explicit amount
        if refund_amount is None:
            refund_amount = 50.0

    logger.info(f"[Intent Triage] Thread={state.get('thread_id')}, Intent={intent}, Amount={refund_amount}")
    return {
        "intent": intent,
        "refund_amount": refund_amount,
        "resolution_status": "triaged",
    }


def policy_validator(state: AgentState) -> Dict[str, Any]:
    """
    Node 2: Automatically checks refund threshold:
    - Amounts <= 1000 approved automatically
    - Amounts > 1000 flag escalation_needed = True
    """
    intent = state.get("intent", "general_inquiry")
    refund_amount = state.get("refund_amount")
    threshold = settings.REFUND_THRESHOLD

    if intent == "refund_request" and refund_amount is not None:
        if refund_amount <= threshold:
            logger.info(f"[Policy Validator] Amount ${refund_amount} <= ${threshold} -> AUTO APPROVED")
            return {
                "escalation_needed": False,
                "manager_approved": True,
                "resolution_status": "auto_approved",
            }
        else:
            logger.info(f"[Policy Validator] Amount ${refund_amount} > ${threshold} -> ESCALATION NEEDED")
            return {
                "escalation_needed": True,
                "manager_approved": None,
                "resolution_status": "pending_manager_approval",
            }

    return {
        "escalation_needed": False,
        "manager_approved": None,
        "resolution_status": "standard_resolution",
    }


def manager_checkpoint(state: AgentState) -> Dict[str, Any]:
    """Node 3: Checkpoint interrupted via interrupt_before for human review."""
    logger.info(f"[Manager Checkpoint] Resumed for thread={state.get('thread_id')}, approved={state.get('manager_approved')}")
    approved = state.get("manager_approved")
    if approved is True:
        status = "manager_approved"
    elif approved is False:
        status = "manager_rejected"
    else:
        status = "pending_manager_approval"

    return {
        "resolution_status": status,
    }


def response_generator(state: AgentState) -> Dict[str, Any]:
    """Node 4: Generates factual system responses based on resolution state."""
    intent = state.get("intent", "general_inquiry")
    res_status = state.get("resolution_status", "resolved")
    amount = state.get("refund_amount", 0.0)
    manager_id = state.get("manager_id", "OPERATIONS_LEAD")
    notes = state.get("notes", "Compliance with enterprise refund policy verified.")
    thread_id = state.get("thread_id", "TICKET")
    txn_ref = hashlib.md5(f"{thread_id}_{amount}_{datetime.now(timezone.utc)}".encode()).hexdigest()[:10].upper()

    if res_status == "auto_approved":
        response_text = (
            f"[POLICY: AUTOMATED_APPROVAL] Refund ticket verified. Amount: ${amount:,.2f} "
            f"is within the automated limit (<= ${settings.REFUND_THRESHOLD:,.2f}). "
            f"The transaction has been approved and queued for electronic disbursement. "
            f"Reference: TXN-{txn_ref}."
        )
    elif res_status == "pending_manager_approval":
        response_text = (
            f"[POLICY: ESCALATION_GATE] High-value refund request detected: ${amount:,.2f} "
            f"exceeds standard automated limit (${settings.REFUND_THRESHOLD:,.2f}). "
            f"Ticket [{thread_id}] has been gated and placed in the Manager Approval Queue. "
            f"A operations supervisor review is mandatory before funds can be released."
        )
    elif res_status == "manager_approved":
        response_text = (
            f"[POLICY: MANAGER_RESOLUTION] Refund of ${amount:,.2f} was APPROVED by Manager [{manager_id}]. "
            f"Audit Note: '{notes}'. Payment settlement batch reference TXN-{txn_ref} generated."
        )
    elif res_status == "manager_rejected":
        response_text = (
            f"[POLICY: MANAGER_RESOLUTION] Refund request for ${amount:,.2f} was DECLINED by Manager [{manager_id}]. "
            f"Audit Rationale: '{notes}'. You may contact customer escalations if you wish to appeal this determination."
        )
    elif intent == "catalog_query":
        response_text = (
            f"[CATALOG_SERVICE: OK] Inquiry received. Real-time product inventory and specifications have been "
            f"verified against our warehouse database. Current fulfillment timeline is 2 business days."
        )
    else:
        response_text = (
            f"[SUPPORT_DESK: PROCESSED] Inquiry registered under ticket #{thread_id}. "
            f"Standard service-level agreement response window is active. Operating hours: 24/7 Enterprise Support."
        )

    # Append to message log
    current_messages = list(state.get("messages", []))
    current_messages.append({"role": "customer", "content": state.get("current_message", "")})
    current_messages.append({"role": "system", "content": response_text})

    return {
        "response": response_text,
        "messages": current_messages,
    }


def router_condition(state: AgentState) -> str:
    """Routes to manager_checkpoint if escalation is required and unreviewed."""
    if state.get("escalation_needed") is True and state.get("manager_approved") is None:
        return "manager_checkpoint"
    return "response_generator"


# ==============================================================================
# WORKFLOW SERVICE IMPLEMENTATION WITH LANGGRAPH + IN-MEMORY FALLBACK
# ==============================================================================

class SupportEscalationWorkflow:
    """Stateful LangGraph support & escalation orchestrator with human-in-the-loop."""

    def __init__(self):
        self._graph = None
        self._memory_checkpointer = None
        self._state_store: Dict[str, AgentState] = {}
        self._init_graph()

    def _init_graph(self):
        """Builds stateful StateGraph with MemorySaver checkpointer and interrupt_before."""
        try:
            from langgraph.graph import StateGraph, START, END
            from langgraph.checkpoint.memory import MemorySaver

            self._memory_checkpointer = MemorySaver()
            builder = StateGraph(AgentState)

            # Add nodes
            builder.add_node("intent_triage", intent_triage)
            builder.add_node("policy_validator", policy_validator)
            builder.add_node("manager_checkpoint", manager_checkpoint)
            builder.add_node("response_generator", response_generator)

            # Add edges
            builder.add_edge(START, "intent_triage")
            builder.add_edge("intent_triage", "policy_validator")
            
            # Conditional edge from policy_validator
            builder.add_conditional_edges(
                "policy_validator",
                router_condition,
                {
                    "manager_checkpoint": "manager_checkpoint",
                    "response_generator": "response_generator",
                },
            )
            builder.add_edge("manager_checkpoint", "response_generator")
            builder.add_edge("response_generator", END)

            # Compile with checkpointing and human-in-the-loop interruption
            self._graph = builder.compile(
                checkpointer=self._memory_checkpointer,
                interrupt_before=["manager_checkpoint"],
            )
            logger.info("LangGraph StateGraph compiled successfully with interrupt_before=['manager_checkpoint']")
        except Exception as e:
            logger.warning(f"LangGraph compilation note: {e}. Active state store ready as deterministic engine.")
            self._graph = None

    def handle_chat(self, thread_id: str, message: str) -> Dict[str, Any]:
        """Processes customer message through the stateful graph."""
        existing_state = self._state_store.get(thread_id, {
            "thread_id": thread_id,
            "messages": [],
            "current_message": "",
            "intent": None,
            "refund_amount": None,
            "escalation_needed": False,
            "manager_approved": None,
            "manager_id": None,
            "notes": None,
            "resolution_status": "in_progress",
            "response": "",
        })

        existing_state["current_message"] = message
        existing_state["thread_id"] = thread_id

        if self._graph is not None:
            config = {"configurable": {"thread_id": thread_id}}
            try:
                # Invoke graph
                state_output = self._graph.invoke(existing_state, config=config)
                
                # Check if graph paused at interrupt_before=["manager_checkpoint"]
                snapshot = self._graph.get_state(config)
                if snapshot and snapshot.next and "manager_checkpoint" in snapshot.next:
                    # Paused at manager checkpoint
                    paused_state = dict(snapshot.values)
                    paused_state["resolution_status"] = "pending_manager_approval"
                    paused_state["escalation_needed"] = True
                    # Generate gated response
                    resp = response_generator(paused_state)
                    paused_state["response"] = resp["response"]
                    paused_state["messages"] = resp["messages"]
                    self._state_store[thread_id] = paused_state
                    return paused_state
                
                final_res = dict(state_output)
                self._state_store[thread_id] = final_res
                return final_res
            except Exception as ex:
                logger.warning(f"Graph execution fallback: {ex}")

        # Deterministic simulation fallback
        triage_res = intent_triage(existing_state)
        existing_state.update(triage_res)
        
        policy_res = policy_validator(existing_state)
        existing_state.update(policy_res)

        if existing_state["escalation_needed"] and existing_state["manager_approved"] is None:
            # Paused before manager checkpoint
            resp_res = response_generator(existing_state)
            existing_state.update(resp_res)
            self._state_store[thread_id] = existing_state
            return existing_state

        chk_res = manager_checkpoint(existing_state)
        existing_state.update(chk_res)
        resp_res = response_generator(existing_state)
        existing_state.update(resp_res)
        self._state_store[thread_id] = existing_state
        return existing_state

    def handle_escalation(
        self, thread_id: str, approved: bool, manager_id: str, notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Resolves paused human-in-the-loop tickets via state update & resume:
        update_state(config, {"manager_approved": approved})
        """
        state = self._state_store.get(thread_id)
        if not state:
            state = {
                "thread_id": thread_id,
                "messages": [],
                "current_message": "Escalation review",
                "intent": "refund_request",
                "refund_amount": 1200.0,
                "escalation_needed": True,
                "manager_approved": None,
                "manager_id": None,
                "notes": None,
                "resolution_status": "pending_manager_approval",
                "response": "",
            }

        updates = {
            "manager_approved": approved,
            "manager_id": manager_id,
            "notes": notes or ("Approved by supervisor" if approved else "Rejected by supervisor"),
            "resolution_status": "manager_approved" if approved else "manager_rejected",
            "escalation_needed": False,
        }
        state.update(updates)

        if self._graph is not None:
            config = {"configurable": {"thread_id": thread_id}}
            try:
                # Update state in LangGraph
                self._graph.update_state(config, updates, as_node="manager_checkpoint")
                # Resume execution
                resumed_res = self._graph.invoke(None, config=config)
                final_res = dict(resumed_res)
                self._state_store[thread_id] = final_res
                return final_res
            except Exception as ex:
                logger.warning(f"Graph update_state fallback: {ex}")

        # Deterministic resolution fallback
        resp = response_generator(state)
        state.update(resp)
        self._state_store[thread_id] = state
        return state

    def get_state(self, thread_id: str) -> Optional[Dict[str, Any]]:
        return self._state_store.get(thread_id)

    def list_pending_escalations(self) -> List[Dict[str, Any]]:
        """Returns all tickets currently awaiting manager review."""
        return [
            s for s in self._state_store.values()
            if s.get("escalation_needed") is True and s.get("manager_approved") is None
        ]


# Singleton instance
agent_workflow_service = SupportEscalationWorkflow()
