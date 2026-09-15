import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Category } from '../../interfaces/product/product'; 
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root',
})

//Esta clase se utliza en cobre-service
export class CategoryService {
  //Ruta a la que tiene que responder ene l backend
  private apiUrl = `${environment.api}/categories`;
  //private apiUrl = 'http://localhost:8081/api/categories';

  constructor(private http: HttpClient){}

  //Se obtienen las categorias de los productos
  //Observable:
  getCategories(): Observable<Category[]>{
    return this.http.get<Category[]>(this.apiUrl);
  }

  addCategory(name: string): Observable<Category>{
    return this.http.post<Category>(this.apiUrl, { name });
  }

  updateCategory(id: number, name: string): Observable<Category>{
    return this.http.put<Category>(`${this.apiUrl}/${id}`, { name });
  }

  deleteCategory(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
