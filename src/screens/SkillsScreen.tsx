import React, { useEffect, useMemo, useState } from 'react';
import {
  Text,
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
import { AgentTool } from '../types';
import { createStyles } from './skills/shared';
import { PipelinesTab } from './skills/PipelinesTab';
import { ToolsTab } from './skills/ToolsTab';
import { ModesTab } from './skills/ModesTab';

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

  // Lifted to the shell so a) the header badge can read skills.length when the
  // pipelines tab isn't active, and b) we don't double-fetch (useSkills triggers
  // a fetch on mount, so it must be called only in one place).
  const { skills, loading: skillsLoading, reload: reloadSkills } = useSkills();

  // Tab state
  const [activeTab, setActiveTab] = useState<'pipelines' | 'tools' | 'modes'>('pipelines');

  // Shared across tabs (the create-skill modal in PipelinesTab also needs the
  // tools list, and the badge counters need them too) — lifted to the shell
  // so state survives tab switches, matching the original monolithic component.
  const [tools, setTools] = useState<AgentTool[]>([]);
  const [toolsLoading, setToolsLoading] = useState(false);

  const [modes, setModes] = useState<any[]>([]);
  const [modesLoading, setModesLoading] = useState(false);

  // Create skill modal trigger — owned by the shell because the "+" button
  // lives in the header (outside PipelinesTab).
  const [showCreate, setShowCreate] = useState(false);

  // Load tools on first time the tools tab is opened (deduplicate by name)
  useEffect(() => {
    if (activeTab === 'tools' && tools.length === 0 && user?.token) {
      setToolsLoading(true);
      apiService.getAvailableTools(user.token).then((data) => {
        const seen = new Set<string>();
        const unique = data.filter((tt) => {
          if (seen.has(tt.name)) return false;
          seen.add(tt.name);
          return true;
        });
        setTools(unique);
      }).catch(() => {}).finally(() => setToolsLoading(false));
    }
  }, [activeTab, user?.token, tools.length]);

  // Load modes on first time the modes tab is opened
  useEffect(() => {
    if (activeTab === 'modes' && modes.length === 0 && user?.token) {
      setModesLoading(true);
      apiService.getMarketplaceSkills(user.token).then((data) => {
        setModes(data);
      }).catch(() => {}).finally(() => setModesLoading(false));
    }
  }, [activeTab, user?.token, modes.length]);

  const badgeCount =
    activeTab === 'pipelines' ? skills.length
      : activeTab === 'tools' ? tools.length
      : modes.length;

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
          <Text style={styles.headerBadgeText}>{badgeCount}</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'pipelines' && styles.tabActive]}
          onPress={() => setActiveTab('pipelines')}
          activeOpacity={0.7}
        >
          <Ionicons name="rocket-outline" size={16} color={activeTab === 'pipelines' ? colors.white : colors.textSecondary} />
          <Text style={[styles.tabText, activeTab === 'pipelines' && styles.tabTextActive]}>
            {t('tabPipelines')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'tools' && styles.tabActive]}
          onPress={() => setActiveTab('tools')}
          activeOpacity={0.7}
        >
          <Ionicons name="construct-outline" size={16} color={activeTab === 'tools' ? colors.white : colors.textSecondary} />
          <Text style={[styles.tabText, activeTab === 'tools' && styles.tabTextActive]}>
            {t('tabTools')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'modes' && styles.tabActive]}
          onPress={() => setActiveTab('modes')}
          activeOpacity={0.7}
        >
          <Ionicons name="color-wand-outline" size={16} color={activeTab === 'modes' ? colors.white : colors.textSecondary} />
          <Text style={[styles.tabText, activeTab === 'modes' && styles.tabTextActive]}>
            {t('tabModes')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* All three tabs are kept mounted (visibility toggled) so their local
          state (filters, drafts, open modals) survives tab switches, matching
          the original monolithic component's behavior. */}
      <View style={[{ flex: 1 }, activeTab !== 'pipelines' && { display: 'none' }]}>
        <PipelinesTab
          styles={styles}
          activeDomain={activeDomain}
          onLaunchSkill={onLaunchSkill}
          showCreate={showCreate}
          onCloseCreate={() => setShowCreate(false)}
          tools={tools}
          skills={skills}
          loading={skillsLoading}
          reload={reloadSkills}
        />
      </View>
      <View style={[{ flex: 1 }, activeTab !== 'tools' && { display: 'none' }]}>
        <ToolsTab
          styles={styles}
          tools={tools}
          toolsLoading={toolsLoading}
          onUseTool={onUseTool}
        />
      </View>
      <View style={[{ flex: 1 }, activeTab !== 'modes' && { display: 'none' }]}>
        <ModesTab
          styles={styles}
          modes={modes}
          setModes={setModes}
          modesLoading={modesLoading}
        />
      </View>
    </SafeAreaView>
  );
}
