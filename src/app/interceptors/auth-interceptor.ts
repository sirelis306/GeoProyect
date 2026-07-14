import { HttpInterceptorFn, HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, of, throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('token_geo');
  const router = inject(Router);

  let authReq = req;
  if (token) {
    authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // Si el error es de parseo pero el status es 200 OK, intentamos sanitizar y recuperar
      if (error.status === 200 && error.error && typeof error.error.text === 'string') {
        try {
          let text: string = error.error.text.trim();

          // 1. Eliminar cualquier carácter basura o advertencia antes del JSON real (busca '[' o '{')
          const firstChar = text.charAt(0);
          if (firstChar !== '[' && firstChar !== '{') {
            const startIdx = text.search(/[{}\[\]]/);
            if (startIdx !== -1) {
              text = text.substring(startIdx);
            }
          }

          // 2. Sanitizar caracteres de control no escapados dentro de cadenas (como nuevas líneas físicas o tabulaciones de la BD)
          let sanitizedText = text.replace(/[\x00-\x1F\x7F-\x9F]/g, (char) => {
            if (char === '\n') return '\\n';
            if (char === '\r') return '\\r';
            if (char === '\t') return '\\t';
            return ''; // Remover otros caracteres de control no permitidos
          });

          // 3. Intentar parsear el JSON sanitizado
          const parsed = JSON.parse(sanitizedText);
          console.log('[Interceptor] JSON recuperado y parseado con éxito tras fallo en Angular.');

          const successResponse = new HttpResponse({
            body: parsed,
            headers: error.headers,
            status: 200,
            statusText: 'OK',
            url: error.url || undefined
          });
          return of(successResponse);
        } catch (parseError) {
          console.error('[Interceptor] Fallo crítico al intentar parsear manualmente la respuesta:', parseError);
        }
      }

      if (error.status === 401) {
        // Token inválido o expirado, limpiar y mandar a login con parámetro explicativo
        localStorage.removeItem('token_geo');
        localStorage.removeItem('user_geo');
        router.navigate(['/login'], { queryParams: { expired: 'true' } });
      }
      return throwError(() => error);
    })
  );
};