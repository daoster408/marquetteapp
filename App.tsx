import React, { useCallback, useEffect, useState } from 'react';
import { AppState, View, ActivityIndicator, StyleSheet } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Button, PaperProvider, MD3LightTheme, Text } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import AppErrorBoundary from './src/components/AppErrorBoundary';
import {
  AuthScreen,
  DashboardScreen,
  LogScreen,
  CalendarScreen,
  HistoryScreen,
  MigrationScreen,
  SettingsScreen,
  WorkspaceScreen,
} from './src/screens';
import { COLORS, STRINGS } from './src/constants';
import { useCycleStore } from './src/store';

// Custom theme
const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: COLORS.primary,
    secondary: COLORS.secondary,
    background: COLORS.background,
    surface: COLORS.surface,
  },
};

// Navigation types
export type RootStackParamList = {
  Main: undefined;
  Log: undefined;
};

export type TabParamList = {
  Dashboard: undefined;
  Calendar: undefined;
  History: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

// Loading Screen
function LoadingScreen() {
  return (
    <View style={styles.loadingContainer}>
      <Text variant="headlineMedium" style={styles.loadingTitle}>
        {STRINGS.appName}
      </Text>
      <ActivityIndicator size="large" color={COLORS.primary} style={styles.spinner} />
      <Text variant="bodyMedium" style={styles.loadingText}>
        Loading...
      </Text>
    </View>
  );
}

function AppLockScreen({
  error,
  isUnlocking,
  onUnlock,
}: {
  error: string | null;
  isUnlocking: boolean;
  onUnlock: () => void;
}) {
  return (
    <View style={styles.loadingContainer}>
      <MaterialCommunityIcons name="lock" size={44} color={COLORS.primary} />
      <Text variant="headlineSmall" style={styles.loadingTitle}>
        Unlock Fidelis
      </Text>
      <Text variant="bodyMedium" style={styles.loadingText}>
        Use your device lock to open your family chart.
      </Text>
      <Button
        mode="contained"
        onPress={onUnlock}
        loading={isUnlocking}
        disabled={isUnlocking}
        style={styles.unlockButton}
      >
        Unlock
      </Button>
      {!!error && (
        <Text variant="bodySmall" style={styles.lockError}>
          {error}
        </Text>
      )}
    </View>
  );
}

// Tab Navigator
function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
        },
        headerStyle: {
          backgroundColor: COLORS.primary,
        },
        headerTintColor: '#FFF',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          title: 'Today',
          tabBarLabel: 'Today',
          headerTitle: STRINGS.appName,
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="home-heart" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Calendar"
        component={CalendarScreen}
        options={{
          title: 'Calendar',
          tabBarLabel: 'Calendar',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="calendar-month" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          title: 'History',
          tabBarLabel: 'History',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="chart-timeline-variant" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Settings',
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="cog" color={color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

// Main App
export default function App() {
  const [isReady, setIsReady] = useState(false);
  const {
    activeCoupleId,
    cloudMode,
    initializeCloudSync,
    pendingLocalMigration,
    settings,
  } = useCycleStore();
  const [isAppUnlocked, setIsAppUnlocked] = useState(false);
  const [isAppUnlocking, setIsAppUnlocking] = useState(false);
  const [appLockError, setAppLockError] = useState<string | null>(null);

  useEffect(() => {
    // Give the store time to hydrate from AsyncStorage
    const timer = setTimeout(() => {
      initializeCloudSync();
      setIsReady(true);
    }, 500);

    return () => clearTimeout(timer);
  }, [initializeCloudSync]);

  useEffect(() => {
    if (!settings.appLockEnabled) {
      setIsAppUnlocked(true);
      setAppLockError(null);
    } else {
      setIsAppUnlocked(false);
    }
  }, [settings.appLockEnabled]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', status => {
      if (settings.appLockEnabled && status !== 'active') {
        setIsAppUnlocked(false);
      }
    });

    return () => subscription.remove();
  }, [settings.appLockEnabled]);

  const unlockApp = useCallback(async () => {
    if (isAppUnlocking) return;

    setIsAppUnlocking(true);
    setAppLockError(null);
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Fidelis',
        cancelLabel: 'Cancel',
        fallbackLabel: 'Use device passcode',
        disableDeviceFallback: false,
      });

      if (result.success) {
        setIsAppUnlocked(true);
        return;
      }

      setAppLockError('Fidelis is locked until your device verifies it is you.');
    } catch {
      setAppLockError('Device unlock is not available right now.');
    } finally {
      setIsAppUnlocking(false);
    }
  }, [isAppUnlocking]);

  if (!isReady) {
    return (
      <SafeAreaProvider>
        <PaperProvider theme={theme}>
          <LoadingScreen />
          <StatusBar style="dark" />
        </PaperProvider>
      </SafeAreaProvider>
    );
  }

  const shouldShowMigration = cloudMode === 'ready' &&
    activeCoupleId &&
    pendingLocalMigration &&
    pendingLocalMigration.cycles.length > 0;
  const shouldShowAppLock = Boolean(settings.appLockEnabled) &&
    !isAppUnlocked &&
    (cloudMode === 'local' || cloudMode === 'ready' || cloudMode === 'error');

  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <AppErrorBoundary>
          {shouldShowAppLock && (
            <AppLockScreen
              error={appLockError}
              isUnlocking={isAppUnlocking}
              onUnlock={unlockApp}
            />
          )}
          {cloudMode === 'signed-out' && <AuthScreen />}
          {!shouldShowAppLock && cloudMode === 'workspace-required' && <WorkspaceScreen />}
          {!shouldShowAppLock && (cloudMode === 'restoring-auth' || cloudMode === 'syncing') && <LoadingScreen />}
          {!shouldShowAppLock && shouldShowMigration && <MigrationScreen />}
          {!shouldShowAppLock && (cloudMode === 'local' || (cloudMode === 'ready' && !shouldShowMigration) || cloudMode === 'error') && (
            <NavigationContainer>
              <Stack.Navigator
                screenOptions={{
                  headerStyle: {
                    backgroundColor: COLORS.primary,
                  },
                  headerTintColor: '#FFF',
                  headerTitleStyle: {
                    fontWeight: 'bold',
                  },
                }}
              >
                <Stack.Screen
                  name="Main"
                  component={TabNavigator}
                  options={{ headerShown: false }}
                />
                <Stack.Screen
                  name="Log"
                  component={LogScreen}
                  options={{
                    title: 'Log Reading',
                    presentation: 'modal',
                  }}
                />
              </Stack.Navigator>
            </NavigationContainer>
          )}
          <StatusBar style="light" />
        </AppErrorBoundary>
      </PaperProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingTitle: {
    color: COLORS.primary,
    marginBottom: 24,
  },
  spinner: {
    marginBottom: 16,
  },
  loadingText: {
    color: COLORS.textSecondary,
  },
  unlockButton: {
    marginTop: 18,
  },
  lockError: {
    color: COLORS.warning,
    marginTop: 12,
    paddingHorizontal: 28,
    textAlign: 'center',
  },
});
