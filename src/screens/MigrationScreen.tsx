import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, HelperText, Text } from 'react-native-paper';
import { useCycleStore } from '../store';
import { COLORS } from '../constants';

export default function MigrationScreen() {
  const {
    cloudError,
    cycles,
    dismissLocalMigration,
    pendingLocalMigration,
    uploadLocalDataToCloud,
  } = useCycleStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasCloudCycles = cycles.length > 0;
  const localCycleCount = pendingLocalMigration?.cycles.length || 0;

  const upload = async () => {
    setIsSubmitting(true);
    try {
      await uploadLocalDataToCloud();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="headlineSmall" style={styles.title}>Local Data Found</Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            {localCycleCount} local cycle(s) can be uploaded to this workspace.
          </Text>

          {hasCloudCycles ? (
            <Text variant="bodyMedium" style={styles.warning}>
              This workspace already has cloud data, so local data was not uploaded automatically.
            </Text>
          ) : (
            <Button
              mode="contained"
              icon="cloud-upload-outline"
              onPress={upload}
              loading={isSubmitting}
              disabled={isSubmitting}
              style={styles.button}
            >
              Upload Local Data
            </Button>
          )}

          <Button mode="outlined" onPress={dismissLocalMigration} style={styles.button}>
            Keep Cloud Workspace
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
  warning: {
    color: COLORS.warning,
    marginBottom: 12,
    textAlign: 'center',
  },
  button: {
    marginTop: 10,
  },
});
