//Espejo de model/dto/Purchases/*.java — nombres de campo idénticos a la respuesta JSON.

//Proveedor (CRUD /api/providers)
export interface ProviderDto {
  id?: number;
  name: string;
  rfc: string;
  phone?: string;
  email?: string;
}

//Renglón de compra en la respuesta
export interface PurchaseItemDTO {
  productId: number;
  productName: string;
  quantity: number;
  unitCost: number;
  subtotal: number;
}

//Compra (GET /api/purchases y POST /api/purchases)
export interface PurchaseDTO {
  id: number;
  purchaseDate: string;
  providerId: number;
  providerName: string;
  total: number;
  totalItems: number;
  items: PurchaseItemDTO[];
//Estado del ciclo de vida de la compra (V3). false = PENDIENTE: todavia no
  //toco el inventario y se puede cancelar. true = CONFIRMADA: el stock ya
  //sumo y su costo ya es el vigente; no se puede cancelar (409).
  confirmed: boolean;
  confirmedAt: string | null;
}

//Item a enviar al crear una compra
export interface PurchaseItemRequest {
  productId: number;
  quantity: number;
  unitCost: number;
}

//Petición de POST /api/purchases
export interface PurchaseRequest {
  providerId: number;
  purchaseDate?: string; //ISO si se backdatea; si falta, el backend usa ahora
  items: PurchaseItemRequest[];
}