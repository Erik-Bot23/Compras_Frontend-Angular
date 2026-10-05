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

- Backend: **`Compras-Backend`** (carpeta hermana), Spring Boot en **`http://localhost:8081/api`**.
- ⚠️ **Prefijo obligatorio: `/api/local`**. El backend dividió sus rutas en dos dominios (ver `docs/PLAN.md` en el backend):
  - `/api/local/**` → POS y gestión del **empleado**. **Es lo que consume ESTA app.**
  - `/api/tienda/**` → storefront del **cliente** (Next.js, `Compras-Frontend-Cliente`). Nace en la Fase 3. No la uses aquí.
- Por eso `environment.ts` expone **`apiLocal`** (= `${api}/local`) y los 12 servicios HTTP usan `${environment.apiLocal}/...`.
  `environment.api` sigue exportado solo como raíz (de él saldrán `${api}/tienda/...` y `${api}/uploads`).
  👉 **Regla: en un servicio nuevo usa `${environment.apiLocal}`, NUNCA `${environment.api}` directo.**
- `environment.ts` (dev): `api: 'http://localhost:8081/api'` (y `apiLocal` derivado) · `environment-prod.ts`: `https://compras-backend-production-c115.up.railway.app/api` (ya reemplazado el placeholder).
- Peticiones directas (sin proxy). CORS del backend permite `http://localhost:4200` (esta app) y `http://localhost:3000` (Next.js).
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

### 2026-10-05 (3) — V10: los filtros de caja no borran la tabla, y el corte es de la caja elegida

> Encargo: que al elegir un usuario la tabla no desapareciera y la lista de usuarios
> no se redujera; y que el corte mostrara la caja filtrada. Explicación completa del
> flujo de consultas en **`docs/Consulta-de-caja-frontend-backend-BD.pdf`** (10 páginas).
> Verificado con `npx ng build --configuration development` en verde.
> **Sin cambios de backend**: el corte se arma sumando lo que la tabla ya recibía.

#### 1. Los tres bugs, y que ninguno estaba donde se miraba

| Síntoma | Capa culpable | Arreglo |
|---|---|---|
| La tabla desaparece al filtrar usuario | `cashBoxReport = null` + `*ngIf` que envolvía también el desplegable | `boxLoading`: la tabla se queda, atenuada, con `pointer-events: none` |
| El desplegable se queda con 1 opción | Backend: `continue` en turnos sin ventas del usuario → llega un subconjunto | Solo se reconstruye el roster si el recorte **no** fue por usuario |
| El corte muestra el turno equivocado | `/cash/summary` → `findByActiveTrue()`: el turno abierto, no la caja | Suma de `CashBoxSessionDTO.sessions` |

🔑 **El segundo era una consecuencia del primero y del tercero, no un bug aparte.** Los
tres se explican (y se documentan) en `docs/Consulta-de-caja-frontend-backend-BD.pdf`.

#### 2. `filtradoPorUsuario` y `reporteFiltrado` NO son la misma pregunta

Es la corrección que más fácil se hace mal. El roster se reconstruye con los `sellers`
que llegan, así que solo se reconstruye cuando la respuesta trae a todo el mundo:

| Filtro | Qué llega | ¿Roster? |
|---|---|---|
| Solo fechas | Turnos del rango, con todos los que vendieron en él | ✅ se reconstruye |
| Usuario | Solo los turnos de ese usuario | ❌ se queda |

Usar un único getter para las dos cosas dejaba el desplegable en "Todos" y nada más
**siempre que hubiera fechas**, que es el caso común: se rompía el caso importante para
arreglar el que no importaba. `reporteFiltrado` (cualquier filtro) sigue mandando en la
diferencia del corte, que sí es otro tema: no es calculable si no se está viendo la caja
entera.

#### 3. El rango de fechas es compartido, y ahora sí recarga

`applyFilters()` no tocaba la tabla de turnos: cambiar las fechas movía las gráficas y la
caja seguía con el rango anterior. El comentario del código ya decía que las fechas eran
las mismas a propósito, así que ahora `applyFilters()` recarga el reporte si hay caja
elegida.

#### 4. El corte es una suma, no una consulta

`CajaCorte` se calcula en `calcularCorteDeCaja()`, en el mismo callback que llena la tabla,
así que **no puede quedar desfasado de lo que se ve arriba**. Sin endpoint nuevo, sin
petición extra.

🔑 **La diferencia solo se suma sobre turnos CERRADOS.** Con filtro el backend la manda en
`null`, y un turno abierto todavía no tiene diferencia: sumarlos como cero daría un total
más chico sin que nada lo advierta. Con filtro o sin turnos cerrados va `null` y se
muestra `—` con su nota, nunca `$0.00`.

#### 5. `.cash-summary` / `.cash-row` subieron a `styles.css`

Estaban en `charge/css/cobro.css` y ahora los usan **dos** componentes. El corte viejo usaba
`.corte-row`: una columna de 420 px con 9 montos apilados, el doble de alto que el modal de
cobro, con el total debajo de todo. Se reutilizó la clase del modal en vez de copiarla.

🔑 Imprimir, PDF y Excel usan el **mismo getter `corteRotulo`**: si cada uno escribiera su
propio encabezado, el papel y la pantalla podrían discrepar sin forma de saber cuál es el
bueno.

### 2026-10-05 (2) — V9: las validaciones avisan EN EL CAMPO, no con un `return` mudo

> Encargo: que al guardar con un campo vacío avise, y que producto exija nombre,
> precio y stock. Contraparte backend: ya commiteada en `a672cef "Validación de
> campos"`, **esta vez sin cambios de backend**. Verificado con
> `npx ng build --configuration development` en verde.
> Documento: **`docs/Validacion-campos-y-avisos-en-linea.pdf`**.

#### 1. El síntoma y su causa: el `return` sin mensaje

Cinco formularios frenaban el guardado con un `return` y **cero aviso**:

```ts
if(!this.formProvider.name.trim() || !this.formProvider.rfc.trim()) return;
```

🔑 **Un `return` silencioso es indistinguible de un no-op.** El usuario aprieta
Guardar, no ocurre nada, y no sabe si falló el guardado, si el botón no sirve o
si ya se guardó. Los `<span class="error-msg">` **ya existían** en los cinco
formularios: lo que faltaba era que **nadie escribiera en `errores`**, porque
`validarTexto`/`validarRfc` sin el flag `obligatorio` trataban el vacío como
**válido** (`ok()`), así que el `delete` borraba el error y el mensaje jamás
aparecía.

