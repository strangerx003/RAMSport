# RAMSport

RAMSport is a workbench for Reliability, Availability, Maintainability and Safety engineering. The application combines asset data, reliability block diagrams and fault-tree analysis in one Next.js workspace.

## Included modules

- **Temporary login** — evaluation access for the current development phase.
- **Dashboard** — portfolio KPIs, project health, assurance actions and recent activity.
- **Data Register** — Excel-style editable asset register with computed MTBF, FIT and availability, local save and CSV export.
- **RBD Workspace** — Office-inspired ribbon, component palette, draggable blocks, straight/elbow connectors and reliability properties.
- **FTA Workspace** — event and gate palette, draggable fault tree, connectors and analysis properties.
- **Components API** — validated `GET`, `POST` and `DELETE` route at `/api/components`.
- **Professional exports** — client-ready PDF reports, editable Excel workbooks and Word reports with document-control metadata, project information, branded headers and pagination.

## Standards context

| Standard | Module |
| --- | --- |
| EN 50126 | RAM lifecycle and Data Register |
| IEC 61078 | Reliability Block Diagram |
| IEC 61025 | Fault Tree Analysis |
| MIL-STD-882E | Safety and risk context |

## Run locally

```bash
cd RAMspace_Base_UI
npm install
npm run dev
```

Open `http://localhost:3000` and sign in to access the workspace.

## Production build

```bash
cd RAMspace_Base_UI
npm install
npm run build
npm run start:standalone
```

Windows users can double-click `START_RAMSPORT.bat`. It validates Node.js, installs missing dependencies, starts the production server, and opens `http://localhost:3000/login` automatically.

## Tests

```bash
cd RAMspace_Base_UI
npm test
```

From the repository root, use `bash run-tests.sh` on Linux, macOS, or Termux. On Windows, run `npm.cmd test` from `RAMspace_Base_UI`.

## Docker

```bash
docker build -t ramsport .
docker run --name ramsport -p 3000:3000 ramsport
```

## Current persistence model

The test login session and Data Register edits are stored in browser local storage. The API uses process memory. Replace both with production identity and durable database storage before using the application for controlled engineering records.
