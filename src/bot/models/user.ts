export enum UserState {
  WaitImage = "WaitImage",
  WaitName = "WaitName",
  WaitDescription = "WaitDescription",
  WaitWallet = "WaitWallet",
  Submited = "Submited",
}

export type User = {
  state?: UserState;
  name?: string;
  description?: string;
  image?: string;
  wallet?: string;
  votes?: number;
  minted?: boolean;
};
