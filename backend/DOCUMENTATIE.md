# Documentatie van de backend

Automatisch gemaakt door `python maak_documentatie.py` uit de docstrings. Niet met de hand bewerken.

## `rasterplanner/__init__.py`

Een letterlijke, modulaire port van de JavaScript-rekenkern (``frontend/src/engine/``): het
sessierooster vullen, een voorstelraster maken, afspraken plaatsen en verplaatsen, flexibele tijd
en statistieken. Per stap één bestand, zodat je kunt opzoeken waar iets misgaat.

## `rasterplanner/jobs.py`

Vertaalt een job ``{type, args, trace?}`` naar de juiste rekenfunctie en geeft de uitkomst in
precies dezelfde vorm als ``frontend/src/engine/jobs.js`` in de browser. Zo maakt het voor het
scherm niet uit of er in de Web Worker, in de pagina of op deze server wordt gerekend.

- `voer_job_uit` — Voer één rekenopdracht uit. Port van ``voerJobUit``.

## `rasterplanner/voorstel.py`

Maakt voor alle sessies van één modaliteit een planraster: welke afspraak van welke plangroep
op welk tijdstip in welke sessie, met de flexibele tijd volgens de planregels, en meldingen in
gewone taal over wat niet paste. Het is een deterministische planner (geen taalmodel): dezelfde
invoer geeft altijd hetzelfde raster.

- `voorstel` — Maak een voorstelraster voor alle sessies van één modaliteit. Port van ``voorstel``.

## `rasterplanner/capaciteit.py`

Eerste stap van het voorstelraster. Per sessie van de modaliteit: de flexblokken (uit de
planregels van de kamer, of de handmatig aangepaste blokken van die sessie) en de netto
planbare minuten (bruto sessieduur min flex).

- `bouw_capaciteit` — Per sessie de flex en de netto planbare minuten. Port van het capaciteitsblok in ``voorstel``.

## `rasterplanner/verdeling.py`

Verdeelt de gevraagde afspraken van alle plangroepen over de sessies waar ze volgens stap 3.1
mogen staan, zó dat de sessies zo gelijkmatig mogelijk vol raken. Wat nergens past, telt als
"nog te plannen".

- `verdeel_vraag` — Wijs elke gevraagde afspraak toe aan een sessie. Port van het verdeelblok in ``voorstel``.

## `rasterplanner/volgorde.py`

Past de groepering en de methodiek "korte afspraken eerst" uit stap 3.2 toe op de lijst
afspraken die aan één sessie zijn toegewezen. Gespreid plannen wisselt plangroepen af
(A, B, A, B); wave planning zet ze per blok (A, A, B, B).

- `orden` — Zet de items van één sessie in volgorde (gespreid of wave). Port van ``orden``.

## `rasterplanner/tijdlijn.py`

Legt een geordende lijst afspraken aaneengesloten in een sessie, vanaf de starttijd, om de vaste
flexblokken heen. Zwevende flexblokken (interval, bv. 5 min per half uur) worden geplaatst zodra
een afspraak hun interval bereikt. Met "eerste afspraak dubbel boeken" start de tweede afspraak
tegelijk met de eerste (Bailey-Welch). Ook "gaten sluiten" uit stap 3.3 gebruikt dit.

- `layout_sessie` — Leg de items op volgorde in de sessie, om de flex heen. Port van ``layoutSessie``.
- `sluit_gaten` — Afspraken aaneensluitend vanaf de sessiestart zetten, om de vaste flex heen. Port van ``sluitGaten``.

## `rasterplanner/flex.py`

Per kamer staan in stap 3.2 flexregels: x minuten op een vast tijdstip, x minuten aan het
einde van de sessie, of x minuten per y minuten (bijvoorbeeld 5 per half uur). Dit onderdeel
maakt daar voor één sessie de concrete blokken van, en rekent het uitgangspunt uit Invoerlijst 1
(benutting % ⇄ minuten flex per sessie) terug.

- `merge_intervals` — Overlappende of aansluitende intervallen samenvoegen (kopieën). Port van ``mergeIntervals``.
- `materialize_flex` — Flexregels van een kamer → flexblokken voor deze sessie. Port van ``materializeFlex``.
- `flex_uitgangspunt` — Doel-flex uit de benutting tegenover de ingestelde flexregels. Port van ``flexUitgangspunt``.

