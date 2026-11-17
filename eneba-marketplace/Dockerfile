FROM node:22-bookworm-slim AS frontend
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY index.html ./
COPY scripts/build.mjs scripts/build.mjs
COPY public public
COPY src src
RUN npm run build && test -s dist/index.html && test -s dist/app.js

FROM php:8.3-cli-bookworm
WORKDIR /app
RUN php --ri pdo_sqlite >/dev/null  && install -d -o www-data -g www-data -m 0700 /var/data
ENV APP_ENV=production \
    CHAT_ENABLED=false \
    SESSION_COOKIE_SECURE=true \
    MARKET_DB=/var/data/market.sqlite
COPY --from=frontend /app/dist dist
COPY server server
USER www-data
CMD ["sh", "-ec", "php server/setup.php && exec php -S 0.0.0.0:${PORT:-10000} -t dist server/router.php"]
