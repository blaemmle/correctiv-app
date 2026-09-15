# ADR 0031 - CI/CD for a public repository

Status: proposed, 2026-09-10; discussion expanded on 2026-09-15. Build provider,
preview working mode and authenticated native distribution remain open.
This record does not implement the workflows.

The first discussion preferred GitHub Actions with Fastlane and automatic previews
for trusted PR branches. The follow-up reopened both choices: Expo EAS is an option,
and proving a PR can build does not imply somebody needs an installable preview of
it. The original approach remains below as Option A, not as a settled rejection of
EAS. The ownership, OSS trust boundaries and release-candidate requirements remain.

## Context

The repository is public. A contributor must be able to run its checks and compile
the app without receiving the credentials that make a build an official CORRECTIV
distribution. Public source, public binaries and permission to sign code are three
different decisions.

Today, [CI](../.github/workflows/ci.yml) checks the workspaces, builds the web app and
handbook, and conditionally compiles Android. It has no iOS job.
[Pages](../.github/workflows/pages.yml) publishes the handbook and app on pushes to
`main`. [Release Android](../.github/workflows/release-android.yml) builds a tagged
APK and attaches it to a GitHub Release, falling back to a committed test key when
real signing credentials are absent. It does not implement store submission.
[RELEASE.md](../RELEASE.md) describes the existing operation, not this proposal.

Build orchestration, artifact hosting and access control are separate concerns.
Uploading an Actions artifact does not create a hosted web preview or an
authenticated native installation service. A PR comment can present links but
does not provide either capability; sticky comments are outside this proposal.

### Impact of the main update, 2026-09-15

Reconciled with `main` at `39973c2`. The CI, Pages and Android release workflows
are unchanged, so the iOS pipeline and authenticated native distribution gaps
remain. ADRs 0026 through 0030 add constraints on the proposed setup; they do not
select EAS, Fastlane or a preview cadence.

**Native compilation matters independently of preview use.** The
[mobile dependencies](../apps/mobile/package.json) and
[platform adapter](../apps/mobile/src/lib/platform/expo.ts) now use MMKV with
Nitro Modules instead of AsyncStorage. This carries out the storage direction in
[ADR 0026](0026-react-native-review-and-hardening.md), whose earlier measurements
are not evidence that every platform has been verified. Web uses MMKV's
`localStorage` backend and therefore cannot prove native linking. Both native
compile checks must include the modules; a previously built client or a
JavaScript-only export is not a substitute after native dependencies change.
Candidate runtime review must check that settings and bookmarks survive a restart,
not just that the app opens.

**The handbook is now another consumer of mobile source.**
[ADRs 0027](0027-the-handbook-draws-the-apps-components.md) and
[0028](0028-one-shell-and-a-route-that-declares-its-context.md) add direct rendering
of app components through the handbook's
[Vite recipe](../apps/handbook/vite.app.mjs), beside the framed Expo app.
[ADR 0029](0029-the-handbook-keeps-its-own-primitives.md) keeps the handbook itself
on its DOM stack. An Expo export alone therefore does not verify or publish the
whole preview. Preserve both builds, the recipe's web-first resolution and plugin
order, and the root Vite dependency used by the handbook's plugins. The
[toolchain check](../apps/handbook/test/toolchain.test.ts) guards that resolution;
do not force Vitest's separate Vite dependency to the handbook's major. Mobile
component changes can break either build, and shared dependency or lockfile changes
must not be classified as handbook-only. The EAS Hosting option must accommodate
the assembled outputs, not replace the handbook build with an Expo export.

**Preview paths and fixtures need to match the current host.** Main fixes the
handbook's internal Markdown links to carry its base path. Verify document links,
direct route loads and the framed app at the actual nested PR path, not only asset
URLs. The handbook's
[storage fixtures](../apps/handbook/src/workbench/frame/seed.ts) now follow the
app's MMKV state/cache namespaces and mark handbook-seeded sessions. Those
namespaces separate state from cache, not one PR from another: path-based previews
still share browser storage until preview-specific namespacing is implemented.
Preserve the fixture/adapter consistency checks and keep session seeding in the
demo handbook, not in the native app's sign-in flow.

