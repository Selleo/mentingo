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

.PHONY: check-trivy
check-trivy:
	@command -v trivy >/dev/null 2>&1 || (echo "Error: trivy is not installed or not in PATH." && exit 1)

.PHONY: check-tools
check-tools: check-trivy
	@command -v docker >/dev/null 2>&1 || (echo "Error: docker is not installed or not in PATH." && exit 1)

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
	@scan_exit=0; \
	trivy image --severity $(TRIVY_SEVERITY) --ignore-unfixed --exit-code $(TRIVY_EXIT_CODE) $(API_IMAGE) || scan_exit=$$?; \
	trivy image --severity $(TRIVY_SEVERITY) --ignore-unfixed --exit-code 0 --format json -o $(TRIVY_REPORTS_DIR)/api.json $(API_IMAGE); \
	trivy image --severity $(TRIVY_SEVERITY) --ignore-unfixed --exit-code 0 --format sarif -o $(TRIVY_REPORTS_DIR)/api.sarif $(API_IMAGE); \
	exit $$scan_exit

.PHONY: trivy-scan-web
trivy-scan-web: check-tools
	@mkdir -p $(TRIVY_REPORTS_DIR)
	@echo "==> Scanning $(WEB_IMAGE)"
	@scan_exit=0; \
	trivy image --severity $(TRIVY_SEVERITY) --ignore-unfixed --exit-code $(TRIVY_EXIT_CODE) $(WEB_IMAGE) || scan_exit=$$?; \
	trivy image --severity $(TRIVY_SEVERITY) --ignore-unfixed --exit-code 0 --format json -o $(TRIVY_REPORTS_DIR)/web.json $(WEB_IMAGE); \
	trivy image --severity $(TRIVY_SEVERITY) --ignore-unfixed --exit-code 0 --format sarif -o $(TRIVY_REPORTS_DIR)/web.sarif $(WEB_IMAGE); \
	exit $$scan_exit

.PHONY: trivy-summary
trivy-summary:
	@echo "==> Filtered vulnerability table (only reports with findings)"
	@found=0; \
	for report in $(TRIVY_REPORTS_DIR)/api.json $(TRIVY_REPORTS_DIR)/web.json; do \
		if [ ! -f "$$report" ]; then \
			continue; \
		fi; \
		if grep -q '"VulnerabilityID"' "$$report"; then \
			found=1; \
			report_name=$$(basename "$$report" .json); \
			echo ""; \
			echo "### $$report_name"; \
			trivy convert --format table "$$report"; \
		fi; \
	done; \
	if [ $$found -eq 0 ]; then \
		echo "No vulnerabilities detected for severity $(TRIVY_SEVERITY)."; \
	fi

.PHONY: trivy-scan
trivy-scan: check-tools
	@api_exit=0; \
	web_exit=0; \
	$(MAKE) --no-print-directory trivy-scan-api || api_exit=$$?; \
	$(MAKE) --no-print-directory trivy-scan-web || web_exit=$$?; \
	$(MAKE) --no-print-directory trivy-summary; \
	echo "Trivy reports generated in $(TRIVY_REPORTS_DIR)"; \
	if [ $$api_exit -ne 0 ] || [ $$web_exit -ne 0 ]; then \
		exit 1; \
	fi

.PHONY: trivy-scan-library
trivy-scan-library: check-tools
	@mkdir -p $(TRIVY_REPORTS_DIR)
	@docker image inspect $(API_IMAGE) >/dev/null 2>&1 || (echo "Error: image not found: $(API_IMAGE). Build it first (e.g. make docker-build-api)." && exit 1)
	@docker image inspect $(WEB_IMAGE) >/dev/null 2>&1 || (echo "Error: image not found: $(WEB_IMAGE). Build it first (e.g. make docker-build-web)." && exit 1)
	@echo "==> Scanning library vulnerabilities in $(API_IMAGE)"
	@api_exit=0; \
	trivy image --pkg-types library --severity $(TRIVY_SEVERITY) --ignore-unfixed --exit-code 0 --format json -o $(TRIVY_REPORTS_DIR)/api-library.json $(API_IMAGE) || api_exit=1; \
	if [ $$api_exit -eq 0 ] && grep -q '"VulnerabilityID"' $(TRIVY_REPORTS_DIR)/api-library.json && [ "$(TRIVY_EXIT_CODE)" != "0" ]; then api_exit=$(TRIVY_EXIT_CODE); fi; \
	trivy convert --format sarif -o $(TRIVY_REPORTS_DIR)/api-library.sarif $(TRIVY_REPORTS_DIR)/api-library.json || api_exit=1; \
	echo "==> Scanning library vulnerabilities in $(WEB_IMAGE)"; \
	web_exit=0; \
	trivy image --pkg-types library --severity $(TRIVY_SEVERITY) --ignore-unfixed --exit-code 0 --format json -o $(TRIVY_REPORTS_DIR)/web-library.json $(WEB_IMAGE) || web_exit=1; \
	if [ $$web_exit -eq 0 ] && grep -q '"VulnerabilityID"' $(TRIVY_REPORTS_DIR)/web-library.json && [ "$(TRIVY_EXIT_CODE)" != "0" ]; then web_exit=$(TRIVY_EXIT_CODE); fi; \
	trivy convert --format sarif -o $(TRIVY_REPORTS_DIR)/web-library.sarif $(TRIVY_REPORTS_DIR)/web-library.json || web_exit=1; \
	echo "==> Filtered library vulnerability table (only reports with findings)"; \
	found=0; \
	for report in $(TRIVY_REPORTS_DIR)/api-library.json $(TRIVY_REPORTS_DIR)/web-library.json; do \
		if [ ! -f "$$report" ]; then \
			continue; \
		fi; \
		if grep -q '"VulnerabilityID"' "$$report"; then \
			found=1; \
			report_name=$$(basename "$$report" .json); \
			echo ""; \
			echo "### $$report_name"; \
			trivy convert --format table "$$report"; \
		fi; \
	done; \
	if [ $$found -eq 0 ]; then \
		echo "No library vulnerabilities detected for severity $(TRIVY_SEVERITY)."; \
	fi; \
	echo "Trivy library reports generated in $(TRIVY_REPORTS_DIR)"; \
	if [ $$api_exit -ne 0 ] || [ $$web_exit -ne 0 ]; then \
		exit 1; \
	fi

