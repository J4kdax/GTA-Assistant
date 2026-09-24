"""Traduction d'une règle GTA #Dièse en une phrase française.

Principes (validés avec le client) :
 - on décrit ce que la règle CALCULE, jamais pourquoi elle existe ;
 - un renvoi vers une autre règle est cité « Libellé (#id) », jamais "rule563" ;
 - une référence non résolue faute de référentiel sort en ‹famille #id›.
"""
import re
from dossier_common import (parse_params, is_empty, id_list, clean_label, pick,
                            MissingParam, nth,
                           AmbiguousParam, UnreadableParam)


# ---------------------------------------------------------------------------
# Catalogue des formulations, par langue. Ajouter un type de règle = ajouter
# sa phrase dans TOUTES les langues : une entrée manquante lève une erreur
# explicite plutôt que de retomber silencieusement en français.
# ---------------------------------------------------------------------------

LANGS = ('fr', 'en')

M = {
    # --- ossature des formules
    'if': ("si {cond}, alors {then}", "if {cond}, then {then}"),
    'if_compact': ("si {cond} → {then}", "if {cond} → {then}"),
    'else': (", sinon {other}", ", otherwise {other}"),
    'bool': ("1 lorsque {cond}, 0 sinon", "1 when {cond}, 0 otherwise"),
    'bool_compact': ("({cond} → 1, sinon 0)", "({cond} → 1, otherwise 0)"),
    'and': (" et ", " and "), 'or': (" ou ", " or "),
    'ge': ("est supérieur ou égal à", "is greater than or equal to"),
    'le': ("est inférieur ou égal à", "is less than or equal to"),
    'ne': ("est différent de", "is different from"),
    'gt': ("est supérieur à", "is greater than"),
    'lt': ("est inférieur à", "is less than"),
    'eq_num': ("vaut", "equals"), 'eq_ref': ("correspond à", "is"),
    'in_array': ("{value} fait partie de {list}", "{value} is one of {list}"),
    'ceil': ("l'arrondi supérieur de {value}", "the value of {value} rounded up"),
    'floor': ("l'arrondi inférieur de {value}", "the value of {value} rounded down"),
    'abs': ("la valeur absolue de {value}", "the absolute value of {value}"),
    'max': ("la plus grande valeur parmi {args}", "the largest value among {args}"),
    'min': ("la plus petite valeur parmi {args}", "the smallest value among {args}"),
    'intdiv': ("la division entière de {a} par {b}", "{a} divided by {b}, rounded down"),
    'formula_calc': ("calcule {body}.", "calculates {body}."),
    'formula_copy': ("reprend la valeur de {body}.", "takes the value of {body}."),
    'formula_sbs': ("Pour chaque service, ", "For each shift, "),
    'formula_empty': ("Formule vide : la règle ne calcule rien.",
                      "Empty formula: this rule calculates nothing."),
    # --- variables
    'v_shift_hours': ("les heures des services normaux", "the hours of standard shifts"),
    'v_daytype_hours': ("les heures du type de jour {name}", "the hours of day type {name}"),
    'v_shift_minutes': ("les minutes des services normaux", "the minutes of standard shifts"),
    'v_daytype_minutes': ("les minutes du type de jour {name}", "the minutes of day type {name}"),
    'v_duration_n': ("la durée du service n°{n}", "the duration of shift no. {n}"),
    'v_break_n': ("la durée de la pause n°{n}", "the duration of break no. {n}"),
    'v_start_n': ("l'heure de début du service n°{n}", "the start time of shift no. {n}"),
    'v_end_n': ("l'heure de fin du service n°{n}", "the end time of shift no. {n}"),
    'v_shift_duration': ("la durée du service", "the shift duration"),
    'v_shift_minutes_cur': ("la durée du service en minutes", "the shift duration in minutes"),
    'v_published': ("la durée publiée du service", "the published shift duration"),
    'v_start': ("l'heure de début du service", "the shift start time"),
    'v_end': ("l'heure de fin du service", "the shift end time"),
    'v_break_before': ("le temps écoulé depuis le service précédent",
                       "the time since the previous shift"),
    'v_break_after': ("le temps jusqu'au service suivant", "the time until the next shift"),
    'v_taux_supp': ("le taux supplémentaire du service", "the shift's additional rate"),
    'v_taux_inst': ("le taux supplémentaire d'instrument du service",
                    "the shift's additional instrument rate"),
    'v_hourly': ("le taux horaire", "the hourly rate"),
    'v_manual': ("la valeur saisie manuellement", "the manually entered value"),
    'v_venue': ("le lieu du service", "the shift venue"),
    'v_venue_shift': ("le lieu de la vacation", "the assignment venue"),
    'v_role': ("le rôle prédéfini du service", "the shift's predefined role"),
    'v_status': ("le statut de l'activité", "the activity status"),
    'v_weekday': ("le jour de la semaine", "the day of the week"),
    'v_day': ("le jour du mois", "the day of the month"),
    'v_month': ("le mois", "the month"), 'v_year': ("l'année", "the year"),
    'v_month_days': ("le nombre de jours du mois", "the number of days in the month"),
    'v_day_before': ("la valeur de la veille pour cette règle",
                     "this rule's value from the previous day"),
    'v_day_before_contact': ("la valeur de la veille pour cette règle, tous contrats confondus",
                             "this rule's value from the previous day, across all contracts"),
    'v_rate': ("le taux horaire du contrat", "the contract's hourly rate"),
    'v_duration': ("la durée du contrat en jours", "the contract duration in days"),
    'v_contract_type': ("le type de contrat", "the contract type"),
    'v_department': ("le département", "the department"),
    'v_production_type': ("le type de production", "the production type"),
    'v_first_weekday': ("le jour de la semaine du début de contrat",
                        "the weekday the contract starts on"),
    'v_last_weekday': ("le jour de la semaine de fin de contrat",
                       "the weekday the contract ends on"),
    'v_job': ("la fonction occupée", "the job held"),
    'v_activity_type': ("le type d'activité du service", "the shift's activity type"),
    'v_activity_type_n': ("le type d'activité du service n°{n}", "the activity type of shift no. {n}"),
    'v_task': ("la tâche du service", "the shift task"),
    'v_task_n': ("la tâche du service n°{n}", "the task of shift no. {n}"),
    'v_prod': ("la production du service", "the shift production"),
    'v_prod_n': ("la production du service n°{n}", "the production of shift no. {n}"),
    'v_incomplete_rule': ("référence de règle incomplète dans la formule",
                          "incomplete rule reference in the formula"),
    'v_dates': ("calcul de dates non traduit", "date calculation not translated"),
    'v_too_deep': ("expression trop imbriquée", "expression nested too deeply"),
    'v_fragment': ("fragment non traduit : {text}", "untranslated fragment: {text}"),
    'v_missing_rule': ("règle #{id} absente de l'export", "rule #{id} missing from the export"),
    # --- handlers
    'count_actual_hours': ("Additionne les heures réellement effectuées",
                           "Adds up the hours actually worked"),
    'count_actual_days': ("Compte les journées réellement effectuées",
                          "Counts the days actually worked"),
    'count_days': ("Compte les journées", "Counts the days"),
    'count_hours': ("Compte les heures", "Counts the hours"),
    'on_daytypes': (" sur les journées de type {types}", " on days of type {types}"),
    'for_daytypes': (", pour les journées de type {types}", ", for days of type {types}"),
    'daytypes_included': (" Les journées de type {types} sont prises en compte.",
                          " Days of type {types} are included."),
    'scale': ("Barème : {rules}.", "Scale: {rules}."),
    'scale_item_real': ("de {a} à {b} minutes comptent pour leur durée réelle",
                        "{a} to {b} minutes count at their actual duration"),
    'scale_item_min': ("un service de {a} à {b} minutes compte pour {v}",
                       "a shift of {a} to {b} minutes counts as {v}"),
    'scale_item_min_real': ("un service de {a} à {b} minutes compte pour sa durée réelle",
                            "a shift of {a} to {b} minutes counts at its actual duration"),
    'scale_step': ("Barème par service (un seul palier s'applique) : {rules}.",
                   "Per-shift scale (a single band applies): {rules}."),
    'scale_split': ("Barème par tranches cumulées (chaque tranche atteinte s'ajoute) : {rules}.",
                    "Cumulative band scale (each band reached is added): {rules}."),
    'split_item': ("la tranche de {a} à {b} minutes apporte {v}",
                   "the {a}–{b} minute band adds {v}"),
    'split_item_real': ("la tranche de {a} à {b} minutes apporte la durée effectuée dans la tranche",
                        "the {a}–{b} minute band adds the time worked within it"),
    'per_shift_hours': ("Compte, service par service, les heures effectuées",
                        "Counts, shift by shift, the hours worked"),
    'with_classical': (", services classiques compris", ", standard shifts included"),
    'classical_only': (" sur les services classiques uniquement", " on standard shifts only"),
    'all_daytypes_no_classical': (" sur tous les types de jour (hors disponibilités), services classiques exclus",
                                  " on all day types (availabilities excepted), standard shifts excluded"),
    'scale_item_min_zero': ("un service de {a} à {b} minutes ne compte pas",
                            "a shift of {a} to {b} minutes does not count"),
    'scale_beyond_real': (" Un service de plus de {b} minutes, hors barème, compte pour sa durée réelle.",
                          " A shift longer than {b} minutes falls outside the scale and counts at its actual duration."),
    'bank_holiday_24h': (" sur 24 heures, de {a} au lendemain {a}", " over 24 hours, from {a} to {a} the next day"),
    'bank_holiday_overnight': (" entre {a} et {b} le lendemain", " between {a} and {b} the next day"),
    'excluded_hours': (" Les heures effectuées entre {a} et {b} ne sont pas comptées.",
                       " Hours worked between {a} and {b} are not counted."),
    'shift_reduced': (" Chaque service est d'abord réduit de {n} minutes.",
                      " Each shift is first reduced by {n} minutes."),
    'shifts_glued': (" Les services qui se suivent sans interruption sont traités comme un seul.",
                     " Back-to-back shifts are treated as a single shift."),
    'excluded_prodtypes': (" Les types de production {ids} sont exclus.",
                           " Production types {ids} are excluded."),
    'excluded_tasks': (" Les tâches {ids} sont exclues.", " Tasks {ids} are excluded."),
    'bank_holiday_hours': ("Les jours fériés, additionne les heures effectuées",
                           "On public holidays, adds up the hours worked"),
    'bank_holiday_window': (" entre {a} et {b}", " between {a} and {b}"),
    'fallback_ambiguous': ("non traduit — le libellé « {name} » désigne plusieurs paramètres",
                           "not translated — the label “{name}” refers to several parameters"),
    'fallback_unreadable': ("non traduit — valeur illisible pour « {name} »",
                            "not translated — unreadable value for “{name}”"),
    'scale_item': ("de {a} à {b} minutes comptent pour {v}",
                   "{a} to {b} minutes count as {v}"),
    'capped_day': ("Le résultat est plafonné à {value} par jour.",
                   "The result is capped at {value} per day."),
    'capped': ("Le résultat est plafonné à {value}.", "The result is capped at {value}."),
    'no_classical': ("Les services classiques ne sont pas pris en compte.",
                     "Standard shifts are not taken into account."),
    'day_window': (" La journée est comptée à partir de {time}.",
                   " The day is counted from {time}."),
    'by_role': (" Le calcul est fait par rôle et non par personne.",
                " The calculation is per role rather than per person."),
    'hours_between': ("Additionne les heures effectuées entre {a} et {b}",
                      "Adds up the hours worked between {a} and {b}"),
    'on_dates_flag': ("Vaut 1 les jours correspondant aux dates suivantes : {dates}.",
                      "Equals 1 on the following dates: {dates}."),
    'on_dates_hours': ("Compte les heures effectuées les jours correspondant aux dates "
                       "suivantes : {dates}.",
                       "Counts the hours worked on the following dates: {dates}."),
    'on_dates_none': ("Vaut 1 les jours correspondant aux dates fixées dans la règle "
                      "(aucune renseignée).",
                      "Equals 1 on the dates set in the rule (none specified)."),
    'weekly_over': ("Compte les heures effectuées au-delà de {from} h par semaine",
                    "Counts the hours worked beyond {from} h per week"),
    'weekly_upto': (", dans la limite de {to} h", ", up to {to} h"),
    'weekly_base': (", à partir de la base calculée par {rule}",
                    ", based on the value calculated by {rule}"),
    'days_worked': ("Compte le nombre de jours travaillés", "Counts the number of days worked"),
    'over_period': (" sur {period}", " over {period}"),
    'jobs_only': (", en ne retenant que ceux exercés sous {jobs}",
                  ", counting only those worked under {jobs}"),
    'count_shifts': ("Compte le nombre de plages de la journée{types}.",
                     "Counts the number of shifts in the day{types}."),
    'count_shifts_task': ("Compte le nombre de services affectés aux tâches {tasks}.",
                          "Counts the number of shifts assigned to tasks {tasks}."),
    'count_breaks': ("Compte les pauses", "Counts the breaks"),
    'between_min': (" comprises entre {a} et {b} minutes", " lasting between {a} and {b} minutes"),
    'more_min': (" de plus de {a} minutes", " longer than {a} minutes"),
    'less_min': (" de moins de {a} minutes", " shorter than {a} minutes"),
    'on_daytypes2': (", sur les journées de type {types}", ", on days of type {types}"),
    'limit_day': (", dans la limite de {value} par jour", ", up to {value} per day"),
    'night_hours': ("Compte les heures de nuit effectuées entre {a} et {b}",
                    "Counts the night hours worked between {a} and {b}"),
    'on_days': (", du {days}", ", from {days}"),
    'on_days_list': (" ({days})", " ({days})"),
    'flat_value': (". La valeur est forfaitaire", ". The value is a flat amount"),
    'flat_value_min': (" ({value} minutes)", " ({value} minutes)"),
    'non_rest': ("Mesure le repos quotidien manquant : compte ce qui manque pour atteindre "
                 "{standard} de repos",
                 "Measures missing daily rest: counts what is short of {standard} of rest"),
    'non_rest_from': (", à partir de {mini} de repos", ", starting from {mini} of rest"),
    'bank_holiday': ("Signale les jours fériés travaillés.", "Flags public holidays worked."),
    'between_dates': ("Vaut 1 pour chaque jour compris entre le {a} et le {b}.",
                      "Equals 1 for each day between {a} and {b}."),
    'special_days': ("Signale les journées marquées comme jour spécial ‹{type}›.",
                     "Flags days marked as special day ‹{type}›."),
    'constant_per': ("Vaut {value} une fois par {unit}.", "Equals {value} once per {unit}."),
    'constant_day': ("Applique la valeur {value} chaque jour", "Applies the value {value} every day"),
    'constant_day_from_to': (" du {days}", " from {days}"),
    'constant_special': (", ainsi que les jours spéciaux ‹{days}›",
                         ", as well as special days ‹{days}›"),
    'constant_extras': (" ({extras})", " ({extras})"),
    'weekends_included': ("week-ends compris", "weekends included"),
    'holidays_included': ("jours fériés compris", "public holidays included"),
    'end_contract': ("Vaut {value} le dernier jour du contrat, 0 tous les autres jours.",
                     "Equals {value} on the last day of the contract, 0 on every other day."),
    'full_week': ("Vaut 1 pour chaque semaine entièrement couverte par le contrat.",
                  "Equals 1 for each week fully covered by the contract."),
    'sum_week': ("Additionne sur la semaine (qui démarre le {start}) les valeurs quotidiennes "
                 "de {rules}.",
                 "Adds up the daily values of {rules} over the week (starting on {start})."),
    'sum_period': ("Cumule sur {period} la valeur de {rules}",
                   "Accumulates the value of {rules} over {period}"),
    'all_contracts': (", tous contrats du salarié confondus",
                      ", across all of the employee's contracts"),
    'displayed_on': (" La valeur s'affiche {when}.", " The value is displayed {when}."),
    'last_day_week': ("le dernier jour de la semaine", "on the last day of the week"),
    'last_day_month': ("le dernier jour du mois", "on the last day of the month"),
    'sum_total': ("Totalise sur toute la période du contrat la valeur de {rules}",
                  "Totals the value of {rules} over the whole contract period"),
    'value_between': (", en ne retenant que les valeurs comprises entre {a} et {b}",
                      ", counting only values between {a} and {b}"),
    'total_rule': ("Reprend le total de {rule} cumulé sur {period}.",
                   "Takes the total of {rule} accumulated over {period}."),
    'other_day': ("Reprend la valeur calculée {when} par {rule}.",
                  "Takes the value calculated {when} by {rule}."),
    'yesterday': ("la veille", "the previous day"),
    'tomorrow': ("le lendemain", "the next day"),
    'days_earlier': ("{n} jours plus tôt", "{n} days earlier"),
    'days_later': ("{n} jours plus tard", "{n} days later"),
    'another_day': ("un autre jour", "another day"),
    'total_sliding': ("Totalise la valeur de {rules}", "Totals the value of {rules}"),
    'previous_days': (" sur les {n} jours précédents", " over the previous {n} days"),
    'weeks': (", soit {n} semaines", ", i.e. {n} weeks"),
    'next_days': (" et les {n} jours suivants", " and the following {n} days"),
    'divided_month': ("Divise la valeur de {rules} par le nombre de jours du mois.",
                      "Divides the value of {rules} by the number of days in the month."),
    'combine': ("Combine les valeurs de {rules}", "Combines the values of {rules}"),
    'combine_none': ("plusieurs règles (aucune renseignée)", "several rules (none specified)"),
    'combine_mode': (" (mode « {mode} »)", " (mode “{mode}”)"),
    'combine_threshold': (", avec un seuil de {value}", ", with a threshold of {value}"),
    'combine_duration': (", sur une période de {value}", ", over a period of {value}"),
    'end_compensation': ("Calcule une indemnité de fin de contrat égale à {pct} du total de {rules}",
                         "Calculates an end-of-contract payment equal to {pct} of the total of {rules}"),
    'end_reasons': (", pour les motifs de fin de contrat {motifs}",
                    ", for end-of-contract reasons {motifs}"),
    'additional_hours': ("Calcule les heures complémentaires de fin de période : compare le total "
                         "effectué {total} au crédit annuel {credit}, et retient la part comprise "
                         "entre {a} et {b} du crédit.",
                         "Calculates additional hours at the end of the period: compares the total "
                         "worked {total} against the annual credit {credit}, and keeps the share "
                         "between {a} and {b} of that credit."),
    'prorata': ("Calcule la part du mois couverte par le contrat : vaut {value} pour un mois "
                "complet, une fraction proportionnelle sinon.",
                "Calculates the share of the month covered by the contract: {value} for a full "
                "month, a proportional fraction otherwise."),
    'prorata_coef': ("Calcule la part du mois couverte par le contrat en jours ouvrés : vaut "
                     "{value} pour un mois complet, sur une base de {coef} jours.",
                     "Calculates the share of the month covered by the contract in working days: "
                     "{value} for a full month, on a {coef}-day basis."),
    'prorata_30': ("Calcule la part du mois couverte par le contrat sur une base de 30 jours : "
                   "vaut {value} pour un mois complet.",
                   "Calculates the share of the month covered by the contract on a 30-day basis: "
                   "{value} for a full month."),
    'annual_leave': ("Calcule l'acquisition de congés payés : {days} jours par mois complet",
                     "Calculates paid-leave accrual: {days} days per full month"),
    'annual_leave_min': (", à condition d'au moins {mini} jour(s) de présence sur un mois incomplet",
                         ", provided at least {mini} day(s) are worked in a partial month"),
    'ticket_restaurant': ("Attribue un titre-restaurant lorsqu'une pause de plus de {duration} "
                          "minutes a lieu entre {a} et {b}{types}.",
                          "Grants a meal voucher when a break longer than {duration} minutes "
                          "falls between {a} and {b}{types}."),
    'panier': ("Attribue un panier lorsqu'aucune pause d'au moins {duration} minutes n'a lieu "
               "entre {a} et {b}{types}.",
               "Grants a meal allowance when no break of at least {duration} minutes falls "
               "between {a} and {b}{types}."),
    'cycle': ("sur un cycle de {days} jours", "over a {days}-day cycle"),
    'cycle_field': (" dont le début est donné par ‹table de conversion {field}›",
                    " starting from ‹conversion table {field}›"),
    'cycle_sum': ("Cumule {rules} {cycle}.", "Accumulates {rules} {cycle}."),
    'cycle_end': ("Reprend la valeur de fin de cycle de {rules} {cycle}.",
                  "Takes the end-of-cycle value of {rules} {cycle}."),
    'cycle_take': ("Reprend {rules} {cycle}.", "Takes {rules} {cycle}."),
    'nb_shifts_period': ("Compte le nombre de services des types {types} {cycle}.",
                         "Counts the number of shifts of types {types} {cycle}."),
    'ind_worked': ("Colonne de suivi : additionne les {mode} sur {period}{types}",
                   "Tracking column: adds up the {mode} over {period}{types}"),
    'ind_from': (", à partir de {rule}", ", based on {rule}"),
    'ind_modulation': ("Colonne de suivi : solde de modulation calculé à {period} à partir de "
                       "{rule}, en {mode}{types}.",
                       "Tracking column: annualisation balance calculated at {period} from "
                       "{rule}, in {mode}{types}."),
    'cob_shifts': ("Compte le nombre de services", "Counts the number of shifts"),
    'cob_hours': ("Additionne les heures des services", "Adds up the shift hours"),
    'cob_days': ("Compte le nombre de journées", "Counts the number of days"),
    'cob_default': ("Compte les services", "Counts the shifts"),
    'cob_activity': (" dont le type d'activité fait partie de {types}",
                     " whose activity type is one of {types}"),
    'cob_tasks': (" Limité aux tâches {tasks}.", " Limited to tasks {tasks}."),
    'cob_roles': (" Limité aux rôles {roles}.", " Limited to roles {roles}."),
    'xth_activity': ("Repère la {n}e activité de la journée lorsqu'elle est de type {types}",
                     "Identifies the {n}th activity of the day when it is of type {types}"),
    'xth_duration': (", pour une durée comprise entre {a} et {b} minutes",
                     ", lasting between {a} and {b} minutes"),
    'manual_bonus': ("Prime saisie manuellement par le planificateur. Aucun calcul automatique.",
                     "Bonus entered manually by the scheduler. No automatic calculation."),
    # --- repli
    'fallback_type': ("type de règle non traduit", "rule type not translated"),
    'fallback_param': ("non traduit — paramètre « {name} » introuvable",
                       "not translated — parameter “{name}” not found"),
    'fallback_body': ("{flag} {label}. Paramétrage : {params}.",
                      "{flag} {label}. Settings: {params}."),
    'fallback_empty': ("{flag} {label} (aucun paramètre).", "{flag} {label} (no parameters)."),
    'translation_error': ("traduction impossible : {error}", "translation failed: {error}"),
}


