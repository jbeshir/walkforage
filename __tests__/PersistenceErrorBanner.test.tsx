jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../src/hooks/useGameState', () => ({ useGameState: jest.fn() }));
jest.mock('../src/hooks/useTheme', () => ({ useTheme: jest.fn() }));

import { render, screen } from '@testing-library/react-native';
import { PersistenceErrorBanner } from '../src/components/PersistenceErrorBanner';
import { useGameState } from '../src/hooks/useGameState';
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
    (useGameState as jest.Mock).mockReturnValue({ saveError: true });

    render(<PersistenceErrorBanner />);

    expect(screen.getByText(/Progress isn'?t being saved/)).toBeTruthy();
  });

  it('renders nothing when saveError is false', () => {
    (useGameState as jest.Mock).mockReturnValue({ saveError: false });

    render(<PersistenceErrorBanner />);

    expect(screen.queryByText(/Progress isn'?t being saved/)).toBeNull();
  });
});
