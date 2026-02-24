import React, { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, Animated,
  Dimensions, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { useLeague } from '../../src/contexts/LeagueContext';
import { colors, typography, spacing, borderRadius } from '../../src/theme/designSystem';

const SCREEN_WIDTH = Dimensions.get('window').width;
const MENU_WIDTH = Math.min(SCREEN_WIDTH * 0.82, 320);

type MenuItem = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  route?: string;
  action?: () => void;
  testId: string;
};

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function SideMenu({ visible, onClose }: Props) {
  const { user, logout } = useAuth();
  const { activeLeague } = useLeague();
  const router = useRouter();
  const slideAnim = useRef(new Animated.Value(-MENU_WIDTH)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(overlayAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: -MENU_WIDTH, duration: 200, useNativeDriver: true }),
        Animated.timing(overlayAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const navigate = (route: string) => {
    onClose();
    setTimeout(() => router.push(route as any), 150);
  };

  const handleLogout = () => {
    onClose();
    setTimeout(async () => {
      await logout();
      router.replace('/(auth)/login' as any);
    }, 150);
  };

  const accountItems: MenuItem[] = [
    { icon: 'person-outline', label: 'Profilo', route: '/menu/profile-edit', testId: 'menu-profile' },
    { icon: 'language-outline', label: 'Lingua', route: '/menu/language', testId: 'menu-language' },
    { icon: 'log-out-outline', label: 'Logout', action: handleLogout, testId: 'menu-logout' },
  ];

  const leagueItems: MenuItem[] = [
    { icon: 'list-outline', label: 'Le mie leghe', route: '/menu/my-leagues', testId: 'menu-my-leagues' },
    { icon: 'people-outline', label: 'Partecipanti', route: '/menu/members', testId: 'menu-members' },
    { icon: 'document-text-outline', label: 'Regolamento', route: '/menu/rules', testId: 'menu-rules' },
    { icon: 'mail-outline', label: 'I miei inviti', route: '/menu/invites', testId: 'menu-invites' },
  ];

  const commsItems: MenuItem[] = [
    { icon: 'newspaper-outline', label: 'News', route: '/menu/news', testId: 'menu-news' },
    { icon: 'notifications-outline', label: 'Notifiche', route: '/menu/notifications', testId: 'menu-notifications' },
  ];

  const renderSection = (title: string, icon: keyof typeof Ionicons.glyphMap, items: MenuItem[]) => (
    <View style={s.section}>
      <View style={s.sectionHeader}>
        <Ionicons name={icon} size={16} color={colors.accent} />
        <Text style={s.sectionTitle}>{title}</Text>
      </View>
      {items.map((item) => (
        <TouchableOpacity
          key={item.testId}
          style={s.menuItem}
          onPress={() => item.action ? item.action() : item.route ? navigate(item.route) : null}
          data-testid={item.testId}
        >
          <Ionicons name={item.icon} size={20} color={colors.textSecondary} />
          <Text style={s.menuItemText}>{item.label}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.border} />
        </TouchableOpacity>
      ))}
    </View>
  );

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={s.container}>
        {/* Overlay */}
        <Animated.View style={[s.overlay, { opacity: overlayAnim }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
        </Animated.View>

        {/* Drawer */}
        <Animated.View style={[s.drawer, { transform: [{ translateX: slideAnim }] }]}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* User Header */}
            <View style={s.userHeader}>
              <View style={s.avatar}>
                <Text style={s.avatarText}>
                  {(user?.username || 'U').charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={s.userInfo}>
                <Text style={s.userName}>{user?.username || 'Utente'}</Text>
                <Text style={s.userEmail}>{user?.email || ''}</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={s.closeBtn} data-testid="menu-close">
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Active League Indicator */}
            {activeLeague && (
              <View style={s.leagueBanner}>
                <Ionicons name="trophy" size={14} color={colors.accent} />
                <Text style={s.leagueBannerText} numberOfLines={1}>{activeLeague.name}</Text>
              </View>
            )}

            {renderSection('ACCOUNT', 'person-circle-outline', accountItems)}
            {renderSection('LEGA', 'trophy-outline', leagueItems)}
            {renderSection('COMUNICAZIONI', 'megaphone-outline', commsItems)}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  drawer: {
    width: MENU_WIDTH,
    backgroundColor: colors.card,
    height: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 54,
    paddingHorizontal: 18,
    paddingBottom: 18,
    backgroundColor: colors.primary,
    gap: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
  },
  userInfo: { flex: 1 },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  userEmail: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  leagueBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 18,
    marginTop: 14,
    marginBottom: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  leagueBannerText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
  },
  section: {
    marginTop: 18,
    paddingHorizontal: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  menuItemText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: colors.textPrimary,
  },
});
