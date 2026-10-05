import { PaymentMethod } from '../../enums/paymentMethod';
import { CardPaymentRequest, CardPaymentResponse } from '../payment/payment';

//Interface con atributos que se usarán en la interface SaleRequest
export interface SaleItemRequest {
  productId: number;
  quantity: number;
}

//Interface para ventas que se usará en sale-service
export interface SaleRequest {
  paymentMethod: PaymentMethod;
  cashReceived?: number;
  items: SaleItemRequest[]; //Un arreglo con los atributos de la interface SaleItemRequest

  /**
   * Clave de idempotencia del cobro (V6).
   *
   * <p>La genera el frontend UNA vez por cada cobro y se repite en todas las
   * peticiones de ese cobro. Si el backend ya tiene una venta con esta clave,
   * devuelve esa en vez de crear otra: es lo que evita que un doble "Enter" en
   * el modal de cobro descuente el stock dos veces y genere dos tickets.
   *
   * <p>Opcional para no romper a un cliente que no la mande.
   */
  idempotencyKey?: string;
  cardPayment?: CardPaymentRequest; //Para pagos con tarjetas
}

//Interface para ventas que se usará en sale-service
export interface SaleResponse {
  saleId: number;
  total: number;
  paymentMethod: PaymentMethod;
  changeAmount: number | null;
  cashReceived: number | null;
  paymentStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
  cardPaymentResponse?: CardPaymentResponse; 
}

//Interface para el historial de la venta
export interface SaleHistory {
  id: number;
  saleDate: string;
  total: number;
  paymentMethod: PaymentMethod;
  cashReceived: number | null;
  changeAmount: number | null;

  // ===== Ciclo de vida de la venta (2026-09-30) =====
  // El backend expone las DOS banderas y no un 'estado' derivado. Se replica
  // el contrato tal cual, a propósito: si aquí se derivara un string 'ABIERTA'
  // / 'CONFIRMADA' / 'ANULADA', estaríamos reimplementando la máquina de
  // estados del servidor en el cliente, y en cuanto el backend agregara un
  // estado nuevo el frontend mostraría algo equivocado sin avisar.
  //
  // Los 3 estados válidos y qué botón habilita cada uno:
  //   confirmed=false, cancelled=false -> abierta: se puede confirmar o anular
  //   confirmed=true                    -> congelada: ningún botón
  //   cancelled=true                    -> anulada: el stock ya volvió
  confirmed: boolean;
  confirmedAt: string | null;
  cancelled: boolean;
  cancelledAt: string | null;
}
