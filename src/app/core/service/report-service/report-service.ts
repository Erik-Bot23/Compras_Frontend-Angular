import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  CategoryPerformanceDTO,
  LowStockDTO,
  MarginDTO,
  PaymentMethodDTO,
  PeriodSalesDTO,
  ReportsSummaryDTO,
  TopProductDTO,
} from '../../interfaces/reports/reports';

//Agrupación admitida por GET /api/reports/trend
export type ReportGroup = 'DAY' | 'MONTH' | 'YEAR';

@Injectable({
  providedIn: 'root',
})
export class ReportService {
  private api = `${environment.api}/reports`;

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