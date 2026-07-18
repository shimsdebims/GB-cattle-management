import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useOfflineAPI } from '../hooks/useOfflineAPI';
import SyncStatus from '../components/SyncStatus';

interface DashboardStats {
  totalCattle: number;
  activeCattle: number;
  healthyCattle: number;
  pregnantCattle: number;
  totalMilkProduction: number;
  totalExpenses: number;
  totalRevenue: number;
  netProfit: number;
}

const DashboardScreen = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalCattle: 0,
    activeCattle: 0,
    healthyCattle: 0,
    pregnantCattle: 0,
    totalMilkProduction: 0,
    totalExpenses: 0,
    totalRevenue: 0,
    netProfit: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const { getCattle, getMilkProduction, getExpenses, forceSync } = useOfflineAPI();

  const fetchDashboardData = async () => {
    try {
      // Fetch all data
      const [cattle, milkRecords, expenses] = await Promise.all([
        getCattle(),
        getMilkProduction(),
        getExpenses()
      ]);

      // Calculate cattle stats
      const totalCattle = cattle.length;
      const activeCattle = cattle.filter(c => c.current_status === 'Active').length;
      const healthyCattle = cattle.filter(c => c.health_status === 'Healthy').length;
      const pregnantCattle = cattle.filter(c => c.health_status === 'Pregnant').length;

      // Calculate milk production (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const recentMilk = milkRecords.filter(m => 
        new Date(m.date_recorded) >= thirtyDaysAgo
      );
      const totalMilkProduction = recentMilk.reduce((sum, record) => 
        sum + record.quantity_liters, 0
      );

      // Calculate expenses (last 30 days)
      const recentExpenses = expenses.filter(e => 
        new Date(e.date_recorded) >= thirtyDaysAgo
      );
      const totalExpenses = recentExpenses.reduce((sum, expense) => 
        sum + expense.amount, 0
      );

      // Estimate revenue (milk price * quantity)
      const estimatedMilkPrice = 0.5; // $0.5 per liter
      const totalRevenue = totalMilkProduction * estimatedMilkPrice;
      const netProfit = totalRevenue - totalExpenses;

      setStats({
        totalCattle,
        activeCattle,
        healthyCattle,
        pregnantCattle,
        totalMilkProduction,
        totalExpenses,
        totalRevenue,
        netProfit,
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      Alert.alert('Error', 'Failed to load dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await forceSync();
    await fetchDashboardData();
  };

  const StatCard = ({ 
    title, 
    value, 
    icon, 
    color = '#00ED64',
    subtitle
  }: { 
    title: string; 
    value: string | number; 
    icon: keyof typeof MaterialIcons.glyphMap; 
    color?: string;
    subtitle?: string;
  }) => (
    <TouchableOpacity style={[styles.statCard, { borderLeftColor: color }]}>
      <View style={styles.statContent}>
        <View style={styles.statHeader}>
          <MaterialIcons name={icon} size={24} color={color} />
          <Text style={styles.statTitle}>{title}</Text>
        </View>
        <Text style={styles.statValue}>{value}</Text>
        {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Farm Dashboard</Text>
          <Text style={styles.subtitle}>Last 30 days overview</Text>
        </View>
        <SyncStatus />
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Cattle Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cattle Overview</Text>
          <View style={styles.statsGrid}>
            <StatCard
              title="Total Cattle"
              value={stats.totalCattle}
              icon="pets"
              color="#4CAF50"
            />
            <StatCard
              title="Active"
              value={stats.activeCattle}
              icon="check-circle"
              color="#2196F3"
            />
            <StatCard
              title="Healthy"
              value={stats.healthyCattle}
              icon="favorite"
              color="#FF5722"
            />
            <StatCard
              title="Pregnant"
              value={stats.pregnantCattle}
              icon="child-care"
              color="#FF9800"
            />
          </View>
        </View>

        {/* Production Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Milk Production</Text>
          <View style={styles.statsGrid}>
            <StatCard
              title="Total Production"
              value={`${stats.totalMilkProduction.toFixed(1)} L`}
              icon="opacity"
              color="#00BCD4"
              subtitle="Last 30 days"
            />
            <StatCard
              title="Daily Average"
              value={`${(stats.totalMilkProduction / 30).toFixed(1)} L`}
              icon="trending-up"
              color="#9C27B0"
            />
          </View>
        </View>

        {/* Financial Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Financial Overview</Text>
          <View style={styles.statsGrid}>
            <StatCard
              title="Revenue"
              value={`$${stats.totalRevenue.toFixed(2)}`}
              icon="attach-money"
              color="#4CAF50"
              subtitle="Estimated milk sales"
            />
            <StatCard
              title="Expenses"
              value={`$${stats.totalExpenses.toFixed(2)}`}
              icon="money-off"
              color="#F44336"
            />
            <StatCard
              title="Net Profit"
              value={`$${stats.netProfit.toFixed(2)}`}
              icon={stats.netProfit >= 0 ? "trending-up" : "trending-down"}
              color={stats.netProfit >= 0 ? "#4CAF50" : "#F44336"}
            />
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity style={styles.actionButton}>
              <MaterialIcons name="add" size={24} color="#FFFFFF" />
              <Text style={styles.actionText}>Add Cattle</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <MaterialIcons name="opacity" size={24} color="#FFFFFF" />
              <Text style={styles.actionText}>Record Milk</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <MaterialIcons name="restaurant" size={24} color="#FFFFFF" />
              <Text style={styles.actionText}>Add Feeding</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A1A23',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 14,
    color: '#C1C7CD',
    marginTop: 4,
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    backgroundColor: '#1E2A35',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    width: '48%',
    borderLeftWidth: 4,
    borderColor: '#2A3A47',
  },
  statContent: {
    flex: 1,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statTitle: {
    fontSize: 14,
    color: '#C1C7CD',
    marginLeft: 8,
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  statSubtitle: {
    fontSize: 12,
    color: '#666',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 4,
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
});

export default DashboardScreen;
