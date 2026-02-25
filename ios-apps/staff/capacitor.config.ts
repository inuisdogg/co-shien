import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'jp.co.inu.coshien.staff',
  appName: 'roots Staff',
  webDir: '../web-placeholder',
  // ライブWEB方式: WEBサーバーから直接読み込む
  server: {
    url: 'https://roots.inu.co.jp/personal',
    cleartext: false,
    allowNavigation: [
      'roots.inu.co.jp',
      '*.supabase.co',
    ],
  },
  ios: {
    scheme: 'roots-staff',
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    backgroundColor: '#00c4cc',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#00c4cc',
      showSpinner: false,
    },
    StatusBar: {
      style: 'light',
      backgroundColor: '#00c4cc',
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
  },
};

export default config;
