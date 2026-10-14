import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { AuthInterceptor } from './core/routes/auth-interceptor/auth-interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    // Re-habilitar Zone.js como motor de deteccion de cambios.
    // Sin esto (Angular 21 usa zoneless por default), las respuestas HTTP
    // no redibujaban las tablas hasta hacer clic en un campo del formulario.
    provideZoneChangeDetection(),
    provideRouter(routes),
    provideAnimations(),
    provideHttpClient(
      withFetch(),
      withInterceptors([AuthInterceptor])
    )
  ]
};
