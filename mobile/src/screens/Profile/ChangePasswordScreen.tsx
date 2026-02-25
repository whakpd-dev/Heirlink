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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { apiService } from '../../services/api';

export const ChangePasswordScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { showToast } = useToast();

  const [current, setCurrent] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [focusField, setFocusField] = useState<string | null>(null);

  const newRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const newValid = newPw.length >= 8;
  const confirmMatch = newPw === confirm && confirm.length > 0;
  const formValid = current.length > 0 && newValid && confirmMatch;

  const handleSave = async () => {
    setError('');
    if (!current) { setError('Введите текущий пароль'); return; }
    if (!newValid) { setError('Новый пароль — минимум 8 символов'); return; }
    if (!confirmMatch) { setError('Пароли не совпадают'); return; }
    if (current === newPw) { setError('Новый пароль должен отличаться от текущего'); return; }

    setLoading(true);
    try {
      await apiService.changePassword(current, newPw);
      showToast('Пароль изменён');
      navigation.goBack();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      if (msg === 'Current password is incorrect') {
        setError('Текущий пароль неверный');
      } else {
        setError(typeof msg === 'string' ? msg : 'Не удалось сменить пароль');
      }
    } finally {
      setLoading(false);
    }
  };

  const s = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        header: {
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          paddingHorizontal: 16, paddingVertical: 12,
          borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
          backgroundColor: colors.surface,
        },
        headerBtn: { width: 40 },
        headerTitle: { fontSize: 17, fontWeight: '600', color: colors.text },
        headerRight: { width: 40 },

        scroll: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 32 },

        iconCircle: {
          width: 64, height: 64, borderRadius: 32, backgroundColor: `${colors.primary}15`,
          justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 20,
        },
        desc: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 28, paddingHorizontal: 8 },

        inputWrap: {
          flexDirection: 'row', alignItems: 'center',
          borderWidth: 1.5, borderRadius: 12, marginBottom: 14,
          backgroundColor: colors.surface, paddingHorizontal: 14, height: 52,
        },
        inputDefault: { borderColor: colors.border },
        inputFocused: { borderColor: colors.primary },
        inputError: { borderColor: colors.like },
        inputSuccess: { borderColor: '#22c55e' },
        inputIcon: { marginRight: 10 },
        input: { flex: 1, fontSize: 16, color: colors.text, paddingVertical: 0 },
        eyeBtn: { padding: 6 },
        checkIcon: { marginLeft: 4 },

        hint: { fontSize: 12, color: colors.textTertiary, marginTop: -8, marginBottom: 12, marginLeft: 4 },

        errorBox: {
          flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(239,68,68,0.08)',
          borderRadius: 10, padding: 12, marginBottom: 16,
        },
        errorText: { color: colors.like, fontSize: 13, marginLeft: 8, flex: 1, lineHeight: 18 },

        button: { height: 52, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
        buttonActive: { backgroundColor: colors.primary },
        buttonDisabled: { backgroundColor: colors.border },
        buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
      }),
    [colors],
  );

  const fieldStyle = (field: string, valid: boolean, touched: boolean) => [
    s.inputWrap,
    focusField === field
      ? s.inputFocused
      : touched
        ? valid ? s.inputSuccess : s.inputError
        : s.inputDefault,
  ];

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <TouchableOpacity style={s.headerBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Смена пароля</Text>
        <View style={s.headerRight} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 24 }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={s.iconCircle}>
              <Ionicons name="shield-checkmark-outline" size={30} color={colors.primary} />
            </View>
            <Text style={s.desc}>
              Для безопасности введите текущий пароль, а затем придумайте новый (минимум 8 символов)
            </Text>

            {!!error && (
              <View style={s.errorBox}>
                <Ionicons name="alert-circle" size={18} color={colors.like} />
                <Text style={s.errorText}>{error}</Text>
              </View>
            )}

            {/* Current password */}
            <View style={fieldStyle('current', current.length > 0, false)}>
              <Ionicons name="lock-closed-outline" size={20} color={focusField === 'current' ? colors.primary : colors.textTertiary} style={s.inputIcon} />
              <TextInput
                style={s.input}
                placeholder="Текущий пароль"
                placeholderTextColor={colors.textTertiary}
                value={current}
                onChangeText={(t) => { setCurrent(t); setError(''); }}
                secureTextEntry={!showCurrent}
                autoCapitalize="none"
                returnKeyType="next"
                onSubmitEditing={() => newRef.current?.focus()}
                onFocus={() => setFocusField('current')}
                onBlur={() => setFocusField(null)}
              />
              <TouchableOpacity style={s.eyeBtn} onPress={() => setShowCurrent(!showCurrent)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name={showCurrent ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>

            {/* New password */}
            <View style={fieldStyle('new', newValid, newPw.length > 0)}>
              <Ionicons name="key-outline" size={20} color={focusField === 'new' ? colors.primary : colors.textTertiary} style={s.inputIcon} />
              <TextInput
                ref={newRef}
                style={s.input}
                placeholder="Новый пароль"
                placeholderTextColor={colors.textTertiary}
                value={newPw}
                onChangeText={(t) => { setNewPw(t); setError(''); }}
                secureTextEntry={!showNew}
                autoCapitalize="none"
                returnKeyType="next"
                onSubmitEditing={() => confirmRef.current?.focus()}
                onFocus={() => setFocusField('new')}
                onBlur={() => setFocusField(null)}
              />
              <TouchableOpacity style={s.eyeBtn} onPress={() => setShowNew(!showNew)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name={showNew ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>

            {/* Confirm password */}
            <View style={fieldStyle('confirm', confirmMatch, confirm.length > 0)}>
              <Ionicons name="checkmark-circle-outline" size={20} color={focusField === 'confirm' ? colors.primary : confirmMatch ? '#22c55e' : colors.textTertiary} style={s.inputIcon} />
              <TextInput
                ref={confirmRef}
                style={s.input}
                placeholder="Подтвердите новый пароль"
                placeholderTextColor={colors.textTertiary}
                value={confirm}
                onChangeText={(t) => { setConfirm(t); setError(''); }}
                secureTextEntry={!showNew}
                autoCapitalize="none"
                returnKeyType="go"
                onSubmitEditing={handleSave}
                onFocus={() => setFocusField('confirm')}
                onBlur={() => setFocusField(null)}
              />
              {confirmMatch && (
                <Ionicons name="checkmark-circle" size={18} color="#22c55e" style={s.checkIcon} />
              )}
            </View>
            {confirm.length > 0 && !confirmMatch && focusField !== 'confirm' && (
              <Text style={s.hint}>Пароли не совпадают</Text>
            )}

            <TouchableOpacity
              style={[s.button, formValid && !loading ? s.buttonActive : s.buttonDisabled]}
              onPress={handleSave}
              disabled={!formValid || loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.buttonText}>Сменить пароль</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </View>
  );
};
