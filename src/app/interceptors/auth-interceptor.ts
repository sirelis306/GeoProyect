import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('token_geo');
  
  // Si NO hay token, simplemente sigue adelante sin tocar nada
  if (!token) {
    return next(req);
  }

  // Si HAY token, clona y agrega el header
  const cloned = req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`
    }
  });
  return next(cloned);
};