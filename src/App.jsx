import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import HostPage from './pages/HostPage';
import JoinPage from './pages/JoinPage';
import AdminPage from './pages/AdminPage';
import './App.css';

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-wrapper">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/host/:sessionId" element={<HostPage />} />
          <Route path="/join/:sessionId" element={<JoinPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
