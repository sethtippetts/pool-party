'use strict';

var _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } };

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var jsforce = require('jsforce');
var moment = require('moment');
var Promise = Promise || require('bluebird');

var conn,
    oneHourMillis = 1000 * 60 * 60;

var VSForce = (function () {
  function VSForce(config) {
    _classCallCheck(this, VSForce);

    if (!config || !config.Endpoint || !config.SecurityToken || !config.Password || !config.Username) {
      throw new Error('Missing SalesForce credentials');
    }
    this.config = JSON.parse(JSON.stringify(config));
    this.pool = [];
  }

  _createClass(VSForce, [{
    key: 'query',
    value: (function (_query) {
      function query(_x) {
        return _query.apply(this, arguments);
      }

      query.toString = function () {
        return _query.toString();
      };

      return query;
    })(function (query) {
      return this.getConnection().then(function (conn) {
        return new Promise(function (resolve, reject) {
          console.log(' ************* QUERY ***************\n', query);
          conn.query(query, function (err, res) {
            if (err) return reject(err);
            resolve(res);
          });
        });
      });
    })
  }, {
    key: 'getConnection',

    /**
     * getConnection
     * @returns {promise|*|Function|promise|promise|promise}
     */
    value: function getConnection() {
      var _this = this;

      return this.checkConnDuration().then(function (renew) {
        if (!renew && !_this.config.newConn && conn.loginUrl === _this.config.Endpoint) return Promise.resolve();
        _this.config.newConn = false;

        conn = new jsforce.Connection({
          loginUrl: _this.config.Endpoint,
          accessToken: _this.config.SecurityToken
        });

        conn.login(_this.config.Username, _this.config.Password + _this.config.SecurityToken, function (err, res) {
          if (!!err) throw new Error(err);
        });
        return conn;
      });
    }
  }, {
    key: 'checkConnDuration',

    /**
     * checkConnDuration
     * @param conn
     */
    value: function checkConnDuration() {
      // No connection, create one.
      if (!this.conn) {
        return Promise.resolve(true);
      }return new Promise(function (resolve, reject) {

        var dur = moment().subtract(conn._initializedAt).valueOf(),
            calcDur = dur / oneHourMillis;

        console.log('Duration of connection: ' + calcDur + ' hours');

        // Connection still valid, don't renew
        if (calcDur < 10) return resolve(false);

        console.log('Logging out connection at: ' + calcDur);
        conn.logout(function (err) {
          if (err) return reject(err);
          console.log('Session has been expired.');
          resolve(true);
        });
      });
    }
  }]);

  return VSForce;
})();

// // Gophers - Lookup account info with service number
// VForce.prototype.searchAccountsByServiceNumber = function (serviceNo) {
//   return this.getConnection()
//     .then(function () {
//       return conn.queryAsync(addParameters(queries.getAccountsByServiceNumber, [{name: 'serviceNo', value: '(' + createSQLString([serviceNo]) + ')'}], true));
//     })
//     .then(function (data) {
//       return Q.all([
//         conn.queryAsync('SELECT CMS_Office_ID__c FROM Office__c WHERE Name = \'' + data.records[0].Office_f__c + '\''),
//         data.records[0]
//       ]);
//     })
//     .then(function (data) {
//       return {
//         id:           data[1].Service__r.Service_Number__c,
//         name:         data[1].Service__r.Bill_To_Contact_f__c,
//         office:       data[0].records[0].CMS_Office_ID__c,
//         address:      data[1].Service__r.Service_Address_1__c + ', ' + data[1].Service__r.Service_City__c + ' ' + data[1].Service__r.Service_State__c,
//         s3Bucket:     data[1].Service__r.Id,
//         lastModified: data[1].Service__r.LastModifiedDate
//       };
//     })
//     .catch(function(err) {
//       log.error('util/vforce.js [searchAccountsByServiceNumber] ERROR: ', '\n\n', JSON.stringify(err), '\n\n');
//       throw new Error(err);
//   });
// };

// // Gophers - Pulls accounts that are ready for pre-design based on the office they're in.
// VForce.prototype.getAccountsbyOffice = function(offices) {
//   var accountList = [];
//   var d = Q.defer();
//   this.getConnection()
//     .then(function() {
//       var done = waitress(offices.length, function (err) {
//         if (err) return d.reject(err);
//         return d.resolve(accountList);
//       });
//       _.each(offices, function (office) {
//         conn.query('SELECT Name FROM Office__c WHERE CMS_Office_ID__c = \'' + office + '\'', function (err, officeName) {
//           if (err) return done(err);
//           conn.query(addParameters(queries.getProjectsByOfficeId, [{name: 'officeName', value: officeName.records[0].Name}]), function (err, res) {
//             if (err) return done(err);
//             var geminiStartDate = moment('7/19/14');
//             res.records = _.filter(res.records, function (record) {
//               return (record.CAD_Design_Complete__c === null && moment(record.Site_Survey_Approved__c) > geminiStartDate && record.Status__c !== 'Pending Cancellation' && record.Status__c !== 'Cancelled');
//             });
//             if (!res.records.length) return d.resolve([]);
//             conn.query(addParameters(queries.getAccountsByServiceNumber, [{name: 'serviceNo', value: '(' + createSQLString(res.records, 'Service__r', 'Service_Number__c') + ')'}], true), function (err, res) {
//               if (err) return done(err);
//               _.each(res.records, function (record) {
//                 accountList.push({
//                   id:           record.Service__r.Service_Number__c,
//                   name:         record.Service__r.Bill_To_Contact_f__c,
//                   office:       office,
//                   address:      record.Service__r.Service_Address_1__c + ', ' + record.Service__r.Service_City__c + ' ' + record.Service__r.Service_State__c,
//                   s3Bucket:     record.Service__r.Id,
//                   lastModified: record.Service__r.LastModifiedDate
//                 });
//               });
//               done();
//             });
//           });
//         });
//       });
//     });
//   return d.promise;
// };

