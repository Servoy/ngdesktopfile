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
        callback: $scope.api.syncCallback, 
        isSync: true    
    };
	$scope.api.readFileSyncImpl(path, key); // this will resume after readCallback execution return
    var tmpData = storage[key].syncData;
    storage[key] = null;
    return tmpData;     //return my temporary path
}

$scope.api.readFile = function(callback, path)
{
	var key=Math.random().toString(10);
	storage[key] = {
        callback: callback
    };
	$scope.api.readFileImpl(path, key,  null);
}

$scope.api.readCallback = function(data) {
	var key = data.getFieldValue("id");
    if (storage[key].callback && storage[key].isSync) { 
        storage[key].callback(key, data);
    } else if (storage[key].callback) {
        storage[key].callback(data.getFieldValue("path"), data);
        storage[key] = null;
    }
}

$scope.api.syncCallback = function(key, data) { 
	storage[key].syncData = data;
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

