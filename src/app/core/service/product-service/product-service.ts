import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ProductForm } from '../../interfaces/product/product'; 
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
//Se usará en features/productos/productos.ts
export class ProductService {
  private apiUrl = `${environment.api}/products`;
  //private apiUrl = 'http://localhost:8081/api/products';

  constructor(private http: HttpClient){}

  //Trae los productos ACTIVOS de la BD (los dados de baja van a getInactiveProducts)
  getProducts(category?: string): Observable<ProductForm[]> {
    const params = category ? { params: {category}} : {};
    return this.http.get<ProductForm[]>(this.apiUrl, params); //params:
  }

  //Trae SOLO los productos dados de baja (GET /api/products/inactive)
  getInactiveProducts(): Observable<ProductForm[]> {
    return this.http.get<ProductForm[]>(`${this.apiUrl}/inactive`);
  }

  //Da de baja un producto (borrado logico: deja de venderse pero conserva historico)
  deactivateProduct(id: number): Observable<ProductForm>{
    return this.http.patch<ProductForm>(`${this.apiUrl}/${id}/deactivate`, {});
  }

  //Reactiva (dar de alta) un producto que estaba dado de baja
  activateProduct(id: number): Observable<ProductForm>{
    return this.http.patch<ProductForm>(`${this.apiUrl}/${id}/active`, {});
  }

  //Añade productos a la BD
  addProduct(formData: FormData): Observable<ProductForm> {
    return this.http.post<ProductForm>(this.apiUrl, formData); //formData:
  }

  //Actualiza producto en la BD
  updateProduct(id: number, formData: FormData): Observable<ProductForm>{
    return this.http.put<ProductForm>(`${this.apiUrl}/${id}`, formData);
  }

  //Borra un producto en la BD
  deleteProduct(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
  
}
