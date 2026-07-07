#!/usr/bin/env node
import { Resolver } from 'node:dns/promises'

const DEFAULT_DOMAIN = 'https://dungeon-master.site/'
const DEFAULT_TARGET_IP = '45.130.41.78'
const DEFAULT_INTERVAL_MS = 30_000

const [domainArg = DEFAULT_DOMAIN, targetIp = DEFAULT_TARGET_IP, intervalArg] =
  process.argv.slice(2)

const intervalMs = Number.parseInt(intervalArg ?? '', 10) || DEFAULT_INTERVAL_MS
const hostname = toHostname(domainArg)
const resolver = new Resolver()
let attempt = 0
let timeoutId

if (process.env.DNS_SERVERS) {
  resolver.setServers(
    process.env.DNS_SERVERS.split(',')
      .map((server) => server.trim())
      .filter(Boolean),
  )
}

console.log(`Watching DNS A records for ${hostname}`)
console.log(`Target IP: ${targetIp}`)
console.log(`Interval: ${Math.round(intervalMs / 1000)}s`)

if (process.env.DNS_SERVERS) {
  console.log(`DNS servers: ${resolver.getServers().join(', ')}`)
}

process.on('SIGINT', () => {
  if (timeoutId) {
    clearTimeout(timeoutId)
  }

  console.log('\nStopped.')
  process.exit(130)
})

await checkUntilReady()

async function checkUntilReady() {
  attempt += 1

  const timestamp = new Date().toISOString()

  try {
    const records = await resolver.resolve4(hostname, { ttl: true })
    const ips = records.map((record) => record.address)
    const ttlInfo = records
      .map((record) => `${record.address} ttl=${record.ttl}`)
      .join(', ')

    console.log(`[${timestamp}] #${attempt}: ${ttlInfo || 'no A records'}`)

    if (ips.includes(targetIp)) {
      console.log(`Done: ${hostname} resolves to ${targetIp}`)
      return
    }
  } catch (error) {
    console.log(`[${timestamp}] #${attempt}: DNS lookup failed: ${error.message}`)
  }

  timeoutId = setTimeout(checkUntilReady, intervalMs)
}

function toHostname(value) {
  try {
    return new URL(value).hostname
  } catch {
    return value
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '')
      .trim()
  }
}
