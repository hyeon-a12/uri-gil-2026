import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { router } from 'expo-router';

import { AppText as Text } from '@/components/AppText';
import { HapticPressable } from '@/components/common';

import KakaoMapView, {
  type KakaoMapPin,
} from '@/components/KakaoMapView';

import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import {
  COLORS as SHARED_COLORS,
  RADIUS,
  SPACING,
} from '@/constants/color';

import {
  getDayLabel,
  type PlanStop,
} from '@/services/tripPlanService';

import {
  getStopMemos,
  saveStopMemo,
} from '@/services/stop-memo-service';

/* ============================================================
 * COLORS
 * ============================================================ */

const COLORS = {
  background: SHARED_COLORS.background,
  card: SHARED_COLORS.background,

  primary: SHARED_COLORS.accent,
  primarySoft: SHARED_COLORS.main,

  textPrimary: SHARED_COLORS.textPrimary,
  textSecondary: SHARED_COLORS.textSecondary,
  textTertiary: SHARED_COLORS.textSecondary,

  border: SHARED_COLORS.border,

  routeSoft: '#FFD2C2',
};

/* ============================================================
 * MAP
 * ============================================================ */

const ROUTE_MAP_HEIGHT = 260;

/* ============================================================
 * MEMO MODAL TYPES
 * ============================================================ */

type MemoEditorModalProps = {
  visible: boolean;

  stopName: string | null;

  draft: string;

  onChangeDraft: (
    value: string,
  ) => void;

  onSave: () => void;

  onClose: () => void;
};

/* ============================================================
 * MEMO MODAL
 * ============================================================ */

