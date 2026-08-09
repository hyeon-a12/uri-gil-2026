import React, { useMemo, useState, useCallback } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  Image,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as MediaLibrary from 'expo-media-library';

import { navigateToCamera } from '@/navigation/recordingNavigation';
import { deleteRecording, getRecordingsByFolder } from '@/services/recordingService';

const COLORS = {
  background: '#FFFFFF',
  card: '#FFFFFF',

  primary: '#FFB134',
  primaryPressed: '#ED8A20',
  primarySoft: '#FFF3DF',

  textPrimary: '#222222',
  textSecondary: '#8A8A8A',
  textTertiary: '#8A8A8A',

  border: '#DDDDDD',
  divider: '#DDDDDD',

  unchecked: '#B5B5AF',
  delete: '#E46F61',
  shadow: '#4B4138',
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
  const router = useRouter();
  const { id: folderId, title: folderTitle } = useLocalSearchParams<{
    id?: string;
    title?: string;
  }>();

  const [clips, setClips] = useState<ClipItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedClipForMenu, setSelectedClipForMenu] = useState<ClipItem | null>(null);

  const selectedCount = selectedIds.size;
  const allSelected = clips.length > 0 && selectedCount === clips.length;

  useFocusEffect(
    useCallback(() => {
      void loadClips();
    }, [folderId]),
  );

  const loadClips = async () => {
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
  };

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

  const totalCount = clips.length;
  const totalSeconds = sumSeconds(clips);
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
            <Feather name="menu" size={20} color={COLORS.textTertiary} />
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
            const {status} = await MediaLibrary.requestPermissionsAsync();
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
              setClips((prev) => prev.filter((c) => c.id != clip.id));
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
              '+ 클립 추가하기'를 눌러 영상을 등록해보세요.
            </Text>
          </View>
        }
      />

      <View style={[styles.footer, { bottom: insets.bottom }]}>
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
          disabled={selectedCount === 0}>
            <Text style={styles.createButtonText}>영상 생성</Text>
          </TouchableOpacity>
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

  recordedAt: {
    marginTop: 8,

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
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: FOOTER_HEIGHT,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  footerInfo: {
    flex: 1,
    gap: 4,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  footerLabel: {
    fontSize: 13,
    color: '#8E8E93',
    width: 72,
  },
  footerValue: {
    fontSize: 13,
    color: '#1C1C1E',
    fontWeight: '600',
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
    fontSize: 15,
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