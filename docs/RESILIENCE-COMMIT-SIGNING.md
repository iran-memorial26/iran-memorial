# Commit Signing — Tamper-Evidence at the Code Layer

Once the project gains real adversaries, the most insidious attack vector is
**not deletion but quiet manipulation**: commits inserted under a maintainer's
name that subtly poison data, weaken security, or smuggle backdoors. Signed
commits make that attack tractable to detect.

This document is a one-time setup guide for the maintainer team. After it is
done, every `main`-targeting commit and tag is cryptographically signed by the
person who authored it, and GitHub displays a green "Verified" badge.

## What you need

- A YubiKey 5 (or any hardware key supporting OpenPGP — recommended) **or** a
  software GPG key encrypted with a strong passphrase
- 30 minutes the first time, then it is invisible

## Path A — Hardware-backed (recommended for sensitive maintainers)

The private key never leaves the YubiKey. Even a fully compromised laptop
cannot exfiltrate it.

```bash
# 1. Install OpenPGP support
brew install gnupg ykman pinentry-mac      # macOS
# OR
sudo apt install gnupg2 yubikey-manager    # Linux

# 2. Generate a key on the YubiKey
gpg --card-edit
> admin
> generate                                  # follow prompts; choose RSA 4096
                                            # name: your real name
                                            # email: your project email
                                            # expiry: 2y (rotate then)
> quit

# 3. List your new public key id
gpg --list-secret-keys --keyid-format=long
# Copy the line:  sec   rsa4096/ABCDEF1234567890 2026-...
#                                  ^^^^^^^^^^^^^^^ this is your KEYID

# 4. Tell git to use it for this repo (or globally)
cd /path/to/iran-memorial
git config --local user.signingkey ABCDEF1234567890
git config --local commit.gpgsign true
git config --local tag.gpgsign true

# 5. Export the public key and upload to GitHub
gpg --armor --export ABCDEF1234567890 | pbcopy   # macOS
# OR
gpg --armor --export ABCDEF1234567890 | xclip    # Linux

# Then: https://github.com/settings/gpg/new → paste

# 6. Configure pinentry to talk to the YubiKey
echo "pinentry-program $(which pinentry-mac)" >> ~/.gnupg/gpg-agent.conf
gpg-connect-agent reloadagent /bye
```

From now on every `git commit` will prompt for the YubiKey PIN (touch may also
be required depending on settings), and GitHub will mark the commit "Verified".

## Path B — Software key (faster setup, less protection)

If a YubiKey is not available yet, a passphrase-protected software key still
gives you tamper detection. The trade-off: an attacker with full filesystem
access to your dev machine could exfiltrate the private key.

```bash
gpg --full-generate-key
# RSA + RSA, 4096, 2y, your name + project email, strong passphrase

gpg --list-secret-keys --keyid-format=long
git config --local user.signingkey YOURKEYID
git config --local commit.gpgsign true
git config --local tag.gpgsign true

gpg --armor --export YOURKEYID | pbcopy
# https://github.com/settings/gpg/new
```

Plan to upgrade to a hardware key within 90 days.

## Branch protection — make signing mandatory

Once at least one maintainer has signed commits land on `main`, enable the
GitHub branch protection rule:

```
Settings → Branches → main → Edit
  ☑ Require signed commits
```

After that, GitHub rejects any unsigned push to `main`. Even an attacker who
gains a developer's GitHub PAT cannot push commits attributed to them — they
would also need the GPG private key.

## Verifying any commit

Anyone can verify a commit independently:

```bash
git log --show-signature -1 main
# Look for: Good signature from "<Maintainer Name> <project-email>"
#           Primary key fingerprint: <full 40-char fingerprint>
```

If the signature is missing or marked BAD, that commit was tampered with after
the maintainer wrote it, or was forged.

## Publishing the maintainer key fingerprints

Eventually we publish the canonical fingerprints in `MAINTAINERS.md` (one
short-format key id per active maintainer) so external parties — journalists,
Universal-Jurisdiction prosecutors, NGO partners — can independently verify
that a release is from us, not an impersonator.

Format we will use once two maintainers are signing:

```markdown
## Maintainers

| Name | GitHub | GPG fingerprint (rsa4096) |
|---|---|---|
| Iran Memorial Archive | @iran-memorial26 | `ABCD EF12 3456 7890 ABCD  EF12 3456 7890 ABCD EF12` |
| <Co-maintainer> | @… | `…` |
```

Print, photograph, or store the fingerprints out of band for cross-checking.

## Key-rotation protocol

Every two years (or immediately on suspected compromise):

1. Generate new key with same identity.
2. Sign the new key with the old key (`gpg --sign-key NEWKEYID`).
3. Update GitHub, `MAINTAINERS.md`, all CI configs.
4. Revoke the old key after a 30-day overlap.

## Common pitfalls

- **`git commit` hangs on macOS:** pinentry not configured. Add the
  `pinentry-program` line shown above and reload the agent.
- **GitHub still shows "Unverified":** the email on the GPG key doesn't
  match the email in `git config user.email`. Fix one or the other.
- **CI breaks on signed commits:** Dockerfile maintainers cannot sign as
  the bot user. Solution: keep `main` as required-signed; keep CI commits
  on a `bot/*` branch and merge with a signed maintainer commit.
- **You lost the YubiKey:** revoke via the offline revocation cert you
  generated at key-creation time. Always store that cert separately
  (paper backup in safe is fine).

## Reading list

- [GitHub: Signing commits](https://docs.github.com/en/authentication/managing-commit-signature-verification/signing-commits)
- [Drew DeVault: The signed commits anti-pattern, and why we still use them](https://drewdevault.com/2020/06/17/Signed-commits-anti-pattern.html)
  — necessary nuance: signing alone is not security, signing + key publication
  + verification policy is.
