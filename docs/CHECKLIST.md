# RAMSport Validator Checklist

This document defines the independent **Validator** role and the mandatory release gates for RAMSport. It is intentionally standalone: application code, build configuration, startup files, and package scripts must not import, execute, or depend on this file.

## When validation is required

Run the applicable checklist before:

- every production deployment;
- every major feature or architecture change;
- changes to RBD or FTA calculation engines;
- changes to diagram connections, routing, gates, persistence, login or account isolation;
- changes to PDF, Excel, PowerPoint or Word exports;
- dependency, framework, hosting or build-configuration upgrades;
- security, privacy or data-storage changes.

Small text-only changes may use the abbreviated gate, but must still pass the build and smoke checks.

## Validator role

The Validator is responsible for verification, evidence and the release verdict. The Validator must:

- validate the delivered behavior against the requested change and existing RAMS functionality;
- inspect only the approved repository and deployment output;
- remain independent from the implementation decision where practical;
- record each applicable item as `PASS`, `FAIL`, `BLOCKED` or `N/A`;
- provide evidence for every critical item, such as a command result, screenshot, exported file or measured value;
- stop the release when a critical item fails;
- report defects with reproduction steps, expected behavior and actual behavior;
- re-run affected checks after a correction.

The Validator must not silently repair main application files while performing validation. Required corrections must be returned to the developer, implemented as a separate change, and then revalidated.

## Release record

Complete this section for every validation run.

- Change or release:
- Commit/build identifier:
- Validation date:
- Validator:
- Target environment:
- Scope reviewed:
- Excluded items and reason:
- Final verdict: `APPROVED` / `REJECTED` / `BLOCKED`
- Evidence location:
- Rollback version:

## 1. Scope and change control

- [ ] The requested behavior and acceptance criteria are written clearly.
- [ ] Changed files are inside the approved RAMSport repository.
- [ ] Unrelated user changes have not been overwritten or removed.
- [ ] No credentials, tokens, private URLs, local paths or `.env` values are included in committed or exported files.
- [ ] New dependencies are necessary, maintained and license-compatible.
- [ ] Removed files are confirmed unused and recoverable from version control.
- [ ] A rollback point or previous working build is identified.

## 2. Build and static-hosting gate — critical

- [ ] TypeScript completes without errors.
- [ ] `npm run build` completes successfully.
- [ ] Every application route is emitted as static content in `out`.
- [ ] `next.config.ts` still uses static export mode.
- [ ] No unsupported server-only feature, API route, middleware, server action, ISR or runtime filesystem write has been introduced.
- [ ] Only the generated static deployment output is uploaded; `node_modules`, `.next`, source maps, logs, tests and local environment files are excluded.
- [ ] Direct loading and browser refresh work for `/`, `/dashboard/`, `/data-register/`, `/rbd/`, `/fta/` and `/admin/`.
- [ ] The custom 404 page works.
- [ ] A base-path build (`npm run build:pages`) serves correctly from `/<repo>/`, including assets, icon, sidebar links and active navigation.
- [ ] Root-hosted and base-path builds are both checked after any change to `next.config.ts`, `src/lib/base-path.ts` or `vercel.json`.
- [ ] `RUN.bat` starts the development server and opens the correct local page on Windows.
- [ ] The source remains usable from a normal terminal on supported Windows and Linux environments.

## 3. Hosting resource budget — critical for production

- [ ] Production output stays within the limits of the chosen hosting plan.
- [ ] Deployment file and directory counts stay within the plan limit.
- [ ] `node_modules` is never uploaded.
- [ ] Initial requests per page are measured and recorded.
- [ ] No unnecessary polling, repeated background requests or automatic refresh loop has been introduced.
- [ ] Navigation prefetching and large assets are reviewed against the hosting request allowance.
- [ ] Images and generated assets are appropriately sized and no large video is deployed with the application.
- [ ] The release record contains output size, file count and directory count.

Recommended project budget:

- static output: under 25 MB;
- estimated deployment files: under 500;
- initial cold requests per page: 15 or fewer;
- background server requests while idle: zero.

Exceeding a recommended budget requires a written justification before release.

## 4. Authentication, privacy and account isolation — critical

