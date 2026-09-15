import { Component, OnInit } from '@angular/core';
import { Category } from '../../core/interfaces/product/product';
import { CategoryService } from '../../core/service/category-service/category-service';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Sidebar } from '../sidebar/sidebar';
import { HasPermissionDirectives } from '../../core/routes/directives/has-permission-directives';
import { AuthService } from '../../core/service/auth-service/auth-service';
// Servicio compartido del sidebar
import { SidebarService } from '../../core/service/sidebar-service/sidebar-service';
// Paginacion reutilizable: pipe recorta la lista / control pinta el pie de tabla
import { PaginatePipe } from '../../core/pipes/paginate/paginate';
import { PaginationControl } from '../../core/components/pagination-control/pagination-control';

@Component({
  selector: 'app-categorias',
  standalone: true,
  imports: [CommonModule, FormsModule, Sidebar, HasPermissionDirectives, PaginatePipe, PaginationControl],
  templateUrl: './categorias.html',
  styleUrl: './categorias.css',
})
export class Categorias implements OnInit {
  categories: Category[] = [];
  categoryName = '';
  // ANTES: menuOpen = false aqui. AHORA: se elimino, se usa sidebar.menuOpen

  // Estado de paginacion (los botones del pie solo navegan paginas validas)
  page = 0;
  pageSize = 8;

  // Para el modo edición (0 = no se está editando)
  editingCategoryId: number | null = null;

  constructor(
    private categoryService: CategoryService,
    private router: Router,
    public auth: AuthService,
    public sidebar: SidebarService
  ){}

  ngOnInit() {
    this.loadCategories();
  }

  loadCategories(){
    this.categoryService.getCategories().subscribe(data => {
      this.categories = data;
    });
  }

  // ANTES: toggleMenu() controlaba menuOpen local.
  // AHORA: el sidebar maneja el estado via servicio compartido

  saveCategory(){
    if(!this.categoryName.trim()) return;

    // Si hay una categoría en edición, actualizar en vez de crear
    if(this.editingCategoryId !== null){
      this.categoryService.updateCategory(this.editingCategoryId, this.categoryName).subscribe({
        next: updated => {
          this.categories = this.categories.map(c => c.id === updated.id ? updated : c);
          this.cancelEdit();
        },
        error: (err) => {
          alert(err.error?.message || 'No se pudo actualizar la categoría');
        }
      });
      return;
    }

    this.categoryService.addCategory(this.categoryName).subscribe({
      next: newCat => {
        this.categories = [newCat, ...this.categories];
        this.categoryName = '';
      },
      error: (err) => {
        // El backend devuelve 409 si ya existe una categoría con ese nombre
        alert(err.error?.message || 'No se pudo guardar la categoría');
      }
    });
  }

  editCategory(category: Category){
    this.editingCategoryId = category.id;
    this.categoryName = category.name;
  }

  cancelEdit(){
    this.editingCategoryId = null;
    this.categoryName = '';
  }

  deleteCategory(id: number){
    if(!confirm('¿Eliminar categoría?')) return;

    this.categoryService.deleteCategory(id).subscribe({
      next: () => {
        this.categories = this.categories.filter(c => c.id !== id);
      },
      error: (err) => {
        // El backend devuelve 409 si la categoría tiene productos asociados
        alert(err.error?.message || 'No se pudo eliminar la categoría');
      }
    });
  }
}
