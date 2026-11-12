"""Run production branch guards without Docker, credentials or network access."""
import os
from pathlib import Path
import shutil
import subprocess
import unittest

root = Path(__file__).resolve().parent.parent
bash = 'C:/Program Files/Git/bin/bash.exe' if os.name == 'nt' else shutil.which('bash')

class BranchGuards(unittest.TestCase):
    def test_non_production_builds_are_rejected(self):
        cases = [
            {'BRANCH_NAME': 'dev'},
            {'BRANCH_NAME': 'feature/video'},
            {'BRANCH_NAME': 'PR-1', 'CHANGE_ID': '1'},
            {'BRANCH_NAME': 'main', 'CHANGE_ID': '1'},
            {'BRANCH_NAME': 'main', 'TAG_NAME': 'main'},
            {},
        ]
        for script in ('scripts/build-release.sh', 'scripts/ship-release.sh'):
            for case in cases:
                with self.subTest(script=script, case=case):
                    environment = dict(os.environ)
                    for key in ('BRANCH_NAME', 'CHANGE_ID', 'TAG_NAME'):
                        environment.pop(key, None)
                    environment.update(case)
                    result = subprocess.run([bash, script], cwd=root, env=environment,
                                            capture_output=True, text=True)
                    self.assertNotEqual(result.returncode, 0)
                    self.assertIn('require', result.stderr)

    def test_invalid_remote_release_path_is_rejected(self):
        for path in ('/tmp', '/home/shahab/apps/parley-preview',
                     '/home/shahab/apps/parley-preview/releases/../../tmp'):
            with self.subTest(path=path):
                result = subprocess.run([bash, 'deploy/hetzner/deploy-release.sh', path],
                                        cwd=root, capture_output=True, text=True)
                self.assertNotEqual(result.returncode, 0)

if __name__ == '__main__':
    unittest.main()
