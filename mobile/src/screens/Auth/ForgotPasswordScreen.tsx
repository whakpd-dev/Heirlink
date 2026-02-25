import React, { useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  Keyboard,
  TouchableWithoutFeedback,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { apiService } from '../../services/api';

type Step = 'email' | 'code' | 'newPassword';

export const ForgotPasswordScreen: React.FC = () => {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [countdown, setCountdown] = useState(0);

  const codeRef = useRef<TextInput>(null);
  const pwRef = useRef<TextInput>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const navigation = useNavigation();
  const { colors } = useTheme();

  const startCountdown = () => {
    setCountdown(60);
    timerRef.current && clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  const handleSendCode = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setErrorMessage('Введите корректный email');
      return;
    }
    setLoading(true);
    setErrorMessage('');
    try {
      await apiService.forgotPassword(trimmed);
      setStep('code');
      startCountdown();
      setTimeout(() => codeRef.current?.focus(), 300);
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || 'Не удалось отправить код');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (code.length !== 6) {
      setErrorMessage('Введите 6-значный код');
      return;
    }
    setStep('newPassword');
    setErrorMessage('');
    setTimeout(() => pwRef.current?.focus(), 300);
  };

  const handleResetPassword = async () => {
    if (newPassword.length < 8) {
      setErrorMessage('Пароль — минимум 8 символов');
      return;
    }
    setLoading(true);
    setErrorMessage('');
    try {
      await apiService.resetPassword(email.trim().toLowerCase(), code, newPassword);
      Alert.alert('Готово', 'Пароль успешно изменён. Теперь войдите с новым паролем.', [
        { text: 'Войти', onPress: () => navigation.navigate('Login' as never) },
      ]);
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setErrorMessage(
        msg === 'Invalid or expired reset code'
          ? 'Код неверный или истёк. Попробуйте запросить новый.'
          : msg || 'Не удалось сбросить пароль',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    setLoading(true);
    setErrorMessage('');
    try {
      await apiService.forgotPassword(email.trim().toLowerCase());
      startCountdown();
    } catch {
      setErrorMessage('Не удалось отправить код повторно');
    } finally {
      setLoading(false);
    }
  };

  const s = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28, paddingBottom: 40 },
        backBtn: {
          position: 'absolute', top: Platform.OS === 'ios' ? 56 : 16, left: 16, zIndex: 10,
          width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface,
          justifyContent: 'center', alignItems: 'center',
        },

        header: { alignItems: 'center', marginBottom: 32 },
        iconCircle: {
          width: 72, height: 72, borderRadius: 36,
          backgroundColor: `${colors.primary}18`, justifyContent: 'center', alignItems: 'center',
          marginBottom: 20,
        },
        title: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: 8 },
        desc: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20, paddingHorizontal: 12 },
        emailHighlight: { fontWeight: '600', color: colors.text },

        form: { width: '100%' },
        inputWrap: {
          flexDirection: 'row', alignItems: 'center',
          borderWidth: 1.5, borderRadius: 12, marginBottom: 14,
          backgroundColor: colors.surface, paddingHorizontal: 14, height: 52,
          borderColor: colors.border,
        },
        inputFocused: { borderColor: colors.primary },
        inputError: { borderColor: colors.like },
        inputIcon: { marginRight: 10 },
        input: { flex: 1, fontSize: 16, color: colors.text, paddingVertical: 0 },
        codeInput: { flex: 1, fontSize: 24, color: colors.text, letterSpacing: 8, textAlign: 'center', fontWeight: '600' },
        eyeBtn: { padding: 6 },

        errorBox: {
          flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(239,68,68,0.08)',
          borderRadius: 10, padding: 12, marginBottom: 16,
        },
        errorText: { color: colors.like, fontSize: 13, marginLeft: 8, flex: 1, lineHeight: 18 },

        button: {
          height: 52, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 8,
        },
        buttonActive: { backgroundColor: colors.primary },
        buttonDisabled: { backgroundColor: colors.border },
        buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },

        resendRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
        resendText: { fontSize: 13, color: colors.textSecondary },
        resendBtn: { fontSize: 13, color: colors.primary, fontWeight: '600' },
        resendDisabled: { color: colors.textTertiary },

        stepDots: { flexDirection: 'row', justifyContent: 'center', marginBottom: 28 },
        dot: { width: 8, height: 8, borderRadius: 4, marginHorizontal: 4 },
        dotActive: { backgroundColor: colors.primary, width: 24 },
        dotInactive: { backgroundColor: colors.border },
      }),
    [colors],
  );

  const [focusField, setFocusField] = useState<string | null>(null);

  const stepIndex = step === 'email' ? 0 : step === 'code' ? 1 : 2;
  const titles = ['Восстановление', 'Введите код', 'Новый пароль'];
  const descs: React.ReactNode[] = [
    'Введите email, на который зарегистрирован аккаунт',
    <Text key="d1">
      Мы отправили 6-значный код на{' '}
      <Text style={s.emailHighlight}>{email.trim().toLowerCase()}</Text>
    </Text>,
    'Придумайте новый надёжный пароль',
  ];
  const icons: Array<keyof typeof Ionicons.glyphMap> = ['key-outline', 'chatbox-ellipses-outline', 'shield-checkmark-outline'];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={s.container}
    >
      <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={22} color={colors.text} />
      </TouchableOpacity>

      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={s.stepDots}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={[s.dot, i <= stepIndex ? s.dotActive : s.dotInactive]} />
            ))}
          </View>

          <View style={s.header}>
            <View style={s.iconCircle}>
              <Ionicons name={icons[stepIndex]} size={32} color={colors.primary} />
            </View>
            <Text style={s.title}>{titles[stepIndex]}</Text>
            <Text style={s.desc}>{descs[stepIndex]}</Text>
          </View>

          <View style={s.form}>
            {!!errorMessage && (
              <View style={s.errorBox}>
                <Ionicons name="alert-circle" size={18} color={colors.like} />
                <Text style={s.errorText}>{errorMessage}</Text>
              </View>
            )}

            {step === 'email' && (
              <>
                <View style={[s.inputWrap, focusField === 'email' && s.inputFocused]}>
                  <Ionicons name="mail-outline" size={20} color={focusField === 'email' ? colors.primary : colors.textTertiary} style={s.inputIcon} />
                  <TextInput
                    style={s.input}
                    placeholder="Ваш email"
                    placeholderTextColor={colors.textTertiary}
                    value={email}
                    onChangeText={(t) => { setEmail(t); setErrorMessage(''); }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    autoCorrect={false}
                    autoFocus
                    returnKeyType="go"
                    onSubmitEditing={handleSendCode}
                    onFocus={() => setFocusField('email')}
                    onBlur={() => setFocusField(null)}
                  />
                </View>

                <TouchableOpacity
                  style={[s.button, !loading ? s.buttonActive : s.buttonDisabled]}
                  onPress={handleSendCode}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.buttonText}>Отправить код</Text>}
                </TouchableOpacity>
              </>
            )}

            {step === 'code' && (
              <>
                <View style={[s.inputWrap, focusField === 'code' && s.inputFocused]}>
                  <TextInput
                    ref={codeRef}
                    style={s.codeInput}
                    placeholder="000000"
                    placeholderTextColor={colors.textTertiary}
                    value={code}
                    onChangeText={(t) => { setCode(t.replace(/\D/g, '').slice(0, 6)); setErrorMessage(''); }}
                    keyboardType="number-pad"
                    maxLength={6}
                    autoFocus
                    returnKeyType="go"
                    onSubmitEditing={handleVerifyCode}
                    onFocus={() => setFocusField('code')}
                    onBlur={() => setFocusField(null)}
                  />
                </View>

                <TouchableOpacity
                  style={[s.button, code.length === 6 && !loading ? s.buttonActive : s.buttonDisabled]}
                  onPress={handleVerifyCode}
                  disabled={code.length !== 6 || loading}
                  activeOpacity={0.8}
                >
                  <Text style={s.buttonText}>Подтвердить</Text>
                </TouchableOpacity>

                <View style={s.resendRow}>
                  {countdown > 0 ? (
                    <Text style={s.resendText}>Повторно через {countdown} сек.</Text>
                  ) : (
                    <TouchableOpacity onPress={handleResend} disabled={loading}>
                      <Text style={[s.resendBtn, loading && s.resendDisabled]}>Отправить код ещё раз</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </>
            )}

            {step === 'newPassword' && (
              <>
                <View style={[s.inputWrap, focusField === 'pw' && s.inputFocused]}>
                  <Ionicons name="lock-closed-outline" size={20} color={focusField === 'pw' ? colors.primary : colors.textTertiary} style={s.inputIcon} />
                  <TextInput
                    ref={pwRef}
                    style={s.input}
                    placeholder="Новый пароль (мин. 8 символов)"
                    placeholderTextColor={colors.textTertiary}
                    value={newPassword}
                    onChangeText={(t) => { setNewPassword(t); setErrorMessage(''); }}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoFocus
                    returnKeyType="go"
                    onSubmitEditing={handleResetPassword}
                    onFocus={() => setFocusField('pw')}
                    onBlur={() => setFocusField(null)}
                  />
                  <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPassword(!showPassword)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textTertiary} />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[s.button, newPassword.length >= 8 && !loading ? s.buttonActive : s.buttonDisabled]}
                  onPress={handleResetPassword}
                  disabled={newPassword.length < 8 || loading}
                  activeOpacity={0.8}
                >
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.buttonText}>Сбросить пароль</Text>}
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};
