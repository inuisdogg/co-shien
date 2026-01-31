import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'jp.co.inu.coshien.client',
  appName: 'co-shien',
  webDir: '../web-placeholder',
  // ライブWEB方式: WEBサーバーから直接読み込む
  // WEBを更新すればアプリも自動的に更新される
  server: {
    url: 'https://co-shien.inu.co.jp/client',
    cleartext: false,
    // アプリ内でのナビゲーションを許可
    allowNavigation: [
      'co-shien.inu.co.jp',
      '*.supabase.co',
    ],
  },
  ios: {
    scheme: 'co-shien-client',
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    // ステータスバーの設定
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
