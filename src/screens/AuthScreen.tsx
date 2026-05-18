import React, { useEffect, useState } from 'react';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { StyleSheet, View } from 'react-native';
import { Button, Card, HelperText, Text, TextInput } from 'react-native-paper';
import { useCycleStore } from '../store';
import { COLORS, STRINGS } from '../constants';
import { getGoogleAuthConfig } from '../services/cloudSync/firebase';

WebBrowser.maybeCompleteAuthSession();

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
            <GoogleSignInButton disabled={isSubmitting} loginHint={email.trim()} />
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

function GoogleSignInButton({
  disabled,
  loginHint,
}: {
  disabled: boolean;
  loginHint?: string;
}) {
  const { clearCloudError, signInWithGoogle } = useCycleStore();
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const googleAuthConfig = getGoogleAuthConfig();
  const [googleRequest, googleResponse, promptGoogleSignIn] = Google.useIdTokenAuthRequest({
    androidClientId: googleAuthConfig.androidClientId || undefined,
    webClientId: googleAuthConfig.webClientId || undefined,
    loginHint: loginHint || undefined,
    selectAccount: true,
  });

  useEffect(() => {
    if (!googleResponse) return;

    if (googleResponse.type !== 'success') {
      setIsGoogleSubmitting(false);
      return;
    }

    const completeGoogleSignIn = async () => {
      try {
        await signInWithGoogle({
          idToken: googleResponse.params.id_token,
          accessToken: googleResponse.params.access_token,
        });
      } catch {
      } finally {
        setIsGoogleSubmitting(false);
      }
    };

    completeGoogleSignIn();
  }, [googleResponse, signInWithGoogle]);

  const submitGoogle = async () => {
    clearCloudError();
    setIsGoogleSubmitting(true);
    try {
      const result = await promptGoogleSignIn();
      if (result.type !== 'success') {
        setIsGoogleSubmitting(false);
      }
    } catch {
      setIsGoogleSubmitting(false);
    }
  };

  return (
    <Button
      mode="outlined"
      icon="google"
      onPress={submitGoogle}
      loading={isGoogleSubmitting}
      disabled={disabled || !googleRequest || isGoogleSubmitting}
      style={styles.button}
    >
      Continue with Google
    </Button>
  );
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
