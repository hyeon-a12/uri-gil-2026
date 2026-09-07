import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  Dimensions,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/AppText';
import { COLORS as SHARED_COLORS, RADIUS, SPACING } from '@/constants/color';

const COLORS = {
  accent: SHARED_COLORS.accent,
  textPrimary: SHARED_COLORS.textPrimary,
  textSecondary: SHARED_COLORS.textSecondary,
  surface: SHARED_COLORS.surface,
};

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const KAKAO_REST_API_KEY = process.env.EXPO_PUBLIC_KAKAO_REST_API_KEY;

export type KakaoPlaceInfo = {
  address: string;
  category: string;
  phone?: string;
  placeUrl?: string;
};

// 정보 팝업(PlaceDetailModal)이 어떤 화면(홈의 추천 장소 카드/태그 검색 결과,
// 내 루트의 스톱 카드 등)에서 열리든 같은 모양으로 다룰 수 있도록 통일한
// 뷰 모델입니다. distanceMeters는 항상 m 단위로 미리 정규화해서 넘깁니다.
export type PlaceDetailView = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  imageUrl?: string;
  distanceMeters?: number;
  // 이미 주소·카테고리·전화번호를 갖고 있는 출처는 이 세 값을 채워서 넘기면
  // 추가 API 호출 없이 바로 씁니다. undefined면 팝업이 열릴 때
  // fetchKakaoPlaceInfo로 보충합니다.
  address?: string;
  category?: string;
  phone?: string;
  placeUrl?: string;
};

