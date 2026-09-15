# ADR 0031 - CI/CD for a public repository

Status: proposed, 2026-09-10; revised 2026-09-15. Build provider, preview cadence
and authenticated native distribution remain open. No workflows are implemented
by this record.

## Context

Contributors to this public OSS repository must be able to verify buildability
without credentials. Signing official builds and distributing them to testers
are separate, privileged operations.

Existing [CI](../.github/workflows/ci.yml) covers checks, web/handbook builds and
conditional Android compilation, but not iOS.
[Pages](../.github/workflows/pages.yml) publishes the handbook and app from `main`.
The [Android release workflow](../.github/workflows/release-android.yml) publishes
tagged APKs with a test-key fallback; it does not submit to stores.
[RELEASE.md](../RELEASE.md) describes that current setup.

## Build-provider options

| Option | Pros | Cons |
| --- | --- | --- |
| **A: GitHub Actions + Fastlane** | Extends existing CI; public toolchains and locally usable build lanes; standard hosted runners are free for public repositories under GitHub's usage rules. | We maintain Linux/macOS toolchains, signing/keychains and private Match storage. Tester-only distribution and preview hosting need separate integration; storage and larger runners may cost extra. |
| **B: GitHub Actions + Expo EAS Build/Submit** | Managed native builds, signing and store uploads; internal installation pages can require Expo authentication. Existing credentials can be imported/exported. | Another provider receives build inputs and credentials; queues, concurrency and usage costs depend on cadence. Tester permissions and retention need verification. Managed signing does not make untrusted code safe. |

Option B retains GitHub Actions for secretless contributor checks and authorization.
Moving orchestration to EAS Workflows is optional. EAS Hosting is a separate web
hosting choice; EAS Update/OTA is outside this ADR.

