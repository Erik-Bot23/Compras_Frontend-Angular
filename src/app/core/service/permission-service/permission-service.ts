import { Injectable } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PermissionModel } from '../../models/role-model';

@Injectable({
  providedIn: 'root',
})
export class PermissionService {
  private apiUrl = `${environment.apiLocal}/permissions`;

  constructor(private http: HttpClient){}

  getPermissions(): Observable<PermissionModel[]>{
    return this.http.get<PermissionModel[]>(this.apiUrl);
  }
}
