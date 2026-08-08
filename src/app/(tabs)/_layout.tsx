import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { router, Tabs } from 'expo-router';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText as Text } from '@/components/AppText';


  import HomeIcon from "@/assets/images/tabIcons/home.svg";
  import RouteIcon from "@/assets/images/tabIcons/route.svg";
  import UserIcon from "@/assets/images/tabIcons/user.svg";
  import CameraIcon from "@/assets/images/tabIcons/camera.svg";
  import ClipIcon from "@/assets/images/tabIcons/clip.svg";


const ACTIVE = '#FF7F5C';
// 탭을 선택했을 때(눌렀을 때) 아이콘·글자 색이 메인 컬러(ACTIVE)로 표시됩니다.
// (가운데 카메라 버튼의 배경색도 항상 같은 ACTIVE 오렌지를 씁니다.)
const SELECTED = ACTIVE;
const INACTIVE = '#8A8A8A';
const BAR_BG = '#FFFFFF';

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
  return (
    <Pressable onPress={() => router.push('/camera')} style={styles.cameraButtonWrap}>
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
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Tabs
        initialRouteName="home"
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarStyle: styles.tabBar,
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

    height: 78,
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