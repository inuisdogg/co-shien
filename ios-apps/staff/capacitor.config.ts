import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'jp.co.inu.coshien.staff',
  appName: 'Roots Staff',
  webDir: '../web-placeholder',
  server: {
    url: 'https://roots.inu.co.jp/career',
    cleartext: false,
    allowNavigation: ['roots.inu.co.jp', '*.supabase.co'],
  },
  ios: {
    contentInset: 'automatic',
    allowsLinkPreview: true,
    scrollEnabled: true,
    backgroundColor: '#ffffff',
    preferredContentMode: 'mobile',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#ffffff',
      showSpinner: false,
      launchFadeOutDuration: 500,
    },
    StatusBar: {
      style: 'light',
      backgroundColor: '#6366F1',
    },
    Keyboard: {
      resize: 'body',
      style: 'light',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
