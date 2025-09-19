# Frontend Architecture

## React Native App Structure

```
apps/mobile/
├── src/
│   ├── components/           # Reusable UI components
│   │   ├── common/          # Basic UI elements
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Card.tsx
│   │   │   └── Modal.tsx
│   │   ├── forms/           # Form components with validation
│   │   │   ├── PhoneInput.tsx
│   │   │   ├── PinInput.tsx
│   │   │   ├── AmountInput.tsx
│   │   │   └── GoalForm.tsx
│   │   ├── layout/          # Layout components
│   │   │   ├── Header.tsx
│   │   │   ├── TabBar.tsx
│   │   │   └── ScreenContainer.tsx
│   │   └── features/        # Feature-specific components
│   │       ├── auth/        # Authentication components
│   │       ├── wallet/      # Wallet components
│   │       ├── goals/       # Goals components
│   │       └── transactions/ # Transaction components
│   ├── screens/            # Screen components
│   │   ├── auth/           # Authentication screens
│   │   │   ├── LoginScreen.tsx
│   │   │   ├── RegisterScreen.tsx
│   │   │   └── KYCScreen.tsx
│   │   ├── main/           # Main app screens
│   │   │   ├── DashboardScreen.tsx
│   │   │   ├── GoalsScreen.tsx
│   │   │   ├── TransactionsScreen.tsx
│   │   │   └── SettingsScreen.tsx
│   │   └── features/       # Feature-specific screens
│   │       ├── GoalDetailScreen.tsx
│   │       ├── GoalCreationScreen.tsx
│   │       └── TransactionDetailScreen.tsx
│   ├── navigation/         # Navigation configuration
│   │   ├── AppNavigator.tsx
│   │   ├── AuthNavigator.tsx
│   │   ├── MainNavigator.tsx
│   │   └── types.ts
│   ├── services/          # API and business logic services
│   │   ├── api/           # API client setup
│   │   │   ├── client.ts
│   │   │   ├── auth.ts
│   │   │   ├── wallet.ts
│   │   │   ├── goals.ts
│   │   │   ├── transactions.ts
│   │   │   └── mpesa.ts
│   │   ├── hooks/         # Custom React hooks
│   │   │   ├── useAuth.ts
│   │   │   ├── useWallet.ts
│   │   │   ├── useGoals.ts
│   │   │   └── useTransactions.ts
│   │   ├── stores/        # State management
│   │   │   ├── authStore.ts
│   │   │   ├── walletStore.ts
│   │   │   └── goalsStore.ts
│   │   ├── utils/         # Utility functions
│   │   │   ├── currency.ts
│   │   │   ├── validation.ts
│   │   │   └── helpers.ts
│   │   └── types/        # TypeScript type definitions
│   │       ├── api.ts
│   │       ├── models.ts
│   │       └── navigation.ts
│   ├── assets/            # Static assets
│   │   ├── images/
│   │   ├── fonts/
│   │   └── constants.ts
│   └── App.tsx            # App entry point
└── package.json
```

## State Management Implementation

```typescript
// packages/shared/src/stores/authStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, AuthState } from '../types';

interface AuthStore extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  register: (userData: RegisterData) => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  refreshUser: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (credentials) => {
        set({ isLoading: true, error: null });
        try {
          const response = await authService.login(credentials);
          set({
            user: response.user,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          set({ error: error.message, isLoading: false });
          throw error;
        }
      },

      logout: async () => {
        set({ isLoading: true });
        try {
          await authService.logout();
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          set({ error: error.message, isLoading: false });
        }
      },

      // ... other methods
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
```

## Navigation Architecture

```typescript
// apps/mobile/src/navigation/AppNavigator.tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../services/stores/authStore';
import { AuthNavigator } from './AuthNavigator';
import { MainNavigator } from './MainNavigator';
import { LoadingScreen } from '../screens/common/LoadingScreen';

const Stack = createNativeStackNavigator();

export const AppNavigator: React.FC = () => {
  const { isAuthenticated, isLoading, user } = useAuthStore();

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated && user ? (
          <Stack.Screen name="Main" component={MainNavigator} />
        ) : (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
```

## Component Template

```typescript
// apps/mobile/src/components/features/goals/GoalCard.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { ProgressBar } from '../../components/common/ProgressBar';
import { SavingsGoal } from '../../../packages/shared/src/types';
import { formatCurrency } from '../../../packages/shared/src/utils/currency';

interface GoalCardProps {
  goal: SavingsGoal;
  onPress?: () => void;
  onFund?: () => void;
}

export const GoalCard: React.FC<GoalCardProps> = ({ goal, onPress, onFund }) => {
  const progress = (goal.current_amount / goal.target_amount) * 100;

  return (
    <Card onPress={onPress} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.icon}>{goal.icon_emoji || '🎯'}</Text>
        <Text style={styles.name}>{goal.name}</Text>
      </View>

      <View style={styles.progressSection}>
        <Text style={styles.amount}>
          {formatCurrency(goal.current_amount)} / {formatCurrency(goal.target_amount)}
        </Text>
        <ProgressBar progress={progress} style={styles.progressBar} />
        <Text style={styles.percentage}>{progress.toFixed(1)}%</Text>
      </View>

      {goal.status === 'active' && (
        <Button
          title="Add Funds"
          onPress={onFund}
          variant="outline"
          style={styles.fundButton}
        />
      )}

      {goal.status === 'completed' && (
        <Text style={styles.completedText}>🎉 Goal Completed!</Text>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    marginVertical: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  icon: {
    fontSize: 24,
    marginRight: 12,
  },
  name: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  progressSection: {
    marginBottom: 16,
  },
  amount: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
  },
  percentage: {
    fontSize: 14,
    color: '#2E7D32',
    textAlign: 'right',
    marginTop: 4,
  },
  fundButton: {
    marginTop: 8,
  },
  completedText: {
    fontSize: 16,
    color: '#2E7D32',
    textAlign: 'center',
    fontWeight: '600',
  },
});
```