| Archivo | Antes | Ahora |
|---|---|---|
| `categorias.ts:113` | `if(!this.categoryName.trim()) return` | `validarNombre()` + `if(this.errores['name']) return` |
| `roles.ts:176` | `if(!this.roleName.trim()) return` | igual (también en `updateRole()`) |
| `usuarios.ts:190` | snackbar de contraseña | `validarFormulario()` inline |
| `compras.ts:407` | `if(!name.trim() \|\| !rfc.trim()) return` | `validarFormularioProveedor()` |
| `productos.ts` | `name` **sin validar** | `validarTexto(..., 'nombre', 80, true)` |

#### 2. `validadores.ts`: los flags que faltaban

Se agregaron parámetros opcionales, **todos con default que preserva el
comportamiento anterior** para no romper los 12 servicios que los usan:

```ts
validarTexto(valor, campo, max, obligatorio = false)
validarEmail(valor, obligatorio = false)
validarPassword(valor, obligatorio = false)
validarRfc(valor, obligatorio = false)
validarEntero(valor, campo, min = 0)
validarPrecio(valor, campo, min = 0)
```

🔑 **`min = 0` por default en precio/entero es a propósito, NO un descuido.**
`cash-facade.ts:159` valida el monto inicial de caja con `validarPrecio()`, y ese
dinero **puede ser 0** (caja que abre sin fondo). Si el default fuera 1, abrir
una caja sin efectivo quedaría bloqueado. Productos es quien pasa `min = 1`
explícitamente.

#### 3. Producto: `novalidate` es lo que hace funcionar el aviso

`productos.html` pasó de `min="0"` a `min="1"` en precio y stock, y el `<form>`
recibió `novalidate`:

```html
<form class="form-card" (ngSubmit)="save()" novalidate ...>
```

🔑 **Sin `novalidate` el `min="1"` del navegador bloquea el submit antes de que
Angular vea nada**, y el usuario ve la burbuja nativa del navegador (un globito
gris, en inglés, sin decir qué campo es) en vez de nuestro mensaje en rojo
debajo del campo. Los
dos avisos se pelean: el nativo gana porque ocurre primero. `novalidate` no
desactiva la regla —el `min` sigue sirviendo para el spinner y el teclado— solo
le quita la autoridad de frenar el formulario, que es ahora de `validarCampo()`.

#### 4. Orden de mayúsculas y validación: un método, no dos `(input)`

`productos.html` y `compras.html` tenían **dos atributos `(input)` en la misma
etiqueta** (el RFC incluso tenía tres). Angular los dispara en orden de
plantilla, pero `ngModel` actualiza su propio valor por su cuenta:

```html
(input)="aMayusculas($event)" (input)="validarCampo('sku')"
```

🔑 Si el orden queda al revés, la validación corre contra el texto **sin
mayúsculas** de `form.sku` mientras la caja ya muestra mayúsculas. Se unificó en
un método: `onInputSku()`, `onInputRfc()`, `onInputProviderName()` — mayúsculas
primero, validación después, en ese orden y en el mismo turno del evento.

#### 5. El `0` del stock: el que escribe, decide

`validateNumber()` de productos **corregía en silencio** (`if(stock < 0) stock = 0`)
y el template lo tenía en `(input)`. Se desacopló:

- El template ya llama a `validarCampo('stock')`, que **avisa** y deja el `0`.
- `validateNumber()` se conserva pero **documentado como no usado**, porque
  escribir "0" y que la caja saltara a "1" sin aviso es peor que un error.

🔑 El stock `0` **sí es válido en la base**: un producto vendido hasta agotarse
queda en 0, y ahí no es un error. Lo que no se permite es **crearlo** en 0. Por
eso el `min = 1` va en el formulario, no en el servicio ni en el backend.

#### 6. Dos `<span>` que sobraban y dos que faltaban

| Formulario | Antes | Ahora |
|---|---|---|
| roles | mensaje decía **"nombre de la categoría"** (copy-paste) | "El nombre es obligatorio." |
| usuarios | el campo **correo** no tenía `<span>` (solo nombre y contraseña) | agregado, con `[class.input-error]` |
| productos | **ningún** input tenía `[class.input-error]` | los 5 |
| categorías / roles | los `<span>` existían pero el input **nunca se ponía rojo** | `[class.input-error]` |
| compras (proveedores) | dos `<div class="field">` con **distinto nivel de indentación**, uno sin cerrar | nivelados |

🔑 El `.input-error` faltante es **la** razón de que los mensajes "no aparecieran"
en varios sitios: el texto se pintaba pero sin marcar el campo, y con el input en
su color normal el aviso pasaba desapercibido.

#### 7. `.error-msg` y `.input-error` subieron a `styles.css`

Estaban **duplicados** en `productos.css` y `compras.css`, con `!important` en
ambos. Ahora viven **una sola vez** en el global (`styles.css:459-478`), porque
los cinco formularios los necesitan y ninguno de los dos CSS cubre los otros tres.

🔑 Se conserva el `!important` **a propósito**: los formularios declaran su propio
`border-color` con la misma especificidad (0,1,0) que `.input-error`, así que sin
él ganaría el del componente y el input seguiría viéndose normal.

#### 8. `errores = {}` al resetear, no solo los valores

`resetForm()` (usuarios) y `cancelarEdicionProveedor()` (compras) limpian los
valores pero **no** el mapa de errores. Con el aviso ya visible, el mensaje "El
RFC es obligatorio" sobreviviría a un formulario recién vaciado.

### 2026-10-05 — V8: las 4 tablas centradas (y por qué NO era un problema de cada tabla)

> Encargo: centrar las columnas con su información en la tabla del modal de cajas,
> el reporte de ventas por caja, el historial de ventas y los márgenes de compras.
> Verificado con `npx ng build --configuration development` en verde.
> Documento completo: **`docs/Alineacion-tablas-y-separacion-CSS.pdf`** (9 páginas).

#### 1. La causa NO era de las tablas: era especificidad CSS

🔑 **`src/styles.css:315` y `:333` ya centran todo** lo que vive dentro de
`.table-card` (`.table-card th` y `.table-card td`, ambos `text-align: center`).
Los componentes que redefinen la alineación de sus montos y **no tienen el mismo
peso**, así que unas reglas ganaban y otras no:

