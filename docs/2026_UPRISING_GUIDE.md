# A Short Guide in English to What's Happening in Iran

> External reference document. Original author unknown. Captured 2026-02-14.
> Added to project documentation as primary source for the 2026 uprising context.

---

## What's Happened

Iran is in the middle of its largest uprising since the 1979 revolution. Protests that began in Tehran's Grand Bazaar on December 28 over economic collapse escalated into a nationwide anti-regime movement spanning all 31 provinces. On January 8 and 9, security forces opened fire on millions of demonstrators. The killing was industrialized: snipers on rooftops, live ammunition into crowds, then hospitals raided to arrest the wounded.

As of February 14, 2026:

| Source | Killed | Injured | Detained |
|--------|--------|---------|----------|
| **HRANA** (verified) | **7,003+** | 11,021+ | 42,486+ |
| Iran International (documented by name/photo) | 6,634 | — | — |
| Regime's official figure | 3,117 | — | — |
| TIME (Ministry of Health officials) | ~30,000 (Jan 8–9 alone) | — | — |
| Iran International (classified docs) | 36,500+ | — | — |
| Iranian doctors network (Sky News) | 20,000–30,000 | — | — |

The regime's official count of 3,117 contains at least 25 duplicated national IDs and is universally regarded as a deliberate undercount. These casualties exceed the *combined total* of every Iranian uprising since 1979.

The verified counts almost certainly represent a floor, not a ceiling. The number of dead depends heavily on a question no one can yet answer: how many of the 42,486+ people abducted by the regime are still alive? Iran International has received many credible reports of extrajudicial executions of detainees in Tehran and other cities.

On January 8, the regime imposed a near-total internet blackout that lasted over three weeks. Under that darkness, the massacres escalated.

---

## What's Next (as of Feb 14)

### February 14: International Solidarity Protests

Global day of action organized by Iran Monitor.

### February 17–18: The Chehelom

The chehelom (چهلم) — the fortieth day after a death — is among the most important observances in Iranian culture. These dates mark 40 days since the deaths on January 8 and 9.

In Iran's protest history, the chehelom has been weaponized by mourners for decades: the forty-day cycle of killing, mourning, and renewed protest was one of the engines that drove the 1979 revolution itself. Demonstrations erupted every 40 days throughout 1978, each one larger than the last. During the 2022 Mahsa Amini protests, security forces attacked chehelom gatherings and blocked roads to cemeteries.

Traders in the Telegram channel Eteraz-e Bazar have called for shopkeepers in Tehran's Grand Bazaar and elsewhere to close shop and gather on February 17 and 18.

---

## Documenting the Dead

### Why This Matters

It is universally understood — inside and outside Iran — that the regime will lie about how many people were killed. And then they will lie about *how* they were killed.

The first lie is already happening: the regime's official count of 3,117 is a fraction of every independent estimate. The second will follow: the steady rewriting of causes of death, the pressure on families to accept false narratives, the forced confessions broadcast on state television, and the claim that the dead were foreign agents or MEK operatives rather than shopkeepers and students and nurses.

But the documentation effort isn't only about defending against lies. It's about honoring the bravery and sacrifice of these people. They went into the streets knowing what the regime could do. Entire families came out on January 8. They deserve to be remembered by name.

### How the Documentation Works

**RememberTheirNames** (Telegram)

This channel maintains a database of identified victims as a systematic counter-ledger to the regime's erasure apparatus. It aggregates identifications from:
- Family confirmations transmitted via Starlink or Psiphon
- Hospital staff leaking records
- Morgue workers photographing intake logs
- Diaspora networks cross-referencing missing-persons reports

In early February, the regime released an official victim list. Iranians immediately began sharing names of killed family members missing from it, and a parallel website launched for people to report omissions.

**@Vahid (VahidOnline on Telegram)**

