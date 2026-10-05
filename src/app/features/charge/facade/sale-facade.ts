import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ProductShow } from '../../../core/interfaces/product/product';
import { CobroItem } from '../../../core/interfaces/cobro/cobro';
import { CobroService } from '../../../core/service/cobro-service/cobro-service';
import { SaleService } from '../../../core/service/sale-service/sale-service';
import { TicketService } from '../../../core/service/ticket-service/ticket-service';
import { SaleRequest } from '../../../core/interfaces/sale/sale';
import { CashFacade } from './cash-facade';
import { PaymentMethod } from '../../../core/enums/paymentMethod';
import { CardPaymentResponse } from '../../../core/interfaces/payment/payment';
import { PaymentService } from '../../../core/service/payment-service/payment-service';

@Injectable({
  providedIn: 'root'
})

export class SaleFacade {
  //Inicializar las variables
  products: ProductShow[] =[];
  filteredProducts: ProductShow[] = [];
  categories: string[] = [];
  selectedCategory: string | null = null;
  search = '';
  searchResults: ProductShow[] = [];
  barcode = '';

  cobroItems$!: Observable<CobroItem[]>;
  total$!: Observable<number>;

  //Desplegar menú
  menuOpen = false;

  //Desplegar modal de cobro
  showPaymentModal = false;
  selectedPaymentMethod: PaymentMethod = PaymentMethod.CASH;
  cashReceived = 0;

  // ===========================================================================
  //  IDEMPOTENCIA DEL COBRO (V6)
  // ===========================================================================

  /**
   * Clave del intento de cobro en curso.
   *
   * <p>Es un UUID que se genera UNA vez por cada cobro y se manda en todas las
   * peticiones de ese cobro. Si el usuario aprieta Enter dos veces, las dos
   * peticiones viajan con la misma clave, y el backend reconoce la segunda como
   * "esta venta ya existe" y devuelve la primera en vez de cobrar otra vez.
   *
   * <p><b>Por qué se genera aquí y no en el servidor.</b> La clave identifica la
   * INTENCIÓN de cobrar, no la llamada. Si la generara el backend en cada
   * petición, cada una sería distinta y la protección no serviría de nada.
   *
   * <p>Se genera en {@link openPaymentModal} y no en {@link confirmPayment}:
   * si se generara al confirmar, cada Enter tendría su propia clave y cada una
   * sería una venta nueva. Esa es exactamente la razón del bug.
   */
  private claveCobro = '';

  /**
   * true mientras hay una venta en vuelo.
   *
   * <p>Es la primera de las dos barreras, y la más barata: evita que el segundo
   * Enter ni siquiera salga a la red. Pero <b>no alcanza por sí sola</b>, porque
   * dos peticiones pueden estar viajando al mismo tiempo. Por eso está
   * acompanada por la clave de idempotencia, que esa sí resuelve en el servidor.
   */
  isProcessing = false;

  /**
   * Empieza un intento de cobro: genera la clave y abre el modal.
   *
   * <p>Se delega en {@link abrirModalDeCobro}, que es el que valida la caja y
   * arma el carrito. Aquí solo se genera la clave de idempotencia.
   *
   * <p>Cada apertura del modal es un cobro nuevo y por tanto una clave nueva. Es
   * lo correcto: si el usuario cierra el modal, arma otra venta y vuelve a
   * cobrar, esa segunda venta SÍ debe registrarse.
   */
  private iniciarIntentoDeCobro() {
    this.claveCobro = this.generarClaveCobro();
    this.isProcessing = false;
  }

  /**
   * UUID de un intento de cobro.
   *
   * <p>Usa `crypto.randomUUID()` cuando está disponible (todos los navegadores
   * modernos y el SSR con Node 19+). El `fallback` con `Math.random()` existe
   * para entornos sin la API: <b>no es criptográficamente seguro</b>, y se dice
   * explícitamente porque se usa para evitar un cobro doble, no para proteger un
   * secreto. Si algún día se usara para algo sensible, esta nota sería la
   * advertencia de que hay que cambiarlo.
   */
  private generarClaveCobro(): string {
    const cripto = globalThis.crypto;

    if (cripto && typeof cripto.randomUUID === 'function') {
      return cripto.randomUUID();
    }

    return 'cobro-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
  }

