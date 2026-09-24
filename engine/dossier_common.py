"""Chargement, nettoyage et normalisation des exports GTA #Dièse.

Référence métier partagée par tous les générateurs.
"""
import os
import re
import html

from tables import Table, is_missing, read_sheets

# --- nettoyage des libellés -------------------------------------------------
# ATTENTION : ne JAMAIS appliquer ces fonctions à la colonne "Paramètres".
# Les formules contiennent des < et > de comparaison qu'un nettoyeur HTML
# détruirait silencieusement.

_BR = re.compile(r'<\s*br\s*/?\s*>', re.I)
_TAG = re.compile(r'</?\s*(b|i|u|strong|em|span|div|p)\b[^>]*>', re.I)


def clean_label(value, inline=False):
    """Nettoie un libellé #Dièse.

    inline=False : les <br> deviennent de vrais retours à la ligne (colonne dédiée).
    inline=True  : les <br> deviennent des espaces (libellé cité dans une phrase).
    """
    if is_missing(value):
        return ''
    s = str(value)
    s = _BR.sub(' ' if inline else '\n', s)
    s = _TAG.sub('', s)
    s = html.unescape(s)
    s = re.sub(r'[ \t]+', ' ', s)
    s = re.sub(r'\n{2,}', '\n', s)
    return s.strip()


# valeurs de la colonne Code qui ne portent aucune information
_CODE_NOISE = {'', 'na', 'n/a', '-', '--', '?', '??', '???', '***', '*'}


def clean_code(value):
    s = clean_label(value, inline=True)
    return '' if s.lower().strip() in _CODE_NOISE else s


# --- chargement -------------------------------------------------------------

REQUIRED_COLUMNS = ['#', 'Règle', 'Paramètres', 'Libellé', 'Libellé court',
                    'Ordre', 'Compteur ?', 'Période', 'Affectations']

# #Dièse exporte les mêmes données sous trois habillages de colonnes selon
# l'ancienneté du client et la langue de son interface. On détecte lequel est
# présent et on ramène tout au modèle interne (français récent).
COLUMN_FORMATS = {
    'français récent': {},          # référence : rien à renommer
    'anglais récent': {
        'Rules': 'Règle', 'Parameters': 'Paramètres', 'Name': 'Libellé',
        'Short label': 'Libellé court', 'Order': 'Ordre', 'Manual rule': 'Règle manuelle',
        'Manual rule scope': 'Affectation règle manuelle', 'Counter?': 'Compteur ?',
        'Budget calculation?': 'Calcul budget ?', 'Display #DIESE?': 'Affiché dièse ?',
        'Period': 'Période', 'SA: Technical order': 'SA : Ordre technique',
    },
    'anglais ancien': {
        'id': '#', 'rule_type': 'Règle', 'parametres': 'Paramètres', 'parametre': 'Paramètres',
        'libelle': 'Libellé', 'libellé': 'Libellé', 'libelle_court': 'Libellé court',
        'libellé_court': 'Libellé court', 'code': 'Code', 'ordre': 'Ordre',
        'compteur': 'Compteur ?', 'periode': 'Période', 'période': 'Période',
        'affectations': 'Affectations',
    },
}


class ExportError(ValueError):
    """Fichier d'entrée inexploitable. Le message s'adresse à l'utilisateur :
    il dit ce qui manque et quoi fournir, jamais une trace Python."""


def detect_format(columns):
    cols = {str(c).strip() for c in columns}
    if {'Règle', 'Paramètres', '#'} <= cols:
        return 'français récent'
    if {'Rules', 'Parameters', '#'} <= cols:
        return 'anglais récent'
    if 'rule_type' in cols and ('parametres' in cols or 'parametre' in cols):
        return 'anglais ancien'
    raise ExportError("Format de colonnes non reconnu. Colonnes trouvées : %s"
                      % ', '.join(str(c) for c in list(columns)[:12]))


_TRUE = {'1', '1.0', 'oui', 'yes', 'true', 'vrai', 'x'}


def _flag(value):
    """Case à cocher de l'export (1 / 0, Oui / Non, Yes / No, vide) -> 1 ou 0."""
    if is_missing(value):
        return 0
    return 1 if str(value).strip().lower() in _TRUE else 0


