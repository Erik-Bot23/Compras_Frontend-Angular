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