import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { User, UserRole } from '../../interfaces/user/user';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root',
})

export class UserService {
  private apiUrl = `${environment.apiLocal}/users`;
  private roleUrl = `${environment.apiLocal}/roles`;

  /*private apiUrl = 'http://localhost:8081/api/local/users';
  private roleUrl = 'http://localhost:8081/api/local/roles';*/

  constructor(
    private http: HttpClient
  ){}

  //Se traen todos los usuarios de la BD
  getUsers(){
    return this.http.get<User[]>(this.apiUrl);
  }

  //Se crea el usuario y se guarda en la BD
  createUser(user: User){
    return this.http.post<User>(this.apiUrl, user);
  }

  //Se actualiza el usuario en la BD
  updateUser(id: number, user: User){
    return this.http.put<User>(`${this.apiUrl}/${id}`, user);
  }

  //No se elimina, se desactiva el usuario, esto se manda a la BD
  deActiveUser(id: number){
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

  //Se vuelve a activar el usuario
  activateUser(id: number){
    return this.http.patch(`${this.apiUrl}/${id}/active`, {});
  }

  //Se traen roles de la BD
  getRoles(): Observable<UserRole[]>{
      return this.http.get<UserRole[]>(this.roleUrl);
  }

}
