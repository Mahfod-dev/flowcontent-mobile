import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, ViewStyle } from 'react-native';
import { useColors } from '../contexts/ThemeContext';

interface SkeletonProps {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
}

/** Animated shimmer skeleton loader */
export function Skeleton({ width, height, borderRadius = 8, style }: SkeletonProps) {
  const colors = useColors();
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: colors.tertiary,
          opacity,
        },
        style,
      ]}
    />
  );
}

/** Pre-built skeleton for dashboard cards */
export function DashboardSkeleton() {
  return (
    <View style={skStyles.container}>
      <View style={skStyles.row}>
        <Skeleton width="48%" height={80} />
        <Skeleton width="48%" height={80} />
      </View>
      <Skeleton width="100%" height={120} />
      <Skeleton width="100%" height={60} />
      <Skeleton width="100%" height={60} />
      <Skeleton width="100%" height={160} />
    </View>
  );
}

/** Pre-built skeleton for notification list */
export function NotificationsSkeleton() {
  return (
    <View style={skStyles.container}>
      {[1, 2, 3, 4, 5].map((i) => (
        <View key={i} style={skStyles.notifRow}>
          <Skeleton width={40} height={40} borderRadius={20} />
          <View style={skStyles.notifText}>
            <Skeleton width="70%" height={14} />
            <Skeleton width="100%" height={12} />
            <Skeleton width="40%" height={10} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Pre-built skeleton for media grid */
export function MediaSkeleton() {
  return (
    <View style={skStyles.container}>
      {[1, 2, 3, 4, 5].map((i) => (
        <View key={i} style={skStyles.mediaRow}>
          <Skeleton width={44} height={44} borderRadius={8} />
          <View style={skStyles.notifText}>
            <Skeleton width="60%" height={14} />
            <Skeleton width="30%" height={10} />
          </View>
        </View>
      ))}
    </View>
  );
}

const skStyles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  notifRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  notifText: { flex: 1, gap: 6 },
  mediaRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
});
