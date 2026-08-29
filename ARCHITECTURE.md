# Personel Planla — Mimari Dokümantasyon

## Mevcut Durum

- **Depo:** Sıfırdan başlatıldı (önceki web/backend kodu yok).
- **İlk MVP:** Tamamen cihaz üzerinde çalışan mobil prototip.
- **Backend / PostgreSQL / uzak API:** İlk milestone'da **yok**.
- **Kalıcı veri:** `expo-sqlite` (AsyncStorage yalnızca küçük ayarlar için).

## Ürün Vizyonu

**Mobile-first** cross-platform uygulama (iOS + Android). Yöneticiler kurum operasyonunu mobil cihazdan yönetebilir. Web panel ileride destekleyici yönetici arayüzü olacaktır.

## Teknoloji Yığını (MVP)

| Katman | Teknoloji |
|--------|-----------|
| Mobil | React Native, Expo, TypeScript, Expo Router |
| State (server) | TanStack Query |
| State (UI/auth) | Zustand |
| Form | React Hook Form + Zod |
| Veritabanı | expo-sqlite |
| Animasyon | Reanimated, Gesture Handler |

**İleride:** NestJS + PostgreSQL + Prisma backend, Next.js admin paneli. Repository pattern sayesinde SQLite → REST API geçişi minimum UI etkisiyle yapılır.

## Katmanlı Mimari

```
UI / Screens (Expo Router)
        ↓
Feature Hooks / Services (TanStack Query)
        ↓
Repository Interfaces
        ↓
SQLite Repositories (MVP) → Api Repositories (ileride)
        ↓
expo-sqlite
```

**Kural:** UI doğrudan SQL çalıştırmaz.

## Klasör Yapısı

```
personel-planla/
├── ARCHITECTURE.md
├── mobile/
│   ├── src/
│   │   ├── app/                    # Expo Router
│   │   │   ├── (admin)/            # Yönetici bottom tabs
│   │   │   ├── (personnel)/      # Personel bottom tabs
│   │   │   ├── login.tsx
│   │   │   └── _layout.tsx
│   │   ├── features/
│   │   │   ├── auth/
│   │   │   ├── dashboard/
│   │   │   ├── personnel/
│   │   │   ├── units/
│   │   │   ├── shifts/
│   │   │   ├── presence/
│   │   │   ├── assignments/        # Phase 6+
│   │   │   └── profile/
│   │   └── shared/
│   │       ├── components/         # Design system
│   │       ├── database/           # Migrations, seed
│   │       ├── repositories/       # Interfaces + SQLite impl
│   │       ├── hooks/
│   │       ├── types/
│   │       ├── theme/
│   │       └── utils/
│   └── package.json
```

## Veritabanı Tabloları

| Tablo | Açıklama |
|-------|----------|
| `institutions` | Kurum |
| `users` | Demo kullanıcılar (rol + PIN) |
| `personnel` | Personel kayıtları |
| `units` | Birimler (tree: parent_id) |
| `personnel_unit_history` | Personel-birim ilişkisi (geçmiş korunur) |
| `shift_patterns` | Vardiya döngü tanımı |
| `shift_pattern_days` | Döngü günleri (DAY/NIGHT/OFF) |
| `shift_groups` | Birim vardiya grupları (A, B, C, D) |
| `personnel_shift_assignments` | Personel → vardiya grubu |
| `personnel_absences` | İzin / rapor / eğitim |
| `task_types` | Görev türleri |
| `assignments` | Görevlendirmeler |
| `assignment_personnel` | Görev-personel |
| `audit_logs` | Denetim kayıtları |
| `schema_migrations` | Migration versiyon takibi |

## Migration Sistemi

- Merkezi `runMigrations()` uygulama açılışında çalışır.
- `migration_001_initial`, `migration_002_shift_engine`, `migration_003_assignments`
- Ekran bazlı `CREATE TABLE` yasak.

## Auth (Local MVP)

- Demo kullanıcılar SQLite `users` tablosunda.
- Roller: `INSTITUTION_ADMIN`, `UNIT_MANAGER`, `PERSONNEL`
- Giriş: demo kullanıcı seçimi + opsiyonel PIN.
- `AuthService` interface → ileride JWT implementasyonu.

## Navigasyon

**Yönetici (5 tab):** Ana Sayfa · Planlama · Görevler · Personel · Daha Fazla

**Personel (5 tab):** Ana Sayfa · Vardiyam · Görevlerim · Takvim · Profil

Rol bazlı tab seti; backend authorization ileride zorunlu olacak.

## İlk Milestone (Local MVP)

1. SQLite migration sistemi
2. Demo seed sistemi ("Demo Verileri Oluştur")
3. Personel CRUD
4. Birim CRUD
5. Personel-birim ilişkileri
6. Vardiya patternleri
7. Vardiya grupları
8. Personel vardiya ataması
9. Tarih bazlı vardiya hesaplama (backend source of truth mantığı, local engine)
10. "Şu An Kurumda" ekranı

## Phase Planı

| Phase | Kapsam |
|-------|--------|
| **1** | Foundation: Expo, SQLite, migrations, auth, design system, navigation |
| **2** | Organization: Personnel, Units, relations, detail screens |
| **3** | Shift Engine: patterns, groups, assignments, date calculation |
| **4** | Presence: dashboard, "bugün kurumda", birim durumu |
| **5** | Absence: izin, rapor |
| **6** | Assignment: görev oluşturma, personel seçimi |
| **7** | Planning Engine: öneri, çakışma, minimum kadro |
| **8** | Audit + Notification |

## Vardiya Motoru

- Frontend'de hard-code yok.
- `ShiftPattern` + `ShiftPatternDay` üzerinden hesaplanır.
- `reference_date` + cycle index → hedef tarih vardiyası.
- Unit test: DAY→NIGHT→OFF→OFF döngüsü, gece vardiyası, ay/yıl sınırları.

## Seed Verisi

- Kurum: **Kuzey Kampüs Kurumu**
- Birimler: Güvenlik, Malta, Merkez Kontrol, Nizamiye, Ziyaret, İdari
- 80–100 fake personel
- Malta A/B/C/D vardiya grupları, DAY→NIGHT→OFF→OFF pattern
- Production'da otomatik seed **çalışmaz**

## Güvenlik Notları (İleride)

- JWT + Refresh Token, Expo SecureStore
- institutionId isolation, IDOR koruması
- Rate limiting, audit log
- Hassas veri console.log'a yazılmaz
