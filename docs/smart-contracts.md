# Smart Contracts

This document details the smart contracts used in Unity on Midnight for DeFi functionality.

## Overview

Our DeFi implementation uses Midnight's Compact language to create zero-knowledge proofs that enable private lending and borrowing.

## Project Structure

The smart contracts are organized in the following structure:

```
src/blockchain/
├── contracts/              # Smart contract source files
│   ├── amm_interface.compact   # AMM lending implementation
│   ├── did_registry.compact    # DID management
│   └── kyc_verification.compact # KYC verification
├── services/               # Contract interaction services
│   ├── amm.service.ts     # AMM service implementation
│   └── amm.service.test.ts # AMM service tests
└── utils/                 # Blockchain utilities
```

Build artifacts are stored in:

```
build/contracts/
├── amm/                   # AMM contract artifacts
│   ├── compiler/         # Compiler output
│   ├── contract/        # Contract binaries
│   ├── keys/           # Contract keys
│   └── zkir/           # ZK circuit files
├── did/                   # DID Registry artifacts
└── kyc/                   # KYC Verification artifacts
```

## Contract Overview

### 1. AMM Interface Contract

The AMM (Automated Market Maker) contract implements a lending pool with the following features:

- Constant product AMM (k = tDust * loanTokens)
- Fixed loan size: 100 tDust
- **Dynamic interest rates**: 9-11% based on utilization (>80% = 11%, <20% = 9%, else 10%)
- 2% fee (1 tDust to Loss Pool)
- 90% default compensation from Loss Pool
- **Liquidity pool loans**: Funds sourced from depositors

Key Circuits:
- borrow.zkir (k=13, 5256 rows)
- compensate_default.zkir (k=13, 5026 rows)
- deposit.zkir (k=13, 5182 rows)
- repay.zkir (k=13, 5129 rows)

### 2. DID Registry Contract

Manages decentralized identities with:
- DID document management with ZKPs
- Verification methods and services
- TrustPoints integration (+5 for KYC)
- Controller commitment using hash function
- Document versioning and deactivation
- Merkle tree storage for documents
- Set storage for deactivated DIDs

### 3. KYC Verification Contract

Handles KYC verification with:
- KYC status management (None, Pending, Verified, Rejected)
- Admin-based verification for PoC
- ZKP circuits for privacy
- Status proofs and verification
- Merkle tree storage for records
- Integration with DID for TrustPoints

## Build Process

Contracts are compiled using the Compact compiler (version 0.21.0):

```bash
# Build script: scripts/compile_contracts.sh
compactc src/blockchain/contracts/amm_interface.compact build/contracts/amm
compactc src/blockchain/contracts/kyc_verification.compact build/contracts/kyc
compactc src/blockchain/contracts/did_registry.compact build/contracts/did
```

## Integration Points

1. Frontend Integration:
   - Contracts are accessed via the Midnight Lace wallet
   - Transaction signing and proof generation handled by wallet
   - State management through React providers

2. Cross-Contract Communication:
   - KYC ↔ DID: TrustPoints and verification status
   - AMM ↔ KYC: Borrower verification
   - DID ↔ AMM: Identity verification for loans

## Security Features

1. Zero-Knowledge Proofs:
   - All sensitive operations use ZKP circuits
   - Privacy-preserving transaction validation
   - Hidden state transitions

2. Access Control:
   - Role-based permissions
   - Admin controls for critical operations
   - Verification requirements for sensitive actions

3. State Protection:
   - Merkle tree state management
   - Commitment schemes for privacy
   - Proof verification before state changes

## Testing

Contract testing is handled through:
1. Unit tests for individual contract functions
2. Integration tests for cross-contract interactions
3. ZK proof verification tests
4. Service layer tests (e.g., amm.service.test.ts)

## Status (March 18, 2025)
- KYC stalled: WASM error in `@midnight-ntwrk/midnight-js-contracts` (`addVerifierKeys`)—9 keys loaded, serialization issue per DevRel (Claude).
- Proof server "Undeployed" blocks TestNet-02.

## Future Considerations

1. Scalability:
   - Optimization of ZK circuit sizes
   - Batch processing for common operations
   - State management improvements

2. Features:
   - Variable loan sizes
   - Additional pool types
   - Enhanced privacy features

3. Integration:
   - Additional wallet support
   - Cross-chain bridges
   - Oracle integration
