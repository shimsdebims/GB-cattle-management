import React, { useState } from 'react';
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
import DateTimePicker from '@react-native-community/datetimepicker';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { ApiError } from '../services/api';
import { offlineApi } from '../services/offlineApi';
import { useOfflineAPI } from '../hooks/useOfflineAPI';
import { formatDate, fromDateOnly, toDateOnly, todayDateOnly } from '../utils/date';
import { colors, radius, spacing } from '../constants/theme';
import {
  BREEDS,
  CATTLE_LOCATIONS,
  GENDERS,
  HEALTH_STATUSES,
  LIMITS,
  type Breed,
  type Gender,
  type HealthStatus,
} from '../types';

/**
 * Dropdown options come from the shared vocabulary, so a picker can never offer
 * a value the API will reject (the old screen offered "Limousin", which the
 * backend enum did not accept).
 */
const AddCattleScreen = () => {
  const navigation = useNavigation();
  const { isOnline } = useOfflineAPI();

  const [tagNumber, setTagNumber] = useState('');
  const [name, setName] = useState('');
  const [breed, setBreed] = useState<Breed>('Holstein');
  const [gender, setGender] = useState<Gender>('Female');
  const [dateOfBirth, setDateOfBirth] = useState(todayDateOnly());
  const [weight, setWeight] = useState('');
  const [healthStatus, setHealthStatus] = useState<HealthStatus>('Healthy');
  const [location, setLocation] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [notes, setNotes] = useState('');

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    const tag = tagNumber.trim();

    if (tag.length < LIMITS.TAG_NUMBER_MIN) {
      return Alert.alert(
        'Validation',
        `Tag number must be at least ${LIMITS.TAG_NUMBER_MIN} characters.`
      );
    }
    if (!name.trim()) return Alert.alert('Validation', 'Name is required.');

    const weightValue = weight ? Number(weight) : undefined;
    if (weightValue !== undefined && (Number.isNaN(weightValue) || weightValue <= 0)) {
      return Alert.alert('Validation', 'Weight must be a positive number.');
    }

    const priceValue = purchasePrice ? Number(purchasePrice) : undefined;
    if (priceValue !== undefined && Number.isNaN(priceValue)) {
      return Alert.alert('Validation', 'Purchase price must be a number.');
    }

    setSaving(true);
    try {
      await offlineApi.createCattle({
        tag_number: tag,
        name: name.trim(),
        breed,
        gender,
        // Calendar date, not toISOString(), so the day cannot shift by timezone.
        date_of_birth: dateOfBirth,
        weight: weightValue,
        health_status: healthStatus,
        location: location || undefined,
        purchase_price: priceValue,
        current_status: 'Active',
        notes: notes.trim() || undefined,
      });

      navigation.goBack();
    } catch (error) {
      Alert.alert(
        'Could not add cattle',
        error instanceof ApiError ? error.displayMessage : 'Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Field label={`Tag number * (min ${LIMITS.TAG_NUMBER_MIN} characters)`}>
          <TextInput
            style={styles.input}
            value={tagNumber}
            onChangeText={setTagNumber}
            placeholder="e.g. GB0001"
            placeholderTextColor={colors.textDisabled}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={LIMITS.TAG_NUMBER_MAX}
          />
        </Field>

        <Field label="Name *">
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Daisy"
            placeholderTextColor={colors.textDisabled}
            maxLength={LIMITS.NAME_MAX}
          />
        </Field>

        <Field label="Breed">
          <Options
            values={BREEDS}
            selected={breed}
            onSelect={(value) => setBreed(value as Breed)}
          />
        </Field>

        <Field label="Gender">
          <Options
            values={GENDERS}
            selected={gender}
            onSelect={(value) => setGender(value as Gender)}
          />
        </Field>

        <Field label="Date of birth">
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={styles.dateText}>{formatDate(dateOfBirth)}</Text>
            <MaterialIcons name="calendar-today" size={18} color={colors.primary} />
          </TouchableOpacity>
        </Field>

        <Field label="Weight (kg)">
          <TextInput
            style={styles.input}
            value={weight}
            onChangeText={setWeight}
            placeholder="e.g. 450"
            placeholderTextColor={colors.textDisabled}
            keyboardType="numeric"
          />
        </Field>

        <Field label="Health status">
          <Options
            values={HEALTH_STATUSES}
            selected={healthStatus}
            onSelect={(value) => setHealthStatus(value as HealthStatus)}
          />
        </Field>

        <Field label="Location">
          <Options
            values={CATTLE_LOCATIONS}
            selected={location}
            onSelect={(value) => setLocation(location === value ? '' : value)}
          />
        </Field>

        <Field label="Purchase price (FBu)">
          <TextInput
            style={styles.input}
            value={purchasePrice}
            onChangeText={setPurchasePrice}
            placeholder="e.g. 1500000"
            placeholderTextColor={colors.textDisabled}
            keyboardType="numeric"
          />
        </Field>

        <Field label="Notes">
          <TextInput
            style={[styles.input, styles.textArea]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Optional"
            placeholderTextColor={colors.textDisabled}
            multiline
          />
        </Field>

        {!isOnline && (
          <Text style={styles.offlineNote}>
            You are offline — this animal will be saved locally and synced later.
          </Text>
        )}

        <TouchableOpacity
          style={[styles.submit, saving && styles.disabled]}
          onPress={handleSubmit}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={colors.background} />
          ) : (
            <Text style={styles.submitText}>Add Cattle</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {showDatePicker && (
        <DateTimePicker
          value={fromDateOnly(dateOfBirth)}
          mode="date"
          display="default"
          maximumDate={new Date()}
          onChange={(_event, selected) => {
            setShowDatePicker(false);
            if (selected) setDateOfBirth(toDateOnly(selected));
          }}
        />
      )}
    </KeyboardAvoidingView>
  );
};

// ─── Pieces ──────────────────────────────────────────────────────────────────

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    {children}
  </View>
);

const Options = ({
  values,
  selected,
  onSelect,
}: {
  values: readonly string[];
  selected: string;
  onSelect: (value: string) => void;
}) => (
  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
    <View style={styles.optionRow}>
      {values.map((value) => (
        <TouchableOpacity
          key={value}
          style={[styles.option, selected === value && styles.optionActive]}
          onPress={() => onSelect(value)}
        >
          <Text
            style={[styles.optionText, selected === value && styles.optionTextActive]}
          >
            {value}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  </ScrollView>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, paddingBottom: spacing.xxl * 2 },
  field: { marginBottom: spacing.lg },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
  },
  textArea: { height: 80, textAlignVertical: 'top' },
  dateButton: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateText: { color: colors.text, fontSize: 15 },
  optionRow: { flexDirection: 'row', gap: spacing.sm },
  option: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  optionActive: { backgroundColor: colors.header, borderColor: colors.primary },
  optionText: { color: colors.textMuted, fontSize: 13 },
  optionTextActive: { color: colors.primary, fontWeight: '700' },
  offlineNote: { color: colors.warning, fontSize: 12, marginBottom: spacing.md },
  submit: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  submitText: { color: colors.background, fontSize: 16, fontWeight: '700' },
  disabled: { opacity: 0.6 },
});

export default AddCattleScreen;
