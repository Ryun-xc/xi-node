FROM node:22-bookworm-slim
WORKDIR /app
COPY core /app/core
COPY server.mjs /app/server.mjs
COPY server /app/server
COPY web /app/web
COPY package.json /app/package.json
COPY LICENSE /app/LICENSE
COPY NOTICE /app/NOTICE
RUN mkdir -p /data && chown -R node:node /data /app
USER node
ENV XI_NODE_PORT=8787
ENV XI_NODE_HOST=0.0.0.0
ENV XI_NODE_DATA=/data
EXPOSE 8787
CMD ["node", "server.mjs"]