"""Projecten: bewust opgeslagen werk met een naam ("Dermatologie", "Urologie"), per gebruiker.

Wat doet dit onderdeel
----------------------
Naast de automatische stand ("verder waar je was", stand.py) kan een gebruiker zelf op
**Opslaan** klikken. Dan wordt het hele werk (invoer, regels, capaciteit, modus,
functiekamers) bewaard onder een projectnaam, met de tijd erbij. In de tool verschijnt dat
als "Dermatologie 26-10-2026 08:00". Elke klik op Opslaan maakt een nieuwe versie; eerdere
versies van hetzelfde project blijven staan. Later kun je elke versie weer inladen.

Het verschil met de stand: de stand wordt elke paar seconden automatisch bijgewerkt en er
worden maar 30 werkblokken bewaard. Een project blijft staan tot de gebruiker het zelf
verwijdert (binnen de grenzen hieronder).

Plaats in de keten
------------------
``server.py`` (routes ``/api/projecten*``) → dit bestand → ``opslag.py`` (tabel ``projecten``).
Het logboek (``project_opgeslagen``, ``project_geopend``, ``project_verwijderd``) gaat via
``accounts.Accounts.log``. De frontend: ``frontend/src/hooks/useProjecten.js``.

Invoer
------
- ``opslaan(sessie, naam, data, modus, bron)``: ``naam`` = projectnaam (1–80 tekens, geen
  stuurtekens), ``data`` = het state-object van de frontend (zelfde vorm als de stand),
  ``modus`` = ``"poli"`` of ``"functie"`` (of leeg).
- ``een(sessie, id, bron)`` / ``verwijder(sessie, id, alle, bron)``: een id uit ``lijst``.

Uitvoer
-------
- ``opslaan`` → ``{id, naam, tijd}``;
- ``lijst`` → ``[{id, naam, tijd, modus, grootte}]``, nieuwste eerst (alle versies; de
  frontend groepeert op naam);
- ``een`` → ``{id, naam, tijd, modus, data}``;
- ``verwijder`` → ``{verwijderd: aantal}``.

Hoe het werkt
-------------
1. De naam wordt opgeschoond (spaties aan de randen weg, meerdere spaties → één) en
   gecontroleerd: 1–80 tekens, geen stuurtekens (regeleinden, tabs, onzichtbare
   Unicode-tekens). Hoofdletters tellen niet bij het groeperen: "dermatologie" en
   "Dermatologie" zijn hetzelfde project; de laatst gebruikte schrijfwijze wint niet — elke
   versie bewaart de naam zoals die toen getypt is.
2. ``data`` wordt compact als JSON-tekst geschreven, maximaal 1 MB (zoals de stand).
3. Grenzen per gebruiker, zodat één account de database niet kan volschrijven:
   ``MAX_PROJECTEN`` verschillende namen, ``MAX_VERSIES`` versies per project (de oudste
   versie van dát project valt eraf) en ``MAX_TOTAAL_BYTES`` voor alles samen.
4. Elke query bevat ``gebruiker_id``: je kunt alleen je eigen projecten zien, openen of
   verwijderen. Een vreemd of onbekend id geeft hetzelfde ``404``, zodat niet te raden is
   welke ids bestaan.

Waar kan het misgaan en hoe zie je dat
--------------------------------------
- ``409 Je hebt al 100 projecten`` → verwijder oude projecten op het Start-scherm.
- ``413`` → het werk is groter dan 1 MB (meestal een enorme importlijst).
- ``400 De projectnaam …`` → lege naam, te lang, of met stuurtekens.
- Een project "verdwijnt" → er worden maximaal ``MAX_VERSIES`` versies per project bewaard;
  het logboek (soort ``project_opgeslagen``) laat zien wanneer er is opgeslagen.
"""
from __future__ import annotations

import json
import logging
import re
import unicodedata
from typing import Any, Optional

from accounts import Accounts, Bron, Fout, Sessie
from opslag import Opslag, tijd_iso
from stand import MAX_STAND_BYTES

