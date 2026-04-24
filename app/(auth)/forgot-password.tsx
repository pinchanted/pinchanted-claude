// ============================================================
// PINCHANTED — Forgot Password Screen (Email OTP flow)
// app/(auth)/forgot-password.tsx
// ============================================================

import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { AntDesign } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../src/lib/supabase';
import { Colors } from '../../src/constants/colors';
import { Theme } from '../../src/constants/theme';

type Step = 'email' | 'code' | 'password' | 'success';

export default function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const passwordsMatch = password === confirm && confirm.length > 0;
  const meetsLength = password.length >= 8;
  const meetsUpper = /[A-Z]/.test(password);
  const meetsNumber = /[0-9]/.test(password);
  const passwordValid = meetsLength && meetsUpper && meetsNumber && passwordsMatch;

  // ── Step 1: Request code ─────────────────────────────────

  const handleRequestCode = async () => {
    if (!email.trim()) {
      Alert.alert('Required', 'Please enter your email address.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return;
    }

    setIsLoading(true);
    const { data, error } = await supabase.functions.invoke('send-sms-otp', {
      body: { email: email.trim().toLowerCase() },
    });
    setIsLoading(false);

    if (error) {
      Alert.alert('Error', 'Could not send code. Please try again.');
      return;
    }

    setStep('code');
  };

  // ── Step 2: Verify code ──────────────────────────────────

  const handleVerifyCode = async () => {
    if (code.length !== 6) {
      Alert.alert('Invalid code', 'Please enter the 6-digit code from your email.');
      return;
    }

    setIsLoading(true);
    const { data, error } = await supabase.functions.invoke('verify-sms-otp', {
      body: {
        email: email.trim().toLowerCase(),
        code: code.trim(),
      },
    });
    setIsLoading(false);

    if (error || data?.error) {
      Alert.alert('Invalid code', data?.error || 'Could not verify code. Please try again.');
      return;
    }

    if (data?.success) {
      setStep('password');
    }
  };

  // ── Step 3: Set new password ─────────────────────────────

  const handleSetPassword = async () => {
    if (!passwordValid) return;

    setIsLoading(true);

    // Send code + new password together — Edge Function validates
    // the code again and updates the password in one step
    const { data, error } = await supabase.functions.invoke('verify-sms-otp', {
      body: {
        email: email.trim().toLowerCase(),
        code: code.trim(),
        new_password: password,
      },
    });

    setIsLoading(false);

    if (error || data?.error) {
      Alert.alert('Error', data?.error || 'Could not update password. Please try again.');
      return;
    }

    setStep('success');
  };

  const Requirement = ({ met, label }: { met: boolean; label: string }) => (
    <View style={styles.reqRow}>
      <View style={[styles.reqDot, met && styles.reqDotMet]} />
      <Text style={[styles.reqText, met && styles.reqTextMet]}>{label}</Text>
    </View>
  );

  return (
    <LinearGradient
      colors={['#0f1d6e', '#0b1554', '#08103d']}
      style={styles.container}
    >
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingTop: 60 + insets.top }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Stars */}
          <View style={styles.star1} />
          <View style={styles.star2} />
          <View style={styles.star3} />

          {/* Back button */}
          {step !== 'success' && (
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => {
                if (step === 'email') router.back();
                else if (step === 'code') { setStep('email'); setCode(''); }
                else if (step === 'password') setStep('code');
              }}
            >
              <AntDesign name="left" size={14} color={Colors.textMuted} />
              <Text style={styles.backButtonText}>
                {step === 'email' ? 'Back to sign in' : 'Back'}
              </Text>
            </TouchableOpacity>
          )}

          {/* ── Step 1: Email ── */}
          {step === 'email' && (
            <>
              <View style={styles.header}>
                <View style={styles.iconCircle}>
                  <AntDesign name="lock" size={32} color={Colors.gold} />
                </View>
                <Text style={styles.title}>Forgot your password?</Text>
                <Text style={styles.subtitle}>
                  Enter your email address and we'll send you a 6-digit reset code.
                </Text>
              </View>

              <View style={styles.card}>
                <View style={styles.fieldContainer}>
                  <Text style={styles.label}>Email address</Text>
                  <View style={styles.inputWrapper}>
                    <AntDesign name="mail" size={14} color="rgba(255,255,255,0.4)" />
                    <TextInput
                      style={styles.input}
                      value={email}
                      onChangeText={setEmail}
                      placeholder="your@email.com"
                      placeholderTextColor={Colors.textPlaceholder}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoFocus
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.btn}
                  onPress={handleRequestCode}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.btnText}>Send code</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* ── Step 2: Enter code ── */}
          {step === 'code' && (
            <>
              <View style={styles.header}>
                <View style={[styles.iconCircle, styles.iconCircleEmail]}>
                  <Text style={styles.stepEmoji}>📧</Text>
                </View>
                <Text style={styles.title}>Check your email</Text>
                <Text style={styles.subtitle}>
                  We sent a 6-digit code to{'\n'}
                  <Text style={styles.highlight}>{email}</Text>
                </Text>
              </View>

              <View style={styles.card}>
                <View style={styles.fieldContainer}>
                  <Text style={styles.label}>6-digit code</Text>
                  <TextInput
                    style={styles.codeInput}
                    value={code}
                    onChangeText={v => setCode(v.replace(/\D/g, '').substring(0, 6))}
                    placeholder="000000"
                    placeholderTextColor={Colors.textPlaceholder}
                    keyboardType="number-pad"
                    maxLength={6}
                    autoFocus
                  />
                  <Text style={styles.fieldHint}>Code expires in 10 minutes</Text>
                </View>

                <TouchableOpacity
                  style={[styles.btn, code.length !== 6 && styles.btnDisabled]}
                  onPress={handleVerifyCode}
                  disabled={isLoading || code.length !== 6}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.btnText}>Verify code</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.resendBtn}
                  onPress={() => { setCode(''); handleRequestCode(); }}
                  disabled={isLoading}
                >
                  <Text style={styles.resendBtnText}>Resend code</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* ── Step 3: New password ── */}
          {step === 'password' && (
            <>
              <View style={styles.header}>
                <View style={[styles.iconCircle, styles.iconCircleSuccess]}>
                  <AntDesign name="check-circle" size={32} color={Colors.success} />
                </View>
                <Text style={styles.title}>Set new password</Text>
                <Text style={styles.subtitle}>
                  Code verified! Choose a strong new password.
                </Text>
              </View>

              <View style={styles.card}>
                <View style={styles.fieldContainer}>
                  <Text style={styles.label}>New password</Text>
                  <View style={styles.inputWrapper}>
                    <AntDesign name="lock" size={14} color="rgba(255,255,255,0.4)" />
                    <TextInput
                      style={styles.input}
                      value={password}
                      onChangeText={setPassword}
                      placeholder="At least 8 characters"
                      placeholderTextColor={Colors.textPlaceholder}
                      secureTextEntry
                      autoFocus
                    />
                  </View>
                </View>

                <View style={styles.requirements}>
                  <Requirement met={meetsLength} label="At least 8 characters" />
                  <Requirement met={meetsUpper} label="One uppercase letter" />
                  <Requirement met={meetsNumber} label="One number" />
                </View>

                <View style={styles.fieldContainer}>
                  <Text style={styles.label}>Confirm password</Text>
                  <View style={styles.inputWrapper}>
                    <AntDesign name="lock" size={14} color="rgba(255,255,255,0.4)" />
                    <TextInput
                      style={styles.input}
                      value={confirm}
                      onChangeText={setConfirm}
                      placeholder="Re-enter your password"
                      placeholderTextColor={Colors.textPlaceholder}
                      secureTextEntry
                    />
                  </View>
                  {confirm.length > 0 && !passwordsMatch && (
                    <Text style={styles.fieldError}>Passwords don't match</Text>
                  )}
                </View>

                <TouchableOpacity
                  style={[styles.btn, !passwordValid && styles.btnDisabled]}
                  onPress={handleSetPassword}
                  disabled={!passwordValid || isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.btnText}>Update password</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* ── Step 4: Success ── */}
          {step === 'success' && (
            <>
              <View style={styles.header}>
                <View style={[styles.iconCircle, styles.iconCircleSuccess]}>
                  <Text style={styles.stepEmoji}>✅</Text>
                </View>
                <Text style={styles.title}>Password updated!</Text>
                <Text style={styles.subtitle}>
                  Your password has been successfully reset. Sign in with your new password.
                </Text>
              </View>

              <TouchableOpacity
                style={styles.btn}
                onPress={() => router.replace('/(auth)/login')}
              >
                <Text style={styles.btnText}>Sign in</Text>
              </TouchableOpacity>
            </>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardView: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    padding: Theme.screenPadding,
    gap: Theme.spacing.xl,
  },

  star1: { position: 'absolute', width: 2, height: 2, borderRadius: 1, backgroundColor: '#fff', opacity: 0.6, top: '10%', left: '12%' },
  star2: { position: 'absolute', width: 1.5, height: 1.5, borderRadius: 1, backgroundColor: '#fff', opacity: 0.5, top: '18%', left: '82%' },
  star3: { position: 'absolute', width: 1, height: 1, borderRadius: 1, backgroundColor: '#fff', opacity: 0.6, top: '28%', left: '90%' },

  backButton: {
    flexDirection: 'row', alignItems: 'center',
    gap: Theme.spacing.xs, alignSelf: 'flex-start',
  },
  backButtonText: { fontSize: Theme.fontSize.sm, color: Colors.textMuted },

  header: {
    alignItems: 'center',
    gap: Theme.spacing.md,
    paddingVertical: Theme.spacing.lg,
  },
  iconCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(245,197,24,0.1)',
    borderWidth: 1, borderColor: Colors.goldBorder,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Theme.spacing.xs,
  },
  iconCircleEmail: {
    backgroundColor: 'rgba(100,160,255,0.1)',
    borderColor: 'rgba(100,160,255,0.35)',
  },
  iconCircleSuccess: {
    backgroundColor: 'rgba(93,202,122,0.1)',
    borderColor: Colors.successBorder,
  },
  stepEmoji: { fontSize: 36 },
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
    lineHeight: 22,
  },
  highlight: { color: Colors.gold, fontWeight: '500' },

  card: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 0.5, borderColor: Colors.goldBorder,
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.lg,
    gap: Theme.spacing.md,
  },

  fieldContainer: { gap: Theme.spacing.xs },
  label: { fontSize: Theme.fontSize.sm, color: Colors.gold, fontWeight: '500' },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 0.5, borderColor: 'rgba(245,197,24,0.18)',
    borderRadius: Theme.radius.md,
    paddingHorizontal: Theme.spacing.md, gap: Theme.spacing.sm,
  },
  input: {
    flex: 1, paddingVertical: Theme.spacing.md,
    color: Colors.textPrimary, fontSize: Theme.fontSize.md,
  },
  codeInput: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 0.5, borderColor: 'rgba(245,197,24,0.18)',
    borderRadius: Theme.radius.md,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.lg,
    color: Colors.textPrimary,
    fontSize: 32, fontWeight: '500',
    textAlign: 'center', letterSpacing: 12,
  },
  fieldHint: { fontSize: Theme.fontSize.xs, color: Colors.textFaint },
  fieldError: { fontSize: Theme.fontSize.xs, color: Colors.error },

  requirements: { gap: 6 },
  reqRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reqDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.2)' },
  reqDotMet: { backgroundColor: Colors.success },
  reqText: { fontSize: Theme.fontSize.xs, color: Colors.textMuted },
  reqTextMet: { color: Colors.success },

  btn: {
    backgroundColor: Colors.crimson,
    borderRadius: Theme.radius.pill,
    padding: Theme.spacing.md,
    alignItems: 'center',
    borderWidth: 1, borderColor: Colors.goldBorder,
  },
  btnDisabled: { opacity: 0.45 },
  btnText: { color: Colors.textPrimary, fontSize: Theme.fontSize.md, fontWeight: '500' },

  resendBtn: { alignItems: 'center', paddingVertical: Theme.spacing.xs },
  resendBtnText: { fontSize: Theme.fontSize.sm, color: Colors.gold },
});