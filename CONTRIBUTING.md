# Contributing to Iran Memorial

Thanks for considering a contribution. This project documents real human
beings who were killed by the Islamic Republic of Iran. Code quality matters,
but the **integrity, dignity, and verifiability of the data matter more**.

This guide is intentionally short. Read it once, then ship.

---

## Ground rules

1. **Every victim record needs a verifiable source.** No anonymous tips, no
   social-media-only entries unless cross-referenced.
2. **Family privacy is paramount.** Sensitive details (dissident family ties,
   conversion, sexuality) require explicit consent or strong NGO sourcing.
3. **No political agenda beyond truth and accountability.** Every victim
   deserves remembrance regardless of faction, ethnicity, or era.
4. **Read the data sensitively.** When you write copy that surfaces statistics
   ("X protesters executed since…") remember each number is a person.

---

## How to contribute

### Reporting an inaccuracy or missing victim

Open an issue with the `data` label. Include:
- Latin and Farsi name (if known)
- Date and place of death
- At least one credible source URL (NGO, news, Wikipedia, Telegram channel)

Or use the public submission form at `<DEPLOYMENT_URL>/submit` —
submissions go into a moderation queue and a maintainer reviews.

### Adding a new data source plugin

The enricher pipeline lives at [`tools/enricher/`](tools/enricher/). Each data
source is a Python plugin in [`tools/enricher/sources/`](tools/enricher/sources/).
To add a new one:

1. Read [`tools/enricher/sources/cpj.py`](tools/enricher/sources/cpj.py) or
   [`tools/enricher/sources/khrn.py`](tools/enricher/sources/khrn.py) as
   reference implementations.
2. Implement a `SourcePlugin` subclass with `fetch_all()` yielding
   `ExternalVictim` records.
3. Register with the `@register` decorator.
4. Add tests in [`tools/enricher/tests/`](tools/enricher/tests/) with HTML/JSON
   fixtures (no live HTTP in tests).
5. Run `python3 -m tools.enricher check -s <your_plugin> -v` to dry-run.
6. Document in `README.md`'s plugin table.

### Code contributions

Standard GitHub flow:

1. Fork → branch → pull request.
2. Run `npm test` (552 Vitest) and `python3 -m pytest tools/enricher/tests/ -v`
   (257 pytest) before pushing.
3. Run `npm run build` to verify Next.js build.
4. Keep PRs focused — one concern per PR.
5. Follow existing code style. ESLint is enforced in CI.

### Documentation

- Translate copy: `messages/*.json` (7 locales: en, de, fa, ar, fr, it, es).
- The methodology page at `/methodology` is the public-facing spec for how
  data is verified and deduplicated. If you change the verification rules,
  update both the SQL and that page.

---

## Security

Found a vulnerability? See [SECURITY.md](SECURITY.md) — please **don't open
a public issue** for security bugs.

---

## What we don't accept

- Pull requests with hardcoded credentials, API keys, or personal access tokens.
- Data scrapers that violate a source's robots.txt or terms of service without
  a documented public-interest justification.
- "AI-generated" victim biographies. We document real people from real sources.
- Code without tests.
- Edits to victim records without a citable source.

---

## License

By contributing code, you agree to license your contribution under the MIT
License (the code license — see [LICENSE](LICENSE)). By contributing data
(victim records, source citations, photos) you agree to license that
contribution under CC BY-SA 4.0.

---

## Contact

- Email: `<CONTACT_EMAIL>`
- Issues: https://github.com/iran-memorial26/iran-memorial/issues