// // Gopphers - Gets all of the s3Id's for an account
// VForce.prototype.getAttachmentIdsByServiceId = function (Id, filters) {
//   var d = Q.defer();
//   this.getConnection()
//     .then(function() {
//       conn.query('SELECT Id FROM Milestone1_Project__c WHERE Milestone1_Project__c.Service__c = \'' + Id + '\'', function (err, projectId) {
//         if (err) d.reject(err);
//         conn.query(addParameters(queries.getAttachmentsById, [{name: 'projectId', value: projectId.records[0].Id}]), function (err, res) {
//           if(err) d.reject(err);
//           // filter the results here rather than the query for performance reasons.
//           res.records = _.filter(res.records, function (rec) {
//             if (filters.CAD && rec.Category__c == 'Engineering-Permitting') return true;
//             if (filters.Suneyes && rec.Category__c == 'Site-Survey' && rec.Document_Type__c == 'Suneyes') return true;
//             if (filters.Photos && rec.Category__c == 'Site-Survey' && _.indexOf(['Attic photo', 'Rafter sizing photo', 'Rafter Spacing photo', 'Rafter Sizing photo', 'Rafter spacing photo'], rec.Document_Type__c) > -1) return true;
//             if (filters.Photos && rec.Category__c == 'Site-Survey' && rec.Document_Type__c == 'Power meter photo') return true;
//             if (filters.Photos && rec.Category__c == 'Site-Survey' && rec.Document_Type__c == 'Front of house photo') return true;
//             if (filters.Photos && rec.Category__c == 'Site-Survey' && _.indexOf(['roof photo', 'Roof photo'], rec.Document_Type__c) > -1) return true;
//             if (filters.Photos && rec.Category__c == 'Site-Survey' && rec.Document_Type__c == 'Site Survey Form') return true;
//             if (filters.Photos && rec.Category__c == 'Site-Survey' && _.indexOf(['Electrical Panel photo','Electrical Panel Photo'], rec.Document_Type__c) > -1) return true;
//             if (filters.Photos && rec.Category__c == 'Site-Survey' && rec.Document_Type__c == 'Attic Sketch Photo') return true;
//             return false;
//           });
//           res.records = _.map(res.records, function(record) {
//             return {
//               name:       record.Filename__c,
//               s3Id:       record.s3Id__c,
//               sfType:     record.Document_Type__c,
//               sfCategory: record.Category__c
//             };
//           });
//           d.resolve({
//             records:   res.records,
//             projectId: projectId.records[0].Id
//           });
//         });
//       });
//     });
//   return d.promise;
// };

// // GEMINI - Gets any site survey work orders that are assigned to a specific rep Id.
// VForce.prototype.getWorkOrders = function (empId) {
//   return this.getConnection()
//     .then(function () {
//       return conn.queryAsync(addParameters(queries.getWorkOrders, [{name: 'empId', value: empId}]));
//     })
//     .catch(function(err) {
//       log.error('util/vforce.js [getWorkOrders] ERROR: ', '\n\n', JSON.stringify(err), '\n\n');
//       throw new Error(err);
//     });
// };

// VForce.prototype.rescheduleWorkOrder = function (serviceNo) {
//   var d = Q.defer();
//   return this.getConnection()
//     .then(function () { return this.getMilestone(serviceNo); }.bind(this))
//     .then(function (milestone) {
//       console.log(milestone);
//       var updateObj = {Id: milestone};
//       updateObj.Site_Survey_Scheduled__c = null;
//       updateObj.Site_Survey_Scheduled_For__c = null;
//       conn.sobject('Milestone1_Milestone__c').update(updateObj, function (err, res) {
//         if (err) return d.reject(err);
//         d.resolve(res);
//       });
//       return d.promise;
//     })
//     .catch(function(err) {
//       log.error('util/vforce.js [rescheduleWorkOrder] ERROR: ', '\n\n', JSON.stringify(err), '\n\n');
//       throw new Error(err);
//     });
// };

// VForce.prototype.cancelWorkOrder = function (serviceNo) {
//   var d = Q.defer();
//   return this.getConnection()
//     .then(function () { return this.getMilestone(serviceNo); }.bind(this))
//     .then(function (milestone) {
//       milestone.records[0].Cancellation_Requested_Date__c = new Date();
//       conn.sobject('Milestone1_Project__c').update(milestone, function (err, res) {
//         if (err) return d.reject(err);
//         d.resolve(res);
//       });
//       return d.promise;
//     })
//     .catch(function(err) {
//       log.error('util/vforce.js [cancelWorkOrder] ERROR: ', '\n\n', JSON.stringify(err), '\n\n');
//       throw new Error(err);
//     });
// };

