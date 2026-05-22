/**
 * @file weather.tsx
 * @description Widget météo temps réel pour les challenges sport en extérieur.
 *   GET /weather?lat=&lng= → temp, condition, vent, précip, humidité.
 *   Affiche un warning si conditions risquées (pluie/orage/extrême).
 */
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import * as api from '../shared/api';

interface Weather {
  temperature: number;
  condition: string;     // 'clear' | 'clouds' | 'rain' | 'storm' | 'snow'
  windKmh: number;
  precipitation: number; // %
  humidity: number;      // %
}

const CONDITION_ICON: Record<string, any> = {
  clear: 'sunny', clouds: 'cloudy', rain: 'rainy', storm: 'thunderstorm', snow: 'snow',
};

function isRisky(w: Weather): string | null {
  if (w.condition === 'storm') return "Orage — évite de sortir";
  if (w.condition === 'rain' && w.precipitation > 60) return 'Forte pluie attendue';
  if (w.temperature < 5) return `Froid extrême (${w.temperature}°C)`;
  if (w.temperature > 40) return `Chaleur extrême (${w.temperature}°C)`;
  return null;
}

export default function WeatherScreen() {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setError('Permission localisation refusée'); return; }
      const pos = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = pos.coords;
      const data = await api.get<Weather>(`/weather?lat=${latitude}&lng=${longitude}`);
      setWeather(data);
    } catch {
      setError('Météo indisponible');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const warning = weather ? isRisky(weather) : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A1F44' }}>
      <LinearGradient colors={['#0A1F44', '#152A47']} style={StyleSheet.absoluteFill} />
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.title}>Météo</Text>
        <TouchableOpacity onPress={load} style={s.back}>
          <Ionicons name="refresh" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={s.body}>
        {loading ? (
          <ActivityIndicator color="#FCD34D" size="large" />
        ) : error ? (
          <View style={{ alignItems: 'center' }}>
            <Ionicons name="cloud-offline-outline" size={48} color="#6B7280" />
            <Text style={{ color: '#93C5FD', marginTop: 12 }}>{error}</Text>
            <TouchableOpacity style={s.retry} onPress={load}>
              <Text style={s.retryText}>Réessayer</Text>
            </TouchableOpacity>
          </View>
        ) : weather ? (
          <>
            <Ionicons name={CONDITION_ICON[weather.condition] ?? 'partly-sunny'} size={96} color="#FCD34D" />
            <Text style={s.temp}>{Math.round(weather.temperature)}°C</Text>
            <Text style={s.cond}>{weather.condition}</Text>

            {warning && (
              <View style={s.warning}>
                <Ionicons name="warning" size={18} color="#0A1F44" />
                <Text style={s.warningText}>{warning}</Text>
              </View>
            )}

            <View style={s.metrics}>
              <Metric icon="speedometer" label="Vent" value={`${Math.round(weather.windKmh)} km/h`} />
              <Metric icon="rainy" label="Précip." value={`${weather.precipitation}%`} />
              <Metric icon="water" label="Humidité" value={`${weather.humidity}%`} />
            </View>
          </>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function Metric({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={s.metric}>
      <Ionicons name={icon} size={22} color="#93C5FD" />
      <Text style={s.metricValue}>{value}</Text>
      <Text style={s.metricLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  back: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontSize: 20, fontWeight: '900' },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  temp: { color: '#fff', fontSize: 64, fontWeight: '900' },
  cond: { color: '#93C5FD', fontSize: 16, textTransform: 'capitalize', marginTop: -6 },
  warning: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FCD34D', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, marginTop: 20 },
  warningText: { color: '#0A1F44', fontWeight: '800', fontSize: 13 },
  metrics: { flexDirection: 'row', gap: 16, marginTop: 36 },
  metric: { alignItems: 'center', backgroundColor: '#152A47', borderRadius: 14, padding: 16, minWidth: 92 },
  metricValue: { color: '#fff', fontSize: 16, fontWeight: '900', marginTop: 6 },
  metricLabel: { color: '#6B7280', fontSize: 11, marginTop: 2 },
  retry: { marginTop: 16, backgroundColor: '#FCD34D', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  retryText: { color: '#0A1F44', fontWeight: '800' },
});