function MemoEditorModal({
  visible,
  stopName,
  draft,
  onChangeDraft,
  onSave,
  onClose,
}: MemoEditorModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View
        style={
          styles.memoModalBackdrop
        }
      >
        <View
          style={
            styles.memoModalCard
          }
        >
          <Text
            allowFontScaling={
              false
            }
            style={
              styles.memoModalTitle
            }
          >
            {stopName ?? ''} 메모
          </Text>

          <Text
            allowFontScaling={
              false
            }
            style={
              styles.memoModalHint
            }
          >
            좋았던 점, 먹은 음식처럼 남기고 싶은 걸 적어보세요.
          </Text>

          <TextInput
            value={draft}
            onChangeText={
              onChangeDraft
            }
            placeholder="예: 노을이 예뻤고, 옆 포차에서 먹은 딱새우회가 최고였다."
            placeholderTextColor={
              COLORS.textTertiary
            }
            multiline
            autoFocus
            style={
              styles.memoInput
            }
          />

          <View
            style={
              styles.memoModalButtonRow
            }
          >
            <Pressable
              onPress={
                onClose
              }
              style={({
                pressed,
              }) => [
                  styles.memoModalButton,
                  styles.memoModalButtonGhost,

                  pressed &&
                  styles.cardPressed,
                ]}
            >
              <Text
                allowFontScaling={
                  false
                }
                style={
                  styles.memoModalButtonGhostText
                }
              >
                취소
              </Text>
            </Pressable>

            <Pressable
              onPress={
                onSave
              }
              style={({
                pressed,
              }) => [
                  styles.memoModalButton,
                  styles.memoModalButtonPrimary,

                  pressed &&
                  styles.cardPressed,
                ]}
            >
              <Text
                allowFontScaling={
                  false
                }
                style={
                  styles.memoModalButtonPrimaryText
                }
              >
                저장
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* ============================================================
 * PROPS
 * ============================================================ */

export type RoutePlanViewProps = {
  hasTrip: boolean;

  tripId?: string;

  stops: PlanStop[];

  dayNumbers: number[];

  tripStartDate: Date | null;

  onReorderStops: (
    day: number,
    orderedIds: string[],
  ) => void;
};

/* ============================================================
 * ROUTE PLAN VIEW
 * ============================================================ */

export function RoutePlanView({
  hasTrip,
  tripId,
  stops,
  dayNumbers,
  tripStartDate,
  onReorderStops,
}: RoutePlanViewProps) {
  /* ==========================================================
   * DAY
   * ========================================================== */

  const [
    selectedDay,
    setSelectedDay,
  ] = useState(
    dayNumbers[0] ?? 1,
  );

  /* ==========================================================
   * MEMO
   * ========================================================== */

  const [
    stopMemos,
    setStopMemos,
  ] = useState<
    Record<string, string>
  >({});

  const [
    memoModalVisible,
    setMemoModalVisible,
  ] = useState(false);

  const [
    activeStopId,
    setActiveStopId,
  ] = useState<
    string | null
  >(null);

  const [
    memoDraft,
    setMemoDraft,
  ] = useState('');

  /* ==========================================================
   * MEMO LOAD
   * ========================================================== */

  useEffect(() => {
    if (!tripId) {
      setStopMemos({});

      return;
    }

    let isActive =
      true;

    void getStopMemos(
      tripId,
    ).then(
      (memos) => {
        if (
          isActive
        ) {
          setStopMemos(
            memos,
          );
        }
      },
    );

    return () => {
      isActive =
        false;
    };
  }, [tripId]);

  /* ==========================================================
   * DAY RESET
   * ========================================================== */

  useEffect(() => {
    if (
      !dayNumbers.includes(
        selectedDay,
      )
    ) {
      setSelectedDay(
        dayNumbers[0] ??
        1,
      );
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayNumbers]);

  /* ==========================================================
   * SELECTED DAY STOPS
   * ========================================================== */

  const [
    dayStops,
    setDayStops,
  ] = useState<
    PlanStop[]
  >([]);

  useEffect(() => {
    const nextStops =
      stops
        .filter(
          (stop) =>
            stop.day ===
            selectedDay,
        )
        .sort(
          (
            a,
            b,
          ) =>
            a.order -
            b.order,
        );

    setDayStops(
      nextStops,
    );
  }, [
    stops,
    selectedDay,
  ]);

  /* ==========================================================
   * KAKAO MAP PINS
   *
   * 현재 DAY의 장소 중 GPS가 있는 장소만 지도에 표시.
   *
   * HomeScreen의 KakaoMapPin 형식과 동일:
   *
   * {
   *   id,
   *   label,
   *   lat,
   *   lng
   * }
   * ========================================================== */

  const routePins =
    useMemo<
      KakaoMapPin[]
    >(() => {
      return dayStops
        .filter(
          (
            stop,
          ): stop is PlanStop & {
            latitude: number;
            longitude: number;
          } =>
            typeof stop.latitude ===
            'number' &&
            typeof stop.longitude ===
            'number' &&
            Number.isFinite(
              stop.latitude,
            ) &&
            Number.isFinite(
              stop.longitude,
            ) &&
            !(
              stop.latitude ===
              0 &&
              stop.longitude ===
              0
            ),
        )
        .map(
          (
            stop,
            index,
          ) => ({
            id:
              stop.id,

            label:
              String(
                index +
                1,
              ),

            lat:
              stop.latitude,

            lng:
              stop.longitude,
          }),
        );
    }, [dayStops]);

  /* ==========================================================
   * LOCATION STATE
   * ========================================================== */

  const hasDayStops =
    dayStops.length >
    0;

  const hasLocation =
    routePins.length >
    0;

  /* ==========================================================
   * REORDER
   * ========================================================== */

  const moveStop =
    useCallback(
      (
        index: number,
        direction:
          | -1
          | 1,
      ) => {
        const targetIndex =
          index +
          direction;

        if (
          targetIndex <
          0 ||
          targetIndex >=
          dayStops.length
        ) {
          return;
        }

        const next = [
          ...dayStops,
        ];

        const [moved] =
          next.splice(
            index,
            1,
          );

        next.splice(
          targetIndex,
          0,
          moved,
        );

        /*
         * 화면에서 번호도 바로 재계산
         */

        const reordered =
          next.map(
            (
              stop,
              stopIndex,
            ) => ({
              ...stop,

              order:
                stopIndex +
                1,
            }),
          );

        setDayStops(
          reordered,
        );

        onReorderStops(
          selectedDay,

          reordered.map(
            (stop) =>
              stop.id,
          ),
        );
      },

      [
        dayStops,
        selectedDay,
        onReorderStops,
      ],
    );

  /* ==========================================================
   * REORDER MENU
   * ========================================================== */

  const openReorderMenu =
    useCallback(
      (
        stop: PlanStop,
        index: number,
      ) => {
        const options: {
          text: string;

          onPress?: () => void;

          style?:
          | 'cancel'
          | 'destructive';
        }[] = [];

        if (
          index >
          0
        ) {
          options.push({
            text:
              '위로 이동',

            onPress:
              () =>
                moveStop(
                  index,
                  -1,
                ),
          });
        }

        if (
          index <
          dayStops.length -
          1
        ) {
          options.push({
            text:
              '아래로 이동',

            onPress:
              () =>
                moveStop(
                  index,
                  1,
                ),
          });
        }

        options.push({
          text: '취소',

          style:
            'cancel',
        });

        Alert.alert(
          stop.name,

          '순서를 바꿀 수 있어요.',

          options,
        );
      },

      [
        dayStops.length,
        moveStop,
      ],
    );

  /* ==========================================================
   * ACTIVE STOP
   * ========================================================== */

  const activeStop =
    useMemo(
      () =>
        stops.find(
          (stop) =>
            stop.id ===
            activeStopId,
        ) ??
        null,

      [
        stops,
        activeStopId,
      ],
    );

  /* ==========================================================
   * MEMO ACTIONS
   * ========================================================== */

  const openMemoEditor =
    (
      stop: PlanStop,
    ) => {
      setActiveStopId(
        stop.id,
      );

      setMemoDraft(
        stopMemos[
        stop.id
        ] ?? '',
      );

      setMemoModalVisible(
        true,
      );
    };

  const closeMemoEditor =
    () => {
      setMemoModalVisible(
        false,
      );
    };

  const saveMemo =
    () => {
      if (
        activeStopId &&
        tripId
      ) {
        const trimmed =
          memoDraft.trim();

        setStopMemos(
          (prev) => {
            const next =
            {
              ...prev,
            };

            if (
              trimmed.length >
              0
            ) {
              next[
                activeStopId
              ] =
                trimmed;
            } else {
              delete next[
                activeStopId
              ];
            }

            return next;
          },
        );

        void saveStopMemo(
          tripId,
          activeStopId,
          trimmed,
        );
      }

      setMemoModalVisible(
        false,
      );
    };

  /* ==========================================================
   * NO TRIP
   * ========================================================== */

  if (!hasTrip) {
    return (
      <View
        style={
          styles.planEmptyState
        }
      >
        <Image
          source={require('@/assets/images/HanOk.png')}
          style={{
            width: 32,
            height: 32,
          }}
          contentFit="contain"
        />

        <Text
          allowFontScaling={
            false
          }
          style={
            styles.planEmptyTitle
          }
        >
          선택된 여행이 없어요
        </Text>

        <Text
          allowFontScaling={
            false
          }
          style={
            styles.planEmptyDescription
          }
        >
          홈 화면 상단에서 여행을 선택하거나 새로 만들어주세요.
        </Text>
      </View>
    );
  }

  /* ==========================================================
   * NO STOPS
   * ========================================================== */

  if (
    stops.length ===
    0
  ) {
    return (
      <View
        style={
          styles.planEmptyState
        }
      >
        <Ionicons
          name="videocam-outline"
          size={32}
          color={
            COLORS.textTertiary
          }
        />

        <Text
          allowFontScaling={
            false
          }
          style={
            styles.planEmptyTitle
          }
        >
          아직 촬영한 클립이 없어요
        </Text>

        <Text
          allowFontScaling={
            false
          }
          style={
            styles.planEmptyDescription
          }
        >
          카메라로 이 여행의 첫 순간을 기록해보세요.
        </Text>
      </View>
    );
  }

  /* ==========================================================
   * MAIN
   * ========================================================== */

  return (
    <View
      style={
        styles.planScreen
      }
    >
      <ScrollView
        style={
          styles.alternativeView
        }
        contentContainerStyle={
          styles.planContent
        }
        showsVerticalScrollIndicator={
          false
        }
      >
        {/* ====================================================
         * DAY SELECTOR
         * ==================================================== */}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={
            false
          }
          contentContainerStyle={
            styles.dayChipRow
          }
        >
          {dayNumbers.map(
            (day) => {
              const selected =
                day ===
                selectedDay;

              return (
                <HapticPressable
                  key={
                    day
                  }
                  onPress={() =>
                    setSelectedDay(
                      day,
                    )
                  }
                  style={[
                    styles.dayChip,

                    selected &&
                    styles.dayChipSelected,
                  ]}
                >
                  <Text
                    allowFontScaling={
                      false
                    }
                    style={[
                      styles.dayChipText,

                      selected &&
                      styles.dayChipTextSelected,
                    ]}
                  >
                    {getDayLabel(
                      day,
                      tripStartDate,
                    )}
                  </Text>
                </HapticPressable>
              );
            },
          )}
        </ScrollView>

        {/* ====================================================
         * KAKAO MAP
         *
         * 기존 고정 일러스트 지도는 여기서 사용하지 않음.
         * 실제 촬영/저장된 장소 좌표만 표시.
         * ==================================================== */}

        <View
          style={
            styles.routeMapContainer
          }
        >
          {hasLocation ? (
            <KakaoMapView
              pins={
                routePins
              }

              /*
               * 이 화면에서는 현재 위치보다
               * 여행 장소 경로 자체가 중요하므로 null.
               */
              currentLocation={
                null
              }

              height={
                ROUTE_MAP_HEIGHT
              }

              /*
               * HomeScreen과 동일하게 pathColor를 넘기면
               * KakaoMapView 내부에서 핀 순서대로 경로를 연결.
               */
              pathColor={
                COLORS.primary
              }
            />
          ) : (
            <View
              style={
                styles.routeMapEmpty
              }
            >
              <View
                style={
                  styles.routeMapEmptyIcon
                }
              >
                <Ionicons
                  name={
                    hasDayStops
                      ? 'location-outline'
                      : 'map-outline'
                  }
                  size={
                    25
                  }
                  color={
                    COLORS.primary
                  }
                />
              </View>

              <Text
                allowFontScaling={
                  false
                }
                style={
                  styles.routeMapEmptyTitle
                }
              >
                {hasDayStops
                  ? '위치 정보가 없어요'
                  : '이 날짜에 등록된 장소가 없어요'}
              </Text>

              <Text
                allowFontScaling={
                  false
                }
                style={
                  styles.routeMapEmptyDescription
                }
              >
                {hasDayStops
                  ? '위치가 저장된 클립을 촬영하면 여행 경로가 지도에 표시됩니다.'
                  : '영상을 촬영하거나 장소를 추가하면 이곳에 여행 경로가 표시됩니다.'}
              </Text>
            </View>
          )}
        </View>

        {/* ====================================================
         * MAP SUMMARY
         * ==================================================== */}

        {hasLocation ? (
          <View
            style={
              styles.routeSummaryRow
            }
          >
            <View
              style={
                styles.routeSummaryIcon
              }
            >
              <Ionicons
                name="navigate-outline"
                size={14}
                color={
                  COLORS.primary
                }
              />
            </View>

            <Text
              allowFontScaling={
                false
              }
              style={
                styles.routeSummaryText
              }
            >
              DAY {selectedDay} · 위치가 기록된 장소 {routePins.length}곳
            </Text>
          </View>
        ) : null}

        {/* ====================================================
         * TIMELINE
         * ==================================================== */}

        <View
          style={
            styles.planTimeline
          }
        >
          {dayStops.map(
            (
              stop,
              index,
            ) => {
              const memo =
                stopMemos[
                stop.id
                ];

              const hasStopLocation =
                typeof stop.latitude ===
                'number' &&
                typeof stop.longitude ===
                'number' &&
                Number.isFinite(
                  stop.latitude,
                ) &&
                Number.isFinite(
                  stop.longitude,
                ) &&
                !(
                  stop.latitude ===
                  0 &&
                  stop.longitude ===
                  0
                );

              return (
                <View
                  key={
                    stop.id
                  }
                  style={
                    styles.planTimelineRow
                  }
                >
                  {/* ==========================================
                   * 번호 + 연결선
                   * ========================================== */}

                  <View
                    style={
                      styles.planTimelineIndicator
                    }
                  >
                    <View
                      style={
                        styles.planTimelineDot
                      }
                    >
                      <Text
                        allowFontScaling={
                          false
                        }
                        style={
                          styles.planTimelineDotText
                        }
                      >
                        {index +
                          1}
                      </Text>
                    </View>

                    {index <
                      dayStops.length -
                      1 ? (
                      <View
                        style={
                          styles.planTimelineLineArea
                        }
                      >
                        <View
                          style={
                            styles.planTimelineLine
                          }
                        />
                      </View>
                    ) : null}
                  </View>

                  {/* ==========================================
                   * STOP CARD
                   * ========================================== */}

                  <Pressable
                    style={
                      styles.planStopCard
                    }
                    onLongPress={() =>
                      openReorderMenu(
                        stop,
                        index,
                      )
                    }
                  >
                    <View
                      style={
                        styles.planStopCardTop
                      }
                    >
                      <View
                        style={
                          styles.planStopStickerCircle
                        }
                      >
                        <Ionicons
                          name={
                            hasStopLocation
                              ? 'location'
                              : 'location-outline'
                          }
                          size={
                            18
                          }
                          color={
                            hasStopLocation
                              ? COLORS.primary
                              : COLORS.textTertiary
                          }
                        />
                      </View>

                      <View
                        style={
                          styles.planStopTextArea
                        }
                      >
                        <Text
                          numberOfLines={
                            1
                          }
                          allowFontScaling={
                            false
                          }
                          style={
                            styles.planStopName
                          }
                        >
                          {
                            stop.name
                          }
                        </Text>

                        <Text
                          allowFontScaling={
                            false
                          }
                          style={
                            styles.planStopMeta
                          }
                        >
                          {stop.source ===
                            'ai-recommendation'
                            ? 'AI 추천으로 추가됨'
                            : stop.source ===
                              'manual'
                              ? '직접 추가한 장소'
                              : `${stop.time} · 클립 ${stop.clips.length}개`}
                        </Text>

                        {!hasStopLocation ? (
                          <Text
                            allowFontScaling={
                              false
                            }
                            style={
                              styles.planStopLocationWarning
                            }
                          >
                            위치 정보 없음
                          </Text>
                        ) : null}
                      </View>

                      <Pressable
                        hitSlop={
                          8
                        }
                        onPress={() =>
                          openReorderMenu(
                            stop,
                            index,
                          )
                        }
                        style={
                          styles.planStopIconButton
                        }
                      >
                        <Ionicons
                          name="ellipsis-vertical"
                          size={
                            18
                          }
                          color={
                            COLORS.textSecondary
                          }
                        />
                      </Pressable>
                    </View>

                    {/* ========================================
                     * MEMO
                     * ======================================== */}

                    {memo ? (
                      <Pressable
                        onPress={() =>
                          openMemoEditor(
                            stop,
                          )
                        }
                        style={({
                          pressed,
                        }) => [
                            styles.planStopMemoBox,

                            pressed &&
                            styles.cardPressed,
                          ]}
                      >
                        <Text
                          numberOfLines={
                            3
                          }
                          allowFontScaling={
                            false
                          }
                          style={
                            styles.planStopMemoText
                          }
                        >
                          {
                            memo
                          }
                        </Text>
                      </Pressable>
                    ) : (
                      <Pressable
                        onPress={() =>
                          openMemoEditor(
                            stop,
                          )
                        }
                        style={({
                          pressed,
                        }) => [
                            styles.planStopMemoEmpty,

                            pressed &&
                            styles.cardPressed,
                          ]}
                      >
                        <Ionicons
                          name="add"
                          size={
                            13
                          }
                          color={
                            COLORS.textTertiary
                          }
                        />

                        <Text
                          allowFontScaling={
                            false
                          }
                          style={
                            styles.planStopMemoEmptyText
                          }
                        >
                          메모 남기기
                        </Text>
                      </Pressable>
                    )}
                  </Pressable>
                </View>
              );
            },
          )}

          {/* ==================================================
           * ADD PLACE
           * ================================================== */}

          <View
            style={
              styles.planAddRow
            }
          >
            <Pressable
              onPress={() => {
                if (
                  !tripId
                ) {
                  return;
                }

                router.push({
                  pathname:
                    '/add-place',

                  params: {
                    tripId,

                    day: String(
                      selectedDay,
                    ),
                  },
                });
              }}
              style={({
                pressed,
              }) => [
                  styles.planAddButton,

                  pressed &&
                  styles.cardPressed,
                ]}
            >
              <Ionicons
                name="add"
                size={16}
                color={
                  COLORS.textSecondary
                }
              />

              <Text
                allowFontScaling={
                  false
                }
                style={
                  styles.planAddButtonText
                }
              >
                장소 추가
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {/* ======================================================
       * MEMO MODAL
       * ====================================================== */}

      <MemoEditorModal
        visible={
          memoModalVisible
        }
        stopName={
          activeStop?.name ??
          null
        }
        draft={
          memoDraft
        }
        onChangeDraft={
          setMemoDraft
        }
        onSave={
          saveMemo
        }
        onClose={
          closeMemoEditor
        }
      />
    </View>
  );
}

/* ============================================================
 * STYLES
 * ============================================================ */

const styles =
  StyleSheet.create({
    /* ========================================================
     * COMMON
     * ======================================================== */

    cardPressed: {
      opacity: 0.8,

      transform: [
        {
          scale: 0.99,
        },
      ],
    },

    alternativeView: {
      flex: 1,
    },

    planScreen: {
      flex: 1,

      backgroundColor:
        COLORS.background,
    },

    /* ========================================================
     * EMPTY STATE
     * ======================================================== */

    planEmptyState: {
      flex: 1,

      alignItems:
        'center',

      justifyContent:
        'center',

      paddingHorizontal:
        40,

      paddingBottom:
        120,

      gap: SPACING.sm,
    },

    planEmptyTitle: {
      marginTop:
        SPACING.xs,

      color:
        COLORS.textPrimary,

      fontSize: 15,

      lineHeight: 21,

      fontWeight:
        '700',
    },

    planEmptyDescription:
    {
      color:
        COLORS.textSecondary,

      fontSize: 12,

      lineHeight: 18,

      fontWeight:
        '500',

      textAlign:
        'center',
    },

    /* ========================================================
     * CONTENT
     * ======================================================== */

    planContent: {
      paddingHorizontal:
        SPACING.screenH,

      paddingTop:
        SPACING.md,

      paddingBottom:
        190,
    },

    /* ========================================================
     * DAY SELECTOR
     * ======================================================== */

    dayChipRow: {
      flexDirection:
        'row',

      gap:
        SPACING.sm,

      paddingBottom:
        SPACING.xs,
    },

    dayChip: {
      flexDirection:
        'row',

      alignItems:
        'center',

      paddingHorizontal:
        SPACING.md,

      paddingVertical:
        SPACING.sm,

      borderRadius:
        RADIUS.banner,

      backgroundColor:
        SHARED_COLORS.surface,
    },

    dayChipSelected: {
      backgroundColor:
        COLORS.primary,
    },

    dayChipText: {
      color:
        COLORS.textPrimary,

      fontSize: 13,

      fontWeight:
        '400',
    },

    dayChipTextSelected:
    {
      color:
        '#FFFFFF',

      fontWeight:
        '700',
    },

    /* ========================================================
     * KAKAO MAP
     * ======================================================== */

    routeMapContainer: {
      width: '100%',

      height:
        ROUTE_MAP_HEIGHT,

      marginTop: 20,

      borderRadius:
        24,

      overflow:
        'hidden',

      backgroundColor:
        '#F5F5F3',

      borderWidth: 1,

      borderColor:
        'rgba(20, 20, 20, 0.05)',
    },

    routeMapEmpty: {
      flex: 1,

      alignItems:
        'center',

      justifyContent:
        'center',

      paddingHorizontal:
        30,

      backgroundColor:
        '#F7F6F3',
    },

    routeMapEmptyIcon:
    {
      width: 50,

      height: 50,

      borderRadius:
        25,

      alignItems:
        'center',

      justifyContent:
        'center',

      marginBottom:
        10,

      backgroundColor:
        COLORS.primarySoft,
    },

    routeMapEmptyTitle:
    {
      color:
        COLORS.textPrimary,

      fontSize: 14,

      lineHeight: 20,

      fontWeight:
        '700',
    },

    routeMapEmptyDescription:
    {
      maxWidth: 250,

      marginTop: 6,

      color:
        COLORS.textSecondary,

      fontSize: 11,

      lineHeight: 17,

      fontWeight:
        '500',

      textAlign:
        'center',
    },

    /* ========================================================
     * MAP SUMMARY
     * ======================================================== */

    routeSummaryRow: {
      flexDirection:
        'row',

      alignItems:
        'center',

      marginTop: 10,

      paddingHorizontal:
        4,
    },

    routeSummaryIcon: {
      width: 26,

      height: 26,

      borderRadius:
        13,

      alignItems:
        'center',

      justifyContent:
        'center',

      marginRight: 7,

      backgroundColor:
        COLORS.primarySoft,
    },

    routeSummaryText: {
      color:
        COLORS.textSecondary,

      fontSize: 11,

      lineHeight: 15,

      fontWeight:
        '600',
    },

    /* ========================================================
     * TIMELINE
     * ======================================================== */

    planTimeline: {
      marginTop: 28,
    },

    planTimelineRow:
    {
      flexDirection:
        'row',

      gap:
        SPACING.sm,
    },

    planTimelineIndicator:
    {
      width: 40,

      alignItems:
        'center',
    },

    planTimelineDot: {
      width: 22,

      height: 22,

      borderRadius:
        11,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        COLORS.primary,
    },

    planTimelineDotText:
    {
      color:
        '#FFFFFF',

      fontSize: 10,

      lineHeight: 13,

      fontWeight:
        '800',
    },

    planTimelineLineArea:
    {
      flex: 1,

      width:
        '100%',

      minHeight: 40,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    planTimelineLine: {
      position:
        'absolute',

      top: 3,

      bottom: 3,

      width: 2,

      backgroundColor:
        COLORS.routeSoft,
    },

    /* ========================================================
     * STOP CARD
     * ======================================================== */

    planStopStickerCircle:
    {
      width: 44,

      height: 44,

      marginRight:
        SPACING.sm,

      borderRadius:
        RADIUS.sheet,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        COLORS.primarySoft,
    },

    planStopCard: {
      flex: 1,

      marginBottom:
        SPACING.sm,

      paddingHorizontal:
        13,

      paddingVertical:
        SPACING.sm,

      borderRadius:
        RADIUS.banner,

      backgroundColor:
        '#FBFBFA',
    },

    planStopCardTop: {
      flexDirection:
        'row',

      alignItems:
        'center',
    },

    planStopTextArea: {
      flex: 1,

      minWidth: 0,
    },

    planStopName: {
      color:
        COLORS.textPrimary,

      fontSize: 14,

      lineHeight: 19,

      fontWeight:
        '700',
    },

    planStopMeta: {
      marginTop:
        SPACING.xs,

      color:
        COLORS.textSecondary,

      fontSize: 11,

      lineHeight: 16,

      fontWeight:
        '500',
    },

    planStopLocationWarning:
    {
      marginTop: 2,

      color:
        '#B6AAA0',

      fontSize: 10,

      lineHeight: 14,

      fontWeight:
        '500',
    },

    planStopIconButton:
    {
      width: 30,

      height: 30,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    /* ========================================================
     * MEMO
     * ======================================================== */

    planStopMemoBox: {
      marginTop:
        SPACING.sm,

      paddingHorizontal:
        11,

      paddingVertical:
        SPACING.sm,

      borderRadius:
        RADIUS.card,

      backgroundColor:
        COLORS.primarySoft,
    },

    planStopMemoText: {
      color:
        COLORS.textPrimary,

      fontSize: 12,

      lineHeight: 18,

      fontWeight:
        '500',
    },

    planStopMemoEmpty:
    {
      marginTop:
        SPACING.sm,

      paddingVertical:
        SPACING.sm,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'center',

      gap:
        SPACING.xs,

      borderRadius:
        RADIUS.card,

      borderWidth: 1,

      borderColor:
        COLORS.border,

      borderStyle:
        'dashed',
    },

    planStopMemoEmptyText:
    {
      color:
        COLORS.textTertiary,

      fontSize: 11,

      lineHeight: 15,

      fontWeight:
        '600',
    },

    /* ========================================================
     * ADD PLACE
     * ======================================================== */

    planAddRow: {
      flexDirection:
        'row',

      gap:
        SPACING.sm,

      marginTop:
        SPACING.xs,
    },

    planAddButton: {
      flex: 1,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'center',

      gap:
        SPACING.xs,

      paddingVertical:
        11,

      borderRadius:
        RADIUS.card,

      borderWidth: 1,

      borderColor:
        COLORS.border,

      borderStyle:
        'dashed',
    },

    planAddButtonText:
    {
      color:
        COLORS.textSecondary,

      fontSize: 12,

      lineHeight: 16,

      fontWeight:
        '700',
    },

    /* ========================================================
     * MODAL
     * ======================================================== */

    memoModalBackdrop:
    {
      flex: 1,

      alignItems:
        'center',

      justifyContent:
        'center',

      paddingHorizontal:
        28,

      backgroundColor:
        'rgba(20,20,18,0.45)',
    },

    memoModalCard: {
      width:
        '100%',

      paddingHorizontal:
        SPACING.screenH,

      paddingTop:
        SPACING.screenH,

      paddingBottom:
        SPACING.md,

      borderRadius:
        RADIUS.sheet,

      backgroundColor:
        COLORS.card,
    },

    memoModalTitle: {
      color:
        COLORS.textPrimary,

      fontSize: 16,

      lineHeight: 22,

      fontWeight:
        '600',
    },

    memoModalHint: {
      marginTop:
        SPACING.xs,

      color:
        COLORS.textSecondary,

      fontSize: 12,

      lineHeight: 17,

      fontWeight:
        '500',
    },

    memoInput: {
      marginTop:
        SPACING.md,

      minHeight: 96,

      paddingHorizontal:
        13,

      paddingVertical:
        11,

      borderRadius:
        RADIUS.card,

      color:
        COLORS.textPrimary,

      fontSize: 14,

      lineHeight: 19,

      fontFamily:
        'Pretendard-Medium',

      textAlignVertical:
        'top',

      backgroundColor:
        COLORS.primarySoft,
    },

    memoModalButtonRow:
    {
      flexDirection:
        'row',

      gap:
        SPACING.sm,

      marginTop:
        SPACING.md,
    },

    memoModalButton: {
      flex: 1,

      alignItems:
        'center',

      justifyContent:
        'center',

      paddingVertical:
        SPACING.sm,

      borderRadius:
        RADIUS.card,
    },

    memoModalButtonGhost:
    {
      backgroundColor:
        COLORS.background,

      borderWidth: 1,

      borderColor:
        COLORS.border,
    },

    memoModalButtonGhostText:
    {
      color:
        COLORS.textSecondary,

      fontSize: 13,

      lineHeight: 17,

      fontWeight:
        '700',
    },

    memoModalButtonPrimary:
    {
      backgroundColor:
        COLORS.primary,
    },

    memoModalButtonPrimaryText:
    {
      color:
        '#FFFFFF',

      fontSize: 13,

      lineHeight: 17,

      fontWeight:
        '800',
    },
  });

export default RoutePlanView;