// // GEMINI - Pulls Account Info (name, address, phone etc) for a specific account
// VForce.prototype.getAccountInfo = function(serviceNo) {
//   return this.getConnection()
//     .then(function () {
//       return conn.queryAsync(addParameters(queries.getAccountInfo, [{name: 'serviceNo', value: serviceNo}]));
//     })
//     .then(function (accountInfo) {
//       accountInfo = _.extend(accountInfo.records[0].Service__r, {projectId: accountInfo.records[0].Id, office_f__c: accountInfo.records[0].Office_f__c});
//       return Q.all([
//         conn.queryAsync(addParameters(queries.getRepInfo, [{name: 'rep', value: accountInfo.Original_Salesperson__c}])),
//         accountInfo
//       ]);
//     })
//     .then(function (res) {
//       return _.extend(res[0].records[0], res[1]);
//     })
//     .catch(function(err) {
//       log.error('util/vforce.js [getAccountInfo] ERROR: ', '\n\n', JSON.stringify(err), '\n\n');
//       throw new Error(err);
//     });
// };

// // GEMINI - Creates a new Case/Activity with comments from a site-surveyor/site-survey approver
// VForce.prototype.saveComment = function (serviceNo, comment, subject) {
//   var d = Q.defer();
//   return this.getMilestone(serviceNo)
//     .then(function (milestone) {
//       conn.sobject('Task').insert({
//         WhatId:      milestone,
//         Subject:     subject,
//         Description: comment
//       }, function (err, result) {
//         if (err) return d.reject(err);
//         d.resolve(result);
//       });
//       return d.promise;
//     })
//     .catch(function(err) {
//       log.error('util/vforce.js [saveComment] ERROR: ', '\n\n', JSON.stringify(err), '\n\n');
//       throw new Error(err);
//   });
// };

// VForce.prototype.preDesignComplete = function (serviceNo, user) {
//   var d = Q.defer();
//   return this.getConnection()
//     .then(function () {
//       return this.getMilestone(serviceNo);
//     }.bind(this))
//     .then(function (res) {
//       var updateObj = {
//         Id:                       res[0],
//         Completed_Date__c:        new Date(),
//         Pre_Design_Completed1__c: new Date()
//       };
//       conn.sobject('Milestone1_Milestone__c').update(updateObj, function (err, result) {
//         if (err) return d.reject(err);
//         d.resolve(result);
//       });
//       return d.promise;
//   })
//   .catch(function(err) {
//     log.error('util/vforce.js [preDesignComplete] ERROR: ', '\n\n', JSON.stringify(err), '\n\n');
//     throw new Error(err);
//   });

// };

// VForce.prototype.getSurveyDetail = function(serviceIds) {
//   return this.getConnection()
//     .then(function() {
//       var fixed = _.map(serviceIds, function(sid) {
//         return "'" + sid + "'";
//       });
//       var params = [{ name: 'serviceIds', value: fixed.join() }];
//       var query = addParameters(queries.getSiteSurveyByServiceId, params, true);
//       return conn.queryAsync(query);
//     })
//     .catch(function(err) {
//       log.error('util/vforce.js [getSurveyDetail] ERROR: ');
//       log.error(err);
//       throw new Error(err);
//     });
// };

// VForce.prototype.getWorkOrderDetail = function (workOrderIds) {
//   return this.getConnection()
//     .then(function () {
//       var fixed = _.map(workOrderIds, function(sid) {
//         return "'" + sid + "'";
//       });
//       var params = [{ name: 'workOrderIds', value: fixed.join() }];
//       var query = addParameters(queries.getWorkOrderDetails, params, true);
//       return conn.queryAsync(query);
//     })
//     .catch(function(err) {
//       log.error('util/vforce.js [getWorkOrderDetail] ERROR: ', '\n\n', JSON.stringify(err), '\n\n');
//       throw new Error(err);
//   });
// };

// VForce.prototype.surveyStatusUpdate = function(serviceNo, field, value) {
//   return this.getConnection()
//     .then(function() { return this.getMilestone(serviceNo);}.bind(this))
//     .then(function (milestone) {
//       var deferred = Q.defer();
//       var updateObj = {};
//       updateObj.Id = milestone;
//       updateObj[field] = value;
//       conn.sobject('Milestone1_Milestone__c').update(updateObj, function (err, result) {
//         if (err) return deferred.reject(err);
//         deferred.resolve(result);
//       });
//       return deferred.promise;
//     })
//     .catch(function(err) {
//       log.error('util/vforce.js [SurveyStatusUpdate] ERROR: ', '\n\n', JSON.stringify(err), '\n\n');
//       throw new Error(err);
//     });
// };

