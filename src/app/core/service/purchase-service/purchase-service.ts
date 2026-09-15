import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  PurchaseDTO,
  PurchaseRequest,
} from '../../interfaces/purchases/purchases';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
//Módulo de compras atrás de /api/purchases
export class PurchaseService {
  private apiUrl = `${environment.api}/purchases`;

  constructor(private http: HttpClient) {}

  //Listado de todas las compras (más recientes primero)
  getPurchases(): Observable<PurchaseDTO[]> {
    return this.http.get<PurchaseDTO[]>(this.apiUrl);
  }

  //Compras de un proveedor concreto
  getByProvider(providerId: number): Observable<PurchaseDTO[]> {
    return this.http.get<PurchaseDTO[]>(`${this.apiUrl}/provider/${providerId}`);
  }

  //Detalle de una compra (renglones)
  getPurchase(id: number): Observable<PurchaseDTO> {
    return this.http.get<PurchaseDTO>(`${this.apiUrl}/${id}`);
  }

  //Registrar una compra (suma stock y guarda el costo real del producto)
  createPurchase(request: PurchaseRequest): Observable<PurchaseDTO> {
    return this.http.post<PurchaseDTO>(this.apiUrl, request);
  }

  //Cancelar compra (revierte stock)
  cancelPurchase(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}