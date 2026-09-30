import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Sidebar } from '../sidebar/sidebar';
import { CashFacade } from './facade/cash-facade';
import { SaleFacade } from './facade/sale-facade';
import { HasPermissionDirectives } from '../../core/routes/directives/has-permission-directives';
import { AuthService } from '../../core/service/auth-service/auth-service';
// Importar el servicio compartido del sidebar
import { SidebarService } from '../../core/service/sidebar-service/sidebar-service';
import { SelectOnFocus } from '../../core/routes/directives/select-on-focus';
import { aMayusculas, soloDigitos, soloDigitosYPunto } from '../../core/utils/validadores';

@Component({
  selector: 'app-cobro',
  imports: [CommonModule, FormsModule, Sidebar, HasPermissionDirectives, SelectOnFocus],
  templateUrl: './cobro.html',
  styleUrl: './cobro.css',
})

export class Cobro implements OnInit {

  /**
   * Filtros de teclado de los validadores compartidos.
   *
   * <p>Se exponen como propiedades de la clase porque la plantilla los necesita
   * como handlers de eventos: `(keydown)="soloDigitosYPunto($event)"`.
   *
   * <p>Su trabajo real es <b>bloquear la 'e' y la 'E'</b>. El
   * `<input type="number">` del navegador las acepta y produce `1e5`, que es un
   * millón de golpe: el usuario escribe "1e5" pensando en otra cosa y el sistema
   * guarda cien mil. Con estos filtros la tecla ni entra al campo.
   */
  soloDigitos = soloDigitos;
  soloDigitosYPunto = soloDigitosYPunto;
  aMayusculas = aMayusculas;

  constructor(
    public cash: CashFacade,
    public sale: SaleFacade,
    public auth: AuthService,
    // Inyectar el servicio compartido del sidebar
    public sidebar: SidebarService,
    private cdr: ChangeDetectorRef 
  ) {}

  ngOnInit(): void {
    this.cash.initialize();
    this.sale.initialize();
  }
}