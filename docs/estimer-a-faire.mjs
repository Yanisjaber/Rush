// Recalcule l'estimation de sortie de l'app à partir de docs/A_FAIRE.md.
// Usage : node docs/estimer-a-faire.mjs
// Lit les lignes « - [ ] **importance/10 · durée j** … », additionne ce qui reste,
// puis réécrit le bloc entre les marqueurs ESTIMATION et ajoute une ligne à l'historique.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const fichier = join(dirname(fileURLToPath(import.meta.url)), 'A_FAIRE.md')
const JOURS_PAR_SEMAINE = 5 // rythme réel depuis le 13 oct. 2026
const SEUIL_SORTIE = 7 // importance mini pour la version de sortie
const MARGE = 1.5 // fourchette prudente : durées sous-estimées + délais externes
const DELAI_EXTERNE_JOURS = 14 // validation Apple, accès API, domaine…
const D = '<!-- ESTIMATION:DEBUT -->'
const F = '<!-- ESTIMATION:FIN -->'

const texte = readFileSync(fichier, 'utf8')
const ligneEtiquette = /^- \[( |x)\] \*\*(\d+)\/10 · ([\d,.]+) j\*\*/

let section = ''
let sortieRestant = 0
let sortieFait = 0
let resteRestant = 0
let apresRestant = 0
let nbRestantes = 0
let nbFaites = 0
const parSection = new Map()

for (const ligne of texte.split('\n')) {
  if (ligne.startsWith('## ')) section = ligne.slice(3).trim()
  const m = ligne.match(ligneEtiquette)
  if (!m) continue
  const fait = m[1] === 'x'
  const importance = Number(m[2])
  const jours = Number(m[3].replace(',', '.'))
  const apres = section.includes('Après la sortie')
  if (fait) {
    nbFaites++
    if (!apres && importance >= SEUIL_SORTIE) sortieFait += jours
    continue
  }
  nbRestantes++
  if (apres) apresRestant += jours
  else if (importance >= SEUIL_SORTIE) {
    sortieRestant += jours
    parSection.set(section, (parSection.get(section) ?? 0) + jours)
  } else resteRestant += jours
}

const arrondi = (n) => Math.round(n * 10) / 10
const fr = (n) => String(arrondi(n)).replace('.', ',')
const ajouter = (date, jours) => new Date(date.getTime() + jours * 86400000)
const dateFr = (d) =>
  d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
const isoJour = (d) => d.toISOString().slice(0, 10)

const aujourdhui = new Date()
const semaines = sortieRestant / JOURS_PAR_SEMAINE
const optimiste = ajouter(aujourdhui, semaines * 7)
const prudent = ajouter(aujourdhui, semaines * 7 * MARGE + DELAI_EXTERNE_JOURS)

// Historique : on garde les lignes existantes, une par jour (la dernière du jour gagne)
const debut = texte.indexOf(D)
const fin = texte.indexOf(F)
if (debut === -1 || fin === -1) throw new Error('Marqueurs ESTIMATION introuvables dans A_FAIRE.md')
const ancien = texte.slice(debut, fin)
const lignesHisto = ancien
  .split('\n')
  .filter((l) => /^\| \d{4}-\d{2}-\d{2} \|/.test(l))
  .filter((l) => !l.startsWith(`| ${isoJour(aujourdhui)} |`))
lignesHisto.push(
  `| ${isoJour(aujourdhui)} | ${fr(sortieRestant)} j | ${fr(sortieRestant + resteRestant)} j | ${dateFr(optimiste)} | ${dateFr(prudent)} |`
)

const detail = [...parSection.entries()]
  .sort((a, b) => b[1] - a[1])
  .map(([nom, j]) => `| ${nom} | ${fr(j)} j |`)

const bloc = [
  D,
  '## Estimation de la sortie (calculée par `node docs/estimer-a-faire.mjs`)',
  '',
  `Mise à jour : **${dateFr(aujourdhui)}**. Rythme supposé : ${JOURS_PAR_SEMAINE} jours de travail par semaine.`,
  '',
  `- **Version de sortie** (tâches ≥ ${SEUIL_SORTIE}/10) : **${fr(sortieRestant)} jours** restants (${fr(sortieFait)} j déjà faits).`,
  `- **Sortie estimée : ${dateFr(optimiste)}** si tout se passe bien.`,
  `- **Fourchette prudente : ${dateFr(prudent)}** (durées ×${MARGE} + ${DELAI_EXTERNE_JOURS} jours pour Apple, les accès API, le domaine…).`,
  `- Le reste (tâches < ${SEUIL_SORTIE}/10) : ${fr(resteRestant)} jours, à faire après la sortie ou si on a de la marge. « Après la sortie » : ${fr(apresRestant)} jours.`,
  `- Tâches : ${nbRestantes} restantes, ${nbFaites} faites.`,
  '',
  'Où part le temps de la version de sortie :',
  '',
  '| Thème | Jours restants (≥ 7/10) |',
  '|---|---|',
  ...detail,
  '',
  'Historique (une ligne par recalcul) :',
  '',
  '| Date | Sortie : jours restants | Tout : jours restants | Sortie estimée | Fourchette prudente |',
  '|---|---|---|---|---|',
  ...lignesHisto,
  '',
].join('\n')

writeFileSync(fichier, texte.slice(0, debut) + bloc + texte.slice(fin))
console.log(
  `Sortie : ${fr(sortieRestant)} j restants → ${dateFr(optimiste)} (prudent : ${dateFr(prudent)})`
)
