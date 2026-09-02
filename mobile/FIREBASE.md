# Firebase Push (FCM) Kurulumu

Personel Planla bildirimleri **Firebase Cloud Messaging** ile çalışır.
Sunucu `firebase-admin` ile gönderir; mobil uygulama native FCM token kaydeder.

> **Expo Go ile çalışmaz.** `google-services.json` için **development build** veya production APK gerekir.

## 1) Firebase Console

1. [console.firebase.google.com](https://console.firebase.google.com) → yeni proje
2. **Android uygulaması ekle**
   - Paket adı: `com.atillamercimek.personelplanla`
3. `google-services.json` indir → `mobile/google-services.json` konumuna koy
4. (iOS için) `GoogleService-Info.plist` → `mobile/GoogleService-Info.plist`

## 2) Sunucu — Service Account

Firebase → Project settings → **Service accounts** → **Generate new private key** (JSON)

Sunucuda `/opt/personel-planla/app/.env`:

```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"
```

```bash
systemctl restart personel-planla-api
curl -s https://personel-api.atillamercimek.com/health
# firebasePush: true olmalı
```

## 3) Mobil — .env

`mobile/.env`:

```env
EXPO_PUBLIC_API_URL=https://personel-api.atillamercimek.com
EXPO_PUBLIC_PUSH_PROVIDER=firebase
```

## 4) Development build (Android)

```bash
cd mobile
npm install -g eas-cli
eas login
eas build --profile development --platform android
```

APK’yı telefona yükleyin → giriş → bildirim izni.

## 5) Test

Sunucuda token kaydı:

```bash
sudo -u postgres psql -d pp_t_test_kurum -c "SELECT user_id, left(token,40), platform FROM device_push_tokens;"
```

Mesaj gönder (curl veya uygulama). Token varsa FCM bildirimi gider.

## Sorun giderme

| Sorun | Çözüm |
|--------|--------|
| Token alınamıyor | Expo Go değil, eas build APK kullanın |
| `firebasePush: false` | Sunucu `.env` FIREBASE_* eksik |
| FIS_AUTH_ERROR | Firebase’de SHA-1 fingerprint ekleyin (EAS credentials) |
| Bildirim yok, token var | `journalctl -u personel-planla-api` FCM hatalarına bakın |
