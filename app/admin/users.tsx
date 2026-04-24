// ============================================================
// PINCHANTED — Admin User Management
// app/admin/users.tsx
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
import { Colors } from '../../src/constants/colors';
import { Theme } from '../../src/constants/theme';
import { Profile } from '../../src/types/database.types';

type FilterType = 'all' | 'suspended' | 'admin';

export default function AdminUsersScreen() {
  const insets = useSafeAreaInsets();
  const { profile: myProfile } = useAuthStore();
  const [users, setUsers] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, [filter]);

  const fetchUsers = async () => {
    setIsLoading(true);
    let query = supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (filter === 'suspended') query = query.eq('is_suspended', true);
    if (filter === 'admin') query = query.eq('is_admin', true);

    const { data } = await query;
    setUsers((data as Profile[]) || []);
    setIsLoading(false);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchUsers();
    setRefreshing(false);
  }, [filter]);

  const handleSuspend = (user: Profile) => {
    const isSuspended = user.is_suspended;
    Alert.alert(
      isSuspended ? 'Unsuspend user?' : 'Suspend user?',
      isSuspended
        ? `Restore access for @${user.username}?`
        : `Suspend @${user.username}? They will lose access to the app.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isSuspended ? 'Unsuspend' : 'Suspend',
          style: isSuspended ? 'default' : 'destructive',
          onPress: async () => {
            setActionLoading(user.id);
            await supabase
              .from('profiles')
              .update({
                is_suspended: !isSuspended,
                suspended_at: isSuspended ? null : new Date().toISOString(),
                suspended_reason: isSuspended ? null : 'Suspended by admin',
              })
              .eq('id', user.id);
            await fetchUsers();
            setActionLoading(null);
          },
        },
      ]
    );
  };

  const handleToggleAdmin = (user: Profile) => {
    if (user.id === myProfile?.id) {
      Alert.alert('Cannot modify', 'You cannot change your own admin status.');
      return;
    }
    Alert.alert(
      user.is_admin ? 'Remove admin?' : 'Make admin?',
      `${user.is_admin ? 'Remove admin access from' : 'Grant admin access to'} @${user.username}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: user.is_admin ? 'destructive' : 'default',
          onPress: async () => {
            setActionLoading(user.id);
            await supabase
              .from('profiles')
              .update({ is_admin: !user.is_admin })
              .eq('id', user.id);
            await fetchUsers();
            setActionLoading(null);
          },
        },
      ]
    );
  };

  const filteredUsers = users.filter(u =>
    searchQuery
      ? u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.display_name.toLowerCase().includes(searchQuery.toLowerCase())
      : true
  );

  const getInitial = (u: Profile) => u.display_name?.[0]?.toUpperCase() || '?';

  const renderUser = ({ item }: { item: Profile }) => {
    const isMe = item.id === myProfile?.id;
    const isActionLoading = actionLoading === item.id;

    return (
      <View style={[
        styles.userCard,
        item.is_suspended && styles.userCardSuspended,
      ]}>
        <View style={styles.userAvatar}>
          <Text style={styles.userAvatarText}>{getInitial(item)}</Text>
        </View>

        <View style={styles.userInfo}>
          <View style={styles.userNameRow}>
            <Text style={styles.userName}>{item.display_name}</Text>
            {item.is_admin && (
              <View style={styles.adminPill}>
                <Text style={styles.adminPillText}>Admin</Text>
              </View>
            )}
            {item.is_suspended && (
              <View style={styles.suspendedPill}>
                <Text style={styles.suspendedPillText}>Suspended</Text>
              </View>
            )}
            {isMe && (
              <View style={styles.mePill}>
                <Text style={styles.mePillText}>You</Text>
              </View>
            )}
          </View>
          <Text style={styles.userUsername}>@{item.username}</Text>
          <View style={styles.userMeta}>
            <Text style={styles.userMetaText}>
              {item.country === 'US' ? '🇺🇸' : '🇨🇦'} · {item.trades_completed} trades · ⭐ {item.trade_rating.toFixed(1)}
            </Text>
          </View>
          <Text style={styles.userJoined}>
            Joined {new Date(item.created_at).toLocaleDateString('en-CA', {
              year: 'numeric', month: 'short', day: 'numeric',
            })}
          </Text>
        </View>

        {/* Actions */}
        {!isMe && (
          <View style={styles.userActions}>
            {isActionLoading ? (
              <ActivityIndicator size="small" color={Colors.gold} />
            ) : (
              <>
                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    item.is_suspended ? styles.actionBtnSuccess : styles.actionBtnDanger,
                  ]}
                  onPress={() => handleSuspend(item)}
                >
                  <AntDesign
                    name={item.is_suspended ? 'check-circle' : 'close-circle'}
                    size={13}
                    color={item.is_suspended ? Colors.success : Colors.error}
                  />
                  <Text style={[
                    styles.actionBtnText,
                    { color: item.is_suspended ? Colors.success : Colors.error },
                  ]}>
                    {item.is_suspended ? 'Restore' : 'Suspend'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionBtnGold]}
                  onPress={() => handleToggleAdmin(item)}
                >
                  <AntDesign name="setting" size={13} color={Colors.gold} />
                  <Text style={[styles.actionBtnText, { color: Colors.gold }]}>
                    {item.is_admin ? 'Revoke' : 'Admin'}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
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
          <Text style={styles.headerTitle}>User Management</Text>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>{filteredUsers.length}</Text>
          </View>
        </View>

        {/* Search + filter */}
        <View style={styles.controls}>
          <View style={styles.searchBar}>
            <AntDesign name="search" size={14} color="rgba(255,255,255,0.4)" />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search users..."
              placeholderTextColor={Colors.textPlaceholder}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <AntDesign name="close" size={14} color="rgba(255,255,255,0.4)" />
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.filterRow}>
            {(['all', 'suspended', 'admin'] as FilterType[]).map(f => (
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
            data={filteredUsers}
            keyExtractor={item => item.id}
            renderItem={renderUser}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.gold} />
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No users found</Text>
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
    borderWidth: 0.5,
    borderColor: Colors.goldBorder,
    borderRadius: Theme.radius.pill,
    paddingVertical: 3,
    paddingHorizontal: 10,
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
  filterRow: { flexDirection: 'row', gap: Theme.spacing.xs },
  filterChip: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: Theme.radius.pill,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  filterChipActive: {
    backgroundColor: Colors.goldFaint,
    borderColor: Colors.goldBorder,
  },
  filterChipText: { fontSize: Theme.fontSize.xs, color: Colors.textMuted },
  filterChipTextActive: { color: Colors.gold, fontWeight: '500' },

  listContent: {
    padding: Theme.screenPadding,
    paddingBottom: 60,
    gap: Theme.spacing.md,
  },

  userCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Theme.spacing.md,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.5,
    borderColor: 'rgba(245,197,24,0.15)',
    borderRadius: Theme.radius.md,
    padding: Theme.spacing.md,
  },
  userCardSuspended: {
    borderColor: 'rgba(192,24,42,0.3)',
    backgroundColor: 'rgba(192,24,42,0.05)',
  },
  userAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.royalBlue,
    borderWidth: 1.5, borderColor: Colors.goldBorder,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  userAvatarText: { fontSize: Theme.fontSize.md, fontWeight: '500', color: Colors.gold },
  userInfo: { flex: 1, gap: 3 },
  userNameRow: { flexDirection: 'row', alignItems: 'center', gap: Theme.spacing.xs, flexWrap: 'wrap' },
  userName: { fontSize: Theme.fontSize.md, fontWeight: '500', color: Colors.textPrimary },
  userUsername: { fontSize: Theme.fontSize.sm, color: Colors.textMuted },
  userMeta: { flexDirection: 'row', alignItems: 'center' },
  userMetaText: { fontSize: Theme.fontSize.xs, color: Colors.textMuted },
  userJoined: { fontSize: Theme.fontSize.xs, color: Colors.textFaint },

  adminPill: {
    backgroundColor: 'rgba(192,24,42,0.15)',
    borderWidth: 0.5, borderColor: 'rgba(192,24,42,0.4)',
    borderRadius: Theme.radius.pill,
    paddingVertical: 1, paddingHorizontal: 6,
  },
  adminPillText: { fontSize: 9, color: Colors.error, fontWeight: '500' },
  suspendedPill: {
    backgroundColor: 'rgba(192,24,42,0.15)',
    borderWidth: 0.5, borderColor: 'rgba(192,24,42,0.4)',
    borderRadius: Theme.radius.pill,
    paddingVertical: 1, paddingHorizontal: 6,
  },
  suspendedPillText: { fontSize: 9, color: Colors.error, fontWeight: '500' },
  mePill: {
    backgroundColor: Colors.goldFaint,
    borderWidth: 0.5, borderColor: Colors.goldBorder,
    borderRadius: Theme.radius.pill,
    paddingVertical: 1, paddingHorizontal: 6,
  },
  mePillText: { fontSize: 9, color: Colors.gold, fontWeight: '500' },

  userActions: { gap: Theme.spacing.xs, flexShrink: 0 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 0.5,
    borderRadius: Theme.radius.pill,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  actionBtnDanger: {
    borderColor: 'rgba(192,24,42,0.3)',
    backgroundColor: 'rgba(192,24,42,0.08)',
  },
  actionBtnSuccess: {
    borderColor: Colors.successBorder,
    backgroundColor: Colors.successFaint,
  },
  actionBtnGold: {
    borderColor: Colors.goldBorder,
    backgroundColor: Colors.goldFaint,
  },
  actionBtnText: { fontSize: 10, fontWeight: '500' },

  emptyState: { alignItems: 'center', padding: Theme.spacing.xl },
  emptyText: { fontSize: Theme.fontSize.sm, color: Colors.textMuted },
});