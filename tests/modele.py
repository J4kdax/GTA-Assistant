"""Contrat du modèle d'environnement (engine/model.py), sur exports synthétiques.

Le modèle est ce que lisent tous les onglets de l'Atelier : un champ renommé
ou disparu casse l'interface sans erreur Python. Ce test fige sa forme.

python3 tests/modele.py   → code de sortie non nul en cas d'échec.
"""
import json
import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'engine'))
import robustesse as R                      # noqa: E402  (fabrique d'exports)
from model import build_model, rule_dependencies   # noqa: E402

RULE_KEYS = {'id', 'rule_type', 'libelle', 'libelle_court', 'libelle_court_lignes', 'code',
             'ordre', 'compteur', 'periode', 'affectations', 'parametres', 'regle_manuelle',
             'affect_regle_manuelle', 'calcul_budget', 'affiche_diese', 'sa_ordre_technique',
             'deps', 'description', 'repli', 'contrats'}
TOP_KEYS = {'moteur', 'genere_le', 'format', 'anomalies', 'diagnostic', 'diagnostic_texte',
            'regles', 'references_cassees', 'contrats', 'types_jour', 'audit', 'referentiels'}
DAY_KEYS = {'id', 'libelle', 'libelle_court', 'categorie', 'actif', 'duree_min', 'ordre',
            'hex_bg', 'hex_fg', 'regles'}

CHECKS = []


def check(fn):
    CHECKS.append(fn)
    return fn


def model(tmp, rows=R.ROWS, daytypes=True):
    rules = R.write(tmp, 'm_rules.xlsx', R.frame(R.FR, rows))
    days = None
    if daytypes:
        days = R.write(tmp, 'm_days.xlsx', sheets={'Export DIESE': R.table(**{
            '#': [7, 25], 'Intitulé public': ['Travail', 'Campo presté'],
            'Intitulé court public': ['TR', 'CP'],
            'Absence': ['Temps de travail effectif', 'Absence (non comptabilisée)'],
            'Couleur': ['<span style="background-color:#87CEFA;color:#000000">x</span>', ''],
            'Actif': [1, 0], 'Durée défaut (min.)': [420, None]})})
    return build_model(rules, days)


@check
def forme_du_modele(tmp):
    m = model(tmp)
    assert set(m) == TOP_KEYS, set(m) ^ TOP_KEYS
    for r in m['regles']:
        assert set(r) == RULE_KEYS, set(r) ^ RULE_KEYS
        assert r['description']['fr'] and r['description']['en']
    for d in m['types_jour']:
        assert set(d) == DAY_KEYS, set(d) ^ DAY_KEYS
    json.dumps(m)                                           # sérialisable tel quel


@check
def ordre_execution_et_dependances(tmp):
    m = model(tmp)
    assert [r['id'] for r in m['regles']] == [2, 1, 3]
    deps = {r['id']: r['deps'] for r in m['regles']}
    assert deps[1] == [2] and deps[2] == [] and deps[3] == []


@check
def contrats_et_types_de_jour(tmp):
    m = model(tmp)
    titles = {c['cle']: c['titre'] for c in m['contrats']}
    assert set(titles.values()) == {'TECH_16', 'CDI adm'}, titles
    by = {r['id']: r for r in m['regles']}
    assert len(by[1]['contrats']) == 2 and len(by[2]['contrats']) == 1 and by[3]['contrats'] == []
    days = {d['id']: d for d in m['types_jour']}
    assert days[7]['hex_bg'] == '#87CEFA' and days[7]['regles'] == 1 and days[25]['regles'] == 0
    assert days[25]['actif'] is False


@check
def audit(tmp):
    rows = R.ROWS + [[4, '_039_STD_GTA_Formula', '_039_STD_GTA_Formula : rule99+rule', 'Cassée',
                      '', '', 50, 0, None, 'CDI adm (#7)', 1]]
    m = model(tmp, rows)
    codes = {f['code']: f for f in m['audit']['a_corriger'] + m['audit']['a_savoir']}
    assert codes['references_cassees']['ids'] == [4]
    assert codes['reference_incomplete']['ids'] == [4]
    assert codes['replis']['ids'] == [3]
    assert codes['sans_affectation']['ids'] == [3]
    assert codes['types_jour_inutilises']['ids'] == [25]
    assert m['references_cassees'] == [{'id': 4, 'cibles': [99]}]


@check
def libelles_de_parametre_ne_sont_pas_des_references(tmp):
    params = 'Source rule* : 12\nRule(s)* : 3, 4\nRègle(s) à additionner : 7'
    assert rule_dependencies(params, 1) == [3, 4, 7, 12]
    rows = [[5, '_124_STD_IND_Total_Rule', 'Source rule* : 2', 'Total', '', '', 1, 0, None, '', 1],
            R.ROWS[1]]
    m = model(tmp, rows)
    codes = {f['code'] for f in m['audit']['a_corriger']}
    assert 'reference_incomplete' not in codes, codes


@check
def sans_types_de_jour(tmp):
    m = model(tmp, daytypes=False)
    assert m['types_jour'] == []
    assert not any(f['code'] == 'types_jour_inutilises' for f in m['audit']['a_savoir'])


if __name__ == '__main__':
    failures = 0
    with tempfile.TemporaryDirectory() as tmp:
        for fn in CHECKS:
            try:
                fn(tmp)
                print('ok     %s' % fn.__name__)
            except Exception as exc:
                failures += 1
                print('ÉCHEC  %s — %s: %s' % (fn.__name__, type(exc).__name__, exc))
    print('%d contrôles, %d échec(s)' % (len(CHECKS), failures))
    sys.exit(1 if failures else 0)
