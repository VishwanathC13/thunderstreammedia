import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../../components/admin/Sidebar';
import { T, FONT_IMPORT } from '../../shared';

export default function AdminLayout() {
  return (
    <div className="min-h-screen flex" style={{ background: T.bg, color: T.text, fontFamily: "'Space Grotesk', sans-serif" }}>
      <style>{FONT_IMPORT}</style>
      <Sidebar />
      <main className="flex-1 min-w-0 px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}