// VForce.prototype.rejectSurvey = function(serviceNo) {
//   return this.getConnection()
//     .then(function () {
//       return this.getMilestone(serviceNo);
//     }.bind(this))
//     .then(function (milestone) {
//       var d = Q.defer();
//       var updateObj = {
//         Id: milestone,
//         Site_Survey_Rejected__c: new Date()
//       };
//       conn.sobject('Milestone1_Milestone__c').update(updateObj, function (err, res) {
//         if(err) return d.reject(err);
//         d.resolve(res);
//       });
//       return d.promise;
//     })
//     .catch(function(err) {
//       log.error('util/vforce.js [rejectSurvey] ERROR: ', '\n\n', JSON.stringify(err), '\n\n');
//       throw new Error(err);
//     });
// };

// VForce.prototype.getMilestone = function(serviceNo) {
//   return this.getConnection()
//     .then(function() {
//       return conn.queryAsync(addParameters(queries.getMilestone, [{ name: 'serviceNo', value: serviceNo }]));
//     })
//     .then(function(milestone) {
//       return milestone.records[0].Solar_Phase__c;
//     })
//     .catch(function(err) {
//       log.error('util/vforce.js [getMilestone] ERROR: ', '\n\n', JSON.stringify(err), '\n\n');
//       throw new Error(err);
//   });
// };

// VForce.prototype.getAttachmentsById = function(params) {
//   return this.getConnection()
//     .then(function() {
//       return conn.queryAsync(addParameters(queries.getProjectAttachments, params));
//     })
//     .catch(function(err) {
//       log.error('util/vforce.js [getAttachmentsById] ERROR: ', '\n\n', JSON.stringify(err), '\n\n');
//       throw new Error(err);
//   });
// };

// // GEMINI - Pulls all records in the vAttachment table that match a specific Project Id.
// VForce.prototype.getAttachmentsByIdFileName = function(params) {
//   return this.getConnection()
//     .then(function() {
//       return conn.queryAsync(addParameters(queries.getProjectAttachmentByName, params));
//     });
// };

// // GEMINI - Puts an entry from the vAttachment table in the recycle bin, if not restored within 15 days it's deleted.
// VForce.prototype.markAttachmentAsDeleted = function(params) {
//   return this.getConnection()
//     .then(function() {
//       return conn.queryAsync(addParameters(queries.getSingleAttachment, params));
//     })
//     .then(function (res) {
//       return conn.sobject('vAttachment__c').delete(res.records[0].Id);
//     });
// };

// VForce.prototype.moveAttachment = function(photoId, destination) {
//   var d = Q.defer();
//   this.getConnection()
//     .then(function() {
//       return conn.queryAsync(addParameters(queries.getSingleAttachment, [{name: 'Id', value: photoId}]));
//     })
//     .then(function (res) {
//       res.records[0].Document_Type__c = destination;
//       return conn.sobject('vAttachment__c').update(res.records[0], function (err, res) {
//         if (err) return d.reject(err);
//         d.resolve(res);
//       });
//     });
//   return d.promise;
// };

// VForce.prototype.deleteAttachments = function(serviceNo, category, type) {
//   return this.getConnection()
//     .then(function() {
//       return conn.queryAsync('Select Id FROM Milestone1_Project__c WHERE Service__r.Service_Number__c = \'' + serviceNo + '\'');
//     })
//     .then(function (projectId) {
//       return this.getAttachmentsById([{name: 'projectCode', value: projectId.records[0].Id}]);
//     }.bind(this))
//     .then(function (attachments) {
//       var attachmentsToDelete = _.filter(attachments.records, function (attach) { return attach.Document_Type__c == type && attach.Category__c == category;});
//       _.each(attachmentsToDelete, function (attach) {
//         // SMTL Salesforce doesn't have a callback/promise for the sobject.delete method.
//         conn.sobject('vAttachment__c').delete(attach.Id);
//       });
//       return {success: true, filesRemoved: attachmentsToDelete.length};
//     })
//     .catch(function(err) {
//       log.error('util/vforce.js [getAttachmentsById] ERROR: ', '\n\n', JSON.stringify(err), '\n\n');
//       throw new Error(err);
//     });
// };

// VForce.prototype.workOrderApprovalAction = function (employeeId, serviceNo, partialType, action) {
//   var resultCodes = {
//     'interior': 'Complete - Interior Site Survey',
//     'exterior': 'Complete - Exterior Site Survey',
//     'complete': 'Solar-Site Survey Completed'
//   };
//   return this.getConnection()
//     .then(function () {
//       return Q.all([
//         conn.queryAsync('SELECT Id FROM Vivint_Employee__c WHERE Employee_ID__c = \'' + employeeId + '\''),
//         conn.queryAsync(addParameters(queries.getPartialWorkOrders, [{name: 'serviceNo', value: serviceNo}, {name: 'resultCode', value: resultCodes[partialType]}])),
//       ]);
//     })
//     .then(function (data) {
//       var user       = data[0].records[0];
//       var workOrders = data[1].records;

//       if (!workOrders.length) throw new Error('No Work Orders Found With Result Code: ' + resultCodes[partialType]);
//       workOrders.sort(function (a, b) { return a.LastModifiedDate > b.LastModifiedDate ? a : b; });
//       return {workOrder: workOrders[0], user: user};
//     })
//     .then(function (data) {
//       var d = Q.defer();
//       var updateObj = {
//         Id:                      data.workOrder.Id,
//         Status__c:               action,
//         Approved_Rejected_By__c: data.user.Id,
//         Approved_Rejected_On__c: new Date(),
//       };
//       conn.sobject('Work_Order__c').update(updateObj, function (err, res) {
//         if (err) return d.reject(err);
//         d.resolve(res);
//       });
//       return d.promise;
//     })
//     .catch(function(err) {
//       log.error('util/vforce.js [workOrderApprovalAction] ERROR: ', '\n\n', JSON.stringify(err), '\n\n');
//       throw new Error(err);
//     });
// };

