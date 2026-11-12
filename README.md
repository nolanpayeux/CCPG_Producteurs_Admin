# CCPG — WebSIG test + pilote d’administration sur Cloudflare Worker

## Ce que contient ce dépôt

- `public/` : Leaflet de test (routes sans liserés blancs, filtres communaux et groupes) et page `administration.html` ; fichiers publics.
- `src/worker.js` : Worker qui sert les fichiers et route `/api/*` vers les fonctions D1.
- `functions/api/` et `lib/` : API de propositions et validation, **authentification JWT Cloudflare Access vérifiée côté serveur**.
- `wrangler.jsonc` : configuration Worker + fichiers statiques ; **pas de liaison D1 déclarée tant que son ID n’est pas connu**.
- `sql/schema.sql` : tables D1 (déjà créées dans votre base).
- `scripts/` : import SQL des producteurs et téléchargement des contours communaux.

## Point important : contenu géographique manquant dans les archives initiales

La version cartographique reçue **ne contient pas** les fichiers téléchargés sur votre poste Windows :

- `public/data/routes_principales.geojson`
- `public/data/cours_eau.geojson`

**À copier impérativement** depuis `C:\\Users\\n.payeux\\Downloads\\...\\data\\` dans le nouveau dépôt GitHub sous les chemins ci-dessus. Le script Python seul ne remplace pas ces fichiers, et les routes/Gardon seront absents tant que ces GeoJSON ne sont pas publiés.

Le Gardon étendu n’est disponible que si la nouvelle extraction `python telecharger_couches.py --cours-eau` a réellement abouti : le dernier correctif JavaScript ne crée pas les géométries manquantes.

### Contours des communes

Par défaut, le code tente `public/data/perimetre_ccpg.geojson` et `public/data/communes_ccpg.geojson` puis **se replie sur geo.api.gouv.fr** si les fichiers locaux sont absents. La solution fiable est d’exécuter une seule fois :

```powershell
python scripts/telecharger_communes.py
```

Depuis la racine du dépôt extrait. Le script écrit ces deux fichiers dans `public/data/`. **Vérifier les contours dans QGIS**, puis commiter. Si l’API est momentanément indisponible, réessayer plus tard ou produire des GeoJSON équivalents dans QGIS avec les champs de commune `nom` et `code`.

## Vérifier après déploiement (très important)

Sur le domaine de test, ouvrir directement dans le navigateur :

- `/data/producteurs.geojson` : doit afficher une `FeatureCollection`.
- `/data/routes_principales.geojson` : doit afficher du JSON, **pas 404 ni HTML**.
- `/data/cours_eau.geojson` : doit afficher du JSON, **pas 404 ni HTML**.
- `/data/communes_ccpg.geojson` : idem ; utile pour ne plus dépendre de l’API externe.
- `/data/perimetre_ccpg.geojson` : idem.

Si un fichier n’est pas accessible, **le chemin GitHub est erroné ou son déploiement a échoué**. Pour la sélection communale, si les deux contours locaux manquent et `geo.api.gouv.fr` ne répond pas, le filtre ne peut pas fonctionner.

## Connecter Cloudflare D1 sur le Worker existant

1. Conserver le projet `ccpg-producteurs-admin` et son dépôt GitHub de test.
2. Placer les fichiers de cette archive **à la racine du dépôt**, dans les répertoires indiqués. Attention à ne pas recopier tout l’archive dans un sous-dossier supplémentaire.
3. Dans Cloudflare **Workers et Pages → ccpg-producteurs-admin → Paramètres / Build**, utiliser le déploiement Wrangler depuis Git si demandé. Commande de déploiement : `npx wrangler deploy`; installer les dépendances avec `npm install`/détection automatique. Ne pas rester sur un déploiement « actifs statiques uniquement » sans point d’entrée serveur.
4. Le Worker devra désormais afficher un script serveur `src/worker.js`. Dans **Liaisons → Ajouter → D1**, associer `ccpg-producteurs-pilote` sous le nom **`DB`**. Après ajout, synchroniser la configuration `wrangler.jsonc` du dépôt avec le `database_id` réel pour ne pas perdre la liaison au prochain déploiement :

```jsonc
"d1_databases": [
  { "binding": "DB", "database_name": "ccpg-producteurs-pilote", "database_id": "VOTRE_UUID_D1" }
]
```

   L’objet ci-dessus se place dans la racine JSON, à côté des clés `main` et `assets`. **Ne pas inventer l’UUID** : le copier depuis la page de la base D1 dans Cloudflare.
5. Créer une application Cloudflare Zero Trust Access protégeant `/administration.html` **et `/api/*`** et autoriser uniquement les adresses souhaitées. Le code API vérifie également le JWT avant tout accès aux données.
6. Configurer les variables Worker suivantes (en texte) :
   - `ACCESS_TEAM_DOMAIN` : domaine de votre équipe Access, ex. `https://votre-equipe.cloudflareaccess.com` (exemple uniquement).
   - `ACCESS_AUD` : *Application Audience Tag* de l’application Access.
   - `ADMIN_EMAIL` : votre adresse autorisée.
   - `EDITOR_EMAILS` : une ou plusieurs adresses, séparées par des virgules.
7. La base possède déjà les tables `published_features` et `proposals`. Pour importer une copie du GeoJSON dans **D1 pilote**, générer un SQL :

```powershell
python scripts/preparer_import_d1.py public/data/producteurs.geojson
```

   Lire le `sql/seed.sql` généré puis l’exécuter dans la console D1 ou via Wrangler. L’import est indépendant de la carte Leaflet publique.
8. Tester `/administration.html` avec un compte autorisé. L’API `/api/me` doit répondre pour cette session, mais être interdite sans authentification.

## Sécurité et limites

- Ce pilote **ne publie pas automatiquement les modifications D1 sur la carte** ; il conserve le GeoJSON public inchangé et teste uniquement soumission/approbation.
- L’interface Leaflet ne transmet pas encore les changements au pilote D1 : elle conserve son éditeur GeoJSON local. Utiliser `administration.html` pour les propositions.
- **Ne pas transmettre l’URL aux éditeurs avant validation complète de Cloudflare Access, des rôles et des permissions API.**
- Ne pas écraser le GeoJSON producteur du nouveau dépôt si vous l’avez déjà enrichi ; le fichier présent dans l’archive est une copie de base.
- Le Worker teste la vérification du JWT Access (`RS256`, certificat JWKS, audience, émetteur, expiration et e-mail), mais la configuration Cloudflare réelle doit encore être testée.

## Contrôles locaux

```powershell
npm install
npm run check
```

La syntaxe seule ne garantit pas que les services externes ou les permissions Cloudflare soient correctement configurés.
