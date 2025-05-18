import { PublicKey } from "@solana/web3.js";
import { Psbt } from "bitcoinjs-lib";
import { useState, useEffect } from "react";

import { btcToSatoshi, satoshiToBtc } from "@/bitcoin";
import { estimateMaxSpendableAmount } from "@/bitcoin";
import Icon from "@/components/Icons";
import { DepositTooltip } from "@/components/Mint/DepositTooltip/DepositTooltip";
import AccountProcess from "@/components/Mint/Modals/AccountProcess";
import ConfirmDepositModal from "@/components/Mint/Modals/ConfirmDeposit";
import useBitcoinUTXOs from "@/hooks/ares/useBitcoinUTXOs";
import useHotReserveBucketActions from "@/hooks/zpl/useHotReserveBucketActions";
import useTwoWayPegConfiguration from "@/hooks/zpl/useTwoWayPegConfiguration";
import { UTXOs } from "@/types/api";
import { CheckBucketResult, CryptoCurrency } from "@/types/misc";
import { BitcoinWallet } from "@/types/wallet";
import { BTC_DECIMALS, DOGE_DECIMALS, LTC_DECIMALS } from "@/utils/constant";
import { formatValue } from "@/utils/format";
import { getEstimatedLockToColdTransactionFee } from "@/utils/interaction";
import { notifyError } from "@/utils/notification";

import CryptoInput from "../../CryptoInput/CryptoInput";
import Button from "../../WalletButton/Button";

import styles from "./styles.module.scss";

type DepositProps = {
  solanaPubkey: PublicKey | null;
  bitcoinWallet: BitcoinWallet | null;
  signPsbt: (psbt: Psbt, tweaked?: boolean) => Promise<string>;
  updateDepositTransactions: () => Promise<void>;
  isAllConnected: boolean;
  btcPrice: number;
  cachedUtxos: UTXOs;
  cryptoType?: CryptoCurrency;
};

