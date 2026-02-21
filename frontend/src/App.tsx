import MapView from './Map'

export default function App() {
  return (
    <main>
      <header className="header">
        <h1>Transit-Link Delivery</h1>
        <p>Unitrans as middle-mile infrastructure for DDBA restaurants.</p>
      </header>
      <section className="map-shell">
        <MapView />
      </section>
    </main>
  )
}
