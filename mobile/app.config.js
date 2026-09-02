/** @type {import('expo/config').ExpoConfig} */
const appJson = require('./app.json');

const projectId =
  process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? '34ff95ff-e9c0-4b65-93b1-fc0df644a4fa';
const googleServicesFile =
  process.env.GOOGLE_SERVICES_JSON ?? './google-services.json';
const googleServiceInfoPlist =
  process.env.GOOGLE_SERVICE_INFO_PLIST ?? './GoogleService-Info.plist';

module.exports = {
  ...appJson.expo,
  android: {
    ...appJson.expo.android,
    package: 'com.atillamercimek.personelplanla',
    googleServicesFile,
  },
  ios: {
    ...appJson.expo.ios,
    bundleIdentifier: 'com.atillamercimek.personelplanla',
    googleServicesFile: googleServiceInfoPlist,
  },
  extra: {
    ...appJson.expo.extra,
    eas: {
      ...appJson.expo.extra?.eas,
      ...(projectId ? { projectId } : {}),
    },
    pushProvider: process.env.EXPO_PUBLIC_PUSH_PROVIDER ?? 'firebase',
  },
};
