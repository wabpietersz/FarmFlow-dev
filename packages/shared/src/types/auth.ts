export enum UserRole {
  SystemAdmin = 'system_admin',
  FarmManager = 'farm_manager',
  Accountant = 'accountant',
  Supervisor = 'supervisor',
  FeedMillOperator = 'feed_mill_operator',
  FarmWorker = 'farm_worker',
  Viewer = 'viewer',
}

export interface User {
  id: number;
  firebaseUid: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  userRole: UserRole;
  siteId?: number | null;
  isActive: boolean;
  lastLogin?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: Omit<User, 'firebaseUid'>;
  permissions: string[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface CreateUserRequest {
  email: string;
  firstName: string;
  lastName: string;
  userRole: UserRole;
  siteId?: number;
}
