import React, { useCallback, useState } from 'react';
// 화면 구성에 필요한 React Native 기본 컴포넌트들을 불러옵니다.
// SafeAreaView: 아이폰 노치 등 화면이 잘리지 않는 안전 영역을 확보해 줍니다.
// ScrollView: 화면이 길어질 때 위아래로 스크롤할 수 있게 해줍니다.
import { StyleSheet, View, ScrollView, Pressable } from 'react-native';
// SafeAreaView: react-native 내장 버전은 폐기 예정이라, react-native-safe-area-context 것을 사용합니다.
import { SafeAreaView } from 'react-native-safe-area-context';
// 아이콘 사용을 위해 Expo에서 기본 제공하는 Feather 아이콘셋을 불러옵니다.
import { Feather } from '@expo/vector-icons';
// 메뉴 카드를 눌렀을 때 해당 화면으로 이동시키기 위해 사용합니다.
import { router, useFocusEffect } from 'expo-router';
// 앱 전체 공통 폰트(SpoqaHanSansNeo)가 자동 적용되는 Text 컴포넌트입니다.
import { AppText as Text } from '@/components/AppText';
import { getAllFolders, getFolderStatus } from '@/services/folderService';
import { getAllRecordings } from '@/services/recordingService';

// 🎨 앱 전체에서 공통으로 사용할 색상 팔레트입니다.
const COLORS = {
  background: '#FFFFFF', // 앱의 기본 배경색
  card: '#FFFFFF',       // 카드나 박스의 배경색

  primary: '#FF7F5C',    // 메인 브랜드 컬러 (오렌지)
  primaryDark: '#E97B1F',// 눌렸을 때나 강조할 때 쓸 어두운 오렌지
  primarySoft: '#FFF3DF',// 아주 연한 오렌지 배경

  textPrimary: '#222222',  // 가장 진하고 중요한 텍스트 (제목 등)
  textSecondary: '#8A8A8A',// 중간 중요도의 텍스트 (본문 등)
  textTertiary: '#8A8A8A', // 부가적인 텍스트 (날짜, 힌트 등)

  border: '#DDDDDD',       // 얇은 테두리 선 색상

  shadow: '#443A31',       // 그림자 색상
};

// ♻️ 반복되는 리스트 메뉴를 위한 공통 컴포넌트입니다.
// '나의 정보 관리', '공지사항' 처럼 텍스트 + 우측 화살표(>) 모양의 메뉴를 찍어냅니다.
const MenuItem = ({
  title,
  rightText = '',
  onPress,
}: {
  title: string;
  rightText?: string;
  onPress?: () => void;
}) => (
  // Pressable: 터치 가능한 영역을 만들어주는 컴포넌트입니다. (버튼 역할)
  <Pressable style={styles.menuItem} onPress={onPress}>
    <Text style={styles.menuItemText}>{title}</Text>
    <View style={styles.menuItemRight}>
      {/* 우측에 텍스트(예: 버전 정보)가 있다면 보여주고, 없다면 생략합니다. */}
      {rightText ? <Text style={styles.menuItemRightText}>{rightText}</Text> : null}
      <Feather name="chevron-right" size={20} color={COLORS.textTertiary} />
    </View>
  </Pressable>
);

