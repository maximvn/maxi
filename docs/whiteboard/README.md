# Acute poort en Hotfloor

Uitwerking van de whiteboardsessie tot een visueel document: twaalf platen die
elk op zichzelf te lezen zijn, met korte tekst eromheen.

## Bestanden

| Bestand | Wat het is |
|---|---|
| `Acute-poort-en-Hotfloor.docx` | Het eindresultaat |
| `figuren/` | De twaalf visualisaties (SVG + PNG) |
| `svg_lib.py` | Tekenlaag met echte tekstmeting (PIL) en het kleurenpalet |
| `figuren.py` | Tekent de twaalf figuren |
| `maak_document.py` | Bouwt het Word-document uit de figuren |

## Waarom tekst altijd past

`svg_lib.py` meet elke regel met PIL op tegen de werkelijke letters voordat er
getekend wordt. Een regel wordt eerst op woordgrens afgebroken; past hij dan nog
niet, dan wordt de lettergrootte stapsgewijs verkleind tot hij wel past. Daardoor
kan tekst niet buiten een kaart of kolom vallen.

## Opnieuw genereren

```bash
pip install python-docx cairosvg pillow
python3 figuren.py         # schrijft figuren/*.svg en *.png
python3 maak_document.py   # schrijft het .docx
```

Inhoud aanpassen doe je in `figuren.py` (in de platen) of in `maak_document.py`
(de lopende tekst en de vragenlijsten), waarna je beide scripts opnieuw draait.

## PowerPoint

`Acute-poort-en-Hotfloor.pptx` bevat dezelfde inhoud als 23 dia's. Alles is
opgebouwd uit echte PowerPoint-vormen, tekstkaders en tabellen, dus je kunt in
PowerPoint elke tekst selecteren en aanpassen, en rijen of kolommen toevoegen.

| Bestand | Wat het is |
|---|---|
| `Acute-poort-en-Hotfloor.pptx` | De presentatie |
| `pptx_lib.py` | Vormen, tekstkaders en tabellen, met tekstmeting vooraf |
| `maak_presentatie.py` | Bouwt de 23 dia's |
| `preview.py` | Rendert de dia's naar `preview/` om de opmaak te controleren |

```bash
pip install python-pptx
python3 maak_presentatie.py
python3 preview.py          # controleert op overloop en tekent de dia's
```

LibreOffice draait niet in deze omgeving, dus `preview.py` tekent de dia's zelf
uit de pptx-geometrie en meldt tekst die niet in zijn kader past.
