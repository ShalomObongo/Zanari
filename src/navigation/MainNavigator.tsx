import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/MaterialIcons';

// Main app screens
import DashboardScreen from '@/screens/main/DashboardScreen';
import PaymentScreen from '@/screens/payments/PaymentScreen';
import TransferScreen from '@/screens/payments/TransferScreen';
import TransactionHistoryScreen from '@/screens/transactions/TransactionHistoryScreen';
import TransactionDetailsScreen from '@/screens/transactions/TransactionDetailsScreen';
import SavingsGoalsScreen from '@/screens/savings/SavingsGoalsScreen';
import SettingsScreen from '@/screens/settings/SettingsScreen';
import ChangePINScreen from '@/screens/settings/ChangePINScreen';
import EditProfileScreen from '@/screens/settings/EditProfileScreen';
import RoundUpSettingsScreen from '@/screens/settings/RoundUpSettingsScreen';
import KYCUploadScreen from '@/screens/kyc/KYCUploadScreen';
import SavingsInsightsScreen from '@/screens/savings/SavingsInsightsScreen';
import { GlassmorphismTabBar } from '@/components/GlassmorphismTabBar';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

export type MainTabParamList = {
  Dashboard: undefined;
  Payments: undefined;
  History: undefined;
  Savings: undefined;
  Settings: undefined;
};

export type MainStackParamList = {
  MainTabs: undefined;
  Payment: undefined;
  Transfer: undefined;
  TransactionDetails: { transactionId: string };
  InvestmentHistory: undefined;
  KYCUpload: undefined;
  ChangePIN: undefined;
  EditProfile: undefined;
  RoundUpSettings: undefined;
  SavingsInsights: undefined;
} & MainTabParamList;

const MainTabs: React.FC = () => {
  return (
    <Tab.Navigator
      tabBar={(props) => <GlassmorphismTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => (
            <Icon name="home" size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="History"
        component={TransactionHistoryScreen}
        options={{
          title: 'Transactions',
          tabBarIcon: ({ color }) => (
            <Icon name="swap-horiz" size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Payments"
        component={PaymentScreen}
        options={{
          title: 'Payments',
          tabBarIcon: ({ color }) => (
            <Icon name="payment" size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Savings"
        component={SavingsGoalsScreen}
        options={{
          title: 'Savings',
          tabBarIcon: ({ color }) => (
            <Icon name="account-balance-wallet" size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => (
            <Icon name="settings" size={24} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

export const MainNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false, // Hide headers by default, let screens manage their own
      }}
    >
      <Stack.Screen
        name="MainTabs"
        component={MainTabs}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Payment"
        component={PaymentScreen}
        options={{
          headerShown: false,
          presentation: 'modal', // Present as modal for payment flow
        }}
      />
      <Stack.Screen
        name="Transfer"
        component={TransferScreen}
        options={{
          headerShown: false,
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="KYCUpload"
        component={KYCUploadScreen}
        options={{
          headerShown: false,
          gestureEnabled: false, // Prevent dismissing KYC flow
        }}
      />
      <Stack.Screen
        name="TransactionDetails"
        component={TransactionDetailsScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="ChangePIN"
        component={ChangePINScreen}
        options={{
          headerShown: false,
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{
          headerShown: false,
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="RoundUpSettings"
        component={RoundUpSettingsScreen}
        options={{
          headerShown: false,
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="SavingsInsights"
        component={SavingsInsightsScreen}
        options={{
          headerShown: false,
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="InvestmentHistory"
        component={require('@/screens/savings/InvestmentHistoryScreen').default}
        options={{
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
};
