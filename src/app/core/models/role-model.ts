export interface RoleModel {
  id: number;
  name: string;
  permissions: PermissionModel[];
}

export interface CreateRoleRequest {
  name: string;
  permissions: string[];
}

export interface UpdateRoleRequest {
  name: string;
  permissions: string[];
}

export interface PermissionModel {
  id: number;
  name: string;
}
