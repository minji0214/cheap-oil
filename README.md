# Fuel.IQ

Find the cheapest gas station near you, powered by the Opinet API.

## Features

- **Nearby station search** — locate stations within a configurable radius via GPS or region selection
- **Fuel type toggle** — gasoline (B027) / diesel (D047)
- **Lowest-price highlight** — shows savings vs. regional average price
- **T-map navigation** — tap a station card to launch turn-by-turn directions
- **2-minute cache** — repeated requests for the same coordinates and fuel type are served from server memory

## Tech Stack

- Next.js 16 (App Router)
- React 19 + TypeScript
- Tailwind CSS v4
- lucide-react (icons)
- proj4 (KATECH ↔ WGS84 coordinate conversion)
- Opinet API (Korea National Oil Corporation)

## Project Structure

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
│   └── fuel-iq-app.tsx           # main UI component
└── lib/
    ├── types.ts                  # shared TypeScript types
    ├── opinet.ts                 # Opinet API client
    └── cache.ts                  # TTL-based in-memory cache
```

## Environment Variables

Create a `.env.local` file and set the following:

```
OPINET_API_KEY=your_opinet_api_key
OPINET_DEFAULT_REGION_CODE=11   # default region code (11 = Seoul)
```

You can obtain an Opinet API key from the [Opinet website](https://www.opinet.co.kr).

## API

### `GET /api/stations`

Returns a list of nearby stations and a price insight summary.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `lat` | number | ✓ | Latitude |
| `lng` | number | ✓ | Longitude |
| `fuel` | `B027` \| `D047` | - | Fuel type (default: `B027`) |
| `radius` | number | - | Search radius in meters, 500–5000 (default: 3000) |
| `regionCode` | string | - | Region code (default: `11`) |

### `GET /api/stations/:stationId`

Returns station details: car wash, convenience store, maintenance availability, and phone number.

### `GET /api/avg-price`

Returns the regional average fuel price.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `fuel` | `B027` \| `D047` | - | Fuel type (default: `B027`) |
| `regionCode` | string | - | Region code (default: `11`) |

## Local Development

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.