| Selector | Peso | ¿Gana al global? | Resultado real |
|---|---|---|---|
| `.table-card td` / `th` | (0,1,1) | — | centro |
| `.money` | (0,1,0) | **NO: pierde** | centro (el global) |
| `th.money` | (0,1,1) | empate: gana por **orden** | **derecha** |
| `.sesiones-table .money` | (0,2,0) | sí | derecha |
| `.sesiones-table thead th` | (0,1,2) | sí | izquierda |

🔑 El descuadre del historial y de compras era **el mismo nombre de clase dando
dos alineaciones distintas**: `<td class="money">` lo resolvía `.table-card td`
(0,1,1), que le gana a `.money` (0,1,0) → **centrado**; `<th class="money">` lo
resolvía `th.money` (0,1,1) → empate exacto, gana por orden → **derecha**.
Título a la derecha, número al centro. Eso era el "título corrido".

#### 2. Los 4 archivos y lo que cambió

| Archivo | Cambio |
|---|---|
| `charge/css/cajas.css` | `.boxes-table th` `left`→`center`; `.fecha-col` +`center`; `.acciones-col` `right`→`center`; `.caja-col` `left`→`center`; `.boxes-actions` `flex-end`→`center` |
| `reports/reportes.css` | `.sesiones-table thead th` `left`→`center`; `thead th.money` y `.money` `right`→`center` |
| `salehistory/salehistory.css` | `.money` y `th.money` `right`→`center` (+ padding simétrico) |
| `shopping/compras.css` | `.money` y `th.money` `right`→`center` (+ padding simétrico) |

🔑 **`center` se declara a propósito en el `th` Y en el `td`.** Apoyarse en el
global sería depender del orden de `styleUrls`, que es frágil: si mañana se mueve
un archivo, la tabla se descuadra sola.

🔑 **El padding pasó a simétrico** (`padding-left` además del `padding-right`
existente). Con el texto centrado, un padding solo de un lado lo descentra hacia el
otro lado. Los `!important` se conservan: ya peleaban con el padding del global y
quitarlos sería un segundo cambio en la misma línea.

#### 3. Lo que NO se tocó (y por qué)

`.sesion-detalle .subtable th` (`reportes.css:687`), `.subtable th`
(`compras.css:422`), `.linea-cabecera span:nth-child(5)` (`compras.css:579`) y
`.modal-total` (`compras.css:832`). Son las subtablas de detalle, el encabezado del
carrito del modal y el total grande del modal: no son columnas de las 4 tablas
pedidas. **Un total de modal a la derecha está bien**; centrarlo sería peor.

#### 4. Los otros 2 encargos YA estaban resueltos

- **Paginación del carrito**: `cartPageSize = 5` (`sale-facade.ts:222`), el
  `*ngFor` con `PaginatePipe` (`cobro.html:132`) y el `<app-pagination>`
  (`cobro.html:174-179`). Es exactamente lo que se pidió; no se tocó nada.
- **Campos obligatorios**: los 5 formularios ya importan `core/utils/validadores.ts`
  y el backend ya lo tiene commiteado en `a672cef "Validación de campos"`
  (`InputValidator.requerido()`/`.requerida()`, `V7__campos_obligatorios.sql`,
  294 tests en verde).
  👉 **Ojo: no existe carpeta `providers/`**: el CRUD de proveedores vive en
  `features/shopping` (`compras.ts:29`).

### 2026-10-04 (2) — V7: los campos obligatorios se avisan en el campo, no al enviar

> Encargo: que no se guarden como `null` el nombre de categoría, de usuario,
> correo, contraseña, de rol, SKU, barcode y nombre/RFC de proveedor.
> Contraparte backend: `Compras-Backend/AGENTS.md` sesión 2026-10-04 (2) +
> `V7__campos_obligatorios.sql`.
> Verificado con `npx ng build` en verde y con 12 peticiones reales a la API.

**Qué cambió acá**: casi nada, y eso es lo correcto. El backend es el que
impone la obligatoriedad; el frontend solo tiene que **avisar antes**.

#### 1. `validarSku()` y `validarBarcode()` ya no aceptan vacío

Estaban en `core/utils/validadores.ts` con `if (!codigo) return ok()`, porque
el 2026-09-28 se decidió que eran opcionales. Ahora devuelven
`fail('El SKU es obligatorio.')`.

🔑 **El motivo de tocar el frontend aunque el backend ya devuelve 400**: sin
esto el usuario llena todo el formulario, aprieta **Guardar** y solo entonces
se le avisa que falta el SKU. La validación de cliente vale por **señalar
DÓNDE** está el error, no por evitar el error: el que lo evita es el backend.

#### 2. Lo que NO se tocó, y por qué

Categoría, rol, usuario y proveedor **ya mandaban sus campos** y sus
formularios ya exigían nombre, correo y contraseña. Se verificó campo por campo
antes de cambiar nada: tocar un formulario que ya funciona introduce regresiones
a cambio de nada.

🔑 El único hueco real del lado del cliente era el del PUT de usuario, y se
corrigió **en el backend** (`UserImpl.updateUser` copiaba el texto crudo), no
acá: el formulario sí mandaba los valores, lo que faltaba era no creérselo.

### 2026-10-04 — V6: el doble Enter del modal de cobro ya no cobra dos veces

> Encargo: que confirmar la venta con doble Enter no genere dos ventas, y
> revisar la paginación del carrito de compras.
> Contraparte backend: `Compras-Backend/AGENTS.md` sesión 2026-10-04 +
> `docs/07-Paginacion-Carrito-e-Idempotencia-Ventas.pdf`.
> Verificado con `npx ng build` en verde y con una prueba real de dos POST
> simultáneos contra Supabase (ambas respuestas dieron la misma venta).

**El bug**: el modal de cobro es un `<form>`; el cajero paga y aprieta Enter. Si
lo aprieta dos veces, el frontend lanzaba **dos** POST a `/sales` y se hacían
**dos ventas**: stock descontado dos veces, dos tickets y el corte de caja
descuadrado.

#### 1. Las dos barreras (y por qué la primera NO alcanza)

| Barrera | Dónde | Qué hace |
|---|---|---|
| `isProcessing` | `sale-facade.ts` + `[disabled]` en `cobro.html` | Evita el 2.º **clic** |
| `claveCobro` | `SaleRequest.idempotencyKey` | El backend reconoce el **reintento** |