def t(lang, key, **kw):
    entry = M.get(key)
    if entry is None:
        raise KeyError("Formulation absente du catalogue : %s" % key)
    index = LANGS.index(lang if lang in LANGS else 'fr')
    text = entry[index]
    return text.format(**kw) if kw else text


UNKNOWN = "‹%s›"

FAMILY_NAMES = {
    'type de jour': ('type de jour', 'day type'),
    'taux': ('taux', 'rate'), 'fonction': ('fonction', 'job'),
    "type d'activité": ("type d'activité", 'activity type'),
    'champ contrat': ('champ contrat', 'contract field'),
    'champ système': ('champ système', 'system field'),
    'champ contact': ('champ contact', 'contact field'),
    'champ activité': ("champ d'activité", 'activity field'),
    'élément financier': ('élément financier', 'financial element'),
    'type de production': ('type de production', 'production type'),
    'type de contrat': ('type de contrat', 'contract type'),
    'type de jour': ('type de jour', 'day type'),
    'département': ('département', 'department'), 'tâche': ('tâche', 'task'),
    'rôle prédéfini': ('rôle prédéfini', 'predefined role'),
    'classification': ('classification', 'classification'),
    'groupe de lieux': ('groupe de lieux', 'venue group'),
}

FAMILY_PLURALS = {
    'type de jour': ('types de jour', 'day types'),
    'taux': ('taux', 'rates'), 'fonction': ('fonctions', 'jobs'),
    "type d'activité": ("types d'activité", 'activity types'),
    'champ contrat': ('champs contrat', 'contract fields'),
    'champ système': ('champs système', 'system fields'),
    'champ contact': ('champs contact', 'contact fields'),
    'champ activité': ("champs d'activité", 'activity fields'),
    'élément financier': ('éléments financiers', 'financial elements'),
    'type de production': ('types de production', 'production types'),
    'type de contrat': ('types de contrat', 'contract types'),
    'type de jour': ('types de jour', 'day types'),
    'département': ('départements', 'departments'), 'tâche': ('tâches', 'tasks'),
    'rôle prédéfini': ('rôles prédéfinis', 'predefined roles'),
    'classification': ('classifications', 'classifications'),
    'groupe de lieux': ('groupes de lieux', 'venue groups'),
}


