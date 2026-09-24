# ADR 0064 - CI/CD for a public repository

Status: accepted with the client on 2026-09-24; implementation pending.
First proposed 2026-09-10. This record changes the intended setup, not the workflows.

## 1. Decision

Use **GitHub Actions with Fastlane**: verify builds on PRs, distribute a separate
review app from `main`, and build release candidates when a GitHub release is
published. EAS is deferred. This extends the existing pipeline without introducing
another build provider.

| Trigger | Android | iOS | Purpose |
| --- | --- | --- | --- |
| Every PR revision | Build an APK with a throwaway test key | Build an unsigned simulator `.app` | Verify buildability without signing or store secrets; no tester distribution |
| Every merge into `main` | Sign a review APK and publish it with the workbench | Build the review app and upload it to internal TestFlight | Give testers the integrated app |
| Published GitHub release or prerelease | Build a release AAB and upload it to Google Play internal testing | Build the release app and upload it to internal TestFlight | Produce candidates for the production app |

Publishing a GitHub release does **not** authorize public store rollout.
Release tags must point to reviewed `main` commits with successful required checks.

## 2. Build verification

Keep root checks and both web builds alongside native PR builds. Use the root
workspace installation and pinned toolchains, including Xcode. Bundle JavaScript
into the native outputs; a debug build that depends on Metro is not sufficient.
Fork and bot PRs use the same secretless verification. Do not publish their output
as official review builds.

