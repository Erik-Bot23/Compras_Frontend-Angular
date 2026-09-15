import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

/**
 * Componente reutilizable de paginacion (pie de tabla).
 *
 * Uso:
 *   <app-pagination
 *     [total]="products.length"
 *     [pageSize]="pageSize"
 *     [page]="page"
 *     (pageChange)="page = $event">
 *   </app-pagination>
 *
 * - Recibe como INPUTS el total de items, el tamaño de pagina y la pagina
 *   actual (cada componente CRUD es dueño de su estado "page").
 * - Emite un OUTPUT pageChange con la pagina nueva cuando el usuario pulsa
 *   Anterior/Siguiente; el padre la guarda en su variable.
 * - Toda la matematica (totalPages, currentPage clamp, rango "Mostrando")
 *   vive en getters aqui → el template solo lee valores listos.
 */
@Component({
  selector: 'app-pagination',
  // CommonModule necesario para *ngIf en el template del pie de tabla
  imports: [CommonModule],
  templateUrl: './pagination-control.html',
  styleUrl: './pagination-control.css',
})
export class PaginationControl {
  /** Total de registros en la lista completa. */
  @Input() total = 0;

  /** Cuantos registros se muestran por pagina. */
  @Input() pageSize = 8;

  /** Pagina actual (0-indexada) que reporta el componente padre. */
  @Input() page = 0;

  /** Emite la nueva pagina (0-indexada) elegida por el usuario. */
  @Output() pageChange = new EventEmitter<number>();

  /** Total de paginas (minimo 1 aunque no haya datos). */
  get totalPages(): number {
    const n = Math.ceil(this.total / Math.max(this.pageSize, 1));
    return Math.max(1, n);
  }

  /**
   * Pagina actual "clamp": nunca puede ser negativa ni superar la ultima
   * pagina valida. Sirve para que la UI no muestre "Pagina 5 de 4" si el
   * padre deja un valor viejo tras borrar registros.
   */
  get currentPage(): number {
    return Math.min(Math.max(this.page, 0), this.totalPages - 1);
  }

  /** Primer registro visible (1-indexado) para el texto "Mostrando". */
  get from(): number {
    return this.total === 0 ? 0 : this.currentPage * this.pageSize + 1;
  }

  /** Ultimo registro visible (1-indexado) para el texto "Mostrando". */
  get to(): number {
    return Math.min((this.currentPage + 1) * this.pageSize, this.total);
  }

  /** Navega una pagina atras (si hay). */
  prev(): void {
    if (this.currentPage > 0) {
      this.pageChange.emit(this.currentPage - 1);
    }
  }

  /** Navega una pagina adelante (si hay). */
  next(): void {
    if (this.currentPage < this.totalPages - 1) {
      this.pageChange.emit(this.currentPage + 1);
    }
  }
}