import PDFDocument from 'pdfkit';

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
      },
      async procesarResumen(req, empleado, desde, hasta) {
        const query = {};

        if (empleado) {
          query['userIds.0'] = empleado;
        }

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

        const fichajes = await self.find(req, query)
          .relationships([ '_user' ])
          .sort({ timestamp: 1 })
          .toArray();

        const resumenPorDia = {};

        fichajes.forEach(fichaje => {
          const fecha = fichaje.timestamp.split('T')[0];
          const userId = fichaje.userIds[0];
          const usuario = fichaje._user[0];
          const key = `${fecha}_${userId}`;

          if (!resumenPorDia[key]) {
            resumenPorDia[key] = {
              fecha,
              usuario: usuario.title,
              usuarioId: userId,
              eventos: []
            };
          }

          resumenPorDia[key].eventos.push({
            tipo: fichaje.eventType,
            hora: fichaje.timestamp
          });
        });

        const resultado = [];

        Object.values(resumenPorDia).forEach(dia => {
          const jornadas = [];
          let jornadaActual = null;
          let descansoActual = null;

          dia.eventos.forEach(evento => {
            if (evento.tipo === 'clockIn') {
              if (jornadaActual === null) {
                jornadaActual = {
                  inicio: evento.hora,
                  fin: null,
                  descansos: []
                };
              }
            } else if (evento.tipo === 'clockOut') {
              if (jornadaActual !== null) {
                jornadaActual.fin = evento.hora;
                jornadas.push(jornadaActual);
                jornadaActual = null;
              }
            } else if (evento.tipo === 'breakStart') {
              descansoActual = {
                inicio: evento.hora,
                fin: null
              };
            } else if (evento.tipo === 'breakEnd') {
              if (descansoActual !== null) {
                descansoActual.fin = evento.hora;
                if (jornadaActual !== null) {
                  jornadaActual.descansos.push(descansoActual);
                }
                descansoActual = null;
              }
            }
          });

          if (jornadaActual !== null) {
            jornadas.push(jornadaActual);
          }

          let totalMinutosDia = 0;
          const horarios = [];
          let tieneIncidencia = false;

          jornadas.forEach((jornada) => {
            let totalMinutosJornada = 0;

            if (jornada.inicio && jornada.fin) {
              const inicio = new Date(jornada.inicio);
              const fin = new Date(jornada.fin);
              const diferencia = (fin - inicio) / 1000 / 60;
              totalMinutosJornada = Math.floor(diferencia);

              jornada.descansos.forEach(descanso => {
                if (descanso.inicio && descanso.fin) {
                  const inicioDesc = new Date(descanso.inicio);
                  const finDesc = new Date(descanso.fin);
                  const difDesc = (finDesc - inicioDesc) / 1000 / 60;
                  totalMinutosJornada -= Math.floor(difDesc);
                }
              });

              const horas = Math.floor(totalMinutosJornada / 60);
              const minutos = totalMinutosJornada % 60;
              const horaInicio = inicio.toTimeString().slice(0, 5);
              const horaFin = fin.toTimeString().slice(0, 5);
              horarios.push(
                `${horaInicio}-${horaFin} (${horas}h ${minutos}min)`
              );
              totalMinutosDia += totalMinutosJornada;
            } else if (jornada.inicio && !jornada.fin) {
              const inicio = new Date(jornada.inicio);
              const horaInicio = inicio.toTimeString().slice(0, 5);
              horarios.push(`${horaInicio}-Pendiente`);
              tieneIncidencia = true;
            }
          });

          const horasDia = Math.floor(totalMinutosDia / 60);
          const minutosDia = totalMinutosDia % 60;

          resultado.push({
            fecha: dia.fecha,
            usuario: dia.usuario,
            usuarioId: dia.usuarioId,
            totalHoras: `${horasDia}h ${minutosDia}min`,
            horario: horarios.join(' | ') || 'Sin registros',
            jornadas: jornadas.length,
            completada: !tieneIncidencia,
            estado: tieneIncidencia ? 'incidencia' : 'normal'
          });
        });

        return resultado;
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
          const {
            empleado, desde, hasta
          } = req.query;

          return await self.procesarResumen(req, empleado, desde, hasta);
        }
      },
      post: {
        // POST /api/v1/time-entry/crear-manual
        async 'crear-manual'(req) {
          const {
            empleado, fecha, hora, tipoEvento
          } = req.body;

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
  },
  routes(self) {
    return {
      get: {
        // GET /api/v1/time-entry/pdf-resumen?empleado=ID&desde=DATE&hasta=DATE
        async 'pdf-resumen'(req) {
          try {
            const {
              empleado, desde, hasta
            } = req.query;

            const resultado = await self.procesarResumen(req, empleado, desde, hasta);

            const doc = new PDFDocument({
              margin: 40,
              size: 'A4'
            });

            req.res.setHeader('Content-Type', 'application/pdf');
            const timestamp = Date.now();
            req.res.setHeader(
              'Content-Disposition',
              `attachment; filename="resumen-fichajes-${timestamp}.pdf"`
            );

            doc.pipe(req.res);

            doc.fontSize(20).font('Helvetica-Bold')
              .text('Resumen de Fichajes', { align: 'center' });
            doc.moveDown(0.3);

            const fechaActual = new Date();
            const desdeStr = desde
              ? new Date(desde).toLocaleDateString('es-ES')
              : 'Inicio';
            const hastaStr = hasta
              ? new Date(hasta).toLocaleDateString('es-ES')
              : 'Hoy';

            doc.fontSize(10).font('Helvetica');
            doc.text(
              `Período: ${desdeStr} al ${hastaStr}`,
              { align: 'center' }
            );
            if (empleado && resultado.length > 0) {
              doc.text(`Empleado: ${resultado[0].usuario}`, { align: 'center' });
            }
            doc.text(
              `Generado: ${fechaActual.toLocaleDateString('es-ES')} 
                ${fechaActual.toLocaleTimeString('es-ES')}`,
              { align: 'center' }
            );
            doc.moveDown(0.8);

            if (resultado.length > 0) {
              const colWidth = 130;
              const colX1 = 40;
              const colX2 = colX1 + colWidth;
              const colX3 = colX2 + colWidth;
              const colX4 = colX3 + colWidth;
              const rowHeight = 20;
              let yPos = doc.y;

              doc.fontSize(9).font('Helvetica-Bold');
              doc.rect(colX1, yPos, colWidth, rowHeight).stroke();
              doc.text('Fecha', colX1 + 5, yPos + 4, { width: colWidth - 10 });

              doc.rect(colX2, yPos, colWidth, rowHeight).stroke();
              doc.text('Usuario', colX2 + 5, yPos + 4, { width: colWidth - 10 });

              doc.rect(colX3, yPos, colWidth, rowHeight).stroke();
              doc.text('Total Horas', colX3 + 5, yPos + 4, { width: colWidth - 10 });

              doc.rect(colX4, yPos, colWidth, rowHeight).stroke();
              doc.text('Estado', colX4 + 5, yPos + 4, { width: colWidth - 10 });

              yPos += rowHeight;
              doc.fontSize(8).font('Helvetica');

              resultado.forEach((row) => {
                if (yPos > 700) {
                  doc.addPage();
                  yPos = 40;
                }

                doc.rect(colX1, yPos, colWidth, rowHeight).stroke();
                doc.text(row.fecha, colX1 + 5, yPos + 4, {
                  width: colWidth - 10
                });

                doc.rect(colX2, yPos, colWidth, rowHeight).stroke();
                const usuario = row.usuario.substring(0, 25);
                doc.text(usuario, colX2 + 5, yPos + 4, { width: colWidth - 10 });

                doc.rect(colX3, yPos, colWidth, rowHeight).stroke();
                doc.text(row.totalHoras, colX3 + 5, yPos + 4, {
                  width: colWidth - 10
                });

                doc.rect(colX4, yPos, colWidth, rowHeight).stroke();
                doc.text(row.estado.toUpperCase(), colX4 + 5, yPos + 4, {
                  width: colWidth - 10
                });

                yPos += rowHeight;
              });
            } else {
              doc.fontSize(11).text(
                'No hay datos para el período seleccionado.',
                { align: 'center' }
              );
            }

            doc.moveDown(2);
            doc.fontSize(7).text(
              'Generado automáticamente por el sistema.',
              { align: 'center' }
            );

            doc.end();
          } catch (error) {
            console.error('Error en pdf-resumen:', error);
            return {
              error: 'Error al generar PDF',
              message: error.message
            };
          }
        }
      }
    };
  }
};
