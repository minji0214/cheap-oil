# Fuel.IQ

오피넷 API 기반 주변 최저가 주유소 탐색 앱.

## 주요 기능

- **주변 주유소 검색** — GPS 또는 지역 선택으로 반경 내 주유소 목록 조회
- **유종 선택** — 휘발유(B027) / 경유(D047)
- **최저가 하이라이트** — 지역 평균 대비 절감 금액 표시
- **T맵 길안내** — 카드 탭으로 즉시 네비게이션 실행
- **2분 캐시** — 동일 좌표·유종 요청은 서버 메모리에 캐시

## 기술 스택

- Next.js 16 (App Router)
- React 19 + TypeScript
- Tailwind CSS v4
- lucide-react (아이콘)
- proj4 (KATECH ↔ WGS84 좌표 변환)
- 오피넷 API (한국석유공사)

## 프로젝트 구조

```
src/
├── app/
│   ├── api/
│   │   ├── stations/
│   │   │   ├── route.ts          # GET /api/stations
│   │   │   └── [stationId]/
│   │   │       └── route.ts      # GET /api/stations/:id
│   │   └── avg-price/
│   │       └── route.ts          # GET /api/avg-price
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/
│   └── fuel-iq-app.tsx           # 메인 UI 컴포넌트
└── lib/
    ├── types.ts                  # 공유 타입 정의
    ├── opinet.ts                 # 오피넷 API 클라이언트
    └── cache.ts                  # TTL 기반 인메모리 캐시
```

## 환경 변수

`.env.local` 파일을 생성하고 아래 값을 설정합니다.

```
OPINET_API_KEY=your_opinet_api_key
OPINET_DEFAULT_REGION_CODE=11   # 기본 지역 코드 (11 = 서울)
```

오피넷 API 키는 [오피넷 공식 사이트](https://www.opinet.co.kr)에서 발급받을 수 있습니다.

## API

### `GET /api/stations`

반경 내 주유소 목록과 가격 인사이트를 반환합니다.

| 파라미터 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `lat` | number | ✓ | 위도 |
| `lng` | number | ✓ | 경도 |
| `fuel` | `B027` \| `D047` | - | 유종 (기본값: `B027`) |
| `radius` | number | - | 검색 반경 m, 500~5000 (기본값: 3000) |
| `regionCode` | string | - | 지역 코드 (기본값: `11`) |

### `GET /api/stations/:stationId`

주유소 상세 정보(세차·편의점·정비 여부, 전화번호)를 반환합니다.

### `GET /api/avg-price`

지역 평균 유가를 반환합니다.

| 파라미터 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `fuel` | `B027` \| `D047` | - | 유종 (기본값: `B027`) |
| `regionCode` | string | - | 지역 코드 (기본값: `11`) |

## 로컬 실행

```bash
pnpm install
pnpm dev
```

[http://localhost:3000](http://localhost:3000)에서 확인합니다.
