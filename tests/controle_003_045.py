# Extraits anonymisés de regles_typesContrat (4 bases, 24/09/2026), paramètres remis au format « Libellé : valeur » de l'export.
F3='_003_STD_GTA_Count_Hours_Per_Shift'; F45='_045_STD_GTA_Bank_holiday_hours_worked'; F1='_001_STD_GTA_Count_Hours'
EN3=['Day types','Day start time*','Day end time*','Mode*','Max value*','Thresholds*','Include classical shifts*','Duration (min - for actual days)','Exclude hours from','Exclude hours to','Mode idContact/idRole','Exclude prod type','Exclude task','Considered pasted shifts as one','Count shift greater than x hours']
FR3=['Types jour','Heure de début','Heure de fin','Mode','Valeur max','Seuils','Include heures normales','Durée jour standard (min.)','Exclure de','Exclure à','Mode idContact/idRole','Exclure TP','Exclure tâches']
def en3(*v): return list(zip(EN3,v))
def fr3(*v): return list(zip(FR3,v))
ROWS=[
 ('A',203,F1,'Règle contrôle',[('Day types','7,8,10,11,12,13,14,15,17,18,22,23,24,25,26,30,42,43,44,46,47,48,54,55,56,57,60,61,62,63,68,71,77'),('Day start time*','00:00'),('Day end time*','00:00'),('Mode*','2'),('Value max*','24'),('Thresholds','0>210:3.5;210>1440:reel;'),('Include classical shifts*','0'),('Duration (min - mandatory if mode actual days)','1440'),('Exclude hours from',''),('Exclude hours to',''),('Mode idContact/idRole',''),('Worked H / Published H','')]),
 ('A',55,F3,'Règle contrôle',fr3('25,26,46','00:00','00:00','0','24','0>240:240;240>359:reel;','0','1440','','','0','','')),
 ('A',63,F3,'Règle contrôle',fr3('','00:00','00:00','0','24','0>240:240;240>359:reel;359>480:480;','0','1440','08:00','00:00','','','')),
 ('A',65,F3,'Règle contrôle',fr3('','00:00','00:00','0','24','0>359:0;359>480:60;','0','1440','00:00','08:00','')[:11]),
 ('A',75,F3,'Règle contrôle',fr3('','00:00','00:00','0','2','0>359:0;359>480:120;','0','','','','')[:11]),
 ('A',98,F3,'Règle contrôle',en3('41','00:00','08:00','0','1','0>240:30;240>480:60;','1','1440','08:00','00:00','','','','','')),
 ('A',106,F3,'Règle contrôle',fr3('','00:00','00:00','0','8','0>240:240;240>480:480;','0','1440','07:00','00:00','')[:11]),
 ('A',107,F3,'Règle contrôle',fr3('','00:00','00:00','0','8','0>480:reel;','0','1140','07:00','00:00','','','')),
 ('A',256,F3,'Règle contrôle',fr3('','00:00','00:00','0','8','0>240:240;240>480:480;','0','1440','07:00','00:00','')[:11]),
 ('A',278,F3,'Règle contrôle',en3('','08:00','17:00','0','60','0>300:0;301>480:60;','0','1440','17:00','00:00','','','','','')),
 ('A',279,F3,'Règle contrôle',en3('','05:00','05:00','0','60','0>300:0;301>480:60;','0','1440','00:00','14:30','','','','','')),
 ('A',280,F3,'Règle contrôle',en3('','00:00','00:00','0','8','0>60:60;61>120:120;121>180:180;181>240:240;241>300:300;301>360:360;361>420:420;421>480:480;','0','1440','07:00','00:00','','','','','')),
 ('A',284,F3,'Règle contrôle',en3('','00:00','00:00','0','10','0>1440:60','0','1440','','','','','','','')),
 ('A',23,F45,'Règle contrôle',[('Day start time*','00:00'),('Day start time*','00:00'),('Include classical shifts*','0'),('Day types','25,26,42,43,44,45,46,76')]),
 ('A',239,F45,'Règle contrôle',[('Heure de debut','00:00'),('Heure de fin','00:00'),('Include heures normales','0'),('Types jour','25,26,42,43,44,45,46')]),
 ('A',254,F45,'Règle contrôle',[('Day start time*','00:00'),('Day start time*','00:00'),('Include classical shifts*','0'),('Day types','25,26,42,43,44,45,46,76')]),
 ('B',26,F3,'Règle contrôle',en3('','05:00','05:00','0','1','0>1440:60','0','','','','','','','','599')),
 ('B',29,F3,'Règle contrôle',en3('36','05:00','05:00','0','1','0>14440:60','0','','','','','','','','359')),
 ('B',31,F3,'Règle contrôle',en3('','05:00','05:00','0','1','0>14440:60','0','','03:01','02:00','','','','','')),
 ('B',33,F3,'Règle contrôle',en3('','05:00','05:00','0','','0>1440:60','0','','','','','','','','')),
 ('B',49,F3,'Règle contrôle',en3('36','05:00','05:00','0','10','0>14440:60','0','','','','','','','','0')),
 ('B',62,F3,'Règle contrôle',en3('','05:00','05:00','0','1','0>1440:60','0','','','','','','','','599')),
 ('B',219,F3,'Règle contrôle',en3('','00:00','00:00','0','','0>1440:60','0','','','','','','','','')),
 ('B',223,F3,'Règle contrôle',en3('','00:00','00:00','0','1','0>14440:60','0','','03:01','02:00','','','','','')),
 ('B',67,F45,'Règle contrôle',[('Day start time*','00:00'),('Day start time*','00:00'),('Include classical shifts*','0'),('Day types','')]),
 ('C',20,F45,'Règle contrôle',[('Heure de debut','00:00'),('Heure de fin','00:00'),('Include heures normales','0'),('Types jour','')]),
 ('D',408,F3,'Règle contrôle',en3('3,5,44','05:00','05:00','0','10','0>300:60','0','','','','','','','','180')),
 ('D',511,F3,'Règle contrôle',en3('','00:00','00:00','0','24','0>1440:reel','0','1440','','','','','','','')),
 ('D',512,F3,'Règle contrôle',en3('','00:00','00:00','0','24','0>1440:60','0','1440','','','','','','','')),
 ('D',580,F3,'Règle contrôle',en3('76','07:00','07:00','1','24','0>480:reel;480>1440:8','1','1440','','','','','','0','')),
 ('D',483,F45,'Règle contrôle',[('Day start time*','05:00'),('Day start time*','05:00'),('Include classical shifts*','0'),('Day types','')]),
 ('D',704,F45,'Règle contrôle',[('Day start time*','00:00'),('Day start time*','00:00'),('Include classical shifts*','0'),('Day types','1,5,8,9,11,12,13,14')]),
]