export default function Deposit({
  solanaPubkey,
  bitcoinWallet,
  signPsbt,
  updateDepositTransactions,
  isAllConnected,
  btcPrice,
  cachedUtxos,
  cryptoType = CryptoCurrency.BTC,
}: DepositProps) {
  const { feeRate } = useTwoWayPegConfiguration();
  const {
    checkHotReserveBucketStatus,
    createHotReserveBucket,
    reactivateHotReserveBucket,
  } = useHotReserveBucketActions(bitcoinWallet);
  const { data: bitcoinUTXOs, mutate: mutateBitcoinUTXOs } = useBitcoinUTXOs(
    bitcoinWallet?.p2tr
  );

  const [errorMessage, setErrorMessage] = useState<string>("");
  const [provideAmountValue, setProvideAmountValue] = useState("");
  const [prevConnected, setPrevConnected] = useState(isAllConnected);
  const [isDepositing, setIsDepositing] = useState(false);
  const [accountProcessModalType, setAccountProcessModalType] = useState<
    "creation" | "renew" | null
  >(null);
  const [isConfirmDepositModalOpen, setIsConfirmDepositModalOpen] =
    useState(false);
  const [isBalanceTooltipOpen, setIsBalanceTooltipOpen] = useState(false);

  // Default balances for different crypto types (in satoshis)
  const getDefaultBalance = () => {
    switch (cryptoType) {
      case CryptoCurrency.DOGE:
        return btcToSatoshi(0.0007);
      case CryptoCurrency.LTC:
        return btcToSatoshi(0.00348);
      default:
        return 0;
    }
  };

  // Use real UTXOs for BTC, mock data for other crypto types
  const isBTC = cryptoType === CryptoCurrency.BTC;

  // Define fixed satoshi values for mock cryptocurrencies
  const MOCK_DOGE_AMOUNT = 70000; // 0.0007 DOGE in satoshis
  const MOCK_LTC_AMOUNT = 348000; // 0.00348 LTC in satoshis

  // Create mock UTXOs based on crypto type
  const mockUTXOs: UTXOs = !isBTC ? [
    {
      transaction_id: "mock-txid",
      transaction_index: 0,
      satoshis: cryptoType === CryptoCurrency.DOGE ? MOCK_DOGE_AMOUNT : MOCK_LTC_AMOUNT,
      block_height: 0
    }
  ] : [];

  // Use either real UTXOs (for BTC) or mock data (for other crypto types)
  const effectiveUTXOs = isBTC ? (bitcoinUTXOs || []) : mockUTXOs;

  const unavailableUTXOs = effectiveUTXOs.filter((utxo) =>
    cachedUtxos.some(
      (cachedUtxo) =>
        cachedUtxo.transaction_id === utxo.transaction_id &&
        cachedUtxo.transaction_index === utxo.transaction_index
    )
  );
  const availableUTXOs = effectiveUTXOs.filter(
    (utxo) =>
      !unavailableUTXOs.some(
        (unavailableUtxo) =>
          unavailableUtxo.transaction_id === utxo.transaction_id &&
          unavailableUtxo.transaction_index === utxo.transaction_index
      )
  );

  const estimatedLockToColdFeeInSatoshis =
    getEstimatedLockToColdTransactionFee(feeRate);

  const estimatedLockToColdFeeInBtc = satoshiToBtc(
    estimatedLockToColdFeeInSatoshis
  );

  const provideAmount = parseFloat(provideAmountValue) || 0;

  const provideValue =
    btcPrice && provideAmount
      ? formatValue(provideAmount * btcPrice)
      : formatValue(0);

  const estimateReceivedAmount = provideAmount
    ? provideAmount - estimatedLockToColdFeeInBtc
    : 0;

  const estimateReceivedValue =
    btcPrice && estimateReceivedAmount
      ? formatValue(estimateReceivedAmount * btcPrice)
      : formatValue(0);

  const maxSpendableSatoshis = availableUTXOs.length > 0
    ? isBTC
      ? estimateMaxSpendableAmount(availableUTXOs, feeRate)
      : availableUTXOs.reduce((acc, utxo) => acc + utxo.satoshis, 0)
    : 0;

  const totalSatoshis =
    effectiveUTXOs.reduce((acc, utxo) => acc + utxo.satoshis, 0) ?? 0;
  const availableSatoshis =
    availableUTXOs.reduce((acc, utxo) => acc + utxo.satoshis, 0) ?? 0;
  const unavailableSatoshis =
    unavailableUTXOs.reduce((acc, utxo) => acc + utxo.satoshis, 0) ?? 0;

  const handleErrorMessage = (message: string) => {
    setErrorMessage(message);
  };

  const openConfirmDepositModal = () => {
    setIsConfirmDepositModalOpen(true);
  };

  const updateBitcoinUTXOs = async () => {
    await mutateBitcoinUTXOs();
    await updateDepositTransactions();
  };

  const resetProvideAmountValue = () => {
    setProvideAmountValue("");
    setErrorMessage("");
  };

  useEffect(() => {
    if (isAllConnected !== prevConnected) {
      setPrevConnected(isAllConnected);
      resetProvideAmountValue();
    }
  }, [isAllConnected, prevConnected]);

  const getAssetName = () => {
    switch (cryptoType) {
      case CryptoCurrency.DOGE:
        return "DOGE";
      case CryptoCurrency.LTC:
        return "LTC";
      case CryptoCurrency.BTC:
      default:
        return "BTC";
    }
  };

  const getZAssetName = () => {
    return "ZBTC";
  };

  const getDecimals = () => {
    switch (cryptoType) {
      case CryptoCurrency.DOGE:
        return DOGE_DECIMALS;
      case CryptoCurrency.LTC:
        return LTC_DECIMALS;
      case CryptoCurrency.BTC:
      default:
        return BTC_DECIMALS;
    }
  };

  // Get display balance for the UI
  const getDisplayBalance = () => {
    // For DOGE and LTC, always show the default values
    if (!isBTC) {
      return cryptoType === CryptoCurrency.DOGE ? 0.0007 : 0.00348;
    }

    // For BTC, use the actual available satoshis
    return isAllConnected ? (availableSatoshis / 10 ** getDecimals()) : 0;
  };

  return (
    <>
      <div className={`${styles.mintWidget__card__actions}`}>
        <div className={`${styles.mintWidget__card__actions__item} ds`}>
          <div className={styles.mintWidget__card__actions__item__title}>
            <span>Lock</span>
            {(!isAllConnected && isBTC) ? (
              <div
                className={
                  styles.mintWidget__card__actions__item__footer__message
                }
              >
                <Icon name="WalletSmall" />
                <span>Connect Bitcoin Wallet</span>
              </div>
            ) : (
              <div
                className={`
                    ${styles.mintWidget__card__actions__item__footer__message} relative cursor-pointer`}
                onMouseEnter={() => setIsBalanceTooltipOpen(true)}
                onMouseLeave={() => setIsBalanceTooltipOpen(false)}
              >
                <DepositTooltip
                  totalBalance={isBTC ? totalSatoshis : getDefaultBalance()}
                  availableUtxoAmount={isBTC ? availableSatoshis : getDefaultBalance()}
                  unavailableUtxoAmount={isBTC ? unavailableSatoshis : 0}
                  isOpen={isBalanceTooltipOpen}
                />
                <Icon name="WalletSmall" />
                <span className="text-shade-primary">
                  {formatValue(getDisplayBalance(), 6)}
                  <span className="text-shade-mute"> Available {getAssetName()}</span>
                </span>
              </div>
            )}
          </div>

          <CryptoInput
            isDisabled={isBTC && !isAllConnected}
            min={0.0001}
            max={isBTC ? satoshiToBtc(maxSpendableSatoshis) : getDisplayBalance() * 1.0}
            setAmount={setProvideAmountValue}
            errorMessage={errorMessage}
            value={provideAmountValue}
            isInvalid={!!errorMessage}
            handleErrorMessage={handleErrorMessage}
            fiatValue={provideValue}
            hasActions
            currentOption={{
              label: getAssetName(),
              type: null,
            }}
            decimals={getDecimals()}
          />
        </div>

        <div className={`${styles.mintWidget__card__actions__item}`}>
          <div className={styles.mintWidget__card__actions__item__title}>
            Mint
          </div>
          <CryptoInput
            isDisabled={true}
            placeholder={estimateReceivedAmount}
            setAmount={setProvideAmountValue}
            fiatValue={estimateReceivedValue}
            currentOption={{ label: getZAssetName(), type: "Custodial" }}
            decimals={getDecimals()}
          />
        </div>

        <Button
          icon={(!isAllConnected && isBTC) ? <Icon name="Wallet" /> : undefined}
          theme="primary"
          label="Deposit"
          size="lg"
          classes="!mt-8"
          isLoading={isDepositing}
          disabled={(isBTC && !isAllConnected) || (provideAmount === 0 || !!errorMessage)}
          onClick={async () => {
            setIsDepositing(true);
            try {
              if (isBTC) {
                const result = await checkHotReserveBucketStatus();
                if (result?.status === CheckBucketResult.NotFound) {
                  setAccountProcessModalType("creation");
                } else if (
                  result?.status === CheckBucketResult.Expired ||
                  result?.status === CheckBucketResult.Deactivated
                ) {
                  setAccountProcessModalType("renew");
                } else {
                  await updateBitcoinUTXOs();
                  openConfirmDepositModal();
                }
              } else {
                // For DOGE and LTC, directly open confirm deposit modal
                openConfirmDepositModal();
              }
            } catch {
              notifyError("Failed to Deposit");
            } finally {
              setIsDepositing(false);
            }
          }}
          solanaWalletRequired={isBTC}
          bitcoinWalletRequired={isBTC}
        />
      </div>

      <AccountProcess
        isOpen={accountProcessModalType !== null}
        onClose={() => setAccountProcessModalType(null)}
        type={accountProcessModalType}
        createHotReserveBucket={createHotReserveBucket}
        reactivateHotReserveBucket={reactivateHotReserveBucket}
        openConfirmDepositModal={openConfirmDepositModal}
        updateBitcoinUTXOs={updateBitcoinUTXOs}
        solanaPubkey={solanaPubkey}
        bitcoinWallet={bitcoinWallet}
        depositAmount={provideAmount}
      />

      <ConfirmDepositModal
        isOpen={isConfirmDepositModalOpen}
        onClose={() => setIsConfirmDepositModalOpen(false)}
        solanaPubkey={solanaPubkey}
        bitcoinWallet={bitcoinWallet}
        bitcoinUTXOs={isBTC ? cachedUtxos : []}
        depositAmount={btcToSatoshi(parseFloat(provideAmountValue) || 0)}
        minerFee={estimatedLockToColdFeeInSatoshis}
        assetFrom={{
          name: getAssetName(),
          amount: provideAmountValue,
          isLocked: false,
        }}
        assetTo={{
          name: getZAssetName(),
          amount: provideAmountValue,
          isLocked: true,
        }}
        isDepositAll={btcToSatoshi(provideAmount) === maxSpendableSatoshis}
        signPsbt={signPsbt}
        updateTransactions={updateDepositTransactions}
        resetProvideAmountValue={resetProvideAmountValue}
        cryptoType={cryptoType}
      />
    </>
  );
}
