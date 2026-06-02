import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { t } from '../i18n';
import { useColors } from '../contexts/ThemeContext';

interface State {
  hasError: boolean;
}

/**
 * Themed fallback — uses the same color palette as the rest of the app.
 * Hardcoded colors (the previous design) made the error screen unreadable
 * in light mode (AUDIT P0-1).
 */
function ErrorFallback({ onRetry }: { onRetry: () => void }) {
  const colors = useColors();
  return (
    <View style={[styles.container, { backgroundColor: colors.primary }]}>
      <Ionicons name="warning-outline" size={48} color={colors.error} />
      <Text style={[styles.title, { color: colors.text }]}>{t('crashTitle')}</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('crashSubtitle')}</Text>
      <TouchableOpacity
        style={[styles.button, { backgroundColor: colors.accent }]}
        onPress={onRetry}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={t('retry')}
      >
        <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>{t('retry')}</Text>
      </TouchableOpacity>
    </View>
  );
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(_error: Error): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback onRetry={() => this.setState({ hasError: false })} />;
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
