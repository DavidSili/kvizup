FROM node:22-alpine AS styles
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY styles/ ./styles/
RUN npm run styles:build

FROM php:8.4-apache

WORKDIR /var/www/html
COPY index.html app.js ./
COPY data/ ./data/
COPY assets/ ./assets/
COPY --from=styles /build/assets/css/style.css ./assets/css/style.css

EXPOSE 80