def _read_rules_sheet(path):
    """Première feuille du classeur dont les colonnes sont celles d'un export
    de règles. Les clients ajoutent parfois un onglet de notes devant."""
    try:
        sheets = read_sheets(path)
    except FileNotFoundError:
        raise ExportError("Fichier introuvable : %s" % path)
    except ValueError as exc:
        raise ExportError("Impossible de lire « %s » comme un classeur Excel (%s). "
                          "Fournir l'export « Règles GTA » au format .xlsx."
                          % (os.path.basename(str(path)), str(exc).split(':')[0]))
    for sheet in sheets:
        try:
            return sheet, detect_format(sheet.columns)
        except ExportError:
            continue
    columns = sheets[0].columns if sheets else []
    hint = ''
    lower = {c.lower() for c in columns}
    if lower & {'intitulé public', 'intitule public', 'public label'}:
        hint = " Ce fichier ressemble à l'export des types de jour (« Absences-présences »)."
    raise ExportError("Ce fichier n'est pas un export « Règles GTA » : aucune feuille ne porte "
                      "les colonnes #, Règle et Paramètres. Colonnes trouvées : %s.%s"
                      % (', '.join(columns[:12]) or 'aucune', hint))


def _as_int(value):
    """Identifiant ou ordre -> int, ou None s'il n'est pas un entier."""
    if is_missing(value) or isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value) if value.is_integer() else None
    try:
        number = float(str(value).strip().replace(',', '.'))
    except ValueError:
        return None
    return int(number) if number.is_integer() else None


def load_rules(path):
    """Charge l'export des règles et le normalise -> Table de dicts.

    Tolère sans bloquer : feuille de notes en tête, lignes sans identifiant,
    doublons, cases Compteur en texte, valeurs vides. Chaque correction est
    consignée dans table.attrs['anomalies'] et restituée par le diagnostic.
    Refuse (ExportError) : fichier illisible, mauvais export, colonne
    obligatoire absente.
    """
    sheet, fmt = _read_rules_sheet(path)
    renames = COLUMN_FORMATS[fmt]
    columns = [renames.get(c, c) for c in sheet.columns]
    rows = [{renames.get(k, k): v for k, v in row.items()} for row in sheet.rows]
    anomalies = []
    for optional in ('Code', 'Compteur ?', 'Affiché dièse ?', 'Règle manuelle',
                     'Calcul budget ?', 'Affectation règle manuelle', 'SA : Ordre technique'):
        if optional not in columns:
            columns.append(optional)
            for row in rows:
                row[optional] = 0 if optional != 'Code' else None
    missing = [col for col in REQUIRED_COLUMNS if col not in columns]
    if missing:
        raise ExportError("Colonnes absentes de l'export Règles GTA (%s) : %s"
                          % (fmt, ', '.join(missing)))

    kept, bad = [], 0
    for row in rows:
        rid = _as_int(row.get('#'))
        if rid is None:
            bad += 1
            continue
        row['#'] = rid
        kept.append(row)
    if bad:
        anomalies.append("%d ligne(s) sans identifiant de règle exploitable, ignorée(s)" % bad)

    seen, unique = set(), []
    for row in kept:
        key = tuple((c, repr(row.get(c))) for c in columns)
        if key not in seen:
            seen.add(key)
            unique.append(row)
    if len(unique) < len(kept):
        anomalies.append("%d ligne(s) en double exact, retirée(s)" % (len(kept) - len(unique)))

    first, dup = {}, set()
    for row in unique:
        if row['#'] in first:
            dup.add(row['#'])
        else:
            first[row['#']] = row
    if dup:
        anomalies.append("identifiant(s) présent(s) plusieurs fois avec un contenu différent, "
                         "seule la première ligne est gardée : %s"
                         % ', '.join('#%d' % i for i in sorted(dup)))
    rows = list(first.values())

    for position, row in enumerate(rows):
        row['_row'] = position
        row['Règle'] = '' if is_missing(row.get('Règle')) else str(row['Règle']).strip()
        for flag in ('Compteur ?', 'Affiché dièse ?'):
            row[flag] = _flag(row.get(flag))
    return Table(rows, columns, {'format': fmt, 'anomalies': anomalies})


