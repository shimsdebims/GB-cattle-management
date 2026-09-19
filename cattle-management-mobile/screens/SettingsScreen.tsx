import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

import { API_BASE_URL, ApiError, settingsAPI } from '../services/api';
import { offlineApi } from '../services/offlineApi';
import { useOfflineAPI } from '../hooks/useOfflineAPI';
import { formatCurrency } from '../utils/formatCurrency';
import { colors, radius, spacing } from '../constants/theme';
import type { FarmSettings } from '../types';

const SettingsScreen = () => {
  const { pendingCount, failedCount, lastSyncAt, isOnline } = useOfflineAPI();

  const [settings, setSettings] = useState<FarmSettings | null>(null);
  const [priceInput, setPriceInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await settingsAPI.get();
      setSettings(data);
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

    setSaving(true);
    try {
      const updated = await settingsAPI.update({ milk_price_per_liter: price });
      setSettings(updated);
      Alert.alert('Saved', 'Milk price updated. Revenue figures now use this rate.');
    } catch (err) {
      Alert.alert(
        'Could not save',
        err instanceof ApiError ? err.displayMessage : 'Please try again.'
      );
    } finally {
      setSaving(false);
    }
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
            Milk income is calculated from recorded production at this rate, so it
            is never entered by hand.
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

        {/* Sync */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="sync" size={20} color={colors.cyan} />
            <Text style={styles.cardTitle}>Sync</Text>
          </View>
          <Row label="Connection" value={isOnline ? 'Online' : 'Offline'} />
          <Row label="Pending changes" value={String(pendingCount)} />
          <Row label="Failed changes" value={String(failedCount)} />
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
