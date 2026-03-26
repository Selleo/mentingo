.PHONY: release
release:
	@if [ -z "${TAG}" ]; then \
		echo "Error: TAG variable is not set."; \
		exit 1; \
	else \
		case "${TAG}" in \
			v*) \
				git-chglog -o CHANGELOG.md --next-tag ${TAG} && \
				npx prettier CHANGELOG.md --write && \
				git add CHANGELOG.md && \
				git commit -m "docs: update changelog for version ${TAG}" \
				;; \
			*) \
				echo "Warning: TAG does not start with 'v', skipping changelog update step."; \
				exit 0 \
				;; \
		esac; \
	fi

	git tag -a ${TAG} -m "${TAG}" && \
	git push origin HEAD --tags --no-verify;

	case "${TAG}" in \
		v*) \
			git fetch origin && \
			git switch main || git switch -c main origin/main && \
			git rebase origin/staging && \
			git push origin main --no-verify \
			;; \
		*) \
			echo "Warning: TAG does not start with 'v', skipping staging to main promotion"; \
			exit 0 \
			;; \
	esac;

.PHONY: dry-release
dry-release:
	@if [ -z "${TAG}" ]; then \
		echo "Error: TAG variable is not set."; \
		exit 1; \
	fi
	git-chglog -o CHANGELOG.md --next-tag ${TAG} && \
	npx prettier CHANGELOG.md --write

IMAGE_TAG ?= local-$(shell git rev-parse --short HEAD)
API_IMAGE ?= mentingo-api:$(IMAGE_TAG)
WEB_IMAGE ?= mentingo-web:$(IMAGE_TAG)
TRIVY_SEVERITY ?= HIGH,CRITICAL
TRIVY_EXIT_CODE ?= 1
TRIVY_REPORTS_DIR ?= reports/trivy

.PHONY: check-tools
check-tools:
	@command -v docker >/dev/null 2>&1 || (echo "Error: docker is not installed or not in PATH." && exit 1)
	@command -v trivy >/dev/null 2>&1 || (echo "Error: trivy is not installed or not in PATH." && exit 1)

.PHONY: docker-build-api
docker-build-api:
	docker build -f ./api.Dockerfile -t $(API_IMAGE) .

.PHONY: docker-build-web
docker-build-web:
	docker build -f ./web.Dockerfile \
		--build-arg VITE_STRIPE_PUBLISHABLE_KEY=$${VITE_STRIPE_PUBLISHABLE_KEY:-} \
		--build-arg VITE_SENTRY_DSN=$${VITE_SENTRY_DSN:-} \
		--build-arg VITE_GOOGLE_OAUTH_ENABLED=$${VITE_GOOGLE_OAUTH_ENABLED:-} \
		--build-arg VITE_MICROSOFT_OAUTH_ENABLED=$${VITE_MICROSOFT_OAUTH_ENABLED:-} \
		--build-arg VITE_SLACK_OAUTH_ENABLED=$${VITE_SLACK_OAUTH_ENABLED:-} \
		--build-arg VITE_POSTHOG_KEY=$${VITE_POSTHOG_KEY:-} \
		--build-arg VITE_POSTHOG_HOST=$${VITE_POSTHOG_HOST:-} \
		-t $(WEB_IMAGE) .

.PHONY: docker-build
docker-build: docker-build-api docker-build-web

.PHONY: trivy-scan-api
trivy-scan-api: check-tools
	@mkdir -p $(TRIVY_REPORTS_DIR)
	@echo "==> Scanning $(API_IMAGE)"
	trivy image --severity $(TRIVY_SEVERITY) --ignore-unfixed --exit-code $(TRIVY_EXIT_CODE) $(API_IMAGE)
	trivy image --severity $(TRIVY_SEVERITY) --ignore-unfixed --exit-code 0 --format json -o $(TRIVY_REPORTS_DIR)/api.json $(API_IMAGE)
	trivy image --severity $(TRIVY_SEVERITY) --ignore-unfixed --exit-code 0 --format sarif -o $(TRIVY_REPORTS_DIR)/api.sarif $(API_IMAGE)

.PHONY: trivy-scan-web
trivy-scan-web: check-tools
	@mkdir -p $(TRIVY_REPORTS_DIR)
	@echo "==> Scanning $(WEB_IMAGE)"
	trivy image --severity $(TRIVY_SEVERITY) --ignore-unfixed --exit-code $(TRIVY_EXIT_CODE) $(WEB_IMAGE)
	trivy image --severity $(TRIVY_SEVERITY) --ignore-unfixed --exit-code 0 --format json -o $(TRIVY_REPORTS_DIR)/web.json $(WEB_IMAGE)
	trivy image --severity $(TRIVY_SEVERITY) --ignore-unfixed --exit-code 0 --format sarif -o $(TRIVY_REPORTS_DIR)/web.sarif $(WEB_IMAGE)

.PHONY: trivy-scan
trivy-scan: trivy-scan-api trivy-scan-web
	@echo "Trivy reports generated in $(TRIVY_REPORTS_DIR)"

.PHONY: security-scan
security-scan: docker-build trivy-scan
