// ============================================================
// PINCHANTED — Admin Pin Database
// app/admin/pins.tsx
// ============================================================

import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
  TextInput,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { AntDesign } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/stores/auth.store';
import { supabase } from '../../src/lib/supabase';
import { sendNotification } from '../../src/lib/sendNotification';
import { Colors } from '../../src/constants/colors';
import { Theme } from '../../src/constants/theme';
import { CommunityPin, CommunityPinStatus } from '../../src/types/database.types';

type FilterType = 'unverified' | 'verified' | 'rejected' | 'all';

export default function AdminPinsScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuthStore();
  const [pins, setPins] = useState<CommunityPin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('unverified');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchPins();
  }, [filter]);

  const fetchPins = async () => {
    setIsLoading(true);
    let query = supabase
      .from('community_pins')
      .select('*')
      .order('created_at', { ascending: false });

    if (filter !== 'all') {
      query = query.eq('status', filter);
    }

    const { data } = await query;
    setPins((data as CommunityPin[]) || []);
    setIsLoading(false);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPins();
    setRefreshing(false);
  }, [filter]);

  const handleUpdateStatus = async (pin: CommunityPin, status: CommunityPinStatus) => {
    const labels: Record<CommunityPinStatus, string> = {
      verified: 'Approve',
      rejected: 'Reject',
      unverified: 'Reset to unverified',
    };

    Alert.alert(
      `${labels[status]} pin?`,
      `${labels[status]} "${pin.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: labels[status],
          style: status === 'rejected' ? 'destructive' : 'default',
          onPress: async () => {
            setActionLoading(pin.id);

            await supabase
              .from('community_pins')
              .update({
                status,
                reviewed_by: profile?.id,
                reviewed_at: new Date().toISOString(),
              })
              .eq('id', pin.id);

            // Notify the contributor when their pin is verified
            if (status === 'verified' && pin.contributed_by) {
              await sendNotification('community_pin_verified', pin.contributed_by, {
                pin_name: pin.name,
                pin_id: pin.id,
              });
            }

            await fetchPins();
            setActionLoading(null);
          },
        },
      ]
    );
  };

  const handleDelete = (pin: CommunityPin) => {
    Alert.alert(
      'Delete pin?',
      `Permanently delete "${pin.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(pin.id);
            await supabase.from('community_pins').delete().eq('id', pin.id);
            await fetchPins();
            setActionLoading(null);
          },
        },
      ]
    );
  };

  const getStatusConfig = (status: CommunityPinStatus) => {
    switch (status) {
      case 'verified': return { color: Colors.success, bg: Colors.successFaint, label: 'Verified' };
      case 'rejected': return { color: Colors.error, bg: Colors.errorFaint, label: 'Rejected' };
      default: return { color: Colors.gold, bg: Colors.goldFaint, label: 'Pending' };
    }
  };

  const filteredPins = pins.filter(p =>
    searchQuery
      ? p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.series_name || '').toLowerCase().includes(searchQuery.toLowerCase())
      : true
  );

  const renderPin = ({ item }: { item: CommunityPin }) => {
    const statusConfig = getStatusConfig(item.status);
    const isActionLoading = actionLoading === item.id;

    return (
      <View style={styles.pinCard}>
        <View style={styles.pinImageWrap}>
          <Text style={styles.pinEmoji}>📌</Text>
        </View>

        <View style={styles.pinInfo}>
          <View style={styles.pinNameRow}>
            <Text style={styles.pinName} numberOfLines={1}>{item.name}</Text>
            <View style={[styles.statusPill, { backgroundColor: statusConfig.bg, borderColor: statusConfig.color }]}>
              <Text style={[styles.statusPillText, { color: statusConfig.color }]}>
                {statusConfig.label}
              </Text>
            </View>
          </View>
          {item.series_name && (
            <Text style={styles.pinSeries}>{item.series_name}</Text>
          )}
          <View style={styles.pinMeta}>
            {item.edition && <Text style={styles.pinMetaText}>{item.edition}</Text>}
            {item.origin && <Text style={styles.pinMetaText}>{item.origin}</Text>}
          </View>
          <Text style={styles.pinDate}>
            Submitted {new Date(item.created_at).toLocaleDateString('en-CA', {
              year: 'numeric', month: 'short', day: 'numeric',
            })}
          </Text>
          {item.confirmation_count > 0 && (
            <Text style={styles.pinConfirmations}>
              {item.confirmation_count} confirmation{item.confirmation_count !== 1 ? 's' : ''}
            </Text>
          )}

          {isActionLoading ? (
            <ActivityIndicator size="small" color={Colors.gold} style={{ marginTop: Theme.spacing.xs }} />
          ) : (
            <View style={styles.pinActions}>
              {item.status !== 'verified' && (
                <TouchableOpacity
                  style={styles.approveBtn}
                  onPress={() => handleUpdateStatus(item, 'verified')}
                >
                  <AntDesign name="check" size={11} color={Colors.success} />
                  <Text style={styles.approveBtnText}>Approve</Text>
                </TouchableOpacity>
              )}
              {item.status !== 'rejected' && (
                <TouchableOpacity
                  style={styles.rejectBtn}
                  onPress={() => handleUpdateStatus(item, 'rejected')}
                >
                  <AntDesign name="close" size={11} color={Colors.error} />
                  <Text style={styles.rejectBtnText}>Reject</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => handleDelete(item)}
              >
                <AntDesign name="delete" size={11} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <LinearGradient colors={['#0f1d6e', '#0b1554', '#08103d']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>

        <View style={[styles.headerBar, { paddingTop: Theme.spacing.md + insets.top }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <AntDesign name="left" size={18} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Pin Database</Text>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>{filteredPins.length}</Text>
          </View>
        </View>

        <View style={styles.controls}>
          <View style={styles.searchBar}>
            <AntDesign name="search" size={14} color="rgba(255,255,255,0.4)" />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search pins..."
              placeholderTextColor={Colors.textPlaceholder}
              autoCapitalize="none"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <AntDesign name="close" size={14} color="rgba(255,255,255,0.4)" />
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.filterRow}>
            {(['unverified', 'verified', 'rejected', 'all'] as FilterType[]).map(f => (
              <TouchableOpacity
                key={f}
                style={[styles.filterChip, filter === f && styles.filterChipActive]}
                onPress={() => setFilter(f)}
              >
                <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.gold} />
          </View>
        ) : (
          <FlatList
            data={filteredPins}
            keyExtractor={item => item.id}
            renderItem={renderPin}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.gold} />
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No pins found</Text>
              </View>
            }
          />
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Theme.screenPadding,
    paddingBottom: Theme.spacing.md,
    backgroundColor: 'rgba(15,29,110,0.95)',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(245,197,24,0.12)',
  },
  backButton: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    fontSize: Theme.fontSize.lg,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  headerBadge: {
    backgroundColor: Colors.goldFaint,
    borderWidth: 0.5, borderColor: Colors.goldBorder,
    borderRadius: Theme.radius.pill,
    paddingVertical: 3, paddingHorizontal: 10,
  },
  headerBadgeText: { fontSize: Theme.fontSize.sm, color: Colors.gold },

  controls: {
    backgroundColor: 'rgba(15,29,110,0.95)',
    padding: Theme.screenPadding,
    paddingTop: Theme.spacing.sm,
    gap: Theme.spacing.sm,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(245,197,24,0.08)',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 0.5,
    borderColor: 'rgba(245,197,24,0.2)',
    borderRadius: Theme.radius.md,
    paddingHorizontal: Theme.spacing.md,
  },
  searchInput: {
    flex: 1,
    paddingVertical: Theme.spacing.sm,
    color: Colors.textPrimary,
    fontSize: Theme.fontSize.sm,
  },
  filterRow: { flexDirection: 'row', gap: Theme.spacing.xs, flexWrap: 'wrap' },
  filterChip: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: Theme.radius.pill,
    paddingVertical: 5, paddingHorizontal: 10,
  },
  filterChipActive: { backgroundColor: Colors.goldFaint, borderColor: Colors.goldBorder },
  filterChipText: { fontSize: Theme.fontSize.xs, color: Colors.textMuted },
  filterChipTextActive: { color: Colors.gold, fontWeight: '500' },

  listContent: {
    padding: Theme.screenPadding,
    paddingBottom: 60,
    gap: Theme.spacing.md,
  },

  pinCard: {
    flexDirection: 'row',
    gap: Theme.spacing.md,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.5,
    borderColor: 'rgba(245,197,24,0.15)',
    borderRadius: Theme.radius.md,
    overflow: 'hidden',
  },
  pinImageWrap: {
    width: 80,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  pinEmoji: { fontSize: 28 },
  pinInfo: { flex: 1, padding: Theme.spacing.md, gap: 4 },
  pinNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.xs,
    flexWrap: 'wrap',
  },
  pinName: {
    fontSize: Theme.fontSize.md,
    fontWeight: '500',
    color: Colors.textPrimary,
    flex: 1,
  },
  statusPill: {
    borderWidth: 0.5,
    borderRadius: Theme.radius.pill,
    paddingVertical: 2, paddingHorizontal: 7,
    flexShrink: 0,
  },
  statusPillText: { fontSize: 9, fontWeight: '500' },
  pinSeries: { fontSize: Theme.fontSize.xs, color: Colors.gold, opacity: 0.7 },
  pinMeta: { flexDirection: 'row', gap: Theme.spacing.sm },
  pinMetaText: { fontSize: Theme.fontSize.xs, color: Colors.textMuted },
  pinDate: { fontSize: Theme.fontSize.xs, color: Colors.textFaint },
  pinConfirmations: { fontSize: Theme.fontSize.xs, color: Colors.success },

  pinActions: {
    flexDirection: 'row',
    gap: Theme.spacing.xs,
    marginTop: Theme.spacing.xs,
    alignItems: 'center',
  },
  approveBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: Colors.successFaint,
    borderWidth: 0.5, borderColor: Colors.successBorder,
    borderRadius: Theme.radius.pill,
    paddingVertical: 4, paddingHorizontal: 8,
  },
  approveBtnText: { fontSize: 10, color: Colors.success, fontWeight: '500' },
  rejectBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: Colors.errorFaint,
    borderWidth: 0.5, borderColor: Colors.errorBorder,
    borderRadius: Theme.radius.pill,
    paddingVertical: 4, paddingHorizontal: 8,
  },
  rejectBtnText: { fontSize: 10, color: Colors.error, fontWeight: '500' },
  deleteBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
  },

  emptyState: { alignItems: 'center', padding: Theme.spacing.xl },
  emptyText: { fontSize: Theme.fontSize.sm, color: Colors.textMuted },
});