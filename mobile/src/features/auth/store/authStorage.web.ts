export async function getAuthItem(key: string): Promise<string | null> {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(key);
}

export async function setAuthItem(key: string, value: string): Promise<void> {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(key, value);
}

export async function deleteAuthItem(key: string): Promise<void> {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(key);
}
