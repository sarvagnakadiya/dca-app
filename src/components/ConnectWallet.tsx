import React from "react";
import Image from "next/image";
import { Button } from "./ui/Button";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { useMiniApp } from "~/components/providers/FrameProvider";
import { truncateAddress } from "~/lib/truncateAddress";

const ConnectWallet: React.FC = () => {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { context } = useMiniApp();

  return (
    <div className="flex flex-col min-h-screen bg-black">
      <div className="w-full h-[70vh] relative">
        <Image
          src="/dca-logo.svg"
          alt="DCA Logo"
          fill
          className="object-cover"
          priority
          draggable={false}
        />
      </div>

      <div className="flex flex-col items-center justify-center flex-1 px-4 py-8">
        {isConnected ? (
          <>
            <Button
              onClick={() => disconnect()}
              className="bg-[#F7931A] hover:bg-[#e07e0b] text-black text-lg font-medium rounded-xl py-4 px-8 w-[90vw] max-w-md mb-4 shadow-lg"
            >
              Disconnect
            </Button>
            {address && (
              <div className="text-white text-sm mb-4">
                Connected: {truncateAddress(address)}
              </div>
            )}
          </>
        ) : context ? (
          /* if context is not null, mini app is running in frame client */
          <Button
            onClick={() => connect({ connector: connectors[0] })}
            className="bg-[#F7931A] hover:bg-[#e07e0b] text-black text-lg font-medium rounded-xl py-4 px-8 w-[90vw] max-w-md mb-4 shadow-lg"
          >
            Connect
          </Button>
        ) : (
          /* if context is null, mini app is running in browser */
          <div className="space-y-2 w-[90vw] max-w-md">
            <Button
              onClick={() => connect({ connector: connectors[1] })}
              className="bg-[#F7931A] hover:bg-[#e07e0b] text-black text-lg font-medium rounded-xl py-4 px-8 w-full mb-4 shadow-lg"
            >
              Connect Coinbase Wallet
            </Button>
            <Button
              onClick={() => connect({ connector: connectors[2] })}
              className="bg-[#F7931A] hover:bg-[#e07e0b] text-black text-lg font-medium rounded-xl py-4 px-8 w-full mb-4 shadow-lg"
            >
              Connect MetaMask
            </Button>
          </div>
        )}

        <p className="text-center text-neutral-400 text-base">
          By connecting your wallet you agree to our{" "}
          <span className="text-white font-semibold">terms</span> &{" "}
          <span className="text-white font-semibold">services</span>.
        </p>
      </div>
    </div>
  );
};

export default ConnectWallet;
