# Traumhaus-Planer

Browserbasierter Einrichtungsplaner für Spielzeughäuser im bunten, runden Spielzeug-Look.
Gebaut mit **three.js**, **lit** und **TypeScript** (Vite).

## Starten

```bash
npm install
npm run dev      # Entwicklungsserver auf http://localhost:5173
npm run build    # statischer Build nach dist/
npm run check    # TypeScript-Prüfung
```

Direkt in ein Haus springen: `?haus=sonnenhaus`, `?haus=villa`, `?haus=strandhaus`.

## Was geht schon

- **Hausauswahl**: drei unmöblierte Häuser im Rohbau (Sonnenhaus, Villa Sternschnuppe mit zwei Etagen und Treppe, Strandhaus Muschel in L-Form). Häuser sind in `src/houses.ts` als Räume + Türen/Fenster beschrieben; Wände, Böden, Decken, Treppen und Dach werden daraus erzeugt (`src/houseBuilder.ts`).
- **Kameras**: Drohne (Orbit, Rundflug), Figur (Third-Person) und Ich-Sicht (First-Person). Laufen mit WASD/Pfeilen oder dem Steuerkreuz, Treppen funktionieren, Wände und Möbel blockieren.
- **Katalog** (`src/catalog.ts`, `src/textures.ts`): Böden, Wandbeläge, Decken, Wohnzimmer, Schlafzimmer, Küche, Bad, Kinderzimmer, Elektrogeräte, Deko, Garten – alles prozedural modelliert, mit Farbvarianten.
- **Einrichten**: Drag & Drop aus dem Katalog (Maus und Touch), Gegenstände direkt ziehen oder per Gizmo verschieben/drehen. Dinge lassen sich auf Tische/Schränke stellen und wandern mit. Wandobjekte (Bild, Spiegel, Uhr, Vorhang …) rasten an Wänden ein, Lampen an der Decke.
- **Kollision**: Wände sperren die Bewegung (Gegenstand wird herausgeschoben bzw. bleibt stehen), Überschneidungen mit anderen Gegenständen leuchten rot.
- **Ansicht**: Wände niedrig (Schnittansicht), Dach ein/aus, Etagen ausblenden.
- **Speichern**: automatisch pro Haus im `localStorage`.

## Aufbau

| Datei | Inhalt |
|---|---|
| `src/app.ts` | lit-Oberfläche (Hausauswahl, Katalog, Werkzeugleiste, Steuerkreuz) |
| `src/editor.ts` | three.js-Szene, Kameras, Platzieren, Gizmo, Kollision, Laufen, Speichern |
| `src/houseBuilder.ts` | erzeugt Hausgeometrie, Kollider, Bodenhöhe (Treppen) |
| `src/houses.ts` | Hausdefinitionen |
| `src/catalog.ts` | Möbel- und Deko-Modelle |
| `src/textures.ts` | prozedurale Boden-/Wand-/Deckentexturen |
| `src/figure.ts` | Spielfigur |
| `src/collision.ts` | Rechteck-Kollision (SAT) |
