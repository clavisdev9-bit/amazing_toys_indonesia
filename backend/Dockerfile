# Amazing Toys SOS — Backend Dockerfile
FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies first (cached layer)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source
COPY src ./src

EXPOSE 3000
CMD ["node", "src/app.js"]
