// ============================================================
// PINCHANTED — Public Profile Screen
// app/profile/[username].tsx
//
// Shows another user's public profile including:
// - Avatar, display name, username, experience badge
// - Trade rating and completed trades
// - Stats: pins, value, wishlist, trades
// - Recent ratings received
// - Collecting style, themes, favourite park
// - Shipping preferences
// - Their available pins (with propose trade button)
// ============================================================

import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { AntDesign } from '@expo/vector-icons';
import { supabase, getPinImageUrl, getUserRatings } from '../../src/lib/supabase';
import { Colors } from '../../src/constants/colors';
import { Theme } from '../../src/constants/theme';
import { GlobalHeader } from '../../src/components/GlobalHeader';

const EXPERIENCE_LABELS: Record<string, string> = {
  'under-1': 'New Collector',
  '1-2': 'Casual Collector',
  '2-5': 'Enthusiast',
  '5-plus': 'Veteran Collector',
};

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

interface PublicProfile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  trade_rating: number;
  trades_completed: number;
  collecting_experience: string | null;
  collecting_style: string[];
  favourite_themes: string[];
  favourite_park: string | null;
  ship_domestically: boolean;
  ship_internationally: boolean;
  country: string | null;
  created_at: string;
  is_admin: boolean;
}

interface PinItem {
  id: string;
  name: string;
  series: string | null;
  imageUrl: string | null;
  condition: string | null;
  edition: string | null;
}

