import { version } from '../../package.json';

/**
 * Version of this binding; sent to AltServer as driverType "typescript_<version>".
 * Read from package.json so it cannot drift from the published version. The bundler inlines only the
 * `version` field (esbuild tree-shakes named JSON imports), so package.json itself is not shipped in dist/.
 */
export const BINDING_VERSION: string = version;
