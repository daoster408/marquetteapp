const fs = require('fs');
const path = require('path');

const isDogfood = process.env.APP_VARIANT === 'dogfood';
const dogfoodGoogleServicesFile = './google-services.dogfood.json';

function getDogfoodGoogleServices() {
  if (!isDogfood) return null;

  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, dogfoodGoogleServicesFile), 'utf8'));
  } catch {
    return null;
  }
}

function getDogfoodClient() {
  const config = getDogfoodGoogleServices();
  return config?.client?.find(
    client => client?.client_info?.android_client_info?.package_name === 'com.daoster.app.dogfood'
  );
}

const dogfoodClient = getDogfoodClient();
const dogfoodProjectInfo = getDogfoodGoogleServices()?.project_info || {};
const dogfoodApiKey = dogfoodClient?.api_key?.[0]?.current_key || '';
const dogfoodOAuthClients = dogfoodClient?.oauth_client || [];
const dogfoodAndroidClientId = dogfoodOAuthClients.find(client => client.client_type === 1)?.client_id || '';
const dogfoodWebClientId = dogfoodOAuthClients.find(client => client.client_type === 3)?.client_id || '';

const firebaseExtra = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || dogfoodApiKey || '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || (dogfoodProjectInfo.project_id ? `${dogfoodProjectInfo.project_id}.firebaseapp.com` : ''),
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || dogfoodProjectInfo.project_id || '',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || dogfoodProjectInfo.storage_bucket || '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || dogfoodProjectInfo.project_number || '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || dogfoodClient?.client_info?.mobilesdk_app_id || '',
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || dogfoodAndroidClientId || '',
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || dogfoodWebClientId || '',
  dogfoodAllowedEmails: process.env.EXPO_PUBLIC_DOGFOOD_ALLOWED_EMAILS || '',
};

module.exports = ({ config }) => ({
  ...config,
  name: isDogfood ? 'Fidelis Dogfood' : config.name,
  scheme: isDogfood ? 'com.daoster.app.dogfood' : (config.scheme || 'com.daoster.app'),
  android: {
    ...config.android,
    package: isDogfood ? 'com.daoster.app.dogfood' : config.android?.package,
    googleServicesFile: isDogfood ? dogfoodGoogleServicesFile : config.android?.googleServicesFile,
  },
  plugins: [
    ...(config.plugins || []),
    [
      'expo-local-authentication',
      {
        faceIDPermission: 'Allow Fidelis to unlock your family chart with Face ID.',
      },
    ],
    ...(isDogfood ? ['@react-native-google-signin/google-signin'] : []),
  ],
  extra: {
    ...config.extra,
    appVariant: isDogfood ? 'dogfood' : 'stable',
    firebase: firebaseExtra,
  },
});
