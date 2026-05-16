import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, HelperText, Text, TextInput } from 'react-native-paper';
import { useCycleStore } from '../store';
import { COLORS } from '../constants';

export default function WorkspaceScreen() {
  const {
    cloudError,
    clearCloudError,
    cloudUser,
    createCloudWorkspace,
    joinWorkspaceWithInvite,
    signOutUser,
  } = useCycleStore();
  const [inviteCode, setInviteCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createWorkspace = async () => {
    clearCloudError();
    setIsSubmitting(true);
    try {
      await createCloudWorkspace();
    } catch {
    } finally {
      setIsSubmitting(false);
    }
  };

  const joinWorkspace = async () => {
    clearCloudError();
    setIsSubmitting(true);
    try {
      await joinWorkspaceWithInvite(inviteCode);
    } catch {
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="headlineSmall" style={styles.title}>Couple Workspace</Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            Signed in as {cloudUser?.email || cloudUser?.displayName || 'this account'}.
          </Text>

          <Button
            mode="contained"
            icon="account-heart"
            onPress={createWorkspace}
            loading={isSubmitting}
            disabled={isSubmitting}
            style={styles.button}
          >
            Create Workspace
          </Button>

          <Text variant="labelLarge" style={styles.dividerText}>or join with invite</Text>

          <TextInput
            mode="outlined"
            label="Invite Code"
            value={inviteCode}
            onChangeText={setInviteCode}
            autoCapitalize="characters"
            style={styles.input}
          />
          <Button
            mode="outlined"
            icon="login"
            onPress={joinWorkspace}
            loading={isSubmitting}
            disabled={isSubmitting || inviteCode.trim().length === 0}
            style={styles.button}
          >
            Join Workspace
          </Button>

          <Button mode="text" onPress={signOutUser} style={styles.button}>
            Sign Out
          </Button>

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
  dividerText: {
    color: COLORS.textSecondary,
    marginTop: 18,
    marginBottom: 8,
    textAlign: 'center',
  },
  input: {
    marginBottom: 8,
  },
  button: {
    marginTop: 10,
  },
});
