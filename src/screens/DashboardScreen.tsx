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
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { DashboardData } from '../types';

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
        apiService.getCreditsBalance(user.token),
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

  const creditBalance = credits?.balance ?? credits?.total ?? 0;
  const creditTotal = credits?.total ?? credits?.monthly_free_credits ?? 1;
  const creditPlan = credits?.plan ?? 'free';
  const creditPct = creditTotal > 0 ? Math.round((creditBalance / creditTotal) * 100) : 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Dashboard</Text>
        <TouchableOpacity onPress={handleRefresh} style={styles.backBtn}>
          <Text style={styles.backIcon}>↻</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#6366F1" size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#6366F1" />
          }
        >
          {/* Credits & Alerts row */}
          <View style={styles.creditsAlertRow}>
            <View style={styles.creditsCard}>
              <Text style={styles.miniTitle}>CRÉDITS · {creditPlan.toUpperCase()}</Text>
              <View style={styles.creditsValueRow}>
                <Text style={styles.creditsEmoji}>🪙</Text>
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
                  <Text style={styles.alertIcon}>⚠️</Text>
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
              <Text style={styles.sectionTitle}>Statistiques</Text>
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
              <Text style={styles.sectionTitle}>Métriques de génération</Text>
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
                  <View style={styles.metricRow}>
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
              <Text style={styles.sectionTitle}>Tâches du jour</Text>
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
                          <View style={[styles.progressFill, styles.progressPurple, { width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }]} />
                        </View>
                      </View>
                    )}
                    {dailyTasks.ai_summary && (
                      <Text style={styles.aiSummary}>{dailyTasks.ai_summary}</Text>
                    )}
                    {activeTasks.slice(0, 5).map((task: any) => (
                      <View key={task.id} style={styles.taskRow}>
                        <View style={[styles.priorityDot, {
                          backgroundColor: task.priority === 'high' ? '#EF4444' : task.priority === 'medium' ? '#F97316' : '#6B7280'
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
              <Text style={styles.sectionTitle}>Activité récente</Text>
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
                    <Text style={styles.statusText}>{activity.type === 'success' ? '✓' : '✗'}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Domain stats */}
          {data?.domainStats && data.domainStats.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Stats par domaine</Text>
              {data.domainStats.map((ds) => (
                <View key={ds.domain} style={styles.domainCard}>
                  <Text style={styles.domainName} numberOfLines={1}>{ds.domain}</Text>
                  <View style={styles.domainStatsRow}>
                    <Text style={styles.domainStat}>{ds.articles} art.</Text>
                    <Text style={styles.domainStat}>{ds.images} img.</Text>
                    {(ds as any).videos > 0 && <Text style={styles.domainStat}>{(ds as any).videos} vid.</Text>}
                    {(ds as any).audios > 0 && <Text style={styles.domainStat}>{(ds as any).audios} aud.</Text>}
                    <Text style={[styles.domainStat, { color: ds.successRate > 80 ? '#22C55E' : '#F97316' }]}>
                      {ds.successRate}%
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {!data && !credits && !dailyTasks && (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📊</Text>
              <Text style={styles.emptyText}>Aucune donnée disponible</Text>
            </View>
          )}
        </ScrollView>
      )}
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
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 16, paddingBottom: 40 },

  // Credits & Alerts
  creditsAlertRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  creditsCard: {
    flex: 2, backgroundColor: '#1E1B4B', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#312E81',
  },
  alertsCard: {
    flex: 1, backgroundColor: '#1E1B4B', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#312E81', justifyContent: 'center',
  },
  miniTitle: { color: '#6B7280', fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8 },
  creditsValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginBottom: 8 },
  creditsEmoji: { fontSize: 16 },
  creditsBig: { color: '#fff', fontSize: 22, fontWeight: '700' },
  creditsTotal: { color: '#6B7280', fontSize: 12 },
  progressBar: { height: 4, backgroundColor: '#312E81', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  progressGreen: { backgroundColor: '#22C55E' },
  progressOrange: { backgroundColor: '#F97316' },
  progressRed: { backgroundColor: '#EF4444' },
  progressPurple: { backgroundColor: '#6366F1' },
  alertBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 8, padding: 8 },
  alertIcon: { fontSize: 14 },
  alertCount: { color: '#EF4444', fontSize: 12, fontWeight: '600' },
  allClear: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  greenDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E' },
  allClearText: { color: '#6B7280', fontSize: 12 },

  // Stats
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  statCard: {
    width: '31%', backgroundColor: '#1E1B4B', borderRadius: 12,
    padding: 14, alignItems: 'center',
    borderWidth: 1, borderColor: '#312E81',
  },
  statValue: { color: '#fff', fontSize: 20, fontWeight: '700' },
  statLabel: { color: '#A5B4FC', fontSize: 11, marginTop: 4, textAlign: 'center' },

  // Sections
  section: { marginBottom: 20 },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 12 },

  // Metrics
  metricsCard: { backgroundColor: '#1E1B4B', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#312E81' },
  metricRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#312E81' },
  metricLabel: { color: '#A5B4FC', fontSize: 13 },
  metricValue: { color: '#fff', fontSize: 14, fontWeight: '600' },

  // Daily Tasks
  tasksCard: { backgroundColor: '#1E1B4B', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#312E81' },
  tasksHeader: { marginBottom: 10 },
  tasksProgress: { color: '#6B7280', fontSize: 12, marginBottom: 6 },
  aiSummary: { color: '#6B7280', fontSize: 12, fontStyle: 'italic', marginBottom: 10 },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#312E81' },
  priorityDot: { width: 6, height: 6, borderRadius: 3 },
  taskTitle: { color: '#fff', fontSize: 13, flex: 1 },
  taskDuration: { color: '#6B7280', fontSize: 11 },

  // Activity
  activityRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#1E1B4B', borderRadius: 10, padding: 12, marginBottom: 6,
  },
  activityInfo: { flex: 1, marginRight: 12 },
  activityTitle: { color: '#fff', fontSize: 13, fontWeight: '600' },
  activityMeta: { color: '#6B7280', fontSize: 11, marginTop: 2 },
  statusBadge: { width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  statusCompleted: { backgroundColor: '#065F46' },
  statusFailed: { backgroundColor: '#7F1D1D' },
  statusText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  // Domain stats
  domainCard: {
    backgroundColor: '#1E1B4B', borderRadius: 10, padding: 12, marginBottom: 6,
  },
  domainName: { color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 6 },
  domainStatsRow: { flexDirection: 'row', gap: 12 },
  domainStat: { color: '#A5B4FC', fontSize: 12 },

  // Empty
  emptySmall: { backgroundColor: '#1E1B4B', borderRadius: 12, padding: 20, alignItems: 'center' },
  emptySmallText: { color: '#6B7280', fontSize: 13 },
  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyIcon: { fontSize: 48 },
  emptyText: { color: '#6B7280', fontSize: 14 },
});
