import { Component } from '@angular/core';
import { ApiService } from '../../api/api.service';
import { UrlClass } from '../../shared/models/url.model';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent {

  usuariosBD: any[] = [];


  constructor(private backend: ApiService) {
  }

  ngOnInit() {
    let info = {
      action: 'get',
      bd: 'administracion',
      table: 'user',
      opts: {}
    }

    this.backend.post(info, UrlClass.URLNuevo).subscribe((response: any) => {
      this.usuariosBD = response['result'];
      //console.log(this.usuariosBD[1]);
      //console.log(this.usuariosBD[1].no_nomina);

    });

  }
}