export default function MyPageScreen() {
  const [stats, setStats] = useState({
    completedRoutes: 0,
    recordedClips: 0,
    visitedPlaces: 0,
  });

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const [folders, recordings] = await Promise.all([
          getAllFolders(),
          getAllRecordings(),
        ]);

        const completedRoutes = folders.filter(
          (folder) => getFolderStatus(folder) === 'done',
        ).length;

        const visitedPlaces = new Set(
          recordings
            .map((r) => r.location.placeName)
            .filter((name): name is string => !!name),
        ).size;

        setStats({
          completedRoutes,
          recordedClips: recordings.length,
          visitedPlaces,
        });
      })();
    }, []),
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        
        {/* 1️⃣ 상단 툴바 구역: 종(알림) 아이콘 배치 */}
        <View style={styles.headerToolbar}>
          <Feather name="bell" size={24} color={COLORS.textPrimary} style={styles.icon} />
        </View>

        {/* 2️⃣ 인사말 구역: 프로필 사진(동그라미) + 유저의 닉네임을 보여줍니다. */}
        <View style={styles.greetingSection}>
          <View style={styles.profileCircle}>
            <Feather name="user" size={24} color={COLORS.textTertiary} />
          </View>
          <Text style={styles.greetingText}>안녕하세요{'\n'}텅굴이님</Text>
        </View>

        {/* 3️⃣ 나의 여행 구역: 여행 내역을 박스(Card) 형태로 강조 */}
        <View style={styles.section}>
          
          <View style={styles.orderCard}>
            <View style={styles.orderCardHeader}>
              <Text style={styles.orderCardTitle}>텅굴이님이 기록한 여행이에요</Text>
              <Feather name="chevron-right" size={18} color={COLORS.textSecondary} />
            </View>
            <Text style={styles.orderCardDesc}>날짜 ?</Text>
            
            {/* 주문 상태값 3개를 가로로 나열하는 뷰입니다. */}
            <View style={styles.orderStatusContainer}>
              {[
                { label: '완료한 루트', value: stats.completedRoutes },
                { label: '촬영한 클립', value: stats.recordedClips },
                { label: '방문한 장소', value: stats.visitedPlaces },
              ].map((status) => (
                <View key={status.label} style={styles.orderStatusItem}>
                  <Text style={styles.orderStatusNumber}>{status.value}</Text>
                  <Text style={styles.orderStatusLabel}>{status.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* 4️⃣ 나의 활동 구역: '나의 여행'과 동일한 하얀 카드 스타일로 3개 항목을 보여줍니다. */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>나의 활동</Text>

          {/* 1행 3열: 카드 3개를 가로로 나란히 배치합니다. */}
          <View style={styles.activityCardList}>
            {[
              { title: '내 루트', icon: 'map' as const, route: '/my-routes' as const },
              { title: '촬영한 클립', icon: 'film' as const, route: '/my-clips' as const },
              { title: '방문한 장소', icon: 'map-pin' as const, route: '/visited-places' as const },
            ].map((item) => (
              <Pressable
                key={item.title}
                style={styles.activityCard}
                onPress={item.route ? () => router.push(item.route) : undefined}
              >
                <Feather name={item.icon} size={22} color={COLORS.primary} />
                <Text style={styles.activityCardTitle}>{item.title}</Text>
              </Pressable>
            ))}
          </View>
        </View>

{/* 5️⃣ 나의 정보 구역 설정 메뉴: 제목까지 흰색 카드 안에 함께 넣습니다. */}
        <View style={styles.section}>
          <View style={styles.menuCard}>
            <Text style={styles.sectionTitle}>나의 정보</Text>
            <MenuItem title="나의 정보 관리" onPress={() => router.push('/profile-edit')} />
            <MenuItem title="알림 설정" onPress={() => router.push('/notification-settings')} />
            <MenuItem title="위치 정보 및 개인정보 처리방침" onPress={() => router.push('/privacy-policy')} />
          </View>
        </View>

{/* 6️⃣ 고객센터 구역: Q&A, 공지사항 등. 제목까지 흰색 카드 안에 함께 넣습니다. */}
        <View style={styles.section}>
          <View style={styles.menuCard}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>고객센터</Text>
            </View>
            <MenuItem title=" Q&A 리스트" onPress={() => router.push('/faq')} />
            <MenuItem title="1:1 문의하기" onPress={() => router.push('/inquiry')} />
            <MenuItem title="공지사항" onPress={() => router.push('/notice')} />
          </View>
        </View>

{/* 7️⃣ 프로그램 정보 구역: 앱 버전 등 표시. 제목까지 흰색 카드 안에 함께 넣습니다. */}
        <View style={styles.section}>
          <View style={styles.menuCard}>
            <Text style={styles.sectionTitle}>프로그램 정보</Text>
            {/* 마지막(유일한) 항목은 밑줄을 없애기 위해 배열 스타일을 사용해 borderBottomWidth를 0으로 덮어씌웠습니다. */}
            <View style={[styles.menuItem, { borderBottomWidth: 0 }]}>
              <Text style={styles.menuItemText}>현재 버전</Text>
              <Text style={styles.versionText}>Version 3.5.1</Text>
            </View>
          </View>
        </View>

        {/* 8️⃣ 하단 푸터 (Footer) 구역: 회사 정보 및 로그아웃 등 자잘한 링크 모음 */}
        <View style={styles.footer}>
          {/* 고객센터 전화번호 강조 박스 */}
          <View style={styles.footerCsBox}>
            <Text style={styles.footerCsTitle}>고객센터 <Text style={styles.footerCsNumber}>1588-7667</Text> (유료)</Text>
            <Text style={styles.footerCsTime}>평일 9:30~18:00</Text>
          </View>
          
          {/* 약관 및 링크들을 가로로 나열하되, 자리가 없으면 다음 줄로 넘어가도록(flexWrap: 'wrap') 설정했습니다. */}
          <View style={styles.footerLinks}>
            {['로그아웃', '고객센터', '이용약관'].map((link, idx) => (
              <Text key={idx} style={styles.footerLinkText}>{link}</Text>
            ))}
            {/* 개인정보처리방침은 법적으로 강조해야 하므로 폰트를 굵게 처리했습니다. */}
            <Text style={[styles.footerLinkText, { fontWeight: 'bold', color: COLORS.textPrimary }]}>개인정보처리방침</Text>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// 💄 화면을 꾸미는 스타일 정의 구역입니다.
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background, // 가장 바깥 배경을 아이보리색으로 덮음
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 60, // 하단 탭 바가 있을 경우 콘텐츠가 가려지지 않게 여백을 줍니다.
  },
  headerToolbar: {
    flexDirection: 'row',       // 가로 정렬
    justifyContent: 'flex-end', // 오른쪽으로 밀어서 정렬
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 16, // 아이콘 사이의 간격 (React Native 최신 버전부터 지원)
  },
  icon: {
    marginLeft: 8,
  },
  greetingSection: {
    flexDirection: 'row', // 프로필 동그라미와 인사말 텍스트를 가로로 나란히 배치합니다.
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24, // 기존 40에서 줄여서 인사말 영역의 높이를 낮췄습니다.
  },
  profileCircle: {
    width: 52,
    height: 52,
    borderRadius: 26, // width/height의 절반이라 정확한 원이 됩니다.
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border, // 배경과 카드 색이 비슷해서 테두리로 동그라미 형태를 구분해 줍니다.
    alignItems: 'center',
    justifyContent: 'center',
  },
  greetingText: {
    fontSize: 26,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    lineHeight: 32, // 인사말 높이를 낮추기 위해 34에서 살짝 줄였습니다.
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 7, // 섹션(카드) 간의 간격
  },
  sectionTitle: {
    fontSize: 19,
    color: COLORS.textPrimary,
    marginBottom: 16,
    fontWeight: 'bold',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 17,
  },
  shortcutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shortcutText: {
    fontSize: 12,
    color: COLORS.textTertiary,
    marginRight: 2,
  },
  orderCard: {
    backgroundColor: COLORS.card,
    borderRadius: 23, // 모서리를 더 둥글게
    padding: 20,
    // 아래 4줄은 아이폰 그림자 설정입니다.
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2, // 안드로이드용 그림자 설정입니다.
  },
  orderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  orderCardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  orderCardDesc: {
    fontSize: 12,
    color: COLORS.textTertiary,
    marginBottom: 24,
  },
  orderStatusContainer: {
    flexDirection: 'row', // 세로로 쌓이는 항목들을 가로로 나열합니다.
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderStatusItem: {
    alignItems: 'center',
    flex: 1, // 5개의 아이템이 균일한 비율로 공간을 차지하게 합니다.
  },
  orderStatusNumber: {
    fontSize: 22,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  orderStatusLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  activityCardList: {
    flexDirection: 'row', // 3개의 카드를 가로 한 줄로 나열합니다.
    gap: 8, // 카드 사이의 간격을 12에서 줄여 더 가깝게 했습니다.
  },
  activityCard: {
    flex: 1, // 3개 카드가 동일한 너비로 균등하게 나눠 갖습니다.
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 23, // 위 '나의 여행' 카드(orderCard)와 동일한 둥근 정도
    paddingVertical: 20,
    paddingHorizontal: 8,
    gap: 10,
    // 아래 4줄은 orderCard와 동일한 그림자 설정입니다.
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  activityCardTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  menuCard: {
    backgroundColor: COLORS.card,
    borderRadius: 23, // 위 '나의 여행' 카드(orderCard)와 동일한 둥근 정도
    paddingHorizontal: 20,
    paddingTop: 20, // 카드 안에 함께 들어온 제목 위쪽 여백입니다.
    paddingBottom: 4, // 마지막 메뉴 항목 아래쪽 여백입니다.
    // 아래 4줄은 orderCard와 동일한 그림자 설정입니다.
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between', // 왼쪽 텍스트와 오른쪽 화살표를 양끝으로 찢어줍니다.
    alignItems: 'center', // 세로 중앙 정렬
    paddingVertical: 18,
  },
  menuItemText: {
    fontSize: 16,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  menuItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuItemRightText: {
    fontSize: 14,
    color: COLORS.textTertiary,
    marginRight: 8,
  },
  versionText: {
    fontSize: 14,
    color: COLORS.textTertiary,
  },
  footer: {
    backgroundColor: COLORS.background, // 페이지 배경색과 동일하게 맞췄습니다.
    padding: 20,
    paddingBottom: 40,
  },
  footerCsBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.card, // 푸터 배경이 페이지 배경과 같아졌으므로, 흰 카드색으로 대비를 줍니다.
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  footerCsTitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  footerCsNumber: {
    fontSize: 15,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  footerCsTime: {
    fontSize: 12,
    color: COLORS.textTertiary,
  },
  footerLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap', // 공간이 모자라면 자동으로 다음 줄로 넘깁니다. (줄바꿈 허용)
    justifyContent: 'center', // 가운데 정렬
    gap: 12,
  },
  footerLinkText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
});