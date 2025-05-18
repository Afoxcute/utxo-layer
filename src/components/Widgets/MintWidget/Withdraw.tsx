import { PublicKey } from "@solana/web3.js";
import BigNumber from "bignumber.js";
import { useState, useEffect } from "react";

import { xOnlyPubkeyHexToP2tr } from "@/bitcoin";
import Icon from "@/components/Icons";
import { IconName } from "@/components/Icons/icons";
import ConfirmWithdraw from "@/components/Mint/Modals/ConfirmWithdraw";
import { useBitcoinWallet } from "@/contexts/BitcoinWalletProvider";
import useHotReserveBucketsByOwner from "@/hooks/zpl/useHotReserveBucketsByOwner";
import useTwoWayPegConfiguration from "@/hooks/zpl/useTwoWayPegConfiguration";
import usePersistentStore from "@/stores/persistentStore";
import useStore from "@/stores/store";
import { CryptoInputOption, CryptoCurrency } from "@/types/misc";
import { Position } from "@/types/zplClient";
import {
  DEFAULT_SERVICE_FEE_BASIS_POINT_PERCENT,
  BTC_DECIMALS,
  DOGE_DECIMALS,
  LTC_DECIMALS,
  DEFAULT_LAYER_FEE,
  MODAL_NAMES,
} from "@/utils/constant";
import { formatValue } from "@/utils/format";
import { getEstimatedWithdrawalTransactionFee } from "@/utils/interaction";

import CryptoInput from "../../CryptoInput/CryptoInput";
import Button from "../../WalletButton/Button";

import styles from "./styles.module.scss";

type WithdrawProps = {
  solanaPubkey: PublicKey | null;
  solanaWalletConnected: boolean;
  positions: Position[];
  btcPrice: number;
  zbtcBalance: BigNumber;
  updateTransactions: () => Promise<void>;
  updateZbtcBalance: () => Promise<void>;
  cryptoType?: CryptoCurrency;
};

