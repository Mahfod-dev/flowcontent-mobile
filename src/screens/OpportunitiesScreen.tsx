import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
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
import { safeOpenURL, safeOpenTel, safeOpenMailto } from '../utils/safeOpenURL';
import { LeadStatus, OpportunityLead, OpportunityScan } from '../types';

interface OpportunitiesScreenProps {
  onBack: () => void;
}

type Tab = 'leads' | 'scans';

const STATUSES: LeadStatus[] = ['new', 'contacted', 'qualified', 'converted', 'dismissed'];

function statusLabel(s: LeadStatus): string {
  switch (s) {
    case 'new': return t('statusNew');
    case 'contacted': return t('statusContacted');
    case 'qualified': return t('statusQualified');
    case 'converted': return t('statusConverted');
    case 'dismissed': return t('statusDismissed');
  }
}

function statusColor(s: LeadStatus, colors: ColorPalette): string {
  switch (s) {
    case 'new': return colors.accent;
    case 'contacted': return colors.warning ?? colors.accent;
    case 'qualified': return colors.accent;
    case 'converted': return colors.success;
    case 'dismissed': return colors.textTertiary;
  }
}

export function OpportunitiesScreen({ onBack }: OpportunitiesScreenProps) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [tab, setTab] = useState<Tab>('leads');
  const [leads, setLeads] = useState<OpportunityLead[]>([]);
  const [scans, setScans] = useState<OpportunityScan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [runningScanId, setRunningScanId] = useState<string | null>(null);
  // Scan dont on consulte les leads (null = leads chauds globaux).
  const [activeScan, setActiveScan] = useState<OpportunityScan | null>(null);

  const load = useCallback(async () => {
    if (!user?.token) return;
    try {
      const [hot, sc] = await Promise.all([
        apiService.getHotLeads(user.token),
        apiService.getOpportunityScans(user.token),
      ]);
      setLeads(hot);
      setScans(sc);
    } catch (e) {
      console.error('Failed to load opportunities', e);
    } finally {
      setLoading(false);
    }
  }, [user?.token]);

  useEffect(() => { load(); }, [load]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    if (activeScan && user?.token) {
      setLeads(await apiService.getScanLeads(user.token, activeScan.id));
    } else {
      await load();
    }
    setRefreshing(false);
  }, [load, activeScan, user?.token]);

  const openScanLeads = useCallback(async (scan: OpportunityScan) => {
    if (!user?.token) return;
    setActiveScan(scan);
    setTab('leads');
    setLoading(true);
    try {
      setLeads(await apiService.getScanLeads(user.token, scan.id));
    } finally {
      setLoading(false);
    }
  }, [user?.token]);

  const backToHotLeads = useCallback(async () => {
    setActiveScan(null);
    if (user?.token) setLeads(await apiService.getHotLeads(user.token));
  }, [user?.token]);

  const handleRun = useCallback(async (scan: OpportunityScan) => {
    if (!user?.token || runningScanId) return;
    setRunningScanId(scan.id);
    try {
      const res = await apiService.runOpportunityScan(user.token, scan.id);
      if (res) {
        Alert.alert(scan.niche, t('oppRunDone', { found: res.leadsFound, hot: res.hotLeads }));
      }
      await load();
    } catch (e: any) {
      Alert.alert(t('error'), e?.message || t('oppRunFailed'));
    } finally {
      setRunningScanId(null);
    }
  }, [user?.token, runningScanId, load]);

  const changeStatus = useCallback((lead: OpportunityLead) => {
    Alert.alert(
      t('oppChangeStatus'),
      lead.business_name,
      [
        ...STATUSES.map((s) => ({
          text: statusLabel(s),
          onPress: async () => {
            if (!user?.token) return;
            const ok = await apiService.updateLeadStatus(user.token, lead.id, s);
            if (ok) {
              setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, status: s } : l)));
            } else {
              Alert.alert(t('error'), t('cannotSave'));
            }
          },
        })),
        { text: t('cancel'), style: 'cancel' as const },
      ],
    );
  }, [user?.token]);

  const renderLead = ({ item }: { item: OpportunityLead }) => (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.bizName} numberOfLines={1}>{item.business_name}</Text>
          {item.address ? <Text style={styles.bizMeta} numberOfLines={1}>{item.address}</Text> : null}
          {typeof item.rating === 'number' ? (
            <Text style={styles.bizMeta}>
              ⭐ {item.rating.toFixed(1)}{item.reviews_count != null ? ` · ${t('oppReviews', { count: item.reviews_count })}` : ''}
            </Text>
          ) : null}
        </View>
        <View style={styles.scoreBadge}>
          <Text style={styles.scoreValue}>{item.opportunity_score.toFixed(1)}</Text>
          <Text style={styles.scoreLabel}>{t('oppScore')}</Text>
        </View>
      </View>

      {/* Actions de contact */}
      <View style={styles.actionsRow}>
        {item.phone ? (
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => safeOpenTel(item.phone)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`${t('oppCall')} ${item.business_name}`}
          >
            <Ionicons name="call-outline" size={15} color={colors.accent} />
            <Text style={styles.actionText}>{t('oppCall')}</Text>
          </TouchableOpacity>
        ) : null}
        {item.website ? (
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => safeOpenURL(item.website)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`${t('oppWebsite')} ${item.business_name}`}
          >
            <Ionicons name="globe-outline" size={15} color={colors.accent} />
            <Text style={styles.actionText}>{t('oppWebsite')}</Text>
          </TouchableOpacity>
        ) : null}
        {item.email ? (
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => safeOpenMailto(item.email)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`${t('oppEmail')} ${item.business_name}`}
          >
            <Ionicons name="mail-outline" size={15} color={colors.accent} />
            <Text style={styles.actionText}>{t('oppEmail')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Statut */}
      <TouchableOpacity
        style={[styles.statusChip, { borderColor: statusColor(item.status, colors) }]}
        onPress={() => changeStatus(item)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${t('oppChangeStatus')} — ${statusLabel(item.status)}`}
      >
        <View style={[styles.statusDot, { backgroundColor: statusColor(item.status, colors) }]} />
        <Text style={[styles.statusText, { color: statusColor(item.status, colors) }]}>{statusLabel(item.status)}</Text>
        <Ionicons name="chevron-down" size={13} color={statusColor(item.status, colors)} />
      </TouchableOpacity>
    </View>
  );

  const renderScan = ({ item }: { item: OpportunityScan }) => {
    const isRunning = runningScanId === item.id;
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => openScanLeads(item)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${item.niche} — ${item.zone_city}`}
        accessibilityHint="Affiche les leads de ce scan"
      >
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.bizName} numberOfLines={1}>{item.niche}</Text>
            <Text style={styles.bizMeta} numberOfLines={1}>
              {item.zone_city} · {t('oppRadius', { km: item.zone_radius_km })}
            </Text>
            <Text style={styles.bizMeta}>
              {t('oppLastRun')}: {item.last_run_at
                ? new Date(item.last_run_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
                : t('oppNever')}
              {item.last_run_leads_count != null ? ` · ${item.last_run_leads_count} leads` : ''}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.runBtn, isRunning && styles.runBtnDisabled]}
            onPress={() => handleRun(item)}
            disabled={isRunning || !!runningScanId}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityState={{ disabled: isRunning || !!runningScanId, busy: isRunning }}
            accessibilityLabel={`${t('oppRun')} — ${item.niche}`}
          >
            {isRunning ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <>
                <Ionicons name="play" size={14} color={colors.white} />
                <Text style={styles.runBtnText}>{t('oppRun')}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[commonStyles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={activeScan ? backToHotLeads : onBack}
          style={commonStyles.backBtn}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[commonStyles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          {activeScan ? activeScan.niche : t('opportunities')}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Tabs (masqués quand on consulte un scan précis) */}
      {!activeScan && (
        <View style={styles.tabs}>
          {(['leads', 'scans'] as Tab[]).map((tb) => (
            <TouchableOpacity
              key={tb}
              style={[styles.tab, tab === tb && styles.tabActive]}
              onPress={() => setTab(tb)}
              activeOpacity={0.7}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === tb }}
            >
              <Text style={[styles.tabText, tab === tb && styles.tabTextActive]}>
                {tb === 'leads' ? t('oppHotLeads') : t('oppScans')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {loading ? (
        <View style={styles.loader}><ActivityIndicator color={colors.accent} /></View>
      ) : tab === 'scans' && !activeScan ? (
        <FlatList
          data={scans}
          keyExtractor={(s) => s.id}
          renderItem={renderScan}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + spacing.lg }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="search-outline" size={44} color={colors.textTertiary} />
              <Text style={styles.emptyText}>{t('oppNoScans')}</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={leads}
          keyExtractor={(l) => l.id}
          renderItem={renderLead}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + spacing.lg }]}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={9}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="flame-outline" size={44} color={colors.textTertiary} />
              <Text style={styles.emptyText}>{t('oppNoLeads')}</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.primary },
  tabs: { flexDirection: 'row', paddingHorizontal: spacing.lg, paddingVertical: 10, gap: spacing.sm },
  tab: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    backgroundColor: colors.secondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  tabText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: colors.white },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { paddingHorizontal: spacing.md, paddingTop: spacing.xs },
  card: {
    backgroundColor: colors.secondary,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  bizName: { color: colors.text, fontSize: 15, fontWeight: '700', marginBottom: 3 },
  bizMeta: { color: colors.textTertiary, fontSize: 12, marginBottom: 2 },
  scoreBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 48,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: radii.sm,
    backgroundColor: colors.tertiary,
  },
  scoreValue: { color: colors.accent, fontSize: 18, fontWeight: '800' },
  scoreLabel: { color: colors.textTertiary, fontSize: 10, textTransform: 'uppercase' },
  actionsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, flexWrap: 'wrap' },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionText: { color: colors.accent, fontSize: 12, fontWeight: '600' },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: spacing.md,
    paddingVertical: 5,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: '700' },
  runBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
    backgroundColor: colors.accent,
    minWidth: 70,
    justifyContent: 'center',
  },
  runBtnDisabled: { opacity: 0.6 },
  runBtnText: { color: colors.white, fontSize: 13, fontWeight: '700' },
  empty: { alignItems: 'center', marginTop: 60, paddingHorizontal: 40, gap: spacing.sm },
  emptyText: { color: colors.textTertiary, fontSize: 14, fontWeight: '600', textAlign: 'center', lineHeight: 20 },
});
