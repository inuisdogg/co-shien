import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'jp.co.inu.coshien.facility',
  appName: 'co-shien Biz',
  webDir: '../web-placeholder',
  // ライブWEB方式: WEBサーバーから直接読み込む
  server: {
    url: 'https://co-shien.inu.co.jp/biz',
    cleartext: false,
    allowNavigation: [
      'co-shien.inu.co.jp',
      '*.supabase.co',
    ],
  },
  ios: {
    scheme: 'co-shien-facility',
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
