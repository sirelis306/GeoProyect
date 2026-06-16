import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth/authService';

export const authGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.estaLogueado()) {
    const user = auth.currentUser();
    const requiereCambio = user && (user.cambiar_password === true || user.cambiar_password === 1);
    const esRutaCambio = state.url.includes('cambiar-contrasena');

    if (requiereCambio) {
      if (!esRutaCambio) {
        router.navigate(['/cambiar-contrasena']);
        return false;
      }
      return true;
    } else {
      return true;
    }
  } else {
    router.navigate(['/login']); // Bloqueado, vuelve al login
    return false;
  }
};