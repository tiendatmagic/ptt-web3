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

  // Lazy inject StateService thông qua getter để tránh circular dependency
  // (StateService inject ApiService, ApiService cần StateService)
  private get stateService(): any {
    return (window as any).__pttStateService__;
  }

  private getHeaders(companyId?: string | number): HttpHeaders {
    let headers = new HttpHeaders({
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    });

    // Inject Authorization Bearer token từ StateService (in-memory token)
    const token = this.stateService?.authToken?.();
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

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

  /**
   * Đăng ký StateService reference vào window để ApiService có thể đọc token
   * mà không bị circular dependency. Gọi method này từ StateService constructor.
   */
  public registerStateRef(stateService: any): void {
    (window as any).__pttStateService__ = stateService;
  }
}
