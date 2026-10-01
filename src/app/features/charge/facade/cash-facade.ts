import { Injectable } from '@angular/core';
import {
  CashRegister,
  CashSummary,
} from '../../../core/interfaces/cash-interface/cash-interface';
import { CashService } from '../../../core/service/cash-service/cash-service';
import { AuthService } from '../../../core/service/auth-service/auth-service';
import { validarPrecio } from '../../../core/utils/validadores';

/**
 * Estado y acciones de la caja registradora.
 *
 * V3: la caja se crea antes de abrirse. El flujo del usuario ahora son
 * tres pasos y no dos:
 * 
 *  Crear caja (opcional): registra la caja física con su número.
 *  Abrir caja: se elige una de las registradas y se indica el fondo.
 *  Cerrar caja: se cuenta el efectivo y el backend exige que cuadre.
 *
 * El paso 1 es opcional en el día a día porque la caja se crea una vez y se
 * usa una vez. Sirve para tener cajas rotuladas disponibles, como en un negocio
 * real donde hay varias cajas y se abre la que toca.
 */
@Injectable({ providedIn: 'root' })
export class CashFacade {
  //Fondo mínimo al abrir. El backend lo exige también (400), pero se replica aquí
  //para avisar sin hacer un request que ya se sabe que va a fallar.
  readonly MIN_OPENING = 100;

  //Variables para cash
  cashStatus?: CashRegister;
  cashSummary?: CashSummary;

  // ===== Modal de ABRIR caja =====
  showOpenCashModal = false;
  openingAmount = 0;

  /**
   * Caja elegida para abrir. Se llena con `GET /cash/available`, que devuelve solo
   * las que nunca se abrieron (una caja es un turno y no se reutiliza).
   */
  selectedCashNumber = '';

  /** Cajas nunca abiertas, para el selector. */
  availableCash: CashRegister[] = [];

  // ===== Modal de CREAR caja (V3) =====
  showCreateCashModal = false;

  /** Número nuevo, precargado con la sugerencia del backend ("CAJA 7"). */
  newCashNumber = '';

  // ===== Modal de CERRAR caja =====
  showCloseCashModal = false;
  closingAmount = 0;

  /**
   * Motivo del descuadre (V3). Se muestra SOLO cuando el dinero no cuadra, y sin
   * él el backend rechaza el cierre con 409.
   */
  differenceReason = '';

  // ===== Contador en vivo (punto 5.5) =====
  /**
   * Efectivo acumulado: fondo inicial + ventas en efectivo, cuando se conoce.
   *
   * Es el número que el cajero quiere ver mientras vende: cuánto hay que
   * should've del cajón ahora mismo. Se devuelve en 0 mientras no haya resumen,
   * para que la plantilla no muestre "null" ni tenga que comprobarlo en cada uso.
   */
  get efectivoAcumulado(): number {
    if (!this.cashSummary) return 0;
    return (this.cashSummary.openingAmount || 0) + (this.cashSummary.cashSales || 0);
  }

  /**
   * Diferencia en vivo: cuánto hay de más o de menos según lo que se ha escrito
   * en el campo de conteo.
   */
  get differencePreview(): number {
    if (!this.cashSummary) {
      return 0;
    }

    const contado = Number(this.closingAmount) || 0;
    const esperado = Number(this.cashSummary.expectedAmount) || 0;

    return +(contado - esperado).toFixed(2);
  }

  /** ¿El dinero que se ha escrito coincide con el esperado? */
  get cashCuadra(): boolean {
    return Math.abs(this.differencePreview) < 0.005;
  }

  constructor(
    private cashService: CashService,
    private authService: AuthService,
  ) {}

  initialize() {
    this.loadCashRegister();
    this.showUser();
    this.date();
  }

  //Obtener el usuario
  showUser() {
    this.userName = this.authService.getUsername();
  }

  // ======================================================================
  //  CREAR caja (V3)
  // ======================================================================

  /**
   * Abre el modal de crear caja con el número ya sugerido.
   *
   * Se pide la sugerencia al backend para que el usuario no tenga que contar
   * cuántas cajas hay. Si el request falla, se cae a "CAJA 1" y el usuario
   * escribe lo que quiera: el modal nunca se queda vacío.
   */
  openCreateCashModal() {
    this.newCashNumber = '';

    this.cashService.getNextNumber().subscribe({
      next: (r) => (this.newCashNumber = r.suggestedNumber),
      error: () => (this.newCashNumber = 'CAJA 1'),
    });

    this.showCreateCashModal = true;
  }

  /** Cierra el modal de crear caja sin hacer nada. */
  closeCreateCashModal() {
    this.showCreateCashModal = false;
    this.newCashNumber = '';
  }

  /**
   * Crea la caja con el número escrito.
   *
   * Si el backend responde 409 (número repetido) el modal NO se cierra y se
   * muestra el mensaje, para que el usuario corrija el número sin perder lo que
   * llevaba escrito.
   */
  confirmCreateCash() {
    const numero = (this.newCashNumber || '').trim().toUpperCase();

    if (!numero) {
      alert('El número de caja es obligatorio.');
      return;
    }

    this.cashService.createCash({ number: numero }).subscribe({
      next: () => {
        this.closeCreateCashModal();
        this.cargarDisponibles();
        alert(`Caja ${numero} creada. Ya puedes abrirla.`);
      },
      error: (err) => alert(err.error?.message || 'No se pudo crear la caja'),
    });
  }

  // ======================================================================
  //  ABRIR caja (V3: se elige una ya registrada)
  // ======================================================================

