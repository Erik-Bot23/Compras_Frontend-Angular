import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ProviderDto } from '../../interfaces/purchases/purchases';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
//CRUD de proveedores atrás de /api/providers
export class ProviderService {
  private apiUrl = `${environment.api}/providers`;

  constructor(private http: HttpClient) {}

  getProviders(): Observable<ProviderDto[]> {
    return this.http.get<ProviderDto[]>(this.apiUrl);
  }

  getProvider(id: number): Observable<ProviderDto> {
    return this.http.get<ProviderDto>(`${this.apiUrl}/${id}`);
  }

  addProvider(dto: ProviderDto): Observable<ProviderDto> {
    return this.http.post<ProviderDto>(this.apiUrl, dto);
  }

  updateProvider(id: number, dto: ProviderDto): Observable<ProviderDto> {
    return this.http.put<ProviderDto>(`${this.apiUrl}/${id}`, dto);
  }

  deleteProvider(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}