## `rasterplanner/regels.py`

De kamerbinding en het planmoment van een plangroep zijn leidend. Dit onderdeel beslist per
sessie of een plangroep er mag staan, en zo niet, met welke reden in gewone taal (die tekst
verschijnt als foutmelding in het scherm).

- `toegestaan` — Mag plangroep ``pg`` in ``sessie`` van ``kamer``? Port van ``toegestaan``.
- `toegestane_sessies` — Alle sessies van de modaliteit waarop de plangroep mag staan. Port van ``toegestaneSessies``.

## `rasterplanner/plaatsing.py`

Alles wat één afspraak in één sessie zet of weghaalt: de eerste vrije plek vanaf een tijdstip
(om afspraken en flexblokken heen), de landingsplek als je een afspraak op een tijdstip loslaat,
het doorschuiven van latere afspraken, en de handelingen uit stap 3.3 (toevoegen, verplaatsen,
verwijderen, "één minder").

- `bezet` — Bezette blokken in een sessie: afspraken (behalve ``negeer_id`` en zijn dubbel) en flex. Port van ``bezet``.
- `vrije_plek` — Eerste startmoment ≥ ``vanaf`` waarop ``duur`` minuten vrij zijn, anders ``None``. Port van ``vrijePlek``.
- `landing` — Waar komt een afspraak die op ``t`` wordt losgelaten echt te staan? ``None`` = past niet. Port van ``landing``.
- `plaats_op_tijd` — Plaats ``item`` ``{id?, pgId, duur, appt?}`` op tijdstip ``t`` en schuif de rest door. Port van ``plaatsOpTijd``.
- `voeg_afspraak_toe` — Afspraak van plangroep ``pg_id`` in een sessie zetten (op ``vanaf`` of de eerste vrije plek). Port van ``voegAfspraakToe``.
- `verwijder_afspraak` — Afspraak weghalen, samen met een afspraak die er dubbel op geboekt is. Port van ``verwijderAfspraak``.
- `verwijder_laatste` — De laatste afspraak van een plangroep uit een sessie halen (de knop "−"). Port van ``verwijderLaatste``.
- `verplaats_afspraak` — Afspraak naar een andere sessie of een ander tijdstip slepen. Port van ``verplaatsAfspraak``.

## `rasterplanner/sessieflex.py`

De handelingen op de flexibele tijd van één sessie of één kamer: opnieuw opbouwen uit de
planregels (na een wijziging in stap 3.2), handmatig aangepaste blokken vastleggen, een blok
toevoegen, een sessie of hele modaliteit leegmaken, en een sessie rechtzetten nadat haar tijden
zijn veranderd (afspraken die buiten de sessie vallen opnieuw plaatsen).

- `herbouw_flex` — Flexblokken van alle sessies van een kamer opnieuw uit de regels. Port van ``herbouwFlex``.
- `zet_flex` — Nieuwe flexblokken voor één sessie vastleggen (samengevoegd). Port van ``zetFlex``.
- `voeg_flex_toe` — Een flexblok op de eerste vrije plek (vanaf ``vanaf``). Port van ``voegFlexToe``.
- `leeg_sessie` — Afspraken weg, flex terug naar de regels. Port van ``leegSessie``.
- `leeg_modaliteit` — Alle sessies van een modaliteit leegmaken. Port van ``leegModaliteit``.
- `normaliseer_sessie` — Na een tijd- of dagwijziging: flex en afspraken binnen de sessie brengen. Port van ``normaliseerSessie``.

## `rasterplanner/sessierooster.py`

Vult het sessierooster automatisch vanuit de doelaantallen in Invoerlijst 1 (reguliere week of
reductieweek), en voert de handelingen uit de weektabel uit: sessie toevoegen, verwijderen,
dupliceren en wijzigen (dag, dagdeel, tijden of kamer).

- `vul_sessierooster` — Sessies toevoegen tot elke kamer haar doelaantal heeft. Port van ``vulSessierooster``.
- `sessie_toevoegen` — Eén sessie met de standaardtijden van het dagdeel van de kamer. Port van ``sessieToevoegen``.
- `sessie_verwijderen` — Sessie en haar plan-item weghalen. Port van ``sessieVerwijderen``.
- `sessie_dupliceren` — Kopie van een sessie (met afspraken en flex) op een ander moment of in een andere kamer. Port van ``sessieDupliceren``.
- `sessie_wijzigen` — Dag, dagdeel, tijden of kamer van een sessie wijzigen en het plan rechtzetten. Port van ``sessieWijzigen``.
- `week_raster` — Sessies gegroepeerd per ``kamerId|dag|dagdeel`` (voor de weektabel). Port van ``weekRaster``.
- `zichtbare_dagen` — Ma–vr, plus weekenddagen waarop sessies staan. Port van ``zichtbareDagen``.

