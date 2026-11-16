# Eneba Marketplace Demo

React and TypeScript storefront with a PHP 8.3+ API and SQLite. All orders and activation keys are simulated.

## Run the full demo

Install Node.js, npm and PHP with the PDO SQLite extension. From this directory, run:

```sh
npm install
npm run check
npm run build
mkdir -p .sessions
php -d session.save_path="$PWD/.sessions" -S 127.0.0.1:4178 -t dist server/router.php
```

The archive includes a prebuilt dist directory. To use that build, start with the mkdir and PHP commands. To rebuild after editing source, run the npm commands first.

Open http://127.0.0.1:4178. Register with a demo address and a unique demo password. Open a product, select a seller offer, add it to your cart and place a simulated order. Your keys appear in the confirmation and in your signed-in order history.

Catalog seed content lives in server/seed.json and is imported into SQLite on first use. The homepage loads ordered slides and shelves from the PHP API using the selected English or Lithuanian locale. The app requires PHP for the homepage, catalog, accounts, orders, and newsletter signups. Deploy PHP with persistent SQLite and session storage behind the same origin as the frontend to enable those features on a hosted copy. Sites can serve the dist directory but does not execute PHP.

The GTA VI artwork, logo, and first six covers were extracted from the supplied visual reference. Cards with unavailable covers use styled title panels. Catalog prices, release copy and seller names are demo data.


## Local AI chat

Install and open Ollama, then run `ollama pull qwen2.5:1.5b` once while online. Keep Ollama listening on 127.0.0.1:11434 and run the PHP server with the cURL extension enabled. The chat can use the downloaded model offline. Set OLLAMA_CHAT_MODEL on the PHP server to choose another installed model. Simple catalog price lookups work without Ollama. Some product images are fetched from the web and have local fallbacks.
