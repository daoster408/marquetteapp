import React, { useState } from 'react';
import { Alert, View, StyleSheet, FlatList, ScrollView } from 'react-native';
import { Text, Card, Chip, Divider, Button, SegmentedButtons } from 'react-native-paper';
import { useCycleStore } from '../store';
import { calculateCycleStats, getCycleDay, getTodayISO } from '../utils/marquetteAlgorithm';
import { exportMarquetteChartPdf } from '../utils/exportChartPdf';
import { COLORS } from '../constants';
import { Cycle, DayLog } from '../types';
import AddPastCycleModal from '../components/AddPastCycleModal'; // Import the new modal component

interface Props {
  navigation: any;
}

type HistoryView = 'summary' | 'trends' | 'chart';

const CHART_DAYS = 35;

export default function HistoryScreen({ navigation }: Props) {
  const { cycles, getCurrentCycle, deleteCompletedCycle } = useCycleStore();
  const currentCycle = getCurrentCycle();

  const completedCycles = cycles.filter(c => c.isComplete);
  const chronologicalCompletedCycles = [...completedCycles].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const recentCycles = chronologicalCompletedCycles.slice(-6);
  const stats = calculateCycleStats(completedCycles);

  const [showAddPastCycleModal, setShowAddPastCycleModal] = useState(false);
  const [selectedView, setSelectedView] = useState<HistoryView>('summary');

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

  const formatShortDate = (dateString: string): string => {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-').map(Number);
    const localDate = new Date(year, month - 1, day);

    return localDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const getCycleNumber = (cycle: Cycle): number => {
    const index = chronologicalCompletedCycles.findIndex(c => c.id === cycle.id);
    return index >= 0 ? index + 1 : 0;
  };

  const getCurrentCycleDay = (): number | null => {
    if (!currentCycle) return null;
    return getCycleDay(currentCycle, getTodayISO());
  };

  const getTrendDirection = (values: number[]): string => {
    if (values.length < 4) return 'Building history';

    const midpoint = Math.floor(values.length / 2);
    const earlyValues = values.slice(0, midpoint);
    const recentValues = values.slice(midpoint);
    const average = (items: number[]) => items.reduce((sum, value) => sum + value, 0) / items.length;
    const delta = average(recentValues) - average(earlyValues);

    if (Math.abs(delta) < 1) return 'Stable';
    return delta > 0 ? 'Trending later' : 'Trending earlier';
  };

  const getReadingColor = (log: DayLog | undefined, cycleDay: number): string => {
    if (log?.reading === 'peak') return COLORS.readingPeak;
    if (log?.reading === 'high') return COLORS.readingHigh;
    if (log?.reading === 'low') return COLORS.readingLow;
    if (cycleDay <= 5) return COLORS.period;
    return COLORS.surface;
  };

  const getChartLabel = (cycle: Cycle, cycleDay: number, log: DayLog | undefined): string => {
    if (cycle.peakDay && cycleDay === cycle.peakDay) return 'P';
    if (cycle.peakDay && cycleDay === cycle.peakDay + 1) return 'P2';
    if (cycle.peakDay && cycleDay >= cycle.peakDay + 2 && cycleDay <= cycle.peakDay + 4) {
      return String(cycleDay - cycle.peakDay - 1);
    }
    if (log?.reading === 'high') return 'H';
    if (log?.reading === 'low') return 'L';
    if (log?.reading === 'peak') return log.isAutoPeak ? 'P2' : 'P';
    if (log?.bleeding && log.bleeding !== 'none') return 'B';
    return '';
  };

  const renderViewSwitcher = () => (
    <View style={styles.viewSwitcher}>
      <SegmentedButtons
        value={selectedView}
        onValueChange={(value) => setSelectedView(value as HistoryView)}
        buttons={[
          { value: 'summary', label: 'Summary', icon: 'format-list-bulleted' },
          { value: 'trends', label: 'Trends', icon: 'chart-line' },
          { value: 'chart', label: 'Chart', icon: 'table-large' },
        ]}
      />
    </View>
  );

  const renderCycleItem = ({ item, index }: { item: Cycle; index: number }) => {
    const cycleNumber = completedCycles.length - index;

    const confirmDeleteCycle = () => {
      const dateRange = `${formatDate(item.startDate)} - ${item.endDate ? formatDate(item.endDate) : 'Ongoing'}`;

      Alert.alert(
        'Delete Cycle?',
        `This will permanently delete Cycle ${cycleNumber} (${dateRange}) and ${item.days.length} log(s). Export a backup first if you may need this later.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => deleteCompletedCycle(item.id),
          },
        ]
      );
    };

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
        <Card.Actions>
          <Button
            mode="text"
            icon="trash-can-outline"
            textColor={COLORS.warning}
            onPress={confirmDeleteCycle}
          >
            Delete Cycle
          </Button>
        </Card.Actions>
      </Card>
    );
  };

  const renderTrendRows = (
    title: string,
    valueLabel: string,
    values: Array<{ cycle: Cycle; value: number | null }>,
    color: string,
    suffix: string = ''
  ) => {
    const numericValues = values
      .map(item => item.value)
      .filter((value): value is number => typeof value === 'number');
    const min = numericValues.length > 0 ? Math.min(...numericValues) : 0;
    const max = numericValues.length > 0 ? Math.max(...numericValues) : 0;

    return (
      <Card style={styles.insightCard}>
        <Card.Content>
          <View style={styles.insightHeader}>
            <Text variant="titleMedium" style={styles.insightTitle}>{title}</Text>
            <Chip compact style={styles.trendChip}>{getTrendDirection(numericValues)}</Chip>
          </View>

          {values.map(({ cycle, value }) => {
            const range = Math.max(max - min, 1);
            const widthPercent = value === null ? 0 : 28 + ((value - min) / range) * 62;

            return (
              <View key={cycle.id} style={styles.trendRow}>
                <Text style={styles.trendCycleLabel}>C{getCycleNumber(cycle)}</Text>
                <View style={styles.trendTrack}>
                  {value !== null && (
                    <View
                      style={[
                        styles.trendFill,
                        { width: `${widthPercent}%`, backgroundColor: color },
                      ]}
                    />
                  )}
                </View>
                <Text style={styles.trendValue}>
                  {value === null ? '-' : `${value}${suffix}`}
                </Text>
              </View>
            );
          })}

          <Text variant="bodySmall" style={styles.trendCaption}>{valueLabel}</Text>
        </Card.Content>
      </Card>
    );
  };

  const renderTrendsView = () => {
    const currentCycleDay = getCurrentCycleDay();
    const cycleLengthValues = recentCycles.map(cycle => ({
      cycle,
      value: cycle.cycleLength || null,
    }));
    const peakDayValues = recentCycles.map(cycle => ({
      cycle,
      value: cycle.peakDay || null,
    }));
    const lutealValues = recentCycles.map(cycle => ({
      cycle,
      value: cycle.lutealPhaseLength || null,
    }));
    const recentLengths = cycleLengthValues
      .map(item => item.value)
      .filter((value): value is number => value !== null);
    const recentPeakDays = peakDayValues
      .map(item => item.value)
      .filter((value): value is number => value !== null);
    const shortestRecent = recentLengths.length > 0 ? Math.min(...recentLengths) : null;
    const longestRecent = recentLengths.length > 0 ? Math.max(...recentLengths) : null;
    const earliestRecentPeak = recentPeakDays.length > 0 ? Math.min(...recentPeakDays) : null;
    const latestRecentPeak = recentPeakDays.length > 0 ? Math.max(...recentPeakDays) : null;
    const typicalPeakDistance = currentCycleDay && stats.averagePeakDay
      ? stats.averagePeakDay - currentCycleDay
      : null;

    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {renderViewSwitcher()}

        <Card style={styles.patternCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.patternTitle}>Recent Pattern</Text>
            <View style={styles.patternGrid}>
              <View style={styles.patternItem}>
                <Text style={styles.patternValue}>{shortestRecent ?? '-'}</Text>
                <Text style={styles.patternLabel}>Shortest</Text>
              </View>
              <View style={styles.patternItem}>
                <Text style={styles.patternValue}>{longestRecent ?? '-'}</Text>
                <Text style={styles.patternLabel}>Longest</Text>
              </View>
              <View style={styles.patternItem}>
                <Text style={styles.patternValue}>{earliestRecentPeak ?? '-'}</Text>
                <Text style={styles.patternLabel}>Earliest Peak</Text>
              </View>
              <View style={styles.patternItem}>
                <Text style={styles.patternValue}>{latestRecentPeak ?? '-'}</Text>
                <Text style={styles.patternLabel}>Latest Peak</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {currentCycle && (
          <Card style={styles.comparisonCard}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.comparisonTitle}>Current vs Usual</Text>
              <View style={styles.comparisonRow}>
                <Text style={styles.comparisonLabel}>Today</Text>
                <Text style={styles.comparisonValue}>CD{currentCycleDay ?? '-'}</Text>
              </View>
              <View style={styles.comparisonRow}>
                <Text style={styles.comparisonLabel}>Average Peak</Text>
                <Text style={styles.comparisonValue}>CD{stats.averagePeakDay || '-'}</Text>
              </View>
              <View style={styles.comparisonRow}>
                <Text style={styles.comparisonLabel}>Earliest Peak in 6</Text>
                <Text style={styles.comparisonValue}>CD{stats.earliestPeakInLast6 || '-'}</Text>
              </View>
              <View style={styles.comparisonHighlight}>
                <Text style={styles.comparisonHighlightText}>
                  {typicalPeakDistance === null
                    ? 'Pattern still forming'
                    : typicalPeakDistance > 0
                    ? `${typicalPeakDistance} day(s) before average Peak`
                    : typicalPeakDistance === 0
                    ? 'At average Peak day'
                    : `${Math.abs(typicalPeakDistance)} day(s) after average Peak`}
                </Text>
              </View>
            </Card.Content>
          </Card>
        )}

        {renderTrendRows('Cycle Length', 'Recent completed cycles', cycleLengthValues, COLORS.primary, 'd')}
        {renderTrendRows('Peak Day', 'First Peak day by cycle', peakDayValues, COLORS.fertile)}
        {renderTrendRows('Luteal Phase', 'Days from Peak to cycle end', lutealValues, COLORS.secondary, 'd')}
      </ScrollView>
    );
  };

  const renderChartCell = (cycle: Cycle, cycleDay: number) => {
    const log = cycle.days.find(day => day.cycleDay === cycleDay);
    const label = getChartLabel(cycle, cycleDay, log);

    return (
      <View
        key={`${cycle.id}-${cycleDay}`}
        style={[
          styles.chartCell,
          { backgroundColor: getReadingColor(log, cycleDay) },
          cycle.peakDay === cycleDay && styles.peakCell,
        ]}
      >
        <Text style={styles.chartCellText}>{label}</Text>
        {log?.intercourse && <Text style={styles.chartHeart}>♥</Text>}
      </View>
    );
  };

  const renderChartView = () => {
    const chartCycles = chronologicalCompletedCycles.slice(-8);

    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {renderViewSwitcher()}

        <Card style={styles.chartCard}>
          <Card.Content>
            <View style={styles.chartHeaderTextRow}>
              <Text variant="titleMedium" style={styles.chartTitle}>Cycle Chart</Text>
              <Chip compact style={styles.chartChip}>Last {chartCycles.length || 0}</Chip>
            </View>

            <Button
              mode="contained"
              icon="file-pdf-box"
              onPress={() => exportMarquetteChartPdf(cycles)}
              style={styles.pdfExportButton}
            >
              Export PDF
            </Button>

            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View>
                <View style={styles.chartRow}>
                  <View style={styles.chartCycleLabelHeader} />
                  {Array.from({ length: CHART_DAYS }, (_, index) => (
                    <View key={`header-${index}`} style={styles.chartDayHeader}>
                      <Text style={styles.chartDayHeaderText}>{index + 1}</Text>
                    </View>
                  ))}
                </View>

                {chartCycles.map(cycle => (
                  <View key={cycle.id} style={styles.chartRow}>
                    <View style={styles.chartCycleLabel}>
                      <Text style={styles.chartCycleName}>C{getCycleNumber(cycle)}</Text>
                      <Text style={styles.chartCycleDate}>{formatShortDate(cycle.startDate)}</Text>
                    </View>
                    {Array.from({ length: CHART_DAYS }, (_, index) => renderChartCell(cycle, index + 1))}
                  </View>
                ))}
              </View>
            </ScrollView>

            {chartCycles.length === 0 && (
              <View style={styles.emptyStateCompact}>
                <Text style={styles.emptyText}>No completed cycles yet.</Text>
              </View>
            )}
          </Card.Content>
        </Card>

        <Card style={styles.legendCard}>
          <Card.Content>
            <View style={styles.legendGrid}>
              <View style={styles.legendItem}>
                <View style={[styles.legendSwatch, { backgroundColor: COLORS.period }]} />
                <Text style={styles.legendText}>Period</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendSwatch, { backgroundColor: COLORS.readingLow }]} />
                <Text style={styles.legendText}>Low</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendSwatch, { backgroundColor: COLORS.readingHigh }]} />
                <Text style={styles.legendText}>High</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendSwatch, { backgroundColor: COLORS.readingPeak }]} />
                <Text style={styles.legendText}>Peak</Text>
              </View>
            </View>
          </Card.Content>
        </Card>
      </ScrollView>
    );
  };

  const renderHeader = () => (
    <View>
      {renderViewSwitcher()}

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

      <Text variant="titleMedium" style={styles.sectionTitle}>
        Completed Cycles
      </Text>

      <Card style={styles.addPastCycleCard}>
        <Card.Content>
          <Button 
            mode="contained"
            onPress={() => setShowAddPastCycleModal(true)}
            icon="plus-circle-outline"
            style={styles.addPastCycleButton}
          >
            Add Past Cycle
          </Button>
        </Card.Content>
      </Card>
    </View>
  );

  if (selectedView === 'trends') {
    return renderTrendsView();
  }

  if (selectedView === 'chart') {
    return renderChartView();
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={[...completedCycles].reverse()}
        renderItem={renderCycleItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text variant="bodyLarge" style={styles.emptyText}>
              No completed cycles yet.
            </Text>
            <Text variant="bodyMedium" style={styles.emptySubtext}>
              Your cycle history will appear here once you start a new cycle.
            </Text>
          </View>
        }
      />

      {/* Add Past Cycle Modal */}
      <AddPastCycleModal
        visible={showAddPastCycleModal}
        onDismiss={() => setShowAddPastCycleModal(false)}
      />
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
  addPastCycleCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
  },
  addPastCycleButton: {
    marginVertical: 4,
  },
  viewSwitcher: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  insightCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
  },
  insightHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  insightTitle: {
    color: COLORS.text,
    fontWeight: 'bold',
  },
  trendChip: {
    backgroundColor: COLORS.background,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  trendCycleLabel: {
    width: 34,
    color: COLORS.textSecondary,
    fontWeight: 'bold',
  },
  trendTrack: {
    flex: 1,
    height: 14,
    borderRadius: 7,
    overflow: 'hidden',
    backgroundColor: COLORS.background,
  },
  trendFill: {
    height: '100%',
    borderRadius: 7,
  },
  trendValue: {
    width: 48,
    marginLeft: 10,
    textAlign: 'right',
    color: COLORS.text,
    fontWeight: 'bold',
  },
  trendCaption: {
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  patternCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
  },
  patternTitle: {
    color: '#FFF',
    marginBottom: 12,
    fontWeight: 'bold',
  },
  patternGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  patternItem: {
    width: '48%',
    marginBottom: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  patternValue: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: 'bold',
  },
  patternLabel: {
    color: 'rgba(255,255,255,0.86)',
    marginTop: 2,
  },
  comparisonCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: COLORS.secondary,
  },
  comparisonTitle: {
    color: '#FFF',
    marginBottom: 12,
    fontWeight: 'bold',
  },
  comparisonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  comparisonLabel: {
    color: 'rgba(255,255,255,0.88)',
  },
  comparisonValue: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  comparisonHighlight: {
    marginTop: 8,
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
  },
  comparisonHighlightText: {
    color: '#FFF',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  chartCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
  },
  chartHeaderTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  chartTitle: {
    color: COLORS.text,
    fontWeight: 'bold',
  },
  chartChip: {
    backgroundColor: COLORS.background,
  },
  pdfExportButton: {
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chartCycleLabelHeader: {
    width: 70,
    height: 30,
  },
  chartDayHeader: {
    width: 34,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartDayHeaderText: {
    fontSize: 10,
    color: COLORS.textSecondary,
    fontWeight: 'bold',
  },
  chartCycleLabel: {
    width: 70,
    height: 38,
    justifyContent: 'center',
    paddingRight: 6,
  },
  chartCycleName: {
    color: COLORS.text,
    fontWeight: 'bold',
    fontSize: 12,
  },
  chartCycleDate: {
    color: COLORS.textSecondary,
    fontSize: 9,
  },
  chartCell: {
    width: 32,
    height: 32,
    margin: 1,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  peakCell: {
    borderColor: COLORS.error,
    borderWidth: 2,
  },
  chartCellText: {
    color: COLORS.text,
    fontSize: 10,
    fontWeight: 'bold',
  },
  chartHeart: {
    position: 'absolute',
    right: 1,
    bottom: -2,
    color: '#E91E63',
    fontSize: 10,
    fontWeight: 'bold',
  },
  legendCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
  },
  legendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '50%',
    marginBottom: 8,
  },
  legendSwatch: {
    width: 16,
    height: 16,
    borderRadius: 4,
    marginRight: 8,
  },
  legendText: {
    color: COLORS.text,
    fontSize: 12,
  },
  emptyStateCompact: {
    padding: 24,
    alignItems: 'center',
  },
});