## `rasterplanner/statistiek.py`

Rekent uit wat het scherm in stap 3.3 laat zien: per sessie de bruto duur, flex, benutte en
vrije minuten en de benutting in procenten; per plangroep hoeveel afspraken er staan tegenover
hoeveel er gevraagd zijn ("11 / 12"); en de totalen van een modaliteit.

- `sessie_stats` — Minuten en benutting van één sessie. Port van ``sessieStats``.
- `balans` — Per plangroep: ingepland tegenover gevraagd. Port van ``balans``.
- `mod_stats` — Totalen van een modaliteit (minuten, afspraken, vraag, benutting). Port van ``modStats``.

## `rasterplanner/opzoeken.py`

Kleine, pure functies die uit de state (hetzelfde JSON-object als de frontend bewaart) de
onderdelen halen die een rekenstap nodig heeft: de kamers en plangroepen van één modaliteit,
de sessies van een kamer in een vaste volgorde, de planregels van een kamer met standaarden
aangevuld, en het plan-item (afspraken en flexblokken) van één sessie.

- `standaard_planregels` — De planregels van een nieuwe kamer. Port van ``DEFAULT_PLANREGELS`` (``lib/data.js``).
- `mod_kamers` — De kamers van één modaliteit. Port van ``modKamers``.
- `mod_plangroepen` — De plangroepen van één modaliteit. Port van ``modPlangroepen``.
- `kamer_by_id` — De kamer met dit id, of ``None``. Port van ``kamerById``.
- `pg_by_id` — De plangroep met dit id, of ``None``. Port van ``pgById``.
- `mod_by_id` — De modaliteit met dit id, of ``None``. Port van ``modById``.
- `sessie_sort` — Vergelijker: dag, dan starttijd, dan dagdeel. Port van ``sessieSort``.
- `kamer_sessies` — De sessies van één kamer, gesorteerd. Port van ``kamerSessies``.
- `mod_sessies` — De sessies van alle kamers van één modaliteit, gesorteerd. Port van ``modSessies``.
- `sessie_gross` — Bruto duur van een sessie in minuten (eind − start, minimaal 0). Port van ``sessieGross``.
- `planregels_van` — De planregels van een kamer, aangevuld met de standaard. Port van ``planregelsVan``.
- `leeg_entry` — Een leeg plan-item: geen afspraken, geen flex. Port van ``leegEntry``.
- `get_entry` — Het plan-item van een sessie, of een leeg item. Port van ``getEntry``.
- `doel_sessies` — Aantal sessies dat volgens Invoerlijst 1 voor deze kamer nodig is. Port van ``doelSessies``.

## `rasterplanner/js_namen.py`

Koppelt elke functie uit de JavaScript-rekenkern (``frontend/src/engine/``) aan haar Python-port.
De pariteitstest roept functies op hun JavaScript-naam aan; dit register is ook een inhoudsopgave
voor wie wil weten waar een functie in Python staat.

## `rasterplanner/hulp/js.py`

De rekenkern is een letterlijke port van JavaScript. Een handvol dingen werkt in
JavaScript nét anders dan in Python, en precies die verschillen leveren rasters op
die "bijna" gelijk zijn: een afspraak die 5 minuten verschuift, een kamer die net
wel of net niet opengaat. Dit bestand bundelt die verschillen in kleine, geteste
helpers, zodat de rest van de code zich niet met de taal hoeft bezig te houden.

