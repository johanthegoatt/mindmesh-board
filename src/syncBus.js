function fallbackChannel(channelName) {
  const eventName = `mindmesh:${channelName}`;

  return {
    postMessage(payload) {
      window.dispatchEvent(new CustomEvent(eventName, { detail: payload }));
    },
    addEventListener(_kind, listener) {
      const wrapped = (event) => listener({ data: event.detail });
      listener.__wrapped = wrapped;
      window.addEventListener(eventName, wrapped);
    },
    removeEventListener(_kind, listener) {
      window.removeEventListener(eventName, listener.__wrapped);
    },
    close() {
      // no-op
    }
  };
}

export function createSyncBus(channelName = "mindmesh-board") {
  const channel = typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel(channelName)
    : fallbackChannel(channelName);

  return {
    publish(payload) {
      channel.postMessage(payload);
    },
    subscribe(listener) {
      const wrapped = (event) => listener(event.data);
      channel.addEventListener("message", wrapped);
      return () => channel.removeEventListener("message", wrapped);
    },
    close() {
      channel.close();
    }
  };
}
