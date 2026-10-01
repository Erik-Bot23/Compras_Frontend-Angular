import { Component, Output, EventEmitter, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/service/auth-service/auth-service';
// Importar el servicio compartido que maneja el estado del menu
import { SidebarService } from '../../core/service/sidebar-service/sidebar-service';
import { CommonModule } from '@angular/common';
  import { FormsModule } from '@angular/forms';


@Component({
  selector: 'app-sidebar',
  imports: [CommonModule, FormsModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
})
  export class Sidebar {

    /**
     * Ruta de la sección "Inicio" del menú.
     *
     * Se declara como campo de la clase y no como constante del módulo para
     * que el template pueda compararla en `esActiva(inicioRoute)`. Se centraliza
     * porque la usan tres sitios: el template, `inicio()` y el marcado del
     * enlace activo. Escribiendo "/cobro" a mano en cada uno, cualquier cambio de
     * ruta desincronizaría el "estoy aquí" del menú.
     */
    readonly inicioRoute = '/cobro';

  constructor(
    private router: Router,
    private cd: ChangeDetectorRef,
    public auth: AuthService,
    // Inyectar el servicio compartido.
    // "public" permite accederlo desde el template como sidebar.menuOpen
    public sidebar: SidebarService){}

  // ANTES: tenia menuOpen = false aqui (estado local del componente).
  // AHORA: se elimino porque el estado vive en SidebarService.
  // Asi todos los componentes comparten el mismo estado.

  // Evento que se envia al componente padre cuando el usuario abre/cierra el menu manualmente
  @Output() toggle = new EventEmitter<boolean>();

  /**
   * Abrir/cerrar el menu al hacer clic en el boton "Menu".
   *
   * 1. Invierte sidebar.menuOpen (el servicio compartido).
   * 2. Emite el evento toggle para que el padre (cobro, productos, etc.)
   *    actualice su variable local y aplique la clase CSS collapsed.
   * 3. detectChanges() fuerza a Angular a redibujar el DOM inmediatamente.
   */
  toggleMenu(){
    this.sidebar.menuOpen = !this.sidebar.menuOpen;
    this.toggle.emit(this.sidebar.menuOpen);
    this.cd.detectChanges();
  }

  get userName(): string {
    return this.auth.getUsername();
  }

  // ============================================================
  // MENU DE NAVEGACION (data-driven)
  // Cada seccion tiene:
  //  - label:      texto visible de la seccion.
  //  - route:      ruta a la que navega.
  //  - permission: permiso requerido (la directiva *hasPermission lo filtra).
  //  - icon:       ruta de la imagen en assets/icons/. Si esta vacio (''),
  //                la seccion se muestra solo con texto (el HTML usa
  //                *ngIf="item.icon" para no pintar un <img> vacio).
  // Los PNG de assets/icons miden 512x512; el tamano de render lo controla
  // la clase .menu-icon en sidebar.css.
  // ============================================================
  menuItems = [
    {
      label: 'Productos',
      route: '/productos',
      permission: 'VER_PRODUCTOS',
      icon: 'assets/icons/comida-y-bebida.png'
    },
    {
      label: 'Categorías',
      route: '/categorias',
      permission: 'VER_CATEGORIAS',
      icon: 'assets/icons/categorias.png'
    },
    {
      label: 'Usuarios',
      route: '/usuarios',
      permission: 'VER_USUARIOS',
      icon: 'assets/icons/usuarios.png'
    },
    {
      label: 'Roles',
      route: '/roles',
      permission: 'VER_ROLES',
      icon: 'assets/icons/roles.png'
    },
    {
      label: 'Compras',
      route: '/compras',
      permission: 'VER_COMPRAS',
      icon: 'assets/icons/compras.png'
    },
    {
      label: 'Reportes',
      route: '/reportes',
      permission: 'VER_REPORTES',
      icon: 'assets/icons/reportes.png'
    },
    {
      label: 'Historial de ventas',
      route: '/salehistory',
      permission: 'VER_VENTAS',
      icon: 'assets/icons/historial.png'
    },
  ]

  go(route: string){
    this.router.navigate([route]);
  }

perfil(){
   this.router.navigate(['/perfil']);
  }

  inicio(){
   this.router.navigate([this.inicioRoute]);
  }

  /**
   * ¿La ruta dada es la sección donde el usuario está ahora? (PUNTO 6)
   *
   * Marca el enlace activo del menú con la clase `.active`, que el CSS
   * sombrea. Sin esto, en un menú de nueve secciones el usuario no tiene idea de
   * dónde está parado: el menú se ve igual en todas las pantallas.
   *
   * Por qué se compara exacta y no con `includes`. Con `includes`,
   * "/sales" matchearía también "/sales-history" y se marcarían las dos
   * secciones a la vez. La comparación exacta evita eso.
   *
   * <p>También se ignora la barra final.
   */
  esActiva(route: string): boolean {
   const actual = this.router.url.split('?')[0].split('#')[0].replace(/\/$/, '');
   const objetivo = route.split('?')[0].replace(/\/$/, '');
   return actual === objetivo;
  }
}
