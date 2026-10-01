/** Access to one module: none, day-to-day use, or full control (manage, approve, delete, configure). */
export type AccessLevel = 'none' | 'user' | 'admin';

export type AccessModuleKey =
  | 'farms'
  | 'feed_mill'
  | 'stock'
  | 'sales'
  | 'money'
  | 'people'
  | 'attendance'
  | 'payroll'
  | 'reports'
  | 'administration';

export interface AccessModule {
  key: AccessModuleKey;
  label: string;
  description: string;
  /** What "User" access lets someone do, in plain words */
  userCan: string;
  /** What "Admin" access adds */
  adminCan: string;
}

export interface RoleAccessRow {
  role: string;
  roleLabel: string;
  /** System admins always keep full access so nobody can lock themselves out */
  locked: boolean;
  levels: Record<AccessModuleKey, AccessLevel>;
}

export interface AccessMatrix {
  modules: AccessModule[];
  roles: RoleAccessRow[];
}
