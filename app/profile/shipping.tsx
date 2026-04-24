// ============================================================
// PINCHANTED — Shipping Settings Screen
// app/profile/shipping.tsx
// ============================================================

import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { AntDesign } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/auth.store';
import { supabase, updateProfile } from '../../src/lib/supabase';
import { Colors } from '../../src/constants/colors';
import { Theme } from '../../src/constants/theme';
import { ShippingAddress, Country } from '../../src/types/database.types';

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

const emptyAddress = (): Partial<ShippingAddress> => ({
  label: '',
  street_address: '',
  street_address_2: '',
  city: '',
  province_state: '',
  postal_zip_code: '',
  country: 'CA',
  is_default: false,
  is_alternate: false,
});

type AddressFormState = Partial<ShippingAddress>;

export default function ShippingScreen() {
  const insets = useSafeAreaInsets();
  const { profile, refreshProfile } = useAuthStore();

  // Shipping preferences
  const [country, setCountry] = useState<Country>(profile?.country ?? 'CA');
  const [shipDomestically, setShipDomestically] = useState(
    profile?.ship_domestically ?? true
  );
  const [shipInternationally, setShipInternationally] = useState(
    profile?.ship_internationally ?? false
  );
  const [savingPrefs, setSavingPrefs] = useState(false);

  // Addresses
  const [addresses, setAddresses] = useState<ShippingAddress[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(true);

  // Address form
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AddressFormState>(emptyAddress());
  const [savingAddress, setSavingAddress] = useState(false);

  // Dropdown
  const [showProvinceDropdown, setShowProvinceDropdown] = useState(false);

  useEffect(() => {
    if (profile?.id) fetchAddresses();
  }, [profile?.id]);

  const fetchAddresses = async () => {
    if (!profile?.id) return;
    setLoadingAddresses(true);
    const { data } = await supabase
      .from('shipping_addresses')
      .select('*')
      .eq('user_id', profile.id)
      .order('is_default', { ascending: false });
    setAddresses((data as ShippingAddress[]) || []);
    setLoadingAddresses(false);
  };

  // ── Preferences ───────────────────────────────────────────

  const savePreferences = async () => {
    if (!profile?.id) return;
    setSavingPrefs(true);
    const { error } = await updateProfile(profile.id, {
      country,
      ship_domestically: shipDomestically,
      ship_internationally: shipInternationally,
    });
    if (error) {
      Alert.alert('Error', 'Could not save preferences. Please try again.');
    } else {
      await refreshProfile();
      Alert.alert('Saved', 'Your shipping preferences have been updated.');
    }
    setSavingPrefs(false);
  };

  // ── Address form ──────────────────────────────────────────

  const openNewForm = (isDefault: boolean) => {
    setEditingId(null);
    setForm({ ...emptyAddress(), is_default: isDefault, is_alternate: !isDefault, country });
    setShowForm(true);
  };

  const openEditForm = (address: ShippingAddress) => {
    setEditingId(address.id);
    setForm({ ...address });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyAddress());
  };

  const validateForm = (): string | null => {
    if (!form.street_address?.trim()) return 'Street address is required.';
    if (!form.city?.trim()) return 'City is required.';
    if (!form.province_state?.trim()) return 'Province/State is required.';
    if (!form.postal_zip_code?.trim()) return 'Postal/ZIP code is required.';
    return null;
  };

  const saveAddress = async () => {
    const validationError = validateForm();
    if (validationError) {
      Alert.alert('Missing info', validationError);
      return;
    }
    if (!profile?.id) return;
    setSavingAddress(true);

    const payload = {
      user_id: profile.id,
      label: form.label?.trim() || (form.is_default ? 'Default' : 'Alternate'),
      street_address: form.street_address!.trim(),
      street_address_2: form.street_address_2?.trim() || null,
      city: form.city!.trim(),
      province_state: form.province_state!.trim(),
      postal_zip_code: form.postal_zip_code!.trim(),
      country: form.country ?? country,
      is_default: form.is_default ?? false,
      is_alternate: form.is_alternate ?? false,
    };

    let error;
    if (editingId) {
      ({ error } = await supabase
        .from('shipping_addresses')
        .update(payload)
        .eq('id', editingId));
    } else {
      ({ error } = await supabase
        .from('shipping_addresses')
        .insert(payload));
    }

    if (error) {
      Alert.alert('Error', 'Could not save address. Please try again.');
    } else {
      await fetchAddresses();
      closeForm();
    }
    setSavingAddress(false);
  };

  const deleteAddress = (address: ShippingAddress) => {
    Alert.alert(
      'Delete address',
      'Are you sure you want to delete this address?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await supabase
              .from('shipping_addresses')
              .delete()
              .eq('id', address.id);
            await fetchAddresses();
          },
        },
      ]
    );
  };

  // ── Render helpers ────────────────────────────────────────

  const renderAddress = (address: ShippingAddress) => (
    <View key={address.id} style={styles.addressCard}>
      <View style={styles.addressHeader}>
        <View style={styles.addressLabelRow}>
          {address.is_default && (
            <View style={styles.addressBadge}>
              <Text style={styles.addressBadgeText}>Default</Text>
            </View>
          )}
          {address.is_alternate && (
            <View style={[styles.addressBadge, styles.addressBadgeAlt]}>
              <Text style={[styles.addressBadgeText, styles.addressBadgeAltText]}>
                Alternate
              </Text>
            </View>
          )}
          {address.label ? (
            <Text style={styles.addressLabel}>{address.label}</Text>
          ) : null}
        </View>
        <View style={styles.addressActions}>
          <TouchableOpacity
            style={styles.addressActionBtn}
            onPress={() => openEditForm(address)}
          >
            <AntDesign name="edit" size={14} color={Colors.gold} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addressActionBtn}
            onPress={() => deleteAddress(address)}
          >
            <AntDesign name="delete" size={14} color={Colors.error} />
          </TouchableOpacity>
        </View>
      </View>
      <Text style={styles.addressLine}>{address.street_address}</Text>
      {address.street_address_2 ? (
        <Text style={styles.addressLine}>{address.street_address_2}</Text>
      ) : null}
      <Text style={styles.addressLine}>
        {address.city}, {address.province_state}{'  '}{address.postal_zip_code}
      </Text>
      <Text style={styles.addressLine}>
        {address.country === 'US' ? '🇺🇸 United States' : '🇨🇦 Canada'}
      </Text>
    </View>
  );

  const formRegionList = (form.country === 'US' ? US_STATES : PROVINCES);

  const renderForm = () => (
    <View style={styles.formCard}>
      <Text style={styles.formTitle}>
        {editingId ? 'Edit address' : 'Add address'}
      </Text>

      {/* Label */}
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Label (optional)</Text>
        <TextInput
          style={styles.input}
          value={form.label ?? ''}
          onChangeText={v => setForm(f => ({ ...f, label: v }))}
          placeholder="e.g. Home, Work"
          placeholderTextColor={Colors.textPlaceholder}
        />
      </View>

      {/* Country */}
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Country</Text>
        <View style={styles.segmentRow}>
          {(['CA', 'US'] as Country[]).map(c => (
            <TouchableOpacity
              key={c}
              style={[
                styles.segmentBtn,
                form.country === c && styles.segmentBtnActive,
              ]}
              onPress={() => setForm(f => ({ ...f, country: c, province_state: '' }))}
            >
              <Text style={[
                styles.segmentBtnText,
                form.country === c && styles.segmentBtnTextActive,
              ]}>
                {c === 'CA' ? '🇨🇦 Canada' : '🇺🇸 United States'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Street address */}
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Street address *</Text>
        <TextInput
          style={styles.input}
          value={form.street_address ?? ''}
          onChangeText={v => setForm(f => ({ ...f, street_address: v }))}
          placeholder="123 Main St"
          placeholderTextColor={Colors.textPlaceholder}
          autoCapitalize="words"
        />
      </View>

      {/* Unit / apt */}
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Unit / Apt (optional)</Text>
        <TextInput
          style={styles.input}
          value={form.street_address_2 ?? ''}
          onChangeText={v => setForm(f => ({ ...f, street_address_2: v }))}
          placeholder="Apt 4B"
          placeholderTextColor={Colors.textPlaceholder}
          autoCapitalize="words"
        />
      </View>

      {/* City */}
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>City *</Text>
        <TextInput
          style={styles.input}
          value={form.city ?? ''}
          onChangeText={v => setForm(f => ({ ...f, city: v }))}
          placeholder="Toronto"
          placeholderTextColor={Colors.textPlaceholder}
          autoCapitalize="words"
        />
      </View>

      {/* Province / State dropdown */}
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>
          {form.country === 'US' ? 'State *' : 'Province *'}
        </Text>
        <TouchableOpacity
          style={styles.dropdown}
          onPress={() => setShowProvinceDropdown(true)}
        >
          <Text style={[
            styles.dropdownText,
            !form.province_state && styles.dropdownPlaceholder,
          ]}>
            {form.province_state || `Select ${form.country === 'US' ? 'state' : 'province'}...`}
          </Text>
          <AntDesign name="down" size={13} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Postal / ZIP */}
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>
          {form.country === 'US' ? 'ZIP code *' : 'Postal code *'}
        </Text>
        <TextInput
          style={styles.input}
          value={form.postal_zip_code ?? ''}
          onChangeText={v => setForm(f => ({ ...f, postal_zip_code: v }))}
          placeholder={form.country === 'US' ? '90210' : 'M5V 2T6'}
          placeholderTextColor={Colors.textPlaceholder}
          autoCapitalize="characters"
        />
      </View>

      {/* Form actions */}
      <View style={styles.formActions}>
        <TouchableOpacity style={styles.cancelBtn} onPress={closeForm}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.saveBtn}
          onPress={saveAddress}
          disabled={savingAddress}
        >
          {savingAddress ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>Save address</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  const defaultAddress = addresses.find(a => a.is_default);
  const alternateAddress = addresses.find(a => a.is_alternate);
  const otherAddresses = addresses.filter(a => !a.is_default && !a.is_alternate);

  return (
    <LinearGradient
      colors={['#0f1d6e', '#0b1554', '#08103d']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>

        {/* Header */}
        <View style={[styles.headerBar, { paddingTop: Theme.spacing.md + insets.top }]}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <AntDesign name="left" size={18} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Shipping Settings</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* Preferences */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Preferences</Text>
            <View style={styles.card}>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Your country</Text>
                <View style={styles.segmentRow}>
                  {(['CA', 'US'] as Country[]).map(c => (
                    <TouchableOpacity
                      key={c}
                      style={[
                        styles.segmentBtn,
                        country === c && styles.segmentBtnActive,
                      ]}
                      onPress={() => setCountry(c)}
                    >
                      <Text style={[
                        styles.segmentBtnText,
                        country === c && styles.segmentBtnTextActive,
                      ]}>
                        {c === 'CA' ? '🇨🇦 Canada' : '🇺🇸 United States'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.toggleRow}>
                <View style={styles.toggleInfo}>
                  <Text style={styles.toggleLabel}>Ship domestically</Text>
                  <Text style={styles.toggleSubtitle}>
                    Trade with collectors in your country
                  </Text>
                </View>
                <Switch
                  value={shipDomestically}
                  onValueChange={setShipDomestically}
                  trackColor={{ false: 'rgba(255,255,255,0.1)', true: Colors.goldFaint }}
                  thumbColor={shipDomestically ? Colors.gold : 'rgba(255,255,255,0.4)'}
                />
              </View>

              <View style={styles.divider} />

              <View style={styles.toggleRow}>
                <View style={styles.toggleInfo}>
                  <Text style={styles.toggleLabel}>Ship internationally</Text>
                  <Text style={styles.toggleSubtitle}>
                    Trade with collectors worldwide
                  </Text>
                </View>
                <Switch
                  value={shipInternationally}
                  onValueChange={setShipInternationally}
                  trackColor={{ false: 'rgba(255,255,255,0.1)', true: Colors.goldFaint }}
                  thumbColor={shipInternationally ? Colors.gold : 'rgba(255,255,255,0.4)'}
                />
              </View>
            </View>

            <TouchableOpacity
              style={styles.savePrefBtn}
              onPress={savePreferences}
              disabled={savingPrefs}
            >
              {savingPrefs ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.savePrefBtnText}>Save preferences</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Addresses */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Shipping addresses</Text>
            <Text style={styles.sectionSubtitle}>
              Your default address is used for trades. Add an alternate for flexibility.
            </Text>

            {loadingAddresses ? (
              <ActivityIndicator size="small" color={Colors.gold} style={{ marginTop: Theme.spacing.md }} />
            ) : (
              <>
                {defaultAddress
                  ? renderAddress(defaultAddress)
                  : !showForm && (
                    <TouchableOpacity
                      style={styles.addAddressBtn}
                      onPress={() => openNewForm(true)}
                    >
                      <AntDesign name="plus" size={16} color={Colors.gold} />
                      <Text style={styles.addAddressBtnText}>Add default address</Text>
                    </TouchableOpacity>
                  )}

                {alternateAddress
                  ? renderAddress(alternateAddress)
                  : defaultAddress && !showForm && (
                    <TouchableOpacity
                      style={[styles.addAddressBtn, styles.addAddressBtnAlt]}
                      onPress={() => openNewForm(false)}
                    >
                      <AntDesign name="plus" size={16} color={Colors.textMuted} />
                      <Text style={[styles.addAddressBtnText, { color: Colors.textMuted }]}>
                        Add alternate address
                      </Text>
                    </TouchableOpacity>
                  )}

                {otherAddresses.map(renderAddress)}
                {showForm && renderForm()}
              </>
            )}
          </View>

          {/* Note */}
          <View style={styles.noteCard}>
            <AntDesign name="info-circle" size={13} color={Colors.textMuted} />
            <Text style={styles.noteText}>
              Your shipping address is only shared with other collectors once a trade is confirmed. It is never publicly visible.
            </Text>
          </View>

        </ScrollView>
      </SafeAreaView>

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
                Select {form.country === 'US' ? 'State' : 'Province'}
              </Text>
              <TouchableOpacity onPress={() => setShowProvinceDropdown(false)}>
                <AntDesign name="close" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={formRegionList}
              keyExtractor={item => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.modalItem,
                    form.province_state === item && styles.modalItemSelected,
                  ]}
                  onPress={() => {
                    setForm(f => ({ ...f, province_state: item }));
                    setShowProvinceDropdown(false);
                  }}
                >
                  <Text style={[
                    styles.modalItemText,
                    form.province_state === item && styles.modalItemTextSelected,
                  ]}>
                    {item}
                  </Text>
                  {form.province_state === item && (
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
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: Theme.fontSize.lg,
    fontWeight: '500',
    color: Colors.textPrimary,
  },

  scrollView: { flex: 1 },
  scrollContent: {
    padding: Theme.screenPadding,
    paddingBottom: 60,
    gap: Theme.spacing.xl,
  },

  section: { gap: Theme.spacing.md },
  sectionTitle: {
    fontSize: Theme.fontSize.sm,
    fontWeight: '500',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionSubtitle: {
    fontSize: Theme.fontSize.sm,
    color: Colors.textMuted,
    lineHeight: 18,
    marginTop: -Theme.spacing.xs,
  },

  card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.5,
    borderColor: 'rgba(245,197,24,0.15)',
    borderRadius: Theme.radius.md,
    overflow: 'hidden',
  },
  divider: {
    height: 0.5,
    backgroundColor: 'rgba(245,197,24,0.1)',
    marginHorizontal: Theme.screenPadding,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Theme.screenPadding,
    gap: Theme.spacing.md,
  },
  toggleInfo: { flex: 1, gap: 3 },
  toggleLabel: {
    fontSize: Theme.fontSize.md,
    color: Colors.textPrimary,
  },
  toggleSubtitle: {
    fontSize: Theme.fontSize.sm,
    color: Colors.textMuted,
  },

  fieldGroup: {
    gap: Theme.spacing.xs,
    padding: Theme.screenPadding,
  },
  fieldLabel: {
    fontSize: Theme.fontSize.sm,
    color: Colors.textMuted,
    fontWeight: '500',
  },

  segmentRow: {
    flexDirection: 'row',
    gap: Theme.spacing.xs,
  },
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
  segmentBtnText: {
    fontSize: Theme.fontSize.sm,
    color: Colors.textMuted,
  },
  segmentBtnTextActive: {
    color: Colors.gold,
    fontWeight: '500',
  },

  savePrefBtn: {
    backgroundColor: Colors.crimson,
    borderRadius: Theme.radius.pill,
    paddingVertical: Theme.spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.goldBorder,
  },
  savePrefBtnText: {
    fontSize: Theme.fontSize.md,
    fontWeight: '500',
    color: Colors.textPrimary,
  },

  addressCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.5,
    borderColor: 'rgba(245,197,24,0.15)',
    borderRadius: Theme.radius.md,
    padding: Theme.screenPadding,
    gap: Theme.spacing.xs,
  },
  addressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.xs,
  },
  addressLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.xs,
    flex: 1,
  },
  addressBadge: {
    backgroundColor: Colors.goldFaint,
    borderWidth: 0.5,
    borderColor: Colors.goldBorder,
    borderRadius: Theme.radius.pill,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  addressBadgeText: {
    fontSize: Theme.fontSize.xs,
    color: Colors.gold,
    fontWeight: '500',
  },
  addressBadgeAlt: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.15)',
  },
  addressBadgeAltText: { color: Colors.textMuted },
  addressLabel: {
    fontSize: Theme.fontSize.sm,
    color: Colors.textSecondary,
  },
  addressActions: {
    flexDirection: 'row',
    gap: Theme.spacing.sm,
  },
  addressActionBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressLine: {
    fontSize: Theme.fontSize.sm,
    color: Colors.textPrimary,
    lineHeight: 20,
  },

  addAddressBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.sm,
    borderWidth: 0.5,
    borderColor: Colors.goldBorder,
    borderRadius: Theme.radius.md,
    borderStyle: 'dashed',
    padding: Theme.spacing.lg,
    backgroundColor: Colors.goldFaint,
  },
  addAddressBtnAlt: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: 'rgba(255,255,255,0.15)',
  },
  addAddressBtnText: {
    fontSize: Theme.fontSize.md,
    color: Colors.gold,
    fontWeight: '500',
  },

  formCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.5,
    borderColor: 'rgba(245,197,24,0.2)',
    borderRadius: Theme.radius.md,
    padding: Theme.screenPadding,
    gap: Theme.spacing.md,
  },
  formTitle: {
    fontSize: Theme.fontSize.lg,
    fontWeight: '500',
    color: Colors.textPrimary,
    marginBottom: Theme.spacing.xs,
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
  dropdownText: {
    fontSize: Theme.fontSize.md,
    color: Colors.textPrimary,
  },
  dropdownPlaceholder: {
    color: Colors.textPlaceholder,
  },

  formActions: {
    flexDirection: 'row',
    gap: Theme.spacing.md,
    marginTop: Theme.spacing.sm,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: Theme.spacing.md,
    borderRadius: Theme.radius.pill,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: Theme.fontSize.md,
    color: Colors.textMuted,
  },
  saveBtn: {
    flex: 2,
    paddingVertical: Theme.spacing.md,
    borderRadius: Theme.radius.pill,
    backgroundColor: Colors.crimson,
    borderWidth: 1,
    borderColor: Colors.goldBorder,
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: Theme.fontSize.md,
    fontWeight: '500',
    color: Colors.textPrimary,
  },

  noteCard: {
    flexDirection: 'row',
    gap: Theme.spacing.sm,
    padding: Theme.spacing.md,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: Theme.radius.md,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'flex-start',
  },
  noteText: {
    flex: 1,
    fontSize: Theme.fontSize.sm,
    color: Colors.textMuted,
    lineHeight: 18,
  },

  // Modal dropdown
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
  modalItemSelected: {
    backgroundColor: Colors.goldFaint,
  },
  modalItemText: {
    fontSize: Theme.fontSize.md,
    color: Colors.textPrimary,
  },
  modalItemTextSelected: {
    color: Colors.gold,
    fontWeight: '500',
  },
});