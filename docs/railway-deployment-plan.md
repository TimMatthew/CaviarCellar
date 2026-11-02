**Caviar Cellar: Railway deployment implementation plan**

Prepared October 31, 2026 from the current working tree and current Railway documentation. This is an implementation plan, not a record of a completed deployment.

The agreed target is one continuously running Express application serving both `client` and `/api`, plus one PostgreSQL service connected privately in the same Railway environment and region. Keep the frontend's same-origin requests. Add a public Railway HTTPS address first, a custom domain afterward, and CDN caching only after functional verification. Keep one application replica initially.

Use two completion milestones: a working browser preview, then a shop that can accept real orders. Completing infrastructure alone does not complete checkout.

**Evidence from this investigation**

| Check | Result | Practical implication |
|---|---|---|
| Existing test command | `npm test` in `server`: 15 passed, 0 failed | Useful unit baseline; no real database, payment, SMTP, or browser journey is validated by this suite |
| Local runtime | Node v24.19.0 | Pin a Node 24 Linux image and test native dependencies inside that image |
| Local HTTP checks | Four implemented page URLs return HTML; `/` returns HTTP 200 with zero bytes | Root route must be fixed before sharing a link |
| Static HTML/CSS reference audit | 82 local references checked, 11 unresolved, no filename-case mismatches among the resolved references | Repair listed URLs, then check dynamically generated product images separately |
| Runtime media | 85 files under `client/assets`, 347,510,340 bytes total | Package selected runtime assets rather than all design material |
| Homepage video | 40,482,712 bytes; another video is 141,997,050 bytes | Optimize the actual homepage video; omit the unused larger source if unreferenced |
| Product seed images | All 12 seed references resolve locally | Still absent from a Git-based deployment until runtime assets are tracked or otherwise supplied |
| Git asset tracking | `client/assets` is ignored; no files in it are tracked | A clean repository deployment loses the images and video |
| Public static directory | Local `/db-scripts/DATABASE.md` and `/basket-logo.psd` return 200 | Do not copy development documentation/design sources into the deployed public directory |
| Database-down behavior | `/health` returns generic 500 when connection is refused | Return a predictable 503 readiness response and keep the response free of internal details |
| Deployment tools | Docker, psql, and Railway CLI were not found on PATH | Container builds, PostgreSQL integration tests, and remote deployment were not performed |

Runtime checks used isolated placeholder configuration, a temporary local HTTP port, disabled scheduling, and an intentionally unreachable database address. They did not call Fondy, Nova Poshta, or SMTP, or modify an existing database. Secret values were not printed. Existing user modifications in four CSS files were preserved.

**Code findings and their scope**

