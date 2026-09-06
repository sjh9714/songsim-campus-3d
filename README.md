# 가톨릭대학교 성심교정 3D

학교 공식 사진·안내도와 공개 공간정보로 재구성한 성심교정 외관 뷰어입니다. Three.js / TypeScript / Vite로 제작했습니다.

## 실행

Node.js 22.18 이상을 사용합니다.

```sh
npm install
npm run dev
```

브라우저에서 <http://127.0.0.1:5173/>을 엽니다. 외부 API 키가 필요하지 않으며, 화면 실행 중 외부 지도나 글꼴 서비스에 요청하지 않습니다.

```sh
npm run build
npm test
npm run preview
```

## 둘러보기

- 마우스 드래그: 회전 / 휠: 확대·축소 / 오른쪽 드래그: 이동
- 건물 목록, 검색 또는 지도 위 이름으로 건물 선택
- `사진과 비교`: 공식 사진과 3D를 함께 표시
- `외관 가까이 보기`, 위에서 보기, 북쪽 정렬, 건물 이름 표시
- `/`: 검색 / `Esc`: 안내도·출처 닫기 또는 건물 선택 해제
- 휴대폰에서는 오른쪽 위 메뉴로 건물 목록 열기

김수환관(스테파노기숙사·컨벤션센터 포함), 안드레아관, 미카엘관(행정동·교수연구동 포함) 등을 18개 건물 그룹으로 구성했습니다. 정문, 운동장, 테니스장, 동산과 주변 지형도 포함합니다. `#a`, `#k`, `#d`, `#l` 등 건물 코드로 특정 건물을 바로 열 수 있습니다.

## 재현 수준

**실측 또는 사진측량 모델이 아니며, 실제와 완전히 동일한 외관을 검증한 결과물이 아닙니다.**

| 요소 | 근거와 한계 |
| --- | --- |
| 건물 위치·외곽선·도로 | OSM 데이터. 1 단위 = 약 1m, 동쪽 +X / 남쪽 +Z. 지도 데이터 자체의 정확도는 별도 측량하지 않았습니다. |
| 안드레아관 | 설계자 공개 기준층 도면(WIDE AR 91, pp.84–85)의 곡선 외곽선을 전사. 좁은 연결동, 3개 층 높이 필로티와 V자 지지부, 깊이가 있는 창, 원형 아트리움·유리 천창을 반영했습니다. 도면의 미터 치수와 지리적 정합은 추정입니다. |
| 김수환관 | 정림건축 공개 자료의 15층·지하 3층 및 정문을 향한 타워의 좁은 면 배치를 반영. 외장 패널, 기숙사 발코니, 유리 계단실과 컨벤션센터 곡선 지붕을 사진으로 재구성했습니다. |
| 학생미래인재관 | 경기건축포털의 지상 3층·지하 1층 기록을 반영. 수평 창, 돌출 벽과 각진 입구를 공개 사진에 맞춰 보정했습니다. |
| 베리타스관·미카엘관 | 공식 사진에서 경사지붕·곡면 출입구, 기둥 열·후퇴한 벽면·중정을 반영. 상세 치수는 추정입니다. |
| 니콜스관·마리아관·성심관·성당 | 흰색 외벽 띠, 계단실, 높이가 다른 동과 배관, 성당의 팔각 지붕·아치형 창·중정을 공식 사진과 대조했습니다. 상세 치수와 중정 범위는 추정입니다. |
| 다솔관 | OSM 멀티폴리곤의 내부 중정을 실제로 뚫린 형상으로 반영했습니다. |
| 층수 | 창업보육센터 3층, 김수환관 15층, 안드레아관 10층, 학생미래인재관 3층, 베리타스관 5층, 콘서트홀 지상 2층, 프란치스코 기숙사 14층은 학교·설계사·건축 기록으로 확인했습니다. 나머지는 사진 기반 추정입니다. |
| 높이·창문·지붕 | 프란치스코 기숙사의 OSM 42m를 제외하면 모델 높이는 추정입니다. 창호 반복 간격, 뒷면, 옥상 구조물은 정밀 검증되지 않았습니다. |
| 지형·조경 | 지역 DEM을 바탕으로 건물 바닥을 평탄화했습니다. 수목 위치·종류와 세부 포장·계단은 근사치입니다. |
| 주변 건물·실내 | 주변 건물은 외곽선과 단순 높이만 표시합니다. 안드레아관의 아트리움 형상을 제외한 실내 전체는 구현하지 않았습니다. |

