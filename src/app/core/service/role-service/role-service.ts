import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { CreateRoleRequest, RoleModel, UpdateRoleRequest } from '../../models/role-model';

@Injectable({
  providedIn: 'root',
})
export class RoleService {
  private apiUrl = `${environment.apiLocal}/roles`;
  //private apiUrl = 'http://localhost:8081/api/local/roles';

  constructor(private http: HttpClient){}

  getRoles(): Observable<RoleModel[]>{
    return this.http.get<RoleModel[]>(this.apiUrl);
  }

  getRole(id: number): Observable<RoleModel>{
    return this.http.get<RoleModel>(`${this.apiUrl}/${id}`);
  }

  addRole(request: CreateRoleRequest): Observable<RoleModel>{
    return this.http.post<RoleModel>(this.apiUrl, request);
  }

  updateRole(id: number, request: UpdateRoleRequest): Observable<RoleModel>{
    return this.http.put<RoleModel>(`${this.apiUrl}/${id}`, request);
  }

  deleteRole(id: number): Observable<void>{
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

}
