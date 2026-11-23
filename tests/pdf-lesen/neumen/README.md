# Versuch: Neumenformen per KI (23.11.2026)

Je System ein Bild (Ausschnitt aus dem Scan, zwei Hälften untereinander), die von der Geometrie gefundenen Notenköpfe
rot nummeriert. Die KI bestimmt je Nummer Form (Punctum, Virga, Quilisma, Liqueszenz, Oriscus, Rhombus), Episem,
Iktus und ♭ davor. Vergleich Note für Note mit dem Soll (Ausrichtung über die Tonhöhen).

- `systeme.json`: erkannte Notenköpfe der 8 Systeme (Gaudeamus 1, 3, 4; Salve Regina 5–9)
- `run.py SCRATCH MODELL EFFORT TAG`: Aufrufe (braucht die Bilder `SCRATCH/neu/<fall>-<k>.png`, aus den lokalen Scans
  erzeugt – nicht im Repo) und `NOTATOR_API_KEY`
- `score.py SCRATCH TAG`: Auswertung; `antworten/<tag>/`: die KI-Antworten

Ergebnis siehe `docs/pdf-lesen-plan.md`, Abschnitt 7.17.
