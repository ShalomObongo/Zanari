import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

import { useAuthStore } from '@/store/authStore';
import PINEntryScreen from '@/screens/auth/PINEntryScreen';
import PINSetupScreen from '@/screens/auth/PINSetupScreen';
import KYCUploadScreen from '@/screens/kyc/KYCUploadScreen';
import { AuthNavigator } from './AuthNavigator';
import { MainNavigator } from './MainNavigator';

const Stack = createStackNavigator();

export type RootStackParamList = {
  Auth: undefined;
  PinSetup: undefined;
  PinEntry: undefined;
  KYC: { isOnboarding: boolean };
  Main: undefined;
};

const AppNavigator: React.FC = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const isPinSet = useAuthStore((state) => state.isPinSet);
  const isPinVerified = useAuthStore((state) => state.isPinVerified);

  // Check if KYC is required (not started or rejected)
  // We allow 'pending' to proceed to Main, or we could block it too depending on policy.
  // For now, we block 'not_started' and 'rejected'.
  const isKycRequired = user?.kyc_status === 'not_started' || user?.kyc_status === 'rejected';

  return (
    <Stack.Navigator 
      screenOptions={{ 
        headerShown: false,
        gestureEnabled: false, // Disable swipe gestures for security
        animation: 'default' // Use default animation instead of animationEnabled
      }}
    >
      {!isAuthenticated || !user ? (
        <Stack.Screen name="Auth" component={AuthNavigator} />
      ) : !isPinSet ? (
        <Stack.Screen name="PinSetup" component={PINSetupScreen} />
      ) : !isPinVerified ? (
        <Stack.Screen name="PinEntry" component={PINEntryScreen} />
      ) : isKycRequired ? (
        <Stack.Screen 
          name="KYC" 
          component={KYCUploadScreen} 
          initialParams={{ isOnboarding: true }}
        />
      ) : (
        <Stack.Screen name="Main" component={MainNavigator} />
      )}
    </Stack.Navigator>
  );
};

export default AppNavigator;