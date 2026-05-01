pipeline {
    agent any

    parameters {
        choice(name: 'ACTION', choices: ['DEPLOY', 'ROLLBACK'], description: 'Choose action')
    }

    environment {
        NAMESPACE = "shopping"
        REPO = "git@github.com:Suresh5992/shoping-website1.git"
        BRANCH = "master"

        BACKEND_IMAGE = "suresh628/shop-backend:${BUILD_NUMBER}"
        FRONTEND_IMAGE = "suresh628/shop-frontend:${BUILD_NUMBER}"
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
                    docker.withRegistry('https://index.docker.io/v1/', 'docker') {
                        sh '''
                        docker push $BACKEND_IMAGE
                        docker push $FRONTEND_IMAGE
                        '''
                    }
                }
            }
        }

        stage('Apply Kubernetes Manifests') {
            when {
                expression { params.ACTION == 'DEPLOY' }
            }
            steps {
                sh '''
                kubectl apply -f k8s/frontend-deployment.yaml -n $NAMESPACE
                kubectl apply -f k8s/backend-deployment.yaml -n $NAMESPACE
                '''
            }
        }

        stage('Deploy Application') {
            steps {
                sh '''
                echo "===== Using Images ====="
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
```

## Check Current Running Image Version

```bash
kubectl get deployment backend -n shopping -o=jsonpath='{.spec.template.spec.containers[0].image}'
```

```bash
kubectl get deployment frontend -n shopping -o=jsonpath='{.spec.template.spec.containers[0].image}'
```

## Check Image Tags in Docker Hub

You can view all pushed image tags in your Docker repository:

* Backend: `suresh628/shop-backend`
* Frontend: `suresh628/shop-frontend`

Open Docker Hub and check the Tags section.
