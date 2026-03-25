import { TextStyle } from 'react-native';
import { colors } from './colors';

const baseFont = 'System';

export const typography = {
  h1: {
    fontFamily: baseFont,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 0.4,
    color: colors.textPrimary,
  } as TextStyle,
  h2: {
    fontFamily: baseFont,
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: 0.2,
    color: colors.textPrimary,
  } as TextStyle,
  h3: {
    fontFamily: baseFont,
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.1,
    color: colors.textPrimary,
  } as TextStyle,
  body: {
    fontFamily: baseFont,
    fontSize: 14,
    fontWeight: '400',
    color: colors.textSecondary,
  } as TextStyle,
  caption: {
    fontFamily: baseFont,
    fontSize: 12,
    fontWeight: '400',
    color: colors.textSecondary,
  } as TextStyle,
};

