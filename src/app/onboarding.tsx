import { router } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  ImageSourcePropType,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewToken,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type OnboardingPage = {
  image: ImageSourcePropType;
  title: string;
  description: string;
};

const onboardingPages: OnboardingPage[] = [
  {
    image: require('../../assets/images/onboarding/onboarding1.png'),
    title: '너와 나의 길,\n우리가 연결되는 순간',
    description: '여행의 순간을 기록하고\n나만의 길로 완성해보세요.',
  },
  {
    image: require('../../assets/images/onboarding/onboarding2.png'),
    title: '여행의 순간을\n길 위에 남겨보세요',
    description:
      '이동하며 촬영한 짧은 영상이\n시간과 위치에 따라 지도에 기록됩니다.',
  },
  {
    image: require('../../assets/images/onboarding/onboarding3.png'),
    title: '흩어진 클립이\n하나의 여행이 됩니다',
    description:
      '원하는 영상을 고르면 촬영 시간과 위치가 담긴\n나만의 여행 영상으로 완성됩니다.',
  },
  {
    image: require('../../assets/images/onboarding/onboarding4.png'),
    title: '완성된 여행,\n소중한 사람과 나눠보세요',
    description:
      '내가 걸은 길을 이미지로 만들어\n친구들에게 바로 공유할 수 있어요.',
  },
];

const viewabilityConfig = {
  itemVisiblePercentThreshold: 60,
};

