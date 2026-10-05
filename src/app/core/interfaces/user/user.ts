import { Injectable } from '@angular/core';

//Interface para crear el usuario
//Se usará en features/cobro/cobro.ts
export interface User {
  id?: number;
  name: string;
  email: string;
  password?: string;
  roleId: number;
  roleName?: string;
  active?: boolean;

  /**
   * Última vez que se dio de alta el usuario (V5).
   *
   * <p>Llega como `string` en formato ISO (`2026-10-01T14:30:00`) y se formatea
   * en la plantilla con el pipe `date`. Es `null` en los usuarios creados antes
   * de V5, porque la columna se agregó después.
   */
  activatedAt?: string | null;

  /**
   * Última vez que se dio de baja el usuario (V5).
   *
   * <p>Solo viene informada si `active === false`. Es el campo que hace posible
   * filtrar la tabla de dados de baja por rango de fechas.
   */
  deactivatedAt?: string | null;
}

//Interface para ver el role del usuario
//Se usará en features/cobro/cobro.ts
export interface UserRole {
  id: number;
  name: string;
}

//Interface para crear un usuario
export interface CreateUserRequest {
  name: string;
  email: string;
  password: string;
  roleId: number;
}

//Interface para actualizar un usuario
export interface UpdateUserRequest {
  name: string;
  email: string;
  roleId: number;
}