- [ ] Login does not display username or password hints.
- [ ] Only accounts created by an administrator can sign in; the built-in administrator reaches `/admin/` automatically.
- [ ] Only administrators see the Admin tab and can add or remove users.
- [ ] A removed user can no longer sign in.
- [ ] Logging out removes the active session.
- [ ] Data Register, RBD and FTA data are isolated by the active account key.
- [ ] Logging into account B does not display or modify account A data.
- [ ] A new test account starts with an empty RBD and FTA.
- [ ] Browser storage contains no plain-text password.
- [ ] No claim of secure cloud storage is made while data is stored only in the browser.
- [ ] If a real backend is introduced, authentication, authorization, encryption, session expiry and server-side account isolation receive a separate security review.

## 5. Data Register

- [ ] The first component begins with serial number 1 and numbering remains sequential.
- [ ] Rows and editable component areas use consistent dimensions.
- [ ] No editable Data Register cell shows browser increment/decrement spinner controls, including Quantity, failure rate, MTTR and operating time.
- [ ] Required fields validate clear numeric ranges and units.
- [ ] Import rejects malformed or unsafe CSV data with a readable error.
- [ ] Imported records do not overwrite unrelated account data without confirmation.
- [ ] Added, edited and deleted components appear immediately in both RBD and FTA component lists.
- [ ] RBD and FTA reference the registered component rather than maintaining unnecessary duplicate component data.

## 6. RBD functional gate — critical

- [ ] A new RBD starts empty.
- [ ] Components can be added by click and drag-and-drop.
- [ ] Each block shows part number, component name, failure rate or MTBF, and MTTR clearly.
- [ ] Connecting-dot hover shows a crosshair.
- [ ] A connection is created only when released on another valid dot.
- [ ] Multiple blocks can connect to the same valid block or port.
- [ ] The selected left/start or right/end port is stored with the connection.
- [ ] Moving either connected block never changes the stored connection side.
- [ ] A connector starts and finishes at the exact center of its selected dots.
- [ ] A connector never crosses, touches, hides beneath or visually passes through any block except at its two selected endpoint dots.
- [ ] Obstructed connectors reroute orthogonally around blocks.
- [ ] Direction arrows never appear at connection endpoints; one arrow appears on an internal segment or immediately before a 90-degree bend.
- [ ] Manual connector adjustment preserves endpoints and system topology.
- [ ] Undo and redo correctly restore blocks, ports, connectors and routing.
- [ ] Calculate reports the overall system failure rate, MTBF, MTTR and availability—not only individual component values.
- [ ] Series, parallel and K-out-of-N configurations produce plausible results and retain the drawn topology after blocks move.
- [ ] The result remains visible in the right-side Result pane.
- [ ] Dragging a marquee selects every intended RBD block without changing connections.
- [ ] Right-clicking a multi-block selection offers Group and asks for a group name.
- [ ] Grouping rejects disconnected selections and calculates the connected subsystem with the existing RBD engine.
- [ ] Collapsing a group preserves all external connection endpoints and removes only its internal connections.
- [ ] A saved group appears above Data Register components, shows equivalent failure rate/MTBF/MTTR, and can be added by click or drag-and-drop.
- [ ] The group shelf shows up to three cards before scrolling and remains usable with more groups.
- [ ] A reusable group participates in overall RBD calculation as one equivalent component.
- [ ] RBD groups remain isolated to the active account and never appear in another account.

## 7. FTA functional gate — critical

- [ ] A new FTA starts empty.
- [ ] The FTA canvas uses the same visible, zoom-aware grid behavior as RBD.
- [ ] Components can be added from the Data Register by click and drag-and-drop.
- [ ] FTA connections flow from lower input events toward the upper output event.
- [ ] AND, OR, XOR and NOT symbols face upward toward their output.
- [ ] Gate symbols are recognizable standard symbols rather than large text blocks.
- [ ] When the first event is connected to another event, the gate-selection dialog appears.
- [ ] Additional inputs to an existing receiving gate reuse that gate without creating another prompt or gate.
- [ ] Right-click can change an existing gate without breaking its connections.
- [ ] Straight versus elbow routing is selected from event placement and remains orthogonal.
- [ ] Direction arrows appear only on internal connector segments and point toward the output event.
- [ ] Calculate evaluates the intended top-event logic and displays probability and applied formula in the right-side Result pane.
- [ ] Gate explanations and formulas are readable in the right pane.

