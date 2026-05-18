-- Event descriptions in all languages (based on German short descriptions)

-- revolution-1979
UPDATE events SET
  description_en = $$The Iranian Revolution overthrew the Pahlavi dynasty. Ayatollah Khomeini established the Islamic Republic, which immediately began consolidating power through systematic$$,
  description_fr = $$La révolution iranienne a renversé la dynastie Pahlavi. L'ayatollah Khomeini a établi la République islamique, qui a immédiatement commencé à consolider son pouvoir de manière systématique$$,
  description_it = $$La rivoluzione iraniana rovesciò la dinastia Pahlavi. L'ayatollah Khomeini stabilì la Repubblica Islamica, che iniziò immediatamente a consolidare il potere in modo sistematico$$,
  description_es = $$La Revolución Iraní derrocó la dinastía Pahlaví. El ayatolá Jomeini estableció la República Islámica, que inmediatamente comenzó a consolidar el poder de forma sistemática$$,
  description_ar = $$أطاحت الثورة الإيرانية بأسرة بهلوي. أسس آية الله الخميني الجمهورية الإسلامية، التي بدأت فوراً في ترسيخ السلطة بشكل منهجي$$,
  description_fa = $$انقلاب ایران سلسله پهلوی را سرنگون کرد. آیت‌الله خمینی جمهوری اسلامی را بنا نهاد که فوراً شروع به تحکیم قدرت به‌صورت سیستماتیک کرد$$
WHERE slug = 'revolution-1979';

-- post-revolution-executions
UPDATE events SET
  description_en = $$Summary mass executions of former Shah officials, military officers and alleged enemies of the revolution. Trials lasted…$$,
  description_fr = $$Exécutions massives sommaires d'anciens fonctionnaires du Shah, d'officiers militaires et de prétendus ennemis de la révolution. Les procès duraient…$$,
  description_it = $$Esecuzioni di massa sommarie di ex funzionari dello Scià, ufficiali militari e presunti nemici della rivoluzione. I processi duravano…$$,
  description_es = $$Ejecuciones masivas sumarias de ex funcionarios del Sha, oficiales militares y presuntos enemigos de la revolución. Los juicios duraban…$$,
  description_ar = $$إعدامات جماعية فورية لمسؤولين سابقين في عهد الشاه وضباط عسكريين وأعداء مزعومين للثورة. استمرت المحاكمات…$$,
  description_fa = $$اعدام‌های دسته‌جمعی فوری مقامات سابق شاه، افسران نظامی و دشمنان ادعایی انقلاب. محاکمات…$$
WHERE slug = 'post-revolution-executions';

-- cultural-revolution-1980
UPDATE events SET
  description_en = $$On June 12, 1980, Ayatollah Khomeini ordered the closure of all Iranian universities, initiating what he called the Cultural Revolution.$$,
  description_fr = $$Le 12 juin 1980, l'ayatollah Khomeini a ordonné la fermeture de toutes les universités iraniennes, initiant ce qu'il appelait la révolution culturelle.$$,
  description_it = $$Il 12 giugno 1980, l'ayatollah Khomeini ordinò la chiusura di tutte le università iraniane, dando inizio a quella che chiamò la Rivoluzione Culturale.$$,
  description_es = $$El 12 de junio de 1980, el ayatolá Jomeini ordenó el cierre de todas las universidades iraníes, iniciando lo que llamó la Revolución Cultural.$$,
  description_ar = $$في 12 يونيو 1980، أمر آية الله الخميني بإغلاق جميع الجامعات الإيرانية، بادئاً ما أسماه الثورة الثقافية.$$,
  description_fa = $$در ۲۲ خرداد ۱۳۵۹، آیت‌الله خمینی دستور بستن همه دانشگاه‌های ایران را صادر کرد و آنچه را انقلاب فرهنگی می‌نامید، آغاز کرد.$$
WHERE slug = 'cultural-revolution-1980';

-- iran-iraq-war
UPDATE events SET
  description_en = $$Eight-year war with Iraq. The regime sent waves of poorly equipped soldiers, including child soldiers (Basij), to the front. Children as young as 12$$,
  description_fr = $$Guerre de huit ans avec l'Irak. Le régime a envoyé des vagues de soldats mal équipés, y compris des enfants soldats (Basij), au front. Des enfants dès 12$$,
  description_it = $$Guerra di otto anni con l'Iraq. Il regime inviò ondate di soldati mal equipaggiati, inclusi bambini soldato (Basij), al fronte. Bambini di appena 12$$,
  description_es = $$Guerra de ocho años con Irak. El régimen envió oleadas de soldados mal equipados, incluidos niños soldados (Basij), al frente. Niños de tan solo 12$$,
  description_ar = $$حرب استمرت ثماني سنوات مع العراق. أرسل النظام موجات من الجنود سيئي التجهيز، بما في ذلك الأطفال الجنود (الباسيج)، إلى الجبهة. أطفال في عمر 12$$,
  description_fa = $$جنگ هشت‌ساله با عراق. رژیم امواج سربازان کم‌تجهیزات، از جمله سربازان کودک (بسیجی)، را به جبهه فرستاد. کودکان ۱۲$$
