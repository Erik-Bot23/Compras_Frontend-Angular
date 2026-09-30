import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  CashRegister,
  CashSummary,
  CreateCashRequest,
  OpenCashRequest,
  CloseCashRequest,
  NextNumberResponse,
} from '../../interfaces/cash-interface/cash-interface';

/**
 * Cliente HTTP del módulo de caja.
 *
 * <p><b>V3: la caja se crea antes de abrirse.</b> Antes solo existía `openCash`,
 * que creaba la caja y le ponía el número en el mismo request. Ahora hay dos
 * pasos: `createCash` registra la caja física y `openCash` elige una de las ya
 * registradas. El motivo es que el número tiene que existir antes de abrir para
 * poder elegirlo de una lista.
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
  //  CREAR y ABRIR (V3)
  // =========================================================================

  /** Registra una caja física nueva. Queda sin abrir hasta que se abra. */
  createCash(request: CreateCashRequest): Observable<CashRegister> {
    return this.http.post<CashRegister>(this.apiUrl, request);
  }

  /** Cajas nunca abiertas: las candidatas para abrir. */
  getAvailable(): Observable<CashRegister[]> {
    return this.http.get<CashRegister[]>(`${this.apiUrl}/available`);
  }

  /** Sugerencia del backend para el número siguiente ("CAJA 7"). */
  getNextNumber(): Observable<NextNumberResponse> {
    return this.http.get<NextNumberResponse>(`${this.apiUrl}/next-number`);
  }

  /**
   * Abre una caja YA registrada con el fondo inicial indicado.
   *
   * <p>El fondo tiene un mínimo de 100 en el backend; aquí solo se avisa para no
   * mandar una petición que va a ser rechazada.
   */
  openCash(openingAmount: number, number: string): Observable<CashRegister> {
    const body: OpenCashRequest = { openingAmount, number };
    return this.http.post<CashRegister>(`${this.apiUrl}/open`, body);
  }

  // =========================================================================
  //  CERRAR
  // =========================================================================

  /**
   * Cierra la caja.
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
  //  Consultas
  // =========================================================================

  getActiveCash(): Observable<CashRegister> {
    return this.http.get<CashRegister>(`${this.apiUrl}/active`);
  }

  getSummary(): Observable<CashSummary> {
    return this.http.get<CashSummary>(`${this.apiUrl}/summary`);
  }

  /** Historial completo, la más reciente primero. Alimenta el filtro de Reportes. */
  getHistory(): Observable<CashRegister[]> {
    return this.http.get<CashRegister[]>(`${this.apiUrl}/history`);
  }

  /** Una caja por su número. El número va codificado porque puede llevar espacios. */
  getByNumber(number: string): Observable<CashRegister> {
    return this.http.get<CashRegister>(`${this.apiUrl}/number/${encodeURIComponent(number)}`);
  }
}