| Priority | Finding | Evidence | Required action |
|---|---|---|---|
| Browser preview | Root page is empty | `client/main.html` is zero bytes; `server/src/app.js` serves it at `/` | Redirect `/` to `/hero/hero.html` initially, preserving existing relative URL behavior |
| Browser preview | Runtime assets are omitted from Git | Root `.gitignore` ignores every directory named `assets` | Narrow ignore rules; track only the runtime assets needed by the site |
| Browser preview | No explicit deployment definition | No root package, Dockerfile, Railway config, or migration command | Add root Dockerfile, `.dockerignore`, and Railway configuration |
| Browser preview | Eleven unresolved static references | See exact list below | Supply missing assets or correct/remove broken references |
| Database readiness | Nine SQL migrations are manual and not repeatable as a deployment command | `server/src/db/migrations/001` through `009`; `server/package.json` has no migration script | Add a tracked, locked migration runner and test on a fresh PostgreSQL database |
| Configuration | `AUTH_SECRET` is omitted from the example and remains optional at boot | `server/.env.example`, `server/src/config/index.js`, `server/src/lib/token.js` | Document it, require it for production admin login, and validate production settings |
| Configuration | Unused interim admin key is still mandatory | Routes use bearer auth; `adminKey.js` is not mounted | Supply a random key for current compatibility; remove obsolete validation/middleware only in a deliberate cleanup |
| Shop launch | Checkout has no submission handler | `client/ordering/ordering.js` has no POST/fetch; HTML confirmation button is `type=button` | Implement order submission and response handling |
| Shop launch | UI/API payment vocabulary differs | UI uses `prepayment`; API requires `prepaid_card` | Map or unify the values |
| Shop launch | Delivery choices are sample values, not UUID references | `destinations` in ordering script; API delivery schema requires UUIDs | Implement server-side city/warehouse lookups and validate selected references |
| Shop launch | UI offers Poland/Germany and international phone choices, but backend adapter is domestic | Only domestic Nova Poshta adapter exists; delivery phone requires `380XXXXXXXXX` | Launch with supported Ukrainian destinations first, or implement international delivery before presenting it as available |
| Shop launch | External failures can leave committed orders with reserved inventory | Checkout commits before calling Fondy or creating a shipment | Add durable retry/reconciliation, order submission idempotency, and a policy for releasing confirmed unpaid reservations |
| Shop launch | Shipment failure deletes destination data | `fulfillment-service.js` calls `deleteUnfulfilled` on an integration error | Preserve or reconstruct the destination and reconcile ambiguous provider results before retrying |
| Shop launch | Failed terminal side effects may never be retried by the poller | Tracking commits delivered/returned/cancelled before side effects; `listInFlight` excludes terminal deliveries | Add durable reconciliation for failed refunds and COD payment marking |
| Shop launch | Scheduling protection is only in-process | `scheduler.js` uses a local boolean; outbox reads unclaimed pending rows | Protect jobs with a database lock/lease across deploys and handle shutdown in-flight work |
| Shop launch | Network calls lack explicit deadlines | Fondy and Nova Poshta use bare `fetch` | Add bounded timeouts and distinguish rejected operations from unknown outcomes |
| Shop launch | Label URL contains the Nova Poshta API key | `novaPoshta.labelUrl` returns a URL containing `/apiKey/...`; admin label route sends it as JSON | Fetch/stream the label server-side through the authenticated route; redact sensitive URLs |
| Shop launch | Public write/login endpoints have no rate limiting | Middleware stack and routes | Add scoped limits for login, orders, bookings, tracking, and delivery lookups; account for the actual proxy chain |
| Shop launch | Some formatted dates depend on host timezone | Email templates and shipment `DateTime` omit an explicit timezone | Format customer-facing and carrier dates explicitly for `Europe/Kyiv` |
| Operations | Admin API exists, admin browser UI does not | Auth and admin routes exist; no admin frontend is present | Bootstrap the first admin once and document API operations; a browser admin dashboard is a separate feature |

The 11 unresolved HTML/CSS references are:

| Source | Reference |
|---|---|
| `client/catalog/catalog.html` | `../main-page/main.html#about` |
| `client/catalog/catalog.html` | `../main-page/main.html#booking` |
| `client/degust/degust.css` | `../assets/degust/hero-layouts/layout-1-image-2.png` |
| `client/hero/hero.css` | `assets/hero-caviar-table.jpg` |
| `client/hero/hero.html` | `assets/delivery/delivery-1.jpg` through `delivery-6.jpg` (six separate references) |
| `client/hero/hero.html` | `../assets/logo-sturgeon-white.png` |

Some references may belong to unused CSS. Resolve each intentionally rather than assuming every missing file is visible. Also verify target fragments: a file existing does not prove its `#about` or `#booking` anchor exists. For example, the degustation layout folder has a similarly named PSD, but not the requested PNG.

**Step 1: Prepare a deployment-only change set**

Preserve the current CSS edits. Keep deployment work reviewable in a dedicated branch/change set when implementation starts. Add these deliverables:

| File or area | Planned change |
|---|---|
| Root `Dockerfile` | Explicit Linux Node build from repository root; production dependencies installed from `server/package-lock.json`; direct Node start; non-root runtime |
| Root `.dockerignore` | Exclude `.git`, local dependencies, all real `.env` files, development database material, design sources, and unused large media |
| Root `railway.toml` | Docker builder, explicit pre-deploy migration command, `/health`, deployment timeout, restart and shutdown settings |
| `.gitignore` | Stop excluding needed runtime assets; continue excluding secrets and source design files |
| `server/package.json` | Add `db:migrate`, `db:seed:catalog`, `db:seed:admin` and deployment verification commands |
| `server/.env.example` | Complete public URL, database, auth, scheduler, payment, delivery, and SMTP examples without actual credentials |
| `docs/railway.md` | Operational deployment, seeding, recovery, domain, and rollback instructions |

Use a Debian-based Node 24 image for compatibility with the native `argon2` dependency. Install dependencies inside Linux; never copy Windows `node_modules`. If native prebuilt packages are unavailable, compile in a build stage with the required toolchain. Keep build tools out of the final runtime image.

Keep the Railway service root at the repository root. Setting it to `/server` removes the sibling `client` directory from the deployment input. A Docker image with `/app/server` and `/app/client`, using `/app/server` as its working directory, preserves the existing `WEB_DIR=../client` convention. Railway's monorepo behavior is documented in [Deploying a Monorepo](https://docs.railway.com/deployments/monorepo).

The Docker build must copy only runtime HTML/CSS/JS and the selected media into its public directory. Do not blindly copy local `client/db-scripts` or PSD files. Database migrations belong under the private server code, not the public static tree. Keep all secrets as runtime variables, never image build arguments.

**Step 2: Make the public website complete**

Change `/` to redirect to `/hero/hero.html` for the first release. Simply sending `hero.html` at `/` changes how its relative scripts and styles resolve; do not do that without rewriting all URLs. Clean root URLs can be added later.

Repair the 11 unresolved references and broken fragment links. Add only the required runtime images/video to Git. Omit PSD sources, unused footage, and local documentation from the deployable public files. Compress the homepage video and verify its playback and byte-range behavior on mobile.

Add a repeatable asset verification command that checks HTML/CSS references and product image paths. Verify a fresh checkout or built image, not just the current working directory where ignored files happen to exist.

For a shared browser preview before the shop is ready, introduce a clearly documented public-write feature flag (proposed; none exists today) that disables new order and booking writes until explicitly enabled. Do not rely on a disabled frontend button to block API writes. Payment callbacks for any already-created orders must remain independently operable. Enable writes only in an isolated test environment during acceptance testing.

**Step 3: Automate PostgreSQL provisioning and migrations**

Use PostgreSQL 18 initially to match the repository's documented version; verify the actual existing database version before choosing any data-export path. Create PostgreSQL as its own Railway service with persistent storage, in the same project, environment, and region as the app.

Keep the current split `DB_*` connection settings for the fastest implementation. Supporting `DATABASE_URL` is optional, not a prerequisite. Map Railway's variables as listed below and use its private host. Configure TLS according to the selected connection endpoint; do not globally disable certificate verification as a workaround for public database access.

Implement `db:migrate` with `pg` and an applied-migrations table. Apply numbered files in order, store checksums, serialize migrators with a PostgreSQL advisory lock, and exit nonzero on failure. The current files include their own `BEGIN`/`COMMIT`; normalize that transaction ownership deliberately so each file's schema changes and ledger entry commit atomically. Do not blindly wrap the existing scripts in another transaction. Use a dedicated connection for the migration lock and close it reliably.

Test an empty database through migrations 001-009, a second no-op run, a failing migration, and two concurrent migration invocations. Validate the degustation availability SQL against real PostgreSQL, not only the JavaScript validators.

