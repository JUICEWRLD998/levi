// Stack smoke test — proves the local Chain.wtf stack is alive end to end: the chain
// responds, the casino deployment is present, and a real session settles through the
// Verify Network VRF (not mocked).
//
//   node scripts/smoke-stack.mjs [sdkRoot]
//
// Defaults sdkRoot to ../sdk/casino-sdk. Exits nonzero if the session never settles, so it
// is usable as a guard before any contract or UI work.
//
// Phase 0 receipt: this exact path settled the shipped CoinflipGame at 1.96x on the 98% RTP
// (phase 3 SETTLED, nonzero randomness).
import { readFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  encodeAbiParameters,
  http,
  parseAbiItem,
  parseEther,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const sdkRoot = resolve(
  process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'sdk', 'casino-sdk'),
);
const deployedPath = join(sdkRoot, 'simulator', 'local-node', 'deployed.json');

if (!existsSync(deployedPath)) {
  console.error(
    `No deployment at ${deployedPath}.\n` +
      `Start the stack first:  cd "${sdkRoot}" && npm start`,
  );
  process.exit(1);
}

const deployed = JSON.parse(readFileSync(deployedPath, 'utf8'));

// Hardhat/Anvil account #0 — the funded deployer/player the local node sets up.
const PLAYER_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const ZERO = `0x${'0'.repeat(64)}`;

const openedEvent = parseAbiItem(
  'event CasinoSessionOpened(uint256 indexed sessionId, address indexed game, address indexed player, address vault, uint256 wager)',
);
const settledEvent = parseAbiItem(
  'event CasinoSessionSettled(uint256 indexed sessionId, address indexed game, address indexed player, uint8 phase, uint256 payout, bytes32 randomness, bytes gameState)',
);

const hostAbi = [
  {
    type: 'function',
    name: 'openSession',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'game', type: 'address' },
      { name: 'vault', type: 'address' },
      { name: 'wager', type: 'uint256' },
      { name: 'gameData', type: 'bytes' },
    ],
    outputs: [
      { name: 'sessionId', type: 'uint256' },
      { name: 'requestId', type: 'bytes32' },
    ],
  },
];

const gameAbi = [
  {
    type: 'function',
    name: 'quoteCaps',
    stateMutability: 'view',
    inputs: [
      { name: 'wager', type: 'uint256' },
      { name: 'gameData', type: 'bytes' },
    ],
    outputs: [
      { name: 'maxEscrowStake', type: 'uint256' },
      { name: 'maxReservedProfit', type: 'uint256' },
    ],
  },
];

const erc20Abi = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
];

const chain = defineChain({
  id: deployed.chainId,
  name: `local-${deployed.chainId}`,
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [deployed.rpcUrl] } },
});

const account = privateKeyToAccount(PLAYER_KEY);
const publicClient = createPublicClient({ chain, transport: http(deployed.rpcUrl) });
const wallet = createWalletClient({ account, chain, transport: http(deployed.rpcUrl) });

const game = deployed.games[0]?.address;
if (!game) throw new Error('no game in deployed.json');

const wager = parseEther('10');
// abi.encode(bool pickHeads, uint8 coinCount, uint8 minWins)
const gameData = encodeAbiParameters(
  [{ type: 'bool' }, { type: 'uint8' }, { type: 'uint8' }],
  [true, 1, 1],
);

console.log('sdk         ', sdkRoot);
console.log('chain       ', deployed.chainId, deployed.rpcUrl);
console.log('game        ', deployed.games[0].name, game);

const caps = await publicClient.readContract({
  address: game,
  abi: gameAbi,
  functionName: 'quoteCaps',
  args: [wager, gameData],
});
console.log('quoteCaps   ', caps[0].toString(), caps[1].toString());
if (caps[0] < wager) throw new Error('quoteCaps rejected the wager');

const balance = await publicClient.readContract({
  address: deployed.token,
  abi: erc20Abi,
  functionName: 'balanceOf',
  args: [account.address],
});
if (balance < wager) throw new Error(`player unfunded: ${balance}`);

const approveHash = await wallet.writeContract({
  address: deployed.token,
  abi: erc20Abi,
  functionName: 'approve',
  args: [deployed.host, wager],
});
await publicClient.waitForTransactionReceipt({ hash: approveHash });

const openHash = await wallet.writeContract({
  address: deployed.host,
  abi: hostAbi,
  functionName: 'openSession',
  args: [game, deployed.vault, wager, gameData],
});
const openReceipt = await publicClient.waitForTransactionReceipt({ hash: openHash });
console.log('openSession ', openHash);

let sessionId;
for (const log of openReceipt.logs) {
  if (log.topics[0] === openedEvent.topic0) sessionId = BigInt(log.topics[1]);
}

const deadline = Date.now() + 90_000;
let settled;
while (Date.now() < deadline) {
  const logs = await publicClient.getLogs({
    address: deployed.host,
    event: settledEvent,
    fromBlock: openReceipt.blockNumber,
    toBlock: 'latest',
  });
  const match = logs.find((l) => sessionId === undefined || l.args.sessionId === sessionId);
  if (match) {
    settled = {
      phase: Number(match.args.phase),
      payout: match.args.payout,
      randomness: match.args.randomness,
    };
    break;
  }
  await new Promise((r) => setTimeout(r, 1000));
}

if (!settled) throw new Error('session never settled — is the VRF node running?');

console.log('phase       ', settled.phase, settled.phase === 3 ? '(SETTLED)' : '');
console.log('payout      ', settled.payout.toString());
console.log('randomness  ', settled.randomness);

const ok = settled.phase === 3 && settled.randomness !== ZERO;
console.log(ok ? '\nSTACK OK — VRF fulfilled, session settled' : '\nSTACK FAILED');
process.exit(ok ? 0 : 1);
