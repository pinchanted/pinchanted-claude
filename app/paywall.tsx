// ============================================================
// PINCHANTED — Paywall Screen
// app/paywall.tsx
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
  Platform,
  Linking,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { AntDesign } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Purchases, { PurchasesPackage } from 'react-native-purchases';
import { useAuthStore } from '../src/stores/auth.store';
import { Colors } from '../src/constants/colors';
import { Theme } from '../src/constants/theme';

const REVENUECAT_IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY || '';
const REVENUECAT_ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY || '';

const FEATURES = [
  { icon: '📌', label: 'Unlimited pin collection' },
  { icon: '🤖', label: 'AI pin identification' },
  { icon: '🔄', label: 'Trade with other collectors' },
  { icon: '🛒', label: 'Marketplace access' },
  { icon: '💖', label: 'Wishlist & notifications' },
  { icon: '📦', label: 'Shipping management' },
];

export default function PaywallScreen() {
  const insets = useSafeAreaInsets();
  const { profile, setHasActiveSubscription } = useAuthStore();

  const [isLoading, setIsLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<PurchasesPackage | null>(null);
  const [monthlyPackage, setMonthlyPackage] = useState<PurchasesPackage | null>(null);
  const [annualPackage, setAnnualPackage] = useState<PurchasesPackage | null>(null);

  useEffect(() => {
    initRevenueCat();
  }, []);

  const initRevenueCat = async () => {
    try {
      const apiKey = Platform.OS === 'ios'
        ? REVENUECAT_IOS_KEY
        : REVENUECAT_ANDROID_KEY;

      Purchases.configure({ apiKey });

      // Identify user with Supabase user ID for cross-platform tracking
      if (profile?.id) {
        await Purchases.logIn(profile.id);
      }

      // Fetch offerings
      const offerings = await Purchases.getOfferings();
      if (offerings.current) {
        const pkgs = offerings.current.availablePackages;
        setPackages(pkgs);

        // Find monthly and annual packages
        const monthly = pkgs.find(p =>
          p.packageType === 'MONTHLY' ||
          p.identifier.toLowerCase().includes('monthly')
        ) || null;
        const annual = pkgs.find(p =>
          p.packageType === 'ANNUAL' ||
          p.identifier.toLowerCase().includes('annual') ||
          p.identifier.toLowerCase().includes('yearly')
        ) || null;

        setMonthlyPackage(monthly);
        setAnnualPackage(annual);
        // Default to annual selected
        setSelectedPackage(annual || monthly);
      }
    } catch (error) {
      console.error('RevenueCat init error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePurchase = async () => {
    if (!selectedPackage) return;

    setIsPurchasing(true);
    try {
      const { customerInfo } = await Purchases.purchasePackage(selectedPackage);

      if (customerInfo.entitlements.active['premium']) {
        setHasActiveSubscription(true);
        Alert.alert(
          'Welcome to Pinchanted! 🎉',
          'Your subscription is now active. Enjoy full access to all features!',
          [{ text: 'Let\'s go!', onPress: () => router.replace('/(tabs)') }]
        );
      }
    } catch (error: any) {
      if (!error.userCancelled) {
        Alert.alert('Purchase failed', error.message || 'Could not complete purchase. Please try again.');
      }
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setIsRestoring(true);
    try {
      const customerInfo = await Purchases.restorePurchases();
      if (customerInfo.entitlements.active['premium']) {
        setHasActiveSubscription(true);
        Alert.alert(
          'Purchase restored! ✅',
          'Your subscription has been restored successfully.',
          [{ text: 'Continue', onPress: () => router.replace('/(tabs)') }]
        );
      } else {
        Alert.alert(
          'No subscription found',
          'We couldn\'t find an active subscription for this account.'
        );
      }
    } catch (error: any) {
      Alert.alert('Restore failed', error.message || 'Could not restore purchases. Please try again.');
    } finally {
      setIsRestoring(false);
    }
  };

  const getSavingsPercent = (): number | null => {
    if (!monthlyPackage || !annualPackage) return null;
    const monthlyAnnualCost = monthlyPackage.product.price * 12;
    const annualCost = annualPackage.product.price;
    const savings = Math.round(((monthlyAnnualCost - annualCost) / monthlyAnnualCost) * 100);
    return savings > 0 ? savings : null;
  };

  const savingsPercent = getSavingsPercent();

  return (
    <LinearGradient
      colors={['#0f1d6e', '#0b1554', '#08103d']}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 56 },
        ]}
        showsVerticalScrollIndicator={false}
      >

        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.logoCircle}>
            <View style={styles.logoInner}>
              <View style={styles.logoDot} />
            </View>
          </View>
          <Text style={styles.heroTitle}>Pinchanted</Text>
          <Text style={styles.heroSubtitle}>
            The magical home for Disney pin collectors
          </Text>
        </View>

        {/* Features */}
        <View style={styles.featuresCard}>
          <Text style={styles.featuresTitle}>Everything included</Text>
          <View style={styles.featuresList}>
            {FEATURES.map((feature, i) => (
              <View key={i} style={styles.featureRow}>
                <Text style={styles.featureIcon}>{feature.icon}</Text>
                <Text style={styles.featureLabel}>{feature.label}</Text>
                <AntDesign name="check" size={14} color={Colors.success} />
              </View>
            ))}
          </View>
        </View>

        {/* Pricing */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.gold} />
            <Text style={styles.loadingText}>Loading pricing...</Text>
          </View>
        ) : packages.length === 0 ? (
          <View style={styles.noPricingCard}>
            <Text style={styles.noPricingText}>
              Pricing unavailable. Please check your connection and try again.
            </Text>
          </View>
        ) : (
          <View style={styles.pricingSection}>
            <Text style={styles.pricingTitle}>Choose your plan</Text>

            {/* Annual option */}
            {annualPackage && (
              <TouchableOpacity
                style={[
                  styles.pricingCard,
                  selectedPackage?.identifier === annualPackage.identifier &&
                    styles.pricingCardSelected,
                ]}
                onPress={() => setSelectedPackage(annualPackage)}
                activeOpacity={0.7}
              >
                <View style={styles.pricingCardLeft}>
                  <View style={[
                    styles.radioBtn,
                    selectedPackage?.identifier === annualPackage.identifier &&
                      styles.radioBtnSelected,
                  ]}>
                    {selectedPackage?.identifier === annualPackage.identifier && (
                      <View style={styles.radioDot} />
                    )}
                  </View>
                  <View style={styles.pricingInfo}>
                    <Text style={styles.pricingLabel}>Annual</Text>
                    <Text style={styles.pricingPer}>
                      {annualPackage.product.currencyCode}{' '}
                      {(annualPackage.product.price / 12).toFixed(2)}/month
                    </Text>
                  </View>
                </View>
                <View style={styles.pricingRight}>
                  {savingsPercent && (
                    <View style={styles.savingsBadge}>
                      <Text style={styles.savingsBadgeText}>
                        Save {savingsPercent}%
                      </Text>
                    </View>
                  )}
                  <Text style={styles.pricingPrice}>
                    {annualPackage.product.priceString}
                  </Text>
                  <Text style={styles.pricingPeriod}>per year</Text>
                </View>
              </TouchableOpacity>
            )}

            {/* Monthly option */}
            {monthlyPackage && (
              <TouchableOpacity
                style={[
                  styles.pricingCard,
                  selectedPackage?.identifier === monthlyPackage.identifier &&
                    styles.pricingCardSelected,
                ]}
                onPress={() => setSelectedPackage(monthlyPackage)}
                activeOpacity={0.7}
              >
                <View style={styles.pricingCardLeft}>
                  <View style={[
                    styles.radioBtn,
                    selectedPackage?.identifier === monthlyPackage.identifier &&
                      styles.radioBtnSelected,
                  ]}>
                    {selectedPackage?.identifier === monthlyPackage.identifier && (
                      <View style={styles.radioDot} />
                    )}
                  </View>
                  <View style={styles.pricingInfo}>
                    <Text style={styles.pricingLabel}>Monthly</Text>
                    <Text style={styles.pricingPer}>Billed every month</Text>
                  </View>
                </View>
                <View style={styles.pricingRight}>
                  <Text style={styles.pricingPrice}>
                    {monthlyPackage.product.priceString}
                  </Text>
                  <Text style={styles.pricingPeriod}>per month</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Subscribe button */}
        <TouchableOpacity
          style={[
            styles.subscribeBtn,
            (!selectedPackage || isPurchasing) && styles.subscribeBtnDisabled,
          ]}
          onPress={handlePurchase}
          disabled={!selectedPackage || isPurchasing || isLoading}
        >
          {isPurchasing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.subscribeBtnText}>
              {selectedPackage
                ? `Subscribe · ${selectedPackage.product.priceString}`
                : 'Select a plan'}
            </Text>
          )}
        </TouchableOpacity>

        {/* Fine print */}
        <Text style={styles.finePrint}>
          Subscriptions auto-renew unless cancelled at least 24 hours before the end of the current period.
          Manage or cancel anytime in your device's subscription settings.
        </Text>

        {/* Restore purchases */}
        <TouchableOpacity
          style={styles.restoreBtn}
          onPress={handleRestore}
          disabled={isRestoring}
        >
          {isRestoring ? (
            <ActivityIndicator size="small" color={Colors.textMuted} />
          ) : (
            <Text style={styles.restoreBtnText}>Restore purchases</Text>
          )}
        </TouchableOpacity>

        {/* Continue as Guest — for App Store review */}
        <TouchableOpacity
          style={styles.guestBtn}
          onPress={() => router.replace('/(tabs)' as any)}
        >
          <Text style={styles.guestBtnText}>Continue as Guest</Text>
        </TouchableOpacity>

        {/* Legal links */}
        <View style={styles.legalRow}>
          <TouchableOpacity
            onPress={() => Linking.openURL('https://pinchanted.ca/terms')}
          >
            <Text style={styles.legalText}>Terms of Service</Text>
          </TouchableOpacity>
          <Text style={styles.legalDot}>·</Text>
          <TouchableOpacity
            onPress={() => Linking.openURL('https://pinchanted.ca/privacy')}
          >
            <Text style={styles.legalText}>Privacy Policy</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },



  scrollContent: {
    padding: Theme.screenPadding,
    paddingBottom: 48,
    gap: Theme.spacing.xl,
  },

  // Hero
  hero: {
    alignItems: 'center',
    gap: Theme.spacing.sm,
    paddingVertical: Theme.spacing.md,
  },
  logoCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#1a2a8f',
    borderWidth: 2, borderColor: Colors.gold,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Theme.spacing.xs,
  },
  logoInner: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: Colors.gold,
    opacity: 0.9,
    alignItems: 'center', justifyContent: 'center',
  },
  logoDot: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: Colors.crimson,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '500',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: Theme.fontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Features
  featuresCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 0.5,
    borderColor: Colors.goldBorder,
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.lg,
    gap: Theme.spacing.md,
  },
  featuresTitle: {
    fontSize: Theme.fontSize.md,
    fontWeight: '500',
    color: Colors.gold,
  },
  featuresList: { gap: Theme.spacing.sm },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
  },
  featureIcon: { fontSize: 18, width: 24, textAlign: 'center' },
  featureLabel: {
    flex: 1,
    fontSize: Theme.fontSize.md,
    color: Colors.textPrimary,
  },

  // Loading
  loadingContainer: {
    alignItems: 'center',
    gap: Theme.spacing.md,
    padding: Theme.spacing.xl,
  },
  loadingText: { fontSize: Theme.fontSize.sm, color: Colors.textMuted },

  // No pricing
  noPricingCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: Theme.radius.md,
    padding: Theme.spacing.lg,
    alignItems: 'center',
  },
  noPricingText: {
    fontSize: Theme.fontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
  },

  // Pricing
  pricingSection: { gap: Theme.spacing.md },
  pricingTitle: {
    fontSize: Theme.fontSize.sm,
    fontWeight: '500',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  pricingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: Theme.radius.lg,
    padding: Theme.spacing.lg,
  },
  pricingCardSelected: {
    backgroundColor: Colors.goldFaint,
    borderColor: Colors.gold,
  },
  pricingCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
    flex: 1,
  },
  radioBtn: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  radioBtnSelected: { borderColor: Colors.gold },
  radioDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: Colors.gold,
  },
  pricingInfo: { gap: 2 },
  pricingLabel: {
    fontSize: Theme.fontSize.md,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  pricingPer: { fontSize: Theme.fontSize.xs, color: Colors.textMuted },
  pricingRight: { alignItems: 'flex-end', gap: 2 },
  savingsBadge: {
    backgroundColor: Colors.successFaint,
    borderWidth: 0.5,
    borderColor: Colors.successBorder,
    borderRadius: Theme.radius.pill,
    paddingVertical: 2,
    paddingHorizontal: 8,
    marginBottom: 2,
  },
  savingsBadgeText: {
    fontSize: Theme.fontSize.xs,
    color: Colors.success,
    fontWeight: '500',
  },
  pricingPrice: {
    fontSize: Theme.fontSize.lg,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  pricingPeriod: { fontSize: Theme.fontSize.xs, color: Colors.textMuted },

  // Subscribe button
  subscribeBtn: {
    backgroundColor: Colors.crimson,
    borderRadius: Theme.radius.pill,
    paddingVertical: Theme.spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.goldBorder,
  },
  subscribeBtnDisabled: { opacity: 0.5 },
  subscribeBtnText: {
    fontSize: Theme.fontSize.lg,
    fontWeight: '500',
    color: Colors.textPrimary,
  },

  // Fine print
  finePrint: {
    fontSize: Theme.fontSize.xs,
    color: Colors.textFaint,
    textAlign: 'center',
    lineHeight: 18,
  },

  // Restore
  restoreBtn: {
    alignItems: 'center',
    paddingVertical: Theme.spacing.xs,
  },
  restoreBtnText: {
    fontSize: Theme.fontSize.sm,
    color: Colors.textMuted,
  },

  guestBtn: {
    paddingVertical: Theme.spacing.sm,
    alignItems: 'center',
    marginBottom: Theme.spacing.xs,
  },
  guestBtnText: {
    fontSize: Theme.fontSize.xs,
    color: 'rgba(255,255,255,0.25)',
    textDecorationLine: 'underline',
  },
  // Legal
  legalRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  legalText: {
    fontSize: Theme.fontSize.xs,
    color: Colors.textFaint,
  },
  legalDot: {
    fontSize: Theme.fontSize.xs,
    color: Colors.textFaint,
  },
});