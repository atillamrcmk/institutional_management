# Personel Planla API — v1 referansı

Taban yol: `/api/v1`. Sağlık kontrolü hariç tüm uçlar `Authorization: Bearer <JWT>` ister.

## Yanıt biçimi

Satırlar PostgreSQL'den geldiği gibi **snake_case** döner (`first_name`, `cycle_start_date`,
`work_schedule_type` …). İstek gövdeleri ise **camelCase** kabul eder (`firstName`,
`cycleStartDate`). Mobil taraf `snake_case -> camelCase` eşlemesini repository katmanında yapar.

Hesaplanmış (DB'den gelmeyen) alanlar camelCase'tir: `shift.shiftType`, `shift.startTime`,
`shift.endTime`, `shift.cycleDayIndex`, `assignmentTitle`, `assignmentTime`.

Hatalar: `{ "error": "mesaj", "requestId": "..." }`. Stack trace asla dönmez;
`X-Request-Id` başlığı sunucu loglarıyla eşleştirme içindir.

## Yetkiler

`INSTITUTION_ADMIN` rolü tüm izinlere sahiptir (`permissions: ['*']`). Diğer kullanıcılar için
`user_grants` tablosundaki izinler geçerlidir:

| İzin | Kapsam |
|------|--------|
| `personnel.manage` | Personel oluştur/güncelle/pasifleştir, izin kayıtları |
| `units.manage` | Birim CRUD, personel ata/çıkar |
| `shifts.manage` | Vardiya deseni ve grup CRUD, gruba personel ata/çıkar |
| `assignments.manage` | Görev tipi ve görevlendirme oluştur, durum güncelle |
| `users.manage` | Kullanıcı davet/güncelle, yetki ver/al |
| `presence.view` | Görev durumu (presence) uçları |
| `messages.send` | (Ayrılmış) mesaj gönderimi |

Okuma uçları (listeler, detaylar) yalnızca oturum ister.

---

## Kimlik

| Metot | Yol | Not |
|-------|-----|-----|
| `POST` | `/tenants` | Kurum + owner oluşturur, `token` döner. 20/15dk limit |
| `POST` | `/auth/login` | `{ email, password }` → `{ token, user, tenant }`. 20/15dk limit |
| `GET` | `/auth/me` | Oturumdaki kullanıcı |

## Personel — `/personnel`

| Metot | Yol | İzin |
|-------|-----|------|
| `GET` | `/personnel?q=` | oturum |
| `GET` | `/personnel/:id` | oturum |
| `POST` | `/personnel` | `personnel.manage` |
| `PATCH` | `/personnel/:id` | `personnel.manage` |
| `DELETE` | `/personnel/:id` | `personnel.manage` — yumuşak silme: `status = 'INACTIVE'`, açık birim ve vardiya bağlantıları kapatılır |

## Birimler — `/units`

| Metot | Yol | İzin |
|-------|-----|------|
| `GET` | `/units?parentId=<id\|root>` | oturum |
| `GET` | `/units/unassigned?q=` | oturum — hiçbir birime bağlı olmayan aktif personel |
| `GET` | `/units/personnel/:personnelId/current` | oturum — personelin bağlı olduğu birim veya `null` |
| `GET` | `/units/:id` | oturum |
| `GET` | `/units/:id/personnel` | oturum |
| `GET` | `/units/:id/personnel/count` | oturum → `{ unitId, count }` |
| `POST` | `/units` | `units.manage` |
| `PATCH` | `/units/:id` | `units.manage` |
| `DELETE` | `/units/:id` | `units.manage` — alt birim veya kayıtlı personel varsa 400 |
| `POST` | `/units/:id/personnel` | `units.manage` — `{ personnelId, move? }`. Personel başka birimdeyse `move: true` olmadan 409 |
| `DELETE` | `/units/:id/personnel/:personnelId` | `units.manage` |

Birim varsayılanları: `work_schedule_type = 'OFFICE'`, `office_start_time = '08:00'`,
`office_end_time = '17:00'`. Birime vardiya grubu eklendiğinde otomatik olarak `'SHIFT'` olur.

## Vardiyalar — `/shifts`

### Desenler

| Metot | Yol | İzin |
|-------|-----|------|
| `GET` | `/shifts/patterns` | oturum |
| `GET` | `/shifts/patterns/:id` | oturum → desen + `days[]` |
| `GET` | `/shifts/patterns/:id/days` | oturum |
| `POST` | `/shifts/patterns` | `shifts.manage` — `{ name, referenceDate, days: [{ shiftType, startTime?, endTime? }] }` |
| `PATCH` | `/shifts/patterns/:id` | `shifts.manage` — `days` gönderilirse tüm günler değiştirilir |
| `DELETE` | `/shifts/patterns/:id` | `shifts.manage` — grupta kullanılıyorsa 400 |

`shiftType`: `DAY` \| `NIGHT` \| `FULL` \| `OFF`. `day_index` dizideki sıradan üretilir (0'dan başlar).

### Gruplar

| Metot | Yol | İzin |
|-------|-----|------|
| `GET` | `/shifts/groups?unitId=` | oturum |
| `GET` | `/shifts/groups/suggested-cycle-start?unitId=&patternId=` | oturum → `{ cycleStartDate }` |
| `GET` | `/shifts/groups/:id` | oturum |
| `GET` | `/shifts/groups/:id/personnel` | oturum |
| `POST` | `/shifts/groups` | `shifts.manage` — `{ unitId, name, patternId, cycleStartDate? }` |
| `PATCH` | `/shifts/groups/:id` | `shifts.manage` |
| `DELETE` | `/shifts/groups/:id` | `shifts.manage` |
| `POST` | `/shifts/groups/:id/personnel` | `shifts.manage` — `{ personnelId }`. Personel başka gruptaysa oradan çıkarılıp buraya alınır |
| `DELETE` | `/shifts/groups/:id/personnel/:personnelId` | `shifts.manage` |

`cycleStartDate` verilmezse aynı birim + desen için son grubun başlangıcı bir döngü ileri
alınarak önerilir; hiç grup yoksa desenin `reference_date` değeri kullanılır.
`cycle_offset` mobil uyumu için desen referansına göre hesaplanıp saklanır.

### Hesaplanmış vardiyalar

| Metot | Yol | Yanıt |
|-------|-----|-------|
| `GET` | `/shifts/personnel/:personnelId/active?date=` | `{ assignment, group, patternDays, referenceDate, shift }` veya `null` |
| `GET` | `/shifts/by-date?date=` | `{ date, groups: [{ group, unit, personnel[], shift }] }` |

## İzinler — `/absences`

| Metot | Yol | İzin |
|-------|-----|------|
| `GET` | `/absences?from=&to=` | oturum — aralıkla kesişen tüm izinler |
| `GET` | `/absences/personnel/:personnelId` | oturum |
| `GET` | `/absences/personnel/:personnelId/check?date=` | oturum → `{ isAbsent, absence }` |
| `POST` | `/absences` | `personnel.manage` — `{ personnelId, type, startDate, endDate, notes? }` |
| `DELETE` | `/absences/:id` | `personnel.manage` |

`type`: `LEAVE` \| `REPORT` \| `TRAINING` \| `TEMPORARY_DUTY`. Çakışan tarih aralığı 409 döner.

## Görev tipleri — `/task-types`

| Metot | Yol | İzin |
|-------|-----|------|
| `GET` | `/task-types` | oturum |
| `GET` | `/task-types/:id` | oturum |
| `POST` | `/task-types` | `assignments.manage` — `{ name, code }`, `code` büyük harfe çevrilir ve benzersizdir |

## Görevlendirmeler — `/assignments`

| Metot | Yol | İzin |
|-------|-----|------|
| `GET` | `/assignments?date=` veya `?from=&to=` ve `?status=` | oturum |
| `GET` | `/assignments/personnel/:personnelId?from=` | oturum |
| `GET` | `/assignments/personnel/:personnelId/active?date=` | oturum — `PLANNED`/`ACTIVE` olan ilk kayıt veya `null` |
| `GET` | `/assignments/:id` | oturum |
| `GET` | `/assignments/:id/detail` | oturum → `{ assignment, taskType, personnel[] }` |
| `POST` | `/assignments` | `assignments.manage` |
| `PATCH` | `/assignments/:id/status` | `assignments.manage` — `{ status }` |

`status`: `PLANNED` \| `ACTIVE` \| `COMPLETED` \| `CANCELLED`.

`POST` gövdesi: `{ taskTypeId, title, description?, date, startTime, endTime?,
requiredPersonnelCount?, managerPersonnelId?, personnelIds? }`.

## Görev durumu — `/presence` (izin: `presence.view`)

| Metot | Yol | Yanıt |
|-------|-----|-------|
| `GET` | `/presence?date=&unitId=&shiftGroupId=&status=` | `{ date, count, entries[] }` |
| `GET` | `/presence/stats?date=` | panel sayaçları |
| `GET` | `/presence/office-units?date=` | `{ date, units: [{ unitId, unitName, startTime, endTime, personnel[] }] }` |

`status` filtresi: `all` \| `on_duty` \| `on_assignment` \| `absent`.

Bir `entry`:

```json
{
  "personnel": { "id": "...", "first_name": "Ali", "last_name": "Yılmaz", "sicil_no": "P-001" },
  "unit": { "id": "...", "name": "Merkez", "work_schedule_type": "SHIFT" },
  "shiftGroup": { "id": "...", "name": "A Grubu", "cycle_start_date": "2026-01-01" },
  "shift": { "date": "2026-09-02", "shiftType": "DAY", "startTime": "08:00", "endTime": "20:00", "cycleDayIndex": 0 },
  "status": "ON_DUTY",
  "assignmentTitle": "Tören güvenliği",
  "assignmentTime": "09:00 – 12:00"
}
```

Hesaplama kuralları (mobil `presenceService` ile aynı):

1. Vardiya kaynağı: aktif vardiya grubu → yoksa birim `OFFICE` ise mesai saatleri → yoksa `OFF`.
   Mesai yalnızca Pzt–Cum günlerinde `DAY` sayılır.
2. Durum önceliği: `ABSENT` > `ON_ASSIGNMENT` > `ON_DUTY`.
3. `OFF` olan ve izinli/görevlendirilmiş olmayan personel listede yer almaz.

## Mesajlar — `/messages`

| Metot | Yol | Not |
|-------|-----|-----|
| `POST` | `/messages` | `{ subject, body, audienceType, unitId?, personnelIds? }`. `ADMINS` dışındaki hedefler `messages.send` izni ister; `ADMINS` için personelin `can_message_admins` bayrağı yeterlidir |
| `GET` | `/messages/inbox` | Gelen kutusu |
| `GET` | `/messages/sent` | Gönderilenler + `recipient_count`, `read_count` |
| `GET` | `/messages/unread-count` | `{ count }` |
| `GET` | `/messages/:id` | Gönderen ise `recipients[]` de döner; ilgisiz kullanıcıya 403 |
| `POST` | `/messages/:id/read` | Kendi alıcı kaydını okundu işaretler |

`audienceType`: `UNIT` \| `PERSONNEL` \| `ALL_PERSONNEL` \| `ADMINS`.

## Kullanıcılar — `/users` (izin: `users.manage`)

| Metot | Yol | Not |
|-------|-----|-----|
| `GET` | `/users` | Kurum kullanıcıları |
| `POST` | `/users/invite` | Hesap oluşturur (tenant DB + control DB) |
| `PATCH` | `/users/:id` | `{ displayName?, canMessageAdmins?, isActive?, personnelId? }`. Control DB ile senkron tutulur; son aktif `INSTITUTION_ADMIN` pasife alınamaz |
| `GET` | `/users/:id/grants` | Yetki listesi (+ `unit_name`) |
| `POST` | `/users/:id/grants` | `{ permission, unitId? }` — mevcutsa aynı kaydı döner |
| `DELETE` | `/users/:id/grants/:grantId` | Yetkiyi kaldırır |

## Cihazlar ve push

| Metot | Yol | Not |
|-------|-----|-----|
| `POST` | `/devices/register` | `{ token, platform }` |
| `POST` | `/push/send` | Yalnızca `INSTITUTION_ADMIN` |

---

## Güvenlik

- `helmet` ile güvenlik başlıkları, `x-powered-by` kapalı
- Hız limiti: genel `200/dk`, kimlik uçları `20/15dk` (`RATE_LIMIT_GENERAL`, `RATE_LIMIT_AUTH`)
- CORS: `CORS_ORIGINS` virgülle ayrılmış liste; boş veya `*` ise tümüne izin verilir
- Her istekte `X-Request-Id`; hata yanıtlarında yalnızca mesaj + `requestId` döner
- Kritik gövdeler `zod` ile doğrulanır
- Yazma işlemleri tenant DB'deki `audit_logs` tablosuna kaydedilir
