import { OpenedContract } from "@ton/core";
import { KeyPair } from "@ton/crypto";
import { WalletContractV4 } from "@ton/ton";

export type OpenedWallet = {
  contract: OpenedContract<WalletContractV4>;
  keyPair: KeyPair;
};
