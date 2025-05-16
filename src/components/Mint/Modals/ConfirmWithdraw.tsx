import { captureException } from "@sentry/nextjs";
import { getAccount, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { WalletSignTransactionError } from "@solana/wallet-adapter-base";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import BigNumber from "bignumber.js";
import { BN } from "bn.js";
import classNames from "classnames";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

import { convertP2trToTweakedXOnlyPubkey } from "@/bitcoin";
import Button from "@/components/Button/Button";
import Checkbox from "@/components/Checkbox/Checkbox";
import { Dropdown, DropdownOption } from "@/components/Dropdown/Dropdown";
import Icon from "@/components/Icons";
import { IconName } from "@/components/Icons/icons";
import {
  Modal,
  ModalActions,
  ModalHeader,
} from "@/components/ShadcnModal/Modal";
import Tooltip from "@/components/Tooltip";
import { useZplClient } from "@/contexts/ZplClientProvider";
import useTwoWayPegGuardianSettings from "@/hooks/hermes/useTwoWayPegGuardianSettings";
import { InteractionType } from "@/types/api";
import { Chain } from "@/types/network";
import { Position } from "@/types/zplClient";
import { BTC_DECIMALS } from "@/utils/constant";
import { shortenString } from "@/utils/format";
import { notifyError, notifyTx } from "@/utils/notification";
import { CryptoCurrency } from "@/types/misc";

export interface ConfirmWithdrawProps {
  isOpen: boolean;
  onClose: () => void;
  solanaPubkey: PublicKey | null;
  withdrawAmount: number;
  assetFrom: {
    name: string;
    amount: string;
    isLocked: boolean;
  };
  assetTo: {
    name: string;
    amount: string;
    isLocked: boolean;
  };
  connectedWallets: string[];
  positions: Position[] | undefined;
  serviceFee: string;
  minerFee: string;
  layerFee: string;
  updateTransactions: () => Promise<void>;
  updateZbtcBalance: () => Promise<void>;
  resetInput: () => void;
  cryptoType?: CryptoCurrency;
}

export default function ConfirmWithdraw({
  isOpen,
  onClose,
  solanaPubkey,
  withdrawAmount,
  assetFrom,
  assetTo,
  connectedWallets,
  positions,
  serviceFee,
  minerFee,
  layerFee,
  updateTransactions,
  updateZbtcBalance,
  resetInput,
  cryptoType = CryptoCurrency.BTC,
}: ConfirmWithdrawProps) {
  const zplClient = useZplClient();
  const { data: twoWayPegGuardianSettings } = useTwoWayPegGuardianSettings();
  const { connection } = useConnection();

  const [selectedWallet, setSelectedWallet] = useState(
    connectedWallets?.[0] ?? ""
  );
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);
  const [hasUserConfirmed, setHasUserConfirmed] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  const handleWithdraw = () => {
    const action = async () => {
      if (!zplClient) throw new Error("zplClient not found");
      if (!solanaPubkey) throw new Error("Solana Pubkey not found");

      const withdrawAmountBN = new BN(
        new BigNumber(withdrawAmount)
          .multipliedBy(10 ** BTC_DECIMALS)
          .toString()
      );

      const twoWayPegConfiguration =
        await zplClient.getTwoWayPegConfiguration();

      const ixs: TransactionInstruction[] = [];

      // NOTE: asset is in vault, so use the biggest position guardian first
      if (assetFrom.isLocked) {
        if (!positions) {
          return;
        }

        const sortedPositions = positions.toSorted((a, b) =>
          b.storedAmount
            .sub(b.frozenAmount)
            .cmp(a.storedAmount.sub(a.frozenAmount))
        );

        let remainingAmount = withdrawAmountBN.clone();
        for (const position of sortedPositions) {
          const amountToWithdraw = BN.min(
            position.storedAmount.sub(position.frozenAmount),
            remainingAmount
          );

          const twoWayPegGuardianSetting = twoWayPegGuardianSettings.find(
            (setting) =>
              zplClient
                .deriveLiquidityManagementGuardianSettingAddress(
                  new PublicKey(setting.address)
                )
                .toBase58() === position.guardianSetting.toBase58()
          );

          if (!twoWayPegGuardianSetting) return;

          const withdrawalRequestIx = zplClient.constructAddWithdrawalRequestIx(
            solanaPubkey,
            amountToWithdraw,
            convertP2trToTweakedXOnlyPubkey(selectedWallet),
            new PublicKey(twoWayPegGuardianSetting.address),
            twoWayPegConfiguration.layerFeeCollector
          );

          ixs.push(withdrawalRequestIx);
          remainingAmount = remainingAmount.sub(amountToWithdraw);

          if (remainingAmount.eq(new BN(0))) break;
        }
        // NOTE: asset is in wallet, so need to check all guardians store quota and store to the biggest quota guardian first
      } else {
        const twoWayPegGuardiansWithQuota = await Promise.all(
          twoWayPegGuardianSettings.map(async (twoWayPegGuardianSetting) => {
            const totalSplTokenMinted = new BN(
              twoWayPegGuardianSetting.total_amount_pegged
            );

            const splTokenVaultAuthority =
              zplClient.deriveSplTokenVaultAuthorityAddress(
                new PublicKey(twoWayPegGuardianSetting.address)
              );

            const vaultAta = getAssociatedTokenAddressSync(
              new PublicKey(twoWayPegGuardianSetting.asset_mint),
              splTokenVaultAuthority,
              true
            );

            let remainingStoreQuota;
            try {
              const tokenAccountData = await getAccount(connection, vaultAta);
              const splTokenBalance = new BN(
                tokenAccountData.amount.toString()
              );
              remainingStoreQuota = totalSplTokenMinted.sub(splTokenBalance);
            } catch {
              remainingStoreQuota = new BN(0);
            }

            return {
              address: twoWayPegGuardianSetting.address,
              remainingStoreQuota,
              liquidityManagementGuardianSetting:
                zplClient.deriveLiquidityManagementGuardianSettingAddress(
                  new PublicKey(twoWayPegGuardianSetting.address)
                ),
            };
          })
        );

        const sortedTwoWayPegGuardiansWithQuota =
          twoWayPegGuardiansWithQuota.toSorted((a, b) =>
            b.remainingStoreQuota.cmp(a.remainingStoreQuota)
          );

        let remainingAmount = withdrawAmountBN.clone();
        for (const twoWayPegGuardian of sortedTwoWayPegGuardiansWithQuota) {
          const amountToWithdraw = BN.min(
            twoWayPegGuardian.remainingStoreQuota,
            remainingAmount
          );

          const storeIx = zplClient.constructStoreIx(
            withdrawAmountBN,
            new PublicKey(twoWayPegGuardian.address)
          );

          const withdrawalRequestIx = zplClient.constructAddWithdrawalRequestIx(
            solanaPubkey,
            amountToWithdraw,
            convertP2trToTweakedXOnlyPubkey(selectedWallet),
            new PublicKey(twoWayPegGuardian.address),
            twoWayPegConfiguration.layerFeeCollector
          );

          ixs.push(storeIx);
          ixs.push(withdrawalRequestIx);

          remainingAmount = remainingAmount.sub(amountToWithdraw);

          if (remainingAmount.eq(new BN(0))) break;
        }
      }

      const sig = await zplClient.signAndSendTransactionWithInstructions(ixs);

      return sig;
    };

    setIsWithdrawing(true);
    action()
      .catch((e) => {
        if (e instanceof WalletSignTransactionError) {
          notifyError("Sign transaction error");
        } else {
          notifyError("Error in withdrawing, please try again");
          captureException(e);
          console.error(e);
        }
        setIsWithdrawing(false);
      })
      .then((sig) => {
        // NOTE: Wait for the transaction to be handled by hermes
        setTimeout(async () => {
          await updateZbtcBalance();
          await updateTransactions();
          setIsWithdrawing(false);
          resetInput();
          onClose();
          if (sig) {
            notifyTx(true, {
              chain: Chain.Solana,
              txId: sig,
              type: InteractionType.Withdrawal,
            });
          }
        }, 4444);
      });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      width={550}
      backdropType="overrideHeader"
      className="!px-16 !py-20"
    >
      <ModalHeader className="!top-24 right-16 z-10" onClose={onClose} />
      <div className="z-10 flex w-full flex-col gap-y-24 pt-24 sm:pt-0">
        {/* Header */}
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-x-12">
            <Icon
              name="Stake"
              size={18}
              className="text-apollo-brand-primary-blue"
            />
            <span className="body-body1-medium text-sys-color-text-primary">
              Confirm Withdraw
            </span>
          </div>
        </div>

        {/* Asset */}
        <WithdrawAssetBanner assetFrom={assetFrom} assetTo={assetTo} cryptoType={cryptoType} />

        {/* Connected Wallets */}
        <div className="z-50 flex flex-col gap-y-8">
          <span className="body-body1-semibold text-sys-color-text-primary">
            Send to
          </span>
          <Dropdown
            label={shortenString(selectedWallet, 36)}
            size="md"
            width="full"
            type="multi-function"
            selectedIndex={connectedWallets.indexOf(selectedWallet)}
            customPlaceholder="Select Wallet"
            onClear={() => setSelectedWallet("")}
          >
            {connectedWallets.map((wallet, index) => (
              <DropdownOption
                key={wallet}
                label={wallet}
                index={index}
                onClick={() => setSelectedWallet(wallet)}
              >
                <div className="flex items-center gap-x-8">
                  <span>{shortenString(wallet, 36)}</span>
                </div>
              </DropdownOption>
            ))}
          </Dropdown>
        </div>

        {/* Withdrawal Fee */}
        <div className="flex flex-col gap-y-12">
          <span className="body-body1-semibold text-sys-color-text-primary">
            Transaction Fee
          </span>
          <div className="body-body1-medium text-sys-color-text-primary flex flex-col gap-y-8">
            <div className="flex items-center justify-between">
              <div
                className="group relative z-10 flex items-center gap-x-8"
                onMouseOver={() => setIsTooltipOpen(true)}
                onMouseLeave={() => setIsTooltipOpen(false)}
              >
                <span>Service Fee</span>
                <Icon
                  name="InfoSmall"
                  className="group-hover:text-sys-color-text-primary transition"
                />
                <Tooltip
                  isOpen={isTooltipOpen}
                  theme="dark-alt"
                  width={250}
                  arrowPosition="left-middle"
                >
                  The Service Fee is deducted from the final received BTC amount
                  by Orpheus.
                </Tooltip>
              </div>
              <span>{serviceFee} ZBTC</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Miner Fee</span>
              <span>{minerFee} BTC</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Layer Fee</span>
              <span>{layerFee} SOL</span>
            </div>
          </div>
        </div>

        {/* Confirmation */}
        <AnimatePresence>
          {selectedWallet && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.15 }}
              exit={{ opacity: 0 }}
              onClick={() => setHasUserConfirmed(!hasUserConfirmed)}
              className="rounded-12 bg-sys-color-background-card border-apollo-border-15 z-10 flex cursor-pointer flex-col gap-y-4 border p-16"
            >
              <div className=" flex items-center gap-x-12">
                <Checkbox
                  className="cursor-pointer"
                  checked={hasUserConfirmed}
                  handleChange={(checked) => setHasUserConfirmed(checked)}
                ></Checkbox>
                <span className="body-body1-medium text-sys-color-text-primary">
                  I have confirmed this is the correct BTC address:
                </span>
              </div>
              <span className="body-body1-medium text-sys-color-text-primary w-full break-words">
                {selectedWallet}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Actions */}
      <ModalActions className="!pt-40">
        <Button
          type="secondary"
          size="large"
          className="w-full"
          label="Cancel"
          onClick={() => {
            onClose();
          }}
        />
        <Button
          type="primary"
          size="large"
          className="w-full !px-20"
          label="Confirm"
          isLoading={isWithdrawing}
          disabled={!hasUserConfirmed}
          onClick={() => {
            handleWithdraw();
          }}
        />
      </ModalActions>
    </Modal>
  );
}

