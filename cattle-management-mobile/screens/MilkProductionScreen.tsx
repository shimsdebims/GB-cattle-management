import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import { useFocusEffect } from '@react-navigation/native';

import SyncStatus from '../components/SyncStatus';
import { ApiError } from '../services/api';
import { offlineApi } from '../services/offlineApi';
import { useOfflineAPI } from '../hooks/useOfflineAPI';
import { formatLiters } from '../utils/formatCurrency';
import { formatDate, todayDateOnly } from '../utils/date';
import { colors, radius, spacing } from '../constants/theme';
import { LIMITS, cattleIdOf, type Cattle, type MilkProduction } from '../types';

const MilkProductionScreen = () => {
  const { isOnline, forceSync } = useOfflineAPI();

  const [records, setRecords] = useState<MilkProduction[]>([]);
  const [herd, setHerd] = useState<Cattle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [cattleId, setCattleId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [quality, setQuality] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(todayDateOnly());

  const load = useCallback(async () => {
    try {
      const [milk, cattle] = await Promise.all([
        offlineApi.getMilk(),
        offlineApi.getCattle(),
      ]);
      setRecords(milk);
      setHerd(cattle);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  /** Only active females are milked. */
  const milkingHerd = useMemo(
    () => herd.filter((cow) => cow.current_status === 'Active' && cow.gender === 'Female'),
    [herd]
  );

  const nameFor = useCallback(
    (ref: MilkProduction['cattle_id']) => {
      if (typeof ref !== 'string') return `${ref.tag_number} — ${ref.name}`;
      const cow = herd.find((c) => c._id === ref);
      return cow ? `${cow.tag_number} — ${cow.name}` : 'Unknown';
    },
    [herd]
  );

  const totalLiters = useMemo(
    () => records.reduce((sum, record) => sum + record.quantity_liters, 0),
    [records]
  );

  /** Warn before submitting a day that already has a record for this cow. */
  const duplicateWarning = useMemo(() => {
    if (!cattleId) return null;
    const clash = records.find(
      (record) =>
        cattleIdOf(record.cattle_id) === cattleId &&
        record.date_recorded.slice(0, 10) === date
    );
    return clash
      ? `A record already exists for this cow on ${formatDate(date)}.`
      : null;
  }, [records, cattleId, date]);

  const resetForm = () => {
    setCattleId('');
    setQuantity('');
    setQuality('');
    setNotes('');
    setDate(todayDateOnly());
  };

  const handleSave = async () => {
    const litres = parseFloat(quantity);

    if (!cattleId) return Alert.alert('Validation', 'Select a cow.');
    if (Number.isNaN(litres) || litres <= 0) {
      return Alert.alert('Validation', 'Enter a quantity greater than zero.');
    }
    if (litres > LIMITS.MILK_QUANTITY_MAX) {
      return Alert.alert(
        'Validation',
        `Quantity must not exceed ${LIMITS.MILK_QUANTITY_MAX} litres.`
      );
    }

    const score = quality ? parseFloat(quality) : undefined;
    if (
      score !== undefined &&
      (Number.isNaN(score) ||
        score < LIMITS.QUALITY_SCORE_MIN ||
        score > LIMITS.QUALITY_SCORE_MAX)
    ) {
      return Alert.alert(
        'Validation',
        `Quality must be between ${LIMITS.QUALITY_SCORE_MIN} and ${LIMITS.QUALITY_SCORE_MAX}.`
      );
    }

    setSaving(true);
    try {
      await offlineApi.createMilk({
        cattle_id: cattleId,
        date_recorded: date,
        quantity_liters: litres,
        quality_score: score,
        notes: notes.trim() || undefined,
      });
      setShowModal(false);
      resetForm();
      await load();
    } catch (error) {
      Alert.alert(
        'Could not save',
        error instanceof ApiError ? error.displayMessage : 'Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (record: MilkProduction) => {
    Alert.alert('Delete milk record?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await offlineApi.deleteMilk(record._id);
          await load();
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Milk Production</Text>
          <Text style={styles.subtitle}>
            {records.length} records · {formatLiters(totalLiters)}
          </Text>
        </View>
        <SyncStatus />
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowModal(true)}
          accessibilityLabel="Add milk record"
        >
          <MaterialIcons name="add" size={24} color={colors.background} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={records}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await forceSync();
              await load();
            }}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialIcons name="opacity" size={52} color={colors.borderStrong} />
            <Text style={styles.emptyText}>No milk records yet</Text>
            <Text style={styles.emptyHint}>Tap + to record today's yield.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onLongPress={() => confirmDelete(item)}
            delayLongPress={400}
          >
            <View style={styles.cardTop}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {nameFor(item.cattle_id)}
              </Text>
              <Text style={styles.cardDate}>{formatDate(item.date_recorded)}</Text>
            </View>
            <View style={styles.cardBottom}>
              <View style={styles.metric}>
                <MaterialIcons name="opacity" size={16} color={colors.cyan} />
                <Text style={styles.metricText}>{formatLiters(item.quantity_liters)}</Text>
              </View>
              {item.quality_score != null && (
                <View style={styles.metric}>
                  <MaterialIcons name="star" size={16} color="#FFD700" />
                  <Text style={styles.metricText}>
                    {item.quality_score.toFixed(1)}/{LIMITS.QUALITY_SCORE_MAX}
                  </Text>
                </View>
              )}
            </View>
            {item.notes ? <Text style={styles.notes}>{item.notes}</Text> : null}
          </TouchableOpacity>
        )}
      />

      <Modal visible={showModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Add Milk Record</Text>

            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Cow *</Text>
              {milkingHerd.length === 0 ? (
                <Text style={styles.hint}>
                  No active female cattle. Add one on the Cattle tab first.
                </Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.chipRow}>
                    {milkingHerd.map((cow) => (
                      <TouchableOpacity
                        key={cow._id}
                        style={[styles.chip, cattleId === cow._id && styles.chipActive]}
                        onPress={() => setCattleId(cow._id)}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            cattleId === cow._id && styles.chipTextActive,
                          ]}
                        >
                          {cow.tag_number}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              )}

              <Text style={styles.label}>Date</Text>
              <TextInput
                style={styles.input}
                value={date}
                onChangeText={setDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textDisabled}
              />

              {duplicateWarning && (
                <Text style={styles.warning}>
                  <MaterialIcons name="warning" size={12} /> {duplicateWarning}
                </Text>
              )}

              <View style={styles.fieldRow}>
                <View style={styles.field}>
                  <Text style={styles.label}>Litres *</Text>
                  <TextInput
                    style={styles.input}
                    value={quantity}
                    onChangeText={setQuantity}
                    keyboardType="numeric"
                    placeholder="e.g. 25.5"
                    placeholderTextColor={colors.textDisabled}
                  />
                </View>
                <View style={styles.field}>
                  <Text style={styles.label}>
                    Quality ({LIMITS.QUALITY_SCORE_MIN}–{LIMITS.QUALITY_SCORE_MAX})
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={quality}
                    onChangeText={setQuality}
                    keyboardType="numeric"
                    placeholder="Optional"
                    placeholderTextColor={colors.textDisabled}
                  />
                </View>
              </View>

              <Text style={styles.label}>Notes</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Optional"
                placeholderTextColor={colors.textDisabled}
                multiline
              />

              {!isOnline && (
                <Text style={styles.offlineNote}>
                  You are offline — this will be saved locally and synced later.
                </Text>
              )}
            </ScrollView>

            <View style={styles.sheetActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowModal(false);
                  resetForm();
                }}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
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
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingTop: 56,
    paddingBottom: spacing.md,
  },
  headerText: { flex: 1 },
  title: { fontSize: 22, fontWeight: 'bold', color: colors.text },
  subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: '600', flex: 1 },
  cardDate: { color: colors.textFaint, fontSize: 12 },
  cardBottom: { flexDirection: 'row', gap: spacing.xl },
  metric: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  metricText: { color: colors.textMuted, fontSize: 13 },
  notes: {
    color: colors.textFaint,
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: spacing.sm,
  },

  empty: { alignItems: 'center', paddingTop: 80, gap: spacing.sm },
  emptyText: { color: colors.textMuted, fontSize: 16 },
  emptyHint: { color: colors.textDisabled, fontSize: 13 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: spacing.xl,
    borderTopRightRadius: spacing.xl,
    padding: spacing.xl,
    maxHeight: '90%',
  },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  label: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  hint: { color: colors.textDisabled, fontSize: 13, fontStyle: 'italic' },
  warning: { color: colors.warning, fontSize: 12, marginTop: spacing.sm },
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
  textArea: { height: 70, textAlignVertical: 'top' },
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
  offlineNote: { color: colors.warning, fontSize: 12, marginTop: spacing.md },

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

export default MilkProductionScreen;
