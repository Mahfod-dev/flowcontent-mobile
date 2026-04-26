import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  Linking,
  PanResponder,
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
import { MediaFile } from '../types';
import { colors, commonStyles, radii, spacing } from '../theme';

interface MediaScreenProps {
  onBack: () => void;
}

type TabFilter = 'all' | 'images' | 'documents' | 'audio';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
const AUDIO_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/aac', 'audio/mp4'];

function getFileIconName(mimeType: string): keyof typeof Ionicons.glyphMap {
  if (IMAGE_TYPES.includes(mimeType)) return 'image-outline';
  if (mimeType === 'application/pdf') return 'document-text-outline';
  if (mimeType.includes('word') || mimeType.includes('document')) return 'document-outline';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'grid-outline';
  if (mimeType.includes('video')) return 'videocam-outline';
  if (mimeType.includes('audio')) return 'musical-notes-outline';
  return 'attach-outline';
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'Ko', 'Mo', 'Go'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

function SwipeableFileRow({ onDelete, children }: { onDelete: () => void; children: React.ReactNode }) {
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
          Animated.spring(translateX, { toValue: -80, useNativeDriver: true, bounciness: 0 }).start();
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
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

export function MediaScreen({ onBack }: MediaScreenProps) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabFilter>('all');

  const loadFiles = useCallback(async () => {
    if (!user?.token) return;
    try {
      const data = await apiService.getMediaFiles(user.token);
      setFiles(data);
    } catch (e) {
      console.error('Failed to load media files', e);
    } finally {
      setLoading(false);
    }
  }, [user?.token]);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadFiles();
    setRefreshing(false);
  }, [loadFiles]);

  const handleDelete = useCallback((file: MediaFile) => {
    Alert.alert(
      'Supprimer le fichier',
      `Supprimer "${file.name}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            if (!user?.token) return;
            const ok = await apiService.deleteMediaFile(user.token, file.path, file.bucket);
            if (ok) {
              setFiles((prev) => prev.filter((f) => f.path !== file.path));
            } else {
              Alert.alert('Erreur', 'Impossible de supprimer le fichier.');
            }
          },
        },
      ]
    );
  }, [user?.token]);

  const handleOpen = useCallback(async (file: MediaFile) => {
    if (file.url) {
      Linking.openURL(file.url);
      return;
    }
    if (!user?.token) return;
    const url = await apiService.getMediaFileUrl(user.token, file.path, file.bucket);
    if (url) {
      Linking.openURL(url);
    } else {
      Alert.alert('Erreur', 'Impossible d\'ouvrir le fichier.');
    }
  }, [user?.token]);

  const filteredFiles = files.filter((f) => {
    if (activeTab === 'images') return IMAGE_TYPES.includes(f.mimeType) || f.bucket === 'images';
    if (activeTab === 'audio') return AUDIO_TYPES.includes(f.mimeType) || f.bucket === 'audio';
    if (activeTab === 'documents') return !IMAGE_TYPES.includes(f.mimeType) && !AUDIO_TYPES.includes(f.mimeType) && f.bucket !== 'images' && f.bucket !== 'audio';
    return true;
  });

  const renderFile = ({ item }: { item: MediaFile }) => {
    const isImage = IMAGE_TYPES.includes(item.mimeType);
    const thumbUrl = item.url;
    return (
    <SwipeableFileRow onDelete={() => handleDelete(item)}>
      <TouchableOpacity style={styles.fileRow} onPress={() => handleOpen(item)} activeOpacity={0.7}>
        {isImage && thumbUrl ? (
          <Image source={{ uri: thumbUrl }} style={styles.fileThumbnail} />
        ) : (
          <View style={styles.fileIconWrap}>
            <Ionicons name={getFileIconName(item.mimeType)} size={24} color={colors.textSecondary} />
          </View>
        )}
        <View style={styles.fileInfo}>
          <Text style={styles.fileName} numberOfLines={1}>{item.name}</Text>
          <View style={styles.fileMeta}>
            <Text style={styles.fileSize}>{formatFileSize(item.size)}</Text>
            {item.created_at ? (
              <Text style={styles.fileDate}>
                {new Date(item.created_at).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'short',
                })}
              </Text>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    </SwipeableFileRow>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={commonStyles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={commonStyles.headerTitle}>Mes fichiers</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {(['all', 'images', 'audio', 'documents'] as TabFilter[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'all' ? 'Tous' : tab === 'images' ? 'Images' : tab === 'audio' ? 'Audio' : 'Documents'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {loading ? (
        <View style={commonStyles.loadingContainer}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : (
        <FlatList
          data={filteredFiles}
          keyExtractor={(item) => item.path}
          renderItem={renderFile}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + spacing.lg }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="folder-open-outline" size={48} color={colors.textTertiary} />
              <Text style={styles.emptyText}>Aucun fichier</Text>
              <Text style={styles.emptySubtext}>
                Uploadez des fichiers via le chat pour les retrouver ici.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  header: {
    ...commonStyles.header,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    gap: spacing.sm,
  },
  tab: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    backgroundColor: colors.secondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  tabText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  tabTextActive: {
    color: colors.white,
  },
  list: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
  },
  swipeContainer: {
    overflow: 'hidden',
    borderRadius: radii.sm,
    marginBottom: spacing.xs,
  },
  swipeContent: {
    backgroundColor: colors.primary,
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
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.secondary,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fileThumbnail: {
    width: 44,
    height: 44,
    borderRadius: 6,
    marginRight: spacing.md,
    backgroundColor: colors.tertiary,
  },
  fileIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 6,
    marginRight: spacing.md,
    backgroundColor: colors.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 3,
  },
  fileMeta: {
    flexDirection: 'row',
    gap: 10,
  },
  fileSize: {
    color: colors.textTertiary,
    fontSize: 12,
  },
  fileDate: {
    color: colors.textTertiary,
    fontSize: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 60,
    paddingHorizontal: 40,
    gap: spacing.sm,
  },
  emptyText: {
    color: colors.textTertiary,
    fontSize: 16,
    fontWeight: '600',
  },
  emptySubtext: {
    color: colors.textTertiary,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
});
