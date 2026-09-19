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

import { ApiError } from '../services/api';
import { offlineApi } from '../services/offlineApi';
import { useOfflineAPI } from '../hooks/useOfflineAPI';
import { formatCurrency } from '../utils/formatCurrency';
import { formatDate, todayDateOnly } from '../utils/date';
import { colors, radius, spacing } from '../constants/theme';
import { FEED_TYPES, type Cattle, type FeedType, type Feeding } from '../types';

const FeedingScreen = () => {
  const { isOnline, forceSync } = useOfflineAPI();

  const [records, setRecords] = useState<Feeding[]>([]);
  const [herd, setHerd] = useState<Cattle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [cattleId, setCattleId] = useState('');
  const [feedType, setFeedType] = useState<FeedType>('Hay');
  const [quantity, setQuantity] = useState('');
  const [costPerUnit, setCostPerUnit] = useState('');
  const [supplier, setSupplier] = useState('');
  const [date, setDate] = useState(todayDateOnly());

  const load = useCallback(async () => {
    try {
      const [feeding, cattle] = await Promise.all([
        offlineApi.getFeeding(),
        offlineApi.getCattle(),
      ]);
      setRecords(feeding);
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

  const activeHerd = useMemo(
    () => herd.filter((cow) => cow.current_status === 'Active'),
    [herd]
  );

  const nameFor = useCallback(
    (ref: Feeding['cattle_id']) => {
      if (typeof ref !== 'string') return `${ref.tag_number} — ${ref.name}`;
      const cow = herd.find((c) => c._id === ref);
      return cow ? `${cow.tag_number} — ${cow.name}` : 'Unknown';
    },
    [herd]
  );

  const totalCost = useMemo(
    () => records.reduce((sum, record) => sum + (record.total_cost ?? 0), 0),
    [records]
  );

  const resetForm = () => {
    setCattleId('');
    setFeedType('Hay');
    setQuantity('');
    setCostPerUnit('');
    setSupplier('');
    setDate(todayDateOnly());
  };

  const derivedCost = () => {
    const qty = parseFloat(quantity);
    const cost = parseFloat(costPerUnit);
    if (Number.isNaN(qty) || Number.isNaN(cost)) return null;
    return qty * cost;
  };

  const handleSave = async () => {
    const qty = parseFloat(quantity);

    if (!cattleId) return Alert.alert('Validation', 'Select an animal.');
    if (Number.isNaN(qty) || qty <= 0) {
      return Alert.alert('Validation', 'Enter a quantity greater than zero.');
    }

    const cost = costPerUnit ? parseFloat(costPerUnit) : undefined;
    if (cost !== undefined && (Number.isNaN(cost) || cost < 0)) {
      return Alert.alert('Validation', 'Cost per unit must be a positive number.');
    }

    setSaving(true);
    try {
      await offlineApi.createFeeding({
        cattle_id: cattleId,
        date_recorded: date,
        feed_type: feedType,
        quantity_kg: qty,
        cost_per_unit: cost,
        supplier: supplier.trim() || undefined,
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

  const confirmDelete = (record: Feeding) => {
    Alert.alert('Delete feeding record?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await offlineApi.deleteFeeding(record._id);
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
        <View>
          <Text style={styles.title}>Feeding</Text>
          <Text style={styles.subtitle}>
            {records.length} records · {formatCurrency(totalCost)}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowModal(true)}
          accessibilityLabel="Add feeding record"
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
            <MaterialIcons name="restaurant" size={52} color={colors.borderStrong} />
            <Text style={styles.emptyText}>No feeding records yet</Text>
            <Text style={styles.emptyHint}>Tap + to add the first one.</Text>
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
              <View style={styles.chip}>
                <Text style={styles.chipText}>{item.feed_type}</Text>
              </View>
              <Text style={styles.cardQty}>{item.quantity_kg} kg</Text>
              {item.total_cost != null && (
                <Text style={styles.cardCost}>{formatCurrency(item.total_cost)}</Text>
              )}
            </View>
          </TouchableOpacity>
        )}
      />

      {/* Add record */}
      <Modal visible={showModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Add Feeding Record</Text>

            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Animal *</Text>
              {activeHerd.length === 0 ? (
                <Text style={styles.hint}>No active animals. Add cattle first.</Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.chipRow}>
                    {activeHerd.map((cow) => (
                      <TouchableOpacity
                        key={cow._id}
                        style={[
                          styles.selectChip,
                          cattleId === cow._id && styles.selectChipActive,
                        ]}
                        onPress={() => setCattleId(cow._id)}
                      >
                        <Text
                          style={[
                            styles.selectChipText,
                            cattleId === cow._id && styles.selectChipTextActive,
                          ]}
                        >
                          {cow.tag_number}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              )}

              <Text style={styles.label}>Feed type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.chipRow}>
                  {FEED_TYPES.map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.selectChip,
                        feedType === type && styles.selectChipActive,
                      ]}
                      onPress={() => setFeedType(type)}
                    >
                      <Text
                        style={[
                          styles.selectChipText,
                          feedType === type && styles.selectChipTextActive,
                        ]}
                      >
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <View style={styles.fieldRow}>
                <View style={styles.field}>
                  <Text style={styles.label}>Quantity (kg) *</Text>
                  <TextInput
                    style={styles.input}
                    value={quantity}
                    onChangeText={setQuantity}
                    keyboardType="numeric"
                    placeholder="e.g. 10"
                    placeholderTextColor={colors.textDisabled}
                  />
                </View>
                <View style={styles.field}>
                  <Text style={styles.label}>Cost / kg (FBu)</Text>
                  <TextInput
                    style={styles.input}
                    value={costPerUnit}
                    onChangeText={setCostPerUnit}
                    keyboardType="numeric"
                    placeholder="e.g. 500"
                    placeholderTextColor={colors.textDisabled}
                  />
                </View>
              </View>

              {derivedCost() !== null && (
                <Text style={styles.derived}>
                  Total: {formatCurrency(derivedCost() as number)}
                </Text>
              )}

              <Text style={styles.label}>Supplier</Text>
              <TextInput
                style={styles.input}
                value={supplier}
                onChangeText={setSupplier}
                placeholder="Optional"
                placeholderTextColor={colors.textDisabled}
              />

              <Text style={styles.label}>Date</Text>
              <TextInput
                style={styles.input}
                value={date}
                onChangeText={setDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textDisabled}
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
    justifyContent: 'space-between',
    padding: spacing.xl,
    paddingTop: 56,
  },
  title: { fontSize: 24, fontWeight: 'bold', color: colors.text },
  subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },

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
  cardBottom: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  chip: {
    backgroundColor: colors.header,
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  chipText: { color: colors.primary, fontSize: 11, fontWeight: '600' },
  cardQty: { color: colors.textMuted, fontSize: 13 },
  cardCost: { color: colors.warning, fontSize: 13, fontWeight: '600', marginLeft: 'auto' },

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
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  label: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  hint: { color: colors.textDisabled, fontSize: 13, fontStyle: 'italic' },
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
  fieldRow: { flexDirection: 'row', gap: spacing.md },
  field: { flex: 1 },
  derived: { color: colors.primary, fontSize: 13, marginTop: spacing.sm },
  chipRow: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.xs },
  selectChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  selectChipActive: { backgroundColor: colors.header, borderColor: colors.primary },
  selectChipText: { color: colors.textMuted, fontSize: 13 },
  selectChipTextActive: { color: colors.primary, fontWeight: '700' },
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

export default FeedingScreen;
