import React, { useState } from 'react';
import { ScrollView, Linking, StyleSheet, View } from 'react-native';
import { AppText as Text } from '@/components/AppText';
import { colors } from '@/constants/menu-theme';
import { Card, ListRow, SectionLabel, Toggle, ScreenHeader } from '@/components/common';

// 실제 약관 URL로 교체 필요
const URLS = {
  locationTerms: 'https://uri-gil.example.com/terms/location',
  privacyPolicy: 'https://uri-gil.example.com/privacy',
  serviceTerms: 'https://uri-gil.example.com/terms/service',
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
            right={<Toggle value={locationConsent} onValueChange={setLocationConsent} />}
          />
          <ListRow isLast title="위치 기반 서비스 이용약관" onPress={() => openUrl(URLS.locationTerms)} />
        </Card>

        <SectionLabel text="약관 및 정책" />
        <Card style={styles.cardLarge}>
          <ListRow title="개인정보 처리방침" onPress={() => openUrl(URLS.privacyPolicy)} />
          <ListRow title="서비스 이용약관" onPress={() => openUrl(URLS.serviceTerms)} />
          <ListRow isLast title="오픈소스 라이선스" onPress={() => openUrl(URLS.openSourceLicense)} />
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
  cardLarge: { marginBottom: 16 },
  footNote: { fontSize: 11, color: colors.textTertiary, textAlign: 'center', marginTop: 4, lineHeight: 18 },
});
