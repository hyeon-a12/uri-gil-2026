import React, { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import DraggableFlatList, {
  RenderItemParams,
  ScaleDecorator,
} from 'react-native-draggable-flatlist';

const COLORS = {
  background: '#FAF8F1',
  card: '#FFFFFF',

  primary: '#F99B30',
  primarySoft: '#FFF1E4',

  textPrimary: '#262621',
  textSecondary: '#8A8A82',
  textTertiary: '#AAA9A2',

  border: '#ECE9E1',
  divider: '#F1EEE8',

  handle: '#999A95',
  shadow: '#4B4138',
  delete: '#E46F61',
};

interface ClipItem {
  id: string;
  title: string;
  recordedAt: string;
  durationSeconds: number;
  thumbnail: string;
}

// true: 클립 0개 화면 / false: 임시 클립 목록 화면
const SHOW_EMPTY_STATE = true;

const MOCK_CLIPS: ClipItem[] = [
  {
    id: '1',
    title: '협재해변의 저녁',
    recordedAt: '2026.07.23. 16:00',
    durationSeconds: 6,
    thumbnail:
      'https://images.unsplash.com/photo-1500534623283-312aade485b7?w=600',
  },
  {
    id: '2',
    title: '카페에서 잠시',
    recordedAt: '2026.07.23. 16:20',
    durationSeconds: 7,
    thumbnail:
      'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600',
  },
  {
    id: '3',
    title: '모슬포항 산책',
    recordedAt: '2026.07.23. 17:10',
    durationSeconds: 11,
    thumbnail:
      'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
  },
];

const INITIAL_CLIPS: ClipItem[] = SHOW_EMPTY_STATE ? [] : MOCK_CLIPS;

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(
    remainingSeconds,
  ).padStart(2, '0')}`;
}

function formatTotalDuration(seconds: number) {
  if (seconds < 60) {
    return `${seconds}초`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return remainingSeconds > 0
    ? `${minutes}분 ${remainingSeconds}초`
    : `${minutes}분`;
}

interface ClipCardProps {
  clip: ClipItem;
  index: number;
  editMode: boolean;
  isActive: boolean;
  drag: () => void;
  onDelete: () => void;
  onPress: () => void;
}

function ClipCard({
  clip,
  index,
  editMode,
  isActive,
  drag,
  onDelete,
  onPress,
}: ClipCardProps) {
  return (
    <View
      style={[
        styles.clipRow,
        isActive && styles.clipRowActive,
      ]}
    >
      <View
        style={[
          styles.orderBadge,
          isActive && styles.orderBadgeActive,
        ]}
      >
        <Text
          allowFontScaling={false}
          style={styles.orderBadgeText}
        >
          {index + 1}
        </Text>
      </View>

      <Pressable
        disabled={isActive}
        onPress={onPress}
        style={({ pressed }) => [
          styles.clipCard,
          isActive && styles.clipCardActive,
          pressed && !isActive && styles.clipCardPressed,
        ]}
      >
        <View style={styles.thumbnailContainer}>
          <Image
            source={{ uri: clip.thumbnail }}
            style={styles.thumbnail}
            contentFit="cover"
            transition={150}
          />

          <View style={styles.thumbnailDim} />

          <View style={styles.playButton}>
            <Ionicons
              name="play"
              size={18}
              color="#FFFFFF"
              style={styles.playIcon}
            />
          </View>
        </View>

        <View style={styles.clipInformation}>
          <Text
            numberOfLines={1}
            allowFontScaling={false}
            style={styles.clipTitle}
          >
            {clip.title}
          </Text>

          <Text
            numberOfLines={1}
            allowFontScaling={false}
            style={styles.recordedAt}
          >
            {clip.recordedAt}
          </Text>

          <View style={styles.durationRow}>
            <Ionicons
              name="time-outline"
              size={15}
              color={COLORS.textSecondary}
            />

            <Text
              allowFontScaling={false}
              style={styles.durationText}
            >
              {formatDuration(clip.durationSeconds)}
            </Text>
          </View>
        </View>

        {editMode ? (
          <Pressable
            hitSlop={12}
            onPress={(event) => {
              event.stopPropagation();
              onDelete();
            }}
            style={styles.deleteButton}
          >
            <Ionicons
              name="trash-outline"
              size={21}
              color={COLORS.delete}
            />
          </Pressable>
        ) : (
          <Pressable
            hitSlop={14}
            delayLongPress={120}
            onLongPress={drag}
            disabled={isActive}
            style={({ pressed }) => [
              styles.dragHandle,
              pressed && styles.dragHandlePressed,
              isActive && styles.dragHandleActive,
            ]}
          >
            <Ionicons
              name="reorder-three-outline"
              size={29}
              color={
                isActive
                  ? COLORS.primary
                  : COLORS.handle
              }
            />
          </Pressable>
        )}
      </Pressable>
    </View>
  );
}

export default function ClipManageScreen() {
  const insets = useSafeAreaInsets();

  const [clips, setClips] =
    useState<ClipItem[]>(INITIAL_CLIPS);

  const [editMode, setEditMode] = useState(false);

  const totalDuration = useMemo(
    () =>
      clips.reduce(
        (total, clip) =>
          total + clip.durationSeconds,
        0,
      ),
    [clips],
  );

  const handleDelete = (clipId: string) => {
    Alert.alert(
      '클립 삭제',
      '선택한 클립을 목록에서 삭제할까요?',
      [
        {
          text: '취소',
          style: 'cancel',
        },
        {
          text: '삭제',
          style: 'destructive',
          onPress: () => {
            setClips((currentClips) =>
              currentClips.filter(
                (clip) => clip.id !== clipId,
              ),
            );
          },
        },
      ],
    );
  };

  const handleCreateVideo = () => {
    if (clips.length === 0) {
      Alert.alert(
        '클립이 없습니다',
        '영상을 생성하려면 클립을 한 개 이상 추가해주세요.',
      );

      return;
    }

    Alert.alert(
      '영상 만들기',
      '현재 정렬된 클립 순서대로 영상을 생성합니다.',
    );
  };

  const renderClipItem = ({
    item,
    drag,
    isActive,
    getIndex,
  }: RenderItemParams<ClipItem>) => {
    const index = getIndex() ?? 0;

    return (
      <ScaleDecorator activeScale={1.02}>
        <ClipCard
          clip={item}
          index={index}
          editMode={editMode}
          isActive={isActive}
          drag={drag}
          onDelete={() => handleDelete(item.id)}
          onPress={() => {
            if (isActive) {
              return;
            }

            Alert.alert(
              item.title,
              '클립 상세 화면으로 연결할 예정입니다.',
            );
          }}
        />
      </ScaleDecorator>
    );
  };

  return (
    <View style={styles.screen}>
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 10,
          },
        ]}
      >
        <Pressable
          hitSlop={12}
          onPress={() => router.back()}
          style={styles.headerButton}
        >
          <Ionicons
            name="chevron-back"
            size={25}
            color={COLORS.textPrimary}
          />
        </Pressable>

        <Text
          allowFontScaling={false}
          style={styles.headerTitle}
        >
          클립 관리
        </Text>

        <Pressable
        hitSlop={12}
        onPress={() => router.push('/clip-select')}
        style={styles.headerButton}
      >
        <Text
          allowFontScaling={false}
          style={styles.editButtonText}
        >
          선택
        </Text>
      </Pressable>
      </View>

      <DraggableFlatList
        data={clips}
        keyExtractor={(item) => item.id}
        renderItem={renderClipItem}
        showsVerticalScrollIndicator={false}
        activationDistance={6}
        autoscrollThreshold={90}
        autoscrollSpeed={110}
        dragItemOverflow
        onDragEnd={({ data }) => {
          setClips(data);
        }}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingBottom:
              insets.bottom + 250,
          },
        ]}
        ListHeaderComponent={
          <View style={styles.introduction}>
            <Text
              allowFontScaling={false}
              style={styles.introductionTitle}
            >
              여행 클립을 정리해보세요
            </Text>

            <Text
              allowFontScaling={false}
              style={styles.introductionDescription}
            >
              오른쪽 아이콘을 길게 누른 뒤
              위아래로 움직여 순서를 변경할 수 있어요.
            </Text>
          </View>
        }
       ListEmptyComponent={
  <View style={styles.emptyContainer}>
    <View style={styles.emptyIconContainer}>
      <Ionicons
        name="location-outline"
        size={34}
        color={COLORS.textPrimary}
      />
    </View>

    <Text
      allowFontScaling={false}
      style={styles.emptyTitle}
    >
      아직 기록된 여행이 없어요
    </Text>

    <Text
      allowFontScaling={false}
      style={styles.emptyDescription}
    >
      첫 여행을 만들고 나만의 장소에서{'\n'}
      특별한 클립을 남겨보세요!
    </Text>

    <Pressable
      onPress={() => router.push('/my-route')}
      style={({ pressed }) => [
        styles.captureButton,
        pressed && styles.captureButtonPressed,
      ]}
    >
      <Text
        allowFontScaling={false}
        style={styles.captureButtonText}
      >
        여행 만들기
      </Text>
    </Pressable>
  </View>
}
      />

      <View
        style={[
          styles.bottomPanel,
          {
            paddingBottom: Math.max(
              insets.bottom,
              12,
            ),
          },
        ]}
      >
        <View style={styles.summaryContainer}>
          <View style={styles.summaryRow}>
            <Text
              allowFontScaling={false}
              style={styles.summaryLabel}
            >
              클립 개수
            </Text>

            <Text
              allowFontScaling={false}
              style={styles.summaryValue}
            >
              {clips.length}개
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text
              allowFontScaling={false}
              style={styles.summaryLabel}
            >
              총 영상 길이
            </Text>

            <Text
              allowFontScaling={false}
              style={styles.summaryValue}
            >
              {formatTotalDuration(totalDuration)}
            </Text>
          </View>
        </View>

        <Pressable
          disabled={clips.length === 0}
          onPress={handleCreateVideo}
          style={({ pressed }) => [
            styles.createButton,
            clips.length === 0 &&
              styles.createButtonDisabled,
            pressed &&
              clips.length > 0 &&
              styles.createButtonPressed,
          ]}
        >
          <Ionicons
            name="sparkles-outline"
            size={18}
            color="#FFFFFF"
          />

          <Text
            allowFontScaling={false}
            style={styles.createButtonText}
          >
            영상 만들기
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  header: {
    minHeight: 92,
    paddingHorizontal: 18,
    paddingBottom: 14,

    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',

    backgroundColor: COLORS.background,
  },

  headerButton: {
    width: 48,
    height: 42,

    alignItems: 'center',
    justifyContent: 'center',
  },

  headerTitle: {
    paddingBottom: 10,

    color: COLORS.textPrimary,

    fontSize: 19,
    lineHeight: 25,
    fontWeight: '800',

    letterSpacing: -0.4,
  },

  editButtonText: {
    color: COLORS.primary,

    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700',
  },

  listContent: {
    flexGrow: 1,

    paddingHorizontal: 20,
    paddingTop: 8,
  },

  introduction: {
    marginBottom: 22,
    paddingHorizontal: 4,
  },

  introductionTitle: {
    color: COLORS.textPrimary,

    fontSize: 18,
    lineHeight: 25,
    fontWeight: '800',

    letterSpacing: -0.4,
  },

  introductionDescription: {
    marginTop: 6,

    color: COLORS.textSecondary,

    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },

  clipRow: {
    position: 'relative',

    flexDirection: 'row',
    alignItems: 'center',

    paddingLeft: 14,
    marginBottom: 14,
  },

  clipRowActive: {
    zIndex: 20,
  },

  orderBadge: {
    position: 'absolute',
    left: 0,
    zIndex: 2,

    width: 28,
    height: 28,

    borderRadius: 14,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor: '#FFB46F',

    borderWidth: 3,
    borderColor: COLORS.background,
  },

  orderBadgeActive: {
    backgroundColor: COLORS.primary,

    transform: [{ scale: 1.08 }],
  },

  orderBadgeText: {
    color: '#FFFFFF',

    fontSize: 12,
    lineHeight: 15,
    fontWeight: '800',
  },

  clipCard: {
    flex: 1,
    minHeight: 132,

    padding: 12,
    paddingLeft: 14,

    flexDirection: 'row',
    alignItems: 'center',

    backgroundColor: COLORS.card,

    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,

    shadowColor: COLORS.shadow,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.06,
    shadowRadius: 10,

    elevation: 2,
  },

  clipCardPressed: {
    opacity: 0.85,

    transform: [{ scale: 0.995 }],
  },

  clipCardActive: {
    borderColor: COLORS.primary,

    shadowColor: COLORS.primary,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.22,
    shadowRadius: 16,

    elevation: 12,
  },

  thumbnailContainer: {
    position: 'relative',

    width: 82,
    height: 106,

    borderRadius: 14,

    overflow: 'hidden',

    backgroundColor: '#E8E5DF',
  },

  thumbnail: {
    width: '100%',
    height: '100%',
  },

  thumbnailDim: {
    ...StyleSheet.absoluteFillObject,

    backgroundColor: 'rgba(0,0,0,0.12)',
  },

  playButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',

    width: 38,
    height: 38,

    marginTop: -19,
    marginLeft: -19,

    borderRadius: 19,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor: 'rgba(36,36,32,0.58)',

    borderWidth: 1,
    borderColor:
      'rgba(255,255,255,0.32)',
  },

  playIcon: {
    marginLeft: 2,
  },

  clipInformation: {
    flex: 1,

    marginLeft: 14,
    paddingRight: 8,
  },

  clipTitle: {
    color: COLORS.textPrimary,

    fontSize: 15,
    lineHeight: 21,
    fontWeight: '800',

    letterSpacing: -0.3,
  },

  recordedAt: {
    marginTop: 8,

    color: COLORS.textSecondary,

    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },

  durationRow: {
    marginTop: 6,

    flexDirection: 'row',
    alignItems: 'center',

    gap: 4,
  },

  durationText: {
    color: COLORS.textSecondary,

    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },

  dragHandle: {
    width: 40,
    height: 52,

    borderRadius: 13,

    alignItems: 'center',
    justifyContent: 'center',
  },

  dragHandlePressed: {
    backgroundColor: COLORS.primarySoft,
  },

  dragHandleActive: {
    backgroundColor: COLORS.primarySoft,
  },

  deleteButton: {
    width: 40,
    height: 52,

    alignItems: 'center',
    justifyContent: 'center',
  },
emptyContainer: {
  flex: 1,

  minHeight: 480,

  paddingHorizontal: 24,
  paddingTop: 80,

  alignItems: 'center',
  justifyContent: 'center',
},

emptyIconContainer: {
  width: 72,
  height: 72,
  borderRadius: 36,

  alignItems: 'center',
  justifyContent: 'center',

  backgroundColor: '#FFE1C8',
},

emptyTitle: {
  marginTop: 24,

  fontSize: 20,
  fontWeight: '800',

  color: COLORS.textPrimary,
},

emptyDescription: {
  marginTop: 10,

  color: COLORS.textSecondary,

  fontSize: 14,
  lineHeight: 22,

  textAlign: 'center',
},

  bottomPanel: {
    position: 'absolute',
    left: 0,
    right: 0,

    // 하단 탭바 높이만큼 위에 배치
    bottom: 78,

    minHeight: 108,

    paddingHorizontal: 20,
    paddingTop: 14,

    flexDirection: 'row',
    alignItems: 'center',

    backgroundColor: COLORS.card,

    borderTopWidth: 1,
    borderTopColor: COLORS.divider,

    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.05,
    shadowRadius: 10,

    elevation: 8,
  },

  summaryContainer: {
    flex: 1,

    gap: 7,
  },

  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',

    gap: 12,
  },

  summaryLabel: {
    width: 72,

    color: COLORS.textSecondary,

    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },

  summaryValue: {
    color: COLORS.textPrimary,

    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },

  createButton: {
    minWidth: 132,
    height: 52,

    paddingHorizontal: 18,

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',

    gap: 7,

    borderRadius: 16,

    backgroundColor: COLORS.primary,

    shadowColor: COLORS.primary,
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.24,
    shadowRadius: 9,

    elevation: 5,
  },

  createButtonPressed: {
    opacity: 0.85,

    transform: [{ scale: 0.98 }],
  },

  createButtonDisabled: {
    backgroundColor: '#D8D5CF',

    shadowOpacity: 0,
    elevation: 0,
  },

  createButtonText: {
    color: '#FFFFFF',

    fontSize: 14,
    lineHeight: 19,
    fontWeight: '800',
  },
captureButton: {
  marginTop: 34,

  width: 170,
  height: 50,

  borderRadius: 25,

  backgroundColor: COLORS.primary,

  alignItems: 'center',
  justifyContent: 'center',

  flexDirection: 'row',

  gap: 8,

  shadowColor: COLORS.primary,
  shadowOpacity: 0.18,
  shadowRadius: 8,
  shadowOffset: {
    width: 0,
    height: 4,
  },
},

captureButtonPressed: {
  opacity: 0.82,
  transform: [{ scale: 0.98 }],
},

captureButtonText: {
  color: '#FFFFFF',
  fontSize: 14,
  lineHeight: 19,
  fontWeight: '800',
},

});