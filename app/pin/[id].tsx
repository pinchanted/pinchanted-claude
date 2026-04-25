// ============================================================
// PINCHANTED — Pin Detail Screen
// app/pin/[id].tsx
// ============================================================

import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
  Image,
  Switch,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { AntDesign } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/stores/auth.store';
import { useCollectionStore } from '../../src/stores/collection.store';
import {
  supabase,
  updateCollectionPin,
  removeFromCollection,
  getPinImageUrl,
} from '../../src/lib/supabase';
import { Colors } from '../../src/constants/colors';
import { Theme } from '../../src/constants/theme';
import { CollectionPin, PinTradeStatus } from '../../src/types/database.types';

const CONDITIONS = ['Mint', 'Near Mint', 'Good', 'Fair'];

const TRADE_STATUS_OPTIONS: { value: PinTradeStatus; label: string; color: string }[] = [
  { value: 'available', label: 'Available', color: Colors.textMuted },
  { value: 'on_table', label: 'On the table', color: Colors.gold },
  { value: 'requested', label: 'Wanted by others', color: Colors.wanted },
  { value: 'committed', label: 'Committed', color: Colors.committed },
];

const EDITION_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  'Limited Edition': { label: 'LE', color: Colors.error, bg: Colors.errorFaint },
  'Open Edition': { label: 'OE', color: Colors.success, bg: Colors.successFaint },
  'Limited Release': { label: 'LR', color: '#c4b5fd', bg: 'rgba(124,58,237,0.15)' },
};

