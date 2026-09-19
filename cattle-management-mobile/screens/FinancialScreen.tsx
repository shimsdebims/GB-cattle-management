import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { ApiError, analyticsAPI, financialAPI } from '../services/api';
import { formatCurrency } from '../utils/formatCurrency';
import {
  currentMonth,
  formatDate,
  isFutureMonth,
  monthLabel,
  monthRange,
  shiftMonth,
  todayDateOnly,
} from '../utils/date';
import { colors, radius, spacing } from '../constants/theme';
import {
  EXPENSE_CATEGORIES,
  REVENUE_SOURCES,
  type Expense,
  type ExpenseCategory,
  type MonthlyIncome,
  type Revenue,
  type RevenueSource,
} from '../types';

/**
 * Money view for one month.
 *
 * Expenses and revenue are fetched with an explicit month range so the server
 * does the filtering. The previous version pulled every record and filtered in
 * JavaScript, which both broke past the 50-record page limit and grew unbounded.
 */
const FinancialScreen = () => {
  const [month, setMonth] = useState(currentMonth());

  const [income, setIncome] = useState<MonthlyIncome | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [revenues, setRevenues] = useState<Revenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Expense modal
  const [showExpense, setShowExpense] = useState(false);
  const [expCategory, setExpCategory] = useState<ExpenseCategory>('Concentrates');
  const [expDescription, setExpDescription] = useState('');
  const [expQuantity, setExpQuantity] = useState('');
  const [expCostPerUnit, setExpCostPerUnit] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expDate, setExpDate] = useState(todayDateOnly());
  const [savingExpense, setSavingExpense] = useState(false);

  // Revenue modal
  const [showRevenue, setShowRevenue] = useState(false);
  const [revSource, setRevSource] = useState<RevenueSource>('Cattle Sale');
  const [revDescription, setRevDescription] = useState('');
  const [revAmount, setRevAmount] = useState('');
  const [revDate, setRevDate] = useState(todayDateOnly());
  const [savingRevenue, setSavingRevenue] = useState(false);

  const load = useCallback(async () => {
    const range = monthRange(month);
    try {
      const [incomeData, expenseData, revenueData] = await Promise.all([
        analyticsAPI.monthlyIncome(month),
        financialAPI.listExpenses({ ...range, limit: 200 }),
        financialAPI.listRevenue({ ...range, limit: 200 }),
      ]);

      setIncome(incomeData);
      setExpenses(expenseData.items);
      setRevenues(revenueData.items);
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.displayMessage : 'Could not load financials.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [month]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  // Server already scoped these to the month, so totals are simple sums.
  const milkRevenue = income?.total_income ?? 0;
  const otherRevenue = useMemo(
    () => revenues.reduce((sum, row) => sum + row.amount, 0),
    [revenues]
  );
  const totalExpenses = useMemo(
    () => expenses.reduce((sum, row) => sum + row.amount, 0),
    [expenses]
  );
  const netProfit = milkRevenue + otherRevenue - totalExpenses;

  const derivedExpenseAmount = useMemo(() => {
    const qty = parseFloat(expQuantity);
    const cost = parseFloat(expCostPerUnit);
    if (Number.isNaN(qty) || Number.isNaN(cost)) return null;
    return qty * cost;
  }, [expQuantity, expCostPerUnit]);

  const resetExpense = () => {
    setExpCategory('Concentrates');
    setExpDescription('');
    setExpQuantity('');
    setExpCostPerUnit('');
    setExpAmount('');
    setExpDate(todayDateOnly());
  };

  const saveExpense = async () => {
    const amount = derivedExpenseAmount ?? parseFloat(expAmount);

    if (!expDescription.trim()) {
      return Alert.alert('Validation', 'Description is required.');
    }
    if (Number.isNaN(amount) || amount < 0) {
      return Alert.alert(
        'Validation',
        'Enter an amount, or both quantity and cost per unit.'
      );
    }

    setSavingExpense(true);
    try {
      await financialAPI.createExpense({
        date_recorded: expDate,
        category: expCategory,
        description: expDescription.trim(),
        quantity: expQuantity ? parseFloat(expQuantity) : undefined,
        cost_per_unit: expCostPerUnit ? parseFloat(expCostPerUnit) : undefined,
        amount,
      });
      setShowExpense(false);
      resetExpense();
      await load();
    } catch (err) {
      Alert.alert(
        'Could not save',
        err instanceof ApiError ? err.displayMessage : 'Please try again.'
      );
    } finally {
      setSavingExpense(false);
    }
  };

  const saveRevenue = async () => {
    const amount = parseFloat(revAmount);

    if (!revDescription.trim()) {
      return Alert.alert('Validation', 'Description is required.');
    }
    if (Number.isNaN(amount) || amount < 0) {
      return Alert.alert('Validation', 'Enter a valid amount.');
    }

    setSavingRevenue(true);
    try {
      await financialAPI.createRevenue({
        date_recorded: revDate,
        source: revSource,
        description: revDescription.trim(),
        amount,
      });
      setShowRevenue(false);
      setRevDescription('');
      setRevAmount('');
      await load();
    } catch (err) {
      Alert.alert(
        'Could not save',
        err instanceof ApiError ? err.displayMessage : 'Please try again.'
      );
    } finally {
      setSavingRevenue(false);
    }
  };

  const nextMonth = shiftMonth(month, 1);
  const canGoForward = !isFutureMonth(nextMonth);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.monthBar}>
        <TouchableOpacity onPress={() => setMonth(shiftMonth(month, -1))}>
          <MaterialIcons name="chevron-left" size={30} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{monthLabel(month)}</Text>
        <TouchableOpacity
          onPress={() => canGoForward && setMonth(nextMonth)}
          disabled={!canGoForward}
        >
          <MaterialIcons
            name="chevron-right"
            size={30}
            color={canGoForward ? colors.primary : colors.borderStrong}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
          />
        }
      >
        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Summary */}
        <View style={styles.summaryGrid}>
          <SummaryCard
            label="Milk revenue"
            value={formatCurrency(milkRevenue)}
            icon="opacity"
            color={colors.cyan}
            hint={`${(income?.total_liters ?? 0).toFixed(1)} L × ${formatCurrency(
              income?.milk_price_per_liter ?? 0
            )}`}
          />
          <SummaryCard
            label="Other revenue"
            value={formatCurrency(otherRevenue)}
            icon="sell"
            color={colors.purple}
          />
          <SummaryCard
            label="Expenses"
            value={formatCurrency(totalExpenses)}
            icon="receipt"
            color={colors.danger}
          />
          <SummaryCard
            label="Net profit"
            value={formatCurrency(netProfit)}
            icon={netProfit >= 0 ? 'trending-up' : 'trending-down'}
            color={netProfit >= 0 ? colors.success : colors.danger}
          />
        </View>

        {/* Milk income per cow */}
        {income && income.cows.length > 0 && (
          <Section title="Milk income by cow">
            {income.cows.map((cow) => (
              <View key={cow.cattle_id} style={styles.row}>
                <View style={styles.rowMain}>
                  <Text style={styles.rowTitle}>{cow.name}</Text>
                  <Text style={styles.rowSub}>
                    #{cow.tag} · {cow.total_liters.toFixed(1)} L
                  </Text>
                </View>
                <Text style={styles.rowAmount}>{formatCurrency(cow.income)}</Text>
              </View>
            ))}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Average per head</Text>
              <Text style={styles.totalValue}>
                {formatCurrency(income.average_per_head)}
              </Text>
            </View>
          </Section>
        )}

        {/* Expenses */}
        <Section
          title="Expenses"
          action={
            <TouchableOpacity style={styles.addBtn} onPress={() => setShowExpense(true)}>
              <MaterialIcons name="add" size={16} color={colors.background} />
              <Text style={styles.addBtnText}>Add</Text>
            </TouchableOpacity>
          }
        >
          {expenses.length === 0 ? (
            <Text style={styles.empty}>No expenses this month.</Text>
          ) : (
            expenses.map((item) => (
              <View key={item._id} style={styles.row}>
                <View style={styles.rowMain}>
                  <Text style={styles.rowTitle}>{item.description}</Text>
                  <Text style={styles.rowSub}>
                    {item.category} · {formatDate(item.date_recorded)}
                  </Text>
                  {item.quantity != null && item.cost_per_unit != null && (
                    <Text style={styles.rowSub}>
                      {item.quantity} × {formatCurrency(item.cost_per_unit)}
                    </Text>
                  )}
                </View>
                <Text style={[styles.rowAmount, { color: colors.danger }]}>
                  {formatCurrency(item.amount)}
                </Text>
              </View>
            ))
          )}
        </Section>

        {/* Other revenue */}
        <Section
          title="Other revenue"
          action={
            <TouchableOpacity style={styles.addBtn} onPress={() => setShowRevenue(true)}>
              <MaterialIcons name="add" size={16} color={colors.background} />
              <Text style={styles.addBtnText}>Add</Text>
            </TouchableOpacity>
          }
        >
          {revenues.length === 0 ? (
            <Text style={styles.empty}>No other revenue this month.</Text>
          ) : (
            revenues.map((item) => (
              <View key={item._id} style={styles.row}>
                <View style={styles.rowMain}>
                  <Text style={styles.rowTitle}>{item.description}</Text>
                  <Text style={styles.rowSub}>
                    {item.source} · {formatDate(item.date_recorded)}
                  </Text>
                </View>
                <Text style={[styles.rowAmount, { color: colors.success }]}>
                  {formatCurrency(item.amount)}
                </Text>
              </View>
            ))
          )}
        </Section>
      </ScrollView>

      {/* Expense modal */}
      <Modal visible={showExpense} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Add Expense</Text>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.chipRow}>
                  {EXPENSE_CATEGORIES.map((category) => (
                    <TouchableOpacity
                      key={category}
                      style={[styles.chip, expCategory === category && styles.chipActive]}
                      onPress={() => setExpCategory(category)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          expCategory === category && styles.chipTextActive,
                        ]}
                      >
                        {category}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <Text style={styles.label}>Description *</Text>
              <TextInput
                style={styles.input}
                value={expDescription}
                onChangeText={setExpDescription}
                placeholder="e.g. 50 kg concentrates"
                placeholderTextColor={colors.textDisabled}
              />

              <View style={styles.fieldRow}>
                <View style={styles.field}>
                  <Text style={styles.label}>Quantity</Text>
                  <TextInput
                    style={styles.input}
                    value={expQuantity}
                    onChangeText={setExpQuantity}
                    keyboardType="numeric"
                    placeholder="Optional"
                    placeholderTextColor={colors.textDisabled}
                  />
                </View>
                <View style={styles.field}>
                  <Text style={styles.label}>Cost / unit</Text>
                  <TextInput
                    style={styles.input}
                    value={expCostPerUnit}
                    onChangeText={setExpCostPerUnit}
                    keyboardType="numeric"
                    placeholder="Optional"
                    placeholderTextColor={colors.textDisabled}
                  />
                </View>
              </View>

              <Text style={styles.label}>
                {derivedExpenseAmount !== null ? 'Amount (calculated)' : 'Amount (FBu) *'}
              </Text>
              <TextInput
                style={[styles.input, derivedExpenseAmount !== null && styles.inputLocked]}
                value={
                  derivedExpenseAmount !== null
                    ? String(Math.round(derivedExpenseAmount))
                    : expAmount
                }
                onChangeText={setExpAmount}
                keyboardType="numeric"
                editable={derivedExpenseAmount === null}
                placeholder="e.g. 170000"
                placeholderTextColor={colors.textDisabled}
              />

              <Text style={styles.label}>Date</Text>
              <TextInput
                style={styles.input}
                value={expDate}
                onChangeText={setExpDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textDisabled}
              />
            </ScrollView>

            <View style={styles.sheetActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowExpense(false);
                  resetExpense();
                }}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, savingExpense && styles.disabled]}
                onPress={saveExpense}
                disabled={savingExpense}
              >
                {savingExpense ? (
                  <ActivityIndicator size="small" color={colors.background} />
                ) : (
                  <Text style={styles.saveText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Revenue modal */}
      <Modal visible={showRevenue} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Add Revenue</Text>
            <Text style={styles.sheetNote}>
              Milk income is calculated automatically and is not entered here.
            </Text>

            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Source</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.chipRow}>
                  {REVENUE_SOURCES.map((source) => (
                    <TouchableOpacity
                      key={source}
                      style={[styles.chip, revSource === source && styles.chipActive]}
                      onPress={() => setRevSource(source)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          revSource === source && styles.chipTextActive,
                        ]}
                      >
                        {source}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <Text style={styles.label}>Description *</Text>
              <TextInput
                style={styles.input}
                value={revDescription}
                onChangeText={setRevDescription}
                placeholder="e.g. Sold 2 bulls"
                placeholderTextColor={colors.textDisabled}
              />

              <Text style={styles.label}>Amount (FBu) *</Text>
              <TextInput
                style={styles.input}
                value={revAmount}
                onChangeText={setRevAmount}
                keyboardType="numeric"
                placeholder="e.g. 500000"
                placeholderTextColor={colors.textDisabled}
              />

              <Text style={styles.label}>Date</Text>
              <TextInput
                style={styles.input}
                value={revDate}
                onChangeText={setRevDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textDisabled}
              />
            </ScrollView>

            <View style={styles.sheetActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowRevenue(false)}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, savingRevenue && styles.disabled]}
                onPress={saveRevenue}
                disabled={savingRevenue}
              >
                {savingRevenue ? (
                  <ActivityIndicator size="small" color={colors.background} />
                ) : (
                  <Text style={styles.saveText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

// ─── Pieces ──────────────────────────────────────────────────────────────────

const Section = ({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <View style={styles.section}>
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action}
    </View>
    {children}
  </View>
);

const SummaryCard = ({
  label,
  value,
  icon,
  color,
  hint,
}: {
  label: string;
  value: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  color: string;
  hint?: string;
}) => (
  <View style={[styles.summaryCard, { borderLeftColor: color }]}>
    <MaterialIcons name={icon} size={18} color={color} />
    <Text style={styles.summaryLabel}>{label}</Text>
    <Text style={[styles.summaryValue, { color }]} numberOfLines={1} adjustsFontSizeToFit>
      {value}
    </Text>
    {hint ? <Text style={styles.summaryHint}>{hint}</Text> : null}
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    paddingTop: 52,
    backgroundColor: colors.header,
    borderBottomColor: colors.borderStrong,
    borderBottomWidth: 1,
  },
  monthLabel: { fontSize: 17, fontWeight: '700', color: colors.text },

  errorBanner: {
    backgroundColor: colors.danger,
    margin: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  errorText: { color: colors.text, fontSize: 13 },

  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    padding: spacing.lg,
    paddingBottom: 0,
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    width: '48%',
    marginBottom: spacing.md,
    borderLeftWidth: 4,
  },
  summaryLabel: { color: colors.textMuted, fontSize: 12, marginTop: spacing.xs },
  summaryValue: { fontSize: 15, fontWeight: '700' },
  summaryHint: { color: colors.textFaint, fontSize: 10, marginTop: 2 },

  section: { paddingHorizontal: spacing.lg, marginBottom: spacing.xl },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  addBtnText: { color: colors.background, fontWeight: '700', fontSize: 13 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  rowMain: { flex: 1, paddingRight: spacing.md },
  rowTitle: { color: colors.text, fontSize: 14, fontWeight: '600' },
  rowSub: { color: colors.textFaint, fontSize: 12, marginTop: 2 },
  rowAmount: { color: colors.primary, fontSize: 15, fontWeight: '700' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderTopColor: colors.borderStrong,
    borderTopWidth: 1,
  },
  totalLabel: { color: colors.textMuted, fontSize: 13 },
  totalValue: { color: colors.text, fontSize: 14, fontWeight: '700' },
  empty: { color: colors.textDisabled, fontSize: 13, fontStyle: 'italic' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: spacing.xl,
    borderTopRightRadius: spacing.xl,
    padding: spacing.xl,
    maxHeight: '92%',
  },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  sheetNote: { fontSize: 12, color: colors.textFaint, marginTop: spacing.xs },
  label: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
  },
  inputLocked: { color: colors.textFaint },
  fieldRow: { flexDirection: 'row', gap: spacing.md },
  field: { flex: 1 },
  chipRow: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.xs },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  chipActive: { backgroundColor: colors.header, borderColor: colors.primary },
  chipText: { color: colors.textMuted, fontSize: 13 },
  chipTextActive: { color: colors.primary, fontWeight: '700' },

  sheetActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  cancelButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  cancelText: { color: colors.textMuted, fontSize: 15 },
  saveButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  saveText: { color: colors.background, fontSize: 15, fontWeight: '700' },
  disabled: { opacity: 0.6 },
});

export default FinancialScreen;