def family_label(lang, family, plural=False):
    table = FAMILY_PLURALS if plural else FAMILY_NAMES
    pair = table.get(family)
    return pair[LANGS.index(lang)] if pair else family


class Resolver:
    """Résout les identifiants rencontrés dans le paramétrage."""

    def __init__(self, rule_labels, daytypes=None, referentials=None, short_labels=None,
                 lang='fr'):
        self.lang = lang if lang in LANGS else 'fr'
        self.compact = False                   # mode raccourci (formules longues)
        self.short = short_labels or {}        # {id: libellé court}
        self.rules = rule_labels               # {id: libellé}
        self.daytypes = daytypes or {}         # {id: nom court}
        self.ref = referentials or {}          # {'taux': {id: nom}, ...}

    QUOTES = {'fr': ('« ', ' »'), 'en': ('“', '”')}
    JOINER = {'fr': ' et ', 'en': ' and '}

    def t(self, key, **kw):
        return t(self.lang, key, **kw)

    def quote(self, text):
        left, right = self.QUOTES[self.lang]
        return '%s%s%s' % (left, text, right)

    def join(self, items):
        items = [i for i in items if i]
        if len(items) < 2:
            return items[0] if items else ''
        return ', '.join(items[:-1]) + self.JOINER[self.lang] + items[-1]

    def rule(self, rid):
        rid = int(rid)
        label = (self.short.get(rid) or self.rules.get(rid)) if self.compact else self.rules.get(rid)
        if label:
            return self.quote('%s (#%d)' % (clean_label(label, inline=True), rid))
        return UNKNOWN % self.t('v_missing_rule', id=rid)

    def rules_list(self, value):
        ids = id_list(value)
        return self.join([self.rule(i) for i in ids]) if ids else ''

    def daytype(self, did):
        did = int(did)
        name = self.daytypes.get(did)
        if name:
            return self.quote(name)
        return UNKNOWN % ('%s #%d' % (family_label(self.lang, 'type de jour'), did))

    def daytypes_list(self, value):
        """Noms résolus entre guillemets ; les ids non résolus sont regroupés
        dans un seul chevron (règle absolue n° 3 du skill)."""
        ids = id_list(value)
        named = [self.quote(self.daytypes[i]) for i in ids if i in self.daytypes]
        missing = [str(i) for i in ids if i not in self.daytypes]
        if len(missing) == 1:
            named.append(self.daytype(missing[0]))
        elif missing:
            named.append(UNKNOWN % ('%s #%s' % (family_label(self.lang, 'type de jour', plural=True),
                                                ', '.join(missing))))
        return ', '.join(named)

    def others_list(self, family, value):
        ids = id_list(value)
        if not ids:
            return ''
        table = self.ref.get(family) or {}
        known = [i for i in ids if i in table]
        unknown = [i for i in ids if i not in table]
        parts = [self.quote(table[i]) for i in known]
        if unknown:
            label = family_label(self.lang, family, plural=len(unknown) > 1)
            parts.append(UNKNOWN % ('%s #%s' % (label, ', '.join(str(i) for i in unknown))))
        return ', '.join(parts)


# ---------------------------------------------------------------------------
# Formules _039 / _163
# ---------------------------------------------------------------------------

WEEKDAYS = {1: 'lundi', 2: 'mardi', 3: 'mercredi', 4: 'jeudi',
            5: 'vendredi', 6: 'samedi', 7: 'dimanche'}
MONTHS = {1: 'janvier', 2: 'février', 3: 'mars', 4: 'avril', 5: 'mai', 6: 'juin',
          7: 'juillet', 8: 'août', 9: 'septembre', 10: 'octobre', 11: 'novembre',
          12: 'décembre'}

COMPARISONS = [('>=', 'ge'), ('<=', 'le'), ('=!', 'ne'), ('!=', 'ne'),
               ('>', 'gt'), ('<', 'lt'), ('=', '=')]


def _split_top(text, sep):
    """Découpe sur `sep` au niveau de parenthèses 0."""
    parts, depth, cur, i = [], 0, '', 0
    while i < len(text):
        c = text[i]
        if c == '(':
            depth += 1
        elif c == ')':
            depth -= 1
        if depth == 0 and text.startswith(sep, i):
            # un '|' isolé ne doit pas capturer un '||'
            if sep == '|' and (text.startswith('||', i) or (i and text[i - 1] == '|')):
                cur += c
                i += 1
                continue
            parts.append(cur)
            cur = ''
            i += len(sep)
            continue
        cur += c
        i += 1
    parts.append(cur)
    return parts


def _split_top_regex(text, pattern):
    """Découpe sur un motif (and / or) au niveau de parenthèses 0."""
    parts, depth, last = [], 0, 0
    i = 0
    rx = re.compile(pattern)
    while i < len(text):
        c = text[i]
        if c == '(':
            depth += 1
        elif c == ')':
            depth -= 1
        elif depth == 0:
            m = rx.match(text, i)
            if m and m.end() > m.start():
                parts.append(text[last:i])
                i = last = m.end()
                continue
        i += 1
    parts.append(text[last:])
    return [p for p in parts if p.strip()]


def _has_top_pipe(text):
    depth = 0
    for i, c in enumerate(text):
        if c == '(':
            depth += 1
        elif c == ')':
            depth -= 1
        elif c == '|' and depth == 0:
            return True
    return False