  //Modal de tarjeta
  showCardModal = false;
  cardNumber = '';
  cardPin = '';
  cardProcessing = false;
  cardPaymentResult?: CardPaymentResponse;
  cardError?: string;

  //Modal de espera
  showWaitingModal = false;
  waitingTransactionId = '';
  waitingAttempts = 0;
  waitingInterval? : any;

  //Pago rechazado del que se puede reintentar (null = no hay pendiente)
  pendingPaymentId: number | null = null;

  //Lista de métodos
  //Permite generar botones automaticamente
  paymentMethods = [
    {
      value: PaymentMethod.CASH,
      label: 'Efectivo'
    },
    {
      value: PaymentMethod.DEBIT,
      label: 'Tarjeta de débito'
    },
    {
      value: PaymentMethod.CREDIT,
      label: 'Tarjeta de crédito'
    }
  ]

  constructor(
    public cobro: CobroService,
    private saleService: SaleService,
    private ticketService: TicketService,
    private cashFacade: CashFacade,
    private paymentService: PaymentService
  ) {}

  initialize(){
    this.loadProducts();
    this.cobroItems$ = this.cobro.cart$;
    this.total$ = this.cobro.getTotalLocal();
  }

  //Se cargan los productos localmente en la tabla de ventas
  loadProducts(){
    this.saleService.getProductsVentas().subscribe(products => {
      this.products = products;
      this.filteredProducts = products;

      //Obtener categorías únicas
      //this:
      //...new:
      //Set:
      //filter: 
      this.categories = [...new Set(products.map(p => p.categoryName).filter(Boolean))];
    });
  }

  //Abrir y cerrar el menú
  toggleMenu(){
    this.menuOpen = !this.menuOpen;
  }

  //Buscar productos
  onSearch(){
    if(this.search.length < 2){
      this.searchResults = [];
      return;
    }

    this.saleService.searchProducts(this.search).subscribe({
      next: res => {
      console.log("Resultados", res);
      this.searchResults = res;
    }, error: err => {
      console.error(err);
      }
    });
  }

  // ===========================================================================
  //  PAGINACIÓN DEL CARRITO DEL POS
  // ===========================================================================

  /**
   * Página visible del carrito.
   *
   * <p>Sin esto, una venta con 30 productos empujaba el botón <b>Cobrar</b>
   * fuera de la pantalla: la tabla crecía sin límite y el cajero tenía que
   * scrollear para llegar al botón de pago.
   *
   * <p><b>Cambia una decisión anterior.</b> El 2026-09-12 se dejó escrito que
   * "el carrito del POS no se pagina: es un carrito vivo, no una tabla de
   * registros". La razón era válida para la <i>información</i> del carrito, pero
   * no para su <i>altura</i>: el problema no era que el carrito fuera vivo, era
   * que no tenía tope. Paginándolo se mantiene vivo (el renglón sigue siendo el
   * mismo, con sus botones de +/−/✕) y además deja de empujar el botón.
   */
  cartPage = 0;

  /**
   * Renglones por página.
   *
   * <p>Son 8 y no 5 como en el carrito de compras porque aquí cada renglón es
   * <b>una sola línea</b>: all�� el renglón de compra hay seis columnas y cuatro
   * inputs. Con 8, el carrito ocupa unos 400px y el botón Cobrar sigue a la
   * vista.
   */
  cartPageSize = 8;

  /** Número de productos en el carrito (no los de la página visible). */
  get cartTotalItems(): number {
    return this.cobro.cart$.value.length;
  }

  /** Páginas totales del carrito (mínimo 1, para que los índices no den 0). */
  get cartTotalPages(): number {
    return Math.max(1, Math.ceil(this.cartTotalItems / this.cartPageSize));
  }

  /**
   * Página actual ya recortada al rango válido.
   *
   * <p>`cartPage` puede quedar fuera de rango si algún camino futuro quita
   * productos sin llamar a {@link ajustarPaginaAlQuitar}. El `paginate` se
   * recorta solo (por eso nunca se ve una tabla vacía), pero los números del pie
   * se calculan aparte y podrían salir al revés ("Mostrando 9–3 de 3").
   *
   * <p>Por eso el pie usa SIEMPRE esta versión recortada en vez de `cartPage`
   * directo: si hay un desajuste, que el texto siga siendo correcto.
   */
  private get cartPaginaValida(): number {
    return Math.min(Math.max(this.cartPage, 0), this.cartTotalPages - 1);
  }

