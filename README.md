# Transit-Link Delivery (TLD)

Transit-Link Delivery is a SacHacks VII project that rethinks delivery logistics in Davis, CA.

## Transit-as-a-Backbone Concept

Instead of relying on high-fee delivery marketplaces, TLD treats the existing **Unitrans bus system** as a middle-mile transport layer:

- Restaurants hand off prepared orders at designated transfer points near bus stops.
- Unitrans lines carry orders across the city as part of normal movement patterns.
- Last-mile handoff can be completed by lightweight local couriers, lockers, or pickup nodes.

This reduces platform fees that often consume up to 30% of restaurant revenue, while leveraging public transit coverage.

## Stack

- Backend: FastAPI (Python 3.11+)
- Realtime feed: Umo IQ XML polling every 15 seconds
- Geospatial matching: geopy + Shapely
- Data layer: SQLite + SQLAlchemy
- Frontend: React (Vite) + Mapbox GL (`react-map-gl`)

## Project Structure

```text
backend/
  app/
    __init__.py
    db.py
    logistics_engine.py
    main.py
    models.py
  requirements.txt
frontend/
  src/
    App.tsx
    Map.tsx
    main.tsx
    index.css
  .env.example
  index.html
  package.json
  tsconfig.json
  vite.config.ts
README.md
```

## Run Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## Run Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Then open the Vite URL (typically `http://localhost:5173`).

## Important Backend Endpoints

- `GET /health` → service health
- `GET /bus-locations` → latest parsed Unitrans vehicle positions
- `GET /match?restaurant_lat=...&restaurant_lon=...&customer_lat=...&customer_lon=...` → best line estimate
