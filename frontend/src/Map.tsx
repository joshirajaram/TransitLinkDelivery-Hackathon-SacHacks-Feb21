import Map, { Marker, NavigationControl } from 'react-map-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

const DAVIS_CENTER = {
  latitude: 38.5449,
  longitude: -121.7405,
  zoom: 12.6
}

export default function MapView() {
  const token = import.meta.env.VITE_MAPBOX_TOKEN || ''

  return (
    <Map
      mapboxAccessToken={token}
      initialViewState={DAVIS_CENTER}
      mapStyle="mapbox://styles/mapbox/light-v11"
      style={{ width: '100%', height: '72vh', borderRadius: '12px' }}
    >
      <NavigationControl position="top-right" />
      <Marker longitude={-121.7405} latitude={38.5449} color="#d32f2f" />
    </Map>
  )
}
