"""Stand: "verder waar je was" — de opgeslagen werkstand per gebruiker, met eerdere versies.

Wat doet dit onderdeel
----------------------
De frontend slaat de stand van de tool (invoer, regels, capaciteit, modus, functiekamers,
actieve module) automatisch op via ``PUT /api/stand``. Dit bestand bewaart die stand per
gebruiker als JSON-tekst in de tabel ``standen``, houdt de laatste 30 versies (een versie
per werkblok van 10 minuten, zie hieronder), en geeft de
nieuwste, de lijst van versies of één versie terug. De beheerder kan de nieuwste stand van
een gebruiker inzien (om mee te kijken bij een vraag). De inhoud zelf bekijkt de backend
niet, alleen de grootte.

Plaats in de keten
------------------
``server.py`` (routes ``/api/stand*`` en ``/api/beheer/stand/{id}``) → dit bestand →
``opslag.py``. Het logboek (``stand_hersteld``, ``stand_bekeken``) gaat via ``accounts.Accounts.log``.

Invoer
------
- ``opslaan(gebruiker_id, data, module, modus)``: ``data`` = het state-object van de frontend
  (een JSON-object; dezelfde vorm als de sessie-export van ``useImportExport``), ``module`` =
  nummer van de actieve module (of ``None``), ``modus`` = korte tekst (bv. ``"poli"``).

Uitvoer
-------
- ``opslaan`` → ``{id, tijd}``;
- ``nieuwste`` / ``een`` → ``{id, tijd, module, modus, data}`` of ``None``;
- ``versies`` → ``[{id, tijd, module, modus, grootte}]``, nieuwste eerst.

Hoe het werkt
-------------
1. ``data`` wordt compact als JSON-tekst geschreven (UTF-8); groter dan 1 MB → ``Fout(413)``.
   ``NaN``/``Infinity`` worden geweigerd (``Fout(400)``) — die kan de browser niet teruglezen.
2. **Versies per werkblok.** De frontend slaat automatisch op, 2 s na elke wijziging. Elke
   opslag een eigen versie zou de 30 bewaarde versies in een paar minuten opmaken. Daarom:
   is de nieuwste versie van deze gebruiker jonger dan ``VERSIE_INTERVAL_SEC`` (10 minuten)
   en in dezelfde modus, dan wordt die versie bijgewerkt in plaats van een nieuwe gemaakt.
   Zo dekken 30 versies vele uren werk. Met ``nieuwe_versie=True`` (de frontend stuurt dat bij
   "Nieuw raster beginnen" en bij het terugzetten van een oudere versie) komt er altijd een
   nieuwe versie, zodat de vorige stand bewaard blijft.
3. Bij een nieuwe versie worden in dezelfde transactie alle rijen van deze gebruiker buiten
   de nieuwste 30 verwijderd.
4. Lezen kan alleen de eigen standen (``gebruiker_id`` in elke query); een vreemd ``id`` geeft
   ``Fout(404)``, net als een id dat niet bestaat, zodat niet te raden is welke ids bestaan.

Waar kan het misgaan en hoe zie je dat
--------------------------------------
- ``413 De stand is te groot`` → de frontend stuurt meer dan 1 MB; meestal een grote
  importlijst. Kijk naar ``grootte`` in ``GET /api/stand/versies``.
- ``GET /api/stand`` geeft ``stand: null`` terwijl er wel opgeslagen is → de gebruiker is met
  een ander account ingelogd (standen zijn per gebruiker).
- Oudere versies "verdwijnen": er worden er maar 30 bewaard, één per werkblok van 10 minuten
  (of per expliciete nieuwe versie). Logboek ``poliraster.stand`` (DEBUG) meldt elke opslag met
  de grootte en of het een nieuwe of bijgewerkte versie was.
- "Nieuw raster beginnen" overschreef de vorige stand → de frontend stuurde geen
  ``nieuwe_versie: true`` bij de eerste opslag na het opnieuw beginnen.
"""
from __future__ import annotations

