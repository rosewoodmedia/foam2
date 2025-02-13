/**
 * @license
 * Copyright 2014 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

foam.CLASS({
  package: 'foam.dao',
  name: 'EasyDAO',
  extends: 'foam.dao.ProxyDAO',
  implements: [
    'foam.mlang.Expressions',
    'foam.nanos.boot.NSpecAware'
  ],

  documentation: function() {/*
    Facade for easily creating decorated DAOs.
    <p>
    Most DAOs are most easily created and configured with EasyDAO.
    Simply require foam.dao.EasyDAO and create() with the flags
    to indicate what behavior you're looking for. Under the hood, EasyDAO
    will create one or more DAO instances to service your requirements and then
  */},

  requires: [
    'foam.box.Context',
    'foam.box.HTTPBox',
    'foam.box.RetryBox',
    'foam.box.SessionClientBox',
    'foam.box.SocketBox',
    'foam.box.TimeoutBox',
    'foam.box.WebSocketBox',
    'foam.dao.CachingDAO',
    'foam.dao.ClientDAO',
    'foam.dao.CompoundDAODecorator',
    'foam.dao.ContextualizingDAO',
    'foam.dao.DeDupDAO',
    'foam.dao.DecoratedDAO',
    'foam.dao.GUIDDAO',
    'foam.dao.IDBDAO',
    {
      path: 'foam.dao.JDAO',
      flags: ['js'],
    },
    {
      name: 'JDAOJava',
      path: 'foam.dao.java.JDAO',
      flags: ['java'],
    },
    'foam.dao.MDAO',
    'foam.dao.OrderedDAO',
    'foam.dao.PromisedDAO',
    'foam.dao.RequestResponseClientDAO',
    'foam.dao.SequenceNumberDAO',
    'foam.dao.SyncDAO',
    'foam.dao.TimingDAO',
    'foam.dao.JournalType',
    'foam.nanos.auth.ServiceProviderAware',
    'foam.nanos.auth.ServiceProviderAwareDAO',
    'foam.nanos.logger.Logger',
    'foam.nanos.logger.LoggingDAO'
  ],

  imports: [ 'document' ],

  javaImports: [
    'foam.nanos.logger.Logger',
    'foam.dao.ValidatingDAO'
  ],

  constants: [
    {
      documentation: 'Aliases for daoType',
      name: 'aliases',
      flags: [ 'js' ],
      value: {
        ARRAY:  'foam.dao.ArrayDAO',
        CLIENT: 'foam.dao.RequestResponseClientDAO',
        IDB:    'foam.dao.IDBDAO',
        LOCAL:  'foam.dao.LocalStorageDAO',
        MDAO:   'foam.dao.MDAO'
      }
    }
  ],

  properties: [
    {
      documentation: 'The developer-friendly name for this EasyDAO',
      class: 'String',
      name: 'name',
      factory: function() {
        return this.nSpec && this.nSpec.name || this.of.id;
      },
      javaFactory: `
      if ( getNSpec() != null ) {
        return getNSpec().getName();
      }
      return this.getOf().getId();
     `
    },
    {
      name: 'nSpec',
      class: 'FObjectProperty',
      type: 'foam.nanos.boot.NSpec'
    },
    {
      /** This is set automatically when you create an EasyDAO.
        @private */
      name: 'delegate',
      javaFactory: `
        Logger logger = (Logger) getX().get("logger");

        foam.dao.DAO delegate = getInnerDAO();
        foam.dao.DAO head = delegate;
        foam.dao.ProxyDAO pxy = null;
        while( head instanceof foam.dao.ProxyDAO ) {
          pxy = (foam.dao.ProxyDAO) head;
          if ( head instanceof foam.dao.MDAO ) 
            break;
          head = ( (ProxyDAO) head).getDelegate();
        }
        if ( head instanceof foam.dao.MDAO ) {
          setMdao((foam.dao.MDAO)head);
          if ( getIndex() != null && getIndex().length > 0 ) 
            getMdao().addIndex(getIndex());
        }
        if ( getFixedSize() != null ) {
          if ( head instanceof foam.dao.MDAO && pxy != null ) {
            foam.dao.ProxyDAO fixedSizeDAO = (foam.dao.ProxyDAO) getFixedSize();
            fixedSizeDAO.setDelegate(head);
            pxy.setDelegate(fixedSizeDAO);
          } 
          else {
            logger.error(this.getClass().getSimpleName(), "NSpec.name", (getNSpec() != null ) ? getNSpec().getName() : null, "of_", of_, "FixedSizeDAO did not find instanceof MDAO");
            System.exit(1);
          }
        }

        delegate = getOuterDAO(delegate);

        if ( getDecorator() != null ) {
          if ( ! ( getDecorator() instanceof ProxyDAO ) ) {
            logger.error(this.getClass().getSimpleName(), "delegate", "NSpec.name", (getNSpec() != null ) ? getNSpec().getName() : null, "of_", of_ , "delegateDAO", getDecorator(), "not instanceof ProxyDAO");
            System.exit(1);
          }
          // The decorator dao may be a proxy chain
          ProxyDAO proxy = (ProxyDAO) getDecorator();
          while ( proxy.getDelegate() != null ) 
            proxy = (ProxyDAO) proxy.getDelegate();
          proxy.setDelegate(delegate);
          delegate = (ProxyDAO) getDecorator();
        }

        if ( getGuid() && getSeqNo() ) 
          throw new RuntimeException("EasyDAO GUID and SeqNo are mutually exclusive");
        
        if ( getSeqNo() ) {
          delegate = new foam.dao.SequenceNumberDAO.Builder(getX()).
          setDelegate(delegate).
          setProperty(getSeqPropertyName()).
          setStartingValue(getSeqStartingValue()).
          build();
        }

        if ( getGuid() ) 
          delegate = new foam.dao.GUIDDAO.Builder(getX()).setDelegate(delegate).build();

        if ( getValidated() ) {
          if ( getValidator() != null )
            delegate = new foam.dao.ValidatingDAO(getX(), delegate, getValidator());
          else
            delegate = new foam.dao.ValidatingDAO(getX(), delegate, foam.core.ValidatableValidator.instance());
        }

        if ( getServiceProviderAware() ) {
          delegate = new foam.nanos.auth.ServiceProviderAwareDAO.Builder(getX()).setDelegate(delegate).build();
        }

        if ( getLifecycleAware() && getDeletedAware() ){
          throw new RuntimeException("Both DeletedAware and LifecycleAware cannot be used simultaneously");
        }

        if ( getLifecycleAware() ) {
          delegate = new foam.nanos.auth.LifecycleAwareDAO.Builder(getX())
            .setDelegate(delegate)
            .setName(getPermissionPrefix())
            .build();
        }

        if ( getDeletedAware() ) {
          logger.warning("EasyDAO", getNSpec().getName(), "DEPRECATED: DeletedAware. Use LifecycleAware instead");

          delegate = new foam.nanos.auth.DeletedAwareDAO.Builder(getX())
            .setDelegate(delegate)
            .setName(getPermissionPrefix())
            .build();
        }

        if ( getRuler() ) {
          String name = foam.util.SafetyUtil.isEmpty(getRulerDaoKey()) ? getName() : getRulerDaoKey();
          delegate = new foam.nanos.ruler.RulerDAO(getX(), delegate, name);
        }

        if ( getCreatedAware() )
          delegate = new foam.nanos.auth.CreatedAwareDAO.Builder(getX()).setDelegate(delegate).build();

        if ( getCreatedByAware() ) 
          delegate = new foam.nanos.auth.CreatedByAwareDAO.Builder(getX()).setDelegate(delegate).build();

        if ( getLastModifiedAware() ) 
          delegate = new foam.nanos.auth.LastModifiedAwareDAO.Builder(getX()).setDelegate(delegate).build();

        if ( getLastModifiedByAware() ) 
          delegate = new foam.nanos.auth.LastModifiedByAwareDAO.Builder(getX()).setDelegate(delegate).build();

        if ( getContextualize() ) {
          delegate = new foam.dao.ContextualizingDAO.Builder(getX()).
          setDelegate(delegate).
          build();
        }

        if ( getOrder() != null && getOrder().length > 0 ) {
          // TODO: CompositeDAO or thenBy
          for ( foam.mlang.order.Comparator comp : getOrder() ) 
            delegate = delegate.orderBy(comp);
        }

        if ( getAuthorize() ) {
          delegate = new foam.nanos.auth.AuthorizationDAO.Builder(getX())
            .setDelegate(delegate)
            .setAuthorizer(getAuthorizer())
            .build();
        }

        if ( getNSpec() != null && getNSpec().getServe() && ! getAuthorize() && ! getReadOnly() ) 
          logger.warning("EasyDAO", getNSpec().getName(), "Served DAO should be Authorized, or ReadOnly");

        if ( getPermissioned() && ( getNSpec() != null && getNSpec().getServe() ) ) 
          delegate = new foam.nanos.auth.PermissionedPropertyDAO.Builder(getX()).setDelegate(delegate).build();

        if ( getReadOnly() ) 
          delegate = new foam.dao.ReadOnlyDAO.Builder(getX()).setDelegate(delegate).build();

        if ( getLogging() ) 
          delegate = new foam.nanos.logger.LoggingDAO.Builder(getX()).setNSpec(getNSpec()).setDelegate(delegate).build();

        if ( getPipelinePm() && ( delegate instanceof ProxyDAO ) ) 
          delegate = new foam.dao.PipelinePMDAO.Builder(getX()).setNSpec(getNSpec()).setDelegate(delegate).build();;

        if ( getPm() ) 
          delegate = new foam.dao.PMDAO.Builder(getX()).setNSpec(getNSpec()).setDelegate(delegate).build();

        return delegate;
      `
    },
    {
      class: 'Object',
      type: 'foam.dao.DAO',
      name: 'innerDAO',
      javaFactory: `
      if ( getNullify() ) {
        return new foam.dao.NullDAO.Builder(getX())
        .setOf(getOf())
        .build();
      }
      if ( getJournalType().equals(JournalType.SINGLE_JOURNAL) )
        return new foam.dao.java.JDAO(getX(), getOf(), getJournalName());
      return new foam.dao.MDAO(getOf());
      `
    },
    {
      class: 'Object',
      type: 'foam.dao.DAO',
      name: 'decorator'
    },
    {
      class: 'Boolean',
      documentation: 'Creates pipelinePMDAOs around each decorator to measure their performance',
      name: 'pipelinePm'
    },
    {
      documentation: 'Have EasyDAO use a sequence number to index items. Note that .seqNo and .guid features are mutuallyexclusive.',
      class: 'Boolean',
      name: 'seqNo',
      value: false
    },
    {
      class: 'Long',
      name: 'seqStartingValue',
      value: 1
    },
    {
      documentation: 'Have EasyDAO generate guids to index items. Note that .seqNo and .guid features are mutually exclusive',
      class: 'Boolean',
      name: 'guid',
      label: 'GUID',
      value: false
    },
    {
      class: 'String',
      name: 'seqPropertyName',
      value: 'id'
    },
    {
      documentation: 'The property on your items to use to store the sequence number or guid. This is required for .seqNo or .guid mode',
      name: 'seqProperty',
      generateJava: false,
      class: 'Property'
    },
    {
      documentation: 'Enable local in-memory caching of the DAO',
      class: 'Boolean',
      name: 'cache',
      generateJava: false,
      value: false
    },
    {
      documentation: 'Enable authorization',
      class: 'Boolean',
      name: 'authorize',
      value: true
    },
    {
      class: 'Object',
      type: 'foam.nanos.auth.Authorizer',
      name: 'authorizer',
      javaFactory: `
      if ( foam.nanos.auth.Authorizable.class.isAssignableFrom(getOf().getObjClass()) ) {
        return new foam.nanos.auth.AuthorizableAuthorizer(getPermissionPrefix());
      } else {
        return new foam.nanos.auth.StandardAuthorizer(getPermissionPrefix());
      }
      `
    },
    {
      class: 'String',
      name: 'permissionPrefix',
      factory: function() {
        return this.of.name.toLowerCase();
      },
      javaFactory: `
      return this.getOf().getObjClass().getSimpleName().toLowerCase();
     `
    },
    {
      class: 'Boolean',
      name: 'readOnly',
      value: false
    },
    {
      documentation: 'Sets the inner dao to a nullDAO',
      class: 'Boolean',
      name: 'nullify',
      value: false
    },
    {
      documentation: 'Wrap in PermissionedPropertiesDAO',
      class: 'Boolean',
      name: 'permissioned',
      value: true
    },
    {
      documentation: 'Add a validatingDAO decorator',
      class: 'Boolean',
      name: 'validated'
    },
    {
      documentation: 'Validator for the validatingDAO decorator',
      class: 'FObjectProperty',
      of: 'foam.core.Validator',
      name: 'validator'
    },
    {
      documentation: 'Enable value de-duplication to save memory when caching',
      class: 'Boolean',
      name: 'dedup',
      generateJava: false,
      value: false,
    },
    {
      documentation: 'Keep a history of all state changes to the DAO',
      class: 'foam.core.Enum',
      of: 'foam.dao.JournalType',
      name: 'journalType',
      value: 'NO_JOURNAL'
    },
    {
      class: 'String',
      name: 'journalName'
    },
    {
      class: 'FObjectProperty',
      of: 'foam.dao.Journal',
      generateJava: false,
      name: 'journal'
    },
    {
      documentation: 'Enable logging on the DAO',
      class: 'Boolean',
      name: 'logging',
      value: false,
    },
    {
      documentation: 'Enable time tracking for concurrent DAO operations',
      class: 'Boolean',
      name: 'timing',
      value: false
    },
    {
      class: 'Boolean',
      name: 'pm',
      value: false
    },
    {
      documentation: 'Contextualize objects on .find, re-creating them with this EasyDAO\'s exports, as if they were children of this EasyDAO.',
      class: 'Boolean',
      name: 'contextualize',
      value: false
    },
    {
      class: 'Boolean',
      name: 'ruler',
      value: true
    },
    {
      class: 'String',
      name: 'rulerDaoKey'
    },
    {
      /**
        <p>Selects the basic functionality this EasyDAO should provide.
        You can specify an instance of a DAO model definition such as
        MDAO, or a constant indicating your requirements.</p>
        <p>Choices are:</p>
        <ul>
          <li>IDB: Use IndexDB for storage.</li>
          <li>LOCAL: Use local storage.</li>
          <li>MDAO: Use non-persistent in-memory storage.</li>
        </ul>
      */
      name: 'daoType',
      generateJava: false,
      value: 'foam.dao.IDBDAO'
    },
    {
      class: 'FObjectProperty',
      of: 'foam.dao.MDAO',
      name: 'mdao'
    },
    {
      documentation: 'Automatically generate indexes as necessary, if using an MDAO or cache',
      class: 'Boolean',
      generateJava: false,
      name: 'autoIndex',
      documentation: 'not currently supported',
      value: false
    },
    {
      documentation: 'Turn on to activate synchronization with a server. Specify serverUri and syncProperty as well',
      class: 'Boolean',
      name: 'syncWithServer',
      generateJava: false,
      value: false
    },
    {
      documentation: 'Turn on to enable remote listener support. Only useful with daoType = CLIENT',
      class: 'Boolean',
      generateJava: false,
      name: 'remoteListenerSupport',
      value: false
    },
    {
      documentation: 'Setting to true activates polling, periodically checking in with the server. If sockets are used, polling is optional as the server can push changes to this client',
      class: 'Boolean',
      generateJava: false,
      name: 'syncPolling',
      value: true
    },
    {
      documentation: 'Set to true if you are running this on a server, and clients will synchronize with this DAO',
      class: 'Boolean',
      generateJava: false,
      name: 'isServer',
      value: false
    },
    {
      documentation: 'The property to synchronize on. This is typically an integer value indicating the version last seen on the remote',
      name: 'syncProperty',
      generateJava: false
    },
    {
      name: 'retryBoxMaxAttempts',
      generateJava: false,
    },
    {
      documentation: 'Destination address for server',
      name: 'serverBox',
      generateJava: false,
      factory: function() {
        // TODO: This should come from the server via a lookup from a NamedBox.
        var box = this.TimeoutBox.create({
          delegate: this.remoteListenerSupport ?
            this.WebSocketBox.create({ uri: this.serviceName }) :
            this.HTTPBox.create({ url: this.serviceName })
        })
        if ( this.retryBoxMaxAttempts != 0 ) {
          box = this.RetryBox.create({
            maxAttempts: this.retryBoxMaxAttempts,
            delegate: box,
          })
        }
        return this.SessionClientBox.create({ delegate: box });
      }
    },
    {
      /** Simpler alternative than providing serverBox. */
      name: 'serviceName',
      generateJava: false
    },
    {
      class: 'FObjectArray',
      of: 'foam.dao.DAODecorator',
      generateJava: false,
      name: 'decorators'
    },
    {
      class: 'FObjectArray',
      of: 'foam.mlang.order.Comparator',
      name: 'order'
    },
    {
      class: 'FObjectArray',
      of: 'foam.core.PropertyInfo',
      name: 'index'
    },
    {
      name: 'testData',
      generateJava: false
    },
    {
      documentation: 'Enables automated adding of property-related DAO decorators to qualifying decorator chains',
      name: 'enableInterfaceDecorators',
      class: 'Boolean',
      value: true
    },
    {
      name: 'serviceProviderAware',
      class: 'Boolean',
      javaFactory: 'return getEnableInterfaceDecorators() && foam.nanos.auth.ServiceProviderAware.class.isAssignableFrom(getOf().getObjClass());'
    },
    {
      name: 'lifecycleAware',
      class: 'Boolean',
      javaFactory: 'return getEnableInterfaceDecorators() && foam.nanos.auth.LifecycleAware.class.isAssignableFrom(getOf().getObjClass());'
    },
    {
      name: 'deletedAware',
      class: 'Boolean',
      javaFactory: 'return getEnableInterfaceDecorators() && foam.nanos.auth.DeletedAware.class.isAssignableFrom(getOf().getObjClass());'
    },
    {
      name: 'createdAware',
      class: 'Boolean',
      javaFactory: 'return getEnableInterfaceDecorators() && foam.nanos.auth.CreatedAware.class.isAssignableFrom(getOf().getObjClass());'
    },
    {
      name: 'createdByAware',
      class: 'Boolean',
      javaFactory: 'return getEnableInterfaceDecorators() && foam.nanos.auth.CreatedByAware.class.isAssignableFrom(getOf().getObjClass());'
    },
    {
      name: 'lastModifiedAware',
      class: 'Boolean',
      javaFactory: 'return getEnableInterfaceDecorators() && foam.nanos.auth.LastModifiedAware.class.isAssignableFrom(getOf().getObjClass());'
    },
    {
      name: 'lastModifiedByAware',
      class: 'Boolean',
      javaFactory: 'return getEnableInterfaceDecorators() && foam.nanos.auth.LastModifiedByAware.class.isAssignableFrom(getOf().getObjClass());'
    },
    {
      name: 'fixedSize',
      class: 'FObjectProperty',
      of: 'foam.dao.FixedSizeDAO'
    },
 ],

  methods: [
    {
      name: 'init_',
      javaCode: `
       if ( of_ == null ) {
         foam.nanos.logger.Logger logger = (foam.nanos.logger.Logger) getX().get("logger");
         if ( logger != null ) {
           logger.error("EasyDAO", getName(), "'of' not set.", new Exception("of not set"));
         } else {
           System.err.println("EasyDAO "+getName()+" 'of' not set.");
         }
         System.exit(1);
       }
     `
    },
    {
      name: 'getOuterDAO',
      documentation: 'Method to be overidden on the user end to add framework user specific DAO decorators to EasyDAO',
      type: 'foam.dao.DAO',
      args: [
        {
          type: 'foam.dao.DAO',
          name: 'innerDAO'
        }
      ],
      javaCode: `
        return innerDAO;
      `
    },
    function init() {
      /**
        <p>On initialization, the EasyDAO creates an appropriate chain of
        internal EasyDAO instances based on the EasyDAO
        property settings.</p>
        <p>This process is transparent to the developer, and you can use your
        EasyDAO like any other DAO.</p>
      */
      this.SUPER.apply(this, arguments);

      var daoType = typeof this.daoType === 'string' ?
        this.ALIASES[this.daoType] || this.daoType :
        this.daoType;

      var params = { of: this.of };

      if ( daoType == 'foam.dao.RequestResponseClientDAO' ) {
        foam.assert(this.hasOwnProperty('serverBox') || this.serviceName, 'EasyDAO "client" type requires a serveBox or serviceName');

        // The RequestResonseClientDAO generates listener events locally
        // but with remoteListenerSupport, this isn't needed, so switch
        // to the regular ClientDAO instead.
        if ( this.remoteListenerSupport ) {
          daoType = 'foam.dao.ClientDAO';
        }

        params.delegate = this.serverBox;
      }

      var daoModel = typeof daoType === 'string' ?
        this.__context__.lookup(daoType) || global[daoType] :
        daoType;

      if ( ! daoModel ) {
        this.__context__.warn(
          "EasyDAO: Unknown DAO Type.  Add '" + daoType + "' to requires: list."
        );
      }

      if ( this.name && daoModel.getAxiomByName('name') ) params.name = this.name;
      if ( daoModel.getAxiomByName('autoIndex') ) params.autoIndex = this.autoIndex;
      //if ( this.seqNo || this.guid ) params.property = this.seqProperty;

      var dao = daoModel.create(params, this.__subContext__);

      // Not used by decorators.
      delete params['name'];

      if ( this.MDAO.isInstance(dao) ) {
        this.mdao = dao;
        if ( this.dedup ) dao = this.DeDupDAO.create({delegate: dao});
      } else {
        if ( this.cache ) {
          this.mdao = this.MDAO.create({of: params.of});

          var cache = this.mdao;
          if ( this.dedup ) cache = this.DeDupDAO.create({delegate: cache});
          if ( Array.isArray(this.order) && this.order.length > 0 ) cache = this.OrderedDAO.create({
            delegate: cache,
            comparator: foam.compare.toCompare(this.order)
          });

          dao = this.CachingDAO.create({
            cache: cache,
            src: dao,
            of: this.model
          });
        }
      }

      if ( this.journal ) {
        dao = this.JDAO.create({
          delegate: dao,
          journal: this.journal
        });
      }

      if ( this.seqNo && this.guid ) throw "EasyDAO 'seqNo' and 'guid' features are mutually exclusive.";

      if ( this.seqNo ) {
        var args = {__proto__: params, delegate: dao, of: this.of};
        if ( this.seqProperty ) args.property = this.seqProperty;
        args.startingValue = this.seqStartingValue;
        dao = this.SequenceNumberDAO.create(args);
      }

      if ( this.guid ) {
        var args = {__proto__: params, delegate: dao, of: this.of};
        if ( this.seqProperty ) args.property = this.seqProperty;
        dao = this.GUIDDAO.create(args);
      }

      var cls = this.of;

      if ( this.syncWithServer && this.isServer ) throw "isServer and syncWithServer are mutually exclusive.";

      if ( this.syncWithServer || this.isServer ) {
        if ( ! this.syncProperty ) {
          this.syncProperty = cls.SYNC_PROPERTY;
          if ( ! this.syncProperty ) {
            throw "EasyDAO sync with class " + cls.id + " invalid. Sync requires a sync property be set, or be of a class including a property 'sync_property'.";
          }
        }
      }

      if ( this.syncWithServer ) {
        foam.assert(this.serverBox, 'syncWithServer requires serverBox');

        dao = this.SyncDAO.create({
          remoteDAO: this.RequestResponseClientDAO.create({
              name: this.name,
              delegate: this.serverBox
          }, boxContext),
          syncProperty: this.syncProperty,
          delegate: dao,
          pollingFrequency: 1000
        });
        dao.syncRecordDAO = foam.dao.EasyDAO.create({
          of: dao.SyncRecord,
          cache: true,
          daoType: this.daoType,
          name: this.name + '_SyncRecords'
        });
      }

      if ( this.contextualize ) {
        dao = this.ContextualizingDAO.create({delegate: dao});
      }

      if ( this.decorators.length ) {
        var decorated = this.DecoratedDAO.create({
          decorator: this.CompoundDAODecorator.create({
            decorators: this.decorators
          }),
          delegate: dao
        });
        dao = decorated;
      }

      if ( this.order ) {
        for ( var i = 0; i <  this.order.length; i++ ) {
          dao = dao.orderBy(this.order[i]);
        }
      }

      if ( this.timing ) {
        dao = this.TimingDAO.create({ name: this.name + 'DAO', delegate: dao });
      }

      if ( this.logging ) {
        dao = this.LoggingDAO.create({
          nSpec: this.nSpec,
          delegate: dao
        });
      }

      var self = this;

      if ( decorated ) decorated.dao = dao;

      if ( this.testData ) {
        var delegate = dao;

        dao = this.PromisedDAO.create({
          promise: new Promise(function(resolve, reject) {
            delegate.select(self.COUNT()).then(function(c) {
              // Only load testData if DAO is empty
              if ( c.value ) {
                resolve(delegate);
                return;
              }

              self.log("Loading test data");
              Promise.all(foam.json.parse(self.testData, self.of, self).map(
                function(o) { return delegate.put(o); }
              )).then(function() {
                self.log("Loaded", self.testData.length, "records.");
                resolve(delegate);
              }, reject);
            });
          })
        });
      }

      this.delegate = dao;
    },

    /** Only relevant if cache is true or if daoType
       was set to MDAO, but harmless otherwise. Generates an index
       for a query over all specified properties together.
       @param var_args specify any number of Properties to be indexed.
    */
    {
      name: 'addPropertyIndex',
      type: 'foam.dao.EasyDAO',
      args: [ { javaType: 'foam.core.PropertyInfo...', name: 'props' } ],
      code:     function addPropertyIndex() {
        this.mdao && this.mdao.addPropertyIndex.apply(this.mdao, arguments);
        return this;
      },
      javaCode: ` 
        if ( getMdao() != null ) {
          getMdao().addIndex(props);
        }
        return this;
      `
    },

    /** Only relevant if cache is true or if daoType
      was set to MDAO, but harmless otherwise. Adds an existing index
      to the MDAO.
      @param index The index to add.
    */
    {
      name: 'addIndex',
      type: 'foam.dao.EasyDAO',
      documentation: 'Only relavent if the cache is true or if daoType was set to MDAO, but harmless otherwise. Adds an existing index to the MDAO',
      // TODO: The java Index interface conflicts with the js CLASS Index
      args: [ { javaType: 'foam.dao.index.Index', name: 'index' } ],
      code: function addIndex(index) {
        this.mdao && this.mdao.addIndex.apply(this.mdao, arguments);
        return this;
      },
      javaCode: `
        if ( getMdao() != null ) 
          getMdao().addIndex(index);
        return this;
      `
    },
    {
      name: 'addDecorator',
      documentation: 'Places a decorator chain ending in a null delegate at a specified point in the chain. Automatically insterts between given decorator and mdao. If "before" flag is true, decorator chain placed before the dao instead of inbetween the supplied dao and mdao. Return true on success.',
      type: 'Boolean',
      args: [
        {
          documentation: 'Null ending decorator chain to insert',
          name: 'decorator',
          javaType: 'foam.dao.ProxyDAO'
        },
        {
          documentation: 'Decorator in the EasyDAO chain to place in relation to',
          name: 'location',
          javaType: 'foam.core.ClassInfo'
        },
        {
          documentation: 'If true, decorator chain placed before the dao instead of inbetween the supplied dao and mdao',
          name: 'before',
          class: 'Boolean'
        }
      ],
      javaCode: `
        foam.dao.DAO daodecorator = getDelegate();

        if ( ! ( daodecorator instanceof foam.dao.ProxyDAO ) ) 
          return false;

        ProxyDAO proxy = (ProxyDAO) daodecorator;
        while ( true ) {
          if ( before && location.isInstance( proxy.getDelegate() ) )
            break;
          else if ( !before && location.isInstance( proxy ) )
            break;
          else if ( !(proxy.getDelegate() instanceof foam.dao.ProxyDAO) ) 
            return false;

          proxy = (foam.dao.ProxyDAO) proxy.getDelegate();
        }

        if ( decorator == null || ! ( decorator.getDelegate() instanceof ProxyDAO ) ) 
          return false;

        foam.dao.ProxyDAO decoratorptr = decorator;
        
        while ( decorator.getDelegate() != null ) 
          decorator = (ProxyDAO) decorator.getDelegate();
        decorator.setDelegate(proxy.getDelegate());
        proxy.setDelegate(decoratorptr);
        return true;
      `
    },
    {
      name: 'printDecorators',
      documentation: 'Useful for debugging and checking if EasyDAO is being used to correctly set up a decorator chain',
      javaCode: `
        foam.dao.DAO delegate = this;
        while ( delegate instanceof foam.dao.ProxyDAO) {
          System.out.println(delegate.getClass().getSimpleName());
          delegate = ((foam.dao.ProxyDAO) delegate).getDelegate();
        }
        System.out.println(delegate.getClass().getSimpleName());
      `
    }
  ]
});
