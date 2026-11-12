# GitHub, branches and Jenkins delivery

Repository: https://github.com/shahabwork001/parlay.git. This monorepo contains `backend/`, `frontend/`, shared Compose, deployment helpers and documentation. GitHub uses **parlay**; application/service names remain **Parley/parley**.

## Branch contract and history

Only two primary branches: `dev` for development and `main` for reviewed production releases. Work on `dev` or short-lived feature branches; open a PR from `dev` to `main`. CI runs on both branches and PRs. Only a branch build with `BRANCH_NAME=main`, no `CHANGE_ID`, and no `TAG_NAME` can build production images or enter production delivery. No staging environment is created. Never force-push or delete existing branches.

The root repository preserves both original project commit graphs as parents of an import commit, with committed files placed under their project directories. Nested `.git` directories are retained locally and excluded from publication. They are historical repositories, not submodules. Always run Git from the root for future work; a fresh clone has one repository. Existing application changes are carried on `dev`. The `main` bootstrap/import commit is **not certified production-ready** and contains no Jenkinsfile, so publishing that bootstrap alone cannot deploy. Promote tested `dev` through a reviewed PR only after the documented launch gates and Jenkins commissioning are complete. Initial branch publication is not a production release.

## Initial publication

Preparation on 2026-11-12 found no root Git repository, two repositories on `main`, no child remotes, and substantial uncommitted changes. GitHub metadata reported size 0/default `main`; connector permissions were `pull=true`, `push=false`. GitHub CLI authentication was invalid. No authenticated publication or GitHub settings update is claimed. Fetch immediately before publishing because remote state can change.

Use Git Credential Manager or `gh auth login` with an account granted write access. A fine-grained token needs Contents read/write and Workflows read/write because existing workflows are being published; limit access to this repository. For SSH use a passphrase-protected key and verify GitHub's host key. Never put tokens in remote URLs, source or commands.

From the root in PowerShell:

```powershell
gh auth login --hostname github.com --git-protocol https --web
gh auth setup-git
git remote -v
# origin is configured; update only if inspection shows another URL:
git remote set-url origin https://github.com/shahabwork001/parlay.git
git fetch origin --prune=false
git branch -avv
git log --all --graph --oneline -20
python scripts/audit-secrets.py --history
```

If fetch confirms **no remote branches**, publish without force:

```powershell
git push -u origin main
git push -u origin dev
git switch dev
gh repo edit shahabwork001/parlay --default-branch dev
```

If any remote branch exists, stop the empty-repository workflow. Inspect its tree/history. On `dev`, merge `origin/dev` if present and incorporate `origin/main`. Use ordinary merges for related histories. Only if Git reports unrelated histories and review confirms they must be combined, run `git merge --allow-unrelated-histories origin/main`, preserve both sides while resolving conflicts, and rerun validation. Do not reset local `main` over remote history: preserve the remote `main` tip and promote reconciled `dev` through a PR. Set upstreams only after remote branches exist. Never force-push.

## Jenkins commissioning

Create a **Multibranch Pipeline** with GitHub Branch Source, repository `shahabwork001/parlay`, script path `Jenkinsfile`. Discover `dev`, `main`, optional feature branches and PR merge revisions; disable tag discovery. Disable automatic builds of the initial `main` bootstrap until launch review is complete. Configure webhook-driven branch builds afterward. Approved merges into `main` then deploy automatically without an input prompt.

Plugins: Pipeline/Declarative, Git, GitHub Branch Source, Credentials Binding, SSH Agent and Timestamper. Linux agents need Node 24/npm, Python 3, Git, Docker engine/Compose v2 supporting `include` and `!reset`, curl, OpenSSH and Playwright runtime libraries. `parley-ci` needs Docker/Testcontainers and sufficient memory. Provision Chromium system libraries in the agent image using `npx playwright install --with-deps chromium`. `parley-release` needs Docker, OpenSSH and curl. Configure artifact storage and retention for large image stashes.

Trusted job environment:

| Variable | Value |
| --- | --- |
| `PARLEY_PUBLIC_API_URL` | Production HTTPS API origin; currently `https://parley.178-104-162-246.sslip.io` |
| `PARLEY_PUBLIC_SITE_URL` | Production HTTPS frontend origin; currently the same origin |
| `PARLEY_PUSH_GHCR` | `false` by default; enable only after package access is provisioned |

Jenkins credentials:

| ID | Type/purpose |
| --- | --- |
| Branch Source credential | Read-only GitHub App/token or SSH checkout; configure status reporting permission separately |
| `parley-hetzner-ssh` | SSH private key for `shahab@178.104.162.246`; production-only |
| `parley-ssh-known-hosts` | Secret file with independently verified Hetzner host public key |
| `parley-ghcr-push` | Optional username/token with package write permission |

