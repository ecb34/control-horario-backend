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
      post: {
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
