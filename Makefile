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
	esac; \

.PHONY: dry-release
dry-release:
	@if [ -z "${TAG}" ]; then \
		echo "Error: TAG variable is not set."; \
		exit 1; \
	fi
	git-chglog -o CHANGELOG.md --next-tag ${TAG} && \
	npx prettier CHANGELOG.md --write
