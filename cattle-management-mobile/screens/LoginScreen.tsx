import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { ApiError, authAPI } from '../services/api';
import { saveSession } from '../services/authStore';
import { synchronize } from '../services/offlineApi';
import { colors, radius, spacing } from '../constants/theme';

/** French first (Kirundi follows once the translation layer lands in phase 4). */
const LoginScreen = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!username.trim() || !password) {
      setError("Saisissez votre nom d'utilisateur et votre mot de passe.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { token, user } = await authAPI.login(username.trim(), password);
      await saveSession(token, user);
      // Send anything recorded while the session was expired.
      void synchronize();
    } catch (err) {
      if (err instanceof ApiError && err.isNetworkError) {
        setError('Impossible de joindre le serveur. Vérifiez la connexion et réessayez.');
      } else if (err instanceof ApiError && err.code === 'LOGIN_RATE_LIMITED') {
        setError('Trop de tentatives. Attendez 15 minutes puis réessayez.');
      } else if (err instanceof ApiError && err.status === 401) {
        setError("Nom d'utilisateur ou mot de passe incorrect.");
      } else {
        setError('La connexion a échoué. Réessayez.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <MaterialIcons name="pets" size={40} color={colors.primary} style={styles.logo} />
        <Text style={styles.title}>Gestion du troupeau</Text>
        <Text style={styles.subtitle}>Connectez-vous pour continuer</Text>

        <Text style={styles.label}>Nom d'utilisateur</Text>
        <TextInput
          style={styles.input}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          textContentType="username"
          returnKeyType="next"
          placeholderTextColor={colors.textDisabled}
        />

        <Text style={styles.label}>Mot de passe</Text>
        <View style={styles.passwordRow}>
          <TextInput
            style={[styles.input, styles.passwordInput]}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoComplete="password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={submit}
            placeholderTextColor={colors.textDisabled}
          />
          <TouchableOpacity
            style={styles.eye}
            onPress={() => setShowPassword((v) => !v)}
            accessibilityLabel={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          >
            <MaterialIcons
              name={showPassword ? 'visibility-off' : 'visibility'}
              size={22}
              color={colors.textMuted}
            />
          </TouchableOpacity>
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity
          style={[styles.button, busy && styles.disabled]}
          onPress={submit}
          disabled={busy}
          accessibilityRole="button"
        >
          {busy ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={styles.buttonText}>Se connecter</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xxl,
  },
  logo: { alignSelf: 'center', marginBottom: spacing.sm },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
  label: {
    color: colors.textMuted,
    fontSize: 14,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  input: {
    backgroundColor: colors.surfaceAlt,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16,
  },
  passwordRow: { flexDirection: 'row', alignItems: 'center' },
  passwordInput: { flex: 1 },
  eye: { padding: spacing.md, marginLeft: spacing.xs },
  error: {
    color: colors.danger,
    fontSize: 14,
    marginTop: spacing.md,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  buttonText: { color: colors.background, fontSize: 16, fontWeight: '700' },
  disabled: { opacity: 0.6 },
});

export default LoginScreen;
