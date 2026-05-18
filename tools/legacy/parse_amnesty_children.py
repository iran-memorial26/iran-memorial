#!/usr/bin/env python3
"""
Parse Amnesty International report MDE 13/6104/2022:
"Iran: Killings of children during youthful anti-establishment protests"

Extracts 44 child victims and enriches existing YAML files with:
- Detailed circumstances from Amnesty
- Ethnicity (Baluchi/Kurdish)
- Verified cause of death
- Amnesty as additional source

Usage:
    python3 tools/parse_amnesty_children.py [--dry-run]
"""

import os
import re
import sys
import glob

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
VICTIMS_DIR = os.path.join(PROJECT_ROOT, "data", "victims")
TXT_PATH = "/tmp/amnesty_children.txt"

DRY_RUN = "--dry-run" in sys.argv

# --- Manual mapping: Amnesty child number → YAML filename ---
# Resolved by searching data/victims/2022/ for each child
MANUAL_MATCH = {
    1: "2022/esmailzadeh-sarina-2006.yaml",
    2: "2022/hazrati-mehdi.yaml",
    3: "2022/basati-amir-hossein-2007.yaml",
    4: "2022/veisi-bahauddin-2006.yaml",
    5: "2022/adinehzadeh-abolfazi-2006.yaml",
    6: "2022/salanghouch-ali-mozaffari-2005.yaml",
    7: "2022/pirfalak-kian-2013.yaml",
    8: "2022/payani-artin-rahmani-2009.yaml",
    9: "2022/maghsoodi-sepehr-2008.yaml",
    10: "2022/saedi-sarina-2006.yaml",
    11: "2022/pabandi-daniel-2005.yaml",
    12: "2022/mousavi-seyyed-sina.yaml",
    13: "2022/bahu-abolfazl.yaml",
    14: "2022/shahnavazi-mohammad-eghbal-naebzehei-2006.yaml",
    15: "2022/shirouzehi-jaber-2010.yaml",  # or shirouzi-jaber-2010
    16: "2022/pousheh-javad-2011.yaml",
    17: "2022/gamshadzehi-mohammad-amin.yaml",
    18: "2022/hashemzehi-samer-2006.yaml",
    19: "2022/keshani-sadis-2008.yaml",
    20: "2022/shahouzehi-yaser-2006.yaml",
    21: "2022/barahouie-ali-2008.yaml",
    22: "2022/naroei-hasti-2016.yaml",  # or narui-hasti
    23: None,  # Danial Shahbakhsh — not in data, needs new YAML
    24: "2022/rakhshani-mohammad-2010.yaml",
    25: "2022/safarzehi-omid-2005.yaml",
    26: "2022/sarani-omid-2010.yaml",
    27: "2022/mirshekar-2020.yaml",
    28: "2022/narouie-omid.yaml",
    29: "2022/kochakzaei-adel.yaml",
    30: "2022/mirkazehi-mobin.yaml",
    31: "2022/bahadurzehi-yaser-2005.yaml",
    32: "2022/shakarami-nika-2006.yaml",
    33: "2022/sarvari-mohammad-reza-2008.yaml",
    34: "2022/tajik-setareh-2005.yaml",
    35: "2022/mahmoudi-siavash-2006.yaml",
    36: "2022/farokhipour-amir-mahdi-2005.yaml",
    37: None,  # Ahmadreza Qeleji — not in data, needs new YAML
    38: "2022/khial-zakaria-2006.yaml",
    39: "2022/mahmoudpour-abdollah-2006.yaml",
    40: None,  # Amin Marefat — not in data, needs new YAML
    41: "2022/daroftadeh-kumar-2006.yaml",
    42: "2022/dost-nima-shafagh-2006.yaml",  # or doust-nima-shafagh-2006
    43: "2022/shukri-karvan-ghader-2006.yaml",
    44: "2022/nikou-mahdi-mousavi-2006.yaml",
}

