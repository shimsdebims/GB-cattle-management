import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { ApiError, milkAPI } from '../services/api';
import { currentMonth, isFutureMonth, monthLabel, shiftMonth } from '../utils/date';
import { colors, radius, spacing } from '../constants/theme';
import type { MonthlyGrid } from '../types';

// Column geometry for the scrollable table.
const COW_COL = 112;
const DAY_COL = 44;
const TOTAL_COL = 60;
const ROW_H = 38;
const HEADER_H = 44;
const FONT = 12;

/**
 * Cow rows × day columns, mirroring the farm's spreadsheet.
 * The grid is aggregated server-side; this screen only lays it out.
 */
const MonthlyReportScreen = () => {
  const [month, setMonth] = useState(currentMonth());
  const [grid, setGrid] = useState<MonthlyGrid | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setGrid(await milkAPI.monthlyGrid(month));
      setError(null);
    } catch (err) {
      setGrid(null);
      setError(
        err instanceof ApiError ? err.displayMessage : 'Could not load the report.'
      );
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    void load();
  }, [load]);

  const days = grid ? Array.from({ length: grid.days_in_month }, (_, i) => i + 1) : [];
  const nextMonth = shiftMonth(month, 1);
  const canGoForward = !isFutureMonth(nextMonth);

  return (
    <View style={styles.container}>
      {/* Month navigation */}
      <View style={styles.monthBar}>
        <TouchableOpacity
          onPress={() => setMonth(shiftMonth(month, -1))}
          accessibilityLabel="Previous month"
        >
          <MaterialIcons name="chevron-left" size={30} color={colors.primary} />
        </TouchableOpacity>

        <View style={styles.monthCenter}>
          <Text style={styles.monthLabel}>{monthLabel(month)}</Text>
          {grid && (
            <Text style={styles.monthSub}>
              {grid.cows.length} cow{grid.cows.length === 1 ? '' : 's'} ·{' '}
              {grid.grand_total.toFixed(1)} L
            </Text>
          )}
        </View>

        <TouchableOpacity
          onPress={() => canGoForward && setMonth(nextMonth)}
          disabled={!canGoForward}
          accessibilityLabel="Next month"
        >
          <MaterialIcons
            name="chevron-right"
            size={30}
            // Dimmed rather than hidden, so the control does not jump around.
            color={canGoForward ? colors.primary : colors.borderStrong}
          />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <MaterialIcons name="cloud-off" size={44} color={colors.borderStrong} />
          <Text style={styles.emptyText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={load}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : !grid || grid.cows.length === 0 ? (
        <View style={styles.centered}>
          <MaterialIcons name="event-note" size={44} color={colors.borderStrong} />
          <Text style={styles.emptyText}>No milk records for {monthLabel(month)}.</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View>
              {/* Header */}
              <View style={[styles.row, styles.headerRow]}>
                <View style={[styles.cell, styles.cowCell]}>
                  <Text style={styles.headerText}>Cow</Text>
                </View>
                {days.map((day) => (
                  <View key={day} style={[styles.cell, styles.dayCell]}>
                    <Text style={styles.headerText}>{day}</Text>
                  </View>
                ))}
                <View style={[styles.cell, styles.totalCell]}>
                  <Text style={styles.headerText}>Total</Text>
                </View>
                <View style={[styles.cell, styles.totalCell]}>
                  <Text style={styles.headerText}>Avg</Text>
                </View>
              </View>

              {/* Cow rows */}
              {grid.cows.map((cow, index) => (
                <View
                  key={cow.cattle_id}
                  style={[styles.row, index % 2 === 1 && styles.rowAlt]}
                >
                  <View style={[styles.cell, styles.cowCell]}>
                    <Text style={styles.cowName} numberOfLines={1}>
                      {cow.name}
                    </Text>
                    <Text style={styles.cowTag}>#{cow.tag}</Text>
                  </View>

                  {cow.daily.map((value, dayIndex) => (
                    <View key={dayIndex} style={[styles.cell, styles.dayCell]}>
                      <Text style={[styles.cellText, value === 0 && styles.cellZero]}>
                        {value > 0 ? value.toFixed(1) : '—'}
                      </Text>
                    </View>
                  ))}

                  <View style={[styles.cell, styles.totalCell, styles.totalHighlight]}>
                    <Text style={styles.totalText}>{cow.total.toFixed(1)}</Text>
                  </View>
                  <View style={[styles.cell, styles.totalCell]}>
                    <Text style={styles.cellText}>{cow.average.toFixed(1)}</Text>
                  </View>
                </View>
              ))}

              {/* Daily totals */}
              <View style={[styles.row, styles.totalsRow]}>
                <View style={[styles.cell, styles.cowCell]}>
                  <Text style={styles.totalsLabel}>Daily total</Text>
                </View>
                {grid.daily_totals.map((value, index) => (
                  <View key={index} style={[styles.cell, styles.dayCell]}>
                    <Text style={styles.totalsText}>
                      {value > 0 ? value.toFixed(1) : '—'}
                    </Text>
                  </View>
                ))}
                <View style={[styles.cell, styles.totalCell, styles.grandTotalCell]}>
                  <Text style={styles.grandTotalText}>{grid.grand_total.toFixed(1)}</Text>
                </View>
                <View style={[styles.cell, styles.totalCell]}>
                  <Text style={styles.totalsText}>
                    {(grid.grand_total / grid.days_in_month).toFixed(1)}
                  </Text>
                </View>
              </View>
            </View>
          </ScrollView>

          <View style={styles.legend}>
            <Text style={styles.legendText}>
              Values in litres. "—" means no record that day.
            </Text>
            <Text style={styles.legendText}>
              Per-cow average counts only days with a record; the daily-total average
              uses all {grid.days_in_month} days.
            </Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  emptyText: {
    color: colors.textDisabled,
    fontSize: 15,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  retryButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.header,
  },
  retryText: { color: colors.primary, fontWeight: '600' },

  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    paddingTop: 52,
    backgroundColor: colors.header,
    borderBottomColor: colors.borderStrong,
    borderBottomWidth: 1,
  },
  monthCenter: { alignItems: 'center' },
  monthLabel: { fontSize: 16, fontWeight: '700', color: colors.text },
  monthSub: { fontSize: 12, color: colors.textFaint, marginTop: 2 },

  row: {
    flexDirection: 'row',
    height: ROW_H,
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    backgroundColor: colors.background,
  },
  rowAlt: { backgroundColor: colors.surfaceAlt },
  headerRow: {
    backgroundColor: colors.header,
    height: HEADER_H,
    borderBottomColor: colors.primary,
  },
  totalsRow: {
    backgroundColor: colors.surface,
    borderTopColor: colors.primary,
    borderTopWidth: 1,
    borderBottomWidth: 0,
  },

  cell: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 2 },
  cowCell: {
    width: COW_COL,
    alignItems: 'flex-start',
    paddingHorizontal: spacing.sm,
    borderRightColor: colors.border,
    borderRightWidth: 1,
  },
  dayCell: { width: DAY_COL, borderRightColor: colors.surface, borderRightWidth: 1 },
  totalCell: { width: TOTAL_COL, borderLeftColor: colors.border, borderLeftWidth: 1 },
  totalHighlight: { backgroundColor: '#0D2030' },
  grandTotalCell: { backgroundColor: colors.header },

  headerText: {
    color: colors.primary,
    fontSize: FONT,
    fontWeight: '700',
    textAlign: 'center',
  },
  cellText: { color: colors.textMuted, fontSize: FONT, textAlign: 'center' },
  cellZero: { color: colors.borderStrong },
  cowName: { color: colors.text, fontSize: FONT, fontWeight: '600' },
  cowTag: { color: colors.textFaint, fontSize: 10 },
  totalText: { color: colors.primary, fontSize: FONT, fontWeight: '700' },
  totalsLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },
  totalsText: {
    color: colors.text,
    fontSize: FONT,
    fontWeight: '600',
    textAlign: 'center',
  },
  grandTotalText: { color: colors.primary, fontSize: FONT, fontWeight: '700' },

  legend: {
    padding: spacing.lg,
    gap: spacing.xs,
    borderTopColor: colors.border,
    borderTopWidth: 1,
  },
  legendText: { color: colors.textDisabled, fontSize: 12 },
});

export default MonthlyReportScreen;
