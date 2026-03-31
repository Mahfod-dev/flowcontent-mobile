import React, { useCallback, useEffect, useState } from 'react';
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
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { AppNotification } from '../types';

const PRIORITY_COLORS: Record<string, string> = {
  urgent: '#EF4444',
  high: '#F97316',
  medium: '#6366F1',
  low: '#6B7280',
};

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
    await apiService.markNotificationRead(user.token, id);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
  };

  const handleMarkAllRead = async () => {
    if (!user?.token) return;
    await apiService.markAllNotificationsRead(user.token);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const renderNotification = ({ item }: { item: AppNotification }) => (
    <TouchableOpacity
      style={[styles.card, !item.is_read && styles.cardUnread]}
      onPress={() => !item.is_read && handleMarkRead(item.id)}
      activeOpacity={0.7}
    >
      <View style={[styles.priorityBar, { backgroundColor: PRIORITY_COLORS[item.priority] || '#6B7280' }]} />
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.cardTime}>{timeAgo(item.created_at)}</Text>
        </View>
        <View style={styles.markdownWrap}>
          <Markdown style={mdStyles}>{item.message}</Markdown>
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
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAllRead}>
            <Text style={styles.markAllRead}>Tout lire</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#6366F1" size="large" />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderNotification}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#6366F1" />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🔔</Text>
              <Text style={styles.emptyText}>Aucune notification</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const mdStyles = StyleSheet.create({
  body: { color: '#A5B4FC', fontSize: 13, lineHeight: 18 },
  strong: { color: '#C7D2FE', fontWeight: '700' },
  em: { color: '#A5B4FC', fontStyle: 'italic' },
  link: { color: '#818CF8', textDecorationLine: 'underline' },
  paragraph: { marginTop: 0, marginBottom: 0 },
  bullet_list: { marginTop: 2, marginBottom: 2 },
  ordered_list: { marginTop: 2, marginBottom: 2 },
  list_item: { marginTop: 0, marginBottom: 0 },
  heading1: { color: '#fff', fontSize: 15, fontWeight: '700', marginTop: 0, marginBottom: 2 },
  heading2: { color: '#fff', fontSize: 14, fontWeight: '700', marginTop: 0, marginBottom: 2 },
  heading3: { color: '#E0E7FF', fontSize: 13, fontWeight: '600', marginTop: 0, marginBottom: 2 },
  code_inline: { backgroundColor: '#312E81', color: '#C7D2FE', fontSize: 12, paddingHorizontal: 4, borderRadius: 3 },
  fence: { backgroundColor: '#312E81', borderRadius: 6, padding: 8, marginVertical: 4 },
  code_block: { color: '#C7D2FE', fontSize: 12 },
});

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
  markAllRead: { color: '#6366F1', fontSize: 13, fontWeight: '600' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 12, gap: 8 },
  card: {
    flexDirection: 'row', backgroundColor: '#1E1B4B', borderRadius: 12, overflow: 'hidden',
    marginBottom: 8,
  },
  cardUnread: { backgroundColor: '#1E1B5B' },
  priorityBar: { width: 4 },
  cardContent: { flex: 1, padding: 12, gap: 4 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { color: '#fff', fontSize: 14, fontWeight: '600', flex: 1, marginRight: 8 },
  cardTime: { color: '#6B7280', fontSize: 11 },
  markdownWrap: { marginVertical: -4 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  cardCategory: { color: '#6B7280', fontSize: 11, textTransform: 'capitalize' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#6366F1' },
  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyIcon: { fontSize: 48 },
  emptyText: { color: '#6B7280', fontSize: 14 },
});