## 8. Canvas, zoom and interaction

- [ ] Default zoom is 100%.
- [ ] Zoom is limited to 20%–200%.
- [ ] Mouse-wheel zoom follows the pointer position over the canvas.
- [ ] Gridlines remain visible and correctly scaled at every supported zoom level.
- [ ] Panning does not move blocks relative to their connectors.
- [ ] Selection, dragging, context menus and connector handles do not conflict.
- [ ] Toolbar icons, controls, labels and fonts use consistent dimensions.
- [ ] The application remains usable at common desktop resolutions and does not hide the result pane.

## 9. Calculation-engine verification — critical

- [ ] Failure-rate, MTBF, MTTR and availability units are consistent.
- [ ] Zero, missing, extremely small and large values are handled without `NaN`, crashes or misleading output.
- [ ] RBD series calculations are checked against an independent hand calculation.
- [ ] RBD redundant-branch calculations are checked against an independent K-out-of-N hand calculation.
- [ ] Applicable K-out-of-N calculations are checked independently.
- [ ] Series uses `λs = Σλi`, `MTTRs = Σ(λi × MTTRi) / λs` and `MTBFs = 1 / λs` from the approved formula sheet.
- [ ] Redundant branches, including 1oo2, are reported as K-out-of-N and use the approved r-out-of-n failure-rate and MTTR equations.
- [ ] FTA AND, OR, XOR and NOT calculations are checked independently.
- [ ] Cyclic, incomplete or disconnected diagrams produce a clear result or warning and do not silently report a valid system result.
- [ ] Moving a block changes presentation only; it does not change calculation topology unless a connector is explicitly added or removed.

## 10. Export gate — critical

Validate PDF, Excel, PowerPoint and Word using both a small diagram and a complex multi-branch diagram.

- [ ] The pre-export preview matches the selected format, orientation and fit option.
- [ ] The output filename follows the module/diagram ID and project-code convention.
- [ ] The document header contains the correct title, project, author and date.
- [ ] Only the diagram, connections, relevant header, result table and selected explanation are exported.
- [ ] Toolbars, component library, result pane, gridlines, selection borders and connector handles are not exported.
- [ ] Every block, label, connector, gate and internal direction arrow is present.
- [ ] Connector routing in the export matches the canvas and does not cross blocks.
- [ ] Text remains readable and is not clipped, blurred or excessively small.
- [ ] Automatic portrait/landscape selection fits the diagram sensibly on A4 output.
- [ ] “Export calculation flow” includes clear block-to-block or gate-to-event explanations and formulas.

### PDF

- [ ] Opens without repair warnings.
- [ ] Diagram content is vector where supported and fits the page.
- [ ] Results table follows the diagram without overlap.
- [ ] Explanation pages paginate correctly.

### Excel

- [ ] Opens without repair warnings.
- [ ] Contains one worksheet only.
- [ ] Diagram appears first, followed by results and optional explanation.
- [ ] Print area, page fit and column widths are readable.

### PowerPoint

- [ ] Opens without repair warnings in a normal 16:9 presentation.
- [ ] Blocks, text, connector segments and arrows are editable objects.
- [ ] Every connector segment remains aligned with its intended block ports.
- [ ] Long explanations are divided across readable slides.

### Word

- [ ] Opens without repair warnings.
- [ ] Diagram is sharp at normal zoom and print size.
- [ ] Results and explanation tables fit the selected orientation.
- [ ] Page breaks do not split headings from their content.

## 11. Security and robustness — critical

