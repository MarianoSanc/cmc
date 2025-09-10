import { Component, EventEmitter, Output, Input, OnInit } from '@angular/core';
import { IDropdownSettings } from 'ng-multiselect-dropdown';
import { NgMultiSelectDropDownModule } from 'ng-multiselect-dropdown';
import Swal from 'sweetalert2';
import { ApiService } from '../../api/api.service';
import { Router } from '@angular/router';
import { UrlClass } from '../../shared/models/url.model';

import {
  FormBuilder,
  FormGroup,
  FormArray,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { create } from 'node:domain';

@Component({
  selector: 'app-new-calibration',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, NgMultiSelectDropDownModule],
  templateUrl: './new-calibration.component.html',
  styleUrl: './new-calibration.component.css',
})
export class NewCalibrationComponent implements OnInit {
  @Input() equipos: any[] = [];
  @Input() pts: any[] = [];
  @Input() ids: any[] = [];
  @Input() dcVoltageValues: {
    nvl: number;
    value: string;
    ratio_calibration?: number;
    porcentaje_ratio?: number;
    ratio?: number;
    ganancia?: number;
  }[] = [];

  @Output() close = new EventEmitter<void>();

  calibrationForm!: FormGroup;
  submitInProgress = false;

  cmc: any[] = []; // Array para almacenar los resultados de la búsqueda

  dropdowncmc: IDropdownSettings = {
    idField: 'name',
    textField: 'name',
    allowSearchFilter: true,
    searchPlaceholderText: 'Buscar',
    maxHeight: 200,
    enableCheckAll: false,
    singleSelection: true,
    noDataAvailablePlaceholderText: 'Patron no Disponible',
    noFilteredDataAvailablePlaceholderText: 'No Existe el Patron',
  };

  patron: any[] = [];

  isTesting: boolean = false; // Definir el entorno de pruebas
  database: string = this.isTesting ? 'prueba' : 'calibraciones';

  constructor(
    private fb: FormBuilder,
    private backend: ApiService,
    private router: Router
  ) {}

  ngOnInit() {
    // Obtén el id del usuario (ajusta según tu estructura, aquí se toma el primero)
    const idUsuario = this.ids && this.ids.length > 0 ? this.ids[0].id_crm : '';

    this.calibrationForm = this.fb.group({
      equipo: [[], Validators.required],
      pt: ['', Validators.required],
      fecha: ['', Validators.required],
      id_usuario: [idUsuario],
      valores: this.fb.array([]),
    });
  }

  // Agrega este método para limpiar el formato
  formatStdCondition(val: string): string {
    // Ejemplo: "+10.0 kV" => "10", "-100.0 kV" => "-100"
    const match = val.match(/^([+-]?)(\d+)(?:\.\d+)?\s*kV$/i);
    if (match) {
      const sign = match[1];
      const num = match[2];
      return sign + num;
    }
    // Si no hace match, regresa el valor original sin espacios ni 'kV'
    return val.replace('kV', '').replace(/\s+/g, '');
  }

  get valores(): FormArray {
    return this.calibrationForm.get('valores') as FormArray;
  }

  // Llama este método cuando cambie patron o pt en el formulario
  cargarNiveles() {
    const equipo = this.calibrationForm.get('equipo')?.value;
    const pt = this.calibrationForm.get('pt')?.value;

    // Si equipo es array, toma el primero
    const patron =
      Array.isArray(equipo) && equipo.length > 0
        ? equipo[0].name || equipo[0]
        : equipo?.name || equipo;
    if (!patron || !pt) return;

    const levels = {
      action: 'get',
      bd: this.database,
      table: 'cmc_levels',
      opts: {
        where: {
          deleted: 0,
          patron: patron,
          pt: pt,
        },
      },
    };

    this.backend.post(levels, UrlClass.URLNuevo).subscribe((response: any) => {
      const niveles = response['result'] || [];

      // Actualiza dcVoltageValues con los datos completos
      this.dcVoltageValues = niveles.map((item: any) => {
        const nvl = Number(item.nvl);
        const sign = nvl >= 0 ? '+' : '';
        return {
          nvl,
          value: `${sign}${nvl.toFixed(1)} kV`,
          ratio_calibration: item.ratio_calibration,
          ganancia: item.ganancia,
          porcentaje_ratio: item.porcentaje_ratio,
          ratio: item.ratio,
        };
      });

      // Actualiza el FormArray 'valores' con los nuevos niveles y datos extra
      const valoresArray = this.fb.array(
        this.dcVoltageValues.map((item) =>
          this.fb.group({
            std_condition: [this.formatStdCondition(item.value)],
            error: [''],
            cu: [''],
            ratio_calibration: [item.ratio_calibration ?? ''],
            ganancia: [item.ganancia ?? ''],
            porcentaje_ratio: [item.porcentaje_ratio ?? ''],
            ratio: [item.ratio ?? ''],
          })
        )
      );
      this.calibrationForm.setControl('valores', valoresArray);
      console.log('dcVoltageValues:', this.dcVoltageValues);
    });

    console.log('equipo:', equipo);

    console.log('patron:', this.patron);
    console.log('valores:', this.calibrationForm.get('valores')?.value);

    // Actualiza patron con el equipo seleccionado (para usar patron.length en el HTML)
    if (Array.isArray(equipo) && equipo.length > 0 && equipo[0].name) {
      this.patron = equipo[0].name.split('+');
    } else if (equipo && equipo.name) {
      this.patron = equipo.name.split('+');
    } else {
      this.patron = [];
    }
  }