Iran's leading citizen journalist since the 2009 Green Movement. Now operating from the US East Coast, he maintains the largest social media following of any Iranian online activist. During this crisis, his Telegram channel broke the Kahrizak morgue footage: rows of bodies transported by pickup trucks, with on-screen labels reading "photo number … out of 250." He also surfaced CCTV footage of plainclothes agents storming apartment buildings, wielding batons, machetes, and firearms.

**Individual Eyewitness Accounts on Instagram and X**

A steady stream of personal tributes from small accounts: family members, friends, and neighbors posting the names and stories of people they lost.

---

## The Internet Blackout

### The Shutdown

On January 8, starting at 7 PM, the regime began progressively cutting internet access. By January 9, Iran was almost entirely severed from the global Internet. Mobile data, fixed broadband, and even landlines were shut down. The regime maintained access to its own "national intranet" — a controlled domestic network — while blocking all international gateways.

This was the most severe shutdown yet:
- **2019:** Lesser measures effectively suppressed information for over a week
- **2022:** Restrictions were significant but not total
- **2026:** Near-complete disconnection for over three weeks (documented by NetBlocks)

Brief flickers of connectivity appeared around January 24, but meaningful (and still heavily restricted) partial restoration didn't come until January 28. Even then, most users are limited to a whitelist of pre-approved domestic sites, like a state-run intranet.

### What Makes 2026 Structurally Different

The regime has moved beyond simply unplugging the internet. Tehran is now **degrading function** rather than severing access:
- Interfered with DNS resolution
- Disrupted TLS handshakes
- Destabilized encrypted traffic at the protocol layer

Devices remained nominally online, but secure websites failed to load, messaging apps stalled, and VPNs collapsed without clear cause. This is deliberate: protocol-level sabotage denies reliable communication without announcing repression. Latency rises during protests. Partial service returns during lulls. The Internet is contested territory.

---

## Starlink

### Dissemination Before the Blackout

Starlink terminals began entering Iran in 2022, after the Biden administration exempted the service from Iran sanctions during the Mahsa Amini protests. By January 2026, an estimated 50,000+ terminals were in the country, smuggled in and traded on the black market.

NasNet — a Persian-language community on Telegram — became the primary distribution and support network, complete with YouTube tutorials for setup and troubleshooting. SpaceX waived subscription fees during the protests; Starlink is now free of charge in Iran.

### How the Regime Handicapped Starlink

The regime deployed both **GPS spoofing** and **RF jamming** to degrade Starlink service, particularly in major cities. By January 11, the regime appears to have achieved a full Starlink shutdown for the first time.

Starlink supports an aiming mode that bypasses GPS (presumably for situations such as this), but packet loss was still bad. RF in Tehran, especially, is a contested environment.

### Is This Russian Technology?

Some analysts speculated that Iran is using Russia's "Kalinka" or Murmansk-BN jamming systems. However, RaazNet has argued persuasively that Iran has indigenous electronic warfare capabilities. Iran's own Cobra V8 system, unveiled in 2023, is designed for signal jamming.

More importantly, the threat to Starlink users isn't only about RF jamming. It's about **identification and targeting**:
- Drones (visual detection of dishes)
- Thermal imaging (dishes generate detectable heat signatures)
- RF detection (spectrum analyzers, detecting default Starlink SSID)
- Door-to-door sweeps (reported by WSJ)
- Informant networks

**Possession of a Starlink terminal carries up to 10 years in prison. Users charged with espionage face the death penalty.**

---

## The Regime's Cyberattacks

The regime is running continuous offensive cyber operations to infect citizens' devices and profile the connections used to evade the blackout.

### DCHSpy (MuddyWater / MOIS)

During the June 2025 war with Israel, the government pushed a fake Starlink app as bait. Dubbed DCHSpy by Lookout, it was developed by MuddyWater, an APT group affiliated with Iran's Ministry of Intelligence and Security (MOIS).

