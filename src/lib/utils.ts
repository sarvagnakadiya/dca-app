import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { mnemonicToAccount } from "viem/accounts";
import {
  APP_BUTTON_TEXT,
  APP_DESCRIPTION,
  APP_ICON_URL,
  APP_NAME,
  APP_OG_IMAGE_URL,
  APP_PRIMARY_CATEGORY,
  APP_SPLASH_BACKGROUND_COLOR,
  APP_TAGS,
  APP_URL,
  APP_WEBHOOK_URL,
} from "./constants";
import { APP_SPLASH_URL } from "./constants";
import { createPublicClient, createWalletClient, custom, http } from "viem";
import { base } from "viem/chains";

interface FrameMetadata {
  version: string;
  name: string;
  iconUrl: string;
  homeUrl: string;
  imageUrl?: string;
  buttonTitle?: string;
  splashImageUrl?: string;
  splashBackgroundColor?: string;
  webhookUrl?: string;
  description?: string;
  primaryCategory?: string;
  tags?: string[];
}

interface FrameManifest {
  accountAssociation?: {
    header: string;
    payload: string;
    signature: string;
  };
  frame: FrameMetadata;
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getSecretEnvVars() {
  const seedPhrase = process.env.SEED_PHRASE;
  const fid = process.env.FID;

  if (!seedPhrase || !fid) {
    return null;
  }

  return { seedPhrase, fid };
}

export function getFrameEmbedMetadata(ogImageUrl?: string) {
  return {
    version: "next",
    imageUrl: ogImageUrl ?? APP_OG_IMAGE_URL,
    button: {
      title: APP_BUTTON_TEXT,
      action: {
        type: "launch_frame",
        name: APP_NAME,
        url: APP_URL,
        splashImageUrl: APP_SPLASH_URL,
        iconUrl: APP_ICON_URL,
        splashBackgroundColor: APP_SPLASH_BACKGROUND_COLOR,
        description: APP_DESCRIPTION,
        primaryCategory: APP_PRIMARY_CATEGORY,
        tags: APP_TAGS,
      },
    },
  };
}

export async function getFarcasterMetadata(): Promise<FrameManifest> {
  // First check for FRAME_METADATA in .env and use that if it exists
  if (process.env.FRAME_METADATA) {
    try {
      const metadata = JSON.parse(process.env.FRAME_METADATA);
      console.log("Using pre-signed frame metadata from environment");
      return metadata;
    } catch (error) {
      console.warn("Failed to parse FRAME_METADATA from environment:", error);
    }
  }

  if (!APP_URL) {
    throw new Error("NEXT_PUBLIC_URL not configured");
  }

  // Get the domain from the URL (without https:// prefix)
  const domain = new URL(APP_URL).hostname;
  console.log("Using domain for manifest:", domain);

  const secretEnvVars = getSecretEnvVars();
  if (!secretEnvVars) {
    console.warn(
      "No seed phrase or FID found in environment variables -- generating unsigned metadata"
    );
  }

  let accountAssociation;
  if (secretEnvVars) {
    // Generate account from seed phrase
    const account = mnemonicToAccount(secretEnvVars.seedPhrase);
    const custodyAddress = account.address;

    const header = {
      fid: parseInt(secretEnvVars.fid),
      type: "custody",
      key: custodyAddress,
    };
    const encodedHeader = Buffer.from(JSON.stringify(header), "utf-8").toString(
      "base64"
    );

    const payload = {
      domain,
    };
    const encodedPayload = Buffer.from(
      JSON.stringify(payload),
      "utf-8"
    ).toString("base64url");

    const signature = await account.signMessage({
      message: `${encodedHeader}.${encodedPayload}`,
    });
    const encodedSignature = Buffer.from(signature, "utf-8").toString(
      "base64url"
    );

    accountAssociation = {
      header: encodedHeader,
      payload: encodedPayload,
      signature: encodedSignature,
    };
  }

  return {
    accountAssociation,
    frame: {
      version: "1",
      name: APP_NAME ?? "Frames v2 Demo",
      iconUrl: APP_ICON_URL,
      homeUrl: APP_URL,
      imageUrl: APP_OG_IMAGE_URL,
      buttonTitle: APP_BUTTON_TEXT ?? "Launch Frame",
      splashImageUrl: APP_SPLASH_URL,
      splashBackgroundColor: APP_SPLASH_BACKGROUND_COLOR,
      webhookUrl: APP_WEBHOOK_URL,
      description: APP_DESCRIPTION,
      primaryCategory: APP_PRIMARY_CATEGORY,
      tags: APP_TAGS,
    },
  };
}

export const publicClient = createPublicClient({
  chain: base,
  transport: http(),
});

export const walletClient =
  typeof window !== "undefined" && window.ethereum
    ? createWalletClient({
        chain: base,
        transport: custom(window.ethereum),
      })
    : null;

export async function executeInitialInvestment(
  planHash: string
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    const response = await fetch(`/api/invest/${planHash}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    if (!data.success) {
      // Provide more specific error messages based on the response
      let errorMessage = data.error || "Failed to execute initial investment";

      // Check for database connection errors
      if (data.error && data.error.includes("Can't reach database server")) {
        errorMessage =
          "Database connection failed. Please try again in a few moments.";
      } else if (
        data.error &&
        data.error.includes("Database connection failed")
      ) {
        errorMessage =
          "Database connection failed. Please try again in a few moments.";
      } else if (response.status === 503) {
        errorMessage =
          "Service temporarily unavailable. Please try again in a few moments.";
      }

      return {
        success: false,
        error: errorMessage,
      };
    }

    return { success: true, txHash: data.txHash };
  } catch (error) {
    console.error("Error executing initial investment:", error);

    // Provide more specific error messages for network errors
    if (error instanceof TypeError && error.message.includes("fetch")) {
      return {
        success: false,
        error:
          "Network connection failed. Please check your internet connection.",
      };
    }

    return {
      success: false,
      error: "Network error occurred. Please try again.",
    };
  }
}
