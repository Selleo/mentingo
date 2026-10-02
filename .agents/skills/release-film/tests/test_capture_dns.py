"""The resolver a filmed test process gets (NODE_OPTIONS --require localhost-dns.cjs): tenant subdomains of localhost
answer the loopback address in the shape and family Node's own lookup gives; every other name, localhost itself too,
stays with the system's resolver. No network: IP literals, the loopback and a stubbed resolver only."""
import json
from pathlib import Path
import shutil
import subprocess
import unittest

SHIM = Path(__file__).resolve().parents[1] / 'scripts' / 'capture' / 'localhost-dns.cjs'


def node(script, stub=False):
    """What ``script`` prints as JSON in a Node process with the shim loaded (after a stub of the system resolver that
    records every name it is asked, when ``stub``)."""
    binary = shutil.which('node')
    if not binary:
        raise unittest.SkipTest('node is needed to load the resolver')
    source = ['const dns = require("dns"); const util = require("util");']
    if stub:  # the system resolver the shim finds: it answers 10.9.8.7 and records the names it is asked
        source.append('const asked = []; dns.lookup = function (hostname, options, callback) { asked.push(hostname); '
                      '(typeof options === "function" ? options : callback)(null, "10.9.8.7", 4); }; '
                      'dns.promises.lookup = async (hostname) => { asked.push(hostname); return { address: "10.9.8.7", family: 4 }; };')
    source += [f'require({json.dumps(str(SHIM))});',
               'const lookup = (...args) => new Promise((done) => dns.lookup(...args, (error, address, family) => '
               'done(error ? error.code : [address, family])));',
               f'(async () => {{ {script} }})().catch((error) => {{ console.error(error); process.exit(1); }});']
    result = subprocess.run([binary, '-e', '\n'.join(source)], capture_output=True, text=True, timeout=60)
    if result.returncode:
        raise AssertionError(result.stderr[-2000:])
    return json.loads(result.stdout)


class LocalhostResolver(unittest.TestCase):
    def test_promisified_lookup_answers_address_and_family(self):
        found = node('console.log(JSON.stringify([await util.promisify(dns.lookup)("127.0.0.1"), '
                     'await util.promisify(dns.lookup)("tenant-1.app.localhost"), '
                     'await util.promisify(dns.lookup)("tenant-1.app.localhost", { all: true, family: 4 })]))')
        self.assertEqual(found, [{'address': '127.0.0.1', 'family': 4}, {'address': '127.0.0.1', 'family': 4},
                                 [{'address': '127.0.0.1', 'family': 4}]])

    def test_a_tenant_name_answers_the_family_asked_for(self):
        found = node('console.log(JSON.stringify([await lookup("tenant-1.app.localhost"), '
                     'await lookup("tenant-1.app.localhost", 6), await lookup("TENANT.APP.LOCALHOST.", { family: "IPv6" }), '
                     'await lookup("tenant-1.app.localhost", { all: true, family: 0 }), '
                     'await dns.promises.lookup("tenant-1.app.localhost", 6), '
                     'await dns.promises.lookup("tenant-1.app.localhost", { all: true })]))')
        both = [{'address': '127.0.0.1', 'family': 4}, {'address': '::1', 'family': 6}]
        self.assertEqual(found, [['127.0.0.1', 4], ['::1', 6], ['::1', 6], [both, None], {'address': '::1', 'family': 6},
                                 both])

    def test_localhost_itself_and_other_names_stay_with_the_system_resolver(self):
        found = node('await lookup("localhost"); await lookup("localhost.", { all: true }); await lookup("example.test", 6);'
                     'await dns.promises.lookup("localhost"); await lookup("app.localhost"); '
                     'await dns.promises.lookup("x.localhost"); console.log(JSON.stringify(asked));', stub=True)
        self.assertEqual(found, ['localhost', 'localhost.', 'example.test', 'localhost'])

    def test_a_lookup_without_a_callback_fails_as_nodes_own_does(self):
        found = node('try { dns.lookup("tenant-1.app.localhost", {}); console.log(JSON.stringify("answered")); } '
                     'catch (error) { console.log(JSON.stringify(error.code)); }')
        self.assertEqual(found, 'ERR_INVALID_ARG_TYPE')  # thrown at once, not a crash on the next tick

    def test_a_tenant_name_reaches_a_server_on_the_loopback(self):
        found = node('const http = require("http"); const server = http.createServer((request, response) => '
                     'response.end(request.headers.host.split(":")[0])); '
                     'await new Promise((done) => server.listen(0, "127.0.0.1", done)); const { port } = server.address(); '
                     'const got = await new Promise((done, fail) => http.get({ host: "tenant-1.app.localhost", port }, '
                     '(response) => { let body = ""; response.on("data", (c) => body += c); response.on("end", () => done(body)); })'
                     '.on("error", fail)); const fetched = await (await fetch(`http://tenant-2.app.localhost:${port}/`)).text(); '
                     'server.close(); console.log(JSON.stringify([got, fetched]));')
        self.assertEqual(found, ['tenant-1.app.localhost', 'tenant-2.app.localhost'])


if __name__ == '__main__':
    unittest.main()
