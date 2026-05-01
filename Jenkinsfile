pipeline {
    agent any

    parameters {
        choice(name: 'ACTION', choices: ['DEPLOY', 'ROLLBACK'], description: 'Choose action')
        string(name: 'BACKEND_VERSION', defaultValue: 'v20', description: 'Backend version (vXX)')
        string(name: 'FRONTEND_VERSION', defaultValue: 'v20', description: 'Frontend version (vXX)')
    }

    environment {
        NAMESPACE = "shopping"
        REPO = "git@github.com:Suresh5992/shoping-website1.git"
        BRANCH = "master"

        BACKEND_IMAGE = "suresh628/shop-backend:${params.BACKEND_VERSION}"
        FRONTEND_IMAGE = "suresh628/shop-frontend:${params.FRONTEND_VERSION}"
    }

    stages {

        stage('Clean Workspace') {
            when {
                expression { params.ACTION == 'DEPLOY' }
            }
            steps {
                deleteDir()
            }
        }

        stage('Clone Latest Code') {
            when {
                expression { params.ACTION == 'DEPLOY' }
            }
            steps {
                git branch: "${BRANCH}", url: "${REPO}"
            }
        }

        stage('Verify Latest Commit') {
            when {
                expression { params.ACTION == 'DEPLOY' }
            }
            steps {
                sh '''
                echo "Latest commit:"
                git log -1
                '''
            }
        }

        stage('Build Backend Image') {
            when {
                expression { params.ACTION == 'DEPLOY' }
            }
            steps {
                sh '''
                cd backend
                DOCKER_BUILDKIT=0 docker build --no-cache -t $BACKEND_IMAGE .
                '''
            }
        }

        stage('Build Frontend Image') {
            when {
                expression { params.ACTION == 'DEPLOY' }
            }
            steps {
                sh '''
                cd frontend
                DOCKER_BUILDKIT=0 docker build --no-cache -t $FRONTEND_IMAGE .
                '''
            }
        }

        stage('Push Images to DockerHub') {
            when {
                expression { params.ACTION == 'DEPLOY' }
            }
            steps {
                script {
                    docker.withRegistry('https://index.docker.io/v1/', 'dockerhub') {
                        sh '''
                        docker push $BACKEND_IMAGE
                        docker push $FRONTEND_IMAGE
                        '''
                    }
                }
            }
        }

        stage('Deploy / Rollback') {
            steps {
                sh '''
                echo "===== Using Versions ====="
                echo "Backend: $BACKEND_IMAGE"
                echo "Frontend: $FRONTEND_IMAGE"

                kubectl set image deployment/backend backend=$BACKEND_IMAGE -n $NAMESPACE
                kubectl set image deployment/frontend frontend=$FRONTEND_IMAGE -n $NAMESPACE

                kubectl rollout restart deployment/backend -n $NAMESPACE
                kubectl rollout restart deployment/frontend -n $NAMESPACE
                '''
            }
        }

        stage('Verify Deployment') {
            steps {
                sh '''
                echo "===== Rollout Status ====="
                kubectl rollout status deployment/backend -n $NAMESPACE
                kubectl rollout status deployment/frontend -n $NAMESPACE

                echo "===== Pods ====="
                kubectl get pods -n $NAMESPACE

                echo "===== Services ====="
                kubectl get svc -n $NAMESPACE

                echo "===== Running Images ====="
                kubectl describe deployment backend -n $NAMESPACE | grep Image
                kubectl describe deployment frontend -n $NAMESPACE | grep Image
                '''
            }
        }
    }
}
