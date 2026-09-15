/**
 * Acceso seguro a localStorage.
 *
 * En un build SSR/prerender (Angular 21 + App Engine / Netlify), el codigo
 * puede ejecutarse en el servidor donde NO existe 'window' ni localStorage.
 * Si una funcion lo tocara ahi, lanzaria ReferenceError y romperia el build.
 *
 * Estas funciones fuerzan el guard `typeof window === 'undefined'` y devuelven
 * null / no hacen nada en el servidor, manteniendo la app funcionando.
 */
export function safeGetItem(key: string): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(key);
}

export function safeSetItem(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, value);
}

export function safeRemoveItem(key: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(key);
}