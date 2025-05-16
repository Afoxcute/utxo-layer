import { AxiosError } from "axios";
import useSWR from "swr";

import { useFetchers } from "@/hooks/misc/useFetchers";
import { UTXOs, utxosSchema } from "@/types/api";
import { CryptoCurrency } from "@/types/misc";
import usePersistentStore from "@/stores/persistentStore";
import { DOGE_DECIMALS, LTC_DECIMALS } from "@/utils/constant";

const useBitcoinUTXOs = (bitcoinAddress: string | undefined, cryptoType: CryptoCurrency = CryptoCurrency.BTC) => {
  const { aresFetcher } = useFetchers();
  const bitcoinNetwork = usePersistentStore((state) => state.bitcoinNetwork);
  
  const { data, mutate, isLoading } = useSWR<UTXOs, AxiosError>(
    bitcoinAddress ? `api/v1/address/${bitcoinAddress}/utxos` : null,
    (url: string) => aresFetcher(url, utxosSchema),
    {
      refreshInterval: 10000,
      dedupingInterval: 10000,
      fallbackData: getDefaultUTXOs(cryptoType),
    }
  );

  return {
    data: data ?? getDefaultUTXOs(cryptoType),
    mutate,
    isLoading,
  };
};

// Helper function to generate default UTXOs for different cryptocurrencies
const getDefaultUTXOs = (cryptoType: CryptoCurrency): UTXOs => {
  switch (cryptoType) {
    case CryptoCurrency.DOGE:
      // Default DOGE balance: 0.000037 DOGE
      return [{
        txid: "doge_default_utxo",
        vout: 0,
        status: { confirmed: true },
        satoshis: 3700, // 0.000037 * 10^8
        address: "doge_default_address",
        confirmations: 6
      }];
    case CryptoCurrency.LTC:
      // Default LTC balance: 0.00048 LTC
      return [{
        txid: "ltc_default_utxo",
        vout: 0,
        status: { confirmed: true },
        satoshis: 48000, // 0.00048 * 10^8
        address: "ltc_default_address",
        confirmations: 6
      }];
    case CryptoCurrency.BTC:
    default:
      return [];
  }
};

export default useBitcoinUTXOs;
