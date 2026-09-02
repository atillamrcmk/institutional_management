# Personel Planla — Multi-Tenant API

Kurum/işletme başına **ayrı PostgreSQL veritabanı**. Detay: [ARCHITECTURE.md](./ARCHITECTURE.md)

## Hızlı kurulum (sunucu)

```bash
# 1) Bağımlılıklar
cd server
cp .env.example .env
# .env içindeki şifre / JWT_SECRET / host'u düzenleyin

npm install

# 2) Control DB oluştur + şema
npm run setup:control-db

# 3) API'yi başlat
npm run dev
# production: npm start  (veya pm2 / systemd)
```

PostgreSQL kullanıcısının `CREATE DATABASE` yetkisi olmalı (`ADMIN_DATABASE_URL`).

## İlk kurum oluşturma

```bash
curl -X POST http://localhost:8787/api/v1/tenants \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Kuzey Kampüs",
    "slug": "kuzey_kampus",
    "orgType": "INSTITUTION",
    "owner": {
      "email": "admin@kuzey.example",
      "password": "gizli123",
      "displayName": "Kurum Müdürü"
    }
  }'
```

Yanıtta `token` gelir. Bu token ile:

```bash
# Personel ekle
curl -X POST http://localhost:8787/api/v1/personnel \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Ali","lastName":"Yılmaz","sicilNo":"P-001","title":"Güvenlik"}'

# Personel listesi (yalnızca o kurumun DB'si)
curl http://localhost:8787/api/v1/personnel \
  -H "Authorization: Bearer TOKEN"

# Yetkili personel yöneticisi ata
curl -X POST http://localhost:8787/api/v1/users/invite \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "displayName": "İK Yetkilisi",
    "email": "ik@kuzey.example",
    "password": "gizli123",
    "role": "UNIT_MANAGER",
    "permissions": [
      { "permission": "personnel.manage" },
      { "permission": "presence.view" }
    ]
  }'
```

## Ortam değişkenleri

| Değişken | Açıklama |
|----------|----------|
| `CONTROL_DATABASE_URL` | Kurum kayıt DB |
| `ADMIN_DATABASE_URL` | `CREATE DATABASE` için |
| `TENANT_DATABASE_URL_TEMPLATE` | `.../{db}` şablonu |
| `JWT_SECRET` | Oturum imzası |

## Üretim checklist

- [ ] Güçlü `JWT_SECRET` ve DB şifreleri
- [ ] PostgreSQL dış dünyaya kapalı (yalnızca localhost / private network)
- [ ] Nginx + HTTPS
- [ ] `pm2` veya systemd ile process yönetimi
- [ ] Günlük yedek: control DB + tüm `pp_t_*` tenant DB’leri
- [ ] Firebase (push) kimlik bilgileri

## Mobil bağlantı

```env
EXPO_PUBLIC_API_URL=https://api.sizin-domain.com
```

Mobil tarafta bir sonraki adım: `ApiPersonnelRepository` + giriş ekranının e-posta/şifre ile sunucuya bağlanması.
