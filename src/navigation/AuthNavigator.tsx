import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useTheme } from '@/contexts/ThemeContext';

// Auth screens
import WelcomeScreen from '@/screens/auth/WelcomeScreen';
import SignupScreen from '@/screens/auth/SignupScreen';
import LoginScreen from '@/screens/auth/LoginScreen';
import OTPScreen from '@/screens/auth/OTPScreen';
import PINSetupScreen from '@/screens/auth/PINSetupScreen';
import PINEntryScreen from '@/screens/auth/PINEntryScreen';
import KYCUploadScreen from '@/screens/kyc/KYCUploadScreen';

const Stack = createStackNavigator();

export type AuthStackParamList = {
  Welcome: undefined;
  Signup: undefined;
  Login: undefined;
  OTP: {
    method: 'email' | 'phone';
    identifier: string;
  };
  PINSetup: {
    phoneNumber?: string;
  } | undefined;
  PINEntry: {
    returnScreen?: keyof AuthStackParamList;
  } | undefined;
  KYCUpload: {
    isOnboarding: boolean;
  };
};

export const AuthNavigator: React.FC = () => {
  const { theme } = useTheme();

  return (
    <Stack.Navigator
      initialRouteName="Welcome"
      screenOptions={{
        headerShown: false,
        gestureEnabled: false, // Security: prevent gesture-based navigation
        cardStyle: { backgroundColor: theme.colors.surface },
      }}
    >
      <Stack.Screen 
        name="Welcome" 
        component={WelcomeScreen}
        options={{
          animation: 'none', // No animation on initial screen
        }}
      />
      <Stack.Screen 
        name="Signup" 
        component={SignupScreen}
        options={{
          title: 'Create Account',
        }}
      />
      <Stack.Screen 
        name="Login" 
        component={LoginScreen}
        options={{
          title: 'Sign In',
        }}
      />
      <Stack.Screen 
        name="OTP" 
        component={OTPScreen}
        options={{
          title: 'Verify Code',
          gestureEnabled: false, // Prevent going back during OTP verification
        }}
      />
      <Stack.Screen 
        name="PINSetup" 
        component={PINSetupScreen}
        options={{
          title: 'Set Up PIN',
          gestureEnabled: false, // Must complete PIN setup
        }}
      />
      <Stack.Screen 
        name="PINEntry" 
        component={PINEntryScreen}
        options={{
          title: 'Enter PIN',
          gestureEnabled: false, // Security: must enter PIN
        }}
      />
      <Stack.Screen 
        name="KYCUpload" 
        component={KYCUploadScreen}
        options={{
          title: 'Verify Identity',
          gestureEnabled: false, // Must complete KYC
        }}
      />
    </Stack.Navigator>
  );
};
