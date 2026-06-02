import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useColors } from '../../contexts/ThemeContext';
import { apiService } from '../../services/api';
import { t } from '../../i18n';
import { SkillsStyles } from './shared';

interface ModesTabProps {
  styles: SkillsStyles;
  modes: any[];
  setModes: React.Dispatch<React.SetStateAction<any[]>>;
  modesLoading: boolean;
}

export function ModesTab({ styles, modes, setModes, modesLoading }: ModesTabProps) {
  const { user } = useAuth();
  const colors = useColors();

  const [activatingMode, setActivatingMode] = useState<string | null>(null);

  const handleToggleMode = useCallback(async (mode: any) => {
    if (!user?.token) return;
    setActivatingMode(mode.id);
    try {
      if (mode.isActivated) {
        await apiService.deactivateMode(user.token, mode.id);
        setModes(prev => prev.map(m => m.id === mode.id ? { ...m, isActivated: false } : m));
        Alert.alert(t('modeDeactivated'));
      } else {
        const result = await apiService.activateMode(user.token, mode.id);
        if (result.success) {
          setModes(prev => prev.map(m => m.id === mode.id ? { ...m, isActivated: true } : m));
          Alert.alert(t('modeActivated'), result.welcomeMessage || '');
        } else {
          Alert.alert(t('modeNeedUpgrade'));
        }
      }
    } catch {
      Alert.alert(t('error'));
    } finally {
      setActivatingMode(null);
    }
  }, [user?.token, setModes]);

  return (
    <View style={styles.tabContent}>
      {modesLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={modes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item: mode }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardName} numberOfLines={1}>{mode.name}</Text>
                {mode.isActivated ? (
                  <View style={styles.modeActiveBadge}>
                    <Text style={styles.modeActiveBadgeText}>{t('modeActive')}</Text>
                  </View>
                ) : (
                  <View style={styles.cardBadge}>
                    <Text style={styles.cardBadgeText}>{(mode.tier || 'pro').toUpperCase()}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.cardDesc} numberOfLines={3}>{mode.description}</Text>
              <View style={styles.cardFooter}>
                <View style={styles.cardMeta}>
                  <Text style={styles.cardSteps}>~{mode.estimatedCredits || 5} {t('skillCredits')}/session</Text>
                  {mode.preferredModel && (
                    <Text style={styles.cardTools}>{mode.preferredModel}</Text>
                  )}
                </View>
                <TouchableOpacity
                  style={[styles.launchBtn, mode.isActivated && styles.modeDeactivateBtn]}
                  onPress={() => handleToggleMode(mode)}
                  activeOpacity={0.7}
                  disabled={activatingMode === mode.id}
                >
                  {activatingMode === mode.id ? (
                    <ActivityIndicator color={colors.white} size="small" />
                  ) : (
                    <>
                      <Ionicons name={mode.isActivated ? 'close-circle-outline' : 'flash-outline'} size={16} color={colors.white} />
                      <Text style={styles.launchBtnText}>
                        {mode.isActivated ? t('modeDeactivate') : t('modeActivate')}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>{t('noData')}</Text>}
        />
      )}
    </View>
  );
}
