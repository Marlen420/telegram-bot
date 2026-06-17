FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache ffmpeg

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY config ./config
COPY scripts ./scripts
COPY videos ./videos-raw

RUN chmod +x scripts/optimize-videos.sh && \
    mkdir -p videos && \
    sh scripts/optimize-videos.sh videos-raw videos

ENV NODE_ENV=production
ENV VIDEOS_DIR=/app/videos
ENV CONTENT_CONFIG_PATH=/app/config/content.json

CMD ["node", "dist/index.js"]
