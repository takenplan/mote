import json
import os
from pathlib import Path
import sqlite3
import socket
import subprocess
import sys
import tempfile
import threading
import unittest
import uuid
from mote_execution_facts import ExecutionFacts


class ExecutionFactsTest(unittest.TestCase):
    def test_incompatible_schema_is_rejected_before_recovering_or_accepting_work(self):
        # A retained model directory can outlive a fresh Central profile. Its
        # obsolete receipt table must not advertise a usable media worker.
        for populated in (False, True):
            with self.subTest(populated=populated), tempfile.TemporaryDirectory() as directory:
                path = Path(directory, 'generated.sqlite')
                with sqlite3.connect(path) as db:
                    db.execute('''CREATE TABLE facts(request_id TEXT PRIMARY KEY,
                        scope TEXT NOT NULL,incarnation TEXT NOT NULL,stage TEXT NOT NULL,
                        state TEXT NOT NULL,accepted_at INTEGER NOT NULL,started_at INTEGER,
                        finished_at INTEGER,outcome TEXT)''')
                    if populated:
                        db.execute("INSERT INTO facts VALUES(?,?,?,'ocr','running',1,2,NULL,NULL)",
                                   (str(uuid.uuid4()), 'a' * 64, str(uuid.uuid4())))
                before = path.read_bytes()
                with self.assertRaisesRegex(ValueError, '^Incompatible media execution facts schema$'):
                    ExecutionFacts(directory, 'generated')
                self.assertEqual(path.read_bytes(), before, 'rejection must preserve existing physical outcomes')
                # A rejected constructor releases ownership so the operator can
                # inspect/reset the store; it must fail for the same reason.
                with self.assertRaisesRegex(ValueError, '^Incompatible media execution facts schema$'):
                    ExecutionFacts(directory, 'generated')

    def test_current_column_names_with_wrong_constraints_or_order_are_rejected(self):
        definitions = [
            'request_id TEXT PRIMARY KEY', 'scope_hash TEXT NOT NULL', 'incarnation TEXT',
            'stage TEXT', 'state TEXT NOT NULL', 'accepted_at INTEGER', 'started_at INTEGER',
            'finished_at INTEGER', 'outcome TEXT', 'failure_code TEXT',
        ]
        for changed in ('order', 'nullability', 'type', 'primary_key'):
            with self.subTest(changed=changed), tempfile.TemporaryDirectory() as directory:
                columns = definitions.copy()
                if changed == 'order':
                    columns[2], columns[3] = columns[3], columns[2]
                elif changed == 'nullability':
                    columns[2] += ' NOT NULL'
                elif changed == 'type':
                    columns[5] = 'accepted_at TEXT'
                else:
                    columns[0] = 'request_id TEXT'
                path = Path(directory, 'generated.sqlite')
                with sqlite3.connect(path) as db:
                    db.execute('CREATE TABLE facts(' + ','.join(columns) + ')')
                before = path.read_bytes()
                with self.assertRaisesRegex(ValueError, '^Incompatible media execution facts schema$'):
                    ExecutionFacts(directory, 'generated')
                self.assertEqual(path.read_bytes(), before)

    def test_actual_workers_exit_before_listening_with_incompatible_receipts(self):
        for worker, option, name in [('ocr-server.py', '--model-root', 'ocr'),
                                     ('transcription-server.py', '--model', 'asr')]:
            with self.subTest(worker=worker), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                facts = root / 'execution-facts'
                facts.mkdir()
                path = facts / (name + '.sqlite')
                with sqlite3.connect(path) as db:
                    db.execute('CREATE TABLE facts(request_id TEXT PRIMARY KEY,state TEXT NOT NULL,outcome TEXT)')
                before = path.read_bytes()
                with socket.socket() as reservation:
                    reservation.bind(('127.0.0.1', 0))
                    port = reservation.getsockname()[1]
                child = subprocess.Popen(
                    [sys.executable, str(Path(__file__).with_name(worker)), option,
                     str(root / 'model'), '--port', str(port)],
                    env={**os.environ, 'MOTE_MEDIA_WORKER_TOKEN': 'generated-worker-token'},
                    stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                try:
                    stdout, stderr = child.communicate(timeout=5)
                except subprocess.TimeoutExpired:
                    child.kill()
                    child.communicate()
                    self.fail('Worker accepted incompatible receipt storage instead of exiting')
                self.assertNotEqual(child.returncode, 0)
                self.assertIn(b'ValueError: Incompatible media execution facts schema', stderr)
                self.assertEqual(stdout, b'')
                with socket.socket() as probe:
                    self.assertNotEqual(probe.connect_ex(('127.0.0.1', port)), 0)
                self.assertEqual(path.read_bytes(), before)

    def test_identity_terminal_erasure_and_restart(self):
        with tempfile.TemporaryDirectory() as directory:
            facts = ExecutionFacts(directory, 'generated')
            request_id, scope = str(uuid.uuid4()), 'a' * 64
            starts = []
            threads = [threading.Thread(target=lambda: starts.append(facts.begin(request_id, scope, 'ocr'))) for _ in range(12)]
            for thread in threads:
                thread.start()
            for thread in threads:
                thread.join()
            self.assertEqual(starts.count(True), 1)
            self.assertFalse(facts.begin(request_id, 'b' * 64, 'ocr'))
            facts.started(request_id)
            running = facts.read(request_id, scope)
            self.assertEqual(running['state'], 'running')
            self.assertEqual(facts.read(request_id, 'b' * 64)['state'], 'unknown')
            self.assertFalse(facts.erase(request_id, scope))
            facts.close()
            restarted = ExecutionFacts(directory, 'generated')
            try:
                old = restarted.read(request_id, scope)
                self.assertEqual(old['state'], 'unknown')
                self.assertEqual(old['incarnation'], running['incarnation'])
                self.assertNotEqual(old['incarnation'], restarted.incarnation)
                self.assertEqual(old['outcome'], 'worker_restarted')
                self.assertFalse(restarted.erase(request_id, scope))
                self.assertFalse(restarted.begin(request_id, scope, 'ocr'))
                completed = str(uuid.uuid4())
                self.assertTrue(restarted.begin(completed, scope, 'ocr'))
                restarted.started(completed)
                restarted.finish(completed, False, 'processing_timeout')
                restarted.finish(completed, True)
                receipt = restarted.read(completed, scope)
                self.assertEqual(receipt['state'], 'failed')
                self.assertEqual(receipt['failureCode'], 'processing_timeout')
                self.assertEqual(set(receipt), {'version', 'requestId', 'incarnation', 'stage', 'state', 'acceptedAt', 'startedAt', 'finishedAt', 'outcome', 'failureCode'})
                self.assertTrue(restarted.erase(completed, scope))
                self.assertEqual(restarted.read(completed, scope)['state'], 'unknown')
                self.assertFalse(restarted.begin(completed, scope, 'ocr'), 'erasing detail must preserve consumed identity')
                self.assertFalse(restarted.begin(completed, 'b' * 64, 'ocr'))
                self.assertEqual(Path(directory).stat().st_mode & 0o777, 0o700)
                self.assertEqual(Path(directory, 'generated.sqlite').stat().st_mode & 0o777, 0o600)
                self.assertNotIn('text', json.dumps(receipt))
                with sqlite3.connect(restarted.path) as db:
                    tombstone = db.execute('SELECT * FROM facts WHERE request_id=?', (completed,)).fetchone()
                    self.assertEqual(tombstone[4], 'erased')
                    self.assertTrue(all(value is None for value in tombstone[2:4] + tombstone[5:]))
            finally:
                restarted.close()

    def test_private_paths_and_single_service_writer(self):
        with tempfile.TemporaryDirectory() as directory:
            facts = ExecutionFacts(directory, 'generated')
            try:
                with self.assertRaises((OSError, ValueError)):
                    ExecutionFacts(directory, 'generated')
            finally:
                facts.close()
            link = Path(directory, 'linked')
            link.symlink_to(directory, target_is_directory=True)
            with self.assertRaises(ValueError):
                ExecutionFacts(link, 'other')
            with tempfile.NamedTemporaryFile() as target:
                Path(directory, 'unsafe.sqlite').symlink_to(target.name)
                with self.assertRaises(OSError):
                    ExecutionFacts(directory, 'unsafe')


if __name__ == '__main__':
    unittest.main()
