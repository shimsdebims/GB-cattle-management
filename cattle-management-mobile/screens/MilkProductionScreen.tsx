import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Modal,
  TextInput,
  ScrollView,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { MaterialIcons } from '@expo/vector-icons';
import { useOfflineAPI } from '../hooks/useOfflineAPI';
import { MilkProduction, Cattle } from '../types';

const MilkProductionScreen = () => {
  const [milkRecords, setMilkRecords] = useState<MilkProduction[]>([]);
  const [cattle, setCattle] = useState<Cattle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  const { getMilkProduction, getCattle, createMilkProduction, forceSync } = useOfflineAPI();

  const [formData, setFormData] = useState({
    cattle_id: '',
    date_recorded: new Date().toISOString(),
    quantity_liters: 0,
    quality_score: 8,
    notes: '',
  });

  const fetchData = async () => {
    try {
      const [milkData, cattleData] = await Promise.all([
        getMilkProduction(),
        getCattle()
      ]);
      setMilkRecords(milkData);
      setCattle(cattleData);
    } catch (error) {
      console.error('Error fetching data:', error);
      Alert.alert('Error', 'Failed to load data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await forceSync();
    await fetchData();
  };

  const handleAddRecord = async () => {
    if (!formData.cattle_id) {
      Alert.alert('Error', 'Please select a cattle');
      return;
    }
    if (formData.quantity_liters <= 0) {
      Alert.alert('Error', 'Please enter a valid quantity');
      return;
    }

    try {
      await createMilkProduction(formData);
      setShowAddModal(false);
      setFormData({
        cattle_id: '',
        date_recorded: new Date().toISOString(),
        quantity_liters: 0,
        quality_score: 8,
        notes: '',
      });
      await fetchData();
      Alert.alert('Success', 'Milk production record added');
    } catch (error) {
      console.error('Error adding record:', error);
      Alert.alert('Error', 'Failed to add record. Saved offline.');
    }
  };

  const getCattleName = (cattleId: string) => {
    const cattleItem = cattle.find(c => c._id === cattleId);
    return cattleItem ? `${cattleItem.tag_number} - ${cattleItem.name}` : 'Unknown';
  };

  const renderMilkRecord = ({ item }: { item: MilkProduction }) => (
    <View style={styles.recordCard}>
      <View style={styles.recordHeader}>
        <Text style={styles.cattleName}>{getCattleName(item.cattle_id)}</Text>
        <Text style={styles.date}>
          {new Date(item.date_recorded).toLocaleDateString()}
        </Text>
      </View>
      <View style={styles.recordDetails}>
        <View style={styles.detailItem}>
          <MaterialIcons name="opacity" size={16} color="#4CAF50" />
          <Text style={styles.detailText}>{item.quantity_liters.toFixed(1)} L</Text>
        </View>
        {item.quality_score && (
          <View style={styles.detailItem}>
            <MaterialIcons name="star" size={16} color="#FFD700" />
            <Text style={styles.detailText}>{item.quality_score.toFixed(1)}/10</Text>
          </View>
        )}
      </View>
      {item.notes && (
        <Text style={styles.notes}>{item.notes}</Text>
      )}
    </View>
  );

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setFormData({ ...formData, date_recorded: selectedDate.toISOString() });
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Milk Production</Text>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => setShowAddModal(true)}
        >
          <MaterialIcons name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={milkRecords}
        renderItem={renderMilkRecord}
        keyExtractor={(item) => item._id}
        style={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialIcons name="opacity" size={64} color="#666" />
            <Text style={styles.emptyText}>No milk production records</Text>
            <Text style={styles.emptySubtext}>Tap + to add your first record</Text>
          </View>
        }
      />

      {/* Add Record Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowAddModal(false)}>
              <MaterialIcons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Add Milk Record</Text>
            <TouchableOpacity onPress={handleAddRecord}>
              <Text style={styles.saveButton}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Cattle Selection */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Select Cattle *</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={formData.cattle_id}
                  onValueChange={(value) => setFormData({ ...formData, cattle_id: value })}
                  style={styles.picker}
                >
                  <Picker.Item label="Select Cattle" value="" />
                  {cattle.filter(c => c.current_status === 'Active' && c.gender === 'Female').map((cattleItem) => (
                    <Picker.Item 
                      key={cattleItem._id} 
                      label={`${cattleItem.tag_number} - ${cattleItem.name}`} 
                      value={cattleItem._id} 
                    />
                  ))}
                </Picker>
              </View>
            </View>

            {/* Date */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Date</Text>
              <TouchableOpacity 
                style={styles.dateButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={styles.dateText}>
                  {new Date(formData.date_recorded).toLocaleDateString()}
                </Text>
                <MaterialIcons name="calendar-today" size={20} color="#4CAF50" />
              </TouchableOpacity>
            </View>

            {/* Quantity */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Quantity (Liters) *</Text>
              <TextInput
                style={styles.input}
                value={formData.quantity_liters.toString()}
                onChangeText={(text) => setFormData({ ...formData, quantity_liters: parseFloat(text) || 0 })}
                placeholder="e.g., 25.5"
                placeholderTextColor="#666"
                keyboardType="numeric"
              />
            </View>

            {/* Quality Score */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Quality Score (1-10)</Text>
              <TextInput
                style={styles.input}
                value={formData.quality_score.toString()}
                onChangeText={(text) => setFormData({ ...formData, quality_score: parseFloat(text) || 0 })}
                placeholder="e.g., 8.5"
                placeholderTextColor="#666"
                keyboardType="numeric"
              />
            </View>

            {/* Notes */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Notes</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.notes}
                onChangeText={(text) => setFormData({ ...formData, notes: text })}
                placeholder="Additional notes..."
                placeholderTextColor="#666"
                multiline
                numberOfLines={3}
              />
            </View>
          </ScrollView>

          {/* Date Picker */}
          {showDatePicker && (
            <DateTimePicker
              value={new Date(formData.date_recorded)}
              mode="date"
              display="default"
              onChange={onDateChange}
              maximumDate={new Date()}
            />
          )}
        </View>
      </Modal>
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
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  addButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    flex: 1,
    padding: 20,
  },
  recordCard: {
    backgroundColor: '#1E2A35',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2A3A47',
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cattleName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
  },
  date: {
    fontSize: 14,
    color: '#C1C7CD',
  },
  recordDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  detailText: {
    fontSize: 14,
    color: '#C1C7CD',
    marginLeft: 4,
  },
  notes: {
    fontSize: 14,
    color: '#C1C7CD',
    fontStyle: 'italic',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 18,
    color: '#C1C7CD',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#0A1A23',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#2A3A47',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  saveButton: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4CAF50',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1E2A35',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#2A3A47',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    backgroundColor: '#1E2A35',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A3A47',
  },
  picker: {
    color: '#FFFFFF',
    height: 50,
  },
  dateButton: {
    backgroundColor: '#1E2A35',
    borderRadius: 8,
    padding: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A3A47',
  },
  dateText: {
    fontSize: 16,
    color: '#FFFFFF',
  },
});

export default MilkProductionScreen;
