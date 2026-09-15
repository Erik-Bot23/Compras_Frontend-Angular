import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Sidebar } from '../sidebar/sidebar';
import { HasPermissionDirectives } from '../../core/routes/directives/has-permission-directives';
import { AuthService } from '../../core/service/auth-service/auth-service';
import { SidebarService } from '../../core/service/sidebar-service/sidebar-service';
import { PaginatePipe } from '../../core/pipes/paginate/paginate';
import { PaginationControl } from '../../core/components/pagination-control/pagination-control';

import { ProviderService } from '../../core/service/provider-service/provider-service';
import { PurchaseService } from '../../core/service/purchase-service/purchase-service';
import { ProductService } from '../../core/service/product-service/product-service';
import { ReportService } from '../../core/service/report-service/report-service';

import { ProviderDto, PurchaseDTO, PurchaseItemRequest } from '../../core/interfaces/purchases/purchases';
import { ProductForm } from '../../core/interfaces/product/product';
import { MarginDTO } from '../../core/interfaces/reports/reports';

//Renglón en edición dentro del modal "Nueva compra"
interface LineaCompra {
  productId: number | null;
  productName: string;
  quantity: number;
  unitCost: number;
}

@Component({
  selector: 'app-compras',
  standalone: true,
  imports: [CommonModule, FormsModule, Sidebar, HasPermissionDirectives, PaginatePipe, PaginationControl],
  templateUrl: './compras.html',
  styleUrl: './compras.css',
})

//Módulo de compras: Compras (registro/historial), Proveedores (CRUD) y
//Márgenes (costo real vs precio de venta) — el último solo con VER_REPORTES.
export class Compras implements OnInit {
  //Pestañas: 'compras' | 'proveedores' | 'margenes'
  activeTab: 'compras' | 'proveedores' | 'margenes' = 'compras';

  //Datos de las tres pestañas
  purchases: PurchaseDTO[] = [];
  providers: ProviderDto[] = [];
  products: ProductForm[] = [];
  margins: MarginDTO[] = [];

  //Paginación de las tablas
  page = 0;
  pageSize = 8;

  //Filtro "por proveedor" de la pestaña Compras (null = todos)
  filterProviderId: number | null = null;

  //Ids de compras con el detalle (renglones) expandido
  detalleAbiertaIds = new Set<number>();

  //---- Proveedores: formulario create/edit ----
  formProvider: ProviderDto = { name: '', rfc: '', phone: '', email: '' };
  editingProviderId: number | null = null;

  //---- Modal "Nueva compra" ----
  showModal = false;
  modalProviderId: number | null = null;
  modalFecha: string = ''; //input[type=date], opcional (si vacía, el backend usa ahora)
  lineas: LineaCompra[] = [];

  constructor(
    public sidebar: SidebarService,
    public auth: AuthService,
    private providerService: ProviderService,
    private purchaseService: PurchaseService,
    private productService: ProductService,
    private reportService: ReportService
  ) {}

  ngOnInit() {
    this.loadProviders();
    this.loadPurchases();
    this.loadProducts();
    if (this.auth.hasPermission('VER_REPORTES')) {
      this.loadMargins();
    }
  }

  //----- Carga de datos -----

  loadPurchases() {
    this.purchaseService.getPurchases().subscribe({
      next: (data) => (this.purchases = data),
      error: (err) => alert(err.error?.message || 'No se pudieron cargar las compras'),
    });
  }

  loadProviders() {
    this.providerService.getProviders().subscribe({
      next: (data) => (this.providers = data),
      error: (err) => alert(err.error?.message || 'No se pudieron cargar los proveedores'),
    });
  }

  loadProducts() {
    this.productService.getProducts().subscribe({
      next: (data) => (this.products = data),
      error: (err) => alert(err.error?.message || 'No se pudieron cargar los productos'),
    });
  }

  loadMargins() {
    this.reportService.getMargins().subscribe({
      next: (data) => (this.margins = data),
      error: (err) => alert(err.error?.message || 'No se pudieron cargar los márgenes'),
    });
  }

  //Compras filtradas por el select de proveedores (null = todas)
  get filteredPurchases(): PurchaseDTO[] {
    return this.filterProviderId === null
      ? this.purchases
      : this.purchases.filter((p) => p.providerId === this.filterProviderId);
  }

  //----- Pestaña Compras: modal de registro -----

  abrirModal() {
    this.modalProviderId = null;
    this.modalFecha = '';
    this.lineas = [{ productId: null, productName: '', quantity: 1, unitCost: 0 }];
    this.showModal = true;
  }

