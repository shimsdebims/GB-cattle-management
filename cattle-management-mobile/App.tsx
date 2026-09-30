import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';

import AppNavigator from './navigation/AppNavigator';
import { initOfflineSync } from './services/offlineApi';
import { bootstrapAuth } from './hooks/useAuth';
import { colors } from './constants/theme';

export default function App() {
  useEffect(() => {
    // Decide between the login screen and the app before anything loads.
    void bootstrapAuth();
    // Starts connectivity tracking and replays any queued writes on reconnect.
    const stop = initOfflineSync();
    return stop;
  }, []);

  return (
    <>
      <AppNavigator />
      <StatusBar style="light" backgroundColor={colors.header} />
    </>
  );
}