# --- 44 children extracted from the report ---
# Each entry: (number, name, age, gender, ethnicity, city, province, date_of_death, cause_of_death, circumstances_summary)
CHILDREN = [
    (1, "Sarina Esmailzadeh", 16, "female", None, "Karaj", "Alborz",
     "2022-09-23", "Fatal beating (batons to head)",
     "Security forces fatally struck her head with batons in Gohardasht, Karaj. Authorities did not allow the family to see her body; brought wrapped in shroud and forced immediate burial. Head of justice in Alborz province claimed she committed suicide by jumping from a rooftop. Revolutionary Guards coerced her mother into false video statement. Agents threatened to kill or harm her surviving brother if family did not accept official narrative."),

    (2, "Mehdi Hazrati", 17, "male", None, "Karaj", "Alborz",
     "2022-11-03", "Gunshot (headshot, live ammunition)",
     "Security forces fatally shot him in the head with live ammunition during protests marking the 40th day commemoration of Hadis Najafi. Video shows his lifeless body in a pool of blood surrounded by dozens of Special Forces (yegah-e vijeh) police and plainclothes agents. Head of justice of Alborz confirmed he was fatally shot in the forehead but denied police had firearms."),

    (3, "Amir Hossein Basati", 15, "male", "Kurdish", "Kermanshah", "Kermanshah",
     "2022-09-21", "Gunshot (close range)",
     "Security forces killed him during protests in Kashikari neighbourhood. Eyewitness said he died immediately after riot police fired from close range. Video shows him face down bleeding from back and face. Family had no information for days until they saw video online; found body in hospital morgue. Legal Medicine Organization confirmed gunshot wound death."),

    (4, "Bahaoddin Veisi", 16, "male", "Kurdish", "Javanroud", "Kermanshah",
     "2022-11-20", "Gunshot (live ammunition)",
     "Revolutionary Guards shot him while he was in a car with his brother and friends, returning from a demonstration at a hospital where teacher Erfan Kakaie had been killed. Died from gunshot wounds at hospital. Brother detained, denied medical care, forced to give statement blaming Kurdish opposition groups. Family forced to bury without public funeral. His killing sparked further mass protests on 21 November."),

    (5, "Abolfazl Adinehzadeh", 17, "male", None, "Mashhad", "Razavi Khorasan",
     "2022-10-08", "Metal pellets (birdshot) at close range",
     "Security forces fired dozens of metal pellets at close range. Burial certificate: 'hit by metal pellets (hunting birdshot)', death from 'kidney and liver damage' and 'trauma caused by bleeding'. Family told to 'zip your mouth'. Pressured to say son was a Basij member killed by protesters. Father's public statement: 'What crime did my son commit that you fired 24 pellets into his stomach.'"),

    (6, "Ali Mozaffari", 17, "male", None, "Ghouchan", "Razavi Khorasan",
     "2022-09-21", "Gunshot (stomach, live ammunition)",
     "Shot in the stomach during protests in Ghouchan. Died shortly afterwards. Video shows protesters carrying wounded person while narrator says victim was shot and killed with live ammunition."),

    (7, "Kian Pirfalak", 9, "male", None, "Izeh", "Khuzestan",
     "2022-11-16", "Gunshot (live ammunition)",
     "Plainclothes security officials shot him while he was in a car with his family during protests. His mother Zeinab Molaierad publicly described the incident at funeral: officials ordered car to stop, then opened fire. Father severely injured. Mother opened car door screaming children were inside. Officials took wounded Kian to Red Crescent building. Viral video of school presentation 'in name of a God of Rainbow'. Leaked audio proved arrested 'terrorists' were unrelated to the incident."),

    (8, "Artin Rahmani", None, "male", None, "Izeh", "Khuzestan",
     "2022-11-16", "Gunshot (live ammunition)",
     "Fatally shot during protests in Izeh. Age reported as 13 or 16 by different state media sources. Before his death, he wrote a diary entry to his mother: 'Forgive me, mother. I want to step onto a path which could mean that you may not see me grow up.' Killed same evening as Kian Pirfalak and Sepehr Maghsoudi."),

    (9, "Sepehr Maghsoudi", 14, "male", None, "Izeh", "Khuzestan",
     "2022-11-16", "Gunshot (headshot, live ammunition)",
     "Shot in the head with live ammunition during protests in Izeh. Two hours after body transferred to morgue, security forces removed it without family's knowledge. Authorities told family body would not be returned 'to avoid a reaction from the public'. Killed same evening as Kian Pirfalak and Artin Rahmani."),

    (10, "Sarina Saedi", 15, "female", "Kurdish", "Sanandaj", "Kurdistan",
     "2022-10-27", "Fatal beating (batons to head)",
     "Participated in protests on evening of 26 October, beaten on head with batons. Returned home and went to sleep. Family found her irresponsive next day; hospital declared brain haemorrhage and death. Family detained until 2am, forced to bury without ceremony in middle of night at Behesht Mohammadi Cemetery. Governor announced cause as 'accidental use of drugs or suicide'. Father coerced into repeating official phrasing verbatim."),

    (11, "Danial Pabandi", 17, "male", "Kurdish", "Saqqez", "Kurdistan",
     "2022-11-16", "Gunshot (back, live ammunition)",
     "Shot in the back by paramilitary Basiji agents from an unlicensed vehicle while on a motorcycle during protests in Saqqez. Father posted video saying Basiji agents shot his son. Governor, judicial official, police chiefs pressured family to stay silent. Told death would be classified as 'martyrdom' like Sistan-Baluchestan victims. Family forced to bury in early morning hours, denied right to wash and prepare body."),

    (12, "Sina Loh Mousavi", None, "male", None, "Amol", "Mazandaran",
     "2022-09-21", "Gunshot (live ammunition)",
     "Shot during violent crackdown at Office of the Governor in Amol. Age reported as 15 or 16. Eyewitness from within security forces described how riot police and Revolutionary Guards fired birdshot and live ammunition from 10-15 metres at protesters. Three others killed simultaneously. Eyewitness confirmed protesters did not wield firearms. Leaked document shows commander ordered forces to 'go as far as causing deaths'."),

    (13, "Abolfazl Bahou", None, "male", None, "Qaemshahr", "Mazandaran",
     "2022-09-20", "Gunshot (live ammunition)",
     "Shot and killed with live ammunition during crackdown on protests in Qaemshahr. Age reported as 13 or 17. Body returned to family on condition they remain silent and bury quickly."),

    (14, "Mohammad Eghbal Shahnavazi", 17, "male", "Baluchi", "Zahedan", "Sistan-Baluchestan",
     "2022-09-30", "Gunshot (chest, live ammunition)",
     "Shot during Bloody Friday massacre after Friday prayers outside police station. Family searched multiple hospitals, witnessed hundreds of wounded at Khatamolanbia hospital. Found body in Makki Mosque with gaping hole in chest. Family covered body in ice, buried next day informally in Lar cemetery. Born 9 January 2005, did not have national identification booklet (shenasnameh)."),

    (15, "Jaber Shiroozehi", 12, "male", "Baluchi", "Zahedan", "Sistan-Baluchestan",
     "2022-09-30", "Gunshot (headshot, live ammunition)",
     "Killed during Bloody Friday. Shot in the head. Iranian authorities claimed 'there is no death record' to UN Human Rights Council."),

    (16, "Javad Pousheh", 11, "male", "Baluchi", "Zahedan", "Sistan-Baluchestan",
     "2022-09-30", "Gunshot (headshot, live ammunition)",
     "Killed during Bloody Friday. Shot in back of head, bullet exited through right cheek. Videos show bloodied body being carried amid chaotic scenes. Amnesty weapons expert confirmed wound analysis. Authorities claimed 'no death record' to UN."),

    (17, "Mohammad Amin Gamshadzehi", 17, "male", "Baluchi", "Zahedan", "Sistan-Baluchestan",
     "2022-09-30", "Gunshot (heart, live ammunition)",
     "Killed during Bloody Friday. Just finished Friday prayers and was walking home when shot in the heart just outside prayer site. Authorities claimed 'no death record' to UN."),

    (18, "Samer Hashemzehi", 16, "male", "Baluchi", "Zahedan", "Sistan-Baluchestan",
     "2022-09-30", "Gunshot (headshot, live ammunition)",
     "Killed during Bloody Friday. Walking home after prayers when shot in back of head. Videos show him bleeding heavily. Despite evidence, authorities claimed 'no death record' — yet forced family to accept death certificate citing 'natural' cause. Family coerced into signing statement of no complaint. Security forces fired into his mourning ceremony on 7 October in Taftan."),

    (19, "Sodeys Keshani", 14, "male", "Baluchi", "Zahedan", "Sistan-Baluchestan",
     "2022-09-30", "Gunshot (head and heart, live ammunition)",
     "Killed during Bloody Friday. Shot in head and heart. Authorities claimed 'no death record' to UN."),

    (20, "Yaser Shahouzehi", 16, "male", "Baluchi", "Zahedan", "Sistan-Baluchestan",
     "2022-09-30", "Gunshot (heart, live ammunition)",
     "Killed during Bloody Friday. Shot in heart. Authorities claimed 'no death record' to UN."),

    (21, "Ali Barahouie", 14, "male", "Baluchi", "Zahedan", "Sistan-Baluchestan",
     "2022-09-30", "Gunshot (neck and chest, live ammunition)",
     "Killed during Bloody Friday. Shot in neck and chest while still inside the Mosalla prayer site. Authorities claimed 'no death record' to UN."),

    (22, "Hasti Narouie", 6, "female", "Baluchi", "Zahedan", "Sistan-Baluchestan",
     "2022-09-30", "Tear gas canister to head",
     "Six-year-old girl killed during Bloody Friday. Hit in head with tear gas canister at prayer site. Father coerced into video statement claiming death from stone throwing or crowd crush. Threats that 'problems could emerge' for surviving children."),

    (23, "Danial Shahbakhsh", 11, "male", "Baluchi", "Zahedan", "Sistan-Baluchestan",
     "2022-09-30", "Gunshot (live ammunition)",
     "Killed during Bloody Friday with live ammunition."),

    (24, "Mohammad Rakhshani", 12, "male", "Baluchi", "Zahedan", "Sistan-Baluchestan",
     "2022-09-30", "Gunshot (headshot, live ammunition)",
     "Killed by Basiji agents near Sarollah Basij base in Kawsar area. Shot in head while his brother Mohsen was shot in back trying to save him. Basiji agents opened fire on protesters simply chanting. Family offered monthly payments on condition of silence. Authorities claimed 'no death record' to UN."),

    (25, "Omid Safarzehi", 16, "male", "Baluchi", "Zahedan", "Sistan-Baluchestan",
     "2022-09-30", "Gunshot (headshot, live ammunition)",
     "Killed during crackdown in Shirabad area. Shot in head. Videos show him lying lifeless with face covered in blood. Did not have national identification booklet (shenasnameh). Family buried him informally without burial certificate. Authorities claimed 'no death record' to UN."),

    (26, "Omid Sarani", 13, "male", "Baluchi", "Zahedan", "Sistan-Baluchestan",
     "2022-09-30", "Gunshot (live ammunition)",
     "Killed in Shirabad area. Videos document security forces firing at peaceful protesters including children sheltering behind walls or running away. Second video shows protesters carrying bloodied bodies of two wounded children."),

    (27, "Mirshekar", 2, "male", "Baluchi", "Zahedan", "Sistan-Baluchestan",
     "2022-10-02", "Gunshot (headshot, live ammunition)",
     "Two-year-old toddler (family name Mirshekar, first name possibly Mohammad Mehdi). Standing outside entrance of his house in Jamejam street. Shot in head as security forces fired in all directions to disperse protests."),

    (28, "Omid Narouei", 16, "male", "Baluchi", "Zahedan", "Sistan-Baluchestan",
     "2022-10-28", "Gunshot (headshot, live ammunition)",
     "Had gone to buy bread. Shot three times in head by Basij agents while passing in front of Basij base near Kawsar/Besat intersection. Graphic videos show disfigured and bloodied face."),

    (29, "Adel Kochak Zay", 14, "male", "Baluchi", "Zahedan", "Sistan-Baluchestan",
     "2022-10-28", "Gunshot (neck, live ammunition)",
     "Shot in neck on way home after Friday prayers near Great Mosalla/Makki Mosque. First hospital refused admission. Died before reaching second hospital. Medical note confirms neck gunshot wound. Graphic videos show disfigured face."),

    (30, "Mobin Mirkazehi", 14, "male", "Baluchi", "Khash", "Sistan-Baluchestan",
     "2022-11-04", "Gunshot (headshot, live ammunition)",
     "Shot in head during crackdown on protests outside governor's office in Khash, after Friday prayers. Uniformed security forces fired from rooftops and from pickup trucks. Friday prayer leader of Al-Khalil Mosque publicly confirmed: 'Children and youth make up the majority of those killed.'"),

    (31, "Yaser Bahadorzehi", 17, "male", "Baluchi", "Khash", "Sistan-Baluchestan",
     "2022-11-04", "Gunshot (live ammunition)",
     "Shot during crackdown in Khash. Body found dumped near governor's office next day. Had severe mental health disability (confirmed by disability identification card on file with Amnesty)."),

    (32, "Nika Shakarami", 16, "female", "Persian", "Tehran", "Tehran",
     "2022-09-21", "Fatal beating (multiple injuries from hard object)",
     "Forcibly disappeared on 20 September after protests. Last spoke to mother around 11:30pm saying she was being chased. Body found 9 days later in Kahrizak morgue — cheekbones, nose and teeth broken, skull pounded. Burial certificate: 'multiple injuries caused by collision with hard object'. Security forces secretly moved body and buried in remote village Hayatolgheyb without family consent. Aunt and uncle arrested, coerced into false video statement. Mother publicly retracted official narrative."),

    (33, "Mohammad Reza Sarvari", 14, "male", "Afghan", "Shahr-e Rey", "Tehran",
     "2022-09-21", "Gunshot (headshot, live ammunition)",
     "14-year-old Afghan boy shot in back of head while fleeing security forces. Burial certificate: 'bleeding and shattered brain tissue' from 'fast-moving projectile'. Lawyer published certificate on Twitter to counter authorities' 'suicide' narrative. Authorities claimed he was 'shot dead by unknown persons' and denied law enforcement had firearms."),

    (34, "Setareh Tajik", 17, "female", "Afghan", "Tehran", "Tehran",
     "2022-09-22", "Fatal beating (multiple injuries from hard object)",
     "17-year-old Afghan girl killed during protests. Burial certificate: 'multiple injuries caused by collision with hard object'. Body showed bleeding from head, ears, nose and mouth. Family told she committed suicide. Forced to bury same evening without funeral. Family repeatedly tried to file complaint — authorities gave contradictory accounts. Autopsy report requests unanswered."),

    (35, "Siavash Mahmoudi", 16, "male", None, "Tehran", "Tehran",
     "2022-09-25", "Gunshot (headshot, live ammunition)",
     "Shot in head during protests in Tehran. Mother's viral video: 'They killed my child. They shot him in his head. I am proud to be the mother of Siavash Mahmoudi. I am not afraid of anyone. They are telling me to remain silent, but I will not sit in silence.'"),

    (36, "Amir Mehdi Farrokhipour", 17, "male", None, "Tehran", "Tehran",
     "2022-09-28", "Gunshot (chest, live ammunition and metal pellets)",
     "Shot near Keshavarz Boulevard with both metal pellets and live ammunition. Died from gunshot wounds in chest. Father forced to record false video statement saying son died in motorcycle accident — threatened with harm to daughters. Authorities cited 'multiple injuries due to being hit by a hard object'."),

    (37, "Ahmadreza Qeleji", 17, "male", None, "Tehran", "Tehran",
     "2022-09-21", "Gunshot (chest and stomach, live ammunition)",
     "Shot with live ammunition during crackdown in Tehran. Burial certificate: 'hit by high-speed projectiles', cause of death 'internal damage to chest and stomach' and 'trauma caused by bleeding'."),

    (38, "Zakaria Khial", 16, "male", "Kurdish", "Piranshahr", "West Azerbaijan",
     "2022-09-20", "Gunshot (close range, live ammunition) and beating",
     "Shot from about two meters with live ammunition. While lying bleeding, security forces severely beat him, breaking his legs and hands. Family pressured to give video statement blaming Kurdish opposition for his death."),

    (39, "Abdollah Mahmoudpour", 17, "male", "Kurdish", "Balou village", "West Azerbaijan",
     "2022-09-21", "Gunshot (live ammunition)",
     "Killed near Basij headquarters in village of Balou when security forces fired at protesters. Eyewitness voice message: 'They are directly killing us.' Video shows security forces continued firing even when protesters had moved away and posed no imminent threat."),

    (40, "Amin Marefat", 16, "male", "Kurdish", "Oshnavieh", "West Azerbaijan",
     "2022-09-21", "Gunshot (heart, live ammunition)",
     "Killed by Revolutionary Guards randomly firing live ammunition at protesters in Oshnavieh. 'Amin Marefat was shot in his heart and the bullet exited through his back.'"),

    (41, "Koumar Daroftadeh", 16, "male", "Kurdish", "Piranshahr", "West Azerbaijan",
     "2022-10-30", "Metal pellets at close range (~1 metre)",
     "Shot with metal pellets in chest and stomach from approximately 1 metre distance. Legal Medicine Organization confirmed close-range firing. Family found body at hospital. Authorities forced burial outside Piranshahr, in village Ziokeh 25km away. Father's emotional funeral speech: 'I named him Koumar (Republic). I am happy that he has been martyred for freedom.' Father summoned for interrogation, pressured to blame Kurdish opposition. Father publicly refused: 'The authorities killed my son and must be held accountable.'"),

    (42, "Nima Shafaghdoost", 16, "male", "Kurdish", "Urmia", "West Azerbaijan",
     "2022-10-05", "Metal pellets",
     "Shot with metal pellets, did not seek treatment for days out of fear of arrest. Died on 5 October. Authorities falsely claimed death was caused by 'Capnocytophaga infection due to dog bites'. Family pressured into false statement at police station. Police chief publicly repeated the dog bite narrative."),

    (43, "Karvan Ghader Shokri", 16, "male", "Kurdish", "Piranshahr", "West Azerbaijan",
     "2022-11-19", "Gunshot (kidneys and legs, live ammunition)",
     "Shot twice in kidneys and legs during protests. Died from injuries on 20 November. His killing sparked further mass protests; one mourner killed during his funeral on 21 November."),

    (44, "Mehdi Mousavi Nikou", 16, "male", None, "Zanjan", "Zanjan",
     "2022-09-21", "Metal pellets then fatal beating",
     "First shot with metal pellets from behind, causing him to fall. Security forces then fatally struck his head and body with batons. Died while being transferred to hospital."),
]


