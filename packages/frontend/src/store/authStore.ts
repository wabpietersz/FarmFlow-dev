import { create } from 'zustand';
import { type User, type UserRole } from '@farmflow/shared';

interface AuthState {
  currentUser: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  permissions: string[];
}

interface AuthActions {
  setUser: (user: User, permissions?: string[]) => void;
  logout: () => void;
  clearError: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string) => void;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: UserRole) => boolean;
}

export const useAuthStore = create<AuthState & AuthActions>((set, get) => ({
  currentUser: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
  permissions: [],

  setUser: (user, permissions = []) =>
    set({
      currentUser: user,
      isAuthenticated: true,
      isLoading: false,
      error: null,
      permissions,
    }),

  logout: () =>
    set({
      currentUser: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      permissions: [],
    }),

  clearError: () => set({ error: null }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error, isLoading: false }),

  hasPermission: (permission) => {
    const { permissions } = get();
    return permissions.some(
      (p) =>
        p === permission ||
        p === '*' ||
        (p.endsWith(':*') && permission.startsWith(p.slice(0, -1))),
    );
  },

  hasRole: (role) => {
    const { currentUser } = get();
    return currentUser?.userRole === role;
  },
}));
