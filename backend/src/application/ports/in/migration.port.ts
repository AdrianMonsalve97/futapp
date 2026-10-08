export interface MigrationStatus { enabled: boolean; canImport: boolean; importedAt: string | null; reason: string }
export interface MigrationPreview { id: string; createdAt: string; counts: Record<string, number>; files: number; expiresAt: string }
export interface MigrationPort {
  status(): MigrationStatus | Promise<MigrationStatus>;
  enable(enabled: boolean): MigrationStatus | Promise<MigrationStatus>;
  exportData(): Promise<Buffer>;
  preview(userId: number, file: Buffer): Promise<MigrationPreview>;
  commit(userId: number, id: string, confirmation: string): Promise<{ importedAt: string; counts: Record<string, number> }>;
}
