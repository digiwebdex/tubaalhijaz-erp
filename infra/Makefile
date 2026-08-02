# TUBA AL HIJAZ — infra helpers. Stamps images with the git SHA so CI/CD (Phase 16)
# and rollbacks (Phase 20) always have a deterministic tag to target.
# Usage: make -C infra prod   |   make -C infra dev   |   make -C infra down

export IMAGE_TAG := $(shell git rev-parse --short HEAD 2>/dev/null || echo latest)

DEV  := docker compose -f docker-compose.yml
PROD := docker compose -f docker-compose.prod.yml

.PHONY: dev prod build-prod down down-prod logs ps tag
tag: ; @echo "IMAGE_TAG=$(IMAGE_TAG)"

dev:        ## dev stack (backing ports exposed, no restart)
	$(DEV) up --build

prod:       ## prod stack, images tagged with the git SHA
	$(PROD) up -d --build

build-prod: ## build + tag prod images without starting
	$(PROD) build

down:       ; $(DEV) down
down-prod:  ; $(PROD) down
logs:       ; $(PROD) logs -f
ps:         ; $(PROD) ps
