import { create } from 'zustand';
import { type User, type UserRole, type LoginResponse } from '@farmflow/shared';
import { signInWithEmail, signOut as firebaseSignOut } from '@/lib/firebase';
import { apiPost, apiGet } from '@/lib/api';

interface AuthState {
  currentUser: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  permissions: string[];
}

interface AuthActions {
  setUser: (user: User, permissions?: string[]) => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchCurrentUser: () => Promise<void>;
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

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      // Sign in with Firebase Client SDK
      const idToken = await signInWithEmail(email, password);

      // Send token to backend to verify and get user data
      const response = await apiPost<LoginResponse>('/auth/login', { idToken });

      if (response.success && response.data) {
        set({
          currentUser: response.data.user as User,
          isAuthenticated: true,
          isLoading: false,
          error: null,
          permissions: response.data.permissions,
        });
      } else {
        throw new Error(response.error || 'Login failed');
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Login failed. Please check your credentials.';
      // Map Firebase error codes to user-friendly messages
      const friendlyMessage = mapFirebaseError(message);
      set({ error: friendlyMessage, isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    try {
      await apiPost('/auth/logout', {});
    } catch {
      // Continue with local logout even if backend fails
    }
    try {
      await firebaseSignOut();
    } catch {
      // Continue with local logout even if Firebase fails
    }
    set({
      currentUser: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      permissions: [],
    });
  },

  fetchCurrentUser: async () => {
    try {
      const response = await apiGet<LoginResponse>('/auth/me');
      if (response.success && response.data) {
        set({
          currentUser: response.data.user as User,
          isAuthenticated: true,
          isLoading: false,
          permissions: response.data.permissions,
        });
      } else {
        set({ currentUser: null, isAuthenticated: false, isLoading: false });
      }
    } catch {
      set({ currentUser: null, isAuthenticated: false, isLoading: false });
    }
  },

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

function mapFirebaseError(message: string): string {
  if (message.includes('auth/invalid-credential') || message.includes('auth/wrong-password')) {
    return 'Invalid email or password.';
  }
  if (message.includes('auth/user-not-found')) {
    return 'No account found with this email.';
  }
  if (message.includes('auth/too-many-requests')) {
    return 'Too many failed attempts. Please try again later.';
  }
  if (message.includes('auth/user-disabled')) {
    return 'This account has been disabled.';
  }
  if (message.includes('auth/network-request-failed')) {
    return 'Network error. Please check your connection.';
  }
  return 'Login failed. Please check your credentials.';
}
