import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  constructor(protected http: HttpClient) {}

  post(data: any, url: string): Observable<any> {
    return this.http.post(`${url}post.php`, data);
  }
}
