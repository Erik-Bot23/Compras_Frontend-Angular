import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Sidebar } from '../sidebar/sidebar';
import { SaleService } from '../../core/service/sale-service/sale-service';
import { SaleHistory } from '../../core/interfaces/sale/sale';
import { PaymentMethod } from '../../core/enums/paymentMethod';
//Directiva *hasPermission="'PERMISO'" usada en el template para pintar/ocultar
//los botones de confirmar y anular según lo que el usuario tenga asignado.
import { HasPermissionDirectives } from '../../core/routes/directives/has-permission-directives';
import { AuthService } from '../../core/service/auth-service/auth-service';
// Servicio compartido del sidebar
import { SidebarService } from '../../core/service/sidebar-service/sidebar-service';
// Paginacion reutilizable: pipe recorta la lista / control pinta el pie de tabla
import { PaginatePipe } from '../../core/pipes/paginate/paginate';
import { PaginationControl } from '../../core/components/pagination-control/pagination-control';

@Component({
  selector: 'app-salehistory',
  imports: [CommonModule, FormsModule, Sidebar, PaginatePipe, PaginationControl],
  templateUrl: './salehistory.html',
  styleUrl: './salehistory.css',
})
export class Salehistory implements OnInit {
  sales: SaleHistory[] = [];
  loading = true;

  //Exponer el enum para usarlo en el template (opciones del filtro)
  PaymentMethod = PaymentMethod;

  // Estado de paginacion (los botones del pie solo navegan paginas validas)
  page = 0;
  pageSize = 10;

  // Filtros client-side (la lista completa ya esta cargada en memoria)
  fromDate = '';
  toDate = '';
  selectedMethod: PaymentMethod | null = null;

  //Lista filtrada por rango de fechas y/o metodo de pago. El pie pagina esta lista.
  get filteredSales(): SaleHistory[] {
    let result = this.sales;

    if (this.selectedMethod !== null) {
      result = result.filter(sale => sale.paymentMethod === this.selectedMethod);
    }

    //Comparacion de strings 'yyyy-MM-dd': lexicograficamente = cronologicamente
    if (this.fromDate || this.toDate) {
      result = result.filter(sale => {
        const datePart = sale.saleDate.substring(0, 10);
        if (this.fromDate && datePart < this.fromDate) return false;
        if (this.toDate && datePart > this.toDate) return false;
        return true;
      });
    }

    return result;
  }

  //Resumen de la lista filtrada: total de registros e importe acumulado
  //Se muestran en la barra de filtros como indicador analitico.
  get filteredCount(): number {
    return this.filteredSales.length;
  }

  get filteredTotal(): number {
    return this.filteredSales.reduce((sum, s) => sum + (s.total ?? 0), 0);
  }

  //Al cambiar un criterio se vuelve a la primera pagina
  onFilterChange(): void {
    this.page = 0;
  }

  constructor(
    private saleService: SaleService,
    public sidebar: SidebarService,
    //Público porque el template lo consulta con auth.hasPermission(...) para
    //ajustar la barra de filtros y los badges, igual que en /compras.
    public auth: AuthService
  ){}

  ngOnInit() {
    this.loadSales();
  }

