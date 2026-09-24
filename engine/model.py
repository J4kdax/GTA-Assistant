"""Modèle d'environnement (depuis v2.0) : la seule lecture des exports.

Tous les outils de l'Atelier — Explorer, Audit, Catalogue, Dossier client —
travaillent sur l'objet produit ici, jamais sur les fichiers eux-mêmes. Une
évolution des exports #Dièse se corrige donc à un seul endroit.

    python3 model.py --input Contrats-GTA-Règles.xlsx [--daytypes ...] [--ref ...] > modele.json

Le modèle est un dict sérialisable en JSON :

    moteur          version du moteur
    format          habillage de colonnes détecté
    anomalies       corrections faites à la lecture de l'export
    diagnostic      relevé préalable (dict) et son texte (diagnostic_texte)
    regles          une entrée par règle, dans l'ordre d'exécution
    contrats        colonnes de contrat du catalogue [{cle, titre, libelle, id}]
    types_jour      types de jour déclarés, avec leur usage
    audit           constats classés : 'a_corriger' et 'a_savoir'
    referentiels    rapport de chargement des référentiels fournis

Chaque règle porte les champs que l'Explorer attend (id, rule_type, libelle,
libelle_court, parametres, affectations, deps…) et ceux du catalogue
(description en français et en anglais, contrats, repli).
"""
import argparse
import datetime as dt
import json
import re

from tables import is_missing
from dossier_common import (FORMAT_EN, NATURES, REFERENTIAL_EN, clean_code, clean_label, contract_index, daytype_usage, diagnose,
                            effective_order, format_diagnosis, load_daytype_details,
                            load_daytypes, load_referentials, load_rules,
                            parse_affectations, parse_params)
from humanizer import HANDLERS, LANGS, describe
from build_xlsx import VERSION, translators, _as_int

# --- dépendances entre règles ------------------------------------------------
# Motifs repris du Cartographe v3.5.2 (Parser.extractDeps), pour que le graphe
# garde exactement les mêmes arêtes.

_LIST = r'([0-9, ]+)'
_DEP_LISTS = [
    re.compile(r'(?:Source\s+[Rr]ule\(?s?\)?\*?|Id\s+Source\s+Rule|Source\s+Rule)\s*:\s*' + _LIST),
    re.compile(r'Rules?\(?s?\)?\*?\s*:\s*' + _LIST),
    re.compile(r'(?:Règle\s+source|Id\s+règle\s+source)\s*:\s*' + _LIST),
    re.compile(r'Règle\(s\)(?:\s+à\s+additionner|\s+crédit\s+annuel)?\s*:\s*' + _LIST),
    re.compile(r'Règle\s+(?:total\s+effectué|crédit\s+annuel)\s*:\s*' + _LIST),
]
_DEP_SINGLE = re.compile(r'Rule\s+(?:annual\s+credit|total\s+worked\s+hours)\*?\s*:\s*(\d+)')
_INLINE = re.compile(r'rule(\d+)')
_BARE_RULE = re.compile(r'(?<![A-Za-z])rule(?![\dA-Za-z])')


def rule_dependencies(params, rule_id):
    """Ids des règles dont dépend une règle, triés, sans elle-même."""
    if is_missing(params):
        return []
    text = str(params)
    deps = {int(m) for m in _INLINE.findall(text)}
    for pattern in _DEP_LISTS:
        for m in pattern.finditer(text):
            deps.update(int(t) for t in m.group(1).split(',') if t.strip().isdigit())
    deps.update(int(m) for m in _DEP_SINGLE.findall(text))
    deps.discard(rule_id)
    return sorted(deps)


def _hex(colour):
    return '#' + colour if colour else None


def _int_or_zero(value):
    number = _as_int(value)
    return number if number is not None else 0