- [ ] Server-side row-level authorization is enforced for every account-owned record when a backend is introduced; a user cannot read, change or delete another account's data by altering an identifier (IDOR test).
- [ ] Every API route, server action and protected download verifies authentication and authorization on the server; frontend route guards alone are not accepted as protection.
- [ ] The frontend is treated as untrusted: permissions, account ownership, calculation inputs and export access are revalidated at the trust boundary.
- [ ] Login, import, export, password-reset and other public or sensitive endpoints have appropriate rate limiting and abuse monitoring.
- [ ] All user-supplied text, CSV fields, filenames and diagram labels are validated, normalized and safely rendered; HTML/script injection is rejected or encoded.
- [ ] Database access uses parameterized queries or a safe ORM; user input is never concatenated into a query.
- [ ] CORS permits only documented production origins, methods and headers; wildcard credentials are not enabled.
- [ ] Production is served through HTTPS only, with secure-cookie settings where cookies are used and HTTP-to-HTTPS redirect configured by the host.
- [ ] Production debug mode, verbose error pages, development-only controls and test endpoints are disabled or inaccessible.
- [ ] Public forms have proportionate anti-automation protection (for example CAPTCHA or an equivalent risk-based control) where abuse risk justifies it.
- [ ] Administrative actions are access-controlled and recorded with actor, action, target and timestamp; logs do not contain passwords, tokens or sensitive export data.
- [ ] Storage buckets, uploaded files and generated exports are private by default and are accessible only through account-authorized access paths.
- [ ] Administrative pages and routes require server-side authorization and are not exposed merely by hiding navigation links.
- [ ] Dependencies are checked for known vulnerabilities before release and vulnerable packages are upgraded, removed or have a documented mitigation.
- [ ] Uploaded files are validated by allowlisted type, extension, content signature, size and safe filename; they are not executed or served from a privileged path.
- [ ] An independent security review is completed before a major production release; any AI-assisted review is evidence, not a substitute for accountability.
- [ ] Security response headers are reviewed and enabled where compatible: Content-Security-Policy, frame protections, `X-Content-Type-Options: nosniff`, `Referrer-Policy` and an appropriate permissions policy.
- [ ] Webhook payloads, if introduced, verify a timestamped provider signature before processing and reject replayed or unsigned requests.

- [ ] User-entered text is treated as text and cannot inject HTML, script or spreadsheet formulas.
- [ ] CSV and Excel exports protect cells beginning with `=`, `+`, `-` or `@` when they originate from user input.
- [ ] File imports enforce expected type, size, column names and value limits.
- [ ] Errors do not reveal secrets, local filesystem information or stack traces to users.
- [ ] No external resource is loaded without a documented need.
- [ ] Dependency vulnerabilities and license changes are reviewed before production.
- [ ] Destructive actions require an appropriate confirmation and affect only the active account.
- [ ] Browser developer tools cannot reveal credentials stored by the application.

## 12. Accessibility and UI quality

- [ ] Keyboard focus is visible and follows a logical order.
- [ ] Buttons and icon-only controls have readable labels or accessible names.
- [ ] Dialogs trap focus appropriately and close using Escape where applicable.
- [ ] Text and important diagram elements have sufficient contrast.
- [ ] Status and calculation results are not communicated by color alone.
- [ ] Font sizes and spacing are consistent and readable.
- [ ] Empty, loading, error and success states are clear.

## 13. Production smoke test — critical

- [ ] Open the deployed login page in a clean browser session.
- [ ] Log in using a temporary validation account.
- [ ] Create or import Data Register components.
- [ ] Build, move, calculate and export one RBD.
- [ ] Build, change gates, calculate and export one FTA.
- [ ] Verify all four export files open without warnings.
- [ ] Refresh every route directly and confirm it loads.
- [ ] Confirm there are no unexpected console errors or failed network requests.
- [ ] Confirm there are no idle background network requests.
- [ ] Log out and verify the session is removed.
- [ ] Log in as another temporary account and verify isolation.

## 14. Verdict rules

The Validator may issue `APPROVED` only when:

- all applicable critical items pass;
- non-critical failures have an accepted owner and documented release decision;
- the production build succeeds;
- required evidence is attached;
- rollback information is complete.

Use `REJECTED` when a critical item fails. Use `BLOCKED` only when validation cannot proceed because required access, data or an external dependency is unavailable.

## Reference basis

- Inspiration supplied for this checklist: <https://www.instagram.com/reel/Dd6pU4UDUt4/>
- Next.js static export guidance: <https://nextjs.org/docs/pages/guides/static-exports>
- OWASP Application Security Verification Standard: <https://owasp.org/projects/asvs>
- OWASP Secure by Design checklist: <https://owasp.org/projects/secure-by-design-framework?tab=checklist>

The Instagram reel could not be retrieved by the validation environment, so no unseen statement from the reel is represented as verified content. Its specific points should be compared manually with this checklist when the reel is available.
