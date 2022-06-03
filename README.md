# IMMO DATA API

Ce projet permet le traitement, la manipulation, et l'exposition d'une API pour la gestion d'un certain nombres de données immobilières : 

- Géolocalisation des données [IRIS](https://www.data.gouv.fr/fr/datasets/contours-iris/)
- Géolocalisation des données de [Cadastre](https://cadastre.data.gouv.fr/datasets/cadastre-etalab)
- Géolocalisation des données [Sitadel](https://www.data.gouv.fr/fr/datasets/base-des-permis-de-construire-et-autres-autorisations-durbanisme-sitadel/)


Ce projet est initialement inspiré de https://github.com/BaseAdresseNationale/iris

## Installation

Ce projet a été testé avec **Node.js v12**

```bash
yarn
```

## IRIS

### Récupération des données

```bash 
$ cd data-iris
$ ./0-download.sh
```
### Génération des données

Les données sont récupérées depuis le FTP de l'IGN.

```bash
$ yarn run build-iris
```

Ce script va permettre de générer le fichier `dist/iris.json` qui sera employé : 

- pour la génération des données de **cadastre** géolocalisée
- pour la génération des données de **sitadel** géolocalisées
- pour l'API exposée

## Cadastre

### Récupération des données

Les données sont récupérées depuis https://cadastre.data.gouv.fr

```bash 
$ cd data-cadastre
$ ./0-download.sh
```
### Génération des données

```bash
$ yarn run build-cadastre
```

Ce script va permettre de générer les fichiers `dist/cadastre-{DEP}.json` ou {DEP} est le numéro du département.

**La gération des information de cadatre géolocalisée nécessite d'avoir le fichier `dist/iris.json` de présent**

Les fichier de cadastres seront utilisés : 

- pour la génération des données de **sitadel** géolocalisées
- pour l'API exposée

## SITADEL

### Récupération des données

Les données sont récupérées depuis  https://www.data.gouv.fr/api/1/datasets/5a5f4f6c88ee387da4d252a3

```bash 
$ cd data-sitadel
$ ./0-download.sh
```
### Génération des données

```bash
$ yarn run build-sitadel
```

Ce script va manipuler l'ensemble des fichiers CSV présents dans le dossier `data-sitadel` et créer des nouveaux fichier iris-{NOM_DU_FICHIER}.csv contenant une colonne supplémentaire : `CODE_IRIS`

**La gération des information de cadatre géolocalisée nécessite d'avoir les fichiers `dist/cadastre-{DEP}.json` de présent**

## Lancement de l'API

L'API nécessite 4 Go de mémoire vive disponible.

```bash
yarn start
```

Par défaut l'API écoute sur le port `5000`. Vous pouvez changer de port en utilisant la variable d'environnement `PORT`

## Documentation de l'API

### /cadastre

GET `/cadastre?dep={dep}&id={id}`

| Paramètre | Description |
| --- | --- |
| `dep` | Numéro de département |
| `id` | Numéro de parcelle |

Exemple : http://localhost:5000/cadastre?dep=01&id=01072000AC0367

Exemple de retour :

```json
[
  {
    "type": "Feature",
    "properties": {
      "id": "01072000AC0367",
      "codeCommune": "01072",
      "prefixe": "000",
      "section": "AC",
      "lon": 5.317502248995701,
      "lat": 46.18710030748923,
      "codeIris": "010720000"
    },
    "geometry": null
  }
]
```

### /cadastre-by-iris

GET `/cadastre-by-iris?dep={dep}&codeIris={codeIris}`

| Paramètre | Description |
| --- | --- |
| `dep` | Numéro de département |
| `codeIris` | Code IRIS |

Exemple : http://localhost:5000/cadastre-by-iris?dep=01&codeIris=020040000


### /iris-by-code

GET `/iris-by-code?codeIris={codeIris}

| Paramètre | Description |
| --- | --- |
| `codeIris` | Code IRIS |

Exemple : http://localhost:5000/cadastre-by-iris?codeIris=132010101

Exemple de retour :

```json
[
  {
    "type": "Feature",
    "properties": {
      "nomCommune": "Marseille 1er Arrondissement",
      "codeCommune": "13201",
      "iris": "0101",
      "codeIris": "132010101",
      "nomIris": "La Bourse",
      "typeIris": "A"
    },
    "geometry": {
      "type": "Polygon",
      "coordinates": []
    }
  }
]
```

GET `/iris?lon={longitude}&lat={latitude}&codeCommune={codeCommune}`

| Paramètre | Description |
| --- | --- |
| `lat` | Latitude du point (WGS-84) |
| `lon` | Longitude du point (WGS-84) |
| `codeCommune` | Code (INSEE) de la commune considérée |

Exemple : http://localhost:5000/iris?lon=6.14144&lat=49.14875&codeCommune=57415

Exemple de retour :

```json
{
  "nomCommune":"Lorry-lès-Metz",
  "codeCommune":"57415",
  "iris":"0000",
  "codeIris":"574150000",
  "nomIris":"Lorry-lès-Metz",
  "typeIris":"Z"
}
```

### Erreurs

En cas de requête mal formée, l'API retourne une erreur `400`.
Si aucun IRIS n'est trouvé, l'API retourne une erreur `404`.

## Licence

Le code est placé sous licence [MIT](LICENCE.md).
