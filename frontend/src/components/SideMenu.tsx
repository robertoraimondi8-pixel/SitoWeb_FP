import React, { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, Animated,
  Dimensions, ScrollView, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { useLeague } from '../../src/contexts/LeagueContext';
import { colors, typography, spacing, borderRadius } from '../../src/theme/designSystem';
import { useTranslation } from 'react-i18next';

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

function PressableMenuItem({ item, onPress }: { item: MenuItem; onPress: () => void }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    Animated.timing(scaleAnim, { toValue: 0.97, duration: 80, useNativeDriver: true }).start();
  };
  const onPressOut = () => {
    Animated.timing(scaleAnim, { toValue: 1, duration: 120, useNativeDriver: true }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={s.menuItem}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={0.7}
        data-testid={item.testId}
      >
        <Ionicons name={item.icon} size={20} color={colors.accent} />
        <Text style={s.menuItemText}>{item.label}</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.border} />
      </TouchableOpacity>
    </Animated.View>
  );
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
        Animated.timing(slideAnim, { toValue: 0, duration: 240, useNativeDriver: true }),
        Animated.timing(overlayAnim, { toValue: 1, duration: 240, useNativeDriver: true }),
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
    // Navigate FIRST, then clear state to avoid crash during tab re-render
    router.replace('/(auth)/login' as any);
    setTimeout(async () => {
      await logout();
    }, 200);
  };

  const { t } = useTranslation();

  const accountItems: MenuItem[] = [
    { icon: 'person-outline', label: t('side_menu.profile'), route: '/menu/profile-edit', testId: 'menu-profile' },
    { icon: 'language-outline', label: t('side_menu.language'), route: '/menu/language', testId: 'menu-language' },
  ];

  const leagueItems: MenuItem[] = [
    { icon: 'list-outline', label: t('side_menu.my_leagues'), route: '/menu/my-leagues', testId: 'menu-my-leagues' },
    { icon: 'people-outline', label: t('side_menu.participants'), route: '/menu/members', testId: 'menu-members' },
    { icon: 'document-text-outline', label: t('side_menu.rules'), route: '/menu/rules', testId: 'menu-rules' },
    { icon: 'mail-outline', label: t('side_menu.my_invites'), route: '/menu/invites', testId: 'menu-invites' },
  ];

  const tournamentItems: MenuItem[] = [
    { icon: 'trophy-outline', label: t('side_menu.my_tournaments'), route: '/menu/my-tournaments', testId: 'menu-my-tournaments' },
    { icon: 'add-circle-outline', label: t('side_menu.join_tournaments'), route: '/menu/browse-tournaments', testId: 'menu-browse-tournaments' },
  ];

  const commsItems: MenuItem[] = [
    { icon: 'newspaper-outline', label: t('side_menu.news'), route: '/menu/news', testId: 'menu-news' },
    { icon: 'notifications-outline', label: t('side_menu.notifications'), route: '/menu/notifications', testId: 'menu-notifications' },
  ];

  const legalItems: MenuItem[] = [
    { icon: 'document-text-outline', label: t('side_menu.terms_of_service'), route: '/menu/terms', testId: 'menu-terms' },
    { icon: 'shield-checkmark-outline', label: t('side_menu.privacy_policy'), route: '/privacy-policy', testId: 'menu-privacy' },
  ];

  const renderSection = (title: string, icon: keyof typeof Ionicons.glyphMap, items: MenuItem[]) => (
    <View style={s.section}>
      <View style={s.sectionHeader}>
        <Ionicons name={icon} size={16} color={colors.accent} />
        <Text style={s.sectionTitle}>{title}</Text>
      </View>
      {items.map((item) => (
        <PressableMenuItem
          key={item.testId}
          item={item}
          onPress={() => item.action ? item.action() : item.route ? navigate(item.route) : null}
        />
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
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
            {/* User Header — Brand navy blue */}
            <LinearGradient
              colors={['#2C5FA8', '#1F4C8F', '#162F5C']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.userHeader}
            >
              <View style={s.avatar}>
                <Text style={s.avatarText}>
                  {(user?.username || 'U').charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={s.userInfo}>
                <Text style={s.userName}>{user?.username || t('side_menu.user_fallback')}</Text>
                <Text style={s.userEmail}>{user?.email || ''}</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={s.closeBtn} data-testid="menu-close">
                <Ionicons name="close" size={24} color="rgba(255,255,255,0.8)" />
              </TouchableOpacity>
            </LinearGradient>

            {/* Active League Indicator */}
            {activeLeague && (
              <View style={s.leagueBanner}>
                <Ionicons name="trophy" size={14} color={colors.accent} />
                <Text style={s.leagueBannerText} numberOfLines={1}>{activeLeague.name}</Text>
              </View>
            )}

            {renderSection(t('side_menu.section_account'), 'person-circle-outline', accountItems)}
            {renderSection(t('side_menu.section_league'), 'trophy-outline', leagueItems)}
            {renderSection(t('side_menu.section_tournaments'), 'podium-outline', tournamentItems)}
            {renderSection(t('side_menu.section_comms'), 'megaphone-outline', commsItems)}
            {renderSection(t('side_menu.section_legal'), 'shield-outline', legalItems)}

            {/* Logout — in fondo a tutto */}
            <View style={s.logoutWrap}>
              <View style={s.logoutDivider} />
              <PressableMenuItem
                item={{ icon: 'log-out-outline', label: t('side_menu.logout'), action: handleLogout, testId: 'menu-logout' }}
                onPress={handleLogout}
              />
            </View>
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
    fontWeight: '800',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  userEmail: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
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
    paddingVertical: 10,
    backgroundColor: 'rgba(31, 76, 143, 0.06)',
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  leagueBannerText: {
    fontSize: 13,
    fontWeight: '700',
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
  logoutWrap: {
    paddingHorizontal: 18,
    marginTop: 4,
  },
  logoutDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: 4,
  },
});