**Manual release review has concrete iOS gaps to close.**
[ADR 0030](0030-the-platforms-header-and-ours-on-web.md) introduces native headers
and explicitly records iOS as unrun. The
[German formatters](../packages/app-core/src/lib/format.ts) now depend on runtime
`Intl`, with iOS behaviour still unmeasured in that change. Before rollout, record
iOS evidence for headers, deep links/back navigation, accessibility text sizes and
German date/number formatting, alongside persistence. Node tests and a web preview
do not establish those native behaviours, regardless of which service builds them.

ADR 0026 also leaves reporting-provider and further tooling/localization work to
be completed. Neither this merge nor choosing EAS implicitly enables production
telemetry or introduces catalogue-generation or source-map-upload jobs. Add their
build and privacy requirements when those features are implemented.

## Proposed decision and open choices

### Option A: GitHub Actions with Fastlane

This option uses GitHub-hosted runners, Linux for Android and web, macOS for iOS,
with publicly available toolchains. Fastlane owns repeatable native build, signing
and submission lanes.

**Pros:** extends the existing Android pipeline, keeps orchestration and required
checks in one place, and leaves the build entry points usable without Expo's hosted
service. Standard GitHub-hosted runners are free for public repositories, subject
to GitHub's usage rules; storage and larger runners are separate considerations.

**Cons:** the team owns toolchain upgrades, keychains, Match storage and
distribution integration. Artifacts in the public repository are not tester-only
storage. The Pages preview publisher also needs its own lifecycle automation.

### Option B: Expo EAS, with GitHub Actions retained for checks and authorization

EAS is an option to discuss, not an adopted replacement. The smallest alternative
keeps secretless contributor checks and trust gates in GitHub Actions and uses
**EAS Build** for trusted native builds and internal distribution, and **EAS Submit**
for store uploads. GitHub Actions can trigger EAS; choosing it does not require
moving all CI to **EAS Workflows**.

**EAS Hosting** is a separate web-preview option. **EAS Update** is not required
for any of these choices, and OTA updates remain excluded.

| Area | Pros of EAS | Cons and conditions |
| --- | --- | --- |
| Native builds | Managed mobile build infrastructure reduces runner and toolchain setup. | Another service, build queues and usage/concurrency costs. Dependencies, Expo configuration and upgrade compatibility remain ours to maintain. |
| Signing | Managed credentials and provisioning support can replace much of the Match/keychain integration. Existing credentials can be supplied and exported. | Build inputs, credentials and artifacts reach another provider. CORRECTIV must own the Expo organization and retain credential backups and an exit path. |
| Ad-hoc distribution | Installation pages can require authorized Expo accounts, unlike public-repository Actions artifacts. | Anyone with the link can access internal builds by default. Authentication must be enabled; tester roles, download access, revocation and native retention need verification. Apple device registration and embedded device identifiers remain. |
| Store candidates | Submit can deliver selected binaries to TestFlight and Play internal testing. | Upload success is not public-release approval. Preserve exact build identity, unchanged promotion and separate preview/store access. |
| Optional web hosting | Distinct deployment hostnames and aliases could replace the custom Pages publisher and isolate PR origins. | The combined handbook/workbench and app needs a deployment proof. Hosting limits, cleanup and retention still need to match the chosen working mode. |
| OSS integration | Public GitHub checks can coexist with privately accessible native builds on EAS. | Managed signing does not make untrusted code safe. Do not expose Expo tokens or signing material to fork/bot jobs, or copy private binaries back into public Actions artifacts. |

