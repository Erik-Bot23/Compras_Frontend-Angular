import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  CashBox,
  CashRegister,
  CashSummary,
  CreateCashBoxRequest,
  CloseCashRequest,
  NextNumberResponse,
  OpenCashRequest,
} from '../../interfaces/cash-interface/cash-interface';

/**
 * Cliente HTTP del módulo de caja.
 *
 * <p><b>El módulo tiene DOS recursos y no uno (V4).</b> Es la misma distinción
 * que en el backend, y es importante no mezclarlos:
 * <ul>
 *   <li><b>Cajas</b> (`/cash/boxes`): el inventario de cajas físicas del local.
 *       Son pocas y cambian poco. Es un CRUD: listar, crear, editar, dar de
 *       baja y borrar (solo si nunca se abrió).</li>
 *   <li><b>Turnos</b> (`/cash/open`, `/cash/close`, `/cash/active`,
 *       `/cash/summary`, `/cash/history`): la apertura y el cierre. Nacen al
 *       abrir y se congelan al cerrar.</li>
 * </ul>
 *
 * <p>Antes (V3) ambos vivían en la misma ruta y `createCash` creaba un
 * "corte". Ahora una caja se puede abrir todos los días: cada apertura crea un
 * turno nuevo.
 *
 * <p>Todos los métodos usan `environment.apiLocal` y NUNCA `environment.api`
 * directo: el prefijo correcto es el del dominio local del POS.
 */
@Injectable({
  providedIn: 'root',
})
export class CashService {
  private apiUrl = `${environment.apiLocal}/cash`;

  constructor(private http: HttpClient) {}

  // =========================================================================
  //  CAJAS FÍSICAS (V4)
  // =========================================================================

  /**
   * Registra una caja física nueva.
   *
   * <p>No abre un turno ni mueve dinero: solo la da de alta en el inventario.
   * Abrir un turno es {@link openCash}.
   */
  createBox(request: CreateCashBoxRequest): Observable<CashBox> {
    return this.http.post<CashBox>(`${this.apiUrl}/boxes`, request);
  }

  /**
   * Todas las cajas del local, incluidas las dadas de baja.
   *
   * <p>Alimenta la tabla "Ver cajas". Las dadas de baja vienen a propósito: se
   * ven atenuadas y con su número de turnos.
   */
  getBoxes(): Observable<CashBox[]> {
    return this.http.get<CashBox[]>(`${this.apiUrl}/boxes`);
  }

  /**
   * Cajas que se pueden abrir ahora: activas y sin turno abierto.
   *
   * <p>Alimenta el selector de "Abrir caja". Ojo con el criterio: NO son "las
   * que nunca se abrieron" (eso las excluiría para siempre después del primer
   * turno), sino las que están libres en este momento.
   */
  getOpenableBoxes(): Observable<CashBox[]> {
    return this.http.get<CashBox[]>(`${this.apiUrl}/boxes/openable`);
  }

  /** Edita número y descripción de una caja. */
  updateBox(id: number, request: CreateCashBoxRequest): Observable<CashBox> {
    return this.http.put<CashBox>(`${this.apiUrl}/boxes/${id}`, request);
  }

  /**
   * Da de baja una caja: deja de ofrecerse al abrir, pero sus ventas y cortes
   * siguen en el historial. Es reversible.
   */
  deactivateBox(id: number): Observable<void> {
    return this.http.patch<void>(`${this.apiUrl}/boxes/${id}`, {});
  }

  /**
   * Da de ALTA una caja que estaba dada de baja.
   *
   * <p>Reactivar la MISMA caja: conserva su número y todo su historial, no crea
   * una nueva. Por eso el número no queda libre para reutilizar.
   */
  activateBox(id: number): Observable<void> {
    return this.http.patch<void>(`${this.apiUrl}/boxes/${id}/active`, {});
  }

  /**
   * Borra una caja. Solo funciona si NUNCA se abrió.
   *
   * <p>Si ya tuvo cortes, el backend responde 409 con un mensaje que dice "dala
   * de baja". Por eso el template solo muestra este botón cuando
   * `sessionsCount === 0`.
   */
  deleteBox(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/boxes/${id}`);
  }

  /** Historial de una caja: un corte por turno, de la más reciente a la más antigua. */
  getBoxHistory(id: number): Observable<CashRegister[]> {
    return this.http.get<CashRegister[]>(`${this.apiUrl}/boxes/${id}/history`);
  }

  /** Sugerencia del backend para el número siguiente ("CAJA 7"). */
  getNextNumber(): Observable<NextNumberResponse> {
    return this.http.get<NextNumberResponse>(`${this.apiUrl}/next-number`);
  }

  // =========================================================================
  //  TURNOS (abrir / cerrar)
  // =========================================================================

  /**
   * Abre un turno con una caja física ya registrada.
   *
   * <p>El fondo tiene un mínimo de 100 en el backend; el facade lo avisa antes
   * para no mandar una petición que ya se sabe que va a ser rechazada.
   *
   * <p>La misma caja puede volver a abrirse en otro día: cada llamada crea un
   * turno nuevo.
   */
  openCash(openingAmount: number, number: string): Observable<CashRegister> {
    const body: OpenCashRequest = { openingAmount, number };
    return this.http.post<CashRegister>(`${this.apiUrl}/open`, body);
  }

  /**
   * Cierra el turno.
   *
   * @param closingAmount efectivo contado por el cajero
   * @param differenceReason motivo del descuadre. El backend lo exige (409) si
   *        el dinero no cuadra: es la salida de emergencia del corte.
   */
  closeCash(closingAmount: number, differenceReason?: string | null): Observable<CashRegister> {
    const body: CloseCashRequest = { closingAmount, differenceReason: differenceReason ?? null };
    return this.http.post<CashRegister>(`${this.apiUrl}/close`, body);
  }

  // =========================================================================
  //  Consultas de turno
  // =========================================================================

  /** El turno abierto ahora mismo. 404 si no hay ninguno. */
  getActiveCash(): Observable<CashRegister> {
    return this.http.get<CashRegister>(`${this.apiUrl}/active`);
  }

  /** Resumen del corte del turno abierto (lo que va a la hoja de corte). */
  getSummary(): Observable<CashSummary> {
    return this.http.get<CashSummary>(`${this.apiUrl}/summary`);
  }

  /** Historial de turnos, la más reciente primero. Alimenta el filtro de Reportes. */
  getHistory(): Observable<CashRegister[]> {
    return this.http.get<CashRegister[]>(`${this.apiUrl}/history`);
  }

  /** Un turno por su número. El número va codificado porque puede llevar espacios. */
  getByNumber(number: string): Observable<CashRegister> {
    return this.http.get<CashRegister>(`${this.apiUrl}/number/${encodeURIComponent(number)}`);
  }
}