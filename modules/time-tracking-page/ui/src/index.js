import Swal from 'sweetalert2';
export default () => {
  apos.util.onReady(() => {
    // Estado de la aplicación
    const state = {
      fichajes: [],
      currentPage: 1,
      itemsPerPage: 10,
      sortBy: 'fecha',
      sortOrder: 'desc',
      filtros: {
        empleado: '',
        fechaInicio: '',
        fechaFin: ''
      }
    };

    inicializar();

    function inicializar() {
      // Verificar que estamos en la página correcta
      if (!document.getElementById('tabla-fichajes')) {
        return;
      }

      cargarEmpleados();
      cargarFichajes();
      configurarEventListeners();
    }

    // Cargar empleados desde API
    function cargarEmpleados() {
      fetch('/api/v1/time-entry/empleados')
        .then(response => response.json())
        .then(data => {
          const empleados = data.results || [];
          const selectFiltro = document.getElementById('filtro-empleado');
          const selectModal = document.getElementById('modal-empleado');

          empleados.forEach(emp => {
            const option1 = document.createElement('option');
            option1.value = emp._id;
            option1.textContent = `${emp.firstName || ''} ${emp.lastName || emp.username || ''}`;
            selectFiltro.appendChild(option1);

            const option2 = document.createElement('option');
            option2.value = emp._id;
            option2.textContent = `${emp.firstName || ''} ${emp.lastName || emp.username || ''}`;
            selectModal.appendChild(option2);
          });
        });
    }

    // Cargar fichajes desde API
    function cargarFichajes() {
      const params = new URLSearchParams();
      if (state.filtros.empleado) {
        params.append('empleado', state.filtros.empleado);
      }
      if (state.filtros.fechaInicio) {
        params.append('desde', state.filtros.fechaInicio);
      }
      if (state.filtros.fechaFin) {
        params.append('hasta', state.filtros.fechaFin);
      }

      const url = `/api/v1/time-entry/resumen?${params.toString()}`;

      fetch(url)
        .then(response => response.json())
        .then(fichajes => {
          state.fichajes = fichajes || [];
          renderizarTabla();
        })
        .catch(error => {
          Swal.fire('Error', error.message, 'error');
        });
    }

    // Renderizar tabla
    function renderizarTabla() {
      const tbody = document.getElementById('tabla-fichajes-body');
      const fichajes = state.fichajes;

      if (!fichajes || fichajes.length === 0) {
        tbody.innerHTML = `<tr class="table-row-animate hover:bg-background/30 transition-colors">
              <td class="px-6 py-4">
                No se encontraron registros
              </td>
            </tr>`;
        return;
      }

      // Aplicar ordenamiento
      const fichajesOrdenados = fichajes.slice().sort((a, b) => {
        const aVal = a[state.sortBy] || '';
        const bVal = b[state.sortBy] || '';
        if (state.sortOrder === 'asc') {
          return aVal > bVal ? 1 : -1;
        } else {
          return aVal < bVal ? 1 : -1;
        }
      });

      // Calcular paginación
      const inicio = (state.currentPage - 1) * state.itemsPerPage;
      const fin = inicio + state.itemsPerPage;
      const fichajesPaginados = fichajesOrdenados.slice(inicio, fin);

      // Renderizar filas
      let html = '';
      fichajesPaginados.forEach(fichaje => {
        let claseEstado = '';
        if (fichaje.estado === 'festivo') {
          claseEstado = 'estado-festivo';
        }
        if (fichaje.estado === 'incidencia') {
          claseEstado = 'estado-incidencia';
        }

        html += `<tr class="table-row-animate hover:bg-background/30 transition-colors ${claseEstado}">
              <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
                    <svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                    </svg>
                  </div>
                  <div>
                    <p class="font-medium text-white">${formatearFecha(fichaje.fecha)}</p>
                  </div>
                </div>
              </td>
              <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-background font-bold text-sm">JD</div>
                  <span class="text-white">${fichaje.usuario || '-'}</span>
                </div>
              </td>
              <td class="px-6 py-4">
                <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-success/20 text-success">
                  ${fichaje.totalHoras || '0h 0m'}
                </span>
              </td>
              <td class="px-6 py-4">
                <div class="flex flex-wrap gap-2">
                  <span class="inline-flex items-center gap-1 px-2 py-1 rounded bg-primary/20 text-primary text-xs">
                    <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"/></svg>
                    ${fichaje.horario || '-'}
                  </span>
                </div>
              </td>
              <td class="px-6 py-4 text-center">
                <span class="inline-flex items-center justify-center w-8 h-8 rounded-full ${fichaje.completada ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'}">
                  <svg class="w-5 h-5 ${fichaje.completada ? 'text-success' : 'text-warning'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                  </svg>
                </span>
              </td>
            </tr>`;
      });
      tbody.innerHTML = html;
    }

    // Formatear fecha
    function formatearFecha(fecha) {
      if (!fecha) {
        return '-';
      }
      const partes = fecha.split('-');
      if (partes.length !== 3) {
        return fecha;
      }
      return `${partes[2]}-${partes[1]}-${partes[0]}`;
    }

    // Configurar event listeners
    function configurarEventListeners() {
      // Aplicar filtros
      document.getElementById('btn-aplicar-filtros')?.addEventListener('click', () => {
        state.filtros.empleado = document.getElementById('filtro-empleado').value;
        state.filtros.fechaInicio = document.getElementById('filtro-fecha-inicio').value;
        state.filtros.fechaFin = document.getElementById('filtro-fecha-fin').value;
        state.currentPage = 1;
        cargarFichajes();
      });

      // Ordenar tabla
      document.querySelectorAll('[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
          const sortBy = th.dataset.sort;
          if (state.sortBy === sortBy) {
            state.sortOrder = state.sortOrder === 'asc' ? 'desc' : 'asc';
          } else {
            state.sortBy = sortBy;
            state.sortOrder = 'desc';
          }
          renderizarTabla();
        });
      });

      // Modal Nuevo Fichaje
      document.getElementById('btn-nuevo-fichaje')?.addEventListener('click', () => {
        document.getElementById('modal-nuevo-fichaje').style.display = 'flex';
      });

      document.getElementById('modal-close')?.addEventListener('click', () => {
        document.getElementById('modal-nuevo-fichaje').style.display = 'none';
      });

      document.getElementById('modal-cancelar')?.addEventListener('click', () => {
        document.getElementById('modal-nuevo-fichaje').style.display = 'none';
      });

      // Form nuevo fichaje
      document.getElementById('form-nuevo-fichaje')?.addEventListener('submit', (e) => {
        e.preventDefault();

        const datos = {
          empleado: document.getElementById('modal-empleado').value,
          fecha: document.getElementById('modal-fecha').value,
          hora: document.getElementById('modal-hora').value,
          tipoEvento: document.getElementById('modal-tipo-evento').value
        };

        fetch('/api/v1/time-entry/crear-manual', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(datos)
        })
          .then(response => {
            return response.json().then(data => {
              return {
                ok: response.ok,
                data
              };
            });
          })
          .then(result => {
            if (result.ok && window.Swal) {
              Swal.fire('¡Éxito!', result.data.message || 'Fichaje creado correctamente', 'success');
              document.getElementById('modal-nuevo-fichaje').style.display = 'none';
              document.getElementById('form-nuevo-fichaje').reset();
              cargarFichajes();
            } else {
              throw new Error(result.data.message || 'Error al crear fichaje');
            }
          })
          .catch(error => {
            Swal.fire('Error', error.message || 'No se pudo crear el fichaje', 'error');
          });
      });

      // Descargar PDF
      document.getElementById('btn-descargar-pdf')?.addEventListener('click', () => {
        if (window.Swal) {
          Swal.fire('En desarrollo', 'La funcionalidad de exportar a PDF estará disponible próximamente', 'info');
        }
      });
    }
  });
};