WHERE slug = 'iran-iraq-war';

-- reign-of-terror-1981-1985
UPDATE events SET
  description_en = $$After power struggles with the MEK and other opposition groups, the regime launched a campaign of mass executions. Over 7,900…$$,
  description_fr = $$Après les luttes de pouvoir avec les Moudjahidines et d'autres groupes d'opposition, le régime a lancé une campagne d'exécutions massives. Plus de 7 900…$$,
  description_it = $$Dopo le lotte di potere con i MEK e altri gruppi di opposizione, il regime lanciò una campagna di esecuzioni di massa. Oltre 7.900…$$,
  description_es = $$Después de las luchas de poder con los MEK y otros grupos de oposición, el régimen lanzó una campaña de ejecuciones masivas. Más de 7.900…$$,
  description_ar = $$بعد صراعات السلطة مع مجاهدي خلق ومجموعات معارضة أخرى، أطلق النظام حملة إعدامات جماعية. أكثر من 7,900…$$,
  description_fa = $$پس از جنگ‌های قدرت با مجاهدین و گروه‌های مخالف دیگر، رژیم کمپین اعدام‌های دسته‌جمعی را آغاز کرد. بیش از ۷,۹۰۰…$$
WHERE slug = 'reign-of-terror-1981-1985';

-- chain-murders
UPDATE events SET
  description_en = $$Systematic murder of Iranian dissidents, intellectuals, writers, poets and political activists by agents of$$,
  description_fr = $$Assassinat systématique de dissidents iraniens, d'intellectuels, d'écrivains, de poètes et d'activistes politiques par des agents de$$,
  description_it = $$Omicidio sistematico di dissidenti iraniani, intellettuali, scrittori, poeti e attivisti politici da parte di agenti di$$,
  description_es = $$Asesinato sistemático de disidentes iraníes, intelectuales, escritores, poetas y activistas políticos por agentes de$$,
  description_ar = $$اغتيال منهجي للمعارضين الإيرانيين والمثقفين والكتاب والشعراء والنشطاء السياسيين على أيدي عملاء$$,
  description_fa = $$قتل‌های سیستماتیک مخالفان، روشنفکران، نویسندگان، شاعران و فعالان سیاسی ایرانی توسط ماموران$$
WHERE slug = 'chain-murders';

-- massacre-1988
UPDATE events SET
  description_en = $$On Khomeini's orders, "death commissions" were formed across Iran. Political prisoners were brought before three-person panels and asked…$$,
  description_fr = $$Sur ordre de Khomeini, des "commissions de la mort" ont été formées à travers l'Iran. Les prisonniers politiques étaient amenés devant des panels de trois personnes et on leur demandait…$$,
  description_it = $$Per ordine di Khomeini, furono formate "commissioni della morte" in tutto l'Iran. I prigionieri politici venivano portati davanti a pannelli di tre persone e gli veniva chiesto…$$,
  description_es = $$Por orden de Jomeini, se formaron "comisiones de la muerte" en todo Irán. Los prisioneros políticos eran llevados ante paneles de tres personas y se les preguntaba…$$,
  description_ar = $$بأوامر الخميني، تم تشكيل "لجان الموت" في جميع أنحاء إيران. تم إحضار السجناء السياسيين أمام لجان من ثلاثة أشخاص وسُئلوا…$$,
  description_fa = $$به دستور خمینی، «کمیسیون‌های مرگ» در سراسر ایران تشکیل شد. زندانیان سیاسی را پیش هیئت‌های سه‌نفره می‌آوردند و می‌پرسیدند…$$
WHERE slug = 'massacre-1988';

-- student-protests-1999
UPDATE events SET
  description_en = $$Peaceful student protests against newspaper closures were crushed with violent raids on Tehran University dormitories$$,
  description_fr = $$Les manifestations étudiantes pacifiques contre les fermetures de journaux ont été écrasées par des raids violents sur les dortoirs de l'Université de Téhéran$$,
  description_it = $$Le proteste studentesche pacifiche contro la chiusura dei giornali furono represse con raid violenti nei dormitori dell'Università di Teheran$$,
  description_es = $$Las protestas estudiantiles pacíficas contra el cierre de periódicos fueron aplastadas con redadas violentas en los dormitorios de la Universidad de Teherán$$,
  description_ar = $$تم سحق الاحتجاجات الطلابية السلمية ضد إغلاق الصحف بمداهمات عنيفة على مساكن جامعة طهران$$,
  description_fa = $$اعتراضات مسالمت‌آمیز دانشجویی علیه تعطیلی روزنامه‌ها با حمله خشونت‌بار به خوابگاه‌های دانشگاه تهران سرکوب شد$$
WHERE slug = 'student-protests-1999';

