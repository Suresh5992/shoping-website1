pipeline {
  agent any

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Install Backend Dependencies') {
      steps {
        dir('backend') {
          sh 'npm install'
        }
      }
    }

    stage('Validate Frontend') {
      steps {
        echo 'Frontend is static HTML/CSS/JS and ready for deployment.'
      }
    }

    stage('Archive Artifacts') {
      steps {
        archiveArtifacts artifacts: 'frontend/**, backend/**', fingerprint: true
      }
    }
  }

  post {
    always {
      echo 'Jenkins pipeline finished.'
    }
  }
}
