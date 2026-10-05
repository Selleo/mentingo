# Chromium seccomp profile

Based on the Docker/Moby default seccomp profile at commit 65adc7e022c97f55e45c054ff012988027733b87 (Apache-2.0); adds allow for clone, setns and unshare without CAP_SYS_ADMIN, retaining clone3 ENOSYS fallback and other default restrictions. Apply to the API container with init: true. Verify user namespaces and AppArmor on the actual deployment host.
