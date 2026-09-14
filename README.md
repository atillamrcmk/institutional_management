# Personel Planla — Mobile

Mobile-first, tamamen cihaz üzerinde çalışan personel planlama prototipi.

## Gereksinimler

- Node.js 18+
- **Expo Go** (App Store / Play Store) — proje **Expo SDK 54** kullanır
- Alternatif: Android Studio emülatörü (`npm run android`)

> **Expo Go hatası alıyorsanız:** "Project is incompatible" mesajı, telefonunuzdaki Expo Go sürümünün eski olduğunu gösterir. App Store / Play Store'dan Expo Go'yu güncelleyin. Güncelleme sonrası hâlâ açılmazsa bize yazın — SDK sürümünü düşürebiliriz.

## Kurulum

```bash
cd mobile
npm install
npm start
# Web için:
npm run web
```

## İlk Kullanım

1. Uygulamayı açın
2. **Demo Verileri Oluştur** butonuna basın
3. Demo kullanıcı seçin (Kurum Müdürü PIN: `1234`)
4. Giriş yapın

## Demo Kullanıcılar

| Kullanıcı | Rol | PIN |
|-----------|-----|-----|
| Kurum Müdürü | INSTITUTION_ADMIN | 1234 |
| Birim Yöneticisi | UNIT_MANAGER | 1234 |
| Personel | PERSONNEL | — |

## Test

```bash
npm test
```

Vardiya motoru unit testleri: `src/features/shifts/engine/shiftCalculator.test.ts`

## Mimari

Detaylı mimari: [ARCHITECTURE.md](../ARCHITECTURE.md)

- **Veri:** expo-sqlite (kalıcı, offline)
- **Katmanlar:** UI → Hooks → Repositories → SQLite
- **State:** TanStack Query (server) + Zustand (auth/UI)

## Ekranlar (MVP)

- Login + demo seed
- Yönetici dashboard
- Şu An Kurumda
- Personel listesi / detay
- Birimler / birim detay
- Vardiyalar / vardiya detay
- Personel ana sayfa (rol bazlı)

## Bilinen Eksikler (Sonraki Phase'ler)

- Görevlendirme oluşturma (Phase 6)
- Akıllı personel önerisi (Phase 7)
- Takvim görünümü (Phase 4 genişletme)
- Push bildirimler (Phase 8)
- Backend API (ileride)
