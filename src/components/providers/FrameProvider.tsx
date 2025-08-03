"use client";

import { useEffect, useState, useCallback } from "react";
import sdk, {
  type Context,
  type MiniAppNotificationDetails,
  AddMiniApp,
} from "@farcaster/frame-sdk";
import { createStore } from "mipd";
import React from "react";
import { logEvent } from "../../lib/amplitude";

interface FrameContextType {
  isSDKLoaded: boolean;
  context: Context.MiniAppContext | undefined;
  openUrl: (url: string) => Promise<void>;
  close: () => Promise<void>;
  added: boolean;
  notificationDetails: MiniAppNotificationDetails | null;
  lastEvent: string;
  addFrame: () => Promise<void>;
  addFrameResult: string;
}

const MiniAppContext = React.createContext<FrameContextType | undefined>(
  undefined
);

export function useMiniApp() {
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [context, setContext] = useState<Context.MiniAppContext>();
  const [added, setAdded] = useState(false);
  const [notificationDetails, setNotificationDetails] =
    useState<MiniAppNotificationDetails | null>(null);
  const [lastEvent, setLastEvent] = useState("");
  const [addFrameResult, setAddFrameResult] = useState("");

  // SDK actions only work in mini app clients, so this pattern supports browser actions as well
  const openUrl = useCallback(
    async (url: string) => {
      if (context) {
        await sdk.actions.openUrl(url);
      } else {
        window.open(url, "_blank");
      }
    },
    [context]
  );

  const close = useCallback(async () => {
    if (context) {
      await sdk.actions.close();
    } else {
      window.close();
    }
  }, [context]);

  const addFrame = useCallback(async () => {
    try {
      setNotificationDetails(null);
      const result = await sdk.actions.addFrame();

      if (result.notificationDetails) {
        setNotificationDetails(result.notificationDetails);
      }
      setAddFrameResult(
        result.notificationDetails
          ? `Added, got notificaton token ${result.notificationDetails.token} and url ${result.notificationDetails.url}`
          : "Added, got no notification details"
      );
    } catch (error) {
      if (
        error instanceof AddMiniApp.RejectedByUser ||
        error instanceof AddMiniApp.InvalidDomainManifest
      ) {
        setAddFrameResult(`Not added: ${error.message}`);
      } else {
        setAddFrameResult(`Error: ${error}`);
      }
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      const context = await sdk.context;
      setContext(context);
      setIsSDKLoaded(true);

      const amplitudeBaseEvent = {
        fid: context.user.fid,
        username: context.user.username,
        clientFid: context.client.clientFid,
      };
      const amplitudeUserId = `${context.user.fid}-${context.client.clientFid}`;

      logEvent(
        "Frame Opened",
        {
          ...amplitudeBaseEvent,
          location: context.location?.type || "unknown",
          added: context.client.added,
        },
        amplitudeUserId
      );

      // Set up event listeners
      sdk.on("miniAppAdded", ({ notificationDetails }) => {
        console.log("Frame added", notificationDetails);
        setAdded(true);
        setNotificationDetails(notificationDetails ?? null);
        setLastEvent("Frame added");
        logEvent("Frame Added", amplitudeBaseEvent, amplitudeUserId);
      });

      sdk.on("miniAppAddRejected", ({ reason }) => {
        console.log("Frame add rejected", reason);
        setAdded(false);
        setLastEvent(`Frame add rejected: ${reason}`);
        logEvent("Frame Add Rejected", amplitudeBaseEvent, amplitudeUserId);
      });

      sdk.on("miniAppRemoved", () => {
        console.log("Frame removed");
        setAdded(false);
        setLastEvent("Frame removed");
        logEvent("Frame Removed", amplitudeBaseEvent, amplitudeUserId);
      });

      sdk.on("notificationsEnabled", ({ notificationDetails }) => {
        console.log("Notifications enabled", notificationDetails);
        setNotificationDetails(notificationDetails ?? null);
        setLastEvent("Notifications enabled");
        logEvent("Notifications Enabled", amplitudeBaseEvent, amplitudeUserId);
      });

      sdk.on("notificationsDisabled", () => {
        console.log("Notifications disabled");
        setNotificationDetails(null);
        setLastEvent("Notifications disabled");
        logEvent("Notifications Disabled", amplitudeBaseEvent, amplitudeUserId);
      });

      sdk.on("primaryButtonClicked", () => {
        console.log("Primary button clicked");
        setLastEvent("Primary button clicked");
      });

      // Set up MIPD Store
      const store = createStore();
      store.subscribe((providerDetails) => {
        console.log("PROVIDER DETAILS", providerDetails);
      });
    };

    if (sdk && !isSDKLoaded) {
      console.log("Calling load");
      setIsSDKLoaded(true);
      load();
      return () => {
        sdk.removeAllListeners();
      };
    }
  }, [isSDKLoaded]);

  return {
    isSDKLoaded,
    context,
    added,
    notificationDetails,
    lastEvent,
    addFrame,
    addFrameResult,
    openUrl,
    close,
  };
}

export function FrameProvider({ children }: { children: React.ReactNode }) {
  const frameContext = useMiniApp();

  if (!frameContext.isSDKLoaded) {
    return <div>Loading...</div>;
  }

  return (
    <MiniAppContext.Provider value={frameContext}>
      {children}
    </MiniAppContext.Provider>
  );
}
