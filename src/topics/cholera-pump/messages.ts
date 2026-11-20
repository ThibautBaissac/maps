// The texts of the cholera-pump subject in every language. metric, legend, method and limits are
// its facts and method in the plain house style, shared by every map of it (TopicFacts);
// the other strings serve its panel, its legend and its text description.
import type { Locale } from '../../i18n/types.ts';
import type { TopicFacts } from '../types.ts';

export interface CholeraMessages extends TopicFacts {
  broadPump: string;
  deaths: (count: number) => string;
  concentration: (share: string, within100: string) => string;
  distribution: string;
  distributionHelp: string;
  pumpDetail: (broad: string, within100: string) => string;
  workhouse: string;
  workhouseDetail: string;
  brewery: string;
  breweryDetail: string;
  source: string;
  /** Short legend labels drawn on the map. */
  legendDeaths: string;
  legendBroad: string;
  legendPump: string;
}

export const MESSAGES: Record<Locale, CholeraMessages> = {
  fr: {
    metric: 'décès plus proches à pied de la pompe de Broad Street que de toute autre pompe',
    legend: 'Disques proportionnels : décès par lieu, en encre rouge quand la pompe la plus proche à pied est celle de Broad Street. Cercles à croix : pompes de 1854, la plus grande pour Broad Street. Cercles numérotés : repères. Les rues et le bâti actuels servent de contexte.',
    method: 'Les barres noires de la carte de Snow ont été détectées par traitement d’image (épaisseur d’encre), puis comptées par surface. Chaque groupe de barres est placé au point de rue OSM le plus proche, qui approche son adresse. Les 13 pompes sont relevées à la main. La carte est calée sur quatre repères (Golden Square, Soho Square, Oxford Circus, Broadwick × Lexington Street), avec un écart quadratique moyen de 1,7 m sur ces repères. Les distances suivent le réseau piéton OSM actuel.',
    limits: 'Cette numérisation compte 556 décès, contre 578 barres dans celle de Tobler (1992) : quelques barres fusionnées ou effacées restent mal comptées. Un point peut réunir deux adresses voisines. Les rues ont changé depuis 1854 (Regent Street, Shaftesbury Avenue, passages modernes) : la distance à pied est une approximation. La carte ne montre que les décès recensés par Snow, pas les malades.',
    broadPump: 'Pompe de Broad Street',
    deaths: (count) => `${count} décès`,
    concentration: (share, within100) => `${share} % des décès recensés par Snow sont plus proches à pied de la pompe de Broad Street que de toute autre pompe ; ${within100} sont à moins de 100 m de marche.`,
    distribution: 'Décès par pompe la plus proche à pied',
    distributionHelp: 'Chaque point de décès est rattaché à la pompe qu’on atteint par le plus court trajet à pied dans les rues actuelles. Sauf celle de Broad Street, chaque pompe porte le nom de la rue actuelle la plus proche.',
    pumpDetail: (broad, within100) => `${broad} décès plus proches de cette pompe que de toute autre ; ${within100} à moins de 100 m de marche. La poignée est retirée le 8 septembre 1854.`,
    workhouse: 'Workhouse de Poland Street',
    workhouseDetail: 'Snow y compte 5 décès pour 535 pensionnaires, alors que les maisons voisines sont touchées : l’établissement avait son propre puits.',
    brewery: 'Brasserie de Broad Street',
    breweryDetail: 'Selon Snow, aucun des plus de 70 ouvriers n’est mort : ils buvaient de la bière ou l’eau du puits de la brasserie, jamais celle de la pompe.',
    source: 'Décès et pompes numérisés pour ce site sur la carte de John Snow (On the Mode of Communication of Cholera, 1855, domaine public), puis recalés sur les rues OSM.',
    legendDeaths: 'Décès par lieu',
    legendBroad: 'Plus proche de Broad Street',
    legendPump: 'Pompe de 1854',
  },
  en: {
    metric: 'deaths closer on foot to the Broad Street pump than to any other pump',
    legend: 'Proportional discs: deaths per location, in red ink when the closest pump on foot is Broad Street. Circles with a cross: pumps of 1854, the largest for Broad Street. Numbered circles: references. Today’s streets and buildings give context.',
    method: 'The black bars of Snow’s map were detected by image processing (ink thickness), then counted by area. Each group of bars is placed at the closest point on an OSM street, which approximates its address. The 13 pumps were read by hand. The map is fitted on four references (Golden Square, Soho Square, Oxford Circus, Broadwick × Lexington Street) with a root-mean-square error of 1.7 m on these references. Distances follow today’s OSM walking network.',
    limits: 'This digitisation counts 556 deaths, against 578 bars in Tobler’s 1992 digitisation: a few merged or faded bars remain miscounted. One location may combine two neighbouring addresses. Streets have changed since 1854 (Regent Street, Shaftesbury Avenue, modern passages): the walking distance is an approximation. The map only shows the deaths Snow recorded, not the sick.',
    broadPump: 'Broad Street pump',
    deaths: (count) => `${count} ${count === 1 ? 'death' : 'deaths'}`,
    concentration: (share, within100) => `${share}% of the deaths Snow recorded are closer on foot to the Broad Street pump than to any other pump; ${within100} lie within a 100 m walk.`,
    distribution: 'Deaths by closest pump on foot',
    distributionHelp: 'Each death location goes to the pump reached by the shortest walk along today’s streets. Except for Broad Street, each pump is named after the closest street today.',
    pumpDetail: (broad, within100) => `${broad} deaths closer to this pump than to any other; ${within100} within a 100 m walk. Its handle was removed on 8 September 1854.`,
    workhouse: 'Poland Street workhouse',
    workhouseDetail: 'Snow counted 5 deaths among 535 inmates while the surrounding houses were struck: the workhouse had its own well.',
    brewery: 'Broad Street brewery',
    breweryDetail: 'According to Snow, none of its more than 70 workmen died: they drank beer or water from the brewery’s own well, never from the pump.',
    source: 'Deaths and pumps digitised for this site from John Snow’s map (On the Mode of Communication of Cholera, 1855, public domain), then fitted to the OSM streets.',
    legendDeaths: 'Deaths per location',
    legendBroad: 'Closest to Broad Street',
    legendPump: 'Pump of 1854',
  },
  es: {
    metric: 'muertes más cerca a pie de la bomba de Broad Street que de cualquier otra bomba',
    legend: 'Discos proporcionales: muertes por lugar, en tinta roja cuando la bomba más cercana a pie es la de Broad Street. Círculos con cruz: bombas de 1854, la mayor para Broad Street. Círculos numerados: referencias. Las calles y edificios actuales sirven de contexto.',
    method: 'Las barras negras del mapa de Snow se detectaron por tratamiento de imagen (grosor de tinta) y se contaron por superficie. Cada grupo de barras se sitúa en el punto más cercano de una calle OSM, que se aproxima a su dirección. Las 13 bombas se leyeron a mano. El mapa se ajusta con cuatro referencias (Golden Square, Soho Square, Oxford Circus, Broadwick × Lexington Street), con un error cuadrático medio de 1,7 m en estas referencias. Las distancias siguen la red peatonal actual de OSM.',
    limits: 'Esta digitalización cuenta 556 muertes, frente a 578 barras en la de Tobler (1992): algunas barras fusionadas o borrosas siguen mal contadas. Un punto puede reunir dos direcciones vecinas. Las calles han cambiado desde 1854 (Regent Street, Shaftesbury Avenue, pasajes modernos): la distancia a pie es una aproximación. El mapa solo muestra las muertes registradas por Snow, no los enfermos.',
    broadPump: 'Bomba de Broad Street',
    deaths: (count) => `${count} ${count === 1 ? 'muerte' : 'muertes'}`,
    concentration: (share, within100) => `El ${share} % de las muertes registradas por Snow está más cerca a pie de la bomba de Broad Street que de cualquier otra; ${within100} están a menos de 100 m andando.`,
    distribution: 'Muertes por bomba más cercana a pie',
    distributionHelp: 'Cada punto de muertes se asigna a la bomba a la que se llega por el trayecto a pie más corto en las calles actuales. Salvo la de Broad Street, cada bomba lleva el nombre de la calle actual más cercana.',
    pumpDetail: (broad, within100) => `${broad} muertes más cerca de esta bomba que de cualquier otra; ${within100} a menos de 100 m andando. Su manivela se retiró el 8 de septiembre de 1854.`,
    workhouse: 'Asilo de Poland Street',
    workhouseDetail: 'Snow contó 5 muertes entre 535 internos, mientras las casas vecinas sufrían la epidemia: el asilo tenía su propio pozo.',
    brewery: 'Cervecería de Broad Street',
    breweryDetail: 'Según Snow, ninguno de sus más de 70 obreros murió: bebían cerveza o agua del pozo de la cervecería, nunca de la bomba.',
    source: 'Muertes y bombas digitalizadas para este sitio a partir del mapa de John Snow (On the Mode of Communication of Cholera, 1855, dominio público) y ajustadas a las calles de OSM.',
    legendDeaths: 'Muertes por lugar',
    legendBroad: 'Más cerca de Broad Street',
    legendPump: 'Bomba de 1854',
  },
  pt: {
    metric: 'mortes mais perto, a pé, da bomba de Broad Street do que de qualquer outra bomba',
    legend: 'Discos proporcionais: mortes por local, a tinta vermelha quando a bomba mais próxima a pé é a de Broad Street. Círculos com cruz: bombas de 1854, a maior para Broad Street. Círculos numerados: referências. As ruas e edifícios atuais servem de contexto.',
    method: 'As barras pretas do mapa de Snow foram detetadas por tratamento de imagem (espessura da tinta) e contadas por superfície. Cada grupo de barras é colocado no ponto mais próximo de uma rua OSM, que se aproxima da sua morada. As 13 bombas foram lidas à mão. O mapa é ajustado com quatro referências (Golden Square, Soho Square, Oxford Circus, Broadwick × Lexington Street), com um erro quadrático médio de 1,7 m nessas referências. As distâncias seguem a rede pedonal atual do OSM.',
    limits: 'Esta digitalização conta 556 mortes, contra 578 barras na de Tobler (1992): algumas barras fundidas ou desfocadas continuam mal contadas. Um ponto pode reunir duas moradas vizinhas. As ruas mudaram desde 1854 (Regent Street, Shaftesbury Avenue, passagens modernas): a distância a pé é uma aproximação. O mapa mostra apenas as mortes registadas por Snow, não os doentes.',
    broadPump: 'Bomba de Broad Street',
    deaths: (count) => `${count} ${count === 1 ? 'morte' : 'mortes'}`,
    concentration: (share, within100) => `${share} % das mortes registadas por Snow estão mais perto, a pé, da bomba de Broad Street do que de qualquer outra; ${within100} ficam a menos de 100 m a pé.`,
    distribution: 'Mortes pela bomba mais próxima a pé',
    distributionHelp: 'Cada ponto de mortes é atribuído à bomba que se alcança pelo percurso a pé mais curto nas ruas atuais. Exceto a de Broad Street, cada bomba tem o nome da rua atual mais próxima.',
    pumpDetail: (broad, within100) => `${broad} mortes mais perto desta bomba do que de qualquer outra; ${within100} a menos de 100 m a pé. A manivela foi retirada a 8 de setembro de 1854.`,
    workhouse: 'Asilo de Poland Street',
    workhouseDetail: 'Snow contou 5 mortes entre 535 internados, enquanto as casas vizinhas sofriam a epidemia: o asilo tinha o seu próprio poço.',
    brewery: 'Cervejaria de Broad Street',
    breweryDetail: 'Segundo Snow, nenhum dos seus mais de 70 operários morreu: bebiam cerveja ou água do poço da cervejaria, nunca da bomba.',
    source: 'Mortes e bombas digitalizadas para este site a partir do mapa de John Snow (On the Mode of Communication of Cholera, 1855, domínio público) e ajustadas às ruas do OSM.',
    legendDeaths: 'Mortes por local',
    legendBroad: 'Mais perto de Broad Street',
    legendPump: 'Bomba de 1854',
  },
  de: {
    metric: 'Todesfälle zu Fuß näher an der Pumpe in der Broad Street als an jeder anderen Pumpe',
    legend: 'Proportionale Scheiben: Todesfälle je Ort, in roter Tinte, wenn die Pumpe in der Broad Street zu Fuß am nächsten liegt. Kreise mit Kreuz: Pumpen von 1854, die größte für die Broad Street. Nummerierte Kreise: Orientierungspunkte. Heutige Straßen und Gebäude dienen als Kontext.',
    method: 'Die schwarzen Balken auf Snows Karte wurden per Bildverarbeitung (Tintenstärke) erkannt und nach Fläche gezählt. Jede Balkengruppe sitzt am nächsten Punkt einer OSM-Straße, der ihrer Adresse nahekommt. Die 13 Pumpen wurden von Hand abgelesen. Die Karte ist an vier Passpunkten ausgerichtet (Golden Square, Soho Square, Oxford Circus, Broadwick × Lexington Street), mit einem mittleren quadratischen Fehler von 1,7 m an diesen Punkten. Die Entfernungen folgen dem heutigen OSM-Fußwegnetz.',
    limits: 'Diese Digitalisierung zählt 556 Todesfälle, gegenüber 578 Balken bei Tobler (1992): Einige verschmolzene oder unscharfe Balken bleiben falsch gezählt. Ein Punkt kann zwei benachbarte Adressen vereinen. Die Straßen haben sich seit 1854 verändert (Regent Street, Shaftesbury Avenue, moderne Passagen): Der Fußweg ist eine Annäherung. Die Karte zeigt nur die von Snow verzeichneten Todesfälle, nicht die Erkrankten.',
    broadPump: 'Pumpe in der Broad Street',
    deaths: (count) => `${count} ${count === 1 ? 'Todesfall' : 'Todesfälle'}`,
    concentration: (share, within100) => `${share} % der von Snow verzeichneten Todesfälle liegen zu Fuß näher an der Pumpe in der Broad Street als an jeder anderen; ${within100} weniger als 100 m Fußweg entfernt.`,
    distribution: 'Todesfälle nach nächster Pumpe zu Fuß',
    distributionHelp: 'Jeder Punkt wird der Pumpe zugeordnet, die über den kürzesten Fußweg in den heutigen Straßen erreichbar ist. Außer der in der Broad Street trägt jede Pumpe den Namen der nächstgelegenen heutigen Straße.',
    pumpDetail: (broad, within100) => `${broad} Todesfälle näher an dieser Pumpe als an jeder anderen; ${within100} weniger als 100 m Fußweg entfernt. Ihr Schwengel wurde am 8. September 1854 abgenommen.`,
    workhouse: 'Armenhaus in der Poland Street',
    workhouseDetail: 'Snow zählte 5 Todesfälle unter 535 Insassen, während die Nachbarhäuser von der Seuche getroffen wurden: Das Armenhaus hatte einen eigenen Brunnen.',
    brewery: 'Brauerei in der Broad Street',
    breweryDetail: 'Laut Snow starb keiner ihrer über 70 Arbeiter: Sie tranken Bier oder Wasser aus dem Brunnen der Brauerei, nie von der Pumpe.',
    source: 'Todesfälle und Pumpen für diese Website aus John Snows Karte digitalisiert (On the Mode of Communication of Cholera, 1855, gemeinfrei) und an die OSM-Straßen angepasst.',
    legendDeaths: 'Todesfälle je Ort',
    legendBroad: 'Näher an der Broad Street',
    legendPump: 'Pumpe von 1854',
  },
};
