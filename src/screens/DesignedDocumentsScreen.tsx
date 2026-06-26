import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { useColors } from '../contexts/ThemeContext';
import { t } from '../i18n';
import { ColorPalette, commonStyles, radii, spacing } from '../theme';
import { safeOpenURL } from '../utils/safeOpenURL';
import {
  DesignedDocumentHistoryItem,
  DesignedDocumentResult,
  DesignedFormat,
  DesignedTheme,
} from '../types';

interface DesignedDocumentsScreenProps {
  onBack: () => void;
}

// Coûts alignés sur le backend (designed-documents.controller COST).
const COST: Record<DesignedFormat, number> = { deck: 8, ebook: 12 };

export function DesignedDocumentsScreen({ onBack }: DesignedDocumentsScreenProps) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [themes, setThemes] = useState<DesignedTheme[]>([]);
  const [history, setHistory] = useState<DesignedDocumentHistoryItem[]>([]);
  const [topic, setTopic] = useState('');
  const [title, setTitle] = useState('');
  const [format, setFormat] = useState<DesignedFormat>('deck');
  const [themeId, setThemeId] = useState<string>('');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<DesignedDocumentResult | null>(null);

  const loadThemes = useCallback(async () => {
    try {
      const data = await apiService.getDesignedThemes();
      setThemes(data);
      // Sélectionne le 1er thème par défaut sans dépendre de themeId
      // (sinon chaque sélection re-déclencherait un fetch).
      if (data.length) setThemeId((prev) => prev || data[0].id);
    } catch (e) {
      console.error('Failed to load designed themes', e);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    if (!user?.token) return;
    try {
      const items = await apiService.getDesignedDocumentsHistory(user.token);
      setHistory(items);
    } catch (e) {
      console.error('Failed to load designed documents history', e);
    }
  }, [user?.token]);

  useEffect(() => { loadThemes(); loadHistory(); }, [loadThemes, loadHistory]);

  const handleGenerate = useCallback(async () => {
    if (!user?.token) return;
    const cleanTopic = topic.trim();
    if (cleanTopic.length < 3) {
      Alert.alert(t('error'), t('ddTopicTooShort'));
      return;
    }
    setGenerating(true);
    setResult(null);
    try {
      const res = await apiService.generateDesignedDocument(user.token, {
        topic: cleanTopic,
        format,
        theme: themeId,
        title: title.trim() || undefined,
      });
      setResult(res);
      loadHistory();
    } catch (e: any) {
      Alert.alert(t('error'), e?.message || t('ddGenerationFailed'));
    } finally {
      setGenerating(false);
    }
  }, [user?.token, topic, title, format, themeId, loadHistory]);

  const openUrl = useCallback(async (url: string | null) => {
    if (!url) {
      Alert.alert(t('error'), t('ddGenerationFailed'));
      return;
    }
    await safeOpenURL(url);
  }, []);

  // Bloque la génération tant que le sujet est trop court ou qu'aucun thème
  // n'est sélectionné (sinon le DTO backend rejette theme='' avec un 400).
  const canGenerate = topic.trim().length >= 3 && !!themeId && !generating;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[commonStyles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={commonStyles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[commonStyles.headerTitle, { color: colors.text }]}>{t('designedDocs')}</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 44}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.hint}>{t('designedDocsHint')}</Text>

          {/* Sujet */}
          <Text style={styles.label}>{t('ddTopic')}</Text>
          <TextInput
            style={styles.input}
            value={topic}
            onChangeText={setTopic}
            placeholder={t('ddTopicPlaceholder')}
            placeholderTextColor={colors.textTertiary}
            multiline
            maxLength={300}
          />

          {/* Titre optionnel */}
          <Text style={styles.label}>{t('ddTitle')}</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder={t('ddTitlePlaceholder')}
            placeholderTextColor={colors.textTertiary}
            maxLength={200}
          />

          {/* Format */}
          <Text style={styles.label}>{t('ddFormat')}</Text>
          <View style={styles.segment}>
            {(['deck', 'ebook'] as DesignedFormat[]).map((f) => (
              <TouchableOpacity
                key={f}
                style={[styles.segmentBtn, format === f && styles.segmentBtnActive]}
                onPress={() => setFormat(f)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityState={{ selected: format === f }}
              >
                <Ionicons
                  name={f === 'deck' ? 'easel-outline' : 'book-outline'}
                  size={18}
                  color={format === f ? colors.white : colors.textSecondary}
                />
                <Text style={[styles.segmentText, format === f && styles.segmentTextActive]}>
                  {f === 'deck' ? t('ddDeck') : t('ddEbook')}
                </Text>
                <Text style={[styles.segmentCost, format === f && styles.segmentTextActive]}>
                  {t('ddCost', { cost: COST[f] })}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Thèmes */}
          <Text style={styles.label}>{t('ddTheme')}</Text>
          <View style={styles.themeGrid}>
            {themes.map((th) => {
              const selected = th.id === themeId;
              return (
                <TouchableOpacity
                  key={th.id}
                  style={[styles.themeChip, selected && { borderColor: colors.accent, borderWidth: 2 }]}
                  onPress={() => setThemeId(th.id)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={th.name}
                >
                  <View style={[styles.themeSwatch, { backgroundColor: th.bg }]}>
                    <View style={[styles.themeDot, { backgroundColor: th.accent }]} />
                    <View style={[styles.themeDot, { backgroundColor: th.accent2 }]} />
                  </View>
                  <Text style={styles.themeName} numberOfLines={1}>
                    {th.name.split('—')[0].trim()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Générer */}
          <TouchableOpacity
            style={[styles.generateBtn, !canGenerate && styles.generateBtnDisabled]}
            onPress={handleGenerate}
            disabled={!canGenerate}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canGenerate, busy: generating }}
            accessibilityLabel={t('ddGenerate')}
          >
            {generating ? (
              <>
                <ActivityIndicator color={colors.white} />
                <Text style={styles.generateText}>{t('ddGenerating')}</Text>
              </>
            ) : (
              <>
                <Ionicons name="sparkles" size={18} color={colors.white} />
                <Text style={styles.generateText}>
                  {t('ddGenerate')} · {t('ddCost', { cost: COST[format] })}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Résultat */}
          {result && (
            <View style={styles.resultCard}>
              <View style={styles.resultHeader}>
                <Ionicons name="checkmark-circle" size={20} color={colors.success ?? colors.accent} />
                <Text style={styles.resultTitle}>{t('ddResultTitle')}</Text>
              </View>
              <Text style={styles.resultName} numberOfLines={2}>{result.title}</Text>
              <Text style={styles.resultMeta}>
                {t('ddPagesCount', { count: result.pages_count })} · {result.size_kb} Ko
              </Text>
              <TouchableOpacity
                style={styles.openBtn}
                onPress={() => openUrl(result.download_url)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={t('ddOpenPdf')}
              >
                <Ionicons name="document-text-outline" size={18} color={colors.accent} />
                <Text style={styles.openBtnText}>{t('ddOpenPdf')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Historique */}
          <Text style={[styles.label, { marginTop: spacing.xl }]}>{t('ddHistory')}</Text>
          {history.length === 0 ? (
            <Text style={styles.emptyHistory}>{t('ddNoHistory')}</Text>
          ) : (
            history.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.historyRow}
                onPress={() => openUrl(item.download_url)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`${item.title} — ${t('ddOpenPdf')}`}
              >
                <Ionicons
                  name={item.format === 'deck' ? 'easel-outline' : 'book-outline'}
                  size={20}
                  color={colors.textSecondary}
                />
                <View style={styles.historyInfo}>
                  <Text style={styles.historyName} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.historyMeta}>
                    {t('ddPagesCount', { count: item.pages_count })} · {item.size_kb} Ko ·{' '}
                    {new Date(item.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  content: {
    padding: spacing.lg,
  },
  hint: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: spacing.lg,
  },
  label: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  input: {
    backgroundColor: colors.secondary,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
    fontSize: 14,
    minHeight: 44,
  },
  segment: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.md,
    borderRadius: radii.sm,
    backgroundColor: colors.secondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentBtnActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  segmentText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  segmentCost: {
    color: colors.textTertiary,
    fontSize: 12,
  },
  segmentTextActive: {
    color: colors.white,
  },
  themeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  themeChip: {
    width: '31%',
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.secondary,
    padding: 6,
  },
  themeSwatch: {
    height: 40,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    padding: 6,
  },
  themeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  themeName: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 5,
  },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accent,
    borderRadius: radii.sm,
    paddingVertical: spacing.md,
    marginTop: spacing.xl,
  },
  generateBtnDisabled: {
    opacity: 0.7,
  },
  generateText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  resultCard: {
    marginTop: spacing.lg,
    backgroundColor: colors.secondary,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.sm,
  },
  resultTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  resultName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  resultMeta: {
    color: colors.textTertiary,
    fontSize: 12,
    marginBottom: spacing.md,
  },
  openBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.md,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  openBtnText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '700',
  },
  emptyHistory: {
    color: colors.textTertiary,
    fontSize: 13,
    paddingVertical: spacing.md,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.secondary,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xs,
  },
  historyInfo: {
    flex: 1,
  },
  historyName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 3,
  },
  historyMeta: {
    color: colors.textTertiary,
    fontSize: 12,
  },
});
