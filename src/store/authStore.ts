import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient, { ApiError, setUnauthorizedHandler } from '@/services/api';
import {
  computeLockExpiration,
  evaluatePinSecurity,
  hashPin,
  isPinLocked as utilIsPinLocked,
  MAX_PIN_ATTEMPTS,
  PinHashPayload,
  PinLockError,
  verifyPinHash,
} from '@/utils/pinSecurity';
import { useWalletStore } from './walletStore';
import { useTransactionStore } from './transactionStore';
import { useSavingsStore } from './savingsStore';

type JsonDate = string | null | undefined;

interface AuthNotificationPreferences {
  push_enabled: boolean;
  email_enabled: boolean;
  transaction_alerts: boolean;
  savings_milestones: boolean;
}

export interface AuthUser {
  id: string;
  email: string;
  phone: string | null;
  first_name: string;
  last_name: string;
  kyc_status: 'not_started' | 'pending' | 'approved' | 'rejected';
  status: 'active' | 'suspended' | 'closed';
  notification_preferences: AuthNotificationPreferences;
  created_at: string;
  updated_at: string;
}

interface LoginResponse {
  session_id: string;
  message: string;
}

interface RegisterResponse {
  session_id: string;
  message: string;
  delivery_channel: 'email' | 'sms';
}

interface VerifyOtpResponse {
  access_token: string;
  refresh_token: string;
  requires_pin_setup: boolean;
  user: AuthUser;
}

interface VerifyPinResponse {
  verified: boolean;
  token: string;
}

interface UpdateProfileResponse {
  user: AuthUser;
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  isPinSet: boolean;
  isPinVerified: boolean;
  pinVerificationToken: string | null;
  failedPinAttempts: number;
  pinLockedUntil: Date | null;
  pinHashData: PinHashPayload | null;
  pinLastFailedAt: Date | null;
  isLoading: boolean;
  isRegistering: boolean;
  isLoggingIn: boolean;
  isVerifyingOtp: boolean;
  isSettingUpPin: boolean;
  isVerifyingPin: boolean;
  isUpdatingProfile: boolean;
  sessionId: string | null;
  lastActivity: Date | null;
  setUser: (user: AuthUser | null) => void;
  setTokens: (accessToken: string | null, refreshToken: string | null) => void;
  setAuthenticated: (isAuthenticated: boolean) => void;
  setPinStatus: (isPinSet: boolean, isPinVerified: boolean) => void;
  setPinVerificationToken: (token: string | null) => void;
  consumePinToken: () => void;
  setFailedPinAttempts: (attempts: number) => void;
  setPinLocked: (lockedUntil: Date | null) => void;
  setPinHashData: (data: PinHashPayload | null) => void;
  setPinLastFailedAt: (date: Date | null) => void;
  setLastActivity: (date: Date | null) => void;
  setLoading: (isLoading: boolean) => void;
  setLoggingIn: (isLoggingIn: boolean) => void;
  setVerifyingOtp: (isVerifyingOtp: boolean) => void;
  setSettingUpPin: (isSettingUpPin: boolean) => void;
  setVerifyingPin: (isVerifyingPin: boolean) => void;
  setSessionId: (sessionId: string | null) => void;
  updateLastActivity: () => void;
  clearAuth: () => void;
  sendLoginOtp: (payload: { email?: string; phone?: string }) => Promise<void>;
  register: (payload: { firstName: string; lastName: string; email: string; phone: string }) => Promise<void>;
  verifyOtp: (payload: { sessionId: string; otpCode: string }) => Promise<{ requiresPinSetup: boolean }>;
  setupPin: (payload: { pin: string; confirmPin: string }) => Promise<void>;
  verifyPin: (payload: { pin: string }) => Promise<string>;
  updateProfile: (payload: { firstName: string; lastName: string; email: string; phone: string }) => Promise<void>;
  logout: () => Promise<void>;
  getIsSessionExpired: () => boolean;
  getIsPinLocked: () => boolean;
  getRemainingLockTime: () => number;
}

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

