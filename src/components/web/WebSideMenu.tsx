import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppText as Text } from '@/components/AppText';
import { useTripStore } from '@/store/useTripStore';
import { useProfileStore } from '@/store/useProfileStore';
import { useWebMenuStore } from '@/store/useWebMenuStore';
import { COLORS as SHARED_COLORS } from '@/constants/color';

import HomeIcon from '@/assets/images/tabIcons/home.svg';
import RouteIcon from '@/assets/images/tabIcons/route.svg';
import UserIcon from '@/assets/images/tabIcons/user.svg';
import ClipIcon from '@/assets/images/tabIcons/clip.svg';

/**
 * Manus 프로토타입의 SideMenu를 그대로 옮긴 웹 전용 햄버거 메뉴 패널입니다.
 *
 * 처음엔 (tabs)/_layout.tsx 안에서만 렌더했는데, 그러면 add-place/
 * trip-detail/my-routes/video-edit처럼 (tabs) 그룹 바깥의 화면으로 이동하면
 * (tabs)의 Tabs 네비게이터 자체가 언마운트되면서 메뉴 패널도 같이 사라졌습니다
 * ("모든 화면에서 메뉴가 보여야 한다"는 요구와 안 맞음). 그래서 앱을 통째로
 * 감싸는 루트 레이아웃(src/app/_layout.tsx)으로 옮겨서, 어떤 화면에 있든
 * 항상 마운트돼 있게 했습니다 — 실제로 열리는 건 각 화면 헤더의 메뉴
 * 버튼이 useWebMenuStore.open()을 부를 때뿐이라 평소엔 아무 영향이 없습니다.
 *
 * (tabs)/_layout.tsx에 남아있는 전역 촬영 FAB과는 별개 컴포넌트입니다.
 */

const WEB_NAV_ITEMS: {
  label: string;
  path: '/(tabs)/home' | '/(tabs)/my-route' | '/my-routes' | '/(tabs)/clip-manage';
  Icon?: React.ComponentType<any>;
  ionicon?: React.ComponentProps<typeof Ionicons>['name'];
}[] = [
  { label: '홈', path: '/(tabs)/home', Icon: HomeIcon },
  { label: '내 경로', path: '/(tabs)/my-route', Icon: RouteIcon },
  { label: '내 여행', path: '/my-routes', ionicon: 'calendar-outline' },
  { label: '내 클립', path: '/(tabs)/clip-manage', Icon: ClipIcon },
];

const WEB_NAV_MORE_ITEMS: {
  label: string;
  path: '/(tabs)/my-page';
  Icon?: React.ComponentType<any>;
}[] = [{ label: '마이페이지', path: '/(tabs)/my-page', Icon: UserIcon }];