// ///// GEMINI - CORP CHECK ////////////////////////////

// VForce.prototype.getContract = function(serviceNo) {
//   return this.getConnection()
//     .then(function () {
//       return conn.queryAsync('SELECT Id FROM Milestone1_Project__c WHERE Service__r.Service_Number__c = \'' + serviceNo + '\'');
//     })
//     .then(function (results) {
//       return conn.queryAsync(addParameters(queries.getProjectAttachments, [{name: 'projectCode', value: results.records[0].Id}]));
//     })
//     .then(function (results) {
//       return _.filter(results.records, function (attachment) {
//         return (attachment.Category__c == 'Contract-Finance' && attachment.Document_Type__c == 'Contract Pending Review')
//             || (attachment.Category__c == 'Contract-Finance' && attachment.Document_Type__c == 'PPA')
//             || (attachment.Category__c == 'Archive' && attachment.Document_Type__c == 'Contract-Finance');
//       });
//     })
//     .then(function (contracts) {
//       contracts.sort(function (a, b) {
//         return a.LastModifiedDate > b.LastModifiedDate ? false : true;
//       });
//       return contracts[0];
//     })
//     .catch(function(err) {
//       log.error('util/vforce.js [getContract] ERROR: ', '\n\n', JSON.stringify(err), '\n\n');
//       throw new Error(err);
//     });
// };

// VForce.prototype.getContractInfo = function (serviceNo) {
//   var contractInfo;
//   return this.getConnection()
//     .then(function () {
//       return conn.queryAsync(addParameters(queries.getContractInfo, [{name: 'serviceNo', value: serviceNo}]));
//     })
//     .then(function (data) {
//       contractInfo = data;
//       var contacts = [data.records[0].Project__r.Service__r.Contract_Signer__r.Id];
//       if (data.records[0].Project__r.Service__r.Contract_Cosigner__r) {
//         contacts.push(data.records[0].Project__r.Service__r.Contract_Cosigner__r.Id);
//       }
//       return Q.all([getAllCreditReports(contacts), getPreSurveyResults(serviceNo), this.getHoldsOnAccount(serviceNo)]);
//     }.bind(this))
//     .then(function (data) {
//       contractInfo.creditReports = data[0];
//       contractInfo.preSurveyInfo = data[1];
//       contractInfo.holds         = data[2].records;
//       return contractInfo;
//     })
//     .catch(function(err) {
//       log.error('util/vforce.js [getContractInfo] ERROR: ', '\n\n', JSON.stringify(err), '\n\n');
//       throw new Error(err);
//     });
// };

// VForce.prototype.getHoldsOnAccount = function (serviceNo) {
//   return this.getConnection()
//     .then(function () {
//       return conn.queryAsync('SELECT Hold_Type__r.Name FROM Holds__c WHERE Solar_Project__r.Service__r.Service_Number__c = \'' + serviceNo + '\' AND Status__c = \'Active\'');
//     })
//     .catch(function(err) {
//       log.error('util/vforce.js [getHoldsOnAccount] ERROR: ', '\n\n', JSON.stringify(err), '\n\n');
//       throw new Error(err);
//     });
// };

// VForce.prototype.getHoldsOnAccountWithName = function (serviceNo, holdName) {
//   return this.getConnection()
//     .then(function () {
//       return conn.queryAsync('SELECT Hold_Type__r.Name, Id, Status__c  FROM Holds__c WHERE Solar_Project__r.Service__r.Service_Number__c = \'' + serviceNo + '\' AND Status__c = \'Active\' AND Hold_Type__r.Name = \'' + holdName + '\'');
//     })
//     .catch(function(err) {
//       log.error('util/vforce.js [getHoldsOnAccountWithName] ERROR: ', '\n\n', JSON.stringify(err), '\n\n');
//       throw new Error(err);
//     });
// };

// VForce.prototype.updateAccountInfo = function(query, table, updateObj) {
//   return this.getConnection()
//     .then(function () {
//       return conn.queryAsync(query);
//     })
//     .then(function (result) {
//       var d = Q.defer();
//       updateObj.Id = result.records[0].Solar_Phase__r ? result.records[0].Solar_Phase__r.Id : result.records[0].Id;
//       console.log(updateObj);
//       conn.sobject(table).update(updateObj, function (err, res) {
//         if (err) return d.reject(err);
//         d.resolve(res);
//       });
//       return d.promise;
//     })
//     .catch(function (err) {
//       log.error('util/vforce.js [updateAccountInfo] ERROR: ', '\n\n', JSON.stringify(err), '\n\n');
//       throw new Error(err);
//     });
// };

