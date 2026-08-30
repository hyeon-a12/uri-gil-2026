import React, { useCallback, useState } from 'react';
import {
  Alert,
  StyleSheet,
  View,
  TouchableOpacity,
  FlatList,
  Modal,
  TouchableWithoutFeedback,
  ScrollView,
} from 'react-native';
import { AppText as Text } from '@/components/AppText';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { clearActiveFolder, getActiveFolder } from '@/services/activeFolderService';
import {
  getAllFolders,
  saveFolder,
  deleteFolder as deleteFolderFromStorage,
  getFolderStatus,
  FolderItem,
  FolderStatus,
} from '@/services/folderService';
import { getRecordingsByFolder } from '@/services/recordingService';
import { useTripStore } from '@/store/useTripStore';
import NewTripModal from '@/components/NewTripModal';
import { HapticPressable } from '@/components/common';
import { COLORS as SHARED_COLORS, RADIUS, SPACING } from '@/constants/color';
import { TextInput } from 'react-native-gesture-handler';

const COLORS = {
  background: SHARED_COLORS.background,
  card: SHARED_COLORS.background,

  primary: SHARED_COLORS.accent,
  primarySoft: SHARED_COLORS.main,

  accent: SHARED_COLORS.statusTag,

  textPrimary: SHARED_COLORS.textPrimary,
  textSecondary: SHARED_COLORS.textSecondary,
  textTertiary: SHARED_COLORS.textSecondary,

  border: SHARED_COLORS.border,
  divider: SHARED_COLORS.border,
  surface: SHARED_COLORS.surface,
  success: SHARED_COLORS.success,

  handle: '#999A95',
  shadow: SHARED_COLORS.shadow,
  delete: SHARED_COLORS.danger,
  disabled: '#D8D5CF',

  overlay: 'rgba(0,0,0,0.25)',
};

function StatusChip({
  label,
  count,
  selected,
  emphasize,
  countColor,
  onPress,
}: {
  label: string;
  count?: number;
  selected: boolean;
  emphasize?: boolean;
  countColor?: string;
  onPress: () => void;
}) {
  return (
    <HapticPressable
      style={[styles.filterChip, selected && styles.filterChipSelected]}
      onPress={onPress}
    >
      <Text style={[styles.filterChipText, selected && styles.filterChipTextSelected]}>
        {label}
      </Text>
      {count !== undefined && (
        <Text
          style={[
            styles.filterChipCount,
            selected && styles.filterChipTextSelected,
            !selected && emphasize && styles.filterChipCountEmphasize,
            !selected && countColor && { color: countColor },
          ]}
        >
          {' '}
          {count}
        </Text>
      )}
    </HapticPressable>
  );
}

