"""Audit indexed files and optional history without printing secret values."""
import argparse
import re
import subprocess
from pathlib import PurePosixPath

parser = argparse.ArgumentParser()
parser.add_argument('--history', action='store_true')
args = parser.parse_args()

def git(*arguments):
    return subprocess.check_output(['git', *arguments])

patterns = [
    re.compile(rb'-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----'),
    re.compile(rb'\bgh[pousr]_[A-Za-z0-9]{30,}\b'),
    re.compile(rb'\bgithub_pat_[A-Za-z0-9_]{50,}\b'),
    re.compile(rb'\bAKIA[A-Z0-9]{16}\b'),
    re.compile(rb'\bxox[baprs]-[A-Za-z0-9-]{20,}\b'),
]

def forbidden(path):
    p = PurePosixPath(path)
    name = p.name.lower()
    return (
        (name.startswith('.env') and name != '.env.example')
        or (name.endswith('.env') and name != '.env.example')
        or name.endswith(('.pem', '.key', '.pfx', '.p12', '.sqlite', '.db', '.dump', '.archive'))
        or name in ('admin-credentials.json', 'credentials.json', 'id_rsa', 'id_ed25519')
        or any(part in ('.deployment', '.validation', '.aws', '.ssh', 'node_modules') for part in p.parts)
    )

failures = set()
blobs = set()
for entry in filter(None, git('ls-files', '-s', '-z').split(b'\0')):
    metadata, path = entry.split(b'\t', 1)
    mode, oid, _ = metadata.decode().split()
    path = path.decode('utf-8', errors='replace')
    if mode == '160000':
        failures.add(('embedded Git repository', path))
    blobs.add((oid, path))
if args.history:
    for line in git('rev-list', '--objects', '--all').decode().splitlines():
        oid, _, path = line.partition(' ')
        if path:
            blobs.add((oid, path))
batch = subprocess.Popen(['git', 'cat-file', '--batch'], stdin=subprocess.PIPE, stdout=subprocess.PIPE)
try:
    for oid, path in sorted(blobs):
        if forbidden(path):
            failures.add(('sensitive/generated path', path))
        batch.stdin.write(oid.encode() + b'\n')
        batch.stdin.flush()
        header = batch.stdout.readline().split()
        if len(header) != 3:
            raise RuntimeError('Cannot read Git object')
        data = batch.stdout.read(int(header[2]))
        batch.stdout.read(1)
        if header[1] == b'blob' and any(pattern.search(data) for pattern in patterns):
            failures.add(('credential pattern', path))
finally:
    batch.stdin.close()
    batch.wait()
for reason, path in sorted(failures):
    print(f'BLOCKED: {reason}: {path}')
if failures:
    raise SystemExit(1)
print(f'Secret/path audit passed for {len(blobs)} indexed/historical objects. '
      'Pattern scanning complements manual review; it cannot prove arbitrary credentials absent.')
