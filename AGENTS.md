# Ventas-Frontend — Contexto del Proyecto

> Este archivo registra el estado actual del proyecto y las decisiones tomadas. Se actualiza conforme avanzamos. Es el punto de referencia de contexto para continuar el trabajo desde cualquier máquina.

## Stack

- **Angular 21** (standalone, sin NgModules) · **TypeScript ~5.9** · **RxJS 7** · SSR habilitado (`app.config.server.ts`)
- **Angular Material** (`@angular/cdk`, `@angular/material` 21)
- **jsPDF + jspdf-autotable** (generación de tickets PDF)
- **zone.js** (reactivado para change detection clásico, ver 2026-09-10)
- **Vitest** (testing) · **jsdom** · Prettier
- Build: Angular CLI 21 (`ng serve` puerto 4200, sin proxy)
- Nombre del paquete: `demo-ira-car`

## Arquitectura

```
src/app/
├── app.ts / app.html / app.css           → Root (solo router-outlet)
├── app.config.ts                         → providers globales (router, http + interceptor)
├── app.routes.ts                         → rutas (lazy load por componente)
├── core/
│   ├── interfaces/                       → login/, product/, sale/, payment/, cobro/, cash-interface/, user/, purchases/, reports/
│   ├── models/                           → role-model.ts
│   ├── enums/                            → paymentMethod.ts (CASH | DEBIT | CREDIT)
│   ├── utils/storage-utils.ts            → safeGetItem/safeSetItem/safeRemoveItem (SSR-safe)
│   ├── pipes/paginate/paginate.ts        → PaginatePipe (paginación client-side)
│   ├── components/pagination-control/    → PaginationControl (pie de tabla reutilizable)
│   ├── service/                          → auth, product, sale, cash, payment, user, role, category, cobro, ticket, permission, sidebar, provider, purchase, report
│   └── routes/
│       ├── guards/permission-guard.ts    → CanActivateFn por permiso (redirige a /cobro)
│       ├── directives/has-permission-*.ts
│       └── auth-interceptor/auth-interceptor.ts
└── features/
    ├── login/ + forgot-password/ + reset-password/
    ├── charge/  → cobro (POS) + facade/ (sale-facade, cash-facade)   ← NÚCLEO
    ├── sidebar/ (menú lateral reutilizable)
    ├── products/ ← CRUD productos con imagen
    ├── categories/, users/, roles/  ← CRUD completos
    ├── profile/perfil  ← datos + cambio contraseña + logout
    ├── shopping/   → Compras (3 tabs: compras/proveedores/márgenes)  ← IMPLEMENTADO
    ├── reports/    → Reportes (Chart.js + export PDF/XLSX)            ← IMPLEMENTADO
    ├── salehistory/→ Historial de ventas (ruteado + paginado)         ← IMPLEMENTADO
    └── placeholders: cash/, sales/, clients/, invoices/
```

**Componentes funcionales**: Login, ForgotPassword, ResetPassword, Cobro (POS), Perfil, Productos, Categorias, Usuarios, Roles, Compras (3 tabs), Reportes, Salehistory, Sidebar.
**Placeholders**: Caja, Ventas, Clientes, Facturas.

## Backend conectado

- Backend: `Ventas-Backend` (carpeta hermana), Spring Boot en **`http://localhost:8081/api`**
- `environment.ts` (dev): `api: 'http://localhost:8081/api'` · `environment-prod.ts`: `https://TU-APP.up.railway.app/api` (placeholder a reemplazar)
- Peticiones directas (sin proxy). CORS del backend solo permite `http://localhost:4200`.
- JWT: interceptor funcional `AuthInterceptor` agrega `Authorization: Bearer <token>` a cada request. Token y usuario en `localStorage`.

## Módulos clave

### POS (`/cobro`) — features/charge
- `cobro.ts` delega a `facade/sale-facade.ts` (511 líneas): carrito, búsqueda, barcode, métodos de pago, modal tarjeta, **polling de estado de pago cada 5s**, generación de ticket PDF, venta en efectivo.
- `facade/cash-facade.ts`: abrir/cerrar caja, resumen/corte, diferencia preliminar.
- `CobroService`: carrito en memoria (`BehaviorSubject<CobroItem[]>`), valida stock.
- `TicketService`: genera PDF con jsPDF.

