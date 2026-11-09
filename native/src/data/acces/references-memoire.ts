// Les références de l'utilisateur (FTP, FC max) gardées en mémoire par compte, pour que chaque ticket du chat ne relance pas une requête.
// Vidées dès que le profil est enregistré (voir enregistrerProfil) : une FTP modifiée s'applique tout de suite.
import type { Reference } from '../calendrier/structure.ts';

export const memoireReferences = new Map<string, Reference>();

export function oublierReferences(): void {
  memoireReferences.clear();
}
