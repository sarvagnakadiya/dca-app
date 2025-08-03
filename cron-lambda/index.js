import { PrismaClient } from "@prisma/client";
import { ethers } from "ethers";

const prisma = new PrismaClient();

// Contract setup
const DCA_EXECUTOR_ADDRESS = process.env.DCA_EXECUTOR_ADDRESS;
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // USDC on Base
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

// 1inch API configuration
const ONEINCH_API_KEY = process.env.ONEINCH_API_KEY;
const ONEINCH_BASE_URL = "https://api.1inch.dev/swap/v6.0/8453/swap";

// GeckoTerminal API configuration
const GECKOTERMINAL_BASE_URL =
  "https://api.geckoterminal.com/api/v2/networks/base/tokens";

const DCAExecutorABI = [
  {
    inputs: [
      {
        internalType: "address",
        name: "user",
        type: "address",
      },
      {
        internalType: "address",
        name: "tokenOut",
        type: "address",
      },
      {
        internalType: "address",
        name: "recipient",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "amountIn",
        type: "uint256",
      },
      {
        internalType: "bytes",
        name: "swapData",
        type: "bytes",
      },
    ],
    name: "executeSwap",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "user",
        type: "address",
      },
      {
        internalType: "address",
        name: "tokenOut",
        type: "address",
      },
      {
        internalType: "address",
        name: "recipient",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "amountIn",
        type: "uint256",
      },
      {
        internalType: "bytes",
        name: "swapData",
        type: "bytes",
      },
    ],
    name: "executeNativeSwap",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
];

