import Map, { Marker, NavigationControl } from 'react-map-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

const DAVIS_CENTER = {
  latitude: 38.5449,
  longitude: -121.7405,
  zoom: 13.5
}

export default function MapView() {
  const token = import.meta.env.VITE_MAPBOX_TOKEN || ''

  return (
    <div className="map-container-stylish">
      <Map
        mapboxAccessToken={token}
        initialViewState={DAVIS_CENTER}
        mapStyle="mapbox://styles/mapbox/light-v11"
        style={{ width: '100%', height: '100%', borderRadius: '24px' }}
      >
        <NavigationControl position="top-right" />
        <Marker longitude={-121.7405} latitude={38.5449}>
          <div className="map-marker-premium">
            <div className="marker-dot-outer">
              <div className="marker-dot-inner" />
            </div>
            <span className="marker-label">UC Davis Memorial Union</span>
          </div>
        </Marker>
      </Map>

      <style>{`
        .map-container-stylish {
          width: 100%;
          height: 72vh;
          border-radius: 32px;
          overflow: hidden;
          border: 1px solid var(--border);
          box-shadow: 0 20px 50px rgba(0,0,0,0.06);
          position: relative;
        }

        .map-marker-premium {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
        }

        .marker-dot-outer {
          width: 16px;
          height: 16px;
          background: rgba(0, 118, 206, 0.2);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: pulseMarker 2s infinite ease-out;
        }

        .marker-dot-inner {
          width: 8px;
          height: 8px;
          background: var(--blue);
          border-radius: 50%;
          border: 2px solid #fff;
        }

        @keyframes pulseMarker {
          from { transform: scale(1); opacity: 0.8; }
          to { transform: scale(3); opacity: 0; }
        }

        .marker-label {
          background: #fff;
          padding: 4px 10px;
          border-radius: 8px;
          font-size: 0.75rem;
          font-weight: 700;
          color: var(--primary);
          box-shadow: 0 4px 10px rgba(0,0,0,0.1);
          white-space: nowrap;
        }
      `}</style>
    </div>
  )
}
