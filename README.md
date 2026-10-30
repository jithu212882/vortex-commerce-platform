# Enterprise E-Commerce Recommender & Customer Operations Platform

A production-grade, high-density enterprise e-commerce recommendation engine and operations desk architected with **FastAPI**, **Sentence-Transformers (`all-MiniLM-L6-v2`)**, **Ultralytics YOLOv8n**, **LangGraph**, **SQLAlchemy**, and **Pydantic v2**.

All user interfaces strictly comply with utilitarian, enterprise B2B SaaS design standards (patterned after **Stripe Dashboard**, **Linear**, and **AWS Management Console**) with zero decorative AI tropes, glowing borders, or neon artifacts.

---

## 1. System Architecture

```
d:/USer REccomendation/
├── Dockerfile                  # Multi-stage Debian slim container with OpenCV libs
├── docker-compose.yml          # Live dev volume mounting & port 8000:8000 binding
├── .dockerignore               # Optimized Docker build context exclusions
├── requirements.txt            # Python dependencies (FastAPI, PyTorch, LangGraph, etc.)
├── README.md                   # Complete architectural and operational manual
├── recsys.db                   # SQLite catalog (194 products) & user telemetry store
└── app/
    ├── __init__.py
    ├── main.py                 # FastAPI application & static mount entrypoint
    ├── core/
    │   ├── __init__.py
    │   └── config.py           # App settings, thresholds ($1K refund limit), model configs
    ├── models/
    │   ├── __init__.py
    │   └── schemas.py          # Strict Pydantic v2 telemetry, chat, & escalation schemas
    ├── database/
    │   ├── __init__.py
    │   └── connection.py       # SQLAlchemy ORM (Item, UserActivity) & seed handlers
    ├── services/
    │   ├── __init__.py
    │   ├── recommender.py      # Dense vector recommender with dwell-time scoring
    │   ├── vision_service.py   # YOLOv8n primary object crop & preprocessing
    │   └── agent_workflow.py   # Stateful LangGraph with MemorySaver & manager gates
    ├── api/
    │   ├── __init__.py
    │   └── routes.py           # REST API endpoints (/recommend/dwell, /search/visual, etc.)
    └── static/
        ├── index.html          # Two-column Enterprise Catalog & Operations Desk UI
        ├── styles.css          # Stripe/Linear neutral border styling (#E2E8F0, #1E293B)
        └── app.js              # Millisecond dwell logger, YOLO inspection & ticket queues
```

---

## 2. Core Modules & Mathematical Specifications

### A. Dense Recommender with Dwell-Time Telemetry (`app/services/recommender.py`)
Replaces legacy TF-IDF with dense semantic embeddings via `sentence-transformers` (`all-MiniLM-L6-v2`).
All catalog items are encoded as unit-normalized $L_2$ vectors:
$$\|\mathbf{Item\_emb}_i\|_2 = 1.0$$

The scoring engine ranks candidate catalog items according to:
$$\text{FinalScore}(i) = \alpha \cdot \text{CosineSim}(\mathbf{Query\_emb}, \mathbf{Item\_emb}_i) + \beta \cdot \sum_{j} \left[ \min\left(\frac{\text{dwell}_j}{10.0}, 1.0\right) \cdot \text{CosineSim}(\mathbf{Item\_emb}_j, \mathbf{Item\_emb}_i) \right]$$

- **$\alpha$ (Query Weight)**: Balances explicit textual or keyword search intent. Default = `0.50`.
- **$\beta$ (Telemetry Weight)**: Balances implicit behavioral interest derived from dwell duration. Default = `0.50`.
- **Dwell Time Saturation**: Scaled linearly and capped at $10.0\text{ seconds}$ ($\min(\text{dwell}_j / 10.0, 1.0)$), ensuring sustained interest saturates at $1.0\times$ without runaway score distortion from idle browser tabs.
- **Cold-Start Fallback**: When neither queries nor interactions are present, items are ranked via catalog popularity and categorical/price constraints.

### B. Visual Crop & Object Preprocessing (`app/services/vision_service.py`)
- Employs **Ultralytics YOLOv8n** to detect objects in arbitrary user photograph uploads.
- Filters out non-relevant background noise, floorboards, or table surfaces by extracting the primary candidate bounding box $[x_1, y_1, x_2, y_2]$.
- Returns cropped JPEG byte arrays, confidence scores, detected class labels, and vector-aligned catalog matches.

### C. Stateful Support & Escalation Graph (`app/services/agent_workflow.py`)
Implements a stateful workflow graph with human-in-the-loop escalation gates powered by **LangGraph** with a `MemorySaver` checkpointer:

```
[START]
   │
   ▼
[intent_triage] ───► Parses text into: "refund_request", "catalog_query", or "general_inquiry"
   │
   ▼
[policy_validator] ─► Evaluates refund amount vs. $1,000.00 Enterprise Policy Threshold
   │
   ├─ If amount <= $1,000.00: Auto-approves ticket (manager_approved = True)
   │     │
   │     ▼
   │  [response_generator] ──► Generates payment settlement response ──► [END]
   │
   └─ If amount > $1,000.00: Flags escalation_needed = True
         │
         ▼
      [manager_checkpoint] (INTERRUPTED BEFORE EXECUTION: interrupt_before)
         │
         ├── Pauses execution; persists state snapshot to MemorySaver.
         ├── UI displays ticket in "Manager Approval Queue".
         ├── Supervisor submits decision via POST /api/v1/support/escalate.
         └── graph.update_state(config, {"manager_approved": approved}) resumes graph.
         │
         ▼
      [response_generator] ──► Emits supervisor approval/rejection audit notice ──► [END]
```

