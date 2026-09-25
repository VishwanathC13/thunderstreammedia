import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import EventDetail from './pages/EventDetail';
import AdminLogin from './pages/AdminLogin';
import AdminLayout from './pages/admin/AdminLayout';
import Overview from './pages/admin/Overview';
import Clients from './pages/admin/Clients';
import BookingsCalendar from './pages/admin/BookingsCalendar';
import Content from './pages/admin/Content';
import Quotes from './pages/admin/Quotes';
import Events from './pages/admin/Events';
import VenueLayouts from './pages/admin/VenueLayouts';
import CheckIn from './pages/admin/CheckIn';
import Settings from './pages/admin/Settings';
import ServicesAdmin from './pages/admin/Services';
import ProtectedRoute from './components/ProtectedRoute';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/events/:slug" element={<EventDetail />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Overview />} />
        <Route path="bookings" element={<BookingsCalendar />} />
        <Route path="quotes" element={<Quotes />} />
        <Route path="events" element={<Events />} />
        <Route path="venues" element={<VenueLayouts />} />
        <Route path="events/:id/checkin" element={<CheckIn />} />
        <Route path="clients" element={<Clients />} />
        <Route path="content" element={<Content />} />
        <Route path="settings" element={<Settings />} />
        <Route path="services" element={<ServicesAdmin />} />
      </Route>
    </Routes>
  );
}
