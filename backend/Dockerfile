FROM node:20-bookworm-slim
WORKDIR /app

RUN apt-get update -y && apt-get install -y --no-install-recommends \
    openssl ca-certificates poppler-utils \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /data/storage

ENV NODE_ENV=production
ENV STORAGE_PATH=/data/storage

COPY package.json ./
COPY prisma ./prisma
RUN npm install && npx prisma generate

COPY src ./src

EXPOSE 8000

CMD ["npx", "tsx", "src/server.ts"]
