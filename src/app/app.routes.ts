import { Routes } from '@angular/router';
import { PermissionGuard } from './core/routes/guards/permission-guard';

export const routes: Routes = [
    //Se definen las rutas de todas las paginas
    { path: '', loadComponent: () => import('./features/login/login').then(m=>m.Login) },
    { path: 'cobro', loadComponent: () => import('./features/charge/cobro').then(m=>m.Cobro) },
    { path: 'perfil', loadComponent: () => import('./features/profile/perfil').then(m=>m.Perfil) },
    { path: 'compras', loadComponent: () => import('./features/shopping/compras').then(m=>m.Compras), canActivate:[PermissionGuard], data:{permission: 'VER_COMPRAS'} },
    { path: 'productos', loadComponent: () => import('./features/products/productos').then(m=>m.Productos), canActivate:[PermissionGuard], data:{permission: 'VER_PRODUCTOS'} },
    { path: 'reportes', loadComponent: () => import('./features/reports/reportes').then(m=>m.Reportes), canActivate:[PermissionGuard], data:{permission: 'VER_REPORTES'} },
    { path: 'usuarios', loadComponent: () => import('./features/users/usuarios').then(m=>m.Usuarios), canActivate:[PermissionGuard], data:{permission: 'VER_USUARIOS'} },
    { path: 'salehistory', loadComponent: () => import('./features/salehistory/salehistory').then(m=>m.Salehistory), canActivate:[PermissionGuard], data:{permission: 'VER_VENTAS'} },
    { path: 'categorias', loadComponent: () => import('./features/categories/categorias').then(m=>m.Categorias), canActivate:[PermissionGuard], data:{permission: 'VER_CATEGORIAS'} },
    { path: 'roles', loadComponent: () => import('./features/roles/roles').then(m=>m.Roles), canActivate:[PermissionGuard], data:{permission: 'VER_ROLES'} },
    { path: 'forgot-password', loadComponent: () => import('./features/login/forgot-password/forgot-password').then(m=>m.ForgotPassword) },
    { path: 'reset-password', loadComponent: () => import('./features/login/reset-password/reset-password').then(m=>m.ResetPassword) },
    { path: '**', redirectTo: '' }
];

export class AppRoutingModule{}
