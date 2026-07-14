import { Injectable, signal } from '@angular/core';

export interface ToastMessage {
  mensaje: string;
  tipo: 'success' | 'error' | 'info';
  visible: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  toast = signal<ToastMessage>({
    mensaje: '',
    tipo: 'info',
    visible: false
  });

  private timeoutId: any = null;

  showSuccess(mensaje: string) {
    this.show(mensaje, 'success');
  }

  showError(mensaje: string) {
    this.show(mensaje, 'error');
  }

  showInfo(mensaje: string) {
    this.show(mensaje, 'info');
  }

  private show(mensaje: string, tipo: 'success' | 'error' | 'info') {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    this.toast.set({
      mensaje,
      tipo,
      visible: true
    });

    this.timeoutId = setTimeout(() => {
      this.hide();
    }, 3500);
  }

  hide() {
    this.toast.update(t => ({ ...t, visible: false }));
    this.timeoutId = null;
  }
}