const parseDate = (value: JsonDate | Date | null): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const serializeDate = (value: Date | string | null | undefined): string | null => {
  const parsed = parseDate(value);
  return parsed ? parsed.toISOString() : null;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      accessToken: null,
      refreshToken: null,
      isPinSet: false,
      isPinVerified: false,
      pinVerificationToken: null,
      failedPinAttempts: 0,
      pinLockedUntil: null,
      pinHashData: null,
      pinLastFailedAt: null,
      isLoading: false,
      isRegistering: false,
      isLoggingIn: false,
      isVerifyingOtp: false,
      isSettingUpPin: false,
      isVerifyingPin: false,
      isUpdatingProfile: false,
      sessionId: null,
      lastActivity: null,

      setUser: (user) => {
        set({ user });
      },

      setTokens: (accessToken, refreshToken) => {
        apiClient.setAccessToken(accessToken);
        set({ accessToken, refreshToken });
      },

      setAuthenticated: (isAuthenticated) => {
        set({ isAuthenticated });
        if (!isAuthenticated) {
          apiClient.setAccessToken(null);
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            isPinSet: false,
            isPinVerified: false,
          pinVerificationToken: null,
          failedPinAttempts: 0,
          pinLockedUntil: null,
          pinHashData: null,
          pinLastFailedAt: null,
          isUpdatingProfile: false,
          sessionId: null,
        });
      }
      },

      setPinStatus: (isPinSet, isPinVerified) => {
        set({ isPinSet, isPinVerified });
      },

      setPinVerificationToken: (token) => {
        set({ pinVerificationToken: token });
      },

      consumePinToken: () => {
        set({ pinVerificationToken: null });
      },

      setFailedPinAttempts: (attempts) => {
        set({ failedPinAttempts: Math.max(0, Math.min(MAX_PIN_ATTEMPTS, attempts)) });
      },

      setPinLocked: (lockedUntil) => {
        set({ pinLockedUntil: lockedUntil });
      },

      setPinHashData: (data) => {
        set({ pinHashData: data });
      },

      setPinLastFailedAt: (date) => {
        set({ pinLastFailedAt: date });
      },

      setLastActivity: (date) => {
        set({ lastActivity: date });
      },

      setLoading: (isLoading) => set({ isLoading }),
      setLoggingIn: (isLoggingIn) => set({ isLoggingIn }),
      setVerifyingOtp: (isVerifyingOtp) => set({ isVerifyingOtp }),
      setSettingUpPin: (isSettingUpPin) => set({ isSettingUpPin }),
      setVerifyingPin: (isVerifyingPin) => set({ isVerifyingPin }),
      setSessionId: (sessionId) => set({ sessionId }),

      updateLastActivity: () => {
        set({ lastActivity: new Date() });
      },

      clearAuth: async () => {
        apiClient.setAccessToken(null);
        set({
          user: null,
          isAuthenticated: false,
          accessToken: null,
          refreshToken: null,
          isPinSet: false,
          isPinVerified: false,
          pinVerificationToken: null,
          failedPinAttempts: 0,
          pinLockedUntil: null,
          pinHashData: null,
          pinLastFailedAt: null,
          sessionId: null,
          isLoading: false,
          isRegistering: false,
          isLoggingIn: false,
          isVerifyingOtp: false,
          isSettingUpPin: false,
          isVerifyingPin: false,
          isUpdatingProfile: false,
          lastActivity: null,
        });

        useWalletStore.getState().reset();
        useTransactionStore.getState().resetTransactions();
        useSavingsStore.getState().resetGoals();
      },

      sendLoginOtp: async ({ email, phone }) => {
        if (!email && !phone) {
          throw new Error('Email or phone number is required');
        }

        set({ isLoggingIn: true, isLoading: true });
        try {
          const response = await apiClient.post<LoginResponse>('/auth/login', { email, phone }, { skipAuth: true });
          set({ sessionId: response.session_id });
        } finally {
          set({ isLoggingIn: false, isLoading: false });
        }
      },

      register: async ({ firstName, lastName, email, phone }) => {
        set({ isRegistering: true, isLoading: true });
        try {
          const response = await apiClient.post<RegisterResponse>(
            '/auth/register',
            {
              first_name: firstName,
              last_name: lastName,
              email,
              phone,
            },
            { skipAuth: true },
          );

          set({ sessionId: response.session_id });
        } catch (error) {
          throw error;
        } finally {
          set({ isRegistering: false, isLoading: false });
        }
      },

      verifyOtp: async ({ sessionId, otpCode }) => {
        const { setUser, setTokens, setAuthenticated, setPinStatus, updateLastActivity } = get();
        set({ isVerifyingOtp: true, isLoading: true });

        try {
          const response = await apiClient.post<VerifyOtpResponse>('/auth/verify-otp', {
            session_id: sessionId,
            otp_code: otpCode,
          }, { skipAuth: true });

          setUser(response.user);
          setTokens(response.access_token, response.refresh_token);
          setAuthenticated(true);
          setPinStatus(!response.requires_pin_setup, false);
          set({
            isPinVerified: false,
            pinVerificationToken: null,
            sessionId: null,
          });
          updateLastActivity();

          return { requiresPinSetup: response.requires_pin_setup };
        } finally {
          set({ isVerifyingOtp: false, isLoading: false });
        }
      },

      setupPin: async ({ pin, confirmPin }) => {
        const { setPinStatus, updateLastActivity } = get();

        if (!/^[0-9]{4}$/.test(pin) || !/^[0-9]{4}$/.test(confirmPin)) {
          throw new Error('PIN must be exactly 4 digits');
        }

        if (pin !== confirmPin) {
          throw new Error('PIN and confirmation PIN must match');
        }

        const evaluation = evaluatePinSecurity(pin);
        if (!evaluation.isValid) {
          throw new Error(evaluation.errors.join(', '));
        }

  const pinHashData = await hashPin(pin, { skipValidation: true });

        set({ isSettingUpPin: true, isLoading: true });
        try {
          await apiClient.post('/auth/setup-pin', { pin, confirm_pin: confirmPin });
          setPinStatus(true, false);
          set({
            pinHashData,
            failedPinAttempts: 0,
            pinLockedUntil: null,
            pinLastFailedAt: null,
          });
          updateLastActivity();
        } finally {
          set({ isSettingUpPin: false, isLoading: false });
        }
      },

      verifyPin: async ({ pin }) => {
        if (!/^[0-9]{4}$/.test(pin)) {
          throw new Error('PIN must be exactly 4 digits');
        }

        const initialState = get();
        const { updateLastActivity } = initialState;
        const now = new Date();

        const lockedUntil = initialState.pinLockedUntil;
        if (utilIsPinLocked(lockedUntil, now)) {
          const unlockAt = lockedUntil ?? computeLockExpiration(initialState.failedPinAttempts, now) ?? now;
          throw new PinLockError(unlockAt);
        }

        const applyFailure = (attempts: number, lockExpiration: Date | null, failedAt: Date) => {
          const clampedAttempts = Math.max(0, Math.min(MAX_PIN_ATTEMPTS, attempts));
          set({
            failedPinAttempts: clampedAttempts,
            pinLockedUntil: lockExpiration,
            pinLastFailedAt: failedAt,
            isPinVerified: false,
            pinVerificationToken: null,
          });
          return lockExpiration;
        };

        if (initialState.pinHashData) {
          const matches = await verifyPinHash(pin, initialState.pinHashData);
          if (!matches) {
            const attempts = initialState.failedPinAttempts + 1;
            const lockExpiration = computeLockExpiration(attempts, now);
            const lockedUntil = applyFailure(attempts, lockExpiration, now);

            if (lockedUntil) {
              throw new PinLockError(lockedUntil);
            }

            throw new Error('Incorrect PIN');
          }
        }

        set({ isVerifyingPin: true, isLoading: true });
        try {
          const response = await apiClient.post<VerifyPinResponse>('/auth/verify-pin', { pin });

          set({
            pinVerificationToken: response.token,
            failedPinAttempts: 0,
            pinLockedUntil: null,
            pinLastFailedAt: null,
            isPinVerified: true,
          });

          try {
            const existingHash = get().pinHashData;
            const pinHashData = await hashPin(pin, {
              skipValidation: true,
              salt: existingHash?.salt,
              iterations: existingHash?.iterations,
            });
            set({ pinHashData });
          } catch (hashError) {
            // Unable to refresh local PIN hash; continue without caching
          }

          updateLastActivity();

          return response.token;
        } catch (error) {
          if (error instanceof ApiError) {
            const failedAt = new Date();
            const attemptsRemaining = typeof error.details?.attempts_remaining === 'number'
              ? error.details.attempts_remaining
              : null;
            let attempts = get().failedPinAttempts + 1;

            if (attemptsRemaining !== null) {
              attempts = Math.max(0, MAX_PIN_ATTEMPTS - attemptsRemaining);
            }

            const lockedUntilFromApi = parseDate((error.details as Record<string, unknown> | undefined)?.locked_until as JsonDate);
            const lockExpiration = lockedUntilFromApi ?? computeLockExpiration(attempts, failedAt);
            const lockedUntil = applyFailure(attempts, lockExpiration, failedAt);

            if (lockedUntil) {
              throw new PinLockError(lockedUntil);
            }
          }

          throw error;
        } finally {
          set({ isVerifyingPin: false, isLoading: false });
        }
      },

      updateProfile: async ({ firstName, lastName, email, phone }) => {
        const { setUser, updateLastActivity } = get();
        set({ isUpdatingProfile: true, isLoading: true });
        try {
          const response = await apiClient.patch<UpdateProfileResponse>('/auth/profile', {
            first_name: firstName,
            last_name: lastName,
            email,
            phone,
          });
          setUser(response.user);
          updateLastActivity();
        } catch (error) {
          throw error;
        } finally {
          set({ isUpdatingProfile: false, isLoading: false });
        }
      },

      logout: async () => {
        await get().clearAuth();
      },

      getIsSessionExpired: () => {
        const state = get();
        if (!state.lastActivity) return true;
        return Date.now() - state.lastActivity.getTime() > SESSION_TIMEOUT_MS;
      },

      getIsPinLocked: () => {
        const state = get();
        return utilIsPinLocked(state.pinLockedUntil);
      },

      getRemainingLockTime: () => {
        const state = get();
        if (!state.pinLockedUntil) return 0;
        const diff = state.pinLockedUntil.getTime() - Date.now();
        return Math.max(0, Math.ceil(diff / 1000));
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isPinSet: state.isPinSet,
        isPinVerified: state.isPinVerified,
        failedPinAttempts: state.failedPinAttempts,
  pinLockedUntil: serializeDate(state.pinLockedUntil),
        pinHashData: state.pinHashData,
  pinLastFailedAt: serializeDate(state.pinLastFailedAt),
  lastActivity: serializeDate(state.lastActivity),
        pinVerificationToken: state.pinVerificationToken,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) {
          return;
        }

        const pinLockedUntil = parseDate(state.pinLockedUntil as JsonDate);
        const lastActivity = parseDate(state.lastActivity as JsonDate);
        const pinLastFailedAt = parseDate(state.pinLastFailedAt as JsonDate);

        if (pinLockedUntil) {
          state.setPinLocked(pinLockedUntil);
        }

        if (lastActivity) {
          state.setLastActivity(lastActivity);
        }

        if (pinLastFailedAt) {
          state.setPinLastFailedAt(pinLastFailedAt);
        }

        if (state.accessToken) {
          apiClient.setAccessToken(state.accessToken);
        }

        if (state.getIsSessionExpired()) {
          state.clearAuth();
        } else {
          // Set lastActivity directly to avoid infinite loop during rehydration
          state.setLastActivity(new Date());
        }
      },
    }
  )
);

setUnauthorizedHandler(() => {
  const { clearAuth } = useAuthStore.getState();
  void clearAuth();
});

export const useAuthStatus = () => {
  const { isAuthenticated, isPinSet, isPinVerified, user } = useAuthStore();
  const isKycCompliant = user?.kyc_status === 'approved' || user?.kyc_status === 'pending';
  
  return {
    isAuthenticated,
    isPinSet,
    isPinVerified,
    isKycCompliant,
    kycStatus: user?.kyc_status || 'not_started',
    isFullyAuthenticated: isAuthenticated && isPinSet && isPinVerified && isKycCompliant,
  };
};

export const usePinLockStatus = () => {
  const { getIsPinLocked, getRemainingLockTime, failedPinAttempts, pinLockedUntil, pinLastFailedAt } = useAuthStore();
  return {
    isPinLocked: getIsPinLocked(),
    remainingLockTime: getRemainingLockTime(),
    failedAttempts: failedPinAttempts,
    attemptsRemaining: Math.max(0, MAX_PIN_ATTEMPTS - failedPinAttempts),
    lockedUntil: pinLockedUntil,
    lastFailedAt: pinLastFailedAt,
  };
};

export default useAuthStore;
