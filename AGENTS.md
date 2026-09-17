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
    ├── products/ ← CRUD productos con imagen (+ botón a desactivados)
    ├── categories/, users/, roles/  ← CRUD completos
    ├── deactivated-products/ ← Productos dados de baja (tabla + dar de alta)
    ├── deactivated-users/    ← Usuarios dados de baja (tabla + dar de alta)
    ├── profile/perfil  ← datos + cambio contraseña + logout
    ├── shopping/   → Compras (3 tabs: compras/proveedores/márgenes)  ← IMPLEMENTADO
    ├── reports/    → Reportes (Chart.js + export PDF/XLSX)            ← IMPLEMENTADO
    └── salehistory/→ Historial de ventas (ruteado + paginado)         ← IMPLEMENTADO
```

**Componentes funcionales**: Login, ForgotPassword, ResetPassword, Cobro (POS), Perfil, Productos, Categorias, Usuarios, Roles, ProductosDesactivados, UsuariosDesactivados, Compras (3 tabs), Reportes, Salehistory, Sidebar.
**Placeholders eliminados (2026-09-17)**: Caja, Ventas, Clientes, Facturas (archivos borrados + rutas quitadas de `app.routes.ts`).

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

### 2026-09-17 (2) — Vistas de "Dados de baja" (productos + usuarios)

> Frontend del borrado lógico de **productos** (el backend ya exponía `GET /products/inactive`, `PATCH /products/{id}/deactivate` y `PATCH /products/{id}/active`, con los permisos `DESACTIVAR_PRODUCTOS`/`ACTIVAR_PRODUCTOS`) + reutilización del soft-delete ya existente de **usuarios**. Todas las vistas de baja son simétricas: solo tabla + botón "Dar de alta" + menú sándwich.

#### 1. Productos (`features/products`)
- **Botón destructivo condicional** en la tabla: `ProductDto` ahora devuelve `hasHistory`; si es `false` → botón rojo **"Eliminar"** (borrado físico, `ELIMINAR_PRODUCTOS`); si es `true` → botón naranja **"Dar de baja"** (borrado lógico, `DESACTIVAR_PRODUCTOS`). Cada rama va en su `<ng-container *hasPermission>` porque no se pueden combinar `*ngIf` + `*hasPermission` en un mismo elemento.
- **`deactivateProduct(id)`** en `productos.ts`: confirma, llama al servicio y saca el producto de la lista (el backend deja de devolverlo en `GET /products`).
- **Botón "Ver desactivados"** al extremo derecho de `.table-filter-bar` (clase `.deactivated-link`, `margin-left:auto`, estilo ghost) → `router.navigate(['/productos-desactivados'])`.
- `productos.css`: nuevas clases `.deactivate` (naranja) y `.deactivated-link`.

#### 2. Usuarios (`features/users`)
- **Tabla principal solo activos**: `filteredUsers` filtra `active !== false`; se quitó el filtro de estado (`selectedState` + select) y la columna "Estado"; el botón "Dar de alta" inline se movió a la vista de desactivados. `deactivateUser` ahora **quita** al usuario de la lista (antes solo cambiaba `active = false`).
- **Botón "Ver desactivados"** a la derecha de `.table-filter-bar` → `/usuarios-desactivados`. `.deactivated-link` añadida a `usuarios.css`.

#### 3. Vistas nuevas (scaffolds implementados)
- **`features/deactivated-products`**: tabla de inactivos (`GET /products/inactive`) con `imageUrl()`, paginación (`PaginatePipe` + `PaginationControl`), estado vacío y botón **"Dar de alta"** (`PATCH /products/{id}/active`, permiso `ACTIVAR_PRODUCTOS`).
- **`features/deactivated-users`**: filtra client-side los inactivos de `GET /users` (`active === false`), tabla Nombre/Correo/Rol + botón **"Dar de alta"** (`PATCH /users/{id}/active`, permiso `ACTIVAR_USUARIOS`).
- Ambas incluyen `<app-sidebar>` (menú sándwich) dentro de `.layout` con `[class.collapsed]="!sidebar.menuOpen"` y usan solo `.content` + `.table-container`/`.table-card`/`.table-scroll` (sin formulario ni filtros).
- **Rutas**: `/productos-desactivados` (`VER_PRODUCTOS`) y `/usuarios-desactivados` (`VER_USUARIOS`) en `app.routes.ts` con `PermissionGuard`.

#### 4. Servicios / interfaces / tests
- `ProductService`: + `getInactiveProducts()`, `deactivateProduct(id)`, `activateProduct(id)`. `ProductForm` ahora tiene `hasHistory?: boolean`.
- Specs de las 2 vistas: `fixture.detectChanges()` → `await fixture.whenStable()` (como productos/usuarios) para no disparar el `ngOnInit` con HTTP real en los tests.

#### Verificación
- `npx ng build --configuration development`: OK.
- `npx ng test --watch=false`: **16 archivos / 17 tests, todos pasan**.

### 2026-09-17 — Rediseño de Compras, Reportes e Historial de ventas + limpieza de rutas

> Tanda de diseño sobre los 3 últimos módulos para alinearlos al lenguaje visual de los CRUDs (tarjetas `#1e293b`/borde `#263449`, botones `.edit`/`.delete`/`.cancel`, inputs sólidos `#0f172a`, formato monetario `| number:'1.2-2'`).

