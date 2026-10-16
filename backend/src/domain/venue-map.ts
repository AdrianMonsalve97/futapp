import { ValidationError } from "./errors";

const MAP_HOSTS = new Set([
  "www.google.com",
  "maps.google.com",
  "google.com",
  "www.google.com.co",
  "www.google.es",
]);
const SHORT_HOSTS = new Set(["maps.app.goo.gl", "goo.gl"]);

/** Only Google Maps URLs may cross the outbound resolver or become an iframe. */
export function parseVenueUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new ValidationError("Pega un enlace válido de Google Maps");
  }
  const short = SHORT_HOSTS.has(url.hostname);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    (!MAP_HOSTS.has(url.hostname) && !short) ||
    (url.hostname === "goo.gl" && !url.pathname.startsWith("/maps/")) ||
    (!short &&
      url.hostname !== "maps.google.com" &&
      !/^\/maps(?:\/|$)/.test(url.pathname))
  )
    throw new ValidationError("Solo se permiten enlaces HTTPS de Google Maps");
  if (value.length > 6000)
    throw new ValidationError("El enlace de Maps es demasiado largo");
  return url;
}

export function isShortVenueUrl(url: URL): boolean {
  return SHORT_HOSTS.has(url.hostname);
}

export function venueMap(
  value: string | null | undefined,
): { url: string; embedUrl: string; directionsUrl: string } | null {
  if (!value) return null;
  const url = parseVenueUrl(value);
  if (isShortVenueUrl(url))
    throw new ValidationError(
      "No se pudo resolver el enlace corto de Maps. Copia el enlace completo de la cancha",
    );
  if (url.pathname === "/maps/embed" && url.searchParams.has("pb")) {
    const embed = new URL("https://www.google.com/maps/embed");
    embed.searchParams.set("pb", url.searchParams.get("pb")!);
    return { url: embed.href, embedUrl: embed.href, directionsUrl: embed.href };
  }
  const cid = url.searchParams.get("cid");
  if (cid && /^\d{1,30}$/.test(cid)) {
    const canonical = `https://www.google.com/maps?cid=${cid}`;
    return {
      url: canonical,
      embedUrl: `${canonical}&output=embed`,
      directionsUrl: canonical,
    };
  }
  const pin = url.href.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  const pathPlace = url.pathname.match(
    /\/maps\/(?:place|search)\/([^/]+)/,
  )?.[1];
  let query = pin
    ? `${pin[1]},${pin[2]}`
    : (url.searchParams.get("query") ??
      url.searchParams.get("q") ??
      url.searchParams.get("ll"));
  if (!query && pathPlace) {
    try {
      query = decodeURIComponent(pathPlace).replace(/\+/g, " ");
    } catch {
      throw new ValidationError("El enlace de Maps está incompleto");
    }
  }
  if (!query?.trim())
    throw new ValidationError(
      "El enlace debe señalar una cancha. Usa Compartir en Google Maps",
    );
  const canonical = new URL("https://www.google.com/maps/search/");
  canonical.searchParams.set("api", "1");
  canonical.searchParams.set("query", query.trim());
  const candidate = url.searchParams.get("query_place_id");
  const placeId =
    candidate && /^[A-Za-z0-9_-]{1,256}$/.test(candidate) ? candidate : null;
  if (placeId) canonical.searchParams.set("query_place_id", placeId);
  const embed = new URL("https://www.google.com/maps");
  embed.searchParams.set("q", placeId ? `place_id:${placeId}` : query.trim());
  embed.searchParams.set("output", "embed");
  const directions = new URL("https://www.google.com/maps/dir/");
  directions.searchParams.set("api", "1");
  directions.searchParams.set("destination", query.trim());
  if (placeId) directions.searchParams.set("destination_place_id", placeId);
  return {
    url: canonical.href,
    embedUrl: embed.href,
    directionsUrl: directions.href,
  };
}
