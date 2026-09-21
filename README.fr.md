<p align="right"><a href="README.md">English</a></p>
<img src="assets/hero.svg" alt="TracePatch" width="100%">

# TracePatch

**Donnez à un agent un échec reproduit et un périmètre de code précis. Récupérez un patch accompagné des vérifications réellement exécutées.**

## Essayer la version 0.1

```sh
git clone https://github.com/elie-laloum/tracepatch.git
cd tracepatch
npm test
npm run demo
```

La démonstration corrige le calcul des quantités dans un panier. Les tests existants passent ensuite et le dépôt de départ reste intact.

## Utilisation et périmètre

Configurez un dépôt Git propre, les fichiers source autorisés, les commandes de test et un adaptateur. La démonstration utilise un adaptateur déterministe sans clé API. L’adaptateur Anthropic nécessite votre clé et un identifiant de modèle. Son contrat est testé, mais les performances de correction par modèle réel ne sont pas évaluées. Les commandes s’exécutent avec vos permissions locales.

[Configuration complète et contrat de l’API](README.md#use-it-on-your-project) · [Limites détaillées](README.md#boundaries) · [Contribuer](CONTRIBUTING.md)

La documentation technique de référence est en anglais. Cette traduction présente le démarrage et le périmètre de la version actuelle.

[GitLab origin](https://gitlab.elielaloum.com/elielaloum/tracepatch) · [GitHub mirror](https://github.com/elie-laloum/tracepatch)

Le dépôt GitLab privé contient la source de référence ; GitHub en est le miroir public.
