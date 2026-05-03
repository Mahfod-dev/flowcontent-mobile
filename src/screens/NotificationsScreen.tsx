import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useColors } from '../contexts/ThemeContext';
import { t } from '../i18n';
import { apiService } from '../services/api';
import { AppNotification } from '../types';
import { ColorPalette } from '../theme';
import { commonStyles, notificationMarkdownTheme, radii, spacing } from '../theme';
import { NotificationsSkeleton } from '../components/Skeleton';

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

export function NotificationsScreen({ onBack }: Props) {
  const { user } = useAuth();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user?.token) return;
    try {
      const data = await apiService.getNotifications(user.token);
      setNotifications(data);
    } catch {}
    finally { setLoading(false); }
  }, [user?.token]);

  useEffect(() => { load(); }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleMarkRead = async (id: string) => {
    if (!user?.token) return;
    try {
      const ok = await apiService.markNotificationRead(user.token, id);
      if (ok) {
        setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
      }
    } catch {}
  };

  const handleMarkAllRead = async () => {
    if (!user?.token) return;
    try {
      const ok = await apiService.markAllNotificationsRead(user.token);
      if (ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      }
    } catch {}
  };

  const PRIORITY_COLORS: Record<string, string> = {
    urgent: colors.error,
    high: colors.warning,
    medium: colors.accent,
    low: colors.textTertiary,
  };

  const renderNotification = ({ item }: { item: AppNotification }) => (
    <TouchableOpacity
      style={[styles.card, !item.is_read && styles.cardUnread]}
      onPress={() => !item.is_read && handleMarkRead(item.id)}
      activeOpacity={0.7}
    >
      <View style={[styles.priorityBar, { backgroundColor: PRIORITY_COLORS[item.priority] || colors.textTertiary }]} />
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.cardTime}>{timeAgo(item.created_at)}</Text>
        </View>
        <View style={styles.markdownWrap}>
          <Markdown style={notificationMarkdownTheme}>{item.message}</Markdown>
        </View>
        <View style={styles.cardFooter}>
          <Text style={styles.cardCategory}>{item.category}</Text>
          {!item.is_read && <View style={styles.unreadDot} />}
        </View>
      </View>
    </TouchableOpacity>
  );

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <SafeAreaView style={styles.container}>
      <View style={[commonStyles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={commonStyles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[commonStyles.headerTitle, { color: colors.text }]}>{t('notifications')}</Text>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={handleMarkAllRead} activeOpacity={0.7}>
            <Text style={styles.markAllRead}>{t('markAllRead')}</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 36 }} />
        )}
      </View>

      {loading ? (
        <NotificationsSkeleton />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderNotification}
          contentContainerStyle={styles.list}
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          windowSize={9}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="notifications-off-outline" size={48} color={colors.textTertiary} />
              <Text style={styles.emptyText}>{t('noNotifications')}</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.primary },
  markAllRead: { color: colors.accent, fontSize: 13, fontWeight: '600' },
  list: { padding: spacing.md, gap: spacing.sm },
  card: {
    flexDirection: 'row', backgroundColor: colors.secondary, borderRadius: radii.md, overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  cardUnread: { backgroundColor: '#1E1E1E' },
  priorityBar: { width: 4 },
  cardContent: { flex: 1, padding: spacing.md, gap: spacing.xs },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { color: colors.text, fontSize: 14, fontWeight: '600', flex: 1, marginRight: spacing.sm },
  cardTime: { color: colors.textTertiary, fontSize: 11 },
  markdownWrap: { marginVertical: -4 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xs },
  cardCategory: { color: colors.textTertiary, fontSize: 11, textTransform: 'capitalize' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  empty: { alignItems: 'center', paddingTop: 80, gap: spacing.md },
  emptyText: { color: colors.textTertiary, fontSize: 14 },
});
