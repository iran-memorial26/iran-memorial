/**
 * Magnitsky-style biographical profiles for named judges who appear in
 * /accountability. Hand-curated from public sources (sanctions registries,
 * Wikipedia, Iran Human Rights, OpenSanctions, OFAC). Manually maintained;
 * the /accountability list itself is auto-extracted from victim records.
 *
 * Add new judges by appending to JUDGE_PROFILES below.
 */

export interface JudgeProfile {
  /** URL slug — must match the slugified judge name from accountability.ts */
  slug: string;
  /** Canonical full name */
  fullName: string;
  /** Spelling variants seen in sources */
  aliases: string[];
  /** Current or most recent role */
  role: string;
  /** Short factual one-liner */
  tagline: string;
  /** Birth date if known */
  born?: string;
  /** Birthplace if known */
  birthplace?: string;
  /** Multi-paragraph biography (English) */
  bio: string;
  /** German translation of the bio */
  bioDe?: string;
  /** Photo URL */
  photoUrl?: string;
  photoCredit?: string;
  /** International sanctions */
  sanctions: Array<{
    jurisdiction: "US" | "EU" | "UK" | "Canada" | "Switzerland";
    listedOn: string; // ISO date
    program: string; // e.g. "OFAC E.O. 13553"
    sourceUrl: string;
  }>;
  /** Notable trials and verdicts (with year) */
  notableCases: Array<{
    year: number;
    description: string;
    sourceUrl?: string;
  }>;
  /** External profile pages on watchdog sites */
  externalSources: Array<{
    name: string;
    url: string;
  }>;
}

