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
        label: 'User',
        withType: '@apostrophecms/user',
        required: true,
        storageIds: 'userIds',
        max: 1
      },
      eventType: {
        type: 'select',
        label: 'Event Type',
        required: true,
        choices: [
          {
            label: 'Clock in',
            value: 'clockIn'
          },
          {
            label: 'Clock out',
            value: 'clockOut'
          },
          {
            label: 'Break Start',
            value: 'breakStart'
          },
          {
            label: 'Break End',
            value: 'breakEnd'
          }
        ]
      }
    },
    group: {}
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
            timeEntry.userIds = [ employeeId ];

            await self.insert(req, timeEntry, { permissions: false });

            return {
              status: 'workStarted',
              fullName: `${user.firstName} ${user.lastName}`
            };
          }

          if (isUserWorkingNow && [ 'clockOut', 'breakStart', 'breakEnd' ].includes(eventType)) {
            const timeEntry = self.newInstance();
            timeEntry.timestamp = new Date().toISOString();
            timeEntry.eventType = eventType;
            timeEntry.userIds = [ employeeId ];

            await self.insert(req, timeEntry, { permissions: false });

            return {
              status: 'entryRecorded',
              fullName: `${user.firstName} ${user.lastName}`
            };
          }

          throw self.apos.error('invalid event type');
        }
      }
    };
  }
};
