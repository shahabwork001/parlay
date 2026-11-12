# Parley

Anonymous random video and text chat for adults, built for stability, strict moderation and full operator control.

This monorepo contains two independently built projects, each with its own docs and Docker setup. Original project Git histories are preserved in the root repository; use root Git commands for new work.

| Project | Stack | Docs |
| --- | --- | --- |
| [backend/](backend/) | Node.js 24, Express 5, TypeScript, Socket.IO, MongoDB, Redis, RabbitMQ, coturn | [backend/README.md](backend/README.md), [backend/FEATURES.md](backend/FEATURES.md) |
| [frontend/](frontend/) | Next.js 16, TypeScript, Tailwind, shadcn/ui | [frontend/README.md](frontend/README.md), [frontend/FEATURES.md](frontend/FEATURES.md) |

## Run everything
```bash
./scripts/dev-up.sh
```
On the first run it generates `backend/.env` (random secrets) and `frontend/.env`, then builds and starts MongoDB, Redis, RabbitMQ, coturn, Mailpit, the API, the workers and the frontend. The root `docker-compose.yml` only `include`s each project's own compose file.

## GitHub and delivery

Work on `dev`; promote reviewed production changes to `main` through PRs. The root `Jenkinsfile` runs CI for development/PRs and restricts production delivery to non-PR `main` builds. See [GitHub and Jenkins setup](docs/GITHUB_JENKINS.md) for publication, protection, credentials, webhook, exact-image deployment and rollback. Remote setup requires administrator access; preparation does not claim a deployment.
