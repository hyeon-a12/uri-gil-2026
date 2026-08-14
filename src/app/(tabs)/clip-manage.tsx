import React, { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  View,
  TouchableOpacity,
  FlatList,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import { AppText as Text } from '@/components/AppText';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { setActiveFolder, clearActiveFolder, getActiveFolder } from '@/services/activeFolderService';
import { getAllFolders, saveFolder, deleteFolder as deleteFolderFromStorage, FolderItem } from '@/services/folderService';
import { getRecordingsByFolder } from '@/services/recordingService';
import { useTripStore } from '@/store/useTripStore';
import NewTripModal from '@/components/NewTripModal';
import { COLORS as SHARED_COLORS } from '@/constants/color';
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

  handle: '#999A95',
  shadow: SHARED_COLORS.shadow,
  delete: SHARED_COLORS.danger,
  disabled: '#D8D5CF',

  overlay: 'rgba(0,0,0,0.25)',
};

export default function ClipManageScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  
  useFocusEffect(
    useCallback(() => {
      void loadFolders();
    }, []),
  );
  
  type FolderWithCount = FolderItem & { clipCount: number };
  const [folders, setFolders] = useState<FolderWithCount[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

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

  const filteredFolders = folders.filter((f) =>
    f.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

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
      gridTemplateId: trip.gridTemplateId,
    };

    try {
      await saveFolder(newFolder);
      setFolders((prev) => [
        { ...newFolder, clipCount: 0 },
        ...prev,
      ]);
    } catch (error) {
      console.error('[handleTripCreated] 저장 실패:', error);
      Alert.alert('저장 실패', '폴더를 만드는 중 문제가 발생했습니다.');
    }
  };

  const handleConnectCamera = async () => {
    if (selectedFolderForMenu) {
      await setActiveFolder(selectedFolderForMenu.id);
      useTripStore.getState().setCurrentTrip(selectedFolderForMenu);
      setActiveFolderId(selectedFolderForMenu.id);
      setSelectedFolderForMenu(null);
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
    const isActive = item.id === activeFolderId;

    return (
      <>
        <TouchableOpacity
          style={styles.folderCard}
          activeOpacity={0.7}
          onPress={() => handleFolderPress(item)}
        >
          <Image source={{ uri: item.thumbnail }} style={styles.folderThumbnail} />

          <View style={styles.folderInfo}>
            <Text style={styles.folderTitle}>
              {item.title}
              {isActive && <Text style={styles.activeTag}> (진행중)</Text>}
            </Text>
            <Text style={styles.folderSubText}>{item.dateRange}</Text>
            <Text style={styles.clipCountText}>클립 {item.clipCount}개</Text>
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
        </TouchableOpacity>

        <View style={styles.itemDivider} />
      </>
    );
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        {/* 탭 루트 화면이라 뒤로가기 개념이 없어서 버튼을 없앴습니다.
            오른쪽 빈 자리와의 좌우 균형을 위해 같은 폭의 빈 자리만 남겨둡니다. */}
        <View style={styles.headerButton} />

        <Text allowFontScaling={false} style={styles.headerTitle}>
          클립 관리
        </Text>
        <View style={styles.headerButton} />
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

      <FlatList
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
                  onPress={handleConnectCamera}
                >
                  <Ionicons
                    name="key-outline"
                    size={20}
                    color={COLORS.textPrimary}
                  />
                  <Text style={styles.menuText}>수정하기?</Text>
                </TouchableOpacity>

                <View style={styles.menuDivider} />

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

  // Search
  searchContainer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingHorizontal: 15,
    height: 42,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textPrimary,
    padding: 0,
  },

  // List
  listContent: {
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
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
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  bannerTextContainer: {
    justifyContent: 'center',
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 2,
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
    marginBottom: 16,
  },

  // Folder Card
  folderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  folderThumbnail: {
    width: 55,
    height: 55,
    borderRadius: 25,
    backgroundColor: COLORS.border,
  },
  folderInfo: {
    flex: 1,
    marginLeft: 16,
  },
  folderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  activeTag: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.accent,
  },
  folderSubText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  clipCountText: {
    fontSize: 12,
    color: COLORS.textTertiary,
  },
  moreButton: {
    padding: 8,
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
