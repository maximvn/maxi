"""Kleine SVG-helper voor het tekenen van de whiteboard-visualisaties."""

FONT = "DejaVu Sans, Arial, Helvetica, sans-serif"

# Kleurenpalet, afgeleid van de stiftkleuren op het bord
BLUE = "#1F5FA8"
BLUE_L = "#E8F0FA"
BLUE_M = "#4E86C6"
PURPLE = "#6B3FA0"
PURPLE_L = "#F0EAF8"
GREEN = "#0E9A87"
GREEN_L = "#E4F6F3"
ORANGE = "#D2691E"
ORANGE_L = "#FBEEE3"
GREY = "#5A6472"
GREY_L = "#F2F4F7"
INK = "#1B2430"
RED = "#C0392B"
RED_L = "#FBEAE8"


def esc(s):
    return (str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


class Svg:
    def __init__(self, w, h, bg="#FFFFFF"):
        self.w, self.h = w, h
        self.parts = []
        self.markers = set()
        self.bg = bg

    # ---------- primitieven ----------
    def rect(self, x, y, w, h, fill="none", stroke="none", sw=2, rx=10, dash=None, op=1):
        d = f' stroke-dasharray="{dash}"' if dash else ""
        self.parts.append(
            f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" ry="{rx}" '
            f'fill="{fill}" fill-opacity="{op}" stroke="{stroke}" stroke-width="{sw}"{d}/>'
        )

    def line(self, x1, y1, x2, y2, stroke=INK, sw=2, dash=None):
        d = f' stroke-dasharray="{dash}"' if dash else ""
        self.parts.append(
            f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{stroke}" '
            f'stroke-width="{sw}" stroke-linecap="round"{d}/>'
        )

    def path(self, d, stroke=INK, sw=2, fill="none", dash=None, marker=None):
        ds = f' stroke-dasharray="{dash}"' if dash else ""
        mk = ""
        if marker:
            self.markers.add(marker)
            mk = f' marker-end="url(#arrow-{marker.lstrip("#")})"'
        self.parts.append(
            f'<path d="{d}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" '
            f'stroke-linecap="round" stroke-linejoin="round"{ds}{mk}/>'
        )

    def circle(self, cx, cy, r, fill="none", stroke="none", sw=2):
        self.parts.append(
            f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>'
        )

    def text(self, x, y, s, size=28, fill=INK, anchor="start", weight="normal",
             style="normal", ls=0):
        self.parts.append(
            f'<text x="{x}" y="{y}" font-family="{FONT}" font-size="{size}" '
            f'fill="{fill}" text-anchor="{anchor}" font-weight="{weight}" '
            f'font-style="{style}" letter-spacing="{ls}">{esc(s)}</text>'
        )

    def lines(self, x, y, items, size=28, fill=INK, anchor="start", weight="normal",
              lh=1.35, style="normal"):
        step = size * lh
        for i, s in enumerate(items):
            self.text(x, y + i * step, s, size, fill, anchor, weight, style)

    # ---------- samengestelde vormen ----------
    def arrow(self, x1, y1, x2, y2, stroke=INK, sw=3):
        self.path(f"M {x1} {y1} L {x2} {y2}", stroke=stroke, sw=sw, marker=stroke)

    def elbow(self, x1, y1, x2, y2, stroke=INK, sw=3):
        """Rechthoekige verbinding: eerst verticaal, dan horizontaal."""
        self.path(f"M {x1} {y1} L {x1} {y2} L {x2} {y2}", stroke=stroke, sw=sw, marker=stroke)

    def box(self, x, y, w, h, title=None, body=None, fill="#FFFFFF", stroke=BLUE,
            tsize=30, bsize=25, sw=2.5, rx=12, tcolor=None, bcolor=None, align="center",
            pad=22, tweight="bold"):
        self.rect(x, y, w, h, fill=fill, stroke=stroke, sw=sw, rx=rx)
        tcolor = tcolor or stroke
        bcolor = bcolor or INK
        body = body or []
        if isinstance(body, str):
            body = [body]
        n_t = 1 if title else 0
        th = tsize * 1.25 if title else 0
        bh = len(body) * bsize * 1.35
        total = th + (10 if (title and body) else 0) + bh
        cy = y + (h - total) / 2 + (tsize * 0.85 if title else 0)
        if align == "center":
            tx = x + w / 2
            anchor = "middle"
        else:
            tx = x + pad
            anchor = "start"
        if title:
            self.text(tx, cy, title, tsize, tcolor, anchor, tweight)
            cy += th - tsize * 0.85 + (10 if body else 0) + bsize * 0.85
        else:
            cy = y + (h - bh) / 2 + bsize * 0.85
        for s in body:
            self.text(tx, cy, s, bsize, bcolor, anchor)
            cy += bsize * 1.35

    def chip(self, x, y, w, h, label, fill, stroke, size=25, color=None, weight="bold"):
        self.rect(x, y, w, h, fill=fill, stroke=stroke, sw=2, rx=h / 2)
        self.text(x + w / 2, y + h / 2 + size * 0.35, label, size,
                  color or stroke, "middle", weight)

    def badge(self, cx, cy, r, label, fill, color="#FFFFFF", size=30):
        self.circle(cx, cy, r, fill=fill)
        self.text(cx, cy + size * 0.35, label, size, color, "middle", "bold")

    def banner(self, x, y, w, h, title, sub=None, fill=BLUE, color="#FFFFFF"):
        self.rect(x, y, w, h, fill=fill, stroke="none", rx=10)
        if sub:
            self.text(x + w / 2, y + h / 2 - 4, title, 34, color, "middle", "bold")
            self.text(x + w / 2, y + h / 2 + 30, sub, 24, color, "middle")
        else:
            self.text(x + w / 2, y + h / 2 + 12, title, 34, color, "middle", "bold")

    # ---------- render ----------
    def render(self):
        defs = ['<defs>']
        for c in sorted(self.markers):
            mid = c.lstrip("#")
            defs.append(
                f'<marker id="arrow-{mid}" viewBox="0 0 10 10" refX="9" refY="5" '
                f'markerWidth="6" markerHeight="6" orient="auto-start-reverse">'
                f'<path d="M 0 0 L 10 5 L 0 10 z" fill="{c}"/></marker>'
            )
        defs.append('</defs>')
        return (
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}" height="{self.h}" '
            f'viewBox="0 0 {self.w} {self.h}">'
            + "".join(defs)
            + f'<rect width="{self.w}" height="{self.h}" fill="{self.bg}"/>'
            + "".join(self.parts)
            + "</svg>"
        )

    def save(self, path):
        with open(path, "w", encoding="utf-8") as f:
            f.write(self.render())
        return path