An iOS simulator build does not prove device compilation, provisioning or signing.
The signed device build on `main` covers that gap after merge; this is the accepted
trade-off. Neither build proves runtime behaviour. Record device testing before
public rollout under the [existing review rules](../TROUBLESHOOTING.md#a-green-build-is-not-evidence).

## 3. Review and release identities

| App | Bundle/package ID | Delivery |
| --- | --- | --- |
| CORRECTIV Preview | `org.correctiv.app.preview` | Public review APK; separate App Store Connect app with internal TestFlight |
| CORRECTIV | `org.correctiv.app` | Release app: internal TestFlight and Play internal testing, later public rollout |

Keep separate URL schemes, storage and configuration so both apps can be installed
together. The review APK uses a stable, protected signing key so testers can update
in place; it must not use the public test key. Release signing uses the production
identity from [ADR 0011](0011-naming-the-app-for-release.md), with no test-key fallback.

Both iOS apps initially distribute to **internal TestFlight groups**, whose members
need App Store Connect access. Configure automatic distribution after processing.
External testing can be enabled manually when needed, subject to Apple's Beta App
Review requirements. Use normal App Store distribution builds, **not** the
"TestFlight Internal Only" export, which would prevent external testing and public
release of those binaries. Upload success alone does not mean a build is available
to testers; report processing and distribution failures.

## 4. Versions and delivery

Every `main` build increases the native build number, **not** the user-visible
patch version. GitHub release tags set the user-visible version; it stays unchanged
between releases. Allocate increasing native numbers per app identity across runs,
including rebuilds, and record the source SHA, version, build number and digest.
Do not commit generated build-number bumps back to `main` and trigger a build loop.

Every merged revision gets a build; newer merges must not silently discard queued
ones. Serialize numbering and publication, and prevent an older completion from
replacing the latest download. Do not cancel store submissions already in progress.

Upload retries reuse the same binary. A rebuild gets a new build number and must be
tested again. Track each platform's delivery separately. Public rollout remains
manual and promotes the tested **release** candidate unchanged; a review-app binary
cannot be promoted because its app identity differs.

### 5. Android download on the documentation site

Host the **latest successful review APK alongside the workbench on GitHub Pages**,
with a download button and QR code pointing to its public HTTPS download URL.
Display its version, build number and source revision, label it as a review app,
and explain Android's sideloading requirement. No GitHub login should be needed.

Publish the APK, QR code and build metadata together so they cannot describe
different builds. A failed build leaves the last successful APK available and
clearly identified as such. The next successful publication replaces it; Pages is
not a historical binary archive.

Pages replaces the whole site, so coordinate workbench/app deployment and APK
publication through one publisher. Documentation-only deployments must preserve
the current APK. Retain a recoverable copy of the latest APK outside the assembled
site so it can be republished without rebuilding it. Preserve the workbench/app's
[same-origin layout](0024-the-handbook-owns-the-root.md) and
[production web export](0025-the-published-app-is-a-production-bundle.md), with the
[workbench owning the site root](0037-the-whole-site-is-the-workbench.md).

Public APK download is intentional. Review builds must not contain secrets, private
fixtures or privileged production access. Per-PR hosted web previews and sticky PR
comments are not part of this setup.

## 6. Signing and OSS trust

CORRECTIV owns the store accounts, signing keys and **private Fastlane Match
repository**; agency access is delegated. Store iOS certificates, private keys and
App Store provisioning profiles encrypted in Match, for both app IDs.

A **dedicated read-only SSH deploy key** can give CI access to that repository.
Keep its private key and `MATCH_PASSWORD` in protected GitHub environment secrets.
Run Match with `readonly: true` in delivery jobs using a temporary keychain;
certificate/profile creation and renewal are separate maintainer operations.
The deploy key grants repository access, not decryption or store-upload rights.
App Store Connect API credentials, Android signing keys and Google Play service
account access are separately required.

PR jobs receive none of those credentials. Only reviewed `main` and authorized
release jobs may sign or upload; separate review/release permissions as far as the
providers allow. A branch or folder in Match is not an access-control boundary.
Do not execute untrusted PR code through privileged `pull_request_target` or
`workflow_run` jobs. Protect `main`, tags and workflow changes, default token
permissions to read-only and pin actions to reviewed SHAs.

Publish only the intended review APK, not signing files, device profiles, logs with
secrets or iOS archives. Private delivery artifacts need retention sufficient for
upload retries; public Actions artifacts are not private storage.

### 7. No ad-hoc iOS distribution

TestFlight avoids collecting tester UDIDs for ad-hoc provisioning. Ad-hoc builds
are excluded for now. Reintroducing them requires a separate distribution/privacy
decision and advance communication and informed agreement with device owners:
**a publicly downloadable IPA can expose registered UDIDs in its embedded profile**.
Open-source code does not itself require public profiles or public IPA downloads.

## Adoption and remaining setup

Before implementation, provision both App Store Connect app records and internal
groups, the release app's Play internal track, signing credentials and protected CI
access. Specify build-number allocation and private artifact storage/retention,
including recovery of the latest APK. Verify APK installation/update and QR download
on a device, TestFlight availability, and Play delivery with the intended app IDs.

This accepts a different working mode from the earlier proposal: EAS and preview
cadence are no longer open choices; public Android review downloads replace
tester-only native access; simulator PR builds replace unsigned iOS device checks;
TestFlight replaces proposed ad-hoc previews. No other ADR is retired.

Existing [CI](../.github/workflows/ci.yml),
[Pages](../.github/workflows/pages.yml),
[Android release automation](../.github/workflows/release-android.yml) and
[RELEASE.md](../RELEASE.md) still describe the old operation. Update them when
implementing this decision, including replacing the tag-push APK release flow and
test-key fallback. OTA updates remain outside this ADR.

## References

- [Fastlane: Match, deploy keys and read-only CI](https://docs.fastlane.tools/actions/match/)
- [Fastlane: TestFlight uploads](https://docs.fastlane.tools/actions/upload_to_testflight/)
- [Apple: internal TestFlight groups and Internal Only restrictions](https://developer.apple.com/help/app-store-connect/test-a-beta-version/add-internal-testers/)
- [GitHub: secure Actions](https://docs.github.com/en/actions/reference/security/secure-use) and [Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)
