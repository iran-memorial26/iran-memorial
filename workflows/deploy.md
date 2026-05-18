# Workflow: Deployment auf <DEPLOYMENT_DOMAIN>

## Ziel
Codeänderungen sicher auf den Produktionsserver deployen.

## Voraussetzungen
- Alle Änderungen committed und gepusht
- `npm run build` lokal erfolgreich
- Server-Zugang via SSH

## Pre-Deployment Checks

### 1. Disk-Space prüfen
```bash
ssh server "df -h /"
```
- Mindestens 2 GB frei nötig
- Bei < 2 GB erst Docker aufräumen:
  ```bash
  docker system prune -a -f && docker builder prune --all -f
  ```

### 2. Lokaler Build-Test
```bash
cd ~/iran-memorial
npm run build
```
- Muss ohne Fehler durchlaufen

## Deployment

### 3. Auf Server deployen
```bash
ssh server
cd /path/to/iran-memorial

# package-lock.json Divergenz beheben
git stash
git pull origin main
git stash pop   # Falls Stash nötig war

# Docker-Container neu bauen
docker compose up -d --build
```

### 4. Post-Deployment Verifizierung
- Website aufrufen: <DEPLOYMENT_URL>/de
- Stichprobe: Opfer-Detailseite laden
- Stichprobe: Suche testen
- Docker-Logs prüfen: `docker compose logs -f --tail 50 app`

## Rollback
Falls die Website nach dem Deployment nicht funktioniert:
```bash
docker compose down
git log --oneline -5        # Letzten funktionierenden Commit finden
git checkout <commit-hash>
docker compose up -d --build
```

## Bekannte Fallstricke
- **.env muss auf Server existieren** — wird nicht aus Git kopiert
- **package-lock.json Divergenz:** Server hat andere npm-Version → `git stash` vor `git pull`
- **Docker Build-Cache:** Wächst schnell, vor Build Disk-Space prüfen
- **.next/standalone/.env:** Build-Output kopiert `.env` → nie dieses Verzeichnis direkt deployen
- **ISR-Cache:** Nicht `.next/server/app/` komplett löschen → 500-Fehler. `--force-recreate` nutzen
- **tsconfig.json exclude:** `tools/` muss im exclude stehen (OpenAI SDK Types brechen den Build)
