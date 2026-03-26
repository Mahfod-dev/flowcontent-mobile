import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Modal,
  PanResponder,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { Session, SiteDomain } from '../types';

interface SidebarProps {
  activeSessionId: string | null;
  onSelectSession: (session: Session) => void;
  onNewChat: () => void;
  onClose: () => void;
  onOpenNotifications?: () => void;
  onOpenProfile?: () => void;
}

function SwipeableRow({ onDelete, children }: { onDelete: () => void; children: React.ReactNode }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const onDeleteRef = useRef(onDelete);
  onDeleteRef.current = onDelete;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 10 && Math.abs(gs.dx) > Math.abs(gs.dy) * 2,
      onPanResponderMove: (_, gs) => {
        if (gs.dx < 0) {
          translateX.setValue(Math.max(gs.dx, -80));
        }
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx < -50) {
          Animated.spring(translateX, {
            toValue: -80,
            useNativeDriver: true,
            bounciness: 0,
          }).start();
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  return (
    <View style={styles.swipeContainer}>
      <TouchableOpacity
        style={styles.deleteAction}
        onPress={() => {
          Animated.timing(translateX, { toValue: 0, duration: 200, useNativeDriver: true }).start();
          onDeleteRef.current();
        }}
        activeOpacity={0.8}
      >
        <Text style={styles.deleteActionText}>Supprimer</Text>
      </TouchableOpacity>
      <Animated.View
        style={[styles.swipeContent, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
}

export function Sidebar({ activeSessionId, onSelectSession, onNewChat, onClose, onOpenNotifications, onOpenProfile }: SidebarProps) {
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [credits, setCredits] = useState<{ balance: number; free: number } | null>(null);
  const [renameModal, setRenameModal] = useState<Session | null>(null);
  const [renameText, setRenameText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sites, setSites] = useState<SiteDomain[]>([]);
  const [activeSiteId, setActiveSiteId] = useState<string | null>(null);
  const [notifCount, setNotifCount] = useState(0);

  const filteredSessions = searchQuery.trim()
    ? sessions.filter((s) =>
        (s.title || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : sessions;

  const loadSessions = useCallback(async () => {
    if (!user?.token) return;
    try {
      const data = await apiService.getSessions(user.token);
      setSessions(data);
    } catch (e) {
      console.error('Failed to load sessions', e);
    } finally {
      setLoading(false);
    }
  }, [user?.token]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Load credits, sites, notification badge
  useEffect(() => {
    if (!user?.token) return;
    apiService.getCredits(user.token).then(setCredits).catch(() => {});
    apiService.getSiteDomains(user.token).then(setSites).catch(() => {});
    apiService.getNotificationBadge(user.token).then((b) => setNotifCount(b.unread)).catch(() => {});
  }, [user?.token]);

  const handleRefresh = useCallback(async () => {
    if (!user?.token) return;
    setRefreshing(true);
    try {
      const [data, creds] = await Promise.all([
        apiService.getSessions(user.token),
        apiService.getCredits(user.token),
      ]);
      setSessions(data);
      if (creds) setCredits(creds);
    } catch (e) {
      console.error('Failed to refresh sessions', e);
    } finally {
      setRefreshing(false);
    }
  }, [user?.token]);

  const handleDelete = useCallback(
    (session: Session) => {
      Alert.alert(
        'Supprimer la conversation',
        `Supprimer "${session.title || 'cette conversation'}" ?`,
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Supprimer',
            style: 'destructive',
            onPress: async () => {
              if (!user?.token) return;
              const ok = await apiService.deleteSession(user.token, session.id);
              if (ok) {
                setSessions((prev) => prev.filter((s) => s.id !== session.id));
                if (session.id === activeSessionId) {
                  onNewChat();
                }
              }
            },
          },
        ]
      );
    },
    [user?.token, activeSessionId, onNewChat]
  );

  const handleLongPress = useCallback(
    (session: Session) => {
      Alert.alert(
        session.title || 'Conversation',
        '',
        [
          {
            text: 'Renommer',
            onPress: () => {
              setRenameText(session.title || '');
              setRenameModal(session);
            },
          },
          {
            text: 'Supprimer',
            style: 'destructive',
            onPress: () => handleDelete(session),
          },
          { text: 'Annuler', style: 'cancel' },
        ]
      );
    },
    [handleDelete]
  );

  const handleRename = useCallback(async () => {
    if (!renameModal || !user?.token || !renameText.trim()) return;
    const ok = await apiService.renameSession(user.token, renameModal.id, renameText.trim());
    if (ok) {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === renameModal.id ? { ...s, title: renameText.trim() } : s
        )
      );
    }
    setRenameModal(null);
    setRenameText('');
  }, [renameModal, user?.token, renameText]);

  const renderSession = ({ item }: { item: Session }) => {
    const isActive = item.id === activeSessionId;
    return (
      <SwipeableRow onDelete={() => handleDelete(item)}>
        <TouchableOpacity
          style={[styles.sessionItem, isActive && styles.sessionActive]}
          onPress={() => onSelectSession(item)}
          onLongPress={() => handleLongPress(item)}
          activeOpacity={0.7}
        >
          <Text style={[styles.sessionTitle, isActive && styles.sessionTitleActive]} numberOfLines={1}>
            {item.title || 'Conversation sans titre'}
          </Text>
          {item.last_message_at && (
            <Text style={styles.sessionDate}>
              {new Date(item.last_message_at).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'short',
              })}
            </Text>
          )}
        </TouchableOpacity>
      </SwipeableRow>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* New chat button */}
      <TouchableOpacity style={styles.newChatBtn} onPress={onNewChat} activeOpacity={0.7}>
        <Text style={styles.newChatIcon}>+</Text>
        <Text style={styles.newChatText}>Nouvelle conversation</Text>
      </TouchableOpacity>

      {/* Site switcher */}
      {sites.length > 0 && (
        <View style={styles.siteSwitcher}>
          <TouchableOpacity
            style={[styles.siteChip, !activeSiteId && styles.siteChipActive]}
            onPress={() => setActiveSiteId(null)}
          >
            <Text style={[styles.siteChipText, !activeSiteId && styles.siteChipTextActive]}>Tous</Text>
          </TouchableOpacity>
          {sites.map((site) => (
            <TouchableOpacity
              key={site.id}
              style={[styles.siteChip, activeSiteId === site.id && styles.siteChipActive]}
              onPress={() => setActiveSiteId(activeSiteId === site.id ? null : site.id)}
            >
              <Text style={[styles.siteChipText, activeSiteId === site.id && styles.siteChipTextActive]} numberOfLines={1}>
                {site.displayName || site.domain}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher..."
          placeholderTextColor="#6B7280"
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
        />
      </View>

      {/* Conversations list */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#6366F1" size="small" />
        </View>
      ) : (
        <FlatList
          data={filteredSessions}
          keyExtractor={(item) => item.id}
          renderItem={renderSession}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#6366F1"
              colors={['#6366F1']}
            />
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>Aucune conversation</Text>
          }
        />
      )}

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 8 }]}>
        {credits && (
          <View style={styles.creditsRow}>
            <Text style={styles.creditsLabel}>Crédits</Text>
            <Text style={styles.creditsValue}>{credits.balance}</Text>
          </View>
        )}
        <View style={styles.footerActions}>
          {onOpenNotifications && (
            <TouchableOpacity style={styles.footerActionBtn} onPress={onOpenNotifications}>
              <Text style={styles.footerActionIcon}>🔔</Text>
              {notifCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{notifCount > 99 ? '99+' : notifCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
          {onOpenProfile && (
            <TouchableOpacity style={styles.footerActionBtn} onPress={onOpenProfile}>
              <Text style={styles.footerActionIcon}>👤</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.userEmail} numberOfLines={1}>
          {user?.email || ''}
        </Text>
        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Text style={styles.logoutText}>Déconnexion</Text>
        </TouchableOpacity>
      </View>

      {/* Rename Modal */}
      <Modal visible={!!renameModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Renommer</Text>
            <TextInput
              style={styles.modalInput}
              value={renameText}
              onChangeText={setRenameText}
              placeholder="Nom de la conversation"
              placeholderTextColor="#6B7280"
              autoFocus
              onSubmitEditing={handleRename}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => { setRenameModal(null); setRenameText(''); }}
              >
                <Text style={styles.modalCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, !renameText.trim() && styles.modalConfirmDisabled]}
                onPress={handleRename}
                disabled={!renameText.trim()}
              >
                <Text style={styles.modalConfirmText}>Renommer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0B1A',
  },
  newChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#6366F1',
    borderRadius: 10,
  },
  newChatIcon: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  newChatText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  siteSwitcher: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  siteChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#1E1B4B',
    borderWidth: 1,
    borderColor: '#312E81',
  },
  siteChipActive: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  siteChipText: {
    color: '#A5B4FC',
    fontSize: 12,
    maxWidth: 100,
  },
  siteChipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  searchContainer: {
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  searchInput: {
    backgroundColor: '#1E1B4B',
    color: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#312E81',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    paddingHorizontal: 8,
    paddingTop: 4,
  },
  swipeContainer: {
    overflow: 'hidden',
    borderRadius: 8,
    marginBottom: 2,
  },
  swipeContent: {
    backgroundColor: '#0D0B1A',
  },
  deleteAction: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 80,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteActionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  sessionItem: {
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  sessionActive: {
    backgroundColor: '#1E1B4B',
  },
  sessionTitle: {
    color: '#D1D5DB',
    fontSize: 14,
  },
  sessionTitleActive: {
    color: '#fff',
    fontWeight: '600',
  },
  sessionDate: {
    color: '#6B7280',
    fontSize: 11,
    marginTop: 2,
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 24,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#1E1B4B',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  creditsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#1E1B4B',
    borderRadius: 8,
  },
  creditsLabel: {
    color: '#A5B4FC',
    fontSize: 12,
    fontWeight: '600',
  },
  creditsValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  footerActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
  },
  footerActionBtn: {
    position: 'relative',
    padding: 6,
  },
  footerActionIcon: {
    fontSize: 20,
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  userEmail: {
    color: '#6B7280',
    fontSize: 12,
    marginBottom: 8,
  },
  logoutBtn: {
    paddingVertical: 8,
  },
  logoutText: {
    color: '#EF4444',
    fontSize: 14,
  },
  // Rename modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#1E1B4B',
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 16,
  },
  modalInput: {
    backgroundColor: '#312E81',
    color: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#4338CA',
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  modalCancelText: {
    color: '#6B7280',
    fontSize: 15,
    fontWeight: '600',
  },
  modalConfirmBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#6366F1',
    borderRadius: 8,
  },
  modalConfirmDisabled: {
    opacity: 0.4,
  },
  modalConfirmText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
