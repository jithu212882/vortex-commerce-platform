# Vortex Commerce Platform & Enterprise Operations

An enterprise-grade, high-craft commercial e-commerce platform and operations dashboard architected with **FastAPI**, **Sentence-Transformers (`all-MiniLM-L6-v2`)**, **Ultralytics YOLOv8n**, **LangGraph**, **SQLAlchemy**, **Tailwind CSS**, and **Pydantic v2**.

Repository: **[https://github.com/jithu212882/vortex-commerce-platform](https://github.com/jithu212882/vortex-commerce-platform)**

The system delivers an editorial, physical product experience inspired by Apple Store, Nothing.tech, and Bang & Olufsen—featuring a warm architectural stone palette, fluid spring transitions, automatic hero carousel merchandising, and dual-surface product architecture.

---

## 1. System Architecture

```text
vortex-commerce-platform/
├── Dockerfile                  # Multi-stage Debian slim container with OpenCV dependencies
├── docker-compose.yml          # Live dev volume mounting & port 8000:8000 binding
├── .dockerignore               # Optimized Docker build context exclusions
├── requirements.txt            # Python dependencies (FastAPI, PyTorch, LangGraph, etc.)
├── README.md                   # Architectural and operational manual
├── recsys.db                   # SQLite catalog (215 SKUs) & user telemetry store
├── push_updates.ps1            # Automated test, commit, and GitHub push automation
└── app/
    ├── __init__.py             # App package entrypoint
    ├── main.py                 # FastAPI application & static mount entrypoint
    ├── core/
    │   ├── __init__.py         # Core package exports
    │   └── config.py           # App settings, thresholds ($1K refund limit), model configs
    ├── models/
    │   ├── __init__.py         # Model package exports
    │   └── schemas.py          # Strict Pydantic v2 telemetry, chat, & escalation schemas
    ├── database/
    │   ├── __init__.py         # Database package exports
    │   ├── connection.py       # SQLAlchemy ORM (Item, UserActivity) & DB session helpers
    │   ├── seed_data.py        # Seed script with DummyJSON API & offline fallback catalog
    │   └── seed_orders.py      # Seed orders for testing customer returns & tracking
    ├── services/
    │   ├── __init__.py         # Services package exports
    │   ├── recommender.py      # Dense vector recommender with dwell-time scoring
    │   ├── vision_service.py   # YOLOv8n primary object crop & preprocessing
    │   └── agent_workflow.py   # Stateful LangGraph with MemorySaver & manager gates
    ├── api/
    │   ├── __init__.py         # API router package exports
    │   └── routes.py           # REST endpoints (/recommend/dwell, /search/visual, /admin/telemetry, etc.)
    └── static/
        ├── storefront.html     # Flagship consumer storefront with auto-hero carousel
        ├── product.html        # Comprehensive product detail page & vector similar items
        ├── orders.html         # Dedicated customer order tracking & return initiator
        ├── account.html        # Account profile, security & preferences management
        ├── admin.html          # High-density engineering & operations cockpit
        ├── storefront.js       # Client: carousel autoplay, dwell tracking & visual search
        ├── product.js          # PDP interactions, gallery zoom & recommendations
        ├── orders.js           # Order queries, return dispatch & status updates
        ├── account.js          # Profile state management & preferences sync
        ├── admin.js            # Admin client: telemetry feeds & LangGraph policy gates
        └── styles.css          # Warm architectural design tokens & mobile-native CSS rules
```

---

## 2. Platform Experiences & Interfaces

### A. Consumer Storefront (`/`)
- **Flagship Merchandising:** Multi-slide auto-rotating hero carousel (Sony acoustics, Dell workstations, Keychron & Logitech esports gear, modern home lifestyle).
- **Header Integrated Visual Search:** Direct camera trigger in the global search bar enabling one-click image drop and YOLOv8 object detection.
- **Dual-Surface Product Cards:** Deep obsidian `#111111` card boundary with pure `#FFFFFF` interior and raised plinth staging (`#F6F5F2`).
- **Invisible Dwell Telemetry:** Silently measures dwell duration when customers inspect products in the quick-view modal. When closed, dispatches telemetry to `/api/v1/recommend/dwell` to dynamically re-rank "Recommended For You".

### B. Product Detail Page (`/product/{id}`)
- High-resolution imagery with gallery thumbnails, verified stock badges, interactive specifications, and vector-similar complementary items.

### C. Dedicated Customer Orders (`/orders`)
- Real-time order tracking with status timeline, invoice receipts, and automated return initiation wired into LangGraph refund policies.

### D. Customer Account Profile (`/account`)
- User profiles, saved shipping addresses, payment methods, and notification preferences.

### E. Operations & Telemetry Console (`/admin`)
- **System KPIs:** Live p95 API latency, vector search response time, YOLOv8 inference speed, and active SKU counters (215 items).
- **Real-Time Telemetry Feed:** Streaming tabular records of user IDs, item IDs, millisecond dwell times, normalized weights, and query intents.
- **Human-in-the-Loop Policy Gate:** LangGraph escalation queue for refund claims exceeding **$1,000.00**. Direct **Approve Claim** and **Decline Claim** actions update the graph state and release/halt disbursement batches.
- **Visual Detection Inspector:** Visual inspection log displaying uploaded user photos with their detected YOLOv8 bounding boxes `[x1, y1, x2, y2]` and confidence metrics.

---

## 3. Core Technologies & Mathematical Formulation

### A. Dense Recommender with Dwell-Time Telemetry (`app/services/recommender.py`)
Uses dense semantic embeddings via `sentence-transformers` (`all-MiniLM-L6-v2`). All catalog items are encoded as unit-normalized $L_2$ vectors:
$$\|\mathbf{Item\_emb}_i\|_2 = 1.0$$

The scoring engine ranks candidate catalog items according to:
$$\text{FinalScore}(i) = \alpha \cdot \text{CosineSim}(\mathbf{Query\_emb}, \mathbf{Item\_emb}_i) + \beta \cdot \sum_{j} \left[ \min\left(\frac{\text{dwell}_j}{10.0}, 1.0\right) \cdot \text{CosineSim}(\mathbf{Item\_emb}_j, \mathbf{Item\_emb}_i) \right]$$

- **$\alpha$ (Query Weight):** Balances explicit textual search intent (Default = `0.50`).
- **$\beta$ (Telemetry Weight):** Balances implicit interest derived from dwell duration (Default = `0.50`).
- **Dwell Time Saturation:** Scaled linearly and capped at $10.0\text{ seconds}$ ($\min(\text{dwell}_j / 10.0, 1.0)$), ensuring sustained interest saturates at $1.0\times$ without runaway distortion from idle browser tabs.
- **Cold-Start Fallback:** Popularity and categorical constraints when no interactions or queries exist.

### B. Visual Crop & Feature Preprocessing (`app/services/vision_service.py`)
- Employs **Ultralytics YOLOv8n** to detect objects in arbitrary user photograph uploads.
- Filters out background noise, surfaces, or floorboards by extracting the primary candidate bounding box $[x_1, y_1, x_2, y_2]$.
- Returns cropped JPEG byte arrays, confidence scores, detected class labels, and vector-aligned catalog matches.

### C. Stateful Support & Escalation Graph (`app/services/agent_workflow.py`)
Implements a stateful workflow graph with human-in-the-loop escalation gates powered by **LangGraph** with a `MemorySaver` checkpointer:

```text
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
      [manager_checkpoint] (PAUSED via interrupt_before)
         │
         ├── Pauses execution; persists state snapshot to MemorySaver.
         ├── UI displays ticket in "Manager Approval Queue" on /admin.
         ├── Supervisor submits decision via POST /api/v1/support/escalate.
         └── graph.update_state(config, {"manager_approved": approved}) resumes graph.
         │
         ▼
      [response_generator] ──► Emits supervisor approval/rejection audit notice ──► [END]
```

---

## 4. REST API Specification

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `GET /` | `GET` | Serves public consumer storefront (`storefront.html`). |
| `GET /product/{id}` | `GET` | Serves dedicated product detail page (`product.html`). |
| `GET /orders` | `GET` | Serves customer order history and tracking (`orders.html`). |
| `GET /account` | `GET` | Serves customer profile & preferences page (`account.html`). |
| `GET /admin` | `GET` | Serves internal operations & telemetry cockpit (`admin.html`). |
| `GET /api/v1/catalog` | `GET` | Product catalog retrieval with search & category filtering. |
| `GET /api/v1/product/{id}` | `GET` | Single product metadata retrieval. |
| `GET /api/v1/recommend/similar/{id}` | `GET` | Vector cosine-similarity nearest neighbors for a product. |
| `POST /api/v1/recommend/dwell` | `POST` | Dwell-weighted dense recommendations with match breakdown. |
| `POST /api/v1/search/visual` | `POST` | YOLOv8 visual crop extraction and candidate item matching. |
| `POST /api/v1/support/chat` | `POST` | Stateful support ticket chat with LangGraph session checkpointing. |
| `POST /api/v1/support/escalate` | `POST` | Supervisor approval/decline endpoint to resume paused graphs. |
| `GET /api/v1/support/pending` | `GET` | List tickets waiting in the Manager Approval Queue. |
| `GET /api/v1/admin/telemetry` | `GET` | Telemetry payload (activities, latency KPIs, visual inspections). |
| `GET /api/v1/health` | `GET` | Liveness & model readiness check. |

---

## 5. Local Execution & Docker Instructions

### Local Development Environment
1. Activate virtual environment:
   ```powershell
   # Windows PowerShell
   .\.venv\Scripts\Activate.ps1
   ```
2. Run database seed (if starting from empty database):
   ```powershell
   python -m app.database.seed_data
   python -m app.database.seed_orders
   ```
3. Run the automated integration test suite:
   ```powershell
   python tests/test_search_engine.py
   python tests/test_enterprise_e2e.py
   ```
4. Start the FastAPI development server:
   ```powershell
   uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
   ```
5. Access the endpoints:
   - **Storefront:** [http://127.0.0.1:8000/](http://127.0.0.1:8000/)
   - **Product View:** [http://127.0.0.1:8000/product/1](http://127.0.0.1:8000/product/1)
   - **Order History:** [http://127.0.0.1:8000/orders](http://127.0.0.1:8000/orders)
   - **Account Settings:** [http://127.0.0.1:8000/account](http://127.0.0.1:8000/account)
   - **Admin Cockpit:** [http://127.0.0.1:8000/admin](http://127.0.0.1:8000/admin)
   - **Interactive API Docs:** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

### Docker Deployment
```bash
docker-compose up --build -d
```
Check health:
```bash
docker-compose ps
docker logs -f enterprise_recsys_app
```

---

## 6. Continuous Deployment & Git Automation

To test, stage, commit, and push future updates to GitHub in one command:
```powershell
.\push_updates.ps1 -CommitMessage "feat(module): description of update"
```
The script runs the full test suite, commits if tests pass, and pushes to `origin/main` at:
**[https://github.com/jithu212882/vortex-commerce-platform](https://github.com/jithu212882/vortex-commerce-platform)**
