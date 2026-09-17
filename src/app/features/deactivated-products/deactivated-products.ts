import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProductForm } from '../../core/interfaces/product/product';
import { ProductService } from '../../core/service/product-service/product-service';
import { AuthService } from '../../core/service/auth-service/auth-service';
import { Sidebar } from '../sidebar/sidebar';
import { HasPermissionDirectives } from '../../core/routes/directives/has-permission-directives';
// Servicio compartido del sidebar (mantiene el menu sandwich sincronizado)
import { SidebarService } from '../../core/service/sidebar-service/sidebar-service';
// Paginacion reutilizable: pipe recorta la lista / control pinta el pie de tabla
import { PaginatePipe } from '../../core/pipes/paginate/paginate';
import { PaginationControl } from '../../core/components/pagination-control/pagination-control';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-deactivated-products',
  imports: [CommonModule, Sidebar, HasPermissionDirectives, PaginatePipe, PaginationControl],
  templateUrl: './deactivated-products.html',
  styleUrl: './deactivated-products.css',
})

// Vista dedicada a los productos DADOS DE BAJA (borrado logico).
// Se llega desde el boton "Ver desactivados" de /productos. Solo muestra la
// tabla de inactivos + el boton "Dar de alta" (PATCH /products/{id}/active).
export class DeactivatedProducts implements OnInit {
  products: ProductForm[] = [];
  loading = true;

  // Estado de paginacion del pie de tabla (mismo patron que los CRUD)
  page = 0;
  pageSize = 8;

  constructor(
    private productService: ProductService,
    public auth: AuthService,
    public sidebar: SidebarService
  ) {}

  ngOnInit(): void {
    this.loadInactive();
  }

  //Carga SOLO los productos dados de baja (GET /api/products/inactive)
  loadInactive(): void {
    this.productService.getInactiveProducts().subscribe({
      next: (data) => {
        this.products = data;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error al cargar productos dados de baja', err);
        this.loading = false;
      }
    });
  }

  //Da de alta (reactiva) un producto inactivo: vuelve al catalogo de /productos
  activate(id?: number): void {
    if(!id) return;

    if(!this.auth.hasPermission('ACTIVAR_PRODUCTOS')){
      return;
    }

    if(confirm('¿Seguro que deseas dar de alta este producto?')){
      this.productService.activateProduct(id).subscribe({
        next: () => {
          // Al reactivarse deja de pertenecer a esta lista de inactivos
          this.products = this.products.filter(p => p.id !== id);
          console.log('Producto dado de alta');
        },
        error: (err) => {
          alert(err.error?.message || 'No se pudo dar de alta el producto');
        }
      });
    }
  }

  //Arma la URL de la imagen (mismo criterio que productos.ts: respeta URLs
  //absolutas del backend y completa las relativas contra environment.api)
  imageUrl(img?: string): string {
    if (!img) return '';

    if (img.startsWith('http://') || img.startsWith('https://')) {
      return img;
    }

    return `${environment.api}${img.startsWith('/') ? '' : '/'}${img}`;
  }
}
