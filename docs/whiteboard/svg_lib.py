"""SVG-tekenlaag met echte tekstmeting.

Alle tekst wordt met PIL opgemeten voordat er getekend wordt, zodat regels
altijd binnen hun kader passen: eerst afbreken op woordgrens, en als het dan
nog niet past automatisch een maatje kleiner.
"""
import os
from functools import lru_cache

from PIL import ImageFont

FONT_DIR = "/usr/share/fonts/truetype/dejavu"
FONT_REGULAR = os.path.join(FONT_DIR, "DejaVuSans.ttf")
FONT_BOLD = os.path.join(FONT_DIR, "DejaVuSans-Bold.ttf")
# geen oblique-snede van DejaVu Sans geinstalleerd: meten met de gewone
# snede, de schuinstand komt van de renderer
FONT_OBLIEK = FONT_REGULAR
FAMILIE = "DejaVu Sans, Verdana, Arial, sans-serif"

# ----------------------------------------------------------------- palet
INK = "#0F1B2D"      # hoofdtekst
NAVY = "#123A63"     # donkerste accent
BLUE = "#1F6FB2"     # primair
TEAL = "#0E9A87"     # positief / gereed
AMBER = "#DE8A1B"    # aandacht / in te vullen
RED = "#C4392D"      # ontbreekt / past niet
PURPLE = "#6B4BA8"   # proces
SLATE = "#64748B"    # bijschrift
LINE = "#D8E0EA"     # scheidingslijn
BG = "#F4F7FB"       # figuurachtergrond
WIT = "#FFFFFF"


def licht(kleur, f=0.12):
    """Mengt een kleur met wit. f = aandeel van de kleur."""
    r, g, b = (int(kleur[i:i + 2], 16) for i in (1, 3, 5))
    r = round(255 + (r - 255) * f)
    g = round(255 + (g - 255) * f)
    b = round(255 + (b - 255) * f)
    return f"#{r:02X}{g:02X}{b:02X}"


def donker(kleur, f=0.82):
    r, g, b = (int(kleur[i:i + 2], 16) for i in (1, 3, 5))
    return f"#{round(r * f):02X}{round(g * f):02X}{round(b * f):02X}"


# ------------------------------------------------------------- meten
@lru_cache(maxsize=64)
def _font(size, gewicht):
    pad = {"bold": FONT_BOLD, "italic": FONT_OBLIEK}.get(gewicht, FONT_REGULAR)
    return ImageFont.truetype(pad, int(round(size)))


def meet(tekst, size, gewicht="normal", ls=0.0):
    """Breedte van een tekstregel in pixels."""
    if not tekst:
        return 0.0
    b = _font(size, gewicht).getbbox(tekst)
    return (b[2] - b[0]) + ls * max(0, len(tekst) - 1)


def afbreken(tekst, size, max_breedte, gewicht="normal", ls=0.0):
    """Breekt af op woordgrenzen; lange woorden worden hard geknipt."""
    regels, huidig = [], ""
    for woord in tekst.split():
        kandidaat = (huidig + " " + woord).strip()
        if meet(kandidaat, size, gewicht, ls) <= max_breedte or not huidig:
            if meet(kandidaat, size, gewicht, ls) > max_breedte and not huidig:
                rest = woord
                while meet(rest, size, gewicht, ls) > max_breedte and len(rest) > 1:
                    knip = len(rest)
                    while knip > 1 and meet(rest[:knip] + "-", size, gewicht, ls) > max_breedte:
                        knip -= 1
                    regels.append(rest[:knip] + "-")
                    rest = rest[knip:]
                huidig = rest
            else:
                huidig = kandidaat
        else:
            regels.append(huidig)
            huidig = woord
    if huidig:
        regels.append(huidig)
    return regels


def pas_in(tekst, max_breedte, size, min_size=12, gewicht="normal", ls=0.0):
    """Grootste lettergrootte <= size waarbij de tekst op een regel past."""
    s = size
    while s > min_size and meet(tekst, s, gewicht, ls) > max_breedte:
        s -= 0.5
    return s


def blok_hoogte(tekst, size, max_breedte, gewicht="normal", lh=1.35):
    return len(afbreken(tekst, size, max_breedte, gewicht)) * size * lh


