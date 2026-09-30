# RAMSport — Release R01

> **RAMSport_R01** · Reliability, Availability, Maintainability & Safety (RAMS) engineering workbench for rail and high-reliability systems.

A single-server **Next.js 16** platform (frontend + API in one process) covering the RAMS lifecycle: component data capture, reliability block diagrams, fault tree analysis and risk assessment.

## Live Deployment

**https://ramsport.vercel.app**

| Page | URL |
|------|-----|
| Data Register | https://ramsport.vercel.app/ |
| RBD Sheet (IEC 61078) | https://ramsport.vercel.app/rbd |
| FTA Sheet (IEC 61025) | https://ramsport.vercel.app/fta |

## Standards Coverage

| Standard | Scope | Module |
|----------|-------|--------|
| **EN 50126** | RAM prediction & lifecycle | Data Register |
| **IEC 61078** | Reliability Block Diagrams (Markov parallel, r-out-of-n) | RBD Sheet |
| **IEC 61025** | Fault Tree Analysis (MOCUS, rare-event quantification, Vesely importance) | FTA Sheet |
| **MIL-STD-882E** | System safety risk assessment | Risk |

## Features

- **Data Register** — Register and manage components/LRUs with all 9 reliability factors (λ, MTBF, MTTR, Op Time, Repair, FIT, FPMH)
- **RBD Sheet** — Drag-and-drop circuit builder with series/parallel topology detection and live worksheet formulas
- **FTA Sheet** — Tree builder with minimal cut sets and top-event quantification
- **Backend Analysis** — All reliability formulas computed server-side
- **Real-time Results** — MTBF, MTTR, λ and Availability with step-by-step breakdown
- **Enterprise Shell** — Dark mode, workspace save, auto-save, branded icon set

## Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **Language:** TypeScript
- **UI:** React 19, Tailwind CSS 4
- **API:** Next.js Route Handlers (`/api/components`)
- **Hosting:** Vercel (serverless, region `sin1`)

## Local Development

```bash
cd RAMspace_Base_UI
npm install
npm run dev     # http://localhost:3000
```

### Production build (standalone)

```bash
cd RAMspace_Base_UI
npm install
npm run build
npm run start:standalone   # or: node .next/standalone/server.js
```

### One-click launchers

| File | Purpose |
|------|---------|
| `RAMSport_Win.bat` | Windows quick start (no Docker) |
| `RAMSport_Docker.bat` | Windows Docker Desktop launcher |
| `RAMSport_Termux.sh` | Android Termux launcher |
| `RAMspace_Base_UI/start.bat` | Interactive launcher (prod / dev / test) |
| `RUN_TESTS.bat` / `run-tests.sh` | Run API + UI test suites |

## Docker

```bash
docker build -t ramsport .
docker run --name ramsport -p 3000:3000 ramsport
```

## Repository Layout

```
RAMSport_R01/
├── RAMspace_Base_UI/          # Next.js application
│   ├── app/                   # App Router pages + /api/components
│   ├── components/            # DataRegister, RBDSheet, FTASheet, ComingSoon
│   ├── lib/
│   ├── test-api.mjs           # API test suite (port 3101)
│   └── verify-ui.mjs          # UI test suite (port 3102)
├── Dockerfile
├── RAMSport_Win.bat
├── RAMSport_Docker.bat
├── RAMSport_Termux.sh
├── RUN_TESTS.bat
├── run-tests.sh
└── HOW-TO-RUN.md
```

## Tests

```bash
cd RAMspace_Base_UI
npm run build
npm run test:api   # API assertions
npm run test:ui    # SSR + client bundle assertions
```

## Data Persistence

Component data is held in memory and mirrored to `components.json` when the filesystem is writable. On read-only serverless filesystems (e.g. Vercel) the in-memory store is used, so the session-scoped dataset still works.
