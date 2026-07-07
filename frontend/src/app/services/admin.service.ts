import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Admin {
  id: number;
  username: string;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly url = `${environment.apiUrl}/api/admins`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<Admin[]> {
    return this.http.get<Admin[]>(this.url);
  }

  create(username: string, password: string): Observable<Admin> {
    return this.http.post<Admin>(this.url, { username, password });
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  changePassword(id: number, newPassword: string): Observable<void> {
    return this.http.put<void>(`${this.url}/${id}/password`, { newPassword });
  }
}