🔑 El botón deshabilitado **no arreglaba el bug**: previene el segundo clic,
pero no el caso real, que es que **las dos peticiones ya viajan por la red a la
vez**. También fallaría si el usuario recarga la pestaña o reintenta porque la
respuesta tardó. La barrera 1 protege la **UI**; la 2 protege la **operación**.

#### 2. La clave se genera al ABRIR el modal, no al confirmar

```ts
// sale-facade.ts
private iniciarIntentoDeCobro() {
  this.claveCobro = this.generarClaveCobro();
  this.isProcessing = false;
}

openPaymentModal(){
  ...
  this.iniciarIntentoDeCobro();   // 🔑 aquí, NO en confirmPayment
  this.showPaymentModal = true;
}
```

🔑 Si la clave se generara en `confirmPayment`, **cada Enter tendría su propia
clave** y cada una sería una venta nueva: exactamente el bug. Está escrito en
`openPaymentModal()` para que nadie lo "simplifique" moviéndolo.

- Se genera con `crypto.randomUUID()`, con respaldo de `Math.random()` para
  entornos sin esa API. 🔑 El respaldo **no es criptográficamente seguro** y el
  código lo dice: aquí sirve para evitar un cobro doble, no para proteger un
  secreto.
- El flujo de **tarjeta reutiliza la misma clave** (`cardProcessing` es su
  bandera): elegir tarjeta y luego efectivo sigue siendo **el mismo cobro**.

#### 3. La bandera se libera también en el error

```ts
error: (err) => {
  this.isProcessing = false;   // 🔑 si no, el modal queda bloqueado
  alert(...)                   //    y no se puede reintentar ni cerrar
}
```

🔑 Liberarla solo en el éxito deja el modal inservible cuando el pago se rechaza
(un caso normal, no una excepción).

#### 4. El botón refleja el estado

```html
<button type="submit" [disabled]="sale.isProcessing">
  {{ sale.isProcessing ? 'Cobrando…' : 'Confirmar pago' }}
</button>
```

El `…` (puntos suspensivos) es el feedback de que la pulsación **sí** se
registró: sin él el botón deshabilitado parece que el clic se perdió.

#### 5. Carrito del **POS** (`cobro.html`): ahora sí paginado, a 8 renglones

El encargo era el carrito de **venta**, no el de compras (que ya estaba
paginado desde V5, ver §5 del PDF 06). Aquí sí había que trabajar.

- `sale-facade.ts`: `cartPage`, `cartPageSize = 8` y getters `cartTotalItems`,
  `cartTotalPages`, `cartDesde`, `cartHasta`.
- `cobro.html`: `(sale.cobroItems$ | async) | paginate: sale.cartPage : sale.cartPageSize`
  más el pie `.cart-paginacion`.

🔑 **Los paréntesis alrededor del `async` no son opcionales.** Sin ellos Angular
lo lee como `a | (async | paginate)`, que no existe, y el build falla con
`TS2345`. Por eso el `PaginatePipe` ahora acepta `T[] | null | undefined`: el
pipe `async` devuelve `null` antes del primer valor y la firma `T[]` obligaba a
escribir `| async ?? []` en cada template. El tipo ahora refleja lo que el
código **ya hacía** en su primera línea.

🔑 **8 renglones y no 5**: aquí cada renglón es **una sola línea**; los 5 del
carrito de compras son porque cada renglón ahí tiene 6 columnas y 4 inputs.

🔑 **Cambia una decisión del 2026-09-12.** Estaba escrito que *"el carrito del
POS no se pagina: es un carrito vivo, no una tabla de registros"*. La razón
era válida para la **información** del carrito, pero no para su **altura**: con
30 productos la tabla crecía sin tope y empujaba el botón **Cobrar** fuera de
la pantalla. Paginándolo sigue vivo (mismos botones de +/−/✕) y además queda
acotado.

**Los tres detalles que hacen que se comporte bien:**

| Detalle | Qué pasa sin él |
|---|---|
| `irAPaginaDelProducto(id)` al **agregar** (incluido el **escáner**) | Escanear el producto 12 con la vista en la página 1 lo agrega **invisible**: el carrito "no cambia" a ojos del cajero |
| `ajustarPaginaAlQuitar()` al **quitar/bajar** | Borrar el último renglón de la página 2 deja la vista en una página que ya no existe: carrito vacío |
| `cartPage = 0` tras `cobro.clear()` | Tras cobrar un carrito que estaba en la página 3, la venta siguiente aparece "en la página 3" de un carrito de 1 producto |

🔑 `irAPaginaDelProducto()` calcula la página por **índice real** del producto,
no con "saltar a la última página": agregar un producto **que ya estaba** en el
carrito no crea renglón nuevo (solo sube su cantidad) y ese renglón puede estar
en cualquier página.

🔑 El pie usa un getter `cartPaginaValida` (la página recortada al rango válido)
para los números, no `cartPage` directo. El `paginate` se recorta solo, pero los
números del pie se calculan aparte y sin el recorte podrían salir al revés
("Mostrando 9–3 de 3") si alguna ruta futura olvidara ajustar la página.

El pie tiene `*ngIf` con `length > cartPageSize`: en una venta de dos o tres
productos un control de paginación es ruido, y lo que importa es el botón verde
**Cobrar**.

### 2026-10-01 — V5: paginación del carrito, modal de cajas, historial de caja y filtros de usuarios

> 8 encargos de UI. Todos verificados con `ng build` en verde.
> Explicación completa (backend + frontend) en
> `Compras_Backend/docs/06-Venta-Usuario-y-Historial-Caja.pdf`.

**0. El patrón que se repitió en toda la tanda: los PNG son de 512×512**

Cinco de los ocho encargos eran el **mismo bug**: un `<img>` de `assets/icons/`
sin reglas de tamaño se renderiza a su tamaño natural y revienta el botón por
dentro. Los archivosaffected miden 512×512 (o 128×128).

🔑 **Regla: todo `<img>` de un icono necesita `width`/`height` +
`object-fit: contain`.** Y hay dos familias de íconos que se tratan distinto:

| Familia | Ejemplos | Cómo se pone blanca |
|---|---|---|
| **Un solo color** (silueta) | `menu.png`, `hogar.png`, `izquierda.png`, `derecha.png` | `filter: brightness(0) invert(1)` ✅ funciona |
| **Dos o más colores** | `anadir.png` (cruz verde + contorno negro), `eliminar.png` | 🔑 **NO usar ese filtro**: fusiona los colores en un bloque blanco macizo |

