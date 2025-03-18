#!/bin/bash
# compile_contracts_lite.sh - Compile light contracts for Unity App

# Ensure compactc is installed (v0.14.0 for compatibility with midnight-identity)
echo "Using compactc version: $(compactc --version)"
# Note: Run `npm install -g @midnight-ntwrk/compactc@0.14.0` if needed

# Compile light contracts to separate build directories
compactc src/blockchain/contracts/kyc_light.compact build/contracts/kyc_light
compactc src/blockchain/contracts/did_light.compact build/contracts/did_light
compactc src/blockchain/contracts/amm_light.compact build/contracts/amm_light
compactc src/blockchain/contracts/trustpoints_light.compact build/contracts/trustpoints_light

echo "Light contracts compiled to build/contracts/*_light/"
