# Tor Hidden Service

Iran Memorial is reachable as a Tor hidden service:

```
ewbpuqum6dnavcgaiskgf4dfoymtqyoa4wetwzz67drg2yp7d3ffevid.onion
```

This bypasses DNS-level censorship inside Iran (where the clearnet domain
`<DEPLOYMENT_DOMAIN>` is blocked or filtered by ISPs), and protects readers
inside Iran by routing their access through the Tor network instead of via a
filterable DNS resolver.

## Why this matters strategically

The Iran Memorial audience that needs censorship-resistant access most is
**inside Iran itself** — families looking up names, journalists fact-checking
under surveillance, lawyers compiling cases, students. The clearnet domain is
fine for the diaspora, useless for the people it most directly serves once
the IRI takes notice.

Tor + Onion v3 gives those readers:

- DNS-blocking immune (no DNS lookup at all)
- Cloudflare-disconnect immune (no CDN involved)
- ISP-blocking immune (Tor traffic mixed with all other Tor traffic)
- Strong privacy (the IRI cannot see who is reading)

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                       <HETZNER_IP> (Hetzner)                     │
│                                                                  │
│   Tor daemon                                                     │
│   ────────────                                                   │
│   tor@default.service                                            │
│   torrc: HiddenServiceDir /var/lib/tor/iran-memorial/            │
│          HiddenServicePort 80 127.0.0.1:5555                     │
│                                                                  │
│   private key:  /var/lib/tor/iran-memorial/hs_ed25519_secret_key │
│   onion address: /var/lib/tor/iran-memorial/hostname             │
│                                                                  │
│                          │                                       │
│                          ▼                                       │
│   ┌─────────────────────────────────────────────────────┐        │
│   │  iran-memorial-app-1 (Docker)                       │        │
│   │  next.js, listening on 127.0.0.1:5555               │        │
│   └─────────────────────────────────────────────────────┘        │
│                                                                  │
│   Note: the onion routes DIRECTLY to :5555, bypassing nginx.     │
│   The CF-IP allowlist on the public nginx vhost does not affect  │
│   Tor traffic — that's intentional, otherwise nginx would 403    │
│   every onion request.                                           │
└──────────────────────────────────────────────────────────────────┘
```

## What's set up

- `tor` package installed via apt
- `/etc/tor/torrc` minimal config (no SOCKS, no exit relay, hidden service only)
- `tor@default.service` enabled and running
- The Onion v3 keypair persisted in `/var/lib/tor/iran-memorial/`

## Backups

The hidden service identity (`hs_ed25519_secret_key`) **is** the onion
address. If you lose that file, the address changes — every link to the
service in the wild becomes 404.

```bash
# Encrypted backup of the onion identity
ssh root@<HETZNER_IP> 'cd /var/lib/tor/iran-memorial && \
  tar czf - hs_ed25519_secret_key hostname' \
  | gpg --encrypt -r <CONTACT_EMAIL> \
  > ~/backups/iran-memorial-onion-keys.tar.gz.gpg
```

Store this in two places (USB in safe + encrypted cloud). Restore with:

```bash
gpg -d iran-memorial-onion-keys.tar.gz.gpg | tar xzf - -C /var/lib/tor/iran-memorial/
chown -R debian-tor:debian-tor /var/lib/tor/iran-memorial/
chmod 700 /var/lib/tor/iran-memorial/
systemctl restart tor@default
```

## Advertising the onion

The address can be linked publicly without compromising anything — Onion v3
keys are designed to be public. Two ways to advertise:

1. **`Onion-Location` header** in nginx (auto-redirects Tor Browser users):

   ```nginx
   server {
     listen 443 ssl;
     server_name <DEPLOYMENT_DOMAIN>;
     # ...
     add_header Onion-Location "http://ewbpuqum6dnavcgaiskgf4dfoymtqyoa4wetwzz67drg2yp7d3ffevid.onion$request_uri" always;
   }
   ```

   Tor Browser detects the header and offers the user to switch to the
   onion automatically.

2. **Footer link** (no protocol leak):

   ```tsx
   <a href="http://ewbpuqum6dnavcgaiskgf4dfoymtqyoa4wetwzz67drg2yp7d3ffevid.onion">
     Tor / .onion mirror
   </a>
   ```

   Visible to all users; only Tor users can actually reach it.

Recommendation: **enable `Onion-Location` first**, footer link later. The
header is invisible to non-Tor users but guides Tor Browser users onto the
better path automatically.

## Smoke test

From any machine with Tor installed (e.g. Tor Browser or `torsocks`):

```bash
torsocks curl -s http://ewbpuqum6dnavcgaiskgf4dfoymtqyoa4wetwzz67drg2yp7d3ffevid.onion/ \
  | head -20
# Should return Next.js HTML (likely a redirect to /en).
```

From the server itself (no Tor needed, just hits the local app):

```bash
curl -s -o /dev/null -w "http=%{http_code}\n" --max-time 5 \
     http://127.0.0.1:5555/ \
     -H "Host: ewbpuqum6dnavcgaiskgf4dfoymtqyoa4wetwzz67drg2yp7d3ffevid.onion"
# Returns 307 (Next.js locale redirect) — service is live.
```

## Open follow-ups

- **Internal links go to clearnet.** Right now `<a href="<DEPLOYMENT_URL>/..."/>` in the app sends a Tor reader back to the clearnet domain on click. Solution later: detect `Host: *.onion` in the request and override `SITE_URL` in the response. Not urgent — readers in Iran can still browse via Tor; only outbound links jump.
- **No rate limit on Tor traffic for non-`/api/mcp/*` paths.** Lower priority — Tor fanout to amplify abuse is rare and Tor exit-style attacks don't apply (this is hidden service, not exit).
- **Vanity onion?** `mreoryalXXXX...onion` — generating one would burn a few hours of compute. Not worth it now; v3 onion addresses look like noise by design.
