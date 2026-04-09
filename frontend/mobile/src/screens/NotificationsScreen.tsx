import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { notificationApi } from '../lib/api';
import { syncNotifications } from '../services/syncService';
import { theme, formatDateTime } from '../lib/theme';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

const typeIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  DOCUMENT: 'document-text-outline',
  WORKFLOW: 'git-branch-outline',
  RETENTION: 'alert-circle-outline',
  SYSTEM: 'information-circle-outline',
};

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const res = await notificationApi.getMy(0, 50);
      const data = res.data?.data ?? res.data;
      setNotifications(data?.content ?? (Array.isArray(data) ? data : []));
    } catch { setNotifications([]); }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await syncNotifications();
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleMarkRead = async (id: string) => {
    try {
      await notificationApi.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    } catch { /* silent */ }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationApi.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch { /* silent */ }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const renderItem = ({ item }: { item: Notification }) => (
    <TouchableOpacity
      style={[styles.card, !item.read && styles.cardUnread]}
      onPress={() => !item.read && handleMarkRead(item.id)}
      activeOpacity={0.7}
    >
      <View style={styles.row}>
        <View style={[styles.iconContainer, !item.read && styles.iconUnread]}>
          <Ionicons
            name={typeIcons[item.type] || 'notifications-outline'}
            size={22}
            color={item.read ? theme.colors.textSecondary : theme.colors.primary}
          />
        </View>
        <View style={styles.content}>
          <Text style={[styles.title, !item.read && styles.titleUnread]}>{item.title}</Text>
          {item.message ? (
            <Text style={styles.message} numberOfLines={2}>{item.message}</Text>
          ) : null}
          <Text style={styles.date}>{formatDateTime(item.createdAt)}</Text>
        </View>
        {!item.read && <View style={styles.dot} />}
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {unreadCount > 0 && (
        <TouchableOpacity style={styles.markAllBtn} onPress={handleMarkAllRead}>
          <Ionicons name="checkmark-done-outline" size={18} color={theme.colors.primary} />
          <Text style={styles.markAllText}>Mark all as read ({unreadCount})</Text>
        </TouchableOpacity>
      )}
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.center}>
            <Ionicons name="notifications-off-outline" size={48} color="#cbd5e1" />
            <Text style={styles.emptyText}>No notifications</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  list: { padding: 16, gap: 8 },
  card: {
    backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.lg,
    padding: 14, borderWidth: 1, borderColor: theme.colors.border,
  },
  cardUnread: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  iconContainer: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center',
  },
  iconUnread: { backgroundColor: '#dbeafe' },
  content: { flex: 1, gap: 2 },
  title: { fontSize: 14, color: theme.colors.textSecondary },
  titleUnread: { fontWeight: '600', color: theme.colors.text },
  message: { fontSize: 13, color: theme.colors.textSecondary, lineHeight: 18 },
  date: { fontSize: 11, color: '#94a3b8', marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.primary, marginTop: 6 },
  markAllBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  markAllText: { fontSize: 13, color: theme.colors.primary, fontWeight: '600' },
  emptyText: { fontSize: 15, color: theme.colors.textSecondary },
});
