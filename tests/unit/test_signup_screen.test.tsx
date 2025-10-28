import { fireEvent, render } from '@testing-library/react-native';

import SignupScreen from '@/screens/auth/SignupScreen';

const mockRegister = jest.fn();

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
    useAuthStore: (selector?: (state: { register: typeof mockRegister; isRegistering: boolean }) => unknown) => {
      const mockedState = {
        register: mockRegister,
        isRegistering: false,
      };
      return selector ? selector(mockedState) : mockedState;
    },
  };
});

describe('SignupScreen', () => {
  beforeEach(() => {
    mockRegister.mockReset();
    mockRegister.mockResolvedValue(undefined);
  });

  it('labels the phone number field as required', () => {
    const { getByText, queryByText } = render(<SignupScreen />);

    expect(getByText('Phone Number')).toBeTruthy();
    expect(queryByText('(Optional)')).toBeNull();
  });

  it('keeps the submit button disabled until a valid Kenyan phone number is provided', () => {
    const { getByPlaceholderText, getByTestId } = render(<SignupScreen />);

    const submitButton = getByTestId('signup-submit-button');
    expect(submitButton).toBeDisabled();

    fireEvent.changeText(getByPlaceholderText('Enter your first name'), 'Alicia');
    fireEvent.changeText(getByPlaceholderText('Enter your last name'), 'Tester');
    fireEvent.changeText(getByPlaceholderText('Enter your email'), 'tester@zanari.app');

    const termsToggle = getByTestId('signup-terms-toggle');
    fireEvent.press(termsToggle);

    const phoneField = getByPlaceholderText('Enter your phone number');
    fireEvent.changeText(phoneField, '07123');
    expect(submitButton).toBeDisabled();

    fireEvent.changeText(phoneField, '0712345678');
    expect(submitButton).not.toBeDisabled();
  });
});