def _strip_outer_parens(s):
    s = s.strip()
    while s.startswith('(') and s.endswith(')'):
        depth = 0
        for i, c in enumerate(s):
            if c == '(':
                depth += 1
            elif c == ')':
                depth -= 1
                if depth == 0 and i < len(s) - 1:
                    return s
        s = s[1:-1].strip()
    return s


def _find_if(s):
    """Position du premier if( de niveau supérieur, et bornes de ses parenthèses."""
    m = re.search(r'\bif\s*\(', s)
    if not m:
        return None
    start = m.start()
    open_at = s.index('(', m.start())
    depth = 0
    for i in range(open_at, len(s)):
        if s[i] == '(':
            depth += 1
        elif s[i] == ')':
            depth -= 1
            if depth == 0:
                return start, open_at, i
    return None


COMPACT_PHRASES_BY_LANG = {'en': [
    ("this rule's value from the previous day", 'previous day value'),
    ('the hours of day type', 'hours'), ('the minutes of day type', 'minutes'),
    ('the job held', 'job'), ("the shift's activity type", 'activity type'),
]}

COMPACT_PHRASES = [
    ('la valeur de la veille pour cette règle', 'valeur de la veille'),
    ('la fonction occupée', 'fonction'),
    ('les heures du type de jour', 'heures'),
    ('les minutes du type de jour', 'minutes'),
    ('le jour de la semaine', 'jour de semaine'),
    ('le jour du mois', 'jour du mois'),
    ('la durée du service', 'durée du service'),
    ("le type d'activité du service", "type d'activité"),
]

COMPACT_SIGNS = {'ge': '≥', 'le': '≤', 'ne': '≠', 'gt': '>', 'lt': '<',
                 'eq_num': '=', 'eq_ref': '='}


class FormulaTranslator:
    def __init__(self, resolver, compact=False):
        self.r = resolver
        self.compact = compact
        self.r.compact = compact
        self.unresolved = []

    # -- variables ----------------------------------------------------------
    SIMPLE = {
        'htime': 'v_shift_duration', 'mtime': 'v_shift_minutes_cur',
        'htimepublished': 'v_published', 'starttime': 'v_start', 'endtime': 'v_end',
        'breaktimebefore': 'v_break_before', 'breaktimeafter': 'v_break_after',
        'tauxSupp': 'v_taux_supp', 'tauxInstSupp': 'v_taux_inst', 'hourlyRate': 'v_hourly',
        'manual': 'v_manual', 'idvenue': 'v_venue', 'idvenueshift': 'v_venue_shift',
        'idpredefinedrole': 'v_role', 'idactivitystatus': 'v_status',
        'weekDay': 'v_weekday', 'weekday': 'v_weekday', 'day': 'v_day', 'month': 'v_month',
        'year': 'v_year', 'monthNbDays': 'v_month_days', 'dayBeforeValue': 'v_day_before',
        'dayBeforeContactValue': 'v_day_before_contact', 'rate': 'v_rate',
        'duration': 'v_duration', 'contractTypeId': 'v_contract_type',
        'departmentId': 'v_department', 'idproductiontype': 'v_production_type',
        'contractFirstWeekDay': 'v_first_weekday', 'contractLastWeekDay': 'v_last_weekday',
        'idjob': 'v_job',
    }

    NUMBERED = [
        (r'worktime(\d+)', 'v_duration_n'), (r'breaktime(\d+)', 'v_break_n'),
        (r'starttime(\d+)', 'v_start_n'), (r'endtime(\d+)', 'v_end_n'),
    ]

    def variable(self, token):
        r = self.r
        m = re.fullmatch(r'rule(\d+)', token) or re.fullmatch(r'sbsrule(\d+)', token)
        if m:
            return r.rule(m.group(1))
        if token == 'rule':
            return UNKNOWN % r.t('v_incomplete_rule')
        m = re.fullmatch(r'htime(\d+)', token)
        if m:
            n = int(m.group(1))
            return (r.t('v_shift_hours') if n == 0
                    else r.t('v_daytype_hours', name=r.daytype(n)))
        m = re.fullmatch(r'mtime(\d+)', token)
        if m:
            n = int(m.group(1))
            return (r.t('v_shift_minutes') if n == 0
                    else r.t('v_daytype_minutes', name=r.daytype(n)))
        for pattern, key in self.NUMBERED:
            m = re.fullmatch(pattern, token)
            if m:
                return r.t(key, n=m.group(1))
        for pattern, family in ((r'rate(\d+)', 'taux'), (r'element(\d+)', 'élément financier'),
                                (r'fieldSystem(\d+)', 'champ système'),
                                (r'fieldContact(\d+)', 'champ contact')):
            m = re.fullmatch(pattern, token)
            if m:
                return self._unres(family, m.group(1))
        m = re.fullmatch(r'fieldactivity(\d+)(max)?', token)
        if m:
            return self._unres('champ activité', m.group(1))
        m = re.fullmatch(r'field(\d+)', token)
        if m:
            return self._unres('champ contrat', m.group(1))
        m = re.fullmatch(r'idactivitytype(\d*)', token)
        if m:
            return (r.t('v_activity_type_n', n=m.group(1)) if m.group(1)
                    else r.t('v_activity_type'))
        m = re.fullmatch(r'idtask(\d*)', token)
        if m:
            return r.t('v_task_n', n=m.group(1)) if m.group(1) else r.t('v_task')
        m = re.fullmatch(r'idprod(\d*)', token)
        if m:
            return r.t('v_prod_n', n=m.group(1)) if m.group(1) else r.t('v_prod')
        m = re.fullmatch(r'latest_([A-Z0-9_]+)', token)
        if m:
            return self._unres('table de conversion %s' % m.group(1))
        key = self.SIMPLE.get(token)
        return r.t(key) if key else None

    def _unres(self, family, oid=None):
        table = self.r.ref.get(family) or {}
        if oid is not None and int(oid) in table:
            return self.r.quote(table[int(oid)])
        self.unresolved.append('%s%s' % (family, ' #%s' % oid if oid else ''))
        label = family_label(self.r.lang, family)
        return UNKNOWN % ('%s%s' % (label, ' #%s' % oid if oid else ''))

    # -- expressions --------------------------------------------------------
    MAX_DEPTH = 30

    def expression(self, expr, depth=0):
        expr = _strip_outer_parens(expr)
        if not expr:
            return ''
        if depth > self.MAX_DEPTH:
            return UNKNOWN % self.r.t('v_too_deep')
        pos = _find_if(expr)
        if pos and pos[0] == 0 and pos[2] == len(expr) - 1:
            return self.conditional(expr[pos[1] + 1:pos[2]], depth + 1)
        for fn, key in (('ceil', 'ceil'), ('floor', 'floor'), ('abs', 'abs')):
            m = re.fullmatch(fn + r'\s*\((.*)\)', expr, re.S)
            if m:
                return self.r.t(key, value=self.expression(m.group(1), depth + 1))
        for pattern, key in ((r'(?:MAX|max)\s*\((.*)\)', 'max'),
                             (r'(?:MIN|min)\s*\((.*)\)', 'min')):
            m = re.fullmatch(pattern, expr, re.S)
            if m:
                return self.r.t(key, args=self._args(m.group(1), depth))
        m = re.fullmatch(r'intdiv\s*\((.*)\)', expr, re.S)
        if m:
            args = _split_top(m.group(1), ',')
            if len(args) == 2:
                return self.r.t('intdiv', a=self.expression(args[0], depth + 1),
                                b=self.expression(args[1], depth + 1))
        m = re.fullmatch(r'in_array\s*\((.*)\)', expr, re.S)
        if m:
            args = _split_top(m.group(1), ',')
            if len(args) >= 2:
                return self.r.t('in_array', value=self.expression(args[0], depth + 1),
                                list=args[1].strip().strip('[]'))
        if 'DateTime' in expr or '->' in expr:
            return UNKNOWN % self.r.t('v_dates')
        var = self.variable(expr.strip())
        if var:
            return var
        if re.fullmatch(r'-?\d+([.,]\d+)?', expr.strip()):
            return expr.strip().replace('.', ',')
        parts = self._split_arith(expr)
        if len(parts) > 1:
            return self._join_arith(parts, depth)
        if _has_top_pipe(expr):          # conditionnelle écrite sans le mot-clé if
            return self.conditional(expr, depth + 1)
        for sign, _ in COMPARISONS:      # (ruleX > 0) utilisé comme 1 ou 0
            if len(_split_top(expr, sign)) == 2:
                return self.r.t('bool_compact' if self.compact else 'bool',
                                cond=self.condition(expr, depth + 1))
        return UNKNOWN % self.r.t('v_fragment', text=expr.strip())

    def _args(self, text, depth=0):
        return ', '.join(self.expression(a, depth + 1) for a in _split_top(text, ',') if a.strip())

    OPERATOR_SIGNS = {'+': '+', '-': '−', '*': '×', '/': '÷'}

    def _split_arith(self, expr):
        """Découpe une expression en [operande, signe, operande, ...] au niveau 0."""
        parts, buf, depth = [], '', 0
        for i, c in enumerate(expr):
            if c == '(':
                depth += 1
            elif c == ')':
                depth -= 1
            is_op = depth == 0 and c in '+-*/' and buf.strip() and expr[i - 1] not in '+-*/(<>='
            if is_op:
                parts.append(buf)
                parts.append(c)
                buf = ''
            else:
                buf += c
        if buf.strip():
            parts.append(buf)
        return parts

    def _join_arith(self, parts, depth):
        out = ''
        for token in parts:
            if token in self.OPERATOR_SIGNS:
                out += ' %s ' % self.OPERATOR_SIGNS[token]
            else:
                rendered = self.expression(token, depth + 1)
                if rendered.startswith('si '):
                    rendered = '(%s)' % rendered
                out += rendered
        return out.strip()

    # -- conditions ---------------------------------------------------------
    def condition(self, cond, depth=0):
        cond = _strip_outer_parens(cond)
        for pattern, key in ((r'(?i)(?:\s+AND\s+|\bAND\b|&&)', 'and'),
                             (r'(?i)(?:\s+OR\s+|\bOR\b)', 'or')):
            word = self.r.t(key)
            parts = _split_top_regex(cond, pattern)
            if len(parts) > 1:
                return word.join(self.condition(p, depth + 1) for p in parts)
        for sign, key in COMPARISONS:
            parts = _split_top(cond, sign)
            if len(parts) == 2:
                left, right = parts
                rendered = self._literal(left, right, depth)
                if key == '=':
                    key = ('eq_num' if re.fullmatch(r'-?[\d ,]+', rendered.strip())
                           else 'eq_ref')
                word = COMPACT_SIGNS[key] if self.compact else self.r.t(key)
                return '%s %s %s' % (self.expression(left, depth + 1), word, rendered)
        return self.expression(cond, depth + 1)

    def _literal(self, left, right, depth=0):
        """Rend lisible une valeur comparée (jour de semaine, mois, fonction...)."""
        lt, rt = left.strip(), right.strip()
        if re.fullmatch(r'\d+', rt):
            n = int(rt)
            if lt in ('weekDay', 'weekday') and n in WEEKDAYS:
                return WEEKDAYS[n]
            if lt == 'month' and n in MONTHS:
                return MONTHS[n]
            if lt == 'idjob':
                return self._unres('fonction', n)
            if lt == 'contractTypeId':
                return self._unres('type de contrat', n)
            if lt == 'idproductiontype':
                return self._unres('type de production', n)
            if lt.startswith('idactivitytype'):
                return self._unres("type d'activité", n)
            if lt.startswith('idtask'):
                return self._unres('tâche', n)
        return self.expression(right, depth + 1)

    def conditional(self, body, depth=0):
        """Contenu d'un if( ... ) : condition | alors || sinon"""
        head = _split_top(body, '||')
        if len(head) >= 2:
            left = '||'.join(head[:-1]) if len(head) > 2 else head[0]
            otherwise = head[-1]
        else:
            left, otherwise = body, None
        parts = _split_top(left, '|')
        if len(parts) >= 2:
            cond = parts[0]
            then = '|'.join(parts[1:])
        else:
            cond, then = left, '1'
        cond_txt = self.condition(cond, depth)
        then_txt = self.expression(then, depth + 1)
        txt = self.r.t('if_compact' if self.compact else 'if', cond=cond_txt, then=then_txt)
        if otherwise is not None:
            else_txt = self.expression(otherwise, depth + 1)
            txt += self.r.t('else', other=else_txt if else_txt.strip() not in ('', '0') else '0')
        return txt

    def translate(self, formula):
        self.unresolved = []
        txt = self.expression(formula.strip())
        if self.compact:
            for long, short in COMPACT_PHRASES_BY_LANG.get(self.r.lang, COMPACT_PHRASES):
                txt = txt.replace(long, short)
        return re.sub(r'\s{2,}', ' ', txt).strip()


