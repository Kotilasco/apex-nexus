import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { searchApi } from '../lib/api';
import { theme, formatDate } from '../lib/theme';

interface SearchResult {
  id: string;
  title: string;
  description: string;
  mimeType: string;
  status: string;
  folderPath: string;
  authorName: string;
  tags: string[];
  createdAt: string;
  score: number;
}

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await searchApi.quick(query, 0, 30);
      const data = res.data?.data ?? res.data;
      setResults(data?.results ?? data?.content ?? (Array.isArray(data) ? data : []));
    } catch {
      setResults([]);
    }
    setLoading(false);
  }, [query]);

  const renderItem = ({ item }: { item: SearchResult }) => (
    <View style={styles.card}>
      <View style={styles.row}>
        <Ionicons name="document-text-outline" size={24} color={theme.colors.primary} />
        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
          {item.description ? (
            <Text style={styles.desc} numberOfLines={2}>{item.description}</Text>
          ) : null}
          <Text style={styles.meta}>
            {item.authorName} &middot; {item.folderPath || '/'} &middot; {formatDate(item.createdAt)}
          </Text>
          {item.tags?.length > 0 && (
            <View style={styles.tags}>
              {item.tags.slice(0, 3).map((tag) => (
                <View key={tag} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={20} color="#94a3b8" style={{ marginLeft: 12 }} />
        <TextInput
          style={styles.input}
          placeholder="Search documents..."
          placeholderTextColor="#94a3b8"
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => { setQuery(''); setResults([]); setSearched(false); }}>
            <Ionicons name="close-circle" size={20} color="#94a3b8" style={{ marginRight: 12 }} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : !searched ? (
        <View style={styles.center}>
          <Ionicons name="search-outline" size={64} color="#cbd5e1" />
          <Text style={styles.hintText}>Search across all documents</Text>
          <Text style={styles.hintSub}>Full-text search with fuzzy matching</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="alert-circle-outline" size={48} color="#cbd5e1" />
              <Text style={styles.hintText}>No results found</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1e293b', margin: 16, borderRadius: theme.borderRadius.lg,
  },
  input: {
    flex: 1, paddingHorizontal: 12, paddingVertical: 14,
    color: '#fff', fontSize: 16,
  },
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.lg,
    padding: 16, borderWidth: 1, borderColor: theme.colors.border,
  },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  content: { flex: 1, gap: 4 },
  title: { fontSize: 15, fontWeight: '600', color: theme.colors.text },
  desc: { fontSize: 13, color: theme.colors.textSecondary, lineHeight: 18 },
  meta: { fontSize: 11, color: '#94a3b8', marginTop: 4 },
  tags: { flexDirection: 'row', gap: 6, marginTop: 6 },
  tag: { backgroundColor: '#eff6ff', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  tagText: { fontSize: 10, color: theme.colors.primary, fontWeight: '500' },
  hintText: { fontSize: 16, color: theme.colors.textSecondary, fontWeight: '500' },
  hintSub: { fontSize: 13, color: '#94a3b8' },
});
