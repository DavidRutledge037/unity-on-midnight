# Unity on Midnight - Privacy-Preserving AMM
A decentralized lending DApp on Midnight using ZKPs for unbanked users—built for the AMM Midnight Hackathon.

## Features
- Private KYC/DID via ZKPs
- AMM lending pool (100 tDust loans, 10% interest)
- TrustPoints system
- Next.js UI with Lace wallet

## Technology Stack
- **Frontend**: Next.js 14, TypeScript, shadcn/ui, Tailwind CSS, Lace Wallet
- **Contracts**: Compact (ZKPs), Midnight TestNet-02

## Deployment Status
- **Current**: KYC/AMM/DID stalled—WASM error in `@midnight-ntwrk/midnight-js-contracts` (`addVerifierKeys`).
- **Logs**: 9 keys (4665 bytes, `Uint8Array`) loaded—e.g., `generate_key_proof` (`0602`), `get_kyc_status` (`0202`)—WASM fails post-hand-off.
- **DevRel**: Claude (3/18/25, 1:53 PM) tracing to package source—engineer review pending.
- **Proof Server**: "Undeployed" rejects TestNet-02—separate issue.

## Next Steps
- UI mocks, Lace integration—tonight
- CLI deploy or engineer fix—March 19

## Documentation
- [Getting Started](docs/getting-started.md)
- [Wallet Integration](docs/wallet-integration.md)
- [Smart Contracts](docs/smart-contracts.md)
- [Architecture](docs/architecture.md)
- [Contributing](docs/contributing.md)

## Quick Start

### Prerequisites

1. Install [Node.js](https://nodejs.org/) (v18 or later)
2. Install [Midnight Lace Wallet](https://www.lace.io/)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/unity-on-midnight.git
cd unity-on-midnight
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Start the development server:
```bash
npm run dev
# or
yarn dev
```

4. Open [http://localhost:3000](http://localhost:3000) with your browser

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Built during the AMM Midnight Hackathon
- Uses Midnight's Compact language for smart contracts
- UI components from shadcn/ui
