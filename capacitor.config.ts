import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.carswiseai.app',
  appName: 'CarsWise AI',
  webDir: 'build',
  server: {
    androidScheme: 'https',
  },
};

export default config;
