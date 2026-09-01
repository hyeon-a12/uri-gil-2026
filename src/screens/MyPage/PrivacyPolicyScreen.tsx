import React, { useState } from 'react';
import { ScrollView, Linking, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { AppText as Text } from '@/components/AppText';
import { colors } from '@/constants/menu-theme';
import { Card, ListRow, SectionLabel, Toggle, ScreenHeader } from '@/components/common';

// 위치/개인정보/서비스 약관을 노션 페이지 하나에 통합해서 관리합니다.
const NOTION_TERMS_URL = 'https://rectangular-random-c6d.notion.site/444eee87fea883bc854a81944d60553c';

const URLS = {
  locationTerms: NOTION_TERMS_URL,
  privacyPolicy: NOTION_TERMS_URL,
  serviceTerms: NOTION_TERMS_URL,
  openSourceLicense: 'https://uri-gil.example.com/licenses',
};

export default function PrivacyPolicyScreen() {
  const [locationConsent, setLocationConsent] = useState(true);

  // Linking.openURL은 실패할 수 있어서(앱이 없거나 URL 형식이 이상할 때) 항상 try-catch로 감싸는 게 안전함
  const openUrl = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch (err) {
      console.warn('링크를 열 수 없어요:', err);
    }
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title="위치정보 및 개인정보 처리방침" />

      <ScrollView style={styles.body} contentContainerStyle={styles.content}>
        <SectionLabel text="위치 정보" />
        <Card style={styles.card}>
          <ListRow
            title="위치 정보 수집 · 이용 동의"
            subtitle="루트 기록과 장소 추천에 사용돼요"
            style={styles.locationRow}
            right={
              <View style={styles.toggleWrapper}>
                <Toggle value={locationConsent} onValueChange={setLocationConsent} scale={1.3} />
              </View>
            }
          />
          <View style={styles.rowSpacer} />
          <ListRow isLast title="위치 기반 서비스 이용약관" onPress={() => openUrl(URLS.locationTerms)} />
        </Card>

        <SectionLabel text="약관 및 정책" />
        <Card style={styles.cardLarge}>
          <ListRow title="개인정보 처리방침" onPress={() => openUrl(URLS.privacyPolicy)} />
          <ListRow title="서비스 이용약관" onPress={() => openUrl(URLS.serviceTerms)} />
          <ListRow isLast title="오픈소스 라이선스" onPress={() => router.push('/open-source-license')} />
        </Card>

        <Text style={styles.footNote}>우리길 v3.5.1{'\n'}ⓒ 2026 우리길팀</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1, paddingHorizontal: 16 },
  content: { paddingBottom: 40 },
  card: { marginBottom: 28 },
  rowSpacer: { height: 12 }, // 첫 번째 행과 다음 행 사이 여백 (px로 직접 조절)
  locationRow: { alignItems: 'flex-start' }, // 토글을 제목 텍스트 기준 위쪽 정렬로 변경
  toggleWrapper: { marginTop: 9 }, // 제목 텍스트와 토글 사이 세로 간격 (px로 직접 조절)
  cardLarge: { marginBottom: 16 },
  footNote: { fontSize: 11, color: colors.textTertiary, textAlign: 'center', marginTop: 4, lineHeight: 18 },
});