// VForce.prototype.updateContact = function (query, updateObj) {
//   return this.getConnection()
//     .then(function () {
//       return conn.queryAsync(query);
//     })
//     .then(function (res) {
//       var promises = [_updateContact(res.records[0].Contract_Signer__c, _.omit(updateObj, 'cosigner'))];
//       if (res.records[0].Contract_Cosigner__c) promises.push(_updateContact(res.records[0].Contract_Cosigner__c, updateObj.cosigner));
//       return Q.all(promises);
//     })
//     .catch(function (err) {
//       log.error('util/vforce.js [updateContact] ERROR: ', '\n\n', JSON.stringify(err), '\n\n');
//       throw new Error(err);
//     });
// };

// VForce.prototype.approveContract = function(serviceNo, transactionDate, customerLastName) {
//   return this.getConnection()
//     .then(function () {
//       return this.getMilestone(serviceNo);
//     }.bind(this))
//     .then(function (results) {
//       return _updatePhase({
//         Id:                results,
//         Corp_Checked__c:   new Date(),
//         Completed_Date__c: new Date()
//       });
//     })
//     .then(function () {
//       return this.getContract(serviceNo);
//     }.bind(this))
//     .then(function (contract) {
//       // Get Contract Pending Review attachment
//       return _updateContract(contract, serviceNo, {
//         Name:             customerLastName + '.PPA.pdf',
//         Filename__c:      customerLastName + '.PPA.pdf',
//         Document_Type__c: 'PPA',
//       });
//     })
//     .catch(function (err) {
//       log.error('util/vforce.js [approveContract] ERROR: ', '\n\n', JSON.stringify(err), '\n\n');
//       throw new Error(err);
//     });
// };

// VForce.prototype.createHold = function(serviceNo, hold, comment) {
//   return Q.all([
//       conn.queryAsync('SELECT Id FROM Milestone1_Project__c WHERE Service__r.Service_Number__c = \'' + serviceNo + '\''),
//       conn.queryAsync('SELECT Id FROM RecordType WHERE sObjectType = \'Holds__c\' and Name = \'Solar\'')
//     ])
//     .then(function (res) {
//       var d = Q.defer();
//       conn.sobject('Holds__c').insert({
//         Status__c:             'Active',
//         Hold_Type__c:          hold,
//         RecordTypeId:          res[1].records[0].Id,
//         Solar_Project__c:      res[0].records[0].Id,
//         Additional_Details__c: comment
//       }, function (err, res) {
//         if (err) return d.reject(err);
//         d.resolve(res);
//       });
//       return d.promise;
//     })
//     .catch(function (err) {
//       log.error('util/vforce.js [createHold] ERROR: ', '\n\n', JSON.stringify(err), '\n\n');
//       throw new Error(err);
//     });
// };

// VForce.prototype.createActivity = function (serviceNo, employeeId, activityObject) {
//   return this.getConnection()
//     .then(function () {
//       return Q.all([
//         conn.queryAsync('SELECT Id FROM User WHERE Employee_Id__c =\'' + employeeId + '\''),
//         this.getMilestone(serviceNo)
//       ]);
//     }.bind(this))
//     .then(function (data) {
//       var d = Q.defer();
//       if (!activityObject.RecordTypeId) return d.reject('No Record Type Id Found On Activity Object!');
//       _.extend(activityObject, { OwnerId: data[0].records[0].Id, WhatId: data[1] });
//       conn.sobject('Task').insert(activityObject, function (err, res) {
//         if (err) return d.reject(err);
//         d.resolve(res);
//       });
//       return d.promise;
//     })
//     .catch(function (err) {
//       log.error('util/vforce.js [createActivity] ERROR: ', '\n\n', JSON.stringify(err), '\n\n');
//       throw new Error(err);
//     });
// };

// VForce.prototype.rejectContract = function(serviceNo, hold, comment, customerLastName) {
//   return this.getConnection()
//     .then(function () {
//       return conn.queryAsync('SELECT Id FROM Hold_Type__c WHERE Name = \'Missing PPA/Lease Agreement\'');
//     })
//     .then(function (res) {
//       return this.createHold(serviceNo, res.records[0].Id, 'PPA Rejected - Gemini Corp Check');
//     }.bind(this))
//     .then(function () {
//       return this.getContract(serviceNo);
//     }.bind(this))
//     .then(function (contract) {
//       var date = moment().format('MM_D_YYYY').toString();
//       return Q.all([
//         this.createHold(serviceNo, hold, comment),
//         _updateContract(contract, serviceNo, {
//           Name:             customerLastName + '_' + date + '.PPA.pdf',
//           Filename__c:      customerLastName + '_' + date + '.PPA.pdf',
//           Category__c:      'Archive',
//           Document_Type__c: 'Contract-Finance',
//         })
//       ]);
//     }.bind(this))
//     .catch(function (err) {
//       log.error('util/vforce.js [rejectContract] ERROR: ', '\n\n', JSON.stringify(err), '\n\n');
//       throw new Error(err);
//     });
// };