---

## 3. REST API Specification

### 1. Dwell-Weighted Recommendation
`POST /api/v1/recommend/dwell`
```json
{
  "user_id": "usr_ops_842",
  "query_text": "ergonomic keyboard for coding",
  "recent_interactions": [
    { "product_id": 3, "dwell_time_seconds": 14.25 },
    { "product_id": 6, "dwell_time_seconds": 6.80 }
  ],
  "top_k": 5
}
```

### 2. Visual Feature Search
`POST /api/v1/search/visual`
- Header: `Content-Type: multipart/form-data`
- Body: `file` (image binary), `top_k: 5`
- Returns: `detection_found`, `bounding_box` (`x1`, `y1`, `x2`, `y2`, `confidence`, `label`), and matched candidate items.

### 3. Customer Operations Ticket Chat
`POST /api/v1/support/chat`
```json
{
  "thread_id": "ticket_ops_104",
  "message": "Requesting immediate refund of $1,450 for defective office workstation."
}
```

### 4. Human-in-the-Loop Escalation Resolution
`POST /api/v1/support/escalate`
```json
{
  "thread_id": "ticket_ops_104",
  "approved": true,
  "manager_id": "MGR_OPS_SUPERVISOR",
  "notes": "Verified return shipping receipt. Refund authorized under Tier-2 exception."
}
```

### 5. Catalog Inspection
`GET /api/v1/catalog?category=electronics&limit=20`

### 6. Health & Readiness Probe
`GET /api/v1/health`

---

## 4. Local Execution & Docker Instructions

### Local Development Environment
1. Activate the Python virtual environment:
   ```powershell
   # Windows PowerShell
   .\.venv\Scripts\Activate.ps1
   ```
2. Start the FastAPI server with live reload:
   ```powershell
   uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
   ```
3. Open the **Enterprise Catalog & Operations Desk** in your browser:
   - Dashboard: [http://127.0.0.1:8000/](http://127.0.0.1:8000/)
   - Interactive Swagger API Docs: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
   - ReDoc: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)

### Docker Deployment
Build and run using Docker Compose:
```bash
docker-compose up --build -d
```
Inspect container health:
```bash
docker-compose ps
docker logs -f enterprise_recsys_app
```

---

## 5. Enterprise B2B SaaS Design Rules Checklist

- [x] **Neutral High-Density Borders**: Clean 1px `#E2E8F0` / `#1E293B` borders.
- [x] **Monochrome Surfaces**: Clean slate `#F8FAFC` background and crisp solid `#FFFFFF` cards.
- [x] **Deep Corporate Accent**: Enterprise blue `#1D4ED8` and neutral slate `#0F172A`.
- [x] **No AI Tropes**: Zero sparkle emojis, magic pills, iridescent gradients, or floating chatbot avatars.
- [x] **Standard System Labels**: `[STATUS: OPERATIONAL]`, `[POLICY: ESCALATION_GATE]`, `[PROCESSED]`.
- [x] **Audited Telemetry**: Millisecond-accurate modal dwell timer, live bounding-box metrics, and streaming operational event log.

---

## 6. Future Upgrades & Strategic Roadmap

The following planned upgrades and architecture enhancements are scheduled for upcoming release cycles:

### Phase 2: Distributed Vector Search & Multimodal Embeddings
- **Qdrant / Milvus / pgvector Integration**: Transition in-memory catalog vector matrices to a distributed vector database with HNSW indexing for scaling past 10,000,000+ SKU catalogs with sub-10ms latency.
- **Direct Multimodal Embedding Alignment (CLIP / SigLIP)**: Augment YOLOv8n spatial bounding-box extraction with direct visual-textual vector embeddings (`ViT-B/32` or `SigLIP-base-patch16`), enabling cross-modal cosine similarity without relying on discrete taxonomic labels.
- **Dynamic Dwell Weight Optimization**: Implement Thompson Sampling multi-armed bandits to automatically learn user-specific $\alpha$ (query weight) and $\beta$ (dwell weight) balance factors based on downstream conversion and cart additions.

### Phase 3: Enterprise Operations & Governance Scaling
- **Streaming Telemetry Ingestion (Kafka / RabbitMQ / Redis Streams)**: Decouple real-time millisecond dwell telemetry ingestion from synchronous HTTP request cycles using an asynchronous event-streaming pipeline.
- **Multi-Tenant Role-Based Access Control (RBAC)**: Enforce granular enterprise permissions:
  - `OPERATOR`: Catalog view, interaction logging, and customer chat.
  - `SUPERVISOR`: Policy threshold overrides and manager approval gate resolution.
  - `AUDITOR`: Read-only compliance review of cryptographic transaction logs.
- **Persistent LangGraph State Checkpointers**: Upgrade from in-memory `MemorySaver` to PostgreSQL / Redis Checkpointers for multi-replica, fault-tolerant workflow state synchronization across container clusters.
- **Automated Dispute Resolution Workflows**: Extend LangGraph policy nodes to integrate directly with Stripe Chargebacks and banking dispute APIs for automated receipt verification and tracking number validation.

### Phase 4: Git Maintenance & Future Update Workflow
To push updates and synchronize changes with the remote Git repository:
1. Ensure the local virtual environment is active and test suite passes:
   ```powershell
   & "d:\USer REccomendation\.venv\Scripts\python.exe" "d:\USer REccomendation\tests\test_enterprise_e2e.py"
   ```
2. Stage and commit updates using Conventional Commits:
   ```powershell
   git add .
   git commit -m "feat(module): description of feature or enhancement"
   ```
3. Push to the designated remote repository:
   ```powershell
   git push origin main
   ```