export default function OnboardingScreen() {
  const listRef = useRef<FlatList<OnboardingPage>>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const isFirstPage = currentIndex === 0;
  const isLastPage = currentIndex === onboardingPages.length - 1;

  const finishOnboarding = () => {
    router.replace('/login');
  };

  const moveToPage = (index: number) => {
    listRef.current?.scrollToIndex({
      index,
      animated: true,
    });

    setCurrentIndex(index);
  };

  const handleNext = () => {
    if (isLastPage) {
      finishOnboarding();
      return;
    }

    moveToPage(currentIndex + 1);
  };

  const handlePrevious = () => {
    if (isFirstPage) {
      return;
    }

    moveToPage(currentIndex - 1);
  };

  const handleLeftButton = () => {
    if (isFirstPage) {
      finishOnboarding();
      return;
    }

    handlePrevious();
  };

  const handleViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const visiblePage = viewableItems.find(
        (item) => item.index !== null && item.index !== undefined,
      );

      if (visiblePage?.index !== null && visiblePage?.index !== undefined) {
        setCurrentIndex(visiblePage.index);
      }
    },
  ).current;

  const renderPage = ({ item }: { item: OnboardingPage }) => {
    return (
      <View style={styles.page}>
        <View style={styles.content}>
          <View style={styles.imageArea}>
            <View style={styles.imageBackground} />

            <Image
              source={item.image}
              resizeMode="contain"
              style={styles.illustration}
            />
          </View>

          <View style={styles.textArea}>
            <Text style={styles.title}>{item.title}</Text>

            <Text style={styles.description}>
              {item.description}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View
          pointerEvents="none"
          style={styles.background}
        >
          <View style={styles.topDecoration} />
          <View style={styles.bottomDecoration} />

          <View style={styles.dotLeft} />
          <View style={styles.dotRight} />
        </View>

        <FlatList
          ref={listRef}
          data={onboardingPages}
          renderItem={renderPage}
          keyExtractor={(_, index) => `onboarding-${index}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          bounces={false}
          decelerationRate="fast"
          getItemLayout={(_, index) => ({
            length: SCREEN_WIDTH,
            offset: SCREEN_WIDTH * index,
            index,
          })}
          viewabilityConfig={viewabilityConfig}
          onViewableItemsChanged={handleViewableItemsChanged}
        />

        <View style={styles.footer}>
          <Pressable
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={
              isFirstPage
                ? '온보딩 건너뛰기'
                : '이전 페이지'
            }
            onPress={handleLeftButton}
            style={({ pressed }) => [
              styles.footerButton,
              styles.previousButton,
              pressed && styles.pressed,
            ]}
          >
            {isFirstPage ? (
              <Text style={styles.skipText}>
                건너뛰기
              </Text>
            ) : (
              <>
                <Text style={styles.previousArrow}>
                  ‹
                </Text>

                <Text style={styles.previousText}>
                  이전
                </Text>
              </>
            )}
          </Pressable>

          <View style={styles.indicatorRow}>
            {onboardingPages.map((_, index) => (
              <View
                key={`indicator-${index}`}
                style={[
                  styles.indicator,
                  index === currentIndex &&
                    styles.activeIndicator,
                ]}
              />
            ))}
          </View>

          <Pressable
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={
              isLastPage
                ? '시작하기'
                : '다음 페이지'
            }
            onPress={handleNext}
            style={({ pressed }) => [
              styles.footerButton,
              styles.nextButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.nextText}>
              {isLastPage ? '시작하기' : '다음'}
            </Text>

            {!isLastPage && (
              <Text style={styles.arrow}>
                ›
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAF9F7',
  },

  container: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#FAF9F7',
  },

  background: {
    ...StyleSheet.absoluteFillObject,
  },

  topDecoration: {
    position: 'absolute',

    width: 280,
    height: 280,

    borderRadius: 140,

    right: -150,
    top: -150,

    backgroundColor: '#F0ECE8',
  },

  bottomDecoration: {
    position: 'absolute',

    width: 220,
    height: 220,

    borderRadius: 110,

    left: -130,
    bottom: -130,

    backgroundColor: '#F2EEE9',
  },

  dotLeft: {
    position: 'absolute',

    width: 8,
    height: 8,

    borderRadius: 4,

    left: 28,
    top: '44%',

    backgroundColor: '#F5A23B',
  },

  dotRight: {
    position: 'absolute',

    width: 8,
    height: 8,

    borderRadius: 4,

    right: 28,
    top: '60%',

    backgroundColor: '#F5A23B',
  },

  page: {
    width: SCREEN_WIDTH,
    flex: 1,
  },

  content: {
    flex: 1,

    alignItems: 'center',

    paddingTop: 105,
    paddingHorizontal: 32,
  },

  imageArea: {
    width: '100%',
    height: 280,

    alignItems: 'center',
    justifyContent: 'center',
  },

  imageBackground: {
    position: 'absolute',

    width: 230,
    height: 230,

    borderRadius: 115,

    backgroundColor: '#FFF0DF',
  },

  illustration: {
    width: 240,
    height: 240,
  },

  textArea: {
    alignItems: 'center',

    marginTop: 34,

    paddingHorizontal: 8,
  },

  title: {
    color: '#262321',

    fontSize: 25,
    lineHeight: 34,

    fontWeight: '700',
    letterSpacing: -0.6,

    textAlign: 'center',
  },

  description: {
    maxWidth: 320,

    marginTop: 16,

    color: '#938D87',

    fontSize: 15,
    lineHeight: 23,

    textAlign: 'center',
  },

  footer: {
    height: 90,

    paddingHorizontal: 26,
    paddingBottom: 14,

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  footerButton: {
    width: 90,
    height: 44,

    justifyContent: 'center',
  },

  previousButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },

  skipText: {
    color: '#ABA59F',

    fontSize: 14,
    fontWeight: '500',
  },

  previousText: {
    color: '#6F6964',

    fontSize: 14,
    fontWeight: '600',
  },

  previousArrow: {
    marginRight: 5,
    marginTop: -1,

    color: '#F5A23B',

    fontSize: 21,
    lineHeight: 21,

    fontWeight: '500',
  },

  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },

  nextText: {
    color: '#2B2826',

    fontSize: 14,
    fontWeight: '700',
  },

  arrow: {
    marginLeft: 5,
    marginTop: -1,

    color: '#F5A23B',

    fontSize: 21,
    lineHeight: 21,

    fontWeight: '500',
  },

  indicatorRow: {
    position: 'absolute',

    left: 0,
    right: 0,

    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',

    gap: 6,
  },

  indicator: {
    width: 5,
    height: 5,

    borderRadius: 3,

    backgroundColor: '#D6D1CC',
  },

  activeIndicator: {
    width: 16,

    backgroundColor: '#2A2725',
  },

  pressed: {
    opacity: 0.5,
  },
});