Compare the [current EAS plans and usage pricing](https://expo.dev/pricing) against
the actual build cadence, not a presumed signed build on every PR push. Local
`eas build --local` does not buy the managed-runner benefit: the team still provides
the toolchains.

If EAS is selected, explicitly decide whether it replaces signing storage and
native distribution as well as compilation. GitHub environment protections remain
the authorization gate in the hybrid option; an EAS build profile or
environment-variable set is not an equivalent access-control boundary.

### Buildability is a gate; distribution is a working-mode choice

Keep the npm workspace boundary: install at the repository root and prebuild in
`apps/mobile` without a second dependency installation. Toolchain versions and
dependencies must be pinned deliberately, including the macOS/Xcode combination;
`latest` is not a release-reproducibility policy.

This extends the existing checks rather than reducing them to lint and typecheck.
App-affecting changes require the root checks, web and
handbook builds with their existing output assertions, and Android and iOS native
compile checks, even when nobody will install their output. Buildability
verification and generating a signed, downloadable review build are separate jobs
with different permissions and audiences.

Native checks must cover bundled JavaScript, not only a debug project that expects
Metro. Use release-like compilation without production or ad-hoc credentials:
Android can use a throwaway test key, and iOS can compile an unsigned device target.
An unsigned device build checks device compilation without producing an installable
ad-hoc IPA. Neither proves provisioning, store signing or runtime behaviour; those
need verification on the later delivery candidate.

Keep buildability checks usable on fork PRs without Expo or signing secrets.
Temporary native outputs can be discarded after recording the check result and
safe diagnostics; compiling does not require uploading an APK or IPA as an Actions
artifact. Required checks must represent a completed build for the current PR
revision. An EAS dispatch acknowledged with `--no-wait` is not that evidence.

Changes confined to documentation or other known non-native inputs may skip native
compilation. Unknown paths or an unreadable change list must build. Required check
configuration must distinguish an intentional skip from missing or failed evidence.

**Still to discuss: who uses previews, and when?** The following modes all retain
the PR buildability gate; they differ in whether they sign and distribute anything.
Web preview publication can follow a different cadence from native distribution.

| Working mode | Benefit | Cost or limitation |
| --- | --- | --- |
| Automatic previews for each eligible PR revision | Reviewers can install a change immediately, before merge. | Signing, distribution, storage and tester notifications may be wasted when nobody installs it. |
| Native PR previews on maintainer request | Pre-merge device review remains possible, but delivery work has an identified consumer. | Reviewers must request a build and wait; requests must bind to an exact reviewed revision. |
| Shared builds from `main`, on merge or a schedule | Testers get one integrated build instead of many competing PR builds. | Device review normally happens after merge; decide whether an on-demand PR exception is needed. |

Hybridheroes uses "Automatic previews for each eligible PR revision" but only as we do QA per PR by human.

A starting point for discussion is **verify every app-affecting PR, distribute
native previews on demand, and provide a shared `main` build when testers need
one**. This is not a selected cadence. An unused preview is not a reason to skip
buildability, and a passed buildability check is not a reason to distribute it.

Before choosing, establish who reviews native changes before merge, how often
testers need integrated builds, who may request delivery, and how quickly it must
arrive. Also decide whether web previews remain automatic. Record the chosen
cadence, retention and cost expectations before implementing preview triggers.

Automated runtime smoke tests are not selected in this decision. Before public
release, maintainers must run the candidate builds on devices and record the
results against their exact build identities. The
[existing runtime and visual review rules](../TROUBLESHOOTING.md#a-green-build-is-not-evidence)
still apply: compilation alone does not prove startup, navigation, playback or
appearance. Automatic preview availability is not release approval.

### Execution and publication have different trust boundaries

| Event or source | Verification | Publication or delivery |
| --- | --- | --- |
| Fork PR | Secretless checks and applicable builds | No automatic hosted preview. A maintainer may approve the exact revision for web publication. No signed native distribution from the fork. |
| Dependency-bot change | Treat as untrusted, even when it uses a repository branch | Explicit review is required before credentialed preview work. |
| Trusted-maintainer PR branch | Checks and applicable builds, whether or not a preview is used | Eligible for previews after the relevant checks pass; automatic versus on-demand publication remains open. Native delivery also requires an access-controlled distributor. |
| Push to `main` | Checks and applicable builds | Publish the existing handbook/app site after successful verification of that commit. A shared native tester build is a working-mode option, not yet a trigger. |
| Published GitHub release or prerelease | Verify the tag's source commit and required checks | Build and upload store-testing candidates to TestFlight and Play internal testing. No public store rollout. |
| Manual build-only run | The same source and credential restrictions | Build without store submission; do not turn the result into a public native artifact. |

Approval is attached to an exact commit, not a moving PR label or branch name. New
fork commits require new approval. Before a fork change can receive a signed
preview, a maintainer must review and promote it to a repository branch. A
cherry-pick or other change to that revision requires approval of the resulting
candidate, not an assumption that the old approval transfers.

If automatic signed previews are selected, repository branch-writing access
becomes a trusted role for signing. Those authors can cause npm lifecycle hooks,
Expo config plugins and native build
scripts to execute in a credentialed build. Restrict that role to trusted
maintainers. On-demand delivery still authorizes the same code execution; its
request is not a sandbox. Promotion is a trust decision in either mode.

Do not use `pull_request_target`, or a privileged `workflow_run` continuation, to
check out and execute untrusted PR code. Approved fork web publication may consume
a secretless build's static output, but the publisher must use trusted workflow
code, validate the source repository/run/commit and expected artifact contents,
and never execute scripts from that artifact.

Default workflow permissions to read-only and grant writes only to the jobs that
need them. Protect `main`, release tags and store environments; require review of
workflow and signing changes. Preview jobs must not receive store-submission
credentials. Pin actions to reviewed commit SHAs and keep build secrets, temporary
keychains, environment files and sensitive logs out of published outputs.

### CORRECTIV owns the release identity

CORRECTIV owns the Apple and Google accounts, signing infrastructure and preview
domain. Hybrid Heroes receives delegated access. A handover should revoke access,
not require moving the app's identity to another owner.

Under Option A, use Fastlane Match in separate private signing storage, not a
branch of the public source repository. CI reads certificates and provisioning
profiles in read-only mode. Under Option B, evaluate EAS-managed credentials under
a CORRECTIV-owned Expo organization instead. In either case, device registration,
profile renewal and certificate maintenance are maintainer-controlled operations
rather than side effects of an untrusted PR build.

For Option A, Android keystores, Match access/decryption credentials and store API
credentials belong in appropriately protected GitHub environments. The EAS option
must likewise protect its CI access token and enforce separate preview and store
credential access. Neither a branch name in a signing repository nor an EAS
profile name is an access-control boundary. The provisioned storage and credentials
must enforce the intended scope.

A production signing failure is a failure. The existing committed test key may
remain useful for explicitly local/test builds, but must never become the fallback
for a store candidate. Preview signing must also be intentional and visibly
different from production.

### One preview app, separate from production

When requested or scheduled under the working mode still to be chosen, review
deliverables target a web preview, an Android APK and an ad-hoc iPhone build for
registered devices. That does not require distributing all three for every PR.
Native previews, including shared `main` tester builds, use the fixed identity
`org.correctiv.app.preview`, the display name "CORRECTIV Preview", and a separate
URL scheme and non-production configuration.

This keeps preview installs, storage and links separate from the production app,
whose identity remains `org.correctiv.app` under
[ADR 0011](0011-naming-the-app-for-release.md). There is one preview app per device,
not one app per PR: installing a different PR replaces the previous preview.
Build numbers must increase across preview branches, not restart for each PR.

Ad-hoc distribution still requires Apple device registration and an appropriate
provisioning profile. A newly registered device needs an updated profile and a
newly signed build. Changing the download host cannot remove that requirement.

### Pages is one option for public web previews, on a separate origin

Keep the existing handbook site unchanged. If Pages is chosen for PR previews,
the following layout and lifecycle apply to the PRs selected for publication.
EAS Hosting is an alternative under Option B, not a requirement for EAS Build.

For Pages, create a separate publishing repository with a CORRECTIV-controlled
preview hostname different from the
handbook's hostname. A second repository under `faktenforum.github.io` alone is
insufficient: its path changes, but its origin does not.

Use a layout such as `https://<preview-host>/pr/<number>/`, with that PR's handbook
and workbench at the directory root and its app under `app/`. Set `HANDBOOK_BASE`
and `EXPO_BASE_URL` for those actual paths. Each preview's workbench and app remain
same-origin, preserving
[ADR 0024](0024-the-handbook-owns-the-root.md), while being isolated from the
published handbook. Both asset URLs and direct route loads must work at this depth.
Pages cannot supply arbitrary server-side rewrites.

Export production web bundles, as required by
[ADR 0025](0025-the-published-app-is-a-production-bundle.md). A preview is a review
deployment, not an instruction to export with `--dev`. The published workbench's
existing limitations remain.

PR directories on this preview hostname still share an origin with one another.
That is an explicitly accepted limitation, not per-PR isolation. Use demo fixtures
only: no real member sign-in, sensitive member content or production credentials.
Do not share authentication cookies with the preview hostname. Namespace demo
storage to avoid accidental state carry-over, without pretending that a storage
prefix stops another same-origin script reading it.

Ordinary GitHub Pages provides one site per repository, not isolated per-PR
deployments. The publisher must assemble the complete desired site into one
artifact; deploying one PR's directory alone would replace the other previews.
Use one trusted, serialized publisher with narrowly scoped access to the preview
repository. Build jobs must not write directly into the published site.

Keep only the latest successful revision for each open PR. Remove it on closure;
there is no inactivity expiry. Reconcile closed PRs periodically so a missed event
does not leave a preview indefinitely. Serialize cleanup with publication and
recheck PR state and revision before publishing, so an older run cannot overwrite
a newer result or recreate a closed preview. Enforce the hosting capacity limit
before deployment; no inactivity expiry is not unlimited storage.

The landing page and workflow summary identify the commit, run and platform
status. If a new build fails, any retained preview is clearly identified as the
older successful revision. No sticky PR comment is required.

### Native distribution is deliberately unresolved

Native downloads must be access-controlled for invited testers. Public source does
not waive that requirement. An ad-hoc IPA includes its provisioning profile and
registered device identifiers: restricting which devices can install it does not
restrict who can download or inspect it.

Actions artifacts in this public repository do not provide tester-only access.
Any signed-in GitHub user with read access to a public repository can download
them. Retention and hard-to-guess links do not change that audience, and deleting
an artifact cannot revoke copies. Do not upload native preview binaries or signed
archives there as an interim workaround. In particular, the current CI APK upload
would need to change when implementing this policy.

Pages therefore hosts web previews and public landing pages, not native binaries,
embedded profiles or bearer-token download links. A landing page can eventually
link to an authenticated tester portal, but does not implement its access control.

Firebase App Distribution was considered because it supports Fastlane delivery of
Android APKs and ad-hoc IPAs to invited testers. It was **not selected**. It would
add Google accounts for testers and another data processor. A private GitHub
distribution repository was also discussed; restricting artifact readership would
not itself create an over-the-air iPhone installation experience.

EAS internal distribution is now another option under discussion. Disable
**"Unauthenticated access to internal builds"**: Expo documents that doing so
requires an authorized Expo account rather than just possession of the link.
The access setting, not using EAS alone, addresses the open-download risk.
Before selecting it, verify that an invited tester can install the intended build
with minimal privileges, that anonymous and unauthorized accounts cannot download
it, and what removal of access and artifact retention actually do. Authorized
recipients can still inspect embedded device identifiers and redistribute copies.
Do not assume the documented organization roles provide per-build tester groups.

The distributor, authentication/installation experience, native retention and
private artifact storage for retries remain open. Resolve them before enabling
native preview distribution or relying on retained native candidates. Do not
silently weaken access control to make an installation link work.

### A store upload is a candidate, not a public release

Publishing a GitHub release, including a prerelease, authorizes uploads to
TestFlight and Google Play internal testing. Accept only protected release tags
pointing to reviewed `main` commits with successful required checks. A public
GitHub release event alone is not sufficient source authorization.

Public store rollout remains manual, after runtime testing of the candidate.
Maintain a build record tying each platform's source SHA, app identity, version,
build number, artifact digest and store-side build identifier together. Do not
report a release complete while one platform failed to build, upload or process.

Promote the tested store-ready binary unchanged. The preview app cannot be that
binary because its identity, signing and configuration differ. An upload retry
reuses its candidate; a rebuild creates a new candidate and returns through
testing.

Allocate native build numbers monotonically across competing runs of the same app
identity, with serialized allocation rather than racing to increment the latest
store number. Workflow-local run numbers are not a shared allocator across several
workflows. Map prerelease tags to store-valid marketing versions separately from
their unique native build numbers.

Do not cancel an irreversible store submission merely because another candidate
starts. Record partial success and retry the missing delivery without rebuilding
the successful candidate. A rollback may halt a rollout; a replacement binary
from known-good source is still a new candidate with a higher build number, not a
device downgrade.

OTA JavaScript updates are outside this setup. Adding a production path that
bypasses the store-candidate process requires a separate ADR.

## Why not the alternatives

**EAS is no longer a rejected alternative.** The original discussion preferred
extending the existing Android pipeline. The follow-up reopened that choice because
managed signing and authenticated internal distribution may justify the service
cost. Option B records the trade-offs without committing to a provider.

**Put PRs beside the existing handbook.** Easy deployment, but unmerged JavaScript
would share the trusted site's origin. A separate preview hostname contains that
exposure without breaking the workbench's same-origin access to its own app.

**Give every PR its own hostname.** Stronger browser isolation, but not a native
ordinary-Pages feature. The Pages option uses a shared demo-only preview origin
instead of the additional site/domain lifecycle machinery. EAS Hosting reopens
per-PR origins as an option without requiring us to provision a Pages site per PR.

**Public APK/IPA downloads from Pages or Actions.** Operationally simpler, but
rejected in favour of tester-only native access. An open-source licence is not
consent to publish test-device identifiers.

**Ad-hoc iOS versus TestFlight for review.** Ad-hoc remains the proposed format for
native previews when they are needed, not a commitment to create one per PR.
TestFlight remains the path for store candidates. If testers mainly review shared
`main` builds, revisit whether ad-hoc distribution and its device/profile maintenance
are still worth operating.

## What must exist before this can run

Three connected decisions are open: the build/signing provider, the preview
working mode, and authenticated native distribution including retention and
private retry storage. Choose the working mode before estimating service cost or
building a per-PR distribution system. The choices may require revisiting the
ad-hoc-versus-TestFlight trade-off; this record does not preselect a vendor.

Provisioning prerequisites are CORRECTIV-owned store accounts, app identifiers,
preview signing material, protected environments and release tag rules. Depending
on the selected options, also provision read-only Match storage or a CORRECTIV
Expo organization with appropriately scoped access, and the isolated preview
hosting. A separate Pages repository and verified HTTPS hostname are specific to
the Pages option. None of these resources is claimed to have been created.

Implementation must demonstrate the actual boundaries: a fork cannot receive
secrets or trigger signed delivery; an app-affecting PR is compiled even when no
preview is requested, without publishing its native output; a new commit loses
approval; closed or superseded PRs cannot be republished by stale runs; preview
code cannot reach the
handbook's origin; native binaries remain unavailable to uninvited readers; and
store rollout selects the same candidate that was tested. It must also demonstrate
subpath navigation in the web preview and installation/update on a registered
iPhone and an Android device. A workflow success badge is not that evidence.

## What this retires

Nothing yet. This is a proposed replacement, not a claim that existing workflows
have changed. ADR 0011's production identity, ADR 0024's same-origin requirement and
ADR 0025's production-export requirement remain intact.

When implemented, update `RELEASE.md` and the affected workflow descriptions to
replace tag-triggered public APK delivery and test-key fallback with the agreed
candidate/distribution policy. Do not rewrite today's instructions as if that
migration has already happened.

## References

- [GitHub: fork workflow behaviour](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflows-in-forked-repositories)
- [GitHub: secure use of Actions](https://docs.github.com/en/actions/reference/security/secure-use)
- [GitHub: downloading Actions artifacts](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/download-workflow-artifacts)
- [GitHub: Pages sites](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- [GitHub: custom Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [GitHub: Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)
- [Expo: GitHub Pages and web base paths](https://docs.expo.dev/guides/publishing-websites/#github-pages)
- [Expo: triggering EAS builds from GitHub Actions or other CI](https://docs.expo.dev/build/building-on-ci/)
- [Expo: internal distribution and authenticated build access](https://docs.expo.dev/build/internal-distribution/)
- [Expo: organization ownership and access roles](https://docs.expo.dev/accounts/account-types/)
- [Expo: syncing signing credentials](https://docs.expo.dev/app-signing/syncing-credentials/)
- [Expo: Hosting deployments and aliases](https://docs.expo.dev/eas/hosting/deployments-and-aliases/)
- [Expo: current plans and pricing](https://expo.dev/pricing)
- [GitHub: Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
- [Firebase: Fastlane delivery for iOS](https://firebase.google.com/docs/app-distribution/ios/distribute-fastlane) and [Android](https://firebase.google.com/docs/app-distribution/android/distribute-fastlane), evaluated but not adopted