DAYTYPE_COLUMNS = {
    'id': ('#', 'id'),
    'public': ('intitulé public', 'intitule public', 'public label', 'name'),
    'court': ('intitulé court public', 'intitule court public', 'short public label'),
    'nature': ('absence', 'absence type', 'nature'),
    'couleur': ('couleur', 'colour', 'color'),
    'actif': ('actif', 'active'),
    'duree': ('durée défaut (min.)', 'duree defaut (min.)', 'default duration (min.)',
              'durée défaut', 'default duration'),
    'ordre': ('ordre', 'order'),
}

# La couleur est stockée en HTML dans l'export : on en extrait le fond et l'encre.
_BG = re.compile(r'background-color\s*:\s*(#[0-9a-fA-F]{6})')
_FG = re.compile(r'(?<!-)color\s*:\s*(#[0-9a-fA-F]{6})')

NATURES = {
    'temps de travail effectif': ('Temps de travail effectif', 'Effective working time'),
    'temps de travail non effectif': ('Temps de travail non effectif', 'Non-effective working time'),
    'absence (non comptabilisée)': ('Absence (non comptabilisée)', 'Absence (not counted)'),
    'effective working time': ('Temps de travail effectif', 'Effective working time'),
    'non-effective working time': ('Temps de travail non effectif', 'Non-effective working time'),
    'absence (not counted)': ('Absence (non comptabilisée)', 'Absence (not counted)'),
}


def _daytype_frame(path):
    """Feuille des types de jour, quel que soit l'habillage de ses colonnes."""
    try:
        sheets = read_sheets(path)
    except Exception:
        return None, {}
    for sheet in sheets:
        lower = {col.lower(): col for col in sheet.columns}
        mapping = {}
        for key, aliases in DAYTYPE_COLUMNS.items():
            mapping[key] = next((lower[a] for a in aliases if a in lower), None)
        if mapping['id'] and (mapping['public'] or mapping['court']):
            return sheet.rows, mapping
    return None, {}


def load_daytype_details(path, lang='fr'):
    """[{id, public, court, nature, couleur, encre, actif, duree, ordre}] — jamais bloquant."""
    source, mapping = _daytype_frame(path)
    if source is None:
        return []
    rows = []
    for row in source:
        key = _as_int(row[mapping['id']])
        if key is None:
            continue
        raw_colour = str(row[mapping['couleur']] or '') if mapping['couleur'] else ''
        bg = _BG.search(raw_colour)
        fg = _FG.search(raw_colour)
        nature = clean_label(row[mapping['nature']], inline=True) if mapping['nature'] else ''
        pair = NATURES.get(nature.lower())
        rows.append({
            'id': key,
            'public': clean_label(row[mapping['public']], inline=True) if mapping['public'] else '',
            'court': clean_label(row[mapping['court']], inline=True) if mapping['court'] else '',
            'nature': pair[0 if lang == 'fr' else 1] if pair else nature,
            'couleur': bg.group(1).upper().lstrip('#') if bg else '',
            'encre': fg.group(1).upper().lstrip('#') if fg else '000000',
            'actif': _flag(row[mapping['actif']]) == 1 if mapping['actif'] else None,
            'duree': row[mapping['duree']] if mapping['duree'] else None,
            'ordre': row[mapping['ordre']] if mapping['ordre'] else None,
        })
    return rows


DAYTYPE_PARAM_KEYS = ('Day types', 'Day type(s)', 'Types jour', 'Types jour inclu',
                      'Types de jour')


def _param_texts(rows):
    return ['' if is_missing(r.get('Paramètres')) else str(r['Paramètres']) for r in rows]


def daytype_usage(df):
    """{id de type de jour: nombre de règles qui s'en servent}."""
    counts = {}
    for value in _param_texts(df):
        ids = set()
        for key in DAYTYPE_PARAM_KEYS:
            m = re.search(re.escape(key) + r'\*?\s*:\s*([\d,]+)', value)
            if m:
                ids.update(id_list(m.group(1)))
        ids.update(int(x) for x in re.findall(r'htime(\d+)', value))
        ids.discard(0)          # htime0 = services normaux, pas un type de jour
        for i in ids:
            counts[i] = counts.get(i, 0) + 1
    return counts


