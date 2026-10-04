jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../src/store/gameStore', () => ({ useGameStore: jest.fn() }));
jest.mock('../src/hooks/useTheme', () => ({ useTheme: jest.fn() }));

import { render, screen } from '@testing-library/react-native';
import { PersistenceErrorBanner } from '../src/components/PersistenceErrorBanner';
import { useGameStore } from '../src/store/gameStore';
import { useTheme } from '../src/hooks/useTheme';
import { lightTheme } from '../src/config/theme';

describe('PersistenceErrorBanner', () => {
  beforeEach(() => {
    (useTheme as jest.Mock).mockReturnValue({
      theme: lightTheme,
      themeMode: 'light',
      isDark: false,
    });
  });

  it('renders a banner when saveError is true', () => {
    (useGameStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector({ saveError: true, loadFailed: false })
    );

    render(<PersistenceErrorBanner />);

    expect(screen.getByText(/Progress isn'?t being saved/)).toBeTruthy();
  });

  it('renders nothing when saveError and loadFailed are false', () => {
    (useGameStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector({ saveError: false, loadFailed: false })
    );

    render(<PersistenceErrorBanner />);

    expect(screen.queryByText(/Progress isn'?t being saved/)).toBeNull();
  });

  it('explains that the saved game could not be loaded when loadFailed is true', () => {
    (useGameStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector({ saveError: false, loadFailed: true })
    );

    render(<PersistenceErrorBanner />);

    expect(screen.getByText(/Couldn't load your saved game/)).toBeTruthy();
    expect(screen.getByLabelText(/Progress isn't being saved/)).toBeTruthy();
  });
});
