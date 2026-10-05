import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { User } from '../../core/interfaces/user/user';
import { UserService } from '../../core/service/user-service/user-service';
import { AuthService } from '../../core/service/auth-service/auth-service';
import { Sidebar } from '../sidebar/sidebar';
import { HasPermissionDirectives } from '../../core/routes/directives/has-permission-directives';
// Servicio compartido del sidebar (mantiene el menu sandwich sincronizado)
import { SidebarService } from '../../core/service/sidebar-service/sidebar-service';
// Paginacion reutilizable: pipe recorta la lista / control pinta el pie de tabla
import { PaginatePipe } from '../../core/pipes/paginate/paginate';
import { PaginationControl } from '../../core/components/pagination-control/pagination-control';

@Component({
  selector: 'app-deactivated-users',
  imports: [CommonModule, FormsModule, Sidebar, HasPermissionDirectives, PaginatePipe, PaginationControl],
  templateUrl: './deactivated-users.html',
  styleUrl: './deactivated-users.css',
})

// Vista dedicada a los usuarios DADOS DE BAJA (borrado logico).
// Se llega desde el boton "Ver desactivados" de /usuarios. Muestra la tabla de
// inactivos + el boton "Dar de alta" (PATCH /users/{id}/active).
//
// V5: se agregan los filtros de busqueda. El motivo concreto es "encontrar el
// registro de una persona que se fue": con la tabla pelada solo se podía
// buscar a ojo, y en un local con historia de varios años eso es imposible.
export class DeactivatedUsers implements OnInit {
  users: User[] = [];
  loading = true;

  // Estado de paginacion del pie de tabla (mismo patron que los CRUD)
  page = 0;
  pageSize = 8;

  // ===== Filtros de busqueda (V5) =====
  /** Texto libre: busca en NOMBRE y CORREO. */
  searchText = '';

  /** Fecha desde la que se dio de baja (yyyy-MM-dd). '' = sin limite. */
  fromDate = '';

  /** Fecha hasta la que se dio de baja (yyyy-MM-dd). '' = sin limite. */
  toDate = '';

  /**
   * Usuarios dados de baja que pasan los filtros.
   *
   * <p>El filtro es CLIENT-SIDE a propósito: la lista ya viene completa de
   * `GET /users` (el backend devuelve activos e inactivos juntos y esta vista
   * separa los inactivos), así que filtrar en el navegador no cuesta un request
   * extra. Con muchos usuarios sería un endpoint con query, pero para esta
   * pantalla el costo no lo justifica.
   *
   * <p>⚠️ `deactivatedAt` puede venir null (usuarios dados de baja antes de V5,
   * cuando la fecha no se guardaba). Esos usuarios se EXCLUYEN cuando hay filtro
   * de fechas, porque no hay fecha que comparar: es preferible a incluirlos y
   * que el usuario piense que seetten fuera del rango.
   */
  get filteredUsers(): User[] {
    const texto = this.searchText.trim().toLowerCase();

    return this.users.filter(u => {
      // Texto: nombre O correo. Con las dos columnas porque quien busca un
      // registro muchas veces recuerda el correo, no el nombre.
      if (texto) {
        const coincideNombre = (u.name ?? '').toLowerCase().includes(texto);
        const coincideCorreo = (u.email ?? '').toLowerCase().includes(texto);
        if (!coincideNombre && !coincideCorreo) return false;
      }

      // Rango de fechas sobre la fecha de BAJA (es lo que se busca aquí: "¿quién
      // se fue en abril?"). Se comparan STRINGS yyyy-MM-dd: el orden
      // lexicográfico de ese formato ES el orden cronológico, y comparar
      // objetos Date en UTC desfasa un día en los husos negativos (México es
      // UTC-6), lo que会把 un "01/10" al "30/09".
      if (this.fromDate || this.toDate) {
        if (!u.deactivatedAt) return false; // sin fecha: no entra en el rango

        const dia = u.deactivatedAt.substring(0, 10);
        if (this.fromDate && dia < this.fromDate) return false;
        if (this.toDate && dia > this.toDate) return false;
      }

      return true;
    });
  }

  /** Al cambiar cualquier filtro se vuelve a la página 1 para no quedar en una vacía. */
  onFilterChange(): void {
    this.page = 0;
  }

  /**
   * Cuántos usuarios dados de baja NO tienen fecha de baja.
   *
   * <p>Solo se usa para el aviso. Son los dados de baja antes de V5: la columna
   * `deactivated_at` se agregó después y a esos usuarios no se les puede poner
   * fecha sin inventarla.
   *
   * <p>Se cuenta sobre la lista COMPLETA, no sobre la filtrada: si contara sobre
   * la filtrada siempre daría 0 (los que no tienen fecha ya fueron excluidos por
   * el filtro de fechas) y el aviso nunca aparecería.
   */
  get sinFecha(): number {
    return this.users.filter(u => !u.deactivatedAt).length;
  }

  /** Limpia los tres filtros de golpe. */
  clearFilters(): void {
    this.searchText = '';
    this.fromDate = '';
    this.toDate = '';
    this.page = 0;
  }

  constructor(
    private userservice: UserService,
    public auth: AuthService,
    public sidebar: SidebarService
  ) {}

  ngOnInit(): void {
    this.loadInactive();
  }

  //El endpoint GET /api/users devuelve TODOS (activos e inactivos); aqui se
  //filtran client-side los inactivos (active === false). Se usa === false para
  //no arrastrar usuarios sin el campo (undefined) a esta lista.
  loadInactive(): void {
    this.userservice.getUsers().subscribe({
      next: (data) => {
        this.users = data.filter(u => u.active === false);
        this.loading = false;
      },
      error: (err) => {
        console.error('Error al cargar usuarios dados de baja', err);
        this.loading = false;
      }
    });
  }

  //Da de alta (reactiva) un usuario inactivo: vuelve a /usuarios
  activate(id?: number): void {
    if(!id) return;

    if(!this.auth.hasPermission('ACTIVAR_USUARIOS')){
      return;
    }

    if(confirm('¿Seguro que deseas dar de alta a este usuario?')){
      this.userservice.activateUser(id).subscribe({
        next: () => {
          // Al reactivarse deja de pertenecer a esta lista de inactivos
          this.users = this.users.filter(u => u.id !== id);
          console.log('Usuario dado de alta');
        },
        error: (err) => {
          alert(err.error?.message || 'No se pudo dar de alta el usuario');
        }
      });
    }
  }
}