### Servicios (HTTP) — core/service
| Servicio | Base | Uso |
|---|---|---|
| `AuthService` | `/auth` | login, forgot/reset/change-password, me/authorities · token/user en localStorage |
| `ProductService` | `/products` | GET (con `?category=`), POST/PUT **multipart**, DELETE, barcode, search |
| `SaleService` | `/sales` + `/products` | processSale, catálogo POS, barcode, search, historial |
| `PaymentService` | `/payments` | status/{tx} (polling), retry, reverse |
| `CashService` | `/cash` | active, open, close, summary |
| `UserService` | `/users` + `/roles` | CRUD usuarios, activar/desactivar, combo roles |
| `RoleService` | `/roles` | CRUD |
| `PermissionService` | `/permissions` | lista de permisos (agrupados por módulo en Roles) |
| `CategoryService` | `/categories` | CRUD (incluye `updateCategory`) |
| `ProviderService` | `/providers` | CRUD proveedores (Compras) |
| `PurchaseService` | `/purchases` | listar/byProvider/crear/cancelar compras |
| `ReportService` | `/reports` | trend, top-products, payment-methods, categories, low-stock, summary · `ReportGroup = DAY|MONTH|YEAR` |
| `CobroService` | — | carrito local (sin HTTP) |
| `TicketService` | — | PDF (sin HTTP) |

### Autenticación / permisos
- `PermissionGuard` (CanActivateFn) valida `route.data.permission` contra `user.permissions` de localStorage; sin permiso redirige a `/cobro`.
- Directiva `*hasPermission` para ocultar/mostrar UI según permisos.
- Rutas con `data.permission` en `app.routes.ts`: clientes, compras, facturas, productos, reportes, usuarios, ventas, caja, categorias, roles, salehistory.
- **Sesión**: `AuthService.isLogged()` rechaza JWT expirados (claim `exp`); el `AuthInterceptor` maneja el 401 global (limpia sesión y lleva a `/`).

## Registro de cambios / decisiones

### 2026-09-13 — Revisión completa del proyecto (actualización de contexto)

> Esta sesión solo actualizó `AGENTS.md` al estado real. Nada del código cambió.

#### Lo que ya existe (confirmado en la revisión)
- **Módulo Compras** (`features/shopping/compras.ts`, ruteado `/compras`, permiso `VER_COMPRAS`): 3 pestañas (Compras/Proveedores/Márgenes). Historial con renglones expandibles, filtro por proveedor + paginación; modal "Nueva compra" con renglones (`LineaCompra[]`), `compraValida` y permisos `CREAR_/CANCELAR_/EDITAR_/ELIMINAR_/VER_PROVEEDORES`, `VER_REPORTES` (márgenes). Usa `ProviderService`, `PurchaseService`, `ProductService`, `ReportService` y `PaginatePipe`/`PaginationControl`.
- **Módulo Reportes** (`features/reports/reportes.ts`, ruteado `/reportes`): **Chart.js** (registerables, solo `PLATFORM_ID` browser) + **jsPDF/autoTable** + **xlsx** (exportaciones 100% client-side). Filtros desde/hasta/agrupación (`DAY|MONTH|YEAR`)/topN/threshold; tarjetas resumen, stock bajo, corte de caja con imprimir/PDF/Excel. Deps nuevas: `chart.js ^4.5.1`, `xlsx ^0.18.5`.
- **Salehistory** (`features/salehistory/salehistory.ts`, ruteado `/salehistory`): listado de `GET /api/sales` paginado (pageSize 10), `formatPaymentMethod()`.
- **POS**: reintento de pago con tarjeta (`pendingPaymentId` → `retryCardPayment`), buscador de tarjeta en modal, botones de estado de pago.
- **`CategoryService`** ahora tiene `updateCategory(id, name)`.
- **CSS**: `.search-bar` del POS estilizado como tarjeta (igual a `.cash-info`), fix `box-sizing` en inputs.
- Estructura actualizada: `core/utils/storage-utils.ts`, `core/pipes/paginate/`, `core/components/pagination-control/`, servicios `sidebar/provider/purchase/report`.

#### Verificación de esta sesión
- `npx ng build --configuration development`: OK.
- `npx ng test --watch=false`: 15 pasan / 4 fallan (pre-existentes, falta provider `ActivatedRoute`).
- `git log --oneline -15`: hasta `56eb506 Deploying` (el repo incluye commits de mejora de frontend, colapso de menú, ticket).

### 2026-09-12 — Seguridad + preparación para Netlify/Railway (frontend)

> Nota importante: este archivo ahora está en `.gitignore` (no se sube al repo). Las notas siguen vivas localmente.

