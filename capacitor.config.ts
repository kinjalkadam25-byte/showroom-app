import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.showroom.app',
  appName: 'Showroom',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