DCHSpy masquerades as VPN apps and Starlink, distributed via Telegram channels using anti-regime themes to attract exactly the population it's designed to surveil. Once installed, it collects:
- WhatsApp data, contacts, SMS, files
- Location and call logs
- Can record audio and take photos

### Known Iranian Mobile Malware

Lookout has tracked at least **17 distinct Iranian-origin mobile malware families** across 10+ APT groups since 2021, including:
- **BouldSpy** — used by Iran's Law Enforcement Command
- **SandStrike** — targeted practitioners of the Bahá'í Faith

The goal is comprehensive: if you're evading the blackout, the regime wants to know *how* you're evading it, *what* you're saying, and *who* you're saying it to.

---

## Circumvention Tools

### Psiphon + Conduit

Psiphon is far more widely used than Tor in Iran. Developed at the University of Toronto's Citizen Lab, Conduit lets diaspora Iranians donate their bandwidth as relay nodes.

By January 22:
- More than half of Psiphon's 2.8 million recorded connection attempts originated from Iran
- Over 40,000 simultaneous Iranian users connected
- ~200,000 new Iranian users outside the country registered on Psiphon's site to help others get back online

### Tor + Snowflake

Efforts to get more Snowflake proxies running among the Iranian diaspora are helping.

### Why Psiphon Dominates Over Tor (and Why That's Dangerous)

Tor provides much stronger privacy guarantees: it routes traffic through multiple encrypted relays so that no single node can see both who you are and what you're accessing. Psiphon is a **circumvention tool, not an anonymity tool** — it gets you past the censorship wall, but doesn't make you invisible.

The problem is that convenience is winning. Psiphon just works. Tor is slower, more fragile under Iranian network conditions, and the rest of the web often treats Tor exit traffic as hostile (CAPTCHAs, blocked connections, degraded service).

The regime has taken active steps to degrade Psiphon: Psiphon's obfuscated traffic is increasingly fingerprinted by Iran's deep packet inspection infrastructure. Users report connections cycling every 30 seconds. The regime's approach has shifted from blocking circumvention tools outright to degrading their function below the threshold of usability.

### The Telegram Problem

**Telegram is widely treated by Iranian users as if it is secure, private, and strongly end-to-end encrypted. It is absolutely not.**

- Telegram's default "Cloud Chats" are encrypted only between client and server; Telegram's servers can read them
- End-to-end encryption is available only in "Secret Chats," which most users never enable and which does not work for group chats or channels
- Nearly all protest coordination and information sharing happens in group chats and channels

Telegram is *the* platform of this uprising: Eteraz-e Bazar, RememberTheirNames, Vahid Online, NasNet — all are Telegram channels.

The regime has:
- A long history of pressuring Telegram for access
- Deployed state-sponsored Telegram client forks (Hotgram, Telegram Talaeii) confirmed by an Iranian member of parliament to have been developed by a domestic security agency
- Iranian APT groups deploying infostealers specifically targeting Telegram Desktop data (documented by Check Point Research)

**Recommendation:** Use Signal for sensitive communications and treat Telegram as what it is: a broadcast platform with a security reputation it has not earned.

---

## What's Different This Time

### Scale of Participation

Verified casualties in January 2026 exceed the combined total of all previous uprisings since 1979. Millions in the streets over multiple days — surpassing anything since the revolution itself.

### The Bazaaris Switched Sides

The merchant class that helped overthrow the Shah in 1979 is now calling for the Shah's return. This is structurally significant: the bazaar is the economic backbone of traditional Iranian society.

### Explicit Monarchist Sentiment

Previous uprisings were ideologically diffuse. This one has a focal point: Reza Pahlavi, the Lion and Sun, "Javid Shah." Whether Iranians genuinely want a restored monarchy or are using Pahlavi as a pragmatic rallying symbol is an open question. But the chants are unambiguous.

### Post-June 2025 Context

The 12-day war with Israel devastated the popular perception of regime strength. Iran's regional proxies — the "Axis of Resistance" — have been systematically degraded. The regime looks weaker militarily than at any point since 1979.

