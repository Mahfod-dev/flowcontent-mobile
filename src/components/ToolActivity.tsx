import React, { memo, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ToolCall } from '../types';
import { useColors } from '../contexts/ThemeContext';
import { ColorPalette, spacing } from '../theme';

// Clean up tool name for display (displayLabel from backend is preferred)
function getToolLabel(name: string): string {
  // Strip mcp prefixes: mcp_brave_search_query → query
  const cleaned = name.replace(/^mcp_[a-z0-9]+_/, '');
  return cleaned.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function ElapsedTimer({ startedAt, style }: { startedAt: number; style: any }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Date.now() - startedAt);
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);
  return <Text style={style}>{formatDuration(elapsed)}</Text>;
}

export const ToolActivity = memo(function ToolActivity({ tools }: { tools: ToolCall[] }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

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
            <ElapsedTimer startedAt={tool.startedAt} style={styles.elapsed} />
          ) : tool.durationMs ? (
            <Text style={styles.duration}>{formatDuration(tool.durationMs)}</Text>
          ) : null}
        </View>
      ))}
    </View>
  );
});

const createStyles = (colors: ColorPalette) => StyleSheet.create({
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
