import { Injectable } from '@angular/core';

export interface CashRegister {
  id: number;
  number?: string;
  openedAt: string;
  closedAt: string;
  openingAmount: number;
  closingAmount: number;
  active: boolean;
}

export interface CashSummary{
  cashId: number;
  openingAmount: number;
  expectedAmount: number;
  difference: number;
  cashSales: number;
  debitSales: number;
  creditSales: number;
  totalSales: number;
  totalTickets: number;
}

export interface OpenCashRequest{
  openingAmount: number;
  number: string;
}

export interface ClosingCashRequest{
  closingAmount: number;
}
