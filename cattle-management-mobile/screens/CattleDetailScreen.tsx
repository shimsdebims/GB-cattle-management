import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import { ApiError, cattleAPI } from '../services/api';
import { offlineApi } from '../services/offlineApi';
import { formatCurrency, formatLiters } from '../utils/formatCurrency';
import { formatDate } from '../utils/date';
import { colors, healthColor, radius, spacing, statusColor } from '../constants/theme';
import type { CattleSummary } from '../types';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Nav = StackNavigationProp<RootStackParamList>;
type DetailRoute = RouteProp<RootStackParamList, 'CattleDetail'>;

const CattleDetailScreen = () => {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<DetailRoute>();
  const { cattleId } = params;

  const [summary, setSummary] = useState<CattleSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setSummary(await cattleAPI.summary(cattleId));
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.displayMessage : 'Could not load this animal.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [cattleId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const confirmDelete = () => {
    const name = summary?.cattle.name ?? 'this animal';
    const milkCount = summary?.summary.milk_production.record_count ?? 0;

    Alert.alert(
      `Delete ${name}?`,
      milkCount > 0
        ? `This also permanently deletes its milk and feeding history. This cannot be undone.`
        : 'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await offlineApi.deleteCattle(cattleId);
              navigation.goBack();
            } catch (err) {
              Alert.alert(
                'Delete failed',
                err instanceof ApiError ? err.displayMessage : 'Please try again.'
              );
            }
          },
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

  if (!summary) {
    return (
      <View style={styles.centered}>
        <MaterialIcons name="error-outline" size={44} color={colors.borderStrong} />
        <Text style={styles.emptyText}>{error ?? 'Animal not found.'}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={load}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { cattle, summary: stats, recent_milk_records, recent_feeding_records } = summary;

  const age = cattle.age_in_months;
  const ageLabel =
    age == null
      ? '—'
      : age < 12
        ? `${age} months`
        : `${Math.floor(age / 12)}y ${age % 12}m`;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
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
      {/* Identity */}
      <View style={styles.hero}>
        <View style={styles.heroText}>
          <Text style={styles.name}>{cattle.name}</Text>
          <Text style={styles.tag}>{cattle.tag_number}</Text>
        </View>
        <View style={styles.badges}>
          <Badge label={cattle.current_status} color={statusColor[cattle.current_status]} />
          <Badge label={cattle.health_status} color={healthColor[cattle.health_status]} />
        </View>
      </View>

      {/* Profile */}
      <Card title="Profile">
        <Row label="Breed" value={cattle.breed} />
        <Row label="Gender" value={cattle.gender} />
        <Row label="Age" value={ageLabel} />
        <Row label="Date of birth" value={formatDate(cattle.date_of_birth)} />
        {cattle.weight != null && <Row label="Weight" value={`${cattle.weight} kg`} />}
        {cattle.location ? <Row label="Location" value={cattle.location} /> : null}
        {cattle.purchase_date ? (
          <Row label="Purchased" value={formatDate(cattle.purchase_date)} />
        ) : null}
        {cattle.purchase_price != null && (
          <Row label="Purchase price" value={formatCurrency(cattle.purchase_price)} />
        )}
        {cattle.notes ? <Row label="Notes" value={cattle.notes} /> : null}
      </Card>

      {/* Production */}
      <Card title="Milk — last 30 days">
        <Row
          label="Total"
          value={formatLiters(stats.milk_production.total_liters_30_days)}
          emphasis
        />
        <Row
          label="Daily average"
          value={formatLiters(stats.milk_production.average_daily_liters)}
        />
        <Row label="Records" value={String(stats.milk_production.record_count)} />
        {stats.milk_production.average_quality > 0 && (
          <Row
            label="Average quality"
            value={`${stats.milk_production.average_quality.toFixed(1)} / 10`}
          />
        )}
      </Card>

      <Card title="Feeding — last 7 days">
        <Row
          label="Cost"
          value={formatCurrency(stats.feeding.total_cost_7_days)}
          emphasis
        />
        <Row
          label="Quantity"
          value={`${stats.feeding.total_quantity_kg_7_days.toFixed(1)} kg`}
        />
        <Row label="Records" value={String(stats.feeding.record_count)} />
      </Card>

      {/* Recent rows */}
      {recent_milk_records.length > 0 && (
        <Card title="Recent milk records">
          {recent_milk_records.map((record) => (
            <View key={record._id} style={styles.recordRow}>
              <Text style={styles.recordDate}>{formatDate(record.date_recorded)}</Text>
              <Text style={styles.recordValue}>
                {formatLiters(record.quantity_liters)}
              </Text>
            </View>
          ))}
        </Card>
      )}

      {recent_feeding_records.length > 0 && (
        <Card title="Recent feeding">
          {recent_feeding_records.map((record) => (
            <View key={record._id} style={styles.recordRow}>
              <View>
                <Text style={styles.recordDate}>{formatDate(record.date_recorded)}</Text>
                <Text style={styles.recordSub}>{record.feed_type}</Text>
              </View>
              <View style={styles.recordRight}>
                <Text style={styles.recordValue}>{record.quantity_kg} kg</Text>
                {record.total_cost != null && (
                  <Text style={styles.recordSub}>{formatCurrency(record.total_cost)}</Text>
                )}
              </View>
            </View>
          ))}
        </Card>
      )}

      <TouchableOpacity style={styles.deleteButton} onPress={confirmDelete}>
        <MaterialIcons name="delete-outline" size={20} color={colors.text} />
        <Text style={styles.deleteText}>Delete animal</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

// ─── Pieces ──────────────────────────────────────────────────────────────────

const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <View style={styles.card}>
    <Text style={styles.cardTitle}>{title}</Text>
    {children}
  </View>
);

const Row = ({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={[styles.rowValue, emphasis && styles.rowValueEmphasis]}>{value}</Text>
  </View>
);

const Badge = ({ label, color }: { label: string; color?: string }) => (
  <View style={[styles.badge, { backgroundColor: color ?? colors.borderStrong }]}>
    <Text style={styles.badgeText}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  emptyText: { color: colors.textDisabled, fontSize: 15, textAlign: 'center' },
  retryButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.header,
  },
  retryText: { color: colors.primary, fontWeight: '600' },

  hero: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  heroText: { flex: 1 },
  name: { fontSize: 26, fontWeight: 'bold', color: colors.text },
  tag: { fontSize: 14, color: colors.primary, fontWeight: '600', marginTop: 2 },
  badges: { gap: spacing.xs, alignItems: 'flex-end' },
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.lg,
  },
  badgeText: { color: colors.text, fontSize: 11, fontWeight: '700' },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: spacing.xs,
    gap: spacing.lg,
  },
  rowLabel: { color: colors.textFaint, fontSize: 13 },
  rowValue: { color: colors.textMuted, fontSize: 13, flexShrink: 1, textAlign: 'right' },
  rowValueEmphasis: { color: colors.primary, fontSize: 15, fontWeight: '700' },

  recordRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  recordRight: { alignItems: 'flex-end' },
  recordDate: { color: colors.textMuted, fontSize: 13 },
  recordSub: { color: colors.textFaint, fontSize: 11 },
  recordValue: { color: colors.primary, fontSize: 14, fontWeight: '600' },

  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  deleteText: { color: colors.danger, fontWeight: '700', fontSize: 15 },
});

export default CattleDetailScreen;