export function WebSideMenu() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const isOpen = useWebMenuStore((state) => state.isOpen);
  const currentTrip = useTripStore((state) => state.currentTrip);
  const nickname = useProfileStore((state) => state.profile.nickname);
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isOpen ? 1 : 0,
      duration: isOpen ? 200 : 160,
      easing: isOpen ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [isOpen, slideAnim]);

  if (!isOpen) return null;

  const closeMenu = () => useWebMenuStore.getState().close();

  const goTo = (path: string) => {
    closeMenu();
    router.push(path as never);
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Pressable onPress={closeMenu} style={styles.webNavBackdrop} />

      <Animated.View
        style={[
          styles.webNavPanel,
          {
            transform: [
              {
                translateX: slideAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [320, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View style={[styles.webNavTop, { marginTop: insets.top + 17 }]}>
          <View style={styles.webNavBrand}>
            <Image
              source={require('@/assets/images/urigil-logo.png')}
              resizeMode="contain"
              style={styles.webNavBrandLogo}
            />
            <Text allowFontScaling={false} style={styles.webNavBrandText}>
              우리길
            </Text>
          </View>
          <Pressable onPress={closeMenu} hitSlop={10}>
            <Ionicons name="close" size={22} color={SHARED_COLORS.textPrimary} />
          </Pressable>
        </View>

        <View style={styles.webNavList}>
          {WEB_NAV_ITEMS.map((item) => {
            const active = pathname === item.path.replace('/(tabs)', '');
            return (
              <Pressable
                key={item.path}
                onPress={() => goTo(item.path)}
                style={[styles.webNavItem, active && styles.webNavItemActive]}
              >
                {item.Icon ? (
                  <item.Icon width={19} height={19} fill={SHARED_COLORS.textPrimary} />
                ) : (
                  <Ionicons name={item.ionicon} size={19} color={SHARED_COLORS.textPrimary} />
                )}
                <Text allowFontScaling={false} style={styles.webNavItemLabel}>
                  {item.label}
                </Text>
                {active && (
                  <Ionicons name="chevron-forward" size={17} color={SHARED_COLORS.textPrimary} />
                )}
              </Pressable>
            );
          })}

          <View style={styles.webNavDivider} />

          {WEB_NAV_MORE_ITEMS.map((item) => {
            const active = pathname === item.path.replace('/(tabs)', '');
            return (
              <Pressable
                key={item.path}
                onPress={() => goTo(item.path)}
                style={[styles.webNavItem, active && styles.webNavItemActive]}
              >
                {item.Icon && (
                  <item.Icon width={19} height={19} fill={SHARED_COLORS.textPrimary} />
                )}
                <Text allowFontScaling={false} style={styles.webNavItemLabel}>
                  {item.label}
                </Text>
                {active && (
                  <Ionicons name="chevron-forward" size={17} color={SHARED_COLORS.textPrimary} />
                )}
              </Pressable>
            );
          })}
        </View>

        <View style={[styles.webNavProfile, { marginBottom: insets.bottom + 12 }]}>
          <View style={styles.webNavAvatar}>
            <Text allowFontScaling={false} style={styles.webNavAvatarText}>
              {nickname?.[0] ?? '우'}
            </Text>
          </View>
          <View>
            <Text allowFontScaling={false} style={styles.webNavProfileName}>
              {nickname || '여행자'}
            </Text>
            <Text allowFontScaling={false} style={styles.webNavProfileStatus}>
              {currentTrip ? `${currentTrip.title} 기록 중` : '새 여행을 시작해보세요'}
            </Text>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const BAR_BG = SHARED_COLORS.background;

const styles = StyleSheet.create({
  webNavBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  webNavPanel: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 320,
    backgroundColor: BAR_BG,
    paddingHorizontal: 20,
    paddingBottom: 25,
    shadowColor: '#000000',
    shadowOpacity: 0.11,
    shadowRadius: 35,
    shadowOffset: { width: -14, height: 0 },
    elevation: 6,
  },
  webNavTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 29,
  },
  webNavBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  webNavBrandLogo: {
    width: 24,
    height: 24,
  },
  webNavBrandText: {
    fontSize: 16,
    fontWeight: '700',
    color: SHARED_COLORS.textPrimary,
  },
  webNavList: {
    flexDirection: 'column',
    gap: 3,
  },
  webNavItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    height: 48,
    paddingHorizontal: 12,
    borderRadius: 11,
  },
  webNavItemActive: {
    backgroundColor: SHARED_COLORS.main,
  },
  webNavItemLabel: {
    flex: 1,
    fontSize: 14,
    color: SHARED_COLORS.textPrimary,
  },
  webNavDivider: {
    height: 1,
    backgroundColor: SHARED_COLORS.border,
    marginVertical: 11,
  },
  webNavProfile: {
    marginTop: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 15,
    borderRadius: 12,
    backgroundColor: SHARED_COLORS.surface,
  },
  webNavAvatar: {
    width: 33,
    height: 33,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ded6cf',
  },
  webNavAvatarText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#66574b',
  },
  webNavProfileName: {
    fontSize: 13,
    fontWeight: '700',
    color: SHARED_COLORS.textPrimary,
  },
  webNavProfileStatus: {
    marginTop: 3,
    fontSize: 10,
    color: SHARED_COLORS.textSecondary,
  },
});
