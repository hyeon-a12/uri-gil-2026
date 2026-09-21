import React, { useMemo, useState, useCallback } from 'react';
import {
  Platform,
  Pressable,
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
import * as MediaLibrary from 'expo-media-library/legacy';

import { ClipPreviewModal } from '@/components/ClipPreview/ClipPreviewModal'
import { HapticPressable, ScreenHeader } from '@/components/common';
import { deleteRecording } from '@/services/recordingService';
import { getMergedRecordingsByFolder } from '@/services/spotSyncService';
import { useTripStore } from '@/store/useTripStore';
import { ClipItem } from '@/types/home';
import { COLORS as SHARED_COLORS, RADIUS, SPACING } from '@/constants/color';
import { apiFetch } from '@/services/api';
import { showAlert } from '@/services/webAlert';

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

const FOOTER_HEIGHT = 103;

// getMergedRecordingsByFolder()가 다른 기기에서 촬영된 클립을 만들 때 쓰는 id
// 접두사와 동일합니다(spotSyncService.ts 참고). video-edit.tsx가 이제 이런
// 클립도 다운로드해서 영상 합치기에 포함하지만, 체크박스에 작은 구름 아이콘을
// 얹어 "이 기기에서 찍은 게 아니다"라는 걸 구분해서 보여줍니다.
const REMOTE_ONLY_CLIP_PREFIX = 'server_';
function isRemoteOnlyClip(id: string): boolean {
  return id.startsWith(REMOTE_ONLY_CLIP_PREFIX);
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(
    remainingSeconds,
  ).padStart(2, '0')}`;
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
      const records = await getMergedRecordingsByFolder(folderId);
      const items: ClipItem[] = records.map((r) => ({
        id: r.id,
        serverId: r.serverId,
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
    const isRemoteOnly = isRemoteOnlyClip(item.id);
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
          ) : isRemoteOnly ? (
            <Ionicons name="cloud-outline" size={14} color={COLORS.textTertiary} />
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
            {item.thumbnail ? (
              <Image source={{ uri: item.thumbnail }} style={styles.thumbnail} />
            ) : null}
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

  showAlert(
    '다운로드',
    Platform.OS === 'web'
      ? `${targetClip.title} 영상을 다운로드할까요?`
      : `${targetClip.title} 영상을 갤러리에 저장할까요?`,
    [
      { text: '취소', style: 'cancel' },
      {
        text: '저장',
        onPress: async () => {
          if (!targetClip.uri) return;

          if (Platform.OS === 'web') {
            try {
              const link = document.createElement('a');
              link.href = targetClip.uri;
              link.download = `${targetClip.title || 'urigil-clip'}.webm`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            } catch (error) {
              console.error('[handleDownloadClip:web] 실패:', error);
              showAlert('다운로드 실패', '잠시 후 다시 시도해주세요.');
            }
            return;
          }

          try {
            const { status } = await MediaLibrary.requestPermissionsAsync(true);
            if (status !== 'granted') {
              showAlert('권한 필요', '갤러리 접근 권한이 필요합니다.');
              return;
            }

            await MediaLibrary.saveToLibraryAsync(targetClip.uri);
            showAlert('저장 완료', '갤러리에 저장되었습니다.');
          } catch (error) {
            console.error('[handleDownloadClip] 실패:', error);
            showAlert('저장 실패', '갤러리에 저장 중 문제가 발생했습니다.');
          }
        },
      },
    ],
  );
};

  const runDeleteClip = async (targetClip: ClipItem) => {
    try {
      await deleteRecording(targetClip.id);

      // 서버에도 삭제 반영 시도 (실패해도 로컬 삭제는 이미 끝났으니 무시)
      if (targetClip.serverId) {
        try {
          await apiFetch(`/clips/${targetClip.serverId}`, {
            method: 'DELETE',
          });
        } catch (serverError) {
          console.error('[handleDelete] 서버 클립 삭제 실패:', serverError);
        }
      } else {
        console.warn('[handleDelete] serverId가 없어 서버 삭제를 건너뜁니다.');
      }

      setClips((prev) => prev.filter((c) => c.id !== targetClip.id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(targetClip.id);
        return next;
      });
    } catch (error) {
      console.error('[handleDelete] 실패:', error);
      showAlert('삭제 실패');
    }
  };

  const handleDelete = () => {
  if (!selectedMenuClip) return;
  const targetClip = selectedMenuClip;
  setSelectedMenuClip(null);

  showAlert(
    '클립 삭제',
    `${targetClip.title} 클립을 삭제할까요?`,
    [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () => void runDeleteClip(targetClip),
      },
    ],
  );
};

  const handleComplete = () => {
  if (selectedCount === 0) {
    showAlert(
      '선택된 클립이 없습니다',
      '영상에 사용할 클립을 한 개 이상 선택해주세요.',
    );
    return;
  }

  showAlert(
    '클립 선택 완료',
    `${selectedCount}개의 클립으로 영상을 생성할까요?`,
    [
      { text: '취소', style: 'cancel' },
      {
        text: '생성하기',
        onPress: () => {
          const clipIdList = selectedClips.map((clip) => clip.id).join(',');

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
      <ScreenHeader title="클립 선택" fallbackHref="/(tabs)/clip-manage" />

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
          {
            paddingBottom:
              FOOTER_HEIGHT +
              insets.bottom +
              16 +
              (Platform.OS === 'web' ? SPACING.md : 0),
          },
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

      <View
        style={[
          styles.footer,
          Platform.OS === 'web' && styles.footerWeb,
          { paddingBottom: insets.bottom },
        ]}
      >
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

        <HapticPressable
          style={[
            styles.createButton,
            Platform.OS === 'web' && styles.createButtonWeb,
            selectedCount === 0 && styles.createButtonDisabled,
          ]}
          disabled={selectedCount === 0}
          onPress={handleComplete}
        >
          <Text style={styles.createButtonText}>영상 생성</Text>
        </HapticPressable>
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
    ...StyleSheet.absoluteFill,
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
  // 웹에서는 바닥에 붙는 바 대신 여백을 두고 뜬 카드 형태로 보이도록,
  // 테두리선을 없애고 둥근 모서리 + 좌우/하단 여백을 줍니다.
  footerWeb: {
    left: SPACING.md,
    right: SPACING.md,
    bottom: SPACING.md,
    minHeight: 80,
    borderRadius: RADIUS.banner,
    borderTopWidth: 0,
    paddingTop: SPACING.sm,
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
  // 플로팅 카드가 낮아진 만큼 버튼 세로 크기도 같이 줄입니다.
  createButtonWeb: {
    paddingVertical: 11,
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
