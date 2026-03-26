import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MessageBubble } from '../components/MessageBubble';
import { ToolActivity } from '../components/ToolActivity';
import { useAuth } from '../contexts/AuthContext';
import { useChat } from '../hooks/useChat';
import { apiService } from '../services/api';

interface ChatScreenProps {
  sessionId: string | null;
  onOpenDrawer: () => void;
}

export function ChatScreen({ sessionId, onOpenDrawer }: ChatScreenProps) {
  const { user } = useAuth();
  const [input, setInput] = useState('');
  const flatListRef = useRef<FlatList>(null);

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
    if (!input.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    sendMessage(input.trim());
    setInput('');
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
        <Text style={styles.headerTitle}>⚡ FC-Agent</Text>
        <View style={styles.headerSpacer} />
      </View>

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

      {/* Input */}
      <View style={styles.inputRow}>
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
        {isTyping ? (
          <TouchableOpacity style={styles.stopBtn} onPress={cancelRun}>
            <Text style={styles.stopIcon}>■</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!input.trim()}>
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
  headerSpacer: { width: 36 },
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
  sendBtn: { backgroundColor: '#6366F1', width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { backgroundColor: '#312E81' },
  sendIcon: { color: '#fff', fontSize: 20, fontWeight: '700' },
  stopBtn: { backgroundColor: '#EF4444', width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  stopIcon: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
