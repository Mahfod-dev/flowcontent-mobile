import React, { memo, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Modal, Platform, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
// expo-av removed — video playback disabled for now
const Video: any = null;
const ResizeMode: any = { CONTAIN: 'contain' };
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import Markdown from 'react-native-markdown-display';
import { Message } from '../types';
import { useColors } from '../contexts/ThemeContext';
import { t } from '../i18n';
import { ColorPalette, darkColors, getMarkdownTheme, radii, spacing } from '../theme';

const SCREEN_WIDTH = Dimensions.get('window').width;
const MAX_TABLE_WIDTH = SCREEN_WIDTH * 0.92 - 40;
const IMAGE_MAX_WIDTH = SCREEN_WIDTH * 0.92 - 80;

/** Clean up markdown quirks that react-native-markdown-display can't parse */
function sanitizeMarkdown(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1')
    .replace(/\[([^\]]+)\]\(\s*\)/g, '$1')
    .replace(/\[([^\]]+)\](?!\(|\[)/g, '$1');
}

const handleLinkPress = (_url: string) => true;

// --- Style factories ---

const createMainStyles = (colors: ColorPalette) => StyleSheet.create({
  row: { flexDirection: 'row', marginVertical: spacing.xs, paddingHorizontal: spacing.md, alignItems: 'flex-end', gap: spacing.sm },
  rowUser: { justifyContent: 'flex-end' },
  rowAssistant: { justifyContent: 'flex-start' },
  avatarWrap: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: colors.accentMuted,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: spacing.xs,
  },
  bubbleWrap: { maxWidth: '82%' },
  bubbleWrapAssistant: { maxWidth: '92%' },
  bubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleUser: { backgroundColor: colors.accent, borderBottomRightRadius: 4 },
  bubbleAssistant: {
    backgroundColor: colors.secondary, borderBottomLeftRadius: 6,
    paddingHorizontal: 16, paddingVertical: 12,
    borderWidth: 1, borderColor: colors.border,
  },
  textUser: { color: colors.white, fontSize: 15, lineHeight: 22 },
  markdownWrap: { marginVertical: -4 },
  time: { fontSize: 10, color: colors.textTertiary, marginTop: spacing.xs, alignSelf: 'flex-end', opacity: 0.6 },
  feedbackRow: {
    flexDirection: 'row', gap: spacing.xs,
    marginTop: spacing.xs, marginLeft: spacing.xs,
  },
  feedbackBtn: { padding: spacing.xs, borderRadius: radii.md, opacity: 0.6 },
  feedbackActive: { opacity: 1, backgroundColor: colors.accentMuted },
  feedbackActiveDown: { opacity: 1, backgroundColor: colors.errorMuted },
});

const createCodeBlockStyles = (colors: ColorPalette) => {
  const dark = colors.primary === darkColors.primary;
  return StyleSheet.create({
    wrapper: { marginVertical: 4, borderRadius: 8, overflow: 'hidden' },
    header: {
      backgroundColor: dark ? '#1A1A1A' : '#E0E0E0',
      paddingHorizontal: 12, paddingVertical: 6,
      borderTopLeftRadius: 8, borderTopRightRadius: 8,
    },
    headerText: {
      color: colors.textSecondary, fontSize: 11, fontWeight: '600',
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    scrollContainer: {
      backgroundColor: dark ? '#0A0A0A' : '#F0F0F0',
      borderRadius: 8, maxHeight: 300,
    },
    scrollContainerWithHeader: { borderTopLeftRadius: 0, borderTopRightRadius: 0 },
    scrollContent: { padding: 10 },
    codeText: {
      color: dark ? '#D4D4D4' : '#1C1C1E',
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: 12.5, lineHeight: 18,
    },
  });
};

const createTableStyles = (colors: ColorPalette) => StyleSheet.create({
  scrollContainer: {
    marginVertical: 6, borderRadius: 8,
    borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
  },
  table: { minWidth: '100%' },
  tr: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  trOdd: { backgroundColor: colors.tertiary },
  th: {
    flex: 1, backgroundColor: colors.tertiary,
    paddingVertical: 8, paddingHorizontal: 10, minWidth: 70,
  },
  thText: { color: colors.text, fontWeight: '600', fontSize: 12.5, flexWrap: 'wrap' },
  td: {
    flex: 1, paddingVertical: 7, paddingHorizontal: 10,
    minWidth: 70, backgroundColor: 'transparent',
  },
  tdText: { color: colors.text, fontSize: 13, flexWrap: 'wrap' },
});

const createImageStyles = (colors: ColorPalette) => StyleSheet.create({
  container: {
    marginVertical: 6, borderRadius: 8, overflow: 'hidden',
    backgroundColor: colors.tertiary, maxWidth: IMAGE_MAX_WIDTH,
  },
  image: { width: IMAGE_MAX_WIDTH, height: IMAGE_MAX_WIDTH * 0.66, borderRadius: 8 },
  alt: { color: colors.textSecondary, fontSize: 11, paddingHorizontal: 8, paddingVertical: 4 },
  previewOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center', alignItems: 'center',
  },
  previewImage: { width: SCREEN_WIDTH, height: SCREEN_WIDTH },
  closeBtn: {
    position: 'absolute', top: 60, right: 20,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
});

const createVideoStyles = (colors: ColorPalette) => StyleSheet.create({
  container: {
    marginVertical: 6, borderRadius: 8, overflow: 'hidden',
    backgroundColor: colors.tertiary, maxWidth: IMAGE_MAX_WIDTH,
  },
  loader: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'center', zIndex: 1,
  },
  player: { width: IMAGE_MAX_WIDTH, height: IMAGE_MAX_WIDTH * 0.56, borderRadius: 8 },
});

