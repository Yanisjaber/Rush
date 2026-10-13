# Archive de la v1 de Coach IA

Photo de l'appli juste **avant** la refonte (dernier commit avant le début de la nouvelle appli : `16859a3`, 12 octobre 2026).

- `code-source/` : le code complet de l'ancienne appli (JavaScript sans framework : `index.html`, `src/`, `styles/`, config, `serve.py`).
  Pour la relancer : `cd code-source && python3 serve.py` puis ouvrir http://localhost:8000 (le login Supabase n'autorise que `localhost:8000`).
- `schema_base_v1.sql` : le schéma de la base à cette époque (schéma de départ + 53 migrations dans l'ordre). **Aucune donnée.**

Cette archive n'est plus utilisée par l'appli : elle ne sert qu'à garder une trace. L'historique complet reste dans git (`git show 16859a3:index.html`, etc.).
Le tag `v1-avant-refonte` marque aussi ce commit.
