import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../theme/theme';

// Small inline action (Like, Reply, Report...) used under comments and reviews.
export default function ActionLink({ icon, label, onPress, active = false, danger = false, accessibilityLabel, disabled }) {
  const fg = danger ? colors.coralDark : active ? colors.coralDark : colors.textSecondary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ selected: active, disabled: Boolean(disabled) }}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }, disabled && { opacity: 0.45 }]}
    >
      {icon ? <Ionicons name={icon} size={15} color={fg} /> : null}
      {label ? <Text style={[styles.label, { color: fg }]}>{label}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginRight: spacing.lg, paddingVertical: 4 },
  label: { ...typography.caption, fontWeight: '700', marginLeft: 4 },
});
