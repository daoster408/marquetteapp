import React from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { Text, Card, Chip, Divider } from 'react-native-paper';
import { useCycleStore } from '../store';
import { calculateCycleStats } from '../utils/marquetteAlgorithm';
import { COLORS } from '../constants';
import { Cycle } from '../types';

interface Props {
  navigation: any;
}

export default function HistoryScreen({ navigation }: Props) {
  const { cycles, getCurrentCycle } = useCycleStore();
  const currentCycle = getCurrentCycle();

  const completedCycles = cycles.filter(c => c.isComplete);
  const stats = calculateCycleStats(completedCycles);

  const formatDate = (dateString: string): string => {
    if (!dateString) return '';
    // Parse YYYY-MM-DD manually to create a local date object
    // This avoids UTC conversions that shift the date back by 1 day
    const [year, month, day] = dateString.split('-').map(Number);
    const localDate = new Date(year, month - 1, day);
    
    return localDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const renderCycleItem = ({ item, index }: { item: Cycle; index: number }) => {
    const cycleNumber = completedCycles.length - index;
    const peakReading = item.days.find(d => d.reading === 'peak' && !d.isAutoPeak);

    return (
      <Card style={styles.cycleCard}>
        <Card.Content>
          <View style={styles.cycleHeader}>
            <Text variant="titleMedium">Cycle {cycleNumber}</Text>
            <Chip compact style={styles.lengthChip}>
              {item.cycleLength} days
            </Chip>
          </View>

          <Text variant="bodyMedium" style={styles.dateRange}>
            {formatDate(item.startDate)} - {item.endDate ? formatDate(item.endDate) : 'Ongoing'}
          </Text>

          <Divider style={styles.divider} />

          <View style={styles.cycleDetails}>
            <View style={styles.detailItem}>
              <Text variant="bodySmall" style={styles.detailLabel}>Peak Day</Text>
              <Text variant="bodyLarge" style={styles.detailValue}>
                {item.peakDay ? `CD ${item.peakDay}` : 'None'}
              </Text>
            </View>

            <View style={styles.detailItem}>
              <Text variant="bodySmall" style={styles.detailLabel}>Luteal Phase</Text>
              <Text variant="bodyLarge" style={styles.detailValue}>
                {item.lutealPhaseLength ? `${item.lutealPhaseLength}d` : '-'}
              </Text>
            </View>

            <View style={styles.detailItem}>
              <Text variant="bodySmall" style={styles.detailLabel}>Logs</Text>
              <Text variant="bodyLarge" style={styles.detailValue}>
                {item.days.length}
              </Text>
            </View>

            <View style={styles.detailItem}>
              <Text variant="bodySmall" style={styles.detailLabel}>High Days</Text>
              <Text variant="bodyLarge" style={styles.detailValue}>
                {item.days.filter(d => d.reading === 'high').length}
              </Text>
            </View>
          </View>
        </Card.Content>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      {/* Statistics Card */}
      {stats.totalCycles > 0 && (
        <Card style={styles.statsCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.statsTitle}>
              Your Statistics
            </Text>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text variant="headlineMedium" style={styles.statValue}>
                  {stats.totalCycles}
                </Text>
                <Text variant="bodySmall" style={styles.statLabel}>
                  Cycles Tracked
                </Text>
              </View>

              <View style={styles.statItem}>
                <Text variant="headlineMedium" style={styles.statValue}>
                  {stats.averageCycleLength}
                </Text>
                <Text variant="bodySmall" style={styles.statLabel}>
                  Avg Cycle Length
                </Text>
              </View>

              <View style={styles.statItem}>
                <Text variant="headlineMedium" style={styles.statValue}>
                  {stats.averagePeakDay || '-'}
                </Text>
                <Text variant="bodySmall" style={styles.statLabel}>
                  Avg Peak Day
                </Text>
              </View>

              <View style={styles.statItem}>
                <Text variant="headlineMedium" style={styles.statValue}>
                  {stats.averageLutealPhase || '-'}
                </Text>
                <Text variant="bodySmall" style={styles.statLabel}>
                  Avg Luteal Phase
                </Text>
              </View>

              <View style={styles.statItem}>
                <Text variant="headlineMedium" style={styles.statValue}>
                  {stats.earliestPeakInLast6 || '-'}
                </Text>
                <Text variant="bodySmall" style={styles.statLabel}>
                  Earliest Peak (6 cycles)
                </Text>
              </View>
            </View>

            {stats.totalCycles >= 6 && stats.earliestPeakInLast6 && (
              <View style={styles.fertilityStartInfo}>
                <Text variant="bodySmall" style={styles.fertilityStartLabel}>
                  Your calculated fertility start:
                </Text>
                <Text variant="bodyLarge" style={styles.fertilityStartValue}>
                  Cycle Day {Math.max(stats.earliestPeakInLast6 - 6, 6)}
                </Text>
              </View>
            )}
          </Card.Content>
        </Card>
      )}

      {/* Current Cycle Info */}
      {currentCycle && (
        <Card style={styles.currentCycleCard}>
          <Card.Content>
            <Text variant="titleMedium">Current Cycle</Text>
            <Text variant="bodyMedium">
              Started: {formatDate(currentCycle.startDate)}
            </Text>
            <Text variant="bodyMedium">
              Logs recorded: {currentCycle.days.length}
            </Text>
            {currentCycle.peakDay && (
              <Text variant="bodyMedium">
                Peak: CD {currentCycle.peakDay}
              </Text>
            )}
          </Card.Content>
        </Card>
      )}

      {/* Completed Cycles List */}
      <Text variant="titleMedium" style={styles.sectionTitle}>
        Completed Cycles
      </Text>

      {completedCycles.length === 0 ? (
        <View style={styles.emptyState}>
          <Text variant="bodyLarge" style={styles.emptyText}>
            No completed cycles yet.
          </Text>
          <Text variant="bodyMedium" style={styles.emptySubtext}>
            Your cycle history will appear here once you start a new cycle.
          </Text>
        </View>
      ) : (
        <FlatList
          data={[...completedCycles].reverse()}
          renderItem={renderCycleItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  statsCard: {
    margin: 16,
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
  },
  statsTitle: {
    color: '#FFF',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statItem: {
    width: '30%', // Changed from 48% to 30% to fit 3 items per row or handle wrapping better
    alignItems: 'center',
    marginBottom: 16,
  },
  statValue: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  statLabel: {
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },
  fertilityStartInfo: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  fertilityStartLabel: {
    color: 'rgba(255,255,255,0.9)',
  },
  fertilityStartValue: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  currentCycleCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    backgroundColor: COLORS.secondary,
  },
  sectionTitle: {
    marginHorizontal: 16,
    marginBottom: 8,
    color: COLORS.text,
  },
  listContent: {
    paddingBottom: 32,
  },
  cycleCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
  },
  cycleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  lengthChip: {
    backgroundColor: COLORS.primary,
  },
  dateRange: {
    color: COLORS.textSecondary,
  },
  divider: {
    marginVertical: 12,
  },
  cycleDetails: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  detailItem: {
    alignItems: 'center',
  },
  detailLabel: {
    color: COLORS.textSecondary,
  },
  detailValue: {
    color: COLORS.text,
    fontWeight: 'bold',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});
