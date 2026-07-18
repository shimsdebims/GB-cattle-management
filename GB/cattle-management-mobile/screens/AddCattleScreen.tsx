import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useOfflineAPI } from '../hooks/useOfflineAPI';
import { CattleFormData } from '../types';

const AddCattleScreen = () => {
  const navigation = useNavigation();
  const { createCattle } = useOfflineAPI();
  
  const [formData, setFormData] = useState<CattleFormData>({
    tag_number: '',
    name: '',
    breed: 'Holstein',
    date_of_birth: new Date().toISOString(),
    gender: 'Female',
    weight: 0,
    health_status: 'Healthy',
    location: '',
    purchase_date: new Date().toISOString(),
    purchase_price: 0,
    current_status: 'Active',
    notes: '',
  });

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showPurchaseDatePicker, setShowPurchaseDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);

  const breeds = [
    'Holstein', 'Jersey', 'Angus', 'Hereford', 'Brahman', 
    'Simmental', 'Charolais', 'Limousin', 'Other'
  ];

  const healthStatuses = [
    'Healthy', 'Sick', 'Injured', 'Pregnant', 'Recovering'
  ];

  const locations = [
    'Barn A', 'Barn B', 'Pasture 1', 'Pasture 2', 'Quarantine Area', 'Other'
  ];

  const handleSubmit = async () => {
    // Validation
    if (!formData.tag_number.trim()) {
      Alert.alert('Error', 'Tag number is required');
      return;
    }
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }

    setLoading(true);
    try {
      await createCattle(formData);
      Alert.alert('Success', 'Cattle added successfully', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      console.error('Error adding cattle:', error);
      Alert.alert('Error', 'Failed to add cattle. Data saved offline.');
    } finally {
      setLoading(false);
    }
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setFormData({ ...formData, date_of_birth: selectedDate.toISOString() });
    }
  };

  const onPurchaseDateChange = (event: any, selectedDate?: Date) => {
    setShowPurchaseDatePicker(false);
    if (selectedDate) {
      setFormData({ ...formData, purchase_date: selectedDate.toISOString() });
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => navigation.goBack()}
          >
            <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.title}>Add New Cattle</Text>
        </View>

        <View style={styles.form}>
          {/* Tag Number */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Tag Number *</Text>
            <TextInput
              style={styles.input}
              value={formData.tag_number}
              onChangeText={(text) => setFormData({ ...formData, tag_number: text })}
              placeholder="e.g., GB0001"
              placeholderTextColor="#666"
            />
          </View>

          {/* Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Name *</Text>
            <TextInput
              style={styles.input}
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
              placeholder="e.g., Daisy"
              placeholderTextColor="#666"
            />
          </View>

          {/* Breed */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Breed</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={formData.breed}
                onValueChange={(value) => setFormData({ ...formData, breed: value })}
                style={styles.picker}
              >
                {breeds.map((breed) => (
                  <Picker.Item key={breed} label={breed} value={breed} />
                ))}
              </Picker>
            </View>
          </View>

          {/* Gender */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Gender</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={formData.gender}
                onValueChange={(value) => setFormData({ ...formData, gender: value as 'Male' | 'Female' })}
                style={styles.picker}
              >
                <Picker.Item label="Female" value="Female" />
                <Picker.Item label="Male" value="Male" />
              </Picker>
            </View>
          </View>

          {/* Date of Birth */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Date of Birth</Text>
            <TouchableOpacity 
              style={styles.dateButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={styles.dateText}>
                {new Date(formData.date_of_birth).toLocaleDateString()}
              </Text>
              <MaterialIcons name="calendar-today" size={20} color="#4CAF50" />
            </TouchableOpacity>
          </View>

          {/* Weight */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Weight (kg)</Text>
            <TextInput
              style={styles.input}
              value={formData.weight?.toString() || ''}
              onChangeText={(text) => setFormData({ ...formData, weight: parseFloat(text) || 0 })}
              placeholder="e.g., 450"
              placeholderTextColor="#666"
              keyboardType="numeric"
            />
          </View>

          {/* Health Status */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Health Status</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={formData.health_status}
                onValueChange={(value) => setFormData({ ...formData, health_status: value })}
                style={styles.picker}
              >
                {healthStatuses.map((status) => (
                  <Picker.Item key={status} label={status} value={status} />
                ))}
              </Picker>
            </View>
          </View>

          {/* Location */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Location</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={formData.location}
                onValueChange={(value) => setFormData({ ...formData, location: value })}
                style={styles.picker}
              >
                <Picker.Item label="Select Location" value="" />
                {locations.map((location) => (
                  <Picker.Item key={location} label={location} value={location} />
                ))}
              </Picker>
            </View>
          </View>

          {/* Purchase Date */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Purchase Date</Text>
            <TouchableOpacity 
              style={styles.dateButton}
              onPress={() => setShowPurchaseDatePicker(true)}
            >
              <Text style={styles.dateText}>
                {new Date(formData.purchase_date || '').toLocaleDateString()}
              </Text>
              <MaterialIcons name="calendar-today" size={20} color="#4CAF50" />
            </TouchableOpacity>
          </View>

          {/* Purchase Price */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Purchase Price ($)</Text>
            <TextInput
              style={styles.input}
              value={formData.purchase_price?.toString() || ''}
              onChangeText={(text) => setFormData({ ...formData, purchase_price: parseFloat(text) || 0 })}
              placeholder="e.g., 1500"
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

          {/* Submit Button */}
          <TouchableOpacity 
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text style={styles.submitButtonText}>
              {loading ? 'Adding...' : 'Add Cattle'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Date Pickers */}
        {showDatePicker && (
          <DateTimePicker
            value={new Date(formData.date_of_birth)}
            mode="date"
            display="default"
            onChange={onDateChange}
            maximumDate={new Date()}
          />
        )}

        {showPurchaseDatePicker && (
          <DateTimePicker
            value={new Date(formData.purchase_date || '')}
            mode="date"
            display="default"
            onChange={onPurchaseDateChange}
            maximumDate={new Date()}
          />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A1A23',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
  },
  backButton: {
    marginRight: 15,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  form: {
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
  submitButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonDisabled: {
    backgroundColor: '#666',
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});

export default AddCattleScreen;
