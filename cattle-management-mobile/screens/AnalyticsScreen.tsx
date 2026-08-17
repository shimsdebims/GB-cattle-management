import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import { colors, radius, spacing } from '../constants/theme';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Nav = StackNavigationProp<RootStackParamList>;

/**
 * Charts are intentionally not built yet.
 *
 * Rather than a bare "Coming Soon", this points at the reports that already
 * exist so the tab is still useful.
 */
const AnalyticsScreen = () => {
  const navigation = useNavigation<Nav>();

  const go = (screen: 'Monthly' | 'Financial' | 'Dashboard') =>
    navigation.navigate('MainTabs', { screen });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <MaterialIcons name="insights" size={56} color={colors.borderStrong} />
      <Text style={styles.title}>Charts are not built yet</Text>
      <Text style={styles.body}>
        Trend graphs are planned. In the meantime, the numbers behind them are
        already available on these screens:
      </Text>

      <TouchableOpacity style={styles.link} onPress={() => go('Monthly')}>
        <MaterialIcons name="table-chart" size={22} color={colors.primary} />
        <View style={styles.linkText}>
          <Text style={styles.linkTitle}>Monthly Report</Text>
          <Text style={styles.linkBody}>Per-cow daily yield grid and totals</Text>
        </View>
        <MaterialIcons name="chevron-right" size={22} color={colors.textFaint} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.link} onPress={() => go('Financial')}>
        <MaterialIcons name="attach-money" size={22} color={colors.primary} />
        <View style={styles.linkText}>
          <Text style={styles.linkTitle}>Financial</Text>
          <Text style={styles.linkBody}>Milk income per cow, expenses, net profit</Text>
        </View>
        <MaterialIcons name="chevron-right" size={22} color={colors.textFaint} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.link} onPress={() => go('Dashboard')}>
        <MaterialIcons name="dashboard" size={22} color={colors.primary} />
        <View style={styles.linkText}>
          <Text style={styles.linkTitle}>Dashboard</Text>
          <Text style={styles.linkBody}>Herd, production and financial overview</Text>
        </View>
        <MaterialIcons name="chevron-right" size={22} color={colors.textFaint} />
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, alignItems: 'center', paddingTop: 80 },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.lg,
  },
  body: {
    fontSize: 14,
    color: colors.textFaint,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
    lineHeight: 20,
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  linkText: { flex: 1 },
  linkTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
  linkBody: { color: colors.textFaint, fontSize: 12, marginTop: 2 },
});

export default AnalyticsScreen;
