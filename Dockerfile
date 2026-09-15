FROM node:22-bookworm-slim AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build \
    && ./node_modules/.bin/esbuild server.ts --bundle --platform=node --format=esm --packages=external --outfile=server.js \
    && npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production \
    PORT=10000 \
    HOST=0.0.0.0 \
    SQLITE_DB_PATH=/var/lib/omniroute-edge/sqlite.db

RUN groupadd --system omniroute-edge \
    && useradd --system --gid omniroute-edge --home-dir /var/lib/omniroute-edge omniroute-edge \
    && mkdir -p /app /var/lib/omniroute-edge \
    && chown -R omniroute-edge:omniroute-edge /app /var/lib/omniroute-edge

WORKDIR /app
COPY --from=build --chown=omniroute-edge:omniroute-edge /app/package.json ./package.json
COPY --from=build --chown=omniroute-edge:omniroute-edge /app/node_modules ./node_modules
COPY --from=build --chown=omniroute-edge:omniroute-edge /app/dist ./dist
COPY --from=build --chown=omniroute-edge:omniroute-edge /app/server.js ./server.js

VOLUME ["/var/lib/omniroute-edge"]
EXPOSE 10000
USER omniroute-edge

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