def normalize_for_match(name):
    """Normalize name for matching against YAML filenames."""
    name = name.lower().strip()
    name = re.sub(r'\([^)]*\)', '', name).strip()
    name = name.replace("'", "").replace('"', '')
    # Common transliteration mappings
    name = name.replace("hossein", "hosseini").replace("hosseini", "hossein")
    return name


def find_yaml_match(name, children_entry):
    """Find matching YAML file for a child victim."""
    _, child_name, age, _, _, city, province, date_of_death, _, _ = children_entry

    # Build search patterns from name parts
    parts = child_name.lower().split()
    if not parts:
        return None, None

    # Try glob patterns
    candidates = []

    # Strategy 1: lastname-firstname pattern
    if len(parts) >= 2:
        last = parts[-1]
        first = parts[0]
        patterns = [
            f"*/{last}-{first}*.yaml",
            f"*/{last}-*{first}*.yaml",
        ]
        # Also try with middle names
        if len(parts) >= 3:
            mid = parts[1]
            patterns.append(f"*/{last}-{first}-{mid}*.yaml")
            patterns.append(f"*/{last}-{mid}-{first}*.yaml")

        for pattern in patterns:
            matches = glob.glob(os.path.join(VICTIMS_DIR, pattern))
            candidates.extend(matches)

    # Strategy 2: search by parts
    if not candidates and len(parts) >= 2:
        # Try just last name
        last = parts[-1]
        matches = glob.glob(os.path.join(VICTIMS_DIR, f"*/{last}-*.yaml"))
        for m in matches:
            # Check if first name also appears
            basename = os.path.basename(m).replace(".yaml", "")
            if parts[0] in basename:
                candidates.append(m)

    # Deduplicate
    candidates = list(set(candidates))

    if not candidates:
        return None, None

    # Score candidates
    best_match = None
    best_score = -1

    for filepath in candidates:
        score = 0
        basename = os.path.basename(filepath).replace(".yaml", "")

        # Read file to check fields
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
        except Exception:
            continue

        # Check date match
        if date_of_death and date_of_death in content:
            score += 50

        # Check name match quality
        name_parts_in_file = sum(1 for p in parts if p in basename)
        score += name_parts_in_file * 10

        # Check province
        if province and province.lower() in content.lower():
            score += 10

        if score > best_score:
            best_score = score
            best_match = filepath

    return best_match, best_score


