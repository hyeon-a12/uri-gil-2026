import React, { useMemo, useState, useCallback } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  TouchableOpacity,
  FlatList,
  Image,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import { AppText as Text } from '@/components/AppText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as MediaLibrary from 'expo-media-library';

import { ClipPreviewModal } from '@/components/ClipPreview/ClipPreviewModal'
import { deleteRecording, getRecordingsByFolder } from '@/services/recordingService';
import { useTripStore } from '@/store/useTripStore';
import { ClipItem } from '@/types/home';
import { COLORS as SHARED_COLORS, RADIUS, SPACING } from '@/constants/color';

const COLORS = {
  background: SHARED_COLORS.background,
  card: SHARED_COLORS.background,

  primary: SHARED_COLORS.accent,
  primaryPressed: SHARED_COLORS.accentPressed,
  primarySoft: SHARED_COLORS.main,

  textPrimary: SHARED_COLORS.textPrimary,
  textSecondary: SHARED_COLORS.textSecondary,
  textTertiary: SHARED_COLORS.textSecondary,

  border: SHARED_COLORS.border,
  divider: SHARED_COLORS.border,

  unchecked: '#B5B5AF',
  delete: SHARED_COLORS.danger,
  shadow: SHARED_COLORS.shadow,
  disabled: '#D8D5CF',

  overlay: 'rgba(0,0,0,0.25)',
};

