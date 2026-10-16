export interface MapsLinkResolver {
  resolve(value: string | null): Promise<string | null>;
}