# ---------------------------------------------------------------------------
# Handlers par rule_type
# ---------------------------------------------------------------------------

DAY_TYPES = ('Day types', 'Day type(s)', 'Types jour', 'Types jour inclu', 'Types de jour')
DAY_WINDOW = ('Day start time', 'Day start/end time', 'Day strat/end time',
              'Heure de début/fin', 'Heure de debut', 'Format jour')
RULES = ('Rule(s)', 'Rules(s)', 'Règle(s)', 'Règles')
SOURCE = ('Source rule', 'Source rule(s)', 'Source Rule', 'Id Source Rule', 'Règle source')
VALUE = ('Value', 'Valeur', 'Constant', 'Constante', 'Nb h/j')
MODE = ('Mode',)
VALUE_MAX = ('Value max', 'Max value', 'Seuil max')
THRESHOLDS = ('Thresholds', 'Seuils')
DAYS = ('Days', 'Day(s)', 'Jours de la semaine')
CLASSICAL = ('Include classical shifts', 'Include heures normales', 'Inclure heures normales')
PERIOD = ('Period', 'Période', 'Calculer à', 'Perimeter')

MODE_KEYS = {
    'actual hours': 'count_actual_hours', 'réel en heures': 'count_actual_hours',
    'actual days': 'count_actual_days', 'réel en jours': 'count_actual_days',
    'thresholds': 'count_days', 'seuils': 'count_days',
}

MODE_NOUN = {
    'actual hours': ("heures réellement effectuées", "hours actually worked"),
    'réel en heures': ("heures réellement effectuées", "hours actually worked"),
    'actual days': ("journées réellement effectuées", "days actually worked"),
    'réel en jours': ("journées réellement effectuées", "days actually worked"),
}

PERIOD_LABEL = {
    'month': ('le mois', 'the month'), 'mois': ('le mois', 'the month'),
    'week': ('la semaine', 'the week'), 'semaine': ('la semaine', 'the week'),
    'period': ('la période', 'the period'), 'période': ('la période', 'the period'),
    'contract': ('le contrat', 'the contract'), 'contrat': ('le contrat', 'the contract'),
    'current month': ('le mois en cours', 'the current month'),
    'current week': ('la semaine en cours', 'the current week'),
    'a la semaine': ('la semaine', 'the week'), 'à la semaine': ('la semaine', 'the week'),
    'au mois': ('le mois', 'the month'),
    'a la période': ('la période', 'the period'), 'à la période': ('la période', 'the period'),
    'a la periode': ('la période', 'the period'),
}


def _period_label(res, value):
    key = str(value).strip().lower()
    pair = PERIOD_LABEL.get(key)
    return pair[LANGS.index(res.lang)] if pair else key


def _mode_noun(res, value):
    pair = MODE_NOUN.get(str(value).strip().lower())
    return pair[LANGS.index(res.lang)] if pair else ('heures' if res.lang == 'fr' else 'hours')


def _window(p, res):
    start = pick(p, *DAY_WINDOW)
    if start and str(start) not in ('05:00', '06:00', '00:00'):
        return res.t('day_window', time=start)
    return ''


def _scope(p, res):
    if str(pick(p, 'Mode idContact/idRole')).strip() == 'idRole':
        return res.t('by_role')
    return ''


def _daytypes(p, res, key='on_daytypes'):
    dts = pick(p, *DAY_TYPES)
    return res.t(key, types=res.daytypes_list(dts)) if dts else ''


def _classical_scope(p, res, empty_means_all=False):
    """Types de jour + services classiques, tels que le moteur les combine.

    `Include classical shifts` : id 0 = Yes. Sans type de jour, « Yes » ne
    retient que les services classiques (_003 force un id fictif, _045 filtre
    sur l'id 0). Sans type de jour et « No », _003 retient tous les types de
    jour hors disponibilités (empty_means_all) ; _045 ne filtre rien.
    """
    classical = str(pick(p, *CLASSICAL)).strip().lower() in ('yes', 'oui', '0')
    if pick(p, *DAY_TYPES):
        return _daytypes(p, res) + (res.t('with_classical') if classical else '')
    if classical:
        return res.t('classical_only')
    return res.t('all_daytypes_no_classical') if empty_means_all else ''


def _hhmm(minutes):
    try:
        value = int(minutes)
    except (TypeError, ValueError):
        return str(minutes)
    text = '%g h' % (value / 60)
    return text.replace('.', ',') if _FORMAT_LANG[0] == 'fr' else text


# Langue courante des helpers de formatage, positionnée par describe() avant
# chaque appel de handler : évite de passer le Resolver à chaque petite fonction.
_FORMAT_LANG = ['fr']


def _num(value):
    text = str(value).strip()
    return text.replace('.', ',') if _FORMAT_LANG[0] == 'fr' else text.replace(',', '.')


def _pct(value):
    try:
        return '%g %%' % (float(str(value).replace(',', '.')) * 100)
    except ValueError:
        return str(value)


# --- barèmes -----------------------------------------------------------------

_SCALE_CHUNK = re.compile(r'^\s*(\d+)\s*>\s*(\d+)\s*:\s*([\d.,]+|reel|réel|real)\s*$', re.I)


def parse_scale(value, name='Thresholds'):
    """'0>210:3.5;210>1440:reel;' -> [(0, 210, '3.5'), (210, 1440, None)]

    None = « durée réelle » (mot-clé `reel` du moteur #Dièse). Toute tranche
    non vide qu'on ne sait pas lire lève UnreadableParam : une tranche ignorée
    produit une description d'apparence complète mais fausse (cas de la règle
    #203 de Châtelet avant la v1.5).
    """
    out = []
    for chunk in str(value).split(';'):
        if not chunk.strip():
            continue
        m = _SCALE_CHUNK.match(chunk)
        if not m:
            raise UnreadableParam(name)
        v = m.group(3)
        out.append((m.group(1), m.group(2),
                    None if v.lower() in ('reel', 'réel', 'real') else v.replace(',', '.')))
    return out


def _minutes_as_hours(value):
    try:
        mins = float(value)
    except ValueError:
        return _num(value)
    h = mins / 60
    return (_num(('%g' % h)) + ' h') if h >= 1 else (_num('%g' % mins) + ' min')


# --- comptage ---------------------------------------------------------------

def h_count_hours(r, p, res):
    mode = str(pick(p, *MODE)).strip().lower()
    txt = [res.t(MODE_KEYS.get(mode, 'count_hours')) + _daytypes(p, res) + '.']
    th = pick(p, *THRESHOLDS)
    if th:
        items = [res.t('scale_item_real', a=a, b=b) if v is None
                 else res.t('scale_item', a=a, b=b, v=_num(v))
                 for a, b, v in parse_scale(th)]
        if items:
            txt.append(res.t('scale', rules=' ; '.join(items)))
    vmax = pick(p, *VALUE_MAX)
    if vmax:
        unit = ' h' if 'hour' in mode or 'heure' in mode else ''
        txt.append(res.t('capped_day', value=_num(vmax) + unit))
    if str(pick(p, *CLASSICAL)).strip().lower() in ('no', 'non'):
        txt.append(res.t('no_classical'))
    return ' '.join(txt) + _window(p, res) + _scope(p, res)


