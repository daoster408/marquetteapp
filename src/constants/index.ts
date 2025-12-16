// Color palette
export const COLORS = {
  // Fertility status colors
  fertile: '#E57373', // Soft red - fertile window
  infertile: '#81C784', // Soft green - safe/infertile
  period: '#64B5F6', // Soft blue - menstruation
  waiting: '#FFB74D', // Soft orange - waiting for data

  // Monitor reading colors
  readingLow: '#A5D6A7', // Light green
  readingHigh: '#FFCC80', // Light orange
  readingPeak: '#EF9A9A', // Light red
  readingNone: '#E0E0E0', // Gray

  // UI colors
  primary: '#5C6BC0', // Indigo
  primaryDark: '#3F51B5',
  secondary: '#26A69A', // Teal
  background: '#FAFAFA',
  surface: '#FFFFFF',
  text: '#212121',
  textSecondary: '#757575',
  border: '#E0E0E0',
  error: '#D32F2F',
  warning: '#F57C00',
};

// Church-aligned language strings
export const STRINGS = {
  // Fertility status messages
  statusFertile: 'Fertile Window',
  statusInfertile: 'Infertile',
  statusPeriod: 'Menstruation',
  statusWaiting: 'Waiting for Peak',

  // Action labels
  startNewCycle: 'Start New Cycle',
  logToday: 'Log Today',
  viewHistory: 'View History',

  // Monitor readings
  readingLow: 'Low',
  readingHigh: 'High',
  readingPeak: 'Peak',
  readingNone: 'No Test',

  // Guidance messages
  fertileGuidance: 'Fertile window is open. Abstain if postponing pregnancy.',
  infertileGuidance: 'Infertile time. Safe for intercourse if postponing.',
  waitingForPeak: 'Continue testing daily until Peak reading.',
  afterPeakGuidance: 'Peak recorded. Continue to abstain for 3 full days after second Peak.',

  // Alerts
  day25Warning: 'No Peak detected by Cycle Day 25. Please reset your monitor.',
  resetInstructions: 'Reset your Clearblue monitor and set it to Day 4 to minimize wait time before testing resumes.',

  // App info
  appName: 'Fidelis',
  disclaimer: 'This app is a charting tool, not a replacement for certified Marquette Method instruction.',

  // Goals (Church-aligned language)
  goalAchieve: 'Trying to Achieve Pregnancy',
  goalPostpone: 'Trying to Postpone Pregnancy',
};

// Algorithm constants
export const ALGORITHM = {
  FIRST_TEST_DAY: 6, // Start testing on CD6
  MAX_TEST_DAY: 25, // Monitor stops detecting after CD20 of testing (CD25)
  PEAK_WAIT_DAYS: 3, // Days to wait after 2nd Peak
  LOOKBACK_CYCLES: 6, // Number of cycles to look back for earliest Peak
  PEAK_MINUS_DAYS: 6, // Subtract from earliest Peak for fertility start
  MONITOR_RESET_DAY: 4, // Set monitor to CD4 when resetting
};
