import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'SpoqaHanSansNeo-Thin': require('../../assets/fonts/SpoqaHanSansNeo-Thin.ttf'),
    'SpoqaHanSansNeo-Light': require('../../assets/fonts/SpoqaHanSansNeo-Light.ttf'),
    'SpoqaHanSansNeo-Regular': require('../../assets/fonts/SpoqaHanSansNeo-Regular.ttf'),
    'SpoqaHanSansNeo-Medium': require('../../assets/fonts/SpoqaHanSansNeo-Medium.ttf'),
    'SpoqaHanSansNeo-Bold': require('../../assets/fonts/SpoqaHanSansNeo-Bold.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
       <Stack.Screen name="onboarding" />
      <Stack.Screen name="(auth)" /> 
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="location-confirm"
        options={{
          presentation: 'card',
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="camera"
        options={{
          presentation: 'fullScreenModal',
          animation: 'slide_from_bottom',
        }}
      />
    </Stack>
  );
}
