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
      async hasCheckedInToday(req, userId) {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        const todayEntry = await self.find(req, {
          'userIds.0': userId,
          timestamp: {
            $gte: startOfDay.toISOString(),
            $lte: endOfDay.toISOString()
          },
          eventType: 'clockIn'
        }).toObject();

        return !!todayEntry;
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

          const hasCheckedIn = await self.hasCheckedInToday(req, employeeId);

          const timeEntry = self.newInstance();
          timeEntry.timestamp = new Date().toISOString();
          timeEntry.eventType = eventType;
          timeEntry.userIds = [ employeeId ];

          await self.insert(req, timeEntry, { permissions: false });
        }
      }
    };
  }
};
