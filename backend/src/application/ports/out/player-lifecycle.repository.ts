export interface PlayerLifecycleRepository {
  /** Runs inside the caller's transaction, including personal media cleanup scheduling. */
  purge(playerId: number, userId: number): Promise<void>;
  pendingFiles(): Promise<{ assetId: string; storedName: string }[]>;
  completeFile(assetId: string): Promise<void>;
}