Put migrations in Railway's pre-deploy phase, not the Docker build and not every request/startup path. Pre-deploy runs with application variables and private network access; a failure stops the release. It runs in a separate container, so it must not generate filesystem artifacts needed by the app. Set a bounded timeout. See [Pre-deploy commands](https://docs.railway.com/deployments/pre-deploy-command).

Run catalogue seeding and admin bootstrapping explicitly once. The existing catalogue seed inserts fixed IDs and sample prices/stock; it is not safe to replay over live data and must not be an automatic production release step. Review the real launch catalogue, prices, inventory, image mappings, and next identity value first.

If existing local data must be retained, export and restore it into a separate test database, check row counts and sequences, and establish the migration ledger baseline after schema verification. Do not replay the initial CREATE TABLE migrations into an already-restored schema, and do not import demo orders, credentials, or personal records by default.

**Step 4: Validate configuration, readiness, and process behavior**

Retain injected `PORT`; the current server already reads it. Explicitly listen on the container interface when implementing the runtime configuration. Keep application variables out of browser JavaScript.

Add startup validation for production HTTPS URLs and the admin signing secret. Require Fondy, Nova Poshta, and SMTP configuration when the corresponding production features are enabled. Add `AUTH_SECRET` to the example file. Log missing variable names without logging their values. Keep the development-only USD conversion disabled; production code currently forces the original UAH payment terms.

Return 200 from `/health` only when application readiness and the required database schema are available; return a concise 503 on database failure. Add `Cache-Control: no-store`. The current `SELECT 1` alone can succeed against an unmigrated database. Do not make readiness call payment, carrier, or email APIs.

Start scheduling only after the required database state is ready. Add distributed job locking/claiming before enabling production jobs, even with one configured replica: old and new deployments can briefly coexist during release. Ensure lock connections remain held for the entire protected operation. SMTP still has an unavoidable sent-before-ack crash window unless the provider offers deduplication; do not promise exactly-once email delivery.

