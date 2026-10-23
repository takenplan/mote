"""Content-free, authenticated execution facts for managed media workers."""
import hashlib
from contextlib import contextmanager
import os
from pathlib import Path
import re
import sqlite3
import stat
import threading
import time
import uuid


class ExecutionFacts:
    def __init__(self, directory, name):
        root = Path(directory)
        root.mkdir(mode=0o700, parents=True, exist_ok=True)
        info = root.lstat()
        if not stat.S_ISDIR(info.st_mode) or (hasattr(os, 'getuid') and info.st_uid != os.getuid()):
            raise ValueError('Unsafe execution facts directory')
        os.chmod(root, 0o700)
        self.path = root / (name + '.sqlite')
        self.lock = threading.Lock()
        self.incarnation = str(uuid.uuid4())
        self.owner = self.private_file(root / (name + '.lock'))
        try:
            if os.name == 'nt':
                import msvcrt
                self.owner.write(b'\0')
                self.owner.flush()
                self.owner.seek(0)
                msvcrt.locking(self.owner.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(self.owner, fcntl.LOCK_EX | fcntl.LOCK_NB)
            with self.private_file(self.path):
                pass
            with self.connect() as db:
                db.execute('''CREATE TABLE IF NOT EXISTS facts(
                    request_id TEXT PRIMARY KEY,scope_hash TEXT NOT NULL,incarnation TEXT,
                    stage TEXT,state TEXT NOT NULL,accepted_at INTEGER,started_at INTEGER,
                    finished_at INTEGER,outcome TEXT,failure_code TEXT)''')
                # A new service cannot prove what an old recognizer did.
                db.execute("UPDATE facts SET state='unknown',outcome='worker_restarted' WHERE state IN ('accepted','running')")
        except BaseException:
            self.owner.close()
            raise

    @staticmethod
    def private_file(path):
        flags = os.O_CREAT | os.O_RDWR | getattr(os, 'O_NOFOLLOW', 0)
        fd = os.open(path, flags, 0o600)
        try:
            info = os.fstat(fd)
            if not stat.S_ISREG(info.st_mode) or (hasattr(os, 'getuid') and info.st_uid != os.getuid()):
                raise ValueError('Unsafe execution facts file')
            if hasattr(os, 'fchmod'):
                os.fchmod(fd, 0o600)
            else:
                os.chmod(path, 0o600)
            return os.fdopen(fd, 'r+b')
        except BaseException:
            os.close(fd)
            raise

    def close(self):
        self.owner.close()

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path, timeout=10)
        try:
            db.execute('PRAGMA synchronous=FULL')
            with db:
                yield db
        finally:
            db.close()

    @staticmethod
    def identity(request_id, scope):
        return bool(re.fullmatch(r'[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}', request_id or '') and re.fullmatch(r'[a-f0-9]{64}', scope or ''))

    @staticmethod
    def scope_hash(scope):
        return hashlib.sha256(scope.encode()).hexdigest()

    def begin(self, request_id, scope, stage):
        if not self.identity(request_id, scope) or stage not in ('ocr', 'transcribe', 'diarize'):
            raise ValueError('Invalid execution identity')
        with self.lock, self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            # The request ID is globally unique in this worker store. Another
            # scope cannot reuse it, including after receipt erasure.
            if db.execute('SELECT 1 FROM facts WHERE request_id=?', (request_id,)).fetchone():
                return False
            db.execute("INSERT INTO facts VALUES(?,?,?,?,'accepted',?,NULL,NULL,NULL,NULL)",
                       (request_id, self.scope_hash(scope), self.incarnation, stage, int(time.time() * 1000)))
            return True

    def started(self, request_id):
        with self.connect() as db:
            changed = db.execute("UPDATE facts SET state='running',started_at=? WHERE request_id=? AND incarnation=? AND state='accepted'",
                                 (int(time.time() * 1000), request_id, self.incarnation)).rowcount
            if not changed:
                raise ValueError('Execution fact is no longer current')

    def finish(self, request_id, succeeded, failure_code='processing_failed'):
        if failure_code not in ('processing_failed', 'processing_timeout', 'unsupported_input'):
            raise ValueError('Invalid execution failure')
        with self.connect() as db:
            db.execute("UPDATE facts SET state=?,finished_at=?,outcome=?,failure_code=? WHERE request_id=? AND incarnation=? AND state IN ('accepted','running')",
                       ('succeeded' if succeeded else 'failed', int(time.time() * 1000), 'completed' if succeeded else 'processing_failed',
                        None if succeeded else failure_code, request_id, self.incarnation))

    def read(self, request_id, scope):
        with self.connect() as db:
            db.row_factory = sqlite3.Row
            row = db.execute('SELECT * FROM facts WHERE request_id=? AND scope_hash=?', (request_id, self.scope_hash(scope))).fetchone()
        if row is None or row['state'] == 'erased':
            return {'version': 1, 'requestId': request_id, 'state': 'unknown', 'outcome': 'receipt_unavailable'}
        fields = {'incarnation': 'incarnation', 'stage': 'stage', 'state': 'state', 'accepted_at': 'acceptedAt',
                  'started_at': 'startedAt', 'finished_at': 'finishedAt', 'outcome': 'outcome', 'failure_code': 'failureCode'}
        return {'version': 1, 'requestId': request_id, **{name: row[key] for key, name in fields.items() if row[key] is not None}}

    def erase(self, request_id, scope):
        with self.lock, self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            row = db.execute('SELECT state FROM facts WHERE request_id=? AND scope_hash=?', (request_id, self.scope_hash(scope))).fetchone()
            if row and row[0] in ('accepted', 'running', 'unknown'):
                return False
            # Keep only consumed identity. Erasing diagnostic detail must never
            # make an old POST eligible to execute a second time.
            db.execute("UPDATE facts SET state='erased',incarnation=NULL,stage=NULL,accepted_at=NULL,started_at=NULL,finished_at=NULL,outcome=NULL,failure_code=NULL WHERE request_id=? AND scope_hash=?",
                       (request_id, self.scope_hash(scope)))
            return True


def execution_status(handler, facts):
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
