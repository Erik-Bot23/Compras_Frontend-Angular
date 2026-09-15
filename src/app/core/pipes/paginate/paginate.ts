import { Pipe, PipeTransform } from '@angular/core';

/**
 * Pipe puro de paginacion (del lado del cliente).
 *
 * Uso en el template:
 *   <tr *ngFor="let p of products | paginate: page : pageSize">
 *
 * - Es "pure" (por defecto): solo se re-ejecuta cuando cambia la referencia
 *   del array o los argumentos page/pageSize, no en cada deteccion de cambios.
 * - page y pageSize se pasan DESPUES de ':' en el orden en que se declaran en
 *   el transform: primero la lista, luego page y luego pageSize.
 *
 * Proteccion de pagina fuera de rango:
 *   Si se borra el ultimo item de una pagina, "page" quedaria apuntando a una
 *   pagina que ya no existe. Con Math.min/Math.max se recorta a la ultima
 *   pagina valida y se muestra la fila resultante en vez de una tabla vacia.
 */
@Pipe({ name: 'paginate', standalone: true })
export class PaginatePipe implements PipeTransform {
  transform<T>(items: T[], page: number, pageSize: number): T[] {
    // Lista vacia o nula → se devuelve tal cual (evita errores).
    if (!items?.length) {
      return items ?? [];
    }

    // Evita division por cero si alguien pasa pageSize 0.
    if (pageSize <= 0) {
      pageSize = 1;
    }

    const totalPages = Math.ceil(items.length / pageSize);

    // Recorta page al rango valido [0, totalPages - 1].
    const safePage = Math.min(Math.max(page, 0), totalPages - 1);

    const start = safePage * pageSize;

    return items.slice(start, start + pageSize);
  }
}