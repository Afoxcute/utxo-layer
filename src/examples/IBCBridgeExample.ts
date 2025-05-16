import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { BN } from "bn.js";
import * as bitcoin from "bitcoinjs-lib";

import { IBCBridgeExample } from "@/ibc";
import { BitcoinWallet } from "@/types/wallet";
import { Chain, BitcoinNetwork, SolanaNetwork } from "@/types/network";
import { CryptoCurrency } from "@/types/misc";

/**
 * This example demonstrates how to use the IBC bridge to bridge 
 * BTC, DOGE, and LTC to ZBTC on Solana
 */
async function runIBCBridgeExample() {
    console.log("Starting IBC Bridge Example");

    // Set up connections and keypairs
    const connection = new Connection("https://api.devnet.solana.com", "confirmed");
    const relayerKeypair = Keypair.generate();
    const userSolanaKeypair = Keypair.generate();

    // Set up wallets
    const bitcoinWallet = createBitcoinWallet();
    const dogeWallet = createDogeWallet();
    const ltcWallet = createLitecoinWallet();

    // Program and token IDs
    const ibcProgramId = new PublicKey("IBCProgramXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX");
    const zbtcMint = new PublicKey("ZBTCMintXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX");

    // Create IBC bridge
    const ibcBridge = new IBCBridgeExample(
        connection,
        relayerKeypair.publicKey,
        ibcProgramId,
        zbtcMint,
        SolanaNetwork.Devnet,
        BitcoinNetwork.Testnet
    );

    // Initialize light clients
    console.log("Initializing light clients...");
    const btcGenesisHeader = createMockBitcoinHeader();
    const dogeGenesisHeader = createMockDogeHeader();
    const ltcGenesisHeader = createMockLitecoinHeader();

    await ibcBridge.initializeLightClients(
        btcGenesisHeader,
        dogeGenesisHeader,
        ltcGenesisHeader
    );

    // Demo Bitcoin to ZBTC bridge
    console.log("\n=== Bridging BTC to ZBTC ===");
    await ibcBridge.demoWorkflow(
        bitcoinWallet,
        userSolanaKeypair.publicKey,
        new BN(100000000), // 1 BTC in satoshis
        CryptoCurrency.BTC
    );

    // Demo DOGE to ZBTC bridge
    console.log("\n=== Bridging DOGE to ZBTC ===");
    await ibcBridge.demoWorkflow(
        dogeWallet,
        userSolanaKeypair.publicKey,
        new BN(1000000000), // 10 DOGE in koinus
        CryptoCurrency.DOGE
    );

    // Demo LTC to ZBTC bridge
    console.log("\n=== Bridging LTC to ZBTC ===");
    await ibcBridge.demoWorkflow(
        ltcWallet,
        userSolanaKeypair.publicKey,
        new BN(100000000), // 1 LTC in litoshis
        CryptoCurrency.LTC
    );

    console.log("\nIBC Bridge Example Completed");
}

/**
 * Helper functions to create mock wallets and headers for demo purposes
 */
function createBitcoinWallet(): BitcoinWallet {
    const keyPair = bitcoin.ECPair.makeRandom({ network: bitcoin.networks.testnet });
    const publicKey = keyPair.publicKey.toString('hex');

    // Generate P2TR address
    const { address } = bitcoin.payments.p2tr({
        internalPubkey: Buffer.from(publicKey.slice(2), 'hex'),
        network: bitcoin.networks.testnet,
    });

    return {
        pubkey: publicKey,
        p2tr: address || '',
    };
}

function createDogeWallet(): BitcoinWallet {
    // For demo purposes, we'll use the same wallet format as Bitcoin
    return createBitcoinWallet();
}

function createLitecoinWallet(): BitcoinWallet {
    // For demo purposes, we'll use the same wallet format as Bitcoin
    return createBitcoinWallet();
}

function createMockBitcoinHeader(): Buffer {
    // Creating a mock Bitcoin header (80 bytes)
    const header = Buffer.alloc(80);

    // Version
    header.writeInt32LE(1, 0);

    // Previous block hash (all zeros for genesis)
    Buffer.alloc(32).copy(header, 4);

    // Merkle root (random for demo)
    crypto.randomBytes(32).copy(header, 36);

    // Timestamp (current time)
    header.writeUInt32LE(Math.floor(Date.now() / 1000), 68);

    // Bits (difficulty)
    header.writeUInt32LE(0x1d00ffff, 72);

    // Nonce
    header.writeUInt32LE(0, 76);

    return header;
}

function createMockDogeHeader(): Buffer {
    // Dogecoin uses a similar header format to Bitcoin
    return createMockBitcoinHeader();
}

function createMockLitecoinHeader(): Buffer {
    // Litecoin uses a similar header format to Bitcoin
    return createMockBitcoinHeader();
}

// Run the example
runIBCBridgeExample().catch(console.error); 