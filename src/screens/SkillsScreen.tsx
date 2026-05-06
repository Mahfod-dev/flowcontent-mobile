import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { useColors } from '../contexts/ThemeContext';
import { useSkills } from '../hooks/useSkills';
import { apiService } from '../services/api';
import { t } from '../i18n';
import { AgentTool, Credits, Skill } from '../types';
import { ColorPalette, radii, spacing } from '../theme';

// --- Constants ---

const SKILL_CATEGORIES = [
  { key: 'all', label: 'skillsAll' },
  { key: 'seo', label: 'skillsSeo' },
  { key: 'strategy', label: 'skillsStrategy' },
  { key: 'content', label: 'skillsContent' },
  { key: 'ecommerce', label: 'skillsEcommerce' },
  { key: 'local', label: 'skillsLocal' },
  { key: 'youtube', label: 'skillsYoutube' },
  { key: 'productivity', label: 'skillsProductivity' },
  { key: 'legal', label: 'skillsLegal' },
] as const;

const TOOL_CATEGORIES = [
  { key: 'all', label: 'toolCatAll' },
  { key: 'research', label: 'toolCatResearch' },
  { key: 'generation', label: 'toolCatGeneration' },
  { key: 'seo', label: 'toolCatSeo' },
  { key: 'social', label: 'toolCatSocial' },
  { key: 'analytics', label: 'toolCatAnalytics' },
  { key: 'files', label: 'toolCatFiles' },
  { key: 'data', label: 'toolCatData' },
  { key: 'integration', label: 'toolCatIntegration' },
  { key: 'orchestration', label: 'toolCatOrchestration' },
  { key: 'other', label: 'toolCatOther' },
] as const;

const CATEGORY_OPTIONS = SKILL_CATEGORIES.filter((c) => c.key !== 'all');

// Map backend category names to our normalized keys
function normalizeToolCategory(cat: string): string {
  const map: Record<string, string> = {
    research: 'research', search: 'research',
    generation: 'generation', content: 'generation', media: 'generation',
    seo: 'seo', analysis: 'seo',
    social: 'social',
    analytics: 'analytics',
    files: 'files', file: 'files',
    data: 'data', execution: 'data',
    integration: 'integration', api: 'integration', oauth: 'integration',
    orchestration: 'orchestration',
  };
  return map[cat?.toLowerCase()] || 'other';
}

// Generate a human-readable prompt for a tool
function getToolPrompt(tool: AgentTool): string {
  const name = tool.name.replace(/_/g, ' ');
  if (tool.example) return tool.example;
  // Generate smart suggestions based on common tools
  const prompts: Record<string, string> = {
    generate_pptx: 'Crée une présentation PowerPoint sur [mon sujet]',
    generate_xlsx: 'Crée un tableau Excel avec [mes données]',
    generate_docx: 'Crée un document Word sur [mon sujet]',
    search_web: 'Recherche sur le web : [ma question]',
    generate_content: 'Génère du contenu sur [mon sujet]',
    generate_video: 'Crée une vidéo sur [mon sujet]',
    analyze_website: 'Analyse le site [url]',
    execute_code: 'Exécute ce code : [code]',
    browse_web: 'Va sur [url] et résume le contenu',
    deep_research: 'Fais une recherche approfondie sur [sujet]',
    dispatch_task: 'Lance une tâche : [description]',
    analyze_ga4: 'Analyse mes données Google Analytics',
    keyword_research: 'Trouve des mots-clés pour [niche]',
    youtube_manager: 'Gère ma chaîne YouTube : [action]',
    pinterest_manager: 'Publie sur Pinterest : [description]',
    nango_proxy: 'Utilise mon intégration [service] pour [action]',
  };
  return prompts[tool.name] || `Utilise l'outil ${name} pour [ma demande]`;
}

interface SkillsScreenProps {
  onBack: () => void;
  onLaunchSkill: (skillId: string, params: Record<string, string>) => void;
  onUseTool: (prompt: string) => void;
  activeDomain?: string | null;
}

