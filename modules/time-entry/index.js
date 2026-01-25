export default {
  extend: '@apostrophecms/piece-type',
  options: {
    label: 'Time Entry',
    pluralLabel: 'Time Entries'
  },
  fields: {
    add: {
      timestamp: {
        type: 'dateAndTime',
        label: 'Timestamp',
        required: true
      },
      _user: {
        type: 'relationship',
        label: 'Usuario',
        withType: '@apostrophecms/user',
        required: true,
        storageIds: 'userIds',
        max: 1
      },
      eventType: {
        type: 'select',
        label: 'Tipo de evento',
        required: true,
        choices: [
          {
            label: 'Entrada',
            value: 'clockIn'
          },
          {
            label: 'Salida',
            value: 'clockOut'
          },
          {
            label: 'Inicio de descanso',
            value: 'breakStart'
          },
          {
            label: 'Fin de descanso',
            value: 'breakEnd'
          }
        ]
      },
      _createdBy: {
        type: 'relationship',
        label: 'Creado por',
        withType: '@apostrophecms/user',
        storageIds: 'createdByIds',
        max: 1
      },
      _updatedBy: {
        type: 'relationship',
        label: 'Modificado por',
        withType: '@apostrophecms/user',
        storageIds: 'updatedByIds',
        max: 1
      }
    },
    group: {
      basic: {
        label: 'Básico',
        fields: [ 'timestamp', '_user', 'eventType' ]
      },
      metadata: {
        label: 'Metadatos',
        fields: [ '_createdBy', '_updatedBy' ]
      }
    }
  },
  columns: {
    add: {
      eventType: {
        label: 'Tipo de evento'
      }
    }
  },
  methods(self) {
    return {
      async isUserWorkingNow(req, userId) {
        const checkIns = await self.getTodayCheckIns(req, userId);
        const checkOuts = await self.getTodayCheckOuts(req, userId);

        return checkIns.length > checkOuts.length;
      },
      async getTodayCheckIns(req, userId) {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        const todayCheckIns = await self.find(req, {
          'userIds.0': userId,
          timestamp: {
            $gte: startOfDay.toISOString(),
            $lte: endOfDay.toISOString()
          },
          eventType: 'clockIn'
        })
          .toArray();

        return todayCheckIns;
      },
      async getTodayCheckOuts(req, userId) {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        const todayCheckouts = await self.find(req, {
          'userIds.0': userId,
          timestamp: {
            $gte: startOfDay.toISOString(),
            $lte: endOfDay.toISOString()
          },
          eventType: 'clockOut'
        })
          .toArray();

        return todayCheckouts;
      },
      async userIsInBreak(req, userId) {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        const breakStarts = await self.find(req, {
          'userIds.0': userId,
          timestamp: {
            $gte: startOfDay.toISOString(),
            $lte: endOfDay.toISOString()
          },
          eventType: 'breakStart'
        })
          .sort({ timestamp: -1 })
          .toArray();

        const breakEnds = await self.find(req, {
          'userIds.0': userId,
          timestamp: {
            $gte: startOfDay.toISOString(),
            $lte: endOfDay.toISOString()
          },
          eventType: 'breakEnd'
        })
          .sort({ timestamp: -1 })
          .toArray();

        return breakStarts.length > breakEnds.length;
      }
    };
  },
  handlers(self) {
    return {
      beforeInsert: {
        assignTitle(req, piece) {
          piece.title = `${piece._user[0].title} - ${piece.timestamp}`;
        },
        addCreatedBy(req, piece) {
          if (req.user != null && piece._createdBy == null) {
            piece._createdBy = [ req.user ];
          }
        }
      },
      beforeUpdate: {
        addUpdatedBy(req, piece) {
          piece._updatedBy = [ req.user ];
        }
      }
    };
  },
  apiRoutes(self) {
    return {
      get: {
        // GET /api/v1/time-entry/empleados
        async empleados(req) {
          const users = await self.apos.user.find(req, {}).toArray();
          return {
            results: users.map(user => ({
              _id: user._id,
              username: user.username,
              firstName: user.firstName || '',
              lastName: user.lastName || '',
              email: user.email || '',
              title: user.title || user.username
            }))
          };
        },
        // GET /api/v1/time-entry/resumen?empleado=ID&desde=DATE&hasta=DATE
        async resumen(req) {
          const { empleado, desde, hasta } = req.query;
          
          const query = {};
          
          // Filtro por empleado
          if (empleado) {
            query['userIds.0'] = empleado;
          }
          
          // Filtro por rango de fechas
          if (desde || hasta) {
            query.timestamp = {};
            if (desde) {
              const fechaInicio = new Date(desde);
              fechaInicio.setHours(0, 0, 0, 0);
              query.timestamp.$gte = fechaInicio.toISOString();
            }
            if (hasta) {
              const fechaFin = new Date(hasta);
              fechaFin.setHours(23, 59, 59, 999);
              query.timestamp.$lte = fechaFin.toISOString();
            }
          }
          
          // Obtener todos los fichajes
          const fichajes = await self.find(req, query)
            .relationships([ '_user' ])
            .sort({ timestamp: -1 })
            .toArray();
          
          // Agrupar por fecha y usuario
          const resumen = {};
          
          fichajes.forEach(fichaje => {
            const fecha = fichaje.timestamp.split('T')[0];
            const userId = fichaje.userIds[0];
            const usuario = fichaje._user[0];
            const key = `${fecha}_${userId}`;
            
            if (!resumen[key]) {
              resumen[key] = {
                fecha,
                usuario: usuario.title,
                usuarioId: userId,
                eventos: [],
                clockIn: null,
                clockOut: null,
                breaks: []
              };
            }
            
            resumen[key].eventos.push({
              tipo: fichaje.eventType,
              hora: fichaje.timestamp
            });
            
            if (fichaje.eventType === 'clockIn' && !resumen[key].clockIn) {
              resumen[key].clockIn = fichaje.timestamp;
            }
            if (fichaje.eventType === 'clockOut' && !resumen[key].clockOut) {
              resumen[key].clockOut = fichaje.timestamp;
            }
            if (fichaje.eventType === 'breakStart' || fichaje.eventType === 'breakEnd') {
              resumen[key].breaks.push({
                tipo: fichaje.eventType,
                hora: fichaje.timestamp
              });
            }
          });
          
          // Calcular totales y formatear
          const resultado = Object.values(resumen).map(dia => {
            let totalMinutos = 0;
            let horario = '';
            let completada = false;
            let estado = 'normal';
            
            if (dia.clockIn && dia.clockOut) {
              const inicio = new Date(dia.clockIn);
              const fin = new Date(dia.clockOut);
              totalMinutos = Math.floor((fin - inicio) / 1000 / 60);
              
              // Restar tiempo de descansos
              for (let i = 0; i < dia.breaks.length; i += 2) {
                if (dia.breaks[i] && dia.breaks[i + 1]) {
                  const breakStart = new Date(dia.breaks[i].hora);
                  const breakEnd = new Date(dia.breaks[i + 1].hora);
                  totalMinutos -= Math.floor((breakEnd - breakStart) / 1000 / 60);
                }
              }
              
              const horas = Math.floor(totalMinutos / 60);
              const minutos = totalMinutos % 60;
              
              horario = `Desde: ${inicio.toTimeString().slice(0, 5)}. Hasta: ${fin.toTimeString().slice(0, 5)}.`;
              completada = horas >= 8; // Jornada completa si >= 8 horas
              
              return {
                fecha: dia.fecha,
                usuario: dia.usuario,
                usuarioId: dia.usuarioId,
                totalHoras: `${horas}h ${minutos}min`,
                horario,
                completada,
                estado: completada ? 'normal' : 'incidencia'
              };
            } else if (dia.clockIn && !dia.clockOut) {
              // Entrada sin salida - incidencia
              const inicio = new Date(dia.clockIn);
              horario = `Desde: ${inicio.toTimeString().slice(0, 5)}. Pendiente de salida.`;
              estado = 'incidencia';
              
              return {
                fecha: dia.fecha,
                usuario: dia.usuario,
                usuarioId: dia.usuarioId,
                totalHoras: '0h 0min',
                horario,
                completada: false,
                estado
              };
            } else {
              // Sin fichajes - podría ser festivo
              return {
                fecha: dia.fecha,
                usuario: dia.usuario,
                usuarioId: dia.usuarioId,
                totalHoras: '0h 0min',
                horario: 'Sin registros',
                completada: false,
                estado: 'incidencia'
              };
            }
          });
          
          return resultado;
        }
      },
      post: {
        // POST /api/v1/time-entry/crear-manual
        async 'crear-manual'(req) {
          const { empleado, fecha, hora, tipoEvento } = req.body;
          
          if (!empleado || !fecha || !hora || !tipoEvento) {
            throw self.apos.error('invalid', 'Faltan parámetros requeridos');
          }
          
          // Obtener usuario
          const user = await self.apos.user.find(req, { _id: empleado }).toObject();
          if (!user) {
            throw self.apos.error('notfound', 'Usuario no encontrado');
          }
          
          // Crear timestamp combinando fecha y hora
          const timestamp = new Date(`${fecha}T${hora}:00`);
          
          // Crear fichaje
          const timeEntry = self.newInstance();
          timeEntry.timestamp = timestamp.toISOString();
          timeEntry.eventType = tipoEvento;
          timeEntry._user = [ user ];
          
          if (req.user) {
            timeEntry._createdBy = [ req.user ];
          }
          
          await self.insert(req, timeEntry, { permissions: false });
          
          return {
            success: true,
            message: 'Fichaje creado correctamente',
            fichaje: {
              id: timeEntry._id,
              timestamp: timeEntry.timestamp,
              tipo: timeEntry.eventType,
              usuario: user.title
            }
          };
        },
        
        register: async function(req) {
          const { eventType, employeeId } = req.body;
          const user = await self.apos.user.find(req, { _id: employeeId }).toObject();

          if (user == null) {
            throw self.apos.error('invalid');
          }

          const isUserWorkingNow = await self.isUserWorkingNow(req, employeeId);

          if (!isUserWorkingNow) {
            const timeEntry = self.newInstance();
            timeEntry.timestamp = new Date().toISOString();
            timeEntry.eventType = 'clockIn';
            timeEntry._user = [ user ];
            timeEntry._createdBy = [ user ];

            await self.insert(req, timeEntry, { permissions: false });

            return {
              status: 'workStarted',
              fullName: user.title
            };
          }

          if (isUserWorkingNow) {
            if (eventType == null) {
              const userIsInBreak = await self.userIsInBreak(req, employeeId);
              return {
                status: userIsInBreak ? 'breakInProgress' : 'workInProgress',
                fullName: user.title
              };
            } else if ([ 'clockOut', 'breakStart', 'breakEnd' ].includes(eventType)) {
              const timeEntry = self.newInstance();
              timeEntry.timestamp = new Date().toISOString();
              timeEntry.eventType = eventType;
              timeEntry._user = [ user ];
              timeEntry._createdBy = [ user ];

              await self.insert(req, timeEntry, { permissions: false });

              return {
                status: 'entryRecorded',
                fullName: user.title
              };
            }

          }

          throw self.apos.error('invalid event type');
        }
      }
    };
  }
};
