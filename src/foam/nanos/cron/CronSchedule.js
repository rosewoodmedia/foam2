/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.nanos.cron',
  name: 'CronSchedule',
  implements: [
    'foam.nanos.cron.Schedule'
  ],

  javaImports: [
    'foam.dao.DAO',
    'foam.nanos.notification.Notification',
    'foam.util.SafetyUtil',
    'java.util.Calendar',
    'java.util.Date',
    'java.util.concurrent.atomic.AtomicBoolean'
  ],

  documentation: `
    Schedule for periodic tasks. Prefer IntervalSchedule unless dayOfWeek is required.
  `,

  properties: [
    {
      class: 'Int',
      name: 'minute',
      value: -1,
      documentation: `Minute to execute script.
          Ranges from 0 - 59. -1 for wildcard`
    },
    {
      class: 'Int',
      name: 'hour',
      value: -1,
      documentation: `Hour to execute script.
          Ranges from 0 - 23. -1 for wildcard`
    },
    {
      class: 'Int',
      name: 'dayOfMonth',
      value: -1,
      documentation: `Day of Month to execute script.
          Ranges from 1 - 31. -1 for wildcard`
    },
    {
      class: 'Int',
      name: 'month',
      value: -1,
      documentation: `Month to execute script.
          Ranges from 1 - 12. -1 for wildcard`
    },
    {
      class: 'Int',
      name: 'dayOfWeek',
      value: -1,
      documentation: `Day of week to execute script.
          Ranges from 0 - 6, where 0 is Sunday. -1 for wildcard`
    },
    {
      class: 'Int',
      name: 'second',
      value: 0,
      documentation: `Second to execute the script.
           Ranges from 0 - 59. -1 for wildcard`
    },
  ],

  methods: [
    {
      name: 'getNextScheduledTime',
      args: [
        {
          name: 'from',
          type: 'java.util.Date'
        }
      ],
      type: 'Date',
      javaCode:
`Calendar next = Calendar.getInstance();
next.setTime(from);
next.add(Calendar.SECOND, 1);
next.set(Calendar.MILLISECOND, 0);

boolean dateFound = false;
while ( next.get(Calendar.YEAR) < 3000 ) {
  if ( getMonth() >= 0 && next.get(Calendar.MONTH) != getMonth() - 1 ) {
    next.add(Calendar.MONTH, 1);
    next.set(Calendar.DAY_OF_MONTH, 1);
    next.set(Calendar.HOUR_OF_DAY, 0);
    next.set(Calendar.MINUTE, 0);
    next.set(Calendar.SECOND, 0);
    continue;
  }
  if ( ( getDayOfMonth() >= 0 && next.get(Calendar.DAY_OF_MONTH) != getDayOfMonth() ) ||
      ( getDayOfWeek() >= 0 && next.get(Calendar.DAY_OF_WEEK) != getDayOfWeek() + 1) ) {
    next.add(Calendar.DAY_OF_MONTH, 1);
    next.set(Calendar.HOUR_OF_DAY, 0);
    next.set(Calendar.MINUTE, 0);
    next.set(Calendar.SECOND, 0);
    continue;
  }
  if ( getHour() >= 0 && next.get(Calendar.HOUR_OF_DAY) != getHour() ) {
    next.add(Calendar.HOUR_OF_DAY, 1);
    next.set(Calendar.MINUTE, 0);
    next.set(Calendar.SECOND, 0);
    continue;
  }
  if ( getMinute() >= 0 && next.get(Calendar.MINUTE) != getMinute() ) {
    next.add(Calendar.MINUTE, 1);
    next.set(Calendar.SECOND, 0);
    continue;
  }
  if( getSecond() >= 0 && next.get(Calendar.SECOND) != getSecond() ) {
    next.add(Calendar.SECOND, 1);
    continue;
  }

  dateFound = true;
  break;
}
if ( !dateFound ) {
  throw new IllegalArgumentException("Unable to get next scheduled time");
}
return next.getTime();`
    }
  ]
});