Compare [EAS pricing](https://expo.dev/pricing) with the working mode below, not
an assumed signed build on every PR push. If selected, clarify whether EAS replaces
compilation, credential storage and native distribution, or only some of them.

## Buildability versus preview availability

**Every app-affecting PR must prove buildability, even if nobody installs it:**
root checks, both web builds, and Android/iOS native compilation with bundled
JavaScript. Android may use a throwaway test key; iOS may compile an unsigned device
target. Fork checks must work without Expo or signing secrets. Discard unused
native output rather than publishing it.

Use the root workspace installation and pinned toolchains. Known non-native-only
changes may skip native compilation; unknown scope must build. Shared dependencies
and lockfiles are not handbook-only changes. Required checks must describe the
completed build of the current revision, not merely a successful EAS dispatch.

Preview cadence remains a working-mode decision:

| Mode | Useful when | Trade-off |
| --- | --- | --- |
| Automatic previews for eligible PR revisions | Every PR gets human device QA. | Signing and delivery are wasted when nobody uses the build. |
| Native previews on maintainer request | Only selected changes need pre-merge device review. | A reviewer must request and wait for an exact-revision build. |
| Shared `main` builds on merge or schedule | Testers mainly review the integrated app. | Device feedback arrives after merge unless PR previews are also available on demand. |

Hybrid Heroes uses automatic PR previews because each PR receives human QA.
The suggested starting point here is **PR buildability, on-demand native previews
and shared tester builds as needed**, not yet a selected cadence. Web previews may
follow a different cadence. If shared builds suffice, reconsider whether ad-hoc
distribution is needed alongside TestFlight.

## OSS trust and ownership

- **Forks and bots are untrusted.** No secrets or automatic publication. Fork web
  publication requires approval of the exact revision; signed fork work requires
  reviewed promotion to a repository branch. Changed revisions need new approval.
  Trusted-maintainer branches are eligible after checks, subject to the chosen
  cadence. A signed build executes its source with credentials; a request or
  promotion is a trust decision, not a sandbox.
- **Separate verification from publication.** A privileged `pull_request_target`
  or `workflow_run` must not execute untrusted PR code. A web publisher uses trusted
  code, validates the source/run/SHA and static artifact, and never executes artifact
  scripts. Default permissions to read-only, pin actions to reviewed SHAs and protect
  `main`, release tags, workflow changes and credentialed environments.
- **CORRECTIV owns the release identity:** store accounts, signing infrastructure,
  preview domain and any Expo organization; agency access is delegated. Option A
  uses private Match storage with read-only CI access. Either option must enforce
  separate preview/store credential access and keep secrets out of outputs. EAS
  profile names are not access-control boundaries. Production signing must fail
  rather than fall back to a test key.

## Distribution

### Public web previews

Pages can host previews at `https://<preview-host>/pr/<number>/` in a separate
publishing repository. Use a dedicated hostname: another repository under the same
`faktenforum.github.io` host does **not** isolate unmerged code from the main site.

Each preview contains the handbook/workbench and its app under `app/`, preserving
[same-origin access](0024-the-handbook-owns-the-root.md). Use
[production web exports](0025-the-published-app-is-a-production-bundle.md) and verify
assets, document links, direct routes and fixtures at the actual nested base path.
Pages does not provide arbitrary server-side rewrites.

All PR paths on that host still share an origin. Use demo data only, no real
member sessions, sensitive content or production credentials/cookies. Namespace
demo storage to prevent accidental carry-over, not as a security boundary; MMKV's
existing state/cache namespaces do not isolate PRs.

Pages replaces the whole site on deployment. One trusted, serialized publisher must
retain the latest successful revision per open PR, remove closed PRs, reconcile
missed cleanup and reject stale runs. No inactivity expiry is planned; enforce
hosting limits and identify retained older builds clearly when a newer build fails.
Sticky PR comments are out of scope.

EAS Hosting offers distinct deployment hostnames as an alternative, but must first
prove it can serve the combined handbook/app output and meet the chosen lifecycle.
Neither hosting option is a native download service.

### Invited-tester native previews

When needed, provide an Android APK and ad-hoc iPhone build for registered devices.
Use `org.correctiv.app.preview`, "CORRECTIV Preview", a separate URL scheme and
non-production configuration/storage. One preview replaces another on the device;
[production remains `org.correctiv.app`](0011-naming-the-app-for-release.md).
New iPhone registrations require updated provisioning and signing.

**Native downloads must be tester-only.** Public-repository Actions artifacts and
Pages do not meet that requirement. Ad-hoc installation restrictions do not prevent
downloads: IPAs expose embedded provisioning profiles/device identifiers.

EAS internal builds are accessible to anyone with the link by default. Disable
**"Unauthenticated access to internal builds"** to require an authorized Expo
account. Before adoption, verify least-privileged tester installation, denial of
anonymous/unauthorized downloads, revocation and retention. Authorized recipients
can still inspect or copy binaries; do not assume per-build tester groups exist.

The distributor and private storage for upload retries remain open. Firebase App
Distribution and a private GitHub distribution repository were also discussed,
neither selected. Do not publish binaries publicly as an interim workaround.

### Store candidates

A published GitHub release or prerelease triggers TestFlight and Play internal
testing candidates only when its protected tag points to reviewed `main` with
successful checks. Publishing the existing handbook/app from `main` remains separate.

**Public store rollout is manual and promotes the tested binary unchanged.**
Record source SHA, app identity/version, build number, artifact digest and store
build ID. Preview binaries cannot be promoted because their identity differs.
Allocate increasing build numbers across runs per app identity and use store-valid
versions. Retry uploads with the same candidate; rebuilding creates a new candidate.
Track partial platform failures without cancelling irreversible submissions or
claiming the whole release succeeded.

Record device testing against those build identities before rollout; automated
runtime smoke tests are not selected here. Compilation alone proves neither signing
nor runtime behaviour. Current review gaps include persistence across restart,
[iOS native headers/navigation](0030-the-platforms-header-and-ours-on-web.md), text
scaling and German `Intl` formatting. The
[runtime/visual review rules](../TROUBLESHOOTING.md#a-green-build-is-not-evidence)
still apply.

## Open decisions and adoption

1. Who performs pre-merge device QA, which builds do testers use, and who may request
   them? Choose native/web cadence before estimating cost.
2. Fastlane or EAS, and which signing/distribution responsibilities move with it?
3. Which authenticated native distributor, tester roles, retention and private retry
   storage? Pages or EAS Hosting for public web previews?

Before enabling delivery, provision CORRECTIV-owned identities, credentials and
protected environments; demonstrate the fork, approval, publication and download
boundaries above, real device installation, and unchanged candidate promotion.

**This retires nothing yet.** On implementation, update `RELEASE.md` and workflows
to replace public APK delivery and production test-key fallback. Existing identity,
same-origin and production-export decisions remain intact.

## References

- [GitHub: secure Actions](https://docs.github.com/en/actions/reference/security/secure-use), [artifact downloads](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/download-workflow-artifacts) and [billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
- [GitHub: Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) and [limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)
- [Expo: builds from CI](https://docs.expo.dev/build/building-on-ci/) and [credential portability](https://docs.expo.dev/app-signing/syncing-credentials/)
- [Expo: internal distribution](https://docs.expo.dev/build/internal-distribution/) and [account roles](https://docs.expo.dev/accounts/account-types/)
- [Expo: Hosting deployments and aliases](https://docs.expo.dev/eas/hosting/deployments-and-aliases/)
