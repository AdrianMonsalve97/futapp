export type MediaPurpose = 'logo' | 'avatar' | 'uniform' | 'tournament' | 'tournament_image' | 'receipt' | 'payment_qr';
export interface MediaAsset {
  id: string; ownerId: number; purpose: MediaPurpose; fileName: string; storedName: string;
  mimeType: string; size: number; extractedText: string;
}
export interface MediaStorage {
  store(ownerId: number, purpose: MediaPurpose, name: string, data: Uint8Array): Promise<MediaAsset>;
  find(id: string): Promise<MediaAsset | null>;
  content(asset: MediaAsset): Promise<Buffer>;
  discard(asset: MediaAsset): Promise<void>;
}