const WithdrawAssetBanner = ({
  assetFrom,
  assetTo,
  cryptoType = CryptoCurrency.BTC,
}: {
  assetFrom: {
    name: string;
    amount: string;
    isLocked: boolean;
  };
  assetTo: {
    name: string;
    amount: string;
    isLocked: boolean;
  };
  cryptoType?: CryptoCurrency;
}) => {
  return (
    <div className={styles.confirmWithdraw__banner}>
      <div className={styles.confirmWithdraw__banner__item}>
        <div className={styles.confirmWithdraw__banner__item__icon}>
          <Icon name={getZIconName(cryptoType)} />
        </div>
        <div className={styles.confirmWithdraw__banner__item__info}>
          <span className={styles.confirmWithdraw__banner__item__info__amount}>
            {assetFrom.amount}
          </span>
          <span className={styles.confirmWithdraw__banner__item__info__name}>
            {getZAssetName(cryptoType)}
          </span>
          {assetFrom.isLocked && (
            <div
              className={styles.confirmWithdraw__banner__item__info__lock__icon}
            >
              <Icon name="Lock" />
            </div>
          )}
        </div>
      </div>
      <div className={styles.confirmWithdraw__banner__arrow}>
        <Icon name="ChevronRight" />
      </div>
      <div className={styles.confirmWithdraw__banner__item}>
        <div className={styles.confirmWithdraw__banner__item__icon}>
          <Icon name={assetTo.name.toLowerCase() as IconName} />
        </div>
        <div className={styles.confirmWithdraw__banner__item__info}>
          <span className={styles.confirmWithdraw__banner__item__info__amount}>
            {assetTo.amount}
          </span>
          <span className={styles.confirmWithdraw__banner__item__info__name}>
            {assetTo.name}
          </span>
          {assetTo.isLocked && (
            <div
              className={styles.confirmWithdraw__banner__item__info__lock__icon}
            >
              <Icon name="Lock" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Helper functions to get asset names based on crypto type
const getZAssetName = (cryptoType: CryptoCurrency) => {
  switch (cryptoType) {
    case CryptoCurrency.DOGE:
      return "ZDOGE";
    case CryptoCurrency.LTC:
      return "ZLTC";
    case CryptoCurrency.BTC:
    default:
      return "ZBTC";
  }
};

const getZIconName = (cryptoType: CryptoCurrency): IconName => {
  // Using zbtc icon for all tokens since specific icons may not exist
  return "zbtc";
};
