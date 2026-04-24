// ============================================================
// PINCHANTED — Profile Screen
// app/profile/index.tsx
// ============================================================

import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { AntDesign } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../../src/stores/auth.store';
import { supabase, updateProfile, uploadAvatarImage } from '../../src/lib/supabase';
import { Colors } from '../../src/constants/colors';
import { Theme } from '../../src/constants/theme';



const EXPERIENCE_LABELS: Record<string, string> = {
  'under-1': 'New Collector',
  '1-2': 'Casual Collector',
  '2-5': 'Enthusiast',
  '5-plus': 'Veteran Collector',
};

// Capitalised display labels for collecting styles
const STYLE_DISPLAY: Record<string, string> = {
  collector: 'Collector',
  trader: 'Trader',
  buyer: 'Buyer',
};

const STYLE_EMOJI: Record<string, string> = {
  collector: '📌',
  trader: '🔄',
  buyer: '🛒',
};

interface CollectionStats {
  totalPins: number;
  totalValue: number;
  tradesCompleted: number;
  wishlistCount: number;
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { profile, signOut, refreshProfile } = useAuthStore();
  const [stats, setStats] = useState<CollectionStats>({
    totalPins: 0,
    totalValue: 0,
    tradesCompleted: 0,
    wishlistCount: 0,
  });
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile?.avatar_url || null);

  useEffect(() => {
    if (profile?.id) fetchStats();
    setAvatarUrl(profile?.avatar_url || null);
  }, [profile?.id, profile?.avatar_url]);

  const fetchStats = async () => {
    if (!profile?.id) return;

    const { data: pins } = await supabase
      .from('collection_pins')
      .select('my_purchase_price')
      .eq('user_id', profile.id);

    const { count: wishlistCount } = await supabase
      .from('collection_pins')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', profile.id)
      .eq('is_wishlisted', true);

    const totalPins = pins?.length || 0;
    const totalValue = pins?.reduce((sum, p) =>
      sum + (p.my_purchase_price || 0), 0) || 0;

    setStats({
      totalPins,
      totalValue,
      tradesCompleted: profile.trades_completed || 0,
      wishlistCount: wishlistCount || 0,
    });
  };

  const handleChangeAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });

    if (result.canceled || !result.assets[0]) return;

    const { uri, base64 } = result.assets[0];
    if (!base64 || !profile?.id) return;

    setUploadingAvatar(true);
    const newUrl = await uploadAvatarImage(profile.id, uri, base64);
    if (newUrl) {
      await updateProfile(profile.id, { avatar_url: newUrl });
      await refreshProfile();
      setAvatarUrl(newUrl);
    } else {
      Alert.alert('Upload failed', 'Could not update your photo. Please try again.');
    }
    setUploadingAvatar(false);
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign out', style: 'destructive', onPress: signOut },
      ]
    );
  };

  const experienceLabel = EXPERIENCE_LABELS[profile?.collecting_experience || ''] || '';
  const collectingStyles = (profile?.collecting_style || []) as string[];
  const favouriteThemes = profile?.favourite_themes || [];

  return (
    <LinearGradient
      colors={['#0f1d6e', '#0b1554', '#08103d']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>

        {/* Header bar */}
        <View style={[styles.headerBar, { paddingTop: Theme.spacing.md + insets.top }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <AntDesign name="left" size={18} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Profile</Text>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => router.push('/profile/shipping')}
          >
            <AntDesign name="setting" size={18} color={Colors.gold} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >

          {/* Avatar + name */}
          <View style={styles.identityCard}>

            {/* Tappable avatar */}
            <TouchableOpacity
              style={styles.avatarWrap}
              onPress={handleChangeAvatar}
              disabled={uploadingAvatar}
            >
              {uploadingAvatar ? (
                <View style={styles.avatarDefault}>
                  <ActivityIndicator size="large" color={Colors.gold} />
                </View>
              ) : avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarDefault}>
                  <Text style={styles.avatarDefaultEmoji}>🏰</Text>
                </View>
              )}
              <View style={styles.avatarEditBadge}>
                <AntDesign name="camera" size={12} color="#fff" />
              </View>
            </TouchableOpacity>

            <Text style={styles.displayName}>
              {profile?.display_name || 'Collector'}
            </Text>
            <Text style={styles.username}>@{profile?.username || ''}</Text>

            {experienceLabel ? (
              <View style={styles.experienceBadge}>
                <Text style={styles.experienceBadgeText}>{experienceLabel}</Text>
              </View>
            ) : null}

            {(profile?.trade_rating ?? 0) > 0 && (
              <View style={styles.ratingRow}>
                <AntDesign name="star" size={14} color={Colors.gold} />
                <Text style={styles.ratingText}>
                  {profile!.trade_rating.toFixed(1)} trade rating
                </Text>
                <Text style={styles.ratingCount}>
                  ({profile!.trades_completed} completed)
                </Text>
              </View>
            )}
          </View>

          {/* Stats row */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.totalPins}</Text>
              <Text style={styles.statLabel}>Pins</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCard}>
              <Text style={styles.statValue}>${stats.totalValue.toFixed(0)}</Text>
              <Text style={styles.statLabel}>Value</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.wishlistCount}</Text>
              <Text style={styles.statLabel}>Wishlist</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.tradesCompleted}</Text>
              <Text style={styles.statLabel}>Trades</Text>
            </View>
          </View>

          {/* Collecting style */}
          {collectingStyles.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Collecting style</Text>
              <View style={styles.tagWrap}>
                {collectingStyles.map(style => (
                  <View key={style} style={styles.tag}>
                    <Text style={styles.tagText}>
                      {STYLE_EMOJI[style] || ''} {STYLE_DISPLAY[style] || style}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Favourite themes */}
          {favouriteThemes.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Favourite themes</Text>
              <View style={styles.tagWrap}>
                {favouriteThemes.map(theme => (
                  <View key={theme} style={[styles.tag, styles.tagTheme]}>
                    <Text style={[styles.tagText, styles.tagThemeText]}>{theme}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Favourite park */}
          {profile?.favourite_park && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Favourite park</Text>
              <View style={styles.infoRow}>
                <AntDesign name="environment" size={14} color={Colors.gold} />
                <Text style={styles.infoText}>{profile.favourite_park}</Text>
              </View>
            </View>
          )}

          {/* Shipping */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Shipping</Text>
              <TouchableOpacity onPress={() => router.push('/profile/shipping')}>
                <Text style={styles.sectionLink}>Edit →</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.shippingCard}>
              <View style={styles.infoRow}>
                <Text style={styles.shippingFlag}>
                  {profile?.country === 'US' ? '🇺🇸' : '🇨🇦'}
                </Text>
                <Text style={styles.infoText}>
                  {profile?.country === 'US' ? 'United States' : 'Canada'}
                </Text>
              </View>
              <View style={styles.shippingOptions}>
                <View style={styles.shippingOption}>
                  <AntDesign
                    name={profile?.ship_domestically ? 'check-circle' : 'close-circle'}
                    size={13}
                    color={profile?.ship_domestically ? Colors.success : Colors.textFaint}
                  />
                  <Text style={[
                    styles.shippingOptionText,
                    profile?.ship_domestically && styles.shippingOptionTextActive,
                  ]}>
                    Domestic shipping
                  </Text>
                </View>
                <View style={styles.shippingOption}>
                  <AntDesign
                    name={profile?.ship_internationally ? 'check-circle' : 'close-circle'}
                    size={13}
                    color={profile?.ship_internationally ? Colors.success : Colors.textFaint}
                  />
                  <Text style={[
                    styles.shippingOptionText,
                    profile?.ship_internationally && styles.shippingOptionTextActive,
                  ]}>
                    International shipping
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Account */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>
            <View style={styles.accountCard}>
              <View style={styles.accountRow}>
                <Text style={styles.accountLabel}>Member since</Text>
                <Text style={styles.accountValue}>
                  {profile?.created_at
                    ? new Date(profile.created_at).toLocaleDateString('en-CA', {
                        year: 'numeric', month: 'long',
                      })
                    : '—'}
                </Text>
              </View>
              {profile?.is_admin && (
                <View style={styles.accountRow}>
                  <Text style={styles.accountLabel}>Role</Text>
                  <TouchableOpacity
                    style={styles.adminBadge}
                    onPress={() => router.push('/admin/' as any)}
                  >
                    <Text style={styles.adminBadgeText}>Admin Panel →</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

          {/* Sign out */}
          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
            <AntDesign name="logout" size={15} color={Colors.error} />
            <Text style={styles.signOutText}>Sign out</Text>
          </TouchableOpacity>

        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },

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
  editButton: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(245,197,24,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },

  scrollView: { flex: 1 },
  scrollContent: {
    padding: Theme.screenPadding,
    paddingBottom: 60,
    gap: Theme.spacing.xl,
  },

  // Identity
  identityCard: {
    alignItems: 'center',
    gap: Theme.spacing.sm,
    paddingVertical: Theme.spacing.lg,
  },
  avatarWrap: {
    width: 88, height: 88,
    borderRadius: 44,
    position: 'relative',
    marginBottom: Theme.spacing.xs,
  },
  avatarImage: {
    width: 88, height: 88,
    borderRadius: 44,
    borderWidth: 2.5,
    borderColor: Colors.gold,
  },
  avatarDefault: {
    width: 88, height: 88,
    borderRadius: 44,
    backgroundColor: Colors.royalBlue,
    borderWidth: 2.5,
    borderColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarDefaultEmoji: { fontSize: 40 },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0, right: 0,
    width: 26, height: 26,
    borderRadius: 13,
    backgroundColor: Colors.crimson,
    borderWidth: 1.5,
    borderColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  displayName: {
    fontSize: Theme.fontSize.xxl,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  username: { fontSize: Theme.fontSize.md, color: Colors.textMuted },
  experienceBadge: {
    backgroundColor: Colors.goldFaint,
    borderWidth: 0.5,
    borderColor: Colors.goldBorder,
    borderRadius: Theme.radius.pill,
    paddingVertical: 4,
    paddingHorizontal: 12,
    marginTop: Theme.spacing.xs,
  },
  experienceBadgeText: {
    fontSize: Theme.fontSize.sm,
    color: Colors.gold,
    fontWeight: '500',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: Theme.spacing.xs,
  },
  ratingText: { fontSize: Theme.fontSize.sm, color: Colors.gold },
  ratingCount: { fontSize: Theme.fontSize.sm, color: Colors.textMuted },

  // Stats
  statsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 0.5,
    borderColor: Colors.goldBorder,
    borderRadius: Theme.radius.lg,
    overflow: 'hidden',
  },
  statCard: {
    flex: 1, alignItems: 'center',
    padding: Theme.spacing.md, gap: 4,
  },
  statValue: {
    fontSize: Theme.fontSize.xl,
    fontWeight: '500',
    color: Colors.textPrimary,
    lineHeight: 24,
  },
  statLabel: { fontSize: Theme.fontSize.xs, color: Colors.textMuted },
  statDivider: {
    width: 0.5,
    backgroundColor: Colors.goldBorder,
    marginVertical: Theme.spacing.sm,
  },

  // Section
  section: { gap: Theme.spacing.sm },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: Theme.fontSize.sm,
    fontWeight: '500',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionLink: { fontSize: Theme.fontSize.sm, color: Colors.gold },

  // Tags
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Theme.spacing.xs },
  tag: {
    backgroundColor: 'rgba(245,197,24,0.08)',
    borderWidth: 0.5,
    borderColor: Colors.goldBorder,
    borderRadius: Theme.radius.pill,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  tagText: { fontSize: Theme.fontSize.sm, color: Colors.gold },
  tagTheme: {
    backgroundColor: 'rgba(249,200,216,0.08)',
    borderColor: Colors.pinkBorder,
  },
  tagThemeText: { color: Colors.pink },

  // Info rows
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: Theme.spacing.sm },
  infoText: { fontSize: Theme.fontSize.md, color: Colors.textPrimary },

  // Shipping
  shippingCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.5,
    borderColor: 'rgba(245,197,24,0.15)',
    borderRadius: Theme.radius.md,
    padding: Theme.spacing.md,
    gap: Theme.spacing.md,
  },
  shippingFlag: { fontSize: 18 },
  shippingOptions: { gap: Theme.spacing.sm },
  shippingOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  shippingOptionText: { fontSize: Theme.fontSize.sm, color: Colors.textFaint },
  shippingOptionTextActive: { color: Colors.textPrimary },

  // Account
  accountCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.5,
    borderColor: 'rgba(245,197,24,0.15)',
    borderRadius: Theme.radius.md,
    padding: Theme.spacing.md,
    gap: Theme.spacing.md,
  },
  accountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  accountLabel: { fontSize: Theme.fontSize.sm, color: Colors.textMuted },
  accountValue: { fontSize: Theme.fontSize.sm, color: Colors.textPrimary },
  adminBadge: {
    backgroundColor: 'rgba(192,24,42,0.15)',
    borderWidth: 0.5,
    borderColor: 'rgba(192,24,42,0.4)',
    borderRadius: Theme.radius.pill,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  adminBadgeText: {
    fontSize: Theme.fontSize.xs,
    color: Colors.error,
    fontWeight: '500',
  },

  // Sign out
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.sm,
    padding: Theme.spacing.md,
    marginTop: Theme.spacing.sm,
  },
  signOutText: { fontSize: Theme.fontSize.md, color: Colors.error },
});