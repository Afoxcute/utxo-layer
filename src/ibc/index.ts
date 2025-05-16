import { Connection, PublicKey } from "@solana/web3.js";
import { BN } from "bn.js";

import { BitcoinXOnlyPublicKey, BitcoinWallet } from "@/types/wallet";
import { Chain, BitcoinNetwork, SolanaNetwork } from "@/types/network";
import { CryptoCurrency } from "@/types/misc";

import { IBCBridgeClient } from "./IBCBridgeClient";
import { IBCModule } from "./IBCModule";
import { BitcoinLightClient } from "./BitcoinLightClient";

/**
 * Demonstrates how to set up and use the IBC bridge for bridging
 * BTC, DOGE, and LTC to ZBTC on Solana
 */
export class IBCBridgeExample {
    private ibcBridgeClient: IBCBridgeClient;
    private ibcModule: IBCModule;
    private bitcoinLightClient: BitcoinLightClient;
    private dogeLightClient: BitcoinLightClient;
    private ltcLightClient: BitcoinLightClient;

    constructor(
        connection: Connection,
        relayerPublicKey: PublicKey,
        ibcProgramId: PublicKey,
        zbtcMint: PublicKey,
        solanaNetwork: SolanaNetwork,
        bitcoinNetwork: BitcoinNetwork
    ) {
        // Set up IBC bridge client
        this.ibcBridgeClient = new IBCBridgeClient(
            connection,
            relayerPublicKey,
            solanaNetwork,
            bitcoinNetwork
        );

        // Set up IBC module
        this.ibcModule = new IBCModule(
            connection,
            ibcProgramId,
            relayerPublicKey, // Also serves as mint authority
            zbtcMint
        );

        // Set up light clients for each chain
        this.bitcoinLightClient = new BitcoinLightClient(
            connection,
            ibcProgramId,
            Chain.Bitcoin,
            bitcoinNetwork
        );

        this.dogeLightClient = new BitcoinLightClient(
            connection,
            ibcProgramId,
            Chain.Bitcoin, // DOGE uses Bitcoin chain type with different parameters
            bitcoinNetwork
        );

        this.ltcLightClient = new BitcoinLightClient(
            connection,
            ibcProgramId,
            Chain.Bitcoin, // LTC uses Bitcoin chain type with different parameters
            bitcoinNetwork
        );

        // Register light clients with the IBC module
        this.ibcModule.registerLightClient(Chain.Bitcoin, this.bitcoinLightClient);

        // Note: In a real implementation, each chain would have its own
        // light client with appropriate chain-specific verification logic
    }

    /**
     * Initialize the light clients with genesis headers
     */
    public async initializeLightClients(
        btcGenesisHeader: Buffer,
        dogeGenesisHeader: Buffer,
        ltcGenesisHeader: Buffer
    ): Promise<boolean> {
        const btcInitialized = await this.bitcoinLightClient.initialize(btcGenesisHeader);
        const dogeInitialized = await this.dogeLightClient.initialize(dogeGenesisHeader);
        const ltcInitialized = await this.ltcLightClient.initialize(ltcGenesisHeader);

        return btcInitialized && dogeInitialized && ltcInitialized;
    }

    /**
     * Bridge BTC to ZBTC
     */
    public async bridgeBTCtoZBTC(
        bitcoinWallet: BitcoinWallet,
        solanaDestination: PublicKey,
        amount: BN
    ): Promise<string> {
        console.log(`Bridging ${amount.toString()} BTC to ZBTC`);

        const result = await this.ibcBridgeClient.bridgeToCrypto(
            bitcoinWallet,
            solanaDestination,
            amount,
            CryptoCurrency.BTC
        );

        console.log(`Transaction submitted: ${result.txId}`);
        console.log(`IBC Packet created with sequence: ${result.packet.sequence}`);

        return result.txId;
    }

    /**
     * Bridge DOGE to ZBTC
     */
    public async bridgeDOGEtoZBTC(
        dogeWallet: BitcoinWallet,
        solanaDestination: PublicKey,
        amount: BN
    ): Promise<string> {
        console.log(`Bridging ${amount.toString()} DOGE to ZBTC`);

        const result = await this.ibcBridgeClient.bridgeToCrypto(
            dogeWallet,
            solanaDestination,
            amount,
            CryptoCurrency.DOGE
        );

        console.log(`Transaction submitted: ${result.txId}`);
        console.log(`IBC Packet created with sequence: ${result.packet.sequence}`);

        return result.txId;
    }

