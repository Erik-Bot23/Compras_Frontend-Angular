/**
 * Espejo de `model/dto/Cash/*.java`.
 *
 * <p><b>Dos cosas distintas que no hay que confundir (V4).</b> El nombre "caja"
 * se usaba para las dos, y esa ambigüedad fue la que causó el bug que motivó el
 * cambio de modelo:
 * <ul>
 *   <li>{@link CashBox}: la caja FÍSICA del local ("CAJA 1", "CAJA 2"). Es el
 *       inventario: pocas filas, cambian poco.</li>
 *   <li>{@link CashRegister}: un TURNO (una apertura y su cierre). Nace al abrir
 *       y se congela al cerrar. Crece todos los días.</li>
 * </ul>
 * Una caja puede tener muchos turnos. Antes cada fila de turno era "una caja" y
 * su número era único, así que una caja solo se podía abrir una vez.
 *
 * <p>Los importes y fechas del turno son `number | null` porque un turno recién
 * abierto todavía no cerró: `closedAt` y `closingAmount` llegan sin informar.
 */
export interface CashBox {
  id: number;

  /** Número de la caja física, p. ej. "CAJA 1". UNIQUE entre las cajas. */
  number: string;

  /** Descripción libre: "la que está junto a la puerta". */
  description: string | null;

  /** false = dada de baja: deja de ofrecerse al abrir, pero no se borra. */
  active: boolean;

  createdAt: string | null;

  /**
   * Cuántos turnos ha tenido.
   *
   * <p>Es el campo que decide si la caja se puede BORRAR: con 0 turnos no tiene
   * historial y borrarla es limpio; con 1 o más, sus ventas quedan colgando de
   * ella y solo se puede dar de baja.
   *
   * <p>Viene como número y no como `number | null` a propósito: en el backend es
   * un `int` primitivo, así que el JSON siempre trae un número (0 si no hay
   * turnos). Nunca llega `null`.
   */
  sessionsCount: number;

  /** true si tiene algún turno abierto ahora mismo. */
  inUse: boolean;

  /** Cuándo se abrió el último turno, o null si nunca se abrió. */
  lastOpenedAt: string | null;
}

/** Cuerpo de `POST /cash/boxes` y `PUT /cash/boxes/{id}`. */
export interface CreateCashBoxRequest {
  number: string;
  description?: string | null;
}

/**
 * Borrador del formulario de alta/edición de una caja.
 *
 * <p>Es un tipo propio y no un `CreateCashBoxRequest` porque aquí los campos
 * SIEMPRE son cadenas: son valores de un input mientras el usuario escribe, y
 * convertirlos a `null` en cada tecla haría el binding más frágil de lo que
 * aporta. La conversión a `null` se hace una vez, al enviar (ver `saveBox`).
 */
export interface CashBoxForm {
  number: string;
  description: string;
}

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

/**
 * Petición de ABRIR un turno (V4).
 *
 * <p>`number` es el de la caja FÍSICA que se abre, no el de un corte: la caja
 * puede existir desde hace semanas y abrirse hoy por primera vez, o abrirse
 * milésima vez. El fondo tiene un mínimo de 100 y no puede ser negativo.
 */
export interface OpenCashRequest {
  openingAmount: number;
  number: string;
}

/**
 * Petición de CERRAR el turno.
 *
 * <p>`differenceReason` es obligatorio solo si el dinero no cuadra: sin él el
 * backend responde 409 y el turno sigue abierto.
 */
export interface CloseCashRequest {
  closingAmount: number;
  differenceReason: string | null;
}

/**
 * Sugerencia del backend para el número siguiente ("CAJA 7").
 *
 * <p>Viene en un objeto y no como texto pelado porque TypeScript espera una
 * propiedad con nombre.
 */
export interface NextNumberResponse {
  suggestedNumber: string;
}
