import { Cycle, DayLog, MonitorReading } from '../types';

// Helper to add days to a date
const addDays = (date: string, days: number): string => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result.toISOString().split('T')[0];
};

// Generates a single, realistic-looking cycle
const generateCycle = (id: string, startDate: string, cycleLength: number, peakDay: number): Cycle => {
  const days: DayLog[] = [];
  for (let i = 0; i < cycleLength; i++) {
    const date = addDays(startDate, i);
    const cycleDay = i + 1;
    let reading: MonitorReading = 'low';

    if (cycleDay >= peakDay - 3 && cycleDay < peakDay) {
      reading = 'high';
    } else if (cycleDay === peakDay || cycleDay === peakDay + 1) {
      reading = 'peak';
    } else if (cycleDay > 5 && cycleDay < peakDay - 3) {
      reading = 'low';
    } else {
      reading = 'low';
    }
    
    // Period days
    if (cycleDay <= 5) {
      reading = 'none';
    }

    days.push({
      date,
      cycleDay,
      reading,
      isAutoPeak: cycleDay === peakDay + 1,
    });
  }

  return {
    id,
    startDate,
    endDate: addDays(startDate, cycleLength),
    days,
    peakDay,
    cycleLength,
    isComplete: true,
  };
};

// Generates a set of mock cycles
export const generateMockCycles = (): { cycles: Cycle[], currentCycleId: string } => {
  const cycles: Cycle[] = [];
  let currentStartDate = '2024-01-15';

  // Generate 7 completed cycles
  const completedCyclesData = [
    { cycleLength: 28, peakDay: 14 },
    { cycleLength: 29, peakDay: 15 },
    { cycleLength: 27, peakDay: 13 },
    { cycleLength: 30, peakDay: 16 },
    { cycleLength: 28, peakDay: 14 },
    { cycleLength: 29, peakDay: 15 },
    { cycleLength: 26, peakDay: 12 }, // The earliest peak
  ];
  
  for (let i = 0; i < completedCyclesData.length; i++) {
    const data = completedCyclesData[i];
    const cycle = generateCycle(`cycle${i + 1}`, currentStartDate, data.cycleLength, data.peakDay);
    cycles.push(cycle);
    currentStartDate = addDays(cycle.startDate, data.cycleLength);
  }

  // Generate 1 current, incomplete cycle
  const currentCycleId = 'cycle8';
  const currentCycle: Cycle = {
    id: currentCycleId,
    startDate: currentStartDate,
    days: [
        { date: currentStartDate, cycleDay: 1, reading: 'none' },
        { date: addDays(currentStartDate, 1), cycleDay: 2, reading: 'none' },
        { date: addDays(currentStartDate, 2), cycleDay: 3, reading: 'none' },
    ],
    isComplete: false,
  };

  cycles.push(currentCycle);

  return { cycles, currentCycleId };
};
