import { Component, OnInit, ViewChild } from '@angular/core';
import { ProductForm, Category } from '../../core/interfaces/product/product';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductService } from '../../core/service/product-service/product-service';
import { Router } from '@angular/router';
import { CategoryService } from '../../core/service/category-service/category-service';
import { Sidebar } from '../sidebar/sidebar';
import { AuthService } from '../../core/service/auth-service/auth-service';
import { HasPermissionDirectives } from '../../core/routes/directives/has-permission-directives';
import { environment } from '../../../environments/environment';
// Servicio compartido del sidebar (reemplaza menuOpen local)
import { SidebarService } from '../../core/service/sidebar-service/sidebar-service';
// Paginacion reutilizable: pipe recorta la lista / control pinta el pie de tabla
import { PaginatePipe } from '../../core/pipes/paginate/paginate';
import { PaginationControl } from '../../core/components/pagination-control/pagination-control';
import { SelectOnFocus } from '../../core/routes/directives/select-on-focus';
  import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
  import {
    MAX_SKU_LENGTH,
    aMayusculas,
    sanearDigitos,
    sanearPrecio,
    soloDigitos,
    soloDigitosYPunto,
    validarBarcode,
    validarEntero,
    validarPrecio,
    validarRfc,
    validarSku,
  } from '../../core/utils/validadores';


@Component({
  selector: 'app-productos',
  imports: [CommonModule, FormsModule, Sidebar, HasPermissionDirectives, PaginatePipe, PaginationControl, SelectOnFocus, MatSnackBarModule],
  templateUrl: './productos.html',
  styleUrl: './productos.css',
})

export class Productos implements OnInit {
  // ANTES: menuOpen = false aqui (estado local)
  // AHORA: se usa sidebar.menuOpen del servicio compartido
  products: ProductForm[] = [];
  categories: Category[] = [];
  selectedFile: File | null = null;
  loading = true;
  @ViewChild('fileInput') fileInput: any;
  isSaving = false;
  private loaded = false;

  // Modo edicion: sería null y se "activa" con el id del producto al hacer clic
  // en Editar. Sirve al template para mostrar el boton Cancelar (*ngIf) y para
  // saber cuando el formulario esta en modo "Actualizar".
  editingProductId: number | null = null;

  // Estado de paginacion (el pie de tabla y el pipe 'paginate' lo consumen).
  // El clamp de pagina fuera de rango lo resuelve el propio pipe, asi no hay
  // que resetear manualmente tras borrar el ultimo item de una pagina.
  page = 0;
  pageSize = 8;

  // Filtro por categoria (dropdown en la tabla): null = "Todas".
  // Se usa [ngValue] en el <option> para que el valor sea number (no string)
  // y la comparacion estricta (===) del getter funcione.
  selectedCategory: number | null = null;

  // Lista filtrada: si hay categoria seleccionada devuelve solo los productos
  // de esa categoria; si no, la lista completa. Se reevalua automaticamente
  // en cada deteccion de cambios (zone.js) al cambiar selectedCategory.
  get filteredProducts(): ProductForm[] {
    return this.selectedCategory !== null
      ? this.products.filter(p => p.categoryId === this.selectedCategory)
      : this.products;
  }

  // Al cambiar el filtro se vuelve a la primera pagina: si estabas en la
  // pagina 3 y filtras, el clamp del pipe evitaria la tabla vacia, pero es
  // mas claro empezar desde el inicio con el nuevo criterio.
  onCategoryFilterChange(): void {
    this.page = 0;
  }

  //Se inicializan los atributos de la interface
  //form:
  form: ProductForm = {
    name: '',
    price: 0,
    stock: 0,
    sku: '',
    barcode: '',
    // 0 = "sin categoria todavia". Al llegar el catalogo (loadCategories) se
    // reemplaza por la primera categoria (categoria por defecto del formulario).
    categoryId: 0
  };

  constructor(
    private productService: ProductService,
    private categoryService: CategoryService,
    private router: Router,
    public auth: AuthService,
    // Inyectar servicio compartido del sidebar
    public sidebar: SidebarService,
    private snack: MatSnackBar
  ){}

  ngOnInit() {
    if(!this.loaded){
      this.loadProducts();
      this.loadCategories();
      this.loaded = true;
    }
  }

