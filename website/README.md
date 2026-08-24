# WE ARE MADE — website

Volledig functionerende statische site in lichte, editorial stijl (naar het
voorbeeld van noartmusic.com): ivoorwit met diep bordeauxrood, klassieke
serif-typografie (Tinos, de vrije Times-evenknie), preloader, smooth scroll
met inertie en scroll-gedreven typo-effecten. Alle teksten zijn Engels.

Drie pagina's:

- `index.html` — landingspagina (modules, galerij, pakketten, tools, FAQ)
- `login.html` — inloggen / account aanmaken (pakketkeuze inbegrepen)
- `app.html`  — de cursusomgeving: modules met lessen, voortgang die wordt
  opgeslagen, claude.md-download en pakket-vergrendeling (Starter opent
  M-01/M-02, Pro en Studio alles)

Rechtsboven zit een schakelaar die het kleurenschema omdraait: ivoor met
bordeaux tekst ⇄ bordeaux met ivoren tekst. De keuze wordt onthouden en
alle generatieve visuals kleuren live mee.

> **Let op — demo-login.** Accounts en voortgang leven in de browser
> (localStorage, wachtwoorden gehasht met SHA-256 + salt). Prima om te
> demonstreren en testen, maar niet geschikt voor echte klanten: koppel
> voor de lancering een backend (bijv. Supabase Auth + Stripe) — de
> functies in `js/auth.js` zijn zo geschreven dat je ze 1-op-1 kunt
> vervangen door API-calls.

Geen build-stap, geen dependencies — direct te hosten op Netlify, Vercel,
GitHub Pages of elke gewone webserver.

## Lokaal bekijken

```bash
cd website
python3 -m http.server 8000
# open http://localhost:8000
```

(Direct openen van `index.html` werkt ook, maar via een servertje laden de
fonts betrouwbaarder.)

## Structuur

```
website/
├── index.html        # landingspagina (secties, teksten, prijzen)
├── login.html        # inloggen / registreren
├── app.html          # cursusomgeving (dashboard)
├── css/style.css     # kleuren (incl. thema's), typografie, layout
├── js/theme.js       # kleurschakelaar (ivoor ⇄ bordeaux)
├── js/auth.js        # demo-login: accounts, sessies, voortgang
├── js/login.js       # login/registratie-logica
├── js/app.js         # modules, lessen, voortgang, claude.md-download
├── js/main.js        # cursor, scroll-effecten, hero-visual, kunstwerken
└── media/            # hier komt straks je intro-video
```

## Aanpassen

- **Naam / branding** — zoek-en-vervang `We Are Made` / `WE ARE MADE` in
  `index.html` (nav-logo, footer-wordmark, `<title>`) en pas het mailadres aan.
- **Kleuren** — bovenin `css/style.css` staan de CSS-variabelen voor beide
  thema's: `:root` (ivoor + bordeaux) en `:root[data-theme="dark"]`
  (omgekeerd). De canvassen lezen dezelfde variabelen.
- **Lesinhoud** — alle modules en lessen staan als data in `js/app.js`
  (`MODULES`); pakketten en ontgrendeling in `PLANS`.
- **Teksten & prijzen** — alles staat gewoon in `index.html`
  (modules, pakketten, FAQ).

## Intro-video plaatsen

De hero gebruikt nu een generatieve, muis-reactieve canvas-visual als
placeholder. Zodra je een video hebt:

1. Zet het bestand in `website/media/` (bijv. `intro.mp4`).
2. Vervang in `index.html` het `<canvas id="heroCanvas">`-element door het
   `<video>`-blok dat er als commentaar direct boven staat.

De korrel-overlay (`.hero__grain`) kan blijven — die geeft de video dezelfde
filmische textuur.

## Effecten (waar zit wat)

| Effect | Bestand |
| --- | --- |
| Preloader met teller + intro-choreografie | `js/main.js` → "PRELOADER" |
| Smooth scroll met inertie (Lenis-gevoel) | `js/main.js` → "SMOOTH SCROLLING" |
| Hero-titel schermvullend + uiteendrijvend op scroll | `js/main.js` → "FIT" / "SPLIT TITLES" |
| Koppen waarvan de spatiëring ademt op scroll | `js/main.js` → "TRACK TITLES" |
| Outline-letters die zich vullen met inkt | `js/main.js` → "FILL TITLE" |
| Tekst die woord voor woord oplicht | `js/main.js` → "WORD REVEAL" |
| Ticker die versnelt bij scrollen | `js/main.js` → "TICKER" |
| Rol-effect op links / magnetische knoppen | `js/main.js` → "ROLL" / "MAGNETIC" |
| Custom cursor met contextlabels (Open / View) | `js/main.js` → "CUSTOM CURSOR" |
| Levende inkt-hero (video-placeholder) | `js/main.js` → "HERO INK RIBBONS" |
| Generatieve kunstwerken (galerij + zwevende preview) | `js/main.js` → "GENERATIVE ARTWORKS" |
| Parallax (hero + galerij) en nav die meebeweegt | `js/main.js` → "PARALLAX + NAV" |

Alle animaties respecteren `prefers-reduced-motion`.
