# Eneba marketplace internship submission

Live demo: https://eneba-marketplace-w1b4.onrender.com/
Repository: https://github.com/USER110100-Root/eneba-marketplace

## Reviewer walkthrough

Register with a demo address, sign in, search for Cybepunk, open Cyberpunk 2077,
compare the three seller offers, add one to the cart and review checkout.
Stripe sandbox setup is required for the new payment flow. Use the test cards
below. After webhook confirmation, the fictional key appears in Library.
The free Render instance may take time to wake up and its SQLite data is ephemeral.

## Scope and decisions

The primary scope is discovery, seller comparison, authenticated checkout and
key delivery. React/TypeScript handles rendering, PHP owns authorization,
validation and payment fulfillment, and SQLite keeps the demo easy to run.
Seller offers are generated from database product prices. There is no finite
stock reservation or real key inventory. Stripe is sandbox-only.
Homepage slides and shelf definitions come from server/home.json, product shelf
items from SQLite, and category blocks from server/categories.json, aggregated
by server/catalog.php. The frontend keeps only presentation and icon mappings.
Real commerce, production tax calculation and real fulfillment are outside this
internship demo. The chatbot has been removed to focus on the marketplace flow.

## AI usage and required transcript

AI assisted implementation, debugging and deployment. The applicant must supply
the full original coding conversations with the submission. This repository
does not contain a fabricated transcript or claim that this summary replaces it.

## Original setup notes

React and TypeScript storefront with a PHP 8.3+ API and SQLite. All orders and activation keys are simulated.

## Run the full demo

Install Node.js, npm and PHP with the PDO SQLite extension. From this directory, run:

```sh
npm install
npm run check
npm run build
php server/setup.php
mkdir -p .sessions
APP_ENV=development php -d session.save_path="$PWD/.sessions" -S 127.0.0.1:4173 -t dist server/router.php
```

Open http://127.0.0.1:4173. Register with a demo address and a unique demo password, then sign in. Open a product, select a seller offer, add it to your cart and place a simulated order. Your keys appear in the confirmation and in your signed-in order history.

Run `php server/setup.php` before serving the app and again after adding catalog seed products. SQLite defaults to `var/market.sqlite` outside the `dist/` document root. Set `MARKET_DB` to an absolute path outside the web root for both setup and the server. Setup copies an existing legacy `server/market.sqlite` to the new default location when no new database exists. The homepage loads ordered slides and shelves from the PHP API using the selected English or Lithuanian locale. The app requires PHP for the homepage, catalog, accounts, orders, and simulated newsletter signups. Newsletter signup validates and rate-limits requests without saving addresses. Deploy PHP with persistent SQLite and session storage behind the same origin as the frontend to enable those features on a hosted copy. Sites can serve the dist directory but does not execute PHP.

The GTA VI artwork, logo, and first six covers were extracted from the supplied visual reference. Cards with unavailable covers use styled title panels. Catalog prices, release copy and seller names are demo data.

Production defaults to secure session cookies. Set `SESSION_COOKIE_SECURE=true` on HTTPS deployments, including behind a TLS proxy. The local `APP_ENV=development` command allows cookies over local HTTP.


## Public deployment

- Serve `dist/` as the only public document root. Route `/api/*` to `server/router.php` on the same origin.
- Set `APP_ENV=production`, `CHAT_ENABLED=false`, and `SESSION_COOKIE_SECURE=true`.
- Set `MARKET_DB` to an absolute writable path outside `dist/` for both setup and PHP. For a host with a private volume mounted at `/var/data`, use `/var/data/market.sqlite`. If storage is ephemeral, the demo database may reset on redeploy.
- Run `php server/setup.php` before starting the app.
- Configure the host to return 403 or 404 for `/server`, `/server/*`, and requests for SQLite files before applying any storefront fallback.
- After deploying, request `https://your-site/market.sqlite` and `https://your-site/server/`. Both should return HTTP 403 or 404. Confirm that `/api/home` still returns JSON.

### Deploy on Render

Create a Docker Web Service from the repository and use the directory containing
`Dockerfile` as its root. The container builds the frontend, initializes the
catalog in SQLite, and serves both the frontend and `/api/*` from one origin.
Use `/api/home` as the health check.

The default database path is `/var/data/market.sqlite`, outside the public
`dist/` directory. Without a persistent disk, accounts and demo orders can be
lost when the container is replaced. If you attach a disk, set `MARKET_DB`
to a file on its mount and ensure the directory is writable by `www-data`.

### Stripe sandbox checkout

Set STRIPE_SECRET_KEY to your sandbox sk_test_ key, STRIPE_WEBHOOK_SECRET to
the endpoint's whsec_ secret, and APP_URL to the canonical public origin
(for this deployment, https://eneba-marketplace-w1b4.onrender.com).
See .env.example. Export variables in your shell or configure them on Render.
The app does not load .env files automatically. Never expose secrets to React.

Run php server/setup.php to create checkout_attempts before restarting.
Configure a Stripe sandbox webhook at /api/stripe/webhook for
checkout.session.completed, checkout.session.async_payment_succeeded,
checkout.session.expired and checkout.session.async_payment_failed.
Locally, use stripe listen --forward-to localhost:4178/api/stripe/webhook and
use the signing secret printed by that CLI. Production HTTPS cookies require
SESSION_COOKIE_SECURE=true. Use false only for local HTTP development.

Sign in, add an available offer, review seller/platform/region/total, and
confirm immediate delivery for game/software items. Continue to the Stripe
sandbox page using Pay with Stripe. Use 4242 4242 4242 4242, any future expiry
and any three-digit CVC. Use 4000 0000 0000 0002 to test a decline.
Use Back on Stripe to cancel: the cart remains available. Declines remain on
Stripe so the buyer can retry. The success page polls the authenticated order
status and cannot issue keys. Until a signed paid event arrives, it waits.
Duplicate paid events and repeated clicks reuse the order identity.
Only paid orders enter order history; every issued key is fictional.

No additional taxes/fees are added to the demo price, and there is no invented
VAT breakdown. Gift cards/vouchers do not require digital-content withdrawal
consent. Availability checks use the database catalog and current generated
seller offers; the demo has no finite inventory reservation system.
The embedded demo notices need merchant-specific review before real commerce.

Run php tests/stripe.php for signature, payment mismatch and duplicate-event
regressions. A complete hosted payment test requires your Stripe sandbox
credentials and webhook forwarding. No live Stripe payment was performed
during implementation.

## Repeatable verification

Run npm ci, npm run check, npm run build, then php tests/stripe.php and
php tests/security.php. Run PHP_BIN=php sh tests/order-access.sh for isolation.
Start a seeded local PHP server on port 4178 and run npm run test:e2e.
Set E2E_BASE_URL for another test deployment. The committed browser smoke tests
cover typo search, seller selection, filters, guest checkout, unverified
payment returns and chatbot removal. They do not pretend to test a Stripe
payment without sandbox credentials.