// VForce.prototype.revertContract = function (serviceNo) {
//   return this.getConnection()
//     .then(function () {
//       return this.getMilestone(serviceNo);
//     }.bind(this))
//     .then(function (results) {
//       return _updatePhase({
//         Id:                results,
//         Corp_Checked__c:   null,
//         Completed_Date__c: null
//       });
//     })
//     .then(function () {
//       return this.getContract(serviceNo);
//     }.bind(this))
//     .then(function (contract) {
//       return _updateContract(contract, serviceNo, {
//         Category__c:      'Contract-Finance',
//         Document_Type__c: 'Contract Pending Review'
//       });
//     })
//     .then(function () {
//       return conn.queryAsync('SELECT Id FROM Milestone1_Project__c WHERE Service__r.Service_Number__c = \'' + serviceNo + '\'');
//     })
//     .then(function (res) {
//       return conn.queryAsync('SELECT Id, CreatedDate FROM Holds__c WHERE Solar_Project__c = \'' + res.records[0].Id + '\' AND CreatedById = \'005G00000055VZ3\'');
//     })
//     .then(function (res) {
//       var promises = [];
//       var that = this;
//       _.each(res.records, function (hold) {
//         if (moment().dayOfYear() == moment(hold.CreatedDate).dayOfYear()) { promises.push(that.deleteHold(hold.Id)); }
//       });
//       return Q.all(promises);
//     }.bind(this))
//     .catch(function (err) {
//       log.error('util/vforce.js [revertContract] ERROR: ', '\n\n', JSON.stringify(err), '\n\n');
//       throw new Error(err);
//     });
// };

// VForce.prototype.getHoldTypes = function (types) {
//   return this.getConnection()
//     .then(function () {
//       return conn.queryAsync(
//           addParameters(
//               queries.getHoldTypes,
//               [ {
//                   name: 'holdTypes',
//                   // the following code is to keep any escaped quotes in the string when passing it to the sql query
//                   value: "('" + types.join("','").replace(/([^,])'(?!,)/g, function($0, $1){return $1 + "\\'";}) + "')"
//                 }
//               ],
//               true
//           )
//       );
//     })
//     .catch(function (err) {
//       log.error('util/vforce.js [getHoldTypes] ERROR: ', '\n\n', JSON.stringify(err), '\n\n');
//       throw new Error(err);
//     });
// };

// VForce.prototype.markHoldResolved = function (hold) {
//   return this.getConnection()
//     .then(function() {
//       var d = Q.defer();
//       hold.Status__c = "Resolved";
//       conn.sobject('Holds__c').update(hold, function (err, res) {
//         if (err) return d.reject(err);
//         d.resolve(res);
//       });
//       return d.promise;
//     });
// };

// VForce.prototype.deleteHold = function (Id) {
//   return this.getConnection()
//     .then(function() {
//       return conn.sobject('Holds__c').delete(Id);
//     });
// };

// // ------------ Helper functions ----------------
// function _updateContact(id, updateObj) {
//   var d = Q.defer();
//   updateObj.Id = id;
//   conn.sobject('Contact').update(updateObj, function (err, res) {
//     if (err) return d.reject(err);
//     d.resolve(res);
//   });
//   return d.promise;
// }

// function _updatePhase(updateObj) {
//   // Update phase with new fields
//   var d = Q.defer();
//   conn.sobject('Milestone1_Milestone__c').update(updateObj, function (err, res) {
//     if (err) return d.reject(err);
//     d.resolve(res);
//   });
//   return d.promise;
// }

// function _updateContract(contract, serviceNo, updateObj) {
//   var d = Q.defer();
//   updateObj.Id = contract.Id;
//   conn.sobject('vAttachment__c').update(updateObj, function (err, res) {
//     if (err) return d.reject(err);
//     d.resolve(res);
//   });
//   return d.promise;
// }

// function getAllCreditReports (contacts) {
//   var promises = [];
//   // contacts array - index 0 == signer, index 1 (if exists) == cosigner
//   _.each(contacts, function (contact) {
//     promises.push(conn.queryAsync('SELECT Range_Solar__c, Credit_Check_Date__c FROM Credit_Report__c WHERE Contact__c = \'' + contact + '\''));
//   });
//   return Q.all(promises)
//     .then(function (results) {
//       var creditReports = {
//         signer: results[0].records,
//         cosigner: results[1] ? results[1].records : []
//       };
//       return creditReports;
//     })
//     .catch(function(err) {
//       log.error('util/vforce.js [getAllCreditReports] ERROR: ', '\n\n', JSON.stringify(err), '\n\n');
//       throw new Error(err);
//     });
// }

// function getPreSurveyResults(serviceNo) {
//   return conn.queryAsync('SELECT Result__c, CreatedDate FROM Survey_Result__c WHERE Opportunity__r.Service__r.Service_Number__c = \'' + serviceNo + '\' AND Survey_Type__c = \'Pre-Install Survey\' ORDER BY CreatedDate DESC NULLS LAST')
//     .then(function (data) {
//       return data.records[0];
//     })
//     .catch(function(err) {
//       log.error('util/vforce.js [getPreSurveyResults] ERROR: ', '\n\n', JSON.stringify(err), '\n\n');
//       throw new Error(err);
//     });
// }

// ///////////////////////////////////////////////////////

// /**
//  * getAccounts
//  * @returns {promise|*|promise|promise|Function|promise}
//  */
// VForce.prototype.getAccounts = function() {
//   var d = Q.defer();
//   this.getConnection()
//     .then(function() {
//       conn.query('SELECT Id, Name FROM Account', function(err, res) {
//         if(!!err) {
//           d.reject(err);
//         } else {
//           d.resolve(res);
//         }
//       });
//     });

