import { HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

/**
 * Muestra un mensaje de error si falla alguna petición HTTP.
 *
 * @param req La solicitud HTTP a evaluar
 * @param next Handler que envía la solicitud al siguiente interceptor en la cadena.
 *
 * @returns Un observable que pasa por el interceptor y captura errores.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((error) => {
      console.error(error.message);

      return throwError(() => error);
    })
  )
};