  // ANTES: toggleMenu() controlaba menuOpen local.
  // AHORA: el sidebar emite el evento toggle y el componente actualiza sidebar.menuOpen
  // desde el template: (toggle)="sidebar.menuOpen = $event"

  //Se cargan los productos desde la BD
  loadProducts(){
    console.log("Cargando productos...");
    this.productService.getProducts().subscribe(data => { //data:
      this.products = data;
      this.loading = false;
    });
  }

  //Se cargan las categorias desde la BD
  loadCategories(){
    this.categoryService.getCategories().subscribe(data => {
      this.categories = data;

      // Categoria por defecto (homologado con el rol por defecto del formulario
      // de usuarios): si el formulario aun no tiene categoria (0 = sin
      // seleccionar), se preselecciona la primera del catalogo. Asi el <select>
      // no aparece vacio y crear un producto sin tocar el combo no envia
      // categoryId 0.
      if(data.length > 0 && this.form.categoryId === 0){
        this.form.categoryId = data[0].id;
      }
    });
  }

  //Se selecciona el archivo
  onFileSelected(event: any){ //event:
    //target:
    //files:
    this.selectedFile = event.target.files[0] ?? null; //??
  }

  //Guardar el producto en la BD
  save(){
    if(!this.form.id && !this.auth.hasPermission('CREAR_PRODUCTOS')){
      return;
    }

    if(this.form.id && !this.auth.hasPermission('EDITAR_PRODUCTOS')){
      return;
    }

    if(this.isSaving) return;

    // ===== Validación ANTES de mandar nada (V3) =====
    // Se valida aquí y no solo en el backend por dos razones: no se hace un
    // request que ya se sabe que va a fallar con 400, y el mensaje aparece
    // debajo del campo que está mal en vez de un aviso genérico arriba.
    if(!this.formularioValido()){
      this.snack.open('Revisa los campos marcados en rojo', 'Cerrar', { duration: 4000 });
      return;
    }

    this.isSaving = true;

    const formData = new FormData();//formData: 

    formData.append('name', this.form.name);
    formData.append('price', this.form.price.toString());
    formData.append('stock', this.form.stock.toString());
    formData.append('categoryId', this.form.categoryId.toString());
    formData.append('sku', this.form.sku);
    formData.append('barcode', this.form.barcode);

    if(this.selectedFile){
      formData.append('image', this.selectedFile)//append:
    }

    if(this.form.id){
      //Editar
      this.productService.updateProduct(this.form.id, formData).subscribe({
        next: (updatedProduct) => {//Variable temporal?
          //?
          //:
          //=>
          //map:
          this.products = this.products.map(p => p.id === updatedProduct.id ? updatedProduct : p);
          this.resetForm();
        }, error: (err) => {
          this.isSaving = false;
          this.snack.open(err.error?.message || 'No se pude actualizar el producto', 'Cerrar', {duration:4000});
          console.log('Error al actualizar', err);
        }
      });
    } else {
        //Crear
        this.productService.addProduct(formData).subscribe({
        next: (product) => {
          //this.products.unshift(product);
          this.products = [product, ...this.products];
          this.resetForm();
          console.log('Producto guardado');
        }, error: (err) => {
          this.isSaving = false;
          this.snack.open(err.error?.message || 'No se pudo guardar el producto', 'Cerrar', {duration: 4000});
          console.log('Error al guardar', err);
        }
      });
    }
  }

  //Los campos se resetean(se ponen en blanco)
  resetForm(){
    this.form = {
      name: '',
      price: 0,
      stock: 0,
      sku: '',
      barcode: '',
      // Se conserva la categoria por defecto (la primera del catalogo) para que
      // tras guardar/actualizar el formulario quede listo para crear otro
      // producto sin tener que volver a elegir categoria.
      categoryId: this.categories.length > 0 ? this.categories[0].id : 0
    };

    this.selectedFile = null
    this.fileInput.nativeElement.value = '';//nativeElement
    this.isSaving = false;
    // Fuera de modo edicion: al terminar de crear/actualizar el formulario
    // vuelve al estado "crear" y el boton Cancelar desaparece.
    this.editingProductId = null;
  }

