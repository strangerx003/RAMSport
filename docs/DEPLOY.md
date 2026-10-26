# Deploying RAMSport

RAMSport is a **static export**. `npm run build` writes a self-contained site to `out/`
with no server code, no API routes and no middleware, so it runs on any static host.

There are two supported targets:

| Target | URL shape | Base path |
|---|---|---|
| Vercel | `https://<project>.vercel.app/` | none |
| GitHub Pages (project site) | `https://<user>.github.io/RAMSport/` | `/RAMSport` |

The base path is read from `NEXT_PUBLIC_BASE_PATH` at **build time** (see
`src/lib/base-path.ts`). Leave it unset for Vercel, a custom domain, or a
`<user>.github.io` repository. Set it to `/<repo>` for a GitHub Pages project site.

---

## Vercel

1. Push the repository to GitHub.
2. In Vercel, **Add New → Project → Import** the repository.
3. Framework preset: **Next.js** (detected automatically).
4. Build command `npm run build`, output directory `out/` (detected from
   `output: "export"`). `vercel.json` already sets the command and trailing slashes.
5. Leave `NEXT_PUBLIC_BASE_PATH` unset. Do not add it as a project variable.
6. Deploy.

Every push to the connected branch redeploys. `out/`, `.next/` and `.vercel/` are
gitignored, so only source is uploaded.

### Vercel CLI

```bash
npx vercel          # preview deployment
npx vercel --prod   # production deployment
```

---

## GitHub Pages

The workflow `.github/workflows/deploy-pages.yml` builds the export and publishes it as
a Pages artifact. It runs on every push to `main` or `gh-pages`, and can be started by
hand from the **Actions** tab.

### One-time setup

1. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
   This must be the source; the workflow does not commit to a branch.
2. Push to `main` (or `gh-pages`), or run **Deploy to GitHub Pages** from the Actions tab.
3. The site appears at `https://<user>.github.io/<repo>/`.

The workflow derives the base path from the repository name
(`NEXT_PUBLIC_BASE_PATH=/<repo>`). To override it — for a custom domain, a
`<user>.github.io` repository, or a different path — add a repository **variable** named
`NEXT_PUBLIC_BASE_PATH` under **Settings → Secrets and variables → Actions → Variables**.
Set it to `/` for the domain root.

### Local check before pushing

```bash
npm run build:pages   # builds with NEXT_PUBLIC_BASE_PATH=/<folder-name>
npm run preview       # prints the URL, usually http://localhost:4000/RAMSport/
```

`npm run build:pages` accepts an optional repository name and base path:

```bash
node scripts/build-pages.mjs RAMSport        # /RAMSport
node scripts/build-pages.mjs RAMSport /      # domain root
```

`npm run preview` serves `out/` like a static host, including the custom 404 page and
directory-style URLs (`/rbd/`), so refresh and deep links behave exactly as they will in
production.

---

## What "deployable" means here

- Every route is pre-rendered: `/`, `/dashboard/`, `/data-register/`, `/rbd/`, `/fta/`,
  `/admin/`, plus `404.html`.
- `trailingSlash: true` makes each route a real directory with `index.html`, so direct
  links and refreshes work without rewrite rules.
- `public/.nojekyll` is copied into `out/` so GitHub Pages serves the `_next` folder.
- Assets are referenced through the base path, including the browser icon
  (`/RAMSport/brand-mark.svg` on Pages).
- The sidebar active state strips the base path, so navigation highlighting matches on
  both hosts.

## Accounts and data are per-origin

Sign-in and all engineering data live in `localStorage`. That storage is scoped to the
**origin**, so:

- `https://ramsport.vercel.app` and `https://<user>.github.io` have **separate** user
  directories and separate projects;
- a browser profile that clears storage loses its accounts and data;
- the built-in administrator is seeded again on first load on each new origin.

Nothing to configure for this — just do not expect the same users to appear on both
hosts. `docs/todolist.md` tracks the decision about a shared backend.

## Security notes for a public deployment

- The user directory and password hashes are stored in the browser, and the built-in
  administrator hash ships in the JavaScript bundle. This is a client-side gate, not a
  server-enforced login. Do not store confidential material behind it.
- `/admin` is guarded in the client; a determined visitor can reach the page shell, but
  without a valid admin session it renders nothing and redirects.
- Serve over HTTPS (Vercel and GitHub Pages do this by default) so exported documents
  and password entry are not tampered with in transit.
