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

  //No se selecciona un producto si no hay
  selectProduct(product: ProductShow){
    if(product.stock <= 0){
      alert('Producto sin existencia');
      return;
    }
    this.cobro.add(product);
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
  }

  //Remover un solo producto de la lista
  removeItem(id?: number){
    if(!id) return;
    this.cobro.removeAll(id);
  }

  //Botones de incrementar o decrementar el producto
  increase(product: ProductShow){
    this.cobro.add(product);
  }

  decrease(id?: number){
    if(!id) return;
    this.cobro.removeOne(id);
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

      items: items.map(item => ({
        productId: item.product.id!,
        quantity: item.quantity
      }))
    };

    this.saleService.processSale(request).subscribe({
      next: (response) => {
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
        this.loadProducts();
        this.closeModalCobro();
      },
      error: (err) => {
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
        this.barcode = '';
      }, error: () => {
        alert('Producto no encontrado');
        this.barcode = '';
      }
    });
  }
}
