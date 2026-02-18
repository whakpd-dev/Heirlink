/**
 * HeirLink Design System — 2026
 * Светлая и тёмная темы
 */

export const colorsLight = {
  background: '#FAFAFA',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  border: 'rgba(0,0,0,0.06)',
  borderStrong: 'rgba(0,0,0,0.12)',

  text: '#1A1A1A',
  textSecondary: '#737373',
  textTertiary: '#A3A3A3',

  primary: '#0F766E',
  primaryLight: '#14B8A6',
  accent: '#F59E0B',

  like: '#EF4444',
  likeMuted: 'rgba(239, 68, 68, 0.15)',

  storyGradient: ['#F59E0B', '#EF4444', '#EC4899'],
  storyRing: 'rgba(15, 118, 110, 0.3)',

  shadow: 'rgba(0, 0, 0, 0.06)',
  shadowStrong: 'rgba(0, 0, 0, 0.1)',
};

export const colorsDark = {
  background: '#0F0F0F',
  surface: '#1A1A1A',
  surfaceElevated: '#262626',
  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.15)',

  text: '#FAFAFA',
  textSecondary: '#A3A3A3',
  textTertiary: '#737373',

  primary: '#14B8A6',
  primaryLight: '#2DD4BF',
  accent: '#F59E0B',

  like: '#EF4444',
  likeMuted: 'rgba(239, 68, 68, 0.2)',

  storyGradient: ['#F59E0B', '#EF4444', '#EC4899'],
  storyRing: 'rgba(20, 184, 166, 0.4)',

  shadow: 'rgba(0, 0, 0, 0.3)',
  shadowStrong: 'rgba(0, 0, 0, 0.5)',
};

/** По умолчанию — светлая тема (для обратной совместимости) */
export const colors = colorsLight;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const typography = {
  title: {
    fontSize: 22,
    fontWeight: '700' as const,
    letterSpacing: -0.3,
  },
  body: {
    fontSize: 15,
    fontWeight: '400' as const,
    lineHeight: 22,
  },
  bodyBold: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
  caption: {
    fontSize: 13,
    fontWeight: '400' as const,
    lineHeight: 18,
  },
  captionMuted: {
    fontSize: 12,
    fontWeight: '400' as const,
  },
  label: {
    fontSize: 11,
    fontWeight: '500' as const,
  },
};
