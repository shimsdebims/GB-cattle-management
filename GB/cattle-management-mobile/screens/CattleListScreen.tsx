import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useOfflineAPI } from '../hooks/useOfflineAPI';
import { Cattle } from '../types';
import { RootStackParamList } from '../navigation/AppNavigator';

type NavigationProp = StackNavigationProp<RootStackParamList>;

const CattleListScreen = () => {
  const [cattle, setCattle] = useState<Cattle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const navigation = useNavigation<NavigationProp>();
  const { getCattle, syncStatus, forceSync } = useOfflineAPI();

  const fetchCattle = async () => {
    try {
      const cattleData = await getCattle();
      setCattle(cattleData);
    } catch (error) {
      console.error('Error fetching cattle:', error);
      Alert.alert('Error', 'Failed to load cattle data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCattle();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await forceSync();
    await fetchCattle();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return '#4CAF50';
      case 'Sold': return '#2196F3';
      case 'Deceased': return '#F44336';
      case 'Quarantined': return '#FF9800';
      default: return '#C1C7CD';
    }
  };

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'Healthy': return '#4CAF50';
      case 'Sick': return '#F44336';
      case 'Injured': return '#FF9800';
      case 'Pregnant': return '#2196F3';
      case 'Recovering': return '#9C27B0';
      default: return '#C1C7CD';
    }
  };

  const calculateAge = (birthDate: string) => {
    const birth = new Date(birthDate);
    const today = new Date();
    const ageInMonths = (today.getFullYear() - birth.getFullYear()) * 12 + 
                       (today.getMonth() - birth.getMonth());
    
    if (ageInMonths < 12) {
      return `${ageInMonths} months`;
    } else {
      const years = Math.floor(ageInMonths / 12);
      const months = ageInMonths % 12;
      return months > 0 ? `${years}y ${months}m` : `${years} years`;
    }
  };

  const renderCattleItem = ({ item }: { item: Cattle }) => (
    <TouchableOpacity
      style={styles.cattleCard}
      onPress={() => navigation.navigate('CattleDetail', { cattleId: item._id })}
    >
      <View style={styles.cardHeader}>
        <View style={styles.nameSection}>
          <Text style={styles.cattleName}>{item.name}</Text>
          <Text style={styles.tagNumber}>{item.tag_number}</Text>
        </View>
        <View style={styles.statusBadges}>
          <View style={[styles.badge, { backgroundColor: getStatusColor(item.current_status) }]}>
            <Text style={styles.badgeText}>{item.current_status}</Text>
          </View>
        </View>
      </View>

      <View style={styles.cardContent}>
        <View style={styles.infoRow}>
          <MaterialIcons name="pets" size={16} color="#C1C7CD" />
          <Text style={styles.infoText}>{item.breed}</Text>
        </View>
        
        <View style={styles.infoRow}>
          <MaterialIcons name="wc" size={16} color="#C1C7CD" />
          <Text style={styles.infoText}>{item.gender}</Text>
        </View>

        <View style={styles.infoRow}>
          <MaterialIcons name="cake" size={16} color="#C1C7CD" />
          <Text style={styles.infoText}>{calculateAge(item.date_of_birth)}</Text>
        </View>

        {item.weight && (
          <View style={styles.infoRow}>
            <MaterialIcons name="fitness-center" size={16} color="#C1C7CD" />
            <Text style={styles.infoText}>{item.weight.toFixed(0)} kg</Text>
          </View>
        )}

        {item.location && (
          <View style={styles.infoRow}>
            <MaterialIcons name="location-on" size={16} color="#C1C7CD" />
            <Text style={styles.infoText}>{item.location}</Text>
          </View>
        )}
      </View>

      <View style={styles.cardFooter}>
        <View style={styles.healthSection}>
          <View style={[styles.healthBadge, { backgroundColor: getHealthColor(item.health_status) }]}>
            <MaterialIcons name="favorite" size={12} color="#FFFFFF" />
            <Text style={styles.healthText}>{item.health_status}</Text>
          </View>
        </View>
        
        <TouchableOpacity style={styles.detailsButton}>
          <MaterialIcons name="arrow-forward-ios" size={16} color="#00ED64" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerContent}>
        <Text style={styles.title}>My Cattle</Text>
        <Text style={styles.subtitle}>{cattle.length} animals</Text>
      </View>
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => navigation.navigate('AddCattle')}
      >
        <MaterialIcons name="add" size={24} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading cattle...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={cattle}
        renderItem={renderCattleItem}
        keyExtractor={(item) => item._id}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A1A23',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0A1A23',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  listContent: {
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 15,
  },
  headerContent: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#C1C7CD',
  },
  addButton: {
    backgroundColor: '#00ED64',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  cattleCard: {
    backgroundColor: '#00374A',
    marginHorizontal: 20,
    marginBottom: 15,
    borderRadius: 12,
    padding: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  nameSection: {
    flex: 1,
  },
  cattleName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  tagNumber: {
    fontSize: 14,
    color: '#00ED64',
    fontWeight: '600',
  },
  statusBadges: {
    alignItems: 'flex-end',
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  cardContent: {
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoText: {
    color: '#C1C7CD',
    marginLeft: 8,
    fontSize: 14,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  healthSection: {
    flex: 1,
  },
  healthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  healthText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  detailsButton: {
    padding: 8,
  },
});

export default CattleListScreen;