  //Cancela la edicion a mano: resetea el formulario completo (mismo efecto que
  //resetForm, pero es la accion del boton Cancelar mientras se edita).
  cancelEdit(){
    this.resetForm();
  }

  //Se edita el producto
  editProduct(product: ProductForm){ //Variable de la interface(se consumen sus atributos)
    // Marca el producto en edicion → el template muestra el boton Cancelar.
    this.editingProductId = product.id ?? null;

    this.form = {
      id: product.id,
      name: product.name,
      price: product.price,
      stock: product.stock,
      sku: product.sku,
      barcode: product.barcode,
      categoryId: product.categoryId
    };
  }

  //Se elimina el producto de la BD
  deleteProduct(id?: number){

    if(!this.auth.hasPermission('ELIMINAR_PRODUCTOS')){
      return;
    }


    if(!id) return;


    if(confirm('¿Seguro que deseas eliminar este producto?')){
      this.productService.deleteProduct(id).subscribe({
        next: () => {
          this.products = this.products.filter(p => p.id !== id);
          console.log('Producto eliminado');
        }, 
        error: (err) => {
          // El backend devuelve 409 si el producto tiene ventas asignadas
          alert(err.error?.message || 'No se pudo eliminar el producto');
        }
      });
    }
  }

  //Da de baja el producto (borrado logico). Se usa cuando el producto YA tiene
  //ventas/compras (hasHistory = true), por eso no se puede eliminar fisicamente.
  //El backend solo cambia active = false y lo saca del catalogo; se conserva el
  //historico. El producto desaparece de esta tabla (que es de activos).
  deactivateProduct(id?: number){

    if(!this.auth.hasPermission('DESACTIVAR_PRODUCTOS')){
      return;
    }

    if(!id) return;

    if(confirm('¿Seguro que deseas dar de baja este producto? Dejará de estar disponible para la venta.')){
      this.productService.deactivateProduct(id).subscribe({
        next: () => {
          this.products = this.products.filter(p => p.id !== id);
          console.log('Producto dado de baja');
        },
        error: (err) => {
          alert(err.error?.message || 'No se pudo dar de baja el producto');
        }
      });
    }
  }

  //Navega a la vista de productos dados de baja (boton a la derecha del filtro)
  verDesactivados(){
    this.router.navigate(['/productos-desactivados']);
  }

  //Validar campos numericos
  validateNumber(field: 'price' | 'stock'){//Field:
    // El stock puede ser 0 (agotado); el precio no puede bajar de 1.
    const min = field === 'stock' ? 0 : 1;
    if(this.form[field] < min){
      this.form[field] = min;
    }
  }

// =========================================================================
//  VALIDACIONES DEL FORMULARIO (V3, punto 7 del encargo)
// =========================================================================
//  Ahora cada campo valida con las reglas de `core/utils/validadores` y el error
//  se MUESTRA debajo del input, en vez de solo acotar el valor en silencio.
//
//  La diferencia con la versión anterior es que se explains qué está mal. El
//  código viejo hacía `if (price < 1) price = 1` y `sku.replace(/\D/g,'')`:
//  corregía el valor pero el usuario no sabía POR QUÉ le cambiaron lo que
//  escribió. Con 1.875 en el stock aparecía un 1 silencioso, y con "CHOC-500" en
//  el SKU se quedaba en "500", que es otro producto distinto.

  /**
   * Mensajes de error por campo. El template los muestra con `*ngIf="errores.x"`
   * debajo de cada input. Vacío = sin error.
   */
  errores: Record<string, string> = {};

  /**
   * Acceso tipado a un campo del formulario.
   *
   * <p>Se evita `this.form[campo]` directo porque TypeScript no permite indexar
   * un objeto con un tipo sin índice. Este getter devuelve el valor ya con el
   * tipo que el validador espera, sin casts inseguros.
   */
  private valorDe(campo: 'price' | 'stock' | 'sku' | 'barcode' | 'rfc'): string | number | null {
    switch (campo) {
      case 'price':
        return this.form.price;
      case 'stock':
        return this.form.stock;
      case 'sku':
        return this.form.sku;
      case 'barcode':
        return this.form.barcode;
      default:
        return '';
    }
  }

  /** Escribe en un campo del formulario con el mismo criterio tipado. */
  private escribirEn(campo: 'price' | 'stock', valor: number) {
    if (campo === 'price') {
      this.form.price = valor;
    } else {
      this.form.stock = valor;
    }
  }

