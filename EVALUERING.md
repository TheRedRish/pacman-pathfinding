# Evaluering af algoritmer og datastruktur

## Formål

Formålet med denne evaluering er at sammenligne fire søgealgoritmer til spøgelserne i vores Pacman-projekt:

- Breadth-First Search (BFS)
- Depth-First Search (DFS)
- Dijkstra
- A\*

Evalueringen måler:

- Hvor gode algoritmerne er til at fange Pacman
- Hvor mange noder de besøger
- Deres gennemsnitlige køretid
- Hvordan Pacmans semitilfældige adfærd påvirker fangstraten

Benchmarkene er lavet som simuleringer, hvor Pacman bevæger sig semitilfældigt: 20 % tilfældige træk og 80 % jagt på nærmeste pellet.

## Testopstilling

### Simuleringsramme

- **Map:** `Custom 51x51 Labyrinth`
- **Pacman-adfærd:**
  - 20 % tilfældig retning
  - 80 % mod nærmeste pellet

### Målepunkter

- `catchRate`: andel fangster (maks 500 ticks)
- `avgTicksToCatch`: gennemsnitlige ticks til fangst
- `avgNodesVisited`: gennemsnitligt antal udforskede felter
- `avgTimeMs`: tid per søgning
- `trials`: antal simuleringer

### Fairness i simulatoren

I de første fire tests byttes der algoritme mellem spøgelserne, så alle får lige startpositioner.  
Derefter testes hver algoritme isoleret over 1000 simuleringer.

## Resultater (custom-map)

Single-algorithm tests med 1000 trials:

| Algoritme                | catchRate | avgTicksToCatch | avgNodesVisited | avgTimeMs |
| ------------------------ | --------- | --------------- | --------------- | --------- |
| **BFS**                  | 1.000     | 114.4           | 407.3           | 0.286     |
| **DFS**                  | 0.125     | 480.6           | 789.5           | 0.598     |
| **Dijkstra (vægtet)**    | 1.000     | 92.2            | 634.7           | 0.694     |
| **A\***                  | 1.000     | 92.4            | 129.6           | 0.155     |
| **Dijkstra – no weight** | 1.000     | 113.1           | 398.0           | 0.386     |
| **A\* – no weight**      | 1.000     | 115.5           | 151.1           | 0.162     |

### Analyse

- DFS klarer sig markant dårligst: lav fangstrate og højt antal besøgte noder.
- BFS er solid og finder Pacman, men undersøger store dele af banen.
- Dijkstra (vægtet) finder de billigste ruter, men er tung i køretid og node-udforskning.
- A\* giver de mest målrettede bevægelser, færrest besøgte noder og laveste køretid.

## Hvorfor DFS klarer sig dårligt

DFS’ dårlige fangstrate skyldes den måde algoritmen er implementeret på:

- Den udforsker naboer i **samme rækkefølge** ved hvert skridt.
- I et grid fører det ofte til **det samme mønster gentaget**, hvor spøgelset går ind i dead-ends.
- Det kan resultere i **uendelige loops**, hvor spøgelset går frem og tilbage mellem to eller få felter.

Denne deterministiske adfærd forklarer fangstraten på kun 12.5 % i single-tests og 0 % i flere af fairness-tests.

## Datastrukturer

- **Grid:** O(1) opslag for naboer; ikke flaskehals.
- **Kø (BFS):** enkel, bred søgning.
- **Stak (DFS):** fører til loops og ineffektiv jagt.
- **Prioritetskø (Dijkstra & A\*):** gør det muligt at styre søgning efter pris eller heuristik.

A\* udnytter prioritetskøen bedst, da heuristikken dirigerer søgningen direkte mod Pacman.

## Konklusion

- **DFS fravælges fuldstændigt:** loops, dårlig søgning, lav fangstrate.
- **BFS er acceptabel**, men ikke effektiv.
- **Dijkstra er korrekt ift. vægtede baner**, men for langsom til ren jagt.
- **A\*** er klart bedste valg:
  - Hurtigst
  - Færrest besøgte noder
  - Høj fangstrate
  - Mest intelligent bevægelse

Derfor anbefales A\* som primær algoritme i projektet.
