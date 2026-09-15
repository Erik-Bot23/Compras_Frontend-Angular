import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
// Acceso seguro a localStorage (no rompe SSR/prerender)
import { safeGetItem, safeRemoveItem } from '../../utils/storage-utils';

// Interceptor que agrega el JWT a cada request y maneja la expiracion de sesion.
//
// 1) Authorization: read del token con helper seguro (no peta en SSR).
// 2) Respuesta 401 (token expirado/invalido) → se limpia la sesion local y se
//    redirige a '/' (login). Es el cierre de sesion automatico que faltaba:
//    antes un token vencido dejaba la app "logeada" mostrando errores sueltos.
//
// Excepcion: los endpoints /auth/login, forgot-password y reset-password NO se
// tocan, porque su 401 es un fallo normal (credenciales incorrectas) y deben
// mostrar su snackbar de error sin redirigir.
export const AuthInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);

  const token = safeGetItem('token');

  if (token) {
    req = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` }
    });
  }

  return next(req).pipe(
    catchError((err) => {
      if (err instanceof HttpErrorResponse && err.status === 401) {
        const isAuthEndpoint =
          req.url.includes('/auth/login') ||
          req.url.includes('/auth/forgot-password') ||
          req.url.includes('/auth/reset-password');

        if (!isAuthEndpoint) {
          safeRemoveItem('token');
          safeRemoveItem('user');
          router.navigate(['/']);
        }
      }

      return throwError(() => err);
    })
  );
};