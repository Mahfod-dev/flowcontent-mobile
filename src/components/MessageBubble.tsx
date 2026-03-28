import React, { memo, useCallback, useState } from 'react';
import { Alert, Linking, Platform, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import Markdown from 'react-native-markdown-display';
import { Message } from '../types';

interface Props {
  message: Message;
  messageIndex?: number;
  sessionId?: string;
  onFeedback?: (messageIndex: number, rating: 'up' | 'down') => void;
}

export const MessageBubble = memo(function MessageBubble({ message, messageIndex, sessionId, onFeedback }: Props) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(message.content);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Message',
      '',
      [
        { text: 'Copier', onPress: handleCopy },
        {
          text: 'Partager',
          onPress: async () => {
            try {
              await Share.share({ message: message.content });
            } catch {}
          },
        },
        { text: 'Annuler', style: 'cancel' },
      ]
    );
  };

  const handleLinkPress = useCallback((url: string) => {
    return true;
  }, []);

  const handleFeedback = (rating: 'up' | 'down') => {
    if (feedback === rating) return;
    setFeedback(rating);
    if (onFeedback && messageIndex !== undefined) {
      onFeedback(messageIndex, rating);
    }
  };

  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowAssistant]}>
      {!isUser && <Text style={styles.avatar}>⚡</Text>}
      <View style={styles.bubbleWrap}>
        <TouchableOpacity
          style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}
          onLongPress={handleLongPress}
          activeOpacity={0.8}
        >
          {isUser ? (
            <Text style={styles.textUser}>{message.content}</Text>
          ) : (
            <View style={styles.markdownWrap}>
              <Markdown style={mdStyles} onLinkPress={handleLinkPress}>
                {message.content + (message.isStreaming ? ' ▌' : '')}
              </Markdown>
            </View>
          )}
          <Text style={styles.time}>
            {copied ? 'Copié !' : message.timestamp.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </TouchableOpacity>

        {/* Feedback buttons — assistant messages only, not while streaming */}
        {!isUser && !message.isStreaming && message.content.length > 0 && (
          <View style={styles.feedbackRow}>
            <TouchableOpacity
              onPress={() => handleFeedback('up')}
              style={[styles.feedbackBtn, feedback === 'up' && styles.feedbackActive]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[styles.feedbackIcon, feedback === 'up' && styles.feedbackIconActive]}>
                👍
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleFeedback('down')}
              style={[styles.feedbackBtn, feedback === 'down' && styles.feedbackActiveDown]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[styles.feedbackIcon, feedback === 'down' && styles.feedbackIconActive]}>
                👎
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', marginVertical: 4, paddingHorizontal: 12, alignItems: 'flex-end', gap: 8 },
  rowUser: { justifyContent: 'flex-end' },
  rowAssistant: { justifyContent: 'flex-start' },
  avatar: { fontSize: 20, marginBottom: 4 },
  bubbleWrap: { maxWidth: '82%' },
  bubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleUser: { backgroundColor: '#6366F1', borderBottomRightRadius: 4 },
  bubbleAssistant: { backgroundColor: '#1E1B4B', borderBottomLeftRadius: 4 },
  textUser: { color: '#fff', fontSize: 15, lineHeight: 22 },
  markdownWrap: { marginVertical: -8 },
  time: { fontSize: 10, color: '#6B7280', marginTop: 4, alignSelf: 'flex-end' },
  feedbackRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 4,
    marginLeft: 4,
  },
  feedbackBtn: {
    padding: 4,
    borderRadius: 12,
    opacity: 0.5,
  },
  feedbackActive: {
    opacity: 1,
    backgroundColor: 'rgba(99,102,241,0.2)',
  },
  feedbackActiveDown: {
    opacity: 1,
    backgroundColor: 'rgba(239,68,68,0.2)',
  },
  feedbackIcon: {
    fontSize: 14,
  },
  feedbackIconActive: {
    fontSize: 16,
  },
});

const mdStyles = {
  body: { color: '#E0E7FF', fontSize: 15, lineHeight: 22 },
  paragraph: { marginTop: 4, marginBottom: 4 },
  heading1: { color: '#fff', fontSize: 20, fontWeight: '700' as const, marginTop: 8, marginBottom: 4 },
  heading2: { color: '#fff', fontSize: 18, fontWeight: '700' as const, marginTop: 8, marginBottom: 4 },
  heading3: { color: '#fff', fontSize: 16, fontWeight: '600' as const, marginTop: 6, marginBottom: 4 },
  strong: { color: '#fff', fontWeight: '700' as const },
  em: { color: '#C7D2FE', fontStyle: 'italic' as const },
  link: { color: '#818CF8', textDecorationLine: 'underline' as const },
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: '#6366F1',
    paddingLeft: 12,
    marginLeft: 0,
    marginVertical: 6,
    backgroundColor: 'rgba(99,102,241,0.1)',
    borderRadius: 4,
  },
  code_inline: {
    backgroundColor: '#312E81',
    color: '#A5B4FC',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
  },
  code_block: {
    backgroundColor: '#0c0a1a',
    color: '#A5B4FC',
    padding: 12,
    borderRadius: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
    marginVertical: 6,
    overflow: 'hidden' as const,
  },
  fence: {
    backgroundColor: '#0c0a1a',
    color: '#A5B4FC',
    padding: 12,
    borderRadius: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
    marginVertical: 6,
  },
  bullet_list: { marginVertical: 4 },
  ordered_list: { marginVertical: 4 },
  list_item: { marginVertical: 2 },
  bullet_list_icon: { color: '#6366F1', fontSize: 14, marginRight: 6 },
  ordered_list_icon: { color: '#6366F1', fontSize: 14, marginRight: 6 },
  hr: { backgroundColor: '#312E81', height: 1, marginVertical: 8 },
  table: { borderColor: '#312E81', borderWidth: 1, borderRadius: 6, marginVertical: 6 },
  thead: { backgroundColor: '#312E81' },
  th: { color: '#fff', padding: 6, fontWeight: '600' as const },
  td: { color: '#E0E7FF', padding: 6, borderColor: '#312E81' },
  tr: { borderBottomWidth: 1, borderColor: '#312E81' },
};
