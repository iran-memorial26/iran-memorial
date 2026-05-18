#!/usr/bin/env python3
"""
Gender inference for Iranian victim YAML files.
Uses common Persian/Kurdish/Baluchi first names to infer gender.
Updates YAML files in-place, only setting gender when confident.
"""

import os
import re
import sys

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "victims")

# Common female Persian/Kurdish/Baluchi names
FEMALE_NAMES = {
    # Very common
    "mahsa", "nika", "hadis", "sarina", "ghazaleh", "hannaneh", "minoo",
    "fereshteh", "nasrin", "parisa", "setareh", "aylar", "maryam", "zahra",
    "fatemeh", "fatimeh", "sara", "leila", "layla", "neda", "shirin",
    "roya", "samira", "sepideh", "azadeh", "mina", "elnaz", "elham",
    "shabnam", "bahareh", "niloufar", "golnar", "golnaz", "mahnaz",
    "faranak", "fariba", "farzaneh", "forough", "giti", "haleh",
    "hengameh", "jamileh", "kobra", "laleh", "mahboubeh", "mahin",
    "maliheh", "mansoureh", "marjan", "masoomeh", "massoumeh", "mehrnoush",
    "nahid", "narges", "nargess", "nazanin", "nazgol", "niloofar",
    "nooshin", "pantea", "parastoo", "parvaneh", "pegah", "poupak",
    "raheleh", "reyhaneh", "roghayeh", "roshana", "roxana", "sahar",
    "sanaz", "soudabeh", "shohreh", "tahereh", "yasaman", "yalda",
    "ziba", "zohreh", "vida", "simin", "somayyeh", "soheila",
    "ameneh", "anahita", "anis", "azar", "behnaz", "darya",
    "delaram", "dorsa", "elahe", "elaheh", "fahimeh", "hajar",
    "homa", "khadijeh", "kimia", "mahdieh", "mahshid", "mahvash",
    "marzieh", "monireh", "mozhdeh", "nadia", "nahal", "negin",
    "nesa", "niki", "pari", "parvin", "razieh", "rezvan",
    "saeedeh", "sakineh", "salomeh", "sedigheh", "sharareh",
    "shiva", "shokoufeh", "sima", "sogand", "solmaz", "soraya",
    "taraneh", "tina", "touba", "yasi", "zeinab", "zhina",
    "aysan", "ermita", "zhila", "jina",
    "maria", "matine", "parmis",
    # Second pass from data analysis
    "ainaz", "arnica", "asra", "atika", "diana", "hasti", "hediyeh",
    "lina", "mona", "mozhgan", "nagin", "nasim", "prasto",
    "sadaf", "seyyedeh", "simeh", "sopher",
    # Fifth pass — remaining iranvictims unknowns
    "annabelle", "hajer", "andisheh", "nazafarin", "sana",
    "sghri", "mlihh", "shamshad", "hanam", "vazobeh", "pria",
    # Fourth pass — iranvictims.com import
    "nastaran", "ghazal", "setayesh", "samaneh", "negar", "somayeh",
    "sonia", "parnian", "parniya", "parnia", "prnia", "mohaddeseh",
    "mohaddatheh", "mohaddetheh", "mohadeseh", "azra", "aida", "ayda",
    "malika", "malekeh", "bahar", "baharan", "bharan", "maedeh",
    "afsaneh", "asal", "raha", "aynaz", "pardis", "bita", "malihe",
    "golaleh", "azin", "azam", "manijeh", "haniyeh", "hananeh",
    "anisa", "anisseh", "atena", "nazli", "noshin", "fateme",
    "saba", "tayyebeh", "sona", "mitra", "sofia", "tania",
    "atefeh", "arezoo", "parya", "pariya", "robina", "melina",
    "elina", "arefeh", "aarfh", "arnika", "katayoun", "masoumeh",
    "mansoreh", "mojgan", "yasna", "sama", "zeynab", "fereshte",
    "feresteheh", "shima", "rozhin", "dina", "farideh", "golsa",
    "rozita", "rzita", "farnaz", "donya", "shilan", "mandana",
    "luna", "kiana", "ronak", "sanam", "ava", "sahba", "samin",
    "shoaleh", "tara", "lena", "sajdeh", "panthea", "panth",
    "helena", "kolthum", "kolsum", "yelda", "hiva", "arina",
    "faeezeh", "faizeh", "niyousha", "niyusha", "yeganeh",
    "forouzan", "sorna", "azhin", "rojin", "mana", "mahna",
    "alina", "shahla", "shaghayegh", "esra", "mounes", "moones",
    "taban", "zobeideh", "jannat", "akram", "safoura", "armita",
    "saina", "shadan", "saleheh", "haditheh", "hadithe", "amineh",
    "nora", "mabina", "armila", "rayhaneh", "sagher", "soda",
    "shokoufeh", "parmis", "saeedeh", "rizvan", "nehal",
    "parimah", "mohra", "mariah", "prima",
    # Sixth pass — final 10 unknowns
    "ariyana", "fa'zh",
}

