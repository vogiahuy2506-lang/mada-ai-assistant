import type { User, UserRole, UserPlan } from '@/types';
import { PLAN_LIMITS } from '@/stores';

export interface AdminCredential {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  plan: UserPlan;
  description: string;
}

export const ADMIN_CREDENTIALS: AdminCredential[] = [
  {
    email: 'admin@mada.vn',
    password: 'Admin@123',
    name: 'MADA Admin',
    role: 'admin',
    plan: 'enterprise',
    description: 'Quản trị viên cấp cao — toàn quyền hệ thống',
  },
];

export const DEMO_CREDENTIALS: AdminCredential[] = [
  {
    email: 'admin@mada.vn',
    password: 'Admin@123',
    name: 'MADA Admin',
    role: 'admin',
    plan: 'enterprise',
    description: 'Quản trị viên cấp cao — toàn quyền hệ thống',
  },
  {
    email: 'expert@mada.vn',
    password: 'Expert@123',
    name: 'Chuyên gia MADA',
    role: 'expert',
    plan: 'enterprise',
    description: 'Chuyên gia tư vấn thiết bị hỗ trợ',
  },
  {
    email: 'data@mada.vn',
    password: 'Data@123',
    name: 'Quản lý dữ liệu',
    role: 'data_manager',
    plan: 'enterprise',
    description: 'Quản trị cơ sở tri thức RAG',
  },
];

export function findAdminByCredentials(email: string, password: string): AdminCredential | null {
  const normalized = email.trim().toLowerCase();
  return (
    ADMIN_CREDENTIALS.find(
      (a) => a.email.toLowerCase() === normalized && a.password === password
    ) ?? null
  );
}

export function buildAdminUser(credential: AdminCredential): User {
  return {
    id: `admin-${credential.email.split('@')[0]}`,
    email: credential.email,
    name: credential.name,
    role: credential.role,
    plan: credential.plan,
    avatar: undefined,
    quotaUsed: 0,
    quotaLimit: PLAN_LIMITS[credential.plan],
    provider: 'email',
    createdAt: new Date(),
    lastLogin: new Date(),
  };
}