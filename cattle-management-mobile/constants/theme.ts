/**
 * Design tokens, extracted from the colours already used across the screens so
 * they are defined once instead of repeated as literals in every StyleSheet.
 */

export const colors = {
  background: '#0A1A23',
  surface: '#1E2A35',
  surfaceAlt: '#111E28',
  header: '#00374A',
  border: '#2A3A47',
  borderStrong: '#394F56',

  primary: '#00ED64',
  text: '#FFFFFF',
  textMuted: '#C1C7CD',
  textFaint: '#8A9AA4',
  textDisabled: '#5A6A74',

  success: '#4CAF50',
  danger: '#F44336',
  warning: '#FF9800',
  info: '#2196F3',
  cyan: '#00BCD4',
  purple: '#9C27B0',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

export const radius = {
  sm: 8,
  md: 10,
  lg: 12,
  pill: 16,
} as const;

/** Status → colour maps used by badges in more than one screen. */
export const statusColor: Record<string, string> = {
  Active: colors.success,
  Sold: colors.info,
  Deceased: colors.danger,
  Quarantined: colors.warning,
};

export const healthColor: Record<string, string> = {
  Healthy: colors.success,
  Sick: colors.danger,
  Injured: colors.warning,
  Pregnant: colors.info,
  Recovering: colors.purple,
};
