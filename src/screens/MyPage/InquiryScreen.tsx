import React, { useState } from 'react';
import { ScrollView, View, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { AppText as Text } from '@/components/AppText';
import { colors } from '@/constants/menu-theme';
import { Card, ListRow, SectionLabel, cardShadow, ScreenHeader } from '@/components/common';

type InquiryStatus = 'done' | 'waiting';

interface InquiryHistory {
  id: string;
  title: string;
  date: string;
  status: InquiryStatus;
}

// TODO: 실제로는 API에서 받아옴
const HISTORY: InquiryHistory[] = [
  { id: '1', title: '클립이 저장되지 않아요', date: '2026.07.28 접수', status: 'done' },
  { id: '2', title: '카카오맵 연동 오류 문의', date: '2026.07.30 접수', status: 'waiting' },
];

const INQUIRY_TYPES = ['여행/루트 관련', '클립 촬영 관련', '카카오 연동 오류', '계정 관련', '기타'];

export default function InquiryScreen() {
  const [type, setType] = useState<string | null>(null);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const canSubmit = type !== null && title.trim().length > 0 && content.trim().length > 0;

  // TODO: 실제 문의 등록 API 연동
  const handleSubmit = () => {
    if (!canSubmit || !type) return;
    Alert.alert('문의가 등록됐어요', '빠르게 확인 후 답변드릴게요.', [
      { text: '확인', onPress: () => router.back() },
    ]);
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title="1:1 문의하기" />

      <ScrollView style={styles.body} contentContainerStyle={styles.content}>
        <SectionLabel text="나의 문의 내역" />
        <Card style={styles.historyCard}>
          {HISTORY.map((item, idx) => (
            <ListRow
              key={item.id}
              isLast={idx === HISTORY.length - 1}
              title={item.title}
              subtitle={item.date}
              right={
                <View style={[styles.badge, item.status === 'done' ? styles.badgeDone : styles.badgeWaiting]}>
                  <Text style={[styles.badgeText, item.status === 'waiting' && { color: colors.accent }]}>
                    {item.status === 'done' ? '답변완료' : '답변대기'}
                  </Text>
                </View>
              }
            />
          ))}
        </Card>

        <SectionLabel text="새 문의 작성" />

        <FieldLabel text="문의 유형" />
        <Pressable style={styles.selectBox} onPress={() => setShowTypePicker((prev) => !prev)}>
          <Text style={type ? styles.selectText : styles.selectPlaceholder}>{type ?? '문의 유형을 선택해주세요'}</Text>
          <Feather name={showTypePicker ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textTertiary} />
        </Pressable>
        {showTypePicker && (
          <Card style={styles.typePickerCard}>
            {INQUIRY_TYPES.map((t, idx) => (
              <ListRow
                key={t}
                isLast={idx === INQUIRY_TYPES.length - 1}
                title={t}
                onPress={() => {
                  setType(t);
                  setShowTypePicker(false);
                }}
              />
            ))}
          </Card>
        )}

        <View style={styles.fieldGroup}>
          <FieldLabel text="제목" />
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="제목을 입력해주세요"
            placeholderTextColor={colors.textTertiary}
            style={styles.textInput}
          />
        </View>

        <View style={styles.fieldGroup}>
          <FieldLabel text="내용" />
          <TextInput
            value={content}
            onChangeText={setContent}
            placeholder={'문의하실 내용을 자세히 적어주시면\n더 빠르게 도와드릴 수 있어요.'}
            placeholderTextColor={colors.textTertiary}
            style={[styles.textInput, styles.textarea]}
            multiline
            textAlignVertical="top"
          />
        </View>

        <View style={styles.attachGroup}>
          <FieldLabel text="사진 첨부 (선택)" />
          <Pressable style={styles.attachBox}>
            <Feather name="plus" size={18} color={colors.textTertiary} />
          </Pressable>
        </View>

        <Pressable
          style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
        >
          <Text style={styles.submitBtnText}>문의 등록하기</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function FieldLabel({ text }: { text: string }) {
  return <Text style={styles.fieldLabel}>{text}</Text>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1, paddingHorizontal: 16 },
  content: { paddingBottom: 40 },
  historyCard: { marginBottom: 16 },
  typePickerCard: { marginTop: 8, marginBottom: 6 },
  fieldGroup: { marginTop: 14 },
  attachGroup: { marginTop: 14, marginBottom: 8 },
  fieldLabel: { fontSize: 12, color: colors.textSub, fontWeight: '600', marginBottom: 6 },
  selectBox: {
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectText: { fontSize: 14, color: colors.text },
  selectPlaceholder: { fontSize: 14, color: colors.textTertiary },
  textInput: { backgroundColor: colors.card, borderRadius: 12, padding: 13, fontSize: 14, color: colors.text },
  textarea: { height: 110 },
  attachBox: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.textTertiary,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtn: {
    marginTop: 8,
    backgroundColor: colors.accent,
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    ...cardShadow,
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeDone: { backgroundColor: '#EFEBE4' },
  badgeWaiting: { backgroundColor: colors.accentSoft },
  badgeText: { fontSize: 10, fontWeight: '700', color: '#8F8A80' },
});
