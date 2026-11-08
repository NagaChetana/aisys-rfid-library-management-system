# AISYS Intelligent RFID Library Management System
# DELIVERABLE D4: Source Repository & Licence Inventory (SBOM)

**Standard:** AISYS Software Development SOP Section 7 (Deliverable D4) & NFR04  
**Version:** 1.0.0-rc1  
**Author:** Individual Candidate Implementation  

---

## 1. Source Repository Structure

```text
rfid-lms/
├── .gitignore                     # Excludes runtime DB, WAL, backups, updates, venv, node_modules
├── README.md                      # High-level architecture and quickstart manual
├── VERSION.txt                    # Single source of truth for deployed application version (1.0.0)
├── backend/                       # Python 3.12+ / FastAPI Backend Service
│   ├── app/
│   │   ├── api/                   # REST API Routers (auth, books, circulation, rfid, interop, gate, etc.)
│   │   ├── core/                  # Database engine, session maker, security, config settings
│   │   ├── models/                # SQLAlchemy 2.0 ORM Mapped Entities
│   │   ├── schemas/               # Pydantic v2 Request/Response Data Validation Schemas
│   │   ├── services/              # Business Logic Services (circulation, rules, backup, offline)
│   │   ├── interop/               # NCIP 2.0 and 3M SIP2 Mock Adapter Boundaries
│   │   └── notifications/         # Provider-neutral Email/SMS notification adapters
│   ├── tests/                     # Pytest automated test suites (Batches 1 to 4)
│   ├── main.py                    # FastAPI entrypoint and lifespan manager
│   ├── seed_data.py               # Deterministic synthetic seed data generator
│   └── requirements.txt           # Pinned Python package dependencies
├── frontend/                      # React 18 / TypeScript / Vite Frontend Application
│   ├── src/
│   │   ├── components/            # Shared UI components (Layout, Sidebar, Modal, Badge)
│   │   ├── context/               # React AuthContext (JWT & Smart Card session state)
│   │   ├── pages/                 # Full feature views (Dashboard, Catalog, Circulation, Gate, etc.)
│   │   ├── services/              # API Client fetch functions and SSE EventSource stream
│   │   └── types/                 # Shared TypeScript interfaces and data models
│   ├── index.html                 # HTML shell
│   ├── package.json               # Frontend dependencies and npm scripts
│   ├── tsconfig.json              # Strict TypeScript compiler options
│   └── vite.config.ts             # Vite dev server and proxy configuration
├── dist/                          # Windows Server / Windows 11 Deployment Artifacts
│   └── aisys-rfid-lms-windows-x64/
├── docs/                          # SOP Deliverables D1 through D9 & assignment references
└── scripts/                       # Operational automation tools (offline_manager.py, start, stop)
```

---

## 2. Version Control & Git Commit Strategy

The project adheres to a four-batch engineering progression:
- **Batch 1 (Commit `670f30c`):** Scaffold, WAL database, Auth/RBAC, catalog, physical copies, members, and executive dashboard.
- **Batch 2 (Commit `315836d`):** Circulation engine, business rules engine, RFID encoding, virtual reader simulator, and NCIP/SIP2 mock adapters.
- **Batch 3 (Commit `6caf57f`):** Handheld inventory management with audio cues, dual-pedestal security gate with mock CCTV still capture, SSE event pipeline, notification queue, and 20k CSV migration with scoped rollback.
- **Batch 4 (Final Acceptance & Delivery):** Complete acceptance test suite (AC01–AC10), consistent SQLite backup/restore, air-gapped offline update packaging and rollback, Windows deployment bundle, and SOP deliverables D1–D9.

---

## 3. Software Bill of Materials (SBOM) & Licence Inventory (NFR04)

All runtime and development dependencies are open-source and approved for commercial/educational use without proprietary or viral redistribution restrictions.

### Backend Dependencies (Python)
| Package | Version | Licence | Purpose |
|---|---|---|---|
| `fastapi` | 0.115.0 | MIT | High-performance asynchronous REST API framework |
| `uvicorn` | 0.30.6 | BSD-3-Clause | ASGI production web server |
| `pydantic` | 2.9.2 | MIT | Data parsing, type validation, and serialization |
| `pydantic-settings` | 2.5.2 | MIT | Hierarchical environment configuration management |
| `sqlalchemy` | 2.0.35 | MIT | Relational database ORM and transaction management |
| `bcrypt` | 4.2.0 | Apache-2.0 | Direct password hashing and key derivation |
| `pyjwt` | 2.9.0 | MIT | Cryptographic JSON Web Token (JWT) creation/verification |
| `pytest` | 8.3.3 | MIT | Test framework and test runner |
| `httpx` | 0.27.2 | BSD-3-Clause | Synchronous and asynchronous HTTP client for tests |

### Frontend Dependencies (TypeScript / Node.js)
| Package | Version | Licence | Purpose |
|---|---|---|---|
| `react` | 18.3.1 | MIT | Declarative component UI library |
| `react-dom` | 18.3.1 | MIT | DOM rendering for React |
| `typescript` | 5.5.3 | Apache-2.0 | Static type safety and compiler |
| `vite` | 5.4.2 | MIT | Fast frontend build tool and dev server |
| `tailwindcss` | 3.4.11 | MIT | Utility-first CSS styling framework |
| `lucide-react` | 0.446.0 | ISC | Scalable icon library |
| `recharts` | 2.12.7 | MIT | Composable data visualization charts |