  loadSales(){
    this.loading = true;

    this.saleService.getSales().subscribe({
      next: (data) => {
        this.sales = data;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  //Formatear el método de pago con etiqueta legible
  formatPaymentMethod(method: PaymentMethod): string {
    switch (method) {
      case PaymentMethod.CASH: return 'Efectivo';
      case PaymentMethod.DEBIT: return 'Tarjeta débito';
      case PaymentMethod.CREDIT: return 'Tarjeta crédito';
      default: return method;
    }
  }

  /*
   * Número de columnas para los <td colspan> de las filas de mensaje
   * ("Cargando...", "No hay ventas...").
   *
   * Son 6 columnas fijas (V3, punto 2 del encargo). Antes eran 7 más una
   * de acciones que solo existía si el usuario tenía CONFIRMAR_VENTAS o
   * CANCELAR_VENTAS, y por eso este getter era dinámico. Al quitar las columnas
   * "Estado" y "Acciones" del historial, el colspan se volvió fijo y este getter
   * ya no depende de permisos: se deja como getter por claridad, y para que
   * cambiar el número de columnas siga siendo un cambio de un solo sitio.
   */
  get colSpan(): number {
    return 6;
  }

  // =========================================================================
  //  Ciclo de vida: CONFIRMAR / ANULAR  (2026-09-30)
  // =========================================================================

  /*
   * Los 3 estados que puede mostrar la columna "Estado". Se calculan en el
   * componente con helpers en vez de repetir la condición en el HTML, para que
   * el template quede legible y las reglas estén en un solo sitio.
   */
  isAnulada(sale: SaleHistory): boolean {
    return sale.cancelled;
  }

  isConfirmada(sale: SaleHistory): boolean {
    return sale.confirmed && !sale.cancelled;
  }

  isAbierta(sale: SaleHistory): boolean {
    return !sale.confirmed && !sale.cancelled;
  }

  /*
   * ¿Se puede anular esta venta desde la UI?
   *
   * Réplica de la regla del backend (SaleImpl.cancel) para NO ofrecer un botón
   * que va a fallar con 409. Se replica para dar feedback inmediato, NO como
   * sustituto de la validación: el backend sigue validando, porque el botón
   * puede quedar desactualizado (otro cajero confirmó la venta un segundo antes)
   * y porque un cliente puede llamar la API saltándose la UI.
   *
   * Solo efectivo: con tarjeta el pago quedó capturado y hace falta una reversa
   * real en el módulo de pagos; el botón de "anular" no devolvría el dinero.
   */
  canCancel(sale: SaleHistory): boolean {
    return this.isAbierta(sale) && sale.paymentMethod === PaymentMethod.CASH;
  }

  //Tooltips para explicar por qué un botón no está disponible
  cancelBlockedReason(sale: SaleHistory): string {
    if (this.isConfirmada(sale)) {
      return 'La venta está confirmada: el pedido ya salió, no se puede anular.';
    }
    if (sale.cancelled) {
      return 'La venta ya fue anulada y su stock devolvido.';
    }
    return 'Una venta con tarjeta necesita una reversa real del pago, no una anulación.';
  }

  /**
   * Confirmar una venta.
   *
   * Se pide confirmación con `confirm()` del navegador porque la acción es
   * irreversible: después de confirmar, esa venta ya no se puede anular ni
   * borrar jamás. Un clic accidental de un cajero dejaría una venta mal
   * contabilizada y sin forma de arreglarlo desde el POS.
   *
   * Tras el éxito NO se recarga la lista entera: se reemplaza solo la fila
   * afectada con la respuesta del servidor. Motivos:
   * - La respuesta ya trae el estado actualizado (`confirmed`, `confirmedAt`),
   *   así que recargar sería tirar una request por lo que ya se tiene.
   * - Recargar reinicia el array y puede hacer saltar la página actual de la
   *   paginación si la lista cambió de tamaño.
   */
  confirmarVenta(sale: SaleHistory): void {
    if (!confirm(`¿Confirmar la venta #${sale.id}?\n\nUna vez confirmada ya no se puede anular ni borrar.`)) {
      return;
    }

    this.saleService.confirmSale(sale.id).subscribe({
      next: (updated) => {
        this.replaceSale(updated);
      },
      error: (err) => alert(err.error?.message || 'No se pudo confirmar la venta'),
    });
  }

  /**
   * Anular una venta (devuelve el stock al inventario).
   *
   * El `confirm()` es todavía más importante acá: la operación suma stock de
   * vuelta al inventario, así que un clic accidental infla el almacén. Y el
   * registro NO se borra: queda con `cancelled = true` para que siga siendo
   * auditable.
   */
  anularVenta(sale: SaleHistory): void {
    if (!confirm(`¿Anular la venta #${sale.id} de $${sale.total.toFixed(2)}?\n\nSe devolverá el stock al inventario. La venta quedará registrada como anulada.`)) {
      return;
    }

    this.saleService.cancelSale(sale.id).subscribe({
      next: (updated) => {
        this.replaceSale(updated);
      },
      // El 409 es el caso esperado: venta confirmada, ya anulada, o con tarjeta.
      // El backend manda el mensaje exacto y se muestra tal cual, que es mucho
      // más útil que un "no se pudo anular" genérico.
      error: (err) => alert(err.error?.message || 'No se pudo anular la venta'),
    });
  }

  /**
   * Reemplaza una venta en el array local por la versión actualizada.
   *
   * Se busca por `id` y se sustituye el elemento (no se reordena) porque el
   * backend no cambia la fecha de la venta, así que su posición en la lista
   * sigue siendo la misma. Si no se encontrara el id, se recargaría todo como
   * red de seguridad: un `find` sin resultado casi siempre significa que la
   * lista quedó desalineada.
   */
  private replaceSale(updated: SaleHistory): void {
    const index = this.sales.findIndex(s => s.id === updated.id);
    if (index === -1) {
      this.loadSales();
      return;
    }
    this.sales = this.sales.map(s => (s.id === updated.id ? updated : s));
  }
}