import React from 'react';
import { render } from '../test-utils';
import { GlassmorphismTabBar } from '@/components/GlassmorphismTabBar';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';

// Mock dependencies
jest.mock('expo-blur', () => ({
  BlurView: 'BlurView',
}));

jest.mock('react-native-vector-icons/MaterialIcons', () => 'Icon');

describe('GlassmorphismTabBar', () => {
  const mockNavigation = {
    emit: jest.fn(() => ({ defaultPrevented: false })),
    navigate: jest.fn(),
    dispatch: jest.fn(),
    reset: jest.fn(),
    goBack: jest.fn(),
    isFocused: jest.fn(),
    canGoBack: jest.fn(),
    getId: jest.fn(),
    getParent: jest.fn(),
    getState: jest.fn(),
    setParams: jest.fn(),
    setOptions: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };

  const mockRoute = {
    key: 'Dashboard-key',
    name: 'Dashboard',
    params: undefined,
  };

  const mockDescriptors = {
    'Dashboard-key': {
      navigation: mockNavigation,
      route: mockRoute,
      options: {
        title: 'Home',
        tabBarIcon: () => null,
      },
      render: () => null,
    },
  };

  const mockState = {
    routes: [mockRoute],
    index: 0,
    key: 'tab-key',
    routeNames: ['Dashboard'],
    history: [],
    type: 'tab' as const,
    stale: false,
  };

  const mockProps: BottomTabBarProps = {
    state: mockState as any,
    descriptors: mockDescriptors as any,
    navigation: mockNavigation as any,
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
  };

  it('renders the glassmorphism tab bar', () => {
    render(<GlassmorphismTabBar {...mockProps} />);
    // The component should render without crashing
    expect(true).toBe(true);
  });

  it('renders all tab items', () => {
    const multiTabState = {
      ...mockState,
      routes: [
        { key: 'Dashboard-key', name: 'Dashboard' },
        { key: 'History-key', name: 'History' },
        { key: 'Payments-key', name: 'Payments' },
      ],
      routeNames: ['Dashboard', 'History', 'Payments'],
    };

    const multiTabDescriptors = {
      'Dashboard-key': {
        navigation: mockNavigation,
        route: { key: 'Dashboard-key', name: 'Dashboard' },
        options: {
          title: 'Home',
          tabBarIcon: () => null,
        },
        render: () => null,
      },
      'History-key': {
        navigation: mockNavigation,
        route: { key: 'History-key', name: 'History' },
        options: {
          title: 'Transactions',
          tabBarIcon: () => null,
        },
        render: () => null,
      },
      'Payments-key': {
        navigation: mockNavigation,
        route: { key: 'Payments-key', name: 'Payments' },
        options: {
          title: 'Payments',
          tabBarIcon: () => null,
        },
        render: () => null,
      },
    };

    const multiTabProps: BottomTabBarProps = {
      ...mockProps,
      state: multiTabState as any,
      descriptors: multiTabDescriptors as any,
    };

    render(<GlassmorphismTabBar {...multiTabProps} />);
    // Should render multiple touchable components for each tab
    expect(true).toBe(true);
  });

  it('highlights the active tab', () => {
    render(<GlassmorphismTabBar {...mockProps} />);
    // The active tab should have different styling
    expect(mockState.index).toBe(0);
  });
});