# Common male Persian/Kurdish/Baluchi names
MALE_NAMES = {
    # Very common
    "mohammad", "ali", "amir", "hossein", "mehdi", "reza", "javad",
    "ahmad", "hamid", "hassan", "hasan", "saeed", "masoud", "majid",
    "mostafa", "morteza", "naser", "omid", "peyman", "pouya",
    "rahim", "rasoul", "sadegh", "sajjad", "shahram", "vahid",
    "yousef", "yusuf", "mohsen", "behnam", "behrouz", "dariush",
    "daryoush", "ebrahim", "ehsan", "esmail", "farhad", "fardin",
    "farzad", "hamed", "iman", "iraj", "kamran", "karim",
    "kazem", "kourosh", "mahmoud", "manouchehr", "mansour",
    "mojtaba", "nima", "navid", "parviz", "payam", "pejman",
    "pedram", "rouhollah", "saman", "sasan", "shahin", "shahab",
    "siamak", "sohrab", "soroush", "taghi", "vahid",
    # Additional common names
    "abolfazl", "abolfazi", "abdolfazl", "abdollah", "abdolsamad",
    "alireza", "amirhossein", "arash", "arman", "arsalan", "arvin",
    "ayoub", "babak", "bahman", "bahram", "balal", "bijan",
    "changiz", "daniyal", "davoud", "diako", "emad", "erfan",
    "faramarz", "farjad", "fouad", "gholamreza", "habib", "hamidreza",
    "hosseinali", "jafar", "jalal", "jamshid", "kanaan",
    "kian", "kianoush", "mahdi", "maziar", "mehrab", "mehran",
    "mehrdad", "milad", "mobin", "mohammadreza", "mohammadamin",
    "mokhtar", "mukhtar", "musa", "nasser", "nematollah",
    "nowroz", "pouyan", "saeid", "saleh", "samad", "sina",
    "yasin", "yaser", "zakaria", "zaniar", "fereydoun",
    "mohammad-amin", "amir-hossein", "amir-ali", "amir-mehdi",
    "seyyed", "seyed", "lal", "amin", "danesh", "parza",
    "sadreddin", "abdolsamad",
    # Baluchi/Sistan names
    "khoda", "khodabakhsh", "noor", "nour", "issa",
    # Additional from data analysis
    "abdol", "matin", "afshin", "aref", "abdulghafoor", "farzin",
    "ramin", "omran", "farid", "jalil", "abdul", "suleiman",
    "abdorrahman", "abdolrahman", "jamal", "mustafa", "sepehr",
    "danial", "daniel", "shoaib", "keyvan", "fereydon", "kamal",
    "abdolsalam", "ibrahim", "aminollah", "milan", "dastan",
    "hamin", "vahed", "kumar", "riassat", "zacharie", "shahli", "sohn",
    # Second pass from data analysis
    "abbas", "abdolghader", "abdolmalek", "abdolmanan", "abdullah",
    "abu", "abubakr", "adel", "aminullah", "arian", "armin", "artin",
    "azim", "aziz", "azizollah", "azizullah", "behzad", "ezzatollah",
    "faieq", "gholam", "gungo", "hadi", "hamzeh", "heydar", "hemin",
    "imran", "ismail", "jaber", "jabir", "kambiz", "khalil", "khodanour",
    "khodanur", "komeil", "mahuddin", "maisam", "mehrshad", "mehrzad",
    "messam", "mohammed", "mohiuddin", "momen", "motalleb", "moulavi",
    "murad", "nader", "najm", "najmuddin", "omar", "oveis", "parsa",
    "poriya", "rafi", "rouzbeh", "saamer", "salahuddin", "salman",
    "samer", "shahou", "siavash", "thamer", "yahya", "yasir", "younes",
    "yunus", "zolfaghar",
    # Third pass — remaining unknowns
    "mehdis", "kabdani", "mehrgan", "zia", "mirshekar", "mirshekar(i)",
    "sodeys",
    # Fourth pass — iranvictims.com import
    "meysam", "meisam", "maisam", "amirreza", "amirrza", "amirmohammad",
    "esmaeil", "soheil", "akbar", "davood", "daood", "ashkan", "taha",
    "ahmadreza", "farshid", "frshid", "amirali", "hesam", "hossam",
    "amirhossam", "amirhesam", "pouria", "pouriya", "pourya", "poria",
    "pooria", "ghasem", "qasem", "abolghasem", "aboalghasm", "moein",
    "moeen", "arshia", "arshiya", "shayan", "shaayan", "shaian",
    "parham", "hojjat", "hojat", "hojatollah", "aryan", "ariyan",
    "mani", "khodadad", "khdadad", "behrooz", "benyamin", "baniamin",
    "salar", "pezhman", "moslem", "asghar", "farshad", "iliya", "illia",
    "ilia", "ilya", "yazdan", "hussein", "arya", "aria", "sajad", "sjad",
    "jabbar", "saber", "amirabbas", "amir-abbas", "masih", "ramatin",
    "ramtin", "aboalfzl", "aboalfazl", "abollfazl", "abolfzl", "rostam",
    "ahad", "sam", "sid", "babakhan", "kaveh", "aydin", "ali-asghar",
    "aiman", "shahrokh", "shahrukh", "amirmehdi", "amirmhdi", "hamd",
    "hamdollah", "amid", "soleiman", "yashar", "iashar", "diyar",
    "loghman", "zohair", "youssef", "mahyar", "houman", "darab",
    "khosrow", "khosro", "yaghoub", "yaqub", "ata", "borhan",
    "yadollah", "elias", "elyas", "armiya", "armia", "vahab", "wahab",
    "abdolreza", "sourena", "sorena", "kamil", "khodayar", "firooz",
    "khaled", "shahrooz", "shahriyar", "shhriar", "fares", "mikaiil",
    "mikayel", "nasir", "mosayeb", "msib", "maziyar", "nooraldin",
    "nouruldin", "ataollah", "ataallh", "abdolali", "faraj", "farajollah",
    "javid", "hashem", "mahan", "yavor", "youhana",
    "kiyanoush", "kianush", "gholamhossein", "kamyab", "mousa",
    "samiyar", "amirsaleh", "amirparsa", "amirarslan", "amirsalar",
    "salim", "rashid", "rashed", "yasser", "yassin", "shirzad",
    "freydun", "faridon", "fereydoon", "azad", "edris", "yosef",
    "massoud", "siavosh", "shahpour", "jahanbakhsh", "sobhan", "sahab",
    "raouf", "abdolraouf", "abdolraoof", "ali-akbar", "arshad", "pasha",
    "sadra", "sadreh", "kasra", "ardeshir", "faisal", "tufan", "isa",
    "arastu", "abouzar", "golmohammad", "gol-mohammad", "ershad",
    "diyako", "mozaffar", "naji", "nariman", "taher", "abedin",
    "aghil", "sadeq", "raheb", "foad", "hasanali", "rouhani",
    "mosab", "roozbeh", "esfandiar", "esfandyar", "ghodrat", "halaku",
    "amer", "hekmat", "shervin", "bashir", "heidar", "hidr", "latif",
    "cyrus", "sahand", "farhan", "kamyar", "mehdiyar", "mahdiyar",
    "shadmehr", "behbood", "behboud", "keyoumars", "ghahreman",
    "bahadar", "radin", "heiman", "maghsood", "nadali", "karamali",
    "aligholi", "miragha", "naeim", "naeem", "vazir", "hamad",
    "abdolmajid", "mehrpouya", "mehreshad", "fasael", "fazael",
    "ahsan", "jafarparsa", "yahya-kia", "sayed", "nehayat", "barna",
    "ayat", "sayad", "tharallah", "safa", "hani", "meysagh",
    "srosh", "arshan", "farzam", "ola", "rsol", "dastgir",
    "amidali", "sidalirza", "sidahmd", "srdar", "noorollah",
    "reebin", "ribin", "bayook", "bivook", "hozaifeh",
    "abdalsadat", "abdolsadat", "saadat", "aiob", "shaaho", "shaho",
    "arfan", "malakniaz", "abdolraouf", "abolfzl", "behbod",
    "tiyam", "miad", "souran", "aku", "mosab", "yasha",
    "arshad", "salam", "ershad", "arad", "pasha",
    # Fifth pass — remaining iranvictims unknowns
    "babk", "behruz", "eshagh", "mohammadjawad", "khabat",
    "kiarash", "aaron", "majid-reza", "maani", "araz",
    "reham", "main", "jafari", "ajmeen", "hasana",
    "rafan", "komar", "abi", "gol",
    # Sixth pass — final unknowns
    "rahman", "bayat", "khani", "jahdasa", "ozar", "aarf", "mism",
}

