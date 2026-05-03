import React, { useCallback, useEffect, useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { NangoConnection, NangoProvider } from '../types';
import { colors, commonStyles, radii, spacing } from '../theme';
import { safeOpenURL } from '../utils/safeOpenURL';

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
        await safeOpenURL(result.url);
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
            try {
              const ok = await apiService.deleteNangoConnection(user.token, provider);
              if (ok) {
                setNangoConnections((prev) => prev.filter((c) => c.provider !== provider));
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
            } catch {
              Alert.alert('Erreur', 'Impossible de déconnecter le service.');
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
          <TouchableOpacity onPress={onBack} style={commonStyles.backBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={commonStyles.headerTitle}>Profil</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={commonStyles.loadingContainer}>
          <ActivityIndicator color={colors.accent} size="large" />
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
        <TouchableOpacity onPress={onBack} style={commonStyles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={commonStyles.headerTitle}>Profil</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving} activeOpacity={0.7}>
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

          <Text style={styles.label}>NOM</Text>
          <TextInput
            style={commonStyles.input}
            value={profile.name}
            onChangeText={(v) => setProfile((p) => ({ ...p, name: v }))}
            placeholder="Votre nom"
            placeholderTextColor={colors.textTertiary}
          />

          <Text style={styles.label}>EMAIL</Text>
          <TextInput
            style={[commonStyles.input, styles.inputDisabled]}
            value={profile.email}
            editable={false}
          />

          <Text style={styles.label}>NOM DU SITE</Text>
          <TextInput
            style={commonStyles.input}
            value={profile.site_name}
            onChangeText={(v) => setProfile((p) => ({ ...p, site_name: v }))}
            placeholder="Mon site"
            placeholderTextColor={colors.textTertiary}
          />

          <Text style={styles.label}>TÉLÉPHONE</Text>
          <TextInput
            style={commonStyles.input}
            value={profile.phone}
            onChangeText={(v) => setProfile((p) => ({ ...p, phone: v }))}
            placeholder="+33 6 00 00 00 00"
            placeholderTextColor={colors.textTertiary}
            keyboardType="phone-pad"
          />

          {/* Connecteurs — unified view */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              CONNECTEURS ({integrations.length + activeNangoConnections.length})
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
                <View style={[styles.connectorBadge, !integ.isActive && { backgroundColor: colors.tertiary }]}>
                  <Text style={[styles.connectorBadgeText, !integ.isActive && { color: colors.textTertiary }]}>
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
                    activeOpacity={0.7}
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
              <View key={`nango-fail-${conn.provider}`} style={[styles.connectorCard, { borderColor: colors.error }]}>
                <View style={styles.connectorInfo}>
                  <View style={styles.connectorHeader}>
                    <View style={[styles.connectorDot, { backgroundColor: colors.error }]} />
                    <Text style={styles.connectorName}>{formatProviderName(conn.provider)}</Text>
                  </View>
                </View>
                <View style={[styles.connectorBadge, { backgroundColor: colors.errorMuted }]}>
                  <Text style={[styles.connectorBadgeText, { color: colors.error }]}>Erreur</Text>
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
              <Text style={styles.sectionTitle}>CONNECTER UN SERVICE</Text>
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
                        activeOpacity={0.7}
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
  container: { flex: 1, backgroundColor: colors.primary },
  header: {
    ...commonStyles.header,
  },
  saveBtn: { color: colors.accent, fontSize: 15, fontWeight: '700' },
  form: { padding: spacing.xl, gap: spacing.xs },
  avatarSection: { alignItems: 'center', marginBottom: spacing.xl },
  avatar: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: colors.accent,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: colors.accentMuted,
  },
  avatarText: { color: colors.white, fontSize: 28, fontWeight: '700' },
  label: {
    color: colors.textTertiary, fontSize: 11, fontWeight: '600',
    letterSpacing: 0.5, marginTop: spacing.md, marginBottom: spacing.xs,
  },
  inputDisabled: { opacity: 0.5 },
  section: { marginTop: spacing.xxl },
  sectionTitle: {
    color: colors.textTertiary, fontSize: 11, fontWeight: '700',
    letterSpacing: 0.5, marginBottom: spacing.md,
  },
  // Connector cards
  connectorCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.secondary, borderRadius: radii.md, padding: 14, marginBottom: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  connectorInfo: { flex: 1, marginRight: 10 },
  connectorHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  connectorDot: { width: 8, height: 8, borderRadius: 4 },
  dotActive: { backgroundColor: colors.success },
  dotInactive: { backgroundColor: colors.textTertiary },
  connectorName: { color: colors.text, fontSize: 14, fontWeight: '600' },
  connectorAccount: { color: colors.textSecondary, fontSize: 12, marginTop: spacing.xs, marginLeft: spacing.lg },
  connectorBadge: {
    backgroundColor: colors.successMuted, paddingHorizontal: 10, paddingVertical: spacing.xs, borderRadius: radii.md,
  },
  connectorBadgeText: { color: colors.success, fontSize: 11, fontWeight: '600' },
  noConnectors: { color: colors.textTertiary, fontSize: 13, textAlign: 'center', paddingVertical: spacing.lg },
  // Provider rows
  providerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  providerInfo: { flex: 1, marginRight: 10 },
  providerName: { color: colors.text, fontSize: 14, fontWeight: '600' },
  providerDesc: { color: colors.textTertiary, fontSize: 12, marginTop: 2 },
  connectedBadge: {
    backgroundColor: colors.secondary, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.sm,
    borderWidth: 1, borderColor: colors.success,
  },
  connectedBadgeText: { color: colors.success, fontSize: 12, fontWeight: '600' },
  connectBtn: {
    backgroundColor: colors.accent, paddingHorizontal: 14, paddingVertical: spacing.sm, borderRadius: radii.sm,
  },
  connectText: { color: colors.white, fontSize: 13, fontWeight: '600' },
  disconnectBtn: {
    paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radii.sm,
    borderWidth: 1, borderColor: colors.error,
  },
  disconnectText: { color: colors.error, fontSize: 12, fontWeight: '600' },
});
