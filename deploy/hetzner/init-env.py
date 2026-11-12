"""Generate deployment-only secrets on the server, refusing to overwrite them."""
import base64
import os
from pathlib import Path
import secrets

root = Path(__file__).resolve().parents[2]
path = root / '.env'
origin = 'https://parley.178-104-162-246.sslip.io'
values = {
    'NODE_ENV': 'production', 'LOG_LEVEL': 'warn',
    'MONGO_ROOT_USERNAME': 'parley', 'MONGO_DATABASE': 'parley',
    'RABBITMQ_USERNAME': 'parley',
    'TURN_REALM': 'parley.178-104-162-246.sslip.io',
    'TURN_EXTERNAL_IP': '178.104.162.246',
    'TURN_URLS': 'turn:178.104.162.246:3478?transport=udp,turn:178.104.162.246:3478?transport=tcp',
    'STUN_URLS': 'stun:178.104.162.246:3478',
    'FRONTEND_ORIGIN': origin, 'NEXT_PUBLIC_API_BASE_URL': origin,
    'TERMS_VERSION': '2026-10-28', 'COOKIE_SECURE': 'true',
    'RATE_LIMIT_MULTIPLIER': '1', 'TRUST_PROXY': '172.19.0.3/32',
    'PAYMENT_PROVIDER': 'none', 'ADULT_CHAT_ENABLED': 'false',
    'SMTP_HOST': 'mailpit', 'SMTP_PORT': '1025', 'SMTP_SECURE': 'false',
    'EMAIL_FROM': 'Parley <no-reply@parley.local>',
}
for name in ('MONGO_ROOT_PASSWORD', 'REDIS_PASSWORD', 'RABBITMQ_PASSWORD',
             'TURN_SECRET', 'JWT_SECRET', 'HASH_SECRET'):
    values[name] = secrets.token_hex(32)
values['TOTP_ENCRYPTION_KEY'] = base64.b64encode(secrets.token_bytes(32)).decode()
fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(fd, 'w') as output:
    output.write(''.join(f'{key}={value}\n' for key, value in values.items()))
print('Created deployment .env with fresh secrets (not printed).')
