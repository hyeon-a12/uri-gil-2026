import { useState, type ReactNode } from 'react';
import { Feather } from '@expo/vector-icons';
import { TripSwitchSheet } from '@/components/common/TripSwitchSheet';
import { useTripStore } from '@/store/useTripStore';
import { useWebMenuStore } from '@/store/useWebMenuStore';

/**
 * Manus 프로토타입의 AppHeader를 그대로 옮긴 웹 전용 상단 바입니다.
 * title이 없으면(홈 화면) 현재 여행 이름 + 전환 버튼을, 있으면(다른 화면)
 * 뒤로가기 + 화면 제목을 보여줍니다. 오른쪽 메뉴 버튼은 항상 있고,
 * useWebMenuStore를 통해 (tabs)/_layout.tsx가 그리는 사이드 메뉴를 엽니다.
 *
 * 여행 전환은 프로토타입엔 없던 실제 기능(TripSwitchSheet, 기존 홈 화면의
 * TripSelector가 쓰던 것과 동일한 컴포넌트)을 그대로 연결했습니다 — 디자인만
 * 새로 입히고 "여행 바꾸기"라는 실제 동작은 원래 있던 걸 재사용합니다.
 */

export const APP_HEADER_STYLES = `
  /*
   * expo-font가 웹에 등록하는 폰트 family 이름은 "Pretendard"가 아니라
   * "Pretendard-Regular", "Pretendard-Bold"처럼 굵기별 이름 그대로입니다
   * (RN의 AppText가 fontWeight → fontFamily로 바꿔치기하는 것과 같은 이유).
   * 그냥 font-family: Pretendard로 쓰면 매칭되는 폰트가 없어서 브라우저
   * 기본 sans-serif로 조용히 대체되는데, 시각적으로는 다른 화면(RN Text로
   * 그려지는 화면들)과 글꼴 자체가 달라 보이는 문제가 있었습니다.
   */
  .uri-app-header { position: relative; display: flex; align-items: center; justify-content: space-between; height: 68px; padding: 0 18px; font-family: 'Pretendard-Regular', sans-serif; }
  .uri-app-header strong { position: absolute; left: 0; right: 0; text-align: center; pointer-events: none; font-size: 17px; letter-spacing: -0.05em; color: #222; font-family: 'Pretendard-Bold', sans-serif; font-weight: normal; }
  .uri-trip-select { display: flex; align-items: center; gap: 5px; padding: 10px 6px; border-radius: 8px; font-size: 18px; font-family: 'Pretendard-Bold', sans-serif; font-weight: normal; letter-spacing: -0.065em; color: #222; background: none; border: 0; cursor: pointer; }
  .uri-icon-button {
    width: 38px; height: 38px; border-radius: 12px; display: grid; place-items: center;
    color: #222; background: none; border: 0; cursor: pointer; transition: background 0.15s cubic-bezier(.23,1,.32,1);
  }
  .uri-icon-button:hover { background: #F5F5F5; }
`;

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button aria-label={label} onClick={onClick} className="uri-icon-button">
      {children}
    </button>
  );
}

export function AppHeader({ title, onBack }: { title?: string; onBack?: () => void }) {
  const currentTrip = useTripStore((state) => state.currentTrip);
  const [sheetVisible, setSheetVisible] = useState(false);
  const openMenu = useWebMenuStore((state) => state.open);

  return (
    <>
      <style>{APP_HEADER_STYLES}</style>
      <header className="uri-app-header">
        {title ? (
          <>
            <IconButton label="뒤로가기" onClick={onBack}>
              <Feather name="chevron-left" size={22} color="#222" />
            </IconButton>
            <strong>{title}</strong>
          </>
        ) : (
          <button className="uri-trip-select" onClick={() => setSheetVisible(true)}>
            {currentTrip ? currentTrip.title : '여행을 선택해주세요'}
            <Feather name="chevron-down" size={16} color="#222" />
          </button>
        )}

        <IconButton label="메뉴" onClick={openMenu}>
          <Feather name="menu" size={23} color="#222" />
        </IconButton>
      </header>

      <TripSwitchSheet visible={sheetVisible} onClose={() => setSheetVisible(false)} />
    </>
  );
}
