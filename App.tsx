import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Keyboard,
  PanResponder,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { LoginScreen } from './src/screens/LoginScreen';
import { ChatScreen } from './src/screens/ChatScreen';
import { NotificationsScreen } from './src/screens/NotificationsScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { UpgradeScreen } from './src/screens/UpgradeScreen';
import { MediaScreen } from './src/screens/MediaScreen';
import { Sidebar } from './src/components/Sidebar';
import { apiService } from './src/services/api';
import { notificationService } from './src/services/notifications';
import { Session } from './src/types';
import { colors, DRAWER_WIDTH } from './src/theme';

function AppContent() {
  const { user, isLoading, logout } = useAuth();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeScreen, setActiveScreen] = useState<'chat' | 'notifications' | 'profile' | 'dashboard' | 'upgrade' | 'media'>('chat');
  const drawerAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const drawerOpenRef = useRef(false);

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

  // Load most recent session on login
  useEffect(() => {
    if (!user?.token) return;
    (async () => {
      try {
        const sessions = await apiService.getSessions(user.token);
        if (sessions.length > 0) {
          setSessionId(sessions[0].id);
        } else {
          const result = await apiService.getOrCreateSession(user.token);
          setSessionId(result.sessionId);
        }
      } catch (err: any) {
        if (err?.message === 'TOKEN_EXPIRED') {
          Alert.alert('Session expirée', 'Veuillez vous reconnecter.', [
            { text: 'OK', onPress: logout },
          ]);
          return;
        }
        try {
          const result = await apiService.getOrCreateSession(user.token);
          setSessionId(result.sessionId);
        } catch (err2: any) {
          Alert.alert('Erreur', err2?.message || 'Impossible de charger les conversations', [
            { text: 'Réessayer', onPress: () => setSessionId(null) },
            { text: 'Se reconnecter', style: 'destructive', onPress: logout },
          ]);
        }
      }
    })();
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

  const handleNewChat = useCallback(async () => {
    if (!user?.token) return;
    try {
      const result = await apiService.getOrCreateSession(user.token);
      setSessionId(result.sessionId);
      closeDrawer();
    } catch (e) {
      console.error('Failed to create session', e);
    }
  }, [user?.token, closeDrawer]);

  if (isLoading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (!user) return <LoginScreen />;

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

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <AppContent />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
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
});
