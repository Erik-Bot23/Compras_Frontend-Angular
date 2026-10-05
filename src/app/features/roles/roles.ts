import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Sidebar } from '../sidebar/sidebar';
import { RoleService } from '../../core/service/role-service/role-service';
import { Router } from '@angular/router';
import { CreateRoleRequest, PermissionModel, RoleModel, UpdateRoleRequest } from '../../core/models/role-model';
import { PermissionService } from '../../core/service/permission-service/permission-service';
import { HasPermissionDirectives } from '../../core/routes/directives/has-permission-directives';
import { AuthService } from '../../core/service/auth-service/auth-service';
// Servicio compartido del sidebar
import { SidebarService } from '../../core/service/sidebar-service/sidebar-service';
// Paginacion reutilizable: pipe recorta la lista / control pinta el pie de tabla
import { PaginatePipe } from '../../core/pipes/paginate/paginate';
import { PaginationControl } from '../../core/components/pagination-control/pagination-control';
import { aMayusculas, validarTexto } from '../../core/utils/validadores';

@Component({
  selector: 'app-roles',
  imports: [CommonModule, FormsModule, Sidebar, HasPermissionDirectives, PaginatePipe, PaginationControl],
  templateUrl: './roles.html',
  styleUrl: './roles.css',
})
export class Roles implements OnInit {
  // ANTES: menuOpen = false aqui. AHORA: se usa sidebar.menuOpen del servicio

  roles: RoleModel[] = [];
  roleName = '';

  // Estado de paginacion (los botones del pie solo navegan paginas validas)
  page = 0;
  pageSize = 8;

  permissions: PermissionModel[] = [];
  groupedPermissions: {[module: string]: PermissionModel[];} = {};
  selectedPermissions: string[] = [];
  

  editingRoleId: number | null = null;

  //Helpers
  aMayusculas = aMayusculas;
  errores: Record<string,string> = {};

  // ANTES: toggleMenu() controlaba menuOpen local.
  // AHORA: el sidebar maneja el estado via servicio compartido

  togglePermission(permissionName: string): void{
    if(this.selectedPermissions.includes(permissionName)){
      this.selectedPermissions=this.selectedPermissions.filter(
        permission => permission !== permissionName
      );
    } else {
      this.selectedPermissions = [
        ...this.selectedPermissions, permissionName
      ];
    }
  }

  constructor(
    private roleService: RoleService,
    private permissionService: PermissionService,
    private router: Router,
    public auth: AuthService,
    // Servicio compartido del sidebar
    public sidebar: SidebarService
  ){}

  ngOnInit() {
    this.loadRoles();
    this.loadPermissions();
  }

  loadRoles(): void {
    this.roleService.getRoles().subscribe(data => {
      this.roles = data;
    });
  }

  loadPermissions(): void {
    this.permissionService.getPermissions().subscribe(data => {
      this.permissions = data;
      this.groupPermissions();
    });
  }

  private groupPermissions(): void {
    this.groupedPermissions = {};

    this.permissions.forEach(permission => {
      const parts = permission.name.split('_');

      const module = parts.slice(1).join('_');

      if(!this.groupedPermissions[module]){
        this.groupedPermissions[module] = [];
      }

      this.groupedPermissions[module].push(permission);
    });
  }

  formatPermissionName(name: string): string{
    return name.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase())
  }

  hasPermissionSelected(permissionName: string): boolean{
    return this.selectedPermissions.includes(permissionName);
  }

  saveRole(): void{
    // Igual que en categorías: validar y pintar ANTES de decidir si se guarda.
    this.validarNombre();
    if(this.errores['name']) return;

    if(this.editingRoleId !== null){
      this.updateRole();
      return;
    }

    const request: CreateRoleRequest = {
      name: this.roleName.trim(),
      permissions: this.selectedPermissions
    };

    this.roleService.addRole(request).subscribe(newRole => {
      this.roles = [newRole, ...this.roles];
      this.resetForm();
    });
  }

  editRole(role: RoleModel): void{
    this.editingRoleId = role.id;
    this.roleName=role.name;
    this.selectedPermissions=role.permissions.map(permission => permission.name);
  }

  updateRole(): void{
    if(this.editingRoleId === null) return;

    // `saveRole` ya validó antes de llegar aquí, pero `updateRole` también se
    // puede llamar por su cuenta: no se confía y se revalida, con el mismo aviso.
    this.validarNombre();
    if(this.errores['name']) return;

    const request: UpdateRoleRequest = {
      name: this.roleName.trim(),
      permissions: this.selectedPermissions
    };

    this.roleService.updateRole(this.editingRoleId, request).subscribe(
      updatedRole => {
        this.roles = this.roles.map(role => role.id===updatedRole.id ? updatedRole : role);
        this.resetForm();
      }
    );
  }

  deleteRole(id: number): void{
    if(!confirm('¿Eliminar rol?')) return;

    this.roleService.deleteRole(id).subscribe({
      next: () => {
        this.roles = this.roles.filter(role => role.id !== id);
      },
      error: (err) => {
        // El backend devuelve 409 si el rol tiene usuarios asignados
        alert(err.error?.message || 'No se pudo eliminar el rol');
      }
    });
  }

  resetForm(): void{
    this.roleName ='';
    this.selectedPermissions = [];
    this.editingRoleId = null;
  }

  /**
   * Valida el nombre del rol.
   *
   * El campo decía "categoría": era un copy-paste de categorias.ts, y el mensaje
   * le decía al usuario que su nombre de ROL no podía tener más de 50 caracteres,
   * luego de "categoría".
   *
   * El `true` final es "obligatorio", y el máximo es 30 para calzar con el
   * `maxlength` del input.
   */
  validarNombre(){
    const r = validarTexto(this.roleName, 'nombre', 30, true);
    if(r.ok) delete this.errores['name'];
    else this.errores['name'] = r.error;
  }
}