log = logging.getLogger("poliraster.projecten")

MAX_NAAM = 80
MAX_MODUS = 40
MAX_PROJECTEN = 100                 # verschillende projectnamen per gebruiker
MAX_VERSIES = 50                    # versies per project; de oudste valt eraf
MAX_TOTAAL_BYTES = 50 * 1024 * 1024  # alle projecten van één gebruiker samen


def schoon_naam(naam: Any) -> str:
    """Projectnaam opschonen en controleren; ``Fout(400)`` als hij niet bruikbaar is."""
    if not isinstance(naam, str):
        raise Fout(400, "De projectnaam moet tekst zijn.")
    # Stuurtekens (Cc) en onzichtbare opmaaktekens (Cf, bv. tekens die de leesrichting
    # omdraaien) zijn nooit nodig in een naam en kunnen het beeld in de lijst misleiden.
    if any(unicodedata.category(t) in ("Cc", "Cf") for t in naam):
        raise Fout(400, "De projectnaam bevat ongeldige tekens (zoals een regeleinde of tab).")
    schoon = re.sub(r"\s+", " ", naam).strip()
    if not schoon:
        raise Fout(400, "Geef het project een naam, bijvoorbeeld de poli: Dermatologie.")
    if len(schoon) > MAX_NAAM:
        raise Fout(400, f"De projectnaam is te lang ({len(schoon)} tekens; maximaal {MAX_NAAM}).")
    return schoon


def _id(waarde: Any) -> int:
    """Geheel getal, anders ``Fout(400)``."""
    if isinstance(waarde, bool):
        raise Fout(400, "id moet een geheel getal zijn.")
    try:
        return int(waarde)
    except (TypeError, ValueError):
        raise Fout(400, "id moet een geheel getal zijn.") from None