건물 정보의 `재구성에 사용한 자료`에서 원본 사진, OSM 외곽선과 해당 건물의 한계를 확인할 수 있습니다. 사진이 확보되지 않은 바오로관·국제교류관은 사진 없음으로 표시합니다.

## 자료 출처

자료 확인일: **2026-09-06**. 학교·OSM 자료는 로컬에 저장했고, 추가 건축 자료는 형태 대조와 출처 기록에 사용했습니다.

- [가톨릭대학교 공식 캠퍼스맵](https://www.catholic.ac.kr/ko/about/campus-map.do) — 명칭, 위치, 외관 사진, 공식 평면·조감도. [공개 장소 목록](https://www.catholic.ac.kr/ko/about/campus-map.do?mode=getPlaceListByCondition&campus=1). 사진 및 안내도 © 가톨릭대학교. 공개 열람 자료이며 자유 재배포 라이선스가 확인된 사진 모음은 아닙니다.
- [OpenStreetMap contributors / ODbL](https://www.openstreetmap.org/copyright) — 건물과 도로 등. 원본은 `public/data/osm*.json`, 가공 데이터는 `public/data/campus.json`. 원본 OSM 지리 데이터와 그 파생 지리 데이터에는 ODbL 조건이 적용됩니다.
- [WIDE AR 91, pp.84–85](https://online.fliphtml5.com/njumk/nghu/#p=86) — 임성필·집 파트너스 건축의 안드레아관 기준층·배치·단면도, 외관과 아트리움 사진. 출처·확인된 사실·추정 치수는 `public/data/architectural-evidence.json`에 기록했습니다. 출판물 전체나 해당 페이지 이미지는 앱에 포함하지 않았습니다.
- [정림건축 · 가톨릭대학교 150주년 기념관](https://junglim.com/%EA%B0%80%ED%86%A8%EB%A6%AD%EB%8C%80%ED%95%99%EA%B5%90-150%EC%A3%BC%EB%85%84-%EA%B8%B0%EB%85%90%EA%B4%80/) — 김수환관 규모, 타워 배치 방향과 여러 면의 사진. 경기건축포털의 설명문에는 16층 표기도 있으나 설계사 자료의 15층을 우선했습니다.
- [경기건축포털 · 학생회관](https://ggarchimap.gg.go.kr/archives/gg_building-presentday/07/57/2594/) / [김수환관·컨벤션센터](https://ggarchimap.gg.go.kr/archives/gg_building-presentday/07/57/2593/) — 건축가, 규모, 외부 마감과 여러 방향의 공개 사진.
- [가톨릭대학교 · 중앙도서관 안내](https://www.catholic.ac.kr/ko/campuslife/library_songsim.do) — 베리타스관의 지상 5층 규모와 층별 안내.
- [Mapzen Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) — 고도. [기여자 및 원천 자료 귀속](https://github.com/tilezen/joerd/blob/master/docs/attribution.md), [Terrarium 형식](https://github.com/tilezen/joerd/blob/master/docs/formats.md). 이번 지역은 SRTM 계열 범위이며 개별 픽셀의 원천 계보는 검증하지 않았습니다.
- [Three.js](https://threejs.org/) / MIT, [Lucide](https://lucide.dev/) / ISC — 렌더러 및 UI 아이콘.

대학교의 공식 서비스가 아닌 개인 제작물입니다.

SRTM and GMTED2010 terrain data courtesy of the U.S. Geological Survey.

## Vercel 배포

Node.js 22, Vite 프리셋과 `vercel.json`의 설정을 사용합니다. 설치 명령은 `npm ci`, 빌드 명령은 `npm run build`, 배포 폴더는 `dist`입니다. 실행에 필요한 환경 변수는 없습니다.

```sh
vercel link
vercel --prod
```

로컬 Vercel 연결 정보와 환경 변수 파일은 Git에서 제외합니다.

## 데이터 재생성

```sh
python3 scripts/prepare-data.py
```

Python 및 Pillow가 필요합니다. 저장된 공식 장소·OSM 스냅샷과 사진으로 데이터를 재생성합니다. 고도 타일이 없을 때만 공개 저장소에서 받아옵니다. 새 자료의 자동 수집이나 자동 최신화를 수행하지 않습니다.

핵심 코드는 `src/buildings.ts`(건물 외관), `src/landscape.ts`(지형·조경), `src/viewer.ts`(3D 탐색), `src/main.ts`(화면)입니다. 모델의 구체적인 치수 조정은 건물별 외관 생성 분기에서 할 수 있습니다.