def read_yaml_field(content, field):
    """Read a field value from YAML content."""
    pattern = rf'^{field}:\s*(.+)$'
    match = re.search(pattern, content, re.MULTILINE)
    if match:
        val = match.group(1).strip().strip('"').strip("'")
        if val == "null" or val == "":
            return None
        return val
    return None


def enrich_yaml(filepath, child_entry, dry_run=False):
    """Enrich an existing YAML file with Amnesty data."""
    num, name, age, gender, ethnicity, city, province, date_of_death, cause, circumstances = child_entry

    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    original = content

    changes = []

    # Add/update ethnicity if we have it and file doesn't
    if ethnicity:
        current_eth = read_yaml_field(content, "ethnicity")
        if not current_eth:
            content = re.sub(
                r'^ethnicity:\s*null\s*$',
                f'ethnicity: {ethnicity}',
                content, count=1, flags=re.MULTILINE
            )
            if content != original:
                changes.append(f"ethnicity: {ethnicity}")

    # Add/update cause_of_death if more specific
    current_cause = read_yaml_field(content, "cause_of_death")
    if cause and (not current_cause or len(cause) > len(current_cause)):
        if current_cause:
            content = re.sub(
                r'^cause_of_death:.*$',
                f'cause_of_death: "{cause}"',
                content, count=1, flags=re.MULTILINE
            )
        else:
            content = re.sub(
                r'^cause_of_death:\s*null\s*$',
                f'cause_of_death: "{cause}"',
                content, count=1, flags=re.MULTILINE
            )
        if 'cause_of_death: "' + cause in content:
            changes.append(f"cause_of_death updated")

    # Add/update circumstances if we have detailed ones and existing is null/shorter
    current_circ = read_yaml_field(content, "circumstances")
    if circumstances and (not current_circ or len(circumstances) > len(str(current_circ)) + 50):
        # Wrap circumstances in YAML block scalar
        wrapped = "circumstances: >\n"
        words = circumstances.split()
        line = "  "
        for word in words:
            if len(line) + len(word) + 1 > 80:
                wrapped += line + "\n"
                line = "  " + word
            else:
                line += " " + word if line.strip() else "  " + word
        if line.strip():
            wrapped += line

        # Replace existing circumstances
        if current_circ:
            # Multi-line circumstances (block scalar)
            content = re.sub(
                r'^circumstances:.*?(?=\n\w|\n#|\Z)',
                wrapped,
                content, count=1, flags=re.MULTILINE | re.DOTALL
            )
        else:
            content = re.sub(
                r'^circumstances:\s*null\s*$',
                wrapped,
                content, count=1, flags=re.MULTILINE
            )
        changes.append("circumstances enriched (Amnesty)")

    # Add/update age if missing
    if age:
        current_age = read_yaml_field(content, "age_at_death")
        if not current_age:
            content = re.sub(
                r'^age_at_death:\s*null\s*$',
                f'age_at_death: {age}',
                content, count=1, flags=re.MULTILINE
            )
            changes.append(f"age_at_death: {age}")

    # Add Amnesty source if not already present
    if "MDE 13/6104/2022" not in content and "amnesty.org" not in content.lower():
        # Find the sources section and append
        amnesty_source = (
            '  - url: "https://www.amnesty.org/en/documents/mde13/6104/2022/en/"\n'
            '    name: "Amnesty International — Killings of children (MDE 13/6104/2022)"\n'
            '    date: 2022-12-09\n'
            '    type: ngo_report'
        )
        # Insert before last_updated
        content = re.sub(
            r'^(last_updated:)',
            amnesty_source + '\n\\1',
            content, count=1, flags=re.MULTILINE
        )
        changes.append("source: Amnesty MDE 13/6104/2022 added")

    if content == original:
        return 0, []

    if not dry_run:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)

    return len(changes), changes


