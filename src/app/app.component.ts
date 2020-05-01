import { Component } from '@angular/core';
import { AuthService } from './services/auth.service';

// import {environment} from './../environments/environment';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  constructor(private auth: AuthService) {
    console.log('mensaje: ', environment.mensaje);
  }
}
