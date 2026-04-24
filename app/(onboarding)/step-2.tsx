// ============================================================
// PINCHANTED — Onboarding Step 2
// app/(onboarding)/step-2.tsx
// ============================================================

import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { AntDesign } from '@expo/vector-icons';
import { updateProfile, supabase } from '../../src/lib/supabase';
import { useAuthStore } from '../../src/stores/auth.store';
import { getCurrentUserId, setCurrentSession } from '../../src/lib/auth';
import { Colors } from '../../src/constants/colors';
import { Theme } from '../../src/constants/theme';
import { CollectingStyle, Country } from '../../src/types/database.types';

const STYLE_OPTIONS: {
  value: CollectingStyle;
  emoji: string;
  label: string;
  description: string;
}[] = [
  {
    value: 'collector',
    emoji: '📌',
    label: 'Collector',
    description: 'I love finding and keeping pins',
  },
  {
    value: 'trader',
    emoji: '🔄',
    label: 'Trader',
    description: 'I love the thrill of trading',
  },
  {
    value: 'buyer',
    emoji: '🛒',
    label: 'Buyer',
    description: 'I prefer buying pins I want',
  },
];

const PROVINCES = [
  'AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU',
  'ON', 'PE', 'QC', 'SK', 'YT',
];

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
  'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
];

const requiresShipping = (styles: CollectingStyle[]) =>
  styles.includes('trader') || styles.includes('buyer');

