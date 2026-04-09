import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../lib/auth-store';
import { fullSync } from '../services/syncService';
import { theme } from '../lib/theme';

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();
  const [syncing, setSyncing] = React.useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await fullSync();
      Alert.alert('Sync Complete', 'All data has been synchronized');
    } catch {
      Alert.alert('Sync Failed', 'Could not sync. Check your connection.');
    }
    setSyncing(false);
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Avatar */}
      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.fullName?.charAt(0)?.toUpperCase() || 'U'}
          </Text>
        </View>
        <Text style={styles.name}>{user?.fullName || 'User'}</Text>
        <Text style={styles.username}>@{user?.username}</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      {/* Roles */}
      {user?.roles && user.roles.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Roles</Text>
          <View style={styles.roles}>
            {user.roles.map((role, i) => (
              <View key={i} style={styles.roleBadge}>
                <Ionicons name="shield-checkmark-outline" size={14} color={theme.colors.primary} />
                <Text style={styles.roleText}>{role.name}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Actions</Text>

        <TouchableOpacity style={styles.actionRow} onPress={handleSync} disabled={syncing}>
          <Ionicons name="sync-outline" size={22} color={theme.colors.primary} />
          <Text style={styles.actionLabel}>{syncing ? 'Syncing...' : 'Sync All Data'}</Text>
          <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionRow} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={22} color={theme.colors.error} />
          <Text style={[styles.actionLabel, { color: theme.colors.error }]}>Sign Out</Text>
          <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
        </TouchableOpacity>
      </View>

      {/* App Info */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Apex Nexus Mobile v1.0.0</Text>
        <Text style={styles.footerText}>Enterprise Content Management</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingBottom: 40 },
  avatarSection: { alignItems: 'center', paddingVertical: 32 },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { color: '#fff', fontSize: 32, fontWeight: '700' },
  name: { fontSize: 20, fontWeight: '700', color: theme.colors.text, marginTop: 12 },
  username: { fontSize: 14, color: theme.colors.textSecondary, marginTop: 2 },
  email: { fontSize: 13, color: '#94a3b8', marginTop: 2 },
  section: { paddingHorizontal: 16, marginTop: 8 },
  sectionTitle: { fontSize: 12, fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 },
  roles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  roleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: '#eff6ff', borderRadius: 20,
  },
  roleText: { fontSize: 13, color: theme.colors.primary, fontWeight: '500' },
  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: theme.colors.surface, padding: 16,
    borderRadius: theme.borderRadius.lg, borderWidth: 1, borderColor: theme.colors.border,
    marginBottom: 8,
  },
  actionLabel: { flex: 1, fontSize: 15, color: theme.colors.text, fontWeight: '500' },
  footer: { alignItems: 'center', marginTop: 40, gap: 4 },
  footerText: { fontSize: 12, color: '#94a3b8' },
});