- `js_round` — ``Math.round``: halve waarden gaan naar boven (richting +oneindig).
- `js_floor` — ``Math.floor`` met dezelfde omgang met oneindig/NaN als JavaScript.
- `js_ceil` — ``Math.ceil``.
- `js_max` — ``Math.max(...lijst)``: bij een lege lijst -oneindig (of het meegegeven standaard).
- `js_min` — ``Math.min(...lijst)``: bij een lege lijst +oneindig (of het meegegeven standaard).
- `waar` — JavaScript-waarheid: ``0``, ``''``, ``None``, ``False``, ``NaN`` zijn onwaar; lege lijst/dict is WAAR.
- `of` — ``a || b || c``: de eerste JavaScript-ware waarde, anders de laatste.
- `nn` — ``a ?? b``: alleen bij ``None``/``UNDEF`` (null/undefined) de terugval.
- `getal` — ``+x`` met terugval: strings worden getallen, onzin wordt het standaardgetal (zoals ``+x||0``).
- `is_getal_sleutel` — Geldt deze sleutel in JavaScript als 'array index' (0, 1, 2, … als string of int)?
- `js_sleutels` — ``Object.keys(d)``: eerst getal-achtige sleutels oplopend, daarna de overige in invoegvolgorde.
- `js_entries` — ``Object.entries(d)`` in JavaScript-volgorde (zie ``js_sleutels``).
- `js_values` — ``Object.values(d)`` in JavaScript-volgorde.
- `js_sort_string` — ``arr.sort()`` zónder vergelijker: sorteert op de **tekst**-weergave (UTF-16), ook getallen.
- `js_tekst` — ``String(v)`` voor de gevallen die in de engine voorkomen (getallen, strings, None).
- `sorteer` — ``arr.slice().sort((a,b)=>…)``: stabiele sortering met een JavaScript-vergelijker.
- `sorteer_in_place` — ``arr.sort((a,b)=>…)`` ter plekke; geeft dezelfde lijst terug (zoals JavaScript).
- `to_fixed` — ``x.toFixed(n)`` voor de gevallen in de engine (n = 0..3, gewone grootte).
- `json_kloon` — ``JSON.parse(JSON.stringify(x))``: diepe kopie zonder functies/None-sleutels-verlies.
- `includes` — ``arr.includes(x)`` met de nuance dat ``None`` (ontbrekende lijst) onwaar geeft.
- `index_identiek` — ``arr.indexOf(x)`` op objectidentiteit; -1 als het object er niet in zit.
- `bevat_identiek` — ``arr.includes(x)`` op objectidentiteit.
- `verwijder_identiek` — ``arr.splice(arr.indexOf(x),1)``: verwijdert het object (als het erin zit) op identiteit.
- `prop` — ``obj.sleutel``: de waarde, of ``UNDEF`` als het veld ontbreekt (of ``d`` geen dict is).
- `js_is` — ``a === b``: strikte gelijkheid zoals JavaScript.
- `is_nan` — ``Number.isNaN(x)``.
- `jmax` — ``Math.max(a, b, …)``: NaN als één waarde NaN is; zonder waarden -oneindig.
- `jmin` — ``Math.min(a, b, …)``: NaN als één waarde NaN is; zonder waarden +oneindig.
- `slice_tot` — De eindindex van ``arr.slice(0, n)``: JavaScript kapt een gebroken ``n`` af (2.7 → 2).
- `json_schoon` — Zoals ``JSON.stringify`` het zou wegschrijven: velden met ``UNDEF`` (undefined) vallen weg,
- `js_getal_tekst` — ``${x}`` voor getallen in meldingsteksten: 75 → '75', 57.5 → '57.5', 60.0 → '60'.

## `rasterplanner/hulp/tijd.py`

Alle rekenregels rond klokTijden: ``"08:30"`` omzetten naar minuten sinds middernacht en
terug, afronden op het raster van 5 minuten, en de vaste volgorde van dagen (ma … zo) en
dagdelen (ochtend, middag, avond). Een letterlijke port van ``frontend/src/lib/util.js``.

- `to_min` — Tijd naar minuten sinds middernacht; ``NaN`` bij een ongeldige tijd. Port van ``toMin``.
- `fmt` — Minuten naar ``"HH:MM"`` (negatief wordt 0). Port van ``fmt``.
- `clamp` — ``Math.min(hi, Math.max(lo, v))``. Port van ``clamp``.
- `snap` — Afronden op een veelvoud van ``stap`` minuten (``Math.round``). Port van ``snap``.
- `dag_idx` — Positie van de dag in ma … zo, of -1. Port van ``dagIdx`` (``DAGEN.indexOf``).
- `dagdeel_idx` — Positie van het dagdeel in ochtend/middag/avond, of -1. Port van ``dagdeelIdx``.
- `som` — ``arr.reduce((t, x) => t + (f(x) || 0), 0)``: optellen waarbij NaN/None als 0 telt. Port van ``sum``.

