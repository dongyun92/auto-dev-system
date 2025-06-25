import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { WebSocketProvider } from './services/WebSocketProvider';
import Dashboard from './pages/Dashboard';
import AircraftDetail from './pages/AircraftDetail';
import RunwayStatus from './pages/RunwayStatus';
import Header from './components/Header';
import './App.css';

function App() {
  return (
    <WebSocketProvider>
      <Router>
        <div className="App min-h-screen bg-atc-dark text-white">
          <Header />
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/aircraft/:callsign" element={<AircraftDetail />} />
            <Route path="/runway/:runwayId" element={<RunwayStatus />} />
          </Routes>
        </div>
      </Router>
    </WebSocketProvider>
  );
}

export default App;