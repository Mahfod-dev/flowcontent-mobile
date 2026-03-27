import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { CreditPack, CreditTransaction, CurrentSubscription, SubscriptionPlan } from '../types';

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
        await Linking.openURL(result.url);
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
        await Linking.openURL(result.url);
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
        await Linking.openURL(result.url);
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
            const ok = await apiService.cancelSubscription(user.token);
            if (ok) {
              Alert.alert('Fait', 'Votre abonnement sera annule a la fin de la periode.');
              loadData();
            } else {
              Alert.alert('Erreur', 'Impossible d\'annuler l\'abonnement.');
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
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Text style={styles.backText}>{'\u2039'}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Abonnement & Credits</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#6366F1" size="large" />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>{'\u2039'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Abonnement & Credits</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#6366F1" />
        }
      >
        {/* Current Subscription */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mon abonnement</Text>
          <View style={styles.card}>
            <View style={styles.planRow}>
              <Text style={styles.planName}>{subscription?.plan ?? 'Gratuit'}</Text>
              <View style={[styles.statusBadge, subscription?.status === 'active' ? styles.statusActive : styles.statusInactive]}>
                <Text style={styles.statusText}>
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
            <Text style={styles.sectionTitle}>Changer de plan</Text>
            {plans.map((plan) => {
              const isCurrent = subscription?.plan?.toLowerCase() === plan.name?.toLowerCase();
              return (
                <View key={plan.id} style={[styles.planCard, isCurrent && styles.planCardCurrent]}>
                  <View style={styles.planCardHeader}>
                    <Text style={styles.planCardName}>{plan.name}</Text>
                    <Text style={styles.planCardPrice}>{plan.price}EUR/mois</Text>
                  </View>
                  <Text style={styles.planCardCredits}>{plan.credits} credits/mois</Text>
                  {plan.features && plan.features.length > 0 && (
                    <View style={styles.featuresContainer}>
                      {plan.features.map((f, i) => (
                        <Text key={i} style={styles.featureText}>- {f}</Text>
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
                    >
                      {actionLoading === plan.id ? (
                        <ActivityIndicator color="#fff" size="small" />
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
            <Text style={styles.sectionTitle}>Acheter des credits</Text>
            <View style={styles.packsGrid}>
              {packs.map((pack) => (
                <View key={pack.id} style={styles.packCard}>
                  <Text style={styles.packCredits}>{pack.credits}</Text>
                  <Text style={styles.packCreditsLabel}>credits</Text>
                  <Text style={styles.packPrice}>{pack.price}EUR</Text>
                  <TouchableOpacity
                    style={styles.packBuyBtn}
                    onPress={() => handlePurchasePack(pack.id)}
                    disabled={actionLoading === pack.id}
                  >
                    {actionLoading === pack.id ? (
                      <ActivityIndicator color="#fff" size="small" />
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
            <Text style={styles.sectionTitle}>Historique</Text>
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
          >
            {actionLoading === 'portal' ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.portalBtnText}>Gerer mon abonnement (Stripe)</Text>
            )}
          </TouchableOpacity>

          {subscription?.status === 'active' && !subscription?.cancel_at_period_end && (
            <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
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
    backgroundColor: '#0F0E17',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1E1B4B',
  },
  backBtn: {
    paddingRight: 12,
    paddingVertical: 4,
  },
  backText: {
    color: '#A5B4FC',
    fontSize: 28,
    fontWeight: '600',
    lineHeight: 30,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 16,
    marginTop: 20,
  },
  sectionTitle: {
    color: '#A5B4FC',
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#1E1B4B',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#312E81',
  },
  planRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  planName: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusActive: {
    backgroundColor: 'rgba(34,197,94,0.15)',
  },
  statusInactive: {
    backgroundColor: 'rgba(239,68,68,0.15)',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#22C55E',
  },
  creditsText: {
    color: '#D1D5DB',
    fontSize: 15,
    marginBottom: 8,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#312E81',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#6366F1',
    borderRadius: 3,
  },
  renewDate: {
    color: '#6B7280',
    fontSize: 12,
  },
  planCard: {
    backgroundColor: '#1E1B4B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#312E81',
  },
  planCardCurrent: {
    borderColor: '#6366F1',
    borderWidth: 2,
  },
  planCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  planCardName: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  planCardPrice: {
    color: '#A5B4FC',
    fontSize: 16,
    fontWeight: '700',
  },
  planCardCredits: {
    color: '#9CA3AF',
    fontSize: 13,
    marginBottom: 8,
  },
  featuresContainer: {
    marginBottom: 10,
  },
  featureText: {
    color: '#9CA3AF',
    fontSize: 12,
    lineHeight: 18,
  },
  currentPlanBadge: {
    backgroundColor: '#312E81',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  currentPlanText: {
    color: '#A5B4FC',
    fontSize: 14,
    fontWeight: '600',
  },
  choosePlanBtn: {
    backgroundColor: '#6366F1',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  choosePlanText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  packsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  packCard: {
    backgroundColor: '#1E1B4B',
    borderRadius: 12,
    padding: 14,
    width: '48%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#312E81',
  },
  packCredits: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
  },
  packCreditsLabel: {
    color: '#9CA3AF',
    fontSize: 12,
    marginBottom: 6,
  },
  packPrice: {
    color: '#A5B4FC',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  packBuyBtn: {
    backgroundColor: '#6366F1',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  packBuyText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1E1B4B',
  },
  historyDesc: {
    color: '#D1D5DB',
    fontSize: 14,
  },
  historyDate: {
    color: '#6B7280',
    fontSize: 11,
    marginTop: 2,
  },
  historyAmount: {
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 12,
  },
  historyPositive: {
    color: '#22C55E',
  },
  historyNegative: {
    color: '#EF4444',
  },
  portalBtn: {
    backgroundColor: '#312E81',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  portalBtnText: {
    color: '#A5B4FC',
    fontSize: 15,
    fontWeight: '600',
  },
  cancelBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '600',
  },
});