Production credentials must be inaccessible to `dev`, PRs and feature jobs through Jenkins authorization, credential/job-folder isolation and trusted Pipeline configuration. Labels and `when` conditions alone cannot protect against a maliciously edited Jenkinsfile. Do not run untrusted code on shared Docker daemons, release agents or credential-bearing executors. Use ephemeral CI agents, Branch Source PR trust policies, and an administrator-managed credential policy restricted to trusted `main`. Require ownership review for Jenkinsfile/deployment changes. If branch-specific credential access cannot be enforced, use a separate administrator-owned release job accepting only successful trusted-main builds and verifying their SHA; do not expose production credentials globally to this multibranch folder. This administrator setup is a commissioning requirement.

## Build and exact-image deployment

All branches run checkout, indexed/history credential-path audit, `npm ci`, lint, typechecks, backend/frontend unit tests, Testcontainers integration tests, quiet Compose validation, application builds and frontend Playwright tests. Failure blocks subsequent stages. Branch Source reports GitHub status; Jenkins logs report success/failure. Full-stack browser and real-device/network launch evidence remain separate release checks.

Only `main` builds API/workers/frontend images tagged with the full commit SHA and OCI revision labels. The frontend embeds the configured HTTPS API origin. Jenkins records image IDs and a tar checksum. Optional GHCR publication uses `ghcr.io/shahabwork001/parlay-{api,workers,frontend}:<sha>`. Use a classic PAT with `write:packages` for publishing or `read:packages` for private pulls, with any required organization authorization. External Jenkins has no automatic Actions `GITHUB_TOKEN`. Login uses stdin and temporary Docker configuration.

Delivery transfers the exact saved images over verified SSH even if GHCR is enabled; no server registry credential is needed. The remote helper verifies checksum/revision/image IDs, serializes deployments with `flock`, records rollback image IDs, and replaces only API/workers/frontend using `--no-build --pull never --no-deps --wait`. It pins immutable local image IDs, checks running IDs and internal API/workers readiness; Jenkins then checks public HTTPS API readiness and frontend response. Failure marks the build failed. There is no automatic rollback; inspect logs and use the saved overlay. Schedule release/image retention without deleting rollback images or persistent volumes.

The existing host must already be provisioned at `/home/shahab/apps/parley-preview`, with private `.env`, existing `deploy/hetzner/compose.sh`, infrastructure and proxy network. Jenkins uploads no secrets, creates no staff, performs no database migrations and does not replace TURN/database/proxy services or automatically change infrastructure configuration. Coordinate configuration changes and session draining separately. Server configuration continues to govern closed Adult/payments/registration gates. No live deployment was run during preparation.

Rollback on the host, substituting the actual release directory:

```sh
cd /home/shahab/apps/parley-preview
sh deploy/hetzner/compose.sh -f releases/<sha>-<build>/rollback.override.yml \
  up -d --no-build --pull never --no-deps --wait api workers frontend
# Repeat internal readiness and external HTTPS checks.
```

## GitHub settings

Protect `main` under Settings → Rules/Branches: require PRs and at least one approval, dismiss stale approvals, require approval of the latest push, resolve conversations, require up-to-date status checks, disable force pushes/deletion and administrator bypass, and restrict direct writes. Team policy requires source `dev`; optionally enforce that with a trusted required check. Assign actual code owners for pipeline/deployment review. Do not require linear history if importing both original histories through merges.

Run Jenkins on a PR first and select the exact status context emitted by your plugin version (commonly `continuous-integration/jenkins/pr-merge`). Do not invent a required check name. Require validation of the PR merge revision, not a deployment check that runs only after merging. Verify a failing PR is blocked before enabling main deployment.

Webhook: `https://<jenkins-host>/github-webhook/`, JSON, SSL verification enabled, push and pull_request events. Store a random webhook secret securely in Jenkins GitHub configuration; configure matching signature validation and inspect recent deliveries. Webhooks trigger builds; deployment remains branch-gated.

Defaults/protection/webhooks, Jenkins jobs/credentials, GHCR permissions and host keys require administrator access. They are documented, not claimed applied.

## Proxy and references

The existing preview uses **Caddy + HTTPS**, not Nginx. Flow: Developer → dev → Jenkins CI → PR → main → Jenkins CI/CD → Hetzner → HTTPS proxy → Parley. Keep Caddy until an Nginx migration is separately planned. A new Nginx deployment must terminate HTTPS, proxy frontend to private port 3000 and API/WSS to 8080, forward Upgrade/Connection and forwarded headers, and configure the API's precise trusted proxy address. No proxy migration or staging environment is performed here.

- [Jenkins branch/PR conditions](https://www.jenkins.io/doc/book/pipeline/syntax/)
- [Jenkins multibranch setup](https://www.jenkins.io/doc/book/pipeline/multibranch/)
- [Jenkins credential isolation](https://www.jenkins.io/doc/book/security/securing-org-folders-and-multibranch-pipelines/)
- [GitHub token permissions](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)
- [GHCR authentication](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