/** 이름/좌표만 있는 장소의 주소·카테고리·전화번호를 카카오 로컬 키워드 검색으로 채웁니다. */
export async function fetchKakaoPlaceInfo(
  name: string,
  lat: number,
  lng: number,
): Promise<KakaoPlaceInfo | null> {
  if (!KAKAO_REST_API_KEY) return null;
  try {
    const params = new URLSearchParams({
      query: name,
      x: String(lng),
      y: String(lat),
      sort: 'distance',
      size: '1',
    });
    const response = await fetch(
      `https://dapi.kakao.com/v2/local/search/keyword.json?${params.toString()}`,
      { headers: { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` } },
    );
    if (!response.ok) return null;
    const data = await response.json();
    const doc = data?.documents?.[0];
    if (!doc) return null;
    return {
      address: doc.road_address_name || doc.address_name || '',
      category: doc.category_group_name || doc.category_name || '',
      phone: doc.phone || undefined,
      placeUrl: doc.place_url || undefined,
    };
  } catch {
    return null;
  }
}

function formatPlaceDistance(distance: number): string {
  return distance < 1000
    ? `${Math.round(distance)}m`
    : `${(distance / 1000).toFixed(1)}km`;
}

type PlaceDetailModalProps = {
  place: PlaceDetailView | null;
  extraInfo: KakaoPlaceInfo | null;
  isLoadingExtraInfo: boolean;
  onClose: () => void;
};

// RN의 <Modal>을 쓰지 않고 화면 트리 안에 직접 그리는 오버레이로 구현했습니다
// — <Modal>은 항상 별도의 네이티브 레이어라 열려있는 동안 뒤쪽(지도 등)이
// 터치 자체를 아예 못 받았는데, 이렇게 바꾸면 시트가 덮지 않은 영역(위쪽
// 지도)은 pointerEvents="box-none" 덕분에 계속 조작할 수 있습니다. 대신
// 뒤로가기 버튼 처리와 슬라이드 애니메이션을 직접 구현해야 합니다.
export function PlaceDetailModal({
  place,
  extraInfo,
  isLoadingExtraInfo,
  onClose,
}: PlaceDetailModalProps) {
  // 하단 탭바((tabs)/_layout.tsx)가 화면 콘텐츠를 밀어내는 게 아니라
  // position:'absolute'로 그 위에 떠 있는 방식이라, 우리 화면의 콘텐츠
  // 영역은 탭바 높이가 전혀 빠지지 않은 "창 전체 높이"입니다. 그래서 이
  // 팝업도 탭바 높이만큼 바닥에서 띄워주지 않으면 버튼이 탭바 뒤에 깔려서
  // 안 보입니다 — 탭바 쪽과 똑같은 공식으로 높이를 계산합니다.
  const insets = useSafeAreaInsets();
  const tabBarHeight = 105 + (Platform.OS === 'android' ? insets.bottom * 0.1 : 0);

  const [mounted, setMounted] = useState(false);
  const [snapshot, setSnapshot] = useState<{
    place: PlaceDetailView;
    extraInfo: KakaoPlaceInfo | null;
    isLoading: boolean;
  } | null>(null);
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const wasOpenRef = useRef(false);

  // place가 닫히는 순간(null) 바로 내용이 비어버리면 슬라이드 다운 도중
  // 텅 빈 카드가 보여서, 마지막으로 봤던 내용을 스냅샷으로 붙잡아둡니다.
  useEffect(() => {
    if (place) {
      setSnapshot({ place, extraInfo, isLoading: isLoadingExtraInfo });
    }

    if (place && !wasOpenRef.current) {
      wasOpenRef.current = true;
      setMounted(true);
      translateY.setValue(SCREEN_HEIGHT);
      Animated.timing(translateY, {
        toValue: 0,
        duration: 260,
        useNativeDriver: true,
      }).start();
    } else if (!place && wasOpenRef.current) {
      wasOpenRef.current = false;
      Animated.timing(translateY, {
        toValue: SCREEN_HEIGHT,
        duration: 220,
        useNativeDriver: true,
      }).start(() => setMounted(false));
    }
  }, [place, extraInfo, isLoadingExtraInfo, translateY]);

  useEffect(() => {
    if (!place) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => subscription.remove();
  }, [place, onClose]);

  if (!mounted || !snapshot) return null;

  const viewPlace = snapshot.place;
  const viewExtraInfo = snapshot.extraInfo;
  const viewIsLoading = snapshot.isLoading;

  return (
    <View
      style={[styles.placeDetailBackdrop, { bottom: tabBarHeight }]}
      pointerEvents="box-none"
    >
      <Animated.View
        style={[styles.placeDetailSheet, { transform: [{ translateY }] }]}
      >
        <ScrollView
          contentContainerStyle={styles.placeDetailScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.placeDetailImage}>
            {viewPlace.imageUrl ? (
              <Image
                source={{ uri: viewPlace.imageUrl }}
                style={styles.placeDetailImagePhoto}
                contentFit="cover"
              />
            ) : (
              <Ionicons name="image-outline" size={32} color={COLORS.textSecondary} />
            )}
          </View>

          <Text style={styles.placeDetailTitle} numberOfLines={2}>
            {viewPlace.name}
          </Text>
          {viewPlace.distanceMeters !== undefined ? (
            <View style={styles.placeDetailDistanceRow}>
              <Ionicons name="location" size={14} color={COLORS.accent} />
              <Text style={styles.placeDetailDistanceText}>
                {formatPlaceDistance(viewPlace.distanceMeters)}
              </Text>
            </View>
          ) : null}

          <View style={styles.placeDetailInfoList}>
            {viewIsLoading ? (
              <Text style={styles.placeDetailInfoLoading}>정보를 불러오는 중...</Text>
            ) : viewExtraInfo ? (
              <>
                {viewExtraInfo.category ? (
                  <View style={styles.placeDetailInfoRow}>
                    <Ionicons name="pricetag-outline" size={14} color={COLORS.textSecondary} />
                    <Text style={styles.placeDetailInfoText} numberOfLines={1}>
                      {viewExtraInfo.category}
                    </Text>
                  </View>
                ) : null}
                {viewExtraInfo.address ? (
                  <View style={styles.placeDetailInfoRow}>
                    <Ionicons name="navigate-outline" size={14} color={COLORS.textSecondary} />
                    <Text style={styles.placeDetailInfoText} numberOfLines={2}>
                      {viewExtraInfo.address}
                    </Text>
                  </View>
                ) : null}
                {viewExtraInfo.phone ? (
                  <View style={styles.placeDetailInfoRow}>
                    <Ionicons name="call-outline" size={14} color={COLORS.textSecondary} />
                    <Text style={styles.placeDetailInfoText}>{viewExtraInfo.phone}</Text>
                  </View>
                ) : null}
              </>
            ) : (
              <Text style={styles.placeDetailInfoLoading}>상세 정보를 찾지 못했어요</Text>
            )}
          </View>

          <View style={styles.placeDetailActionRow}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.placeDetailCancelButton,
                pressed && styles.placeDetailButtonPressed,
              ]}
            >
              <Text style={styles.placeDetailCancelText}>닫기</Text>
            </Pressable>
            {viewExtraInfo?.placeUrl ? (
              <Pressable
                onPress={() => {
                  Linking.openURL(viewExtraInfo.placeUrl!).catch((err) => {
                    console.warn('링크를 열 수 없어요:', err);
                  });
                }}
                style={({ pressed }) => [
                  styles.placeDetailMapButton,
                  pressed && styles.placeDetailButtonPressed,
                ]}
              >
                <Text style={styles.placeDetailMapButtonText}>카카오맵에서 보기</Text>
              </Pressable>
            ) : null}
          </View>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  // 뒤에 딤 처리된 배경 없이, 팝업 시트 자체를 크게 키워서 화면을 덮습니다.
  // 지도 위에 뜨는 다른 오버레이보다 항상 위에 있어야 해서 큰 zIndex를 씁니다.
  placeDetailBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
    zIndex: 400,
    elevation: 400,
  },
  // 고정 height 대신 maxHeight를 씁니다 — 버튼이 스크롤 콘텐츠의 마지막
  // 항목이라(상세 정보 바로 아래), 카드 자체가 내용물 크기에 맞춰 줄어들고
  // (짧은 내용이면 버튼이 바로 붙어서 보임), 내용이 길 때만 이 최대 높이에서
  // 스크롤됩니다.
  placeDetailSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '50%',
    overflow: 'hidden',
    paddingHorizontal: SPACING.screenH,
    paddingTop: SPACING.lg,
    width: '100%',
  },
  placeDetailScrollContent: {
    paddingBottom: SPACING.xl,
  },
  placeDetailImage: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginTop: SPACING.md,
  },
  placeDetailImagePhoto: {
    width: '100%',
    height: '100%',
  },
  placeDetailTitle: {
    marginTop: SPACING.md,
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  placeDetailDistanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.xs,
  },
  placeDetailDistanceText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  placeDetailInfoList: {
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },
  placeDetailInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.xs,
  },
  placeDetailInfoText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textPrimary,
  },
  placeDetailInfoLoading: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  placeDetailActionRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  placeDetailCancelButton: {
    alignItems: 'center',
    backgroundColor: '#F3F3F5',
    borderRadius: RADIUS.card,
    flex: 1,
    height: 50,
    justifyContent: 'center',
  },
  placeDetailCancelText: {
    color: '#626671',
    fontSize: 14,
    fontWeight: '800',
  },
  placeDetailButtonPressed: {
    opacity: 0.74,
  },
  placeDetailMapButton: {
    alignItems: 'center',
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.card,
    flex: 1,
    height: 50,
    justifyContent: 'center',
  },
  placeDetailMapButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