export const JUDGE_PROFILES: JudgeProfile[] = [
  {
    slug: "abolghasem-salavati",
    fullName: "Abolghasem Salavati",
    aliases: ["Abolqasem Salavati", "Abulghasem Salavati", "Abdolghassem Salavati"],
    role: "Presiding Judge, Branch 15 of Tehran Revolutionary Court",
    tagline:
      "Known internationally as 'the Judge of Death' for sentencing 100+ political prisoners, journalists, and activists to long prison terms or execution.",
    born: "1967-07-16",
    birthplace: "Tuyserkan, Iran",
    bio: `Abolghasem Salavati became an Islamic Revolutionary Court judge on July 1, 2002 and was appointed head of Branch 15 of the Tehran Revolutionary Court on December 5, 2009. Educated at the University of Judicial Sciences and Administrative Services and the University of Tehran, he has presided over the most politically sensitive trials of the Islamic Republic for two decades.

Branch 15 has been the principal venue for the regime's prosecution of dissidents, journalists, foreign nationals accused of espionage, ethnic and religious minorities, and protesters. Salavati alone has sentenced more than 100 individuals to long prison terms, many to death — typically following grossly unfair proceedings reliant on forced confessions, no access to chosen counsel, and trials lasting only minutes.

Among his most documented verdicts: the 2014 hanging of Mohsen Amiraslani for "heresy," the 2015 12-year sentence of cartoonist Atena Farghadani for a single drawing, the 2022 death sentence and December 8 execution of protester Mohsen Shekari (the first protester executed in connection with the Mahsa Amini uprising), and the 2026 death sentences against four protesters in a single seven-defendant case (Hatami, Biglari, Vahedparast, Fahim) — all executed at Ghezelhesar Prison within a single week in April 2026.`,
    bioDe: `Abolghasem Salavati wurde am 1. Juli 2002 Richter am Islamischen Revolutionsgericht und am 5. Dezember 2009 zum Leiter der 15. Kammer des Revolutionsgerichts Teheran ernannt. Ausgebildet an der Universität für Rechtswissenschaften und der Universität Teheran, leitet er seit zwei Jahrzehnten die politisch heikelsten Verfahren der Islamischen Republik.

Die 15. Kammer ist der zentrale Schauplatz für die Verfolgung von Dissidenten, Journalisten, Ausländern unter Spionageverdacht, ethnischen und religiösen Minderheiten sowie Protestlern. Salavati allein hat über 100 Personen zu langen Haftstrafen verurteilt, viele zum Tode — meist nach krass unfairen Verfahren auf Basis erzwungener Geständnisse, ohne Zugang zu gewählten Anwälten und mit Verhandlungen die nur Minuten dauerten.

Zu den dokumentiertesten Urteilen gehören: die Hinrichtung von Mohsen Amiraslani 2014 wegen "Häresie", die 12-Jahres-Strafe gegen die Karikaturistin Atena Farghadani 2015 für eine einzige Zeichnung, das Todesurteil und die Hinrichtung des Protestlers Mohsen Shekari am 8. Dezember 2022 (der erste Hingerichtete der Mahsa-Amini-Welle) und 2026 die Todesurteile gegen vier Protestler in einem einzigen Sieben-Angeklagten-Verfahren (Hatami, Biglari, Vahedparast, Fahim) — alle innerhalb einer Woche im April 2026 im Ghezelhesar-Gefängnis hingerichtet.`,
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/39/Abolqasem_Salavati_in_Justice_week_conference_cropped.jpg/250px-Abolqasem_Salavati_in_Justice_week_conference_cropped.jpg",
    photoCredit: "Wikimedia Commons",
    sanctions: [
      {
        jurisdiction: "EU",
        listedOn: "2011-04-12",
        program: "Council Decision 2011/235/CFSP — human rights violations in Iran",
        sourceUrl: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32011D0235",
      },
      {
        jurisdiction: "US",
        listedOn: "2019-12-19",
        program: "OFAC, Executive Order 13553 — censorship and prohibition of free expression",
        sourceUrl: "https://home.treasury.gov/news/press-releases/sm862",
      },
      {
        jurisdiction: "UK",
        listedOn: "2022-12-09",
        program: "Global Human Rights Sanctions Regulations 2020",
        sourceUrl: "https://www.gov.uk/government/publications/iran-human-rights-sanctions",
      },
      {
        jurisdiction: "Canada",
        listedOn: "2022-12-08",
        program: "Special Economic Measures Act (SEMA) — Iran",
        sourceUrl: "https://www.canada.ca/en/global-affairs/news/2022/12/canada-imposes-additional-sanctions-on-iran.html",
      },
    ],
    notableCases: [
      { year: 2014, description: "Mohsen Amiraslani — death sentence for 'heresy', executed September 2014" },
      { year: 2015, description: "Atena Farghadani — 12 years 9 months for a satirical cartoon" },
      { year: 2022, description: "Mostafa Tajzadeh (former deputy minister) — 8 years" },
      { year: 2022, description: "Kameel Ahmady (Iranian-British anthropologist) — 9 years" },
      { year: 2022, description: "Emad Sharghi (Iranian-American) — 10 years on espionage charges" },
      { year: 2022, description: "Mohsen Shekari — death sentence; first protester executed in Mahsa Amini uprising (Dec 8, 2022)" },
      { year: 2026, description: "Amirhossein Hatami, Mohammad Amin Biglari, Shahin Vahedparast, Ali Fahim — death sentences in the IRGC-base-attack case; all hanged at Ghezelhesar within April 2-6, 2026" },
    ],
    externalSources: [
      { name: "Wikipedia", url: "https://en.wikipedia.org/wiki/Abolqasem_Salavati" },
      { name: "OpenSanctions", url: "https://www.opensanctions.org/entities/Q5963260/" },
      { name: "United Against Nuclear Iran — 'Judge of Death'", url: "https://www.unitedagainstnucleariran.com/abolqasem-salavati-judge-of-death" },
      { name: "US Treasury press release (Dec 2019)", url: "https://home.treasury.gov/news/press-releases/sm862" },
      { name: "Faces of Crime", url: "https://facesofcrime.org/profile/243/abolghasem-salavati/" },
    ],
  },
  {
    slug: "morteza-barati",
    fullName: "Morteza Barati",
    aliases: [],
    role: "Presiding Judge, Branch One of Isfahan Revolutionary Court",
    tagline:
      "Central figure in judicial repression in Esfahan province, repeatedly issuing death sentences against protesters using moharebeh and efsad-e fel-arz charges supported by torture-derived confessions.",
    bio: `Morteza Barati heads Branch One of the Isfahan Revolutionary Court and is one of the principal architects of judicial repression in central Iran. His name appears on the death sentences of multiple protesters tried for participation in the November 2019 fuel-price protests, the 2022-2023 Mahsa Amini uprising, and the December 2025 / January 2026 protests.

In the high-profile 'Isfahan House' case, Barati's branch issued death sentences against Saleh Mirhashemi, Majid Kazemi, and Saeed Yaghoubi — verdicts that human rights organizations documented as relying on torture, forced confessions, and grave violations of due process. Barati's branch also issued the (later-overturned) death sentence against rapper Toomaj Salehi in April 2024.

In March 2026 Barati issued the death sentence against 21-year-old Kyokushin karate champion Sasan Azadvar, who had been arrested during the January 2026 protests in Isfahan. Despite the absence of independent evidence and the prosecution's sole reliance on confessions Azadvar had retracted in court as torture-extracted, the verdict was upheld by the Supreme Court and Azadvar was secretly hanged at Dastgerd Prison on April 30, 2026.`,
    bioDe: `Morteza Barati leitet die erste Kammer des Revolutionsgerichts Isfahan und ist eine der zentralen Figuren der Justiz-Repression in Zentraliran. Sein Name steht auf den Todesurteilen mehrerer Protestler, die wegen Teilnahme an den Benzinpreis-Protesten vom November 2019, dem Mahsa-Amini-Aufstand 2022-2023 sowie den Protesten vom Dezember 2025 / Januar 2026 angeklagt wurden.

Im prominenten "Isfahan-House"-Fall verhängte Baratis Kammer Todesurteile gegen Saleh Mirhashemi, Majid Kazemi und Saeed Yaghoubi — Urteile, die Menschenrechtsorganisationen als auf Folter, erzwungenen Geständnissen und schwerwiegenden Verfahrensverstößen beruhend dokumentiert haben. Baratis Kammer verhängte auch das (später aufgehobene) Todesurteil gegen den Rapper Toomaj Salehi im April 2024.

Im März 2026 sprach Barati das Todesurteil gegen den 21-jährigen Kyokushin-Karate-Meister Sasan Azadvar aus, der bei den Januar-2026-Protesten in Isfahan verhaftet worden war. Trotz fehlender unabhängiger Beweise und obwohl die Anklage sich allein auf Geständnisse stützte, die Azadvar vor Gericht als unter Folter erpresst widerrief, wurde das Urteil vom Obersten Gericht bestätigt. Azadvar wurde am 30. April 2026 heimlich im Dastgerd-Gefängnis gehängt.`,
    sanctions: [
      {
        jurisdiction: "UK",
        listedOn: "2023-04-24",
        program: "Global Human Rights Sanctions Regulations 2020 — Iran human rights violations",
        sourceUrl: "https://www.gov.uk/government/publications/iran-human-rights-sanctions",
      },
      {
        jurisdiction: "Canada",
        listedOn: "2023-05-08",
        program: "Special Economic Measures Act (SEMA) — Iran",
        sourceUrl: "https://www.canada.ca/en/global-affairs/news/2023/05/canada-sanctions-iranian-officials.html",
      },
    ],
    notableCases: [
      { year: 2023, description: "'Isfahan House' case — death sentences for Saleh Mirhashemi, Majid Kazemi, Saeed Yaghoubi (Mahsa Amini protests); all executed May 19, 2023" },
      { year: 2024, description: "Rapper Toomaj Salehi — initial death sentence (overturned by Supreme Court)" },
      { year: 2026, description: "Sasan Azadvar — death sentence on moharebeh charge; executed April 30, 2026 at Dastgerd Prison" },
    ],
    externalSources: [
      { name: "OpenSanctions", url: "https://www.opensanctions.org/entities/NK-8RBuGXuzyAVGGRBaGuv7RM/" },
      { name: "United Against Nuclear Iran", url: "https://www.unitedagainstnucleariran.com/sanctioned-person/barati-morteza" },
      { name: "Faces of Crime", url: "https://facesofcrime.org/profile/610/morteza-barati/" },
      { name: "Iran Human Rights Monitor — Judicial Repression part 2", url: "https://iran-hrm.com/2026/04/29/accountability-for-the-orchestrators-and-executors-of-judicial-repression-in-iran-part-two/" },
    ],
  },

  // ─── 1988 Death Commission of Tehran ────────────────────────────────
  // Four men who together ordered 2,800-5,000 executions at Evin and
  // Gohardasht in summer 1988 (Amnesty / HRW range). Per-victim attribution
  // doesn't exist in our records (the Boroumand corpus tags 1988 victims as
  // "Islamic Republic" or "PMIO" without naming the commissioners). Listed
  // here as "notable historical perpetrators" — collectively responsible
  // for the ~3,666 records in our 1988 cohort.
  {
    slug: "hossein-ali-nayeri",
    fullName: "Hossein-Ali Nayeri",
    aliases: ["Hossein Ali Nayyeri", "Hosseinali Nayyeri"],
    role: "Sharia Judge, 1988 Death Commission of Tehran (deceased 2025)",
    tagline:
      "Khomeini's hand-picked sharia judge for the 1988 mass executions. His name was first on the death-commission list. Later promoted to Vice President of the Supreme Court.",
    born: "1956",
    bio: `Hossein-Ali Nayeri served as the religious judge of Tehran's Evin Prison from 1983 to 1989, appointed by Ayatollah Khomeini. In summer 1988 he became the senior cleric on the four-man "Death Commission" of Tehran — the body that, following Khomeini's handwritten fatwa, ordered the secret execution of thousands of political prisoners (predominantly affiliated with the Mojahedin-e Khalq Organization but also leftists). Nayeri's name was first on the commission roster.

The 1988 massacre lasted approximately five months and reached at least 32 cities. Estimates by Amnesty International, Human Rights Watch, and the UN Special Rapporteur range between 2,800 and 5,000 men, women and children executed in Tehran alone, with the total nationwide possibly exceeding 30,000. Bodies were buried in unmarked mass graves at sites such as Khavaran cemetery; families were never officially notified.

After 1988 Nayeri continued to climb the judicial ranks, becoming Head of the Supreme Disciplinary Court for Judges and a Vice President of the Supreme Court. He died on April 3, 2025, at age 69, never having faced criminal accountability. His final post was Senior Advisor to Judiciary Chief Mohseni-Eje'i.`,
    bioDe: `Hossein-Ali Nayeri war von 1983 bis 1989 von Ayatollah Khomeini ernannter Religionsrichter im Evin-Gefängnis Teheran. Im Sommer 1988 wurde er der ranghöchste Kleriker in der vierköpfigen "Todeskommission" Teherans — dem Gremium, das auf Grundlage von Khomeinis handschriftlichem Fatwa die geheime Hinrichtung tausender politischer Gefangener anordnete. Nayeris Name stand an erster Stelle der Kommissionsliste.

Das Massaker dauerte etwa fünf Monate und erreichte mindestens 32 Städte. Schätzungen von Amnesty International, Human Rights Watch und dem UN-Sonderberichterstatter bewegen sich zwischen 2.800 und 5.000 hingerichteten Männern, Frauen und Kindern allein in Teheran; die Gesamtzahl landesweit übersteigt nach manchen Schätzungen 30.000. Die Leichen wurden in unmarkierten Massengräbern verscharrt, etwa auf dem Khavaran-Friedhof; Familien wurden nie offiziell benachrichtigt.

Nach 1988 stieg Nayeri weiter in der Justizhierarchie auf — zum Leiter des Obersten Disziplinargerichts für Richter und zum Vizepräsidenten des Obersten Gerichts. Er starb am 3. April 2025 mit 69 Jahren, ohne sich je strafrechtlich verantworten zu müssen.`,
    sanctions: [
      {
        jurisdiction: "EU",
        listedOn: "2011-04-12",
        program: "Council Decision 2011/235/CFSP — human rights violations in Iran",
        sourceUrl: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32011D0235",
      },
      {
        jurisdiction: "UK",
        listedOn: "2022-12-09",
        program: "Global Human Rights Sanctions Regulations 2020",
        sourceUrl: "https://www.gov.uk/government/publications/iran-human-rights-sanctions",
      },
    ],
    notableCases: [
      { year: 1988, description: "Sharia-judge member of Tehran's 4-person Death Commission; collectively ordered 2,800-5,000 executions over ~5 months at Evin and Gohardasht prisons" },
      { year: 1989, description: "Continued as senior judge after the massacre; never investigated domestically" },
      { year: 2025, description: "Died April 3, 2025 without criminal accountability" },
    ],
    externalSources: [
      { name: "Wikipedia: 1988 executions of Iranian political prisoners", url: "https://en.wikipedia.org/wiki/1988_executions_of_Iranian_political_prisoners" },
      { name: "Iran 1988 Massacre — Nayyeri profile", url: "https://iran1988.org/hossein-ali-nayyeri/" },
      { name: "Iran Tribunal — death announcement", url: "https://irantribunal.com/hossein-ali-nayeri-member-and-sharia-judge-of-the-death-commission-has-died/" },
      { name: "Iran HRM — Death of Hossein-Ali Nayyeri", url: "https://iran-hrm.com/2025/04/05/death-of-hossein-ali-nayyeri-chief-judge-of-the-1988-mass-executions-tribunal/" },
    ],
  },
  {
    slug: "ebrahim-raisi",
    fullName: "Ebrahim Raisi",
    aliases: ["Seyyed Ebrahim Raisi", "Ebrahim Raeesi", "Ibrahim Raisi"],
    role: "Deputy Prosecutor, 1988 Death Commission · later President of Iran 2021-2024 (deceased)",
    tagline:
      "Youngest member of the Tehran Death Commission. Climbed from prosecutor to President of the Islamic Republic, all while sanctioned by the US for crimes against humanity. Killed in helicopter crash May 2024.",
    born: "1960-12-14",
    birthplace: "Mashhad, Iran",
    bio: `Ebrahim Raisi served as Deputy Prosecutor of Tehran in 1988 and was the youngest of the four men on the Tehran "Death Commission" that summer. Survivors and former political prisoners testify that Raisi pressed hard for execution in commission deliberations, often overruling colleagues who argued for leniency.

His career trajectory after 1988 traced the Islamic Republic's institutional protection of the perpetrators: First Deputy Chief Justice (2004-2014), Attorney General (2014-2016), Custodian of Astan Quds Razavi (2016-2019), Chief Justice (2019-2021), and finally President of Iran (August 2021 - May 2024). He won the 2021 election after the Guardian Council disqualified all serious challengers; turnout was the lowest in the Islamic Republic's history.

In November 2019 the US State Department added Raisi to its sanctions list under Executive Order 13876 for "human rights abuses" — making him the only Iranian president-elect to be under personal US sanctions when taking office. His presidency oversaw the brutal repression of the 2022-2023 Mahsa Amini uprising (500+ killed, 22,000+ arrested) and the December 2025 / January 2026 protest crackdown including the executions of teenage protesters.

Raisi died on May 19, 2024 in a helicopter crash in northwest Iran. He was never investigated, prosecuted, or even formally questioned about his role in 1988.`,
    bioDe: `Ebrahim Raisi war 1988 stellvertretender Staatsanwalt von Teheran und der jüngste der vier Männer in der Teheraner "Todeskommission" jenes Sommers. Überlebende und ehemalige politische Gefangene bezeugen, dass Raisi in den Kommissionsberatungen besonders auf Hinrichtung drängte und oft Kollegen überstimmte, die für Milde plädierten.

Seine Laufbahn nach 1988 zeichnet die institutionelle Protektion der Täter durch die Islamische Republik nach: Erster stellvertretender Justizchef (2004-2014), Generalstaatsanwalt (2014-2016), Verwalter des Astan Quds Razavi (2016-2019), Justizchef (2019-2021) und schließlich Präsident des Iran (August 2021 - Mai 2024). Er gewann die Wahl 2021 nachdem der Wächterrat alle ernsthaften Mitbewerber disqualifiziert hatte.

Im November 2019 setzte das US-Außenministerium Raisi unter Executive Order 13876 wegen "Menschenrechtsverletzungen" auf seine Sanktionsliste — er war damit der einzige iranische gewählte Präsident, der bei Amtsantritt persönlich unter US-Sanktionen stand. Seine Präsidentschaft beaufsichtigte die brutale Niederschlagung des Mahsa-Amini-Aufstands 2022-2023 (500+ Tote, 22.000+ Verhaftete) sowie die Repression vom Dezember 2025 / Januar 2026 inklusive der Hinrichtung jugendlicher Protestler.

Raisi starb am 19. Mai 2024 bei einem Hubschrauberabsturz im Nordwestiran. Er wurde nie zu seiner Rolle 1988 untersucht oder formell befragt.`,
    sanctions: [
      {
        jurisdiction: "US",
        listedOn: "2019-11-04",
        program: "OFAC, Executive Order 13876 — human rights abuses",
        sourceUrl: "https://home.treasury.gov/news/press-releases/sm818",
      },
    ],
    notableCases: [
      { year: 1988, description: "Deputy prosecutor on Tehran's 4-person Death Commission; survivors testify he pushed hardest for execution" },
      { year: 2022, description: "As President: presided over national crackdown on Mahsa Amini uprising (500+ killed, 22,000+ detained)" },
      { year: 2026, description: "Final months in office set policy framework for January 2026 protester executions" },
      { year: 2024, description: "Died May 19, 2024 in helicopter crash; never criminally investigated for 1988" },
    ],
    externalSources: [
      { name: "Wikipedia", url: "https://en.wikipedia.org/wiki/Ebrahim_Raisi" },
      { name: "Iran 1988 Massacre — Raisi profile", url: "https://iran1988.org/seyyed-ebrahim-reissi-al-sadat-aka-ebrahim-reissi/" },
      { name: "USIP Iran Primer — Raisi's role in 1988", url: "https://iranprimer.usip.org/blog/2021/jul/21/raisi-role-1988-massacre" },
      { name: "NCRI — Former MEK political prisoners testify", url: "https://www.ncrius.org/iran-election-2021-former-mek-political-prisoners-shed-light-on-ebrahim-raisis-criminal-record.html" },
    ],
  },
  {
    slug: "mostafa-pourmohammadi",
    fullName: "Mostafa Pourmohammadi",
    aliases: ["Mustafa Pourmohammadi"],
    role: "Intelligence Ministry representative, 1988 Death Commission · later Interior Minister and Justice Minister",
    tagline:
      "MOIS representative on Tehran's Death Commission. Identified by survivors as most hard-line for execution. Later served as Interior Minister under Ahmadinejad and Justice Minister under Rouhani.",
    born: "1959",
    bio: `Mostafa Pourmohammadi served as the Ministry of Intelligence (MOIS) representative on the four-man Tehran Death Commission in summer 1988. Survivor accounts consistently identify him as the commission member most relentlessly pushing for execution, frequently overriding the prosecutor Eshraghi when the latter argued for leniency on procedural grounds.

After 1988 Pourmohammadi was rewarded with high office: head of MOIS Foreign Intelligence (early 1990s), Deputy Intelligence Minister, Minister of Interior under President Ahmadinejad (2005-2008), and Minister of Justice under President Rouhani (2013-2017) — a striking testament to the Islamic Republic's institutional protection of the 1988 perpetrators.

In a remarkably candid 2016 interview Pourmohammadi defended the 1988 executions on tape: "We are proud to have carried out God's commandment concerning the [Mojahedin]." He has never been criminally investigated or sanctioned domestically.`,
    bioDe: `Mostafa Pourmohammadi war im Sommer 1988 der Vertreter des Geheimdienstministeriums (MOIS) in der vierköpfigen Teheraner Todeskommission. Aussagen Überlebender identifizieren ihn übereinstimmend als das Kommissionsmitglied, das am unnachgiebigsten auf Hinrichtung drängte und häufig den Staatsanwalt Eshraghi überstimmte.

Nach 1988 wurde Pourmohammadi mit hohen Ämtern belohnt: Chef der MOIS-Auslandsaufklärung (frühe 1990er), stellvertretender Geheimdienstminister, Innenminister unter Präsident Ahmadinejad (2005-2008) und Justizminister unter Präsident Rouhani (2013-2017).

In einem bemerkenswert offenen Interview von 2016 verteidigte Pourmohammadi die Hinrichtungen von 1988 auf Tonband: "Wir sind stolz, Gottes Gebot bezüglich der [Mojahedin] ausgeführt zu haben."`,
    sanctions: [],
    notableCases: [
      { year: 1988, description: "MOIS representative on Tehran Death Commission; identified by survivors as most aggressive for execution" },
      { year: 2005, description: "Appointed Minister of Interior under President Ahmadinejad" },
      { year: 2013, description: "Appointed Minister of Justice under President Rouhani" },
      { year: 2016, description: "Defended 1988 executions on the record: 'We are proud to have carried out God's commandment'" },
      { year: 2024, description: "Ran in 2024 presidential election; placed last among 6 candidates" },
    ],
    externalSources: [
      { name: "NCRI — Profile", url: "https://www.ncr-iran.org/en/news/anews/who-is-who/iran-1988-massacre-who-is-mostafa-pourmohammadi/" },
      { name: "Iran News Update — Controversial Legacy", url: "https://irannewsupdate.com/news/human-rights/the-controversial-legacy-of-mostafa-pourmohammadi-in-the-1988-massacre/" },
      { name: "Wikipedia: 1988 executions", url: "https://en.wikipedia.org/wiki/1988_executions_of_Iranian_political_prisoners" },
    ],
  },
  {
    slug: "morteza-eshraghi",
    fullName: "Morteza Eshraghi",
    aliases: ["Morteza Eshraqi"],
    role: "Public Prosecutor of Tehran, 1988 Death Commission",
    tagline:
      "Public prosecutor on Tehran's Death Commission. Survivor accounts document occasional interventions for prisoners from prophet-descended families — the only commission member to show any restraint.",
    bio: `Morteza Eshraghi served as Public Prosecutor of Tehran in 1988 and was a member of the four-man Tehran Death Commission. According to multiple survivor accounts collected by the Iran Human Rights Documentation Center and others, Eshraghi was the only commission member documented as occasionally arguing for leniency — specifically intervening on behalf of prisoners from sayyid (prophet-descended) families. His restraint was the exception, not the pattern; thousands were nonetheless executed under his signature.

After 1988 Eshraghi continued in senior judicial appointments. He has never been internationally sanctioned, criminally investigated, or publicly questioned about his role.`,
    bioDe: `Morteza Eshraghi war 1988 Generalstaatsanwalt von Teheran und Mitglied der vierköpfigen Teheraner Todeskommission. Nach mehreren Überlebenden-Aussagen war Eshraghi das einzige Kommissionsmitglied, das gelegentlich für Milde plädierte — speziell zugunsten von Gefangenen aus Sayyid-Familien (Prophet-Nachkommen). Seine Zurückhaltung war die Ausnahme, nicht die Regel; tausende wurden trotzdem unter seiner Unterschrift hingerichtet.

Nach 1988 setzte Eshraghi seine Laufbahn in hohen Justizämtern fort. Er wurde nie international sanktioniert, strafrechtlich untersucht oder öffentlich zu seiner Rolle befragt.`,
    sanctions: [],
    notableCases: [
      { year: 1988, description: "Public prosecutor on Tehran Death Commission; signed thousands of execution orders despite occasional interventions for sayyid prisoners" },
    ],
    externalSources: [
      { name: "Wikipedia: 1988 executions", url: "https://en.wikipedia.org/wiki/1988_executions_of_Iranian_political_prisoners" },
      { name: "Iran HRS — Death Commission members revealed", url: "https://en.iranhrs.org/death-commission-members-of-summer-1988-in-iran-revealed/" },
    ],
  },
];

export function getJudgeProfile(slug: string): JudgeProfile | undefined {
  return JUDGE_PROFILES.find((j) => j.slug === slug);
}

/** Slugs of profiles that don't appear in the auto-extracted accountability
 *  list (because per-victim attribution doesn't exist in our records).
 *  Surfaced separately on /accountability under "Notable Historical Perpetrators". */
export const HISTORICAL_PERPETRATOR_SLUGS = [
  "hossein-ali-nayeri",
  "ebrahim-raisi",
  "mostafa-pourmohammadi",
  "morteza-eshraghi",
];
