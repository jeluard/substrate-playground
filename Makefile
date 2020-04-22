.DEFAULT_GOAL=help

ifeq ($(ENVIRONMENT),)
  ENVIRONMENT=dev
endif

ENVIRONMENTS := production staging dev

ifeq ($(filter $(ENVIRONMENT),$(ENVIRONMENTS)),)
    $(error ENVIRONMENT should be one of ($(ENVIRONMENTS)) but was $(ENVIRONMENT))
endif

ifeq ($(ENVIRONMENT), production)
  IDENTIFIER=playground
else ifeq ($(ENVIRONMENT), dev)
  IDENTIFIER=default
else
  IDENTIFIER=playground-${ENVIRONMENT}
endif

GKE_REGION=us-central1
DOCKER_USERNAME=jeluard
PLAYGROUND_DOCKER_IMAGE_NAME=${DOCKER_USERNAME}/substrate-playground
THEIA_DOCKER_IMAGE_NAME=${DOCKER_USERNAME}/theia-substrate
GOOGLE_PROJECT_ID=substrateplayground-252112

# Show this help.
help:
	@awk '/^#/{c=substr($$0,3);next}c&&/^[[:alpha:]][[:print:]]+:/{print substr($$1,1,index($$1,":")),c}1{c=0}' $(MAKEFILE_LIST) | column -s: -t

clean-frontend:
	cd frontend; yarn clean

clean-backend:
	cd backend; cargo clean

# Clean all generated files
clean: clean-frontend clean-backend
	@:

## Local development

dev-frontend:
	cd frontend; yarn && yarn watch

dev-backend:
	cd backend; ln -sf ../frontend/dist static; RUST_BACKTRACE=1 cargo run

## Docker images

# Build theia docker image
build-theia-docker-image:
	$(eval THEIA_DOCKER_IMAGE_VERSION=$(shell git rev-parse --short HEAD))
	@cd theia-images; docker build -f Dockerfile --label git-commit=${THEIA_DOCKER_IMAGE_VERSION} -t ${THEIA_DOCKER_IMAGE_NAME}:${THEIA_DOCKER_IMAGE_VERSION} . && docker image prune -f --filter label=stage=builder
	docker tag ${THEIA_DOCKER_IMAGE_NAME}:${THEIA_DOCKER_IMAGE_VERSION} gcr.io/${GOOGLE_PROJECT_ID}/${THEIA_DOCKER_IMAGE_NAME}

# Push a newly built theia image on docker.io and gcr.io
push-theia-docker-image: build-theia-docker-image
	docker push ${THEIA_DOCKER_IMAGE_NAME}:${THEIA_DOCKER_IMAGE_VERSION}
	docker push gcr.io/${GOOGLE_PROJECT_ID}/${THEIA_DOCKER_IMAGE_NAME}

# Build playground docker image
build-playground-docker-image:
	$(eval PLAYGROUND_DOCKER_IMAGE_VERSION=$(shell git rev-parse --short HEAD))
	docker build -f conf/Dockerfile --label git-commit=${PLAYGROUND_DOCKER_IMAGE_VERSION} -t ${PLAYGROUND_DOCKER_IMAGE_NAME}:${PLAYGROUND_DOCKER_IMAGE_VERSION} . && docker image prune -f --filter label=stage=builder
	docker tag ${PLAYGROUND_DOCKER_IMAGE_NAME}:${PLAYGROUND_DOCKER_IMAGE_VERSION} gcr.io/${GOOGLE_PROJECT_ID}/${PLAYGROUND_DOCKER_IMAGE_NAME}

# Push a newly built playground image on docker.io and gcr.io
push-playground-docker-image: build-playground-docker-image
	docker push ${PLAYGROUND_DOCKER_IMAGE_NAME}:${PLAYGROUND_DOCKER_IMAGE_VERSION}
	docker push gcr.io/${GOOGLE_PROJECT_ID}/${PLAYGROUND_DOCKER_IMAGE_NAME}

## Kubernetes deployment

k8s-assert:
	$(eval CURRENT_NAMESPACE=$(shell kubectl config view --minify --output 'jsonpath={..namespace}'))
	$(eval CURRENT_CONTEXT=$(shell kubectl config current-context))
	@echo $$'You are about to interact with the \e[31m'"${ENVIRONMENT}"$$'\e[0m environment. (Modify the environment by setting the \e[31m'ENVIRONMENT$$'\e[0m variable)'
	@echo $$'(namespace: \e[31m'"${CURRENT_NAMESPACE}"$$'\e[0m, context: \e[31m'"${CURRENT_CONTEXT}"$$'\e[0m)'
	@if [ "${CURRENT_NAMESPACE}" != "${IDENTIFIER}" ] ;then read -p $$'Current namespace (${CURRENT_NAMESPACE}) doesn\'t match environment. Update to "${IDENTIFIER}"? [yN]' proceed; if [ "$${proceed}" == "Y" ] ;then kubectl config set-context --current --namespace=${IDENTIFIER}; else exit 1; fi; fi
	@read -p $$'Ok to proceed? [yN]' answer; \
	if [ "$${answer}" != "Y" ] ;then exit 1; fi

k8s-setup-development: k8s-assert
	kubectl config use-context docker-for-desktop
	kubectl config set-context --current --namespace=${IDENTIFIER}

k8s-setup-gke: k8s-assert
	kubectl config use-context gke_substrateplayground-252112_us-central1-a_substrate-${IDENTIFIER}
	kubectl config set-context --current --namespace=${IDENTIFIER}

k8s-gke-static-ip: k8s-assert
	gcloud compute addresses describe ${IDENTIFIER} --region=${GKE_REGION} --format="value(address)"

# Deploy playground on kubernetes
k8s-deploy-playground: k8s-assert
	kubectl apply --record -k conf/k8s/overlays/${ENVIRONMENT}

# Undeploy playground from kubernetes
k8s-undeploy-playground: k8s-assert
	kubectl delete -k conf/k8s/overlays/${ENVIRONMENT}

# Undeploy all theia pods and services from kubernetes
k8s-undeploy-theia: k8s-assert
	kubectl delete pods,services -l app.kubernetes.io/component=theia --namespace=${IDENTIFIER}

# Creates or replaces the `images` config map from `conf/k8s/images/*.properties`
k8s-update-images-config: k8s-assert
	kubectl create configmap theia-images --namespace=${IDENTIFIER} --from-file=conf/k8s/overlays/${ENVIRONMENT}/theia-images/ --dry-run -o yaml | kubectl apply -f -