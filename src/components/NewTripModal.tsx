import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  Dimensions,
  StyleProp,
  ViewStyle,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { ShootingStyleId } from '@/services/folderService';
import { COLORS as SHARED_COLORS } from '@/constants/color';

/**
 * ─────────────────────────────────────────────────────────────
 * ⚠️ 색상 관련 참고
 * ─────────────────────────────────────────────────────────────
 * 단색 #FF7F5C 버튼으로 통일하고 싶으시면
 * GRADIENT 배열을 안 쓰고 backgroundColor: COLORS.accent 하나로 바꾸시면 됩니다
 * (아래 PrimaryButton 컴포넌트 안에 분기 처리해뒀어요).
 * 팔레트 v1에서 이 그라데이션은 공식적으로 사용 허용됐습니다.
 */
const COLORS = {
  accent: SHARED_COLORS.accent,
  accentDark: SHARED_COLORS.accentPressed,
  dark: '#1E2128',
  black: SHARED_COLORS.textPrimary,
  gray500: SHARED_COLORS.textSecondary,
  gray400: SHARED_COLORS.textSecondary,
  gray200: SHARED_COLORS.border,
  gray100: SHARED_COLORS.surface,
  white: SHARED_COLORS.background,
};
const GRADIENT: [string, string] = [SHARED_COLORS.gradientStart, SHARED_COLORS.accent];

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
// 1단계(기본 정보)와 3단계(테마)를 한 화면으로 합쳐서 전체 4단계 → 3단계로 줄었습니다.
type Step = 1 | 2 | 3 | 'success';

// ShootingStyleId는 저장 스키마(FolderItem)에도 쓰여서 folderService.ts로 옮겼습니다.
// 촬영 스타일을 실제로 고르는 과정은 여행 생성 모달이 아니라 카메라 화면(CameraScreen)으로
// 옮겨졌어요 — 촬영 버튼을 누른 그 화면에서 정할 수 있게요. 여기 TripForm에는 여전히
// 필드가 남아있는데, FolderItem 저장 스키마와 다른 화면들(clip-manage, MyRoutesScreen 등)이
// 이 필드를 그대로 읽어가기 때문에 기본값만 채워서 넘겨줍니다.

type TripForm = {
  name: string;
  region: string | null;
  memo: string;
  startDate: Date | null;
  endDate: Date | null;
  partySize: number;
  themes: string[];
  clipLengthSeconds: number;
  shootingStyle: ShootingStyleId;
};

const INITIAL_FORM: TripForm = {
  name: '',
  region: null,
  memo: '',
  startDate: null,
  endDate: null,
  partySize: 1,
  themes: [],
  // 카메라 촬영 시간은 3초로 고정 — 더는 여행 만들기 단계에서 초수를 묻지 않아요.
  clipLengthSeconds: 3,
  // 촬영 스타일은 카메라 화면에서 정하니, 여기서는 저장 스키마용 기본값만 둡니다.
  shootingStyle: 'basic',
};

type Props = {
  visible: boolean;
  onClose: () => void;
  /** 여행 생성이 최종 확정된 순간 부모(Home/내 루트)에 데이터를 넘겨줍니다. */
  onCreated: (trip: TripForm & { startDate: Date; endDate: Date }) => void;
  /** 'edit'이면 새 여행 만들기 마법사 대신 기존 여행의 설정값을 수정하는 용도로 동작합니다. */
  mode?: 'create' | 'edit';
  /** mode가 'edit'일 때 폼을 채울 기존 여행 값. */
  initialValues?: Partial<TripForm> & { startDate: Date; endDate: Date };
  /** mode가 'edit'일 때 저장 버튼을 눌렀을 때 호출됩니다. */
  onSaved?: (trip: TripForm & { startDate: Date; endDate: Date }) => void;
  /** mode가 'edit'일 때만 노출되는 여행 삭제 버튼의 콜백. */
  onDelete?: () => void;
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
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
}) {
  if (disabled) {
    return (
      <View style={[styles.primaryButton, styles.primaryButtonDisabled, style]}>
        <Text style={styles.primaryButtonTextDisabled}>{label}</Text>
      </View>
    );
  }
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={style}>
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
  totalSteps = 3,
}: {
  currentStep: 1 | 2 | 3;
  label: string;
  totalSteps?: number;
}) {
  const stepNumbers = Array.from({ length: totalSteps }, (_, i) => i + 1);
  return (
    <View style={styles.stepIndicatorRow}>
      {stepNumbers.map((step, idx) => {
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
            {idx < stepNumbers.length - 1 && <View style={styles.stepDivider} />}
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
export default function NewTripModal({
  visible,
  onClose,
  onCreated,
  mode = 'create',
  initialValues,
  onSaved,
  onDelete,
}: Props) {
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<TripForm>(INITIAL_FORM);

  // 수정 모드로 열릴 때마다 기존 여행 값으로 폼을 채우고 1단계부터 보여줍니다.
  useEffect(() => {
    if (!visible) return;
    if (mode === 'edit' && initialValues) {
      setForm({ ...INITIAL_FORM, ...initialValues });
    } else {
      setForm(INITIAL_FORM);
    }
    setStep(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, mode]);

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

  function handleSave() {
    const { startDate, endDate } = form;
    if (!startDate || !endDate) return;
    onSaved?.({ ...form, startDate, endDate });
    handleClose();
  }

  function handleDeletePress() {
    Alert.alert('여행 삭제', `${form.name || '이 여행'}을(를) 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () => {
          onDelete?.();
          handleClose();
        },
      },
    ]);
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
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.card}>
          {step !== 'success' && (
            <>
              <View style={styles.headerRow}>
                <Text style={styles.headerTitle}>
                  {mode === 'edit' ? '여행 설정' : '새 여행 만들기'}
                </Text>
                <View style={styles.headerActions}>
                  {mode === 'edit' && (
                    <TouchableOpacity
                      onPress={handleDeletePress}
                      hitSlop={10}
                      style={{ marginRight: 16 }}
                    >
                      <Ionicons name="trash-outline" size={20} color={COLORS.accent} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={handleClose} hitSlop={10}>
                    <Ionicons name="close" size={22} color={COLORS.gray500} />
                  </TouchableOpacity>
                </View>
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
              <View style={styles.inputWithCounter}>
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
              </View>

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
                    label={mode === 'edit' ? '저장' : '여행 만들기!'}
                    icon={mode === 'edit' ? undefined : 'airplane-outline'}
                    onPress={mode === 'edit' ? handleSave : handleCreate}
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

              <View style={{ height: 20 }} />
              <PrimaryButton
                label="완료"
                onPress={handleClose}
                style={{ width: '91%' }}
              />
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
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
    paddingTop: 22,
    maxHeight: SCREEN_HEIGHT * 0.9, // 화면 높이를 넘지 않도록 90%로 상한
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
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
  inputWithCounter: {
    position: 'relative',
  },
  charCount: {
    position: 'absolute',
    right: 14,
    bottom: 12,
    fontSize: 11,
    color: COLORS.gray400,
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
  rangeTrackBackground: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: '#FFF1E4',
  },
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
});
