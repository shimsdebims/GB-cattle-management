import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const FinancialScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Financial Management</Text>
      <Text style={styles.subtitle}>Coming Soon...</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0A1A23',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#C1C7CD',
  },
});

export default FinancialScreen;
