<p align="center"><a href="README.md">English</a> · <strong>Français</strong></p>

<p align="center"><img src="assets/hero.fr.svg" alt="TracePatch — Du test en échec au correctif vérifiable." width="100%"></p>

# TracePatch

**D'un test en échec à un correctif que vous pouvez vérifier.**

Un workflow agentique open source conçu pour reproduire un échec, en rechercher la cause et restituer un correctif ciblé accompagné des vérifications effectuées.

> **En développement.** Ce dépôt contient la spécification et la documentation initiales. Aucune version exécutable n’est encore publiée.


**Dépôt d’origine : [GitLab](https://gitlab.elielaloum.com/elielaloum/tracepatch)** · [Miroir public GitHub](https://github.com/elie-laloum/tracepatch). Le dépôt GitLab est privé ; son accès nécessite une autorisation. Les modifications du code sont intégrées dans GitLab puis synchronisées vers GitHub.


## Le problème quotidien

Un test passe au rouge. Vous naviguez entre le journal, le code et les tentatives de reproduction pour comprendre ce qui a changé. TracePatch vise à mener cette investigation jusqu'à un résultat examinable.

## Le workflow prévu

```text
Test en échec → Reproduction → Investigation → Correctif ciblé → Contrôles → Rapport
```

L'agent doit travailler dans une copie isolée du dépôt, avec un nombre limité de tentatives et des observations conservées. S'il ne reproduit pas l'échec, il doit le signaler. Un test vert est un élément de preuve, pas une garantie de correction totale.

## Périmètre initial

| Entrée | Travail | Sortie |
|---|---|---|
| Projet npm/Vitest local et commande de test explicite | Reproduire, examiner, modifier, vérifier | Patch, journaux, révision initiale, empreinte du résultat et rapport |

Commencer par une CLI locale et un adaptateur de modèle documenté. Ajouter les journaux GitHub Actions lorsque le workflow local est fiable. L'accès au modèle peut avoir un coût distinct ; le rapport doit rendre son usage visible.

## La démonstration à livrer

Une petite application avec une régression connue : reproduire l'échec, corriger, relancer le test ciblé et les vérifications convenues, puis examiner le patch exporté. Distinguer la démo déterministe du moteur et les évaluations avec un vrai modèle.

## Conditions de publication

- Distinguer les échecs de test, les erreurs d'environnement et les cas non reproductibles.
- Ne pas supprimer ou désactiver les tests existants pour annoncer un succès.
- Montrer les tentatives échouées et les budgets épuisés.
- Vérifier l'installation et les commandes depuis un environnement propre.

## Contribuer au projet

Premières contributions utiles : exemples minimaux de bugs, retours sur les rapports et adaptateurs de tests. Les instructions d'installation, la démo enregistrée et les coordonnées du paquet seront ajoutées après vérification.


---

[Feuille de route](ROADMAP.md) · [Contribuer](CONTRIBUTING.md) · [Licence MIT](LICENSE)