export default function PublicProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const insets = useSafeAreaInsets();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [pins, setPins] = useState<PinItem[]>([]);
  const [recentRatings, setRecentRatings] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalPins: 0, totalValue: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pins' | 'ratings'>('pins');

  useEffect(() => {
    if (username) fetchProfile();
  }, [username]);

  const fetchProfile = async () => {
    setIsLoading(true);

    // Fetch profile by username
    const { data: profileData, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('username', username)
      .single();

    if (error || !profileData) {
      setIsLoading(false);
      return;
    }

    setProfile(profileData as PublicProfile);

    // Fetch their available pins
    const { data: pinsData } = await supabase
      .from('collection_pins')
      .select(`
        id,
        my_image_path,
        condition,
        my_purchase_price,
        override_name,
        override_series_name,
        override_edition,
        reference_pin:reference_pins(name, series_name, edition),
        community_pin:community_pins(name, series_name, edition)
      `)
      .eq('user_id', profileData.id)
      .eq('is_deleted', false)
      .eq('trade_status', 'available')
      .order('added_at', { ascending: false });

    if (pinsData) {
      const mapped: PinItem[] = pinsData.map((pin: any) => ({
        id: pin.id,
        name: pin.override_name ?? pin.reference_pin?.name ?? pin.community_pin?.name ?? 'Unknown pin',
        series: pin.override_series_name ?? pin.reference_pin?.series_name ?? pin.community_pin?.series_name ?? null,
        edition: pin.override_edition ?? pin.reference_pin?.edition ?? pin.community_pin?.edition ?? null,
        imageUrl: pin.my_image_path ? getPinImageUrl(pin.my_image_path) : null,
        condition: pin.condition,
      }));
      setPins(mapped);

      const totalValue = pinsData.reduce((sum: number, p: any) => sum + (p.my_purchase_price || 0), 0);
      setStats({ totalPins: pinsData.length, totalValue });
    }

    // Fetch ratings
    const { data: ratingsData } = await getUserRatings(profileData.id);
    setRecentRatings(ratingsData || []);

    setIsLoading(false);
  };

  if (isLoading) {
    return (
      <LinearGradient colors={['#0f1d6e', '#0b1554', '#08103d']} style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.gold} />
        </View>
      </LinearGradient>
    );
  }

  if (!profile) {
    return (
      <LinearGradient colors={['#0f1d6e', '#0b1554', '#08103d']} style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['bottom']}>
          <GlobalHeader />
          <View style={styles.notFoundContainer}>
            <Text style={styles.notFoundEmoji}>🔍</Text>
            <Text style={styles.notFoundTitle}>User not found</Text>
            <Text style={styles.notFoundSubtitle}>@{username} doesn't exist or has been removed.</Text>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Text style={styles.backBtnText}>Go back</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const experienceLabel = EXPERIENCE_LABELS[profile.collecting_experience || ''] || '';
  const collectingStyles = profile.collecting_style || [];
  const favouriteThemes = profile.favourite_themes || [];

  return (
    <LinearGradient colors={['#0f1d6e', '#0b1554', '#08103d']} style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <GlobalHeader />

        {/* Header bar */}
        <View style={styles.headerBar}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <AntDesign name="left" size={18} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>@{profile.username}</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Avatar + name */}
          <View style={styles.identityCard}>
            <View style={styles.avatarWrap}>
              {profile.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarDefault}>
                  <Text style={styles.avatarDefaultEmoji}>🏰</Text>
                </View>
              )}
            </View>
            <Text style={styles.displayName}>{profile.display_name || profile.username}</Text>
            <Text style={styles.username}>@{profile.username}</Text>
            {experienceLabel ? (
              <View style={styles.experienceBadge}>
                <Text style={styles.experienceBadgeText}>{experienceLabel}</Text>
              </View>
            ) : null}
            {profile.trade_rating > 0 && (
              <View style={styles.ratingRow}>
                <AntDesign name="star" size={14} color={Colors.gold} />
                <Text style={styles.ratingText}>
                  {profile.trade_rating.toFixed(1)} trade rating
                </Text>
                <Text style={styles.ratingCount}>
                  ({profile.trades_completed} completed)
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
              <Text style={styles.statValue}>{profile.trades_completed}</Text>
              <Text style={styles.statLabel}>Trades</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {profile.ship_internationally ? '🌍' : profile.ship_domestically ? '🏠' : '—'}
              </Text>
              <Text style={styles.statLabel}>Ships</Text>
            </View>
          </View>

          {/* Propose trade button */}
          <TouchableOpacity
            style={styles.tradeBtn}
            onPress={() => router.push(`/trade/new?recipientId=${profile.id}` as any)}
          >
            <AntDesign name="swap" size={16} color="#fff" />
            <Text style={styles.tradeBtnText}>Propose a trade</Text>
          </TouchableOpacity>

          {/* Tabs — Pins / Ratings */}
          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'pins' && styles.tabActive]}
              onPress={() => setActiveTab('pins')}
            >
              <Text style={[styles.tabText, activeTab === 'pins' && styles.tabTextActive]}>
                Pins ({pins.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'ratings' && styles.tabActive]}
              onPress={() => setActiveTab('ratings')}
            >
              <Text style={[styles.tabText, activeTab === 'ratings' && styles.tabTextActive]}>
                Ratings ({recentRatings.length})
              </Text>
            </TouchableOpacity>
          </View>

          {/* Pins tab */}
          {activeTab === 'pins' && (
            pins.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyEmoji}>📌</Text>
                <Text style={styles.emptyText}>No pins available to trade</Text>
              </View>
            ) : (
              <View style={styles.pinGrid}>
                {pins.map(pin => (
                  <TouchableOpacity
                    key={pin.id}
                    style={styles.pinCard}
                    onPress={() => router.push(`/pin/${pin.id}?fromMarketplace=true` as any)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.pinImageWrap}>
                      {pin.imageUrl ? (
                        <Image source={{ uri: pin.imageUrl }} style={styles.pinImage} resizeMode="cover" />
                      ) : (
                        <Text style={styles.pinEmoji}>📌</Text>
                      )}
                    </View>
                    <View style={styles.pinInfo}>
                      <Text style={styles.pinName} numberOfLines={2}>{pin.name}</Text>
                      {pin.series && <Text style={styles.pinSeries} numberOfLines={1}>{pin.series}</Text>}
                      {pin.condition && <Text style={styles.pinCondition}>{pin.condition}</Text>}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )
          )}

          {/* Ratings tab */}
          {activeTab === 'ratings' && (
            recentRatings.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyEmoji}>⭐</Text>
                <Text style={styles.emptyText}>No ratings yet</Text>
              </View>
            ) : (
              <View style={styles.ratingsSection}>
                {recentRatings.map(rating => (
                  <View key={rating.id} style={styles.ratingCard}>
                    <View style={styles.ratingCardHeader}>
                      <Text style={styles.ratingCardUsername}>@{rating.rater?.username}</Text>
                      <View style={styles.ratingCardStars}>
                        {[1, 2, 3, 4, 5].map(star => (
                          <AntDesign
                            key={star}
                            name="star"
                            size={12}
                            color={star <= rating.rating ? Colors.gold : 'rgba(255,255,255,0.15)'}
                          />
                        ))}
                      </View>
                    </View>
                    {rating.comment && (
                      <Text style={styles.ratingCardComment}>{rating.comment}</Text>
                    )}
                    <Text style={styles.ratingCardDate}>
                      {new Date(rating.created_at).toLocaleDateString('en-CA', {
                        year: 'numeric', month: 'short', day: 'numeric',
                      })}
                    </Text>
                  </View>
                ))}
              </View>
            )
          )}

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
          {profile.favourite_park && (
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
            <Text style={styles.sectionTitle}>Shipping</Text>
            <View style={styles.shippingCard}>
              <View style={styles.infoRow}>
                <Text style={styles.shippingFlag}>
                  {profile.country === 'US' ? '🇺🇸' : '🇨🇦'}
                </Text>
                <Text style={styles.infoText}>
                  {profile.country === 'US' ? 'United States' : 'Canada'}
                </Text>
              </View>
              <View style={styles.shippingOptions}>
                <View style={styles.shippingOption}>
                  <AntDesign
                    name={profile.ship_domestically ? 'check-circle' : 'close-circle'}
                    size={13}
                    color={profile.ship_domestically ? Colors.success : Colors.textFaint}
                  />
                  <Text style={[styles.shippingOptionText, profile.ship_domestically && styles.shippingOptionTextActive]}>
                    Domestic shipping
                  </Text>
                </View>
                <View style={styles.shippingOption}>
                  <AntDesign
                    name={profile.ship_internationally ? 'check-circle' : 'close-circle'}
                    size={13}
                    color={profile.ship_internationally ? Colors.success : Colors.textFaint}
                  />
                  <Text style={[styles.shippingOptionText, profile.ship_internationally && styles.shippingOptionTextActive]}>
                    International shipping
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Member since */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Member since</Text>
            <Text style={styles.infoText}>
              {new Date(profile.created_at).toLocaleDateString('en-CA', {
                year: 'numeric', month: 'long',
              })}
            </Text>
          </View>

        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFoundContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Theme.screenPadding, gap: Theme.spacing.md },
  notFoundEmoji: { fontSize: 48 },
  notFoundTitle: { fontSize: Theme.fontSize.xl, fontWeight: '500', color: Colors.textPrimary },
  notFoundSubtitle: { fontSize: Theme.fontSize.sm, color: Colors.textMuted, textAlign: 'center' },
  backBtn: { backgroundColor: Colors.crimson, borderRadius: Theme.radius.pill, paddingVertical: Theme.spacing.sm, paddingHorizontal: Theme.spacing.xl, borderWidth: 1, borderColor: Colors.goldBorder, marginTop: Theme.spacing.sm },
  backBtnText: { color: Colors.textPrimary, fontSize: Theme.fontSize.md, fontWeight: '500' },
  headerBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Theme.screenPadding, paddingVertical: Theme.spacing.md, backgroundColor: 'rgba(15,29,110,0.95)', borderBottomWidth: 0.5, borderBottomColor: 'rgba(245,197,24,0.12)' },
  backButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: Theme.fontSize.lg, fontWeight: '500', color: Colors.textPrimary },
  scrollView: { flex: 1 },
  scrollContent: { padding: Theme.screenPadding, paddingBottom: 60, gap: Theme.spacing.xl },
  identityCard: { alignItems: 'center', gap: Theme.spacing.sm, paddingVertical: Theme.spacing.lg },
  avatarWrap: { width: 88, height: 88, borderRadius: 44, marginBottom: Theme.spacing.xs },
  avatarImage: { width: 88, height: 88, borderRadius: 44, borderWidth: 2.5, borderColor: Colors.gold },
  avatarDefault: { width: 88, height: 88, borderRadius: 44, backgroundColor: Colors.royalBlue, borderWidth: 2.5, borderColor: Colors.gold, alignItems: 'center', justifyContent: 'center' },
  avatarDefaultEmoji: { fontSize: 40 },
  displayName: { fontSize: Theme.fontSize.xxl, fontWeight: '500', color: Colors.textPrimary },
  username: { fontSize: Theme.fontSize.md, color: Colors.textMuted },
  experienceBadge: { backgroundColor: Colors.goldFaint, borderWidth: 0.5, borderColor: Colors.goldBorder, borderRadius: Theme.radius.pill, paddingVertical: 4, paddingHorizontal: 12, marginTop: Theme.spacing.xs },
  experienceBadgeText: { fontSize: Theme.fontSize.sm, color: Colors.gold, fontWeight: '500' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: Theme.spacing.xs },
  ratingText: { fontSize: Theme.fontSize.sm, color: Colors.gold },
  ratingCount: { fontSize: Theme.fontSize.sm, color: Colors.textMuted },
  statsRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 0.5, borderColor: Colors.goldBorder, borderRadius: Theme.radius.lg, overflow: 'hidden' },
  statCard: { flex: 1, alignItems: 'center', padding: Theme.spacing.md, gap: 4 },
  statValue: { fontSize: Theme.fontSize.xl, fontWeight: '500', color: Colors.textPrimary, lineHeight: 24 },
  statLabel: { fontSize: Theme.fontSize.xs, color: Colors.textMuted },
  statDivider: { width: 0.5, backgroundColor: Colors.goldBorder, marginVertical: Theme.spacing.sm },
  tradeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Theme.spacing.sm, backgroundColor: Colors.crimson, borderRadius: Theme.radius.pill, paddingVertical: Theme.spacing.md, borderWidth: 1, borderColor: Colors.goldBorder },
  tradeBtnText: { fontSize: Theme.fontSize.md, fontWeight: '500', color: '#fff' },
  tabs: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: Theme.radius.md, padding: 3, gap: 3 },
  tab: { flex: 1, borderRadius: Theme.radius.sm, paddingVertical: 7, alignItems: 'center' },
  tabActive: { backgroundColor: Colors.goldFaint, borderWidth: 0.5, borderColor: 'rgba(245,197,24,0.35)' },
  tabText: { fontSize: Theme.fontSize.sm, color: Colors.textMuted },
  tabTextActive: { color: Colors.gold, fontWeight: '500' },
  emptyContainer: { alignItems: 'center', padding: Theme.spacing.xl, gap: Theme.spacing.md },
  emptyEmoji: { fontSize: 36 },
  emptyText: { fontSize: Theme.fontSize.sm, color: Colors.textMuted },
  pinGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Theme.spacing.md },
  pinCard: { width: '47%', backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 0.5, borderColor: 'rgba(245,197,24,0.15)', borderRadius: Theme.radius.md, overflow: 'hidden' },
  pinImageWrap: { aspectRatio: 1, backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center' },
  pinImage: { width: '100%', height: '100%' },
  pinEmoji: { fontSize: 32 },
  pinInfo: { padding: Theme.spacing.sm, gap: 2 },
  pinName: { fontSize: Theme.fontSize.sm, fontWeight: '500', color: Colors.textPrimary, lineHeight: 16 },
  pinSeries: { fontSize: Theme.fontSize.xs, color: Colors.gold, opacity: 0.7 },
  pinCondition: { fontSize: Theme.fontSize.xs, color: Colors.textMuted },
  ratingsSection: { gap: Theme.spacing.md },
  ratingCard: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 0.5, borderColor: 'rgba(245,197,24,0.15)', borderRadius: Theme.radius.md, padding: Theme.spacing.md, gap: Theme.spacing.xs },
  ratingCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ratingCardUsername: { fontSize: Theme.fontSize.sm, color: Colors.textPrimary, fontWeight: '500' },
  ratingCardStars: { flexDirection: 'row', gap: 2 },
  ratingCardComment: { fontSize: Theme.fontSize.sm, color: Colors.textMuted, lineHeight: 18, fontStyle: 'italic' },
  ratingCardDate: { fontSize: Theme.fontSize.xs, color: Colors.textMuted },
  section: { gap: Theme.spacing.sm },
  sectionTitle: { fontSize: Theme.fontSize.sm, fontWeight: '500', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Theme.spacing.xs },
  tag: { backgroundColor: 'rgba(245,197,24,0.08)', borderWidth: 0.5, borderColor: Colors.goldBorder, borderRadius: Theme.radius.pill, paddingVertical: 5, paddingHorizontal: 12 },
  tagText: { fontSize: Theme.fontSize.sm, color: Colors.gold },
  tagTheme: { backgroundColor: 'rgba(249,200,216,0.08)', borderColor: Colors.pinkBorder },
  tagThemeText: { color: Colors.pink },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: Theme.spacing.sm },
  infoText: { fontSize: Theme.fontSize.md, color: Colors.textPrimary },
  shippingCard: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 0.5, borderColor: 'rgba(245,197,24,0.15)', borderRadius: Theme.radius.md, padding: Theme.spacing.md, gap: Theme.spacing.md },
  shippingFlag: { fontSize: 18 },
  shippingOptions: { gap: Theme.spacing.sm },
  shippingOption: { flexDirection: 'row', alignItems: 'center', gap: Theme.spacing.sm },
  shippingOptionText: { fontSize: Theme.fontSize.sm, color: Colors.textFaint },
  shippingOptionTextActive: { color: Colors.textPrimary },
});