import React, { useMemo, useState, useCallback } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  Image,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as MediaLibrary from 'expo-media-library';

import { deleteRecording, getRecordingsByFolder } from '@/services/recordingService';
import { useTripStore } from '@/store/useTripStore';
import { COLORS as SHARED_COLORS } from '@/constants/color';

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

interface ClipItem {
  id: string;
  title: string;
  recordedAt: string;
  durationSeconds: number;
  thumbnail: string;
  uri: string;
}

const FOOTER_HEIGHT = 88;

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
  const { id: paramFolderId } = useLocalSearchParams<{
    id?: string;
  }>();

  // 명시적 route param(clip-manage.tsx에서 폴더를 눌러 들어온 경우)이 있으면 그게
  // 우선이고, 파라미터 없이(예: navigateToClip() 호출부에서 folderId를 안 넘긴 경우)
  // 들어온 경우엔 현재 활성 여행을 기본값으로 씁니다.
  const currentTrip = useTripStore((state) => state.currentTrip);
  const folderId = paramFolderId ?? currentTrip?.id;

  const [clips, setClips] = useState<ClipItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedClipForMenu, setSelectedClipForMenu] = useState<ClipItem | null>(null);

  const selectedCount = selectedIds.size;
  const allSelected = clips.length > 0 && selectedCount === clips.length;

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

  const sumSeconds = (items: ClipItem[]) =>
    items.reduce((acc, c) => acc + (c.durationSeconds ?? 0), 0);

  const selectedClips = useMemo(
    () => clips.filter((c) => selectedIds.has(c.id)),
    [clips, selectedIds],
  );

  const selectedSeconds = sumSeconds(selectedClips);

  const renderClipItem = ({ item }: { item: ClipItem }) => {
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
          <View style={styles.thumbnailContainer}>
            <Image source={{ uri: item.uri }} style={styles.thumbnail} />
            <View style={styles.playOverlay}>
              <Ionicons name="play" size={16} color="#FFFFFF" />
            </View>
          </View>

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
                {formatDuration(item.durationSeconds)}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.dragHandle}
            hitSlop={10}
            onPress={(e) => {
              e.stopPropagation();
              setSelectedClipForMenu(item);
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
    if (!selectedClipForMenu) return;
    const clip = selectedClipForMenu;
    setSelectedClipForMenu(null);

    Alert.alert(
      '다운로드',
      `${clip.title} 영상을 갤러리에 저장할까요?`,
      [
        {text: '취소', style: 'cancel'},
        {text: '저장', onPress: async () => {
          try {
            const {status} = await MediaLibrary.requestPermissionsAsync(true);
            if (status !== 'granted') {
              Alert.alert('권한 필요', '갤러리 접근 권한이 필요합니다.');
              return;
            }

            if (!clip.uri) {
              Alert.alert('저장 실패', '영상 파일 경로를 찾을 수 없습니다.');
              return;
            }

            await MediaLibrary.saveToLibraryAsync(clip.uri);
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
    if (!selectedClipForMenu) return;
    const clip = selectedClipForMenu;
    setSelectedClipForMenu(null);

    Alert.alert(
      '클립 삭제',
      `${clip.title} 클립을 삭제할까요?`,
      [
        {text: '취소', style: 'cancel'},
        {
          text: '삭제', style: 'destructive', onPress: async () => {
            try {
              await deleteRecording(clip.id);
              setClips((prev) => prev.filter((c) => c.id !== clip.id));
              setSelectedIds((prev) => {
                const next = new Set(prev);
                next.delete(clip.id);
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

    router.push({
      pathname: '/video-edit',
      params: {
        // expo-router 파라미터는 문자열만 가능해서, 선택한 클립을
        // video-edit.tsx의 EditableClip 형태에 맞춰 JSON으로 직렬화해 넘깁니다.
        clips: JSON.stringify(
          selectedClips.map((clip) => ({
            id: clip.id,
            thumbnailUri: clip.thumbnail,
            videoUri: clip.uri,
            placeName: clip.title,
            recordedAt: clip.recordedAt,
          })),
        ),
      },
    });
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
          onPress={handleCancel}
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

        <Pressable
          hitSlop={12}
          onPress={() => router.push('/(tabs)/home')}
          style={styles.headerButton}
        >
          <Text allowFontScaling={false} style={styles.editButtonText}>
            메인
          </Text>
        </Pressable>
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
        renderItem={renderClipItem}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: FOOTER_HEIGHT + insets.bottom + 16 },
        ]}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>추가된 영상이 없습니다.</Text>
            <Text style={styles.emptySubText}>
              &lsquo;+ 클립 추가하기&rsquo;를 눌러 영상을 등록해보세요.
            </Text>
          </View>
        }
      />

      <View style={[styles.footer, { paddingBottom: insets.bottom }]}>
        <View style={styles.footerContent}>
          <View style={styles.footerLeft}>
            {selectedCount > 0 ? (
              <View style={styles.footerInfo}>
                <Ionicons name="film-outline" size={18} color={COLORS.textSecondary} />
                <Text style={styles.footerStatText}>{selectedCount}개</Text>

                <Text style={styles.footerDivider}>·</Text>

                <Ionicons name="time-outline" size={15} color={COLORS.textSecondary} />
                <Text style={styles.footerStatText}>{formatDuration(selectedSeconds)}</Text>
              </View>
            ) : (
              <Text style={styles.footerEmptyText}>클립을 선택해주세요</Text>
            )}
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
      </View>

      <Modal
        visible={!!selectedClipForMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedClipForMenu(null)}
      >
        <TouchableWithoutFeedback onPress={() => setSelectedClipForMenu(null)}>
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
  editText: {
    fontSize: 15,
    color: COLORS.primary,
    fontWeight: '600',
  },
  subHeader: {
    paddingVertical: 16,
    alignItems: 'center',
    gap: 8,
  },
  description: {
    fontSize: 13,
    color: '#8E8E93',
  },
  addVideoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: COLORS.primaryPressed,
  },
  addVideoText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  listContent: {
    paddingHorizontal: 16,
  },
  clipItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  badgeCheck: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
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
    borderRadius: 12,
    padding: 12,
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
    borderRadius: 8,
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
    marginLeft: 12,
  },
  clipTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 2,
  },
  clipDate: {
    fontSize: 12,
    color: '#AEAEB2',
    marginBottom: 4,
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  durationText: {
    fontSize: 11,
    color: '#8E8E93',
  },
  dragHandle: {
    padding: 8,
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8E8E93',
  },
  emptySubText: {
    fontSize: 13,
    color: '#C7C7CC',
    marginTop: 4,
  },
  // 화면 맨 아래(bottom: 0)에 딱 붙이고, 홈 인디케이터 등 안전 영역만큼은
  // paddingBottom(인라인 스타일의 insets.bottom)으로 배경을 그대로 확장해서 채웁니다.
  // 예전처럼 bottom: insets.bottom로 띄우면 그 아래에 아무것도 없는 흰 여백이 남아
  // 바가 화면 끝에서 들떠 보였습니다.
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -15,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
  },
  footerContent: {
    height: FOOTER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 95,
    paddingHorizontal: 20,
  },
  // 선택/미선택 상태마다 이 안에 들어가는 텍스트 길이가 달라지는데(footerInfo ↔
  // footerEmptyText), flex: 1 + justifyContent: 'flex-end'로 항상 버튼 쪽 끝에
  // 붙여 정렬해서 버튼과의 간격(위 footer의 gap)이 상태와 무관하게 고정되도록 합니다.
  footerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  footerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  footerStatText: {
    fontSize: 18,
    color: '#1C1C1E',
    fontWeight: '700',
  },
  footerDivider: {
    fontSize: 18,
    color: '#C7C7CC',
    marginHorizontal: 3,
  },
  footerEmptyText: {
    fontSize: 17,
    color: '#8E8E93',
  },
  createButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  createButtonDisabled: {
    backgroundColor: '#FFB8A4',
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
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
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 10,
  },
  menuDivider: {
    height: 1,
    backgroundColor: COLORS.divider,
    marginHorizontal: 8,
    marginVertical: 4,
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