#### 0. Limpieza: placeholders eliminados
- Los archivos de **Caja, Ventas, Clientes y Facturas** ya no existían en disco (borrado en `git status`) pero `app.routes.ts` aún los importaba → el build fallaba con `TS2307`. Se quitaron las 4 rutas (`/clientes`, `/facturas`, `/ventas`, `/caja`). El sidebar ya no los enlazaba. Tests pasaron de 18/19 a 14/15 (los 4 specs borrados).

#### 1. Salehistory
- **Badges de método de pago**: `<span class="method-badge">` con `.cash` (verde), `.debit` (azul), `.credit` (morado), en vez de texto plano.
- **Resumen de la lista filtrada**: nueva prop `filteredTotal`/`filteredCount` en `salehistory.ts`; en la barra de filtros se muestra "N ventas · Total: $X" (con `.sales-summary` empujado a la derecha con `margin-left:auto`).
- **Columnas de montos**: clase `.money` (derecha + `font-variant-numeric: tabular-nums`); la columna Total en amarillo semibold.
- `salehistory.css` (antes solo `.empty-row`) ampliado con `.sales-summary`, `.method-badge.*` y `.money`.

#### 2. Compras
- **Tabs**: de botones sueltos a un **control segmentado** (contenedor `#1e293b` con padding, `.tab.active` azul `#2563eb` + sombra).
- **Botones unificados**: `.editRole` → `.edit` (amarillo) en proveedores; los "Cancelar" de proveedores y del modal pasan de `.delete` (rojo) a `.cancel` (gris). `.view` alineado a la familia de botones.
- **Detalle expandible**: de `<div>` dentro de la celda de acciones a **fila completa** con `<ng-container *ngFor>` + `<tr class="detalle-row"><td colspan="5">`, con `.detalle-title` y subtabla estilizada. `toggleDetalle` sin cambios.
- **Estados vacíos** en las 3 tablas (`.empty-row`), incluido mensaje diferenciado con/sin filtro en Compras. Nueva prop `loading` en `compras.ts`.
- **Formato monetario** con `| number:'1.2-2'` en totales/subtotales/márgenes; botón "+ Nueva compra" y `.primary` del modal pasan de verde a azul primario.
- `compras.css` reescrito (tabs, familia de botones, `.detalle`, `.money`, responsive del renglón del modal).

#### 3. Reportes
- **Filtros**: inputs/selects pasan de `rgba(255,255,255,0.06)` a sólido `#0f172a` + borde `#334155` (igual que `.table-filter-field`), focus azul; icono del date picker invertido.
- **Tarjetas resumen**: barra de acento superior (`::before`) por métrica → `.accent-blue` (Ventas), `.accent-green` (Total vendido), `.accent-orange` (Ticket promedio); montos con `$` y subtítulos descriptivos.
- **Gráficas**: header `h3` con `.chart-dot` de color acorde a la paleta de Chart.js (line/doughnut/bar/bar-secondary).
- **Corte de caja**: montos con `$` y `tabular-nums`; `.card` alineada a `.table-card` (borde `#263449`).

#### Verificación
- `ng build` production: OK (solo warning pre-existente `cobro.css` 9.33 kB).
- `npx ng test --watch=false`: **14 archivos / 15 tests, todos pasan**.

### 2026-09-15 — Botones Editar/Cancelar unificados en CRUDs + estilos

> Pequeña tanda posterior a la de tests/filtros. Solo UI de los 4 CRUDs (productos, categorías, usuarios, roles). Nada de backend.

#### 1. Botones "Editar" unificados a amarillo
- **Problema**: en **categorías** el botón editar usaba `class="editRole"`, clase que **no existe** en `categorias.css` (solo hay `.edit` y `.delete`) → quedaba sin estilo. En **roles** `.editRole` sí existía pero era **azul sólido** (`#3b82f6`), distinto al degradado amarillo de productos/usuarios.
- **Fix**: `categorias.html` y `roles.html` ahora usan `class="edit"`. En `roles.css` se reemplazó el bloque `.editRole` azul por `.edit`/`.delete`/`.cancel` con el mismo degradado amarillo `linear-gradient(135deg, #facc15, #eab308)` de los demás CRUDs.
- Resultado: los 4 CRUDs comparten el mismo lenguaje visual de botones de acción.

