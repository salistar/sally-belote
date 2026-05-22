/**
 * @file profile/edit.tsx
 * @description Edition complete du profil : username, bio, avatar (upload),
 * langue, fuseau, notifs.
 */
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, Alert, ScrollView, ActivityIndicator, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as api from '../../shared/api';

import * as ImagePicker from 'expo-image-picker';

export default function ProfileEditScreen() {
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [locale, setLocale] = useState<'fr' | 'en' | 'ar'>('fr');
  const [notif, setNotif] = useState(true);
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    api.get<{ username: string; bio?: string; avatar?: string; locale?: string }>('/users/me')
      .then((u) => {
        setUsername(u.username);
        setBio(u.bio ?? '');
        setAvatarUri(u.avatar ?? null);
        setLocale((u.locale as any) ?? 'fr');
      });
  }, []);

  async function pickAvatar() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission requise');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.7,
    });
    if (!res.canceled && res.assets[0]) {
      setAvatarUri(res.assets[0].uri);
    }
  }

  async function save() {
    if (username.trim().length < 3) {
      Alert.alert('Username trop court (3 caracteres min)');
      return;
    }
    setLoading(true);
    try {
      let avatarUrl = avatarUri;
      if (avatarUri && avatarUri.startsWith('file://')) {
        // Upload via multipart
        const form = new FormData();
        form.append('file', { uri: avatarUri, name: 'avatar.jpg', type: 'image/jpeg' } as any);
        const upload = await api.upload<{ url: string }>('/users/me/avatar', form);
        avatarUrl = upload.url;
      }
      await api.patch('/users/me', { username, bio, avatar: avatarUrl, locale, notifEnabled: notif });
      Alert.alert('Profil sauvegarde');
      router.back();
    } catch (e: any) {
      Alert.alert('Erreur', e?.message ?? 'Echec');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A1F44' }}>
      <ScrollView contentContainerStyle={{ padding: 24 }}>
        <Text style={{ fontSize: 26, color: '#FCD34D', fontWeight: '900' }}>Mon profil</Text>

        <TouchableOpacity onPress={pickAvatar} style={{ alignItems: 'center', marginTop: 20 }}>
          {avatarUri
            ? <Image source={{ uri: avatarUri }} style={{ width: 110, height: 110, borderRadius: 55, borderWidth: 3, borderColor: '#FCD34D' }} />
            : <View style={{ width: 110, height: 110, borderRadius: 55, backgroundColor: '#152A47', borderWidth: 3, borderColor: '#FCD34D', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#93C5FD' }}>+</Text>
              </View>}
          <Text style={{ color: '#93C5FD', marginTop: 6 }}>Changer l'avatar</Text>
        </TouchableOpacity>

        <Text style={{ color: '#93C5FD', marginTop: 24 }}>Nom d'utilisateur</Text>
        <TextInput value={username} onChangeText={setUsername}
          placeholderTextColor="#6B7280"
          style={{ padding: 14, backgroundColor: '#152A47', borderRadius: 10, color: '#fff', marginTop: 4 }} />

        <Text style={{ color: '#93C5FD', marginTop: 16 }}>Bio (optionnel)</Text>
        <TextInput value={bio} onChangeText={setBio} multiline numberOfLines={3}
          placeholder="Quelques mots sur toi…" placeholderTextColor="#6B7280"
          style={{ padding: 14, backgroundColor: '#152A47', borderRadius: 10, color: '#fff', marginTop: 4, minHeight: 80, textAlignVertical: 'top' }} />

        <Text style={{ color: '#93C5FD', marginTop: 16 }}>Langue</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
          {(['fr', 'en', 'ar'] as const).map((l) => (
            <TouchableOpacity key={l} onPress={() => setLocale(l)}
              style={{
                flex: 1, padding: 12, borderRadius: 10,
                backgroundColor: locale === l ? '#FCD34D' : '#152A47',
                alignItems: 'center',
              }}>
              <Text style={{ color: locale === l ? '#0A1F44' : '#fff', fontWeight: '700' }}>{l.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 }}>
          <Text style={{ color: '#fff' }}>Notifications push</Text>
          <Switch value={notif} onValueChange={setNotif} />
        </View>

        <TouchableOpacity onPress={save} disabled={loading}
          style={{ marginTop: 32, padding: 16, backgroundColor: loading ? '#666' : '#FCD34D', borderRadius: 12, alignItems: 'center' }}>
          {loading
            ? <ActivityIndicator />
            : <Text style={{ color: '#0A1F44', fontWeight: '900', fontSize: 16 }}>Sauvegarder</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