#### Cambios de seguridad (frontend)
- **`core/utils/storage-utils.ts`** (nuevo): helpers `safeGetItem/safeSetItem/safeRemoveItem` con guard `typeof window === 'undefined'` → el código no peta en SSR/prerender (Netlify build) ni en servidores Node.
- **`AuthService`**: usa los helpers seguros; `getUser()` hace `JSON.parse` con try/catch (localStorage manipulado no rompe la app); `isLogged()` ahora decodifica el payload del JWT y **rechaza tokens expirados** (claim `exp`), no solo la presencia del token.
- **`AuthInterceptor`**: lee el token con helper seguro y agrega **manejo global de 401** → limpia sesión y redirige a `/` (antes el token vencido dejaba la app "logeada" con errores). Excluye `/auth/login`, `forgot-password`, `reset-password` (su 401 es un fallo de credenciales normal).
- **Imágenes de productos** (`imageUrl()` en `productos.ts`): si `p.img` es relativo (backend en Railway) se completa contra `environment.api`; si es absoluto se usa tal cual → las imágenes sobreviven al cambio de dominio.
- **Aún pendiente (backend)**: autorización server-side de permisos (hoy el frontend lee `permissions` de localStorage, manipulable; el backend DEBE validar el JWT por endpoint). CORS del backend debe permitir el origen Netlify.

#### Despliegue Netlify + Railway
- **`angular.json`**: agregado `fileReplacements` en production → el build de producción usa `environment-prod.ts` (antes `environment-prod` era código muerto y todo apuntaba a `localhost:8081`).
- **`environment-prod.ts`**: `api: 'https://TU-APP.up.railway.app/api'` (HTTPS obligatorio: Netlify bloquea mixed content). Reemplazar al crear la app en Railway.
- **`public/_redirects`**: `/*  /index.html  200` (SPA fallback). Se copia al output vía `assets` en `angular.json` (`input: public, output: /`). **Sin esto, recargar `/productos` da 404 en Netlify.**
- **`Dockerfile`**: `node:22-alpine`, `npm ci`, copia `dist/.../browser` a nginx (mismo resultado que Netlify estático).
- **`nginx.conf`**: SPA fallback + cache 1 año para assets con hash + headers de seguridad.
- **`.dockerignore` / `.gitignore`**: excluyen `.env*`, `coverage`, `*.log`; **`.gitignore` ahora incluye `AGENTS.md`** (ya no se trackea).
- Comando build Netlify: `npx ng build` (default production → usa `environment-prod.ts`); publish dir: `dist/Demo-IraCar/browser`.

### 2026-09-12 — Filtros client-side en tablas CRUD

- **Barra de filtros**: nueva clase compartida `.table-filter-bar` / `.table-filter-field` / `.filter-select` en `src/styles.css`. Va como **primer hijo de `.table-card`** (arriba de `.table-scroll`), con el mismo lenguaje visual que el pie de paginación (fondo `#1e293b` + `border-bottom`); las etiquetas se ven sobre cada select.
- **Enfoque**: filtro **client-side** con getters en el componente (lista completa ya cargada). El template usa `*ngFor="let p of filteredProducts | paginate: page : pageSize"` y `[total]="filteredProducts.length"` (el pie pagina la lista **filtrada**, no la completa).
- **Productos** (`filteredProducts`): dropdown con las categorías de `categories`; `selectedCategory: number | null` (null = "Todas"); compara `p.categoryId === selectedCategory`.
- **Usuarios** (`filteredUsers`): dos dropdowns combinados con **AND** → `selectedRole` (`user.roleId`) y `selectedState: boolean | null` (`user.active`, true=Activo/false=Inactivo).
- **Detalle técnico**: los `<option>` usan **`[ngValue]`** (no `[value]`) para que el valor del select sea `number`/`boolean` real y la comparación estricta `===` del getter funcione. `(ngModelChange)` llama a `onCategoryFilterChange()` / `onFilterChange()` que resetean `page = 0` al cambiar el criterio.
- Verificación: build sin warnings; tests 15 pasan / 4 fallan (pre-existentes, `ActivatedRoute`).

### 2026-09-12 — Paginación client-side en tablas CRUD

- **Nuevo pipe**: `src/app/core/pipes/paginate/paginate.ts` (`PaginatePipe`, standalone, pure). Uso: `*ngFor="let p of list | paginate: page : pageSize"`. Clampa la página fuera de rango (si se borra el último item de una página no se queda en una tabla vacía).
- **Nuevo componente**: `src/app/core/components/pagination-control/` (`PaginationControl`, selector `app-pagination`, standalone + `CommonModule`). Inputs: `total`, `pageSize`, `page`; output `pageChange`. Muestra "Mostrando X–Y de Z", "Página N de M" y botones ← Anterior / Siguiente → deshabilitados en extremos.
- **Decisiones**:
  - Los servicios ya cargan todos los registros → **paginación client-side** (sin tocar backend).
  - El estado `page` vive en cada componente CRUD (`page = 0; pageSize = 8;`); el pie solo emite la página nueva con `(pageChange)="page = $event"`.
  - La barra va **dentro de `.table-card`, tras `.table-scroll`** → `overflow:hidden` de la tarjeta redondea sus esquinas inferiores; se integra con fondo `#1e293b` + `border-top`.
  - El carrito del POS (`cobro`) **no** se pagina: es un carrito vivo, no una tabla de registros.
