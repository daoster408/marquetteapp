const isDogfood = process.env.APP_VARIANT === 'dogfood';

const firebaseExtra = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '',
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '',
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '',
  dogfoodAllowedEmails: process.env.EXPO_PUBLIC_DOGFOOD_ALLOWED_EMAILS || '',
};

module.exports = ({ config }) => ({
  ...config,
  name: isDogfood ? 'Fidelis Dogfood' : config.name,
  scheme: isDogfood ? 'com.daoster.app.dogfood' : (config.scheme || 'com.daoster.app'),
  android: {
    ...config.android,
    package: isDogfood ? 'com.daoster.app.dogfood' : config.android?.package,
  },
  plugins: [
    ...(config.plugins || []),
    [
      'expo-local-authentication',
      {
        faceIDPermission: 'Allow Fidelis to unlock your family chart with Face ID.',
      },
    ],
  ],
  extra: {
    ...config.extra,
    appVariant: isDogfood ? 'dogfood' : 'stable',
    firebase: firebaseExtra,
  },
});