## `rasterplanner/hulp/ids.py`

Elke nieuwe afspraak, elk flexblok en elke sessie krijgt een id met een voorvoegsel
(``a_…``, ``fx_…``, ``s_…``). In gewoon gebruik is dat willekeurig, net als in de browser.
Voor de pariteitstest moeten JavaScript en Python exact dezelfde id's uitdelen; dan zet de test
een teller (``a_1``, ``fx_2``, …). Port van ``uid``/``zetIdMaker``/``tellerIds`` in ``util.js``.

- `TellerIds` — Voorspelbare id's ``{p}_1``, ``{p}_2``, … (één teller voor alle voorvoegsels, zoals ``tellerIds``).
- `uid` — Een nieuw id met voorvoegsel ``p``. Port van ``uid``.
- `zet_id_maker` — Zet een eigen id-maker voor deze thread, of herstel het toeval met ``None``. Port van ``zetIdMaker``.
- `met_teller` — Tijdelijk de teller-id's (voor tests); daarna weer de vorige maker.

## `rasterplanner/hulp/spoor.py`

Als een voorstelraster niet is wat je verwacht, wil je weten in welke stap het misging:
kreeg een sessie te weinig ruimte door flexblokken, mocht een plangroep in te weinig sessies
(kamer of planmoment uit stap 3.1), of paste een afspraak bij de lay-out van de sessie niet
meer? Elke stap meldt zich hier met een vaste naam en een paar kerngetallen.

- `Spoor` — Verzamelt stappen met kerngetallen; licht genoeg om altijd mee te geven.

## `server.py`

De frontend (React) kan haar rekenwerk op drie manieren laten doen: in een Web Worker, in de
pagina zelf, of via deze server. Deze server neemt dezelfde "jobs" aan als
``frontend/src/engine/client.js`` in de browser maakt, en geeft precies dezelfde uitkomst terug
als de JavaScript-rekenkern (bewezen met de pariteitstest). Daarnaast serveert hij de gebouwde
frontend (``frontend/dist``), zodat één adres volstaat.

