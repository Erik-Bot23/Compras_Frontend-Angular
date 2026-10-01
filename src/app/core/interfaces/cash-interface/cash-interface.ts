/**
 * Espejo de `model/dto/Cash/*.java`.
 *
 * V3: los importes y fechas son `number | null` porque una caja recién
 * creada todavía no abrió. Antes, `openCash` creaba la caja y le ponía todo de
 * golpe, así que todo llegaba siempre informado. Ahora la caja se registra primero
 * (nace con `openedAt`, `openingAmount` y `closingAmount` en null) y después se
 * abre. El frontend tiene que comprobar esos campos antes de mostrarlos, y por
 * eso el tipo lo dice de antemano en vez de fallar en runtime.
 */
export interface CashRegister {
  id: number;

  /**
   * Número de la caja, p. ej. "CAJA 1". Es lo que el usuario reconoce y lo que se
   * muestra en el historial y en el filtro por caja de Reportes. Nonnull desde V3:
   * se asigna al crear la caja, no al abrirla.
   */
  number: string;

  /** null si la caja está creada pero nunca se abrió. */
  openedAt: string | null;

  /** null si la caja sigue abierta. */
  closedAt: string | null;

  /** null si la caja aún no se abrió. */
  openingAmount: number | null;

  /** null si la caja sigue abierta: no se ha contado nada todavía. */
  closingAmount: number | null;

  active: boolean;

  expectedAmount: number | null;
  difference: number | null;

  /**
   * Motivo del descuadre al cerrar (V3). null = el corte cuadró exactamente. Con
   * valor, el cierre se hizo con la salida de emergencia y hay que investigarlo.
   */
  differenceReason: string | null;

  cashSales: number | null;
  debitSales: number | null;
  creditSales: number | null;
  totalSales: number | null;
  totalTickets: number;
}

export interface CashSummary {
  cashId: number;
  openingAmount: number;
  expectedAmount: number;
  difference: number;
  cashSales: number;
  debitSales: number;
  creditSales: number;
  totalSales: number;
  totalTickets: number;
}

/** Petición de CREAR la caja (V3): solo el número. */
export interface CreateCashRequest {
  number: string;
}

/**
 * Petición de ABRIR una caja ya registrada (V3).
 * El fondo tiene un mínimo de 100 y no puede ser negativo.
 */
export interface OpenCashRequest {
  openingAmount: number;
  number: string;
}

/**
 * Petición de CERRAR (V3).
 * `differenceReason` es obligatorio solo si el dinero no cuadra: sin él el
 * backend responde 409 y la caja sigue abierta.
 */
export interface CloseCashRequest {
  closingAmount: number;
  differenceReason: string | null;
}

/**
 * Sugerencia del backend para el número siguiente (V3).
 * Viene en un objeto y no como texto pelado porque TypeScript espera una
 * propiedad con nombre.
 */
export interface NextNumberResponse {
  suggestedNumber: string;
}
