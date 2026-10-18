"""Persistent, content-free execution facts. This is not a work queue/cache.

Only the authenticated worker handler creates facts after acquiring its physical
slot. A former incarnation's unfinished fact stays unknown: a restart cannot
prove that an audio subprocess or a request in another process stopped.
"""
import os
import re
import sqlite3
import threading
import time
import uuid
import fcntl
from pathlib import Path


class ExecutionFacts:
    def __init__(self, directory, role):
        directory = Path(directory)
        directory.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.path = directory / (role + '.sqlite')
        self.owner = open(directory / (role + '.lock'), 'a')
        os.chmod(self.owner.name, 0o600)
        # Never let another live listener reinterpret this owner's running fact.
        fcntl.flock(self.owner, fcntl.LOCK_EX | fcntl.LOCK_NB)
        self.incarnation = str(uuid.uuid4())
        self.lock = threading.Lock()
        with self.connect() as db:
            db.execute('CREATE TABLE IF NOT EXISTS facts(request_id TEXT PRIMARY KEY, scope TEXT NOT NULL, incarnation TEXT NOT NULL, stage TEXT NOT NULL, state TEXT NOT NULL, accepted_at INTEGER NOT NULL, started_at INTEGER, finished_at INTEGER, outcome TEXT)')
            db.execute("UPDATE facts SET state='unknown',outcome='worker_restarted' WHERE state IN ('accepted','running')")
        os.chmod(self.path, 0o600)

    def close(self):
        self.owner.close()

    def connect(self):
        return sqlite3.connect(self.path, timeout=10)

    @staticmethod
    def identity(request_id, scope):
        return bool(re.fullmatch(r'[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}', request_id or '') and re.fullmatch(r'[a-f0-9]{64}', scope or ''))

    def read(self, request_id, scope):
        with self.connect() as db:
            db.row_factory = sqlite3.Row
            row = db.execute('SELECT * FROM facts WHERE request_id=? AND scope=?', (request_id, scope)).fetchone()
        if row is None:
            return {'version': 1, 'requestId': request_id, 'state': 'unknown', 'outcome': 'receipt_unavailable'}
        fields = {'request_id': 'requestId', 'incarnation': 'incarnation', 'stage': 'stage', 'state': 'state', 'accepted_at': 'acceptedAt', 'started_at': 'startedAt', 'finished_at': 'finishedAt', 'outcome': 'outcome'}
        return {'version': 1, **{name: row[key] for key, name in fields.items() if row[key] is not None}}

    def begin(self, request_id, scope, stage):
        # Serialize lookup+insert across HTTP threads. The model slot itself is
        # owned by the handler semaphore and is never queued in this journal.
        with self.lock, self.connect() as db:
            if db.execute('SELECT 1 FROM facts WHERE request_id=?', (request_id,)).fetchone():
                return False
            db.execute("INSERT INTO facts VALUES(?,?,?,?,'accepted',?,NULL,NULL,NULL)", (request_id, scope, self.incarnation, stage, int(time.time() * 1000)))
            return True

    def started(self, request_id):
        with self.connect() as db:
            db.execute("UPDATE facts SET state='running',started_at=? WHERE request_id=? AND incarnation=? AND state='accepted'", (int(time.time() * 1000), request_id, self.incarnation))

    def finish(self, request_id, succeeded):
        with self.connect() as db:
            db.execute('UPDATE facts SET state=?,finished_at=?,outcome=? WHERE request_id=? AND incarnation=? AND state IN (\'accepted\',\'running\')', ('succeeded' if succeeded else 'failed', int(time.time() * 1000), 'completed' if succeeded else 'processing_failed', request_id, self.incarnation))

    def erase(self, request_id, scope):
        with self.lock, self.connect() as db:
            row = db.execute('SELECT state FROM facts WHERE request_id=? AND scope=?', (request_id, scope)).fetchone()
            if row and row[0] in ('accepted', 'running'):
                return False
            # Missing is an idempotent erasure, never non-execution evidence.
            db.execute('DELETE FROM facts WHERE request_id=? AND scope=?', (request_id, scope))
            return True


def execution_status(handler, facts):
    """Authenticated callers only; this helper never performs execution."""
    if not handler.path.startswith('/executions/'):
        return False
    request_id = handler.path[len('/executions/'):]
    scope = handler.headers.get('X-Mote-Request-Scope', '')
    if not facts.identity(request_id, scope):
        handler.send_error(400)
    else:
        handler.json_response(facts.read(request_id, scope))
    return True


def erase_execution(handler, facts):
    request_id = handler.path[len('/executions/'):] if handler.path.startswith('/executions/') else ''
    scope = handler.headers.get('X-Mote-Request-Scope', '')
    if not facts.identity(request_id, scope):
        handler.send_error(400)
    elif not facts.erase(request_id, scope):
        handler.send_error(409)
    else:
        handler.json_response({'version': 1, 'requestId': request_id, 'deleted': True})