- `Diensten` — Houdt de opslag, ``Accounts`` en ``Standen`` van dit proces bij; maakt ze bij het eerste gebruik.
- `antwoord` — Altijd HTTP 200 met JSON; de inhoud bepaalt of het goed ging (``ok:false`` bij een fout).
- `fout_antwoord` — ``{ok:false, fout, type, spoor}`` — en de stacktrace in het logboek.
- `tijd_op` — De foutmelding als de tijdslimiet verloopt.
- `controleer_invoer` — Weiger invoer die de rekenkern onredelijk lang zou bezighouden (``ValueError`` met uitleg).
- `voer_uit` — Controleer en reken één job (``rasterplanner.jobs.voer_job_uit``).
- `reken_met_limiet` — Voer een berekening uit in een werkthread, met het gelijktijdigheidsslot en de tijdslimiet.
- `lees_body` — De JSON-body als dict; een kapotte of te grote body geeft een ``ValueError`` met een duidelijke tekst.
- `reken_route` — Gemeenschappelijke afhandeling van ``/api/voorstel``, ``/api/sessierooster`` en ``/api/analyse``.
- `health` — Leeft de server, welke versie, en is de rekenkern er? (vrij toegankelijk, voor monitoring)
- `api_voorstel` — Voorstelraster: body ``{state, modId, trace?}`` → ``{ok, plan, onplaatsbaar, meldingen}``.
- `api_sessierooster` — Sessierooster vullen: body ``{state, opties?, trace?}`` → ``{ok, sessies, toegevoegd, waarschuwingen}``.
- `api_analyse` — Balans en benutting: body ``{state, modId}`` → ``{ok, balans, stats, sessies}``.
- `api_batch` — Reeks jobs: body ``{jobs:[{type,args,trace?}]}`` → ``{ok, uit:[{ok:true,res}|{ok:false,err}]}``.
- `ok` — ``{ok:true, …}`` met HTTP 200.
- `fout_json` — ``{ok:false, fout}`` met de gegeven HTTP-status.
- `bron_van` — IP-adres (van de middleware, achter een proxy het echte adres) en browser voor het logboek.
- `sessie_van` — De sessie die de middleware heeft gecontroleerd (``None`` als er geen is).
- `cookie_kop` — ``Set-Cookie``-waarde voor de sessie; Secure als de browser HTTPS ziet.
- `account_actie` — Gemeenschappelijke afhandeling van een account-route.
- `api_login` — ``{gebruikersnaam, wachtwoord}`` → ``{ok, gebruiker}`` + cookie · 401 · 429 (met ``Retry-After``).
- `api_logout` — Sessie intrekken en de cookie wissen.
- `api_ik` — ``{ok, gebruiker}`` voor de ingelogde gebruiker · 401 (de middleware) · 503 zonder accounts.
- `api_wachtwoord` — ``{oud, nieuw}`` → ``{ok}``; overige sessies van deze gebruiker worden ingetrokken.
- `api_stand` — ``{ok, stand: {id, tijd, module, modus, data} | null}`` — de nieuwste van deze gebruiker.
- `api_stand_opslaan` — ``{data, module, modus, nieuwe_versie?}`` → ``{ok, id, tijd, nieuw}``; max 1 MB.
- `api_stand_versies` — ``{ok, versies:[{id, tijd, module, modus, grootte}]}``, nieuwste eerst.
- `api_stand_een` — ``{ok, stand}`` — één eigen versie (oudere versie terughalen → ``stand_hersteld`` in het logboek).
- `api_projecten` — ``{ok, projecten:[{id, naam, tijd, modus, grootte}]}`` — alle versies van de eigen projecten, nieuwste eerst.
- `api_project_opslaan` — ``{naam, data, modus?}`` → ``{ok, id, naam, tijd}``; elke aanroep is een nieuwe versie; max 1 MB.
- `api_project_een` — ``{ok, project:{id, naam, tijd, modus, data}}`` — één eigen versie (komt als ``project_geopend`` in het logboek).
- `api_project_verwijder` — ``{ok, verwijderd}`` — één eigen versie, of met ``?alle=1`` alle versies van dat project.
- `api_beheer_overzicht` — ``{ok, gebruikers, actief, logins_vandaag, mislukt_vandaag, opgeslagen_vandaag, sessies_actief}``.
- `api_beheer_gebruikers` — ``{ok, gebruikers:[…]}`` met de afgeleide kolommen (laatste login, aantal logins, …).
- `api_beheer_gebruiker_nieuw` — ``{gebruikersnaam, naam, rol, wachtwoord, moet_wachtwoord_wijzigen?}`` → ``{ok, gebruiker}`` · 409 bestaat al.
- `api_beheer_gebruiker_wijzig` — ``{naam?, rol?, actief?, wachtwoord?, moet_wachtwoord_wijzigen?}`` → ``{ok, gebruiker}`` · 404 · 409 laatste beheerder.
- `api_beheer_logboek` — ``?soort=&gebruiker_id=&limit=200&voor=<id>`` → ``{ok, regels, meer}`` (nieuwste eerst).
- `api_beheer_sessies` — ``{ok, sessies:[{id(afgekort), gebruiker_id, gebruikersnaam, aangemaakt, laatst_gezien, verloopt, ip, user_agent, huidig}]}``.
- `api_beheer_sessie_weg` — Sessie intrekken op het afgekorte id uit de lijst → ``{ok}`` · 404.
- `api_beheer_stand` — ``{ok, stand}`` — de nieuwste stand van die gebruiker (meekijken; komt als ``stand_bekeken`` in het logboek).
- `api_onbekend` — Onbekend API-pad: JSON-404 in plaats van FastAPI's standaardtekst.
- `statisch_pad` — Het bestand ``relatief`` binnen ``basis``, of ``None`` als het niet mag of niet bestaat.
- `stuur_bestand` — ``FileResponse`` met het vaste inhoudstype bij de extensie.
- `niet_gevonden` — Korte 404 voor een onbekend bestand.
- `frontend` — De gebouwde frontend, of een korte uitleg hoe je die bouwt.
- `assets` — Bestanden uit ``frontend/dist/assets`` (scripts, stijlen, workers van de Vite-build).
- `los_bestand` — Losse bestanden in de hoofdmap van ``frontend/dist`` (``login.html``, ``favicon.ico``, …).
- `main` — ``python server.py [--host 127.0.0.1] [--port 8000]``: start uvicorn zelf.

## `beveiliging.py`

