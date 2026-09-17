import { CommonModule } from '@angular/common';
import { Component, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { User, UserRole } from '../../core/interfaces/user/user';
import { UserService } from '../../core/service/user-service/user-service';
import { Sidebar } from '../sidebar/sidebar';
import { HasPermissionDirectives } from '../../core/routes/directives/has-permission-directives';
import { AuthService } from '../../core/service/auth-service/auth-service';
// Servicio compartido del sidebar
import { SidebarService } from '../../core/service/sidebar-service/sidebar-service';
// Paginacion reutilizable: pipe recorta la lista / control pinta el pie de tabla
import { PaginatePipe } from '../../core/pipes/paginate/paginate';
import { PaginationControl } from '../../core/components/pagination-control/pagination-control';

@Component({
  selector: 'app-usuarios',
  imports: [CommonModule, FormsModule, Sidebar, HasPermissionDirectives, PaginatePipe, PaginationControl],
  templateUrl: './usuarios.html',
  styleUrl: './usuarios.css',
})

export class Usuarios implements OnInit {
  // ANTES: menuOpen = false aqui. AHORA: se usa sidebar.menuOpen del servicio
  users: User[] = [];
  roles: UserRole[] = [];
  loading = true;
  isSaving = false;

  // Modo edicion: guarda el id del usuario que se esta editando. null = crear.
  // El template lo usa para mostrar el boton Cancelar con *ngIf.
  editingUserId: number | null = null;

  // Estado de paginacion (los botones del pie solo navegan paginas validas)
  page = 0;
  pageSize = 8;

  // Filtro de la tabla (dropdown de rol). null = "Todos".
  // Se usa [ngValue] (no [value]) para preservar el number y que la
  // comparacion estricta del getter funcione.
  // NOTA: ya no hay filtro de estado ni se muestran inactivos aqui. Esta tabla
  // lista SOLO usuarios activos; los dados de baja viven en /usuarios-desactivados.
  selectedRole: number | null = null;

  // Lista filtrada: solo usuarios activos (active !== false para tolerar
  // respuestas sin el campo) y, si hay rol elegido, que coincida el roleId.
  // Se reevalua sola al cambiar el select (zone.js).
  get filteredUsers(): User[] {
    return this.users.filter(user =>
      user.active !== false &&
      (this.selectedRole === null || user.roleId === this.selectedRole)
    );
  }

  // Al cambiar cualquier filtro se vuelve a la pagina 1 para no quedarse en
  // una pagina vacia con el nuevo criterio.
  onFilterChange(): void {
    this.page = 0;
  }

  form: User = {
    name: '',
    email: '',
    password: '',
    roleId: 1
  };

  constructor(
    private userservice: UserService,
    private router: Router,
    public auth: AuthService,
    // Servicio compartido del sidebar
    public sidebar: SidebarService
  ){}

  ngOnInit() {
    this.loadRoles();
    this.loadUsers();
  }

  // ANTES: toggleMenu() controlaba menuOpen local.
  // AHORA: el sidebar maneja el estado via servicio compartido

  loadRoles(){
    this.userservice.getRoles().subscribe(data => {
      this.roles = data;

      if(data.length > 0 && this.form.roleId === 0){
        this.form.roleId = data[0].id;
      }
    })
  }

  loadUsers(){
    this.userservice.getUsers().subscribe(data => {
      this.users = data;
      this.loading = false;
    });
  }

  save(){
    if(this.isSaving) return;

    this.isSaving = true;

    if(this.form.id){
      this.userservice.updateUser(this.form.id, 
        {
          name: this.form.name,
          email: this.form.email,
          roleId: this.form.roleId
        }
          ).subscribe({
            next: () => {
              this.loadUsers();
              this.resetForm();
            }, error: err => {
              this.isSaving = false;
              console.log('Error al actualizar', err);
            }
          });
    } else {
        this.userservice.createUser(
          {
            name: this.form.name,
            email: this.form.email,
            password: this.form.password ?? '',
            roleId: this.form.roleId
          }
            ).subscribe({
              next: () => {
                this.loadUsers();
                this.resetForm();
                console.log('Usuario guardado');
              }, error: err => {
                this.isSaving = false;
                console.log('Error al guardar', err);
              }
            });
    }
  }

  resetForm(){
    this.form = {
      name: '',
      email: '',
      password: '',
      roleId: 0
    };
    this.isSaving = false;
    // Fuera de modo edicion: despues de crear/actualizar el formulario vuelve
    // a "crear" y el boton Cancelar desaparece.
    this.editingUserId = null;
  }

  //Cancela la edicion a mano: resetea el formulario completo (mismo efecto que
  //resetForm, pero es la accion del boton Cancelar mientras se edita).
  cancelEdit(){
    this.resetForm();
  }

  editUser(user: User){
    // Marca el usuario en edicion → el template muestra el boton Cancelar.
    this.editingUserId = user.id ?? null;

    this.form = {
      id: user.id,
      name: user.name,
      email: user.email,
      roleId: user.roleId,
      roleName: user.roleName
    };
  }

  //Da de baja (borrado logico) un usuario. Como esta tabla solo lista activos,
  //el usuario se quita de la lista: aparecera en /usuarios-desactivados.
  deactivateUser(id?: number){
    if(!id) return;

    if(confirm('¿Seguro que deseas dar de baja este usuario?')){
      this.userservice.deActiveUser(id).subscribe({
        next: () => {
          this.users = this.users.filter(u => u.id !== id);
          console.log('Usuario dado de baja');
        }, error: (err) => console.error('Error al dar de baja', err)
      });
    }
  }

  //Navega a la vista de usuarios dados de baja (boton a la derecha del filtro)
  verDesactivados(){
    this.router.navigate(['/usuarios-desactivados']);
  }
}
