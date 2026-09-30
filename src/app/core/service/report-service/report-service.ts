import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  CashReportDTO,
  CategoryPerformanceDTO,
  LowStockDTO,
  MarginDTO,
  PaymentMethodDTO,
  PeriodSalesDTO,
  ProfitDTO,
  ReportsSummaryDTO,
  TopProductDTO,
} from '../../interfaces/reports/reports';

//Agrupación admitida por GET /api/reports/trend
export type ReportGroup = 'DAY' | 'MONTH' | 'YEAR';

@Injectable({
  providedIn: 'root',
})
export class ReportService {
  private api = `${environment.apiLocal}/reports`;

  constructor(private http: HttpClient) {}

  getTrend(from?: string, to?: string, groupBy: ReportGroup = 'MONTH'): Observable<PeriodSalesDTO[]> {
    return this.http.get<PeriodSalesDTO[]>(`${this.api}/trend`, { params: buildParams({ from, to, groupBy }) });
  }

  getTopProducts(from?: string, to?: string, limit = 5): Observable<TopProductDTO[]> {
    return this.http.get<TopProductDTO[]>(`${this.api}/top-products`, { params: buildParams({ from, to, limit }) });
  }

  getPaymentMethodDistribution(from?: string, to?: string): Observable<PaymentMethodDTO[]> {
    return this.http.get<PaymentMethodDTO[]>(`${this.api}/payment-methods`, { params: buildParams({ from, to }) });
  }

  getCategoryPerformance(from?: string, to?: string): Observable<CategoryPerformanceDTO[]> {
    return this.http.get<CategoryPerformanceDTO[]>(`${this.api}/categories`, { params: buildParams({ from, to }) });
  }

  getLowStock(threshold = 10): Observable<LowStockDTO[]> {
    return this.http.get<LowStockDTO[]>(`${this.api}/low-stock`, { params: buildParams({ threshold }) });
  }

  //Márgenes por producto (costo real vs precio), de menor a mayor margen
  getMargins(): Observable<MarginDTO[]> {
    return this.http.get<MarginDTO[]>(`${this.api}/margins`);
  }

  getSummary(from?: string, to?: string): Observable<ReportsSummaryDTO> {
    return this.http.get<ReportsSummaryDTO>(`${this.api}/summary`, { params: buildParams({ from, to }) });
  }

  //V3: utilidad del periodo (ingresos - costo de lo vendido)
  getProfit(from?: string, to?: string): Observable<ProfitDTO> {
    return this.http.get<ProfitDTO>(`${this.api}/profit`, { params: buildParams({ from, to }) });
  }

  //V3: detalle de una caja por su ID
  getCashReport(cashId: number): Observable<CashReportDTO> {
    return this.http.get<CashReportDTO>(`${this.api}/cash/${cashId}`);
  }
}

//Solo agrega al query string los parámetros definidos (ignora undefined/'').
function buildParams(values: Record<string, string | number | undefined>): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== '') {
      params = params.set(key, String(value));
    }
  }
  return params;
}