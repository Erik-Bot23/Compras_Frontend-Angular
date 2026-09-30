// Entorno de PRODUCCION (se usa SOLO para el build de produccion gracias al
// fileReplacements de angular.json; el desarrollo sigue usando environment.ts).
//
// IMPORTANTE: Netlify sirve la app por HTTPS y los navegadores BLOQUEAN
// peticiones a backends http:// (mixed content). Railway expone HTTPS, asi que
// la URL debe ser https:// y sin "/" final.
//
// COMO REEMPLAZAR AL DESPLEGAR:
//  1. En Railway, abre tu servicio del backend -> pestana "Settings" ->
//     "Networking" -> copia el "Public domain" (p. ej. compras-backend.up.railway.app).
//  2. Pega ESA URL aqui con https:// y sufijo /api (sin barra final). Solo
//     cambia este `api`: `apiLocal` se deriva sola con `/local`.
//  3. En el backend (variable UPLOAD_URL de Railway) la URL de imagenes debe
//     coincidir en el mismo dominio.
const api = 'https://compras-backend-production-c115.up.railway.app/api';

export const environment = {
  production: true,
  api,
  // POS/gestion del empleado (Angular). El storefront de Next.js usara
  // `${api}/tienda/...` cuando exista.
  apiLocal: `${api}/local`
};
