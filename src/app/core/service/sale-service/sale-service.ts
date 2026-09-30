import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { SaleHistory, SaleRequest, SaleResponse } from '../../interfaces/sale/sale';
import { Observable } from 'rxjs';
import { ProductShow } from '../../interfaces/product/product';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root',
})

//Se usará en features/cobro/cobro.ts
export class SaleService {
  private api = `${environment.apiLocal}/sales`;
  private apiUrl = `${environment.apiLocal}/products`;

  /*private api = 'http://localhost:8081/api/local/sales';
  private apiUrl = 'http://localhost:8081/api/local/products';*/

  constructor(private http: HttpClient){}

  //Se procesa la venta, pero solo hasta que se realiza
  //El carro de ventas nunca de envía a la BD
  processSale(request: SaleRequest): Observable<SaleResponse>{
    return this.http.post<SaleResponse>(this.api, request);
  }
  
  //Muestra los productos en la tabla de ventas 
  //Se usará en features/cobro/cobro.ts
  getProductsVentas(){
    return this.http.get<ProductShow[]>(this.apiUrl);
  }

  //Muestra los productos en la tabla de ventas a través de código de barras
  //Se usará en features/cobro/cobro.ts
  findByBarcode(barcode: string){
    return this.http.get<ProductShow>(`${this.apiUrl}/barcode/${barcode}`);
  }

  searchProducts(term: string){
    return this.http.get<ProductShow[]>(`${this.apiUrl}/search?q=${term}`);
  }

  //Ver historial de las ventas
  getSales(){
    return this.http.get<SaleHistory[]>(this.api);
  }

  // =========================================================================
  //  Ciclo de vida de la venta (2026-09-30)
  // =========================================================================
  /*
   * Las tres observaciones de este bloque:
   *
   * 1) Se usa PATCH, no POST ni PUT. La venta YA existe; lo único que se pide
   *    es mover su estado. POST crearía algo nuevo, y PUT reenviaría la venta
   *    entera, con el riesgo de pisar campos que otro usuario cambió.
   *
   * 2) El id va en la URL y no en un body. Por eso no hay parámetro `body` en la
   *    llamada: el servidor no espera cuerpo en estos dos endpoints.
   *
   * 3) NO se captura el error aquí. El backend responde 409 con un mensaje
   *    {'code': 'SALE_ERROR', 'message': '...'} que es el texto exacto que
   *    necesita ver el cajero ("no se puede anular una venta ya confirmada").
   *    Si el servicio lo transformara, se perdería ese detalle y el usuario
   *    vería un "algo falló" inútil. Lo maneja el componente, con el mismo
   *    patrón alert(err.error?.message) que ya usa el módulo de compras.
   */

  //Confirmar (congelar) una venta: ya no se puede anular ni borrar
  confirmSale(id: number): Observable<SaleHistory>{
    return this.http.patch<SaleHistory>(`${this.api}/${id}/confirm`, {});
  }

  //Anular una venta: devuelve el stock. Solo efectivo y no confirmadas
  cancelSale(id: number): Observable<SaleHistory>{
    return this.http.patch<SaleHistory>(`${this.api}/${id}/cancel`, {});
  }

}
