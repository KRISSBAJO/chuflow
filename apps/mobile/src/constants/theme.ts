/**
 * ChuFlow design tokens for the phone app: the website's look (white, warm gray, near-black ink,
 * flame accent) at a phone's scale, with readable text and light dividers.
 */

export const colors = {
  page: '#ffffff',
  surface: '#f7f6f3',
  surfaceStrong: '#efeee9',
  inset: '#ffffff',
  ink: '#151515',
  text: '#45433f',
  muted: '#625f59',
  faint: '#6c6962',
  hairline: 'rgba(17,17,17,0.07)',
  hairlineStrong: 'rgba(17,17,17,0.12)',
  flameFrom: '#f59e0b',
  flameTo: '#ea580c',
  flame: '#ea580c',
  flameSoft: '#fff4eb',
  success: '#047857',
  successBg: '#ecfdf5',
  warning: '#b45309',
  warningBg: '#fffbeb',
  danger: '#b91c1c',
  dangerBg: '#fef2f2',
  info: '#0369a1',
  infoBg: '#f0f9ff',
} as const;

export const flameGradient = [colors.flameFrom, colors.flameTo] as const;

export const fonts = {
  regular: 'Jost_400Regular',
  medium: 'Jost_500Medium',
  semibold: 'Jost_600SemiBold',
  bold: 'Jost_700Bold',
} as const;

/** One type scale for every screen. */
export const type = {
  display: { fontFamily: fonts.semibold, fontSize: 22, lineHeight: 27, letterSpacing: -0.6, color: colors.ink },
  title: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22, letterSpacing: -0.2, color: colors.ink },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.text },
  label: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 21, color: colors.ink },
  small: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 19, color: colors.muted },
  micro: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16, letterSpacing: 0.4, color: colors.faint },
  number: { fontFamily: fonts.semibold, fontSize: 20, lineHeight: 24, letterSpacing: -0.4, color: colors.ink },
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  page: 18,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const shadow = {
  soft: {
    shadowColor: '#111111',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  lifted: {
    shadowColor: '#111111',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
} as const;