// --- Sub-components ---

function InlineImage({ src, alt }: { src?: string; alt?: string }) {
  const colors = useColors();
  const imgStyles = useMemo(() => createImageStyles(colors), [colors]);
  const [error, setError] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);

  if (!src || error) return null;

  return (
    <>
      <TouchableOpacity onPress={() => setPreviewVisible(true)} activeOpacity={0.8}>
        <View style={imgStyles.container}>
          <Image
            source={src}
            style={imgStyles.image}
            contentFit="contain"
            transition={200}
            placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
            onError={() => setError(true)}
          />
          {alt ? <Text style={imgStyles.alt} numberOfLines={1}>{alt}</Text> : null}
        </View>
      </TouchableOpacity>
      <Modal visible={previewVisible} transparent animationType="fade" onRequestClose={() => setPreviewVisible(false)}>
        <TouchableOpacity style={imgStyles.previewOverlay} activeOpacity={1} onPress={() => setPreviewVisible(false)}>
          <Image source={src} style={imgStyles.previewImage} contentFit="contain" />
          <TouchableOpacity style={imgStyles.closeBtn} onPress={() => setPreviewVisible(false)}>
            <Ionicons name="close" size={24} color={colors.white} />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

function InlineVideo({ src }: { src: string }) {
  const colors = useColors();
  const vidStyles = useMemo(() => createVideoStyles(colors), [colors]);
  const videoRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);

  if (!src || !Video) return null;

  return (
    <View style={vidStyles.container}>
      {loading && (
        <View style={vidStyles.loader}>
          <ActivityIndicator color={colors.accent} size="small" />
        </View>
      )}
      <Video
        ref={videoRef}
        source={{ uri: src }}
        style={vidStyles.player}
        resizeMode={ResizeMode.CONTAIN}
        useNativeControls
        shouldPlay={false}
        isLooping={false}
        onReadyForDisplay={() => setLoading(false)}
      />
    </View>
  );
}

// --- Render rules factory ---

