import { useState } from 'react';
import { Alert } from 'react-native';
import NewTripModal from '@/components/NewTripModal';
import { saveFolder, updateFolder, type FolderItem } from '@/services/folderService';
import { selectCurrentTrip } from '@/store/useTripStore';
import { apiFetch } from '@/services/api';

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}.${month}.${day}.`;
}

// 서버(Pydantic date 타입)로 보낼 땐 YYYY-MM-DD 형식이 필요함
function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * "새 여행 만들기" 모달(NewTripModal)을 여는 로직을 홈 화면 여행 선택 바(TripSelector)와
 * 여행 전환 시트(TripSwitchSheet) 양쪽에서 그대로 재사용하기 위해 뽑아낸 훅입니다.
 * 저장 → 현재 여행으로 전환 → 서버 동기화까지 한 곳에서만 관리해서 두 곳이 어긋나지 않게 합니다.
 */
export function useCreateTripModal(onAfterCreate?: () => void) {
  const [visible, setVisible] = useState(false);

  const openCreateModal = () => setVisible(true);
  const closeCreateModal = () => setVisible(false);

  const handleCreatedTrip: React.ComponentProps<typeof NewTripModal>['onCreated'] = async (
    trip,
  ) => {
    const folder: FolderItem = {
      id: `folder-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: trip.name.trim(),
      dateRange: `${formatDate(trip.startDate)} ~ ${formatDate(trip.endDate)}`,
      thumbnail: '',
      region: trip.region,
      memo: trip.memo,
      partySize: trip.partySize,
      themes: trip.themes,
      clipLengthSeconds: trip.clipLengthSeconds,
      shootingStyle: trip.shootingStyle,
    };

    try {
      // 1. 로컬 저장 먼저 (오프라인이어도 여행 생성 자체는 항상 성공하도록)
      await saveFolder(folder);
      await selectCurrentTrip(folder);
      onAfterCreate?.();

      // 2. 서버에도 저장 시도 (실패해도 로컬 흐름은 막지 않음)
      try {
        const serverRoute = await apiFetch('/routes/', {
          method: 'POST',
          body: JSON.stringify({
            title: trip.name.trim(),
            region: trip.region,
            theme: trip.themes.join(','),
            description: trip.memo || null,
            start_date: toIsoDate(trip.startDate),
            end_date: toIsoDate(trip.endDate),
            member_count: trip.partySize,
          }),
        });

        // 서버가 발급한 route_id를 로컬 데이터에도 연결해둠
        await updateFolder(folder.id, { routeId: serverRoute.id });
      } catch (serverError) {
        console.error('[useCreateTripModal] 서버 저장 실패 (로컬은 저장됨):', serverError);
      }
    } catch (error) {
      console.error('[useCreateTripModal] 새 여행 저장에 실패했습니다.', error);
      Alert.alert('여행 생성 실패', '새 여행을 저장하지 못했습니다.');
    }
  };

  return { visible, openCreateModal, closeCreateModal, handleCreatedTrip };
}
