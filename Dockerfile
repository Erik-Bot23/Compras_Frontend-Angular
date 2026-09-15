# -------- FASE 1: compilar la app Angular -------- #
# node:22-alpine: imagen ligera y cumple el rango de Node que exige Angular 21
FROM node:22-alpine AS build

WORKDIR /app

# Solo dependencias primero -> se aprovecha la cache de capas de Docker.
# npm ci (en vez de npm install): reproducible, usa package-lock.json y falla
# si el lock no cuadra con package.json.
COPY package.json package-lock.json ./

RUN npm ci

# Fuentes de la app + build de produccion
COPY . .

RUN npx ng build Demo-IraCar --configuration production

# -------- FASE 2: servir los estaticos con nginx -------- #
FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf

# Con SSR activado el build genera dist/Demo-IraCar/{browser,server}.
# nginx sirve SOLO el bundle del navegador (igual que Netlify con estaticos).
COPY --from=build /app/dist/Demo-IraCar/browser /usr/share/nginx/html

EXPOSE 80