import * as SecureStore from 'expo-secure-store';

// Stockage de la session Supabase dans le Trousseau iOS (Keystore sur Android), jamais en clair.
// SecureStore limite chaque valeur à environ 2 Ko, or une session (jetons) peut les dépasser : on la découpe en morceaux.
// Format : « <clé>.n » contient le nombre de morceaux, « <clé>.0 », « <clé>.1 »… le contenu.
const TAILLE = 1800;

const cleN = (cle: string) => `${cle}.n`;
const cleMorceau = (cle: string, i: number) => `${cle}.${i}`;

async function effacer(cle: string): Promise<void> {
  const n = Number(await SecureStore.getItemAsync(cleN(cle)));
  if (Number.isInteger(n) && n > 0) {
    for (let i = 0; i < n; i++) await SecureStore.deleteItemAsync(cleMorceau(cle, i));
  }
  await SecureStore.deleteItemAsync(cleN(cle));
}

export const stockageSecurise = {
  async getItem(cle: string): Promise<string | null> {
    const n = Number(await SecureStore.getItemAsync(cleN(cle)));
    if (!Number.isInteger(n) || n <= 0 || n > 50) return null;
    let texte = '';
    for (let i = 0; i < n; i++) {
      const morceau = await SecureStore.getItemAsync(cleMorceau(cle, i));
      if (morceau == null) return null; // session incomplète : on la considère absente plutôt que de la lire de travers
      texte += morceau;
    }
    return texte;
  },
  async setItem(cle: string, valeur: string): Promise<void> {
    await effacer(cle);
    const morceaux: string[] = [];
    for (let i = 0; i < valeur.length; i += TAILLE) morceaux.push(valeur.slice(i, i + TAILLE));
    for (let i = 0; i < morceaux.length; i++) await SecureStore.setItemAsync(cleMorceau(cle, i), morceaux[i]);
    await SecureStore.setItemAsync(cleN(cle), String(morceaux.length));
  },
  async removeItem(cle: string): Promise<void> {
    await effacer(cle);
  },
};