    /**
     * Bridge LTC to ZBTC
     */
    public async bridgeLTCtoZBTC(
        ltcWallet: BitcoinWallet,
        solanaDestination: PublicKey,
        amount: BN
    ): Promise<string> {
        console.log(`Bridging ${amount.toString()} LTC to ZBTC`);

        const result = await this.ibcBridgeClient.bridgeToCrypto(
            ltcWallet,
            solanaDestination,
            amount,
            CryptoCurrency.LTC
        );

        console.log(`Transaction submitted: ${result.txId}`);
        console.log(`IBC Packet created with sequence: ${result.packet.sequence}`);

        return result.txId;
    }

    /**
     * Process an IBC packet from a relayer
     */
    public async processIBCPacket(
        packetData: Buffer,
        proof: Buffer,
        proofHeight: number
    ): Promise<boolean> {
        try {
            // Parse the packet
            const packetJson = JSON.parse(packetData.toString());

            // Verify and process the packet
            const acknowledgement = await this.ibcModule.receivePacket(
                packetJson,
                proof,
                proofHeight
            );

            if (acknowledgement.success) {
                console.log(`Successfully processed IBC packet. ZBTC minted!`);
                console.log(`Transaction hash: ${acknowledgement.txHash}`);
                return true;
            } else {
                console.error(`Failed to process IBC packet: ${acknowledgement.error}`);
                return false;
            }
        } catch (error) {
            console.error("Error processing IBC packet:", error);
            return false;
        }
    }

    /**
     * Example of bridging workflow
     */
    public async demoWorkflow(
        bitcoinWallet: BitcoinWallet,
        solanaAddress: PublicKey,
        amount: BN,
        cryptoType: CryptoCurrency
    ): Promise<void> {
        console.log(`\n--- Starting IBC Bridge Demo Workflow ---`);
        console.log(`Source: ${cryptoType}`);
        console.log(`Destination: ZBTC on Solana`);
        console.log(`Amount: ${amount.toString()}`);

        // 1. Initiate the bridge transaction
        let txId: string;

        switch (cryptoType) {
            case CryptoCurrency.DOGE:
                txId = await this.bridgeDOGEtoZBTC(bitcoinWallet, solanaAddress, amount);
                break;
            case CryptoCurrency.LTC:
                txId = await this.bridgeLTCtoZBTC(bitcoinWallet, solanaAddress, amount);
                break;
            case CryptoCurrency.BTC:
            default:
                txId = await this.bridgeBTCtoZBTC(bitcoinWallet, solanaAddress, amount);
                break;
        }

        console.log(`\nSource chain transaction initiated: ${txId}`);

        // 2. Wait for confirmation (simulated)
        console.log(`Waiting for confirmation...`);
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 3. Relayer submits proof to destination chain
        console.log(`\nRelayer submitting proof to Solana...`);

        // Create simulated proof and packet
        const packet = {
            sequence: 1,
            sourceChain: Chain.Bitcoin,
            sourceAddress: bitcoinWallet.p2tr,
            destinationChain: Chain.Solana,
            destinationAddress: solanaAddress.toBase58(),
            amount: amount.toString(),
            denom: cryptoType,
            timeoutHeight: 0,
            timeoutTimestamp: Date.now() + 3600000
        };

        const packetData = Buffer.from(JSON.stringify(packet));
        const proof = Buffer.alloc(32); // Simulated proof

        // Process the packet
        const success = await this.processIBCPacket(packetData, proof, 1);

        if (success) {
            console.log(`\n✅ Bridge completed successfully!`);
            console.log(`${amount.toString()} ${cryptoType} has been bridged to ZBTC on Solana`);
        } else {
            console.error(`\n❌ Bridge failed`);
        }

        console.log(`\n--- End of IBC Bridge Demo Workflow ---`);
    }
}

// Export the interfaces for reuse
export { IBCBridgeClient } from "./IBCBridgeClient";
export { IBCModule } from "./IBCModule";
export { BitcoinLightClient } from "./BitcoinLightClient";

// Also export interface types that might be reused
export interface IBCPacket {
    sequence: number;
    sourceChain: Chain;
    sourceAddress: string;
    destinationChain: Chain;
    destinationAddress: string;
    amount: string;
    denom: CryptoCurrency;
    timeoutHeight: number;
    timeoutTimestamp: number;
} 