De rekenserver (``server.py``) mag op internet alleen gebruikt worden door wie een account
heeft, de rekenkracht mag niet door een vreemde worden leeggetrokken, en de browser moet weten
wat hij wél en niet mag laden. Dit bestand bundelt die maatregelen in één ASGI-middleware
(``Beveiliging``) plus een paar helpers. Het inloggen zelf (gebruikers, wachtwoorden, sessies in
de database) zit in ``accounts.py``; deze middleware vraagt per verzoek alleen "is deze
sessiecookie geldig?" via een functie die ``server.py`` meegeeft.

- `bepaal_geheim` — De sleutel voor de sessiecookie: ``RASTERPLANNER_GEHEIM``, of anders automatisch afgeleid van de databasesleutel.
- `Instellingen` — Alle beveiligingsinstellingen, gelezen uit de omgeving (zie module-docstring).
- `token_klopt` — ``Authorization: Bearer <token>`` voor scripts, alleen als er een token is ingesteld (constante tijd).
- `sessie_cookie` — De ``Set-Cookie``-waarde voor ``rasterplanner_sessie`` (HttpOnly, SameSite=Strict, Path=/, Secure achter HTTPS).
- `Teller` — Glijdend venster per sleutel (adres); klein genoeg om in het geheugen te houden.
- `kop` — Eerste waarde van HTTP-kop ``naam`` (hoofdletterongevoelig), of ``None``.
- `cookies_van` — Alle cookies uit de ``Cookie``-kop als dict.
- `adres_van` — Het clientadres; achter een proxy het eerste adres uit X-Forwarded-For.
- `is_https` — Ziet de browser deze verbinding als HTTPS? (zelf, via ``RASTERPLANNER_HTTPS`` of via X-Forwarded-Proto).
- `eigen_herkomst` — ``https://host`` zoals de browser het ziet (achter een proxy via X-Forwarded-Host/Proto).
- `herkomst_toegestaan` — CSRF-controle voor schrijvende verzoeken: Origin (of Referer) moet de eigen herkomst zijn, of
- `standaard_csp` — Content-Security-Policy. De Vite-build laadt scripts uit /assets (strikt); het losse
- `is_vrij` — Mag dit verzoek zonder sessie? (ACCOUNTS.md §4)
- `Beveiliging` — ASGI-middleware om de FastAPI-app heen (zie module-docstring voor wat ze doet).

## `opslag.py`

Eén kleine interface voor alle database-toegang, met twee uitvoeringen die precies dezelfde
SQL (gewone SQLite-SQL met ``?``-parameters) uitvoeren:

- ``SqliteOpslag``: een SQLite-bestand via de standaardmodule ``sqlite3`` — voor een eigen
  server, lokaal ontwikkelen en de tests. Pad: ``RASTERPLANNER_DB_PAD`` (standaard
  ``backend/data/rasterplanner.db``).
- ``TursoOpslag``: Turso (gehoste SQLite, libSQL) via de HTTP-pipeline-API
  ``POST {url}/v2/pipeline`` — voor Vercel, waar geen blijvende schijf is. Alleen ``urllib``
  uit de standaardbibliotheek, geen extra pakket.

De rest van de backend (``accounts.py``, ``stand.py``) weet niet welke van de twee draait.

- `OpslagFout` — De database is niet ingesteld, niet bereikbaar, of weigerde een opdracht (tekst van de server erin).
- `Uitkomst` — Resultaat van ``voer_uit``: rowid van de laatst ingevoegde rij en het aantal gewijzigde rijen.
- `tijd_iso` — Tijd in UTC als ISO-tekst zonder fracties, bv. ``2026-10-20T11:42:05Z`` (``t`` = Unix-tijd, standaard nu).
- `iso_naar_unix` — Omgekeerde van ``tijd_iso``: ``2026-10-20T11:42:05Z`` → Unix-tijd (float).
- `iso_minus` — ISO-tijd van ``seconden`` geleden (voor vensters als "de laatste 15 minuten").
- `begin_vandaag_iso` — Middernacht van vandaag in Nederland (Europe/Amsterdam), als UTC-ISO-tekst.
- `Opslag` — Gemeenschappelijke interface. Subklassen leveren ``_voer`` (één opdracht) en ``transactie``.
- `SqliteOpslag` — SQLite-bestand via ``sqlite3``: één verbinding per proces, achter een slot (zie module-docstring).
- `naar_hrana` — Python-waarde → Hrana-waarde. ``bool`` wordt een integer (0/1), zoals in SQLite.
- `van_hrana` — Hrana-waarde → Python-waarde (integer-tekst → ``int``, blob → ``bytes``).
- `http_url` — ``libsql://x.turso.io`` → ``https://x.turso.io`` (ook ``wss://`` → ``https://``, ``ws://`` → ``http://``).
- `TursoOpslag` — Turso/libSQL via ``POST {url}/v2/pipeline`` (zie module-docstring).
- `opslag_uit_omgeving` — Maak de opslag die bij de omgeving hoort en zorg dat het schema er is.

