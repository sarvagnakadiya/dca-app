"use client";

import { useAccount } from "wagmi";
import ConnectWallet from "~/components/ConnectWallet";
import Home from "~/components/Home";

export default function App() {
  const { isConnected } = useAccount();

  return isConnected ? <Home /> : <ConnectWallet />;
}