  /** Primer renglón visible, en 1-based porque es lo que se lee ("Mostrando 1–8"). */
  get cartDesde(): number {
    if (this.cartTotalItems === 0) {
      return 0;
    }

    return this.cartPaginaValida * this.cartPageSize + 1;
  }

  /** Último renglón visible. Se acota al total para no prometer de más. */
  get cartHasta(): number {
    return Math.min(this.cartDesde + this.cartPageSize - 1, this.cartTotalItems);
  }

  /**
   * Lleva la vista a la página donde está un producto.
   *
   * <p>Se llama al <b>agregar</b>, no solo al paginar. Es lo que evita el bug
   * másFastidioso de la paginación: escanear el código de barras del producto 12
   * con la vista en la página 1 lo agrega invisible, y el cajero ve el carrito
   * "sin cambios" aunque el producto se haya agregado. Con esto, el renglón
   * recién agregado siempre aparece.
   *
   * <p>Se calcula por <b>índice real</b> del producto, y no "saltar a la última
   * página", porque agregar un producto que ya estaba en el carrito no crea
   * renglón nuevo: solo sube su cantidad, y el renglón puede estar en cualquier
   * página.
   */
  private irAPaginaDelProducto(productId?: number) {
    if (productId === undefined) {
      return;
    }

    const indice = this.cobro.cart$.value.findIndex(i => i.product.id === productId);

    if (indice < 0) {
      return;
    }

    this.cartPage = Math.floor(indice / this.cartPageSize);
  }

  /**
   * Recorta la página si al quitar un renglón la actual quedó vacía.
   *
   * <p>Sin esto, borrar el último producto de la página 2 dejaría la vista en
   * la página 2 aunque ya no exista, y el carrito aparecería vacío: la misma
   * sensación de "no pasó nada" que daba el bug de agregar.
   */
  private ajustarPaginaAlQuitar() {
    const maximo = this.cartTotalPages - 1;

    if (this.cartPage > maximo) {
      this.cartPage = Math.max(0, maximo);
    }
  }

//No se selecciona un producto si no hay
  selectProduct(product: ProductShow){
    if(product.stock <= 0){
      alert('Producto sin existencia');
      return;
    }
    this.cobro.add(product);
    this.irAPaginaDelProducto(product.id);
    this.search = '';
    this.searchResults = [];
  }

  //Agregar producto al carrito
  add(product: ProductShow){
    if(product.stock <= 0){
      alert('Producto sin existencia')
      return;
    }
    this.cobro.add(product);
    this.irAPaginaDelProducto(product.id);
  }

  //Remover un solo producto de la lista
  removeItem(id?: number){
    if(!id) return;
    this.cobro.removeAll(id);
    this.ajustarPaginaAlQuitar();
  }

  //Botones de incrementar o decrementar el producto
  increase(product: ProductShow){
    this.cobro.add(product);
    this.irAPaginaDelProducto(product.id);
  }

  decrease(id?: number){
    if(!id) return;
    this.cobro.removeOne(id);

    // Solo importa cuando la cantidad llega a 0 y el renglón desaparece; si solo
    // bajó de 3 a 2 la página sigue siendo válida. Por eso se ajusta SIEMPRE
    // (es un no-op si la página sigue existiendo) en vez de preguntar por la
    // cantidad antes de bajar.
    this.ajustarPaginaAlQuitar();
  }

  //Método de abrir modal de cobro
  openPaymentModal(){
    if(!this.cashFacade.isOpen){
      alert("No hay caja abierta");
      return;
    }

    const items = this.cobro.cart$.value;

    if(!items.length){
      alert("No hay productos en el carrito");
      return;
    }

    // 🔑 La clave de idempotencia se genera AQUÍ, al abrir el modal, y no al
    // confirmar el pago (V6). Es el punto clave del arreglo: si se generara en
    // `confirmPayment`, cada Enter tendría su propia clave y cada una sería una
    // venta nueva, que es exactamente el bug que se estaba reportando.
    this.iniciarIntentoDeCobro();

    this.selectedPaymentMethod = PaymentMethod.CASH;
    this.cashReceived = 0;
    this.showPaymentModal = true;
  }

  //Método para seleccionar el pago
  selectPaymentMethod(method: PaymentMethod){
    this.selectedPaymentMethod = method;

    if(method !== PaymentMethod.CASH){
      this.cashReceived = 0;
    }
  }

