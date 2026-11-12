/**
 * Stand-in for @react-navigation/native in screen tests:
 *
 *   jest.mock('@react-navigation/native', () => require('../helpers/navigationMock'));
 *   import { navigation, setRoute } from '../helpers/navigationMock';
 *   setRoute({ workoutId: 3 });
 *
 * `navigation` records navigate/goBack/reset…; `setRoute` sets the params the
 * screen reads with useRoute(). Call `resetNavigation()` in beforeEach.
 */
import { useEffect } from 'react';
import { jest } from '@jest/globals';

export const navigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  reset: jest.fn(),
  replace: jest.fn(),
  setOptions: jest.fn(),
  canGoBack: jest.fn(() => true),
  addListener: jest.fn(() => () => {}),
};

let route: { name: string; params: Record<string, unknown> | undefined } = { name: 'Screen', params: undefined };

export function setRoute(params?: Record<string, unknown>, name = 'Screen') {
  route = { name, params };
}

export function resetNavigation() {
  Object.values(navigation).forEach((fn) => (fn as jest.Mock).mockClear());
  setRoute(undefined);
}

export const useNavigation = () => navigation;
export const useRoute = () => route;
export const useIsFocused = () => true;
/** Runs the effect once on mount, like a screen gaining focus. */
export const useFocusEffect = (effect: () => void | (() => void)) => {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(effect, []);
};
export const CommonActions = { reset: (state: unknown) => ({ type: 'RESET', payload: state }) };
