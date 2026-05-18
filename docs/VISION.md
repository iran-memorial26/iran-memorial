# Vision — Iran Memorial

---

## Executive Summary (English)

> **They had names. They had faces. They had lives.**
> **Most of them were never properly documented.**

### Mission

Iran Memorial is a digital platform dedicated to **preserving the memory of every individual killed by the Islamic Republic of Iran since 1979** — across generations of repression, from the mass executions of the 1980s to the protests of today.

Our mission is to ensure that **every victim is remembered as a human being** — with a story, identity, and dignity — and not forgotten over time.

For decades, victims have been **erased twice**: first by violence, and then by silence.

**This project exists to break that silence.**

Many families have told us the same thing: *they wish the resistance against the regime that killed their loved ones does not die with them — otherwise their loved ones would have died for nothing.* Our second mission flows directly from that wish, expressed by the families themselves. Iran Memorial is built to be **fully transparent, structured, citable, and machine-readable**, so that researchers, journalists, lawyers, NGOs, and human-rights bodies can carry forward — in the name of the families and the victims — the truth-telling, the documentation, and the accountability work that the families have asked us to make possible. Transparency here is not a political weapon and not an agenda of ours. It is a service rendered to the people who lost someone, and a refusal to let silence finish what state violence began.

### What this is

Iran Memorial is a **community-driven, open-source, non-commercial memorial project**.

- **Community-driven** — families, witnesses, journalists, researchers, NGOs, translators, and developers contribute and review. Maintainership is plural by design.
- **Open-source** — code under [MIT](../LICENSE), data under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Every record is auditable, every source is citable, every server is reproducible (`git clone && docker compose up`).
- **Non-commercial** — no ads, no paywall, no fundraising platform, no investors. The platform exists for the victims, their families, and historical accountability — not for revenue.
- **No political agenda** — every victim of state violence deserves remembrance, regardless of faction, ethnicity, religion, or era. We document; we do not endorse.

This is not a single founder's project that happens to accept patches. It is a **public-interest digital memorial** that the maintainers steward on behalf of the community, with a long-term goal of independent stewardship (foundation, NGO partnership, or public-trust governance) once the project's reach justifies it.

### Why This Matters

Many victims of repression in Iran are:
- **Poorly documented** — scattered across fragmented sources
- **Misrepresented** — reduced to statistics without context
- **Completely forgotten** — lost to time as attention fades

Without a reliable and unified record, history risks being rewritten — or forgotten entirely. Iran Memorial addresses this gap by creating a **permanent, independent source of truth**.

### What Makes It Different

While existing initiatives often focus on isolated events or specific timeframes, Iran Memorial brings together fragmented data into a **single, comprehensive, and continuously growing archive**.

Each entry is more than a statistic — **it is a human story**:
- A name
- A face
- A life that mattered

Presented in a **structured, verified, and accessible format**.

### Target Audience

Iran Memorial serves:
- **Families and friends of victims** — a dignified space of remembrance
- **Journalists** — a trusted, consolidated data source
- **Researchers & historians** — a comprehensive historical archive
- **The global community** — understanding the scale and continuity of repression
- **Future generations** — a foundation for accountability and justice

### Approach

Iran Memorial is built on these principles:

**Independent & Non-Commercial**
No political agenda, no profit motive. Driven solely by the responsibility to remember.

**Evidence-Based & Transparent**
Data aggregated from multiple verified sources. Credibility ratings for every source organization. Clear documentation of data provenance.

**Open & Collaborative**
Designed for community contributions. Future open API for data access and integrations. Scalable through collaboration with researchers and the diaspora.

**Respectful & Human-Centered**
Every victim presented with dignity. Focus on personal stories, not just statistics. Multilingual (English, German, Farsi) for global accessibility.

### Standards & Interoperability

For Iran Memorial to be useful to the families and to the people working in their name, it has to be more than a website — it has to be a citable, machine-readable, audit-ready archive that researchers, NGOs, journalists, and courts can reuse without asking permission. We hold ourselves to the highest open data standards we can find, not as ambition for its own sake, but because every family deserves to know that the record of their loved one will stand up to scrutiny in any forum, on any platform, for as long as the web exists.

We target the following open standards:

- **schema.org/Person** — every victim page emits a full `Person` JSON-LD block (already partly shipped), including `hasOccupation`, `alumniOf`, `sameAs` (social handles), and `knowsLanguage`. This makes individual victims surface natively in Google Knowledge Panels, Siri, and any LLM that respects structured web data.
- **schema.org/Dataset** — the archive itself is published as a `Dataset` with DOI, license, version, and distribution endpoints, so it appears in Google Dataset Search and is treatable as a primary academic source.
- **FAIR data principles** — Findable (persistent identifiers, DOIs via Zenodo), Accessible (open HTTPS + Tor + IPFS mirrors), Interoperable (JSON-LD, CSV, XML), Reusable (CC BY-SA 4.0, full provenance per record).
- **HURIDOCS Events Standard Format** — the human-rights-NGO interchange standard. Export endpoint planned so Amnesty International, FIDH, OHCHR-style organizations can ingest our data into their own case-management systems with zero glue code.
- **Open `/api/v1`** — public, documented, rate-limited REST API plus bulk dump (`/api/v1/public/dump`) plus MCP server. Any programmer, journalist, or AI agent can query the archive without an account.
- **Machine-readable bibliography** — every record carries citable sources with stable URLs, source organization metadata, and credibility ratings, so the data can be audited and contested in detail rather than as a whole.

The goal is simple: if a researcher in Geneva, a prosecutor in The Hague, a journalist in Toronto, and an LLM running locally on a laptop in Tehran all need the same fact, they should all be able to get it — in the same structured form, with the same provenance, without contacting us first.

### Impact

**A Permanent Historical Record**
As global attention fades between protest waves, documentation becomes even more critical. Iran Memorial creates a **permanent archive** that cannot be erased or rewritten.

**Truth & Accountability**
By documenting the scale and continuity of state violence, the platform lays groundwork for:
- International accountability mechanisms
- Legal proceedings (domestic and international)
- Truth and reconciliation processes

**Breaking the Silence**
Every documented victim is an act of defiance against state-imposed amnesia. Their stories challenge:
- Regime propaganda that denies or minimizes violence
- Historical revisionism that erases inconvenient truths
- Public indifference born from information fatigue

### Vision

Iran Memorial is designed to grow beyond a single platform:

**Phase 1 (Current): Foundation**
- Comprehensive victim database (37,008+ victims documented — see README badge for live counts)
- 15 verified data sources with credibility ratings
- Multilingual interface (16 languages including FA/EN/DE/AR — 5 RTL)
- Interactive timeline, map, and statistics
- Open `/api/v1` + MCP server + public bulk dump (CC BY-SA 4.0)

**Phase 2: Community & Collaboration**
- Open API for data access and integrations
- Contribution system for families and witnesses
- Verification workflow for community submissions
- Partnerships with journalism and research institutions

**Phase 3: Ecosystem**
- Most complete and authoritative record of victims worldwide
- Integration with international accountability efforts
- Educational resources for schools and universities
- Memorial events and physical installations