Track active jobs during shutdown, stop scheduling new work, and wait within a bounded drain period before closing the pool. Coordinate the app's existing ten-second safety timer with the platform's drain setting; for example, use a 25-second app deadline and 30-second Railway allowance after introducing bounded integration calls. See [Deployment teardown](https://docs.railway.com/deployments/deployment-teardown).

**Step 5: Configure Railway and publish the browser preview**

Use a project with an app service and a PostgreSQL service, in a European region selected from the account's available regions. Keep them together. Use Railway Pro to retain the existing SMTP adapter: SMTP is currently restricted to Pro and above. An HTTPS email adapter is a separate optional cost optimization. See [Outbound networking](https://docs.railway.com/networking/outbound-networking).

| Railway application setting | Planned value |
|---|---|
| Source root | Repository root `/` |
| Builder | Root Dockerfile |
| Runtime working directory | `/app/server` |
| Start | `node src/server.js` via exec-form Docker command |
| Pre-deploy | `npm run db:migrate` (new command, not implemented yet) |
| Pre-deploy timeout | 300 seconds initially; tune after measured migration duration |
| Healthcheck | `/health`, 300-second deployment timeout initially |
| Replicas | 1 |
| App sleeping/serverless | Disabled while jobs run inside the app |
| App persistent volume | None needed for checked-in static assets; database has its own persistent volume |
| Restart policy | On failure, with monitoring for repeated failures |
| Shutdown allowance | Matched to the bounded app shutdown as described above |
| CDN | Disabled until acceptance checks pass |

Create a public Railway domain and set the final URLs before testing payments. Build/test stages must not require access to the private database; migration and runtime phases do. Verify the image includes both frontend and server files and excludes secrets.

**Environment-variable mapping**

These references assume the database service is named `Postgres`; substitute its actual Railway service name. Do not paste a connection URL into `DB_HOST`.

| Variable | Railway value or source |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | Railway injected value |
| `LOG_LEVEL` | `info` |
| `BASE_URL` | Generated public HTTPS origin initially; final custom HTTPS origin later; no trailing slash |
| `CHECKOUT_RETURN_URL` | Verified browser return endpoint on the public origin; see Step 6 |
| `WEB_DIR` | `../client` with the planned image layout |
| `DB_HOST` | `${{Postgres.PGHOST}}`, verified private hostname |
| `DB_PORT` | `${{Postgres.PGPORT}}` |
| `DB_USER` | `${{Postgres.PGUSER}}` |
| `DB_PASSWORD` | `${{Postgres.PGPASSWORD}}` |
| `DB_NAME` | `${{Postgres.PGDATABASE}}` |
| `DB_POOL_MAX` | `10` initially; account for temporary migration/job connections |
| `AUTH_SECRET` | Independently generated long random production secret |
| `ADMIN_API_KEY` | Separate random value while current mandatory validation remains |
| `SCHEDULER_ENABLED` | `false` for initial provisioning; `true` after locking, recovery, and provider configuration are tested |
| `DELIVERY_POLL_CRON` | `*/10 * * * *` initially |
| `OUTBOX_CRON` | `*/1 * * * *` initially |
| `TRACKING_BATCH_SIZE` | `50` initially |
| `OUTBOX_BATCH_SIZE` | `25` initially |
| `OUTBOX_RETRY_SECONDS` / `OUTBOX_MAX_RETRY_SECONDS` | `60` / `86400` initially |
| `FONDY_MERCHANT_ID` / `FONDY_SECRET_KEY` | Merchant's actual production credentials for production; isolated test credentials in staging |
| `FONDY_TEST_USD_ENABLED` | `false` in production |
| `NP_API_KEY` | Merchant's Nova Poshta key |
| `NP_SENDER_REF` / `NP_CONTACT_SENDER_REF` | Verified sender and contact references |
| `NP_SENDER_CITY_REF` / `NP_SENDER_ADDRESS_REF` | Verified sender city and branch references |
| `NP_SENDER_PHONE` | Verified sender phone, `380XXXXXXXXX` |
| `NP_SERVICE_TYPE` / `NP_CARGO_TYPE` | `WarehouseWarehouse` / `Parcel`, subject to provider account validation |
| `NP_DEFAULT_WEIGHT_KG` | Actual dispatch weight; current example is `1` |
| `SMTP_HOST` / `SMTP_PORT` | Mail provider host and supported port, normally 587 or 465 |
| `SMTP_USER` / `SMTP_PASS` | Mail provider credentials |
| `MAIL_FROM` | Verified sender identity on the merchant's domain |
| Proposed public-write flag | Disabled for shared preview; enabled only after the live-order checks below |

For staging, use a distinct database and provider credentials. Do not share an active production notification outbox with a preview environment. The existing USD test switch is intentionally ignored under `NODE_ENV=production`; a production-like staging test must use test credentials that support the production UAH flow, or test the USD-only path separately under `NODE_ENV=test`.

**Step 6: Finish the customer checkout journey**

Implement backend city search and warehouse lookup endpoints, using the server-held Nova Poshta key. Add input validation, request timeouts, bounded caching of carrier directory data, and server-side verification that a selected branch belongs to the selected city. Keep API credentials out of frontend files.

Connect the order form to `POST /api/orders`. Normalize surname/name/patronymic and Ukrainian delivery phone, map `prepayment` to `prepaid_card`, and map basket `quantity` to API `qty`. Send only product IDs/quantities; keep the server as the authority on prices. Show validation and stock conflicts, disable duplicate clicks, and preserve the basket when the request fails or its outcome is unknown.

Use a durable idempotency key for each checkout attempt. Repeating an attempt after a lost response must return/recover the same order, not reserve inventory again or create another shipment.

For COD, show the saved order and shipment/processing state. For prepaid, navigate to the returned hosted checkout URL. Build a customer-safe order-status endpoint and confirmation screen so payment can remain pending while waiting for the signed callback. Existing `GET /api/orders/:id` is admin-only; do not remove that protection to implement the customer screen. Use an appropriate unguessable capability/token rather than exposing arbitrary customer orders.

Verify the provider's browser-return method as well as its callback. If the browser return is POST, add a minimal return handler that redirects with 303 to the confirmation screen; do not POST to a static HTML-only route. Never mark an order paid from browser-return parameters. The signed server callback remains authoritative. Fondy's documented callback payload is JSON, which matches the current JSON parser; verify the actual merchant configuration rather than adding speculative parsers. See [Fondy callbacks](https://docs.fondy.io/gateway/direct-integration/callbacks/).

Set `BASE_URL` to the externally reachable origin so the generated callback is `/api/payments/fondy/callback`. Add an actual return/confirmation endpoint and configure `CHECKOUT_RETURN_URL` accordingly. Clear the basket only at a defined successful order-acceptance point and retain enough information to resume a pending payment.

Launch domestic delivery first unless international shipment creation, references, and validation are separately implemented and tested. Update the UI to reflect actual supported destinations.

**Step 7: Make orders survive external failures**

Fix these cases before taking real money:

| Failure case | Required behavior |
|---|---|
| Fondy checkout creation rejects or times out after order commit | Keep the same saved order and a durable attempt/reference; retry or reconcile without a second inventory reservation |
| Browser repeats checkout after losing the response | Same idempotency key recovers the prior result |
| Nova Poshta rejects a shipment | Keep recoverable recipient/destination data; expose an actionable processing/error state |
| Carrier accepted the document but the response or database write was lost | Reconcile the provider result before any new create call; do not equate timeout with rejection |
| Payment callback is repeated | One paid transition, no duplicate shipment, and deduplicated notification enqueueing |
| Process exits after marking paid but before queuing email or creating shipment | Durable work/reconciliation completes the missing side effects |
| Delivery becomes terminal but refund/COD paid update fails | Explicit reconciliation includes that terminal delivery after restart |
| Customer abandons unpaid checkout | Apply a documented expiry policy; release inventory only after ruling out a successful or ambiguous payment |
| Scheduler overlaps during deployment | Database lock/lease or atomic message claim prevents concurrent work on the same unit |

Use durable jobs/operation records in PostgreSQL, keeping the single application service initially. A separate queue product or worker service is not necessary for the first version. Add deadlines to Fondy and carrier calls and provider-safe retry rules. Persist provider correlation identifiers before external work where possible and verify provider idempotency/reconciliation capabilities before relying on them.

Add scoped rate limiting to public writes and login. Configure trusted proxies from Railway's documented behavior rather than blindly trusting any forwarded IP header. Proxy authenticated label downloads server-side so the Nova Poshta key is not delivered to the browser. Redact secrets and sensitive provider URLs in logs. Use explicit Kyiv time formatting in emails and carrier dates.

**Step 8: Add deployment and commerce acceptance checks**

Preserve the existing unit suite. Add meaningful database/HTTP tests for the new migration runner, root/static serving, readiness, locking, and the above failure cases. Use mocked provider clients for repeatable automated failure tests and isolated provider accounts for remote acceptance. Build and run the Linux image to verify `argon2` loads on the actual runtime.

| Acceptance check | Expected result |
|---|---|
| Fresh repository build | Assets present; no reliance on ignored local files or Windows dependencies |
| `/` and direct page URLs | Real homepage reached; refresh and navigation work |
| Images, CSS, JS, fonts, maps, video | No missing required assets or CSP errors; video supports playback/seeking |
| `/db-scripts/DATABASE.md`, PSD sources, real `.env` files | Not publicly served or included as secrets in the image |
| `/health` with migrated DB | 200; no-store |
| `/health` with missing/unreachable DB | 503 without internal credentials/details |
| Migration failure | Release fails before traffic switches; existing compatible release remains usable |
| Catalogue and basket | Products load from PostgreSQL; quantities and stock conflicts are handled |
| Tasting booking | Kyiv slots load; create persists; simultaneous booking conflict returns cleanly; email sends/retries |
| COD checkout | One order, one inventory reservation, one recoverable shipment operation |
| Prepaid checkout | Redirect to Fondy; signed callback produces the matching paid order; browser return alone cannot mark paid |
| Invalid/repeated callback | Invalid signature rejected; duplicate delivery has no duplicate business effect |
| Restart during external work | Recoverable state remains; reconciliation completes after restart |
| Delivered/returned terminal reconciliation | COD paid and refund updates recover after injected failure |
| Admin operations | Unauthenticated access rejected; admin can inspect orders and manage catalogue through the API |
| Redeploy during scheduled work | No overlapping processing from old and new instances; bounded graceful shutdown |
| Backup restoration | Restore into a separate database and verify representative products/orders/bookings |

The current environment does not establish real PostgreSQL/integration/browser correctness. A passing unit suite is not a substitute for these acceptance checks.

**Step 9: Attach the business domain and enable caching**

Add the owned custom domain in Railway and apply its displayed CNAME and TXT records. Wait for domain verification and HTTPS. Update `BASE_URL`, the browser return URL, and any merchant-dashboard URL settings. Keep the old callback address working while existing payments using it can still complete. See [Railway domains](https://docs.railway.com/networking/domains/working-with-domains).

After functional checks pass, optionally enable Railway CDN caching. It is currently beta. Set explicit no-store behavior on `/api`, auth, payment, customer confirmation/status, and health responses. Give static files deliberate caching rules. Existing filenames are not content-hashed, so initially purge all cached assets on deploy or add versioned filenames before using long immutable cache lifetimes. Test freshness after an actual redeploy. See [Railway CDN](https://docs.railway.com/networking/cdn).

**Step 10: Establish recovery and ongoing operation**

Enable scheduled PostgreSQL backups and test a restore to a separate database. Decide the acceptable data-loss window; daily snapshots alone can lose a day of orders, so evaluate point-in-time recovery before live commerce. Record a recovery procedure that reconciles restored orders with Fondy and Nova Poshta, not just the database. See [Railway backups](https://docs.railway.com/volumes/backups).

Configure ongoing uptime checks separately: Railway deployment healthchecks validate a new release but do not continuously monitor it afterward. Alert on repeated job failures, growing unsent outbox, paid orders without shipments, stalled/ambiguous payment attempts, failed refunds, and abnormal resource spending. See [Railway healthchecks](https://docs.railway.com/deployments/healthchecks).

Use backward-compatible schema changes while old and new releases can overlap. Roll back application code only when compatible with the current schema; an application rollback does not undo migrations. Restore a database only through a deliberate recovery procedure that accounts for orders/payments created after the backup.

**Recommended implementation order**

1. Repository-root Docker packaging, public asset inventory, homepage/path fixes.
2. Migration runner, reviewed one-time seeds, private database variable mapping.
3. Production config validation, readiness, and a browser-preview write gate.
4. Provision Railway app/PostgreSQL, run migrations, publish and inspect the preview URL.
5. Job coordination/shutdown, integration timeouts, and durable order/reconciliation fixes.
6. Live domestic delivery lookups, checkout submission, payment return/status page.
7. Isolated end-to-end acceptance checks and database restore drill.
8. Custom domain, verified email sender, production credentials, backups/monitoring, and enabling real customer writes.
9. CDN caching and media optimization based on observed browser/network behavior.

Steps 1-4 produce a reviewable deployed preview. Steps 5-8 produce the functioning shop. Caching, a separate frontend, and an admin browser dashboard do not need to delay the first preview.

Before the remote phase, the operational inputs are Railway account/project access, repository deployment access, reviewed launch catalogue data (or a deliberate existing-data migration), merchant/carrier/mail credentials, and a domain if a business address is required immediately. Enter secrets directly into the provider's secret settings. No secret values need to be committed to this plan or repository.
