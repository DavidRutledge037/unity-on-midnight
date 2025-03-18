import { createUnprovenDeployTxFromVerifierKeys } from '@midnight-ntwrk/midnight-js-contracts';
import { NetworkId } from '@midnight-ntwrk/zswap';
import * as bip39 from 'bip39';
import dotenv from 'dotenv';
import { join } from 'path';
import { readFile, writeFile } from 'fs/promises';
import fetch from 'node-fetch';
import { firstValueFrom } from 'rxjs';

dotenv.config();

const kycLightModule = await import('../build/contracts/kyc_light/contract/index.cjs');
const didLightModule = await import('../build/contracts/did_light/contract/index.cjs');
const ammLightModule = await import('../build/contracts/amm_light/contract/index.cjs');
const trustpointsLightModule = await import('../build/contracts/trustpoints_light/contract/index.cjs');

const contracts = [
    { name: 'KYC Light', contract: new kycLightModule.Contract({}), circuits: ['verifyKyc'], stateKey: 'records', initialState: [new Map(), ''] },
    { name: 'DID Light', contract: new didLightModule.Contract({}), circuits: ['createDid'], stateKey: 'documents', initialState: [new Map(), ''] },
    { name: 'AMM Light', contract: new ammLightModule.Contract({}), circuits: ['borrow'], stateKey: 'tDust', initialState: [1000, 1, 1000] },
    { name: 'TrustPoints Light', contract: new trustpointsLightModule.Contract({}), circuits: ['addPoints'], stateKey: 'points', initialState: [new Map()] }
];

const CONFIG = {
    indexer: 'https://indexer.testnet-02.midnight.network',
    node: 'https://rpc.testnet-02.midnight.network',
    proofServer: 'http://localhost:6300'
};

async function checkProofServer() {
    const response = await fetch(`${CONFIG.proofServer}/health`);
    if (!response.ok) throw new Error(`Proof server health check failed: ${response.statusText}`);
    console.log('✓ Proof server is running');
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

    const { indexerPublicDataProvider } = await import('@midnight-ntwrk/midnight-js-indexer-public-data-provider');
    const { httpClientProofProvider } = await import('@midnight-ntwrk/midnight-js-http-client-proof-provider');
    const { levelPrivateStateProvider } = await import('@midnight-ntwrk/midnight-js-level-private-state-provider');

    const provider = {
        coinPublicKey,
        state: wallet.state,
        balanceAndProveTransaction: wallet.balanceAndProveTransaction,
        submitTransaction: wallet.submitTransaction
    };

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
            async getVerifierKey(name, contract) {
                const keyPath = join('build', 'contracts', contract, 'keys', `${name}.verifier`);
                const key = Uint8Array.from(await readFile(keyPath));
                console.log(`Loaded verifier key for ${contract}/${name}: ${key.length} bytes`);
                return key;
            },
            async getVerifierKeys(names, contract) {
                const keys = await Promise.all(names.map(name => this.getVerifierKey(name, contract).catch(() => null)));
                return keys.filter(key => key !== null);
            }
        }
    };
    return providers;
}

async function deployContractWithLogging(providers, contract, verifierKeys, initialState, privateStateKey, circuits, name) {
    console.log(`\n=== Deploying ${name} ===\n`);
    console.log('Contract Circuits:', circuits);
    const verifierKeyPairs = Array.from(verifierKeys.entries());
    console.log('\n=== Verifier Key Pairs ===', verifierKeyPairs.length ? verifierKeyPairs : 'None');
    const stateInfo = {
        contract: contract.constructor.name,
        privateStateKey,
        initialState
    };
    console.log('\nDeployment Configuration:', JSON.stringify(stateInfo, null, 2));
    console.log('\nAttempting deployment...');

    // Log args explicitly to debug
    console.log('Deploy args:', { contract, verifierKeys, initialState, privateStateKey });

    const unprovenTx = await createUnprovenDeployTxFromVerifierKeys(
        contract,
        verifierKeys,
        initialState,
        privateStateKey,
        providers.publicDataProvider,
        providers.privateStateProvider,
        providers.midnightProvider
    );
    const provenTx = await providers.walletProvider.balanceAndProveTransaction(unprovenTx);
    const txId = await providers.walletProvider.submitTransaction(provenTx);
    console.log(`\n✓ ${name} deployed with txId:`, txId);
    return { deployTxData: { public: { contractAddress: txId } } };
}

async function main() {
    await checkProofServer();
    const providers = await createProviders();
    const deployedAddresses = {};

    for (const { name, contract, circuits, stateKey, initialState } of contracts) {
        const verifierKeys = new Map();
        const contractDir = name.toLowerCase().replace(' ', '_');
        for (const circuit of circuits) {
            const key = await providers.zkConfigProvider.getVerifierKey(circuit, contractDir);
            verifierKeys.set(circuit, key);
        }
        const deployed = await deployContractWithLogging(
            providers,
            contract,
            verifierKeys,
            initialState,
            stateKey,
            circuits,
            name
        );
        deployedAddresses[contractDir] = deployed.deployTxData.public.contractAddress;
    }

    await writeFile('deployed-addresses.json', JSON.stringify(deployedAddresses, null, 2));
    console.log('\n✓ All contracts deployed successfully');
}

main().catch(err => {
    console.error('Main process failed:', err.stack || err);
    process.exit(1);
});
