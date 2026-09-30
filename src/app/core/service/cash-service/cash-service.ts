import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../../environments/environment'; 
import { CashRegister, CashSummary } from '../../interfaces/cash-interface/cash-interface';

@Injectable({
  providedIn: 'root',
})
export class CashService {
  private apiUrl = `${environment.apiLocal}/cash`;
  //private apiUrl = 'http://localhost:8081/api/local/cash';

  constructor(private http: HttpClient){}

  getActiveCash(){
    return this.http.get<CashRegister>(`${this.apiUrl}/active`);
  }

  openCash(openingAmount: number, number: string) {
    return this.http.post<CashRegister>(`${this.apiUrl}/open`, { openingAmount, number });
  }

  closeCash(closingAmount: number) {
    return this.http.post<CashRegister>(`${this.apiUrl}/close`, { closingAmount });
  }

  getSummary() {
    return this.http.get<CashSummary>(`${this.apiUrl}/summary`)
  }

  getHistory() {
    return this.http.get<CashRegister[]>(`${this.apiUrl}/history`);
  }

  getByNumber(number: string) {
    return this.http.get<CashRegister>(`${this.apiUrl}/number/${encodeURIComponent(number)}`);
  }
}
