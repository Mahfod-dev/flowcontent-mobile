import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
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
import { apiService } from '../services/api';
import { ColorPalette, radii, shadows, spacing } from '../theme';

WebBrowser.maybeCompleteAuthSession();

interface Props {
  onSwitchToSignup?: () => void;
  onLoginSuccess?: (email: string, password: string) => void;
}

export function LoginScreen({ onSwitchToSignup, onLoginSuccess }: Props) {
  const { login, loginWithGoogleCode } = useAuth();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [forgotModalVisible, setForgotModalVisible] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  const [request, response, promptAsync] = Google.useAuthRequest({
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    redirectUri: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
      ? `com.googleusercontent.apps.${process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID.split('.')[0]}:/oauthredirect`
      : undefined,
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
      setError(t('fillEmailPassword'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      const trimmedEmail = email.trim().toLowerCase();
      await login(trimmedEmail, password);
      // Save credentials for biometric auto-login
      onLoginSuccess?.(trimmedEmail, password);
    } catch (err: any) {
      setError(err.message || 'Connexion échouée');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!forgotEmail.trim()) return;
    setForgotLoading(true);
    try {
      await apiService.forgotPassword(forgotEmail.trim().toLowerCase());
      setForgotModalVisible(false);
      setForgotEmail('');
      Alert.alert(t('emailSent'), t('forgotSubtitle'));
    } catch (err: any) {
      Alert.alert('Erreur', err.message || 'Impossible d\'envoyer l\'email');
    } finally {
      setForgotLoading(false);
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
        <Text style={styles.subtitle}>{t('loginSubtitle')}</Text>

        <TextInput
          style={[styles.input, emailFocused && styles.inputFocused]}
          placeholder={t('email')}
          placeholderTextColor={colors.textTertiary}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          onFocus={() => setEmailFocused(true)}
          onBlur={() => setEmailFocused(false)}
          accessibilityLabel={t('email')}
          textContentType="emailAddress"
          autoComplete="email"
        />
        <TextInput
          style={[styles.input, passwordFocused && styles.inputFocused]}
          placeholder={t('password')}
          placeholderTextColor={colors.textTertiary}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          returnKeyType="done"
          onSubmitEditing={handleLogin}
          onFocus={() => setPasswordFocused(true)}
          onBlur={() => setPasswordFocused(false)}
          accessibilityLabel={t('password')}
          textContentType="password"
          autoComplete="password"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity onPress={() => { setForgotEmail(email); setForgotModalVisible(true); }} activeOpacity={0.7}>
          <Text style={styles.forgotText}>{t('forgotPassword')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading || googleLoading} activeOpacity={0.7} accessibilityLabel={t('login')} accessibilityRole="button">
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.buttonText}>{t('login')}</Text>
          )}
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>{t('or')}</Text>
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
              <Text style={styles.googleText}>{t('continueWithGoogle')}</Text>
            </>
          )}
        </TouchableOpacity>

        {onSwitchToSignup && (
          <TouchableOpacity onPress={onSwitchToSignup} activeOpacity={0.7}>
            <Text style={styles.switchText}>
              {t('noAccount')}{' '}
              <Text style={styles.switchLink}>{t('signup')}</Text>
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Forgot Password Modal */}
      <Modal visible={forgotModalVisible} transparent animationType="fade" onRequestClose={() => setForgotModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setForgotModalVisible(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('forgotTitle')}</Text>
            <Text style={styles.modalSubtitle}>{t('forgotSubtitle')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('email')}
              placeholderTextColor={colors.textTertiary}
              value={forgotEmail}
              onChangeText={setForgotEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoFocus
            />
            <TouchableOpacity
              style={[styles.button, !forgotEmail.trim() && styles.buttonDisabled]}
              onPress={handleForgotPassword}
              disabled={!forgotEmail.trim() || forgotLoading}
              activeOpacity={0.7}
            >
              {forgotLoading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.buttonText}>{t('sendLink')}</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setForgotModalVisible(false)} activeOpacity={0.7}>
              <Text style={styles.cancelText}>{t('cancel')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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
  forgotText: {
    color: colors.accent,
    fontSize: 13,
    textAlign: 'right',
    marginTop: -spacing.sm,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.secondary,
    borderRadius: radii.lg,
    padding: spacing.xl,
    width: 300,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  modalSubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
  },
  buttonDisabled: {
    backgroundColor: colors.tertiary,
  },
  cancelText: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
});
