import {mkdir, writeFile} from "node:fs/promises";
import tls from "node:tls";

// Local workerd sometimes rejects outbound HTTPS chains that Node/curl accept.
// There doesn't seem to be a single canonical upstream issue for that mismatch.
// The closest threads are:
// - https://github.com/cloudflare/workers-sdk/issues/8158
//   Same TLS verifier failure in wrangler dev/Docker.
// - https://github.com/cloudflare/workers-sdk/issues/4081
//   Maintainer explicitly recommends NODE_EXTRA_CA_CERTS.
// - https://github.com/cloudflare/workers-sdk/issues/3218
//   Another local fetch/TLS failure triggered by local network software.
const outputPath = ".wrangler/workerd-local-ca-bundle.pem";
const bundle = `${tls.rootCertificates.join("\n")}\n`;

await mkdir(".wrangler", {recursive: true});
await writeFile(outputPath, bundle, "utf8");

console.log(
    `Wrote ${tls.rootCertificates.length} trusted root certificates to ${outputPath}`
);
