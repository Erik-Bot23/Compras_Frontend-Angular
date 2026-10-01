import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, Inject, DOCUMENT, OnInit, effect } from '@angular/core';
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
   * Se exponen como propiedades de la clase porque la plantilla los necesita
   * como handlers de eventos: `(keydown)="soloDigitosYPunto($event)"`.
   *
   * Su trabajo real es <b>bloquear la 'e' y la 'E'. El
   * `<input type="number">` del navegador las acepta y produce `1e5`, que es un
   * millón de golpe: el usuario escribe "1e5" pensando en otra cosa y el sistema
   * guarda cien mil. Con estos filtros la tecla ni entra al campo.
   */
  soloDigitos = soloDigitos;
  soloDigitosYPunto = soloDigitosYPunto;
  aMayusculas = aMayusculas;

  //true si cualquiera de los modales están abiertos
  get anyModalOpen(): boolean {
    return (
      this.sale.showPaymentModal ||
      this.sale.showCardModal ||
      this.sale.showWaitingModal ||
      this.cash.showCreateCashModal ||
      this.cash.showOpenCashModal ||
      this.cash.showCloseCashModal
    );
  }

  constructor(
    public cash: CashFacade,
    public sale: SaleFacade,
    public auth: AuthService,
    // Inyectar el servicio compartido del sidebar
    public sidebar: SidebarService,
    private cdr: ChangeDetectorRef, 
    @Inject(DOCUMENT) private document: Document
  ) {
    //effect() reacciona a cambios de signals y de getters re-evaluados por
    //la detección de cambios de Angular
    //this.cash.shoeOpenCashModal = true -> body.classList.add('modal-open')

    /**
     * ¿Por qué un effect y no un (click) o un ngOnInit?
     * Porque los modales se abren desde diversos lados: el click del botón,
     * el error 409 del backend que vuelve a abrir el modal, el Enter del form. Con
     * un effect, todos esos caminos quedan cubiertos sin repetir código. Y el getter
     * `anyModalOpen` ya existía: solo faltaba conectarlo
     */
    effect(() => {
      const abierto = this.anyModalOpen;
      if(abierto){
        this.document.body.classList.add('modal-open');
      } else {
        this.document.body.classList.remove('modal-open');
      }
    });
  }

  ngOnInit(): void {
    this.cash.initialize();
    this.sale.initialize();
  }

}