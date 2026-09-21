// 웹에서 "실제 모바일 기기로 접속했는지"를 User-Agent로 판별합니다.
//
// 390px(MOBILE_WEB_FRAME_WIDTH) 고정 프레임은 원래 데스크톱 브라우저에
// 390px 미리보기를 보여주기 위한 것인데, 아이폰 프로맥스(430px) 같은
// 390px보다 넓은 실제 모바일 기기도 창 폭만 보면 똑같이 넓다고 판단돼서
// 화면 폭만으로는 데스크톱과 구분할 수 없습니다. 그래서 User-Agent로 실제
// 모바일 기기 여부를 따로 판별합니다. UA는 세션 중 바뀌지 않으므로 모듈
// 로드 시 한 번만 계산해서 재사용합니다.
export const isMobileUserAgent =
  typeof navigator !== 'undefined' &&
  /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent ?? '');