  openCashModal() {
    this.openingAmount = this.MIN_OPENING;
    this.selectedCashNumber = '';
    this.cargarDisponibles();
    this.showOpenCashModal = true;
  }

  /** Carga las cajas que todavía no se abrieron, para el selector. */
  cargarDisponibles() {
    this.cashService.getAvailable().subscribe({
      next: (cajas) => {
        this.availableCash = cajas;
        //Si solo hay una, se preselecciona: es el caso común y ahorra un clic.
        if (cajas.length === 1) {
          this.selectedCashNumber = cajas[0].number;
        }
      },
      error: () => (this.availableCash = []),
    });
  }

  confirmOpenCashModal() {
    // ===== Validaciones antes de llamar al backend =====
    //Se repiten aquí aunque el backend también valida, para no hacer un request
    //que ya se sabe que va a devolver 400.
    const monto = Number(this.openingAmount);

    const errorPrecio = validarPrecio(String(this.openingAmount), 'monto inicial');
    if (monto < 0) {
      alert('El monto inicial no puede ser negativo.');
      return;
    }
    if (monto < this.MIN_OPENING) {
      alert(`El monto inicial debe ser al menos $${this.MIN_OPENING}. Una caja no puede abrir con menos.`);
      return;
    }
    if (!monto) {
      alert('El monto inicial no puede ser 0.');
      return;
    }
    if (!errorPrecio.ok) {
      alert(errorPrecio.error);
      return;
    }
    if (!this.selectedCashNumber) {
      alert('Elige qué caja vas a abrir. Si no hay ninguna, crea una primero.');
      return;
    }

    this.showOpenCashModal = false;

    this.cashService.openCash(monto, this.selectedCashNumber).subscribe({
      next: (res) => {
        this.cashStatus = res;
        this.openingAmount = this.MIN_OPENING;
        this.loadCashSummary();
        alert(`Caja ${res.number} abierta.`);
      },
      error: (err) => {
        this.showOpenCashModal = true;
        alert(err.error?.message || 'No se pudo abrir la caja');
      },
    });
  }

  // ======================================================================
  //  CERRAR caja (V3: exige cuadrar el dinero)
  // ======================================================================

  closeCashModal() {
    this.cashService.getSummary().subscribe({
      next: (res) => {
        this.cashSummary = res;
        this.closingAmount = 0;
        this.differenceReason = '';
        this.showCloseCashModal = true;
      },
      error: (err) => alert(err.error?.message || 'Error al cargar el resumen'),
    });
  }

  /**
   * Cierra la caja.
   *
   * El cuadre. Si el efectivo contado no coincide con el esperado, el
   * backend responde 409 y no cierra. Acá se detecta antes: si no cuadra y no se
   * escribió un motivo, se explica y no se manda nada. Si se escribió un motivo,
   * se manda y el cierre procede (salida de emergencia).
   */
  confirmCloseCashModal() {
    const contado = Number(this.closingAmount);

    if (contado < 0) {
      alert('El efectivo contado no puede ser negativo.');
      this.showCloseCashModal = true;
      return;
    }
    if (!contado && contado !== 0) {
      alert('Escribe cuánto efectivo hay en la caja.');
      this.showCloseCashModal = true;
      return;
    }

    if (!this.cashCuadra && !this.differenceReason.trim()) {
      alert(
        `El dinero no cuadra.\n\n` +
          `Esperado: $${this.cashSummary?.expectedAmount ?? 0}\n` +
          `Contado:  $${contado}\n` +
          `Diferencia: ${this.differencePreview > 0 ? '+' : ''}${this.differencePreview}\n\n` +
          `Revisa el conteo. Si estás seguro de que el monto es correcto, ` +
          `escribe el motivo y vuelve a intentar: el corte se cerrará con ` +
          `descuadre registrado.`,
      );
      this.showCloseCashModal = true;
      return;
    }

    this.showCloseCashModal = false;

    this.cashService.closeCash(contado, this.differenceReason.trim() || null).subscribe({
      next: (res) => {
        this.cashStatus = undefined;
        this.cashSummary = undefined;
        this.closingAmount = 0;
        this.differenceReason = '';

        if (res.differenceReason) {
          alert(
            `Caja cerrada con diferencia de $${res.difference}.\n` +
              `Motivo registrado: ${res.differenceReason}`,
          );
        } else {
          alert('Caja cerrada. El dinero cuadró exactamente.');
        }
      },
      error: (err) => {
        this.showCloseCashModal = true;
        alert(err.error?.message || 'No se pudo cerrar la caja');
      },
    });
  }

  // ======================================================================
  //  Consultas
  // ======================================================================

  //Método para checar caja activa
  loadCashRegister() {
    this.cashService.getActiveCash().subscribe({
      next: (res) => {
        this.cashStatus = res;
        this.loadCashSummary();
      },
      error: (err) => {
        if (err.status === 404) {
          this.cashStatus = undefined;
        }
      },
    });
  }

  /** Carga el resumen para alimentar el contador en vivo. */
  loadCashSummary() {
    this.cashService.getSummary().subscribe({
      next: (res) => (this.cashSummary = res),
      error: () => undefined, //sin caja activa: el contador queda en 0
    });
  }

  userName = '';

  //Variables para fecha
  today: string = '';

  //Método de fecha
  date() {
    this.today = new Date().toLocaleDateString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  //Estatus de la caja
  get isOpen(): boolean {
    return !!this.cashStatus;
  }

  /** Número de la caja activa, para mostrarlo junto al estado. */
  get activeNumber(): string {
    return this.cashStatus?.number ?? '';
  }
}
