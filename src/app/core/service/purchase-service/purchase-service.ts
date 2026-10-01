import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { PurchaseDTO, PurchaseRequest} from '../../interfaces/purchases/purchases';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
//Módulo de compras atrás de /api/purchases
export class PurchaseService {
  private apiUrl = `${environment.apiLocal}/purchases`;

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

  //Registrar una compra. Nace PENDIENTE: todavia NO suma stock ni guarda el
  //costo real del producto. Eso pasa al confirmar.
  createPurchase(request: PurchaseRequest): Observable<PurchaseDTO> {
    return this.http.post<PurchaseDTO>(this.apiUrl, request);
  }

  //Confirmar una compra: aqui si la mercaderia entra al almacen, se suma el
  //stock y se guarda el costo real de cada producto. Es idempotente (llamarlo
  //dos veces NO suma el stock dos veces).
  confirmPurchase(id: number): Observable<PurchaseDTO> {
    return this.http.patch<PurchaseDTO>(`${this.apiUrl}/${id}/confirm`, {});
  }

  //Cancelar una compra PENDIENTE (la borra; 409 si ya esta confirmada)
  cancelPurchase(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}