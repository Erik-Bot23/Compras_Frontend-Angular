import { HttpClient } from '@angular/common/http';
import { Component, Injectable } from '@angular/core';
import { delay, Observable, of } from 'rxjs';
import { environment } from '../../../../environments/environment'; 
import { AuthUser, LoginRequest, LoginResponse } from '../../interfaces/login/login';
// Acceso seguro a localStorage (no rompe SSR/prerender)
import { safeGetItem, safeRemoveItem, safeSetItem } from '../../utils/storage-utils';

@Injectable({ providedIn: 'root' })

//Esta clase es para el LOGIN en features/login/login.ts
export class AuthService {
  //La ruta a la que va a responder en el backend
  private api = `${environment.api}/auth`;
  //private api = 'http://localhost:8081/api/auth';
  
  constructor(private http: HttpClient){}

  //Validar usuario y mandar a la página inicial
  login(data: LoginRequest): Observable<LoginResponse>{
    return this.http.post<LoginResponse>(`${this.api}/login`, data);
  }

  //Guardar el token (via helper seguro → no peta en SSR)
  saveToken(token: string): void{
    safeSetItem('token', token);
  }

  //Obtener el token
  getToken(): string | null{
    return safeGetItem('token');
  }

  //Guardar el usuario
  saveUser(user: LoginResponse): void{
    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      permissions: user.permissions
    }
    
    safeSetItem('user', JSON.stringify(authUser));
  }
 
  //Obtener el usuario.
  //JSON.parse con try/catch: si localStorage fue manipulado o corrompido,
  //se devuelve null en vez de romper la app con un error de parseo.
  getUser(): AuthUser | null{
    const user = safeGetItem('user');

    if(!user) return null;

    try {
      return JSON.parse(user) as AuthUser;
    } catch {
      return null;
    }
  }

  //Obtener el nombre
  getUsername(): string{
    return this.getUser()?.name ?? '';
  }

  //Obtener el rol
  getRole(): string{
    return this.getUser()?.role ?? '';
  }

  //Saber si inició sesion (token presente Y no expirado).
  //Antes solo comprobaba que existiera la string; ahara tambien se decodifica
  //el payload del JWT para leer su claim "exp" y descartar tokens vencidos.
  isLogged(): boolean{
    const token = this.getToken();

    if(!token) return false;

    const exp = this.getTokenExpiration(token);

    //Token sin claim exp → se considera valido (siempre expira en backend).
    return exp === null || exp * 1000 > Date.now();
  }

  //Decodifica el payload del JWT (parte del medio, base64url) y extrae "exp".
  //Es solo lectura local, sin dependencias; no valida la firma (eso lo hace
  //el backend). Firma invalida o parse fallido → null (no rompe nada).
  private getTokenExpiration(token: string): number | null{
    const parts = token.split('.');

    if(parts.length < 2) return null;

    try {
      const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
      const payload = JSON.parse(atob(padded));
      return typeof payload.exp === 'number' ? payload.exp : null;
    } catch {
      return null;
    }
  }

  //Cerrar sesión
  logout(){
    safeRemoveItem('token');
    safeRemoveItem('user');
  }

  //Recuperar contraseña si se olvido
  forgotPassword(email: string){
    return this.http.post(`${this.api}/forgot-password`, {email});
  }

  //Borrar la contraseña actual
  resetPassword(token: string, newPassword: string){
    return this.http.post(`${this.api}/reset-password`, {token, newPassword});
  }

  //Cambiar la contraseña desde perfil
  changePassword(currentPassword: string, newPassword: string){
    return this.http.post(`${this.api}/change-password`, {currentPassword, newPassword});
  }

  //Función para los permisos en todo el frontend
  hasPermission(permission: string): boolean{
    const permissions = this.getUser()?.permissions ?? [];
    return permissions.includes(permission);
  }
  
}
