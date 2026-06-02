import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useColors } from '../../contexts/ThemeContext';
import { apiService } from '../../services/api';
import { t } from '../../i18n';
import { AgentTool, Credits, Skill } from '../../types';
import { CATEGORY_OPTIONS, SKILL_CATEGORIES, SkillsStyles } from './shared';

interface PipelinesTabProps {
  styles: SkillsStyles;
  activeDomain?: string | null;
  onLaunchSkill: (skillId: string, params: Record<string, string>) => void;
  showCreate: boolean;
  onCloseCreate: () => void;
  tools: AgentTool[];
  skills: Skill[];
  loading: boolean;
  reload: () => Promise<void> | void;
}

type CategoryItem = (typeof SKILL_CATEGORIES)[number];

const SKILL_CATEGORIES_ARRAY: CategoryItem[] = [...SKILL_CATEGORIES];

export function PipelinesTab({
  styles,
  activeDomain,
  onLaunchSkill,
  showCreate,
  onCloseCreate,
  tools,
  skills,
  loading,
  reload,
}: PipelinesTabProps) {
  const { user } = useAuth();
  const colors = useColors();

  // Category & filter
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Detail / confirm modal state
  const [detailSkill, setDetailSkill] = useState<Skill | null>(null);
  const [confirmSkill, setConfirmSkill] = useState<Skill | null>(null);
  const [credits, setCredits] = useState<Credits | null>(null);
  const [creditsLoading, setCreditsLoading] = useState(false);
  const [paramDomain, setParamDomain] = useState(activeDomain || '');
  const [paramTopic, setParamTopic] = useState('');
  const [paramLanguage, setParamLanguage] = useState('fr');

  // Create skill modal
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createPrompt, setCreatePrompt] = useState('');
  const [createCategory, setCreateCategory] = useState('seo');
  const [createTools, setCreateTools] = useState<string[]>([]);
  const [createToolSearch, setCreateToolSearch] = useState('');
  const [creating, setCreating] = useState(false);

  const filteredSkills = useMemo(() => {
    if (selectedCategory === 'all') return skills;
    return skills.filter((s) => s.category === selectedCategory);
  }, [skills, selectedCategory]);

  const handleOpenDetail = useCallback((skill: Skill) => {
    setDetailSkill(skill);
    setParamDomain(activeDomain || '');
    setParamTopic('');
    setParamLanguage('fr');
  }, [activeDomain]);

  const handleRequestLaunch = useCallback(async () => {
    if (!detailSkill || !user?.token) return;
    setCreditsLoading(true);
    try {
      const creds = await apiService.getCredits(user.token);
      setCredits(creds);
      if (creds && creds.total_available < detailSkill.estimated_credits) {
        // Not enough credits — show insufficient modal
        setDetailSkill(null);
        setTimeout(() => {
          setConfirmSkill({ ...detailSkill, estimated_credits: -1 } as Skill);
        }, 100);
        return;
      }
      // Enough credits — launch directly without confirm step
      const params: Record<string, string> = {};
      if (paramDomain) params.domain = paramDomain;
      if (paramTopic) params.topic = paramTopic;
      if (paramLanguage) params.language = paramLanguage;
      setDetailSkill(null);
      onLaunchSkill(detailSkill.id, params);
    } catch {} finally {
      setCreditsLoading(false);
    }
  }, [detailSkill, user?.token, paramDomain, paramTopic, paramLanguage, onLaunchSkill]);

  const handleConfirmLaunch = useCallback(() => {
    if (!confirmSkill) return;
    const params: Record<string, string> = {};
    if (paramDomain) params.domain = paramDomain;
    if (paramTopic) params.topic = paramTopic;
    if (paramLanguage) params.language = paramLanguage;
    setDetailSkill(null);
    setConfirmSkill(null);
    onLaunchSkill(confirmSkill.id, params);
  }, [confirmSkill, paramDomain, paramTopic, paramLanguage, onLaunchSkill]);

  const handleCreateSkill = useCallback(async () => {
    if (!user?.token || !createName.trim() || !createDesc.trim() || !createPrompt.trim()) return;
    setCreating(true);
    try {
      const result = await apiService.createSkill(user.token, {
        name: createName.trim().replace(/\s+/g, '_').toLowerCase(),
        description: createDesc.trim(),
        system_prompt: createPrompt.trim(),
        category: createCategory,
        tools_whitelist: createTools,
      });
      if (result) {
        Alert.alert(t('skillCreated'));
        onCloseCreate();
        setCreateName('');
        setCreateDesc('');
        setCreatePrompt('');
        setCreateTools([]);
        reload();
      } else {
        Alert.alert(t('error'), t('skillCreateError'));
      }
    } catch {
      Alert.alert(t('error'), t('skillCreateError'));
    } finally {
      setCreating(false);
    }
  }, [user?.token, createName, createDesc, createPrompt, createCategory, createTools, reload, onCloseCreate]);

  const toggleCreateTool = useCallback((tool: string) => {
    setCreateTools((prev) =>
      prev.includes(tool) ? prev.filter((tt) => tt !== tool) : [...prev, tool]
    );
  }, []);

  // Available tools for create modal (just names)
  const createToolsList = useMemo(() => {
    const names = tools.map((tt) => tt.name);
    if (!createToolSearch.trim()) return names.slice(0, 50);
    const q = createToolSearch.toLowerCase();
    return names.filter((n) => n.toLowerCase().includes(q)).slice(0, 50);
  }, [tools, createToolSearch]);

  const renderCategoryChip = useCallback(({ item }: { item: CategoryItem }) => (
    <TouchableOpacity
      style={[styles.chip, selectedCategory === item.key && styles.chipActive]}
      onPress={() => setSelectedCategory(item.key)}
      activeOpacity={0.7}
    >
      <Text style={[styles.chipText, selectedCategory === item.key && styles.chipTextActive]}>
        {t(item.label as any)}
      </Text>
    </TouchableOpacity>
  ), [styles, selectedCategory]);

  const renderSkillCard = ({ item }: { item: Skill }) => (
    <TouchableOpacity style={styles.card} onPress={() => handleOpenDetail(item)} activeOpacity={0.7}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardName} numberOfLines={1}>{item.name.replace(/_/g, ' ')}</Text>
        <View style={styles.cardBadge}>
          <Text style={styles.cardBadgeText}>~{item.estimated_credits} {t('skillCredits')}</Text>
        </View>
      </View>
      <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
      <View style={styles.cardFooter}>
        <View style={styles.cardMeta}>
          <Text style={styles.cardSteps}>{item.steps_count} {t('skillSteps')}</Text>
          {item.tools_whitelist?.length > 0 && (
            <Text style={styles.cardTools}>{item.tools_whitelist.length} {t('skillToolsCount')}</Text>
          )}
          {!item.is_builtin && (
            <View style={styles.customBadge}>
              <Text style={styles.customBadgeText}>{t('skillCustom')}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity style={styles.launchBtn} onPress={() => handleOpenDetail(item)} activeOpacity={0.7}>
          <Text style={styles.launchBtnText}>{t('skillLaunch')}</Text>
          <Ionicons name="arrow-forward" size={14} color={colors.white} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.tabContent}>
      {/* Category chips */}
      <View style={styles.chipsWrapper}>
        <FlatList
          horizontal
          data={SKILL_CATEGORIES_ARRAY}
          keyExtractor={(item) => item.key}
          renderItem={renderCategoryChip}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsContainer}
        />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : (
        <FlatList
          data={filteredSkills}
          keyExtractor={(item) => item.id}
          renderItem={renderSkillCard}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.emptyText}>{t('noData')}</Text>}
        />
      )}

      {/* Detail Modal (Pipeline) */}
      <Modal visible={!!detailSkill} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent} keyboardShouldPersistTaps="handled">
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{detailSkill?.name.replace(/_/g, ' ')}</Text>
                <TouchableOpacity onPress={() => setDetailSkill(null)}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <Text style={styles.modalDesc}>{detailSkill?.description}</Text>
              <View style={styles.modalMeta}>
                <Text style={styles.modalMetaText}>
                  {detailSkill?.steps_count} {t('skillSteps')} · ~{detailSkill?.estimated_credits} {t('skillCredits')}
                  {detailSkill && !detailSkill.is_builtin ? ` · ${t('skillCustom')}` : ''}
                </Text>
              </View>

              {/* Tools list */}
              {detailSkill?.tools_whitelist && detailSkill.tools_whitelist.length > 0 && (
                <View style={styles.toolsSection}>
                  <Text style={styles.formLabel}>{t('skillTools')} ({detailSkill.tools_whitelist.length})</Text>
                  <View style={styles.toolsGrid}>
                    {detailSkill.tools_whitelist.map((tool) => (
                      <View key={tool} style={styles.toolChip}>
                        <Text style={styles.toolChipText} numberOfLines={1}>{tool}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Params form */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>{t('skillDomain')}</Text>
                <TextInput
                  style={styles.formInput}
                  value={paramDomain}
                  onChangeText={setParamDomain}
                  placeholder="example.com"
                  placeholderTextColor={colors.textTertiary}
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>{t('skillTopic')}</Text>
                <TextInput
                  style={styles.formInput}
                  value={paramTopic}
                  onChangeText={setParamTopic}
                  placeholder={t('skillTopicPlaceholder')}
                  placeholderTextColor={colors.textTertiary}
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>{t('skillLanguage')}</Text>
                <TextInput
                  style={styles.formInput}
                  value={paramLanguage}
                  onChangeText={setParamLanguage}
                  placeholder="fr"
                  placeholderTextColor={colors.textTertiary}
                />
              </View>

              <TouchableOpacity
                style={[styles.modalLaunchBtn, !paramTopic.trim() && styles.modalLaunchDisabled]}
                onPress={handleRequestLaunch}
                disabled={!paramTopic.trim() || creditsLoading}
                activeOpacity={0.7}
              >
                {creditsLoading ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Text style={styles.modalLaunchText}>
                    {t('skillLaunchWith')}{detailSkill?.estimated_credits} {t('skillCredits')}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Confirm Modal */}
      <Modal visible={!!confirmSkill} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {confirmSkill?.estimated_credits === -1 ? (
              <>
                <Text style={styles.modalTitle}>{t('skillInsufficientCredits')}</Text>
                <Text style={styles.modalDesc}>{t('skillInsufficientMsg')}</Text>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setConfirmSkill(null)} activeOpacity={0.7}>
                  <Text style={styles.modalCancelText}>{t('ok')}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.modalTitle}>{t('skillConfirmTitle')}</Text>
                <Text style={styles.modalDesc}>
                  {t('skillConfirmMsg')} {confirmSkill?.estimated_credits} {t('skillCredits')}.
                </Text>
                {credits && (
                  <Text style={styles.modalMetaText}>
                    {t('skillCreditsAvailable')} {credits.total_available}
                  </Text>
                )}
                <View style={styles.confirmButtons}>
                  <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setConfirmSkill(null)} activeOpacity={0.7}>
                    <Text style={styles.modalCancelText}>{t('cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.modalLaunchBtn} onPress={handleConfirmLaunch} activeOpacity={0.7}>
                    <Text style={styles.modalLaunchText}>{t('confirm')}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Create Skill Modal */}
      <Modal visible={showCreate} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent} keyboardShouldPersistTaps="handled">
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t('skillCreateTitle')}</Text>
                <TouchableOpacity onPress={onCloseCreate}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>{t('skillName')}</Text>
                <TextInput
                  style={styles.formInput}
                  value={createName}
                  onChangeText={setCreateName}
                  placeholder={t('skillNamePlaceholder')}
                  placeholderTextColor={colors.textTertiary}
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>{t('skillDescription')}</Text>
                <TextInput
                  style={[styles.formInput, styles.formInputMulti]}
                  value={createDesc}
                  onChangeText={setCreateDesc}
                  placeholder={t('skillDescriptionPlaceholder')}
                  placeholderTextColor={colors.textTertiary}
                  multiline
                  numberOfLines={3}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>{t('skillCategory')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
                  <View style={styles.catRow}>
                    {CATEGORY_OPTIONS.map((cat) => (
                      <TouchableOpacity
                        key={cat.key}
                        style={[styles.chip, createCategory === cat.key && styles.chipActive]}
                        onPress={() => setCreateCategory(cat.key)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.chipText, createCategory === cat.key && styles.chipTextActive]}>
                          {t(cat.label as any)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>{t('skillSystemPrompt')}</Text>
                <TextInput
                  style={[styles.formInput, styles.formInputLarge]}
                  value={createPrompt}
                  onChangeText={setCreatePrompt}
                  placeholder={t('skillSystemPromptPlaceholder')}
                  placeholderTextColor={colors.textTertiary}
                  multiline
                  numberOfLines={5}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>
                  {t('skillSelectTools')} {createTools.length > 0 ? `(${createTools.length})` : ''}
                </Text>
                <TextInput
                  style={styles.formInput}
                  value={createToolSearch}
                  onChangeText={setCreateToolSearch}
                  placeholder={t('skillSearchTools')}
                  placeholderTextColor={colors.textTertiary}
                />
                {createTools.length > 0 && (
                  <View style={styles.selectedToolsRow}>
                    {createTools.map((tool) => (
                      <TouchableOpacity key={tool} style={styles.selectedToolChip} onPress={() => toggleCreateTool(tool)}>
                        <Text style={styles.selectedToolText} numberOfLines={1}>{tool}</Text>
                        <Ionicons name="close-circle" size={14} color={colors.white} />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                <View style={styles.toolsGrid}>
                  {createToolsList.map((tool) => (
                    <TouchableOpacity
                      key={tool}
                      style={[styles.toolChip, createTools.includes(tool) && styles.toolChipSelected]}
                      onPress={() => toggleCreateTool(tool)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.toolChipText, createTools.includes(tool) && styles.toolChipTextSelected]} numberOfLines={1}>
                        {tool}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <TouchableOpacity
                style={[styles.modalLaunchBtn, (!createName.trim() || !createDesc.trim() || !createPrompt.trim()) && styles.modalLaunchDisabled]}
                onPress={handleCreateSkill}
                disabled={!createName.trim() || !createDesc.trim() || !createPrompt.trim() || creating}
                activeOpacity={0.7}
              >
                {creating ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Text style={styles.modalLaunchText}>{t('skillCreate')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