`izquierda.png` / `derecha.png` se verificaron muestreando píxeles: son un solo
color (`0,0,0`) sobre fondo transparente, así que el filtro sí sirve ahí.

**1. `pagination-control.css`: las flechas que reventaban el botón**

El `<img>` ya estaba en el HTML desde hacía semanas; lo que faltaba era el CSS.

```css
.pagination-buttons button {
  display: inline-flex;   /* el <img> y el texto en una fila */
  align-items: center;
  gap: 6px;
}

.pagination-buttons button img {
  width: 14px; height: 14px;
  object-fit: contain;
  flex-shrink: 0;
  filter: brightness(0) invert(1);
}
```

También se apagan con `opacity` al deshabilitar: si solo se atenuara el fondo, la
flecha seguiría en blanco puro y parecería clicable.

**2. Compras: el carrito ahora se pagina (5 renglones) y tiene scroll propio**

Cada renglón de compra tiene 6 columnas y 4 inputs. Con 30 productos el modal
medía más que la pantalla y **"Guardar compra" quedaba inalcanzable**.

```ts
lineasPage = 0;
lineasPageSize = 5;              // 5 y no 8: cada renglón es alto

get lineasIndiceBase(): number {
  return this.lineasPage * this.lineasPageSize;
}
get lineasPagina(): LineaCompra[] {
  return this.lineas.slice(this.lineasIndiceBase,
                           this.lineasIndiceBase + this.lineasPageSize);
}
```

🔑 **El bug de índices que casi no se ve:**

```html
<div class="linea" *ngFor="let l of lineasPagina; let i = index">
  <button (click)="quitarLinea(lineasIndiceBase + i)">   <!-- NO solo i -->
```

La `i` del `*ngFor` es el índice **dentro de la página visible**, no dentro de
`lineas`. En la página 1 coinciden, así que el bug no se ve; en la página 2 el
primer botón borraría el renglón 1 de la página 1.

**Síntoma clásico**: funciona en la primera página y falla en las demás. Por eso
el comentario en el HTML lo explica en mayúsculas.

Otros tres detalles del mismo trabajo:

- **`agregarLinea()` salta a la última página.** Sin eso, agregar el renglón 8
  con `pageSize` 5 lo agrega invisible (página 1) y el botón parece no hacer nada.
- **`quitarLinea()` retrocede una página** si la actual quedó vacía, o el pie
  muestra "Mostrando 11–10 de 10".
- **La cabecera va fuera del bloque con scroll** (`.lineas-cabecera-wrap` con
  `position: sticky`): si se scrolleara con las filas, en el renglón 6 el usuario
  no sabría qué columna está leyendo.
- `lineasPage` es **independiente** de `page` (el de las tablas de la pantalla).
  Si compartieran el número, paginar el carrito movería también la tabla de
  compras.

**3. Modal de cajas: los inputs que se salían de la tarjeta** 🔑

Error propio de esta tanda, y muy instructivo:

```css
.box-form input { width: 100%; }              /* MAL */
.box-form input { width: 100%; box-sizing: border-box; }   /* BIEN */
```

Por defecto los `<input>` usan `content-box`: el `width` se aplica al
**contenido** y el padding y el borde se suman encima. Con 10px de padding y 1px
de borde, el input medía 22px más que la tarjeta. `border-box` incluye padding y
borde en el 100%.

**4. Modal de cajas: los botones de la fila**

La celda pasó de 1 botón a 4, con textos de largo muy distinto.

| Botón | Cuándo | Color | Por qué |
|---|---|---|---|
| `btn-edit` | Siempre | Azul | Acción neutra |
| `btn-del` | `sessionsCount === 0` | **Rojo** | Eliminación real y definitiva |
| `btn-baja` | Con turnos y activa | **Naranja** | No es borrar: el color debe distinguirlo |
| `btn-alta` | Si está dada de baja | **Verde** | Es el inverso de "dar de baja" |

🔑 `.boxes-actions` necesita `flex-wrap: wrap` **y `min-width: 0`**. El
`min-width: 0` es la parte que se olvida: sin él, el ancho mínimo de los hijos
empuja la celda, la tabla se ensancha y las columnas se descuadran.

**5. Modal de cajas: el icono del botón "Crear caja"**

`anadir.png` es una cruz **verde**. Dos decisiones que van juntas:

- **Sin filtro de color** (herecharla la volvería un bloque blanco, ver §0).
- **Fondo oscuro detrás** (`.btn-confirm-open img { background: #0f172a;
  border-radius: 50% }`): cruz verde sobre botón verde es invisible.

**6. Reportes: historial de CAJA en vez de corte de caja**

El cambio estructural: el selector **lista cajas** y la tabla **lista sus
turnos**, con un renglón por turno.

- `cashHistory: CashRegister[]` → `cashBoxes: CashBox[]`
- `selectedCashId` → `selectedBoxId`
- `cashReport: CashReportDTO` → `cashBoxReport: CashBoxReportDTO`
- Servicio nuevo: `reportService.getCashBoxReport(boxId, {from, to, userId})`

**Los dos filtros viven en sitios distintos** (lo pidió el usuario explícitamente):

| Filtro | Dónde | Por qué |
|---|---|---|
| **Caja** | En la barra de filtros general de arriba | Es un filtro de la consulta, como las fechas |
| **Usuario** | Dentro de la sección de caja | Solo tiene sentido respecto a una caja elegida |

🔑 **El filtro de usuario se arma con los `sellers` de las sesiones**, no con el
padrón de usuarios del sistema:

```ts
get boxReportUsers() {
  // ...deduplica por userId sobre todas las sesiones
  // null (ventas sin usuario) va al final: es el caso excepcional
}
```

En un local con 8 empleados, ofrecer los 8 cuando solo 2 trabajan en esa caja
produce 6 opciones que devuelven tabla vacía, y el usuario no puede distinguir
"sin resultados" de "este usuario no vendió aquí".

- **El filtro va al backend**, no al cliente: filtrar en el navegador traería
  todas las ventas de todos los turnos para descartar la mayoría, y los totales
  no coincidirían con los del backend.
