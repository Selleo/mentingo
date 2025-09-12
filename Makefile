.PHONY: release
release:
	@if [ -z "${TAG}" ]; then \
		echo "Error: TAG variable is not set."; \
		exit 1; \
	fi
	git-chglog -o CHANGELOG.md --next-tag ${TAG} && \
	npx prettier CHANGELOG.md --write && \
	git add CHANGELOG.md && \
	git commit -m "docs: update changelog for version ${TAG}" && \
	git tag -a ${TAG} -m "${TAG}" && \
	git push origin HEAD --tags

.PHONY: dry-release
dry-release:
	@if [ -z "${TAG}" ]; then \
		echo "Error: TAG variable is not set."; \
		exit 1; \
	fi
	git-chglog -o CHANGELOG.md --next-tag ${TAG} && \
	npx prettier CHANGELOG.md --write