import { Injectable } from '@angular/core';

//Interface para registrar productos
//Se usará en product-service y features/productos/productos.ts
export interface ProductForm{
  id?: number;
  name: string;
  price: number;
  stock: number;
  img?: string;
  categoryId: number;
  categoryName?: string;
  sku: string; //código del producto
  barcode: string;
  active?: boolean;
  //true si el producto tiene ventas o compras asociadas. Lo decide el backend:
  //si es true NO se puede eliminar (solo "dar de baja"); si es false se puede
  //"Eliminar" de forma definitiva. El template elige el boton segun esto.
  hasHistory?: boolean;
  createdAt?: Date;
}

//Interface para mostrar la venta
//Se usará en product-service y features/cobro/cobro.ts
export interface ProductShow{
  id?: number;
  name: string;
  description?: string;
  price: number;
  cost?: number; //útil para reportes
  stock: number;
  sku?: string; //código del producto
  barcode?: string;
  categoryId: number;
  categoryName: string;
  active?: boolean;
  createdAt?: Date;
}

//Interface para realizar la venta
//Se usará en product-service y features/cobro/cobro.ts
export interface ProductSale{
  id: number;
  name: string;
  price: number;
  stock: number;
  barcode?: string;
}

//Interface para traer las categorias de la base de datos
//Se usará en product-service y features/productos/productos.ts
export interface Category {
  id: number;
  name: string;
}
