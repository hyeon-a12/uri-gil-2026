import { router, Tabs } from 'expo-router';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';


  import HomeIcon from "@/assets/images/tabIcons/home.svg";
  import RouteIcon from "@/assets/images/tabIcons/route.svg";
  import UserIcon from "@/assets/images/tabIcons/user.svg";
  import CameraIcon from "@/assets/images/tabIcons/camera.svg";
  import ClipIcon from "@/assets/images/tabIcons/clip.svg";


const ACTIVE = '#f99b30';
const INACTIVE = '#B7B7B7';
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
    width={26}
    height={26}
    fill={focused ? ACTIVE : INACTIVE}
  />

  <Text
    numberOfLines={1}
    ellipsizeMode="clip"
    allowFontScaling={false}
    style={[
      styles.tabLabel,
      { color: focused ? ACTIVE : INACTIVE },
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
          width={30}
          height={30}
          fill="#FFFFFF"
        />
      </View>
    </Pressable>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: styles.tabBar,
        tabBarHideOnKeyboard: true,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => (
            <TabItem Icon={icons.home} label="Home" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="my-route"
        options={{
          title: 'Route',
          tabBarIcon: ({ focused }) => (
            <TabItem Icon={icons.route} label="Route" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Camera',
          tabBarButton: () => <CameraTabButton />,
        }}
      />

      <Tabs.Screen
        name="clip-manage"
        options={{
          title: 'Clips',
          tabBarIcon: ({ focused }) => (
            <TabItem Icon={icons.clip} label="Clips" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="my-page"
        options={{
          title: 'My Page',
          tabBarIcon: ({ focused }) => (
            <TabItem Icon={icons.user} label="Profile" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 10,
    height: 94,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: 0,
    borderRadius: 24,
    backgroundColor: BAR_BG,
    elevation: 0,
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 10,
  },
  icon: {
    width: 26,
    height: 26,
  },
  iconInactive: {
    opacity: 0.45,
  },
 tabLabel: {
  width: 58,
  fontSize: 11,
  lineHeight: 14,
  fontWeight: '500',
  textAlign: 'center',
  includeFontPadding: false,
},
  cameraButtonWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -30,
  },
  cameraButton: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: ACTIVE,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 6,
    borderColor: BAR_BG,
  },
  cameraIcon: {
    width: 30,
    height: 30,
  },
});
