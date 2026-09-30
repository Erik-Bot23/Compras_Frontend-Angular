import { PaymentMethod } from '../../enums/paymentMethod';

//Espejo de model/dto/Reports/*.java — nombres de campo idénticos a la respuesta JSON.

//Un punto de la tendencia de ventas (GET /api/reports/trend)
export interface PeriodSalesDTO {
  period: string; //"yyyy-MM-dd" (DIA) | "yyyy-MM" (MES) | "yyyy" (AÑO)
  total: number;
  count: number;
}

//Producto más vendido (GET /api/reports/top-products)
export interface TopProductDTO {
  productId: number;
  name: string;
  quantity: number;
  total: number;
}

//Distribución por método de pago (GET /api/reports/payment-methods)
export interface PaymentMethodDTO {
  method: PaymentMethod;
  label: string;
  count: number;
  total: number;
}

//Rendimiento por categoría (GET /api/reports/categories)
export interface CategoryPerformanceDTO {
  categoryId: number;
  name: string;
  quantity: number;
  total: number;
}

//Producto con stock bajo (GET /api/reports/low-stock)
export interface LowStockDTO {
  productId: number;
  name: string;
  sku: string;
  barcode: string;
  category: string;
  stock: number;
}

//Margen de un producto (GET /api/reports/margins): cost (último costo real de
//compras) vs price; marginPercent = ganancia sobre el precio de venta.
export interface MarginDTO {
  productId: number;
  name: string;
  sku: string;
  cost: number;
  price: number;
  margin: number;
  marginPercent: number;
}

//Resumen del rango (GET /api/reports/summary)
export interface ReportsSummaryDTO {
  totalSales: number;
  totalAmount: number;
  averageTicket: number;
  paymentMethods: PaymentMethodDTO[];
}

//Utilidad del periodo (V3, GET /api/reports/profit)
export interface ProfitDTO {
  revenue: number;
  costOfGoodsSold: number;
  grossProfit: number;
  marginPercent: number;
  tickets: number;
  itemsSold: number;
  itemsWithoutCost: number;
}

//Detalle de una caja concreta (V3, GET /api/reports/cash/{cashId})
export interface CashReportDTO {
  cashId: number;
  number: string;
  openedAt: string;
  closedAt: string | null;
  openingAmount: number;
  closingAmount: number | null;
  expectedAmount: number;
  difference: number;
  cashSales: number;
  debitSales: number;
  creditSales: number;
  totalSales: number;
  totalTickets: number;
  grossProfit: number;
  active: boolean;
  sales: SaleDetailHistoryResponse[];
}

//Renglón de venta en el historial (ya existe en la app, se reusa aquí)
export interface SaleDetailHistoryResponse {
  saleId: number;
  saleDate: string;
  total: number;
  paymentMethod: PaymentMethod;
  items: SaleDetailResponse[];
  paymentStatus: string;
  confirmed: boolean;
  confirmedAt: string | null;
  cancelled: boolean;
  cancelledAt: string | null;
}

export interface SaleDetailResponse {
  product: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  subtotal: number;
}