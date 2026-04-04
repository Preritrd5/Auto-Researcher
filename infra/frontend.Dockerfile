FROM node:22-alpine

WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json* /app/frontend/
RUN npm install