def h_count_hours_per_shift(r, p, res):
    """_003 : heures comptées service par service, barème en minutes."""
    txt = res.t('per_shift_hours') + _classical_scope(p, res, empty_means_all=True) + '.'
    a, b = (pick(p, 'Exclude hours from', 'Exclure de'),
            pick(p, 'Exclude hours to', 'Exclure à'))
    if a and b:
        txt += res.t('excluded_hours', a=a, b=b)
    reduce_ = pick(p, 'Count shift greater than x hours')
    if reduce_ and str(reduce_).strip() not in ('0', ''):
        txt += res.t('shift_reduced', n=reduce_)
    # id 0 = Yes ; vide = No (le moteur force 1). L'export restitue l'id brut.
    if str(pick(p, 'Considered pasted shifts as one')).strip().lower() in ('yes', 'oui', '0'):
        txt += res.t('shifts_glued')
    th = pick(p, 'Thresholds', 'Seuils')
    if th:
        mode = str(pick(p, *MODE)).strip().lower()
        split = 'broken' in mode or 'décompos' in mode or mode == '1'
        items = []
        for lo, hi, v in parse_scale(th):
            if split:
                items.append(res.t('split_item_real', a=lo, b=hi) if v is None
                             else res.t('split_item', a=lo, b=hi, v=_minutes_as_hours(v)))
            elif v is None:
                items.append(res.t('scale_item_min_real', a=lo, b=hi))
            elif float(v) == 0:
                items.append(res.t('scale_item_min_zero', a=lo, b=hi))
            else:
                items.append(res.t('scale_item_min', a=lo, b=hi, v=_minutes_as_hours(v)))
        if items:
            txt += ' ' + res.t('scale_split' if split else 'scale_step', rules=' ; '.join(items))
            bands = parse_scale(th)
            top = max(int(hi) for _, hi, _ in bands)
            last_real = max(bands, key=lambda b: int(b[1]))[2] is None
            if not split and top < 1440 and not last_real:
                # moteur : une durée hors de toutes les tranches garde sa valeur réelle
                txt += res.t('scale_beyond_real', b=top)
    for key, aliases in (('excluded_prodtypes', ('Exclude prod type', 'Exclure TP')),
                         ('excluded_tasks', ('Exclude task', 'Exclure tâches'))):
        ids = pick(p, *aliases)
        if ids and str(ids).strip() != '0':
            txt += res.t(key, ids=ids)
    vmax = pick(p, *VALUE_MAX, 'Valeur max')
    if vmax and str(vmax).strip() not in ('0', ''):
        txt += ' ' + res.t('capped_day', value=_num(vmax) + ' h')
    return txt + _window(p, res) + _scope(p, res)


def h_bank_holiday_hours(r, p, res):
    """_045 : heures travaillées les jours fériés, dans une plage horaire.

    Les deux bornes de la plage sont déclarées sous le même libellé
    « Day start time* » dans le fichier #Dièse : lecture par position.
    """
    start = nth(p, 0, 'Day start time', 'Heure de debut', 'Heure de début')
    end = (pick(p, 'Heure de fin', 'Day end time')
           or nth(p, 1, 'Day start time'))
    txt = res.t('bank_holiday_hours')
    if start and end and not (start == end == '00:00'):
        # moteur : début >= fin → la plage court jusqu'au lendemain
        if start == end:
            txt += res.t('bank_holiday_24h', a=start)
        elif start > end:
            txt += res.t('bank_holiday_overnight', a=start, b=end)
        else:
            txt += res.t('bank_holiday_window', a=start, b=end)
        scope = _classical_scope(p, res)
        return txt + (',' + scope if scope else '') + '.'
    return txt + _classical_scope(p, res) + '.'


def h_count_hours_range(r, p, res):
    return (res.t('hours_between', a=pick(p, 'Range start time', required=True),
                  b=pick(p, 'Range end time', required=True))
            + _daytypes(p, res) + '.') + _window(p, res) + _scope(p, res)


def h_count_hours_on_dates(r, p, res):
    dates = pick(p, 'Dates (dd/mm,...)', 'Dates')
    if not dates:
        return res.t('on_dates_none')
    key = 'on_dates_flag' if str(pick(p, *MODE)).strip() == '1/0' else 'on_dates_hours'
    return res.t(key, dates=dates)


def h_count_weekly(r, p, res):
    txt = res.t('weekly_over', **{'from': _num(pick(p, 'Count from x weekly hours',
                                                    'A partir de (H/s)', required=True))})
    to = pick(p, 'Count to x weekly hours', "Jusqu'à (H/s)")
    if to:
        txt += res.t('weekly_upto', to=_num(to))
    src = pick(p, *SOURCE)
    if src:
        txt += res.t('weekly_base', rule=res.rule(src))
    return txt + '.' + _daytypes(p, res, 'daytypes_included') + _scope(p, res)


def h_count_days_worked(r, p, res):
    txt = res.t('days_worked')
    per = pick(p, *PERIOD)
    if per:
        txt += res.t('over_period', period=_period_label(res, per))
    txt += _daytypes(p, res, 'for_daytypes')
    jobs = pick(p, 'Job title', 'Fonction')
    if jobs:
        txt += res.t('jobs_only', jobs=res.others_list('fonction', jobs))
    return txt + '.'


def h_count_shifts(r, p, res):
    return res.t('count_shifts', types=_daytypes(p, res, 'for_daytypes')) + _window(p, res)


def h_count_shifts_task(r, p, res):
    tasks = pick(p, 'Tasks', 'Tâches', required=True)
    return (res.t('count_shifts_task', tasks=res.others_list('tâche', tasks))
            + _window(p, res))


def h_count_breaks(r, p, res):
    more = pick(p, 'Break duration > (min)', 'Durée pause sup. à (min.)')
    less = pick(p, 'Break duration <(min.)', 'Durée pause inf. à (min.)')
    txt = res.t('count_breaks')
    if more and less:
        txt += res.t('between_min', a=_num(more), b=_num(less))
    elif more:
        txt += res.t('more_min', a=_num(more))
    elif less:
        txt += res.t('less_min', a=_num(less))
    txt += _daytypes(p, res, 'on_daytypes2')
    vmax = pick(p, *VALUE_MAX)
    if vmax:
        txt += res.t('limit_day', value=_num(vmax))
    return txt + '.' + _window(p, res)


def h_night_hours(r, p, res):
    txt = res.t('night_hours', a=pick(p, 'Time range start time', 'Heure de début plage',
                                      required=True),
                b=pick(p, 'Time range end time', 'Heure de fin plage', required=True))
    days = _days_label(res, pick(p, *DAYS))
    if days and ' au ' not in days and ' to ' not in days:
        txt += res.t('on_days_list', days=days)
    elif days and not _all_week(pick(p, *DAYS)):
        txt += res.t('on_days', days=days)
    if str(pick(p, 'Constant ?')).strip().lower() in ('yes', 'oui'):
        txt += res.t('flat_value')
        value = pick(p, 'Value if constant (min)')
        if value:
            txt += res.t('flat_value_min', value=value)
    return txt + '.'


def h_non_rest(r, p, res):
    standard = pick(p, 'Count to x hours of rest (min.)', 'Nb heures repos standard (min.)',
                    'Nb of hours of rest (min.)', required=True)
    txt = res.t('non_rest', standard=_hhmm(standard))
    mini = pick(p, 'Count from x hours of rest (min.)', 'Nb heures repos mini (min.)')
    if mini:
        txt += res.t('non_rest_from', mini=_hhmm(mini))
    return txt + '.' + _window(p, res)


def h_bank_holiday(r, p, res):
    return res.t('bank_holiday') + _window(p, res)


def h_count_between_dates(r, p, res):
    return res.t('between_dates', a=pick(p, 'From dd-mm-YYYY', 'From', required=True),
                 b=pick(p, 'To dd-mm-YYYY', 'To', required=True))


def h_special_days(r, p, res):
    return res.t('special_days', type=pick(p, 'Spacial day type', 'Special day type',
                                           'Type jour spécial', required=True))


# --- constantes -------------------------------------------------------------

def h_constant_month(r, p, res):
    per = str(pick(p, 'Constant per', 'Constante par', required=True)).strip().lower()
    unit = ('mois' if res.lang == 'fr' else 'month') if per in ('month', 'mois') else per
    return res.t('constant_per', value=_num(pick(p, *VALUE, required=True)), unit=unit)


def h_constant_day(r, p, res):
    txt = res.t('constant_day', value=_num(pick(p, *VALUE, required=True)))
    days = _days_label(res, pick(p, *DAYS))
    if days and not _all_week(pick(p, *DAYS)):
        txt += (res.t('constant_day_from_to', days=days) if (' au ' in days or ' to ' in days)
                else res.t('on_days_list', days=days))
    sp = pick(p, 'Special days', 'Jours spéciaux')
    if sp:
        txt += res.t('constant_special', days=sp)
    return txt + '.'


def h_constant_day_2(r, p, res):
    txt = res.t('constant_day', value=_num(pick(p, *VALUE, required=True)))
    extras = []
    if str(pick(p, 'Compter week-end')).strip().lower() in ('oui', 'yes'):
        extras.append(res.t('weekends_included'))
    if str(pick(p, 'Compter jours fériés')).strip().lower() in ('oui', 'yes'):
        extras.append(res.t('holidays_included'))
    if extras:
        txt += res.t('constant_extras', extras=', '.join(extras))
    return txt + '.'


def h_constant_end_contract(r, p, res):
    return res.t('end_contract', value=_num(pick(p, *VALUE, default='1')))


def h_full_week(r, p, res):
    return res.t('full_week')


_DAYS_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
_DAY_NAMES = {
    'fr': ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'],
    'en': ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
}
# les exports nomment les jours dans la langue du client, coquilles comprises
_DAYS_ALIASES = {'lundi': 'monday', 'mardi': 'tuesday', 'mercredi': 'wednesday',
                 'jeudi': 'thursday', 'vendredi': 'friday', 'samedi': 'saturday',
                 'dimanche': 'sunday', 'thursady': 'thursday'}


def _day_indexes(value):
    if is_empty(value):
        return []
    found = []
    for token in str(value).split(','):
        t_ = token.strip().lower()
        t_ = _DAYS_ALIASES.get(t_, t_)
        if t_ in _DAYS_ORDER and t_ not in found:
            found.append(t_)
    return sorted(_DAYS_ORDER.index(d) for d in found)


def _all_week(value):
    return len(_day_indexes(value)) == 7


