import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
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
  imports: [CommonModule, Sidebar, PaginatePipe, PaginationControl],
  templateUrl: './salehistory.html',
  styleUrl: './salehistory.css',
})
export class Salehistory implements OnInit {
  sales: SaleHistory[] = [];
  loading = true;

  // Estado de paginacion (los botones del pie solo navegan paginas validas)
  page = 0;
  pageSize = 10;

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