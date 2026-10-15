import * as signalR from "@microsoft/signalr";
import { useEffect, useRef } from "react";

import { env } from "@/config/env";
import { getAccessToken } from "@/lib/apiClient";
import type { Message } from "@/types/api";

// The env API URL already includes the /api/v1 prefix - the hub sits outside versioning at the
// API host root, per Program.cs's app.MapHub<MessagingHub>("/hubs/messaging").
const HUB_URL = `${env.apiUrl.replace(/\/api\/v1\/?$/, "")}/hubs/messaging`;

/**
 * Live-refresh nicety, not a requirement - REST (messaging.getMessages) is always the source of
 * truth. The hub has no client-callable methods, only the server-pushed "ReceiveMessage" event,
 * fired whenever anyone sends a message to the signed-in user (across every conversation they're
 * in, so callers should check message.conversationId themselves before appending it to a
 * specific thread's list).
 */
export function useMessagingHub(
  onMessage: (message: Message) => void,
  /** Connects only while true - pass the signed-in state so it (re)connects after sign-in. */
  enabled = true,
): void {
  const onMessageRef = useRef(onMessage);
  useEffect(() => {
    onMessageRef.current = onMessage;
  });

  useEffect(() => {
    if (!enabled || !getAccessToken()) return;

    // /hubs/* is the one path family that accepts the JWT via query string (see
    // JwtBearerEvents.OnMessageReceived in Program.cs) - a WebSocket handshake can't carry a
    // custom Authorization header. accessTokenFactory puts it there, and asks again on every
    // reconnect, so a token refreshed while the thread is open is picked up instead of the
    // reconnect being rejected with the expired one.
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(HUB_URL, { accessTokenFactory: () => getAccessToken() ?? "" })
      .withAutomaticReconnect()
      .build();

    connection.on("ReceiveMessage", (message: Message) => onMessageRef.current(message));

    connection.start().catch(() => {
      // Best-effort - the screen still works via REST polling/refetch if the live connection
      // never comes up (offline, corporate proxy blocking WebSockets, etc).
    });

    return () => {
      connection.stop();
    };
  }, [enabled]);
}
