import { Component, OnInit, HostListener } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { UrlClass } from '../../shared/models/url.model';
import { ApiService } from '../../api/api.service';


@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent implements OnInit {

  tareas: Tarea[] = []; // Todas las tareas
  alertas: Alerta[] = []; // Tareas que están por vencer en 3 días
  porVencer: number = 0; // Número de tareas por vencer
  mostrarNotificaciones: boolean = false; // Estado de visibilidad del dropdown
  usuario_creador: string = '';


  constructor(private backend: ApiService, private http: HttpClient, private router: Router, private route: ActivatedRoute) { }

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.usuario_creador = params['id'];
      if (this.usuario_creador) {
        this.revisarTareasvencidas();
      }
    });
  }


  filtrarTareasPorVencer(): void {
    const hoy = new Date();
    const tresDiasDeVencer = 3;

    // Convertir la fecha de hoy a las 00:00 horas para evitar problemas de horas
    hoy.setHours(0, 0, 0, 0);

    // Filtrar las tareas que están vencidas o vencen en los próximos 3 días
    this.alertas = this.tareas
      .map(tarea => {
        const fechaVencimiento = new Date(tarea.fechaVencimiento);
        fechaVencimiento.setHours(0, 0, 0, 0); // Igualamos la hora a medianoche para comparar solo las fechas

        const diferenciaDias = this.diasDeDiferencia(hoy, fechaVencimiento);
        let mensajeDiasRestantes = '';
        let colorFondo = '';

        // Verificamos si la tarea está vencida o va a vencer en los próximos 3 días
        if (diferenciaDias < 0) {
          // Si la tarea ya venció, mostramos cuántos días hace que venció
          mensajeDiasRestantes = `Vencido hace ${Math.abs(diferenciaDias)} día(s)`;
          colorFondo = 'rgba(255, 0, 0, 0.2)';
          return { ...tarea, diasRestantes: diferenciaDias, mensajeDiasRestantes, colorFondo };
        } else if (diferenciaDias <= tresDiasDeVencer) {
          // Si la tarea vence en los próximos 3 días
          mensajeDiasRestantes = `Vence en ${diferenciaDias} día(s)`;
          colorFondo = 'rgba(255, 255, 0, 0.3)';
          return { ...tarea, diasRestantes: diferenciaDias, mensajeDiasRestantes, colorFondo };
        }

        // Si la tarea no está vencida ni va a vencer en los próximos 3 días, devolvemos un objeto vacío
        return null;
      })
      .filter(tarea => tarea !== null) as Alerta[]; // Filtramos las tareas que no sean relevantes (null)

    // Ordenamos las tareas por diasRestantes (de menor a mayor)
    this.alertas.sort((a, b) => a.diasRestantes - b.diasRestantes);

    // Contamos las tareas que están por vencer (o ya vencidas)
    this.porVencer = this.alertas.length;
  }



  // Función para calcular la diferencia en días entre dos fechas
  diasDeDiferencia(fechaInicio: Date, fechaFin: Date): number {
    const diferencia = fechaFin.getTime() - fechaInicio.getTime();
    return Math.floor(diferencia / (1000 * 3600 * 24)); // Convertir la diferencia de tiempo a días
  }

  // Función que alterna la visibilidad de las notificaciones
  toggleNotificaciones(): void {
    this.mostrarNotificaciones = !this.mostrarNotificaciones;
  }

  // Listener para cerrar las notificaciones si se hace clic fuera de ellas
  @HostListener('document:click', ['$event'])
  onClickOutside(event: MouseEvent): void {
    const clickDentroDeNotificaciones = (event.target as Element).closest('.notification-icon-container') ||
      (event.target as Element).closest('.notification-dropdown');
    if (!clickDentroDeNotificaciones) {
      this.mostrarNotificaciones = false;
    }
  }

  // Función para llenar los datos de los pendientes
  revisarTareasvencidas(): void {

    const info_pendientes = {
      action: 'get',
      bd: 'hvtest2',
      table: 'pending_tasks',
      opts: {
        customSelect: ' id, CONCAT("Pendiente: ", id) AS nombre, DATEDIFF(due_date,CURDATE()) AS fechaVencimiento, due_date',
        where: {
          assigned_to: this.usuario_creador,
          deleted: 0,
          lesser: { "DATEDIFF(due_date,CURDATE())": 3 },
          notequal: { status: "Finalizado" }
        },
      }
    };

    this.backend.post(info_pendientes, UrlClass.URLNuevo).subscribe((response: any) => {
      const tareas: Tarea[] = response.result.map((pendiente: any) => {
        // Convertir due_date (en UTC) a objeto Date
        const fechaVencimientoUTC = new Date(pendiente.due_date);

        const fechaVencimiento = new Date(fechaVencimientoUTC.getFullYear(), fechaVencimientoUTC.getMonth(), fechaVencimientoUTC.getDate());

        return {
          id: pendiente.id,
          nombre: pendiente.nombre.replace('Pendiente: ', ''),  // Extraer el número si es necesario
          fechaVencimiento: fechaVencimiento,  // Usar la fecha sin hora
        };
      });

      this.tareas = tareas;
      this.filtrarTareasPorVencer();
    });

  }


}

// Estructura de tarea
interface Tarea {
  id: number;
  nombre: string;
  fechaVencimiento: Date;
}

interface Alerta {
  id: number;
  nombre: string;
  fechaVencimiento: Date;
  diasRestantes: number;
  colorFondo?: string;
  mensajeDiasRestantes?: string;
}
