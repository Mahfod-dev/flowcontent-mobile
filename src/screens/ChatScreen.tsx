import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useSpeech } from '../hooks/useSpeech';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MessageBubble } from '../components/MessageBubble';
import { ToolActivity } from '../components/ToolActivity';
import { useAuth } from '../contexts/AuthContext';
import { useChat } from '../hooks/useChat';
import { apiService } from '../services/api';
import { socketService } from '../services/socket';
import { MediaAttachment, ModelOption } from '../types';
import { colors, radii, spacing } from '../theme';

const MODEL_OPTIONS: ModelOption[] = [
  { label: 'Auto', value: null, emoji: 'auto' },
  { label: 'RGPD (Mistral)', value: 'mistral-large-latest', emoji: 'mistral' },
];

const MODEL_STORAGE_KEY = 'fc_selected_model';

interface ChatScreenProps {
  sessionId: string | null;
  onOpenDrawer: () => void;
}

export function ChatScreen({ sessionId, onOpenDrawer }: ChatScreenProps) {
  const { user } = useAuth();
  const [input, setInput] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const [attachments, setAttachments] = useState<MediaAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelOption>(MODEL_OPTIONS[0]);
  const [modelModalVisible, setModelModalVisible] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Restore persisted model choice
  useEffect(() => {
    AsyncStorage.getItem(MODEL_STORAGE_KEY).then((v) => {
      if (v) {
        const found = MODEL_OPTIONS.find((m) => m.value === v);
        if (found) setSelectedModel(found);
      }
    });
  }, []);

  const pickModel = (opt: ModelOption) => {
    setSelectedModel(opt);
    setModelModalVisible(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (opt.value) {
      AsyncStorage.setItem(MODEL_STORAGE_KEY, opt.value);
    } else {
      AsyncStorage.removeItem(MODEL_STORAGE_KEY);
    }
  };

  const { isListening, toggle: handleMic } = useSpeech((text) => {
    setInput((prev) => prev + (prev ? ' ' : '') + text);
  });

  // Offline detection via socket events (reactive, no polling)
  const [isOffline, setIsOffline] = useState(false);
  useEffect(() => {
    const offConnect = socketService.on('connect', () => setIsOffline(false));
    const offDisconnect = socketService.on('disconnect', () => setIsOffline(true));
    setIsOffline(!socketService.isConnected());
    return () => { offConnect(); offDisconnect(); };
  }, []);

  const { messages, isTyping, thinkingText, sendMessage, isLoadingMessages, cancelRun, toolCalls } = useChat(
    sessionId ?? '',
    user?.id ?? ''
  );

  // Track if user has scrolled up (reading history) — don't auto-scroll in that case
  const isNearBottomRef = useRef(true);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleScroll = useCallback((e: any) => {
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    const distanceFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
    isNearBottomRef.current = distanceFromBottom < 150;
  }, []);

  useEffect(() => {
    if (messages.length === 0) return;
    if (!isNearBottomRef.current) return; // User is reading history — don't force scroll
    if (scrollTimer.current) return;
    scrollTimer.current = setTimeout(() => {
      scrollTimer.current = null;
      if (isNearBottomRef.current) {
        flatListRef.current?.scrollToEnd({ animated: true });
      }
    }, 300);
  }, [messages]);

  // Cleanup scrollTimer on unmount
  useEffect(() => {
    return () => {
      if (scrollTimer.current) { clearTimeout(scrollTimer.current); scrollTimer.current = null; }
    };
  }, []);

  const handleSend = () => {
    if (!input.trim() && attachments.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    isNearBottomRef.current = true; // Force scroll to bottom after sending
    sendMessage(input.trim(), attachments.length > 0 ? attachments : undefined, selectedModel.value);
    setInput('');
    setAttachments([]);
  };

  const handlePickFile = () => {
    Alert.alert('Ajouter un fichier', '', [
      {
        text: 'Photo / Galerie',
        onPress: async () => {
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.8,
          });
          if (result.canceled || !result.assets?.[0]) return;
          const asset = result.assets[0];
          await uploadFile(asset.uri, asset.fileName || 'image.jpg', asset.mimeType || 'image/jpeg');
        },
      },
      {
        text: 'Document (PDF, DOCX...)',
        onPress: async () => {
          const result = await DocumentPicker.getDocumentAsync({
            type: [
              'application/pdf',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              'text/plain',
              'text/markdown',
              'text/csv',
              'application/json',
            ],
            copyToCacheDirectory: true,
          });
          if (result.canceled || !result.assets?.[0]) return;
          const asset = result.assets[0];
          await uploadFile(asset.uri, asset.name, asset.mimeType || 'application/octet-stream');
        },
      },
      { text: 'Annuler', style: 'cancel' },
    ]);
  };

  const uploadFile = async (uri: string, name: string, mimeType: string) => {
    if (!user?.token) return;
    setUploading(true);
    try {
      const data = await apiService.uploadFile(user.token, uri, name, mimeType);
      if (data.attachment) {
        setAttachments((prev) => [...prev, data.attachment]);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err: any) {
      Alert.alert('Erreur upload', err.message);
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFeedback = useCallback(
    async (messageIndex: number, rating: 'up' | 'down') => {
      if (!user?.token || !sessionId) return;
      try {
        await apiService.submitFeedback(user.token, sessionId, messageIndex, rating);
      } catch {}
    },
    [user?.token, sessionId]
  );

  if (!sessionId) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator color={colors.accent} size="large" />
        <Text style={styles.loadingText}>Connexion à Flow...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onOpenDrawer} style={styles.headerBtn} activeOpacity={0.7}>
          <Ionicons name="menu-outline" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Ionicons name="flash" size={16} color={colors.accent} />
          <Text style={styles.headerTitle}> Flow</Text>
        </View>
        <TouchableOpacity
          style={styles.modelBtn}
          onPress={() => setModelModalVisible(true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          <Ionicons name={selectedModel.value ? 'shield-checkmark-outline' : 'flash'} size={18} color={colors.accent} />
        </TouchableOpacity>
      </View>

      {/* Offline banner */}
      {isOffline && (
        <View style={styles.offlineBanner}>
          <Ionicons name="cloud-offline-outline" size={14} color={colors.warning} />
          <Text style={styles.offlineText}>Connexion perdue — reconnexion en cours...</Text>
        </View>
      )}

      {/* Model picker modal */}
      <Modal
        visible={modelModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModelModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModelModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Choix du mod{'\u00E8'}le</Text>
            {MODEL_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.label}
                style={[styles.modelRow, selectedModel.value === opt.value && styles.modelRowActive]}
                onPress={() => pickModel(opt)}
                activeOpacity={0.7}
              >
                <Ionicons name={opt.value ? 'shield-checkmark-outline' : 'flash'} size={20} color={colors.accent} />
                <Text style={styles.modelLabel}>{opt.label}</Text>
                {selectedModel.value === opt.value && (
                  <Ionicons name="checkmark" size={18} color={colors.accent} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <MessageBubble
            message={item}
            messageIndex={index}
            sessionId={sessionId}
            onFeedback={handleFeedback}
          />
        )}
        onScroll={handleScroll}
        scrollEventThrottle={100}
        contentContainerStyle={styles.messageList}
        ListEmptyComponent={
          isLoadingMessages ? (
            <View style={styles.emptyState}>
              <ActivityIndicator color={colors.accent} size="small" />
            </View>
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyLogoWrap}>
                <Ionicons name="flash" size={32} color={colors.white} />
              </View>
              <Text style={styles.emptyTitle}>Votre équipe marketing IA</Text>
              <Text style={styles.emptyTagline}>SEO, contenu, prospection, e-commerce, social{'\n'}95+ outils. Une seule conversation.</Text>

              <View style={styles.suggestionsWrap}>
                <Text style={styles.suggestionsLabel}>ESSAYEZ</Text>
                <View style={styles.suggestionsGrid}>
                  <TouchableOpacity style={styles.suggestionChip} onPress={() => { setInput('Audite mon site et donne-moi les quick wins SEO'); }} activeOpacity={0.7}>
                    <Ionicons name="pulse-outline" size={16} color={colors.accent} />
                    <Text style={styles.suggestionText}>Auditer mon site SEO</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.suggestionChip} onPress={() => { setInput('Écris un article SEO optimisé sur mon domaine'); }} activeOpacity={0.7}>
                    <Ionicons name="create-outline" size={16} color={colors.accent} />
                    <Text style={styles.suggestionText}>Rédiger un article SEO</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.suggestionChip} onPress={() => { setInput('Trouve des prospects sur Google Maps dans ma niche'); }} activeOpacity={0.7}>
                    <Ionicons name="locate-outline" size={16} color={colors.accent} />
                    <Text style={styles.suggestionText}>Trouver des prospects</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.suggestionChip} onPress={() => { setInput('Analyse mes concurrents et identifie des opportunités'); }} activeOpacity={0.7}>
                    <Ionicons name="analytics-outline" size={16} color={colors.accent} />
                    <Text style={styles.suggestionText}>Analyser la concurrence</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.suggestionChip} onPress={() => { setInput('Génère mes posts social media de la semaine'); }} activeOpacity={0.7}>
                    <Ionicons name="share-social-outline" size={16} color={colors.accent} />
                    <Text style={styles.suggestionText}>Posts social media</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.suggestionChip} onPress={() => { setInput('Optimise mes fiches produits Shopify pour le SEO'); }} activeOpacity={0.7}>
                    <Ionicons name="cart-outline" size={16} color={colors.accent} />
                    <Text style={styles.suggestionText}>Optimiser mon e-commerce</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )
        }
      />

      {/* Tool activity */}
      {toolCalls.length > 0 && <ToolActivity tools={toolCalls} />}

      {/* Thinking indicator */}
      {isTyping && !messages.some((m) => m.isStreaming) && toolCalls.length === 0 && (
        <View style={styles.thinkingBar}>
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={styles.thinkingText} numberOfLines={1}>
            {thinkingText || 'Flow réfléchit...'}
          </Text>
        </View>
      )}

      {/* Attachment preview */}
      {attachments.length > 0 && (
        <View style={styles.attachmentBar}>
          {attachments.map((att, i) => (
            <View key={i} style={styles.attachmentChip}>
              <Text style={styles.attachmentName} numberOfLines={1}>
                {att.filename}
              </Text>
              <TouchableOpacity onPress={() => removeAttachment(i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={14} color={colors.error} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Input */}
      <View style={styles.inputRow}>
        <TouchableOpacity style={styles.attachBtn} onPress={handlePickFile} disabled={uploading} activeOpacity={0.7}>
          {uploading ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <Ionicons name="add-outline" size={22} color={colors.textSecondary} />
          )}
        </TouchableOpacity>
        <TextInput
          style={[styles.input, inputFocused && styles.inputFocused]}
          placeholder="Écrivez un message..."
          placeholderTextColor={colors.textTertiary}
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={4000}
          onSubmitEditing={handleSend}
          onFocus={() => setInputFocused(true)}
          onBlur={() => setInputFocused(false)}
        />
        <TouchableOpacity
          style={[styles.micBtn, isListening && styles.micBtnActive]}
          onPress={handleMic}
          activeOpacity={0.7}
        >
          <Ionicons name={isListening ? 'stop' : 'mic-outline'} size={18} color={isListening ? colors.white : colors.textSecondary} />
        </TouchableOpacity>
        {isTyping ? (
          <TouchableOpacity style={styles.stopBtn} onPress={cancelRun} activeOpacity={0.7}>
            <Ionicons name="stop" size={16} color={colors.white} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() && attachments.length === 0) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!input.trim() && attachments.length === 0}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-up" size={20} color={colors.white} />
          </TouchableOpacity>
        )}
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.primary },
  flex: { flex: 1 },
  loading: { flex: 1, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  loadingText: { color: colors.textSecondary, fontSize: 14 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    backgroundColor: 'transparent',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  headerBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  modelBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.tertiary, justifyContent: 'center', alignItems: 'center',
  },
  modalOverlay: {
    flex: 1, backgroundColor: colors.overlay,
    justifyContent: 'center', alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.secondary, borderRadius: radii.lg, padding: spacing.xl,
    width: 260, borderWidth: 1, borderColor: colors.border,
  },
  modalTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: spacing.lg, textAlign: 'center' },
  modelRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingVertical: spacing.md, paddingHorizontal: spacing.md, borderRadius: radii.sm,
  },
  modelRowActive: { backgroundColor: colors.tertiary },
  modelLabel: { color: colors.text, fontSize: 15, flex: 1 },
  messageList: { paddingVertical: spacing.md, flexGrow: 1 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, paddingTop: 24, gap: spacing.sm },
  emptyLogoWrap: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.accent, justifyContent: 'center', alignItems: 'center',
    marginBottom: spacing.xs,
  },
  emptyTitle: { color: colors.text, fontSize: 22, fontWeight: '800' },
  emptyTagline: { color: colors.textSecondary, fontSize: 13, textAlign: 'center', lineHeight: 19, marginBottom: spacing.sm },
  suggestionsWrap: { width: '100%', marginTop: spacing.sm },
  suggestionsLabel: { color: colors.textTertiary, fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: spacing.sm, marginLeft: spacing.xs },
  suggestionsGrid: { gap: spacing.sm },
  suggestionChip: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.secondary, borderRadius: radii.md,
    paddingVertical: 11, paddingHorizontal: spacing.lg,
    borderWidth: 1, borderColor: colors.border,
  },
  suggestionText: { color: colors.text, fontSize: 13, fontWeight: '500' },
  thinkingBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    backgroundColor: colors.secondary, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
  },
  thinkingText: { color: colors.textSecondary, fontSize: 12, flex: 1 },
  attachmentBar: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6,
    paddingHorizontal: spacing.md, paddingTop: spacing.sm,
    backgroundColor: colors.secondary, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
  },
  attachmentChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.tertiary, borderRadius: radii.sm,
    paddingHorizontal: 10, paddingVertical: 6, maxWidth: 200,
  },
  attachmentName: { color: colors.textSecondary, fontSize: 12, flex: 1 },
  attachBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.tertiary, justifyContent: 'center', alignItems: 'center',
  },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: 10,
    backgroundColor: colors.primary, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
  },
  input: {
    flex: 1, backgroundColor: colors.tertiary, color: colors.text, borderRadius: radii.xxl,
    paddingHorizontal: spacing.lg, paddingVertical: 10, fontSize: 15, maxHeight: 120,
    borderWidth: 1, borderColor: colors.borderLight,
  },
  inputFocused: {
    borderColor: colors.accent,
  },
  micBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  micBtnActive: { backgroundColor: colors.error },
  offlineBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    paddingVertical: 6, backgroundColor: colors.warningMuted,
  },
  offlineText: { color: colors.warning, fontSize: 12, fontWeight: '600' },
  sendBtn: { backgroundColor: colors.accent, width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { backgroundColor: colors.tertiary },
  stopBtn: { backgroundColor: colors.error, width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
});
