import React, { useEffect, useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '../contexts/AuthContext';
import { colors, radii, shadows, spacing } from '../theme';

WebBrowser.maybeCompleteAuthSession();

export function LoginScreen() {
  const { login, loginWithGoogleCode } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const [request, response, promptAsync] = Google.useAuthRequest({
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '323350263219-n1arqbtr8cndcqt6mn1qb4ee9q67i39g.apps.googleusercontent.com',
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    redirectUri: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
      ? `com.googleusercontent.apps.${process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID.split('.')[0]}:/oauthredirect`
      : 'com.googleusercontent.apps.323350263219-n1arqbtr8cndcqt6mn1qb4ee9q67i39g:/oauthredirect',
  });

  // Handle Google OAuth response asynchronously (code exchange happens in background)
  useEffect(() => {
    if (!response) return;
    if (response.type === 'success') {
      if (response.authentication?.accessToken) {
        setGoogleLoading(true);
        loginWithGoogleCode(response.authentication.accessToken)
          .catch((err: any) => setError(err.message || 'Connexion Google échouée'))
          .finally(() => setGoogleLoading(false));
      } else {
        setError('Pas de token reçu de Google');
        setGoogleLoading(false);
      }
    } else if (response.type === 'error') {
      setError(response.error?.message || 'Connexion Google échouée');
      setGoogleLoading(false);
    } else {
      setGoogleLoading(false);
    }
  }, [response, loginWithGoogleCode]);

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Renseignez votre email et mot de passe');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (err: any) {
      setError(err.message || 'Connexion échouée');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError('');
    try {
      await promptAsync();
      // Response is handled in the useEffect above
    } catch (err: any) {
      setError(err.message || 'Connexion Google échouée');
      setGoogleLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.card}>
        <View style={styles.logoRow}>
          <Ionicons name="flash" size={28} color={colors.accent} />
          <Text style={styles.logo}> FlowContent</Text>
        </View>
        <Text style={styles.subtitle}>Connectez-vous à votre assistant IA</Text>

        <TextInput
          style={[styles.input, emailFocused && styles.inputFocused]}
          placeholder="Email"
          placeholderTextColor={colors.textTertiary}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          onFocus={() => setEmailFocused(true)}
          onBlur={() => setEmailFocused(false)}
        />
        <TextInput
          style={[styles.input, passwordFocused && styles.inputFocused]}
          placeholder="Mot de passe"
          placeholderTextColor={colors.textTertiary}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          returnKeyType="done"
          onSubmitEditing={handleLogin}
          onFocus={() => setPasswordFocused(true)}
          onBlur={() => setPasswordFocused(false)}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading || googleLoading} activeOpacity={0.7}>
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.buttonText}>Se connecter</Text>
          )}
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>ou</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity
          style={styles.googleButton}
          onPress={handleGoogleLogin}
          disabled={!request || loading || googleLoading}
          activeOpacity={0.7}
        >
          {googleLoading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <>
              <Text style={styles.googleIcon}>G</Text>
              <Text style={styles.googleText}>Continuer avec Google</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.primary },
  flex: { flex: 1, justifyContent: 'center', padding: spacing.xxl },
  card: {
    backgroundColor: colors.secondary,
    borderRadius: radii.xxl,
    padding: 28,
    gap: spacing.lg,
    ...shadows.card,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { color: colors.text, fontSize: 28, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: colors.textSecondary, fontSize: 14, textAlign: 'center', marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.tertiary,
    color: colors.text,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  inputFocused: {
    borderColor: colors.accent,
  },
  error: { color: colors.error, fontSize: 13, textAlign: 'center' },
  button: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  buttonText: { color: colors.white, fontWeight: '700', fontSize: 16 },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  dividerText: {
    color: colors.textTertiary,
    fontSize: 13,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderRadius: radii.md,
    paddingVertical: 14,
    gap: 10,
  },
  googleIcon: {
    color: '#4285F4',
    fontSize: 20,
    fontWeight: '700',
  },
  googleText: {
    color: '#1F2937',
    fontSize: 15,
    fontWeight: '600',
  },
});