  /** Valida un campo y guarda (o limpia) su mensaje de error. */
  validarCampo(campo: 'price' | 'stock' | 'sku' | 'barcode' | 'rfc') {
    const valor = this.valorDe(campo);

    let resultado;
    switch (campo) {
      case 'price':
        resultado = validarPrecio(valor, 'precio');
        break;
      case 'stock':
        resultado = validarEntero(valor, 'stock');
        break;
      case 'sku':
        resultado = validarSku(String(valor ?? ''));
        break;
      case 'barcode':
        resultado = validarBarcode(String(valor ?? ''));
        break;
      default:
        resultado = validarRfc(String(valor ?? ''));
    }

    if (resultado.ok) {
      delete this.errores[campo];
    } else {
      this.errores[campo] = resultado.error;
    }
  }

  /** Valida todo el formulario. Devuelve false si algo está mal. */
  formularioValido(): boolean {
    (['price', 'stock', 'sku', 'barcode'] as const).forEach((c) => this.validarCampo(c));
    return Object.keys(this.errores).length === 0;
  }

  // ===== Filtros de teclado y pegado =====
  // Se delegan a los validadores compartidos: las reglas son las mismas en todos
  // los formularios y no se duplican.

  soloDigitos = soloDigitos;
  soloDigitosYPunto = soloDigitosYPunto;
  aMayusculas = aMayusculas;

  /**
   * Pega en el precio: quita letras y la notación científica.
   *
   * <p>Necesario aparte del keydown porque PEGAR no dispara `keydown`. Si no,
   * el usuario podría pegar "1e5" y saltarse el filtro de teclas.
   */
  onPastePrecio(event: ClipboardEvent, campo: 'price') {
    const texto = event.clipboardData?.getData('text') ?? '';
    this.escribirEn(campo, Number(sanearPrecio(texto)) || 0);
    event.preventDefault();
    this.validarCampo(campo);
  }

  /** Pega en stock o barcode: solo dígitos, sin notación científica. */
  onPasteEntero(event: ClipboardEvent, campo: 'stock' | 'barcode') {
    const texto = event.clipboardData?.getData('text') ?? '';
    const digitos = sanearDigitos(texto);

    if (campo === 'stock') {
      this.form.stock = Number(digitos) || 0;
    } else {
      this.form.barcode = digitos;
    }
    event.preventDefault();
    this.validarCampo(campo);
  }

  /** Pega en barcode: solo dígitos, y se conservan los ceros a la izquierda. */
  onPasteBarcode(event: ClipboardEvent) {
    const texto = event.clipboardData?.getData('text') ?? '';
    this.form.barcode = sanearDigitos(texto);
    event.preventDefault();
    this.validarCampo('barcode');
  }

  /**
   * Pega en el SKU: se permite texto (letras, números y - _ . /) y se pasa a
   * mayúsculas, que es donde "choc-500" y "CHOC-500" se vuelven el mismo SKU.
   */
  onPasteSku(event: ClipboardEvent) {
    const texto = event.clipboardData?.getData('text') ?? '';
    this.form.sku = texto.trim().toUpperCase().slice(0, MAX_SKU_LENGTH);
    event.preventDefault();
    this.validarCampo('sku');
  }

  categorias(){
   this.router.navigate(['/categorias'])
  }

  //Arma la URL de la imagen del producto.
  //- Si el backend devuelve una URL absoluta (http://...) se usa tal cual.
  //- Si devuelve una ruta relativa (ej: "uploads/x.png") se completa contra
  //  environment.api. Asi las imagenes no dependen de "localhost" al deployar
  //  (backend en Railway devuelve rutas relativas).
  imageUrl(img?: string): string {
    if (!img) return '';

    if (img.startsWith('http://') || img.startsWith('https://')) {
      return img;
    }

    return `${environment.api}${img.startsWith('/') ? '' : '/'}${img}`;
  }

  //Deja solo digitos en el campo indicado (barras de código / SKU númerico)
  //Se usa con (input), cada tecla se filtra al instante
  soloNumeros(field: 'sku' | 'barcode'){
    this.form[field] = this.form[field].replace(/\D/g, '');
  }

}