// ERC20 ABI for allowance checking
const ERC20ABI = [
  {
    inputs: [
      {
        internalType: "address",
        name: "owner",
        type: "address",
      },
      {
        internalType: "address",
        name: "spender",
        type: "address",
      },
    ],
    name: "allowance",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
];

// Contract instance
const contractInstance = new ethers.Contract(
  DCA_EXECUTOR_ADDRESS,
  DCAExecutorABI,
  signer
);

async function getSwapData(srcToken, dstToken, amount, fromAddress, recipient) {
  try {
    const params = new URLSearchParams({
      src: srcToken,
      dst: dstToken,
      amount: amount.toString(),
      from: DCA_EXECUTOR_ADDRESS,
      origin: recipient,
      slippage: "5",
      disableEstimate: "true",
      referrer: "0xe42c136730a9cfefb5514d4d3d06eb27baaf3f08",
      fee: "3",
    });

    const url = `${ONEINCH_BASE_URL}?${params.toString()}`;

    console.log(`Fetching swap data from 1inch API: ${url}`);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${ONEINCH_API_KEY}`,
        accept: "application/json",
        "content-type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(
        `1inch API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    console.log("1inch API response:", JSON.stringify(data, null, 2));

    if (data.tx && data.tx.data) {
      return data.tx.data;
    } else {
      throw new Error("No swap data found in 1inch API response");
    }
  } catch (error) {
    console.error("Error fetching swap data from 1inch API:", error);
    throw error;
  }
}

async function checkTokenAllowance(tokenAddress, ownerAddress) {
  try {
    // Create ERC20 contract instance
    const tokenContract = new ethers.Contract(tokenAddress, ERC20ABI, provider);

    // Check allowance directly from the token contract
    // allowance(owner, spender) - check how much owner has approved for spender (DCA executor)
    const allowance = await tokenContract.allowance(
      ownerAddress,
      DCA_EXECUTOR_ADDRESS
    );

    console.log(
      `Token allowance for ${ownerAddress} on ${tokenAddress}: ${allowance.toString()}`
    );
    return allowance;
  } catch (error) {
    console.error(`Error checking token allowance:`, error);
    throw error;
  }
}

async function notifyUserForMoreApproval(planHash, userWallet) {
  try {
    // TODO: Implement proper notification system
    console.log(
      `User ${userWallet} needs to approve more tokens for plan ${planHash}`
    );
  } catch (error) {
    console.error(
      `Error notifying user ${userWallet} for plan ${planHash}:`,
      error
    );
  }
}

async function executeDCAPlan(plan, currentTimestamp) {
  try {
    console.log("Executing DCA plan:", plan);
    console.log("Current timestamp:", currentTimestamp);

    // Get swap data from 1inch API
    // For now, we need to determine the source token
    // Since the schema doesn't have tokenIn, we'll need to determine this based on your logic
    // For this example, I'll assume USDC as the source token - you may need to adjust this
    const srcToken = USDC_ADDRESS; // USDC on Base
    const dstToken = plan.tokenOut.address;
    const amount = plan.amountIn.toString();
    const fromAddress = plan.userWallet;
    const recipient = plan.recipient;

    console.log(
      `Getting swap data for: ${srcToken} -> ${dstToken}, amount: ${amount}`
    );

    const swapData = await getSwapData(
      srcToken,
      dstToken,
      amount,
      fromAddress,
      recipient
    );
    console.log(`Received swap data: ${swapData}`);

    let tx;

    // Check if the token is WETH (wrapped token)
    if (plan.tokenOut.isWrapped) {
      console.log("Executing native swap for WETH");
      tx = await contractInstance.executeNativeSwap(
        plan.userWallet, // user
        plan.tokenOut.address, // tokenOut
        plan.recipient, // recipient
        BigInt(plan.amountIn.toString()), // amountIn
        swapData // swapData from 1inch API
      );
    } else {
      console.log("Executing regular swap");
      tx = await contractInstance.executeSwap(
        plan.userWallet, // user
        plan.tokenOut.address, // tokenOut
        plan.recipient, // recipient
        BigInt(plan.amountIn.toString()), // amountIn
        swapData // swapData from 1inch API
      );
    }

    // Wait for transaction to be mined
    const receipt = await tx.wait();

    // Get the amountOut from the transaction receipt logs
    // Parse the SwapExecuted event to extract amountOut
    const eventTopic =
      "0xad671c9d50262b75ba17bdf7e330ae0d7da971800b2526584a85f83d23296b15"; // SwapExecuted event signature
    let amountOut = "0";
    let feeAmount = "0";
    let amountIn = plan.amountIn.toString();

    if (receipt.logs && receipt.logs.length > 0) {
      console.log("Receipt logs:", receipt.logs);

      // Find the SwapExecuted event log
      const swapExecutedEvent = receipt.logs.find(
        (log) =>
          log.address.toLowerCase() === DCA_EXECUTOR_ADDRESS.toLowerCase() &&
          log.topics[0] === eventTopic
      );

      if (swapExecutedEvent) {
        console.log("Found SwapExecuted event log:", swapExecutedEvent);

        // Parse the event data according to the new structure:
        // event SwapExecuted(
        //   address indexed user,        // topic[1]
        //   address recipient,           // data[0:32]
        //   address toToken,             // data[32:64]
        //   uint256 amountIn,            // data[64:96]
        //   uint256 indexed amountOut,   // topic[2]
        //   uint256 feeAmount            // data[96:128]
        // );

        // Extract indexed parameters from topics
        const userAddress = "0x" + swapExecutedEvent.topics[1].slice(26); // Remove padding from indexed address
        const amountOutIndexed = BigInt(swapExecutedEvent.topics[2]).toString();

        // Extract non-indexed parameters from data
        const data = swapExecutedEvent.data.replace(/^0x/, "");

        if (data.length >= 64 * 2) {
          const recipientHex = data.slice(0, 64);
          const toTokenHex = data.slice(64, 128);
          const amountInHex = data.slice(128, 192);

          const recipient = "0x" + recipientHex.slice(24); // Remove padding from address
          const toToken = "0x" + toTokenHex.slice(24); // Remove padding from address
          amountIn = BigInt("0x" + amountInHex).toString();
          amountOut = amountOutIndexed; // Use indexed amountOut from topics

          // Calculate fee amount as 3% of amountIn
          feeAmount = ((BigInt(amountIn) * BigInt(3)) / BigInt(100)).toString();

          console.log(`User: ${userAddress}`);
          console.log(`Recipient: ${recipient}`);
          console.log(`ToToken: ${toToken}`);
          console.log(`AmountIn: ${amountIn}`);
          console.log(`AmountOut: ${amountOut}`);
          console.log(`FeeAmount (3% of AmountIn): ${feeAmount}`);
        } else {
          console.log("Log data too short or malformed:", data);
        }
      }
    }

    if (amountOut === "0") {
      console.log("Warning: Could not extract amountOut from transaction logs");
    }

    // Update the plan
    await prisma.dCAPlan.update({
      where: { planHash: plan.planHash },
      data: {
        lastExecutedAt: currentTimestamp,
      },
    });

    // Create execution record
    await prisma.dCAExecution.create({
      data: {
        txHash: tx.hash,
        planHash: plan.planHash,
        amountIn: amountIn,
        tokenOutAddress: plan.tokenOut.address,
        amountOut: amountOut,
        feeAmount: feeAmount,
      },
    });

    console.log(`Executed DCA plan: ${plan.planHash}`);
    console.log(`Transaction hash: ${tx.hash}`);
  } catch (error) {
    console.error(`Transaction failed for plan ${plan.planHash}:`, error);

    // Check if error is due to insufficient allowance
    if (
      error.shortMessage?.includes("ERC20: transfer amount exceeds allowance")
    ) {
      console.log(
        `Insufficient allowance for plan ${plan.planHash} - user needs to approve more tokens`
      );
      await notifyUserForMoreApproval(plan.planHash, plan.userWallet);
    }

    throw error;
  }
}

async function fetchTokenDataFromGeckoTerminal(tokenAddress) {
  try {
    const url = `${GECKOTERMINAL_BASE_URL}/${tokenAddress}`;
    console.log(`Fetching token data from GeckoTerminal: ${url}`);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(
        `GeckoTerminal API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    console.log("GeckoTerminal API response:", JSON.stringify(data, null, 2));

    if (data.data && data.data.attributes) {
      const attributes = data.data.attributes;
      return {
        price: attributes.price_usd ? parseFloat(attributes.price_usd) : null,
        fdv: attributes.fdv_usd ? parseFloat(attributes.fdv_usd) : null,
        marketcap: attributes.market_cap_usd
          ? parseFloat(attributes.market_cap_usd)
          : null,
        volume24h: attributes.volume_usd?.h24
          ? parseFloat(attributes.volume_usd.h24)
          : null,
        totalSupply: attributes.normalized_total_supply
          ? parseFloat(attributes.normalized_total_supply)
          : null,
      };
    } else {
      throw new Error("Invalid response structure from GeckoTerminal API");
    }
  } catch (error) {
    console.error(`Error fetching token data for ${tokenAddress}:`, error);
    throw error;
  }
}

async function updateAllTokenPrices() {
  try {
    console.log("Starting token price update from GeckoTerminal...");

    // Get all tokens from the database
    const tokens = await prisma.token.findMany();
    console.log(`Found ${tokens.length} tokens to update`);

    let successCount = 0;
    let errorCount = 0;

    for (const token of tokens) {
      try {
        console.log(
          `\n--- Updating token ${token.symbol} (${token.address}) ---`
        );

        const tokenData = await fetchTokenDataFromGeckoTerminal(token.address);

        // Update the token in the database
        await prisma.token.update({
          where: { address: token.address },
          data: {
            price: tokenData.price,
            fdv: tokenData.fdv,
            marketcap: tokenData.marketcap,
            volume24h: tokenData.volume24h,
            totalSupply: tokenData.totalSupply,
          },
        });

        console.log(`✅ Successfully updated ${token.symbol}:`);
        console.log(`   Price: $${tokenData.price}`);
        console.log(`   FDV: $${tokenData.fdv}`);
        console.log(`   Market Cap: $${tokenData.marketcap}`);
        console.log(`   24h Volume: $${tokenData.volume24h}`);
        console.log(`   Total Supply: ${tokenData.totalSupply}`);

        successCount++;

        // Add a small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.error(
          `❌ Failed to update token ${token.symbol} (${token.address}):`,
          error
        );
        errorCount++;

        // Continue with other tokens even if one fails
        continue;
      }
    }

    console.log(`\n📊 Token price update completed:`);
    console.log(`   ✅ Successfully updated: ${successCount} tokens`);
    console.log(`   ❌ Failed to update: ${errorCount} tokens`);
    console.log(`   📈 Total tokens processed: ${tokens.length}`);
  } catch (error) {
    console.error("❌ Error in updateAllTokenPrices:", error);
    throw error;
  }
}

async function checkAndExecutePlans() {
  try {
    const currentTimestamp = Math.floor(Date.now() / 1000);
    console.log(`Current timestamp: ${currentTimestamp}`);

    try {
      // Get all active plans with token information
      const plans = await prisma.dCAPlan.findMany({
        where: {
          active: true,
        },
        include: {
          tokenOut: true,
          user: true,
        },
      });

      console.log(`Found ${plans.length} active plans`);

      for (const plan of plans) {
        try {
          console.log(`\n--- Processing Plan ${plan.planHash} ---`);
          console.log(`Plan Hash: ${plan.planHash}`);
          console.log(`User Wallet: ${plan.userWallet}`);
          console.log(`Recipient: ${plan.recipient}`);
          console.log(`Amount In: ${plan.amountIn}`);
          console.log(`Frequency: ${plan.frequency} seconds`);
          console.log(`Last Executed At: ${plan.lastExecutedAt}`);
          console.log(
            `Token Out: ${plan.tokenOut.symbol} (${plan.tokenOut.address}) - Is Wrapped: ${plan.tokenOut.isWrapped}`
          );

          const timeSinceLastExecution = currentTimestamp - plan.lastExecutedAt;
          const frequencySeconds = Number(plan.frequency);

          console.log(
            `Time since last execution: ${timeSinceLastExecution} seconds`
          );
          console.log(`Frequency required: ${frequencySeconds} seconds`);
          console.log(
            `Should execute: ${timeSinceLastExecution >= frequencySeconds}`
          );

          // 1. Check if enough time has passed since last execution
          if (timeSinceLastExecution >= frequencySeconds) {
            console.log(`✅ Plan ${plan.planHash} is due for execution`);

            const amountIn = Number(plan.amountIn);
            console.log(`Amount to execute: ${amountIn}`);

            // 2. Check actual token allowance from blockchain (only for non-native swaps)
            if (!plan.tokenOut.isWrapped) {
              try {
                console.log(
                  `Checking USDC allowance for ${plan.tokenOut.symbol} swap...`
                );
                const currentAllowance = await checkTokenAllowance(
                  USDC_ADDRESS, // USDC address
                  plan.userWallet // user's wallet address
                );

                console.log(
                  `Current USDC allowance: ${currentAllowance.toString()}`
                );
                console.log(`Required USDC amount: ${amountIn}`);
                console.log(
                  `USDC allowance sufficient: ${
                    Number(currentAllowance) >= amountIn
                  }`
                );

                // 3. Skip execution if amountIn is greater than current allowance
                if (amountIn > Number(currentAllowance)) {
                  console.log(
                    `❌ Skipping plan ${
                      plan.planHash
                    } - insufficient USDC allowance. Required: ${amountIn}, Available: ${currentAllowance.toString()}`
                  );
                  await notifyUserForMoreApproval(
                    plan.planHash,
                    plan.userWallet
                  );
                  continue;
                }
              } catch (allowanceError) {
                console.error(
                  `❌ Error checking allowance for plan ${plan.planHash}:`,
                  allowanceError
                );
                // Skip this plan if we can't check allowance
                continue;
              }
            } else {
              console.log(`Native swap - no allowance check needed for WETH`);
            }

            // 4. Execute the plan if allowance is sufficient (or native swap)
            try {
              console.log(`🚀 Executing plan ${plan.planHash}...`);
              await executeDCAPlan(plan, currentTimestamp);
              console.log(`✅ Successfully executed plan ${plan.planHash}`);
            } catch (executionError) {
              console.error(
                `❌ Failed to execute plan ${plan.planHash}:`,
                executionError
              );
              // Continue with other plans even if one fails
              continue;
            }
          } else {
            console.log(
              `⏰ Plan ${plan.planHash} is not due yet. Time remaining: ${
                frequencySeconds - timeSinceLastExecution
              } seconds`
            );
          }
        } catch (planError) {
          console.error(
            `❌ Error processing plan ${plan.planHash}:`,
            planError
          );
          // Continue with other plans even if one fails
          continue;
        }
      }
    } catch (dbError) {
      console.error("❌ Error fetching plans from database:", dbError);
    }
  } catch (error) {
    console.error("❌ Error in checkAndExecutePlans:", error);
  }
}

// Main function for AWS Lambda
export const handler = async function (event, context) {
  context.callbackWaitsForEmptyEventLoop = false;

  try {
    console.log("Starting DCA plans execution...");

    // First, update all token prices from GeckoTerminal
    console.log("🔄 Step 1: Updating token prices from GeckoTerminal...");
    await updateAllTokenPrices();
    console.log("✅ Token prices updated successfully");

    // Then, check and execute DCA plans
    console.log("🔄 Step 2: Checking and executing DCA plans...");
    await checkAndExecutePlans();
    console.log("✅ DCA plans execution completed successfully");
  } catch (error) {
    console.error("Error in Lambda execution:", error);
    throw error; // Re-throw the error to mark the Lambda execution as failed
  } finally {
    // Close Prisma connection
    await prisma.$disconnect();
  }
};

// Export the token price update function for standalone use
export { updateAllTokenPrices };
