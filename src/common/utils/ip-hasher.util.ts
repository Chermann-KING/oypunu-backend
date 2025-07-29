import * as crypto from "crypto";

/**
 * 🔐 UTILITAIRE DE HACHAGE IP
 *
 * Fournit des méthodes sécurisées pour hacher les adresses IP
 * en respectant les exigences RGPD et de confidentialité.
 */
export class IpHasher {
  private static readonly SALT =
    process.env.IP_HASH_SALT || "oypunu-default-salt-2025";
  private static readonly ALGORITHM = "sha256";

  /**
   * Hache une adresse IP de manière sécurisée
   */
  static hashIp(ipAddress: string): string {
    if (!ipAddress || ipAddress.trim() === "") {
      return "unknown";
    }

    try {
      // Normaliser l'IP (supprimer les espaces, convertir en minuscules)
      const normalizedIp = ipAddress.trim().toLowerCase();

      // Créer le hash avec salt
      const hash = crypto
        .createHash(this.ALGORITHM)
        .update(normalizedIp + this.SALT)
        .digest("hex");

      // Retourner seulement les 16 premiers caractères pour économiser l'espace
      return `ip_${hash.substring(0, 16)}`;
    } catch (error) {
      console.error("Error hashing IP address:", error);
      return "hash_error";
    }
  }

  /**
   * Hache une adresse IP avec un salt personnalisé
   */
  static hashIpWithCustomSalt(ipAddress: string, customSalt: string): string {
    if (!ipAddress || ipAddress.trim() === "") {
      return "unknown";
    }

    try {
      const normalizedIp = ipAddress.trim().toLowerCase();

      const hash = crypto
        .createHash(this.ALGORITHM)
        .update(normalizedIp + customSalt)
        .digest("hex");

      return `ip_${hash.substring(0, 16)}`;
    } catch (error) {
      console.error("Error hashing IP with custom salt:", error);
      return "hash_error";
    }
  }

  /**
   * Vérifie si une IP correspond à un hash donné
   * (utile pour la validation sans stocker l'IP en clair)
   */
  static verifyIpHash(ipAddress: string, hash: string): boolean {
    if (!ipAddress || !hash) {
      return false;
    }

    try {
      const computedHash = this.hashIp(ipAddress);
      return computedHash === hash;
    } catch (error) {
      console.error("Error verifying IP hash:", error);
      return false;
    }
  }

  /**
   * Génère un hash d'IP anonymisé pour les analytics
   * (plus court, adapté aux métriques)
   */
  static hashIpForAnalytics(ipAddress: string): string {
    if (!ipAddress || ipAddress.trim() === "") {
      return "anon";
    }

    try {
      const normalizedIp = ipAddress.trim().toLowerCase();

      // Hash plus court pour les analytics
      const hash = crypto
        .createHash("md5")
        .update(normalizedIp + this.SALT + "analytics")
        .digest("hex");

      // Retourner seulement 8 caractères pour les stats
      return hash.substring(0, 8);
    } catch (error) {
      console.error("Error hashing IP for analytics:", error);
      return "anon_err";
    }
  }

  /**
   * Extrait l'IP réelle depuis les headers de proxy/load balancer
   */
  static extractRealIp(request: any): string {
    if (!request || !request.headers) {
      return "unknown";
    }

    // Ordre de priorité pour les headers d'IP
    const ipHeaders = [
      "x-forwarded-for",
      "x-real-ip",
      "x-client-ip",
      "cf-connecting-ip", // Cloudflare
      "x-forwarded",
      "forwarded-for",
      "forwarded",
    ];

    // Essayer les headers un par un
    for (const header of ipHeaders) {
      const headerValue = request.headers[header];
      if (headerValue) {
        // x-forwarded-for peut contenir plusieurs IPs séparées par des virgules
        const ips = headerValue.split(",").map((ip: string) => ip.trim());
        const firstIp = ips[0];

        if (this.isValidIp(firstIp)) {
          return firstIp;
        }
      }
    }

    // Fallback sur l'IP de connection directe
    return (
      request.connection?.remoteAddress ||
      request.socket?.remoteAddress ||
      request.ip ||
      "unknown"
    );
  }

  /**
   * Valide le format d'une adresse IP
   */
  private static isValidIp(ip: string): boolean {
    if (!ip || typeof ip !== "string") {
      return false;
    }

    // Regex basique pour IPv4
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    // Regex basique pour IPv6
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;

    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
  }

  /**
   * Anonymise une IP en gardant seulement une partie pour la géolocalisation
   * (utile pour les analytics géographiques tout en préservant la vie privée)
   */
  static anonymizeIpForGeo(ipAddress: string): string {
    if (!ipAddress || !this.isValidIp(ipAddress)) {
      return "unknown";
    }

    try {
      if (ipAddress.includes(".")) {
        // IPv4: garder seulement les 3 premiers octets
        const parts = ipAddress.split(".");
        if (parts.length === 4) {
          return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
        }
      } else if (ipAddress.includes(":")) {
        // IPv6: garder seulement les 4 premiers segments
        const parts = ipAddress.split(":");
        if (parts.length >= 4) {
          return `${parts[0]}:${parts[1]}:${parts[2]}:${parts[3]}::`;
        }
      }

      return "unknown";
    } catch (error) {
      console.error("Error anonymizing IP for geo:", error);
      return "unknown";
    }
  }

  /**
   * Génère des statistiques d'usage sans exposer les IPs
   */
  static generateIpStats(ipHashes: string[]): {
    uniqueIps: number;
    mostFrequentIpHash: string;
    ipDistribution: { [hash: string]: number };
  } {
    if (!ipHashes || ipHashes.length === 0) {
      return {
        uniqueIps: 0,
        mostFrequentIpHash: "",
        ipDistribution: {},
      };
    }

    const distribution: { [hash: string]: number } = {};

    ipHashes.forEach((hash) => {
      distribution[hash] = (distribution[hash] || 0) + 1;
    });

    const sortedHashes = Object.entries(distribution).sort(
      ([, a], [, b]) => b - a
    );

    return {
      uniqueIps: Object.keys(distribution).length,
      mostFrequentIpHash: sortedHashes[0]?.[0] || "",
      ipDistribution: distribution,
    };
  }
}

/**
 * Interface pour les métadonnées d'IP hachée
 */
export interface HashedIpMetadata {
  hashedIp: string;
  timestamp: Date;
  userAgent?: string;
  geoHash?: string; // Hash géographique anonymisé
  sessionId?: string;
}

/**
 * Middleware helper pour hacher automatiquement les IPs dans les requests
 */
export function hashIpMiddleware(request: any): HashedIpMetadata {
  const realIp = IpHasher.extractRealIp(request);
  const hashedIp = IpHasher.hashIp(realIp);
  const geoHash = IpHasher.anonymizeIpForGeo(realIp);

  return {
    hashedIp,
    timestamp: new Date(),
    userAgent: request.headers?.["user-agent"] || "unknown",
    geoHash: IpHasher.hashIpForAnalytics(geoHash),
    sessionId: request.session?.id || request.headers?.["x-session-id"],
  };
}
