/**
 * Runtime app version.
 *
 * Stamped from the package.json version by tools/update-version.sh -- the
 * same bump that syncs the four manifests also rewrites this constant, so
 * the server's self-reported version (health endpoint, Prometheus
 * build_info, OpenAPI info) can never drift from the release. The
 * APP_VERSION env var still wins when a deployment needs to override it.
 */
export const APP_VERSION = '1.0.0';
