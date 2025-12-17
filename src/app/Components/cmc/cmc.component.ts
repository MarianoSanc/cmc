import { Component } from '@angular/core';
import { ApiService } from '../../api/api.service';
import { Router } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { UrlClass } from '../../shared/models/url.model';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { IDropdownSettings } from 'ng-multiselect-dropdown';
import { NgMultiSelectDropDownModule } from 'ng-multiselect-dropdown';
import Swal from 'sweetalert2';
import { NewCalibrationComponent } from '../new-calibration/new-calibration.component';
import { create } from 'node:domain';

@Component({
  selector: 'app-cmc',
  standalone: true,
  imports: [
    FormsModule,
    CommonModule,
    NgMultiSelectDropDownModule,
    NewCalibrationComponent,
  ],
  templateUrl: './cmc.component.html',
  styleUrl: './cmc.component.css',
})
export class CmcComponent {
  constructor(
    private backend: ApiService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  isTesting: boolean = false; // Definir el entorno de pruebas
  database: string = this.isTesting ? 'prueba' : 'calibraciones';

  filtercmc: string = '';
  listacmc: any[] = [];
  listapt: any[] = [];
  selectedCmc: any[] = [];
  selectedPT: any[] = [];
  user: any[] = [];
  usuario_creador: string = '';
  searchTerm: string = '';
  cmc: any[] = [];
  cmcByDate: { [date: string]: any[] } = {};
  patron: any[] = [];
  components: any[] = [];
  editingItem: any = null;
  editingMatch: any = null;
  editingCi: string | null = null;
  isAuthorized: boolean = false;

  dcVoltageValues: {
    nvl: number;
    value: string;
    ratio_calibration?: number;
    porcentaje_ratio?: number;
    ratio?: number;
    ganancia?: number;
  }[] = [];

  dropdowncmc: IDropdownSettings = {
    idField: 'name',
    textField: 'name',
    allowSearchFilter: true,
    searchPlaceholderText: 'Buscar',
    enableCheckAll: false,
    singleSelection: true,
    noDataAvailablePlaceholderText: 'Patron no Disponible',
    noFilteredDataAvailablePlaceholderText: 'No Existe el Patron',
  };
  dropdownpt: IDropdownSettings = {
    idField: 'pt',
    textField: 'pt',
    allowSearchFilter: true,
    searchPlaceholderText: 'Buscar',
    enableCheckAll: false,
    singleSelection: true,
    noDataAvailablePlaceholderText: 'PT no Disponible',
    noFilteredDataAvailablePlaceholderText: 'No Existe el PT',
  };

  // cmc_uncertaintycomponents
  stabilityByValue: { [key: string]: number | null } = {};
  biasByValue: { [key: string]: number | null } = {};
  referenceUncertaintyByValue: { [key: string]: number | null } = {};
  referenceStabilityByValue: { [key: string]: number | null } = {};
  driftByValue: { [key: string]: number | null } = {};
  repeatabilityByValue: { [key: string]: number } = {};
  reproducibilityByValue: { [key: string]: number } = {};

  stdstabilityByValue: { [key: string]: number | null } = {};
  stdbiasByValue: { [key: string]: number | null } = {};
  stdreferenceUncertaintyByValue: { [key: string]: number | null } = {};
  stdreferenceStabilityByValue: { [key: string]: number | null } = {};
  stddriftByValue: { [key: string]: number | null } = {};
  stdrepeatabilityByValue: { [key: string]: number | null } = {};
  stdreproducibilityByValue: { [key: string]: number | null } = {};
  combined: { [key: string]: number | null } = {};

  // --- U comb edición y eliminación con confirmación ---
  editingUComb: { [id: string]: { [field: string]: boolean } } = {};
  editingUCombBackup: { [id: string]: { [field: string]: any } } = {};

  showNewCalibrationModal = false;

  modalData = {
    dcVoltageValues: [] as {
      nvl: number;
      value: string;
      ratio_calibration?: number;
      porcentaje_ratio?: number;
      ratio?: number;
      ganancia?: number;
    }[],
    equipos: [] as any[],
    pts: [] as any[],
    ids: [] as any[],
  };

  newMatchEditing: { [key: string]: { [std: string]: boolean } } = {};
  newMatchValue: {
    [key: string]: { [std: string]: { error: string; cu: string } };
  } = {};

  editingDate: { [date: string]: boolean } = {};

  ngOnInit() {
    // Escuchar los parámetros de la URL
    this.route.queryParams.subscribe((params) => {
      this.usuario_creador = params['id'];
      //console.log('Usuario creador:', this.usuario_creador);

      const departamentosAutorizados = [1, 3, 7, 8];

      const info_usuarios = {
        action: 'get',
        bd: 'administracion',
        table: 'user',
        opts: {
          customSelect:
            ' user.id_crm,user.first_name,user.last_name,user.alias, deparments_table.id_department ',
          customRelationship:
            'left join user_pdp user_pdp_table on user_pdp_table.no_nomina = user.no_nomina ' +
            'left join hvtest2.user_deparments deparments_table on deparments_table.id_user = user.id_crm ' +
            'left join hvtest2.pending_departments deparments_info_table on deparments_info_table.id = deparments_table.id_department ',
          group_by: 'user.no_nomina',
          where: {
            deleted: 0,
            organizacion: 0,
            notequal: { id_crm: '' },
            id_crm: this.usuario_creador,
          },
        },
      };

      this.backend
        .post(info_usuarios, UrlClass.URLNuevo)
        .subscribe((response: any) => {
          this.user = [...this.user, ...response['result']];
          //console.log(this.user);

          if (
            this.user.length > 0 &&
            departamentosAutorizados.includes(this.user[0].id_department)
          ) {
            this.isAuthorized = true;
          }

          this.checkAccess();
        });

      const calibraciones = {
        action: 'get',
        bd: 'calibraciones',
        table: 'patron',
        opts: {
          customSelect: 'DISTINCT patron.name',
          order_by: ['patron.name', 'ASC'],
        },
      };

      this.backend
        .post(calibraciones, UrlClass.URLNuevo)
        .subscribe((response: any) => {
          this.listacmc = [...this.listacmc, ...response['result']];
          //console.log('Lista de CMC cargada:', this.listacmc);
        });
    });
  }

  checkAccess(): void {
    if (!this.isAuthorized) {
      alert('Acceso Denegado: No tienes permiso para acceder a esta página.');

      window.location.href = URL + 'CRM/#';

      return;
    } else {
      alert(
        'Acceso correcto. Bienvenid@ ' +
          this.user[0].first_name +
          ' ' +
          this.user[0].last_name
      );
    }
  }

  agregarCmc() {
    // Prepara los datos para el modal
    this.modalData = {
      dcVoltageValues: this.dcVoltageValues,
      equipos: this.listacmc,
      pts: this.listapt,
      ids: this.user,
    };
    this.showNewCalibrationModal = true;
  }

  selectequipment(equipment: any) {
    this.selectedPT = [];
    this.listapt = [];
    this.cmc = [];
    this.patron = [];

    const idC = equipment.name;

    const ids = idC.includes('+') ? idC.split('+') : [idC];

    //console.log('Equipos seleccionados:', ids);

    // 1. Cargar registros del equipo (cmc_register) con el idC completo
    const calibracion = {
      action: 'get',
      bd: this.database,
      table: 'cmc_register',
      opts: { where: { id_equipment: idC, deleted: 0 } },
    };
    this.backend
      .post(calibracion, UrlClass.URLNuevo)
      .subscribe((response: any) => {
        this.cmc = [...response['result']];
        console.log(`cmc para ${idC}`, response['result']);
      });

    // 2. Cargar lista de PTs (patron) también con idC completo
    const pts = {
      action: 'get',
      bd: 'calibraciones',
      table: 'patron',
      opts: {
        customSelect: 'DISTINCT patron.pt',
        order_by: ['patron.pt', 'ASC'],
        where: { name: idC, deleted: 0 },
      },
    };
    this.backend.post(pts, UrlClass.URLNuevo).subscribe((response: any) => {
      this.listapt = [...response['result']];
      //console.log(`PTs pedara ${idC}`, response['result']);
    });

    // 3. Cargar info general de cada equipo manteniendo el orden original
    this.patron = []; // Inicializar como array vacío
    const patronPromises = ids.map((id: string, index: number) => {
      return new Promise<void>((resolve) => {
        const patron = {
          action: 'get',
          bd: 'hvtest2',
          table: 'equipment_catalog',
          opts: { where: { idequipment: id } },
        };
        this.backend
          .post(patron, UrlClass.URLNuevo)
          .subscribe((response: any) => {
            // Asignar en el índice correcto para mantener el orden
            if (response['result'] && response['result'].length > 0) {
              this.patron[index] = response['result'][0];
            }
            console.log(
              `Patron para ${id} en índice ${index}`,
              response['result']
            );
            resolve();
          });
      });
    });

    // Esperar a que todas las consultas terminen
    Promise.all(patronPromises).then(() => {
      // Filtrar elementos undefined y mantener el orden
      this.patron = this.patron.filter((item) => item !== undefined);
      console.log('Patron final ordenado:', this.patron);
    });

    // Limpia componentes hasta que se seleccione PT
    this.components = [];
  }

  // Cuando cambie el PT seleccionado, filtra y calcula todo lo demás
  async onPTSelect() {
    // Primero carga niveles y espera a que termine
    await this.levelsCmc();
    // Luego agrupa y calcula
    await this.groupCmcByDate();

    // Cargar U comb para el patrón y PT seleccionados
    this.loadUCombList();

    // Carga los componentes del PT seleccionado (si es single select, usa selectedPT[0])
    let ptValue = '';
    if (this.selectedPT && this.selectedPT.length > 0) {
      ptValue = this.selectedPT[0].pt;
    }
    const id =
      this.selectedCmc && this.selectedCmc.length > 0
        ? this.selectedCmc[0].name
        : null;
    if (!id || !ptValue) {
      this.components = [];
      return;
    }
    const components = {
      action: 'get',
      bd: this.database,
      table: 'cmc_uncertaintycomponents',
      opts: { where: { id_equipment: id, pt: ptValue } },
    };
    this.backend
      .post(components, UrlClass.URLNuevo)
      .subscribe((response: any) => {
        this.components = response['result'];
        console.log('Componentes cargados:', this.components);
        this.calculateUncertainty();
      });
  }

  async levelsCmc() {
    // Carga los niveles de CMC y espera a que termine antes de continuar
    return new Promise<void>((resolve) => {
      const levels = {
        action: 'get',
        bd: this.database,
        table: 'cmc_levels',
        opts: {
          where: {
            deleted: 0,
            patron: this.selectedCmc[0].name,
            pt: this.selectedPT[0].pt,
          },
        },
      };

      this.backend
        .post(levels, UrlClass.URLNuevo)
        .subscribe((response: any) => {
          const dcVoltageValues2 = response['result'];
          // Asegúrate de convertir a número y no dejar undefined/null
          this.dcVoltageValues = dcVoltageValues2.map((item: any) => {
            const nvl = Number(item.nvl);
            const sign = nvl >= 0 ? '+' : '';
            return {
              nvl,
              value: `${sign}${nvl.toFixed(1)} kV`,
              ratio_calibration: item.ratio_calibration,

              ratio:
                item.ratio !== undefined && item.ratio !== null
                  ? Number(item.ratio)
                  : null,

              ganancia:
                item.ganancia !== undefined && item.ganancia !== null
                  ? Number(item.ganancia)
                  : null,

              porcentaje_ratio:
                item.porcentaje_ratio !== undefined &&
                item.porcentaje_ratio !== null
                  ? Number(item.porcentaje_ratio)
                  : null,
            };
          });
          console.log('Niveles de CMC cargados:', this.dcVoltageValues);
          resolve();
        });
    });
  }

  async groupCmcByDate() {
    // Agrupa por fecha (YYYY-MM-DD)
    const grouped: { [date: string]: any[] } = {};
    for (const item of this.cmc) {
      // Si hay PTs seleccionados, solo incluye los que coincidan
      if (this.selectedPT && this.selectedPT.length > 0) {
        const selectedPtValues = this.selectedPT.map((ptObj: any) => ptObj.pt);
        if (!selectedPtValues.includes(item.pt)) continue;
      }
      const dateKey = item.date ? item.date.split('T')[0] : 'Sin fecha';
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(item);
    }
    // Ordena las fechas descendente y toma solo las últimas 3
    const sortedDates = Object.keys(grouped)
      .filter((date) => date !== 'Sin fecha')
      .sort((a, b) => b.localeCompare(a))
      .slice(0, 3);

    // Si existe 'Sin fecha', agrégala al final
    if (grouped['Sin fecha']) {
      sortedDates.push('Sin fecha');
    }

    // Construye el nuevo objeto cmcByDate solo con las últimas 3 fechas (y 'Sin fecha' si existe)
    this.cmcByDate = {};
    for (const date of sortedDates) {
      this.cmcByDate[date] = grouped[date];
    }
    console.log('CMC agrupado por fecha:', this.cmcByDate);
    // Espera a que Angular actualice el DOM antes de calcular incertidumbre
    await new Promise((resolve) => setTimeout(resolve, 0));
    this.calculateUncertainty();
  }

  getCmcMatchByValue(group: any, value: any): any {
    // Busca un registro en el grupo que coincida con el valor formateado de std_condition
    const baseMatch = group.value.filter((item: any) => {
      if (item.std_condition === undefined || item.std_condition === null)
        return false;
      const prefix = item.std_condition.toString().startsWith('-') ? '-' : '+';
      const absValue = Math.abs(Number(item.std_condition)).toFixed(1);
      const formatted = `${prefix}${absValue} kV`;
      return formatted === value.value;
    });

    // Si solo hay un match, lo retorna
    if (baseMatch.length <= 1) {
      return baseMatch[0] || null;
    }

    // Si hay múltiples matches y patron.length == 3, usa std_dif para diferenciar
    if (this.patron.length === 3) {
      let expectedStdDif = '';
      if (value.ratio_calibration != null) {
        expectedStdDif = `${value.ratio_calibration}-${value.porcentaje_ratio}`;
      } else if (value.ganancia != null) {
        expectedStdDif = `${value.ganancia}-${value.ratio}`;
      }

      // Busca el match que tenga el std_dif correcto
      const exactMatch = baseMatch.find(
        (item: any) => item.std_dif === expectedStdDif
      );
      return exactMatch || baseMatch[0];
    }

    return baseMatch[0];
  }

  getMatchKey(value: any): string {
    if (this.patron.length === 3) {
      let stdDif = '';
      if (value.ratio_calibration != null) {
        stdDif = `${value.ratio_calibration}-${value.porcentaje_ratio}`;
      } else if (value.ganancia != null) {
        stdDif = `${value.ganancia}-${value.ratio}`;
      }
      return `${value.value}|${stdDif}`;
    }
    return value.value;
  }

  hasCmcDataForAtleastTwoDates(value: string): boolean {
    // Calcular std_dif esperado
    let expectedStdDif = '';
    if (this.patron.length === 3) {
      const voltageValue = this.dcVoltageValues.find((v) => v.value === value);
      if (voltageValue) {
        if (voltageValue.ratio_calibration != null) {
          expectedStdDif = `${voltageValue.ratio_calibration}-${voltageValue.porcentaje_ratio}`;
        } else if (voltageValue.ganancia != null) {
          expectedStdDif = `${voltageValue.ganancia}-${voltageValue.ratio}`;
        }
      }
    }

    const groups = Object.values(this.cmcByDate);
    let count = 0;
    for (const group of groups) {
      if (
        group.some((item: any) => {
          if (item.std_condition === undefined || item.std_condition === null)
            return false;
          const prefix = item.std_condition.toString().startsWith('-')
            ? '-'
            : '+';
          const absValue = Math.abs(Number(item.std_condition)).toFixed(1);
          const formatted = `${prefix}${absValue} kV`;

          if (formatted !== value) return false;

          // Si patron.length == 3, también verificar std_dif
          if (this.patron.length === 3 && expectedStdDif !== '') {
            return item.std_dif === expectedStdDif;
          }

          return true;
        })
      ) {
        count++;
      }
    }
    return count >= 2;
  }

  calculateUncertainty() {
    const safeSquare = (val: number | null | undefined): number => {
      return isNaN(Number(val)) || val === null ? 0 : Math.pow(Number(val), 2);
    };

    this.stabilityByValue = {};
    this.biasByValue = {};
    this.referenceUncertaintyByValue = {};
    this.referenceStabilityByValue = {};
    this.driftByValue = {};
    this.repeatabilityByValue = {};
    this.reproducibilityByValue = {};

    this.stdstabilityByValue = {};
    this.stdbiasByValue = {};
    this.stdreferenceUncertaintyByValue = {};
    this.stdreferenceStabilityByValue = {};
    this.stddriftByValue = {};
    this.stdrepeatabilityByValue = {};
    this.stdreproducibilityByValue = {};
    this.combined = {};

    const lastDate = Object.keys(this.cmcByDate)[0];
    const months = this.patron?.[0]?.months ? Number(this.patron[0].months) : 1;
    console.log('Última fecha de CMC:', lastDate);
    console.log('Meses de la patron:', months);

    console.log('Calculando dcVoltageValues', this.dcVoltageValues);

    for (const value of this.dcVoltageValues) {
      // Crear una clave única para identificar cada combinación
      let valueKey = value.value;
      if (this.patron.length === 3) {
        let stdDif = '';
        if (value.ratio_calibration != null) {
          stdDif = `${value.ratio_calibration}-${value.porcentaje_ratio}`;
        } else if (value.ganancia != null) {
          stdDif = `${value.ganancia}-${value.ratio}`;
        }
        valueKey = `${value.value}|${stdDif}`;
      }

      // Solo procesa si hay al menos 2 fechas con ese std_condition y std_dif
      if (!this.hasCmcDataForAtleastTwoDates(value.value)) continue;

      let combinedUncertainty = 0;
      const errors: number[] = [];
      const uncertainties: number[] = [];
      const dateList: string[] = [];

      // Calcular std_dif esperado para este voltageValue
      let expectedStdDif = '';
      if (this.patron.length === 3) {
        if (value.ratio_calibration != null) {
          expectedStdDif = `${value.ratio_calibration}-${value.porcentaje_ratio}`;
        } else if (value.ganancia != null) {
          expectedStdDif = `${value.ganancia}-${value.ratio}`;
        }
      }

      for (const date of Object.keys(this.cmcByDate)) {
        const group = this.cmcByDate[date];

        // Filtrar por std_condition y std_dif si es necesario
        const matches = group.filter((item: any) => {
          if (item.std_condition == null) return false;
          const prefix = item.std_condition.toString().startsWith('-')
            ? '-'
            : '+';
          const absValue = Math.abs(Number(item.std_condition)).toFixed(1);
          const formatted = `${prefix}${absValue} kV`;

          if (formatted !== value.value) return false;

          // Si patron.length == 3, también verificar std_dif
          if (this.patron.length === 3 && expectedStdDif !== '') {
            return item.std_dif === expectedStdDif;
          }

          return true;
        });

        const match = matches[0]; // Tomar el primer match después del filtro

        if (match) {
          if (match.error === null) match.error = '';
          if (match.calibrationUncertainty === null)
            match.calibrationUncertainty = '';

          const err = match.error;
          const unc = match.calibrationUncertainty;
          if (err !== '' && err !== undefined && !isNaN(Number(err))) {
            errors.push(Number(err));
            dateList.push(date);
          }
          if (unc !== '' && unc !== undefined && !isNaN(Number(unc))) {
            uncertainties.push(Number(unc));
          }
        }
      }

      // === Stability ===
      if (errors.length === 2 || errors.length === 3) {
        const mean = errors.reduce((a, b) => a + b, 0) / errors.length;
        const variance =
          errors.reduce((sum, e) => sum + Math.pow(e - mean, 2), 0) /
          (errors.length - 1);
        const stability = Math.sqrt(variance);
        this.stabilityByValue[valueKey] = stability;

        const ci = this.components?.[0]?.stability_ci;
        const div = this.components?.[0]?.stability_div;
        this.stdstabilityByValue[valueKey] =
          ci && div ? (stability * ci) / div : null;

        combinedUncertainty += safeSquare(this.stdstabilityByValue[valueKey]);
      } else {
        this.stabilityByValue[valueKey] = null;
        this.stdstabilityByValue[valueKey] = null;
      }

      // === Reference Standard Stability ===
      if (uncertainties.length === 2 || uncertainties.length === 3) {
        const mean =
          uncertainties.reduce((a, b) => a + b, 0) / uncertainties.length;
        const variance =
          uncertainties.reduce((sum, e) => sum + Math.pow(e - mean, 2), 0) /
          (uncertainties.length - 1);
        const rss = Math.sqrt(variance);
        this.referenceStabilityByValue[valueKey] = rss;

        const ci = this.components?.[0]?.rss_ci;
        const div = this.components?.[0]?.rss_div;

        this.stdreferenceStabilityByValue[valueKey] =
          ci && div ? (rss * ci) / div : null;

        combinedUncertainty += safeSquare(
          this.stdreferenceStabilityByValue[valueKey]
        );
      } else {
        this.referenceStabilityByValue[valueKey] = null;
        this.stdreferenceStabilityByValue[valueKey] = null;
      }

      // === Drift ===
      let drift: number | null = null;
      const dates = dateList.map((d) => new Date(d));
      const zipped = dates
        .map((date, i) => ({ date, error: errors[i] }))
        .sort((a, b) => a.date.getTime() - b.date.getTime());

      if (errors.length === 2 && zipped.length === 2) {
        // Drift para 2 fechas
        const days =
          (zipped[1].date.getTime() - zipped[0].date.getTime()) /
          (1000 * 60 * 60 * 24);
        if (days > 0) {
          drift =
            (Math.abs(zipped[1].error - zipped[0].error) / days) *
            (months * (365 / 12));
        }
      } else if (errors.length === 3 && zipped.length === 3) {
        // Drift para 3 fechas
        const d0 =
          (zipped[1].date.getTime() - zipped[0].date.getTime()) /
          (1000 * 60 * 60 * 24);
        const d1 =
          (zipped[2].date.getTime() - zipped[1].date.getTime()) /
          (1000 * 60 * 60 * 24);
        if (d0 > 0 && d1 > 0) {
          drift =
            ((Math.abs(zipped[1].error - zipped[0].error) / d0 +
              Math.abs(zipped[2].error - zipped[1].error) / d1) /
              2) *
            (months * (365 / 12));
        }
      }

      this.driftByValue[valueKey] = drift;

      const ciDrift = this.components?.[0]?.drift_ci;
      const divDrift = this.components?.[0]?.drift_div;
      this.stddriftByValue[valueKey] =
        ciDrift && divDrift && drift !== null
          ? (drift * ciDrift) / divDrift
          : null;

      combinedUncertainty += safeSquare(this.stddriftByValue[valueKey]);

      // === BIAS ===
      const lastGroup = this.cmcByDate[lastDate];

      // Buscar el match correcto considerando std_dif si patron.length == 3
      const match = lastGroup?.find((item: any) => {
        if (item.std_condition == null) return false;
        const prefix = item.std_condition.toString().startsWith('-')
          ? '-'
          : '+';
        const absValue = Math.abs(Number(item.std_condition)).toFixed(1);
        const stdConditionMatch = `${prefix}${absValue} kV` === value.value;

        // Si patron.length == 3, también verificar std_dif
        if (this.patron.length === 3 && expectedStdDif !== '') {
          return stdConditionMatch && item.std_dif === expectedStdDif;
        }

        return stdConditionMatch;
      });

      let bias: number | null = null;
      let refUnc: number | null = null;
      if (match) {
        if (match.error === null) match.error = '';
        if (match.calibrationUncertainty === null)
          match.calibrationUncertainty = '';

        if (
          match.error !== '' &&
          match.error !== undefined &&
          !isNaN(Number(match.error))
        ) {
          bias = Number(match.error);
        }
        if (
          match.calibrationUncertainty !== '' &&
          match.calibrationUncertainty !== undefined &&
          !isNaN(Number(match.calibrationUncertainty))
        ) {
          refUnc = Number(match.calibrationUncertainty);
        }
      }

      this.biasByValue[valueKey] = bias;
      this.referenceUncertaintyByValue[valueKey] = refUnc;

      const ciBias = this.components?.[0]?.bias_ci;
      const divBias = this.components?.[0]?.bias_div;
      this.stdbiasByValue[valueKey] =
        ciBias && divBias && bias !== null ? (bias * ciBias) / divBias : null;

      combinedUncertainty += safeSquare(this.stdbiasByValue[valueKey]);

      const ciRsu = this.components?.[0]?.rsu_ci;
      const divRsu = this.components?.[0]?.rsu_div;
      this.stdreferenceUncertaintyByValue[valueKey] =
        ciRsu && divRsu && refUnc !== null ? (refUnc * ciRsu) / divRsu : null;

      combinedUncertainty += safeSquare(
        this.stdreferenceUncertaintyByValue[valueKey]
      );

      // === Repeatability y Reproducibility ===
      this.repeatabilityByValue[valueKey] = 0.0005;
      this.reproducibilityByValue[valueKey] = 0.0005;

      const repCI = this.components?.[0]?.repeatability_ci;
      const repDiv = this.components?.[0]?.repeatability_div;
      this.stdrepeatabilityByValue[valueKey] =
        repCI && repDiv
          ? (this.repeatabilityByValue[valueKey] * repCI) / repDiv
          : null;

      combinedUncertainty += safeSquare(this.stdrepeatabilityByValue[valueKey]);

      const reprodCI = this.components?.[0]?.reproducibility_ci;
      const reprodDiv = this.components?.[0]?.reproducibility_div;
      this.stdreproducibilityByValue[valueKey] =
        reprodCI && reprodDiv
          ? (this.reproducibilityByValue[valueKey] * reprodCI) / reprodDiv
          : null;

      combinedUncertainty += safeSquare(
        this.stdreproducibilityByValue[valueKey]
      );

      // === Resultado final ===
      this.combined[valueKey] =
        combinedUncertainty > 0 ? Math.sqrt(combinedUncertainty) : null;
    }
  }

  editMatch(item: any) {
    console.log('Editando match:', item);
    // Crear un identificador único para el item que incluya std_dif si es necesario
    let itemId = item.id;
    if (this.patron.length === 3 && item.std_dif) {
      itemId = `${item.id}_${item.std_dif}`;
    }
    this.editingItem = itemId;
  }

  finishEditMatch(match: any) {
    console.log('Finalizando edición de match:', match);
    // Crear el mismo identificador único para comparar
    let matchId = match.id;
    if (this.patron.length === 3 && match.std_dif) {
      matchId = `${match.id}_${match.std_dif}`;
    }

    // Solo si estaba editando este item específico
    if (this.editingItem === matchId) {
      this.editingItem = null;
      if (window.confirm('Si se edita, tambien se modificara en el CRM')) {
        this.modifyMatch(match);
      }
    }
  }

  // Método auxiliar para verificar si un item específico está siendo editado
  isItemBeingEdited(item: any): boolean {
    console.log('Verificando si se está editando el item:', item);
    let itemId = item.id;
    if (this.patron.length === 3 && item.std_dif) {
      itemId = `${item.id}_${item.std_dif}`;
    }
    return this.editingItem === itemId;
  }

  modifyMatch(item: any) {
    // Convierte "" a null antes de enviar al backend
    const errorValue =
      item.error === '' || item.error === undefined ? null : item.error;
    const cuValue =
      item.calibrationUncertainty === '' ||
      item.calibrationUncertainty === undefined
        ? null
        : item.calibrationUncertainty;

    // Preparar condiciones de where para ser más específico
    let whereConditions: any = { id: item.id };

    // Si patron.length == 3 y existe std_dif, agregarlo a las condiciones
    if (this.patron.length === 3 && item.std_dif) {
      whereConditions.std_dif = item.std_dif;
    }

    const registro = {
      action: 'update',
      bd: this.database,
      table: 'cmc_register',
      opts: {
        attributes: {
          error: errorValue,
          calibrationUncertainty: cuValue,
        },
        where: whereConditions,
      },
    };

    console.log('Registro a modificar:', registro);

    return;

    Swal.fire({
      title: 'Procesando datos',
      text: 'Espera un momento',
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    this.backend.post(registro, UrlClass.URLNuevo).subscribe(
      (response: any) => {
        Swal.close();
        if (response.result) {
          Swal.fire({
            icon: 'success',
            title: '¡Modificado!',
            text: 'Se ha modificado correctamente',
            timer: 2500,
            showConfirmButton: false,
            position: 'top-end',
          });
          this.onPTSelect();
        } else {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Ocurrió un problema al modificar.',
          });
          this.onPTSelect();
        }
      },
      (error) => {
        Swal.close();
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Ocurrió un problema en la petición.',
        });
      }
    );
  }

  editMonth(item: any) {
    this.editingItem = item;
  }

  finishEditMonth(item: any) {
    // Solo si estaba editando este item
    if (this.editingItem === item) {
      this.editingItem = null;
      if (window.confirm('Si se edita, tambien se modificara en el CRM')) {
        this.modifyMonth(item);
      }
    }
  }

  modifyMonth(item: any) {
    // Calcula la nueva fecha de next_calibration
    const lastCalibration = item.last_calibration
      ? new Date(item.last_calibration)
      : new Date();
    let newNextCalibration = null;
    if (lastCalibration && item.months) {
      newNextCalibration = new Date(lastCalibration);
      newNextCalibration.setMonth(
        newNextCalibration.getMonth() + Number(item.months)
      );
    }

    // Prepara el objeto para actualizar en el CRM
    const equipmentcrm = {
      action: 'update',
      bd: 'hvtest2',
      table: 'equipment_catalog',
      opts: {
        attributes: {
          months: item.months,
          next_calibration: newNextCalibration
            ? newNextCalibration.toISOString().slice(0, 10)
            : null,
        },
        where: { idequipment: item.idequipment },
      },
    };
    // Descomentar para evitar enviar la petición

    Swal.fire({
      title: 'Procesando datos',
      text: 'Espera un momento',
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    this.backend.post(equipmentcrm, UrlClass.URLNuevo).subscribe(
      (response: any) => {
        Swal.close();
        if (response.result) {
          // Actualiza el valor en el frontend (asegúrate que sea tipo Date para el pipe)
          if (newNextCalibration) {
            item.next_calibration = newNextCalibration;
          }
          Swal.fire({
            icon: 'success',
            title: '¡Modificado!',
            text: 'El intervalo y la próxima calibración fueron modificados correctamente.',
            timer: 2500,
            showConfirmButton: false,
            position: 'top-end',
          });
          this.onPTSelect();
        } else {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Ocurrió un problema al modificar.',
          });
        }
      },
      (error) => {
        Swal.close();
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Ocurrió un problema en la petición.',
        });
      }
    );
  }

  finishEditCi(ci: string) {
    //console.log('finishEditCi', ci);
    this.editingCi = null;

    if (window.confirm('Si se edita, tambien se modificara en el CRM')) {
      this.modifyCi();
    }
  }

  modifyCi() {
    //console.log('modifyCi', this.components[0]);

    // Prepara el objeto para actualizar en el CRM
    const components = {
      action: 'update',
      bd: this.database,
      table: 'cmc_uncertaintycomponents',
      opts: {
        attributes: {
          stability_ci: this.components[0].stability_ci,
          bias_ci: this.components[0].bias_ci,
          rss_ci: this.components[0].rss_ci,
          rsu_ci: this.components[0].rsu_ci,
          drift_ci: this.components[0].drift_ci,
          repeatability_ci: this.components[0].repeatability_ci,
          reproducibility_ci: this.components[0].reproducibility_ci,
        },
        where: {
          id: this.components[0].id,
        },
      },
    };

    Swal.fire({
      title: 'Procesando datos',
      text: 'Espera un momento',
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    this.backend.post(components, UrlClass.URLNuevo).subscribe(
      (response: any) => {
        Swal.close();
        if (response.result) {
          Swal.fire({
            icon: 'success',
            title: '¡Modificado!',
            text: 'Se ha modificado correctamente.',
            timer: 2500,
            showConfirmButton: false,
            position: 'top-end',
          });
          this.onPTSelect();
        } else {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Ocurrió un problema al modificar.',
          });
        }
      },
      (error) => {
        Swal.close();
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Ocurrió un problema en la petición.',
        });
      }
    );
  }

  closeNewCalibrationModal() {
    this.showNewCalibrationModal = false;
  }

  newMatch(date: string, matchKey: string) {
    // Inicializa los objetos si no existen
    if (!this.newMatchEditing[date]) this.newMatchEditing[date] = {};
    if (!this.newMatchValue[date]) this.newMatchValue[date] = {};
    this.newMatchEditing[date][matchKey] = true;
    this.newMatchValue[date][matchKey] = { error: '', cu: '' };
  }

  saveNewMatch(date: string, matchKey: string) {
    const values = this.newMatchValue[date][matchKey];

    // Extraer stdCondition y std_dif del matchKey
    const [stdCondition, stdDif] = matchKey.split('|');

    // Extraer solo el número de stdCondition
    const numericStdCondition = parseFloat(
      stdCondition.replace(/[^\d.-]/g, '')
    );

    // Preparar atributos base
    let attributes: any = {
      date: date,
      std_condition: numericStdCondition,
      error: values.error,
      calibrationUncertainty: values.cu,
      id_equipment: this.selectedCmc[0].name,
      pt: this.selectedPT[0].pt,
      created_by: this.usuario_creador,
    };

    // Solo agregar std_dif si patron.length == 3 y tiene valor
    if (this.patron.length === 3 && stdDif) {
      attributes.std_dif = stdDif;
    }

    const newMatch = {
      action: 'create',
      bd: this.database,
      table: 'cmc_register',
      opts: {
        attributes: attributes,
      },
    };

    this.backend.post(newMatch, UrlClass.URLNuevo).subscribe(
      (response: any) => {
        Swal.close();
        if (response.result) {
          Swal.fire({
            icon: 'success',
            title: '¡Modificado!',
            text: 'Se ha modificado correctamente',
            timer: 2500,
            showConfirmButton: false,
            position: 'top-end',
          });
          // Limpia el estado de edición
          this.newMatchEditing[date][matchKey] = false;
          // Recarga los registros y las tablas
          this.reloadCmcRegister();
        } else {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Ocurrió un problema al modificar.',
          });
        }
      },
      (error) => {
        Swal.close();
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Ocurrió un problema en la petición.',
        });
      }
    );
  }

  cancelNewMatch(date: string, matchKey: string) {
    this.newMatchEditing[date][matchKey] = false;
  }

  async reloadCmcRegister() {
    // Vuelve a consultar los registros y actualiza las tablas
    const idC = this.selectedCmc[0].name;
    const calibracion = {
      action: 'get',
      bd: this.database,
      table: 'cmc_register',
      opts: { where: { id_equipment: idC, deleted: 0 } },
    };
    this.backend
      .post(calibracion, UrlClass.URLNuevo)
      .subscribe(async (response: any) => {
        this.cmc = [...response['result']];
        await this.levelsCmc();
        await this.groupCmcByDate();
      });
  }

  startEditDate(date: string) {
    this.editingDate[date] = true;
  }

  cancelEditDate(date: string) {
    this.editingDate[date] = false;
  }

  confirmEditDate(event: any, oldDate: string) {
    const input = event.target as HTMLInputElement;
    const newDate = input.value;

    if (newDate && newDate !== oldDate) {
      // Usa el primer PT y equipo seleccionados
      const pt =
        this.selectedPT && this.selectedPT.length > 0
          ? this.selectedPT[0].pt
          : null;
      const equipo =
        this.selectedCmc && this.selectedCmc.length > 0
          ? this.selectedCmc[0].name
          : null;
      this.changeDate(newDate, oldDate, pt, equipo);
    }
    this.editingDate[oldDate] = false;
  }

  changeDate(newDate: string, oldDate: string, pt: string, equipo: string) {
    // lógica para actualizar la fecha
    const changeDate = {
      action: 'update',
      bd: this.database,
      table: 'cmc_register',
      opts: {
        attributes: {
          date: newDate,
        },
        where: { pt: pt, id_equipment: equipo, date: oldDate },
      },
    };

    Swal.fire({
      title: 'Procesando datos',
      text: 'Espera un momento',
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    this.backend.post(changeDate, UrlClass.URLNuevo).subscribe(
      (response: any) => {
        Swal.close();
        if (response.result) {
          Swal.fire({
            icon: 'success',
            title: '¡Modificado!',
            text: 'Se ha modificado correctamente',
            timer: 2500,
            showConfirmButton: false,
            position: 'top-end',
          });
          this.reloadCmcRegister();
        } else {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Ocurrió un problema al modificar.',
          });
        }
      },
      (error) => {
        Swal.close();
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Ocurrió un problema en la petición.',
        });
      }
    );
  }

  // Guarda o actualiza los registros de cmc_registeruc para la última tabla mostrada
  guardarActualizarCmc() {
    if (!this.selectedCmc.length || !this.selectedPT.length) {
      Swal.fire({
        icon: 'warning',
        title: 'Faltan datos',
        text: 'Selecciona un patrón y un PT antes de guardar.',
      });
      return;
    }

    const patron = this.selectedCmc[0].name;
    const pt = this.selectedPT[0].pt;
    const registros: any[] = [];

    // Mapear cada fila visible en la tabla de incertidumbre estándar
    this.dcVoltageValues.forEach((value) => {
      // Solo guardar si la fila está visible (es decir, tiene combined uncertainty calculada)
      let valueKey = value.value;
      let std_dif = null;
      if (this.patron.length === 3) {
        if (value.ratio_calibration != null) {
          std_dif = `${value.ratio_calibration}-${value.porcentaje_ratio}`;
        } else if (value.ganancia != null) {
          std_dif = `${value.ganancia}-${value.ratio}`;
        }
        valueKey = `${value.value}|${std_dif}`;
      }

      // Solo si la fila está visible (tiene combined uncertainty)
      if (
        this.combined[valueKey] !== null &&
        this.combined[valueKey] !== undefined
      ) {
        // Extract numeric value from value.value (e.g., '+1.0 kV' -> 1.0)
        let stdConditionInt = null;
        if (typeof value.value === 'string') {
          // Remove 'kV', trim, and parse float
          stdConditionInt = parseFloat(
            value.value
              .replace('kV', '')
              .replace('+', '')
              .replace('-', '-')
              .trim()
          );
        } else {
          stdConditionInt = value.value;
        }

        // Solo incluir std_dif en el filtro, no en los atributos si no existe en la BD
        const registro: any = {
          patron,
          pt,
          std_condition: stdConditionInt,
          stability: this.stdstabilityByValue[valueKey],
          drift: this.stddriftByValue[valueKey],
          rsu: this.stdreferenceUncertaintyByValue[valueKey],
          rss: this.stdreferenceStabilityByValue[valueKey],
          repeatability: this.stdrepeatabilityByValue[valueKey],
          reproducibility: this.stdreproducibilityByValue[valueKey],
          cu: this.combined[valueKey],
        };
        // Solo agregar bias si tiene valor válido
        const biasValue = this.stdbiasByValue[valueKey];
        if (biasValue !== null && biasValue !== undefined) {
          registro.bias = biasValue;
        }
        registros.push(registro);
      }
    });

    if (!registros.length) {
      Swal.fire({
        icon: 'info',
        title: 'Nada que guardar',
        text: 'No hay datos para guardar o actualizar.',
      });
      return;
    }

    Swal.fire({
      title: 'Guardando datos',
      text: 'Por favor espera...',
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    // 2. Por cada registro, consultar la BD y decidir update/create
    const acciones = registros.map((reg) => {
      // Armar filtro de búsqueda
      const where: any = {
        patron: reg.patron,
        pt: reg.pt,
        std_condition: reg.std_condition,
      };
      // GET a la BD
      return this.backend
        .post(
          {
            action: 'get',
            bd: this.database,
            table: 'cmc_registeruc',
            opts: { where },
          },
          UrlClass.URLNuevo
        )
        .toPromise()
        .then((resp: any) => {
          const existe = Array.isArray(resp.result) && resp.result.length > 0;
          const regToSave = { ...reg };
          if (existe) {
            // UPDATE
            const id = resp.result[0].id;
            console.log('Existe en BD, actualizando:', { ...regToSave, id });
            return this.backend
              .post(
                {
                  action: 'update',
                  bd: this.database,
                  table: 'cmc_registeruc',
                  opts: {
                    attributes: regToSave,
                    where: { id },
                  },
                },
                UrlClass.URLNuevo
              )
              .toPromise();
          } else {
            // CREATE
            delete regToSave.id;
            return this.backend
              .post(
                {
                  action: 'create',
                  bd: this.database,
                  table: 'cmc_registeruc',
                  opts: { attributes: regToSave },
                },
                UrlClass.URLNuevo
              )
              .toPromise();
          }
        });
    });

    Promise.all(acciones)
      .then((responses) => {
        Swal.close();
        if (responses.every((r: any) => r && r.result)) {
          Swal.fire({
            icon: 'success',
            title: '¡Guardado!',
            text: 'Los datos se han guardado/actualizado correctamente.',
            timer: 2500,
            showConfirmButton: false,
            position: 'top-end',
          });
        } else {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Ocurrió un problema al guardar algunos registros.',
          });
        }
      })
      .catch(() => {
        Swal.close();
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Ocurrió un problema en la petición.',
        });
      });
  }

  // --- U comb table state and modal ---
  uCombList: any[] = [];
  showUCombModal = false;
  uCombForm = { u_scope: '', min: '', max: '' };

  openUCombModal() {
    this.uCombForm = { u_scope: '', min: '', max: '' };
    this.showUCombModal = true;
  }

  closeUCombModal() {
    this.showUCombModal = false;
  }

  saveUComb() {
    if (!this.selectedCmc.length || !this.selectedPT.length) {
      Swal.fire({
        icon: 'warning',
        title: 'Faltan datos',
        text: 'Selecciona un patrón y un PT antes de guardar.',
      });
      return;
    }
    const patron = this.selectedCmc[0].name;
    const pt = this.selectedPT[0].pt;
    const newUComb = {
      patron,
      pt,
      u_scope: this.uCombForm.u_scope,
      min: this.uCombForm.min,
      max: this.uCombForm.max,
    };
    this.backend
      .post(
        {
          action: 'create',
          bd: this.database,
          table: 'cmc_u_comb',
          opts: { attributes: newUComb },
        },
        UrlClass.URLNuevo
      )
      .subscribe(
        (response: any) => {
          if (response.result) {
            Swal.fire({
              icon: 'success',
              title: '¡Guardado!',
              text: 'Registro guardado correctamente.',
              timer: 2000,
              showConfirmButton: false,
              position: 'top-end',
            });
            this.loadUCombList();
            this.closeUCombModal();
          } else {
            Swal.fire({
              icon: 'error',
              title: 'Error',
              text: 'No se pudo guardar.',
            });
          }
        },
        (error) => {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Ocurrió un problema en la petición.',
          });
        }
      );
  }

  loadUCombList() {
    if (!this.selectedCmc.length || !this.selectedPT.length) {
      this.uCombList = [];
      return;
    }
    const patron = this.selectedCmc[0].name;
    const pt = this.selectedPT[0].pt;
    this.backend
      .post(
        {
          action: 'get',
          bd: this.database,
          table: 'cmc_u_comb',
          opts: { where: { patron, pt } },
        },
        UrlClass.URLNuevo
      )
      .subscribe((response: any) => {
        this.uCombList = response.result || [];
      });
  }

  editUComb(row: any, field: string) {
    if (!this.editingUComb[row.id]) this.editingUComb[row.id] = {};
    this.editingUComb[row.id][field] = true;
    // Backup valor original
    if (!this.editingUCombBackup[row.id]) this.editingUCombBackup[row.id] = {};
    this.editingUCombBackup[row.id][field] = row[field];
  }

  isEditingUComb(row: any, field: string) {
    return this.editingUComb[row.id] && this.editingUComb[row.id][field];
  }

  finishEditUComb(row: any, field: string) {
    if (!this.editingUComb[row.id] || !this.editingUComb[row.id][field]) return;
    const oldValue = this.editingUCombBackup[row.id][field];
    const newValue = row[field];
    if (oldValue === newValue) {
      this.editingUComb[row.id][field] = false;
      return;
    }
    Swal.fire({
      title: '¿Guardar cambio?',
      text: `¿Deseas guardar el nuevo valor para "${field}"?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, guardar',
      cancelButtonText: 'Cancelar',
    }).then((result) => {
      if (result.isConfirmed) {
        this.backend
          .post(
            {
              action: 'update',
              bd: this.database,
              table: 'cmc_u_comb',
              opts: {
                attributes: { [field]: row[field] },
                where: { id: row.id },
              },
            },
            UrlClass.URLNuevo
          )
          .subscribe((response: any) => {
            if (!response.result) {
              Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se pudo actualizar.',
              });
              row[field] = oldValue;
            } else {
              Swal.fire({
                icon: 'success',
                title: 'Actualizado',
                text: 'El valor fue actualizado.',
              });
            }
            this.loadUCombList();
          });
      } else {
        row[field] = oldValue;
      }
      this.editingUComb[row.id][field] = false;
    });
  }

  deleteUComb(row: any) {
    Swal.fire({
      title: '¿Eliminar registro?',
      text: 'Esta acción marcará el registro como eliminado.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
    }).then((result) => {
      if (result.isConfirmed) {
        this.backend
          .post(
            {
              action: 'update',
              bd: this.database,
              table: 'cmc_u_comb',
              opts: {
                attributes: { deleted: 1 },
                where: { id: row.id },
              },
            },
            UrlClass.URLNuevo
          )
          .subscribe((response: any) => {
            if (response.result) {
              Swal.fire({
                icon: 'success',
                title: 'Eliminado',
                text: 'Registro eliminado.',
              });
              this.loadUCombList();
            } else {
              Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se pudo eliminar.',
              });
            }
          });
      }
    });
  }

  editingNonLinearity: boolean = false;

  editNonLinearity() {
    this.editingNonLinearity = true;
    // Backup por si cancela (opcional)
    this._nonLinearityBackup = this.components[0]?.non_linearity;
  }

  finishEditNonLinearity() {
    if (!this.editingNonLinearity) return;
    this.editingNonLinearity = false;
    const newValue = this.components[0]?.non_linearity;
    if (this._nonLinearityBackup === newValue) return;
    Swal.fire({
      title: '¿Guardar cambio?',
      text: `¿Deseas guardar el nuevo valor de Non linearity effect?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, guardar',
      cancelButtonText: 'Cancelar',
    }).then((result) => {
      if (result.isConfirmed) {
        this.backend
          .post(
            {
              action: 'update',
              bd: this.database,
              table: 'cmc_uncertaintycomponents',
              opts: {
                attributes: { non_linearity: newValue },
                where: { id: this.components[0]?.id },
              },
            },
            UrlClass.URLNuevo
          )
          .subscribe((response: any) => {
            if (!response.result) {
              Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se pudo actualizar.',
              });
              this.components[0].non_linearity = this._nonLinearityBackup;
            } else {
              Swal.fire({
                icon: 'success',
                title: 'Actualizado',
                text: 'El valor fue actualizado.',
              });
            }
          });
      } else {
        this.components[0].non_linearity = this._nonLinearityBackup;
      }
    });
  }

  private _nonLinearityBackup: number | null = null;
}
