import { deployContract } from '@midnight-ntwrk/midnight-js-contracts';
import { NetworkId } from '@midnight-ntwrk/zswap';
import * as bip39 from 'bip39';
import dotenv from 'dotenv';
import { join } from 'path';
import { readFile, writeFile } from 'fs/promises';
import fetch from 'node-fetch';
import { firstValueFrom } from 'rxjs';

dotenv.config();

const kycContractModule = await import('../build/contracts/kyc/contract/index.cjs');
const kycContract = new kycContractModule.Contract({
  local_secret_key: () => new Uint8Array(32),
  local_public_key: () => new Uint8Array(32),
  local_signature: () => new Uint8Array(64)
});

const CONFIG = {
  indexer: 'https://indexer.testnet-02.midnight.network',
  node: 'https://rpc.testnet-02.midnight.network',
  proofServer: 'http://localhost:6300'
};

async function checkProofServer() {
  const response = await fetch(`${CONFIG.proofServer}/health`);
  if (!response.ok) throw new Error(`Proof server health check failed: ${response.statusText}`);
  console.log('Proof server is running');
}

async function createProviders() {
  if (!process.env.MNEMONIC) throw new Error('MNEMONIC required in .env');
  const { WalletBuilder } = await import('@midnight-ntwrk/wallet');

  console.log('Initializing wallet...');
  const wallet = await WalletBuilder.buildFromSeed(
    `${CONFIG.indexer}/graphql`,
    `wss://${CONFIG.indexer.replace('https://', '')}/graphql`,
    CONFIG.proofServer,
    CONFIG.node,
    bip39.mnemonicToSeedSync(process.env.MNEMONIC).slice(0, 32).toString('hex'),
    NetworkId.TestNet,
    'error'
  );
  console.log('Wallet initialized, syncing state...');
  await new Promise(resolve => setTimeout(resolve, 5000));
  const state = await firstValueFrom(wallet.state());
  console.log('Wallet state:', JSON.stringify(state, null, 2));
  const coinPublicKey = String(state.coinPublicKey);
  console.log('Coin public key:', coinPublicKey);

  const { indexerPublicDataProvider } = await import('@midnight-ntwrk/midnight-js-indexer-public-data-provider');
  const { httpClientProofProvider } = await import('@midnight-ntwrk/midnight-js-http-client-proof-provider');
  const { levelPrivateStateProvider } = await import('@midnight-ntwrk/midnight-js-level-private-state-provider');

  const provider = { coinPublicKey, state: wallet.state };
  const providers = {
    publicDataProvider: await indexerPublicDataProvider(
      `${CONFIG.indexer}/graphql`,
      `wss://${CONFIG.indexer.replace('https://', '')}/graphql`,
      await import('ws').then(m => m.default)
    ),
    proofProvider: httpClientProofProvider(CONFIG.proofServer),
    privateStateProvider: levelPrivateStateProvider(),
    walletProvider: provider,
    midnightProvider: provider,
    zkConfigProvider: {
      async getVerifierKey(name, contract = 'kyc') {
        const keyPath = join('build', 'contracts', contract, 'keys', `${name}.verifier`);
        const key = Uint8Array.from(await readFile(keyPath));
        console.log(`Loaded verifier key for ${contract}/${name}: ${key.length} bytes (type: ${key.constructor.name})`);
        return key;
      },
      async getVerifierKeys(names, contract = 'kyc') {
        const keys = await Promise.all(names.map(name => this.getVerifierKey(name, contract).catch(() => null)));
        return keys.filter(key => key !== null);
      }
    }
  };
  console.log('Providers created with coinPublicKey:', provider.coinPublicKey);
  return providers;
}

async function deployContractWithLogging(providers, options, name) {
  console.log(`\n=== Deploying ${name} Contract ===\n`);
  console.log('Contract Circuits:', Object.keys(options.contract.circuits));
  const verifierKeyPairs = Array.from(options.verifierKeys.entries());
  console.log('\n=== Verifier Key Pairs ===', verifierKeyPairs.length ? verifierKeyPairs : 'None');
  const stateInfo = {
    contract: options.contract.constructor.name,
    privateStateKey: options.privateStateKey,
    initialState: options.initialPrivateState
  };
  console.log('\nDeployment Configuration:', JSON.stringify(stateInfo, null, 2));
  console.log('\nAttempting deployment...');
  const deployed = await deployContract(providers, options);
  console.log(`\n✓ ${name} contract deployed at:`, deployed.deployTxData.public.contractAddress);
  return deployed;
}

async function main() {
  await checkProofServer();
  console.log('Creating providers...');
  const providers = await createProviders();

  const kycCircuits = [
    'generate_key_proof',
    'set_admin',
    'add_verifier',
    'remove_verifier',
    'submit_kyc',
    'verify_kyc',
    'get_kyc_status',
    'is_verified',
    'is_verifier'
  ];
  const kycVerifierKeys = new Map();
  for (const circuit of kycCircuits) {
    const key = await providers.zkConfigProvider.getVerifierKey(circuit, 'kyc');
    kycVerifierKeys.set(circuit, key);
    console.log(`✓ Loaded key for ${circuit}: ${key.length} bytes`);
  }

  const coinPublicKey = providers.walletProvider.coinPublicKey;
  const initialState = [
    new Map(),              // records
    new Map(),              // verifiers
    coinPublicKey,          // admin
    0                       // kycCounter
  ];

  const kycDeployed = await deployContractWithLogging(providers, {
    contract: kycContract,
    initialPrivateState: initialState,
    privateStateKey: 'records',
    verifierKeys: kycVerifierKeys
  }, 'KYC');

  await writeFile('deployed-addresses.json', JSON.stringify({ kyc: kycDeployed.deployTxData.public.contractAddress }, null, 2));
}

main().catch(err => {
  console.error('Main process failed:', err.stack || err);
  process.exit(1);
});
