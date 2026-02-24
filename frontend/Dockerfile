FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

ARG VITE_WS_URL
ENV VITE_WS_URL=$VITE_WS_URL

RUN npm run build

# ── Production image ──────────────────────────────────────────────────────────
FROM nginx:alpine
WORKDIR /usr/share/nginx/html

COPY --from=builder /app/dist .
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

COPY nginx.conf /etc/nginx/nginx.conf.template

EXPOSE 8080

CMD ["/docker-entrypoint.sh"]
