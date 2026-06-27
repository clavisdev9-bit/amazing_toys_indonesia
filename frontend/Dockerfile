# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
ENV NODE_ENV=production
# VITE_APP_MODE: "desktop" untuk versi desktop, kosong untuk mobile (default)
ARG VITE_APP_MODE=
ENV VITE_APP_MODE=$VITE_APP_MODE
RUN npm run build

# ── Serve stage ───────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS serve
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
