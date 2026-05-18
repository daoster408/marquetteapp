import React, { useEffect, useState } from 'react';
import {
  GoogleSignin,
  isCancelledResponse,
  isErrorWithCode,
  isSuccessResponse,
} from '@react-native-google-signin/google-signin';
import { StyleSheet, View } from 'react-native';
import { Button, Card, HelperText, Text, TextInput } from 'react-native-paper';
import { useCycleStore } from '../store';
import { COLORS, STRINGS } from '../constants';
import { getGoogleAuthConfig } from '../services/cloudSync/firebase';

export default function AuthScreen() {
  const {
    cloudError,
    clearCloudError,
    googleSignInConfigured,
    signInWithEmail,
    signUpWithEmail,
  } = useCycleStore();
  const [isSignUp, setIsSignUp] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async () => {
    clearCloudError();
    setIsSubmitting(true);
    try {
      if (isSignUp) {
        await signUpWithEmail(email, password, displayName);
      } else {
        await signInWithEmail(email, password);
      }
    } catch {
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="headlineSmall" style={styles.title}>{STRINGS.appName}</Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            Sign in to use your shared family chart.
          </Text>

          {isSignUp && (
            <TextInput
              mode="outlined"
              label="Name"
              value={displayName}
              onChangeText={setDisplayName}
              style={styles.input}
              autoCapitalize="words"
            />
          )}

          <TextInput
            mode="outlined"
            label="Email"
            value={email}
            onChangeText={setEmail}
            style={styles.input}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            mode="outlined"
            label="Password"
            value={password}
            onChangeText={setPassword}
            style={styles.input}
            secureTextEntry
          />

          <Button
            mode="contained"
            onPress={submit}
            loading={isSubmitting}
            disabled={isSubmitting || !email.trim() || password.length < 6}
            style={styles.button}
          >
            {isSignUp ? 'Create Account' : 'Sign In'}
          </Button>

          <Button mode="text" onPress={() => setIsSignUp(!isSignUp)} style={styles.button}>
            {isSignUp ? 'Use Existing Account' : 'Create New Account'}
          </Button>

          {googleSignInConfigured ? (
            <GoogleSignInButton disabled={isSubmitting} />
          ) : (
            <>
              <Button mode="outlined" icon="google" disabled style={styles.button}>
                Continue with Google
              </Button>
              <HelperText type="info" visible>
                Google sign-in is waiting on Firebase OAuth client IDs.
              </HelperText>
            </>
          )}

          {!!cloudError && (
            <HelperText type="error" visible>
              {cloudError}
            </HelperText>
          )}
        </Card.Content>
      </Card>
    </View>
  );
}

function GoogleSignInButton({ disabled }: { disabled: boolean }) {
  const { clearCloudError, signInWithGoogle } = useCycleStore();
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const googleAuthConfig = getGoogleAuthConfig();

  useEffect(() => {
    GoogleSignin.configure({
      webClientId: googleAuthConfig.webClientId || undefined,
      scopes: ['profile', 'email'],
    });
  }, [googleAuthConfig.webClientId]);

  const submitGoogle = async () => {
    clearCloudError();
    setGoogleError(null);
    setIsGoogleSubmitting(true);
    try {
      await withTimeout(
        GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true }),
        'Google Play Services did not respond. Try again after reopening the app.'
      );
      await GoogleSignin.signOut().catch(() => undefined);

      const result = await withTimeout(
        GoogleSignin.signIn(),
        'Google account selection did not finish. Try again after reopening the app.'
      );
      if (isCancelledResponse(result)) {
        setIsGoogleSubmitting(false);
        return;
      }

      if (!isSuccessResponse(result)) {
        throw new Error('Google sign-in did not return an account.');
      }

      const tokens = await withTimeout(
        GoogleSignin.getTokens(),
        'Google tokens did not arrive. Try again after reopening the app.'
      );
      await withTimeout(
        signInWithGoogle({
          idToken: result.data.idToken || tokens.idToken,
          accessToken: tokens.accessToken,
        }),
        'Firebase sign-in did not finish. Try again after reopening the app.'
      );
    } catch (error) {
      setGoogleError(getGoogleErrorMessage(error));
    } finally {
      setIsGoogleSubmitting(false);
    }
  };

  return (
    <>
      <Button
        mode="outlined"
        icon="google"
        onPress={submitGoogle}
        loading={isGoogleSubmitting}
        disabled={disabled || isGoogleSubmitting}
        style={styles.button}
      >
        Continue with Google
      </Button>
      {!!googleError && (
        <HelperText type="error" visible>
          {googleError}
        </HelperText>
      )}
    </>
  );
}

function withTimeout<T>(promise: Promise<T>, message: string, timeoutMs = 20000): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeout) clearTimeout(timeout);
  });
}

function getGoogleErrorMessage(error: unknown): string {
  if (isErrorWithCode(error)) {
    if (error.code === 'DEVELOPER_ERROR') {
      return 'Google sign-in is not configured correctly for this build. Check the Play signing SHA and OAuth client.';
    }

    return `Google sign-in failed (${error.code}). Try again after reopening the app.`;
  }

  return error instanceof Error ? error.message : 'Google sign-in failed. Try again after reopening the app.';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: COLORS.background,
  },
  card: {
    borderRadius: 12,
  },
  title: {
    color: COLORS.primary,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  input: {
    marginBottom: 10,
  },
  button: {
    marginTop: 10,
  },
});
