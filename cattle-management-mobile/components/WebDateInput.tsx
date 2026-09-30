import React from 'react';

import { colors, radius, spacing } from '../constants/theme';

/**
 * The browser's own date field, for the web build only.
 *
 * `@react-native-community/datetimepicker` has no web implementation, so on
 * the iPhone (which runs the web build) the picker never opened. A native
 * `<input type="date">` opens the iOS date wheel in Safari and speaks the same
 * "YYYY-MM-DD" the API expects.
 */
interface Props {
  value: string;
  onChange: (value: string) => void;
  /** Latest selectable day, "YYYY-MM-DD". */
  max?: string;
  accessibilityLabel?: string;
}

const WebDateInput = ({ value, onChange, max, accessibilityLabel }: Props) =>
  React.createElement('input', {
    type: 'date',
    value,
    max,
    'aria-label': accessibilityLabel,
    onChange: (event: { target: { value: string } }) => onChange(event.target.value),
    style: {
      backgroundColor: colors.surface,
      color: colors.text,
      border: `1px solid ${colors.border}`,
      borderRadius: radius.sm,
      padding: spacing.md,
      // 16px stops iOS Safari zooming the page when the field is focused.
      fontSize: 16,
      fontFamily: 'inherit',
      width: '100%',
      boxSizing: 'border-box',
      colorScheme: 'dark',
    },
  });

export default WebDateInput;
