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
import * as Haptics from 'expo-haptics';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';

interface Props {
  onBack: () => void;
}

export function ProfileScreen({ onBack }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    first_name: '',
    last_name: '',
    email: '',
    website: '',
    company: '',
    bio: '',
  });
  const [integrations, setIntegrations] = useState<any[]>([]);

  const load = useCallback(async () => {
    if (!user?.token) return;
    try {
      const [profileData, intData] = await Promise.all([
        apiService.getProfile(user.token),
        apiService.getMyIntegrations(user.token),
      ]);
      if (profileData) {
        setProfile({
          first_name: profileData.first_name || profileData.name?.split(' ')[0] || '',
          last_name: profileData.last_name || profileData.name?.split(' ').slice(1).join(' ') || '',
          email: profileData.email || user.email || '',
          website: profileData.website || '',
          company: profileData.company || '',
          bio: profileData.bio || '',
        });
      }
      setIntegrations(intData);
    } catch {}
    finally { setLoading(false); }
  }, [user?.token, user?.email]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!user?.token) return;
    setSaving(true);
    try {
      const ok = await apiService.updateProfile(user.token, profile);
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
                {(profile.first_name?.[0] || profile.email?.[0] || '?').toUpperCase()}
              </Text>
            </View>
          </View>

          <Text style={styles.label}>Prénom</Text>
          <TextInput
            style={styles.input}
            value={profile.first_name}
            onChangeText={(v) => setProfile((p) => ({ ...p, first_name: v }))}
            placeholder="Prénom"
            placeholderTextColor="#6B7280"
          />

          <Text style={styles.label}>Nom</Text>
          <TextInput
            style={styles.input}
            value={profile.last_name}
            onChangeText={(v) => setProfile((p) => ({ ...p, last_name: v }))}
            placeholder="Nom"
            placeholderTextColor="#6B7280"
          />

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={[styles.input, styles.inputDisabled]}
            value={profile.email}
            editable={false}
          />

          <Text style={styles.label}>Site web</Text>
          <TextInput
            style={styles.input}
            value={profile.website}
            onChangeText={(v) => setProfile((p) => ({ ...p, website: v }))}
            placeholder="https://monsite.com"
            placeholderTextColor="#6B7280"
            keyboardType="url"
            autoCapitalize="none"
          />

          <Text style={styles.label}>Entreprise</Text>
          <TextInput
            style={styles.input}
            value={profile.company}
            onChangeText={(v) => setProfile((p) => ({ ...p, company: v }))}
            placeholder="Nom de l'entreprise"
            placeholderTextColor="#6B7280"
          />

          <Text style={styles.label}>Bio</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={profile.bio}
            onChangeText={(v) => setProfile((p) => ({ ...p, bio: v }))}
            placeholder="Quelques mots sur vous..."
            placeholderTextColor="#6B7280"
            multiline
            numberOfLines={3}
          />

          {/* Connected integrations */}
          {integrations.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Intégrations connectées</Text>
              {integrations.map((integ) => (
                <View key={integ.id} style={styles.integrationRow}>
                  <View style={[styles.integrationDot, integ.isActive && styles.integrationDotActive]} />
                  <Text style={styles.integrationName}>
                    {integ.providerDisplayName || integ.provider}
                  </Text>
                  {integ.providerAccountName && (
                    <Text style={styles.integrationAccount}>{integ.providerAccountName}</Text>
                  )}
                </View>
              ))}
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
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
  section: { marginTop: 24 },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 12 },
  integrationRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1E1B4B',
  },
  integrationDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#6B7280' },
  integrationDotActive: { backgroundColor: '#22C55E' },
  integrationName: { color: '#fff', fontSize: 14, fontWeight: '600' },
  integrationAccount: { color: '#6B7280', fontSize: 12 },
});