function createRenderRules(
  cbStyles: ReturnType<typeof createCodeBlockStyles>,
  tblStyles: ReturnType<typeof createTableStyles>,
) {
  return {
    fence: (node: any, children: any, parent: any, styles: any) => {
      const lang = node.sourceInfo || '';
      return (
        <View key={node.key} style={cbStyles.wrapper}>
          {lang ? (
            <View style={cbStyles.header}>
              <Text style={cbStyles.headerText}>{lang}</Text>
            </View>
          ) : null}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={[cbStyles.scrollContainer, lang ? cbStyles.scrollContainerWithHeader : null]}
            contentContainerStyle={cbStyles.scrollContent}
          >
            <Text style={cbStyles.codeText}>{node.content}</Text>
          </ScrollView>
        </View>
      );
    },
    code_block: (node: any, children: any, parent: any, styles: any) => (
      <View key={node.key} style={cbStyles.wrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={cbStyles.scrollContainer}
          contentContainerStyle={cbStyles.scrollContent}
        >
          <Text style={cbStyles.codeText}>{node.content}</Text>
        </ScrollView>
      </View>
    ),
    table: (node: any, children: any, parent: any, styles: any) => {
      const firstRow = node.children?.[0]?.children || node.children?.[1]?.children?.[0]?.children || [];
      const colCount = firstRow.length || 1;
      const needsScroll = colCount > 3;
      const tableContent = (
        <View style={[tblStyles.table, !needsScroll && { width: '100%' }]}>{children}</View>
      );
      if (needsScroll) {
        return (
          <ScrollView key={node.key} horizontal showsHorizontalScrollIndicator style={tblStyles.scrollContainer}>
            {tableContent}
          </ScrollView>
        );
      }
      return (
        <View key={node.key} style={tblStyles.scrollContainer}>
          {tableContent}
        </View>
      );
    },
    tr: (node: any, children: any, parent: any, styles: any) => {
      const parentChildren = parent?.[0]?.children || [];
      const rowIndex = parentChildren.indexOf(node);
      const isOdd = rowIndex % 2 === 1;
      return (
        <View key={node.key} style={[tblStyles.tr, isOdd && tblStyles.trOdd]}>{children}</View>
      );
    },
    th: (node: any, children: any, parent: any, styles: any) => (
      <View key={node.key} style={tblStyles.th}>
        <Text style={tblStyles.thText}>{children}</Text>
      </View>
    ),
    td: (node: any, children: any, parent: any, styles: any) => (
      <View key={node.key} style={tblStyles.td}>
        <Text style={tblStyles.tdText}>{children}</Text>
      </View>
    ),
    image: (node: any) => {
      const src = node.attributes?.src || '';
      if (/\.(mp4|mov|webm)(\?|$)/i.test(src)) {
        return <InlineVideo key={node.key} src={src} />;
      }
      return <InlineImage key={node.key} src={src} alt={node.attributes?.alt} />;
    },
    link: (node: any, children: any) => {
      const href = node.attributes?.href || '';
      if (/\.(mp4|mov|webm)(\?|$)/i.test(href)) {
        return <InlineVideo key={node.key} src={href} />;
      }
      return null;
    },
  };
}

// --- Main component ---

interface Props {
  message: Message;
  messageIndex?: number;
  sessionId?: string;
  onFeedback?: (messageIndex: number, rating: 'up' | 'down') => void;
}

export const MessageBubble = memo(function MessageBubble({ message, messageIndex, sessionId, onFeedback }: Props) {
  const isUser = message.role === 'user';
  const colors = useColors();
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);

  const styles = useMemo(() => createMainStyles(colors), [colors]);
  const cbStyles = useMemo(() => createCodeBlockStyles(colors), [colors]);
  const tblStyles = useMemo(() => createTableStyles(colors), [colors]);
  const mdTheme = useMemo(() => getMarkdownTheme(colors), [colors]);
  const renderRules = useMemo(() => createRenderRules(cbStyles, tblStyles), [cbStyles, tblStyles]);

  const displayContent = useMemo(
    () => isUser ? message.content : sanitizeMarkdown(message.content) + (message.isStreaming ? ' \u258C' : ''),
    [isUser, message.content, message.isStreaming],
  );

  const handleCopy = async () => {
    try {
      await Clipboard.setStringAsync(message.content);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const handleLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      t('message'),
      '',
      [
        { text: t('copy'), onPress: handleCopy },
        {
          text: t('share'),
          onPress: async () => {
            try {
              await Share.share({ message: message.content });
            } catch {}
          },
        },
        { text: t('cancel'), style: 'cancel' },
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
          <Ionicons name="flash" size={18} color={colors.accent} />
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
              <Markdown style={mdTheme} rules={renderRules} onLinkPress={handleLinkPress}>
                {displayContent}
              </Markdown>
            </View>
          )}
          <Text style={styles.time}>
            {copied ? t('copiedText') : message.timestamp.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </TouchableOpacity>

        {!isUser && !message.isStreaming && message.content.length > 0 && (
          <View style={styles.feedbackRow}>
            <TouchableOpacity
              onPress={handleCopy}
              style={[styles.feedbackBtn, copied && styles.feedbackActive]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name={copied ? 'checkmark' : 'copy-outline'}
                size={13}
                color={copied ? colors.accent : colors.textTertiary}
              />
            </TouchableOpacity>
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
