export default () => {
  apos.util.onReady(() => {
    console.log('Inicializando módulo de fichajes...');

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

    // Cargar SweetAlert2
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/sweetalert2@11';
    script.onload = () => {
      console.log('SweetAlert2 cargado');
      inicializar();
    };
    document.head.appendChild(script);

    function inicializar() {
      // Verificar que estamos en la página correcta
      if (!document.getElementById('tabla-fichajes')) {
        console.log('No estamos en la página de resumen de fichajes');
        return;
      }

      cargarEmpleados();
      cargarFichajes();
      configurarEventListeners();
    }

    // Cargar empleados desde API
    function cargarEmpleados() {
      console.log('Cargando empleados...');
      fetch('/api/v1/time-entry/empleados')
        .then(response => response.json())
        .then(data => {
          console.log('Empleados recibidos:', data);
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
          console.log('Empleados cargados:', empleados.length);
        })
        .catch(error => {
          console.error('Error cargando empleados:', error);
        });
    }

    // Cargar fichajes desde API
    function cargarFichajes() {
      console.log('Cargando fichajes con filtros:', state.filtros);
      const params = new URLSearchParams();
      if (state.filtros.empleado) params.append('empleado', state.filtros.empleado);
      if (state.filtros.fechaInicio) params.append('desde', state.filtros.fechaInicio);
      if (state.filtros.fechaFin) params.append('hasta', state.filtros.fechaFin);
      
      const url = `/api/v1/time-entry/resumen?${params.toString()}`;
      console.log('URL de consulta:', url);
      
      fetch(url)
        .then(response => response.json())
        .then(fichajes => {
          console.log('Fichajes recibidos:', fichajes);
          state.fichajes = fichajes || [];
          renderizarTabla();
        })
        .catch(error => {
          console.error('Error cargando fichajes:', error);
          if (window.Swal) {
            Swal.fire('Error', 'No se pudieron cargar los fichajes', 'error');
          }
        });
    }

    // Renderizar tabla
    function renderizarTabla() {
      const tbody = document.getElementById('tabla-fichajes-body');
      const fichajes = state.fichajes;
      
      if (!fichajes || fichajes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="padding: 3rem; text-align: center; color: #7f8c8d;">No se encontraron registros</td></tr>';
        document.getElementById('registros-inicio').textContent = '0';
        document.getElementById('registros-fin').textContent = '0';
        document.getElementById('registros-total').textContent = '0';
        document.getElementById('paginacion-botones').innerHTML = '';
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
        if (fichaje.estado === 'festivo') claseEstado = 'estado-festivo';
        if (fichaje.estado === 'incidencia') claseEstado = 'estado-incidencia';
        
        const iconoCompletada = fichaje.completada ? '✅' : '⚠️';
        
        html += `<tr class="${claseEstado}">`;
        html += `<td>${formatearFecha(fichaje.fecha)}</td>`;
        html += `<td>${fichaje.usuario || '-'}</td>`;
        html += `<td><strong>${fichaje.totalHoras || '0h 0m'}</strong></td>`;
        html += `<td>${fichaje.horario || '-'}</td>`;
        html += `<td style="text-align: center; font-size: 20px;">${iconoCompletada}</td>`;
        html += `</tr>`;
      });
      tbody.innerHTML = html;

      // Actualizar información de paginación
      document.getElementById('registros-inicio').textContent = inicio + 1;
      document.getElementById('registros-fin').textContent = Math.min(fin, fichajes.length);
      document.getElementById('registros-total').textContent = fichajes.length;

      renderizarPaginacion(fichajes.length);
    }

    // Renderizar botones de paginación
    function renderizarPaginacion(totalRegistros) {
      const totalPaginas = Math.ceil(totalRegistros / state.itemsPerPage);
      const container = document.getElementById('paginacion-botones');

      if (totalPaginas <= 1) {
        container.innerHTML = '';
        return;
      }

      let html = `<button class="paginacion-btn btn-prev" ${state.currentPage === 1 ? 'disabled' : ''}>← Anterior</button>`;

      for (let i = 1; i <= totalPaginas; i++) {
        if (i === 1 || i === totalPaginas || (i >= state.currentPage - 2 && i <= state.currentPage + 2)) {
          html += `<button class="paginacion-btn ${i === state.currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
        } else if (i === state.currentPage - 3 || i === state.currentPage + 3) {
          html += '<span style="padding: 0.5rem;">...</span>';
        }
      }

      html += `<button class="paginacion-btn btn-next" ${state.currentPage === totalPaginas ? 'disabled' : ''}>Siguiente →</button>`;

      container.innerHTML = html;

      // Event listeners para paginación
      container.querySelector('.btn-prev')?.addEventListener('click', () => {
        if (state.currentPage > 1) {
          state.currentPage--;
          renderizarTabla();
        }
      });

      container.querySelector('.btn-next')?.addEventListener('click', () => {
        if (state.currentPage < totalPaginas) {
          state.currentPage++;
          renderizarTabla();
        }
      });

      container.querySelectorAll('[data-page]').forEach(btn => {
        btn.addEventListener('click', () => {
          state.currentPage = parseInt(btn.dataset.page);
          renderizarTabla();
        });
      });
    }

    // Formatear fecha
    function formatearFecha(fecha) {
      if (!fecha) return '-';
      const partes = fecha.split('-');
      if (partes.length !== 3) return fecha;
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
            return { ok: response.ok, data: data };
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
          console.error('Error creando fichaje:', error);
          if (window.Swal) {
            Swal.fire('Error', error.message || 'No se pudo crear el fichaje', 'error');
          }
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

