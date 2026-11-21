// npm run release: builds the installer with a new build id and puts it on the current release.
// installed copies see the new id in build.json and update themselves. the version isn't touched.
import { execSync } from 'child_process'
import { createHash } from 'crypto'
import { readFileSync, statSync, writeFileSync } from 'fs'

const run = (cmd, env) => execSync(cmd, { stdio: 'inherit', env: { ...process.env, ...env } })

if (execSync('git status --porcelain').toString().trim()) {
  console.error('commit your changes first, the build id comes from the commit')
  process.exit(1)
}

const { version } = JSON.parse(readFileSync('package.json', 'utf8'))
const id = `${execSync('git rev-parse --short HEAD').toString().trim()}-${Date.now().toString(36)}`
run('npm run build:win', { CHAPEL_BUILD_ID: id })

const exe = 'dist/Chapel-Setup.exe'
const sha512 = createHash('sha512').update(readFileSync(exe)).digest('base64')
writeFileSync('dist/build.json', JSON.stringify({ id, sha512, size: statSync(exe).size }, null, 2))

run(`gh release upload v${version} ${exe} dist/build.json --clobber`)
console.log(`released build ${id} on v${version}`)