## `accounts.py`

Alles rond "wie ben je en wat mag je" voor Radiologie Rasterplanner, volgens ``ACCOUNTS.md``:
persoonlijke accounts (rol ``beheer`` of ``gebruiker``), wachtwoorden als PBKDF2-hash, inloggen
met een blokkade na te veel mislukte pogingen, sessies in de database plus een ondertekend
cookie-token, en een logboek dat de beheerder kan doorzoeken. De HTTP-kant (routes, cookies
zetten) zit in ``server.py``; dit bestand is zuivere logica bovenop ``opslag.py``.

- `Fout` — Een fout die als ``{ok:false, fout}`` met HTTP-status ``status`` naar de browser gaat.
- `Bron` — Waar een verzoek vandaan komt, voor het logboek: IP-adres en browser (user-agent, ingekort).
- `Sessie` — Een gecontroleerde, geldige sessie: id, de gebruiker (zoals nu in de database) en de vervaltijd.
- `hash_wachtwoord` — PBKDF2-HMAC-SHA256 → ``pbkdf2_sha256$<iter>$<zout b64>$<hash b64>`` (standaard-base64).
- `wachtwoord_klopt` — Controleer ``wachtwoord`` tegen een opgeslagen hash, in constante tijd. Kapotte hash → ``False``.
- `controleer_wachtwoord_eisen` — Eisen aan een nieuw wachtwoord (minimaal 10 tekens); geeft het wachtwoord terug of ``Fout(400)``.
- `b64url` — Base64url zonder ``=``-opvulling (zoals JWT).
- `b64url_terug` — Omgekeerde van ``b64url`` (vult de ``=`` zelf aan); ``ValueError`` bij ongeldige tekens.
- `maak_token` — Token volgens ACCOUNTS.md §3: ``b64url(payload_json) + "." + b64url(HMAC_SHA256(geheim, b64url(payload_json)))``.
- `lees_token` — Controleer handtekening en ``exp`` van een token; geeft de payload of ``None``.
- `Accounts` — Gebruikers, login, sessies en logboek bovenop één ``Opslag`` (zie module-docstring).

## `stand.py`

De frontend slaat de stand van de tool (kamers, sessierooster, plangroepen, planregels,
planraster, het actieve scherm) automatisch op via ``PUT /api/stand``. Dit bestand bewaart die stand per
gebruiker als JSON-tekst in de tabel ``standen``, houdt de laatste 30 versies (een versie
per werkblok van 10 minuten, zie hieronder), en geeft de
nieuwste, de lijst van versies of één versie terug. De beheerder kan de nieuwste stand van
een gebruiker inzien (om mee te kijken bij een vraag). De inhoud zelf bekijkt de backend
niet, alleen de grootte.

- `Standen` — Opgeslagen standen per gebruiker (zie module-docstring).

## `projecten.py`

Naast de automatische stand ("verder waar je was", stand.py) kan een gebruiker zelf op
**Opslaan** klikken. Dan wordt het hele werk (kamers, sessierooster, plangroepen, planregels,
planraster) bewaard onder een projectnaam, met de tijd erbij. In de tool verschijnt dat
als "Regulier 2027 26-10-2026 08:00". Elke klik op Opslaan maakt een nieuwe versie; eerdere
versies van hetzelfde project blijven staan. Later kun je elke versie weer inladen.

Het verschil met de stand: de stand wordt elke paar seconden automatisch bijgewerkt en er
worden maar 30 werkblokken bewaard. Een project blijft staan tot de gebruiker het zelf
verwijdert (binnen de grenzen hieronder).

- `schoon_naam` — Projectnaam opschonen en controleren; ``Fout(400)`` als hij niet bruikbaar is.
- `Projecten` — Opgeslagen projecten per gebruiker (zie module-docstring).