export default function ClipManageScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  
  useFocusEffect(
    useCallback(() => {
      void loadFolders();
    }, []),
  );
  
  type FolderWithCount = FolderItem & { clipCount: number; previewThumbnails: string[] };
  const [folders, setFolders] = useState<FolderWithCount[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | FolderStatus>('all');

  const loadFolders = async () => {
    try {
      const stored = await getAllFolders();
      const activeId = await getActiveFolder();

      const withCounts: FolderWithCount[] = await Promise.all(
        stored.map(async (f) => {
          const records = await getRecordingsByFolder(f.id);
          return {
            ...f,
            clipCount: records.length,
            previewThumbnails: records.slice(0, 3).map((r) => r.thumbnail),
            isCurrentActive: f.id === activeId,
          };
        }),
      );
      
      setFolders(withCounts);
      setActiveFolderId(activeId);
    } catch (error) {
      console.error('[loadFolders] 실패:', error);
      setFolders([]);
    }
  };

  const { locationName } = useLocalSearchParams<{
    locationName?: string;
  }>();

  const [activeTab, setActiveTab] = useState<'editing' | 'myTravel'>('editing');
  const [activeFolderId, setActiveFolderId] = useState<string | null>('null');
  const [selectedFolderForMenu, setSelectedFolderForMenu] =
    useState<FolderItem | null>(null);
  const [newTripModalVisible, setNewTripModalVisible] = useState(false);

  const filteredFolders = folders.filter((f) => {
    const matchesQuery = f.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === 'all' || getFolderStatus(f) === statusFilter;
    return matchesQuery && matchesStatus;
  });

  const statusCounts = folders.reduce(
    (counts, f) => {
      const status = getFolderStatus(f);
      if (status) counts[status] += 1;
      return counts;
    },
    { before: 0, ing: 0, done: 0 } as Record<FolderStatus, number>,
  );

  const totalClipCount = folders.reduce((sum, f) => sum + f.clipCount, 0);

  const STATUS_LABEL: Record<FolderStatus, string> = {
    before: '예정',
    ing: '진행중',
    done: '완료',
  };

  const handleFolderPress = (folder: FolderItem) => {
    router.push({
      pathname: '/clip-select',
      params: {
        id: folder.id,
        title: folder.title,
      },
    });
  };

  const handleCreateFolder = () => {
    setNewTripModalVisible(true);
  };

  const handleTripCreated: React.ComponentProps<typeof NewTripModal>['onCreated'] = async (
    trip,
  ) => {
    const newFolder: FolderItem = {
      id: `${Date.now()}`,
      title: trip.name || `${trip.region ?? ''} 여행`,
      dateRange: `${trip.startDate!.getFullYear()}.${String(
        trip.startDate!.getMonth() + 1,
      ).padStart(2, '0')}.${String(trip.startDate!.getDate()).padStart(2, '0')}. ~ ${trip.endDate.getFullYear()}.${String(
        trip.endDate.getMonth() + 1,
      ).padStart(2, '0')}.${String(trip.endDate.getDate()).padStart(2, '0')}.`,
      thumbnail:
        'https://images.unsplash.com/photo-1500534623283-312aade485b7?w=600',

      // 예전에는 폴더 이름/날짜 말고는 다 버려지던 필드들 — 여행 만들기 모달에서
      // 입력받은 그대로 저장합니다.
      region: trip.region,
      memo: trip.memo,
      partySize: trip.partySize,
      themes: trip.themes,
      clipLengthSeconds: trip.clipLengthSeconds,
      shootingStyle: trip.shootingStyle,
    };

    try {
      await saveFolder(newFolder);
      setFolders((prev) => [
        { ...newFolder, clipCount: 0, previewThumbnails: [] },
        ...prev,
      ]);
    } catch (error) {
      console.error('[handleTripCreated] 저장 실패:', error);
      Alert.alert('저장 실패', '폴더를 만드는 중 문제가 발생했습니다.');
    }
  };

  const handleDelete = () => {
    if (!selectedFolderForMenu) return;
    const folder = selectedFolderForMenu;
    setSelectedFolderForMenu(null);

    Alert.alert(
      '폴더 삭제',
      `${folder.title} 폴더를 삭제할까요?`,
      [
        {text: '취소', style: 'cancel'},
        {
          text: '삭제', style: 'destructive', onPress: async () => {
            try {
              if (activeFolderId === folder.id) {
                await clearActiveFolder();
                useTripStore.getState().clearCurrentTrip();
                setActiveFolderId(null);
              }

              await deleteFolderFromStorage(folder.id);
              setFolders((prev) => prev.filter((c) => c.id != folder.id));
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

  const renderFolderItem = ({ item }: { item: FolderWithCount }) => {
    const status = getFolderStatus(item);

    return (
      <TouchableOpacity
        style={styles.folderCard}
        activeOpacity={0.7}
        onPress={() => handleFolderPress(item)}
      >
        <View style={styles.folderCardTopRow}>
          <View style={styles.folderTitleRow}>
            <Text style={styles.folderTitle} numberOfLines={1}>
              {item.title}
            </Text>
            {status && (
              <View
                style={[
                  styles.statusBadge,
                  status === 'ing' && styles.statusBadgeIng,
                  status === 'done' && styles.statusBadgeDone,
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    status === 'ing' && styles.statusBadgeTextIng,
                    status === 'done' && styles.statusBadgeTextDone,
                  ]}
                >
                  {STATUS_LABEL[status]}
                </Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={styles.moreButton}
            onPress={(e) => {
              e.stopPropagation();
              setSelectedFolderForMenu(item);
            }}
          >
            <Feather name="more-horizontal" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>

        <Text style={styles.folderSubText}>
          {item.dateRange} · 클립 {item.clipCount}
        </Text>

        {item.previewThumbnails.length > 0 && (
          <View style={styles.folderPreviewRow}>
            {item.previewThumbnails.map((uri, index) => (
              <Image
                key={`${item.id}-${index}`}
                source={{ uri }}
                style={styles.folderThumbnail}
              />
            ))}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerTextArea}>
          <Text allowFontScaling={false} style={styles.headerTitle}>
            클립 관리
          </Text>
          <Text allowFontScaling={false} style={styles.headerStats}>
            여행 {folders.length}개 · 클립 {totalClipCount}개
          </Text>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Ionicons
            name="search"
            size={18}
            color={COLORS.textSecondary}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder='여행 검색'
            placeholderTextColor={COLORS.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      <ScrollView
        horizontal
        style={styles.filterScroll}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        <StatusChip
          label="전체"
          selected={statusFilter === 'all'}
          onPress={() => setStatusFilter('all')}
        />
        <StatusChip
          label="예정"
          count={statusCounts.before}
          selected={statusFilter === 'before'}
          onPress={() => setStatusFilter('before')}
        />
        <StatusChip
          label="진행중"
          count={statusCounts.ing}
          selected={statusFilter === 'ing'}
          onPress={() => setStatusFilter('ing')}
          emphasize
        />
        <StatusChip
          label="완료"
          count={statusCounts.done}
          selected={statusFilter === 'done'}
          onPress={() => setStatusFilter('done')}
          countColor={COLORS.success}
        />
      </ScrollView>

      <FlatList
        style={styles.list}
        data={filteredFolders}
        keyExtractor={(item) => item.id}
        renderItem={renderFolderItem}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        showsVerticalScrollIndicator={false}
      />

      <Modal
        visible={!!selectedFolderForMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedFolderForMenu(null)}
      >
        <TouchableWithoutFeedback onPress={() => setSelectedFolderForMenu(null)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.menuBox}>
                <TouchableOpacity
                  style={styles.menuItem}
                  activeOpacity={0.7}
                  onPress={handleDelete}
                >
                  <Ionicons
                    name='trash-outline'
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

      <NewTripModal
        visible={newTripModalVisible}
        onClose={() => setNewTripModalVisible(false)}
        onCreated={handleTripCreated}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // Header
  header: {
    minHeight: 92,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xs,
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
  headerTextArea: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    color: COLORS.textPrimary,
    fontSize: 19,
    lineHeight: 25,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  headerStats: {
    marginTop: SPACING.xs,
    color: COLORS.textSecondary,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
  },
  editButtonText: {
    color: COLORS.primary,
    fontSize: 11,
    lineHeight: 19,
    fontWeight: '600',
  },

  // Status filter
  filterScroll: {
    flexGrow: 0,
  },
  filterRow: {
    paddingHorizontal: SPACING.screenH,
    paddingBottom: 8, // 태그 줄 자체의 아래쪽 여백 (px로 직접 조절)
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 38,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.banner,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterChipSelected: {
    backgroundColor: COLORS.textPrimary,
    borderColor: COLORS.textPrimary,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '400',
    color: COLORS.textPrimary,
  },
  filterChipTextSelected: {
    color: '#FFFFFF',
  },
  filterChipCount: {
    fontSize: 13,
    fontWeight: '300',
    color: COLORS.textSecondary,
  },
  filterChipCountEmphasize: {
    color: COLORS.primary,
  },

  // Search
  searchContainer: {
    paddingHorizontal: SPACING.screenH,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.md,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.card,
    paddingHorizontal: SPACING.md,
    height: 40,
  },
  searchIcon: {
    marginRight: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Pretendard-Regular',
    color: COLORS.textPrimary,
    padding: 0,
  },

  // List
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: SPACING.screenH,
    paddingTop: 15, // 목록 시작 전 위쪽 여백 (px로 직접 조절)
    paddingBottom: 90,
  },
  separator: {
    height: 20,
    justifyContent: 'center',
    alignItems: 'stretch',
  },

  // Create Banner
  createBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primarySoft,
    borderRadius: RADIUS.banner,
    padding: SPACING.screenH,
    marginBottom: SPACING.lg,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.sheet,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  bannerTextContainer: {
    justifyContent: 'center',
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  bannerSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },

  // Section
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },

  // Folder Card
  folderCard: {
    padding: SPACING.md,
    borderRadius: RADIUS.banner,
    backgroundColor: '#FBFBFA',
    marginBottom: SPACING.md,
  },
  folderCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  folderTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  folderTitle: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.badge,
    backgroundColor: COLORS.background,
  },
  statusBadgeIng: {
    backgroundColor: '#FFF1E4',
  },
  statusBadgeDone: {
    backgroundColor: '#E7F5EA',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  statusBadgeTextIng: {
    color: COLORS.primary,
  },
  statusBadgeTextDone: {
    color: COLORS.success,
  },
  folderSubText: {
    marginTop: SPACING.xs,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  folderPreviewRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  folderThumbnail: {
    width: 64,
    height: 64,
    borderRadius: RADIUS.card,
    backgroundColor: COLORS.border,
  },
  moreButton: {
    padding: SPACING.xs,
  },
  itemDivider: {
    height: 1,
    backgroundColor: COLORS.divider,
    opacity: 0.5,
  },

  // Modal
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
  menuText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  menuTextDelete: {
    color: COLORS.delete,
  },
});
