import React, { useMemo, useState } from 'react';
import { View, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AppText as Text } from '@/components/AppText';
import { colors } from '@/constants/menu-theme';
import { Card, ScreenHeader } from '@/components/common';

type Category = '전체' | '여행/루트' | '클립 촬영' | '계정';
const CATEGORIES: Category[] = ['전체', '여행/루트', '클립 촬영', '계정'];

interface FaqItem {
  id: string;
  category: Category;
  question: string;
  answer: string;
}

// TODO: 실제로는 API에서 받아옴
const FAQS: FaqItem[] = [
  {
    id: '1',
    category: '여행/루트',
    question: '여행은 어디서 만들 수 있나요?',
    answer:
      '홈 화면 또는 내 루트 화면에서 "새 여행 만들기"를 눌러 만들 수 있어요. 촬영 화면에서는 여행을 새로 만들 수 없어요.',
  },
  {
    id: '2',
    category: '클립 촬영',
    question: '클립은 몇 초까지 촬영되나요?',
    answer: '한 클립당 최대 30초까지 촬영할 수 있어요. 이후 트림 기능으로 원하는 구간만 잘라낼 수 있어요.',
  },
  {
    id: '3',
    category: '여행/루트',
    question: '방문한 장소는 어떻게 자동으로 기록되나요?',
    answer: '촬영 시점의 GPS 위치와 카카오 지역 정보를 매칭해서 자동으로 기록돼요.',
  },
  {
    id: '4',
    category: '계정',
    question: '회원 탈퇴하면 기록한 루트는 어떻게 되나요?',
    answer: '탈퇴 즉시 모든 루트, 클립, 방문 기록이 삭제되며 복구할 수 없어요.',
  },
];

export default function FaqScreen() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category>('전체');
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return FAQS.filter((item) => {
      const matchesCategory = category === '전체' || item.category === category;
      const matchesQuery = query.trim() === '' || item.question.includes(query.trim());
      return matchesCategory && matchesQuery;
    });
  }, [query, category]);

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Q&A 리스트" />

      <View style={styles.body}>
        <View style={styles.search}>
          <Feather name="search" size={16} color={colors.textTertiary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="궁금한 내용을 검색해보세요"
            placeholderTextColor={colors.textTertiary}
            style={styles.searchInput}
          />
        </View>

        <View style={styles.tabs}>
          {CATEGORIES.map((c) => (
            <Pressable key={c} style={[styles.tab, category === c && styles.tabActive]} onPress={() => setCategory(c)}>
              <Text style={[styles.tabText, category === c && styles.tabTextActive]}>{c}</Text>
            </Pressable>
          ))}
        </View>

        <ScrollView contentContainerStyle={styles.listContent}>
          {filtered.length === 0 ? (
            <Text style={styles.emptyText}>검색 결과가 없어요</Text>
          ) : (
            // 질문 전체를 카드 하나에 이어붙임 (목업과 동일하게)
            <Card>
              {filtered.map((item, idx) => (
                <FaqRow
                  key={item.id}
                  item={item}
                  isLast={idx === filtered.length - 1}
                  isOpen={openId === item.id}
                  onToggle={() => setOpenId(openId === item.id ? null : item.id)}
                />
              ))}
            </Card>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

function FaqRow({
  item,
  isOpen,
  isLast,
  onToggle,
}: {
  item: FaqItem;
  isOpen: boolean;
  isLast: boolean;
  onToggle: () => void;
}) {
  return (
    <View>
      <Pressable style={[styles.faqQ, !isLast && !isOpen && styles.faqQBorder, isOpen && styles.faqQOpen]} onPress={onToggle}>
        <Text style={styles.faqTag}>Q</Text>
        <Text style={styles.faqQText}>{item.question}</Text>
        <Feather name={isOpen ? 'chevron-up' : 'chevron-down'} size={14} color={isOpen ? colors.accent : colors.textTertiary} />
      </Pressable>
      {isOpen && (
        <View style={styles.faqA}>
          <Text style={styles.faqAText}>{item.answer}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1, padding: 16 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginBottom: 16,
  },
  searchInput: { flex: 1, fontSize: 13, color: colors.text, paddingVertical: 10 },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  tab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: colors.card },
  tabActive: { backgroundColor: colors.text },
  tabText: { fontSize: 12, fontWeight: '700', color: colors.textSub },
  tabTextActive: { color: '#fff' },
  listContent: { paddingBottom: 40 },
  faqQ: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 15, paddingHorizontal: 14 },
  faqQBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  faqQOpen: { backgroundColor: colors.accentSoft },
  faqTag: { fontSize: 10, fontWeight: '800', color: colors.accent, width: 20 },
  faqQText: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.text },
  faqA: { paddingHorizontal: 14, paddingBottom: 18, paddingLeft: 44, backgroundColor: colors.accentSoft },
  faqAText: { fontSize: 12, color: colors.textSub, lineHeight: 20 },
  emptyText: { textAlign: 'center', color: colors.textTertiary, fontSize: 13, marginTop: 40 },
});
