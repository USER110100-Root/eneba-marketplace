# Eneba Marketplace Demo

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

AI chat is local-only. It defaults to enabled with `APP_ENV=development` and uses local Ollama. Set `CHAT_ENABLED=false` for public deployments. The chat lock is shared by PHP workers using the same database directory. The 15-second deadline applies to the PHP request to Ollama.

## Public deployment

- Serve `dist/` as the only public document root. Route `/api/*` to `server/router.php` on the same origin.
- Set `APP_ENV=production`, `CHAT_ENABLED=false`, and `SESSION_COOKIE_SECURE=true`.
- Set `MARKET_DB` to an absolute writable path outside `dist/` for both setup and PHP. For a host with a private volume mounted at `/var/data`, use `/var/data/market.sqlite`. If storage is ephemeral, the demo database may reset on redeploy.
- Run `php server/setup.php` before starting the app.
- Configure the host to return 403 or 404 for `/server`, `/server/*`, and requests for SQLite files before applying any storefront fallback.
- After deploying, request `https://your-site/market.sqlite` and `https://your-site/server/`. Both should return HTTP 403 or 404. Confirm that `/api/home` still returns JSON and that a POST to `/api/chat` returns HTTP 503 with the chat-unavailable message.

## Browser tests

The Playwright suite uses Chromium and starts its own PHP server with a temporary SQLite database. AI chat is disabled and checkout uses demo keys. Install PHP with PDO SQLite, then run:

```sh
npm install
npx playwright install --with-deps chromium
CI=1 npm run test:e2e
```

Set `PHP_BIN` to a PHP executable when it is outside your PATH. The suite uses port 4188.

### Deploy on Render

Create a Docker Web Service from the repository and use the directory containing
`Dockerfile` as its root. The container builds the frontend, initializes the
catalog in SQLite, and serves both the frontend and `/api/*` from one origin.
Use `/api/home` as the health check. Chat is local-only and disabled in production.

The default database path is `/var/data/market.sqlite`, outside the public
`dist/` directory. Without a persistent disk, accounts and demo orders can be
lost when the container is replaced. If you attach a disk, set `MARKET_DB`
to a file on its mount and ensure the directory is writable by `www-data`.
