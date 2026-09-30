import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import {
  ConflictChoice,
  getMilkConflicts,
  milkTotal,
  resolveMilkConflict,
} from '../services/offlineApi';
import type { MilkConflict } from '../services/offlineStore';
import { useSyncState } from '../hooks/useOfflineAPI';
import { Alert } from '../utils/alert';
import { formatLiters } from '../utils/formatCurrency';
import { formatDate } from '../utils/date';
import { colors, radius, spacing } from '../constants/theme';

/**
 * Milk entries that met a different figure on the server for the same cow and
 * day, e.g. recorded offline on two phones. Each waits here until he chooses;
 * nothing is overwritten or thrown away on its own.
 */
const MilkConflicts = ({ onResolved }: { onResolved?: () => void }) => {
  const { conflictCount } = useSyncState();
  const [items, setItems] = useState<MilkConflict[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => setItems(await getMilkConflicts()), []);

  useEffect(() => {
    void load();
  }, [load, conflictCount]);

  if (items.length === 0) return null;

  const choose = async (conflict: MilkConflict, choice: ConflictChoice) => {
    setBusy(conflict.id);
    try {
      await resolveMilkConflict(conflict.id, choice);
      await load();
      onResolved?.();
    } catch (error) {
      Alert.alert('Could not save', error instanceof Error ? error.message : 'Please try again.');
      await load();
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.box}>
      <View style={styles.titleRow}>
        <MaterialIcons name="call-split" size={18} color={colors.warning} />
        <Text style={styles.title}>
          {items.length === 1 ? '1 milk entry needs a decision' : `${items.length} milk entries need a decision`}
        </Text>
      </View>

      {items.map((conflict) => {
        const cow = conflict.server.cattle_id;
        const label = typeof cow === 'string' ? 'Cow' : `${cow.tag_number} — ${cow.name}`;
        const saved = milkTotal(conflict.server);
        const mine = milkTotal(conflict.mine);

        return (
          <View key={conflict.id} style={styles.item}>
            <Text style={styles.itemTitle}>
              {label} · {formatDate(conflict.date_recorded)}
            </Text>
            <Text style={styles.itemBody}>
              Already saved: {formatLiters(saved)}. This phone: {formatLiters(mine)}.
            </Text>

            {busy === conflict.id ? (
              <ActivityIndicator color={colors.primary} style={styles.spinner} />
            ) : (
              <View style={styles.actions}>
                <Choice label={`Keep ${formatLiters(saved)}`} onPress={() => choose(conflict, 'server')} />
                <Choice label={`Use ${formatLiters(mine)}`} onPress={() => choose(conflict, 'mine')} />
                <Choice
                  label={`Add: ${formatLiters(saved + mine)}`}
                  onPress={() => choose(conflict, 'sum')}
                />
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
};

const Choice = ({ label, onPress }: { label: string; onPress: () => void }) => (
  <TouchableOpacity style={styles.choice} onPress={onPress} accessibilityRole="button">
    <Text style={styles.choiceText}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.warning,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { color: colors.text, fontSize: 15, fontWeight: '700' },
  item: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, gap: spacing.xs },
  itemTitle: { color: colors.text, fontSize: 14, fontWeight: '600' },
  itemBody: { color: colors.textMuted, fontSize: 13 },
  spinner: { alignSelf: 'flex-start', marginVertical: spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  choice: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  choiceText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
});

export default MilkConflicts;
