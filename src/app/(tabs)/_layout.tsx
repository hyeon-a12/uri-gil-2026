import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { router, Tabs } from 'expo-router';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText as Text } from '@/components/AppText';
import { useTripStore } from '@/store/useTripStore';
import { COLORS as SHARED_COLORS } from '@/constants/color';
import { Alert } from '@/services/webAlert';


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

// 탭바 가운데 촬영 버튼(네이티브)과 웹 전역 플로팅 촬영 버튼이 똑같이 써야
// 하는 로직이라 공용 함수로 뺐습니다 — 진행 중인 여행이 없으면 먼저
// 안내하고, 있으면 바로 촬영 화면으로 이동합니다.
function handleCameraPress() {
  const currentTrip = useTripStore.getState().currentTrip;

  if (!currentTrip) {
    // react-native-web의 Alert.alert는 빈 함수라 웹에서는 아무것도 안 뜹니다
    // (RoutePlanView에서 겪은 것과 같은 문제) — window.confirm으로 대체합니다.
    if (Platform.OS === 'web') {
      if (window.confirm('진행 중인 여행이 없습니다. 여행을 먼저 선택하거나 만들어주세요.')) {
        router.push('/(tabs)/home');
      }
      return;
    }

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
}

function CameraTabButton() {
  return (
    <Pressable onPress={handleCameraPress} style={styles.cameraButtonWrap}>
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

// 웹 전역 촬영 플로팅 버튼입니다. 햄버거 메뉴 패널(WebSideMenu)은 (tabs)
// 그룹 바깥 화면(add-place, trip-detail 등)에서도 보여야 해서 루트
// 레이아웃(src/app/_layout.tsx)으로 옮겼습니다 — 여기 남은 건 탭 화면에서만
// 보이면 되는 촬영 버튼뿐입니다.
function WebCameraFab() {
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      onPress={handleCameraPress}
      hitSlop={10}
      style={[styles.webCameraFab, { bottom: insets.bottom + 20 }]}
    >
      <CameraIcon width={26} height={26} fill="#FFFFFF" />
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
          // 웹은 하단 탭바 대신 햄버거 메뉴(WebNavOverlay)를 쓰므로 탭바
          // 자체를 숨깁니다. 라우트/네비게이션 구조는 그대로 유지되고
          // (router.push로 계속 이동), 화면에 그려지는 탭바만 없앱니다.
          tabBarStyle:
            Platform.OS === 'web'
              ? { display: 'none' }
              : [
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
      {Platform.OS === 'web' && <WebCameraFab />}
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

    borderRadius: 0,
    backgroundColor: BAR_BG,

    // @react-navigation/bottom-tabs가 탭바 기본 스타일에 borderTopWidth(hairline)를
    // 자체적으로 넣어두는데, 우리 tabBarStyle과 배열로 합쳐질 뿐이라 속성을 아예
    // 안 쓰면(undefined) 그대로 남아있습니다. 없애려면 0으로 명시적으로 덮어써야 합니다.
    borderTopWidth: 0,

    // 선(border) 없이 아주 옅은 그림자만으로 콘텐츠와 경계를 구분합니다.
    elevation: 2,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: -2 },
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

    fontSize: 10,
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
    shadowOpacity: 0.11,
    shadowRadius: 7,
    shadowOffset: {
      width: 0,
      height: 4,
    },

    elevation: 4,
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

  // ── 웹 전용: 햄버거 메뉴(사이드메뉴) + 전역 촬영 FAB ──────────────
  webCameraFab: {
    position: 'absolute',
    right: 16,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ACTIVE,
    shadowColor: ACTIVE,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    zIndex: 20,
  },
});