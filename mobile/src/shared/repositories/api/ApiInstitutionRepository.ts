import { useAuthStore } from '@/features/auth/store/authStore';
import type { InstitutionRepository } from '../interfaces';

export class ApiInstitutionRepository implements InstitutionRepository {
  /** Sunucu modunda kurum, oturumdaki tenant'tır. */
  async getFirst(): Promise<{ id: string; name: string } | null> {
    const { tenant } = useAuthStore.getState();
    return tenant ? { id: tenant.id, name: tenant.name } : null;
  }

  async create(): Promise<{ id: string; name: string }> {
    throw new Error('Kurum oluşturmak için createTenantAndLogin kullanın.');
  }

  /** Veri sunucuda tutulur; yerel temizleme/kalıcılaştırma işlemi yoktur. */
  async clearAllData(): Promise<void> {}

  async persist(): Promise<void> {}
}
