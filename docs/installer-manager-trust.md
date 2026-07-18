# Installer manager trust contract

`install.sh` authenticates the architecture-specific native manager by its
immutable SHA-256 before executing the exact inherited file descriptor. The
manager owns all install, update, rollback, and uninstall filesystem mutation.

## Expected public release mode

Public install or update requires `--attestation-receipt PATH`, where `PATH`
is the expected `installer-manager-bundle.json`. It is an Ed25519 signed
bundle. The public manager embeds the release verification key from
`installer-manager/public-key.toml`; no public receipt is trusted by itself.
The signed bytes use explicit length-prefixed binary framing over schema, key
id, repository, workflow, tag, version, source commit, manifest digest, every
asset record (`name`, target, platform, size, SHA-256), and attestation metadata.

Release CI may sign this bundle only after `gh attestation verify` succeeds for
the release artifact, `abran-labs/ai-auth-kit`, the SLSA provenance predicate,
and `.github/workflows/release.yml`. Source files describe that gate, but only a
real successful GitHub verification can establish that an artifact has the
attestation. Local QA cannot make that claim, and this document does not claim
that a public bundle, release, or successful public verification exists.

The manager rejects missing, unsigned, forged, wrong-key, wrong-repository,
wrong-workflow, wrong-tag, wrong-digest, duplicate, or non-exact asset bundles
before opening the selected artifact. GitHub verification remains a release-time gate,
but Ed25519 bundle verification is the manager's trust root.

Before it verifies provenance or opens an artifact, the manager requires the
manifest to be the canonical six-record inventory with unique filenames,
targets, platform selectors, and SHA-256 values. `SHA256SUMS` must be the exact
one-to-one projection of those six records; duplicate, extra, or missing lines
are rejected. Signed provenance also rejects duplicate asset names before any
managed filesystem mutation.

The manager first opens the external release directory component-by-component
through a held no-follow descriptor. It opens `manifest.json` and `SHA256SUMS`
relative to that descriptor with no-follow and nonblocking flags and requires
regular files, preventing symlink traversal and FIFO blocking. It hashes and
parses the held manifest, validates the checksum projection, then verifies the
signed bundle against that manifest digest.

After the bundle matches, the manager opens the selected artifact through the
same held directory with no-follow and nonblocking flags, requires a regular
file, checks declared size, hashes that same held file descriptor, and compares
digest and size with the signed and manifest records. Only then may musl
prerequisite inspection invoke `ldd` on `/proc/<pid>/fd/<held-fd>`. A pathname
replacement cannot redirect that loader inspection to another inode.

The external release directory can be read-only and need not be owned by the
invoking user. Trust comes from the signed digest plus the identity of the held
no-follow file descriptor, not release-directory ownership. `SHA256SUMS` alone
only checks manifest consistency. There is no checksum-only public fallback;
missing valid signed provenance makes install/update fail.

## Alpine musl runtime

The manager binaries are static musl executables. Bun musl CLI artifacts need
both `libstdc++.so.6` and `libgcc_s.so.1`, supplied by the minimal Alpine
command `apk add --no-cache libstdc++`. The signed manifest records these exact
runtime prerequisites. If they are absent, the manager preflight fails with
that command before activation rather than allowing a dynamic-loader crash.

The release matrix runs x64 and arm64 Alpine 3.21 containers: each validates
the missing-prerequisite preflight, runs its musl CLI after that package is
installed, and executes the corresponding static manager.

## Protected release signing

`.github/workflows/release.yml` is dispatch-only and needs both an explicit
`release_tag` and `confirm_release=true`. GitHub's `release` environment gates
the provenance-verification-and-signing job, and
`INSTALLER_MANAGER_SIGNING_KEY` appears only in that protected job. Repository
administrators must configure required reviewers for the environment and
protect release tags; those GitHub settings cannot be enforced by source code.

Public release activation remains gated on a real GitHub-generated attestation
and a successful `gh attestation verify` receipt. This repository has no local
substitute for that proof.

## Local test mode

Tests build a separate `test-manager` binary into
`installer-manager/target-test-manager`. Only that binary accepts
`--test-attestation PATH`, verified with the distinct fixture public key in
`installer-manager/test-public-key.toml`. Public artifacts omit this mode and
reject fixture signatures.

## Lifecycle input boundary

Install and update read the supplied release directory and require exactly one
receipt. Rollback and uninstall do not load release inputs or receipts. They use
locally retained managed generation/state created by an earlier verified
install/update. `--release-dir DIRECTORY` remains syntactically required by the
current parser in every mode, but rollback/uninstall do not read `DIRECTORY`.
Rollback requires an active generation with a retained prior generation and
creates a new generation pointing at that managed object.

## Filesystem boundary

The manager anchors managed directories in held directory file descriptors and
uses `openat2` with a no-follow `openat` fallback for components. Objects and
generations are immutable; `current` is atomically replaced only after a
complete generation is durable. Activation creation uses a final-name,
non-overwriting `symlinkat` operation: an existing foreign leaf, including a
symlink, regular file, or FIFO, makes the operation fail without replacement.

### Normal user-local threat model

This manager protects a normal user's local installation against unsafe state
that exists when the manager validates it. Public manager mode fails closed
before mutation for an untrusted artifact or bundle; an invalid signed release
bundle; a symlink, FIFO, socket, or other non-regular artifact; an unsafe
managed root or child; and a foreign activation, including a root or activation
replacement observed during validation. `--force` never authorizes replacing or
removing a foreign activation observed at validation. These checks, the held
descriptor traversal, fault recovery, and the signed bundle checks remain
release requirements.

For a pre-existing managed lifecycle directory, “safe” means the held
no-follow directory descriptor resolves to a directory owned by the manager's
effective UID with neither group nor world write permission. This policy applies
before install creates a lock or activation to the managed root, `objects`, and
`generations`, and before reuse to versioned generation directories; new
directories are created `0700`. During uninstall, each held no-follow directory
is validated immediately before traversal; discovery of an unsafe entry preserves
that entry and stops teardown, but does not promise rollback of previously
removed safe entries.

An active hostile process with the same UID can still swap a pathname after its
last validation and before a later POSIX pathname operation. That post-validation
same-UID race is out of scope for this normal user-local model. The manager does
not follow or execute the activation target, uses non-overwriting activation
creation, and clears the originally held managed directory rather than reopening
the root pathname; those properties limit what the manager acts on, but cannot
turn POSIX pathnames into a hostile-same-UID security boundary.

`~/.local/bin` is a shared user namespace, so POSIX provides no conditional
unlink-by-inode or `rmdir` operation safe against that same-UID pathname swap.
Uninstall therefore never unlinks the activation name or removes the managed
root pathname. After a second managed-target preflight, it clears the original
held manager directory and leaves the empty root plus the expected activation
link in place. Until reinstall, that activation link is intentionally dangling;
reinstall reuses the stable locations and restores its managed target. A foreign
leaf or root-path replacement observed at validation fails closed, including
with `--force`.

Post-validation same-UID swap tests are evidence for the no-follow/no-execute
properties above, not release blockers requiring impossible conditional
unlink/rmdir deletion. A guarantee against an actively hostile same-UID actor
would require a privileged root service (or an equivalent ownership-separated
service); this installer deliberately does not install one.
