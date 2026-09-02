import { Alert, Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

function getPhotoDirectory(): Directory {
  return new Directory(Paths.document, 'personnel-photos');
}

function ensurePhotoDirectory(): void {
  const directory = getPhotoDirectory();
  if (!directory.exists) {
    directory.create({ intermediates: true, idempotent: true });
  }
}

export function getPersonnelPhotoPath(personnelId: string): string {
  return new File(getPhotoDirectory(), `${personnelId}.jpg`).uri;
}

export async function persistPersonnelPhoto(
  personnelId: string,
  sourceUri: string,
): Promise<string> {
  ensurePhotoDirectory();

  const destination = new File(getPhotoDirectory(), `${personnelId}.jpg`);
  const source = new File(sourceUri);

  if (destination.exists) {
    destination.delete();
  }

  source.copy(destination);
  return destination.uri;
}

export async function deletePersonnelPhoto(photoUri: string | null | undefined): Promise<void> {
  if (!photoUri) return;

  try {
    const file = new File(photoUri);
    if (file.exists) {
      file.delete();
    }
  } catch {
    // Dosya zaten silinmiş olabilir.
  }
}

async function requestLibraryPermission(): Promise<boolean> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return status === 'granted';
}

async function requestCameraPermission(): Promise<boolean> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  return status === 'granted';
}

async function pickFromLibrary(): Promise<string | null> {
  const granted = await requestLibraryPermission();
  if (!granted) {
    throw new Error('Galeri erişim izni verilmedi.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.85,
  });

  if (result.canceled || !result.assets[0]) return null;
  return result.assets[0].uri;
}

async function pickFromCamera(): Promise<string | null> {
  const granted = await requestCameraPermission();
  if (!granted) {
    throw new Error('Kamera erişim izni verilmedi.');
  }

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.85,
  });

  if (result.canceled || !result.assets[0]) return null;
  return result.assets[0].uri;
}

export function pickPersonnelPhoto(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return pickFromLibrary();
  }

  return new Promise((resolve) => {
    Alert.alert('Fotoğraf Ekle', 'Kaynak seçin', [
      {
        text: 'Galeri',
        onPress: () => {
          pickFromLibrary().then(resolve).catch((error: Error) => {
            Alert.alert('Hata', error.message);
            resolve(null);
          });
        },
      },
      {
        text: 'Kamera',
        onPress: () => {
          pickFromCamera().then(resolve).catch((error: Error) => {
            Alert.alert('Hata', error.message);
            resolve(null);
          });
        },
      },
      { text: 'Vazgeç', style: 'cancel', onPress: () => resolve(null) },
    ]);
  });
}
