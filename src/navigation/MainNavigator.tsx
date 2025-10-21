import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/MaterialIcons';

// Main app screens
import DashboardScreen from '@/screens/main/DashboardScreen';
import PaymentScreen from '@/screens/payments/PaymentScreen';
import TransferScreen from '@/screens/payments/TransferScreen';
import TransactionHistoryScreen from '@/screens/transactions/TransactionHistoryScreen';
import SavingsGoalsScreen from '@/screens/savings/SavingsGoalsScreen';
import SettingsScreen from '@/screens/settings/SettingsScreen';
import KYCUploadScreen from '@/screens/kyc/KYCUploadScreen';

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
  KYCUpload: undefined;
} & MainTabParamList;

const MainTabs: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#2196F3',
        tabBarInactiveTintColor: '#757575',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#e0e0e0',
          paddingBottom: 8,
          paddingTop: 8,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Icon name="dashboard" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Payments"
        component={PaymentScreen}
        options={{
          title: 'Pay',
          tabBarIcon: ({ color, size }) => (
            <Icon name="payment" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="History"
        component={TransactionHistoryScreen}
        options={{
          title: 'History',
          tabBarIcon: ({ color, size }) => (
            <Icon name="history" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Savings"
        component={SavingsGoalsScreen}
        options={{
          title: 'Savings',
          tabBarIcon: ({ color, size }) => (
            <Icon name="savings" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <Icon name="settings" size={size} color={color} />
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
        headerStyle: {
          backgroundColor: '#2196F3',
        },
        headerTintColor: '#ffffff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
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
          title: 'Make Payment',
          presentation: 'modal', // Present as modal for payment flow
        }}
      />
      <Stack.Screen
        name="Transfer"
        component={TransferScreen}
        options={{
          title: 'Send Money',
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="KYCUpload"
        component={KYCUploadScreen}
        options={{
          title: 'Identity Verification',
          gestureEnabled: false, // Prevent dismissing KYC flow
        }}
      />
    </Stack.Navigator>
  );
};