/** In-app notifications (no browser alert/confirm/prompt). */

type ToastKind = 'info' | 'success' | 'error';
type Toast = { id: number; message: string; kind: ToastKind };
type ConfirmReq = {
  id: number;
  message: string;
  resolve: (ok: boolean) => void;
};

let toastId = 1;
let confirmId = 1;
let toasts: Toast[] = [];
let confirmQueue: ConfirmReq[] = [];
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

export function subscribeNotify(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function getToasts() {
  return toasts;
}

export function getConfirm() {
  return confirmQueue[0] || null;
}

export function toast(message: string, kind: ToastKind = 'info') {
  const id = toastId++;
  toasts = [...toasts, { id, message, kind }];
  emit();
  window.setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    emit();
  }, 3200);
}

export function toastSuccess(message: string) {
  toast(message, 'success');
}

export function toastError(message: string) {
  toast(message, 'error');
}

export function confirmAsync(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    const id = confirmId++;
    confirmQueue = [...confirmQueue, { id, message, resolve }];
    emit();
  });
}

export function resolveConfirm(ok: boolean) {
  const cur = confirmQueue[0];
  if (!cur) return;
  confirmQueue = confirmQueue.slice(1);
  cur.resolve(ok);
  emit();
}

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}
