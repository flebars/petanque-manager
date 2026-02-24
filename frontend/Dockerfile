FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Production image ──────────────────────────────────────────────────────────
FROM nginx:alpine
WORKDIR /usr/share/nginx/html

COPY --from=builder /app/dist .
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

COPY nginx.conf /etc/nginx/nginx.conf.template

EXPOSE 3000

CMD ["/docker-entrypoint.sh"]
