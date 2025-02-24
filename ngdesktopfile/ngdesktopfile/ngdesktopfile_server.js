var storage = {};

$scope.api.writeFile = function(path,bytes, callback, passThru)
{
    var key=Math.random().toString(10);
	storage[key] = {
        callback: callback,
        passThru: passThru
    }
	$scope.api.writeFileImpl(path,servoyApi.getMediaUrl(bytes), key);
}

$scope.api.writeTempFileSync = function(bytes) 
{
    return $scope.api.writeFileSyncImpl(servoyApi.getMediaUrl(bytes));
}

$scope.api.readFileSync = function(path)
{
	var key=Math.random().toString(10);
	storage[key] = {
        callback: $scope.syncCallback, 
        path: path,
        isSync: true    
    };
	$scope.api.readFileImpl(path, key); // this will resume after readCallback execution return
    servoyApi.suspend();
    var tmpData = storage[key].syncData;
    var tmpError = storage[key].error;
    storage[key] = null;
    if (tmpError) throw tmpError;
    return tmpData;     //return my temporary path
}

$scope.api.readFile = function(callback, path)
{
	var key=Math.random().toString(10);
	storage[key] = {
        callback: callback,
		path: path
    };
	$scope.api.readFileImpl(path, key,  null);
}

$scope.readCallback = function(data, id) {
	var key = null;
    var path = null;
    var error = null;
    // if id is set then this is the error callback, data is the error message
    if (id) {
        key = id;
        error = data;
        data = null;
        path = storage[key].path; 
    } else {
        key = data.getFieldValue("id");
        path = data.getFieldValue("path");
    }
    if (storage[key].callback && storage[key].isSync) { 
        storage[key].callback(key, data, error);
    } else if (storage[key].callback) {
        storage[key].callback(path, data, error);
        storage[key] = null;
    }
}

$scope.syncCallback = function(key, data, error) { 
	storage[key].syncData = data;
    storage[key].error = error;
    servoyApi.resume();
}

$scope.writeCallback = function(message, key) {
	var record = storage[key];
    if (storage[key].callback && storage[key].isSync) { //if this call is originated from writeTempFileSync
        storage[key].callback(key, message); //this callback is set to $scope.api.syncCallback
    } else if (record.callback) { //else we keep the original processing
        storage[key].callback(message, record.passThru);
        storage[key] = null;
    }
}

