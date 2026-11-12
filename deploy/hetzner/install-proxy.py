"""Prepare or install an additive Caddy site; validate candidate before --apply."""
from pathlib import Path
import shutil
import sys

root = Path(__file__).resolve().parents[2]
target = Path('/home/shahab/apps/pinewoodcode/Caddyfile')
before = root / 'Caddyfile.before-parley'
candidate = root / 'Caddyfile.with-parley'
marker = '# BEGIN PARLEY PREVIEW'
if '--apply' in sys.argv:
    if not candidate.exists() or not before.exists():
        raise SystemExit('Prepare and validate candidate first.')
    if target.read_bytes() != before.read_bytes():
        raise SystemExit('Proxy config changed since preparation; refusing overwrite.')
    # Preserve the inode for the existing read-only file bind mount.
    target.write_bytes(candidate.read_bytes())
    print('Installed additive Parley site; reload Caddy next.')
else:
    if before.exists() or candidate.exists() or marker in target.read_text():
        raise SystemExit('Existing Parley proxy files found; inspect before repeating.')
    shutil.copy2(target, before)
    candidate.write_text(target.read_text() + '\n' + (root / 'deploy/hetzner/Caddyfile.site').read_text())
    print('Prepared Caddy candidate and preserved original.')
