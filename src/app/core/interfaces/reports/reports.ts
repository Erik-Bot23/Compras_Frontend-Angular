import { PaymentMethod } from '../../enums/paymentMethod';

//Espejo de model/dto/Reports/*.java — nombres de campo idénticos a la respuesta JSON.

//Un punto de la tendencia de ventas (GET /api/reports/trend)
export interface PeriodSalesDTO {
  period: string; //"yyyy-MM-dd" (DIA) | "yyyy-MM" (MES) | "yyyy" (AÑO)
  total: number;
  count: number;
}

//Producto más vendido (GET /api/reports/top-products)
export interface TopProductDTO {
  productId: number;
  name: string;
  quantity: number;
  total: number;
}

//Distribución por método de pago (GET /api/reports/payment-methods)
export interface PaymentMethodDTO {
  method: PaymentMethod;
  label: string;
  count: number;
  total: number;
}

//Rendimiento por categoría (GET /api/reports/categories)
export interface CategoryPerformanceDTO {
  categoryId: number;
  name: string;
  quantity: number;
  total: number;
}

//Producto con stock bajo (GET /api/reports/low-stock)
export interface LowStockDTO {
  productId: number;
  name: string;
  sku: string;
  barcode: string;
  category: string;
  stock: number;
}

//Margen de un producto (GET /api/reports/margins): cost (último costo real de
//compras) vs price; marginPercent = ganancia sobre el precio de venta.
export interface MarginDTO {
  productId: number;
  name: string;
  sku: string;
  cost: number;
  price: number;
  margin: number;
  marginPercent: number;
}

//Resumen del rango (GET /api/reports/summary)
export interface ReportsSummaryDTO {
  totalSales: number;
  totalAmount: number;
  averageTicket: number;
  paymentMethods: PaymentMethodDTO[];
}

//Utilidad del periodo (V3, GET /api/reports/profit)
export interface ProfitDTO {
  revenue: number;
  costOfGoodsSold: number;
  grossProfit: number;
  marginPercent: number;
  tickets: number;
  itemsSold: number;
  itemsWithoutCost: number;
}

//Detalle de una caja concreta (V3, GET /api/reports/cash/{cashId})
export interface CashReportDTO {
  cashId: number;
  number: string;
  openedAt: string;
  closedAt: string | null;
  openingAmount: number;
  closingAmount: number | null;
  expectedAmount: number;
  difference: number;
  cashSales: number;
  debitSales: number;
  creditSales: number;
  totalSales: number;
  totalTickets: number;
  grossProfit: number;
  active: boolean;
  sales: SaleDetailHistoryResponse[];
}

//Renglón de venta en el historial (ya existe en la app, se reusa aquí)
export interface SaleDetailHistoryResponse {
  saleId: number;
  saleDate: string;
  total: number;
  paymentMethod: PaymentMethod;
  items: SaleDetailResponse[];
  paymentStatus: string;
  confirmed: boolean;
  confirmedAt: string | null;
  cancelled: boolean;
  cancelledAt: string | null;

  /**
   * Usuario que registró la venta (V5).
   *
   * `null` en las ventas anteriores a V5: el dato nunca se guardó. La tabla
   * muestra "Sin usuario" en vez de "-", para que se lea que es una ausencia
   * real de información y no un campo vacío.
   */
  userId: number | null;
  userName: string | null;
}

export interface SaleDetailResponse {
  product: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  subtotal: number;
}

// =========================================================================
//  HISTORIAL DE CAJA (V5)
// =========================================================================
//  Espejo de `CashBoxReportDTO.java`. Reemplaza a `CashReportDTO` en la
//  pantalla: antes se reportaba UN TURNO suelto y ahora se reporta UNA CAJA con
//  todos sus turnos adentro.

/** Un usuario dentro de un turno, con lo que vendió ahí. */
export interface CashSessionSeller {
  /** null en las ventas anteriores a V5 (no tienen dueño). */
  userId: number | null;
  userName: string;
  tickets: number;
  total: number;
}

/** Un turno (apertura + cierre) de una caja. */
export interface CashBoxSession {
  sessionId: number;
  /** Copia histórica del número de la caja en el momento de abrir. */
  number: string;
  openedAt: string;
  closedAt: string | null;
  active: boolean;

  openingAmount: number;
  closingAmount: number | null;
  expectedAmount: number;

  cashSales: number;
  debitSales: number;
  creditSales: number;
  totalSales: number;

  /**
   * Diferencia del corte.
   *
   * Viene en `null` cuando hay filtros activos: es un dato congelado del
   * cierre, y al lado de un total filtrado mostraría un descuadre que no
   * ocurrió. Por eso la tabla usa `filtrado` para ocultar la columna en vez de
   * pintar un cero engañoso.
   */
  difference: number | null;
  differenceReason: string | null;

  totalTickets: number;
  grossProfit: number;

  sellers: CashSessionSeller[];
  sales: SaleDetailHistoryResponse[];

  /** true = hay al menos un filtro aplicado a este reporte. */
  filtrado: boolean;
}

/** Una caja física con todos sus turnos. */
export interface CashBoxReportDTO {
  boxId: number;
  number: string;
  description: string | null;
  active: boolean;
  sessions: CashBoxSession[];
  /** Total de turnos SIN contar filtros: permite el "3 de 12 turnos". */
  totalSessions: number;
}

/**
 * El CORTE DE CAJA de la sección de reportes: la suma de los turnos que la
 * tabla de arriba está mostrando.
 *
 * <p><b>No viene del backend.</b> `GET /reports/cash-box/{boxId}` ya devuelve
 * todos los montos por turno, así que el total de la caja es una suma. No hay
 * endpoint nuevo ni una petición extra: por eso el corte se actualiza en el
 * mismo turno que llega la tabla y nunca puede mostrar un número de otra caja.
 *
 * <p>🔑 <b>Reemplaza al endpoint `/cash/summary`</b>, que en Reportes estaba
 * mal: `getSummary()` usa `findByActiveTrue()` y devolvía SIEMPRE el turno
 * abierto en ese momento, ignorando la caja seleccionada, el usuario y las
 * fechas. Es decir, la tabla y el corte respondían preguntas distintas.
 */
export interface CajaCorte {
  /** Turnos que se sumaron (los que la tabla muestra). */
  turnos: number;
  /** Turnos ya cerrados de esos. */
  turnosCerrados: number;
  /** El turno sigue abierto: su diferencia todavía no existe. */
  turnoAbierto: boolean;

  openingAmount: number;
  cashSales: number;
  debitSales: number;
  creditSales: number;
  totalSales: number;
  expectedAmount: number;
  totalTickets: number;
  grossProfit: number;

  /**
   * Suma de las diferencias de los turnos CERRADOS.
   *
   * <p>`null` —y la UI muestra "—" en vez de `$0.00`— cuando:
   * <ul>
   *   <li>hay filtros (mismo motivo que en la tabla: la diferencia es un dato
   *       congelado del cierre y al lado de un total filtrado daría un
   *       descuadre inventado), o</li>
   *   <li>todos los turnos visibles siguen abiertos, o sea que todavía no se
   *       cerró ninguno y no hay ninguna diferencia que sumar.</li>
   * </ul>
   */
  difference: number | null;
  /** Motivos de descuadre declarados al cerrar los turnos. */
  differenceReason: string | null;
}