### Closing

This is not just a website.
**It is an act of remembrance.**
**And a refusal to let thousands of lives disappear into silence.**

Every name. Every story. Every life.
**Remembered.**

---

**Project Status:** v0.7.6 | 30,795 victims | 280 tests | Live at [<DEPLOYMENT_DOMAIN>](<DEPLOYMENT_URL>)

---

## Vision (Deutsch)

> Lebendes Dokument. Neue Ideen werden hier gesammelt, bevor sie in einen Plan wandern.
> Kernidee bleibt stabil. Alles andere wächst und wird präziser.

---

## Kernidee (1 Satz)

**Jedes Opfer der Islamischen Republik Iran bekommt einen Namen, ein Gesicht und eine Geschichte — für immer, für alle, in jeder Sprache.**

## Zweite Mission — im Sinne der Familien

Viele Angehörige haben uns dasselbe gesagt: *Sie wünschen sich, dass der Widerstand gegen die Regierung, die ihre Liebsten getötet hat, nicht mit dem Tod ihrer Liebsten erstickt — ansonsten wären sie für nichts gestorben.* Aus diesem Wunsch der Familien ergibt sich unsere zweite Mission. Iran Memorial wird **vollständig transparent, strukturiert, zitierbar und maschinenlesbar** aufgebaut, damit Forscher:innen, Journalist:innen, Anwält:innen, NGOs und Menschenrechts-Institutionen — *im Namen der Familien und der Opfer* — die Wahrheits-, Dokumentations- und Verantwortlichkeitsarbeit fortführen können, die die Familien selbst sich wünschen.

Transparenz ist hier keine politische Waffe und keine Agenda unsererseits. Sie ist ein Dienst an den Menschen, die jemanden verloren haben — und eine Weigerung, das Schweigen vollenden zu lassen, was die staatliche Gewalt begonnen hat.

---

## Was ist das hier?

Iran Memorial ist ein **community-getragenes, open-source, nicht-kommerzielles Gedenkprojekt**.

