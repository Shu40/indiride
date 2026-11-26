import { create } from 'zustand';
import { User, UserRole } from '../types';
import { setAuthToken, getStoredToken, api } from '../services/api';

interface AuthState {
  user: User | null;
  token: string | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (user: User, token: string) => void;
  updateUser: (user: User) => void;
  logout: () => void;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  role: null,
  isAuthenticated: false,
  isLoading: true,

  setAuth: (user: User, token: string) => {
    setAuthToken(token);
    set({
      user,
      token,
      role: user.role,
      isAuthenticated: true,
      isLoading: false,
    });
  },

  updateUser: (user: User) => {
    set({ user, role: user.role });
  },

  logout: () => {
    setAuthToken(null);
    set({
      user: null,
      token: null,
      role: null,
      isAuthenticated: false,
      isLoading: false,
    });
  },

  initialize: async () => {
    const token = getStoredToken();
    if (!token) {
      set({ isLoading: false });
      return;
    }

    try {
      setAuthToken(token);
      const user = await api.auth.getMe();
      set({
        user,
        token,
        role: user.role,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (e) {
      setAuthToken(null);
      set({
        user: null,
        token: null,
        role: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },
}));
