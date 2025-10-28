import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import EditProfileScreen from '@/screens/settings/EditProfileScreen';

const mockUpdateProfile = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    goBack: mockGoBack,
    navigate: jest.fn(),
  }),
}));

jest.mock('@/store/authStore', () => {
  const actual = jest.requireActual('@/store/authStore');
  const user = {
    id: 'user-123',
    email: 'sarah.test@zanari.app',
    phone: '254712345678',
    first_name: 'Sarah',
    last_name: 'Mutindi',
    kyc_status: 'not_started',
    status: 'active',
    notification_preferences: {
      push_enabled: true,
      email_enabled: true,
      transaction_alerts: true,
      savings_milestones: true,
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return {
    ...actual,
    useAuthStore: (selector?: (state: unknown) => unknown) => {
      const state = {
        user,
        updateProfile: mockUpdateProfile,
        isUpdatingProfile: false,
      };
      return selector ? selector(state) : state;
    },
  };
});

describe('EditProfileScreen', () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    mockUpdateProfile.mockReset();
    mockUpdateProfile.mockResolvedValue(undefined);
    mockGoBack.mockReset();
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  it('submits updated profile information', async () => {
    const { getByPlaceholderText, getByTestId } = render(<EditProfileScreen />);

    fireEvent.changeText(getByPlaceholderText('Enter your first name'), 'Alicia');
    fireEvent.changeText(getByPlaceholderText('Enter your last name'), 'Tester');
    fireEvent.changeText(getByPlaceholderText('Enter your email'), 'tester@zanari.app');
    fireEvent.changeText(getByPlaceholderText('2547XXXXXXXX'), '0798765432');

    const saveButton = getByTestId('edit-profile-save-button');
    fireEvent.press(saveButton);

    await waitFor(() => expect(mockUpdateProfile).toHaveBeenCalledTimes(1));

    expect(mockUpdateProfile).toHaveBeenCalledWith({
      firstName: 'Alicia',
      lastName: 'Tester',
      email: 'tester@zanari.app',
      phone: '254798765432',
    });
  });
});
