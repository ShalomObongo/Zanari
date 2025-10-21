import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuthStore } from '@/store/authStore';
import { AuthNavigator } from './AuthNavigator';
import { MainNavigator } from './MainNavigator';

const Stack = createStackNavigator();

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

const AppNavigator: React.FC = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);

  return (
    <Stack.Navigator 
      screenOptions={{ 
        headerShown: false,
        gestureEnabled: false, // Disable swipe gestures for security
        animation: 'default' // Use default animation instead of animationEnabled
      }}
    >
      {isAuthenticated && user ? (
        <Stack.Screen name="Main" component={MainNavigator} />
      ) : (
        <Stack.Screen name="Auth" component={AuthNavigator} />
      )}
    </Stack.Navigator>
  );
};

export default AppNavigator;