  cerrarModal() {
    this.showModal = false;
  }

  //Agregar un renglón más a la compra
  agregarLinea() {
    this.lineas.push({ productId: null, productName: '', quantity: 1, unitCost: 0 });
  }

  quitarLinea(index: number) {
    this.lineas.splice(index, 1);
  }

  //Al elegir un producto, precargamos su nombre (para mostrar en la tabla chica)
  onProductoSeleccionado(linea: LineaCompra) {
    const p = this.products.find((x) => x.id === linea.productId);
    linea.productName = p ? p.name : '';
    //Si aún no se tocó el costo, sugerir el precio de venta como referencia
    if (p && linea.unitCost <= 0) {
      linea.unitCost = p.price;
    }
  }

  //Subtotal de un renglón
  subtotal(linea: LineaCompra): number {
    return (linea.quantity || 0) * (linea.unitCost || 0);
  }

  //Total de la compra en edición
  get totalCompra(): number {
    return this.lineas.reduce((sum, l) => sum + this.subtotal(l), 0);
  }

  //Válida que haya proveedor, al menos un renglón completo y cantidades > 0
  get compraValida(): boolean {
    return (
      this.modalProviderId !== null &&
      this.lineas.length > 0 &&
      this.lineas.every(
        (l) => l.productId !== null && l.quantity > 0 && l.unitCost >= 0
      )
    );
  }

  //Registrar la compra en el backend (suma stock y guarda costo real)
  guardarCompra() {
    if (!this.compraValida) return;

    const items: PurchaseItemRequest[] = this.lineas.map((l) => ({
      productId: l.productId!,
      quantity: l.quantity,
      unitCost: l.unitCost,
    }));

    const request = {
      providerId: this.modalProviderId!,
      //Si el usuario eligió fecha, enviarla en ISO-8601 (el backend la usa tal cual)
      purchaseDate: this.modalFecha ? `${this.modalFecha}T00:00:00` : undefined,
      items,
    };

    this.purchaseService.createPurchase(request).subscribe({
      next: () => {
        this.cerrarModal();
        this.loadPurchases();
        this.loadMargins();
        this.loadProducts();
      },
      error: (err) => alert(err.error?.message || 'No se pudo registrar la compra'),
    });
  }

  //Cancelar una compra (revierte el stock de sus productos)
  cancelarCompra(id: number) {
    if (!confirm('¿Cancelar esta compra? Se revertirá el stock de sus productos.')) return;

    this.purchaseService.cancelPurchase(id).subscribe({
      next: () => {
        this.detalleAbiertaIds.delete(id);
        this.loadPurchases();
        this.loadMargins();
        this.loadProducts();
      },
      error: (err) => alert(err.error?.message || 'No se pudo cancelar la compra'),
    });
  }

  //Alternar la visibilidad de los renglones de una compra
  toggleDetalle(id: number) {
    if (this.detalleAbiertaIds.has(id)) {
      this.detalleAbiertaIds.delete(id);
    } else {
      this.detalleAbiertaIds.add(id);
    }
  }

  //----- Pestaña Proveedores: CRUD -----

  guardarProveedor() {
    if (!this.formProvider.name.trim() || !this.formProvider.rfc.trim()) return;

    if (this.editingProviderId !== null) {
      this.providerService.updateProvider(this.editingProviderId, this.formProvider).subscribe({
        next: (updated) => {
          this.providers = this.providers.map((p) => (p.id === updated.id ? updated : p));
          this.cancelarEdicionProveedor();
        },
        error: (err) => alert(err.error?.message || 'No se pudo actualizar el proveedor'),
      });
      return;
    }

    this.providerService.addProvider(this.formProvider).subscribe({
      next: (nuevo) => {
        this.providers = [nuevo, ...this.providers];
        this.formProvider = { name: '', rfc: '', phone: '', email: '' };
      },
      error: (err) => alert(err.error?.message || 'No se pudo guardar el proveedor'),
    });
  }

  editarProveedor(p: ProviderDto) {
    this.editingProviderId = p.id ?? null;
    this.formProvider = { ...p };
  }

  cancelarEdicionProveedor() {
    this.editingProviderId = null;
    this.formProvider = { name: '', rfc: '', phone: '', email: '' };
  }

  eliminarProveedor(id: number) {
    if (!confirm('¿Eliminar proveedor?')) return;

    this.providerService.deleteProvider(id).subscribe({
      next: () => {
        this.providers = this.providers.filter((p) => p.id !== id);
      },
      error: (err) => alert(err.error?.message || 'No se pudo eliminar el proveedor'),
    });
  }
}