def _days_label(res, value):
    idx = _day_indexes(value)
    if not idx:
        return ''
    names = _DAY_NAMES[res.lang]
    if len(idx) > 2 and idx == list(range(idx[0], idx[-1] + 1)):
        joiner = ' au ' if res.lang == 'fr' else ' to '
        return names[idx[0]] + joiner + names[idx[-1]]
    return ', '.join(names[i] for i in idx)


# --- sommes et reprises -----------------------------------------------------

def h_sum_week_days(r, p, res):
    start = str(pick(p, 'Week starts on', 'Semaine commence le',
                     default='lundi' if res.lang == 'fr' else 'Monday')).lower()
    return res.t('sum_week', start=start,
                 rules=res.rules_list(pick(p, *RULES, required=True)))


def h_sum_rule_period(r, p, res):
    txt = res.t('sum_period',
                period=_period_label(res, pick(p, 'Sum per', 'Somme par', 'Cumuler par',
                                               *PERIOD, required=True)),
                rules=res.rules_list(pick(p, *RULES, required=True)))
    if r['Règle'].endswith('per_contact'):
        txt += res.t('all_contracts')
    txt += '.'
    disp = pick(p, 'Display value on...', 'Display value of the last week of the month',
                'Semaine fin de mois', "Afficher la valeur sur")
    if disp:
        key = {'the last day of the week': 'last_day_week', 'fin de semaine': 'last_day_week',
               'the last day of the month': 'last_day_month',
               'fin de mois': 'last_day_month'}.get(str(disp).strip().lower())
        txt += res.t('displayed_on', when=res.t(key) if key else str(disp))
    return txt


def h_sum_total(r, p, res):
    txt = res.t('sum_total', rules=res.rules_list(pick(p, *RULES, required=True)))
    frm, to = pick(p, 'From', 'De'), pick(p, 'To', 'A')
    if frm and to:
        txt += res.t('value_between', a=frm, b=to)
    return txt + '.'


def h_total_rule(r, p, res):
    return res.t('total_rule', rule=res.rule(pick(p, *SOURCE, required=True)),
                 period=_period_label(res, pick(p, 'Perimeter', *PERIOD, required=True))) \
        + _scope(p, res)


def h_source_other_day(r, p, res):
    nb = pick(p, 'Nb days before/after', 'Nb jours')
    try:
        n = int(nb)
    except (TypeError, ValueError):
        n = None
    if n == -1:
        when = res.t('yesterday')
    elif n == 1:
        when = res.t('tomorrow')
    elif n and n < 0:
        when = res.t('days_earlier', n=abs(n))
    elif n:
        when = res.t('days_later', n=n)
    else:
        when = res.t('another_day')
    return res.t('other_day', when=when, rule=res.rule(pick(p, *SOURCE, required=True)))