def esc(s):
    return (str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


# --------------------------------------------------------------- canvas
class Svg:
    def __init__(self, w, h, bg=BG):
        self.w, self.h = w, h
        self.bg = bg
        self.parts = []
        self.markers = set()
        self.schaduw = False

    # ---- primitieven ----
    def rect(self, x, y, w, h, fill="none", stroke="none", sw=2, rx=12,
             dash=None, op=1, schaduw=False):
        d = f' stroke-dasharray="{dash}"' if dash else ""
        f = ' filter="url(#kaartschaduw)"' if schaduw else ""
        if schaduw:
            self.schaduw = True
        self.parts.append(
            f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" '
            f'rx="{rx}" ry="{rx}" fill="{fill}" fill-opacity="{op}" stroke="{stroke}" '
            f'stroke-width="{sw}"{d}{f}/>'
        )

    def line(self, x1, y1, x2, y2, stroke=LINE, sw=2, dash=None):
        d = f' stroke-dasharray="{dash}"' if dash else ""
        self.parts.append(
            f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" '
            f'stroke="{stroke}" stroke-width="{sw}" stroke-linecap="round"{d}/>')

    def path(self, d, stroke=INK, sw=2, fill="none", dash=None, marker=None):
        ds = f' stroke-dasharray="{dash}"' if dash else ""
        mk = ""
        if marker:
            self.markers.add(marker)
            mk = f' marker-end="url(#pijl-{marker.lstrip("#")})"'
        self.parts.append(
            f'<path d="{d}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" '
            f'stroke-linecap="round" stroke-linejoin="round"{ds}{mk}/>')

    def circle(self, cx, cy, r, fill="none", stroke="none", sw=2):
        self.parts.append(
            f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r}" fill="{fill}" '
            f'stroke="{stroke}" stroke-width="{sw}"/>')

    def text(self, x, y, s, size=24, fill=INK, anchor="start", gewicht="normal", ls=0):
        stijl = ' font-style="italic"' if gewicht == "italic" else ""
        vet = ' font-weight="bold"' if gewicht == "bold" else ""
        self.parts.append(
            f'<text x="{x:.1f}" y="{y:.1f}" font-family="{FAMILIE}" font-size="{size}" '
            f'fill="{fill}" text-anchor="{anchor}"{vet}{stijl} '
            f'letter-spacing="{ls}">{esc(s)}</text>')

    # ---- tekst met meting ----
    def tekst_passend(self, x, y, breedte, s, size=24, fill=INK, anchor="start",
                      gewicht="normal", min_size=12, ls=0):
        """Een regel die gegarandeerd binnen `breedte` blijft."""
        s2 = pas_in(s, breedte, size, min_size, gewicht, ls)
        self.text(x, y, s, s2, fill, anchor, gewicht, ls)
        return s2

    def alinea(self, x, y, breedte, s, size=22, fill=INK, anchor="start",
               gewicht="normal", lh=1.38):
        """Afgebroken tekstblok. Geeft de onderkant terug."""
        regels = afbreken(s, size, breedte, gewicht)
        for i, r in enumerate(regels):
            self.text(x, y + i * size * lh, r, size, fill, anchor, gewicht)
        return y + (len(regels) - 1) * size * lh

    def regels(self, x, y, items, size=22, fill=INK, anchor="start",
               gewicht="normal", lh=1.38):
        for i, s in enumerate(items):
            self.text(x, y + i * size * lh, s, size, fill, anchor, gewicht)
        return y + (len(items) - 1) * size * lh

    def bullets(self, x, y, breedte, items, size=21, fill=INK, kleur=BLUE,
                lh=1.35, gap=12, inspring=26):
        """Opsomming met bolletjes; elke regel breekt netjes af."""
        cy = y
        for item in items:
            regels = afbreken(item, size, breedte - inspring, "normal")
            self.circle(x + 6, cy - size * 0.32, 4.5, fill=kleur)
            for i, r in enumerate(regels):
                self.text(x + inspring, cy + i * size * lh, r, size, fill)
            cy += len(regels) * size * lh + gap
        return cy - gap

    # ---- samengestelde vormen ----
    def pijl(self, x1, y1, x2, y2, stroke=INK, sw=3):
        self.path(f"M {x1:.1f} {y1:.1f} L {x2:.1f} {y2:.1f}", stroke=stroke, sw=sw,
                  marker=stroke)

    def kaart(self, x, y, w, h, kleur=BLUE, fill=WIT, rand=True, rx=14, sw=2):
        self.rect(x, y, w, h, fill=fill, stroke=kleur if rand else "none", sw=sw,
                  rx=rx, schaduw=True)

    def kaartkop(self, x, y, w, tekst, kleur, h=52, size=22, ls=0.6):
        """Volvlak titelbalk bovenin een kaart."""
        self.rect(x, y, w, h, fill=kleur, stroke="none", rx=14)
        self.rect(x, y + h - 16, w, 16, fill=kleur, stroke="none", rx=0)
        s = pas_in(tekst, w - 40, size, 14, "bold", ls)
        self.text(x + w / 2, y + h / 2 + s * 0.36, tekst, s, WIT, "middle", "bold", ls)
        return y + h

    def pil(self, x, y, w, h, label, fill, stroke, kleur=None, size=22,
            gewicht="bold"):
        self.rect(x, y, w, h, fill=fill, stroke=stroke, sw=2, rx=h / 2)
        s = pas_in(label, w - 28, size, 12, gewicht)
        self.text(x + w / 2, y + h / 2 + s * 0.35, label, s, kleur or stroke,
                  "middle", gewicht)

    def penning(self, cx, cy, r, label, fill, kleur=WIT, size=None):
        self.circle(cx, cy, r, fill=fill)
        s = size or r * 1.05
        self.text(cx, cy + s * 0.35, label, s, kleur, "middle", "bold")

    def stip(self, cx, cy, kleur, r=8):
        self.circle(cx, cy, r + 3, fill=licht(kleur, 0.22))
        self.circle(cx, cy, r - 1, fill=kleur)

    # ---- render ----
    def render(self):
        defs = ['<defs>']
        if self.schaduw:
            defs.append('<filter id="kaartschaduw" x="-20%" y="-20%" width="140%" '
                        'height="140%"><feDropShadow dx="0" dy="2" stdDeviation="4" '
                        'flood-color="#0F1B2D" flood-opacity="0.10"/></filter>')
        for c in sorted(self.markers):
            mid = c.lstrip("#")
            defs.append(
                f'<marker id="pijl-{mid}" viewBox="0 0 10 10" refX="8.5" refY="5" '
                f'markerWidth="5.5" markerHeight="5.5" orient="auto-start-reverse">'
                f'<path d="M 0 0.6 L 9.4 5 L 0 9.4 z" fill="{c}"/></marker>')
        defs.append('</defs>')
        return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}" '
                f'height="{self.h}" viewBox="0 0 {self.w} {self.h}">'
                + "".join(defs)
                + f'<rect width="{self.w}" height="{self.h}" fill="{self.bg}"/>'
                + "".join(self.parts) + "</svg>")

    def save(self, pad):
        with open(pad, "w", encoding="utf-8") as f:
            f.write(self.render())
        return pad
