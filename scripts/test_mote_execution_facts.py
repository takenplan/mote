import json
import tempfile
import threading
import unittest
import uuid
from pathlib import Path
from mote_execution_facts import ExecutionFacts


class ExecutionFactsTest(unittest.TestCase):
    def test_duplicate_identity_scope_restart_and_no_content(self):
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
            facts.started(request_id)
            active = facts.read(request_id, scope)
            self.assertEqual(active['state'], 'running')
            self.assertEqual(facts.read(request_id, 'b' * 64)['state'], 'unknown')
            facts.close()
            restarted = ExecutionFacts(directory, 'generated')
            old = restarted.read(request_id, scope)
            self.assertEqual(old['state'], 'unknown')
            self.assertEqual(old['incarnation'], active['incarnation'])
            self.assertNotEqual(old['incarnation'], restarted.incarnation)
            self.assertEqual(old['outcome'], 'worker_restarted')
            self.assertFalse(restarted.begin(request_id, scope, 'ocr'))
            completed = str(uuid.uuid4())
            self.assertTrue(restarted.begin(completed, scope, 'ocr'))
            restarted.started(completed)
            restarted.finish(completed, True)
            restarted.finish(completed, False)
            receipt = restarted.read(completed, scope)
            self.assertEqual(receipt['state'], 'succeeded')
            self.assertEqual(set(receipt), {'version', 'requestId', 'incarnation', 'stage', 'state', 'acceptedAt', 'startedAt', 'finishedAt', 'outcome'})
            self.assertEqual(Path(directory, 'generated.sqlite').stat().st_mode & 0o777, 0o600)
            self.assertNotIn('text', json.dumps(receipt))
            restarted.close()


if __name__ == '__main__':
    unittest.main()
