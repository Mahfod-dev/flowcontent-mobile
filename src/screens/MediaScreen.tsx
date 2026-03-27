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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { MediaFile } from '../types';

interface MediaScreenProps {
  onBack: () => void;
}

type TabFilter = 'all' | 'images' | 'documents' | 'audio';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
const AUDIO_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/aac', 'audio/mp4'];

function getFileIcon(mimeType: string): string {
  if (IMAGE_TYPES.includes(mimeType)) return '🖼';
  if (mimeType === 'application/pdf') return '📄';
  if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return '📊';
  if (mimeType.includes('video')) return '🎬';
  if (mimeType.includes('audio')) return '🎵';
  return '📎';
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
          <Text style={styles.fileIcon}>{getFileIcon(item.mimeType)}</Text>
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
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>{'\u2039'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mes fichiers</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {(['all', 'images', 'audio', 'documents'] as TabFilter[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'all' ? 'Tous' : tab === 'images' ? 'Images' : tab === 'audio' ? 'Audio' : 'Documents'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#6366F1" size="large" />
        </View>
      ) : (
        <FlatList
          data={filteredFiles}
          keyExtractor={(item) => item.path}
          renderItem={renderFile}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 16 }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#6366F1" />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📂</Text>
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
    backgroundColor: '#0F0E17',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1E1B4B',
  },
  backBtn: {
    paddingRight: 12,
    paddingVertical: 4,
  },
  backText: {
    color: '#A5B4FC',
    fontSize: 28,
    fontWeight: '600',
    lineHeight: 30,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1E1B4B',
    borderWidth: 1,
    borderColor: '#312E81',
  },
  tabActive: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  tabText: {
    color: '#A5B4FC',
    fontSize: 13,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    paddingHorizontal: 12,
    paddingTop: 4,
  },
  swipeContainer: {
    overflow: 'hidden',
    borderRadius: 10,
    marginBottom: 4,
  },
  swipeContent: {
    backgroundColor: '#0F0E17',
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
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#1E1B4B',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#312E81',
  },
  fileThumbnail: {
    width: 44,
    height: 44,
    borderRadius: 6,
    marginRight: 12,
    backgroundColor: '#312E81',
  },
  fileIcon: {
    fontSize: 28,
    marginRight: 12,
    width: 44,
    textAlign: 'center',
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 3,
  },
  fileMeta: {
    flexDirection: 'row',
    gap: 10,
  },
  fileSize: {
    color: '#6B7280',
    fontSize: 12,
  },
  fileDate: {
    color: '#6B7280',
    fontSize: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 60,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    color: '#4B5563',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
});