def load_daytypes(path):
    """Retourne {id: nom court lisible} depuis l'export Absences-présences."""
    return {row['id']: (row['court'] or row['public'])
            for row in load_daytype_details(path) if (row['court'] or row['public'])}


# --- affectations -----------------------------------------------------------

_AFF = re.compile(r'^(?P<label>.*?)\s*\(#(?P<id>\d+)\)\s*$')


def parse_affectations(value):
    """[(libellé, id)] — une entrée par type de contrat affecté."""
    out = []
    if is_missing(value):
        return out
    for line in str(value).splitlines():
        line = line.strip()
        if not line:
            continue
        m = _AFF.match(line)
        if m:
            out.append((clean_label(m.group('label'), inline=True), int(m.group('id'))))
        else:
            out.append((clean_label(line, inline=True), None))
    return out


# --- paramètres -------------------------------------------------------------

class Params(dict):
    """Paramètres d'une règle, dans l'ordre de l'export.

    Se comporte comme un dict (libellé -> valeur, la dernière occurrence
    l'emporte, comme avant la v1.5) mais conserve aussi toutes les lignes :
    certains fichiers #Dièse déclarent deux paramètres sous le même libellé
    (`_045` : « Day start time* » pour l'heure de début ET l'heure de fin).
    Un dict seul écrase alors silencieusement la première valeur.
    """

    def __init__(self):
        super().__init__()
        self.lines = []          # [(libellé, valeur)] dans l'ordre
        self.ambiguous = set()   # libellés normalisés présents plusieurs fois
                                 # avec des valeurs différentes

    def add(self, key, value):
        norm = _norm_key(key)
        for k, v in self.lines:
            if _norm_key(k) == norm and str(v).strip() != str(value).strip():
                self.ambiguous.add(norm)
        self.lines.append((key, value))
        self[key] = value


def parse_params(value):
    """'Clé : valeur' par ligne -> Params. Conserve l'ordre et les doublons.

    Le corps des formules (_039 / _163) contient des ':' et des '<' :
    on ne découpe que sur le PREMIER ':' de chaque ligne, sans nettoyage HTML.
    """
    params = Params()
    if is_missing(value):
        return params
    for line in str(value).split('\n'):
        if ':' not in line:
            continue
        key, val = line.split(':', 1)
        params.add(key.strip(), val.strip())
    return params


class MissingParam(Exception):
    """Paramètre obligatoire absent : on refuse d'émettre une phrase mutilée."""


class AmbiguousParam(MissingParam):
    """Le même libellé porte deux valeurs différentes : impossible de savoir
    laquelle lire sans risquer de décrire le mauvais paramètre."""


class UnreadableParam(MissingParam):
    """Valeur présente mais dans une syntaxe que le générateur ne sait pas lire
    (ex. une tranche de barème inconnue). On refuse de l'ignorer en silence."""


def _norm_key(key):
    return str(key).strip().rstrip('*').strip().lower()


def pick(params, *aliases, required=False, default=''):
    """Lit un paramètre quel que soit son libellé (français ou anglais).

    Les exports #Dièse nomment les mêmes paramètres différemment selon
    l'ancienneté et la langue du client, parfois au sein d'un même fichier.
    Si un paramètre obligatoire manque, on lève MissingParam plutôt que de
    construire une phrase autour d'une valeur vide.
    """
    table = {_norm_key(k): v for k, v in params.items()}
    ambiguous = getattr(params, 'ambiguous', set())
    for alias in aliases:
        norm = _norm_key(alias)
        value = table.get(norm)
        if value is not None and not is_empty(value):
            if norm in ambiguous:
                raise AmbiguousParam(alias)
            return value
    if required:
        raise MissingParam(aliases[0])
    return default


def nth(params, n, *aliases, required=False, default=''):
    """n-ième occurrence (0 = première) d'un libellé, pour les fichiers qui
    déclarent plusieurs paramètres sous le même nom."""
    norms = {_norm_key(a) for a in aliases}
    found = [v for k, v in getattr(params, 'lines', params.items())
             if _norm_key(k) in norms]
    if n < len(found) and not is_empty(found[n]):
        return found[n]
    if required:
        raise MissingParam(aliases[0])
    return default


