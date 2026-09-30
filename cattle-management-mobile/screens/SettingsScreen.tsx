import React, { useCallback, useEffect, useState } from 'react';
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
import { Alert } from '../utils/alert';
import { MaterialIcons } from '@expo/vector-icons';

import { API_BASE_URL, ApiError, settingsAPI } from '../services/api';
import { offlineApi } from '../services/offlineApi';
import { useOfflineAPI } from '../hooks/useOfflineAPI';
import { formatCurrency } from '../utils/formatCurrency';
import { formatDate, todayDateOnly } from '../utils/date';
import { clearSession } from '../services/authStore';
import { useAuthState } from '../hooks/useAuth';
import { colors, radius, spacing } from '../constants/theme';
import type { FarmSettings, MilkPriceEntry } from '../types';

const SettingsScreen = () => {
  const { pendingCount, failedCount, conflictCount, lastSyncAt, isOnline } = useOfflineAPI();

  const [settings, setSettings] = useState<FarmSettings | null>(null);
  const [priceInput, setPriceInput] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(todayDateOnly());
  const [prices, setPrices] = useState<MilkPriceEntry[]>([]);
  const auth = useAuthState();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [data, history] = await Promise.all([settingsAPI.get(), settingsAPI.milkPrices()]);
      setSettings(data);
      setPrices(history);
      setPriceInput(String(data.milk_price_per_liter));
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.displayMessage : 'Could not load settings.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async () => {
    const price = Number(priceInput);
    if (Number.isNaN(price) || price < 0) {
      return Alert.alert('Validation', 'Enter a valid price, e.g. 1700.');
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)) {
      return Alert.alert('Validation', 'Enter the start date as YYYY-MM-DD.');
    }

    setSaving(true);
    try {
      const updated = await settingsAPI.update({
        milk_price_per_liter: price,
        effective_from: effectiveFrom,
      });
      setSettings(updated);
      setPrices(await settingsAPI.milkPrices());
      Alert.alert(
        'Saved',
        `From ${formatDate(effectiveFrom)} milk is valued at ${formatCurrency(price)}/L. Earlier days keep the price they were recorded at.`
      );
    } catch (err) {
      Alert.alert(
        'Could not save',
        err instanceof ApiError ? err.displayMessage : 'Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  const logout = () => {
    const warning =
      pendingCount > 0
        ? `${pendingCount} change(s) are not sent yet. They stay on this phone and are sent after you log in again.`
        : 'You will need your password to log back in.';
    Alert.alert('Log out?', warning, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => void clearSession() },
    ]);
  };

  const removePrice = (entry: MilkPriceEntry) => {
    Alert.alert(
      'Remove this price change?',
      `Days from ${formatDate(entry.effective_from)} go back to the previous price.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await settingsAPI.deleteMilkPrice(entry._id);
              await load();
            } catch (err) {
              Alert.alert('Could not remove', err instanceof ApiError ? err.displayMessage : 'Please try again.');
            }
          },
        },
      ]
    );
  };

  const clearFailed = () => {
    Alert.alert(
      'Discard failed changes?',
      `${failedCount} change(s) the server rejected will be removed from the queue.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => offlineApi.discardFailedOperations(),
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content}>
        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={load}>
              <Text style={styles.retry}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Milk price */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="local-drink" size={20} color={colors.primary} />
            <Text style={styles.cardTitle}>Milk price per litre</Text>
          </View>
          <Text style={styles.cardBody}>
            Each milk day is valued at the price in force that day. A new price
            applies from its start date; earlier days are never revalued.
          </Text>

          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={priceInput}
              onChangeText={setPriceInput}
              keyboardType="numeric"
              placeholder="1700"
              placeholderTextColor={colors.textDisabled}
              returnKeyType="done"
            />
            <Text style={styles.unit}>FBu / L</Text>
          </View>

          <Text style={styles.rowLabel}>Applies from (YYYY-MM-DD)</Text>
          <TextInput
            style={[styles.input, styles.dateInput]}
            value={effectiveFrom}
            onChangeText={setEffectiveFrom}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textDisabled}
            autoCorrect={false}
          />

          {settings && (
            <Text style={styles.current}>
              Currently {formatCurrency(settings.milk_price_per_liter)} per litre
            </Text>
          )}

          <TouchableOpacity
            style={[styles.saveButton, saving && styles.disabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.background} />
            ) : (
              <Text style={styles.saveText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Price history */}
        {prices.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="history" size={20} color={colors.primary} />
              <Text style={styles.cardTitle}>Price history</Text>
            </View>
            {prices.map((entry) => {
              const baseline = entry.effective_from.startsWith('1970-');
              return (
                <View key={entry._id} style={styles.row}>
                  <Text style={styles.rowLabel}>
                    {baseline ? 'Starting price' : `From ${formatDate(entry.effective_from)}`}
                  </Text>
                  <View style={styles.priceRight}>
                    <Text style={styles.rowValue}>{formatCurrency(entry.price_per_liter)}/L</Text>
                    {!baseline && (
                      <TouchableOpacity
                        onPress={() => removePrice(entry)}
                        accessibilityLabel="Remove this price change"
                      >
                        <MaterialIcons name="close" size={18} color={colors.textFaint} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Sync */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="sync" size={20} color={colors.cyan} />
            <Text style={styles.cardTitle}>Sync</Text>
          </View>
          <Row label="Connection" value={isOnline ? 'Online' : 'Offline'} />
          <Row label="Pending changes" value={String(pendingCount)} />
          <Row label="Failed changes" value={String(failedCount)} />
          {/* Resolved on the Milk tab, where the choices are shown. */}
          <Row label="Milk entries to review" value={String(conflictCount)} />
          <Row
            label="Last sync"
            value={lastSyncAt ? new Date(lastSyncAt).toLocaleString() : 'Never'}
          />

          {failedCount > 0 && (
            <TouchableOpacity style={styles.dangerButton} onPress={clearFailed}>
              <Text style={styles.dangerText}>Discard failed changes</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Diagnostics */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="info-outline" size={20} color={colors.textFaint} />
            <Text style={styles.cardTitle}>Connection details</Text>
          </View>
          <Text style={styles.mono}>{API_BASE_URL}</Text>
          <Text style={styles.cardBody}>
            Set EXPO_PUBLIC_API_URL to override this. In development it is detected
            automatically from the Expo dev server.
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="payments" size={20} color={colors.cyan} />
            <Text style={styles.cardTitle}>Currency</Text>
          </View>
          <Text style={styles.currency}>{settings?.currency ?? 'BIF'}</Text>
          <Text style={styles.cardBody}>
            All amounts are shown in Burundian Francs (FBu).
          </Text>
        </View>
        {auth.status === 'signedIn' && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="person" size={20} color={colors.textFaint} />
              <Text style={styles.cardTitle}>Account</Text>
            </View>
            <Row label="Logged in as" value={auth.user?.username ?? '—'} />
            <TouchableOpacity style={styles.dangerButton} onPress={logout}>
              <Text style={styles.dangerText}>Log out</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const Row = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={styles.rowValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  dateInput: {
    marginTop: 4,
    marginBottom: 8,
  },
  priceRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  container: { flex: 1, backgroundColor: colors.background },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  content: { padding: spacing.xl, paddingBottom: spacing.xxl * 2 },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.danger,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  errorText: { color: colors.text, fontSize: 13, flex: 1 },
  retry: { color: colors.text, fontWeight: '700' },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  cardBody: { fontSize: 12, color: colors.textFaint, lineHeight: 18 },
  mono: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
    color: colors.primary,
    marginBottom: spacing.sm,
  },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  input: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16,
  },
  unit: { color: colors.textMuted, fontSize: 14, fontWeight: '500' },
  current: { marginTop: spacing.sm, fontSize: 12, color: colors.textFaint },
  currency: { fontSize: 20, fontWeight: 'bold', color: colors.cyan, marginBottom: 2 },

  saveButton: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  saveText: { color: colors.background, fontWeight: '700', fontSize: 15 },
  disabled: { opacity: 0.6 },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  rowLabel: { color: colors.textFaint, fontSize: 13 },
  rowValue: { color: colors.textMuted, fontSize: 13 },

  dangerButton: {
    marginTop: spacing.md,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.danger,
  },
  dangerText: { color: colors.danger, fontWeight: '600', fontSize: 14 },
});

export default SettingsScreen;
