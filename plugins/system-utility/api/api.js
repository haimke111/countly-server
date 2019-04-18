var plugin = {},
    cluster = require('cluster'),
    common = require('../../../api/utils/common.js'),
    tracker = require('../../../api/parts/mgmt/tracker.js'),
    plugins = require('../../pluginManager.js'),
    systemUtility = require('./system.utility');

(function() {
    //write api call
    /*
	plugins.register("/i", function(ob){
		
	});
	*/

    plugins.register("/o/system", function(ob) {

        var params = ob.params,
            path = ob.paths[3].toLowerCase(),
            qstring = ob.params.qstring,
            validate = ob.validateUserForGlobalAdmin;

        switch (path) {
        case 'memory':
        case 'disks':
        case 'cpu':
        case 'database':
        case 'overall':
        case "healthcheck":
        case "dbcheck":
            validate(params, () => {
                systemUtility[path](qstring)
                    .then(
                        res => common.returnMessage(params, 200, res),
                        res => common.returnMessage(params, 500, res)
                    );
            });
            return true;
        default:
            return false;
        }


    });

    //ping server stats periodically
    if (tracker.isEnabled() && cluster.isMaster) {
        var timeout = 1000 * 60 * 15;
        var getServerStats = function() {
            Promise.all([systemUtility.memory(), systemUtility.disks(), systemUtility.cpu(), systemUtility.database(), systemUtility.dbcheck()].map(p => p.catch(() => null))).then(function(values) {
                console.log(JSON.stringify(values, null, 2));
                var sdk = tracker.getSDK();
                //track ram
                var ram = values[0];
                if (ram && ram.details) {
                    var id;
                    for (let i = 0; i < ram.details.length; i++) {
                        if (ram.details[i].id !== "-/+") {
                            id = ram.details[i].id;
                            sdk.userData.set(id + "_total", Math.ceil(parseFloat(ram.details[i].total) / 1024));
                            sdk.userData.set(id + "_free", Math.round(parseFloat(ram.details[i].free) / 1024));
                            sdk.userData.set(id + "_used", Math.round(parseFloat(ram.details[i].used) / 1024));
                            sdk.userData.set(id + "_usage", parseFloat(ram.details[i].usage).toFixed(2));
                        }
                    }
                }
                //track disks
                var disks = values[1];
                if (disks && disks.details) {
                    for (let i = 0; i < disks.details.length; i++) {
                        sdk.userData.set("disk_" + i, disks.details[i].id);
                        sdk.userData.set("disk_" + i + "_total", Math.ceil(parseFloat(disks.details[i].total) / 1024 / 1024 / 1024));
                        sdk.userData.set("disk_" + i + "_free", Math.round(parseFloat(disks.details[i].free) / 1024 / 1024 / 1024));
                        sdk.userData.set("disk_" + i + "_used", Math.round(parseFloat(disks.details[i].used) / 1024 / 1024 / 1024));
                        sdk.userData.set("disk_" + i + "_usage", parseFloat(disks.details[i].usage).toFixed(2));
                    }
                }

                //track db disks
                var cpu = values[2];
                if (cpu && cpu.overall) {
                    sdk.userData.set("cpu_usage", parseFloat(cpu.overall.usage).toFixed(2));
                }

                //track db disks
                disks = values[3];
                if (disks && disks.details) {
                    for (let i = 0; i < disks.details.length; i++) {
                        sdk.userData.set("disk_db" + i + "_total", Math.ceil(parseFloat(disks.details[i].total) / 1024 / 1024 / 1024));
                        sdk.userData.set("disk_db" + i + "_free", Math.round(parseFloat(disks.details[i].free) / 1024 / 1024 / 1024));
                        sdk.userData.set("disk_db" + i + "_used", Math.round(parseFloat(disks.details[i].used) / 1024 / 1024 / 1024));
                        sdk.userData.set("disk_db" + i + "_usage", parseFloat(disks.details[i].usage).toFixed(2));
                    }
                }

                sdk.userData.set("db_connection", values[3] ? true : false);
                sdk.userData.save();
                setTimeout(getServerStats, timeout);
            }, function() {
                setTimeout(getServerStats, timeout);
            });
        };
        common.db.onOpened(function() {
            getServerStats();
        });
    }
}(plugin));

module.exports = plugin;