# Contrôles de sens, vérifiés contre le code #Dièse (moteur-diese.md § 9)
EXPECT = {
    ('A', 203): ["de 210 à 1440 minutes comptent pour leur durée réelle"],
    ('A', 63):  ["services classiques uniquement", "hors barème, compte pour sa durée réelle"],
    ('A', 65):  ["ne compte pas"],
    ('A', 107): ["compte pour sa durée réelle. Le résultat"],       # pas de doublon « hors barème »
    ('A', 98):  ["‹type de jour #41›. "],                            # HN = No : pas de mention
    ('B', 26):  ["réduit de 599 minutes"],
    ('D', 580): ["traités comme un seul", "tranches cumulées"],       # plageCollees = 0
    ('D', 483): ["de 05:00 au lendemain 05:00, sur les services classiques uniquement"],
    ('A', 23):  ["services classiques compris"],
}

if __name__ == '__main__':
    import os, sys
    here = os.path.dirname(os.path.abspath(__file__))
    sys.path.insert(0, os.path.join(here, '..', 'engine'))
    import humanizer as h
    fails = fallbacks = 0
    for lang in ('fr', 'en'):
        for base, rid, f, lbl, params in ROWS:
            row = {'Règle': f, 'Paramètres': '\n'.join('%s : %s' % kv for kv in params), '#': rid, 'Libellé': lbl}
            res = h.Resolver({rid: lbl}, {}, lang=lang)
            d, _ = h.describe(row, res, h.FormulaTranslator(res))
            if '‹' in d and ('non traduit' in d or 'not translated' in d):
                fallbacks += 1; print('REPLI', lang, base, rid, d)
            if lang == 'fr':
                for frag in EXPECT.get((base, rid), []):
                    if frag not in d:
                        fails += 1; print('ÉCHEC', base, rid, '— attendu :', frag, '\n   obtenu :', d)
    print('%d règles × 2 langues — replis : %d — échecs : %d' % (len(ROWS), fallbacks, fails))
    sys.exit(1 if fails or fallbacks else 0)