export default function PinDetailScreen() {
  const { id, fromMarketplace } = useLocalSearchParams<{ id: string; fromMarketplace?: string }>();
  const insets = useSafeAreaInsets();
  const { profile } = useAuthStore();
  const { fetchCollection } = useCollectionStore();

  const [pin, setPin] = useState<CollectionPin | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // ── Owner personal fields ────────────────────────────────
  const [condition, setCondition] = useState('Mint');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [notes, setNotes] = useState('');
  const [tradeStatus, setTradeStatus] = useState<PinTradeStatus>('available');
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [tradeStatusExpanded, setTradeStatusExpanded] = useState(false);

  // ── Owner metadata overrides ─────────────────────────────
  // Pre-populated from override_* columns (which fall back to reference/community pin defaults)
  const [overrideName, setOverrideName] = useState('');
  const [overrideSeriesName, setOverrideSeriesName] = useState('');
  const [overrideEdition, setOverrideEdition] = useState('');
  const [overrideOrigin, setOverrideOrigin] = useState('');
  const [overrideOriginalPrice, setOverrideOriginalPrice] = useState('');

  // ── Marketplace listing ──────────────────────────────────
  const [hasListing, setHasListing] = useState(false);
  const [listingId, setListingId] = useState<string | null>(null);
  const [openToTrade, setOpenToTrade] = useState(true);
  const [openToSale, setOpenToSale] = useState(false);
  const [askingPrice, setAskingPrice] = useState('');
  const [listingDescription, setListingDescription] = useState('');
  const [savingListing, setSavingListing] = useState(false);

  useEffect(() => {
    if (id) fetchPin();
  }, [id]);

  const fetchPin = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('collection_pins')
      .select(`
        *,
        reference_pin:reference_pins(*),
        community_pin:community_pins(*)
      `)
      .eq('id', id)
      .single();

    if (error || !data) {
      Alert.alert('Error', 'Could not load pin details.');
      router.back();
      return;
    }

    const p = data as CollectionPin;
    setPin(p);

    // Personal fields
    setCondition(p.condition || 'Mint');
    setPurchasePrice(p.my_purchase_price?.toString() || '');
    setNotes(p.notes || '');
    setTradeStatus(p.trade_status as PinTradeStatus);
    setIsWishlisted(p.is_wishlisted);

    // ── Coalesce pattern for metadata overrides ──────────────
    // Show override value if set, otherwise fall back to reference/community pin default
    const refPin = p.reference_pin as any;
    const comPin = p.community_pin as any;
    setOverrideName((p as any).override_name ?? refPin?.name ?? comPin?.name ?? '');
    setOverrideSeriesName((p as any).override_series_name ?? refPin?.series_name ?? comPin?.series_name ?? '');
    setOverrideEdition((p as any).override_edition ?? refPin?.edition ?? comPin?.edition ?? '');
    setOverrideOrigin((p as any).override_origin ?? refPin?.origin ?? comPin?.origin ?? '');
    setOverrideOriginalPrice(
      ((p as any).override_original_price ?? refPin?.original_price ?? comPin?.original_price)?.toString() ?? ''
    );

    if (p.my_image_path) {
      setImageUrl(getPinImageUrl(p.my_image_path));
    }

    // Fetch marketplace listing
    const { data: listing } = await supabase
      .from('marketplace_listings')
      .select('*')
      .eq('collection_pin_id', id)
      .eq('status', 'active')
      .maybeSingle();

    if (listing) {
      setHasListing(true);
      setListingId(listing.id);
      setOpenToTrade(listing.open_to_trade);
      setOpenToSale(listing.open_to_sale);
      setAskingPrice(listing.asking_price?.toString() || '');
      setListingDescription(listing.description || '');
    }

    // For non-owners: check user_wishlist table
    if (p.user_id !== profile?.id) {
      const col = p.reference_pin_id ? 'reference_pin_id' : 'community_pin_id';
      const val = (p as any).reference_pin_id || (p as any).community_pin_id;
      if (val) {
        const { data: wishlistEntry } = await supabase
          .from('user_wishlist')
          .select('id')
          .eq('user_id', profile?.id)
          .eq(col, val)
          .maybeSingle();
        setIsWishlisted(!!wishlistEntry);
      }
    }

    setIsLoading(false);
  };

  // ── Coalesce helpers for display (read-only fields) ──────
  // These are used in the hero card for values the owner hasn't overridden
  const getDisplayValue = (pin: CollectionPin, field: string): any => {
    const override = (pin as any)[`override_${field}`];
    if (override !== null && override !== undefined) return override;
    const ref = (pin.reference_pin as any)?.[field];
    if (ref !== null && ref !== undefined) return ref;
    return (pin.community_pin as any)?.[field] ?? null;
  };

  const saveChanges = async () => {
    if (!pin) return;
    setIsSaving(true);

    // Determine which overrides the user has actually changed vs the source defaults
    const refPin = pin.reference_pin as any;
    const comPin = pin.community_pin as any;

    const sourceDefaults = {
      name: refPin?.name ?? comPin?.name ?? '',
      series_name: refPin?.series_name ?? comPin?.series_name ?? '',
      edition: refPin?.edition ?? comPin?.edition ?? '',
      origin: refPin?.origin ?? comPin?.origin ?? '',
      original_price: (refPin?.original_price ?? comPin?.original_price)?.toString() ?? '',
    };

    const { error } = await updateCollectionPin(pin.id, {
      condition,
      my_purchase_price: purchasePrice ? parseFloat(purchasePrice) : null,
      notes: notes.trim() || null,
      trade_status: tradeStatus,
      is_wishlisted: isWishlisted,
      // Only store override if user changed it from the source default
      override_name: overrideName !== sourceDefaults.name ? overrideName.trim() || null : null,
      override_series_name: overrideSeriesName !== sourceDefaults.series_name ? overrideSeriesName.trim() || null : null,
      override_edition: overrideEdition !== sourceDefaults.edition ? overrideEdition.trim() || null : null,
      override_origin: overrideOrigin !== sourceDefaults.origin ? overrideOrigin.trim() || null : null,
      override_original_price: overrideOriginalPrice !== sourceDefaults.original_price
        ? (overrideOriginalPrice ? parseFloat(overrideOriginalPrice) : null)
        : null,
    } as any);

    if (error) {
      Alert.alert('Error', 'Could not save changes. Please try again.');
      setIsSaving(false);
      return;
    }
    if (profile?.id) await fetchCollection(profile.id);
    setIsSaving(false);
  };

  const saveListing = async () => {
    if (!openToTrade && !openToSale) {
      Alert.alert('Required', 'Please select at least one listing type.');
      return;
    }
    if (openToSale && !askingPrice) {
      Alert.alert('Required', 'Please enter an asking price for sale listings.');
      return;
    }

    setSavingListing(true);
    const payload = {
      seller_id: profile?.id,
      collection_pin_id: pin?.id,
      open_to_trade: openToTrade,
      open_to_sale: openToSale,
      asking_price: openToSale && askingPrice ? parseFloat(askingPrice) : null,
      description: listingDescription.trim() || null,
      status: 'active',
      listing_type: openToTrade ? 'trade' : 'sale',
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };

    let error;
    if (hasListing && listingId) {
      ({ error } = await supabase.from('marketplace_listings').update(payload).eq('id', listingId));
    } else {
      const { error: insertError, data } = await supabase
        .from('marketplace_listings').insert(payload).select().single();
      error = insertError;
      if (data) setListingId(data.id);
    }

    if (error) {
      Alert.alert('Error', 'Could not save listing. Please try again.');
      setSavingListing(false);
      return;
    }
    setHasListing(true);
    setSavingListing(false);
  };

  const handleSaveAll = async () => {
    await saveChanges();
    await saveListing();
    Alert.alert('Saved', 'All changes have been saved.');
  };

  const handleRemoveFromCollection = () => {
    Alert.alert(
      'Remove pin',
      'Are you sure you want to remove this pin from your collection?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const result = await removeFromCollection(pin!.id);
            if ((result as any).blocked) {
              Alert.alert('Cannot remove pin', (result as any).error.message);
            } else if (result.error) {
              Alert.alert('Error', 'Could not remove pin. Please try again.');
            } else {
              if (profile?.id) await fetchCollection(profile.id);
              router.back();
            }
          },
        },
      ]
    );
  };

  const removeListing = () => {
    Alert.alert('Remove listing', 'Remove this pin from the Marketplace?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          if (!listingId) return;
          await supabase.from('marketplace_listings').update({ status: 'removed' }).eq('id', listingId);
          setHasListing(false);
          setListingId(null);
        },
      },
    ]);
  };

  const handleWishlistToggle = async (val: boolean) => {
    setIsWishlisted(val);
    if (!pin || !profile?.id) return;
    const refPinId = (pin as any).reference_pin_id;
    const comPinId = (pin as any).community_pin_id;
    if (val) {
      await supabase.from('user_wishlist').upsert({
        user_id: profile.id,
        reference_pin_id: refPinId || null,
        community_pin_id: comPinId || null,
      });
    } else {
      const col = refPinId ? 'reference_pin_id' : 'community_pin_id';
      const colVal = refPinId || comPinId;
      await supabase.from('user_wishlist').delete().eq('user_id', profile.id).eq(col, colVal);
    }
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

  if (!pin) return null;

  // isOwner is false when browsing from Marketplace (fromMarketplace=true)
  const isOwner = pin.user_id === profile?.id && fromMarketplace !== 'true';

  // ── Display values using coalesce pattern ────────────────
  // Override → reference_pin → community_pin → fallback
  const displayName = getDisplayValue(pin, 'name') || 'Unknown Pin';
  const displaySeries = getDisplayValue(pin, 'series_name');
  const displayEdition = getDisplayValue(pin, 'edition');
  const displayOrigin = getDisplayValue(pin, 'origin');
  const displayOriginalPrice = getDisplayValue(pin, 'original_price');
  const releaseDate = (pin.reference_pin as any)?.release_date || (pin.community_pin as any)?.release_date || null;
  const editionConfig = displayEdition ? EDITION_CONFIG[displayEdition] : null;
  const currentTradeStatus = TRADE_STATUS_OPTIONS.find(o => o.value === tradeStatus);

  // Check if any metadata has been overridden by the user
  const hasOverrides = !!(
    (pin as any).override_name ||
    (pin as any).override_series_name ||
    (pin as any).override_edition ||
    (pin as any).override_origin ||
    (pin as any).override_original_price
  );

  return (
    <LinearGradient colors={['#0f1d6e', '#0b1554', '#08103d']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>

        <View style={[styles.headerBar, { paddingTop: Theme.spacing.md + insets.top }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <AntDesign name="left" size={18} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{displayName}</Text>
          {isOwner ? (
            <TouchableOpacity style={styles.deleteButton} onPress={handleRemoveFromCollection}>
              <AntDesign name="delete" size={16} color={Colors.error} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 36 }} />
          )}
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Hero card — shows coalesced display values */}
          <View style={styles.heroCard}>
            <View style={styles.imageWrap}>
              {imageUrl ? (
                <Image source={{ uri: imageUrl }} style={styles.pinImage} resizeMode="cover" />
              ) : (
                <View style={styles.pinImagePlaceholder}>
                  <Text style={styles.pinImageEmoji}>📌</Text>
                </View>
              )}
              {editionConfig && (
                <View style={[styles.editionBadge, { backgroundColor: editionConfig.bg, borderColor: editionConfig.color }]}>
                  <Text style={[styles.editionBadgeText, { color: editionConfig.color }]}>{editionConfig.label}</Text>
                </View>
              )}
              {hasOverrides && isOwner && (
                <View style={styles.overrideBadge}>
                  <Text style={styles.overrideBadgeText}>Edited</Text>
                </View>
              )}
            </View>
            <View style={styles.heroInfo}>
              <Text style={styles.pinName}>{displayName}</Text>
              {displaySeries && <Text style={styles.pinSeries}>{displaySeries}</Text>}
              <View style={styles.metaRows}>
                {displayEdition && (
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Edition</Text>
                    <Text style={styles.metaValue}>{displayEdition}</Text>
                  </View>
                )}
                {displayOrigin && (
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Origin</Text>
                    <Text style={styles.metaValue}>{displayOrigin}</Text>
                  </View>
                )}
                {displayOriginalPrice && (
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Original price</Text>
                    <Text style={styles.metaValue}>${Number(displayOriginalPrice).toFixed(2)}</Text>
                  </View>
                )}
                {releaseDate && (
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Released</Text>
                    <Text style={styles.metaValue}>
                      {new Date(releaseDate).toLocaleDateString('en-CA', { year: 'numeric', month: 'short' })}
                    </Text>
                  </View>
                )}
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Added</Text>
                  <Text style={styles.metaValue}>
                    {new Date(pin.added_at).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {isOwner ? (
            // ── Owner: full edit view ──────────────────────────
            <>
              {/* Wishlist toggle */}
              <View style={styles.section}>
                <View style={styles.card}>
                  <View style={styles.toggleRow}>
                    <View style={styles.toggleInfo}>
                      <AntDesign name="heart" size={14} color={isWishlisted ? Colors.pink : Colors.textMuted} />
                      <View>
                        <Text style={styles.toggleLabel}>Wishlist</Text>
                        <Text style={styles.toggleSubtitle}>Get notified when this pin is listed</Text>
                      </View>
                    </View>
                    <Switch
                      value={isWishlisted}
                      onValueChange={setIsWishlisted}
                      trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(249,200,216,0.3)' }}
                      thumbColor={isWishlisted ? Colors.pink : 'rgba(255,255,255,0.4)'}
                    />
                  </View>
                </View>
              </View>

              {/* Pin information — editable overrides */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Pin information</Text>
                  {hasOverrides && (
                    <TouchableOpacity onPress={async () => {
                      // Reset all overrides to source defaults
                      const refPin = pin.reference_pin as any;
                      const comPin = pin.community_pin as any;
                      setOverrideName(refPin?.name ?? comPin?.name ?? '');
                      setOverrideSeriesName(refPin?.series_name ?? comPin?.series_name ?? '');
                      setOverrideEdition(refPin?.edition ?? comPin?.edition ?? '');
                      setOverrideOrigin(refPin?.origin ?? comPin?.origin ?? '');
                      setOverrideOriginalPrice((refPin?.original_price ?? comPin?.original_price)?.toString() ?? '');
                    }}>
                      <Text style={styles.resetLink}>Reset to defaults</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={styles.sectionHint}>These values come from our database. Edit if they don't match your pin.</Text>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Pin name</Text>
                  <TextInput
                    style={styles.input}
                    value={overrideName}
                    onChangeText={setOverrideName}
                    placeholder="Pin name"
                    placeholderTextColor={Colors.textPlaceholder}
                    autoCapitalize="words"
                  />
                </View>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Series name</Text>
                  <TextInput
                    style={styles.input}
                    value={overrideSeriesName}
                    onChangeText={setOverrideSeriesName}
                    placeholder="Series name"
                    placeholderTextColor={Colors.textPlaceholder}
                    autoCapitalize="words"
                  />
                </View>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Edition</Text>
                  <View style={styles.segmentRow}>
                    {['Limited Edition', 'Open Edition', 'Limited Release'].map(e => (
                      <TouchableOpacity
                        key={e}
                        style={[styles.segmentBtn, overrideEdition === e && styles.segmentBtnActive]}
                        onPress={() => setOverrideEdition(overrideEdition === e ? '' : e)}
                      >
                        <Text style={[styles.segmentBtnText, overrideEdition === e && styles.segmentBtnTextActive]}>
                          {e === 'Limited Edition' ? 'LE' : e === 'Open Edition' ? 'OE' : 'LR'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Origin</Text>
                  <TextInput
                    style={styles.input}
                    value={overrideOrigin}
                    onChangeText={setOverrideOrigin}
                    placeholder="e.g. Magic Kingdom"
                    placeholderTextColor={Colors.textPlaceholder}
                    autoCapitalize="words"
                  />
                </View>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Original retail price</Text>
                  <View style={styles.priceInput}>
                    <Text style={styles.priceDollar}>$</Text>
                    <TextInput
                      style={styles.priceField}
                      value={overrideOriginalPrice}
                      onChangeText={setOverrideOriginalPrice}
                      placeholder="0.00"
                      placeholderTextColor={Colors.textPlaceholder}
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>
              </View>

              {/* My details */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>My details</Text>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Condition</Text>
                  <View style={styles.segmentRow}>
                    {CONDITIONS.map(c => (
                      <TouchableOpacity
                        key={c}
                        style={[styles.segmentBtn, condition === c && styles.segmentBtnActive]}
                        onPress={() => setCondition(c)}
                      >
                        <Text style={[styles.segmentBtnText, condition === c && styles.segmentBtnTextActive]}>{c}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>My purchase price</Text>
                  <View style={styles.priceInput}>
                    <Text style={styles.priceDollar}>$</Text>
                    <TextInput
                      style={styles.priceField}
                      value={purchasePrice}
                      onChangeText={setPurchasePrice}
                      placeholder="0.00"
                      placeholderTextColor={Colors.textPlaceholder}
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Notes</Text>
                  <TextInput
                    style={[styles.input, styles.inputMultiline]}
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Any notes about this pin..."
                    placeholderTextColor={Colors.textPlaceholder}
                    multiline
                    numberOfLines={3}
                  />
                </View>
              </View>

              {/* Trade status */}
              <View style={styles.section}>
                <TouchableOpacity
                  style={styles.collapseHeader}
                  onPress={() => setTradeStatusExpanded(prev => !prev)}
                  activeOpacity={0.7}
                >
                  <View style={styles.collapseHeaderLeft}>
                    <AntDesign name="swap" size={14} color={Colors.textMuted} />
                    <Text style={styles.collapseHeaderText}>Modify Trade Status</Text>
                    <View style={[styles.currentStatusDot, { backgroundColor: currentTradeStatus?.color || Colors.textMuted }]} />
                    <Text style={[styles.currentStatusLabel, { color: currentTradeStatus?.color || Colors.textMuted }]}>
                      {currentTradeStatus?.label}
                    </Text>
                  </View>
                  <AntDesign name={tradeStatusExpanded ? 'up' : 'down'} size={13} color={Colors.textMuted} />
                </TouchableOpacity>
                {tradeStatusExpanded && (
                  <View style={styles.collapseBody}>
                    <Text style={styles.collapseWarning}>
                      ⚠️ Changing trade status affects how this pin appears in trades and the Marketplace.
                    </Text>
                    <View style={styles.tradeStatusList}>
                      {TRADE_STATUS_OPTIONS.map(option => (
                        <TouchableOpacity
                          key={option.value}
                          style={[styles.tradeStatusOption, tradeStatus === option.value && { borderColor: option.color, backgroundColor: `${option.color}18` }]}
                          onPress={() => setTradeStatus(option.value)}
                        >
                          <View style={[styles.tradeStatusRadio, tradeStatus === option.value && { borderColor: option.color, backgroundColor: option.color }]} />
                          <Text style={[styles.tradeStatusLabel, tradeStatus === option.value && { color: option.color }]}>{option.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </View>

              {/* Marketplace listing */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Marketplace listing</Text>
                  {hasListing && (
                    <View style={styles.listedBadge}>
                      <Text style={styles.listedBadgeText}>Listed</Text>
                    </View>
                  )}
                </View>
                <View style={styles.card}>
                  <View style={styles.toggleRow}>
                    <View style={styles.toggleInfo}>
                      <AntDesign name="swap" size={14} color={openToTrade ? Colors.success : Colors.textMuted} />
                      <Text style={styles.toggleLabel}>Open to trade</Text>
                    </View>
                    <Switch
                      value={openToTrade}
                      onValueChange={setOpenToTrade}
                      trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(93,202,122,0.3)' }}
                      thumbColor={openToTrade ? Colors.success : 'rgba(255,255,255,0.4)'}
                    />
                  </View>
                  <View style={styles.cardDivider} />
                  <View style={styles.toggleRow}>
                    <View style={styles.toggleInfo}>
                      <AntDesign name="shopping-cart" size={14} color={openToSale ? Colors.gold : Colors.textMuted} />
                      <Text style={styles.toggleLabel}>Open to sale</Text>
                    </View>
                    <Switch
                      value={openToSale}
                      onValueChange={setOpenToSale}
                      trackColor={{ false: 'rgba(255,255,255,0.1)', true: Colors.goldFaint }}
                      thumbColor={openToSale ? Colors.gold : 'rgba(255,255,255,0.4)'}
                    />
                  </View>
                  {openToSale && (
                    <View style={styles.listingField}>
                      <Text style={styles.fieldLabel}>Asking price *</Text>
                      <View style={styles.priceInput}>
                        <Text style={styles.priceDollar}>$</Text>
                        <TextInput
                          style={styles.priceField}
                          value={askingPrice}
                          onChangeText={setAskingPrice}
                          placeholder="0.00"
                          placeholderTextColor={Colors.textPlaceholder}
                          keyboardType="decimal-pad"
                        />
                      </View>
                    </View>
                  )}
                  <View style={styles.listingField}>
                    <Text style={styles.fieldLabel}>Listing description (optional)</Text>
                    <TextInput
                      style={[styles.input, styles.inputMultiline]}
                      value={listingDescription}
                      onChangeText={setListingDescription}
                      placeholder="Any details about condition, trades you're looking for..."
                      placeholderTextColor={Colors.textPlaceholder}
                      multiline
                      numberOfLines={3}
                    />
                  </View>
                </View>
                {hasListing && (
                  <TouchableOpacity style={styles.removeListingBtn} onPress={removeListing}>
                    <Text style={styles.removeListingBtnText}>Remove listing</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Save */}
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveAll} disabled={isSaving || savingListing}>
                {isSaving || savingListing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>Save all changes</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            // ── Non-owner: read-only + actions ────────────────
            <>
              <View style={styles.section}>
                <View style={styles.card}>
                  <View style={[styles.metaRow, { padding: Theme.spacing.md }]}>
                    <Text style={styles.metaLabel}>Condition</Text>
                    <Text style={styles.metaValue}>{pin.condition || 'Mint'}</Text>
                  </View>
                  {pin.notes ? (
                    <>
                      <View style={styles.cardDivider} />
                      <View style={{ padding: Theme.spacing.md }}>
                        <Text style={styles.metaLabel}>Owner's notes</Text>
                        <Text style={[styles.metaValue, { marginTop: 4 }]}>{pin.notes}</Text>
                      </View>
                    </>
                  ) : null}
                </View>
              </View>

              {/* Wishlist toggle for non-owners */}
              <View style={styles.section}>
                <View style={styles.card}>
                  <View style={styles.toggleRow}>
                    <View style={styles.toggleInfo}>
                      <AntDesign name="heart" size={14} color={isWishlisted ? Colors.pink : Colors.textMuted} />
                      <View>
                        <Text style={styles.toggleLabel}>Add to Wishlist</Text>
                        <Text style={styles.toggleSubtitle}>Get notified when this pin is available to trade</Text>
                      </View>
                    </View>
                    <Switch
                      value={isWishlisted}
                      onValueChange={handleWishlistToggle}
                      trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(249,200,216,0.3)' }}
                      thumbColor={isWishlisted ? Colors.pink : 'rgba(255,255,255,0.4)'}
                    />
                  </View>
                </View>
              </View>

              {/* Make trade offer */}
              <TouchableOpacity
                style={styles.tradeOfferBtn}
                onPress={() => router.push(`/trade/new?recipientId=${pin.user_id}&requestedPinId=${pin.id}` as any)}
              >
                <AntDesign name="swap" size={16} color="#fff" />
                <Text style={styles.tradeOfferBtnText}>Make trade offer</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Theme.screenPadding, paddingBottom: Theme.spacing.md, backgroundColor: 'rgba(15,29,110,0.95)', borderBottomWidth: 0.5, borderBottomColor: 'rgba(245,197,24,0.12)' },
  backButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: Theme.fontSize.lg, fontWeight: '500', color: Colors.textPrimary, textAlign: 'center', marginHorizontal: Theme.spacing.sm },
  deleteButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(192,24,42,0.1)', alignItems: 'center', justifyContent: 'center' },
  scrollView: { flex: 1 },
  scrollContent: { padding: Theme.screenPadding, paddingBottom: 60, gap: Theme.spacing.xl },
  heroCard: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 0.5, borderColor: Colors.goldBorder, borderRadius: Theme.radius.lg, overflow: 'hidden', flexDirection: 'row' },
  imageWrap: { width: 140, aspectRatio: 1, backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center', position: 'relative', flexShrink: 0 },
  pinImage: { width: '100%', height: '100%' },
  pinImagePlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  pinImageEmoji: { fontSize: 48 },
  editionBadge: { position: 'absolute', top: 6, left: 6, borderRadius: Theme.radius.pill, borderWidth: 0.5, paddingVertical: 2, paddingHorizontal: 6 },
  editionBadgeText: { fontSize: 8, fontWeight: '500' },
  overrideBadge: { position: 'absolute', bottom: 6, left: 6, borderRadius: Theme.radius.pill, backgroundColor: 'rgba(245,197,24,0.15)', borderWidth: 0.5, borderColor: Colors.goldBorder, paddingVertical: 2, paddingHorizontal: 6 },
  overrideBadgeText: { fontSize: 8, color: Colors.gold, fontWeight: '500' },
  heroInfo: { flex: 1, padding: Theme.spacing.md, gap: Theme.spacing.sm },
  pinName: { fontSize: Theme.fontSize.md, fontWeight: '500', color: Colors.textPrimary, lineHeight: 20 },
  pinSeries: { fontSize: Theme.fontSize.sm, color: Colors.gold, opacity: 0.75 },
  metaRows: { gap: 6 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metaLabel: { fontSize: Theme.fontSize.xs, color: Colors.textMuted },
  metaValue: { fontSize: Theme.fontSize.xs, color: Colors.textSecondary, fontWeight: '500' },
  section: { gap: Theme.spacing.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: Theme.fontSize.sm, fontWeight: '500', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  sectionHint: { fontSize: Theme.fontSize.xs, color: Colors.textMuted, lineHeight: 16 },
  resetLink: { fontSize: Theme.fontSize.xs, color: Colors.gold },
  listedBadge: { backgroundColor: Colors.successFaint, borderWidth: 0.5, borderColor: Colors.successBorder, borderRadius: Theme.radius.pill, paddingVertical: 2, paddingHorizontal: 8 },
  listedBadgeText: { fontSize: Theme.fontSize.xs, color: Colors.success, fontWeight: '500' },
  card: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 0.5, borderColor: 'rgba(245,197,24,0.15)', borderRadius: Theme.radius.md, overflow: 'hidden' },
  cardDivider: { height: 0.5, backgroundColor: 'rgba(245,197,24,0.1)', marginHorizontal: Theme.screenPadding },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Theme.screenPadding, gap: Theme.spacing.md },
  toggleInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Theme.spacing.sm },
  toggleLabel: { fontSize: Theme.fontSize.md, color: Colors.textPrimary },
  toggleSubtitle: { fontSize: Theme.fontSize.xs, color: Colors.textMuted },
  fieldGroup: { gap: Theme.spacing.xs },
  fieldLabel: { fontSize: Theme.fontSize.sm, color: Colors.textMuted, fontWeight: '500' },
  input: { backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 0.5, borderColor: 'rgba(245,197,24,0.2)', borderRadius: Theme.radius.sm, paddingHorizontal: Theme.spacing.md, paddingVertical: Theme.spacing.sm, color: Colors.textPrimary, fontSize: Theme.fontSize.md },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
  priceInput: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 0.5, borderColor: 'rgba(245,197,24,0.2)', borderRadius: Theme.radius.sm, paddingHorizontal: Theme.spacing.md },
  priceDollar: { fontSize: Theme.fontSize.md, color: Colors.textMuted, marginRight: 4 },
  priceField: { flex: 1, paddingVertical: Theme.spacing.sm, color: Colors.textPrimary, fontSize: Theme.fontSize.md },
  listingField: { padding: Theme.screenPadding, gap: Theme.spacing.xs },
  segmentRow: { flexDirection: 'row', gap: Theme.spacing.xs },
  segmentBtn: { flex: 1, paddingVertical: Theme.spacing.sm, borderRadius: Theme.radius.sm, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center' },
  segmentBtnActive: { backgroundColor: Colors.goldFaint, borderColor: Colors.goldBorder },
  segmentBtnText: { fontSize: Theme.fontSize.xs, color: Colors.textMuted },
  segmentBtnTextActive: { color: Colors.gold, fontWeight: '500' },
  collapseHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)', borderRadius: Theme.radius.md, padding: Theme.spacing.md },
  collapseHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: Theme.spacing.sm, flex: 1 },
  collapseHeaderText: { fontSize: Theme.fontSize.sm, color: Colors.textMuted, fontWeight: '500' },
  currentStatusDot: { width: 8, height: 8, borderRadius: 4 },
  currentStatusLabel: { fontSize: Theme.fontSize.xs },
  collapseBody: { gap: Theme.spacing.md, paddingTop: Theme.spacing.xs },
  collapseWarning: { fontSize: Theme.fontSize.xs, color: Colors.textMuted, lineHeight: 18, backgroundColor: 'rgba(245,197,24,0.06)', borderWidth: 0.5, borderColor: 'rgba(245,197,24,0.15)', borderRadius: Theme.radius.sm, padding: Theme.spacing.sm },
  tradeStatusList: { gap: Theme.spacing.sm },
  tradeStatusOption: { flexDirection: 'row', alignItems: 'center', gap: Theme.spacing.md, padding: Theme.spacing.md, borderRadius: Theme.radius.md, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.04)' },
  tradeStatusRadio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)' },
  tradeStatusLabel: { fontSize: Theme.fontSize.md, color: Colors.textMuted },
  saveBtn: { backgroundColor: Colors.crimson, borderRadius: Theme.radius.pill, paddingVertical: Theme.spacing.md, alignItems: 'center', borderWidth: 1, borderColor: Colors.goldBorder },
  saveBtnText: { fontSize: Theme.fontSize.md, fontWeight: '500', color: Colors.textPrimary },
  removeListingBtn: { paddingVertical: Theme.spacing.sm, alignItems: 'center' },
  removeListingBtnText: { fontSize: Theme.fontSize.sm, color: Colors.error },
  tradeOfferBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Theme.spacing.sm, backgroundColor: Colors.crimson, borderRadius: Theme.radius.pill, paddingVertical: Theme.spacing.md, borderWidth: 1, borderColor: Colors.goldBorder },
  tradeOfferBtnText: { fontSize: Theme.fontSize.md, fontWeight: '500', color: Colors.textPrimary },
  userAvatarImage: { width: '100%', height: '100%', borderRadius: 20 },
});