class Projecten:
    """Opgeslagen projecten per gebruiker (zie module-docstring)."""

    def __init__(self, db: Opslag, accounts: Accounts) -> None:
        """``db``: de opslag; ``accounts``: voor het logboek."""
        self.db = db
        self.accounts = accounts

    def opslaan(self, sessie: Sessie, naam: Any, data: Any, modus: Any = None,
                bron: Optional[Bron] = None, nu: Optional[float] = None) -> dict[str, Any]:
        """Een nieuwe versie van project ``naam`` opslaan. Geeft ``{id, naam, tijd}``."""
        naam = schoon_naam(naam)
        if not isinstance(data, dict):
            raise Fout(400, "data moet het state-object (een JSON-object) zijn.")
        if modus is not None and not isinstance(modus, str):
            raise Fout(400, "modus moet tekst zijn (of leeg).")
        try:
            tekst = json.dumps(data, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
        except ValueError as e:
            raise Fout(400, f"data bevat een waarde die niet als JSON kan (NaN of oneindig): {e}") from e
        grootte = len(tekst.encode("utf-8"))
        if grootte > MAX_STAND_BYTES:
            raise Fout(413, f"Het project is te groot ({grootte // 1024} kB; maximaal {MAX_STAND_BYTES // 1024} kB).")
        uid = sessie.uid
        bestaat = self.db.haal_een("SELECT 1 AS j FROM projecten WHERE gebruiker_id = ? AND naam = ? COLLATE NOCASE LIMIT 1",
                                   (uid, naam))
        if not bestaat:
            aantal = self.db.haal_een("SELECT COUNT(DISTINCT naam COLLATE NOCASE) AS n FROM projecten WHERE gebruiker_id = ?", (uid,))
            if aantal and aantal["n"] >= MAX_PROJECTEN:
                raise Fout(409, f"Je hebt al {MAX_PROJECTEN} projecten. Verwijder eerst oude projecten op het Start-scherm.")
        totaal = self.db.haal_een("SELECT COALESCE(SUM(grootte), 0) AS b FROM projecten WHERE gebruiker_id = ?", (uid,))
        if totaal and totaal["b"] + grootte > MAX_TOTAAL_BYTES:
            raise Fout(409, f"Je opgeslagen projecten nemen samen meer dan {MAX_TOTAAL_BYTES // (1024 * 1024)} MB in. "
                            "Verwijder eerst oude versies op het Start-scherm.")
        tijd = tijd_iso(nu)
        with self.db.transactie() as t:
            u = t.voer_uit("INSERT INTO projecten(gebruiker_id, naam, tijd, modus, data, grootte) VALUES (?,?,?,?,?,?)",
                           (uid, naam, tijd, None if modus is None else modus[:MAX_MODUS], tekst, grootte))
            # Hooguit MAX_VERSIES versies van dit project: de oudste vallen eraf.
            weg = t.voer_uit("DELETE FROM projecten WHERE gebruiker_id = ? AND naam = ? COLLATE NOCASE AND id NOT IN "
                             "(SELECT id FROM projecten WHERE gebruiker_id = ? AND naam = ? COLLATE NOCASE ORDER BY id DESC LIMIT ?)",
                             (uid, naam, uid, naam, MAX_VERSIES))
        self.accounts.log("project_opgeslagen", bron, uid, sessie.gebruiker["gebruikersnaam"],
                          f"{naam} (versie {u.laatste_id}, {grootte} bytes)")
        log.debug("project opgeslagen: gebruiker %s, %r, id %s, %d bytes, %d oude versie(s) opgeruimd",
                  uid, naam, u.laatste_id, grootte, weg.aantal)
        return {"id": u.laatste_id, "naam": naam, "tijd": tijd}

    def lijst(self, gebruiker_id: int) -> list[dict[str, Any]]:
        """Alle versies van alle projecten van deze gebruiker (zonder ``data``), nieuwste eerst."""
        return self.db.haal("SELECT id, naam, tijd, modus, grootte FROM projecten WHERE gebruiker_id = ? ORDER BY id DESC",
                            (int(gebruiker_id),))

    def een(self, sessie: Sessie, project_id: Any, bron: Optional[Bron] = None) -> dict[str, Any]:
        """Eén eigen versie mét data (``Fout(404)`` als die niet van deze gebruiker is of niet bestaat)."""
        rij = self.db.haal_een("SELECT id, naam, tijd, modus, data FROM projecten WHERE id = ? AND gebruiker_id = ?",
                               (_id(project_id), sessie.uid))
        if not rij:
            raise Fout(404, "Dit project bestaat niet (of is niet van jou).")
        self.accounts.log("project_geopend", bron, sessie.uid, sessie.gebruiker["gebruikersnaam"],
                          f"{rij['naam']} (versie {rij['id']} van {rij['tijd']})")
        return {"id": rij["id"], "naam": rij["naam"], "tijd": rij["tijd"], "modus": rij["modus"], "data": json.loads(rij["data"])}

    def verwijder(self, sessie: Sessie, project_id: Any, alle: bool = False,
                  bron: Optional[Bron] = None) -> dict[str, Any]:
        """Eén versie verwijderen, of met ``alle=True`` alle versies van hetzelfde project."""
        uid = sessie.uid
        rij = self.db.haal_een("SELECT id, naam FROM projecten WHERE id = ? AND gebruiker_id = ?", (_id(project_id), uid))
        if not rij:
            raise Fout(404, "Dit project bestaat niet (of is niet van jou).")
        if alle:
            u = self.db.voer_uit("DELETE FROM projecten WHERE gebruiker_id = ? AND naam = ? COLLATE NOCASE", (uid, rij["naam"]))
        else:
            u = self.db.voer_uit("DELETE FROM projecten WHERE id = ? AND gebruiker_id = ?", (rij["id"], uid))
        self.accounts.log("project_verwijderd", bron, uid, sessie.gebruiker["gebruikersnaam"],
                          f"{rij['naam']} ({'alle versies' if alle else 'versie ' + str(rij['id'])}, {u.aantal} weg)")
        return {"verwijderd": u.aantal}
