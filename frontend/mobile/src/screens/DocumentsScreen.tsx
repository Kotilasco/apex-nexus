import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { documentApi } from '../lib/api';
import { syncDocuments, pinDocument, unpinDocument } from '../services/syncService';
import { useDatabase } from '../db/DatabaseProvider';
import { DocumentModel } from '../db/models';
import { Q } from '@nozbe/watermelondb';
import { theme, formatDate, formatBytes } from '../lib/theme';

interface ServerDoc {
  id: string;
  title: string;
  mimeType: string;
  fileSize: number;
  status: string;
  authorName: string;
  createdAt: string;
  tags: string[];
}

const statusColors: Record<string, string> = {
  DRAFT: '#94a3b8',
  ACTIVE: '#22c55e',
  ARCHIVED: '#a855f7',
  DESTROYED: '#ef4444',
};

const mimeIcons: Record<string, string> = {
  'application/pdf': 'document-text',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'grid',
  'image/': 'image',
};

function getIcon(mime: string): keyof typeof Ionicons.glyphMap {
  for (const [prefix, icon] of Object.entries(mimeIcons)) {
    if (mime.startsWith(prefix)) return icon as keyof typeof Ionicons.glyphMap;
  }
  return 'document-outline';
}

export default function DocumentsScreen() {
  const [documents, setDocuments] = useState<ServerDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const db = useDatabase();

  const loadData = useCallback(async () => {
    try {
      const res = await documentApi.list(undefined, 0, 50);
      const data = res.data?.data ?? res.data;
      setDocuments(data?.content ?? (Array.isArray(data) ? data : []));
    } catch {
      // Offline: load from WatermelonDB
      const localDocs = await db.get<DocumentModel>('documents')
        .query(Q.sortBy('created_at', Q.desc)).fetch();
      setDocuments(localDocs.map((d) => ({
        id: d.serverId,
        title: d.title,
        mimeType: d.mimeType,
        fileSize: d.fileSize,
        status: d.status,
        authorName: d.authorName,
        createdAt: d.createdAt.toISOString(),
        tags: JSON.parse(d.tags || '[]'),
      })));
    }
    // Load pinned status
    const pinned = await db.get<DocumentModel>('documents')
      .query(Q.where('is_pinned', true)).fetch();
    setPinnedIds(new Set(pinned.map((d) => d.serverId)));
    setLoading(false);
  }, [db]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await syncDocuments();
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  useEffect(() => { loadData(); }, [loadData]);

  const togglePin = async (docId: string) => {
    try {
      if (pinnedIds.has(docId)) {
        await unpinDocument(docId);
        setPinnedIds((prev) => { const s = new Set(prev); s.delete(docId); return s; });
      } else {
        await pinDocument(docId);
        setPinnedIds((prev) => new Set(prev).add(docId));
      }
    } catch (e: any) {
      Alert.alert('Error', 'Failed to toggle pin');
    }
  };

  const renderItem = ({ item }: { item: ServerDoc }) => (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <Ionicons name={getIcon(item.mimeType)} size={28} color={theme.colors.primary} />
        <View style={styles.cardContent}>
          <Text style={styles.docTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.docMeta}>{item.authorName} &middot; {formatDate(item.createdAt)}</Text>
          <View style={styles.tagRow}>
            <View style={[styles.statusBadge, { backgroundColor: statusColors[item.status] || '#94a3b8' }]}>
              <Text style={styles.statusText}>{item.status}</Text>
            </View>
            <Text style={styles.fileSize}>{formatBytes(item.fileSize)}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => togglePin(item.id)} style={styles.pinButton}>
          <Ionicons
            name={pinnedIds.has(item.id) ? 'bookmark' : 'bookmark-outline'}
            size={22}
            color={pinnedIds.has(item.id) ? theme.colors.warning : theme.colors.textSecondary}
          />
        </TouchableOpacity>
      </View>
    </View>
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
      <FlatList
        data={documents}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="folder-open-outline" size={48} color="#cbd5e1" />
            <Text style={styles.emptyText}>No documents found</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background },
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.lg,
    padding: 16, borderWidth: 1, borderColor: theme.colors.border,
  },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardContent: { flex: 1, gap: 4 },
  docTitle: { fontSize: 15, fontWeight: '600', color: theme.colors.text },
  docMeta: { fontSize: 12, color: theme.colors.textSecondary },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  statusText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  fileSize: { fontSize: 11, color: theme.colors.textSecondary },
  pinButton: { padding: 4 },
  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText: { color: theme.colors.textSecondary, fontSize: 15 },
});
