import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
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
  imports: [CommonModule, Sidebar, HasPermissionDirectives, PaginatePipe, PaginationControl],
  templateUrl: './deactivated-users.html',
  styleUrl: './deactivated-users.css',
})

// Vista dedicada a los usuarios DADOS DE BAJA (borrado logico).
// Se llega desde el boton "Ver desactivados" de /usuarios. Solo muestra la
// tabla de inactivos + el boton "Dar de alta" (PATCH /users/{id}/active).
export class DeactivatedUsers implements OnInit {
  users: User[] = [];
  loading = true;

  // Estado de paginacion del pie de tabla (mismo patron que los CRUD)
  page = 0;
  pageSize = 8;

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
