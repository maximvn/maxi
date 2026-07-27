# Whiteboard Integraal Capaciteitsmanagement

Uitwerking van de whiteboardsessie over de acute poort en de Hotfloor naar een
Word-document met visualisaties.

## Bestanden

| Bestand | Wat het is |
|---|---|
| `Integraal-Capaciteitsmanagement-whiteboard.docx` | Het eindresultaat |
| `figuren/` | De gegenereerde visualisaties (SVG + PNG) |
| `svg_lib.py` | Kleine SVG-helper (vormen, pijlen, tekst, kleurenpalet) |
| `figuren.py` | Tekent de tien figuren |
| `maak_document.py` | Bouwt het Word-document uit de figuren |

## Opnieuw genereren

```bash
pip install python-docx cairosvg
python3 figuren.py         # schrijft figuren/*.svg en *.png
python3 maak_document.py   # schrijft het .docx
```

Tekst aanpassen doe je in `figuren.py` (in de figuren) of in `maak_document.py`
(de lopende tekst), waarna je beide scripts opnieuw draait.
