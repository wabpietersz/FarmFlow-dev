import { useEffect, useRef, type ReactNode } from 'react';
import { onAuthStateChange } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';

export default function AuthProvider({ children }: { children: ReactNode }) {
  const initialized = useRef(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (firebaseUser) => {
      const { fetchCurrentUser, setLoading } = useAuthStore.getState();

      if (firebaseUser) {
        await fetchCurrentUser();
      } else {
        // Clear local state without calling firebaseSignOut (which would re-trigger this callback)
        useAuthStore.setState({
          currentUser: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
          permissions: [],
        });
      }
      initialized.current = true;
    });

    // Listen for 401 events from the API interceptor
    const handleUnauthorized = () => {
      useAuthStore.setState({
        currentUser: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        permissions: [],
      });
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);

    return () => {
      unsubscribe();
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, []);

  return <>{children}</>;
}