  //Formatear número de tarjeta
  formatCardNumber(event: any){
    let value = event.target.value.replace(/\D/g, '');
    //let value = event.target.value.replace(/[^0-9]/g, '');

    if(value.length > 16){
      value = value.slice(0, 16);
    }

    //Guardar el valor sin espacios en la variable
    this.cardNumber = value; //Almacena solo números

    //Formato: 4111 1111 1111 1111
    let formatted = '';
    for(let i = 0; i < value.length; i++){
      if(i > 0 && i % 4 === 0){
        formatted += ' ';
      }
      formatted += value[i];
    }
    this.cardNumber = formatted;
    event.target.value = formatted;
  }

  //Abrir modal de tarjeta
  openCardModal(){
    this.cardNumber = '';
    this.cardPin = '';
    this.cardError = undefined;
    this.showCardModal = true;
  }

  //Confirmar pago con tarjeta
  confirmCardPayment(){
    // ===== BARRERA 1 (V6): no hay cobro en vuelo =====
    // `cardProcessing` es el equivalente para tarjeta del `isProcessing` de
    // efectivo. Sin esta guarda, un doble Enter en este modal tambien cobra dos.
    if(this.cardProcessing){
      return;
    }

    const cleanCard = this.cardNumber.replace(/\s/g, '');

    //Validaciones
    if(cleanCard.length !== 16){
      this.cardError = 'El número de tarjeta debe tener 16 dígitos';
      return;
    }

    if(!this.cardPin || this.cardPin.length != 4){
      this.cardError = 'El PIN debe tener 4 dígitos';
      return;
    }

    this.cardError = undefined;
    this.showCardModal = false;
    this.cardProcessing = true;
    this.showWaitingModal = true;

    //Si se confirma un pago nuevo, ya no hay rechazo previo que reintentar
    this.pendingPaymentId = null;

    //Continuar con el pago
    this.processCardPayment();
  }

  //Procesar pago con tarjeta
  private processCardPayment(){
    const items = this.cobro.cart$.value;
    const cleanCard = this.cardNumber.replace(/\s/g, '');

    const request: SaleRequest = {
      paymentMethod: this.selectedPaymentMethod,
      // ===== BARRERA 2 (V6): la misma clave de idempotencia del cobro =====
      // Se genera al abrir el modal de PAGO (no al confirmar la tarjeta), y se
      // comparte con el flujo de efectivo: es la MISMA intención de cobro, así
      // que si el usuario cerrara el modal de tarjeta y pagara en efectivo,
      // sigue siendo el mismo cobro.
      idempotencyKey: this.claveCobro,
      items: items.map(item => ({
        productId: item.product.id!,
        quantity: item.quantity
      })),
      cardPayment: {
        paymentMethod: this.selectedPaymentMethod,
        pin:this.cardPin,
        cardNumber: cleanCard
      }
    };

    //Enviar al backend
    this.saleService.processSale(request).subscribe({
      next: (response) => {
        if(response.paymentStatus === 'PENDING' && response.cardPaymentResponse){
          //Iniciar polling para consultar estado
          this.pendingPaymentId = response.cardPaymentResponse.paymentId;
          this.waitingTransactionId = response.cardPaymentResponse.transactionId;
          this.startPolling(response.cardPaymentResponse);
        } else if(response.paymentStatus === 'APPROVED' && response.cardPaymentResponse){
          //Pago aprobado
          this.handleCardSuccess(response.cardPaymentResponse);
        } else {
          //Pago rechazado
          this.pendingPaymentId = null;
          this.handleCardError('Pago rechazado');
        }
      },
      error: (err) => {
        this.cardProcessing = false;
        this.showWaitingModal = false;

        //Verificar si es un error de pago rechazado
        if(err.status === 402 && err.error?.code === 'PAYMENT_REJECTED'){
          //Mostrar el mensaje específico del backend
          const errorMessage = err.error?.message || 'Pago rechazado';
          this.handleCardError(errorMessage);
        } else if (err.status === 402) {
          // Si es 402 pero no tiene el código específico
          const errorMessage = err.error?.message || 'Pago rechazado';
          this.handleCardError(errorMessage);
        } else {
          // Otros errores (400, 500, etc.)
          const errorMessage = err.error?.message || 'Error al procesar el pago';
          alert(errorMessage);
          this.closeModalCobro();
        }
      }
    });
  }

