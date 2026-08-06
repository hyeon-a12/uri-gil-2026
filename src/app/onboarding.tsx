import { router } from 'expo-router';
import { useState } from 'react';
import {
  Image,
  ImageSourcePropType,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

const onboardingImages: ImageSourcePropType[] = [
  require('../../assets/images/onboarding/onboarding1.png'),
  require('../../assets/images/onboarding/onboarding2.png'),
  require('../../assets/images/onboarding/onboarding3.png'),
  require('../../assets/images/onboarding/onboarding4.png'),
];

export default function OnboardingScreen() {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleNext = () => {
    const isLastPage =
      currentIndex === onboardingImages.length - 1;

    if (isLastPage) {
      router.replace('/login');
      return;
    }

    setCurrentIndex((previousIndex) => previousIndex + 1);
  };

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.pressArea}
        onPress={handleNext}
      >
        <Image
          source={onboardingImages[currentIndex]}
          style={styles.image}
          resizeMode="cover"
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  pressArea: {
    flex: 1,
  },

  image: {
    width: '100%',
    height: '100%',
  },
});