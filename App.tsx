import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Updates from 'expo-updates';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Keyboard,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { ThemeProvider, useColors } from './src/contexts/ThemeContext';
import { LoginScreen } from './src/screens/LoginScreen';
import { SignupScreen } from './src/screens/SignupScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { ChatScreen } from './src/screens/ChatScreen';
import { NotificationsScreen } from './src/screens/NotificationsScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { UpgradeScreen } from './src/screens/UpgradeScreen';
import { MediaScreen } from './src/screens/MediaScreen';
import { Sidebar } from './src/components/Sidebar';
import { useBiometric } from './src/hooks/useBiometric';
import { useDeepLink } from './src/hooks/useDeepLink';
import { apiService } from './src/services/api';
import { notificationService } from './src/services/notifications';
import { Session } from './src/types';
import { t } from './src/i18n';
import { ColorPalette, DRAWER_WIDTH } from './src/theme';

const ONBOARDING_DONE_KEY = 'fc_onboarding_done';

function AppContent() {
  const { user, isLoading, logout } = useAuth();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeScreen, setActiveScreen] = useState<'chat' | 'notifications' | 'profile' | 'dashboard' | 'upgrade' | 'media'>('chat');
  const [authScreen, setAuthScreen] = useState<'login' | 'signup'>('login');
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);
  const [biometricLocked, setBiometricLocked] = useState(false);
  const { isEnabled: biometricEnabled, authenticate } = useBiometric();
  const drawerAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const drawerOpenRef = useRef(false);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Check onboarding status
  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_DONE_KEY).then((v) => {
      setShowOnboarding(v !== 'true');
    });
  }, []);

  // Biometric lock on app start
  useEffect(() => {
    if (user && biometricEnabled) {
      setBiometricLocked(true);
      authenticate().then((ok) => {
        if (ok) setBiometricLocked(false);
      });
    }
  }, [user?.id]); // only on initial mount per user

  // Init push notifications
  const pushTokenRef = useRef<string | null>(null);
  useEffect(() => {
    if (!user?.token) return;
    notificationService.init(user.token).then((t) => {
      pushTokenRef.current = t;
    });
    notificationService.setOnNotificationTap((sid) => {
      setSessionId(sid);
      setActiveScreen('chat');
    });
    const sub = notificationService.addTapListener();
    return () => sub.remove();
  }, [user?.token]);

  // Deep linking — flowcontent://chat/123, flowcontent://dashboard, etc.
  const handleDeepLink = useCallback((screen: typeof activeScreen, sid?: string) => {
    setActiveScreen(screen);
    if (sid) setSessionId(sid);
  }, []);
  useDeepLink(handleDeepLink);

  // OTA update check
  useEffect(() => {
    if (__DEV__) return;
    (async () => {
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          await Updates.fetchUpdateAsync();
          Alert.alert(
            t('updateAvailable'),
            t('updateMessage'),
            [
              { text: t('later'), style: 'cancel' },
              { text: t('restart'), onPress: () => Updates.reloadAsync() },
            ],
          );
        }
      } catch {}
    })();
  }, []);

  // Load most recent session on login
  useEffect(() => {
    if (!user?.token) return;
    let cancelled = false;
    (async () => {
      try {
        const sessions = await apiService.getSessions(user.token);
        if (cancelled) return;
        if (sessions.length > 0) {
          setSessionId(sessions[0].id);
        } else {
          const result = await apiService.getOrCreateSession(user.token);
          if (cancelled) return;
          setSessionId(result.sessionId);
        }
      } catch (err: any) {
        if (cancelled) return;
        if (err?.message === 'TOKEN_EXPIRED') {
          Alert.alert(t('sessionExpired'), t('sessionExpiredMessage'), [
            { text: t('ok'), onPress: logout },
          ]);
          return;
        }
        try {
          const result = await apiService.getOrCreateSession(user.token);
          if (cancelled) return;
          setSessionId(result.sessionId);
        } catch (err2: any) {
          if (cancelled) return;
          Alert.alert(t('error'), err2?.message || 'Impossible de charger les conversations', [
            { text: t('retry'), onPress: () => setSessionId(null) },
            { text: t('reconnect'), style: 'destructive', onPress: logout },
          ]);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [user?.token, logout]);

  const openDrawer = useCallback(() => {
    Keyboard.dismiss();
    setDrawerOpen(true);
    drawerOpenRef.current = true;
    Animated.parallel([
      Animated.timing(drawerAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(overlayAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  }, [drawerAnim, overlayAnim]);

  const closeDrawer = useCallback(() => {
    Animated.parallel([
      Animated.timing(drawerAnim, {
        toValue: -DRAWER_WIDTH,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(overlayAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setDrawerOpen(false);
      drawerOpenRef.current = false;
    });
  }, [drawerAnim, overlayAnim]);

  // Edge pan gesture to open drawer by swiping from left edge
  const edgePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponderCapture: (evt, gs) => {
        if (drawerOpenRef.current) return false;
        const startX = evt.nativeEvent.pageX - gs.dx;
        return startX < 30 && gs.dx > 15 && gs.dx > Math.abs(gs.dy) * 2;
      },
      onPanResponderGrant: () => {
        Keyboard.dismiss();
      },
      onPanResponderMove: (_, gs) => {
        if (gs.dx >= 0) {
          const dx = Math.min(gs.dx, DRAWER_WIDTH);
          drawerAnim.setValue(-DRAWER_WIDTH + dx);
          overlayAnim.setValue(dx / DRAWER_WIDTH);
        }
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx > DRAWER_WIDTH / 3 || gs.vx > 0.5) {
          setDrawerOpen(true);
          drawerOpenRef.current = true;
          Animated.parallel([
            Animated.timing(drawerAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
            Animated.timing(overlayAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
          ]).start();
        } else {
          Animated.parallel([
            Animated.timing(drawerAnim, { toValue: -DRAWER_WIDTH, duration: 200, useNativeDriver: true }),
            Animated.timing(overlayAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
          ]).start();
        }
      },
    })
  ).current;

  const handleSelectSession = useCallback(
    (session: Session) => {
      setSessionId(session.id);
      closeDrawer();
    },
    [closeDrawer]
  );

  const creatingSessionRef = useRef(false);
  const handleNewChat = useCallback(async () => {
    if (!user?.token || creatingSessionRef.current) return;
    creatingSessionRef.current = true;
    try {
      const result = await apiService.getOrCreateSession(user.token);
      setSessionId(result.sessionId);
      closeDrawer();
    } catch (e) {
      console.error('Failed to create session', e);
    } finally {
      creatingSessionRef.current = false;
    }
  }, [user?.token, closeDrawer]);

  if (isLoading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  // Onboarding — first time only
  if (showOnboarding === true && !user) {
    return (
      <OnboardingScreen onComplete={() => {
        AsyncStorage.setItem(ONBOARDING_DONE_KEY, 'true');
        setShowOnboarding(false);
      }} />
    );
  }

  if (!user) {
    return authScreen === 'signup'
      ? <SignupScreen onSwitchToLogin={() => setAuthScreen('login')} />
      : <LoginScreen onSwitchToSignup={() => setAuthScreen('signup')} />;
  }

  // Biometric lock screen
  if (biometricLocked) {
    return (
      <View style={styles.lockScreen}>
        <View style={styles.lockContent}>
          <Ionicons name="lock-closed" size={48} color={colors.accent} />
          <Text style={styles.lockTitle}>FlowContent</Text>
          <Text style={styles.lockSubtitle}>{t('authRequired')}</Text>
          <TouchableOpacity style={styles.lockBtn} onPress={() => authenticate().then((ok) => { if (ok) setBiometricLocked(false); })} activeOpacity={0.7}>
            <Ionicons name="finger-print" size={24} color={colors.white} />
            <Text style={styles.lockBtnText}>{t('unlock')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setBiometricLocked(false)} activeOpacity={0.7} style={styles.skipBiometric}>
            <Text style={styles.skipBiometricText}>{t('continueWithout')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container} {...edgePanResponder.panHandlers}>
      {/* Main content */}
      {activeScreen === 'notifications' ? (
        <NotificationsScreen onBack={() => setActiveScreen('chat')} />
      ) : activeScreen === 'profile' ? (
        <ProfileScreen onBack={() => setActiveScreen('chat')} />
      ) : activeScreen === 'dashboard' ? (
        <DashboardScreen onBack={() => setActiveScreen('chat')} />
      ) : activeScreen === 'upgrade' ? (
        <UpgradeScreen onBack={() => setActiveScreen('chat')} />
      ) : activeScreen === 'media' ? (
        <MediaScreen onBack={() => setActiveScreen('chat')} />
      ) : (
        <ChatScreen
          key={sessionId}
          sessionId={sessionId}
          onOpenDrawer={openDrawer}
        />
      )}

      {/* Overlay */}
      {drawerOpen && (
        <TouchableWithoutFeedback onPress={closeDrawer}>
          <Animated.View style={[styles.overlay, { opacity: overlayAnim }]} />
        </TouchableWithoutFeedback>
      )}

      {/* Drawer */}
      <Animated.View
        style={[
          styles.drawer,
          { transform: [{ translateX: drawerAnim }] },
        ]}
      >
        <Sidebar
          activeSessionId={sessionId}
          onSelectSession={handleSelectSession}
          onNewChat={handleNewChat}
          onClose={closeDrawer}
          onOpenNotifications={() => { closeDrawer(); setActiveScreen('notifications'); }}
          onOpenProfile={() => { closeDrawer(); setActiveScreen('profile'); }}
          onOpenDashboard={() => { closeDrawer(); setActiveScreen('dashboard'); }}
          onOpenUpgrade={() => { closeDrawer(); setActiveScreen('upgrade'); }}
          onOpenMedia={() => { closeDrawer(); setActiveScreen('media'); }}
        />
      </Animated.View>
    </View>
  );
}

function App() {
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <ThemeProvider>
          <AuthProvider>
            <StatusBar style="light" />
            <AppContent />
          </AuthProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

export default App;

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
    zIndex: 10,
  },
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: DRAWER_WIDTH,
    zIndex: 20,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.border,
  },
  lockScreen: {
    flex: 1,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockContent: {
    alignItems: 'center',
    gap: 16,
  },
  lockTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
  },
  lockSubtitle: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  lockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.accent,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 16,
  },
  lockBtnText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  skipBiometric: {
    marginTop: 8,
    paddingVertical: 10,
  },
  skipBiometricText: {
    color: colors.textTertiary,
    fontSize: 14,
  },
});