export function SkillsScreen({ onBack, onLaunchSkill, onUseTool, activeDomain }: SkillsScreenProps) {
  const { user } = useAuth();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { skills, loading, reload } = useSkills();

  // Tab state
  const [activeTab, setActiveTab] = useState<'pipelines' | 'tools' | 'modes'>('pipelines');

  // --- Pipelines state ---
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [detailSkill, setDetailSkill] = useState<Skill | null>(null);
  const [confirmSkill, setConfirmSkill] = useState<Skill | null>(null);
  const [credits, setCredits] = useState<Credits | null>(null);
  const [creditsLoading, setCreditsLoading] = useState(false);
  const [paramDomain, setParamDomain] = useState(activeDomain || '');
  const [paramTopic, setParamTopic] = useState('');
  const [paramLanguage, setParamLanguage] = useState('fr');

  // Create skill modal
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createPrompt, setCreatePrompt] = useState('');
  const [createCategory, setCreateCategory] = useState('seo');
  const [createTools, setCreateTools] = useState<string[]>([]);
  const [createToolSearch, setCreateToolSearch] = useState('');
  const [creating, setCreating] = useState(false);

  // --- Tools state ---
  const [tools, setTools] = useState<AgentTool[]>([]);
  const [toolsLoading, setToolsLoading] = useState(false);
  const [toolCategory, setToolCategory] = useState<string>('all');
  const [toolSearch, setToolSearch] = useState('');

  // --- Modes state ---
  const [modes, setModes] = useState<any[]>([]);
  const [modesLoading, setModesLoading] = useState(false);
  const [activatingMode, setActivatingMode] = useState<string | null>(null);

  // Load tools on first tab switch
  useEffect(() => {
    if (activeTab === 'tools' && tools.length === 0 && user?.token) {
      setToolsLoading(true);
      apiService.getAvailableTools(user.token).then((data) => {
        setTools(data);
      }).catch(() => {}).finally(() => setToolsLoading(false));
    }
  }, [activeTab, user?.token]);

  // Load modes on first tab switch
  useEffect(() => {
    if (activeTab === 'modes' && modes.length === 0 && user?.token) {
      setModesLoading(true);
      apiService.getMarketplaceSkills(user.token).then((data) => {
        setModes(data);
      }).catch(() => {}).finally(() => setModesLoading(false));
    }
  }, [activeTab, user?.token]);

  // --- Pipelines logic ---
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
        setDetailSkill(null);
        setTimeout(() => {
          setConfirmSkill({ ...detailSkill, estimated_credits: -1 } as Skill);
        }, 100);
        return;
      }
      setConfirmSkill(detailSkill);
    } catch {} finally {
      setCreditsLoading(false);
    }
  }, [detailSkill, user?.token]);

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
  }, [user?.token]);

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
        setShowCreate(false);
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
  }, [user?.token, createName, createDesc, createPrompt, createCategory, createTools, reload]);

  const toggleCreateTool = useCallback((tool: string) => {
    setCreateTools((prev) =>
      prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool]
    );
  }, []);

  // --- Tools logic ---
  const filteredTools = useMemo(() => {
    let list = tools;
    if (toolCategory !== 'all') {
      list = list.filter((t) => normalizeToolCategory(t.category) === toolCategory);
    }
    if (toolSearch.trim()) {
      const q = toolSearch.toLowerCase();
      list = list.filter((t) =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q)
      );
    }
    return list;
  }, [tools, toolCategory, toolSearch]);

  // Available tools for create modal (just names)
  const createToolsList = useMemo(() => {
    const names = tools.map((t) => t.name);
    if (!createToolSearch.trim()) return names.slice(0, 50);
    const q = createToolSearch.toLowerCase();
    return names.filter((n) => n.toLowerCase().includes(q)).slice(0, 50);
  }, [tools, createToolSearch]);

  // --- Renderers ---

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

  const renderToolCard = ({ item }: { item: AgentTool }) => {
    const humanName = item.name.replace(/_/g, ' ').replace(/^mcp /, '');
    const desc = item.description?.split('\n')[0]?.slice(0, 100) || '';
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => onUseTool(getToolPrompt(item))}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardName} numberOfLines={1}>{humanName}</Text>
          <View style={[styles.cardBadge, { backgroundColor: colors.accent + '22' }]}>
            <Text style={[styles.cardBadgeText, { color: colors.accent }]}>
              {normalizeToolCategory(item.category)}
            </Text>
          </View>
        </View>
        {!!desc && <Text style={styles.cardDesc} numberOfLines={2}>{desc}</Text>}
        <View style={styles.cardFooter}>
          <Text style={styles.toolExample} numberOfLines={1}>{getToolPrompt(item)}</Text>
          <TouchableOpacity
            style={styles.launchBtn}
            onPress={() => onUseTool(getToolPrompt(item))}
            activeOpacity={0.7}
          >
            <Text style={styles.launchBtnText}>{t('toolUse')}</Text>
            <Ionicons name="chatbubble-outline" size={12} color={colors.white} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('pipelinesIA')}</Text>
        {activeTab === 'pipelines' && (
          <TouchableOpacity style={styles.createBtn} onPress={() => setShowCreate(true)} activeOpacity={0.7}>
            <Ionicons name="add" size={18} color={colors.white} />
          </TouchableOpacity>
        )}
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>
            {activeTab === 'pipelines' ? skills.length : activeTab === 'tools' ? tools.length : modes.length}
          </Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'pipelines' && styles.tabActive]}
          onPress={() => setActiveTab('pipelines')}
          activeOpacity={0.7}
        >
          <Ionicons name="rocket-outline" size={16} color={activeTab === 'pipelines' ? colors.accent : colors.textTertiary} />
          <Text style={[styles.tabText, activeTab === 'pipelines' && styles.tabTextActive]}>
            {t('tabPipelines')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'tools' && styles.tabActive]}
          onPress={() => setActiveTab('tools')}
          activeOpacity={0.7}
        >
          <Ionicons name="construct-outline" size={16} color={activeTab === 'tools' ? colors.accent : colors.textTertiary} />
          <Text style={[styles.tabText, activeTab === 'tools' && styles.tabTextActive]}>
            {t('tabTools')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'modes' && styles.tabActive]}
          onPress={() => setActiveTab('modes')}
          activeOpacity={0.7}
        >
          <Ionicons name="color-wand-outline" size={16} color={activeTab === 'modes' ? colors.accent : colors.textTertiary} />
          <Text style={[styles.tabText, activeTab === 'modes' && styles.tabTextActive]}>
            {t('tabModes')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content based on active tab */}
      {activeTab === 'pipelines' ? (
        <>
          {/* Category chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsContainer}
            style={styles.chipsScroll}
          >
            {SKILL_CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.key}
                style={[styles.chip, selectedCategory === cat.key && styles.chipActive]}
                onPress={() => setSelectedCategory(cat.key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, selectedCategory === cat.key && styles.chipTextActive]}>
                  {t(cat.label as any)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

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
        </>
      ) : activeTab === 'tools' ? (
        <>
          {/* Tools search */}
          <View style={styles.toolSearchContainer}>
            <Ionicons name="search-outline" size={16} color={colors.textTertiary} />
            <TextInput
              style={styles.toolSearchInput}
              value={toolSearch}
              onChangeText={setToolSearch}
              placeholder={t('toolSearchPlaceholder')}
              placeholderTextColor={colors.textTertiary}
              clearButtonMode="while-editing"
            />
            {toolSearch.length > 0 && (
              <Text style={styles.toolSearchCount}>{filteredTools.length}</Text>
            )}
          </View>

          {/* Tool category chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsContainer}
            style={styles.chipsScroll}
          >
            {TOOL_CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.key}
                style={[styles.chip, toolCategory === cat.key && styles.chipActive]}
                onPress={() => setToolCategory(cat.key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, toolCategory === cat.key && styles.chipTextActive]}>
                  {t(cat.label as any)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {toolsLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={colors.accent} size="large" />
            </View>
          ) : (
            <FlatList
              data={filteredTools}
              keyExtractor={(item) => item.name}
              renderItem={renderToolCard}
              contentContainerStyle={styles.list}
              initialNumToRender={20}
              maxToRenderPerBatch={15}
              ListEmptyComponent={<Text style={styles.emptyText}>{t('noData')}</Text>}
            />
          )}
        </>
      ) : (
        <>
          {/* Modes content */}
          {modesLoading ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
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
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <Text style={styles.cardName}>{mode.name}</Text>
                        {mode.isActivated && (
                          <View style={[styles.chipActive, { paddingHorizontal: 6, paddingVertical: 2 }]}>
                            <Text style={{ color: colors.accent, fontSize: 10, fontWeight: '700' }}>{t('modeActive')}</Text>
                          </View>
                        )}
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <Text style={[styles.chipText, { fontSize: 10 }]}>
                          {(mode.tier || 'pro').toUpperCase()}
                        </Text>
                        <Text style={[styles.chipText, { fontSize: 10 }]}>
                          ~{mode.estimatedCredits || 5} cr/session
                        </Text>
                      </View>
                      <Text style={styles.cardDesc} numberOfLines={3}>{mode.description}</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={[styles.launchBtn, mode.isActivated && { backgroundColor: colors.textTertiary }]}
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
              )}
              ListEmptyComponent={
                <View style={{ padding: 40, alignItems: 'center' }}>
                  <Text style={styles.emptyText}>{t('noData')}</Text>
                </View>
              }
            />
          )}
        </>
      )}

      {/* ===== MODALS ===== */}

      {/* Detail Modal (Pipeline) */}
      <Modal visible={!!detailSkill} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
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
        </View>
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
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t('skillCreateTitle')}</Text>
                <TouchableOpacity onPress={() => setShowCreate(false)}>
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
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  createBtn: {
    backgroundColor: colors.accent,
    borderRadius: radii.full,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBadge: {
    backgroundColor: colors.accent,
    borderRadius: radii.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  headerBadgeText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  // Tabs
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.secondary,
    borderRadius: radii.sm,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: radii.sm - 2,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    color: colors.textTertiary,
    fontSize: 14,
    fontWeight: '500',
  },
  tabTextActive: {
    color: colors.text,
    fontWeight: '700',
  },
  // Chips
  chipsScroll: {
    maxHeight: 44,
  },
  chipsContainer: {
    paddingHorizontal: spacing.lg,
    gap: 8,
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.full,
    backgroundColor: colors.secondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  chipTextActive: {
    color: colors.white,
    fontWeight: '600',
  },
  // Tools search
  toolSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    backgroundColor: colors.secondary,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    gap: 8,
  },
  toolSearchInput: {
    flex: 1,
    color: colors.text,
    paddingVertical: spacing.sm,
    fontSize: 14,
  },
  toolSearchCount: {
    color: colors.textTertiary,
    fontSize: 12,
  },
  // List
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  emptyText: {
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.xxl,
    fontSize: 14,
  },
  // Cards
  card: {
    backgroundColor: colors.secondary,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  cardName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    textTransform: 'capitalize',
  },
  cardBadge: {
    backgroundColor: colors.tertiary,
    borderRadius: radii.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  cardBadgeText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  cardDesc: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  cardSteps: {
    color: colors.textTertiary,
    fontSize: 12,
  },
  cardTools: {
    color: colors.textTertiary,
    fontSize: 12,
  },
  toolExample: {
    color: colors.textTertiary,
    fontSize: 11,
    fontStyle: 'italic',
    flex: 1,
    marginRight: 8,
  },
  customBadge: {
    backgroundColor: colors.accent + '22',
    borderRadius: radii.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  customBadgeText: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '600',
  },
  launchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.sm,
  },
  launchBtnText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '600',
  },
  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  modalScroll: {
    flex: 1,
    marginTop: 60,
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.secondary,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: spacing.xl,
    maxHeight: '100%',
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    textTransform: 'capitalize',
    flex: 1,
  },
  modalDesc: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  modalMeta: {
    marginBottom: spacing.lg,
  },
  modalMetaText: {
    color: colors.textTertiary,
    fontSize: 13,
    marginBottom: spacing.sm,
  },
  toolsSection: {
    marginBottom: spacing.lg,
  },
  toolsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  toolChip: {
    backgroundColor: colors.tertiary,
    borderRadius: radii.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: 160,
  },
  toolChipSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  toolChipText: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  toolChipTextSelected: {
    color: colors.white,
  },
  selectedToolsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
    marginBottom: 8,
  },
  selectedToolChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accent,
    borderRadius: radii.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: 160,
  },
  selectedToolText: {
    color: colors.white,
    fontSize: 11,
  },
  formGroup: {
    marginBottom: spacing.md,
  },
  formLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  formInput: {
    backgroundColor: colors.tertiary,
    color: colors.text,
    borderRadius: radii.sm,
    paddingHorizontal: 14,
    paddingVertical: spacing.md,
    fontSize: 14,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  formInputMulti: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  formInputLarge: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  catScroll: {
    marginTop: 4,
  },
  catRow: {
    flexDirection: 'row',
    gap: 6,
  },
  modalLaunchBtn: {
    backgroundColor: colors.accent,
    borderRadius: radii.sm,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  modalLaunchDisabled: {
    opacity: 0.4,
  },
  modalLaunchText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  modalCancelBtn: {
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.sm,
    alignItems: 'center',
  },
  modalCancelText: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  confirmButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: spacing.md,
  },
});
