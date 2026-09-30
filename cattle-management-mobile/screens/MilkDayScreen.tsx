import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';

import MilkConflicts from '../components/MilkConflicts';
import { offlineApi, type MilkSaveOutcome } from '../services/offlineApi';
import { useOfflineAPI } from '../hooks/useOfflineAPI';
import { Alert } from '../utils/alert';
import { formatLiters } from '../utils/formatCurrency';
import { formatDate, shiftDay, todayDateOnly } from '../utils/date';
import { colors, radius, spacing } from '../constants/theme';
import { LIMITS, cattleIdOf, type Cattle, type MilkProduction } from '../types';
import type { RootStackParamList } from '../navigation/AppNavigator';

/**
 * One screen for a whole day's milk: every milking cow on one list, morning
 * and evening (or just a day total), saved with one tap.
 *
 * Fields start empty, never 0, so a cow skipped by mistake is not recorded as
 * a dry day; typing 0 records a real 0 L day.
 */

interface Row {
  morning: string;
  evening: string;
  total: string;
}

const EMPTY: Row = { morning: '', evening: '', total: '' };

/** Accepts "8,5" as well as "8.5": French keyboards type a comma. */
const parse = (text: string): number | null => {
  const trimmed = text.trim().replace(',', '.');
  if (trimmed === '') return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : NaN;
};

const show = (value: number | null | undefined) => (value == null ? '' : String(value));

function rowFromRecord(record?: MilkProduction): Row {
  if (!record) return EMPTY;
  const split = record.morning_liters != null || record.evening_liters != null;
  return split
    ? { morning: show(record.morning_liters), evening: show(record.evening_liters), total: '' }
    : { morning: '', evening: '', total: show(record.quantity_liters) };
}

/** The row's day total, or an error message. */
function evaluate(row: Row): { total: number | null; split: boolean; error?: string } {
  const morning = parse(row.morning);
  const evening = parse(row.evening);
  const split = morning !== null || evening !== null;
  const total = split ? (morning ?? 0) + (evening ?? 0) : parse(row.total);

  if ([morning, evening, total].some((v) => v !== null && (Number.isNaN(v) || v < 0))) {
    return { total: null, split, error: 'Enter numbers only' };
  }
  if (total !== null && total > LIMITS.MILK_QUANTITY_MAX) {
    return { total, split, error: `More than ${LIMITS.MILK_QUANTITY_MAX} L in a day` };
  }
  return { total, split };
}

const same = (a: Row, b: Row) =>
  a.morning.trim() === b.morning.trim() &&
  a.evening.trim() === b.evening.trim() &&
  a.total.trim() === b.total.trim();

const MilkDayScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'MilkDay'>>();
  const { isOnline } = useOfflineAPI();

  const today = todayDateOnly();
  const [date, setDate] = useState(route.params?.date ?? today);
  const [herd, setHerd] = useState<Cattle[]>([]);
  const [records, setRecords] = useState<MilkProduction[]>([]);
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'warn'; text: string } | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  const recordFor = useCallback(
    (cowId: string) => records.find((r) => cattleIdOf(r.cattle_id) === cowId),
    [records]
  );

  const load = useCallback(async (day: string) => {
    setLoading(true);
    try {
      const [cattle, dayRecords] = await Promise.all([
        offlineApi.getCattle(),
        offlineApi.getMilkForDay(day),
      ]);
      setHerd(cattle);
      setRecords(dayRecords);
      const initial: Record<string, Row> = {};
      for (const record of dayRecords) initial[cattleIdOf(record.cattle_id)] = rowFromRecord(record);
      setRows(initial);
      setRowErrors({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(date);
  }, [date, load]);

  /** Milking cows, plus any animal that already has milk that day. */
  const cows = useMemo(() => {
    const withRecord = new Set(records.map((r) => cattleIdOf(r.cattle_id)));
    return herd
      .filter(
        (cow) =>
          (cow.current_status === 'Active' && cow.gender === 'Female') || withRecord.has(cow._id)
      )
      .sort((a, b) => a.tag_number.localeCompare(b.tag_number, undefined, { numeric: true }));
  }, [herd, records]);

  const rowOf = (cowId: string) => rows[cowId] ?? EMPTY;
  const initialOf = (cowId: string) => rowFromRecord(recordFor(cowId));
  const changed = cows.filter((cow) => !same(rowOf(cow._id), initialOf(cow._id)));

  const dayTotal = cows.reduce((sum, cow) => sum + (evaluate(rowOf(cow._id)).total ?? 0), 0);
  const filled = cows.filter((cow) => evaluate(rowOf(cow._id)).total !== null).length;

  const setField = (cowId: string, field: keyof Row, value: string) => {
    setMessage(null);
    setRows((prev) => {
      const row = { ...(prev[cowId] ?? EMPTY), [field]: value };
      // Morning/evening and a plain total are alternatives: typing one clears the other.
      if (field === 'total' && value.trim() !== '') {
        row.morning = '';
        row.evening = '';
      }
      if ((field === 'morning' || field === 'evening') && value.trim() !== '') row.total = '';
      return { ...prev, [cowId]: row };
    });
  };

  const goToDay = (next: string) => {
    if (next > today) return;
    const leave = () => {
      setMessage(null);
      setDate(next);
    };
    if (changed.length === 0) return leave();
    Alert.alert('Leave without saving?', `${changed.length} unsaved change(s) on this day.`, [
      { text: 'Stay', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: leave },
    ]);
  };

  const save = async () => {
    const errors: Record<string, string> = {};
    for (const cow of changed) {
      const { error, total } = evaluate(rowOf(cow._id));
      if (error) errors[cow._id] = error;
      else if (total === null && recordFor(cow._id)) {
        errors[cow._id] = 'To remove this day, long-press it in the milk list';
      }
    }
    setRowErrors(errors);
    if (Object.keys(errors).length > 0) {
      setMessage({ tone: 'warn', text: 'Fix the rows marked in red, then save again.' });
      return;
    }

    setSaving(true);
    const outcomes: MilkSaveOutcome[] = [];
    for (const cow of changed) {
      const row = rowOf(cow._id);
      const { split, total } = evaluate(row);
      if (total === null) continue; // left empty: nothing to record
      const values = split
        ? { morning_liters: parse(row.morning), evening_liters: parse(row.evening), quantity_liters: null }
        : { quantity_liters: total, morning_liters: null, evening_liters: null };

      // One at a time, so the offline queue keeps the order they were typed in.
      const outcome = await offlineApi.saveMilkEntry({
        cattle_id: cow._id,
        date_recorded: date,
        existing: recordFor(cow._id),
        values,
      });
      outcomes.push(outcome);
      if (outcome.status === 'error') errors[cow._id] = outcome.message;
    }
    setSaving(false);
    setRowErrors(errors);

    const count = (status: MilkSaveOutcome['status']) =>
      outcomes.filter((o) => o.status === status).length;
    const [saved, queued, conflicts, failed] = [
      count('saved'),
      count('queued'),
      count('conflict'),
      count('error'),
    ];

    if (conflicts === 0 && failed === 0) {
      const parts = [];
      if (saved) parts.push(`${saved} saved`);
      if (queued) parts.push(`${queued} kept on this phone until the connection is back`);
      setMessage({ tone: 'ok', text: parts.length ? `${parts.join(', ')}.` : 'Nothing to save.' });
      await load(date);
      if (saved + queued > 0) navigation.goBack();
      return;
    }

    const parts = [];
    if (saved + queued) parts.push(`${saved + queued} saved`);
    if (conflicts) parts.push(`${conflicts} already had milk recorded — choose below`);
    if (failed) parts.push(`${failed} could not be saved (marked in red)`);
    setMessage({ tone: 'warn', text: `${parts.join('. ')}.` });
    await load(date);
    // Keep what failed on screen so nothing typed is lost.
    if (failed) {
      setRows((prev) => {
        const next = { ...prev };
        for (const cow of changed) if (errors[cow._id]) next[cow._id] = rowOf(cow._id);
        return next;
      });
    }
  };

  const isToday = date === today;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.dateBar}>
        <TouchableOpacity
          onPress={() => goToDay(shiftDay(date, -1))}
          style={styles.arrow}
          accessibilityLabel="Previous day"
        >
          <MaterialIcons name="chevron-left" size={28} color={colors.primary} />
        </TouchableOpacity>
        <View style={styles.dateCenter}>
          <Text style={styles.dateText}>{formatDate(date)}</Text>
          {isToday ? (
            <Text style={styles.dateHint}>Today</Text>
          ) : (
            <TouchableOpacity onPress={() => goToDay(today)}>
              <Text style={styles.dateLink}>Go to today</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          onPress={() => goToDay(shiftDay(date, 1))}
          style={styles.arrow}
          disabled={isToday}
          accessibilityLabel="Next day"
        >
          <MaterialIcons
            name="chevron-right"
            size={28}
            color={isToday ? colors.textDisabled : colors.primary}
          />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <MilkConflicts onResolved={() => load(date)} />

          {cows.length === 0 ? (
            <Text style={styles.hint}>No active female cattle. Add one on the Cattle tab first.</Text>
          ) : (
            <>
              <View style={styles.headRow}>
                <Text style={[styles.headText, styles.cowCol]}>Cow</Text>
                <Text style={[styles.headText, styles.numCol]}>Morning</Text>
                <Text style={[styles.headText, styles.numCol]}>Evening</Text>
                <Text style={[styles.headText, styles.numCol]}>Total</Text>
              </View>

              {cows.map((cow) => {
                const row = rowOf(cow._id);
                const { total, split } = evaluate(row);
                const error = rowErrors[cow._id];
                const dirty = !same(row, initialOf(cow._id));
                return (
                  <View key={cow._id} style={[styles.row, error && styles.rowError]}>
                    <View style={styles.rowMain}>
                      <View style={styles.cowCol}>
                        <Text style={styles.cowName} numberOfLines={1}>
                          {cow.name}
                        </Text>
                        <Text style={styles.cowTag}>
                          {cow.tag_number}
                          {dirty ? ' · edited' : ''}
                        </Text>
                      </View>
                      <LitreInput
                        value={row.morning}
                        onChange={(v) => setField(cow._id, 'morning', v)}
                        label={`${cow.tag_number} morning litres`}
                      />
                      <LitreInput
                        value={row.evening}
                        onChange={(v) => setField(cow._id, 'evening', v)}
                        label={`${cow.tag_number} evening litres`}
                      />
                      {split ? (
                        <View style={[styles.numCol, styles.sumBox]}>
                          <Text style={styles.sumText} accessibilityLabel={`${cow.tag_number} total`}>
                            {total == null ? '—' : total.toFixed(1)}
                          </Text>
                        </View>
                      ) : (
                        <LitreInput
                          value={row.total}
                          onChange={(v) => setField(cow._id, 'total', v)}
                          label={`${cow.tag_number} total litres`}
                        />
                      )}
                    </View>
                    {error ? <Text style={styles.errorText}>{error}</Text> : null}
                  </View>
                );
              })}

              <Text style={styles.footnote}>
                Fill in morning and evening, or only the total. Leave a cow empty if she was not
                milked; type 0 for a dry day.
              </Text>
            </>
          )}
        </ScrollView>
      )}

      <View style={styles.footer}>
        {message ? (
          <Text style={[styles.message, message.tone === 'warn' && styles.messageWarn]}>
            {message.text}
          </Text>
        ) : null}
        {!isOnline ? (
          <Text style={styles.offline}>Offline: saved on this phone and sent later.</Text>
        ) : null}
        <View style={styles.footerRow}>
          <Text style={styles.summary}>
            {formatLiters(dayTotal)} · {filled} of {cows.length} cows
          </Text>
          <TouchableOpacity
            style={[styles.saveButton, (saving || changed.length === 0) && styles.disabled]}
            onPress={save}
            disabled={saving || changed.length === 0}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.background} />
            ) : (
              <Text style={styles.saveText}>
                {changed.length > 0 ? `Save (${changed.length})` : 'Save'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const LitreInput = ({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) => (
  <TextInput
    style={[styles.numCol, styles.input]}
    value={value}
    onChangeText={onChange}
    keyboardType="decimal-pad"
    inputMode="decimal"
    placeholder="–"
    placeholderTextColor={colors.textDisabled}
    accessibilityLabel={label}
    selectTextOnFocus
  />
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  dateBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.sm,
  },
  arrow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  dateCenter: { flex: 1, alignItems: 'center' },
  dateText: { color: colors.text, fontSize: 17, fontWeight: '700' },
  dateHint: { color: colors.textFaint, fontSize: 12, marginTop: 2 },
  dateLink: { color: colors.primary, fontSize: 12, marginTop: 2, fontWeight: '600' },

  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  hint: { color: colors.textDisabled, fontSize: 14, fontStyle: 'italic', textAlign: 'center', marginTop: 40 },

  headRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm, marginBottom: spacing.xs },
  headText: { color: colors.textFaint, fontSize: 12, fontWeight: '600', textAlign: 'center' },

  row: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  rowError: { borderColor: colors.danger },
  rowMain: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cowCol: { flex: 1, minWidth: 0, textAlign: 'left' },
  cowName: { color: colors.text, fontSize: 15, fontWeight: '600' },
  cowTag: { color: colors.textFaint, fontSize: 12, marginTop: 2 },
  numCol: { width: 66 },
  input: {
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    color: colors.text,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    fontSize: 16,
    textAlign: 'center',
  },
  sumBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.sm },
  sumText: { color: colors.primary, fontSize: 16, fontWeight: '700' },
  errorText: { color: colors.danger, fontSize: 12, marginTop: spacing.xs },
  footnote: { color: colors.textFaint, fontSize: 12, marginTop: spacing.sm, lineHeight: 17 },

  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    padding: spacing.md,
    gap: spacing.xs,
  },
  message: { color: colors.success, fontSize: 13 },
  messageWarn: { color: colors.warning },
  offline: { color: colors.warning, fontSize: 12 },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  summary: { flex: 1, color: colors.textMuted, fontSize: 14 },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    minWidth: 110,
    alignItems: 'center',
  },
  saveText: { color: colors.background, fontSize: 15, fontWeight: '700' },
  disabled: { opacity: 0.5 },
});

export default MilkDayScreen;
