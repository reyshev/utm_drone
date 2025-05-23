
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

let drones = [];
let pilots = [];
let flights = [];

const restrictedZones = [
  { name: "Астана центр", lat: 51.1605, lng: 71.4704, radius: 0.01 } // ~1км радиус
];

function isInRestrictedZone(lat, lng) {
  return restrictedZones.some(zone => {
    const dLat = zone.lat - lat;
    const dLng = zone.lng - lng;
    const distance = Math.sqrt(dLat * dLat + dLng * dLng);
    return distance < zone.radius;
  });
}

app.post('/api/pilots', (req, res) => {
  const { name, contact } = req.body;
  const pilot = { id: Date.now(), name, contact };
  pilots.push(pilot);
  res.json(pilot);
});

app.post('/api/drones', (req, res) => {
  const { model, serial, pilotId } = req.body;
  const drone = { id: Date.now(), model, serial, pilotId };
  drones.push(drone);
  res.json(drone);
});

app.post('/api/flights', (req, res) => {
  const { droneId, route, altitude, time } = req.body;
  const isRestricted = route.some(coord => isInRestrictedZone(coord.lat, coord.lng));
  const status = isRestricted ? 'denied' : 'approved';
  const flight = { id: Date.now(), droneId, route, altitude, time, status, lastSignal: Date.now() };
  flights.push(flight);
  res.json(flight);
});

app.get('/api/flights', (req, res) => {
  res.json(flights);
});

app.post('/api/track', (req, res) => {
  const { flightId, lat, lng } = req.body;
  const flight = flights.find(f => f.id === flightId);
  if (flight) {
    if (!flight.path) flight.path = [];
    flight.path.push({ lat, lng, timestamp: Date.now() });
    flight.lastSignal = Date.now();
    const violation = isInRestrictedZone(lat, lng);
    res.json({ status: 'ok', violation });
  } else {
    res.status(404).json({ error: 'Flight not found' });
  }
});

// Проверка потери сигнала (если не было обновлений >10 сек)
app.get('/api/signal-status', (req, res) => {
  const now = Date.now();
  const statusList = flights.map(f => ({
    flightId: f.id,
    signalLost: now - f.lastSignal > 10000
  }));
  res.json(statusList);
});

// Простая метео-заглушка
app.get('/api/weather', (req, res) => {
  res.json({
    city: "Astana",
    wind: "5 m/s",
    visibility: "Clear",
    condition: "Sunny"
  });
});

// Панель наблюдателя (все активные маршруты)
app.get('/api/observer', (req, res) => {
  const activeFlights = flights.map(f => ({
    id: f.id,
    droneId: f.droneId,
    status: f.status,
    lastKnown: f.path?.[f.path.length - 1] || null
  }));
  res.json(activeFlights);
});

app.get('/', (req, res) => {
  res.send('🚀 UTM Drone Backend работает!');
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