def is_empty(v):
    return v is None or str(v).strip() in ('', '-', 'nan')


def id_list(value):
    """'11,12,14' -> [11, 12, 14]"""
    if is_empty(value):
        return []
    return [int(x) for x in re.findall(r'\d+', str(value))]


# --- tri --------------------------------------------------------------------

def effective_order(df):
    """Ordre d'exécution retenu pour le dossier : l'ordre standard.

    'SA : Ordre technique' n'est pas utilisé (choix client). Départage des
    ex aequo par le # de règle, pour un tri stable et reproductible.
    """
    def key(row):
        order = row.get('Ordre')
        try:
            order = float(str(order).replace(',', '.')) if not is_missing(order) else 0.0
        except ValueError:
            order = 0.0
        return (order if order == order else 0.0, row['#'])
    rows = sorted(df, key=key)
    return df.derive(rows) if isinstance(df, Table) else rows


# --- recensement des référentiels manquants ---------------------------------

REFERENTIALS = [
    ('taux', r'rate(\d+)', 'export des taux'),
    ('fonction', r'\bidjob\b', 'export des fonctions / métiers'),
    ("type d'activité", r'\bidactivitytype\d*\b', "export des types d'activité"),
    ('champ contrat', r'(?<![A-Za-z])field(\d+)', 'liste des champs personnalisés de contrat'),
    ('champ système', r'fieldSystem(\d+)', 'liste des champs système de contrat'),
    ('type de production', r'\bidproductiontype\b', 'export des types de production'),
    ('élément financier', r'\belement(\d+)', 'export des éléments financiers'),
    ('table de conversion', r'latest_[A-Z_]+', 'export des tables de conversion'),
    ('champ contact', r'fieldContact(\d+)', 'liste des champs de classification contact'),
    ('département', r'\bdepartmentId\b', 'export des départements'),
    ('champ activité', r'fieldactivity(\d+)', "liste des champs personnalisés d'activité"),
    ('tâche', r'\bidtask\d*\b', 'export des tâches'),
]

# paramètres exprimés en listes d'ids, hors types de jour (résolus par ailleurs)
PARAM_REFERENTIALS = [
    ("type d'activité", 'Activity type(s)'),
    ("type d'activité", 'Activity type(s) in the day'),
    ('fonction', 'Job title'),
    ('tâche', 'Task(s) included'),
    ('rôle prédéfini', 'Predefined role(s)'),
    ('groupe de lieux', 'Group of venues'),
]


def census_referentials(df):
    """Recense ce que le générateur ne saura pas traduire faute de référentiel.

    -> [(famille, nb occurrences, nb règles, export à demander)] trié par poids.
    """
    params = _param_texts(df)
    found = {}
    for family, pattern, ask in REFERENTIALS:
        occ = sum(len(re.findall(pattern, s)) for s in params)
        rules = sum(1 for s in params if re.search(pattern, s))
        if occ:
            found[family] = [occ, rules, ask]
    for family, key in PARAM_REFERENTIALS:
        pat = re.escape(key) + r'\*?\s*:\s*([\d,]+)'
        occ = rules = 0
        for s in params:
            m = re.search(pat, s)
            if m:
                rules += 1
                occ += len(id_list(m.group(1)))
        if occ:
            if family in found:
                found[family][0] += occ
                found[family][1] += rules
            else:
                ask = "export des %ss" % family
                found[family] = [occ, rules, ask]
    out = [(f, v[0], v[1], v[2]) for f, v in found.items()]
    out.sort(key=lambda t: -t[1])
    return out


# --- codes de type de contrat ----------------------------------------------

_CODE = re.compile(r'^([A-Za-z]+)_(\d+)')