  //Polling para consultar estado
  private startPolling(initialResponse: CardPaymentResponse){
    this.waitingAttempts = 0;
    const maxAttempts = 12; //60 segundos (5 segundos * 12)

    //Mostrar mensaje inicial
    this.cardPaymentResult = initialResponse;

    this.waitingInterval = setInterval(() => {
      this.waitingAttempts++;

      this.paymentService.getPaymentStatus(this.waitingTransactionId).subscribe({
        next: (response) => {
          this.cardPaymentResult = response;

          if(response.status === 'APPROVED'){
            //Pago aprobado
            clearInterval(this.waitingInterval);
            this.pendingPaymentId = null;
            this.handleCardSuccess(response);
          } else if(response.status === 'REJECTED'){
            //Pago rechazado
            clearInterval(this.waitingInterval);
            this.pendingPaymentId = response.paymentId;
            const errorMsg = response.message || 'Pago rechazado por el banco';
            this.handleCardError(errorMsg);
          }
          //Si sigue PENDING, continuar esperando
        },
        error: (err) => {
          if(err.status === 402 && err.error?.code === 'PAYMENT_REJECTED'){
            clearInterval(this.waitingInterval);
            const errorMsg = err.error?.message || 'Pago rechazado';
            this.handleCardError(errorMsg);
          } else if(this.waitingAttempts >= maxAttempts){
            //Timeout
            clearInterval(this.waitingInterval);
            this.handleCardError('Tiempo de espera agotado. El pago está pendiente de confirmación.');
          }
        }
      });
    }, 5000); //Consultar cada 5 segundos
  }

  //Reintentar un pago rechazado (POST /api/payments/retry/{paymentId})
  retryCardPayment(){
    if(this.pendingPaymentId === null) return;

    this.cardError = undefined;
    this.showCardModal = false;
    this.cardProcessing = true;
    this.showWaitingModal = true;

    this.paymentService.retryPayment(this.pendingPaymentId).subscribe({
      next: (response) => {
        if(response.status === 'PENDING'){
          this.waitingTransactionId = response.transactionId;
          this.startPolling(response);
        } else if(response.status === 'APPROVED'){
          this.pendingPaymentId = null;
          this.handleCardSuccess(response);
        } else {
          //Sigue rechazado: mantener el ID para poder reintentar de nuevo
          this.pendingPaymentId = response.paymentId;
          this.handleCardError(response.message || 'Pago rechazado');
        }
      },
      error: (err) => {
        this.cardProcessing = false;
        this.showWaitingModal = false;
        alert(err.error?.message || 'No se pudo reintentar el pago');
        this.cardError = undefined;
        this.showCardModal = true;
      }
    });
  }

  //Manejar éxito de tarjeta
  private handleCardSuccess(response: CardPaymentResponse){
    const items = this.cobro.cart$.value;

    setTimeout(() => {
      this.cardProcessing = false;
      this.showWaitingModal = false;

      this.generateTicket({
        saleId: response.saleId,
        total: response.amount,
        paymentMethod: this.selectedPaymentMethod,
        cashReceived: null,
        changeAmount: null,
        cardData: response
      }, items);

      alert(`Pago aprobado\n\nTransacción: ${response.transactionId}\nCódigo: 
        ${response.authorizationCode}\nMonto: $${response.amount}`);

      this.cobro.clear();
      this.cartPage = 0;
      this.loadProducts();
      this.closeModalCobro();
      this.cardNumber = '';
      this.cardPin = '';
      this.cardPaymentResult = undefined;
      this.pendingPaymentId = null;
    }, 0);
  }

  //Manejar error de tarjeta
  private handleCardError(message: string){
    //Forzar la detección de cambios después de actualizar el estado
    setTimeout(() => {
      this.cardProcessing = false;
      this.showWaitingModal = false;
      alert(`${message}`);
      this.cardError = message;
      this.showCardModal = true;
    }, 0);
  }

  //Generar ticket (refactorizado)
  private generateTicket(response: any, savedItems?: CobroItem[]){
    const items = savedItems ?? this.cobro.cart$.value;

    this.ticketService.generateTicket(
      response.saleId,
      response.total,
      response.cashReceived ?? 0,
      response.changeAmount ?? 0,
      items,
      response.paymentMethod,
      response.cardData
    );
  }

