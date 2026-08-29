import React from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AppText as Text } from '@/components/AppText';
import { colors } from '@/constants/menu-theme';
import { Card, ListRow, ScreenHeader } from '@/components/common';

// 앱 안에서 쓰는 무료 아이콘/이미지 소재는 출처 표시 조건으로 배포되는 경우가 많아,
// 여기 한 곳에 모아 표시합니다. 소재를 새로 추가할 때마다 이 배열에도 같이 추가해주세요.
interface AssetCredit {
  id: string;
  name: string;
  author: string;
  source: string;
  url: string;
}

const CREDITS: AssetCredit[] = [
  {
    id: 'hanok-icon',
    name: '한옥 아이콘',
    author: 'Fahrul Saputra',
    source: 'Flaticon',
    url: 'https://www.flaticon.com/kr/free-icons/',
  },
];

export default function OpenSourceLicenseScreen() {
  const openUrl = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch (err) {
      console.warn('링크를 열 수 없어요:', err);
    }
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title="오픈소스 라이선스" />

      <ScrollView style={styles.body} contentContainerStyle={styles.content}>
        <Text style={styles.description}>
          우리길에서 사용한 무료 아이콘·이미지 소재의 출처예요.
        </Text>

        <Card style={styles.card}>
          {CREDITS.map((credit, index) => (
            <ListRow
              key={credit.id}
              isLast={index === CREDITS.length - 1}
              title={credit.name}
              subtitle={`제작자: ${credit.author} · ${credit.source}`}
              onPress={() => openUrl(credit.url)}
              right={<Feather name="external-link" size={16} color={colors.textTertiary} />}
            />
          ))}
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1, paddingHorizontal: 16 },
  content: { paddingBottom: 40 },
  description: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSub,
    marginBottom: 16,
  },
  card: { marginBottom: 16 },
});
