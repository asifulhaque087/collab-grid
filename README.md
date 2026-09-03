# LootBoard

LootBoard is a multi-tenant SaaS platform and collaborative workspace that enables traditional e-commerce sellers to execute high-concurrency flash sales without modifying their core infrastructure, combining real-time visual canvas management with high-throughput inventory booking.

>To run this application locally, we have to follow these steps:

**Note:** *If you face any problem, plese report an Issue.*

- [Environment setup](#environment-setup)
- [Install k8s charts](#install-k8s-charts)
- [Clone the repo](#clone-the-repo)
- [Add vars](#add-vars)
- [Install dependencies](#install-dependencies)
- [Run the project](#run-the-project)


## Environment setup


This application is developed in Kubernetes environment. I assume you have already installed below packages based on your OS and Distro:

- Minikube
- Kubectl
- Helm
- Go


Additionally I am using Tilt for development setup. Please download this following the [guide](https://docs.tilt.dev/install.html) according to your OS.


## Install k8s charts

LootBoard depends on some charts. So we have to install them in the Kubernets. We will use Helm to install them. Required charts are given below:

- Postgresql
- Redis
- RabbitMQ


>CAUTIONS: Make sure to switch to the local minikube context 


**PostgreSQL:**

```bash
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update

helm install universal-postgres bitnami/postgresql \
	--namespace universal-infra --create-namespace \
  --set fullnameOverride=universal-postgres \
  --set global.postgresql.auth.postgresPassword='q8xR2ZtrnFSj'
```

**Redis:**

```bash
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update

helm install universal-redis bitnami/redis \
	--namespace universal-infra --create-namespace \
  --set fullnameOverride=universal-redis \
  --set architecture='standalone' \
  --set auth.password='q8xR2ZtrnFSj'
```


**RabbitMQ:**

```bash
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update

helm upgrade --install universal-rabbitmq bitnami/rabbitmq \
  --namespace universal-infra \
  --set fullnameOverride=universal-rabbitmq \
  --set auth.username='admin' \
  --set auth.password='q8xR2ZtrnFSj' \
  --set image.repository=bitnamilegacy/rabbitmq \
  --set global.security.allowInsecureImages=true
```


## Clone the repo

This application has 2 versions given below. And we have 2 branches (golang, nestjs) that holds their respective code.

- Golang
- NestJs

Switching two branches frequently during continuously development on both version, resulted many files being copied to this 2 branches like `dist/`, `.next/`, `node_modules/` and Golang Binaries.

To solve this we will use `git worktree`:

```bash
mkdir loot-board
cd loot-board
git clone git@github.com:asifulhaque087/loot-board.git --bare .git
git worktree add ./golang golang
git worktree add ./nestjs nestjs

# Make sure to switch to golang worktree
cd golang
```


## Add vars

Add development env values for api and web. To do this first we have to create below files

```bash
# make sure you are in root in golang worktree
touch infra/charts/api/values.dev.yaml
touch infra/charts/web/values.dev.yaml
```


Paste the below content in `infra/charts/api/values.dev.yaml` file. And adjust Email and Google credentials.

```yaml
# infra/charts/api/values.dev.yaml

replicaCount: 1

image:
  repository: loot-board/api
  migrateRepository: loot-board/api-migrate
  tag: tilt
  pullPolicy: IfNotPresent

service:
  type: ClusterIP

secrets:
  DATABASE_URL: "postgres://postgres:q8xR2ZtrnFSj@universal-postgres.universal-infra:5432/lootboard_db?sslmode=disable"
  ACCESS_TOKEN_SECRET: "92384ruqwlkerwaq9w8erwqjlasdfs-097-34-324ruisdjflk12"
  ACCESS_TOKEN_EXPIRATION: "15m"
  REFRESH_TOKEN_SECRET: "92384ruqwlkerwaq9w8erwqjlas-097-34-324ruisdjflk12"
  REFRESH_TOKEN_EXPIRATION: "168h"
  GOOGLE_CLIENT_ID: "YOUR GOOGLE CLIENT ID"
  GOOGLE_CLIENT_SECRET: "YOUR GOOGLE CLIENT SECRET"
  GOOGLE_CALLBACK_URL: "http://localhost:30001/auth/google/callback"
  CLIENT_URL: "http://localhost:3000"
  CORS_ORIGIN: "http://localhost:3000"
  PORT: "3001"
  SMTP_HOST: "smtp.ethereal.email"
  SMTP_PORT: "587"
  SMTP_SECURE: "false"
  SMTP_USER: "YOUR ETHEREAL EMAIL"
  SMTP_PASS: "YOUR ETHEREAL EMAIL PASSWORD"
  MAIL_FROM: "LootBoard <YOUR ETHEREAL EMAIL>"
  RESET_TOKEN_EXPIRATION: "15m"
  RESET_PASSWORD_URL: "http://localhost:3000/reset-password"
  REDIS_URL: "redis://:q8xR2ZtrnFSj@universal-redis-master.universal-infra:6379"
  RABBITMQ_URL: "amqp://admin:q8xR2ZtrnFSj@universal-rabbitmq.universal-infra:5672"
  WS_TOKEN_SECRET: "ws-secret-9w8erwqjlasdfs-096-34-324ruisdjflk12"
```

Now Paste the below content in `infra/charts/web/values.dev.yaml` file.

```yaml
# infra/charts/web/values.dev.yaml

replicaCount: 1

image:
  repository: loot-board/web
  tag: tilt
  pullPolicy: IfNotPresent

service:
  type: ClusterIP

secrets:
  NODE_ENV: "development"
  PORT: "3000"
  ACCESS_TOKEN_SECRET: "92384ruqwlkerwaq9w8erwqjlasdfs-097-34-324ruisdjflk12"
  REFRESH_TOKEN_SECRET: "92384ruqwlkerwaq9w8erwqjlas-097-34-324ruisdjflk12"
  GATEWAY_URL: "http://lootboard-api:3001"
  NEXT_PUBLIC_GATEWAY_URL: "http://localhost:3001"
  NEXT_PUBLIC_SOCKET_URL: "http://localhost:3001"

```


## Install dependencies

Make sure you are in golang worktree. Then run below command to install all the Go dependencies.

```bash
# terminal location - loot-board/golang
go mod tidy
```


## Run the project

First make sure the Minikube is started or run the below command to start the minikube.

```bash
minikube start
```

Then run `till up` to start the project like below. This will start the application in - http://localhost:10350/ where you see all the logs of both api and web.

```bash
# terminal location - loot-board/golang
tilt up
```


To access Backend and Frontend individually in the Browser, follow below links.

- Backend - http://localhost:3001/
- Frontend - http://localhost:3000/

>To check if the backend server is healthy or not hit this - http://localhost:3001/health api in the browser.

