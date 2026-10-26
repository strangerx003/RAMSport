# RAMSport

Reliability, availability, maintainability and safety workbench for RBD and FTA analysis.

## Start

**Double-click `RUN.bat`.**

It checks that Node.js is installed, installs the pinned dependencies on the first run,
starts the app and opens <http://localhost:3000/>. Keep the **RAMSport Server** window
open while you work; close it to stop the app. Running `RUN.bat` again while it is already
open simply brings the browser back to the running app.

## Sign in

- Administrator: `siva905` — the built-in account opens `/admin` directly.
- Administrators create and remove users from the **Admin** tab in the sidebar.
- Everyone else signs in with the username and password an administrator gave them.

Accounts and all engineering data live in the browser's `localStorage`, so they are scoped
to the machine, browser and web address where they were created. See
[docs/todolist.md](docs/todolist.md) for the open decisions around a shared backend.

## Deploy

RAMSport builds to plain static files, so it runs on Vercel and GitHub Pages without a
server. Both hosts are already configured; see [docs/DEPLOY.md](docs/DEPLOY.md).

## Structure

See [docs/STRUCTURE.md](docs/STRUCTURE.md). Files are grouped by type, then by function:

- `src/app` — routes only
- `src/styles` — all CSS
- `src/components` — React components: `auth`, `layout`, `rbd`, `fta`, `reporting`, `ui`
- `src/engine` — pure calculation and geometry, no React
- `src/services` — sessions and the user directory
- `src/data` — stored models and project content
- `src/lib` — base path, icons, class helper, viewport hook
- `scripts/` — export and preview helpers for deployment
- `reference/` — design reference, excluded from the build

## Documentation

| File | Contents |
|---|---|
| [docs/STRUCTURE.md](docs/STRUCTURE.md) | Folder map and where new files belong |
| [docs/DEPLOY.md](docs/DEPLOY.md) | Vercel and GitHub Pages setup |
| [docs/CHECKLIST.md](docs/CHECKLIST.md) | Release gates |
| [docs/todolist.md](docs/todolist.md) | Open decisions and known limitations |
