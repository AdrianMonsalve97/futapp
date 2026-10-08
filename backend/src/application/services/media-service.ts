import type { MediaAsset, MediaPurpose, MediaStorage } from '../ports/out/media.storage';
import type { SettingsRepository } from '../ports/out/settings.repository';
import type { UserRepository } from '../ports/out/user.repository';
import type { UniformRepository } from '../ports/out/uniform.repository';
import type { TournamentRepository } from '../ports/out/tournament.repository';
import type { UnitOfWork } from '../ports/out/unit-of-work';
import { NotFoundError, ValidationError } from '../../domain/errors';

export class MediaService {
  constructor(private readonly storage: MediaStorage, private readonly users: UserRepository,
    private readonly uniforms: UniformRepository, private readonly settings: SettingsRepository,
    private readonly tournaments: TournamentRepository, private readonly uow: UnitOfWork) {}
  async branding() {
    const { teamName, logoUrl, brandColor } = (await this.settings.get());
    return { teamName, logoUrl, brandColor };
  }
  async publicLogo(): Promise<MediaAsset> {
    const id = (await this.settings.get()).logoUrl?.split('/api/media/')[1];
    const asset = id ? (await this.storage.find(id)) : null;
    if (!asset || asset.purpose !== 'logo') throw new NotFoundError('Escudo no encontrado');
    return asset;
  }
  async read(id: string, userId: number, admin: boolean): Promise<MediaAsset> {
    const asset = (await this.storage.find(id));
    if (!asset) throw new NotFoundError('Archivo no encontrado');
    if ((asset.purpose === 'avatar' || asset.purpose === 'receipt') && !admin && asset.ownerId !== userId) throw new NotFoundError('Archivo no encontrado');
    if (asset.purpose === 'tournament' && !admin) {
      const document = (await this.tournaments.documentForAsset(id));
      const tournament = document ? (await this.tournaments.find(document.tournamentId)) : null;
      if (!tournament || tournament.status === 'borrador') throw new NotFoundError('Archivo no encontrado');
    }
    if (asset.purpose === 'tournament_image' && !admin) {
      const tournament = (await this.tournaments.tournamentForImage(id));
      if (!tournament || tournament.status === 'borrador') throw new NotFoundError('Archivo no encontrado');
    }
    return asset;
  }
  async content(asset: MediaAsset): Promise<Buffer> { return (await this.storage.content(asset)); }
  async upload(userId: number, purpose: MediaPurpose, entityId: number | null, fileName: string, data: Uint8Array, title?: string) {
    if (purpose === 'uniform' && !(await this.uniforms.findById(entityId!))) throw new NotFoundError('Uniforme no encontrado');
    if ((purpose === 'tournament' || purpose === 'tournament_image') && !(await this.tournaments.find(entityId!))) throw new NotFoundError('Torneo no encontrado');
    if (title !== undefined && (typeof title !== 'string' || !title.trim() || title.length > 120)) throw new ValidationError('Título de documento inválido');
    const asset = await this.storage.store(userId, purpose, fileName, data);
    try {
      return (await this.uow.run(async () => {
              const url = '/api/media/' + asset.id;
              if (purpose === 'logo') (await this.settings.update({ logoUrl: url }));
              if (purpose === 'avatar') (await this.users.update(userId, { avatarUrl: url }));
              if (purpose === 'uniform') (await this.uniforms.update(entityId!, { imageUrl: url }));
              if (purpose === 'tournament_image') (await this.tournaments.setImage(entityId!, asset.id));
              if (purpose === 'tournament') return (await this.tournaments.addDocument({ tournamentId: entityId!, title: title?.trim() || asset.fileName,
                        assetId: asset.id, fileName: asset.fileName, mimeType: asset.mimeType, extractedText: asset.extractedText,
                        extractionStatus: asset.extractedText ? 'extraido' : 'requiere_texto' }));
              return { url };
            }));
    } catch (error) { await this.storage.discard(asset); throw error; }
  }
  async clear(userId: number, purpose: 'logo' | 'avatar' | 'uniform' | 'tournament_image', entityId?: number) {
    if (purpose === 'tournament_image') {
      if (!(await this.tournaments.find(entityId!))) throw new NotFoundError('Torneo no encontrado');
      (await this.tournaments.setImage(entityId!, null));
    }
    if (purpose === 'logo') (await this.settings.update({ logoUrl: '/brand/aag-logo.jpg' }));
    if (purpose === 'avatar') (await this.users.update(userId, { avatarUrl: null }));
    if (purpose === 'uniform') {
      if (!(await this.uniforms.findById(entityId!))) throw new NotFoundError('Uniforme no encontrado');
      (await this.uniforms.update(entityId!, { imageUrl: null }));
    }
    return { ok: true };
  }
}
