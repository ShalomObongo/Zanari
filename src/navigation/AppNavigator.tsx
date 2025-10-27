import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

import { useAuthStore } from '@/store/authStore';
import PINEntryScreen from '@/screens/auth/PINEntryScreen';
import PINSetupScreen from '@/screens/auth/PINSetupScreen';
import { AuthNavigator } from './AuthNavigator';
import { MainNavigator } from './MainNavigator';

const Stack = createStackNavigator();

export type RootStackParamList = {
  Auth: undefined;
  PinSetup: undefined;
  PinEntry: undefined;
  Main: undefined;
};

const AppNavigator: React.FC = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const isPinSet = useAuthStore((state) => state.isPinSet);
  const isPinVerified = useAuthStore((state) => state.isPinVerified);

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
      ) : (
        <Stack.Screen name="Main" component={MainNavigator} />
      )}
    </Stack.Navigator>
  );
};

export default AppNavigator;