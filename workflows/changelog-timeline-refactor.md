# Timeline Refactoring & Event Descriptions Update

**Datum:** 2026-02-15
**Commits:** `d8a2b7959`, `dcf5de4af`
**DB Updates:** 12 Events (Production)

---

## Änderungen

### 1. Timeline UI Refactoring

**Datei:** `components/InteractiveTimeline.tsx`

**Vorher:**
- Event-Titel als `<button>` mit onClick → expandable/collapsible Details
- Beschreibungen nur sichtbar wenn ausgeklappt
- State Management für `expandedSlug`

**Nachher:**
- Event-Titel als `<Link href="/events/${slug}">` → direkte Navigation zur Event-Detail-Seite
- Kurzbeschreibungen (2-3 Sätze, max 250 Zeichen) immer sichtbar
- Kein Expand/Collapse State mehr
- Neue `truncateText()` Funktion:
  - Sammelt komplette Sätze bis 250 Zeichen
  - Respektiert Satzgrenzen (`.!?`)
  - Fallback auf Character-Truncation wenn keine Sätze erkannt

**Commits:**
- `d8a2b7959`: Initial refactoring (sentence-based truncation)
- `dcf5de4af`: Improved truncation (character-based mit sentence boundaries)

### 2. Event Description Database Updates

**Betroffene Events:** 12

| Slug | Neue description_de (erste ~100 Zeichen) |
|------|------------------------------------------|
| `revolution-1979` | Die Iranische Revolution stürzte die Pahlavi-Dynastie. Ayatollah Chomeini errichtete die... |
| `post-revolution-executions` | In den ersten Monaten nach der Revolution wurden tausende Menschen hingerichtet – politische... |
| `cultural-revolution-1980` | Die Kulturrevolution zielte darauf ab, Universitäten und Bildungseinrichtungen ideologisch... |
| `iran-iraq-war` | Der achtjährige Krieg zwischen Iran und Irak forderte hunderttausende Menschenleben. Das... |
| `reign-of-terror-1981-1985` | Nach dem Sturz der provisorischen Regierung Banisadrs begann eine Welle politischer... |
| `chain-murders` | Systematische Ermordung von Intellektuellen, Schriftstellern und Dissidenten zwischen... |
| `massacre-1988` | Im Sommer 1988 wurden tausende politische Gefangene auf Grundlage einer Fatwa von... |
| `student-protests-1999` | Studentische Proteste gegen die Schließung der Zeitung Salam wurden gewaltsam... |
| `green-movement-2009` | Massenproteste gegen die umstrittene Wiederwahl von Präsident Ahmadineschad. Das Regime... |
| `bloody-november-2019` | Proteste gegen die drastische Erhöhung der Benzinpreise führten zu einem der blutigsten... |
| `woman-life-freedom-2022` | Nach dem Tod von Jina Mahsa Amini in Polizeigewahrsam begannen landesweite Proteste unter... |
| `massacres-2026` | Nach dem Fall des Assad-Regimes in Syrien kam es zu Massenprotesten gegen die iranische... |

**Deployment:**
- Lokal: 12× UPDATE via psql (`iran_memorial` DB auf localhost:5432)
- Production: 12× UPDATE via SSH + docker exec (`iran-memorial-db-1` Container)
- Verifizierung: `curl http://localhost:5555/de/timeline` auf Server zeigt neue Texte

### 3. Deployment

**Code:**
```bash
git push origin main
ssh root@<HETZNER_IP> "cd /var/www/iran-memorial && git pull && docker compose up -d --build app"
```

**Database:**
```bash
# Lokal (bereits durchgeführt)
psql -d iran_memorial -U Pedi < update_events.sql

# Production (via SSH)
ssh root@<HETZNER_IP> "docker exec iran-memorial-db-1 psql -U memorial -d iran_memorial -c 'UPDATE events SET description_de = ... WHERE slug = ...'"
```

---

## Verifizierung

✅ Lokaler Build erfolgreich (`npm run build`)
✅ Timeline zeigt neue Texte (max 250 Zeichen)
✅ Event-Titel verlinken zu `/events/[slug]`
✅ Production DB aktualisiert (12 Events)
✅ Live-Seite zeigt neue Beschreibungen

**Live Check:**
```bash
curl -s http://localhost:5555/de/timeline | grep -o 'Die Iranische Revolution.*festigen'
# Output: Die Iranische Revolution stürzte die Pahlavi-Dynastie. Ayatollah Chomeini errichtete die Islamische Republik, die sofort begann, ihre Macht durch systematische Hinrichtungen zu festigen
```

---

## Lessons Learned

1. **Database Content ≠ Code Changes**
   - DB-Updates werden nicht von Git getrackt
   - Separate Deployment-Strategie für DB vs. Code
   - `git status` zeigt "nothing to commit" nach DB-Updates

2. **Text Truncation auf Satzgrenzen**
   - Erste Version: feste Anzahl Sätze (2 Sätze)
   - Problem: unterschiedliche Textlängen (User-Feedback via Screenshot)
   - Lösung: Character-Limit (250) mit Satzgrenzen-Respekt

3. **Docker Space Management**
   - Erster Deploy fehlte: "no space left on device"
   - `docker system prune -af --volumes` → 4.3GB frei
   - Regelmäßiges Cleanup empfohlen

---

## Nächste Schritte

- [ ] Event descriptions für EN/FA (`description_en`, `description_fa`) analog updaten
- [ ] `truncateText()` Funktion in `lib/utils.ts` extrahieren (Wiederverwendung)
- [ ] Tests für `InteractiveTimeline` schreiben (aktuell 0 Tests)
- [ ] Überlegen: Soll Timeline auch `description_en`/`description_fa` nutzen oder nur `_de`?

---

**Status:** ✅ Deployed to Production
**Version:** v0.7.4+ (Timeline Refactor)
