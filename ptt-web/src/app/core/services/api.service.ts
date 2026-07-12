import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/v1`;

  // Auth 100% qua HttpOnly cookie auth_token
  // TokenFromCookieMiddleware phía backend tự inject vào Authorization Bearer
  // Frontend chỉ cần withCredentials: true để browser tự gửi cookie
  private getHeaders(companyId?: string | number): HttpHeaders {
    let headers = new HttpHeaders({
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    });

    if (companyId) {
      headers = headers.set('X-Company-Id', companyId.toString());
    }

    return headers;
  }

  public get<T>(path: string, companyId?: string | number, params?: any): Observable<T> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined) {
          httpParams = httpParams.set(key, params[key]);
        }
      });
    }

    return this.http.get<T>(`${this.baseUrl}/${path}`, {
      headers: this.getHeaders(companyId),
      params: httpParams,
      withCredentials: true
    });
  }

  public post<T>(path: string, body: any, companyId?: string | number): Observable<T> {
    return this.http.post<T>(`${this.baseUrl}/${path}`, body, {
      headers: this.getHeaders(companyId),
      withCredentials: true
    });
  }

  public put<T>(path: string, body: any, companyId?: string | number): Observable<T> {
    return this.http.put<T>(`${this.baseUrl}/${path}`, body, {
      headers: this.getHeaders(companyId),
      withCredentials: true
    });
  }

  public delete<T>(path: string, companyId?: string | number): Observable<T> {
    return this.http.delete<T>(`${this.baseUrl}/${path}`, {
      headers: this.getHeaders(companyId),
      withCredentials: true
    });
  }
}