def create_new_yaml(child_entry, dry_run=False):
    """Create a new YAML file for an unmapped child victim."""
    num, name, age, gender, ethnicity, city, province, date_of_death, cause, circumstances = child_entry

    # Build slug: lastname-firstname[-birthyear]
    parts = name.split()
    if len(parts) >= 2:
        slug = parts[-1].lower() + "-" + "-".join(p.lower() for p in parts[:-1])
    else:
        slug = parts[0].lower()

    # Clean slug
    slug = re.sub(r'[^\w-]', '', slug)
    slug = re.sub(r'-+', '-', slug).strip('-')

    # Add birth year estimate
    if age and date_of_death:
        birth_year = int(date_of_death[:4]) - age
        slug += f"-{birth_year}"

    year_dir = date_of_death[:4] if date_of_death else "2022"
    output_dir = os.path.join(VICTIMS_DIR, year_dir)
    filepath = os.path.join(output_dir, f"{slug}.yaml")

    if os.path.exists(filepath):
        return filepath  # Already exists

    if dry_run:
        return filepath

    lines = []
    lines.append(f"id: {slug}")
    lines.append(f'name_latin: "{name}"')
    lines.append("name_farsi: null")

    if age and date_of_death:
        birth_year = int(date_of_death[:4]) - age
        lines.append(f"date_of_birth: null  # est. birth year: {birth_year}")
    else:
        lines.append("date_of_birth: null")

    lines.append("place_of_birth: null")
    lines.append(f"gender: {gender}")
    lines.append(f"ethnicity: {ethnicity}" if ethnicity else "ethnicity: null")
    lines.append("photo: null")
    lines.append("")
    lines.append("# --- DEATH ---")
    lines.append(f"date_of_death: {date_of_death}" if date_of_death else "date_of_death: null")
    lines.append(f"age_at_death: {age}" if age else "age_at_death: null")
    lines.append(f'place_of_death: "{city}"' if city else "place_of_death: null")
    lines.append(f'province: "{province}"' if province else "province: null")
    lines.append(f'cause_of_death: "{cause}"' if cause else "cause_of_death: null")

    if circumstances:
        lines.append("circumstances: >")
        words = circumstances.split()
        line = "  "
        for word in words:
            if len(line) + len(word) + 1 > 80:
                lines.append(line)
                line = "  " + word
            else:
                line += " " + word if line.strip() else "  " + word
        if line.strip():
            lines.append(line)
    else:
        lines.append("circumstances: null")

    lines.append('event_context: "Woman, Life, Freedom movement (2022 Mahsa Amini protests)"')
    lines.append("responsible_forces: null")
    lines.append("")
    lines.append("# --- VERIFICATION ---")
    lines.append('status: "verified"')
    lines.append("sources:")
    lines.append('  - url: "https://www.amnesty.org/en/documents/mde13/6104/2022/en/"')
    lines.append('    name: "Amnesty International — Killings of children (MDE 13/6104/2022)"')
    lines.append("    date: 2022-12-09")
    lines.append("    type: ngo_report")
    lines.append(f"last_updated: 2026-02-09")
    lines.append('updated_by: "amnesty-children-import"')
    lines.append("")

    os.makedirs(output_dir, exist_ok=True)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))

    return filepath


