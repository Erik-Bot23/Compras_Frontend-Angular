import { Injectable } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CardPaymentResponse } from '../../interfaces/payment/payment';

@Injectable({
  providedIn: 'root',
})
export class PaymentService {
  private apiUrl = `${environment.apiLocal}/payments`;

  constructor(private http: HttpClient){}

  //Consultar estado de transacción
  getPaymentStatus(transactionId: string): Observable<CardPaymentResponse> {
    return this.http.get<CardPaymentResponse>(`${this.apiUrl}/status/${transactionId}`);
  }

  //Reintentar pago
  retryPayment(paymentId: number): Observable<CardPaymentResponse> {
    return this.http.post<CardPaymentResponse>(`${this.apiUrl}/retry/${paymentId}`, {});
  }

  //Reversar pago
  reversePayment(paymentId: number): Observable<boolean>{
    return this.http.post<boolean>(`${this.apiUrl}/reverse/${paymentId}`, {});
  }
}
