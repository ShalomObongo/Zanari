import { fireEvent, render } from '@testing-library/react-native';

import LoginScreen from '@/screens/auth/LoginScreen';

const mockSendLoginOtp = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    goBack: jest.fn(),
    navigate: jest.fn(),
  }),
}));

jest.mock('@/store/authStore', () => {
  const originalModule = jest.requireActual('@/store/authStore');
  return {
    ...originalModule,
    useAuthStore: (selector?: (state: { sendLoginOtp: typeof mockSendLoginOtp; isLoggingIn: boolean }) => unknown) => {
      const mockedState = {
        sendLoginOtp: mockSendLoginOtp,
        isLoggingIn: false,
      };
      return selector ? selector(mockedState) : mockedState;
    },
  };
});

describe('LoginScreen', () => {
  beforeEach(() => {
    mockSendLoginOtp.mockReset();
    mockSendLoginOtp.mockResolvedValue(undefined);
  });

  it('formats phone number with spaces as user types', () => {
    const { getByText, getByPlaceholderText } = render(<LoginScreen />);

    // Switch to phone method
    const phoneTab = getByText('Phone');
    fireEvent.press(phoneTab);

    const phoneInput = getByPlaceholderText('0712 345 678');
    fireEvent.changeText(phoneInput, '0712345678');

    // Check that the value is formatted with spaces
    expect(phoneInput.props.value).toBe('0712 345 678');
  });

  it('shows helper text when input is empty', () => {
    const { getByText } = render(<LoginScreen />);
    
    expect(getByText("We'll send you a verification code")).toBeTruthy();
  });

  it('switches between email and phone input modes', () => {
    const { getByText, getByPlaceholderText } = render(<LoginScreen />);

    // Should start with email
    expect(getByPlaceholderText('Enter your email')).toBeTruthy();

    // Switch to phone
    fireEvent.press(getByText('Phone'));
    expect(getByPlaceholderText('0712 345 678')).toBeTruthy();

    // Switch back to email
    fireEvent.press(getByText('Email'));
    expect(getByPlaceholderText('Enter your email')).toBeTruthy();
  });

  it('shows validation error for invalid email', () => {
    const { getByPlaceholderText, getByText } = render(<LoginScreen />);

    const emailInput = getByPlaceholderText('Enter your email');
    fireEvent.changeText(emailInput, 'invalidemail');

    expect(getByText('Invalid email format')).toBeTruthy();
  });

  it('clears input and validation when switching between modes', () => {
    const { getByText, getByPlaceholderText } = render(<LoginScreen />);

    // Enter email
    const emailInput = getByPlaceholderText('Enter your email');
    fireEvent.changeText(emailInput, 'test@example.com');

    // Switch to phone
    fireEvent.press(getByText('Phone'));
    
    // Input should be cleared
    const phoneInput = getByPlaceholderText('0712 345 678');
    expect(phoneInput.props.value).toBe('');
  });
});
