"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { toXOnly } from "bitcoinjs-lib/src/psbt/bip371";
import { motion } from "framer-motion";
import { useSearchParams } from "next/navigation";
import { useRef, useState } from "react";

import { useBitcoinWallet } from "@/contexts/BitcoinWalletProvider";
import useDepositInteractionsWithCache from "@/hooks/hermes/useDepositInteractionsWithCache";
import useInteractions from "@/hooks/hermes/useInteractions";
import useBalance from "@/hooks/misc/useBalance";
import usePrice from "@/hooks/misc/usePrice";
import usePositions from "@/hooks/zpl/usePositions";
import { InteractionStatus, InteractionType } from "@/types/api";
import { CryptoCurrency } from "@/types/misc";

import Tabs from "../Tabs/Tabs";
import Icon from "@/components/Icons";

import Deposit from "./Deposit";
import InteractionsList from "./InteractionsList";
import styles from "./styles.module.scss";
import Withdraw from "./Withdraw";

const tabs = [
  {
    label: "Deposit",
    value: "deposit",
  },
  {
    label: "Withdraw",
    value: "withdraw",
  },
];

export default function MintWidget() {
  const searchParams = useSearchParams();
  const widgetRef = useRef<HTMLDivElement>(null);
  const { price: btcPrice } = usePrice("BTCUSDC");
  const { publicKey: solanaPubkey } = useWallet();
  const {
    wallet: bitcoinWallet,
    connected: bitcoinWalletConnected,
    signPsbt,
  } = useBitcoinWallet();
  const { connected: solanaWalletConnected } = useWallet();
  const { cachedUtxos, mutate: mutateDepositTransactions } =
    useDepositInteractionsWithCache({
      solanaAddress: solanaPubkey?.toBase58(),
      bitcoinXOnlyPubkey: bitcoinWallet
        ? toXOnly(Buffer.from(bitcoinWallet.pubkey, "hex")).toString("hex")
        : undefined,
    });
  const { mutate: mutateWithdrawalTransactions } = useInteractions(
    {
      solanaAddress: solanaPubkey?.toBase58(),
      types: [InteractionType.Withdrawal],
      statuses: [
        InteractionStatus.AddWithdrawalRequest,
        InteractionStatus.AddUnlockToUserProposal,
        InteractionStatus.BitcoinUnlockToUser,
        InteractionStatus.VerifyUnlockToUserTransaction,
        InteractionStatus.SolanaUnlockToUser,
      ],
    },
    20
  );
  const {
    data: zbtcBalance,
    mutate: mutateZbtcBalance,
    isLoading: isLoadingZbtcBalance,
  } = useBalance(solanaPubkey);
  const {
    data: positions,
    mutate: mutatePositions,
    isLoading: isLoadingPositions,
  } = usePositions(solanaPubkey);

  const [activeTab, setActiveTab] = useState("deposit");
  const [selectedCrypto, setSelectedCrypto] = useState<CryptoCurrency>(CryptoCurrency.BTC);

  const isAllConnected = solanaWalletConnected && bitcoinWalletConnected;

  const handleTabClick = (tabValue: string) => {
    setActiveTab(tabValue);
  };

  const handleCryptoChange = (crypto: CryptoCurrency) => {
    setSelectedCrypto(crypto);
  };

  return (
    <div className={styles.mint}>
      <div className={styles.mint__grid}>
        <InteractionsList />
        <div
          className={`${styles.mintWidget} !scroll-mt-[50px] md:!scroll-mt-[100px]`}
          ref={widgetRef}
        >
          <div className={styles.mintWidgetHeader}>
            <Tabs
              tabs={[
                {
                  label: "Deposit",
                  value: "deposit",
                  icon: <Icon name="Swap" />,
                },
                {
                  label: "Withdraw",
                  value: "withdraw",
                  icon: <Icon name="Withdraw01" />,
                },
              ]}
              activeTab={activeTab === "deposit" ? 0 : 1}
              onClick={handleTabClick}
            />

            <div className={styles.cryptoSelector}>
              <select
                value={selectedCrypto}
                onChange={(e) => handleCryptoChange(e.target.value as CryptoCurrency)}
                className={styles.cryptoSelectorDropdown}
              >
                <option value={CryptoCurrency.BTC}>Bitcoin (BTC)</option>
                <option value={CryptoCurrency.DOGE}>Dogecoin (DOGE)</option>
                <option value={CryptoCurrency.LTC}>Litecoin (LTC)</option>
              </select>
            </div>
          </div>
          <div className={`${styles.mintWidget__card} mask-border`}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              key={activeTab}
              className={`${styles.mintWidget__card__content} relative`}
            >
              {activeTab === "deposit" && (
                <Deposit
                  solanaPubkey={solanaPubkey}
                  bitcoinWallet={bitcoinWallet}
                  isAllConnected={isAllConnected}
                  signPsbt={signPsbt}
                  updateDepositTransactions={async () => {
                    await mutateDepositTransactions();
                  }}
                  btcPrice={btcPrice?.price ?? 0}
                  cachedUtxos={cachedUtxos}
                  cryptoType={selectedCrypto}
                />
              )}
              {activeTab === "withdraw" &&
                !isLoadingPositions &&
                !isLoadingZbtcBalance && (
                  <Withdraw
                    solanaPubkey={solanaPubkey}
                    solanaWalletConnected={solanaWalletConnected}
                    positions={positions}
                    btcPrice={btcPrice?.price ?? 0}
                    zbtcBalance={zbtcBalance}
                    updateTransactions={async () => {
                      await mutateWithdrawalTransactions();
                    }}
                    updateZbtcBalance={async () => {
                      await mutatePositions();
                      await mutateZbtcBalance();
                    }}
                    cryptoType={selectedCrypto}
                  />
                )}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
