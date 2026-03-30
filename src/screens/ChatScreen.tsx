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
import { MediaAttachment, ModelOption } from '../types';

const MODEL_OPTIONS: ModelOption[] = [
  { label: 'Auto', value: null, emoji: '\u26A1' },
  { label: 'RGPD (Mistral)', value: 'mistral-large-latest', emoji: '\uD83C\uDDEB\uD83C\uDDF7' },
];

const MODEL_STORAGE_KEY = 'fc_selected_model';

interface ChatScreenProps {
  sessionId: string | null;
  onOpenDrawer: () => void;
}

export function ChatScreen({ sessionId, onOpenDrawer }: ChatScreenProps) {
  const { user } = useAuth();
  const [input, setInput] = useState('');
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

  const { messages, isTyping, thinkingText, sendMessage, isLoadingMessages, cancelRun, toolCalls } = useChat(
    sessionId ?? '',
    user?.id ?? ''
  );

  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (messages.length === 0) return;
    if (scrollTimer.current) return;
    scrollTimer.current = setTimeout(() => {
      scrollTimer.current = null;
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 300);
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() && attachments.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
      await apiService.submitFeedback(user.token, sessionId, messageIndex, rating);
    },
    [user?.token, sessionId]
  );

  if (!sessionId) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator color="#6366F1" size="large" />
        <Text style={styles.loadingText}>Connexion à FC-Agent...</Text>
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
        <TouchableOpacity onPress={onOpenDrawer} style={styles.hamburger}>
          <Text style={styles.hamburgerIcon}>☰</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{'\u26A1'} FC-Agent</Text>
        <TouchableOpacity
          style={styles.modelBtn}
          onPress={() => setModelModalVisible(true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.modelBtnText}>{selectedModel.emoji}</Text>
        </TouchableOpacity>
      </View>

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
              >
                <Text style={styles.modelEmoji}>{opt.emoji}</Text>
                <Text style={styles.modelLabel}>{opt.label}</Text>
                {selectedModel.value === opt.value && (
                  <Text style={styles.modelCheck}>{'\u2713'}</Text>
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
        contentContainerStyle={styles.messageList}
        ListEmptyComponent={
          isLoadingMessages ? (
            <View style={styles.emptyState}>
              <ActivityIndicator color="#6366F1" size="small" />
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>⚡</Text>
              <Text style={styles.emptyTitle}>FC-Agent est prêt</Text>
              <Text style={styles.emptySubtitle}>
                Demandez un audit SEO, un article, une analyse de niche ou toute autre tâche marketing.
              </Text>
            </View>
          )
        }
      />

      {/* Tool activity */}
      {toolCalls.length > 0 && <ToolActivity tools={toolCalls} />}

      {/* Thinking indicator */}
      {isTyping && !messages.some((m) => m.isStreaming) && toolCalls.length === 0 && (
        <View style={styles.thinkingBar}>
          <ActivityIndicator size="small" color="#6366F1" />
          <Text style={styles.thinkingText} numberOfLines={1}>
            {thinkingText || 'FC-Agent réfléchit...'}
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
                <Text style={styles.attachmentRemove}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Input */}
      <View style={styles.inputRow}>
        <TouchableOpacity style={styles.attachBtn} onPress={handlePickFile} disabled={uploading}>
          {uploading ? (
            <ActivityIndicator size="small" color="#6366F1" />
          ) : (
            <Text style={styles.attachIcon}>+</Text>
          )}
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          placeholder="Écrivez un message..."
          placeholderTextColor="#6B7280"
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={4000}
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity
          style={[styles.micBtn, isListening && styles.micBtnActive]}
          onPress={handleMic}
        >
          <Text style={styles.micIcon}>{isListening ? '⏹' : '🎤'}</Text>
        </TouchableOpacity>
        {isTyping ? (
          <TouchableOpacity style={styles.stopBtn} onPress={cancelRun}>
            <Text style={styles.stopIcon}>■</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() && attachments.length === 0) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!input.trim() && attachments.length === 0}>
            <Text style={styles.sendIcon}>↑</Text>
          </TouchableOpacity>
        )}
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0E17' },
  flex: { flex: 1 },
  loading: { flex: 1, backgroundColor: '#0F0E17', justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: '#A5B4FC', fontSize: 14 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#1E1B4B', borderBottomWidth: 1, borderBottomColor: '#312E81',
  },
  hamburger: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hamburgerIcon: { color: '#fff', fontSize: 22 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  modelBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#312E81', justifyContent: 'center', alignItems: 'center',
  },
  modelBtnText: { fontSize: 18 },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1E1B4B', borderRadius: 16, padding: 20,
    width: 260,
  },
  modalTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  modelRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10,
  },
  modelRowActive: { backgroundColor: '#312E81' },
  modelEmoji: { fontSize: 20 },
  modelLabel: { color: '#fff', fontSize: 15, flex: 1 },
  modelCheck: { color: '#6366F1', fontSize: 18, fontWeight: '700' },
  messageList: { paddingVertical: 12, flexGrow: 1 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingTop: 80, gap: 12 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { color: '#fff', fontSize: 22, fontWeight: '700' },
  emptySubtitle: { color: '#6B7280', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  thinkingBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: '#1E1B4B', borderTopWidth: 1, borderTopColor: '#312E81',
  },
  thinkingText: { color: '#A5B4FC', fontSize: 12, flex: 1 },
  attachmentBar: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6,
    paddingHorizontal: 12, paddingTop: 8,
    backgroundColor: '#1E1B4B', borderTopWidth: 1, borderTopColor: '#312E81',
  },
  attachmentChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#312E81', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6, maxWidth: 200,
  },
  attachmentName: { color: '#A5B4FC', fontSize: 12, flex: 1 },
  attachmentRemove: { color: '#EF4444', fontSize: 14, fontWeight: '700' },
  attachBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#312E81', justifyContent: 'center', alignItems: 'center',
  },
  attachIcon: { color: '#A5B4FC', fontSize: 22, fontWeight: '600' },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: '#1E1B4B', borderTopWidth: 1, borderTopColor: '#312E81',
  },
  input: {
    flex: 1, backgroundColor: '#312E81', color: '#fff', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, maxHeight: 120,
    borderWidth: 1, borderColor: '#4338CA',
  },
  micBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  micBtnActive: { backgroundColor: '#EF4444' },
  micIcon: { fontSize: 18 },
  sendBtn: { backgroundColor: '#6366F1', width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { backgroundColor: '#312E81' },
  sendIcon: { color: '#fff', fontSize: 20, fontWeight: '700' },
  stopBtn: { backgroundColor: '#EF4444', width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  stopIcon: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
