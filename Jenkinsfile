pipeline {
    agent none
    options {
        skipDefaultCheckout(true)
        disableConcurrentBuilds()
        timestamps()
        timeout(time: 60, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '20'))
    }
    stages {
        stage('CI') {
            agent { label 'parley-ci' }
            environment { CI = 'true' }
            stages {
                stage('Checkout') {
                    steps {
                        deleteDir()
                        checkout scm
                        script {
                            env.RELEASE_SHA = sh(script: 'git rev-parse HEAD', returnStdout: true).trim()
                        }
                        sh 'python3 scripts/audit-secrets.py --history'
                        sh 'python3 scripts/test-ci-guards.py'
                    }
                }
                stage('Install') {
                    steps {
                        sh 'node --version && npm --version && docker compose version'
                        dir('backend') { sh 'npm ci --no-audit --no-fund' }
                        dir('frontend') { sh 'npm ci --no-audit --no-fund' }
                    }
                }
                stage('Lint and typecheck') {
                    steps {
                        dir('backend') { sh 'npm run lint && npm run typecheck' }
                        dir('frontend') { sh 'npm run lint && npm run typecheck' }
                    }
                }
                stage('Tests') {
                    steps {
                        dir('backend') { sh 'npm test && npm run test:integration' }
                        dir('frontend') { sh 'npm test -- --maxWorkers=1' }
                    }
                }
                stage('Compose validation') {
                    steps { sh 'sh scripts/ci-compose.sh' }
                }
                stage('Application builds and browser tests') {
                    steps {
                        dir('backend') { sh 'npm run build' }
                        dir('frontend') {
                            sh 'npm run build'
                            sh 'npx playwright install chromium'
                            sh 'npm run test:e2e -- --workers=1'
                        }
                    }
                }
                stage('Production images') {
                    when {
                        beforeAgent true
                        allOf { branch 'main'; not { changeRequest() }; not { buildingTag() } }
                    }
                    steps {
                        sh 'sh scripts/build-release.sh'
                        stash name: 'release', includes: '.release/**,scripts/ship-release.sh,deploy/hetzner/deploy-release.sh', useDefaultExcludes: false
                    }
                }
            }
        }
        stage('Production delivery') {
            when {
                beforeAgent true
                allOf { branch 'main'; not { changeRequest() }; not { buildingTag() } }
            }
            agent { label 'parley-release' }
            steps {
                deleteDir()
                unstash 'release'
                script {
                    // Set PARLEY_PUSH_GHCR=true in the trusted Jenkins job configuration.
                    if (env.PARLEY_PUSH_GHCR == 'true') {
                        withCredentials([usernamePassword(credentialsId: 'parley-ghcr-push', usernameVariable: 'GHCR_USER', passwordVariable: 'GHCR_TOKEN')]) {
                            sh '''
                                set +x
                                export DOCKER_CONFIG="$(mktemp -d)"
                                trap 'rm -rf "$DOCKER_CONFIG"' EXIT
                                printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USER" --password-stdin
                                docker load -i .release/images.tar
                                for service in api workers frontend; do
                                    docker tag "parley-$service:$RELEASE_SHA" "ghcr.io/shahabwork001/parlay-$service:$RELEASE_SHA"
                                    docker push "ghcr.io/shahabwork001/parlay-$service:$RELEASE_SHA"
                                done
                            '''
                        }
                    }
                }
                withCredentials([file(credentialsId: 'parley-ssh-known-hosts', variable: 'SSH_KNOWN_HOSTS')]) {
                    sshagent(credentials: ['parley-hetzner-ssh']) {
                        sh 'sh scripts/ship-release.sh'
                    }
                }
            }
        }
    }
    post {
        success { echo "Parley ${env.BRANCH_NAME}: validation succeeded; production delivery runs only for main." }
        failure { echo "Parley ${env.BRANCH_NAME}: failed. Inspect stage logs and production health before retrying." }
    }
}
