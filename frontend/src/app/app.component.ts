import { Component } from '@angular/core';
import { Router, RouterOutlet, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { filter } from 'rxjs/operators';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule, RouterOutlet, RouterLink, RouterLinkActive,
    MatToolbarModule, MatSidenavModule, MatListModule,
    MatIconModule, MatButtonModule
  ],
  template: `
    @if (isLoginPage) {
      <router-outlet />
    } @else {
      <mat-toolbar color="primary" class="toolbar">
        <button mat-icon-button (click)="sidenav.toggle()">
          <mat-icon>menu</mat-icon>
        </button>
        <span>Inventory Manager</span>
        <span class="spacer"></span>
        <button mat-icon-button (click)="logout()" title="Sign out">
          <mat-icon>logout</mat-icon>
        </button>
      </mat-toolbar>

      <mat-sidenav-container class="sidenav-container">
        <mat-sidenav #sidenav mode="side" opened class="sidenav">
          <mat-nav-list>
            <a mat-list-item routerLink="/dashboard" routerLinkActive="active-link">
              <mat-icon matListItemIcon>dashboard</mat-icon>
              <span matListItemTitle>Dashboard</span>
            </a>
            <a mat-list-item routerLink="/products" routerLinkActive="active-link">
              <mat-icon matListItemIcon>inventory_2</mat-icon>
              <span matListItemTitle>Products</span>
            </a>
            <a mat-list-item routerLink="/admins" routerLinkActive="active-link">
              <mat-icon matListItemIcon>manage_accounts</mat-icon>
              <span matListItemTitle>Admins</span>
            </a>
          </mat-nav-list>
        </mat-sidenav>

        <mat-sidenav-content class="main-content">
          <router-outlet />
        </mat-sidenav-content>
      </mat-sidenav-container>
    }
  `,
  styles: [`
    .toolbar { position: fixed; top: 0; z-index: 100; }
    .sidenav-container { height: 100vh; margin-top: 64px; }
    .sidenav { width: 220px; padding-top: 8px; }
    .main-content { padding: 24px; background: #f5f5f5; min-height: calc(100vh - 64px); }
    .active-link { background: rgba(63, 81, 181, 0.1); color: #3f51b5; }
    .active-link mat-icon { color: #3f51b5; }
    .spacer { flex: 1; }
  `]
})
export class AppComponent {
  isLoginPage = false;

  constructor(private auth: AuthService, private router: Router) {
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd)
    ).subscribe(e => {
      this.isLoginPage = e.urlAfterRedirects === '/login';
    });
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
