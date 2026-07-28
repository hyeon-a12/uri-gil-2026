import React, { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const COLORS = {
  background: '#FAF8F1',
  card: '#FFFFFF',

  primary: '#F99B30',
  primaryPressed: '#ED8A20',
  primarySoft: '#FFF1E4',

  textPrimary: '#262621',
  textSecondary: '#8A8A82',
  textTertiary: '#AAA9A2',

  border: '#ECE9E1',
  divider: '#F1EEE8',

  unchecked: '#B5B5AF',
  delete: '#E46F61',
  shadow: '#4B4138',
};

interface ClipItem {
  id: string;
  title: string;
  recordedAt: string;
  durationSeconds: number;
  thumbnail: string;
}

const INITIAL_CLIPS: ClipItem[] = [
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

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(
    remainingSeconds,
  ).padStart(2, '0')}`;
}

interface SelectionButtonProps {
  selected: boolean;
  onPress: () => void;
}

function SelectionButton({
  selected,
  onPress,
}: SelectionButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      style={({ pressed }) => [
        styles.selectionButton,
        selected && styles.selectionButtonSelected,
        pressed && styles.selectionButtonPressed,
      ]}
    >
      {selected && (
        <Ionicons
          name="checkmark"
          size={18}
          color="#FFFFFF"
        />
      )}
    </Pressable>
  );
}

interface ClipSelectionCardProps {
  clip: ClipItem;
  selected: boolean;
  onToggle: () => void;
}

function ClipSelectionCard({
  clip,
  selected,
  onToggle,
}: ClipSelectionCardProps) {
  return (
    <View style={styles.clipRow}>
      <SelectionButton
        selected={selected}
        onPress={onToggle}
      />

      <Pressable
        onPress={onToggle}
        style={({ pressed }) => [
          styles.clipCard,
          selected && styles.clipCardSelected,
          pressed && styles.clipCardPressed,
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

        <Ionicons
          name="reorder-three-outline"
          size={28}
          color={COLORS.textTertiary}
        />
      </Pressable>
    </View>
  );
}

export default function ClipSelectScreen() {
  const insets = useSafeAreaInsets();

  const [clips, setClips] =
    useState<ClipItem[]>(INITIAL_CLIPS);

  const [selectedIds, setSelectedIds] = useState<string[]>(
    ['2', '3'],
  );

  const selectedCount = selectedIds.length;

  const allSelected =
    clips.length > 0 && selectedCount === clips.length;

  const selectedClips = useMemo(
    () =>
      clips.filter((clip) =>
        selectedIds.includes(clip.id),
      ),
    [clips, selectedIds],
  );

  const toggleClip = (clipId: string) => {
    setSelectedIds((currentIds) => {
      if (currentIds.includes(clipId)) {
        return currentIds.filter(
          (selectedId) => selectedId !== clipId,
        );
      }

      return [...currentIds, clipId];
    });
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([]);
      return;
    }

    setSelectedIds(clips.map((clip) => clip.id));
  };

  const handleCancel = () => {
    setSelectedIds([]);
    router.back();
  };

  const handleDelete = () => {
    if (selectedCount === 0) {
      Alert.alert(
        '선택된 클립이 없습니다',
        '삭제할 클립을 한 개 이상 선택해주세요.',
      );

      return;
    }

    Alert.alert(
      '선택한 클립 삭제',
      `${selectedCount}개의 클립을 삭제할까요?`,
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
                (clip) =>
                  !selectedIds.includes(clip.id),
              ),
            );

            setSelectedIds([]);
          },
        },
      ],
    );
  };

  const handleComplete = () => {
    if (selectedCount === 0) {
      Alert.alert(
        '선택된 클립이 없습니다',
        '영상에 사용할 클립을 한 개 이상 선택해주세요.',
      );

      return;
    }

    Alert.alert(
      '클립 선택 완료',
      `${selectedCount}개의 클립으로 영상을 만들까요?`,
      [
        {
          text: '취소',
          style: 'cancel',
        },
        {
          text: '영상 만들기',
          onPress: () => {
            console.log(
              '선택된 클립:',
              selectedClips.map((clip) => clip.id),
            );

            Alert.alert(
              '영상 만들기',
              '영상 생성 화면으로 연결할 예정입니다.',
            );

            // 영상 생성 화면이 있으면 아래처럼 연결
            // router.push({
            //   pathname: '/video-create',
            //   params: {
            //     clipIds: selectedIds.join(','),
            //   },
            // });
          },
        },
      ],
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
          style={styles.headerSideButton}
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
          클립 선택
        </Text>

        <View style={styles.headerSideButton} />
      </View>

      <View style={styles.selectionToolbar}>
        <Pressable
          hitSlop={10}
          onPress={toggleSelectAll}
        >
          <Text
            allowFontScaling={false}
            style={styles.toolbarButtonText}
          >
            {allSelected ? '전체 해제' : '전체 선택'}
          </Text>
        </Pressable>

        <Pressable
          hitSlop={10}
          onPress={handleCancel}
        >
          <Text
            allowFontScaling={false}
            style={styles.toolbarButtonText}
          >
            취소
          </Text>
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom: insets.bottom + 120,
          },
        ]}
      >
        {clips.length > 0 ? (
          clips.map((clip) => (
            <ClipSelectionCard
              key={clip.id}
              clip={clip}
              selected={selectedIds.includes(clip.id)}
              onToggle={() => toggleClip(clip.id)}
            />
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <Ionicons
                name="videocam-outline"
                size={34}
                color={COLORS.primary}
              />
            </View>

            <Text
              allowFontScaling={false}
              style={styles.emptyTitle}
            >
              선택할 클립이 없습니다
            </Text>

            <Text
              allowFontScaling={false}
              style={styles.emptyDescription}
            >
              먼저 여행 클립을 촬영해주세요.
            </Text>
          </View>
        )}
      </ScrollView>

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
        <View style={styles.selectedCountBox}>
          <Text
            allowFontScaling={false}
            style={styles.selectedCountLabel}
          >
            선택
          </Text>

          <Text
            allowFontScaling={false}
            style={styles.selectedCountValue}
          >
            {selectedCount}개
          </Text>
        </View>

        <Pressable
          disabled={selectedCount === 0}
          onPress={handleDelete}
          style={({ pressed }) => [
            styles.deleteButton,
            selectedCount === 0 &&
              styles.secondaryButtonDisabled,
            pressed &&
              selectedCount > 0 &&
              styles.secondaryButtonPressed,
          ]}
        >
          <Ionicons
            name="trash-outline"
            size={19}
            color={
              selectedCount > 0
                ? COLORS.delete
                : COLORS.textTertiary
            }
          />

          <Text
            allowFontScaling={false}
            style={[
              styles.deleteButtonText,
              selectedCount === 0 &&
                styles.disabledButtonText,
            ]}
          >
            삭제
          </Text>
        </Pressable>

        <Pressable
          disabled={selectedCount === 0}
          onPress={handleComplete}
          style={({ pressed }) => [
            styles.completeButton,
            selectedCount === 0 &&
              styles.completeButtonDisabled,
            pressed &&
              selectedCount > 0 &&
              styles.completeButtonPressed,
          ]}
        >
          <Text
            allowFontScaling={false}
            style={styles.completeButtonText}
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

  headerSideButton: {
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

  selectionToolbar: {
    paddingHorizontal: 22,
    paddingTop: 4,
    paddingBottom: 14,

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  toolbarButtonText: {
    color: COLORS.primary,

    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },

  clipRow: {
    flexDirection: 'row',
    alignItems: 'center',

    marginBottom: 14,
  },

  selectionButton: {
    width: 26,
    height: 26,

    marginRight: 12,

    borderRadius: 13,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor: COLORS.card,

    borderWidth: 1.5,
    borderColor: COLORS.unchecked,
  },

  selectionButtonSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },

  selectionButtonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },

  clipCard: {
    flex: 1,
    minHeight: 132,

    padding: 12,

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
    shadowOpacity: 0.05,
    shadowRadius: 9,

    elevation: 2,
  },

  clipCardSelected: {
    borderColor: COLORS.primary,

    backgroundColor: '#FFFDFC',
  },

  clipCardPressed: {
    opacity: 0.86,

    transform: [{ scale: 0.995 }],
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
    borderColor: 'rgba(255,255,255,0.32)',
  },

  playIcon: {
    marginLeft: 2,
  },

  clipInformation: {
    flex: 1,

    marginLeft: 14,
    marginRight: 8,
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

  emptyContainer: {
    marginTop: 50,
    paddingVertical: 56,

    alignItems: 'center',

    backgroundColor: COLORS.card,

    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  emptyIconContainer: {
    width: 64,
    height: 64,

    borderRadius: 32,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor: COLORS.primarySoft,
  },

  emptyTitle: {
    marginTop: 18,

    color: COLORS.textPrimary,

    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
  },

  emptyDescription: {
    marginTop: 6,

    color: COLORS.textSecondary,

    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },

  bottomPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,

    minHeight: 88,

    paddingHorizontal: 14,
    paddingTop: 12,

    flexDirection: 'row',
    alignItems: 'center',

    gap: 8,

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

    elevation: 10,
  },

  selectedCountBox: {
    height: 48,
    minWidth: 82,

    paddingHorizontal: 13,

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',

    gap: 7,

    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,

    backgroundColor: COLORS.card,
  },

  selectedCountLabel: {
    color: COLORS.textSecondary,

    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },

  selectedCountValue: {
    color: COLORS.textPrimary,

    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },

  deleteButton: {
    height: 48,
    minWidth: 82,

    paddingHorizontal: 13,

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',

    gap: 6,

    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,

    backgroundColor: COLORS.card,
  },

  deleteButtonText: {
    color: COLORS.delete,

    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },

  completeButton: {
    flex: 1,
    height: 48,

    alignItems: 'center',
    justifyContent: 'center',

    borderRadius: 14,

    backgroundColor: COLORS.primary,

    shadowColor: COLORS.primary,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 7,

    elevation: 4,
  },

  completeButtonPressed: {
    backgroundColor: COLORS.primaryPressed,

    transform: [{ scale: 0.985 }],
  },

  completeButtonDisabled: {
    backgroundColor: '#D8D5CF',

    shadowOpacity: 0,
    elevation: 0,
  },

  completeButtonText: {
    color: '#FFFFFF',

    fontSize: 14,
    lineHeight: 19,
    fontWeight: '800',
  },

  secondaryButtonPressed: {
    opacity: 0.65,
  },

  secondaryButtonDisabled: {
    backgroundColor: '#F7F5F1',
  },

  disabledButtonText: {
    color: COLORS.textTertiary,
  },
});