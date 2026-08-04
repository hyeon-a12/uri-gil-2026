import React, { useState } from 'react';
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { setActiveFolder, clearActiveFolder } from '@/services/activeFolderService';

const COLORS = {
  background: '#FAF8F1',
  card: '#FFFFFF',

  primary: '#F99B30',
  primarySoft: '#FFF1E4',

  accent: '#3182F6',

  textPrimary: '#262621',
  textSecondary: '#8A8A82',
  textTertiary: '#AAA9A2',

  border: '#ECE9E1',
  divider: '#F1EEE8',

  handle: '#999A95',
  shadow: '#4B4138',
  delete: '#E46F61',
  disabled: '#D8D5CF',

  overlay: 'rgba(0,0,0,0.25)',
};

interface FolderItem {
  id: string;
  title: string;
  dateRange: string;
  clipCount: number;
  thumbnail: string;
}

const MOCK_FOLDERS: FolderItem[] = [
  {
    id: '1',
    title: '전주',
    dateRange: '2026.07.23. 16:00',
    clipCount: 6,
    thumbnail:
      'https://images.unsplash.com/photo-1500534623283-312aade485b7?w=600',
  },
  {
    id: '2',
    title: '경주',
    dateRange: '2026.07.23. 16:20',
    clipCount: 7,
    thumbnail:
      'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600',
  },
  {
    id: '3',
    title: '포항',
    dateRange: '2026.07.23. 17:10',
    clipCount: 11,
    thumbnail:
      'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
  },
];

export default function ClipManageScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { locationName } = useLocalSearchParams<{
    locationName?: string;
  }>();

  const [activeTab, setActiveTab] = useState<'editing' | 'myTravel'>('editing');
  const [folders, setFolders] = useState<FolderItem[]>(MOCK_FOLDERS);
  const [activeFolderId, setActiveFolderId] = useState<string | null>('1');
  const [selectedFolderForMenu, setSelectedFolderForMenu] =
    useState<FolderItem | null>(null);

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
    router.push('/clip-select');
  };

  const handleConnectCamera = async () => {
    if (selectedFolderForMenu) {
      await setActiveFolder(selectedFolderForMenu.id);
      setActiveFolderId(selectedFolderForMenu.id);
      setSelectedFolderForMenu(null);
    }
  };

  const handleDeleteFolder = () => {
    if (!selectedFolderForMenu) return;

    const folder = selectedFolderForMenu;
    setSelectedFolderForMenu(null);

    Alert.alert(
      `폴더 삭제`,
      `'${folder.title}' 폴더를 삭제할까요?\n폴더 안의 모든 클립도 함께 삭제됩니다.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              if (activeFolderId === folder.id) {
                setActiveFolderId(null);
                await clearActiveFolder();
              }

              setFolders((prev) => prev.filter((f) => f.id !== folder.id));
            } catch (error) {
              console.error('[handleDeleteFolder] 삭제 실패', error);
              Alert.alert('삭제 실패', '폴더를 삭제하는 중 문제가 발생했습니다.');
            }
          },
        },
      ],
    );
  };

  const renderFolderItem = ({ item }: { item: FolderItem }) => {
    const isActive = item.id === activeFolderId;

    return (
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
    );
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable
          hitSlop={12}
          onPress={() => router.back()}
          style={styles.headerButton}
        >
          <Ionicons name="chevron-back" size={25} color={COLORS.textPrimary} />
        </Pressable>

        <Text allowFontScaling={false} style={styles.headerTitle}>
          클립 관리
        </Text>
        <View style={styles.headerButton} />
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'editing' && styles.activeTabButton,
          ]}
          onPress={() => setActiveTab('editing')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'editing' && styles.activeTabText,
            ]}
          >
            History
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'myTravel' && styles.activeTabButton,
          ]}
          onPress={() => setActiveTab('myTravel')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'myTravel' && styles.activeTabText,
            ]}
          >
            나의 여행
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={folders}
        keyExtractor={(item) => item.id}
        renderItem={renderFolderItem}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            {activeTab === 'editing' && (
              <View style={styles.createBanner}>
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={handleCreateFolder}
                >
                  <Ionicons name="add" size={24} color={COLORS.card} />
                </TouchableOpacity>
                <View style={styles.bannerTextContainer}>
                  <Text style={styles.bannerTitle}>
                    {locationName
                      ? `'${locationName}' 클립 만들기`
                      : '여행 일정 생성하기'}
                  </Text>
                  <Text style={styles.bannerSubtitle}>
                    새로운 여행을 떠나보세요.
                  </Text>
                </View>
              </View>
            )}

            <Text style={styles.sectionTitle}>
              {activeTab === 'editing' ? '최신 여행' : '내 여행 목록'}
            </Text>
          </>
        }
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
                    name="camera-outline"
                    size={20}
                    color={COLORS.textPrimary}
                  />
                  <Text style={styles.menuText}>카메라 연결하기</Text>
                </TouchableOpacity>

                <View style={styles.menuDivider} />

                <TouchableOpacity
                  style={styles.menuItem}
                  activeOpacity={0.7}
                  onPress={handleDeleteFolder}
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

  // Tabs
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  activeTabButton: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.textTertiary,
  },
  activeTabText: {
    color: COLORS.textPrimary,
    fontWeight: '700',
  },

  // List
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
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
    width: 64,
    height: 64,
    borderRadius: 32,
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
    fontSize: 14,
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
