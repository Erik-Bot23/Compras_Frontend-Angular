// URL BASE del backend. NO la uses directo en un servicio: el backend esta
// dividido en dos prefijos (ver AGENTS.md / docs/PLAN.md seccion 1-2):
//
//   apiLocal -> `${api}/local`  POS y gestion. Lo consume el EMPLEADO desde esta
//              app (Angular). Autenticado con JWT de empleado y autorizado por
//              permiso.
//   (futuro)  `${api}/tienda`   Storefront. Lo consume el CLIENTE desde Next.js
//              (Compras-Frontend-Cliente). Nace en la Fase 3 del plan; el
//              catalogo sera publico y de solo lectura.
//
// Se deriva de `api` a proposito: cambiar de host (localhost -> Railway) se
// hace en UN solo lugar y ningun servicio se queda atras.
const api = 'http://localhost:8081/api';

export const environment = {
  production: false,
  api,
  apiLocal: `${api}/local`
};
