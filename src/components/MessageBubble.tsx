import React, { memo, useState } from 'react';
import { Alert, Platform, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import Markdown from 'react-native-markdown-display';
import { Message } from '../types';
import { colors, markdownTheme, radii, spacing } from '../theme';

// Stable render rules — defined outside component to avoid re-renders during streaming
const MARKDOWN_RENDER_RULES = {
  fence: (node: any, children: any, parent: any, styles: any) => (
    <ScrollView
      key={node.key}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={codeBlockStyles.scrollContainer}
      contentContainerStyle={codeBlockStyles.scrollContent}
    >
      <Text style={codeBlockStyles.codeText}>{node.content}</Text>
    </ScrollView>
  ),
  code_block: (node: any, children: any, parent: any, styles: any) => (
    <ScrollView
      key={node.key}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={codeBlockStyles.scrollContainer}
      contentContainerStyle={codeBlockStyles.scrollContent}
    >
      <Text style={codeBlockStyles.codeText}>{node.content}</Text>
    </ScrollView>
  ),
  table: (node: any, children: any, parent: any, styles: any) => (
    <ScrollView
      key={node.key}
      horizontal
      showsHorizontalScrollIndicator
      style={tableStyles.scrollContainer}
    >
      <View style={tableStyles.table}>{children}</View>
    </ScrollView>
  ),
  tr: (node: any, children: any, parent: any, styles: any) => (
    <View key={node.key} style={tableStyles.tr}>{children}</View>
  ),
  th: (node: any, children: any, parent: any, styles: any) => (
    <View key={node.key} style={tableStyles.th}>
      <Text style={tableStyles.thText}>{children}</Text>
    </View>
  ),
  td: (node: any, children: any, parent: any, styles: any) => (
    <View key={node.key} style={tableStyles.td}>
      <Text style={tableStyles.tdText}>{children}</Text>
    </View>
  ),
};

const handleLinkPress = (_url: string) => true; // return true = open with Linking.openURL

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
      <View style={[styles.bubbleWrap, !isUser && styles.bubbleWrapAssistant]}>
        <TouchableOpacity
          style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}
          onLongPress={handleLongPress}
          activeOpacity={0.7}
        >
          {isUser ? (
            <Text style={styles.textUser}>{message.content}</Text>
          ) : (
            <View style={styles.markdownWrap}>
              <Markdown style={markdownTheme} rules={MARKDOWN_RENDER_RULES} onLinkPress={handleLinkPress}>
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
  bubbleWrapAssistant: { maxWidth: '92%' },
  bubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleUser: { backgroundColor: colors.accent, borderBottomRightRadius: 4 },
  bubbleAssistant: { backgroundColor: colors.secondary, borderBottomLeftRadius: 4, paddingHorizontal: 12, paddingVertical: 8 },
  textUser: { color: colors.white, fontSize: 15, lineHeight: 22 },
  markdownWrap: { marginVertical: -4 },
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

const codeBlockStyles = StyleSheet.create({
  scrollContainer: {
    backgroundColor: '#0A0A0A',
    borderRadius: 8,
    marginVertical: 4,
    maxHeight: 300,
  },
  scrollContent: {
    padding: 10,
  },
  codeText: {
    color: '#D4D4D4',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12.5,
    lineHeight: 18,
  },
});

const tableStyles = StyleSheet.create({
  scrollContainer: {
    marginVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  table: {
    minWidth: '100%',
  },
  tr: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  th: {
    backgroundColor: colors.tertiary,
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: 100,
  },
  thText: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 12.5,
  },
  td: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    minWidth: 100,
    backgroundColor: 'transparent',
  },
  tdText: {
    color: colors.text,
    fontSize: 13,
  },
});
