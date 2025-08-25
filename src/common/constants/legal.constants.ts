/**
 * Constantes liées aux versions des documents légaux.
 * Permet de centraliser et versionner les CGU/Politique de confidentialité.
 */
export const LEGAL_VERSIONS = {
  terms: process.env.TERMS_VERSION || "v1.0",
  privacy: process.env.PRIVACY_VERSION || "v1.0",
} as const;
