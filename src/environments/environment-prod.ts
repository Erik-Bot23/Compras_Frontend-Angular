// Entorno de PRODUCCION (se usa SOLO para el build de produccion gracias al
// fileReplacements de angular.json; el desarrollo sigue usando environment.ts).
//
// IMPORTANTE: Netlify sirve la app por HTTPS y los navegadores BLOQUEAN
// peticiones a backends http:// (mixed content). Railway expone HTTPS, asi que
// la URL debe ser https:// y sin "/" final.
//
// COMO REEMPLAZAR AL DESPLEGAR:
//  1. En Railway, abre tu servicio del backend → pestaña "Settings" →
//     "Networking" → copia el "Public domain" (p. ej. ventas-backend.up.railway.app).
//  2. Pega esa URL aqui con https:// y sufixo /api.
//  3. En el backend (variable UPLOAD_URL de Railway) la URL de imagenes debe
//     coincidir en el mismo dominio.
export const environment = {
  production: true,
  api: 'https://TU-APP.up.railway.app/api'
};