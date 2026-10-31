import { request } from './http';
import type { AuthResponse, Role, RolePermissionsMatrix, User } from '../types/api';

export async function login(username: string, pin: string): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: { username, pin },
  });
}

export async function getMe(): Promise<User> {
  return request<User>('/auth/me');
}

export async function getPermissionsMatrix(): Promise<RolePermissionsMatrix> {
  return request<RolePermissionsMatrix>('/permissions');
}

export async function updateRolePermissions(role: Role, permissions: string[]): Promise<{ role: Role; permissions: string[] }> {
  return request<{ role: Role; permissions: string[] }>(`/permissions/${role}`, {
    method: 'PUT',
    body: { permissions },
  });
}
