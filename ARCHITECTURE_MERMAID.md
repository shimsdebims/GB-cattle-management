%% Mermaid architecture diagram for Excalidraw / Mermaid support

```mermaid
flowchart LR
  %% Styles
  classDef frontend fill:#f3f6ff,stroke:#3b82f6,stroke-width:2px,color:#1f2937;
  classDef backend fill:#fff7ed,stroke:#f59e0b,stroke-width:2px,color:#92400e;
  classDef db fill:#ecfccb,stroke:#16a34a,stroke-width:2px,color:#064e3b;
  classDef ml fill:#fef2f2,stroke:#ef4444,stroke-width:2px,color:#7f1d1d;
  classDef infra fill:#f0f9ff,stroke:#06b6d4,stroke-width:2px,color:#064e3b;

  subgraph FRONTEND["Frontend (React + TypeScript)"]
    A[User Browser / SPA]
    A -->|Interacts| B[React UI Components]
    B -->|Calls| C[API Client (axios)]
  end
  class A,B,C frontend

  subgraph BACKEND["Backend (Flask REST API)"]
    C --> D[API Gateway (Flask Blueprints)]
    D --> E[Route Handlers]
    E --> F[Business Logic / Aggregations]
    F --> G[ORM (SQLAlchemy)]
  end
  class D,E,F,G backend

  subgraph DATASTORE["Primary Data Storage"]
    G --> H[(Database: SQLite (dev) / Postgres (prod))]
  end
  class H db

  subgraph ANALYTICS["Analytics / Charts"]
    F --> I[Matplotlib & Pandas]
    I -->|Generates| J[Chart images (base64)]
  end
  class I,J infra

  subgraph STREAMLIT["Streamlit (Separate App)"]
    K[Streamlit UI] -. Host separately .-> L[Model artifact (Model/*.pth)]
    K --> M[PyTorch / torchvision]
    M -->|Inference| L
  end
  class K,L,M ml

  B -->|Refresh dashboard| O[Dashboard components]
  O --> F

  H ---|backups / exports| N[Export: CSV / PDF]
  style N fill:#f8fafc,stroke:#94a3b8

```
 

Notes:
- Frontend calls API (axios) to routes exposed by Flask blueprints (cattle, milk, feeding, financial, analytics).
- Backend uses SQLAlchemy ORM to interact with SQLite in development; production should use a managed DB (Postgres) with proper connection strings and migrations.
- Analytics charts are generated server-side via matplotlib/pandas and returned as base64 image payloads that the frontend renders.
- Streamlit (ML app) is external and should be moved to its own repo/service; it depends on heavy PyTorch binaries and a model artifact.

How to use in Excalidraw / Mermaid-compatible editors:
- Paste the mermaid block (between ```mermaid and ```) into an editor that supports Mermaid or Excalidraw plugin with Mermaid.
- Colors and classes are defined to visually separate frontend, backend, DB, and ML components.

-- End of architecture mermaid --
