import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Sidebar } from '../sidebar/sidebar';
import { SaleService } from '../../core/service/sale-service/sale-service';
import { SaleHistory } from '../../core/interfaces/sale/sale';
import { PaymentMethod } from '../../core/enums/paymentMethod';
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
    public sidebar: SidebarService
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
}