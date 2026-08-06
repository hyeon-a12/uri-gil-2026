import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

/**
 * ─────────────────────────────────────────────────────────────
 * ⚠️ 색상 관련 참고
 * ─────────────────────────────────────────────────────────────
 * 단색 #FFB134 버튼으로 통일하고 싶으시면
 * GRADIENT 배열을 안 쓰고 backgroundColor: COLORS.accent 하나로 바꾸시면 됩니다
 * (아래 PrimaryButton 컴포넌트 안에 분기 처리해뒀어요).
 */
const COLORS = {
  accent: '#FFB134',
  accentDark: '#E8663F',
  dark: '#1E2128',
  black: '#222222',
  gray500: '#8A8A8A',
  gray400: '#8A8A8A',
  gray200: '#DDDDDD',
  gray100: '#F5F5F5',
  white: '#FFFFFF',
};
const GRADIENT: [string, string] = ['#FFC364', '#FFB134'];

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// 카드 좌우 padding (styles.card의 paddingHorizontal과 반드시 같은 값이어야
// 달력 칸 너비 계산이 실제 렌더링 너비와 맞습니다).
const CARD_HORIZONTAL_PADDING = 20;

// 달력 한 주(week) 트랙의 높이 = 양 끝 원의 지름.
// 이 값 하나를 원과 트랙(배경)이 같이 쓰기 때문에 radius(=/2)도 자동으로 맞아떨어집니다.
const CALENDAR_TRACK_HEIGHT = 32;

// 달력 칸 하나의 너비. 예전엔 '%' 문자열로 계산했는데, 그러면 "원 중심에서
// 정확히 시작해서 배경이 원 밖으로 안 튀어나오게" 같은 픽셀 단위 보정을
// 할 수가 없어요(%와 px를 섞어 계산하는 CSS calc()가 RN엔 없거든요).
// 그래서 화면 너비 기준으로 미리 픽셀 값을 계산해두고, 달력 관련 요소는
// 전부 이 상수 하나만 사용하도록 통일했습니다.
const CALENDAR_CELL_WIDTH = (SCREEN_WIDTH - CARD_HORIZONTAL_PADDING * 2) / 7;

// ── 데이터 상수 ──────────────────────────────────────────────
// 실제로는 KTO API 등에서 받아오겠지만, 지금은 시안에 나온 값 그대로 하드코딩.
const REGIONS = ['전주'];
const THEMES = [
  '맛집탐방',
  '카페투어',
  '문화체험',
  '자연힐링',
  '야경',
  '쇼핑',
  '사진촬영',
  '도보여행',
];

// ── 타입 ────────────────────────────────────────────────────
type Step = 1 | 2 | 3 | 'success';

type TripForm = {
  name: string;
  region: string | null;
  memo: string;
  startDate: Date | null;
  endDate: Date | null;
  partySize: number;
  themes: string[];
};

const INITIAL_FORM: TripForm = {
  name: '',
  region: null,
  memo: '',
  startDate: null,
  endDate: null,
  partySize: 1,
  themes: [],
};

type Props = {
  visible: boolean;
  onClose: () => void;
  /** 여행 생성이 최종 확정된 순간 부모(Home/내 루트)에 데이터를 넘겨줍니다. */
  onCreated: (trip: TripForm & { startDate: Date; endDate: Date }) => void;
};

// ── 날짜 유틸 ────────────────────────────────────────────────
function isSameDate(a: Date | null, b: Date | null): boolean {
  if (!a || !b) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** 출발일과 도착일 사이에 있는 날짜인지 (달력에 범위 표시용). */
function isDateInRange(
  date: Date,
  start: Date | null,
  end: Date | null,
): boolean {
  if (!start || !end) return false;
  const time = date.getTime();
  return time > start.getTime() && time < end.getTime();
}

/** 출발일~도착일 사이 박 수. 같은 날을 고르면 당일치기(0박)로 계산됩니다. */
function getNightsBetween(start: Date, end: Date): number {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  return Math.round((end.getTime() - start.getTime()) / MS_PER_DAY);
}

/** 오늘로부터 향후 5개월의 (year, month) 쌍을 만들어 월 선택 칩에 씁니다. */
function getUpcomingMonths(count: number): { year: number; month: number }[] {
  const today = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    return { year: d.getFullYear(), month: d.getMonth() };
  });
}

