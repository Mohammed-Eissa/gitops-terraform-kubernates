import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialogModule, MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatCardModule } from '@angular/material/card';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AdminService, Admin } from '../../services/admin.service';

// ── Add Admin Dialog ──────────────────────────────────────────────────────────

@Component({
  selector: 'app-add-admin-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatDialogModule],
  template: `
    <h2 mat-dialog-title>Add Admin</h2>
    <mat-dialog-content>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Username</mat-label>
        <input matInput [(ngModel)]="username" name="username" required minlength="3" />
      </mat-form-field>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Password</mat-label>
        <input matInput type="password" [(ngModel)]="password" name="password" required minlength="4" />
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-raised-button color="primary"
              [disabled]="!username || username.length < 3 || !password || password.length < 4"
              (click)="confirm()">Add</button>
    </mat-dialog-actions>
    <style>.full-width { width: 100%; display: block; margin-top: 8px; }</style>
  `
})
export class AddAdminDialogComponent {
  username = '';
  password = '';

  constructor(private ref: MatDialogRef<AddAdminDialogComponent>) {}

  confirm(): void {
    this.ref.close({ username: this.username, password: this.password });
  }
}

// ── Change Password Dialog ────────────────────────────────────────────────────

@Component({
  selector: 'app-change-password-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatDialogModule],
  template: `
    <h2 mat-dialog-title>Change Password — {{ data.username }}</h2>
    <mat-dialog-content>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>New Password</mat-label>
        <input matInput type="password" [(ngModel)]="newPassword" name="newPassword" required minlength="4" />
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-raised-button color="primary"
              [disabled]="!newPassword || newPassword.length < 4"
              (click)="confirm()">Save</button>
    </mat-dialog-actions>
    <style>.full-width { width: 100%; display: block; margin-top: 8px; }</style>
  `
})
export class ChangePasswordDialogComponent {
  newPassword = '';

  constructor(
    private ref: MatDialogRef<ChangePasswordDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { username: string }
  ) {}

  confirm(): void {
    this.ref.close(this.newPassword);
  }
}

// ── Admin List Component ──────────────────────────────────────────────────────

@Component({
  selector: 'app-admin-list',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatTableModule, MatButtonModule, MatIconModule,
    MatInputModule, MatFormFieldModule,
    MatProgressSpinnerModule, MatSnackBarModule, MatDialogModule,
    MatCardModule, MatTooltipModule
  ],
  template: `
    <mat-card>
      <mat-card-header>
        <mat-card-title>Admin Accounts</mat-card-title>
        <mat-card-subtitle>Manage who can log in to the Inventory Manager</mat-card-subtitle>
      </mat-card-header>

      <mat-card-content>
        @if (loading) {
          <div class="spinner-wrap"><mat-spinner diameter="40" /></div>
        } @else {
          <table mat-table [dataSource]="admins" class="full-width">

            <ng-container matColumnDef="username">
              <th mat-header-cell *matHeaderCellDef>Username</th>
              <td mat-cell *matCellDef="let a">{{ a.username }}</td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef class="actions-col">Actions</th>
              <td mat-cell *matCellDef="let a" class="actions-col">
                <button mat-icon-button color="primary"
                        matTooltip="Change password"
                        (click)="openChangePassword(a)">
                  <mat-icon>lock_reset</mat-icon>
                </button>
                <button mat-icon-button color="warn"
                        matTooltip="Delete"
                        [disabled]="admins.length === 1"
                        (click)="deleteAdmin(a)">
                  <mat-icon>delete</mat-icon>
                </button>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
          </table>
        }
      </mat-card-content>

      <mat-card-actions>
        <button mat-raised-button color="primary" (click)="openAddAdmin()">
          <mat-icon>person_add</mat-icon> Add Admin
        </button>
      </mat-card-actions>
    </mat-card>
  `,
  styles: [`
    mat-card { margin: 0 auto; max-width: 600px; }
    mat-card-header { margin-bottom: 16px; }
    .full-width { width: 100%; }
    .spinner-wrap { display: flex; justify-content: center; padding: 40px; }
    .actions-col { text-align: right; width: 120px; }
    mat-card-actions { padding: 8px 16px 16px; }
  `]
})
export class AdminListComponent implements OnInit {
  admins: Admin[] = [];
  loading = true;
  displayedColumns = ['username', 'actions'];

  constructor(
    private adminService: AdminService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.adminService.getAll().subscribe({
      next: admins => { this.admins = admins; this.loading = false; },
      error: () => {
        this.snackBar.open('Failed to load admins', 'Close', { duration: 3000 });
        this.loading = false;
      }
    });
  }

  openAddAdmin(): void {
    this.dialog.open(AddAdminDialogComponent, { width: '360px' })
      .afterClosed().subscribe(result => {
        if (!result) return;
        this.adminService.create(result.username, result.password).subscribe({
          next: () => {
            this.snackBar.open(`Admin "${result.username}" created`, 'Close', { duration: 3000 });
            this.load();
          },
          error: (err) => {
            const msg = err.status === 409 ? 'Username already exists' : 'Failed to create admin';
            this.snackBar.open(msg, 'Close', { duration: 4000 });
          }
        });
      });
  }

  openChangePassword(admin: Admin): void {
    this.dialog.open(ChangePasswordDialogComponent, {
      width: '360px',
      data: { username: admin.username }
    }).afterClosed().subscribe(newPassword => {
      if (!newPassword) return;
      this.adminService.changePassword(admin.id, newPassword).subscribe({
        next: () => this.snackBar.open(`Password updated for "${admin.username}"`, 'Close', { duration: 3000 }),
        error: () => this.snackBar.open('Failed to update password', 'Close', { duration: 3000 })
      });
    });
  }

  deleteAdmin(admin: Admin): void {
    if (!confirm(`Delete admin "${admin.username}"? This cannot be undone.`)) return;
    this.adminService.delete(admin.id).subscribe({
      next: () => {
        this.snackBar.open(`Admin "${admin.username}" deleted`, 'Close', { duration: 3000 });
        this.load();
      },
      error: (err) => {
        const msg = err.status === 409 ? 'Cannot delete the last admin account' : 'Failed to delete admin';
        this.snackBar.open(msg, 'Close', { duration: 4000 });
      }
    });
  }
}