def contract_code(label):
    """'TECH_16_FLEX RECUP - temps plein' -> ('TECH_16', 'TECH').

    Les libellés hors convention (contrat de test, planification générique)
    sont conservés tels quels, tronqués, et rangés dans la famille 'AUTRE'.
    """
    label = (label or '').strip()
    m = _CODE.match(label)
    if m:
        return '%s_%s' % (m.group(1).upper(), m.group(2)), m.group(1).upper()
    short = re.sub(r'\s+', ' ', label)[:28]
    return short or '(sans libellé)', 'AUTRE'


def contract_index(df):
    """[(code, famille, libellé, id)] triés, + {index de ligne: {codes}}.

    Le code affiché en en-tête est unique : deux contrats dont les libellés
    commencent pareil (« CDI modulation Adm » et « CDI modulation technique »)
    doivent rester deux colonnes distinctes. L'identité d'un contrat est son id,
    jamais son libellé tronqué.
    """
    by_id, per_rule = {}, {}
    for row in df:
        idx = row['_row']
        ids = set()
        for label, cid in parse_affectations(row['Affectations']):
            key = cid if cid is not None else label
            by_id[key] = (label, cid)
            ids.add(key)
        per_rule[idx] = ids

    # attribution des codes affichés, désambiguïsés par l'id en cas de doublon
    draft = {}
    for key, (label, cid) in by_id.items():
        code, family = contract_code(label)
        draft.setdefault(code, []).append((key, label, cid, family))
    display = {}
    for code, entries in draft.items():
        for key, label, cid, family in entries:
            name = code if len(entries) == 1 else (
                '%s (#%s)' % (code[:22], cid) if cid is not None else code)
            display[key] = (name, family, label, cid)

    ordered = sorted(display.items(), key=lambda kv: (kv[1][1], kv[1][0]))
    columns = [(v[0], k) for k, v in ordered]     # (libellé affiché, clé de marquage)
    return columns, per_rule


# --- contrôle préalable à la génération -------------------------------------

def diagnose(df, daytypes=None, handlers=None, referentials=None):
    """Ce qu'il faut savoir AVANT de produire le dossier.

    Le générateur ne doit jamais sortir un classeur sans avoir dit ce qu'il ne
    sait pas nommer : c'est le moment de réclamer les référentiels manquants.
    """
    handlers = handlers or {}
    types = {}
    for row in df:
        if row['Règle']:
            types[row['Règle']] = types.get(row['Règle'], 0) + 1
    types = dict(sorted(types.items(), key=lambda kv: -kv[1]))
    uncovered = {t: int(n) for t, n in types.items()
                 if t not in handlers and 'Formula' not in t}
    contracts, _ = contract_index(df)
    daytype_ids = set()
    for value in _param_texts(df):
        for key in ('Day types', 'Day type(s)', 'Types jour', 'Types jour inclu'):
            m = re.search(re.escape(key) + r'\*?\s*:\s*([\d,]+)', value)
            if m:
                daytype_ids.update(id_list(m.group(1)))
        daytype_ids.update(int(x) for x in re.findall(r'htime(\d+)', value))
    unresolved_days = sorted(d for d in daytype_ids if d and d not in (daytypes or {}))
    return {
        'format': getattr(df, 'attrs', {}).get('format', 'inconnu'),
        'regles': len(df),
        'types': len(types),
        'types_non_couverts': uncovered,
        'regles_non_couvertes': sum(uncovered.values()),
        'contrats': len(contracts),
        'sans_affectation': sum(1 for r in df if not parse_affectations(r['Affectations'])),
        'compteurs': sum(1 for r in df if r['Compteur ?'] == 1),
        'periodes': sorted({str(r['Période']) for r in df if not is_missing(r['Période'])}),
        'types_jour_non_resolus': unresolved_days,
        'referentiels': [(family, occ, rules, ask)
                         for family, occ, rules, ask in census_referentials(df)
                         if not (referentials or {}).get(family)],
        'referentiels_fournis': sorted((referentials or {}).keys()),
        'anomalies': list(getattr(df, 'attrs', {}).get('anomalies', [])),
    }


