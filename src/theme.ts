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
  body: { color: colors.text, fontSize: 15, lineHeight: 22 },
  paragraph: { marginTop: 4, marginBottom: 4 },
  heading1: { color: colors.text, fontSize: 20, fontWeight: '700' as const, marginTop: 8, marginBottom: 4 },
  heading2: { color: colors.text, fontSize: 18, fontWeight: '700' as const, marginTop: 8, marginBottom: 4 },
  heading3: { color: colors.text, fontSize: 16, fontWeight: '600' as const, marginTop: 6, marginBottom: 4 },
  strong: { color: colors.white, fontWeight: '700' as const },
  em: { color: colors.textSecondary, fontStyle: 'italic' as const },
  link: { color: colors.accent, textDecorationLine: 'underline' as const },
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
    paddingLeft: 12,
    marginLeft: 0,
    marginVertical: 6,
    backgroundColor: colors.accentMuted,
    borderRadius: 4,
  },
  code_inline: {
    backgroundColor: colors.tertiary,
    color: colors.textSecondary,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
  },
  code_block: {
    backgroundColor: '#0D0D0D',
    color: colors.textSecondary,
    padding: 12,
    borderRadius: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
    marginVertical: 6,
    overflow: 'hidden' as const,
  },
  fence: {
    backgroundColor: '#0D0D0D',
    color: colors.textSecondary,
    padding: 12,
    borderRadius: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
    marginVertical: 6,
  },
  bullet_list: { marginVertical: 4 },
  ordered_list: { marginVertical: 4 },
  list_item: { marginVertical: 2 },
  bullet_list_icon: { color: colors.accent, fontSize: 14, marginRight: 6 },
  ordered_list_icon: { color: colors.accent, fontSize: 14, marginRight: 6 },
  hr: { backgroundColor: colors.border, height: 1, marginVertical: 8 },
  table: { borderColor: colors.border, borderWidth: 1, borderRadius: 6, marginVertical: 6 },
  thead: { backgroundColor: colors.tertiary },
  th: { color: colors.text, padding: 6, fontWeight: '600' as const },
  td: { color: colors.text, padding: 6, borderColor: colors.border },
  tr: { borderBottomWidth: 1, borderColor: colors.border },
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
