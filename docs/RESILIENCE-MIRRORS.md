# Mirror Setup — Backup Git Hosts

The workflow at [`.github/workflows/mirror.yml`](../.github/workflows/mirror.yml)
replicates every `main` push to **Codeberg, GitLab, and Sourcehut** in addition
to GitHub. Without setup the workflow no-ops gracefully — it only acts once the
secret is configured.

## One-time setup (do once, ~30 minutes)

### 1. Create accounts on each backup host

| Host | URL | Notes |
|---|---|---|
| Codeberg | https://codeberg.org/user/sign_up | Berlin-based, gemeinnützig (Verein), no-VC, EU jurisdiction |
| GitLab | https://gitlab.com/users/sign_up | US-based, but separate legal entity from GitHub/Microsoft |
| Sourcehut | https://meta.sr.ht/register | Minimal, no JS, EU jurisdiction (Drew DeVault, NL/DE) — most resilient |

Use the Iran Memorial functional email (`<CONTACT_EMAIL>` or a
dedicated account like `mirror@…`) — not your personal email.

### 2. Create the empty mirror repos

| Host | URL pattern |
|---|---|
| Codeberg | `https://codeberg.org/iran-memorial/iran-memorial` |
| GitLab | `https://gitlab.com/iran-memorial/iran-memorial` (create org "iran-memorial" first) |
| Sourcehut | `https://git.sr.ht/~iran-memorial/iran-memorial` (account name "iran-memorial") |

The names don't have to match GitHub. If you use different paths, set them as
GitHub Repository Variables (see step 5).

### 3. Generate one SSH key for the workflow

On your local machine:

```bash
ssh-keygen -t ed25519 -C "github-mirror-action" -f ~/.ssh/iran_memorial_mirror -N ""
```

This produces:
- `~/.ssh/iran_memorial_mirror` — private key (used by the GitHub Action)
- `~/.ssh/iran_memorial_mirror.pub` — public key (added to mirror accounts)

### 4. Add the public key to each mirror account

| Host | URL |
|---|---|
| Codeberg | https://codeberg.org/user/settings/keys → Add SSH Key |
| GitLab | https://gitlab.com/-/user_settings/ssh_keys → Add new key |
| Sourcehut | https://meta.sr.ht/keys → SSH keys → Add |

Paste the contents of `~/.ssh/iran_memorial_mirror.pub` into each. Title:
`github-action-mirror`.

### 5. Add the private key to GitHub as a Secret

```bash
# Via gh CLI (cleanest)
gh secret set MIRROR_SSH_KEY --repo iran-memorial26/iran-memorial < ~/.ssh/iran_memorial_mirror

# Or manually:
# https://github.com/iran-memorial26/iran-memorial/settings/secrets/actions
# → New repository secret
# → Name: MIRROR_SSH_KEY
# → Value: contents of ~/.ssh/iran_memorial_mirror (the PRIVATE key, BEGIN/END
#                                                   OPENSSH PRIVATE KEY block)
```

### 6. (Optional) Override remote URLs via Repository Variables

If your mirror repos live at different paths than the defaults baked into
the workflow, set:

```bash
gh variable set MIRROR_CODEBERG  --body 'git@codeberg.org:USER/REPO.git'
gh variable set MIRROR_GITLAB    --body 'git@gitlab.com:USER/REPO.git'
gh variable set MIRROR_SOURCEHUT --body 'git@git.sr.ht:~USER/REPO'
```

Otherwise the defaults (`iran-memorial/iran-memorial`) are used.

## Verifying

After step 5, trigger the workflow manually:

```bash
gh workflow run mirror.yml
gh run watch
```

Or just push any commit to `main`. The workflow log should show three "Push to
…" steps each ending in `* [new branch] main -> main`.

## After the first push

Verify each mirror has the same `HEAD`:

```bash
for host in codeberg.org gitlab.com git.sr.ht; do
  git ls-remote git@$host:iran-memorial/iran-memorial.git HEAD 2>/dev/null \
    || git ls-remote git@$host:~iran-memorial/iran-memorial HEAD
done
```

All three should return the same SHA as `git rev-parse origin/main`.

## What happens if a mirror is censored / banned

`continue-on-error: true` means each host fails independently. If, e.g.,
GitLab takes down the project after a defamation complaint:

- Codeberg + Sourcehut keep getting pushes.
- The workflow log records the failure (visible in GitHub Actions UI).
- Recovery: register on a different host (e.g. `git.disroot.org`), add an
  override variable, re-run.

## Rotating the SSH key

If the key is ever exposed:

```bash
ssh-keygen -t ed25519 -C "github-mirror-action-v2" -f ~/.ssh/iran_memorial_mirror_v2 -N ""
# add the new public key to all 3 hosts
# remove the old public key from all 3 hosts
gh secret set MIRROR_SSH_KEY < ~/.ssh/iran_memorial_mirror_v2
```

The next push triggers a re-mirror with the new key — no code changes needed.
