import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PaystackProvider } from 'react-native-paystack-webview';
import 'react-native-url-polyfill/auto';

import AppNavigator from '@/navigation/AppNavigator';
import { PAYSTACK_CONFIG } from '@/config/paystack';

export default function App() {
  return (
    <SafeAreaProvider>
      <PaystackProvider publicKey={PAYSTACK_CONFIG.publicKey}>
        <NavigationContainer>
          <AppNavigator />
          <StatusBar style="auto" />
        </NavigationContainer>
      </PaystackProvider>
    </SafeAreaProvider>
  );
}