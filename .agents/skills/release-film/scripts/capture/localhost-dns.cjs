// Test processes resolve every *.localhost name to the loopback address (RFC 6761), as systemd-resolved does on CI
// runners: tests that give each tenant a subdomain (tenant-1.app.localhost) work in containers and on WSL too. Plain
// localhost stays with the system's resolver (its hosts file), and every answer has the shape Node's own lookup gives.
const dns = require("dns");
const util = require("util");

const loopback = (hostname) => typeof hostname === "string" && /[^.]\.localhost\.?$/i.test(hostname);
// the loopback addresses of the family asked for (4 or 6, "IPv4" or "IPv6", as the options or in them), IPv4 first
const answers = (options) => {
  const asked = options && typeof options === "object" ? options.family : options;
  const family = asked === 6 || asked === "IPv6" ? 6 : asked === 4 || asked === "IPv4" ? 4 : 0;
  return [{ address: "127.0.0.1", family: 4 }, { address: "::1", family: 6 }].filter((a) => !family || a.family === family);
};
const all = (options) => !!(options && typeof options === "object" && options.all);

const lookup = dns.lookup;
dns.lookup = function (hostname, options, callback) {
  const done = typeof options === "function" ? options : callback;
  if (!loopback(hostname) || typeof done !== "function") return lookup.apply(this, arguments);
  const found = answers(options);
  process.nextTick(() => (all(options) ? done(null, found) : done(null, found[0].address, found[0].family)));
  return undefined;
};
// util.promisify(dns.lookup) resolves { address, family } (the list, with all), as it does for Node's own lookup
const promisified = util.promisify(lookup);
Object.defineProperty(dns.lookup, util.promisify.custom, {
  value(hostname, options) {
    if (!loopback(hostname)) return promisified.call(this, hostname, options);
    const found = answers(options);
    return Promise.resolve(all(options) ? found : found[0]);
  },
});

const promised = dns.promises.lookup;
dns.promises.lookup = function (hostname, options) {
  if (!loopback(hostname)) return promised.apply(this, arguments);
  const found = answers(options);
  return Promise.resolve(all(options) ? found : found[0]);
};