def h_source_total_period(r, p, res):
    txt = res.t('total_sliding', rules=res.rules_list(pick(p, *SOURCE, required=True)))
    try:
        b = int(pick(p, 'Day(s) before', 'Jours avant'))
        txt += res.t('previous_days', n=b)
        if b % 7 == 0:
            txt += res.t('weeks', n=b // 7)
    except (TypeError, ValueError):
        pass
    after = pick(p, 'Day(s) after', 'Jours après')
    if after and str(after) != '0':
        txt += res.t('next_days', n=after)
    return txt + '.'


def h_divided_by_month_days(r, p, res):
    return res.t('divided_month',
                 rules=res.rules_list(pick(p, *RULES, *SOURCE, required=True)))


def h_combine(r, p, res):
    rules = res.rules_list(pick(p, *RULES)) or res.t('combine_none')
    txt = res.t('combine', rules=rules)
    mode = pick(p, *MODE)
    if mode:
        txt += res.t('combine_mode', mode=mode)
    seuil = pick(p, 'Seuil', 'Threshold')
    if seuil:
        txt += res.t('combine_threshold', value=_num(seuil))
    duration = pick(p, 'Durée periode', 'Durée période', 'Period duration')
    if duration:
        txt += res.t('combine_duration', value=duration)
    return txt + '.'


# --- fin de contrat, prorata, congés ---------------------------------------

def h_end_contract_compensation(r, p, res):
    txt = res.t('end_compensation', pct=_pct(pick(p, 'Coef', 'Coefficient', required=True)),
                rules=res.rules_list(pick(p, 'Règle(s) à additionner', 'Rule(s) to add',
                                          *RULES, required=True)))
    motif = pick(p, 'Motif (id Classif contrat valeur combobox)', 'Motif')
    if motif:
        txt += res.t('end_reasons', motifs=res.others_list('classification', motif))
    return txt + '.'


def h_additional_hours_end(r, p, res):
    return res.t('additional_hours',
                 total=res.rule(pick(p, 'Rule total worked hours', 'Règle total effectué',
                                     required=True)),
                 credit=res.rule(pick(p, 'Rule annual credit', 'Règle crédit annuel',
                                      required=True)),
                 a=_pct(pick(p, 'Coef from', 'De (coef %)', required=True)),
                 b=_pct(pick(p, 'Coef to', 'A (coef %)', required=True)))


def h_month_prorata(r, p, res):
    return res.t('prorata', value=_num(pick(p, 'Value for a month', 'Valeur mois complet',
                                            *VALUE, required=True)))


def h_month_prorata_coef(r, p, res):
    return res.t('prorata_coef', coef=_num(pick(p, 'Coef', required=True)),
                 value=_num(pick(p, 'Value for a month', 'Valeur mois complet', *VALUE,
                                 default='1')))


def h_month_prorata_30(r, p, res):
    return res.t('prorata_30', value=_num(pick(p, 'Value for a month', 'Valeur mois complet',
                                               *VALUE, required=True)))


def h_annual_leave(r, p, res):
    txt = res.t('annual_leave', days=_num(pick(p, 'Nb jours acquis mois plein',
                                               'Nb days acquired full month', required=True)))
    mini = pick(p, 'Nb jours présence mini mois incomplet', 'Nb days minimum presence')
    if mini:
        txt += res.t('annual_leave_min', mini=_num(mini))
    return txt + '.'


# --- paniers et titres-restaurant ------------------------------------------

def h_ticket_restaurant(r, p, res):
    return res.t('ticket_restaurant',
                 duration=_num(pick(p, 'Break duration more than (min)',
                                    'Durée pause sup. à (min.)', required=True)),
                 a=pick(p, 'Break between', 'Pause entre', required=True),
                 b=pick(p, 'And', 'Et', required=True), types=_daytypes(p, res))


def h_panier(r, p, res):
    return res.t('panier',
                 duration=_num(pick(p, 'Break duration less than (min)',
                                    'Durée pause inf. à (min.)', required=True)),
                 a=pick(p, 'Break between', 'Pause entre', required=True),
                 b=pick(p, 'And', 'Et', required=True), types=_daytypes(p, res))


# --- cycles et colonnes de suivi -------------------------------------------

def _cycle(p, res):
    txt = res.t('cycle', days=_num(pick(p, 'Nb days of the period', 'Nb jours période',
                                        required=True)))
    field = pick(p, 'Transcodification table field', 'Champ table de transcodification')
    if field:
        txt += res.t('cycle_field', field=field)
    return txt


def h_cycledate(r, p, res):
    mode = str(pick(p, *MODE)).strip().lower()
    key = {'sum values on period': 'cycle_sum',
           'end of period value': 'cycle_end'}.get(mode, 'cycle_take')
    return res.t(key, rules=res.rules_list(pick(p, *SOURCE, *RULES, required=True)),
                 cycle=_cycle(p, res))


def h_nb_shifts_period(r, p, res):
    acts = pick(p, 'Activity type(s)', "Types d'activité", required=True)
    return res.t('nb_shifts_period', types=res.others_list("type d'activité", acts),
                 cycle=_cycle(p, res))


def h_ind_worked_hours(r, p, res):
    txt = res.t('ind_worked', mode=_mode_noun(res, pick(p, *MODE)),
                period=_period_label(res, pick(p, *PERIOD, required=True)),
                types=_daytypes(p, res))
    src = pick(p, *SOURCE)
    if src:
        txt += res.t('ind_from', rule=res.rule(src))
    return txt + '.'


def h_ind_modulation(r, p, res):
    return res.t('ind_modulation',
                 period=_period_label(res, pick(p, *PERIOD, required=True)),
                 rule=res.rule(pick(p, *SOURCE, required=True)),
                 mode=_mode_noun(res, pick(p, *MODE)), types=_daytypes(p, res))


def h_cob_count(r, p, res):
    mode = str(pick(p, *MODE)).strip().lower()
    txt = res.t({'nb shifts': 'cob_shifts', 'nb hours': 'cob_hours',
                 'nb days': 'cob_days'}.get(mode, 'cob_default'))
    acts = pick(p, 'Activity type(s)', "Types d'activité")
    if acts:
        txt += res.t('cob_activity', types=res.others_list("type d'activité", acts))
    txt += '.'
    tasks = pick(p, 'Task(s) included', 'Tâches incluses')
    if tasks:
        txt += res.t('cob_tasks', tasks=res.others_list('tâche', tasks))
    roles = pick(p, 'Predefined role(s)', 'Rôles prédéfinis')
    if roles:
        txt += res.t('cob_roles', roles=res.others_list('rôle prédéfini', roles))
    vmax = pick(p, *VALUE_MAX)
    if vmax:
        txt += ' ' + res.t('capped', value=_num(vmax))
    return txt


def h_xth_activity(r, p, res):
    txt = res.t('xth_activity', n=pick(p, 'Nb activity(ies)', "Nb d'activités", required=True),
                types=res.others_list("type d'activité",
                                      pick(p, 'Activity type(s)', "Types d'activité",
                                           required=True)))
    frm, to = pick(p, 'From (min.)'), pick(p, 'To(min.)', 'To (min.)')
    if frm and to:
        txt += res.t('xth_duration', a=frm, b=to)
    return txt + '.'


def h_manual_bonus(r, p, res):
    return res.t('manual_bonus')


HANDLERS = {
    '_001_STD_GTA_Count_Hours': h_count_hours,
    '_003_STD_GTA_Count_Hours_Per_Shift': h_count_hours_per_shift,
    '_045_STD_GTA_Bank_holiday_hours_worked': h_bank_holiday_hours,
    '_010_STD_GTA_Count_Weekly_Hours': h_count_weekly,
    '_015_STD_GTA_Count_Hours_On_Time_Range': h_count_hours_range,
    '_016_STD_GTA_Count_Shifts': h_count_shifts,
    '_017_STD_GTA_Count_Shifts_Per_Task': h_count_shifts_task,
    '_018_STD_GTA_Count_Breaks': h_count_breaks,
    '_019_STD_GTA_Count_Days_Worked': h_count_days_worked,
    '_020_STD_GTA_Count_1_between_two_dates': h_count_between_dates,
    '_021_STD_GTA_Constant_per_month': h_constant_month,
    '_025_STD_GTA_Constant_per_day': h_constant_day,
    '_026_STD_GTA_Constant_per_day_2': h_constant_day_2,
    '_027_STD_GTA_Combine_rules': h_combine,
    '_028_STD_GTA_Constant_end_contract': h_constant_end_contract,
    '_029_STD_GTA_End_contract_compensation': h_end_contract_compensation,
    '_030_STD_GTA_Sum_values_by_day_over_the_week': h_sum_week_days,
    '_031_STD_GTA_Sum_rule_per_month_week': h_sum_rule_period,
    '_032_STD_GTA_Sum_rule_per_month_week_per_contact': h_sum_rule_period,
    '_033_STD_GTA_Sum_rule_total_per_contract_or_period': h_sum_total,
    '_037_STD_GTA_Additionnal_hours_end_contract_period': h_additional_hours_end,
    '_040_STD_GTA_Special_days': h_special_days,
    '_042_STD_GTA_Bank_holiday_worked': h_bank_holiday,
    '_056_STD_GTA_Count_hours_day_on_dates': h_count_hours_on_dates,
    '_057_STD_GTA_Manual_Bonus': h_manual_bonus,
    '_060_STD_GTA_Daily_non_rest_hours': h_non_rest,
    '_062_STD_GTA_Daily_non_rest_hours_2': h_non_rest,
    '_069_STD_GTA_Night_hours': h_night_hours,
    '_075_STD_GTA_Month_prorata': h_month_prorata,
    '_076_STD_GTA_Month_prorata_working_days_with_coef': h_month_prorata_coef,
    '_081_STD_GTA_Panier_bonus_without_break': h_panier,
    '_088_STD_GTA_Ticket_restaurant_with_break': h_ticket_restaurant,
    '_098_STD_GTA_Full_week': h_full_week,
    '_099_STD_GTA_Source_rule_divided_by_nb_month_days': h_divided_by_month_days,
    '_104_STD_GTA_Annual_leave_acquisition': h_annual_leave,
    '_116_STD_COB_Count_Hours': h_cob_count,
    '_122_STD_COB_Xth_daily_activity_type': h_xth_activity,
    '_123_STD_COB_Nb_shifts_per_period': h_nb_shifts_period,
    '_124_STD_IND_Total_Rule': h_total_rule,
    '_125_STD_IND_Worked_hours': h_ind_worked_hours,
    '_126_STD_IND_Suivi_modulation': h_ind_modulation,
    '_140_STD_GTA_Month_prorata_30th': h_month_prorata_30,
    '_142_STD_GTA_Source_rule_value_other_day': h_source_other_day,
    '_160_STD_GTA_cycledate': h_cycledate,
    '_162_STD_IND_totalCycle': h_cycledate,
    '_165_STD_GTA_Source_rule_total_period': h_source_total_period,
}

RULE_TYPE_FR = {
    '_001_STD_GTA_Count_Hours': "Comptage d'heures",
    '_039_STD_GTA_Formula': 'Formule',
    '_163_STD_GTA_SBSFormula': 'Formule par service',
}
RULE_TYPE_EN = {
    '_001_STD_GTA_Count_Hours': 'Hour count',
    '_039_STD_GTA_Formula': 'Formula',
    '_163_STD_GTA_SBSFormula': 'Per-shift formula',
}

LONG_THRESHOLD = 380          # au-delà, on repasse la formule en écriture raccourcie


def describe(row, resolver, translator, compact_translator=None):
    """Phrase en langage humain pour une règle."""
    _FORMAT_LANG[0] = resolver.lang
    rt = row['Règle']
    params = parse_params(row['Paramètres'])
    if rt in ('_039_STD_GTA_Formula', '_163_STD_GTA_SBSFormula'):
        try:
            return _describe_formula(rt, params, resolver, translator, compact_translator)
        except Exception as exc:
            # une formule que le traducteur ne sait pas lire ne doit jamais
            # interrompre la génération du dossier entier
            return UNKNOWN % resolver.t('translation_error', error=exc), [rt]
    return _describe_handler(row, rt, params, resolver)


def _describe_formula(rt, params, resolver, translator, compact_translator):
    body = params.get(rt, '')
    prefix = resolver.t('formula_sbs') if rt.startswith('_163') else ''
    if not body.strip():
        return resolver.t('formula_empty'), []
    txt = translator.translate(body)
    unres = list(translator.unresolved)
    if re.fullmatch(r'\s*rule\d+\s*', body):          # simple recopie
        return _cap(prefix + resolver.t('formula_copy', body=txt)), unres
    if len(txt) > LONG_THRESHOLD and compact_translator is not None:
        short = compact_translator.translate(body)
        unres = list(compact_translator.unresolved)
        if len(short) < len(txt):
            txt = short
            translator.r.compact = False
    if txt.startswith(resolver.t('if', cond='|', then='|').split('|')[0]):
        return _cap(prefix + txt) + '.', unres        # conditionnelle
    return _cap(prefix + resolver.t('formula_calc', body=txt)), unres


def _describe_handler(row, rt, params, resolver):
    handler = HANDLERS.get(rt)
    if handler:
        try:
            return handler(row, params, resolver), []
        except AmbiguousParam as amb:
            return _fallback(resolver, rt, params,
                             note=resolver.t('fallback_ambiguous', name=amb)), [rt]
        except UnreadableParam as bad:
            return _fallback(resolver, rt, params,
                             note=resolver.t('fallback_unreadable', name=bad)), [rt]
        except MissingParam as missing:
            # paramètre attendu absent (export d'une autre langue ou d'une autre
            # version) : on retombe sur le paramétrage brut plutôt que d'émettre
            # une phrase construite autour d'une valeur vide.
            return _fallback(resolver, rt, params,
                             note=resolver.t('fallback_param', name=missing)), [rt]
        except Exception as exc:
            return UNKNOWN % resolver.t('translation_error', error=exc), [rt]
    return _fallback(resolver, rt, params), [rt]


# Clés de paramètres rencontrées dans les exports, pour que même le repli sorte
# dans la langue demandée. Une clé inconnue est restituée telle quelle.
PARAM_GLOSSARY = {
    'day types': ('types de jour', 'day types'),
    'day type(s)': ('types de jour', 'day types'),
    'types jour': ('types de jour', 'day types'),
    'types jour inclu': ('types de jour inclus', 'day types included'),
    'mode': ('mode', 'mode'),
    'value': ('valeur', 'value'), 'valeur': ('valeur', 'value'),
    'value max': ('valeur maximale', 'maximum value'),
    'seuil max': ('valeur maximale', 'maximum value'),
    'thresholds': ('barème', 'thresholds'), 'seuils': ('barème', 'thresholds'),
    'seuil': ('seuil', 'threshold'), 'threshold': ('seuil', 'threshold seuil'),
    'rule(s)': ('règles', 'rules'), 'règle(s)': ('règles', 'rules'),
    'source rule': ('règle source', 'source rule'),
    'source rule(s)': ('règles sources', 'source rules'),
    'règle source': ('règle source', 'source rule'),
    'period': ('période', 'period'), 'période': ('période', 'period'),
    'calculer à': ('calculé à', 'calculated at'),
    'days': ('jours de la semaine', 'days of the week'),
    'day(s)': ('jours de la semaine', 'days of the week'),
    'jours de la semaine': ('jours de la semaine', 'days of the week'),
    'day start time': ('début de journée', 'day start time'),
    'day end time': ('fin de journée', 'day end time'),
    'day start/end time': ('début / fin de journée', 'day start/end time'),
    'heure de début/fin': ('début / fin de journée', 'day start/end time'),
    'include classical shifts': ('services classiques inclus', 'standard shifts included'),
    'inclure heures normales': ('heures normales incluses', 'standard hours included'),
    'include heures normales': ('heures normales incluses', 'standard hours included'),
    'activity type(s)': ("types d'activité", 'activity types'),
    'task(s) included': ('tâches incluses', 'tasks included'),
    'tasks': ('tâches', 'tasks'),
    'job title': ('fonction', 'job title'),
    'coef': ('coefficient', 'coefficient'),
    'constant': ('constante', 'constant'), 'constante': ('constante', 'constant'),
    'constant per': ('constante par', 'constant per'),
    'constante par': ('constante par', 'constant per'),
    'sum per': ('cumul par', 'sum per'), 'somme par': ('cumul par', 'sum per'),
    'week starts on': ('la semaine démarre le', 'week starts on'),
    'nb days of the period': ('nombre de jours de la période', 'days in the period'),
    'transcodification table field': ('champ de la table de conversion',
                                      'conversion table field'),
    'venue groups': ('groupes de lieux', 'venue groups'),
    'predefined role(s)': ('rôles prédéfinis', 'predefined roles'),
}


def _param_label(lang, key):
    pair = PARAM_GLOSSARY.get(str(key).strip().rstrip('*').strip().lower())
    return pair[LANGS.index(lang)] if pair else str(key).strip()


def _fallback(resolver, rt, params, note=None):
    """Repli honnête : on liste le paramétrage sans l'interpréter."""
    kept = ['%s : %s' % (_param_label(resolver.lang, k), v)
            for k, v in params.items() if not is_empty(v)]
    flag = UNKNOWN % (note or resolver.t('fallback_type'))
    label = (RULE_TYPE_EN if resolver.lang == 'en' else RULE_TYPE_FR).get(rt, rt)
    key = 'fallback_body' if kept else 'fallback_empty'
    return resolver.t(key, flag=flag, label=label, params=' ; '.join(kept))


def _cap(txt):
    return txt[0].upper() + txt[1:] if txt else txt
