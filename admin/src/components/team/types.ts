export type StaffRole = 'admin' | 'manager';

export interface StaffMember {
    _id: string;
    name: string;
    username: string;
    role: StaffRole;
    isActive: boolean;
    email?: string;
    createdAt: string;
    updatedAt: string;
}

export const TEAM_KEY = ['team'] as const;

export const ROLE_LABEL: Record<StaffRole, string> = { admin: 'Admin', manager: 'Manager' };
