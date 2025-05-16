import { useMemo } from "react";
import useSWR from "swr";

import { useFetchers } from "@/hooks/misc/useFetchers";
import { PriceInfo, priceInfoSchema } from "@/types/api";

const usePrice = (symbol: string) => {
  const { binanceFetcher } = useFetchers();

  const { data, error, isLoading } = useSWR(
    symbol ? `/v3/ticker/price?symbol=${symbol}USDT` : null,
    binanceFetcher
  );

  // Get 24hr price change
  const { data: priceChange } = useSWR(
    symbol ? `/v3/ticker/24hr?symbol=${symbol}USDT` : null,
    binanceFetcher
  );

  const price = useMemo(() => {
    if (!data) return 0;
    return parseFloat(data.price);
  }, [data]);

  const priceChangePercent = useMemo(() => {
    if (!priceChange) return 0;
    return parseFloat(priceChange.priceChangePercent);
  }, [priceChange]);

  return {
    price,
    priceChangePercent,
    isLoading,
    error,
  };
};

export default usePrice;