import json
import logging
import time
from typing import Any, Optional

from accounts import Accounts, Bron, Fout, Sessie
from opslag import Opslag, tijd_iso

log = logging.getLogger("poliraster.stand")

MAX_STAND_BYTES = 1024 * 1024   # 1 MB JSON-tekst
BEWAAR_VERSIES = 30
VERSIE_INTERVAL_SEC = 10 * 60   # opslagen binnen 10 minuten na de nieuwste versie werken die versie bij
MAX_MODUS = 40


def _uit_rij(rij: Optional[dict[str, Any]]) -> Optional[dict[str, Any]]:
    """Databaserij → ``{id, tijd, module, modus, data}`` met ``data`` weer als object."""
    if not rij:
        return None
    return {"id": rij["id"], "tijd": rij["tijd"], "module": rij["module"], "modus": rij["modus"], "data": json.loads(rij["data"])}


class Standen:
    """Opgeslagen standen per gebruiker (zie module-docstring)."""

    def __init__(self, db: Opslag, accounts: Accounts) -> None:
        """``db``: de opslag; ``accounts``: voor het logboek en het opzoeken van gebruikers."""
        self.db = db
        self.accounts = accounts

    def opslaan(self, gebruiker_id: int, data: Any, module: Any = None, modus: Any = None,
                nieuwe_versie: bool = False, nu: Optional[float] = None) -> dict[str, Any]:
        """Stand opslaan: de nieuwste versie bijwerken als die jonger is dan 10 minuten (en dezelfde
        modus heeft), anders een nieuwe versie maken en de oude boven de 30 opruimen.

        ``nieuwe_versie=True`` maakt altijd een nieuwe versie. ``nu`` (Unix-tijd) is voor tests.
        Geeft ``{id, tijd, nieuw}``.
        """
        if not isinstance(data, dict):
            raise Fout(400, "data moet het state-object (een JSON-object) zijn.")
        if module is not None and (isinstance(module, bool) or not isinstance(module, (int, float)) or int(module) != module):
            raise Fout(400, "module moet een geheel getal zijn (of leeg).")
        if modus is not None and not isinstance(modus, str):
            raise Fout(400, "modus moet tekst zijn (of leeg).")
        try:
            tekst = json.dumps(data, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
        except ValueError as e:
            raise Fout(400, f"data bevat een waarde die niet als JSON kan (NaN of oneindig): {e}") from e
        grootte = len(tekst.encode("utf-8"))
        if grootte > MAX_STAND_BYTES:
            raise Fout(413, f"De stand is te groot ({grootte // 1024} kB; maximaal {MAX_STAND_BYTES // 1024} kB).")
        tijd = tijd_iso(nu)
        modus_kort = None if modus is None else modus[:MAX_MODUS]
        if not nieuwe_versie:
            # Het werkblok telt vanaf het BEGIN van de versie (begonnen), niet vanaf de laatste opslag:
            # anders zou een lange sessie met steeds kleine pauzes één enkele versie blijven.
            laatste = self.db.haal_een("SELECT id, COALESCE(begonnen, tijd) AS begonnen, modus FROM standen "
                                       "WHERE gebruiker_id = ? ORDER BY id DESC LIMIT 1", (int(gebruiker_id),))
            grens = tijd_iso((time.time() if nu is None else nu) - VERSIE_INTERVAL_SEC)
            if laatste and laatste["begonnen"] > grens and laatste["modus"] == modus_kort:
                self.db.voer_uit("UPDATE standen SET tijd = ?, module = ?, modus = ?, data = ?, grootte = ? WHERE id = ? AND gebruiker_id = ?",
                                 (tijd, None if module is None else int(module), modus_kort, tekst, grootte, laatste["id"], int(gebruiker_id)))
                log.debug("stand bijgewerkt: gebruiker %s, versie %s, %d bytes", gebruiker_id, laatste["id"], grootte)
                return {"id": laatste["id"], "tijd": tijd, "nieuw": False}
        with self.db.transactie() as t:
            u = t.voer_uit("INSERT INTO standen(gebruiker_id, tijd, module, modus, data, grootte, begonnen) VALUES (?,?,?,?,?,?,?)",
                           (int(gebruiker_id), tijd, None if module is None else int(module), modus_kort,
                            tekst, grootte, tijd))
            weg = t.voer_uit("DELETE FROM standen WHERE gebruiker_id = ? AND id NOT IN "
                             "(SELECT id FROM standen WHERE gebruiker_id = ? ORDER BY id DESC LIMIT ?)",
                             (int(gebruiker_id), int(gebruiker_id), BEWAAR_VERSIES))
        log.debug("stand opgeslagen: gebruiker %s, id %s, %d bytes, %d oude versie(s) opgeruimd", gebruiker_id, u.laatste_id, grootte, weg.aantal)
        return {"id": u.laatste_id, "tijd": tijd, "nieuw": True}

    def nieuwste(self, gebruiker_id: int) -> Optional[dict[str, Any]]:
        """De nieuwste stand van deze gebruiker, of ``None``."""
        return _uit_rij(self.db.haal_een("SELECT id, tijd, module, modus, data FROM standen WHERE gebruiker_id = ? ORDER BY id DESC LIMIT 1",
                                         (int(gebruiker_id),)))

    def versies(self, gebruiker_id: int) -> list[dict[str, Any]]:
        """Alle bewaarde versies (zonder ``data``), nieuwste eerst."""
        return self.db.haal("SELECT id, tijd, module, modus, grootte FROM standen WHERE gebruiker_id = ? ORDER BY id DESC",
                            (int(gebruiker_id),))

    def een(self, sessie: Sessie, stand_id: int, bron: Optional[Bron] = None) -> dict[str, Any]:
        """Eén versie van de ingelogde gebruiker (``Fout(404)`` als die niet van hem/haar is of niet bestaat).

        Is het niet de nieuwste versie, dan haalt de gebruiker een oudere stand terug: dat komt
        als ``stand_hersteld`` in het logboek.
        """
        rij = self.db.haal_een("SELECT id, tijd, module, modus, data FROM standen WHERE id = ? AND gebruiker_id = ?",
                               (int(stand_id), sessie.uid))
        if not rij:
            raise Fout(404, "Deze stand bestaat niet (of is niet van jou).")
        nieuwste = self.db.haal_een("SELECT MAX(id) AS id FROM standen WHERE gebruiker_id = ?", (sessie.uid,))
        if nieuwste and nieuwste["id"] != rij["id"]:
            self.accounts.log("stand_hersteld", bron, sessie.uid, sessie.gebruiker["gebruikersnaam"], f"versie {rij['id']} van {rij['tijd']}")
        return _uit_rij(rij)

    def beheer_inzage(self, gebruiker_id: int, door: Sessie, bron: Optional[Bron] = None) -> Optional[dict[str, Any]]:
        """``GET /api/beheer/stand/{gebruiker_id}``: de nieuwste stand van een gebruiker, voor de beheerder.

        ``Fout(404)`` als de gebruiker niet bestaat. Het meekijken komt als ``stand_bekeken`` in het
        logboek, zodat zichtbaar blijft wie bij wie heeft gekeken.
        """
        g = self.accounts.gebruiker(int(gebruiker_id))
        if not g:
            raise Fout(404, "Gebruiker niet gevonden.")
        stand = self.nieuwste(g["id"])
        self.accounts.log("stand_bekeken", bron, g["id"], g["gebruikersnaam"],
                          f"door beheer: {door.gebruiker['gebruikersnaam']}; " + (f"versie {stand['id']}" if stand else "geen stand"))
        return stand
