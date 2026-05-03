import { Platform, StyleSheet } from 'react-native';

export const darkColors = {
  primary: '#111111',
  secondary: '#1A1A1A',
  tertiary: '#242424',
  sidebar: '#0F0F0F',
  accent: '#5B5FC7',
  accentMuted: 'rgba(91,95,199,0.15)',
  border: '#2A2A2A',
  borderLight: '#333333',
  text: '#F5F5F5',
  textSecondary: '#A0A0A0',
  textTertiary: '#6B6B6B',
  success: '#34C759',
  error: '#FF453A',
  warning: '#FF9F0A',
  successMuted: 'rgba(52,199,89,0.15)',
  errorMuted: 'rgba(255,69,58,0.15)',
  warningMuted: 'rgba(255,159,10,0.15)',
  overlay: 'rgba(0,0,0,0.6)',
  white: '#FFFFFF',
};

export const lightColors: ColorPalette = {
  primary: '#F2F2F7',
  secondary: '#FFFFFF',
  tertiary: '#E5E5EA',
  sidebar: '#F2F2F7',
  accent: '#5B5FC7',
  accentMuted: 'rgba(91,95,199,0.10)',
  border: '#D1D1D6',
  borderLight: '#C7C7CC',
  text: '#1C1C1E',
  textSecondary: '#8E8E93',
  textTertiary: '#AEAEB2',
  success: '#34C759',
  error: '#FF3B30',
  warning: '#FF9500',
  successMuted: 'rgba(52,199,89,0.12)',
  errorMuted: 'rgba(255,59,48,0.12)',
  warningMuted: 'rgba(255,149,0,0.12)',
  overlay: 'rgba(0,0,0,0.4)',
  white: '#FFFFFF',
};

export type ColorPalette = typeof darkColors;

/** Backward-compat: static dark palette for module-level usage */
export const colors = darkColors;

export function getColors(isDark: boolean): ColorPalette {
  return isDark ? darkColors : lightColors;
}

export function getMarkdownTheme(c: ColorPalette) {
  const dark = c.primary === darkColors.primary;
  return {
    body: { color: c.text, fontSize: 15, lineHeight: 25 },
    paragraph: { marginTop: 4, marginBottom: 8 },
    heading1: { color: c.text, fontSize: 20, fontWeight: '700' as const, marginTop: 16, marginBottom: 8, lineHeight: 28 },
    heading2: { color: c.text, fontSize: 17.5, fontWeight: '700' as const, marginTop: 14, marginBottom: 6, lineHeight: 24 },
    heading3: { color: c.text, fontSize: 15.5, fontWeight: '600' as const, marginTop: 10, marginBottom: 4, lineHeight: 22 },
    strong: { color: c.text, fontWeight: '700' as const },
    em: { color: c.textSecondary, fontStyle: 'italic' as const },
    link: { color: c.accent, textDecorationLine: 'underline' as const },
    blockquote: {
      borderLeftWidth: 4, borderLeftColor: c.accent,
      paddingLeft: 14, paddingVertical: 8, marginLeft: 0, marginVertical: 4,
      backgroundColor: c.accentMuted, borderRadius: 6,
    },
    code_inline: {
      backgroundColor: c.tertiary, color: c.textSecondary,
      paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 13.5,
    },
    code_block: {
      backgroundColor: dark ? '#0A0A0A' : '#F0F0F0',
      color: dark ? '#D4D4D4' : '#1C1C1E',
      padding: 10, borderRadius: 8,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: 12.5, lineHeight: 18, marginVertical: 4,
    },
    fence: {
      backgroundColor: dark ? '#0A0A0A' : '#F0F0F0',
      color: dark ? '#D4D4D4' : '#1C1C1E',
      padding: 10, borderRadius: 8,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: 12.5, lineHeight: 18, marginVertical: 4,
    },
    bullet_list: { marginVertical: 6 },
    ordered_list: { marginVertical: 6 },
    list_item: { marginVertical: 3, flexDirection: 'row' as const },
    bullet_list_icon: { color: c.accent, fontSize: 10, marginRight: 8, marginTop: 7 },
    ordered_list_icon: { color: c.accent, fontSize: 14, fontWeight: '600' as const, marginRight: 6 },
    bullet_list_content: { flex: 1 },
    ordered_list_content: { flex: 1 },
    hr: { backgroundColor: c.border, height: StyleSheet.hairlineWidth, marginVertical: 12 },
    table: { borderColor: c.border, borderWidth: 1, borderRadius: 6, marginVertical: 4 },
    thead: { backgroundColor: c.tertiary },
    th: { color: c.text, padding: 4, paddingHorizontal: 6, fontWeight: '600' as const, fontSize: 12 },
    td: { color: c.text, padding: 4, paddingHorizontal: 6, borderColor: c.border, fontSize: 13 },
    tr: { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.border },
  };
}

export function getNotificationMarkdownTheme(c: ColorPalette) {
  return {
    body: { color: c.textSecondary, fontSize: 13, lineHeight: 18 },
    strong: { color: c.text, fontWeight: '700' as const },
    em: { color: c.textSecondary, fontStyle: 'italic' as const },
    link: { color: c.accent, textDecorationLine: 'underline' as const },
    paragraph: { marginTop: 0, marginBottom: 0 },
    bullet_list: { marginTop: 2, marginBottom: 2 },
    ordered_list: { marginTop: 2, marginBottom: 2 },
    list_item: { marginTop: 0, marginBottom: 0 },
    heading1: { color: c.text, fontSize: 15, fontWeight: '700' as const, marginTop: 0, marginBottom: 2 },
    heading2: { color: c.text, fontSize: 14, fontWeight: '700' as const, marginTop: 0, marginBottom: 2 },
    heading3: { color: c.text, fontSize: 13, fontWeight: '600' as const, marginTop: 0, marginBottom: 2 },
    code_inline: { backgroundColor: c.tertiary, color: c.textSecondary, fontSize: 12, paddingHorizontal: 4, borderRadius: 3 },
    fence: { backgroundColor: c.tertiary, borderRadius: 6, padding: 8, marginVertical: 4 },
    code_block: { color: c.textSecondary, fontSize: 12 },
  };
}

export const typography = {
  title: { fontSize: 18, fontWeight: '700' as const, color: colors.text },
  body: { fontSize: 15, color: colors.text },
  caption: { fontSize: 12, color: colors.textSecondary },
  label: {
    fontSize: 11, fontWeight: '600' as const, color: colors.textTertiary,
    textTransform: 'uppercase' as const, letterSpacing: 0.5,
  },
} as const;

export const spacing = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 48,
} as const;

export const radii = {
  sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, full: 9999,
} as const;

export const shadows = {
  card: {
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 4,
  },
  subtle: {
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15, shadowRadius: 4, elevation: 2,
  },
} as const;

export const DRAWER_WIDTH = 300;

export const commonStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.primary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    backgroundColor: 'transparent',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  headerTitle: { ...typography.title },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  card: {
    backgroundColor: colors.secondary, borderRadius: radii.md,
    padding: spacing.lg, borderWidth: 1, borderColor: colors.border,
  },
  input: {
    backgroundColor: colors.tertiary, color: colors.text, borderRadius: radii.md,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md, fontSize: 15,
    borderWidth: 1, borderColor: colors.borderLight,
  },
  sectionTitle: { ...typography.label, marginBottom: spacing.md },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});

// Backward-compat static exports (dark only)
export const markdownTheme = getMarkdownTheme(darkColors);
export const notificationMarkdownTheme = getNotificationMarkdownTheme(darkColors);
