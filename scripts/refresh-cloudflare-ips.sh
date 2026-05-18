#!/usr/bin/env bash
# Refresh Cloudflare IP allow-list snippets used by infra/nginx/cloudflare-only.conf.
#
# Run on the server (Hetzner <ORIGIN_IP>) as root, daily via cron:
#   0 4 * * * /opt/iran-stack/iran-memorial/scripts/refresh-cloudflare-ips.sh
#
# Generates four snippets in /etc/nginx/snippets/:
#   cloudflare-ips-v4.conf              → "allow X.X.X.X/N;" lines
#   cloudflare-ips-v6.conf              → "allow X::/N;"     lines
#   cloudflare-ips-v4-set-real-ip.conf  → "set_real_ip_from X.X.X.X/N;" lines
#   cloudflare-ips-v6-set-real-ip.conf  → "set_real_ip_from X::/N;"     lines
#
# Reloads nginx only if the snippets actually changed AND nginx -t passes.

set -euo pipefail

SNIPPETS=/etc/nginx/snippets
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

mkdir -p "$SNIPPETS"

fetch() {
  local url=$1
  local out=$2
  curl -fsSL --max-time 10 "$url" -o "$out"
  # Sanity-check: reject empty / single-char / HTML responses.
  if [ ! -s "$out" ] || [ "$(wc -l < "$out")" -lt 5 ]; then
    echo "FATAL: $url returned implausible response" >&2
    exit 1
  fi
}

fetch https://www.cloudflare.com/ips-v4 "$TMP/v4.txt"
fetch https://www.cloudflare.com/ips-v6 "$TMP/v6.txt"

awk '{ printf "allow %s;\n", $0 }' "$TMP/v4.txt" > "$TMP/cloudflare-ips-v4.conf"
awk '{ printf "allow %s;\n", $0 }' "$TMP/v6.txt" > "$TMP/cloudflare-ips-v6.conf"
awk '{ printf "set_real_ip_from %s;\n", $0 }' "$TMP/v4.txt" > "$TMP/cloudflare-ips-v4-set-real-ip.conf"
awk '{ printf "set_real_ip_from %s;\n", $0 }' "$TMP/v6.txt" > "$TMP/cloudflare-ips-v6-set-real-ip.conf"

CHANGED=0
for f in cloudflare-ips-v4.conf cloudflare-ips-v6.conf \
         cloudflare-ips-v4-set-real-ip.conf cloudflare-ips-v6-set-real-ip.conf; do
  if ! cmp -s "$TMP/$f" "$SNIPPETS/$f" 2>/dev/null; then
    cp "$TMP/$f" "$SNIPPETS/$f"
    CHANGED=1
    echo "updated: $SNIPPETS/$f"
  fi
done

if [ "$CHANGED" -eq 1 ]; then
  if nginx -t 2>&1; then
    systemctl reload nginx
    echo "nginx reloaded"
  else
    echo "FATAL: nginx -t failed after CF-IP refresh; NOT reloading" >&2
    exit 1
  fi
else
  echo "no changes"
fi
