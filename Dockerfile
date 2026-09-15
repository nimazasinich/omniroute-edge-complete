FROM node:24-bookworm-slim

RUN npm install --global --omit=dev omniroute@3.8.50 \
    && npm cache clean --force \
    && groupadd --system omniroute \
    && useradd --system --gid omniroute --home-dir /var/lib/omniroute omniroute \
    && mkdir -p /opt/omniroute-origin/runtime /var/lib/omniroute \
    && chown -R omniroute:omniroute /opt/omniroute-origin /var/lib/omniroute

WORKDIR /opt/omniroute-origin
COPY --chown=omniroute:omniroute runtime/ ./runtime/

ENV NODE_ENV=production \
    DATA_DIR=/var/lib/omniroute \
    REQUIRE_API_KEY=true \
    OMNIROUTE_SERVER_HOST=127.0.0.1 \
    PORT=8080

VOLUME ["/var/lib/omniroute"]
EXPOSE 8080
USER omniroute

HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "runtime/start-origin.mjs"]
