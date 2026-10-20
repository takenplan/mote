"""Independent R05 input/oracle freeze. Run before reading any candidate plugin."""
import datetime, hashlib, json, os, pathlib, random, subprocess

ROOT = pathlib.Path('/workspace/scratch/8d97506698dc/evaluator-r5')
CHECKOUT = pathlib.Path('/workspace/scratch/8d97506698dc/mote-round5')
SPEC = json.loads((CHECKOUT / 'docs/validation/plugin-extension-benchmark/cases.json').read_text())
BASE = SPEC['fixtures']['finance-visible-v1']
seed = os.urandom(32)
(ROOT / 'private-seed.hex').write_text(seed.hex() + '\n')

def digest(data):
    return hashlib.sha256(data).hexdigest()

def make_variant(label):
    rng = random.Random(int.from_bytes(hashlib.sha256(seed + label.encode()).digest(), 'big'))
    rename = {row['transactionId']: 'tx-' + f'{rng.getrandbits(64):016x}' for row in BASE['canonicalTransactions']}
    source_names = {name: 'source-' + f'{rng.getrandbits(48):012x}' for name in ('source-bank', 'source-notice', 'source-email')}
    transactions = []
    for raw in BASE['canonicalTransactions']:
        row = dict(raw)
        row['transactionId'] = rename[raw['transactionId']]
        magnitude = abs(raw['amountCents']) + rng.randint(31, 777)
        row['amountCents'] = -magnitude if raw['transactionType'] == 'refund' else magnitude
        row['merchant'] = 'Merchant ' + f'{rng.getrandbits(32):08x}'
        if 'refundOf' in row:
            # A different explicit charge identity exercises reference fidelity, independent of amount.
            target = 'P07' if raw['transactionId'] == 'R01' else 'P12'
            row['refundOf'] = rename[target]
        if raw['transactionId'] == 'P01': row['postedAt'] = '2026-09-01T00:00:00Z'
        if raw['transactionId'] == 'P18': row['postedAt'] = '2026-09-30T23:59:59Z'
        if raw['transactionId'] == 'P19': row['postedAt'] = '2026-09-07T00:00:00Z'
        if raw['transactionId'] == 'P20': row['postedAt'] = '2026-08-31T23:59:59Z'
        if raw['transactionId'] == 'P21': row['postedAt'] = '2026-10-01T00:00:00Z'
        transactions.append(row)
    by_id = {t['transactionId']: t for t in transactions}
    observations = []
    for raw in BASE['observations']:
        row = {'observationId': 'obs-' + f'{rng.getrandbits(64):016x}', 'sourceId': source_names[raw['sourceId']], 'sourceKind': raw['sourceId'].removeprefix('source-'), 'transactionId': rename.get(raw['transactionId'])}
        if row['transactionId'] is None:
            row['text'] = f"Synthetic {row['sourceKind']} observation {row['observationId']}: this is a generated nontransaction notice."
        else:
            t = by_id[row['transactionId']]
            # Exact generated text supplies semantic evidence. Normalization comes solely from this independently frozen mapping.
            row['text'] = '\n'.join([f"Synthetic {row['sourceKind']} observation {row['observationId']}", json.dumps(t, sort_keys=True)])
        observations.append(row)
    rng.shuffle(observations)
    in_month = [t for t in transactions if '2026-09-01T00:00:00Z' <= t['postedAt'] < '2026-10-01T00:00:00Z']
    payments = [t for t in in_month if t['amountCents'] >= 0]
    refunds = [t for t in in_month if t['amountCents'] < 0]
    grouped = {t['transactionId']: sorted(o['observationId'] for o in observations if o['transactionId'] == t['transactionId']) for t in transactions}
    expected = {
        'month': '2026-09', 'currency': 'USD', 'totalObservations': len(observations),
        'uniqueTransactions': len(transactions), 'noiseObservations': sum(o['transactionId'] is None for o in observations),
        'repeatedObservations': sum(o['transactionId'] is not None for o in observations) - len(transactions),
        'monthlyCharges': len(payments), 'monthlyRefunds': len(refunds),
        'grossCents': sum(t['amountCents'] for t in payments),
        'refundCents': -sum(t['amountCents'] for t in refunds),
        'netCents': sum(t['amountCents'] for t in in_month),
        'ledgerIds': sorted(t['transactionId'] for t in in_month),
        'allTransactionIds': sorted(by_id), 'observationIdsByTransaction': grouped,
        'refundOfById': {t['transactionId']: t['refundOf'] for t in refunds},
        'pageLimit': 7,
        'sourceObservationCounts': {sid: sum(o['sourceId'] == sid for o in observations) for sid in source_names.values()},
        'sourceMinimumPages': {sid: (sum(o['sourceId'] == sid for o in observations) + 6) // 7 for sid in source_names.values()},
    }
    assert expected['totalObservations'] == 43 and expected['uniqueTransactions'] == 23
    assert expected['noiseObservations'] == 4 and expected['repeatedObservations'] == 16
    assert expected['monthlyCharges'] == 19 and expected['monthlyRefunds'] == 2
    assert expected['netCents'] != 83335
    return {'label': label, 'transactions': transactions, 'observations': observations, 'sources': source_names, 'expected': expected}

variants = {name: make_variant(name) for name in ('final-initial', 'reserve-repair-1', 'reserve-repair-2')}
payload = (json.dumps(variants, indent=2, sort_keys=True) + '\n').encode()
(ROOT / 'private-held-oracles.json').write_bytes(payload)
public_paths = ('AGENTS.md', 'docs/validation/plugin-extension-benchmark/plan.md', 'docs/validation/plugin-extension-benchmark/cases.json', 'docs/plugin-authoring.md')
manifest = {
    'round': 'R05', 'phase': 'ORACLE_FROZEN_BEFORE_ITERATOR',
    'createdAtUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'candidateCommit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=CHECKOUT, text=True).strip(),
    'seedSha256': digest(seed), 'heldOracleSha256': digest(payload),
    'generatorSha256': digest(pathlib.Path(__file__).read_bytes()),
    'publicInputsSha256': {p: digest((CHECKOUT / p).read_bytes()) for p in public_paths},
    'beforeFreezeReads': list(public_paths) + ['git rev-parse HEAD'],
    'candidatePluginInspected': False, 'priorTrialImplementationInspected': False,
    'hiddenBehaviors': ['renamed exact IDs', 'bounded integer cents', 'permuted arrival order', 'explicit changed refund reference', 'same UTC month boundary', 'pagination limit 7'],
    'variants': list(variants),
    'expectedOutcomesDerivedFrom': 'Frozen public canonical transactions, transformed independently before implementation inspection; never plugin results.',
    'calibrationPlan': ['actual installed positive publication', 'actual plausible success without publication', 'actual hardcoded-visible publication against changed input', 'synthetic forbidden core diff', 'actual foreign-owner request', 'actual held/stop stale-publication attempt'],
}
(ROOT / 'seed-commitment.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps(manifest, indent=2))