  //Confirmar pago
  confirmPayment(){
    // ===== BARRERA 1: no hay venta en vuelo (V6) =====
    // El segundo Enter llega aquí mientras la primera petición sigue viajando.
    // Sin esta guarda se cobraría dos veces.
    if(this.isProcessing){
      return;
    }

    const items = this.cobro.cart$.value;

    if(!items.length){
      return;
    }

    //Si es tarjeta, abrir modal de tarjeta
    if(this.selectedPaymentMethod === PaymentMethod.DEBIT ||
        this.selectedPaymentMethod === PaymentMethod.CREDIT){
      this.openCardModal();
      return;
    }

    //Si es efectivo, continuar con el flujo actual
    const request: SaleRequest = {
      paymentMethod: this.selectedPaymentMethod,
      cashReceived: this.cashReceived,
      // ===== BARRERA 2: la clave de idempotencia viaja al backend (V6) =====
      // Es la que resuelve el caso en que las dos peticiones YA salieron: la
      // segunda llega con una clave que ya existe y el backend devuelve la venta
      // original en vez de crear otra.
      idempotencyKey: this.claveCobro,

      items: items.map(item => ({
        productId: item.product.id!,
        quantity: item.quantity
      }))
    };

    this.isProcessing = true;

    this.saleService.processSale(request).subscribe({
      next: (response) => {
        this.isProcessing = false;

        //Generar ticket con datos de efectivo
        this.generateTicket({
          saleId: response.saleId,
          total: response.total,
          paymentMethod: this.selectedPaymentMethod,
          cashReceived: response.cashReceived || 0,
          changeAmount: response.changeAmount || 0,
          cardData: undefined //No hay datos de tarjeta
        });

        alert(`Venta completada\n\nTotal: $${response.total}\nCambio: $${response.changeAmount}`);

        this.cobro.clear();
        // El carrito quedó vacío, así que la página 1 es la única que existe.
        // Sin esto, tras cobrar un carrito que estaba en la página 3, la venta
        // siguiente aparecería "en la página 3" de un carrito con 1 producto.
        this.cartPage = 0;
        this.closeModalCobro();
      },
      error: (err) => {
        // Se libera el flag también en el error: si no, el modal quedaría
        // bloqueado y el usuario no podría reintentar ni cerrar.
        this.isProcessing = false;
        alert(err.error?.message || 'Error al procesar la venta')
      }
    });
  }

  //Mostrar cambio a recibir antes de realizar la venta
  get changePreview(): number{
    if(this.selectedPaymentMethod !== PaymentMethod.CASH){
      return 0;
    }

    const total = this.cobro.cart$.value.reduce((sum, item) => sum + item.subtotal, 0);
    return this.cashReceived - total;
  }

  //Cerrar modal de tarjeta
  closeCardModal(){
    if(this.cardProcessing){
      if(!confirm('¿Estás seguro de cancelar el pago?')) return;
    }

    this.showCardModal = false;
    this.cardNumber = '';
    this.cardPin = '';
    this.cardError = undefined;
    this.cardProcessing = false;
  }

  //Cerrar modal de espera
  closeWaitingModal(){
    if(this.waitingInterval){
      clearInterval(this.waitingInterval);
      this.waitingInterval = undefined;
    }

    this.showWaitingModal = false;
    this.cardProcessing = false;
  }
  
  //Cerrar el modal de cobro
  closeModalCobro(){
    this.showPaymentModal = false;
    this.cashReceived = 0;
  }

  //Método para buscar por codigo de barras
  searchBarcode(){
    if(!this.barcode.trim()){
      return;
    }

    this.saleService.findByBarcode(this.barcode).subscribe({
      next: product => {
        this.cobro.add(product);
        // 🔑 El escáner es el caso MÁS IMPORTANTE de esta llamada. El cajero
        // va escaneando y el carrito crece solo: si el producto cae en una
        // página que no se está viendo, el renglón se agrega invisible y el
        // carrito "no cambia" a ojos del cajero. Con la página saltando al
        // renglón, escanear siempre se ve.
        this.irAPaginaDelProducto(product.id);
        this.barcode = '';
      }, error: () => {
        alert('Producto no encontrado');
        this.barcode = '';
      }
    });
  }
}
