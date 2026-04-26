import React, { memo, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ToolCall } from '../types';
import { colors, spacing } from '../theme';

// Friendly tool name mapping
const TOOL_LABELS: Record<string, string> = {
  search_google: 'Recherche Google',
  web_scrape: 'Extraction web',
  write_article: 'Rédaction article',
  seo_audit: 'Audit SEO',
  analyze_seo: 'Analyse SEO',
  keyword_research: 'Recherche mots-clés',
  competitor_analysis: 'Analyse concurrence',
  ask_alexandre: 'Consultation Alexandre',
  generate_image: 'Génération image',
  wordpress_publish: 'Publication WordPress',
  wordpress_create_post: 'Création article WP',
  wordpress_update_post: 'Mise à jour article WP',
  read_file: 'Lecture fichier',
  write_file: 'Écriture fichier',
};

function getToolLabel(name: string): string {
  return TOOL_LABELS[name] || name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function ElapsedTimer({ startedAt }: { startedAt: number }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Date.now() - startedAt);
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);
  return <Text style={styles.elapsed}>{formatDuration(elapsed)}</Text>;
}

export const ToolActivity = memo(function ToolActivity({ tools }: { tools: ToolCall[] }) {
  if (tools.length === 0) return null;

  return (
    <View style={styles.container}>
      {tools.map((tool) => (
        <View key={tool.id} style={styles.toolRow}>
          {tool.status === 'running' ? (
            <ActivityIndicator size="small" color={colors.accent} style={styles.indicator} />
          ) : (
            <Ionicons name="checkmark" size={14} color={colors.success} style={styles.checkIcon} />
          )}
          <Text style={[styles.toolName, tool.status === 'done' && styles.toolDone]} numberOfLines={1}>
            {getToolLabel(tool.name)}
          </Text>
          {tool.status === 'running' && tool.message && (
            <Text style={styles.progress} numberOfLines={1}>{tool.message}</Text>
          )}
          {tool.status === 'running' ? (
            <ElapsedTimer startedAt={tool.startedAt} />
          ) : tool.durationMs ? (
            <Text style={styles.duration}>{formatDuration(tool.durationMs)}</Text>
          ) : null}
        </View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.secondary,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: 6,
  },
  toolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  indicator: {
    width: 16,
    height: 16,
  },
  checkIcon: {
    width: 16,
    textAlign: 'center',
  },
  toolName: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  toolDone: {
    color: colors.textTertiary,
  },
  progress: {
    color: colors.textTertiary,
    fontSize: 11,
    maxWidth: 100,
  },
  elapsed: {
    color: colors.textTertiary,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  duration: {
    color: colors.success,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
});