-- green-movement-2009
UPDATE events SET
  description_en = $$Millions protested against the disputed re-election of Mahmoud Ahmadinejad. Security forces killed dozens, including Neda…$$,
  description_fr = $$Des millions de personnes ont manifesté contre la réélection contestée de Mahmoud Ahmadinejad. Les forces de sécurité ont tué des dizaines de personnes, dont Neda…$$,
  description_it = $$Milioni hanno protestato contro la controversa rielezione di Mahmoud Ahmadinejad. Le forze di sicurezza hanno ucciso decine di persone, tra cui Neda…$$,
  description_es = $$Millones protestaron contra la controvertida reelección de Mahmud Ahmadineyad. Las fuerzas de seguridad mataron a decenas, incluida Neda…$$,
  description_ar = $$احتج الملايين ضد إعادة انتخاب أحمدي نجاد المتنازع عليها. قتلت قوات الأمن العشرات، بما في ذلك ندا…$$,
  description_fa = $$میلیون‌ها نفر علیه انتخاب مجدد جنجالی محمود احمدی‌نژاد اعتراض کردند. نیروهای امنیتی دهها نفر، از جمله ندا، را کشتند…$$
WHERE slug = 'green-movement-2009';

-- bloody-november-2019
UPDATE events SET
  description_en = $$Protests triggered by fuel price increases were crushed with live ammunition in less than five days. The internet was shut down nationwide for$$,
  description_fr = $$Les manifestations déclenchées par les augmentations des prix du carburant ont été écrasées par des munitions réelles en moins de cinq jours. Internet a été coupé dans tout le pays pendant$$,
  description_it = $$Le proteste innescate dall'aumento dei prezzi del carburante furono represse con munizioni vere in meno di cinque giorni. Internet fu bloccato in tutto il paese per$$,
  description_es = $$Las protestas desencadenadas por los aumentos de precios del combustible fueron aplastadas con munición real en menos de cinco días. Internet fue cortado en todo el país durante$$,
  description_ar = $$تم سحق الاحتجاجات التي أثارتها زيادات أسعار الوقود بالذخيرة الحية في أقل من خمسة أيام. تم قطع الإنترنت في جميع أنحاء البلاد لمدة$$,
  description_fa = $$اعتراضات ناشی از افزایش قیمت بنزین در کمتر از پنج روز با گلوله واقعی سرکوب شد. اینترنت در سراسر کشور به مدت$$
WHERE slug = 'bloody-november-2019';

-- woman-life-freedom-2022
UPDATE events SET
  description_en = $$The death of 22-year-old Mahsa (Zhina) Amini in morality police custody triggered the largest protests since 1979. The UN found crimes against…$$,
  description_fr = $$La mort de Mahsa (Zhina) Amini, 22 ans, en garde à vue de la police des mœurs a déclenché les plus grandes manifestations depuis 1979. L'ONU a constaté des crimes contre…$$,
  description_it = $$La morte di Mahsa (Zhina) Amini, 22 anni, in custodia della polizia morale ha scatenato le più grandi proteste dal 1979. L'ONU ha accertato crimini contro…$$,
  description_es = $$La muerte de Mahsa (Zhina) Amini, de 22 años, bajo custodia de la policía moral desencadenó las mayores protestas desde 1979. La ONU determinó crímenes de…$$,
  description_ar = $$أدت وفاة مهسا (جينا) أميني البالغة من العمر 22 عاماً أثناء احتجازها لدى شرطة الأخلاق إلى أكبر الاحتجاجات منذ عام 1979. وجدت الأمم المتحدة جرائم ضد…$$,
  description_fa = $$مرگ مهسا (ژینا) امینی ۲۲ ساله در بازداشت گشت ارشاد، بزرگترین اعتراضات از سال ۱۳۵۷ را برانگیخت. سازمان ملل جنایت علیه…$$
WHERE slug = 'woman-life-freedom-2022';

-- massacres-2026
UPDATE events SET
  description_en = $$Nationwide protests met with the deadliest crackdown since 1979. Security forces used live ammunition against protesters in 31 provinces…$$,
  description_fr = $$Les manifestations à l'échelle nationale ont été confrontées à la répression la plus meurtrière depuis 1979. Les forces de sécurité ont utilisé des munitions réelles contre les manifestants dans 31 provinces…$$,
  description_it = $$Le proteste a livello nazionale hanno incontrato la repressione più letale dal 1979. Le forze di sicurezza hanno usato munizioni vere contro i manifestanti in 31 province…$$,
  description_es = $$Las protestas a nivel nacional enfrentaron la represión más letal desde 1979. Las fuerzas de seguridad usaron munición real contra los manifestantes en 31 provincias…$$,
  description_ar = $$واجهت الاحتجاجات على الصعيد الوطني أعنف قمع منذ عام 1979. استخدمت قوات الأمن الذخيرة الحية ضد المتظاهرين في 31 محافظة…$$,
  description_fa = $$اعتراضات سراسری با کشتارگرترین سرکوب از سال ۱۳۵۷ مواجه شد. نیروهای امنیتی در ۳۱ استان علیه معترضان از گلوله واقعی استفاده کردند…$$
WHERE slug = 'massacres-2026';
