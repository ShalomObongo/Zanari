import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PaystackProvider } from 'react-native-paystack-webview';
import * as Font from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import 'react-native-url-polyfill/auto';

import AppNavigator from '@/navigation/AppNavigator';
import { PAYSTACK_CONFIG } from '@/config/paystack';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { StatusBarManager } from '@/components/StatusBarManager';

// Keep the splash screen visible while we load fonts
SplashScreen.preventAutoHideAsync();

export default function App() {
  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        // Load fonts
        await Font.loadAsync({
          Manrope_400Regular,
          Manrope_500Medium,
          Manrope_600SemiBold,
          Manrope_700Bold,
          Manrope_800ExtraBold,
        });
      } catch (e) {
        console.warn(e);
      } finally {
        setAppIsReady(true);
      }
    }

    prepare();
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (appIsReady) {
      await SplashScreen.hideAsync();
    }
  }, [appIsReady]);

  if (!appIsReady) {
    return null;
  }

  return (
    <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <SafeAreaProvider>
        <ThemeProvider>
          <StatusBarManager />
          <PaystackProvider publicKey={PAYSTACK_CONFIG.publicKey}>
            <NavigationContainer>
              <AppNavigator />
            </NavigationContainer>
          </PaystackProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </View>
  );
}