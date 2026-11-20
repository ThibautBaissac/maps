# La voix d'une carte

Une voix est un narrateur : quelqu'un de précis qui raconte le sujet, pas un adjectif (« un médecin-enquêteur de 1855 », pas « un ton sérieux »). Elle s'accorde d'abord au sujet, puis au style graphique : une gravure appelle un rapport d'époque, un cyanotype des notes d'atelier, une risographie un fanzine.

## Ce qu'elle couvre

| Dans la voix | Au ton neutre du site |
|---|---|
| `question` (`src/i18n/maps/<id>.ts`) : le titre de la page et de la carte dans la galerie | `metric`, `legend`, `method`, `limits` du sujet (`src/topics/<sujet>/messages.ts`) |
| `intro` (`src/i18n/maps/<id>.ts`) : deux ou trois phrases avant les mesures | phrases de concentration, détails des repères, textes d'interface |

La méthode et les limites restent sobres : c'est ce qui rend le récit crédible.

## Les interdits

- La voix change le ton, jamais les faits. Elle n'ajoute aucune affirmation, aucun chiffre, aucune date que les données, la méthode ou une source citée ne portent pas.
- Pas de citation inventée ni de pastiche attribué à une personne réelle.
- Pas d'ironie ni de légèreté sur les morts, la maladie, la misère ou la violence.
- La question reste une vraie question, compréhensible sans contexte : elle sert aussi de titre et de nom accessible de la carte.
- Chaque langue reçoit un texte écrit dans la voix, pas une traduction mot à mot. Définis la voix par son intention, pas par des tics propres à une langue.

## Modèle de fiche : `voices/<id>.md`

```markdown
# Voix — <titre de la carte>

**Narrateur** : qui parle, d'où, à quelle époque.
**Destinataire** : à qui il s'adresse (vous, tu, impersonnel) et avec quelle complicité.
**Registre et rythme** : longueur des phrases, temps verbal, place des chiffres.
**Vocabulaire** : 5 à 10 mots à privilégier ; mots à éviter.
**Interdits propres au sujet** : en plus des règles communes.
**Accord avec le style** : ce qui, dans la voix, répond au style graphique.

## Phrases d'essai

- fr : …
- en : …
- es : …
- pt : … (portugais européen)
- de : …
```

Une fiche tient en 10 à 15 lignes. Si elle déborde, la voix n'est pas encore trouvée.
