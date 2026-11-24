import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Engine, SpeechService } from './speech.service';
import { Transcription, TranscriptionService } from './transcription.service';

@Component({
  selector: 'app-root',
  imports: [FormsModule, DatePipe],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  speech = inject(SpeechService);
  private api = inject(TranscriptionService);

  // Recorder settings
  engine = signal<Engine>('browser');
  language = signal('hi-IN');
  languages = [
    { code: 'hi-IN', label: 'Hindi + English (Hinglish)' },
    { code: 'en-IN', label: 'English (India)' },
    { code: 'ta-IN', label: 'Tamil' },
    { code: 'te-IN', label: 'Telugu' },
  ];
  saving = signal(false);

  // History (CRUD)
  items = signal<Transcription[]>([]);
  total = signal(0);
  page = signal(1);
  pageSize = 8;
  search = signal('');
  editingId = signal<number | null>(null);
  editTitle = '';
  editText = '';
  message = signal('');

  pages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize)));
  liveText = computed(() => (this.speech.finalText() + ' ' + this.speech.interimText()).trim());

  ngOnInit(): void {
    this.load();
  }

  async toggle(): Promise<void> {
    if (this.speech.listening()) this.speech.stop();
    else {
      this.speech.reset();
      await this.speech.start(this.engine(), this.language());
    }
  }

  save(): void {
    const text = this.speech.finalText().trim();
    if (!text) return;
    this.saving.set(true);
    this.api.create({
      text,
      language: this.language(),
      engine: this.engine(),
      durationMs: this.speech.elapsedMs,
    }).subscribe({
      next: () => {
        this.speech.reset();
        this.page.set(1);
        this.flash('Transcription saved');
        this.load();
      },
      error: () => this.flash('Could not save. Is the server running?'),
      complete: () => this.saving.set(false),
    });
  }

  load(): void {
    this.api.list(this.search(), this.page(), this.pageSize).subscribe({
      next: (res) => { this.items.set(res.items); this.total.set(res.total); },
      error: () => this.flash('Could not load history'),
    });
  }

  onSearch(value: string): void {
    this.search.set(value);
    this.page.set(1);
    this.load();
  }

  goTo(p: number): void {
    if (p < 1 || p > this.pages()) return;
    this.page.set(p);
    this.load();
  }

  startEdit(t: Transcription): void {
    this.editingId.set(t.id);
    this.editTitle = t.title;
    this.editText = t.text;
  }

  saveEdit(t: Transcription): void {
    this.api.update(t.id, { title: this.editTitle, text: this.editText }).subscribe({
      next: () => { this.editingId.set(null); this.flash('Updated'); this.load(); },
      error: () => this.flash('Update failed'),
    });
  }

  remove(t: Transcription): void {
    if (!confirm(`Delete "${t.title}"?`)) return;
    this.api.remove(t.id).subscribe({
      next: () => { this.flash('Deleted'); if (this.items().length === 1 && this.page() > 1) this.page.update((p) => p - 1); this.load(); },
      error: () => this.flash('Delete failed'),
    });
  }

  copy(text: string): void {
    navigator.clipboard?.writeText(text);
    this.flash('Copied to clipboard');
  }

  private flash(msg: string): void {
    this.message.set(msg);
    setTimeout(() => this.message() === msg && this.message.set(''), 2500);
  }
}
