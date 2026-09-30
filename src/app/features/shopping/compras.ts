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
import {
  sanearDigitos,
  sanearPrecio,
  soloDigitos,
  soloDigitosYPunto,
  validarRfc,
  aMayusculas,
} from '../../core/utils/validadores';

//Renglón en edición dentro del modal "Nueva compra"
interface LineaCompra {
  productId: number | null;
  productName: string;
  quantity: number;
  //Lo que se le PAGA al proveedor
  unitCost: number;
  //Precio de VENTA del renglón (V3). null = "esta compra no opinaba sobre el
  //precio de venta" y el producto conserva el que ya tiene.
  unitPrice: number | null;
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

  //Flag de carga: la tabla de compras muestra un estado vacio mientras carga
  loading = false;

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
    this.loading = true;
    this.purchaseService.getPurchases().subscribe({
      next: (data) => {
        this.purchases = data;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        alert(err.error?.message || 'No se pudieron cargar las compras');
      },
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
    this.lineas = [this.nuevaLinea()];
    this.showModal = true;
  }

  cerrarModal() {
    this.showModal = false;
  }

  /**
   * Renglón vacío.
   *
   * <p>`unitPrice` arranca en `null` y NO en el precio del producto: el precio de
   * venta se autocompleta al elegir el producto, no antes, porque sin producto no
   * hay de dónde sacarlo. `null` además es lo que el backend interpreta como
   * "esta compra no opina sobre el precio de venta".
   */
  private nuevaLinea(): LineaCompra {
    return { productId: null, productName: '', quantity: 1, unitCost: 0, unitPrice: null };
  }

  //Agregar un renglón más a la compra
  agregarLinea() {
    this.lineas.push(this.nuevaLinea());
  }

  quitarLinea(index: number) {
    this.lineas.splice(index, 1);
  }

  /**
   * Al elegir un producto se precargan sus dos precios.
   *
   * <p>V3: además del nombre, se autocompleta el <b>precio de venta</b> con el que
   * ya tiene el producto. Es una sugerencia, no un imposed: el usuario puede
   * cambiarlo, y si lo deja vacío se conserva el precio actual. Se autocompleta
   * para que la operación más común (reponer con el mismo precio) sea un clic y
   * no tener que teclear el número.
   */
  onProductoSeleccionado(linea: LineaCompra) {
    const p = this.products.find((x) => x.id === linea.productId);
    linea.productName = p ? p.name : '';

    if (p) {
      //Si aún no se tocó el costo, se sugiere el precio de venta como referencia
      //de cuánto se está vendiendo (el dueño lo ajusta al costo real del
      //proveedor, que es distinto).
      if (linea.unitCost <= 0) {
        linea.unitCost = p.price;
      }
      //Precio de venta: solo si el usuario no lo escribió a mano
      if (linea.unitPrice === null || linea.unitPrice === undefined) {
        linea.unitPrice = p.price;
      }
    }
  }

  //Subtotal de un renglón. Se calcula con el COSTO DE COMPRA, no con el precio de
  //venta: el total de la compra es lo que se le paga al proveedor. Si se usara el
  //precio de venta, el "total" sería lo que el negocio cobra y no lo que pagó.
  subtotal(linea: LineaCompra): number {
    return (linea.quantity || 0) * (linea.unitCost || 0);
  }

  //Total de la compra en edición
  get totalCompra(): number {
    return this.lineas.reduce((sum, l) => sum + this.subtotal(l), 0);
  }

  /**
   * Margen del renglón en edición: precio de venta menos costo de compra.
   *
   * <p>Se muestra en vivo porque es la pregunta que el usuario se está haciendo
   * al escribir los dos precios: "¿voy a vender esto más caro de lo que lo compré?"
   * Si sale negativo, el renglón se avisa en rojo: está vendiendo más barato de
   * lo que compra, y eso es pérdida directa.
   */
  margenLinea(linea: LineaCompra): number | null {
    if (linea.unitPrice === null || linea.unitPrice === undefined) {
      return null;
    }
    return (linea.unitPrice || 0) - (linea.unitCost || 0);
  }

  //Válida que haya proveedor, al menos un renglón completo y cantidades > 0
  get compraValida(): boolean {
    return (
      this.modalProviderId !== null &&
      this.lineas.length > 0 &&
      this.lineas.every((l) => l.productId !== null && l.quantity > 0 && l.unitCost >= 0)
    );
  }

  /**
   * Registra la compra. La compra NACE PENDIENTE: todavía no toca el inventario.
   *
   * <p>Se manda `unitPrice` por renglón (V3). Si viene `null`, el backend no
   * cambia el precio de venta del producto; si viene un número, ese queda como
   * precio vigente al CONFIRMAR.
   */
  guardarCompra() {
    if (!this.compraValida) return;

    const items: PurchaseItemRequest[] = this.lineas.map((l) => ({
      productId: l.productId!,
      quantity: l.quantity,
      unitCost: l.unitCost,
      unitPrice: l.unitPrice ?? null,
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

  /**
   * Confirmar una compra: la mercancía entra al almacén, se suma el stock y se
   * guardan el costo real y el precio de venta de cada producto.
   */
  confirmarCompra(compra: PurchaseDTO) {
    const ok = confirm(
      `¿Confirmar la compra #${compra.id}?\n\n` +
        `La mercancía entrará al almacén: se sumará el stock de sus productos, ` +
        `se guardará su costo real y se aplicará el precio de venta indicado.\n` +
        `Después de confirmar, la compra ya NO se podrá cancelar.`,
    );
    if (!ok) return;

    this.purchaseService.confirmPurchase(compra.id).subscribe({
      next: (actualizada) => {
        //Se reemplaza por la respuesta del servidor (no estado local optimista):
        //el confirmedAt lo pone el backend y es la evidencia de cuando ocurrio.
        this.purchases = this.purchases.map((p) =>
          p.id === actualizada.id ? actualizada : p,
        );
        this.loadMargins();
        this.loadProducts();
      },
      error: (err) => alert(err.error?.message || 'No se pudo confirmar la compra'),
    });
  }

  //Cancelar una compra PENDIENTE. Una CONFIRMADA da 409 y el mensaje del
  //backend explica por que: su stock y su costo son hechos reales.
  cancelarCompra(compra: PurchaseDTO) {
    if (compra.confirmed) {
      alert(
        'Esta compra ya está confirmada: su mercancía entró al almacén y su ' +
          'costo ya es el vigente. Una compra confirmada no se puede cancelar.',
      );
      return;
    }

    if (!confirm('¿Cancelar esta compra? Todavía no tiene efecto en el stock.')) return;

    this.purchaseService.cancelPurchase(compra.id).subscribe({
      next: () => {
        this.detalleAbiertaIds.delete(compra.id);
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

  /**
   * Sanea un renglón mientras se escribe.
   *
   * <p>Redondea la cantidad a entero y acota los importes a 2 decimales. Es la
   * segunda mitad de la defensa: los `keydown` bloquean las teclas incómodas, pero
   * un pegado o un valor previo de la base pueden colarse. Se sanitiza igual
   * porque el backend también valida y no se quiere depender de una sola capa.
   */
  validarLinea(l: LineaCompra) {
    //Math.trunc corta los decimales: 1.6 -> 1. No hay 1.6 de jabón.
    l.quantity = Math.max(1, Math.trunc(Number(l.quantity) || 1));
    l.unitCost = Math.max(0, this.redondear2(Number(l.unitCost) || 0));
    if (l.unitPrice !== null && l.unitPrice !== undefined) {
      l.unitPrice = Math.max(0, this.redondear2(Number(l.unitPrice) || 0));
    }
  }

  /** Redondea a 2 decimales sin arrastrar errores de coma flotante. */
  private redondear2(n: number): number {
    return Math.round(n * 100) / 100;
  }

  // ===== Filtros de teclado y pegado (punto 7 del encargo) =====
  // Se delegan a los validadores compartidos para que las reglas sean las mismas
  // en todos los formularios de la app y no se dupliquen.

  soloDigitos = soloDigitos;
  soloDigitosYPunto = soloDigitosYPunto;

  /**
   * Mayúsculas para los campos de código (punto 7.4).
   *
   * <p>Se aplica solo a RFC y nombre de proveedor, NO al nombre de los productos
   * ni a las descripciones: "Tacos de chicharrón" en mayúsculas se lee peor, y la
   * búsqueda ya es insensible a mayúsculas. Lo que sí importa es que "Dairy Queen"
   * y "DAIRY QUEEN" no se guarden como dos proveedores distintos.
   */
  aMayusculas = aMayusculas;

  // ===== Validación de proveedor (punto 7.2 y 7.4) =====
  // Los errores se muestran debajo del input con `*ngIf="errores['rfc']"`.
  errores: Record<string, string> = {};

  /** Valida el RFC del proveedor: letras y números, máximo 13. */
  validarCampo(campo: 'rfc') {
    const resultado = validarRfc(this.formProvider.rfc || '');

    if (resultado.ok) {
      delete this.errores[campo];
    } else {
      this.errores[campo] = resultado.error;
    }
  }

  /**
   * Pega en el RFC: se quita todo lo que no sea letra o número, se pasa a
   * mayúsculas y se corta a 13.
   *
   * <p>El pegado se sanean aparte del keydown porque pegar no dispara `keydown`:
   * sin esto, copiar un RFC de un PDF con guiones y espacios lo saltaría.
   */
  onPasteRfc(event: ClipboardEvent) {
    const texto = event.clipboardData?.getData('text') ?? '';
    this.formProvider.rfc = texto
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase()
      .slice(0, 13);
    event.preventDefault();
    this.validarCampo('rfc');
  }

  /** Pega en "cantidad": solo dígitos, y se descarta la notación científica. */
  onPasteCantidad(event: ClipboardEvent, l: LineaCompra) {
    const texto = event.clipboardData?.getData('text') ?? '';
    l.quantity = Math.max(1, Number(sanearDigitos(texto)) || 1);
    event.preventDefault();
  }

  /** Pega en un campo de precio: deja dígitos y un solo punto, máximo 2 decimales. */
  onPastePrecio(event: ClipboardEvent, l: LineaCompra, campo: 'unitCost' | 'unitPrice') {
    const texto = event.clipboardData?.getData('text') ?? '';
    const valor = this.redondear2(Number(sanearPrecio(texto)) || 0);
    if (campo === 'unitCost') {
      l.unitCost = Math.max(0, valor);
    } else {
      l.unitPrice = Math.max(0, valor);
    }
    event.preventDefault();
  }
}