- 🔑 **`buildParams` ahora filtra `null`, no solo `undefined` y `''`.** Un
  `<select>` sin opción elegida vale `null`, y `String(null)` es la cadena
  `"null"`, que el backend no puede convertir a `Long` → 400.
- **`difference` es `number | null`**: el template usa `(s.difference ?? 0)`
  porque comparar `null < 0` es error de tipos en Angular.
- `sessionAbiertaId: number | null` — **un turno a la vez**; con dos abiertos la
  tabla duplicaría su alto.
- Al cambiar de caja se limpian el filtro de usuario y el turno desplegado, o
  quedaría un `userId` de la caja anterior.

**7. Usuarios dados de baja: filtros y columnas de fecha**

La pregunta era *"buscar el registro de una persona que se fue"*. Con la tabla
pelada había que revisarla a ojo.

- Filtros: texto (nombre **y** correo), `fromDate`, `toDate`.
- Columnas nuevas: **Alta** y **Baja** (`activatedAt` / `deactivatedAt`).
- 🔑 **Las fechas se comparan como strings `yyyy-MM-dd`, no como `Date`.** El
  orden lexicográfico de ese formato *es* el cronológico, y usar `new Date()`
  con zona horaria (México es UTC-6) desplaza un día los bordes del rango.
- `sinFecha` cuenta sobre la lista **completa**, no la filtrada: si fuera sobre la
  filtrada daría siempre 0 (los que no tienen fecha ya quedaron excluidos) y el
  aviso nunca aparecería.
- Dos estados vacíos **distintos**: "No hay usuarios dados de baja" (dato del
  sistema) vs. "Ninguno coincide con los filtros" (dato sobre lo que escribió el
  usuario; lo que hay que arreglar es el filtro).

**8. Historial de ventas: alinear las columnas con sus datos**

Los `<td class="money">` iban a la derecha pero sus `<th>` a la izquierda: la
tabla se veía corrida aunque los datos estuvieran bien.

🔑 **Regla: si una columna tiene los datos alineados a la derecha, su título
también.** La clase va en el `th` y en el `td` por igual.

Se añadieron `col-id` (centro) y `col-fecha` (`nowrap`, porque
"04/10/2026 14:30" partido en dos líneas hace la fila el doble de alta).

**Verificación**: `ng build` en verde. ⚠️ `ng test` sigue sin encontrar specs por
los paréntesis del path (problema pre-existente, ver más abajo).



### 2026-09-30 — FASE 1: los 12 servicios pasan a `${environment.apiLocal}` (`/api/local`)

> Contraparte del backend: `Compras-Backend/AGENTS.md`, sesión 2026-09-30
> (paquete `ventas`→`compras` + prefijo `/api/local`).

1. **`environment.ts` / `environment-prod.ts`**: se derivó un campo nuevo
   `apiLocal: \`${api}/local\`` a partir del `api` base. Antes había que cambiar la
   URL en 12 servicios al cambiar de host; ahora se cambia en **un** lugar.
2. **Los 12 servicios HTTP** migrados de `${environment.api}/X` a
   `${environment.apiLocal}/X`: `auth`, `cash`, `category`, `payment`,
   `permission`, `product`, `provider`, `purchase`, `report`, `role`, `sale`,
   `user`. Los URLs hardcodeados comentados también se actualizaron a `/api/local`.
3. `environment.api` **se conserva** (es la raíz de la que saldrán
   `${api}/tienda/...` para el storefront y `${api}/uploads`).
4. **No se tocó** ningún componente, template, interface ni spec. `ng build` verde.
5. ⚠️ `ng test` no encuentra archivos: el path del repo tiene paréntesis
   (`Sistema de ventas (comida)`) que rompen el glob de vitest. Es un problema del
   entorno, no del código.

### 2026-09-28 — ✅ YA IMPLEMENTADO (no es plan): Enter en botones, validación de inputs, ticket sin multiplicación, SKU duplicado

> **Estado: los 4 puntos están implementados** en los commits `bfcdb43` y `1aa72b3`
> (`1aa72b3` es el HEAD de `compras-frontend/local`). La versión anterior de este
> archivo lo dejaba como plan; ya no aplica.
> Contraparte backend: `Compras-Backend/AGENTS.md` 2026-09-28 → el 409 por SKU/
> barcode duplicado **también ya está implementado** (commit `1444d87`).
>
> **Lo que quedó PENDIENTE de este plan** (ver "Pendientes / issues" más abajo):
> - `appSelectOnFocus` solo se aplicó en `productos.html`; falta en `cobro.html` y `compras.html`.
> - Arreglos null-safe: `price.toString()` (`TypeError`) y `changePreview` (`$NaN`).
> - Chequeo client-side optimista de SKU duplicado (hoy depende del 409 del backend).
>
> - Origen del reporte: "al hacer clic en un textbox se queda el 0; escribo 56 y
>   queda 056". Solución: `(focus)` → seleccionar todo, o `null` en vez de `0`.

<details>
<summary>Auditoría original (contexto histórico, ya resuelta)</summary>

**Contexto heredado de la auditoría (importante para no re-descubrirlo):**

- El proyecto **NO tiene ni un `<form>`** → `Enter` no hace nada en ningún lado.
- Hay **1 solo `(keyup.enter)`** en toda la app: el escáner de barcode (`cobro.html:26`).
- **Cero reactive forms**: no hay `ReactiveFormsModule`, `FormBuilder`, `Validators` ni
  `FormGroup` en ningún archivo. **Toda** la validación es imperativa dentro de los
  métodos de los componentes, reporta con `alert()`/`confirm()` o `MatSnackBar`.
- `MatSnackBar` solo se usa en **4** componentes: `login.ts`, `forgot-password.ts`,
  `reset-password.ts`, `perfil.ts`. Los CRUDs usan `alert()` nativo.
- `src/styles.css` (407 líneas) **no tiene ninguna clase compartida de input ni de
  botón** — cada componente re-declara su propio `input {}` / `button {}`. Al tocar
  inputs, hay que editar el CSS del componente, no el global.

---

#### 1. `Enter` ejecuta el botón → `<form (ngSubmit)>`

`ngSubmit` es un evento de **`FormsModule`, que todos estos componentes ya importan**
(`productos.ts:20`, `reset-password.ts:10`, …) → **cero cambios en TypeScript**.

`features/login/login.html` (el caso más simple):

