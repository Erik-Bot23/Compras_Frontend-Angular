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

@Component({
  selector: 'app-productos',
  imports: [CommonModule, FormsModule, Sidebar, HasPermissionDirectives, PaginatePipe, PaginationControl],
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
    categoryId: 0
  };

  constructor(
    private productService: ProductService,
    private categoryService: CategoryService,
    private router: Router,
    public auth: AuthService,
    // Inyectar servicio compartido del sidebar
    public sidebar: SidebarService
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
      categoryId: 0
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
        }, error: (err) => console.error('Error al eliminar', err)
      });
    }
  }

  //Validar campos numericos
  validateNumber(field: 'price' | 'stock'){//Field:
    // El stock puede ser 0 (agotado); el precio no puede bajar de 1.
    const min = field === 'stock' ? 0 : 1;
    if(this.form[field] < min){
      this.form[field] = min;
    }
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

}