const FOOTER_HEIGHT = 88;

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
            source={{ uri: clip.uri }}
            style={styles.thumbnail}
            resizeMode="cover"
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
              {formatDuration(clip.durationSeconds ?? 0)}
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
  const router = useRouter();
  const { id: paramFolderId, title: paramFolderTitle } = useLocalSearchParams<{
    id?: string;
    title?: string;
  }>();

  const currentTrip = useTripStore((state) => state.currentTrip);
  const folderId = paramFolderId ?? currentTrip?.id;
  const folderTitle = paramFolderTitle ?? currentTrip?.title;

  const [clips, setClips] = useState<ClipItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedMenuClip, setSelectedMenuClip] = useState<ClipItem | null>(null);

  const [previewClip, setPreviewClip] = useState<ClipItem | null>(null);

  const loadClips = useCallback(async () => {
    if (!folderId) {
      setClips([]);
      return;
    }

    try {
      const records = await getRecordingsByFolder(folderId);
      const items: ClipItem[] = records.map((r) => ({
        id: r.id,
        title: r.location.placeName ?? "제목 없음",
        recordedAt: r.recordedAt,
        durationSeconds: Math.floor((r.durationMs ?? 0) / 1000),
        thumbnail: r.thumbnail,
        uri: r.videoUri,
      }));
      setClips(items);
    } catch (error) {
      console.error('[loadClips] 로딩 실패:', error);
      setClips([]);
    }
  }, [folderId]);

  useFocusEffect(
    useCallback(() => {
      void loadClips();
    }, [loadClips]),
  );


  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${yyyy}.${mm}.${dd} ${hh}:${min}`;
  };

  const selectedClips = useMemo(
    () => clips.filter((c) => selectedIds.has(c.id)),
    [clips, selectedIds],
  );

  const totalCount = clips.length;
  const totalSeconds = clips.reduce(
    (sum, clip) => sum + (clip.durationSeconds ?? 0),
    0,
  );
  const selectedCount = selectedClips.length;
  const selectedSeconds = selectedClips.reduce(
    (sum, clip) => sum + (clip.durationSeconds ?? 0),
    0,
  );
  const allSelected = clips.length > 0 && selectedCount === totalCount;

  const renderSingleClip = (item: ClipItem) => {
    const isSelected = selectedIds.has(item.id);
    return (
      <View style={styles.clipItemContainer}>
        <TouchableOpacity
          style={[
            styles.badgeCheck,
            isSelected ? styles.badgeCheckActive : styles.badgeCheckInactive,
          ]}
          onPress={() => toggleSelect(item.id)}>
          {isSelected ? (
            <Ionicons name="checkmark" size={16} color="#FFFFFF" />
          ) : null}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.card}
          activeOpacity={1}
          onPress={() => toggleSelect(item.id)}
        >
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              setPreviewClip(item);
            }}
            style={styles.thumbnailContainer}
          >
            <Image source={{ uri: item.uri }} style={styles.thumbnail} />
            <View style={styles.playOverlay}>
              <Ionicons name="play" size={16} color="#FFFFFF" />
            </View>
          </Pressable>

          <View style={styles.cardInfo}>
            <Text style={styles.clipTitle} numberOfLines={1}>
              {item.title ?? '제목 없음'}
            </Text>
            <Text style={styles.clipDate}>{formatDate(item.recordedAt)}</Text>
            <View style={styles.durationRow}>
              <MaterialCommunityIcons
                name="clock-outline"
                size={12}
                color={ COLORS?.textSecondary || '#8E8E93' }
              />
              <Text style={styles.durationText}>
                {formatDuration(item.durationSeconds ?? 0)}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.dragHandle}
            hitSlop={10}
            onPress={(e) => {
              e.stopPropagation();
              setSelectedMenuClip(item);
            }}
          >
            <Feather name="more-vertical" size={20} color={COLORS.textTertiary} />
          </TouchableOpacity>
        </TouchableOpacity>
      </View>
    );
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
      return;
    }

    setSelectedIds(new Set(clips.map((clip) => clip.id)));
  };

  const handleDownloadClip = () => {
    if (!selectedMenuClip) return;
    const targetClip = selectedMenuClip;
    setSelectedMenuClip(null);

    Alert.alert(
      '다운로드',
      `${targetClip.title} 영상을 갤러리에 저장할까요?`,
      [
        {text: '취소', style: 'cancel'},
        {text: '저장', onPress: async () => {
          try {
            const {status} = await MediaLibrary.requestPermissionsAsync(true);
            if (status !== 'granted') {
              Alert.alert('권한 필요', '갤러리 접근 권한이 필요합니다.');
              return;
            }

            if (!targetClip.uri) return;
            await MediaLibrary.saveToLibraryAsync(targetClip.uri);
            Alert.alert('저장 완료', '갤러리에 저장되었습니다.');
          } catch (error) {
            console.error('[handleDownloadClip] 실패:', error);
            Alert.alert('저장 실패', '갤러리에 저장 중 문제가 발생했습니다.');
            }
          },
        },
      ],
    );
  };

  const handleCancel = () => {
    setSelectedIds(new Set());
    router.back();
  };

  const handleDelete = () => {
    if (!selectedMenuClip) return;
    const targetClip = selectedMenuClip;
    setSelectedMenuClip(null);

    Alert.alert(
      '클립 삭제',
      `${targetClip.title} 클립을 삭제할까요?`,
      [
        {text: '취소', style: 'cancel'},
        {
          text: '삭제', style: 'destructive', onPress: async () => {
            try {
              await deleteRecording(targetClip.id);
              setClips((prev) => prev.filter((c) => c.id !== targetClip.id));
              setSelectedIds((prev) => {
                const next = new Set(prev);
                next.delete(targetClip.id);
                return next;
              });
            } catch (error) {
              console.error('[handleDelete] 실패:', error);
              Alert.alert(
                '삭제 실패',
              );
            }
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
      `${selectedCount}개의 클립으로 영상을 생성할까요?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '생성하기',
          onPress: () => {
            const clipIdList = selectedClips
              .map((clip) => clip.id)
              .join(',');
            
            router.push({
              pathname: '/video-edit',
              params: {
                clipIds: clipIdList,
                folderId: folderId,
              },
            });
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
          클립 선택
        </Text>

        {/* 뒤로가기 버튼과의 좌우 균형을 위한 빈 자리 */}
        <View style={styles.headerButton} />
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
      </View>

      <FlatList
        data={clips}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => renderSingleClip(item)}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: FOOTER_HEIGHT + insets.bottom + 16 },
        ]}
      />

      {/* FlatList의 ListEmptyComponent는 콘텐츠 높이만큼만 차지해서 화면 중앙에 오지
          않으므로, 화면 전체를 덮는 절대 위치 오버레이로 따로 그립니다. */}
      {clips.length === 0 && (
        <View style={styles.emptyContainer} pointerEvents="none">
          <Ionicons name="videocam-outline" size={32} color={COLORS.textTertiary} />
          <Text style={styles.emptyText}>아직 촬영한 클립이 없어요</Text>
          <Text style={styles.emptySubText}>
            {folderTitle
              ? `${folderTitle}에서 촬영한 클립이 없어요. 카메라로 첫 클립을 남겨보세요.`
              : '카메라로 촬영해서 클립을 추가해보세요.'}
          </Text>
        </View>
      )}

      <View style={[styles.footer, { paddingBottom: insets.bottom }]}>
        <View style={styles.footerInfo}>
          <View style={styles.footerRow}>
            <Text style={styles.footerLabel}>클립 개수</Text>
            <Text style={styles.footerValue}>
              {selectedCount} / {totalCount} 개
            </Text>
          </View>
          <View style={styles.footerRow}>
            <Text style={styles.footerLabel}>총 영상 길이</Text>
            <Text style={styles.footerValue}>
              {selectedSeconds} / {totalSeconds} 초
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.createButton,
            selectedCount === 0 && styles.createButtonDisabled,
          ]}
          disabled={selectedCount === 0}
          onPress={handleComplete}>
            <Text style={styles.createButtonText}>영상 생성</Text>
          </TouchableOpacity>
      </View>

      <Modal
        visible={!!selectedMenuClip}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedMenuClip(null)}
      >
        <TouchableWithoutFeedback onPress={() => setSelectedMenuClip(null)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.menuBox}>
                <TouchableOpacity
                  style={styles.menuItem}
                  activeOpacity={0.7}
                  onPress={handleDownloadClip}
                >
                  <Ionicons
                    name='download-outline'
                    size={20}
                    color={COLORS.textPrimary}
                  />
                  <Text style={styles.menuText}>다운로드</Text>
                </TouchableOpacity>

                <View style={styles.menuDivider} />

                <TouchableOpacity
                  style={styles.menuItem}
                  activeOpacity={0.7}
                  onPress={handleDelete}
                >
                  <Ionicons
                    name="trash-outline"
                    size={20}
                    color={COLORS.delete}
                  />
                  <Text style={[styles.menuText, styles.menuTextDelete]}>
                    삭제하기
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <ClipPreviewModal
        clip={previewClip}
        onClose={() => setPreviewClip(null)}
      />
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
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,

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
    paddingBottom: SPACING.sm,

    color: COLORS.textPrimary,

    fontSize: 19,
    lineHeight: 25,
    fontWeight: '700',

    letterSpacing: -0.4,
  },
  selectionToolbar: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xs,
    paddingBottom: SPACING.md,

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  toolbarButtonText: {
    color: COLORS.primary,

    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },

  scrollContent: {
    paddingHorizontal: SPACING.screenH,
    paddingTop: SPACING.xs,
  },

  clipRow: {
    flexDirection: 'row',
    alignItems: 'center',

    marginBottom: SPACING.md,
  },

  selectionButton: {
    width: 26,
    height: 26,

    marginRight: SPACING.sm,

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

    padding: SPACING.sm,

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
    marginLeft: SPACING.xs,
  },

  clipInformation: {
    flex: 1,

    marginLeft: SPACING.md,
    marginRight: SPACING.sm,
  },

  recordedAt: {
    marginTop: SPACING.sm,

    color: COLORS.textSecondary,

    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
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
    marginTop: SPACING.md,

    color: COLORS.textPrimary,

    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
  },

  emptyDescription: {
    marginTop: SPACING.xs,

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

    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,

    flexDirection: 'row',
    alignItems: 'center',

    gap: SPACING.sm,

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

    gap: SPACING.sm,

    borderRadius: RADIUS.card,
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

    gap: SPACING.xs,

    borderRadius: RADIUS.card,
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

    borderRadius: RADIUS.card,

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
  editText: {
    fontSize: 15,
    color: COLORS.primary,
    fontWeight: '600',
  },
  subHeader: {
    paddingVertical: SPACING.md,
    alignItems: 'center',
    gap: SPACING.sm,
  },
  description: {
    fontSize: 13,
    color: '#8E8E93',
  },
  addVideoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.banner,
    backgroundColor: COLORS.primaryPressed,
  },
  addVideoText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  listContent: {
    paddingHorizontal: SPACING.md,
  },
  clipItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  badgeCheck: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
    borderWidth: 1.5,
  },
  badgeCheckActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  badgeCheckInactive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D1D1D6',
  },
  card: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.card,
    padding: SPACING.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1},
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  thumbnailContainer: {
    position: 'relative',
    width: 60,
    height: 60,
    borderRadius: RADIUS.badge,
    overflow: 'hidden',
    backgroundColor: '#E5E5EA',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardInfo: {
    flex: 1,
    marginLeft: SPACING.sm,
  },
  clipTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: SPACING.xs,
  },
  clipDate: {
    fontSize: 12,
    color: '#AEAEB2',
    marginBottom: SPACING.xs,
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  durationText: {
    fontSize: 11,
    color: '#AEAEB2',
  },
  dragHandle: {
    padding: SPACING.sm,
  },
  // 헤더/툴바 아래 남은 공간이 아니라 화면 전체 높이 기준 정중앙에 오도록 절대 위치로 겹칩니다.
  emptyContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: SPACING.sm,
  },
  emptyText: {
    marginTop: SPACING.xs,
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  emptySubText: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: FOOTER_HEIGHT,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.screenH,
    paddingTop: SPACING.md,
  },
  footerInfo: {
    flex: 1,
    gap: SPACING.xs,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  footerLabel: {
    fontSize: 13,
    color: '#1C1C1E',
    width: 72,
  },
  footerValue: {
    fontSize: 13,
    color: '#1C1C1E',
    fontWeight: '500',
  },
  createButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.card,
  },
  createButtonDisabled: {
    backgroundColor: '#FFB8A4',
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuBox: {
    width: 220,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.banner,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.badge,
    gap: SPACING.sm,
  },
  menuDivider: {
    height: 1,
    backgroundColor: COLORS.divider,
    marginHorizontal: SPACING.sm,
    marginVertical: SPACING.xs,
  },
  menuText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  menuTextDelete: {
    color: COLORS.delete,
  },
});
