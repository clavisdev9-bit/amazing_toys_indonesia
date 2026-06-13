FROM node:20-alpine AS base
WORKDIR /app

# sharp prebuilt binary for linux-musl requires libc6-compat on Alpine
RUN apk add --no-cache libc6-compat

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY migrations ./migrations
COPY add-admin.js ./add-admin.js
COPY data ./data

RUN mkdir -p public/uploads

EXPOSE 3001
CMD ["node", "src/app.js"]
