FROM node:22-alpine AS styles
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY styles/ ./styles/
RUN npm run styles:build

FROM php:8.4-apache

WORKDIR /var/www/html
COPY index.php assets.php VERSION app.js ./
COPY .htaccess ./
COPY admin/ ./admin/
COPY docker/security.conf /etc/apache2/conf-enabled/kvizup-security.conf
COPY docker/uploads.ini /usr/local/etc/php/conf.d/kvizup-uploads.ini
COPY data/ ./data/
COPY assets/ ./assets/
COPY --from=styles /build/assets/css/ ./assets/css/
RUN a2enmod rewrite headers && mkdir -p /var/lib/kvizup && chown -R www-data:www-data /var/www/html/data/subjects /var/lib/kvizup

EXPOSE 80
