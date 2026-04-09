import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, Alert, ActivityIndicator, TextInput, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { workflowApi } from '../lib/api';
import { theme, formatDateTime } from '../lib/theme';

interface WorkflowInstance {
  id: string;
  documentId: string;
  currentStatus: string;
  notes: string;
  correctionCount: number;
  createdAt: string;
}

const statusColors: Record<string, { bg: string; text: string }> = {
  DRAFT: { bg: '#f1f5f9', text: '#475569' },
  REVIEW: { bg: '#dbeafe', text: '#1d4ed8' },
  PENDING_APPROVAL: { bg: '#fef3c7', text: '#b45309' },
  APPROVED: { bg: '#dcfce7', text: '#15803d' },
  REJECTED: { bg: '#fef2f2', text: '#dc2626' },
  CORRECTION: { bg: '#ffedd5', text: '#c2410c' },
  ARCHIVED: { bg: '#f3e8ff', text: '#7c3aed' },
  CANCELLED: { bg: '#f1f5f9', text: '#94a3b8' },
};

type Tab = 'pending' | 'my';

export default function WorkflowScreen() {
  const [tab, setTab] = useState<Tab>('pending');
  const [instances, setInstances] = useState<WorkflowInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const res = tab === 'pending'
        ? await workflowApi.getPendingApprovals(0, 50)
        : await workflowApi.getMyInstances(0, 50);
      const data = res.data?.data ?? res.data;
      setInstances(data?.content ?? (Array.isArray(data) ? data : []));
    } catch { setInstances([]); }
    setLoading(false);
  }, [tab]);

  useEffect(() => { setLoading(true); loadData(); }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleApproval = async (decision: 'APPROVED' | 'REJECTED') => {
    if (!selectedId) return;
    setActionLoading(true);
    try {
      await workflowApi.approve(selectedId, decision, approvalNotes);
      setModalVisible(false);
      setApprovalNotes('');
      setSelectedId(null);
      loadData();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Action failed');
    }
    setActionLoading(false);
  };

  const renderItem = ({ item }: { item: WorkflowInstance }) => {
    const colors = statusColors[item.currentStatus] || statusColors.DRAFT;
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.statusBadge, { backgroundColor: colors.bg }]}>
            <Text style={[styles.statusText, { color: colors.text }]}>{item.currentStatus.replace('_', ' ')}</Text>
          </View>
          {item.correctionCount > 0 && (
            <View style={styles.corrBadge}>
              <Text style={styles.corrText}>Corrections: {item.correctionCount}</Text>
            </View>
          )}
        </View>
        <Text style={styles.cardId}>ID: {item.id.slice(0, 8)}...</Text>
        {item.notes ? <Text style={styles.cardNotes} numberOfLines={2}>{item.notes}</Text> : null}
        <Text style={styles.cardDate}>{formatDateTime(item.createdAt)}</Text>

        {tab === 'pending' && item.currentStatus === 'PENDING_APPROVAL' && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.approveBtn]}
              onPress={() => { setSelectedId(item.id); setModalVisible(true); }}
            >
              <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
              <Text style={styles.actionText}>Review</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Tab Switcher */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'pending' && styles.tabActive]}
          onPress={() => setTab('pending')}
        >
          <Text style={[styles.tabText, tab === 'pending' && styles.tabTextActive]}>Pending Approval</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'my' && styles.tabActive]}
          onPress={() => setTab('my')}
        >
          <Text style={[styles.tabText, tab === 'my' && styles.tabTextActive]}>My Workflows</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={instances}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="git-branch-outline" size={48} color="#cbd5e1" />
              <Text style={styles.emptyText}>
                {tab === 'pending' ? 'No pending approvals' : 'No workflows yet'}
              </Text>
            </View>
          }
        />
      )}

      {/* Approval Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Workflow Decision</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Add notes (optional)..."
              placeholderTextColor="#94a3b8"
              value={approvalNotes}
              onChangeText={setApprovalNotes}
              multiline
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: theme.colors.success }]}
                onPress={() => handleApproval('APPROVED')}
                disabled={actionLoading}
              >
                <Text style={styles.modalBtnText}>Approve</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: theme.colors.error }]}
                onPress={() => handleApproval('REJECTED')}
                disabled={actionLoading}
              >
                <Text style={styles.modalBtnText}>Reject</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#64748b' }]}
                onPress={() => { setModalVisible(false); setApprovalNotes(''); }}
              >
                <Text style={styles.modalBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  tabs: { flexDirection: 'row', padding: 16, gap: 8 },
  tab: {
    flex: 1, paddingVertical: 10, borderRadius: theme.borderRadius.md,
    backgroundColor: '#e2e8f0', alignItems: 'center',
  },
  tabActive: { backgroundColor: theme.colors.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary },
  tabTextActive: { color: '#fff' },
  list: { padding: 16, paddingTop: 0, gap: 12 },
  card: {
    backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.lg,
    padding: 16, borderWidth: 1, borderColor: theme.colors.border, gap: 8,
  },
  cardHeader: { flexDirection: 'row', gap: 8 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  statusText: { fontSize: 11, fontWeight: '600' },
  corrBadge: { paddingHorizontal: 8, paddingVertical: 3, backgroundColor: '#ffedd5', borderRadius: 12 },
  corrText: { fontSize: 10, color: '#c2410c', fontWeight: '500' },
  cardId: { fontSize: 12, color: '#94a3b8', fontFamily: 'monospace' },
  cardNotes: { fontSize: 13, color: theme.colors.textSecondary, lineHeight: 18 },
  cardDate: { fontSize: 11, color: '#94a3b8' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 8, borderRadius: theme.borderRadius.md },
  approveBtn: { backgroundColor: theme.colors.primary },
  actionText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  emptyText: { fontSize: 15, color: theme.colors.textSecondary },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, gap: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: theme.colors.text },
  modalInput: {
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.borderRadius.md,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, minHeight: 80,
    textAlignVertical: 'top', color: theme.colors.text,
  },
  modalActions: { flexDirection: 'row', gap: 8 },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: theme.borderRadius.md, alignItems: 'center' },
  modalBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
