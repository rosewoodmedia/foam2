/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */
foam.INTERFACE({
  name: 'Assembly',
  package: 'foam.util.concurrent',

  methods: [
    {
      name: 'startJob',
      documentation: `
        Execute serially before start of job.
        Good place to take locks, assign sequence number, etc.
      `
    },
    {
      name: 'executeJob',
      documentation: `
        Execute concurrent part of the job.
      `
    },
    {
      name: 'endJob',
      documentation: `
        Execute serial part of the job once it leaves the queue.
        @param lastJob true iff there are no more jobs in the queue.
      `
    },
    {
      name: 'isLast',
      synchronized: true,
      type: 'Boolean',
      documentation: `
        return true iff this is the last Assembly currently in the queue.
        Determined if waitToComplete() has been called.
      `
    },
    {
      name: 'complete',
      documentation: `
        Mark this Assembly as having completed.
        Will notify to unblock thread blocked by waitToComplete().
      `
    },
    {
      name: 'waitToComplete',
      documentation: `
        Block until the Assembly becomes complete.
        Calling lets Assembly know it isn't last in queue.
      `
    }
  ]
})
