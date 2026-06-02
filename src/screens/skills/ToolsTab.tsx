import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../contexts/ThemeContext';
import { t } from '../../i18n';
import { AgentTool } from '../../types';
import {
  SkillsStyles,
  TOOL_CATEGORIES,
  TOOL_DESC_FR,
  getToolPrompt,
  normalizeToolCategory,
} from './shared';

interface ToolsTabProps {
  styles: SkillsStyles;
  tools: AgentTool[];
  toolsLoading: boolean;
  onUseTool: (prompt: string) => void;
}

type ToolCategoryItem = (typeof TOOL_CATEGORIES)[number];

const TOOL_CATEGORIES_ARRAY: ToolCategoryItem[] = [...TOOL_CATEGORIES];

export function ToolsTab({ styles, tools, toolsLoading, onUseTool }: ToolsTabProps) {
  const colors = useColors();

  const [toolCategory, setToolCategory] = useState<string>('all');
  const [toolSearch, setToolSearch] = useState('');

  // Tool prompt edit modal
  const [toolPromptDraft, setToolPromptDraft] = useState('');
  const [toolPromptTool, setToolPromptTool] = useState<AgentTool | null>(null);

  const filteredTools = useMemo(() => {
    let list = tools;
    if (toolCategory !== 'all') {
      list = list.filter((tt) => normalizeToolCategory(tt.category) === toolCategory);
    }
    if (toolSearch.trim()) {
      const q = toolSearch.toLowerCase();
      list = list.filter((tt) =>
        tt.name.toLowerCase().includes(q) ||
        tt.description.toLowerCase().includes(q)
      );
    }
    return list;
  }, [tools, toolCategory, toolSearch]);

  const openToolPrompt = useCallback((tool: AgentTool) => {
    setToolPromptTool(tool);
    setToolPromptDraft(getToolPrompt(tool));
  }, []);

  const handleSendToolPrompt = useCallback(() => {
    if (!toolPromptDraft.trim()) return;
    onUseTool(toolPromptDraft.trim());
    setToolPromptTool(null);
    setToolPromptDraft('');
  }, [toolPromptDraft, onUseTool]);

  const renderCategoryChip = useCallback(({ item }: { item: ToolCategoryItem }) => (
    <TouchableOpacity
      style={[styles.chip, toolCategory === item.key && styles.chipActive]}
      onPress={() => setToolCategory(item.key)}
      activeOpacity={0.7}
    >
      <Text style={[styles.chipText, toolCategory === item.key && styles.chipTextActive]}>
        {t(item.label as any)}
      </Text>
    </TouchableOpacity>
  ), [styles, toolCategory]);

  const renderToolCard = ({ item }: { item: AgentTool }) => {
    const humanName = item.name.replace(/_/g, ' ').replace(/^mcp /, '');
    const desc = TOOL_DESC_FR[item.name] || item.description?.split('\n')[0]?.slice(0, 100) || '';
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => openToolPrompt(item)}
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
            onPress={() => openToolPrompt(item)}
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
    <View style={styles.tabContent}>
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
      <View style={styles.chipsWrapper}>
        <FlatList
          horizontal
          data={TOOL_CATEGORIES_ARRAY}
          keyExtractor={(item) => item.key}
          renderItem={renderCategoryChip}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsContainer}
        />
      </View>

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

      {/* Tool Prompt Edit Modal */}
      <Modal visible={!!toolPromptTool} transparent animationType="fade">
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.toolPromptModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={1}>
                {toolPromptTool?.name.replace(/_/g, ' ').replace(/^mcp /, '')}
              </Text>
              <TouchableOpacity onPress={() => setToolPromptTool(null)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.toolPromptHint}>{t('toolPromptHint')}</Text>
            <TextInput
              style={[styles.formInput, styles.toolPromptInput]}
              value={toolPromptDraft}
              onChangeText={setToolPromptDraft}
              placeholder={t('toolPromptPlaceholder')}
              placeholderTextColor={colors.textTertiary}
              multiline
              autoFocus
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={[styles.modalLaunchBtn, { flexDirection: 'row', justifyContent: 'center', gap: 8 }, !toolPromptDraft.trim() && styles.modalLaunchDisabled]}
              onPress={handleSendToolPrompt}
              disabled={!toolPromptDraft.trim()}
              activeOpacity={0.7}
            >
              <Ionicons name="send" size={16} color={colors.white} />
              <Text style={styles.modalLaunchText}>{t('toolSend')}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
