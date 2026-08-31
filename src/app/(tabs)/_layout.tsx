import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { router, Tabs } from 'expo-router';
import { Image } from 'expo-image';
import { Alert, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText as Text } from '@/components/AppText';
import { useTripStore } from '@/store/useTripStore';
import { COLORS as SHARED_COLORS } from '@/constants/color';


  import HomeIcon from "@/assets/images/tabIcons/home.svg";
  import RouteIcon from "@/assets/images/tabIcons/route.svg";
  import UserIcon from "@/assets/images/tabIcons/user.svg";
  import CameraIcon from "@/assets/images/tabIcons/camera.svg";
  import ClipIcon from "@/assets/images/tabIcons/clip.svg";


const ACTIVE = SHARED_COLORS.accent;
// 탭을 선택했을 때(눌렀을 때) 아이콘·글자 색이 메인 컬러(ACTIVE)로 표시됩니다.
// (가운데 카메라 버튼의 배경색도 항상 같은 ACTIVE 오렌지를 씁니다.)
const SELECTED = ACTIVE;
const INACTIVE = SHARED_COLORS.textSecondary;
const BAR_BG = SHARED_COLORS.background;

const icons = {
  home: HomeIcon,
  route: RouteIcon,
  camera: CameraIcon,
  user: UserIcon,
  clip: ClipIcon,
};

function TabItem({
  Icon,
  label,
  focused,
}: {
  Icon: React.ComponentType<any>;
  label: string;
  focused: boolean;
}) {
  return (
    <View style={styles.tabItem}>
  <Icon
    width={23.4}
    height={23.4}
    fill={focused ? SELECTED : INACTIVE}
  />

  <Text
    numberOfLines={1}
    ellipsizeMode="clip"
    allowFontScaling={false}
    style={[
      styles.tabLabel,
      { color: focused ? SELECTED : INACTIVE },
    ]}
  >
    {label}
  </Text>
</View>
  );
}

function CameraTabButton() {
  const handlePress = () => {
    const currentTrip = useTripStore.getState().currentTrip;

    if (!currentTrip) {
      Alert.alert(
        '진행 중인 여행이 없습니다',
        '촬영한 클립을 저장할 여행을 먼저 선택하거나 만들어주세요.',
        [
          { text: '취소', style: 'cancel' },
          {
            text: '여행 만들러 가기',
            onPress: () => router.push('/(tabs)/home'),
          },
        ],
      );
      return;
    }

    router.push('/camera');
  };

  return (
    <Pressable onPress={handlePress} style={styles.cameraButtonWrap}>
      <View style={styles.cameraButton}>
        <CameraIcon
          width={27}
          height={27}
          fill="#FFFFFF"
        />
      </View>
    </Pressable>
  );
}

export default function TabLayout() {
  // 안드로이드 엣지투엣지 환경에서는 이 탭바가 화면 물리적 맨 아래까지 깔리고
  // 그 위를 기기 시스템 내비게이션 바(제스처 바/3버튼 바)가 덮어버립니다.
  // 기기별 내비게이션 바 높이(insets.bottom)만큼 탭바 자체를 키워서 피하는데,
  // insets.bottom을 그대로 다 더하면 탭바 배경이 흰색이라 그 여백이 화면
  // 배경과 구분이 안 돼서 탭 아이콘만 위로 붕 뜬 것처럼 보입니다. 실제로
  // 필요한 것보다 과하게 큰 여백이라, 절반만 더해서 여백을 줄입니다.
  // iOS는 홈 인디케이터 영역이 시스템 바처럼 화면을 덮어버리는 게 아니라서
  // 기존 고정 높이(105)로도 이미 안 가려졌음 — 안드로이드에서만 더해줍니다.
  const insets = useSafeAreaInsets();
  const extraBottom = Platform.OS === 'android' ? insets.bottom * 0.1 : 0;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Tabs
        initialRouteName="home"
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarStyle: [
            styles.tabBar,
            {
              height: 105 + extraBottom,
              paddingBottom: 10 + extraBottom,
            },
          ],
          tabBarHideOnKeyboard: true,
        }}>
        <Tabs.Screen
          name="home"
          options={{
            title: '홈',
            tabBarIcon: ({ focused }) => (
              <TabItem Icon={icons.home} label="홈" focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="my-route"
          options={{
            title: '이동경로',
            tabBarIcon: ({ focused }) => (
              <TabItem Icon={icons.route} label="경로" focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="explore"
          options={{
            title: '카메라',
            tabBarButton: () => <CameraTabButton />,
          }}
        />

        <Tabs.Screen
          name="clip-manage"
          options={{
            title: '클립',
            tabBarIcon: ({ focused }) => (
              <TabItem Icon={icons.clip} label="클립" focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="my-page"
          options={{
            title: '마이페이지',
            tabBarIcon: ({ focused }) => (
              <TabItem Icon={icons.user} label="내정보" focused={focused} />
            ),
          }}
        />
      </Tabs>
      </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,

    height: 105,
    paddingTop: 8,
    paddingBottom: 10,

    borderTopWidth: 1,
    borderTopColor: '#EFEDE8',

    borderRadius: 0,
    backgroundColor: BAR_BG,

    elevation: 8,

    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: -2,
    },
  },

  tabItem: {
    width: 62,

    alignItems: 'center',
    justifyContent: 'center',

    gap: 4.5, // 아이콘-글자 간격을 기존 3의 1.5배로 늘렸습니다.
    marginTop: 3,
  },

  tabLabel: {
    width: 62,

    fontSize: 7.7, // 기존 11의 0.7배로 줄였습니다.
    lineHeight: 14,
    fontWeight: '500',

    textAlign: 'center',
    includeFontPadding: false,
  },

  cameraButtonWrap: {
    alignItems: 'center',
    justifyContent: 'flex-start',

    marginTop: -22,
  },

  cameraButton: {
    width: 58,
    height: 58,

    borderRadius: 29,

    backgroundColor: ACTIVE,

    alignItems: 'center',
    justifyContent: 'center',

    borderWidth: 4,
    borderColor: BAR_BG,

    shadowColor: ACTIVE,
    shadowOpacity: 0.22,
    shadowRadius: 7,
    shadowOffset: {
      width: 0,
      height: 4,
    },

    elevation: 8,
  },

  cameraLabel: {
    marginTop: 1,

    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',

    color: ACTIVE,

    textAlign: 'center',
    includeFontPadding: false,
  },
});