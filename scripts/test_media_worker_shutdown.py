"""Owned recognizer shutdown must also reap its normalization subprocess."""
import importlib.util
import multiprocessing
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import time
import unittest

spec = importlib.util.spec_from_file_location('media_transcription', Path(__file__).with_name('transcription-server.py'))
server = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server)


def generated_recognizer(folder):
    os.setsid()
    code = "import os,signal,time;from pathlib import Path;signal.signal(signal.SIGTERM,lambda *_:None);Path('ready').write_text(str(os.getpid()));time.sleep(0.8);Path('late').write_text('late');time.sleep(30)"
    subprocess.Popen([sys.executable, '-c', code], cwd=folder, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(30)


@unittest.skipUnless(hasattr(os, 'setsid'), 'POSIX process groups')
class MediaShutdownTests(unittest.TestCase):
    def test_parent_exit_does_not_leave_normalization_child_running(self):
        with tempfile.TemporaryDirectory(prefix='mote-owned-media-') as folder:
            worker = multiprocessing.get_context('spawn').Process(target=generated_recognizer, args=(folder,))
            worker.start()
            pid = None
            try:
                for _ in range(200):
                    ready = Path(folder, 'ready')
                    if ready.exists():
                        pid = int(ready.read_text())
                        break
                    time.sleep(0.01)
                self.assertIsNotNone(pid)
                server.stop_recognizer(worker)
                self.assertFalse(worker.is_alive())
                time.sleep(1)
                self.assertFalse(Path(folder, 'late').exists())
            finally:
                server.stop_recognizer(worker)
                if pid:
                    try:
                        os.kill(pid, signal.SIGKILL)
                    except ProcessLookupError:
                        pass


if __name__ == '__main__':
    unittest.main()