def format_diagnosis(d):
    lines = ["Format de colonnes détecté : %s" % d['format'],
             "%d règles, %d types de règle, %d types de contrat, %d compteurs"
             % (d['regles'], d['types'], d['contrats'], d['compteurs'])]
    for note in d.get('anomalies', []):
        lines.append("Export corrigé à la lecture : %s" % note)
    if d['periodes']:
        lines.append("Exercices de compteur : %s" % ', '.join(d['periodes']))
    if d['sans_affectation']:
        lines.append("%d règles ne sont affectées à aucun type de contrat"
                     % d['sans_affectation'])
    if d['types_non_couverts']:
        lines.append("")
        lines.append("Types de règle sans traduction dédiée (%d règles concernées) :"
                     % d['regles_non_couvertes'])
        for t, n in sorted(d['types_non_couverts'].items(), key=lambda kv: -kv[1]):
            lines.append("   %4d  %s" % (n, t))
    if d['types_jour_non_resolus']:
        lines.append("")
        lines.append("À RÉCLAMER — export « Types de jour » : %d identifiants non résolus (%s…)"
                     % (len(d['types_jour_non_resolus']),
                        ', '.join(str(i) for i in d['types_jour_non_resolus'][:8])))
    if d['referentiels']:
        lines.append("")
        lines.append("À RÉCLAMER — référentiels manquants, par ordre de rendement :")
        for family, occ, rules, ask in d['referentiels']:
            lines.append("   %-24s %4d occurrences / %3d règles  →  %s"
                         % (family, occ, rules, ask))
    if d.get('referentiels_fournis'):
        lines.append("")
        lines.append("Référentiels fournis et résolus : %s" % ', '.join(d['referentiels_fournis']))
    if not d['types_jour_non_resolus'] and not d['referentiels']:
        lines.append("")
        lines.append("Aucun référentiel manquant : tout est nommé en clair.")
    return '\n'.join(lines)


# --- référentiels complémentaires -------------------------------------------
# Les exports #Dièse de référentiels (taux, éléments financiers, fonctions…)
# n'ont pas tous les mêmes colonnes. On cherche une colonne d'identifiant et une
# colonne de libellé, quels que soient leurs noms, et on ignore le reste.

ID_COLUMNS = ('#', 'id', 'identifiant', 'code interne', 'idelement', 'idrate')
LABEL_COLUMNS = ('intitulé public', 'intitulé court public', 'intitulé', 'intitule',
                 'libellé', 'libelle', 'libellé court', 'name', 'short label', 'label',
                 'désignation', 'designation', 'nom')

# Familles reconnues par le traducteur, avec les mots-clés qui permettent de les
# deviner à partir d'un nom de fichier.
REFERENTIAL_FAMILIES = {
    'taux': ('taux', 'rate', 'rates'),
    'élément financier': ('element', 'élément', 'elements', 'financier', 'financial'),
    'fonction': ('fonction', 'job', 'jobs', 'metier', 'métier'),
    "type d'activité": ('activite', 'activité', 'activity', 'activitytype'),
    'tâche': ('tache', 'tâche', 'task', 'tasks'),
    'champ contrat': ('champcontrat', 'champs-contrat', 'contractfield'),
    'champ système': ('champsysteme', 'champ-systeme', 'systemfield'),
    'champ contact': ('champcontact', 'contactfield', 'classifcontact'),
    'champ activité': ('champactivite', 'activityfield'),
    'type de production': ('production', 'productiontype'),
    'type de contrat': ('typecontrat', 'contracttype'),
    'département': ('departement', 'département', 'department'),
    'rôle prédéfini': ('role', 'rôle', 'predefinedrole'),
    'classification': ('classif', 'classification'),
    'table de conversion': ('transcodification', 'conversion', 'latest'),
}


def guess_family(path):
    """Devine la famille d'un référentiel d'après son nom de fichier."""
    name = re.sub(r'[^a-z]', '', str(path).lower().rsplit('/', 1)[-1])
    for family, keywords in REFERENTIAL_FAMILIES.items():
        for keyword in keywords:
            if re.sub(r'[^a-z]', '', keyword) in name:
                return family
    return None


