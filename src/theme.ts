import { Platform, StyleSheet } from 'react-native';

export const colors = {
  // Surfaces (3 levels)
  primary: '#111111',
  secondary: '#1A1A1A',
  tertiary: '#242424',

  // Sidebar
  sidebar: '#0F0F0F',

  // Accent
  accent: '#5B5FC7',
  accentMuted: 'rgba(91,95,199,0.15)',

  // Borders
  border: '#2A2A2A',
  borderLight: '#333333',

  // Text
  text: '#F5F5F5',
  textSecondary: '#A0A0A0',
  textTertiary: '#6B6B6B',

  // Semantic
  success: '#34C759',
  error: '#FF453A',
  warning: '#FF9F0A',

  // Semantic muted backgrounds
  successMuted: 'rgba(52,199,89,0.15)',
  errorMuted: 'rgba(255,69,58,0.15)',
  warningMuted: 'rgba(255,159,10,0.15)',

  // Overlay
  overlay: 'rgba(0,0,0,0.6)',

  // White (for buttons on accent, etc.)
  white: '#FFFFFF',
} as const;

export const typography = {
  title: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.text,
  },
  body: {
    fontSize: 15,
    color: colors.text,
  },
  caption: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  label: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: colors.textTertiary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
} as const;

export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  subtle: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
} as const;

export const DRAWER_WIDTH = 300;

export const commonStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: 'transparent',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    ...typography.title,
  },
  backBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: colors.secondary,
    borderRadius: radii.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: {
    backgroundColor: colors.tertiary,
    color: colors.text,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  sectionTitle: {
    ...typography.label,
    marginBottom: spacing.md,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export const markdownTheme = {
  // Body — slightly larger line height for mobile readability
  body: { color: colors.text, fontSize: 15, lineHeight: 24 },

  // Paragraphs — compact for chat context
  paragraph: { marginTop: 2, marginBottom: 6 },

  // Headings — scaled down for chat bubbles (not articles)
  heading1: { color: colors.text, fontSize: 17, fontWeight: '700' as const, marginTop: 10, marginBottom: 4, lineHeight: 24 },
  heading2: { color: colors.text, fontSize: 16, fontWeight: '700' as const, marginTop: 8, marginBottom: 4, lineHeight: 22 },
  heading3: { color: colors.text, fontSize: 15, fontWeight: '600' as const, marginTop: 6, marginBottom: 2, lineHeight: 22 },

  // Inline
  strong: { color: colors.white, fontWeight: '700' as const },
  em: { color: colors.textSecondary, fontStyle: 'italic' as const },
  link: { color: colors.accent, textDecorationLine: 'none' as const },

  // Blockquote
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
    paddingLeft: 10,
    paddingVertical: 2,
    marginLeft: 0,
    marginVertical: 4,
    backgroundColor: colors.accentMuted,
    borderRadius: 4,
  },

  // Inline code — pill style
  code_inline: {
    backgroundColor: colors.tertiary,
    color: '#E0E0E0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13.5,
  },

  // Code blocks — dark, compact, readable on small screens
  code_block: {
    backgroundColor: '#0A0A0A',
    color: '#D4D4D4',
    padding: 10,
    borderRadius: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12.5,
    lineHeight: 18,
    marginVertical: 4,
  },
  fence: {
    backgroundColor: '#0A0A0A',
    color: '#D4D4D4',
    padding: 10,
    borderRadius: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12.5,
    lineHeight: 18,
    marginVertical: 4,
  },

  // Lists — compact for mobile
  bullet_list: { marginVertical: 2 },
  ordered_list: { marginVertical: 2 },
  list_item: { marginVertical: 1, flexDirection: 'row' as const },
  bullet_list_icon: { color: colors.accent, fontSize: 8, marginRight: 8, marginTop: 8 },
  ordered_list_icon: { color: colors.accent, fontSize: 13, marginRight: 6 },
  bullet_list_content: { flex: 1 },
  ordered_list_content: { flex: 1 },

  // Horizontal rule
  hr: { backgroundColor: colors.border, height: StyleSheet.hairlineWidth, marginVertical: 8 },

  // Tables — compact cells for mobile
  table: { borderColor: colors.border, borderWidth: 1, borderRadius: 6, marginVertical: 4 },
  thead: { backgroundColor: colors.tertiary },
  th: { color: colors.text, padding: 4, paddingHorizontal: 6, fontWeight: '600' as const, fontSize: 12 },
  td: { color: colors.text, padding: 4, paddingHorizontal: 6, borderColor: colors.border, fontSize: 13 },
  tr: { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
} as const;

export const notificationMarkdownTheme = {
  body: { color: colors.textSecondary, fontSize: 13, lineHeight: 18 },
  strong: { color: colors.text, fontWeight: '700' as const },
  em: { color: colors.textSecondary, fontStyle: 'italic' as const },
  link: { color: colors.accent, textDecorationLine: 'underline' as const },
  paragraph: { marginTop: 0, marginBottom: 0 },
  bullet_list: { marginTop: 2, marginBottom: 2 },
  ordered_list: { marginTop: 2, marginBottom: 2 },
  list_item: { marginTop: 0, marginBottom: 0 },
  heading1: { color: colors.text, fontSize: 15, fontWeight: '700' as const, marginTop: 0, marginBottom: 2 },
  heading2: { color: colors.text, fontSize: 14, fontWeight: '700' as const, marginTop: 0, marginBottom: 2 },
  heading3: { color: colors.text, fontSize: 13, fontWeight: '600' as const, marginTop: 0, marginBottom: 2 },
  code_inline: { backgroundColor: colors.tertiary, color: colors.textSecondary, fontSize: 12, paddingHorizontal: 4, borderRadius: 3 },
  fence: { backgroundColor: colors.tertiary, borderRadius: 6, padding: 8, marginVertical: 4 },
  code_block: { color: colors.textSecondary, fontSize: 12 },
} as const;
