# RAMSport structure

Files are grouped **by type first, then by function**. You can find any file by asking
"what is it?" (a component, an engine, a service, data, a helper, a stylesheet) and then
"what is it for?" (auth, RBD, FTA, reporting, layout…).

```
.
├─ src/
│  ├─ app/                          ROUTES — Next.js App Router, no logic
│  │  ├─ layout.tsx                 Root layout, imports @/styles/globals.css
│  │  ├─ (auth)/
│  │  │  └─ page.tsx                "/" sign-in page
│  │  └─ (workspace)/
│  │     ├─ dashboard/page.tsx      "/dashboard"
│  │     ├─ data-register/page.tsx  "/data-register"
│  │     ├─ rbd/page.tsx            "/rbd"
│  │     ├─ fta/page.tsx            "/fta"
│  │     └─ admin/page.tsx          "/admin" (administrators only)
│  │
│  ├─ styles/                       STYLES — all CSS in one place
│  │  ├─ globals.css                Base tokens, login, shell (imports the two below)
│  │  ├─ professional.css           Refined shell and admin styles
│  │  └─ workbench.css              Canvas, diagram and workbench styles
│  │
│  ├─ components/                   COMPONENTS — React, presentation
│  │  ├─ auth/LoginScreen.tsx       Sign-in screen
│  │  ├─ layout/AppShell.tsx        Sidebar, topbar, session guard
│  │  ├─ rbd/DiagramEditor.tsx      Block diagram canvas
│  │  ├─ fta/FTAEditor.tsx          Fault tree canvas
│  │  ├─ reporting/ExportDialog.tsx PDF, Excel, PowerPoint, Word export
│  │  └─ ui/                        shadcn primitives (button, input, sidebar…)
│  │
│  ├─ engine/                       ENGINE — pure TypeScript, no React, no DOM
│  │  ├─ reliability.ts             Availability, MTBF, failure rates
│  │  ├─ rbd.ts                     Series, parallel, K-out-of-N analysis
│  │  ├─ rbd-routing.ts             Orthogonal connector routing
│  │  ├─ fta.ts                     Gate logic and probability
│  │  └─ canvas-zoom.ts             Zoom and grid maths
│  │
│  ├─ services/                     SERVICES — state and persistence
│  │  └─ auth/
│  │     ├─ session.ts              Session, storage keys, legacy migration
│  │     └─ users.ts                User directory, PBKDF2, admin bootstrap
│  │
│  ├─ data/                         DATA — stored models and content
│  │  ├─ workspace.ts               Assets, diagrams, groups, localStorage
│  │  └─ projects.ts                Project portfolio content
│  │
│  └─ lib/                          LIB — small shared helpers
│     ├─ base-path.ts               Base path for GitHub Pages builds
│     ├─ icons.tsx                  Icon set
│     ├─ utils.ts                   cn() helper
│     └─ use-mobile.ts              Viewport hook
│
├─ scripts/
│  ├─ build-pages.mjs               Export with NEXT_PUBLIC_BASE_PATH=/<repo>
│  └─ serve-out.mjs                 Serve out/ the way a static host does
├─ .github/workflows/deploy-pages.yml  Build and publish to GitHub Pages
├─ reference/agndex-dashboard/      Design reference, excluded from the build
├─ public/                          Static assets copied into the export (.nojekyll, icon)
├─ docs/
│  ├─ STRUCTURE.md                  This file
│  ├─ DEPLOY.md                     Vercel and GitHub Pages instructions
│  ├─ CHECKLIST.md                  Release gates
│  └─ todolist.md                   Open items
├─ out/                             Static export output (generated, gitignored)
├─ RUN.bat                          One-click start on Windows
└─ README.md                        Entry point
```

Root-level config files (`package.json`, `tsconfig.json`, `next.config.ts`,
`components.json`, `vercel.json`, `.env.example`) must stay at the root so the tools
find them.

## Where do I put a new file?

| If it is… | It goes in | Example |
|---|---|---|
| A new page or URL | `src/app/(workspace)/<name>/page.tsx` | `src/app/(workspace)/fmeca/page.tsx` |
| A React component | `src/components/<feature>/` | `src/components/fmeca/FmecaTable.tsx` |
| A calculation, pure function | `src/engine/` | `src/engine/fmeca.ts` |
| Reading/writing stored data, accounts, sessions | `src/services/<area>/` | `src/services/reports/` |
| Static content or a typed model | `src/data/` | `src/data/templates.ts` |
| A generic helper used everywhere | `src/lib/` | `src/lib/format.ts` |
| CSS | `src/styles/` | `src/styles/print.css` |
| A shadcn primitive | `src/components/ui/` | `npx shadcn add dialog` |

## Rules

- `src/app` holds routing only. A page renders a component; it does not calculate or
  touch storage itself.
- `src/engine` is pure TypeScript — no React, no `window`, no `localStorage`. It is the
  part that is easy to unit test.
- `src/services` and `src/data` are the only places that touch `localStorage`, and every
  key is namespaced with `accountStorageKey(...)` from `services/auth/session.ts`.
- `src/components` may import from `engine`, `data`, `services` and `lib`.
  `engine`, `data`, `services` and `lib` must never import from `components`.
- Imports use the `@/*` alias, which maps to `src/*`: `@/engine/rbd`,
  `@/services/auth/session`, `@/components/ui/button`.
- `reference/` is outside `src` and excluded in `tsconfig.json`, so design material can
  never enter the shipped bundle.

## Adding a route

1. Create `src/app/(workspace)/<name>/page.tsx`.
2. Wrap the content in `<AppShell title="…" eyebrow="…">`.
3. Add the entry to the `nav` array in `src/components/layout/AppShell.tsx`.

## Adding a stored data type

1. Add the type and read/write helpers to `src/data/workspace.ts`.
2. Key it with `accountStorageKey(...)` so it stays isolated per account.
3. Dispatch an update event if other components need to react.
