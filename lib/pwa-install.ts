interface InstallPromptEvent extends Event {
  prompt: () => Promise<unknown>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let pendingInstallPrompt: InstallPromptEvent | null = null;
let stopCapture: (() => void) | undefined;

export function initializePwaInstallPromptCapture() {
  if (stopCapture) return stopCapture;

  const capturePrompt = (event: Event) => {
    event.preventDefault();
    pendingInstallPrompt = event as InstallPromptEvent;
  };
  const clearPrompt = () => { pendingInstallPrompt = null; };
  window.addEventListener("beforeinstallprompt", capturePrompt);
  window.addEventListener("appinstalled", clearPrompt);

  const dispose = () => {
    if (stopCapture !== dispose) return;
    window.removeEventListener("beforeinstallprompt", capturePrompt);
    window.removeEventListener("appinstalled", clearPrompt);
    clearPrompt();
    stopCapture = undefined;
  };
  stopCapture = dispose;
  return dispose;
}

export function takePwaInstallPrompt() {
  const prompt = pendingInstallPrompt;
  pendingInstallPrompt = null;
  return prompt;
}
