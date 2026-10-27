import { useRouter } from 'expo-router';
import { useState } from 'react';
import { BOUTON_AJOUT, ChampsNote } from '@/components/ChampsNote';
import { EcranAjout } from '@/components/EcranAjout';
import { formulaireNoteVide, validerNote } from '@/data/ajouts';
import { useAjouts } from '@/hooks/useAjouts';
import { useDateAjout } from '@/hooks/useDateAjout';

// Ajouter une note (une ligne de day_notes) : une note, une maladie, une blessure ou une indisponibilité, avec le détail propre à chaque type et une période.
export default function EcranAjoutNote() {
  const router = useRouter();
  const { creerNote } = useAjouts();
  const [f, setF] = useState(formulaireNoteVide(useDateAjout()));
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  const change = (suite: typeof f) => {
    setF(suite);
    setErreur('');
  };

  async function enregistrer() {
    const r = validerNote(f);
    if (!r.ok) return setErreur(r.erreur);
    setEnCours(true);
    const e = await creerNote(r.ligne);
    setEnCours(false);
    if (e) return setErreur(e);
    router.back();
  }

  return (
    <EcranAjout bouton={BOUTON_AJOUT[f.type]} enCours={enCours} erreur={erreur} onValider={() => void enregistrer()}>
      <ChampsNote f={f} change={change} />
    </EcranAjout>
  );
}
