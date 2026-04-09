'use client';

import { useEffect, useState, useCallback } from 'react';
import { notificationApi } from '@/lib/api';
import type { Notification } from '@/lib/types';
import { formatDateTime } from '@/lib/utils';
import {
  Bell, BellOff, Check, CheckCheck, RefreshCw,
  FileText, GitBranch, AlertTriangle, Info, Mail,
} from 'lucide-react';

type Tab = 'all' | 'unread';

const typeIcons: Record<string, typeof Bell> = {
  DOCUMENT: FileText,
  WORKFLOW: GitBranch,
  RETENTION: AlertTriangle,
  SYSTEM: Info,
};

export default function NotificationsPage() {
  const [tab, setTab] = useState<Tab>('unread');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = tab === 'unread'
        ? await notificationApi.getUnread()
        : await notificationApi.getMy(page, 20);
      const data = res.data?.data ?? res.data;
      setNotifications(data?.content ?? (Array.isArray(data) ? data : []));
      setTotalPages(data?.totalPages ?? 0);
    } catch { /* silent */ }
    setLoading(false);
  }, [tab, page]);

  const loadUnreadCount = useCallback(async () => {
    try {
      const res = await notificationApi.getUnreadCount();
      setUnreadCount(res.data?.data ?? res.data ?? 0);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    loadNotifications();
    loadUnreadCount();
  }, [loadNotifications, loadUnreadCount]);

  const handleMarkRead = async (id: string) => {
    try {
      await notificationApi.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch { /* silent */ }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationApi.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch { /* silent */ }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
          <p className="text-sm text-slate-500 mt-1">
            {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'All caught up'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <CheckCheck className="h-4 w-4" /> Mark All Read
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-6">
          {([
            { key: 'unread' as Tab, label: 'Unread', badge: unreadCount },
            { key: 'all' as Tab, label: 'All Notifications' },
          ]).map((t) => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setPage(0); }}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                tab === t.key
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label}
              {t.badge !== undefined && t.badge > 0 && (
                <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-16">
          <RefreshCw className="h-8 w-8 text-slate-400 animate-spin" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border">
          <BellOff className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">
            {tab === 'unread' ? 'No unread notifications' : 'No notifications yet'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border divide-y">
          {notifications.map((n) => {
            const Icon = typeIcons[n.type] || Bell;
            return (
              <div
                key={n.id}
                className={`p-4 flex items-start gap-4 transition-colors ${
                  n.read ? 'bg-white' : 'bg-primary-50/50'
                }`}
              >
                <div className={`p-2 rounded-lg shrink-0 ${
                  n.read ? 'bg-slate-100' : 'bg-primary-100'
                }`}>
                  <Icon className={`h-5 w-5 ${n.read ? 'text-slate-400' : 'text-primary-600'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className={`text-sm ${n.read ? 'text-slate-600' : 'font-medium text-slate-900'}`}>
                        {n.title}
                      </p>
                      {n.message && (
                        <p className="text-sm text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                      )}
                    </div>
                    {!n.read && (
                      <button
                        onClick={() => handleMarkRead(n.id)}
                        className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg shrink-0"
                        title="Mark as read"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                    <span>{formatDateTime(n.createdAt)}</span>
                    {n.emailSent && (
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" /> Email sent
                      </span>
                    )}
                    {n.resourceType && (
                      <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">
                        {n.resourceType}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {tab === 'all' && totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <span className="px-3 py-1.5 text-sm text-slate-500">
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
