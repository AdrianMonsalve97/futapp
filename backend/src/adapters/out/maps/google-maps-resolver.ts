import type { MapsLinkResolver } from "../../../application/ports/out/maps-link-resolver";
import {
  isShortVenueUrl,
  parseVenueUrl,
  venueMap,
} from "../../../domain/venue-map";
import { ValidationError } from "../../../domain/errors";

export class GoogleMapsResolver implements MapsLinkResolver {
  constructor(private readonly request: typeof fetch = fetch) {}
  async resolve(value: string | null): Promise<string | null> {
    if (!value?.trim()) return null;
    let url = parseVenueUrl(value);
    if (!isShortVenueUrl(url)) return venueMap(url.href)!.url;
    const signal = AbortSignal.timeout(7000);
    try {
      for (let hop = 0; hop < 5; hop++) {
        const response = await this.request(url.href, {
          redirect: "manual",
          signal,
          headers: { "User-Agent": "FutApp-Maps/1.0" },
        });
        await response.body?.cancel();
        const location = response.headers.get("location");
        if (!location || response.status < 300 || response.status >= 400) break;
        // Validate every redirect before issuing any request to its destination.
        url = parseVenueUrl(new URL(location, url).href);
        if (!isShortVenueUrl(url)) return venueMap(url.href)!.url;
      }
    } catch (error) {
      if (error instanceof ValidationError) throw error;
    }
    throw new ValidationError(
      "No se pudo abrir el enlace corto. Pega el enlace completo de la cancha en Google Maps",
    );
  }
}
