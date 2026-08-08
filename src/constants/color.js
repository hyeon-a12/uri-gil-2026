// src/constants/colors.js
//
// 앱 전체에서 쓰는 색상을 한 곳에 모아놓은 파일
// 왜?
// - 디자인 변경될 때 이 파일만 수정하면 앱 전체에 반영
// - "저 화면에서 쓴 파란색이 뭐였지?" 할 때 여기만 보면 됨
// - 오타로 색상 코드 잘못 쓰는 실수를 방지해요

export const COLORS = {
  // 포인트 컬러 (이 색 하나만 강조색으로 사용)
  primary: '#FFB134',
  primaryTint: '#FFF3DF',   // 프로모션 배지, 태그 배경 등 연한 포인트 컬러

  // 배경
  white: '#FFFFFF',
  surface: '#F5F5F5',      // 카드나 섹션 배경에 쓰는 연한 회색

  // 텍스트
  text: '#222222',          // 제목, 중요한 텍스트
  textSecondary: '#8A8A8A',  // 부가 설명, 덜 중요한 텍스트
  textTertiary: '#8A8A8A',   // placeholder, 비활성 텍스트

  // 선, 구분선
  border: '#DDDDDD',

  // 네비게이션 바
  navBar: '#1A1A1A',
  navInactive: '#666666',

  // 핑 상태
  pinVisited: '#FFB134',           // 방문 완료 (포인트 컬러 그대로)
  pinUnvisited: '#FFB13435',       // 미방문 (같은 색인데 투명도 20%)
  // 뒤에 35는 16진수 투명도예요. 00=완전투명, FF=불투명, 35≒20%

  // 기능 색상
  success: '#4CAF50',       // 완료, 성공
  danger: '#FF4444',        // 삭제, 에러, 촬영 중 빨간불

  // 장소 확인 화면 (Figma)
  locationSheet: '#E9EDF5',
  locationSelect: '#FFB134',
  locationButtonDisabled: '#D8D3CE',
  locationDragHandle: '#C8CDD8',

  // 카메라 화면 (Figma)
  cameraSidebar: 'rgba(0, 0, 0, 0.42)',
  cameraRecordingBorder: '#8B7FD8',
  cameraRecord: '#FF4444',
  cameraZoomActive: '#FFD54F',
};