- **Integrado en**: productos, categorias, usuarios, roles (cada uno importa `PaginatePipe` + `PaginationControl` y usa el pie en el template).
- Verificación: `npx ng build --configuration development` compila sin warnings. Tests: 15 pasan / 4 fallan (pre-existentes, missing provider `ActivatedRoute`).

### 2026-09-10 — Fixes UI/UX + Change Detection + Animations

#### 1. SidebarService (estado compartido del menú lateral)
- **Nuevo servicio**: `src/app/core/service/sidebar-service/sidebar-service.ts` (`providedIn: 'root'`)
- **Problema**: cada componente tenía su `menuOpen` local → no se sincronizaba al navegar.
- **Solución**: singleton con `menuOpen` + suscripción a `router.events`.
- **Detalle técnico**: usa `NavigationStart` (no `NavigationEnd`) para que el cierre del menú **empiece al hacer clic** en un item del menú, dando tiempo a que la animación de 800ms termine antes de que cargue el nuevo componente.
- **Componentes actualizados** (10): `sidebar`, `cobro`, `productos`, `categorias`, `usuarios`, `roles`, `caja`, `ventas`, `clientes`, `reportes`, `facturas`. Todos inyectan `SidebarService` y bindean `sidebar.menuOpen`.

#### 2. Reactivación de Zone.js (fix renderizado tablas + caja)
- **Causa raíz**: Angular 21 usa **zoneless por defecto** (sin `zone.js`). En zoneless, los callbacks de `HttpClient.subscribe()` **no disparan change detection** → `this.products = data` no redibuja la tabla hasta un clic del usuario.
- **Fix**: 
  1. `npm install zone.js @angular/ssr@21.2.1`
  2. `angular.json`: `"polyfills": ["zone.js"]`
  3. `app.config.ts`: `provideZoneChangeDetection()` en providers
- **Resultado**: `fetch`/`XMLHttpRequest` parcheados por zone.js → cada respuesta HTTP dispara CD automático → tablas y estado de caja aparecen **al instante**.

#### 3. Animaciones suaves
- **Sidebar**: `transition: width 800ms ease-in-out, padding 800ms ease-in-out` en `src/styles.css:48` (colapso/expand natural, no "robusto").
- **Tablas CRUD**: clase `.fade-in` (`@keyframes fade-in-up 250ms ease-out`) aplicada en `productos`, `categorias`, `usuarios`, `roles` vía `<div *ngIf="!loading" class="table-container fade-in">`.
- **Skeleton/shimmer** disponible en `src/styles.css:178-190` para futuro loading percibido.

#### 4. Comentarios técnicos en código
- Agregados comentarios explicativos en `SidebarService`, `sidebar.html`, `cobro.html`, y todos los 10 HTMLs de componentes (`productos`, `categorias`, `usuarios`, `roles`, `caja`, `ventas`, `clientes`, `reportes`, `facturas`) explicando:
  - Origen de `sidebar.menuOpen` (servicio compartido)
  - Funcionamiento de `[class.collapsed]` y transicion CSS
  - Animacion `.fade-in` en tablas

### 2026-09-09 — Sincronización con backend
- **Imágenes de productos**: el backend ahora devuelve la **URL completa** en `img` (`http://localhost:8081/api/uploads/<archivo>`). El frontend usa `[src]="p.img"` directo en `productos.html` → funciona sin cambios.
- Backend corrigió: `@EnableScheduling`, `CategoryRepository.findByName`, almacenamiento real de imágenes.

## Pendientes / issues conocidos

- ⚠️ **`retryPayment` y `reversePayment`**: `reversePayment` sigue sin uso en componentes (el retry sí se usa en el POS).
- **Placeholders sin implementar**: Caja, Ventas, Clientes, Facturas.
- Alert/confirm nativos en Compras y en el reintento de pago del POS (consistencia → MatSnackBar/MatDialog).
- Salehistory sin filtros (rango de fechas / método de pago) — suscribir más adelante.
- Sin unsubscriptions (`takeUntil`) en componentes con múltiples suscripciones HTTP.
- Warnings CommonJS de build por jsPDF/canvg/xlsx → posible `allowedCommonJsDependencies` en `angular.json`.
- `environment-prod.ts` está en placeholder `https://TU-APP.up.railway.app/api` → reemplazar al crear la app en Railway.
- Estrategia de imágenes aún sin validación de tipo/contenido en backend.
- **Aún pendiente (backend)**: autorización server-side de permisos (el frontend lee `permissions` de localStorage, manipulable; el backend DEBE validar el JWT por endpoint). CORS del backend debe permitir el origen Netlify.

## Cómo ejecutar

```sh
npm install            # dependencias
npm start              # ng serve → http://localhost:4200
npm run build          # build producción (SSR prerender)
npm test               # ng test (vitest)
```