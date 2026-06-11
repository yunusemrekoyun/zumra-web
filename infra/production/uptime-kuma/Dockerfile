FROM louislam/uptime-kuma:2.4.0 AS upstream

USER root
WORKDIR /app

RUN npm install \
  --omit=dev \
  --ignore-scripts \
  --no-audit \
  --no-fund \
  @grpc/grpc-js@1.14.4 \
  glob@10.5.0 \
  lodash@4.18.1 \
  minimatch@9.0.7 \
  protobufjs@7.5.6 \
  tar@7.5.11 \
  && rm -rf \
    /app/node_modules/@louislam/sqlite3/node_modules/tar \
    /app/node_modules/@mapbox/node-pre-gyp/node_modules/tar \
    /app/node_modules/cacache/node_modules/tar \
    /app/node_modules/node-gyp/node_modules/tar \
    /app/node_modules/redbean-node/node_modules/glob \
    /app/node_modules/redbean-node/node_modules/lodash

FROM node:22.22.3-bookworm-slim

RUN apt-get update \
  && apt-get upgrade -y \
  && apt-get install -y --no-install-recommends ca-certificates dumb-init \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=upstream --chown=node:node /app/config ./config
COPY --from=upstream --chown=node:node /app/db ./db
COPY --from=upstream --chown=node:node /app/dist ./dist
COPY --from=upstream --chown=node:node /app/node_modules ./node_modules
COPY --from=upstream --chown=node:node /app/public ./public
COPY --from=upstream --chown=node:node /app/server ./server
COPY --from=upstream --chown=node:node /app/src ./src
COPY --from=upstream --chown=node:node /app/index.html /app/package.json ./

RUN rm -rf \
  /usr/local/lib/node_modules/npm \
  /usr/local/bin/npm \
  /usr/local/bin/npx \
  && mkdir -p /app/data \
  && chown node:node /app/data

USER node

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server/server.js"]
