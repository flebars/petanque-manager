import { api } from './client';

export interface SystemStats {
  users: number;
  tournaments: number;
  teams: number;
  matches: number;
  adminUsers: number;
}

export interface User {
  id: string;
  email: string;
  nom: string;
  prenom: string;
  genre: string;
  club: string | null;
  role: string;
  categorie: string;
  createdAt: string;
}

export interface UsersListResponse {
  users: User[];
  total: number;
  page: number;
  limit: number;
}

export interface AuditLog {
  id: string;
  action: string;
  actorId: string;
  targetId: string | null;
  details: any;
  ipAddress: string | null;
  createdAt: string;
  actor: {
    email: string;
    nom: string;
    prenom: string;
    role: string;
  };
}

export interface AuditLogsResponse {
  logs: AuditLog[];
  total: number;
  page: number;
  limit: number;
}

export interface ClearDataRequest {
  confirmText: string;
  password: string;
}

export interface ClearDataResponse {
  success: true;
  message: string;
  deleted: {
    tournaments: number;
    teams: number;
    matches: number;
    users: number;
  };
  preserved: {
    adminUsers: number;
  };
}

export interface UpdateRoleRequest {
  newRole: string;
  password: string;
}

export interface UpdateUserProfileRequest {
  email?: string;
  nom?: string;
  prenom?: string;
  genre?: string;
  dateNaissance?: string;
  licenceFfpjp?: string;
  club?: string;
  categorie?: string;
}

export async function getStats(): Promise<SystemStats> {
  const { data } = await api.get('/admin/stats');
  return data;
}

export async function listUsers(
  search?: string,
  page = 1,
  limit = 50,
): Promise<UsersListResponse> {
  const params = new URLSearchParams();
  if (search) params.append('search', search);
  params.append('page', page.toString());
  params.append('limit', limit.toString());

  const { data } = await api.get(`/admin/users?${params.toString()}`);
  return data;
}

export async function updateUserRole(
  userId: string,
  request: UpdateRoleRequest,
): Promise<{ message: string; user: User }> {
  const { data } = await api.patch(`/admin/users/${userId}/role`, request);
  return data;
}

export async function updateUserProfile(
  userId: string,
  request: UpdateUserProfileRequest,
): Promise<{ message: string; user: User }> {
  const { data } = await api.patch(`/admin/users/${userId}/profile`, request);
  return data;
}

export async function deleteUser(userId: string): Promise<{ message: string }> {
  const { data } = await api.delete(`/admin/users/${userId}`);
  return data;
}

export async function exportBackup(): Promise<any> {
  const { data } = await api.post('/admin/backup');
  return data;
}

export async function clearAllData(request: ClearDataRequest): Promise<ClearDataResponse> {
  const { data } = await api.post('/admin/clear-data', request);
  return data;
}

export async function listAuditLogs(
  action?: string,
  page = 1,
  limit = 50,
): Promise<AuditLogsResponse> {
  const params = new URLSearchParams();
  if (action) params.append('action', action);
  params.append('page', page.toString());
  params.append('limit', limit.toString());

  const { data } = await api.get(`/admin/audit-logs?${params.toString()}`);
  return data;
}