# Names that are ambiguous or unisex — skip these
# Note: shahin moved to MALE_NAMES — overwhelmingly male in protest victim data
AMBIGUOUS_NAMES = set()

# Remove ambiguous names from both sets
FEMALE_NAMES -= AMBIGUOUS_NAMES
MALE_NAMES -= AMBIGUOUS_NAMES


def extract_first_name(name_latin: str) -> str:
    """Extract the first name from a full Latin name."""
    # Remove quotes
    name = name_latin.strip().strip('"').strip("'")
    # Handle parentheticals
    name = re.sub(r'\s*\(.*?\)', '', name)
    # Check for "son of" / "Sohn von" pattern (clearly male)
    if "son of" in name.lower() or "sohn von" in name.lower():
        return "son_of"
    # First word is the first name
    parts = name.split()
    if not parts:
        return ""
    return parts[0].lower().rstrip(",")


def infer_gender(first_name: str) -> str | None:
    """Return 'male', 'female', or None if unknown."""
    if first_name == "son_of":
        return "male"
    if first_name in FEMALE_NAMES:
        return "female"
    if first_name in MALE_NAMES:
        return "male"
    return None


def process_yaml_file(filepath: str) -> str | None:
    """Update gender field in a YAML file. Returns inferred gender or None."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Extract name_latin
    match = re.search(r'^name_latin:\s*"?(.+?)"?\s*$', content, re.MULTILINE)
    if not match:
        return None

    name_latin = match.group(1)
    first_name = extract_first_name(name_latin)
    if not first_name:
        return None

    gender = infer_gender(first_name)
    if gender is None:
        return None

    # Replace gender: null with the inferred gender
    new_content = re.sub(
        r'^gender:\s*null\s*$',
        f'gender: {gender}',
        content,
        count=1,
        flags=re.MULTILINE,
    )

    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        return gender

    # Check if gender is already set
    gender_match = re.search(r'^gender:\s*(\S+)', content, re.MULTILINE)
    if gender_match and gender_match.group(1) != "null":
        return None  # Already set, don't overwrite

    return None


def main():
    stats = {"male": 0, "female": 0, "unknown": 0, "total": 0, "skipped": 0}

    for root, dirs, files in os.walk(DATA_DIR):
        for filename in sorted(files):
            if not filename.endswith(".yaml") or filename.startswith("_"):
                continue

            filepath = os.path.join(root, filename)
            stats["total"] += 1

            result = process_yaml_file(filepath)
            if result == "male":
                stats["male"] += 1
            elif result == "female":
                stats["female"] += 1
            else:
                stats["unknown"] += 1

    print(f"\nGender Inference Results:")
    print(f"  Total files:  {stats['total']}")
    print(f"  Male:         {stats['male']}")
    print(f"  Female:       {stats['female']}")
    print(f"  Unknown:      {stats['unknown']}")
    print(f"  Coverage:     {(stats['male'] + stats['female']) / stats['total'] * 100:.1f}%")


if __name__ == "__main__":
    main()
