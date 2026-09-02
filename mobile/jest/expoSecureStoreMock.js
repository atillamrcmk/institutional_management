/**
 * expo-secure-store ESM olarak yayımlanır ve ts-jest'in node ortamında ayrıştırılamaz.
 * Depo katmanı auth store üzerinden bu modülü dolaylı olarak yüklediği için bellek içi
 * bir karşılığı kullanılır.
 */
const store = new Map();

module.exports = {
  async getItemAsync(key) {
    return store.has(key) ? store.get(key) : null;
  },
  async setItemAsync(key, value) {
    store.set(key, value);
  },
  async deleteItemAsync(key) {
    store.delete(key);
  },
};
