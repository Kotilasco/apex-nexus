'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';
import { notificationApi } from '@/lib/api';
import { Bell, Menu, LogOut, User, ChevronDown } from 'lucide-react';
import ProjectSwitcher from './ProjectSwitcher';

interface Props { onMenuToggle: () => void }

export default function Navbar({ onMenuToggle }: Props) {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    notificationApi.getUnreadCount()
      .then(r => setUnreadCount(r.data?.data ?? r.data ?? 0))
      .catch(() => {});
    const interval = setInterval(() => {
      notificationApi.getUnreadCount()
        .then(r => setUnreadCount(r.data?.data ?? r.data ?? 0))
        .catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowUserMenu(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 shrink-0">
      <button onClick={onMenuToggle} className="p-2 rounded-lg hover:bg-slate-100 lg:hidden">
        <Menu className="h-5 w-5 text-slate-600" />
      </button>

      {/* Project Context Switcher */}
      <div className="ml-4">
        <ProjectSwitcher />
      </div>

      <div className="flex-1" />

      {/* Notifications */}
      <button
        onClick={() => router.push('/notifications')}
        className="relative p-2 rounded-lg hover:bg-slate-100 mr-2"
      >
        <Bell className="h-5 w-5 text-slate-600" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* User menu */}
      <div ref={menuRef} className="relative">
        <button
          onClick={() => setShowUserMenu(!showUserMenu)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100"
        >
          <div className="h-8 w-8 bg-primary-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
            {user?.fullName?.charAt(0) || 'U'}
          </div>
          <span className="text-sm font-medium text-slate-700 hidden sm:block">{user?.fullName}</span>
          <ChevronDown className="h-4 w-4 text-slate-400" />
        </button>

        {showUserMenu && (
          <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-slate-200 py-1 z-50">
            <div className="px-4 py-3 border-b border-slate-100">
              <p className="text-sm font-medium text-slate-900">{user?.fullName}</p>
              <p className="text-xs text-slate-500">{user?.email}</p>
            </div>
            <button
              onClick={() => { setShowUserMenu(false); router.push('/profile'); }}
              className="flex items-center w-full px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <User className="h-4 w-4 mr-2" /> Profile
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              <LogOut className="h-4 w-4 mr-2" /> Sign Out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