#### 2. Botón "Cancelar" en edición (productos, roles, usuarios)
- Antes solo **categorías** mostraba un botón cancelar al editar (`*ngIf="editingCategoryId"`). Se replicó el patrón en los otros tres:
  - **productos.ts**: nueva prop `editingProductId: number | null`, se setea en `editProduct()` (`product.id ?? null`), reseteada en `resetForm()`; método `cancelEdit()` que delega en `resetForm()`.
  - **usuarios.ts**: igual con `editingUserId`.
  - **roles.ts**: ya existía `editingRoleId` + `resetForm()` → solo se agregó el botón en el HTML.
- **HTML**: `<button *ngIf="editingXId" class="cancel" (click)="cancelEdit()">Cancelar</button>` tras el botón guardar. El `*ngIf` hace que solo aparezca en modo edición.
- **CSS**: nueva clase `.cancel` (gris `#64748b→#475569`) para no confundirlo con el botón eliminar (rojo). Se agregó a los 4 CSS. El cancelar de **categorías** también pasó de `class="delete"` (rojo) a `class="cancel"` por consistencia.

#### Verificación
- `ng build` production: OK (solo warnings pre-existentes: budget `cobro.css` y CommonJS de canvg/jspdf).
- `npx ng test --watch=false`: 18 archivos / 19 tests, **todos pasan**.

### 2026-09-15 — Suite de tests en verde + filtros en Salehistory + bugs menores

#### 1. Tests: 19/19 en verde (antes 15/19)
- **`app.spec.ts`**: el test "should render title" buscaba `Hello, Demo-IraCar` (plantilla de ng new) → reemplazado por "should render the router outlet" (verifica `<router-outlet>`); se agregó `provideRouter([])`.
- **login/forgot-password/reset-password specs**: fallaban por `NG0201: No provider found for ActivatedRoute` (los templates usan `RouterLink` / los componentes inyectan `ActivatedRoute`). Fix: `providers: [provideRouter([])]` en cada `TestBed`.
- Resultado: `npx ng test --watch=false` → **18 archivos / 19 tests, todos pasan**.

#### 2. Filtros client-side en Salehistory (`features/salehistory`)
- **Estado nuevo**: `fromDate`, `toDate` (inputs `type="date"`) y `selectedMethod: PaymentMethod | null` (select con `[ngValue]`), publicados como `PaymentMethod` para usarlos en el template.
- **Getter `filteredSales`**: filtro con `selectedMethod` (comparación estricta `===`) + rango de fechas comparando **strings `yyyy-MM-dd`** (`saleDate.substring(0,10)`, lexicográfico = cronológico, inmune a timezones).
- **Template**: nueva barra `.table-filter-bar` (primer hijo de `.table-card`, mismo lenguaje visual que productos/usuarios) con un `<input type="date" class="filter-input">` por fecha y el select de método. `(ngModelChange)` → `onFilterChange()` resetea `page = 0`.
- El `*ngFor` y `[total]` ahora usan `filteredSales` (el pie pagina la lista filtrada) + nueva fila "No hay ventas que coincidan con los filtros" cuando hay datos pero ninguno coincide.
- **`styles.css`**: nuevo `.table-filter-field input.filter-input` (espejo del `.filter-select`) + `::-webkit-calendar-picker-indicator` invertido (icono del date picker visible sobre fondo oscuro). Se importó `FormsModule` en el componente.

#### 3. Bugs menores
- Typo `Cmabio` → `Cambio` en mensaje de venta completada (`sale-facade.ts:477`).
- `forgot-password.css`: `width: 350;` (sin unidad) → `350px`.
- `roles.ts`: ahora `export class Roles implements OnInit` (definía `ngOnInit` sin declararlo).
- `perfil.ts`: ya no lee `localStorage.getItem('user')` directo → usa `this.auth.getUser()` (helpers SSR-safe de `storage-utils`, JSON corrompido devuelve null en vez de romper).

#### Verificación
- `ng build` production: OK (solo warning pre-existente `cobro.css` 9.33 kB > 8 kB).
- `npx ng test --watch=false`: 18 archivos / 19 tests, **todos pasan**.

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

- ✅ **Tests**: 19/19 en verde (2026-09-15). Si al clonar falta `chart.js`/`xlsx` en `node_modules`, basta `npm install` (ocurrió 2026-09-15: el `npm test` fallaba con `TS2307`).
- ⚠️ **`retryPayment` y `reversePayment`**: `reversePayment` sigue sin uso en componentes (el retry sí se usa en el POS).
- **Placeholders eliminados (2026-09-17)**: Caja, Ventas, Clientes, Facturas (archivos + rutas borradas).
- Alert/confirm nativos en Compras y en el reintento de pago del POS (consistencia → MatSnackBar/MatDialog).
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