# Intitulés anglais des constats d'audit (le français est écrit dans build_model).
AUDIT_EN = {
    'references_cassees': ('References to a rule that does not exist',
                           'The rule cites a rule number that is not in the export.'),
    'reference_incomplete': ('Incomplete rule reference',
                             'The formula contains “rule” without a number.'),
    'regles_mortes': ('Rules neither displayed, nor used, nor assigned',
                      'Candidates for removal, to be confirmed with the client.'),
    'sans_affectation': ('Rules assigned to no contract type',
                         'Some are still used by other rules.'),
    'replis': ('Rules described as raw settings',
               'Rule type without a dedicated translation, or unreadable setting.'),
    'types_jour_inutilises': ('Declared day types that no rule uses',
                              'To be reported to the client.'),
}


# --- construction du modèle ----------------------------------------------------

def build_model(rules_path, daytypes_path=None, ref_specs=None, contracts=True):
    """Lit les exports une fois et renvoie le modèle d'environnement."""
    df = load_rules(rules_path)
    daytypes = load_daytypes(daytypes_path) if daytypes_path else {}
    referentials, ref_report = load_referentials(ref_specs or [])
    _, ref_report_en = load_referentials(ref_specs or [], lang='en')
    diag = diagnose(df, daytypes, HANDLERS, referentials)

    columns, per_rule = contract_index(df) if contracts else ([], {})
    contract_meta = {}
    for row in df:
        for label, cid in parse_affectations(row['Affectations']):
            contract_meta[cid if cid is not None else label] = (label, cid)
    contrats = [{'cle': str(key), 'titre': title,
                 'libelle': contract_meta.get(key, (title, None))[0],
                 'id': contract_meta.get(key, (None, None))[1]}
                for title, key in columns]

    trans = {lang: translators(df, daytypes, referentials, lang) for lang in LANGS}
    ordered = effective_order(df)
    ids = {row['#'] for row in df}

    regles, fallbacks, missing_refs, incomplete = [], [], [], []
    for row in ordered:
        rid = row['#']
        descriptions, unresolved = {}, []
        for lang in LANGS:
            resolver, translator, compact = trans[lang]
            descriptions[lang], unresolved = describe(row, resolver, translator, compact)
        rt = row['Règle']
        # repli = paramétrage brut : type sans traduction dédiée, ou handler qui a
        # refusé un paramètre (pour une formule, `unresolved` liste des fragments)
        fell_back = ((rt not in HANDLERS and 'Formula' not in rt)
                     or (rt in HANDLERS and bool(unresolved)))
        params = '' if is_missing(row['Paramètres']) else str(row['Paramètres'])
        deps = rule_dependencies(params, rid)
        broken = [d for d in deps if d not in ids]
        if broken:
            missing_refs.append({'id': rid, 'cibles': broken})
        if 'Formula' in rt and _BARE_RULE.search(parse_params(params).get(rt, '')):
            incomplete.append(rid)
        if fell_back:
            fallbacks.append(rid)
        order = _as_int(row['Ordre'])
        regles.append({
            'id': rid,
            'rule_type': row['Règle'],
            'libelle': clean_label(row['Libellé'], inline=True),
            'libelle_court': clean_label(row['Libellé court'], inline=True),
            'libelle_court_lignes': clean_label(row['Libellé court']),
            'code': clean_code(row.get('Code')) or None,
            'ordre': order,
            'compteur': row['Compteur ?'],
            'periode': (clean_label(row['Période'], inline=True) or None)
                       if row['Compteur ?'] == 1 else None,
            'affectations': '' if is_missing(row['Affectations']) else str(row['Affectations']),
            'parametres': params,
            'regle_manuelle': _int_or_zero(row.get('Règle manuelle')),
            'affect_regle_manuelle': _int_or_zero(row.get('Affectation règle manuelle')),
            'calcul_budget': _int_or_zero(row.get('Calcul budget ?')),
            'affiche_diese': row.get('Affiché dièse ?', 0),
            'sa_ordre_technique': _int_or_zero(row.get('SA : Ordre technique')),
            'deps': deps,
            'description': descriptions,
            'repli': fell_back,
            'contrats': sorted(str(k) for k in per_rule.get(row['_row'], set())),
        })

    # règles utilisées par d'autres (pour repérer les règles mortes)
    used = {d for r in regles for d in r['deps']}
    unassigned = [r['id'] for r in regles if not parse_affectations(r['affectations'])]
    dead = [r['id'] for r in regles
            if not r['affiche_diese'] and r['id'] not in used
            and not parse_affectations(r['affectations'])]

    details = load_daytype_details(daytypes_path) if daytypes_path else []
    usage = daytype_usage(df)
    types_jour = [{
        'id': d['id'],
        'libelle': d['public'],
        'libelle_court': d['court'],
        'categorie': d['nature'],
        'categorie_en': (NATURES.get(d['nature'].lower()) or (None, d['nature']))[1],
        'actif': d['actif'],
        'duree_min': _as_int(d['duree']),
        'ordre': _as_int(d['ordre']),
        'hex_bg': _hex(d['couleur']),
        'hex_fg': _hex(d['encre']) or '#000000',
        'regles': usage.get(d['id'], 0),
    } for d in details]
    unused_days = [d['id'] for d in types_jour if not d['regles']]

    audit = {'a_corriger': [], 'a_savoir': []}

    def finding(level, code, title, ids, note='', objet='regle'):
        if ids:
            title_en, note_en = AUDIT_EN[code]
            audit[level].append({'code': code, 'titre': title, 'titre_en': title_en,
                                 'nombre': len(ids), 'objet': objet, 'ids': ids,
                                 'note': note, 'note_en': note_en if note else ''})

    finding('a_corriger', 'references_cassees', 'Renvois vers une règle inexistante',
            [m['id'] for m in missing_refs],
            'La règle cite un numéro de règle absent de l\'export.')
    finding('a_corriger', 'reference_incomplete', 'Référence de règle incomplète',
            incomplete, 'La formule contient « rule » sans numéro.')
    finding('a_savoir', 'regles_mortes', 'Règles ni affichées, ni utilisées, ni affectées', dead,
            'Candidates à la suppression, à confirmer avec le client.')
    finding('a_savoir', 'sans_affectation', 'Règles affectées à aucun type de contrat',
            unassigned, 'Certaines restent utilisées par d\'autres règles.')
    finding('a_savoir', 'replis', 'Règles décrites en paramétrage brut', fallbacks,
            'Type de règle sans traduction dédiée, ou paramètre illisible.')
    finding('a_savoir', 'types_jour_inutilises', 'Types de jour déclarés qu\'aucune règle '
            'n\'utilise', unused_days, 'Constat à remonter au client.', objet='type_jour')
    for note, note_en in zip(df.attrs.get('anomalies', []), df.attrs.get('anomalies_en', [])):
        audit['a_corriger'].append({'code': 'export', 'titre': 'Export corrigé à la lecture',
                                    'titre_en': 'Export corrected on reading', 'nombre': 1,
                                    'objet': 'export', 'ids': [], 'note': note, 'note_en': note_en})

    missing_refs_named = [{
        'famille': family,
        'libelle': {'fr': family, 'en': REFERENTIAL_EN.get(family, (family, ask))[0]},
        'occurrences': occ, 'regles': n,
        'demande': {'fr': ask, 'en': REFERENTIAL_EN.get(family, (family, ask))[1]},
    } for family, occ, n, ask in diag['referentiels']]

    return {
        'moteur': VERSION,
        'genere_le': dt.datetime.now().isoformat(timespec='seconds'),
        'format': df.attrs.get('format'),
        'format_en': FORMAT_EN.get(df.attrs.get('format'), df.attrs.get('format')),
        'anomalies': list(df.attrs.get('anomalies', [])),
        'diagnostic': diag,
        'diagnostic_texte': format_diagnosis(diag),
        'diagnostic_texte_en': format_diagnosis(diag, 'en'),
        'referentiels_manquants': missing_refs_named,
        'regles': regles,
        'references_cassees': missing_refs,
        'contrats': contrats,
        'types_jour': types_jour,
        'audit': audit,
        'referentiels': ref_report,
        'referentiels_en': ref_report_en,
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--input', required=True)
    ap.add_argument('--daytypes')
    ap.add_argument('--ref', action='append', default=[])
    a = ap.parse_args()
    print(json.dumps(build_model(a.input, a.daytypes, a.ref), ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()
