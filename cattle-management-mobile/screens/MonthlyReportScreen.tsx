import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { ApiError, feedingAPI, milkAPI } from '../services/api';
import { currentMonth, isFutureMonth, monthLabel, shiftMonth } from '../utils/date';
import { formatCurrency } from '../utils/formatCurrency';
import { colors, radius, spacing } from '../constants/theme';
import type { FeedGrid, MonthlyGrid } from '../types';

// Column geometry for the scrollable table.
const COW_COL = 112;
const DAY_COL = 44;
const TOTAL_COL = 60;
const ROW_H = 38;
const HEADER_H = 44;
const FONT = 12;

type Sheet = 'milk' | 'feed';
type FeedUnit = 'kg' | 'fbu';

/** One shape for both sheets, so the table is drawn once. */
interface Table {
  rows: { id: string; name: string; tag: string; daily: (number | null)[]; total: number; average: number }[];
  dailyTotals: (number | null)[];
  grandTotal: number;
  daysInMonth: number;
  format: (value: number) => string;
  subtitle: string;
  legend: string[];
}

/** Fits FBu into a 44px cell: 800, 6k, 7.5k, 13k, 1.2M. */
export function compactFbu(value: number): string {
  const v = Math.round(value);
  if (Math.abs(v) < 1000) return String(v);
  if (Math.abs(v) < 1_000_000) return `${+(v / 1000).toFixed(v < 10_000 ? 1 : 0)}k`;
  return `${+(v / 1_000_000).toFixed(1)}M`;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function milkTable(grid: MonthlyGrid): Table {
  return {
    rows: grid.cows.map((c) => ({ id: c.cattle_id, name: c.name, tag: c.tag, daily: c.daily, total: c.total, average: c.average })),
    dailyTotals: grid.daily_totals,
    grandTotal: grid.grand_total,
    daysInMonth: grid.days_in_month,
    format: (v) => v.toFixed(1),
    subtitle: `${plural(grid.cows.length, 'cow')} · ${grid.grand_total.toFixed(1)} L`,
    legend: [
      'Values in litres. "—" means no record that day.',
      `Per-cow average counts only days with a record; the daily-total average uses all ${grid.days_in_month} days.`,
    ],
  };
}

function feedTable(grid: FeedGrid, unit: FeedUnit): Table {
  const kg = unit === 'kg';
  return {
    rows: grid.cows.map((c) => ({
      id: c.cattle_id,
      name: c.name,
      tag: c.tag,
      daily: kg ? c.daily_kg : c.daily_cost,
      total: kg ? c.total_kg : c.total_cost,
      average: kg ? c.average_kg : c.fed_days > 0 ? c.total_cost / c.fed_days : 0,
    })),
    dailyTotals: kg ? grid.daily_totals_kg : grid.daily_totals_cost,
    grandTotal: kg ? grid.grand_total_kg : grid.grand_total_cost,
    daysInMonth: grid.days_in_month,
    format: kg ? (v) => v.toFixed(1) : compactFbu,
    subtitle: `${plural(grid.cows.length, 'cow')} · ${grid.grand_total_kg.toFixed(1)} kg · ${formatCurrency(grid.grand_total_cost)}`,
    legend: [
      kg
        ? 'Values in kg of feed. "—" means nothing recorded that day.'
        : 'Values in FBu (6k = 6,000 FBu). Feed entered without a price counts as 0.',
      'Row total = that cow for the month. Bottom row = all cows that day.',
      `Per-cow average counts only days it was fed; the daily-total average uses all ${grid.days_in_month} days.`,
    ],
  };
}

/**
 * Cow rows × day columns, mirroring the farm's spreadsheet, for milk or feed.
 * The grids are aggregated server-side; this screen only lays them out.
 */
const MonthlyReportScreen = () => {
  const [month, setMonth] = useState(currentMonth());
  const [sheet, setSheet] = useState<Sheet>('milk');
  const [unit, setUnit] = useState<FeedUnit>('kg');
  const [milkGrid, setMilkGrid] = useState<MonthlyGrid | null>(null);
  const [feedGrid, setFeedGrid] = useState<FeedGrid | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (sheet === 'milk') {
        setMilkGrid(await milkAPI.monthlyGrid(month));
      } else {
        setFeedGrid(await feedingAPI.monthlyGrid(month));
      }
      setError(null);
    } catch (err) {
      if (sheet === 'milk') setMilkGrid(null);
      else setFeedGrid(null);
      setError(err instanceof ApiError ? err.displayMessage : 'Could not load the report.');
    } finally {
      setLoading(false);
    }
  }, [month, sheet]);

  useEffect(() => {
    void load();
  }, [load]);

  const table = useMemo<Table | null>(() => {
    if (sheet === 'milk') return milkGrid && milkGrid.month === month ? milkTable(milkGrid) : null;
    return feedGrid && feedGrid.month === month ? feedTable(feedGrid, unit) : null;
  }, [sheet, unit, month, milkGrid, feedGrid]);

  const days = table ? Array.from({ length: table.daysInMonth }, (_, i) => i + 1) : [];
  const nextMonth = shiftMonth(month, 1);
  const canGoForward = !isFutureMonth(nextMonth);
  const emptyText = sheet === 'milk' ? 'No milk records' : 'No feeding records';

  const Toggle = <T extends string>({
    options,
    value,
    onChange,
  }: {
    options: { key: T; label: string }[];
    value: T;
    onChange: (key: T) => void;
  }) => (
    <View style={styles.toggle}>
      {options.map((o) => (
        <TouchableOpacity
          key={o.key}
          style={[styles.toggleItem, value === o.key && styles.toggleItemActive]}
          onPress={() => onChange(o.key)}
          accessibilityRole="button"
          accessibilityState={{ selected: value === o.key }}
        >
          <Text style={[styles.toggleText, value === o.key && styles.toggleTextActive]}>
            {o.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

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
          {table && <Text style={styles.monthSub}>{table.subtitle}</Text>}
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

      <View style={styles.toggleBar}>
        <Toggle
          options={[
            { key: 'milk', label: 'Milk' },
            { key: 'feed', label: 'Feed' },
          ]}
          value={sheet}
          onChange={setSheet}
        />
        {sheet === 'feed' && (
          <Toggle
            options={[
              { key: 'kg', label: 'kg' },
              { key: 'fbu', label: 'FBu' },
            ]}
            value={unit}
            onChange={setUnit}
          />
        )}
      </View>

      {loading && !table ? (
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
      ) : !table || table.rows.length === 0 ? (
        <View style={styles.centered}>
          <MaterialIcons name="event-note" size={44} color={colors.borderStrong} />
          <Text style={styles.emptyText}>
            {emptyText} for {monthLabel(month)}.
          </Text>
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
              {table.rows.map((cow, index) => (
                <View key={cow.id} style={[styles.row, index % 2 === 1 && styles.rowAlt]}>
                  <View style={[styles.cell, styles.cowCell]}>
                    <Text style={styles.cowName} numberOfLines={1}>
                      {cow.name}
                    </Text>
                    <Text style={styles.cowTag}>#{cow.tag}</Text>
                  </View>

                  {cow.daily.map((value, dayIndex) => (
                    <View key={dayIndex} style={[styles.cell, styles.dayCell]}>
                      <Text style={[styles.cellText, value == null && styles.cellZero]}>
                        {value == null ? '—' : table.format(value)}
                      </Text>
                    </View>
                  ))}

                  <View style={[styles.cell, styles.totalCell, styles.totalHighlight]}>
                    <Text style={styles.totalText}>{table.format(cow.total)}</Text>
                  </View>
                  <View style={[styles.cell, styles.totalCell]}>
                    <Text style={styles.cellText}>{table.format(cow.average)}</Text>
                  </View>
                </View>
              ))}

              {/* Daily totals */}
              <View style={[styles.row, styles.totalsRow]}>
                <View style={[styles.cell, styles.cowCell]}>
                  <Text style={styles.totalsLabel}>All cows</Text>
                </View>
                {table.dailyTotals.map((value, index) => (
                  <View key={index} style={[styles.cell, styles.dayCell]}>
                    <Text style={styles.totalsText}>
                      {value == null ? '—' : table.format(value)}
                    </Text>
                  </View>
                ))}
                <View style={[styles.cell, styles.totalCell, styles.grandTotalCell]}>
                  <Text style={styles.grandTotalText}>{table.format(table.grandTotal)}</Text>
                </View>
                <View style={[styles.cell, styles.totalCell]}>
                  <Text style={styles.totalsText}>
                    {table.format(table.grandTotal / table.daysInMonth)}
                  </Text>
                </View>
              </View>
            </View>
          </ScrollView>

          {sheet === 'feed' && feedGrid && (
            <View style={styles.breakdown}>
              <Text style={styles.breakdownTitle}>By cow · {monthLabel(month)}</Text>
              {feedGrid.cows.map((c) => (
                <View key={c.cattle_id} style={styles.breakdownRow}>
                  <Text style={styles.breakdownType} numberOfLines={1}>
                    {c.name} <Text style={styles.cowTag}>#{c.tag}</Text>
                  </Text>
                  <Text style={styles.breakdownValue}>{c.total_kg.toFixed(1)} kg</Text>
                  <Text style={styles.breakdownValue}>{formatCurrency(c.total_cost)}</Text>
                </View>
              ))}
            </View>
          )}

          {sheet === 'feed' && feedGrid && feedGrid.by_feed_type.length > 0 && (
            <View style={styles.breakdown}>
              <Text style={styles.breakdownTitle}>By feed type · {monthLabel(month)}</Text>
              {feedGrid.by_feed_type.map((t) => (
                <View key={t.feed_type} style={styles.breakdownRow}>
                  <Text style={styles.breakdownType}>{t.feed_type}</Text>
                  <Text style={styles.breakdownValue}>{t.total_kg.toFixed(1)} kg</Text>
                  <Text style={styles.breakdownValue}>{formatCurrency(t.total_cost)}</Text>
                </View>
              ))}
              <View style={[styles.breakdownRow, styles.breakdownTotal]}>
                <Text style={styles.breakdownType}>All feed</Text>
                <Text style={styles.breakdownValue}>{feedGrid.grand_total_kg.toFixed(1)} kg</Text>
                <Text style={styles.breakdownValue}>{formatCurrency(feedGrid.grand_total_cost)}</Text>
              </View>
            </View>
          )}

          <View style={styles.legend}>
            {table.legend.map((line) => (
              <Text key={line} style={styles.legendText}>
                {line}
              </Text>
            ))}
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

  toggleBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.header,
    borderBottomColor: colors.borderStrong,
    borderBottomWidth: 1,
  },
  toggle: {
    flexDirection: 'row',
    borderRadius: radius.sm,
    borderColor: colors.borderStrong,
    borderWidth: 1,
    overflow: 'hidden',
  },
  toggleItem: { paddingHorizontal: spacing.lg, paddingVertical: 6 },
  toggleItemActive: { backgroundColor: colors.primary },
  toggleText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  toggleTextActive: { color: colors.background },

  breakdown: {
    padding: spacing.lg,
    gap: spacing.sm,
    borderTopColor: colors.border,
    borderTopWidth: 1,
  },
  breakdownTitle: { color: colors.text, fontSize: 14, fontWeight: '700', marginBottom: spacing.xs },
  breakdownRow: { flexDirection: 'row', alignItems: 'center' },
  breakdownType: { flex: 1, color: colors.textMuted, fontSize: 13 },
  breakdownValue: { width: 110, textAlign: 'right', color: colors.text, fontSize: 13 },
  breakdownTotal: { borderTopColor: colors.border, borderTopWidth: 1, paddingTop: spacing.sm },

  legend: {
    padding: spacing.lg,
    gap: spacing.xs,
    borderTopColor: colors.border,
    borderTopWidth: 1,
  },
  legendText: { color: colors.textDisabled, fontSize: 12 },
});

export default MonthlyReportScreen;
