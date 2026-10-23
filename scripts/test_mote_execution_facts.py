import json
import os
from pathlib import Path
import sqlite3
import tempfile
import threading
import unittest
import uuid
from mote_execution_facts import ExecutionFacts


class ExecutionFactsTest(unittest.TestCase):
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
