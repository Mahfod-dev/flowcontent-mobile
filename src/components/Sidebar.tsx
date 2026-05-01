import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { socketService } from '../services/socket';
import { Credits, Session, SiteDomain } from '../types';
import { colors, radii, spacing } from '../theme';

const PINNED_KEY = 'fc_pinned_sessions';

interface SidebarProps {
  activeSessionId: string | null;
  onSelectSession: (session: Session) => void;
  onNewChat: () => void;
  onClose: () => void;
  onOpenNotifications?: () => void;
  onOpenProfile?: () => void;
  onOpenDashboard?: () => void;
  onOpenUpgrade?: () => void;
  onOpenMedia?: () => void;
}

function SwipeableRow({ onDelete, onPin, isPinned, children }: { onDelete: () => void; onPin: () => void; isPinned: boolean; children: React.ReactNode }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const onDeleteRef = useRef(onDelete);
  const onPinRef = useRef(onPin);
  onDeleteRef.current = onDelete;
  onPinRef.current = onPin;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 10 && Math.abs(gs.dx) > Math.abs(gs.dy) * 2,
      onPanResponderMove: (_, gs) => {
        if (gs.dx < 0) {
          translateX.setValue(Math.max(gs.dx, -80));
        } else if (gs.dx > 0) {
          translateX.setValue(Math.min(gs.dx, 80));
        }
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx < -50) {
          Animated.spring(translateX, { toValue: -80, useNativeDriver: true, bounciness: 0 }).start();
        } else if (gs.dx > 50) {
          Animated.spring(translateX, { toValue: 80, useNativeDriver: true, bounciness: 0 }).start();
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  return (
    <View style={styles.swipeContainer}>
      {/* Pin action (swipe right) */}
      <TouchableOpacity
        style={styles.pinAction}
        onPress={() => {
          Animated.timing(translateX, { toValue: 0, duration: 200, useNativeDriver: true }).start();
          onPinRef.current();
        }}
        activeOpacity={0.7}
      >
        <Text style={styles.pinActionText}>{isPinned ? 'Désépingler' : 'Épingler'}</Text>
      </TouchableOpacity>
      {/* Delete action (swipe left) */}
      <TouchableOpacity
        style={styles.deleteAction}
        onPress={() => {
          Animated.timing(translateX, { toValue: 0, duration: 200, useNativeDriver: true }).start();
          onDeleteRef.current();
        }}
        activeOpacity={0.7}
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

export function Sidebar({ activeSessionId, onSelectSession, onNewChat, onClose, onOpenNotifications, onOpenProfile, onOpenDashboard, onOpenUpgrade, onOpenMedia }: SidebarProps) {
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [credits, setCredits] = useState<Credits | null>(null);
  const [renameModal, setRenameModal] = useState<Session | null>(null);
  const [renameText, setRenameText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sites, setSites] = useState<SiteDomain[]>([]);
  const [activeSiteId, setActiveSiteIdRaw] = useState<string | null>(null);

  // Sync site domain to API service header when site changes
  const setActiveSiteId = useCallback((siteId: string | null) => {
    setActiveSiteIdRaw(siteId);
    const site = siteId ? sites.find((s) => s.id === siteId) : null;
    apiService.setActiveSiteDomain(site?.domain ?? null);
  }, [sites]);
  const [notifCount, setNotifCount] = useState(0);
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());

  // Load pinned sessions from AsyncStorage
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(PINNED_KEY).then((raw) => {
      if (!cancelled && raw) {
        try { setPinnedIds(new Set(JSON.parse(raw))); } catch {}
      }
    });
    return () => { cancelled = true; };
  }, []);

  const togglePin = useCallback(async (sessionId: string) => {
    setPinnedIds((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) next.delete(sessionId);
      else next.add(sessionId);
      AsyncStorage.setItem(PINNED_KEY, JSON.stringify([...next]));
      return next;
    });
  }, []);

  const filteredSessions = useMemo(() => {
    const list = searchQuery.trim()
      ? sessions.filter((s) =>
          (s.title || '').toLowerCase().includes(searchQuery.toLowerCase())
        )
      : sessions;
    // Sort: pinned first, then by date
    return [...list].sort((a, b) => {
      const ap = pinnedIds.has(a.id) ? 1 : 0;
      const bp = pinnedIds.has(b.id) ? 1 : 0;
      if (ap !== bp) return bp - ap;
      return new Date(b.last_message_at ?? b.created_at ?? 0).getTime() -
        new Date(a.last_message_at ?? a.created_at ?? 0).getTime();
    });
  }, [sessions, searchQuery, pinnedIds]);

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
      const isPinned = pinnedIds.has(session.id);
      Alert.alert(
        session.title || 'Conversation',
        '',
        [
          {
            text: isPinned ? 'Désépingler' : 'Épingler',
            onPress: () => togglePin(session.id),
          },
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
    [handleDelete, pinnedIds, togglePin]
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
    const isPinned = pinnedIds.has(item.id);
    return (
      <SwipeableRow onDelete={() => handleDelete(item)} onPin={() => togglePin(item.id)} isPinned={isPinned}>
        <TouchableOpacity
          style={[styles.sessionItem, isActive && styles.sessionActive]}
          onPress={() => onSelectSession(item)}
          onLongPress={() => handleLongPress(item)}
          activeOpacity={0.7}
        >
          <View style={styles.sessionTitleRow}>
            {isPinned && <Ionicons name="pin" size={12} color={colors.accent} />}
            <Text style={[styles.sessionTitle, isActive && styles.sessionTitleActive, isPinned && { flex: 1 }]} numberOfLines={1}>
              {item.title || 'Conversation sans titre'}
            </Text>
          </View>
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
        <Ionicons name="add-outline" size={20} color={colors.white} />
        <Text style={styles.newChatText}>Nouvelle conversation</Text>
      </TouchableOpacity>

      {/* Site switcher */}
      {sites.length > 0 && (
        <View style={styles.siteSwitcher}>
          <TouchableOpacity
            style={[styles.siteChip, !activeSiteId && styles.siteChipActive]}
            onPress={() => setActiveSiteId(null)}
            activeOpacity={0.7}
          >
            <Text style={[styles.siteChipText, !activeSiteId && styles.siteChipTextActive]}>Tous</Text>
          </TouchableOpacity>
          {sites.map((site) => (
            <TouchableOpacity
              key={site.id}
              style={[styles.siteChip, activeSiteId === site.id && styles.siteChipActive]}
              onPress={() => setActiveSiteId(activeSiteId === site.id ? null : site.id)}
              activeOpacity={0.7}
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
        <Ionicons name="search-outline" size={16} color={colors.textTertiary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher..."
          placeholderTextColor={colors.textTertiary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
        />
      </View>

      {/* Conversations list */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.accent} size="small" />
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
              tintColor={colors.accent}
              colors={[colors.accent]}
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
          <TouchableOpacity style={styles.creditsRow} onPress={onOpenUpgrade} activeOpacity={0.7}>
            <Text style={styles.creditsLabel}>Crédits · {credits.plan}</Text>
            <View style={styles.creditsRight}>
              <Text style={styles.creditsValue}>{credits.total_available}</Text>
              {onOpenUpgrade && <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />}
            </View>
          </TouchableOpacity>
        )}
        <View style={styles.footerActions}>
          {onOpenNotifications && (
            <TouchableOpacity style={styles.footerActionBtn} onPress={onOpenNotifications} activeOpacity={0.7}>
              <Ionicons name="notifications-outline" size={20} color={colors.textTertiary} />
              <Text style={styles.footerActionLabel}>Notifs</Text>
              {notifCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{notifCount > 99 ? '99+' : notifCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
          {onOpenDashboard && (
            <TouchableOpacity style={styles.footerActionBtn} onPress={onOpenDashboard} activeOpacity={0.7}>
              <Ionicons name="bar-chart-outline" size={20} color={colors.textTertiary} />
              <Text style={styles.footerActionLabel}>Stats</Text>
            </TouchableOpacity>
          )}
          {onOpenUpgrade && (
            <TouchableOpacity style={styles.footerActionBtn} onPress={onOpenUpgrade} activeOpacity={0.7}>
              <Ionicons name="diamond-outline" size={20} color={colors.textTertiary} />
              <Text style={styles.footerActionLabel}>Abo</Text>
            </TouchableOpacity>
          )}
          {onOpenMedia && (
            <TouchableOpacity style={styles.footerActionBtn} onPress={onOpenMedia} activeOpacity={0.7}>
              <Ionicons name="folder-outline" size={20} color={colors.textTertiary} />
              <Text style={styles.footerActionLabel}>Fichiers</Text>
            </TouchableOpacity>
          )}
          {onOpenProfile && (
            <TouchableOpacity style={styles.footerActionBtn} onPress={onOpenProfile} activeOpacity={0.7}>
              <Ionicons name="person-outline" size={20} color={colors.textTertiary} />
              <Text style={styles.footerActionLabel}>Profil</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.userEmail} numberOfLines={1}>
          {user?.email || ''}
        </Text>
        <TouchableOpacity style={styles.logoutBtn} onPress={logout} activeOpacity={0.7}>
          <Ionicons name="log-out-outline" size={16} color={colors.error} />
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
              placeholderTextColor={colors.textTertiary}
              autoFocus
              onSubmitEditing={handleRename}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => { setRenameModal(null); setRenameText(''); }}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, !renameText.trim() && styles.modalConfirmDisabled]}
                onPress={handleRename}
                disabled={!renameText.trim()}
                activeOpacity={0.7}
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
    backgroundColor: colors.sidebar,
  },
  newChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: 14,
    backgroundColor: colors.accent,
    borderRadius: radii.sm,
  },
  newChatText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '600',
  },
  siteSwitcher: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  siteChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: colors.secondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  siteChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  siteChipText: {
    color: colors.textSecondary,
    fontSize: 12,
    maxWidth: 100,
  },
  siteChipTextActive: {
    color: colors.white,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.secondary,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    paddingVertical: spacing.sm,
    fontSize: 14,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
  },
  swipeContainer: {
    overflow: 'hidden',
    borderRadius: radii.sm,
    marginBottom: 2,
  },
  swipeContent: {
    backgroundColor: colors.sidebar,
  },
  pinAction: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 80,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinActionText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '600',
  },
  deleteAction: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 80,
    backgroundColor: colors.error,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteActionText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  sessionItem: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
  },
  sessionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  sessionActive: {
    backgroundColor: colors.secondary,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  sessionTitle: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  sessionTitleActive: {
    color: colors.text,
    fontWeight: '600',
  },
  sessionDate: {
    color: colors.textTertiary,
    fontSize: 11,
    marginTop: 2,
  },
  emptyText: {
    color: colors.textTertiary,
    fontSize: 13,
    textAlign: 'center',
    marginTop: spacing.xxl,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  creditsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: colors.secondary,
    borderRadius: radii.sm,
  },
  creditsLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  creditsValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  creditsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  footerActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: 10,
  },
  footerActionBtn: {
    position: 'relative',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
  },
  footerActionLabel: {
    color: colors.textTertiary,
    fontSize: 10,
    marginTop: 2,
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: colors.error,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
  badgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '700',
  },
  userEmail: {
    color: colors.textTertiary,
    fontSize: 12,
    marginBottom: spacing.sm,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
  },
  logoutText: {
    color: colors.error,
    fontSize: 14,
  },
  // Rename modal
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxxl,
  },
  modalContent: {
    width: '100%',
    backgroundColor: colors.secondary,
    borderRadius: radii.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: spacing.lg,
  },
  modalInput: {
    backgroundColor: colors.tertiary,
    color: colors.text,
    borderRadius: radii.sm,
    paddingHorizontal: 14,
    paddingVertical: spacing.md,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: spacing.lg,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.sm,
  },
  modalCancelText: {
    color: colors.textTertiary,
    fontSize: 15,
    fontWeight: '600',
  },
  modalConfirmBtn: {
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.accent,
    borderRadius: radii.sm,
  },
  modalConfirmDisabled: {
    opacity: 0.4,
  },
  modalConfirmText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '600',
  },
});