function getCalendarCells(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const leadingBlanks = firstDay.getDay();

  const cells: (Date | null)[] = Array(leadingBlanks).fill(null);
  for (let d = 1; d <= lastDay.getDate(); d++) {
    cells.push(new Date(year, month, d));
  }
  return cells;
}

/** 42~35개짜리 평평한 달력 셀 배열을 일주일(7칸)씩 잘라 행 단위로 만듭니다. */
function chunkIntoWeeks(cells: (Date | null)[]): (Date | null)[][] {
  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

type CalendarSegment =
  | { type: 'blank' }
  | { type: 'day'; date: Date }
  | { type: 'range'; dates: Date[] };

/**
 * 한 주 안에서 이어진 날짜들을 하나의 세그먼트로 묶습니다.
 * RangeTrack 패턴(양 끝 원 + 가운데 flex 채움)을 적용할 대상은
 * 'range' 세그먼트뿐이고, 나머지는 기존처럼 칸 하나짜리로 그립니다.
 */
function buildWeekSegments(
  week: (Date | null)[],
  isHighlighted: (date: Date) => boolean,
): CalendarSegment[] {
  const segments: CalendarSegment[] = [];
  let run: Date[] = [];

  const flushRun = () => {
    if (run.length > 0) {
      segments.push({ type: 'range', dates: run });
      run = [];
    }
  };

  for (const date of week) {
    if (!date) {
      flushRun();
      segments.push({ type: 'blank' });
      continue;
    }
    if (isHighlighted(date)) {
      run.push(date);
    } else {
      flushRun();
      segments.push({ type: 'day', date });
    }
  }
  flushRun();

  return segments;
}

function getPartySizeLabel(n: number): string {
  if (n === 1) return '혼자';
  if (n === 2) return '둘이서';
  return `${n}명`;
}

// ── 재사용 소품 컴포넌트 ─────────────────────────────────────

function PrimaryButton({
  label,
  onPress,
  disabled,
  icon,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  if (disabled) {
    return (
      <View style={[styles.primaryButton, styles.primaryButtonDisabled]}>
        <Text style={styles.primaryButtonTextDisabled}>{label}</Text>
      </View>
    );
  }
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress}>
      <LinearGradient
        colors={GRADIENT}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.primaryButton}
      >
        {icon && (
          <Ionicons
            name={icon}
            size={16}
            color={COLORS.white}
            style={{ marginRight: 6 }}
          />
        )}
        <Text style={styles.primaryButtonText}>{label}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

function StepIndicator({
  currentStep,
  label,
}: {
  currentStep: 1 | 2 | 3;
  label: string;
}) {
  return (
    <View style={styles.stepIndicatorRow}>
      {[1, 2, 3].map((step, idx) => {
        const isDone = step < currentStep;
        const isActive = step === currentStep;
        return (
          <React.Fragment key={step}>
            <View
              style={[
                styles.stepCircle,
                (isDone || isActive) && styles.stepCircleActive,
              ]}
            >
              {isDone ? (
                <Ionicons name="checkmark" size={12} color={COLORS.white} />
              ) : (
                <Text
                  style={[
                    styles.stepCircleText,
                    isActive && styles.stepCircleTextActive,
                  ]}
                >
                  {step}
                </Text>
              )}
            </View>
            {idx < 2 && <View style={styles.stepDivider} />}
          </React.Fragment>
        );
      })}
      <Text style={styles.stepLabel}>{label}</Text>
    </View>
  );
}

function SelectableChip({
  label,
  selected,
  onPress,
  showPinIcon,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  showPinIcon?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {showPinIcon && selected && (
        <Ionicons
          name="location"
          size={12}
          color={COLORS.white}
          style={{ marginRight: 4 }}
        />
      )}
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ── 메인 컴포넌트 ────────────────────────────────────────────
export default function NewTripModal({ visible, onClose, onCreated }: Props) {
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<TripForm>(INITIAL_FORM);

  const months = useMemo(() => getUpcomingMonths(5), []);
  const [selectedMonthIdx, setSelectedMonthIdx] = useState(0);
  const { year, month } = months[selectedMonthIdx];
  const calendarCells = useMemo(
    () => getCalendarCells(year, month),
    [year, month],
  );
  const calendarWeeks = useMemo(
    () => chunkIntoWeeks(calendarCells),
    [calendarCells],
  );

  const nights =
    form.startDate && form.endDate
      ? getNightsBetween(form.startDate, form.endDate)
      : 0;

  function handleClose() {
    setStep(1);
    setForm(INITIAL_FORM);
    onClose();
  }

  function toggleRegion(region: string) {
    setForm((prev) => ({ ...prev, region }));
  }

  function toggleTheme(theme: string) {
    setForm((prev) => {
      const has = prev.themes.includes(theme);
      return {
        ...prev,
        themes: has
          ? prev.themes.filter((t) => t !== theme)
          : [...prev.themes, theme],
      };
    });
  }

  function handleSelectDate(date: Date) {
    setForm((prev) => {
      const rangeComplete = !!prev.startDate && !!prev.endDate;
      if (
        !prev.startDate ||
        rangeComplete ||
        date.getTime() < prev.startDate.getTime()
      ) {
        return { ...prev, startDate: date, endDate: null };
      }
      return { ...prev, endDate: date };
    });
  }

  function handleCreate() {
    const { startDate, endDate } = form;
    if (!startDate || !endDate) return;
    onCreated({ ...form, startDate, endDate });
    setStep('success');
  }

  const isStep1Valid = form.name.trim().length > 0 && !!form.region;
  const isStep2Valid = !!form.startDate && !!form.endDate;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {step !== 'success' && (
            <>
              <View style={styles.headerRow}>
                <Text style={styles.headerTitle}>새 여행 만들기</Text>
                <TouchableOpacity onPress={handleClose} hitSlop={10}>
                  <Ionicons name="close" size={22} color={COLORS.gray500} />
                </TouchableOpacity>
              </View>
            </>
          )}

          {step === 1 && <StepIndicator currentStep={1} label="기본 정보" />}
          {step === 2 && <StepIndicator currentStep={2} label="일정" />}
          {step === 3 && <StepIndicator currentStep={3} label="테마" />}

          {/* ── STEP 1: 기본 정보 ─────────────────────────── */}
          {step === 1 && (
            <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>
                여행 이름 <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.textInput}
                placeholder="예) 전주 한옥마을 2박 3일"
                placeholderTextColor={COLORS.gray400}
                value={form.name}
                maxLength={24}
                onChangeText={(text) =>
                  setForm((prev) => ({ ...prev, name: text }))
                }
              />
              <Text style={styles.charCount}>{form.name.length}/24</Text>

              <Text style={styles.fieldLabel}>
                여행 지역 <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.chipWrap}>
                {REGIONS.map((region) => (
                  <SelectableChip
                    key={region}
                    label={region}
                    selected={form.region === region}
                    onPress={() => toggleRegion(region)}
                    showPinIcon
                  />
                ))}
              </View>

              <Text style={styles.fieldLabel}>한 줄 메모 (선택)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="예) 친구들과 전주 맛집 탐방"
                placeholderTextColor={COLORS.gray400}
                value={form.memo}
                onChangeText={(text) =>
                  setForm((prev) => ({ ...prev, memo: text }))
                }
              />

              <View style={{ height: 24 }} />
              <PrimaryButton
                label="다음 →"
                disabled={!isStep1Valid}
                onPress={() => setStep(2)}
              />
              <View style={{ height: 20 }} />
            </ScrollView>
          )}

          {/* ── STEP 2: 일정 ──────────────────────────────── */}
          {step === 2 && (
            <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>출발일</Text>

              {(!form.startDate || !form.endDate) && (
                <View style={styles.dateHintBadge}>
                  <Text style={styles.dateHintText}>
                    {!form.startDate
                      ? '출발일을 선택하세요'
                      : '도착일을 선택하세요'}
                  </Text>
                </View>
              )}

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.monthRow}
              >
                {months.map((m, idx) => (
                  <TouchableOpacity
                    key={`${m.year}-${m.month}`}
                    style={[
                      styles.monthChip,
                      selectedMonthIdx === idx && styles.monthChipSelected,
                    ]}
                    onPress={() => setSelectedMonthIdx(idx)}
                  >
                    <Text
                      style={[
                        styles.monthChipText,
                        selectedMonthIdx === idx && styles.monthChipTextSelected,
                      ]}
                    >
                      {m.month + 1}월
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={styles.weekdayRow}>
                {['일', '월', '화', '수', '목', '금', '토'].map((d) => (
                  <Text key={d} style={styles.weekdayText}>
                    {d}
                  </Text>
                ))}
              </View>

              <View style={styles.calendarGrid}>
                {calendarWeeks.map((week, weekIdx) => {
                  const segments = buildWeekSegments(
                    week,
                    (date) =>
                      isSameDate(date, form.startDate) ||
                      isSameDate(date, form.endDate) ||
                      isDateInRange(date, form.startDate, form.endDate),
                  );

                  return (
                    <View key={weekIdx} style={styles.calendarWeekRow}>
                      {segments.map((segment, segIdx) => {
                        if (segment.type === 'blank') {
                          return <View key={segIdx} style={styles.dayCell} />;
                        }

                        if (segment.type === 'day') {
                          const { date } = segment;
                          return (
                            <TouchableOpacity
                              key={segIdx}
                              style={styles.dayCell}
                              onPress={() => handleSelectDate(date)}
                            >
                              <View style={styles.dayCircle}>
                                <Text style={styles.dayText}>
                                  {date.getDate()}
                                </Text>
                              </View>
                            </TouchableOpacity>
                          );
                        }

                        // segment.type === 'range'
                        const { dates } = segment;

                        // 구간에 날짜가 1개뿐이면(도착일을 아직 안 고른 채
                        // 출발일 하나만 선택된 상태) 이어줄 상대가 없으니
                        // 트랙 없이 원 하나만 평소 달력 칸 크기로 그립니다.
                        if (dates.length === 1) {
                          const date = dates[0];
                          return (
                            <TouchableOpacity
                              key={segIdx}
                              style={styles.dayCell}
                              onPress={() => handleSelectDate(date)}
                            >
                              <View style={[styles.dayCircle, styles.dayCircleSelected]}>
                                <Text style={[styles.dayText, styles.dayTextSelected]}>
                                  {date.getDate()}
                                </Text>
                              </View>
                            </TouchableOpacity>
                          );
                        }

                        // ── 버그 수정: "모두 선택하면 숫자가 벌어지는" 문제 ──
                        // 이전 버전은 양 끝 날짜만 고정 32px 원으로 그리고
                        // 가운데 날짜는 flex: 1로 "남는 공간을 전부" 차지하게
                        // 했어요. 그런데 가운데 칸 하나가 남는 공간을 혼자
                        // 떠안다 보니, 그 칸의 실제 너비가 평소 달력 칸보다
                        // 훨씬 넓어져서 숫자 사이 간격이 들쭉날쭉해 보였던
                        // 거예요 — 이게 "숫자가 벌어진다"고 느끼신 부분입니다.
                        //
                        // 고친 방식: 구간 안의 모든 날짜 칸을 "구간 전체
                        // 너비 ÷ 날짜 개수"로 똑같이 나눕니다. 이렇게 하면
                        // 각 칸의 너비가 하이라이트 안 된 평소 달력 칸과
                        // 정확히 같아져서 숫자 간격이 흐트러지지 않아요.
                        // 대신 "이어붙은 배경(pill)"은 숫자 칸들과 별개로
                        // position: 'absolute'인 별도의 View로 구간 전체에
                        // 깔아버려서, 숫자 위치는 그대로 두고 배경만 하나로
                        // 이어져 보이게 만들었습니다.
                        // ── 버그 수정: 연한 배경이 원 밖으로 튀어나오는 문제 ──
                        // 모든 칸을 CALENDAR_CELL_WIDTH로 통일했더니 숫자
                        // 간격은 고쳐졌는데, 원(circle, 지름 32px)이 자기
                        // 칸(CALENDAR_CELL_WIDTH, 보통 32px보다 넓음) 안에서
                        // 가운데 정렬되다 보니 원 좌우로 배경색이 살짝 삐져
                        // 나와 보였어요 — 이게 "동그라미 밖으로 튀어나온다"는
                        // 부분입니다.
                        //
                        // 고친 방식: 배경(pill)의 왼쪽 끝은 "첫 번째 원의
                        // 중심"에서 시작하고, 오른쪽 끝은 "마지막 원의 중심"
                        // 에서 끝나도록 좌우로 CALENDAR_CELL_WIDTH/2만큼
                        // 안쪽으로 밀어 넣었습니다. 원의 중심에서 시작하면
                        // 배경의 절반(중심~오른쪽 끝)은 그 위에 그려지는
                        // 원(circle)이 그대로 덮어버려서 안 보이고, 원 밖으로
                        //는 배경이 아예 칠해지지 않으니 튀어나올 여지가
                        // 없어집니다. 원과 원 사이(진짜 이어줘야 하는 구간)만
                        // 배경이 그대로 보이고요.
                        const trackInset = CALENDAR_CELL_WIDTH / 2;
                        return (
                          <View
                            key={segIdx}
                            style={[
                              styles.rangeTrack,
                              { width: CALENDAR_CELL_WIDTH * dates.length },
                            ]}
                          >
                            <View
                              style={[
                                styles.rangeTrackBackground,
                                { left: trackInset, right: trackInset },
                              ]}
                            />
                            {dates.map((date) => {
                              const isEndpoint =
                                isSameDate(date, form.startDate) ||
                                isSameDate(date, form.endDate);
                              return (
                                <TouchableOpacity
                                  key={date.getTime()}
                                  style={styles.rangeTrackCell}
                                  onPress={() => handleSelectDate(date)}
                                >
                                  {isEndpoint ? (
                                    <View
                                      style={[styles.dayCircle, styles.dayCircleSelected]}
                                    >
                                      <Text
                                        style={[styles.dayText, styles.dayTextSelected]}
                                      >
                                        {date.getDate()}
                                      </Text>
                                    </View>
                                  ) : (
                                    <Text style={styles.dayText}>{date.getDate()}</Text>
                                  )}
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        );
                      })}
                    </View>
                  );
                })}
              </View>

              <Text style={styles.fieldLabel}>여행 기간</Text>
              {/*
                ── 버그 수정 지점 ② ─────────────────────────────
                stepperRow는 justifyContent: 'space-between'이라 "왼쪽
                요소 / 오른쪽 요소" 두 개가 있을 때(예: 아래 '여행 인원'처럼
                라벨+스테퍼)를 위한 스타일이에요. 그런데 여긴 자식이 아이콘
                하나, 텍스트 하나로 따로 떨어져 있어서 space-between이 둘을
                행 양 끝으로 밀어버리는 바람에 달력 아이콘은 왼쪽 끝, 날짜
                텍스트는 오른쪽 끝에 붙어 가운데가 텅 비어 보이는 버그가
                있었습니다. 아이콘+텍스트를 partyLabelRow로 한 번 묶어서
                "한 덩어리"로 만들면, space-between이 적용될 두 번째 자식이
                없으니 그냥 왼쪽 정렬된 한 그룹으로 자연스럽게 보입니다.
              */}
              <View style={styles.stepperRow}>
                <View style={styles.partyLabelRow}>
                  <Ionicons
                    name="calendar-outline"
                    size={16}
                    color={COLORS.black}
                  />
                  <Text style={styles.stepperLabel}>
                    {form.startDate && form.endDate
                      ? `${form.startDate.getMonth() + 1}월 ${form.startDate.getDate()}일 → ${
                          form.endDate.getMonth() + 1
                        }월 ${form.endDate.getDate()}일 (${nights}박 ${nights + 1}일)`
                      : '-'}
                  </Text>
                </View>
              </View>

              <Text style={styles.fieldLabel}>여행 인원</Text>
              <View style={styles.stepperRow}>
                <View style={styles.partyLabelRow}>
                  <Ionicons name="people-outline" size={18} color={COLORS.black} />
                  <Text style={styles.stepperLabel}>
                    {getPartySizeLabel(form.partySize)}
                  </Text>
                </View>
                <Stepper
                  value={form.partySize}
                  min={1}
                  max={20}
                  onChange={(v) => setForm((prev) => ({ ...prev, partySize: v }))}
                />
              </View>

              <View style={{ height: 24 }} />
              <View style={styles.footerRow}>
                <TouchableOpacity style={styles.backButton} onPress={() => setStep(1)}>
                  <Ionicons name="chevron-back" size={20} color={COLORS.black} />
                </TouchableOpacity>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <PrimaryButton
                    label="다음 →"
                    disabled={!isStep2Valid}
                    onPress={() => setStep(3)}
                  />
                </View>
              </View>
              <View style={{ height: 20 }} />
            </ScrollView>
          )}

          {/* ── STEP 3: 테마 + 요약 ───────────────────────── */}
          {step === 3 && (
            <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>
                여행 테마 <Text style={styles.fieldLabelMuted}>(중복 선택 가능)</Text>
              </Text>
              <Text style={styles.fieldHint}>
                선택한 테마를 바탕으로 루트 추천을 받을 수 있어요
              </Text>
              <View style={styles.chipWrap}>
                {THEMES.map((theme) => (
                  <SelectableChip
                    key={theme}
                    label={theme}
                    selected={form.themes.includes(theme)}
                    onPress={() => toggleTheme(theme)}
                  />
                ))}
              </View>

              <Text style={[styles.fieldLabel, { marginTop: 8 }]}>여행 요약</Text>
              <View style={styles.summaryCard}>
                <SummaryRow icon="pencil-outline" label="여행 이름" value={form.name || '-'} />
                <SummaryRow icon="location-outline" label="지역" value={form.region || '-'} />
                <SummaryRow
                  icon="calendar-outline"
                  label="일정"
                  value={
                    form.startDate && form.endDate
                      ? `${form.startDate.getMonth() + 1}월 ${form.startDate.getDate()}~${form.endDate.getDate()}일 (${nights}박 ${
                          nights + 1
                        }일)`
                      : '-'
                  }
                />
                <SummaryRow icon="people-outline" label="인원" value={`${form.partySize}명`} />
                <SummaryRow
                  icon="pricetags-outline"
                  label="테마"
                  value={form.themes.length > 0 ? form.themes.join(', ') : '미선택'}
                />
              </View>

              <View style={{ height: 24 }} />
              <View style={styles.footerRow}>
                <TouchableOpacity style={styles.backButton} onPress={() => setStep(2)}>
                  <Ionicons name="chevron-back" size={20} color={COLORS.black} />
                </TouchableOpacity>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <PrimaryButton
                    label="여행 만들기!"
                    icon="airplane-outline"
                    onPress={handleCreate}
                  />
                </View>
              </View>
              <View style={{ height: 20 }} />
            </ScrollView>
          )}

          {/* ── SUCCESS: 여행 생성 완료 ───────────────────── */}
          {step === 'success' && (
            <View style={styles.successBody}>
              <View style={styles.mascotPlaceholder} />

              <Text style={styles.successTitle}>여행 생성 완료!</Text>
              <Text style={styles.successTripName}>{form.name || '이름 없는 여행'}</Text>
              <Text style={styles.successMeta}>
                {form.startDate && form.endDate
                  ? `${form.startDate.getMonth() + 1}월 ${form.startDate.getDate()}일 ~ ${form.endDate.getDate()}일 · ${form.partySize}명`
                  : ''}
              </Text>

              <View style={styles.successHintRow}>
                <Ionicons name="location-outline" size={14} color={COLORS.gray500} />
                <Text style={styles.successHintText}>
                  이제 내 루트에서 장소 핀을 찍어 계획을 세워보세요
                </Text>
              </View>

              <View style={{ height: 20 }} />
              <PrimaryButton label="내 루트에서 계획하기 →" onPress={handleClose} />
              <TouchableOpacity style={{ marginTop: 14 }} onPress={handleClose}>
                <Text style={styles.laterText}>나중에 하기</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

function Stepper({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <View style={styles.stepper}>
      <TouchableOpacity
        style={styles.stepperButton}
        disabled={value <= min}
        onPress={() => onChange(Math.max(min, value - 1))}
      >
        <Ionicons name="remove" size={16} color={value <= min ? COLORS.gray400 : COLORS.black} />
      </TouchableOpacity>
      <Text style={styles.stepperValue}>{value}</Text>
      <TouchableOpacity
        style={styles.stepperButton}
        disabled={value >= max}
        onPress={() => onChange(Math.min(max, value + 1))}
      >
        <Ionicons name="add" size={16} color={value >= max ? COLORS.gray400 : COLORS.black} />
      </TouchableOpacity>
    </View>
  );
}

function SummaryRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.summaryRow}>
      <Ionicons name={icon} size={16} color={COLORS.accent} />
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: CARD_HORIZONTAL_PADDING,
    paddingTop: 10,
    maxHeight: SCREEN_HEIGHT * 0.88 * 1.3, // 기존 높이(0.88)의 1.3배
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.black,
  },
  stepIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  stepCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.gray200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleActive: {
    backgroundColor: COLORS.accent,
  },
  stepCircleText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.gray400,
  },
  stepCircleTextActive: {
    color: COLORS.white,
  },
  stepDivider: {
    width: 20,
    height: 1,
    backgroundColor: COLORS.gray200,
    marginHorizontal: 4,
  },
  stepLabel: {
    marginLeft: 10,
    fontSize: 12,
    color: COLORS.gray500,
  },
  body: {},
  fieldLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.black,
    marginTop: 18,
    marginBottom: 8,
  },
  fieldLabelMuted: {
    fontWeight: '400',
    color: COLORS.gray400,
    fontSize: 12,
  },
  fieldHint: {
    fontSize: 12,
    color: COLORS.gray400,
    marginTop: -4,
    marginBottom: 10,
  },
  required: {
    color: COLORS.accent,
  },
  dateHintBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.gray100,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 12,
  },
  dateHintText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.accent,
  },
  textInput: {
    backgroundColor: COLORS.gray100,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: COLORS.black,
  },
  charCount: {
    alignSelf: 'flex-end',
    fontSize: 11,
    color: COLORS.gray400,
    marginTop: 4,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.gray100,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  chipSelected: {
    backgroundColor: COLORS.accent,
  },
  chipText: {
    fontSize: 13,
    color: COLORS.gray500,
  },
  chipTextSelected: {
    color: COLORS.white,
    fontWeight: '600',
  },
  monthRow: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  monthChip: {
    backgroundColor: COLORS.gray100,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
  },
  monthChipSelected: {
    backgroundColor: COLORS.accent,
  },
  monthChipText: {
    fontSize: 13,
    color: COLORS.gray500,
  },
  monthChipTextSelected: {
    color: COLORS.white,
    fontWeight: '700',
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  weekdayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    color: COLORS.gray400,
  },
  calendarGrid: {},
  calendarWeekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  dayCell: {
    width: CALENDAR_CELL_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  dayCircle: {
    width: CALENDAR_TRACK_HEIGHT,
    height: CALENDAR_TRACK_HEIGHT,
    borderRadius: CALENDAR_TRACK_HEIGHT / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleSelected: {
    backgroundColor: COLORS.accent,
  },
  dayText: {
    fontSize: 13,
    color: COLORS.black,
  },
  dayTextSelected: {
    color: COLORS.white,
    fontWeight: '700',
  },
  rangeTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    height: CALENDAR_TRACK_HEIGHT,
    position: 'relative',
  },
  // 이어붙은 pill 배경. left/right 인셋은 렌더링 시점에 주입됩니다
  // (원 중심에서 시작/끝나도록 CALENDAR_CELL_WIDTH/2만큼 안쪽으로).
  // 양 끝이 항상 원(circle) 밑에 가려지기 때문에 모서리를 따로
  // 둥글릴 필요가 없어요 — 둥근 느낌은 원이 이미 만들어줍니다.
  rangeTrackBackground: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: '#FFF1E4',
  },
  // 구간 안의 모든 날짜(끝/중간 상관없이)가 이 스타일을 공유합니다.
  // 너비를 평소 dayCell과 똑같은 CALENDAR_CELL_WIDTH로 고정해서
  // 숫자 간격이 항상 일정하게 유지됩니다.
  rangeTrackCell: {
    width: CALENDAR_CELL_WIDTH,
    height: CALENDAR_TRACK_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.gray100,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  stepperLabel: {
    fontSize: 13,
    color: COLORS.black,
    flexShrink: 1,
  },
  partyLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepperButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.black,
    minWidth: 16,
    textAlign: 'center',
  },
  summaryCard: {
    backgroundColor: COLORS.gray100,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summaryLabel: {
    fontSize: 12,
    color: COLORS.gray400,
    width: 56,
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.black,
    flex: 1,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 44,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    flexDirection: 'row',
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonDisabled: {
    backgroundColor: COLORS.gray200,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '700',
  },
  primaryButtonTextDisabled: {
    color: COLORS.gray400,
    fontSize: 15,
    fontWeight: '700',
  },
  successBody: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 8,
  },
  mascotPlaceholder: {
    height: 88,
    marginBottom: 8,
  },
  successTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: COLORS.black,
    marginBottom: 6,
  },
  successTripName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.accent,
    marginBottom: 4,
  },
  successMeta: {
    fontSize: 13,
    color: COLORS.gray500,
    marginBottom: 16,
  },
  successHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
  },
  successHintText: {
    fontSize: 12,
    color: COLORS.gray500,
    textAlign: 'center',
  },
  laterText: {
    fontSize: 13,
    color: COLORS.gray400,
  },
});
