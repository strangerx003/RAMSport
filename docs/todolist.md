# RAMSport — Todo List

Open items after removing Clerk and adding the admin user directory.

## Decisions needed

- [ ] **Choose where accounts live.** Today the user list is stored in the browser
      (`localStorage` key `ramsport-users`) because the app has no backend. Decide between
      keeping browser-only accounts or adding a small server with a database.
- [ ] **Decide whether users must work across devices.** With the current design, a user
      created by the admin on one PC cannot sign in from another PC or browser.
- [ ] **Decide how much trust to place in the client.** Anyone with browser developer tools
      can read or edit the stored user list and the saved engineering data.

## Known limitations

- [ ] The user directory is stored in that browser only; it is not shared or synced.
- [ ] The built-in administrator (`siva905`) is stored as a PBKDF2 hash, but that hash ships
      inside the JavaScript bundle, so it is discoverable by anyone who reads the code.
- [ ] `/admin` protection is client-side only. A standard user is redirected, but there is no
      server to enforce the rule.
- [ ] There is no password reset, no account lockout and no audit log of admin actions.

## Follow-ups

- [ ] Add a small script to generate a new PBKDF2 salt/hash pair for changing the built-in
      administrator password, instead of editing a plain string.
- [ ] If a backend is added, move authentication, the user list and account data server-side,
      keep the user table and sessions server-owned, and hash passwords there as well.
- [ ] If a backend is added, enforce account isolation on the server for every record rather
      than relying on browser storage keys.
- [ ] Update `docs/CHECKLIST.md` gate 4 when the authentication model changes again.

## Completed

- [x] Removed Clerk entirely: package, middleware (`proxy.ts`), sign-in/sign-up routes,
      `AuthPanel` component, `.clerk/` directory and Clerk environment variables.
- [x] Restored the original login page design and the original static export build.- [x] Added admin credential sign-in (`siva905` / `siva905`) that routes to `/admin`.
- [x] Added an Admin tab for administrators only.
- [x] Added user management: create users, assign access level, list accounts, remove users.
- [x] Stored passwords as PBKDF2-SHA256 hashes with a per-user salt, never plaintext.
- [x] Guarded `/admin` so standard users are sent to `/dashboard`.
- [x] Migrated data saved under the previous credential hash to the new account id on first
      sign-in.
- [x] Verified wrong-password rejection, admin login, user creation, standard-user login,
      admin route guard and session persistence after refresh.
- [x] Build passes with `/`, `/admin`, `/dashboard`, `/data-register`, `/fta` and `/rbd`
      emitted as static routes.
- [x] Reorganised the code under `src/` by type and function: `app`, `styles`,
      `components`, `engine`, `services`, `data`, `lib`, with `scripts/` and `docs/` beside
      them and `reference/` kept out of the build.
- [x] Configured both hosts: Vercel builds at the domain root, GitHub Pages builds under
      `/<repo>/` through `NEXT_PUBLIC_BASE_PATH` and the Pages workflow.
- [x] Added `build:pages` and `preview` helpers so the exported site can be checked at the
      same path it will be served from.
- [x] Stopped tracking build output (`out/`) and the local `.vercel/` folder.