- **Community-getragen** — Familien, Zeitzeugen, Journalist:innen, Forscher:innen, NGOs, Übersetzer:innen und Entwickler:innen tragen bei und prüfen mit. Maintainership ist von Beginn an plural angelegt.
- **Open Source** — Code unter [MIT](../LICENSE), Daten unter [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Jeder Eintrag ist auditierbar, jede Quelle zitierbar, jede Instanz reproduzierbar (`git clone && docker compose up`).
- **Nicht-kommerziell** — keine Werbung, keine Paywall, keine Spendenplattform, keine Investoren. Die Plattform existiert für die Opfer, ihre Familien und historische Verantwortung — nicht für Erlöse.
- **Keine politische Agenda** — jedes Opfer staatlicher Gewalt verdient Gedenken, unabhängig von Fraktion, Ethnie, Religion oder Epoche. Wir dokumentieren; wir parteiergreifen nicht.

Das ist kein Solo-Projekt das hin und wieder Patches annimmt. Es ist ein **digitales Gedenken im öffentlichen Interesse**, das die aktuellen Maintainer treuhänderisch für die Community führen — mit dem langfristigen Ziel einer unabhängigen Trägerschaft (Stiftung, NGO-Partnerschaft oder öffentlich-rechtliche Governance), sobald die Reichweite das rechtfertigt.

---

## Warum existiert dieses Projekt?

### Das Problem

Seit 1979 hat die Islamische Republik Iran Hunderttausende Menschen getötet — politische Gefangene, Demonstranten, Intellektuelle, ethnische und religiöse Minderheiten, Frauen, Kinder. Die Zahlen sind so groß, dass sie abstrakt werden. **Abstrakte Zahlen erzeugen keine Empathie.** Eine Zahl wie "30.000 Hingerichtete im Sommer 1988" ist schwer zu begreifen. Aber die Geschichte eines einzelnen Menschen — sein Name, sein Traum, die Umstände seines Todes, die Trauer seiner Familie — das ist begreifbar.

### Was fehlt

- **Keine zentrale, öffentliche Datenbank** aller Opfer. Die Daten sind verstreut über NGO-Berichte, Zeitungsartikel, Familienzeugnisse und Gerichtsdokumente.
- **Keine Verknüpfung** zwischen Einzelschicksalen und dem größeren historischen Kontext. Wer war Maryam Kazemi? In welchem Massaker starb sie? Wer gab den Befehl?
- **Kein mehrsprachiger Zugang.** Farsi-Quellen sind für die internationale Öffentlichkeit unzugänglich. Englische Berichte erreichen die iranische Diaspora nur teilweise.
- **Keine offenen Daten.** Forscher, Journalisten und Juristen können die Daten nicht systematisch nutzen.

### Was dieses Projekt verändern soll

1. **Individualisierung:** Jedes Opfer wird aus einer Statistik zu einem Menschen mit eigenem Profil.
2. **Kontextualisierung:** Jedes Schicksal wird in den historischen Zeitstrahl eingebettet — von der Revolution 1979 bis heute.
3. **Zugänglichkeit:** Dreisprachig (Farsi, Englisch, Deutsch), offen, durchsuchbar, zitierfähig.
4. **Beweissicherung:** Quellen, Zeugenaussagen und Dokumente werden systematisch erfasst und archiviert.
5. **Gemeinschaft:** Familien, Zeitzeugen und Forscher können Informationen beitragen.

---

## Für wen ist es?

### Primäre Zielgruppen

| Zielgruppe | Bedürfnis | Wie wir es erfüllen |
|---|---|---|
| **Familien der Opfer** | Ihren Angehörigen ein würdiges Denkmal setzen. Gesehen und gehört werden. | Persönliche Opfer-Seiten mit Fotos, Geschichten, Zitaten. Möglichkeit, selbst beizutragen. |
| **Iranische Diaspora** | Die eigene Geschichte kennen und weitergeben. | Farsi + Deutsch (für DACH-Diaspora). Teilbare Links. Bildungsmaterialien. |
| **Internationale Öffentlichkeit** | Verstehen, was im Iran geschieht und geschehen ist. | Englische Inhalte. Visueller Zeitstrahl. Statistiken. Kontext. |
| **Forscher & Journalisten** | Belastbare Daten für Analysen, Artikel, Dokumentationen. | Offene Datenbank. API. CSV/JSON-Export. Quellenangaben. Zitierfähig. |
| **Menschenrechtsorganisationen** | Dokumentation für Advocacy, Berichte, juristische Verfahren. | Strukturierte Daten. Verifizierungsstatus. Quellenverknüpfung. |
| **Juristen & Gerichte** | Beweismaterial für Verfahren (z.B. Aban Tribunal, ICC). | Quellentypen (Zeuge, NGO-Bericht, Gerichtsdokument). Verifizierungsstatus. Unveränderliche Archivierung. |

### Sekundäre Zielgruppen

| Zielgruppe | Bedürfnis |
|---|---|
| **Lehrer & Bildungseinrichtungen** | Material für Unterricht über Iran, Menschenrechte, Demokratie |
| **Künstler & Filmemacher** | Recherche-Grundlage für Werke, die Aufmerksamkeit erzeugen |
| **Politische Entscheidungsträger** | Faktenbasierte Grundlage für Sanktions- und Asyl-Entscheidungen |

---

## Welche Wirkung soll es haben?

### Unmittelbare Wirkung
- Familien finden ihre Angehörigen in einem würdevollen digitalen Denkmal
- Die iranische Diaspora hat eine Ressource zum Erinnern und Teilen
- Journalisten können schnell und zuverlässig recherchieren

### Mittelfristige Wirkung
- Forscher nutzen die offene Datenbank für akademische Arbeiten
- Menschenrechtsorganisationen verweisen in Berichten auf das Memorial
- Schulen und Universitäten nutzen die Seite als Bildungsressource

### Langfristige Wirkung
- Ein vollständiges, öffentlich zugängliches Archiv aller dokumentierbaren Opfer der Islamischen Republik
- Die Daten fließen in juristische Verfahren (ICC, nationale Gerichte, Tribunal-Initiativen)
- Das Projekt wird zur Referenz, wie die iranische Zivilgesellschaft digitalen Holocaust-Gedenkstätten nach Yad Vashem nachfolgt
- Ein freies Iran nutzt diese Daten für Transitional Justice und nationale Aufarbeitung

---

## Standards & Interoperabilität

Damit Iran Memorial den Familien und denjenigen, die in ihrem Namen arbeiten, wirklich nützt, muss es mehr sein als nur eine Website — es muss ein zitierbares, maschinenlesbares, audit-fähiges Archiv sein, das Forscher:innen, NGOs, Journalist:innen und Gerichte ohne Rückfrage weiterverwenden können. Wir messen uns an den höchsten offenen Datenstandards, die wir finden — nicht aus Ehrgeiz, sondern weil jede Familie verdient zu wissen, dass der Eintrag ihres Liebsten in jedem Forum, auf jeder Plattform, so lange das Web existiert, einer Prüfung standhält.

Wir zielen auf folgende offene Standards:

- **schema.org/Person** — jede Opfer-Seite emittiert einen vollständigen `Person`-JSON-LD-Block (teilweise bereits live), inklusive `hasOccupation`, `alumniOf`, `sameAs` (Social-Handles) und `knowsLanguage`. Damit erscheinen einzelne Opfer nativ in Google Knowledge Panels, Siri und in jedem LLM, das strukturierte Web-Daten respektiert.
- **schema.org/Dataset** — das Archiv selbst wird als `Dataset` mit DOI, Lizenz, Version und Distribution-Endpunkten publiziert, sodass es in Google Dataset Search erscheint und als wissenschaftliche Primärquelle behandelt werden kann.
- **FAIR-Prinzipien** — Findable (persistente IDs, DOIs via Zenodo), Accessible (offen über HTTPS + Tor + IPFS-Mirrors), Interoperable (JSON-LD, CSV, XML), Reusable (CC BY-SA 4.0, vollständige Provenienz pro Eintrag).
- **HURIDOCS Events Standard Format** — der NGO-Interchange-Standard für Menschenrechtsdokumentation. Export-Endpoint geplant, damit Amnesty International, FIDH, OHCHR-nahe Organisationen unsere Daten ohne Glue-Code in ihre Case-Management-Systeme übernehmen können.
- **Offene `/api/v1`** — öffentliche, dokumentierte, rate-limitierte REST-API plus Bulk-Dump (`/api/v1/public/dump`) plus MCP-Server. Jede:r Programmierer:in, Journalist:in oder AI-Agent kann das Archiv abfragen, ohne Account.
- **Maschinenlesbare Bibliographie** — jeder Eintrag trägt zitierfähige Quellen mit stabilen URLs, Quellen-Organisations-Metadaten und Glaubwürdigkeits-Ratings, sodass die Daten im Detail (nicht nur als Ganzes) auditierbar und anfechtbar sind.

Das Ziel ist einfach: wenn eine Forscherin in Genf, ein Staatsanwalt in Den Haag, eine Journalistin in Toronto und ein lokal laufendes LLM auf einem Laptop in Teheran dieselbe Tatsache brauchen, sollen sie alle dieselbe Antwort bekommen — in derselben strukturierten Form, mit derselben Provenienz, ohne uns vorher kontaktieren zu müssen.

---

## Inspiration und Referenzen

### Digitale Gedenkstätten

| Projekt | Was sie gut machen | Was wir lernen können |
|---|---|---|
| **Yad Vashem — Central Database of Shoah Victims' Names** | 4,8 Mio. Namen. Familienmitglieder können "Pages of Testimony" einreichen. Jedes Opfer hat eine eigene Seite. | Das Modell "Jedes Opfer hat eine Seite" funktioniert auch bei Millionen. Community-Beiträge (Pages of Testimony) sind der Schlüssel zur Skalierung. |
| **USC Shoah Foundation — Visual History Archive** | 55.000 Videointerviews mit Überlebenden. Indexiert, durchsuchbar, mehrsprachig. | Zeitzeugen-Testimonies als eigenständiger Dokumenttyp. Videoarchive als spätere Erweiterung. |
| **Arolsen Archives — #everynamecounts** | 110 Mio. Dokumente. Crowdsourcing: 40 Mio. Namen von Freiwilligen digitalisiert. 15.000+ Volunteers in Challenges. | Crowdsourcing-Modell für Datenerfassung. Gamification (Challenges) motiviert Freiwillige. Dreifache Verifikation (jedes Dokument von 3 Personen bearbeitet). |
| **Vietnam Veterans Memorial Wall (Digital)** | 58.318 Namen, durchsuchbar. Besucher können Fotos und Erinnerungen hinterlassen. | Einfache, respektvolle Präsentation. Die Kraft eines einzelnen Namens auf einer Wand. |
| **AIDS Memorial Quilt (Digital Archive)** | 50.000 Panels online durchsuchbar. Library of Congress hat 150.000 persönliche Objekte digitalisiert. | Persönliche Objekte (Fotos, Briefe, Tagebücher) erzählen menschliche Geschichten jenseits von Statistiken. |

### Menschenrechtsdokumentation

| Projekt | Was sie gut machen | Was wir lernen können |
|---|---|---|
| **Boroumand Foundation — Omid Memorial** | Tausende iranische Opfer mit detaillierten Profilen. Farsi + Englisch. Die wichtigste bestehende Iran-Opfer-Datenbank. | Datenstruktur als Referenz. Mögliche Partnerschaft für Datenimport. Ergänzung, nicht Konkurrenz. |
| **Iran Human Rights (IHR)** | Aktuelle Dokumentation von Hinrichtungen und Tötungen. Jährliche Berichte. | Laufende Datenquelle. Kooperationsmöglichkeit für aktuelle Fälle. |
| **HRANA (Human Rights Activists News Agency)** | Schnelle Dokumentation bei laufenden Protesten. Namentliche Listen. | Wichtig für aktuelle Ereignisse (2022, 2026). Daten-Partnerschaft. |
| **Syrian Archive** | Systematische Archivierung von Beweismaterial (Videos, Fotos) aus dem syrischen Konflikt. | Beweissicherungsstandards. Metadaten-Schema. Zusammenarbeit mit Gerichten. |
| **Colombian Truth Commission (Digital Archive)** | 140 TB digitales Archiv. 30.000 Interviews. Transmedia-Plattform mit 200.000 Dateien. Zusammenarbeit mit Forensic Architecture für Datenvisualisierung. | Maßstab für Archiv-Aufbau. Transmedia-Ansatz: verschiedene Formate (Text, Video, Karten, Statistiken) für verschiedene Zielgruppen. Chatbot "Ventana a la Verdad" als Zugangsebene. |

### Design und Darstellung

| Aspekt | Inspiration | Anwendung |
|---|---|---|
| **Dunkles, würdevolles Design** | Holocaust-Gedenkstätten, Kriegsdenkmäler | Dunkler Hintergrund, gedämpfte Farben, Gold-Akzente für Würde |
| **Jeder Name zählt** | Vietnam Memorial Wall, Arolsen Archives | Opfer als Individuen, nie nur als Zahlen |
| **Interaktiver Zeitstrahl** | Timeline.js, d3.js basierte historische Visualisierungen | Zoom, Filter, Verknüpfung mit Opferprofilen |
| **Karten-Visualisierung** | Crisis maps, Forensic Architecture | Todesorte, Massengräber, Gefängnisse auf interaktiver Karte |
| **Kerzen-Metapher** | Virtuelle Kerzenaktionen, Lichterketten bei Gedenkveranstaltungen | Kerzenschein-Animation als subtiles Designelement |

---

## Ideensammlung

> Unpriorisiert. Alles willkommen. Nicht jede Idee wird umgesetzt. Ideen wandern erst in einen Plan, wenn sie priorisiert und bewertet wurden.

### Kern-Features (essenziell für die Vision)

- [ ] **Individuelle Opfer-Seiten** — Wikipedia-Stil. Name, Foto, Lebensgeschichte, Todesumstände, Nachwirkungen, Quellen. Jedes Opfer ein Mensch, keine Statistik.
- [ ] **Chronologischer Zeitstrahl** — Alle Ereignisse von 1979 bis heute. Klickbar. Verknüpft mit Opfern.
- [ ] **Dreisprachigkeit** — Farsi (RTL), Englisch, Deutsch. Von Anfang an, nicht nachträglich.
- [ ] **Volltextsuche** — Name (Farsi + Latin), Ort, Ereignis, Umstände. Fuzzy-tolerant.
- [ ] **Offene Datenbank** — JSON/CSV-Export. API für Forscher. Maximale Transparenz.
- [ ] **Community-Einreichungen** — Familien und Zeitzeugen können Informationen über Opfer einreichen.
- [ ] **Quellenverknüpfung** — Jede Information mit Quelle belegt. Verschiedene Quellentypen (NGO, Zeuge, Gericht, Medien).
- [ ] **Verifizierungssystem** — Status pro Opfer: unverifiziert, verifiziert, umstritten. Transparenz über Datensicherheit.

### Darstellung und Erlebnis

- [ ] **"Ein Name, ein Gesicht"** — Startseite zeigt bei jedem Besuch ein zufälliges Opfer. Personalisiert die Erfahrung.
- [ ] **Statistische Dashboards** — Tötungen nach Jahr, Provinz, Alter, Geschlecht, Todesart. Visualisiert das Ausmaß.
- [ ] **Interaktive Karte** — Todesorte, Gefängnisse, Massengräber, Protestorte auf einer Karte. Heatmap der Gewalt.
- [ ] **"An diesem Tag"** — Tägliche Anzeige: Wer wurde an diesem Kalendertag getötet? Fakten + Datum. Bringt vergessene Opfer ans Licht. Kein Algorithmus, keine Personalisierung.
- [ ] **Gedenkkalender** — Markierte Tage im Kalender (16. September = Mahsa Amini, 19. Juli = Beginn 1988 Massaker, etc.)
- [ ] **Audio-Testimonies** — Aufgezeichnete Erinnerungen von Familienmitgliedern. Stimmen statt nur Text.
- [ ] **Foto-Galerie** — Vor dem Tod: lebensfrohe Bilder. Nicht nur Passfotos. Die Person zeigen, nicht das Opfer.
- [ ] **Timeline-Animation** — Beim Scrollen durch den Zeitstrahl erscheinen Opfer als Punkte, die sich verdichten. Visuell das Ausmaß zeigen.
- [ ] **Vergleichsperspektive** — Kontextualisierung: "In der Zeit, die Sie zum Lesen dieser Seite gebraucht haben, wurden im Sommer 1988 durchschnittlich X Menschen hingerichtet."
- [ ] **Dunkelheit als Design** — Hintergrund wird dunkler bei den schlimmsten Perioden (1988, 2019, 2026). Subtile emotionale Führung.

### User-Engagement — Gedenken und Wahrheitsfindung

> **Oberstes Gebot: Maximum Truth-Seeking.** Jede Interaktionsmöglichkeit muss entweder dem Gedenken oder der Wahrheitsfindung dienen. Wenn sie keines von beiden tut, gehört sie nicht auf die Seite. Die Seite bleibt clean — kein Social-Media-Rauschen, keine Engagement-Metriken, keine Gamification.

**Gedenken:**

- [ ] **Virtuelle Kerze** — Ein Klick, ein Zähler. "4.328 Menschen gedenken Mahsa Amini." Keine Registrierung nötig. Subtile Kerzenschein-Animation auf der Opfer-Seite. Kein Like-Button, kein Social Feature — ein stiller Akt des Gedenkens.

**Wahrheitsfindung (crowdsourced):**

- [ ] **"Ich kannte diese Person"** — Verifizierte Augenzeugenberichte direkt auf der Opfer-Seite. Nicht Kommentare, sondern strukturierte Testimonies: "Ich war sein Nachbar / ihre Kommilitonin / sein Zellengenosse." Durchläuft Editorial Review. Gleichzeitig Engagement UND Beweissicherung.
- [ ] **Quellen-Beitrag** — "Sie haben eine Quelle zu dieser Person?" Button auf jeder Opfer-Seite. Strukturiert: URL + Quellentyp + Datum. Direkt ans Verifizierungsteam. Macht User zu Wahrheits-Suchern.
- [ ] **Korrekturen melden** — "Etwas stimmt nicht?" Diskreter Link. Strukturiertes Formular: Welches Feld? Was ist falsch? Was ist korrekt? Quelle? Crowdsourced Fact-Checking im Dienst der Wahrheit.
- [ ] **Fehlende Informationen ergänzen** — Opfer-Seiten zeigen transparent, welche Felder noch leer sind. "Geburtsort: unbekannt. Können Sie helfen?" Motiviert zur gezielten Recherche.

**Bewusst NICHT umgesetzt:**

| Ausgeschlossen | Warum |
|---|---|
| Kommentare / Gästebuch | Moderations-Alptraum. Kann von Trollen und Regime-Sympathisanten gekapert werden. |
| Likes / Reactions / Emojis | Trivialisiert Gedenken. "123 Likes auf einem Massaker-Opfer" ist unangemessen. |
| Share-Zähler | Engagement-Metriken gehören nicht auf eine Gedenkstätte. |
| User-Profile / Accounts | Kein Social Network. Anonymität schützt Besucher (besonders aus dem Iran). |
| Gamification / Punkte / Badges | Unvereinbar mit der Würde der Opfer. |
| Benachrichtigungen / Newsletter | Kein Engagement-Optimierung. Wer wiederkommen will, kommt wieder. |

### Daten und Forschung

- [ ] **Bulk-Import-Pipeline** — Strukturierter Import aus verschiedenen Quellen (Boroumand, IHR, HRANA, Amnesty). Pro Quelle ein Mapping-Script.
- [ ] **Daten-Partnerschaften** — Formale Vereinbarungen mit NGOs für Datenaustausch. Wir ergänzen, nie duplizieren.
- [ ] **Quellen-Qualitätsbewertung** — Primärquelle (Augenzeuge, Gerichtsdokument) vs. Sekundärquelle (Medienbericht). Sichtbar für Nutzer.
- [ ] **Änderungshistorie** — Wer hat wann was an einem Eintrag geändert? Transparenz und Nachvollziehbarkeit.
- [ ] **Duplikat-Erkennung** — Automatische Warnung wenn ähnliche Namen/Daten bereits existieren. Vermeidet Mehrfacheinträge.
- [ ] **Daten-Qualitäts-Dashboard** — Wie viele Einträge haben ein Foto? Einen Geburtsort? Eine verifizierte Quelle? Fortschritt sichtbar machen.
- [ ] **Offene API** — REST + GraphQL. Dokumentiert. Rate-limited. Für Forscher und Journalisten.
- [ ] **Zitierformat** — Jede Opfer-Seite mit Copy-Paste-fähigem Zitat (APA, Chicago, etc.).
- [ ] **Maschinenlesbarer Export** — JSON-LD, Schema.org Markup für Suchmaschinen.

### Gemeinschaft und Beteiligung

- [ ] **Einreichungsformular** — Strukturiert: Wer war das Opfer? Wie ist es gestorben? Welche Quellen haben Sie?
- [ ] **Review-Workflow** — Einreichungen werden von Editoren geprüft. Transparenter Status.
- [ ] **Crowdsourcing-Challenges** — "Hilf uns, die Opfer des 1988-Massakers zu dokumentieren." Thematische Aufrufe.
- [ ] **Familien-Kontakt** — Geschützter Kanal für Familienmitglieder, um zusätzliche Informationen zu teilen.
- [ ] **Freiwilligen-Portal** — Aufgaben für Volunteers: Übersetzen, Daten verifizieren, Quellen suchen, Fotos beschaffen.
- [ ] **"Adoptiere ein Opfer"** — Volunteers übernehmen Verantwortung für die Vollständigkeit eines Profils.
- [ ] **Educator-Kits** — Materialien für Lehrer: Unterrichtseinheiten, Diskussionsfragen, Quellenarbeit.

### Sprache und Übersetzung

- [ ] **Farsi RTL** — Primärsprache für Opferdaten. Vollständige RTL-Unterstützung im gesamten UI.
- [ ] **Englisch** — Internationale Reichweite. Primäre Interface-Sprache.
- [ ] **Deutsch** — Für die große iranische Diaspora im DACH-Raum.
- [ ] **Arabisch** — Zweite RTL-Sprache. Wichtig für irakische Nachbarschaft und arabischsprachige Medien.
- [ ] **Kurdisch** — Viele Opfer sind Kurden (Mahsa Amini war Kurdin). Respekt vor Identität.
- [ ] **Türkisch** — Große iranische Diaspora in der Türkei.
- [ ] **Community-Übersetzung** — Crowdsourced Übersetzung für weitere Sprachen.

### Technische Resilienz

- [ ] **Mirror-System** — Automatische Spiegelung auf GitLab, Codeberg, selbstgehosteten Servern.
- [ ] **Internet Archive** — Regelmäßige Snapshots auf archive.org. Unverlierbar.
- [ ] **Tor-Hidden-Service** — Zugang aus dem Iran trotz Zensur.
- [ ] **IPFS-Archiv** — Dezentrale Speicherung. Nicht löschbar.
- [ ] **Offline-Zugang (PWA)** — Progressive Web App für Gebiete mit eingeschränktem Internet.
- [ ] **Daten-Souveränität** — Kein US-Cloud-Anbieter als alleiniger Host. Europäischer Server. Eigene Backups.
- [ ] **Anti-Zensur** — Domain-Fronting, alternative Domains, CDN-basierte Auslieferung.
- [ ] **DDoS-Schutz** — Cloudflare oder äquivalent. Erwartbar bei politisch sensiblen Inhalten.

### Juristische und ethische Dimension

- [ ] **Anonymität der Einreicher** — Keine Pflichtangabe von persönlichen Daten. Schutz vor Vergeltung.
- [ ] **Datenschutz** — Kein Tracking, kein Analytics, das Nutzerdaten an Dritte sendet.
- [ ] **Ethische Richtlinien** — Keine Folterfotos. Keine Glorifizierung von Gewalt. Würdevolle Darstellung.
- [ ] **Recht auf Vergessen** — Familien können die Entfernung eines Eintrags beantragen (mit Begründung).
- [ ] **Verantwortliche benennen** — Wo dokumentiert: Wer gab den Befehl? Welche Einheit führte aus? (Für juristische Aufarbeitung)
- [ ] **Chain of Custody** — Dokumentenherkunft nachvollziehbar. Wichtig für Gerichtsverfahren.

---

## Was dieses Projekt NICHT ist

| Was es NICHT ist | Warum nicht |
|---|---|
| **Kein Social-Media-Plattform** | Keine Kommentare, Likes, Shares als Kernfunktion. Die Würde der Opfer steht über Engagement-Metriken. |
| **Kein Nachrichten-Portal** | Wir dokumentieren, nicht berichten. Keine tagesaktuellen Meldungen. |
| **Keine politische Plattform** | Keine Parteinahme für oder gegen bestimmte Oppositionsgruppen. Fakten, nicht Meinungen. |
| **Keine Spendenplattform** | Kein Fundraising. Kein Paywall. Alle Daten frei zugänglich. |
| **Kein generisches Framework** | Nur Iran. Kein "Memorial as a Service" für andere Konflikte. |
| **Kein Vergeltungsinstrument** | Dokumentation für Gerechtigkeit, nicht für Rache. Fakten, nicht Emotionen. |
| **Kein Closed-Source-Projekt** | Der Code ist offen. Die Daten sind offen. Transparenz ist das Fundament. |

---

## Grundüberzeugung

> **Das Schweigen ist unser größter Feind.**
>
> Das Nicht-Hinsehen, das Nicht-Publik-Machen, das Töten und Foltern ohne die Aufmerksamkeit der Weltöffentlichkeit — in der Dunkelheit — das ist es, was das Regime am Leben hält. Jedes Opfer, das wir dokumentieren, ist ein Akt gegen das Schweigen. Jede Seite, die wir veröffentlichen, ist ein Licht in dieser Dunkelheit.
>
> **Wir dürfen nicht wegsehen. Wir dürfen nicht schweigen.**
>
> Dieses Prinzip steht über allen anderen Abwägungen. Im Zweifel: veröffentlichen, dokumentieren, sichtbar machen. Nicht aus Sensationslust, sondern weil Schweigen Mittäterschaft ist.

---

## Beantwortete Grundsatzfragen

> Entschieden am 2026-02-09. Diese Entscheidungen bilden das Fundament für alle weiteren Planungen.

### Inhalt und Daten

**1. Welche Opfer-Kategorien erfassen wir?**
→ **Alle Opfer des Regimes.** Politische Gefangene, Demonstranten, ethnische und religiöse Minderheiten, Kindersoldaten, zivile Kriegsopfer, Opfer von Attentaten, in Haft Gestorbene, Zwangsverschwundene. Auch indirekte Opfer (Suizid nach Folter, Tod im Exil durch Folgeerkrankungen). Bei indirekten Opfern wird wahrheitsgemäß und ausdrücklich darauf hingewiesen, dass es sich um indirekte Folgen staatlicher Gewalt handelt.

**2. Wie gehen wir mit umstrittenen Fällen um?**
→ **Faktenbasierte Darstellung mit Quellenhierarchie.** Primärquellen zuerst: Augenzeugen, Familien, UN-Berichte, NGOs. Wenn glaubwürdige Quellen sich widersprechen, werden alle gezeigt. Das Regime ist kein glaubwürdiger Akteur — ihre Darstellungen werden nicht als gleichwertige Quelle behandelt, sondern nur wo relevant als Dokumentation der Vertuschung gezeigt: "Das Regime behauptete X. Medizinische Befunde / UN-Untersuchung widerlegen dies."

**3. Wie vermeiden wir Desinformation?**
→ **Hybrid-System: Mensch + Crowd + KI.** Eher veröffentlichen als zurückhalten, aber mit transparentem Verifizierungsstatus. Besucher können jeden Eintrag flaggen (strukturiert: welches Feld, was ist falsch, Quelle). Alle Signale werden aggregiert. KI erkennt Muster (koordinierte Angriffe, Bot-Flags, Anomalien) und filtert vor. Mensch entscheidet final. Regime-nahe Akteure haben Desinformation perfektioniert — die KI-Schicht ist der Schutzschild dagegen.

**4. Was tun wir mit Opfern ohne Namen?**
→ **Kollektive Gedenkseiten + Feedback-Schleife.** Pro Ereignis eine kollektive Seite ("Geschätzt 5.000–30.000 Opfer. 847 identifiziert. Helfen Sie, die Übrigen zu finden."). Individuelle Seiten erst wenn genug Substanz vorhanden ist, um eine menschliche Ebene aufzubauen — mindestens ein Name ODER persönliche Details (Alter, Beruf, Zeugenbericht). Besucher können unbekannte Opfer identifizieren. Informationen fließen in die Datenbank, werden KI-basiert analysiert und nach menschlicher Prüfung zugeordnet. Die Feedback-Schleife: Mehr Besucher → mehr Informationen → schärfere Daten → glaubwürdigere Seite → mehr Besucher.

**5. Welche Datenschutz-Pflichten gelten?**
→ **Abgestuft nach Personengruppe.**
- *Opfer (Verstorbene):* Frei dokumentierbar. DSGVO gilt nicht für Tote. Historische Dokumentation durch öffentliches Interesse geschützt.
- *Lebende Angehörige:* Keine persönlichen Details (Adresse, Aufenthaltsort) ohne Einwilligung. Nur allgemeine Angaben ("hinterließ eine Frau und zwei Kinder").
- *Einreicher:* Anonyme Einreichung immer möglich. E-Mail optional, nur intern, nie veröffentlicht, löschbar.
- *Besucher:* Zero Tracking. Keine Cookies, kein Google Analytics, keine Drittanbieter-Scripts.
- *Verantwortliche/Täter:* Öffentliches Interesse überwiegt. Namennennung wenn durch UN-Berichte, Gerichtsurteile oder NGO-Dokumentation belegt.

### Partnerschaften

**6–9. Boroumand Foundation, IHR, HRANA, Universitäten?**
→ **Parallel: Erst vorzeigbare Version bauen, dann herantreten.** Phase 2 deployen, dann mit Live-Link und GitHub-Repo an Boroumand, IHR und HRANA: "Dürfen wir eure öffentlich zugänglichen Daten mit Quellenangabe integrieren?" Kein formeller Vertrag am Anfang nötig. Ergänzen, nicht konkurrieren. Universitäten (Digital Humanities) sind Phase 4+ — erst wenn Traktion da ist.

### Technik und Betrieb

**10. Wer moderiert Community-Einreichungen?**
→ **Gestuftes System, dynamisch angepasst.** Anfangs allein (wenige Einreichungen). Bei Wachstum Team aufbauen. Bei Skalierung KI-Vorfilterung. Kein starrer Plan — organisch wachsen lassen, flexibel anpassen.

**11. Wie finanzieren wir den Server-Betrieb?**
→ **Selbst finanziert.** Laufende Kosten ~15–20€/Monat (Hetzner VPS + Domain + Cloudflare Free). Bei Kosten über ~200€/Monat wird flexibel entschieden ob Grants oder andere Finanzierung nötig sind.

**12. Welche Sicherheitsmaßnahmen gegen staatliche Angriffe?**
→ **Die Architektur selbst ist die beste Verteidigung.** Open Source auf GitHub = komplettes Backup. Server weg → neuer Server, `git clone`, `docker compose up`, fertig. Zusätzlich: Cloudflare Free (DDoS), tägliche DB-Backups, SSH-Key-only, kein Admin-Zugang ohne 2FA. Desinformation wird durch den Verifizierungs-Kreislauf (Frage 3) abgefangen. Erweiterte Maßnahmen (Tor, IPFS, Mirrors) erst bei tatsächlichen Angriffen — nicht overengineeren.

**13. Wie stellen wir Langzeit-Verfügbarkeit sicher?**
→ **Jeder muss dieses Projekt neu aufsetzen können — auch ohne den Gründer.** Code offen, Daten exportierbar, Anleitung dokumentiert. Ab Phase 2: regelmäßiger JSON/CSV-Export in Git, Internet Archive Snapshots, zweiter Git-Mirror (GitLab/Codeberg). Institutionelle Anbindung (Universität/Bibliothek) als langfristige Option wenn Traktion da ist.

### Ethik und Wirkung

**14. Wie schützen wir Familien im Iran vor Vergeltung?**
→ **Dreifacher Schutz.**
- *Einreicher sind nie sichtbar:* Wer Information einreicht, wird nirgends genannt — nicht auf der Seite, nicht in Metadaten, nicht im Code.
- *Familien entscheiden selbst:* Keine Details die auf lebende Familien im Iran zurückführbar sind, ohne Einwilligung. Wenn kein Kontakt möglich: nur bereits öffentlich dokumentierte Fakten.
- *Nachträgliche Entfernung:* Familien können jederzeit beantragen, persönliche Details zu entfernen. Im Zweifel für die Sicherheit. Aber: Bereits öffentlich dokumentierte historische Fakten (UN, Amnesty, Gerichtsurteile) bleiben.

**15. Wie vermeiden wir Trauma-Voyeurismus?**
→ **Den Menschen zeigen, nicht den Tod — aber die Grausamkeit des Regimes nie verschweigen.**
- *Standardansicht:* Lebensfoto, Name, Geschichte, Todesumstände in klarer Sprache. Würdevoll, nichts verschwiegen.
- *Vollständige Dokumentation:* Beweisfotos, Obduktionsberichte, Augenzeugendetails hinter bewusstem Klick ("Dokumentation anzeigen"). Wichtig für Forscher, Juristen, Gerichte.
- *Von Familie mitgestaltet:* Familien werden aktiv einbezogen — über Social Media kontaktiert, gefragt wie die Seite ihres Angehörigen aussehen soll. Manche wollen die Grausamkeit zeigen ("Die Welt soll sehen"), andere wollen Würde und Stille. Beides respektieren. Kontaktaufnahme immer menschlich und einfühlsam, nie automatisiert.
- *Der Test:* Würde die Mutter dieses Menschen die Seite als würdevolles Gedenken empfinden?

**16. Wie stellen wir sicher, dass die Daten nicht missbraucht werden?**
→ **Offenheit beibehalten. Das Risiko ist real, aber der Nutzen überwiegt.**
- Das Regime hat seine eigenen Informationen über seine Opfer — geschlossene Daten schützen nicht.
- Geschlossene Daten verhindern aber, dass Forscher, Juristen und Journalisten sie nutzen können.
- Transparenz ist die stärkste Waffe gegen ein Regime, das von Geheimhaltung und Dunkelheit lebt.
- Schutzmaßnahmen: Keine Daten die nicht bereits öffentlich sind. Keine Details zu lebenden Angehörigen im Iran. Integritätssicherung durch permanente Links, Zeitstempel und Hashes — Manipulation fällt auf wenn das Original öffentlich zugänglich ist.

---

## Design-Prinzipien

> Leitplanken für alle zukünftigen Entscheidungen.

1. **Maximum Truth-Seeking.** Das oberste Gebot. Jede Funktion, jedes Feature, jede Designentscheidung muss der Wahrheitsfindung dienen. Was die Wahrheit nicht voranbringt, hat auf der Seite nichts zu suchen.

2. **Würde vor allem.** Jede Designentscheidung muss die Frage beantworten: Würde die Familie des Opfers dies als angemessen empfinden?

3. **Ein Mensch, nicht eine Zahl.** Wo immer möglich, zeigen wir den Menschen — seinen Namen, sein Gesicht, seinen Traum. Statistiken dienen dem Kontext, nie der Kerndarstellung.

4. **Daten vor Features.** Ein Opfer mehr in der Datenbank ist immer wichtiger als ein Feature mehr im Interface. Die Datenbank ist das Denkmal. Das Interface ist nur das Fenster.

5. **Offen und transparent.** Code ist offen. Daten sind offen. Methoden sind dokumentiert. Quellen sind nachprüfbar. Wer etwas verbergen will, hat kein Vertrauen verdient.

6. **Clean und fokussiert.** Keine Feature-Überfrachtung. Jedes Element auf der Seite muss seinen Platz verdienen. Weniger ist mehr — Klarheit schlägt Komplexität.

7. **Engagement = Gedenken oder Wahrheitsfindung.** Keine Interaktion um der Interaktion willen. Kein Social-Media-Rauschen. Jede Nutzer-Aktion muss entweder ein Akt des Gedenkens oder ein Beitrag zur Dokumentation sein.

8. **Zugänglich für alle.** Mehrsprachig, barrierefrei, performant auch bei langsamer Verbindung. Keine Paywall, kein Login-Zwang.

9. **Resilient gegen Zensur.** Das Denkmal muss überleben — auch wenn eine Domain gesperrt wird, ein Server beschlagnahmt wird, oder ein Hosting-Anbieter den Dienst kündigt.

10. **Gemeinschaft als Fundament.** Dieses Projekt kann nur mit der Beteiligung von Familien, Zeitzeugen, Forschern und Freiwilligen wachsen. Einzelkämpfertum skaliert nicht.

11. **Fakten, nicht Meinungen.** Wir dokumentieren, was geschehen ist. Wir beurteilen nicht, welche Opposition "besser" ist. Wir nehmen keine Seite ein außer die der Opfer.

---

## Metriken für Erfolg

> Woran messen wir, ob das Projekt seine Vision erfüllt?

| Dimension | Metrik | Ziel |
|---|---|---|
| **Vollständigkeit** | Anzahl dokumentierter Opfer | 1.000 (Phase 2), 10.000 (Phase 3), 100.000+ (langfristig) |
| **Datenqualität** | % verifizierter Einträge | >50% der Einträge mit mindestens einer verifizierten Quelle |
| **Zugänglichkeit** | Lighthouse Accessibility Score | >95 |
| **Mehrsprachigkeit** | Sprachen mit >80% UI-Abdeckung | 3 (FA, EN, DE) |
| **Offenheit** | API-Nutzung durch Externe | Mindestens 1 Forschungsprojekt nutzt die API |
| **Community** | Anzahl Community-Einreichungen | >100 Einreichungen im ersten Jahr |
| **Resilienz** | Anzahl unabhängiger Mirrors | >3 (GitHub, GitLab, eigene Server, Archive.org) |
| **Nutzung** | Einzigartige Besucher/Monat | 1.000 (Phase 2), 10.000 (Phase 3) |
| **Zitate** | Verweise in Medien/Forschung | Mindestens 5 im ersten Jahr |
| **Performance** | Lighthouse Performance Score | >90 |

---

## Nächster Schritt

Diese Vision ist die Grundlage. Bevor implementiert wird:

1. **Vision gemeinsam verfeinern** — Feedback von potenziellen Nutzern, NGOs, Familien einholen
2. **Offene Fragen klären** — Priorisieren und beantworten
3. **Detaillierte Planung** — Vision → Plan-Dokument (YYMMDD-PLAN_*.md)
4. **Dann erst: Implementierung** — Zielgerichtet, basierend auf der Vision und dem Plan

---

*Erstellt: 2026-02-09*
*Letzte Aktualisierung: 2026-02-16 (English Executive Summary added)*

---

## Technische Architektur (Stand 2026-05-09)

> Diese Sektion ergänzt die Vision um den aktuellen technischen Stand.
> Forscher, Spiegel-Hoster und potenzielle Beitragende sehen auf einen
> Blick, **wie das Memorial gebaut ist und wo die Daten stecken**.

### Stack auf einer Seite

| Layer | Technologie | Warum |
|---|---|---|
| Frontend | Next.js 16 (App Router, Turbopack), React 19, Tailwind v4 | Server-Components für i18n + RTL |
| i18n | next-intl, URL-präfix `/fa/`, `/en/`, `/de/`, `/ar/`, `/fr/`, `/it/`, `/es/` | Sieben Sprachen, RTL für Farsi/Arabisch |
| Datenbank | PostgreSQL 16 (Docker, Port 5434) | Volltextsuche via `tsvector` + `pg_trgm` + `unaccent` für persische Transliterations-Toleranz |
| ORM | Prisma 6 | Typed-DB-Zugriff, generiert aus `prisma/schema.prisma` |
| Daten-Pipeline | Python 3.12 + asyncpg + aiohttp (`tools/enricher/`) | Async-Batch-Ingestion über 12 Plugins; läuft wöchentlich per Cron |
| MCP | `@modelcontextprotocol/sdk` v1.29 (`tools/mcp/`) | Stdio-Server liest die HTTP-API; Claude Desktop, Cursor, Cline kompatibel |
| Auth | NextAuth (Admin), Bearer API-Keys (REST), keine (MCP/Public) | Drei Surfaces, drei Auth-Modelle |
| Hosting | Docker Compose, nginx, Cloudflare-Edge | Kein Vendor-Lock-in; Re-Hosting auf jeder VM in <1 h |

### Drei Daten-Surfaces, drei Audiences

```
┌─────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
│  /api/mcp/* +       │  │  /api/v1/* (Bearer)  │  │  /api/v1/public/dump │
│  tools/mcp/ stdio   │  │                      │  │                      │
│                     │  │                      │  │                      │
│  AI-Agenten (LLMs)  │  │  Apps & Dashboards   │  │  Journalismus/Forschung │
│  Public, no auth    │  │  1000 req/h pro Key  │  │  CC BY-SA 4.0, ~30 MB │
│  30–120/min/IP      │  │  Webhook-Subs        │  │  CDN-Cache 1 h        │
└─────────┬───────────┘  └──────────┬───────────┘  └──────────┬───────────┘
          │                          │                          │
          └──────────────────────────┴──────────────────────────┘
                                     │
                       ┌─────────────▼──────────────┐
                       │  Postgres `iran_memorial`  │
                       │                            │
                       │  Reads → memorial_readonly │
                       │           (SELECT only)    │
                       │  Writes → memorial         │
                       │           (full DML)       │
                       └────────────────────────────┘
```

**Ein Postgres-Cluster trägt alles** — Trennung passiert auf Rollen-Ebene.
Public-Reads und MCP gehen ausschließlich über die `memorial_readonly`-Rolle.
Eine versehentliche Schreib-Operation aus einem Public-Pfad scheitert auf
DB-Ebene mit `permission denied for table victims` — die einzige echte
Read-Only-Garantie. Alles andere wäre nur Konvention.

### Sicherheits-Modell auf einen Blick

| Layer | Mechanismus |
|---|---|
| Edge | Cloudflare-Proxy + nginx CF-IP-Allowlist (direkter Origin-Zugriff = 403) |
| Anwendung Public | App-Rate-Limit 30–120 req/min/IP, Treffer geloggt in `api_usage` |
| Anwendung Admin | nginx Basic-Auth + `x-forwarded-user`-Allowlist |
| **Datenbank** | **Separate Read-Only-Rolle** für Public-Pfade — Defense-in-Depth |
| Transport | HSTS, CSP, X-Frame-Options DENY (außer Embed-Widget) |
| Logs | Strukturiertes Access-Log in `api_usage` — Missbrauch erkennbar |

Vollständiger Audit: [`SECURITY-AUDIT-2026-05-09.md`](SECURITY-AUDIT-2026-05-09.md)

### Daten-Pipeline: 12 aktive Plugins

| Plugin | Quelle | Stand | Glaubwürdigkeit |
|---|---|---|---|
| `boroumand` | Boroumand Foundation (Omid Memorial) | 31.203 historische Einträge (1979–2023) | HOCH |
| `iranvictims` | iranvictims.org | 4.791 CSV-Einträge | MITTEL |
| `iranrevolution` | iranrevolution.org | Real-time Supabase REST | MITTEL |
| `wikipedia_wlf` | Wikipedia "Deaths during Mahsa Amini protests" | manuelles Scraping | UNVERIFIZIERT |
| `iranmonitor` | iranmonitor.org Memorial | strukturiertes JSON | MITTEL |
| `telegram_rtn` | @RememberTheirNames | 2.709+ Posts mit Jalali-Daten | MITTEL |
| `telegram_vahid` | @VahidOnline (934K Subs) | gefiltert, Citizen-Journalism | MITTEL |
| `khrn` | Kurdistan Human Rights Network — Hiwa-Liste | politische Gefangene + Hingerichtete | HOCH |
| `cpj` | Committee to Protect Journalists | Iran-Journalisten-Records | HOCH |
| `witness_report` | witness.report | 14.5K Records (curl_cffi für CF-Bypass) | HOCH |
| `hrana` | HRANA News Agency | JSON-LD-Parsing | HOCH |
| `hengaw` | Hengaw News (Kurdistan-Region) | Title+Body-Parser | HOCH |

Cron-gesteuert: Sonntags 02:30 UTC läuft die Pipeline, dedupliziert mit
`pg_trgm`-Score und commitet die Deltas. Logs in
`/opt/iran-stack/iran-memorial/logs/weekly-enrich-YYYYMMDD.log`.

### Reproduzierbarkeit & Open Source

Das Projekt ist vollständig open-source unter [`LICENSE`](../LICENSE)
(MIT für Code, CC BY-SA 4.0 für Daten). Wer das Memorial auf eigener
Infrastruktur spiegeln will:

```bash
git clone https://github.com/iran-memorial26/iran-memorial.git
cd iran-memorial && npm install && docker compose up -d db
npx prisma migrate deploy && npx prisma db seed
docker exec -i iran-db psql -U postgres < scripts/setup-readonly-role.sql
python3 -m tools.enricher enrich -s iranrevolution --mode full
NEXT_PUBLIC_SITE_URL=https://your-domain npm run build
docker compose up -d --build app
```

`NEXT_PUBLIC_SITE_URL` setzen, fertig — Domain-portabel ohne Code-Änderung.

### Beitragspfade

| Wer | Wie |
|---|---|
| **Familien & Zeitzeug:innen** | Public-Submission-Form `/submit` (Moderation, jede Quelle geprüft) |
| **Forscher:innen & NGOs** | API-Key per Mail, Bulk-Dump, Webhook-Abos für neue Einträge |
| **Entwickler:innen** | GitHub-Issues, neue Plugins in `tools/enricher/sources/`, Übersetzungen in `messages/*.json` |
| **AI-Agenten** | MCP-Server out-of-the-box; jedes LLM kann zitieren ohne Boilerplate |

Ethische Leitplanken im Detail: [`CONTRIBUTING.md`](../CONTRIBUTING.md)

---

*Update 2026-05-09: Technische Architektur, Sicherheitsmodell und
Open-Source-Bereitschaft ergänzt — Stand v0.15.0+ inklusive MCP-Integration,
vollständigem Sicherheits-Audit (P0–P4) und Domain-portabler Konfiguration.*
