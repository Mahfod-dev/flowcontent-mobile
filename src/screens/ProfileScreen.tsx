import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { NangoConnection, NangoProvider } from '../types';

// "google-search-console" → "Google Search Console"
function formatProviderName(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

interface Props {
  onBack: () => void;
}

export function ProfileScreen({ onBack }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    avatar: '',
    site_name: '',
    phone: '',
  });
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [nangoConnections, setNangoConnections] = useState<NangoConnection[]>([]);
  const [nangoProviders, setNangoProviders] = useState<NangoProvider[]>([]);
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.token) return;
    try {
      const [profileData, intData, connections, providers] = await Promise.all([
        apiService.getProfile(user.token),
        apiService.getMyIntegrations(user.token),
        apiService.getNangoConnections(user.token),
        apiService.getNangoProviders(user.token),
      ]);
      if (profileData) {
        setProfile({
          name: profileData.name || '',
          email: profileData.email || user.email || '',
          avatar: profileData.avatar || '',
          site_name: profileData.site_name || '',
          phone: profileData.phone || '',
        });
      }
      setIntegrations(intData);
      setNangoConnections(connections);
      setNangoProviders(providers);
    } catch {}
    finally { setLoading(false); }
  }, [user?.token, user?.email]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!user?.token) return;
    setSaving(true);
    try {
      const ok = await apiService.updateProfile(user.token, {
        name: profile.name,
        site_name: profile.site_name,
        phone: profile.phone,
      });
      if (ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Profil mis à jour');
      } else {
        Alert.alert('Erreur', 'Impossible de sauvegarder');
      }
    } catch (err: any) {
      Alert.alert('Erreur', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleConnect = async (providerId: string) => {
    if (!user?.token) return;
    setConnectingProvider(providerId);
    try {
      const result = await apiService.initiateOAuth(user.token, providerId);
      if (result?.url) {
        await Linking.openURL(result.url);
      } else {
        Alert.alert('Erreur', 'Impossible de lancer la connexion OAuth');
      }
    } catch (err: any) {
      Alert.alert('Erreur', err.message);
    } finally {
      setConnectingProvider(null);
    }
  };

  const handleDisconnect = async (provider: string) => {
    if (!user?.token) return;
    Alert.alert(
      'Déconnecter',
      `Déconnecter ${provider} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Déconnecter',
          style: 'destructive',
          onPress: async () => {
            const ok = await apiService.deleteNangoConnection(user.token, provider);
            if (ok) {
              setNangoConnections((prev) => prev.filter((c) => c.provider !== provider));
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profil</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#6366F1" size="large" />
        </View>
      </SafeAreaView>
    );
  }

  const activeNangoConnections = nangoConnections.filter((c: any) => {
    const s = (c.status || '').toUpperCase();
    return c.connected || s === 'ACTIVE' || s === 'CONNECTED';
  });
  const connectedProviders = new Set(activeNangoConnections.map((c) => c.provider));

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profil</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving}>
          <Text style={[styles.saveBtn, saving && { opacity: 0.5 }]}>
            {saving ? '...' : 'Sauver'}
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.form}>
          <View style={styles.avatarSection}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(profile.name?.[0] || profile.email?.[0] || '?').toUpperCase()}
              </Text>
            </View>
          </View>

          <Text style={styles.label}>Nom</Text>
          <TextInput
            style={styles.input}
            value={profile.name}
            onChangeText={(v) => setProfile((p) => ({ ...p, name: v }))}
            placeholder="Votre nom"
            placeholderTextColor="#6B7280"
          />

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={[styles.input, styles.inputDisabled]}
            value={profile.email}
            editable={false}
          />

          <Text style={styles.label}>Nom du site</Text>
          <TextInput
            style={styles.input}
            value={profile.site_name}
            onChangeText={(v) => setProfile((p) => ({ ...p, site_name: v }))}
            placeholder="Mon site"
            placeholderTextColor="#6B7280"
          />

          <Text style={styles.label}>Téléphone</Text>
          <TextInput
            style={styles.input}
            value={profile.phone}
            onChangeText={(v) => setProfile((p) => ({ ...p, phone: v }))}
            placeholder="+33 6 00 00 00 00"
            placeholderTextColor="#6B7280"
            keyboardType="phone-pad"
          />

          {/* Connecteurs — unified view */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Connecteurs ({integrations.length + activeNangoConnections.length})
            </Text>

            {/* Connected integrations (from /api/integrations/my) */}
            {integrations.map((integ: any) => (
              <View key={integ.id} style={styles.connectorCard}>
                <View style={styles.connectorInfo}>
                  <View style={styles.connectorHeader}>
                    <View style={[styles.connectorDot, integ.isActive ? styles.dotActive : styles.dotInactive]} />
                    <Text style={styles.connectorName}>
                      {integ.providerDisplayName || integ.displayName || integ.provider_display_name || integ.provider || integ.name || '?'}
                    </Text>
                  </View>
                  {(integ.providerAccountEmail || integ.providerAccountName || integ.provider_account_email) && (
                    <Text style={styles.connectorAccount}>
                      {integ.providerAccountEmail || integ.providerAccountName || integ.provider_account_email}
                    </Text>
                  )}
                </View>
                <View style={[styles.connectorBadge, !integ.isActive && { backgroundColor: '#1C1917' }]}>
                  <Text style={[styles.connectorBadgeText, !integ.isActive && { color: '#6B7280' }]}>
                    {integ.isActive ? 'Actif' : 'Inactif'}
                  </Text>
                </View>
              </View>
            ))}

            {/* Nango connections */}
            {activeNangoConnections.map((conn: any) => {
              const providerInfo = nangoProviders.find((p: any) => (p.id || p.name) === conn.provider || p.name === conn.provider_config_key);
              const connName = providerInfo?.displayName || providerInfo?.display_name || conn.provider_display_name || conn.displayName || formatProviderName(conn.provider || conn.provider_config_key || '?');
              return (
                <View key={`nango-${conn.provider}`} style={styles.connectorCard}>
                  <View style={styles.connectorInfo}>
                    <View style={styles.connectorHeader}>
                      <View style={[styles.connectorDot, styles.dotActive]} />
                      <Text style={styles.connectorName}>{connName}</Text>
                    </View>
                    {conn.account_name && (
                      <Text style={styles.connectorAccount}>{conn.account_name}</Text>
                    )}
                  </View>
                  <TouchableOpacity
                    style={styles.disconnectBtn}
                    onPress={() => handleDisconnect(conn.provider)}
                  >
                    <Text style={styles.disconnectText}>Retirer</Text>
                  </TouchableOpacity>
                </View>
              );
            })}

            {/* Failed Nango connections */}
            {nangoConnections.filter((c: any) => {
              const s = (c.status || '').toUpperCase();
              return s === 'FAILED' || s === 'ERROR';
            }).map((conn: any) => (
              <View key={`nango-fail-${conn.provider}`} style={[styles.connectorCard, { borderColor: '#7F1D1D' }]}>
                <View style={styles.connectorInfo}>
                  <View style={styles.connectorHeader}>
                    <View style={[styles.connectorDot, { backgroundColor: '#EF4444' }]} />
                    <Text style={styles.connectorName}>{formatProviderName(conn.provider)}</Text>
                  </View>
                </View>
                <View style={[styles.connectorBadge, { backgroundColor: '#7F1D1D' }]}>
                  <Text style={[styles.connectorBadgeText, { color: '#EF4444' }]}>Erreur</Text>
                </View>
              </View>
            ))}

            {integrations.length === 0 && activeNangoConnections.length === 0 && (
              <Text style={styles.noConnectors}>Aucun connecteur actif</Text>
            )}
          </View>

          {/* Available providers to connect */}
          {nangoProviders.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Connecter un service</Text>
              {nangoProviders.map((provider: any) => {
                const pid = provider.id || provider.name;
                const pName = provider.displayName || provider.display_name || provider.name || pid;
                const isConnected = connectedProviders.has(pid)
                  || integrations.some((i: any) => (i.provider === pid || i.name === pid) && i.isActive);
                return (
                  <View key={pid} style={styles.providerRow}>
                    <View style={styles.providerInfo}>
                      <Text style={styles.providerName}>{pName}</Text>
                      {provider.description && (
                        <Text style={styles.providerDesc} numberOfLines={1}>{provider.description}</Text>
                      )}
                    </View>
                    {isConnected ? (
                      <View style={styles.connectedBadge}>
                        <Text style={styles.connectedBadgeText}>Connecté</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.connectBtn}
                        onPress={() => handleConnect(provider.id)}
                        disabled={connectingProvider === provider.id}
                      >
                        <Text style={styles.connectText}>
                          {connectingProvider === provider.id ? '...' : 'Connecter'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0E17' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#1E1B4B', borderBottomWidth: 1, borderBottomColor: '#312E81',
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  backIcon: { color: '#fff', fontSize: 22 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  saveBtn: { color: '#6366F1', fontSize: 15, fontWeight: '700' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  form: { padding: 20, gap: 4 },
  avatarSection: { alignItems: 'center', marginBottom: 20 },
  avatar: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: '#6366F1',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { color: '#fff', fontSize: 28, fontWeight: '700' },
  label: { color: '#A5B4FC', fontSize: 12, fontWeight: '600', marginTop: 12, marginBottom: 4 },
  input: {
    backgroundColor: '#1E1B4B', color: '#fff', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15,
    borderWidth: 1, borderColor: '#312E81',
  },
  inputDisabled: { opacity: 0.5 },
  section: { marginTop: 24 },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 12 },
  // Connector cards
  connectorCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#1E1B4B', borderRadius: 12, padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: '#312E81',
  },
  connectorInfo: { flex: 1, marginRight: 10 },
  connectorHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  connectorDot: { width: 8, height: 8, borderRadius: 4 },
  dotActive: { backgroundColor: '#22C55E' },
  dotInactive: { backgroundColor: '#6B7280' },
  connectorName: { color: '#fff', fontSize: 14, fontWeight: '600' },
  connectorAccount: { color: '#A5B4FC', fontSize: 12, marginTop: 4, marginLeft: 16 },
  connectorScopes: { color: '#6B7280', fontSize: 11, marginTop: 2, marginLeft: 16 },
  connectorBadge: {
    backgroundColor: '#065F46', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
  },
  connectorBadgeText: { color: '#22C55E', fontSize: 11, fontWeight: '600' },
  noConnectors: { color: '#6B7280', fontSize: 13, textAlign: 'center', paddingVertical: 16 },
  // Provider rows
  providerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1E1B4B',
  },
  providerInfo: { flex: 1, marginRight: 10 },
  providerName: { color: '#fff', fontSize: 14, fontWeight: '600' },
  providerDesc: { color: '#6B7280', fontSize: 12, marginTop: 2 },
  connectedBadge: {
    backgroundColor: '#1E1B4B', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    borderWidth: 1, borderColor: '#22C55E',
  },
  connectedBadgeText: { color: '#22C55E', fontSize: 12, fontWeight: '600' },
  connectBtn: {
    backgroundColor: '#6366F1', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
  },
  connectText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  disconnectBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
    borderWidth: 1, borderColor: '#EF4444',
  },
  disconnectText: { color: '#EF4444', fontSize: 12, fontWeight: '600' },
});
