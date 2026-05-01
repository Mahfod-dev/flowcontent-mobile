import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { DashboardData } from '../types';
import { colors, commonStyles, radii, shadows, spacing } from '../theme';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h}h`;
  const d = Math.floor(h / 24);
  return `il y a ${d}j`;
}

interface Props {
  onBack: () => void;
}

export function DashboardScreen({ onBack }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<DashboardData | null>(null);
  const [credits, setCredits] = useState<any>(null);
  const [urgentAlerts, setUrgentAlerts] = useState<{ total: number; data: any[] }>({ total: 0, data: [] });
  const [metrics, setMetrics] = useState<any>(null);
  const [dailyTasks, setDailyTasks] = useState<any>(null);

  const load = useCallback(async () => {
    if (!user?.token) return;
    try {
      const [dashData, creditsData, alertsData, metricsData, tasksData] = await Promise.all([
        apiService.getDashboard(user.token),
        apiService.getCredits(user.token),
        apiService.getUrgentNotifications(user.token),
        apiService.getDashboardMetrics(user.token),
        apiService.getDailyTasks(user.token),
      ]);
      setData(dashData);
      setCredits(creditsData);
      setUrgentAlerts(alertsData);
      setMetrics(metricsData);
      setDailyTasks(tasksData);
    } catch {}
    finally { setLoading(false); }
  }, [user?.token]);

  useEffect(() => { load(); }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const creditBalance = credits?.total_available ?? 0;
  const creditTotal = Math.max(credits?.total_available ?? 0, credits?.free_credits_remaining ?? 0, 1);
  const creditPlan = credits?.plan ?? 'free';
  const creditPct = creditTotal > 0 ? Math.round((creditBalance / creditTotal) * 100) : 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={commonStyles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={commonStyles.headerTitle}>Dashboard</Text>
        <TouchableOpacity onPress={handleRefresh} style={commonStyles.backBtn} activeOpacity={0.7}>
          <Ionicons name="refresh-outline" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={commonStyles.loadingContainer}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />
          }
        >
          {/* Credits & Alerts row */}
          <View style={styles.creditsAlertRow}>
            <View style={styles.creditsCard}>
              <Text style={styles.miniTitle}>CRÉDITS · {creditPlan.toUpperCase()}</Text>
              <View style={styles.creditsValueRow}>
                <Ionicons name="wallet-outline" size={16} color={colors.accent} />
                <Text style={styles.creditsBig}>{creditBalance.toLocaleString()}</Text>
                <Text style={styles.creditsTotal}>/ {creditTotal.toLocaleString()}</Text>
              </View>
              <View style={styles.progressBar}>
                <View style={[
                  styles.progressFill,
                  { width: `${creditPct}%` },
                  creditPct > 50 ? styles.progressGreen : creditPct > 20 ? styles.progressOrange : styles.progressRed,
                ]} />
              </View>
            </View>
            <View style={styles.alertsCard}>
              <Text style={styles.miniTitle}>ALERTES</Text>
              {urgentAlerts.total > 0 ? (
                <View style={styles.alertBadge}>
                  <Ionicons name="warning-outline" size={14} color={colors.error} />
                  <Text style={styles.alertCount}>{urgentAlerts.total} urgente{urgentAlerts.total > 1 ? 's' : ''}</Text>
                </View>
              ) : (
                <View style={styles.allClear}>
                  <View style={styles.greenDot} />
                  <Text style={styles.allClearText}>Tout est OK</Text>
                </View>
              )}
            </View>
          </View>

          {/* Stats grid - 6 cards like web */}
          {data?.stats && (
            <>
              <Text style={styles.sectionTitle}>STATISTIQUES</Text>
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{data.stats.articlesGenerated}</Text>
                  <Text style={styles.statLabel}>Articles</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{data.stats.imagesCreated}</Text>
                  <Text style={styles.statLabel}>Images</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{data.stats.videosGenerated ?? 0}</Text>
                  <Text style={styles.statLabel}>Vidéos</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{data.stats.audiosGenerated ?? 0}</Text>
                  <Text style={styles.statLabel}>Audios</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>
                    {data.stats.successRate > 0 ? `${Math.round(data.stats.successRate)}%` : '—'}
                  </Text>
                  <Text style={styles.statLabel}>Succès</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>
                    {data.stats.averageTime > 0 ? `${data.stats.averageTime} min` : '—'}
                  </Text>
                  <Text style={styles.statLabel}>Temps moy.</Text>
                </View>
              </View>
            </>
          )}

          {/* Generation Metrics */}
          {metrics && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>MÉTRIQUES DE GÉNÉRATION</Text>
              <View style={styles.metricsCard}>
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>Temps moyen / article</Text>
                  <Text style={styles.metricValue}>
                    {metrics.averageTimePerArticle > 0 ? `${metrics.averageTimePerArticle} min` : '—'}
                  </Text>
                </View>
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>Taux de succès global</Text>
                  <Text style={styles.metricValue}>
                    {metrics.generationSuccessRate > 0 ? `${metrics.generationSuccessRate}%` : '—'}
                  </Text>
                </View>
                {metrics.peakGenerationTimes?.length > 0 && (
                  <View style={[styles.metricRow, { borderBottomWidth: 0 }]}>
                    <Text style={styles.metricLabel}>Pics de génération</Text>
                    <Text style={styles.metricValue}>
                      {metrics.peakGenerationTimes.map((p: any) => `${p.hour}h`).join(', ')}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Daily Tasks */}
          {dailyTasks && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>TÂCHES DU JOUR</Text>
              {(() => {
                const allTasks = dailyTasks.top_tasks ?? dailyTasks.all_tasks ?? [];
                const activeTasks = allTasks.filter((t: any) => t.status === 'pending' || t.status === 'in_progress');
                const completedCount = dailyTasks.completed_today ?? 0;
                const totalCount = activeTasks.length + completedCount;

                if (totalCount === 0 && activeTasks.length === 0) {
                  return (
                    <View style={styles.emptySmall}>
                      <Text style={styles.emptySmallText}>Aucune tâche pour aujourd'hui</Text>
                    </View>
                  );
                }

                return (
                  <View style={styles.tasksCard}>
                    {totalCount > 0 && (
                      <View style={styles.tasksHeader}>
                        <Text style={styles.tasksProgress}>{completedCount}/{totalCount} complétées</Text>
                        <View style={styles.progressBar}>
                          <View style={[styles.progressFill, styles.progressAccent, { width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }]} />
                        </View>
                      </View>
                    )}
                    {dailyTasks.ai_summary && (
                      <Text style={styles.aiSummary}>{dailyTasks.ai_summary}</Text>
                    )}
                    {activeTasks.slice(0, 5).map((task: any) => (
                      <View key={task.id} style={styles.taskRow}>
                        <View style={[styles.priorityDot, {
                          backgroundColor: task.priority === 'high' ? colors.error : task.priority === 'medium' ? colors.warning : colors.textTertiary
                        }]} />
                        <Text style={styles.taskTitle} numberOfLines={1}>{task.title}</Text>
                        {task.estimated_duration_minutes > 0 && (
                          <Text style={styles.taskDuration}>{task.estimated_duration_minutes}m</Text>
                        )}
                      </View>
                    ))}
                  </View>
                );
              })()}
            </View>
          )}

          {/* Recent activity */}
          {data?.recentActivity && data.recentActivity.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>ACTIVITÉ RÉCENTE</Text>
              {data.recentActivity.slice(0, 8).map((activity) => (
                <View key={activity.id} style={styles.activityRow}>
                  <View style={styles.activityInfo}>
                    <Text style={styles.activityTitle} numberOfLines={1}>
                      {activity.title}
                    </Text>
                    <Text style={styles.activityMeta}>
                      {activity.domain} · {timeAgo(activity.timestamp)}
                    </Text>
                  </View>
                  <View style={[
                    styles.statusBadge,
                    activity.type === 'success' ? styles.statusCompleted : styles.statusFailed,
                  ]}>
                    <Ionicons
                      name={activity.type === 'success' ? 'checkmark' : 'close'}
                      size={14}
                      color={colors.white}
                    />
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Domain stats */}
          {data?.domainStats && data.domainStats.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>STATS PAR DOMAINE</Text>
              {data.domainStats.map((ds) => (
                <View key={ds.domain} style={styles.domainCard}>
                  <Text style={styles.domainName} numberOfLines={1}>{ds.domain}</Text>
                  <View style={styles.domainStatsRow}>
                    <Text style={styles.domainStat}>{ds.articles} art.</Text>
                    <Text style={styles.domainStat}>{ds.images} img.</Text>
                    {(ds as any).videos > 0 && <Text style={styles.domainStat}>{(ds as any).videos} vid.</Text>}
                    {(ds as any).audios > 0 && <Text style={styles.domainStat}>{(ds as any).audios} aud.</Text>}
                    <Text style={[styles.domainStat, { color: ds.successRate > 80 ? colors.success : colors.warning }]}>
                      {ds.successRate}%
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {!data && !credits && !dailyTasks && (
            <View style={styles.empty}>
              <Ionicons name="bar-chart-outline" size={48} color={colors.textTertiary} />
              <Text style={styles.emptyText}>Aucune donnée disponible</Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.primary },
  header: {
    ...commonStyles.header,
  },
  content: { padding: spacing.lg, paddingBottom: 40 },

  // Credits & Alerts
  creditsAlertRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xl },
  creditsCard: {
    flex: 2, backgroundColor: colors.secondary, borderRadius: radii.md, padding: 14,
    borderWidth: 1, borderColor: colors.border, ...shadows.subtle,
  },
  alertsCard: {
    flex: 1, backgroundColor: colors.secondary, borderRadius: radii.md, padding: 14,
    borderWidth: 1, borderColor: colors.border, justifyContent: 'center', ...shadows.subtle,
  },
  miniTitle: { color: colors.textTertiary, fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginBottom: spacing.sm },
  creditsValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs, marginBottom: spacing.sm },
  creditsBig: { color: colors.text, fontSize: 22, fontWeight: '700' },
  creditsTotal: { color: colors.textTertiary, fontSize: 12 },
  progressBar: { height: 4, backgroundColor: colors.tertiary, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  progressGreen: { backgroundColor: colors.success },
  progressOrange: { backgroundColor: colors.warning },
  progressRed: { backgroundColor: colors.error },
  progressAccent: { backgroundColor: colors.accent },
  alertBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.errorMuted, borderRadius: radii.sm, padding: spacing.sm },
  alertCount: { color: colors.error, fontSize: 12, fontWeight: '600' },
  allClear: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  greenDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  allClearText: { color: colors.textTertiary, fontSize: 12 },

  // Stats
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: spacing.xl },
  statCard: {
    width: '31%', backgroundColor: colors.secondary, borderRadius: radii.md,
    padding: 14, alignItems: 'center',
    borderWidth: 1, borderColor: colors.border, ...shadows.subtle,
  },
  statValue: { color: colors.text, fontSize: 20, fontWeight: '700' },
  statLabel: { color: colors.textSecondary, fontSize: 11, marginTop: spacing.xs, textAlign: 'center' },

  // Sections
  section: { marginBottom: spacing.xl },
  sectionTitle: { color: colors.textTertiary, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: spacing.md },

  // Metrics
  metricsCard: { backgroundColor: colors.secondary, borderRadius: radii.md, padding: 14, borderWidth: 1, borderColor: colors.border },
  metricRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  metricLabel: { color: colors.textSecondary, fontSize: 13 },
  metricValue: { color: colors.text, fontSize: 14, fontWeight: '600' },

  // Daily Tasks
  tasksCard: { backgroundColor: colors.secondary, borderRadius: radii.md, padding: 14, borderWidth: 1, borderColor: colors.border },
  tasksHeader: { marginBottom: 10 },
  tasksProgress: { color: colors.textTertiary, fontSize: 12, marginBottom: 6 },
  aiSummary: { color: colors.textTertiary, fontSize: 12, fontStyle: 'italic', marginBottom: 10 },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  priorityDot: { width: 6, height: 6, borderRadius: 3 },
  taskTitle: { color: colors.text, fontSize: 13, flex: 1 },
  taskDuration: { color: colors.textTertiary, fontSize: 11 },

  // Activity
  activityRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.secondary, borderRadius: radii.sm, padding: spacing.md, marginBottom: 6,
  },
  activityInfo: { flex: 1, marginRight: spacing.md },
  activityTitle: { color: colors.text, fontSize: 13, fontWeight: '600' },
  activityMeta: { color: colors.textTertiary, fontSize: 11, marginTop: 2 },
  statusBadge: { width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  statusCompleted: { backgroundColor: colors.successMuted },
  statusFailed: { backgroundColor: colors.errorMuted },

  // Domain stats
  domainCard: {
    backgroundColor: colors.secondary, borderRadius: radii.sm, padding: spacing.md, marginBottom: 6,
  },
  domainName: { color: colors.text, fontSize: 14, fontWeight: '600', marginBottom: 6 },
  domainStatsRow: { flexDirection: 'row', gap: spacing.md },
  domainStat: { color: colors.textSecondary, fontSize: 12 },

  // Empty
  emptySmall: { backgroundColor: colors.secondary, borderRadius: radii.md, padding: spacing.xl, alignItems: 'center' },
  emptySmallText: { color: colors.textTertiary, fontSize: 13 },
  empty: { alignItems: 'center', paddingTop: 80, gap: spacing.md },
  emptyText: { color: colors.textTertiary, fontSize: 14 },
});
