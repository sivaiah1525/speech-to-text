import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Transcription {
  id: number;
  title: string;
  text: string;
  language: string;
  engine: string;
  durationMs: number;
  createdAt: string;
  updatedAt: string;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** REST client for the transcription history (CRUD). */
@Injectable({ providedIn: 'root' })
export class TranscriptionService {
  private http = inject(HttpClient);
  private base = '/api/transcriptions';

  list(q = '', page = 1, pageSize = 10): Observable<Page<Transcription>> {
    const params = new HttpParams().set('q', q).set('page', page).set('pageSize', pageSize);
    return this.http.get<Page<Transcription>>(this.base, { params });
  }

  create(body: Partial<Transcription>): Observable<Transcription> {
    return this.http.post<Transcription>(this.base, body);
  }

  update(id: number, body: Partial<Transcription>): Observable<Transcription> {
    return this.http.put<Transcription>(`${this.base}/${id}`, body);
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