export default function OnboardingStep2() {
  const insets = useSafeAreaInsets();
  const { profile, refreshProfile } = useAuthStore();
  const [selectedStyles, setSelectedStyles] = useState<CollectingStyle[]>(
    (profile?.collecting_style as CollectingStyle[]) || []
  );
  const [isLoading, setIsLoading] = useState(false);

  // Shipping fields
  const [country, setCountry] = useState<Country>('CA');
  const [streetAddress, setStreetAddress] = useState('');
  const [streetAddress2, setStreetAddress2] = useState('');
  const [city, setCity] = useState('');
  const [provinceState, setProvinceState] = useState('');
  const [postalZip, setPostalZip] = useState('');
  const [showProvinceDropdown, setShowProvinceDropdown] = useState(false);

  const toggleStyle = (style: CollectingStyle) => {
    setSelectedStyles(prev =>
      prev.includes(style)
        ? prev.filter(s => s !== style)
        : [...prev, style]
    );
    if (style === 'trader' || style === 'buyer') {
      setProvinceState('');
    }
  };

  const getUserId = async (): Promise<string | null> => {
    let userId = getCurrentUserId() || profile?.id;
    if (!userId) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setCurrentSession(session);
        userId = session.user.id;
      }
    }
    return userId || null;
  };

  const handleNext = async () => {
    if (selectedStyles.length === 0) {
      Alert.alert('Almost there!', 'Please select at least one collecting style.');
      return;
    }

    if (requiresShipping(selectedStyles)) {
      if (!streetAddress.trim()) { Alert.alert('Required', 'Please enter your street address.'); return; }
      if (!city.trim()) { Alert.alert('Required', 'Please enter your city.'); return; }
      if (!provinceState) { Alert.alert('Required', `Please select your ${country === 'US' ? 'state' : 'province'}.`); return; }
      if (!postalZip.trim()) { Alert.alert('Required', `Please enter your ${country === 'US' ? 'ZIP code' : 'postal code'}.`); return; }
    }

    setIsLoading(true);

    const userId = await getUserId();
    if (!userId) {
      Alert.alert('Error', 'Could not find user. Please sign in again.');
      setIsLoading(false);
      return;
    }

    const { error: profileError } = await updateProfile(userId, {
      collecting_style: selectedStyles,
      ...(requiresShipping(selectedStyles) && {
        country,
        ship_domestically: true,
        ship_internationally: false,
      }),
    });

    if (profileError) {
      Alert.alert('Error', 'Could not save your details. Please try again.');
      setIsLoading(false);
      return;
    }

    if (requiresShipping(selectedStyles)) {
      await supabase
        .from('shipping_addresses')
        .delete()
        .eq('user_id', userId)
        .eq('is_default', true);

      const { error: addrError } = await supabase
        .from('shipping_addresses')
        .insert({
          user_id: userId,
          label: 'Default',
          street_address: streetAddress.trim(),
          street_address_2: streetAddress2.trim() || null,
          city: city.trim(),
          province_state: provinceState,
          postal_zip_code: postalZip.trim(),
          country,
          is_default: true,
          is_alternate: false,
        });

      if (addrError) {
        Alert.alert('Error', 'Could not save your address. Please try again.');
        setIsLoading(false);
        return;
      }
    }

    await refreshProfile();
    setIsLoading(false);
    router.push('/(onboarding)/step-3');
  };

  const regionList = country === 'US' ? US_STATES : PROVINCES;
  const needsShipping = requiresShipping(selectedStyles);

  return (
    <LinearGradient
      colors={['#0f1d6e', '#0b1554', '#08103d']}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: 60 + insets.top }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Progress bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: '66%' }]} />
          </View>
          <Text style={styles.progressText}>Step 2 of 3</Text>
        </View>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.emoji}>🎨</Text>
          <Text style={styles.title}>How do you collect?</Text>
          <Text style={styles.subtitle}>
            Tell us about your collecting style
          </Text>
        </View>

        {/* Collecting style */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Select all that apply</Text>
          <View style={styles.styleList}>
            {STYLE_OPTIONS.map((option) => {
              const isSelected = selectedStyles.includes(option.value);
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.styleCard,
                    isSelected && styles.styleCardSelected,
                  ]}
                  onPress={() => toggleStyle(option.value)}
                >
                  <Text style={styles.styleEmoji}>{option.emoji}</Text>
                  <View style={styles.styleText}>
                    <Text style={[
                      styles.styleLabel,
                      isSelected && styles.styleLabelSelected,
                    ]}>
                      {option.label}
                    </Text>
                    <Text style={styles.styleDescription}>
                      {option.description}
                    </Text>
                  </View>
                  <View style={[
                    styles.styleCheckbox,
                    isSelected && styles.styleCheckboxSelected,
                  ]}>
                    {isSelected && (
                      <AntDesign name="check" size={12} color="#fff" />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Shipping address — shown for trader/buyer */}
        {needsShipping && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>📦 Your shipping address</Text>
            <Text style={styles.sectionHint}>
              Required for trading and buying. Only shared with other collectors once a trade is confirmed.
            </Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Country</Text>
              <View style={styles.segmentRow}>
                {(['CA', 'US'] as Country[]).map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.segmentBtn, country === c && styles.segmentBtnActive]}
                    onPress={() => { setCountry(c); setProvinceState(''); }}
                  >
                    <Text style={[styles.segmentBtnText, country === c && styles.segmentBtnTextActive]}>
                      {c === 'CA' ? '🇨🇦 Canada' : '🇺🇸 United States'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Street address *</Text>
              <TextInput
                style={styles.input}
                value={streetAddress}
                onChangeText={setStreetAddress}
                placeholder="123 Main St"
                placeholderTextColor={Colors.textPlaceholder}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Unit / Apt (optional)</Text>
              <TextInput
                style={styles.input}
                value={streetAddress2}
                onChangeText={setStreetAddress2}
                placeholder="Apt 4B"
                placeholderTextColor={Colors.textPlaceholder}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>City *</Text>
              <TextInput
                style={styles.input}
                value={city}
                onChangeText={setCity}
                placeholder="Toronto"
                placeholderTextColor={Colors.textPlaceholder}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                {country === 'US' ? 'State *' : 'Province *'}
              </Text>
              <TouchableOpacity
                style={styles.dropdown}
                onPress={() => setShowProvinceDropdown(true)}
              >
                <Text style={[styles.dropdownText, !provinceState && styles.dropdownPlaceholder]}>
                  {provinceState || `Select ${country === 'US' ? 'state' : 'province'}...`}
                </Text>
                <AntDesign name="down" size={13} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                {country === 'US' ? 'ZIP code *' : 'Postal code *'}
              </Text>
              <TextInput
                style={styles.input}
                value={postalZip}
                onChangeText={setPostalZip}
                placeholder={country === 'US' ? '90210' : 'M5V 2T6'}
                placeholderTextColor={Colors.textPlaceholder}
                autoCapitalize="characters"
              />
            </View>
          </View>
        )}

        {/* Navigation buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <AntDesign name="left" size={14} color={Colors.textMuted} />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.nextButton}
            onPress={handleNext}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={styles.nextButtonInner}>
                <Text style={styles.nextButtonText}>Next</Text>
                <AntDesign name="right" size={14} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.skipHint}>
          You can update these details later in your profile
        </Text>

      </ScrollView>

      {/* Province/State dropdown modal */}
      <Modal
        visible={showProvinceDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setShowProvinceDropdown(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowProvinceDropdown(false)}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Select {country === 'US' ? 'State' : 'Province'}
              </Text>
              <TouchableOpacity onPress={() => setShowProvinceDropdown(false)}>
                <AntDesign name="close" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={regionList}
              keyExtractor={item => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.modalItem, provinceState === item && styles.modalItemSelected]}
                  onPress={() => { setProvinceState(item); setShowProvinceDropdown(false); }}
                >
                  <Text style={[styles.modalItemText, provinceState === item && styles.modalItemTextSelected]}>
                    {item}
                  </Text>
                  {provinceState === item && (
                    <AntDesign name="check" size={14} color={Colors.gold} />
                  )}
                </TouchableOpacity>
              )}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    padding: Theme.screenPadding,
    gap: Theme.spacing.xl,
  },
  progressContainer: { gap: Theme.spacing.xs },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.gold,
    borderRadius: 2,
  },
  progressText: {
    fontSize: Theme.fontSize.xs,
    color: Colors.textMuted,
    textAlign: 'right',
  },
  header: { alignItems: 'center', gap: Theme.spacing.sm },
  emoji: { fontSize: 48 },
  title: {
    fontSize: Theme.fontSize.xxl,
    fontWeight: '500',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: Theme.fontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 0.5,
    borderColor: Colors.goldBorder,
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.lg,
    gap: Theme.spacing.md,
  },
  sectionTitle: {
    fontSize: Theme.fontSize.md,
    fontWeight: '500',
    color: Colors.gold,
  },
  sectionHint: {
    fontSize: Theme.fontSize.xs,
    color: Colors.textMuted,
    marginTop: -Theme.spacing.xs,
    lineHeight: 18,
  },
  styleList: { gap: Theme.spacing.sm },
  styleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: Theme.radius.md,
    padding: Theme.spacing.md,
    gap: Theme.spacing.md,
  },
  styleCardSelected: {
    backgroundColor: 'rgba(245,197,24,0.08)',
    borderColor: 'rgba(245,197,24,0.35)',
  },
  styleEmoji: { fontSize: 24, flexShrink: 0 },
  styleText: { flex: 1, gap: 2 },
  styleLabel: {
    fontSize: Theme.fontSize.md,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  styleLabelSelected: { color: Colors.textPrimary },
  styleDescription: {
    fontSize: Theme.fontSize.xs,
    color: Colors.textMuted,
  },
  styleCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  styleCheckboxSelected: {
    backgroundColor: Colors.crimson,
    borderColor: Colors.crimson,
  },
  fieldGroup: { gap: Theme.spacing.xs },
  fieldLabel: {
    fontSize: Theme.fontSize.sm,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 0.5,
    borderColor: 'rgba(245,197,24,0.2)',
    borderRadius: Theme.radius.sm,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    color: Colors.textPrimary,
    fontSize: Theme.fontSize.md,
  },
  segmentRow: { flexDirection: 'row', gap: Theme.spacing.xs },
  segmentBtn: {
    flex: 1,
    paddingVertical: Theme.spacing.sm,
    borderRadius: Theme.radius.sm,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
  },
  segmentBtnActive: {
    backgroundColor: Colors.goldFaint,
    borderColor: Colors.goldBorder,
  },
  segmentBtnText: { fontSize: Theme.fontSize.sm, color: Colors.textMuted },
  segmentBtnTextActive: { color: Colors.gold, fontWeight: '500' },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 0.5,
    borderColor: 'rgba(245,197,24,0.2)',
    borderRadius: Theme.radius.sm,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
  },
  dropdownText: { fontSize: Theme.fontSize.md, color: Colors.textPrimary },
  dropdownPlaceholder: { color: Colors.textPlaceholder },
  buttonRow: { flexDirection: 'row', gap: Theme.spacing.md },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: Theme.radius.pill,
    paddingVertical: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.lg,
  },
  backButtonText: { color: Colors.textMuted, fontSize: Theme.fontSize.md },
  nextButton: {
    flex: 1,
    backgroundColor: Colors.crimson,
    borderRadius: Theme.radius.pill,
    padding: Theme.spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.goldBorder,
  },
  nextButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  nextButtonText: {
    color: Colors.textPrimary,
    fontSize: Theme.fontSize.md,
    fontWeight: '500',
  },
  skipHint: {
    fontSize: Theme.fontSize.xs,
    color: Colors.textFaint,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#0f1d6e',
    borderTopLeftRadius: Theme.radius.xl,
    borderTopRightRadius: Theme.radius.xl,
    borderWidth: 0.5,
    borderColor: Colors.goldBorder,
    maxHeight: '60%',
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Theme.screenPadding,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(245,197,24,0.12)',
  },
  modalTitle: {
    fontSize: Theme.fontSize.md,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Theme.spacing.md,
    paddingHorizontal: Theme.screenPadding,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  modalItemSelected: { backgroundColor: Colors.goldFaint },
  modalItemText: { fontSize: Theme.fontSize.md, color: Colors.textPrimary },
  modalItemTextSelected: { color: Colors.gold, fontWeight: '500' },
});