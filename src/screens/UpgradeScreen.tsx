import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { CreditPack, CreditTransaction, CurrentSubscription, SubscriptionPlan } from '../types';
import { colors, commonStyles, radii, shadows, spacing } from '../theme';
import { safeOpenURL } from '../utils/safeOpenURL';

interface UpgradeScreenProps {
  onBack: () => void;
}

export function UpgradeScreen({ onBack }: UpgradeScreenProps) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [subscription, setSubscription] = useState<CurrentSubscription | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [packs, setPacks] = useState<CreditPack[]>([]);
  const [history, setHistory] = useState<CreditTransaction[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!user?.token) return;
    try {
      const [sub, plansData, packsData, historyData] = await Promise.all([
        apiService.getCurrentSubscription(user.token),
        apiService.getSubscriptionPlans(user.token),
        apiService.getCreditPacks(user.token),
        apiService.getCreditHistory(user.token),
      ]);
      setSubscription(sub);
      setPlans(plansData);
      setPacks(packsData);
      setHistory(historyData);
    } catch (e) {
      console.error('Failed to load upgrade data', e);
    } finally {
      setLoading(false);
    }
  }, [user?.token]);

  useEffect(() => { loadData(); }, [loadData]);

  // Auto-refresh when returning from Stripe (Safari)
  const appState = useRef(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        loadData();
      }
      appState.current = nextState;
    });
    return () => sub.remove();
  }, [loadData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleSubscribe = useCallback(async (planId: string) => {
    if (!user?.token) return;
    setActionLoading(planId);
    try {
      const result = await apiService.subscribePlan(user.token, planId);
      if (result?.url) {
        await safeOpenURL(result.url);
      } else {
        Alert.alert('Erreur', 'Impossible de charger la page de paiement.');
      }
    } catch (e) {
      Alert.alert('Erreur', 'Une erreur est survenue.');
    } finally {
      setActionLoading(null);
    }
  }, [user?.token]);

  const handlePurchasePack = useCallback(async (packId: string) => {
    if (!user?.token) return;
    setActionLoading(packId);
    try {
      const result = await apiService.purchasePack(user.token, packId);
      if (result?.url) {
        await safeOpenURL(result.url);
      } else {
        Alert.alert('Erreur', 'Impossible de charger la page de paiement.');
      }
    } catch (e) {
      Alert.alert('Erreur', 'Une erreur est survenue.');
    } finally {
      setActionLoading(null);
    }
  }, [user?.token]);

  const handlePortal = useCallback(async () => {
    if (!user?.token) return;
    setActionLoading('portal');
    try {
      const result = await apiService.getStripePortal(user.token);
      if (result?.url) {
        await safeOpenURL(result.url);
      } else {
        Alert.alert('Erreur', 'Impossible d\'ouvrir le portail.');
      }
    } catch (e) {
      Alert.alert('Erreur', 'Une erreur est survenue.');
    } finally {
      setActionLoading(null);
    }
  }, [user?.token]);

  const handleCancel = useCallback(() => {
    Alert.alert(
      'Annuler l\'abonnement',
      'Votre abonnement restera actif jusqu\'a la fin de la periode en cours.',
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui, annuler',
          style: 'destructive',
          onPress: async () => {
            if (!user?.token) return;
            try {
              const ok = await apiService.cancelSubscription(user.token);
              if (ok) {
                Alert.alert('Fait', 'Votre abonnement sera annule a la fin de la periode.');
                loadData();
              } else {
                Alert.alert('Erreur', 'Impossible d\'annuler l\'abonnement.');
              }
            } catch {
              Alert.alert('Erreur', 'Une erreur est survenue.');
            }
          },
        },
      ]
    );
  }, [user?.token, loadData]);

  const progressPercent = subscription
    ? subscription.credits_total > 0
      ? Math.min((subscription.credits_remaining / subscription.credits_total) * 100, 100)
      : 0
    : 0;

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={commonStyles.backBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={commonStyles.headerTitle}>Abonnement & Credits</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={commonStyles.loadingContainer}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={commonStyles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={commonStyles.headerTitle}>Abonnement & Credits</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />
        }
      >
        {/* Current Subscription */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>MON ABONNEMENT</Text>
          <View style={styles.card}>
            <View style={styles.planRow}>
              <Text style={styles.planName}>{subscription?.plan ?? 'Gratuit'}</Text>
              <View style={[styles.statusBadge, subscription?.status === 'active' ? styles.statusActive : styles.statusInactive]}>
                <Text style={[styles.statusText, subscription?.status === 'active' ? styles.statusTextActive : styles.statusTextInactive]}>
                  {subscription?.cancel_at_period_end ? 'Annulation prevue' : subscription?.status === 'active' ? 'Actif' : subscription?.status ?? 'Inactif'}
                </Text>
              </View>
            </View>
            <Text style={styles.creditsText}>
              {subscription?.credits_remaining ?? 0} / {subscription?.credits_total ?? 0} credits
            </Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
            </View>
            {subscription?.current_period_end && (
              <Text style={styles.renewDate}>
                Renouvellement : {new Date(subscription.current_period_end).toLocaleDateString('fr-FR')}
              </Text>
            )}
          </View>
        </View>

        {/* Subscription Plans */}
        {plans.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>CHANGER DE PLAN</Text>
            {plans.map((plan) => {
              const isCurrent = subscription?.plan?.toLowerCase() === plan.name?.toLowerCase();
              return (
                <View key={plan.id} style={[styles.planCard, isCurrent && styles.planCardCurrent]}>
                  <View style={styles.planCardHeader}>
                    <Text style={styles.planCardName}>{plan.name}</Text>
                    <Text style={styles.planCardPrice}>{plan.price}€/mois</Text>
                  </View>
                  <Text style={styles.planCardCredits}>{plan.credits} credits/mois</Text>
                  {plan.features && plan.features.length > 0 && (
                    <View style={styles.featuresContainer}>
                      {plan.features.map((f, i) => (
                        <View key={i} style={styles.featureRow}>
                          <Ionicons name="checkmark-circle-outline" size={14} color={colors.success} />
                          <Text style={styles.featureText}>{f}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  {isCurrent ? (
                    <View style={styles.currentPlanBadge}>
                      <Text style={styles.currentPlanText}>Plan actuel</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.choosePlanBtn}
                      onPress={() => handleSubscribe(plan.id)}
                      disabled={actionLoading === plan.id}
                      activeOpacity={0.7}
                    >
                      {actionLoading === plan.id ? (
                        <ActivityIndicator color={colors.white} size="small" />
                      ) : (
                        <Text style={styles.choosePlanText}>Choisir</Text>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Credit Packs */}
        {packs.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ACHETER DES CREDITS</Text>
            <View style={styles.packsGrid}>
              {packs.map((pack) => (
                <View key={pack.id} style={styles.packCard}>
                  <Text style={styles.packCredits}>{pack.credits}</Text>
                  <Text style={styles.packCreditsLabel}>credits</Text>
                  <Text style={styles.packPrice}>{pack.price}€</Text>
                  <TouchableOpacity
                    style={styles.packBuyBtn}
                    onPress={() => handlePurchasePack(pack.id)}
                    disabled={actionLoading === pack.id}
                    activeOpacity={0.7}
                  >
                    {actionLoading === pack.id ? (
                      <ActivityIndicator color={colors.white} size="small" />
                    ) : (
                      <Text style={styles.packBuyText}>Acheter</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Transaction History */}
        {history.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>HISTORIQUE</Text>
            {history.slice(0, 20).map((tx) => (
              <View key={tx.id} style={styles.historyRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyDesc}>{tx.description ?? tx.type}</Text>
                  <Text style={styles.historyDate}>
                    {new Date(tx.created_at).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </Text>
                </View>
                <Text style={[styles.historyAmount, tx.amount >= 0 ? styles.historyPositive : styles.historyNegative]}>
                  {tx.amount >= 0 ? '+' : ''}{tx.amount}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Actions */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.portalBtn}
            onPress={handlePortal}
            disabled={actionLoading === 'portal'}
            activeOpacity={0.7}
          >
            {actionLoading === 'portal' ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <Text style={styles.portalBtnText}>Gerer mon abonnement (Stripe)</Text>
            )}
          </TouchableOpacity>

          {subscription?.status === 'active' && !subscription?.cancel_at_period_end && (
            <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel} activeOpacity={0.7}>
              <Text style={styles.cancelBtnText}>Annuler l'abonnement</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  header: {
    ...commonStyles.header,
  },
  scroll: {
    flex: 1,
  },
  section: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
  },
  sectionTitle: {
    color: colors.textTertiary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.md,
  },
  card: {
    backgroundColor: colors.secondary,
    borderRadius: radii.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  planRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  planName: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: spacing.xs,
    borderRadius: radii.md,
  },
  statusActive: {
    backgroundColor: colors.successMuted,
  },
  statusInactive: {
    backgroundColor: colors.errorMuted,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusTextActive: {
    color: colors.success,
  },
  statusTextInactive: {
    color: colors.error,
  },
  creditsText: {
    color: colors.textSecondary,
    fontSize: 15,
    marginBottom: spacing.sm,
  },
  progressBar: {
    height: 6,
    backgroundColor: colors.tertiary,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 3,
  },
  renewDate: {
    color: colors.textTertiary,
    fontSize: 12,
  },
  planCard: {
    backgroundColor: colors.secondary,
    borderRadius: radii.md,
    padding: spacing.lg,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  planCardCurrent: {
    borderColor: colors.accent,
    borderWidth: 2,
  },
  planCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  planCardName: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  planCardPrice: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: '700',
  },
  planCardCredits: {
    color: colors.textSecondary,
    fontSize: 13,
    marginBottom: spacing.sm,
  },
  featuresContainer: {
    marginBottom: 10,
    gap: spacing.xs,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  featureText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  currentPlanBadge: {
    backgroundColor: colors.tertiary,
    borderRadius: radii.sm,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  currentPlanText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  choosePlanBtn: {
    backgroundColor: colors.accent,
    borderRadius: radii.sm,
    paddingVertical: 10,
    alignItems: 'center',
  },
  choosePlanText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  packsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  packCard: {
    backgroundColor: colors.secondary,
    borderRadius: radii.md,
    padding: 14,
    width: '48%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  packCredits: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
  },
  packCreditsLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: 6,
  },
  packPrice: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  packBuyBtn: {
    backgroundColor: colors.accent,
    borderRadius: radii.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  packBuyText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  historyDesc: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  historyDate: {
    color: colors.textTertiary,
    fontSize: 11,
    marginTop: 2,
  },
  historyAmount: {
    fontSize: 15,
    fontWeight: '700',
    marginLeft: spacing.md,
  },
  historyPositive: {
    color: colors.success,
  },
  historyNegative: {
    color: colors.error,
  },
  portalBtn: {
    backgroundColor: colors.tertiary,
    borderRadius: radii.sm,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  portalBtnText: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  cancelBtn: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: colors.error,
    fontSize: 14,
    fontWeight: '600',
  },
});