```html
  <form class="login-card" (ngSubmit)="submit()">
    <input type="text" name="email" placeholder="Correo electronico" [(ngModel)]="email"/>
    <input type="password" name="password" placeholder="Contraseña" [(ngModel)]="password"/>
    <button type="submit">Entrar</button>
  </form>
```

⚠️ **La trampa**: dentro de un `<form>` todo `<button>` sin `type` es `submit`.
En `productos.html` ya están bien los tres (`type="button"` en `:54` el `+` de
categoría, `:97` el `Cancelar`; el de guardar `:85` hay que pasarlo a `type="submit"`).
**Regla: revisa cada `<button>` que metas dentro del form y ponle `type="button"`
a todos menos al de enviar.**

**Dónde aplicar**: `login.html`, `forgot-password.html` (sacar el `<a routerLink>`
fuera del form), `reset-password.html`, `productos.html`, `usuarios.html`,
`roles.html`, `categorias.html`, `compras.html`, `cobro.html`.

⚠️ En `productos.html` el `<input type="file">` (`:76`) quedaría dentro del form:
probar que `Enter` en un text input no hace submit ignorando el file. Si molesta,
la alternativa rápida es `(keyup.enter)="save()"` en el último input de cada pantalla
(funciona, pero hay que acordarse de moverlo al agregar campos).

---

#### 2. Validación de los textbox

**2.1 Solo números** — Los `type="number"` que ya existen (`productos.html:30`, `:40`,
`compras.html:281-282`, `cobro.html:160/282/324`) **ya rechazan letras nativamente**;
no hay que tocarlos. Lo que NO está protegido son los campos de texto que deberían
ser numéricos: **SKU (`productos.html:62`) y Barcode (`:67`)**, hoy `text` libre.

```html
<input [(ngModel)]="form.sku" inputmode="numeric" pattern="[0-9]*" (input)="soloNumeros('sku')" />
```

```ts
  //productos.ts — deja solo dígitos (se llama en cada tecla)
  soloNumeros(field: 'sku' | 'barcode'){
    this.form[field] = this.form[field].replace(/\D/g, '');
  }
```

Además `compras.html:281-282` (cantidad / costo unitario) tienen `min="1"` / `min="0"`
que son **solo pistas visuales, no se imponen**: agregar `(input)="validarLinea(l)"`:

```ts
  validarLinea(l: LineaCompra){
    l.quantity = Math.max(1, Number(l.quantity) || 1);
    l.unitCost = Math.max(0, Number(l.unitCost) || 0);
  }
```

**2.2 Contraseña mínimo 8 caracteres** — **YA ESTÁ HECHO**, no tocar:
`reset-password.ts:34-37` y `perfil.ts:53-56` (ambos con `MatSnackBar`).

> ⚠️ Aclaración importante: la intención era "solo en resetear y **olvidar contraseña**",
> pero **`forgot-password.html` NO tiene campo de contraseña** (solo el email, línea 6).
> Así que el estado actual (validar en reset-password + perfil, NO en login ni al crear
> usuario) ya cumple lo pedido. ✅ Opcional: contador de caracteres en vivo bajo el input.

**2.3 Que el `0` desaparezca al hacer clic** ← el reporte de QA

Causa raíz: los defaults son `0` y **nadie selecciona el texto al enfocar** → el cursor
va al final y `56` se convierte en `056`.

**Opción rápida** (una línea por input):

```html
<input [(ngModel)]="form.price" type="number" min="1"
       (input)="validateNumber('price')" (focus)="$any($event.target).select()" />
```

**Opción DRY (recomendada)** — nueva directiva `core/directives/select-on-focus.ts`:

```ts
import { Directive, ElementRef, HostListener, inject } from '@angular/core';

/**
 * Selecciona todo el contenido del input al recibir el foco.
 * Sin esto, escribir "56" en un campo que ya tiene "0" produce "056",
 * porque el cursor se posiciona al final en vez de seleccionar.
 * Uso: <input [(ngModel)]="form.price" appSelectOnFocus />
 */
@Directive({ selector: 'input[appSelectOnFocus]' })
export class SelectOnFocus {
  private el = inject<ElementRef<HTMLInputElement>>(ElementRef);

  @HostListener('focus')
  onFocus(): void { this.el.nativeElement.select(); }
}
```

Importarla y sumarla al array `imports` del `@Component`; en el HTML solo el atributo
`appSelectOnFocus`.

**Los 7 inputs con default numérico (todos tienen el bug):**

| # | Archivo:línea | Campo | Default | Nota |
|---|---|---|---|---|
| 1 | `productos.html:26` | Precio | `0` | `validateNumber` **no deja borrarlo**: al vaciar, `null < 1` → lo devuelve a `1` |
| 2 | `productos.html:36` | Stock | `0` | el 0 sí es válido (agotado) |
| 3 | `cobro.html:160` | Efectivo recibido | `cashReceived = 0` (`sale-facade.ts:37`) | al vaciar → `null` → `changePreview` da **`$NaN`** (`sale-facade.ts:490-497`) |
| 4 | `cobro.html:282` | Monto inicial (abrir caja) | `openingAmount = 0` (`cash-facade.ts:17`) | |
| 5 | `cobro.html:324` | Dinero contado (cerrar caja) | `closingAmount = 0` (`cash-facade.ts:20`) | |
| 6 | `compras.html:281` | Cantidad (renglón) | **`1`** | escribir `5` → `15`. Mismo bug |
| 7 | `compras.html:282` | Costo unitario | `0` | |

**Arreglo extra para `price`/`stock` que no se dejan borrar** — `validateNumber`
(`productos.ts:292-298`) no distingue "vacío" de "cero". La versión null-safe exige
cambiar `ProductForm.price`/`stock` a `number | null`
(`core/interfaces/product/product.ts:7-8`) y proteger `save()` (`productos.ts:151-152`),
donde hoy **`price.toString()` lanza `TypeError`** si el campo quedó en `null`:

```ts
    formData.append('price', (this.form.price ?? 0).toString());
    formData.append('stock', (this.form.stock ?? 0).toString());
```

`changePreview` (`sale-facade.ts:495-496`) también necesita `|| 0` para no pintar `$NaN`.

---

#### 3. Quitar la línea de multiplicación del ticket

Es exactamente `core/service/ticket-service/ticket-service.ts:160-168`:

```ts
      if (item.quantity > 1) {
        doc.setFontSize(6);
        doc.setTextColor(150, 150, 150);
        doc.text(`(${item.quantity} x $${item.unitPrice.toFixed(2)} = $${item.subtotal.toFixed(2)})`, 10, y);
        ...
      }
```

**Borrar esas 9 líneas** (queda el `y += 4;` de la fila y el `y += 1;` de la 170).

⚠️ **Consecuencia**: la columna se llama `PRECIO` y muestra el **precio unitario**
(`:157`). Sin la línea de abajo, `3 uds / $10.00` + total `$30.00` obliga al usuario
a multiplicar de cabeza. **Recomendado**: cambiar la columna a **IMPORTE** y mostrar
el subtotal acumulado:

```ts
      doc.text(`IMPORTE`, 68, y, { align: 'center' });   // reemplaza 'PRECIO' en :135
      doc.text(`$${(item.subtotal ?? 0).toFixed(2)}`, 68, y, { align: 'center' });  // reemplaza :157
```

**NO tocar** el bloque de `SUBTOTAL` (`:185-191`): ese es el subtotal de toda la
compra, es otra cosa.

⚠️ La multiplicación que se calcula en `core/service/cobro-service/cobro-service.ts:34`,
`:59` y `:76` **NO se borra** — eso es el total real que ya usa el backend. Solo se
quita la línea *impresa* del PDF.

---

#### 4. Aviso de SKU / Barcode duplicado (frontend)

Contraparte backend en `Compras-Backend/AGENTS.md` (2026-09-28). El backend hoy
devuelve **500 genérico**; el frontend lo **traga en silencio**:

- `productos.ts:171-174` (update) y `:184-187` (create) → solo `console.log`.
  **El usuario no ve absolutamente nada.**

1. **Importar Material en `productos.ts`** (hoy no lo tiene):

```ts
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
// sumarlo al array imports del @Component y al constructor: private snack: MatSnackBar
```

2. **Los 3 `error:`** de `productos.ts:171-174` y `:184-187` pasan de `console.log` a:

```ts
    this.snack.open(err.error?.message || 'No se pudo guardar el producto', 'Cerrar', {duration: 4000});
```

   El backend responde 409 con el mensaje en `err.error.message` (mismo patrón que ya
   usan `deleteProduct` `:255` y `deactivateProduct` `:280` con `alert`).

3. **Opcional (UX instantánea)**: en `save()`, tras `if(this.isSaving) return;`, validar
   contra la lista ya cargada. Es solo ayuda visual — la garantía real es el 409 del
   backend, porque dos usuarios podrían crear el mismo SKU a la vez:

```ts
    const sku = (this.form.sku ?? '').trim();
    if (sku && this.products.some(p => p.sku === sku && p.id !== this.form.id)) {
      this.snack.open(`El SKU "${sku}" ya está en uso por otro producto`, 'Cerrar', {duration: 4000});
      return;
    }
```

4. **Consistencia a futuro**: `productos.ts` mezcla `alert()`, `console.log` y (nuevo)
   `MatSnackBar`. Vale la pena homogeneizar los CRUDs a `MatSnackBar` (ya está en
   `package.json`, ver `reset-password.ts:4`).

**Verificación sugerida**: `npm run build` + `npx ng test --watch=false`, y a mano:
escribir `56` en Precio (debe quedar `56`, no `056`); `Enter` en login; crear 2 productos
con el mismo SKU (debe salir el aviso); POS con 2 unidades del mismo producto (el PDF no
debe mostrar `(2 x $X = $Y)`).

</details>

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
  - ~~El carrito del POS (cobro) no se pagina~~ → **REVISADO el 2026-10-04: SÍ se pagina**, a 8 renglones (`.cart-paginacion`). La razón original ("es un carrito vivo") era válida para la información pero no para la ALTURA: con 30 productos empujaba el botón Cobrar fuera de la pantalla. Ver la sesión del 2026-10-04.
- **Integrado en**: productos, categorias, usuarios, roles (cada uno importa `PaginatePipe` + `PaginationControl` y usa el pie en el template) y el **carrito del POS** desde V6 (solo `PaginatePipe`, con pie propio `.cart-paginacion` porque allí los botones son secundarios frente al botón verde Cobrar).
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

- 🔜 **Fases 2-8 de `docs/PLAN.md`** (backend). La Fase 2 agrega features nuevas acá: `insumos/` (CRUD + alerta de stock bajo) y `pedidos-online/` (panel con STOMP), y renombra `productos` → `platillos`. Antes de escribir código, leer la entrada 2026-09-30 de `Compras-Backend/AGENTS.md`.
- ✅ **Plan de 4 mejoras de UX (2026-09-28)**: ya implementado en `bfcdb43`/`1aa72b3` (Enter en forms, inputs numéricos, ticket sin multiplicación, snackbar de SKU duplicado). Queda pendiente solo el punto 4.5 de abajo.
- ✅ **409 por SKU/barcode duplicado**: el backend ya lo devuelve (`1444d87`); el `MatSnackBar` muestra `err.error?.message`. Ya no se traga el error.
- ⚠️ **Latente**: `productos.ts:151-152` hace `price.toString()` — si un `type="number"` queda vacío (`null`), **lanza `TypeError`**. Arreglar con `?? 0`.
- ⚠️ **Latente**: `sale-facade.ts:495-496` (`changePreview`) pinta **`$NaN`** si el campo "Efectivo recibido" (`cobro.html:160`) se vacía, porque `null - total = NaN`. Arreglar con `?? 0` o un early-return.
- ⚠️ **Latente**: la directiva `appSelectOnFocus` (seleccionar el contenido al hacer clic) solo está aplicada en `productos.html`; falta en `cobro.html` (efectivo recibido, monto inicial, dinero contado) y `compras.html` (cantidad, costo).
- ⚠️ **`ng test` no encuentra specs** en esta máquina: el path del repo tiene paréntesis (`Sistema de ventas (comida)`) que rompen el glob de vitest → "No test files found". No es un defecto del código.
- ⚠️ **Autorización server-side**: `auth.hasPermission()` lee el usuario de `localStorage`, que es manipulable. El backend sí valida con `@PreAuthorize`, pero la UI se puede mostrar de más.
- ⚠️ **`environment-prod.ts`** apunta a `https://compras-backend-production-c115.up.railway.app/api`. Al desplegar en Netlify hay que confirmar ese dominio y que el CORS del backend incluya el de Netlify.
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