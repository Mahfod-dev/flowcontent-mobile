import React, { memo, useCallback, useState } from 'react';
import { Alert, Linking, Platform, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import Markdown from 'react-native-markdown-display';
import { Message } from '../types';
import { colors, markdownTheme, radii, spacing } from '../theme';

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
      {!isUser && (
        <View style={styles.avatarWrap}>
          <Ionicons name="flash" size={16} color={colors.accent} />
        </View>
      )}
      <View style={styles.bubbleWrap}>
        <TouchableOpacity
          style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}
          onLongPress={handleLongPress}
          activeOpacity={0.7}
        >
          {isUser ? (
            <Text style={styles.textUser}>{message.content}</Text>
          ) : (
            <View style={styles.markdownWrap}>
              <Markdown style={markdownTheme} onLinkPress={handleLinkPress}>
                {message.content + (message.isStreaming ? ' \u258C' : '')}
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
              <Ionicons
                name={feedback === 'up' ? 'thumbs-up' : 'thumbs-up-outline'}
                size={feedback === 'up' ? 15 : 13}
                color={feedback === 'up' ? colors.accent : colors.textTertiary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleFeedback('down')}
              style={[styles.feedbackBtn, feedback === 'down' && styles.feedbackActiveDown]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name={feedback === 'down' ? 'thumbs-down' : 'thumbs-down-outline'}
                size={feedback === 'down' ? 15 : 13}
                color={feedback === 'down' ? colors.error : colors.textTertiary}
              />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', marginVertical: spacing.xs, paddingHorizontal: spacing.md, alignItems: 'flex-end', gap: spacing.sm },
  rowUser: { justifyContent: 'flex-end' },
  rowAssistant: { justifyContent: 'flex-start' },
  avatarWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accentMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  bubbleWrap: { maxWidth: '82%' },
  bubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleUser: { backgroundColor: colors.accent, borderBottomRightRadius: 4 },
  bubbleAssistant: { backgroundColor: colors.secondary, borderBottomLeftRadius: 4 },
  textUser: { color: colors.white, fontSize: 15, lineHeight: 22 },
  markdownWrap: { marginVertical: -8 },
  time: { fontSize: 10, color: colors.textTertiary, marginTop: spacing.xs, alignSelf: 'flex-end' },
  feedbackRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
    marginLeft: spacing.xs,
  },
  feedbackBtn: {
    padding: spacing.xs,
    borderRadius: radii.md,
    opacity: 0.6,
  },
  feedbackActive: {
    opacity: 1,
    backgroundColor: colors.accentMuted,
  },
  feedbackActiveDown: {
    opacity: 1,
    backgroundColor: colors.errorMuted,
  },
});