export default function Withdraw({
  solanaPubkey,
  solanaWalletConnected,
  positions,
  btcPrice,
  zbtcBalance,
  updateTransactions,
  updateZbtcBalance,
  cryptoType = CryptoCurrency.BTC,
}: WithdrawProps) {
  const bitcoinNetwork = usePersistentStore((state) => state.bitcoinNetwork);
  const openModalByName = useStore((state) => state.openModalByName);

  const { wallet: bitcoinWallet } = useBitcoinWallet();
  const { feeRate } = useTwoWayPegConfiguration();
  const { data: hotReserveBuckets } = useHotReserveBucketsByOwner(solanaPubkey);

  // Set default balances for different crypto types
  const getDefaultBalance = () => {
    switch (cryptoType) {
      case CryptoCurrency.DOGE:
        return new BigNumber(0.000037 * 10 ** DOGE_DECIMALS);
      case CryptoCurrency.LTC:
        return new BigNumber(0.00048 * 10 ** LTC_DECIMALS);
      case CryptoCurrency.BTC:
      default:
        return zbtcBalance;
    }
  };

  // For DOGE and LTC, we'll use predefined balances
  const adjustedBalance = getDefaultBalance();

  const zbtcBalanceInVault =
    positions?.reduce(
      (acc, cur) =>
        acc
          .plus(cur.storedAmount.toString())
          .minus(cur.frozenAmount.toString()),
      new BigNumber(0)
    ) ?? new BigNumber(0);

  // Helper functions - moved up before they're used
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
    // Always return ZBTC regardless of the selected cryptocurrency
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

  const [currentOption, setCurrentOption] = useState<CryptoInputOption>(
    zbtcBalanceInVault?.gt(zbtcBalance)
      ? {
        label: getZAssetName(),
        type: "Custodial",
        icon: "Lock",
      }
      : {
        label: getZAssetName(),
        type: null,
      }
  );
  const [prevConnected, setPrevConnected] = useState(solanaWalletConnected);
  const [provideAmountValue, setProvideAmountValue] = useState("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [prevCryptoType, setPrevCryptoType] = useState<CryptoCurrency>(cryptoType);

  // Update when crypto type changes
  useEffect(() => {
    if (prevCryptoType !== cryptoType) {
      setPrevCryptoType(cryptoType);
      // Reset input when switching crypto types
      resetInput();
    }
  }, [cryptoType]);

  const walletsInHotReserveBuckets = hotReserveBuckets.map((bucket) =>
    xOnlyPubkeyHexToP2tr(
      Buffer.from(bucket.scriptPathSpendPublicKey).toString("hex"),
      bitcoinNetwork,
      "internal"
    )
  );
  const connectedWallets = bitcoinWallet?.p2tr
    ? Array.from(new Set([bitcoinWallet.p2tr, ...walletsInHotReserveBuckets]))
    : Array.from(new Set(walletsInHotReserveBuckets));

  const provideAmount = parseFloat(provideAmountValue) || 0;
  const estimatedWithdrawTransactionFeeInSatoshis =
    getEstimatedWithdrawalTransactionFee(feeRate);
  const estimatedWithdrawTransactionFeeInBtc =
    estimatedWithdrawTransactionFeeInSatoshis / 10 ** getDecimals();

  const estimateServiceFee =
    DEFAULT_SERVICE_FEE_BASIS_POINT_PERCENT * provideAmount;

  const estimateReceiveAmount = provideAmount
    ? provideAmount - estimatedWithdrawTransactionFeeInBtc - estimateServiceFee
    : 0;

  const estimateReceiveBtcValue =
    btcPrice && estimateReceiveAmount
      ? formatValue(estimateReceiveAmount * btcPrice, 2)
      : formatValue(0);

  const btcValue =
    btcPrice && provideAmount
      ? formatValue(provideAmount * btcPrice, 2)
      : formatValue(0);

  const dropdownOptions: CryptoInputOption[] = [
    {
      label: getZAssetName(),
      type: "Custodial",
      amount: zbtcBalanceInVault?.div(10 ** getDecimals()).toNumber(),
      value: formatValue(
        zbtcBalanceInVault?.div(10 ** getDecimals()).multipliedBy(btcPrice),
        2
      ),
      icon: "Lock",
    },
    {
      label: getZAssetName(),
      type: null,
      amount: adjustedBalance?.div(10 ** getDecimals()).toNumber(),
    },
  ];

  const currentBalance = dropdownOptions.find((option) => {
    return (
      option.label === currentOption.label && option.type === currentOption.type
    );
  })?.amount;

  const changeOption = (option: CryptoInputOption) => {
    setCurrentOption(option);
    setProvideAmountValue("");
    setErrorMessage("");
  };

  const handleErrorMessage = (message: string) => {
    setErrorMessage(message);
  };

  const resetInput = () => {
    setProvideAmountValue("");
    setErrorMessage("");
  };

  if (solanaWalletConnected !== prevConnected) {
    setPrevConnected(solanaWalletConnected);
    resetInput();
  }

  return (
    <>
      <div className={`${styles.mintWidget__card__actions}`}>
        <div className={styles.mintWidget__card__actions__item}>
          <div className={styles.mintWidget__card__actions__item__title}>
            <span>Burn</span>
            {!solanaWalletConnected ? (
              <div
                className={
                  styles.mintWidget__card__actions__item__footer__message
                }
              >
                <Icon name="WalletSmall" />
                <span>Connect Wallet</span>
              </div>
            ) : (
              <div
                className={
                  styles.mintWidget__card__actions__item__footer__message
                }
              >
                <Icon name="WalletSmall" />
                <span className="text-shade-primary">
                  {currentBalance ? formatValue(currentBalance, 6) : "0"}
                  <span className="text-shade-mute">
                    {""} {currentOption.label}
                  </span>
                </span>
                {currentOption.icon && (
                  <Icon name={currentOption.icon as IconName} size={14} />
                )}
              </div>
            )}
          </div>

          <CryptoInput
            isDisabled={solanaWalletConnected ? false : true}
            min={0.0001}
            max={currentBalance ?? 0}
            setAmount={setProvideAmountValue}
            errorMessage={errorMessage}
            value={provideAmountValue}
            isInvalid={!!errorMessage}
            handleErrorMessage={handleErrorMessage}
            fiatValue={btcValue}
            hasActions
            dropdownOptions={dropdownOptions}
            currentOption={currentOption}
            changeOption={changeOption}
            decimals={getDecimals()}
          />
        </div>
        <div className={`${styles.mintWidget__card__actions__item}`}>
          <div className={styles.mintWidget__card__actions__item__title}>
            Unlock
          </div>
          <CryptoInput
            isDisabled={true}
            placeholder={estimateReceiveAmount}
            setAmount={setProvideAmountValue}
            fiatValue={estimateReceiveBtcValue}
            currentOption={{
              label: getAssetName(),
              type: null,
            }}
            decimals={getDecimals()}
          />
        </div>
        <Button
          icon={!solanaWalletConnected && <Icon name="Wallet" />}
          theme="primary"
          label={"Withdraw"}
          size="lg"
          classes="!mt-8"
          disabled={provideAmount === 0 || !!errorMessage}
          onClick={() => {
            if (connectedWallets.length > 0) {
              setIsWithdrawModalOpen(true);
            } else {
              openModalByName(MODAL_NAMES.ADD_NEW_WALLET);
            }
          }}
          solanaWalletRequired={true}
        />
        <div className="flex justify-center space-x-2 py-2 text-center text-primary-apollo sm:items-center">
          <Icon name="Alert" />
          <span className="-mt-1 font-medium text-shade-secondary sm:mt-0">
            The withdrawal process takes about 24 hours
          </span>
        </div>
      </div>

      {connectedWallets.length > 0 && (
        <ConfirmWithdraw
          isOpen={isWithdrawModalOpen}
          onClose={() => {
            setIsWithdrawModalOpen(false);
          }}
          solanaPubkey={solanaPubkey}
          withdrawAmount={provideAmount}
          assetFrom={{
            name: getZAssetName(),
            amount: formatValue(provideAmount, 6),
            isLocked: currentOption.type === "Custodial",
          }}
          assetTo={{
            name: getAssetName(),
            amount: formatValue(estimateReceiveAmount, 6),
            isLocked: false,
          }}
          positions={positions}
          connectedWallets={connectedWallets}
          serviceFee={formatValue(estimateServiceFee, 6)}
          minerFee={formatValue(
            estimatedWithdrawTransactionFeeInBtc,
            8
          ).replace(/\.?0+$/, "")}
          layerFee={formatValue(DEFAULT_LAYER_FEE, 2)}
          updateTransactions={updateTransactions}
          updateZbtcBalance={updateZbtcBalance}
          resetInput={resetInput}
          cryptoType={cryptoType}
        />
      )}
    </>
  );
}