.PHONY: trivy-scan-fs
trivy-scan-fs: check-trivy
	@mkdir -p $(TRIVY_REPORTS_DIR)
	@echo "==> Scanning filesystem vulnerabilities in repository"
	@scan_exit=0; \
	trivy fs --scanners vuln --pkg-types library --severity $(TRIVY_SEVERITY) --ignore-unfixed --exit-code 0 --format json -o $(TRIVY_REPORTS_DIR)/fs-library.json . || scan_exit=1; \
	if [ $$scan_exit -eq 0 ] && grep -q '"VulnerabilityID"' $(TRIVY_REPORTS_DIR)/fs-library.json && [ "$(TRIVY_EXIT_CODE)" != "0" ]; then scan_exit=$(TRIVY_EXIT_CODE); fi; \
	trivy convert --format sarif -o $(TRIVY_REPORTS_DIR)/fs-library.sarif $(TRIVY_REPORTS_DIR)/fs-library.json || scan_exit=1; \
	echo "==> Filtered filesystem vulnerability table (only when findings exist)"; \
	if grep -q '"VulnerabilityID"' $(TRIVY_REPORTS_DIR)/fs-library.json; then \
		trivy convert --format table $(TRIVY_REPORTS_DIR)/fs-library.json; \
	else \
		echo "No filesystem library vulnerabilities detected for severity $(TRIVY_SEVERITY)."; \
	fi; \
	echo "Trivy filesystem reports generated in $(TRIVY_REPORTS_DIR)"; \
	exit $$scan_exit

.PHONY: trivy-scan-config
trivy-scan-config: check-trivy
	@mkdir -p $(TRIVY_REPORTS_DIR)
	@echo "==> Scanning configuration misconfigurations in repository"
	@scan_exit=0; \
	trivy config --severity $(TRIVY_SEVERITY) --exit-code 0 --format json -o $(TRIVY_REPORTS_DIR)/config.json . || scan_exit=1; \
	if [ $$scan_exit -eq 0 ] && grep -q '"Misconfigurations"' $(TRIVY_REPORTS_DIR)/config.json && grep -q '"Status":"FAIL"' $(TRIVY_REPORTS_DIR)/config.json && [ "$(TRIVY_EXIT_CODE)" != "0" ]; then scan_exit=$(TRIVY_EXIT_CODE); fi; \
	trivy convert --format sarif -o $(TRIVY_REPORTS_DIR)/config.sarif $(TRIVY_REPORTS_DIR)/config.json || scan_exit=1; \
	echo "==> Filtered configuration table (only when findings exist)"; \
	if grep -q '"Status":"FAIL"' $(TRIVY_REPORTS_DIR)/config.json; then \
		trivy convert --format table $(TRIVY_REPORTS_DIR)/config.json; \
	else \
		echo "No failing configuration findings detected for severity $(TRIVY_SEVERITY)."; \
	fi; \
	echo "Trivy config reports generated in $(TRIVY_REPORTS_DIR)"; \
	exit $$scan_exit

.PHONY: security-scan
security-scan: docker-build trivy-scan

.PHONY: security-scan-library
security-scan-library: docker-build trivy-scan-library

.PHONY: security-scan-full
security-scan-full: docker-build trivy-scan trivy-scan-library trivy-scan-fs trivy-scan-config
