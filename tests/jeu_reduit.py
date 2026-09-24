"""Jeu réduit (depuis v1.7) — 8 règles réelles de Châtelet (base lue le 22/09/2026),
remises au format de la colonne « Paramètres » de l'export #Dièse.
Couvre : barèmes `reel` (_001 #203, _003 #55 #63 #107) et libellés
dupliqués (_045 #23 #254), plus un _045 aux libellés français (#239)."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'engine'))
from humanizer import Resolver, FormulaTranslator, describe

RULES = [
 (203, '_001_STD_GTA_Count_Hours', 'Solde heures accord Châtelet ADM',
  "Day types : 7,8,10,11,12\nDay start time* : 00:00\nDay end time* : 00:00\nMode* : Thresholds\n"
  "Value max* : 24\nThresholds : 0>210:3.5;210>1440:reel;\nInclude classical shifts* : Yes\n"
  "Duration (min - mandatory if mode actual days) : 1440\nExclude hours from : \nExclude hours to : \n"
  "Mode idContact/idRole : \nWorked H / Published H : "),
 (55, '_003_STD_GTA_Count_Hours_Per_Shift', 'Old Heures bases calcul h supp - Int',
  "Types jour : 25,26,46\nHeure de début : 00:00\nHeure de fin : 00:00\nMode : Thresholds\nValeur max : 24\n"
  "Seuils : 0>240:240;240>359:reel;\nInclude heures normales : Yes\nDurée jour standard (min.) : 1440\n"
  "Exclure de : \nExclure à : \nMode idContact/idRole : idContact\nExclure TP : \nExclure tâches : "),
 (63, '_003_STD_GTA_Count_Hours_Per_Shift', 'Heures de nuit - Int',
  "Types jour : \nHeure de début : 00:00\nHeure de fin : 00:00\nMode : Thresholds\nValeur max : 24\n"
  "Seuils : 0>240:240;240>359:reel;359>480:480;\nInclude heures normales : Yes\n"
  "Durée jour standard (min.) : 1440\nExclure de : 08:00\nExclure à : 00:00\nMode idContact/idRole : \n"
  "Exclure TP : \nExclure tâches : "),
 (107, '_003_STD_GTA_Count_Hours_Per_Shift', 'zHeures nuit - CDI adm',
  "Types jour : \nHeure de début : 00:00\nHeure de fin : 00:00\nMode : Thresholds\nValeur max : 8\n"
  "Seuils : 0>480:reel;\nInclude heures normales : Yes\nDurée jour standard (min.) : 1140\n"
  "Exclure de : 07:00\nExclure à : 00:00\nMode idContact/idRole : \nExclure TP : \nExclure tâches : "),
 (23, '_045_STD_GTA_Bank_holiday_hours_worked', 'Heures jours fériés - intermittents',
  "Day start time* : 00:00\nDay start time* : 00:00\nInclude classical shifts* : Yes\nDay types : 25,26,42,43,44,45,46,76"),
 (239, '_045_STD_GTA_Bank_holiday_hours_worked', 'Heures jours fériés - Atelier',
  "Heure de debut : 00:00\nHeure de fin : 00:00\nInclude heures normales : Yes\nTypes jour : 25,26,42,43,44,45,46"),
 (254, '_045_STD_GTA_Bank_holiday_hours_worked', 'Heures jours fériés permanents',
  "Day start time* : 00:00\nDay start time* : 00:00\nInclude classical shifts* : Yes\nDay types : 25,26,42,43,44,45,46,76"),
 # variante synthétique : plage réellement renseignée, pour vérifier la lecture par position
 (9001, '_045_STD_GTA_Bank_holiday_hours_worked', 'Test plage 22h-06h (synthétique)',
  "Day start time* : 22:00\nDay start time* : 06:00\nInclude classical shifts* : No\nDay types : 25"),
 # variante synthétique : tranche illisible -> doit tomber en repli, jamais être ignorée
 (9002, '_001_STD_GTA_Count_Hours', 'Test barème illisible (synthétique)',
  "Day types : 7\nMode* : Thresholds\nThresholds : 0>210:3.5;210-1440:x;"),
 # variante synthétique : barème décomposé _003
 (9003, '_003_STD_GTA_Count_Hours_Per_Shift', 'Test tranches cumulées (synthétique)',
  "Types jour : 25\nMode : Broken down thresholds\nSeuils : 0>120:60;120>240:reel;240>600:120;\nValeur max : 0"),
]

def run(lang):
    labels = {rid: lib for rid, _, lib, _ in RULES}
    res = Resolver(labels, {}, lang=lang)
    tr = FormulaTranslator(res)
    out = []
    for rid, rt, lib, params in RULES:
        d, unres = describe({'#': rid, 'Règle': rt, 'Libellé': lib, 'Paramètres': params}, res, tr)
        out.append((rid, rt, d, unres))
    return out

if __name__ == '__main__':
    for lang in ('fr', 'en'):
        print('=' * 30, lang)
        for rid, rt, d, unres in run(lang):
            print(f'#{rid} {rt[:4]} {"REPLI " if unres else ""}| {d}')