def load_referential(path, family=None):
    """Lit un export de référentiel -> (famille, {id: libellé}).

    Tolérant par construction : si le fichier n'est pas exploitable, on renvoie
    un dictionnaire vide et le générateur continue avec des chevrons. Un
    référentiel manquant ou illisible ne doit JAMAIS bloquer une génération.
    """
    family = family or guess_family(path)
    try:
        frames = read_sheets(path)
    except Exception:
        return family, {}

    for df in frames:
        columns = {col.lower(): col for col in df.columns}
        id_col = next((columns[k] for k in ID_COLUMNS if k in columns), None)
        label_col = next((columns[k] for k in LABEL_COLUMNS if k in columns), None)
        if id_col is None or label_col is None:
            continue
        table = {}
        for row in df.rows:
            key = _as_int(row[id_col])
            if key is None:
                continue
            label = clean_label(row[label_col], inline=True)
            if label:
                table[key] = label
        if table:
            return family, table
    return family, {}


def load_referentials(specs):
    """['taux=fichier.xlsx', 'autre.xlsx'] -> ({famille: {id: libellé}}, [rapport])."""
    tables, report = {}, []
    for spec in specs or []:
        family, path = (spec.split('=', 1) if '=' in spec else (None, spec))
        family = family.strip() if family else None
        family, table = load_referential(path.strip(), family)
        name = str(path).rsplit('/', 1)[-1]
        if not family:
            report.append("%s : famille non reconnue — préciser avec « famille=fichier »" % name)
            continue
        if not table:
            report.append("%s : aucun couple identifiant / libellé exploitable, ignoré" % name)
            continue
        tables.setdefault(family, {}).update(table)
        report.append("%s : %d entrées chargées pour « %s »" % (name, len(table), family))
    return tables, report


# --- identification automatique des fichiers déposés ------------------------

DAYTYPE_MARKERS = ('intitulé public', 'intitule public', 'public label',
                   'intitulé court public', 'short public label')


def _sheets(path):
    try:
        return read_sheets(path, nrows=50)
    except Exception:
        return []


def identify_file(path):
    """Devine ce qu'est un fichier déposé, par son CONTENU d'abord.

    -> 'regles' | 'types de jour' | 'referentiel' | None
    Le nom de fichier ne sert qu'à deviner la famille d'un référentiel : les
    clients renomment leurs exports, les en-têtes de colonnes sont fiables.
    """
    for df in _sheets(path):
        columns = {col.lower() for col in df.columns}
        try:
            detect_format(df.columns)
            return 'regles'
        except ValueError:
            pass
        if any(marker in columns for marker in DAYTYPE_MARKERS):
            return 'types de jour'
    family, table = load_referential(path)
    if table:
        return 'referentiel'
    return None


def identify_files(paths):
    """Range une liste de fichiers déposés en vrac.

    -> {'regles': chemin|None, 'types de jour': chemin|None,
        'referentiels': [chemins], 'rapport': [lignes], 'manque': [str]}
    """
    result = {'regles': None, 'types de jour': None, 'referentiels': [],
              'rapport': [], 'manque': []}
    for path in paths:
        name = str(path).rsplit('/', 1)[-1]
        kind = identify_file(path)
        if kind == 'regles' and result['regles'] is None:
            result['regles'] = path
            result['rapport'].append("%s → export des règles GTA" % name)
        elif kind == 'regles':
            result['rapport'].append("%s → second export de règles, ignoré : "
                                     "un dossier couvre un seul environnement" % name)
        elif kind == 'types de jour' and result['types de jour'] is None:
            result['types de jour'] = path
            result['rapport'].append("%s → export des types de jour" % name)
        elif kind == 'types de jour':
            result['rapport'].append("%s → second export de types de jour, ignoré" % name)
        elif kind == 'referentiel':
            family = guess_family(path)
            result['referentiels'].append(path)
            if family:
                result['rapport'].append("%s → référentiel « %s »" % (name, family))
            else:
                result['rapport'].append(
                    "%s → référentiel de famille inconnue : renommer le fichier avec le nom "
                    "de la famille (taux, fonctions, activites…) pour qu'il soit exploité" % name)
        else:
            result['rapport'].append("%s → non reconnu, ignoré" % name)
    if not result['regles']:
        result['manque'].append("l'export des règles GTA, sans lequel rien ne peut être produit")
    if not result['types de jour']:
        result['manque'].append("l'export des types de jour : sans lui les journées "
                                "apparaîtront sous forme d'identifiants")
    return result
