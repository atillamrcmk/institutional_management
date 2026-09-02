# Multi-Tenant Mimari — Personel Planla

## Ürün akışı

1. Kullanıcı uygulamayı indirir.
2. **Kurucu yönetici** kurum/işletme oluşturur (ad, slug, e-posta, şifre).
3. Sunucu bu kurum için **ayrı bir PostgreSQL veritabanı** oluşturur.
4. Kurucu yönetici, personel işlerini yürütecek bir **yetkili** atar (`personnel.manage` vb.).
5. Yetkili personel ekler/düzenler; listeler yalnızca o kurumun DB’sinden gelir.
6. Diğer personeller davet/PIN ile giriş yapar; kendi kurum verisini görür.

## İki katmanlı veri modeli

```
┌─────────────────────────────────────────┐
│  CONTROL DB  (personel_planla_control)  │
│  • tenants (kurum kaydı + db_name)      │
│  • tenant_admins (giriş kimlikleri)     │
│  • provisioning_logs                    │
└──────────────────┬──────────────────────┘
                   │ her kurum için CREATE DATABASE
                   ▼
┌─────────────────────────────────────────┐
│  TENANT DB  (pp_t_<slug>)               │
│  • personnel, units, users, grants      │
│  • shifts, assignments, messages…       │
│  • device_push_tokens                   │
└─────────────────────────────────────────┘
```

### Neden ayrı DB?

- Kurumlar birbirinin personelini asla göremez (fiziksel izolasyon).
- Yedekleme / silme / taşıma kurum bazında yapılır.
- “Kuruma ait veritabanı” ürün vaadiyle örtüşür.

### Alternatif (ileride)

Yüzlerce küçük kiracıda operasyon maliyeti artarsa **schema-per-tenant** veya **shared + RLS**’e geçilebilir; API katmanı `TenantContext` ile soyutlandığı için geçiş mümkün kalır.

## Roller ve yetkiler

| Rol | Anlamı |
|-----|--------|
| `OWNER` / `INSTITUTION_ADMIN` | Kurumu oluşturan; her şeyi yapabilir, yetkili atar |
| `UNIT_MANAGER` | Verilen grant’lere göre personel/vardiya yönetimi |
| `PERSONNEL` | Kendi takvimi, kurumda listesi, (izinliyse) mesaj |

Grant örnekleri: `personnel.manage`, `shifts.manage`, `units.manage`, `messages.send`, `presence.view`

## API yüzeyi (ilk milestone)

| Metot | Yol | Açıklama |
|-------|-----|----------|
| POST | `/api/v1/tenants` | Kurum + owner oluştur, tenant DB provision |
| POST | `/api/v1/auth/login` | E-posta/sicil + şifre → JWT |
| GET | `/api/v1/me` | Oturum + kurum bilgisi |
| POST | `/api/v1/users/invite` | Personel kullanıcısı / yetkili oluştur |
| GET/POST | `/api/v1/personnel` | Personel listele / ekle (tenant DB) |
| PATCH | `/api/v1/personnel/:id` | Personel güncelle |
| … | mesaj / push | Mevcut uçlar tenant-aware hale getirilir |

JWT claim: `{ sub, tenantId, role, permissions[] }`  
Her istekte middleware doğru tenant pool’unu seçer.

## Mobil geçiş stratejisi

1. **Şimdi:** Sunucu multi-tenant API ayağa kalkar.
2. **Sonra:** Mobilde `Api*Repository` implementasyonları; SQLite offline cache olarak kalabilir.
3. Repository interface aynı kaldığı için ekranlar büyük ölçüde değişmez.

## Sunucu gereksinimleri

- Ubuntu 22.04+ (veya benzeri)
- Node.js 20+
- PostgreSQL 14+ (süperuser: yeni DB oluşturabilmeli)
- Nginx (reverse proxy) + TLS (Let’s Encrypt)
- Firewall: 443 açık, 5432 dışarı kapalı
