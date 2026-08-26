# 폰트 라이센스 관리

`assets/fonts/`에 폰트를 새로 추가할 때마다 아래 표에 한 줄씩 추가합니다.
라이센스 원문은 `LICENSE-{폰트명}.txt`로 폰트별로 따로 저장합니다.

| 폰트명 | 파일 | 출처 | 라이센스 | 상업적 이용 | 재배포/수정 | 상태 |
|---|---|---|---|---|---|---|
| Spoqa Han Sans Neo | `SpoqaHanSansNeo-{Thin,Light,Regular,Medium,Bold}.ttf` | spoqa.com | SIL OFL 1.1 — `LICENSE-SpoqaHanSansNeo.txt` | 가능 (번들/임베드 포함) | 가능. 폰트 단독 판매 금지, Reserved Font Name 재사용 금지 | ✅ 등록됨 — 앱 전역 기본 폰트 (`src/app/_layout.tsx`). 웹 전용 포맷(eot/woff/woff2)은 RN에서 안 써서 삭제 |
| Pretendard 1.3.9 | `Pretendard-{Regular,Bold}.ttf` | github.com/orioncactus/pretendard | SIL OFL 1.1 — `LICENSE-Pretendard-1.3.9.txt` | 가능 | 가능. 폰트 단독 판매 금지, Reserved Font Name(Pretendard) 재사용 금지 | ✅ 등록됨 — `video-edit.tsx` 글꼴 선택(`Regular`/`Bold` 웨이트, B 토글). 미사용 웨이트(Thin/ExtraLight/Light/Medium/SemiBold/ExtraBold/Black)는 삭제 |
| 마루 부리 (MaruBuri) | `MaruBuri-{Regular,Bold}.ttf` | hangeul.naver.com (네이버 나눔글꼴) | SIL OFL 1.1 — `LICENSE-MaruBuri.txt` | 가능 | 가능. 폰트 자체 유료 판매만 금지, 출처 표기는 권장(의무 아님) | ✅ 등록됨 — `video-edit.tsx` 글꼴 선택(`Regular`/`Bold` 웨이트, B 토글). 미사용 웨이트(ExtraLight/Light/SemiBold)는 삭제 |
| 케리스 케듀체 (KERISKEDU) | `KERISKEDU_{R,B}.{ttf,otf}` | copyright.keris.or.kr / noonnu.cc(font_page/1756) | SIL OFL 1.1 — `LICENSE-KERISKEDU.txt` | 가능 | 가능. 폰트 파일 자체 유료 판매·유료 수정대행만 금지, 출처 표기 의무 없음 | ✅ 등록됨 — `video-edit.tsx` 글꼴 선택(`_R`/`_B` 웨이트, B 토글) |
| 학교안심 나들이 (Hakgyoansim Nadeuri) | `HakgyoansimNadeuri-{Light,Bold}.{ttf,otf}` | copyright.keris.or.kr (헤움디자인 제작) | SIL OFL 1.1 — `LICENSE-HakgyoansimNadeuri.txt` | 가능 | 가능. 폰트 파일 자체 유료 판매·유료 수정대행만 금지, 출처 표기 의무 없음 | ✅ 등록됨 — `video-edit.tsx` 글꼴 선택(Regular 자리엔 `Light` 사용, B 토글은 `Bold`) |
| 학교안심 별빛하늘 (Hakgyoansim Byeolbichhaneul) | `HakgyoansimByeolbichhaneul-{Light,Bold}.{ttf,otf}` | copyright.keris.or.kr (헤움디자인 제작) | SIL OFL 1.1 — `LICENSE-HakgyoansimByeolbichhaneul.txt` | 가능 | 가능. 폰트 파일 자체 유료 판매·유료 수정대행만 금지, 출처 표기 의무 없음 | ✅ 등록됨 — `video-edit.tsx` 글꼴 선택(Regular 자리엔 `Light` 사용, B 토글은 `Bold`) |

## 남은 일

- 지금은 각 폰트당 `Regular`/`Bold` 두 웨이트만 등록돼 있어요. 미사용 웨이트 파일은 용량 정리 차원에서 삭제했으니, Semibold 등 다른 굵기가 필요해지면 배포처에서 다시 받아 `_layout.tsx`의 `useFonts`와 `video-edit.tsx`의 `FONT_FAMILY_MAP`에 등록하면 됩니다.

## 새 폰트 추가할 때 체크리스트

1. 폰트 파일(`.ttf`)과 라이센스 원문을 같이 받아서 `assets/fonts/`에 저장 (라이센스는 `LICENSE-{폰트명}.txt`로 이름 붙이기, 대화 캡처 등 불필요한 내용 없이 라이선스 본문만)
2. 위 표에 한 줄 추가 — 특히 **상업적 이용 가능 여부**는 공모전 제출 전 반드시 재확인
3. `src/app/_layout.tsx`의 `useFonts({...})`에 등록
4. 실제 사용하는 화면(`src/app/video-edit.tsx`의 `FONT_OPTIONS`)에 연결하고, 위 표의 상태를 ✅로 갱신
