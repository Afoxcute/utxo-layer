import { Connection, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import * as bitcoin from "bitcoinjs-lib";
import { BN } from "bn.js";
import { createHash } from "crypto";

import { Chain, BitcoinNetwork } from "@/types/network";

/**
 * Interface for the IBCLightClient that was defined in IBCModule.ts
 */
interface IBCLightClient {
    verifyPacketCommitment(
        proof: Buffer,
        rootHash: Buffer,
        packetData: Buffer
    ): Promise<boolean>;

    updateClient(headers: Buffer[]): Promise<boolean>;

    getHeight(): Promise<number>;
}

/**
 * Bitcoin header structure
 */
interface BitcoinHeader {
    version: number;
    prevHash: Buffer;
    merkleRoot: Buffer;
    timestamp: number;
    bits: number;
    nonce: number;
}

/**
 * BitcoinLightClient implements light client verification for Bitcoin-based chains
 * This handles verification of proofs from BTC, DOGE, and LTC
 */
export class BitcoinLightClient implements IBCLightClient {
    private connection: Connection;
    private programId: PublicKey;
    private chain: Chain;
    private headers: Map<number, BitcoinHeader>;
    private currentHeight: number;
    private network: bitcoin.networks.Network;

    constructor(
        connection: Connection,
        programId: PublicKey,
        chain: Chain,
        bitcoinNetwork: BitcoinNetwork
    ) {
        this.connection = connection;
        this.programId = programId;
        this.chain = chain;
        this.headers = new Map();
        this.currentHeight = 0;

        // Set the appropriate network based on network type
        switch (bitcoinNetwork) {
            case BitcoinNetwork.Testnet:
                this.network = bitcoin.networks.testnet;
                break;
            case BitcoinNetwork.Regtest:
                this.network = bitcoin.networks.regtest;
                break;
            default:
                this.network = bitcoin.networks.bitcoin;
        }
    }

    /**
     * Initialize the light client with genesis header
     */
    public async initialize(genesisHeader: Buffer): Promise<boolean> {
        // Parse the genesis header
        const header = this.parseHeader(genesisHeader);

        // Store it at height 0
        this.headers.set(0, header);
        this.currentHeight = 0;

        console.log(`Initialized light client for ${this.chain} at height 0`);
        return true;
    }

    /**
     * Parse a Bitcoin header from raw bytes
     */
    private parseHeader(headerBytes: Buffer): BitcoinHeader {
        if (headerBytes.length !== 80) {
            throw new Error("Invalid Bitcoin header: must be exactly 80 bytes");
        }

        return {
            version: headerBytes.readInt32LE(0),
            prevHash: Buffer.from(headerBytes.slice(4, 36).reverse()), // Reverse for big-endian
            merkleRoot: Buffer.from(headerBytes.slice(36, 68).reverse()), // Reverse for big-endian
            timestamp: headerBytes.readUInt32LE(68),
            bits: headerBytes.readUInt32LE(72),
            nonce: headerBytes.readUInt32LE(76)
        };
    }

    /**
     * Hash a Bitcoin header according to the proof-of-work algorithm
     */
    private hashHeader(header: BitcoinHeader): Buffer {
        // Serialize the header
        const buffer = Buffer.alloc(80);

        buffer.writeInt32LE(header.version, 0);
        header.prevHash.reverse().copy(buffer, 4); // Reverse for little-endian
        header.merkleRoot.reverse().copy(buffer, 36); // Reverse for little-endian
        buffer.writeUInt32LE(header.timestamp, 68);
        buffer.writeUInt32LE(header.bits, 72);
        buffer.writeUInt32LE(header.nonce, 76);

        // Apply double SHA-256 hash
        const hash1 = createHash('sha256').update(buffer).digest();
        const hash2 = createHash('sha256').update(hash1).digest();

        // Bitcoin returns hashes in little-endian
        return Buffer.from(hash2.reverse());
    }

    /**
     * Verify proof-of-work for a Bitcoin header
     */
    private verifyProofOfWork(header: BitcoinHeader): boolean {
        const hash = this.hashHeader(header);

        // Convert bits to target
        const bits = header.bits;
        const exponent = ((bits & 0xff000000) >> 24) - 3;
        const mantissa = bits & 0x00ffffff;

        // Target is the maximum hash value allowed for a valid block
        const target = Buffer.alloc(32, 0);

        // Set the first three bytes to the mantissa (little-endian)
        target[exponent] = (mantissa & 0x0000ff);
        target[exponent + 1] = (mantissa & 0x00ff00) >> 8;
        target[exponent + 2] = (mantissa & 0xff0000) >> 16;

        // Check if hash is less than target (in big-endian)
        for (let i = 0; i < 32; i++) {
            if (hash[i] < target[i]) return true;
            if (hash[i] > target[i]) return false;
        }

        return true;
    }

    /**
     * Verify a Merkle proof for an IBC packet
     */
    public async verifyPacketCommitment(
        proof: Buffer,
        rootHash: Buffer,
        packetData: Buffer
    ): Promise<boolean> {
        console.log(`Verifying packet commitment for chain ${this.chain}`);

        // 1. Get the header at the specified height
        const header = this.headers.get(this.currentHeight);
        if (!header) {
            console.error(`No header found at height ${this.currentHeight}`);
            return false;
        }

        // 2. Check that the rootHash matches the Merkle root in the header
        if (!header.merkleRoot.equals(rootHash)) {
            console.error("Root hash does not match header's Merkle root");
            return false;
        }

        // 3. Verify the Merkle proof for the packet
        const packetHash = createHash('sha256').update(packetData).digest();

        // In a real implementation, this would use the actual Merkle proof
        // verification logic for Bitcoin-based chains

        // For this example, we'll simulate the verification
        console.log("Verifying Merkle proof for packet:", packetHash.toString('hex'));

        // Simulating a successful verification
        return true;
    }

    /**
     * Update light client with new headers
     */
    public async updateClient(headers: Buffer[]): Promise<boolean> {
        console.log(`Updating light client for ${this.chain} with ${headers.length} headers`);

        let lastVerifiedHeight = this.currentHeight;
        let lastVerifiedHeader = this.headers.get(lastVerifiedHeight);

        if (!lastVerifiedHeader) {
            console.error("Cannot update client: no previous header found");
            return false;
        }

        // Process each header in sequence
        for (let i = 0; i < headers.length; i++) {
            const headerBytes = headers[i];
            const header = this.parseHeader(headerBytes);

            // 1. Verify that this header links to the previous one
            if (!header.prevHash.equals(this.hashHeader(lastVerifiedHeader))) {
                console.error(`Header at index ${i} does not link to previous header`);
                return false;
            }

            // 2. Verify the proof-of-work
            if (!this.verifyProofOfWork(header)) {
                console.error(`Header at index ${i} has invalid proof-of-work`);
                return false;
            }

            // 3. Verify other header rules (difficulty adjustment, etc.)
            // In a real implementation, this would include checking difficulty adjustments,
            // timestamp limits, etc.

            // 4. Store the verified header
            const newHeight = lastVerifiedHeight + 1;
            this.headers.set(newHeight, header);

            // Update state for next header
            lastVerifiedHeight = newHeight;
            lastVerifiedHeader = header;
        }

        // Update current height
        this.currentHeight = lastVerifiedHeight;
        console.log(`Light client updated to height ${this.currentHeight}`);

        return true;
    }

    /**
     * Get current height of the light client
     */
    public async getHeight(): Promise<number> {
        return this.currentHeight;
    }

    /**
     * Calculate Merkle root from a set of transaction hashes
     */
    private calculateMerkleRoot(txHashes: Buffer[]): Buffer {
        if (txHashes.length === 0) {
            throw new Error("Cannot calculate Merkle root with no transactions");
        }

        if (txHashes.length === 1) {
            return txHashes[0];
        }

        // Create a mutable copy of the array
        const hashes = [...txHashes];

        // If odd number of elements, duplicate the last one
        if (hashes.length % 2 === 1) {
            hashes.push(hashes[hashes.length - 1]);
        }

        // Iteratively hash pairs until we have a single hash
        while (hashes.length > 1) {
            const newHashes: Buffer[] = [];

            for (let i = 0; i < hashes.length; i += 2) {
                // Concatenate adjacent hashes and double-SHA256 them
                const combined = Buffer.concat([hashes[i], hashes[i + 1]]);
                const hash1 = createHash('sha256').update(combined).digest();
                const hash2 = createHash('sha256').update(hash1).digest();

                newHashes.push(hash2);
            }

            // Update the hashes array with the new level
            hashes.length = 0;
            hashes.push(...newHashes);
        }

        return hashes[0];
    }
} 