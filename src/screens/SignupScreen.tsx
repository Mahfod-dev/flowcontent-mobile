import React, { useEffect, useMemo, useState } from 'react';
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
import { useColors } from '../contexts/ThemeContext';
import { t } from '../i18n';
import { ColorPalette, radii, shadows, spacing } from '../theme';

WebBrowser.maybeCompleteAuthSession();

interface Props {
  onSwitchToLogin: () => void;
}

export function SignupScreen({ onSwitchToLogin }: Props) {
  const { register, loginWithGoogleCode } = useAuth();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const [request, response, promptAsync] = Google.useAuthRequest({
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    redirectUri: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
      ? `com.googleusercontent.apps.${process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID.split('.')[0]}:/oauthredirect`
      : undefined,
  });

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

  const handleRegister = async () => {
    if (!name.trim()) {
      setError(t('enterName'));
      return;
    }
    if (!email.trim()) {
      setError(t('enterEmail'));
      return;
    }
    if (!password || password.length < 8) {
      setError(t('passwordTooShort'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      await register(name.trim(), email.trim().toLowerCase(), password);
    } catch (err: any) {
      setError(err.message || 'Inscription échouée');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    setGoogleLoading(true);
    setError('');
    try {
      await promptAsync();
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
          <Text style={styles.subtitle}>{t('signupSubtitle')}</Text>

          <TextInput
            style={[styles.input, focusedField === 'name' && styles.inputFocused]}
            placeholder={t('fullName')}
            placeholderTextColor={colors.textTertiary}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            onFocus={() => setFocusedField('name')}
            onBlur={() => setFocusedField(null)}
          />
          <TextInput
            style={[styles.input, focusedField === 'email' && styles.inputFocused]}
            placeholder={t('email')}
            placeholderTextColor={colors.textTertiary}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            onFocus={() => setFocusedField('email')}
            onBlur={() => setFocusedField(null)}
          />
          <TextInput
            style={[styles.input, focusedField === 'password' && styles.inputFocused]}
            placeholder={t('passwordMinLength')}
            placeholderTextColor={colors.textTertiary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleRegister}
            onFocus={() => setFocusedField('password')}
            onBlur={() => setFocusedField(null)}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={loading || googleLoading} activeOpacity={0.7}>
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.buttonText}>{t('createMyAccount')}</Text>
            )}
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{t('or')}</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={styles.googleButton}
            onPress={handleGoogleSignup}
            disabled={!request || loading || googleLoading}
            activeOpacity={0.7}
          >
            {googleLoading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <Text style={styles.googleIcon}>G</Text>
                <Text style={styles.googleText}>{t('continueWithGoogle')}</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={onSwitchToLogin} activeOpacity={0.7}>
            <Text style={styles.switchText}>
              {t('hasAccount')}{' '}
              <Text style={styles.switchLink}>{t('login')}</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
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
  switchText: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
  switchLink: {
    color: colors.accent,
    fontWeight: '600',
  },
});