//   return d.promise;
// };
// /**
//  * updateProjectWithSystemId
//  * @param projectId
//  * @param systemId
//  * @returns {promise|*|promise|promise|Function|promise}
//  */
// VForce.prototype.updateProjectWithSystemId = function(projectId, systemId) {
//   var d = Q.defer();
//   this.getConnection()
//     .then(function () {
//       conn.sobject('Milestone1_Project__c').update({
//         Id: projectId,
//         System_ID__c: systemId
//       }, function(err, result) {
//         if(!!err) {
//           d.reject(err);
//         } else {
//           // TODO: fix the return
//           d.resolve(result);
//         }
//       });
//     });

//   return d.promise;
// };

// /**
//  * getSolarInventory
//  * @param params
//  * @returns {Function|g.promise|l.promise|promise|Deferred.promise|Q.promise|*}
//  */
// VForce.prototype.getSolarInventory = function(params) {
//   var d = Q.defer();
//   this.getConnection()
//     .then(function() {
//       conn.query(addParameters(queries.getSolarInventory, params, true), function(err, res) {
//         if(!!err) {
//           d.reject(err);
//         } else {
//           d.resolve(res)
//         }
//       })
//     }).fail(function(err){
//       d.reject(err);
//     });
//   return d.promise;
// };
// /**
//  * select Tranche_A_Capital_Contribution_Date__c, Tranche_A_Capital_Contribution_Value__c, Tranche_Name__c from Solar_Funding__c WHERE Project__r.Service__r.NameProject__c = 'sdlfksjd'
//  * select Account__c, Name, Account_ID_f__c from Service__c
//  */
// /**
//  * Update funding for accounts specified in tranche
//  * @param  {Array}    account_nos     Account numbers to update
//  */
// VForce.prototype.getSolarFunding = function (service_nos) {
//   var d = Q.defer();
//   this.getConnection()
//     .then(function(){
//       var inStr = service_nos.reduce(function(prev, curr, idx){
//         if(idx){
//           prev += ',';
//         }
//         prev += "'"+curr+"'";
//         return prev;
//       },'');
//       conn.query('select Id, Funding_Partner__c, Tranche_Name__c, LastModifiedDate, Status__c, Project__r.Service__r.Service_Number__c from Solar_Funding__c where Project__r.Service__r.Service_Number__c IN('+inStr+') and Status__c != \'Refunded\'', function (err, data) {
//         d.resolve(data.records);
//       });
//     });
//   return d.promise;
// };

// /**
//  * Update funding for accounts specified in tranche
//  * @param  {String}   fund         Fund name to update accounts with
//  * @param  {Array}    account_nos     Account numbers to update
//  */
// VForce.prototype.updateFunding = function (fund, accounts) {
//   var d = Q.defer();
//   return this.getConnection()
//     .then(function() {
//       var updates = 0;
//       async.each(accounts, function(account, cb){
//         if(account.Id) updates++;
//         cb();
//         conn.sobject('Solar_Funding__c')[account.Id?'update':'insert'](accounts, cb);
//       }, function(err){
//         if(err){
//          return d.reject(err);
//         }
//         d.resolve({message: 'Created ' + (accounts.length - updates) + ', updated ' + updates + ' "Solar_Funding__c" for fund "' + fund +'"'});
//       });

//       return d.promise;
//     })
//     .catch(function(err) {
//       log.error('util/vforce.js [saveComment] ERROR: ', '\n\n', JSON.stringify(err), '\n\n');
//       throw new Error(err);
//   });
// };

// /**
//  * getSolarInventoryCountByProjectId
//  * @param params
//  * @returns {Function|g.promise|l.promise|promise|Deferred.promise|Q.promise|*}
//  */
// VForce.prototype.getSolarInventoryCountByProjectId = function(params) {
//   var d = Q.defer();
//   this.getConnection()
//     .then(function() {
//       conn.query(addParameters(queries.getSolarInventoryCountByProjectId, params, false), function(err, res) {
//         if(!!err) {
//           d.reject(err);
//         } else {
//           d.resolve(res)
//         }
//       })
//     }).fail(function(err){
//       d.reject(err);
//     });
//   return d.promise;
// };

/**
* createSQLString
* Takes a returned SQL array and key and builds a sql string with it
* Useful for a SQL in () statement
* @returns (string)
*/
function createSQLString(array, field, subField) {
  var str = '';
  _.each(array, function (a, index) {
    var nextArrayItem;
    if (field && subField) nextArrayItem = a[field][subField];else if (field) nextArrayItem = a[field];else nextArrayItem = a;
    if (!nextArrayItem) return;
    str += '\'' + nextArrayItem + '\'';
    if (index < array.length - 1) str += ', ';
  });
  return str;
}
/**
 * addParameters
 * Replaces placeholders for the parameters in the query
 * @param query
 * @param params
 * @returns {*}
 */
function addParameters(query, params, noQuotes) {
  _.forEach(params, function (param) {
    if (noQuotes) {
      query = query.replace('@' + param.name, param.value);
    } else {
      query = query.replace('@' + param.name, '\'' + param.value + '\'');
    }
  });
  return query;
}

module.exports = VSForce;