import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { COLORS } from '../constants';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

export default class AppErrorBoundary extends React.Component<Props, State> {
  state: State = {
    error: null,
  };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <View style={styles.container}>
        <Text variant="headlineSmall" style={styles.title}>Fidelis Dogfood</Text>
        <Text variant="bodyMedium" style={styles.message}>
          The dogfood app hit a startup error. Please send this screen to the developer.
        </Text>
        <Text selectable variant="bodySmall" style={styles.errorText}>
          {this.state.error.message}
        </Text>
        <Button mode="contained" onPress={() => this.setState({ error: null })}>
          Try Again
        </Button>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: COLORS.background,
  },
  title: {
    color: COLORS.primary,
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    color: COLORS.textSecondary,
    marginBottom: 16,
    textAlign: 'center',
  },
  errorText: {
    padding: 12,
    marginBottom: 16,
    borderRadius: 8,
    color: COLORS.error,
    backgroundColor: COLORS.surface,
  },
});