### The Will of the People

There is a qualitative shift in the population's willingness to absorb costs. The phrase "this is the final battle" is not posturing. People who came out on January 9 knew they might die. And yet they came.

---

## Symbols and Language of the Movement

### "Javid Shah" (شاه جاوید)

The defining chant. Crowds across Iran — including in conservative religious cities — are openly calling for the return of the Pahlavi monarchy. Reza Pahlavi has positioned himself as a transitional leader, calling for a free referendum on Iran's political future rather than claiming hereditary right to rule.

Key chants:
- **"Javid Shah"** — Long Live the Shah
- **"Reza Shah, ruhat shad"** — Reza Shah, may your soul be blessed
- **"In akharin nabarde, Pahlavi barmigarde"** — This is the final battle, Pahlavi will return
- **"Shah mi-yad be khune, Zahak sarnegune"** — The Shah is coming home, Zahhak (the mythological tyrant) is overthrown
- **"Na Qazze na Lebnan, janam fadaye Iran"** — Neither Gaza nor Lebanon, my life for Iran

The last one is a direct indictment of the regime's spending on Hezbollah, Hamas, and regional proxy wars while the Iranian economy collapses.

### The Lion and Sun (شیر و خورشید)

Protesters are flying the pre-1979 Iranian flag bearing the Lion and Sun emblem — the flag of the Pahlavi era. For a regime built on the erasure of the Pahlavi legacy, this is existentially threatening. The Lion and Sun has become the visual shorthand for the movement.

### Dorud (درود)

A linguistic nuance worth understanding. Salaam (سلام), the common everyday greeting, derives from Arabic. **Dorud** is purely Persian, from Old Iranian *druvataat*, meaning "wholeness" or "wellbeing." The deliberate use of dorud over salaam is part of a broader cultural reclamation: Iranians asserting pre-Islamic Persian identity against the theocracy's imposed Arabization.

Key expressions:
- **Dorud bar shomâ** (درود بر شما) — "Greetings to you." Polite, respectful form.
- **Dorud bar sharafet** (درود بر شرافتت) — "Blessings upon your honor." Sharaf (شرف) encompasses dignity, moral integrity, loyalty, and grace. Its opposite, *bi-sharaf* ("without honor"), is one of the most cutting insults in the language and is itself a common protest chant aimed at the regime.
- **Dorud bar [name]** (درود بر) — "Blessings upon [name]" — used as a tribute to the fallen.

The broader preference for native Persian vocabulary — *sepâs* instead of *mersi* for "thank you," *dorud* instead of *salaam* — has grown into a deliberate linguistic trend, part of the same cultural assertion that drives the other symbols of this uprising.

---

## Where to Get Updates

### Live / Continuously Updated

| Source | Description |
|--------|-------------|
| **Iran Monitor** | Aggregated dashboard with protest maps, casualty counts, and real-time updates. Best single-page overview. |
| **Institute for the Study of War: Iran Indicators** | Continuously updated analysis of regime stability indicators. |
| **Iran International** | London-based Persian-language outlet. Most aggressive on casualty reporting (published the 36,500 figure). Editorially sympathetic to the opposition, but sourcing from inside Iran appears strong. |
| **NetBlocks** | Real-time internet connectivity monitoring. Most authoritative source on the blackout itself. |
| **RememberTheirNames** (Telegram) | Database of identified fallen. |

### Daily / Regular Analysis

| Source | Description |
|--------|-------------|
| **Understanding War** | Daily updates (Jan 8, Jan 9, Jan 10 and continuing) |
| **HRANA (Human Rights Activists News Agency)** | US-based, provides the most methodical verified casualty counts |
| **Iran Human Rights (IHRNGO)** | Norway-based, independent documentation |

---

*Dorud bar hameh-ye ânhâ ke jân dâdand.*

*Blessings upon all those who gave their lives.*

---

*Added to project documentation: 2026-02-15*