def main():
    print(f"Amnesty Children Report Parser — MDE 13/6104/2022")
    print(f"{'='*60}")
    if DRY_RUN:
        print("*** DRY RUN MODE ***\n")

    matched = 0
    not_found = 0
    enriched = 0
    total_changes = 0
    new_files = 0

    not_found_list = []

    for child in CHILDREN:
        num, name, age, gender, ethnicity, city, province, date, cause, circ = child

        # Use manual mapping
        yaml_rel = MANUAL_MATCH.get(num)
        if yaml_rel:
            filepath = os.path.join(VICTIMS_DIR, yaml_rel)
            if os.path.exists(filepath):
                matched += 1
                n_changes, change_list = enrich_yaml(filepath, child, DRY_RUN)
                if n_changes > 0:
                    enriched += 1
                    total_changes += n_changes
                    print(f"  #{num:2d} {name:35s} → data/victims/{yaml_rel}")
                    for c in change_list:
                        print(f"       + {c}")
                else:
                    print(f"  #{num:2d} {name:35s} → data/victims/{yaml_rel} (already complete)")
            else:
                not_found += 1
                not_found_list.append(child)
                print(f"  #{num:2d} {name:35s} → MAPPED BUT FILE MISSING: {yaml_rel}")
        else:
            not_found += 1
            not_found_list.append(child)
            print(f"  #{num:2d} {name:35s} → NOT MAPPED")

    print(f"\n{'='*60}")
    print(f"SUMMARY")
    print(f"{'='*60}")
    print(f"Total children in report: {len(CHILDREN)}")
    print(f"Matched to existing YAML: {matched}")
    print(f"Enriched with new data:   {enriched}")
    print(f"Total field changes:      {total_changes}")
    print(f"Not mapped/found:         {not_found}")

    if not_found_list:
        print(f"\nCREATING NEW YAML FILES for unmapped children:")
        for child in not_found_list:
            num, name, age, gender, ethnicity, city, province, date, cause, circ = child
            filepath = create_new_yaml(child, DRY_RUN)
            if filepath:
                new_files += 1
                rel = os.path.relpath(filepath, PROJECT_ROOT)
                print(f"  #{num:2d} {name:35s} → {rel} (NEW)")
            else:
                print(f"  #{num:2d} {name:35s} → SKIPPED (dry run)" if DRY_RUN else f"  #{num:2d} {name:35s} → ERROR")

        print(f"\nNew files created: {new_files}")


if __name__ == "__main__":
    main()
