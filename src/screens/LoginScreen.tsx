import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '../contexts/AuthContext';

WebBrowser.maybeCompleteAuthSession();

// iOS native client ID
const GOOGLE_IOS_CLIENT_ID = '323350263219-n1arqbtr8cndcqt6mn1qb4ee9q67i39g.apps.googleusercontent.com';
// Web client ID (needed for expo-auth-session proxy)
const GOOGLE_WEB_CLIENT_ID = '323350263219-o0beqpu2fbhrv8lvki9o2rph12sl2h0n.apps.googleusercontent.com';

const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
};

export function LoginScreen() {
  const { login, loginWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  const redirectUri = AuthSession.makeRedirectUri({
    scheme: 'com.googleusercontent.apps.323350263219-n1arqbtr8cndcqt6mn1qb4ee9q67i39g',
  });

  const [request, , promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: GOOGLE_IOS_CLIENT_ID,
      scopes: ['openid', 'profile', 'email'],
      redirectUri,
      responseType: AuthSession.ResponseType.IdToken,
    },
    discovery
  );

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
      const result = await promptAsync();
      if (result.type === 'success' && result.params?.id_token) {
        await loginWithGoogle(result.params.id_token);
      } else if (result.type === 'error') {
        setError(result.error?.message || 'Connexion Google échouée');
      }
    } catch (err: any) {
      setError(err.message || 'Connexion Google échouée');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.card}>
        <Text style={styles.logo}>⚡ FlowContent</Text>
        <Text style={styles.subtitle}>Connectez-vous à votre assistant IA</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#6B7280"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={styles.input}
          placeholder="Mot de passe"
          placeholderTextColor="#6B7280"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading || googleLoading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
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
        >
          {googleLoading ? (
            <ActivityIndicator color="#fff" />
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
  container: { flex: 1, backgroundColor: '#0F0E17' },
  flex: { flex: 1, justifyContent: 'center', padding: 24 },
  card: { backgroundColor: '#1E1B4B', borderRadius: 20, padding: 28, gap: 16 },
  logo: { color: '#fff', fontSize: 28, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: '#A5B4FC', fontSize: 14, textAlign: 'center', marginBottom: 8 },
  input: {
    backgroundColor: '#312E81',
    color: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#4338CA',
  },
  error: { color: '#F87171', fontSize: 13, textAlign: 'center' },
  button: {
    backgroundColor: '#6366F1',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#4338CA',
  },
  dividerText: {
    color: '#6B7280',
    fontSize: 13,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
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