  submit() {
    if (!this.calibrationForm.valid || this.submitInProgress) return;

    this.submitInProgress = true;
    const form = this.calibrationForm.value;

    // Filtrar solo los valores válidos
    const valoresValidos = form.valores.filter(
      (v: any) =>
        (v.error !== null && v.error !== undefined && v.error !== '') ||
        (v.cu !== null && v.cu !== undefined && v.cu !== '')
    );

    if (valoresValidos.length === 0) {
      this.submitInProgress = false;
      Swal.fire({
        icon: 'warning',
        title: 'Sin datos válidos',
        text: 'No se encontraron datos válidos para registrar.',
      });
      return;
    }

    // Construir arrays para el registro
    const pt = valoresValidos.map(() => form.pt);
    const idequipment = valoresValidos.map(() => form.equipo[0].name);
    const date = valoresValidos.map(() => form.fecha);
    const std_condition = valoresValidos.map((v: any) => v.std_condition);
    const std_dif = valoresValidos.map((v: any) => {
      if (v.ratio_calibration != null && v.ratio_calibration !== '') {
        return `${v.ratio_calibration}-${v.porcentaje_ratio}`;
      } else if (v.ganancia != null && v.ganancia !== '') {
        return `${v.ganancia}-${v.ratio}`;
      } else {
        return '';
      }
    });
    console.log('std_dif:', std_dif);
    const error = valoresValidos.map((v: any) => v.error);
    const cu = valoresValidos.map((v: any) => v.cu);
    const created_by = valoresValidos.map(() => form.id_usuario);
    const created_at = valoresValidos.map(() => new Date().toISOString());

    console.log('Valores válidos:', valoresValidos);

    // Si equipo es array, toma el primero para la consulta
    const equipoConsulta =
      Array.isArray(form.equipo) && form.equipo.length > 0
        ? form.equipo[0]
        : form.equipo;

    const search = {
      bd: this.database,
      action: 'get',
      table: 'cmc_uncertaintycomponents',
      opts: {
        where: { id_equipment: equipoConsulta.name, pt: form.pt, deleted: 0 },
      },
    };

    const continuarRegistro = () => {
      // Preparar atributos base
      let attributes: any = {
        pt,
        id_equipment: idequipment,
        std_condition,
        date,
        error,
        calibrationUncertainty: cu,
        created_by,
        created_at,
      };

      // Solo agregar std_dif si patron.length == 3
      if (this.patron.length === 3) {
        attributes.std_dif = std_dif;
      }

      const register = {
        bd: this.database,
        action: 'createSeveral',
        table: 'cmc_register',
        opts: {
          attributes: attributes,
        },
      };

      console.log('Registro a enviar:', register);

      this.backend.post(register, UrlClass.URLNuevo).subscribe(
        (response: any) => {
          this.submitInProgress = false;
          if (response.result) {
            Swal.fire({
              position: 'top-end',
              icon: 'success',
              title: 'Se registró correctamente',
              showConfirmButton: false,
              timer: 3000,
            });
            window.location.reload();
          } else {
            Swal.fire({
              icon: 'error',
              title: 'Oops...',
              text: 'No se realizó el registro',
            });
          }
        },
        (error) => {
          this.submitInProgress = false;
          Swal.fire({
            icon: 'error',
            title: 'Error en la conexión',
            text: 'Intenta de nuevo más tarde.',
          });
        }
      );
    };

    this.backend.post(search, UrlClass.URLNuevo).subscribe(
      (res: any) => {
        const existe = res?.result?.length > 0;

        if (!existe) {
          const insertUC = {
            bd: this.database,
            action: 'create',
            table: 'cmc_uncertaintycomponents',
            opts: {
              attributes: {
                pt: form.pt,
                id_equipment: equipoConsulta.name,
              },
            },
          };

          this.backend.post(insertUC, UrlClass.URLNuevo).subscribe(
            () => continuarRegistro(),
            (error) => {
              this.submitInProgress = false;
              Swal.fire({
                icon: 'error',
                title: 'Error al registrar en cmc_uncertaintycomponents',
                text: 'Intenta de nuevo más tarde.',
              });
            }
          );
        } else {
          continuarRegistro();
        }
      },
      (error) => {
        this.submitInProgress = false;
        Swal.fire({
          icon: 'error',
          title: 'Error al consultar la base de datos',
          text: 'No se pudo verificar si el componente existe.',
        });
      }
    );
  }
}
