FROM node:20-alpine AS base
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY migrations ./migrations

EXPOSE 4000
CMD ["node", "src/app.js"]
