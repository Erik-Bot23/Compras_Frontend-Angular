import { Injectable } from '@angular/core';
import {
  CashBox,
  CashRegister,
  CashSummary,
} from '../../../core/interfaces/cash-interface/cash-interface';
import { CashBoxForm, CreateCashBoxRequest } from '../../../core/interfaces/cash-interface/cash-interface';
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
    * Caja elegida para abrir. Se llena con `GET /cash/boxes/openable`, que
    * devuelve las cajas activas que NO tienen un turno abierto ahora mismo.
    *
    * <p>Ya no son "las que nunca se abrieron": como una caja se puede abrir
    * todos los días, el criterio es "¿está libre ahora?".
    */
   selectedCashNumber = '';

   /**
    * Cajas que se pueden abrir ahora, para el selector de "Abrir caja".
    *
    * <p>Es un {@link CashBox} (una caja física) y no un {@link CashRegister}
    * (un corte): lo que se elige al abrir es la caja, y el corte lo crea el
    * backend al abrir.
    */
   openableBoxes: CashBox[] = [];

   // ===== Modal de CERRAR caja =====
   showCloseCashModal = false;
   closingAmount = 0;

   /**
    * Motivo del descuadre (V3). Se muestra SOLO cuando el dinero no cuadra, y sin
    * él el backend rechaza el cierre con 409.
    */
   differenceReason = '';

   // =========================================================================
   //  CAJAS FÍSICAS (V4)
   // =========================================================================

   /**
    * Todas las cajas del local, incluidas las dadas de baja.
    *
    * <p>Alimenta la tabla "Ver cajas". Las dadas de baja se incluyen a propósito:
    * se muestran atenuadas y con su número de turnos, que es la información que
    * justifica por qué no se pueden borrar.
    */
   boxes: CashBox[] = [];

   /** Modal "Ver cajas". */
   showBoxesModal = false;

   /** Caja de la tabla que se está editando; null = creando una nueva. */
   editingBoxId: number | null = null;

   /** Borrador del formulario de alta/edición, que vive dentro de la tabla. */
   boxForm: CashBoxForm = { number: '', description: '' };

   /** Muestra u oculta el mini-formulario de la tabla. */
   showBoxForm = false;

  // ===== Contador en vivo (punto 5.5) =====
  /**
   * Efectivo acumulado: fondo inicial + ventas en efectivo, cuando se conoce.
   *
   * Es el número que el cajero quiere ver mientras vende: cuánto hay 
   * en el cajón ahora mismo. Se devuelve en 0 mientras no haya resumen,
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
   //  ABRIR caja (V4: se elige una caja FÍSICA libre)
   // ======================================================================

   openCashModal() {
     this.openingAmount = this.MIN_OPENING;
     this.selectedCashNumber = '';
     this.loadOpenableBoxes();
     this.showOpenCashModal = true;
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
       alert('Elige qué caja vas a abrir. Si no hay ninguna libre, crea una desde "Ver cajas".');
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

  // =========================================================================
   //  CAJAS FÍSICAS (V4)
   // =========================================================================

   /**
    * Abre la tabla "Ver cajas" y la carga.
    *
    * <p>El alta y la edición NO viven en un modal aparte: el formulario se abre
    * dentro de la tabla, para que se vea la caja que se está editando.
    */
   openBoxesModal() {
     this.loadBoxes();
     this.showBoxesModal = true;
   }

   closeBoxesModal() {
     this.showBoxesModal = false;
     this.showBoxForm = false;
     this.editingBoxId = null;
   }

   loadBoxes() {
     this.cashService.getBoxes().subscribe({
       next: (data) => (this.boxes = data),
       error: () => (this.boxes = []),
     });
   }

   /**
    * Empieza a CREAR una caja nueva. El número viene sugerido por el backend
    * ("CAJA 7") para que el usuario no tenga que contar cuántas hay.
    *
    * <p>Se pide la sugerencia al abrir el formulario y no al abrir la tabla: si
    * el request falla se cae a "CAJA 1" y el usuario escribe lo que quiera. El
    * formulario nunca se queda vacío.
    */
   startNewBox() {
     this.editingBoxId = null;
     this.boxForm = { number: '', description: '' };
     this.showBoxForm = true;

     this.cashService.getNextNumber().subscribe({
       next: (r) => (this.boxForm.number = r.suggestedNumber),
       error: () => (this.boxForm.number = 'CAJA 1'),
     });
   }

   /** Empieza a EDITAR una caja de la tabla. */
   startEditBox(caja: CashBox) {
     this.editingBoxId = caja.id;
     this.boxForm = { number: caja.number, description: caja.description ?? '' };
     this.showBoxForm = true;
   }

   /** Cierra el mini-formulario sin guardar. */
   cancelBoxForm() {
     this.showBoxForm = false;
     this.editingBoxId = null;
   }

   /**
    * Guarda la caja: crea si {@link editingBoxId} es null, actualiza si no.
    *
    * <p>Si el backend responde 409 (número repetido) el formulario NO se cierra
    * y se muestra el mensaje, para que el usuario corrija sin perder lo escrito.
    */
   saveBox() {
     const numero = (this.boxForm.number || '').trim().toUpperCase();

     if (!numero) {
       alert('El número de caja es obligatorio.');
       return;
     }

     const request: CreateCashBoxRequest = {
       number: numero,
       description: (this.boxForm.description || '').trim() || null,
     };

     const peticion =
       this.editingBoxId === null
         ? this.cashService.createBox(request)
         : this.cashService.updateBox(this.editingBoxId, request);

     peticion.subscribe({
       next: () => {
         this.cancelBoxForm();
         this.loadBoxes();
         this.loadOpenableBoxes();
       },
       error: (err) => alert(err.error?.message || 'No se pudo guardar la caja'),
     });
   }

   /**
    * Da de baja una caja: deja de ofrecerse al abrir, pero sus ventas y sus
    * cortes siguen en el historial.
    *
    * <p>Es la operación de siempre, y es reversible. Para borrar hace falta que
    * la caja nunca se haya abierto, y eso lo decide el backend (409).
    */
   deactivateBox(caja: CashBox) {
     if (!confirm(`¿Dar de baja la caja "${caja.number}"? Dejará de ofrecerse al abrir, pero sus ventas siguen en el historial.`)) {
       return;
     }

     this.cashService.deactivateBox(caja.id).subscribe({
       next: () => {
         this.loadBoxes();
         this.loadOpenableBoxes();
       },
       error: (err) => alert(err.error?.message || 'No se pudo dar de baja la caja'),
     });
   }

   /**
    * Borra una caja, pero SOLO si nunca se abrió.
    *
    * <p>Si ya tuvo cortes, el backend responde 409 y el mensaje dice "dala de
    * baja". Por eso el template solo muestra el botón de borrar cuando
    * {@code sessionsCount === 0}: en cualquier otro caso el botón no podría
    * funcionar y sería una promesa que el sistema no puede cumplir.
    */
   deleteBox(caja: CashBox) {
     if (!confirm(`¿Eliminar la caja "${caja.number}"? Solo es posible si nunca se abrió.`)) {
       return;
     }

     this.cashService.deleteBox(caja.id).subscribe({
       next: () => {
         this.loadBoxes();
         this.loadOpenableBoxes();
       },
       error: (err) => alert(err.error?.message || 'No se pudo eliminar la caja'),
     });
   }

   /**
   * Da de ALTA una caja que estaba dada de baja (V5).
   *
   * <p>No borra nada ni crea una caja nueva: es la MISMA caja, con su mismo
   * número y su mismo historial, la que vuelve a ofrecerse al abrir. Por eso el
   * número no puede reutilizarse para otra caja (está ocupado por esta fila).
   *
   * <p>Es lo que hace que "dar de baja" sea reversible: si se dio de baja por
   * error, o porque una caja se estaba reparando y ya terminó, hay salida.
   */
  activateBox(caja: CashBox) {
    if (!confirm(`¿Dar de alta la caja "${caja.number}"? Volverá a ofrecerse al abrir y conserva todo su historial.`)) {
      return;
    }

    this.cashService.activateBox(caja.id).subscribe({
      next: () => {
        this.loadBoxes();
        this.loadOpenableBoxes();
      },
      error: (err) => alert(err.error?.message || 'No se pudo dar de alta la caja'),
    });
  }

  /**
    * Carga las cajas que se pueden abrir ahora (activas y sin turno abierto).
    *
    * <p>Si solo hay una, se preselecciona: es el caso de un local con dos cajas
    * donde casi siempre se usa la misma, y ahorra un clic.
    */
   loadOpenableBoxes() {
     this.cashService.getOpenableBoxes().subscribe({
       next: (data) => {
         this.openableBoxes = data;

         // Si la caja seleccionada ya no está libre (alguien la abrió), se
         // limpia: mandar un número que el backend va a rechazar solo produce
         // un 409 confuso.
         if (!data.some((c) => c.number === this.selectedCashNumber)) {
           this.selectedCashNumber = data.length === 1 ? data[0].number : '';
         }
       },
       error: () => (this.openableBoxes = []),
     });
   }
}
